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
                color[0] = frame(color[0], 0.2, 0.4);
                color[1] = frame(color[1], 0.7 + 0.3 * Math.abs(color[0] - 0.3), 1);
                color[2] = frame(color[2], 0.3, 1);
                break;
            case 2: 
                color[0] = frame(color[0], 0.4 + color[1] / 4, 1 - color[1] / 4);
                color[1] = frame(color[1], 0, 1 - 0.5 * Math.abs(color[0] - 0.8));
                color[2] = frame(color[2], 0, 1 - 0.3 * Math.abs(color[0] - 0.8));
                break;
        }
        if(k) {
            color[1] = frame(color[1], 0, 0.9);
            color[2] = frame(color[2], 0.3, 1);
        }
        return formatColor(hsl2rgb(color));
    }

    return getColor;
});

var PROJECT_ROUTES = ['Т79', 'Т3', 'Т47', 'Т10', 'Б', 'Т39', 'Т67', 'Т40', 'Т71', 'Т72', 'Т52', 'м9', '24к', 'м1', '648', '64', '223', '205к', '247', '164', '237', '24', '763к', '209', '232', '651', '271', 'Т15', '633', '298', '709', '683', 'Т25', '215к', '85', '132', '291', '263', 'м6', '791', '832', '834', '241', '789', '615', '221', 'м3', '275', '706к', '811', 'м2', '608', '155', '805', '659', '230', '690', '31', 'А', '39', '761', '216', '255', '645', '51', '299', '806', '776', '803', '742', '152', '194', 'С5', '276', '706', '116', 'С8', '700', '52', '171', '159', '84к', '257', '12', '39к', '67', '57', '672', '84', '130', '143', '800', '763', '40', '96', '9', 'м10', '656', '709к', '179', '623', '142', '101', '730', '8', '186', '820', '153', '701', '278', '147', '106', '220', '38', '214', 'В'];


