import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadConfig, saveConfig, deleteConfig, hasSpotifyCredentials } from '$lib/server/config';

export const GET: RequestHandler = async () => {
	const cfg = await loadConfig();
	return json({
		hasCredentials: await hasSpotifyCredentials(),
		clientId: cfg.spotifyClientId || ''
	});
};

export const POST: RequestHandler = async ({ request, url }) => {
	const body = await request.json();
	const { spotifyClientId, spotifyClientSecret } = body;

	if (!spotifyClientId?.trim() || !spotifyClientSecret?.trim()) {
		return json({ error: 'Client ID et Secret requis' }, { status: 400 });
	}

	const redirectUri = `${url.origin}/api/spotify/callback`;

	await saveConfig({
		spotifyClientId:     spotifyClientId.trim(),
		spotifyClientSecret: spotifyClientSecret.trim(),
		spotifyRedirectUri:  redirectUri
	});

	return json({ ok: true, redirectUri });
};

export const DELETE: RequestHandler = async () => {
	await deleteConfig();
	return json({ ok: true });
};
