// Offline copies storage. Where the data lives depends on where DLook runs:
//  - Browser extension: in the EXTENSION's own IndexedDB, so the offline page
//    (play/offline.html) can open and play them without reaching play.dlsite.com.
//    On play.dlsite.com the content-script UI talks to that database through a hidden
//    extension iframe (play/offline/bridge.html) — Blobs pass through postMessage intact.
//  - Safari userscript / dev harness: in the page's own IndexedDB, as before.
// Copies saved by earlier versions in play.dlsite.com's IndexedDB are moved over once.
import { createDirectStore, DB_NAME } from './offline-db.js';

const METHODS = ['start', 'save', 'saveSegment', 'saveVideo', 'saveCover', 'remove', 'video', 'list', 'work', 'cover', 'captions', 'track', 'trackKeys', 'rawTrack', 'putRaw'];
const migrationListeners = new Set();
let backend, bridgeUrl, bridgeContainer, migration;

/** Called by app.start on play.dlsite.com when running as a browser extension. */
export function useBridge(url, container) { bridgeUrl = url; bridgeContainer = container; }

/** Notified (once) when copies from an earlier version have been moved into the extension. */
export function onMigrated(listener) { migrationListeners.add(listener); return () => migrationListeners.delete(listener); }

/**
 * Connects to the extension's storage frame. The frame lives in DLook's shadow root; when the
 * site re-renders the document and DLook's host is re-attached, the frame reloads, so every
 * load performs a new handshake and requests still waiting for an answer are sent again.
 */
function connectBridge(url, container) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    const pending = new Map();   // id -> { method, args, ok, fail }
    let port, next = 0, connected = false;
    const timeout = setTimeout(() => { if (!connected) { frame.remove(); reject(new Error('Offline bridge did not start')); } }, 10000);
    const send = (id, call) => port?.postMessage({ id, method: call.method, args: call.args });
    frame.addEventListener('load', () => {
      port?.close();
      port = undefined;
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => {
        if (data?.ready) {
          port = channel.port1;
          for (const [id, call] of pending) send(id, call);
          if (!connected) {
            connected = true;
            clearTimeout(timeout);
            resolve(Object.fromEntries(METHODS.map(method => [method, (...args) => new Promise((ok, fail) => {
              const id = ++next;
              const call = { method, args, ok, fail };
              pending.set(id, call);
              send(id, call);
            })])));
          }
          return;
        }
        const call = pending.get(data?.id);
        if (!call) return;
        pending.delete(data.id);
        if (data.ok) call.ok(data.value);
        else call.fail(Object.assign(new Error(data.error?.message ?? 'Offline storage failed'), { name: data.error?.name ?? 'Error' }));
      };
      frame.contentWindow.postMessage({ dlookOfflineBridge: true }, new URL(url).origin, [channel.port2]);
    });
    (container ?? document.body ?? document.documentElement).append(frame);
  });
}

/** Moves copies saved in this page's own IndexedDB (DLook ≤ 3.0) into the extension store. */
async function migrate(target) {
  if (indexedDB.databases) {
    const names = (await indexedDB.databases().catch(() => [])).map(entry => entry.name);
    if (!names.includes(DB_NAME)) return;
  }
  const local = createDirectStore();
  try {
    const works = await local.list();
    for (const work of works) {
      // Media first, the work record last: a half-copied work never shows up as saved.
      for (const key of await local.trackKeys(work.workno)) {
        const value = await local.rawTrack(key);
        if (value !== undefined) await target.putRaw('tracks', value, key);
      }
      const existing = await target.work(work.workno).catch(() => null);
      if (!existing || existing.tracks.length < work.tracks.length || (existing.updated ?? 0) < (work.updated ?? 0)) await target.putRaw('works', work);
    }
    await local.close();
    await new Promise(resolve => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    if (works.length) for (const listener of migrationListeners) listener(works.length);
  } catch (error) {
    // Keep the old copies; the next visit retries (writes are idempotent).
    console.warn('[DLook] offline migration failed', error);
    await local.close();
  }
}

function resolveBackend() {
  if (!backend) {
    backend = (async () => {
      if (!bridgeUrl) return createDirectStore();
      try {
        const remote = await connectBridge(bridgeUrl, bridgeContainer);
        migration = migrate(remote);
        return remote;
      } catch (error) {
        console.warn('[DLook] offline bridge unavailable, using page storage', error);
        return createDirectStore();
      }
    })();
  }
  return backend;
}

/** Resolves once earlier copies (if any) have been moved over. */
export const migrated = () => resolveBackend().then(() => migration);

const store = Object.fromEntries(METHODS.map(method => [method, async (...args) => {
  const target = await resolveBackend();
  // Reads wait for the migration so the list is complete; writes go straight through.
  if (['list', 'work', 'cover', 'captions', 'track', 'video'].includes(method)) await migration;
  return target[method](...args);
}]));
export default store;
