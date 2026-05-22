/**
 * Background script Firefox — connexion WebSocket persistante vers OBS.
 * Manifest V2 = script persistent, WebSocket fonctionne sans service worker.
 */

const WS_URL = 'ws://localhost:8080';
const RECONNECT_DELAY = 3000;

let ws = null;

function connect() {
	ws = new WebSocket(WS_URL);

	ws.addEventListener('open', () => {
		console.log('[OBS Bridge] Connecté');
	});

	ws.addEventListener('close', () => {
		console.log('[OBS Bridge] Déconnecté — reconnexion...');
		setTimeout(connect, RECONNECT_DELAY);
	});

	ws.addEventListener('error', () => {
		ws.close();
	});
}

connect();

browser.runtime.onMessage.addListener((message) => {
	if (message.type !== 'track_update') return;
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(message));
	}
});
