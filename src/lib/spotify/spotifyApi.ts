import type { TrackInfo, SpotifyTokens } from '$lib/types/music';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export function buildAuthUrl(clientId: string, redirectUri: string): string {
	const scopes = [
		'user-read-currently-playing',
		'user-read-playback-state',
		'user-read-playback-position'
	].join(' ');

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		scope: scopes,
		redirect_uri: redirectUri,
		show_dialog: 'false'
	});

	return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string
): Promise<SpotifyTokens> {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});

	if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
	const data = await res.json();

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000
	};
}

export async function refreshAccessToken(
	refreshToken: string,
	clientId: string,
	clientSecret: string
): Promise<SpotifyTokens> {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		})
	});

	if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
	const data = await res.json();

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? refreshToken,
		expiresAt: Date.now() + data.expires_in * 1000
	};
}

export async function getCurrentTrack(accessToken: string): Promise<TrackInfo | null> {
	const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	// 204 = nothing playing
	if (res.status === 204) return null;
	if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);

	const data = await res.json();
	if (!data || !data.item) return null;

	const item = data.item;
	const artists = item.artists?.map((a: { name: string }) => a.name).join(', ') ?? 'Unknown';
	const artwork = item.album?.images?.[0]?.url ?? '';

	return {
		title: item.name ?? 'Unknown',
		artist: artists,
		album: item.album?.name ?? '',
		artworkUrl: artwork,
		duration: Math.floor((item.duration_ms ?? 0) / 1000),
		position: Math.floor((data.progress_ms ?? 0) / 1000),
		isPlaying: data.is_playing ?? false,
		source: 'spotify'
	};
}

export function isTokenExpired(tokens: SpotifyTokens): boolean {
	return Date.now() >= tokens.expiresAt - 60_000; // 60s buffer
}
