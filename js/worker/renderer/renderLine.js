define(function() {
	var ARROW_GAP = 8,
		ARROW_LENGTH = 1.5,
		ARROW_WIDTH = 3;

	var renderLine = function(params) {
		var res = [],
			coords = params.coords,
			width = params.width,
			color = params.color;

		if (params.arrowDirection) {
			var arrowLength = params.arrowLength || ARROW_LENGTH,
				arrowWidth = params.arrowWidth || ARROW_WIDTH,
				arrowGap = params.arrowGap || ARROW_GAP,
				arrowSteps = Math.max(Math.ceil(arrowWidth * params.width / 2), 2);

			res.push.apply(res, renderLine({ coords : coords, width : width, color : color }));
			for (var j = arrowWidth; j > 0; j -= 1/arrowSteps) {
				res.push.apply(res, renderLine({
					coords : coords,
					width : j * width,
					color : color,
					lineCap : 'butt',
					dashStyle : [width * (arrowLength * (arrowWidth - j)), width * (arrowLength * j + arrowGap)],
					dashOffset : params.arrowDirection == 1? width * (arrowGap/2) :  - width * (j * arrowLength + arrowGap/2)
				}));
			}
		} else {
			res.push(
				{ cmd : 'beginPath' },
				{ cmd : 'moveTo', args : coords[0] }
			);
			coords.slice(1).forEach(function(pnt) {
				res.push({ cmd : 'lineTo', args : pnt });
			});
			res.push(
				{ prop : 'strokeStyle', val : color },
				{ prop : 'lineWidth', val : width }
			);
			res.push({ prop : 'lineCap', val : params.lineCap || 'round' });
			if(params.dashStyle) {
				res.push(
					{ prop : 'lineDashOffset', val : params.dashOffset || 0 },
					{ cmd : 'setLineDash', args : [params.dashStyle] }
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
