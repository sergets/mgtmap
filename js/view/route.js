define([
    'jquery',
    'vow',
    'utils/route'
], function(
    $,
    vow,
    routeUtils
) {

return function(route, dataManager) {
    var type = routeUtils.getType(route);
        routeCleared = routeUtils.clearType(route),
        view = $('<div/>')
            .addClass('route-card')
            .append($('<div/>')
                .addClass('close')
                .html('&times;'))
            .append($('<div/>')
                .addClass(type)
                .addClass('title')
                .html(routeCleared));

    vow.all([
        dataManager.getRouteSummaryHtml(route),
        dataManager.getBusColor(route)
    ]).spread(function(summary, color) {
        view.find('.tram, .trolley, .bus').css('background-color', color);
        view.append($('<div/>').addClass('route-summary').html(summary));
    }, function(err) {
        console.warn(err);
    });

    return view;
};

});