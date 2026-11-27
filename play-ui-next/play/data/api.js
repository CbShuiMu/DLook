// DLsite Play endpoints used by DLook Next, each behind the shared cache.
import { api, chunk, pool, WORKNO } from '../core/http.js';
import * as kv from '../core/kv.js';

/* ------------------------------------------------------------------ session */

export function authorize({ force = false } = {}) {
  return kv.swr('authorize', async () => {
    const data = await api('/api/authorize');
    return data && !Array.isArray(data) && data.account_id ? data : null;
  }, { ttl: 5 * 60000, force, persist: false });
}

/* ------------------------------------------------------------------ library */

// The library cache is per account: an incremental sync only fetches purchases made after
// the last sync, so another account's cache must never be continued.
async function libraryKey() {
  const account = await authorize().catch(() => null);
  return `library:v2:${account?.account_id ?? 'anonymous'}:${account?.production_id ?? ''}`;
}
let syncing;

/** Purchased works, normalized and cached. `onProgress({ value, max })` reports sync progress. */
export async function library({ force = false, onUpdate, onProgress } = {}) {
  const cached = await kv.peek(await libraryKey());
  const age = cached ? Date.now() - cached.stored : Infinity;
  if (cached && !force) {
    if (age > 10 * 60000 && navigator.onLine) syncLibrary({ onProgress }).then(onUpdate, () => {});
    return cached.value;
  }
  return syncLibrary({ full: force || !cached, onProgress });
}

/** Mirrors the native incremental purchase sync (count → sales/works, products pages). */
export function syncLibrary({ full = false, onProgress } = {}) {
  if (syncing) return syncing;
  syncing = (async () => {
    const key = await libraryKey();
    const cached = full ? undefined : await kv.peek(key);
    const previous = cached?.value;
    const startedAt = Date.now();
    const last = previous && !full ? Math.trunc(previous.syncedAt / 1000) : 0;
    const count = await api('/api/v4/content/count', { params: { last }, noCache: true });
    const limit = Math.max(1, count?.page_limit ?? 1000);
    const concurrency = Math.max(1, Math.min(count?.concurrency ?? 4, 6));
    const max = (count?.user ?? 0) + (count?.production ?? 0);
    const received = [];
    onProgress?.({ value: 0, max });
    if (count?.user > 0) {
      const sales = await api('/api/v4/content/sales', { params: { last }, noCache: true });
      const dates = new Map((Array.isArray(sales) ? sales : []).map(sale => [sale.workno, sale.sales_date]));
      await pool(chunk([...dates.keys()], limit), concurrency, async worknos => {
        const data = await api('/api/v4/content/works', { method: 'POST', body: { worknos } });
        for (const work of data?.works ?? []) received.push(normalize({ ...work, sales_date: dates.get(work.workno) ?? work.sales_date }));
        onProgress?.({ value: received.length, max });
      });
    }
    if (count?.production > 0) {
      const pages = Array.from({ length: Math.ceil(count.production / limit) }, (_, i) => i + 1);
      await pool(pages, concurrency, async page => {
        const data = await api('/api/v4/content/products', { params: { page, last }, noCache: true });
        for (const work of data?.works ?? []) received.push(normalize(work));
        onProgress?.({ value: received.length, max });
      });
    }
    const merged = new Map((previous?.works ?? []).map(work => [work.workno, work]));
    for (const work of received) merged.set(work.workno, work);
    const value = { syncedAt: startedAt, works: [...merged.values()] };
    await kv.put(key, value);
    return value;
  })().finally(() => { syncing = undefined; });
  return syncing;
}

const time = value => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Keeps only what the UI needs so the cached library stays small. */
export function normalize(work) {
  return {
    workno: work.workno,
    name: work.name ?? {},
    phonetic: work.name_phonetic?.ja_JP ?? '',
    type: work.work_type ?? null,
    app: work.app_type ?? null,
    category: work.work_category ?? null,
    age: work.age ?? null,
    maker: work.maker ? { id: work.maker.id, name: work.maker.name ?? {} } : null,
    originalMaker: work.original_maker ? { id: work.original_maker.id, name: work.original_maker.name ?? {} } : null,
    translation: Boolean(work.is_community_translation),
    authors: Array.isArray(work.authors) ? work.authors.map(author => ({ name: author?.name ?? {} })).filter(a => a.name) : [],
    tags: Array.isArray(work.tags) ? work.tags.filter(tag => tag?.classification === 'created_by').map(tag => tag.name) : [],
    genres: Array.isArray(work.genre_ids) ? work.genre_ids : [],
    image: work.images?.main ?? work.images?.thumb ?? null,
    thumb: work.images?.thumb ?? work.images?.main ?? null,
    series: work.series ? { id: work.series.title_id, name: work.series.title_name ?? work.series.name ?? null, total: work.series.total } : null,
    purchased: time(work.sales_date),
    released: time(work.release_date ?? work.last_release_date),
    playable: work.playable !== false,
    encodable: Boolean(work.encodable),
    entitlement: work.entitlement_type ?? null,
    fileType: work.file_type ?? null,
    size: work.pc_file_size ?? null,
  };
}

