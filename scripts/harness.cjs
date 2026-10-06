/*
 * Copyright 2026 bittuhere
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Shared jsdom harness.
 * Boots the production bundle inside a real vm context with an in-memory
 * IndexedDB, so the Virtual Storage path actually executes headlessly.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { JSDOM, VirtualConsole } = require("jsdom");

/* ------------------------- in-memory IndexedDB ------------------------- */

function makeIDB() {
  const dbs = new Map();
  const req = () => ({
    result: undefined,
    error: null,
    readyState: "pending",
    onsuccess: null,
    onerror: null,
  });
  const ok = (r, v) => {
    r.result = v;
    r.readyState = "done";
    setTimeout(() => r.onsuccess && r.onsuccess({ target: r }), 0);
  };

  class ObjectStore {
    constructor(name, def, data) {
      this.name = name;
      this.keyPath = def?.keyPath ?? null;
      this._data = data;
    }
    _k(rec) {
      return this.keyPath ? rec?.[this.keyPath] : rec?.key;
    }
    put(rec) {
      const r = req();
      const k = this._k(rec);
      this._data.set(k, rec);
      setTimeout(() => ok(r, k), 0);
      return r;
    }
    add(rec) {
      return this.put(rec);
    }
    get(key) {
      const r = req();
      setTimeout(() => ok(r, this._data.get(key)), 0);
      return r;
    }
    getAll() {
      const r = req();
      setTimeout(() => ok(r, [...this._data.values()]), 0);
      return r;
    }
    delete(key) {
      const r = req();
      this._data.delete(key);
      setTimeout(() => ok(r), 0);
      return r;
    }
    clear() {
      const r = req();
      this._data.clear();
      setTimeout(() => ok(r), 0);
      return r;
    }
    count() {
      const r = req();
      setTimeout(() => ok(r, this._data.size), 0);
      return r;
    }
    openCursor() {
      const r = req();
      setTimeout(() => ok(r, null), 0);
      return r;
    }
  }

  class Tx {
    constructor(db, names, mode) {
      this._db = db;
      this._names = names;
      this.mode = mode;
      setTimeout(() => this.oncomplete && this.oncomplete({ target: this }), 1);
    }
    objectStore(n) {
      if (!this._names.includes(n)) throw new Error(`store ${n} is not in this transaction`);
      return this._db._store(n);
    }
  }

  class DB {
    constructor(name, version, defs) {
      this.name = name;
      this.version = version;
      this._defs = defs;
      this._stores = new Map();
      this._sync();
      Object.keys(defs).forEach((n) => this._stores.set(n, new Map()));
    }
    _sync() {
      const names = Object.keys(this._defs);
      this.objectStoreNames = {
        contains: (n) => names.includes(n),
        length: names.length,
        item: (i) => names[i] ?? null,
        [Symbol.iterator]: () => names[Symbol.iterator](),
      };
    }
    _store(n) {
      if (!this._stores.has(n)) this._stores.set(n, new Map());
      return new ObjectStore(n, this._defs[n] || {}, this._stores.get(n));
    }
    createObjectStore(n, def) {
      this._defs[n] = def || {};
      this._sync();
      if (!this._stores.has(n)) this._stores.set(n, new Map());
      return this._store(n);
    }
    transaction(names, mode) {
      return new Tx(this, Array.isArray(names) ? names : [names], mode || "readonly");
    }
    close() {}
  }

  const DEFS = {
    kv: { keyPath: "key" },
    files: { keyPath: "path" },
    notes: { keyPath: "id" },
    todos: { keyPath: "id" },
    events: { keyPath: "id" },
    mail: { keyPath: "id" },
    contacts: { keyPath: "id" },
    photos: { keyPath: "id" },
    installed: { keyPath: "icon" },
    history: { keyPath: "id" },
    alarms: { keyPath: "id" },
    recordings: { keyPath: "id" },
    notepad: { keyPath: "id" },
    recycle: { keyPath: "id" },
  };

  return {
    open(name, version) {
      const r = req();
      setTimeout(() => {
        let db = dbs.get(name);
        const fresh = !db;
        if (!db) {
          db = new DB(name, version, { ...DEFS });
          dbs.set(name, db);
        }
        r.result = db;
        r.readyState = "done";
        if (fresh && r.onupgradeneeded)
          r.onupgradeneeded({ target: r, oldVersion: 0, newVersion: version });
        r.onsuccess && r.onsuccess({ target: r });
      }, 0);
      return r;
    },
    deleteDatabase(name) {
      const r = req();
      dbs.delete(name);
      setTimeout(() => ok(r), 0);
      return r;
    },
    _dbs: dbs,
  };
}

