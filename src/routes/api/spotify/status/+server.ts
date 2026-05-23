import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadTokens, deleteTokens } from '$lib/server/tokens';

export const GET: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key') ?? '';
	const tokens = await loadTokens(key);
	if (!tokens) return json({ connected: false });
	const expired = Date.now() >= tokens.expiresAt - 60_000;
	return json({ connected: true, expired });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key') ?? '';
	await deleteTokens(key);
	return json({ disconnected: true });
};
