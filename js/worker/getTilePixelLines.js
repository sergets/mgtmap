define([
    'worker/utils/require-ymaps',
    'utils/geom',
    'utils/route',
    'utils/junction',
    'utils/cache',
    'worker/utils/tile-utils'
], function(
    requireYmaps,
    geomUtils,
    routeUtils,
    junctionUtils,
    Cache,
    TileUtils
) {
	var EPSILON = 1e-5;

	return function(x, y, z, purpose) {
		var actuals = this.actuals,
			data = this.data,
			cache = this.tilePixelLinesCache,
			cachedLines = cache.get(x, y, z, purpose);

		return new Promise(function(resolve) {
			if(cachedLines) {
				resolve(cachedLines);
				return;
			}

			requireYmaps([
				'projection.wgs84Mercator',
				'graphics.generator.stroke.outline'
			], function(
				projection,
				generator
			) {
				var tileUtils = TileUtils(projection, generator);
					res = [],
					zoomWidthFactor = tileUtils.getZoomFactor(z),
					tilePixelSegments = {},
					cutSegments = {},
					junctionLineGeometries = new Cache(1000);

				var	resSegmentLines = [],
					resJunctionLines = [],
					doneJunctions = {};

				tileUtils.getObjectIdsByTile(x, y, z, zoomWidthFactor * actuals.maxWidth).forEach(function(id) {
					resSegmentLines.push({
						geometry : getCutSegment(id),
						routes : actuals.routes[id] || [],
						id : id,
					});

					var segment = data.segments[id],
						startJunctionKey = junctionUtils.getEndPointKey(segment[0]),
						endJunctionKey = junctionUtils.getEndPointKey(segment[segment.length - 1]);

					[startJunctionKey, endJunctionKey].filter(function(junctionId) {
						return !!actuals.junctions[junctionId] && !(junctionId in doneJunctions)
					}).forEach(function(junctionId) { 
						doneJunctions[junctionId] = true;

						var junction = actuals.junctions[junctionId];

						junction.routeGroups.forEach(function(junctionRouteGroup) {
							var fromId = junctionRouteGroup.from,
		                		toId = junctionRouteGroup.to;

                			if(toId) {
		                		var junctionLineGeometry = getJunctionLineGeometry(fromId, toId, junctionRouteGroup.fromShift, junctionRouteGroup.toShift, junction.size).slice(),
		                			junctionLineLength = geomUtils.getLength(junctionLineGeometry);

			                	resJunctionLines.push({
			                		geometry : geomUtils.cut(junctionLineGeometry, junctionLineLength / 2 + EPSILON, EPSILON),
			                		routes : junctionRouteGroup.routes,
			                		id : Math.abs(toId)
			                	}, {
			                		geometry : geomUtils.cut(junctionLineGeometry, EPSILON, junctionLineLength / 2 + EPSILON),
			                		routes : junctionRouteGroup.routes,
			                		id : Math.abs(fromId)
			                	});
			                } // else {		 
			                	// TODO fix strange lines like this:            		
			                	/*	var tail = fromId > 0? getSegmentStart(fromId).slice() : getSegmentEnd(-fromId).slice(),
				                		shiftedTail = tileUtils.offsetLine(tail, junctionRouteGroup.fromShift * zoomWidthFactor);

				                	resJunctionLines.push({
				                		geometry : shiftedTail,
				                		routes : junctionRouteGroup.routes,
				                		id : Math.abs(fromId)
				                	}); */
			                //}
	                	})
					});
				});

				var objects = resSegmentLines.concat(resJunctionLines);

				var tilePixelLines = objects.reduce(function(lines, object) {
					var segmentUnshiftedCoords = object.geometry,
						id = object.id;

					var routes = object.routes,
						widths = actuals.widths,
						colors = actuals.colors,
						segmentOutlines = actuals.outlines,
						totalWidth = routes.reduce(function(s, route) {
							return s + (widths[routeUtils.strip(route)] || 0);
						}, 0) * zoomWidthFactor,
						curPosition = -totalWidth / 2;

					// Generate segment overall outline
					if(id && segmentOutlines[id] || purpose == 'hotspots') {
						var opaqueOffsetLeft = 0; 
						routes.some(function(route) {
							if(routeUtils.notPhantom(route)) {
								return true;
							} else {
								opaqueOffsetLeft += (widths[routeUtils.strip(route)] || 0);
							}
						});
						opaqueOffsetLeft = opaqueOffsetLeft * zoomWidthFactor;

						var opaqueOffsetRight = 0; 
						routes.slice(0).reverse().some(function(route) {
							if(routeUtils.notPhantom(route)) {
								return true;
							} else {
								opaqueOffsetRight += (widths[routeUtils.strip(route)] || 0);
							}
						});
						opaqueOffsetRight = opaqueOffsetRight * zoomWidthFactor;

						var opaqueOffset = (opaqueOffsetLeft - opaqueOffsetRight) / 2;

						var outlinePath = tileUtils.offsetLine(segmentUnshiftedCoords, opaqueOffset);

						id && segmentOutlines[id] && Object.keys(segmentOutlines[id]).forEach(function(width) {
							var outlineDescription = segmentOutlines[id][width];
							if(!outlineDescription.color) {
								outlineDescription = { color : outlineDescription, offset : 0 };
							}
 							lines.push({
								coords : outlineDescription.offset? tileUtils.offsetLine(segmentUnshiftedCoords, opaqueOffset + outlineDescription.offset * zoomWidthFactor) : outlinePath,
								color : outlineDescription.color,
								data : { id : id },
								width : totalWidth - opaqueOffsetLeft - opaqueOffsetRight + 2 * width * zoomWidthFactor,
								dashStyle : [],
								lineCap : 'butt',
								dashOffset : 0
							});
 						});

 						purpose == 'hotspots' && lines.push({
							coords : outlinePath,
							color : '#000',
							data : { id : id },
							width : totalWidth - opaqueOffsetLeft - opaqueOffsetRight,
							dashStyle : [],
							dashOffset : 0
						});
					}

					// Generate route lines
					(purpose != 'hotspots') && routes.forEach(function(route) {
						var width = widths[routeUtils.strip(route)] * zoomWidthFactor || 0,
							direction,
							dashLines = [];

						curPosition += width/2;

						if(width == 0) { return; }

						if(routeUtils.notPhantom(route)) {	
							switch(route[0]) {
								case '>':
									direction = 1;
								case '<':
									direction = direction || -1;

									var DASH_LENGTH = 0,
										DASH_GAP = 8,
										ARROW_LENGTH = 1.5,
										ARROW_WIDTH = 3;

					                var arrowSteps = Math.max(Math.ceil(ARROW_WIDTH * width / 2), 2);
	           						for(var j = ARROW_WIDTH; j > 0; j -= 1/arrowSteps) {
	           							dashLines.push({
	           								width : j * width,
	           								dashStyle : [ width * (DASH_LENGTH + ARROW_LENGTH * (ARROW_WIDTH - j)), width * (ARROW_LENGTH * j + DASH_GAP)],
	           								dashOffset : direction == 1? width * (DASH_GAP/2) :  - width * (j * ARROW_LENGTH + DASH_GAP/2)
	                    				});
	           						}
			
								default:
									dashLines.push({
										width : width,
										dashStyle : [],
										dashOffset : 0
									});
									
									var resPath = tileUtils.offsetLine(segmentUnshiftedCoords, curPosition);

									lines = lines.concat(dashLines.map(function(line) {
										return Object.assign({
											coords : resPath,
											color : colors[routeUtils.strip(route)] || '#ccc',
											data : { id : id, route : routeUtils.strip(route) }
										}, line);
									}));
							}
						}

						curPosition += width/2;
					});

					return lines;
				}, []);

				cache.set(x, y, z, purpose, tilePixelLines);
				resolve(tilePixelLines);

				/////

				function getTilePixelSegment(id) {
					if(!tilePixelSegments[Math.abs(id)]) {
						tilePixelSegments[Math.abs(id)] = data.segments[Math.abs(id)].map(function(geoPoint) {
							return tileUtils.geoPointToTilePixels(geoPoint, x, y, z);
						});
					}
					return id > 0? tilePixelSegments[id] : tilePixelSegments[-id].slice().reverse()
				}

				function getJunctionsForSegment(id) {
					var segment = data.segments[Math.abs(id)];

					return [
						actuals.junctions[junctionUtils.getEndPointKey(segment[0])],
						actuals.junctions[junctionUtils.getEndPointKey(segment[segment.length - 1])]
					]
				}

				function getCutSegment(id) {
					if(!cutSegments[Math.abs(id)]) {
						var junctions = getJunctionsForSegment(id);

						cutSegments[Math.abs(id)] = geomUtils.cut(
							getTilePixelSegment(Math.abs(id)),
							junctions[0]? zoomWidthFactor * junctions[0].size : 0,
							junctions[1]? zoomWidthFactor * junctions[1].size : 0
						);
					}
					return id > 0? cutSegments[id] : cutSegments[-id].slice().reverse();
				}

				function getSegmentEnd(id) {
					var junctions = getJunctionsForSegment(id),
						segment = getTilePixelSegment(Math.abs(id)),
						length = geomUtils.getLength(segment);

					return geomUtils.cut(
						getTilePixelSegment(Math.abs(id)),
						length - (junctions[1]? zoomWidthFactor * junctions[1].size : 0),
						EPSILON
					);
				}

				function getSegmentStart(id) {
					var junctions = getJunctionsForSegment(id),
						segment = getTilePixelSegment(Math.abs(id)),
						length = geomUtils.getLength(segment);

					return geomUtils.cut(
						getTilePixelSegment(Math.abs(id)),
						EPSILON,
						length - (junctions[1]? zoomWidthFactor * junctions[1].size : 0)
					);
				}

				function getJunctionLineGeometry(fromId, toId, fromShift, toShift, size) {
					var junctionLineGeometry = junctionLineGeometries.get(fromId, toId, fromShift, fromShift, size);

					if(junctionLineGeometry) { return junctionLineGeometry; }

					junctionLineGeometry = junctionUtils.getJunctionLineGeometry(
                    	zoomWidthFactor * size,
                    	getTilePixelSegment(toId)[0],
                    	getCutSegment(-fromId),
                    	getCutSegment(toId),
                    	zoomWidthFactor * fromShift,
                    	zoomWidthFactor * toShift,
                    	tileUtils
                	);

                	junctionLineGeometries.set(fromId, toId, fromShift, fromShift, size, junctionLineGeometry);

                	return junctionLineGeometry;
				}
			});
		});
	};
});