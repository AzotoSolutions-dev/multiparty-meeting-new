#!/usr/bin/env node

process.title = 'multiparty-meeting-media-node';

const config = require('./config/config');
const fs = require('fs');
const https = require('https');
const express = require('express');
const mediasoup = require('mediasoup');
const AwaitQueue = require('awaitqueue');
const Logger = require('./lib/Logger');
const Router = require('./lib/Router');
const helmet = require('helmet');
const interactiveServer = require('./lib/interactiveServer');

/* eslint-disable no-console */
console.log('- process.env.DEBUG:', process.env.DEBUG);
console.log('- config.mediasoup.logLevel:', config.mediasoup.logLevel);
console.log('- config.mediasoup.logTags:', config.mediasoup.logTags);
/* eslint-enable no-console */

const logger = new Logger();

const queue = new AwaitQueue();

// mediasoup Workers.
// @type {Array<mediasoup.Worker>}
const mediasoupWorkers = [];

// Index of next mediasoup Worker to use.
// @type {Number}
let nextMediasoupWorkerIdx = 0;

// Map of Room instances indexed by roomId.
const routers = new Map();

// TLS server configuration.
const tls =
{
	cert          : fs.readFileSync(config.tls.cert),
	key           : fs.readFileSync(config.tls.key),
	secureOptions : 'tlsv12',
	ciphers       :
	[
		'ECDHE-ECDSA-AES128-GCM-SHA256',
		'ECDHE-RSA-AES128-GCM-SHA256',
		'ECDHE-ECDSA-AES256-GCM-SHA384',
		'ECDHE-RSA-AES256-GCM-SHA384',
		'ECDHE-ECDSA-CHACHA20-POLY1305',
		'ECDHE-RSA-CHACHA20-POLY1305',
		'DHE-RSA-AES128-GCM-SHA256',
		'DHE-RSA-AES256-GCM-SHA384'
	].join(':'),
	honorCipherOrder : true
};

const app = express();

app.use(helmet.hsts());

let listener;
let io;

async function run()
{
	// Open the interactive server.
	await interactiveServer();

	// Run a mediasoup Worker.
	await runMediasoupWorkers();

	// Run HTTPS server.
	await runHttpsServer();

	// Run WebSocketServer.
	await runWebSocketServer();
}

async function runHttpsServer()
{
	// https
	listener = https.createServer(tls, app);

	// https or http
	listener.listen(config.listeningPort);
}

/**
 * Create a WebSocketServer to allow WebSocket connections from browsers.
 */
async function runWebSocketServer()
{
	io = require('socket.io')(listener);

	// Handle connections from clients.
	io.on('connection', (socket) =>
	{
		logger.info('connection request');

		const { secret } = socket.handshake.query;

		if (!secret || secret !== config.mediaNodeSecret)
		{
			logger.warn('no, or wrong secret in request');

			socket.disconnect(true);

			return;
		}

		socket.on('workerRequest', async (request, cb) =>
		{
			logger.debug(
				'socket "request" event [method:%s, data:%o]',
				request.method, request.data);

			switch (request.method)
			{
				case 'createRouter':
				{
					const {	mediaCodecs } = request.data;

					queue.push(async () =>
					{
						await createRouter({ mediaCodecs, socket });

						cb();
					})
						.catch((error) =>
						{
							logger.error('router creation failed [error:"%o"]', error);
			
							socket.disconnect(true);
			
							return;
						});

					break;
				}

				default:
				{
					logger.error('unknown request.method "%s"', request.method);

					cb(500, `unknown request.method "${request.method}"`);
				}
			}
		});
	});
}

/**
 * Launch as many mediasoup Workers as given in the configuration file.
 */
async function runMediasoupWorkers()
{
	const { numWorkers } = config.mediasoup;

	logger.info('running %d mediasoup Workers...', numWorkers);

	for (let i = 0; i < numWorkers; ++i)
	{
		const worker = await mediasoup.createWorker(
			{
				logLevel   : config.mediasoup.worker.logLevel,
				logTags    : config.mediasoup.worker.logTags,
				rtcMinPort : config.mediasoup.worker.rtcMinPort,
				rtcMaxPort : config.mediasoup.worker.rtcMaxPort
			});

		worker.on('died', () =>
		{
			logger.error(
				'mediasoup Worker died, exiting  in 2 seconds... [pid:%d]', worker.pid);

			setTimeout(() => process.exit(1), 2000);
		});

		mediasoupWorkers.push(worker);
	}
}

/**
 * Get next mediasoup Worker.
 */
function getMediasoupWorker()
{
	const worker = mediasoupWorkers[nextMediasoupWorkerIdx];

	if (++nextMediasoupWorkerIdx === mediasoupWorkers.length)
		nextMediasoupWorkerIdx = 0;

	return worker;
}

/**
 * Create a Router instance
 */
async function createRouter({ mediaCodecs, socket })
{
	logger.info('creating a new Router');

	const mediasoupWorker = getMediasoupWorker();

	const mediasoupRouter = await mediasoupWorker.createRouter({ mediaCodecs });

	const router = new Router({ mediasoupRouter, socket });

	routers.set(router.id, router);

	router.on('close', () => routers.delete(router.id));
}

run();
