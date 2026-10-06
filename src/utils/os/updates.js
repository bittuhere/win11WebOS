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

/** Network-only update discovery; staged offline installation; confirm history after boot. */
import { waitForInstall, activateWorker, workerVersion } from "./offline";
import { OS, updateKind, parseVersion, compareVersion } from "./version";

/* ---------------------------------------------------------------- *
 *  Where the feed lives
 * ---------------------------------------------------------------- */

// GitHub is the authoritative discovery source. Never cache/fall back to an old
// bundled feed and falsely report "current" after a failed remote check.
export const UPDATE_PUBLIC_URL = "https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/";
export const FEED_URL = `${UPDATE_PUBLIC_URL}updates/feed.json`;

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

const readNum = (key) => { try { return Number(localStorage.getItem(key) || 0) || 0; } catch { return 0; } };

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

/** Unique request URL; provider/CDN propagation remains outside this app's control. */
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
    if (as === "json") {
      try { return await res.json(); }
      catch { const error = new Error("The server did not return valid JSON."); error.code = "bad-feed"; throw error; }
    }
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
  if (raw.feed != null && raw.feed !== 1) return {ok: false, reason: "Unsupported update feed format."};
  const latest = raw.latest || raw;
  if (!latest || typeof latest !== "object" || Array.isArray(latest)) return {ok: false, reason: "The latest release is not an object."};
  const text = String(latest.version || latest.tag || "");
  const parsed = parseVersion(text);
  if (!parsed || !/^v?\d+\.\d+(?:\.\d+)?$/.test(text) || !Number.isSafeInteger(parsed.major) || !Number.isSafeInteger(parsed.build)) return { ok: false, reason: `"${text || "?"}" is not a version number.` };

  if ((latest.major != null && latest.major !== parsed.major) || (latest.build != null && latest.build !== parsed.build)) {
    return {ok: false, reason: "Version and major/build fields disagree."};
  }
  if (raw.channel && raw.channel !== OS.channel) return {ok: false, reason: "The feed is for a different release channel."};
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
  if (notes && (typeof notes !== "string" || !/^updates\/notes\/[\w.-]+\.md$/i.test(notes.trim()))) {
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
      status: "error",
      error: fail(
        "offline",
        "This PC is offline.",
        "Reconnect and try again — nothing was sent or lost.",
      ),
    };
  }

  emit({ status: "checking", error: null, update: null });
  try { localStorage.setItem("wos.update.lastAttempt", String(Date.now())); } catch {}

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
      if (["not-found", "bad-feed"].includes(e?.code)) break; // deterministic server errors need correction, not repeated requests
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
      "bad-feed": ["The update feed could not be read.", "The server returned invalid JSON. No files were changed; try again after the feed is corrected."],
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
    fail(code, message, hint);
    return getUpdateState();
  }

  const v = validateFeed(raw);
  if (!v.ok) {
    return {
      ...getUpdateState(),
      status: "error",
      error: fail(
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

// Installed notes stay local/offline. Offered future notes come from the same
// repository as the feed (they may not exist in the deployed app yet).
export const resolveNotesUrl = (path) => {
  if (typeof path !== "string" || !/^updates\/notes\/[\w.-]+\.md$/i.test(path)) throw new Error("Invalid release-notes path.");
  const installed = `updates/notes/${OS.major}.${String(OS.build).padStart(2, "0")}.md`;
  return path === installed ? path : new URL(path, UPDATE_PUBLIC_URL).href;
};
let notesRequest = 0;
export const loadNotes = async (path) => {
  if (!path) return null;
  const request = ++notesRequest;
  const publish = notes => { if (request === notesRequest) emit({ notes }); };
  publish({ loading: true, markdown: null, error: null });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOTES_TIMEOUT);
  try {
    const url = resolveNotesUrl(path);
    const remote = url.startsWith("https:");
    const response = await fetch(remote ? bust(url) : url, {
      signal: controller.signal, cache: remote ? "no-store" : "default",
      credentials: remote ? "omit" : "same-origin",
    });
    if (!response.ok) throw new Error(response.status === 404 ? "The release notes have not been published yet." : `Release-notes server returned HTTP ${response.status}.`);
    const md = await response.text();
    if (/^\s*(?:<!doctype html|<html)/i.test(md)) throw new Error("The server returned a web page instead of release notes.");
    publish({ loading: false, markdown: md, error: null });
    return md;
  } catch (error) {
    publish({ loading: false, markdown: null, error: error?.name === "AbortError" ? "The release notes took too long to load. Try again." : error.message || "The release notes could not be loaded." });
    return null;
  } finally { clearTimeout(timer); }
};

/* ---------------------------------------------------------------- *
 *  Install — the part that actually makes the new build appear
 * ---------------------------------------------------------------- */

// Do not delete origin-wide caches or unregister workers. Other apps may share this origin.
let installing = false;
export const installUpdate = async (feed, onStep = () => {}) => {
  if (installing) return null;
  installing = true;
  const target = feed || state.update;
  try {
    if (!target || updateKind(target) === "none") throw new Error("There is no newer version to install.");
    if (!navigator.onLine) throw new Error("Reconnect before installing. Your current offline build is safe.");
    if (!navigator.serviceWorker) throw new Error("Updates require HTTPS and service-worker support.");
    onStep({step: "prepare", pct: 0});
    const scope = new URL("./", document.baseURI).href;
    let reg = await navigator.serviceWorker.getRegistration(scope);
    if (reg?.scope !== scope) reg = null;
    if (!reg) reg = await navigator.serviceWorker.register(new URL("sw.js", scope), {scope, updateViaCache: "none"});
    else await reg.update();
    const worker = await waitForInstall(reg, p => onStep({step: "download", pct: p.pct}));
    const version = await workerVersion(worker);
    if (!version || compareVersion(version, target) < 0) throw new Error("The feed is newer than the deployed files. Wait for deployment to finish, then retry.");
    try { localStorage.setItem("wos.update.pending", JSON.stringify({...target, ...version})); } catch {}
    onStep({step: "reload", pct: 100});
    await activateWorker(worker);
    onStep({step: "done", pct: 100});
    return {ok: true};
  } catch (error) {
    fail("install", "The update was not installed.", error.message);
    onStep({step: "error", pct: 0, message: error.message});
    return {ok: false, error: error.message};
  } finally { installing = false; }
};

export function confirmInstalledBuild() {
  try {
    const pending = JSON.parse(localStorage.getItem("wos.update.pending") || "null");
    if (pending && compareVersion(OS, pending) >= 0) {
      pushHistory({version: `v${OS.major}.${String(OS.build).padStart(2, "0")}`, major: OS.major, build: OS.build, kind: pending.kind, at: Date.now()});
      localStorage.removeItem("wos.update.pending");
      localStorage.removeItem(SKIP_KEY);
    }
  } catch {}
}

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

const BOOT_DELAY = 15000; // only called after a successful sign-in

// Boot deduplication belongs to the desktop lifecycle, not persisted timestamps:
// a second boot today must still check. Last-check timestamps are display history.
export const shouldAutoCheck = () =>
  Date.now() >= readNum(MUTE_UNTIL_KEY) && state.status !== "checking";

/**
 * Called once per boot by the desktop. Returns a promise that resolves with
 * the state, so a caller (or a test) can await the outcome.
 */
export const bootCheck = async (delay = BOOT_DELAY) => {
  loadUpdatePrefs();
  await new Promise((r) => setTimeout(r, delay));
  return shouldAutoCheck() ? checkForUpdates() : getUpdateState();
};

export default {
  checkForUpdates,
  bootCheck,
  installUpdate,
  loadNotes,
  getUpdateState,
  subscribeUpdates,
};

export { compareVersion };
