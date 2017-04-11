define(function() {
    return {
        getRouteColor : function(route, data, state) {
            return data.vendors && {
                'autoline' : '#59c',
                'tmp20' : '#871',
                'alphagrant' : '#d22',
                'rico' : '#1bf',
                'gepart' : '#528',
                'gortaxi' : '#ff2',
                'autocars' : '#000',
                'transway' : '#f0f'
            }[data.vendors[route]] || '#ddd';
        },
        getSegmentOutlines : function(segmentId, data, state) {
            return null;
        }
    }
});