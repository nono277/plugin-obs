/**
 * Serveur de production — SvelteKit + WebSocket sur le même port.
 * Utilisé par Render / Railway / Fly.io (un seul port exposé).
 * En développement, utilisez `npm run dev` à la place.
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dirname, '.spotify-tokens.json');
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL   = 'https://accounts.spotify.com/api/token';
const POLL_MS     = 2000;

// ── Import du handler SvelteKit (généré par `npm run build`) ─────────────────
const { handler } = await import('./build/handler.js');

// ── État des sources ─────────────────────────────────────────────────────────
const state = {
	spotify: null, youtube: null,
	youtubeLastSeen: 0,
	spotifyStartedAt: 0, youtubeStartedAt: 0
};
const YOUTUBE_TIMEOUT = 5000;

function resolveActiveTrack() {
	const spPlaying = state.spotify?.isPlaying === true;
	const ytAlive   = Date.now() - state.youtubeLastSeen < YOUTUBE_TIMEOUT;
	const ytPlaying = ytAlive && state.youtube?.isPlaying === true;
	if (spPlaying && !ytPlaying) return state.spotify;
	if (ytPlaying && !spPlaying) return state.youtube;
	if (spPlaying && ytPlaying)  return state.spotifyStartedAt >= state.youtubeStartedAt ? state.spotify : state.youtube;
	if (state.spotifyStartedAt >= state.youtubeStartedAt) return state.spotify ?? (ytAlive ? state.youtube : null);
	return (ytAlive && state.youtube) ? state.youtube : state.spotify;
}

// ── Spotify helpers ───────────────────────────────────────────────────────────
function loadTokens() {
	if (!existsSync(TOKEN_FILE)) return null;
	try { return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')); } catch { return null; }
}
function saveTokens(t) { writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2)); }
function basicAuth() {
	return Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
}
async function refreshTokens(t) {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth()}` },
		body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken })
	});
	if (!res.ok) throw new Error(`Refresh ${res.status}`);
	const d = await res.json();
	return { accessToken: d.access_token, refreshToken: d.refresh_token ?? t.refreshToken, expiresAt: Date.now() + d.expires_in * 1000 };
}
async function getValidTokens(t) {
	if (Date.now() < t.expiresAt - 60_000) return t;
	const r = await refreshTokens(t); saveTokens(r); return r;
}
async function fetchSpotifyTrack(token) {
	const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, { headers: { Authorization: `Bearer ${token}` } });
	if (res.status === 204) return null;
	if (!res.ok) throw new Error(`Spotify ${res.status}`);
	const d = await res.json();
	if (!d?.item) return null;
	return {
		title: d.item.name, artist: d.item.artists?.map(a => a.name).join(', '),
		album: d.item.album?.name, artworkUrl: d.item.album?.images?.[0]?.url,
		duration: Math.floor((d.item.duration_ms ?? 0) / 1000),
		position: Math.floor((d.progress_ms ?? 0) / 1000),
		isPlaying: d.is_playing, source: 'spotify', beats: [], segments: [], tempo: 120, energy: 0.5
	};
}

// ── WebSocket ────────────────────────────────────────────────────────────────
const clients = new Set();
let lastBroadcast = null;

function broadcast(track) {
	if (!track) return;
	const msg = JSON.stringify({ type: 'track_update', payload: track });
	for (const ws of clients) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
	lastBroadcast = track;
}
function broadcastIfChanged(track) {
	if (!track) return;
	const changed = !lastBroadcast || lastBroadcast.title !== track.title
		|| lastBroadcast.isPlaying !== track.isPlaying
		|| lastBroadcast.source !== track.source
		|| Math.abs((lastBroadcast.position ?? 0) - (track.position ?? 0)) > 2;
	if (changed) broadcast(track);
}

// ── Serveur HTTP + WebSocket sur le même port ─────────────────────────────────
const server = createServer(handler);
const wss    = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
	wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
	clients.add(ws);
	const current = resolveActiveTrack();
	if (current) ws.send(JSON.stringify({ type: 'track_update', payload: current }));

	ws.on('message', (data) => {
		try {
			const msg = JSON.parse(data.toString());
			if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
			if (msg.type === 'track_update' && msg.payload?.source === 'youtube') {
				if (!state.youtube?.isPlaying && msg.payload.isPlaying) state.youtubeStartedAt = Date.now();
				state.youtube = msg.payload;
				state.youtubeLastSeen = Date.now();
				broadcastIfChanged(resolveActiveTrack());
			}
		} catch {}
	});
	ws.on('close', () => clients.delete(ws));
});

// ── Polling Spotify ───────────────────────────────────────────────────────────
async function pollSpotify() {
	let tokens = loadTokens();
	if (!tokens) return;
	try {
		tokens = await getValidTokens(tokens);
		const track = await fetchSpotifyTrack(tokens.accessToken);
		if (!state.spotify?.isPlaying && track?.isPlaying) state.spotifyStartedAt = Date.now();
		state.spotify = track;
		broadcastIfChanged(resolveActiveTrack());
	} catch (e) { console.error('[Spotify]', e.message); }
}

server.listen(PORT, () => {
	console.log(`\n🎵 OBS Music Overlay — Production`);
	console.log(`   http://localhost:${PORT}`);
	setInterval(pollSpotify, POLL_MS);
	pollSpotify();
});
