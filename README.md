ftp-proxy-node
==============

Simple FTP Proxy for node.js. Thanks to (https://github.com/peter-x/ftpmult)


Usage example
-----------

(function(){
	var ftpd = require('./ftp-proxy-node');
	var _p = {
		'server': null,
		'init': function(){	
			_p.ftpProxy.set();
			return self;
		},
		'ftpProxy': {
		    'options': {
		        localhost: '10.100.100.100',
		        serverData: { host: '127.0.0.1', port: 21 },
		        logLevel: 10
		    },
		    'set': function () {
		        var proxy = new ftpd.ftpProxy(_p.ftpProxy.options);
				proxy.listen(41823);
				proxy.on("error", _p.ftpProxy.onError);
			},
			'onError': function(error) {
				console.error(error);
				/* better exit so that someone can restart us */
				// process.exit(1);
			}
		}
	};
	var self = {};
	return	_p.init();
})();
