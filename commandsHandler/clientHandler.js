var clientHandler = function (conn, eventEmitter, useStatsPlugin) {
    useStatsPlugin = useStatsPlugin || false;
    var parser = require('../lib/commandParser');
    var _props = {
        passiveConnection : { clientConnected : true },
        activeConnection : { clientConnected : true },
        fileSize: false
    };

    var self = {
        'init': function () {
            conn.clientSocket.setEncoding("ascii");
            conn.clientSocket.setNoDelay();
            conn.log('INFO', "New Client connected.");
            self.write("220 FTP multiplexer ready\r\n");
            self.listeners.init();
        },
        'listeners': {
            'init': function(){
                eventEmitter.on('serverHandler:clientData', self.write);
                eventEmitter.on('serverHandler:clientEnd', self.end);

                conn.clientSocket.on("end", self.listeners.onEnd);
                conn.clientSocket.on("error", self.listeners.onError);
                conn.clientSocket.on("data", self.listeners.onData);

                eventEmitter.on('serverHandler:filseSize', self.listeners.onServerFileSize);
                eventEmitter.on('passiveForwarder:forwarding', self.listeners.onPassiveForwarding);
                eventEmitter.on('activeForwarder:forwarding', self.listeners.onActiveForwarder);
                eventEmitter.on('passiveForwarder:clientConnected', self.listeners.onPassiveClientConnected);
            },
            'onPassiveClientConnected': function() {
                _props.passiveConnection.clientConnected = true;
            },
            'onPassiveForwarding': function() {
                _props.passiveConnection.clientConnected = false;
            },
            'onActiveForwarder': function() {
                _props.activeConnection.clientConnected = false;
            },
            'onEnd': function () {
                eventEmitter.emit('clientHandler:clientEnd');
                conn.log('WARNING', "Client disconnected.");
            },
            'onError': function (err) {
                conn.log('ERROR', "Client connection error: " + err);
                conn.clientSocket.destroy();
            },
            'onServerFileSize': function(){
                _props.fileSize = true;
            },
            'onData': function (data) {
                // Don't want to include passwords in logs.
                conn.log('INFO', "Client command: " + (data + '').trim().toString('utf-8').replace(/^PASS\s+.*/, 'PASS ***'));
                var command = parser.parseFTPCommand(data);

                if (conn.serverSocket !== null) {
                    if (command.cmd === "RETR") {
                        if(_props.fileSize === false) {
                            eventEmitter.emit('clientHandler:clientSIZE', 'SIZE ' + command.arg + '\r\n');
                        }
                        else {
                            _props.fileSize = false;
                        }
                        eventEmitter.emit('clientHandler:clientRETR', command.arg);
                    } 
                    else if (command.cmd === "SIZE") {
                        eventEmitter.emit('clientHandler:clientRETR', command.arg);
                    }

                    if (_props.passiveConnection.clientConnected == false) {
                        eventEmitter.once('passiveForwarder:clientConnected', passiveClientConnected);
                        function passiveClientConnected() {
                            _props.passiveConnection.clientConnected = true;
                            server.write(data);
                        }
                    } 
                    else if (_props.activeConnection.clientConnected === false) {
                        eventEmitter.on('activeForwarder:clientConnected', activeClientConnected);
                        function activeClientConnected() {
                            _props.activeConnection.clientConnected = true;
                            server.write(data);
                            eventEmitter.removeListener('activeForwarder:clientConnected', activeClientConnected);
                        }
                    } 
                    else if (command.cmd === "PORT") {
                        var activeForwarder = new require('../connections/activeForwarder')(conn, eventEmitter);
                        activeForwarder.intercept.activeMode(command, self.activeMode.forwardCallback, useStatsPlugin);
                        eventEmitter.on('activeForwarder:clientConnected', PORTActiveClientConnected);
                        function PORTActiveClientConnected() {
                            _props.activeConnection.clientConnected = true;
                            eventEmitter.removeListener('activeForwarder:clientConnected', PORTActiveClientConnected);
                        }
                    } 
                    else {
                        server.write(data);
                    }
                } 
                else {
                    if (command.cmd !== "USER") {
                        self.write("202 Not supported\r\n");
                    }
                    else {
                        eventEmitter.emit('clientHandler:initServer', data); //CREATE SERVER SOCKET
                    }
                }
            }
        },
        'activeMode': {
            'forwardCallback': function (localHost, localPort) {
                var i1 = parseInt(localPort / 256); var i2 = parseInt(localPort % 256);
                server.write("PORT " + localHost.split(".").join(",") + "," + i1 + "," + i2 + "\r\n");
                self.write("200 Port command successful. Consider using PASV.\r\n");
            }
        },
        'end': function () {
            conn.log('WARNING', "Client connection ended");
            conn.clientSocket.end();
        },
        'close': function () {
            conn.log('WARNING', "Client connection closed");
            conn.clientSocket.close();
        },
        'write': function (data) {
            conn.log('INFO', "Data sent to client: " + data.replace('\n', '').replace('\r', ''));
            conn.clientSocket.write(data);
        }
    };
    var server = {
        'write' : function(data) {
            eventEmitter.emit('clientHandler:serverData', data);
        }
    };

    return  self;
};

exports = module.exports = clientHandler;