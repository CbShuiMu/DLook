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

  function timeline(output) {
    let shown = [], currentCount = 0;
    return (cues, time) => {
      const current = cues.filter(cue => time >= cue.start && time < cue.end);
      const upcoming = cues.filter(cue => time < cue.start).slice(0, 2);
      const next = [...current, ...upcoming];
      if (current.length === currentCount && next.length === shown.length && next.every((cue, i) => cue === shown[i])) return;
      shown = next;
      currentCount = current.length;
      const groups = next.map((cue, index) => {
        const group = document.createElement('div');
        group.className = 'dlook-caption-cue';
        group.dataset.offset = Math.max(0, index - currentCount + 1);
        for (const line of cue.lines) {
          const text = document.createElement('p');
          text.textContent = line;
          group.append(text);
        }
        return group;
      });
      output.replaceChildren(...groups);
      output.scrollTop = 0;
    };
  }

  function cueResourceNames() {
    // The native player loads its caption JSON via fetch. Its audio is kept outside the DOM.
    return [...new Set(performance.getEntriesByType('resource').reverse().filter(entry =>
      ['fetch', 'xmlhttprequest'].includes(entry.initiatorType) && entry.name.startsWith(cdn + '/content/work/') &&
      /\/(?:RJ|VJ|BJ)\d+\/optimized\/[^/]+\?/.test(entry.name)).map(entry => entry.name))].slice(0, 4);
  }

  function loadCues(url) {
    if (!requests.has(url)) {
      if (requests.size >= 24) requests.delete(requests.keys().next().value);
      requests.set(url, fetch(url, { cache: 'force-cache', credentials: 'omit', redirect: 'error' })
        .then(response => response.ok ? response.json() : null)
        .then(data => parse(data?.webvtt)).catch(() => []));
    }
    return requests.get(url);
  }

  async function matchNativeCues(state, lines, time, key) {
    for (const url of cueResourceNames()) {
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
    if (!lines.length) return;
    const key = JSON.stringify(lines);
    if (key === native.lastLookup) return;
    native.lastLookup = key;
    void matchNativeCues(native, lines, time, key);
  }

  function updateNative(player) {
    const host = player?.querySelector('[class*="_textTrack_"]');
    const slider = player?.querySelector('[data-time] input[type="range"]');
    const key = player && [...player.querySelectorAll('[class*="_controlWrapper_"] > :is([class*="_title_"], [class*="_album_"])')]
      .map(element => element.textContent).join('\n');
    if (host !== native?.host || slider !== native?.slider || key !== native?.key) {
      progress.disconnect();
      native?.host.removeAttribute('data-dlook-caption-enhanced');
      native?.output.remove();
      native = undefined;
      if (host && slider) {
        const output = document.createElement('div');
        output.className = 'dlook-caption-timeline';
        host.append(output);
        native = { host, slider, key, output, render: timeline(output) };
        progress.observe(slider, { attributes: true, attributeFilter: ['value'] });
      }
    }
    renderNative();
  }

  return { parse, timeline, updateNative };
})();
