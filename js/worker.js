var global = window = this;

setImmediate = function(func) {
    return setTimeout(func, 0);
}; // otherwise vow's nextTick tries to use postMessage

if (typeof define === 'undefined') {
    importScripts('../lib/requirejs/require.js');  // cdnjs.cloudflare.com/ajax/libs/require.js/2.3.2/require.min.js');
}

requirejs.config({
    paths : {
        vow : '../lib/vow/vow.min',  // cdn.rawgit.com/dfilatov/vow/0.4.17/lib/vow
        flatbush : '../lib/flatbush/flatbush.min' // unpkg.com/flatbush@1.3.0/flatbush.min.js
    }
});

require([
    'vow',
    'worker/commands/init',
    'worker/commands/setup',
    'worker/commands/renderTile',
    'worker/commands/renderHotspots',
    'worker/commands/getActuals'
    //'worker/commands/getJunctionDataForTile'
], function(
    vow,
    initCommand,
    setupCommand,
    renderTileCommand,
    renderHotspotsCommand,
    getActualsCommand
    //getJunctionDataForTileCommand
) {
    var commands = {
        init : initCommand,
        setup : setupCommand,
        renderTile : renderTileCommand,
        renderHotspots : renderHotspotsCommand,
        getActuals : getActualsCommand
        //getJunctionDataForTile : getJunctionDataForTileCommand
    };
        
    this.addEventListener('message', function(e) {
        var data = e.data,
            that = this;

        if(!commands[data.command]) {
            console.warn('no command "' + data.command + '" defined');
        }
        else {
            commands[data.command].call(this, data.params, data.key).then(function(msg) {
                msg && that.postMessage(msg);
            }, function(err) {
                console.warn(err);
            }, function(progress) {
                that.postMessage({ progress : progress });
            })
        }
    });
    
    this.postMessage({ state : 'instantiated' });
});
