// Initial installation is essential boot work. Update discovery is NOT run here.
export function workerVersion(worker) {
  return new Promise(resolve => {
    if (!worker) return resolve(null);
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 1800);
    channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); resolve(e.data); };
    worker.postMessage({ type: 'WOS_VERSION' }, [channel.port2]);
  });
}
export function waitForInstall(reg, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    let worker;
    const timeout = setTimeout(() => finish(new Error('Download timed out. Reconnect and retry.')), 15 * 60000);
    const message = e => {
      if (e.source !== worker) return;
      if (e.data?.type === 'WOS_PROGRESS') onProgress(e.data);
      if (e.data?.type === 'WOS_ERROR') finish(new Error(e.data.message));
    };
    function finish(error, result) {
      clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('message', message);
      reg.removeEventListener('updatefound', attach);
      worker?.removeEventListener('statechange', check);
      error ? reject(error) : resolve(result);
    }
    function check() {
      if (worker?.state === 'redundant') finish(new Error('Installation failed. The previous build is safe; retry the download.'));
      else if (worker?.state === 'installed' || worker?.state === 'activated') finish(null, worker);
    }
    function attach() {
      worker?.removeEventListener('statechange', check);
      worker = reg.installing || reg.waiting;
      if (!worker) return finish(null, reg.active);
      worker.addEventListener('statechange', check);
      worker.postMessage({type: 'WOS_STATUS'});
      check();
    }
    navigator.serviceWorker.addEventListener('message', message);
    reg.addEventListener('updatefound', attach);
    attach();
  });
}
export async function activateWorker(worker) {
  if (!worker || worker.state === 'activated') return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Activation timed out. Close other WebOS tabs and retry.')), 20000);
    function finish(error) {
      clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      error ? reject(error) : resolve();
    }
    function check() {
      if (worker.state === 'activated') finish();
      if (worker.state === 'redundant') finish(new Error('The new worker could not activate.'));
    }
    worker.addEventListener('statechange', check);
    worker.postMessage({type: 'WOS_ACTIVATE'});
    check();
  });
}
export async function prepareOffline() {
  if (import.meta.env.DEV) return;
  // jsdom unit harness has no service worker; browser support is tested separately.
  if (/jsdom/i.test(navigator.userAgent)) return;
  const root = document.getElementById('root');
  root.innerHTML = `<section class="offlineBoot" data-state="loading" aria-labelledby="offline-title"><div class="offlineCard">
    <div class="offlineLogo" aria-hidden="true">${__WOS_BRAND_SVG__}</div><p class="offlineEyebrow">WIN11 WEBOS BY BITTUHERE</p>
    <h1 id="offline-title">Preparing your offline desktop</h1><p>Downloading local apps, photos, fonts and BitBot. Keep this tab open. This only needs to finish once per installed build.</p>
    <div class="offlineStatus"><span class="offlineSpinner" aria-hidden="true"></span><strong id="offline-pct">Starting…</strong></div>
    <progress id="offline-progress" aria-label="Files saved for offline use" max="100" value="0"></progress>
    <p id="offline-detail" role="status" aria-live="polite">Checking browser storage…</p>
    <div id="offline-actions" hidden><button id="offline-retry">Retry download</button><button id="offline-online">Continue online only</button></div>
    <p class="offlineFine">Online websites, weather and update checks still need the internet. Browser storage can be cleared or evicted.</p>
    <a href="about/">About this open-source project</a></div></section>`;
  const detail = document.getElementById('offline-detail');
  const pct = document.getElementById('offline-pct');
  async function attempt() {
    if (!window.isSecureContext || !navigator.serviceWorker || !window.caches || window.__wosStorageDegraded) {
      throw new Error('Offline storage is unavailable here. Use HTTPS in a normal browser tab, or continue without offline support.');
    }
    const url = new URL('sw.js', document.baseURI);
    const scope = new URL('./', url).href;
    let reg = await navigator.serviceWorker.getRegistration(scope);
    if (reg?.scope !== scope) reg = null;
    if (reg?.active && await workerVersion(reg.active)) return; // no register/update call on ordinary boots
    if (!reg) reg = await navigator.serviceWorker.register(url, {scope, updateViaCache: 'none'});
    else await reg.update(); // one-time migration from legacy Workbox only
    const worker = await waitForInstall(reg, p => {
      pct.textContent = `${p.pct}%`;
      document.getElementById('offline-progress').value = p.pct;
      detail.textContent = `${p.completed} / ${p.total} files saved · ${(p.bytes / 1048576).toFixed(1)} / ${(p.totalBytes / 1048576).toFixed(1)} MiB`;
    });
    if (!await workerVersion(worker)) throw new Error('Offline worker is not ready. Retry installation.');
    await activateWorker(worker);
  }
  return new Promise(resolve => {
    async function run() {
      root.querySelector('.offlineBoot').dataset.state = 'loading';
      document.getElementById('offline-actions').hidden = true;
      try { await attempt(); root.innerHTML = ''; resolve(); }
      catch (error) {
        root.querySelector('.offlineBoot').dataset.state = 'error';
        pct.textContent = 'Download incomplete';
        detail.textContent = error.name === 'QuotaExceededError' ? 'Not enough browser storage. Free space and retry, or continue online only.' : error.message;
        document.getElementById('offline-actions').hidden = false;
      }
    }
    document.getElementById('offline-retry').onclick = run;
    document.getElementById('offline-online').onclick = () => { window.__wosOfflineSkipped = true; root.innerHTML = ''; resolve(); };
    run();
  });
}
