define([
    'data/calc-actuals'
], function(
    calcActuals
) {
    return function(params) {
        postMessage({ state : 'busy '});

        var state = params.state,
            oldState = this.state,
            data = this.data,
            changedStateFields = Object.keys(state).reduce(function(changeds, propId) {
                if(JSON.stringify(oldState[propId]) != JSON.stringify(state[propId])) {
                    changeds.push(propId);
                }
                return changeds;
            }, []);

        this.state = state;

        return calcActuals(
            data,
            state,
            changedStateFields, 
            {
                actualRoutes : this.actualRoutes,
                actualWidths : this.actualWidths,
                actualColors : this.actualColors,
                actualSegmentOutlines : this.actualSegmentOutlines
            }
        ).then(function(actuals) {
            this.actualRoutes = actuals.actualRoutes;
            this.actualWidths = actuals.actualWidths;
            this.actualColors = actuals.actualColors;
            this.actualSegmentOutlines = actuals.actualSegmentOutlines;

            this.maxWidth = 0;

            this.tilePixelLinesCache.drop();
            
            this.maxWidth = data.segments.reduce(function(prev, segment, id) {
                if(!segment.length) return;

                var width = (this.actualRoutes[id] || []).reduce(function(s, route) {
                    return s + (this.actualWidths[route.replace(/^[-<>]/, '')] || 0); 
                }, 0);

                return Math.max(width, prev);
            }, 0);
        }, this).then(function() {
            return { state : 'ready' };
        });
    };
});
