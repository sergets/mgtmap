define(['vow'], function(vow) {

var DEFAULT_WIDTH = 2,
    NO_DATA_WIDTH = 0,
    SELECTED_ROUTE_WIDTH = 20;

return {
    shouldRecalc : function(state, updatedStateFields) {
        return true;
    },

    deps : ['existingRoutes'],

    calc : function(data, state, existingRoutes) {
        return vow.resolve(existingRoutes.reduce(function(widths, routeName) {
            var freqs = data.freqs[routeName] || {}
                currentDay = Object.keys(freqs).filter(function(dow) { return dow & state.timeSettings.dow; }),
                tt = freqs[currentDay] || {},
                i = 0;

            if (state.isEqualWidthsMode) { 
                widths[routeName] = DEFAULT_WIDTH;
            } else if (state.selectedRoutes.length == 1) {
                widths[routeName] = (routeName == state.selectedRoutes[0]? SELECTED_ROUTE_WIDTH : 0);
            } else {
                widths[routeName] = Object.keys(tt).reduce(function(width, hour) {
                    if(hour >= state.timeSettings.fromHour && hour <= state.timeSettings.toHour) {
                        width += tt[hour];
                        i++;
                    }
                    return width;
                }, 0) / i;

                if (state.selectedRoutes.length && state.selectedRoutes.indexOf(routeName) == -1) {
                    widths[routeName] = 0;
                }
            }

            widths[routeName] *= state.widthFactor;
            widths[routeName] = Math.round(widths[routeName] * 100) / 100 || widths[routeName];

            return widths;
        }, {}));
    }
}

});
