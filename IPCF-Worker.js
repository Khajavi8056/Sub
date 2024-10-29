import { connect } from 'cloudflare:sockets';

//حتما یویو آیدی تغییر بدید
//https://www.uuidgenerator.net/
let userID = 'f1a234f6-c946-4024-ba79-882f58c22727';

const ProxyIPs = [
	'cdn.xn--b6gac.eu.org',
	'cdn-all.xn--b6gac.eu.org',
	'workers.cloudflare.cyou',
	'gozar.azad.sh-cf.shop'
];
// const ProxyIPs = ['bpb.yousef.isegaro.com'];
var IP_Proxy = ProxyIPs[Math.floor(Math.random() * ProxyIPs.length)];


let dohURL = 'https://sky.rethinkdns.com/1:-Pf_____9_8A_AMAIgE8kMABVDDmKOHTAKg=';

let Set_Http_port = ['80', '8080', '8880', '2052', '2086', '2095', '2082'];
let Set_Http_ports = ['443', '8443', '2053', '2096', '2087', '2083'];




export default {
	/**
	 * @param {import("@cloudflare/workers-types").Request} request
	 * @param {{UUID: string, IP_Proxy: string, DNS_RESOLVER_URL: string, NODE_ID: int, API_HOST: string, API_TOKEN: string}} env
	 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		try {
			userID = env.UUID || userID;
			IP_Proxy = env.IP_Proxy || IP_Proxy;
			dohURL = env.DNS_RESOLVER_URL || dohURL;
			let userID_Path = userID;
			if (userID.includes(',')) {
				userID_Path = userID.split(',')[0];
			}
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				const url = new URL(request.url);
				switch (url.pathname) {
					case `/cf`: {
						return new Response(JSON.stringify(request.cf, null, 4), {
							status: 200,
							headers: {
								"Content-Type": "application/json;charset=utf-8",
							},
						});
					}
					case `/panel`: {
						const WlessConfig = getValueConfig(userID, request.headers.get('Host'));
						return new Response(`${WlessConfig}`, {
							status: 200,
							headers: {
								"Content-Type": "text/html; charset=utf-8",
							}
						});
					};
					case `/sub/${userID_Path}`: {
						const url = new URL(request.url);
						const searchParams = url.searchParams;
						const WlessSubConfig = Create_a_Sub_Valley(userID, request.headers.get('Host'));
						// Construct and return response object
						return new Response(btoa(WlessSubConfig), {
							status: 200,
							headers: {
								"Content-Type": "text/plain;charset=utf-8",
							}
						});
					};
					// case `/bestip/${userID_Path}`: {
					// 	const headers = request.headers;
					// 	const url = `https://sub.xf.free.hr/auto?host=${request.headers.get('Host')}&uuid=${userID}&path=/`;
					// 	const bestSubConfig = await fetch(url, { headers: headers });
					// 	return bestSubConfig;
					// };
					default:
						const randomHostname = cn_hostnames[Math.floor(Math.random() * cn_hostnames.length)];
						const newHeaders = new Headers(request.headers);
						newHeaders.set('cf-connecting-ip', '1.2.3.4');
						newHeaders.set('x-forwarded-for', '1.2.3.4');
						newHeaders.set('x-real-ip', '1.2.3.4');
						newHeaders.set('referer', 'https://www.google.com/search?q=ipcf-channel');
						const proxyUrl = 'https://' + randomHostname + url.pathname + url.search;
						let modifiedRequest = new Request(proxyUrl, {
							method: request.method,
							headers: newHeaders,
							body: request.body,
							redirect: 'manual',
						});
						const proxyResponse = await fetch(modifiedRequest, { redirect: 'manual' });
						if ([301, 302].includes(proxyResponse.status)) {
							return new Response(`Redirects to ${randomHostname} are not allowed.`, {
								status: 403,
								statusText: 'Forbidden',
							});
						}
						return proxyResponse;
				}
			} else {
				return await WlessOverWSHandler(request);
			}
		} catch (err) {
			/** @type {Error} */ let e = err;
			return new Response(e.toString());
		}
	},
};



export async function uuid_validator(request) {
	const hostname = request.headers.get('Host');
	const currentDate = new Date();

	const subdomain = hostname.split('.')[0];
	const year = currentDate.getFullYear();
	const month = String(currentDate.getMonth() + 1).padStart(2, '0');
	const day = String(currentDate.getDate()).padStart(2, '0');

	const formattedDate = `${year}-${month}-${day}`;
	const hashHex = await hashHex_f(subdomain);
	console.log(hashHex, subdomain, formattedDate);
}


export async function hashHex_f(string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(string);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
	return hashHex;
}


/**
 * 
 * @param {import("@cloudflare/workers-types").Request} request
 * @returns {Promise<Response>}
 */
