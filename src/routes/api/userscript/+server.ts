import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;
	const host   = new URL(origin).hostname;

	const script = `// ==UserScript==
// @name         OBS Music Overlay — YouTube
// @namespace    obs-music-overlay
// @version      2.0
// @description  Envoie les données de lecture YouTube à l'overlay OBS en temps réel
// @match        *://www.youtube.com/*
// @match        *://music.youtube.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      ${host}
// @run-at       document-idle
// ==/UserScript==

'use strict';

const ORIGIN = '${origin}';

function getKey() {
  return GM_getValue('obs_key', '');
}

function buildUrl() {
  const k = getKey();
  return ORIGIN + '/api/youtube/update' + (k ? '?key=' + encodeURIComponent(k) : '');
}

// Menu Tampermonkey pour définir/changer la clé sans re-télécharger le script
GM_registerMenuCommand('⚙️ Définir ma clé OBS', () => {
  const current = getKey();
  const k = prompt(
    'Entrez votre clé OBS (visible dans l\\'URL de plugin-obs.vercel.app/settings)',
    current
  );
  if (k !== null) {
    GM_setValue('obs_key', k.trim());
    alert('Clé OBS sauvegardée : ' + k.trim());
  }
});

let lastSent = null;

function send(track) {
  const url = buildUrl();
  if (!getKey()) return; // ne rien envoyer tant que la clé n'est pas configurée
  GM_xmlhttpRequest({
    method: 'POST',
    url: url,
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify(track)
  });
}

function scrape() {
  try {
    const params = new URLSearchParams(location.search);
    const videoId = params.get('v');
    if (!videoId) return;

    const rawTitle = document.title || '';
    const title = rawTitle.replace(/\\s*[-\\u2013|]\\s*YouTube(\\s+Music)?\\s*$/i, '').trim();
    if (!title || title.toLowerCase() === 'youtube') return;

    const artist = (
      document.querySelector('#channel-name yt-formatted-string')?.textContent ||
      document.querySelector('ytd-channel-name yt-formatted-string')?.textContent ||
      document.querySelector('#owner-name a')?.textContent ||
      document.querySelector('#channel-name a')?.textContent ||
      ''
    ).trim();

    const artworkUrl = 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg';
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
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

	return new Response(script, {
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Content-Disposition': 'attachment; filename="obs-youtube-overlay.user.js"'
		}
	});
};
