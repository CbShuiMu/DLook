// Safari Userscripts entry for play.dlsite.com. The build (scripts/build_userscript.mjs)
// bundles this module and all of its imports into one IIFE and inlines the CSS and logo.
// It mirrors play/loader.js, which does the same for the Chrome extension; keep both in sync.
import { start } from './ui/app.js';

export function run({ styles, hostCss, logo, version }) {
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

  // Document-level rules (host positioning, hiding the native UI) go into the page itself.
  const style = document.createElement('style');
  style.textContent = hostCss;
  (document.head ?? root).append(style);
  const keepStyle = () => { if (!style.isConnected) (document.head ?? root).append(style); };

  const host = document.createElement('dlook-next');
  const mount = () => {
    keepStyle();
    if (!host.isConnected || (document.body && host.parentElement !== document.body)) (document.body ?? root).append(host);
  };
  mount();
  new MutationObserver(mount).observe(root, { childList: true });
  document.addEventListener('DOMContentLoaded', mount, { once: true });

  const assets = { 'dlook-logo.svg': logo };
  start({ host, asset: path => assets[path] ?? '', extension: false, styles, version }).catch(error => {
    console.error('[DLook Next] failed to start', error);
    root.removeAttribute('data-dn');
    root.removeAttribute('data-dn-booting');
    host.remove();
  });
}
