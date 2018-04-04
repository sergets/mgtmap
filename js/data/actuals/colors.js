define([
    'vow',
    'data/colorings/katz',
    'data/colorings/now',
    'data/colorings/sobyanin'
], function(
    vow,
    katzColoring,
    nowColoring,
    sobyaninColoring
) {

var colorings = {
    katz : katzColoring,
    now : nowColoring,
    sobyanin : sobyaninColoring
};

var DEFAULT_COLORING = 'katz';

return {
    shouldRecalc : function(state, updatedStateFields) {
        var coloring = colorings[state.customColoringId || DEFAULT_COLORING];

        return updatedStateFields.indexOf('customColoringId') != -1 ||
            coloring.shouldRecalcColorsOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            })
    },

    deps : ['widths', 'routes', 'existingRoutes', 'lengths'],

    calc : function(data, state, widths, routes, existingRoutes, lengths) {
        var coloring = colorings[state.customColoringId || DEFAULT_COLORING];

        return vow.resolve(existingRoutes.reduce(function(colors, routeName) {
            colors[routeName] = coloring.getRouteColor(routeName, data, state, {
                actualWidths : widths,
                actualRoutes : routes,
                lengths : lengths
            });
            return colors;
        }, {}));
    }
}

});
