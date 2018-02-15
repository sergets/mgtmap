define(['vow', 'utils/route'], function(vow, routeUtils) {

return {
    shouldRecalc : function(state, updatedStateFields) {
        return true;
    },

    deps : ['widths', 'routes'],

    calc : function(data, state, widths, routes) {
        return vow.resolve(data.segments.reduce(function(prev, segment, id) {
            if(!segment.length) return;

            var width = (routes[id] || []).reduce(function(s, route) {
                return s + (widths[routeUtils.strip(route)] || 0); 
            }, 0);

            return Math.max(width, prev);
        }, 0));
    }
}

});
