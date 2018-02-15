define([
    'vow',
    'utils/route'
], function(
    vow,
    routeUtils
) {

return {
    shouldRecalc : function(state, updatedStateFields) {
        return updatedStateFields.indexOf('timeSettings') != -1;
    },

    deps : ['routes'],

    calc : function(data, state, routesBySegment) {
        return vow.resolve(Object.keys(Object.keys(routesBySegment).reduce(function(res, segmentId) {
            routesBySegment[segmentId].forEach(function(route) {
                res[routeUtils.strip(route)] = true
            });
            return res;
        }, {})));
    }
}

});
