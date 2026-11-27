// DLook Next application shell.
// Desktop: glass sidebar + wide content + docked player bar.
// Mobile: large-title pages + bottom tab bar (icon + text) + floating mini player.
import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, setLanguage, detect, onLanguage } from '../core/i18n.js';
import * as prefs from '../core/prefs.js';
import * as kit from './kit.js';
import * as native from './native.js';
import * as state from './state.js';
import { offlineHref } from '../data/offline.js';
import { createPlayer } from './player.js';

const TABS = [
  { name: 'library', icon: 'library', href: '/' },
  { name: 'mylist', icon: 'folderStar', href: '/mylist' },
  { name: 'playlist', icon: 'queue', href: '/playlist' },
  { name: 'offline', icon: 'download', href: offlineHref },
  { name: 'settings', icon: 'settings', href: '/settings' },
];
const STYLES = ['tokens.css', 'base.css', 'shell.css', 'cards.css', 'views.css', 'player.css', 'reader.css', 'desktop.css', 'mobile.css'];
const viewModules = {
  library: () => import('./views/library.js'),
  work: () => import('./views/work.js'),
  collections: () => import('./views/collections.js'),
  offline: () => import('./views/offline.js'),
  settings: () => import('./views/settings.js'),
  reader: () => import('./reader.js'),
  mirror: () => import('./views/mirror.js'),
};

/* ------------------------------------------------------------------ routing */

export function parse(href = location.href) {
  const url = new URL(href, location.href);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const segments = path.split('/').filter(Boolean).map(part => { try { return decodeURIComponent(part); } catch { return part; } });
  const key = url.pathname + url.search + (url.hash === '#dlook-offline' ? url.hash : '');
  const route = { key, path, url, tab: null, depth: 0, name: 'native', params: {} };
  if (path === '/settings' && url.hash === '#dlook-offline') return { ...route, name: 'offline', tab: 'offline' };
  if (path === '/' || path === '/library') return { ...route, name: 'library', tab: 'library', params: { view: 'works' } };
  if (segments[0] === 'library' && ['author', 'voice'].includes(segments[1])) {
    const view = segments[1] === 'author' ? 'circles' : 'voices';
    return segments[2] !== undefined
      ? { ...route, name: 'library', tab: 'library', depth: 1, params: { view, person: segments.slice(2).join('/') } }
      : { ...route, name: 'library', tab: 'library', params: { view } };
  }
  if (segments[0] === 'library' && segments[1] === 'hidden') return { ...route, name: 'library', tab: 'library', depth: 1, params: { view: 'hidden' } };
  if (segments[0] === 'work' && /^(?:RJ|VJ|BJ)\d{6,10}$/.test(segments[1] ?? '')) {
    const workno = segments[1];
    // Folders of one work share a page (key), so browsing them updates it in place.
    if (!segments[2]) return { ...route, key: `/work/${workno}`, name: 'work', tab: 'library', depth: 1, params: { workno, folder: '' } };
    if (segments[2] === 'tree') return { ...route, key: `/work/${workno}`, name: 'work', tab: 'library', depth: 1, params: { workno, folder: segments.slice(3).join('/') } };
    if (segments[2] === 'view' && segments.length > 3) return { ...route, name: 'reader', tab: 'library', depth: 2, params: { workno, path: segments.slice(3).join('/') } };
    return { ...route, tab: 'library', depth: 2 };
  }
  if (['mylist', 'playlist'].includes(segments[0])) {
    const kind = segments[0];
    if (!segments[1]) return { ...route, name: 'collections', tab: kind, params: { kind } };
    if (/^\d+$/.test(segments[1]) && segments.length === 2) return { ...route, name: 'collections', tab: kind, depth: 1, params: { kind, id: segments[1] } };
    return { ...route, tab: kind, depth: 2 };
  }
  if (path === '/settings') return { ...route, name: 'settings', tab: 'settings' };
  // Notifications and help: their content is mirrored into DLook pages (see views/mirror.js).
  if (['notifications', 'help'].includes(segments[0])) return { ...route, name: 'mirror', tab: 'settings', depth: segments.length };
  return route;
}

/** Official full-screen viewers have their own close button; DLook's chrome stays out of the way. */
const isViewer = route => /^\/work\/[^/]+\/(?:view|viewer)\//.test(route?.path ?? '');

