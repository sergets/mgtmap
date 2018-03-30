define([
    'vow',
    'utils/extend',
	'utils/date',
    'data/actuals/routes',
    'data/actuals/existing-routes',
    'data/actuals/widths',
    'data/actuals/colors',
    'data/actuals/outlines',
    'data/actuals/route-outlines',
    'data/actuals/max-width',
    'data/actuals/junctions',
    'data/actuals/route-bounds',
    'data/actuals/lengths'
], function(
    vow,
    extend,
	dateUtils,
    actualRoutes,
    actualExistingRoutes,
    actualWidths,
    actualColors,
    actualOutlines,
    actualRouteOutlines,
    actualMaxWidth,
    actualJunctions,
    actualRouteBounds,
    actualLengths
) {

return function(data, state, updatedStateFields, oldActuals) {
    var deferred = vow.defer(),
        fields = {
            'routes' : actualRoutes,
            'existingRoutes' : actualExistingRoutes,
            'widths' : actualWidths,
            'colors' : actualColors,
            'outlines' : actualOutlines,
            'routeOutlines' : actualRouteOutlines,
            'maxWidth' : actualMaxWidth,
            'junctions' : actualJunctions,
            'routeBounds' : actualRouteBounds,
            'lengths' : actualLengths
        },
        fieldsToRecalc = Object.keys(fields).filter(function(fieldName) {
            return !oldActuals[fieldName] || fields[fieldName].shouldRecalc(state, updatedStateFields);
        }),
        readyFields = {};

    fieldsToRecalc = getSortedDeps(fieldsToRecalc, fields);

    fieldsToRecalc.forEach(function(fieldId, i) {
        readyFields[fieldId] = vow.all((fields[fieldId].deps || []).map(function(depName) {
            return fieldsToRecalc.indexOf(depName) != -1? readyFields[depName] : oldActuals[depName];
        })).then(function(readyDeps) {
            return fields[fieldId].calc.apply(fields[fieldId], [data, state].concat(readyDeps)).then(function(res) {
                return res;
            });
        });
        deferred.notify((i + 1) / fieldsToRecalc.length);
    });

    vow.all(readyFields).then(function(readyFields) {
        deferred.notify(1);
        deferred.resolve(extend(oldActuals, readyFields));
    });

    return deferred.promise();
};

function getSortedDeps(fieldId, fieldsDesc) {
    var res = [], deps, pushAfter;

    if(Array.isArray(fieldId)) {
        deps = fieldId;
        pushAfter = false;
    } else {
        deps = fieldsDesc[fieldId].deps || [];
        pushAfter = fieldId;
    }

    deps.forEach(function(dep) {
        res.push.apply(res, getSortedDeps(dep, fieldsDesc));
    });
    pushAfter && res.push(pushAfter);

    return res.filter(function(item, i) {
        return res.slice(0, i).indexOf(item) === -1; 
    });
}

})