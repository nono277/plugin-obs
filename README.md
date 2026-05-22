# OBS Music Overlay

Widget overlay OBS élégant affichant la musique Spotify / YouTube Music en temps réel.

## Aperçu

- Disque vinyle animé avec pochette d'album
- Titre + artiste avec défilement automatique
- Barre de progression temps réel
- 3 thèmes : Dark Spotify, Neon Purple, Glassmorphism
- Support Spotify (OAuth) + YouTube Music (Extension Chrome)
- WebSocket pour mise à jour toutes les secondes

---

## Installation rapide

### 1. Prérequis

- Node.js ≥ 18
- npm ≥ 9
- OBS Studio ≥ 28 (avec Browser Source)
- Un compte Spotify (gratuit ou Premium)

### 2. Installer les dépendances

```bash
cd "plugin obs"
npm install
```

### 3. Configurer Spotify

#### a. Créer une application Spotify

1. Allez sur https://developer.spotify.com/dashboard
2. Cliquez **Create app**
3. Nom : `OBS Music Overlay`
4. Redirect URI : `http://localhost:5173/api/spotify/callback`
5. Copiez le **Client ID** et le **Client Secret**

#### b. Remplir le fichier `.env`

```env
SPOTIFY_CLIENT_ID=votre_client_id
SPOTIFY_CLIENT_SECRET=votre_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5173/api/spotify/callback
WS_PORT=8080
```

### 4. Lancer l'application

```bash
npm run dev
```

Cela démarre simultanément :
- SvelteKit sur http://localhost:5173
- Serveur WebSocket sur ws://localhost:8080

### 5. Connecter Spotify

1. Ouvrez http://localhost:5173/settings
2. Cliquez **Connecter Spotify**
3. Autorisez l'accès dans la fenêtre Spotify

### 6. Configurer OBS

1. Dans OBS → **Sources** → `+` → **Browser**
2. URL : `http://localhost:5173/overlay`
3. Largeur : `400`, Hauteur : `150`
4. Cochez **Shutdown source when not visible**
5. Cochez **Refresh browser when scene becomes active**

> Le fond est transparent : OBS composite le widget directement sur votre stream.

---

## Extension Chrome (YouTube Music)

Pour envoyer les données de YouTube Music vers l'overlay :

### Installation

1. Ouvrez Chrome → `chrome://extensions/`
2. Activez le **Mode développeur** (en haut à droite)
3. Cliquez **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `chrome-extension/`
5. L'extension est installée

### Utilisation

- Ouvrez https://music.youtube.com
- Lancez un morceau
- L'overlay se met à jour automatiquement

---

## Pages disponibles

| URL | Description |
|-----|-------------|
| `http://localhost:5173/settings` | Interface de configuration |
| `http://localhost:5173/overlay` | Overlay OBS (transparent) |

---

## Thèmes

| Thème | Description |
|-------|-------------|
| **Dark Spotify** | Fond #121212, vert Spotify |
| **Neon Purple** | Violet électrique avec effet glow |
| **Glassmorphism** | Verre dépoli translucide |

---

## Structure du projet

```
plugin obs/
├── src/
│   ├── routes/
│   │   ├── overlay/          # Page OBS Browser Source
│   │   ├── settings/         # Interface de configuration
│   │   └── api/spotify/      # Routes OAuth Spotify
│   ├── lib/
│   │   ├── components/
│   │   │   ├── MusicWidget.svelte    # Composant principal
│   │   │   ├── VinylDisc.svelte      # Disque vinyle animé
│   │   │   ├── ProgressBar.svelte    # Barre de progression
│   │   │   ├── AudioVisualizer.svelte # Barres audio animées
│   │   │   └── MarqueeText.svelte    # Texte défilant
│   │   ├── stores/
│   │   │   └── musicStore.ts         # État Svelte global
│   │   ├── spotify/
│   │   │   └── spotifyApi.ts         # Client API Spotify
│   │   ├── websocket/
│   │   │   └── wsClient.ts           # Client WebSocket
│   │   ├── youtubeMusic/
│   │   │   └── mediaSession.ts       # Détection MediaSession
│   │   └── types/
│   │       └── music.ts              # Types TypeScript
│   └── server/
│       └── websocket.js              # Serveur WebSocket + polling Spotify
├── chrome-extension/
│   ├── manifest.json
│   ├── background.js                 # Service worker WebSocket
│   └── content.js                    # Extraction données YT Music
└── .env                              # Configuration (à remplir)
```

---

## Commandes

```bash
npm run dev      # Dev (SvelteKit + WebSocket server)
npm run build    # Build production
npm run preview  # Prévisualisation production
npm run check    # Vérification TypeScript
npm run server   # WebSocket server seul
```

---

## Dépannage

**L'overlay ne s'affiche pas dans OBS**
→ Vérifiez que `npm run dev` est lancé
→ URL exacte : `http://localhost:5173/overlay`

**Spotify ne se connecte pas**
→ Vérifiez le Redirect URI dans le dashboard Spotify
→ Doit être exactement : `http://localhost:5173/api/spotify/callback`

**YouTube Music ne fonctionne pas**
→ Vérifiez que l'extension Chrome est chargée
→ Rechargez la page music.youtube.com
→ Vérifiez que le serveur WebSocket tourne (port 8080)
