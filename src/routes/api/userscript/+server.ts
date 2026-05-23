import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;
	const host   = new URL(origin).hostname;

	const script = `// ==UserScript==
// @name         OBS Music Overlay — YouTube
// @namespace    obs-music-overlay
// @version      2.3
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

function showKeyDialog() {
  const existing = document.getElementById('__obs_key_dialog');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = '__obs_key_dialog';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif';

  const box = document.createElement('div');
  box.style.cssText = 'background:#1e1e1e;color:#fff;padding:24px;border-radius:12px;width:360px;box-shadow:0 8px 32px rgba(0,0,0,.5)';

  const label = document.createElement('p');
  label.style.cssText = 'margin:0 0 8px;font-size:14px';
  label.textContent = 'Clé OBS (visible dans l\\'URL de /settings)';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = getKey();
  input.placeholder = 'ex: bp7sm70csw';
  input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 10px;font-size:14px;border-radius:6px;border:1px solid #555;background:#2a2a2a;color:#fff;margin-bottom:14px;outline:none';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Annuler';
  btnCancel.style.cssText = 'padding:7px 16px;border-radius:6px;border:1px solid #555;background:transparent;color:#ccc;cursor:pointer;font-size:13px';

  const btnSave = document.createElement('button');
  btnSave.textContent = 'Sauvegarder';
  btnSave.style.cssText = 'padding:7px 16px;border-radius:6px;border:none;background:#f00;color:#fff;cursor:pointer;font-size:13px';

  btnCancel.onclick = () => overlay.remove();
  btnSave.onclick = () => {
    const k = input.value.trim();
    if (k) { GM_setValue('obs_key', k); }
    overlay.remove();
  };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  btnRow.append(btnCancel, btnSave);
  box.append(label, input, btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  input.focus();
  input.select();
}

GM_registerMenuCommand('⚙️ Définir ma clé OBS', showKeyDialog);

let lastSent = null;
let lastSentTime = 0;

function send(track) {
  const url = buildUrl();
  if (!getKey()) return; // ne rien envoyer tant que la clé n'est pas configurée
  lastSentTime = Date.now();
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

    // Force resend every 8s to keep KV key alive (TTL = 10s)
    const stale = Date.now() - lastSentTime > 8000;

    if (changed || stale) { lastSent = track; send(track); }
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
