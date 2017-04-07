define([
    'utils/extend',
    'vow',
    'utils/events-emitter'
], function(
    extend,
    vow,
    eventsEmitter
) {

var StateManager = function() {
    var bounds,
        query = location.search.substr(1).split('&').reduce(function(res, param) {
            var params = param.split('=');
            res[decodeURIComponent(params[0])] = decodeURIComponent(params[1]) || '';
            return res;
        }, {});
    
    try {
        bounds = JSON.parse(localStorage.getItem('bounds'));
    } catch(e) {};    
        
    this._bounds = bounds && bounds[0] && bounds[0][0]?
        bounds :
        [[55.74, 37.55], [55.76, 37.65]];
    this._timeSettings = {
        dow : ({ 6 : 32, 0 : 64 })[(new Date()).getDay()] || 1,
        fromHour : (new Date()).getHours(),
        toHour : (new Date()).getHours(),
        date : +new Date(new Date().toISOString().substring(0, 10))
    };
    this._selectedRoutes = query.routes? query.routes.split(',') : [];
    this._widthFactor = 1;
    this._isEqualWidthsMode = 'equal' in query;
    // this._isAdminMode = 'admin' in query;
    this._isDebugMode = 'debug' in query,
    this._white = query.white || 0.7;
    this._customColoringId = query.coloring;
};

extend(StateManager.prototype, eventsEmitter);

extend(StateManager.prototype, {
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
    
    getSelectedRoutes : function() {
        return this._selectedRoutes;
    },
    
    selectRoutes : function(routes) {
        routes.forEach(function(route) {
            if (this._selectedRoutes.indexOf(route) == -1) {
                this._selectedRoutes.push(route);
            }
        }, this);
        this.trigger('selected-routes-updated', this._selectedRoutes);
    },

    deselectRoutes : function(routes) {
        routes.forEach(function(route) {
            var index = this._selectedRoutes.indexOf(route);

            if (index != -1) {
                this._selectedRoutes.splice(index, 1);
            }
        }, this);
        this.trigger('selected-routes-updated', this._selectedRoutes);
    },

    getWhite : function() {
        return this._white;
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
        return fasle; // this._isAdminMode; 
    },

    isDebugMode : function() {
        return this._isDebugMode; 
    },

    getCustomColoringId : function() {
        return this._customColoringId;
    },

    serialize : function() {
        return {
            timeSettings : this._timeSettings,
            selectedRoutes : this._selectedRoutes,
            widthFactor : this._widthFactor,
            isEqualWidthsMode : this._isEqualWidthsMode,
            isAdminMode : this._isAdminMode,
            isDebugMode : this._isDebugMode,
            white : this._white,
            customColoringId : this._customColoringId
        };
    }
});

return StateManager;

});