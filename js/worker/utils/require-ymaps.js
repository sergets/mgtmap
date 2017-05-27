var SERVER = '//api-maps.yandex.ru/2.1.56/';

if(typeof importScripts == 'undefined') {
    define(['ymaps', function(ymaps) {
        return ymaps.modues.require.bind(ymaps.modules);
    }]);
} else {
    global = window = this;

    setImmediate = function(func) {
        return setTimeout(func, 0);
    }; // otherwise modules' nextTick tries to use postMessage

    importScripts('//cdn.rawgit.com/ymaps/modules/0.1.2/modules.js');

    var ym = ym || {
        env : {
            browser : {
                name : 'worker',
                engine : 'worker',
                graphicsRenderEngine : 'canvas'
            },
            lang : 'ru-RU',
            languageCode : 'ru'
        },
        supports : {
            graphics : {
                hasCanvas : function() { return true; },
                hasSvg : function() { return true; },
                hasVml : function() { return true; }
            }
        },
        modules : modules,
        readyDecls : {}
    };

    define(function() {
        return function(moduleNames, callback) {
            var callbackId = Math.random(),
                onMapLoaded = function(map) {
                    ym.map = map;
                    var deps = {};
                    moduleNames.forEach(function(requiredModule) {
                        collectDeps(deps, requiredModule, map);
                    });
                    var modulesToLoad = Object.keys(deps).filter(function(dep) {
                        return !(dep in ym.readyDecls);
                    });
                    if(global['map_' + callbackId]) delete global['map_' + callbackId];

                    if(modulesToLoad.length) {
                        global['combine_' + callbackId] = onApiLoaded;
                        importScripts(SERVER + 'combine.js?load=' + modulesToLoad.join('') + '&callback=combine_' + callbackId);
                    } else {
                        ym.modules.require(moduleNames, callback);
                    }
                },
                onApiLoaded = function(api) {
                    api.forEach(function(entry) {
                        if(entry && !(entry[0] in ym.readyDecls)) {
                            entry[1](ym);
                            ym.readyDecls[entry[0]] = entry[1];
                        }
                    });
                    ym.modules.require(moduleNames, callback);
                };

            if(!ym.map) {
                global['map_' + callbackId] = onMapLoaded;
                importScripts(SERVER + 'map.js?callback=map_' + callbackId + '&filter=*');
            } else {
                onMapLoaded(ym.map);
            }
        };
    });
}

function collectDeps(deps, module, aliasMap) {
    var decl = (aliasMap.filter(function(item) {
        return module.length == 2? 
            item[1] == module :
            item[0] == module; 
    })[0] || []).slice();
    if(!decl) return deps;
    if(typeof decl[2] == 'function') {
        decl[2] = decl[2](ym) || [];
    }
    else {
        decl[2] = decl[2].match(/.{1,2}/g) || [];
    }
    deps[decl[1]] = true;
    decl[2].forEach(function(dep) {
        collectDeps(deps, dep, aliasMap);
    });
    return deps;
}
