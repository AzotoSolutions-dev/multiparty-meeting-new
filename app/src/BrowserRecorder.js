import Logger from './Logger';
import { WritableStream, TransformStream } from 'web-streams-polyfill/ponyfill';
import * as streamsaver from 'streamsaver';
import { openDB, deleteDB } from 'idb';
import * as meActions from './actions/meActions';
import { store } from './store';
import * as requestActions from './actions/requestActions';
import { RECORDING_PAUSE, RECORDING_RESUME, RECORDING_STOP, RECORDING_START } from './actions/recorderActions';
export default class BrowserRecorder
{
	constructor(useStreamSaver = false)
	{
		// react intl
		this.intl = null;

		// MediaRecorder
		this.recorder = null;
		this.recordingMimeType = null;
		this.recordingData = [];
		this.recorderStream = null;
		this.gdmStream = null;
		this.roomClient = null;
		this.fileName = 'apple.webm';
		this.logger = new Logger('Recorder');

		// streamSaver
		this.useStreamSaver = useStreamSaver;
		this.streamSaver = null;
		this.writer = null;

		// fallback option
		this.useStreamSaverPump = false;

		// IndexedDB
		this.idbDB = null;
		this.logToIDB = true;
		this.idbName = 'default';
		this.idbStoreName = 'chunks';

		// Audio MIXER
		this.ctx = null;
		this.dest = null;
		this.gainNode = null;
		this.audioConsumersMap = new Map();
		this.micProducerId = null;
		this.micProducerStreamSource = null;

		this.RECORDING_CONSTRAINTS = {
			videoBitsPerSecond : 8000000,
			video              :
		{
			displaySurface : 'browser',
			width          : { ideal: 1920 }
		},
			audio    : true,
			advanced : [
				{ width: 1920, height: 1080 },
				{ width: 1280, height: 720 }
			]
		};

		// 10 sec
		this.RECORDING_SLICE_SIZE = 10000;
	}

	mixer(audiotrack, videostream)
	{
		// AUDIO 
		if (audiotrack != null)
		{
			this.ctx.createMediaStreamSource(
				new MediaStream([ audiotrack ])
			).connect(this.dest);
		}
		// VIDEO+AUDIO
		if (videostream.getAudioTracks().length > 0)
		{
			this.ctx.createMediaStreamSource(videostream).connect(this.dest);
		}
		// VIDEOMIX
		let tracks = this.dest.stream.getTracks();

		tracks = tracks.concat(videostream.getVideoTracks());

		return new MediaStream(tracks);

	}

	init()
	{
		this.logger.debug('startLocalRecording()');

		// Check
		if (typeof MediaRecorder === undefined)
		{
			throw new Error('Unsupported media recording API');
		}
		// Check mimetype is supported by the browser
		if (MediaRecorder.isTypeSupported(this.recordingMimeType) === false)
		{
			throw new Error('Unsupported media recording format %O', this.recordingMimeType);
		}

		if (typeof indexedDB === 'undefined' || typeof indexedDB.open === 'undefined')
		{
			this.logger.warn('IndexedDB API is not available in this browser. Fallback to ');
			this.logToIDB = false;
		}

		// Audio mixer init
		this.ctx = new AudioContext();
		this.dest = this.ctx.createMediaStreamDestination();
		this.gainNode = this.ctx.createGain();
		this.gainNode.connect(this.dest);

	}

	async getUserMedia(additionalAudioTracks)
	{
		// Screensharing video ( and audio on Chrome )
		this.gdmStream = await navigator.mediaDevices.getDisplayMedia(
			this.RECORDING_CONSTRAINTS
		);

		this.gdmStream.getVideoTracks().forEach((track) =>
		{
			track.addEventListener('ended', (e) =>
			{
				this.logger.debug(`gdmStream ${track.kind} track ended event: ${JSON.stringify(e)}`);
				this.stopLocalRecording();
			});
		});

		if (additionalAudioTracks.length>0)
		{
			// add mic track
			this.recorderStream = this.mixer(additionalAudioTracks[0], this.gdmStream);
			// add other audio tracks
			for (let i = 1; i < additionalAudioTracks.length; i++)
			{
				this.addTrack(additionalAudioTracks[i]);
			}
		}
		else
		{
			this.recorderStream = this.mixer(null, this.gdmStream);
		}
	}

