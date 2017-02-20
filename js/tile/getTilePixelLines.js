define([
    'tile/require-ymaps',
    'utils/bus-color',
    'utils/geom'
], function(
    requireYmaps,
    getBusColor,
    geomUtils
) {
	return function(x, y, z) {
		var global = this,
			cache = global.tilePixelLinesCache,
			cachedLines = global.tilePixelLinesCache.get(x, y, z);

		return new Promise(function(resolve) {
			if(cachedLines) {
				resolve(cachedLines);
				return;
			}

			requireYmaps([
				'projection.wgs84Mercator',
				'graphics.generator.stroke.outline'
			], function(
				projection,
				generator
			) {
				var res = [],
					zoomWidthFactor = getZoomFactor(z);

				var tilePixelLines = getObjectIdsByTile(projection, x, y, z, zoomWidthFactor * global.maxWidth).reduce(function(lines, id) {
					var segmentData = global.data.segments[id],
						segmentUnshiftedCoords = segmentData.map(function(geoPoint) {
							return geoPointToTilePixels(projection, geoPoint, x, y, z);
						});

					var routes = global.actualRoutes[id] || [],
						widths = global.actualWidths,
						totalWidth = routes.reduce(function(s, route) { return s + (widths[route.replace(/^[-<>]/, '')] || 0); }, 0) * zoomWidthFactor,
						curPosition = -totalWidth / 2;

					routes.forEach(function(route) {
						var width = widths[route.replace(/^[-<>]/, '')] * zoomWidthFactor || 0,
							direction,
							dashLines = [];

						curPosition += width/2;

						if(width == 0) { return; }

						switch(route[0]) {
							case '-':
								break;

							case '>':
								direction = 1;
							case '<':
								direction = direction || -1;

				                var arrowSteps = Math.max(Math.ceil(width / 2), 2);
           						for(var j = 1; j > 0; j -= 1/arrowSteps) {
           							dashLines.push({
           								width : j * width,
           								dashStyle : [width * (4 - j), width * (j + 0.5)],
           								dashOffset : direction == 1? 0 : -width * j
                    				});
           						}
		
							default:
								if(!dashLines.length) {
									dashLines = [{
										width : width,
										dashStyle : [],
										dashOffset : 0
									}];
								}

								var resPath = generator.sides(
									segmentUnshiftedCoords,
									Math.abs(curPosition)
								)[curPosition > 0? 'leftSide' : 'rightSide'];

								lines = lines.concat(dashLines.map(function(line) {
									return Object.assign({
										coords : geomUtils.cut(
											resPath,
											Math.abs(curPosition),
											Math.abs(curPosition)
										),
										color : getBusColor(route.replace(/^[-<>]/, ''), global.state.customColoringId),
										data : { id : id }
									}, line);
								}));
						}

						curPosition += width/2;
					})

					return lines;
				}, []);

				cache.set(x, y, z, tilePixelLines);
				resolve(tilePixelLines);
			});
		});
	};

    function getObjectIdsByTile(projection, x, y, z, margin) {
        var bounds = tileToGeoBounds(projection, x, y, z, margin);
    	return global.tree.search({
            minX : bounds[0][0],
            minY : bounds[0][1],
            maxX : bounds[1][0],
            maxY : bounds[1][1]
        }).map(function(item) {
        	return item.id;
        });
    }
});

var TILE_SIZE = 256;

function getZoomFactor(z) {
	return 1 / (z > 15? 0.5 : (16 - z));
}

function tileToGlobalPixelBounds(x, y, z) {
	var zf = TILE_SIZE;
	return [x * TILE_SIZE, y * TILE_SIZE, (x + 1) * TILE_SIZE, (y + 1) * TILE_SIZE];
}

function geoPointToTilePixels(projection, point, x, y, z) {
	var globalPixelPoint = projection.toGlobalPixels(point.slice().reverse(), z);
	return [globalPixelPoint[0] - (x * TILE_SIZE), globalPixelPoint[1] - (y * TILE_SIZE)];
}

function tileToGeoBounds(projection, x, y, z, margin) {
	margin = margin || 0;
	var globalPixelBounds = tileToGlobalPixelBounds(x, y, z);

	var res = [
		projection.fromGlobalPixels([globalPixelBounds[0] - margin, globalPixelBounds[3] + margin], z).reverse(), 
		projection.fromGlobalPixels([globalPixelBounds[2] + margin, globalPixelBounds[1] - margin], z).reverse()
	];
	return res;

}