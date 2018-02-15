define([
    'vow',
    'data/calc-actuals',
    'utils/route'
], function(
    vow,
    calcActuals,
    routeUtils
) {
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

        calcActuals(data, state, changedStateFields, this.actuals).then(
            function(actuals) {
                this.actuals = actuals;
                this.tilePixelLinesCache.drop();

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
