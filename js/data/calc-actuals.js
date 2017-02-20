define([
	'utils/date'
], function(
	dateUtils
) {
var DEFAULT_WIDTH = 2,
    NO_DATA_WIDTH = 0,
    SELECTED_ROUTE_WIDTH = 20;

return function(segments, routes, freqs, state) {
	return {
		actualRoutes : Object.keys(data.routes).reduce(function(res, segmentId) {
            var routesForSegment = data.routes[segmentId];
            res[segmentId] = routesForSegment[dateUtils.findNearestDate(Object.keys(routesForSegment), state.timeSettings.date)] || [];
            return res;
        }, {}),
    
    	actualWidths : Object.keys(data.freqs).reduce(function(widths, routeName) {
            var currentDay = Object.keys(freqs[routeName]).filter(function(dow) { return dow & state.timeSettings.dow; }),
                tt = data.freqs[routeName][currentDay] || {},
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

            return widths;
        }, {})
    };
};
})