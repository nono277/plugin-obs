import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAuthUrl } from '$lib/spotify/spotifyApi';
import { getSpotifyCredentials, hasSpotifyCredentials } from '$lib/server/config';

export const GET: RequestHandler = async () => {
	if (!(await hasSpotifyCredentials())) {
		throw error(400, 'Spotify non configuré — renseignez vos clés dans les paramètres.');
	}
	const { clientId, redirectUri } = await getSpotifyCredentials();
	throw redirect(302, buildAuthUrl(clientId, redirectUri));
};
