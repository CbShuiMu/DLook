// Two-level cache: an in-memory map backed by an IndexedDB key/value store.
// `swr()` returns cached data immediately and refreshes it in the background, so
// screens render from cache first and repeated visits do not repeat requests.

const dbName = 'dlook-next-cache';
let connection;
const memory = new Map();
const inflight = new Map();
const listeners = new Map();

function open() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = undefined; };
      resolve(db);
    };
  }).catch(() => null);
  return connection;
}

async function idb(mode, run) {
  const db = await open();
  if (!db) return undefined;
  return new Promise(resolve => {
    try {
      const tx = db.transaction('kv', mode);
      const request = run(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(request?.result);
      tx.onabort = tx.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** Reads `{ value, stored }` from memory or disk. */
export async function peek(key) {
  if (memory.has(key)) return memory.get(key);
  const record = await idb('readonly', store => store.get(key));
  if (record && typeof record === 'object' && 'stored' in record) {
    if (!memory.has(key)) memory.set(key, record);
    return memory.get(key);
  }
  return undefined;
}

export async function put(key, value, { persist = true } = {}) {
  const record = { value, stored: Date.now() };
  memory.set(key, record);
  if (memory.size > 400) memory.delete(memory.keys().next().value);
  if (persist) await idb('readwrite', store => store.put(record, key));
  for (const listener of listeners.get(key) ?? []) listener(value);
  return value;
}

export async function remove(key) {
  memory.delete(key);
  await idb('readwrite', store => store.delete(key));
}

/** Removes every entry whose key starts with `prefix` (memory and disk). */
export async function removePrefix(prefix) {
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
  await idb('readwrite', store => store.delete(IDBKeyRange.bound(prefix, prefix + '￿')));
}

export function clearMemory() {
  memory.clear();
}

export function subscribe(key, listener) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(listener);
  return () => listeners.get(key)?.delete(listener);
}

/**
 * Cached loader.
 *  - fresh (age < ttl): resolves from cache without a request
 *  - stale: resolves from cache, refreshes in the background and notifies `onUpdate`
 *  - missing / force: waits for the network
 * Concurrent callers share one request.
 */
export async function swr(key, load, { ttl = 60000, persist = true, force = false, onUpdate } = {}) {
  const cached = force ? undefined : await peek(key);
  const age = cached ? Date.now() - cached.stored : Infinity;
  const refresh = () => {
    if (!inflight.has(key)) {
      const request = Promise.resolve().then(load).then(value => put(key, value, { persist }))
        .finally(() => inflight.delete(key));
      inflight.set(key, request);
    }
    return inflight.get(key);
  };
  if (cached && age < ttl) return cached.value;
  if (cached) {
    if (navigator.onLine) refresh().then(value => onUpdate?.(value)).catch(() => {});
    return cached.value;
  }
  return refresh();
}

export function invalidate(key) {
  memory.delete(key);
  return idb('readwrite', store => store.delete(key));
}
