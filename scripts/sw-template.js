/* Generated as sw.js. Only complete, hash-verified builds are activated. */
const MANIFEST = /* MANIFEST */ null;
const BASE = self.registration.scope;
const PREFIX = `wos-offline:${new URL(BASE).pathname}:`;
const CACHE = PREFIX + MANIFEST.id;
const MARKER = new URL('__offline_complete__', BASE).href;
const byURL = new Map(MANIFEST.files.map(f => [new URL(f.url, BASE).href, f]));
let progress = { type: 'WOS_PROGRESS', pct: 0, completed: 0, total: MANIFEST.files.length, bytes: 0, totalBytes: MANIFEST.totalBytes };

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(message));
}

async function install() {
  const cache = await caches.open(CACHE);
  if (await cache.match(MARKER)) return;

  let index = 0;
  let stopped = false;
  let stopReason = null;               // <-- the FIRST real failure, preserved
  const controllers = new Set();

  const nextFile = () => (index < MANIFEST.files.length ? MANIFEST.files[index++] : null);

  async function downloadFile(file) {
    const url = new URL(file.url, BASE).href;

    // Resume: reuse a file a previous partial run already verified.
    if (await cache.match(url)) return;

    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (stopped) throw stopReason || new Error('Download was cancelled.');
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt - 1)));
        if (stopped) throw stopReason || new Error('Download was cancelled.');
      }

      const ctrl = new AbortController();
      controllers.add(ctrl);

      // Timeout scales with file size. 90s floor; +1s per 64KB.
      const timeoutMs = Math.max(90_000, Math.ceil((file.bytes || 0) / 65536) * 1000);
      let timedOut = false;
      const abortReason = new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s downloading ${file.url}`);
      abortReason.name = 'WOSTimeoutError';
      const timer = setTimeout(() => { timedOut = true; ctrl.abort(abortReason); }, timeoutMs);

      try {
        const response = await fetch(url, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: ctrl.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}${response.statusText ? ' ' + response.statusText : ''} for ${file.url}`);
        }
        if (!response.url.startsWith(BASE)) {
          throw new Error(`File ${file.url} redirected outside the app scope (to ${response.url})`);
        }

        const buffer = await response.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== file.hash) {
          throw new Error(`Build changed while downloading ${file.url}`);
        }

        const headers = new Headers(response.headers);
        headers.delete('content-encoding');
        headers.delete('content-length');

        await cache.put(url, new Response(buffer, { status: 200, headers }));
        return;
      } catch (error) {
        lastError = error;

        // Visible in DevTools when you Inspect the running service worker.
        const kind = timedOut ? 'TIMEOUT' : ((error && error.name) || 'Error');
        const msg = error && error.message ? error.message : String(error);
        console.warn(`[WOS offline] attempt ${attempt + 1}/3 ${kind}: ${msg}`);

        // Deterministic failures — retrying the same URL will not help.
        if (error && /Build changed|HTTP 40[34]|redirected outside the app scope/.test(error.message)) break;
      } finally {
        clearTimeout(timer);
        controllers.delete(ctrl);
      }
    }

    throw lastError || new Error(`Failed to download ${file.url}`);
  }

  async function worker() {
    while (!stopped) {
      const file = nextFile();
      if (!file) return;

      try {
        await downloadFile(file);
      } catch (error) {
        if (!stopped) {
          stopped = true;
          stopReason = error;           // <-- record the ROOT cause
          const reason = new Error('Aborted: another file failed.');
          reason.name = 'WOSAbortError';
          controllers.forEach(c => { try { c.abort(reason); } catch {} });
        }
        throw error;
      }

      progress.completed++;
      progress.bytes += file.bytes || 0;
      progress.pct = Math.floor(progress.completed / progress.total * 100);
      progress.file = file.url;
      await broadcast(progress);
    }
  }

  const results = await Promise.allSettled([worker(), worker(), worker(), worker()]);
  const failure = results.find(r => r.status === 'rejected');
  if (failure) {
    // Report the root cause, NOT whichever sibling got aborted first.
    const reason = stopReason || failure.reason;
    const message = reason && reason.message ? reason.message : String(reason);
    await broadcast({ type: 'WOS_ERROR', message });
    throw reason;
  }

  await cache.put(MARKER, new Response(JSON.stringify({ id: MANIFEST.id, release: MANIFEST.release })));
}

self.addEventListener('install', e => e.waitUntil(install()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = (await caches.keys()).filter(k => k.startsWith(PREFIX) && k !== CACHE);
  const complete = [];
  for (const key of keys) {
    const cache = await caches.open(key);
    if (await cache.match(MARKER)) complete.push(key);
    else await caches.delete(key);
  }
  for (const key of complete.slice(0, -1)) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('message', e => {
  if (e.data?.type === 'WOS_STATUS') e.source?.postMessage(progress);
  if (e.data?.type === 'WOS_ACTIVATE') e.waitUntil(self.skipWaiting());
  if (e.data?.type === 'WOS_VERSION') e.ports[0]?.postMessage(MANIFEST.release);
});

self.addEventListener('fetch', e => {
  const request = e.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== new URL(BASE).origin || !url.href.startsWith(BASE)) return;
  const relative = url.pathname.slice(new URL(BASE).pathname.length);
  if (relative === 'updates/feed.json' || relative === 'sw.js' || relative === 'offline-manifest.json') return;
  url.search = ''; url.hash = '';
  let key = url.href;
  if (key === BASE) key = new URL('index.html', BASE).href;
  if (key.endsWith('/') && byURL.has(key + 'index.html')) key += 'index.html';
  if (!byURL.has(key) && byURL.has(key + '.html')) key += '.html';
  if (!byURL.has(key) && byURL.has(key + '/index.html')) key += '/index.html';
  if (!byURL.has(key) && !relative.startsWith('assets/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key);
    if (hit) return hit;
    if (relative.startsWith('assets/')) {
      for (const name of await caches.keys()) {
        if (!name.startsWith(PREFIX)) continue;
        const old = await (await caches.open(name)).match(key);
        if (old) return old;
      }
    }
    return fetch(request);
  })());
});
