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
            coloring.shouldRecalcOutlinesOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            });
    },

    deps : ['widths', 'routes'],

    calc : function(data, state, widths, routes) {
        var coloring = colorings[state.customColoringId || 'default'];

        return vow.resolve(Object.keys(data.segments).reduce(function(outlines, segmentId) {
            outlines[+segmentId] = coloring.getSegmentOutlines(+segmentId, data, state, {
                actualWidths : widths,
                actualRoutes : routes
            });
            return outlines;
        }, {}));
    }
}

});
