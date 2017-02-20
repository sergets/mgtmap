define(function() {
	var bindCall = function(fn) {
	        return fn.call.bind(fn);
	    },
	    hasOwnProp = bindCall(Object.prototype.hasOwnProperty);

	return function(target) {
        typeof target !== 'object' && (target = {});

        for(var i = 1, len = arguments.length; i < len; i++) {
            var obj = arguments[i];
            if(obj) {
                for(var key in obj) {
                    hasOwnProp(obj, key) && (target[key] = obj[key]);
                }
            }
        }

        return target;
    };
});