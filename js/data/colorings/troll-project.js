define([
    'data/trolley'
], function(
    trolleyUtils
) {
    return {
        getRouteColor : function(route, data, state, actuals) {
            var trolleyFraction = trolleyUtils.getTrolleyFraction(route, data.lengths, actuals.actualRoutes, data.trolleyWires);

            /*var totalLength = 0,
                trolleyLength = 0;

            Object.keys(data.lengths).forEach(function(segmentId) {
                if(trolleyUtils.isSegmentInRoute(segmentId, route, actuals.actualRoutes)) {
                    var times = actuals.actualRoutes[segmentId].reduce(function(t, r) {
                        if(r == route) return t + 2;
                        if(r == '>' + route || r == '<' + route) return t + 1;
                        return t; 
                    }, 0);
                    totalLength += times * data.lengths[segmentId];
                    if(trolleyUtils.isSegmentTrolleyForRoute(segmentId, route, actuals.actualRoutes, data.trolleyWires)) {
                        trolleyLength += times * data.lengths[segmentId];
                    }
                }
            });*/

            if(route.indexOf('Тм') != -1) {
                return '#f84';;
            }
            if(route.indexOf('Тб') != -1) {
                return '#4d2';
            }
            if(trolleyFraction > 0.5 && !(data.registry[route] && (data.registry[route].vendor != 'mgt' || data.registry[route].express))) {
                return '#1bf';
            }
            return '#528';
        },
        getSegmentOutlines : function(segmentId, data, state, actuals) {
            if(state.selectedRoutes.length == 1) {
                var selectedRoute = state.selectedRoutes[0];

            return trolleyUtils.isSegmentInRoute(segmentId, selectedRoute, actuals.actualRoutes)?
                trolleyUtils.isSegmentTrolleyForRoute(segmentId, selectedRoute, actuals.actualRoutes, data.trolleyWires)?
                    { 10 : { color : '#af5', avoidEmpty : true } } : 
                    { 10 : { color : '#999', avoidEmpty : true } } :
                null;
            }
        },
        shouldRecalcColorsOn : ['timeSettings'],
        shouldRecalcOutlinesOn : ['timeSettings', 'selectedRoutes']
    };
});

/*function isSegmentInRoute(segmentId, route, actualRoutes) {
    var routes = actualRoutes[segmentId];

    return routes &&
        (routes.indexOf('>' + route) != -1 ||
        routes.indexOf('<' + route) != -1 ||
        routes.indexOf(route) != -1);
}*/

/*function isSegmentTrolleyForRoute(segmentId, route, actualRoutes, trolleyWires) {
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
}*/