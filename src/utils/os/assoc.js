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

/* ==================================================================
   File associations — one table, used by everything.

   Double-click in File Explorer, the desktop, the Start menu's
   recommended files and "Open with" all resolve through `appForFile`,
   so a .mp4 opens in Movies everywhere or nowhere — never one app in
   one place and a toast in another.

   Users can override any extension ("Always open .txt with …"): the
   choice is stored per extension in localStorage and wins over the
   built-in table for that PC only, exactly like Windows' "Open with →
   Always use this app". "Reset" forgets the override.
   ================================================================== */

import { notify } from "./ui";

export const ASSOC_KEY = "wos.fileAssoc";

/* The apps a file can be handed to. `key` is what gets stored. */
export const APPS = {
  notepad: {
    key: "notepad",
    label: "Notepad",
    icon: "img/icon/notepad.png",
    action: "OPENTXT",
    kind: "text",
  },
  photos: {
    key: "photos",
    label: "Photos",
    icon: "img/icon/photos.png",
    action: "PHOTOSAPP",
    kind: "image",
  },
  paint: {
    key: "paint",
    label: "Paint",
    icon: "img/icon/paint.png",
    action: "OPENPAINT",
    kind: "image",
  },
  groove: {
    key: "groove",
    label: "Groove Music",
    icon: "img/icon/groove.png",
    action: "GROOVEAPP",
    kind: "audio",
  },
  movies: {
    key: "movies",
    label: "Movies & TV",
    icon: "img/icon/movies.png",
    action: "MOVIESAPP",
    kind: "video",
  },
  edge: {
    key: "edge",
    label: "Browser",
    icon: "img/icon/edge.png",
    action: "EDGELINK",
    kind: "web",
  },
};

/* Which applications can open each kind — the "Open with" shortlist. */
export const BY_KIND = {
  image: ["photos", "paint", "notepad"],
  audio: ["groove", "notepad"],
  video: ["movies", "notepad"],
  web: ["edge", "notepad"],
  board: ["whiteboard", "notepad"],
  text: ["notepad", "edge"],
  font: ["notepad"],
  archive: ["notepad"],
  program: [],
  unknown: ["notepad"],
};

/* The extension table. Deliberately generous: anything a person can
   reasonably produce in a browser OS has a home, and everything textual
   falls back to Notepad rather than to nothing. */
const EXT_KIND = {
  /* images */
  png: "image",
  jpg: "image",
  jpeg: "image",
  jfif: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  svg: "image",
  ico: "image",
  avif: "image",
  tif: "image",
  tiff: "image",
  heic: "image",
  heif: "image",

  /* audio */
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  opus: "audio",
  weba: "audio",
  mid: "audio",
  aiff: "audio",

  /* video */
  mp4: "video",
  m4v: "video",
  webm: "video",
  mkv: "video",
  mov: "video",
  avi: "video",
  ogv: "video",
  mpg: "video",
  mpeg: "video",
  "3gp": "video",
  ts: "video",

  /* the browser owns these */
  html: "web",
  htm: "web",
  xhtml: "web",
  mht: "web",
  mhtml: "web",
  shtml: "web",

  /* whiteboards */
  wb: "board",

  /* documents and code — all Notepad */
  txt: "text",
  text: "text",
  log: "text",
  md: "text",
  markdown: "text",
  rst: "text",
  json: "text",
  jsonc: "text",
  json5: "text",
  ndjson: "text",
  js: "text",
  mjs: "text",
  cjs: "text",
  jsx: "text",
  tsm: "text",
  tsx: "text",
  css: "text",
  scss: "text",
  sass: "text",
  less: "text",
  xml: "text",
  yaml: "text",
  yml: "text",
  toml: "text",
  ini: "text",
  cfg: "text",
  conf: "text",
  env: "text",
  csv: "text",
  tsv: "text",
  sql: "text",
  py: "text",
  rb: "text",
  go: "text",
  rs: "text",
  java: "text",
  kt: "text",
  swift: "text",
  c: "text",
  h: "text",
  cpp: "text",
  hpp: "text",
  cc: "text",
  cs: "text",
  php: "text",
  sh: "text",
  bash: "text",
  zsh: "text",
  bat: "text",
  cmd: "text",
  ps1: "text",
  vue: "text",
  svelte: "text",
  astro: "text",
  lua: "text",
  pl: "text",
  r: "text",
  dart: "text",
  srt: "text",
  vtt: "text",
  ass: "text",
  nfo: "text",
  readme: "text",
  license: "text",
  gitignore: "text",
  editorconfig: "text",
  properties: "text",
  gradle: "text",
  dockerfile: "text",
  makefile: "text",
  patch: "text",
  diff: "text",

  /* things this PC genuinely cannot run — the honest answer, not a wrong app */
  exe: "program",
  msi: "program",
  lnk: "program",
  dll: "program",
  sys: "program",
  com: "program",
  scr: "program",
  apk: "program",
  dmg: "program",
  deb: "program",
  rpm: "program",

  /* files with no viewer here yet */
  pdf: "unknown",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  xz: "archive",
  iso: "archive",
  psd: "unknown",
  ai: "unknown",
  eps: "unknown",
  ttf: "font",
  otf: "font",
  woff: "font",
  woff2: "font",
  eot: "font",
  db: "unknown",
  sqlite: "unknown",
};

