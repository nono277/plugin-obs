import { musicStore } from '$lib/stores/musicStore';
import type { TrackInfo } from '$lib/types/music';

const POLL_INTERVAL = 3000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let destroyed = false;

export function connectWebSocket(): void {
	if (typeof window === 'undefined') return;
	destroyed = false;
	_poll();
	pollTimer = setInterval(_poll, POLL_INTERVAL);
}

export function disconnectWebSocket(): void {
	destroyed = true;
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

async function _poll(): Promise<void> {
	if (destroyed) return;
	try {
		const res = await fetch('/api/track');
		if (!res.ok) return;
		const track: TrackInfo | null = await res.json();
		if (track) {
			musicStore.setTrack(track);
		} else {
			musicStore.reset();
		}
	} catch {
		// retry on next interval
	}
}
