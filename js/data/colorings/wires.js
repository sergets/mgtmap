define(function() {
    return {
        getRouteColor : function(route, data, state, actuals) {
            if(route.indexOf('Тм') != -1) {
                return '#f84';;
            }
            if(route.indexOf('Тб') != -1) {
                return '#1bf';
            }
            return '#528';
        },
        getSegmentOutlines : function(segmentId, data, state, actuals) {
            if(data.trolleyWires.both.indexOf(segmentId) != -1) return { 10 : '#6f0' };
            if(data.trolleyWires.forward.indexOf(segmentId) != -1) return { 5 : { color : '#6f0', offset : 5 } };
            if(data.trolleyWires.backward.indexOf(segmentId) != -1) return { 5 : { color : '#6f0', offset : -5 } };
            return null;
        },
        shouldRecalcColorsOn : ['timeSettings'],
        shouldRecalcOutlinesOn : ['timeSettings']
    };
});