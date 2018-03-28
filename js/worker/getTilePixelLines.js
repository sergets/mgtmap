define([
    'utils/geom',
    'utils/route',
    'utils/junction',
    'utils/cache',
    'worker/utils/tile-utils'
], function(
    geomUtils,
    routeUtils,
    junctionUtils,
    Cache,
    tileUtils
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

			var res = [],
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
			                		shiftedTail = geomUtils.offsetLine(tail, junctionRouteGroup.fromShift * zoomWidthFactor);

			                	resJunctionLines.push({
			                		geometry : shiftedTail,
			                		routes : junctionRouteGroup.routes,
			                		id : Math.abs(fromId)
			                	}); */
		                //}
	            	})
				});
			});

			var objects = resSegmentLines.concat(resJunctionLines),
				tilePixelLines = [];

			// Generate outlines
			objects.forEach(function(object) {
				var routes = object.routes,
					id = object.id,
					totalWidth = routes.reduce(function(s, route) {
						return s + (actuals.widths[routeUtils.strip(route)] || 0);
					}, 0) * zoomWidthFactor;

				if(id && actuals.outlines[id]) {
					var actualOutlines = actuals.outlines[id];

					Object.keys(actualOutlines).forEach(function(width) {
						var outlineDescription = actualOutlines[width];
						if(!outlineDescription.color) {
							outlineDescription = { color : outlineDescription, offset : 0 };
						}
						if(!(outlineDescription.avoidEmpty && totalWidth == 0)) {
							tilePixelLines.push(generateSegmentOutline(
								object.geometry,
								routes,
								outlineDescription.offset || 0,
								outlineDescription.color,
								width,
								{ id : id }
							));
						}
					});
				}
				if(purpose == 'hotspots') {
					tilePixelLines.push(generateSegmentOutline(object.geometry, routes, 0, '#000', 0, { id : id }));
				}
			});

			// Generate route lines
			objects.forEach(function(object) {
				var segmentUnshiftedCoords = object.geometry,
					id = object.id;

				var routes = object.routes,
					widths = actuals.widths,
					colors = actuals.colors,
					totalWidth = routes.reduce(function(s, route) {
						return s + (widths[routeUtils.strip(route)] || 0);
					}, 0) * zoomWidthFactor,
					curPosition = -totalWidth / 2;

				routes.forEach(function(route) {
					var width = widths[routeUtils.strip(route)] * zoomWidthFactor || 0;

					curPosition += width/2;

					if(routeUtils.notPhantom(route) && width > 0) {	
						var resPath = geomUtils.offsetLine(segmentUnshiftedCoords, curPosition);

						tilePixelLines.push({
							coords: resPath,
							color: colors[routeUtils.strip(route)] || '#ccc',
							width: width,
							arrowDirection: route[0] == '>'? 1 : route[0] == '<'? -1 : 0,
							arrowGap: Math.max(30 / width, 10),
							data: { id: id, route: routeUtils.strip(route) }
						});
					}

					curPosition += width/2;
				});
			});

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

			function getSegmentOutlineOffsets(routes) {
				var widths = actuals.widths,
					colors = actuals.colors,
					opaqueOffsetLeft = 0;

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

				return [opaqueOffsetLeft, opaqueOffsetRight];
			}

			function generateSegmentOutline(segmentUnshiftedCoords, routes, offset, color, excessWidth, data) {
				var opaqueOffsets = getSegmentOutlineOffsets(routes),
					opaqueOffset = (opaqueOffsets[0] - opaqueOffsets[1]) / 2,
					totalWidth = routes.reduce(function(s, route) {
						return s + (actuals.widths[routeUtils.strip(route)] || 0);
					}, 0) * zoomWidthFactor;

				return {
					coords : geomUtils.offsetLine(segmentUnshiftedCoords, opaqueOffset + offset * zoomWidthFactor),
					color : color,
					data : data,
					width : totalWidth - opaqueOffsets[0] - opaqueOffsets[1] + 2 * excessWidth * zoomWidthFactor,
					dashStyle : [],
					lineCap : 'butt',
					dashOffset : 0
				};
			}
		});
	};
});
