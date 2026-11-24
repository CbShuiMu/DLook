const DLookOfflineSource = (() => {
  const play = 'https://play.dlsite.com';
  const cdn = 'https://play.dl.dlsite.com';
  const workPattern = /^(RJ|VJ|BJ)\d{6,10}$/;
  const audioTypes = new Set(['SOU', 'MUS']);
  const defaultRevision = '00000000-0000-7000-8000-000000000000';
  const maxCoverBytes = 5 * 1024 * 1024;

  function failure(phase, status, cause) {
    return Object.assign(new Error('DLsite Play request failed', { cause }), { phase, status });
  }

  async function request(url, phase, signal, credentials = 'same-origin') {
    const sameOrigin = new URL(url).origin === play;
    const headers = sameOrigin ? DLookPlaySite.csrfHeaders() : new Headers();
    let response;
    try {
      response = await fetch(url, {
        credentials, signal, headers, cache: 'no-store', redirect: sameOrigin ? 'error' : 'follow',
      });
    } catch (error) {
      if (signal.aborted) throw error;
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

  function localName(value, locale) {
    const name = typeof value === 'string' ? value : value?.[locale] || value?.ja_JP;
    return typeof name === 'string' ? name.trim() : '';
  }

  async function identify(workno, locale, signal) {
    if (!workPattern.test(workno)) return null;
    if (signal.aborted) return null;
    const work = await DLookPlaySite.cache(`work:${workno}`, async () => {
      const response = await request(`${play}/api/v4/work/${workno}`, 'catalog', AbortSignal.timeout(10000));
      return json(response, 'catalog');
    });
    if (!audioTypes.has(work?.work_type) || !work.encodable ||
        (work.sales_date == null && (!work.entitlement_type || work.entitlement_type === 'none'))) return null;
    const authors = Array.isArray(work.authors) ? work.authors.map(author => localName(author?.name, locale)).filter(Boolean) : [];
    return {
      workno,
      title: localName(work.name, locale) || workno,
      creator: [...new Set(authors)].join(', ') || localName((work.original_maker ?? work.maker)?.name, locale),
      coverUrl: work.images?.main || work.images?.thumb,
    };
  }

  async function cover(rawUrl, signal) {
    if (typeof rawUrl !== 'string' || signal.aborted) return;
    const url = new URL(rawUrl, play);
    const host = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password ||
        !(host.endsWith('.dlsite.jp') || host.endsWith('.dlsite.com'))) return;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const timeout = setTimeout(cancel, 5000);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const response = await fetch(url, { credentials: 'omit', signal: controller.signal, redirect: 'error' });
      const type = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      const length = Number(response.headers.get('content-length'));
      if (!response.ok || !type?.startsWith('image/') || length > maxCoverBytes) return;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength && bytes.byteLength <= maxCoverBytes) return { type, bytes };
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
    }
  }

  function workDirectory(workno) {
    const floor = { R: 'doujin', V: 'professional', B: 'books' }[workno[0]];
    const number = workno.slice(2);
    const bucket = String(Math.ceil(Number(number) / 1000) * 1000).padStart(number.length, '0');
    return `${cdn}/content/work/${floor}/${workno.slice(0, 2)}${bucket}/${workno}`;
  }

  function validAsset(name) {
    return typeof name === 'string' && name.trim() && name !== '.' && name !== '..' && !/[\\/?#\x00-\x1f]/.test(name);
  }

  async function catalog(workno, signal) {
    const directory = workDirectory(workno);
    async function fileTree() {
      // A successful cookie grant may return 204 and has no JSON to parse.
      await request(`${cdn}/api/v3/download/sign/cookie?workno=${workno}`, 'authorization', signal, 'include');
      const minute = Math.floor(Date.now() / 60000) * 60;
      const response = await request(`${directory}/ziptree.json?v=${minute}`, 'catalog', signal, 'include');
      return json(response, 'catalog');
    }
    let manifest;
    try {
      manifest = await fileTree();
    } catch (error) {
      if (signal.aborted || error.phase !== 'catalog' || ![401, 403].includes(error.status)) throw error;
      manifest = await fileTree();
    }
    if (!Array.isArray(manifest?.tree) || !manifest.playfile) throw failure('catalog');
    const mediaRevision = String(manifest.revision ?? defaultRevision);
    const revision = String(manifest.revision ?? manifest.hash ?? defaultRevision);
    const tracks = [];
    const found = new Set();
    function visit(nodes, folder) {
      for (const node of nodes) {
        if (node?.type === 'folder' && Array.isArray(node.children)) {
          visit(node.children, folder ? `${folder}/${node.name}` : node.name);
        }
        const file = node?.type === 'file' && manifest.playfile[node.hashname];
        const asset = file?.type === 'audio' && file.audio?.optimized?.name;
        if (!validAsset(asset) || found.has(asset)) continue;
        found.add(asset);
        const vtt = typeof file.audio.vtt === 'string' ? manifest.playfile[file.audio.vtt] : null;
        const captionAsset = vtt?.[vtt.type]?.optimized?.name;
        const track = { asset, name: node.name || asset, folder, order: tracks.length };
        if (validAsset(captionAsset)) track.captionAsset = captionAsset;
        tracks.push(track);
      }
    }
    visit(manifest.tree, '');
    return { directory, revision, mediaRevision, tracks };
  }

  function createDownloader(workno, { directory, mediaRevision }, signal) {
    let grant;
    async function authorize() {
      const response = await request(`${play}/api/v4/download/sign/url?workno=${workno}`, 'authorization', signal);
      const next = await json(response, 'authorization');
      if (!next?.params || typeof next.params !== 'object' || !Object.keys(next.params).length) {
        throw failure('authorization', response.status);
      }
      grant = { params: next.params, expires: new Date(next.expires).getTime() };
    }

    async function read(asset, credentials, caption) {
      if (!grant || grant.expires <= Date.now() + 30000) await authorize();
      const url = new URL(`${directory}/optimized/${encodeURIComponent(asset)}`);
      url.search = new URLSearchParams({ v: mediaRevision, ...grant.params }).toString();
      const response = await request(url, 'media', signal, credentials);
      if (caption) {
        const data = await json(response, 'media');
        return DLookPlayCaptions.parse(data?.webvtt);
      }
      const mime = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      const media = mime?.startsWith('audio/') ||
        ['application/octet-stream', 'binary/octet-stream', 'application/ogg', 'video/mp4'].includes(mime);
      const range = /^bytes 0-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
      const fullRange = response.status === 206 && range && Number(range[1]) + 1 === Number(range[2]);
      if (!media || (response.status !== 200 && !fullRange)) throw failure('media', response.status);
      const blob = await response.blob();
      if (!blob.size || (fullRange && blob.size !== Number(range[2]))) throw failure('media', response.status);
      return blob;
    }

    async function download(asset, caption = false) {
      try {
        return await read(asset, 'omit', caption);
      } catch (error) {
        if (signal.aborted || error.phase !== 'media') throw error;
        if (error.cause instanceof TypeError) return read(asset, 'include', caption);
        if (![401, 403].includes(error.status)) throw error;
        grant = undefined;
        try {
          return await read(asset, 'omit', caption);
        } catch (retry) {
          if (signal.aborted || retry.phase !== 'media' || ![401, 403].includes(retry.status)) throw retry;
          return read(asset, 'include', caption);
        }
      }
    }
    return { audio: download, captions: asset => download(asset, true) };
  }

  return { identify, cover, catalog, createDownloader };
})();
