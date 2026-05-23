import { kvGet, kvSet, kvDel } from './kv';

export interface AppConfig {
	spotifyClientId?: string;
	spotifyClientSecret?: string;
	spotifyRedirectUri?: string;
}

function configKey(key: string): string {
	return key ? `${key}:app:config` : 'app:config';
}

export async function loadConfig(key = ''): Promise<AppConfig> {
	return (await kvGet<AppConfig>(configKey(key))) ?? {};
}

export async function saveConfig(patch: AppConfig, key = ''): Promise<void> {
	const existing = await loadConfig(key);
	await kvSet(configKey(key), { ...existing, ...patch });
}

export async function deleteConfig(key = ''): Promise<void> {
	await kvDel(configKey(key));
}

export async function getSpotifyCredentials(key = ''): Promise<{ clientId: string; clientSecret: string; redirectUri: string }> {
	const cfg = await loadConfig(key);
	return {
		clientId:     cfg.spotifyClientId     ?? '',
		clientSecret: cfg.spotifyClientSecret ?? '',
		redirectUri:  cfg.spotifyRedirectUri  ?? ''
	};
}

export async function hasSpotifyCredentials(key = ''): Promise<boolean> {
	const { clientId, clientSecret } = await getSpotifyCredentials(key);
	return !!(clientId && clientSecret);
}
