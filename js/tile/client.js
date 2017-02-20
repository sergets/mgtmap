define([
    'vow',
    'ymaps',
    'utils/events-emitter',
    'utils/extend'
    //'tile/commands/init'
], function(
    vow,
    ymaps,
    eventsEmitter,
    extend
   //rhc
) {

    //console.log(rhc);

var MapWorker = function(dataManager, stateManager) {
    var worker = this._worker = new Worker('/js/tile/worker.js'),
        that = this;

    worker.addEventListener('message', this._onWorkerMessage.bind(this));
    
    this._dataManager = dataManager;
    this._stateManager = stateManager;
    this._isInited = false;
    this._isBusy = true;
    this._messageQueue = [];
};

extend(MapWorker.prototype, eventsEmitter);

extend(MapWorker.prototype, {
    _postInitMessage : function() {
        var worker = this._worker,
            dataManager = this._dataManager,
            stateManager = this._stateManager;
    
        vow.all({
            segments : dataManager.getSegments(),// $.getJSON('/data/segments.json'),
            routes : dataManager.getRoutes(), //$.getJSON('/data/routes.json'),
            freqs : dataManager.getFreqs() //$.getJSON('/data/freqs.json')
        }).done(function(params) {
            worker.postMessage({
                command : 'init',
                params : extend(params, { state : stateManager.serialize() })
            });
        });
    },
    
    _onWorkerMessage : function(e) {
        if (e.data.state == 'instantiated') {
            this._postInitMessage();
        } else if (e.data.state == 'busy') {
            this._isBusy = true;
        } else if (e.data.state == 'ready') {
            this._isBusy = false;
            this._isInited = true;
            this.trigger('updated');
            this._messageQueue.forEach(function(msg) {
                this.postMessage.apply(this, msg);
            }, this);
            this._messageQueue = [];
            this.trigger('updated');
        } else {
            this.trigger('message', e.data);
        }
    },

    postMessage : function() {
        if(!this._isBusy) {
            this._worker.postMessage.apply(this._worker, arguments);
        }
        else {
            this._messageQueue.push(arguments);
        }
    },

    command : function(command, params) {
        var key = Math.random() + '' + +(new Date()),
            deferred = vow.defer(),
            resultFn = function(e, data) {
                if (data.key == key) {
                    this.un('message', resultFn);
                    deferred.resolve(data.result);
                }
            };

        this.on('message', resultFn);
        this.postMessage({
            command : command,
            params : params,
            key : key
        });
                        
        return deferred.promise();
    },

    getGlobalId : function() {
        return this._globalId;
    }
});

return MapWorker;

});