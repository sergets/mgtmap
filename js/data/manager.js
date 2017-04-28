define([
    'jquery',
    'ymaps',
    'utils/extend',
    'vow',
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
    geomUtils,
    dateUtils,
    trolleyUtils,
    eventEmitter,
    calcActuals
) {

var DEFAULT_WIDTH = 2,
    NO_DATA_WIDTH = 0,
    SELECTED_ROUTE_WIDTH = 15,
    BASE_DATA_URL = '//sergets.github.io/mgtmap/data/',
    VENDOR_NAMES = {
        'mgt' : 'ГУП «Мосгортранс»',
        'mgt-express' : 'ГУП «Мосгортранс»',
        'autoline' : 'ООО «Трансавтолиз»',
        'tmp20' : 'ООО «Таксомоторный парк №20»',
        'alphagrant' : 'ООО «Альфа Грант»',
        'rico' : 'ООО Транспортная компания «Рико»',
        'gepart' : 'ООО «Гепарт»',
        'gortaxi' : 'ООО «ГорТакси»',
        'autocars' : 'ООО «Авто-Карз»',
        'transway' : 'ООО «Транс-Вей»'
    }

var DataManager = function(stateManager) {
    this._stateManager = stateManager;

    this._data = {};
    this._loadingPromises = {};

    this._actuals = {};
    this._actualsReady = false;
    this._actualsDeferred = vow.defer();

    this._changedFiles = {};
    this._saveWindows = {};

    this._stateManager.on({
        'state-updated' : this._dropActuals.bind(this),
        /*'time-settings-updated' : this._dropActuals.bind(this),
        'coloring-id-updated' : this._dropActuals.bind(this),
        'width-factor-updated' : function() {
            this.trigger('data-updated');
        }*/
    }, this);
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
            url : BASE_DATA_URL + fileName,
            data : {
            //    ncrnd : Math.random()
            },
            success : function(res) {
                this._data[fileName] = res;
                deferred.resolve(res);
            },
            dataType : 'json',
            error : function(req, st, e) {
                console.warn('Data loading error on ' + fileName + ': ' + e.message);
                deferred.reject(e);
            },
            context : this
        });


        this._loadingPromises[fileName] = promise;
        return promise;
    },

    getSegments : function() {
        return this._getDataFromFile('segments.json');
    },

    setSegmentGeometry : function(segmentId, geometry) {
        return vow.all([this.getSegments(), this.getSegmentBounds()]).done(function() {
            this._data['segments.json'][segmentId] = geometry;
            this._bounds[segmentId] = geomUtils.bounds(geometry);
            this._changedFiles['segments.json'] = true;
            this.trigger('data-updated');
        }, this);
    },

    getSegmentCount : function() {
        return this.getSegments().then(function(segments) {
            return segments.length;
        }, this);
    },

    getRoutes : function() {
        return this._getDataFromFile('routes.json');
    },

    getLastDate : function() {
        return this.getRoutes().then(function(routes) {
            var dates = Object.keys(Object.keys(routes).reduce(
                function(res, segmentId) {
                    Object.keys(routes[segmentId]).forEach(function(date) { res[date] = true; });
                    return res
                },
                {}
            )).sort();

            return dates[dates.length - 1];
        })
    },

    getRoutesForSegment : function(segmentId) {
        return this.getRoutes().then(function(routesBySegment) {
            return routesBySegment[segmentId] || {};
        });
    },

    setRoutesForSegment : function(segmentId, data) {
        return this.getRoutesForSegment(segmentId).then(function() {
            this._data['routes.json'][segmentId] = data;
            this._changedFiles['routes.json'] = true;
            this.trigger('data-updated');
        }, this);
    },

    getActualRoutesForSegment : function(segmentId) {
        return vow.when(this._actualsDeferred.promise()).then(function(actuals) {
            return actuals.routes[segmentId];
        }, this);
    },

    getFreqs : function() {
        return this._getDataFromFile('freqs.json');
    },

    getActualWidthForRoute : function(route) {
        return vow.when(this._actualsDeferred.promise()).then(function(actuals) {
            return actuals.widths[route];
        }, this);
    },

    getBusColor : function(route) {
        return vow.when(this._actualsDeferred.promise()).then(function(actuals) {
            return actuals.colors[route] || '#ccc';
        }, this);
    },

    getRegistry : function() {
        return this._getDataFromFile('rgam.json');
    },

    getWiredSegments : function() {
        return this._getDataFromFile('trolley-wire.json');
    },

    getSegmentLengths : function() {
        return this.getSegments().then(function(segments) {
            var projection = ymaps.projection.wgs84Mercator;

            var lengths = segments.reduce(function(res, segment, id) {
                if(!segment[0][0]) return res;

                res[id] = geomUtils.getLength(segment.map(function(point) {
                    return projection.toGlobalPixels(point, 20);
                }));
                return res;
            }, {});

            return lengths;
        }, this);
    },

    getRouteSummaryHtml : function(route) {
        return vow.all([
            this.getFreqs(),
            this.getRegistry(),
            this.getSegmentLengths(),
            this.getWiredSegments(),
            this._actualsDeferred.promise()
        ]).spread(function(freqs, registry, lengths, trolleyWires) {
            var res = '',
                registryData = registry[route],
                stateManager = this._stateManager;

            registryData && (res += '<span class="subtitle">' + registryData.endpoints + '</span>');

            var trolleyFraction = Math.round(trolleyUtils.getTrolleyFraction(route, lengths, this._actuals.routes, trolleyWires) * 100),
                isExpress = registryData && registryData.express,
                isPrivate = registryData && registryData.vendor != 'mgt',
                isSmall = registryData && registryData.class.join() == 's',
                type = route.indexOf('Тб') == 0? 'troll' : route.indexOf('Тм') == 0? 'tram' : 'bus';


            if(type == 'troll') {
                res += 'Это троллейбусный маршрут. Троллейбус экологичен, чист и бесшумен.';
            } else if(type == 'tram') {
                res += 'Это трамвайный маршрут. Трамвай экологичен, чист и при правильной прокладке путей практически бесшумен.';
            } else if(isExpress && trolleyFraction >= 50) {
                res += 'Это автобус-экспресс. <b>' + trolleyFraction + '%</b> его трассы проходят под троллейбусными проводами, но чтобы он мог обгонять поостановочные троллейбусы, нужно повесить вторую пару проводов. Это будет несложно, так как питающие подстанции и кабели уже на месте, но по формальному критерию нашей карты (ни метра новых проводов) этот маршрут не подходит.';
            } else if(isSmall && trolleyFraction >= 50) {
                res += 'На этом автобусном маршруте работают микроавтобусы малого класса. Такие редкоходящие маршруты с малым пассажиропотоком и есть экономическая ниша автобуса. Под троллейбусными проводами проходит <b>' + trolleyFraction + '%</b> его трассы, но заменять микроавтобусы на большие троллейбусы может быть экономически нецелесообразно. К тому же электробус такого размера, пригодный для нашего климата, вероятно, появится раньше полноразмерного.';
            } else if(isPrivate && trolleyFraction >= 50) {
                res += 'Этот автобусный маршрут на <b>' + trolleyFraction + '%</b> проходит под троллейбусными проводами. Грязные дизельные автобусы можно заменить на тихие экологичные троллейбусы хоть завтра, технологии это позволяют.<br/>Этот маршрут обслуживается частным перевозчиком, однако есть процедура передачи частных маршрутов Мосгортрансу: частник взамен получает возможность открыть новый автобусный маршрут c похожими параметрами.';
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

                    var wasteCoefficient = registryData.class? registryData.class.reduce(function(p, c) {
                        return p + { 's' : 0.9, 'm' : 2.2, 'l' : 3, 'xl' : 3.5 }[c];
                    }, 0) / registryData.class.length : 3;

                    res += 'В год ' + (quantity == 1? 'он выбасывает' : 'они выбасывают') + ' в воздух примерно <b>' + Math.round(quantity * wasteCoefficient) + ' т</b> опасных газов (CO, оксидов серы и азота).';
                }
            }

            return res;
        }, this);
    },

    getWholeTrollNumber : function() {
        return vow.all([
            this.getRegistry(),
            this.getSegmentLengths(),
            this.getWiredSegments(),
            this._actualsDeferred.promise()
        ]).spread(function(registry, lengths, trolleyWires, actuals) {
            var routesList = Object.keys(actuals.colors);

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
            this._actualsDeferred.promise()
        ]).spread(function(registry, lengths, trolleyWires, actuals) {
            var routesList = Object.keys(actuals.colors);

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
            this._actualsDeferred.promise()
        ]).spread(function(registry, lengths, trolleyWires, actuals) {
            var routesList = Object.keys(actuals.colors),
                that = this;

            return routesList.reduce(function(r, route) {
                var busRegistry = route.indexOf('Тб') == -1 && route.indexOf('Тм') == -1 && registry[route];

                return r + (busRegistry &&
                    trolleyUtils.getTrolleyFraction(route, lengths, that._actuals.routes, trolleyWires) >= 0.5 &&
                    busRegistry.class.join() != 's' &&
                    !busRegistry.express?
                        busRegistry.quantity :
                        0);
            }, 0);
        }, this);
    },

    getRouteBounds : function(route) {
        return vow.when(this._actualsDeferred.promise()).then(function(actuals) {
            return actuals.routeBounds[route];
        }, this);
    },

    getMatchingRoutes : function(text, strict) {
        return vow.when(this._actualsDeferred.promise()).then(function(actuals) {
            var existing = actuals.existingRoutes,
                histMappings = {
                    '1к' : ['Тб 8'],
                    '5' : ['м3'],
                    '16' : ['м27'],
                    '23' : ['223'],
                    '31' : ['А'],
                    '33' : ['м1', '144к'],
                    '37' : ['м9'],
                    '44' : ['м2'],
                    '45' : ['м8'],
                    '48' : ['м9'],
                    '62' : ['Тб м4'],
                    '63' : ['м7'],
                    '84' : ['Тб м4'],
                    '95' : ['Т79'],
                    '25' : ['м5']
                };

            if(!text) { return []; }

            var strictRe = new RegExp('^((Тм )|(Тб )|Т|т|м|С)?' + text + '[а-я]?$', 'i'),
                looseRe = new RegExp('^' + text + '(.*)$', 'i');

            return existing.filter(function(rt) {
                return strict? strictRe.test(rt) : looseRe.test(rt) && !strictRe.test(rt);
            }).concat(histMappings[text]).filter(Boolean);
        }, this);
    },

    _dropActuals : function() {
        this._actualsDeferred = vow.defer();
        this._actuals = {};
        this._actualsReady = false;
    },

    setActuals : function(actuals) {
        this._actualsDeferred.resolve(actuals);
        this._actuals = actuals;
        this._actualsReady = true;
        this.trigger('data-updated');
    }
});

return DataManager;

});