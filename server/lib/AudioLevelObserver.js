const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');

const logger = new Logger('AudioLevelObserver');

class AudioLevelObserver extends EventEmitter
{
	constructor({ socket })
	{
		logger.info('constructor()');

		super();

		this._socket = socket;

		this._handleSocket();
	}

	_handleSocket()
	{
		this._socket.on('routerNotification', (notification) =>
		{
			switch (notification.method)
			{
				case 'volumes':
				{
					const { volumes } = notification.data;

					this.emit('volumes', volumes);

					break;
				}

				case 'silence':
				{
					this.emit('silence');

					break;
				}
			}
		});
	}

	async addProducer({ producerId })
	{
		logger.info('addProducer()');

		try
		{
			await this._request('addProducer', { producerId });
		}
		catch (error)
		{
			logger.warn('addProducer() | [error:"%o"]', error);
		}
	}

	_timeoutCallback(callback)
	{
		let called = false;

		const interval = setTimeout(
			() =>
			{
				if (called)
					return;
				called = true;
				callback(new Error('Request timeout.'));
			},
			10000
		);

		return (...args) =>
		{
			if (called)
				return;
			called = true;
			clearTimeout(interval);

			callback(...args);
		};
	}

	_request(method, data = {})
	{
		return new Promise((resolve, reject) =>
		{
			this._socket.emit(
				'routerRequest',
				{ method, data },
				this._timeoutCallback((err, response) =>
				{
					if (err)
					{
						reject(err);
					}
					else
					{
						resolve(response);
					}
				})
			);
		});
	}
}

module.exports = AudioLevelObserver;