	async streamSaverStart()
	{
		this.logToIDB = false;

		if (!window.WritableStream)
		{
			this.streamSaver.WritableStream = WritableStream;
		}
		if (!window.TransformStream)
		{
			this.streamSaver.TransformStream = TransformStream;
		}

		const { readable, writable } = new TransformStream({
			transform : (chunk, ctrl) => chunk.arrayBuffer().then(
				(b) => ctrl.enqueue(new Uint8Array(b))
			)
		});

		const fileStream = this.streamSaver.createWriteStream(this.fileName);

		try
		{
			if (this.streamSaver.WritableStream && readable.pipeTo)
			{
				this.writer = writable.getWriter();
				await readable.pipeTo(fileStream);
				// .then(() => console.log('done writing'));
			}
		}
		catch (error)
		{
			this.useStreamSaverPump = true;
			this.logger.debug(`Fallback to Pump : ${error}`);
			this.writer = fileStream.getWriter();
		}

		if (!this.useStreamSaverPump)
		{
			this.recorder.ondataavailable = (e) =>
			{
				if (e.data && e.data.size > 0)
				{
					this.writer.write(e.data);
				}
			};
		}
		else
		{
			this.recorder.ondataavailable = (e) =>
			{
				if (e.data && e.data.size > 0)
				{
					this.pumpStreamSaverData(e.data);
				}
			};
		}

		this.recorder.onstop = (e) =>
		{
			this.logger.debug(`Logger stopped event: ${e}`);
			setTimeout(() =>
			{
				this.stopStreams();

				this.writer.close();

			}, 2000);
		};
	}

	// save recording and destroy
	saveRecordingAndCleanup(blobs, db, dbName)
	{
		// merge blob
		const blob = new Blob(blobs, { type: this.recordingMimeType });

		// save as
		this.invokeSaveAsDialog(blob, `${dbName}.webm`);

		// destroy
		this.saveRecordingCleanup(db, dbName);
	}

	// save recording and destroy
	saveRecordingFallback(blobs)
	{
		// merge blob
		const blob = new Blob(blobs, { type: this.recordingMimeType });

		// save as
		this.invokeSaveAsDialog(blob, `${this.fileName}`);

		// TODO CLEANUP
	}

	// save recording with Stream saver and destroy
	saveRecordingWithStreamSaver(keys)
	{
		let readableStream = null;

		let reader = null;

		let pump = null;

		const key = keys[0];

		// we remove the key that we are removing
		keys.shift();
		this.idbDB.get(this.idbStoreName, key).then((blob) =>
		{
			if (keys.length === 0)
			{
				// if this is the last key we close the writable stream and cleanup the indexedDB
				readableStream = blob.stream();
				reader = readableStream.getReader();
				pump = () => reader.read()
					.then((res) => (res.done
						? this.saveRecordingCleanup(true)
						: this.writer.write(res.value).then(pump)));
				pump();
			}
			else
			{
				// push data to the writable stream
				readableStream = blob.stream();
				reader = readableStream.getReader();
				pump = () => reader.read()
					.then((res) => (res.done
						? this.saveRecordingWithStreamSaver(keys)
						: this.writer.write(res.value).then(pump)));
				pump();
			}
		});

	}

	saveRecordingCleanup(stop = null)
	{
		if (stop != null)
		{
			this.writer.close();
		}
		// destroy
		this.idbDB.close();
		deleteDB(this.dbName);
		// delete all previouse recordings that might be left in indexedDB
		// https://bugzilla.mozilla.org/show_bug.cgi?id=934640
		if (indexedDB.databases instanceof Function)
		{
			indexedDB.databases().then((r) => r.forEach((dbdata) => deleteDB(dbdata.name)));
		}

		this.recordingMimeType = null;
		this.recordingData = [];
		this.recorder = null;
		this.ctx.close();

	}

