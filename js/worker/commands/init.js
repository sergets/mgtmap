define([
    'utils/geom',
    'utils/date',
    'utils/route',
    'utils/cache',
    'utils/file',
    'data/calc-actuals',
    'flatbush',
    'vow'
], function(
    geomUtils,
    dateUtils,
    routeUtils,
    Cache,
    fileUtils,
    calcActuals,
    flatbush,
    vow
) {
    var CACHE_SIZE = 400,
        BASE_ACTUALS_URL = '//sergets.github.io/mgtmap-gp1/actuals/';

    return function(params) {
        var deferred = vow.defer(),
            state = this.state = params.state,
            segments = params.segments,
            data = this.data = {
                segments : segments,
                freqs : params.freqs,
                routes : params.routes,
                registry : params.registry,
                trolleyWires : params.trolleyWires
            },
            tree = this.tree = flatbush(segments.length),
            progress = 0;

        segments.forEach(function(segment, i) {
            var bounds = geomUtils.bounds(segment);
            deferred.notify(i / segments.length * 0.5);
            tree.add(bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]);
        });
        tree.finish();

        fetch(BASE_ACTUALS_URL + fileUtils.getActualsFileNameByState(state, data.routes) + '.json').then(function(res) {
            if(res.status != 200) {
                throw new Error;
            }
            return res.json();
        }).catch(function(err) {
            return calcActuals(data, state, Object.keys(state), {});
        }).then(
            function(actuals) {
                this.actuals = actuals;
                this.tilePixelLinesCache = new Cache(CACHE_SIZE);
            },
            function(err) {
                throw err;
            },
            function(progress) {
                deferred.notify(0.5 + progress / 2);
            },
            this
        ).then(function() {
            deferred.resolve({ state : 'ready' });
        });

        return deferred.promise();
    };
});
