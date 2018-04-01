define([
    'utils/geom',
    'utils/route',
    'utils/junction',
    'utils/cache',
    'utils/wgs-84',
    'worker/utils/tile-utils'
], function(
    geomUtils,
    routeUtils,
    junctionUtils,
    Cache,
    projection,
    tileUtils
) {
	var EPSILON = 1e-5,
		CACHE_SIZE = 100000;

	/* Алгоритм рендеринга тайлов

	- По номеру тайла получаем набор номеров сегментов, строим мультилинии из каждого сегмента.
	- Получаем набор джанкшнов, входящих в них. Строим мультилинии для каждой ветки каждого джанкшна
	  делим их пополам, раскладываем по номерам сегментов. Мультилиния получает на вход геометрии мультилиний
	  обоих сегментов.
	- Для каждой мультилинии строим уже линии маршрутов, красим их нужными цветами и т. п. */


	var segmentMultilineCache = {},
		junctionMultilineCache = {},
		linesCacheBySegment = {},
		outlinesCacheBySegment = {}; 

	function getSegmentMultilineCache(zoom) {
		return segmentMultilineCache[zoom] || (segmentMultilineCache[zoom] = new Cache(CACHE_SIZE));
	}

	function getJunctionMultilineCache(zoom) {
		return junctionMultilineCache[zoom] || (junctionMultilineCache[zoom] = new Cache(CACHE_SIZE));
	}

	function getLinesCacheBySegment(zoom) {
		return linesCacheBySegment[zoom] || (linesCacheBySegment[zoom] = new Cache(CACHE_SIZE));
	}

	function getOutlinesCacheBySegment(zoom) {
		return outlinesCacheBySegment[zoom] || (outlinesCacheBySegment[zoom] = new Cache(CACHE_SIZE));
	}

	function getJunctionsForSegment(id) {
		var junctions = global.actuals.junctions,
			segment = global.data.segments[Math.abs(id)];

		return [
			actuals.junctions[junctionUtils.getEndPointKey(segment[0])],
			actuals.junctions[junctionUtils.getEndPointKey(segment[segment.length - 1])]
		];
	}

	function createSegmentMultiline(zoom, id) {
		var data = global.data,
			zoomWidthFactor = tileUtils.getZoomFactor(zoom),
			junctions = getJunctionsForSegment(id);

		return geomUtils.cut(
			data.segments[id].map(function(geoPoint) {
				return projection.toGlobalPixels([geoPoint[1], geoPoint[0]], zoom);
			}),
			junctions[0]? zoomWidthFactor * junctions[0].size : 0,
			junctions[1]? zoomWidthFactor * junctions[1].size : 0
		);
	}

	function getSegmentMultiline(zoom, segmentId) {
		var multiline = getSegmentMultilineCache(zoom).get(segmentId);
		
		if(!multiline) {
			getSegmentMultilineCache(zoom).set(multiline = createSegmentMultiline(zoom, segmentId));
		}

		return multiline;
	}

	function calculateJunctionBranchGeometry(zoom, fromId, toId, fromShift, toShift, size) {
		var data = global.data;
			zoomWidthFactor = tileUtils.getZoomFactor(zoom),
			toSegment = data.segments[Math.abs(toId)],
			junctionGeoPoint = toSegment[toId > 0? 0 : toSegment.length - 1],
			junctionPixelPoint = projection.toGlobalPixels([junctionGeoPoint[1], junctionGeoPoint[0]], zoom),
			fromSegmentMultiline = getSegmentMultiline(zoom, Math.abs(fromId)),
			toSegmentMultiline = getSegmentMultiline(zoom, Math.abs(toId));

		if (fromId > 0) fromSegmentMultiline = fromSegmentMultiline.slice().reverse();
		if (toId < 0) toSegmentMultiline = toSegmentMultiline.slice().reverse();

		return junctionUtils.getJunctionLineGeometry(
        	zoomWidthFactor * size,
        	junctionPixelPoint,
        	fromSegmentMultiline,
        	toSegmentMultiline,
        	zoomWidthFactor * fromShift,
        	zoomWidthFactor * toShift
    	);
	}

	function createJunctionMultilines(zoom, junctionId) {
		var actuals = global.actuals,
			junction = actuals.junctions[junctionId],
			res = [];

		junction.routeGroups.forEach(function(junctionRouteGroup) {
			var fromId = junctionRouteGroup.from,
        		toId = junctionRouteGroup.to;

			if (toId) {
        		var junctionLineGeometry = calculateJunctionBranchGeometry(zoom, fromId, toId, junctionRouteGroup.fromShift, junctionRouteGroup.toShift, junction.size),
        			junctionLineLength = geomUtils.getLength(junctionLineGeometry);

            	res.push({
            		geometry : geomUtils.cut(junctionLineGeometry, junctionLineLength / 2 + EPSILON, EPSILON),
            		routes : junctionRouteGroup.routes,
            		segment : Math.abs(toId)
            	}, {
            		geometry : geomUtils.cut(junctionLineGeometry, EPSILON, junctionLineLength / 2 + EPSILON),
            		routes : junctionRouteGroup.routes,
            		segment : Math.abs(fromId)
            	});
            }  // else {		 
            	// TODO fix strange lines like this:            		
            	/*	var tail = fromId > 0? getSegmentStart(fromId).slice() : getSegmentEnd(-fromId).slice(),
                		shiftedTail = geomUtils.offsetLine(tail, junctionRouteGroup.fromShift * zoomWidthFactor);

                	resJunctionLines.push({
                		geometry : shiftedTail,
                		routes : junctionRouteGroup.routes,
                		id : Math.abs(fromId)
                	}); */
            //}	
    	});

    	return res;
	}

	function getJunctionMultilines(zoom, junctionId) {
		var multilines = getJunctionMultilineCache(zoom).get(junctionId);
		
		if(!multilines) {
			getJunctionMultilineCache(zoom).set(multilines = createJunctionMultilines(zoom, junctionId));
		}

		return multilines;
	}

	function getJunctionIdsForSegments(segmentIds) {
		var actuals = global.actuals;

		return Object.keys(segmentIds.reduce(function(junctionSet, id) {
			var segment = global.data.segments[id],
				startJunctionKey = junctionUtils.getEndPointKey(segment[0]),
				endJunctionKey = junctionUtils.getEndPointKey(segment[segment.length - 1]);

			if (!!actuals.junctions[startJunctionKey]) junctionSet[startJunctionKey] = true;
			if (!!actuals.junctions[endJunctionKey]) junctionSet[endJunctionKey] = true;

			return junctionSet;
		}, {}));
	}

	function getSegmentIdsByTile(x, y, z) {
		return tileUtils.getSegmentIdsByTile(x, y, z, tileUtils.getZoomFactor(z) * global.actuals.maxWidth)
	}

	function getSegmentOutlineOffsets(zoom, routes) {
		var actuals = global.actuals,
			widths = actuals.widths,
			colors = actuals.colors,
			zoomWidthFactor = tileUtils.getZoomFactor(zoom),
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

	function processOutline(zoom, multiline) {
		var actuals = global.actuals,
			widths = actuals.widths,
			colors = actuals.colors,
			routes = multiline.routes,
			zoomWidthFactor = tileUtils.getZoomFactor(zoom),
			opaqueOffsetLeft = 0,
			opaqueOffsetRight = 0;

		routes.some(function(route) {
			if(routeUtils.notPhantom(route)) {
				return true;
			} else {
				opaqueOffsetLeft += (widths[routeUtils.strip(route)] || 0);
			}
		});
		opaqueOffsetLeft = opaqueOffsetLeft * zoomWidthFactor;

		routes.slice(0).reverse().some(function(route) {
			if(routeUtils.notPhantom(route)) {
				return true;
			} else {
				opaqueOffsetRight += (widths[routeUtils.strip(route)] || 0);
			}
		});
		opaqueOffsetRight = opaqueOffsetRight * zoomWidthFactor;

		var opaqueOffset = (opaqueOffsetLeft - opaqueOffsetRight) / 2,
			totalWidth = routes.reduce(function(s, route) {
				return s + (widths[routeUtils.strip(route)] || 0);
			}, 0) * zoomWidthFactor;

		return [{
			coords : geomUtils.offsetLine(multiline.geometry, opaqueOffset * zoomWidthFactor),
			width : totalWidth - opaqueOffsetLeft - opaqueOffsetRight,
			segment : multiline.segment
		}];
	}

	function processLines(zoom, multiline) {
		var actuals = global.actuals,
			segmentUnshiftedCoords = multiline.geometry,
			segmentId = multiline.segment,
			routes = multiline.routes,
			widths = actuals.widths,
			zoomWidthFactor = tileUtils.getZoomFactor(zoom),
			totalWidth = routes.reduce(function(s, route) {
				return s + (widths[routeUtils.strip(route)] || 0);
			}, 0) * zoomWidthFactor,
			curPosition = -totalWidth / 2,
			res = [];

		routes.forEach(function(route) {
			var width = widths[routeUtils.strip(route)] * zoomWidthFactor || 0;

			curPosition += width/2;

			if(routeUtils.notPhantom(route)) {	
				var resPath = geomUtils.offsetLine(segmentUnshiftedCoords, curPosition);

				res.push({
					coords: resPath,
					width: width,
					route: routeUtils.strip(route),
					arrowDirection: route[0] == '>'? 1 : route[0] == '<'? -1 : 0,
					segment: segmentId
				});
			}

			curPosition += width/2;
		});

		return res;		
	}

	function render(x, y, z, purpose) {
		var actuals = global.actuals,
			segmentIds = getSegmentIdsByTile(x, y, z),
			cache = purpose == 'hotspots'? getOutlinesCacheBySegment(z) : getLinesCacheBySegment(z),
			readySegmentIds = segmentIds.filter(function(id) { return cache.has(id); }),
			notReadySegmentIds = segmentIds.filter(function(id) { return !cache.has(id); }),
			notReadyJunctionIds = getJunctionIdsForSegments(notReadySegmentIds),
			lines = readySegmentIds.reduce(function(lines, id) {
				return lines.concat(cache.get(id));
			}, []),
			notReadyJunctionMultilines = notReadyJunctionIds.reduce(function(notReadyJunctionMultilines, id) {
				return notReadyJunctionMultilines.concat(getJunctionMultilines(z, id));
			}, []);

		notReadySegmentIds.forEach(function(id) {
			var segmentMultilines = [
					{ segment : id, geometry : getSegmentMultiline(z, id), routes : actuals.routes[id] || [] }
				].concat(notReadyJunctionMultilines.filter(function(multiline) {
					return multiline.segment == id;	
				})),
				segmentLines = segmentMultilines.reduce(function(segmentLines, multiline) {
					return segmentLines.concat(purpose === 'hotspots'? processOutline(z, multiline) : processLines(z, multiline));
				}, []);

			cache.set(id, segmentLines);
			lines.push.apply(lines, segmentLines);
		});

		return lines;
	}

	return {
		renderTile : function(x, y, z) {
			var actuals = global.actuals,
				colors = actuals.colors,
				outlineColors = actuals.outlineColors;

			return render(x, y, z).map(function(line) {
				var outlineColor = actuals.routeOutlines[line.segment];

				if (outlineColor && typeof outlineColor == 'object') { 
					outlineColor = outlineColor[routeUtils.strip(line.route)];
				}

				return {
					coords: line.coords,
					color: colors[routeUtils.strip(line.route)] || '#ccc',
					outlineColor: outlineColor,
					outlineWidth: 0,
					width: line.width,
					arrowDirection: line.arrowDirection,
					arrowGap: Math.max(30 / line.width, 10),
					data: { id: line.segment, route: line.route }
				}
			});
		},

		renderHotspots : function(x, y, z) {
			return render(x, y, z, 'hotspots').map(function(line) {
				return {
					coords : line.coords,
					color : '#000',
					data : { id : line.segment },
					width : line.width,
					dashStyle : [],
					lineCap : 'butt',
					dashOffset : 0
				};
			});
		}
	};


	/*

	var pixelSegments = global.pixelSegments = {},
		cutPixelSegments = global.cutPixelSegments = {},
		pixelLinesBySegment = global.pixelLinesBySegment = {},
		pixelLinesByRoute = global.pixelLinesByRoute = {},
		junctionLineGeometries = global.junctionLineGeometries = {};

	function savePixelLine(zoom, pixelLine) {
		var rt = routeUtils.stripRoute(pixelLine.route),
			segmentId = pixelLine.segment,
			bySegmentCache = pixelLinesBySegment[zoom] || (pixelLinesBySegment[zoom] = new Cache(CACHE_SIZE)),
			byRouteCache = pixelLinesByRoute[zoom] || (pixelLinesByRoute[zoom] = new Cache(CACHE_SIZE)),
			currentSegmentList = bySegmentCache.get(segmentId),
			currentRouteList = byRouteCache.get(rt);

		if (!currentSegmentList) {
			currentSegmentList = [];
			bySegmentCache.set(segmentId, currentSegmentList);
		}
		if (!currentRouteList) {
			currentRouteList = [];
			byRouteCache.set(rt, currentRouteList);
		}

		currentSegmentList.push(pixelLine);
		currentRouteList.push(pixelLine);
	}

	function getPixelLinesFromCache(zoom, segmentId, routes) {
		if (routes.length) {
			var byRouteCache = pixelLinesByRoute[zoom] || (pixelLinesByRoute[zoom] = new Cache(CACHE_SIZE));

			return routes.reduce(function(res, rt) {
				var routePixelLines = byRouteCache.get(rt);

				return res.concat(routePixelLines.filter(function(pixelLine) {
					return pixelLine.segment == segmentId;
				}));
			}, []);
		} else {
			var bySegmentCache = pixelLinesBySegment[zoom] || (pixelLinesBySegment[zoom] = new Cache(CACHE_SIZE));

			return bySegmentCache.get(segmentId);
		}
	}

	function getPixelSegment(zoom, id) {
		var data = global.data,
			pixelSegments = pixelSegments[zoom] || (pixelSegments[zoom] = new Cache(CACHE_SIZE));

		if(!pixelSegments.get(Math.abs(id))) {
			pixelSegments.set(Math.abs(id), data.segments[Math.abs(id)].map(function(geoPoint) {
				return projection.toGlobalPixels([geoPoint[1], geoPoint[0]], zoom);
			}));
		}
		return id > 0? pixelSegments.get(id) : pixelSegments.get(-id).slice().reverse();
	}

	function getJunctionsForSegment(id) {
		var junctions = global.actuals.junctions,
			segment = global.data.segments[Math.abs(id)];

		return [
			actuals.junctions[junctionUtils.getEndPointKey(segment[0])],
			actuals.junctions[junctionUtils.getEndPointKey(segment[segment.length - 1])]
		];
	}

	function getCutSegment(zoom, id) {
		var cutPixelSegments = cutPixelSegments[zoom] || (cutPixelSegments[zoom] = new Cache(CACHE_SIZE)),
			zoomWidthFactor = tileUtils.getZoomFactor(zoom);

		if (!cutPixelSegments.get(Math.abs(id))) {
			var junctions = getJunctionsForSegment(id);

			cutPixelSegments.set(Math.abs(id), geomUtils.cut(
				getPixelSegment(zoom, Math.abs(id)),
				junctions[0]? zoomWidthFactor * junctions[0].size : 0,
				junctions[1]? zoomWidthFactor * junctions[1].size : 0
			));
		}
		return id > 0? cutPixelSegments.get(id) : cutPixelSegments.get(-id).slice().reverse();
	}

	function getSegmentEnd(zoom, id) {
		var junctions = getJunctionsForSegment(id),
			segment = getPixelSegment(zoom, Math.abs(id)),
			length = geomUtils.getLength(segment),
			zoomWidthFactor = tileUtils.getZoomFactor(zoom);

		return geomUtils.cut(
			getPixelSegment(zoom, Math.abs(id)),
			length - (junctions[1]? zoomWidthFactor * junctions[1].size : 0),
			EPSILON
		);
	}

	function getSegmentStart(id) {
		var junctions = getJunctionsForSegment(id),
			segment = getPixelSegment(zoom, Math.abs(id)),
			length = geomUtils.getLength(segment),
			zoomWidthFactor = tileUtils.getZoomFactor(zoom);

		return geomUtils.cut(
			getTilePixelSegment(zoom, Math.abs(id)),
			EPSILON,
			length - (junctions[1]? zoomWidthFactor * junctions[1].size : 0)
		);
	}

	function getJunctionLineGeometry(zoom, fromId, toId, fromShift, toShift, size) {
		var junctionLines = junctionLineGeometries[zoom] || (junctionLineGeometries[zoom] = new Cache(CACHE_SIZE)),
			junctionLineGeometry = junctionLineGeometries.get(fromId, toId, fromShift, toShift, size),
			zoomWidthFactor = tileUtils.getZoomFactor(zoom);

		if(junctionLineGeometry) { return junctionLineGeometry; }

		junctionLineGeometry = junctionUtils.getJunctionLineGeometry(
        	zoomWidthFactor * size,
        	getPixelSegment(toId)[0],
        	getCutSegment(-fromId),
        	getCutSegment(toId),
        	zoomWidthFactor * fromShift,
        	zoomWidthFactor * toShift
    	);

    	junctionLineGeometries.set(fromId, toId, fromShift, toShift, size, junctionLineGeometry);

    	return junctionLineGeometry;
	}

	function generateMultilinesForSegments(zoom, segmentIds) {
		var segmentMultilines = [],
			junctionMultilines = [],
			doneJunctions = {};

		segmentIds.forEach(function(id) {
			segmentMultilines.push({
				coords : getCutSegment(z, id),
				routes : actuals.routes[id] || [],
				id : id,
			});

			var segment = global.data.segments[id],
				startJunctionKey = junctionUtils.getEndPointKey(segment[0]),
				endJunctionKey = junctionUtils.getEndPointKey(segment[segment.length - 1]);

			[startJunctionKey, endJunctionKey].filter(function(junctionId) {
				return !!global.actuals.junctions[junctionId] && !(junctionId in doneJunctions)
			}).forEach(function(junctionId) { 
				doneJunctions[junctionId] = true;

				var junction = actuals.junctions[junctionId];

				junction.routeGroups.forEach(function(junctionRouteGroup) {
					var fromId = junctionRouteGroup.from,
                		toId = junctionRouteGroup.to;

        			if(toId) {
                		var junctionLineGeometry = getJunctionLineGeometry(zoom, fromId, toId, junctionRouteGroup.fromShift, junctionRouteGroup.toShift, junction.size).slice(),
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
	                	
	                //}
            	})				
			});
		});

		return resSegmentLines.concat(resJunctionLines);
	}

	function multilineToLines(multiline) {

	}

	return {
		getPixelLinesForTile : function(x, y, z, routes) {
				

				


			}
		}

	}

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

					if(routeUtils.notPhantom(route)) {	
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
	};*/
});
