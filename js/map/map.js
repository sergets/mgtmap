define([
    'ymaps',
    'jquery',
    'vow',
    'utils/cache',
    'utils/events-emitter',
    'map/worker-canvas-layer',
    'map/worker-hotspot-source',
    'view/segment'
], function(
    ymaps,
    $,
    vow,
    Cache,
    eventsEmitter,
    _,
    _,
    segmentView
) {

var SNAP_DISTANCE = 25;

var Map = function(initialParams, dataManager, segmentFactory, stateManager, worker) {
    this._map = new ymaps.Map('map', $.extend({
        controls: ['zoomControl', 'geolocationControl']
    }, {
        bounds : initialParams.bounds
    }));

    this._worker = worker;
    this._coll = new ymaps.GeoObjectCollection();
    this._jcColl = new ymaps.GeoObjectCollection();
    this._junctions = {};
    this._visibleSegments = {};
    this._dataManager = dataManager;
    this._segmentFactory = segmentFactory;
    this._stateManager = stateManager;
    //this._junctionFactory = junctionFactory;
    this._geometryEditedSegments = {};
    this._white = +initialParams.white || 0.7;
    
    this._init();
};

$.extend(Map.prototype, eventsEmitter);

$.extend(Map.prototype, {
    _init : function() {
        var map = this._map,
            worker = this._worker,
            that = this;

        map.controls.add('rulerControl', { position : { left : 10, bottom : 35 } });
        map.panes.append('white', new ymaps.pane.StaticPane(map, {
            css : {
                width: '100%',
                height: '100%',
                background: 'rgba(256, 256, 256, ' + this._white + ')'
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

        this._coll.events.add('split', function(e) {
            var originalEvent = e.getSourceEvent().originalEvent;
            this.trigger('split-segment', { 
                segmentId : originalEvent.segmentId,
                vertexIndex : originalEvent.vertexIndex,
                geometry : originalEvent.geometry
            });
        }, this);
    },

    _onHotspotClicked : function(e) {
        var position = e.get('coords'),
            segmentId = e.get('activeObject').getProperties().segmentId;

        this._dataManager.getActualRoutesForSegment(segmentId).done(function(routes) {
            this._map.balloon.open(position, segmentView(segmentId, routes, this._stateManager.getCustomColoringId()).outerHTML);
        }, this);
    },
    
    _hideAllSegments : function() {
        Object.keys(this._visibleSegments).forEach(this._removeSegmentById, this);
    },

    _editorCorrector : function(coords, vertexIndex) {
        if(vertexIndex != 0 && vertexIndex != coords.length - 1) return vow.resolve(coords[vertexIndex]);

        var point = coords[vertexIndex]
            visibleSegments = this._visibleSegments;
            matchedJunctions = Object.keys(Object.keys(visibleSegments).reduce(function(jcs, segmentId) {
                var sCoords = visibleSegments[segmentId].geometry.getPixelGeometry().getCoordinates(),
                    start = sCoords[0],
                    end = sCoords[sCoords.length - 1];

                jcs[start.join()] = true;
                jcs[end.join()] = true;
                return jcs;
            }, {})).map(function(jc) {
                return jc.split(',');
            }).filter(function(jc) {
                return Math.sqrt((jc[0] - point[0]) * (jc[0] - point[0]) + (jc[1] - point[1]) * (jc[1] - point[1])) < SNAP_DISTANCE;
            });

        return vow.resolve(matchedJunctions[0] || coords[vertexIndex]);
    },

    _showSegments : function(segments, ids) {
        this._jcColl.removeAll();
        Object.keys(this._visibleSegments)
            .filter(function(id) {
                return ids.indexOf(+id) == -1;
            })
            .forEach(this._removeSegmentById, this);

        ids
            .filter(function(id) {
                return !this._visibleSegments[id]
            }, this)
            .forEach(function(id) {
                this._addSegment(id, segments[id]);
            }, this);

        /* Object.keys(this._junctions).forEach(function(key) {
          //if(this._junctions[key] && this._junctions[key].length) {
              var jc = this._createJunction(key.split(','));
              jc && this._jcColl.add(jc);
          //}
        }, this);*/
    },

    _removeSegmentById : function(id) {
        if(!this._geometryEditedSegments[id]) {
            this._segmentFactory.abort(id);
            this._coll.remove(this._visibleSegments[id]);
            //var coords = this._visibleSegments[id].geometry.getCoordinates();
            //this._junctions[coords[0].join()] = this._junctions[coords[0].join()].filter(function(js) { return js != id; });
            //this._junctions[coords[coords.length - 1].join()] = this._junctions[coords[coords.length - 1].join()].filter(function(js) { return js != -id; });
            delete this._visibleSegments[id];
        }
    },

    _addSegment : function(id, coords) {
        this._segmentFactory.createSegment(id, coords, this._map.getZoom()).done(function(segment) {
            /*(this._junctions[coords[0].join()] || (this._junctions[coords[0].join()] = [])).push(id);
            (this._junctions[coords[coords.length - 1].join()] || (this._junctions[coords[coords.length - 1].join()] = [])).push(-id);*/
            if(!this._visibleSegments[id]) {
                this._visibleSegments[id] = segment;
                this._coll.add(segment);
            }
        }, this);
    },

    toggleSegmentGeometryEditor : function(id) {
        this._geometryEditedSegments[id]?
            this._stopSegmentGeometryEditor(id) :
            this._startSegmentGeometryEditor(id);
    },

    _stopSegmentGeometryEditor : function(id) {
        var segment = this._visibleSegments[id];
        
        if(!segment) return;
        segment.editor.stopEditing();
        var geometry = segment.geometry.getCoordinates();
        if(JSON.stringify(geometry) != JSON.stringify(this._geometryEditedSegments[id])) {
            this.trigger('segment-geometry-changed', { segmentId : id, geometry : geometry });
        }
        delete this._geometryEditedSegments[id];
    },

    _startSegmentGeometryEditor : function(id) {
        var segment = this._visibleSegments[id];

        if(!segment) return;
        segment.options.set({
            editorDraggingCorrector : this._editorCorrector.bind(this),
            editorDrawingCorrector : this._editorCorrector.bind(this)
        });
        segment.editor.startEditing();
        this._geometryEditedSegments[id] = segment.geometry.getCoordinates();
    },

    _onBoundsChanged : function(e) {
        var map = this._map,
            oldZoom = e && e.get('oldZoom'),
            zoom = map.getZoom(),
            bounds = map.getBounds(),
            visibleSegmentsIds = [];

        this._dataManager.getSegmentBounds().then(function(segmentBoundsData) {
            segmentBoundsData.forEach(function(segment, i) {
                if(segment[0][0] < bounds[1][0] && bounds[0][0] < segment[1][0]) {
                    if(segment[0][1] < bounds[1][1] && bounds[0][1] < segment[1][1]) {
                        visibleSegmentsIds.push(i);
                    }
                }
            });

            if(oldZoom && (zoom != oldZoom)) {
                this._hideAllSegments();
            }
            return visibleSegmentsIds.length && visibleSegmentsIds.length < 4500?
                this._dataManager.getSegments() :
                vow.resolve({});
        }, this).done(function(segmentsData) {
            this._showSegments(segmentsData, visibleSegmentsIds);
        }, this);
        
        bounds[0][0] && this.trigger('bounds-changed', { bounds : bounds });
    },
    
    update : function() {
        //this._hideAllSegments();
        //this._onBoundsChanged();
    },
    
    getMap : function() {
        return this._map;
    }
});

return Map;

});