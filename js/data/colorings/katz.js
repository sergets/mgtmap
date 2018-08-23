define([
    'data/trolley'
], function(
    trolleyUtils
) {
    return {
        getRouteColor : function(route, data, state, actuals) {
            var trolleyFraction = Math.round(trolleyUtils.getTrolleyFraction(route, actuals.lengths, actuals.actualRoutes, data.trolleyWires) * 100);

            if(route.indexOf('Тм') != -1) {
                return '#ddd';
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
