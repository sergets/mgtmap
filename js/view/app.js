define([
    'ymaps',
    'jquery',
    'utils/extend',
    'view/route',
    'view/progress',
    'view/search',
    'view/settings',
    'vow',
    'utils/date',
    'utils/events-emitter'
], function(
    ymaps,
    $,
    extend,
    routeView,
    ProgressView,
    SearchView,
    SettingsView,
    vow,
    dateUtils,
    eventsEmitter
) {

var AppView = function(map, dataManager, stateManager) {
    this._map = map;
    this._stateManager = stateManager;
    this._dataManager = dataManager;

    this._init();
};

function incline(number, one, some, many) {
    return (number % 10 === 1 && number % 100 != 11)?
        one :
        (number % 10 > 1 && number % 10 < 5 && Math.floor(number % 100 / 10) != 1)?
            some :
            many;
}

extend(AppView.prototype, eventsEmitter);

extend(AppView.prototype, {
    _init : function() {
        this._createTopPane();
        this._createControls();

        this._progressView = new ProgressView(this._map.getBackgroundPane());
        this._searchView = new SearchView('.sidebar', this._dataManager);
        //this._settingsView = new SettingsView('body', this._stateManager.serialize());

        this._selectedRouteViews = {};
        //this.updateSelectedRoutes();




        //if(!this._stateManager.getSelectedRoutes().length) {
            this._searchView.show();
        //}

        $(document)
            //.on('click', '.segment .save-segment', this._onSaveSegment.bind(this))
            //.on('click', '.segment .select-segment-routes', this._onSelectSegmentRoutes.bind(this))
            //.on('click', '.segment .reverse-segment', this._onReverseSegment.bind(this))
            //.on('click', '.segment .edit-segment-geometry', this._onEditSegmentGeometry.bind(this))
            .on('click', '.segment .bus, .segment .trolley, .segment .tram', this._onSelectRoute.bind(this))
            .on('mouseover', '.segment .bus, .segment .trolley, .segment .tram', this._onRouteMouseOver.bind(this))
            .on('mouseout', '.segment .bus, .segment .trolley, .segment .tram', this._onRouteMouseOut.bind(this))
            .on('click', '.mayor-option', this._onChangeColoring.bind(this))
            .on('click', '.route-card .close', this._onDeselectRoute.bind(this))
            //.on('click', '.deselect-all', this._onDeselectAllRoutes.bind(this));

        this._map
            .on('highlight-routes', this._onRoutesHighlightedOnMap, this)
            .on('unhighlight-routes', this._onRoutesUnhighlightedOnMap, this);

        this._searchView
            .on('route-selected', function(e, data) {
                this._searchView.clear().hide();
                this.trigger('route-selected', data);
            }, this);

        /*this._settingsView
            .on('change', function(e, data) {
                console.log(data);
                this.trigger('state-updated', data);
            }, this);*/
    },


    _createTopPane : function() {
        var yMap = this._map.getMap();
        this._topPane = $(
                '<div class="top-pane top-pane_expanded">' +
                    '<h1>Сколько троллейбусов должно быть в Москве?</h1>' +
                    '<p>Современные троллейбусы (они же — электробусы с динамической подзарядкой) могут проходить до&nbsp;50% маршрута без&nbsp;проводов. ' +
                    'Многие автобусные маршруты сейчас проходят под&nbsp;проводами и&nbsp;их можно сделать тихими и&nbsp;экологичными прямо&nbsp;завтра, ' +
                    'без&nbsp;нового строительства — нужно просто купить троллейбусы.</p>' +
                    '<p>Мы нанесли на карту все автобусные маршруты Москвы и раскрасили светло-голубым те из них, которые идут под проводами 50%&nbsp;пути и больше. ' +
                    'Выберите конкретный маршрут на карте или найдите его по номеру, чтобы узнать, сколько там работает автобусов и увидеть, где над ними есть контактная сеть' +
                    ' (она будет показана зелёной обводкой вокруг линии маршрута).</p>' +
                    '<div class="top-pane-toggler"></div>' +
                    '<div class="mayor-selector">' +
                        '<div class="mayor-wrapper">' +
                            '<div class="mayor-option sobyanin">Как планируют в мэрии</div>' +
                            '<div class="mayor-counters sobyanin">' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter trolley">0</div>троллейбусов</div>' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter electrobus">200</div>электробусов</div>' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter bus">7313</div>автобусов</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="mayor-wrapper">' +
                            '<div class="mayor-option now">Как сейчас</div>' +
                            '<div class="mayor-counters now">' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter trolley">770</div>троллейбусов</div>' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter bus">6724</div>автобусов</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="mayor-wrapper">' +
                            '<div class="mayor-option katz">Как надо</div>' +
                            '<div class="mayor-counters katz">' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter trolley">905</div>троллейбусов</div>' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter electrotrolley">1333</div>троллейбуса с АХ</div>' +
                            //    '<div class="mayor-counters__row"><div class="mayor-counters__counter bus">5294</div>автобуса</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>');
        /* this._countersPane = $('<div class="counters">' +
            'Всего на маршрутах:<br>' +
            '<span class="counter-temp">' +
                '<div class="electrotrolley">...</div>' +
                '<div class="bus">...</div>' +
            '</span>' +
        '</div>'); */

        this._topPane.find('.top-pane-toggler').on('click', function() {
            this._topPane.toggleClass('top-pane_expanded');
            $('.sidebar').toggleClass('sidebar_with-top-pane-expanded');
        }.bind(this));

        yMap.panes.append('top-pane', new ymaps.pane.StaticPane(yMap, {
            css : {
                left: 0,
                right: 0,
                width: '100%',
                height: '100%',
                'pointer-events': 'none'
            },
            zIndex : 600 // more than events-pane
        }));
        yMap.panes.get('top-pane').getElement().appendChild(this._topPane[0]);
        /*yMap.panes.append('mayor-pane', new ymaps.pane.StaticPane(yMap, {
            css : {
                left: '50%',
                top: this._topPane.height() + 'px',
                //marginTop: '10px',
                //marginLeft: '-250px'
            },
            zIndex : 603
        }));
        yMap.panes.get('mayor-pane').getElement().appendChild(this._mayorPane[0]);*/
        /*yMap.panes.append('counters-pane', new ymaps.pane.StaticPane(yMap, {
            css : {
                left: '50%',
                bottom: 0
            },
            zIndex : 204
        }));
        yMap.panes.get('counters-pane').getElement().appendChild(this._countersPane[0]);*/
        /* $(window).resize(function() {
            $(yMap.panes.get('mayor-pane').getElement()).css('top', this._topPane.height() + 'px');
        }.bind(this)); */



        vow.all([
            this._dataManager.getWholeTrollNumber(),
            this._dataManager.getWholeBusNumber(),
            this._dataManager.getEcoBusNumber(),
            this._dataManager.getSobyaninElectrobusNumber(),
            this._dataManager.get100PercentTrollBusNumber(),
        ]).spread(function(trolls, buses, ecobuses, sobyaninElectrobuses, trolls100percent) {
            console.log(arguments);
            //$('.counter-temp').remove();
            $('.mayor-counters.sobyanin').append([
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>').addClass('mayor-counters__counter electrobus').html(200), 'электробусов (?)'
                ]),
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>').addClass('mayor-counters__counter bus').html(buses + trolls - sobyaninElectrobuses), incline(buses + trolls - sobyaninElectrobuses, 'автобус', 'автобуса', 'автобусов')
                ]),
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>')
                        .addClass('mayor-counters__counter percentage')
                        .html(
                            Math.round(100 * 200 / (200 + buses + trolls - sobyaninElectrobuses)) + '%'
                        ),
                    'электротранспорта'
                ])
            ]);

            $('.mayor-counters.now').append([
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>').addClass('mayor-counters__counter trolley').html(trolls), incline(trolls, 'троллейбус', 'троллейбуса', 'троллейбусов')
                ]),
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>').addClass('mayor-counters__counter bus').html(buses), incline(buses, 'автобус', 'автобуса', 'автобусов')
                ]),
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>')
                        .addClass('mayor-counters__counter percentage')
                        .html(
                            Math.round(100 * trolls / (buses + trolls)) + '%'
                        ),
                    'электротранспорта'
                ])
            ]);


            $('.mayor-counters.katz').append([
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>').addClass('mayor-counters__counter trolley').html(trolls + trolls100percent), incline(trolls + trolls100percent, 'троллейбус', 'троллейбуса', 'троллейбусов')
                ]),
               $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>').addClass('mayor-counters__counter electrotrolley').html(ecobuses - trolls100percent), incline(ecobuses - trolls100percent, 'троллейбус с АХ', 'троллейбуса с АХ', 'троллейбусов с АХ')
                ]),
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>').addClass('mayor-counters__counter bus').html(buses - ecobuses), incline(buses - ecobuses, 'автобус', 'автобуса', 'автобусов')
                ]),
                $('<div/>').addClass('.mayor-counters__row').append([
                    $('<div/>')
                        .addClass('mayor-counters__counter percentage')
                        .html(
                            Math.round(100 * (trolls + ecobuses) / (buses + trolls)) + '%'
                        ),
                    'электротранспорта'
                ])
            ]);
        }).fail(function(err) { console.warn(err); });
    },

    _createControls : function() {
        var timeSettings = this._stateManager.getTimeSettings();


        this._selectedRouteViews = {};
        //
    },

    _createListControl : function(content, options, items, onItemSelected, ctx) {
        var control = new ymaps.control.ListBox({
                data: {
                    content: content
                },
                items: Object.keys(items).map(function(itemKey) {
                    return new ymaps.control.ListBoxItem(items[itemKey]);
                })
            }),
            createEventListener = function(i) {
                return function() {
                    Object.keys(items).forEach(function(itemKey, j) {
                        if(j != i) {
                            control.get(j).deselect();
                        }
                    });
                    control.data.set('content', items[Object.keys(items)[i]]);
                    onItemSelected.call(ctx || this, Object.keys(items)[i]);
                };
            };
        Object.keys(items).forEach(function(itemKey, i) {
            control.get(i).events.add('click', createEventListener(i));
        });
        this._map.getMap().controls.add(control, options);
    },

    /*_onSaveSegment : function(e) {
        if(!this._stateManager.isAdminMode()) return;

        var segment = $(e.target).parent('.segment'),
            id = segment.attr('segment-id'),
            yesterday = segment.find('.routes-editor.yesterday').text(),
            today = segment.find('.routes-editor.today').text(),
            allRoutes = JSON.parse(decodeURIComponent(segment.attr('all-routes-json-encoded'))),

            yesterdayRoutes = unjoinRoutes(yesterday),
            todayRoutes = unjoinRoutes(today),

            todayDate = this._stateManager.getTimeSettings().date,
            todayKey = new Date(todayDate).toISOString().substr(0, 10),
            yesterdayKey = dateUtils.findNearestDate(Object.keys(allRoutes), todayDate, true)

        if(todayKey in allRoutes && JSON.stringify(yesterdayRoutes) == JSON.stringify(todayRoutes)) {
            delete allRoutes[todayKey];
        }

        if(!(todayKey in allRoutes) && JSON.stringify(yesterdayRoutes) != JSON.stringify(todayRoutes)) {
            allRoutes[todayKey] = {};
        }

        (yesterdayKey in allRoutes) && (allRoutes[yesterdayKey] = yesterdayRoutes);
        (todayKey in allRoutes) && (allRoutes[todayKey] = todayRoutes);

        segment.attr('all-routes-json-encoded', encodeURIComponent(JSON.stringify(allRoutes)));
        this.trigger('save-segment', { id : id, routes : allRoutes });
    }, */

    /*_onReverseSegment : function(e) {
        if(!this._stateManager.isAdminMode()) return;
        this.trigger('reverse-segment', $(e.target).parent('.segment').attr('segment-id'));
    },

    _onEditSegmentGeometry : function(e) {
        if(!this._stateManager.isAdminMode()) return;
        this.trigger('edit-segment-geometry', $(e.target).parent('.segment').attr('segment-id'));
    },*/

    /*_onSelectSegmentRoutes : function(e) {
        this.trigger('select-segment-routes', $(e.target).parent('.segment').attr('segment-id'));
    },*/

    _routeElemToRouteId : function(elem) {
        var elem = $(elem);
            routeNumber = elem.text(),
            routeType = elem.hasClass('trolley')? 'trolley': elem.hasClass('tram')? 'tram' : 'bus';

        return { trolley: 'Тб ', bus: '', tram : 'Тм ' }[routeType] + routeNumber;
    },

    _onSelectRoute : function(e) {
        this._searchView.clear().hide();
        this.trigger('route-selected', this._routeElemToRouteId(e.target));
    },

    _onRouteMouseOver : function(e) {
        this._map.highlightRoutes([this._routeElemToRouteId(e.target)]);
    },

    _onRouteMouseOut : function(e) {
        this._map.unhighlightRoutes([this._routeElemToRouteId(e.target)]);
    },

    _onRoutesHighlightedOnMap : function(e, data) {
        if(!data.routes || !data.routes.length) {
            return;
        }

        var elementsToHighLight = $('.segment .bus, .segment .trolley, .segment .tram');

        data.routes.forEach(function(route) {
            var type = route.indexOf('Тб')? route.indexOf('Тм')? 'bus' : 'tram' : 'trolley',
                routeCleared = route.replace(/^(Тб|Тм) /, '');

            elementsToHighLight = elementsToHighLight.not($('.segment').find('.' + type).filter(function(_, el) {
                return el.textContent == routeCleared;
            }));
        });

        elementsToHighLight.addClass('dimmed');
    },

    _onRoutesUnhighlightedOnMap : function(e) {
        $('.segment .dimmed').removeClass('dimmed');
    },

    /*_onDeselectRoute : function(e) {
        var target = $(e.target).closest('.current-route');
            routeNumber = target.text(),
            routeTypeElem = target.find('.bus,.tram,.trolley')[0],
            routeType = routeTypeElem && routeTypeElem.className,
            route = { trolley: 'Тб ', bus: '', tram : 'Тм ' }[routeType] + routeNumber;

        routeType && this.trigger('routes-deselected', { routes : [route] });
    },*/

    _onDeselectRoute : function(e) {
        this.trigger('route-deselected');
        this._searchView.show();
    },

    _createSelectedRouteView : function(route) {
        return routeView(route, this._dataManager).appendTo('.sidebar');

        /*var type = route.indexOf('Тб')? route.indexOf('Тм')? 'bus' : 'tram' : 'trolley',
            routeCleared = route.replace(/^(Тб|Тм) /, ''),
            view = $('<div/>')
                .addClass('current-route')
                .append($('<div/>')
                    .addClass(type)
                    .css('background-color', 'inherit')
                    .html(routeCleared)
                )
                .appendTo('.current-routes');

        this._dataManager.getBusColor(route).done(function(color) {
            view.css('background-color', color);
        });*/

        //return view;
    },

    /*updateSelectedRoutes : function() {
        this._map.closeBalloon();
        var selectedRoutes = this._stateManager.getSelectedRoutes();
        Object.keys(this._selectedRouteViews).forEach(function(route) {
            //if(selectedRoutes.indexOf(route) == -1) {
                this._selectedRouteViews[route].remove();
                delete this._selectedRouteViews[route];
            //}
        }, this);
        selectedRoutes.forEach(function(route) {
            if(!this._selectedRouteViews[route]) {
                this._selectedRouteViews[route] = this._createSelectedRouteView(route);
            }
        }, this)
    },*/

    showSelectedRoute : function(route) {
        this._map.closeBalloon();
        this._selectedRouteViews[route] = this._createSelectedRouteView(route);
    },

    hideSelectedRoute : function() {
        Object.keys(this._selectedRouteViews).forEach(function(route) {
            this._selectedRouteViews[route].remove();
            delete this._selectedRouteViews[route];
        }, this);
    },

    /*refreshColors : function() {
        / *var dataManager = this._dataManager,
            selectedRouteViews = this._selectedRouteViews;

        Object.keys(selectedRouteViews).forEach(function(route) {
            dataManager.getBusColor(route).then(function(color) {
                selectedRouteViews[route].css('background-color', color);
            });
        });* /
        this.updateSelectedRoutes();
    },*/

    showProgress : function(val) {
        this._progressView.setVal(val).show();
    },

    hideProgress : function(val) {
        this._progressView.setVal(1).hide();
    },

    _onChangeColoring : function(e) {
        var option = e.target,
            newColoring = e.target.className.split(' ')[1];

        $('body').removeClass('sobyanin katz now').addClass(newColoring);
        $('#spinner').addClass('visible');

        setTimeout(function() {
            this._stateManager.setCustomColoringId(newColoring);
        }.bind(this), 200);
    }
});

function unjoinRoutes(routes) {
    var re = /([-<>]?)((?:Тм |Тб |)(?:[А-я-0-9]+))/g,
        m = true,
        res = [];
    while(m) {
        m = re.exec(routes);
        m && res.push(m[0]);
    }
    return res;
}

return AppView;

});