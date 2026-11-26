const DLookOfflineSource = (() => {
  const play = 'https://play.dlsite.com';
  const cdn = 'https://play.dl.dlsite.com';
  const workPattern = /^(RJ|VJ|BJ)\d{6,10}$/;
  // Audio and video works; both play through the DLook player.
  const audioTypes = new Set(['SOU', 'MUS', 'MOV']);
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
    // DLsite Play counts every playable audio and video file as a progress unit.
    const unitCount = Object.values(manifest.playfile).filter(file => ['audio', 'video'].includes(file?.type)).length;
    function visit(nodes, folder) {
      for (const node of nodes) {
        if (node?.type === 'folder' && Array.isArray(node.children)) {
          visit(node.children, folder ? `${folder}/${node.name}` : node.name);
        }
        const file = node?.type === 'file' && manifest.playfile[node.hashname];
        const kind = file?.type === 'audio' || file?.type === 'video' ? file.type : null;
        const asset = kind && file[kind]?.optimized?.name;
        // Videos are served as HLS playlists; only those can be played and saved.
        if (!validAsset(asset) || found.has(asset) || (kind === 'video' && !asset.endsWith('.m3u8'))) continue;
        found.add(asset);
        const track = { asset, name: node.name || asset, folder, order: tracks.length };
        if (kind === 'video') track.kind = 'video';
        if (typeof node.hashname === 'string') track.hashname = node.hashname;
        const vtt = typeof file[kind].vtt === 'string' ? manifest.playfile[file[kind].vtt] : null;
        const captionAsset = vtt?.[vtt.type]?.optimized?.name;
        if (validAsset(captionAsset)) track.captionAsset = captionAsset;
        tracks.push(track);
      }
    }
    visit(manifest.tree, '');
    const hash = typeof manifest.hash === 'string' ? manifest.hash : undefined;
    return { directory, revision, mediaRevision, tracks, hash, unitCount };
  }

  // Grants the CDN cookie that lets native HLS playback fetch every segment of a work.
  async function authorizeStream(workno, signal) {
    await request(`${cdn}/api/v3/download/sign/cookie?workno=${workno}`, 'authorization', signal, 'include');
  }

  // Picks the sharpest HLS variant up to 720p from a master playlist.
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

  function createDownloader(workno, { directory, mediaRevision }, signal) {
    let grant;
    const base = `${directory}/optimized/`;
    async function authorize() {
      const response = await request(`${play}/api/v4/download/sign/url?workno=${workno}`, 'authorization', signal);
      const next = await json(response, 'authorization');
      if (!next?.params || typeof next.params !== 'object' || !Object.keys(next.params).length) {
        throw failure('authorization', response.status);
      }
      grant = { params: next.params, expires: new Date(next.expires).getTime() };
    }

    // path is relative to the work's optimized folder and may contain HLS subfolders.
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
      if (kind === 'captions') {
        const data = await json(response, 'media');
        return DLookPlayCaptions.parse(data?.webvtt);
      }
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
        if (signal.aborted || error.phase !== 'media') throw error;
        if (error.cause instanceof TypeError) return read(path, 'include', kind);
        if (![401, 403].includes(error.status)) throw error;
        grant = undefined;
        try {
          return await read(path, 'omit', kind);
        } catch (retry) {
          if (signal.aborted || retry.phase !== 'media' || ![401, 403].includes(retry.status)) throw retry;
          return read(path, 'include', kind);
        }
      }
    }

    // Saves one HLS variant; the stored playlist keeps "#DLOOK-SEGMENT:<n>" in place of each segment URI.
    async function video(asset, saveSegment) {
      const master = await download(asset, 'text');
      const variant = chooseVariant(master);
      if (!variant || /^[a-z]+:|^\//i.test(variant)) throw failure('media');
      const folder = asset.includes('/') ? asset.slice(0, asset.lastIndexOf('/') + 1) : '';
      const variantPath = folder + variant;
      const variantFolder = variantPath.includes('/') ? variantPath.slice(0, variantPath.lastIndexOf('/') + 1) : '';
      const lines = (await download(variantPath, 'text')).split(/\r?\n/);
      if (lines.some(line => line.startsWith('#EXT-X-KEY') && !/METHOD=NONE/.test(line))) throw failure('media');
      let count = 0, size = 0;
      const playlist = [];
      for (const line of lines) {
        if (!line.trim() || line.startsWith('#')) {
          playlist.push(line);
          continue;
        }
        if (/^[a-z]+:|^\//i.test(line.trim())) throw failure('media');
        if (signal.aborted) throw signal.reason;
        const blob = await download(variantFolder + line.trim(), 'media');
        await saveSegment(count, blob);
        size += blob.size;
        playlist.push(`#DLOOK-SEGMENT:${count++}`);
      }
      if (!count) throw failure('media');
      return { playlist: playlist.join('\n'), count, size };
    }

    return {
      audio: path => download(path, 'media'),
      captions: path => download(path, 'captions'),
      video,
      // Streams the same signed media a download would fetch, for tracks without a local copy.
      url: async path => String(await signedUrl(path)),
    };
  }

  // Native HLS playback relies on the CDN cookie instead of signed query parameters.
  function streamUrl({ directory, mediaRevision }, asset) {
    return `${directory}/optimized/${encodeURIComponent(asset)}?v=${encodeURIComponent(mediaRevision)}`;
  }

  return { identify, cover, catalog, createDownloader, authorizeStream, streamUrl };
})();
