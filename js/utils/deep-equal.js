define(function() {
	return function deepEqual(a, b) {
        if (a === b) {
            return true;
        } else if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        } else if (!a || !b || (typeof a != 'object' && typeof b != 'object') || typeof a == 'string' || typeof b == 'string') {
            return a === b;
        }

        var i, key,
            ka = Object.keys(a),
            kb = Object.keys(b);

        if (ka.length != kb.length) {
            return false;
        }

        ka.sort();
        kb.sort();

        for (i = ka.length - 1; i >= 0; i--) {
            if (ka[i] != kb[i]) {
                return false;
            }
        }

        for (i = ka.length - 1; i >= 0; i--) {
            key = ka[i];
            if (!deepEqual(a[key], b[key])) {
                return false;
            }
        }

        return (typeof a == typeof b);
    };
});











