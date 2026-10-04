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

/**
 * Windows Update, for real.
 *
 * The PC is a static site, so an "update" is a new build of the same files.
 * That makes two problems the updater has to solve honestly:
 *
 *  1. THE CACHE. An update feed fetched with the browser's normal caching can
 *     be a week old, and the person never hears about a release. Every request
 *     here carries a cache-buster and `no-store`, and the feed directory is
 *     served with `Cache-Control: no-store` in public/_headers — so a check is
 *     a check, not a memory test.
 *
 *  2. THE HONEST INSTALL. There is nothing to download: the files are already
 *     on the server. Installing means throwing away every cached copy this
 *     browser holds (service worker, Cache Storage, the update feed) and
 *     reloading so the newest build is what boots. That is what "Install now"
 *     does, and the UI says so in plain words.
 *
 * Everything is a state machine with a real error taxonomy — offline, timeout,
 * 404, bad JSON, wrong schema, blocked by the browser — because "checking for
 * updates" that silently fails is worse than one that says what went wrong.
 */

import { OS, updateKind, parseVersion, compareVersion } from "./version";

/* ---------------------------------------------------------------- *
 *  Where the feed lives
 * ---------------------------------------------------------------- */

/* Relative on purpose: the same build ships to a domain root, a GitHub Pages
   sub-path and a Cloudflare Pages URL, and all three must find it. */
export const FEED_URL = "updates/feed.json";

const FEED_TIMEOUT = 12000;
const NOTES_TIMEOUT = 12000;

const SKIP_KEY = "wos.update.skip";
const LAST_CHECK_KEY = "wos.update.lastCheck";
const MUTE_UNTIL_KEY = "wos.update.muteUntil";
const HISTORY_KEY = "wos.update.history";

/* ---------------------------------------------------------------- *
 *  Tiny observable store (no redux dependency: the updater runs even
 *  when no window is open)
 * ---------------------------------------------------------------- */

const listeners = new Set();
const state = {
  status: "idle", // idle | checking | current | available | error
  update: null, // { major, build, version, kind, size, released, notes, url, channel, mandatory }
  error: null, // { code, message, hint }
  lastCheck: 0,
  skipped: null, // version string the user chose to skip
  muteUntil: 0,
  notes: null, // { markdown, error }
};

export const getUpdateState = () => ({ ...state, os: OS });

export const subscribeUpdates = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const emit = (patch) => {
  Object.assign(state, patch);
  const snap = getUpdateState();
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch (e) {}
  });
};

/* ---------------------------------------------------------------- *
 *  Persistence
 * ---------------------------------------------------------------- */

const readNum = (key) => Number(localStorage.getItem(key) || 0) || 0;

export const loadUpdatePrefs = () => {
  emit({
    lastCheck: readNum(LAST_CHECK_KEY),
    skipped: localStorage.getItem(SKIP_KEY) || null,
    muteUntil: readNum(MUTE_UNTIL_KEY),
  });
};

export const skipVersion = (version) => {
  try {
    localStorage.setItem(SKIP_KEY, String(version || ""));
  } catch (e) {}
  emit({ skipped: version || null });
};

export const clearSkip = () => {
  try {
    localStorage.removeItem(SKIP_KEY);
  } catch (e) {}
  emit({ skipped: null });
};

export const muteFor = (hours = 24) => {
  const until = Date.now() + hours * 3600 * 1000;
  try {
    localStorage.setItem(MUTE_UNTIL_KEY, String(until));
  } catch (e) {}
  emit({ muteUntil: until });
};

/** what actually got installed on this PC, newest first */
export const loadUpdateHistory = () => {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(h) ? h : [];
  } catch (e) {
    return [];
  }
};

const pushHistory = (rec) => {
  const h = loadUpdateHistory().filter((x) => x.version !== rec.version);
  h.unshift(rec);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 12)));
  } catch (e) {}
  return h;
};

/* ---------------------------------------------------------------- *
 *  Errors — named, so the UI can say something useful
 * ---------------------------------------------------------------- */

const fail = (code, message, hint = "") => {
  const error = { code, message, hint };
  emit({ status: "error", error, update: null });
  return error;
};

/* ---------------------------------------------------------------- *
 *  The cache killer
 * ---------------------------------------------------------------- */

