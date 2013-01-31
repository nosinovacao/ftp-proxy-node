ftp-proxy-node
==============

Simple FTP Proxy for node.js. Thanks to (https://github.com/peter-x/ftpmult)


Usage example
-----------
```javascript
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
		        localhost: '127.0.0.1', //FTP Proxy IP
		        serverData: { host: '127.0.0.1', port: 21 }, //FTP Server IP
		        logLevel: 4
		    },
		    'set': function () {
		        var proxy = new ftpd.ftpProxy(_p.ftpProxy.options);
				proxy.listen(21); //FTP Proxy Port
				proxy.on("error", _p.ftpProxy.onError);
			},
			'onError': function(error) {
				console.error(error);
			}
		}
	};
	var self = {};
	return	_p.init();
})();
```