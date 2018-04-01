define([
    'vow',
    'worker/renderer/renderer',
    'worker/utils/tile-utils'
], function(
    vow,
    renderer,
    tileUtils
) {
    return function(params, key) {
        var res = [],
            x = params.x,
            y = params.y,
            z = params.z;

        return vow.resolve(renderer.renderHotspots(x, y, z)).then(function(tilePixelLines) {
            tilePixelLines.forEach(function(line) {
                var lineCoords = line.coords;

                res.push({ 
                    shape : {
                        type : 'LineString',
                        pixelGeometry : line.coords,
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
});