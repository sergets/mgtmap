define([
    'ymaps',
    'utils/extend',
    'jquery'
], function(
    ymaps,
    extend,
    $
) {

ymaps.modules.define('worker-hotspot-source', [
    'event.Manager',
    'option.Manager',
    'util.defineClass'
], function(
    provide,
    EventManager,
    OptionManager,
    defineClass
) {
    provide(defineClass(
        function(worker) {
            this.events = new EventManager();
            this.options = new OptionManager();
            this._worker = worker;
            this._lastRequestCancelled = false;
        },
        {
            cancelLastRequest : function() {
                this._lastRequestCancelled = true;
            },

            requestObjects : function(layer, tileNumber, zoom, callback) {
                this._worker.command('renderHotspots', {
                    x : tileNumber[0],
                    y : tileNumber[1],
                    z : zoom
                }).done(function(result) {
                    this._lastRequestCancelled || callback(result.map(function(item) {
                        return new ymaps.hotspot.layer.Object(
                            new ymaps.shape[item.shape.type](new ymaps.geometry.pixel[item.shape.type](item.shape.pixelGeometry), item.shape.params),
                            item.feature,
                            item.options
                        );
                    }));
                    this._lastRequestCancelled = false;
                });
            }
        }   
    ));
});

});