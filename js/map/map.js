define([
    'ymaps',
    'utils/extend',
    'vow',
    'utils/cache',
    'utils/route',
    'worker/utils/tile-utils',
    'utils/events-emitter',
    'map/worker-canvas-layer',
    'map/worker-hotspot-source',
    'view/segment'
], function(
    ymaps,
    extend,
    vow,
    Cache,
    routeUtils,
    tileUtils,
    eventsEmitter,
    _,
    _,
    segmentView
) {

var ANIMATION_DURATION = 300,
    SELECTED_ROUTE_WIDTH = 10,
    OUTLINE_WIDTH = 3;

var Map = function(dataManager, stateManager, worker) {
    this._map = new ymaps.Map('map', extend({
        controls: ['zoomControl', 'geolocationControl'],
    }, {
        bounds : stateManager.getBounds()
    }), {
        suppressMapOpenBlock: true,
        yandexMapDisablePoiInteractivity: true
    });

    this._worker = worker;
    this._dataManager = dataManager;
    this._stateManager = stateManager;
    this._tileCaches = {};

    this._currentSegmentRoutes = null;

    this._selectionLayers = [];

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

        this._stateManager.isMobile() || map.controls.add('rulerControl', { position : { left : 10, bottom : 10 } });

        map.panes.append('mgtmap', new (map.panes.get('places').constructor)(map, {
            zIndex : 200
        }));
        map.panes.append('selection', new (map.panes.get('places').constructor)(map, {
            zIndex : 201
        }));
        map.panes.append('toponyms', new (map.panes.get('places').constructor)(map, {
            css : { opacity: 0.5 },
            zIndex : 202
        }));
        map.panes.append('white', new ymaps.pane.StaticPane(map, {
            css : {
                width: '100%',
                height: '100%',
                background: 'rgba(256, 256, 256, ' + (this._stateManager.getWhite() || 0.7) + ')'
            },
            zIndex : 150
        }));
        map.panes.append('background-html', new ymaps.pane.StaticPane(map, {
            css : {
                width: '100%',
                height: '100%'
            },
            zIndex : 300
        }));

        this._map.panes.get('mgtmap').getElement().style.transitionDuration = 'all ' + ANIMATION_DURATION/1000 + 's';
        ymaps.modules.require([
            'worker-canvas-layer',
            'worker-hotspot-source'
        ], function(
            WorkerCanvasLayer,
            WorkerHotspotSource
        ) {
            var rendererLayer = that._rendererLayer = new WorkerCanvasLayer(worker, null, that._tileCaches, {
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

        map.layers.add(new ymaps.Layer(
            'http://vec.maps.yandex.net/tiles?l=map&%c&scale={{ scale }}&lang=ru_RU&scale=1&geometry=0',
            { pane: 'toponyms', tileTransparent: true }
        ));
        map.events.add('boundschange', this._onBoundsChanged, this);
        map.balloon.events.add('close', this._onBalloonClosed, this);
    },

    _dimRendererLayer : function() {
        this._rendererLayer.getElement().style.opacity = 0.2;
    },

    _restoreRendererLayer : function() {
        this._rendererLayer.getElement().style.opacity = 1;
    },

    _getSelectionLayerDesc : function(query) {
        var layerDesc;

        this._selectionLayers.some(function(desc) {
            if (JSON.stringify(desc.query) == JSON.stringify(query)) {
                layerDesc = desc;
                return true;
            }
        });

        return layerDesc;
    },

    _showSelectionLayer : function(query) {
        this._dimRendererLayer();
        this._hideLastVisibleLayer();

        var layerDesc = this._getSelectionLayerDesc(query),
            selectionLayers = this._selectionLayers;

        if(layerDesc) {
            if(layerDesc.removingTimeout) {
                clearTimeout(layerDesc.removingTimeout);
                delete layerDesc.removingTimeout;
            }
            layerDesc.layer.getElement().style.opacity = 1;
            if(selectionLayers.indexOf(layerDesc) != selectionLayers.length - 1) {
                selectionLayers.splice(selectionLayers.indexOf(layerDesc), 1);
                selectionLayers.push(layerDesc);
            }
        }
        else {
            var that = this;

            ymaps.modules.require(['worker-canvas-layer'], function(WorkerCanvasLayer) {
                var layer = new WorkerCanvasLayer(that._worker, query, that._tileCaches, {
                    tileTransparent : true,
                    pane : 'selection'
                });

                that._map.layers.add(layer);
                layer.getElement().style.opacity = 0;
                layer.getElement().style.transition = 'opacity ease 0.3s';
                selectionLayers.push({
                    query : query,
                    layer : layer 
                });

                setTimeout(function() {
                    layer.getElement().style.opacity = 1;
                }, 10);
            });
        }
    },

    _removeSelectionLayer : function(query) {
        var map = this._map,
            selectionLayers = this._selectionLayers,
            layerDesc = this._getSelectionLayerDesc(query);

        if(layerDesc) {
            layerDesc.layer.getElement().style.opacity = 0;
            layerDesc.removingTimeout = setTimeout(function() {
                map.layers.remove(layerDesc.layer);
                selectionLayers.splice(selectionLayers.indexOf(layerDesc), 1);
            }, ANIMATION_DURATION);
        }

        this._showLastVisibleLayer();
    },

    _clearSelectionLayers : function() {            
        this._selectionLayers.filter(function(layerDesc) {
            return !layerDesc.removingTimeout;
        }).forEach(function(layerDesc) {
            this._removeSelectionLayer(layerDesc.query);
        }, this);
    },

    _hideLastVisibleLayer : function() {
        var visibleLayers = this._selectionLayers.filter(function(layerDesc) {
                return !layerDesc.removingTimeout;
            }),
            lastVisibleLayer = visibleLayers[visibleLayers.length - 1];

        if(lastVisibleLayer) {
            lastVisibleLayer.layer.getElement().style.opacity = 0;
        } 
    },

    _showLastVisibleLayer : function() {
        var visibleLayers = this._selectionLayers.filter(function(layerDesc) {
                return !layerDesc.removingTimeout;
            }),
            lastVisibleLayer = visibleLayers[visibleLayers.length - 1];

        if(lastVisibleLayer) {
            lastVisibleLayer.layer.getElement().style.opacity = 1;
        }
        else {
            this._restoreRendererLayer();
        }
    },

    _getIntersectionRoutes : function(segmentId) {
        return this._dataManager.getActualRoutesForSegment(segmentId).then(function(routes) {
            if(!this._currentSegmentRoutes || !routes) {
                return;
            }

            var currentSegmentRoutes = this._currentSegmentRoutes;               
                
            return routes.map(function(route) {
                var routeName = routeUtils.strip(route);
                return routeUtils.notPhantom(route) && currentSegmentRoutes.indexOf(routeName) !== -1 && routeName;
            }).filter(Boolean);
        }, this);
    },

    _onHotspotMouseover : function(e) {
        if(this._currentSegmentRoutes && !this._selectedRoute) {
            var segmentId = e.get('activeObject').getProperties().segmentId;

            this._getIntersectionRoutes(segmentId).done(function(routes) {
                if(routes && routes.length && routes.length < this._currentSegmentRoutes.length) { 
                    this.trigger('highlight-routes', { routes : routes });
                    this.highlightRoutes(routes);
                    this._routesHovered = true;
                }
            }, this);
        }
    },

    _onHotspotMouseout : function(e) {
        if(!this._selectedRoute && this._currentSegmentRoutes && this._routesHovered) {
            var segmentId = e.get('activeObject').getProperties().segmentId;

            this._getIntersectionRoutes(segmentId).done(function(routes) {
                if(routes) { 
                    this.trigger('unhighlight-routes', { routes : routes });
                    this.unhighlightRoutes(routes);
                    this._routesHovered = false;
                }
            }, this);
        }
    },

    _onHotspotClicked : function(e) {
        if(!this._selectedRoute) {
            var position = e.get('coords'),
                dataManager = this._dataManager,
                segmentId = e.get('activeObject').getProperties().segmentId;

            dataManager.getActualRoutesForSegment(segmentId).done(function(routes) {
                routes = routes.filter(routeUtils.notPhantom).map(routeUtils.strip);

                return vow.all(routes.reduce(function(res, routeName) {
                    res[routeName] = dataManager.getBusColor(routeName);
                    return res;
                }, {})).then(function(colors) {
                    this._map.balloon.open(position, segmentView(segmentId, routes, colors).outerHTML);
                    this._onBalloonOpen(segmentId, routes);
                }, function() {}, this);
            }, this);
        }
    },

    _onBalloonOpen : function(segmentId, routes) {
        this._currentSegmentRoutes = routes
            .filter(routeUtils.notPhantom)
            .map(routeUtils.strip);
        this._showSelectionLayer(this._currentSegmentRoutes.join(';'));
    },

    _onBalloonClosed : function(e) {
        this._clearSelectionLayers();
        this._currentSegmentRoutes = null;
    },

    closeBalloon : function() {
        this._map.balloon.close();
    },

    highlightRoutes : function(routes) {
        this._showSelectionLayer([routes.join(';')]);
    },

    unhighlightRoutes : function(routes) {
        this._removeSelectionLayer([routes.join(';')]);
    },

    showSelectedRoute : function(route) {
        this._dataManager.getRouteBounds(route).then(function(bounds) {
            this._selectedRoute = route;
            this._map.setBounds(bounds).then(function() {
                this._showSelectionLayer([route, JSON.stringify({ width: SELECTED_ROUTE_WIDTH, outlineWidth: OUTLINE_WIDTH })]);
            }, this);
        }, this);
    },

    hideSelectedRoute : function() {
        this._removeSelectionLayer([this._selectedRoute, JSON.stringify({ width: SELECTED_ROUTE_WIDTH, outlineWidth: OUTLINE_WIDTH })]);
        this._selectedRoute = null;
    },

    _onBoundsChanged : function(e) {
        var bounds = this._map.getBounds()

        bounds[0][0] && this.trigger('bounds-changed', { bounds : bounds });
    },
    
    getMap : function() {
        return this._map;
    },

    getBackgroundPane : function() {
        return this._map.panes.get('background-html').getElement();
    },
    
    getControlsPane : function() {
        return this._map.panes.get('controls').getElement();
    },

    setBounds : function(bounds) {
        return this._map.setBounds(bounds);
    }
});

return Map;

});