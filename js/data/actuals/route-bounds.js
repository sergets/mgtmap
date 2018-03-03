define([
    'vow',
    'utils/route',
    'utils/geom'
], function(
    vow,
    routeUtils,
    geomUtils
) {

return {
    shouldRecalc : function(state, updatedStateFields) {
        return updatedStateFields.indexOf('timeSettings') != -1;
    },

    deps : ['routes'],

    calc : function(data, state, routesBySegment) {
        return vow.resolve(data.segments.reduce(function(res, segment, segmentId) {
            (routesBySegment[segmentId] || []).forEach(function(route) {
                var curBounds = geomUtils.bounds(data.segments[segmentId])
                    routeBounds = res[routeUtils.strip(route)];

                if (!routeBounds) {
                    res[routeUtils.strip(route)] = curBounds;
                } else {
                    res[routeUtils.strip(route)] = [
                        [ Math.min(curBounds[0][0], routeBounds[0][0]), Math.min(curBounds[0][1], routeBounds[0][1]) ],
                        [ Math.max(curBounds[1][0], routeBounds[1][0]), Math.max(curBounds[1][1], routeBounds[1][1]) ]
                    ];
                }
            });
            return res;
        }, {}));
    }
}

});
