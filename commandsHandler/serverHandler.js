var net = require('net');
var serverHandler = function (conn, serverData, eventEmitter, useStatsPlugin){
	useStatsPlugin = useStatsPlugin || false;
	var parser = require('../lib/commandParser');
	var _props = {
		'clientSIZECommand': false
	};
	var self = {
	    'initialData': null,
	    'init': function (data) {
	        conn.destination = serverData;
	        self.initialData = data;
	        conn.serverSocket = net.createConnection(conn.destination.port, conn.destination.host);
	        conn.serverSocket.setEncoding('ascii');
	        conn.serverSocket.setNoDelay();
	        self.listeners.init();
	    },
	    'listeners': {
	    	'init': function(){
	            eventEmitter.on('clientHandler:clientSIZE', self.listeners.onClientSIZE);
	            eventEmitter.on('clientHandler:serverData', self.write);
		        conn.serverSocket.on('connect', self.listeners.onConnect);
		        conn.serverSocket.on('data', self.listeners.onData);
		        conn.serverSocket.on('end', self.listeners.onEnd);
		        conn.serverSocket.on('error', self.listeners.onError);
	    	},
	    	'onConnect': function () {
		        self.write(self.initialData);
		    },
		    'onEnd': function () {
		        client.end();
		    },
		    'onError': function (err) {
		        conn.log('ERROR', "Error from server connection: " + err);
		        client.end();
		    },
		    'onData': function (data) {
		        data.split('\r\n').forEach(function (data) {
		            if ((data + '').trim()) {
		                self.handleResponse(data + '\r\n');
		            }
		        });
		    },
		    'onClientSIZE': function(data){
		    	_props.clientSIZECommand = true;
		    	self.write(data);
		    }
	    },
	    'handleResponse': function (data) {
	        conn.log('INFO', "Server response: " + (data + '').trim().toString('utf-8'));

	        var command = parser.parseFTPCommand(data);

            if (command.cmd === "426") {
                eventEmitter.emit('serverHandler:transferAborted', '');
            }

	        if (!conn.serverGreetingRecieved) {
	            /* suppress "welcome"-message, wait for the answer to the USER-command */
	            if (command.cmd.indexOf("220") != -1) {
	                conn.log('DEBUG', "Response suppressed.");
	            }
	            else { 
	            	conn.serverGreetingRecieved = true; client.write(data); 
	            }
	        }
	        else if (command.cmd === "227") {
				var passiveForwarder = new require('../connections/passiveForwarder')(conn, eventEmitter);
	        	passiveForwarder.intercept.passiveMode(command, self.passiveMode.forwardCallback, useStatsPlugin);
	        }
	        else if (command.cmd === "229") {
	        	var passiveForwarder = new require('../connections/passiveForwarder')(conn, eventEmitter);
	        	passiveForwarder.intercept.extendedPassiveMode(command, self.extendedPassiveMode.forwardCallback, useStatsPlugin); 
	        }
	        else if (command.cmd === "213" && parseFloat(command.arg)) {
				if(_props.clientSIZECommand === true) {
					_props.clientSIZECommand = false;
				}
				else {
					client.write(data);
				}
        		eventEmitter.emit('serverHandler:filseSize', parseFloat(command.arg));
	        }
	        else if (!(command.cmd == "200" && data.indexOf("PORT") != -1)) {
	            /* suppress "200 PORT command successful"-message. This message is sent from this proxy and shouldn't be forwarded to user. If so, user's connection will be closed because of protocol corruption */
	        	client.write(data);
	        }
	    },
	    'write': function (data) {
	        conn.log('INFO', "Data sent to server: " + (data + '').trim().toString('utf-8').replace(/^PASS\s+.*/, 'PASS ***').replace('\n', '').replace('\r', ''));
	        conn.serverSocket.write(data);
	    },
	    'passiveMode':{
	        'forwardCallback': function (localHost, localPort) {
	            var i1 = parseInt(localPort / 256); var i2 = parseInt(localPort % 256);
	            client.write("227 Entering Passive Mode (" + localHost.split(".").join(",") + "," + i1 + "," + i2 + ")\r\n");
	        }
	    },
	    'extendedPassiveMode':{
	        'forwardCallback': function (localHost, localPort) {
	            client.write("229 Entering Passive Mode (|||" + localPort + "|)\r\n");
	        }
	    }
	};
	var client = {
		'write' : function(data){
			eventEmitter.emit('serverHandler:clientData', data);
		},
		'end': function(){
			eventEmitter.emit('serverHandler:clientEnd');
		}
	};
    eventEmitter.on('clientHandler:initServer', self.init);
	return	self;
};

exports = module.exports = serverHandler;