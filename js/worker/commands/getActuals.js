define(['vow'], function(vow) {
	return function(_, key) {
		return vow.resolve({
			result : {
				state : this.state,
				actuals : this.actuals
			},
			key : key
		});
	};
});