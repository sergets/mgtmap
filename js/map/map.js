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

var ANIMATION_DURATION = 300;

var Map = function(dataManager, stateManager, worker) {
    this._map = new ymaps.Map('map', extend({
        controls: ['zoomControl', 'geolocationControl'],
    }, {
        bounds : stateManager.getBounds()
    }, {
        suppressMapOpenBlock : true
    }));

    this._worker = worker;
    this._dataManager = dataManager;
    this._stateManager = stateManager;
    
    this._selectionLayer = null;
    this._pendingSelectionLayer = null;

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

        this._stateManager.isMobile() || map.controls.add('rulerControl', { position : { left : 10, bottom : 35 } });
        map.panes.append('mgtmap', new (map.panes.get('places').constructor)(map, {
            zIndex : 200
        }));
        map.panes.append('selection', new (map.panes.get('places').constructor)(map, {
            zIndex : 201
        }));
        map.panes.append('white', new ymaps.pane.StaticPane(map, {
            css : {
                width: '100%',
                height: '100%',
                background: 'rgba(256, 256, 256, ' + (this._stateManager.getWhite() || 0.7) + ')'
            },
            zIndex : 150
        }));

        this._map.panes.get('mgtmap').getElement().style.transitionDuration = 'all ' + ANIMATION_DURATION/1000 + 's';
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
                hotspotLayer = that._hotspotLayer = new ymaps.hotspot.Layer(new WorkerHotspotSource(worker));

            map.layers.add(rendererLayer);
            map.layers.add(hotspotLayer);

            hotspotLayer.events.add('click', that._onHotspotClicked, that);
            hotspotLayer.events.add('mouseenter', that._onHotspotMouseover, that);
            hotspotLayer.events.add('mouseleave', that._onHotspotMouseout, that);
        });

        map.events.add('boundschange', this._onBoundsChanged, this);
        map.balloon.events.add('close', this._onBalloonClosed, this);
    },

    _createSelectionLayer : function(query, onReady) {
        var that = this;

        ymaps.modules.require(['worker-canvas-layer'], function(WorkerCanvasLayer) {
            if(that._pendingSelectionLayer) {
                that._pendingSelectionLayer.events.remove('ready');
                that._map.layers.remove(that._pendingSelectionLayer);
                that._pendingSelectionLayer = null;
            }
            var newSelectionLayer = that._pendingSelectionLayer = new WorkerCanvasLayer(that._worker, query, {
                    tileTransparent : true,
                    pane : 'selection'
                });

            newSelectionLayer.events.once('ready', function() {
                that._pendingSelectionLayer = null;
                var oldSelectionLayer = that._selectionLayer;

                that._selectionLayer = newSelectionLayer;
                newSelectionLayer.getElement().style.opacity = 1;
                if(oldSelectionLayer) {
                    oldSelectionLayer.getElement().style.opacity = 0;
                    setTimeout(function() {
                        that._map.layers.remove(oldSelectionLayer);
                    }, ANIMATION_DURATION);
                }
                onReady && onReady();
            });

            that._map.layers.add(newSelectionLayer);

            var layerElem = newSelectionLayer.getElement();

            layerElem.style.transition = 'all ' + ANIMATION_DURATION/1000 + 's';
            layerElem.style.opacity = 0;
        });
    },

    _removeSelectionLayer : function() {
        var that = this,
            oldSelectionLayer = this._selectionLayer;

        if(that._pendingSelectionLayer) {
            that._pendingSelectionLayer.events.remove('ready');
            that._map.layers.remove(that._pendingSelectionLayer);
            that._pendingSelectionLayer = null;
        }

        this._selectionLayer = null;

        if(oldSelectionLayer) {
            oldSelectionLayer.getElement().style.opacity = 0;
            setTimeout(function() {
                that._map.layers.remove(oldSelectionLayer);
            }, ANIMATION_DURATION);
        }
    },

    _onHotspotMouseover : function(e) {
        if(this._currentSegmentRoutes) {
            var segmentId = e.get('activeObject').getProperties().segmentId;

            this._dataManager.getActualRoutesForSegment(segmentId).done(function(routes) {
                if(!this._currentSegmentRoutes || !routes) {
                    return;
                }

                var currentSegmentRoutes = this._currentSegmentRoutes,               
                    routesToHighlight = routes.map(function(route) {
                        var routeName = route.replace(/^[<>]/, '');
                        return currentSegmentRoutes.indexOf(routeName) !== -1 && routeName;
                    }).filter(Boolean)

                if(routesToHighlight.length) { 
                    this.trigger('highlight-routes', { routes : routesToHighlight });
                    this.highlightRoutes(routesToHighlight);
                    this._routesHovered = true;
                }
            }, this);
        }
    },

    _onHotspotMouseout : function(e) {
        if(!this._currentSegmentRoutes || !this._routesHovered) {
            return;
        }

        this.trigger('unhighlight-routes');
        this.unhighlightRoutes();
        this._routesHovered = false;
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
            }, function() {}, this);
        }, this);
    },

    _onBalloonOpen : function(segmentId, routes) {
        var pane = this._map.panes.get('mgtmap').getElement();

        this._onBalloonClosed();

        this._currentSegmentRoutes = routes
            .filter(function(route) { return route.indexOf('-') !== 0; })
            .map(function(route) { return route.replace(/^[<>]/, ''); });
        this._createSelectionLayer(this._currentSegmentRoutes.join(';'), function() {
            //pane.style.transition = 'opacity .3s';
            pane.style.opacity = 0.2;
        });
    },

    _onBalloonClosed : function() {
        var pane = this._map.panes.get('mgtmap').getElement();

        this._currentSegmentRoutes = null;
        this._removeSelectionLayer();
        setTimeout(function() {
            pane.style.opacity = 1;
        });
    },

    highlightRoutes : function(routes) {
        this._createSelectionLayer(routes.join(';'));
    },

    unhighlightRoutes : function() {
        this._createSelectionLayer(this._currentSegmentRoutes.join(';'));
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