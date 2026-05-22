import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		host: true,
		allowedHosts: ['easel-earthy-untwist.ngrok-free.dev']
	}
});
