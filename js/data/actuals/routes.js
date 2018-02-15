define([
    'vow',
	'utils/date'
], function(
    vow,
	dateUtils
) {

return {
    shouldRecalc : function(state, updatedStateFields) {
        return updatedStateFields.indexOf('timeSettings') != -1;
    },

    calc : function(data, state) {
        return vow.resolve(Object.keys(data.routes).reduce(function(res, segmentId) {
            var routesForSegment = data.routes[segmentId] || [];
            res[segmentId] = routesForSegment[dateUtils.findNearestDate(Object.keys(routesForSegment), state.timeSettings.date)] || [];
            return res;
        }, {}));
    }
};

});
