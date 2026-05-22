<script lang="ts">
	import { formatTime } from '$lib/stores/musicStore';

	export let position: number = 0;
	export let duration: number = 0;
	export let primaryColor: string = '#1DB954';
	export let showTime: boolean = true;

	$: percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
	$: currentTime = formatTime(position);
	$: totalTime = formatTime(duration);
</script>

<div class="progress-wrapper w-full flex flex-col gap-3">
	{#if showTime}
		<div class="flex justify-between font-medium tabular-nums text-[26px]" style="color: rgba(255,255,255,0.6)">
			<span>{currentTime}</span>
			<span>{totalTime}</span>
		</div>
	{/if}

	<!-- Track -->
	<div class="progress-track relative w-full rounded-full bg-white/10" style="height: 6px;">
		<div
			class="progress-fill absolute left-0 top-0 h-full rounded-full transition-all duration-300 ease-linear"
			style="width: {percent}%; background-color: {primaryColor};"
		></div>

		<div
			class="progress-thumb absolute top-1/2 -translate-y-1/2 rounded-full shadow-md transition-all duration-300 ease-linear"
			style="width:20px; height:20px; left: calc({percent}% - 10px); background-color: {primaryColor};"
		></div>
	</div>
</div>
