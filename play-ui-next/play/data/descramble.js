// Restores DLsite Play "crypt" images. Protected pages are served as 128px tiles shuffled
// with a Mersenne Twister seeded from the optimized file name (the same scheme the official
// viewer undoes on a canvas). Decoded pages become object URLs, cached for the session.

class MersenneTwister {
  constructor(seed) {
    this.mt = new Array(624);
    this.mt[0] = seed >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = ((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0xffff) * 1812433253 + this.mti;
      this.mt[this.mti] >>>= 0;
    }
  }
  int() {
    const mag = [0, 0x9908b0df];
    let y;
    if (this.mti >= 624) {
      let k = 0;
      for (; k < 227; k++) { y = (this.mt[k] & 0x80000000) | (this.mt[k + 1] & 0x7fffffff); this.mt[k] = this.mt[k + 397] ^ (y >>> 1) ^ mag[y & 1]; }
      for (; k < 623; k++) { y = (this.mt[k] & 0x80000000) | (this.mt[k + 1] & 0x7fffffff); this.mt[k] = this.mt[k - 227] ^ (y >>> 1) ^ mag[y & 1]; }
      y = (this.mt[623] & 0x80000000) | (this.mt[0] & 0x7fffffff);
      this.mt[623] = this.mt[396] ^ (y >>> 1) ^ mag[y & 1];
      this.mti = 0;
    }
    y = this.mt[this.mti++];
    y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18;
    return y >>> 0;
  }
  random() { return this.int() / 4294967296; }
}

const TILE = 128;

/** Tile moves for a page: [{ sx, sy, dx, dy }] plus the grid size. */
export function tiles({ name, width, height }) {
  const grid = { w: Math.ceil(width / TILE), h: Math.ceil(height / TILE) };
  const order = [...Array(grid.w * grid.h).keys()];
  const rng = new MersenneTwister(parseInt(String(name).substring(5, 12), 16));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const col = (n) => n % grid.w, row = (n) => Math.floor(n / grid.w);
  return { grid, moves: order.map((to, from) => ({ sx: TILE * col(from), sy: TILE * row(from), dx: TILE * col(to), dy: TILE * row(to) })) };
}

const cache = new Map();   // src -> Promise<objectURL>

async function decode(page, credentials) {
  const response = await fetch(page.src, { credentials, cache: 'force-cache' });
  if (!response.ok) throw Object.assign(new Error('page'), { status: response.status });
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d');
    const { grid, moves } = tiles(page);
    const padW = bitmap.width - page.width, padH = bitmap.height - page.height;
    for (const m of moves) {
      const w = m.dx + TILE === TILE * grid.w ? TILE - padW : TILE;
      const h = m.dy + TILE === TILE * grid.h ? TILE - padH : TILE;
      ctx.drawImage(bitmap, m.sx, m.sy, w, h, m.dx, m.dy, w, h);
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/webp', 0.95));
    canvas.width = canvas.height = 0;
    return URL.createObjectURL(blob);
  } finally {
    bitmap.close();
  }
}

/** An object URL for a crypt page (decoded once per session). */
export function pageUrl(page, credentials = 'include') {
  if (!cache.has(page.src)) {
    const task = decode(page, credentials);
    cache.set(page.src, task);
    task.catch(() => cache.delete(page.src));
  }
  return cache.get(page.src);
}
