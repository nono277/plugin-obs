/**
 * Run with: node create-icons.js
 * Generates placeholder PNG icons for the Chrome extension.
 * Replace with your real icons before publishing.
 */

// Simple 1x1 green PNG (base64) — replace with real icon files
const { writeFileSync } = await import('fs');

// Minimal valid PNG bytes for a green square
function greenPNG(size) {
	const { createCanvas } = await import('canvas').catch(() => null) ?? {};
	if (createCanvas) {
		const canvas = createCanvas(size, size);
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#1DB954';
		ctx.fillRect(0, 0, size, size);
		// Music note
		ctx.fillStyle = '#000';
		ctx.font = `${size * 0.6}px serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('♪', size / 2, size / 2 + 1);
		return canvas.toBuffer('image/png');
	}
	// Fallback: 1px green PNG
	return Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	);
}

for (const size of [16, 48, 128]) {
	writeFileSync(`icon${size}.png`, await greenPNG(size));
	console.log(`Created icon${size}.png`);
}
