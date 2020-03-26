const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');

const logger = new Logger('Router');

class Router extends EventEmitter
{
	constructor({ mediasoupRouter, socket })
	{
		logger.info('constructor()');

		super();
		this.setMaxListeners(Infinity);

		// mediasoup Router instance.
		this._mediasoupRouter = mediasoupRouter;

		this._socket = socket;

		// Closed flag.
		this._closed = false;

		// mediasoup AudioLevelObserver.
		this._audioLevelObserver = null;

		this._transports = new Map();

		this._producers = new Map();

		this._consumers = new Map();

		this._handleSocket();
	}

	close()
	{
		logger.debug('close()');

		this._closed = true;

		this._transports.forEach((transport) =>
		{
			transport.close();
		});

		// Close the mediasoup Router.
		this._mediasoupRouter.close();

		// Emit 'close' event.
		this.emit('close');
	}

	_handleAudioLevelObserver()
	{
		// Set audioLevelObserver events.
		this._audioLevelObserver.on('volumes', (volumes) =>
		{
			this._notification('audioNotification', 'volumes', { volumes });
		});

		this._audioLevelObserver.on('silence', () =>
		{
			this._notification('audioNotification', 'silence');
		});
	}

	_handleSocket()
	{
		logger.debug('_handleSocket()');

		this._socket.on('routerRequest', (request, cb) =>
		{
			logger.debug(
				'"routerRequest" event [method:"%s"]',
				request.method);

			this._handleRouterRequest(request, cb)
				.catch((error) =>
				{
					logger.error('"routerRequest" failed [error:"%o"]', error);

					cb(error);
				});
		});

		this._socket.on('routerNotification', (notification) =>
		{
			logger.debug(
				'socket "routerNotification" event [method:%s, data:%o]',
				notification.method, notification.data);

			switch (notification.method)
			{
				case 'close':
				{
					this.close();

					break;
				}

				default:
				{
					logger.error('unknown routerNotification.method "%s"', notification.method);
				}
			}
		});

		this._socket.on('audioRequest', (request, cb) =>
		{
			logger.debug(
				'"audioRequest" event [method:"%s"]',
				request.method);

			this._handleAudioRequest(request, cb)
				.catch((error) =>
				{
					logger.error('"audioRequest" failed [error:"%o"]', error);

					cb(error);
				});
		});

		this._socket.on('transportRequest', (request, cb) =>
		{
			logger.debug(
				'"transportRequest" event [method:"%s"]',
				request.method);

			this._handleTransportRequest(request, cb)
				.catch((error) =>
				{
					logger.error('"transportRequest" failed [error:"%o"]', error);

					cb(error);
				});
		});

		this._socket.on('transportNotification', (notification) =>
		{
			logger.debug(
				'socket "transportNotification" event [method:%s, data:%o]',
				notification.method, notification.data);

			switch (notification.method)
			{
				case 'close':
				{
					const { id } = notification.data;

					const transport = this._transports.get(id);

					if (!transport)
						return;

					transport.close();

					this._transports.delete(id);

					break;
				}

				default:
				{
					logger.error('unknown transportNotification.method "%s"', notification.method);
				}
			}
		});

		this._socket.on('producerRequest', (request, cb) =>
		{
			logger.debug(
				'"producerRequest" event [method:"%s"]',
				request.method);

			this._handleProducerRequest(request, cb)
				.catch((error) =>
				{
					logger.error('"producerRequest" failed [error:"%o"]', error);

					cb(error);
				});
		});

		this._socket.on('producerNotification', (notification) =>
		{
			logger.debug(
				'socket "producerNotification" event [method:%s, data:%o]',
				notification.method, notification.data);

			switch (notification.method)
			{
				case 'close':
				{
					const { id } = notification.data;

					const producer = this._producers.get(id);

					if (!producer)
						return;

					producer.close();

					this._producers.delete(id);

					break;
				}

				default:
				{
					logger.error('unknown producerNotification.method "%s"', notification.method);
				}
			}
		});

		this._socket.on('consumerRequest', (request, cb) =>
		{
			logger.debug(
				'"consumerRequest" event [method:"%s"]',
				request.method);

			this._handleConsumerRequest(request, cb)
				.catch((error) =>
				{
					logger.error('"consumerRequest" failed [error:"%o"]', error);

					cb(error);
				});
		});

		this._socket.on('consumerNotification', (notification) =>
		{
			logger.debug(
				'socket "consumerNotification" event [method:%s, data:%o]',
				notification.method, notification.data);

			switch (notification.method)
			{
				case 'close':
				{
					const { id } = notification.data;

					const consumer = this._consumers.get(id);

					if (!consumer)
						return;

					consumer.close();

					this._consumers.delete(id);

					break;
				}

				default:
				{
					logger.error('unknown consumerNotification.method "%s"', notification.method);
				}
			}
		});
	}

