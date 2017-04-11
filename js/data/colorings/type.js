define(function() {
    return {
        getRouteColor : function(route, data, state) {
            if(route.indexOf('Тм') != -1) {
                return '#e44';
            }
            if(route.indexOf('Тб') != -1) {
                return '#7c3';
            }
            return '#47c';
        },
        getSegmentOutlines : function(segmentId, data, state) {
            return null;
        }
    };
});