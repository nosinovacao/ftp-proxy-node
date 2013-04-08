var net = require('net');
var passiveForwarder = function(conn, eventEmitter) {
	var self = {
	    'callback': null,
	    'listener': null,
	    'listenPort': null,
	    'serverConnection': null,
	    'serverConnected': false,
	    'clientConnected': true,
	    'clientCommandPort': 0,
	    'useStatsPlugin': false,
	    'intercept': {
	        'passiveMode': function (command, forwardCallback, useStatsPlugin) {
	        	self.useStatsPlugin = useStatsPlugin;
	            conn.log('INFO', "Trying to intercept passive mode.");
	            var m = command.arg.match(/.*\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3})\).*/);
	            if (m) {
	                var host = m[1] + '.' + m[2] + '.' + m[3] + '.' + m[4];
	                var port = (parseInt(m[5]) * 256) + parseInt(m[6]);
	                self.forward(host, port, forwardCallback);
	            } 
	            else {
	                conn.log('WARNING', "Unable to parse PASV address.");
	            }
	        },
	    	'extendedPassiveMode': function (command, forwardCallback, useStatsPlugin) {
	    		self.useStatsPlugin = useStatsPlugin;
	            conn.log('INFO', "Trying to intercept extended passive mode.");
	            var m = command.arg.match(/.*\(\|\|\|(\d{1,5})\|\).*/);
	            if (m) {
	                var port = parseInt(m[1]);
	                self.forward(conn.destination.host, port, forwardCallback);
	            } 
	            else {
	                conn.log('WARNING', "Unable to parse EPASV address.");
	            }
	        }
	    },
	    'forward': function (host, port, callback) {
	    	self.clientCommandPort = conn.clientSocket.remotePort;
	        self.callback = callback;
	        conn.log('DEBUG', "Establishing forward for passive connection (" + host + ":" + port + ")");

	        self.serverConnected = false;
	        self.clientConnected = false;

            eventEmitter.emit('passiveForwarder:forwarding');

	        self.listener = net.createServer(self.serverCreated);
	        self.listener.listen(0, self.listenerOnListen);
	        self.listener.on('error', self.listenerOnError);

	        self.serverConnection = net.createConnection(port, host, self.connectionCreated);
	        self.serverConnection.on('error', self.serverOnError);

	        if (self.useStatsPlugin) {
	            self.serverConnection.on('data', function(data){
	                eventEmitter.emit('passiveForwarder:fileBufferSent', { length: data.length, port: self.clientCommandPort });
	            });
	        }
	    },
	    'serverCreated': function (lsocket) {
	        if (self.clientConnected) {
	            conn.log('DEBUG', "Client already connected.");
	            lsocket.end();
	        } 
	        else {
	            conn.log('INFO', "Client connected to forwarder.");
	            self.clientConnected = true;

	            self.listener.close();
	            eventEmitter.emit('passiveForwarder:clientConnected');

	            lsocket.on('error', function (err) {
	                conn.log('ERROR', "Passive forwarding error: " + err, conn);
	                lsocket.destroy();
	            });

	            lsocket.pipe(self.serverConnection);
	            self.serverConnection.pipe(lsocket);
	        }
	    },
	    'connectionCreated': function () {
	        conn.log('DEBUG', "Connected to server.");
	        self.serverConnected = true;
	        self.tryNotifyingClient();
	    },
	    'listenerOnListen': function () {
	        conn.log('DEBUG', "Listening for client.");
	        self.listenPort = self.listener.address().port;
	        self.tryNotifyingClient();
	    },
	    'listenerOnError': function (err) {
	        conn.log('ERROR', "Passive listener error: " + err, conn);
	        self.listener.destroy();
	    },
	    'serverOnError': function (err) {
	        conn.log('ERROR', "Passive forwarding error: " + err, conn);
	        self.serverConnection.destroy();
	    },
	    'tryNotifyingClient': function () {
	        if (!(self.listenPort === null || !self.serverConnected)) {
	            conn.log('INFO', "Forwarder established, notifying client.");
	            self.callback(conn.clientSocket.address().address, self.listenPort);
	        }
	    }
	};;
	return self;
};

exports = module.exports = passiveForwarder;