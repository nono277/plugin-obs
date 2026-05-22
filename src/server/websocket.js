/**
 * WebSocket server — gère Spotify ET YouTube Music.
 * Priorité : Spotify si en lecture, sinon YouTube Music si en lecture.
 * Basculement automatique en temps réel.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dirname, '../../.spotify-tokens.json');
const WS_PORT = parseInt(process.env.WS_PORT ?? '8080', 10);
const POLL_INTERVAL = 1000;

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// ── État des deux sources ────────────────────────────────────────────────────

const state = {
	spotify:          null,
	youtube:          null,
	youtubeLastSeen:  0,
	spotifyStartedAt: 0,   // timestamp du dernier démarrage Spotify
	youtubeStartedAt: 0,   // timestamp du dernier démarrage YouTube
};

const YOUTUBE_TIMEOUT = 5000;

// ── Logique de sélection ──────────────────────────────────────────────────────
// Règle simple : la source qui a démarré EN DERNIER gagne.
// Si une seule joue → elle gagne.
// Si aucune ne joue → on affiche la dernière active en pause.

function resolveActiveTrack() {
	const spotifyPlaying = state.spotify?.isPlaying === true;
	const youtubeAlive   = Date.now() - state.youtubeLastSeen < YOUTUBE_TIMEOUT;
	const youtubePlaying = youtubeAlive && state.youtube?.isPlaying === true;

	// Une seule joue → évident
	if (spotifyPlaying && !youtubePlaying) return state.spotify;
	if (youtubePlaying && !spotifyPlaying) return state.youtube;

	// Les deux jouent → celle qui a démarré en dernier
	if (spotifyPlaying && youtubePlaying) {
		return state.spotifyStartedAt >= state.youtubeStartedAt
			? state.spotify
			: state.youtube;
	}

	// Aucune ne joue → la dernière qui a été active
	if (state.spotifyStartedAt >= state.youtubeStartedAt) {
		return state.spotify ?? (youtubeAlive ? state.youtube : null);
	} else {
		return (youtubeAlive && state.youtube) ? state.youtube : state.spotify;
	}
}

// ── Token persistence ────────────────────────────────────────────────────────

function loadTokens() {
	if (!existsSync(TOKEN_FILE)) return null;
	try { return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')); }
	catch { return null; }
}

function saveTokens(tokens) {
	writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// ── Spotify helpers ──────────────────────────────────────────────────────────

function basicAuth() {
	const id = process.env.SPOTIFY_CLIENT_ID ?? '';
	const secret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
	return Buffer.from(`${id}:${secret}`).toString('base64');
}

async function refreshTokens(tokens) {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${basicAuth()}`
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: tokens.refreshToken
		})
	});
	if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
	const data = await res.json();
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? tokens.refreshToken,
		expiresAt: Date.now() + data.expires_in * 1000
	};
}

async function getValidTokens(tokens) {
	if (Date.now() < tokens.expiresAt - 60_000) return tokens;
	const refreshed = await refreshTokens(tokens);
	saveTokens(refreshed);
	return refreshed;
}

// Cache des beats par track ID
const beatsCache = new Map();

async function fetchAudioAnalysis(trackId, accessToken) {
	if (beatsCache.has(trackId)) return beatsCache.get(trackId);
	try {
		const [analysisRes, featuresRes] = await Promise.all([
			fetch(`${SPOTIFY_API}/audio-analysis/${trackId}`, {
				headers: { Authorization: `Bearer ${accessToken}` }
			}),
			fetch(`${SPOTIFY_API}/audio-features/${trackId}`, {
				headers: { Authorization: `Bearer ${accessToken}` }
			})
		]);
		if (!analysisRes.ok || !featuresRes.ok) return null;
		const [analysis, features] = await Promise.all([analysisRes.json(), featuresRes.json()]);

		const result = {
			beats: (analysis.beats ?? []).map(b => ({
				start: b.start,
				duration: b.duration,
				confidence: b.confidence
			})),
			segments: (analysis.segments ?? []).map(s => ({
				start:            s.start,
				duration:         s.duration,
				loudnessStart:    s.loudness_start,
				loudnessMax:      s.loudness_max,
				loudnessMaxTime:  s.loudness_max_time,
				pitches:          s.pitches,
				timbre:           s.timbre
			})),
			tempo: features.tempo ?? 120,
			energy: features.energy ?? 0.5
		};
		beatsCache.set(trackId, result);
		// Garder le cache léger
		if (beatsCache.size > 10) beatsCache.delete(beatsCache.keys().next().value);
		return result;
	} catch {
		return null;
	}
}

async function fetchSpotifyTrack(accessToken) {
	const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (res.status === 204) return null;
	if (!res.ok) throw new Error(`Spotify ${res.status}`);
	const data = await res.json();
	if (!data?.item) return null;

	const trackId = data.item.id;
	const analysis = await fetchAudioAnalysis(trackId, accessToken);

	return {
		title:      data.item.name ?? 'Unknown',
		artist:     data.item.artists?.map((a) => a.name).join(', ') ?? '',
		album:      data.item.album?.name ?? '',
		artworkUrl: data.item.album?.images?.[0]?.url ?? '',
		duration:   Math.floor((data.item.duration_ms ?? 0) / 1000),
		position:   Math.floor((data.progress_ms ?? 0) / 1000),
		isPlaying:  data.is_playing ?? false,
		source:     'spotify',
		beats:      analysis?.beats    ?? [],
		segments:   analysis?.segments ?? [],
		tempo:      analysis?.tempo    ?? 120,
		energy:     analysis?.energy   ?? 0.5
	};
}

// ── WebSocket server ─────────────────────────────────────────────────────────

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();
let lastBroadcast = null;

function broadcast(track) {
	const data = JSON.stringify({ type: 'track_update', payload: track });
	for (const ws of clients) {
		if (ws.readyState === WebSocket.OPEN) ws.send(data);
	}
	lastBroadcast = track;
}

function broadcastIfChanged(track) {
	if (!track) return;
	const changed =
		!lastBroadcast ||
		lastBroadcast.title !== track.title ||
		lastBroadcast.artist !== track.artist ||
		lastBroadcast.isPlaying !== track.isPlaying ||
		lastBroadcast.source !== track.source ||
		Math.abs((lastBroadcast.position ?? 0) - (track.position ?? 0)) > 2;

	if (changed) broadcast(track);
}

wss.on('connection', (ws) => {
	clients.add(ws);
	console.log(`[WS] Client connecté (total: ${clients.size})`);

	// Envoyer l'état actuel immédiatement
	const current = resolveActiveTrack();
	if (current) {
		ws.send(JSON.stringify({ type: 'track_update', payload: current }));
	}

	ws.on('message', (data) => {
		try {
			const msg = JSON.parse(data.toString());

			if (msg.type === 'ping') {
				ws.send(JSON.stringify({ type: 'pong' }));
				return;
			}

			// Mise à jour YouTube depuis l'extension Firefox/Chrome
			if (msg.type === 'track_update' && msg.payload?.source === 'youtube') {
				const wasPlaying = state.youtube?.isPlaying === true;
				const nowPlaying = msg.payload.isPlaying === true;

				// Démarre → enregistrer le timestamp
				if (!wasPlaying && nowPlaying) {
					state.youtubeStartedAt = Date.now();
				}

				state.youtube = msg.payload;
				state.youtubeLastSeen = Date.now();

				const active = resolveActiveTrack();
				broadcastIfChanged(active);

				const icon = nowPlaying ? '▶' : '⏸';
				console.log(`[YouTube] ${icon} ${msg.payload.title} — ${msg.payload.artist}`);
			}
		} catch {
			// ignore
		}
	});

	ws.on('close', () => {
		clients.delete(ws);
		console.log(`[WS] Client déconnecté (total: ${clients.size})`);
	});
});

// ── Polling Spotify ──────────────────────────────────────────────────────────

async function pollSpotify() {
	let tokens = loadTokens();
	if (!tokens) return;

	try {
		tokens = await getValidTokens(tokens);
		const track = await fetchSpotifyTrack(tokens.accessToken);

		const prev = state.spotify;
		state.spotify = track;

		const wasPlaying = prev?.isPlaying === true;
		const nowPlaying = track?.isPlaying === true;

		// Démarre → enregistrer le timestamp
		if (!wasPlaying && nowPlaying) {
			state.spotifyStartedAt = Date.now();
		}

		if (wasPlaying !== nowPlaying || (track && prev?.title !== track.title)) {
			const icon = nowPlaying ? '▶' : (track ? '⏸' : '■');
			console.log(`[Spotify] ${icon} ${track?.title ?? 'Rien'} — ${track?.artist ?? ''}`);
		}

		const active = resolveActiveTrack();
		broadcastIfChanged(active);
	} catch (err) {
		console.error('[Spotify poll]', err.message);
	}
}

// ── Démarrage ────────────────────────────────────────────────────────────────

httpServer.listen(WS_PORT, () => {
	console.log(`\n🎵 OBS Music Overlay — Serveur WebSocket`);
	console.log(`   ws://localhost:${WS_PORT}`);
	console.log(`   Spotify  : ${existsSync(TOKEN_FILE) ? '✓ tokens présents' : '✗ non connecté — allez sur /settings'}`);
	console.log(`   YouTube  : en attente de l'extension Chrome\n`);

	setInterval(pollSpotify, POLL_INTERVAL);
	pollSpotify();
});
