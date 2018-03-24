({
    baseUrl: '../js',
    paths: {
        vow: '../node_modules/vow/vow.min',
        ymaps: 'empty:',
        jquery: 'empty:',
        requireLib: '../node_modules/requirejs/require'
    },
    name: 'app',
    out: '../deploy/app.min.js',
    include: ['requireLib']
})