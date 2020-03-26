const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');

const logger = new Logger('Consumer');

class Consumer extends EventEmitter
{
	constructor({ id, kind, rtpParameters, type, producerPaused, score, appData, socket })
	{
		logger.info('constructor()');

		super();

		this._id = id;

		this._kind = kind;

		this._rtpParameters = rtpParameters;

		this._type = type;

		this._producerPaused = producerPaused;

		this._score = score;

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

		this._socket.on('consumerNotification', (notification) =>
		{
			const { id } = notification.data;

			if (id === this._id)
			{
				switch (notification.method)
				{
					case 'transportclose':
					{
						this.emit('transportclose');

						break;
					}

					case 'producerclose':
					{
						this.emit('producerclose');

						break;
					}

					case 'producerpause':
					{
						this._producerPaused = true;

						this.emit('producerpause');

						break;
					}

					case 'producerresume':
					{
						this._producerPaused = false;

						this.emit('producerresume');

						break;
					}

					case 'score':
					{
						const { score } = notification.data;

						this._score = score;

						this.emit('score', score);

						break;
					}

					case 'layerschange':
					{
						const { layers } = notification.data;

						this.emit('layerschange', layers);

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

	async setPreferredLayers({ spatialLayer, temporalLayer })
	{
		try
		{
			await this._request('setPreferredLayers', { spatialLayer, temporalLayer });
		}
		catch (error)
		{
			logger.warn('setPreferredLayers() | [error:"%o"]', error);
		}
	}

	async setPriority(priority)
	{
		try
		{
			await this._request('setPriority', { priority });
		}
		catch (error)
		{
			logger.warn('setPriority() | [error:"%o"]', error);
		}
	}

	async requestKeyFrame()
	{
		try
		{
			await this._request('requestKeyFrame');
		}
		catch (error)
		{
			logger.warn('requestKeyFrame() | [error:"%o"]', error);
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
			const consumerData = Object.assign({ id: this.id }, data);

			this._socket.emit(
				'consumerRequest',
				{ method, data: consumerData },
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
		const consumerData = Object.assign({ id: this.id }, data);

		this._socket.emit('consumerNotification', { method, data: consumerData });
	}

	get id()
	{
		return this._id;
	}

	get kind()
	{
		return this._kind;
	}

	get rtpParameters()
	{
		return this._rtpParameters;
	}

	get type()
	{
		return this._type;
	}

	get producerPaused()
	{
		return this._producerPaused;
	}

	get score()
	{
		return this._score;
	}

	get appData()
	{
		return this._appData;
	}
}

module.exports = Consumer;