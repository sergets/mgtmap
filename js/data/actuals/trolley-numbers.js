define([
    'vow',
    'data/trolley'
], function(
    vow,
    trolleyUtils
) {

var ELECTROBUS_ROUTES = ['Тб 36', 'Тб 42', 'Тб 73', 'Тб 76', 'Тб 80', 'Тб 83', 'Т25', 'Т88', '31', '33', '53', '649', '705', '778'];


return {
    shouldRecalc : function(state, updatedStateFields) {
        return updatedStateFields.indexOf('timeSettings') != -1;
    },

    deps : ['existingRoutes', 'lengths', 'routes'],

    calc : function(data, state, existingRoutes, lengths, routes) {
        var registry = data.registry,
            trolleyWires = data.trolleyWires,
            trolleyFractions = existingRoutes.reduce(function(trolleyFractions, route) {
                if (route.indexOf('Тб') == -1 && route.indexOf('Тм') == -1) {
                    trolleyFractions[route] = trolleyUtils.getTrolleyFraction(route, lengths, routes, trolleyWires);
                }
                return trolleyFractions;
            }, {});

        return vow.all({
            fractions: trolleyFractions,

            trolls: existingRoutes.reduce(function(r, route) {
                return r + (route.indexOf('Тб') == 0 && registry[route]? registry[route].quantity : 0);
            }, 0),

            buses: existingRoutes.reduce(function(r, route) {
                return r + (route.indexOf('Тб') == -1 && route.indexOf('Тм') == -1 && registry[route]? registry[route].quantity : 0);
            }, 0),

            ecoBuses: existingRoutes.reduce(function(r, route) {
                var busRegistry = route.indexOf('Тб') == -1 && route.indexOf('Тм') == -1 && registry[route];

                return r + (busRegistry &&
                    trolleyFractions[route] >= 0.5 &&
                    busRegistry.class.join() != 's' &&
                    !busRegistry.express?
                        busRegistry.quantity :
                        0);
            }, 0),

            fullTrolls: existingRoutes.reduce(function(r, route) {
                var busRegistry = route.indexOf('Тб') == -1 && route.indexOf('Тм') == -1 && registry[route];

                return r + (busRegistry &&
                    trolleyFractions[route] == 1 &&
                    busRegistry.class.join() != 's' &&
                    !busRegistry.express?
                        busRegistry.quantity :
                        0);
            }, 0),

            sobyaninElectrobuses: ELECTROBUS_ROUTES.reduce(function(res, rt) {
                return res + registry[rt].quantity;
            }, 0)
        });
    }
};

});
