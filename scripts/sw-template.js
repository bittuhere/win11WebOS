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
  let index = 0, stopped = false;
  const controllers = new Set();
  const worker = async () => {
    while (!stopped && index < MANIFEST.files.length) {
      const file = MANIFEST.files[index++];
      const url = new URL(file.url, BASE).href;
      let response = await cache.match(url);
      if (!response) {
        let lastError;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (stopped) break;
          const ctrl = new AbortController();
          controllers.add(ctrl);
          const timer = setTimeout(() => ctrl.abort(), 90000);
          try {
            response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: ctrl.signal });
            // Pages canonicalizes index.html -> / and foo.html -> /foo.
            // Accept only in-scope same-origin destinations; SHA-256 below still
            // rejects SPA fallbacks, mixed deploys and transformed/foreign content.
            if (!response.ok || !response.url.startsWith(BASE)) throw new Error(`Unexpected response ${response.status}: ${file.url}`);
            const buffer = await response.clone().arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', buffer);
            const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
            if (hash !== file.hash) throw new Error(`Build changed during download: ${file.url}`);
            const headers = new Headers(response.headers);
            headers.delete('content-encoding');
            headers.delete('content-length');
            // Strip the redirected flag: cached navigation responses must also
            // work with the browser's redirect=manual navigation requests.
            await cache.put(url, new Response(buffer, {status: 200, headers}));
            lastError = null;
            break;
          } catch (error) { lastError = error; }
          finally { clearTimeout(timer); controllers.delete(ctrl); }
        }
        if (lastError) { stopped = true; controllers.forEach(ctrl => ctrl.abort()); throw lastError; }
      }
      progress.completed++;
      progress.bytes += file.bytes;
      // File-count progress is honest even with compression; bytes are the verified payload size.
      progress.pct = Math.floor(progress.completed / progress.total * 100);
      progress.file = file.url;
      await broadcast(progress);
    }
  };
  const results = await Promise.allSettled(Array.from({length: 4}, worker));
  const failure = results.find(r => r.status === 'rejected');
  if (failure) {
    await broadcast({ type: 'WOS_ERROR', message: String(failure.reason?.message || failure.reason) });
    throw failure.reason; // Partial cache is resumable, NEVER active.
  }
  await cache.put(MARKER, new Response(JSON.stringify({ id: MANIFEST.id, release: MANIFEST.release })));
}
self.addEventListener('install', e => e.waitUntil(install()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  // Keep the previous complete build for old tabs; do not delete other apps' caches.
  // Old hashed chunks remain resolvable until the next release cleanup.
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
  // NEVER cache, fall back to, or intercept update discovery.
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
    // Only immutable hashed assets can come from the prior complete build.
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
