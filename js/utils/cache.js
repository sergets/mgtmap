define(['utils/extend'], function(extend) {
	var Cache = function(capacity) {
		this._capacity = capacity;
		this._storage = {};
		this._order = [];
	};

	extend(Cache.prototype, {
		_buildKey : function() {
			return JSON.stringify([].slice.apply(arguments));
		},

		set : function() {
			var args = [].slice.apply(arguments),
				val = args.pop(),
				key = this._buildKey.apply(this, args);

			if (this._order.length == this._capacity) {
				delete this._storage[this._order.shift()];
			}

			this._order.push(key);
			this._storage[key] = val;
		},

		get : function() {
			return this._storage[this._buildKey.apply(this, arguments)];
		},

		drop : function() {
			this._storage = {};
			this._order = [];
		}
	});

	return Cache;
})