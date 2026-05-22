import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { kvSet } from '$lib/server/kv';
import type { TrackInfo } from '$lib/types/music';

export const POST: RequestHandler = async ({ request }) => {
	const track: TrackInfo = await request.json();
	// 10s TTL — expires if extension stops sending
	await kvSet('youtube:track', { ...track, source: 'youtube' } satisfies TrackInfo, 10);
	return json({ ok: true });
};