/* ------------------------------ the DOM ------------------------------- */

function makeDom(errors, preload) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    const m = String(e.stack || e.message);
    // widget panel + workbox fire real requests at boot; not our business
    if (/xhr-utils|AggregateError|Could not load|Not implemented|post-message|MessageEvent/.test(m))
      return;
    errors.push("[jsdomError] " + m);
  });
  vc.on("error", (...a) => errors.push("[console.error] " + a.map(String).join(" ")));
  vc.on("warn", (...a) => {
    const s = a.map(String).join(" ");
    if (/failed: smoke test blocks network/.test(s)) return; // honest offline degradation, by design
    if (!/Could not parse CSS|Not implemented/.test(s)) errors.push("[console.warn] " + s);
  });

  const dom = new JSDOM(
    `<!doctype html><html><body><span id="root"></span><span id="brightoverlay"></span></body></html>`,
    {
      runScripts: "outside-only",
      pretendToBeVisual: true,
      url: "http://localhost/",
      virtualConsole: vc,
    },
  );
  const { window } = dom;
  const supports = window.DOMTokenList.prototype.supports;
  window.DOMTokenList.prototype.supports = function(token) {
    return token === "modulepreload" || supports.call(this, token);
  };


  // Execute real local classic scripts and acknowledge stylesheet loads.
  // jsdom cannot fetch production chunks itself; the ESM linker below handles JS modules.
  const append = window.Node.prototype.appendChild;
  window.Node.prototype.appendChild = function(node) {
    const result = append.call(this, node);
    if (node.tagName === "LINK" && node.rel === "stylesheet") {
      setTimeout(() => node.dispatchEvent(new window.Event("load")), 0);
    } else if (node.tagName === "SCRIPT" && node.src) {
      setTimeout(() => {
        try {
          const url = new URL(node.src, "http://localhost/");
          if (url.origin !== "http://localhost") throw new Error("harness blocks remote scripts");
          const file = path.join(globalThis.__WOS_BUILD_DIR__, decodeURIComponent(url.pathname));
          if (window.__runLocalScript) window.__runLocalScript(fs.readFileSync(file, "utf8"));
          else window.eval(fs.readFileSync(file, "utf8"));
          node.dispatchEvent(new window.Event("load"));
        } catch (error) { node.dispatchEvent(new window.Event("error")); }
      }, 0);
    }
    return result;
  };


  // jsdom ships neither TextEncoder nor a subtle-crypto implementation
  const { TextEncoder, TextDecoder } = require("util");
  const nodeCrypto = require("crypto");
  if (!window.TextEncoder) window.TextEncoder = TextEncoder;
  if (!window.TextDecoder) window.TextDecoder = TextDecoder;
  if (!window.crypto?.subtle) {
    Object.defineProperty(window, "crypto", {
      value: {
        subtle: {
          digest: async (alg, data) => {
            const name = String(alg).replace("-", "").toLowerCase();
            return nodeCrypto
              .createHash(name === "sha256" ? "sha256" : name)
              .update(Buffer.from(data))
              .digest().buffer;
          },
        },
        getRandomValues: (arr) => nodeCrypto.randomFillSync(arr),
        randomUUID: () => nodeCrypto.randomUUID(),
      },
      configurable: true,
    });
  }

  // build/index.html loads dycalendar.js as a classic script; jsdom does not
  // run it here, so stub the one API the taskbar calendar widget calls
  window.dycalendar = { draw: () => {} };

  window.indexedDB = makeIDB();
  // `preload` lets a test re-use a previous run's storage to simulate a reload
  if (preload) preload(window);
  window.IDBKeyRange = { bound: () => ({}) };
  window.matchMedia =
    window.matchMedia ||
    ((q) => {
      /* jsdom answers a fixed "true" for every query, which made the landscape
         gate believe a phone was permanently in portrait. Report the CURRENT
         size instead, so a resize is a real signal. */
      const portrait = () => window.innerHeight >= window.innerWidth;
      const answer = () => {
        if (/orientation:\s*portrait/i.test(q)) return portrait();
        if (/orientation:\s*landscape/i.test(q)) return !portrait();
        return !/dark/i.test(q);
      };
      return {
        get matches() {
          return answer();
        },
        media: q,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      };
    });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.IntersectionObserver =
    window.IntersectionObserver ||
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  // react-lazy-load-image-component probes IntersectionObserverEntry.prototype —
  // jsdom never defines the entry class, so give it a stand-in.
  window.IntersectionObserverEntry = window.IntersectionObserverEntry || class {};
  window.requestIdleCallback = (cb) =>
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 20 }), 1);
  window.cancelIdleCallback = (id) => clearTimeout(id);
  window.navigator.serviceWorker = {
    ready: Promise.resolve({}),
    register: () => Promise.resolve({}),
    addEventListener() {},
  };
  Object.defineProperty(window.navigator, "storage", {
    value: { estimate: () => Promise.resolve({ usage: 1234567, quota: 60000000 }) },
    configurable: true,
  });
  // media devices: the Camera app must handle a hard "no camera" gracefully
  Object.defineProperty(window.navigator, "mediaDevices", {
    value: {
      getUserMedia: () =>
        Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })),
    },
    configurable: true,
  });

  const ctx2d = () => {
    const noop = () => {};
    return new Proxy(
      {
        measureText: () => ({ width: 10 }),
        getImageData: (x, y, w, h) => ({
          data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)),
          width: w,
          height: h,
        }),
        createImageData: (w, h) => ({
          data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)),
          width: w,
          height: h,
        }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        createPattern: () => ({}),
        putImageData: noop,
        drawImage: noop,
      },
      { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) },
    );
  };
  window.HTMLCanvasElement.prototype.getContext = ctx2d;
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,iVBORw0KGgo=";
  window.HTMLCanvasElement.prototype.toBlob = function (cb) {
    cb && cb(new window.Blob(["x"], { type: "image/png" }));
  };
  window.Element.prototype.setPointerCapture = function () {};
  window.Element.prototype.releasePointerCapture = function () {};
  window.Element.prototype.scrollIntoView = function () {};
  window.Element.prototype.animate = function () {
    return { cancel() {}, finish() {}, onfinish: null };
  };

  window.addEventListener("error", (e) =>
    errors.push("[window.onerror] " + (e.error?.stack || e.message)),
  );
  window.addEventListener("unhandledrejection", (e) =>
    errors.push("[unhandledrejection] " + (e.reason?.stack || e.reason)),
  );

  return { dom, window };
}

