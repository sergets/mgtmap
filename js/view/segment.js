define([
    'jquery',
    'utils/bus-color'
], function(
    $,
    getBusColor
) {

return function(id, routes, customColoringId) {
    return $('<div/>')
        .addClass('segment')
        .attr('segment-id', id)
        .append(
            routes
                .filter(function(route) {
                    return route.indexOf('-') !== 0;
                })
                .map(function(route) {
                    route = route.replace(/^[<>]/, '');
                    var type = route.indexOf('Тб')? route.indexOf('Тм')? 'bus' : 'tram' : 'trolley',
                        routeCleared = route.replace(/^(Тб|Тм) /, '');

                    return $('<div/>').addClass(type).css('backgroundColor', getBusColor(route, customColoringId)).html(routeCleared);
                }, this)
        )
        .append($('<div/>')
            .addClass('segment-button select-segment-routes')
            .html('Показать эти маршруты')
        )
        [0];
};

});