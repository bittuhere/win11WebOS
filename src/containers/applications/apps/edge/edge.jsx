// Copyright 2026 bittuhere (anurag670singh@gmail.com)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../../../utils/general";
import { idb, uid } from "../../../../utils/idb";
import * as vs from "../../../../utils/os/vs";
import {
  aiChat,
  bridgeFetch,
  bridgeReady,
  checkBridge,
  startBridge,
  verifyBridge,
} from "../../../../utils/os/bridge";
import { notify, wosConfirm, wosPrompt } from "../../../../utils/os/ui";
import { WosFlyout } from "../../../../components/shared/Controls";
import {
  DEFAULT_FAVORITES,
  ENGINES,
  GOOGLE,
  HOME,
  INTERNAL,
  bingSuggest,
  classifyInput,
  displayUrl,
  favicon,
  absolutizeHtml,
  frameErrorText,
  hostOf,
  isInternal,
  isFrameable,
  isSecure,
  toReadableHtml,
  ytEmbed,
} from "./edgeNav";
import {
  DownloadsPage,
  EdgeGlyph,
  ErrorPage,
  FavoritesPage,
  HistoryPage,
  NewTabPage,
  ReaderPage,
  SettingsPage,
  SnapshotPage,
} from "./EdgeInternal";
import "./edge.scss";

/* ================================================================== *
 *  Tab model
 * ================================================================== */

const SETTINGS_KEY = "edge.settings";
const FAVS_KEY = "edge.favs";

const defaultSettings = {
  home: HOME,
  openNewTab: true,
  engine: "google",
  suggest: true,
  showFavBar: true,
  showSidebar: false,
  followTheme: true,
  tracking: "balanced",
  ntpWall: "bloom",
};

function newTab(url) {
  const entry = {
    url: url || HOME,
    title:
      url && !isInternal(url)
        ? hostOf(url)
        : INTERNAL[String(url || HOME).toLowerCase()] || "New tab",
    at: Date.now(),
  };
  return {
    id: uid("tab"),
    stack: [entry],
    idx: 0,
    /** home | search | web | internal | reader | error */
    kind: url ? (isInternal(url) ? "internal" : "web") : "web",
    url: entry.url,
    title: entry.title,
    favicon: "",
    secure: isSecure(entry.url),
    loading: false,
    progress: 0,
    muted: false,
    pinned: false,
    zoom: 100,
    q: "",
    results: null,
    featured: null,
    bingUrl: "",
    iframeOnly: false,
    readerHtml: "",
    snapshot: null,
    error: null,
    navToken: 0,
    embed: null,
    embedNote: null,
  };
}

const entryOf = (t) => t.stack[t.idx] || t.stack[0];

/**
 * Pages this PC makes itself: a saved .html opens as a blob, the app shells
 * use data: URLs, the OS serves its own webos: pages. They are local by
 * definition — there is no server to ask, so they never go through a relay
 * and can never come back as a network error.
 */
const LOCAL_URL = /^(blob|data|file|webos|filesystem):/i;
const isLocalUrl = (u) => LOCAL_URL.test(String(u || ""));

/** blob:https://host/9f3… → "Local page"; the tab keeps the real file name when it has one */
const localLabel = (u) => {
  const s = String(u || "");
  if (/^data:/i.test(s)) return "Data page";
  return "Local page";
};

/**
 * Fetch a page through whatever relay is available:
 *   1. the WebOS Browser Helper extension (its background fetches without page CORS)
 *   2. the /webos-proxy dev-server relay (works in the hosted preview, no extension needed)
 * A stale v1.0 helper or a network hiccup falls through automatically.
 */
