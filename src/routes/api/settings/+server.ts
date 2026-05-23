import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { kvGet, kvSet } from '$lib/server/kv';
import type { OverlaySettings } from '$lib/types/music';

function settingsKey(key: string): string {
	return key ? `${key}:overlay:settings` : 'overlay:settings';
}

export const GET: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key') ?? '';
	const settings = await kvGet<OverlaySettings>(settingsKey(key));
	return json(settings ?? null);
};

export const POST: RequestHandler = async ({ request, url }) => {
	const key = url.searchParams.get('key') ?? '';
	const settings: OverlaySettings = await request.json();
	await kvSet(settingsKey(key), settings);
	return json({ ok: true });
};
