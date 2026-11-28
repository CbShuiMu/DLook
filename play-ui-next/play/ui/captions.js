// Lyrics-style caption timeline: follows playback, and scrolling it seeks.
// Ported from chrome-extension/play-captions.js (timeline()).

export function timeline(output, { scrollContainer = output, onSeek } = {}) {
  let shown = [], groups = [], active = -1, selected = -1, visible = [];
  let browsing = false, touching = false, initialScroll = 0, timer;
  const listeners = new AbortController();
  const options = { signal: listeners.signal, passive: true };
  scrollContainer.setAttribute('data-swipe-ignore', '');
  scrollContainer.tabIndex = 0;
  output.classList.add('captions-timeline');

  // Measure unscaled layout positions so enlarging a cue never moves the
  // scroll target or changes the range underneath a finger.
  function layoutTop(element) {
    let top = 0;
    for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
    return top;
  }

  function topFor(index) {
    const group = groups[index];
    const origin = output === scrollContainer ? 0 : output.getBoundingClientRect().top -
      scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop - scrollContainer.clientTop;
    return origin + layoutTop(group) - layoutTop(output) + group.offsetHeight / 2 - scrollContainer.clientHeight / 2;
  }

  function nearest() {
    let low = 0, high = groups.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (topFor(middle) < scrollContainer.scrollTop) low = middle + 1;
      else high = middle;
    }
    return low > 0 && Math.abs(topFor(low - 1) - scrollContainer.scrollTop) <
      Math.abs(topFor(low) - scrollContainer.scrollTop) ? low - 1 : low;
  }

  function paint(index) {
    selected = index;
    const next = [index - 1, index, index + 1].filter(i => groups[i]);
    for (const i of visible) {
      if (next.includes(i)) continue;
      groups[i].dataset.offset = 'hidden';
      groups[i].setAttribute('aria-hidden', 'true');
      groups[i].removeAttribute('aria-current');
    }
    visible = next;
    for (const i of next) {
      const group = groups[i];
      const offset = String(i - index);
      if (group.dataset.offset !== offset) group.dataset.offset = offset;
      group.removeAttribute('aria-hidden');
      if (i === index) group.setAttribute('aria-current', 'true');
      else group.removeAttribute('aria-current');
      const proximity = browsing ? Math.max(0, 1 - Math.abs(topFor(i) - scrollContainer.scrollTop) /
        Math.max(group.offsetHeight + 12, 1)) : Number(i === index);
      group.style.setProperty('--cue-scale', String(.78 + .22 * proximity));
      group.style.setProperty('--cue-opacity', String(.4 + .6 * proximity));
    }
  }

  function follow(index) {
    if (!groups[index]) return;
    if (scrollContainer.clientHeight) scrollContainer.scrollTop = Math.max(0, topFor(index));
    paint(index);
  }

  function begin() {
    if (!onSeek || !groups.length) return;
    if (!browsing) initialScroll = scrollContainer.scrollTop;
    browsing = true;
    scrollContainer.setAttribute('data-browsing', '');
    clearTimeout(timer);
    timer = setTimeout(finish, 200);
  }

  function finish() {
    if (touching || !browsing) return;
    const moved = Math.abs(initialScroll - scrollContainer.scrollTop) >= 2;
    const index = moved ? nearest() : active;
    browsing = false;
    scrollContainer.removeAttribute('data-browsing');
    if (moved) onSeek(shown[index].start);
    follow(index);
  }

  scrollContainer.addEventListener('touchstart', () => { begin(); touching = true; }, options);
  scrollContainer.addEventListener('touchend', () => {
    touching = false;
    clearTimeout(timer);
    timer = setTimeout(finish, 200);
  }, options);
  scrollContainer.addEventListener('touchcancel', () => {
    touching = browsing = false;
    clearTimeout(timer);
    scrollContainer.removeAttribute('data-browsing');
    follow(active);
  }, options);
  scrollContainer.addEventListener('wheel', begin, options);
  scrollContainer.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) begin();
  }, options);
  scrollContainer.addEventListener('scroll', () => {
    if (!browsing || !groups.length) return;
    paint(nearest());
    if (touching) return;
    clearTimeout(timer);
    timer = setTimeout(finish, 200);
  }, options);

  // Native sheet gestures must leave vertical scrolling to the caption pane.
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend']) {
    scrollContainer.addEventListener(name, event => event.stopPropagation(), options);
  }

  const render = (cues, time) => {
    if (cues.length !== shown.length || cues.some((cue, i) => cue !== shown[i])) {
      clearTimeout(timer);
      touching = browsing = false;
      scrollContainer.removeAttribute('data-browsing');
      shown = cues;
      active = selected = -1;
      visible = [];
      groups = cues.map(cue => {
        const group = document.createElement('div');
        group.className = 'cue';
        group.dataset.start = cue.start;
        group.dataset.offset = 'hidden';
        group.setAttribute('aria-hidden', 'true');
        for (const line of cue.lines) {
          const text = document.createElement('p');
          text.textContent = line;
          group.append(text);
        }
        return group;
      });
      output.replaceChildren(...groups);
      scrollContainer.scrollTop = 0;
    }
    let index = cues.findIndex(cue => time >= cue.start && time < cue.end);
    // Between cues: single-line mode shows nothing rather than the upcoming line.
    output.toggleAttribute('data-gap', index < 0);
    if (index < 0) index = cues.findIndex(cue => time < cue.start);
    if (index < 0) index = cues.length - 1;
    if (index !== active) {
      active = index;
      if (!browsing) follow(index);
    } else if (selected < 0 && groups.length) follow(index);
  };
  const resize = new ResizeObserver(() => { if (!browsing) follow(active); });
  resize.observe(scrollContainer);
  output.addEventListener('click', event => {
    const cue = event.target.closest('.cue');
    if (cue && onSeek) onSeek(Number(cue.dataset.start));
  });
  render.destroy = () => { clearTimeout(timer); listeners.abort(); resize.disconnect(); };
  return render;
}

