define([
    'vow',
    'utils/geom',
    'utils/wgs-84'
], function(
    vow,
    geomUtils,
    projection
) {

return {
    shouldRecalc : function() {
        return false;
    },

    deps : [],

    calc : function(data) {
        return vow.resolve(data.segments.reduce(function(lengths, segment, id) {
            lengths[id] = Math.round(geomUtils.getLength(segment.map(function(point) {
                return projection.toGlobalPixels(point.slice().reverse(), 20);
            })));

            return lengths;
        }, {}));
    }
}

});
