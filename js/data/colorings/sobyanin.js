define(['data/trolley'], function(trolleyUtils) {
    return {
        getRouteColor : function(route, data, state) {
            if(route.indexOf('Тм') != -1) {
                return '#f84';
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
                    { 10 : '#af5' } :
                    { 10 : '#999' } :
                null;
            }
        },
        shouldRecalcColorsOn : ['timeSettings'],
        shouldRecalcOutlinesOn : ['timeSettings', 'selectedRoutes']
    };
});