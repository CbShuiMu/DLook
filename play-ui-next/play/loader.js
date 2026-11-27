// DLook Next · content-script entry for play.dlsite.com.
// Runs at document_start: applies the saved theme before the first paint, hides the
// native Play UI behind a splash, then loads the ES-module application.
(() => {
  if (window.top !== window || document.documentElement.hasAttribute('data-dn')) return;
  const root = document.documentElement;
  const read = (key, allowed, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return allowed.includes(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };
  root.setAttribute('data-dn', '');
  root.setAttribute('data-dn-accent', read('dlook-next-accent', ['blue', 'pink'], read('dlook-play-theme', ['blue', 'pink'], 'blue')));
  root.setAttribute('data-dn-appearance', read('dlook-next-appearance', ['auto', 'light', 'dark'], 'auto'));
  root.setAttribute('data-dn-booting', '');

  const host = document.createElement('dlook-next');
  host.setAttribute('aria-live', 'off');
  const mount = () => {
    if (host.isConnected) return;
    (document.body ?? root).append(host);
  };
  mount();
  // React may replace <body> children while hydrating; keep the host attached.
  new MutationObserver(() => { if (!host.isConnected) mount(); else if (document.body && host.parentElement !== document.body) document.body.append(host); })
    .observe(root, { childList: true, subtree: false });
  document.addEventListener('DOMContentLoaded', mount, { once: true });

  const url = path => chrome.runtime.getURL(path);
  import(url('play/ui/app.js'))
    .then(app => app.start({ host, asset: url, extension: true, version: chrome.runtime.getManifest().version }))
    .catch(error => {
      // Never leave the site unusable: reveal the native UI if the app fails to boot.
      console.error('[DLook Next] failed to start', error);
      root.removeAttribute('data-dn');
      root.removeAttribute('data-dn-booting');
      host.remove();
    });
})();
