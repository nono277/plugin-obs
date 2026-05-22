<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import VinylDisc from './VinylDisc.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import AudioVisualizer from './AudioVisualizer.svelte';
	import MarqueeText from './MarqueeText.svelte';
	import { musicStore, settingsStore } from '$lib/stores/musicStore';
	import { connectWebSocket, disconnectWebSocket } from '$lib/websocket/wsClient';
	import type { TrackInfo } from '$lib/types/music';

	// Computed size classes
	// Tailles calibrées pour un rendu natif 3840×2160 → affiché en 1080p (÷2)
	const sizeMap = {
		small:  { widget: 'widget-small',  discEm: 180, title: 'text-5xl',  artist: 'text-3xl' },
		medium: { widget: 'widget-medium', discEm: 240, title: 'text-6xl',  artist: 'text-4xl' },
		large:  { widget: 'widget-large',  discEm: 300, title: 'text-7xl',  artist: 'text-5xl' }
	};

	// Theme styles
	const themeStyles: Record<string, string> = {
		'dark-spotify':  'bg-[#121212] border border-white/5',
		'neon-purple':   'bg-[#0a0010] border border-purple-500/30',
		'glassmorphism': 'backdrop-blur-xl bg-white/5 border border-white/10'
	};

	// Glow du rectangle — couleur dynamique selon la source
	function getGlow(theme: string, color: string): string {
		if (theme === 'neon-purple')   return '0 0 40px rgba(155,89,182,0.4), 0 0 80px rgba(155,89,182,0.15)';
		if (theme === 'glassmorphism') return '0 8px 32px rgba(0,0,0,0.4)';
		return `0 0 40px ${color}33, 0 0 80px ${color}1A`;
	}

	$: settings = $settingsStore;
	$: track = $musicStore;
	$: size = sizeMap[settings.widgetSize];
	$: themeClass = themeStyles[settings.theme] ?? themeStyles['dark-spotify'];
	$: glowStyle = settings.showGlow ? `box-shadow: ${getGlow(settings.theme, accentColor)}; transition: box-shadow 0.6s ease;` : '';
	$: borderRadiusStyle = `border-radius: ${settings.borderRadius}px;`;

	// Couleur dynamique selon la source
	$: accentColor = track.source === 'youtube' ? '#FF0000' : '#1DB954';

	// Local position ticker
	let tickerInterval: ReturnType<typeof setInterval>;
	let localPosition = 0;

	$: {
		localPosition = track.position;
	}

	// Fondu après 7s de pause
	const HIDE_DELAY = 7000;
	let visible = true;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	$: {
		if (track.isPlaying) {
			// Reprend → annuler le timer et réafficher
			if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
			visible = true;
		} else if (track.source !== 'none') {
			// Pause → lancer le timer si pas déjà en cours
			if (!hideTimer) {
				hideTimer = setTimeout(() => {
					visible = false;
					hideTimer = null;
				}, HIDE_DELAY);
			}
		}
	}

	onMount(() => {
		connectWebSocket();
		tickerInterval = setInterval(() => {
			if ($musicStore.isPlaying && localPosition < $musicStore.duration) {
				localPosition = Math.min(localPosition + 1, $musicStore.duration);
			}
		}, 1000);
	});

	onDestroy(() => {
		disconnectWebSocket();
		clearInterval(tickerInterval);
		if (hideTimer) clearTimeout(hideTimer);
	});

	// Track transition key — changes when title/artist changes
	$: trackKey = `${track.title}::${track.artist}`;

	// Source badge
	const sourceLabel: Record<TrackInfo['source'], string> = {
		spotify: 'SPOTIFY',
		youtube: 'YT MUSIC',
		none: ''
	};
	const sourceColor: Record<TrackInfo['source'], string> = {
		spotify: '#1DB954',
		youtube: '#FF0000',
		none: 'transparent'
	};
</script>

