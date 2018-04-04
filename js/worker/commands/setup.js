define([
    'vow',
    'data/calc-actuals',
    'utils/route',
    'utils/file',
    'worker/renderer/renderer'
], function(
    vow,
    calcActuals,
    routeUtils,
    fileUtils,
    renderer
) {
    var BASE_ACTUALS_URL = '//sergets.github.io/mgtmap-gp/actuals/';

    return function(params, key) {
        postMessage({ state : 'busy', progress : 0 });

        var deferred = vow.defer(),
            state = params.state,
            oldState = this.state,
            data = this.data,
            changedStateFields = Object.keys(state).reduce(function(changeds, propId) {
                if(JSON.stringify(oldState[propId]) != JSON.stringify(state[propId])) {
                    changeds.push(propId);
                }
                return changeds;
            }, []);

        this.state = state;

        fetch(BASE_ACTUALS_URL + fileUtils.getActualsFileNameByState(state, data.routes) + '.json').then(function(res) {
            if(res.status != 200) {
                throw new Error;
            }
            return res.json();
        }).catch(function(err) {
            return calcActuals(data, state, changedStateFields, this.actuals);
        }).then(
            function(actuals) {
                this.actuals = actuals;
                renderer.dropCaches();

                deferred.resolve({ state : 'ready', key : key });
            }, function(err) {
                throw err;
            }, function(progress) {
                deferred.notify(progress);
            },
            this
        );

        return deferred.promise();
    };
});
