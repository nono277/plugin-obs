import { kvGet, kvSet, kvDel } from './kv';

export interface AppConfig {
	spotifyClientId?: string;
	spotifyClientSecret?: string;
	spotifyRedirectUri?: string;
}

const CONFIG_KEY = 'app:config';

export async function loadConfig(): Promise<AppConfig> {
	return (await kvGet<AppConfig>(CONFIG_KEY)) ?? {};
}

export async function saveConfig(patch: AppConfig): Promise<void> {
	const existing = await loadConfig();
	await kvSet(CONFIG_KEY, { ...existing, ...patch });
}

export async function deleteConfig(): Promise<void> {
	await kvDel(CONFIG_KEY);
}

export async function getSpotifyCredentials(): Promise<{ clientId: string; clientSecret: string; redirectUri: string }> {
	const cfg = await loadConfig();
	return {
		clientId:     cfg.spotifyClientId     || process.env.SPOTIFY_CLIENT_ID     || '',
		clientSecret: cfg.spotifyClientSecret || process.env.SPOTIFY_CLIENT_SECRET || '',
		redirectUri:  cfg.spotifyRedirectUri  || process.env.SPOTIFY_REDIRECT_URI  || ''
	};
}

export async function hasSpotifyCredentials(): Promise<boolean> {
	const { clientId, clientSecret } = await getSpotifyCredentials();
	return !!(clientId && clientSecret);
}
