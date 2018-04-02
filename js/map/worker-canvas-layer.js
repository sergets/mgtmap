define([
    'ymaps',
    'utils/cache'
], function(
    ymaps,
    Cache
) {

var TILE_SIZE = 256,
    CACHE_SIZE = 1000,
    NULL_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=';

ymaps.modules.define('worker-canvas-layer', [
    'util.imageLoader',
    'Layer',
    'util.defineClass'
], function(
    provide,
    imageLoader,
    Layer,
    defineClass
) {
    function createCanvas() {
        var canvas = document.createElement('canvas'),
            ctx = canvas.getContext("2d");

        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        ctx.lineJoin = 'round';

        return canvas;
    }

    var WorkerCanvasLayer = defineClass(
        function(worker, query, caches) {
            var layerId = Math.random(),
                tileCaches = this._tileCaches = caches;

            this._layerId = layerId;
            this._query = query;

            worker.on('updated', function() {
                this.update();
            }, this);

            var layerOptions = arguments[3] || {};
            layerOptions.imagePreprocessor = function(img, tileData) {
                var canvas = createCanvas(),
                    ctx = canvas.getContext('2d'),
                    query = this._query,
                    x = tileData.tileNumber[0],
                    y = tileData.tileNumber[1],
                    zoom = tileData.tileZoom,
                    deferred = ymaps.vow.defer();

                if (tileCaches[zoom] && tileCaches[zoom].has(x, y, JSON.stringify(query))) {
                    deferred.resolve(tileCaches[zoom].get(x, y, JSON.stringify(query)));
                } else {
                    worker.command('renderTile', {
                        x : x,
                        y : y,
                        z : zoom,
                        routes : query && query.routes,
                        style : query && query.style
                    }).done(function(result) {
                        ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
                        result.forEach(function(canvasCommand) {
                            if (canvasCommand.prop) {
                                ctx[canvasCommand.prop] = canvasCommand.val;
                            } else {
                                ctx[canvasCommand.cmd].apply(ctx, canvasCommand.args || []);
                            }
                        });
                        
                        (tileCaches[zoom] || (tileCaches[zoom] = new Cache(CACHE_SIZE))).set(x, y, JSON.stringify(query), canvas);

                        deferred.resolve(canvas);
                    });
                }

                return deferred.promise();
            }.bind(this);

            WorkerCanvasLayer.superclass.constructor.apply(
                this, [NULL_GIF, layerOptions].concat([].slice.call(arguments, 4))
            );
        },
        Layer,
        {
            update : function() {
                Object.keys(this._tileCaches).forEach(function(zoom) {
                    this._tileCaches[zoom].drop();
                }, this);
                WorkerCanvasLayer.superclass.update.apply(this, arguments);
            },

            setQuery : function(query) {
                this._query = query;
                this.update();
            }
        }
    );

    provide(WorkerCanvasLayer);
});

return;

});