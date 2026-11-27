// Hidden iframe that gives the play.dlsite.com UI access to the extension's own offline
// database. Requests arrive over a MessageChannel transferred by data/offline-store.js.
import { createDirectStore } from '../data/offline-db.js';

const ALLOWED = new Set(['https://play.dlsite.com']);
const store = createDirectStore();
const METHODS = new Set(['start', 'save', 'saveSegment', 'saveVideo', 'saveCover', 'remove', 'video', 'list', 'work', 'cover', 'captions', 'track', 'trackKeys', 'rawTrack', 'putRaw']);

window.addEventListener('message', event => {
  if (!ALLOWED.has(event.origin) || event.source !== window.parent || !event.data?.dlookOfflineBridge) return;
  const [port] = event.ports;
  if (!port) return;
  port.onmessage = async ({ data }) => {
    const { id, method, args } = data ?? {};
    if (!METHODS.has(method) || !Array.isArray(args)) { port.postMessage({ id, ok: false, error: { name: 'TypeError', message: 'Unknown method' } }); return; }
    try {
      port.postMessage({ id, ok: true, value: await store[method](...args) });
    } catch (error) {
      port.postMessage({ id, ok: false, error: { name: error?.name ?? 'Error', message: String(error?.message ?? error) } });
    }
  };
  // Keep the copies even when the browser is short on space.
  navigator.storage?.persist?.().catch(() => {});
  port.postMessage({ ready: true });
});
