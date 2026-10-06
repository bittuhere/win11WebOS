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
 * WebOS IndexedDB — the internal storage of this Windows.
 * All user data, files, apps, notes, settings snapshots live here.
 */

const DB_NAME = "WebOS";
const DB_VERSION = 3;

const STORE_DEFS = {
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

let dbPromise = null;

/* Some contexts refuse IndexedDB outright — a sandboxed iframe without
   allow-same-origin gives the page an opaque origin and `indexedDB.open`
   throws a SecurityError. Safari private mode and storage-blocked profiles do
   the same. The OS must still run (in memory, for that session), so the shell
   probes readiness with idb.available() and simply skips persistence. */
let unavailable = false;

const isDenial = (e) => {
  const name = String((e && e.name) || "");
  const msg = String((e && e.message) || e || "");
  return /security|denied|notallowed|invalidstate/i.test(name + " " + msg);
};

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      unavailable = true;
      return reject(new Error("IndexedDB is not available in this context"));
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      /* thrown synchronously for opaque origins (sandboxed frames, some
         private modes) — degrade instead of exploding on every call */
      if (isDenial(e)) unavailable = true;
      return reject(e);
    }
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.keys(STORE_DEFS).forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, STORE_DEFS[name]);
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      if (isDenial(req.error)) unavailable = true;
      reject(req.error);
    };
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("aborted"));
  });
}

/**
 * Every public method funnels through `run`. The first time the environment
 * refuses IndexedDB (sandboxed iframe, private window, storage-switched-off
 * profile) the whole store becomes a silent no-op for the rest of the session:
 * writes resolve with their input, reads resolve empty — exactly what a
 * brand-new machine looks like — instead of throwing once per call and
 * stranding the setup wizard or an app mid-action.
 */
async function run(op, fallback) {
  if (unavailable) return fallback;
  try {
    return await op();
  } catch (e) {
    if (isDenial(e)) {
      unavailable = true;
      try {
        console.info(
          "[idb] persistence is unavailable in this context — this session runs in memory",
        );
      } catch (e2) {}
      return fallback;
    }
    throw e;
  }
}

