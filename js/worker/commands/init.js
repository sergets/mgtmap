define([
    'utils/geom',
    'utils/date',
    'utils/route',
    'utils/cache',
    'data/calc-actuals',
    'rbush',
    'vow'
], function(
    geomUtils,
    dateUtils,
    routeUtils,
    Cache,
    calcActuals,
    rbush,
    vow
) {
    var CACHE_SIZE = 400;

    return function(params) {
        var deferred = vow.defer(),
            state = this.state = params.state,
            data = this.data = {
                segments : params.segments,
                freqs : params.freqs,
                routes : params.routes,
                registry : params.registry,
                trolleyWires : params.trolleyWires,
                lengths : params.lengths
            },
            tree = this.tree = rbush(),
            progress = 0;

        calcActuals(data, state, Object.keys(state), {}).then(
            function(actuals) {
                this.actuals = actuals;
                this.tilePixelLinesCache = new Cache(CACHE_SIZE);
                
                var items = data.segments.map(function(segment, id) {
                    if(!segment.length) return;

                    var bounds = geomUtils.bounds(segment),
                        item = {
                            minX : bounds[0][0],
                            minY : bounds[0][1],
                            maxX : bounds[1][0],
                            maxY : bounds[1][1],
                            id : id
                        };
                    deferred.notify(0.5 + (id / data.segments.length * 0.4));
                    return item;
                }).slice(1);
                tree.load(items);
            },
            function(err) {
                throw err;
            },
            function(progress) {
                deferred.notify(progress / 2);
            },
            this
        ).then(function() {
            deferred.resolve({ state : 'ready' });
        });

        return deferred.promise();
    };
});
