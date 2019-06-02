
var requirejs = require('requirejs'),
	vow = require('vow'),
    vowFs = require('vow-fs'),
    fs = require('fs'),
    canvasLib = require('canvas');

requirejs = requirejs.config({
    baseUrl : __dirname + '/../js',
    paths : {
        vow : '../node_modules/vow/vow.min',
        flatbush : '../node_modules/flatbush/flatbush.min'
    },
    nodeRequire : require
});

var TILE_SIZE = 256,
    MIN_ZOOM = 9,
    MAX_PRERENDERABLE_ZOOM = 13;

var coloring = process.argv[2] || 'default';
var state = {
    timeSettings : {
        dow : process.argv[3] || 1,
        fromHour : 7,
        toHour : 24,
        date : +new Date()
    },
    selectedRoutes : [],
    widthFactor : 1,
    isEqualWidthsMode : false,
    isAdminMode : false,
    isDebugMode : false,
    white : 0.7,
    customColoringId : coloring,
    isTouch : false,
    isNarrow : false
};

requirejs([
    'flatbush',
    'data/calc-actuals',
    'utils/file',
    'worker/utils/tile-utils',
    'worker/commands/renderTile',
    'utils/geom'
], function(
    flatbush,
    calcActuals,
    fileUtils,
    tileUtils,
    renderTileCommand,
    geomUtils
) {
    console.log('Making tiles for ' + fileUtils.getActualsFileNameByState(state) + '...');

	vow.all({
	    segments : vowFs.read('data/segments.json').then(JSON.parse),
	    freqs : vowFs.read('data/freqs.json').then(JSON.parse),
	    routes : vowFs.read('data/routes.json').then(JSON.parse),
	    registry : vowFs.read('data/rgam.json').then(JSON.parse),
	    trolleyWires : vowFs.read('data/trolley-wire.json').then(JSON.parse)
	}).then(function(data) {
        console.log('Read data');
		return calcActuals(data, state, Object.keys(state), {}).then(function(actuals) {
            global.actuals = actuals;
            global.data = data;

            console.log('Generated actuals');

            var tree = global.tree = flatbush(data.segments.length),
                totalBounds = [[55.74, 37.55], [55.76, 37.65]];

            data.segments.forEach(function(segment, i) {
                var bounds = geomUtils.bounds(segment);

                if (i > 0) {
                    totalBounds[0][0] = Math.min(totalBounds[0][0], bounds[0][0]);
                    totalBounds[0][1] = Math.min(totalBounds[0][1], bounds[0][1]);
                    totalBounds[1][0] = Math.max(totalBounds[1][0], bounds[1][0]);
                    totalBounds[1][1] = Math.max(totalBounds[1][1], bounds[1][1]);
                }

                tree.add(bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]);
            });
            tree.finish();

            console.log('Built rtree');
            console.log('Total bounds', totalBounds);
            //console.log('Tile bounds', tileUtils.geoBoundsToTiles(totalBounds, 10));

            var dirname = 'tiles/' + fileUtils.getActualsFileNameByState(state, data.routes),
                resPromise = vow.resolve();

            vowFs.makeDir(dirname).then(function() {
                for(var z = MIN_ZOOM; z <= MAX_PRERENDERABLE_ZOOM; z++) {
                    var tileBounds = tileUtils.geoBoundsToTiles(totalBounds, z),
                        totalTiles = (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1),
                        i = 0;

                    resPromise = resPromise.then(function() {
                        i = 0;
                    });

                    console.log('Bounds for zoom ', z, ': ', tileBounds, ' - ', totalTiles, ' tiles');

                    for(var x = tileBounds.minX; x <= tileBounds.maxX; x++) {
                        for(var y = tileBounds.minY; y <= tileBounds.maxY; y++) {
                            resPromise = resPromise
                                .then(function(x, y, z, totalTiles) {
                                    return renderTileToFile(x, y, z, dirname + '/' + x + '_' + y + '_' + z + '@1x.png', 1).then(function() {
                                        if (Math.round(++i / (totalTiles / 100)) !== Math.round((i - 1) / (totalTiles / 100))) {
                                            if (Math.round(i / (totalTiles / 100)) % 10 === 0) {
                                                console.log(Math.round(i / (totalTiles / 100)) + '% (tile ' + i + ' of ' + totalTiles + ')');
                                            }
                                        }
                                    });
                                }.bind(this, x, y, z, totalTiles))
                                .then(function(x, y, z) {
                                    return renderTileToFile(x, y, z, dirname + '/' + x + '_' + y + '_' + z + '@2x.png', 2);
                                }.bind(this, x, y, z));
                        }
                    }

                }
            });
		}, function(err) {
            console.log('error calculating actuals', err);
        });
	}, function(err) {
        console.log('error reading data', err);
    }).then(function(res) { return res; }, function(err) { console.log(err); });

    ///

    function renderTileToFile(x, y, z, fileName, devicePixelRatio) {
        if(!devicePixelRatio) {
            devicePixelRatio = 1;
        }

        return renderTileCommand({ x : x, y : y, z : z, devicePixelRatio: devicePixelRatio }, '').then(function(res) {
            var deferred = vow.defer(),
                canvas = canvasLib.createCanvas(devicePixelRatio * TILE_SIZE, devicePixelRatio * TILE_SIZE),
                ctx = canvas.getContext('2d');

            res.result.forEach(function(canvasCommand) {
                if (canvasCommand.prop) {
                    ctx[canvasCommand.prop] = canvasCommand.val;
                } else {
                    ctx[canvasCommand.cmd] && ctx[canvasCommand.cmd].apply(ctx, canvasCommand.args || []);
                }
            });

            var stream = canvas.pngStream(),
                out = fs.createWriteStream(fileName);

            stream.on('data', function(chunk) {
                out.write(chunk);
            });

            stream.on('end', function() {
                // console.log('Tile ', x, y, z, '@' + devicePixelRatio, ' written to ', fileName);
                deferred.resolve();
            });

            return deferred.promise();
        });
    }
});