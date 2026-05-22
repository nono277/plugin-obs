import type { RequestHandler } from './$types';
import { zipSync, strToU8 } from 'fflate';

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;

	const manifest = JSON.stringify({
		manifest_version: 2,
		name: 'OBS Music Overlay — YouTube Music',
		version: '1.0.0',
		description: "Envoie les données de lecture YouTube Music à votre overlay OBS en temps réel.",
		permissions: ['https://music.youtube.com/*'],
		content_scripts: [{
			matches: ['https://music.youtube.com/*'],
			js: ['content.js'],
			run_at: 'document_idle'
		}]
	}, null, 2);

	const contentJs = `'use strict';

// URL de l'API — générée automatiquement depuis votre déploiement
const API_URL = '${origin}/api/youtube/update';

let lastSent = null;

function send(track) {
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track)
  }).catch(() => {});
}

function scrape() {
  try {
    const title = (
      document.querySelector('.ytmusic-player-bar .title')?.textContent ||
      document.querySelector('yt-formatted-string.title.ytmusic-player-bar')?.textContent ||
      ''
    ).trim();

    if (!title) return;

    const bylineEl = document.querySelector('.ytmusic-player-bar .byline');
    const artist = (bylineEl?.textContent || '').trim().split('\\u2022')[0].trim();

    const imgEl =
      document.querySelector('#song-image img') ||
      document.querySelector('.ytmusic-player-bar #thumbnail img') ||
      document.querySelector('ytmusic-player-bar img.thumbnail');
    const artworkUrl = imgEl?.src || '';

    const video = document.querySelector('video');
    const isPlaying = video ? !video.paused && !video.ended : false;
    const duration  = video ? Math.floor(video.duration  || 0) : 0;
    const position  = video ? Math.floor(video.currentTime || 0) : 0;

    const track = { title, artist, album: '', artworkUrl, duration, position, isPlaying, source: 'youtube' };

    const changed = !lastSent ||
      lastSent.title     !== title     ||
      lastSent.artist    !== artist    ||
      lastSent.isPlaying !== isPlaying ||
      Math.abs((lastSent.position || 0) - position) > 2;

    if (changed) { lastSent = track; send(track); }
  } catch (e) {
    console.warn('[OBS Overlay] Erreur :', e);
  }
}

setInterval(scrape, 1000);
`;

	const zipped = zipSync({
		'manifest.json': strToU8(manifest),
		'content.js':    strToU8(contentJs)
	});

	return new Response(zipped, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': 'attachment; filename="obs-youtube-extension.zip"'
		}
	});
};
