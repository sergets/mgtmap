define([
    'utils/geom',
    'utils/wgs-84'
], function(
    geomUtils,
    projection
) {
	var TILE_SIZE = 256;

	return {
		TILE_SIZE: TILE_SIZE,

		getSegmentIdsByTile : function(x, y, z, margin) {
	        var bounds = this.tileToGeoBounds(x, y, z, margin);

	    	return global.tree.search(bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]);
	    },

	    offsetLine : function(sourceCoords, offset) {
			return geomUtils.offsetLine(sourceCoords, offset);
		},

		getZoomFactor : function(z) {
			return 1 / (z > 15? 0.5 : (16 - z));
		},

		tileToGlobalPixelBounds : function(x, y, z) {
			var zf = TILE_SIZE;
			return [x * TILE_SIZE, y * TILE_SIZE, (x + 1) * TILE_SIZE, (y + 1) * TILE_SIZE];
		},

		geoPointToTilePixels : function(point, x, y, z) {
			var globalPixelPoint = projection.toGlobalPixels(point.slice().reverse(), z);
			return [globalPixelPoint[0] - (x * TILE_SIZE), globalPixelPoint[1] - (y * TILE_SIZE)];
		},

		tilePixelsToGeoPoint : function(point, x, y, z) {
			var globalPixelPoint = [point[0] + (x * TILE_SIZE), point[1] + (y * TILE_SIZE)];
			return projection.fromGlobalPixels(globalPixelPoint, z).reverse();
		},

		tileToGeoBounds : function(x, y, z, margin) {
			margin = margin || 0;
			var globalPixelBounds = this.tileToGlobalPixelBounds(x, y, z);

			var res = [
				projection.fromGlobalPixels([globalPixelBounds[0] - margin, globalPixelBounds[3] + margin], z).reverse(), 
				projection.fromGlobalPixels([globalPixelBounds[2] + margin, globalPixelBounds[1] - margin], z).reverse()
			];
			return res;
		},

		geoBoundsToTiles : function(bounds, zoom) {
			var globalPixelBounds = [
				projection.toGlobalPixels([bounds[0][1], bounds[0][0]], zoom),
				projection.toGlobalPixels([bounds[1][1], bounds[1][0]], zoom)
			];

			return {
				minX : Math.floor(globalPixelBounds[0][0] / TILE_SIZE),
				maxY : Math.floor(globalPixelBounds[0][1] / TILE_SIZE),
				maxX : Math.floor(globalPixelBounds[1][0] / TILE_SIZE),
				minY : Math.floor(globalPixelBounds[1][1] / TILE_SIZE)
			};
		},
	};
});


