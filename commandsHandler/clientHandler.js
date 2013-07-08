var clientHandler = function (conn, eventEmitter, useStatsPlugin) {
    useStatsPlugin = useStatsPlugin || false;
    var parser = require('../lib/commandParser');
    var _props = {
        passiveConnection : { clientConnected : true },
        activeConnection : { clientConnected : true, serverConnected : true },
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
                eventEmitter.on('serverHandler:200PORT', self.listeners.onServerPortConnected);
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



            'onServerPortConnected': function () {
				conn.log('DEBUG', "clientHandler - 200 PORT command successful received from server");
                _props.activeConnection.serverConnected = true;
            },
            'onError': function (err) {
                conn.log('ERROR', "Client connection error: " + err);
                conn.clientSocket.destroy();
            },
            'onEnd': function () {
                eventEmitter.emit('clientHandler:clientEnd');
                conn.log('WARNING', "Client disconnected.");
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
						console.log(_props.fileSize);
                        if(_props.fileSize === false) { //If file size is false, send size command to server
                            eventEmitter.emit('clientHandler:clientSIZE', 'SIZE ' + command.arg + '\r\n'); //Gets file size
							//if file size doesnt exists, wait for size to send retr command
							eventEmitter.once('serverHandler:filseSize', function(){
								server.write(data);

								_props.fileSize = true;
							});
                        }
                        else {
                            _props.fileSize = false;
                        }
                        eventEmitter.emit('clientHandler:clientRETR', command.arg); //Sends file name
                    } 
                    else if (command.cmd === "SIZE") {
                        eventEmitter.emit('clientHandler:clientRETR', command.arg); //Sends file name
                    }

                    if (_props.passiveConnection.clientConnected == false) {
                        eventEmitter.once('passiveForwarder:clientConnected', passiveClientConnected);
                        function passiveClientConnected() {
                            _props.passiveConnection.clientConnected = true;
                            server.write(data);








                        }
                    } 
                    else if (_props.activeConnection.clientConnected === false || _props.activeConnection.serverConnected === false) {
						if (_props.activeConnection.clientConnected === false)
						{
							eventEmitter.once('activeForwarder:clientConnected', activeClientConnected);
							function activeClientConnected() {
								conn.log('DEBUG', "clientHandler - Active client connection established");
								if (_props.activeConnection.serverConnected === true) {
									_props.activeConnection.clientConnected = true;
									server.write(data);
								}
							}
						}
						if (_props.activeConnection.serverConnected === false)
						{
							conn.log('DEBUG', "clientHandler - Waiting for server's 200 port command received");
							//wait for event serverHandler:200PORT
							eventEmitter.once('serverHandler:200PORT', activeServerConnected);
							function activeServerConnected() {
								conn.log('DEBUG', "clientHandler - Server 200 port command received");
								if (_props.activeConnection.clientConnected === true) {
									_props.activeConnection.serverConnected = true;
									server.write(data);
								}
							}							
						}
                    }
                    else if (command.cmd === "PORT") {
						conn.log('DEBUG', "clientHandler - PORT command received from client");
						//if client sends port command, set active server connection to false
						_props.activeConnection.serverConnected = false;
                        var activeForwarder = new require('../connections/activeForwarder')(conn, eventEmitter);
                        activeForwarder.intercept.activeMode(command, self.activeMode.forwardCallback, useStatsPlugin);
                        eventEmitter.once('activeForwarder:clientConnected', PORTActiveClientConnected);
                        function PORTActiveClientConnected() {
                            _props.activeConnection.clientConnected = true;

                        }

                    }					
                    else if (command.cmd === "RETR" && _props.fileSize === true){
                        server.write(data);

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
                self.write("200 Port command successful\r\n");
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