define([
    'data/trolley'
], function(
    trolleyUtils
) {
    return {
        getRouteColor : function(route, data, state, actuals) {
            var trolleyFraction = Math.round(trolleyUtils.getTrolleyFraction(route, actuals.lengths, actuals.actualRoutes, data.trolleyWires) * 100),
                totalLength = 0,
                trolleyLength = 0;

            Object.keys(actuals.lengths).forEach(function(segmentId) {
                if(trolleyUtils.isSegmentInRoute(segmentId, route, actuals.actualRoutes)) {
                    var times = actuals.actualRoutes[segmentId].reduce(function(t, r) {
                        if(r == route) return t + 2;
                        if(r == '>' + route || r == '<' + route) return t + 1;
                        return t;
                    }, 0);
                    totalLength += times * actuals.lengths[segmentId];
                    if(trolleyUtils.isSegmentTrolleyForRoute(segmentId, route, actuals.actualRoutes, data.trolleyWires)) {
                        trolleyLength += times * actuals.lengths[segmentId];
                    }
                }
            });

            if(route.indexOf('Тм') != -1) {
                return '#f84';
            }
            if(route.indexOf('Тб') != -1) {
                return '#4d2';
            }
//          return 'rgb(' + Math.round(34 * trolleyFraction) + ',' + Math.round(187 * trolleyFraction) + ',' + Math.round(255 * trolleyFraction) + ')';
            if(trolleyFraction >= 50 && !(data.registry[route] && (data.registry[route].class.join() == 's' || data.registry[route].express))) {
                return '#1bf';
            }
            return '#528';
        },
        getRouteOutlines : function(segmentId, route, data, state, actuals) {
            return trolleyUtils.isSegmentTrolleyForRoute(segmentId, route, actuals.actualRoutes, data.trolleyWires)? '#af5' : '#999';
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
