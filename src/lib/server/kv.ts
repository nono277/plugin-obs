import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const STORE_FILE = join(process.cwd(), '.obs-store.json');

type Entry = { value: unknown; expiresAt?: number };
type Store = Record<string, Entry>;

function readStore(): Store {
	if (!existsSync(STORE_FILE)) return {};
	try { return JSON.parse(readFileSync(STORE_FILE, 'utf-8')); }
	catch { return {}; }
}

function writeStore(store: Store): void {
	writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function localGet<T>(key: string): T | null {
	const store = readStore();
	const e = store[key];
	if (!e) return null;
	if (e.expiresAt && Date.now() > e.expiresAt) {
		delete store[key];
		writeStore(store);
		return null;
	}
	return e.value as T;
}

function localSet(key: string, value: unknown, ttlSeconds?: number): void {
	const store = readStore();
	store[key] = { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined };
	writeStore(store);
}

function localDel(key: string): void {
	const store = readStore();
	delete store[key];
	writeStore(store);
}

type Mode = 'kv' | 'redis' | 'local';

function getMode(): Mode {
	if (process.env.KV_REST_API_URL) return 'kv';
	if (process.env.REDIS_URL)       return 'redis';
	return 'local';
}

export function kvReady(): boolean {
	return getMode() !== 'local';
}

// Cached Redis client — reused across requests in the same container
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _redis: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRedis(): Promise<any> {
	if (_redis?.isOpen) return _redis;
	const { createClient } = await import('redis');
	_redis = createClient({ url: process.env.REDIS_URL });
	_redis.on('error', () => { _redis = null; });
	await _redis.connect();
	return _redis;
}

export async function kvGet<T>(key: string): Promise<T | null> {
	const mode = getMode();
	if (mode === 'local') return localGet<T>(key);
	if (mode === 'kv') {
		const { kv } = await import('@vercel/kv');
		return kv.get<T>(key);
	}
	const redis = await getRedis();
	const raw: string | null = await redis.get(key);
	if (!raw) return null;
	return JSON.parse(raw) as T;
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
	const mode = getMode();
	if (mode === 'local') { localSet(key, value, ttlSeconds); return; }
	if (mode === 'kv') {
		const { kv } = await import('@vercel/kv');
		if (ttlSeconds) await kv.set(key, value, { ex: ttlSeconds });
		else await kv.set(key, value);
		return;
	}
	const redis = await getRedis();
	const serialized = JSON.stringify(value);
	if (ttlSeconds) await redis.set(key, serialized, { EX: ttlSeconds });
	else await redis.set(key, serialized);
}

export async function kvDel(key: string): Promise<void> {
	const mode = getMode();
	if (mode === 'local') { localDel(key); return; }
	if (mode === 'kv') {
		const { kv } = await import('@vercel/kv');
		await kv.del(key);
		return;
	}
	const redis = await getRedis();
	await redis.del(key);
}
