import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { kvSet } from '$lib/server/kv';
import type { TrackInfo } from '$lib/types/music';

export const POST: RequestHandler = async ({ request, url }) => {
	const key = url.searchParams.get('key') ?? '';
	const track: TrackInfo = await request.json();
	const ytKey = key ? `${key}:youtube:track` : 'youtube:track';
	// 10s TTL — expires if extension stops sending
	await kvSet(ytKey, { ...track, source: 'youtube' } satisfies TrackInfo, 10);
	return json({ ok: true });
};
