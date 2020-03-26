const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');
const AudioLevelObserver = require('./AudioLevelObserver');
const Transport = require('./Transport');

const logger = new Logger('Router');

class Router extends EventEmitter
{
	constructor({ socket })
	{
		logger.info('constructor()');

		super();

		this._socket = socket;

		this._closed = false;

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
		logger.info('_handleSocket()');

		this._socket.on('disconnect', () =>
		{
			this._closed = true;

			this.emit('close');
		});
	}

	async createAudioLevelObserver({
		maxEntries = 1,
		threshold = -80,
		interval = 800
	})
	{
		logger.info('createAudioLevelObserver()');

		try
		{
			await this._request(
				'createAudioLevelObserver',
				{
					maxEntries,
					threshold,
					interval
				});

			return new AudioLevelObserver({ socket: this._socket });
		}
		catch (error)
		{
			logger.warn('createAudioLevelObserver() | [error:"%o"]', error);
		}
	}

	async getRtpCapabilities()
	{
		logger.info('getRtpCapabilities()');

		try
		{
			const { rtpCapabilities } = await this._request('getRtpCapabilities');

			return rtpCapabilities;
		}
		catch (error)
		{
			logger.warn('getRtpCapabilities() | [error:"%o"]', error);
		}
	}

	async createWebRtcTransport(webRtcTransportOptions)
	{
		logger.info('createWebRtcTransport()');

		try
		{
			const {
				id,
				iceParameters,
				iceCandidates,
				dtlsParameters,
				appData
			} = await this._request('createWebRtcTransport', { webRtcTransportOptions });

			return new Transport({
				id,
				iceParameters,
				iceCandidates,
				dtlsParameters,
				appData,
				socket : this._socket
			});
		}
		catch (error)
		{
			logger.warn('createWebRtcTransport() | [error:"%o"]', error);
		}
	}

	async canConsume({ producerId, rtpCapabilities })
	{
		logger.info('canConsume()');

		try
		{
			const {
				canConsume
			} = await this._request('canConsume', { producerId, rtpCapabilities });

			return canConsume;
		}
		catch (error)
		{
			logger.warn('canConsume() | [error:"%o"]', error);
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

	_notification(method, data = {})
	{
		this._socket.emit('routerNotification', { method, data });
	}
}

module.exports = Router;