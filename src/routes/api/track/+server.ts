import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadTokens, saveTokens } from '$lib/server/tokens';
import { kvGet } from '$lib/server/kv';
import { getCurrentTrack, refreshAccessToken, isTokenExpired } from '$lib/spotify/spotifyApi';
import { getSpotifyCredentials, hasSpotifyCredentials } from '$lib/server/config';
import type { TrackInfo } from '$lib/types/music';

export const GET: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key') ?? '';

	// Spotify takes priority if connected
	if (await hasSpotifyCredentials(key)) {
		try {
			let tokens = await loadTokens(key);
			if (tokens) {
				if (isTokenExpired(tokens)) {
					const { clientId, clientSecret } = await getSpotifyCredentials(key);
					tokens = await refreshAccessToken(tokens.refreshToken, clientId, clientSecret);
					await saveTokens(tokens, key);
				}
				const track = await getCurrentTrack(tokens.accessToken);
				if (track) return json(track);
			}
		} catch {
			// fall through to YouTube
		}
	}

	// YouTube fallback (short TTL — set by extension)
	const ytKey = key ? `${key}:youtube:track` : 'youtube:track';
	const yt = await kvGet<TrackInfo>(ytKey);
	if (yt) return json(yt);

	return json(null);
};
