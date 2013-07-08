module.exports = exports = function(mqConfig, projectEventEmitter, logger){
	var amqp = require('amqp');
	var _p = {
		'init': function(){
			return self;
		},
		'exchange': mqConfig.exchange,
		'RK': mqConfig.RK,
		'connection' : null,
		'publishers': {},
		'connectionReady': function() {
			logger.info('STATS PLUGIN - RabbitMQ - ready');
			_p.publishers[_p.exchange.Name] = _p.connection.exchange(_p.exchange.name, _p.exchange.options, _p.publisherConnected);
		},
		'connectionError': function(err) {
			logger.error('STATS PLUGIN - RabbitMQ - ' + err);
		},
		'publisherConnected': function() {
			logger.info('STATS PLUGIN - RabbitMQ - Publisher connected');
			projectEventEmitter.emit('MP:PublisherConnected');
		}	
	};
	var self = {
		'init': function() {
			_p.connection = amqp.createConnection({ url: mqConfig.connectionString });
			_p.connection.addListener('ready', _p.connectionReady);
			_p.connection.addListener('error', _p.connectionError);
		},
		'write': function(exchangeName, routingKey, data) {
			var RK = _p.RK[routingKey];
			logger.debug('STATS PLUGIN - RabbitMQ - ' + RK.name);
			console.log(data);
			_p.publishers[exchangeName].publish(RK.name, JSON.stringify(data), RK.options);
		},
		'writeSnapshot': function (data) {
			if (_p.publishers[_p.exchange.Name]) self.write(_p.exchange.Name, 'snapshot', data);
		},
		'writeOnTransferStarted': function (data) {
			if (_p.publishers[_p.exchange.Name]) self.write(_p.exchange.Name, 'onTransferStarted', data);
		},
		'writeOnTransferEnded': function (data) {
			if (_p.publishers[_p.exchange.Name]) self.write(_p.exchange.Name, 'onTransferEnded', data);
		},
		'writeOnTransferAborted': function (data) {
			if (_p.publishers[_p.exchange.Name]) self.write(_p.exchange.Name, 'onTransferAborted', data);
		}
	};

	return _p.init();
}