define([
    'ymaps',
    'utils/cache'
], function(
    ymaps,
    Cache
) {

var TILE_SIZE = 256,
    CACHE_SIZE = 100;

ymaps.modules.define('worker-object-manager', [
    'RemoteObjectManager',
    'util.defineClass'
], function(
    provide,
    RemoteObjectManager,
    defineClass
) {
    var WorkerObjectManager = defineClass(
        function(worker, command) {
            var objectManagerId = ('_worker_object_manager_' + Math.random()).replace('.', '');
                tileCaches = this._tileCaches = {};

            this._objectManagerId = objectManagerId;
            this._worker = worker;
            this._command = command;

            worker.on('updated', function() {
               // this.update();
            }, this);

            WorkerObjectManager.superclass.constructor.apply(
                this,
                [
                    '',
                    {
                        paddingTemplate : this._objectManagerId + '_tileCallback_%c',
                        splitRequests : true
                    }

                ].concat([].slice.call(arguments, 2))
            );

            window[this._objectManagerId + '_renderTile'] = this._renderTile.bind(this);
        },
        RemoteObjectManager,
        {
            getTileUrl : function(params) {
                var x = params.tileNumber[0],
                    y = params.tileNumber[1],
                    z = params.zoom;

                return window.URL.createObjectURL(new Blob([`
                    ${this._objectManagerId}_renderTile(${x}, ${y}, ${z}, function(error, data) {
                        ${this._objectManagerId}_tileCallback_x_${x}_y_${y}_z_${z}({
                            error : error,
                            data : data
                        });
                    })
                `], { type : 'text/javascript' })) + '#';
                /*
                    testTestTest_x_${x}_y_${y}_z_${z}({
                        // Ответ содержит поля error и data. В случае ошибки в поле error
                        // пишется код ошибки или ее описание.
                        error: null,
                        data: {
                            type: 'FeatureCollection',
                            features: [
                                 {
                                     type: 'Feature',
                                     geometry: {
                                         type: 'Point',
                                         coordinates: [55.5, 37.5]
                                     },
                                     id: 23,
                                     properties: {
                                         balloonContent: 'Содержимое балуна метки',
                                         iconContent: 'Содержимое метки'
                                     },
                                     options: {
                                         preset: 'islands#yellowIcon'
                                     }
                                 }
                            ]
                        }
                    });
                `], { type: 'text/javascript' })) + '#';*/
            },

           /* setQuery : function(query) {
                this._query = query;
                this.update();
            },*/

            _renderTile : function(x, y, z, callback) {
                if (tileCaches[z] && tileCaches[z].get({ x : x, y : y, z : z })) {
                    callback(null, tileCaches[z].get({ x : x, y : y, z : z }));
                } else {
                    this._worker.command(this._command, { x : x, y : y, z : z }).done(
                        function(result) {
                            (tileCaches[z] || (tileCaches[z] = new Cache(CACHE_SIZE))).set({ x : x, y : y, z : z }, result);
                            callback(null, tileCaches[z].get({ x : x, y : y, z : z }));
                        },
                        function(err) {
                            callback(err, null);
                        }
                    );
                }
            }
        }
    );

    provide(WorkerObjectManager);
});

return;

});