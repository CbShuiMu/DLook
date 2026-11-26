const DLookPlayWork = (() => {
  let active, menu, pane, scheduled, favoriteWork, favoriteLookup, refreshFavorite;
  const observer = new ResizeObserver(schedule);
  const shareSelector = '[data-dd-action-name="work_detail.share_open"]';
  const favoriteSelector = '[data-dd-action-name="mylist.header_add"]';
  // Native items that only appear in the work page's "more" menu.
  const workMenuSelector = '[role="menu"]:has([data-dd-action-name="work_detail.ignore_hide"])';
  const heartPath = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09' +
    'C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

  // Sharing moves from the header into the "more" menu; the hidden header button still opens the dialog.
  function shareItem(page) {
    const share = page.main.querySelector(shareSelector);
    const list = document.querySelector(workMenuSelector);
    if (!share || !list || list.querySelector('[data-dlook-share]')) return;
    const native = list.querySelector('[role="menuitem"]');
    const item = document.createElement('div');
    item.setAttribute('role', 'menuitem');
    item.tabIndex = -1;
    item.className = native?.className ?? '';
    item.dataset.dlookShare = '';
    const icon = native?.querySelector(':scope > span')?.cloneNode(false) ?? document.createElement('span');
    const graphic = share.querySelector('svg')?.cloneNode(true);
    if (graphic) icon.append(graphic);
    item.append(icon, share.getAttribute('aria-label') || 'Share');
    const activate = () => {
      // The menu trigger toggles the native menu closed before the share dialog opens.
      if (list.isConnected) page.pane.querySelector('[data-dd-action-name="work_detail.menu_open"]')?.click();
      requestAnimationFrame(() => share.click());
    };
    item.addEventListener('click', activate);
    item.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activate();
    });
    list.prepend(item);
  }

  // A work counts as a favorite once it belongs to any of the user's lists.
  function favorite(page) {
    const control = page.main.querySelector(favoriteSelector);
    const workno = location.pathname.match(/^\/work\/((?:RJ|VJ|BJ)\d{6,10})/)?.[1];
    if (!control || !workno) return;
    if (!control.querySelector(':scope > [data-dlook-heart]')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.dataset.dlookHeart = '';
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', heartPath);
      svg.append(path);
      control.append(svg);
      // The list picker changes membership, so read the lists again once it closes.
      control.addEventListener('click', () => { refreshFavorite = true; });
    }
    if (refreshFavorite && !document.querySelector('[role="dialog"]')) {
      refreshFavorite = false;
      DLookPlaySite.forget('mylists');
    }
    const lookup = DLookPlaySite.cache('mylists', async () => {
      const response = await fetch('/api/mylists', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Could not load lists');
      return response.json();
    }, 20000);
    if (lookup === favoriteLookup && workno === favoriteWork) return;
    favoriteLookup = lookup;
    favoriteWork = workno;
    lookup.then(data => {
      if (favoriteLookup !== lookup || !control.isConnected) return;
      const saved = Array.isArray(data?.mylists) &&
        data.mylists.some(list => Array.isArray(list?.data) && list.data.includes(workno));
      control.toggleAttribute('data-dlook-favorite', saved);
    }).catch(() => {});
  }

  function positionTools() {
    if (!active || !menu?.isConnected) return;
    const frame = active.getBoundingClientRect();
    const anchor = menu.getBoundingClientRect();
    active.style.setProperty('--dlook-work-tools-top', `${anchor.bottom - frame.top + 6}px`);
    active.style.setProperty('--dlook-work-tools-end', `${frame.right - anchor.right}px`);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      positionTools();
    });
  }

  function update(page) {
    const next = page?.pane.querySelector('[data-dd-action-name="work_detail.menu_open"]');
    if (next !== menu) {
      observer.disconnect();
      pane?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      active?.removeAttribute('data-dlook-work');
      active?.style.removeProperty('--dlook-work-tools-top');
      active?.style.removeProperty('--dlook-work-tools-end');
      menu = next;
      active = next ? page.main : undefined;
      pane = next ? page.pane : undefined;
      if (active) {
        active.setAttribute('data-dlook-work', '');
        observer.observe(menu.closest('[class*="_contentMain_"]') ?? menu.parentElement);
        pane.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
      }
    }
    positionTools();
    if (active) {
      shareItem(page);
      favorite(page);
    }
  }

  return { update };
})();
