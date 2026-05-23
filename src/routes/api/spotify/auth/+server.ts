import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAuthUrl } from '$lib/spotify/spotifyApi';
import { getSpotifyCredentials, hasSpotifyCredentials } from '$lib/server/config';

export const GET: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key') ?? '';
	if (!(await hasSpotifyCredentials(key))) {
		throw error(400, 'Spotify non configuré — renseignez vos clés dans les paramètres.');
	}
	const { clientId, redirectUri } = await getSpotifyCredentials(key);
	throw redirect(302, buildAuthUrl(clientId, redirectUri, key));
};