async function WlessOverWSHandler(request) {
	const webSocketPair = new WebSocketPair();
	const [client, webSocket] = Object.values(webSocketPair);
	webSocket.accept();

	let address = '';
	let portWithRandomLog = '';
	let currentDate = new Date();
	const log = (/** @type {string} */ info, /** @type {string | undefined} */ event) => {
		console.log(`[${currentDate} ${address}:${portWithRandomLog}] ${info}`, event || '');
	};
	const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';

	const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

	/** @type {{ value: import("@cloudflare/workers-types").Socket | null}}*/
	let remoteSocketWapper = {
		value: null,
	};
	let udpStreamWrite = null;
	let isDns = false;

	readableWebSocketStream.pipeTo(new WritableStream({
		async write(chunk, controller) {
			if (isDns && udpStreamWrite) {
				return udpStreamWrite(chunk);
			}
			if (remoteSocketWapper.value) {
				const writer = remoteSocketWapper.value.writable.getWriter()
				await writer.write(chunk);
				writer.releaseLock();
				return;
			}

			const {
				hasError,
				message,
				portRemote = 443,
				addressRemote = '',
				rawDataIndex,
				วเลสVersion = new Uint8Array([0, 0]),
				isUDP,
			} = processVlessHeader(chunk, userID);
			address = addressRemote;
			portWithRandomLog = `${portRemote} ${isUDP ? 'udp' : 'tcp'} `;
			if (hasError) {
				
				throw new Error(message); 
			}

			if (isUDP && portRemote !== 53) {
				throw new Error('UDP proxy only enabled for DNS which is port 53');
			}

			if (isUDP && portRemote === 53) {
				isDns = true;
			}

	
			const WlessResponseHeader = new Uint8Array([วเลสVersion[0], 0]);
			const rawClientData = chunk.slice(rawDataIndex);

			// TODO: support udp 
			if (isDns) {
				const { write } = await handleUDPOutBound(webSocket, WlessResponseHeader, log);
				udpStreamWrite = write;
				udpStreamWrite(rawClientData);
				return;
			}
			handleTCPOutBound(remoteSocketWapper, addressRemote, portRemote, rawClientData, webSocket, WlessResponseHeader, log);
		},
		close() {
			log(`readableWebSocketStream is close`);
		},
		abort(reason) {
			log(`readableWebSocketStream is abort`, JSON.stringify(reason));
		},
	})).catch((err) => {
		log('readableWebSocketStream pipeTo error', err);
	});

	return new Response(null, {
		status: 101,
		webSocket: client,
	});
}



/**
 * 
 *
 * @param {any} remoteSocket 
 * @param {string} addressRemote
 * @param {number} portRemote
 * @param {Uint8Array} rawClientData
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket 
 * @param {Uint8Array} WlessResponseHeader 
 * @param {function} log 
 * @returns {Promise<void>} 
 */
async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, WlessResponseHeader, log,) {

	/**
	 * 
	 * @param {string} address 
	 * @param {number} port 
	 * @returns {Promise<import("@cloudflare/workers-types").Socket>} 
	 */
	async function connectAndWrite(address, port) {
		/** @type {import("@cloudflare/workers-types").Socket} */
		const tcpSocket = connect({
			hostname: address,
			port: port,
		});
		remoteSocket.value = tcpSocket;
		log(`connected to ${address}:${port}`);
		const writer = tcpSocket.writable.getWriter();
		await writer.write(rawClientData); 
		writer.releaseLock();
		return tcpSocket;
	}
	
	/**
	 * 
	 * @returns {Promise<void>} 
	 */
	async function retry() {
		const tcpSocket = await connectAndWrite(IP_Proxy || addressRemote, portRemote)
		tcpSocket.closed.catch(error => {
			console.log('retry tcpSocket closed error', error);
		}).finally(() => {
			safeCloseWebSocket(webSocket);
		})
		remoteSocketToWS(tcpSocket, webSocket, WlessResponseHeader, null, log);
	}

	const tcpSocket = await connectAndWrite(addressRemote, portRemote);
	remoteSocketToWS(tcpSocket, webSocket, WlessResponseHeader, retry, log);
}



/**
 * 
 * @param {import("@cloudflare/workers-types").WebSocket} webSocketServer 
 * @param {string} earlyDataHeader
 * @param {(info: string)=> void} log
 * @returns {ReadableStream}
 */
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
	let readableStreamCancel = false;
	const stream = new ReadableStream({
		start(controller) {
			webSocketServer.addEventListener('message', (event) => {
				const message = event.data;
				controller.enqueue(message);
			});

			webSocketServer.addEventListener('close', () => {
				safeCloseWebSocket(webSocketServer);
				controller.close();
			});

			webSocketServer.addEventListener('error', (err) => {
				log('webSocketServer has error');
				controller.error(err);
			});
			const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
			if (error) {
				controller.error(error);
			} else if (earlyData) {
				controller.enqueue(earlyData);
			}
		},

		pull(controller) {
			// https://streams.spec.whatwg.org/#example-rs-push-backpressure
		},
		//BEST SERVICE: UPSYS ---09
		cancel(reason) {
			log(`ReadableStream was canceled, due to ${reason}`)
			readableStreamCancel = true;
			safeCloseWebSocket(webSocketServer);
		}
	});

	return stream;
}


