// Bridge to the native DLsite Play app that keeps running underneath DLook Next.
// Ported from chrome-extension/play-site.js: account actions are performed by the site itself.

const action = name => `[data-dd-action-name="${name}"]`;
const targets = {
  library: action('menu.library'),
  sync: action('menu.sync_library'),
  dlsite: action('menu.dlsite'),
  help: action('menu.help'),
  logout: action('menu.logout'),
  notifications: [action('menu.notification'), action('notification.menu_unread')].join(','),
};
const hamburger = action('menu.hamburger_open');
const drawer = `[role="dialog"][data-open]:has(${action('menu.header_close')})`;

export const available = () => Boolean(document.querySelector('#App > .loContainer'));

function layout() {
  const container = document.querySelector('#App > .loContainer');
  const main = container?.querySelector(':scope > main');
  return container && main ? { container, main } : null;
}

function waitFor(selector, timeout = 1200) {
  const current = document.querySelector(selector);
  if (current) return Promise.resolve(current);
  return new Promise(resolve => {
    const finish = value => { observer.disconnect(); clearTimeout(timer); resolve(value); };
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) finish(found);
    });
    const timer = setTimeout(() => finish(null), timeout);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-open'] });
  });
}

/** Clicks the site's own menu entry (desktop sidebar or the mobile drawer). */
export async function activate(name) {
  const page = layout();
  if (!page) return false;
  const selector = targets[name];
  const desktop = page.container.querySelector(selector);
  if (desktop) {
    desktop.click();
    return true;
  }
  const opener = page.main.querySelector(hamburger);
  if (!opener) return false;
  if (!document.querySelector(drawer)) opener.click();
  const panel = await waitFor(drawer);
  const control = panel?.querySelector(selector);
  control?.click();
  if (panel && (!control || ['sync', 'logout', 'dlsite'].includes(name))) opener.click();
  return Boolean(control);
}

/** Lets a native confirmation (e.g. logout) appear above DLook until it closes. */
export async function withNativeDialog(run) {
  const root = document.documentElement;
  root.setAttribute('data-dn-native-dialog', '');
  try {
    const started = await run();
    if (!started) return false;
    const selector = '[role="alertdialog"], [role="dialog"]:not(:has([data-dd-action-name="menu.header_close"]))';
    const open = () => [...document.querySelectorAll(selector)].some(node => node.getClientRects().length && !node.closest('dlook-next'));
    // Wait for the dialog to appear (briefly), then until the person closes it.
    const appeared = await new Promise(resolve => {
      const started = performance.now();
      const tick = () => open() ? resolve(true) : performance.now() - started > 1500 ? resolve(false) : setTimeout(tick, 100);
      tick();
    });
    if (appeared) await new Promise(resolve => { const tick = () => open() ? setTimeout(tick, 250) : resolve(); tick(); });
    return true;
  } finally {
    root.removeAttribute('data-dn-native-dialog');
  }
}

export function hasUnread() {
  const page = layout();
  if (!page) return false;
  return Boolean(page.main.querySelector(`${hamburger} [aria-label]`) || page.container.querySelector(action('notification.menu_unread')));
}

/** Calls `listener(unread)` whenever the native unread marker changes. */
export function watchUnread(listener) {
  let last;
  const check = () => {
    const unread = hasUnread();
    if (unread !== last) { last = unread; listener(unread); }
  };
  const observer = new MutationObserver(() => queueMicrotask(check));
  const attach = () => {
    const app = document.querySelector('#App');
    if (app) observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'data-dd-action-name'] });
    else setTimeout(attach, 500);
  };
  attach();
  check();
  return () => observer.disconnect();
}

/**
 * Same-document navigation that the native React Router also follows, so the site's own
 * screen underneath (and its session state) always matches the URL DLook shows.
 */
export function pushRoute(href, { replace = false } = {}) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin) { location.assign(url); return; }
  if (url.href === location.href) return;
  const idx = Number.isInteger(history.state?.idx) ? history.state.idx + (replace ? 0 : 1) : 0;
  const state = { usr: null, key: Math.random().toString(36).slice(2, 10), idx };
  if (replace) history.replaceState(state, '', url);
  else history.pushState(state, '', url);
  // React Router listens to popstate; this keeps the native screen in sync.
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}
