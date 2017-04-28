define([
    'vow',
    'data/colorings/now',
    'data/colorings/sobyanin',
    'data/colorings/katz'
], function(
    vow,
    nowColoring,
    sobyaninColoring,
    katzColoring
) {

var colorings = {
    now : nowColoring,
    sobyanin : sobyaninColoring,
    katz : katzColoring
};

return {
    shouldRecalc : function(state, updatedStateFields) {
        var coloring = colorings[state.customColoringId || 'now'];

        return updatedStateFields.indexOf('customColoringId') != -1 || 
            coloring.shouldRecalcOutlinesOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            });
    },

    deps : ['widths', 'routes'],

    calc : function(data, state, widths, routes) {
        var coloring = colorings[state.customColoringId || 'now'];

        return vow.resolve(Object.keys(data.segments).reduce(function(outlines, segmentId) {
            outlines[+segmentId] = coloring.getSegmentOutlines(+segmentId, data, state, {
                widths : widths,
                routes : routes
            });
            return outlines;
        }, {}));
    }
}

});
