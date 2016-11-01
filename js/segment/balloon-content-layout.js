define([
    'ymaps',
    'jquery',
    'shylight',
    'utils/bus-color'
], function(
    ymaps,
    $,
    shylight,
    getBusColor
) {

return {
    create : function(isAdminMode) { 
        return ymaps.templateLayoutFactory.createClass(       
            (isAdminMode?
                 '<div class="segment" segment-id="$[properties.id]" all-routes-json-encoded="$[properties.allRoutesJson]">' +
                 'id <b>$[properties.id]</b>' + 
                 '<br>До:<br><div class="routes-editor yesterday">$[properties.routesYesterdayEditor]</div>' +
                 '<br>После:<br><div class="routes-editor today">$[properties.routesTodayEditor]</div>' +
                 '<div class="segment-button edit-segment-geometry">Геометрия</div>' +
                 '<div class="segment-button save-segment">Сохранить</div>' +
                 '<div class="segment-button reverse-segment">Развернуть</div>' + 
                 '</div>' :

                 '<div class="segment" segment-id="$[properties.id]">$[properties.routesHtml]</div>'),
            {
                build: function() {
                    this.constructor.superclass.build.call(this);

                    $('.routes-editor').each(function(i, editor) {
                        shylight(editor, {
                            '([-<>]?)((?:Тм |Тб |)(?:[А-я\-0-9]+))' : function(res, mode, number) {
                                return '<span class="' + (mode == '-'? 'antiroute' : 'route') + '" style="' + (mode == '-'? 'color' : 'background') + ': ' + getBusColor(number) + '">' + res + '</span>';
                            }
                        })
                    });
                },
                                
                getData: function() {
                    var res = this.constructor.superclass.getData.call(this),
                        id = res.properties.get('id'),
                        routesForSegment = res.properties.get('routes');

                    res.properties
                        .set('allRoutesJson', encodeURIComponent(JSON.stringify(res.properties.get('allRoutes'))))
                        .set('routesHtml', routesForSegment
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
                        .set('routesYesterdayEditor', res.properties.get('routesYesterday').join(' '))
                        .set('routesTodayEditor', routesForSegment.join(' ')); 
                        
                    return res;
                }
            }
        );
    },

    }
})