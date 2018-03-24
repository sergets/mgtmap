({
    baseUrl: '../js',
    paths: {
        vow: '../node_modules/vow/vow.min',
        ymaps: 'empty:',
        flatbush: '../node_modules/flatbush/flatbush.min',
        requireLib: '../node_modules/requirejs/require'
    },
    name: 'worker',
    out: '../deploy/worker.min.js',
    include: ['requireLib'],
    onBuildRead: function(name, path, contents) {
        if(name === 'vow') {
            // Fix vow to work in DedicatedWorkerGlobalScope
            return 'var global = window = this; setImmediate = function(func) { return setTimeout(func, 0); };' + contents;
        }
        return contents;
    }
})