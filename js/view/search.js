define([
    'utils/extend',
    'utils/events-emitter',
    'utils/route',
    'vow',
    'jquery'
], function(
    extend,
    eventsEmitter,
    routeUtils,
    vow,
    $
) {

var MAX_SUGGEST_ITEMS = 9,
    SUGGEST_EMPTY_MESSAGE = '';

var SearchView = function(elem, dataManager) {
    this._domElem = $('<div/>')
        .addClass('search')
        .append($('<input/>')
            .addClass('search-input')
            .addClass('search-route'))
        .append($('<div/>')
            .addClass('search-suggest'))
        .appendTo($(elem || 'body'));
    this._input = this._domElem.find('.search-input');
    this._suggest = this._domElem.find('.search-suggest');
    this._dataManager = dataManager;

    this._val = this._input.val();

    this._input
        .on('change keydown', this._onInputChanged.bind(this))
        .on('blur', this._hideSuggest.bind(this))
        .on('keyup', this._onKeyDown.bind(this));
    this._suggest
        .on('click', '.bus, .trolley, .tram', this._onRouteSelected.bind(this))
        .on('mouseover', '.bus, .trolley, .tram', (function(e) { this._selectSuggestItem($(e.target)); }).bind(this));
};

extend(SearchView.prototype, eventsEmitter);

extend(SearchView.prototype, {
    show : function() {
        this._domElem.addClass('search_visible');
        return this;
    },

    hide : function() {
        this._domElem.removeClass('search_visible');
        return this;
    },

    clear : function() {
        this._input.val('');
        this._mimicInput(null);
        this._suggest.html('');
        return this;
    },

    _showSuggest : function() {
        this._suggest.addClass('search-suggest_visible');
    },

    _hideSuggest : function() {
        this._suggest.removeClass('search-suggest_visible');
    },

    _onInputChanged : function() {
        var input = this._input,
            dataManager = this._dataManager,
            val = input.val();

        if(val == this._val) return;
        this._val = val;
        dataManager.getMatchingRoutes(val, true)
            .then(function(matches) { 
                return matches.length? matches : dataManager.getMatchingRoutes(val, false);
            })
            .then(function(matches) {
                var resArray = matches.slice(0, MAX_SUGGEST_ITEMS);

                return vow.all([
                    resArray,
                    vow.all(resArray.reduce(function(res, rt) {
                        res[rt] = dataManager.getBusColor(rt);
                        return res;
                    }, {})),
                    vow.all(resArray.reduce(function(res, rt) {
                        res[rt] = dataManager.getActualWidthForRoute(rt);
                        return res;
                    }, {}))
                ]);
            })
            .spread(function(routes, colors, widths) {
                routes.sort(function(rtA, rtB) {
                    var a = routeUtils.clearType(rtA),
                        b = routeUtils.clearType(rtB);

                    if (a == val && b != val) return -1;
                    if (b == val && a != val) return 1;
                    return (widths[rtB] || 0) - (widths[rtA] || 0);
                });
                this._showSuggest();
                if(input && input.val() == val) {
                    this._setSuggestValues(routes, colors);
                }
                else {
                    this._clearSuggest();
                }
            }, this);
    },

    _onKeyDown : function(e) {
        var ARROW_DOWN = 40,
            ARROW_UP = 38,
            ENTER = 13;

        var selectedElem = this._suggest.find('.search-suggest-item_selected');

        if(selectedElem.length && e.keyCode == ENTER) {
            this.trigger('route-selected', this._routeElemToRouteId(selectedElem));
            e.preventDefault();
        }
        else if(e.keyCode == ARROW_DOWN || e.keyCode == ARROW_UP) {
            var next;
            if (e.keyCode == ARROW_DOWN) {
                next = selectedElem.next('.search-suggest-item');
                if(!next.length) { 
                    next = $(this._suggest.find('.search-suggest-item')[0]);
                }
            } else {
                var next = selectedElem.prev('.search-suggest-item');
                if(!next.length) { 
                    var res = this._suggest.find('.search-suggest-item');
                    next = $(res[res.length - 1]);
                }
            }
            this._selectSuggestItem(next);
            e.preventDefault();
        }
        else {
            this._onInputChanged();
        }
    },

    _selectSuggestItem : function(next) {
        this._suggest.find('.search-suggest-item_selected').removeClass('search-suggest-item_selected');
        next.addClass('search-suggest-item_selected');
        this._mimicInput(next);
        this.trigger('route-highlighted', this._routeElemToRouteId(next));
    },

    _setSuggestValues : function(routes, colors) {
        this._suggest
            .html('')
            .append(routes.reduce(function(res, route) {
                var type = routeUtils.getType(route),
                    routeCleared = routeUtils.clearType(route);

                return res.add($('<div/>')
                    .addClass(type)
                    .addClass('search-suggest-item')
                    .css('backgroundColor', colors[route])
                    .html(routeCleared));
            }, $()));

        var firstItem = $(this._suggest.find('.search-suggest-item')[0]);

        firstItem.addClass('search-suggest-item_selected');
        this._mimicInput(firstItem);
    },

    _mimicInput : function(elem) {
        if(elem && elem.length) {
            this._input
                // .val(elem.html())
                .toggleClass('bus', elem.hasClass('bus'))
                .toggleClass('trolley', elem.hasClass('trolley'))
                .toggleClass('tram', elem.hasClass('tram'))
                .removeClass('search-route')
                .css('backgroundColor', elem.css('backgroundColor'));
        }
        else {
            this._input
                .removeClass('bus trolley tram')
                .addClass('search-route')
                .css('backgroundColor', '');
        }
    },

    _clearSuggest : function() {
        this._suggest
            .html('')
            .append($('<div/>').addClass('suggest-empty').html(SUGGEST_EMPTY_MESSAGE)); 
        this._mimicInput(null);
    },

    _onRouteSelected : function(e) {
        this._hideSuggest();
        this.trigger('route-selected', this._routeElemToRouteId(e.target));
    },

    _routeElemToRouteId : function(elem) {
        var elem = $(elem);
            routeNumber = elem.text(),
            routeType = elem.hasClass('trolley')? 'trolley': elem.hasClass('tram')? 'tram' : 'bus';

        return { trolley: 'Тб ', bus: '', tram : 'Тм ' }[routeType] + routeNumber;
    },
});

return SearchView;

});