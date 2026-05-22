<script lang="ts">
	import { onMount } from 'svelte';

	export let text: string = '';
	export let className: string = '';
	export let speed: number = 80;

	let container: HTMLDivElement;
	let measurer: HTMLSpanElement;
	let needsMarquee = false;
	let duration = 10;
	let rafId = 0;

	function measure() {
		if (!container || !measurer) return;
		const cw = container.clientWidth;
		const tw = measurer.scrollWidth;
		if (cw === 0) {
			// Layout pas encore prêt, retry au prochain frame
			rafId = requestAnimationFrame(measure);
			return;
		}
		needsMarquee = tw > cw + 1;
		if (needsMarquee) {
			duration = (tw + 64) / speed;
		}
	}

	function scheduleMeasure() {
		if (typeof window === 'undefined') return;
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(measure);
	}

	onMount(() => {
		scheduleMeasure();
		const ro = new ResizeObserver(scheduleMeasure);
		ro.observe(container);
		return () => {
			ro.disconnect();
			cancelAnimationFrame(rafId);
		};
	});

	$: text, scheduleMeasure();
</script>

<div bind:this={container} class="relative overflow-hidden whitespace-nowrap {className}">
	<!-- Mesure invisible — toujours présent pour détecter le dépassement -->
	<span
		bind:this={measurer}
		class="absolute top-0 left-0 invisible pointer-events-none whitespace-nowrap"
		aria-hidden="true"
	>{text}</span>

	{#if needsMarquee}
		<div
			class="marquee-inner inline-flex"
			style="--marquee-dur: {duration}s"
		>
			<span class="pr-16">{text}</span>
			<span class="pr-16" aria-hidden="true">{text}</span>
		</div>
	{:else}
		<span>{text}</span>
	{/if}
</div>

<style>
	.marquee-inner {
		animation: marquee-scroll var(--marquee-dur, 10s) linear infinite;
		animation-delay: 2s;
	}

	/* :global pour que Svelte 5 ne renomme pas les keyframes */
	:global {
		@keyframes marquee-scroll {
			from { transform: translateX(0); }
			to   { transform: translateX(-50%); }
		}
	}
</style>
