// Mirrors DLsite Play's own listening progress and history requests for the DLook player.
const DLookPlayProgress = (() => {
  const pendingKey = 'dlook:progress-pending';
  const api = workno => `/api/reading_activities/${encodeURIComponent(workno)}`;
  let flushing;

  function readPending() {
    try {
      const value = JSON.parse(localStorage.getItem(pendingKey) ?? '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function writePending(pending) {
    try {
      if (Object.keys(pending).length) localStorage.setItem(pendingKey, JSON.stringify(pending));
      else localStorage.removeItem(pendingKey);
    } catch {}
  }

  async function send(method, url, body, keepalive = false) {
    const headers = DLookPlaySite.csrfHeaders();
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, {
      method, credentials: 'same-origin', redirect: 'error', headers, keepalive,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw Object.assign(new Error('DLsite Play progress request failed'), { status: response.status });
    return response;
  }

  // Keeps only the newest unsent report per work; older positions are superseded.
  function remember(workno, body) {
    const pending = readPending();
    const previous = pending[workno];
    if (!previous || previous.last_accessed_at <= body.last_accessed_at) pending[workno] = body;
    writePending(pending);
  }

  function flush() {
    if (flushing || !navigator.onLine) return flushing;
    const pending = readPending();
    const worknos = Object.keys(pending);
    if (!worknos.length) return;
    flushing = (async () => {
      for (const workno of worknos) {
        const body = pending[workno];
        try {
          await send('PUT', api(workno), body);
        } catch (error) {
          // Keep reports the server may accept later; drop ones it rejected outright.
          if (!error.status || error.status >= 500 || error.status === 429) continue;
        }
        const latest = readPending();
        if (latest[workno]?.last_accessed_at === body.last_accessed_at) delete latest[workno];
        writePending(latest);
      }
    })().finally(() => { flushing = undefined; });
    return flushing;
  }

  // meta: { key, hash, unitCount } from the work's ziptree.
  function save(workno, meta, position, total, completed, keepalive = false) {
    if (!meta?.key || !Number.isFinite(position) || !Number.isFinite(total) || total <= 0) return;
    const now = new Date().toISOString();
    const body = {
      progress_status: 1,
      last_unit_key: meta.key,
      last_accessed_at: now,
      ziptree_hash: meta.hash,
      unit_count: meta.unitCount,
      unit_progress: [{
        key: meta.key, position: completed ? total : Math.min(position, total), unit: 'sec', total,
        completed: Boolean(completed), accessed_at: now,
      }],
    };
    remember(workno, body);
    if (!keepalive) return flush();
    // During page unload only a keepalive request can still leave the page.
    send('PUT', api(workno), body, true).then(() => {
      const latest = readPending();
      if (latest[workno]?.last_accessed_at === now) delete latest[workno];
      writePending(latest);
    }).catch(() => {});
  }

  // Records the same open and history entries the native player creates for a work.
  function open(workno) {
    if (!navigator.onLine) return;
    send('POST', `${api(workno)}/opens`).catch(() => {});
    send('POST', '/api/view_histories', { workno }).catch(() => {});
  }

  // The work's reading activity: last_unit_key, unit_progress and status, or null when unavailable.
  async function activity(workno) {
    if (!navigator.onLine) return null;
    try {
      const response = await fetch(api(workno), {
        credentials: 'same-origin', headers: DLookPlaySite.csrfHeaders(), signal: AbortSignal.timeout(1500),
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  // Returns the saved position for an unfinished track, or 0.
  async function position(workno, key) {
    if (!key) return 0;
    try {
      const data = await activity(workno);
      const units = data?.unit_progress;
      const unit = Array.isArray(units) ? units.find(entry => entry?.key === key) : units?.[key];
      const value = Number(unit?.position);
      if (!unit || unit.completed || !Number.isFinite(value)) return 0;
      const total = Number(unit.total);
      return Number.isFinite(total) && value > total - 5 ? 0 : Math.max(0, value);
    } catch {
      return 0;
    }
  }

  window.addEventListener('online', () => { flush(); });
  queueMicrotask(flush);

  return { save, open, position, activity, flush };
})();
