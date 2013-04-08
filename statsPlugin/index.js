var statsPlugin = function(projectEventEmitter, logger, options){
	var clientManager = new require('./lib/clientManager')(options.statsPlugin.timeToIgnoreIdleTransfer);
	var publisher = new require('./lib/publisher')(projectEventEmitter, logger, clientManager, options);
	var _p = {
		'init': function(){
			_p.listeners.init();
			publisher.init();
			return	self;
		},
		'listeners':{
			'init': function(){
				logger.info('STATS PLUGIN - Initialized');
				projectEventEmitter.on('clientConnection:clientCommand', _p.listeners.onClientCommand);
				projectEventEmitter.on('clientConnection:clientRETR', _p.listeners.onClientRETR);
				projectEventEmitter.on('clientConnection:fileSize', _p.listeners.onFileSize);
				projectEventEmitter.on('clientConnection:fileBufferSent', _p.listeners.onFileBufferSent);
				projectEventEmitter.on('clientConnection:transferAborted', _p.listeners.onTransferAborted);
			},
			'onClientCommand': function(data){
				clientManager.addCommand(data.ip, data.commandPort, data.data.replace('\r\n', ''));
			},
			'onClientRETR': function(data) {
				clientManager.setFileName(data.ip, data.commandPort, data.data);
			},
			'onClientEnd': function(data) {
				clientManager.delete(data.ip, data.commandPort);
			},
			'onFileSize': function(data) {
				clientManager.setFileSize(data.ip, data.commandPort, data.data);
				publisher.sendTransferBegin(data.ip, data.commandPort);
			},
			'onFileBufferSent': function(data) {
				var client = clientManager.get(data.ip, data.commandPort, false);
				
				if (data.data && data.data != Object && client && client.fileSizeBytes > 0) {
					var bufferSize = parseFloat(data.data.toString().replace('\r', '').replace('\n', '').replace(' ', ''));
					if (bufferSize) {
						clientManager.incrementFileTransferedBytes(data.ip, data.commandPort, bufferSize);
						client = clientManager.get(data.ip, data.commandPort, false);
						if (client.fileTransferedBytes >= client.fileSizeBytes) {
							publisher.sendTransferEnd(data.ip, data.commandPort);
							clientManager.delete(data.ip, data.commandPort);
						}
					}
				}
			},
			'onTransferAborted': function(data) {
				publisher.sendTransferAborted(data.ip, data.commandPort);
				clientManager.delete(data.ip, data.commandPort);
			}
		}
	};
	var self = {};
	return _p.init();
};


exports = module.exports = statsPlugin;