/**
 * 
 * @param {ArrayBuffer} ValesBuffer 
 * @param {string} userID 
 * @returns {{
*  hasError: boolean,
*  message?: string,
*  addressRemote?: string,
*  addressType?: number,
*  portRemote?: number,
*  rawDataIndex?: number,
*  วเลสVersion?: Uint8Array,
*  isUDP?: boolean
* }} 
*/
function processVlessHeader(ValesBuffer, userID) {
	if (ValesBuffer.byteLength < 24) {
		return {
			hasError: true,
			message: 'invalid data',
		};
	}

	const version = new Uint8Array(ValesBuffer.slice(0, 1));
	let isValidUser = false;
	let isUDP = false;
	const slicedBuffer = new Uint8Array(ValesBuffer.slice(1, 17));
	const slicedBufferString = stringify(slicedBuffer);
	const uuids = userID.includes(',') ? userID.split(",") : [userID];



	
	isValidUser = uuids.some(userUuid => slicedBufferString === userUuid.trim()) || uuids.length === 1 && slicedBufferString === uuids[0].trim();

	console.log(`userID: ${slicedBufferString}`);

	if (!isValidUser) {
		return {
			hasError: true,
			message: 'invalid user',
		};
	}

	const optLength = new Uint8Array(ValesBuffer.slice(17, 18))[0];


	const command = new Uint8Array(
		ValesBuffer.slice(18 + optLength, 18 + optLength + 1)
	)[0];


	if (command === 1) {
		isUDP = false;
	} else if (command === 2) {
		isUDP = true;
	} else {
		return {
			hasError: true,
			message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
		};
	}
	const portIndex = 18 + optLength + 1;
	const portBuffer = ValesBuffer.slice(portIndex, portIndex + 2);

	const portRemote = new DataView(portBuffer).getUint16(0);

	let addressIndex = portIndex + 2;
	const addressBuffer = new Uint8Array(
		ValesBuffer.slice(addressIndex, addressIndex + 1)
	);


	const addressType = addressBuffer[0];
	let addressLength = 0;
	let addressValueIndex = addressIndex + 1;
	let addressValue = '';
	switch (addressType) {
		case 1:
			addressLength = 4;
			addressValue = new Uint8Array(
				ValesBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			).join('.');
			break;
		case 2:
			addressLength = new Uint8Array(
				ValesBuffer.slice(addressValueIndex, addressValueIndex + 1)
			)[0];
			addressValueIndex += 1;
			addressValue = new TextDecoder().decode(
				ValesBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			);
			break;
		case 3:
			addressLength = 16;
			const dataView = new DataView(
				ValesBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			);
			// 2001:0db8:85a3:0000:0000:8a2e:0370:7334
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				ipv6.push(dataView.getUint16(i * 2).toString(16));
			}
			addressValue = ipv6.join(':');
			// seems no need add [] for ipv6
			break;
		default:
			return {
				hasError: true,
				message: `آدرس تایپ اشتباه ${addressType}`,
			};
	}
	if (!addressValue) {
		return {
			hasError: true,
			message: `مقدار آدرس خالی است ${addressType}`,
		};
	}

	return {
		hasError: false,
		addressRemote: addressValue,
		addressType,
		portRemote,
		rawDataIndex: addressValueIndex + addressLength,
		วเลสVersion: version,
		isUDP,
	};
}


/**
 * 
 * @param {import("@cloudflare/workers-types").Socket} remoteSocket 
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket 
 * @param {ArrayBuffer | null} WlessResponseHeader
 * @param {(() => Promise<void>) | null} retry
 * @param {(info: string) => void} log 
 * @returns {Promise<void>} 
 */
async function remoteSocketToWS(remoteSocket, webSocket, WlessResponseHeader, retry, log) {
	// remote--> ws
	let remoteChunkCount = 0;
	let chunks = [];
	/** @type {ArrayBuffer | null} */
	let VlessHeader = WlessResponseHeader;
	let hasIncomingData = false; // check if remoteSocket has incoming data
	await remoteSocket.readable
		.pipeTo(
			new WritableStream({
				start() {
				},
				/**
				 * 
				 * @param {Uint8Array} chunk 
				 * @param {*} controller 
				 */
				async write(chunk, controller) {
					hasIncomingData = true;
					remoteChunkCount++;
					if (webSocket.readyState !== WS_READY_STATE_OPEN) {
						controller.error(
							'webSocket.readyState is not open, maybe close'
						);
					}
					if (VlessHeader) {
						webSocket.send(await new Blob([VlessHeader, chunk]).arrayBuffer());
						VlessHeader = null;
					} else {
						// console.log(`remoteSocketToWS send chunk ${chunk.byteLength}`);
						// seems no need rate limit this, CF seems fix this??..
						// if (remoteChunkCount > 20000) {
						// 	// cf one package is 4096 byte(4kb),  4096 * 20000 = 80M
						// 	await delay(1);
						// }
						webSocket.send(chunk);
					}
				},
				close() {
					log(`remoteConnection!.readable is close with hasIncomingData is ${hasIncomingData}`);
					// safeCloseWebSocket(webSocket); // no need server close websocket frist for some case will casue HTTP ERR_CONTENT_LENGTH_MISMATCH issue, client will send close event anyway.
				},
				abort(reason) {
					console.error(`remoteConnection!.readable abort`, reason);
				},
			})
		)
		.catch((error) => {
			console.error(
				`remoteSocketToWS has exception `,
				error.stack || error
			);
			safeCloseWebSocket(webSocket);
		});

	// seems is cf connect socket have error,
	// 1. Socket.closed will have error
	// 2. Socket.readable will be close without any data coming
	if (hasIncomingData === false && retry) {
		log(`retry`)
		retry();
	}
}


/**
 * Decodes a base64 string into an ArrayBuffer.
 * @param {string} base64Str The base64 string to decode.
 * @returns {{earlyData: ArrayBuffer|null, error: Error|null}} An object containing the decoded ArrayBuffer or null if there was an error, and any error that occurred during decoding or null if there was no error.
 */
