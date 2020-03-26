const os = require('os');
const path = require('path');
const repl = require('repl');
const readline = require('readline');
const net = require('net');
const fs = require('fs');
const colors = require('colors/safe');

const SOCKET_PATH_UNIX = '/tmp/multiparty-meeting-server.sock';
const SOCKET_PATH_WIN = path.join('\\\\?\\pipe', process.cwd(), 'multiparty-meeting-server');
const SOCKET_PATH = os.platform() === 'win32' ? SOCKET_PATH_WIN : SOCKET_PATH_UNIX;

class Interactive
{
	constructor(socket)
	{
		this._socket = socket;

		this._isTerminalOpen = false;
	}

	openCommandConsole()
	{
		const cmd = readline.createInterface(
			{
				input    : this._socket,
				output   : this._socket,
				terminal : true
			});

		cmd.on('close', () =>
		{
			if (this._isTerminalOpen)
				return;

			this.log('\nexiting...');

			this._socket.end();
		});

		const readStdin = () =>
		{
			cmd.question('cmd> ', async (input) =>
			{
				const params = input.split(/[\s\t]+/);
				const command = params.shift();

				switch (command)
				{
					case '':
					{
						readStdin();
						break;
					}

					case 'h':
					case 'help':
					{
						this.log('');
						this.log('available commands:');
						this.log('- h,  help                    : show this message');
						this.log('- dumpRooms                   : dump all rooms');
						this.log('- dumpPeers                   : dump all peers');
						this.log('- t,  terminal                : open Node REPL Terminal');
						this.log('');
						readStdin();

						break;
					}

					case 'stats':
					{
						this.log(`rooms:${global.rooms.size}\npeers:${global.peers.size}`);

						break;
					}

					case 'dr':
					case 'dumpRooms':
					{
						for (const room of global.rooms.values())
						{
							try
							{
								const dump = await room.dump();

								this.log(`room.dump():\n${JSON.stringify(dump, null, '  ')}`);
							}
							catch (error)
							{
								this.error(`room.dump() failed: ${error}`);
							}
						}

						break;
					}

					case 'dp':
					case 'dumpPeers':
					{
						for (const peer of global.peers.values())
						{
							try
							{
								const dump = await peer.peerInfo;

								this.log(`peer.peerInfo():\n${JSON.stringify(dump, null, '  ')}`);
							}
							catch (error)
							{
								this.error(`peer.peerInfo() failed: ${error}`);
							}
						}

						break;
					}

					case 't':
					case 'terminal':
					{
						this._isTerminalOpen = true;

						cmd.close();
						this.openTerminal();

						return;
					}

					default:
					{
						this.error(`unknown command '${command}'`);
						this.log('press \'h\' or \'help\' to get the list of available commands');
					}
				}

				readStdin();
			});
		};

		readStdin();
	}

	openTerminal()
	{
		this.log('\n[opening Node REPL Terminal...]');
		this.log('here you have access to workers, routers, transports, producers, consumers, dataProducers and dataConsumers ES6 maps');

		const terminal = repl.start(
			{
				input           : this._socket,
				output          : this._socket,
				terminal        : true,
				prompt          : 'terminal> ',
				useColors       : true,
				useGlobal       : true,
				ignoreUndefined : false
			});

		this._isTerminalOpen = true;

		terminal.on('exit', () =>
		{
			this.log('\n[exiting Node REPL Terminal...]');

			this._isTerminalOpen = false;

			this.openCommandConsole();
		});
	}

	log(msg)
	{
		try
		{
			this._socket.write(`${colors.green(msg)}\n`);
		}
		catch (error)
		{}
	}

	error(msg)
	{
		try
		{
			this._socket.write(`${colors.red.bold('ERROR: ')}${colors.red(msg)}\n`);
		}
		catch (error)
		{}
	}
}

module.exports = async function(rooms, peers)
{
	try
	{
		// Make maps global so they can be used during the REPL terminal.
		global.rooms = rooms;
		global.peers = peers;

		const server = net.createServer((socket) =>
		{
			const interactive = new Interactive(socket);

			interactive.openCommandConsole();
		});

		await new Promise((resolve) =>
		{
			try { fs.unlinkSync(SOCKET_PATH); }
			catch (error) {}

			server.listen(SOCKET_PATH, resolve);
		});
	}
	catch (error)
	{}
};
