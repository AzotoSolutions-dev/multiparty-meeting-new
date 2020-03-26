const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');
const Producer = require('./Producer');
const Consumer = require('./Consumer');

const logger = new Logger('Transport');

class Transport extends EventEmitter
{
	constructor({ id, iceParameters, iceCandidates, dtlsParameters, appData, socket })
	{
		logger.info('constructor()');

		super();

		this._id = id;

		this._iceParameters = iceParameters;

		this._iceCandidates = iceCandidates;

		this._dtlsParameters = dtlsParameters;

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

		this._socket.on('transportNotification', (notification) =>
		{
			if (notification.data.id === this._id)
			{
				switch (notification.method)
				{
					case 'dtlsstatechange':
					{
						const { dtlsState } = notification.data;
	
						this.emit('dtlsstatechange', dtlsState);
	
						break;
					}
				}
			}
		});
	}

	async setMaxIncomingBitrate(maxIncomingBitrate)
	{
		try
		{
			await this._request('setMaxIncomingBitrate', { maxIncomingBitrate });
		}
		catch (error)
		{
			logger.warn('setMaxIncomingBitrate() | [error:"%o"]', error);
		}
	}

	async connect({ dtlsParameters })
	{
		try
		{
			await this._request('connect', { dtlsParameters });
		}
		catch (error)
		{
			logger.warn('connect() | [error:"%o"]', error);
		}
	}

	async restartIce()
	{
		try
		{
			const { iceParameters } = await this._request('restartIce');

			this._iceParameters = iceParameters;
		}
		catch (error)
		{
			logger.warn('restartIce() | [error:"%o"]', error);
		}
	}

	async produce({ kind, rtpParameters, appData })
	{
		try
		{
			const { id } = await this._request(
				'produce',
				{ kind, rtpParameters, appData }
			);

			return new Producer({ id, kind, appData, socket: this._socket });
		}
		catch (error)
		{
			logger.warn('produce() | [error:"%o"]', error);
		}
	}

	async consume({ producerId, rtpCapabilities, paused })
	{
		try
		{
			const {
				id,
				kind,
				rtpParameters,
				type,
				producerPaused,
				score,
				appData
			} = await this._request(
				'consume',
				{ producerId, rtpCapabilities, paused }
			);

			return new Consumer({
				id,
				kind,
				rtpParameters,
				type,
				producerPaused,
				score,
				appData,
				socket : this._socket
			});
		}
		catch (error)
		{
			logger.warn('produce() | [error:"%o"]', error);
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
			const transportData = Object.assign({ id: this.id }, data);

			this._socket.emit(
				'transportRequest',
				{ method, data: transportData },
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
		const transportData = Object.assign({ id: this.id }, data);

		this._socket.emit('transportNotification', { method, data: transportData });
	}

	get id()
	{
		return this._id;
	}

	get iceParameters()
	{
		return this._iceParameters;
	}

	get iceCandidates()
	{
		return this._iceCandidates;
	}

	get dtlsParameters()
	{
		return this._dtlsParameters;
	}

	get appData()
	{
		return this._appData;
	}
}

module.exports = Transport;