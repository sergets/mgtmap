define([
    'ymaps',
    'vow',
    'utils/geom',
    'utils/date',
    'utils/bus-color',
    'segment/balloon-content-layout'
], function(
    ymaps,
    vow,
    geomUtils,
    dateUtils,
    getBusColor,
    BalloonContentLayout
) {

var SegmentFactory = function(dataManager, stateManager) {
    this._dataManager = dataManager;
    this._stateManager = stateManager;
    this._balloonContentLayout = BalloonContentLayout.create(stateManager.isAdminMode(), stateManager.getCustomColoringId());
    this._pendingDeferreds = {};
};

$.extend(SegmentFactory.prototype, {
    createSegment : function(id, coords, zoom) {
        var deferred = this._pendingDeferreds[id] = vow.defer(),
            customColoringId = this._stateManager.getCustomColoringId();
        
        vow.all([
            this._dataManager.getRoutesForSegment(id),
            this._dataManager.getActualRoutesForSegment(id)
        ])
            .spread(function(allRoutesForSegment, actualRoutesForSegment) {
                return vow.all(actualRoutesForSegment.map(function(route) {
                    var color,
                        direction = 0;

                    if(route.indexOf('>') === 0) {
                        direction = 1;
                        route = route.substr(1);
                    }
                    if(route.indexOf('<') === 0) {
                        direction = -1;
                        route = route.substr(1);
                    }
                    if(route.indexOf('-') === 0) {
                        color = 'ffffff00';
                        route = route.substr(1);
                    } else {
                        color = getBusColor(route, customColoringId);
                    }
                    return this._dataManager.getActualWidthForRoute(route).then(function(width) {
                        return {
                            color : color,
                            direction : direction,
                            width : width,
                            diffState : 0
                        };
                    });
                }, this)).then(function(processedRoutes) {    
                    var colors = processedRoutes.map(function(r) { return r.color; }),
                        widths = processedRoutes.map(function(r) {
                            return r.width / (zoom > 15? 0.5 : (16 - zoom));
                        }, this),
                        directions = processedRoutes.map(function(r) { return r.direction; }),
                        diffStates = processedRoutes.map(function(r) { return r.diffState; }),
                        yesterdayDate = dateUtils.findNearestDate(Object.keys(allRoutesForSegment), this._stateManager.getTimeSettings().date, true);
                                        
                    var segment = new ymaps.Polyline(coords, {
                        id : id,
                        allRoutes : allRoutesForSegment,
                        routes : actualRoutesForSegment,
                        routesYesterday : allRoutesForSegment[yesterdayDate] || []
                    }, this._getLineOptions(colors, widths, directions, diffStates));

                    segment.editor.options.set('menuManager', function(menu, vertex) {
                        menu.push({
                            id : 'split',
                            onClick : function() {
                                segment.events.fire('split', {
                                    segmentId : id,
                                    vertexIndex : vertex.getIndex(),
                                    geometry : segment.geometry.getCoordinates()
                                });
                            },
                            title : 'Разрезать'
                        })
                        return menu;
                    })

                    return segment;
                }, this);
            }, this)
            .done(function(segmentGeoObject) {
                deferred.resolve(segmentGeoObject);
                delete this._pendingDeferreds[id];
            }, this);
        
        return deferred.promise();
    },
    
    _getLineOptions : function(colors, widths, directions, diffStates) {
        var styles = [null],
            resWidths = [10],
            resColors = ['ffffff00'],
            totalWidth = widths.reduce(function(p, c) { return p + c; }, 0),
            shift = -totalWidth / 2;

        if(!totalWidth) {
            return {
                balloonContentLayout: this._balloonContentLayout,
                strokeColor : ['ffffff00', 'ff770033'],
                strokeWidth : [10, 3],
                strokeStyle : [null, [1, 2]]
            };
        }

        widths.forEach(function(width, i) {
            var actualShift = shift + width / 2;
    
            if(directions[i]) {
                var style, offset = 0;
                for(var j = 0.2; j <= 1; j += 0.2) {
                    style = [2 / j , 2 / j];
                    //if (directions[i] == -1) {
                        offset = directions[i] * width * 1.2 * j;
                    //}
                    //console.log(directions[i], style, offset);
                    styles.push({
                        style : style,
                        offset : offset,
                        generator: function(paths) {
                            return paths.map(function(a) {
                                var res = ymaps.graphics.generator.stroke.outline.sides(a, Math.abs(actualShift))[actualShift > 0? 'leftSide' : 'rightSide'];
                                return geomUtils.cut(res, Math.abs(actualShift), Math.abs(actualShift));
                            });
                        }
                    });
                    resColors.push(colors[i]);
                    resWidths.push(j * width);
                }
            } else {
                styles.push({
                    style: 'solid',
                    generator: function(paths) {
                        return paths.map(function(a) {
                            var res = ymaps.graphics.generator.stroke.outline.sides(a, Math.abs(actualShift))[actualShift > 0? 'leftSide' : 'rightSide'];
                            return geomUtils.cut(res, Math.abs(actualShift), Math.abs(actualShift));
                        });
                    }
                });
                resColors.push(colors[i]);
                resWidths.push(width);
            }
            if(diffStates[i]) {
                styles.push({
                    style: [1, 3],
                    offset: width * 1.2,
                    generator: function(paths) {
                        return paths.map(function(a) {
                            var res = ymaps.graphics.generator.stroke.outline.sides(a, Math.abs(actualShift))[actualShift > 0? 'leftSide' : 'rightSide'];
                            return geomUtils.cut(res, Math.abs(actualShift), Math.abs(actualShift));
                        });
                    }
                });
                resColors.push(diffStates[i] === +1? '00ff00ff' : 'ff0000ff');
                resWidths.push(width);
            }
            shift += width;
        });
        return {
            balloonContentLayout: this._balloonContentLayout,
            strokeColor : resColors,
            strokeWidth : resWidths,
            strokeStyle : styles
        };
    },
   
    abort : function(segmentId) {
        if(this._pendingDeferreds[segmentId]) {
            this._pendingDeferreds[segmentId].reject(); 
            delete this._pendingDeferreds[segmentId];
        }
    },
    
    abortAll : function() {
        Object.keys(this._pendingDeferreds).forEach(function(deferred) {
            deferred.reject();
        }, this);
        this._pendingDeferreds = {};
    }
});

return SegmentFactory;

});