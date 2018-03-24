define([
    'jquery',
    'vow',
    'ymaps',
    'utils/events-emitter',
    'utils/extend'
], function(
    $,
    vow,
    ymaps,
    eventsEmitter,
    extend
) {

var DEFAULT_WORKER_SCRIPT = './js/worker.js';

var script = $('script[data-main="js/app"]')[0].src,
    workerScript = /app\.min\.js/.test(script)? script.replace(/app\.min\.js/, 'worker.min.js') : DEFAULT_WORKER_SCRIPT;

var MapWorker = function(dataManager, stateManager) {
    var worker = this._worker = new Worker(workerScript),
        that = this;

    worker.addEventListener('message', this._onWorkerMessage.bind(this));
    
    this._dataManager = dataManager;
    this._stateManager = stateManager;
    this._isInited = false;
    this._isBusy = true;
    this._messageQueue = [];
    this._commandsCount = 0;
    this._cumulativeCommandsCount = 0;
};

extend(MapWorker.prototype, eventsEmitter);

extend(MapWorker.prototype, {
    _postInitMessage : function() {
        var worker = this._worker,
            dataManager = this._dataManager,
            stateManager = this._stateManager;
    
        vow.all({
            segments : dataManager.getSegments(),
            routes : dataManager.getRoutes(),
            freqs : dataManager.getFreqs(),
            trolleyWires : dataManager.getWiredSegments(),
            registry : dataManager.getRegistry()
        }).done(function(params) {
            worker.postMessage({
                command : 'init',
                params : extend(params, { state : stateManager.serialize() })
            });
        });
    },
    
    _onWorkerMessage : function(e) {
        if(e.data.progress && e.data.progress !== this._progress) {
            this._progress = e.data.progress;
            this.trigger('progress', this._progress);
        }

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
            this.trigger('message', e.data);
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
        var that = this,
            key = Math.random() + '' + +(new Date()),
            isProgressableCommand = (command == 'render-tile'),
            deferred = vow.defer(),
            resultFn = function(e, data) {
                if (data.key == key) {
                    if(that._commandsCount > 0) {
                        that._commandsCount--;
                    }
                    if(that._commandsCount == 0) {
                        that._cumulativeCommandsCount = 0;
                    }
                    that._actualizeProgress();

                    this.un('message', resultFn);
                    deferred.resolve(data.result);
                }
            };

        this._commandsCount++;
        this._cumulativeCommandsCount++;
        this._actualizeProgress();

        this.on('message', resultFn);
        this.postMessage({
            command : command,
            params : params,
            key : key
        });
                        
        return deferred.promise();
    },

    _actualizeProgress : function() {
        if(this._cumulativeCommandsCount) {
            this.trigger('progress', (this._cumulativeCommandsCount - this._commandsCount) / this._cumulativeCommandsCount);
        }
        else {
            this.trigger('ready');
        }
    }

});

return MapWorker;

});