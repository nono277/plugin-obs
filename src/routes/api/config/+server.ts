import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadConfig, saveConfig, deleteConfig, hasSpotifyCredentials } from '$lib/server/config';
import { kvReady } from '$lib/server/kv';

export const GET: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key') ?? '';
	const cfg = await loadConfig(key);
	return json({
		hasCredentials: await hasSpotifyCredentials(key),
		clientId: cfg.spotifyClientId || '',
		kvReady: kvReady()
	});
};

export const POST: RequestHandler = async ({ request, url }) => {
	const body = await request.json();
	const { spotifyClientId, spotifyClientSecret, key: bodyKey } = body;
	const key = bodyKey ?? url.searchParams.get('key') ?? '';

	if (!spotifyClientId?.trim() || !spotifyClientSecret?.trim()) {
		return json({ error: 'Client ID et Secret requis' }, { status: 400 });
	}

	const redirectUri = `${url.origin}/api/spotify/callback`;

	await saveConfig({
		spotifyClientId:     spotifyClientId.trim(),
		spotifyClientSecret: spotifyClientSecret.trim(),
		spotifyRedirectUri:  redirectUri
	}, key);

	return json({ ok: true, redirectUri });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key') ?? '';
	await deleteConfig(key);
	return json({ ok: true });
};
