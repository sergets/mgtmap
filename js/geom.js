var geomUtils = (function() {
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

    return {
        cut : function(line, fromStart, fromEnd) {
            var length = 0,
                segmentLengths = line.slice(1).map(function(i, n) {
                    var x = i[0] - line[n][0],
                        y = i[1] - line[n][1],
                        l = Math.sqrt(x*x + y*y);
                    length += l;
                    return l;
                });

            if(fromStart + fromEnd > length - MIN_LEN) {
                var k = (length - MIN_LEN) / (fromStart + fromEnd);
                fromStart *= k;
                fromEnd *= k;
            }

            return _cut(fromEnd, _cut(fromStart, { points : line, segLengths : segmentLengths })).points;
        }
    }
})();