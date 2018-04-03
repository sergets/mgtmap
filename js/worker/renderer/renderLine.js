define(function() {
	var ARROW_GAP = 4,
		ARROW_LENGTH = 1.5,
		ARROW_WIDTH = 3;

	var renderLine = function(res, params, offsetX, offsetY, devicePixelRatio) {
		var	coords = params.coords,
			width = params.width,
			color = params.color,
			outlineColor = params.outlineColor,
			outlineWidth = params.outlineWidth;

		devicePixelRatio = devicePixelRatio || 1;

		if (outlineWidth && outlineColor) {
			res.unshift.apply(res, 
				[
					{ cmd : 'beginPath' },
					{
						 cmd : 'moveTo',
						 args : [
						 	(coords[0][0] - offsetX) * devicePixelRatio,
						 	(coords[0][1] - offsetY) * devicePixelRatio
					 	]
				 	}
				]
				.concat(coords.slice(1).map(function(pnt) {
					return {
						cmd : 'lineTo', 
						args : [
							(pnt[0] - offsetX) * devicePixelRatio,
							(pnt[1] - offsetY) * devicePixelRatio
						]
					};
				}))
				.concat([
					{ prop : 'strokeStyle', val : outlineColor },
					{ prop : 'lineWidth', val : (width + 2 * outlineWidth) * devicePixelRatio },
					{ prop : 'lineCap', val : 'butt' },
					{ cmd : 'stroke' }
				])
			);
		}

		if (params.arrowDirection) {
			var arrowLength = params.arrowLength || ARROW_LENGTH,
				arrowWidth = params.arrowWidth || ARROW_WIDTH,
				arrowGap = params.arrowGap || ARROW_GAP,
				arrowSteps = Math.max(Math.ceil(arrowWidth * params.width / 2), 2);

			renderLine(res, { coords : coords, width : width, color : color }, offsetX, offsetY, devicePixelRatio);
			for (var j = arrowWidth; j > 0; j -= 1/arrowSteps) {
				renderLine(res, {
					coords : coords,
					width : j * width,
					color : color,
					lineCap : 'butt',
					dashStyle : [width * (arrowLength * (arrowWidth - j)), width * (arrowLength * j + arrowGap)],
					dashOffset : params.arrowDirection == 1? width * (arrowGap/2) :  - width * (j * arrowLength + arrowGap/2)
				}, offsetX, offsetY, devicePixelRatio);
			}
		} else if (width > 0) {
			res.push(
				{ cmd : 'beginPath' },
				{
					 cmd : 'moveTo',
					 args : [
					 	(coords[0][0] - offsetX) * devicePixelRatio,
					 	(coords[0][1] - offsetY) * devicePixelRatio
				 	]
			 	}
			);
			coords.slice(1).forEach(function(pnt) {
				res.push({
					cmd : 'lineTo', 
					args : [
						(pnt[0] - offsetX) * devicePixelRatio,
						(pnt[1] - offsetY) * devicePixelRatio
					]
				});
			});
			res.push(
				{ prop : 'strokeStyle', val : color },
				{ prop : 'lineWidth', val : width * devicePixelRatio }
			);
			res.push({ prop : 'lineCap', val : params.lineCap || 'round' });
			if(params.dashStyle) {
				res.push(
					{ prop : 'lineDashOffset', val : params.dashOffset? params.dashOffset * devicePixelRatio : 0 },
					{ cmd : 'setLineDash', args : [params.dashStyle && params.dashStyle.map(function(dash) { return dash * devicePixelRatio })] }
				);
			} else {
				res.push({ cmd : 'setLineDash', args : [[]] });
			}
			res.push({ cmd : 'stroke' });
		}

		return res;
	};

	return renderLine;
});
