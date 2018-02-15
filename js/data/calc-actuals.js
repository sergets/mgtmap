define([
    'vow',
    'utils/extend',
	'utils/date',
    'data/actuals/routes',
    'data/actuals/existing-routes',
    'data/actuals/widths',
    'data/actuals/colors',
    'data/actuals/outlines',
    'data/actuals/max-width',
    'data/actuals/junctions'
], function(
    vow,
    extend,
	dateUtils,
    actualRoutes,
    actualExistingRoutes,
    actualWidths,
    actualColors,
    actualOutlines,
    actualMaxWidth,
    actualJunctions
) {

return function(data, state, updatedStateFields, oldActuals) {
    var deferred = vow.defer(),
        fields = {
            'routes' : actualRoutes,
            'existingRoutes' : actualExistingRoutes,
            'widths' : actualWidths,
            'colors' : actualColors,
            'outlines' : actualOutlines,
            'maxWidth' : actualMaxWidth,
            'junctions' : actualJunctions
        },
        fieldsToRecalc = Object.keys(fields).filter(function(fieldName) {
            return !oldActuals[fieldName] || fields[fieldName].shouldRecalc(state, updatedStateFields);
        }),
        readyFields = {};

    fieldsToRecalc.sort(function(a, b) {
        return (fields[a].deps || []).indexOf(b) !== -1? 1 :
            (fields[b].deps || []).indexOf(a) !== -1? -1 :
            0;
    });

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

})