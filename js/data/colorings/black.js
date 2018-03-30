define(function() {
    return {
        getRouteColor : function(route, data, state) {
            return '#000';
        },
        getSegmentOutlines : function(segmentId, data, state) {
            return null;
        },
        getRouteOutlines : function(segmentId, route, data, state) {
            return null;
        },
        shouldRecalcColorsOn : ['timeSettings'],
        shouldRecalcOutlinesOn : []
    };
});