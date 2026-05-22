import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadTokens, deleteTokens } from '$lib/server/tokens';

export const GET: RequestHandler = async () => {
	const tokens = await loadTokens();
	if (!tokens) return json({ connected: false });
	const expired = Date.now() >= tokens.expiresAt - 60_000;
	return json({ connected: true, expired });
};

export const DELETE: RequestHandler = async () => {
	await deleteTokens();
	return json({ disconnected: true });
};