	async idbRecordingStart()
	{
		let chunkCounter = 0;

		if (this.logToIDB)
		{
			this.idbName = Date.now();
			const idbStoreName = this.idbStoreName;

			this.idbDB = await openDB(this.idbName, 1,
				{
					upgrade(db)
					{
						db.createObjectStore(idbStoreName);
					}
				}
			);
			if (!window.WritableStream)
			{
				this.streamSaver.WritableStream = WritableStream;
			}
			const fileStream = this.streamSaver.createWriteStream(`${this.fileName}`, {
				// size : blob.size // Makes the procentage visiable in the download
			});

			this.writer = fileStream.getWriter();
		}

		// Save a recorded chunk (blob) to indexedDB
		const saveToDB = async (data) =>
		{
			return await this.idbDB.put(this.idbStoreName, data, Date.now());
		};

		if (this.recorder)
		{
			this.recorder.ondataavailable = (e) =>
			{

				if (e.data && e.data.size > 0)
				{
					chunkCounter++;
					this.logger.debug(`put chunk: ${chunkCounter}`);
					if (this.logToIDB)
					{
						try
						{
							saveToDB(e.data);
						}
						catch (error)
						{
							this.logger.error('Error during saving data chunk to IndexedDB! error:%O', error);
						}
					}
					else
					{
						this.recordingData.push(e.data);
					}
				}
			};

			this.recorder.onstop = (e) =>
			{
				this.logger.debug(`Logger stopped event: ${e}`);

				if (this.logToIDB)
				{
					try
					{
						this.stopStreams();

						this.idbDB.getAllKeys(this.idbStoreName).then((keys) =>
						{
							// recursive function to save the data from the indexed db
							this.saveRecordingWithStreamSaver(keys);
						});

					}
					catch (error)
					{
						this.logger.error('Error during getting all data chunks from IndexedDB! error: %O', error);
					}

				}
				else
				{
					// Get data from array
					this.saveRecordingFallback(this.recordingData);
				}
			};
		}
		else
		{
			// recorder did not start
			this.logger.debug('Recorder did not start.');
		}
	}

