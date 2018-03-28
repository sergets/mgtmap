define(function() {
    var RADIUS = 6378137,
        E = 0.0818191908426,
        C_PI180 = Math.PI / 180,
        C_180PI = 180 / Math.PI,
        EPSILON = 1e-10;

    var e2 = E * E, e4 = e2 * e2, e6 = e4 * e2, e8 = e4 * e4,
        subradius = 1/RADIUS,
        d2 = e2 / 2 + 5 * e4 / 24 + e6 / 12 + 13 * e8 / 360,
        d4 = 7 * e4 / 48 + 29 * e6 / 240 + 811 * e8 / 11520,
        d6 = 7 * e6 / 120 + 81 * e8 / 1120,
        d8 = 4279 * e8 / 161280,
        equator = 2 * Math.PI * RADIUS,
        f = 1 - Math.sqrt(1 - e2),
        polarRadius = (1 - f) * RADIUS,
        subequator = 1 / equator,
        halfEquator = equator / 2;

    var currentZoom = 0,
        pixelsPerMeter = 256 * subequator;

    function cycleRestrict(value, min, max) {
        return value - Math.floor((value - min) / (max - min)) * (max - min);
    }

    function geoToMercator(geo) {
        var latitude = Math.max(Math.min(geo[1], 90 - EPSILON), -90 + EPSILON) * C_PI180,
            esinLat = E * Math.sin(latitude);

        return [
            RADIUS * cycleRestrict(geo[0] * C_PI180, -Math.PI, Math.PI),
            RADIUS * Math.log(Math.tan(Math.PI * 0.25 + latitude * 0.5) / Math.pow(Math.tan(Math.PI * 0.25 + Math.asin(esinLat) * 0.5), E))
        ];
    }

    function yToLatitude(y) {
        var xphi = Math.PI * 0.5 - 2 * Math.atan(1 / Math.exp(y * subradius)),
            latitude = xphi + d2 * Math.sin(2 * xphi) + d4 * Math.sin(4 * xphi) + d6 * Math.sin(6 * xphi) + d8 * Math.sin(8 * xphi);

        return latitude * C_180PI;
    }

    return {
        fromGlobalPixels: function(vector, zoom) {
            if (zoom != currentZoom) {
                pixelsPerMeter = Math.pow(2, zoom + 8) * subequator;
                currentZoom = zoom;
            }
            var longitude = cycleRestrict(Math.PI * vector[0] / Math.pow(2, zoom + 7) - Math.PI, -Math.PI, Math.PI) * C_180PI,
                latitude = yToLatitude(halfEquator - vector[1] / pixelsPerMeter);

            return [longitude, latitude];
        },

        toGlobalPixels: function(point, zoom) {
            if (zoom != currentZoom) {
                pixelsPerMeter = Math.pow(2, zoom + 8) * subequator;
                currentZoom = zoom;
            }

            var mercatorCoords = geoToMercator(point);
            return [
                (halfEquator + mercatorCoords[0]) * pixelsPerMeter,
                (halfEquator - mercatorCoords[1]) * pixelsPerMeter
            ];
        }
    };
});