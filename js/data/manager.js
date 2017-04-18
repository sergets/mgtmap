define([
    'jquery',
    'ymaps',
    'utils/extend',
    'vow',
    'pretty-json-stringify',
    'utils/geom',
    'utils/date',
    'utils/events-emitter',
    'data/calc-actuals'
], function(
    $,
    ymaps,
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
        'time-settings-updated' : this._recalcActuals.bind(this, ['timeSettings']),
        'coloring-id-updated' : this._recalcActuals.bind(this, ['customColoringId']),
        'width-factor-updated' : function() {
            this.trigger('data-updated');
        }
    }, this);
    
    this._recalcActuals(Object.keys(this._stateManager.serialize()));
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

    getVendors : function() {
        return this._getDataFromFile('data/vendors.json');
    },

    getWiredSegments : function() {
        return this._getDataFromFile('data/trolley-wire.json');
    },

    getSegmentLengths : function() {
        return this.getSegments().then(function(segments) {



            //var mapElem = $('<div/>').css({ display: 'none' }).appendTo('body'),
            //    map = new ymaps.Map(mapElem[0], { center : [56, 37], zoom : 14 });

            var projection = ymaps.projection.wgs84Mercator;

            var lengths = segments.reduce(function(res, segment, id) {
                if(!segment[0][0]) return res;

                //var points = 
                //var lineStringGeometry = new ymaps.geometry.LineString(segment),
                //    geoObject = new ymaps.GeoObject({ geometry: lineStringGeometry });

                //map.geoObjects.add(geoObject);
                res[id] = geomUtils.getLength(segment.map(function(point) { 
                    return projection.toGlobalPixels(point, 20);
                }));
                return res;
            }, {});

            //mapElem.remove();
            return lengths;
        }, this);
    },

    getRouteSummaryHtml : function(route) {
        return vow.all([
            this.getFreqs(),
            this.getVendors()
        ]).spread(function(freqs, vendors) {
            var res = '';

            if(!freqs[route]) {
                res += 'Нет данных о частоте движения';
            } else {
                var stateManager = this._stateManager,
                    timeSettings = stateManager.getTimeSettings(),
                    currentDay = Object.keys(freqs[route]).filter(function(dow) { return dow & timeSettings.dow; }),
                    timetable = [];

                if(!freqs[route][currentDay]) {
                    res += 'Маршрут сегодня не ходит';
                } else {
                    for (var h = timeSettings.fromHour; h <= timeSettings.toHour; h++) {
                        timetable.push('в ' + h + ' ч — <b>' + (freqs[route][currentDay][h] || 'нет рейсов') + '</b>');
                    }
                    res += 'Частота движения (рейсов в час):<br/>' + timetable.join('<br/>');
                }
            }

            vendors[route] && (res += '<br/><br>Перевозчик: <b>' + vendors[route] + '</b>');
            return res;
        }, this);
    },

    _recalcActuals : function(changedStateFields) {
        var stateManager = this._stateManager;

        this._actualsReady = vow.all({
            freqs : this.getFreqs(),
            segments : this.getSegments(),
            routes : this.getRoutes(),
            trolleyWires : this.getWiredSegments(),
            vendors : this.getVendors(),
            lengths : this.getSegmentLengths()
        }).then(function(data) {
            return calcActuals(
                data,
                stateManager.serialize(),
                changedStateFields,
                { actualWidths : this._actualWidths, actualRoutes : this._actualRoutes, actualColors : this._actualColors }
            );
        }, this).then(function(actualData) {
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