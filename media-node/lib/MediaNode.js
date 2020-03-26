const osu = require('node-os-utils');
const Logger = require('./Logger');

const cpu = osu.cpu;
const logger = new Logger('MediaNode');

class MediaNode
{
	constructor()
	{
		logger.info('constructor()');

		this._currentFree = 100;

		this._cpuTimer = null;

		// Start periodic ping
		this._cpuFree = async () =>
		{
			try
			{
				this._currentFree = await cpu.free();

				logger.info(this._currentFree);
			}
			catch (error)
			{
				this._available = false;
	
				logger.error('_cpuFree() [error:"%s"]', error);
			}
	
			this._cpuTimer = setTimeout(this._cpuFree, 1000);
		};

		this._cpuFree();
	}

	close()
	{
		if (this._cpuTimer)
			clearInterval(this._cpuTimer);
	}

	_handleSocket({ socket })
	{
		logger.debug('_handleSocket()');

		socket.on('mediaNodeRequest', (request, cb) =>
		{
			logger.debug(
				'"mediaNodeRequest" event [method:"%s"]',
				request.method);

			this._handleMediaNodeRequest(request, cb)
				.catch((error) =>
				{
					logger.error('"mediaNodeRequest" failed [error:"%o"]', error);

					cb(error);
				});
		});

		socket.on('mediaNodeNotification', (notification) =>
		{
			logger.debug(
				'socket "mediaNodeNotification" event [method:"%s"]',
				notification.method);

			switch (notification.method)
			{
				case 'close':
				{
					this.close();

					break;
				}

				default:
				{
					logger.error('unknown mediaNodeNotification.method "%s"', notification.method);
				}
			}
		});
	}

	async _handleMediaNodeRequest(request, cb)
	{
		switch (request.method)
		{
			case 'free':
			{
				cb(null, { free: this._currentFree });

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				cb(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	_notification(socket, type, method, data = {})
	{
		socket.emit(type, { method, data });
	}
}

module.exports = MediaNode;
