define(function() {
    var trolleyUtils = {
        isSegmentInRoute : function(segmentId, route, actualRoutes) {
            var routes = actualRoutes[segmentId];

            return routes &&
                (routes.indexOf('>' + route) != -1 ||
                routes.indexOf('<' + route) != -1 ||
                routes.indexOf(route) != -1);
        },

        isSegmentTrolleyForRoute : function(segmentId, route, actualRoutes, trolleyWires) {
            segmentId = +segmentId;
            var routes = actualRoutes[segmentId],
                isSelectedRouteForward = routes && routes.indexOf('>' + route) != -1,
                isSelectedRouteBackward = routes && routes.indexOf('<' + route) != -1,
                isSelectedRouteBoth = routes && routes.indexOf(route) != -1,
                isSegmentTrolleyForward = trolleyWires.forward.indexOf(segmentId) != -1,
                isSegmentTrolleyBackward = trolleyWires.backward.indexOf(segmentId) != -1,
                isSegmentTrolleyBoth = trolleyWires.both.indexOf(segmentId) != -1;

            if(isSelectedRouteForward && isSelectedRouteBackward) {
                isSelectedRouteBoth = true;
            }
            if(isSelectedRouteBoth) {
                isSelectedRouteForward = false;
                isSelectedRouteBackward = false;
            }

            return (isSelectedRouteForward && (isSegmentTrolleyForward || isSegmentTrolleyBoth)) ||
                (isSelectedRouteBackward && (isSegmentTrolleyBackward || isSegmentTrolleyBoth)) ||
                (isSelectedRouteBoth && isSegmentTrolleyBoth);
            return res;
        },

        getTrolleyFraction : function(route, lengths, actualRoutes, trolleyWires) {
            var totalLength = 0,
                trolleyLength = 0;

            Object.keys(lengths).forEach(function(segmentId) {
                if(trolleyUtils.isSegmentInRoute(segmentId, route, actualRoutes)) {
                    var times = actualRoutes[segmentId].reduce(function(t, r) {
                        if(r == route) return t + 2;
                        if(r == '>' + route || r == '<' + route) return t + 1;
                        return t; 
                    }, 0);
                    totalLength += times * lengths[segmentId];
                    if(trolleyUtils.isSegmentTrolleyForRoute(segmentId, route, actualRoutes, trolleyWires)) {
                        trolleyLength += times * lengths[segmentId];
                    }
                }
            });

            return trolleyLength / totalLength;
        }
    };

    return trolleyUtils;
});