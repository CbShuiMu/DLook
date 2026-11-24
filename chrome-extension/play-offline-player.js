const DLookOfflinePlayer = (() => {
  const labels = {
    'zh-cn': ['展开播放器', '收起播放器', '关闭播放器', '播放', '暂停', '上一轨', '下一轨', '播放进度', '随机播放', '循环播放', '播放速度', '打开音轨列表'],
    'zh-tw': ['展開播放器', '收起播放器', '關閉播放器', '播放', '暫停', '上一軌', '下一軌', '播放進度', '隨機播放', '循環播放', '播放速度', '開啟音軌清單'],
    ja: ['プレーヤーを開く', 'プレーヤーを縮小', 'プレーヤーを閉じる', '再生', '一時停止', '前のトラック', '次のトラック', '再生位置', 'シャッフル', 'リピート', '再生速度', '曲一覧を開く'],
    ko: ['플레이어 펼치기', '플레이어 접기', '플레이어 닫기', '재생', '일시정지', '이전 트랙', '다음 트랙', '재생 위치', '셔플', '반복 재생', '재생 속도', '트랙 목록 열기'],
    en: ['Expand player', 'Minimize player', 'Close player', 'Play', 'Pause', 'Previous track', 'Next track', 'Playback position', 'Shuffle', 'Repeat', 'Playback speed', 'Open track list'],
  };
  const subtitleLabels = { zh: '字幕', ja: '字幕', ko: '자막', en: 'Subtitles' };

  function element(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function iconButton(name, label, action) {
    const button = element('button', 'dlook-audio-button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    if (name) button.append(DLookPlayIcons.create(name));
    button.onclick = action;
    return button;
  }

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(value));
    return [Math.floor(seconds / 60), seconds % 60].map(part => String(part).padStart(2, '0')).join(':');
  }

  function create(language, { cover, onClose, onSkip, onEnded, onShuffle, onRepeat, onQueue, onError }) {
    const [expandLabel, minimizeLabel, closeLabel, playLabel, pauseLabel, previousLabel, nextLabel,
      seekLabel, shuffleLabel, repeatLabel, speedLabel, queueLabel] =
      labels[language] ?? labels[language.split('-')[0]] ?? labels.en;
    const expanded = element('section', 'dlook-offline-player');
    const stage = element('div', 'dlook-audio-stage');
    const artwork = element('div', 'dlook-audio-art');
    const image = element('img');
    image.alt = '';
    image.hidden = true;
    artwork.append(DLookPlayIcons.create('playlist'), image);
    const captions = element('div', 'dlook-audio-captions');
    captions.hidden = true;
    const renderCaptions = DLookPlayCaptions.timeline(captions);

    const mini = element('div', 'dlook-offline-mini');
    const audio = element('audio');
    audio.hidden = true;
    audio.preload = 'metadata';
    let artworkKey, artworkUrl, artworkRequest = 0, artworkPending = false, playing;
    let hasTrack = false;
    let cues = [];
    let showCaptions = true;

    function setExpanded(open, focus = false) {
      expanded.hidden = !hasTrack || !open;
      mini.hidden = !hasTrack || open;
      if (focus && hasTrack) (open ? minimize : openMini).focus({ preventScroll: true });
    }

    const minimize = iconButton('minimize', minimizeLabel, () => setExpanded(false, true));
    minimize.classList.add('dlook-audio-minimize');
    const queue = iconButton('playlist', queueLabel, () => {
      onQueue();
      setExpanded(false, true);
    });
    queue.classList.add('dlook-audio-queue');
    const speed = element('select', 'dlook-audio-speed');
    speed.setAttribute('aria-label', speedLabel);
    for (const rate of [.5, .75, 1, 1.25, 1.5, 1.75, 2]) {
      const option = element('option');
      option.value = rate;
      option.textContent = `${rate}×`;
      speed.append(option);
    }
    speed.value = 1;
    speed.onchange = () => { audio.playbackRate = Number(speed.value); };
    const subtitleLabel = subtitleLabels[language.split('-')[0]] ?? subtitleLabels.en;
    const subtitle = iconButton('captions', subtitleLabel, () => {
      DLookPlayPlayer.animateCover(stage);
      showCaptions = !showCaptions;
      subtitle.setAttribute('aria-pressed', String(showCaptions));
      captions.hidden = !showCaptions;
    });
    subtitle.className = 'dlook-caption-toggle';
    subtitle.setAttribute('aria-pressed', 'true');
    subtitle.hidden = true;
    stage.append(artwork, captions, minimize, queue, speed, subtitle);

    const controls = element('div', 'dlook-audio-controls');
    const title = element('div', 'dlook-audio-title');
    const album = element('div', 'dlook-audio-album');
    const status = element('p', 'dlook-audio-status');
    status.setAttribute('role', 'status');
    const seek = element('div', 'dlook-audio-seek');
    const position = element('input', 'dlook-audio-position');
    position.type = 'range';
    position.min = position.max = 0;
    position.step = .1;
    position.disabled = true;
    position.setAttribute('aria-label', seekLabel);
    position.oninput = () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(position.value); };
    const elapsed = element('span', 'dlook-audio-elapsed');
    const remaining = element('span', 'dlook-audio-remaining');
    seek.append(position, elapsed, remaining);

    function resume() {
      audio.play().catch(error => { if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') onError(); });
    }

    function togglePlayback() {
      if (audio.paused || audio.ended) resume();
      else audio.pause();
    }

    const transport = element('div', 'dlook-audio-transport');
    const play = iconButton(null, playLabel, togglePlayback);
    play.dataset.control = 'play-pause';
    const previous = iconButton('previous', previousLabel, () => onSkip(-1));
    const next = iconButton('next', nextLabel, () => onSkip(1));
    previous.dataset.control = 'backward';
    next.dataset.control = 'forward';
    const shuffle = iconButton('shuffle', shuffleLabel, () => shuffle.setAttribute('aria-pressed', String(onShuffle())));
    shuffle.setAttribute('aria-pressed', 'false');
    const repeat = iconButton('repeat', repeatLabel, () => {
      const mode = onRepeat();
      repeat.dataset.repeat = mode;
      repeat.setAttribute('aria-pressed', String(mode !== 'off'));
    });
    repeat.setAttribute('aria-pressed', 'false');
    transport.append(shuffle, previous, play, next, repeat);
    controls.append(title, album, seek, transport, status);
    expanded.append(stage, controls);

    const openMini = iconButton(null, expandLabel, () => setExpanded(true, true));
    openMini.classList.add('dlook-audio-mini-open');
    const thumbnail = element('span', 'dlook-audio-mini-thumb');
    const thumb = element('img');
    thumb.alt = '';
    thumb.hidden = true;
    thumbnail.append(DLookPlayIcons.create('playlist'), thumb);
    const miniText = element('span', 'dlook-audio-mini-text');
    const miniTitle = element('strong');
    const miniAlbum = element('small');
    miniText.append(miniTitle, miniAlbum);
    openMini.append(thumbnail, miniText);
    const miniPlay = iconButton(null, playLabel, togglePlayback);
    mini.append(openMini, miniPlay, iconButton('close', closeLabel, onClose));

    function updateControls() {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const time = Math.min(duration, audio.currentTime || 0);
      const progress = duration ? time / duration : 0;
      renderCaptions(cues, time);
      position.disabled = !duration;
      position.max = duration;
      position.value = time;
      position.setAttribute('aria-valuetext', formatTime(time));
      elapsed.textContent = formatTime(time);
      remaining.textContent = formatTime(duration - time);
      position.style.setProperty('--dlook-audio-progress', `${progress * 100}%`);
      mini.style.setProperty('--dlook-audio-progress', `${progress * 100}%`);
      const isPlaying = !audio.paused && !audio.ended;
      if (isPlaying !== playing) {
        playing = isPlaying;
        for (const button of [play, miniPlay]) {
          button.setAttribute('aria-label', playing ? pauseLabel : playLabel);
          button.replaceChildren(DLookPlayIcons.create(playing ? 'pause' : 'play'));
        }
      }
    }

    function clearCover() {
      artworkRequest += 1;
      artworkPending = false;
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
      artworkUrl = artworkKey = undefined;
      for (const node of [image, thumb]) {
        node.hidden = true;
        node.removeAttribute('src');
      }
      artwork.style.removeProperty('--dlook-cover-ratio');
    }

    function show(work, track, open, trackCaptions = []) {
      hasTrack = true;
      cues = trackCaptions;
      subtitle.hidden = !cues.length;
      captions.hidden = !cues.length || !showCaptions;
      renderCaptions(cues, 0);
      title.textContent = miniTitle.textContent = track.name;
      album.textContent = miniAlbum.textContent = work.title;
      status.textContent = '';
      openMini.setAttribute('aria-label', `${expandLabel} · ${track.name}`);
      setExpanded(open || !expanded.hidden, open);
      if (work.workno === artworkKey && (artworkUrl || artworkPending)) return;
      clearCover();
      artworkKey = work.workno;
      if (!work.hasCover) return;
      const request = artworkRequest;
      artworkPending = true;
      cover(work.workno).then(data => {
        if (request !== artworkRequest || !data?.bytes) return;
        artworkUrl = URL.createObjectURL(new Blob([data.bytes], { type: data.type }));
        for (const node of [image, thumb]) {
          node.onload = () => {
            if (request !== artworkRequest) return;
            node.hidden = false;
            if (node === image) DLookPlayPlayer.fitCover(artwork, node);
          };
          node.src = artworkUrl;
        }
      }).catch(() => {}).finally(() => { if (request === artworkRequest) artworkPending = false; });
    }

    for (const event of ['timeupdate', 'seeking', 'durationchange', 'play', 'pause', 'ended', 'emptied']) {
      audio.addEventListener(event, updateControls);
    }
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    expanded.addEventListener('keydown', event => {
      if (event.key === 'Escape') setExpanded(false, true);
    });
    setExpanded(false);
    updateControls();
    return {
      audio, elements: [expanded, mini, audio], show, resume, collapse: () => setExpanded(false),
      error(message) { status.textContent = message; },
      hide() {
        hasTrack = false;
        cues = [];
        captions.hidden = true;
        subtitle.hidden = true;
        renderCaptions(cues, 0);
        setExpanded(false);
        clearCover();
      },
    };
  }

  return { create };
})();
