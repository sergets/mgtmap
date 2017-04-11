define(['utils/bus-color'], function(getBusColor) {
    return {
        getRouteColor : function(route, data, state) {
            return getBusColor(route);
        },
        getSegmentOutlines : function(segmentId, data, state) {
            return null;
        }
    };
});
