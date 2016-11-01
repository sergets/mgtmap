define({
    findNearestDate : function(dates, date, strictlyPast) {
        var pastDates = dates
                .sort(function(a, b) {
                    return +(new Date(a)) - +(new Date(b));
                })
                .filter(function(i) {
                    return strictlyPast?
                        +(new Date(i)) < date :
                        +(new Date(i)) <= date;
                });
                        
        return pastDates[pastDates.length - 1];
    }
});