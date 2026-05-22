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

function isVercel(): boolean {
	return !!process.env.KV_REST_API_URL;
}

export async function kvGet<T>(key: string): Promise<T | null> {
	if (!isVercel()) return localGet<T>(key);
	const { kv } = await import('@vercel/kv');
	return kv.get<T>(key);
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
	if (!isVercel()) { localSet(key, value, ttlSeconds); return; }
	const { kv } = await import('@vercel/kv');
	if (ttlSeconds) await kv.set(key, value, { ex: ttlSeconds });
	else await kv.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
	if (!isVercel()) { localDel(key); return; }
	const { kv } = await import('@vercel/kv');
	await kv.del(key);
}
