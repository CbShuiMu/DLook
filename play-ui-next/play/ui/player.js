// DLook Next player: one <video> element plays both audio and video tracks.
// Desktop: a glass dock bar under the content and an expanded "Now Playing" view that uses
// the width for cover + captions/queue side by side. Mobile: a floating mini player above the
// tab bar that expands into a full-screen sheet (drag down to close, swipe the cover to skip).
import { h, clear, formatTime, scrollWithin } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, localized } from '../core/i18n.js';
import * as prefs from '../core/prefs.js';
import * as kit from './kit.js';
import * as offline from '../data/offline.js';
import * as progress from '../data/progress.js';
import * as covers from '../data/covers.js';
import { timeline } from './captions.js';

const RATES = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const SLEEP = [5, 10, 15, 30, 45, 60, 90];

// Captions cycle: off → lyrics (previous / current / next) → single line → off.
const CAPTION_MODES = ['off', 'lyrics', 'single'];
const captionMode = () => CAPTION_MODES.includes(prefs.get('captionMode')) ? prefs.get('captionMode') : 'lyrics';
const captionLabel = mode => `${t('captions')} · ${t({ off: 'captionsOff', lyrics: 'captionsLyrics', single: 'captionsSingle' }[mode])}`;

export function createPlayer(app, root) {
  const media = h('video', { class: 'media', playsInline: true, preload: 'metadata' });
  media.setAttribute('playsinline', '');
  media.volume = Math.min(1, Math.max(0, prefs.get('volume') ?? 1));

  // iOS Safari only lets a media element start playback inside a user gesture. Tracks are
  // resolved over the network first, so the gesture would have expired by then. Play a
  // tiny silent clip on this same element during the first tap to unlock it for later.
  const silent = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    for (const type of ['touchend', 'pointerup', 'keydown']) document.removeEventListener(type, unlock, true);
    if (media.getAttribute('src')) return;
    media.muted = true;
    media.src = silent;
    media.play().then(() => {
      media.pause();
    }).catch(() => {}).finally(() => {
      if (media.src === silent) { media.removeAttribute('src'); media.load(); }
      media.muted = false;
    });
  };
  for (const type of ['touchend', 'pointerup', 'keydown']) document.addEventListener(type, unlock, { capture: true, passive: true });
  const bus = new EventTarget();
  let selection;                // { queue, index, returnHref }
  let order = [], shuffle = false, repeat = 'off';
  let playingUrls = [], playingLocalVideo = false, report, requestId = 0;
  let cues = [], coverUrl = null, coverKey = null, expanded = false;
  let sleepDeadline = 0, sleepEnd = false, sleepTimer;

  /* ================================================================ UI */
  const art = () => h('div', { class: 'art' }, h('div', { class: 'art-fallback' }, icon('headphones')), h('img', { alt: '', class: 'art-img', hidden: true }));

  // Mini (mobile) / dock (desktop)
  const miniArt = art();
  const miniTitle = h('strong', { class: 'np-title' });
  const miniSub = h('small', { class: 'np-sub' });
  const miniProgress = h('i', { class: 'mini-progress', 'aria-hidden': 'true' });
  const miniPlay = kit.iconButton('playFill', t('play'), () => toggle(), { className: 'mini-play' });
  const miniNext = kit.iconButton('nextFill', t('next'), () => step(1), { className: 'mini-next' });
  const openButton = h('button', { type: 'button', class: 'mini-open', 'aria-label': t('expand'), onclick: () => setExpanded(true) }, miniArt, h('span', { class: 'np-text' }, miniTitle, miniSub));

  // Desktop dock: transport + seek in the middle, tools on the right.
  const dockSeek = seekBar('dock-seek');
  const dockTransport = transportRow('dock');
  const dockTools = h('div', { class: 'dock-tools' },
    rateButton(), captionsButton(), sleepButton(), queueButton(), volumeControl(),
    kit.iconButton('expand', t('expand'), () => setExpanded(!expanded), { className: 'dock-expand' }));
  const dockCenter = h('div', { class: 'dock-center' }, dockTransport.node, dockSeek.node);
  const mini = h('div', { class: 'mini glass', hidden: true, role: 'region', 'aria-label': t('nowPlaying') },
    openButton, dockCenter, dockTools, h('div', { class: 'mini-actions' }, miniPlay, miniNext, kit.iconButton('close', t('close'), () => stop(), { className: 'mini-close', size: 'sm' })), miniProgress);

  // Full player
  const fullArt = art();
  fullArt.classList.add('full-art');
  fullArt.append(media);
  const captionsPane = h('div', { class: 'captions-pane', hidden: true });
  const captionsOutput = h('div', { class: 'captions-out' });
  captionsPane.append(captionsOutput, h('p', { class: 'captions-empty', text: t('noCaptions') }));
  const renderCaptions = timeline(captionsOutput, { scrollContainer: captionsPane, onSeek: time => seek(time) });
  const queuePane = h('div', { class: 'queue-pane', hidden: true });
  const fullTitle = h('h2', { class: 'np-title' });
  const fullWork = h('button', { type: 'button', class: 'np-work', onclick: () => openWork() });
  const status = h('p', { class: 'np-status', role: 'status' });
  const fullSeek = seekBar('full-seek');
  const fullTransport = transportRow('full');
  // Desktop right column: the queue, always visible (captions stay under the cover).
  const sideShuffle = kit.iconButton('shuffle', t('shuffle'), () => setShuffle(!shuffle), { size: 'sm', pressed: false, className: 'tp-shuffle' });
  const sideRepeat = kit.iconButton('repeat', t('repeat'), () => cycleRepeat(), { size: 'sm', pressed: false, className: 'tp-repeat' });
  const sideHead = h('div', { class: 'np-side-head' }, h('h3', { text: t('upNext') }), sideShuffle, sideRepeat);
  const fullTools = h('div', { class: 'full-tools' }, rateButton(), captionsButton(), sleepButton(), queueButton(), pipButton(), moreButton());
  const grabber = h('div', { class: 'np-grabber' }, h('span', { class: 'grabber' }));
  const head = h('header', { class: 'np-head' },
    kit.iconButton('down', t('minimize'), () => setExpanded(false), { className: 'np-collapse', tone: 'soft' }),
    h('div', { class: 'np-head-text' }, h('small', { text: t('nowPlaying') })),
    kit.iconButton('more', t('more'), (e, b) => moreMenu(b), { className: 'np-more', tone: 'soft' }));
  const meta = h('div', { class: 'np-meta' }, fullTitle, fullWork, status);
  const left = h('div', { class: 'np-left' }, h('div', { class: 'np-stage' }, fullArt, captionsPane), meta, fullSeek.node, fullTransport.node, fullTools);
  const right = h('div', { class: 'np-right' }, sideHead, h('div', { class: 'np-side' }));
  const backdrop = h('div', { class: 'np-backdrop', 'aria-hidden': 'true' });
  const full = h('section', { class: 'full', hidden: true, role: 'dialog', 'aria-label': t('nowPlaying') }, backdrop, grabber, head, h('div', { class: 'np-body' }, left, right));
  root.append(mini, full);

  /* ---------------------------------------------------------------- builders */
  function seekBar(className) {
    const input = h('input', { type: 'range', class: 'seek-input', min: 0, max: 0, step: 0.1, value: 0, 'aria-label': t('seek'), disabled: true });
    const elapsed = h('span', { class: 'time elapsed', text: '00:00' });
    const remaining = h('span', { class: 'time remaining', text: '-00:00' });
    const hover = h('span', { class: 'seek-hover', hidden: true });
    let dragging = false;
    input.addEventListener('pointerdown', () => { dragging = true; });
    input.addEventListener('pointerup', () => { dragging = false; });
    input.addEventListener('input', () => {
      const value = Number(input.value);
      input.style.setProperty('--p', `${(value / (Number(input.max) || 1)) * 100}%`);
      elapsed.textContent = formatTime(value);
      remaining.textContent = `-${formatTime((Number(input.max) || 0) - value)}`;
      if (!dragging) seek(value);
    });
    input.addEventListener('change', () => { dragging = false; seek(Number(input.value)); });
    input.addEventListener('pointermove', event => {
      const box = input.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      hover.hidden = !Number(input.max);
      hover.textContent = formatTime(ratio * Number(input.max));
      hover.style.left = `${ratio * 100}%`;
    });
    input.addEventListener('pointerleave', () => { hover.hidden = true; });
    const node = h('div', { class: `seek ${className}` }, h('div', { class: 'seek-track' }, input, hover), h('div', { class: 'seek-times' }, elapsed, remaining));
    return {
      node,
      update(time, duration) {
        if (dragging) return;
        input.disabled = !duration;
        input.max = duration || 0;
        input.value = time;
        input.style.setProperty('--p', `${duration ? (time / duration) * 100 : 0}%`);
        elapsed.textContent = formatTime(time);
        remaining.textContent = `-${formatTime(Math.max(0, duration - time))}`;
      },
    };
  }

  function transportRow(kind) {
    const play = kit.iconButton('playFill', t('play'), () => toggle(), { className: 'tp-play', size: kind === 'full' ? 'xl' : 'lg' });
    const node = h('div', { class: `transport tp-${kind}` },
      kit.iconButton('shuffle', t('shuffle'), () => setShuffle(!shuffle), { className: 'tp-shuffle', pressed: false, size: 'sm' }),
      kit.iconButton('back15', `${t('back15')} ${prefs.get('skipBack')}s`, () => seek(media.currentTime - prefs.get('skipBack')), { className: 'tp-back' }),
      kit.iconButton('previousFill', t('previous'), () => step(-1), { className: 'tp-prev' }),
      play,
      kit.iconButton('nextFill', t('next'), () => step(1), { className: 'tp-next' }),
      kit.iconButton('fwd30', `${t('fwd30')} ${prefs.get('skipForward')}s`, () => seek(media.currentTime + prefs.get('skipForward')), { className: 'tp-fwd' }),
      kit.iconButton('repeat', t('repeat'), () => cycleRepeat(), { className: 'tp-repeat', pressed: false, size: 'sm' }));
    return { node, play };
  }

  function rateButton() {
    const button = h('button', { type: 'button', class: 'ib rate', 'aria-label': t('speed'), title: t('speed'), onclick: () => rateMenu(button) }, h('span', { class: 'rate-text', text: '1×' }));
    return button;
  }
  function captionsButton() {
    const button = kit.iconButton('captions', t('captions'), () => cycleCaptions(), { className: 'tb-captions' });
    button.append(h('span', { class: 'tb-badge' }));
    paintCaptionsButton(button);
    return button;
  }
  function paintCaptionsButton(button) {
    const mode = captionMode();
    button.setAttribute('aria-pressed', String(mode !== 'off'));
    button.dataset.mode = mode;
    button.title = captionLabel(mode);
    button.setAttribute('aria-label', button.title);
    button.querySelector('.tb-badge').textContent = mode === 'single' ? '1' : '';
  }
  function sleepButton() {
    const button = kit.iconButton('timer', t('sleep'), () => sleepMenu(button), { className: 'tb-sleep', pressed: false });
    button.append(h('span', { class: 'tb-badge' }));
    return button;
  }
  function queueButton() {
    return kit.iconButton('queue', t('queue'), () => openQueue(), { className: 'tb-queue' });
  }
  function pipButton() {
    return kit.iconButton('pip', t('pip'), () => {
      if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
      else media.requestPictureInPicture?.().catch(() => {});
    }, { className: 'tb-pip' });
  }
  function moreButton() {
    return kit.iconButton('more', t('more'), (e, b) => moreMenu(b), { className: 'tb-more' });
  }
  function volumeControl() {
    const range = h('input', { type: 'range', class: 'volume-input', min: 0, max: 1, step: 0.01, value: media.volume, 'aria-label': t('volume') });
    const button = kit.iconButton('volume', t('mute'), () => { media.muted = !media.muted; }, { className: 'tb-mute', size: 'sm' });
    range.style.setProperty('--p', `${media.volume * 100}%`);
    range.addEventListener('input', () => {
      media.volume = Number(range.value);
      media.muted = media.volume === 0;
      range.style.setProperty('--p', `${media.volume * 100}%`);
      prefs.set('volume', media.volume);
    });
    media.addEventListener('volumechange', () => {
      clear(button, icon(media.muted || !media.volume ? 'mute' : 'volume'));
      range.value = media.muted ? 0 : media.volume;
      range.style.setProperty('--p', `${(media.muted ? 0 : media.volume) * 100}%`);
    });
    return h('div', { class: 'volume' }, button, range);
  }

  /* ---------------------------------------------------------------- menus */
  function rateMenu(anchor) {
    kit.menu(anchor, RATES.map(rate => ({ label: `${rate}×`, checked: media.playbackRate === rate, onSelect: () => setRate(rate) })), { title: t('speed') });
  }
  function setRate(rate) {
    media.playbackRate = rate;
    const workno = currentItem()?.work.workno;
    if (workno) prefs.set('rates', { ...prefs.get('rates'), [workno]: rate });
    for (const node of root.querySelectorAll('.rate-text')) node.textContent = `${rate}×`;
    for (const node of root.querySelectorAll('.rate')) node.toggleAttribute('data-active', rate !== 1);
  }
  function sleepMenu(anchor) {
    const remaining = sleepDeadline ? Math.ceil((sleepDeadline - Date.now()) / 60000) : 0;
    kit.menu(anchor, [
      sleepDeadline || sleepEnd ? { section: sleepEnd ? t('sleepEnd') : `${t('remaining')} ${t('minutes', remaining)}` } : null,
      ...SLEEP.map(minutes => ({ label: t('minutes', minutes), icon: 'timer', onSelect: () => setSleep(minutes) })),
      { label: t('sleepEnd'), icon: 'stack', checked: sleepEnd, onSelect: () => setSleep('end') },
      sleepDeadline || sleepEnd ? 'separator' : null,
      sleepDeadline || sleepEnd ? { label: t('cancelTimer'), icon: 'close', destructive: true, onSelect: () => setSleep(0) } : null,
    ], { title: t('sleep') });
  }
  function setSleep(value) {
    clearTimeout(sleepTimer);
    sleepEnd = value === 'end';
    sleepDeadline = typeof value === 'number' && value > 0 ? Date.now() + value * 60000 : 0;
    tickSleep();
    if (value) kit.toast(value === 'end' ? `${t('sleep')} · ${t('sleepEnd')}` : `${t('sleep')} · ${t('minutes', value)}`, { icon: 'timer' });
  }
  function tickSleep() {
    clearTimeout(sleepTimer);
    const left = sleepDeadline ? sleepDeadline - Date.now() : 0;
    if (sleepDeadline && left <= 0) {
      sleepDeadline = 0;
      fadeOutAndPause();
    }
    const active = Boolean(sleepDeadline) || sleepEnd;
    for (const button of root.querySelectorAll('.tb-sleep')) {
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('.tb-badge').textContent = sleepDeadline ? String(Math.ceil(left / 60000)) : sleepEnd ? '•' : '';
    }
    if (sleepDeadline) sleepTimer = setTimeout(tickSleep, Math.min(left, 15000));
  }
  function fadeOutAndPause() {
    // A gentle 8-second fade instead of an abrupt stop.
    const start = media.volume, began = performance.now();
    const fade = () => {
      const ratio = Math.min(1, (performance.now() - began) / 8000);
      media.volume = start * (1 - ratio);
      if (ratio < 1 && !media.paused) requestAnimationFrame(fade);
      else { media.pause(); media.volume = start; }
    };
    fade();
  }
  document.addEventListener('visibilitychange', () => { if (sleepDeadline) tickSleep(); });

  function moreMenu(anchor) {
    const item = currentItem();
    if (!item) return;
    kit.menu(anchor, [
      { label: shuffle ? `${t('shuffle')} ✓` : t('shuffle'), icon: 'shuffle', checked: shuffle, onSelect: () => setShuffle(!shuffle) },
      { label: t(repeat === 'off' ? 'repeatOff' : repeat === 'all' ? 'repeatAll' : 'repeatOne'), icon: repeat === 'one' ? 'repeatOne' : 'repeat', onSelect: () => cycleRepeat() },
      'separator',
      { label: localized(item.work.name) || item.work.title, hint: t('details'), icon: 'library', onSelect: () => openWork() },
      selection?.returnHref ? { label: t('fromQueue'), icon: 'back', onSelect: () => { setExpanded(false); app.go(selection.returnHref); } } : null,
      'separator',
      { label: t('close'), icon: 'close', destructive: true, onSelect: () => stop() },
    ], { title: item.track.name });
  }

  /* ---------------------------------------------------------------- queue */
  function queueList(onPick) {
    const list = h('ol', { class: 'queue-list' });
    if (!selection) return list;
    const position = order.indexOf(selection.index);
    const upcoming = [...order.slice(position), ...(repeat === 'all' ? order.slice(0, position) : [])];
    let lastWork;
    for (const index of upcoming) {
      const item = selection.queue[index];
      const title = localized(item.work.name) || item.work.title || item.work.workno;
      if (item.work.workno !== lastWork && selection.queue.some(entry => entry.work.workno !== item.work.workno)) {
        list.append(h('li', { class: 'queue-work', text: title }));
      }
      lastWork = item.work.workno;
      const row = h('li', { class: 'queue-row' }, h('button', {
        type: 'button', class: 'queue-item', 'aria-current': index === selection.index ? 'true' : undefined,
        onclick: () => { play(selection.queue, index, { resume: true }); onPick?.(); },
      },
      h('span', { class: 'queue-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('span', { class: 'queue-name' }, h('strong', { text: item.track.name }), item.track.folder ? h('small', { text: item.track.folder }) : null),
      h('span', { class: 'queue-flag' }, item.stream ? null : icon('downloaded'))));
      list.append(row);
    }
    return list;
  }
  function openQueue() {
    if (expanded && app.mode() === 'desktop') { refreshQueue(true); return; }
    // Shuffle and repeat live in the queue header on phones (the transport row stays uncluttered).
    const shuffleToggle = kit.iconButton('shuffle', t('shuffle'), () => { setShuffle(!shuffle); shuffleToggle.setAttribute('aria-pressed', String(shuffle)); clear(body, queueList(() => close())); }, { size: 'sm', pressed: shuffle, className: 'tp-shuffle' });
    const repeatToggle = kit.iconButton(repeat === 'one' ? 'repeatOne' : 'repeat', t('repeat'), () => cycleRepeat(), { size: 'sm', pressed: repeat !== 'off', className: 'tp-repeat' });
    const { body, close } = kit.sheet({ title: t('upNext'), className: 'queue-sheet', actions: [shuffleToggle, repeatToggle] });
    body.append(queueList(() => close()));
    requestAnimationFrame(() => scrollWithin(body, body.querySelector('[aria-current="true"]')));
  }
  /** Re-renders the desktop queue column (only while it is visible). */
  function refreshQueue(scroll = false) {
    if (!expanded || app.mode() !== 'desktop') return;
    const side = right.querySelector('.np-side');
    clear(side, queueList());
    if (scroll) requestAnimationFrame(() => scrollWithin(side, side.querySelector('[aria-current="true"]')));
  }
  /**
   * Like the original DLook player: the cover stays on top and shrinks to leave room for
   * three caption lines (previous / current / next) underneath it.
   */
  /**
   * The caption area follows the captions switch, also for tracks without captions (it then
   * says so), so the cover or video always sits in the same place for the same setting.
   */
  function layoutCaptions() {
    const mode = captionMode();
    const show = mode !== 'off';
    captionsPane.hidden = !show;
    captionsPane.dataset.mode = mode;
    full.toggleAttribute('data-captions', show);
    captionsPane.toggleAttribute('data-empty', !cues.length);
    if (show && cues.length) requestAnimationFrame(() => renderCaptions(cues, media.currentTime || 0));
  }
  /** Runs a layout change and animates the cover from its old box to the new one (FLIP). */
  function animateStage(change) {
    if (!expanded || full.hidden || kit.reducedMotion.matches) { change(); return; }
    const before = fullArt.getBoundingClientRect();
    const wasShown = !captionsPane.hidden;
    change();
    const after = fullArt.getBoundingClientRect();
    if (!before.width || !after.width) return;
    // Measured around the centre so the resting transform (e.g. the paused shrink) is kept.
    const dx = (before.left + before.width / 2) - (after.left + after.width / 2);
    const dy = (before.top + before.height / 2) - (after.top + after.height / 2);
    const sx = before.width / after.width, sy = before.height / after.height;
    const rest = getComputedStyle(fullArt).transform;
    const base = rest === 'none' ? '' : rest;
    fullArt.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) ${base}`.trim() },
      { transform: base || 'none' },
    ], { duration: 520, easing: kit.spring });
    if (!wasShown && !captionsPane.hidden) {
      captionsPane.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: 120, easing: kit.spring, fill: 'backwards' });
    }
  }
  function cycleCaptions() {
    const mode = CAPTION_MODES[(CAPTION_MODES.indexOf(captionMode()) + 1) % CAPTION_MODES.length];
    prefs.set('captionMode', mode);
    if (!expanded && mode !== 'off') setExpanded(true);
    kit.toast(captionLabel(mode), { icon: 'captions', duration: 1600 });
  }
  /** Also follows the setting when it is changed on the settings page or in another tab. */
  function applyCaptionMode() {
    for (const button of root.querySelectorAll('.tb-captions')) paintCaptionsButton(button);
    if (!expanded && captionMode() !== 'off') { layoutCaptions(); return; }
    animateStage(layoutCaptions);
  }
  prefs.onChange(name => { if (name === 'captionMode') applyCaptionMode(); });

  /* ---------------------------------------------------------------- expand / collapse */
  // The mini player (the dock on desktop) is the card that spreads out to fill the screen while
  // the cover flies from its thumbnail to the top of the page; collapsing plays it in reverse.
  let morph;
  function setExpanded(open) {
    if (!selection || open === expanded) return;
    expanded = open;
    morph?.forEach(animation => animation.cancel());
    morph = [];
    const miniBox = mini.getBoundingClientRect();
    const fromArt = (open ? miniArt : fullArt).getBoundingClientRect();
    full.style.transform = '';
    full.hidden = false;
    full.toggleAttribute('data-open', open);
    app.frame.toggleAttribute('data-player-open', open);
    if (open) { layoutCaptions(); refreshQueue(true); }
    const fullBox = full.getBoundingClientRect();
    const toArt = (open ? fullArt : miniArt).getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(full).borderTopLeftRadius) || 0;
    const cardRadius = parseFloat(getComputedStyle(mini).borderTopLeftRadius) || 22;
    const cardClip = `inset(${miniBox.top - fullBox.top}px ${fullBox.right - miniBox.right}px ${fullBox.bottom - miniBox.bottom}px ${miniBox.left - fullBox.left}px round ${cardRadius}px)`;
    const fullClip = `inset(0px 0px 0px 0px round ${radius}px)`;
    const duration = open ? 560 : 440;
    const easing = kit.spring;
    const finish = () => {
      if (!expanded) { full.hidden = true; full.removeAttribute('data-open'); }
      fullArt.style.visibility = miniArt.style.visibility = '';
    };
    if (kit.reducedMotion.matches || !miniBox.width) { finish(); return; }

    // 0. A layer in the mini card's own colour sits over the dark backdrop and fades away while
    //    the card opens (or fades in while it folds back), so the background colour morphs too.
    full.querySelectorAll('.np-skin').forEach(node => node.remove());
    const cardColor = getComputedStyle(mini).backgroundColor;
    const pageColor = getComputedStyle(app.frame).backgroundColor;
    const skin = h('div', { class: 'np-skin', 'aria-hidden': 'true', style: { background: `linear-gradient(${cardColor}, ${cardColor}), ${pageColor}` } });
    backdrop.after(skin);
    const skinFade = skin.animate(open ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
      { duration: open ? duration * 0.7 : duration, easing: open ? 'ease-out' : 'ease-in', fill: 'both' });
    skinFade.finished.catch(() => {}).finally(() => skin.remove());
    morph.push(skinFade);
    // 1. The card itself spreads out (or folds back) via clip-path.
    morph.push(full.animate([{ clipPath: open ? cardClip : fullClip }, { clipPath: open ? fullClip : cardClip }], { duration, easing, fill: 'both' }));
    // 2. Everything but the cover fades in once the card has opened up (and out first when closing).
    for (const node of full.querySelectorAll('.np-head, .np-meta, .seek, .transport, .full-tools, .np-right, .captions-pane, .np-grabber')) {
      morph.push(node.animate(open
        ? [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 1 }, { opacity: 0 }],
      { duration: open ? 360 : 140, delay: open ? 170 : 0, easing: open ? kit.spring : 'ease-in', fill: 'both' }));
    }
    // 3. The mini card hides under the morph and comes back as the card folds into it.
    morph.push(mini.animate(open ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: .82 }, { opacity: 1 }],
      { duration: open ? 120 : duration, fill: 'forwards' }));
    // 4. Shared cover: travels between the thumbnail and the big artwork, resizing on the way.
    const image = fullArt.querySelector('.art-img');
    if (fromArt.width && toArt.width && !image.hidden && !full.hasAttribute('data-video')) {
      const flyer = h('div', { class: 'flying-art', style: { backgroundImage: `url(${JSON.stringify(image.src)})` } });
      app.shadow.querySelector('.overlays').append(flyer);
      const box = rect => ({ left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      fullArt.style.visibility = miniArt.style.visibility = 'hidden';
      const flight = flyer.animate([{ ...box(fromArt), borderRadius: open ? '11px' : '22px' }, { ...box(toArt), borderRadius: open ? '22px' : '11px' }], { duration, easing, fill: 'both' });
      flight.finished.catch(() => {}).finally(() => flyer.remove());
      morph.push(flight);
    }
    const ticket = morph;
    Promise.allSettled(morph.map(animation => animation.finished)).then(() => {
      if (ticket !== morph) return;
      finish();
      for (const animation of ticket) animation.cancel();
      morph = undefined;
    });
    if (open) requestAnimationFrame(() => head.querySelector('.np-collapse').focus({ preventScroll: true }));
    else openButton.focus({ preventScroll: true });
  }
  kit.dragToDismiss(full, grabber, () => setExpanded(false), { threshold: 110 });
  full.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); setExpanded(false); } });

  // Swipe the mobile cover left/right to change track.
  {
    let startX, startY;
    fullArt.addEventListener('pointerdown', event => { if (app.mode() === 'mobile' && !full.hasAttribute('data-video')) { startX = event.clientX; startY = event.clientY; } });
    fullArt.addEventListener('pointerup', event => {
      if (startX === undefined) return;
      const dx = event.clientX - startX, dy = event.clientY - startY;
      startX = undefined;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        kit.animate(fullArt, [{ transform: `translateX(${dx > 0 ? 40 : -40}px)`, opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 360 });
        step(dx > 0 ? -1 : 1);
      }
    });
  }

  /* ---------------------------------------------------------------- engine */
  const currentItem = () => selection?.queue[selection.index];

  function setShuffle(value) {
    shuffle = value;
    if (selection) setOrder(selection.queue.length, selection.index);
    for (const button of app.shadow.querySelectorAll('.tp-shuffle')) button.setAttribute('aria-pressed', String(shuffle));
    refreshQueue();
  }
  function cycleRepeat() {
    repeat = { off: 'all', all: 'one', one: 'off' }[repeat];
    media.loop = repeat === 'one';
    for (const button of app.shadow.querySelectorAll('.tp-repeat')) {
      button.setAttribute('aria-pressed', String(repeat !== 'off'));
      button.setAttribute('aria-label', t(repeat === 'off' ? 'repeatOff' : repeat === 'all' ? 'repeatAll' : 'repeatOne'));
      clear(button, icon(repeat === 'one' ? 'repeatOne' : 'repeat'));
    }
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
  function step(direction, ended = false) {
    if (!selection) return;
    const { queue, index } = selection;
    const offset = order.indexOf(index) + direction;
    const next = repeat === 'all' ? (offset + order.length) % order.length : offset;
    if (direction < 0 && (media.currentTime > 4 || next < 0)) { seek(0); return; }
    if (ended && sleepEnd) { sleepEnd = false; tickSleep(); return; }
    if (ended && !prefs.get('autoplayNext') && repeat === 'off') return;
    if (next >= 0 && next < order.length) play(queue, order[next], { resume: false, keepExpanded: true });
  }
  function seek(time) {
    if (!Number.isFinite(media.duration)) return;
    media.currentTime = Math.min(media.duration, Math.max(0, time));
    update();
  }
  function toggle() {
    if (!selection) return;
    if (media.paused || media.ended) resume();
    else media.pause();
  }
  function resume() {
    media.play().catch(error => { if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') onError(); });
  }

  function reportProgress(completed = media.ended, keepalive = false) {
    const current = report;
    const total = media.duration, position = media.currentTime;
    if (!current || !(position > 0) || !Number.isFinite(total)) return;
    current.meta.then(meta => progress.save(current.workno, meta, position, total, completed, keepalive)).catch(() => {});
  }
  media.addEventListener('pause', () => { if (!media.ended) reportProgress(false); });
  media.addEventListener('ended', () => { reportProgress(true); step(1, true); });
  setInterval(() => { if (!media.paused) reportProgress(false); }, 60000);
  window.addEventListener('pagehide', () => { if (!media.paused) reportProgress(false, true); });

  function release() {
    playingUrls.forEach(url => URL.revokeObjectURL(url));
    playingUrls = [];
  }

  async function play(queue, index, { resume: resumeAt = true, returnHref, expand = false, keepExpanded = false } = {}) {
    const id = ++requestId;
    const item = queue[index];
    if (!item) return false;
    setLoading(true);
    try {
      const meta = offline.progressMeta(item).catch(() => null);
      const [source, position] = await Promise.all([
        offline.resolveTrack(item),
        resumeAt ? meta.then(value => progress.position(item.work.workno, value?.key)) : 0,
      ]);
      if (id !== requestId) { source.revoke.forEach(url => URL.revokeObjectURL(url)); return false; }
      if (report && !media.paused) reportProgress();
      const previousWork = report?.workno;
      report = { workno: item.work.workno, meta };
      if (previousWork !== item.work.workno) progress.open(item.work.workno);
      release();
      playingUrls = source.revoke;
      playingLocalVideo = source.video && source.local;
      if (!selection || selection.queue !== queue) setOrder(queue.length, index);
      selection = { queue, index, returnHref: returnHref ?? selection?.returnHref };
      media.src = source.src;
      if (position > 0) media.currentTime = position;
      media.playbackRate = prefs.get('rates')?.[item.work.workno] ?? 1;
      setRate(media.playbackRate);
      cues = source.captions ?? [];
      full.toggleAttribute('data-video', source.video);
      for (const button of root.querySelectorAll('.tb-pip')) button.hidden = !source.video || !document.pictureInPictureEnabled;
      present(item);
      status.textContent = '';
      resume();
      if (expand || (keepExpanded && expanded)) setExpanded(true);
      bus.dispatchEvent(new Event('change'));
      return true;
    } catch (error) {
      if (id === requestId) {
        status.textContent = t('playFailed');
        kit.toast(t('playFailed'), { icon: 'warning' });
      }
      return false;
    } finally {
      if (id === requestId) setLoading(false);
    }
  }

  function onError() {
    const item = currentItem();
    // A browser that cannot play a locally assembled HLS playlist can still stream the video.
    if (item && playingLocalVideo && navigator.onLine) {
      playingLocalVideo = false;
      item.stream = true;
      play(selection.queue, selection.index, { resume: true, keepExpanded: true });
      return;
    }
    if (selection) {
      status.textContent = t('playFailed');
      kit.toast(t('playFailed'), { icon: 'warning' });
    }
  }
  media.addEventListener('error', () => { if (media.getAttribute('src')) onError(); });

  function setLoading(loading) {
    root.toggleAttribute('data-loading', loading);
  }

  function present(item) {
    const title = localized(item.work.name) || item.work.title || item.work.workno;
    miniTitle.textContent = fullTitle.textContent = item.track.name.replace(/\.[a-z0-9]{2,5}$/i, '');
    miniSub.textContent = fullWork.textContent = title;
    openButton.setAttribute('aria-label', `${t('expand')} · ${item.track.name}`);
    mini.hidden = false;
    app.frame.setAttribute('data-playing', '');
    loadCover(item.work);
    layoutCaptions();
    refreshQueue(true);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: miniTitle.textContent, artist: item.work.creator || title, album: title,
        artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512' }] : [],
      });
    }
    kit.animate(mini.querySelector('.np-text'), [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 280 });
  }

  async function loadCover(work) {
    if (coverKey === work.workno) return;
    coverKey = work.workno;
    const images = [miniArt, fullArt].map(node => node.querySelector('.art-img'));
    for (const image of images) { image.hidden = true; image.removeAttribute('src'); }
    backdrop.style.backgroundImage = '';
    let url = null;
    if (work.hasCover) {
      const data = await offline.cover(work.workno).catch(() => null);
      if (data?.bytes) url = URL.createObjectURL(new Blob([data.bytes], { type: data.type }));
    }
    const remote = work.coverUrl ?? work.image ?? app.state.findWork(work.workno)?.image;
    if (!url && remote) url = await covers.cached(remote).catch(() => null) ?? remote;
    if (coverKey !== work.workno) return;
    coverUrl = url;
    if (!url) { app.setGlow(null); return; }
    for (const image of images) {
      image.onload = () => {
        image.hidden = false;
        if (image.naturalWidth) fullArt.style.setProperty('--ratio', String(image.naturalWidth / image.naturalHeight));
      };
      image.src = url;
    }
    backdrop.style.backgroundImage = `url(${JSON.stringify(url)})`;
    app.setGlow(url);
    if ('mediaSession' in navigator && navigator.mediaSession.metadata) navigator.mediaSession.metadata.artwork = [{ src: url, sizes: '512x512' }];
  }

  function update() {
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    const time = Math.min(duration, media.currentTime || 0);
    dockSeek.update(time, duration);
    fullSeek.update(time, duration);
    miniProgress.style.transform = `scaleX(${duration ? time / duration : 0})`;
    if (!captionsPane.hidden && expanded) renderCaptions(cues, time);
    const playing = !media.paused && !media.ended;
    if (playing !== root.hasAttribute('data-playing')) {
      root.toggleAttribute('data-playing', playing);
      for (const button of [miniPlay, dockTransport.play, fullTransport.play]) {
        button.setAttribute('aria-label', playing ? t('pause') : t('play'));
        button.title = playing ? t('pause') : t('play');
        clear(button, icon(playing ? 'pauseFill' : 'playFill'));
      }
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      bus.dispatchEvent(new Event('state'));
    }
    if ('mediaSession' in navigator && duration && navigator.mediaSession.setPositionState) {
      try { navigator.mediaSession.setPositionState({ duration, position: time, playbackRate: media.playbackRate }); } catch {}
    }
  }
  for (const name of ['timeupdate', 'seeking', 'durationchange', 'play', 'pause', 'ended', 'emptied', 'ratechange']) media.addEventListener(name, update);
  // The card keeps the cover's size (same as the work page); a video is fitted inside it and the
  // spare space shows a blurred copy of the cover.
  media.addEventListener('loadeddata', () => fullArt.toggleAttribute('data-frame', media.videoWidth > 0));
  media.addEventListener('emptied', () => fullArt.removeAttribute('data-frame'));
  media.addEventListener('click', () => toggle());
  media.addEventListener('dblclick', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (media.requestFullscreen) media.requestFullscreen().catch(() => {});
    else media.webkitEnterFullscreen?.();
  });

  if ('mediaSession' in navigator) {
    const handlers = {
      play: () => resume(), pause: () => media.pause(), previoustrack: () => step(-1), nexttrack: () => step(1),
      seekbackward: details => seek(media.currentTime - (details.seekOffset || prefs.get('skipBack'))),
      seekforward: details => seek(media.currentTime + (details.seekOffset || prefs.get('skipForward'))),
      seekto: details => seek(details.seekTime), stop: () => stop(),
    };
    for (const [name, handler] of Object.entries(handlers)) { try { navigator.mediaSession.setActionHandler(name, handler); } catch {} }
  }

  // Keyboard shortcuts while not typing: Space, ←/→ (skip), Shift+←/→ (track), ↑/↓ volume, M mute, F full.
  document.addEventListener('keydown', event => {
    if (!selection) return;
    const typing = event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName) && node.type !== 'range'));
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (app.frame.hasAttribute('data-immersive')) return;
    const keys = {
      ' ': () => toggle(), k: () => toggle(),
      ArrowLeft: () => event.shiftKey ? step(-1) : seek(media.currentTime - prefs.get('skipBack')),
      ArrowRight: () => event.shiftKey ? step(1) : seek(media.currentTime + prefs.get('skipForward')),
      ArrowUp: () => { media.volume = Math.min(1, media.volume + 0.05); prefs.set('volume', media.volume); },
      ArrowDown: () => { media.volume = Math.max(0, media.volume - 0.05); prefs.set('volume', media.volume); },
      m: () => { media.muted = !media.muted; },
      f: () => setExpanded(!expanded),
    };
    const run = keys[event.key];
    if (!run) return;
    if (event.key.startsWith('Arrow') && event.composedPath().some(node => node instanceof HTMLElement && node.matches?.('.captions-pane, .scroller'))) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') return;
    }
    event.preventDefault();
    run();
  });

  function stop() {
    requestId += 1;
    if (!media.paused) reportProgress();
    report = undefined;
    media.pause();
    media.removeAttribute('src');
    media.load();
    release();
    selection = undefined;
    sleepDeadline = 0; sleepEnd = false; tickSleep();
    if (expanded) setExpanded(false);
    const leave = kit.animate(mini, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px) scale(.96)' }], { duration: 240, easing: 'ease-in' });
    leave.finished.finally(() => { mini.hidden = true; });
    app.frame.removeAttribute('data-playing');
    app.setGlow(null);
    coverKey = null;
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
    bus.dispatchEvent(new Event('change'));
  }

  function openWork() {
    const workno = currentItem()?.work.workno;
    if (!workno) return;
    setExpanded(false);
    app.go(`/work/${workno}`);
  }

  app.on('mode', () => { if (expanded) { layoutCaptions(); refreshQueue(true); } });
  app.on('route', () => { if (expanded) setExpanded(false); });

  /* ================================================================ public */
  return {
    media,
    on: (name, listener) => { bus.addEventListener(name, listener); return () => bus.removeEventListener(name, listener); },
    current: () => {
      const item = currentItem();
      return item ? { workno: item.work.workno, asset: item.track.asset, path: item.track.path ?? offline.trackPath(item.track), stream: Boolean(item.stream), playing: !media.paused } : null;
    },
    toggle,
    stop,
    expand: () => setExpanded(true),
    /** Plays entries ({ workno } | { workno, path }) through DLook; returns false when nothing is playable. */
    async playEntries(entries, { index = 0, shuffle: shuffled = false, returnHref, requireCache = false, select, resume = true, expand = false } = {}) {
      const language = document.documentElement.lang || 'en';
      const { queue, cachedCount } = await offline.buildQueue(entries, language.toLowerCase());
      if (!queue.length || (requireCache && !cachedCount)) return false;
      if (select) {
        const stem = name => String(name ?? '').replace(/\.[^.]*$/, '');
        let matches;
        if (select.path !== undefined) matches = queue.filter(({ track }) => (track.path ?? offline.trackPath(track)) === select.path);
        else if (select.key !== undefined) matches = queue.filter(({ track }) => stem(track.hashname ?? track.asset) === stem(select.key));
        index = matches?.length ? queue.indexOf(matches[0]) : -1;
        if (index < 0) return false;
      }
      shuffle = shuffled;
      for (const button of app.shadow.querySelectorAll('.tp-shuffle')) button.setAttribute('aria-pressed', String(shuffle));
      const start = shuffled && !select ? Math.floor(Math.random() * queue.length) : Math.min(Math.max(index, 0), queue.length - 1);
      setOrder(queue.length, start);
      selection = undefined;
      return play(queue, start, { resume, returnHref, expand });
    },
  };
}
