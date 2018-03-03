define([
    'ymaps',
    'jquery',
    'utils/extend',
    'view/route',
    'view/progress',
    'view/search',
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

extend(AppView.prototype, eventsEmitter);

extend(AppView.prototype, {
    _init : function() {
        this._createControls();
        this._progressView = new ProgressView(this._map.getBackgroundPane());
        this._searchView = new SearchView('.sidebar', this._dataManager);

        if(!this._stateManager.getSelectedRoutes().length) {
            this._searchView.show();
        }
        
        $(document)
            //.on('click', '.segment .save-segment', this._onSaveSegment.bind(this))
            //.on('click', '.segment .select-segment-routes', this._onSelectSegmentRoutes.bind(this))
            //.on('click', '.segment .reverse-segment', this._onReverseSegment.bind(this))
            //.on('click', '.segment .edit-segment-geometry', this._onEditSegmentGeometry.bind(this))
            .on('click', '.segment .bus, .segment .trolley, .segment .tram', this._onSelectRoute.bind(this))
            .on('mouseover', '.segment .bus, .segment .trolley, .segment .tram', this._onRouteMouseOver.bind(this))
            .on('mouseout', '.segment .bus, .segment .trolley, .segment .tram', this._onRouteMouseOut.bind(this))
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

    },
    
    _createControls : function() {
        var timeSettings = this._stateManager.getTimeSettings();

        this._selectedRouteViews = {};          
    
        /*this._createListControl(
            ({ 6 : 'суббота', 0 : 'воскресенье' })[(new Date()).getDay()] || 'будни',
            {
                float : 'right'
            },
            {
                1 : 'будни',
                32 : 'суббота',
                64 : 'воскресенье'
            }, function(val) {
                this.trigger('time-settings-updated', { dow : +val });
            },
            this
        );*/

        this._createListControl('7:00', {
            position : {
                top : 10,
                right : 90
            }
        }, Array.apply([], Array(24)).reduce(function(res, _, i) {
            res[i + 4] = (i + 4) % 24 + ':00';
            return res;
        }, {}), function(val) {
            this.trigger('time-settings-updated', { fromHour : +val });
        }, this);

        this._createListControl('24:00', {
            position : {
                top : 10,
                right : 10
            }
        }, Array.apply([], Array(24)).reduce(function(res, _, i) {
            res[i + 4] = (i + 5) % 24 + ':00';
            return res;
        }, {}), function(val) {
            this.trigger('time-settings-updated', { toHour : +val });
        }, this);

        this._createListControl('x1', {
            position : {
                top : 45,
                right : 10
            }
        }, {
            "0.25" : 'x0.25',
            "0.5" : 'x0.5',
            "1" : 'x1',
            "2" : 'x2',
            "3" : 'x3',
            "5" : 'x5'
        },
        function(val) {
            this.trigger('width-factor-updated', +val);
        }, this);

        var colorings = {
            "" : 'обычные цвета',
            "vendor" : 'по перевозчику',
            "type" : 'по типу',
            "black" : 'все чёрные'
        }

        this._createListControl(colorings[this._stateManager.getCustomColoringId() || ''] || this._stateManager.getCustomColoringId(), {
            position : {
                top : 115,
                right : 10
            }
        }, colorings,
        function(val) {
            this.trigger('coloring-updated', val);
        }, this);
        
        var _this = this;
        
        $('#dateForm')
            .appendTo(this._map.getControlsPane())
            .find('input')
            .val((new Date()).toISOString().substr(0, 10))
            .change(function() {
                if(this.value) {
                    var date = new Date(this.value),
                        dow = 1 << ((date.getDay()? date.getDay() : 7) - 1);
                      
                    _this.trigger('time-settings-updated', { date : +date, dow : dow });
                }
            });

        this.updateSelectedRoutes();
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

    updateSelectedRoutes : function() {
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
    },

    refreshColors : function() {
        /*var dataManager = this._dataManager,
            selectedRouteViews = this._selectedRouteViews;

        Object.keys(selectedRouteViews).forEach(function(route) {
            dataManager.getBusColor(route).then(function(color) {
                selectedRouteViews[route].css('background-color', color);
            });
        });*/
        this.updateSelectedRoutes();
    },

    showProgress : function(val) {
        this._progressView.setVal(val).show();
    },

    hideProgress : function(val) {
        this._progressView.setVal(1).hide();
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