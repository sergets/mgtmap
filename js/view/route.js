define([
    'jquery',
    'vow'
], function(
    $,
    vow
) {

return function(route, dataManager) {
    var type = route.indexOf('Тб')? route.indexOf('Тм')? 'bus' : 'tram' : 'trolley',
        routeCleared = route.replace(/^(Тб|Тм) /, ''),
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