/* ----------------------------- the sandbox ---------------------------- */

function makeSandbox(window, errors) {
  const sandbox = {};
  vm.createContext(sandbox);

  // jsdom's WindowProxy only exposes a subset of globals as own properties,
  // so walk the chain and then force the DOM constructors the app touches.
  const names = new Set();
  for (let o = window; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    Object.getOwnPropertyNames(o).forEach((k) => names.add(k));
  }
  [
    "MutationObserver",
    "IntersectionObserver",
    "DOMParser",
    "XMLSerializer",
    "XMLHttpRequest",
    "WebSocket",
    "Worker",
    "URL",
    "URLSearchParams",
    "AbortController",
    "AbortSignal",
    "Headers",
    "Request",
    "Response",
    "FormData",
    "TextEncoder",
    "TextDecoder",
    "HTMLElement",
    "HTMLCanvasElement",
    "HTMLImageElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLIFrameElement",
    "HTMLVideoElement",
    "HTMLAudioElement",
    "Element",
    "Node",
    "DocumentFragment",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "PointerEvent",
    "TouchEvent",
    "DragEvent",
    "ClipboardEvent",
    "File",
    "FileList",
    "FileReader",
    "Blob",
    "ImageData",
    "Path2D",
    "DOMRect",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "localStorage",
    "sessionStorage",
    "crypto",
    "Image",
    "Audio",
    "Option",
    "MediaRecorder",
    "ClipboardItem",
    "DataTransfer",
    "Range",
    "Selection",
  ].forEach((k) => names.add(k));
  ["window", "self", "globalThis", "top", "parent", "frames"].forEach((k) => names.delete(k));

  // Web Animations API: jsdom has no Element.animate, but the (vendored)
  // solitaire renderer drives card movement through it. A minimal
  // setTimeout-based stand-in keeps the engine honest under the driver.
  try {
    if (window.HTMLElement) {
      // ALWAYS override: a jsdom-native animate (if present) never fires
      // onfinish because nothing renders, which would hang the deal.
      window.HTMLElement.prototype.animate = function (keyframes, options = {}) {
        const anim = {
          onfinish: null,
          oncancel: null,
          cancel() {
            if (this.oncancel) this.oncancel();
          },
          finish() {
            if (this.onfinish) this.onfinish();
          },
        };
        const dur = typeof options === "number" ? options : (options.duration ?? 200); // keep 0ms durations honest
        setTimeout(
          () => {
            if (typeof anim.onfinish === "function") anim.onfinish();
          },
          Math.max(0, dur),
        );
        return anim;
      };
    }
  } catch (e) {}

  for (const k of names) {
    let v;
    try {
      v = window[k];
    } catch (e) {
      continue;
    }
    const OBJECTS_WE_WANT = [
      "document",
      "location",
      "navigator",
      "localStorage",
      "sessionStorage",
      "history",
      "crypto",
      "screen",
    ];
    const fine =
      typeof v === "function" || v === null || typeof v !== "object" || OBJECTS_WE_WANT.includes(k);
    if (!fine) continue;
    try {
      sandbox[k] = v;
    } catch (e) {}
  }

  // postMessage fires a jsdom MessageEvent against the sandbox global, which
  // jsdom cannot wrap — swallow it (workbox/service-worker chatter only)
  sandbox.postMessage = () => {};
  sandbox.BroadcastChannel = class {
    postMessage() {}
    close() {}
    addEventListener() {}
  };
  sandbox.Worker = class {
    postMessage() {}
    terminate() {}
    addEventListener() {}
  };

  ["addEventListener", "removeEventListener", "dispatchEvent"].forEach((m) => {
    sandbox[m] = window[m].bind(window);
  });

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = window.document;
  sandbox.navigator = window.navigator;
  sandbox.console = {
    log: (...a) => {
      if (!process.env.QUIET) console.log("[app]", ...a.map((x) => String(x).slice(0, 200)));
    },
    /* the sandbox blocks the network on purpose — an app saying so is not a bug */
    warn: (...a) => {
      if (!/smoke test blocks network/.test(a.map(String).join(" ")))
        errors.push("[console.warn] " + a.map(String).join(" "));
    },
    error: (...a) =>
      errors.push(
        "[console.error] " +
          a
            .map((x) => (x && x.stack ? x.stack : String(x)))
            .join(" ")
            .slice(0, 2000),
      ),
    info: () => {},
    debug: () => {},
    trace: () => {},
  };
  const guard =
    (fn) =>
    (...a) => {
      try {
        return fn(...a);
      } catch (e) {
        errors.push("[timer] " + (e.stack || e.message));
      }
    };
  sandbox.setTimeout = (fn, ms, ...rest) =>
    setTimeout(
      guard(() => fn(...rest)),
      ms,
    );
  sandbox.clearTimeout = clearTimeout;
  sandbox.setInterval = (fn, ms, ...rest) =>
    setInterval(
      guard(() => fn(...rest)),
      ms,
    );
  sandbox.clearInterval = clearInterval;
  sandbox.requestAnimationFrame = (fn) =>
    setTimeout(
      guard(() => fn(Date.now())),
      16,
    );
  sandbox.cancelAnimationFrame = clearTimeout;
  sandbox.queueMicrotask = (fn) =>
    queueMicrotask(() => {
      try {
        fn();
      } catch (e) {
        errors.push("[microtask] " + (e.stack || e.message));
      }
    });
  sandbox.performance = { now: () => Date.now(), timeOrigin: Date.now() };
  // same-origin asset fetches are served from the build directory (the app
  // may legitimately fetch its own static assets, e.g. the store catalog);
  // everything else (absolute http(s)) stays blocked.
  const path = require("path");
  const fsmod = require("fs");
  sandbox.fetch = (u) => {
    let url = String(u || "");
    /* resolve same-origin relative paths the way a browser would, so
       "storeCatalog.json" and "/storeCatalog.json" are the same request */
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("//")) {
      url = "/" + url.replace(/^\.?\/+/, "");
    }
    const root = globalThis.__WOS_BUILD_DIR__;
    // Only the Store catalog is served from disk. Every other same-origin
    // request (webos-proxy, bing-suggest, ...) must keep rejecting exactly
    // like the old smoke harness — resolving them changed fallback paths.
    if (root && (url === "/storeCatalog.json" || url.startsWith("/bitbot/"))) {
      const file = path.join(root, url.replace(/[?#].*$/, "").replace(/\//g, path.sep));
      try {
        const body = fsmod.readFileSync(file);
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => body.toString("utf8"),
          json: async () => JSON.parse(body.toString("utf8")),
        });
      } catch (e) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => "",
          json: async () => {
            throw new Error("404: " + url);
          },
        });
      }
    }
    return Promise.reject(new Error("smoke test blocks network: " + u));
  };
  sandbox.getComputedStyle = window.getComputedStyle.bind(window);
  sandbox.matchMedia = window.matchMedia;
  sandbox.ResizeObserver = window.ResizeObserver;
  sandbox.indexedDB = window.indexedDB;
  sandbox.dycalendar = window.dycalendar;
  sandbox.TextEncoder = window.TextEncoder;
  sandbox.TextDecoder = window.TextDecoder;
  sandbox.crypto = window.crypto;
  sandbox.localStorage = window.localStorage;
  sandbox.sessionStorage = window.sessionStorage;
  sandbox.history = window.history;
  sandbox.location = window.location;
  sandbox.screen = window.screen;

  /* Viewport + media queries. jsdom has no layout, so the app's viewport IS
     the sandbox's innerWidth/innerHeight (the driver sets them when it turns
     the machine into a phone). jsdom's own matchMedia cannot see them, so
     answer the queries the OS asks from the sandbox's numbers. */
  sandbox.innerWidth = window.innerWidth || 1024;
  sandbox.innerHeight = window.innerHeight || 768;
  sandbox.matchMedia = (q) => {
    const portrait = () => (sandbox.innerHeight || 0) >= (sandbox.innerWidth || 0);
    const answer = () => {
      if (/orientation:\s*portrait/i.test(q)) return portrait();
      if (/orientation:\s*landscape/i.test(q)) return !portrait();
      if (/dark/i.test(q)) return false;
      if (/coarse/i.test(q)) return (sandbox.navigator?.maxTouchPoints || 0) > 0;
      return true;
    };
    return {
      get matches() {
        return answer();
      },
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    };
  };

  return sandbox;
}

