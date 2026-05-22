import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCode } from '$lib/spotify/spotifyApi';
import { getSpotifyCredentials } from '$lib/server/config';
import { saveTokens } from '$lib/server/tokens';

export const GET: RequestHandler = async ({ url }) => {
	const code       = url.searchParams.get('code');
	const errorParam = url.searchParams.get('error');

	if (errorParam) throw error(400, `Spotify auth refusé : ${errorParam}`);
	if (!code)      throw error(400, 'Code manquant');

	const { clientId, clientSecret, redirectUri } = await getSpotifyCredentials();
	if (!clientId || !clientSecret) throw error(400, 'Spotify non configuré');

	try {
		const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri);
		await saveTokens(tokens);
		throw redirect(302, '/settings?spotify=connected');
	} catch (err) {
		if ((err as { status?: number }).status) throw err;
		throw error(500, `Échange de token échoué : ${(err as Error).message}`);
	}
};
