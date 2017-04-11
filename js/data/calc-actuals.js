define([
	'utils/date',
    'data/colorings/default',
    'data/colorings/type',
    'data/colorings/black',
    'data/colorings/vendor',
    'data/colorings/troll-project'
], function(
	dateUtils,
    defaultColoring,
    typeColoring,
    blackColoring,
    vendorColoring,
    trollProjectColoring
) {

var DEFAULT_WIDTH = 2,
    NO_DATA_WIDTH = 0,
    SELECTED_ROUTE_WIDTH = 20;

var colorings = {
    default : defaultColoring,
    type : typeColoring,
    black : blackColoring,
    vendor : vendorColoring,
    'troll-project' : trollProjectColoring
};

return function(data, state) {
    var allActualRoutes = {},
        actualRoutes = Object.keys(data.routes).reduce(function(res, segmentId) {
            var routesForSegment = data.routes[segmentId] || [];
            res[segmentId] = routesForSegment[dateUtils.findNearestDate(Object.keys(routesForSegment), state.timeSettings.date)] || [];
            res[segmentId].forEach(function(route) {
                allActualRoutes[route.replace(/^[-<>]/, '')] = true;
            });
            return res;
        }, {}),
        actualWidths = Object.keys(allActualRoutes).reduce(function(widths, routeName) {
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

            return widths;
        }, {}),
        actualColors = Object.keys(allActualRoutes).reduce(function(colors, routeName) {
            colors[routeName] = colorings[state.customColoringId || 'default'].getRouteColor(routeName, data, state, { 
                actualWidths : actualWidths,
                actualRoutes : actualRoutes
            });
            return colors;
        }, {}),
        actualSegmentOutlines = Object.keys(data.segments).reduce(function(outlines, segmentId) {
            outlines[+segmentId] = colorings[state.customColoringId || 'default'].getSegmentOutlines(+segmentId, data, state, {
                actualWidths : actualWidths,
                actualRoutes : actualRoutes
            });
            return outlines;
        }, {});

	return {
		actualRoutes : actualRoutes,
    	actualWidths : actualWidths,
        actualColors : actualColors,
        actualSegmentOutlines : actualSegmentOutlines
    };
};
})