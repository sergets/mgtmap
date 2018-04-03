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
    var MAX_PRERENDERABLE_ZOOM = 13;

    var dpi = window.devicePixelRatio || 1;

    function createCanvas() {
        var canvas = document.createElement('canvas'),
            ctx = canvas.getContext("2d");

        canvas.width = TILE_SIZE * dpi;
        canvas.height = TILE_SIZE * dpi;
        ctx.lineJoin = 'round';

        return canvas;
    }

    function loadImage(src) {
        var deferred = ymaps.vow.defer(),
            img = document.createElement('img');
                        
        img.onload = function() {
            deferred.resolve(img);
        };
        img.onerror = function() {
            deferred.reject();
        };
        img.setAttribute('src', src);

        return deferred.promise();
    }

    var WorkerCanvasLayer = defineClass(
        function(worker, query, caches, prerenderedStorageId) {
            var layerId = Math.random(),
                tileCaches = this._tileCaches = caches;

            this._layerId = layerId;
            this._query = query;
            this._prerenderedStorageId = prerenderedStorageId;

            worker.on('updated', function() {
                this.update();
            }, this);

            var layerOptions = arguments[4] || {};

            layerOptions.imagePreprocessor = function(img, tileData) {
                var query = this._query,
                    x = tileData.tileNumber[0],
                    y = tileData.tileNumber[1],
                    zoom = tileData.tileZoom,
                    deferred = ymaps.vow.defer();

                if (tileCaches[zoom] && tileCaches[zoom].has(x, y, JSON.stringify(query))) {
                    deferred.resolve(tileCaches[zoom].get(x, y, JSON.stringify(query)));
                } else {
                    (this._prerenderedStorageId && zoom <= MAX_PRERENDERABLE_ZOOM && (!query || !Object.keys(query).length)? 
                        loadImage('tiles/' + this._prerenderedStorageId + '/' + x + '_' + y + '_' + zoom + '@' + dpi + 'x.png') :
                        ymaps.vow.reject())
                    .fail(function() {
                        var canvasDeferred = ymaps.vow.defer(),
                            canvas = createCanvas(),
                            ctx = canvas.getContext('2d');

                        worker.command('renderTile', {
                            x : x,
                            y : y,
                            z : zoom,
                            devicePixelRatio : dpi,
                            routes : query && query.routes,
                            style : query && query.style
                        }).then(function(result) {
                            ctx.clearRect(0, 0, TILE_SIZE * dpi, TILE_SIZE * dpi);
                            result.forEach(function(canvasCommand) {
                                if (canvasCommand.prop) {
                                    ctx[canvasCommand.prop] = canvasCommand.val;
                                } else {
                                    ctx[canvasCommand.cmd].apply(ctx, canvasCommand.args || []);
                                }
                            });
                            canvasDeferred.resolve(canvas);
                        });

                        return canvasDeferred.promise();
                    })
                    .then(function(resImage) {
                        (tileCaches[zoom] || (tileCaches[zoom] = new Cache(CACHE_SIZE))).set(x, y, JSON.stringify(query), resImage);
                        deferred.resolve(resImage);
                    });
                }

                return deferred.promise();
            }.bind(this);

            WorkerCanvasLayer.superclass.constructor.apply(
                this, [NULL_GIF, layerOptions].concat([].slice.call(arguments, 5))
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
            },

            setPrerenderedStorageId : function(prerenderedStorageId) {
                this._prerenderedStorageId = prerenderedStorageId;
                this.update();
            }
        }
    );

    provide(WorkerCanvasLayer);
});

return;

});