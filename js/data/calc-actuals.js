define([
    'vow',
    'utils/extend',
	'utils/date',
    'data/colorings/default',
    'data/colorings/type',
    'data/colorings/black',
    'data/colorings/vendor',
    'data/colorings/troll-project'
], function(
    vow,
    extend,
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

return function(data, state, updatedStateFields, oldActuals) {
    var coloring = colorings[state.customColoringId || 'default'];

    var shouldRecalcActualRoutes = updatedStateFields.indexOf('timeSettings') != -1,
        shouldRecalcColors = updatedStateFields.indexOf('customColoringId') != -1 || 
            coloring.shouldRecalcColorsOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            }),
        shouldRecalcOutlines = updatedStateFields.indexOf('customColoringId') != -1 || 
            coloring.shouldRecalcOutlinesOn.some(function(stateField) {
                return updatedStateFields.indexOf(stateField) != -1;
            }),

        allActualRoutes = shouldRecalcActualRoutes?
            {} :
            Object.keys(oldActuals.actualColors).reduce(function(res, id) {
                res[id] = true;
                return res;
            }, {}),

        actualRoutes = shouldRecalcActualRoutes?
            Object.keys(data.routes).reduce(function(res, segmentId) {
                var routesForSegment = data.routes[segmentId] || [];
                res[segmentId] = routesForSegment[dateUtils.findNearestDate(Object.keys(routesForSegment), state.timeSettings.date)] || [];
                res[segmentId].forEach(function(route) {
                    allActualRoutes[route.replace(/^[-<>]/, '')] = true;
                });
                return res;
            }, {}) : 
            oldActuals.actualRoutes,

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

        actualColors = shouldRecalcColors?
            Object.keys(allActualRoutes).reduce(function(colors, routeName) {
                colors[routeName] = coloring.getRouteColor(routeName, data, state, { 
                    actualWidths : actualWidths,
                    actualRoutes : actualRoutes
                });
                return colors;
            }, {}) :
            oldActuals.actualColors;

        actualSegmentOutlines = shouldRecalcOutlines?
            Object.keys(data.segments).reduce(function(outlines, segmentId) {
                outlines[+segmentId] = coloring.getSegmentOutlines(+segmentId, data, state, {
                    actualWidths : actualWidths,
                    actualRoutes : actualRoutes
                });
                return outlines;
            }, {}) :
            oldActuals.actualSegmentOutlines;

	return vow.all({
		actualRoutes : actualRoutes,
    	actualWidths : actualWidths,
        actualColors : actualColors,
        actualSegmentOutlines : actualSegmentOutlines
    });
};

})