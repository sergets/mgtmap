requirejs.config({
    baseUrl : 'js',
    paths : {
        jquery : '//yastatic.net/jquery/2.2.0/jquery.min',
        vow : '//cdn.rawgit.com/dfilatov/vow/0.4.12/vow.min',
        shylight : '//cdn.rawgit.com/sergets/shylight/0.0.1/shylight.min',
        'pretty-json-stringify' : '//cdn.rawgit.com/sergets/pretty-json-stringify/0.0.2/index',
        ymaps : '//api-maps.yandex.ru/2.1/?lang=ru_RU&coordorder=lonlat&mode=debug&load=package.full,graphics.generator.stroke.outline'   
    },
    shim : {
        ymaps : { exports : 'ymaps' }
    }
});

require([
    'ymaps',
    'jquery',
    'vow',
    'state/manager',
    'data/manager',
    'segment/factory',
    'map/map',
    'view/app'
], function(
    ym,
    $,
    vow,
    StateManager,
    DataManager,
    SegmentFactory,
    Map,
    AppView
) {
    ym.ready(function() {
        var stateManager = new StateManager(),
            dataManager = new DataManager(stateManager),
            segmentFactory = new SegmentFactory(dataManager, stateManager),
            map = new Map(stateManager.getBounds(), dataManager, segmentFactory),
            appView = new AppView(map, stateManager);

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
            map.update();
            dataManager.saveChangedFiles();
        });

        stateManager.on('selected-route-updated', function(route) {
            map.update();
        });
        
        appView.on({
            'time-settings-updated' : function(e, timeSettings) { stateManager.setTimeSettings(timeSettings); },
            'width-factor-updated' : function(e, widthFactor) { stateManager.setWidthFactor(widthFactor); },
            'route-selected' : function(e, route) { stateManager.setSelectedRoute(route); },
            'save-segment' : function(e, data) { dataManager.setRoutesForSegment(data.id, data.routes).done(); },
            'edit-segment-geometry' : function(e, segmentId) { map.toggleSegmentGeometryEditor(segmentId); },
        });
    });
});