/* ------------------------------- boot -------------------------------- */

function boot(buildDir, errors, preload) {
  globalThis.__WOS_BUILD_DIR__ = buildDir;
  const html = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
  const bundleName = (html.match(/assets\/(index\.[^"]+\.js)/) || [])[1];
  if (!bundleName) throw new Error("could not find the bundle name in index.html");
  const bundle = fs.readFileSync(path.join(buildDir, "assets", bundleName), "utf8");
  const { window } = makeDom(errors, preload);
  const sandbox = makeSandbox(window, errors);
  window.__runLocalScript = code => vm.runInContext(code, sandbox);
  return { window, sandbox, bundle, bundleName };
}

async function evaluate({ sandbox, bundle, bundleName }, errors) {
  const modules = new Map();
  const assets = path.join(globalThis.__WOS_BUILD_DIR__, "assets");
  function getModule(name) {
    name = path.basename(name);
    if (modules.has(name)) return modules.get(name);
    const mod = new vm.SourceTextModule(fs.readFileSync(path.join(assets, name), "utf8"), {
      context: sandbox, identifier: name,
      initializeImportMeta(meta) { meta.url = "http://localhost/assets/" + name; },
      importModuleDynamically: async spec => {
        const child = getModule(spec);
        if (child.status === "unlinked") await child.link(spec => getModule(spec));
        if (child.status === "linked") await child.evaluate();
        return child;
      },
    });
    modules.set(name, mod);
    return mod;
  }
  try {
    const mod = getModule(bundleName);
    await mod.link(spec => getModule(spec));
    await mod.evaluate();
  } catch (e) { errors.push("[bundle threw] " + (e.stack || e.message)); }
}

module.exports = { boot, evaluate, makeDom, makeSandbox, makeIDB };
