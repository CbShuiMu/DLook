// Content access for a work: signed ziptree catalog, file tree, signed media URLs,
// captions and the offline downloader. Ported from chrome-extension/play-offline-source.js
// and extended with the full file tree (images, PDFs, text) for the new work page and reader.
import { CDN, PLAY, WORKNO, csrfHeaders } from '../core/http.js';
import * as kv from '../core/kv.js';
import { work as workInfo } from './api.js';

const audioTypes = new Set(['SOU', 'MUS', 'MOV']);
const defaultRevision = '00000000-0000-7000-8000-000000000000';
const maxCoverBytes = 5 * 1024 * 1024;

function failure(phase, status, cause) {
  return Object.assign(new Error('DLsite Play request failed', { cause }), { phase, status });
}

async function request(url, phase, signal, credentials = 'same-origin') {
  const sameOrigin = new URL(url).origin === location.origin || new URL(url).origin === PLAY;
  const headers = sameOrigin ? csrfHeaders() : new Headers();
  let response;
  try {
    response = await fetch(url, { credentials, signal, headers, cache: 'no-store', redirect: sameOrigin ? 'error' : 'follow' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw failure(phase, undefined, error);
  }
  if (!response.ok) throw failure(phase, response.status);
  return response;
}

async function json(response, phase) {
  try { return await response.json(); } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw failure(phase, response.status, error);
  }
}

export function localName(value, locale) {
  const name = typeof value === 'string' ? value : value?.[locale] || value?.ja_JP || Object.values(value ?? {})[0];
  return typeof name === 'string' ? name.trim() : '';
}

/** Basic info when the work can be played or saved through DLook (audio/video works). */
export async function identify(workno, locale) {
  if (!WORKNO.test(workno)) return null;
  const work = await workInfo(workno);
  if (!audioTypes.has(work?.work_type) || !work.encodable ||
      (work.sales_date == null && (!work.entitlement_type || work.entitlement_type === 'none'))) return null;
  // Audio works credit their voice actors as `voice_by` tags; `authors` holds other creators.
  const voices = Array.isArray(work.tags) ? work.tags.filter(tag => tag?.classification === 'voice_by').map(tag => tag.name?.trim()).filter(Boolean) : [];
  const authors = voices.length ? voices : Array.isArray(work.authors) ? work.authors.map(author => localName(author?.name, locale)).filter(Boolean) : [];
  return {
    workno,
    title: localName(work.name, locale) || workno,
    creator: [...new Set(authors)].join(', ') || localName((work.original_maker ?? work.maker)?.name, locale),
    coverUrl: work.images?.main || work.images?.thumb,
  };
}

export async function cover(rawUrl, signal) {
  if (typeof rawUrl !== 'string' || signal?.aborted) return;
  const url = new URL(rawUrl, PLAY);
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.username || url.password ||
      !(host.endsWith('.dlsite.jp') || host.endsWith('.dlsite.com'))) return;
  const response = await fetch(url, { credentials: 'omit', signal: signal ?? AbortSignal.timeout(5000), redirect: 'error' });
  const type = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  const length = Number(response.headers.get('content-length'));
  if (!response.ok || !type?.startsWith('image/') || length > maxCoverBytes) return;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength && bytes.byteLength <= maxCoverBytes) return { type, bytes };
}

export function workDirectory(workno) {
  const floor = { R: 'doujin', V: 'professional', B: 'books' }[workno[0]];
  const number = workno.slice(2);
  const bucket = String(Math.ceil(Number(number) / 1000) * 1000).padStart(number.length, '0');
  return `${CDN}/content/work/${floor}/${workno.slice(0, 2)}${bucket}/${workno}`;
}

