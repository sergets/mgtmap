requirejs.config({
    baseUrl : 'js',
    paths : {
        jquery : '//yastatic.net/jquery/2.2.0/jquery.min',
        vow : '//cdn.rawgit.com/dfilatov/vow/0.4.17/vow.min',
        ymaps : '//api-maps.yandex.ru/2.1.63/?lang=ru_RU&coordorder=lonlat&load=package.full'
    },
    shim : {
        ymaps : { exports : 'ymaps' },
        jquery : { exports : '$' }
    }
});

require([
    'ymaps',
    'jquery',
    'vow',
    'worker/client',
    'state/manager',
    'data/manager',
    'map/map',
    'view/app',
    'utils/deep-equal'
], function(
    ym,
    $,
    vow,
    MapWorker,
    StateManager,
    DataManager,
    Map,
    AppView,
    deepEqual
) {
    ym.ready(function() {
        var stateManager = new StateManager(),
            dataManager = new DataManager(stateManager),
            tileWorker = new MapWorker(dataManager, stateManager);

        var map = new Map(dataManager, stateManager, tileWorker),
            appView = new AppView(map, dataManager, stateManager);

        stateManager.isDebugMode() && (window.mgtApp = {
            dataManager : dataManager,
            map : map
        });

        stateManager.on('coloring-id-updated', function() {
            tileWorker.command('setup', { state : stateManager.serialize() });
        });

        map.on({
            'bounds-changed' : function(e, data) {
                stateManager.setBounds(data.bounds);
            },
            'segment-geometry-changed' : function(e, data) {
                dataManager.setSegmentGeometry(data.segmentId, data.geometry);
            },
            'split-segment' : function(e, data) {
                vow.all([dataManager.getSegmentCount(), dataManager.getRoutesForSegment(data.segmentId)]).spread(function(segmentCount, routes) {
                    map.toggleSegmentGeometryEditor(data.segmentId);
                    dataManager.setSegmentGeometry(data.segmentId, data.geometry.slice(0, data.vertexIndex + 1));
                    dataManager.setSegmentGeometry(segmentCount, data.geometry.slice(data.vertexIndex));
                    dataManager.setRoutesForSegment(segmentCount, routes);
                });
            }
        });

        /*dataManager.on('data-updated', function() {
            //dataManager.saveChangedFiles();
            appView.refreshColors();
        });*/

        /*stateManager.on('selected-routes-updated', function(route) {
            appView.updateSelectedRoutes();
        });*/

        tileWorker.on({
            'progress' : function(e, progress) {
                appView.showProgress(progress);
            },
            'ready' : function(e) {
                appView.hideProgress();
            },
            'updated inited' : function() {
                tileWorker.command('getActuals').then(function(res) {
                    if (deepEqual(stateManager.serialize(), res.state)) {
                        dataManager.setActuals(res.actuals);
                    }
                })
            }
        });

        appView.on({
            'time-settings-updated' : function(e, timeSettings) { stateManager.setTimeSettings(timeSettings); },
            'coloring-updated' : function(e, coloringId) { stateManager.setCustomColoringId(coloringId); },
            'width-factor-updated' : function(e, widthFactor) { stateManager.setWidthFactor(widthFactor); },
            'state-updated' : function(e, state) { stateManager.setState(state); },
            'route-selected' : function(e, route) {
                /*dataManager.getRouteBounds(route).then(function(bounds) {
                    map.setBounds(bounds);
                });*/
                map.showSelectedRoute(route);
                appView.showSelectedRoute(route);
            },
            'route-deselected' : function(e, route) {
                //stateManager.deselectRoute();
                map.hideSelectedRoute();
                appView.hideSelectedRoute();
            }
            /*'select-segment-routes' : function(e, segmentId) {
                dataManager.getActualRoutesForSegment(segmentId).done(function(routes) {
                    stateManager.selectRoutes(routes.map(function(route) {
                        return routeUtils.notPhantom(route) && routeUtils.strip(route);
                    }).filter(Boolean));
                });
            }*/
        });
    });
});
