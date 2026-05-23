<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { settingsStore, musicStore } from '$lib/stores/musicStore';
	import MusicWidget from '$lib/components/MusicWidget.svelte';
	import type { OverlaySettings } from '$lib/types/music';

	onMount(() => {
		musicStore.setTrack({
			title: 'Blinding Lights',
			artist: 'The Weeknd',
			album: 'After Hours',
			artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
			duration: 200,
			position: 42,
			isPlaying: true,
			source: 'spotify'
		});
	});

	$: settings = $settingsStore;

	let _saveTimer: ReturnType<typeof setTimeout> | null = null;

	function update(partial: Partial<OverlaySettings>) {
		settingsStore.update(partial);
		if (_saveTimer) clearTimeout(_saveTimer);
		_saveTimer = setTimeout(async () => {
			if (!key) return;
			await fetch(`/api/settings?key=${encodeURIComponent(key)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(get(settingsStore))
			}).catch(() => {});
		}, 500);
	}

	// États Spotify : unconfigured → configured → connected
	type SpotifyState = 'loading' | 'unconfigured' | 'configured' | 'connected';
	let spotifyState: SpotifyState = 'loading';
	let clientIdInput = '';
	let secretInput = '';
	let saving = false;
	let saveError = '';
	let redirectUri = '';
	let urlCopied = false;
	let kvMissing = false;
	let key = '';

	function generateKey(): string {
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		return Array.from(crypto.getRandomValues(new Uint8Array(10)))
			.map(b => chars[b % chars.length])
			.join('');
	}

	onMount(async () => {
		// Génère ou récupère la clé depuis l'URL
		const params = new URLSearchParams(window.location.search);
		let k = params.get('key') ?? '';
		if (!k) {
			k = generateKey();
			params.set('key', k);
			window.history.replaceState({}, '', `?${params}`);
		}
		key = k;

		redirectUri = `${window.location.origin}/api/spotify/callback`;

		const [cfgRes, authRes] = await Promise.all([
			fetch(`/api/config?key=${key}`),
			fetch(`/api/spotify/status?key=${key}`)
		]);
		const cfg  = await cfgRes.json();
		const auth = await authRes.json();

		kvMissing = cfg.kvReady === false;

		if (auth.connected) {
			spotifyState = 'connected';
		} else if (cfg.hasCredentials) {
			spotifyState = 'configured';
			clientIdInput = cfg.clientId || '';
		} else {
			spotifyState = 'unconfigured';
		}
	});

	async function saveSpotifyConfig() {
		if (!clientIdInput.trim() || !secretInput.trim()) return;
		saving = true; saveError = '';
		const res = await fetch('/api/config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ spotifyClientId: clientIdInput.trim(), spotifyClientSecret: secretInput.trim(), key })
		});
		const data = await res.json();
		if (data.error) { saveError = data.error; saving = false; return; }
		secretInput = '';
		spotifyState = 'configured';
		saving = false;
	}

	async function resetSpotifyConfig() {
		await fetch(`/api/config?key=${key}`, { method: 'DELETE' });
		await fetch(`/api/spotify/status?key=${key}`, { method: 'DELETE' });
		spotifyState = 'unconfigured';
		clientIdInput = ''; secretInput = '';
	}

	async function disconnectSpotify() {
		await fetch(`/api/spotify/status?key=${key}`, { method: 'DELETE' });
		spotifyState = 'configured';
	}

	async function copyUrl() {
		const overlayUrl = `${window.location.origin}/overlay?key=${key}`;
		await navigator.clipboard.writeText(overlayUrl);
		urlCopied = true;
		setTimeout(() => (urlCopied = false), 2000);
	}

	const themes: Array<{ id: OverlaySettings['theme']; label: string; desc: string; dot: string }> = [
		{ id: 'dark-spotify',  label: 'Dark Spotify/YTB',  desc: 'Fond noir, vert Spotify& rouge ytb',   dot: '#1DB954' },
		{ id: 'neon-purple',   label: 'Neon Purple',   desc: 'Violet électrique + glow',  dot: '#9b59b2' },
		{ id: 'glassmorphism', label: 'Glassmorphism', desc: 'Verre dépoli translucide',  dot: '#e0e0e0' }
	];

	const toggles: Array<{ key: keyof OverlaySettings; label: string }> = [
		{ key: 'showDuration',      label: 'Durée'           },
		{ key: 'showArtist',        label: 'Artiste'         },
		{ key: 'showProgressBar',   label: 'Barre de progression' },
		{ key: 'showGlow',          label: 'Effet glow'      },
		{ key: 'showVisualizer',    label: 'Visualiseur audio' },
		{ key: 'dynamicBackground', label: 'Fond dynamique'  }
	];
</script>

<svelte:head>
	<title>OBS Overlay — Settings</title>
</svelte:head>

<div class="layout">
	<!-- ─── Sidebar ─────────────────────────────────────── -->
	<aside class="sidebar">

		<!-- Header -->
		<div class="sidebar-header">
			<div class="app-icon">
				<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
					<circle cx="12" cy="12" r="3.5" fill="currentColor"/>
					<path d="M12 3C12 3 16 7 16 12C16 17 12 21 12 21" stroke="currentColor" stroke-width="1" opacity="0.4"/>
					<path d="M12 3C12 3 8 7 8 12C8 17 12 21 12 21" stroke="currentColor" stroke-width="1" opacity="0.4"/>
					<path d="M3 12H21" stroke="currentColor" stroke-width="1" opacity="0.4"/>
				</svg>
			</div>
			<div>
				<h1>OBS Music Overlay</h1>
				<p>Paramètres du widget</p>
			</div>
		</div>

		<div class="sidebar-content">

			<!-- KV warning -->
			{#if kvMissing}
				<div class="kv-warning">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0">
						<path d="M7 1L13 12H1L7 1Z" stroke="#f59e0b" stroke-width="1.3" stroke-linejoin="round"/>
						<path d="M7 5v3M7 10v.5" stroke="#f59e0b" stroke-width="1.3" stroke-linecap="round"/>
					</svg>
					<span>
						<strong>Vercel KV non connecté</strong> — les paramètres ne seront pas sauvegardés.
						<a href="https://vercel.com/dashboard" target="_blank" rel="noopener" class="kv-link">
							Dashboard → Storage → créer une base KV et la lier au projet.
						</a>
					</span>
				</div>
			{/if}

			<!-- Spotify -->
			<section class="card">
				<h2 class="section-title">Spotify</h2>

				{#if spotifyState === 'loading'}
					<div class="status-row">
						<span class="dot dot-idle"></span>
						<span class="status-text muted">Chargement…</span>
					</div>

				{:else if spotifyState === 'unconfigured'}
					<p class="yt-desc">
						Créez une app sur
						<a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener" class="ext-link">developer.spotify.com</a>
						et ajoutez ce Redirect URI&nbsp;:
					</p>
					<div class="redirect-box">
						<code>{redirectUri}</code>
					</div>
					<div class="config-fields">
						<input
							class="config-input"
							bind:value={clientIdInput}
							placeholder="Client ID"
							autocomplete="off"
						/>
						<input
							class="config-input"
							bind:value={secretInput}
							placeholder="Client Secret"
							type="password"
							autocomplete="new-password"
						/>
					</div>
					{#if saveError}<p class="save-error">{saveError}</p>{/if}
					<button
						class="btn-primary"
						on:click={saveSpotifyConfig}
						disabled={saving || !clientIdInput.trim() || !secretInput.trim()}
					>
						{saving ? 'Sauvegarde…' : 'Sauvegarder'}
					</button>

				{:else if spotifyState === 'configured'}
					<p class="yt-desc">Clés enregistrées — connectez votre compte.</p>
					<a href="/api/spotify/auth?key={key}" class="btn-primary">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.65 14.58c-.2.33-.63.43-.96.23-2.62-1.6-5.92-1.97-9.81-1.08-.37.09-.75-.14-.84-.51-.09-.37.14-.75.51-.84 4.25-1 7.93-.57 10.87 1.24.34.2.44.63.23.96zm1.24-2.76c-.25.41-.78.54-1.19.29-3-1.84-7.57-2.37-11.11-1.3-.46.14-.94-.12-1.08-.58-.14-.46.12-.94.58-1.08 4.05-1.23 9.09-.63 12.52 1.48.41.25.54.78.28 1.19zm.11-2.87C14.6 9.08 9.08 8.88 5.69 9.96c-.55.17-1.13-.14-1.3-.69-.17-.55.14-1.13.69-1.3 3.95-1.2 10.52-.97 14.66 1.5.49.29.66.92.37 1.41-.29.49-.92.66-1.41.37z"/></svg>
						Connecter Spotify
					</a>
					<button class="link-btn" style="margin-top:8px" on:click={resetSpotifyConfig}>
						Changer les clés
					</button>

				{:else if spotifyState === 'connected'}
					<div class="status-row">
						<span class="dot dot-on"></span>
						<span class="status-text">Spotify connecté</span>
					</div>
					<div style="display:flex; gap:12px; margin-top:4px;">
						<button class="link-btn" on:click={disconnectSpotify}>Déconnecter</button>
						<button class="link-btn" on:click={resetSpotifyConfig}>Changer les clés</button>
					</div>
				{/if}
			</section>

			<!-- YouTube Music -->
			<section class="card">
				<h2 class="section-title">YouTube</h2>
				<p class="yt-desc">Installez l'extension Firefox pour envoyer les données de lecture en temps réel à l'overlay.</p>
				<a href="/api/extension?key={key}" download="obs-youtube-extension.zip" class="btn-download">
					<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
						<path d="M7.5 1v9M4 7l3.5 3.5L11 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M2 13h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
					</svg>
					Télécharger l'extension
				</a>
				<ol class="install-steps">
					<li>Dézipper le fichier téléchargé</li>
					<li>Firefox → <code>about:debugging</code></li>
					<li>Cliquer <strong>Ce Firefox</strong></li>
					<li>Cliquer <strong>Charger un module temporaire</strong></li>
					<li>Sélectionner le fichier <code>manifest.json</code></li>
				</ol>
			</section>

			<!-- Thème -->
			<section class="card">
				<h2 class="section-title">Thème</h2>
				<div class="theme-list">
					{#each themes as t}
						<button
							class="theme-item"
							class:active={settings.theme === t.id}
							on:click={() => update({ theme: t.id })}
						>
							<span class="theme-dot" style="background:{t.dot};"></span>
							<span class="theme-label">{t.label}</span>
							<span class="theme-desc">{t.desc}</span>
							{#if settings.theme === t.id}
								<span class="theme-check">
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
										<path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</section>

			<!-- Apparence -->
			<section class="card">
				<h2 class="section-title">Apparence</h2>

				<!-- Size -->
				<div class="field">
					<label class="field-label">Taille</label>
					<div class="seg">
						{#each (['small', 'medium', 'large'] as const) as s}
							<button
								class="seg-btn"
								class:seg-active={settings.widgetSize === s}
								on:click={() => update({ widgetSize: s })}
							>
								{s === 'small' ? 'Petit' : s === 'medium' ? 'Moyen' : 'Grand'}
							</button>
						{/each}
					</div>
				</div>

				<!-- Border radius -->
				<div class="field">
					<label class="field-label">
						Coins arrondis
						<span class="field-value">{settings.borderRadius}px</span>
					</label>
					<input
						type="range" min="0" max="32" step="2"
						value={settings.borderRadius}
						on:input={(e) => update({ borderRadius: parseInt(e.currentTarget.value) })}
						class="slider"
					/>
				</div>

				<!-- Color -->
			</section>

			<!-- Animation -->
			<section class="card">
				<h2 class="section-title">Animation</h2>
				<div class="field">
					<label class="field-label">Vitesse du disque vinyle</label>
					<div class="seg">
						{#each (['slow', 'medium', 'fast'] as const) as spd}
							<button
								class="seg-btn"
								class:seg-active={settings.discSpeed === spd}
								on:click={() => update({ discSpeed: spd })}
							>
								{spd === 'slow' ? 'Lente' : spd === 'medium' ? 'Normale' : 'Rapide'}
							</button>
						{/each}
					</div>
				</div>
			</section>

			<!-- Options -->
			<section class="card">
				<h2 class="section-title">Affichage</h2>
				<div class="toggles">
					{#each toggles as opt}
						<label class="toggle-row">
							<span class="toggle-label">{opt.label}</span>
							<button
								role="switch"
								aria-checked={settings[opt.key] as boolean}
								class="toggle"
								class:on={settings[opt.key] as boolean}
								on:click={() => update({ [opt.key]: !settings[opt.key] })}
							>
								<span class="toggle-thumb"></span>
							</button>
						</label>
					{/each}
				</div>
			</section>

			<!-- Reset -->
			<button class="reset-btn" on:click={() => settingsStore.reset()}>
				Réinitialiser les paramètres
			</button>

		</div>
	</aside>

	<!-- ─── Preview ─────────────────────────────────────── -->
	<main class="preview-pane">
		<div class="preview-header">
			<div>
				<h2>Aperçu en direct</h2>
				<p>Ce que vous verrez dans OBS</p>
			</div>
			<button class="copy-btn" on:click={copyUrl}>
				{#if urlCopied}
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M2 7l3.5 3.5L12 3" stroke="#1DB954" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					Copié !
				{:else}
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
						<path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
					</svg>
					Copier l'URL OBS
				{/if}
			</button>
		</div>

		<div class="preview-stage">
			<div class="preview-widget">
				<MusicWidget preview={true} />
			</div>
		</div>

		<div class="preview-footer">
			<span class="obs-url">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/overlay{key ? `?key=${key}` : ''}</span>
			<span class="obs-hint">OBS → Sources → Navigateur → coller l'URL</span>
		</div>
	</main>
</div>

<style>
	/* ── Layout ────────────────────────────────────────────────────── */
	.layout {
		display: flex;
		height: 100vh;
		background: #0c0c0e;
		color: #fff;
		font-family: system-ui, -apple-system, sans-serif;
		overflow: hidden;
	}

	/* ── Sidebar ───────────────────────────────────────────────────── */
	.sidebar {
		width: 312px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: #111115;
		border-right: 1px solid rgba(255,255,255,0.06);
		overflow: hidden;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 24px 20px 20px;
		border-bottom: 1px solid rgba(255,255,255,0.05);
		flex-shrink: 0;
	}

	.app-icon {
		width: 36px;
		height: 36px;
		background: rgba(29,185,84,0.1);
		border: 1px solid rgba(29,185,84,0.2);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #1DB954;
		flex-shrink: 0;
	}
	.app-icon svg { width: 18px; height: 18px; }

	.sidebar-header h1 {
		font-size: 14px;
		font-weight: 600;
		margin: 0;
		color: #fff;
		letter-spacing: -0.01em;
	}
	.sidebar-header p {
		font-size: 11px;
		color: rgba(255,255,255,0.35);
		margin: 2px 0 0;
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.08) transparent;
	}

	/* ── KV warning ────────────────────────────────────────────────── */
	.kv-warning {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 10px 12px;
		background: rgba(245,158,11,0.08);
		border: 1px solid rgba(245,158,11,0.25);
		border-radius: 10px;
		font-size: 12px;
		color: rgba(255,255,255,0.6);
		line-height: 1.5;
	}
	.kv-warning strong { color: #f59e0b; font-weight: 600; }
	.kv-link { color: #f59e0b; text-decoration: underline; display: block; margin-top: 2px; }
	.kv-link:hover { color: #fbbf24; }

	/* ── Cards ─────────────────────────────────────────────────────── */
	.card {
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 12px;
		padding: 14px 16px;
	}

	.section-title {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(255,255,255,0.3);
		margin: 0 0 12px;
	}

	/* ── Connection ────────────────────────────────────────────────── */
	.status-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.dot-on   { background: #1DB954; box-shadow: 0 0 6px #1DB954; }
	.dot-idle { background: rgba(255,255,255,0.2); }
	.status-text { font-size: 13px; font-weight: 500; color: #1DB954; }
	.status-text.muted { color: rgba(255,255,255,0.4); font-weight: 400; }

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		font-size: 12px;
		color: rgba(255,255,255,0.3);
		cursor: pointer;
		transition: color 0.15s;
	}
	.link-btn:hover { color: #ff6b6b; }

	.btn-primary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 9px 14px;
		background: #1DB954;
		color: #000;
		font-size: 13px;
		font-weight: 600;
		border-radius: 8px;
		text-decoration: none;
		transition: background 0.15s, transform 0.1s;
	}
	.btn-primary:hover { background: #1ed760; transform: translateY(-1px); }
	.btn-primary:active { transform: translateY(0); }

	.hint {
		font-size: 11px;
		color: rgba(255,255,255,0.25);
		margin: 8px 0 0;
		line-height: 1.5;
	}

	/* ── Spotify setup ─────────────────────────────────────────────── */
	.redirect-box {
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 7px;
		padding: 8px 10px;
		margin-bottom: 10px;
		word-break: break-all;
	}
	.redirect-box code {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 10.5px;
		color: rgba(255,255,255,0.5);
	}
	.config-fields { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
	.config-input {
		width: 100%;
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(255,255,255,0.09);
		border-radius: 7px;
		padding: 8px 10px;
		font-size: 12.5px;
		color: #fff;
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}
	.config-input::placeholder { color: rgba(255,255,255,0.25); }
	.config-input:focus { border-color: rgba(29,185,84,0.5); }
	.save-error { font-size: 11px; color: #ff6b6b; margin: -4px 0 8px; }
	.ext-link { color: rgba(255,255,255,0.55); text-decoration: underline; }
	.ext-link:hover { color: #fff; }
	.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

	/* ── YouTube extension ─────────────────────────────────────────── */
	.yt-desc {
		font-size: 12px;
		color: rgba(255,255,255,0.35);
		margin: 0 0 10px;
		line-height: 1.5;
	}
	.btn-download {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		width: 100%;
		padding: 9px 14px;
		background: rgba(255,0,0,0.12);
		border: 1px solid rgba(255,0,0,0.25);
		color: #ff4e4e;
		font-size: 13px;
		font-weight: 600;
		border-radius: 8px;
		text-decoration: none;
		transition: background 0.15s, border-color 0.15s, transform 0.1s;
	}
	.btn-download:hover {
		background: rgba(255,0,0,0.2);
		border-color: rgba(255,0,0,0.4);
		transform: translateY(-1px);
	}
	.btn-download:active { transform: translateY(0); }

	.install-steps {
		margin: 12px 0 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.install-steps li {
		font-size: 11.5px;
		color: rgba(255,255,255,0.3);
		line-height: 1.4;
	}
	.install-steps strong { color: rgba(255,255,255,0.55); font-weight: 600; }
	.install-steps code {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 10.5px;
		background: rgba(255,255,255,0.06);
		padding: 1px 5px;
		border-radius: 4px;
		color: rgba(255,255,255,0.45);
	}

	/* ── Theme picker ──────────────────────────────────────────────── */
	.theme-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.theme-item {
		display: grid;
		grid-template-columns: 10px 1fr auto auto;
		grid-template-rows: auto auto;
		column-gap: 10px;
		align-items: center;
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
		text-align: left;
		color: inherit;
	}
	.theme-item:hover { background: rgba(255,255,255,0.04); }
	.theme-item.active {
		background: rgba(255,255,255,0.06);
		border-color: rgba(255,255,255,0.1);
	}
	.theme-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		grid-row: 1 / 3;
	}
	.theme-label {
		font-size: 13px;
		font-weight: 500;
		color: rgba(255,255,255,0.9);
	}
	.theme-desc {
		font-size: 11px;
		color: rgba(255,255,255,0.3);
		grid-column: 2;
		margin-top: 1px;
	}
	.theme-check {
		grid-row: 1 / 3;
		grid-column: 4;
		color: rgba(255,255,255,0.6);
	}

	/* ── Fields ────────────────────────────────────────────────────── */
	.field { margin-bottom: 14px; }
	.field:last-child { margin-bottom: 0; }
	.field-label {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		font-weight: 500;
		color: rgba(255,255,255,0.6);
		margin-bottom: 8px;
	}
	.field-value {
		font-size: 12px;
		color: rgba(255,255,255,0.3);
		font-feature-settings: 'tnum';
	}

	/* ── Segmented control ─────────────────────────────────────────── */
	.seg {
		display: flex;
		gap: 3px;
		background: rgba(0,0,0,0.3);
		padding: 3px;
		border-radius: 8px;
	}
	.seg-btn {
		flex: 1;
		padding: 6px 4px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		border: none;
		background: transparent;
		color: rgba(255,255,255,0.35);
		cursor: pointer;
		transition: all 0.15s;
	}
	.seg-btn:hover { color: rgba(255,255,255,0.6); }
	.seg-active {
		background: rgba(255,255,255,0.1) !important;
		color: #fff !important;
	}

	/* ── Slider ────────────────────────────────────────────────────── */
	.slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: rgba(255,255,255,0.1);
		outline: none;
		cursor: pointer;
	}
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		box-shadow: 0 0 0 2px rgba(255,255,255,0.15);
		transition: transform 0.1s;
	}
	.slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

	/* ── Color picker ──────────────────────────────────────────────── */
	.color-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.color-swatch {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		cursor: pointer;
		border: 1px solid rgba(255,255,255,0.1);
		overflow: hidden;
		display: block;
		transition: transform 0.1s;
	}
	.color-swatch:hover { transform: scale(1.05); }
	.color-swatch input {
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
	.color-code {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 12px;
		color: rgba(255,255,255,0.4);
		background: rgba(255,255,255,0.05);
		padding: 4px 8px;
		border-radius: 6px;
	}

	/* ── Toggles ───────────────────────────────────────────────────── */
	.toggles { display: flex; flex-direction: column; gap: 1px; }
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 0;
		cursor: pointer;
		border-bottom: 1px solid rgba(255,255,255,0.04);
	}
	.toggle-row:last-child { border-bottom: none; padding-bottom: 0; }
	.toggle-label { font-size: 13px; color: rgba(255,255,255,0.75); }

	.toggle {
		width: 36px;
		height: 20px;
		border-radius: 10px;
		border: none;
		background: rgba(255,255,255,0.1);
		cursor: pointer;
		position: relative;
		transition: background 0.2s;
		flex-shrink: 0;
	}
	.toggle.on { background: #1DB954; }
	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
		box-shadow: 0 1px 3px rgba(0,0,0,0.3);
	}
	.toggle.on .toggle-thumb { transform: translateX(16px); }

	/* ── Reset ─────────────────────────────────────────────────────── */
	.reset-btn {
		width: 100%;
		padding: 10px;
		border-radius: 8px;
		font-size: 12px;
		color: rgba(255,255,255,0.25);
		background: transparent;
		border: 1px solid rgba(255,255,255,0.07);
		cursor: pointer;
		transition: all 0.15s;
		margin-top: 4px;
	}
	.reset-btn:hover {
		border-color: rgba(255,100,100,0.3);
		color: #ff6b6b;
		background: rgba(255,100,100,0.05);
	}

	/* ── Preview pane ──────────────────────────────────────────────── */
	.preview-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #0c0c0e;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 28px 16px;
		border-bottom: 1px solid rgba(255,255,255,0.05);
		flex-shrink: 0;
	}
	.preview-header h2 {
		font-size: 14px;
		font-weight: 600;
		margin: 0;
		color: rgba(255,255,255,0.9);
	}
	.preview-header p {
		font-size: 12px;
		color: rgba(255,255,255,0.3);
		margin: 3px 0 0;
	}

	.copy-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 500;
		background: rgba(255,255,255,0.06);
		border: 1px solid rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.6);
		cursor: pointer;
		transition: all 0.15s;
	}
	.copy-btn:hover {
		background: rgba(255,255,255,0.09);
		color: rgba(255,255,255,0.85);
	}

	.preview-stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: auto;
		background-image:
			linear-gradient(45deg, rgba(255,255,255,0.015) 25%, transparent 25%),
			linear-gradient(-45deg, rgba(255,255,255,0.015) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.015) 75%),
			linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.015) 75%);
		background-size: 20px 20px;
		background-position: 0 0, 0 10px, 10px -10px, -10px 0;
		padding: 32px;
	}

	.preview-widget {
		transform: scale(0.5);
		transform-origin: center center;
	}

	.preview-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 28px;
		border-top: 1px solid rgba(255,255,255,0.05);
		flex-shrink: 0;
	}
	.obs-url {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 12px;
		color: rgba(255,255,255,0.35);
		background: rgba(255,255,255,0.04);
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px solid rgba(255,255,255,0.06);
	}
	.obs-hint {
		font-size: 11px;
		color: rgba(255,255,255,0.2);
	}
</style>
