import { kvGet, kvSet, kvDel } from './kv';
import type { SpotifyTokens } from '$lib/types/music';

function tokenKey(key: string): string {
	return key ? `${key}:spotify:tokens` : 'spotify:tokens';
}

export async function saveTokens(tokens: SpotifyTokens, key = ''): Promise<void> {
	await kvSet(tokenKey(key), tokens);
}

export async function loadTokens(key = ''): Promise<SpotifyTokens | null> {
	return kvGet<SpotifyTokens>(tokenKey(key));
}

export async function deleteTokens(key = ''): Promise<void> {
	await kvDel(tokenKey(key));
}
