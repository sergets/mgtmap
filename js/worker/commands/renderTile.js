define([
	'utils/extend',
    'worker/getTilePixelLines',
    'worker/renderer/renderLine'
], function(
	extend,
    getTilePixelLines,
    renderLine
) {
	return function(params, key) {
		var res = [],
			x = params.x,
			y = params.y,
			z = params.z,
			routes = params.routes;
			styleOverride = params.style || {};

		return getTilePixelLines.call(this, x, y, z).then(function(tilePixelLines) {
			if(routes) {
				tilePixelLines = tilePixelLines.filter(function(line) {
					return routes.indexOf(line.data.route) != -1;
				});
			}

			tilePixelLines.forEach(function(line) {
				renderLine(res, extend({}, line, styleOverride));
			});
		
			return { result : res, key : key };
		});
	};
});
