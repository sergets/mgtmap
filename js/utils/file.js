define(function() {
    var fileUtils = {
        getActualsFileNameByState : function(state, routes) {
            if (routes) {
                var dates = Object.keys(Object.keys(routes).reduce(
                        function(res, segmentId) {
                            Object.keys(routes[segmentId]).forEach(function(date) { res[date] = true; });
                            return res;
                        },
                        {}
                    )).sort(),
                    requestedDate = state.timeSettings.date,
                    pastDates = dates.filter(function(date) { return +new Date(date) < requestedDate });

                var lastDate = +new Date(pastDates[pastDates.length - 1]);
            }

            return [
                new Date(lastDate || state.timeSettings.date || undefined).toISOString().substring(0, 10),
                state.timeSettings.dow,
                state.timeSettings.fromHour,
                state.timeSettings.toHour,
                state.widthFactor,
                state.customColoringId,
            ].join('-');
        }
    };

    return fileUtils;
});