// Load trusted local classic scripts without eval/Function or a relaxed CSP.
const pending = new Map();
export function loadLocalScript(path) {
  const url = new URL(path, document.baseURI);
  if (url.origin !== location.origin) return Promise.reject(new Error("Local scripts only"));
  if (pending.has(url.href)) return pending.get(url.href);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => finish(new Error(`Timed out loading ${path}`)), 60000);
    function finish(error) {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); pending.delete(url.href); reject(error); }
      else resolve();
    }
    script.src = url.href;
    script.async = false;
    script.onload = () => finish();
    script.onerror = () => finish(new Error(`Could not load ${path}. Retry when connected.`));
    document.head.appendChild(script);
  });
  pending.set(url.href, promise);
  return promise;
}
