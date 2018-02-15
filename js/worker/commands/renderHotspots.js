define([
    'worker/getTilePixelLines',
    'worker/utils/tile-utils'
], function(
    getTilePixelLines,
    TileUtils
) {
    return function(params, key) {
        var res = [],
            x = params.x,
            y = params.y,
            z = params.z;

        return getTilePixelLines.call(this, x, y, z, 'hotspots').then(function(tilePixelLines) {
            tilePixelLines.forEach(function(line) {
                var lineCoords = line.coords;

                res.push({ 
                    shape : {
                        type : 'LineString',
                        pixelGeometry : line.coords.map(tilePixelsToGlobalPixels.bind(this, [x, y])),
                        params : { strokeWidth : line.width + this.state.isTouch? 10 : 0 }
                    },
                    feature : {
                        properties : {
                            segmentId : line.data.id
                        }
                    }
                });
            });
            
            return { result : res, key : key };
        });
    };

    function tilePixelsToGlobalPixels(tile, point) {
        return [point[0] + tile[0] * TileUtils.TILE_SIZE, point[1] + tile[1] * TileUtils.TILE_SIZE];
    }
});