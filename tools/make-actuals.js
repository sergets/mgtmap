
var requirejs = require('requirejs'),
	vow = require('vow');

requirejs = requirejs.config({
    baseUrl : __dirname + '/../js',
    paths : {
        vow : '../node_modules/vow/vow.min'
    },
    nodeRequire : require
});

var state = {
    timeSettings : { 
        dow : ({ 6 : 32, 0 : 64 })[(new Date()).getDay()] || 1,
        fromHour : 7,
        toHour : 24,
        date : +new Date()
    },
    selectedRoutes : [],
    widthFactor : 1,
    isEqualWidthsMode : false,
    isAdminMode : false,
    isDebugMode : false,
    white : 0.7,
    customColoringId : 'default',
    isTouch : false,
    isNarrow : false
};

requirejs(['data/calc-actuals', 'utils/file'], function(calcActuals, fileUtils) {
	var fs = require('vow-fs');

	vow.all({ 
	    segments : fs.read('../data/segments.json').then(JSON.parse),
	    freqs : fs.read('../data/freqs.json').then(JSON.parse),
	    routes : fs.read('../data/routes.json').then(JSON.parse),
	    registry : fs.read('../data/rgam.json').then(JSON.parse),
	    trolleyWires : fs.read('../data/trolley-wire.json').then(JSON.parse)
	}).then(function(data) {
		return calcActuals(data, state, Object.keys(state), {}).then(function(actuals) {
			return fs.write('../actuals/' + fileUtils.getActualsFileNameByState(state, data.routes), JSON.stringify(actuals));
		});
	});

});