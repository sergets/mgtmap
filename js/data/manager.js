define([
    'jquery',
    'utils/extend',
    'vow',
    'pretty-json-stringify',
    'utils/geom',
    'utils/date',
    'utils/events-emitter',
    'data/calc-actuals'
], function(
    $,
    extend,
    vow,
    prettyJSONStringify,
    geomUtils,
    dateUtils,
    eventEmitter,
    calcActuals
) {

var DEFAULT_WIDTH = 2,
    NO_DATA_WIDTH = 0,
    SELECTED_ROUTE_WIDTH = 20;

var DataManager = function(stateManager) {
    this._stateManager = stateManager;
    
    this._data = {};
    this._loadingPromises = {};

    this._actualWidths = {};
    this._actualRoutes = {};
    this._actualColors = {};

    this._actualsReady = true;

    this._changedFiles = {};
    this._saveWindows = {};
    
    this._stateManager.on({
        'time-settings-updated' : this._recalcActuals,
        'coloring-id-updated' : this._recalcActuals,
        'width-factor-updated' : function() {
            this.trigger('data-updated');
        }
    }, this);
    
    this._recalcActuals();
};

extend(DataManager.prototype, eventEmitter);

extend(DataManager.prototype, {
    _getDataFromFile : function(fileName) {
        if (fileName in this._data) {
            return vow.resolve(this._data[fileName]);
        }
        if (fileName in this._loadingPromises) {
            return vow.resolve(this._loadingPromises[fileName]);
        }
        
        var deferred = vow.defer(),
            promise = deferred.promise();
        
        $.ajax({
            url : fileName,
            data : {
                ncrnd : Math.random()
            },
            success : function(res) {
                this._data[fileName] = res;
                deferred.resolve(res);
            },
            dataType : 'json',
            error : function(req, st, e) {
                alert('error on ' + fileName + ': ' + e.message);
                deferred.reject(e);
            },
            context : this
        });
        
        
        this._loadingPromises[fileName] = promise;
        return promise;
    },
    
    getSegments : function() {
        return this._getDataFromFile('data/segments.json');
    },
    
    setSegmentGeometry : function(segmentId, geometry) {
        return vow.all([this.getSegments(), this.getSegmentBounds()]).done(function() {
            this._data['data/segments.json'][segmentId] = geometry;
            this._bounds[segmentId] = geomUtils.bounds(geometry);
            this._changedFiles['data/segments.json'] = true;
            this.trigger('data-updated');
        }, this);
    },
    
    getSegmentCount : function() {
        return this.getSegments().then(function(segments) {
            return segments.length;
        }, this);
    },

    getRoutes : function() {
        return this._getDataFromFile('data/routes.json');
    },

    getRoutesForSegment : function(segmentId) {
        return this._getDataFromFile('data/routes.json').then(function(routesBySegment) {
            return routesBySegment[segmentId] || {};
        });
    },
    
    setRoutesForSegment : function(segmentId, data) {
        return this.getRoutesForSegment(segmentId).then(function() {
            this._data['data/routes.json'][segmentId] = data;
            this._changedFiles['data/routes.json'] = true;
            this.trigger('data-updated');
        }, this);
    },

    getActualRoutesForSegment : function(segmentId) {
        return vow.when(this._actualsReady).then(function() {
            return this._actualRoutes[segmentId];
        }, this);
    },
    
    getFreqs : function() {
        return this._getDataFromFile('data/freqs.json');
    },
    
    getActualWidthForRoute : function(route) {
        return vow.when(this._actualsReady).then(function() {
            return this._actualWidths[segmentId];
        }, this);
    },  

    getBusColor : function(route) {
        return vow.when(this._actualsReady).then(function() {
            return this._actualColors[route] || '#ccc';
        }, this);
    },

    _recalcActuals : function() {
        var stateManager = this._stateManager;

        this._actualsReady = vow.all({
            freqs : this.getFreqs(),
            segments : this.getSegments(),
            routes : this.getRoutes()
        }).then(function(data) {
            var actualData = calcActuals(data, stateManager.serialize());

            this._actualWidths = actualData.actualWidths;
            this._actualRoutes = actualData.actualRoutes;
            this._actualColors = actualData.actualColors;
            this._actualsReady = true;
            this.trigger('data-updated');
        }, this);
    },

    saveChangedFiles : function() {
        Object.keys(this._changedFiles).forEach(function(fileName) {
            var saveWindows = this._saveWindows;
            if(!saveWindows[fileName]) {
                saveWindows[fileName] = window.open('about:blank');
                saveWindows[fileName].onunload = function() { delete saveWindows[fileName]; return true; };
            }
            saveWindows[fileName].document.documentElement.innerHTML = '<pre>' + prettyJSONStringify(this._data[fileName], { 
                shouldExpand : function(obj, level) {
                    return level < 2;
                }
            }) + '</pre>';
            saveWindows[fileName].document.title = fileName;
        }, this);
    }
});

return DataManager;

});