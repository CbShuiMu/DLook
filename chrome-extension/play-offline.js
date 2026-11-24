const DLookOffline = (() => {
  const offlinePath = '/settings';
  const offlineHash = '#dlook-offline';
  const href = offlinePath + offlineHash;
  const copy = {
    'zh-cn': {
      title: '离线暂存', save: '暂存音频', saved: '已暂存', saving: '正在暂存音频…', cancel: '取消暂存',
      count: (saved, total) => `已暂存 ${saved}/${total} 轨`, retry: '重试暂存', stopped: '暂存已取消。',
      authorization: '音频授权失败，请确认已登录且能在线播放。', catalog: '无法读取音轨列表，请重试。',
      media: '音轨下载失败，请重试。', storage: '浏览器无法写入暂存，请检查本地存储。',
      quota: '空间不足，请删除部分暂存作品后重试。', back: '返回离线暂存',
      noAudio: '这个作品没有可暂存的音轨。', empty: '还没有暂存作品。联网时，在已购音频作品页点击「暂存音频」。',
      remove: '删除暂存', confirm: title => `删除「${title}」的本地暂存？`, openFailed: '无法读取离线暂存，请重试。',
      playFailed: '无法播放这条音轨，请尝试重新暂存。', removeFailed: '无法删除暂存，请重试。',
    },
    'zh-tw': {
      title: '離線暫存', save: '暫存音訊', saved: '已暫存', saving: '正在暫存音訊…', cancel: '取消暫存',
      count: (saved, total) => `已暫存 ${saved}/${total} 軌`, retry: '重試暫存', stopped: '已取消暫存。',
      authorization: '音訊授權失敗，請確認已登入且可線上播放。', catalog: '無法讀取音軌清單，請再試一次。',
      media: '音軌下載失敗，請再試一次。', storage: '瀏覽器無法寫入暫存，請檢查本機儲存空間。',
      quota: '空間不足，請刪除部分暫存作品後再試。', back: '返回離線暫存',
      noAudio: '這個作品沒有可暫存的音軌。', empty: '還沒有暫存作品。連線時，在已購音訊作品頁點選「暫存音訊」。',
      remove: '刪除暫存', confirm: title => `刪除「${title}」的本機暫存？`, openFailed: '無法讀取離線暫存，請再試一次。',
      playFailed: '無法播放此音軌，請嘗試重新暫存。', removeFailed: '無法刪除暫存，請再試一次。',
    },
    ja: {
      title: 'オフライン', save: '音声を保存', saved: '保存済み', saving: '音声を保存中…', cancel: '保存をキャンセル',
      count: (saved, total) => `${total} 曲中 ${saved} 曲を保存済み`, retry: '保存を再試行', stopped: '保存をキャンセルしました。',
      authorization: '音声を認証できません。ログイン状態と再生権限を確認してください。', catalog: '曲一覧を取得できません。もう一度お試しください。',
      media: '音声のダウンロードに失敗しました。', storage: '音声を保存できません。ブラウザのストレージを確認してください。',
      quota: '空き容量が不足しています。保存済みの作品を削除してください。', back: 'オフラインに戻る',
      noAudio: '保存できる音声がありません。', empty: 'オンライン時に購入済みの音声作品ページから音声を保存できます。',
      remove: '保存を削除', confirm: title => `「${title}」の保存済み音声を削除しますか？`, openFailed: '保存済みの音声を読み込めませんでした。',
      playFailed: 'この音声を再生できません。もう一度保存してください。', removeFailed: '保存済みの音声を削除できませんでした。',
    },
    en: {
      title: 'Offline', save: 'Save audio offline', saved: 'Saved offline', saving: 'Saving audio…', cancel: 'Cancel saving',
      count: (saved, total) => `${saved} of ${total} tracks saved`, retry: 'Retry saving', stopped: 'Saving canceled.',
      authorization: 'Audio authorization failed. Check that you can play this work online.',
      catalog: 'Could not load the track list. Try again.', media: 'Could not download the audio. Try again.',
      storage: 'Could not write the offline copy. Check browser storage.', back: 'Back to offline',
      quota: 'Storage is full. Remove some saved works and try again.',
      noAudio: 'This work has no audio tracks available to save.',
      empty: 'No saved works yet. While online, open a purchased audio work and select “Save audio offline.”',
      remove: 'Remove saved audio', confirm: title => `Remove the saved audio for “${title}”?`,
      openFailed: 'Could not read saved audio. Try again.', playFailed: 'Could not play this track. Try saving it again.',
      removeFailed: 'Could not remove saved audio. Try again.',
    },
    ko: {
      title: '오프라인', save: '오디오 저장', saved: '저장됨', saving: '오디오 저장 중…', cancel: '저장 취소',
      count: (saved, total) => `${total}개 중 ${saved}개 저장됨`, retry: '저장 다시 시도', stopped: '저장을 취소했습니다.',
      authorization: '오디오 인증에 실패했습니다. 온라인으로 재생할 수 있는지 확인하세요.', catalog: '트랙 목록을 읽을 수 없습니다.',
      media: '오디오를 다운로드하지 못했습니다.', storage: '오디오를 저장할 수 없습니다. 브라우저 저장 공간을 확인하세요.',
      quota: '저장 공간이 부족합니다. 저장된 작품을 삭제하세요.', back: '오프라인으로 돌아가기',
      noAudio: '저장할 수 있는 오디오가 없습니다.', empty: '온라인 상태에서 구매한 오디오 작품 페이지의 저장 버튼을 누르세요.',
      remove: '저장 삭제', confirm: title => `“${title}”의 저장된 오디오를 삭제할까요?`, openFailed: '저장된 오디오를 읽을 수 없습니다.',
      playFailed: '이 트랙을 재생할 수 없습니다. 다시 저장해 보세요.', removeFailed: '저장된 오디오를 삭제할 수 없습니다.',
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

  function paintWork(view) {
    const job = jobs.get(view.workno);
    const state = job ?? view.result;
    const { labels } = view;
    const retry = state?.message || (state && state.saved < state.total);
    const complete = isSaved(state);
    setText(view.saveLabel, job ? labels.saving : complete ? labels.saved : retry ? labels.retry : labels.save);
    setText(view.cancel, labels.cancel);
    view.save.disabled = Boolean(job || complete);
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
      const record = await DLookOfflineStore.start(view.work, catalog.revision, catalog.tracks);
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
        let blob;
        try {
          blob = await download.audio(track.asset);
        } catch (error) {
          if (signal.aborted || error.phase === 'authorization') throw error;
          job.message = 'media';
          job.httpStatus = error.status;
          continue;
        }
        const captions = track.captionAsset && await download.captions(track.captionAsset).catch(() => undefined);
        if (signal.aborted) throw signal.reason;
        job.saved = await DLookOfflineStore.save(record, track, blob, captions);
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
        const view = { workno, node, status, save, saveLabel, cancel: button(), probe: new AbortController() };
        view.save.onclick = () => saveWork(view);
        view.cancel.onclick = () => jobs.get(workno)?.controller.abort();
        node.append(view.save, view.cancel, status);
        workView = view;
        const locale = { ja: 'ja_JP', en: 'en_US', ko: 'ko_KR', zh: 'zh_CN' }[language] ??
          language.replace(/-([a-z]{2})$/, (_, suffix) => '_' + suffix.toUpperCase());
        Promise.all([
          DLookOfflineSource.identify(workno, locale, view.probe.signal).catch(() => null),
          DLookOfflineStore.work(workno).catch(() => null),
        ]).then(([work, cached]) => {
          if ((!work && !cached) || workView !== view) return;
          view.work = work ?? cached;
          view.result ??= cached && { saved: cached.tracks.length, total: cached.total };
          mountWork(view);
        }).catch(() => {});
      }
    }
    if (!workView) return;
    workView.labels = text(language);
    workView.pane = page.pane;
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
        showWork(selection.work);
        if (!isOpen() && !DLookPlaySite.navigate(href)) location.assign(href);
      },
      onShuffle() {
        shuffle = !shuffle;
        if (selection) setOrder(selection.tracks.length, selection.index);
        return shuffle;
      },
      onRepeat() {
        repeat = { off: 'all', all: 'track', track: 'off' }[repeat];
        player.audio.loop = repeat === 'track';
        return repeat;
      },
      onError() {
        if (selection) {
          notice.textContent = labels.playFailed;
          player.error(labels.playFailed);
        }
      },
    });
    const { audio } = player;
    const current = { shell, language, stop, refresh, releaseCovers, collapse: player.collapse };
    let selection, playingUrl, opened, selectionRequest = 0, refreshRequest = 0;
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
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (playingUrl) URL.revokeObjectURL(playingUrl);
      playingUrl = undefined;
      selection = undefined;
      player.hide();
      markTrack(null);
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
      const { work, tracks, index } = selection;
      const offset = order.indexOf(index) + direction;
      const next = repeat === 'all' ? (offset + order.length) % order.length : offset;
      if (direction < 0 && (audio.currentTime > 5 || next < 0)) {
        audio.currentTime = 0;
      } else if (order[next] === index && ended) {
        audio.currentTime = 0;
        player.resume();
      } else if (next >= 0 && next < order.length) {
        play(work, tracks, order[next], false);
      }
    }

    async function play(work, tracks, index, open = true) {
      const id = ++selectionRequest;
      try {
        const track = tracks[index];
        const [blob, captions] = await Promise.all([
          DLookOfflineStore.track(work, track.asset),
          DLookOfflineStore.captions(work, track.asset).catch(() => []),
        ]);
        if (id !== selectionRequest) return;
        if (!blob) throw new Error('Missing offline track');
        if (open) {
          document.querySelector('#App [data-dd-action-name="player.minimize"]')?.click();
          if (!closeNativeMini()) requestAnimationFrame(closeNativeMini);
        }
        if (playingUrl) URL.revokeObjectURL(playingUrl);
        playingUrl = URL.createObjectURL(blob);
        if (open || selection?.work.workno !== work.workno) setOrder(tracks.length, index);
        selection = { work, tracks, index };
        audio.src = playingUrl;
        audio.setAttribute('aria-label', track.name);
        player.show(work, track, open, captions);
        notice.textContent = '';
        markTrack(trackButtons.get(work.workno)?.[index]);
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
        control.onclick = () => play(work, tracks, index);
        if (selection?.work.workno === work.workno && selection.tracks[selection.index].asset === track.asset) {
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
          if (selection?.work.workno === work.workno) stop();
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
    if ((!showPlayer || nativePlaying) && library.shell.querySelector('audio[src]')) library.stop();
  }

  function dispose() {
    if (!library) return;
    window.removeEventListener('focus', library.refresh);
    library.stop();
    library.releaseCovers();
    library.shell.remove();
    library = undefined;
  }

  return { href, isOpen, label: language => text(language).title, updateWork, show, hide };
})();
