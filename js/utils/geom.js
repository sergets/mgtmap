define(function() {
    var MIN_LEN = 1;

    function _cut(dist, data) {
        if(dist >= cutLength || dist <= 0) return {
            points : data.points.reverse(),
            segLengths : data.segLengths.reverse()
        };
        var segCount = 0,
            cutLength = 0;
        while(cutLength < dist) {
            cutLength += data.segLengths[segCount];
            segCount++;
        }

        var divRatio = 1 - ((cutLength - dist) / data.segLengths[segCount - 1]),
            a = data.points[segCount - 1],
            b = data.points[segCount];

        if(!a || !b) { 
            console.warn(dist, data, segCount);
            return {
                points : data.points.reverse(),
                segLengths : data.segLengths.reverse()
            }
        }

        var splitPoint = [a[0] + divRatio * (b[0] - a[0]), a[1] + divRatio * (b[1] - a[1])];

        return {
            points : [splitPoint].concat(data.points.slice(segCount)).reverse(),
            segLengths : [(1 - divRatio) * data.segLengths[segCount - 1]].concat(data.segLengths.slice(segCount)).reverse()
        };
    }

    function _l(a, b) {
        return Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
    }

    function _getSegmentLengths(line) {
        return line.slice(1).map(function(i, n) {
            return _l(i, line[n]);
        });
    }

    return {
        getLength : function(line) {
            return _getSegmentLengths(line).reduce(function(s, l) { return s + l; }, 0);
        },

        cut : function(line, fromStart, fromEnd) {
            if(fromStart + fromEnd == 0) {
                return line;
            }

            var segmentLengths = _getSegmentLengths(line),
                length = segmentLengths.reduce(function(s, l) { return s + l; }, 0);

            if(fromStart + fromEnd == 0 || length == 0) {
                return line;
            }

            if(fromStart + fromEnd > length - MIN_LEN) {
                var k = (length - MIN_LEN) / (fromStart + fromEnd);
                fromStart *= k;
                fromEnd *= k;
            }

            return _cut(fromEnd, _cut(fromStart, { points : line, segLengths : segmentLengths })).points;
        },
        
        bounds : function(segment) {
            return segment.reduce(function(prev, point) {
                if(point[0] < prev[0][0] || !prev[0][0]) { prev[0][0] = point[0]; }
                if(point[1] < prev[0][1] || !prev[0][1]) { prev[0][1] = point[1]; }
                if(point[0] > prev[1][0] || !prev[1][0]) { prev[1][0] = point[0]; }
                if(point[1] > prev[1][1] || !prev[1][1]) { prev[1][1] = point[1]; }
                return prev;
            }, [[], []]);
        },

        findIntersectionPos : function(axis, intersecting) {
            // a0[x] + da[x] * l = b0[x] + db[x] * m
            // a0[y] + da[y] * l = b0[y] + db[y] * m

            // a0[x] - b0[x] + da[x] * l = db[x] * m
            // a0[y] - b0[y] + da[y] * l = db[y] * m

            // db[x] != 0, db[y] != 0:

            // a0[x]/db[x] - b0[x]/db[x] + da[x]/db[x] * l = a0[y]/db[y] - b0[y]/db[y] + da[y]/db[y] * l
            // (da[x]/db[x] - da[y]/db[y]) * l = (a0[y] - b[0][y])/db[y] - (a0[x] - b0[x])/db[x]
            // (da[x] * db[y] - da[y] * db[x]) * l = (a0[y] - b0[y]) * db[x] - (a0[x] - b0[x]) * db[y]
            // l = (a0[y] - b0[y]) * db[x] - (a0[x] - b0[x]) * db[y] / (da[x] * db[y] - da[y] * db[x]);

            // db[x] = 0:
            // da[x] * l = b0[x] - a0[x];
            // l = 0 - (a0[x] - b0[x]) * db[y] / (da[x] * db[y] - 0);

            //console.log('intersecting', JSON.stringify(axis), 'with', JSON.stringify(intersecting), '...');
            var a0 = axis[0],
                b0 = intersecting[0],
                da = [axis[1][0] - axis[0][0], axis[1][1] - axis[0][1]],
                db = [intersecting[1][0] - intersecting[0][0], intersecting[1][1] - intersecting[0][1]];

            //console.log(a0, b0, da, db);

            var res = ((a0[1] - b0[1]) * db[0] - (a0[0] - b0[0]) * db[1]) / (da[0] * db[1] - da[1] * db[0]);

            //console.log('->', res);
            return res; 

        },

        roundAngle : function(a, b, c, r) {
            var DASH = 1,
                ab = [(b[0] - a[0]) / _l(a, b), (b[1] - a[1]) / _l(a, b)],
                bc = [(c[0] - b[0]) / _l(b, c), (c[1] - b[1]) / _l(b, c)],
                bcInAb = [
                    bc[0] * ab[0] + bc[1] * ab[1],
                    -bc[0] * ab[1] + bc[1] * ab[0]
                ],
                sin = bcInAb[1],
                cos = bcInAb[0],
                isLeft = Math.sign(sin),
                f = isLeft * Math.acos(cos),
                sin05 = Math.sqrt((1 - cos) / 2),
                cos05 = Math.sqrt((1 + cos) / 2),
                rPrj = Math.min(_l(a, b), _l(b, c), r * sin05 / cos05);

            r = rPrj * cos05 / sin05;

            var rVec = [isLeft * ab[1] * r, -isLeft * ab[0] * r],
                s = [b[0] - ab[0] * rPrj, b[1] - ab[1] * rPrj],
                o = [s[0] - rVec[0], s[1] - rVec[1]],
                n = Math.abs(Math.round(2 * Math.PI * f / DASH)),
                df = f / n;

            if(n < 1) {
                return [a, b, c];
            }

            var rVecEnd = [isLeft * bc[1] * r, -isLeft * bc[0] * r],
                e = [b[0] + bc[0] * rPrj, b[1] + bc[1] * rPrj];

            var dsin = Math.sin(df),
                dcos = Math.cos(df),
                res = [a];

            if(_l(s, a) > 1e-5) {
                res.push(s);
            }

            for(i = 1; i < n - 1; i++) {
                rVec = [
                    rVec[0] * dcos - rVec[1] * dsin,
                    rVec[0] * dsin + rVec[1] * dcos
                ];
                res.push([
                    o[0] + rVec[0], o[1] + rVec[1] 
                ]);
            }

            if(_l(e, c) > 1e-5) {
                res.push(e);
            }

            res.push(c);

            return res;
        },

        deduplicate : function(line) {
            return line.filter(function(r, i, a) {
                return (r !== a[i - 1]);
            });
        }
    }
});