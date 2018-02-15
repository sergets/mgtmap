define([
    'jquery',
    'utils/route'
], function(
    $,
    routeUtils
) {

return function(id, routes, colors) {
    return $('<div/>')
        .addClass('segment')
        .attr('segment-id', id)
        //.append($('<h2/>').html(id))
        .append(
            routes
                .filter(routeUtils.notPhantom)
                .map(function(route) {
                    return $('<div/>').addClass(routeUtils.getType(route)).css('backgroundColor', colors[route]).html(routeUtils.clearType(route));
                }, this)
        )
        /*.append($('<div/>')
            .addClass('segment-button select-segment-routes')
            .html('Показать эти маршруты')
        )*/
        [0];
};

});