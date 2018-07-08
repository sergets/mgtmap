define(['utils/bus-color'], function(getBusColor) {
    return {
        getRouteColor : function(route, data, state) {
            var isExpress = data.registry && data.registry[route] && data.registry[route].express;
            return getBusColor(route + (isExpress? 'э' : ''));
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
