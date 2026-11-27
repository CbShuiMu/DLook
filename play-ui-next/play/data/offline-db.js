// Direct IndexedDB access to offline copies. Port of chrome-extension/play-offline-store.js
// (same schema, so works saved by the previous DLook extension remain readable).
// Which database is used (extension or page origin) is decided in offline-store.js.
export const DB_NAME = 'dlook-offline-audio';

export function createDirectStore() {
  let connection;

  function open() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('works', { keyPath: 'workno' });
          request.result.createObjectStore('tracks');
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); connection = undefined; };
          resolve(db);
        };
      }).catch(error => {
        connection = undefined;
        throw error;
      });
    }
    return connection;
  }

  async function transact(names, mode, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error ?? new DOMException('Offline operation interrupted', 'AbortError'));
      try {
        run(tx, value => { result = value; });
      } catch (error) {
        reject(error);
        tx.abort();
      }
    });
  }

  function read(name, key) {
    return transact(name, 'readonly', (tx, finish) => {
      const store = tx.objectStore(name);
      const request = key === undefined ? store.getAll() : store.get(key);
      request.onsuccess = () => finish(request.result);
    });
  }

  const workTrackRange = workno => IDBKeyRange.bound([workno], [workno, []]);
  const coverKey = workno => ['cover', workno];
  const captionKey = (work, asset) => [work.workno, work.revision, asset, 'captions'];
  // A track's own entry plus its captions and video segments all share this key prefix.
  const assetRange = (workno, revision, asset) => IDBKeyRange.bound([workno, revision, asset], [workno, revision, asset, []]);
  const segmentKey = (work, asset, index) => [work.workno, work.revision, asset, 'segment', index];
  const segmentRange = (work, asset) =>
    IDBKeyRange.bound([work.workno, work.revision, asset, 'segment'], [work.workno, work.revision, asset, 'segment', []]);

  function start({ workno, title, creator }, revision, tracks, { hash, unitCount } = {}) {
    const attempt = crypto.randomUUID();
    return transact(['works', 'tracks'], 'readwrite', (tx, finish) => {
      const works = tx.objectStore('works');
      const get = works.get(workno);
      get.onsuccess = () => {
        const previous = get.result;
        const audio = tx.objectStore('tracks');
        const keep = new Map(tracks.map(track => [track.asset, track]));
        const saved = [];
        if (previous?.revision === revision) {
          for (const track of previous.tracks) {
            const updated = keep.get(track.asset);
            if (updated) saved.push({ ...updated, size: track.size });
            else audio.delete(assetRange(workno, revision, track.asset));
          }
        } else if (previous) {
          audio.delete(workTrackRange(workno));
        }
        const record = {
          workno, title, creator: creator || previous?.creator,
          hasCover: Boolean(previous?.hasCover), revision, attempt, total: tracks.length, tracks: saved, hash, unitCount,
          updated: previous?.updated ?? Date.now(),
        };
        works.put(record);
        finish(record);
      };
    });
  }

  function saveCover(record, cover) {
    return transact(['works', 'tracks'], 'readwrite', tx => {
      const works = tx.objectStore('works');
      const request = works.get(record.workno);
      request.onsuccess = () => {
        const latest = request.result;
        if (latest?.attempt !== record.attempt) return;
        tx.objectStore('tracks').put(cover, coverKey(record.workno));
        latest.hasCover = true;
        works.put(latest);
      };
    });
  }

  function writeTrack(record, track, data, size, captions) {
    return transact(['works', 'tracks'], 'readwrite', (tx, finish) => {
      const works = tx.objectStore('works');
      const request = works.get(record.workno);
      request.onsuccess = () => {
        const latest = request.result;
        if (latest?.attempt !== record.attempt) {
          tx.abort();
          return;
        }
        const store = tx.objectStore('tracks');
        store.put(data, [record.workno, record.revision, track.asset]);
        if (captions?.length) store.put(captions, captionKey(record, track.asset));
        latest.tracks.push({ ...track, size });
        latest.updated = Date.now();
        works.put(latest);
        finish(latest.tracks.length);
      };
    });
  }

  // Segments are written one by one so a long video never has to sit in memory as a whole.
  async function saveSegment(record, asset, index, blob) {
    try {
      return await writeSegment(record, asset, index, blob);
    } catch (error) {
      // Some WebKit storage modes reject Blob writes but accept byte buffers.
      if (error.name !== 'UnknownError') throw error;
      return writeSegment(record, asset, index, { bytes: await blob.arrayBuffer(), type: blob.type });
    }
  }

  function writeSegment(record, asset, index, blob) {
    return transact(['works', 'tracks'], 'readwrite', tx => {
      const request = tx.objectStore('works').get(record.workno);
      request.onsuccess = () => {
        if (request.result?.attempt !== record.attempt) {
          tx.abort();
          return;
        }
        tx.objectStore('tracks').put(blob, segmentKey(record, asset, index));
      };
    });
  }

  function saveVideo(record, track, video, captions) {
    return writeTrack(record, track, { hls: video.playlist, count: video.count }, video.size, captions);
  }

  async function save(record, track, blob, captions) {
    try {
      return await writeTrack(record, track, blob, blob.size, captions);
    } catch (error) {
      // Some WebKit storage modes reject Blob writes but accept byte buffers.
      if (error.name !== 'UnknownError') throw error;
      const data = { bytes: await blob.arrayBuffer(), type: blob.type };
      return writeTrack(record, track, data, blob.size, captions);
    }
  }

  function remove(workno) {
    return transact(['works', 'tracks'], 'readwrite', tx => {
      tx.objectStore('works').delete(workno);
      const tracks = tx.objectStore('tracks');
      tracks.delete(workTrackRange(workno));
      tracks.delete(coverKey(workno));
    });
  }

  /* Raw access used to migrate copies between databases. */
  const trackKeys = workno => transact('tracks', 'readonly', (tx, finish) => {
    const keys = [];
    const store = tx.objectStore('tracks');
    const requests = [store.getAllKeys(workTrackRange(workno)), store.getAllKeys(coverKey(workno))];
    let pending = requests.length;
    for (const request of requests) request.onsuccess = () => { keys.push(...request.result); if (!--pending) finish(keys); };
  });
  const rawTrack = key => read('tracks', key);
  const putRaw = (name, value, key) => transact(name, 'readwrite', tx => { tx.objectStore(name).put(value, key); });
  const close = async () => { if (connection) (await connection.catch(() => null))?.close(); connection = undefined; };

  return {
    start, save, saveSegment, saveVideo, saveCover, remove, trackKeys, rawTrack, putRaw, close,
    // Returns the saved HLS playlist text with "#DLOOK-SEGMENT:<n>" markers and its segment blobs.
    async video(work, asset) {
      const [entry, segments] = await Promise.all([
        read('tracks', [work.workno, work.revision, asset]),
        transact('tracks', 'readonly', (tx, finish) => {
          const request = tx.objectStore('tracks').getAll(segmentRange(work, asset));
          request.onsuccess = () => finish(request.result);
        }),
      ]);
      if (typeof entry?.hls !== 'string' || segments?.length !== entry.count) return null;
      return {
        playlist: entry.hls,
        segments: segments.map(data => data?.bytes instanceof ArrayBuffer ? new Blob([data.bytes], { type: data.type }) : data),
      };
    },
    list: () => read('works'),
    work: workno => read('works', workno),
    cover: workno => read('tracks', coverKey(workno)),
    captions: (work, asset) => read('tracks', captionKey(work, asset)),
    async track(work, asset) {
      const data = await read('tracks', [work.workno, work.revision, asset]);
      return data?.bytes instanceof ArrayBuffer ? new Blob([data.bytes], { type: data.type }) : data;
    },
  };
}
