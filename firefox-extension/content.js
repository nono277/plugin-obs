/**
 * Content script Firefox — YouTube normal et YouTube Music.
 * isPlaying toujours lu depuis l'élément <video> (fiable),
 * titre/artiste depuis MediaSession ou DOM.
 */

const POLL_MS = 1000;
const isYouTubeMusic = location.hostname === 'music.youtube.com';

function getVideo() {
	return document.querySelector('video');
}

function isVideoPlaying() {
	const v = getVideo();
	if (!v) return false;
	return !v.paused && !v.ended && v.readyState >= 2;
}

function getTrackInfo() {
	const video = getVideo();
	if (!video) return null;

	const isPlaying = isVideoPlaying();

	// MediaSession pour titre/artiste/artwork (fiable)
	const meta = navigator.mediaSession?.metadata;
	if (meta?.title) {
		const artwork = [...(meta.artwork ?? [])]
			.sort((a, b) => parseInt(b.sizes ?? '0') - parseInt(a.sizes ?? '0'))[0]?.src ?? '';

		return {
			title:     meta.title,
			artist:    meta.artist ?? '',
			album:     meta.album ?? '',
			artworkUrl: artwork,
			isPlaying,                          // ← toujours depuis <video>
			duration:  Math.floor(video.duration || 0),
			position:  Math.floor(video.currentTime || 0),
			source:    'youtube'
		};
	}

	// Fallback DOM
	return isYouTubeMusic ? scrapeYouTubeMusic(isPlaying, video) : scrapeYouTube(isPlaying, video);
}

function scrapeYouTube(isPlaying, video) {
	const titleEl = document.querySelector(
		'.ytp-title-link, h1.ytd-watch-metadata yt-formatted-string, #title h1'
	);
	const channelEl = document.querySelector(
		'#channel-name a, ytd-channel-name a, #owner #channel-name a'
	);
	const thumbMeta = document.querySelector('meta[property="og:image"]');
	if (!titleEl?.textContent?.trim()) return null;

	return {
		title:     titleEl.textContent.trim(),
		artist:    channelEl?.textContent?.trim() ?? '',
		album:     '',
		artworkUrl: thumbMeta?.getAttribute('content') ?? '',
		isPlaying,
		duration:  Math.floor(video.duration || 0),
		position:  Math.floor(video.currentTime || 0),
		source:    'youtube'
	};
}

function scrapeYouTubeMusic(isPlaying, video) {
	const titleEl  = document.querySelector('.title.ytmusic-player-bar');
	const artistEl = document.querySelector('.byline.ytmusic-player-bar');
	const thumbEl  = document.querySelector('#thumbnail.ytmusic-player-bar img');
	if (!titleEl) return null;

	return {
		title:     titleEl.textContent?.trim() ?? '',
		artist:    artistEl?.textContent?.trim() ?? '',
		album:     '',
		artworkUrl: thumbEl?.src ?? '',
		isPlaying,
		duration:  Math.floor(video.duration || 0),
		position:  Math.floor(video.currentTime || 0),
		source:    'youtube'
	};
}

// ── Capture audio (Web Audio API) ────────────────────────────────────────────

let analyser = null;
let audioData = null;
let audioCtx = null;

function initAudio() {
	const video = getVideo();
	if (!video || analyser) return;
	try {
		const stream = video.captureStream?.();
		if (!stream) return;
		audioCtx  = new AudioContext();
		analyser  = audioCtx.createAnalyser();
		analyser.fftSize = 512;              // 256 bins — bonne résolution fréquentielle
		analyser.smoothingTimeConstant = 0.75;
		const src = audioCtx.createMediaStreamSource(stream);
		src.connect(analyser);
		audioData = new Uint8Array(analyser.frequencyBinCount);
		console.log('[OBS Bridge] Audio capture OK');
	} catch (e) {
		console.warn('[OBS Bridge] Audio capture failed:', e.message);
	}
}

function getAudioBands() {
	if (!analyser || !audioData) return null;
	analyser.getByteFrequencyData(audioData);

	// Mapping logarithmique → 64 bandes (comme l'oreille humaine)
	// Les graves occupent plus de barres, les aigus moins
	const N      = audioData.length; // 256
	const BANDS  = 64;
	const result = new Array(BANDS);
	for (let i = 0; i < BANDS; i++) {
		// Position log dans les bins : 0..N-1
		const pos = (Math.pow(N, (i + 1) / BANDS) - 1);
		const lo  = Math.floor(pos);
		const hi  = Math.min(Math.ceil(pos), N - 1);
		const fr  = pos - lo;
		const val = (audioData[lo] * (1 - fr) + audioData[hi] * fr) / 255;
		result[i] = val;
	}
	return result;
}

// ── Envoi au background ───────────────────────────────────────────────────────

setInterval(() => {
	const track = getTrackInfo();
	if (!track?.title) return;

	if (!analyser) initAudio();
	const audioBands = getAudioBands();

	browser.runtime.sendMessage({
		type: 'track_update',
		payload: { ...track, audioBands }
	});
}, POLL_MS);
