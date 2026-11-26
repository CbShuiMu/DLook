const DLookOffline = (() => {
  const offlinePath = '/settings';
  const offlineHash = '#dlook-offline';
  const href = offlinePath + offlineHash;
  const copy = {
    'zh-cn': {
      title: '离线暂存', save: '暂存音视频', saved: '已暂存', saving: '正在暂存音视频…', cancel: '暂停暂存',
      count: (saved, total) => `已暂存 ${saved}/${total} 项`, retry: '继续暂存', stopped: '暂存已暂停。',
      authorization: '授权失败，请确认已登录且能在线播放。', catalog: '无法读取文件列表，请重试。',
      media: '部分音视频下载失败，请重试。', storage: '浏览器无法写入暂存，请检查本地存储。',
      quota: '空间不足，请删除部分暂存作品后重试。', back: '返回离线暂存',
      noAudio: '这个作品没有可暂存的音频或视频。', empty: '还没有暂存作品。联网时，在已购作品页点击「暂存音视频」。',
      remove: '删除暂存', confirm: title => `删除「${title}」的本地暂存？`, openFailed: '无法读取离线暂存，请重试。',
      playFailed: '无法播放这一项，请尝试重新暂存。', removeFailed: '无法删除暂存，请重试。',
    },
    'zh-tw': {
      title: '離線暫存', save: '暫存影音', saved: '已暫存', saving: '正在暫存影音…', cancel: '暫停暫存',
      count: (saved, total) => `已暫存 ${saved}/${total} 項`, retry: '繼續暫存', stopped: '已暫停暫存。',
      authorization: '授權失敗，請確認已登入且可線上播放。', catalog: '無法讀取檔案清單，請再試一次。',
      media: '部分影音下載失敗，請再試一次。', storage: '瀏覽器無法寫入暫存，請檢查本機儲存空間。',
      quota: '空間不足，請刪除部分暫存作品後再試。', back: '返回離線暫存',
      noAudio: '這個作品沒有可暫存的音訊或影片。', empty: '還沒有暫存作品。連線時，在已購作品頁點選「暫存影音」。',
      remove: '刪除暫存', confirm: title => `刪除「${title}」的本機暫存？`, openFailed: '無法讀取離線暫存，請再試一次。',
      playFailed: '無法播放此項目，請嘗試重新暫存。', removeFailed: '無法刪除暫存，請再試一次。',
    },
    ja: {
      title: 'オフライン', save: '音声・動画を保存', saved: '保存済み', saving: '音声・動画を保存中…', cancel: '保存を一時停止',
      count: (saved, total) => `${total} 件中 ${saved} 件を保存済み`, retry: '保存を再開', stopped: '保存を一時停止しました。',
      authorization: '認証できません。ログイン状態と再生権限を確認してください。', catalog: 'ファイル一覧を取得できません。もう一度お試しください。',
      media: '一部の音声・動画をダウンロードできませんでした。', storage: '保存できません。ブラウザのストレージを確認してください。',
      quota: '空き容量が不足しています。保存済みの作品を削除してください。', back: 'オフラインに戻る',
      noAudio: '保存できる音声・動画がありません。', empty: 'オンライン時に購入済みの作品ページから音声・動画を保存できます。',
      remove: '保存を削除', confirm: title => `「${title}」の保存データを削除しますか？`, openFailed: '保存データを読み込めませんでした。',
      playFailed: 'この項目を再生できません。もう一度保存してください。', removeFailed: '保存データを削除できませんでした。',
    },
    en: {
      title: 'Offline', save: 'Save offline', saved: 'Saved offline', saving: 'Saving audio and video…', cancel: 'Pause saving',
      count: (saved, total) => `${saved} of ${total} items saved`, retry: 'Resume saving', stopped: 'Saving paused.',
      authorization: 'Authorization failed. Check that you can play this work online.',
      catalog: 'Could not load the file list. Try again.', media: 'Some audio or video could not be downloaded. Try again.',
      storage: 'Could not write the offline copy. Check browser storage.', back: 'Back to offline',
      quota: 'Storage is full. Remove some saved works and try again.',
      noAudio: 'This work has no audio or video available to save.',
      empty: 'No saved works yet. While online, open a purchased work and select “Save offline.”',
      remove: 'Remove offline copy', confirm: title => `Remove the offline copy of “${title}”?`,
      openFailed: 'Could not read offline copies. Try again.', playFailed: 'Could not play this item. Try saving it again.',
      removeFailed: 'Could not remove the offline copy. Try again.',
    },
    ko: {
      title: '오프라인', save: '오디오·동영상 저장', saved: '저장됨', saving: '오디오·동영상 저장 중…', cancel: '저장 일시 중지',
      count: (saved, total) => `${total}개 중 ${saved}개 저장됨`, retry: '저장 계속하기', stopped: '저장을 일시 중지했습니다.',
      authorization: '인증에 실패했습니다. 온라인으로 재생할 수 있는지 확인하세요.', catalog: '파일 목록을 읽을 수 없습니다.',
      media: '일부 오디오·동영상을 다운로드하지 못했습니다.', storage: '저장할 수 없습니다. 브라우저 저장 공간을 확인하세요.',
      quota: '저장 공간이 부족합니다. 저장된 작품을 삭제하세요.', back: '오프라인으로 돌아가기',
      noAudio: '저장할 수 있는 오디오나 동영상이 없습니다.', empty: '온라인 상태에서 구매한 작품 페이지의 저장 버튼을 누르세요.',
      remove: '저장 삭제', confirm: title => `“${title}”의 저장 데이터를 삭제할까요?`, openFailed: '저장 데이터를 읽을 수 없습니다.',
      playFailed: '이 항목을 재생할 수 없습니다. 다시 저장해 보세요.', removeFailed: '저장 데이터를 삭제할 수 없습니다.',
    },
  };
  const text = language => copy[language] ?? copy[language.split('-')[0]] ?? copy.en;
  const isOpen = () => location.pathname === offlinePath && location.hash === offlineHash;
  const jobs = new Map();
  let workView, library, warming;

  function element(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function button() {
    const node = element('button', 'dlook-offline-button');
    node.type = 'button';
    return node;
  }

  function setText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  function warmOfflinePage() {
    const worker = navigator.serviceWorker;
    if (!worker) return;
    if (!warming) {
      warming = (async () => {
        if (!worker.controller) {
          await new Promise(resolve => {
            const ready = () => {
              clearTimeout(timeout);
              worker.removeEventListener('controllerchange', ready);
              resolve();
            };
            const timeout = setTimeout(ready, 3000);
            worker.addEventListener('controllerchange', ready, { once: true });
          });
        }
        if (!worker.controller) return;
        // Play caches the settings document and can serve it with the offline hash.
        const url = new URL(offlinePath, location.origin);
        if (await window.caches?.match(url, { cacheName: 'content' }).catch(() => null)) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(url, {
            cache: 'reload', credentials: 'same-origin', signal: controller.signal,
          });
          await response.text();
        } finally {
          clearTimeout(timeout);
        }
      })().catch(() => {}).finally(() => { warming = undefined; });
    }
    return warming;
  }

  const isSaved = state => state?.total > 0 && state.saved === state.total;
  const trackPath = track => track.folder ? `${track.folder}/${track.name}` : track.name;
  const localeFor = language => ({ ja: 'ja_JP', en: 'en_US', ko: 'ko_KR', zh: 'zh_CN' }[language] ??
    language.replace(/-([a-z]{2})$/, (_, suffix) => '_' + suffix.toUpperCase()));

  // Signed online access for tracks that have no local copy; shared by every queue for ten minutes.
  function streamSource(workno) {
    return DLookPlaySite.cache(`stream:${workno}`, async () => {
      const signal = new AbortController().signal;
      const catalog = await DLookOfflineSource.catalog(workno, signal);
      return { catalog, download: DLookOfflineSource.createDownloader(workno, catalog, signal) };
    }, 600000);
  }

  // DLsite Play keys progress by the ziptree file hash; older saves need the online catalog for it.
  async function progressMeta({ work, track }) {
    if (track.hashname && work.hash && work.unitCount) {
      return { key: track.hashname, hash: work.hash, unitCount: work.unitCount };
    }
    const { catalog } = await streamSource(work.workno);
    const path = track.path ?? trackPath(track);
    const found = catalog.tracks.find(entry => entry.asset === track.asset) ??
      catalog.tracks.find(entry => trackPath(entry) === path);
    return found?.hashname && catalog.hash ? { key: found.hashname, hash: catalog.hash, unitCount: catalog.unitCount } : null;
  }

  // A saved video becomes a local HLS playlist whose segments point at blob URLs.
  function localVideo({ playlist, segments }) {
    const urls = segments.map(blob => URL.createObjectURL(new Blob([blob], { type: 'video/mp2t' })));
    const text = playlist.replace(/^#DLOOK-SEGMENT:(\d+)$/gm, (_, index) => urls[Number(index)]);
    const src = URL.createObjectURL(new Blob([text], { type: 'application/vnd.apple.mpegurl' }));
    return { src, revoke: [src, ...urls] };
  }

  // Returns { src, revoke, captions, video }; revoke lists the blob URLs the caller must release.
  async function resolveTrack(item) {
    const video = item.track.kind === 'video';
    if (!item.stream) {
      const [media, captions] = await Promise.all([
        video ? DLookOfflineStore.video(item.work, item.track.asset) : DLookOfflineStore.track(item.work, item.track.asset),
        DLookOfflineStore.captions(item.work, item.track.asset).catch(() => []),
      ]);
      if (media && video) return { ...localVideo(media), captions: captions ?? [], video };
      if (media) {
        const src = URL.createObjectURL(media);
        return { src, revoke: [src], captions: captions ?? [], video };
      }
    }
    const { catalog, download } = await streamSource(item.work.workno);
    const path = item.track.path ?? trackPath(item.track);
    const track = catalog.tracks.find(entry => entry.asset === item.track.asset) ??
      catalog.tracks.find(entry => trackPath(entry) === path);
    if (!track) throw new Error('Missing online track');
    const isVideo = track.kind === 'video';
    const [src, captions] = await Promise.all([
      // HLS segments are fetched by the browser itself, so they authenticate with the CDN cookie.
      isVideo ? DLookOfflineSource.authorizeStream(item.work.workno, AbortSignal.timeout(10000))
        .then(() => DLookOfflineSource.streamUrl(catalog, track.asset)) : download.url(track.asset),
      track.captionAsset ? download.captions(track.captionAsset).catch(() => []) : [],
    ]);
    return { src, revoke: [], captions: captions ?? [], video: isVideo };
  }

  // Entries are { workno, path } for single tracks or { workno } for every track of a work.
  async function buildQueue(entries, language) {
    const worknos = [...new Set(entries.map(entry => entry.workno))];
    const locale = localeFor(language);
    const works = new Map(await Promise.all(worknos.map(async workno => {
      const cached = await DLookOfflineStore.work(workno).catch(() => null);
      return [workno, cached?.tracks.length ? cached : null];
    })));
    const metadata = new Map(await Promise.all(worknos.map(async workno => {
      const cached = works.get(workno);
      if (cached) return [workno, cached];
      const work = await DLookOfflineSource.identify(workno, locale, new AbortController().signal).catch(() => null);
      return [workno, { workno, title: work?.title || workno, creator: work?.creator, hasCover: false }];
    })));
    // Whole works follow the online catalog when reachable, so tracks added since saving (e.g. videos) still play.
    const whole = worknos.filter(workno => entries.some(entry => entry.workno === workno && entry.path === undefined));
    const sources = new Map(await Promise.all(whole.map(async workno =>
      [workno, navigator.onLine ? await streamSource(workno).catch(() => null) : null])));
    const queue = [];
    let cachedCount = 0;
    for (const entry of entries) {
      const cached = works.get(entry.workno);
      const work = metadata.get(entry.workno);
      if (entry.path !== undefined) {
        const track = cached?.tracks.find(item => trackPath(item) === entry.path);
        if (track) cachedCount += 1;
        const slash = entry.path.lastIndexOf('/');
        queue.push(track ? { work: cached, track } : {
          work, stream: true,
          track: { path: entry.path, name: entry.path.slice(slash + 1), folder: slash > 0 ? entry.path.slice(0, slash) : '' },
        });
        continue;
      }
      const source = sources.get(entry.workno);
      if (!source) {
        cachedCount += cached?.tracks.length ?? 0;
        queue.push(...(cached?.tracks ?? []).slice().sort((a, b) => a.order - b.order).map(track => ({ work: cached, track })));
        continue;
      }
      const saved = new Map(cached?.tracks.map(track => [track.asset, track]));
      for (const track of source.catalog.tracks) {
        const local = saved.get(track.asset);
        if (local && cached.revision === source.catalog.revision) {
          cachedCount += 1;
          queue.push({ work: cached, track: local });
        } else {
          queue.push({ work, track, stream: true });
        }
      }
    }
    return { queue, cachedCount };
  }

  // Plays a mixed queue in the DLook player: local copies first, signed online media otherwise.
  // select: { path } or { key } (a ziptree hashname) picks the starting item; resume continues its saved position.
  async function playQueue(language, entries, {
    index = 0, shuffle = false, returnHref, requireCache = false, select, resume = true,
  } = {}) {
    const { queue, cachedCount } = await buildQueue(entries, language);
    if (!queue.length || (requireCache && !cachedCount)) return false;
    if (select) {
      const stem = name => String(name ?? '').replace(/\.[^.]*$/, '');
      let matches;
      if (select.path !== undefined) matches = queue.filter(({ track }) => (track.path ?? trackPath(track)) === select.path);
      else if (select.key !== undefined) matches = queue.filter(({ track }) => stem(track.hashname ?? track.asset) === stem(select.key));
      else {
        // Tree rows show names without extensions; the open folder separates same-named files.
        matches = queue.filter(({ track }) => track.name === select.title || stem(track.name) === select.title);
        const inFolder = matches.filter(({ track }) => track.folder === select.folder);
        if (inFolder.length) matches = inFolder;
        else if (matches.length > 1) return false;
      }
      index = matches.length ? queue.indexOf(matches[0]) : -1;
      if (index < 0) return false;
    }
    if (library?.language !== language) show(language);
    if (!library.shell.hasAttribute('data-dlook-background')) library.shell.setAttribute('data-dlook-background', '');
    library.shell.hidden = false;
    const start = shuffle ? Math.floor(Math.random() * queue.length) : Math.min(Math.max(index, 0), queue.length - 1);
    library.playQueue(queue, start, shuffle, returnHref, resume);
    return true;
  }

  async function cachedTracks(entries) {
    const worknos = [...new Set(entries.map(entry => entry.workno))];
    const works = await Promise.all(worknos.map(workno => DLookOfflineStore.work(workno).catch(() => null)));
    const paths = new Set();
    for (const work of works) {
      for (const track of work?.tracks ?? []) paths.add(`${work.workno}\n${trackPath(track)}`);
    }
    return entries.filter(entry => paths.has(`${entry.workno}\n${entry.path}`)).length;
  }

  function paintWork(view) {
    const job = jobs.get(view.workno);
    const state = job ?? view.result;
    const { labels } = view;
    const retry = state?.message || (state && state.saved < state.total);
    const complete = isSaved(state);
    setText(view.saveLabel, job ? labels.saving : complete ? labels.saved : retry ? labels.retry : labels.save);
    setText(view.cancelLabel, labels.cancel);
    view.save.disabled = Boolean(job || complete);
    view.save.hidden = Boolean(job);
    view.cancel.hidden = !job;
    const progress = state?.total ? labels.count(state.saved, state.total) : '';
    const message = state?.message ? labels[state.message] : '';
    const code = state?.httpStatus >= 400 ? `(HTTP ${state.httpStatus})` : '';
    setText(view.status, [progress, message, code].filter(Boolean).join(' '));
  }

  async function saveWork(view) {
    if (jobs.has(view.workno) || isSaved(view.result)) return;
    const job = { ...view.result, controller: new AbortController(), message: '', httpStatus: undefined };
    const { signal } = job.controller;
    jobs.set(view.workno, job);
    const update = () => {
      if (workView?.workno === view.workno) paintWork(workView);
    };
    update();
    let offlinePage, artwork;
    let phase = 'catalog';
    try {
      offlinePage = warmOfflinePage();
      navigator.storage?.persist?.().catch(() => {});
      const catalog = await DLookOfflineSource.catalog(view.workno, signal);
      if (!catalog.tracks.length) {
        job.message = 'noAudio';
        return;
      }
      phase = 'storage';
      const record = await DLookOfflineStore.start(view.work, catalog.revision, catalog.tracks, catalog);
      if (!record.hasCover) {
        artwork = DLookOfflineSource.cover(view.work.coverUrl, signal)
          .then(cover => cover && !signal.aborted && DLookOfflineStore.saveCover(record, cover))
          .catch(() => {});
      }
      const saved = new Set(record.tracks.map(track => track.asset));
      job.saved = saved.size;
      job.total = record.total;
      update();
      const download = DLookOfflineSource.createDownloader(view.workno, catalog, signal);
      for (const track of catalog.tracks) {
        if (signal.aborted) throw signal.reason;
        if (saved.has(track.asset)) continue;
        let media;
        try {
          media = track.kind === 'video' ?
            await download.video(track.asset, (index, blob) => DLookOfflineStore.saveSegment(record, track.asset, index, blob)) :
            await download.audio(track.asset);
        } catch (error) {
          // Storage failures (quota, an interrupted save) stop the whole job; download failures skip the track.
          if (signal.aborted || error.phase === 'authorization' || !error.phase) throw error;
          job.message = 'media';
          job.httpStatus = error.status;
          continue;
        }
        const captions = track.captionAsset && await download.captions(track.captionAsset).catch(() => undefined);
        if (signal.aborted) throw signal.reason;
        job.saved = track.kind === 'video' ?
          await DLookOfflineStore.saveVideo(record, track, media, captions) :
          await DLookOfflineStore.save(record, track, media, captions);
        update();
      }
    } catch (error) {
      job.message = error?.name === 'AbortError' ? 'stopped' :
        error?.name === 'QuotaExceededError' ? 'quota' : error?.phase ?? phase;
      job.httpStatus = error?.status;
    } finally {
      if (job.saved && !signal.aborted) await Promise.all([offlinePage, artwork]);
      jobs.delete(view.workno);
      view.result = { saved: job.saved, total: job.total, message: job.message, httpStatus: job.httpStatus };
      if (workView?.workno === view.workno) workView.result = view.result;
      update();
    }
  }

  const playButtons = '[data-dd-action-name="work_detail.resume"], [data-dd-action-name="work_detail.start"]';
  const playableFile = /\.(?:mp3|wav|flac|m4a|aac|ogg|oga|opus|wma|mp4|m4v|mov|webm|mkv|avi|wmv|mpe?g|ts)$/i;
  const treeRow = '[class*="_tree_"] > li > [class*="_rowBody_"]:not(a)';
  const interceptedPanes = new WeakSet();
  let bypass;

  // Starts a work in the DLook player: a file row plays that file, "start" plays from the top,
  // and "resume" continues the server's last unit unless the whole work was finished.
  async function startWork(language, workno, { path, row, action }) {
    const options = { returnHref: location.pathname };
    if (path !== undefined) {
      Object.assign(options, { select: { path }, resume: true });
    } else if (row) {
      Object.assign(options, { select: row, resume: true });
    } else if (action === 'work_detail.resume') {
      const activity = await DLookPlayProgress.activity(workno);
      const units = Object.values(activity?.unit_progress ?? {});
      const finished = units.length && units.every(unit => unit?.completed);
      if (activity?.last_unit_key && !finished) Object.assign(options, { select: { key: activity.last_unit_key }, resume: true });
      else options.resume = false;
    } else {
      options.resume = false;
    }
    return playQueue(language, [{ workno }], options).catch(() => false);
  }

  function interceptWork(pane) {
    if (interceptedPanes.has(pane)) return;
    interceptedPanes.add(pane);
    pane.addEventListener('click', event => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const view = workView;
      const control = event.target.closest(`${playButtons}, a[href*="/view/"], ${treeRow}`);
      // view.work is only known for audio and video works (or ones already saved offline).
      if (!view?.work || !control || control === bypass || !pane.contains(control)) return;
      let path, row;
      if (control.matches(treeRow)) {
        // Audio rows play in place instead of linking to a viewer; their title omits the extension.
        const title = control.querySelector('p')?.textContent.trim();
        if (!title || event.target.closest('button, input')) return;
        let folder = '';
        try {
          folder = decodeURIComponent(location.pathname.match(/^\/work\/[A-Z]{2}\d{6,10}\/tree\/(.+)$/)?.[1] ?? '');
        } catch {}
        row = { title, folder };
      } else if (control.tagName === 'A') {
        const match = new URL(control.href).pathname.match(/^\/work\/([A-Z]{2}\d{6,10})\/view\/(.+)$/);
        if (match?.[1] !== view.workno) return;
        try { path = decodeURIComponent(match[2]); } catch { return; }
        // Images, text and other viewers stay native.
        if (!playableFile.test(path)) return;
      }
      event.preventDefault();
      event.stopPropagation();
      const action = control.dataset.ddActionName;
      startWork(view.language, view.workno, { path, row, action }).then(started => {
        if (started || !control.isConnected) return;
        // Fall back to the native player when the item is not in the DLook queue.
        bypass = control;
        try { control.click(); } finally { bypass = undefined; }
      });
    }, true);
  }

  function updateWork(page, path, language) {
    const workno = page ? path.match(/^\/work\/((?:RJ|VJ|BJ)\d{6,10})(?:\/tree\/[^/]+)?$/)?.[1] : undefined;
    if (workno !== workView?.workno) {
      workView?.probe.abort();
      workView?.node.remove();
      workView = undefined;
      if (workno) {
        const node = element('section', 'dlook-offline-work');
        const status = element('p');
        status.setAttribute('role', 'status');
        const save = button();
        const saveLabel = element('span');
        save.append(DLookPlayIcons.create('offline'), saveLabel);
        const cancel = button();
        const cancelLabel = element('span');
        cancel.append(DLookPlayIcons.create('pause'), cancelLabel);
        const view = { workno, node, status, save, saveLabel, cancel, cancelLabel, probe: new AbortController() };
        view.save.onclick = () => saveWork(view);
        view.cancel.onclick = () => jobs.get(workno)?.controller.abort();
        node.append(view.save, view.cancel, status);
        workView = view;
        const locale = localeFor(language);
        Promise.all([
          DLookOfflineSource.identify(workno, locale, view.probe.signal).catch(() => null),
          DLookOfflineStore.work(workno).catch(() => null),
        ]).then(async ([work, cached]) => {
          if ((!work && !cached) || workView !== view) return;
          view.work = work ?? cached;
          view.result ??= cached && { saved: cached.tracks.length, total: cached.total };
          // A save made before videos were supported may lack tracks the catalog now lists.
          if (cached && navigator.onLine && isSaved(view.result)) {
            const source = await streamSource(workno).catch(() => null);
            const saved = new Set(cached.tracks.map(track => track.asset));
            const missing = source && cached.revision === source.catalog.revision ?
              source.catalog.tracks.filter(track => !saved.has(track.asset)).length : 0;
            if (missing && workView === view && !jobs.has(workno)) {
              view.result = { saved: cached.tracks.length, total: cached.tracks.length + missing };
            }
          }
          if (workView !== view) return;
          mountWork(view);
        }).catch(() => {});
      }
    }
    if (!workView) return;
    workView.labels = text(language);
    workView.language = language;
    workView.pane = page.pane;
    interceptWork(page.pane);
    if (workView.work) mountWork(workView);
  }

  function mountWork(view) {
    const listen = view.pane.querySelector('[data-dd-action-name="work_detail.resume"]') ??
      view.pane.querySelector('[data-dd-action-name="work_detail.start"]');
    const actions = listen?.closest('[class*="_actions_"]') ??
      view.pane.querySelector('[class*="_contentSub_"] [class*="_actions_"]');
    if (actions) {
      if (view.node.parentElement !== actions) actions.prepend(view.node);
    } else if (listen) {
      if (view.node.nextElementSibling !== listen) listen.before(view.node);
    } else if (view.node.parentElement !== view.pane) {
      view.pane.prepend(view.node);
    }
    view.node.toggleAttribute('data-listen-group', Boolean(actions));
    paintWork(view);
  }

  function show(language) {
    if (library?.language === language) {
      if (library.shell.hasAttribute('data-dlook-background')) {
        library.shell.hidden = false;
        library.shell.removeAttribute('data-dlook-background');
        library.refresh();
      }
      return library.shell;
    }
    dispose();
    const labels = text(language);
    const shell = element('div', 'dlook-offline-page');
    const heading = element('h1');
    const back = button();
    back.classList.add('dlook-offline-back');
    back.setAttribute('aria-label', labels.back);
    back.append(DLookPlayIcons.create('back'));
    back.hidden = true;
    const main = element('main');
    const list = element('div', 'dlook-offline-list');
    const detail = element('article', 'dlook-offline-detail');
    detail.hidden = true;
    const notice = element('p', 'dlook-offline-notice');
    notice.setAttribute('role', 'status');
    let shuffle = false, repeat = 'off', order = [];
    const player = DLookOfflinePlayer.create(language, {
      cover: DLookOfflineStore.cover,
      onClose: stop,
      onSkip: direction => stepTrack(direction),
      onEnded: () => stepTrack(1, true),
      onQueue: () => {
        if (!selection) return;
        const { returnHref } = selection;
        const item = selection.queue[selection.index];
        if (returnHref) {
          if (!DLookPlaySite.navigate(returnHref)) location.assign(returnHref);
          return;
        }
        if (!item.stream) showWork(item.work);
        if (!isOpen() && !DLookPlaySite.navigate(href)) location.assign(href);
      },
      onShuffle() {
        shuffle = !shuffle;
        if (selection) setOrder(selection.queue.length, selection.index);
        return shuffle;
      },
      onRepeat() {
        repeat = { off: 'all', all: 'track', track: 'off' }[repeat];
        player.audio.loop = repeat === 'track';
        return repeat;
      },
      onError() {
        const item = selection?.queue[selection.index];
        // A browser that cannot play a locally assembled HLS playlist can still stream the same video.
        if (item && playingLocalVideo && navigator.onLine) {
          playingLocalVideo = false;
          item.stream = true;
          play(selection.queue, selection.index, false, undefined, selection.returnHref, true);
          return;
        }
        if (selection) {
          notice.textContent = labels.playFailed;
          player.error(labels.playFailed);
        }
      },
    });
    const { audio } = player;
    const current = {
      shell, language, stop, refresh, releaseCovers, collapse: player.collapse, claimed: 0,
      cleanup() {
        clearInterval(progressTimer);
        window.removeEventListener('pagehide', onPageHide);
      },
      playQueue(queue, index, shuffleOn, returnHref, resume = true) {
        shuffle = shuffleOn;
        player.setShuffle(shuffle);
        current.claimed = performance.now();
        play(queue, index, true, undefined, returnHref, resume);
      },
    };
    let playingLocalVideo = false, selection, playingUrls = [], opened, selectionRequest = 0, refreshRequest = 0, progress;

    // Sends the current position in DLsite Play's own format; failures stay queued for later.
    function reportProgress(completed = audio.ended, keepalive = false) {
      const current = progress;
      const total = audio.duration;
      const position = audio.currentTime;
      if (!current || !(position > 0) || !Number.isFinite(total)) return;
      current.meta.then(meta => DLookPlayProgress.save(current.workno, meta, position, total, completed, keepalive))
        .catch(() => {});
    }

    audio.addEventListener('pause', () => { if (!audio.ended) reportProgress(false); });
    audio.addEventListener('ended', () => reportProgress(true));
    const progressTimer = setInterval(() => { if (!audio.paused) reportProgress(false); }, 60000);
    const onPageHide = () => { if (!audio.paused) reportProgress(false, true); };
    window.addEventListener('pagehide', onPageHide);
    let displayedWorks;
    const trackButtons = new Map();
    const coverUrls = new Map();

    function releaseCovers(all = true) {
      for (const [node, url] of coverUrls) {
        if (!all && node.isConnected) continue;
        URL.revokeObjectURL(url);
        coverUrls.delete(node);
      }
    }

    function markTrack(current) {
      for (const controls of trackButtons.values()) {
        for (const control of controls) {
          if (control === current) control.setAttribute('aria-current', 'true');
          else control.removeAttribute('aria-current');
        }
      }
    }

    function stop() {
      selectionRequest += 1;
      if (!audio.paused) reportProgress();
      progress = undefined;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      releasePlaying();
      selection = undefined;
      player.hide();
      markTrack(null);
    }

    function releasePlaying() {
      playingUrls.forEach(url => URL.revokeObjectURL(url));
      playingUrls = [];
    }

    function setOrder(length, current) {
      order = Array.from({ length }, (_, index) => index);
      if (!shuffle) return;
      order.splice(current, 1);
      for (let index = order.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [order[index], order[other]] = [order[other], order[index]];
      }
      order.unshift(current);
    }

    function stepTrack(direction, ended = false) {
      if (!selection) return;
      const { queue, index, returnHref } = selection;
      const offset = order.indexOf(index) + direction;
      const next = repeat === 'all' ? (offset + order.length) % order.length : offset;
      if (direction < 0 && (audio.currentTime > 5 || next < 0)) {
        audio.currentTime = 0;
      } else if (order[next] === index && ended) {
        audio.currentTime = 0;
        player.resume();
      } else if (next >= 0 && next < order.length) {
        play(queue, order[next], false, undefined, returnHref);
      }
    }

    async function play(queue, index, open = true, origin, returnHref, resume = open) {
      const id = ++selectionRequest;
      try {
        const item = queue[index];
        const { work, track } = item;
        const meta = progressMeta(item).catch(() => null);
        const [source, resumeAt] = await Promise.all([
          resolveTrack(item),
          // Only a user-started track continues from its saved position, like "continue listening".
          resume ? meta.then(value => DLookPlayProgress.position(work.workno, value?.key)) : 0,
        ]);
        if (id !== selectionRequest) {
          source.revoke.forEach(url => URL.revokeObjectURL(url));
          return;
        }
        if (progress && !audio.paused) reportProgress();
        const previousWork = progress?.workno;
        progress = { workno: work.workno, meta };
        if (previousWork !== work.workno) DLookPlayProgress.open(work.workno);
        if (open) {
          document.querySelector('#App [data-dd-action-name="player.minimize"]')?.click();
          if (!closeNativeMini()) requestAnimationFrame(closeNativeMini);
        }
        releasePlaying();
        playingUrls = source.revoke;
        playingLocalVideo = source.video && source.revoke.length > 0;
        if (open || selection?.queue !== queue) setOrder(queue.length, index);
        selection = { queue, index, returnHref };
        audio.src = source.src;
        if (resumeAt > 0) audio.currentTime = resumeAt;
        audio.setAttribute('aria-label', track.name);
        player.show(work, track, open, source.captions, origin);
        notice.textContent = '';
        markTrack(trackButtons.get(work.workno)?.find(control => control.dataset.asset === track.asset));
        player.resume();
      } catch (error) {
        if (id === selectionRequest && error.name !== 'NotAllowedError') {
          notice.textContent = labels.playFailed;
          player.error(labels.playFailed);
        }
      }
    }

    function workSummary(work) {
      const cover = element('div', 'dlook-offline-cover');
      const fallback = DLookPlayIcons.create('playlist');
      cover.append(fallback);
      if (work.hasCover) {
        DLookOfflineStore.cover(work.workno).then(data => {
          if (!data?.bytes || !cover.isConnected) return;
          const url = URL.createObjectURL(new Blob([data.bytes], { type: data.type }));
          const image = element('img');
          coverUrls.set(image, url);
          image.alt = '';
          image.loading = 'lazy';
          image.src = url;
          image.onerror = () => {
            coverUrls.delete(image);
            URL.revokeObjectURL(url);
            image.remove();
          };
          cover.append(image);
        }).catch(() => {});
      }
      const text = element('div', 'dlook-offline-card-text');
      const title = element('strong');
      title.textContent = work.title;
      text.append(title);
      if (work.creator) {
        const creator = element('small');
        creator.className = 'dlook-offline-creator';
        creator.textContent = work.creator;
        text.append(creator);
      }
      const metadata = element('small');
      const bytes = work.tracks.reduce((sum, track) => sum + track.size, 0);
      const size = bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;
      metadata.textContent = `${labels.count(work.tracks.length, work.total)} · ${size}`;
      text.append(metadata);
      return [cover, text];
    }

    function closeWork() {
      const previous = opened;
      opened = undefined;
      back.hidden = detail.hidden = true;
      list.hidden = false;
      detail.replaceChildren();
      releaseCovers(false);
      trackButtons.clear();
      main.scrollTop = 0;
      if (previous) list.querySelector(`[data-workno="${CSS.escape(previous)}"]`)?.focus();
    }

    back.onclick = closeWork;

    function showWork(work) {
      const changed = opened !== work.workno;
      opened = work.workno;
      back.hidden = detail.hidden = false;
      list.hidden = true;
      if (changed) {
        main.scrollTop = 0;
        back.focus();
      }
      const hero = element('div', 'dlook-offline-detail-hero');
      hero.append(...workSummary(work));
      const tracks = work.tracks.slice().sort((left, right) => left.order - right.order);
      const tracksList = element('ol');
      const controls = tracks.map((track, index) => {
        const row = element('li');
        const control = button();
        control.textContent = track.name;
        if (track.folder) {
          const folder = element('small');
          folder.textContent = track.folder;
          control.append(folder);
        }
        control.dataset.asset = track.asset;
        control.onclick = () => play(tracks.map(entry => ({ work, track: entry })), index, true, {
          element: control, artwork: hero.querySelector('.dlook-offline-cover'),
        });
        const playing = selection?.queue[selection.index];
        if (playing && !playing.stream && playing.work.workno === work.workno && playing.track.asset === track.asset) {
          control.setAttribute('aria-current', 'true');
        }
        row.append(control);
        tracksList.append(row);
        return control;
      });
      const remove = button();
      remove.textContent = labels.remove;
      remove.onclick = async () => {
        if (!confirm(labels.confirm(work.title))) return;
        remove.disabled = true;
        try {
          if (selection?.queue.some(item => !item.stream && item.work.workno === work.workno)) stop();
          await DLookOfflineStore.remove(work.workno);
          closeWork();
          await refresh();
        } catch {
          notice.textContent = labels.removeFailed;
          remove.disabled = false;
        }
      };
      trackButtons.clear();
      trackButtons.set(work.workno, controls);
      detail.replaceChildren(hero, tracksList, remove);
      releaseCovers(false);
    }

    function workRow(work) {
      const card = button();
      card.className = 'dlook-offline-card';
      card.dataset.workno = work.workno;
      card.append(...workSummary(work));
      card.onclick = () => showWork(work);
      return card;
    }

    async function refresh() {
      const id = ++refreshRequest;
      try {
        const rows = await DLookOfflineStore.list();
        if (library !== current || id !== refreshRequest) return;
        const works = rows.filter(work => work.tracks.length).sort((left, right) => right.updated - left.updated);
        const fingerprint = JSON.stringify(works.map(work => [work.workno, work.updated, work.hasCover, work.tracks.length]));
        if (displayedWorks === fingerprint) return;
        displayedWorks = fingerprint;
        notice.textContent = works.length ? '' : labels.empty;
        releaseCovers();
        list.replaceChildren(...works.map(workRow));
        if (opened) {
          const selected = works.find(work => work.workno === opened);
          if (selected) showWork(selected);
          else closeWork();
        }
      } catch {
        if (library === current && id === refreshRequest) notice.textContent = labels.openFailed;
      }
    }

    heading.textContent = labels.title;
    const headingGroup = element('div', 'dlook-offline-heading');
    headingGroup.append(back, heading);
    main.append(headingGroup, notice, list, detail);
    shell.append(main, ...player.elements);
    document.body.append(shell);
    library = current;
    window.addEventListener('focus', refresh);
    refresh();
    return shell;
  }

  function closeNativeMini() {
    const close = document.querySelector('#App [data-dd-action-name="player.mini_close"]');
    close?.click();
    return Boolean(close);
  }

  function hide(showPlayer, nativeContainer) {
    if (!library) return;
    if (!library.shell.hasAttribute('data-dlook-background')) {
      library.collapse();
      library.shell.setAttribute('data-dlook-background', '');
    }
    library.shell.hidden = !showPlayer;
    const nativePlaying = nativeContainer?.querySelector('[class*="_audioPlayer_"], [data-dd-action-name="player.mini_open"]');
    // The native player may still be unmounting right after the DLook player takes over a queue.
    const handover = performance.now() - library.claimed < 2000;
    if ((!showPlayer || (nativePlaying && !handover)) && library.shell.querySelector('.dlook-offline-media[src]')) library.stop();
  }

  function dispose() {
    if (!library) return;
    window.removeEventListener('focus', library.refresh);
    library.stop();
    library.cleanup();
    library.releaseCovers();
    library.shell.remove();
    library = undefined;
  }

  return { href, isOpen, label: language => text(language).title, updateWork, show, hide, playQueue, cachedTracks };
})();
