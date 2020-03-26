const os = require('os');

module.exports =
{
	tls :
	{
		cert : `${__dirname}/../certs/mediasoup-demo.localhost.cert.pem`,
		key  : `${__dirname}/../certs/mediasoup-demo.localhost.key.pem`
	},
	// Listening port for https server.
	listeningPort   : 8000,
	mediaNodeSecret : 'o5xFo8JEU4n7QGnRwEYG86Ti8jZEzz',
	mediasoup       :
	{
		numWorkers : Object.keys(os.cpus()).length,
		// mediasoup Worker settings.
		worker     :
		{
			logLevel : 'warn',
			logTags  :
			[
				'info',
				'ice',
				'dtls',
				'rtp',
				'srtp',
				'rtcp'
			],
			rtcMinPort : 40000,
			rtcMaxPort : 49999
		},
		// mediasoup Router settings.
		router :
		{
			// Router media codecs.
			mediaCodecs :
			[
				{
					kind      : 'audio',
					mimeType  : 'audio/opus',
					clockRate : 48000,
					channels  : 2
				},
				{
					kind       : 'video',
					mimeType   : 'video/VP8',
					clockRate  : 90000,
					parameters :
					{
						'x-google-start-bitrate' : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/VP9',
					clockRate  : 90000,
					parameters :
					{
						'profile-id'             : 2,
						'x-google-start-bitrate' : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '4d0032',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '42e01f',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				}
			]
		},
		// mediasoup WebRtcTransport settings.
		webRtcTransport :
		{
			listenIps :
			[
				// change ip to your servers IP address!
				{ ip: '0.0.0.0', announcedIp: null }

				// Can have multiple listening interfaces
				// { ip: '::/0', announcedIp: null }
			],
			initialAvailableOutgoingBitrate : 1000000,
			minimumAvailableOutgoingBitrate : 600000,
			// Additional options that are not part of WebRtcTransportOptions.
			maxIncomingBitrate              : 1500000
		}
	}
};
