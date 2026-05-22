export interface Beat {
	start: number;
	duration: number;
	confidence: number;
}

export interface AudioSegment {
	start: number;
	duration: number;
	loudnessStart: number;   // dB (négatif, 0 = max)
	loudnessMax: number;     // dB
	loudnessMaxTime: number; // secondes dans le segment
	pitches: number[];       // 12 valeurs 0-1 (C, C#, D, ...)
	timbre: number[];        // 12 coefficients spectraux
}

export interface TrackInfo {
	title: string;
	artist: string;
	album: string;
	artworkUrl: string;
	duration: number;
	position: number;
	isPlaying: boolean;
	source: 'spotify' | 'youtube' | 'none';
	audioBands?: number[];       // YouTube : 32 valeurs 0-1
	beats?: Beat[];              // Spotify : timestamps des beats
	segments?: AudioSegment[];   // Spotify : analyse mélodique détaillée
	tempo?: number;              // BPM
	energy?: number;             // 0-1
}

export interface SpotifyTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;      // timestamp ms
}

export interface OverlaySettings {
	theme: 'dark-spotify' | 'neon-purple' | 'glassmorphism';
	primaryColor: string;
	widgetSize: 'small' | 'medium' | 'large';
	showDuration: boolean;
	showArtist: boolean;
	showProgressBar: boolean;
	discSpeed: 'slow' | 'medium' | 'fast';
	borderRadius: number;
	backgroundOpacity: number;
	showVisualizer: boolean;
	showGlow: boolean;
	dynamicBackground: boolean;
}

export interface WebSocketMessage {
	type: 'track_update' | 'playback_state' | 'error' | 'ping' | 'pong' | 'auth_required' | 'auth_ok';
	payload?: TrackInfo | { isPlaying: boolean } | { message: string };
}

export const DEFAULT_TRACK: TrackInfo = {
	title: 'No track playing',
	artist: '',
	album: '',
	artworkUrl: '',
	duration: 0,
	position: 0,
	isPlaying: false,
	source: 'none'
};

export const DEFAULT_SETTINGS: OverlaySettings = {
	theme: 'dark-spotify',
	primaryColor: '#1DB954',
	widgetSize: 'medium',
	showDuration: true,
	showArtist: true,
	showProgressBar: true,
	discSpeed: 'slow',
	borderRadius: 16,
	backgroundOpacity: 0.95,
	showVisualizer: false,
	showGlow: true,
	dynamicBackground: false
};
