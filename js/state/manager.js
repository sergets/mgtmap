define([
    'jquery',
    'vow',
    'utils/events-emitter'
], function(
    $,
    vow,
    eventsEmitter
) {

var StateManager = function() {
    var bounds,
        query = location.search.substr(1).split('&').reduce(function(res, param) {
            var params = param.split('=');
            res[params[0]] = params[1] || '';
            return res;
        }, {});
    
    try {
        bounds = JSON.parse(localStorage.getItem('bounds'));
    } catch(e) {};    
        
    this._bounds = bounds && bounds[0] && bounds[0][0]?
        bounds :
        [[55.73, 37.5], [55.77, 37.7]];
    this._timeSettings = {
        dow : ({ 6 : 32, 0 : 64 })[(new Date()).getDay()] || 1,
        fromHour : (new Date()).getHours(),
        toHour : (new Date()).getHours(),
        date : +new Date(new Date().toISOString().substring(0, 10))
    };
    this._selectedRoute = query.route || false;
    this._widthFactor = 1;
    this._isEqualWidthsMode = 'equal' in query;
    this._isAdminMode = 'admin' in query;
    this._isDebugMode = 'debug' in query,
    this._customColoringId = query.coloring;
};

$.extend(StateManager.prototype, eventsEmitter);

$.extend(StateManager.prototype, {
    getBounds : function() {
        return this._bounds;
    },

    setBounds : function(bounds) {
        if (JSON.stringify(bounds) != JSON.stringify(this._bounds)) {
            this._bounds = bounds;
            localStorage.setItem('bounds', JSON.stringify(bounds));
            this.trigger('bounds-updated', bounds);
        }
    },
    
    getTimeSettings : function() {
        return this._timeSettings;
    },
    
    setTimeSettings : function(data) {
        var isUpdated = false;
        Object.keys(data).forEach(function(settingName) {
            if (this._timeSettings[settingName] != data[settingName]) {
                this._timeSettings[settingName] = data[settingName];
                isUpdated = true;
            }        
        }, this);
        isUpdated && this.trigger('time-settings-updated', this._timeSettings);
    },
    
    getSelectedRoute : function() {
        return this._selectedRoute;
    },
    
    setSelectedRoute : function(route) {
        if (this._selectedRoute != route) {
            this._selectedRoute = route;
            this.trigger('selected-route-updated', route);
        }
    },

    getWidthFactor : function() {
        return this._widthFactor;
    },
    
    setWidthFactor : function(widthFactor) {
        if (this._widthFactor != widthFactor) {
            this._widthFactor = widthFactor;
            this.trigger('width-factor-updated', widthFactor);
        }
    },
    
    isEqualWidthsMode : function() {
        return this._isEqualWidthsMode; 
    },
    
    isAdminMode : function() {
        return this._isAdminMode; 
    },

    isDebugMode : function() {
        return this._isDebugMode; 
    },

    getCustomColoringId : function() {
        return this._customColoringId;
    }
});

return StateManager;

});