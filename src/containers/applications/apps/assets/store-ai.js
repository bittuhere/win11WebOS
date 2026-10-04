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
 * store-ai.js — the Store's tiny on-device recommender.
 *
 * A hand-rolled linear ranker, no network, no keys, no tracking: it learns
 * from what you open, install and search inside this PC only (IndexedDB,
 * key "store.metrics"), and powers
 *   - the "Picked for you" row on Home,
 *   - the ranked search suggestions,
 *   - "More like this" on the detail page.
 *
 * score(app) = 0.34·categoryAffinity + 0.22·popularity + 0.16·quality
 *            + 0.12·typeAffinity + 0.16·match(query)
 * Affinities are Laplace-smoothed frequency tables built from your history,
 * so one open of a game tilts Gaming gently instead of nuking the ranking.
 */

const METRICS_KEY = "store.metrics";
const EMPTY = { opens: {}, installs: {}, searches: [], cat: {}, type: {} };
let cache = null;
let flushTimer = null;

/* dynamic import keeps this module free of store.jsx's import cycle;
   the path is one level deeper than store.jsx's, hence four ups */
const idb = () => import("../../../../utils/idb").then((m) => m.default || m);

function norm(map) {
  let total = 0;
  for (const k in map) total += map[k] || 0;
  return total || 1;
}

function weight(map, key, alpha = 1) {
  // Laplace smoothing: never zero, never extreme
  const m = map || {};
  const total = norm(m) + alpha * 10;
  return ((m[key] || 0) + alpha) / total;
}

function decayed(rec, now) {
  // recent activity counts 2x more than week-old activity
  if (!rec?.at) return rec?.n || 1;
  const days = Math.max(0, (now - rec.at) / 86400000);
  return (rec.n || 1) / (1 + days / 7);
}

export async function loadMetrics() {
  if (cache) return cache;
  try {
    const { default: idbx } = await idb();
    const m = await idbx.get(METRICS_KEY);
    cache = { ...EMPTY, ...(m || {}) };
  } catch (e) {
    cache = { ...EMPTY };
  }
  return cache;
}

function queueFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    try {
      const { default: idbx } = await idb();
      await idbx.set(METRICS_KEY, cache);
    } catch (e) {}
  }, 400);
}

function bump(map, key, at) {
  const cur = map[key] || { n: 0 };
  cur.n = (cur.n || 0) + 1;
  if (at) cur.at = at;
  map[key] = cur;
}

export async function recordOpen(app) {
  const m = await loadMetrics();
  bump(m.opens, app?.id || app?.name, Date.now());
  bump(m.cat, app?.category || "Unknown", Date.now());
  bump(m.type, app?.type || "app", Date.now());
  queueFlush();
}

export async function recordInstall(app) {
  const m = await loadMetrics();
  bump(m.installs, app?.id || app?.name, Date.now());
  bump(m.cat, app?.category || "Unknown", Date.now());
  bump(m.type, app?.type || "app", Date.now());
  queueFlush();
}

export async function recordSearch(term) {
  const q = String(term || "")
    .trim()
    .toLowerCase();
  if (!q) return;
  const m = await loadMetrics();
  m.searches = [q, ...(m.searches || [])].filter((x, i, a) => a.indexOf(x) === i).slice(0, 40);
  queueFlush();
}

/* popularity: ratingsCount → 0..1 (log scale; 500 ratings ≈ 0.5, 100k ≈ 1) */
function popularity(app) {
  const n = Math.max(0, app?.ratingsCount || 0);
  return Math.min(1, Math.log10(n + 1) / 5);
}

/* deterministic quality from the rating we already display (4.1..5.0) */
function quality(app) {
  return Math.max(0, Math.min(1, ((app?.rating || 4.1) - 4.0) / 1.0));
}

/* ══════════════════════════════════════════════════════════════════
   The Store's little AI brain — not a FAQ bot: a real matcher that
   tokenizes the query, expands intent ("car" -> racing games, "write"
   -> Word), forgives typos (bounded edit distance), and grades every
   catalog entry field by field. Deterministic, no network.
   ══════════════════════════════════════════════════════════════════ */

const STOPWORDS = new Set([
  "app",
  "apps",
  "the",
  "a",
  "an",
  "for",
  "me",
  "my",
  "free",
  "get",
  "download",
  "install",
  "best",
  "top",
  "online",
  "on",
  "in",
  "to",
  "and",
  "of",
  "web",
  "website",
  "site",
  "please",
  "i",
  "want",
  "need",
  "some",
  "new",
  "store",
]);

