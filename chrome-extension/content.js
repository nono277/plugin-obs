/**
 * Content script — fonctionne sur youtube.com ET music.youtube.com
 * Lit les données de lecture et les envoie au background worker.
 */

const POLL_MS = 1000;
const isYouTubeMusic = location.hostname === 'music.youtube.com';

function getTrackInfo() {
	// MediaSession API — fonctionne sur les deux sites
	const session = navigator.mediaSession;
	const meta = session?.metadata;

	if (meta?.title) {
		const artwork = [...(meta.artwork ?? [])]
			.sort((a, b) => {
				const sA = parseInt(a.sizes?.split('x')[0] ?? '0');
				const sB = parseInt(b.sizes?.split('x')[0] ?? '0');
				return sB - sA;
			})[0]?.src ?? '';

		return {
			title: meta.title,
			artist: meta.artist ?? '',
			album: meta.album ?? '',
			artworkUrl: artwork,
			isPlaying: session.playbackState === 'playing',
			duration: getDuration(),
			position: getPosition(),
			source: 'youtube'
		};
	}

	// Fallback DOM selon le site
	return isYouTubeMusic ? scrapeYouTubeMusic() : scrapeYouTube();
}

// ── YouTube normal (youtube.com) ─────────────────────────────────────────────

function scrapeYouTube() {
	const titleEl = document.querySelector('.ytp-title-link, .title.ytd-video-primary-info-renderer');
	const video = document.querySelector('video');
	if (!titleEl || !video) return null;

	// Artiste depuis la page de la chaîne
	const channelEl = document.querySelector(
		'#channel-name a, .ytd-channel-name a, yt-formatted-string#owner-name a'
	);

	// Miniature : thumbnail OG de la page
	const thumbMeta = document.querySelector('meta[property="og:image"]');
	const artworkUrl = thumbMeta?.getAttribute('content') ?? '';

	const isPlaying = !video.paused && !video.ended;

	return {
		title: titleEl.textContent?.trim() ?? '',
		artist: channelEl?.textContent?.trim() ?? '',
		album: '',
		artworkUrl,
		isPlaying,
		duration: Math.floor(video.duration || 0),
		position: Math.floor(video.currentTime || 0),
		source: 'youtube'
	};
}

// ── YouTube Music (music.youtube.com) ────────────────────────────────────────

function scrapeYouTubeMusic() {
	const titleEl = document.querySelector('.title.ytmusic-player-bar');
	const artistEl = document.querySelector('.byline.ytmusic-player-bar');
	const thumbEl = document.querySelector('#thumbnail.ytmusic-player-bar img');
	const playBtn = document.querySelector('.play-pause-button[aria-label]');

	if (!titleEl) return null;

	const isPlaying = playBtn?.getAttribute('aria-label')?.toLowerCase().includes('pause') ?? false;

	return {
		title: titleEl.textContent?.trim() ?? '',
		artist: artistEl?.textContent?.trim() ?? '',
		album: '',
		artworkUrl: thumbEl?.src ?? '',
		isPlaying,
		duration: getDurationYTMusic(),
		position: getPositionYTMusic(),
		source: 'youtube'
	};
}

// ── Helpers durée/position ────────────────────────────────────────────────────

function getDuration() {
	const video = document.querySelector('video');
	if (video) return Math.floor(video.duration || 0);
	return getDurationYTMusic();
}

function getPosition() {
	const video = document.querySelector('video');
	if (video) return Math.floor(video.currentTime || 0);
	return getPositionYTMusic();
}

function getDurationYTMusic() {
	const el = document.querySelector('.time-info .duration, .time-info');
	if (!el) return 0;
	const text = el.textContent ?? '';
	const parts = text.trim().split('/');
	return parseTime(parts[1]?.trim() ?? parts[0]?.trim() ?? '');
}

function getPositionYTMusic() {
	const bar = document.querySelector('#progress-bar, tp-yt-paper-slider#progress-bar');
	if (bar) {
		const value = parseFloat(bar.getAttribute('value') ?? '0');
		const max = parseFloat(bar.getAttribute('max') ?? '1');
		const dur = getDurationYTMusic();
		return dur > 0 ? Math.floor((value / max) * dur) : 0;
	}
	return 0;
}

function parseTime(str) {
	const parts = str.split(':').map(Number);
	if (parts.length === 2) return (parts[0] * 60) + parts[1];
	if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
	return 0;
}

// ── Envoi au background ───────────────────────────────────────────────────────

let lastTitle = '';
let lastPlaying = null;

setInterval(() => {
	const track = getTrackInfo();
	if (!track?.title) return;

	const changed =
		track.title !== lastTitle ||
		track.isPlaying !== lastPlaying;

	if (changed) {
		lastTitle = track.title;
		lastPlaying = track.isPlaying;
	}

	// Toujours envoyer pour mettre à jour la position
	chrome.runtime.sendMessage({ type: 'track_update', payload: track });
}, POLL_MS);
