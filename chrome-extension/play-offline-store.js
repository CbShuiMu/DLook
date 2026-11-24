const DLookOfflineStore = (() => {
  let connection;

  function open() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open('dlook-offline-audio', 1);
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

  function start({ workno, title, creator }, revision, tracks) {
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
            else {
              audio.delete([workno, revision, track.asset]);
              audio.delete(captionKey(previous, track.asset));
            }
          }
        } else if (previous) {
          audio.delete(workTrackRange(workno));
        }
        const record = {
          workno, title, creator: creator || previous?.creator,
          hasCover: Boolean(previous?.hasCover), revision, attempt, total: tracks.length, tracks: saved,
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

  return {
    start, save, saveCover, remove,
    list: () => read('works'),
    work: workno => read('works', workno),
    cover: workno => read('tracks', coverKey(workno)),
    captions: (work, asset) => read('tracks', captionKey(work, asset)),
    async track(work, asset) {
      const data = await read('tracks', [work.workno, work.revision, asset]);
      return data?.bytes instanceof ArrayBuffer ? new Blob([data.bytes], { type: data.type }) : data;
    },
  };
})();
