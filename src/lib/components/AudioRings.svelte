<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Beat, AudioSegment } from '$lib/types/music';

	export let isPlaying: boolean = false;
	export let color: string = '#1DB954';
	export let size: number = 240;
	export let beats: Beat[] = [];
	export let segments: AudioSegment[] = [];
	export let tempo: number = 120;
	export let energy: number = 0.5;
	export let position: number = 0;
	export let audioBands: number[] = [];

	const BAR_COUNT = 60;
	const GAP       = 10;
	const MAX_H     = size * 0.32;
	const MIN_H     = 4;
	const DISC_R    = size / 2;
	const PADDING   = MAX_H + GAP + 12;
	const CS        = size + PADDING * 2;
	const CX        = CS / 2;
	const CY        = CS / 2;

	// Each of the 12 pitch classes maps to 5 consecutive bars
	// Bars index 0..4 → pitch 0 (C), 5..9 → pitch 1 (C#), ...
	const BARS_PER_PITCH = BAR_COUNT / 12; // = 5

	// Per-bar smoothed height (0-1), persists across frames for smooth decay
	const smoothed = new Float32Array(BAR_COUNT).fill(0);

	// YouTube beat detection state
	const bassHistory: number[] = [];
	let ytBeatPulse  = 0;
	let ytLastBeat   = 0;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let rafId: number;

	// Beat tracking
	let beatPulse   = 0;
	let lastBeatIdx = -1;
	let lastBeatWall = 0;

	// Local position interpolation
	let localPos  = position;
	let posWall   = Date.now();
	$: { localPos = position; posWall = Date.now(); }

	function currentPos(): number {
		return isPlaying ? localPos + (Date.now() - posWall) / 1000 : localPos;
	}

	// ── Beat pulse ───────────────────────────────────────────────────────────────
	function updateBeatPulse() {
		const now = Date.now();
		const pos = currentPos();

		if (beats.length > 0) {
			let idx = 0;
			for (let i = 0; i < beats.length; i++) {
				if (beats[i].start <= pos) idx = i;
				else break;
			}
			if (idx !== lastBeatIdx) {
				lastBeatIdx  = idx;
				lastBeatWall = now;
			}
			const beat    = beats[idx];
			const elapsed = (now - lastBeatWall) / 1000;
			const t       = Math.min(1, elapsed / beat.duration);
			beatPulse = Math.pow(1 - t, 1.5) * beat.confidence;
		} else {
			const msBeat = (60 / Math.max(tempo, 60)) * 1000;
			const elapsed = now - lastBeatWall;
			if (elapsed >= msBeat) lastBeatWall = now - (elapsed % msBeat);
			const t = (now - lastBeatWall) / msBeat;
			beatPulse = isPlaying ? Math.pow(1 - Math.min(t, 1), 1.8) * (0.5 + energy * 0.5) : 0;
		}
	}

	// ── Segment loudness interpolation ───────────────────────────────────────────
	// Returns a 0-1 loudness value for the current moment inside a segment
	function segmentLoudness(seg: AudioSegment, elapsed: number): number {
		const riseTime = seg.loudnessMaxTime;
		const totalDb  = Math.max(seg.loudnessMax - seg.loudnessStart, 0.001);

		let db: number;
		if (elapsed <= riseTime) {
			// Attack: loudnessStart → loudnessMax
			const t = elapsed / Math.max(riseTime, 0.001);
			db = seg.loudnessStart + t * totalDb;
		} else {
			// Decay: loudnessMax → fade toward -60
			const t = (elapsed - riseTime) / Math.max(seg.duration - riseTime, 0.001);
			db = seg.loudnessMax - t * (seg.loudnessMax - seg.loudnessStart);
		}
		// Map dB (-60..0) → 0..1
		return Math.max(0, Math.min(1, (db + 60) / 60));
	}

	// ── Compute target bar heights from segments + beats ─────────────────────────
	function computeTargetHeights(target: Float32Array) {
		const pos = currentPos();

		if (audioBands.length > 0) {
			// ── YouTube : remapping log + détection de beat ──────────────────────
			const N = audioBands.length; // 64

			// Remapping logarithmique : barre i → position log dans les 64 bandes
			for (let i = 0; i < BAR_COUNT; i++) {
				const pos = (Math.pow(N, (i + 1) / BAR_COUNT) - 1);
				const lo  = Math.floor(pos);
				const hi  = Math.min(Math.ceil(pos), N - 1);
				const fr  = pos - lo;
				target[i] = (audioBands[lo] ?? 0) * (1 - fr) + (audioBands[hi] ?? 0) * fr;
			}

			// Détection de beat depuis l'énergie des graves (bandes 0-5)
			const bass = (audioBands[0] + audioBands[1] + audioBands[2] +
			              audioBands[3] + audioBands[4] + audioBands[5]) / 6;
			bassHistory.push(bass);
			if (bassHistory.length > 35) bassHistory.shift();

			const avgBass = bassHistory.reduce((a, b) => a + b, 0) / bassHistory.length;
			const now     = Date.now();
			if (bass > avgBass * 1.55 && bass > 0.18 && now - ytLastBeat > 280) {
				ytLastBeat  = now;
				ytBeatPulse = Math.min(1, bass * 1.4);
			}
			ytBeatPulse *= 0.87;

			// Superposer le beat transient sur toutes les barres
			for (let i = 0; i < BAR_COUNT; i++) {
				target[i] = Math.min(1, target[i] + ytBeatPulse * 0.3);
			}
			return;
		}

		if (segments.length === 0) {
			// No data: pure beat simulation
			for (let i = 0; i < BAR_COUNT; i++) target[i] = beatPulse;
			return;
		}

		// Find current segment
		let segIdx = 0;
		for (let i = 0; i < segments.length; i++) {
			if (segments[i].start <= pos) segIdx = i;
			else break;
		}
		const seg     = segments[segIdx];
		const elapsed = pos - seg.start;
		const loud    = segmentLoudness(seg, elapsed);

		// Map 12 pitch classes to BAR_COUNT bars
		for (let i = 0; i < BAR_COUNT; i++) {
			const pitchIdx  = Math.floor(i / BARS_PER_PITCH) % 12;
			const pitch     = seg.pitches?.[pitchIdx] ?? 0;

			// Timbre[0] = loudness proxy, [1] = brightness, [2] = attack
			const timbreEnergy = seg.timbre
				? Math.max(0, Math.min(1, (seg.timbre[0] + 200) / 200)) // timbre[0] ~ -200..200
				: 0.5;

			// Combine: pitch strength × loud envelope × beat transient
			const base   = pitch * loud * (0.6 + timbreEnergy * 0.4);
			target[i]    = Math.min(1, base + beatPulse * 0.35);
		}
	}

	// ── Color helper ─────────────────────────────────────────────────────────────
	function hexToRgb(hex: string): [number, number, number] {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return [r, g, b];
	}

	// ── Main draw loop ───────────────────────────────────────────────────────────
	const target = new Float32Array(BAR_COUNT);

	function draw() {
		updateBeatPulse();
		computeTargetHeights(target);

		ctx.clearRect(0, 0, CS, CS);

		const [r, g, b] = hexToRgb(color);
		const startR    = DISC_R + GAP;

		// Exponential smoothing (attack fast, release slow)
		for (let i = 0; i < BAR_COUNT; i++) {
			const attack  = target[i] > smoothed[i] ? 0.55 : 0.12;
			smoothed[i]  += (target[i] - smoothed[i]) * attack;
		}

		// ── Glow ring ───────────────────────────────────────────────────────────
		const activePulse = audioBands.length > 0 ? ytBeatPulse : beatPulse;
		if (isPlaying && activePulse > 0.04) {
			const glowR = DISC_R + GAP + activePulse * MAX_H * 0.45;
			const grad  = ctx.createRadialGradient(CX, CY, DISC_R, CX, CY, glowR + 22);
			grad.addColorStop(0,   `rgba(${r},${g},${b},${(activePulse * 0.4).toFixed(2)})`);
			grad.addColorStop(0.5, `rgba(${r},${g},${b},${(activePulse * 0.15).toFixed(2)})`);
			grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
			ctx.beginPath();
			ctx.arc(CX, CY, glowR + 22, 0, Math.PI * 2);
			ctx.fillStyle = grad;
			ctx.fill();
		}

		// ── Radial bars ─────────────────────────────────────────────────────────
		for (let i = 0; i < BAR_COUNT; i++) {
			const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
			const val   = smoothed[i];
			const h     = MIN_H + val * (MAX_H - MIN_H);
			const opacity = isPlaying ? 0.35 + val * 0.65 : 0.08;

			const x1 = CX + startR           * Math.cos(angle);
			const y1 = CY + startR           * Math.sin(angle);
			const x2 = CX + (startR + h)     * Math.cos(angle);
			const y2 = CY + (startR + h)     * Math.sin(angle);

			const grad = ctx.createLinearGradient(x1, y1, x2, y2);
			grad.addColorStop(0, `rgba(${r},${g},${b},${opacity.toFixed(2)})`);
			grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.lineWidth   = 2.8;
			ctx.strokeStyle = grad;
			ctx.lineCap     = 'round';
			ctx.stroke();
		}

		rafId = requestAnimationFrame(draw);
	}

	onMount(() => {
		ctx          = canvas.getContext('2d')!;
		lastBeatWall = Date.now();
		rafId        = requestAnimationFrame(draw);
	});

	onDestroy(() => cancelAnimationFrame(rafId));
</script>

<canvas
	bind:this={canvas}
	width={CS}
	height={CS}
	style="
		position: absolute;
		top:  {-PADDING}px;
		left: {-PADDING}px;
		pointer-events: none;
		z-index: 20;
	"
></canvas>
