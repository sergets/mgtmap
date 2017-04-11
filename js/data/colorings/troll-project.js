define(function() {
    return {
        getRouteColor : function(route, data, state, actuals) {
            if(route.indexOf('Тм') != -1) {
                return '#f84';;
            }
            if(route.indexOf('Тб') != -1) {
                return '#6f0';
            }
            return '#528';
        },
        getSegmentOutlines : function(segmentId, data, state, actuals) {
            if(state.selectedRoutes.length == 1) {
                var selectedRoute = state.selectedRoutes[0],
                    routes = actuals.actualRoutes[segmentId],
                    isSelectedRouteForward = routes && routes.indexOf('>' + selectedRoute) != -1,
                    isSelectedRouteBackward = routes && routes.indexOf('<' + selectedRoute) != -1,
                    isSelectedRouteBoth = routes && routes.indexOf(selectedRoute) != -1,
                    isSegmentTrolleyForward = data.trolleyWires.forward.indexOf(segmentId) != -1,
                    isSegmentTrolleyBackward = data.trolleyWires.backward.indexOf(segmentId) != -1,
                    isSegmentTrolleyBoth = data.trolleyWires.both.indexOf(segmentId) != -1,
                    isSegmentInRoute = isSelectedRouteForward || isSelectedRouteBackward || isSelectedRouteBoth

                    isTrolley = isSegmentInRoute && 
                        (isSelectedRouteForward && (isSegmentTrolleyForward || isSegmentTrolleyBoth)) ||
                        (isSelectedRouteBackward && (isSegmentTrolleyBackward || isSegmentTrolleyBoth)) ||
                        (isSelectedRouteBoth && isSegmentTrolleyBoth);

                return isSegmentInRoute?
                    isTrolley? 
                        { 10 : '#1bf' } : 
                        { 10 : '#999' } :
                    null;
            }
            return null;
        }
    };
});