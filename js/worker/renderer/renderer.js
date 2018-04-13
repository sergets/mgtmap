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
            getSegmentMultilineCache(zoom).set(segmentId, multiline = createSegmentMultiline(zoom, segmentId));
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
                /*  var tail = fromId > 0? getSegmentStart(fromId).slice() : getSegmentEnd(-fromId).slice(),
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
            getJunctionMultilineCache(zoom).set(junctionId, multilines = createJunctionMultilines(zoom, junctionId));
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
        },

        dropCaches : function() {
            segmentMultilineCache = {};
            segmentMultilineCache = {};
            junctionMultilineCache = {};
            linesCacheBySegment = {};
            outlinesCacheBySegment = {};
        }
    };
});
