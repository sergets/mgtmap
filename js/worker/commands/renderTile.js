define([
    'worker/getTilePixelLines'
], function(
    getTilePixelLines
) {
	return function(params, key) {
		var res = [],
			x = params.x,
			y = params.y,
			z = params.z,
			routes = params.routes;

		return getTilePixelLines.call(this, x, y, z).then(function(tilePixelLines) {
			tilePixelLines
				.filter(function(line) {
					return !routes || routes.indexOf(line.data.route) !== -1;
				})
				.forEach(function(line) {
					var lineCoords = line.coords;

					res.push({ cmd : 'beginPath' });
					res.push({ cmd : 'moveTo', args : lineCoords[0] });
					lineCoords.slice(1).forEach(function(pnt) {
						res.push({ cmd : 'lineTo', args : pnt });
					});
					res.push({ prop : 'strokeStyle', val : line.color });
					res.push({ prop : 'lineWidth', val : line.width });
					res.push({ prop : 'lineDashOffset', val : line.dashOffset || 0 });
					res.push({ cmd : 'setLineDash', args : [line.dashStyle] });
					res.push({ cmd : 'stroke' });
				});
		
			return { result : res, key : key };
		});
	};
});