export const extOf = (name) => {
  const n = String(name || "");
  const i = n.lastIndexOf(".");
  if (i < 0 || i === n.length - 1) return "";
  return n.slice(i + 1).toLowerCase();
};

export const kindOf = (name) => EXT_KIND[extOf(name)] || "unknown";

/** The app this PC would use for a file, override included. Never null:
 *  anything unrecognised still has an honest home (Notepad, or "no app"). */
export const appForFile = (name) => {
  const ext = extOf(name);
  const over = overrides()[ext];
  if (over && APPS[over]) {
    // an override for an image does not make sense for a video — but the
    // user asked for it, so it wins; only a nonsensical *missing* app falls back
    return over;
  }
  const kind = kindOf(name);
  return BY_KIND[kind]?.[0] || "notepad";
};

/* ---------------- the per-PC overrides ---------------- */

export const overrides = () => {
  try {
    const raw = localStorage.getItem(ASSOC_KEY);
    const o = raw ? JSON.parse(raw) : null;
    return o && typeof o === "object" ? o : {};
  } catch (e) {
    return {};
  }
};

export const setOverride = (ext, appKey) => {
  const e = String(ext || "").toLowerCase();
  if (!e) return;
  const o = { ...overrides() };
  if (!appKey) delete o[e];
  else o[e] = appKey;
  try {
    localStorage.setItem(ASSOC_KEY, JSON.stringify(o));
  } catch (err) {}
  window.dispatchEvent(new Event("wos:assocChanged"));
  return o;
};

export const clearOverrides = () => {
  try {
    localStorage.removeItem(ASSOC_KEY);
  } catch (e) {}
  window.dispatchEvent(new Event("wos:assocChanged"));
};

/* The app the person last picked for an extension through "Open with".
   Without this, the menu's "Always use …" line could only ever offer the
   DEFAULT app — so choosing Browser for a .txt and then clicking it stored
   ".txt → Notepad", which is exactly nothing. */
const LAST_EXPLICIT = {};

export const rememberExplicit = (name, key) => {
  const ext = extOf(name);
  if (ext && key && APPS[key]) LAST_EXPLICIT[ext] = key;
};

/** The best app to offer as "Always use …" for this file: the one just
    chosen by hand, or the default if nobody has chosen yet. */
export const alwaysKeyFor = (name) => {
  const ext = extOf(name);
  return (ext && LAST_EXPLICIT[ext]) || appForFile(name);
};

/** Apps worth offering in "Open with" for this file. */
export const openWith = (name) => {
  const kind = kindOf(name);
  const list = BY_KIND[kind] || BY_KIND.unknown;
  const def = appForFile(name);
  // the default first, then the rest — the menu reads like the answer
  const keys = [def, ...list.filter((k) => k !== def)];
  return keys.filter((k, i) => APPS[k] && keys.indexOf(k) === i);
};

/* ---------------- the media hand-off bus ----------------
   Groove Music and Movies & TV run on their own local state, and may
   already be open when a file is double-clicked. A tiny mailbox plus an
   event lets the router say "play THIS" without either app knowing about
   the other. Each app takes its slot once and plays it. */
const mail = { audio: null, video: null };

export const mediaBus = {
  send(kind, payload) {
    mail[kind] = payload;
    try {
      window.dispatchEvent(new CustomEvent("wos:openMedia", { detail: { kind } }));
    } catch (e) {}
  },
  take(kind) {
    const p = mail[kind];
    mail[kind] = null;
    return p;
  },
};

/* ---------------- the honest "no app" answer ---------------- */

const KIND_WORD = {
  program: "is a program, and programs from the internet cannot run inside a browser tab",
  archive: "is an archive — packed files are not unpacked in this browser",
  font: "is a font file — this PC has no font viewer yet",
  unknown: "has no app on this PC yet",
};

export const noAppMessage = (name) => {
  const kind = kindOf(name);
  return KIND_WORD[kind] || KIND_WORD.unknown;
};

export const noAppToast = (name) => {
  notify({
    app: "File Explorer",
    icon: "img/icon/explorer.png",
    title: `Can't open ${name}`,
    body: `${name} ${noAppMessage(name)}. Right-click it and choose “Open in Notepad” to look inside anyway.`,
    kind: "warn",
    life: 6,
  });
};
