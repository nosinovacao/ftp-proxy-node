NodeJS FTP Proxy
==============

NodeJS ftp proxy prepared for active and passive connections with transfer stats plugin.

Plugin stats already has a solution for using rabbitMQ as stats' message publisher.

For more details, go to our [Wiki page](https://github.com/DropZone/ftp-proxy-node/wiki)


Usage example
-----------
```javascript
(function(){
	var ftpd = require('ftp-proxy-node');
	var _config = require('./config');
	var _p = {
		'server': null,
		'init': function(){	
			_p.ftpProxy.set();
			return self;
		},
		'ftpProxy': {
		    'set': function () {
		        var proxy = new ftpd(_config);
				proxy.listen(_config.proxyData.port);
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

config.js file example
-----------
```javascript

module.exports = {
    serverData: { 
        host: '127.0.0.1', 
        port: 21 
    },
    proxyData: {
        id: 'Proxy test local machine',
        ip: '127.0.0.1',
        port: 2121,
        machineName: 'Test Machine'
    },
    logging: {
        useConsole: true,
        useFile: true,
        filePath: 'FTPProxy-Logging(%DATE%).log',
        level: 'DEBUG'
    },
    statsPlugin: {
    	usePlugin: true,
        activeStatusInterval: 10 * 1000, //10 seconds in milliseconds
        inactiveStatusInterval: 1 * 60 * 60 * 1000, //1 hour in milliseconds
        timeToIgnoreIdleTransfer: 10 * 60 * 1000  //10 minutes in milliseconds
    },
    messagePublisher: {
	    connectionString: 'your rabbit connection string',
	    exchange: {
	        name: 'FtpProxy.Notifications',
	        options: {
	            type: 'topic'
	        }
	    },
	    RK: {
	        snapshot: {
	            name : 'FtpProxy.Notifications.Snapshot',
	            options:{
	                type: 'FtpProxy.FtpStatus'
	                ,contentType: 'application/json'
	                ,contentEncoding: 'utf-8'
	                ,immediate: true
	            }
	        },
	        onTransferStarted: {
	            name : 'FtpProxy.Notifications.OnTransferStarted',
	            options:{
	                type: 'FtpProxy.FtpTransferInfo'
	                ,contentType: 'application/json'
	                ,contentEncoding: 'utf-8'
	                ,immediate: true
	            }
	        },
	        onTransferEnded: {
	            name : 'FtpProxy.Notifications.OnTransferEnded',
	            options:{
	                type: 'FtpProxy.FtpTransferInfo'
	                ,contentType: 'application/json'
	                ,contentEncoding: 'utf-8'
	                ,immediate: true
	            }
	        },
	        onTransferAborted: {
	            name : 'FtpProxy.Notifications.OnTransferAborted',
	            options:{
	                type: 'FtpProxy.FtpTransferInfo'
	                ,contentType: 'application/json'
	                ,contentEncoding: 'utf-8'
	                ,immediate: true
	            }
	        }
	    }
	}
}
```