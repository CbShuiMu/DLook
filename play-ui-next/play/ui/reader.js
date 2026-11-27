// Comic reader for image folders and PDFs.
//  - Paging left/right (RTL default for manga, LTR optional) or continuous vertical scroll
//  - Single page / two-page spread (auto: spread on wide screens, cover page alone)
//  - Swipe with momentum, tap zones, keyboard, mouse wheel, scrubber, thumbnails
//  - Pinch and double-tap zoom with panning
//  - Preloads neighbouring pages, resumes where you left off, syncs progress with DLsite Play
// Protected (crypt) pages are restored from their shuffled tiles (data/descramble.js).
import { h, clear, scrollWithin } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import * as prefs from '../core/prefs.js';
import * as kit from './kit.js';
import * as source from '../data/source.js';
import * as progress from '../data/progress.js';
import * as descramble from '../data/descramble.js';
import { workTitle } from './state.js';

export async function create(app, route) {
  const { workno, path } = route.params;
  // Text files get DLook's own text page; formats DLook cannot render (HTML, EPUB…) stay official.
  const file = await source.findFile(workno, path).catch(() => null);
  if (file?.kind === 'text' || file?.kind === 'vtt') return (await import('./views/text.js')).create(app, route);
  if (file && !['image', 'pdf'].includes(file.kind)) return { passthrough: true, node: h('div') };
  let data;
  try {
    data = await source.pages(workno, path);
  } catch {
    data = null;
  }
  if (!data || !data.pages.length) return { passthrough: true, node: h('div') };

  const pages = data.pages;
  const manifest = await source.manifest(workno).catch(() => null);
  const unitCount = manifest ? Object.values(manifest.playfile ?? {}).filter(file => file?.type === 'image' || file?.type === 'pdf').length : undefined;
  const work = app.state.findWork(workno);
  const title = work ? workTitle(work) : workno;
  let direction = prefs.get('readerDirection');
  let mode = prefs.get('readerMode');
  let index = 0;                 // current spread index (paged) or page index (vertical)
  let spreads = [];              // [[pageIndex], [a, b], ...]
  let zoom = { scale: 1, x: 0, y: 0 };

  /* ---------------- DOM */
  const track = h('div', { class: 'r-track' });
  const viewport = h('div', { class: 'r-viewport', tabIndex: 0, 'aria-roledescription': 'reader' }, track);
  const vertical = h('div', { class: 'r-vertical', hidden: true });
  const counter = h('span', { class: 'r-counter' });
  const topBar = h('header', { class: 'r-top glass' },
    kit.iconButton('back', t('back'), () => close(), { tone: 'soft' }),
    h('div', { class: 'r-title' }, h('strong', { text: title }), h('small', { text: path.split('/').pop() })),
    counter,
    kit.iconButton('thumbs', t('thumbnails'), () => openThumbs(), { tone: 'soft' }),
    kit.iconButton('settings', t('readerSettings'), (e, b) => openSettings(b), { tone: 'soft' }),
    kit.iconButton('fullscreen', t('fullscreen'), () => toggleFullscreen(), { tone: 'soft', className: 'r-full' }));
  const scrub = h('input', { type: 'range', class: 'r-scrub', min: 1, max: pages.length, step: 1, value: 1, 'aria-label': t('page', 1, pages.length) });
  const scrubLabel = h('output', { class: 'r-scrub-label' });
  const bottomBar = h('footer', { class: 'r-bottom glass' },
    kit.iconButton(direction === 'rtl' ? 'forward' : 'back', t('prevPage'), () => turn(-1), { className: 'r-prev', tone: 'soft' }),
    h('div', { class: 'r-scrub-wrap' }, scrub, scrubLabel),
    kit.iconButton(direction === 'rtl' ? 'back' : 'forward', t('nextPage'), () => turn(1), { className: 'r-next', tone: 'soft' }));
  const hint = h('div', { class: 'r-hint', 'aria-hidden': 'true' });
  const node = h('section', { class: 'reader', 'data-dir': direction }, viewport, vertical, topBar, bottomBar, hint);
  // iOS Safari: keep pinch gestures for the page zoom instead of zooming the whole website.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) node.addEventListener(type, event => event.preventDefault());

  /* ---------------- layout */
  const wide = () => node.clientWidth > node.clientHeight * 1.05 && node.clientWidth >= 820;
  const isWebtoon = () => pages.filter(page => page.height > page.width * 2.2).length > pages.length / 2;
  const effectiveMode = () => mode === 'auto' ? (isWebtoon() ? 'vertical' : wide() ? 'spread' : 'single') : mode;

  function buildSpreads() {
    const spread = effectiveMode() === 'spread';
    spreads = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const landscape = page.width > page.height;
      // Cover alone; landscape pages alone; otherwise pair pages.
      if (spread && i > 0 && !landscape && pages[i + 1] && !(pages[i + 1].width > pages[i + 1].height)) {
        spreads.push([i, i + 1]);
        i++;
      } else spreads.push([i]);
    }
  }

  let loadedAny = false, failures = 0, handedOver = false;
  function pageImage(i, eager = false) {
    const page = pages[i];
    const img = h('img', { class: 'r-img', alt: t('page', i + 1, pages.length), decoding: 'async', loading: eager ? 'eager' : 'lazy', draggable: false });
    if (page.width && page.height) img.style.aspectRatio = `${page.width} / ${page.height}`;
    img.addEventListener('load', () => { loadedAny = true; img.setAttribute('data-loaded', ''); }, { once: true });
    img.addEventListener('error', () => {
      img.setAttribute('data-error', '');
      // If nothing can be shown at all (protected or unreadable pages), hand over to the
      // official viewer at this same URL instead of leaving an empty reader.
      if (!loadedAny && ++failures >= 2 && node.isConnected && !handedOver) {
        handedOver = true;
        app.showNative();
      }
    }, { once: true });
    if (!page.crypt) img.src = page.src;
    else if (eager) decodeInto(img, page);
    else lazyDecode.observe(img);
    imagePages.set(img, page);
    return img;
  }

  // Protected pages are shuffled tiles: fetch, restore on a canvas, then show the object URL.
  const imagePages = new WeakMap();
  function decodeInto(img, page) {
    descramble.pageUrl(page, data.credentials).then(url => { img.src = url; }, () => img.dispatchEvent(new Event('error')));
  }
  const lazyDecode = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      lazyDecode.unobserve(entry.target);
      decodeInto(entry.target, imagePages.get(entry.target));
    }
  }, { rootMargin: '150% 150%' });

  const slides = new Map();
  function slideFor(s) {
    if (slides.has(s)) return slides.get(s);
    const list = spreads[s];
    const ordered = direction === 'rtl' ? list.slice().reverse() : list;
    const slide = h('div', { class: `r-slide ${list.length > 1 ? 'pair' : 'solo'}`, dataset: { spread: s } },
      h('div', { class: 'r-zoom' }, ordered.map(i => pageImage(i, Math.abs(s - index) <= 1))));
    slides.set(s, slide);
    return slide;
  }

  function layout(animate = false) {
    if (effectiveMode() === 'vertical') return;
    // Keep only nearby slides in the DOM (memory friendly for long works).
    const keep = new Set([index - 2, index - 1, index, index + 1, index + 2].filter(i => i >= 0 && i < spreads.length));
    for (const [s, slide] of slides) if (!keep.has(s)) { slide.remove(); slides.delete(s); }
    for (const s of keep) {
      const slide = slideFor(s);
      if (!slide.isConnected) track.append(slide);
      const offset = (s - index) * (direction === 'rtl' ? -1 : 1);
      slide.style.transform = `translate3d(${offset * 100}%, 0, 0)`;
      slide.toggleAttribute('data-current', s === index);
      slide.setAttribute('aria-hidden', String(s !== index));
    }
    track.style.transition = animate && !kit.reducedMotion.matches ? '' : 'none';
    track.style.transform = 'translate3d(0,0,0)';
    resetZoom();
    preload();
    paintChrome();
  }

  function renderMode() {
    const current = currentPage();
    clear(track);
    slides.clear();
    const m = effectiveMode();
    node.dataset.mode = m;
    node.dataset.dir = direction;
    vertical.hidden = m !== 'vertical';
    viewport.hidden = m === 'vertical';
    buildSpreads();
    if (m === 'vertical') {
      clear(vertical, ...pages.map((page, i) => h('div', { class: 'r-vpage', dataset: { page: i } }, pageImage(i, i < 3))));
      requestAnimationFrame(() => scrollWithin(vertical, vertical.querySelector(`[data-page="${current}"]`), { block: 'start' }));
      index = current;
    } else {
      index = Math.max(0, spreads.findIndex(list => list.includes(current)));
      layout(false);
    }
    paintChrome();
    for (const button of [bottomBar.querySelector('.r-prev'), bottomBar.querySelector('.r-next')]) {
      const isPrev = button.classList.contains('r-prev');
      clear(button, icon((direction === 'rtl') === isPrev ? 'forward' : 'back'));
    }
    // RTL: the scrubber runs right-to-left like the pages.
    scrub.style.direction = direction === 'rtl' ? 'rtl' : 'ltr';
  }

  const currentPage = () => effectiveMode() === 'vertical' ? index : spreads[index]?.[0] ?? 0;

  function paintChrome() {
    const m = effectiveMode();
    const list = m === 'vertical' ? [index] : spreads[index] ?? [0];
    const first = list[0] + 1, last = list.at(-1) + 1;
    counter.textContent = first === last ? t('page', first, pages.length) : `${first}–${last} / ${pages.length}`;
    scrub.value = String(first);
    scrub.setAttribute('aria-valuetext', counter.textContent);
    scrub.style.setProperty('--p', `${pages.length > 1 ? ((first - 1) / (pages.length - 1)) * 100 : 100}%`);
    scheduleSave();
  }

  function preload() {
    for (const s of [index + 1, index + 2, index + 3, index - 1]) {
      for (const i of spreads[s] ?? []) {
        if (pages[i].crypt) { descramble.pageUrl(pages[i], data.credentials).catch(() => {}); continue; }
        const img = new Image();
        img.decoding = 'async';
        img.src = pages[i].src;
      }
    }
  }

  /* ---------------- navigation */
  function goTo(s, animate = true) {
    const max = effectiveMode() === 'vertical' ? pages.length - 1 : spreads.length - 1;
    const next = Math.max(0, Math.min(max, s));
    if (effectiveMode() === 'vertical') {
      scrollWithin(vertical, vertical.querySelector(`[data-page="${next}"]`), { block: 'start', behavior: animate ? 'smooth' : 'auto' });
      index = next;
      paintChrome();
      return;
    }
    if (next === index) { bounce(s > index ? 1 : -1); return; }
    index = next;
    layout(animate);
    if (animate && !kit.reducedMotion.matches) {
      const current = slides.get(index);
      current?.animate([{ opacity: .85 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    }
  }
  function turn(delta) {
    if (zoom.scale > 1.01) { resetZoom(true); return; }
    goTo(index + delta);
    if (index === spreads.length - 1 && delta > 0) showHint(t('finished'));
  }
  function bounce(sign) {
    const offset = (direction === 'rtl' ? -1 : 1) * sign * -24;
    kit.animate(track, [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${offset}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: 360 });
  }
  function showHint(text) {
    hint.textContent = text;
    kit.animate(hint, [{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 1800, easing: 'ease-out' });
  }

  scrub.addEventListener('input', () => {
    const page = Number(scrub.value) - 1;
    scrubLabel.textContent = t('page', page + 1, pages.length);
    scrubLabel.style.setProperty('--x', `${(page / Math.max(1, pages.length - 1)) * 100}%`);
    if (effectiveMode() === 'vertical') goTo(page, false);
    else goTo(spreads.findIndex(list => list.includes(page)), false);
  });

  /* ---------------- chrome visibility */
  let idle;
  function showChrome(show = true) {
    node.toggleAttribute('data-chrome', show);
    clearTimeout(idle);
    if (show && app.mode() === 'desktop') idle = setTimeout(() => node.removeAttribute('data-chrome'), 3200);
  }
  showChrome(true);
  node.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') showChrome(true); });

  /* ---------------- gestures (paged) */
  const pointers = new Map();
  let drag = null, pinch = null, lastTap = 0, wheelLock = 0;

  function resetZoom(animate = false) {
    zoom = { scale: 1, x: 0, y: 0 };
    const target = slides.get(index)?.querySelector('.r-zoom');
    if (!target) return;
    target.style.transition = animate ? 'transform .3s cubic-bezier(.32,.72,0,1)' : 'none';
    target.style.transform = '';
    node.removeAttribute('data-zoomed');
  }
  function applyZoom() {
    const target = slides.get(index)?.querySelector('.r-zoom');
    if (!target) return;
    const box = viewport.getBoundingClientRect();
    const maxX = (box.width * (zoom.scale - 1)) / 2, maxY = (box.height * (zoom.scale - 1)) / 2;
    zoom.x = Math.max(-maxX, Math.min(maxX, zoom.x));
    zoom.y = Math.max(-maxY, Math.min(maxY, zoom.y));
    target.style.transition = 'none';
    target.style.transform = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;
    node.toggleAttribute('data-zoomed', zoom.scale > 1.01);
  }
  function zoomAt(clientX, clientY, scale) {
    const box = viewport.getBoundingClientRect();
    const cx = clientX - box.left - box.width / 2, cy = clientY - box.top - box.height / 2;
    const ratio = scale / zoom.scale;
    zoom.x = cx - (cx - zoom.x) * ratio;
    zoom.y = cy - (cy - zoom.y) * ratio;
    zoom.scale = scale;
    const target = slides.get(index)?.querySelector('.r-zoom');
    if (target) target.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
    applyZoom();
    if (target) target.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
  }

  viewport.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: zoom.scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null;
      return;
    }
    drag = { x: event.clientX, y: event.clientY, t: performance.now(), dx: 0, dy: 0, zx: zoom.x, zy: zoom.y, moved: false };
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const scale = Math.max(1, Math.min(4, pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance));
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, scale);
      return;
    }
    if (!drag) return;
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
    if (Math.abs(drag.dx) > 6 || Math.abs(drag.dy) > 6) drag.moved = true;
    if (zoom.scale > 1.01) {
      zoom.x = drag.zx + drag.dx;
      zoom.y = drag.zy + drag.dy;
      applyZoom();
      return;
    }
    if (Math.abs(drag.dx) > Math.abs(drag.dy)) {
      // Follow the finger; resist at the ends.
      const atStart = index === 0 && (direction === 'rtl' ? drag.dx < 0 : drag.dx > 0);
      const atEnd = index === spreads.length - 1 && (direction === 'rtl' ? drag.dx > 0 : drag.dx < 0);
      const dx = atStart || atEnd ? drag.dx / 3 : drag.dx;
      track.style.transition = 'none';
      track.style.transform = `translate3d(${dx}px,0,0)`;
    }
  });
  const release = event => {
    pointers.delete(event.pointerId);
    if (pinch) {
      if (pointers.size < 2) { pinch = null; if (zoom.scale < 1.05) resetZoom(true); }
      return;
    }
    if (!drag) return;
    const { dx, dy, moved } = drag;
    const elapsed = performance.now() - drag.t;
    drag = null;
    if (zoom.scale > 1.01) {
      if (!moved) handleTap(event);
      return;
    }
    const width = viewport.clientWidth;
    const velocity = dx / Math.max(1, elapsed);
    if (moved && Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > width * 0.18 || Math.abs(velocity) > 0.45)) {
      const forward = direction === 'rtl' ? dx > 0 : dx < 0;
      track.style.transition = '';
      const before = index;
      goTo(index + (forward ? 1 : -1));
      if (index === before) { track.style.transform = 'translate3d(0,0,0)'; }
      return;
    }
    track.style.transition = '';
    track.style.transform = 'translate3d(0,0,0)';
    if (!moved) handleTap(event);
  };
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);

  function handleTap(event) {
    const now = performance.now();
    if (now - lastTap < 280) {
      // Double tap: zoom in at the point, or back out.
      lastTap = 0;
      clearTimeout(tapTimer);
      if (zoom.scale > 1.01) resetZoom(true);
      else zoomAt(event.clientX, event.clientY, 2.2);
      return;
    }
    lastTap = now;
    const box = viewport.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      if (zoom.scale > 1.01) { showChrome(!node.hasAttribute('data-chrome')); return; }
      if (ratio < 0.3) turn(direction === 'rtl' ? 1 : -1);
      else if (ratio > 0.7) turn(direction === 'rtl' ? -1 : 1);
      else showChrome(!node.hasAttribute('data-chrome'));
    }, 230);
  }
  let tapTimer;

  viewport.addEventListener('wheel', event => {
    if (event.ctrlKey) {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, Math.max(1, Math.min(4, zoom.scale * (event.deltaY < 0 ? 1.12 : 0.89))));
      return;
    }
    if (zoom.scale > 1.01) { zoom.x -= event.deltaX; zoom.y -= event.deltaY; applyZoom(); event.preventDefault(); return; }
    event.preventDefault();
    const now = performance.now();
    if (now < wheelLock) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? (direction === 'rtl' ? -event.deltaX : event.deltaX) : event.deltaY;
    if (Math.abs(delta) < 8) return;
    wheelLock = now + 320;
    turn(delta > 0 ? 1 : -1);
  }, { passive: false });

  /* ---------------- vertical mode tracking */
  const visibleObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
        index = Number(entry.target.dataset.page);
        paintChrome();
      }
    }
  }, { root: vertical, threshold: [0.35, 0.6] });
  new MutationObserver(() => { for (const page of vertical.querySelectorAll('.r-vpage')) visibleObserver.observe(page); })
    .observe(vertical, { childList: true });
  vertical.addEventListener('click', event => {
    const box = vertical.getBoundingClientRect();
    const ratio = (event.clientY - box.top) / box.height;
    if (ratio < 0.25) vertical.scrollBy({ top: -box.height * 0.85, behavior: 'smooth' });
    else if (ratio > 0.75) vertical.scrollBy({ top: box.height * 0.85, behavior: 'smooth' });
    else showChrome(!node.hasAttribute('data-chrome'));
  });

  /* ---------------- keyboard */
  function onKey(event) {
    if (!node.isConnected || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.composedPath().some(el => el instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.type !== 'range')) return;
    const vert = effectiveMode() === 'vertical';
    const keys = {
      ArrowLeft: () => vert ? null : turn(direction === 'rtl' ? 1 : -1),
      ArrowRight: () => vert ? null : turn(direction === 'rtl' ? -1 : 1),
      ArrowDown: () => vert ? null : turn(1),
      ArrowUp: () => vert ? null : turn(-1),
      ' ': () => vert ? vertical.scrollBy({ top: vertical.clientHeight * (event.shiftKey ? -0.85 : 0.85), behavior: 'smooth' }) : turn(event.shiftKey ? -1 : 1),
      PageDown: () => turn(1), PageUp: () => turn(-1), Home: () => goTo(0), End: () => goTo(Infinity),
      f: () => toggleFullscreen(), t: () => openThumbs(),
      Escape: () => { if (zoom.scale > 1.01) resetZoom(true); else close(); },
    };
    const run = keys[event.key];
    if (!run) return;
    const result = run();
    if (result !== null || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
  }
  document.addEventListener('keydown', onKey, true);

  /* ---------------- sheets */
  function openThumbs() {
    const { body, close: closeSheet } = kit.sheet({ title: t('thumbnails'), className: 'thumbs-sheet', size: 'wide' });
    const current = currentPage();
    const grid = h('div', { class: 'thumbs', dir: direction === 'rtl' ? 'rtl' : 'ltr' }, pages.map((page, i) => h('button', {
      type: 'button', class: 'thumb', 'aria-current': i === current ? 'true' : undefined, 'aria-label': t('page', i + 1, pages.length),
      onclick: () => { closeSheet(); effectiveMode() === 'vertical' ? goTo(i, false) : goTo(spreads.findIndex(list => list.includes(i)), false); },
    }, pageImage(i, false), h('span', { class: 'thumb-n', text: String(i + 1) }))));
    body.append(grid);
    requestAnimationFrame(() => scrollWithin(grid.closest('.sheet-body') ?? grid, grid.querySelector('[aria-current="true"]')));
  }
  function openSettings(anchor) {
    kit.menu(anchor, [
      { section: t('readDirection') },
      { label: t('rtl'), icon: 'rtl', checked: direction === 'rtl', onSelect: () => setDirection('rtl') },
      { label: t('ltr'), icon: 'ltr', checked: direction === 'ltr', onSelect: () => setDirection('ltr') },
      'separator',
      { section: t('pageMode') },
      { label: t('autoMode'), icon: 'auto', checked: mode === 'auto', onSelect: () => setMode('auto') },
      { label: t('single'), icon: 'pages', checked: mode === 'single', onSelect: () => setMode('single') },
      { label: t('spread'), icon: 'spread', checked: mode === 'spread', onSelect: () => setMode('spread') },
      { label: t('vertical'), icon: 'scroll', checked: mode === 'vertical', onSelect: () => setMode('vertical') },
    ], { title: t('readerSettings') });
  }
  function setDirection(value) { direction = value; prefs.set('readerDirection', value); renderMode(); }
  function setMode(value) { mode = value; prefs.set('readerMode', value); renderMode(); }
  function toggleFullscreen() {
    const element = document.fullscreenElement ?? document.webkitFullscreenElement;
    if (element) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
    else (document.documentElement.requestFullscreen ?? document.documentElement.webkitRequestFullscreen)?.call(document.documentElement)?.catch?.(() => {});
  }

  /* ---------------- progress */
  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(false), 1500);
  }
  function save(keepalive) {
    const list = effectiveMode() === 'vertical' ? [index] : spreads[index] ?? [];
    if (!list.length || !manifest) return;
    const last = list.at(-1);
    const finished = last >= pages.length - 1;
    const units = data.pdf
      ? [{ key: data.key, position: finished ? pages.length : last + 1, unit: 'page', total: pages.length, completed: finished }]
      : list.map(i => ({ key: pages[i].key, completed: true }));
    progress.savePages(workno, { hash: manifest.hash, unitCount, units, lastUnitKey: units[0].key }, keepalive);
  }

  function close() {
    save(true);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    app.back(`/work/${workno}${data.folder ? `/tree/${data.folder.split('/').map(encodeURIComponent).join('/')}` : ''}`);
  }

  /* ---------------- start (resume) */
  const activity = app.state.get('activity')?.get(workno) ?? await progress.activity(workno);
  const requested = pages.findIndex(page => page.path === path);
  let start = requested > 0 ? requested : 0;
  if (requested <= 0 && activity?.last_unit_key) {
    if (data.pdf && activity.last_unit_key === data.key) {
      const unit = Array.isArray(activity.unit_progress) ? activity.unit_progress.find(entry => entry.key === data.key) : null;
      if (unit && !unit.completed) start = Math.max(0, Number(unit.position) - 1) || 0;
    } else {
      const found = pages.findIndex(page => page.key === activity.last_unit_key);
      if (found > 0 && found < pages.length - 1) start = found;
    }
  }
  index = start;
  const resize = new ResizeObserver(() => {
    const before = effectiveMode();
    if (node.dataset.mode && node.dataset.mode !== before) renderMode();
  });
  progress.open(workno);

  return {
    node, immersive: true, title,
    show() {
      requestAnimationFrame(() => {
        if (!node.dataset.mode) {
          // Translate the start page into a spread once the size is known.
          buildSpreads();
          index = effectiveMode() === 'vertical' ? start : Math.max(0, spreads.findIndex(list => list.includes(start)));
          renderMode();
          if (start > 0) showHint(t('continueFrom', start + 1));
        }
        resize.observe(node);
        viewport.focus({ preventScroll: true });
      });
    },
    hide() { if (loadedAny) save(true); },
    destroy() {
      document.removeEventListener('keydown', onKey, true);
      resize.disconnect();
      visibleObserver.disconnect();
      clearTimeout(saveTimer);
      clearTimeout(idle);
    },
  };
}
