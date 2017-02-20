define([
    'vow'
], function(
    vow
) {
    return {
        ymapsUtilsToJson : function(ymaps) {
            return new vow.Promise(function(resolve) {
                ymaps.modules.require([
                    'util.vector',
                    'util.math.restrict',
                    'util.math.cycleRestrict',
                    'projection.GeoToGlobalPixels',
                    'projection.Mercator',
                    'projection.wgs84Mercator',
                    'coordSystem.geo',
                    'graphics.generator.stroke.outline'
                ], function(
                    vector,
                    restrict,
                    cycleRestrict,
                    GeoToGlobalPixels,
                    Mercator,
                    wgs84Mercator,
                    geo,
                    generator
                ) {
                    resolve({
                        vector : Object.keys(vector).reduce(function(v, key) { v[key] = vector[key].toString(); return v; }, {}),
                        restrict : restrict.toString(),
                        cycleRestrict : cycleRestrict.toString(),
                        Mercator : Mercator.toString(),
                        geo : Object.keys(geo).reduce(function(v, key) { v[key] = geo[key].toString(); return v; }, {}),
                        GeoToGlobalPixels : GeoToGlobalPixels.toString(),
                        generator : generator.sides.toString()
                    });
                });
            });
        },
        
        jsonToYmapsUtils : function(utils) {
            var ymapsUtils = {};

            return (function() {
                ym = {
                    env : {
                        coordinatesOrder : 'lonlat',
                        debug : true
                    }
                };

                /*coordOrder = ym.env.coordinatesOrder;
                sign = function (x) {
                    return x < 0 ? -1 : (x > 0 ? 1 : 0); 
                };
                a = 6378137; // экваториальный радиус
                e2 = 0.00669437999014; // эксцентриситет в квадрате
                f = 1 - Math.sqrt(1 - e2); // сжатие
                b = (1 - f) * a; // полярный радиус
                eps = 1e-10; // Точность вычислений
                sqr = function (x) {
                    return x * x;
                };

                getReducedLatitude = function (lat) {
                    return Math.abs(lat - sign(lat) * Math.PI / 2) < eps ?
                    sign(lat) * Math.PI / 2 :
                        Math.atan((1 - f) * Math.tan(lat));

                };

                swapCoords = function (point) {
                    return [point[1], point[0]];
                };

                cutLat = function (lat) {
                    return Math.max(Math.min(lat, 89.999), -89.999);
                };*/
                
                vectorMath = prototypeToFunction(utils.vector),
                vector = vectorMath,
                restrict = stringToFunction(utils.restrict),
                cycleRestrict = stringToFunction(utils.cycleRestrict),
                Mercator = stringToFunction(utils.Mercator),
                geo = prototypeToFunction(utils.geo),
                GeoToGlobalPixels = stringToFunction(utils.GeoToGlobalPixels),
                generator = stringToFunction(utils.generator);

                return {
                    projection : new GeoToGlobalPixels({ coordinatesOrder: 'lonlat' }),
                    offsetGenerator : generator
                };
            })();
        }
    };
});

function stringToFunction(str) {
    return new Function('return (' + str + ').apply(this, arguments)'); 
}

function prototypeToFunction(obj) {
    return Object.keys(obj).reduce(function(v, key) { v[key] = stringToFunction(obj[key]); return v; }, {})
}
