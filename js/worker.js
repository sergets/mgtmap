var global = window = this;

importScripts('//cdnjs.cloudflare.com/ajax/libs/require.js/2.3.2/require.min.js');

requirejs.config({ //baseUrl : '.',
    paths : {
        jquery : '//yastatic.net/jquery/2.2.0/jquery.min',
        vow : '//cdn.rawgit.com/dfilatov/vow/0.4.12/lib/vow',
        rbush : '//unpkg.com/rbush@2.0.1/rbush'
    }
});

require([
    'vow',
    'worker/commands/init',
    'worker/commands/setup',
    'worker/commands/renderTile',
    'worker/commands/renderHotspots'
], function(
    vow,
    initCommand,
    setupCommand,
    renderTileCommand,
    renderHotspotsCommand
) {
    var commands = {
        init : initCommand,
        setup : setupCommand,
        renderTile : renderTileCommand,
        renderHotspots : renderHotspotsCommand
    };
        
    this.addEventListener('message', function(e) {
        var data = e.data,
            that = this;

        commands[data.command].call(this, data.params, data.key).then(function(msg) {
            msg && that.postMessage(msg);
        }, function(err) {
            console.warn(err);
        })
    });
    
    this.postMessage({ state : 'instantiated' });
});
