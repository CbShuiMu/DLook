// Listening/reading progress in DLsite Play's own format (ported from play-progress.js).
// Reports that cannot be sent (offline, server errors) wait in localStorage and are flushed later.
import { csrfHeaders } from '../core/http.js';
import { invalidateActivity } from './api.js';

const pendingKey = 'dlook:progress-pending';
const endpoint = workno => `/api/reading_activities/${encodeURIComponent(workno)}`;
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
  const headers = csrfHeaders();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    method, credentials: 'same-origin', redirect: 'error', headers, keepalive,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw Object.assign(new Error('progress request failed'), { status: response.status });
  return response;
}

function remember(workno, body) {
  const pending = readPending();
  const previous = pending[workno];
  if (!previous || previous.last_accessed_at <= body.last_accessed_at) pending[workno] = body;
  writePending(pending);
}

export function flush() {
  if (flushing || !navigator.onLine) return flushing;
  const pending = readPending();
  const worknos = Object.keys(pending);
  if (!worknos.length) return;
  flushing = (async () => {
    for (const workno of worknos) {
      const body = pending[workno];
      try {
        await send('PUT', endpoint(workno), body);
      } catch (error) {
        if (!error.status || error.status >= 500 || error.status === 429) continue;
      }
      const latest = readPending();
      if (latest[workno]?.last_accessed_at === body.last_accessed_at) delete latest[workno];
      writePending(latest);
    }
    invalidateActivity();
  })().finally(() => { flushing = undefined; });
  return flushing;
}

function report(workno, body, keepalive) {
  remember(workno, body);
  if (!keepalive) return flush();
  send('PUT', endpoint(workno), body, true).then(() => {
    const latest = readPending();
    if (latest[workno]?.last_accessed_at === body.last_accessed_at) delete latest[workno];
    writePending(latest);
  }).catch(() => {});
}

/** Media position. meta: { key, hash, unitCount } from the work's ziptree. */
export function save(workno, meta, position, total, completed, keepalive = false) {
  if (!meta?.key || !Number.isFinite(position) || !Number.isFinite(total) || total <= 0) return;
  const now = new Date().toISOString();
  return report(workno, {
    progress_status: 1, last_unit_key: meta.key, last_accessed_at: now, ziptree_hash: meta.hash, unit_count: meta.unitCount,
    unit_progress: [{ key: meta.key, position: completed ? total : Math.min(position, total), unit: 'sec', total, completed: Boolean(completed), accessed_at: now }],
  }, keepalive);
}

/** Reader position, matching the native image/PDF viewer. */
export function savePages(workno, { hash, unitCount, units, lastUnitKey }, keepalive = false) {
  if (!units?.length) return;
  const now = new Date().toISOString();
  return report(workno, {
    progress_status: 1, last_unit_key: lastUnitKey ?? units[0].key, last_accessed_at: now, ziptree_hash: hash, unit_count: unitCount,
    unit_progress: units.map(unit => ({ ...unit, accessed_at: now })),
  }, keepalive);
}

/** Records the open/history entries the native player creates. */
export function open(workno) {
  if (!navigator.onLine) return;
  send('POST', `${endpoint(workno)}/opens`).catch(() => {});
  send('POST', '/api/view_histories', { workno }).then(() => invalidateActivity()).catch(() => {});
}

export async function activity(workno) {
  if (!navigator.onLine) return null;
  try {
    const response = await fetch(endpoint(workno), { credentials: 'same-origin', headers: csrfHeaders(), signal: AbortSignal.timeout(2500) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function position(workno, key) {
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
