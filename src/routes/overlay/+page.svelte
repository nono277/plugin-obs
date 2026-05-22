<script lang="ts">
	import MusicWidget from '$lib/components/MusicWidget.svelte';
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
