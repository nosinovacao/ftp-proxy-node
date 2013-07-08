var net = require('net');
var loggingModule = require('node-drop-logger');
var clientConnection = require('./clientConnection');

var ftpProxy = function (options) {
    var logger = null;

    var Events = require('events').EventEmitter;
    var projectEventEmitter = undefined;
    var statsPlugin = undefined;

    if (!(this instanceof ftpProxy)) { return new ftpProxy(options); }

    var _props = {
        'server': net.createServer(),
        'serverData': options.serverData || { host: '127.0.0.1', port: 21 }
    };

    var _p = {
        'init': function () {
            logger = new loggingModule(options.logging);
			try
			{
				_p.server.setBindings();
				if (options.statsPlugin.usePlugin) {
					projectEventEmitter = new Events();
					statsPlugin = new require('./statsPlugin')(projectEventEmitter, logger, options);
				}
			}
			catch(e)
			{
				logger.error("Server error: " + e.message);
				console.error(e);
			}
            return self;
        },
        'server': {
            'setBindings': function () {
                _props.server.on("error", _p.server.onError);
                _props.server.on("listening", _p.server.onListening);
                _props.server.on("connection", _p.server.onConnected);
                _props.server.on("close", _p.server.onClose);
            },
            'onError': function (err) {
                logger.error("Server error: " + err);
            },
            'onListening': function () {
                logger.info("FTP multiplexer up and ready for connections.");
            },
            'onConnected': function (clientSocket) {
                new clientConnection(clientSocket, logger, _props, projectEventEmitter, options.statsPlugin.usePlugin);
            },
            'onClose': function () {
                logger.warning("Server closed");
            }
        }
    };
    var self = _props.server;
    return _p.init();
};

exports = module.exports = ftpProxy;