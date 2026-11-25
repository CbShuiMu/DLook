(() => {
  const tabs = { library: '/', mylist: '/mylist', playlist: '/playlist', offline: DLookOffline.href, settings: '/settings' };
  const actions = {
    sync: null,
    dlsite: 'https://www.dlsite.com/home-touch/mypage',
    help: '/help',
    notifications: '/notifications',
    logout: null,
  };
  const labels = {
    'zh-cn': {
      navigation: 'DLsite Play 导航', library: '媒体库', mylist: '我的列表', playlist: '播放列表', settings: '设置',
      sync: '同步', dlsite: '返回DL', help: '帮助', notifications: '通知', logout: '登出',
      unread: '有未读通知', syncRequested: '已请求同步媒体库。', failed: '操作未能启动，请重试。',
    },
    'zh-tw': {
      navigation: 'DLsite Play 導覽', library: '媒體庫', mylist: '我的清單', playlist: '播放清單', settings: '設定',
      sync: '同步', dlsite: '返回DL', help: '說明', notifications: '通知', logout: '登出',
      unread: '有未讀通知', syncRequested: '已要求同步媒體庫。', failed: '無法啟動操作，請再試一次。',
    },
    ja: {
      navigation: 'DLsite Play ナビゲーション', library: 'ライブラリ', mylist: 'マイリスト', playlist: 'プレイリスト', settings: '設定',
      sync: '同期', dlsite: 'DLsiteへ', help: 'ヘルプ', notifications: 'お知らせ', logout: 'ログアウト',
      unread: '未読のお知らせがあります', syncRequested: '同期をリクエストしました。',
      failed: '操作を開始できませんでした。もう一度お試しください。',
    },
    en: {
      navigation: 'DLsite Play navigation', library: 'Library', mylist: 'My lists', playlist: 'Playlists', settings: 'Settings',
      sync: 'Sync', dlsite: 'DLsite', help: 'Help', notifications: 'Notices', logout: 'Log out',
      unread: 'Unread notifications', syncRequested: 'Library sync requested.', failed: 'Could not start this action. Try again.',
    },
    ko: {
      navigation: 'DLsite Play 탐색', library: '라이브러리', mylist: '내 목록', playlist: '재생 목록', settings: '설정',
      sync: '동기화', dlsite: 'DLsite로', help: '도움말', notifications: '알림', logout: '로그아웃',
      unread: '읽지 않은 알림', syncRequested: '라이브러리 동기화를 요청했습니다.',
      failed: '작업을 시작할 수 없습니다. 다시 시도해 주세요.',
    },
  };
  const nav = document.createElement('nav');
  nav.className = 'dlook-play-nav';
  nav.hidden = true;
  const tabList = document.createElement('ul');
  const indicator = document.createElement('li');
  indicator.className = 'dlook-play-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  tabList.append(indicator);
  nav.append(tabList);
  const slideDuration = 240;
  nav.style.setProperty('--dlook-tab-slide', `${slideDuration}ms`);

  const settings = document.createElement('section');
  settings.className = 'dlook-play-settings';
  const heading = document.createElement('h2');
  heading.textContent = 'DLsite Play';
  const actionList = document.createElement('ul');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  settings.append(heading, actionList, status);

  let copy, locale, activeLayout, scheduled, handling, pendingTab, queuedTab;
  const motion = DLookPlayMotion.create(schedule);

  function routeFor(href = location.href) {
    const url = new URL(href, location.href);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const offline = url.pathname + url.hash === DLookOffline.href;
    const section = path.split('/')[1];
    const tab = offline ? 'offline' : ['', 'library', 'series', 'work'].includes(section) ? 'library' :
      ['help', 'notifications'].includes(section) ? 'settings' : section;
    // Leave standalone readers, account screens and admin mode in their native layouts.
    const supported = url.origin === location.origin && Object.hasOwn(tabs, tab) &&
      !/^\/work\/[^/]+\/(?:view|viewer)(?:\/|$)/.test(path);
    return { key: offline ? DLookOffline.href : path, path, tab, supported, offline };
  }

  function ordinaryClick(event) {
    return !event.defaultPrevented && !event.button && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
  }

  function moveIndicator(name) {
    const index = tabItems.findIndex(item => item.name === name);
    if (index >= 0 && indicator.dataset.tab !== name) {
      indicator.style.transform = `translateX(${index * 100}%)`;
      indicator.dataset.tab = name;
    }
  }

  function addItems(list, items, isTab) {
    return Object.entries(items).map(([name, href]) => {
      const item = document.createElement('li');
      const control = document.createElement(href ? 'a' : 'button');
      const label = document.createElement('span');
      if (href) control.href = href;
      else control.type = 'button';
      control.append(DLookPlayIcons.create(name), label);
      item.append(control);
      list.append(item);

      async function activate() {
        if (handling) {
          if (isTab) queuedTab = activate;
          return;
        }
        if (isTab && control.getAttribute('aria-current') === 'page' && control.href === location.href) return;
        handling = true;
        const from = location.href;
        const started = performance.now();
        if (isTab) {
          pendingTab = { name, from };
          moveIndicator(name);
        }
        const transition = href ? motion.begin(routeFor(href), true) : null;
        try {
          if (transition && !await transition.start) return;
          if (location.href !== from) return;
          if (href && DLookPlaySite.navigate(href)) {
            await transition?.done;
            return;
          }
          const activated = name !== 'offline' && !DLookOffline.isOpen() && await DLookPlaySite.activate(name);
          if (!activated && href) {
            // Keep the slide visible before a route that requires a new document.
            if (isTab && !transition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
              const remaining = slideDuration - (performance.now() - started);
              if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
            }
            if (location.href === from) location.assign(href);
          }
          else if (!href) status.textContent = activated ? (name === 'sync' ? copy.syncRequested : '') : copy.failed;
          await transition?.done;
        } finally {
          if (isTab && pendingTab?.from === from && location.href === from) {
            pendingTab = undefined;
            schedule();
          }
          handling = false;
          const next = queuedTab;
          queuedTab = undefined;
          next?.();
        }
      }

      control.addEventListener('click', event => {
        if (!ordinaryClick(event)) return;
        event.preventDefault();
        void activate();
      });
      return { name, control, label };
    });
  }

  const tabItems = addItems(tabList, tabs, true);
  const actionItems = addItems(actionList, actions);

  function render() {
    scheduled = false;
    const route = routeFor();
    const { path, offline, tab, supported } = route;
    const layout = supported ? DLookPlaySite.layout() : null;
    if (!motion.ready(route, layout)) return;
    const page = offline ? null : layout;
    const showNav = Boolean(page || offline || (supported && nav.isConnected && !nav.hidden));
    if (activeLayout !== page?.container) {
      activeLayout?.removeAttribute('data-dlook-play');
      activeLayout = page?.container;
    }
    document.documentElement.toggleAttribute('data-dlook-play', showNav);
    document.documentElement.toggleAttribute('data-dlook-offline', offline);
    if (!offline) DLookOffline.hide(showNav, page?.container);
    const language = document.documentElement.lang.toLowerCase().replaceAll('_', '-');
    DLookPlayLibrary.update(page, path, language);
    DLookPlayPlayer.update(layout?.container);
    DLookOffline.updateWork(page, path, language);
    DLookPlayCollections.update(page, path, language);
    nav.hidden = !showNav;
    if (!showNav) {
      pendingTab = undefined;
      settings.remove();
      motion.present(route, layout);
      return;
    }
    if (nav.parentElement !== document.body) document.body.append(nav);

    if (language !== locale) {
      locale = language;
      copy = labels[language] ?? labels[language.split('-')[0]] ?? labels.en;
      nav.setAttribute('aria-label', copy.navigation);
      for (const { name, label } of [...tabItems, ...actionItems]) {
        label.textContent = name === 'offline' ? DLookOffline.label(language) : copy[name];
      }
    }
    const unread = page && DLookPlaySite.hasUnreadNotifications(page);
    if (pendingTab && pendingTab.from !== location.href) pendingTab = undefined;
    moveIndicator(pendingTab?.name ?? tab);
    for (const { name, control } of tabItems) {
      if (name === tab) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
      if (name === 'settings') {
        control.toggleAttribute('data-unread', unread);
        const label = `${copy.settings}, ${copy.unread}`;
        if (unread && control.getAttribute('aria-label') !== label) control.setAttribute('aria-label', label);
        if (!unread) control.removeAttribute('aria-label');
      }
    }
    if (offline) {
      settings.remove();
      DLookOffline.show(language);
      motion.present(route, layout);
      return;
    }
    if (!page) {
      settings.remove();
      motion.present(route, layout);
      return;
    }
    page.container.setAttribute('data-dlook-play', '');
    if (path === '/settings') {
      if (settings.parentElement !== page.pane) {
        status.textContent = '';
        page.pane.prepend(settings);
      }
    } else settings.remove();
    motion.present(route, layout);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(render);
  }

  function onHistoryChange() {
    motion.historyChanged(routeFor());
    schedule();
  }

  motion.begin(routeFor());
  new MutationObserver(schedule).observe(document, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['lang', 'data-dd-action-name', 'aria-label', 'data-active', 'aria-busy'],
  });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  document.addEventListener('click', event => {
    if (!ordinaryClick(event) || handling) return;
    const link = event.target.closest?.('#App a[href]:not([download])');
    if (link && (!link.target || link.target === '_self')) motion.begin(routeFor(link.href));
  }, true);
  window.addEventListener('popstate', onHistoryChange);
  window.addEventListener('hashchange', onHistoryChange);
  render();
})();
