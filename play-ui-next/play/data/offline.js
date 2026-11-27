// Offline copies (audio and HLS video) and queue resolution for the player.
// Logic ported from chrome-extension/play-offline.js; the UI now lives in ui/views/offline.js.
import store from './offline-store.js';
import * as source from './source.js';

export const offlineHref = '/settings#dlook-offline';
const jobs = new Map();
const listeners = new Set();
let warming;

export const trackPath = track => track.folder ? `${track.folder}/${track.name}` : track.name;
export const localeFor = language => ({ ja: 'ja_JP', en: 'en_US', ko: 'ko_KR', 'zh-cn': 'zh_CN', 'zh-tw': 'zh_TW', zh: 'zh_CN' }[language] ??
  language.replace(/-([a-z]{2})$/, (_, suffix) => '_' + suffix.toUpperCase()));

export function onChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const emit = workno => { for (const listener of listeners) listener(workno); };

export const job = workno => jobs.get(workno);
export const list = () => store.list().then(rows => rows.filter(work => work.tracks.length).sort((a, b) => b.updated - a.updated));
export const get = workno => store.work(workno).catch(() => null);
export const cover = workno => store.cover(workno);

export async function remove(workno) {
  await store.remove(workno);
  emit(workno);
}

/** Saved state for a work page: { saved, total } plus whether the online catalog lists more tracks. */
export async function state(workno) {
  const cached = await get(workno);
  if (!cached) return null;
  const result = { saved: cached.tracks.length, total: cached.total };
  if (navigator.onLine && result.saved === result.total) {
    const online = await source.streamSource(workno).catch(() => null);
    const saved = new Set(cached.tracks.map(track => track.asset));
    const missing = online && cached.revision === online.catalog.revision ?
      online.catalog.tracks.filter(track => !saved.has(track.asset)).length : 0;
    if (missing) result.total = cached.tracks.length + missing;
  }
  return result;
}

function warmOfflinePage() {
  const worker = navigator.serviceWorker;
  if (!worker) return;
  warming ??= (async () => {
    if (!worker.controller) {
      await new Promise(resolve => {
        const ready = () => { clearTimeout(timeout); resolve(); };
        const timeout = setTimeout(ready, 3000);
        worker.addEventListener('controllerchange', ready, { once: true });
      });
    }
    if (!worker.controller) return;
    // Play's service worker caches /settings; DLook's offline page is that document with a hash.
    const url = new URL('/settings', location.origin);
    if (await window.caches?.match(url, { cacheName: 'content' }).catch(() => null)) return;
    const response = await fetch(url, { cache: 'reload', credentials: 'same-origin', signal: AbortSignal.timeout(5000) });
    await response.text();
  })().catch(() => {}).finally(() => { warming = undefined; });
  return warming;
}

/** Starts or resumes saving every audio/video track of a work. */
export async function save(workno, work) {
  if (jobs.has(workno)) return;
  const current = await state(workno);
  if (current && current.saved === current.total) return;
  const entry = { saved: current?.saved ?? 0, total: current?.total ?? 0, message: '', status: undefined, fraction: 0, controller: new AbortController() };
  const { signal } = entry.controller;
  jobs.set(workno, entry);
  emit(workno);
  let offlinePage, artwork, phase = 'catalog';
  try {
    offlinePage = warmOfflinePage();
    navigator.storage?.persist?.().catch(() => {});
    const catalog = await source.catalog(workno, signal);
    if (!catalog.tracks.length) { entry.message = 'noAudio'; return; }
    phase = 'storage';
    const record = await store.start(work, catalog.revision, catalog.tracks, catalog);
    if (!record.hasCover) {
      artwork = source.cover(work.coverUrl, signal).then(data => data && !signal.aborted && store.saveCover(record, data)).catch(() => {});
    }
    const saved = new Set(record.tracks.map(track => track.asset));
    entry.saved = saved.size;
    entry.total = record.total;
    emit(workno);
    const download = source.createDownloader(workno, catalog, signal);
    for (const track of catalog.tracks) {
      if (signal.aborted) throw signal.reason;
      if (saved.has(track.asset)) continue;
      let media;
      entry.fraction = 0;
      try {
        media = track.kind === 'video'
          ? await download.video(track.asset, (index, blob) => store.saveSegment(record, track.asset, index, blob), fraction => { entry.fraction = fraction; emit(workno); })
          : await download.audio(track.asset);
      } catch (error) {
        if (signal.aborted || error.phase === 'authorization' || !error.phase) throw error;
        entry.message = 'media';
        entry.status = error.status;
        continue;
      }
      const captions = track.captionAsset && await download.captions(track.captionAsset).catch(() => undefined);
      if (signal.aborted) throw signal.reason;
      entry.saved = track.kind === 'video' ? await store.saveVideo(record, track, media, captions) : await store.save(record, track, media, captions);
      emit(workno);
    }
  } catch (error) {
    entry.message = error?.name === 'AbortError' ? 'stopped' : error?.name === 'QuotaExceededError' ? 'quota' : error?.phase ?? phase;
    entry.status = error?.status;
  } finally {
    if (entry.saved && !signal.aborted) await Promise.all([offlinePage, artwork]);
    jobs.delete(workno);
    lastResult.set(workno, { saved: entry.saved, total: entry.total, message: entry.message, status: entry.status });
    emit(workno);
  }
}

const lastResult = new Map();
export const result = workno => lastResult.get(workno);
export const pause = workno => jobs.get(workno)?.controller.abort();

/* ------------------------------------------------------------------ playback */

