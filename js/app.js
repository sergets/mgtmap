requirejs.config({
    baseUrl : 'js',
    paths : {
        jquery : '//yastatic.net/jquery/2.2.0/jquery.min',
        vow : '//cdn.rawgit.com/dfilatov/vow/0.4.12/vow.min',
        'pretty-json-stringify' : '//cdn.rawgit.com/sergets/pretty-json-stringify/0.0.2/index',
        ymaps : '//api-maps.yandex.ru/2.1/?lang=ru_RU&coordorder=lonlat&mode=debug&load=package.full,graphics.generator.stroke.outline,util.imageLoader'   
    },
    shim : {
        ymaps : { exports : 'ymaps' }
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
    'view/app'
], function(
    ym,
    $,
    vow,
    MapWorker,
    StateManager,
    DataManager,
    Map,
    AppView
) {
    ym.ready(function() {
        var stateManager = new StateManager(),
            dataManager = new DataManager(stateManager),
            tileWorker = new MapWorker(dataManager, stateManager);

        var map = new Map(dataManager, stateManager, tileWorker),
            appView = new AppView(map, stateManager);

        stateManager.isDebugMode() && (window.mgtApp = {
            dataManager : dataManager,
            map : map
        });

        stateManager.on('selected-routes-updated time-settings-updated width-factor-updated', function() {
            tileWorker.command('setup', { state : stateManager.serialize() });
        })

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
        
        dataManager.on('widths-updated routes-updated segments-updated', function() {
            dataManager.saveChangedFiles();
        });

        stateManager.on('selected-routes-updated', function(route) {
            appView.updateSelectedRoutes();
        });
        
        appView.on({
            'time-settings-updated' : function(e, timeSettings) { stateManager.setTimeSettings(timeSettings); },
            'width-factor-updated' : function(e, widthFactor) { stateManager.setWidthFactor(widthFactor); },
            'routes-selected' : function(e, data) { stateManager.selectRoutes(data.routes); },
            'routes-deselected' : function(e, data) { stateManager.deselectRoutes(data.routes); },
            'select-segment-routes' : function(e, segmentId) { 
                dataManager.getActualRoutesForSegment(segmentId).done(function(routes) {
                    stateManager.selectRoutes(routes.map(function(route) {
                        return (route.indexOf('-') != 0) && route.replace(/^[<>]/, '');
                    }).filter(Boolean));
                });
            }
        });
    });
});