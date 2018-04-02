define([
	'vow',
	'utils/extend',
    'worker/utils/tile-utils',
    'worker/renderer/renderer',
    'worker/renderer/renderLine'
], function(
	vow,
	extend,
    tileUtils,
    renderer,
    renderLine
) {
	return function(params, key) {
		var res = [],
			x = params.x,
			y = params.y,
			z = params.z,
			routes = params.routes,
			styleOverride = params.style || {};

		return vow.resolve(renderer.renderTile.call(this, x, y, z)).then(function(tilePixelLines) {
			if(routes) {
				tilePixelLines = tilePixelLines.filter(function(line) {
					return routes.indexOf(line.data.route) != -1;
				});
			}

			tilePixelLines.forEach(function(line) {
				renderLine(res, extend({}, line, styleOverride), x * tileUtils.TILE_SIZE, y * tileUtils.TILE_SIZE);
			});
		
			return { result : res, key : key };
		});
	};
});
