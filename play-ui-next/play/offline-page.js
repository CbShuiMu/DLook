// DLook offline page (chrome-extension://…/play/offline.html). It belongs to the extension,
// so it opens without any network connection and reads the copies saved in the extension's
// own IndexedDB. Only the offline library and the player run here.
const root = document.documentElement;
const ext = globalThis.browser ?? globalThis.chrome;
root.lang = navigator.language || 'en';

// Theme and player preferences chosen on play.dlsite.com are mirrored to extension storage.
try {
  const stored = await ext.storage.local.get(['dlook-next-prefs', 'dlook-next-lang']);
  if (stored?.['dlook-next-lang']) root.lang = stored['dlook-next-lang'];
  const synced = stored?.['dlook-next-prefs'];
  if (synced && typeof synced === 'object') {
    localStorage.setItem('dlook-next-prefs', JSON.stringify(synced));
    if (synced.accent) localStorage.setItem('dlook-next-accent', synced.accent);
    if (synced.appearance) localStorage.setItem('dlook-next-appearance', synced.appearance);
  }
} catch {}
const read = (key, allowed, fallback) => {
  try { const value = localStorage.getItem(key); return allowed.includes(value) ? value : fallback; } catch { return fallback; }
};
root.setAttribute('data-dn-accent', read('dlook-next-accent', ['blue', 'pink'], 'blue'));
root.setAttribute('data-dn-appearance', read('dlook-next-appearance', ['auto', 'light', 'dark'], 'auto'));

const host = document.createElement('dlook-next');
document.body.append(host);
const { start } = await import('./ui/app.js');
start({ host, asset: path => ext.runtime.getURL(path), extension: true, standalone: true, version: ext.runtime.getManifest().version })
  .catch(error => { console.error('[DLook] offline page failed', error); root.removeAttribute('data-dn-booting'); });