function validAsset(name) {
  return typeof name === 'string' && name.trim() && name !== '.' && name !== '..' && !/[\\/?#\x00-\x1f]/.test(name);
}

/** Grants the CDN cookie used by <img>, HLS and ziptree requests. Cached until shortly before expiry. */
export async function authorizeStream(workno, signal) {
  const key = `grant:${workno}`;
  const cached = await kv.peek(key);
  if (cached?.value?.until > Date.now()) return;
  const response = await request(`${CDN}/api/v3/download/sign/cookie?workno=${workno}`, 'authorization', signal, 'include');
  let expires = Date.now() + 10 * 60000;
  try {
    const data = response.status === 204 ? null : await response.json();
    const parsed = Date.parse(data?.expires);
    if (Number.isFinite(parsed)) expires = parsed;
  } catch {}
  await kv.put(key, { until: expires - 60000 }, { persist: false });
}

/**
 * Signed query parameters (CloudFront Policy / Signature / Key-Pair-Id) for a work's files.
 * Some accounts and works get 402/403 from the CDN cookie grant but are still entitled
 * through these signed URLs (the official viewer uses them), so they are the fallback.
 */
export function signedParams(workno, { force = false } = {}) {
  return kv.swr(`signed:${workno}`, async () => {
    const response = await request(`${PLAY}/api/v4/download/sign/url?workno=${workno}`, 'authorization', AbortSignal.timeout(10000));
    const data = await json(response, 'authorization');
    if (!data?.params || typeof data.params !== 'object' || !Object.keys(data.params).length) throw failure('authorization', response.status);
    return { params: data.params, until: (Date.parse(data.expires) || Date.now() + 10 * 60000) - 60000 };
  }, { ttl: 5 * 60000, persist: false, force }).then(async value => (value.until > Date.now() ? value : signedParams(workno, { force: true })));
}

/**
 * How this work's CDN files can be read: { mode: 'cookie' } after a cookie grant, or
 * { mode: 'signed', params } when only signed URLs are allowed.
 */
export async function access(workno, signal) {
  try {
    await authorizeStream(workno, signal);
    return { mode: 'cookie' };
  } catch (error) {
    if (signal?.aborted || ![401, 402, 403].includes(error.status)) throw error;
    const { params } = await signedParams(workno);
    return { mode: 'signed', params };
  }
}

const withParams = (query, grant) => grant.mode === 'signed' ? `${query}&${new URLSearchParams(grant.params)}` : query;

async function fetchManifest(workno, signal) {
  const directory = workDirectory(workno);
  const read = async () => {
    const grant = await access(workno, signal);
    const minute = Math.floor(Date.now() / 60000) * 60;
    const url = `${directory}/ziptree.json?${withParams(`v=${minute}`, grant)}`;
    return json(await request(url, 'catalog', signal, grant.mode === 'signed' ? 'omit' : 'include'), 'catalog');
  };
  try {
    return await read();
  } catch (error) {
    if (signal?.aborted || error.phase !== 'catalog' || ![401, 403].includes(error.status)) throw error;
    await Promise.all([kv.invalidate(`grant:${workno}`), kv.invalidate(`signed:${workno}`)]);
    return read();
  }
}

/** The raw ziptree, cached 10 minutes in memory (it is re-signed per minute on the CDN). */
export function manifest(workno, { force = false } = {}) {
  return kv.swr(`ziptree:${workno}`, () => fetchManifest(workno, AbortSignal.timeout(15000)), { ttl: 10 * 60000, persist: false, force });
}

const extensionKinds = {
  audio: ['mp3', 'm4a', 'aac', 'wma', 'wav', 'flac', 'ogg', 'opus'],
  video: ['mp4', 'wmv', 'mpg', 'mpeg', 'mov', 'avi', 'flv', 'm4v', 'webm', 'mkv'],
  image: ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp'],
  pdf: ['pdf'],
  text: ['txt', 'md', 'csv', 'log'],
  vtt: ['vtt', 'srt'],
  html: ['html', 'htm'],
  epub: ['epub'],
};
const kindOf = name => {
  const ext = name.split('.').pop()?.toLowerCase();
  return Object.keys(extensionKinds).find(kind => extensionKinds[kind].includes(ext)) ?? 'other';
};

/**
 * Builds a browsable tree: { name, path, kind: 'folder', children } / { name, path, kind, hashname, playfile }.
 * `kind` comes from the playfile type when available.
 */
export function fileTree(data) {
  const playfile = data?.playfile ?? {};
  const visit = (nodes, folder) => (nodes ?? []).map(node => {
    const path = folder ? `${folder}/${node.name}` : node.name;
    if (node?.type === 'folder') return { name: node.name, path, kind: 'folder', children: visit(node.children, path) };
    const file = playfile[node.hashname];
    return {
      name: node.name, path, hashname: node.hashname, playfile: file ?? null,
      kind: file?.type && file.type !== 'unknown' ? file.type : kindOf(node.name),
      size: file?.length ?? file?.size ?? null,
    };
  });
  return visit(data?.tree, '');
}

/** Audio and video tracks of a work (for the player and offline saving). */
export async function catalog(workno, signal) {
  const data = signal ? await fetchManifest(workno, signal) : await manifest(workno);
  if (!Array.isArray(data?.tree) || !data.playfile) throw failure('catalog');
  const directory = workDirectory(workno);
  const mediaRevision = String(data.revision ?? defaultRevision);
  const revision = String(data.revision ?? data.hash ?? defaultRevision);
  const tracks = [];
  const found = new Set();
  const unitCount = Object.values(data.playfile).filter(file => ['audio', 'video'].includes(file?.type)).length;
  function visit(nodes, folder) {
    for (const node of nodes) {
      if (node?.type === 'folder' && Array.isArray(node.children)) visit(node.children, folder ? `${folder}/${node.name}` : node.name);
      const file = node?.type === 'file' && data.playfile[node.hashname];
      const kind = file?.type === 'audio' || file?.type === 'video' ? file.type : null;
      const asset = kind && file[kind]?.optimized?.name;
      if (!validAsset(asset) || found.has(asset) || (kind === 'video' && !asset.endsWith('.m3u8'))) continue;
      found.add(asset);
      const track = { asset, name: node.name || asset, folder, order: tracks.length };
      if (kind === 'video') track.kind = 'video';
      if (typeof node.hashname === 'string') track.hashname = node.hashname;
      const duration = Number(file[kind]?.optimized?.duration ?? file[kind]?.duration);
      if (Number.isFinite(duration)) track.duration = duration;
      const vtt = typeof file[kind].vtt === 'string' ? data.playfile[file[kind].vtt] : null;
      const captionAsset = vtt?.[vtt.type]?.optimized?.name;
      if (validAsset(captionAsset)) track.captionAsset = captionAsset;
      tracks.push(track);
    }
  }
  visit(data.tree, '');
  const hash = typeof data.hash === 'string' ? data.hash : undefined;
  return { directory, revision, mediaRevision, tracks, hash, unitCount };
}

/**
 * Pages for the comic reader from the folder that contains `path` (image works) or from a PDF.
 * Returns { pages: [{ src, width, height, key, name, crypt }], crypt } where `crypt` means the
 * protected renderer is required (those open in the official viewer instead).
 */
/** The file-tree node at `path` ('folder/file.ext'), or null. */
export async function findFile(workno, path) {
  let nodes = fileTree(await manifest(workno));
  const segments = path.split('/');
  for (const segment of segments.slice(0, -1)) nodes = nodes.find(node => node.kind === 'folder' && node.name === segment)?.children ?? [];
  return nodes.find(node => node.name === segments.at(-1)) ?? null;
}

/**
 * A text file's content (Read me, scripts…). The ziptree states its encoding; when decoding
 * with it fails, common Japanese/Chinese encodings are tried before a lossy UTF-8 decode.
 */
export async function text(workno, path) {
  const data = await manifest(workno);
  const node = await findFile(workno, path);
  const vtt = node?.kind === 'vtt';
  const optimized = node?.playfile?.[vtt ? 'vtt' : 'text']?.optimized;
  if (!optimized?.name || !validAsset(optimized.name)) return null;
  const grant = await access(workno);
  const query = withParams(`v=${encodeURIComponent(String(data.revision ?? defaultRevision))}`, grant);
  const response = await request(`${workDirectory(workno)}/optimized/${encodeURIComponent(optimized.name)}?${query}`, 'media',
    AbortSignal.timeout(15000), grant.mode === 'signed' ? 'omit' : 'include');
  if (vtt) {
    // Caption files are stored as JSON cues: shown as a timed transcript.
    const stamp = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    return parseCaptions((await json(response, 'media'))?.webvtt).map(cue => `[${stamp(cue.start)}]  ${cue.lines.join('\n')}`).join('\n\n');
  }
  const bytes = await response.arrayBuffer();
  for (const encoding of [optimized.encoding, 'utf-8', 'shift_jis', 'gb18030', 'utf-16le'].filter(Boolean)) {
    try { return new TextDecoder(encoding.toLowerCase(), { fatal: true }).decode(bytes).replace(/^﻿/, ''); } catch {}
  }
  return new TextDecoder().decode(bytes);
}

export async function pages(workno, path) {
  const data = await manifest(workno);
  const grant = await access(workno);
  const base = `${workDirectory(workno)}/optimized`;
  // Page <img> requests carry the CDN cookie, or the signed parameters when cookies are refused.
  const query = `?${withParams(`v=${encodeURIComponent(String(data.revision ?? defaultRevision))}`, grant)}`;
  const credentials = grant.mode === 'signed' ? 'omit' : 'include';
  const tree = fileTree(data);
  const segments = path.split('/');
  let nodes = tree;
  for (const segment of segments.slice(0, -1)) nodes = nodes.find(node => node.kind === 'folder' && node.name === segment)?.children ?? [];
  const target = nodes.find(node => node.name === segments.at(-1));
  if (target?.kind === 'pdf' && target.playfile?.pdf?.page) {
    const list = target.playfile.pdf.page.map((page, index) => ({
      src: `${base}/${page.optimized.name}${query}`, width: page.optimized.width, height: page.optimized.height,
      crypt: Boolean(page.optimized.crypt), key: target.hashname, index, name: page.optimized.name,
    }));
    return { pages: list, crypt: list.some(page => page.crypt), credentials, pdf: true, key: target.hashname, folder: segments.slice(0, -1).join('/') };
  }
  const list = nodes.filter(node => node.kind === 'image' && node.playfile?.image?.optimized).map(node => {
    let file = node.hashname;
    if (!/\.(?:png|jpg|gif)$/.test(file)) file = file.replace(/\.[a-z]+$/, '.jpg');
    const optimized = node.playfile.image.optimized;
    // `name` is the optimized file name: it seeds the tile order of protected pages.
    return { src: `${base}/${file}${query}`, width: optimized.width, height: optimized.height, crypt: Boolean(optimized.crypt), key: node.hashname, name: optimized.name ?? file, title: node.name, path: node.path };
  });
  return { pages: list, crypt: list.some(page => page.crypt), credentials, pdf: false, folder: segments.slice(0, -1).join('/') };
}

function chooseVariant(master) {
  const lines = master.split(/\r?\n/);
  const variants = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF')) continue;
    const uri = lines.slice(index + 1).find(line => line.trim() && !line.startsWith('#'))?.trim();
    const height = Number(/RESOLUTION=\d+x(\d+)/.exec(lines[index])?.[1]) || 0;
    if (uri) variants.push({ uri, height });
  }
  if (!variants.length) return null;
  const fitting = variants.filter(variant => variant.height <= 720).sort((a, b) => b.height - a.height);
  return (fitting[0] ?? variants.sort((a, b) => a.height - b.height)[0]).uri;
}