function base64ToArrayBuffer(base64Str) {
	if (!base64Str) {
		return { earlyData: null, error: null };
	}
	try {
		// go use modified Base64 for URL rfc4648 which js atob not support
		base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
		const decode = atob(base64Str);
		const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
		return { earlyData: arryBuffer.buffer, error: null };
	} catch (error) {
		return { earlyData: null, error };
	}
}



/**
 * Checks if a given string is a valid UUID.
 * Note: This is not a real UUID validation.
 * @param {string} uuid The string to validate as a UUID.
 * @returns {boolean} True if the string is a valid UUID, false otherwise.
 */
function isValidUUID(uuid) {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}



const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
/**
 * Closes a WebSocket connection safely without throwing exceptions.
 * @param {import("@cloudflare/workers-types").WebSocket} socket The WebSocket connection to close.
 */
function safeCloseWebSocket(socket) {
	try {
		if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
			socket.close();
		}
	} catch (error) {
		console.error('safeCloseWebSocket error', error);
	}
}




const byteToHex = [];

for (let i = 0; i < 256; ++i) {
	byteToHex.push((i + 256).toString(16).slice(1));
}


function unsafeStringify(arr, offset = 0) {
	return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}




function stringify(arr, offset = 0) {
	const uuid = unsafeStringify(arr, offset);
	if (!isValidUUID(uuid)) {
		throw TypeError("Stringified UUID is invalid");
	}
	return uuid;
}


/**
 * Handles outbound UDP traffic by transforming the data into DNS queries and sending them over a WebSocket connection.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket connection to send the DNS queries over.
 * @param {ArrayBuffer} WlessResponseHeader The วเลส response header.
 * @param {(string) => void} log The logging function.
 * @returns {{write: (chunk: Uint8Array) => void}} An object with a write method that accepts a Uint8Array chunk to write to the transform stream.
 */
