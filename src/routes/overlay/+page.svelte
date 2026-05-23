<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import MusicWidget from '$lib/components/MusicWidget.svelte';
	import { setKey } from '$lib/websocket/wsClient';
	import { settingsStore } from '$lib/stores/musicStore';

	// Set key before MusicWidget mounts and calls connectWebSocket
	const _overlayKey = typeof window !== 'undefined'
		? new URLSearchParams(window.location.search).get('key') ?? ''
		: '';
	setKey(_overlayKey);

	async function syncSettings() {
		if (!_overlayKey) return;
		try {
			const res = await fetch(`/api/settings?key=${encodeURIComponent(_overlayKey)}`);
			if (!res.ok) return;
			const s = await res.json();
			if (s) settingsStore.update(s);
		} catch { /* ignore */ }
	}

	let _settingsTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		syncSettings();
		_settingsTimer = setInterval(syncSettings, 5000);
	});

	onDestroy(() => {
		if (_settingsTimer) clearInterval(_settingsTimer);
	});
</script>

<svelte:head>
	<title>OBS Music Overlay</title>
</svelte:head>

<div class="canvas">
	<div class="widget-slot">
		<MusicWidget />
	</div>
</div>

<style>
	:global(*, *::before, *::after) { box-sizing: border-box; }

	:global(html, body) {
		margin: 0;
		padding: 0;
		background: transparent !important;
		overflow: hidden;
		/* Taille fixe 1920×1080 — OBS réduit, jamais d'agrandissement flou */
		width: 3840px;
		height: 2160px;
	}

	.canvas {
		width: 3840px;
		height: 2160px;
		position: relative;
	}

	/* Widget positionné en bas à gauche */
	.widget-slot {
		position: absolute;
		bottom: 80px;
		left: 80px;
	}
</style>