/* ------------------------------------------------------------------ works */

export function work(workno, { force = false, onUpdate } = {}) {
  if (!WORKNO.test(workno)) return Promise.resolve(null);
  return kv.swr(`work:${workno}`, () => api(`/api/v4/work/${workno}`), { ttl: 6 * 3600000, force, onUpdate });
}

/** Light work records for many worknos at once (collections, history). Cached per work. */
export async function works(worknos, { library: owned } = {}) {
  const unique = [...new Set(worknos.filter(id => WORKNO.test(id)))];
  const known = new Map((owned?.works ?? []).map(entry => [entry.workno, entry]));
  const result = new Map();
  const missing = [];
  for (const workno of unique) {
    if (known.has(workno)) { result.set(workno, known.get(workno)); continue; }
    const cached = await kv.peek(`light:${workno}`);
    if (cached && Date.now() - cached.stored < 7 * 86400000) result.set(workno, cached.value);
    else missing.push(workno);
  }
  if (missing.length && navigator.onLine) {
    await pool(chunk(missing, 100), 3, async batch => {
      try {
        const data = await api('/api/v4/content/works', { method: 'POST', body: { worknos: batch } });
        for (const raw of data?.works ?? []) {
          const light = normalize(raw);
          result.set(light.workno, light);
          kv.put(`light:${light.workno}`, light);
        }
      } catch {
        // Fall back to per-work details for whatever the batch could not resolve.
        await pool(batch, 4, async workno => {
          const raw = await work(workno).catch(() => null);
          if (raw) result.set(workno, normalize({ workno, ...raw }));
        });
      }
    });
  }
  return result;
}

/* ------------------------------------------------------------------ collections */

const lists = kind => kind === 'mylist' ? '/api/mylists' : '/api/playlists';
const field = kind => kind === 'mylist' ? 'mylists' : 'playlists';

export function collections(kind, { force = false, onUpdate } = {}) {
  return kv.swr(`collections:${kind}`, async () => (await api(lists(kind)))?.[field(kind)] ?? [], {
    ttl: 20000, force, onUpdate,
  });
}

async function mutate(kind, run) {
  const result = await run();
  await kv.invalidate(`collections:${kind}`);
  return result;
}

export const createCollection = (kind, title) => mutate(kind, () => api(lists(kind), { method: 'POST', body: { title } }));
export const renameCollection = (kind, id, title) => mutate(kind, () => api(`${lists(kind)}/${encodeURIComponent(id)}`, { method: 'PUT', body: { title } }));
export const deleteCollection = (kind, id) => mutate(kind, () => api(`${lists(kind)}/${encodeURIComponent(id)}`, { method: 'DELETE' }));
export const addToMylist = (id, workno) => mutate('mylist', () => api(`/api/mylists/${encodeURIComponent(id)}/works`, { method: 'POST', body: { workno } }));
export const removeFromMylist = (id, workno) => mutate('mylist', () => api(`/api/mylists/${encodeURIComponent(id)}/works/${encodeURIComponent(workno)}`, { method: 'DELETE' }));
export const reorderMylist = (id, order) => mutate('mylist', () => api(`/api/mylists/${encodeURIComponent(id)}/works`, { method: 'PUT', body: { new_order: order.join(',') } }));
export const addToPlaylist = (id, track) => mutate('playlist', () => api(`/api/playlists/${encodeURIComponent(id)}/audios`, { method: 'POST', body: track }));
export const removeFromPlaylist = (id, index) => mutate('playlist', () => api(`/api/playlists/${encodeURIComponent(id)}/audios/${encodeURIComponent(index)}`, { method: 'DELETE' }));
export const reorderPlaylist = (id, order) => mutate('playlist', () => api(`/api/playlists/${encodeURIComponent(id)}/audios`, { method: 'PUT', body: { new_order: order.join(',') } }));

/* ------------------------------------------------------------------ hidden works */

export function hidden({ force = false, onUpdate } = {}) {
  return kv.swr('ignore', async () => ((await api('/api/ignore'))?.works ?? []).filter(Boolean), { ttl: 60000, force, onUpdate });
}

export async function setHidden(worknos, hide) {
  const data = await api('/api/ignore', { method: hide ? 'POST' : 'DELETE', body: { works: worknos } });
  if (data && data.success === false) throw new Error('ignore failed');
  await kv.invalidate('ignore');
}

/* ------------------------------------------------------------------ activity */

export function readingActivities({ force = false, onUpdate } = {}) {
  return kv.swr('reading', async () => (await api('/api/reading_activities'))?.items ?? [], { ttl: 30000, force, onUpdate });
}

export function viewHistories({ force = false, onUpdate } = {}) {
  return kv.swr('history', async () => {
    const data = await api('/api/view_histories');
    return Array.isArray(data) ? data : [];
  }, { ttl: 30000, force, onUpdate });
}

export function invalidateActivity() {
  return Promise.all([kv.invalidate('reading'), kv.invalidate('history')]);
}
