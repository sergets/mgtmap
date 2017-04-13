define(['worker/utils/require-ymaps'], function(requireYMaps) {
    return {
        getRouteColor : function(route, data, state, actuals) {
            var totalLength = 0,
                trolleyLength = 0;

            Object.keys(data.lengths).forEach(function(segmentId) {
                if(isSegmentInRoute(segmentId, route, actuals.actualRoutes)) {
                    var times = actuals.actualRoutes[segmentId].reduce(function(t, r) {
                        if(r == route) return t + 2;
                        if(r == '>' + route || r == '<' + route) return t + 1;
                        return t; 
                    }, 0);
                    totalLength += times * data.lengths[segmentId];
                    if(isSegmentTrolleyForRoute(segmentId, route, actuals.actualRoutes, data.trolleyWires)) {
                        trolleyLength += times * data.lengths[segmentId];
                    }
                }
            });

            if(route.indexOf('Тм') != -1) {
                return '#f84';;
            }
            if(route.indexOf('Тб') != -1) {
                return '#6f0';
            }
            if(trolleyLength / totalLength > 0.5 && !data.vendors[route]) {
                return '#1bf';
            }
            return '#528';
        },
        getSegmentOutlines : function(segmentId, data, state, actuals) {
            if(state.selectedRoutes.length == 1) {
                var selectedRoute = state.selectedRoutes[0];

            return isSegmentInRoute(segmentId, selectedRoute, actuals.actualRoutes)?
                isSegmentTrolleyForRoute(segmentId, selectedRoute, actuals.actualRoutes, data.trolleyWires)?
                    { 10 : '#6f0' } : 
                    { 10 : '#999' } :
                null;
            }
        },
        shouldRecalcColorsOn : ['timeSettings'],
        shouldRecalcOutlinesOn : ['timeSettings', 'selectedRoutes']
    };
});

function isSegmentInRoute(segmentId, route, actualRoutes) {
    var routes = actualRoutes[segmentId];

    return routes &&
        (routes.indexOf('>' + route) != -1 ||
        routes.indexOf('<' + route) != -1 ||
        routes.indexOf(route) != -1);
}

function isSegmentTrolleyForRoute(segmentId, route, actualRoutes, trolleyWires) {
    segmentId = +segmentId;
    var routes = actualRoutes[segmentId],
        isSelectedRouteForward = routes && routes.indexOf('>' + route) != -1,
        isSelectedRouteBackward = routes && routes.indexOf('<' + route) != -1,
        isSelectedRouteBoth = routes && routes.indexOf(route) != -1,
        isSegmentTrolleyForward = trolleyWires.forward.indexOf(segmentId) != -1,
        isSegmentTrolleyBackward = trolleyWires.backward.indexOf(segmentId) != -1,
        isSegmentTrolleyBoth = trolleyWires.both.indexOf(segmentId) != -1;

    if(isSelectedRouteForward && isSelectedRouteBackward) {
        isSelectedRouteBoth = true;
    }
    if(isSelectedRouteBoth) {
        isSelectedRouteForward = false;
        isSelectedRouteBackward = false;
    }

    return (isSelectedRouteForward && (isSegmentTrolleyForward || isSegmentTrolleyBoth)) ||
        (isSelectedRouteBackward && (isSegmentTrolleyBackward || isSegmentTrolleyBoth)) ||
        (isSelectedRouteBoth && isSegmentTrolleyBoth);
    return res;
}