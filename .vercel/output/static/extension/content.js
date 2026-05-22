'use strict';

const WS_URL = 'ws://localhost:8080';
let ws = null;
let lastSent = null;

function connect() {
  try {
    ws = new WebSocket(WS_URL);
    ws.addEventListener('open', () => {
      console.log('[OBS Overlay] Connecté au serveur WebSocket');
    });
    ws.addEventListener('close', () => {
      ws = null;
      setTimeout(connect, 3000);
    });
    ws.addEventListener('error', () => {});
  } catch {
    setTimeout(connect, 3000);
  }
}

function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'track_update', payload }));
  }
}

function scrape() {
  try {
    // Titre — plusieurs sélecteurs pour compatibilité
    const title = (
      document.querySelector('.ytmusic-player-bar .title')?.textContent ||
      document.querySelector('yt-formatted-string.title.ytmusic-player-bar')?.textContent ||
      ''
    ).trim();

    if (!title) return;

    // Artiste (ex: "Artiste • Album")
    const bylineEl = document.querySelector('.ytmusic-player-bar .byline');
    const artist = (bylineEl?.textContent || '').trim().split('•')[0].trim();

    // Artwork
    const imgEl =
      document.querySelector('#song-image img') ||
      document.querySelector('.ytmusic-player-bar #thumbnail img') ||
      document.querySelector('ytmusic-player-bar img.thumbnail');
    const artworkUrl = imgEl?.src || '';

    // Lecteur vidéo pour position/durée/état
    const video = document.querySelector('video');
    const isPlaying = video ? !video.paused && !video.ended : false;
    const duration  = video ? Math.floor(video.duration  || 0) : 0;
    const position  = video ? Math.floor(video.currentTime || 0) : 0;

    const track = {
      title,
      artist,
      album: '',
      artworkUrl,
      duration,
      position,
      isPlaying,
      source: 'youtube'
    };

    const posChanged = Math.abs((lastSent?.position || 0) - position) > 2;
    const changed = !lastSent ||
      lastSent.title     !== title     ||
      lastSent.artist    !== artist    ||
      lastSent.isPlaying !== isPlaying ||
      posChanged;

    if (changed) {
      lastSent = track;
      send(track);
    }
  } catch (e) {
    console.warn('[OBS Overlay] Erreur scraping :', e);
  }
}

// Démarrage
connect();
setInterval(scrape, 1000);
