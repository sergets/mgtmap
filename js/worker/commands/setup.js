define([
    'data/calc-actuals'
], function(
    calcActuals
) {
    return function(params) {
        postMessage({ state : 'busy '});

        var state = params.state,
            data = this.data,
            actuals = calcActuals(data.segments, data.routes, data.freqs, state);

        this.actualRoutes = actuals.actualRoutes;
        this.actualWidths = actuals.actualWidths;
        this.maxWidth = 0;

        this.tilePixelLinesCache.drop();
        
        this.maxWidth = data.segments.reduce(function(prev, segment, id) {
            if(!segment.length) return;

            var width = (this.actualRoutes[id] || []).reduce(function(s, route) {
                return s + (this.actualWidths[route.replace(/^[-<>]/, '')] || 0); 
            }, 0);

            return Math.max(width, prev);
        }, 0);
        
        return Promise.resolve({ state : 'ready' });
    };
});
