module.exports = exports = function(projectEventEmitter, logger, clientManager, options){
	var _config = options;
	var mpConfig = _config.messagePublisher;
	var statsConfig = _config.statsPlugin;
	var proxyConfig = _config.proxyData;
	var _p = {
		'init': function () {
			_p.MP.init();
			return self;
		},
		'MP': new require('../messagePublisher')(mpConfig, projectEventEmitter, logger)
	};

	var self = {
		'activeIntervalTime': statsConfig.activeStatusInterval,
		'inactiveIntervalTime': statsConfig.inactiveStatusInterval,
		'snapshotTimeout': undefined,
		'intervalTime': 0,
		'init': function(){
			projectEventEmitter.on('statusPlugin:SendClientsListTransfer', self.sendClientsListTransfer);
			projectEventEmitter.on('MP:PublisherConnected', self.sendClientsListTransfer);
		},
		'sendClientsListTransfer': function(){
			var snapshot = new proxySnapshot(proxyConfig, clientManager);
			_p.MP.writeSnapshot(snapshot);

			if(self.snapshotTimeout) clearTimeout(self.snapshotTimeout);

			if (!snapshot.activeTransfers || snapshot.activeTransfers.length == 0)
				self.intervalTime =  self.inactiveIntervalTime;
			else
				self.intervalTime =  self.activeIntervalTime;
			
			self.snapshotTimeout = setTimeout(function() {
				projectEventEmitter.emit('statusPlugin:SendClientsListTransfer');
			}, self.intervalTime);

		},
		'sendTransferEnd': function(clientIp, clientPort){
			var client = clientManager.get(clientIp, clientPort);
			var transfer = new transferInfo(proxyConfig, client);

			_p.MP.writeOnTransferEnded(transfer);
			projectEventEmitter.emit('statusPlugin:SendClientsListTransfer');
		},
		'sendTransferAborted': function(clientIp, clientPort){
			var client = clientManager.get(clientIp, clientPort);
			var transfer = new transferInfo(proxyConfig, client);

			_p.MP.writeOnTransferAborted(transfer);
		},
		'sendTransferBegin': function(clientIp, clientPort){
			var client = clientManager.get(clientIp, clientPort);
			var transfer = new transferInfo(proxyConfig, client);

			_p.MP.writeOnTransferStarted(transfer);
			projectEventEmitter.emit('statusPlugin:SendClientsListTransfer');
		}
	};
	return _p.init();
};

var proxySnapshot = function(proxyConfig, clientManager) {
	return {
		'proxyId': proxyConfig.id,
		'proxyIp': proxyConfig.ip,
		'proxyPort': proxyConfig.port,
		'machineName': proxyConfig.machineName,
		'updated': new Date().getTime(),
		'activeTransfers' : clientManager.toArray()
	}
};

var transferInfo = function(proxyConfig, client) {
	return { 
		'proxyId': proxyConfig.id,					//String
		'proxyIp': proxyConfig.ip,					//String
		'proxyPort': proxyConfig.port,				//Int32
		'machineName': proxyConfig.machineName,		//String
		'updated': new Date().getTime(),			//Int64
		'transferInfo' : {
			'clientIp': client.clientIp,			//String
			'clientPort': client.clientPort,		//Int32
			'fileName': client.fileName,			//String
			'fileSizeBytes': client.fileSizeBytes	//Int64
		}
	}
};