<script lang="ts">
	export let isPlaying: boolean = false;
	export let primaryColor: string = '#1DB954';
	export let barCount: number = 5;

	const delays = Array.from({ length: barCount }, (_, i) => `${(i * 0.12).toFixed(2)}s`);
	const heights = [0.4, 0.8, 0.55, 0.9, 0.45];
</script>

<div class="flex items-end gap-[3px] h-4" aria-hidden="true">
	{#each delays as delay, i}
		<div
			class="visualizer-bar rounded-sm"
			class:playing={isPlaying}
			style="
				background-color: {primaryColor};
				animation-delay: {delay};
				--max-height: {heights[i % heights.length]};
				width: 3px;
				height: {isPlaying ? 100 : 30}%;
			"
		></div>
	{/each}
</div>

<style>
	.visualizer-bar {
		transition: height 0.3s ease;
		transform-origin: bottom;
	}

	.visualizer-bar.playing {
		animation: barDance 0.6s ease-in-out infinite alternate;
	}

	@keyframes barDance {
		from {
			transform: scaleY(0.25);
			opacity: 0.6;
		}
		to {
			transform: scaleY(1);
			opacity: 1;
		}
	}
</style>
