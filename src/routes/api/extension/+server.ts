import type { RequestHandler } from './$types';
import { zipSync, strToU8 } from 'fflate';

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;

	const manifest = JSON.stringify({
		manifest_version: 2,
		name: 'OBS Music Overlay — YouTube Music',
		version: '1.0.0',
		description: "Envoie les données de lecture YouTube Music à votre overlay OBS en temps réel.",
		permissions: ['<all_urls>'],
		background: {
			scripts: ['background.js']
		},
		content_scripts: [{
			matches: ['*://music.youtube.com/*'],
			js: ['content.js'],
			run_at: 'document_idle'
		}],
		browser_specific_settings: {
			gecko: {
				id: 'obs-music-overlay@overlay',
				strict_min_version: '57.0'
			}
		}
	}, null, 2);

	// Le background script reçoit les données du content script et fait le XHR.
	// Les background scripts Firefox bénéficient des host permissions et bypass le CORS,
	// contrairement aux content scripts.
	const backgroundJs = `'use strict';

const API_URL = '${origin}/api/youtube/update';

browser.runtime.onMessage.addListener((track) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', API_URL, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify(track));
});
`;

	const contentJs = `'use strict';

let lastSent = null;

function send(track) {
  browser.runtime.sendMessage(track);
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
		'manifest.json':  strToU8(manifest),
		'background.js':  strToU8(backgroundJs),
		'content.js':     strToU8(contentJs)
	});

	return new Response(zipped, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': 'attachment; filename="obs-youtube-extension.zip"'
		}
	});
};
