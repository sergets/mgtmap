define(function() {
    var MIN_LEN = 0.00001;

    function _cut(dist, data) {
        if(dist == 0) return {
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
            b = data.points[segCount],
            splitPoint = [a[0] + divRatio * (b[0] - a[0]), a[1] + divRatio * (b[1] - a[1])];
        return {
            points : [splitPoint].concat(data.points.slice(segCount)).reverse(),
            segLengths : [(1 - divRatio) * data.segLengths[segCount - 1]].concat(data.segLengths.slice(segCount)).reverse()
        };
    }

    function _getSegmentLengths(line) {
        return line.slice(1).map(function(i, n) {
            var x = i[0] - line[n][0],
                y = i[1] - line[n][1],
                l = Math.sqrt(x*x + y*y);
            return l;
        });
    }

    return {
        getLength : function(line) {
            return _getSegmentLengths(line).reduce(function(s, l) { return s + l; }, 0);
        },

        cut : function(line, fromStart, fromEnd) {
            var segmentLengths = _getSegmentLengths(line),
                length = segmentLengths.reduce(function(s, l) { return s + l; }, 0);

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
        }
    }
});