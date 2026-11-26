const DLookPlayCollections = (() => {
  const copy = {
    zh: ['播放全部', '随机播放', count => `${count} 部作品`],
    'zh-tw': ['播放全部', '隨機播放', count => `${count} 部作品`],
    ja: ['すべて再生', 'シャッフル', count => `${count} 作品`],
    ko: ['모두 재생', '셔플 재생', count => `작품 ${count}개`],
    en: ['Play all', 'Shuffle', count => `${count} ${count === 1 ? 'work' : 'works'}`],
  };
  const createCopy = {
    zh: ['新建我的列表', '新建播放列表', '列表名称', '取消', '创建', '创建失败，请重试。'],
    'zh-tw': ['新增我的清單', '新增播放清單', '清單名稱', '取消', '建立', '建立失敗，請再試一次。'],
    ja: ['マイリストを作成', 'プレイリストを作成', 'リスト名', 'キャンセル', '作成', '作成できませんでした。もう一度お試しください。'],
    ko: ['내 목록 만들기', '재생 목록 만들기', '목록 이름', '취소', '만들기', '목록을 만들 수 없습니다. 다시 시도해 주세요.'],
    en: ['Create a list', 'Create a playlist', 'List name', 'Cancel', 'Create', 'Could not create the list. Try again.'],
  };
  const trackSelector = '[data-dd-action-name="playlist.detail_item"]';
  const shuffleSelector = 'button[data-dd-action-name="player.shuffle"]';
  const mylistItemSelector = '[data-dd-action-name="mylist.detail_item"]';
  const guardedPanes = new WeakSet();
  const takeoverPanes = new WeakSet();
  let activePane, request, counts, actions, pendingOrder, createLabels, language, prepared, bypass;

  function loadCollections(kind) {
    return DLookPlaySite.cache(kind === 'mylist' ? 'mylists' : 'playlists', async () => {
      const response = await fetch(kind === 'mylist' ? '/api/mylists' : '/api/playlists', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Could not load collections');
      return response.json();
    }, 20000);
  }

  // Resolves the open list into queue entries and counts its locally saved tracks.
  function prepare(pane, mode) {
    const kind = mode.split('-')[0];
    const id = location.pathname.split('/').at(-1);
    const lookup = loadCollections(kind);
    if (prepared?.pane === pane && prepared.lookup === lookup && prepared.id === id) return;
    const current = { pane, lookup, id, kind, entries: null, cached: 0 };
    prepared = current;
    lookup.then(async data => {
      const list = (kind === 'mylist' ? data?.mylists : data?.playlists)?.find(entry => String(entry?.id) === id);
      if (!Array.isArray(list?.data)) return;
      const entries = kind === 'mylist' ?
        list.data.filter(workno => typeof workno === 'string').map(workno => ({ workno })) :
        list.data.filter(track => typeof track?.workno === 'string' && typeof track.src === 'string')
          .map(track => ({ workno: track.workno, path: track.src }));
      const cached = kind === 'playlist' ? await DLookOffline.cachedTracks(entries) : 0;
      if (prepared !== current) return;
      current.entries = entries;
      current.cached = cached;
    }).catch(() => {});
  }

  function startQueue(options) {
    const entries = prepared?.entries;
    if (!entries?.length) return Promise.resolve(false);
    return DLookOffline.playQueue(language, entries, { returnHref: location.pathname, ...options }).catch(() => false);
  }

  // Playlist rows play through the DLook player once any of their tracks is saved locally.
  function takeOverTracks(pane) {
    if (takeoverPanes.has(pane)) return;
    takeoverPanes.add(pane);
    pane.addEventListener('click', event => {
      const row = event.target.closest(trackSelector);
      if (!row || bypass === row || row.hasAttribute('data-editing') || event.target.closest('button, [class*="_handleSort_"]')) return;
      const rows = [...pane.querySelectorAll(trackSelector)];
      if (prepared?.pane !== pane || !prepared.cached || rows.length !== prepared.entries.length) return;
      event.preventDefault();
      event.stopPropagation();
      startQueue({ index: rows.indexOf(row), requireCache: true }).then(started => {
        if (started || !row.isConnected) return;
        bypass = row;
        try { row.click(); } finally { bypass = undefined; }
      });
    }, true);
  }

  function guardEditingItems(pane) {
    if (guardedPanes.has(pane)) return;
    guardedPanes.add(pane);
    pane.addEventListener('click', event => {
      const row = event.target.closest('li[data-editing="true"][data-dd-action-name$=".detail_item"]');
      if (!row || event.target.closest('button, [class*="_handleSort_"]')) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  function collectionMode(path) {
    const match = /^\/(mylist|playlist)(?:\/\d+)?$/.exec(path);
    if (match) return path === `/${match[1]}` ? `${match[1]}-index` : `${match[1]}-detail`;
  }

  function countPlaylistWorks(pane, labels) {
    const cards = pane.querySelectorAll('a[data-dd-action-name="playlist.card"]');
    if (cards.length && !request) {
      const lookup = loadCollections('playlist');
      request = lookup;
      lookup.then(data => {
        if (activePane !== pane || request !== lookup || !Array.isArray(data?.playlists)) return;
        counts = new Map();
        for (const entry of data.playlists) {
          if (!Array.isArray(entry?.data) || !entry.data.every(track => typeof track?.workno === 'string')) continue;
          counts.set(String(entry.id), new Set(entry.data.map(track => track.workno)).size);
        }
        countPlaylistWorks(pane, labels);
      }).catch(() => {});
    }
    if (!counts) return;
    for (const card of cards) {
      const count = counts.get(card.pathname.split('/').at(-1));
      const text = card.querySelector('[class*="_text_"]:has(> p + p)');
      if (count === undefined || !text) continue;
      let output = text.querySelector('.dlook-collection-count');
      if (!output) {
        output = document.createElement('p');
        output.className = 'dlook-collection-count';
        text.append(output);
      }
      const label = labels[2](count);
      if (output.textContent !== label) output.textContent = label;
    }
  }

  function applyPlaybackOrder() {
    if (!pendingOrder) return;
    const toggle = document.querySelector(shuffleSelector);
    if (toggle) {
      const enabled = Boolean(toggle.querySelector('[data-color="onSurfacePrimary"]'));
      if (enabled !== pendingOrder.shuffle) toggle.click();
      pendingOrder = null;
    } else if (performance.now() >= pendingOrder.until) {
      pendingOrder = null;
    }
  }

  function playlistActions(pane, labels, kind) {
    const hero = pane.querySelector('[class*="_info_hxvvl_"]');
    const track = pane.querySelector(kind === 'mylist' ? mylistItemSelector : trackSelector);
    if (!hero || !track || track.hasAttribute('data-editing')) {
      actions?.remove();
      return;
    }
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'dlook-collection-actions';
      for (const name of ['play', 'shuffle']) {
        const control = document.createElement('button');
        control.type = 'button';
        control.append(DLookPlayIcons.create(name), document.createElement('span'));
        control.addEventListener('click', async () => {
          const shuffle = name === 'shuffle';
          // My lists have no native queue, so the DLook player always plays them.
          if (kind === 'mylist' || prepared?.cached) {
            control.disabled = true;
            try {
              if (await startQueue({ shuffle, requireCache: kind !== 'mylist' })) return;
            } finally {
              control.disabled = false;
            }
            if (kind === 'mylist') return;
          }
          const tracks = pane.querySelectorAll(trackSelector);
          if (!tracks.length) return;
          const index = shuffle ? Math.floor(Math.random() * tracks.length) : 0;
          pendingOrder = { shuffle, until: performance.now() + 2000 };
          tracks[index].click();
          requestAnimationFrame(applyPlaybackOrder);
        });
        actions.append(control);
      }
    }
    for (const [index, control] of [...actions.children].entries()) {
      if (control.lastElementChild.textContent !== labels[index]) control.lastElementChild.textContent = labels[index];
    }
    if (actions.parentElement !== hero) hero.append(actions);
  }

  function createDialog(kind) {
    if (document.querySelector('.dlook-collection-dialog[open]')) return;
    const [list, playlist, nameLabel, cancelLabel, createLabel, errorLabel] = createLabels;
    const dialog = document.createElement('dialog');
    dialog.className = 'dlook-collection-dialog';
    dialog.setAttribute('aria-labelledby', 'dlook-collection-dialog-title');
    const form = document.createElement('form');
    const title = document.createElement('h2');
    title.id = 'dlook-collection-dialog-title';
    title.textContent = kind === 'mylist' ? list : playlist;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 255;
    input.required = input.autofocus = true;
    input.placeholder = nameLabel;
    input.setAttribute('aria-label', nameLabel);
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const actions = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = cancelLabel;
    const create = document.createElement('button');
    create.type = 'submit';
    create.textContent = createLabel;
    actions.append(cancel, create);
    form.append(title, input, status, actions);
    dialog.append(form);

    create.disabled = true;
    input.oninput = () => { create.disabled = !input.value.trim(); };
    cancel.onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.addEventListener('cancel', event => { if (input.disabled) event.preventDefault(); });
    form.onsubmit = async event => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name || input.disabled) return;
      input.disabled = cancel.disabled = create.disabled = true;
      status.textContent = '';
      try {
        await DLookPlaySite.createCollection(kind, name);
        location.reload();
      } catch {
        input.disabled = cancel.disabled = create.disabled = false;
        status.textContent = errorLabel;
        input.focus();
      }
    };
    document.body.append(dialog);
    dialog.showModal();
  }

  function prepareCreate(pane, kind) {
    const add = pane.querySelector(`[data-dd-action-name="${kind}.create"]`);
    if (!add) return;
    const label = createLabels[kind === 'mylist' ? 0 : 1];
    if (add.getAttribute('aria-label') !== label) add.setAttribute('aria-label', label);
    if (add.hasAttribute('data-dlook-create')) return;
    add.setAttribute('data-dlook-create', '');
    add.removeAttribute('href');
    add.setAttribute('role', 'button');
    add.tabIndex = 0;
    add.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      createDialog(kind);
    }, true);
    add.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      add.click();
    });
  }

  function roundAction(control, icon) {
    if (!control || control.querySelector(`:scope > [data-dlook-action-icon="${icon}"]`)) return;
    control.querySelector(':scope > [data-dlook-action-icon]')?.remove();
    control.setAttribute('data-dlook-round-action', icon);
    const graphic = DLookPlayIcons.create(icon);
    graphic.dataset.dlookActionIcon = icon;
    control.append(graphic);
  }

  function detailActions(page, kind) {
    const header = page.main.querySelector(':scope > header');
    const remove = page.pane.querySelector(`button[data-dd-action-name="${kind}.delete"]`);
    const edit = header?.querySelector('[class*="_colRight_"] button');
    if (edit && !edit.hasAttribute('data-dlook-round-action')) {
      edit.addEventListener('click', () => { if (edit.dataset.dlookRoundAction === 'check') DLookPlaySite.clearCache(); });
    }
    roundAction(header?.querySelector(`[data-dd-action-name="${kind}.detail_back"]`), 'back');
    roundAction(edit, remove ? 'check' : 'edit');
    roundAction(remove, 'delete');
  }

  function update(page, path, pageLanguage) {
    language = pageLanguage;
    const mode = page && collectionMode(path);
    const pane = mode ? page.pane : null;
    if (pane !== activePane || (pane && pane.dataset.dlookCollection !== mode)) {
      if (activePane) delete activePane.dataset.dlookCollection;
      activePane = pane;
      request = counts = prepared = undefined;
      pendingOrder = null;
      actions?.remove();
      actions = undefined;
      if (pane) pane.dataset.dlookCollection = mode;
    }
    applyPlaybackOrder();
    const labels = copy[language] ?? copy[language.split('-')[0]] ?? copy.en;
    createLabels = createCopy[language] ?? createCopy[language.split('-')[0]] ?? createCopy.en;
    if (mode?.endsWith('-index')) prepareCreate(pane, mode.split('-')[0]);
    if (mode?.endsWith('-detail')) {
      guardEditingItems(pane);
      detailActions(page, mode.split('-')[0]);
    }
    if (mode === 'playlist-index') countPlaylistWorks(pane, labels);
    if (mode?.endsWith('-detail')) {
      prepare(pane, mode);
      playlistActions(pane, labels, mode.split('-')[0]);
    }
    if (mode === 'playlist-detail') takeOverTracks(pane);
  }

  return { update };
})();
