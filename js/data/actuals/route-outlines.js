define([
    'vow',
    'utils/route',
    'data/colorings/katz',
    'data/colorings/now',
    'data/colorings/sobyanin'
], function(
    vow,
    routeUtils,
    katzColoring,
    nowColoring,
    sobyaninColoring
) {

var colorings = {
    katz : katzColoring,
    now : nowColoring,
    sobyanin : sobyaninColoring
};

var DEFAULT_COLORING = 'now';

return {
    shouldRecalc : function(state, updatedStateFields) {
        var coloring = colorings[state.customColoringId || DEFAULT_COLORING];

        return updatedStateFields.indexOf('customColoringId') != -1 ||
            coloring.shouldRecalcOutlinesOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            });
    },

    deps : ['widths', 'routes'],

    calc : function(data, state, widths, routes) {
        var coloring = colorings[state.customColoringId || DEFAULT_COLORING];

        return vow.resolve(Object.keys(data.segments).reduce(function(outlines, segmentId) {
            var outlinesByRoute = (routes[segmentId] || []).reduce(function(outlinesByRoute, route) {
                    var rt = routeUtils.strip(route);
                    outlinesByRoute[rt] = coloring.getRouteOutlines(+segmentId, rt, data, state, {
                        actualWidths : widths,
                        actualRoutes : routes
                    });
                    return outlinesByRoute;
                }, {}),
                firstRoute = Object.keys(outlinesByRoute)[0],
                hasDifferent = Object.keys(outlinesByRoute).some(function(route) {
                    return outlinesByRoute[route] != outlinesByRoute[firstRoute];
                });

            outlines[+segmentId] = hasDifferent? outlinesByRoute : outlinesByRoute[firstRoute] || null;

            return outlines;
        }, {}));
    }
};

});
