define([
    'jquery',
    'ymaps',
    'utils/extend',
    'vow',
    'pretty-json-stringify',
    'utils/geom',
    'utils/date',
    'data/trolley',
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
    trolleyUtils,
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

    getRegistry : function() {
        return this._getDataFromFile('data/rgam.json');
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
            this.getRegistry(),
            this.getSegmentLengths(),
            this.getWiredSegments(),
            this._actualsReady
        ]).spread(function(freqs, registry, lengths, trolleyWires) {
            var res = '',
                registryData = registry[route],
                stateManager = this._stateManager;

            registryData && (res += '<span class="subtitle">' + registryData.endpoints + '</span>');

            if(stateManager.getCustomColoringId() == 'troll-project') {
                var trolleyFraction = Math.round(trolleyUtils.getTrolleyFraction(route, lengths, this._actualRoutes, trolleyWires) * 100),
                    isExpress = registryData && registryData.express,
                    isPrivate = registryData && registryData.vendor != 'mgt',
                    type = route.indexOf('Тб') == 0? 'troll' : route.indexOf('Тм') == 0? 'tram' : 'bus'; 

                if(type == 'troll') {
                    res += 'Это троллейбусный маршрут. Троллейбус экологичен, чист и бесшумен.';
                } else if(type == 'tram') {
                    res += 'Это трамвайный маршрут. Трамвай экологичен, чист и при правильной прокладке путей практически бесшумен.';
                } else if(isExpress && trolleyFraction >= 50) {
                    res += 'Это автобус-экспресс. <b>' + trolleyFraction + '%</b> его трассы проходят под троллейбусными проводами, но чтобы он мог обгонять поостановочные троллейбусы, нужно повесить вторую пару проводов. Это будет несложно, так как питающие подстанции и кабели уже на месте.';
                } else if(isPrivate && trolleyFraction >= 50) {
                    res += 'Этот автобусный маршрут обслуживается частным перевозчиком. <b>' + trolleyFraction + '%</b> его трассы проходят под троллейбусными проводами, поэтому его можно было бы перевести на бесшумный и чистый подвижной состав прямо сейчас, но это потребует пересмотра условий контракта.';
                } else if(trolleyFraction >= 50) {
                    res += 'Этот автобусный маршрут на <b>' + trolleyFraction + '%</b> проходит под троллейбусными проводами. Грязные дизельные автобусы можно заменить на тихие экологичные троллейбусы хоть завтра, технологии это позволяют.';
                } else {
                    res += (trolleyFraction > 0? 
                        'Этот автобусный маршрут проходит под троллейбусными проводами на <b>' + trolleyFraction + '%</b>. ' :
                        'Над этим автобусным маршрутом троллейбусных проводов нет. ') + 'К сожалению, текущий уровень развития технологий электротранспорта для нашего климата не позволяет легко заменить его на тихий и экологичный троллейбус.<p>В будущем, возможно, появятся пригодные для нашего климата электробусы, которые помогут нам избавиться от выхлопов дизеля.'
                }

                if (registryData && registryData.quantity) {
                    var quantity = registryData.quantity,
                        inclination = ((quantity % 10 == 1 && quantity != 11)? 'one' : 
                            (quantity % 10 > 1 && quantity % 10 < 5 && Math.floor(quantity / 10) != 1)? 'some' :
                            'many');

                    res += '<p>Здесь работает <b>' + quantity + '</b> ' + {
                        bus : {
                            one : 'автобус',
                            some : 'автобуса',
                            many : 'автобусов'
                        },
                        troll : {
                            one : 'троллейбус',
                            some : 'троллейбуса',
                            many : 'троллейбусов'
                        },
                        tram : {
                            one : 'трамвай',
                            some : 'трамвая',
                            many : 'трамваев'
                        }
                    }[type][inclination] + '. ';
                    if(type == 'bus' && quantity) { 
                        res += 'В год ' + (quantity == 1? 'он выбасывает' : 'они выбасывают') + ' в воздух примерно <b>' + quantity * 3 + ' т</b> опасных газов (CO, оксидов серы и азота).';
                    }
                }

                return res;
            }

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

            registryData && (res += '<br/><br>Перевозчик: <b>' + registry[route].vendor + '</b>');
            return res;
        }, this);
    },

    getWholeTrollNumber : function() {
        return vow.all([
            this.getRegistry(),
            this.getSegmentLengths(),
            this.getWiredSegments(),
            this._actualsReady
        ]).spread(function(registry, lengths, trolleyWires) {
            var routesList = Object.keys(this._actualColors);

            return routesList.reduce(function(r, route) {
                return r + (route.indexOf('Тб') == 0 && registry[route]? registry[route].quantity : 0);
            }, 0);
        }, this);
    },

    getWholeBusNumber : function() {
        return vow.all([
            this.getRegistry(),
            this.getSegmentLengths(),
            this.getWiredSegments(),
            this._actualsReady
        ]).spread(function(registry, lengths, trolleyWires) {
            var routesList = Object.keys(this._actualColors);

            return routesList.reduce(function(r, route) {
                return r + (route.indexOf('Тб') == -1 && route.indexOf('Тм') == -1 && registry[route]? registry[route].quantity : 0);
            }, 0);
        }, this);
    },

    getEcoBusNumber : function() {
        return vow.all([
            this.getRegistry(),
            this.getSegmentLengths(),
            this.getWiredSegments(),
            this._actualsReady
        ]).spread(function(registry, lengths, trolleyWires) {
            var routesList = Object.keys(this._actualColors),
                that = this;

            return routesList.reduce(function(r, route) {
                var busRegistry = route.indexOf('Тб') == -1 && route.indexOf('Тм') == -1 && registry[route];

                return r + (busRegistry && 
                    trolleyUtils.getTrolleyFraction(route, lengths, that._actualRoutes, trolleyWires) >= 0.5 &&
                    busRegistry.vendor == 'mgt' &&
                    !busRegistry.express?
                        busRegistry.quantity :
                        0);
            }, 0);
        }, this);
    },

    _recalcActuals : function(changedStateFields) {
        var stateManager = this._stateManager;

        this._actualsReady = vow.all({
            freqs : this.getFreqs(),
            segments : this.getSegments(),
            routes : this.getRoutes(),
            trolleyWires : this.getWiredSegments(),
            registry : this.getRegistry(),
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