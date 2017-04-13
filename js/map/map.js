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

    this._currentSegmentRoutes = null;

    dataManager.on('data-updated', function() {
        this.getMap().balloon.close();
    }, this);
    
    this._init();
};

extend(Map.prototype, eventsEmitter);

extend(Map.prototype, {
    _init : function() {
        var map = this._map,
            worker = this._worker,
            that = this;

        map.controls.add('rulerControl', { position : { left : 10, bottom : 35 } });
        map.panes.append('mgtmap', new (map.panes.get('places').constructor)(map, {
            zIndex : 200
        }));
        map.panes.append('white', new ymaps.pane.StaticPane(map, {
            css : {
                width: '100%',
                height: '100%',
                background: 'rgba(256, 256, 256, ' + (this._stateManager.getWhite() || 0.7) + ')'
            },
            zIndex : 150
        }));

        this._map.panes.get('mgtmap').getElement().style.transition = 'opacity .5s';
        ymaps.modules.require([
            'worker-canvas-layer',
            'worker-hotspot-source'
        ], function(
            WorkerCanvasLayer,
            WorkerHotspotSource
        ) {
            var rendererLayer = that._rendererLayer = new WorkerCanvasLayer(worker, null, {
                    tileTransparent : true,
                    pane : 'mgtmap'
                }),
                hotspotLayer = that._hotspotLayer = new ymaps.hotspot.Layer(new WorkerHotspotSource(worker)),
                selectionLayer = that._selectionLayer = new WorkerCanvasLayer(worker, '', {
                    tileTransparent : true,
                    pane : 'places'
                });

            map.layers.add(rendererLayer);
            map.layers.add(hotspotLayer);

            hotspotLayer.events.add('click', that._onHotspotClicked, that);
        });

        map.events.add('boundschange', this._onBoundsChanged, this);
        map.balloon.events.add('close', this._onBalloonClosed, this);
    },

    _onHotspotClicked : function(e) {
        var position = e.get('coords'),
            dataManager = this._dataManager,
            segmentId = e.get('activeObject').getProperties().segmentId;

        dataManager.getActualRoutesForSegment(segmentId).done(function(routes) {
            return vow.all(routes.reduce(function(res, i) {
                var routeName = i.replace(/^[<>]/g, '');
                res[routeName] = dataManager.getBusColor(routeName);
                return res;
            }, {})).done(function(colors) {
                this._map.balloon.open(position, segmentView(segmentId, routes, colors).outerHTML);
                this._onBalloonOpen(segmentId, routes);
            }, this);
        }, this);
    },

    _onBalloonOpen : function(segmentId, routes) {
        this._onBalloonClosed();
        this._map.panes.get('mgtmap').getElement().style.transition = 'opacity .5s'; // = this._placesPaneZIndex;
        this._map.panes.get('mgtmap').getElement().style.opacity = 0.2; // zIndex = this._whitePaneZIndex - 1;
        this._currentSegmentRoutes = routes
            .filter(function(route) { return route.indexOf('-') !== 0; })
            .map(function(route) { return route.replace(/^[<>]/, ''); });
        this._selectionLayer.setQuery(this._currentSegmentRoutes.join(';'));
        this._map.layers.add(this._selectionLayer);
    },

    _onBalloonClosed : function() {
        this._currentSegmentRoutes = null;
        this._map.layers.remove(this._selectionLayer);
        this._map.panes.get('mgtmap').getElement().style.transition = 'opacity 1s'; // = this._placesPaneZIndex;s
        this._map.panes.get('mgtmap').getElement().style.opacity = 1; // = this._placesPaneZIndex;
    },

    highlightRoute : function(route) {
        this._selectionLayer.setQuery(route);
    },

    unhighlightRoute : function() {
        this._selectionLayer.setQuery(this._currentSegmentRoutes.join(';'));
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