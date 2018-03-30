define([
    'vow',
    'utils/route',
    'data/colorings/default',
    'data/colorings/type',
    'data/colorings/black',
    'data/colorings/vendor',
    'data/colorings/troll-project',
    'data/colorings/wires'
], function(
    vow,
    routeUtils,
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
            coloring.shouldRecalcOutlinesOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            });
    },

    deps : ['widths', 'routes'],

    calc : function(data, state, widths, routes) {
        var coloring = colorings[state.customColoringId || 'default'];

        return vow.resolve(Object.keys(data.segments).reduce(function(outlines, segmentId) {
            var outlinesByRoute = (routes[segmentId] || []).reduce(function(outlinesByRoute, route) {
                    var rt = routeUtils.strip(route);
                    outlinesByRoute[rt] = coloring.getRouteOutlines(+segmentId, rt, data, state, {
                        actualWidths : widths,
                        actualRoutes : routes
                    });
                    return outlinesByRoute;
                }, {}),
                hasDifferent = Object.values(outlinesByRoute).some(function(val, i, arr) { return val !== arr[0]; });

            outlines[+segmentId] = hasDifferent? outlinesByRoute : Object.values(outlinesByRoute)[0] || null;

            return outlines;
        }, {}));
    }
};

});
