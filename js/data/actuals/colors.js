define([
    'vow',
    'data/colorings/default',
    'data/colorings/type',
    'data/colorings/black',
    'data/colorings/vendor',
    'data/colorings/troll-project',
    'data/colorings/wires'
], function(
    vow,
    defaultColoring,
    typeColoring,
    blackColoring,
    vendorColoring,
    trollProjectColoring,
    wiresColoring
) {

var colorings = {
    default : defaultColoring,
    type : typeColoring,
    black : blackColoring,
    vendor : vendorColoring,
    'troll-project' : trollProjectColoring,
    wires : wiresColoring
};

return {
    shouldRecalc : function(state, updatedStateFields) {
        var coloring = colorings[state.customColoringId || 'default'];

        return updatedStateFields.indexOf('customColoringId') != -1 || 
            coloring.shouldRecalcColorsOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            })
    },

    deps : ['widths', 'routes', 'existingRoutes'],

    calc : function(data, state, widths, routes, existingRoutes) {
        var coloring = colorings[state.customColoringId || 'default'];

        return vow.resolve(existingRoutes.reduce(function(colors, routeName) {
            colors[routeName] = coloring.getRouteColor(routeName, data, state, { 
                actualWidths : widths,
                actualRoutes : routes
            });
            return colors;
        }, {}));
    }
}

});
