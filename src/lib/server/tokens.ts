import { kvGet, kvSet, kvDel } from './kv';
import type { SpotifyTokens } from '$lib/types/music';

const KEY = 'spotify:tokens';

export async function saveTokens(tokens: SpotifyTokens): Promise<void> {
	await kvSet(KEY, tokens);
}

export async function loadTokens(): Promise<SpotifyTokens | null> {
	return kvGet<SpotifyTokens>(KEY);
}

export async function deleteTokens(): Promise<void> {
	await kvDel(KEY);
}
