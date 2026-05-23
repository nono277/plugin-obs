import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Répondre immédiatement aux preflight CORS (OPTIONS)
	// SvelteKit retournerait 405 sinon, bloquant les requêtes cross-origin
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
				'Access-Control-Max-Age': '86400'
			}
		});
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => name.startsWith('x-')
	});

	response.headers.set('Access-Control-Allow-Origin', '*');
	return response;
};