<!-- Only render when there's something playing (or always in settings preview) -->
{#if track.source !== 'none' || $$props.preview}
	<div
		class="music-widget relative flex items-center overflow-hidden {size.widget} {themeClass}"
		class:widget-hidden={!visible}
		class:widget-visible={visible}
		style="{borderRadiusStyle} {glowStyle}"
	>
		<!-- Dynamic blurred background — toujours présent si artwork, atténué en pause -->
		{#if settings.dynamicBackground && track.artworkUrl}
			<div
				class="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-500"
				style="border-radius: {settings.borderRadius}px; opacity: {track.isPlaying ? 1 : 0.5};"
				aria-hidden="true"
			>
				<img
					src={track.artworkUrl}
					alt=""
					class="absolute inset-0 w-full h-full object-cover scale-150 blur-2xl opacity-20"
					crossorigin="anonymous"
				/>
				<div class="absolute inset-0 bg-black/50"></div>
			</div>
		{/if}

		<!-- Vinyl disc + anneaux audio -->
		<div class="relative z-10 flex-shrink-0" style="width:{size.discEm}px; height:{size.discEm}px;">
			<VinylDisc
				artworkUrl={track.artworkUrl}
				isPlaying={track.isPlaying}
				speed={settings.discSpeed}
				size={size.discEm}
				glowColor={accentColor}
			/>
		</div>

		<!-- Track info -->
		<div class="relative z-10 flex flex-col flex-1 min-w-0 gap-1.5">
			<!-- Source badge + visualizer -->
			<div class="flex items-center justify-between mb-0.5">
				{#if track.source !== 'none'}
					<span
						class="text-[28px] font-bold tracking-widest px-3 py-1 rounded"
						style="color: {sourceColor[track.source]}; background: {sourceColor[track.source]}18;"
					>
						{sourceLabel[track.source]}
					</span>
				{/if}

				{#if settings.showVisualizer}
					<AudioVisualizer
						isPlaying={track.isPlaying}
						primaryColor={accentColor}
					/>
				{/if}
			</div>

			<!-- Title & artist — animated on track change -->
			{#key trackKey}
				<div in:fly={{ y: 8, duration: 300 }} class="min-w-0">
					<MarqueeText
						text={track.title || 'No track playing'}
						className="font-bold text-white leading-tight {size.title}"
						speed={80}
					/>

					{#if settings.showArtist && track.artist}
						<MarqueeText
							text={track.artist}
							className="text-white/60 leading-tight mt-0.5 {size.artist}"
							speed={80}
						/>
					{/if}
				</div>
			{/key}

			<!-- Progress bar -->
			{#if settings.showProgressBar}
				<div class="mt-1.5">
					<ProgressBar
						position={localPosition}
						duration={track.duration}
						primaryColor={accentColor}
						showTime={settings.showDuration}
					/>
				</div>
			{/if}

			<!-- Indicateur pause discret — hauteur fixe pour éviter le décalage -->
			<div class="flex items-center gap-3 mt-1" style="height: 32px;">
				{#if !track.isPlaying && track.source !== 'none'}
					<div class="w-4 h-4 rounded-full bg-white/25 animate-pulse"></div>
					<span class="text-[26px] text-white/30 font-medium">Pause</span>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Tailles fixes 4K (3840×2160) */
	.widget-small  { width:  760px; padding: 32px; gap: 28px; }
	.widget-medium { width:  960px; padding: 40px; gap: 36px; }
	.widget-large  { width: 1160px; padding: 48px; gap: 44px; }

	/* Apparition : zoom depuis 0.8 jusqu'à 1 */
	.widget-visible {
		animation: zoomIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}

	/* Disparition : zoom avant puis dezoom jusqu'à 0 */
	.widget-hidden {
		animation: zoomOut 0.8s ease-in-out forwards;
	}

	@keyframes zoomIn {
		from { opacity: 0; transform: scale(0.8); }
		to   { opacity: 1; transform: scale(1);   }
	}

	@keyframes zoomOut {
		0%   { opacity: 1; transform: scale(1);    }
		40%  { opacity: 1; transform: scale(1.08); }
		100% { opacity: 0; transform: scale(0.75); }
	}
</style>
