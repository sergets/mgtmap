define(function() {
    function rgb2hsl(rgb) {
        var r = rgb[0],
            g = rgb[1],
            b = rgb[2],
            l = Math.max(r, g, b),
            d = l - Math.min(r, g, b),
            s = d/l,
            h;
        
        if(l == r) {
            if(g <= b) {
                h = (g - b) / 6;
            }
            else {
                h = (g - b) / 6 / d;
            }
        }
        if(l == g) {
            h = (b - r) / 6 / d + 1/3;
        }
        if(l == b) {
            h = (r - g) / 6 / d + 2/3;
        }
        h > 1 && h--;
        h < 0 && h++;

        return [h, s, l];
    }

    function hsl2rgb(hsl) {
        var h = hsl[0] - Math.floor(hsl[0]),
            s = hsl[1],
            l = hsl[2];

        if (!s) return [l, l, l]

        h *= 6;
        var i = Math.floor(h),
            data = [1-s, 1-s*(h-i), 1-s*(1-(h-i)), 1],
            picks = [
                [3, 2, 0],
                [1, 3, 0],
                [0, 3, 2],
                [0, 1, 3],
                [2, 0, 3],
                [3, 0, 1]
            ];

        return picks[i].map(function(pick) {
            return l * data[pick]; 
        });
    }

    function formatColor(rgb) {
        r = (rgb[0] * 256) | 0;
        g = (rgb[1] * 256) | 0;
        b = (rgb[2] * 256) | 0;  
        return '#' + ('0' + r.toString(16)).substr(-2) + ('0' + g.toString(16)).substr(-2) + ('0' + b.toString(16)).substr(-2);
    }

    function mixColor(a, b, q) {
        a = hsl2rgb(a);
        b = hsl2rgb(b);
        return rgb2hsl([
            (1-q) * a[0] + q * b[0],
            (1-q) * a[1] + q * b[1],
            (1-q) * a[2] + q * b[2]
        ]);
    }

    function frame(val, from, to) {
        var res = from + val * (to - from);
        return res - Math.floor(res);
    }

    function getColor(bus) {
        bus = bus + '';
        var type = 2,
            k = false;
        if(bus.indexOf('Тб') != -1) {
            bus = bus.substr(3);
            type = 1;
        }
        if(bus.indexOf('Тм') != -1) {
            bus = bus.substr(3);
            type = 0;
        }
        if(/.?[a-я]$/.test(bus)) {
            bus = bus.substr(0, bus.length - 1);
            k = true;
        }
        bus = +bus.replace(/^[^\d]/g, '');
        if(isNaN(bus)) {
            bus = 0;
        }
        var color = [
            ((bus + 2) % 11) / 10,
            0.09 + 0.2 * ((bus / 16) % 4),
            0.48 + 0.09 * (bus % 5)
        ],
        z = [];

        switch (type) {
            case 0: 
                color[0] = frame(color[0], -0.1, 0.07);
                color[1] = frame(color[1], 0.75, 1);
                color[2] = frame(color[2], 1 - (color[1] - 0.75) * 3, 1);
                break;
            case 1: 
                color[0] = frame(color[0], 0.15, 0.4);
                color[1] = frame(color[1], 0.5, 0.9);
                color[2] = frame(color[2], 0.3, 1);
                break;
            case 2: 
                color[0] = frame(color[0], 0.3 + color[1] / 4, 1 - color[1] / 4);
                break;
        }
        if(k) {
            color[1] = frame(color[1], 0, 0.8);
            color[2] = frame(color[2], 0.4, 1);
        }
        return formatColor(hsl2rgb(color));
    }

    return getColor;
});
