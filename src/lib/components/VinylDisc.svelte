<script lang="ts">
	export let artworkUrl: string = '';
	export let isPlaying: boolean = false;
	export let speed: 'slow' | 'medium' | 'fast' = 'slow';
	export let size: number = 120; // px
	export let glowColor: string = '#1DB954';

	const speedMap = { slow: '8s', medium: '5s', fast: '3s' };
	$: duration = speedMap[speed];
	$: s = `${size}px`;
</script>

<div class="vinyl-container relative flex-shrink-0" style="width:{s}; height:{s};">

	<div
		class="vinyl-disc absolute inset-0 rounded-full"
		class:paused={!isPlaying}
		style="animation-duration:{duration};"
	>
		{#if artworkUrl}
			<img
				src={artworkUrl}
				alt="Album art"
				class="absolute inset-0 w-full h-full object-cover rounded-full"
				crossorigin="anonymous"
			/>
		{:else}
			<div class="absolute inset-0 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
				<svg viewBox="0 0 24 24" fill="currentColor" style="width:30%;height:30%;" class="text-gray-500">
					<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
				</svg>
			</div>
		{/if}

		<div class="absolute inset-0 rounded-full vinyl-grooves pointer-events-none"></div>

		<!-- Trou central -->
		<div
			class="absolute rounded-full bg-gray-900 border-2 border-gray-700 z-10"
			style="width:12%; height:12%; top:50%; left:50%; transform:translate(-50%,-50%);"
		></div>
	</div>

	<!-- Bordure fixe -->
	<div
		class="absolute inset-0 rounded-full pointer-events-none"
		style="box-shadow: 0 0 0 0.18em rgba(255,255,255,0.15), 0 0 0 0.22em rgba(0,0,0,0.4);"
	></div>

	<!-- Glow -->
	<div
		class="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500"
		style="
			opacity: {isPlaying ? 1 : 0.3};
			box-shadow: 0 0 {size * 0.25}px {glowColor}4D,
			            0 0 {size * 0.1}px  {glowColor}33;
			transition: box-shadow 0.6s ease;
		"
	></div>
</div>

<style>
	.vinyl-disc {
		box-shadow: 0 0.2em 1.2em rgba(0,0,0,0.6);
		animation: spin linear infinite;
		overflow: hidden;
	}
	.vinyl-disc.paused { animation-play-state: paused; }

	.vinyl-grooves {
		background: repeating-radial-gradient(
			circle at center,
			transparent 0%, transparent 45%,
			rgba(0,0,0,0.15) 45.5%, rgba(0,0,0,0.15) 46.5%,
			transparent 47%, transparent 52%,
			rgba(0,0,0,0.1) 52.5%, rgba(0,0,0,0.1) 53.5%,
			transparent 54%
		);
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to   { transform: rotate(360deg); }
	}
</style>
