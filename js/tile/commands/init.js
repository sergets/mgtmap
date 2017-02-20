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
                routes : params.routes
            },
            tree = this.tree = rbush(),
            actuals = calcActuals(data.segments, data.routes, data.freqs, state);

        this.actualRoutes = actuals.actualRoutes; /* Object.keys(data.routes).reduce(function(res, segmentId) {
            var routesForSegment = data.routes[segmentId];
            res[segmentId] = routesForSegment[dateUtils.findNearestDate(Object.keys(routesForSegment), state.timeSettings.date)] || [];
            return res;
        }, {});*/
        
        this.actualWidths = actuals.actualWidths; /* Object.keys(data.freqs).reduce(function(widths, routeName) {
            var currentDay = Object.keys(freqs[routeName]).filter(function(dow) { return dow & state.timeSettings.dow; }),
                tt = data.freqs[routeName][currentDay] || {}
                //tt = data.freqs[routeName][31] || data.freqs[routeName][127] || {};
            
                widths[routeName] = Object.keys(tt).reduce(function(width, hour) {
                    if(hour >= state.timeSettings.fromHour && hour <= state.timeSettings.toHour) {
                        width += tt[hour];
                        i++;
                    }
                    return width;
                }, 0) / i;

            return widths;
        }, {});*/

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
        
        return Promise.resolve({ state : 'ready' });
    };
});
