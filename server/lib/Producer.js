const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');

const logger = new Logger('Producer');

class Producer extends EventEmitter
{
	constructor({ id, kind, appData, socket })
	{
		logger.info('constructor()');

		super();

		this._id = id;

		this._kind = kind;

		this._appData = appData;

		this._socket = socket;

		this._handleSocket();
	}

	close()
	{
		logger.debug('close()');

		this._closed = true;

		this._notification('close');
	}

	_handleSocket()
	{
		this._socket.on('disconnect', () =>
		{
			this._closed = true;

			this.emit('close');
		});

		this._socket.on('producerNotification', (notification) =>
		{
			const { id } = notification.data;

			if (id === this._id)
			{
				switch (notification.method)
				{
					case 'score':
					{
						const { score } = notification.data;

						this.emit('score', score);

						break;
					}

					case 'videoorientationchange':
					{
						const { videoOrientation } = notification.data;

						this.emit('videoorientationchange', videoOrientation);

						break;
					}
				}
			}
		});
	}

	async pause()
	{
		try
		{
			await this._request('pause');
		}
		catch (error)
		{
			logger.warn('pause() | [error:"%o"]', error);
		}
	}

	async resume()
	{
		try
		{
			await this._request('resume');
		}
		catch (error)
		{
			logger.warn('resume() | [error:"%o"]', error);
		}
	}

	async getStats()
	{
		try
		{
			const { stats } = await this._request('getStats');

			return stats;
		}
		catch (error)
		{
			logger.warn('getStats() | [error:"%o"]', error);
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
			const producerData = Object.assign({ id: this.id }, data);

			this._socket.emit(
				'producerRequest',
				{ method, data: producerData },
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

	_notification(method, data = {})
	{
		const producerData = Object.assign({ id: this.id }, data);

		this._socket.emit('producerNotification', { method, data: producerData });
	}

	get id()
	{
		return this._id;
	}

	get kind()
	{
		return this._kind;
	}

	get appData()
	{
		return this._appData;
	}
}

module.exports = Producer;