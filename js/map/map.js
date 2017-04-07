define([
    'ymaps',
    'utils/extend',
    'vow',
    'utils/cache',
    'utils/events-emitter',
    'map/worker-canvas-layer',
    'map/worker-hotspot-source',
    'view/segment'
], function(
    ymaps,
    extend,
    vow,
    Cache,
    eventsEmitter,
    _,
    _,
    segmentView
) {

var Map = function(dataManager, stateManager, worker) {
    this._map = new ymaps.Map('map', extend({
        controls: ['zoomControl', 'geolocationControl']
    }, {
        bounds : stateManager.getBounds()
    }));

    this._worker = worker;
    this._dataManager = dataManager;
    this._stateManager = stateManager;
    
    this._init();
};

extend(Map.prototype, eventsEmitter);

extend(Map.prototype, {
    _init : function() {
        var map = this._map,
            worker = this._worker,
            that = this;

        map.controls.add('rulerControl', { position : { left : 10, bottom : 35 } });
        map.panes.append('white', new ymaps.pane.StaticPane(map, {
            css : {
                width: '100%',
                height: '100%',
                background: 'rgba(256, 256, 256, ' + (this._stateManager.getWhite() || 0.7) + ')'
            },
            zIndex : 150
        }));
        
        ymaps.modules.require([
            'worker-canvas-layer',
            'worker-hotspot-source'
        ], function(
            WorkerCanvasLayer,
            WorkerHotspotSource
        ) {
            var rendererLayer = new WorkerCanvasLayer(worker, {
                    tileTransparent : true,
                    pane : 'places'
                }),
                hotspotLayer = new ymaps.hotspot.Layer(new WorkerHotspotSource(worker));

            map.layers.add(rendererLayer);
            map.layers.add(hotspotLayer);

            hotspotLayer.events.add('click', that._onHotspotClicked, that);
        });

        map.events.add('boundschange', this._onBoundsChanged, this);
    },

    _onHotspotClicked : function(e) {
        var position = e.get('coords'),
            segmentId = e.get('activeObject').getProperties().segmentId;

        this._dataManager.getActualRoutesForSegment(segmentId).done(function(routes) {
            this._map.balloon.open(position, segmentView(segmentId, routes, this._stateManager.getCustomColoringId()).outerHTML);
        }, this);
    },

    _onBoundsChanged : function(e) {
        var bounds = this._map.getBounds()

        bounds[0][0] && this.trigger('bounds-changed', { bounds : bounds });
    },
    
    getMap : function() {
        return this._map;
    }
});

return Map;

});