export function parseCaptions(data) {
  const seconds = value => {
    if (typeof value !== 'string' || !/^(?:\d{2,}:)?\d{2}:\d{2}(?:\.\d+)?$/.test(value)) return NaN;
    return value.split(':').reduce((time, part) => time * 60 + Number(part), 0);
  };
  if (!Array.isArray(data)) return [];
  return data.flatMap(cue => {
    const start = seconds(cue?.start_time);
    const end = seconds(cue?.end_time);
    if (!(end > start) || !Array.isArray(cue.subtitles)) return [];
    const lines = cue.subtitles.filter(line => typeof line === 'string' && line.trim());
    return lines.length ? [{ start, end, lines }] : [];
  }).sort((left, right) => left.start - right.start);
}

export function createDownloader(workno, { directory, mediaRevision }, signal) {
  let grant;
  const base = `${directory}/optimized/`;
  async function authorize() {
    const response = await request(`${PLAY}/api/v4/download/sign/url?workno=${workno}`, 'authorization', signal);
    const next = await json(response, 'authorization');
    if (!next?.params || typeof next.params !== 'object' || !Object.keys(next.params).length) throw failure('authorization', response.status);
    grant = { params: next.params, expires: new Date(next.expires).getTime() };
  }

  async function signedUrl(path) {
    if (!grant || grant.expires <= Date.now() + 30000) await authorize();
    const url = new URL(path.split('/').map(encodeURIComponent).join('/'), base);
    if (!url.href.startsWith(base)) throw failure('media');
    url.search = new URLSearchParams({ v: mediaRevision, ...grant.params }).toString();
    return url;
  }

  async function read(path, credentials, kind) {
    const url = await signedUrl(path);
    const response = await request(url, 'media', signal, credentials);
    if (kind === 'captions') return parseCaptions((await json(response, 'media'))?.webvtt);
    if (kind === 'text') return response.text();
    const mime = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    const media = mime?.startsWith('audio/') || mime?.startsWith('video/') ||
      ['application/octet-stream', 'binary/octet-stream', 'application/ogg'].includes(mime);
    const range = /^bytes 0-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
    const fullRange = response.status === 206 && range && Number(range[1]) + 1 === Number(range[2]);
    if (!media || (response.status !== 200 && !fullRange)) throw failure('media', response.status);
    const blob = await response.blob();
    if (!blob.size || (fullRange && blob.size !== Number(range[2]))) throw failure('media', response.status);
    return blob;
  }

  async function download(path, kind) {
    try {
      return await read(path, 'omit', kind);
    } catch (error) {
      if (signal?.aborted || error.phase !== 'media') throw error;
      if (error.cause instanceof TypeError) return read(path, 'include', kind);
      if (![401, 403].includes(error.status)) throw error;
      grant = undefined;
      try {
        return await read(path, 'omit', kind);
      } catch (retry) {
        if (signal?.aborted || retry.phase !== 'media' || ![401, 403].includes(retry.status)) throw retry;
        return read(path, 'include', kind);
      }
    }
  }

  async function video(asset, saveSegment, onProgress) {
    const master = await download(asset, 'text');
    const variant = chooseVariant(master);
    if (!variant || /^[a-z]+:|^\//i.test(variant)) throw failure('media');
    const folder = asset.includes('/') ? asset.slice(0, asset.lastIndexOf('/') + 1) : '';
    const variantPath = folder + variant;
    const variantFolder = variantPath.includes('/') ? variantPath.slice(0, variantPath.lastIndexOf('/') + 1) : '';
    const lines = (await download(variantPath, 'text')).split(/\r?\n/);
    if (lines.some(line => line.startsWith('#EXT-X-KEY') && !/METHOD=NONE/.test(line))) throw failure('media');
    const total = lines.filter(line => line.trim() && !line.startsWith('#')).length;
    let count = 0, size = 0;
    const playlist = [];
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) { playlist.push(line); continue; }
      if (/^[a-z]+:|^\//i.test(line.trim())) throw failure('media');
      if (signal?.aborted) throw signal.reason;
      const blob = await download(variantFolder + line.trim(), 'media');
      await saveSegment(count, blob);
      size += blob.size;
      playlist.push(`#DLOOK-SEGMENT:${count++}`);
      onProgress?.(count / total);
    }
    if (!count) throw failure('media');
    return { playlist: playlist.join('\n'), count, size };
  }

  return {
    audio: path => download(path, 'media'),
    captions: path => download(path, 'captions'),
    text: path => download(path, 'text'),
    video,
    url: async path => String(await signedUrl(path)),
  };
}

export function streamUrl({ directory, mediaRevision }, asset) {
  return `${directory}/optimized/${encodeURIComponent(asset)}?v=${encodeURIComponent(mediaRevision)}`;
}

/** Signed streaming access shared by every queue for ten minutes. */
export function streamSource(workno) {
  return kv.swr(`stream:${workno}`, async () => {
    const data = await catalog(workno);
    return { catalog: data, download: createDownloader(workno, data) };
  }, { ttl: 10 * 60000, persist: false });
}