async function store(name, mode = "readonly") {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export const idb = {
  /** false when this browser context denies IndexedDB (the OS then runs in memory) */
  available() {
    return !unavailable;
  },

  get(key) {
    return run(async () => {
      const s = await store("kv");
      return new Promise((resolve, reject) => {
        const r = s.get(key);
        r.onsuccess = () => resolve(r.result ? r.result.value : undefined);
        r.onerror = () => reject(r.error);
      });
    }, undefined);
  },

  set(key, value) {
    return run(async () => {
      const db = await openDB();
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put({ key, value });
      await txDone(tx);
      return value;
    }, value);
  },

  del(key) {
    return run(async () => {
      const db = await openDB();
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").delete(key);
      await txDone(tx);
    }, undefined);
  },

  put(storeName, record) {
    return run(async () => {
      const db = await openDB();
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(record);
      await txDone(tx);
      return record;
    }, record);
  },

  getFrom(storeName, key) {
    return run(async () => {
      const s = await store(storeName);
      return new Promise((resolve, reject) => {
        const r = s.get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }, undefined);
  },

  getAll(storeName) {
    return run(async () => {
      const s = await store(storeName);
      return new Promise((resolve, reject) => {
        const r = s.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    }, []);
  },

  deleteFrom(storeName, key) {
    return run(async () => {
      const db = await openDB();
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      await txDone(tx);
    }, undefined);
  },

  clear(storeName) {
    return run(async () => {
      const db = await openDB();
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      await txDone(tx);
    }, undefined);
  },

  /** Replace the whole store in one transaction — used by the VS mirror. */
  bulkReplace(storeName, records) {
    return run(
      async () => {
        const db = await openDB();
        const tx = db.transaction(storeName, "readwrite");
        const os = tx.objectStore(storeName);
        os.clear();
        (records || []).forEach((r) => os.put(r));
        await txDone(tx);
        return (records || []).length;
      },
      (records || []).length,
    );
  },

  /** Many puts, one transaction. */
  bulkPut(storeName, records) {
    return run(
      async () => {
        const db = await openDB();
        const tx = db.transaction(storeName, "readwrite");
        const os = tx.objectStore(storeName);
        (records || []).forEach((r) => os.put(r));
        await txDone(tx);
        return (records || []).length;
      },
      (records || []).length,
    );
  },

  count(storeName) {
    return run(async () => {
      const s = await store(storeName);
      return new Promise((resolve, reject) => {
        const r = s.count();
        r.onsuccess = () => resolve(r.result || 0);
        r.onerror = () => reject(r.error);
      });
    }, 0);
  },
};

export function uid(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function sha256(text) {
  const enc = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getUser() {
  return (await idb.get("user")) || null;
}

const MIRROR_KEY = "wosUserMirror";

function readMirror() {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && u.setupComplete ? u : null;
  } catch (e) {
    return null;
  }
}

/**
 * The user record, with a safety net: IndexedDB can be evicted, corrupted
 * or blocked (private mode, storage pressure) — that used to drop this OS
 * back to first-run setup and it looked like the account vanished.
 * saveUser mirrors the record into localStorage; if the DB ever comes back
 * empty we heal the DB from the mirror instead of re-running OOBE.
 */
export async function getUserWithFallback() {
  try {
    const u = await getUser();
    if (u && u.setupComplete) return u;
  } catch (e) {
    /* DB unavailable — the mirror below is the only hope */
  }
  const mirror = readMirror();
  if (mirror) {
    try {
      await saveUser(mirror); // heal the database silently
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("wos:user-restored"));
    } catch (e) {}
    return mirror;
  }
  return null;
}

if (typeof window !== "undefined") {
  window.__wosGetUser = getUserWithFallback;
}

export async function saveUser(user) {
  await idb.set("user", user);
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(user));
  } catch (e) {}
  return user;
}

export async function verifyPassword(plain) {
  const user = await getUser();
  if (!user) return false;
  const hash = await sha256(plain);
  return hash === user.passwordHash;
}

/* ---------------- Virtual filesystem ---------------- */

export function joinPath(...parts) {
  const raw = parts.join("\\").replace(/\//g, "\\");
  const segs = [];
  raw.split("\\").forEach((s) => {
    if (!s || s === ".") return;
    if (s === "..") segs.pop();
    else segs.push(s);
  });
  if (!segs.length) return "C:";
  if (segs[0].toUpperCase() === "C:") {
    return segs[0].toUpperCase() + (segs.length > 1 ? "\\" + segs.slice(1).join("\\") : "\\");
  }
  return segs.join("\\");
}

export function parentPath(p) {
  const i = p.lastIndexOf("\\");
  if (i <= 2) return "C:\\";
  return p.slice(0, i);
}

export function baseName(p) {
  const i = p.lastIndexOf("\\");
  return i >= 0 ? p.slice(i + 1) : p;
}

/* The flat `files` store is now a mirror of the Virtual Storage — these
   thin wrappers keep the old call shape but route everything through vs.js
   so Terminal, the Store and File Explorer always agree. */
const vsCompat = () => import("./os/vs");

export async function fsEnsureDir(path) {
  const vs = await vsCompat();
  return vs.fsEnsureDir(path);
}

export async function fsWrite(path, content) {
  const vs = await vsCompat();
  return vs.fsWrite(path, content);
}

export async function fsRead(path) {
  const vs = await vsCompat();
  return vs.fsRead(path);
}

export async function fsList(dir) {
  const vs = await vsCompat();
  return vs.fsList(dir);
}

export async function fsRm(path) {
  const vs = await vsCompat();
  return vs.fsRm(path);
}

export async function initDefaultFS(username) {
  const user = username || "User";
  const dirs = [
    "C:\\",
    "C:\\Users",
    `C:\\Users\\${user}`,
    `C:\\Users\\${user}\\Desktop`,
    `C:\\Users\\${user}\\Documents`,
    `C:\\Users\\${user}\\Downloads`,
    `C:\\Users\\${user}\\Pictures`,
    `C:\\Users\\${user}\\Music`,
    `C:\\Users\\${user}\\Videos`,
    "C:\\Windows",
    "C:\\Windows\\System32",
    "C:\\Program Files",
    "C:\\Program Files\\WindowsApps",
  ];
  for (const d of dirs) await fsEnsureDir(d);
  await fsWrite(
    `C:\\Users\\${user}\\Documents\\Welcome.txt`,
    `Welcome to WebOS, ${user}.\n\nThis PC stores your files in IndexedDB — they stay on this browser.\nOpen Notepad, the Store, or Terminal to look around.\n`,
  );
  await fsWrite(
    "C:\\Windows\\System32\\license.txt",
    "WebOS — a Windows 11 experience in your browser.\nNot affiliated with Microsoft Corporation.\n",
  );
}

export async function seedIfEmpty() {
  const seeded = await idb.get("seeded");
  if (seeded) return;
  const user = await getUser();
  await initDefaultFS(user?.username || "User");
  await idb.set("seeded", true);
}

export default idb;
