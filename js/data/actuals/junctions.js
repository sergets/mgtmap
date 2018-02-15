define([
    'vow',
    'utils/junction',
    'utils/route'
], function(
    vow,
    junctionUtils,
    routeUtils
) {

const MIN_JUNCTION_SIZE = 10,
    MAX_JUNCTION_SIZE = 100;

return {
    shouldRecalc : function(state, updatedStateFields) {
        return true;
    },

    deps : ['routes', 'widths'],

    calc : function(data, state, routes, widths) {
        var segments = data.segments, 
            endPoints = Object.keys(segments).reduce(function(endPoints, id) {
                var start = segments[id][0],
                    end = segments[id][segments[id].length - 1];

                (endPoints[junctionUtils.getEndPointKey(start)] || (endPoints[junctionUtils.getEndPointKey(start)] = [])).push(id);
                (endPoints[junctionUtils.getEndPointKey(end)] || (endPoints[junctionUtils.getEndPointKey(end)] = [])).push(-id);

                return endPoints;
            }, {}),
            junctionSizes = Object.keys(endPoints).reduce(function(junctionSizes, endPointKey) {
                junctionSizes[endPointKey] = Math.min(Math.max(endPoints[endPointKey].reduce(function(maxSize, segmentId) {
                    return Math.max(maxSize, (routes[Math.abs(segmentId)] || []).reduce(function(width, rt) {
                        return width + (widths[routeUtils.strip(rt)] || 0);
                    }, 0));
                }, 0), MIN_JUNCTION_SIZE), MAX_JUNCTION_SIZE);

                return junctionSizes;
            }, {}),
            junctionRouteGroups = Object.keys(endPoints).reduce(function(junctionRouteGroups, endPointKey) {
                var //endPoint = junctionUtils.getEndPointByKey(endPointKey),
                    groups = junctionUtils.extractJunctionRouteGroups(endPoints[endPointKey], routes, widths);

                groups.length && (junctionRouteGroups[endPointKey] = groups);

                return junctionRouteGroups;
            }, {})

        return vow.resolve(Object.keys(junctionRouteGroups).reduce(function(res, endPoint) {
            res[endPoint] = {
                size : junctionSizes[endPoint],
                routeGroups : junctionRouteGroups[endPoint]
            };

            return res;
        }, {}));
    }
};

});
