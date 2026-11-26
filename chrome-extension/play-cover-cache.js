const DLookPlayCoverCache = (() => {
  const cacheName = 'dlook-play-covers-v1';
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  const maxEntries = 192;
  const maxBytes = 24 * 1024 * 1024;
  const maxImageBytes = 5 * 1024 * 1024;
  const covers = '[class*="_thumbnail_"], [class*="_cover_"], [class*="_thumbs_"]';
  const memory = new Map();
  const pending = new Map();
  const states = new WeakMap();
  let pane, bytes = 0, disk, writes = Promise.resolve();
  const observer = new MutationObserver(scan);

  function storage() {
    return disk ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(cacheName, 1);
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

  function source(element) {
    if (element.tagName === 'IMG') return element.getAttribute('src');
    return /^url\(["']?(.*?)["']?\)$/.exec(element.style.backgroundImage)?.[1];
  }

  function remote(raw) {
    try {
      const url = new URL(raw, location.href);
      if (url.protocol !== 'https:' || url.username || url.password ||
          !/^(?:[^.]+\.)*dlsite\.(?:com|jp)$/.test(url.hostname)) return;
      return url.href;
    } catch {}
  }

  function trim() {
    for (const [key, entry] of memory) {
      for (const element of entry.users) {
        if (!element.isConnected || source(element) !== entry.url) entry.users.delete(element);
      }
      if (memory.size <= maxEntries && bytes <= maxBytes) continue;
      // Keep URLs alive while a mounted cover still uses them.
      if (entry.users.size) continue;
      memory.delete(key);
      bytes -= entry.size;
      URL.revokeObjectURL(entry.url);
    }
  }

  function remember(key, blob) {
    const entry = { url: URL.createObjectURL(blob), size: blob.size, users: new Set() };
    memory.set(key, entry);
    bytes += blob.size;
    return entry;
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
      if (!record) return;
      const age = Date.now() - record.stored;
      if (!Number.isFinite(age) || age < 0 || age >= maxAge) return;
      const blob = new Blob([record.bytes], { type: record.type });
      if (blob.size && blob.size <= maxImageBytes && blob.type.startsWith('image/')) return blob;
    } catch {}
  }

  function persist(key, blob) {
    // Serialize writes and eviction so simultaneous covers cannot race the limit.
    writes = writes.then(async () => {
      const db = await storage();
      if (!db) return;
      // Byte buffers also work in WebKit modes that reject IndexedDB Blob writes.
      const data = await blob.arrayBuffer();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['covers', 'entries'], 'readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
        const stored = Date.now();
        const covers = tx.objectStore('covers'), entries = tx.objectStore('entries');
        covers.put({ key, bytes: data, type: blob.type, stored });
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

  function load(key) {
    if (pending.has(key)) return pending.get(key);
    const promise = (async () => {
      let blob = await read(key);
      if (!blob) {
        const response = await fetch(key, {
          credentials: new URL(key).origin === location.origin ? 'same-origin' : 'omit',
          cache: 'force-cache', signal: AbortSignal.timeout(10000),
        });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/') ||
            Number(response.headers.get('content-length')) > maxImageBytes) throw new Error('Cover unavailable');
        blob = await response.blob();
        if (!blob.size || blob.size > maxImageBytes) throw new Error('Cover too large');
        persist(key, blob);
      }
      return remember(key, blob);
    })().finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  function display(element, url) {
    if (element.tagName === 'IMG') element.setAttribute('src', url);
    else element.style.backgroundImage = `url("${url}")`;
  }

  function cacheCover(element) {
    // Leave responsive source selection to the site's image component.
    if (element.tagName === 'IMG' && (element.srcset || element.closest('picture'))) return;
    const raw = source(element);
    if (!raw) return;
    const previous = states.get(element);
    if (previous && raw === previous.displayed) return;
    const key = remote(raw);
    if (!key) return;
    const state = { displayed: raw };
    states.set(element, state);
    const apply = entry => {
      // Run after all consumers of a shared request have attached their covers.
      queueMicrotask(trim);
      if (!element.isConnected || !pane?.contains(element) || states.get(element) !== state ||
          source(element) !== state.displayed) return;
      state.displayed = entry.url;
      entry.users.add(element);
      display(element, entry.url);
    };
    const hit = memory.get(key);
    if (hit) {
      memory.delete(key);
      memory.set(key, hit);
      apply(hit);
      return;
    }
    // A cold or unavailable cache leaves the site's original loader visible.
    load(key).then(apply).catch(() => {});
  }

  function scan() {
    if (!pane) return;
    for (const container of pane.querySelectorAll(covers)) {
      if (container.style.backgroundImage) cacheCover(container);
      for (const element of container.querySelectorAll('img[src], [style*="background"]')) cacheCover(element);
    }
    trim();
  }

  function update(next) {
    if (next !== pane) {
      observer.disconnect();
      pane = next;
      if (pane) observer.observe(pane, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'style'],
      });
    }
    scan();
  }

  return { update };
})();
