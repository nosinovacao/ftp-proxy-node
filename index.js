var net = require('net');
var util = require('util');

var logger = null;

var ftpProxy = function (options) {

    if (!(this instanceof ftpProxy)) { return new ftpProxy(options); }

    var _props = {
        'localhost': options.localhost || '127.0.0.1',
        'server': net.createServer(),
        'serverData': options.serverData || { host: '127.0.0.1', port: '21' }
    };

    var _p = {
        'init': function () {
            _p.server.setBindings();
            logger = new loggingModule({ logLevel: options.logLevel });
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
                logger.write(logger.levels.error, "Server error: " + err);
            },
            'onListening': function () {
                logger.write(logger.levels.info, "FTP multiplexer up and ready for connections.");
            },
            'onConnected': function (clientSocket) {
                logger.write(logger.levels.debug, "New client connected");
                new clientConnection(clientSocket, _props);
            },
            'onClose': function () {
                logger.write(logger.levels.warning, "Server closed");
            }
        }
    };
    var self = _props.server;
    return _p.init();
};

var clientConnection = function (clientSocket, _props) {
    var conn = {
        clientSocket: clientSocket,
        serverSocket: null,
        serverGreetingRecieved: false,
        log: function (level, message, isError) { logger.write(level, clientSocket.remoteAddress + ': ' + message, isError); },
        destination: null
    };
    var clientForwardConnected = false;

    var client = {
        'init': function () {
            conn.clientSocket.setEncoding("ascii");
            conn.clientSocket.setNoDelay();

            conn.log(logger.levels.info, "Client connected.");
            client.write("220 FTP multiplexer ready\r\n");

            conn.clientSocket.on("end", client.onEnd);
            conn.clientSocket.on("error", client.onError);
            conn.clientSocket.on("data", client.onData);
        },
        'onEnd': function () {
            conn.log(logger.levels.warning, "Client disconnected.");
        },
        'onError': function (err) {
            conn.log(logger.levels.error, "Client connection error: " + err);
            conn.clientSocket.destroy();
        },
        'onData': function (data) {
            // Don't want to include passwords in logs.
            conn.log(logger.levels.info, "Client command:  " + (data + '').trim().toString('utf-8').replace(/^PASS\s+.*/, 'PASS ***'));

            if (conn.serverSocket !== null) {
                if (data.indexOf("MLSD") != -1 || data.indexOf("RETR") != -1) setTimeout(function () { server.write(data); }, 50); //HACK: in case of FTP Filezilla client, without the 50 ms timeout directories list is never loaded
                else server.write(data);
            } else {
                var command = parser.parseFTPCommand(data);
                if (command.cmd !== "USER") {
                    client.write("202 Not supported\r\n");
                } else {
                    conn.destination = _props.serverData;
                    if (conn.destination === null) {
                        client.write("530 Invalid username\r\n");
                    } else {
                        server.init(data);
                    }
                }
            }
        },
        'end': function () {
            conn.log(logger.levels.debug, "Client connection ended");
            conn.clientSocket.end();
        },
        'close': function () {
            conn.log(logger.levels.debug, "Client connection closed");
            conn.clientSocket.close();
        },
        'write': function (data) {
            conn.log(logger.levels.debug, "Data sent to client: " + data);
            conn.clientSocket.write(data);
        }
    };

    var server = {
        'initialData': null,
        'init': function (data) {
            server.initialData = data;
            conn.serverSocket = net.createConnection(conn.destination.port, conn.destination.host);
            conn.serverSocket.setEncoding('ascii');
            conn.serverSocket.setNoDelay();
            conn.serverSocket.on('connect', server.onConnect);
            conn.serverSocket.on('data', server.onData);
            conn.serverSocket.on('end', server.onEnd);
            conn.serverSocket.on('error', server.onError);
        },
        'onConnect': function () {
            server.write(server.initialData);
        },
        'onEnd': function () {
            client.end();
        },
        'onError': function (err) {
            conn.log(logger.levels.error, "Error from server connection: " + err);
            client.end();
        },
        'onData': function (data) {
            data.split('\r\n').forEach(function (data) {
                if ((data + '').trim()) {
                    server.handleResponse(data + '\r\n');
                }
            });
        },
        'handleResponse': function (data) {
            conn.log(logger.levels.info, "Server response: " + (data + '').trim().toString('utf-8'));

            var command = parser.parseFTPCommand(data);

            if (!conn.serverGreetingRecieved) {
                /* suppress "welcome"-message, wait for the answer to the USER-command */
                if (command.cmd.indexOf("220") != -1)
                    conn.log(logger.levels.debug, "Response suppressed.");
                else
                { conn.serverGreetingRecieved = true; client.write(data); }
            }
            else if (command.cmd === "227") server.passiveMode.intercept(command);
            else if (command.cmd === "229") server.extendedPassiveMode.intercept(command);
            else client.write(data);
        },
        'passiveMode': {
            'intercept': function (command) {
                /* intercept passive mode */
                conn.log(logger.levels.info, "Trying to intercept passive mode.");
                var m = command.arg.match(/.*\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3})\).*/);
                if (m) {
                    var host = m[1] + '.' + m[2] + '.' + m[3] + '.' + m[4];
                    var port = (parseInt(m[5]) * 256) + parseInt(m[6]);
                    passiveConnection.forward(host, port, server.passiveMode.forwardCallback);
                } else {
                    conn.log(logger.levels.warning, "Unable to parse PASV address.");
                }
            },
            'forwardCallback': function (localHost, localPort) {
                var i1 = parseInt(localPort / 256); var i2 = parseInt(localPort % 256);
                client.write("227 Entering Passive Mode (" + localHost.split(".").join(",") + "," + i1 + "," + i2 + ")\r\n");
            }
        },
        'extendedPassiveMode': {
            'intercept': function (command) {
                conn.log(logger.levels.info, "Trying to intercept extended passive mode.");
                var m = command.arg.match(/.*\(\|\|\|(\d{1,5})\|\).*/);
                if (m) {
                    var port = parseInt(m[1]);
                    passiveConnection.forward(conn.destination.host, port, server.extendedPassiveMode.forwardCallback);
                } else {
                    conn.log(logger.levels.warning, "Unable to parse EPASV address.");
                }
            },
            'forwardCallback': function (localHost, localPort) {
                client.write("229 Entering Passive Mode (|||" + localPort + "|)\r\n");
            }
        },
        'write': function (data) {
            conn.log(logger.levels.debug, "Data sent to server: " + data);
            conn.serverSocket.write(data);
        }
    };

    var passiveConnection = {
        'listener': null,
        'listenPort': null,
        'callback': null,
        'serverConnection': null,
        'serverConnected': false,
        'clientConnected': false,
        'forward': function (host, port, callback) {
            passiveConnection.callback = callback;
            conn.log(logger.levels.info, "Establishing forward for passive connection (" + host + ":" + port + ")");
            
            passiveConnection.serverConnected = false;
            passiveConnection.clientConnected = false;

            passiveConnection.listener = net.createServer(passiveConnection.serverCreated);
            passiveConnection.listener.listen(0, passiveConnection.listenerOnListen);
            passiveConnection.listener.on('error', passiveConnection.listenerOnError);

            passiveConnection.serverConnection = net.createConnection(port, host, passiveConnection.connectionCreated);
            passiveConnection.serverConnection.on('error', passiveConnection.serverOnError);
        },
        'serverCreated': function (lsocket) {
            if (passiveConnection.clientConnected) {
                logger.write(logger.levels.debug, "Client already connected.");
                lsocket.end();
            } else {
                conn.log(logger.levels.debug, "Client connected to forwarder.");
                passiveConnection.clientConnected = true;
                passiveConnection.listener.close();

                lsocket.on('error', function (err) {
                    conn.log(logger.levels.error, "Passive forwarding error: " + err, conn);
                    lsocket.destroy();
                });

                lsocket.pipe(passiveConnection.serverConnection);
                passiveConnection.serverConnection.pipe(lsocket);
            }
        },
        'connectionCreated': function () {
            conn.log(logger.levels.debug, "Connected to server.");
            passiveConnection.serverConnected = true;
            passiveConnection.tryNotifyingClient();
        },
        'listenerOnListen': function () {
            conn.log(logger.levels.debug, "Listening for client.");
            passiveConnection.listenPort = passiveConnection.listener.address().port;
            passiveConnection.tryNotifyingClient();
        },
        'listenerOnError': function (err) {
            conn.log(logger.levels.error, "Passive listener error: " + err, conn);
            passiveConnection.listener.destroy();
        },
        'serverOnError': function (err) {
            conn.log(logger.levels.error, "Passive forwarding error: " + err, conn);
            passiveConnection.serverConnection.destroy();
        },
        'tryNotifyingClient':  function () {
            if (!(passiveConnection.listenPort === null || !passiveConnection.serverConnected)) {
                conn.log(logger.levels.info, "Forwarder established, notifying client.");
                passiveConnection.callback(_props.localhost, passiveConnection.listenPort);
            }
        }
    };

    client.init();
};

