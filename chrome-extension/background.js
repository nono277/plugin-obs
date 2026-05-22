/**
 * Background service worker — maintains WebSocket connection to OBS server
 * and forwards track data received from the content script.
 */

const WS_URL = 'ws://localhost:8080';
const RECONNECT_DELAY = 3000;

let ws = null;
let reconnectTimer = null;

function connect() {
	clearTimeout(reconnectTimer);

	ws = new WebSocket(WS_URL);

	ws.addEventListener('open', () => {
		console.log('[OBS Bridge] WebSocket connected');
	});

	ws.addEventListener('close', () => {
		console.log('[OBS Bridge] WebSocket closed — reconnecting...');
		reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
	});

	ws.addEventListener('error', () => {
		ws.close();
	});
}

connect();

// Receive messages from content script
chrome.runtime.onMessage.addListener((message) => {
	if (message.type !== 'track_update') return;
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(message));
	}
});
