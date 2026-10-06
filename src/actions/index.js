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

import store from "../reducers";
import { dfApps } from "../utils";
import { gene_name } from "../utils/apps";
import { applyTheme, hydrateTheme, readStoredSettings, systemPrefersDark } from "../utils/os/theme";
import { notify } from "../utils/os/ui";
import {
  appForFile,
  kindOf,
  mediaBus,
  noAppToast,
  rememberExplicit,
  extOf,
} from "../utils/os/assoc";
import * as vs from "../utils/os/vs";

export const dispatchAction = (event) => {
  const action = {
    type: event.target.dataset.action,
    payload: event.target.dataset.payload,
  };

  if (action.type) {
    store.dispatch(action);
  }
};

export const refresh = (pl, menu) => {
  if (menu.menus.desk[0].opts[4].check) {
    store.dispatch({ type: "DESKHIDE" });
    setTimeout(() => store.dispatch({ type: "DESKSHOW" }), 100);
  }
};

export const changeIconSize = (size, menu) => {
  var tmpMenu = { ...menu };
  tmpMenu.menus.desk[0].opts[0].dot = false;
  tmpMenu.menus.desk[0].opts[1].dot = false;
  tmpMenu.menus.desk[0].opts[2].dot = false;
  var isize = 1;

  if (size == "large") {
    tmpMenu.menus.desk[0].opts[0].dot = true;
    isize = 1.5;
  } else if (size == "medium") {
    tmpMenu.menus.desk[0].opts[1].dot = true;
    isize = 1.2;
  } else {
    tmpMenu.menus.desk[0].opts[2].dot = true;
  }

  refresh("", tmpMenu);
  store.dispatch({ type: "DESKSIZE", payload: isize });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const deskHide = (payload, menu) => {
  var tmpMenu = { ...menu };
  tmpMenu.menus.desk[0].opts[4].check ^= 1;

  store.dispatch({ type: "DESKTOGG" });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const changeSort = (sort, menu) => {
  var tmpMenu = { ...menu };
  tmpMenu.menus.desk[1].opts[0].dot = false;
  tmpMenu.menus.desk[1].opts[1].dot = false;
  tmpMenu.menus.desk[1].opts[2].dot = false;
  if (sort == "name") {
    tmpMenu.menus.desk[1].opts[0].dot = true;
  } else if (sort == "size") {
    tmpMenu.menus.desk[1].opts[1].dot = true;
  } else {
    tmpMenu.menus.desk[1].opts[2].dot = true;
  }

  refresh("", tmpMenu);
  store.dispatch({ type: "DESKSORT", payload: sort });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const changeTaskAlign = (align, menu) => {
  var tmpMenu = { ...menu };
  if (tmpMenu.menus.task[0].opts[align == "left" ? 0 : 1].dot) return;

  tmpMenu.menus.task[0].opts[0].dot = false;
  tmpMenu.menus.task[0].opts[1].dot = false;

  if (align == "left") {
    tmpMenu.menus.task[0].opts[0].dot = true;
  } else {
    tmpMenu.menus.task[0].opts[1].dot = true;
  }

  store.dispatch({ type: "TASKTOG" });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const performApp = (act, menu) => {
  var data = {
    type: menu.dataset.action,
    payload: menu.dataset.payload,
  };

  if (act == "open") {
    if (data.type) store.dispatch(data);
  } else if (act == "delshort") {
    if (data.type) {
      // match by action ALONE — the old filter also matched every app whose
      // payload happened to equal this one, and apps[arrayOfKeys] is
      // undefined, so the delete silently did nothing
      var apps = store.getState().apps;
      var key = Object.keys(apps).find((x) => apps[x] && apps[x].action == data.type);
      var name = (key && apps[key].name) || menu?.dataset?.name;
      if (name) {
        store.dispatch({ type: "DESKREM", payload: name });
        notify({
          app: "Desktop",
          icon: "img/icon/explorer.png",
          title: "Shortcut removed",
          body: `${name} is off the desktop — the app itself stays installed.`,
          kind: "success",
          life: 4,
        });
      }
    }
  }
};

/**
 * Uninstall a Store app.  The list of installed apps lives in BOTH
 * localStorage (read at boot) and the IndexedDB `installed` store, so
 * both have to be cleaned or the app comes back after a reload.
 */
export const delApp = (act, menu) => {
  const data = {
    type: menu?.dataset?.action,
    payload: menu?.dataset?.payload,
  };
  if (act != "delete" || !data.type) return;

  const apps = store.getState().apps;
  let icon = Object.keys(apps).find((x) => apps[x].action == data.type);
  if (!icon && data.payload && apps[data.payload]) icon = data.payload; // stale action after reload → payload is the icon
  if (!icon) return;
  const app = apps[icon];
  if (!app.pwa) {
    notify({
      app: app.name || icon,
      icon: "img/icon/settings.png",
      title: "Part of WebOS",
      body: `${app.name || icon} comes with the PC and can't be uninstalled.`,
      kind: "info",
      life: 5,
    });
    return;
  }

  store.dispatch({ type: app.action, payload: "close" });
  store.dispatch({ type: "DELAPP", payload: app.icon });
  store.dispatch({ type: "DESKREM", payload: app.name });

  // localStorage list
  let installed = [];
  try {
    installed = JSON.parse(localStorage.getItem("installed") || "[]");
  } catch (e) {}
  localStorage.setItem(
    "installed",
    JSON.stringify(installed.filter((x) => x.icon != app.icon && x.name != app.name)),
  );

  // IndexedDB mirror
  import("../utils/idb").then(({ idb }) => idb.delete("installed", app.icon)).catch(() => {});

  notify({
    app: "Microsoft Store",
    icon: "img/icon/store.png",
    title: "Uninstalled",
    body: `${app.name} was removed from this PC.`,
    kind: "success",
    life: 4,
  });
};

/**
 * Boot-time reconcile of installed PWAs.  IndexedDB is the source of truth
 * (the mandated Virtual Storage); localStorage is the fast cache.  The union
 * of both lands in the store, so an installed app can never "go missing"
 * after a refresh — even if one copy of the list was cleared or half-written.
 */
export const restoreInstalled = async () => {
  let ls = [];
  try {
    ls = JSON.parse(localStorage.getItem("installed") || "[]") || [];
  } catch (e) {}
  ls = ls.filter((a) => a && a.name && a.icon);

  let db = [];
  try {
    const { idb } = await import("../utils/idb");
    db = ((await idb.getAll("installed")) || []).filter((a) => a && a.name && a.icon);
  } catch (e) {}

  const byIcon = new Map();
  [...ls, ...db].forEach((a) => byIcon.set(a.icon, { ...byIcon.get(a.icon), ...a }));
  const merged = [...byIcon.values()];
  if (!merged.length) return 0;

  const state = store.getState().apps;
  let recovered = 0;
  for (const app of merged) {
    if (!state[app.icon]) {
      // recovered from IndexedDB only — give it a fresh session action
      const fresh = { ...app, action: app.action || gene_name(), pwa: true };
      store.dispatch({ type: "ADDAPP", payload: fresh });
      recovered++;
      // put it back on the desktop where it belonged
      const deskNow = store.getState().desktop;
      if (!deskNow.apps.some((x) => x.name === fresh.name)) {
        store.dispatch({ type: "DESKADD", payload: fresh });
      }
    }
  }
  try {
    localStorage.setItem("installed", JSON.stringify(merged));
    const { idb } = await import("../utils/idb");
    await idb.bulkReplace("installed", merged).catch(() => {});
  } catch (e) {}
  return recovered;
};

/**
 * Install an app from the Store.  Writes the app into both stores and
 * drops it on the desktop, exactly like the real Microsoft Store.
 */
export const installApp = (data) => {
  const app = { ...data, type: data.type || "app", pwa: true };
  app.action = gene_name();
  /* the Library sorts and groups by these two, so they are recorded once,
     here, instead of being guessed from a name later */
  app.installedAt = data.installedAt || Date.now();
  if (!app.publisher) app.publisher = "WebOS Store";
  if (!app.category) app.category = "Community picks";

  let installed = [];
  try {
    installed = JSON.parse(localStorage.getItem("installed") || "[]");
  } catch (e) {}
  installed = installed.filter((x) => x.name != app.name);
  installed.push(app);
  localStorage.setItem("installed", JSON.stringify(installed));

  let desk = dfApps.desktop;
  try {
    desk = JSON.parse(localStorage.getItem("desktop") || "null") || dfApps.desktop;
  } catch (e) {}
  if (!desk.includes(app.name)) desk = [...desk, app.name];
  localStorage.setItem("desktop", JSON.stringify(desk));

  import("../utils/idb").then(({ idb }) => idb.put("installed", { ...app })).catch(() => {});

  store.dispatch({ type: "ADDAPP", payload: app });
  store.dispatch({ type: "DESKADD", payload: app });
  store.dispatch({ type: "WNSTORE", payload: "mnmz" });

  notify({
    app: "Microsoft Store",
    icon: "img/icon/store.png",
    title: "Installed",
    body: `${app.name} is ready — it was also pinned to your desktop.`,
    kind: "success",
    life: 4.5,
    actions: [
      { label: "Open", onClick: () => store.dispatch({ type: app.action, payload: "full" }) },
    ],
  });
};

export const getTreeValue = (obj, path) => {
  if (path == null) return false;

  var tdir = { ...obj };
  path = path.split(".");
  for (var i = 0; i < path.length; i++) {
    tdir = tdir[path[i]];
  }

  return tdir;
};

/**
 * Set (or toggle) the theme.
 * `changeTheme("dark")` always ends up dark — no more "toggle from whatever
 * the store happened to hold", which is what lost the theme across reloads.
 */
export const changeTheme = (theme) => {
  const next = applyTheme(store, theme);
  notify({
    app: "Settings",
    icon: "img/icon/settings.png",
    title: `${next === "dark" ? "Dark" : "Light"} theme applied`,
    body: "Your choice is saved on this PC.",
    kind: "success",
    life: 3,
  });
  return next;
};

/** Explicitly set the theme without announcing it. */
export const setTheme = (theme) => applyTheme(store, theme);

/* --- same-origin relay helpers (probe once, then cache) ------------- */
let __relayState = ""; // "", "yes", "no"
const relayAvailable = async () => {
  if (__relayState) return __relayState === "yes";
  try {
    const r = await fetch(
      "/webos-proxy?url=" + encodeURIComponent("https://www.google.com/generate_204"),
      { method: "GET" },
    );
    __relayState = r.ok ? "yes" : "no";
  } catch (e) {
    __relayState = "no";
  }
  return __relayState === "yes";
};
export const fetchViaRelay = async (url, as = "text") => {
  try {
    if (!(await relayAvailable())) return null;
    const r = await fetch("/webos-proxy?url=" + encodeURIComponent(url));
    if (!r.ok) return null;
    return as === "json" ? await r.json() : await r.text();
  } catch (e) {
    return null;
  }
};

/* widget weather: WMO code → glyph + words (open-meteo, free & keyless) */
const WX_RAIN = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
const WX_SNOW = [71, 73, 75, 77, 85, 86];
const WX_FOG = [45, 48];
const WX_CLD = [1, 2, 3];
export const wxGlyph = (c) =>
  WX_RAIN.includes(c)
    ? "rain"
    : WX_SNOW.includes(c)
      ? "snow"
      : WX_FOG.includes(c)
        ? "fog"
        : WX_CLD.includes(c)
          ? "cloud"
          : "sun";
export const wxText = (c) => {
  if (c === 0) return "Clear sky";
  if (WX_CLD.includes(c)) return c === 1 ? "Mainly clear" : c === 2 ? "Partly cloudy" : "Overcast";
  if (WX_FOG.includes(c)) return "Foggy";
  if ([51, 53, 55].includes(c)) return "Drizzle";
  if ([61, 63, 65].includes(c)) return "Rain";
  if ([80, 81, 82].includes(c)) return "Rain showers";
  if (WX_SNOW.includes(c)) return "Snow";
  if ([95, 96, 99].includes(c)) return "Thunderstorm";
  return "Weather";
};

export const loadWidget = async () => {
  if (!navigator.onLine) return;
  var tmpWdgt = {
      ...store.getState().widpane,
      data: {...store.getState().widpane.data},
    },
    date = new Date();

  /* — LIVE weather: open-meteo (fully free, no key), Patna home base — */
  try {
    const wx = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=25.5941&longitude=84.8526&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4",
      { cache: "no-store" },
    ).then((r) => r.json());
    if (wx?.current) {
      const code = wx.current.weather_code | 0;
      tmpWdgt.data.weather = {
        city: "Patna",
        country: "IN",
        temp: Math.round(wx.current.temperature_2m),
        glyph: wxGlyph(code),
        wstate: wxText(code),
        rain: wx.current.relative_humidity_2m ?? 0,
        wind: Math.round(wx.current.wind_speed_10m) + " km/h",
        days: (wx.daily?.time || []).slice(0, 4).map((t, i) => ({
          day: new Date(t + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
          min: Math.round(wx.daily.temperature_2m_min[i]),
          max: Math.round(wx.daily.temperature_2m_max[i]),
          glyph: wxGlyph(wx.daily.weather_code[i] | 0),
        })),
      };
    }
  } catch (e) {
    /* the seeded fallback keeps the card honest offline */
  }

  /* — LIVE news: Wikinews latest (CORS-open, no key) — */
  try {
    const j = await fetch(
      "https://en.wikinews.org/w/api.php?action=parse&page=Template:Latest_news&prop=text&format=json&origin=*",
      { cache: "no-store" },
    ).then((r) => r.json());
    const html = j?.parse?.text?.["*"] || "";
    const dom = new DOMParser().parseFromString(html, "text/html");
    const items = [...dom.querySelectorAll("li")]
      .map((li) => ({
        title: (li.textContent || "").trim(),
        url: "https://en.wikinews.org" + (li.querySelector("a")?.getAttribute("href") || ""),
        source: { name: "Wikinews" },
      }))
      .filter((x) => x.title.length > 12 && !x.url.endsWith("/"))
      .slice(0, 12);
    if (items.length >= 3) tmpWdgt.data.news = items;
  } catch (e) {
    /* bundled fallback stays */
  }

  // console.log('fetching ON THIS DAY');
  var wikiurl = "https://en.wikipedia.org/api/rest_v1/feed/onthisday/events";
  var data = await fetchViaRelay(`${wikiurl}/${date.getMonth() + 1}/${date.getDate()}`, "json");
  if (data) {
    // live entries can come back with an empty pages array — only pick
    // ones that actually link somewhere, or the widget crashes at boot
    var evs = (data.events || []).filter((e) => e.pages && e.pages.length);
    if (!evs.length) { store.dispatch({type: "WIDGREST", payload: tmpWdgt}); return; }
    var event = evs[Math.floor(Math.random() * evs.length)];
    date.setYear(event.year);

    tmpWdgt.data.date = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    tmpWdgt.data.event = event;
  }

  // News comes from Wikinews above; when that call fails (offline, CORS,
  // the widget being opened on a static host with no relay) the bundled
  // edition stays in place. There is deliberately no third-party news cache
  // here — the OS ships no dependency on anyone else's server.

  store.dispatch({
    type: "WIDGREST",
    payload: tmpWdgt,
  });
};

export const loadSettings = () => {
  // readStoredSettings() deep merges storage over the defaults, so a partial
  // blob (the OOBE used to write one) can never leave person.theme undefined.
  const sett = readStoredSettings();

  // Only fall back to the OS preference when nothing was ever chosen.
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem("setting") || "null");
  } catch (e) {}
  if (!raw?.person?.theme && systemPrefersDark()) sett.person.theme = "dark";

  hydrateTheme(store, sett);
  store.dispatch({ type: "SETTLOAD", payload: sett });

  // Live widgets fetch only when explicitly opened, never on boot/login.
};

/**
 * Double-click in File Explorer. Folders navigate, everything else is handed
 * to the app that owns its extension — with the real VS path attached so the
 * app can Save back to the same place.
 */
/* one live object URL at a time: opening another local page releases the
   previous blob instead of leaking it for the life of the tab */
let lastBlob = "";
const releaseBlob = () => {
  if (!lastBlob) return;
  try {
    URL.revokeObjectURL(lastBlob);
  } catch (e) {}
  lastBlob = "";
};

export const handleFileOpen = (id) => {
  const files = store.getState().files;
  const item = files.data.getId(id);
  if (item == null) return;
  if (item.type == "folder") {
    store.dispatch({ type: "FILEDIR", payload: item.id });
    return;
  }

  const name = item.name || "Untitled.txt";
  let path = "";
  try {
    path = vs.pathOf(item);
  } catch (e) {
    try {
      path = files.data.getPath(item.id);
    } catch (e2) {}
  }

  openFileWith(appForFile(name), { ...item, name, path });
};

/** Open a file with a named app.

    Every entry point (double-click here, File Explorer, the desktop, Start,
    "Open with") funnels through this, so there is exactly one place that
    knows which app owns which extension — and one place to fix when it is
    wrong. The hand-off is honest: an app that cannot show the file says so
    instead of opening an empty window. */
export const openFileWith = (appKey, item, opts = {}) => {
  const explicit = !!opts.explicit;
  if (!item) return;
  /* a hand-picked app is what "Always use …" should then offer */
  if (explicit) rememberExplicit(item.name, appKey);
  const name = item.name || "Untitled.txt";
  const path = item.path || "";
  const ext = extOf(name);
  const binary = vs.isBinaryRecord(item.data);
  const text = binary
    ? `[Binary file — ${vs.bytes(item.size || 0)}]\n\n${name} holds ${item.mime || "binary"} data, so Notepad can only show you this placeholder. Open it with the app that owns its type.`
    : typeof item.data === "string"
      ? item.data
      : String(item.data?.content ?? "");

  switch (appKey) {
    case "photos":
      store.dispatch({ type: "PHOTOSAPP", payload: "full" });
      store.dispatch({ type: "PHOTOOPEN", payload: { path, name, data: item.data } });
      return;

    case "paint":
      store.dispatch({ type: "OPENPAINT", payload: { path, name } });
      return;

    case "whiteboard":
      store.dispatch({ type: "WHITEBOARD", payload: "full" });
      store.dispatch({ type: "OPENBOARD", payload: { path, name } });
      return;

    case "groove":
      /* hand the file over, then raise the app — the player picks it up and
         starts it, whether it was already running or not */
      mediaBus.send("audio", { path, name });
      store.dispatch({ type: "GROOVEAPP", payload: "full" });
      notify({
        app: "File Explorer",
        icon: "img/icon/explorer.png",
        title: "Opening in Groove Music",
        body: name,
        kind: "info",
        life: 3.5,
      });
      return;

    case "movies":
      mediaBus.send("video", { path, name });
      store.dispatch({ type: "MOVIESAPP", payload: "full" });
      notify({
        app: "File Explorer",
        icon: "img/icon/explorer.png",
        title: "Opening in Movies & TV",
        body: name,
        kind: "info",
        life: 3.5,
      });
      return;

    case "edge": {
      /* a real page: local HTML opens as a blob so its scripts and styles are
         live, anything else is shown as text by the browser's own engine */
      if (kindOf(name) === "web") {
        try {
          const html = typeof item.data === "string" ? item.data : String(item.data?.content ?? "");
          const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
          /* the tab is titled with the file, and the old blob is released so
             a browsing session cannot pile up dead documents */
          releaseBlob();
          lastBlob = url;
          store.dispatch({ type: "EDGELINK", payload: { url, title: name } });
        } catch (e) {
          store.dispatch({ type: "OPENTXT", payload: { name, text, path } });
        }
        return;
      }
      store.dispatch({ type: "OPENTXT", payload: { name, text, path } });
      return;
    }

    case "notepad":
    default: {
      const kind = kindOf(name);
      const hasText = typeof item.data === "string" && item.data.length > 0;
      /* A program or a packed archive is not a text document, whatever bytes
         happen to sit in it — showing "MZ" as a note is not opening the file.
         Those two say so out loud; "Open with → Notepad" stays available for
         anyone who wants to look inside. Only a genuinely unknown type may
         fall through to the text view, and then only when it holds text. */
      const noAppHere =
        ["program", "archive"].includes(kind) || (kind === "unknown" && !hasText && !binary);
      if (!explicit && noAppHere) {
        noAppToast(name);
        return;
      }
      store.dispatch({ type: "OPENTXT", payload: { name, text, path } });
      return;
    }
  }
};

export const flightMode = () => {
  store.dispatch({ type: "TOGGAIRPLNMD", payload: "" });
};

/* ---- right-click: create a real item on the Desktop folder ---- */
const deskNew = (mkType, name) => {
  store.dispatch({ type: "FILEPATH", payload: "%desktop%", onFail: () => {} });
  setTimeout(() => {
    // pin cdir to the Desktop node at the last moment — anything that
    // re-navigated in between must not steal the new item
    const deskId = store.getState().files.data?.special?.["%desktop%"];
    if (deskId) store.dispatch({ type: "FILEDIR", payload: deskId });
    store.dispatch({ type: mkType, payload: name });
    store.dispatch({ type: "EXPLORER", payload: "full" });
    notify({
      app: "Desktop",
      icon: "img/icon/explorer.png",
      title: `${name} created`,
      body: "It is on your desktop now — double-click it to open.",
      kind: "success",
      life: 4,
    });
  }, 40);
};

/* ---- right-click on a desktop FILE item (from the Desktop folder) ---- */
export const performFileOpen = (pl, menu) => {
  const id = menu?.dataset?.fileid;
  if (!id) return;
  handleFileOpen(id);
};

export const fileMenuDel = (pl, menu) => {
  const id = menu?.dataset?.fileid;
  if (!id) return;
  store.dispatch({ type: "FILEDEL", payload: [id] });
  notify({
    app: "Desktop",
    icon: "img/icon/explorer.png",
    title: "Moved to Recycle Bin",
    body: "The item is off your desktop.",
    kind: "success",
    life: 3,
  });
};

export const fileProps = (pl, menu) => {
  const id = menu?.dataset?.fileid;
  const node = id ? store.getState().files.data?.getId(id) : null;
  if (!node) return;
  const kb = Math.max(1, Math.round((node.size || 0) / 1024));
  notify({
    app: node.name || "Item",
    icon: "img/icon/explorer.png",
    title: `${node.name} — Properties`,
    body: `${node.type === "folder" ? "Folder" : "File"} · ${node.type === "folder" ? (node.data || []).length + " items" : kb + " KB"} · stored on this PC (Virtual Storage).`,
    kind: "info",
    life: 6,
  });
};

export const newDeskFolder = () => deskNew("FILEMKDIR", "New folder");
export const newDeskText = () => deskNew("FILEMKFILE", "New Text Document.txt");

/* ---- taskbar icon right-click: pin a copy to the desktop ---- */
export const pinToDesk = (pl, menu) => {
  const key = tileAppName(menu);
  const apps = store.getState().apps;
  if (!key || !apps[key]) return;
  const name = apps[key].name || key;
  const desk = store.getState().desktop;
  if (desk.apps.some((x) => x.name === name)) {
    notify({
      app: "Desktop",
      icon: "img/icon/explorer.png",
      title: "Already on the desktop",
      body: `${name} has a desktop shortcut.`,
      kind: "info",
      life: 4,
    });
    return;
  }
  store.dispatch({ type: "DESKADD", payload: name });
  notify({
    app: "Desktop",
    icon: "img/icon/explorer.png",
    title: "Pinned to desktop",
    body: `${name} now has a desktop shortcut.`,
    kind: "success",
    life: 4,
  });
};

export const unpinFromDesk = (pl, menu) => {
  const key = tileAppName(menu);
  const apps = store.getState().apps;
  const name = key ? apps[key]?.name : menu?.dataset?.name;
  if (!name) return;
  store.dispatch({ type: "DESKREM", payload: name });
  notify({
    app: "Desktop",
    icon: "img/icon/explorer.png",
    title: "Shortcut removed",
    body: `${name} is off the desktop — the app itself stays installed.`,
    kind: "success",
    life: 4,
  });
};

export const uninstallTaskApp = (act, menu) => {
  const key = tileAppName(menu);
  const apps = store.getState().apps;
  const app = key ? apps[key] : null;
  if (!app) return;
  if (!app.pwa) {
    notify({
      app: app.name || key,
      icon: "img/icon/settings.png",
      title: "Part of WebOS",
      body: `${app.name || key} comes with the PC and can't be uninstalled.`,
      kind: "info",
      life: 5,
    });
    return;
  }
  delApp("delete", menu);
};

/* ---- right-click on a taskbar icon ---- */
export const performTaskApp = (act, menu) => {
  var type = menu.dataset.action;
  if (!type) return;
  if (act == "open") {
    store.dispatch({ type: type, payload: "full" });
  } else if (act == "close") {
    store.dispatch({ type: type, payload: "close" });
  }
};

/* ---- app tile right-click helpers ---- */
const tileAppName = (menu) => {
  var type = menu.dataset.action;
  var apps = store.getState().apps;
  var key = Object.keys(apps).find(
    (x) => x != "hz" && apps[x] && (apps[x].action == type || apps[x].icon == menu.dataset.icon),
  );
  return key || null;
};

export const openAppLocation = (pl, menu) => {
  store.dispatch({ type: "FILEPATH", payload: "%user%\\Desktop", onFail: () => {} });
  store.dispatch({ type: "EXPLORER", payload: "full" });
};

export const unpinApp = (pl, menu) => {
  var key = tileAppName(menu);
  if (!key) return;
  var apps = store.getState().apps;
  store.dispatch({ type: "STARTUNPIN", payload: apps[key].name || key });
};

export const appProps = (pl, menu) => {
  var key = tileAppName(menu);
  var apps = store.getState().apps;
  if (!key) return;
  var a = apps[key];
  notify({
    app: a.name || key,
    icon: a.icon ? "img/icon/" + a.icon + ".png" : "img/icon/explorer.png",
    title: (a.name || key) + " — Properties",
    body: "Type: WebOS application · Runs entirely on this PC · No installer, no uninstaller needed.",
    kind: "info",
    life: 6,
  });
};