/** A URL that no cache, proxy or service worker has ever seen. */
export const bust = (url, salt) => {
  const u = new URL(url, window.location.href);
  u.searchParams.set("cb", `${salt || Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  return u.toString();
};

const fetchFresh = async (url, { timeout = FEED_TIMEOUT, as = "json" } = {}) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(bust(url), {
      cache: "no-store",
      signal: ctrl.signal,
      credentials: "same-origin",
      headers: { Accept: as === "json" ? "application/json" : "text/plain, text/markdown, */*" },
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.code = res.status === 404 ? "not-found" : "http";
      err.status = res.status;
      throw err;
    }
    if (as === "json") return await res.json();
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

/* ---------------------------------------------------------------- *
 *  Feed validation — a feed is untrusted input, even ours
 * ---------------------------------------------------------------- */

const ALLOWED_REMOTE = [
  /^https?:\/\/([\w-]+\.)?github\.com\//i,
  /^https?:\/\/([\w-]+\.)?githubusercontent\.com\//i,
  /^https?:\/\/[\w-]+\.pages\.dev\//i,
  /^https?:\/\/([\w-]+\.)?cloudflare\.com\//i,
];

export const validateFeed = (raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "The update feed is not an object." };
  }
  const latest = raw.latest || raw;
  const text = String(latest.version || latest.tag || "");
  const parsed = parseVersion(text);
  if (!parsed) return { ok: false, reason: `"${text || "?"}" is not a version number.` };

  const size = Number(latest.size || 0);
  if (latest.size != null && (!Number.isFinite(size) || size < 0)) {
    return { ok: false, reason: "The update size is not a number." };
  }

  const url = typeof latest.url === "string" ? latest.url.trim() : "";
  if (url && !/^https?:\/\//i.test(url) && !url.startsWith("/") && !/^[\w.-]+\//.test(url)) {
    return { ok: false, reason: "The update link is not a usable address." };
  }
  if (url && /^https?:\/\//i.test(url) && !ALLOWED_REMOTE.some((re) => re.test(url))) {
    return {
      ok: false,
      reason: "The update link points somewhere this PC will not download from.",
    };
  }

  const notes = latest.notes || latest.notesFile || null;
  if (notes && (typeof notes !== "string" || !/^[\w./-]+\.md$/i.test(notes.trim()))) {
    return { ok: false, reason: "The release-notes path is not a markdown file." };
  }

  return {
    ok: true,
    feed: {
      version: text,
      ...parsed,
      kind: updateKind(parsed),
      size,
      released: typeof latest.released === "string" ? latest.released : "",
      channel: typeof latest.channel === "string" ? latest.channel : "stable",
      url,
      notes: notes ? String(notes).trim() : "",
      title: typeof latest.title === "string" ? latest.title : "",
      notesText:
        typeof latest.notesText === "string"
          ? latest.notesText
          : typeof latest.summary === "string"
            ? latest.summary
            : "",
      mandatory: latest.mandatory === true,
      media: Array.isArray(latest.media) ? latest.media.filter((m) => typeof m === "string") : [],
      highlights: Array.isArray(latest.highlights)
        ? latest.highlights.filter((h) => typeof h === "string")
        : [],
    },
  };
};

/* ---------------------------------------------------------------- *
 *  Check for updates
 * ---------------------------------------------------------------- */

export const checkForUpdates = async ({ force = false } = {}) => {
  if (state.status === "checking") return getUpdateState();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ...getUpdateState(),
      ...fail(
        "offline",
        "This PC is offline.",
        "Reconnect and try again — nothing was sent or lost.",
      ),
    };
  }

  emit({ status: "checking", error: null });

  let raw = null;
  let lastErr = null;

  /* two attempts: a flaky network should not become a scary error */
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      raw = await fetchFresh(FEED_URL);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (e?.code === "not-found") break; // retrying a 404 is pointless
      if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
    }
  }

  if (lastErr) {
    const code =
      lastErr.name === "AbortError"
        ? "timeout"
        : lastErr.code ||
          (typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network");
    const messages = {
      timeout: [
        "The update server did not answer in time.",
        "Your PC is unaffected. Try again in a moment.",
      ],
      "not-found": [
        "This build has no update feed published.",
        `Expected it at ${FEED_URL} — the release notes live beside it.`,
      ],
      http: [
        `The update server answered with ${lastErr.status || "an error"}.`,
        "Nothing was changed on this PC.",
      ],
      network: [
        "Could not reach the update server.",
        "Check the connection — your files and apps are untouched.",
      ],
      offline: ["This PC is offline.", "Reconnect and check again."],
    };
    const [message, hint] = messages[code] || [
      "The update check failed.",
      "Nothing was changed on this PC.",
    ];
    return { ...getUpdateState(), ...fail(code, message, hint) };
  }

  const v = validateFeed(raw);
  if (!v.ok) {
    return {
      ...getUpdateState(),
      ...fail(
        "bad-feed",
        "The update feed could not be read.",
        `${v.reason} This is a server-side problem; nothing on your PC changed.`,
      ),
    };
  }

  const feed = v.feed;
  const now = Date.now();
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch (e) {}

  const feedHistory = Array.isArray(raw.history) ? raw.history.slice(0, 12) : [];
  const avail = updateKind(feed) !== "none";

  emit({
    status: avail ? "available" : "current",
    update: avail ? feed : null,
    error: null,
    lastCheck: now,
    history: feedHistory,
  });
  return getUpdateState();
};

/* ---------------------------------------------------------------- *
 *  Release notes — markdown, fetched fresh, cached for offline reading
 * ---------------------------------------------------------------- */

export const loadNotes = async (path) => {
  if (!path) return null;
  emit({ notes: { loading: true } });
  try {
    const md = await fetchFresh(path, { as: "text", timeout: NOTES_TIMEOUT });
    emit({ notes: { loading: false, markdown: md, error: null } });
    return md;
  } catch (e) {
    const err =
      e?.name === "AbortError"
        ? "The release notes took too long to load."
        : e?.code === "not-found"
          ? "The release notes for this build are missing."
          : "The release notes could not be loaded.";
    emit({ notes: { loading: false, markdown: null, error: err } });
    return null;
  }
};

/* ---------------------------------------------------------------- *
 *  Install — the part that actually makes the new build appear
 * ---------------------------------------------------------------- */

export const clearAllCaches = async () => {
  const report = { caches: 0, workers: 0, storage: 0 };
  /* 1. Cache Storage (the service worker's copies of the app) */
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      report.caches = keys.length;
    }
  } catch (e) {}
  /* 2. the service worker itself, so it cannot serve yesterday's shell */
  try {
    if (navigator.serviceWorker?.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      report.workers = regs.length;
    }
  } catch (e) {}
  /* 3. the update bookkeeping, which is what would otherwise say "checked" */
  try {
    ["wos.update.feed", "wos.update.etag"].forEach((k) => localStorage.removeItem(k));
    report.storage = 1;
  } catch (e) {}
  return report;
};

export const installUpdate = async (feed, onStep = () => {}) => {
  const target = feed || state.update;
  onStep({ step: "prepare", pct: 5 });
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.update) await reg.update().catch(() => {});
  } catch (e) {}
  onStep({ step: "clear", pct: 45 });
  const report = await clearAllCaches();
  onStep({ step: "reload", pct: 90 });
  if (target) {
    pushHistory({
      version: target.version,
      major: target.major,
      build: target.build,
      kind: target.kind,
      at: Date.now(),
    });
    try {
      localStorage.setItem(LAST_CHECK_KEY, "0");
    } catch (e) {}
  }
  onStep({ step: "done", pct: 100, report });
  return report;
};

/** The reload half, kept separate so tests and the UI can call it last. */
export const reloadIntoNewBuild = (feed) => {
  const v = feed?.version || "";
  const u = new URL(window.location.href);
  u.searchParams.set("u", `${v}-${Date.now()}`);
  window.location.replace(u.toString());
};

/* ---------------------------------------------------------------- *
 *  Boot-time behaviour
 * ---------------------------------------------------------------- */

const BOOT_DELAY = 6000; // let the desktop settle first: an update check is never urgent
const CHECK_INTERVAL = 6 * 3600 * 1000; // at most one automatic check every six hours

export const shouldAutoCheck = () => {
  if (Date.now() < readNum(MUTE_UNTIL_KEY)) return false;
  const last = readNum(LAST_CHECK_KEY);
  return !last || Date.now() - last > CHECK_INTERVAL;
};

/**
 * Called once per boot by the desktop. Returns a promise that resolves with
 * the state, so a caller (or a test) can await the outcome.
 */
export const bootCheck = async (delay = BOOT_DELAY) => {
  loadUpdatePrefs();
  await new Promise((r) => setTimeout(r, delay));
  return checkForUpdates();
};

export default {
  checkForUpdates,
  bootCheck,
  installUpdate,
  loadNotes,
  clearAllCaches,
  getUpdateState,
  subscribeUpdates,
};

export { compareVersion };
