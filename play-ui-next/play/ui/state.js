// Shared, cache-first application state. Views subscribe to topics and re-render
// when background refreshes land, instead of issuing their own duplicate requests.
import * as api from '../data/api.js';
import { localized } from '../core/i18n.js';

const listeners = new Map();
const state = {
  library: null,          // { syncedAt, works }
  sync: { running: false, value: 0, max: 0, error: false },
  hidden: null,           // Set of worknos
  activity: null,         // Map workno -> reading activity
  history: null,          // [{ workno, accessed_at }]
  mylist: null,           // [{ id, title, data: [workno] }]
  playlist: null,         // [{ id, title, data: [{ workno, src }] }]
};

export const get = topic => state[topic];

export function on(topic, listener) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(listener);
  return () => listeners.get(topic)?.delete(listener);
}

function emit(topic) {
  for (const listener of listeners.get(topic) ?? []) {
    try { listener(state[topic]); } catch (error) { console.error(error); }
  }
}

function set(topic, value) {
  state[topic] = value;
  emit(topic);
  return value;
}

/* ------------------------------------------------------------------ library */

const setSync = patch => set('sync', { ...state.sync, ...patch });

export async function loadLibrary({ force = false } = {}) {
  if (state.library && !force) return state.library;
  try {
    setSync({ running: force || !state.library, value: 0, max: 0, error: false });
    const value = await api.library({
      force,
      onUpdate: next => { set('library', next); setSync({ running: false }); },
      onProgress: ({ value: done, max }) => setSync({ running: true, value: done, max }),
    });
    set('library', value);
    setSync({ running: false });
    return value;
  } catch (error) {
    setSync({ running: false, error: true });
    if (!state.library) set('library', { syncedAt: 0, works: [], failed: true });
    throw error;
  }
}

export async function syncLibrary() {
  setSync({ running: true, value: 0, max: 0, error: false });
  try {
    const value = await api.syncLibrary({ full: false, onProgress: ({ value: done, max }) => setSync({ running: true, value: done, max }) });
    set('library', value);
    setSync({ running: false });
    return value;
  } catch (error) {
    setSync({ running: false, error: true });
    throw error;
  }
}

export function findWork(workno) {
  return state.library?.works.find(work => work.workno === workno) ?? null;
}

/* ------------------------------------------------------------------ hidden / activity / history */

export async function loadHidden({ force = false } = {}) {
  const list = await api.hidden({ force, onUpdate: next => set('hidden', new Set(next)) }).catch(() => []);
  return set('hidden', new Set(list));
}

export async function setHidden(workno, hide) {
  const next = new Set(state.hidden ?? []);
  if (hide) next.add(workno); else next.delete(workno);
  set('hidden', next);
  try {
    await api.setHidden([workno], hide);
  } catch (error) {
    loadHidden({ force: true });
    throw error;
  }
}

export async function loadActivity({ force = false } = {}) {
  const toMap = items => new Map(items.map(item => [item.workno, item]));
  const items = await api.readingActivities({ force, onUpdate: next => set('activity', toMap(next)) }).catch(() => []);
  return set('activity', toMap(items));
}

export async function loadHistory({ force = false } = {}) {
  const items = await api.viewHistories({ force, onUpdate: next => set('history', next) }).catch(() => []);
  return set('history', items);
}

/* ------------------------------------------------------------------ collections */

export async function loadCollections(kind, { force = false } = {}) {
  const items = await api.collections(kind, { force, onUpdate: next => set(kind, next) });
  return set(kind, items);
}

export function refreshCollections(kind) {
  return loadCollections(kind, { force: true }).catch(() => state[kind]);
}

/** Lists (my lists) that contain the work. */
export function listsContaining(workno) {
  return (state.mylist ?? []).filter(list => Array.isArray(list.data) && list.data.includes(workno));
}

/* ------------------------------------------------------------------ derived data */

export const workTitle = work => localized(work?.name) || work?.title || work?.workno || '';

export function circleOf(work) {
  const maker = work?.translation && !work.originalMaker ? null : work?.originalMaker ?? work?.maker;
  return maker ? { id: maker.id, name: localized(maker.name) } : null;
}

export const authorNames = work => {
  const names = (work?.authors ?? []).map(author => localized(author.name)).filter(Boolean);
  return names.length ? names : (work?.tags ?? []).filter(Boolean);
};

/** Category used by the library filter chips. */
export function categoryOf(work) {
  const type = work?.type;
  if (['SOU', 'MUS', 'VCM'].includes(type) || work?.app === 'sound') return 'audio';
  if (type === 'MOV') return 'video';
  if (['MNG', 'SCM', 'WBT', 'ICG', 'COM', 'KSV'].includes(type) || work?.app === 'viewer' || work?.workno?.startsWith('BJ')) return 'comic';
  return 'other';
}

export const kindIcon = category => ({ audio: 'headphones', video: 'film', comic: 'book', other: 'sparkle' }[category] ?? 'sparkle');

/** Search text cached per work so typing stays smooth on large libraries. */
const searchIndex = new WeakMap();
export function searchText(work) {
  let text = searchIndex.get(work);
  if (!text) {
    const circle = circleOf(work);
    text = [work.workno, ...Object.values(work.name ?? {}), work.phonetic, circle?.name, ...Object.values(work.maker?.name ?? {}),
      ...(work.authors ?? []).flatMap(author => Object.values(author.name ?? {})), ...(work.tags ?? [])]
      .filter(Boolean).join('\n').normalize('NFKC').toLowerCase();
    searchIndex.set(work, text);
  }
  return text;
}