async function progressMeta({ work, track }) {
  if (track.hashname && work.hash && work.unitCount) return { key: track.hashname, hash: work.hash, unitCount: work.unitCount };
  const { catalog } = await source.streamSource(work.workno);
  const path = track.path ?? trackPath(track);
  const found = catalog.tracks.find(entry => entry.asset === track.asset) ?? catalog.tracks.find(entry => trackPath(entry) === path);
  return found?.hashname && catalog.hash ? { key: found.hashname, hash: catalog.hash, unitCount: catalog.unitCount } : null;
}
export { progressMeta };

function localVideo({ playlist, segments }) {
  const urls = segments.map(blob => URL.createObjectURL(new Blob([blob], { type: 'video/mp2t' })));
  const text = playlist.replace(/^#DLOOK-SEGMENT:(\d+)$/gm, (_, index) => urls[Number(index)]);
  const src = URL.createObjectURL(new Blob([text], { type: 'application/vnd.apple.mpegurl' }));
  return { src, revoke: [src, ...urls] };
}

/** Returns { src, revoke, captions, video, local }; the caller revokes `revoke` when done. */
export async function resolveTrack(item) {
  const video = item.track.kind === 'video';
  if (!item.stream) {
    const [media, captions] = await Promise.all([
      video ? store.video(item.work, item.track.asset) : store.track(item.work, item.track.asset),
      store.captions(item.work, item.track.asset).catch(() => []),
    ]);
    if (media && video) return { ...localVideo(media), captions: captions ?? [], video, local: true };
    if (media) {
      const src = URL.createObjectURL(media);
      return { src, revoke: [src], captions: captions ?? [], video, local: true };
    }
  }
  const { catalog, download } = await source.streamSource(item.work.workno);
  const path = item.track.path ?? trackPath(item.track);
  const track = catalog.tracks.find(entry => entry.asset === item.track.asset) ?? catalog.tracks.find(entry => trackPath(entry) === path);
  if (!track) throw new Error('Missing online track');
  const isVideo = track.kind === 'video';
  const [src, captions] = await Promise.all([
    // Video uses the CDN cookie; when the cookie grant is refused, fall back to a signed URL.
      isVideo ? source.authorizeStream(item.work.workno, AbortSignal.timeout(10000)).then(() => source.streamUrl(catalog, track.asset), () => download.url(track.asset)) : download.url(track.asset),
    track.captionAsset ? download.captions(track.captionAsset).catch(() => []) : [],
  ]);
  return { src, revoke: [], captions: captions ?? [], video: isVideo, local: false };
}

/**
 * Entries are { workno, path } for single tracks or { workno } for whole works.
 * Returns { queue: [{ work, track, stream }], cachedCount }.
 */
export async function buildQueue(entries, language) {
  const worknos = [...new Set(entries.map(entry => entry.workno))];
  const locale = localeFor(language);
  const saved = new Map(await Promise.all(worknos.map(async workno => {
    const cached = await get(workno);
    return [workno, cached?.tracks.length ? cached : null];
  })));
  const metadata = new Map(await Promise.all(worknos.map(async workno => {
    const cached = saved.get(workno);
    if (cached) return [workno, cached];
    const info = await source.identify(workno, locale).catch(() => null);
    return [workno, { workno, title: info?.title || workno, creator: info?.creator, coverUrl: info?.coverUrl, hasCover: false }];
  })));
  const whole = worknos.filter(workno => entries.some(entry => entry.workno === workno && entry.path === undefined));
  const sources = new Map(await Promise.all(whole.map(async workno => [workno, navigator.onLine ? await source.streamSource(workno).catch(() => null) : null])));
  const queue = [];
  let cachedCount = 0;
  for (const entry of entries) {
    const cached = saved.get(entry.workno);
    const work = metadata.get(entry.workno);
    if (entry.path !== undefined) {
      const track = cached?.tracks.find(item => trackPath(item) === entry.path);
      if (track) cachedCount += 1;
      const slash = entry.path.lastIndexOf('/');
      queue.push(track ? { work: cached, track } : {
        work, stream: true,
        track: { path: entry.path, name: entry.path.slice(slash + 1), folder: slash > 0 ? entry.path.slice(0, slash) : '' },
      });
      continue;
    }
    const online = sources.get(entry.workno);
    if (!online) {
      cachedCount += cached?.tracks.length ?? 0;
      queue.push(...(cached?.tracks ?? []).slice().sort((a, b) => a.order - b.order).map(track => ({ work: cached, track })));
      continue;
    }
    const local = new Map(cached?.tracks.map(track => [track.asset, track]));
    for (const track of online.catalog.tracks) {
      const copy = local.get(track.asset);
      if (copy && cached.revision === online.catalog.revision) {
        cachedCount += 1;
        queue.push({ work: cached, track: copy });
      } else {
        queue.push({ work, track, stream: true });
      }
    }
  }
  return { queue, cachedCount };
}

export async function cachedTracks(entries) {
  const worknos = [...new Set(entries.map(entry => entry.workno))];
  const works = await Promise.all(worknos.map(workno => get(workno)));
  const paths = new Set();
  for (const work of works) for (const track of work?.tracks ?? []) paths.add(`${work.workno}\n${trackPath(track)}`);
  return entries.filter(entry => paths.has(`${entry.workno}\n${entry.path}`)).length;
}

export async function usage() {
  const works = await list().catch(() => []);
  return { count: works.length, bytes: works.reduce((sum, work) => sum + work.tracks.reduce((s, t) => s + (t.size || 0), 0), 0) };
}