var loggingModule = function (options) {
    return {
        'reportLevel': options.logLevel || 0,
        'levels': {
            'error': 0, 'warning': 1, 'info': 2, 'debug': 3
        },
        'write': function (level, message, isError) {
            if (logger.reportLevel >= level) {
                var now = new Date();
                var dateStr = now.getFullYear() + "-" + (1 + now.getMonth()) + "-" + now.getDate() + " " +
                              now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
                var msg = dateStr + " " + message;
                switch (logger.reportLevel) {
                    case logger.levels.error: console.error(msg); break;
                    case logger.levels.warning: console.warn(msg); break;
                    case logger.levels.info: console.info(msg); break;
                    default: console.log(msg); break;
                }

                if (isError) console.trace("Trace follows");
            }
        }
    }
};

var parser = (function () {
    return {
        'parseFTPCommand': function (data) {
            var m = (data + '').match(/\s*(\S*)(\s+(.*\S))?\s*/);
            var returnData;
            if (!m) returnData = { cmd: '', arg: '' };
            else returnData = { cmd: m[1], arg: m[3] };
            return returnData;
        }
    };
})();

//["listen", "close"].forEach(function (fname) {
//    FtpServer.prototype[fname] = function () {
//        return this.server[fname].apply(this.server, arguments);
//    }
//});

exports.FtpProxy = ftpProxy;
//function FtpServer(options) {
//        var self = this;
//        var sendServerData = function (clientSocket, conn, data){
//            conn.log(1, "Data sent to client:" + data);
//            clientSocket.write(data);
//        };
//        this.server.on("close", function() {
//            log(1, "Server closed");
//        });
//}