/* intent expansions: what a word REALLY means in Store-speak */
const INTENT = {
  draw: ["paint", "drawing", "sketch", "whiteboard"],
  drawing: ["paint", "sketch", "whiteboard"],
  paint: ["jspaint", "drawing", "creativity"],
  photo: ["photopea", "image", "picture", "camera"],
  photos: ["photopea", "image", "picture"],
  image: ["photopea", "photo", "imgur"],
  picture: ["photopea", "photo"],
  edit: ["photopea", "notepad", "code"],
  editor: ["code", "text", "photopea", "notepad"],
  code: ["github", "ide", "editor", "devtools"],
  coding: ["github", "ide", "code", "devtools"],
  note: ["sticky", "notepad", "notes"],
  notes: ["sticky", "notepad"],
  write: ["word", "notepad", "document"],
  writer: ["word", "notepad"],
  document: ["word", "notepad", "office"],
  documents: ["word", "office"],
  word: ["office", "document"],
  excel: ["spreadsheet", "office"],
  spreadsheet: ["excel", "office"],
  powerpoint: ["slides", "office", "ppt"],
  ppt: ["powerpoint", "slides", "office"],
  slide: ["powerpoint", "slides"],
  slides: ["powerpoint", "office"],
  mail: ["email", "outlook"],
  email: ["mail", "outlook"],
  chat: ["cortana", "bitbot", "ai"],
  ai: ["bitbot", "cortana", "assistant"],
  bot: ["bitbot", "cortana"],
  assistant: ["bitbot", "cortana", "ai"],
  movie: ["movies", "film", "tv", "video"],
  movies: ["film", "tv", "video"],
  film: ["movies", "tv"],
  cinema: ["movies", "film", "tv"],
  music: ["audio", "song", "groove", "sound"],
  song: ["music", "audio"],
  songs: ["music", "audio"],
  audio: ["music", "sound", "groove"],
  game: ["gaming", "arcade"],
  games: ["gaming", "arcade"],
  gaming: ["game", "arcade"],
  arcade: ["game", "gaming"],
  race: ["racing", "car", "speed"],
  racing: ["race", "car", "driving"],
  car: ["racing", "driving"],
  cars: ["racing", "driving"],
  shooter: ["fps", "shoot", "shell"],
  shooting: ["shooter", "fps"],
  shoot: ["shooter", "fps"],
  puzzle: ["brain", "logic"],
  chess: ["board", "checkmate"],
  card: ["cards", "solitaire", "patience"],
  cards: ["solitaire", "patience"],
  solitaire: ["cards", "patience"],
  mine: ["minesweeper", "mines"],
  mines: ["minesweeper"],
  book: ["books", "reading", "ebook", "wikibooks"],
  books: ["book", "reading", "wikibooks"],
  reading: ["book", "books", "reader"],
  read: ["reading", "books", "reader"],
  news: ["headlines", "world"],
  weather: ["forecast", "rain", "temperature"],
  forecast: ["weather"],
  map: ["maps", "navigation", "osm"],
  maps: ["map", "navigation"],
  navigation: ["maps", "gps"],
  calc: ["calculator", "math"],
  calculator: ["math", "calc"],
  math: ["calculator", "bitmath"],
  terminal: ["cmd", "console", "shell", "powershell"],
  cmd: ["terminal", "console"],
  console: ["terminal", "cmd"],
  browser: ["edge", "internet", "surf"],
  internet: ["browser", "edge"],
  watch: ["video", "movies", "youtube", "tv"],
  video: ["movies", "youtube", "tv"],
  videos: ["video", "movies", "youtube"],
  youtube: ["video", "watch"],
  learn: ["education", "course", "wiki", "school"],
  course: ["education", "learn"],
  wiki: ["wikipedia", "encyclopedia"],
  wikipedia: ["wiki", "encyclopedia"],
  dictionary: ["wikidictionary", "words", "thesaurus"],
  translate: ["translator", "language"],
  cloud: ["onedrive", "drive", "storage"],
  storage: ["onedrive", "files", "explorer"],
  files: ["explorer", "storage", "file"],
  file: ["explorer", "files"],
  explorer: ["files", "storage"],
  todo: ["tasks", "planner", "list"],
  task: ["tasks", "todo", "taskmanager"],
  tasks: ["todo", "task"],
  camera: ["photo", "webcam", "picture"],
  webcam: ["camera", "photo"],
  clock: ["alarm", "timer", "stopwatch", "time"],
  alarm: ["clock", "timer"],
  timer: ["clock", "alarm", "stopwatch"],
  stopwatch: ["clock", "timer"],
  security: ["antivirus", "firewall", "defender", "protect"],
  antivirus: ["security", "defender"],
  scanner: ["security", "camera", "scan"],
  xbox: ["games", "gaming", "console"],
  minecraft: ["game", "blocks", "craft"],
  save: ["photopea", "paint", "storage"],
  convert: ["photopea", "converter"],
  pdf: ["document", "reader", "converter"],
  password: ["security", "manager", "vault"],
  vpn: ["security", "privacy", "proxy"],
  radio: ["music", "audio", "stream"],
  podcast: ["audio", "music", "listen"],
  listen: ["music", "audio", "podcast"],
  paint: ["jspaint", "drawing", "creativity"],
  "3d": ["paint", "model", "builder"],
  design: ["excalidraw", "whiteboard", "creativity"],
  diagram: ["excalidraw", "whiteboard", "draw"],
  whiteboard: ["excalidraw", "draw", "design"],
};

