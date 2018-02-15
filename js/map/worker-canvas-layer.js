define([
    'ymaps',
    'utils/cache'
], function(
    ymaps,
    Cache
) {

var TILE_SIZE = 256,
    CACHE_SIZE = 1000;

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
    var WorkerCanvasLayer = defineClass(
        function(worker, query, caches) {
            var layerId = Math.random(),
                canvas = document.createElement('canvas'),
                ctx = canvas.getContext("2d"),
                tileCaches = this._tileCaches = caches;

            this._layerId = layerId;
            this._query = query;

            canvas.width = TILE_SIZE;
            canvas.height = TILE_SIZE;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            imageLoader.proxy.add({
                matchUrl : function(url) { return url.indexOf('worker:' + layerId + '?') != -1; },
                load : function(url, request) {
                    var params = url.substr(url.indexOf('?') + 1).split(','),
                        zoom = +params[2],
                        deferred = ymaps.vow.defer();

                    if (tileCaches[zoom] && tileCaches[zoom].get(params, query)) {
                        return ymaps.vow.resolve(tileCaches[zoom].get(params, query));
                    } else {
                        worker.command('renderTile', {
                            x : +params[0],
                            y : +params[1],
                            z : zoom,
                            routes : params[3] && params[3].split(';')
                        }).done(function(result) {
                            ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
                            result.forEach(function(canvasCommand) {
                                if (canvasCommand.prop) {
                                    ctx[canvasCommand.prop] = canvasCommand.val;
                                } else {
                                    ctx[canvasCommand.cmd].apply(ctx, canvasCommand.args || []);
                                }
                            });
                            var url = canvas.toDataURL();
                            (tileCaches[zoom] || (tileCaches[zoom] = new Cache(CACHE_SIZE))).set(params, query, url);
                            deferred.resolve(url);
                        });

                        return deferred.promise();
                    }
                }
            });

            worker.on('updated', function() {
                this.update();
            }, this);

            WorkerCanvasLayer.superclass.constructor.apply(
                this,
                [
                    'worker:' + layerId + '?' + ['%x', '%y', '%z'].concat(this._query || []).join(',')
                ].concat([].slice.call(arguments, 3))
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
                this.setTileUrlTemplate('worker:' + this._layerId + '?' + ['%x', '%y', '%z'].concat(this._query || []).join(','));
                this.update();
            }
        }
    );

    provide(WorkerCanvasLayer);
});

return;

});