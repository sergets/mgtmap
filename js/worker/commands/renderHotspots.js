define([
    'worker/getTilePixelLines'
], function(
    getTilePixelLines
) {
    return function(params, key) {
        var res = [],
            x = params.x,
            y = params.y,
            z = params.z;

        return getTilePixelLines.call(this, x, y, z).then(function(tilePixelLines) {
            tilePixelLines.forEach(function(line) {
                var lineCoords = line.coords;

                res.push({ 
                    shape : {
                        type : 'LineString',
                        pixelGeometry : line.coords.map(tilePixelsToGlobalPixels.bind(this, [x, y])),
                        params : { strokeWidth : line.width }
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
});

function tilePixelsToGlobalPixels(tile, point) {
    return [point[0] + tile[0] * TILE_SIZE, point[1] + tile[1] * TILE_SIZE];
}