async function handleUDPOutBound(webSocket, WlessResponseHeader, log) {

	let isVlessHeaderSent = false;
	const transformStream = new TransformStream({
		start(controller) {

		},
		transform(chunk, controller) {
			// udp message 2 byte is the the length of udp data
			// TODO: this should have bug, beacsue maybe udp chunk can be in two websocket message
			for (let index = 0; index < chunk.byteLength;) {
				const lengthBuffer = chunk.slice(index, index + 2);
				const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
				const udpData = new Uint8Array(
					chunk.slice(index + 2, index + 2 + udpPakcetLength)
				);
				index = index + 2 + udpPakcetLength;
				controller.enqueue(udpData);
			}
		},
		flush(controller) {
		}
	});

	// only handle dns udp for now
	transformStream.readable.pipeTo(new WritableStream({
		async write(chunk) {
			const resp = await fetch(dohURL, // dns server url
				{
					method: 'POST',
					headers: {
						'content-type': 'application/dns-message',
					},
					body: chunk,
				})
			const dnsQueryResult = await resp.arrayBuffer();
			const udpSize = dnsQueryResult.byteLength;
			// console.log([...new Uint8Array(dnsQueryResult)].map((x) => x.toString(16)));
			const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
			if (webSocket.readyState === WS_READY_STATE_OPEN) {
				log(`doh success and dns message length is ${udpSize}`);
				if (isVlessHeaderSent) {
					webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
				} else {
					webSocket.send(await new Blob([WlessResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
					isVlessHeaderSent = true;
				}
			}
		}
	})).catch((error) => {
		log('dns udp has error' + error)
	});

	const writer = transformStream.writable.getWriter();

	return {
		/**
		 * 
		 * @param {Uint8Array} chunk 
		 */
		write(chunk) {
			writer.write(chunk);
		}
	};
}

const at = 'QA==';
const pt = 'dmxlc3M=';
const ed = 'RUR0dW5uZWw=';

/**
 *
 * @param {string} userID - single or comma separated userIDs
 * @param {string | null} hostName
 * @returns {string}
 * @param {import("@cloudflare/workers-types").Request} request
 * @param {{UUID: string, IP_Proxy: string, DNS_RESOLVER_URL: string, NODE_ID: int, API_HOST: string, API_TOKEN: string}} env
 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
function getValueConfig(userIDs, hostName) {
	const HttpsUrlPart443 = `:443?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpsUrlPart8443 = `:8443?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpsUrlPart2053 = `:2053?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpsUrlPart2096 = `:2096?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpsUrlPart2087 = `:42087?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpsUrlPart2083 = `:2083?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	
	const ValesMain443 = atob(pt) + '://' + userID + atob(at) + hostName + HttpsUrlPart443;
	const ValesMain8443 = atob(pt) + '://' + userID + atob(at) + hostName + HttpsUrlPart8443;
	const ValesMain2053 = atob(pt) + '://' + userID + atob(at) + hostName + HttpsUrlPart2053;
	const ValesMain2096 = atob(pt) + '://' + userID + atob(at) + hostName + HttpsUrlPart2096;
	const ValesMain2087 = atob(pt) + '://' + userID + atob(at) + hostName + HttpsUrlPart2087;
	const ValesMain2083 = atob(pt) + '://' + userID + atob(at) + hostName + HttpsUrlPart2083;


	const ValesSec443 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpsUrlPart443;
	const ValesSec8443 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpsUrlPart8443;
	const ValesSec2053 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpsUrlPart2053;
	const ValesSec2096 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpsUrlPart2096;
	const ValesSec2087 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpsUrlPart2087;
	const ValesSec2083 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpsUrlPart2083;
	
	
	const HttpUrlPart80 = `:80?encryption=none&security=none&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpUrlPart8080 = `:8080?encryption=none&security=none&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpUrlPart8880 = `:8880?encryption=none&security=none&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpUrlPart2052 = `:2052?encryption=none&security=none&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpUrlPart2086 = `:2086?encryption=none&security=none&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpUrlPart2095 = `:2095?encryption=none&security=none&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const HttpUrlPart2082 = `:2082?encryption=none&security=none&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	
	const ValesMain80 = atob(pt) + '://' + userID + atob(at) + hostName + HttpUrlPart80;
	const ValesMain8080 = atob(pt) + '://' + userID + atob(at) + hostName + HttpUrlPart8080;
	const ValesMain8880 = atob(pt) + '://' + userID + atob(at) + hostName + HttpUrlPart8880;
	const ValesMain2052 = atob(pt) + '://' + userID + atob(at) + hostName + HttpUrlPart2052;
	const ValesMain2086 = atob(pt) + '://' + userID + atob(at) + hostName + HttpUrlPart2086;
	const ValesMain2095 = atob(pt) + '://' + userID + atob(at) + hostName + HttpUrlPart2095;
	const ValesMain2082 = atob(pt) + '://' + userID + atob(at) + hostName + HttpUrlPart2082;


	const ValesSec80 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpUrlPart80;
	const ValesSec8080 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpUrlPart8080;
	const ValesSec8880 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpUrlPart8880;
	const ValesSec2052 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpUrlPart2052;
	const ValesSec2086 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpUrlPart2086;
	const ValesSec2095 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpUrlPart2095;
	const ValesSec2082 = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpUrlPart2082;
	
	
	const hashSeparator = " V2ray🆖 - IPCF Panel ";

	// Split the userIDs into an array
	const userIDArray = userIDs.split(",");

	// Prepare output string for each userID

	const ValesMain = atob(pt) + '://' + userID + atob(at) + hostName + HttpsUrlPart443;
	const ValesSec = atob(pt) + '://' + userID + atob(at) + IP_Proxy + HttpsUrlPart443;

	const sublink = `https://${hostName}/sub/${userIDArray[0]}?format=clash`
	const subbestip = `https://${hostName}/bestip/${userIDArray[0]}`;
	const clash_link = `https://api.v1.mk/sub?target=clash&url=${encodeURIComponent(sublink)}&insert=false&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;


	// Join output with newlines, wrap inside <html> and <body>
	return `
  <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPCF Panel v 0.0.2</title> 
	<link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css'>

	<style>

		
body,
html {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;

}

body {
    font-family: Arial, sans-serif;
    background-color: #000000;
}

.contaner {
    text-align: center;
}

.header {

    background-color: #f1c40f;
    width: 40%;
    display: inline-block;
    border: 1px solid black;
    border-radius: 10px;
    margin: 5px;
    box-shadow: 2px 2px 5px 0px;
}

.header h1 {
    color: #34495e;
    font-size: 30px;
}

.version {
    color: #454545;
    font-size: 15px;
}

a {
    color: #fff;
    text-decoration: none;
}

.contaner-main {
    text-align: center;

}


.head-uuid {
    background-color: #f39c12;
    width: 70%;
    display: inline-block;
    border: 1px solid black;
    border-radius: 10px;
    margin: 1px;
    padding: 10px;
    overflow: hidden;
    font-size: 15px;
    box-shadow: 2px 2px 5px 0px;
}

.head-uuid h3 {

    font-size: 20px;


}

.head-uuid p {

    font-weight: 600;


}

.main>* {
    float: left;
}

.main {
    background-color: #f1c40f;
    width: 90%;
    display: block;
    border: 1px solid rgb(255, 0, 0);
    border-radius: 10px;
    margin: 5px 0 10px 50px;
    overflow: hidden;
    box-shadow: 3px 5px 10px 0px;

}

.box {
    background-color: #d1d1d1;
    padding: 5px 5px;
    border-radius: 4px;
    width: calc(calc(100% / 3) - 82px);
    height: 170px;
    border: 1px solid rgb(0, 0, 0);
    margin: 20px 20px;
    box-shadow: 2px 5px 10px 0px;
    overflow: hidden;

}



.main-2>* {
    float: left;
    
}
.main-2{
}
.main-2 {
    background-color: #f1c40f;
    width: 90%;
    display: block;
    border: 1px solid rgb(255, 0, 0);
    border-radius: 10px;
    margin: 5px 0 10px 50px;
    overflow: hidden;
    box-shadow: 3px 5px 10px 0px;

}

.box-2 {
    background-color: #d1d1d1;
    padding: 5px 40px;
    border-radius: 4px;
    width: calc(calc(100% / 3) - 82px);
    height: 150px;
    border: 1px solid rgb(136, 91, 91);
    margin: 20px 20px;
    box-shadow: 2px 5px 10px 0px;
    overflow: hidden;
    margin-left: 120px;

}

.h1-ports{
    float: left;
    margin: 5px 0 10px 300px;
    border-radius: 10px;
    text-align: center;
    color: #000000;
    padding: 10px 10px;
    background-color: #f1c40f;
    width: 50%;
}


.btn-copy {

    padding: 10px 25px;
    color: #ecf0f1;
    border: 0;
    border-radius: 5px;
    background-color: #e74c3c;
    font-size: 20px;
    margin-top: 10px;
    margin-bottom: 10px;



}

.btn-copy:hover {

    padding: 10px 25px;
    color: #000000;

    border: 0;
    border-radius: 5px;
    background-color: #f86c5c;
    /* border: 2px solid rgba(0, 0, 0, 0.5); */


}

.p-v2ray1 {
    font-size: 20px;
    font-weight: 800;

}
.p-v2ray-port {
    font-size: 15px;
    font-weight: 600;

}


.btn-copy-https {

    padding: 2px 10px;
    color: #ecf0f1;
    border: 0;
    border-radius: 5px;
    background-color: #e74c3c;
    font-size: 20px;
    margin-top: 5px;

}
.btn-copy-https:hover {

    padding: 2px 10px;
    color: #000000;

    border: 0;
    border-radius: 5px;
    background-color: #f86c5c;
    /* border: 2px solid rgba(0, 0, 0, 0.5); */


}



hr {
    width: 70%;
    color: #34495e;
    border: 1px solid black;
}

.befor-footer {
    text-align: center;
}


@media screen and (max-width: 900px) {

    body {
        background-color: #000000;
    }

    .contaner {
        text-align: center;
    }

    .header {

        background-color: #f1c40f;
        width: 40%;
        display: inline-block;
        border: 1px solid black;
        border-radius: 10px;
        margin: 10px;
    }

    .header h1 {
        color: #34495e;
        font-size: 20px;
    }

    .version {
        color: #454545;
        font-size: 12px;
    }




    .contaner-main {
        text-align: center;

    }

    .head-uuid {
        background-color: #f39c12;
        width: 70%;
        display: inline-block;
        border: 1px solid black;
        border-radius: 10px;
        margin: 5px;
        padding: 10px;
        overflow: hidden;
        font-size: 10px;
    }

    .head-uuid h3 {

        font-size: 15px;


    }

    .head-uuid p {

        font-weight: 600;


    }

    .main>* {
        float: left;
    }

    .main {

        background-color: #f1c40f;
        width: 95%;
        display: inline-block;
        border: 1px solid rgb(255, 0, 0);
        border-radius: 10px;
        margin: 5px 0 5px 0px;
        overflow: hidden;


    }

    .box {
        background-color: #fff;
        padding: 5px 5px;
        border-radius: 4px;
        width: calc(calc(100% / 2) - 32px);
        border: 1px solid rgb(0, 0, 0);
        margin: 10px 10px;
        overflow: hidden;

    }



    .main-2>* {
        float: left;
    }

    .main-2 {

        background-color: #f1c40f;
        width: 95%;
        display: inline-block;
        border: 1px solid rgb(255, 0, 0);
        border-radius: 10px;
        margin: 5px 0 5px 0px;
        overflow: hidden;


    }

    .box-2 {
        background-color: #fff;
        padding: 5px 5px;
        border-radius: 4px;
        width: calc(calc(100% / 2) - 32px);
        border: 1px solid rgb(0, 0, 0);
        margin: 10px 10px;
        overflow: hidden;
        height: 250px;

    }

    
    
 .h1-ports{
        float: left;
        margin: 5px 0 10px 45px;
        border-radius: 10px;
        text-align: center;
        color: #000000;
        padding: 10px 10px;
        font-size: 20px;
        background-color: #f1c40f;
        width: 70%;
    }
    .p-v2ray1 {
        font-size: 15px;
        font-weight: 800;

    }

    .btn-copy {

        padding: 7px 17px;
        color: #ecf0f1;
        border: 0;
        border-radius: 5px;
        background-color: #e74c3c;
        font-size: 15px;
        margin-top: 10px;
        margin-bottom: 1px;



    }

    .btn-copy:hover {

        padding: 7px 17px;
        color: #000000;

        border: 0;
        border-radius: 5px;
        background-color: #e74c3c;
        border: 2px solid rgba(0, 0, 0, 0.5);


    }


}

	</style>

	</head>

	<body>

	<div class="contaner">
	  <div class="header">
  
		<h1>IPCF Panel</h1>
		<p class="version"> Version : 0.0.2</p>
  
	  </div>
	</div>
  
	<div class="contaner-main">
  
	  <div class="head-uuid">
		<h2> UUID</h2>
		<h3>${userID}</h3>
		<hr>
		<p>${hashSeparator}</p>
	  </div>
	  
	  <div class="main">
		<div class="box">
		  <p class="p-v2ray1"> کانفیگ با ساب دامنه اصلی و آیپی پیشفرض </p>
		  <hr>
		  <button class="btn-copy" onclick='copyToClipboard("${ValesMain}")'> کپی کردن </button>
  
		</div>
  
  
		<div class="box">
		  <p class="p-v2ray1"> کانفیگ بدون ساب دامنه اصلی و آیپی تمیز پیشفرض </p>
		  <hr>
		  <button class="btn-copy" onclick='copyToClipboard("${ValesSec}")'> کپی کردن </button>
		</div>
  
  
  
		<div class="box">
		  <p class="p-v2ray1">سابلینک کل کانفیگ ها</p>
		  <hr>
		  <button class="btn-copy" onclick='copyToClipboard("https://${hostName}/sub/${userIDArray[0]}")'> کپی کردن
		  </button>
		</div>

  
		<div class="box">
		  <p class="p-v2ray1">سابلینک کانفیگ های کلش</p>
		  <hr>
		  <button class="btn-copy" onclick='copyToClipboard("https://api.v1.mk/sub?target=clash&url=${encodeURIComponent(sublink)}&insert=false&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true")'> کپی کردن
		  </button>
		</div>
  
  
  
  
	  </div>
		<h1 class="h1-ports">انتخاب پورت های دلخواه</h1>
	  <div class="main-2">
		
		<div class="box-2">
		  <p class="p-v2ray-port">با ساب دامنه اصلی HTTPS  پورت های </p>
		  <hr>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain443}")'>443</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain8443}")'>8443</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2053}")'>2053</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2096}")'>2096</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2087}")'>2087</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2083}")'>2083</button>
		</div>
  
		<div class="box-2">
		  <p class="p-v2ray-port">با ساب دامنه اصلی  HTTP پورت های  </p>
		  <hr>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain80}")'>80</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain8080}")'>8080</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain8880}")'>8880</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2052}")'>2052</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2086}")'>2086</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2095}")'>2095</button>
		  <button class="btn-copy-https" onclick='copyToClipboard("${ValesMain2082}")'>2082</button>
		</div>
  
		<div class="box-2">
        <p class="p-v2ray-port">بدون ساب دامنه اصلی  HTTPS  پورت های </p>
        <hr>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec443}")'>443</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec8443}")'>8443</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2053}")'>2053</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2096}")'>2096</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2087}")'>2087</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2083}")'>2083</button>
      </div>

      <div class="box-2">
        <p class="p-v2ray-port">بدون ساب دامنه اصلی  HTTP پورت های  </p>
        <hr>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec80}")'>80</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec8080}")'>8080</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec8880}")'>8880</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2052}")'>2052</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2086}")'>2086</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2095}")'>2095</button>
        <button class="btn-copy-https" onclick='copyToClipboard("${ValesSec2082}")'>2082</button>
      </div>

	  </div>
  
	</div>
  
  
  
  </body>
  <script>
	function copyToClipboard(text) {
	  navigator.clipboard.writeText(text)
		.then(() => {
		  alert(" با موفقیت در کلیپ-بورد کپی شد");
		})
		.catch((err) => {
		  console.error("در کپی کردن مشکلی پیش آمد", err);
		});
	}
  </script>
  </html>`;
}



function Create_a_Sub_Valley(User_ID_Path, Hostname) {
	const User_ID_array = User_ID_Path.includes(',') ? User_ID_Path.split(',') : [User_ID_Path];
	const General_Url_Http = `?encryption=none&security=none&fp=random&type=ws&host=${Hostname}&path=%2F%3Fed%3D2048#`;
	const General_Url_Https = `?encryption=none&security=tls&sni=${Hostname}&fp=random&type=ws&host=${Hostname}&path=%2F%3Fed%3D2048#`;

	const result = User_ID_array.flatMap((User_ID) => {
		const Http_configuration = Array.from(Set_Http_port).flatMap((port) => {
			if (!Hostname.includes('pages.dev')) {
				const Url_section = `${Hostname}-HTTP-${port}`;
				const Http_main_vales = atob(pt) + '://' + User_ID + atob(at) + Hostname + ':' + port + General_Url_Http + Url_section;
				return ProxyIPs.flatMap((IP_Proxy) => {
					const Valesrong_Http = atob(pt) + '://' + User_ID + atob(at) + IP_Proxy + ':' + port + General_Url_Http + Url_section + '-' + IP_Proxy + '-' + atob(ed);
					return [Http_main_vales, Valesrong_Http];
				});
			}
			return [];
		});

		const Http_configurations = Array.from(Set_Http_ports).flatMap((port) => {
			const Url_section = `${Hostname}-HTTPS-${port}`;
			const Http_main_valess = atob(pt) + '://' + User_ID + atob(at) + Hostname + ':' + port + General_Url_Https + Url_section;
			return ProxyIPs.flatMap((IP_Proxy) => {
				const Valesrong_Https = atob(pt) + '://' + User_ID + atob(at) + IP_Proxy + ':' + port + General_Url_Https + Url_section + '-' + IP_Proxy + '-' + atob(ed);
				return [Http_main_valess, Valesrong_Https];
			});
		});

		return [...Http_configuration, ...Http_configurations];
	});

	return result.join('\n');
}


