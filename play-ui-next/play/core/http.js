// Same-origin requests to DLsite Play, using the site's own session and CSRF token.

// The dev harness (dev/server.mjs) serves mock Play/CDN endpoints from its own origin.
const dev = Boolean(globalThis.__DLOOK_DEV__);
export const PLAY = dev ? location.origin : 'https://play.dlsite.com';
export const CDN = dev ? `${location.origin}/cdn` : 'https://play.dl.dlsite.com';
// DLsite store (www.dlsite.com): its product API allows play.dlsite.com as a CORS origin.
export const STORE = dev ? `${location.origin}/store` : 'https://www.dlsite.com';
export const WORKNO = /^(?:RJ|VJ|BJ)\d{6,10}$/;

export function csrfHeaders() {
  const headers = new Headers();
  const token = /(?:^|;\s*)XSRF-TOKEN=([^;]+)/.exec(document.cookie)?.[1];
  if (token) {
    try { headers.set('X-XSRF-TOKEN', decodeURIComponent(token)); } catch {}
  }
  return headers;
}

export class HttpError extends Error {
  constructor(status, phase, cause) {
    super(`DLsite Play request failed (${status ?? 'network'})`, { cause });
    this.status = status;
    this.phase = phase;
  }
}

/** JSON request against play.dlsite.com. `body` is serialized when given. */
export async function api(path, { method = 'GET', body, params, signal, timeout = 15000, noCache = false, keepalive = false } = {}) {
  const url = new URL(path, location.origin);
  if (params) for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);
  const headers = csrfHeaders();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (noCache) {
    headers.set('Cache-Control', 'no-cache');
    headers.set('Pragma', 'no-cache');
  }
  let response;
  try {
    response = await fetch(url, {
      method, headers, credentials: 'same-origin', redirect: 'error', keepalive,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ?? (timeout ? AbortSignal.timeout(timeout) : undefined),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new HttpError(undefined, 'network', error);
  }
  if (!response.ok) throw new HttpError(response.status, 'http');
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') ?? '';
  return type.includes('json') ? response.json() : response.text();
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Runs `work` over `items` with at most `limit` concurrent calls. */
export async function pool(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
