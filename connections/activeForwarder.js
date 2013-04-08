var net = require('net');
var activeForwarder = function(conn, eventEmitter) {
    var self = {
        'callback': null,
        'serverListener': null,
        'proxyListenPort': null,
        'clientConnection': null,
        'serverConnected': true,
        'clientConnected': true,
        'clientCommandPort': 0,
        'clientConnectionData':  { 'host': null, 'port': null },
        'useStatsPlugin': false,
        'intercept': {
            'activeMode' : function(command, forwardCallback, useStatsPlugin) {
                self.useStatsPlugin = useStatsPlugin;
                conn.log('INFO', "Trying to intercept active mode.");
                var m = command.arg.match(/.*(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}).*/);
                if (m) {
                    m = command.arg.split(',');
                    var host = m[0] + '.' + m[1] + '.' + m[2] + '.' + m[3];
                    var port = (parseInt(m[4]) * 256) + parseInt(m[5]);
                    self.forward(host, port, forwardCallback);
                } 
                else {
                    conn.log('WARNING', "Unable to parse PORT address.");
                }
            }
        },
        'forward': function (host, port, callback) {
            self.clientCommandPort = conn.clientSocket.remotePort;
            self.callback = callback;
            conn.log('INFO', "Establishing forward for active connection (" + host + ":" + port + ")");
            
            self.serverConnected = false;
            self.clientConnected = false;

            eventEmitter.emit('activeForwarder:forwarding');

            self.clientConnectionData = { 'host': host, 'port': port };
            
            self.serverListener = net.createServer(self.serverCreated);
            self.serverListener.listen(0, self.listenerOnListen);
            self.serverListener.on('error', self.listenerOnError);
        },
        'serverCreated': function (lsocket) {
            if (self.serverConnected) {
                conn.log('DEBUG', "Client already connected.");
                lsocket.end();
            } 
            else {
                conn.log('INFO', "Client connected to forwarder.");
                self.serverConnected = true;
                self.serverListener.close();
                if (self.useStatsPlugin) {
                    lsocket.on('data', function(data){
                        eventEmitter.emit('activeForwarder:fileBufferSent', { length: data.length, port: self.clientCommandPort });
                    });
                }
                eventEmitter.emit('activeForwarder:serverConnected');

                lsocket.on('error', function (err) {
                    conn.log('ERROR', "Active forwarding error: " + err, conn);
                    lsocket.destroy();
                });

                lsocket.pipe(self.clientConnection);
                self.clientConnection.pipe(lsocket);
            }
        },
        'connectionCreated': function () {
            conn.log('DEBUG', "Connected to client.");
            self.clientConnected = true;
            eventEmitter.emit('activeForwarder:clientConnected');
        },
        'listenerOnListen': function () {
            conn.log('DEBUG', "Listening for server.");
            self.proxyListenPort = self.serverListener.address().port;
            self.tryNotifyingServer();
        },
        'listenerOnError': function (err) {
            conn.log('ERROR', "Active serverListener error: " + err, conn);
            self.serverListener.destroy();
        },
        'clientOnError': function (err) {
            conn.log('ERROR', "Active forwarding error: " + err, conn);
            self.clientConnection.destroy();
        },
        'tryNotifyingServer': function () {
            if (self.proxyListenPort !== null) {
                conn.log('INFO', "Proxy listen port " + self.proxyListenPort + " ready, notifying server.");
                self.callback(conn.serverSocket.address().address, self.proxyListenPort);
                
                var clientHost = self.clientConnectionData.host, clientPort = self.clientConnectionData.port;
                self.clientConnection = net.createConnection(clientPort, clientHost, self.connectionCreated);
                self.clientConnection.on('error', self.clientOnError);
            }
        }
    };
    return self;
};

exports = module.exports = activeForwarder;