	async _handleRouterRequest(request, cb)
	{
		switch (request.method)
		{
			case 'createAudioLevelObserver':
			{
				const {
					maxEntries,
					threshold,
					interval
				} = request.data;

				this._audioLevelObserver =
					await this._mediasoupRouter.createAudioLevelObserver(
						{
							maxEntries,
							threshold,
							interval
						});

				cb();

				this._handleAudioLevelObserver();

				break;
			}

			case 'getRtpCapabilities':
			{
				cb(null, { rtpCapabilities: this._mediasoupRouter.rtpCapabilities });

				break;
			}

			case 'createWebRtcTransport':
			{
				const { webRtcTransportOptions } = request.data;

				const transport = await this._mediasoupRouter.createWebRtcTransport(
					webRtcTransportOptions
				);

				this._transports.set(transport.id, transport);

				transport.on('dtlsstatechange', (dtlsState) =>
				{
					this._notification(
						'transportNotification',
						'dtlsstatechange',
						{ id: transport.id, dtlsState }
					);
				});

				cb(
					null,
					{
						id             : transport.id,
						iceParameters  : transport.iceParameters,
						iceCandidates  : transport.iceCandidates,
						dtlsParameters : transport.dtlsParameters,
						appData        : transport.appData
					}
				);

				break;
			}

			case 'canConsume':
			{
				const { producerId, rtpCapabilities } = request.data;

				const canConsume =
					this._mediasoupRouter.canConsume({ producerId, rtpCapabilities });

				cb(null, { canConsume });

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				cb(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	async _handleAudioRequest(request, cb)
	{
		switch (request.method)
		{
			case 'addProducer':
			{
				const { producerId } = request.data;

				this._audioLevelObserver.addProducer({ producerId })
					.catch(() => {});

				cb();

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				cb(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	async _handleTransportRequest(request, cb)
	{
		switch (request.method)
		{
			case 'setMaxIncomingBitrate':
			{
				const { id, maxIncomingBitrate } = request.data;

				const transport = this._transports.get(id);

				if (!transport)
					throw new Error('No such transport');

				try { await transport.setMaxIncomingBitrate(maxIncomingBitrate); }
				catch (error) {}

				cb();

				break;
			}

			case 'connect':
			{
				const { id, dtlsParameters } = request.data;

				const transport = this._transports.get(id);

				if (!transport)
					throw new Error('No such transport');

				await transport.connect({ dtlsParameters });

				cb();

				break;
			}

			case 'restartIce':
			{
				const { id } = request.data;

				const transport = this._transports.get(id);

				if (!transport)
					throw new Error('No such transport');

				const iceParameters = await transport.restartIce();

				cb(null, { iceParameters });

				break;
			}

			case 'produce':
			{
				const { id, kind, rtpParameters, appData } = request.data;

				const transport = this._transports.get(id);

				if (!transport)
					throw new Error('No such transport');

				const producer =
					await transport.produce({ kind, rtpParameters, appData });

				this._producers.set(producer.id, producer);

				producer.on('score', (score) =>
				{
					this._notification('producerNotification', 'score', { id: producer.id, score });
				});

				producer.on('videoorientationchange', (videoOrientation) =>
				{
					this._notification(
						'producerNotification',
						'videoorientationchange',
						{ id: producer.id, videoOrientation }
					);
				});

				cb(null, { id: producer.id });

				break;
			}

			case 'consume':
			{
				const { id, producerId, rtpCapabilities, paused } = request.data;

				const transport = this._transports.get(id);

				if (!transport)
					throw new Error('No such transport');

				const consumer =
					await transport.consume({ producerId, rtpCapabilities, paused });

				this._consumers.set(consumer.id, consumer);

				// Set Consumer events.
				consumer.on('transportclose', () =>
				{
					this._notification('consumerNotification', 'transportclose', { id: consumer.id });
					// Remove from its map.
					this._consumers.delete(consumer.id);
				});

				consumer.on('producerclose', () =>
				{
					this._notification('consumerNotification', 'producerclose', { id: consumer.id });
				});

				consumer.on('producerpause', () =>
				{
					this._notification('consumerNotification', 'producerpause', { id: consumer.id });
				});

				consumer.on('producerresume', () =>
				{
					this._notification('consumerNotification', 'producerresume', { id: consumer.id });
				});

				consumer.on('score', (score) =>
				{
					this._notification('consumerNotification', 'score', { id: consumer.id, score });
				});

				consumer.on('layerschange', (layers) =>
				{
					this._notification('consumerNotification', 'layerschange', { id: consumer.id, layers });
				});

				cb(
					null,
					{
						id             : consumer.id,
						kind           : consumer.kind,
						rtpParameters  : consumer.rtpParameters,
						type           : consumer.type,
						producerPaused : consumer.producerPaused,
						score          : consumer.score,
						appData        : consumer.appData
					}
				);

				break;
			}

			case 'getStats':
			{
				const { id } = request.data;

				const transport = this._transports.get(id);

				if (!transport)
					throw new Error('No such transport');

				const stats = await transport.getStats();

				cb(null, { stats });

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				cb(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	async _handleProducerRequest(request, cb)
	{
		switch (request.method)
		{
			case 'pause':
			{
				const { id } = request.data;

				const producer = this._producers.get(id);

				if (!producer)
					throw new Error('No such producer');

				await producer.pause();

				cb();

				break;
			}

			case 'resume':
			{
				const { id } = request.data;

				const producer = this._producers.get(id);

				if (!producer)
					throw new Error('No such producer');

				await producer.resume();

				cb();

				break;
			}

			case 'getStats':
			{
				const { id } = request.data;

				const producer = this._producers.get(id);

				if (!producer)
					throw new Error('No such producer');

				const stats = await producer.getStats();

				cb(null, { stats });

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				cb(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	async _handleConsumerRequest(request, cb)
	{
		switch (request.method)
		{
			case 'pause':
			{
				const { id } = request.data;

				const consumer = this._consumers.get(id);

				if (!consumer)
					throw new Error('No such consumer');

				await consumer.pause();

				cb();

				break;
			}

			case 'resume':
			{
				const { id } = request.data;

				const consumer = this._consumers.get(id);

				if (!consumer)
					throw new Error('No such consumer');

				await consumer.resume();

				cb();

				break;
			}

			case 'setPreferredLayers':
			{
				const { id, spatialLayer, temporalLayer } = request.data;

				const consumer = this._consumers.get(id);

				if (!consumer)
					throw new Error('No such consumer');

				await consumer.setPreferredLayers({ spatialLayer, temporalLayer });

				cb();

				break;
			}

			case 'setPriority':
			{
				const { id, priority } = request.data;

				const consumer = this._consumers.get(id);

				if (!consumer)
					throw new Error('No such consumer');

				await consumer.setPriority(priority);

				cb();

				break;
			}

			case 'requestKeyFrame':
			{
				const { id } = request.data;

				const consumer = this._consumers.get(id);

				if (!consumer)
					throw new Error('No such consumer');

				await consumer.requestKeyFrame();

				cb();

				break;
			}

			case 'getStats':
			{
				const { id } = request.data;

				const consumer = this._consumers.get(id);

				if (!consumer)
					throw new Error('No such consumer');

				const stats = await consumer.getStats();

				cb(null, { stats });

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				cb(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	_notification(type, method, data = {})
	{
		this._socket.emit(type, { method, data });
	}
}

module.exports = Router;
