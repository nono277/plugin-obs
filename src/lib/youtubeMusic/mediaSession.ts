import type { TrackInfo } from '$lib/types/music';

/**
 * Polls navigator.mediaSession for YouTube Music data.
 * Works when YouTube Music is open in the same browser profile.
 * Falls back to the Chrome extension if mediaSession is empty.
 */
export function pollMediaSession(
	onUpdate: (track: TrackInfo) => void,
	interval = 1000
): () => void {
	if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
		return () => {};
	}

	let lastTitle = '';

	const timer = setInterval(() => {
		const session = navigator.mediaSession;
		const meta = session.metadata;
		if (!meta) return;

		const title = meta.title ?? '';
		const artist = meta.artist ?? '';
		const artwork = meta.artwork?.[0]?.src ?? '';

		// Only emit when something changed
		if (title !== lastTitle) {
			lastTitle = title;
			const track: TrackInfo = {
				title,
				artist,
				album: meta.album ?? '',
				artworkUrl: artwork,
				duration: 0,   // mediaSession doesn't expose duration directly
				position: 0,
				isPlaying: session.playbackState === 'playing',
				source: 'youtube'
			};
			onUpdate(track);
		}
	}, interval);

	return () => clearInterval(timer);
}
