import type { Handle } from '@sveltejs/kit';

// CORS headers for OBS Browser Source (Chromium-based, same origin)
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => name.startsWith('x-')
	});

	// Allow OBS Browser Source to load the overlay
	response.headers.set('Access-Control-Allow-Origin', '*');
	return response;
};
