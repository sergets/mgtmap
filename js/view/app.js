define([
    'ymaps',
    'jquery',
    'vow',
    'utils/date',
    'utils/events-emitter',
    'utils/bus-color'
], function(
    ymaps,
    $,
    vow,
    dateUtils,
    eventsEmitter,
    getBusColor
) {

var AppView = function(map, stateManager) {
    this._map = map.getMap();
    this._stateManager = stateManager;
    
    this._init();
};

$.extend(AppView.prototype, eventsEmitter);

$.extend(AppView.prototype, {
    _init : function() {
        this._createTimeControls();
        
        $(document)
            .on('click', '.segment .save-segment', this._onSaveSegment.bind(this))
            .on('click', '.segment .reverse-segment', this._onReverseSegment.bind(this))
            .on('click', '.segment .edit-segment-geometry', this._onEditSegmentGeometry.bind(this))
            .on('click', '.segment .route', this._onSelectRoute.bind(this))
            .on('click', '.current-route', this._onDeselectRoute.bind(this));
    },
    
    _createTimeControls : function() {
        var timeSettings = this._stateManager.getTimeSettings();
    
        this._createListControl(
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
        );

        this._createListControl((new Date()).getHours() + ':00', {
            position : {
                top : 45,
                right : 90
            }
        }, Array.apply([], Array(24)).reduce(function(res, _, i) {
            res[i + 4] = (i + 4) % 24 + ':00';
            return res;
        }, {}), function(val) {
            this.trigger('time-settings-updated', { fromHour : +val });
        }, this);

        this._createListControl(((new Date()).getHours() + 1) + ':00', {
            position : {
                top : 45,
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
                top : 80,
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
        
        var _this = this;
        
        $('#dateForm').find('input')
        .val((new Date()).toISOString().substr(0, 10))
        .change(function() {
            if(this.value) {
                _this.trigger('time-settings-updated', { date : +new Date(this.value) });
            }
        });
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
        this._map.controls.add(control, options);
    },
    
    _onSaveSegment : function(e) {
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
    }, 

    _onReverseSegment : function(e) {
        if(!this._stateManager.isAdminMode()) return;
        this.trigger('reverse-segment', $(e.target).parent('.segment').attr('segment-id'));
    }, 
    
    _onEditSegmentGeometry : function(e) {
        if(!this._stateManager.isAdminMode()) return;
        this.trigger('edit-segment-geometry', $(e.target).parent('.segment').attr('segment-id'));
    }, 
    
    _onSelectRoute : function(e) {
        var route = $(e.target).text();

        this.trigger('route-selected', route);
        $('body').addClass('route-selected');
        $('.current-route').css('background', getBusColor(route)).html(route);
    },
    
    _onDeselectRoute : function(e) {
        this.trigger('route-selected', null);
        $('body').removeClass('route-selected');
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