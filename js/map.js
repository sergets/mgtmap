ymaps.ready(function() {
    // localStorage.clear();

    busMap = {
        _isAdminMode : location.search.indexOf('admin') != -1,
        
        _isEqualWidthsMode : location.search.indexOf('equal') != -1,

        _map : new ymaps.Map('map', $.extend({
            controls: ['zoomControl', 'geolocationControl']
        }, (localStorage.getItem('bounds') && !isNaN(JSON.parse(localStorage.getItem('bounds'))[0][0]))? {
            bounds : JSON.parse(localStorage.getItem('bounds'))
        } : {
            center : [55.79, 37.49],
            zoom : 14
        })),

        _timeSettings : {
            dow : ({ 6 : 32, 0 : 64 })[(new Date()).getDay()] || 1,
            from : (new Date()).getHours(),
            to : (new Date()).getHours(),
            date : +(new Date())
        },

        _selectedRoute : false,

        _loadCache : {},

        _coll : new ymaps.GeoObjectCollection(),

        _jcColl : new ymaps.GeoObjectCollection(),

        _junctions : {},

        _visibleSegments : {},

        _widths : {},

        _widthFactor : 1,

        _routesBySegment : {}, 

        _getBalloonContentLayout : function() { 
            var that = this;
            return this._balloonContentLayout || (this._balloonContentLayout = ymaps.templateLayoutFactory.createClass(       
                (this._isAdminMode?
                     '<div class="segment" segment-id="$[properties.id]">' +
                     'id <b>$[properties.id]</b>' + 
                     '<br>До:<br><div class="routes-editor before" contentEditable="true">$[properties.routesBeforeJoined]</div>' +
                     '<br>После:<br><div class="routes-editor after" contentEditable="true">$[properties.routesTodayJoined]</div>' +
                     '<div class="edit-segment">Сохранить</div>' +
                     '<div class="reverse-segment">Развернуть</div>' + 
                     '</div>' :

                     '<div class="segment" segment-id="$[properties.id]" routes-joined="$[properties.routesJoined]">$[properties.routesHtml]</div>'),
                {
                    build: function(a, b, c) {
                        this.constructor.superclass.build.call(this);

                        $('.routes-editor').each(function(i, editor) {
                            simpleHighlight(editor, {
                                '([-<>]?)((?:Тм |Тб |)(?:[А-я\-0-9]+))' : function(res, mode, number) {
                                    return '<span class="' + (mode == '-'? 'antiroute' : 'route') + '" style="' + (mode == '-'? 'color' : 'background') + ': ' + getBusColor(number) + '">' + res + '</span>';
                                }
                            })
                        });
                    },
                    getData: function() {
                        var res = this.constructor.superclass.getData.call(this),
                            id = res.properties.get('id');
                        //console.warn(res.properties.get('segmentId'))
                        res.properties
                            .set('routesHtml', that._getRoutesForSegment(id)
                                .filter(function(route) {
                                    return route.indexOf('-') !== 0;
                                })
                                .map(function(route) {
                                    route = route.replace(/^[<>]/, '');
                                    return '<div class="route" style="background: ' + getBusColor(route) + '">' + 
                                        route + 
                                    '</div>';
                                })
                                .join(''))
                            .set('routesBeforeJoined', ((that._routesBySegment[id] || {})[that._getCurrentDateForSegment(id, true)] || []).join(' '))
                            .set('routesTodayJoined', that._getRoutesForSegment(id).join(' '));
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
            this._createTimeControls();

            this._load('data/freqs.json', function(freqs) {
                this._load('data/routes.json', function(routes) {
                    this._map.layers.add(new ymaps.Layer('data:image/svg+xml,' + encodeURIComponent('<?xml version="1.0" encoding="utf-8"?><svg version="1.0" xmlns="http://www.w3.org/2000/svg" height="256" width="256"><rect x="0" y="0" width="256" height="256" fill="white" opacity="0.7"/></svg>'), { tileTransparent : true }));

                    this._freqs = freqs;
                    this._routesBySegment = routes;
                    this._map.events
                        .add('boundschange', this._onBoundsChanged, this);
                    this._map.geoObjects.add(this._coll);
                    this._map.geoObjects.add(this._jcColl);
                    this._recalcWidths();
                }, this);
            }, this);
            $(document)
                .on('click', '.segment .edit-segment', this._onEditSegment.bind(this))
                .on('click', '.segment .reverse-segment', this._onReverseSegment.bind(this))
                .on('click', '.segment .route', this._onSelectRoute.bind(this))
                .on('click', '.current-route', this._onDeselectRoute.bind(this));
        },

        _recalcWidths : function() {
            var time = this._timeSettings,
                freqs = this._freqs;

            this._widths = Object.keys(freqs).reduce(function(widths, routeName) {
                var currentDay = Object.keys(freqs[routeName]).filter(function(dow) { return dow & time.dow; }),
                    tt = freqs[routeName][currentDay] || {},
                    i = 0;

                widths[routeName] = Object.keys(tt).reduce(function(width, hour) {
                    if(hour >= time.from && hour <= time.to) {
                        width += tt[hour];
                        i++;
                    }
                    return width;
                }, 0) / i;

                return widths;
            }, {});
            this._hideAllSegments();
            this._onBoundsChanged();
        },

        _createTimeControls : function() {
            this._createListControl(
                ({ 6 : 'суббота', 0 : 'воскресенье' })[(new Date()).getDay()] || 'будни',
                {
                    float : 'right'
                },
                {
                    1 : 'будни',
                    32 : 'суббота',
                    64 : 'воскресенье'
                }, function(val) {
                    this._timeSettings.dow = +val;
                    this._recalcWidths();
                },
                this
            );

            this._createListControl((new Date()).getHours() + ':00', {
                position : {
                    top : 45,
                    right : 90
                }
            }, Array.apply([], Array(24)).reduce(function(res, _, i) {
                res[i + 4] = (i + 4) % 24 + ':00';
                return res;
            }, {}), function(val) {
                this._timeSettings.from = +val;
                this._recalcWidths();
            }, this);

            this._createListControl(((new Date()).getHours() + 1) + ':00', {
                position : {
                    top : 45,
                    right : 10
                }
            }, Array.apply([], Array(24)).reduce(function(res, _, i) {
                res[i + 4] = (i + 5) % 24 + ':00';
                return res;
            }, {}), function(val) {
                this._timeSettings.to = +val;
                this._recalcWidths();
            }, this);

            this._createListControl('x1', {
                position : {
                    top : 80,
                    right : 10
                }
            }, {
                "0.25" : '×0.25',
                "0.5" : '×0.5',
                "1" : '×1',
                "2" : '×2',
                "3" : '×3',
                "5" : '×5'
            },
            function(val) {
                this._widthFactor = +val;
                this._hideAllSegments();
                this._onBoundsChanged();
            }, this);
            
            var _this = this;
            
            $('#dateForm').find('input')
            .val((new Date()).toISOString().substr(0, 10))
            .change(function() {
                if(this.value) {
                    _this._timeSettings.date = +new Date(this.value);
                    _this._hideAllSegments();
                    _this._onBoundsChanged();
                }
            });
        },

        _createListControl : function(content, options, items, onItemSelected, ctx) {
            var control = new ymaps.control.ListBox({
                    data: {
                        content: content
                    },
                    items: Object.keys(items).map(function(itemKey) {
                        return new ymaps.control.ListBoxItem(items[itemKey]);
                    })
                }),
                createEventListener = function(i) {
                    return function() {
                        Object.keys(items).forEach(function(itemKey, j) {
                            if(j != i) {
                                control.get(j).deselect();
                            }
                        });
                        control.data.set('content', items[Object.keys(items)[i]]);
                        onItemSelected.call(ctx || this, Object.keys(items)[i]);
                    };
                };
            Object.keys(items).forEach(function(itemKey, i) {
                control.get(i).events.add('click', createEventListener(i));
            });
            this._map.controls.add(control, options);
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

                /*Object.keys(this._junctions).forEach(function(key) {
                    //if(this._junctions[key] && this._junctions[key].length) {
                        var jc = this._createJunction(key.split(','));
                        jc && this._jcColl.add(jc);
                    //}
                }, this);*/
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
                colors = [], widths = [], directions = [], diffStates = [];

            if(this._selectedRoute) {
                var rts = [];
                this._getRoutesForSegment(id).forEach(function(rt, i) {
                    if((rt == this._selectedRoute) || (rt == '<' + this._selectedRoute) || (rt == '>' + this._selectedRoute)) {
                        rts.push(i);
                    }
                }, this);
                colors = rts.map(function(x) { return routes[x].color; });
                widths = rts.map(function(x) { return 10; });
                directions = rts.map(function(x) { return routes[x].direction; });
                diffStates = rts.map(function(x) { return routes[x].diffState; });
            } else {
                colors = routes.map(function(r) { return r.color; });
                widths = routes.map(function(r) {
                    return this._widthFactor * r.width / (zoom > 15? 0.5 : (16 - zoom));
                }, this);
                directions = routes.map(function(r) { return r.direction; });
                diffStates = routes.map(function(r) { return r.diffState; });
            }

            return new ymaps.Polyline(coords, {
                id: id
            }, this._getLineOptions(colors, widths, directions, diffStates));
        },

        _createJunction : function(coords) {
            var opts = this._getJunctionOptions(coords, this._junctions[coords.join()]);
            if (opts.visible) {
                return new ymaps.Placemark(coords, opts.properties, opts.options);
            }
        },

        _getLineOptions : function(colors, widths, directions, diffStates) {
            var styles = [null],
                resWidths = [10],
                resColors = ['ffffff00'],
                totalWidth = widths.reduce(function(p, c) { return p + c; }, 0),
                shift = -totalWidth / 2;

            if(!totalWidth) {
                return {
                    balloonContentLayout: this._getBalloonContentLayout(),
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

        _getCurrentDateForSegment : function(id, onlyPast) {
            var that = this,
                routesData = this._routesBySegment[id] || {},
                dates = Object.keys(routesData).sort(function(a, b) {
                    return +(new Date(a)) - +(new Date(b));
                }),
                pastDates = dates.filter(function(date) {
                    return onlyPast?
                        +(new Date(date)) < that._timeSettings.date :
                        +(new Date(date)) <= that._timeSettings.date;
                });
                return pastDates[pastDates.length - 1];
        },

        _getRoutesForSegment : function(id) {
            return (this._routesBySegment[id] || {})[this._getCurrentDateForSegment(id)] || [];
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
                width : this._isEqualWidthsMode? 1 : (this._widths[route] || 0),
                diffState : 0
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

        _onSelectRoute : function(e) {
            var route = $(e.target).html();
            this._selectedRoute = route;
            this._hideAllSegments();
            this._onBoundsChanged();
            $('body').addClass('route-selected');
            $('.current-route').css('background', getBusColor(route)).html(route);
        },
        
        _onDeselectRoute : function() {
            this._selectedRoute = false;
            this._hideAllSegments();
            this._onBoundsChanged();
            $('body').removeClass('route-selected');
        },

        _unjoinRoutes : function(routes) {
            var re = /([-<>]?)((?:Тм |Тб |)(?:[А-я-0-9]+))/g, 
                m = true,
                res = [];
            while(m) {
                m = re.exec(routes);
                m && res.push(m[0]);
            }
            return res;
        },

        _onEditSegment : function(e) {
            if(!this._isAdminMode) return;

            var segment = $(e.target).parent('.segment'),
                id = segment.attr('segment-id'),
                before = segment.find('.routes-editor.before').text(),
                after = segment.find('.routes-editor.after').text(),

                beforeRoutes = this._unjoinRoutes(before),
                afterRoutes = this._unjoinRoutes(after),

                todayKey = new Date(this._timeSettings.date).toISOString().substr(0, 10),
                beforeKey = this._getCurrentDateForSegment(id, true);

            console.log(before, after, todayKey, todayKey in this._routesBySegment[id]);

            if(todayKey in this._routesBySegment[id] && before == after) {
                console.log('removing');
                delete this._routesBySegment[id][todayKey];
            }

            if(!(todayKey in this._routesBySegment[id]) && before !== after) {
                console.log('creating new moment');
                this._routesBySegment[id][todayKey] = {};
            }

            (beforeKey in this._routesBySegment[id]) && (this._routesBySegment[id][beforeKey] = beforeRoutes);
            (todayKey in this._routesBySegment[id]) && (this._routesBySegment[id][todayKey] = afterRoutes);

            this._removeSegmentById(id);
            this._load('data/segments.json', function(segments) {
                this._addSegment(id, segments[id]);
            }, this);

            this._saveRoutes();
            e.preventDefault();

            /*var segment = $(e.target).parent('.segment'),
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
            }*/
        },

        _onReverseSegment : function(e) {
            if(!this._isAdminMode) return;

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
                        // ncrnd : Math.random()
                    },
                    success : function(res) {
                        this._loadCache[file] = res;
                        callback.call(ctx || this, res);
                    },
                    dataType : 'json',
                    error : function(req, st, e) {
                      alert('error on ' + file + ': ' + e.message);
                    },
                    context : this
                });
            }
        },

        _saveRoutes : function() {
            if(!this._isAdminMode) return;
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
                    this._saveWindow || (this._saveWindow = window.open('about:blank'));
                    this._saveWindow.document.documentElement.innerHTML = '<pre>' + prettyJSONStringify(this._routesBySegment, { 
                        shouldExpand : function(obj, level) {
                            return level < 2;
                        }
                    }) + '</pre>';
                },
                context : this
            })
        }
    };
    busMap.init();
}); 