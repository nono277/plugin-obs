import { writable, derived } from 'svelte/store';
import type { TrackInfo, OverlaySettings } from '$lib/types/music';
import { DEFAULT_TRACK, DEFAULT_SETTINGS } from '$lib/types/music';

function createMusicStore() {
	const { subscribe, set, update } = writable<TrackInfo>(DEFAULT_TRACK);

	return {
		subscribe,
		setTrack: (track: TrackInfo) => set(track),
		updatePosition: (position: number) =>
			update((t) => ({ ...t, position })),
		setPlaying: (isPlaying: boolean) =>
			update((t) => ({ ...t, isPlaying })),
		reset: () => set(DEFAULT_TRACK)
	};
}

function createSettingsStore() {
	// Load from localStorage in browser context
	const initial: OverlaySettings =
		typeof localStorage !== 'undefined'
			? { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('obs-overlay-settings') ?? '{}') }
			: DEFAULT_SETTINGS;

	const { subscribe, set, update } = writable<OverlaySettings>(initial);

	return {
		subscribe,
		update: (partial: Partial<OverlaySettings>) =>
			update((s) => {
				const next = { ...s, ...partial };
				if (typeof localStorage !== 'undefined') {
					localStorage.setItem('obs-overlay-settings', JSON.stringify(next));
				}
				return next;
			}),
		reset: () => {
			set(DEFAULT_SETTINGS);
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem('obs-overlay-settings');
			}
		}
	};
}

export const musicStore = createMusicStore();
export const settingsStore = createSettingsStore();

// Derived: progress percentage 0-100
export const progressPercent = derived(musicStore, ($track) => {
	if ($track.duration === 0) return 0;
	return Math.min(100, ($track.position / $track.duration) * 100);
});

// Derived: formatted current time MM:SS
export const currentTimeFormatted = derived(musicStore, ($track) =>
	formatTime($track.position)
);

// Derived: formatted total duration MM:SS
export const durationFormatted = derived(musicStore, ($track) =>
	formatTime($track.duration)
);

export function formatTime(seconds: number): string {
	if (!seconds || isNaN(seconds)) return '0:00';
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}