/* ------------------------------------------------------------------ platform */

/**
 * iPhone/iPad: env(safe-area-inset-*) is only non-zero with viewport-fit=cover, which the
 * site's viewport meta lacks. Add it (and keep it if the site rewrites <head>).
 */
function enableSafeAreas() {
  const patch = () => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && !/viewport-fit\s*=\s*cover/.test(meta.content)) meta.content = `${meta.content.replace(/,\s*$/, '')}, viewport-fit=cover`;
  };
  patch();
  if (document.head) new MutationObserver(patch).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
}

/* ------------------------------------------------------------------ start */

/**
 * host: the <dlook-next> element. asset(path): URL of a packaged file.
 * styles: optional { 'tokens.css': text, ... } — the Safari userscript inlines its CSS.
 */
export async function start({ host, asset, extension, styles, version = 'dev' }) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const root = document.documentElement;
  await Promise.all(STYLES.map(name => new Promise(resolve => {
    if (styles?.[name] !== undefined) {
      shadow.append(h('style', { text: styles[name] }));
      resolve();
      return;
    }
    const link = h('link', { rel: 'stylesheet', href: asset(`play/styles/${name}`) });
    link.onload = link.onerror = () => resolve(link);
    shadow.append(link);
  })));
  enableSafeAreas();

  const media = matchMedia('(min-width: 860px)');
  const mode = () => media.matches ? 'desktop' : 'mobile';
  const frame = h('div', { class: 'app', 'data-mode': mode() });
  const ambient = h('div', { class: 'ambient', 'aria-hidden': 'true' }, h('i', { class: 'blob a' }), h('i', { class: 'blob b' }), h('i', { class: 'blob c' }), h('div', { class: 'cover-glow' }));
  const stage = h('div', { class: 'stage' });
  const overlays = h('div', { class: 'overlays' });
  const playerRoot = h('div', { class: 'player-root' });
  frame.append(ambient);
  shadow.append(frame);
  kit.init(overlays, mode);

  /* ---------------- theme */
  function applyTheme() {
    const accent = prefs.get('accent');
    const appearance = prefs.get('appearance');
    root.setAttribute('data-dn-accent', accent);
    root.setAttribute('data-dn-appearance', appearance);
    frame.dataset.accent = accent;
    const dark = appearance === 'dark' || (appearance === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    frame.dataset.scheme = dark ? 'dark' : 'light';
  }
  applyTheme();
  const applyMotion = () => frame.toggleAttribute('data-reduce-motion', kit.reducedMotion.matches);
  applyMotion();
  kit.reducedMotion.onChange(applyMotion);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  prefs.onChange(name => { if (name === 'accent' || name === 'appearance') applyTheme(); });

  /* ---------------- navigation chrome */
  const tabControls = new Map();
  const sidebarControls = new Map();
  const sidebarLists = h('div', { class: 'side-lists' });
  const sidebar = h('aside', { class: 'sidebar glass', 'aria-label': t('navigation') },
    h('div', { class: 'brand' }, h('img', { src: asset('dlook-logo.svg'), alt: 'DLook', width: 74, height: 24 }), h('span', { class: 'brand-tag', text: 'Play' })),
    h('nav', { class: 'side-nav' }, TABS.map(tab => {
      const link = h('a', { href: tab.href, class: 'side-item', dataset: { tab: tab.name } }, icon(tab.icon), h('span', { class: 'side-label' }), h('i', { class: 'badge-dot', 'aria-hidden': 'true' }));
      sidebarControls.set(tab.name, link);
      return link;
    })),
    sidebarLists);
  const indicator = h('span', { class: 'tab-indicator', 'aria-hidden': 'true' });
  const tabbar = h('nav', { class: 'tabbar glass', 'aria-label': t('navigation') }, indicator, TABS.map(tab => {
    const link = h('a', { href: tab.href, class: 'tab', dataset: { tab: tab.name } }, h('span', { class: 'tab-icon' }, icon(tab.icon), h('i', { class: 'badge-dot', 'aria-hidden': 'true' })), h('span', { class: 'tab-label' }));
    tabControls.set(tab.name, link);
    return link;
  }));
  const passBar = h('div', { class: 'pass-bar' }, h('button', { type: 'button', class: 'pass-back glass', onclick: () => go('/') }, icon('back'), h('span', { class: 'pass-label' })));
  frame.append(sidebar, stage, tabbar, passBar, playerRoot, overlays);

  function label() {
    for (const tab of TABS) {
      sidebarControls.get(tab.name).querySelector('.side-label').textContent = t(tab.name);
      tabControls.get(tab.name).querySelector('.tab-label').textContent = t(tab.name);
      tabControls.get(tab.name).setAttribute('aria-label', t(tab.name));
    }
    passBar.querySelector('.pass-label').textContent = t('returnToDLook');
    sidebar.setAttribute('aria-label', t('navigation'));
    tabbar.setAttribute('aria-label', t('navigation'));
  }
  label();

  // Sidebar quick access to my lists and playlists (desktop uses the horizontal space).
  function renderSidebarLists() {
    const section = (kind, items) => items?.length ? h('div', { class: 'side-section' },
      h('div', { class: 'side-heading', text: t(kind) }),
      items.slice(0, 8).map(item => h('a', { href: `/${kind}/${item.id}`, class: 'side-sub', title: item.title }, icon(kind === 'mylist' ? 'folder' : 'queue'), h('span', { text: item.title })))) : null;
    clear(sidebarLists, section('mylist', state.get('mylist')), section('playlist', state.get('playlist')));
  }
  state.on('mylist', renderSidebarLists);
  state.on('playlist', renderSidebarLists);

  function setActiveTab(name) {
    for (const [tab, link] of [...tabControls, ...sidebarControls]) {
      if (tab === name) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const index = TABS.findIndex(tab => tab.name === name);
    indicator.style.opacity = index < 0 ? '0' : '1';
    if (index >= 0) indicator.style.transform = `translateX(${index * 100}%)`;
  }

  /* ---------------- app context shared with views */
  const bus = new EventTarget();
  const app = {
    asset, extension, version, frame, stage, shadow, state, native, unread: false,
    mode,
    go, back, replace: href => go(href, { replace: true }),
    on: (name, listener) => { const wrapped = () => listener(); bus.addEventListener(name, wrapped); return () => bus.removeEventListener(name, wrapped); },
    emit: name => bus.dispatchEvent(new Event(name)),
    /** Steps aside for the official screen at the current URL (e.g. its protected comic viewer). */
    showNative() {
      frame.toggleAttribute('data-pass-viewer', isViewer(currentRoute ?? parse()));
      root.setAttribute('data-dn-pass', '');
      frame.setAttribute('data-pass', '');
      frame.removeAttribute('data-immersive');
    },
    setGlow(url) {
      const glow = ambient.querySelector('.cover-glow');
      if (url) { glow.style.backgroundImage = `url(${JSON.stringify(url)})`; glow.setAttribute('data-on', ''); }
      else glow.removeAttribute('data-on');
    },
  };
  app.player = createPlayer(app, playerRoot);

  native.watchUnread(unread => {
    for (const link of [tabControls.get('settings'), sidebarControls.get('settings')]) {
      link.toggleAttribute('data-unread', unread);
      if (unread) link.setAttribute('title', `${t('settings')} · ${t('unread')}`); else link.removeAttribute('title');
    }
    app.unread = unread;
    app.emit('unread');
  });


  /* ---------------- document title */
  // The native app keeps rewriting <title> for the screen underneath; keep DLook's.
  let wantedTitle = document.title;
  function setTitle(value) { wantedTitle = value; if (document.title !== value) document.title = value; }
  new MutationObserver(() => {
    if (!root.hasAttribute('data-dn-pass') && document.title !== wantedTitle) document.title = wantedTitle;
  }).observe(document.head ?? root, { childList: true, subtree: true, characterData: true });

  /* ---------------- views */
  const cache = new Map();   // route.key -> controller
  let current, currentRoute, renderToken = 0, ignorePop = false;

  async function controllerFor(route) {
    const cached = cache.get(route.key);
    if (cached && !cached.stale) { cache.delete(route.key); cache.set(route.key, cached); return cached; }
    const module = await viewModules[route.name]();
    const controller = await module.create(app, route);
    controller.node.classList.add('view', `view-${route.name}`);
    cache.set(route.key, controller);
    // Keep tab roots plus a few recent pages ready for instant back navigation.
    const keep = new Set([...cache.keys()].slice(-8));
    for (const [key, entry] of cache) {
      if (keep.has(key) || entry === current) continue;
      entry.destroy?.();
      cache.delete(key);
    }
    return controller;
  }

  async function render(route, { direction = 'auto' } = {}) {
    const token = ++renderToken;
    const previousRoute = currentRoute;
    currentRoute = route;
    setActiveTab(route.tab);
    const pass = route.name === 'native';
    root.toggleAttribute('data-dn-pass', pass);
    frame.toggleAttribute('data-pass', pass);
    frame.toggleAttribute('data-pass-viewer', pass && isViewer(route));
    if (pass) {
      current?.hide?.();
      if (current) { current.node.remove(); current = undefined; }
      app.emit('route');
      return;
    }
    let controller;
    try {
      controller = await controllerFor(route);
    } catch (error) {
      console.error('[DLook Next] view failed', error);
      if (token !== renderToken) return;
      root.setAttribute('data-dn-pass', '');
      frame.setAttribute('data-pass', '');
      return;
    }
    if (token !== renderToken) return;
    if (controller.passthrough) {
      frame.toggleAttribute('data-pass-viewer', isViewer(route));
      // The view decided this page needs the official screen (e.g. protected pages).
      cache.delete(route.key);
      root.setAttribute('data-dn-pass', '');
      frame.setAttribute('data-pass', '');
      if (current) { current.hide?.(); current.node.remove(); current = undefined; }
      return;
    }
    const previous = current;
    current = controller;
    frame.toggleAttribute('data-immersive', Boolean(controller.immersive));
    if (direction === 'auto') {
      direction = !previousRoute ? 'none' : previousRoute.tab !== route.tab ? 'fade'
        : route.depth > previousRoute.depth ? 'push' : route.depth < previousRoute.depth ? 'pop' : 'fade';
    }
    controller.update?.(route);
    if (previous === controller) { app.emit('route'); return; }
    stage.append(controller.node);
    controller.show?.();
    if (controller.scrollTop !== undefined && controller.scroller) controller.scroller.scrollTop = controller.scrollTop;
    transition(previous, controller, direction);
    app.emit('route');
    root.removeAttribute('data-dn-booting');
    setTitle(controller.title ? `${controller.title} · DLsite Play` : 'DLsite Play');
  }

  function transition(previous, next, direction) {
    const out = previous?.node;
    const into = next.node;
    if (out && previous.scroller) previous.scrollTop = previous.scroller.scrollTop;
    const done = () => { if (out && current?.node !== out) { previous.hide?.(); out.remove(); } };
    if (!out || direction === 'none' || kit.reducedMotion.matches) { done(); return; }
    const mobile = mode() === 'mobile';
    // Pages are transparent glass over the ambient background, so two pages must never be
    // visible at once: the outgoing page fades out quickly, then the incoming one slides in.
    const shift = mobile ? 56 : 28;
    const frames = {
      push: [[{ opacity: 0, transform: `translateX(${shift}px)` }, { opacity: 1, transform: 'none' }],
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-shift / 2}px) scale(.985)` }]],
      pop: [[{ opacity: 0, transform: `translateX(${-shift}px)` }, { opacity: 1, transform: 'none' }],
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${shift / 2}px) scale(.985)` }]],
      fade: [[{ opacity: 0, transform: 'scale(.99)' }, { opacity: 1, transform: 'none' }], [{ opacity: 1 }, { opacity: 0 }]],
    }[direction] ?? null;
    if (!frames) { done(); return; }
    out.classList.add('leaving');
    const outDuration = direction === 'fade' ? 120 : 150;
    const b = out.animate(frames[1], { duration: outDuration, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    const a = into.animate(frames[0], { duration: direction === 'fade' ? 260 : mobile ? 420 : 360, delay: outDuration - 30, easing: kit.spring, fill: 'backwards' });
    Promise.allSettled([a.finished, b.finished]).then(() => {
      out.classList.remove('leaving');
      b.cancel();
      done();
    });
  }

  function go(href, { replace = false } = {}) {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) { window.open(url.href, '_blank', 'noopener'); return; }
    const route = parse(url.href);
    ignorePop = true;
    try { native.pushRoute(url.href, { replace }); } finally { ignorePop = false; }
    if (route.key === currentRoute?.key && route.name !== 'native' && current) {
      const samePage = route.url.href === currentRoute.url.href;
      currentRoute = route;
      current.update?.(route);
      if (samePage) current.scroller?.scrollTo({ top: 0, behavior: 'smooth' });
      app.emit('route');
      return;
    }
    render(route);
  }

  function back(fallback = '/') {
    if (Number.isInteger(history.state?.idx) && history.state.idx > 0) history.back();
    else go(fallback, { replace: true });
  }

  function follow(direction) {
    const route = parse();
    if (currentRoute && route.url.href === currentRoute.url.href) return;
    if (current && route.key === currentRoute?.key && route.name !== 'native') {
      currentRoute = route;
      current.update?.(route);
      app.emit('route');
      return;
    }
    render(route, { direction });
  }
  window.addEventListener('popstate', () => { if (!ignorePop) follow('auto'); });
  // The native app may redirect on its own (e.g. /work/x/tree → /work/x); follow it.
  const followNative = () => follow('fade');
  if (window.navigation?.addEventListener) window.navigation.addEventListener('currententrychange', () => queueMicrotask(followNative));
  else setInterval(followNative, 400);

  // In-app links (sidebar, tab bar, cards) navigate without reloading.
  shadow.addEventListener('click', event => {
    const link = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    const tab = TABS.find(entry => entry.name === link.dataset.tab);
    // Re-selecting the current tab scrolls to the top or returns to the tab root.
    if (tab && currentRoute?.tab === tab.name) {
      if (currentRoute.depth > 0) go(tab.href);
      else current?.scroller?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (tab) {
      // Restore the last page visited inside that tab.
      const remembered = tabMemory.get(tab.name);
      go(remembered ?? tab.href);
      return;
    }
    go(url.href);
  });
  const tabMemory = new Map();
  app.on('route', () => { if (currentRoute?.tab && currentRoute.name !== 'native') tabMemory.set(currentRoute.tab, currentRoute.url.pathname + currentRoute.url.search + (currentRoute.name === 'offline' ? '#dlook-offline' : '')); });

  // Layout mode switch (window resize / rotation): rebuild views for the new layout.
  media.addEventListener('change', () => {
    frame.dataset.mode = mode();
    for (const entry of cache.values()) { if (entry !== current) entry.destroy?.(); }
    for (const key of [...cache.keys()]) if (cache.get(key) !== current) cache.delete(key);
    if (current) { current.stale = true; const route = currentRoute; currentRoute = undefined; current.node.remove(); current.destroy?.(); cache.delete(route.key); current = undefined; render(route, { direction: 'none' }); }
    app.emit('mode');
  });

  // Language follows the site; it can change when the person switches it in DLsite Play.
  new MutationObserver(() => setLanguage(detect())).observe(root, { attributes: true, attributeFilter: ['lang'] });
  onLanguage(() => {
    label();
    for (const [key, entry] of cache) { if (entry !== current) { entry.destroy?.(); cache.delete(key); } }
    if (current && currentRoute) { const route = currentRoute; current.stale = true; cache.delete(route.key); current.node.remove(); current = undefined; currentRoute = undefined; render(route, { direction: 'none' }); }
  });

  // Keyboard: "/" focuses search, Escape backs out of detail pages on desktop.
  document.addEventListener('keydown', event => {
    const typing = event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)));
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === '/' && current?.focusSearch) { event.preventDefault(); current.focusSearch(); }
  });

  // Warm caches in the background: library, lists, hidden works, activity.
  state.loadLibrary().catch(() => {});
  state.loadCollections('mylist').catch(() => {});
  state.loadCollections('playlist').catch(() => {});
  state.loadHidden().catch(() => {});
  state.loadActivity().catch(() => {});
  state.loadHistory().catch(() => {});
  window.addEventListener('focus', () => { state.loadActivity().catch(() => {}); });
  window.addEventListener('online', () => app.emit('network'));
  window.addEventListener('offline', () => app.emit('network'));

  await render(parse(), { direction: 'none' });
  root.removeAttribute('data-dn-booting');
  return app;
}
