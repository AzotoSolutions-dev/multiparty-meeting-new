# Edumeet Server Configuration

The server configuration file can use one of the following formats:

- config/config.json
- config/config.json5
- config/config.yaml
- config/config.yml
- config/config.toml

Example `config.yaml`:

```yaml
redisOptions:
  host: redis
  port: 6379

listeningPort: 3443
```

Additionally, a `config/config.js` can be used to override specific properties
with runtime generated values and to set additional configuration functions and classes.
Look at the default `config/config.example.js` file for documentation.

## Configuration properties

| Name | Description | Format | Default value |
| :--- | :---------- | :----- | :------------ |
| turnAPIKey | TURN server key for requesting a geoip-based TURN server closest to the client. | `"string"` | ``""`` |
| turnAPIURI | TURN server URL for requesting a geoip-based TURN server closest to the client. | `"string"` | ``""`` |
| turnAPIparams.uri_schema | TURN server URL schema. | `"string"` | ``"turn"`` |
| turnAPIparams.transport | TURN server transport. | `[  "tcp",  "udp"]` | ``"tcp"`` |
| turnAPIparams.ip_ver | TURN server IP version. | `[  "ipv4",  "ipv6"]` | ``"ipv4"`` |
| turnAPIparams.servercount | TURN server count. | `"nat"` | ``2`` |
| turnAPITimeout | TURN server API timeout (seconds). | `"nat"` | ``2000`` |
| backupTurnServers | Backup TURN servers if REST fails or is not configured | `"*"` | ``[  {    "urls": [      "turn:turn.example.com:443?transport=tcp"    ],    "username": "example",    "credential": "example"  }]`` |
| fileTracker | Bittorrent tracker. | `"string"` | ``"wss://tracker.lab.vvc.niif.hu:443"`` |
| redisOptions.host | Redis server host. | `"string"` | ``"localhost"`` |
| redisOptions.port | Redis server port. | `"port"` | ``6379`` |
| redisOptions.password | Redis server password. | `"string"` | ``""`` |
| cookieSecret | Session cookie secret. | `"string"` | ``"T0P-S3cR3t_cook!e"`` |
| cookieName | Session cookie name. | `"string"` | ``"edumeet.sid"`` |
| tls.cert | SSL certificate path. | `"string"` | ``"./certs/mediasoup-demo.localhost.cert.pem"`` |
| tls.key | SSL key path. | `"string"` | ``"./certs/mediasoup-demo.localhost.key.pem"`` |
| listeningHost | The listening Host or IP address. If omitted listens on every IP. ("0.0.0.0" and "::"). | `"string"` | ``""`` |
| listeningPort | The HTTPS listening port. | `"port"` | ``8443`` |
| listeningRedirectPort | The HTTP listening port. Any HTTP request is redirected to HTTPS. | `"port"` | ``8080`` |
| httpOnly | Listens only on HTTP on listeningPort; listeningRedirectPort disabled. Use case: load balancer backend. | `"boolean"` | ``false`` |
| trustProxy | WebServer/Express trust proxy config for httpOnly mode. More infos: [expressjs](https://expressjs.com/en/guide/behind-proxies.html), [proxy-addr](https://www.npmjs.com/package/proxy-addr) | `"string"` | ``""`` |
| activateOnHostJoin | When true, the room will be open to all users since there are users in the room. | `"boolean"` | ``true`` |
| roomsUnlocked | An array of rooms users can enter without waiting in the lobby. | `"array"` | ``[]`` |
| maxUsersPerRoom | It defines how many users can join a single room. If not set, no limit is applied. | `"nat"` | ``0`` |
| routerScaleSize | Room size before spreading to a new router. | `"nat"` | ``40`` |
| requestTimeout | Socket timeout value (ms). | `"nat"` | ``20000`` |
| requestRetries | Socket retries when a timeout occurs. | `"nat"` | ``3`` |
| mediasoup.numWorkers | The number of Mediasoup workers to spawn. Defaults to the available CPUs count. | `"nat"` | ``8`` |
| mediasoup.worker.logLevel | The Mediasoup log level. | `"string"` | ``"warn"`` |
| mediasoup.worker.logTags | The Mediasoup log tags. | `"array"` | ``[  "info",  "ice",  "dtls",  "rtp",  "srtp",  "rtcp"]`` |
| mediasoup.worker.rtcMinPort | The Mediasoup start listening port number. | `"port"` | ``40000`` |
| mediasoup.worker.rtcMaxPort | The Mediasoup end listening port number. | `"port"` | ``49999`` |
| mediasoup.router.mediaCodecs | The Mediasoup codecs settings. [supportedRtpCapabilities](https://github.com/versatica/mediasoup/blob/v3/src/supportedRtpCapabilities.ts) | `"*"` | ``[  {    "kind": "audio",    "mimeType": "audio/opus",    "clockRate": 48000,    "channels": 2  },  {    "kind": "video",    "mimeType": "video/VP8",    "clockRate": 90000,    "parameters": {      "x-google-start-bitrate": 1000    }  },  {    "kind": "video",    "mimeType": "video/VP9",    "clockRate": 90000,    "parameters": {      "profile-id": 2,      "x-google-start-bitrate": 1000    }  },  {    "kind": "video",    "mimeType": "video/h264",    "clockRate": 90000,    "parameters": {      "packetization-mode": 1,      "profile-level-id": "4d0032",      "level-asymmetry-allowed": 1,      "x-google-start-bitrate": 1000    }  },  {    "kind": "video",    "mimeType": "video/h264",    "clockRate": 90000,    "parameters": {      "packetization-mode": 1,      "profile-level-id": "42e01f",      "level-asymmetry-allowed": 1,      "x-google-start-bitrate": 1000    }  }]`` |
| mediasoup.webRtcTransport.listenIps | The Mediasoup listen IPs. [TransportListenIp](https://mediasoup.org/documentation/v3/mediasoup/api/#TransportListenIp) | `"array"` | ``[  {    "ip": "0.0.0.0",    "announcedIp": null  }]`` |
| mediasoup.webRtcTransport.initialAvailableOutgoingBitrate | The Mediasoup initial available outgoing bitrate (in bps). [WebRtcTransportOptions](https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions) | `"nat"` | ``1000000`` |
| mediasoup.webRtcTransport.maxIncomingBitrate | The Mediasoup maximum incoming bitrate for each transport. (in bps). [setMaxIncomingBitrate](https://mediasoup.org/documentation/v3/mediasoup/api/#transport-setMaxIncomingBitrate) | `"nat"` | ``1500000`` |
| prometheus.deidentify | De-identify IP addresses in Prometheus logs. | `"boolean"` | ``false`` |
| prometheus.listen | Prometheus exporter listening address. | `"string"` | ``"localhost"`` |
| prometheus.numeric | Show numeric IP addresses in Prometheus logs. | `"boolean"` | ``false`` |
| prometheus.port | The Prometheus exporter listening port. | `"port"` | ``8889`` |
| prometheus.quiet | Include fewer labels in Prometheus logs. | `"boolean"` | ``false`` |
| prometheus.period | The Prometheus exporter update period (seconds). | `"nat"` | ``15`` |
| prometheus.secret | The Prometheus exporter authorization header: `Bearer <secret>` required to allow scraping. | `"string"` | ``""`` |


---

*Document generated with:* `yarn gen-config-docs`