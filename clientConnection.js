var clientConnection = function (clientSocket, logger, _props, projectEventEmitter, useStatsPlugin) {
    
    var Events = require('events').EventEmitter;
    var clientId = (new require('./lib/idGenerator')).generate();
    var connectionEventEmitter = new Events();

    var _properties = {
        clientIp: clientSocket.remoteAddress,
        clientPort: clientSocket.remotePort
    };

    var conn = {
        clientSocket: clientSocket,
        destination: null,
        serverSocket: null,
        serverGreetingRecieved: false,
        log: function (level, message, isError) { logger.log(level.toUpperCase(), _properties.clientIp + ':' + _properties.clientPort + ' - ' + message); }
    };

    var server = require('./commandsHandler/serverHandler')(conn, _props.serverData, connectionEventEmitter, useStatsPlugin);
    var client = require('./commandsHandler/clientHandler')(conn, connectionEventEmitter, useStatsPlugin);


    if (projectEventEmitter) { 
        var connectionEventsListener = {
            'init': function() {
                connectionEventEmitter.on('clientHandler:clientRETR', connectionEventsListener.onClientRETR);
                connectionEventEmitter.on('clientHandler:clientCommand', connectionEventsListener.onClientCommand);
                connectionEventEmitter.on('clientHandler:clientEnd', connectionEventsListener.onClientEnd);
                connectionEventEmitter.on('serverHandler:filseSize', connectionEventsListener.onFileSize);
                connectionEventEmitter.on('serverHandler:transferAborted', connectionEventsListener.onTransferAborted);
                connectionEventEmitter.on('passiveConnection:socketOnData', connectionEventsListener.socketOnData);
                connectionEventEmitter.on('activeForwarder:fileBufferSent', connectionEventsListener.onFileBufferSent);
                connectionEventEmitter.on('passiveForwarder:fileBufferSent', connectionEventsListener.onFileBufferSent);
            },
            'onClientCommand': function(command) {
                projectEventEmitter.emit('clientConnection:clientCommand', { 'ip': _properties.clientIp, 'commandPort': _properties.clientPort, 'data' : command });
            },
            'onClientRETR': function(filename) {
                projectEventEmitter.emit('clientConnection:clientRETR', { 'ip': _properties.clientIp, 'commandPort': _properties.clientPort, 'data' : filename });
            },
            'socketOnData': function(bufferSize) {
                projectEventEmitter.emit('clientConnection:socketOnData', { 'ip': _properties.clientIp, 'commandPort': _properties.clientPort, 'data' : bufferSize });
            },
            'onClientEnd': function() {
                projectEventEmitter.emit('clientConnection:clientEnd', { 'ip': _properties.clientIp, 'commandPort': _properties.clientPort});
            },
            'onFileSize': function(fileSize) {
                projectEventEmitter.emit('clientConnection:fileSize', { 'ip': _properties.clientIp, 'commandPort': _properties.clientPort, 'data': fileSize });
            },
            'onFileBufferSent': function(data) {
                projectEventEmitter.emit('clientConnection:fileBufferSent', { 'ip': _properties.clientIp, 'commandPort': _properties.clientPort, 'data': data.length });
            },
            'onTransferAborted': function() {
                projectEventEmitter.emit('clientConnection:transferAborted', { 'ip': _properties.clientIp, 'commandPort': _properties.clientPort, 'data': '' });
            }
        };
        connectionEventsListener.init();
    };

    client.init(); //CREATE CLIENT SOCKET

};


exports = module.exports = clientConnection;