const relayFetch = async (u, opts = {}) => {
  if (bridgeReady()) {
    try {
      return await bridgeFetch(u, opts);
    } catch (e) {
      // helper present but broken — try the local relay before giving up
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
  try {
    const r = await fetch(`/webos-proxy?url=${encodeURIComponent(u)}`, { signal: ctrl.signal });
    const data = await r.json();
    if (data.error && !data.status) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(t);
  }
};

/* ================================================================== *
 *  Microsoft Edge
 * ================================================================== */

export const EdgeMenu = () => {
  const wnapp = useSelector((state) => state.apps.edge);
  const osTheme = useSelector((state) => state.setting.person.theme);
  const personName = useSelector((state) => state.setting.person.name);
  const ext = useSelector((state) => state.ui.ext);
  const extLive = !!ext?.installed; // helper bridge live → open real sites, no rewrites
  const dispatch = useDispatch();

  const [tabs, setTabs] = useState(() => [newTab()]);
  const [ti, setTi] = useState(0);
  const [favs, setFavs] = useState(DEFAULT_FAVORITES);
  const [history, setHistory] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  const [omniFocus, setOmniFocus] = useState(false);
  const [typed, setTyped] = useState(null);
  const [hints, setHints] = useState([]);
  const [hi, setHi] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(null); // 'settings' | 'fav' | 'profile' | 'history'
  const [tabMenu, setTabMenu] = useState(null); // {id,x,y}
  const [findBar, setFindBar] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [sideTab, setSideTab] = useState("tools");
  const [status, setStatus] = useState("");
  const [cop, setCop] = useState(false); // the WebOS AI sidepane
  const [copMsgs, setCopMsgs] = useState([]);
  const [copBusy, setCopBusy] = useState(false);
  const [zoomMenu, setZoomMenu] = useState(false);

  const iframeRef = useRef(null);
  const omniRef = useRef(null);
  const rootRef = useRef(null);

  const tab = tabs[ti] || tabs[0];
  const entry = entryOf(tab);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  /* ---------------- load persisted browser data ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const [s, f, h, d] = await Promise.all([
          idb.get(SETTINGS_KEY).catch(() => null),
          idb.get(FAVS_KEY).catch(() => null),
          idb.getAll("history").catch(() => []),
          idb.get("edge.downloads").catch(() => null),
        ]);
        if (s) setSettings({ ...defaultSettings, ...s });
        if (Array.isArray(f) && f.length) setFavs(f);
        if (Array.isArray(h)) {
          /* purge artifacts from the broken-search era: history entries that
             point at the app's own origin could never be real pages */
          const SELF_URL =
            /^https?:\/\/(localhost|127\.0\.0\.1|win11-web\.pages\.dev|win11-web\.github\.io)(:\d+)?(\/|$)/i;
          const clean = h.filter((x) => x?.url && !SELF_URL.test(x.url));
          if (clean.length !== h.length) {
            idb.clear("history").catch(() => {});
            clean.forEach((rec) => idb.put("history", rec).catch(() => {}));
          }
          setHistory(clean.slice().sort((a, b) => b.at - a.at));
        }
        if (Array.isArray(d)) setDownloads(d);
      } catch (e) {}
      setLoaded(true);
    })();
    startBridge();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    idb.set(SETTINGS_KEY, settings).catch(() => {});
  }, [settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    idb.set(FAVS_KEY, favs).catch(() => {});
  }, [favs, loaded]);

  /* ---------------- tab plumbing ---------------- */
  const patchTab = useCallback((id, partial) => {
    setTabs((list) => list.map((t) => (t.id === id ? { ...t, ...partial } : t)));
  }, []);

  const pushEntry = (t, entry) => {
    const stack = t.stack.slice(0, t.idx + 1);
    stack.push(entry);
    if (stack.length > 60) stack.shift();
    return { stack, idx: stack.length - 1 };
  };

  const recordHistory = (url, title) => {
    if (!url || isInternal(url)) return;
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1|win11-web\.pages\.dev|win11-web\.github\.io)(:\d+)?(\/|$)/i.test(
        url,
      )
    )
      return;
    const rec = { id: uid("hist"), url, title: title || hostOf(url) || url, at: Date.now() };
    setHistory((h) => [rec, ...h].slice(0, 500));
    idb.put("history", rec).catch(() => {});
  };

  /* ---------------- navigation ---------------- */

  /** Show the "you're leaving this site" sheet, like Edge does for pop-ups. */
  const loadInto = async (tabId, raw, { replace = false, title = "" } = {}) => {
    const next = classifyInput(raw, { ext: extLive });

    if (next.kind === "home") {
      setTabs((list) =>
        list.map((x) =>
          x.id === tabId
            ? { ...newTab(), id: tabId, pinned: x.pinned, muted: x.muted, zoom: x.zoom }
            : x,
        ),
      );
      return;
    }

    if (next.kind === "internal") {
      setTabs((list) =>
        list.map((t) => {
          if (t.id !== tabId) return t;
          const e = { url: next.url, title: next.title, at: Date.now() };
          return {
            ...t,
            ...(replace
              ? { stack: t.stack.map((s, i) => (i === t.idx ? e : s)) }
              : pushEntry(t, e)),
            kind: "internal",
            url: next.url,
            title: next.title,
            favicon: "",
            secure: true,
            loading: false,
            progress: 0,
            error: null,
            readerHtml: "",
            snapshot: null,
            q: "",
          };
        }),
      );
      return;
    }

    /* ---- a page this PC made itself (blob:/data:/file:/webos:) ---- */
    if (isLocalUrl(next.url)) {
      const url = next.url;
      const label = next.title && next.title !== hostOf(url) ? next.title : localLabel(url);
      setTabs((list) =>
        list.map((t) => {
          if (t.id !== tabId) return t;
          const e = { url, title: label, at: Date.now() };
          return {
            ...t,
            ...(replace
              ? { stack: t.stack.map((s, i) => (i === t.idx ? e : s)) }
              : pushEntry(t, e)),
            kind: "web",
            local: true,
            url,
            frameUrl: url,
            title: label,
            favicon: "",
            secure: false, // nothing was dialled: no padlock to show
            loading: true,
            progress: 35,
            error: null,
            readerHtml: "",
            snapshot: null,
            embed: null,
            embedNote: null,
            navToken: Date.now() + Math.random(),
          };
        }),
      );
      /* The frame IS the page. Nothing to fetch, nothing to validate: the
         bar fills when the browser has drawn it, and a page that never
         paints stops the spinner instead of inventing a network error. */
      const settle = () => {
        const f = iframeRef.current;
        if (!f) return;
        const done = () => {
          patchTab(tabId, { loading: false, progress: 100 });
          setTimeout(() => patchTab(tabId, { progress: 0 }), 320);
        };
        f.onload = done;
        setTimeout(done, 2500); // already-cached blobs can beat the handler
      };
      setTimeout(settle, 30);
      return;
    }

    /* ---- a real web address ---- */
    const url = next.url;
    const token = Date.now() + Math.random();

    setTabs((list) =>
      list.map((t) => {
        if (t.id !== tabId) return t;
        const e = { url, title: hostOf(url), at: Date.now() };
        return {
          ...t,
          ...(replace ? { stack: t.stack.map((s, i) => (i === t.idx ? e : s)) } : pushEntry(t, e)),
          kind: "web",
          url,
          frameUrl: url, // the ONLY url the iframe serves — soft navs never touch it
          title: hostOf(url),
          favicon: favicon(url),
          secure: isSecure(url),
          loading: true,
          progress: 12,
          error: null,
          readerHtml: "",
          snapshot: null,
          embed: null,
          embedNote: null,
          navToken: token,
        };
      }),
    );
    recordHistory(url, hostOf(url));

    // Edge's progress bar creeps along while the frame settles
    let pct = 12;
    const creep = setInterval(() => {
      pct = Math.min(88, pct + Math.random() * 14);
      patchTab(tabId, { progress: pct });
    }, 160);

    const finish = (partial) => {
      clearInterval(creep);
      patchTab(tabId, { loading: false, progress: 100, embed: null, embedNote: null, ...partial });
      setTimeout(() => patchTab(tabId, { progress: 0 }), 320);
    };

    try {
      {
        // The helper (or the local relay) can tell us whether the site will
        // actually allow framing, and hand us the HTML when it will not.
        if (isLocalUrl(url)) {
          // never ask a server about a page this PC made
          finish({ kind: "web" });
          return;
        }
        const res = await relayFetch(url, { timeout: 15000 });
        const isHtml = /html/i.test(res.contentType || "");
        if (!res.ok) {
          finish({
            kind: "error",
            error: {
              reason: frameErrorText({ status: res.status }),
              detail: `HTTP ${res.status} ${res.statusText || ""}\n${res.finalUrl || url}`,
              canRead: false,
            },
          });
          return;
        }
        // Live is the ONLY first render: no snapshot page, no "styles on,
        // scripts off" bar — ever. The 9s watchdog only stops the spinner;
        // it never swaps the page away from the live frame.
        const liveFirst = () => {
          let answered = false;
          const armLive = () => {
            const f0 = iframeRef.current;
            const mark = () => {
              answered = true;
              finish({ kind: "web" });
            };
            if (f0) f0.onload = mark;
            else
              setTimeout(() => {
                if (iframeRef.current) iframeRef.current.onload = mark;
              }, 30);
          };
          armLive();
          finish({ kind: "web", loading: true, progress: 40 });
          setTimeout(() => {
            if (answered) return;
            // slow site, not a refusal: just stop the spinner — the live
            // frame stays, nothing replaces it — show the snapshot
            patchTab(tabId, { loading: false, progress: 0 });
            setTimeout(() => patchTab(tabId, { progress: 0 }), 300);
          }, 9000);
        };

        if (res.frameBlocked || isHtml) {
          // Frameable HTML: let the real iframe do it, scripts and all.
          if (isHtml && !res.frameBlocked) {
            if (extLive) {
              liveFirst();
              return;
            }
            finish({});
            return;
          }
          // The page refuses to be framed, but some of them (YouTube) publish
          // an official frameable twin — swap it in so the site still works.
          // (With the helper live we keep the real page instead.)
          const emb = extLive ? null : ytEmbed(url);
          if (emb) {
            finish({
              kind: "web",
              embed: emb,
              embedNote: `${hostOf(url)} blocks framing of its full page, so this is its official embed player.`,
            });
            return;
          }
          // With the helper live (v1.3+ strips X-Frame headers browser-wide),
          // the REAL frame gets first chance; if it still refuses, we fall
          // back to the snapshot we quietly prepared. Without the helper,
          // snapshot first: the original HTML with every URL absolutized,
          // so the site's own CSS and images load and it looks like itself.
          const snap = absolutizeHtml(res.body, res.finalUrl || url);
          if (snap) {
            notify({
              app: "Microsoft Edge",
              icon: "img/icon/edge.png",
              title: "Static copy",
              body: `${hostOf(url)} refuses to be embedded, so Edge rendered a reader snapshot. Some sites will only open in a real browser tab.`,
              kind: "info",
              life: 20,
            });
            finish({
              kind: "snapshot",
              snapshot: snap,
              readerHtml: toReadableHtml(res.body, res.finalUrl || url),
              title: titleFromHtml(res.body) || hostOf(url),
            });
            return;
          }
          const readable = toReadableHtml(res.body, res.finalUrl || url);
          if (extLive) {
            liveFirst();
            return;
          }
          if (readable) {
            finish({
              kind: "reader",
              readerHtml: readable,
              title: titleFromHtml(res.body) || hostOf(url),
            });
            return;
          }
        }
        if (!isHtml) {
          // a binary — treat it as a download
          finish({});
          offerDownload(url, res);
          return;
        }
        finish({
          kind: "error",
          error: {
            reason: frameErrorText({ xfo: res.headers?.xfo, csp: res.headers?.csp }),
            detail: `${res.finalUrl || url}`,
            canRead: true,
            raw: res.body,
          },
        });
      }
    } catch (e) {
      // the relay named the failure — show the honest Edge-style page
      const msg = String(e?.message || e);
      if (/helper present but broken|relay|ERR_|ENOTFOUND|ECONNREFUSED/i.test(msg)) {
        finish({
          kind: "error",
          error: {
            kind: e?.kind || "network",
            code: e?.code || "",
            reason: msg,
            detail: `${url}`,
            canRead: false,
          },
        });
        return;
      }
      // otherwise give the raw iframe a chance below
    }

    // Nothing answered: the iframe is on its own. Give it a fair chance, then offer
    // the Edge error page instead of a blank white rectangle.
    const watchdog = setTimeout(() => {
      finish({
        kind: "error",
        error: {
          reason: `${hostOf(url)} refused to connect, or the page never answered.`,
          detail: `${url}\n\nSome sites refuse to be framed; open this address directly in the browser to read it.`,
          canRead: false,
        },
      });
    }, 9000);

    const onFrame = () => {
      clearTimeout(watchdog);
      finish({ kind: "web" });
    };
    const f = iframeRef.current;
    if (f) {
      f.onload = onFrame;
    } else {
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.onload = onFrame;
      }, 30);
    }
  };

  const titleFromHtml = (html) => {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ""));
    return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 80) : "";
  };

  /* Bing publishes its results as RSS — fetchable through every relay we
     have. Chain: helper extension -> /webos-proxy -> legacy dev endpoint. */
  const fetchText = async (u, timeout = 15000) => {
    if (bridgeReady()) {
      try {
        const r = await bridgeFetch(u, { timeout, as: "text" });
        if (r && typeof r.body === "string") return r.body;
      } catch (e) {
        /* fall through */
      }
    }
    try {
      const r = await relayFetch(u, { timeout });
      if (r && typeof r.body === "string") return r.body;
    } catch (e) {
      /* fall through */
    }
    const r = await fetch(
      "/api/bing-search?q=" +
        encodeURIComponent(
          u.includes("q=") ? decodeURIComponent((u.match(/[?&]q=([^&]*)/) || [])[1] || "") : u,
        ),
    );
    if (!r.ok) throw new Error("no search relay");
    return r.text();
  };

  const navigate = async (raw, opts = {}) => {
    const id = opts.tabId || tab.id;
    const next = classifyInput(raw, { ext: extLive });
    setMenuOpen(null);
    setTyped(null);
    setHi(-1);

    // "No asking": cross-site moves go straight into the live frame
    await loadInto(id, raw, opts);
  };

  const go = (delta) => {
    const t = tab;
    const ni = t.idx + delta;
    if (ni < 0 || ni >= t.stack.length) return;
    const e = t.stack[ni];
    setTabs((list) =>
      list.map((x) =>
        x.id === t.id
          ? {
              ...x,
              idx: ni,
              kind: kindFor(e.url),
              url: e.url,
              frameUrl: /^https?:/.test(e.url) ? e.url : x.frameUrl,
              title: e.title,
              favicon: isInternal(e.url) ? "" : favicon(e.url),
              secure: isSecure(e.url),
              error: null,
              readerHtml: "",
              snapshot: null,
            }
          : x,
      ),
    );
    if (!isInternal(e.url) && !/^search:/.test(e.url)) {
      // re-resolve so the page really reloads
      loadInto(t.id, e.url, { replace: true, silent: true });
    }
  };

  /* ---- the frame bridge (needs Helper v1.6+) ----
     A page running inside the live frame reports soft navigations
     (pushState) and hands full navigations (link clicks, form submits) to
     us. Doing it this way means every request is initiated by OUR origin,
     so the helper's header-strip rule applies and nothing "refuses to
     connect" — Google's own search box included. */
  useEffect(() => {
    const onFrameMsg = (e) => {
      const d = e.data;
      if (!d || d.src !== "WEBOS_BRIDGE") return;
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      if (d.type === "navigate") {
        loadInto(tabRef.current?.id, d.url);
      } else if (d.type === "location") {
        // soft nav inside the frame: keep the address bar honest
        const url = String(d.url || "");
        if (!url || !tabRef.current) return;
        setTabs((list) =>
          list.map((t) => {
            if (t.id !== tabRef.current.id) return t;
            const stack = (t.stack || []).map((en, i) =>
              i === t.idx ? { ...en, url, title: d.title || en.title } : en,
            );
            return { ...t, url, stack, title: d.title || t.title, favicon: favicon(url) };
          }),
        );
      }
    };
    window.addEventListener("message", onFrameMsg);
    return () => window.removeEventListener("message", onFrameMsg);
  }, []);

  // typing must never outlive the page it was typed for
  useEffect(() => {
    setTyped(null);
  }, [tab?.id, entry?.url]);

  const copAsk = (q) => {
    setCop(true);
    if (!q) return;
    setCopMsgs((m) => [...m, { role: "user", content: q }]);
    setCopBusy(true);
    aiChat([
      { role: "user", content: "You are WebOS AI, a concise assistant. Plain text, no markdown." },
      { role: "user", content: q },
    ])
      .then((r) => setCopMsgs((m) => [...m, { role: "assistant", content: r.text }]))
      .catch((err) =>
        setCopMsgs((m) => [
          ...m,
          { role: "assistant", content: `AI is unreachable (${String(err.message || err)}).` },
        ]),
      )
      .finally(() => setCopBusy(false));
  };

  const kindFor = (u) => {
    if (!u) return "home";
    if (u === HOME) return "web"; // the real Google homepage, live in the frame
    if (isInternal(u)) return "internal";
    if (/^search:/.test(u)) return "search";
    return "web";
  };

  const reload = () => {
    if (tab.kind === "web" && iframeRef.current) {
      patchTab(tab.id, { loading: true, progress: 25 });
      // eslint-disable-next-line no-self-assign
      iframeRef.current.src = iframeRef.current.src;
      setTimeout(() => patchTab(tab.id, { loading: false, progress: 0 }), 900);
    } else loadInto(tab.id, entry.url, { replace: true });
  };

  /* ---------------- tabs ---------------- */
  const addTab = (url) => {
    const t = newTab(url);
    setTabs((list) => [...list, t]);
    setTi(tabs.length);
    if (url) loadInto(t.id, url);
    return t;
  };

  const closeTab = (id) => {
    setTabs((list) => {
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) return list;
      const next = list.filter((t) => t.id !== id);
      if (!next.length) return [newTab()];
      setTi((cur) => {
        if (i < cur) return cur - 1;
        if (i === cur) return Math.max(0, Math.min(next.length - 1, cur));
        return cur;
      });
      return next;
    });
  };

  const togglePin = (id) =>
    setTabs((list) => list.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));

  const moveTab = (from, to) => {
    setTabs((list) => {
      const next = list.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
    setTi(to);
  };

  /* ---------------- favourites ---------------- */
  const isFav = favs.some((f) => f.url === entry.url);
  const toggleFav = async () => {
    if (isFav) {
      setFavs((f) => f.filter((x) => x.url !== entry.url));
      notify({
        app: "Microsoft Edge",
        icon: "img/icon/edge.png",
        title: "Removed from favourites",
        body: entry.title,
        kind: "info",
        life: 3,
      });
      return;
    }
    const name = await wosPrompt("Name this favourite:", {
      title: "Add a favourite",
      value: tab.title || hostOf(entry.url),
      okText: "Add",
    });
    if (name === null) return;
    setFavs((f) => [...f, { name: name || hostOf(entry.url) || entry.url, url: entry.url }]);
    notify({
      app: "Microsoft Edge",
      icon: "img/icon/edge.png",
      title: "Added to favourites",
      body: entry.url,
      kind: "success",
      life: 3,
    });
  };

  /* ---------------- downloads -> Virtual Storage ---------------- */
  const saveDownload = async (url, { name, body, mime, binary }) => {
    try {
      const user = vs.getUserName();
      await vs.hydrate();
      const fileName =
        name ||
        decodeURIComponent((url.split("/").pop() || "download").split("?")[0]) ||
        "download.bin";
      const safe = fileName.replace(/[<>:"/\\|?*]/g, "_").slice(0, 80);
      const path = `C:\\Users\\${user}\\Downloads\\${safe}`;

      const type = mime || vs.mimeFor(safe);
      let size = 0;
      if (binary && typeof body === "string") {
        // the bridge hands binaries back base64-encoded — store real bytes
        await vs.vsWriteDataUrl(path, `data:${type};base64,${body}`, { mime: type });
        size = Math.floor((body.length * 3) / 4);
      } else {
        const text = typeof body === "string" ? body : String(body ?? "");
        await vs.vsWrite(path, text, { mime: type });
        size = text.length;
      }

      const rec = {
        id: uid("dl"),
        name: safe,
        url,
        path,
        mime: type,
        sizeLabel: vs.bytes(size),
        at: Date.now(),
      };
      setDownloads((d) => [rec, ...d].slice(0, 200));
      idb.set("edge.downloads", [rec, ...downloads].slice(0, 200)).catch(() => {});

      notify({
        app: "Microsoft Edge",
        icon: "img/icon/edge.png",
        title: "Download complete",
        body: `${safe} → ${path}`,
        kind: "success",
        actions: [
          {
            label: "Show in Explorer",
            onClick: () => dispatch({ type: "EXPLORER", payload: "full" }),
          },
        ],
      });
      return rec;
    } catch (e) {
      notify({
        app: "Microsoft Edge",
        icon: "img/icon/edge.png",
        title: "Download failed",
        body: String(e?.message || e),
        kind: "error",
      });
      return null;
    }
  };

  const offerDownload = async (url, res) => {
    const ok = await wosConfirm(`Save this file to Downloads?\n${url}`, {
      title: "Download",
      okText: "Save",
    });
    if (!ok) return;
    await saveDownload(url, {
      name: decodeURIComponent((url.split("/").pop() || "file").split("?")[0]),
      body: res?.body,
      mime: res?.contentType,
      binary: res?.binary,
    });
  };

  const downloadCurrent = async () => {
    try {
      const res = await relayFetch(entry.url, { timeout: 20000 });
      await saveDownload(entry.url, {
        name:
          (tab.title || hostOf(entry.url) || "page").replace(/[<>:"/\\|?*]/g, "_").slice(0, 60) +
          (/html/i.test(res.contentType || "") ? ".html" : ".bin"),
        body: res.body,
        mime: res.contentType,
        binary: res.binary,
      });
    } catch (e) {
      notify({
        app: "Microsoft Edge",
        icon: "img/icon/edge.png",
        title: "Download failed",
        body: String(e?.message || e),
        kind: "error",
      });
    }
  };

  /* ---------------- omnibox ---------------- */
  /* A blob: URL is noise in an address bar. Local pages show where they came
     from — the file name the OS handed over, or "Local page". */
  const barValue =
    typed !== null
      ? typed
      : tab.kind === "home"
        ? ""
        : tab.kind === "search"
          ? tab.q
          : tab.local || isLocalUrl(entry.url)
            ? tab.title || localLabel(entry.url)
            : entry.url;

  useEffect(() => {
    if (!omniFocus || !settings.suggest) return;
    const q = (typed ?? "").trim();
    if (!q || /^https?:|^edge:/i.test(q)) {
      setHints([]);
      return;
    }
    const t = setTimeout(
      () =>
        bingSuggest(q)
          .then(setHints)
          .catch(() => {}),
      150,
    );
    return () => clearTimeout(t);
  }, [typed, omniFocus, settings.suggest]);

  // mix in your own history + favourites, exactly like Edge does
  const omniHints = useMemo(() => {
    const q = (typed ?? "").trim().toLowerCase();
    if (!q) return [];
    /* only unlocked (frameable) sites get suggested — reddit/youtube/github
       etc. would just refuse to render, so they never appear here */
    const local = [
      ...favs
        .filter((f) => (f.name + f.url).toLowerCase().includes(q) && isFrameable(f.url))
        .map((f) => ({ text: f.name, url: f.url, kind: "Favourite" })),
      ...history
        .filter((h) => (h.title + h.url).toLowerCase().includes(q))
        .slice(0, 4)
        .map((h) => ({ text: h.title || h.url, url: h.url, kind: "History" })),
    ];
    const engine = ENGINES[settings.engine] || ENGINES.google;
    const web = hints.slice(0, 6).map((h) => ({ text: h, url: engine.build(h), kind: "Search" }));
    const seen = new Set();
    return [...local, ...web]
      .filter((x) => (seen.has(x.text) ? false : seen.add(x.text)))
      .slice(0, 9);
  }, [typed, hints, favs, history, settings.engine]);

  const commitOmni = (value) => {
    setTyped(null);
    setOmniFocus(false);
    omniRef.current?.blur();
    navigate(value == null ? barValue : value);
  };

  const omniKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((n) => Math.min(omniHints.length - 1, n + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((n) => Math.max(-1, n - 1));
    } else if (e.key === "Escape") {
      setTyped(null);
      setHi(-1);
      omniRef.current?.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hi >= 0 && omniHints[hi]) commitOmni(omniHints[hi].url);
      else commitOmni();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      omniRef.current?.select();
    }
  };

  /* ---------------- external links ---------------- */
  useEffect(() => {
    if (!wnapp.url) return;
    const url = typeof wnapp.url === "object" ? wnapp.url.url : wnapp.url;
    const label = typeof wnapp.url === "object" ? wnapp.url.title : "";
    if (!url) return;
    dispatch({ type: "EDGELINK" });
    // open in a NEW tab, like Edge does for a handed-over link
    const t = newTab();
    setTabs((list) => [...list, t]);
    setTi(tabs.length);
    setTimeout(() => loadInto(t.id, url, { title: label }), 0);
  }, [wnapp.url]);

  // the helper hands back links clicked inside a rendered page
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d || d.src !== "WEBOS_BRIDGE" || d.type !== "navigate") return;
      navigate(d.url);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [tab.id, entry.url]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    if (!wnapp.alive || wnapp.hide) return;
    const onKey = (e) => {
      const c = e.ctrlKey || e.metaKey;
      if (!c) return;
      const k = e.key.toLowerCase();
      if (k === "t") {
        e.preventDefault();
        addTab();
      } else if (k === "w") {
        e.preventDefault();
        closeTab(tab.id);
      } else if (k === "tab") {
        e.preventDefault();
        setTi((i) => (e.shiftKey ? (i - 1 + tabs.length) % tabs.length : (i + 1) % tabs.length));
      } else if (k === "l") {
        e.preventDefault();
        setTyped("");
        setOmniFocus(true);
        setTimeout(() => omniRef.current?.focus(), 10);
      } else if (k === "r") {
        e.preventDefault();
        reload();
      } else if (k === "d") {
        e.preventDefault();
        toggleFav();
      } else if (k === "h") {
        e.preventDefault();
        navigate("edge://history");
      } else if (k === "j") {
        e.preventDefault();
        navigate("edge://downloads");
      } else if (k === "f") {
        e.preventDefault();
        setFindBar(true);
      } else if (/^[1-8]$/.test(k)) {
        e.preventDefault();
        setTi(Math.min(tabs.length - 1, Number(k) - 1));
      } else if (k === "9") {
        e.preventDefault();
        setTi(tabs.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wnapp.alive, wnapp.hide, tabs, ti, tab.id, entry.url, favs]);

  /* ---------------- close the flyouts on an outside click ---------- */
  useEffect(() => {
    if (!menuOpen && !tabMenu) return;
    const away = (e) => {
      if (e.target.closest?.(".egFly") || e.target.closest?.(".egMenuBtn")) return;
      setMenuOpen(null);
      setTabMenu(null);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [menuOpen, tabMenu]);

  /* ---------------- find in page ---------------- */
  const doFind = (dir = 1) => {
    const f = iframeRef.current;
    if (!f || !findQ) return;
    try {
      const doc = f.contentDocument || f.contentWindow?.document;
      if (!doc) throw new Error("cross-origin");
      const win = f.contentWindow;
      win.find(findQ, false, dir < 0, true, false, false, false);
    } catch (e) {
      setStatus("Find is not available on this site — it blocks the page from being read.");
      setTimeout(() => setStatus(""), 3200);
    }
  };

  /* ================================================================== *
   *  Render
   * ================================================================== */

  const themeClass = settings.followTheme && osTheme === "dark" ? "eg-dark" : "eg-light";
  const canBack = tab.idx > 0;
  const canFwd = tab.idx < tab.stack.length - 1;

  const settingsMenu = [
    { head: personName || "You" },
    { label: "Your profile", icon: <IcoPerson />, onClick: () => navigate("edge://settings") },
    { sep: true },
    { label: "New tab", kbd: "Ctrl+T", icon: <IcoPlus />, onClick: () => addTab() },
    {
      label: "New window",
      icon: <IcoWindow />,
      onClick: () => dispatch({ type: "MSEDGE", payload: "full" }),
    },
    {
      label: "History",
      kbd: "Ctrl+H",
      icon: <IcoClock />,
      onClick: () => navigate("edge://history"),
    },
    {
      label: "Downloads",
      kbd: "Ctrl+J",
      icon: <IcoDown />,
      onClick: () => navigate("edge://downloads"),
    },
    {
      label: "Favourites",
      kbd: "Ctrl+Shift+O",
      icon: <IcoStar />,
      onClick: () => navigate("edge://favorites"),
    },
    { sep: true },
    { label: "Find on page", kbd: "Ctrl+F", icon: <IcoFind />, onClick: () => setFindBar(true) },
    { label: "Zoom", icon: <IcoZoom />, onClick: () => setZoomMenu(true) },
    { label: "Print", kbd: "Ctrl+P", icon: <IcoPrint />, onClick: () => doPrint() },
    { sep: true },
    { label: "Settings", icon: <IcoGear />, onClick: () => navigate("edge://settings") },
  ];

  const doPrint = () => {
    try {
      const f = iframeRef.current;
      if (f?.contentWindow) f.contentWindow.print();
      else window.print();
    } catch {
      notify({
        app: "Microsoft Edge",
        icon: "img/icon/edge.png",
        title: "Can't print this page",
        body: "The site does not let the OS reach into it.",
        kind: "warn",
      });
    }
  };

  const setZoom = (z) => patchTab(tab.id, { zoom: Math.max(25, Math.min(500, z)) });

  return (
    <div
      ref={rootRef}
      className={`edgeBrowser eg ${themeClass} floatTab dpShad`}
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
      data-favbar={settings.showFavBar}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Microsoft Edge" float />

      <div className="windowScreen flex flex-col">
        {/* ---------- tab strip ---------- */}
        <div className="egTabRow">
          <div className="egTabs" role="tablist">
            {tabs.map((t, i) => (
              <div
                key={t.id}
                role="tab"
                aria-selected={i === ti}
                className={`egTab ${i === ti ? "on" : ""} ${t.pinned ? "pin" : ""}`}
                data-loading={t.loading}
                onClick={() => setTi(i)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(t.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTabMenu({ id: t.id, x: e.clientX, y: e.clientY });
                }}
                onMouseEnter={() => setStatus(t.url)}
                onMouseLeave={() => setStatus("")}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (!Number.isNaN(from) && from !== i) moveTab(from, i);
                }}
              >
                <span className="egTabFav">
                  {t.loading ? (
                    <i className="egSpin" />
                  ) : t.favicon ? (
                    <img
                      src={t.favicon}
                      alt=""
                      width="16"
                      height="16"
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  ) : isInternal(t.url) || t.kind === "home" ? (
                    <EdgeGlyph size={14} />
                  ) : (
                    <span className="egTabLetter">{(hostOf(t.url) || "•")[0].toUpperCase()}</span>
                  )}
                </span>
                {!t.pinned ? <span className="egTabTitle">{t.title || "New tab"}</span> : null}
                {!t.pinned ? (
                  <span
                    className="egTabX"
                    role="button"
                    aria-label="Close tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(t.id);
                    }}
                  >
                    <svg viewBox="0 0 12 12" width="9" height="9">
                      <path
                        d="M1 1l10 10M11 1L1 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="egTabAdd"
              aria-label="New tab"
              onClick={() => addTab()}
              title="New tab (Ctrl+T)"
            >
              <svg viewBox="0 0 16 16" width="12" height="12">
                <path
                  d="M8 2v12M2 8h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ---------- navigation toolbar ---------- */}
        <div className="egToolbar">
          <div className="egNavBtns">
            <button
              type="button"
              className="egNav"
              disabled={!canBack}
              onClick={() => go(-1)}
              title="Back (Alt+←)"
              aria-label="Back"
            >
              <IcoBack />
            </button>
            <button
              type="button"
              className="egNav"
              disabled={!canFwd}
              onClick={() => go(1)}
              title="Forward (Alt+→)"
              aria-label="Forward"
            >
              <IcoFwd />
            </button>
            <button
              type="button"
              className="egNav"
              onClick={reload}
              title="Reload (Ctrl+R)"
              aria-label="Reload"
            >
              {tab.loading ? <i className="egSpin big" /> : <IcoReload />}
            </button>
            <button
              type="button"
              className="egNav"
              onClick={() => navigate(settings.home || HOME)}
              title="Home"
              aria-label="Home"
            >
              <IcoHome />
            </button>
          </div>

          <div className={`egOmni ${omniFocus ? "focus" : ""}`}>
            <span className="egOmniLock" title={tab.secure ? "Connection is secure" : "Not secure"}>
              {tab.kind === "home" ? (
                <EdgeGlyph size={14} />
              ) : tab.secure ? (
                <IcoLock />
              ) : (
                <IcoWarn />
              )}
            </span>
            <input
              ref={omniRef}
              className="egOmniInput"
              value={barValue}
              placeholder="Search with Google or type a web address"
              spellCheck={false}
              autoComplete="off"
              onFocus={(e) => {
                setOmniFocus(true);
                setTimeout(() => e.target.select(), 20);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setOmniFocus(false);
                  setTyped(null);
                  setHi(-1);
                }, 140);
              }}
              onChange={(e) => {
                setTyped(e.target.value);
                setHi(-1);
              }}
              onKeyDown={omniKey}
            />
            {tab.kind === "web" ? (
              <button
                type="button"
                className={`egOmniStar ${isFav ? "on" : ""}`}
                onClick={toggleFav}
                title={isFav ? "Remove from favourites" : "Add to favourites"}
              >
                <IcoStar filled={isFav} />
              </button>
            ) : null}
            {typed ? (
              <button
                type="button"
                className="egOmniClear"
                onClick={() => {
                  setTyped("");
                  omniRef.current?.focus();
                }}
                aria-label="Clear"
              >
                <svg viewBox="0 0 12 12" width="9" height="9">
                  <path
                    d="M1 1l10 10M11 1L1 11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}

            {omniFocus && omniHints.length ? (
              <div className="egOmniPop">
                {omniHints.map((h, i) => (
                  <button
                    type="button"
                    key={h.text + i}
                    className={i === hi ? "on" : ""}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitOmni(h.url)}
                    onMouseEnter={() => setHi(i)}
                  >
                    <span className="egOmniPopIco">
                      {h.kind === "Search" ? (
                        <IcoFind />
                      ) : h.kind === "Favourite" ? (
                        <IcoStar />
                      ) : (
                        <IcoClock />
                      )}
                    </span>
                    <span className="egOmniPopText">{h.text}</span>
                    <span className="egOmniPopKind">{h.kind}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="egRightBtns">
            <button
              type="button"
              className={`egNav ${cop ? "egNavOn" : ""}`}
              onClick={() => setCop((v) => !v)}
              title="WebOS AI (Copilot)"
              aria-label="WebOS AI"
            >
              <IcoSpark />
            </button>
            <WosFlyout
              className="egFly"
              align="right"
              width={240}
              trigger={
                <button
                  type="button"
                  className="egNav egMenuBtn"
                  title="Collections"
                  aria-label="Collections"
                >
                  <IcoCollection />
                </button>
              }
              items={[
                { head: "Collections" },
                {
                  label: "Start a collection",
                  icon: <IcoPlus />,
                  onClick: async () => {
                    const name = await wosPrompt("Name your collection:", {
                      title: "New collection",
                      value: tab.title || "Collection",
                      okText: "Start",
                    });
                    if (!name) return;
                    const list = (await idb.get("edge.collections").catch(() => null)) || [];
                    list.push({
                      id: uid("col"),
                      name,
                      items: [{ title: tab.title, url: entry.url, at: Date.now() }],
                      at: Date.now(),
                    });
                    await idb.set("edge.collections", list).catch(() => {});
                    notify({
                      app: "Microsoft Edge",
                      icon: "img/icon/edge.png",
                      title: "Collection started",
                      body: name,
                      kind: "success",
                      life: 3,
                    });
                  },
                },
                { label: "Add current page", icon: <IcoStar />, onClick: toggleFav },
                { sep: true },
                {
                  label: "Open favourites",
                  icon: <IcoStar />,
                  onClick: () => navigate("edge://favorites"),
                },
              ]}
            />

            <WosFlyout
              className="egFly"
              align="right"
              width={260}
              trigger={
                <button
                  type="button"
                  className="egNav egMenuBtn"
                  title="Settings and more"
                  aria-label="Settings and more"
                >
                  <IcoDots />
                </button>
              }
              items={settingsMenu}
            />
          </div>

          {tab.loading ? (
            <i className="egProgress" style={{ width: `${tab.progress || 8}%` }} />
          ) : null}
        </div>

        {/* ---------- favourites bar ---------- */}
        {settings.showFavBar ? (
          <div className="egFavBar">
            {favs.map((f, i) => (
              <button
                key={f.url + i}
                type="button"
                className="egFavBtn"
                onClick={() => navigate(f.url)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabMenu({ id: "fav:" + i, x: e.clientX, y: e.clientY });
                }}
                onMouseEnter={() => setStatus(f.url)}
                onMouseLeave={() => setStatus("")}
                title={f.url}
              >
                <img
                  src={favicon(f.url, 32)}
                  alt=""
                  width="14"
                  height="14"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
                <span>{f.name}</span>
              </button>
            ))}
            <button
              type="button"
              className="egFavMore"
              onClick={() => navigate("edge://favorites")}
            >
              ⋯
            </button>
          </div>
        ) : null}

        {/* ---------- find in page ---------- */}
        {findBar ? (
          <div className="egFind">
            <input
              autoFocus
              value={findQ}
              placeholder="Find on page"
              onChange={(e) => setFindQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doFind(e.shiftKey ? -1 : 1);
                if (e.key === "Escape") setFindBar(false);
              }}
            />
            <button type="button" onClick={() => doFind(-1)} aria-label="Previous">
              <svg viewBox="0 0 12 12" width="10" height="10">
                <path
                  d="M6 9L2 5l4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(-90 6 6)"
                />
              </svg>
            </button>
            <button type="button" onClick={() => doFind(1)} aria-label="Next">
              <svg viewBox="0 0 12 12" width="10" height="10">
                <path
                  d="M6 3l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(90 6 6)"
                />
              </svg>
            </button>
            <button
              type="button"
              className="x"
              onClick={() => setFindBar(false)}
              aria-label="Close"
            >
              <svg viewBox="0 0 12 12" width="10" height="10">
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ) : null}

        {/* ---------- content ---------- */}
        <div className="egContent">
          {tab.kind === "internal" && /^edge:\/\/surf/i.test(tab.url) ? <SurfPage /> : null}

          {tab.kind === "home" || (tab.kind === "internal" && /newtab|home|blank/.test(tab.url)) ? (
            <NewTabPage
              onGo={(v) => navigate(v)}
              settings={settings}
              favs={favs}
              history={history}
              extInstalled={ext.installed}
            />
          ) : null}

          {tab.kind === "internal" && tab.url === "edge://history" ? (
            <HistoryPage
              history={history}
              onGo={(u) => navigate(u)}
              onOpenDownloads={() => navigate("edge://downloads")}
              onDelete={async (id) => {
                setHistory((h) => h.filter((x) => x.id !== id));
                await idb.deleteFrom("history", id).catch(() => {});
              }}
              onClear={async () => {
                setHistory([]);
                await idb.clear("history").catch(() => {});
              }}
            />
          ) : null}

          {tab.kind === "internal" && tab.url === "edge://downloads" ? (
            <DownloadsPage
              downloads={downloads}
              onDelete={(id) => {
                const next = downloads.filter((d) => d.id !== id);
                setDownloads(next);
                idb.set("edge.downloads", next).catch(() => {});
              }}
              onClear={() => {
                setDownloads([]);
                idb.set("edge.downloads", []).catch(() => {});
              }}
              onRedownload={(d) => {
                dispatch({
                  type: "FILEPATH",
                  payload: `C:\\Users\\${vs.getUserName()}\\Downloads`,
                });
                dispatch({ type: "EXPLORER", payload: "full" });
              }}
            />
          ) : null}

          {tab.kind === "internal" && tab.url === "edge://favorites" ? (
            <FavoritesPage
              favs={favs}
              onGo={(u) => navigate(u)}
              onAdd={(f) => setFavs((x) => [...x, f])}
              onRename={async (i) => {
                const name = await wosPrompt("New name:", {
                  title: "Rename favourite",
                  value: favs[i].name,
                });
                if (!name) return;
                setFavs((x) => x.map((f, j) => (j === i ? { ...f, name } : f)));
              }}
              onDelete={async (i) => {
                const ok = await wosConfirm(`Remove "${favs[i].name}" from favourites?`, {
                  title: "Remove favourite",
                  okText: "Remove",
                  danger: true,
                });
                if (ok) setFavs((x) => x.filter((_, j) => j !== i));
              }}
            />
          ) : null}

          {tab.kind === "internal" && tab.url === "edge://settings" ? (
            <SettingsPage
              settings={settings}
              onChange={(s) => {
                if (s.__cleared) {
                  setHistory([]);
                  setDownloads([]);
                  delete s.__cleared;
                }
                setSettings(s);
              }}
              favs={favs}
              onGo={(u) => navigate(u)}
              historyCount={history.length}
              downloadCount={downloads.length}
              extInstalled={ext.installed}
            />
          ) : null}

          {tab.kind === "internal" &&
          !["edge://history", "edge://downloads", "edge://favorites", "edge://settings"].includes(
            tab.url,
          ) &&
          !/newtab|home|blank/.test(tab.url) ? (
            <div className="egPage">
              <div className="egPageHead">
                <div>
                  <div className="egEyebrow">Microsoft Edge</div>
                  <h1>{INTERNAL[tab.url] || tab.url}</h1>
                </div>
              </div>
              <div className="egEmpty">This internal page is not part of the build yet.</div>
            </div>
          ) : null}

          {tab.kind === "snapshot" ? (
            <SnapshotPage html={tab.snapshot} url={entry.url} title={tab.title} />
          ) : null}

          {tab.kind === "reader" ? (
            <ReaderPage
              html={tab.readerHtml}
              url={entry.url}
              title={tab.title}
              onLink={(href) => navigate(href)}
            />
          ) : null}

          {tab.kind === "error" ? (
            <ErrorPage
              url={entry.url}
              reason={tab.error?.reason}
              kind={tab.error?.kind}
              code={tab.error?.code}
              detail={tab.error?.detail}
              canRead={!!tab.error?.canRead}
              extInstalled={ext.installed}
              onRetry={reload}
              onHome={() => navigate(settings.home || HOME)}

              onReader={async () => {
                try {
                  const res = await relayFetch(entry.url, { timeout: 15000 });
                  const html = toReadableHtml(
                    tab.error?.raw || res.body,
                    res.finalUrl || entry.url,
                  );
                  patchTab(tab.id, {
                    kind: "reader",
                    readerHtml: html,
                    title: titleFromHtml(res.body) || tab.title,
                  });
                } catch (e) {
                  notify({
                    app: "Microsoft Edge",
                    icon: "img/icon/edge.png",
                    title: "Still can't read it",
                    body: String(e?.message || e),
                    kind: "error",
                  });
                }
              }}
            />
          ) : null}

          {tab.kind === "web" ? (
            <div className="egFrameWrap" data-zoom={tab.zoom}>
              {/* EVERY web tab's iframe stays mounted — switching tabs only
                  shows/hides layers, it must never reload the page */}
              {tabs
                .filter((t) => t.kind === "web" && (t.embed || t.frameUrl || t.url))
                .map((t) => (
                  <div
                    key={t.id}
                    className="egFrameLayer"
                    data-active={t.id === tab.id ? "on" : "off"}
                  >
                    {t.id === tab.id && tab.embedNote ? (
                      <div className="egEmbedNote">
                        <span className="egEmbedNoteTxt">{tab.embedNote}</span>
                        <button
                          type="button"
                          className="egEmbedNoteX"
                          title="Dismiss"
                          onClick={() => patchTab(tab.id, { embedNote: null })}
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                    <iframe
                      ref={t.id === tab.id ? iframeRef : null}
                      key={(t.embed || "") + (t.frameUrl || t.url) + t.id}
                      src={t.embed || t.frameUrl || t.url}
                      title={t.title}
                      className="egFrame"
                      sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox allow-presentation"
                      referrerPolicy="no-referrer"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    />
                  </div>
                ))}
            </div>
          ) : null}

          {/* ---- WebOS AI sidepane (Copilot-style) ---- */}
          {cop ? (
            <div className="egCopilot" data-busy={copBusy}>
              <div className="egCopHead">
                <span className="egCopBrand">
                  <IcoSpark /> WebOS AI
                </span>
                <span className="egCopSub">Llama 3.3 70B · via DuckDuckGo</span>
                <button
                  type="button"
                  className="egCopX"
                  title="Close"
                  onClick={() => setCop(false)}
                >
                  ×
                </button>
              </div>
              <div className="egCopBody win11Scroll">
                {!copMsgs.length ? (
                  <div className="egCopEmpty">
                    <IcoSpark size={28} />
                    <h3>Ask me anything</h3>
                    <p>
                      Answers come from a keyless AI endpoint
                      {extLive ? "" : " — which needs the relay, so chat is unavailable right now"}.
                    </p>
                  </div>
                ) : null}
                {copMsgs.map((m, i) => (
                  <div key={i} className={`egCopMsg ${m.role}`}>
                    {m.role === "user" ? m.content : <span className="egCopText">{m.content}</span>}
                  </div>
                ))}
                {copBusy ? (
                  <div className="egCopMsg ai egCopThinking">
                    <span className="egSpin" /> Thinking…
                  </div>
                ) : null}
              </div>
              <form
                className="egCopInput"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const text = e.target.elements.copq.value.trim();
                  if (!text || copBusy) return;
                  e.target.reset();
                  const msgs = [...copMsgs, { role: "user", content: text }];
                  setCopMsgs(msgs);
                  setCopBusy(true);
                  try {
                    const r = await aiChat([
                      {
                        role: "user",
                        content:
                          "You are WebOS AI, a concise, friendly assistant inside a Windows 11 web desktop. Plain text, no markdown.",
                      },
                      ...msgs.map((m) => ({ role: m.role, content: m.content })),
                    ]);
                    setCopMsgs([...msgs, { role: "assistant", content: r.text }]);
                  } catch (err) {
                    setCopMsgs([
                      ...msgs,
                      {
                        role: "assistant",
                        content: `AI is unreachable right now (${String(err.message || err)}). The AI relay is unavailable on this PC.`,
                      },
                    ]);
                  }
                  setCopBusy(false);
                }}
              >
                <input
                  name="copq"
                  placeholder={extLive ? "Ask WebOS AI…" : "The AI relay is unavailable on this PC"}
                  autoComplete="off"
                  disabled={!extLive}
                />
                <button type="submit" disabled={!extLive || copBusy} title="Send">
                  ➤
                </button>
              </form>
            </div>
          ) : null}

          {/* the tab right-click menu */}
          {tabMenu ? (
            <div
              className="wosFlyout egTabFly"
              style={{
                position: "fixed",
                left: Math.min(tabMenu.x, window.innerWidth - 230),
                top: Math.min(tabMenu.y, window.innerHeight - 320),
                width: 224,
              }}
            >
              {tabMenu.id.startsWith("fav:") ? (
                <>
                  <button
                    type="button"
                    className="wosFlyItem"
                    onClick={() => {
                      navigate(favs[Number(tabMenu.id.slice(4))].url);
                      setTabMenu(null);
                    }}
                  >
                    <span className="glyph">
                      <IcoStar />
                    </span>
                    <span className="lbl">Open</span>
                  </button>
                  <button
                    type="button"
                    className="wosFlyItem"
                    onClick={async () => {
                      const i = Number(tabMenu.id.slice(4));
                      const name = await wosPrompt("New name:", { value: favs[i].name });
                      if (name) setFavs((x) => x.map((f, j) => (j === i ? { ...f, name } : f)));
                      setTabMenu(null);
                    }}
                  >
                    <span className="glyph">
                      <IcoEdit />
                    </span>
                    <span className="lbl">Rename</span>
                  </button>
                  <div className="wosFlySep" />
                  <button
                    type="button"
                    className="wosFlyItem"
                    onClick={() => {
                      setFavs((x) => x.filter((_, j) => j !== Number(tabMenu.id.slice(4))));
                      setTabMenu(null);
                    }}
                  >
                    <span className="glyph">
                      <IcoBin />
                    </span>
                    <span className="lbl">Delete</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="wosFlyItem"
                    onClick={() => {
                      const t = tabs.find((x) => x.id === tabMenu.id);
                      addTab(t?.url);
                      setTabMenu(null);
                    }}
                  >
                    <span className="glyph">
                      <IcoPlus />
                    </span>
                    <span className="lbl">Duplicate tab</span>
                  </button>
                  <button
                    type="button"
                    className="wosFlyItem"
                    onClick={() => {
                      togglePin(tabMenu.id);
                      setTabMenu(null);
                    }}
                  >
                    <span className="glyph">
                      <IcoPin />
                    </span>
                    <span className="lbl">
                      {tabs.find((t) => t.id === tabMenu.id)?.pinned ? "Unpin tab" : "Pin tab"}
                    </span>
                  </button>
                  <div className="wosFlySep" />
                  <button
                    type="button"
                    className="wosFlyItem"
                    onClick={() => {
                      closeTab(tabMenu.id);
                      setTabMenu(null);
                    }}
                  >
                    <span className="glyph">
                      <IcoBin />
                    </span>
                    <span className="lbl">Close tab</span>
                  </button>
                  <button
                    type="button"
                    className="wosFlyItem"
                    onClick={() => {
                      setTabs([newTab()]);
                      setTi(0);
                      setTabMenu(null);
                    }}
                  >
                    <span className="glyph">
                      <IcoBin />
                    </span>
                    <span className="lbl">Close other tabs</span>
                  </button>
                </>
              )}
            </div>
          ) : null}

          {/* zoom flyout */}
          {zoomMenu ? (
            <div className="egMask light" onClick={() => setZoomMenu(false)}>
              <div className="egZoom" onClick={(e) => e.stopPropagation()}>
                <b>Zoom</b>
                <div className="egZoomRow">
                  <button type="button" onClick={() => setZoom(tab.zoom - 10)}>
                    −
                  </button>
                  <span>{tab.zoom}%</span>
                  <button type="button" onClick={() => setZoom(tab.zoom + 10)}>
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="egBtn wide"
                  onClick={() => {
                    setZoom(100);
                    setZoomMenu(false);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="egBtn wide"
                  onClick={() => {
                    setZoom(tab.zoom >= 100 ? 200 : 100);
                  }}
                >
                  Zoom {tab.zoom >= 100 ? "in" : "out"}
                </button>
                <button
                  type="button"
                  className="egBtn wide ghost"
                  onClick={() => {
                    dispatch({ type: wnapp.action, payload: "mxmz" });
                    setZoomMenu(false);
                  }}
                >
                  {wnapp.max ? "Exit full screen" : "Full screen"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ---------- status bar ---------- */}
        <div className="egStatus" data-on={!!status}>
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== *
 *  Native Bing results (kept from the original build)
 * ================================================================== */

/* ================================================================== *
 *  Fluent glyphs — drawn inline so nothing depends on a font
 * ================================================================== */

const S = ({ children, size = 16, ...rest }) => (
  <svg
    viewBox="0 0 20 20"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...rest}
  >
    {children}
  </svg>
);

const IcoBack = () => (
  <S>
    <path d="M12.5 4L6.5 10l6 6" />
  </S>
);
const IcoFwd = () => (
  <S>
    <path d="M7.5 4l6 6-6 6" />
  </S>
);
const IcoReload = () => (
  <S>
    <path d="M16 10a6 6 0 1 1-1.8-4.3" />
    <path d="M16 3v4h-4" />
  </S>
);
const IcoHome = () => (
  <S>
    <path d="M3.5 9.5L10 4l6.5 5.5V16a.5.5 0 0 1-.5.5h-4v-4.5H8v4.5H4a.5.5 0 0 1-.5-.5z" />
  </S>
);
const IcoLock = () => (
  <S>
    <rect x="4.5" y="8.5" width="11" height="7.5" rx="1.5" />
    <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" />
  </S>
);
const IcoWarn = () => (
  <S>
    <path d="M10 3.5l7 12.5H3z" />
    <path d="M10 8.5v3.2M10 13.8v.4" />
  </S>
);
const IcoStar = ({ filled }) => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    aria-hidden
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinejoin="round"
  >
    <path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z" />
  </svg>
);
const IcoDown = () => (
  <S>
    <path d="M10 3.5v9M6 9l4 4 4-4M4 16h12" />
  </S>
);
const IcoSpark = ({ size = 16 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden fill="none">
    <path
      d="M10 2.5l1.7 4.6 4.6 1.7-4.6 1.7L10 15.1 8.3 10.5 3.7 8.8l4.6-1.7L10 2.5z"
      fill="currentColor"
      opacity="0.9"
    />
    <path
      d="M15.8 13.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1z"
      fill="currentColor"
      opacity="0.65"
    />
  </svg>
);
const IcoDots = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden>
    <circle cx="10" cy="4.2" r="1.5" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="10" cy="15.8" r="1.5" />
  </svg>
);
const IcoCollection = () => (
  <S>
    <rect x="4" y="3.5" width="8" height="13" rx="1" />
    <path d="M15.5 6.5v10h-9" />
  </S>
);
const IcoShield = ({ on }) => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    aria-hidden
  >
    <path d="M10 2.6l6 2.2v4.6c0 4-2.6 6.7-6 7.6-3.4-.9-6-3.6-6-7.6V4.8z" />
    {on ? <path d="M7.2 10l2 2 3.6-3.8" strokeLinecap="round" strokeLinejoin="round" /> : null}
  </svg>
);
const IcoPerson = () => (
  <S>
    <circle cx="10" cy="7" r="3" />
    <path d="M4 16.5c1-3 3.2-4.5 6-4.5s5 1.5 6 4.5" />
  </S>
);
const IcoPlus = () => (
  <S>
    <path d="M10 4v12M4 10h12" />
  </S>
);
const IcoWindow = () => (
  <S>
    <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />
    <path d="M3.5 8h13" />
  </S>
);
const IcoClock = () => (
  <S>
    <circle cx="10" cy="10" r="6.5" />
    <path d="M10 6v4.2l2.8 1.8" />
  </S>
);
const IcoFind = () => (
  <S>
    <circle cx="9" cy="9" r="5" />
    <path d="M12.8 12.8L16.5 16.5" />
  </S>
);
const IcoZoom = () => (
  <S>
    <circle cx="9" cy="9" r="5" />
    <path d="M12.8 12.8L16.5 16.5M7 9h4" />
  </S>
);
const IcoPrint = () => (
  <S>
    <path d="M6 7V3.5h8V7" />
    <rect x="3.5" y="7" width="13" height="6" rx="1.2" />
    <path d="M6 13h8v3.5H6z" />
  </S>
);
const IcoPuzzle = () => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinejoin="round"
    aria-hidden
  >
    <path
      d="M8 3.5h4v2a1.9 1.9 0 1 1 0 3.8V12h2.2a1.9 1.9 0 1 1 3.8 0"
      transform="translate(-4 0.6)"
    />
    <path d="M3.6 8.2h4.2v8.2H3.6z" />
  </svg>
);
const IcoGear = () => (
  <S>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 3v1.8M10 15.2V17M3 10h1.8M15.2 10H17M5.2 5.2l1.3 1.3M13.5 13.5l1.3 1.3M14.8 5.2l-1.3 1.3M6.5 13.5l-1.3 1.3" />
  </S>
);
const IcoPin = () => (
  <S>
    <path d="M7 3.5h6l-1 4 2.5 2.5H5.5L8 7.5z" />
    <path d="M10 10v6.5" />
  </S>
);
const IcoBin = () => (
  <S>
    <path d="M4 6h12M8 6V4h4v2M6 6l1 10.5h6L14 6" />
  </S>
);
const IcoEdit = () => (
  <S>
    <path d="M4 15.5L13.5 6l2.5 2.5L6.5 18H4z" transform="translate(0 -2)" />
  </S>
);

/* edge://surf — the Let's Surf game, vendored from jackbuehner/MicrosoftEdge-Surf
   (static build, runs fully offline inside its own frame). */
const SurfPage = () => (
  <div className="egSurf">
    <iframe
      title="Let's Surf"
      className="egSurfFrame"
      src="./surf/index.html"
      allow="gamepad; fullscreen"
    />
  </div>
);

export default EdgeMenu;
