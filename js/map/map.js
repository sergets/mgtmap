define([
    'ymaps',
    'jquery',
    'vow',
    'utils/events-emitter'
], function(
    ymaps,
    $,
    vow,
    eventsEmitter
) {

var Map = function(initialBounds, dataManager, segmentFactory, junctionFactory) {
    this._map = new ymaps.Map('map', $.extend({
        controls: ['zoomControl', 'geolocationControl']
    }, {
        bounds : initialBounds
    }));
    this._coll = new ymaps.GeoObjectCollection();
    this._jcColl = new ymaps.GeoObjectCollection();
    this._junctions = {};
    this._visibleSegments = {};
    this._dataManager = dataManager;
    this._segmentFactory = segmentFactory;
    this._junctionFactory = junctionFactory;
    
    this._init();
};

$.extend(Map.prototype, eventsEmitter);

$.extend(Map.prototype, {
    _init : function() {
        this._map.layers.add(new ymaps.Layer(
            'data:image/svg+xml,' + encodeURIComponent(
                '<?xml version="1.0" encoding="utf-8"?>' + 
                '<svg version="1.0" xmlns="http://www.w3.org/2000/svg" height="256" width="256">' + 
                    '<rect x="0" y="0" width="256" height="256" fill="white" opacity="0.7"/>' +
                '</svg>'
            ),
            { tileTransparent : true }
        ));

        this._map.events.add('boundschange', this._onBoundsChanged, this);
        this._map.geoObjects.add(this._coll);
        this._map.geoObjects.add(this._jcColl);

        this._onBoundsChanged();
    },
    
    _hideAllSegments : function() {
        this._segmentFactory.abortAll();
        this._coll.removeAll();
        this._junctions = {};
        this._visibleSegments = {};
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
        this._segmentFactory.abort(id);
        this._coll.remove(this._visibleSegments[id]);
        var coords = this._visibleSegments[id].geometry.getCoordinates();
        //this._junctions[coords[0].join()] = this._junctions[coords[0].join()].filter(function(js) { return js != id; });
        //this._junctions[coords[coords.length - 1].join()] = this._junctions[coords[coords.length - 1].join()].filter(function(js) { return js != -id; });
        delete this._visibleSegments[id];
    },

    _addSegment : function(id, coords) {
        this._segmentFactory.createSegment(id, coords, this._map.getZoom()).done(function(segment) {
            /*(this._junctions[coords[0].join()] || (this._junctions[coords[0].join()] = [])).push(id);
            (this._junctions[coords[coords.length - 1].join()] || (this._junctions[coords[coords.length - 1].join()] = [])).push(-id);*/
            this._visibleSegments[id] = segment;
            this._coll.add(segment);
        }, this);
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
        this._hideAllSegments();
        this._onBoundsChanged();
    },
    
    getMap : function() {
        return this._map;
    }
});

return Map;

});