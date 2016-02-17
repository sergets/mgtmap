ymaps.ready(function() {
    // localStorage.clear();

    var busMap = {
        _map : new ymaps.Map('map', $.extend({
            controls: ['zoomControl']
        }, (localStorage.getItem('bounds') && !isNaN(JSON.parse(localStorage.getItem('bounds'))[0][0]))? {
            bounds : JSON.parse(localStorage.getItem('bounds'))
        } : {
            center : [55.79, 37.49],
            zoom : 14
        })),

        _loadCache : {},

        _coll : new ymaps.GeoObjectCollection(),

        _jcColl : new ymaps.GeoObjectCollection(),

        _junctions : {},

        _visibleSegments : {},

        _widths : {},

        _routesBySegment : {}, 

        _getBalloonContentLayout : function() { 
            var that = this;
            return this._balloonContentLayout || (this._balloonContentLayout = ymaps.templateLayoutFactory.createClass(       
                'id <b>$[properties.id]</b><br>' + 
                '<div class="segment" segment-id="$[properties.id]" routes-joined="$[properties.routesJoined]">' + 
                    '$[properties.routesHtml]' +
                    '<div class="edit-segment">Маршруты</div>' +
                    '<div class="reverse-segment">Развернуть</div>' +
                    // '<div class="edit-segment-geometry">Геометрия</div>' +
                '</div>',
                {
                    build: function(a, b, c) {
                        this.constructor.superclass.build.call(this);
                    },
                    getData: function() {
                        var res = this.constructor.superclass.getData.call(this),
                            id = res.properties.get('id');
                        //console.warn(res.properties.get('segmentId'))
                        res.properties.set('routesHtml', that._getRoutesForSegment(id)
                            .filter(function(route) {
                                return route.indexOf('-') == -1;
                            })
                            .map(function(route) {
                                route = route.replace(/^[<>]/, '');
                                return '<div class="route" style="background: ' + getBusColor(route) + '">' + 
                                    route + 
                                '</div>';
                            })
                            .join(''));
                        return res;
                    }
                }
            ));
        },

        _buildBalloon : function(id) {
            var routes = this._routesBySegment[id] || [];
            return '<b>#' + id + '</b><br>' + 
                '<div class="segment-form">' +
                routes.map(function(route) {
                    route = route.replace(/^[<>]/, '');
                    return '<div class="route" style="background: ' + getBusColor(route) + '">' + 
                        route + 
                        '</div>';
                }) + 
                '</div>';
        },

        init : function() {
            this._load('data/widths.json', function(widths) {
                this._load('data/routes.json', function(routes) {
                    this._map.layers.add(new ymaps.Layer('data:image/svg+xml,' + encodeURIComponent('<?xml version="1.0" encoding="utf-8"?><svg version="1.0" xmlns="http://www.w3.org/2000/svg" height="256" width="256"><rect x="0" y="0" width="256" height="256" fill="white" opacity="0.7"/></svg>'), { tileTransparent : true }));

                    this._widths = widths;
                    this._routesBySegment = routes;
                    this._map.events
                        .add('boundschange', this._onBoundsChanged, this);
                    this._map.geoObjects.add(this._coll);
                    this._map.geoObjects.add(this._jcColl);
                    this._onBoundsChanged();
                }, this);
            }, this);
            $(document)
                .on('click', '.segment .edit-segment', this._onEditSegment.bind(this))
                .on('click', '.segment .reverse-segment', this._onReverseSegment.bind(this))

                //.on('click', '.segment .edit-segment-geometry', this._onEditSegmentGeometry.bind(this));
         },

        _hideAllSegments : function() {
            this._coll.removeAll();
            this._junctions = {};
            this._visibleSegments = {};
        },

        _showSegmentsByIds : function(ids) {
            this._jcColl.removeAll();
            this._load('data/segments.json', function(segments) {
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

                Object.keys(this._junctions).forEach(function(key) {
                    //if(this._junctions[key] && this._junctions[key].length) {
                        var jc = this._createJunction(key.split(','));
                        jc && this._jcColl.add(jc);
                    //}
                }, this);
            }, this);
        },

        _removeSegmentById : function(id) { 
            this._coll.remove(this._visibleSegments[id]);
            var coords = this._visibleSegments[id].geometry.getCoordinates();
            this._junctions[coords[0].join()] = this._junctions[coords[0].join()].filter(function(js) { return js != id; });
            this._junctions[coords[coords.length - 1].join()] = this._junctions[coords[coords.length - 1].join()].filter(function(js) { return js != -id; });
            delete this._visibleSegments[id];
        },

        _addSegment : function(id, coords) {
            var segment = this._createPolyline(id, coords, this._map.getZoom());
            (this._junctions[coords[0].join()] || (this._junctions[coords[0].join()] = [])).push(id);
            (this._junctions[coords[coords.length - 1].join()] || (this._junctions[coords[coords.length - 1].join()] = [])).push(-id);
            this._visibleSegments[id] = segment;
            this._coll.add(segment);
        },

        _createPolyline : function(id, coords, zoom) {
           // console.log(coords, '!');
           // var reverse = 1;
           // if(coords[0][0] > coords[coords.length - 1][0]) {
           //     coords = coords.reverse();
                //reverse = -1;
           // }
            var routes = this._getRoutesForSegment(id).map(this._getRouteData, this),
                colors = routes.map(function(r) { return r.color; }),
                widths = routes.map(function(r) { return r.width / (zoom > 15? 0.5 : (16 - zoom)); }),
                directions = routes.map(function(r) { return r.direction; });
            
          
            return new ymaps.Polyline(coords/*.map(function(point) {
                return [55 + point[1], 37 + point[0]];
            })*/, {
                id: id
            }, this._getLineOptions(colors, widths, directions));
        },

        _createJunction : function(coords) {
            var opts = this._getJunctionOptions(coords, this._junctions[coords.join()]);
            if (opts.visible) {
                return new ymaps.Placemark(coords, opts.properties, opts.options);
            }
        },

        _getLineOptions : function(colors, widths, directions) {
            var styles = [null],
                resWidths = [50],
                resColors = ['ffffff00'],
                totalWidth = widths.reduce(function(p, c) { return p + c; }, 0),
                shift = -totalWidth / 2;
            
            if(!totalWidth) {
                return {
                    balloonContentLayout: this._getBalloonContentLayout(),
                    strokeColor : ['ffffff00', 'ff000077'],
                    strokeWidth : [50, 2],
                    strokeStyle : [null, [3, 2]]
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
                shift += width;
            });
            return {
                balloonContentLayout: this._getBalloonContentLayout(),
                strokeColor : resColors,
                strokeWidth : resWidths,
                strokeStyle : styles
            };
        },

        _getJunctionOptions : function(coords, segmentIds) {
            var //segments = segmentIds.map(function(id) {
                //    return this._segments[Math.abs(id)];
                //}),
                routes = {},
                inRoutes = {},
                outRoutes = {};

            segmentIds.forEach(function(id) {
                var routesForSegment = this._getRoutesForSegment(Math.abs(id));
                routesForSegment.forEach(function(rt) {
                    var collection;

                    switch(rt[0]) {
                        case '-':
                            return;
                        case '>':
                        case '<':
                            var m = rt[0] == '>'? 1 : -1,
                                n = id / Math.abs(id);
                            collection = m * n > 0? inRoutes : outRoutes;
                            rt = rt.substr(1);
                            break;
                        default:
                            collection = routes;
                    }
                        
                    (collection[rt] || (collection[rt] = [])).push(id);
                })
            }, this);

            var passing = []
                    .concat(Object.keys(routes).filter(function(rt) {
                        return routes[rt].length == 2 && !inRoutes[rt] && !outRoutes[rt];
                    }))
                    .concat(Object.keys(inRoutes).filter(function(rt) {
                        
                        return !routes[rt] && inRoutes[rt].length == 1 && outRoutes[rt] && outRoutes[rt].length == 1;// ) {
                         //   console.log()
                       // }
                    })),
                terminating = Object.keys(routes).filter(function(rt) {
                        return routes[rt].length == 1 && !inRoutes[rt] && !outRoutes[rt];
                    }),
                splitting = Object.keys(routes).filter(function(rt) {
                        return routes[rt].length == 1 && 
                            inRoutes[rt] && inRoutes[rt].length == 1 &&
                            outRoutes[rt] && outRoutes[rt].length == 1;
                    }),
                uturning = Object.keys(routes).filter(function(rt) {
                        return routes[rt].length == 3 && !inRoutes[rt] && !outRoutes[rt];
                    }),
                all = Object.keys([]
                .concat(Object.keys(routes))
                .concat(Object.keys(inRoutes))
                .concat(Object.keys(outRoutes))
                .reduce(function(p, i) { p[i] = true; /* console.log('---', JSON.stringify(p), Object.keys(p));*/ return p; }, {}));

            var isSimple = (all.length === passing.length + terminating.length + splitting.length + uturning.length);

            ///

            var jcLines = [],
                segmentsToPairWith = segmentIds,
                fromSegmentId,
                fromRoutes;
            
            while(segmentsToPairWith[0]) {
                fromSegmentId = segmentsToPairWith[0];
                segmentsToPairWith = segmentsToPairWith.slice(1);
            //segmentIds.forEach(function(fromSegmentId) {
                fromRoutes = this._getRoutesForSegment(Math.abs(fromSegmentId));
                if(fromSegmentId > 0) {
                    //fromSegmentId = -fromSegmentId;
                    fromRoutes = fromRoutes.slice().reverse().map(function(rt) {
                        if(rt[0] == '>') { rt = '<' + rt.substr(1); }
                        else if(rt[0] == '<') { rt = '>' + rt.substr(1); }
                        return rt;
                    });
                }
                segmentsToPairWith.forEach(function(toSegmentId) {
                    //if(fromSegmentId == toSegmentId) return;

                    var toRoutes = this._getRoutesForSegment(Math.abs(toSegmentId));
                    if(toSegmentId < 0) {
                        //toSegmentId = -toSegmentId;
                        toRoutes = toRoutes.slice().reverse().map(function(rt) {
                            if(rt[0] == '>') { rt = '<' + rt.substr(1); }
                            else if(rt[0] == '<') { rt = '>' + rt.substr(1); }
                            return rt;
                        });
                    }

                    var i = 0,
                        j = -1,
                        route,
                        newLine = { routes : [] };

                    while(i < fromRoutes.length) {
                        route = fromRoutes[i],
                        j = toRoutes.indexOf(route);
    
                        if(j != -1 && route[0] != '-') {
                            newLine.routes.push(route);
                            newLine.from = fromSegmentId;
                            newLine.to = toSegmentId;
                            newLine.beforeFrom = fromRoutes.slice(0, i);
                            newLine.beforeTo = toRoutes.slice(0, j);

                            while(toRoutes.indexOf(fromRoutes[++i]) == ++j && fromRoutes[i][0] != '-') {
                                newLine.routes.push(fromRoutes[i]);
                            }
                            newLine.afterFrom = fromRoutes.slice(i);
                            newLine.afterTo = toRoutes.slice(j);

                            jcLines.push(newLine);
                            newLine = { routes : [] };
                            j = -1;
                        } else {
                            i++;
                        }
                    }
                }, this);
            }

            ///
                
            return {
                visible : false, // !isSimple || !!terminating.length,
                properties : {
                    balloonContent : (terminating.length? ('Конечная ' + terminating.join(', ') + '<br>') : '') +
                        'Маршруты: ' + all.join(', ') + 
                        //'<br>Повороты: ' + JSON.stringify(jcLines) + 
                        (isSimple? '' : '<br>Особенности у: ' + all.filter(function(rt) {
                            return [terminating, passing, splitting, uturning].every(function(arr) { return arr.indexOf(rt) == -1; });
                        }).join(','))
    
                        
                },
                options : {
                    preset : 'islands#' + (isSimple? 'darkGreen' : 'red') + 'Circle' + (terminating.length? 'Dot':'') + 'Icon'
                }
            };
        },

        _getRoutesForSegment : function(id) {
            return this._routesBySegment[id] || []; // ['Тб 59', 'Тб 61', 'Тб 19', '100', '105', '26', '691', '-Тб 59'];
        },

        _getRouteData : function(route) {
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
                color = getBusColor(route)
            }
            return {
                color : color,
                direction : direction,
                width : this._widths[route] || 3
            };
        },

        _onBoundsChanged : function(e) {
            var map = this._map,
                oldZoom = e && e.get('oldZoom'),
                zoom = map.getZoom(),
                bounds = map.getBounds();

            this._load('data/bounds.json', function(response) {
                var res = [];
                 response.forEach(function(segment, i) {
                    if(segment[0][0] < bounds[1][0] && bounds[0][0] < segment[1][0]) {
                        if(segment[0][1] < bounds[1][1] && bounds[0][1] < segment[1][1]) {
                            res.push(i);
                        }
                    }
                });

                if(oldZoom && (zoom != oldZoom)) {
                    this._hideAllSegments();
                }
                this._showSegmentsByIds(res.length < 4500? res : []);
            }, this);
            bounds[0][0] && localStorage.setItem('bounds', JSON.stringify(bounds));
        },

        _onEditSegment : function(e) {
            var segment = $(e.target).parent('.segment'),
                id = segment.attr('segment-id'),
                oldRoutes = this._getRoutesForSegment(id),
                routes = prompt('Маршруты сегмента ' + id, oldRoutes);
            //console.warn(routes, typeof routes);
            if(routes !== null) {
                this._routesBySegment[id] = routes? routes.split(',') : [];
                this._removeSegmentById(id);
                this._load('data/segments.json', function(segments) {
                    this._addSegment(id, segments[id]);
                }, this);
                this._saveRoutes();
                e.preventDefault();
            }
        },

        _onReverseSegment : function(e) {
            var segment = $(e.target).parent('.segment'),
                id = segment.attr('segment-id'),
                oldRoutes = this._getRoutesForSegment(id),
                routes = oldRoutes.reverse();
            
                this._routesBySegment[id] = routes;
                this._removeSegmentById(id);
                this._load('data/segments.json', function(segments) {
                    this._addSegment(id, segments[id]);
                }, this);
                this._saveRoutes();
                e.preventDefault();
        },


        /*_onEditSegmentGeometry : function(e) {
            var segment = $(e.target).parent('.segment'),
                id = segment.attr('segment-id');
            this._visibleSegments[id].editor.startEditing();
        },*/

        _load : function(file, callback, ctx) {
            if(this._loadCache[file]) {
                callback.call(ctx || this, this._loadCache[file]);
            } else {
                $.ajax({
                    url : file,
                    data : {
                        ncrnd : Math.random()
                    },
                    success : function(res) {
                        this._loadCache[file] = res;
                        callback.call(ctx || this, res);
                    },
                    dataType : 'json',
                    error : function(req, st, e) {
                      alert('error on' + file + ': ' + e.message);
                    },
                    context : this
                });
            }
        },

        _saveRoutes : function() {
            $.ajax({
                url : 'saveroutes.php',
                method : 'POST',
                data : {
                    json : JSON.stringify(this._routesBySegment)
                },
                success : function(res) {
                    //console.info(res);
                },
                error : function(req, st, e) {
                    console.warn(e.message);
                }
            })
        }
    };
    busMap.init();
});