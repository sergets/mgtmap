define([
    'utils/geom',
    'utils/date',
    'utils/cache',
    'data/calc-actuals',
    'rbush'
], function(
    geomUtils,
    dateUtils,
    Cache,
    calcActuals,
    rbush
) {
    var CACHE_SIZE = 100;

    return function(params) {
        var state = this.state = params.state;

        var data = this.data = {
                segments : params.segments,
                freqs : params.freqs,
                routes : params.routes,
                registry : params.registry,
                trolleyWires : params.trolleyWires,
                lengths : params.lengths
            },
            tree = this.tree = rbush();

        return calcActuals(data, state, Object.keys(state), {}).then(function(actuals) {
            this.actualRoutes = actuals.actualRoutes;
            this.actualWidths = actuals.actualWidths;
            this.actualColors = actuals.actualColors;
            this.actualSegmentOutlines = actuals.actualSegmentOutlines;

            this.maxWidth = 0;

            this.tilePixelLinesCache = new Cache(CACHE_SIZE);
            
            var items = data.segments.map(function(segment, id) {
                if(!segment.length) return;

                var width = (this.actualRoutes[id] || []).reduce(function(s, route) {
                    return s + (this.actualWidths[route.replace(/^[-<>]/, '')] || 0); 
                }, 0);

                if(width > this.maxWidth) { maxWidth = width; }

                var bounds = geomUtils.bounds(segment),
                    item = {
                        minX : bounds[0][0],
                        minY : bounds[0][1],
                        maxX : bounds[1][0],
                        maxY : bounds[1][1],
                        id : id
                    };
                return item;
            }).slice(1);
            tree.load(items);
        }, this).then(function() {
            return { state : 'ready' };
        });
    };
});