/* tokenize: lowercase words, drop punctuation + filler */
function tokenize(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w));
}

/* bounded damerau-ish edit distance with early exit */
function withinDist(word, q, max) {
  if (Math.abs(word.length - q.length) > max) return false;
  const prev = new Array(q.length + 1);
  const cur = new Array(q.length + 1);
  for (let j = 0; j <= q.length; j++) prev[j] = j;
  for (let i = 1; i <= word.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= q.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (word[i - 1] === q[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= q.length; j++) prev[j] = cur[j];
  }
  return prev[q.length] <= max;
}

function words(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter(Boolean);
}

/* grade ONE token against ONE app — returns 0..1 */
function tokenScore(tok, f) {
  if (tok.length < 2) return 0;
  // name: the strongest signal
  if (f.name === tok) return 1;
  if (f.nameWords.includes(tok)) return 0.95;
  if (f.name.startsWith(tok) || f.nameWords.some((w) => w.startsWith(tok))) return 0.85;
  if (f.name.includes(tok)) return 0.7;
  // publisher / category
  if (f.pubWords.includes(tok) || f.category === tok) return 0.55;
  if (f.category.includes(tok)) return 0.5;
  // intent: what the word means around here
  const exp = INTENT[tok];
  if (exp) {
    for (const e of exp) {
      if (f.name === e || f.nameWords.includes(e)) return 0.62;
      if (f.name.includes(e)) return 0.55;
      if (f.category.includes(e)) return 0.5;
    }
  }
  // the id and the site host ("jspint" -> jspaint.app)
  if (f.altWords?.includes(tok)) return 0.6;

  // description keywords (weakest, but real)
  if (f.descWords.some((w) => w === tok)) return 0.38;
  if (f.descWords.some((w) => w.startsWith(tok) && tok.length >= 4)) return 0.33;

  // typos — full words AND their front end: "wikipedya" -> wikipedia,
  // "excrl" -> excel, "photp" -> photo(pea), "jspint" -> jspaint
  if (tok.length >= 4) {
    const max = tok.length > 7 ? 2 : 1;
    const near = (a, b) => Math.abs(a.length - b.length) <= max + 1 && withinDist(a, b, max);
    for (const w of f.nameWords) {
      if (near(w, tok)) return 0.52;
      // the user often stops mid-word with a typo — try the word's heads
      for (let L = tok.length - 1; L <= tok.length + 1; L++) {
        if (L >= 3 && L <= w.length && near(w.slice(0, L), tok)) return 0.5;
      }
    }
    for (const w of f.altWords || []) {
      if (near(w, tok)) return 0.5;
      for (let L = tok.length - 1; L <= tok.length + 1; L++) {
        if (L >= 3 && L <= w.length && near(w.slice(0, L), tok)) return 0.48;
      }
    }
    for (const w of f.catWords) {
      if (near(w, tok)) return 0.45;
    }
    if (exp) {
      for (const e of exp) {
        for (const w of f.nameWords) {
          if (near(w, e) || near(e, tok)) return 0.48;
        }
      }
    }
  }
  return 0;
}

/* the full match grade of an app for a raw query — 0 means "no case" */
export function matchScore(app, q) {
  const toks = tokenize(q);
  if (!toks.length) return 0;
  let host = "";
  try {
    host = new URL(app.data?.url || app.url || "").hostname.replace(/^www\./, "");
  } catch (e) {}
  const f = {
    name: String(app.name || "").toLowerCase(),
    nameWords: words(app.name),
    pubWords: words(app.publisher),
    category: String(app.category || "").toLowerCase(),
    catWords: words(app.category),
    descWords: words(app.data?.desc || app.desc || ""),
    altWords: [...words(app.id), ...words(host.replace(/[.-]/g, " "))],
  };
  let sum = 0;
  let all = true;
  for (const t of toks) {
    const s = tokenScore(t, f);
    if (s <= 0) all = false;
    sum += s;
  }
  if (sum <= 0) return 0;
  let out = (sum / toks.length) * 0.85 + (all ? 0.15 : 0);
  // tiny popularity nudge so equal-good matches order sensibly
  out += popularity(app) * 0.02;
  return out;
}

export function score(app, metrics, opts = {}) {
  const now = Date.now();
  const catAff = weight(metrics.cat, app.category || "Unknown");
  const typeAff = weight(metrics.type, app.type || "app");
  let openAff = 0;
  // apps of the same category as your recent opens get a recency boost
  for (const id in metrics.opens || {}) {
    if (id === (app.id || app.name)) continue;
    openAff = Math.max(openAff, decayed(metrics.opens[id], now) / 20);
  }
  const s =
    0.34 * catAff +
    0.22 * popularity(app) +
    0.16 * quality(app) +
    0.12 * typeAff +
    Math.min(0.16, openAff);
  let out = s;
  if (opts.query) {
    const hit = matchScore(app, opts.query);
    out = hit > 0 ? hit * 0.72 + s * 0.28 : 0;
  }
  return out;
}

function fuzzy(hay, q) {
  let i = 0;
  for (const c of hay) if (c === q[i]) i++;
  return i >= q.length;
}

/* bounded edit distance with early exit — typo forgiveness that stays O(n·m)
   only for short queries, which is all we ever rank */
function editWithin(word, q, max) {
  if (Math.abs(word.length - q.length) > max) return false;
  const prev = new Array(q.length + 1);
  const cur = new Array(q.length + 1);
  for (let j = 0; j <= q.length; j++) prev[j] = j;
  for (let i2 = 1; i2 <= word.length; i2++) {
    cur[0] = i2;
    let best = cur[0];
    for (let j2 = 1; j2 <= q.length; j2++) {
      cur[j2] = Math.min(
        prev[j2] + 1,
        cur[j2 - 1] + 1,
        prev[j2 - 1] + (word[i2 - 1] === q[j2 - 1] ? 0 : 1),
      );
      if (cur[j2] < best) best = cur[j2];
    }
    if (best > max) return false;
    for (let j2 = 0; j2 <= q.length; j2++) prev[j2] = cur[j2];
  }
  return prev[q.length] <= max;
}

/* a token of the name is within one typo of the query word ("wikpedya" ->
   wikipedia, "excrl" -> excel) */
function typoMatch(hay, q) {
  if (q.length < 4) return false;
  const max = q.length > 7 ? 2 : 1;
  const words = hay.split(/[^a-z0-9]+/);
  for (const w of words) {
    if (Math.abs(w.length - q.length) <= max + 1 && editWithin(w, q, max)) return true;
  }
  return false;
}

/** ranked list — the AI ordering behind rows and filtered grids */
export function ranked(list, metrics, opts = {}) {
  return [...list]
    .map((a) => [a, score(a, metrics, opts)])
    .sort((a, b) => b[1] - a[1])
    .map((p) => p[0]);
}

/** "Picked for you": high scorers you don't have, max 2 per category */
export function pickedForYou(list, metrics, installedKeys = new Set(), n = 12) {
  const out = [];
  const perCat = {};
  for (const a of ranked(list, metrics)) {
    if (out.length >= n) break;
    if (installedKeys.has(a.icon)) continue;
    const c = a.category || "?";
    perCat[c] = (perCat[c] || 0) + 1;
    if (perCat[c] > 2) continue;
    out.push(a);
  }
  return out;
}

/** "More like this": same category first, then same type, never itself */
export function related(app, list, metrics, n = 6) {
  const self = app?.id || app?.name;
  return ranked(
    list.filter((a) => (a.id || a.name) !== self),
    metrics,
  )
    .sort((a, b) => {
      const am = a.category === app.category ? 1 : 0;
      const bm = b.category === app.category ? 1 : 0;
      return bm - am;
    })
    .slice(0, n);
}

/** search suggestions: real matches first (AI-ordered), then AI picks */
export function suggest(q, list, metrics, n = 7) {
  const s = String(q || "").trim();
  if (!s) return [];
  const graded = [];
  for (const a of list) {
    const m = matchScore(a, s);
    if (m > 0) graded.push([a, m + score(a, metrics) * 0.08]);
  }
  graded.sort((a, b) => b[1] - a[1]);
  const seen = new Set();
  const out = [];
  for (const [a] of graded) {
    const key = a.id || a.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= n) break;
  }
  return out;
}