const cn_hostnames = [
	'weibo.com',                // Weibo - A popular social media platform
	'www.baidu.com',            // Baidu - The largest search engine in China
	'www.qq.com',               // QQ - A widely used instant messaging platform
	'www.taobao.com',           // Taobao - An e-commerce website owned by Alibaba Group
	'www.jd.com',               // JD.com - One of the largest online retailers in China
	'www.sina.com.cn',          // Sina - A Chinese online media company
	'www.sohu.com',             // Sohu - A Chinese internet service provider
	'www.tmall.com',            // Tmall - An online retail platform owned by Alibaba Group
	'www.163.com',              // NetEase Mail - One of the major email providers in China
	'www.zhihu.com',            // Zhihu - A popular question-and-answer website
	'www.youku.com',            // Youku - A Chinese video sharing platform
	'www.xinhuanet.com',        // Xinhua News Agency - Official news agency of China
	'www.douban.com',           // Douban - A Chinese social networking service
	'www.meituan.com',          // Meituan - A Chinese group buying website for local services
	'www.toutiao.com',          // Toutiao - A news and information content platform
	'www.ifeng.com',            // iFeng - A popular news website in China
	'www.autohome.com.cn',      // Autohome - A leading Chinese automobile online platform
	'www.360.cn',               // 360 - A Chinese internet security company
	'www.douyin.com',           // Douyin - A Chinese short video platform
	'www.kuaidi100.com',        // Kuaidi100 - A Chinese express delivery tracking service - //PersianWebsite add a proxyIPsys By CLAXPOINT
	'www.wechat.com',           // WeChat - A popular messaging and social media app
	'www.csdn.net',             // CSDN - A Chinese technology community website
	'www.imgo.tv',              // ImgoTV - A Chinese live streaming platform
	'www.aliyun.com',           // Alibaba Cloud - A Chinese cloud computing company
	'www.eyny.com',             // Eyny - A Chinese multimedia resource-sharing website
	'www.mgtv.com',             // MGTV - A Chinese online video platform
	'www.xunlei.com',           // Xunlei - A Chinese download manager and torrent client
	'www.hao123.com',           // Hao123 - A Chinese web directory service
	'www.bilibili.com',         // Bilibili - A Chinese video sharing and streaming platform
	'www.youth.cn',             // Youth.cn - A China Youth Daily news portal
	'www.hupu.com',             // Hupu - A Chinese sports community and forum
	'www.youzu.com',            // Youzu Interactive - A Chinese game developer and publisher
	'www.panda.tv',             // Panda TV - A Chinese live streaming platform
	'www.tudou.com',            // Tudou - A Chinese video-sharing website -//PersianWebsite add a proxyIPsys By CLAXPOINT
	'www.zol.com.cn',           // ZOL - A Chinese electronics and gadgets website
	'www.toutiao.io',           // Toutiao - A news and information app
	'www.tiktok.com',           // TikTok - A Chinese short-form video app
	'www.netease.com',          // NetEase - A Chinese internet technology company
	'www.cnki.net',             // CNKI - China National Knowledge Infrastructure, an information aggregator - //PersianWebsite add a proxyIPsys By CLAXPOINT
	'www.zhibo8.cc',            // Zhibo8 - A website providing live sports streams
	'www.zhangzishi.cc',        // Zhangzishi - Personal website of Zhang Zishi, a public intellectual in China
	'www.xueqiu.com',           // Xueqiu - A Chinese online social platform for investors and traders
	'www.qqgongyi.com',         // QQ Gongyi - Tencent's charitable foundation platform
	'www.ximalaya.com',         // Ximalaya - A Chinese online audio platform - //PersianWebsite add a proxyIPsys By CLAXPOINT
	'www.dianping.com',         // Dianping - A Chinese online platform for finding and reviewing local businesses
	'www.suning.com',           // Suning - A leading Chinese online retailer - //PersianWebsite add a proxyIPsys By CLAXPOINT
	'www.zhaopin.com',          // Zhaopin - A Chinese job recruitment platform
	'www.jianshu.com',          // Jianshu - A Chinese online writing platform - //PersianWebsite add a proxyIPsys By CLAXPOINT
	'www.mafengwo.cn',          // Mafengwo - A Chinese travel information sharing platform
	'www.51cto.com',            // 51CTO - A Chinese IT technical community website
	'www.qidian.com',           // Qidian - A Chinese web novel platform
	'www.ctrip.com',            // Ctrip - A Chinese travel services provider
	'www.pconline.com.cn',      // PConline - A Chinese technology news and review website
	'www.cnzz.com',             // CNZZ - A Chinese web analytics service provider
	'www.telegraph.co.uk',      // The Telegraph - A British newspaper website	
	'www.ynet.com',             // Ynet - A Chinese news portal
	'www.ted.com',              // TED - A platform for ideas worth spreading
	'www.renren.com',           // Renren - A Chinese social networking service
	'www.pptv.com',             // PPTV - A Chinese online video streaming platform
	'www.liepin.com',           // Liepin - A Chinese online recruitment website
	'www.881903.com',           // 881903 - A Hong Kong radio station website
	'www.aipai.com',            // Aipai - A Chinese online video sharing platform
	'www.ttpaihang.com',        // Ttpaihang - A Chinese celebrity popularity ranking website
	'www.quyaoya.com',          // Quyaoya - A Chinese online ticketing platform
	'www.91.com',               // 91.com - A Chinese software download website
	'www.dianyou.cn',           // Dianyou - A Chinese game information website
	'www.tmtpost.com',          // TMTPost - A Chinese technology media platform
	'www.douban.com',           // Douban - A Chinese social networking service
	'www.guancha.cn',           // Guancha - A Chinese news and commentary website
	'www.so.com',               // So.com - A Chinese search engine
	'www.58.com',               // 58.com - A Chinese classified advertising website
	'www.cnblogs.com',          // Cnblogs - A Chinese technology blog community
	'www.cntv.cn',              // CCTV - China Central Television official website
	'www.secoo.com',            // Secoo - A Chinese luxury e-commerce platform
	'http://webkernel.net',     //iranian website ADDED by moein
	'https://speedtest.net',    //speedtest Moein
	'https://zula.ir',          //zula
	'http://getasa.ir',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.taobao.com',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.douyin.com',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.pinduoduo.com',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.xiaohongshu.com',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.jd.com',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.tmall.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.1688.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.smzdm.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.meituan.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.dianping.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.amazon.cn/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.vip.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.vmall.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.suning.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.dangdang.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://en.ch.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.neteasegames.com/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
	'https://www.shein.com.hk/',         //PersianWebsite add a proxyIPsys By CLAXPOINT
];
