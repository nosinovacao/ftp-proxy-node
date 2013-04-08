module.exports = exports = function(timeToIgnoreIdleTransfer){
	var clientArray = {};
	var clientTransferArray = {};
	var _config = {
		timeToIgnore: timeToIgnoreIdleTransfer
	};
	var _p = {
		'init': function() {
			return self;
		},
		'getId': function(clientIp, clientPort){
			return clientIp + clientPort;
		},
		'setBytesPerSecond': function(clientIp, clientPort, bufferSize) { //bufferSize as bytes
			var clientId = _p.getId(clientIp, clientPort);
			if(!clientTransferArray[clientId]) clientTransferArray[clientId] = new clientTransferObject();
			
			if(clientTransferArray[clientId].lastBufferSent > 0){
				var currentTs = new Date().getTime();
				var tsDiff = currentTs - clientTransferArray[clientId].lastBufferSent;
				if (tsDiff == 0) return;

				clientTransferArray[clientId].totalPackages++;
				var bytesPerSecond = ((bufferSize * 1000) / tsDiff);

				clientTransferArray[clientId].totalBytes += bytesPerSecond;
				clientTransferArray[clientId].mediaBytesPerSecond = parseInt(clientTransferArray[clientId].totalBytes / clientTransferArray[clientId].totalPackages);
				clientTransferArray[clientId].lastBufferSent = new Date().getTime();

				self.setBytesPerSecond(clientIp, clientPort, clientTransferArray[clientId].mediaBytesPerSecond);
			}
			else {
				clientTransferArray[clientId].lastBufferSent = new Date().getTime();
			}
		}
	};
	var self = {
		'set': function(clientIp, clientPort){
			var clientId = clientIp + clientPort;
			if(!clientArray[clientId]) clientArray[clientId] = new clientObject(clientIp, clientPort);
		},
		'getId': function(clientIp, clientPort){
			return clientIp + clientPort;
		},
		'get': function(clientIp, clientPort, createNew){
			var clientId = clientIp + clientPort;
			if(!clientArray[clientId] && createNew === false) return undefined;
			if(!clientArray[clientId]) self.set(clientIp, clientPort);
			return clientArray[clientId];
		},
		'setFileName': function(clientIp, clientPort, fileName){
			var clientId = self.getId(clientIp, clientPort);
			if (!clientArray[clientId]) self.set(clientIp, clientPort);
			clientArray[clientId].fileName = fileName;
			clientArray[clientId].lastUpdate = new Date().getTime();
		},
		'addCommand': function(clientIp, clientPort, command){
			var clientId = self.getId(clientIp, clientPort);
			if (!clientArray[clientId]) self.set(clientIp, clientPort);
			if (!clientArray[clientId].commands) clientArray[clientId].commands = [];
			clientArray[clientId].lastUpdate = new Date().getTime();
			clientArray[clientId].commands.push(command);
		},
		'setFileSize': function(clientIp, clientPort, fileSizeBytes){
			var clientId = self.getId(clientIp, clientPort);
			if (!clientArray[clientId]) self.set(clientIp, clientPort);

			clientArray[clientId].lastUpdate = new Date().getTime();
			clientArray[clientId].fileSizeBytes = parseFloat(fileSizeBytes);
		},
		'setBytesPerSecond': function(clientIp, clientPort, bytesPerSecond) {
			var clientId = self.getId(clientIp, clientPort);

			if (clientArray[clientId]) {
				clientArray[clientId].bytesPerSecond = bytesPerSecond;
			}
		},
		'incrementFileTransferedBytes': function(clientIp, clientPort, bufferSize){
			var clientId = self.getId(clientIp, clientPort);
			if (clientArray[clientId]) {
				clientArray[clientId].lastUpdate = new Date().getTime();
				clientArray[clientId].fileTransferedBytes += bufferSize;
				_p.setBytesPerSecond(clientIp, clientPort, bufferSize);
			}
		},
		'delete': function(clientIp, clientPort, createNew){
			var clientId = self.getId(clientIp, clientPort);
			if (clientArray[clientId]) {
				delete clientArray[clientId];
			}
		},
		'toArray': function() {
			var arrClients = [];
			for (var client in clientArray) {
				var value = clientArray[client];
				if (value.fileSizeBytes  && value.fileSizeBytes > 0) {
					if((new Date().getTime() - value.lastUpdate) > _config.timeToIgnore)
						delete clientArray[client];
					else
						arrClients.push(value);
				}
			}
			return arrClients;
		}
	};
	return _p.init();
};


var clientObject = function(clientIp, clientPort) {
	var _p = {
		'init': function(){
			return self;
		}
	};
	var self = {
		'clientIp': clientIp
		,'clientPort': clientPort
		,'fileName': ''
		,'fileSizeBytes': 0
		,'fileTransferedBytes': 0
		,'bytesPerSecond': 0
		,'lastUpdate': new Date().getTime()
	};
	return _p.init();
};

var clientTransferObject = function() {
	var _p = {
		'init': function(){
			return self;
		}
	};
	var self = {
		'lastBufferSent': 0 //milliseconds
		,'totalPackages': 0
		,'totalBytes': 0
		,'mediaBytesPerSecond': 0
	};
	return _p.init();
};