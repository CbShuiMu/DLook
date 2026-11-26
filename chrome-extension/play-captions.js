const DLookPlayCaptions = (() => {
  const cdn = 'https://play.dl.dlsite.com';
  const requests = new Map();
  let native;
  const progress = new MutationObserver(renderNative);

  function seconds(value) {
    if (typeof value !== 'string' || !/^(?:\d{2,}:)?\d{2}:\d{2}(?:\.\d+)?$/.test(value)) return NaN;
    return value.split(':').reduce((time, part) => time * 60 + Number(part), 0);
  }

  function parse(data) {
    if (!Array.isArray(data)) return [];
    return data.flatMap(cue => {
      const start = seconds(cue?.start_time);
      const end = seconds(cue?.end_time);
      if (!(end > start) || !Array.isArray(cue.subtitles)) return [];
      const lines = cue.subtitles.filter(line => typeof line === 'string' && line.trim());
      return lines.length ? [{ start, end, lines }] : [];
    }).sort((left, right) => left.start - right.start);
  }

  function timeline(output, { scrollContainer = output, onSeek } = {}) {
    let shown = [], groups = [], active = -1, selected = -1, visible = [];
    let browsing = false, touching = false, initialScroll = 0, timer;
    const listeners = new AbortController();
    const options = { signal: listeners.signal, passive: true };
    scrollContainer.setAttribute('data-swipe-ignore', '');
    scrollContainer.tabIndex = 0;
    output.classList.add('dlook-caption-timeline');

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
        group.style.setProperty('--dlook-cue-scale', String(.78 + .22 * proximity));
        group.style.setProperty('--dlook-cue-opacity', String(.4 + .6 * proximity));
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
      scrollContainer.setAttribute('data-dlook-browsing', '');
      clearTimeout(timer);
      timer = setTimeout(finish, 200);
    }

    function finish() {
      if (touching || !browsing) return;
      const moved = Math.abs(initialScroll - scrollContainer.scrollTop) >= 2;
      const index = moved ? nearest() : active;
      browsing = false;
      scrollContainer.removeAttribute('data-dlook-browsing');
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
      scrollContainer.removeAttribute('data-dlook-browsing');
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
        scrollContainer.removeAttribute('data-dlook-browsing');
        shown = cues;
        active = selected = -1;
        visible = [];
        groups = cues.map(cue => {
          const group = document.createElement('div');
          group.className = 'dlook-caption-cue';
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
      if (index < 0) index = cues.findIndex(cue => time < cue.start);
      if (index < 0) index = cues.length - 1;
      if (index !== active) {
        active = index;
        if (!browsing) follow(index);
      } else if (selected < 0 && groups.length) follow(index);
    };
    const resize = new ResizeObserver(() => { if (!browsing) follow(active); });
    resize.observe(scrollContainer);
    render.destroy = () => { clearTimeout(timer); listeners.abort(); resize.disconnect(); };
    return render;
  }

  function seekNative(slider, time) {
    if (!slider.isConnected || slider.disabled) return;
    const value = Math.max(Number(slider.min) || 0, Math.min(Number(slider.max), time));
    if (!Number.isFinite(value)) return;
    // Bypass React's instance value tracker so the public input event reaches
    // the slider's onChange/onValueCommitted handlers and seeks the audio too.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, String(value));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function cueResourceNames() {
    // The native player loads its caption JSON via fetch. Its audio is kept outside the DOM.
    return [...new Set(performance.getEntriesByType('resource').reverse().filter(entry =>
      ['fetch', 'xmlhttprequest'].includes(entry.initiatorType) && entry.name.startsWith(cdn + '/content/work/') &&
      /\/(?:RJ|VJ|BJ)\d+\/optimized\//.test(entry.name) &&
      !/\.(?:mp3|wav|m4a|aac|ogg|opus|flac|mp4)(?:[?#]|$)/i.test(entry.name)).map(entry => entry.name))].slice(0, 8);
  }

  function loadCues(url) {
    if (!requests.has(url)) {
      if (requests.size >= 24) requests.delete(requests.keys().next().value);
      const read = async credentials => {
        const response = await fetch(url, { cache: 'force-cache', credentials, redirect: 'error' });
        if (!response.ok) throw new Error('Caption request failed');
        const type = response.headers.get('content-type') ?? '';
        if (!/json|text\/plain/i.test(type)) { await response.body?.cancel(); return []; }
        return parse((await response.json())?.webvtt);
      };
      requests.set(url, read('omit').catch(() => read('include')).catch(() => {
        requests.delete(url);
        return [];
      }));
    }
    return requests.get(url);
  }

  async function matchNativeCues(state, lines, time, key) {
    for (const url of lines.length ? cueResourceNames() : []) {
      const cues = await loadCues(url);
      if (native !== state || state.lastLookup !== key) return;
      if (cues.some(cue => time >= cue.start - .4 && time <= cue.end + .4 &&
          lines.length === cue.lines.length && lines.every((line, index) => line === cue.lines[index].trim()))) {
        state.cues = cues;
        state.host.setAttribute('data-dlook-caption-enhanced', '');
        renderNative();
        return;
      }
    }
    // Safari may omit the page world's resource timings from the userscript
    // world. Resolve the active track's caption through the same signed catalog
    // boundary used for offline playback instead of leaving a static subtitle.
    if (!state.workno || typeof DLookOfflineSource === 'undefined') return;
    try {
      const catalog = await DLookPlaySite.cache(`caption-catalog:${state.workno}`, () =>
        DLookOfflineSource.catalog(state.workno, AbortSignal.timeout(10000)));
      if (native !== state || state.lastLookup !== key) return;
      const normalize = value => value?.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.[a-z0-9]{2,5}$/i, '');
      const titles = [state.title, navigator.mediaSession?.metadata?.title].map(normalize).filter(Boolean);
      const matches = catalog.tracks.filter(track => track.captionAsset && titles.some(title =>
        title === normalize(track.name) || title === normalize(track.asset)));
      const track = matches.length === 1 ? matches[0] : catalog.tracks.length === 1 ? catalog.tracks[0] : null;
      if (!track?.captionAsset) return;
      const downloader = DLookOfflineSource.createDownloader(state.workno, catalog, state.controller.signal);
      const cues = await downloader.captions(track.captionAsset);
      if (native !== state || state.lastLookup !== key || !cues.length) return;
      if (lines.length && !cues.some(cue => time >= cue.start - .4 && time <= cue.end + .4 &&
          lines.length === cue.lines.length && lines.every((line, index) => line === cue.lines[index].trim()))) return;
      state.cues = cues;
      state.host.setAttribute('data-dlook-caption-enhanced', '');
      renderNative();
    } catch {
      // The native subtitle remains usable while authorization is unavailable.
    }
  }

  function renderNative() {
    if (!native) return;
    const time = Number(native.slider.value);
    if (!Number.isFinite(time)) return;
    if (native.cues) {
      native.render(native.cues, time);
      return;
    }
    const lines = [...native.host.querySelectorAll('[class*="_subtitle_"] > p')].map(line => line.textContent.trim());
    const key = JSON.stringify(lines);
    if (key === native.lastLookup) return;
    native.lastLookup = key;
    void matchNativeCues(native, lines, time, key);
  }

  function updateNative(player) {
    const host = player?.querySelector('[class*="_textTrack_"]');
    const slider = player?.querySelector('[data-time] input[type="range"]');
    const image = player?.querySelector('[class*="_albumart_"]')?.style.backgroundImage ?? '';
    const identity = [image, ...(navigator.mediaSession?.metadata?.artwork ?? []).map(image => image.src)].join('\n');
    const workno = image.match(/(?:RJ|VJ|BJ)\d{6,10}/g)?.at(-1) ?? identity.match(/(?:RJ|VJ|BJ)\d{6,10}/g)?.at(-1) ??
      /\/work\/((?:RJ|VJ|BJ)\d{6,10})(?:\/|$)/.exec(location.pathname)?.[1];
    const title = player?.querySelector('[class*="_titleInner_"]')?.textContent.trim() ??
      player?.querySelector('[class*="_controlWrapper_"] > [class*="_title_"]')?.textContent.trim();
    const key = player && workno + [...player.querySelectorAll('[class*="_controlWrapper_"] > :is([class*="_title_"], [class*="_album_"])')]
      .map(element => element.textContent).join('\n');
    if (host !== native?.host || slider !== native?.slider || key !== native?.key) {
      progress.disconnect();
      native?.controller.abort();
      native?.host.removeAttribute('data-dlook-caption-enhanced');
      native?.render.destroy();
      native?.output.remove();
      native = undefined;
      if (host && slider) {
        const output = document.createElement('div');
        output.className = 'dlook-caption-timeline';
        host.append(output);
        native = { host, slider, key, output, workno, title, controller: new AbortController(), render: timeline(output, {
          scrollContainer: host, onSeek: time => seekNative(slider, time),
        }) };
        progress.observe(slider, { attributes: true, attributeFilter: ['value', 'aria-valuenow'] });
      }
    }
    renderNative();
  }

  if (typeof PerformanceObserver !== 'undefined') {
    new PerformanceObserver(entries => {
      if (!native || native.cues || !entries.getEntries().some(entry =>
        entry.name.startsWith(cdn + '/content/work/') && /\/optimized\//.test(entry.name))) return;
      native.lastLookup = undefined;
      renderNative();
    }).observe({ type: 'resource', buffered: true });
  }

  return { parse, timeline, updateNative };
})();
