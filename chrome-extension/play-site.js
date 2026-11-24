const DLookPlaySite = (() => {
  const action = name => `[data-dd-action-name="${name}"]`;
  const targets = {
    library: action('menu.library'),
    mylist: action('menu.mylist'),
    playlist: action('menu.playlist'),
    settings: action('menu.setting'),
    sync: action('menu.sync_library'),
    dlsite: action('menu.dlsite'),
    help: action('menu.help'),
    logout: action('menu.logout'),
    notifications: [action('menu.notification'), action('notification.menu_unread')].join(','),
  };
  const hamburger = action('menu.hamburger_open');
  const drawer = `[role="dialog"][data-open]:has(${action('menu.header_close')})`;
  const cached = new Map();

  function navigate(href) {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || !Number.isInteger(history.state?.idx)) return false;
    if (url.href === location.href) return true;
    // React Router uses the history entry's index and key to handle same-document POP navigation.
    const state = { usr: null, key: crypto.randomUUID(), idx: history.state.idx + 1 };
    history.pushState(state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
    return true;
  }

  function cache(key, load, ttl = 60000) {
    const previous = cached.get(key);
    if (previous && previous.expires > Date.now()) return previous.value;
    if (cached.size >= 96) cached.delete(cached.keys().next().value);
    const entry = { expires: Date.now() + ttl };
    entry.value = Promise.resolve().then(load).catch(error => {
      if (cached.get(key) === entry) cached.delete(key);
      throw error;
    });
    cached.set(key, entry);
    return entry.value;
  }

  function clearCache() { cached.clear(); }

  function layout() {
    const container = document.querySelector('#App > .loContainer');
    const main = container?.querySelector(':scope > main');
    const pane = main?.querySelector('[data-content-pane="true"]');
    if (pane) return { container, main, pane };
  }

  function waitForDrawer() {
    const current = document.querySelector(drawer);
    if (current) return Promise.resolve(current);
    return new Promise(resolve => {
      const finish = panel => {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(panel);
      };
      const observer = new MutationObserver(() => {
        const panel = document.querySelector(drawer);
        if (panel) finish(panel);
      });
      const timeout = setTimeout(() => finish(null), 1000);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-open'] });
    });
  }

  async function activate(name) {
    const page = layout();
    if (!page) return false;
    const selector = targets[name];
    if (name === 'sync' || name === 'logout') clearCache();
    const desktop = page.container.querySelector(selector);
    if (desktop) {
      desktop.click();
      return true;
    }

    const opener = page.main.querySelector(hamburger);
    if (!opener) return false;
    // The mobile menu mounts its controls only while its drawer is open.
    if (!document.querySelector(drawer)) opener.click();
    const panel = await waitForDrawer();
    const control = panel?.querySelector(selector);
    control?.click();
    // React Router links close the drawer themselves. Use the hamburger for
    // logout so the site's own confirmation stays open when the drawer closes.
    if (panel && (!control || ['sync', 'logout', 'dlsite'].includes(name))) opener.click();
    return Boolean(control);
  }

  function hasUnreadNotifications(page) {
    const headerMarker = page.main.querySelector(`${hamburger} [aria-label]`);
    return Boolean(headerMarker || page.container.querySelector(action('notification.menu_unread')));
  }

  function csrfHeaders() {
    const headers = new Headers();
    const token = /(?:^|;\s*)XSRF-TOKEN=([^;]+)/.exec(document.cookie)?.[1];
    if (token) {
      try { headers.set('X-XSRF-TOKEN', decodeURIComponent(token)); } catch {}
    }
    return headers;
  }

  async function createCollection(kind, title) {
    const headers = csrfHeaders();
    headers.set('Content-Type', 'application/json');
    const response = await fetch(kind === 'mylist' ? '/api/mylists' : '/api/playlists', {
      method: 'POST', credentials: 'same-origin', redirect: 'error', headers, body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new Error('Could not create the collection');
    clearCache();
  }

  return { layout, activate, hasUnreadNotifications, navigate, cache, clearCache, csrfHeaders, createCollection };
})();
