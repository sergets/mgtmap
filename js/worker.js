var tileServer = function() {
    var query = document.currentScript.src.split('#')[1].split('?callback='),
        params = { 
            bounds : query[0].split(',').map(Number),
            callback : query[1]
        };
    worker.postMessage(params);
};

var worker = function() {
	onmessage = function(e) {
	    var params = e.data;
	    
	    getObjectByBounds(params.bounds).then(function(res) {
	        postMessage({ callback : params.callback, result : res });
	    }, function(err) {
	        postMessage({ callback : params.callback, error : err });
	    });
	};


    function getObjectByBounds(bounds) {
        return vow.resolve([{
           type: 'Feature',
           id: bounds.join(''),
           geometry: {
               type: 'Point',
               coordinates: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
           }
        }]);
    };
};

var blobify = function(func) {
	return URL.createObjectURL(new Blob(['(' + func.toString() + ')();']));
}

var tileServerUrl = blobify(tileServer),
    worker = new Worker(URL.createObjectURL(new Blob(['onmessage = ' + workerServer.toString() + ';'])));

worker.onmessage = function(e) { window[e.data.callback](e.data.result || { error : e.data.error }); };

var remoteObjectManager = new ymaps.RemoteObjectManager(tileServerUrl + '#%b');
mgtApp.map.getMap().geoObjects.add(remoteObjectManager);