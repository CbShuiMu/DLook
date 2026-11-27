// Cover images: memory → IndexedDB → network. Shares the previous extension's
// 'dlook-play-covers-v1' database (same schema), so already cached covers are reused.
const dbName = 'dlook-play-covers-v1';
const maxAge = 7 * 24 * 3600000;
const maxEntries = 600;
const maxBytes = 64 * 1024 * 1024;
const maxImageBytes = 5 * 1024 * 1024;
const memory = new Map();
const pending = new Map();
let disk, writes = Promise.resolve();

function storage() {
  return disk ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('covers', { keyPath: 'key' });
      request.result.createObjectStore('entries', { keyPath: 'key' }).createIndex('stored', 'stored');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); disk = undefined; };
      resolve(db);
    };
  }).catch(() => null);
}

function remote(raw) {
  try {
    const url = new URL(raw, location.href);
    if (url.protocol === 'blob:' || url.protocol === 'data:') return null;
    if (url.protocol !== 'https:' || !/^(?:[^.]+\.)*dlsite\.(?:com|jp)$/.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function read(key) {
  const db = await storage();
  if (!db) return;
  try {
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction('covers', 'readonly');
      const request = tx.objectStore('covers').get(key);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
    if (!record || Date.now() - record.stored >= maxAge) return;
    const blob = new Blob([record.bytes], { type: record.type });
    if (blob.size && blob.type.startsWith('image/')) return blob;
  } catch {}
}

function persist(key, blob) {
  writes = writes.then(async () => {
    const db = await storage();
    if (!db) return;
    const bytes = await blob.arrayBuffer();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['covers', 'entries'], 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      const stored = Date.now();
      const covers = tx.objectStore('covers'), entries = tx.objectStore('entries');
      covers.put({ key, bytes, type: blob.type, stored });
      entries.put({ key, size: blob.size, stored });
      const request = entries.index('stored').getAll();
      request.onsuccess = () => {
        let total = request.result.reduce((sum, entry) => sum + entry.size, 0);
        let count = request.result.length;
        for (const entry of request.result) {
          if (count <= maxEntries && total <= maxBytes && stored - entry.stored < maxAge) break;
          covers.delete(entry.key);
          entries.delete(entry.key);
          total -= entry.size;
          count--;
        }
      };
    });
  }).catch(() => {});
}

function remember(key, blob) {
  const url = URL.createObjectURL(blob);
  memory.set(key, url);
  if (memory.size > maxEntries) {
    const [oldest, old] = memory.entries().next().value;
    memory.delete(oldest);
    // Revoke later so an <img> that is still decoding keeps its source.
    setTimeout(() => URL.revokeObjectURL(old), 60000);
  }
  return url;
}

/** Resolves a cached object URL (or null). Fetches and stores the image on a miss. */
export function cached(raw, { fetchMissing = true } = {}) {
  const key = remote(raw);
  if (!key) return Promise.resolve(null);
  if (memory.has(key)) return Promise.resolve(memory.get(key));
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      let blob = await read(key);
      if (!blob && fetchMissing && navigator.onLine) {
        const response = await fetch(key, { credentials: 'omit', cache: 'force-cache', signal: AbortSignal.timeout(12000) });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
        blob = await response.blob();
        if (!blob.size || blob.size > maxImageBytes) return null;
        persist(key, blob);
      }
      return blob ? remember(key, blob) : null;
    })().catch(() => null).finally(() => pending.delete(key)));
  }
  return pending.get(key);
}

export const memoryHit = raw => {
  const key = remote(raw);
  return key ? memory.get(key) ?? null : null;
};

/**
 * Fills an <img> with a cover: instant when cached in memory, otherwise from disk or the
 * network, with a soft fade-in. The element gets data-loaded once the image decoded.
 */
export function paint(img, raw) {
  img.decoding = 'async';
  const done = () => img.setAttribute('data-loaded', '');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', () => img.setAttribute('data-error', ''), { once: true });
  if (!raw) { img.setAttribute('data-error', ''); return; }
  const hit = memoryHit(raw);
  if (hit) {
    img.src = hit;
    if (img.complete) done();
    return;
  }
  const key = remote(raw);
  if (!key) { img.src = raw; return; }
  cached(raw).then(url => { if (!img.src) img.src = url ?? raw; }, () => { if (!img.src) img.src = raw; });
}

export async function clearAll() {
  for (const url of memory.values()) URL.revokeObjectURL(url);
  memory.clear();
  const db = await storage();
  if (!db) return;
  await new Promise(resolve => {
    const tx = db.transaction(['covers', 'entries'], 'readwrite');
    tx.objectStore('covers').clear();
    tx.objectStore('entries').clear();
    tx.oncomplete = tx.onabort = resolve;
  });
}

export async function usage() {
  const db = await storage();
  if (!db) return { count: 0, bytes: 0 };
  return new Promise(resolve => {
    const tx = db.transaction('entries', 'readonly');
    const request = tx.objectStore('entries').getAll();
    tx.oncomplete = () => resolve({ count: request.result.length, bytes: request.result.reduce((sum, entry) => sum + entry.size, 0) });
    tx.onabort = () => resolve({ count: 0, bytes: 0 });
  });
}