	async startLocalRecording(
		{
			roomClient, additionalAudioTracks, recordingMimeType, roomname
		})
	{
		this.roomClient = roomClient;
		this.recordingMimeType = recordingMimeType;

		// Get date for filename 
		const dt = new Date();
		const rdt = `${dt.getFullYear() }-${ (`0${ dt.getMonth()+1}`).slice(-2) }-${ (`0${ dt.getDate()}`).slice(-2) }_${dt.getHours() }_${(`0${ dt.getMinutes()}`).slice(-2) }_${dt.getSeconds()}`;

		this.init();

		try
		{
			await this.getUserMedia(additionalAudioTracks);

			this.streamSaver = streamsaver;

			this.recorder = new MediaRecorder(
				this.recorderStream, { mimeType: this.recordingMimeType }
			);

			const ext = this.recorder.mimeType.split(';')[0].split('/')[1];

			this.fileName = `${roomname}-recording-${rdt}.${ext}`;

			if (this.recorder)
			{
				if (this.useStreamSaver)
				{
					// StreamSaver without IDB
					this.streamSaverStart();
				}
				else
				{
					// IDB with StreamSaver
					this.idbRecordingStart();
				}
				this.recorder.onerror = (error) =>
				{
					this.logger.err(`Recorder onerror: ${error}`);
					switch (error.name)
					{
						case 'SecurityError':
							store.dispatch(requestActions.notify(
								{
									type : 'error',
									text : this.intl.formatMessage({
										id             : 'room.localRecordingSecurityError',
										defaultMessage : 'Recording the specified source is not allowed due to security restrictions. Check you client settings!'
									})
								}));
							break;
						case 'InvalidStateError':
						default:
							throw new Error(error);
					}

				};
			}

			this.recorder.start(this.RECORDING_SLICE_SIZE);
			meActions.setLocalRecordingState(RECORDING_START);
		}
		catch (error)
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : this.intl.formatMessage({
						id             : 'room.unexpectedErrorDuringLocalRecording',
						defaultMessage : 'Unexpected error ocurred during local recording'
					})
				}));
			this.logger.error('startLocalRecording() [error:"%o"]', error);

			if (this.recorder) this.recorder.stop();
			store.dispatch(meActions.setLocalRecordingState(RECORDING_STOP));
			if (typeof this.gdmStream !== 'undefined' && this.gdmStream && typeof this.gdmStream.getTracks === 'function')
			{
				this.gdmStream.getTracks().forEach((track) => track.stop());
			}

			this.gdmStream = null;
			this.recorderStream = null;
			this.recorder = null;

			return -1;
		}
		try
		{
			await this.roomClient.sendRequest('setLocalRecording', { localRecordingState: RECORDING_START });

			store.dispatch(meActions.setLocalRecordingState(RECORDING_START));

			store.dispatch(requestActions.notify(
				{
					text : this.intl.formatMessage({
						id             : 'room.youStartedLocalRecording',
						defaultMessage : 'You started local recording'
					})
				}));
		}
		catch (error)
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : this.intl.formatMessage({
						id             : 'room.unexpectedErrorDuringLocalRecording',
						defaultMessage : 'Unexpected error ocurred during local recording'
					})
				}));
			this.logger.error('startLocalRecording() [error:"%o"]', error);

		}

	}
	checkMicProducer(producers)
	{
		// is it already appended to stream?
		if (this.recorder != null && (this.recorder.state === 'recording' || this.recorder.state === 'paused'))
		{

			const micProducer = Object.values(producers).find((p) => p.source === 'mic');

			if (micProducer && this.micProducerId !== micProducer.id)
			{

				// delete/dc previous one 
				if (this.micProducerStreamSource)
				{
					this.micProducerStreamSource.disconnect(this.dest);
				}

				this.micProducerStreamSource = this.ctx.createMediaStreamSource(
					new MediaStream([ micProducer.track ])
				);
				this.micProducerStreamSource.connect(this.dest);

				// set Mic id
				this.micProducerId = micProducer.id;
			}
		}
	}
	checkAudioConsumer(consumers)
	{
		if (this.recorder != null && (this.recorder.state === 'recording' || this.recorder.state === 'paused'))
		{
			const audioConsumers = Object.values(consumers).filter((p) => p.kind === 'audio');

			for (let i = 0; i < audioConsumers.length; i++)
			{
				if (!this.audioConsumersMap.has(audioConsumers[i].id))
				{
					const audioConsumerStreamSource = this.ctx.createMediaStreamSource(
						new MediaStream([ audioConsumers[i].track ])
					);

					audioConsumerStreamSource.connect(this.dest);
					this.audioConsumersMap.set(audioConsumers[i].id, audioConsumerStreamSource);
				}
			}

			for (const [ consumerId, aCStreamSource ] in this.audioConsumersMap.entries())
			{
				if (!audioConsumers.find((c) => consumerId === c.id))
				{
					aCStreamSource.disconnect(this.dest);
					this.audioConsumersMap.delete(consumerId);
				}
			}

		}
	}

	stopStreams()
	{
		// Stop all used video/audio tracks
		if (this.recorderStream && this.recorderStream.getTracks().length > 0)
			this.recorderStream.getTracks().forEach((track) => track.stop());

		if (this.gdmStream && this.gdmStream.getTracks().length > 0)
			this.gdmStream.getTracks().forEach((track) => track.stop());

	}

	pumpStreamSaverData(data)
	{
		// push data to download stream
		let readableStream = null;

		let reader = null;

		let pump = null;

		readableStream = data.stream();

		reader = readableStream.getReader();
		pump = () => reader.read()
			.then((res) => (res.done
				? void(0)
				: this.writer.write(res.value).then(pump)
			));
		pump();
	}
	async stopLocalRecording()
	{
		this.logger.debug('stopLocalRecording()');
		try
		{
			this.recorder.stop();

			store.dispatch(requestActions.notify(
				{
					text : this.intl.formatMessage({
						id             : 'room.youStoppedLocalRecording',
						defaultMessage : 'You stopped local recording'
					})
				}));

			store.dispatch(meActions.setLocalRecordingState(RECORDING_STOP));

			await this.roomClient.sendRequest('setLocalRecording', { localRecordingState: RECORDING_STOP });

		}
		catch (error)
		{

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : this.intl.formatMessage({
						id             : 'room.unexpectedErrorDuringLocalRecording',
						defaultMessage : 'Unexpected error ocurred during local recording'
					})
				}));

			this.logger.error('stopLocalRecording() [error:"%o"]', error);
		}
	}
	async pauseLocalRecording()
	{
		this.recorder.pause();
		store.dispatch(meActions.setLocalRecordingState(RECORDING_PAUSE));
		await this.roomClient.sendRequest('setLocalRecording', { localRecordingState: RECORDING_PAUSE });
	}
	async resumeLocalRecording()
	{
		this.recorder.resume();
		store.dispatch(meActions.setLocalRecordingState(RECORDING_RESUME));
		await this.roomClient.sendRequest('setLocalRecording', { localRecordingState: RECORDING_RESUME });
	}
	invokeSaveAsDialog(blob)
	{
		const link = document.createElement('a');

		link.style = 'display:none;opacity:0;color:transparent;';
		link.href = URL.createObjectURL(blob);
		link.download = this.fileName;

		(document.body || document.documentElement).appendChild(link);
		if (typeof link.click === 'function')
		{
			link.click();
		}
		else
		{
			link.target = '_blank';
			link.dispatchEvent(new MouseEvent('click',
				{
					view       : window,
					bubbles    : true,
					cancelable : true
				}));
		}
		URL.revokeObjectURL(link.href);

	}
}