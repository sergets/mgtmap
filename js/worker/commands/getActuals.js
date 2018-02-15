define(['vow'], function(vow) {
	return function(_, key) {
		return vow.resolve({ result : this.actuals, key : key });
	};
});