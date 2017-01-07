define([
    'jquery',
    'vow',
    'pretty-json-stringify',
    'utils/geom',
    'utils/date',
    'utils/events-emitter'
], function(
    $,
    vow,
    prettyJSONStringify,
    geomUtils,
    dateUtils,
    eventEmitter
) {

var DEFAULT_WIDTH = 2,
    SELECTED_ROUTE_WIDTH = 20;

var DataManager = function(stateManager) {
    this._stateManager = stateManager;
    
    this._data = {};
    this._loadingPromises = {};
    this._bounds = {};
    this._boundsReady = false;
    this._widths = {};
    this._widthsReady = true;
    this._changedFiles = {};
    this._saveWindows = {};
    
    this._stateManager.on({
        'time-settings-updated' : this._recalcWidths,
        'width-factor-updated' : function() {
            this.trigger('widths-updated');
        }
    }, this);
    
    this._recalcWidths();
    this._recalcBounds();
};

$.extend(DataManager.prototype, eventEmitter);

$.extend(DataManager.prototype, {
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

    _recalcBounds : function() {
        this._boundsReady = this.getSegments().then(function(segmentsData) {
            this._bounds = segmentsData.map(geomUtils.bounds);
            this._boundsReady = true;
        }, this);
    },
    
    getSegmentBounds : function() {
        return vow.when(this._boundsReady).then(function() {
            return this._bounds;
        }, this);
    },
    
    getSegments : function() {
        return this._getDataFromFile('data/segments.json');
    },
    
    setSegmentGeometry : function(segmentId, geometry) {
        return vow.all([this.getSegments(), this.getSegmentBounds()]).done(function() {
            this._data['data/segments.json'][segmentId] = geometry;
            this._bounds[segmentId] = geomUtils.bounds(geometry);
            this._changedFiles['data/segments.json'] = true;
            this.trigger('segments-updated');
        }, this);
    },
    
    getSegmentCount : function() {
        return this.getSegments().then(function(segments) {
            return segments.length;
        }, this);
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
            this.trigger('routes-updated');
        }, this);
    },

    getActualRoutesForSegment : function(segmentId) {
        return this.getRoutesForSegment(segmentId).then(function(routesForSegment) {
            return routesForSegment[dateUtils.findNearestDate(Object.keys(routesForSegment), this._stateManager.getTimeSettings().date)] || [];
        }, this);
    },
    
    getFreqs : function() {
        return this._getDataFromFile('data/freqs.json');
    },
    
    getActualWidthForRoute : function(route) {
        var isEqualWidthsMode = this._stateManager.isEqualWidthsMode(),
            selectedRoute = this._stateManager.getSelectedRoute(),
            widthFactor = this._stateManager.getWidthFactor();

        if (selectedRoute) {
            return vow.resolve(route == selectedRoute? SELECTED_ROUTE_WIDTH : 0);
        } else if (isEqualWidthsMode) {
            return vow.resolve(DEFAULT_WIDTH * widthFactor);
        } else {    
            return vow.when(this._widthsReady).then(function() {
                var width = (route in this._widths)? this._widths[route] : DEFAULT_WIDTH;
            
                return widthFactor * width;
            }, this);
        }
    },  

    _recalcWidths : function() {
        var stateManager = this._stateManager,
            time = stateManager.getTimeSettings();
            
        if (stateManager.isEqualWidthsMode()) {
            this._widths = {};
            this._widthsReady = true;
            this.trigger('widths-updated');
        } else {        
            this._widthsReady = this.getFreqs()
                .then(function(freqs) {
                    this._widths = Object.keys(freqs).reduce(function(widths, routeName) {
                        var currentDay = Object.keys(freqs[routeName]).filter(function(dow) { return dow & time.dow; }),
                            tt = freqs[routeName][currentDay] || {},
                            i = 0;

                        widths[routeName] = Object.keys(tt).reduce(function(width, hour) {
                            if(hour >= time.fromHour && hour <= time.toHour) {
                                width += tt[hour];
                                i++;
                            }
                            return width;
                        }, 0) / i;

                        return widths;
                    }, {});
                }, this)
                .then(function() {
                    this._widthsReady = true;
                    this.trigger('widths-updated');
                }, this);
        }
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