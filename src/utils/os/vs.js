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
 * VS — Virtual Storage.
 *
 * One filesystem, two views of it:
 *
 *   1. `Bin` (utils/bin.js) — the object tree File Explorer walks. It is
 *      synchronous and fast, so the whole Explorer UI can stay a pure render
 *      of Redux state.
 *   2. the flat `files` object store in IndexedDB, keyed by a Windows style
 *      path ("C:\Users\Bob\Documents\note.txt"). Terminal, Notepad, Paint and
 *      the browser downloads all talk in paths.
 *
 * This module keeps the two in sync and persists the tree, so nothing is lost
 * when the tab closes. It is the reason Notepad can "Save" to Documents and
 * File Explorer immediately shows the file.
 */
import { Bin, Item } from "../bin";
import fdata from "../../reducers/dir.json";
import { idb } from "../idb";

const TREE_KEY = "vstree";
const TREE_VERSION = 4;

let bin = null;
let saveTimer = null;
let userName = "Blue";
let hydratePromise = null;

/* ------------------------------------------------------------------ *
 *  Serialisation
 * ------------------------------------------------------------------ */

/** Turn a live Bin tree into plain JSON (drops the `host` back references). */
export function serialize(bin) {
  const walk = (item) => {
    if (!item) return null;
    const out = { type: item.type, name: item.name };
    if (item.info && Object.keys(item.info).length) out.info = item.info;
    if (item.type === "folder") {
      const kids = {};
      (item.data || []).forEach((c) => {
        const s = walk(c);
        if (s) kids[c.name] = s;
      });
      if (Object.keys(kids).length) out.data = kids;
    } else {
      out.data = item.data == null ? "" : item.data;
      if (item.mime) out.mime = item.mime;
      if (item.size != null) out.size = item.size;
    }
    if (item.created) out.created = item.created;
    if (item.updated) out.updated = item.updated;
    return out;
  };

  const roots = {};
  (bin.tree || []).forEach((drive) => {
    roots[drive.name] = walk(drive);
  });
  return roots;
}

/** Schedule a debounced write of the tree into IndexedDB. */
export function persist(now = false) {
  if (!bin) return Promise.resolve();
  /* Tell the rest of the OS the tree moved. Explorer re-reads, and the
     Start menu's search index is rebuilt — a file saved in Notepad is
     findable the moment it exists, not one reload later. */
  dispatchRefresh();
  if (saveTimer) clearTimeout(saveTimer);
  const write = () =>
    idb
      .set(TREE_KEY, { v: TREE_VERSION, at: Date.now(), tree: serialize(bin) })
      .then(() => mirrorFlat())
      .catch(() => {});
  if (now) return write();
  saveTimer = setTimeout(write, 400);
  return Promise.resolve();
}

/* ------------------------------------------------------------------ *
 *  Path helpers
 * ------------------------------------------------------------------ */

const norm = (p) => {
  let s = String(p || "")
    .replace(/\//g, "\\")
    .trim();
  s = s.replace(/\\{2,}/g, "\\");
  if (/^[a-z]:$/i.test(s)) s += "\\";
  if (/^[a-z]:\\/i.test(s)) s = s[0].toUpperCase() + s.slice(1);
  return s;
};

/** Resolve a path to a Bin item, walking case-insensitively like Windows. */
export function resolvePath(bin, path) {
  const p = norm(path);
  if (!p) return null;
  const segs = p.split("\\").filter(Boolean);
  if (!segs.length) return null;

  const drive = (bin.tree || []).find(
    (d) => d.name.replace(/\\$/, "").toUpperCase() === segs[0].replace(/\\$/, "").toUpperCase(),
  );
  if (!drive) return null;

  let cur = drive;
  for (let i = 1; i < segs.length; i++) {
    if (cur.type !== "folder") return null;
    const want = segs[i].toLowerCase();
    const hit = (cur.data || []).find((c) => c.name.toLowerCase() === want);
    if (!hit) return null;
    cur = hit;
  }
  return cur;
}

/** The Windows style path of an item, e.g. C:\Users\Bob\Documents. */
export function pathOf(item) {
  const parts = [];
  let cur = item;
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.host;
  }
  let p = parts.join("\\");
  if (/^[A-Za-z]:\\?/.test(p)) p = p[0].toUpperCase() + p.slice(1);
  return p.replace(/\\{2,}/g, "\\");
}

/** Tell the File Explorer that the tree changed underneath it. */
export function dispatchRefresh() {
  try {
    window.dispatchEvent(new CustomEvent("webos-vs-changed"));
  } catch (e) {}
}

export function userHome() {
  return `C:\\Users\\${userName}`;
}

export function setUserName(name) {
  if (!name) return;
  userName = name;
}
export function getUserName() {
  return userName;
}

/**
 * The account name can only be known AFTER the first hydrate() has already
 * run (setup creates it), so hydrate's one-shot promise would keep the
 * placeholder profile folder forever. Call this once the name is known: it
 * renames the profile folder, re-points %user% and writes the tree back.
 */
export async function applyUserName(name) {
  const clean = String(name || "").trim();
  if (!clean) return false;
  await hydrate();
  if (!bin) return false;
  userName = clean;
  renameUserFolder(bin, clean);
  // make sure the well known folders exist under the new name too
  [
    userHome(),
    `${userHome()}\\Desktop`,
    `${userHome()}\\Documents`,
    `${userHome()}\\Downloads`,
    `${userHome()}\\Pictures`,
    `${userHome()}\\Pictures\\Camera Roll`,
    `${userHome()}\\Music`,
    `${userHome()}\\Videos`,
  ].forEach((p) => ensureDir(p));
  [
    ["%desktop%", "Desktop"],
    ["%documents%", "Documents"],
    ["%downloads%", "Downloads"],
    ["%pictures%", "Pictures"],
    ["%music%", "Music"],
    ["%videos%", "Videos"],
  ].forEach(([spid, leaf]) => {
    const node = resolvePath(bin, `${userHome()}\\${leaf}`);
    if (node?.id) bin.special[spid] = node.id;
  });
  await mirrorFlat().catch(() => {});
  await persist(true);
  dispatchRefresh();
  return true;
}

/* ------------------------------------------------------------------ *
 *  Flat mirror — keeps the path-keyed `files` store in step
 * ------------------------------------------------------------------ */

export async function mirrorFlat() {
  if (!bin) return;
  const records = [];
  const walk = (item) => {
    const path = pathOf(item);
    records.push({
      path,
      name: item.name,
      type: item.type === "folder" ? "dir" : "file",
      content: item.type === "folder" ? "" : (item.data ?? ""),
      mime: item.mime || (isBinaryRecord(item.data) ? item.data.mime : ""),
      size: item.type === "folder" ? null : recordBytes(item),
      updated: item.updated || Date.now(),
      created: item.created || item.updated || Date.now(),
    });
    if (item.type === "folder") (item.data || []).forEach(walk);
  };
  (bin.tree || []).forEach(walk);

  // bulk replace: one transaction, far cheaper than N separate puts
  await idb.bulkReplace("files", records).catch(async (e) => {
    /* A context that denies IndexedDB (sandboxed iframe, private mode) has no
       mirror to write to — the files live in memory for this session. Say
       nothing rather than logging once per file. */
    if (!idb.available()) return;
    console.error("[mirrorFlat.bulkReplace]", e?.message || e);
    for (const r of records)
      await idb
        .put("files", r)
        .catch(
          (e2) => idb.available() && console.error("[mirrorFlat.put]", r?.path, e2?.message || e2),
        );
  });
}

/* ------------------------------------------------------------------ *
 *  Boot
 * ------------------------------------------------------------------ */

/**
 * The account created in setup owns the profile folder. The seeded tree ships
 * with a placeholder name, so we rename it — and keep the %user% pointer and
 * the id lookup in sync, otherwise File Explorer keeps showing the old name.
 */
function renameUserFolder(b, name) {
  const users = resolvePath(b, "C:\\Users");
  if (!users || !name || !Array.isArray(users.data)) return;
  const old =
    users.data.find((c) => c.info?.spid === "%user%") || users.data.find((c) => c.name === "Blue");
  if (!old) return;
  if (old.name === name) {
    b.special["%user%"] = old.id;
    return;
  }
  const taken = users.data.some(
    (c) => c !== old && c.name.toLowerCase() === String(name).toLowerCase(),
  );
  if (taken) {
    b.special["%user%"] = old.id;
    return;
  }
  old.name = name;
  old.updated = Date.now();
  b.special["%user%"] = old.id;
  b.setId(old.id, old);
}

/**
 * Build (or restore) the filesystem. Safe to call many times — the first call
 * does the work, the rest get the same promise.
 */
export function hydrate(name, existingBin) {
  if (hydratePromise) return hydratePromise;
  if (name) userName = name;

  hydratePromise = (async () => {
    let data = null;
    try {
      const saved = await idb.get(TREE_KEY);
      if (saved && saved.v === TREE_VERSION && saved.tree) data = saved.tree;
    } catch (e) {}

    // Re-use the Bin the files reducer already handed to the UI so every
    // reference stays valid — we just re-parse the stored tree into it.
    bin = existingBin || new Bin();
    bin.parse(data || fdata);

    // the account name chosen in setup owns the profile folder
    const user = await idb.get("user").catch(() => null);
    const uname = user?.username || userName;
    userName = uname;
    renameUserFolder(bin, uname);

    // make sure the well known folders exist
    [
      userHome(),
      `${userHome()}\\Desktop`,
      `${userHome()}\\Documents`,
      `${userHome()}\\Downloads`,
      `${userHome()}\\Pictures`,
      `${userHome()}\\Pictures\\Saved pictures`,
      `${userHome()}\\Music`,
      `${userHome()}\\Videos`,
    ].forEach((p) => ensureDir(p));

    // the well known pointers must survive trees that predate them —
    // re-point every special the profile owns, or "New > Folder" style
    // features land in the wrong folder
    [
      ["%desktop%", "Desktop"],
      ["%documents%", "Documents"],
      ["%downloads%", "Downloads"],
      ["%pictures%", "Pictures"],
      ["%music%", "Music"],
      ["%videos%", "Videos"],
    ].forEach(([spid, leaf]) => {
      const node = resolvePath(bin, `${userHome()}\\${leaf}`);
      if (node?.id) bin.special[spid] = node.id;
    });

    await mirrorFlat().catch(() => {});
    await persist(true);
    return bin;
  })();

  return hydratePromise;
}

export function getBin() {
  return bin;
}

/* ------------------------------------------------------------------ *
 *  Path based API (used by Notepad, Terminal, Paint, downloads…)
 * ------------------------------------------------------------------ */

export function ensureDir(path) {
  if (!bin) return null;
  const p = norm(path);
  const segs = p.split("\\").filter(Boolean);
  let cur = (bin.tree || []).find(
    (d) => d.name.replace(/\\$/, "").toUpperCase() === segs[0]?.replace(/\\$/, "").toUpperCase(),
  );
  if (!cur) return null;

  for (let i = 1; i < segs.length; i++) {
    if (cur.type !== "folder") return null;
    const want = segs[i].toLowerCase();
    let hit = (cur.data || []).find((c) => c.name.toLowerCase() === want);
    if (!hit) {
      hit = bin.addItem(cur.id, {
        type: "folder",
        name: segs[i],
        info: { icon: "folder" },
      });
      if (!hit) return null;
    }
    cur = hit;
  }
  cur.updated = cur.updated || Date.now();
  return cur;
}

/** Write (or create) a file at a Windows style path. */
/** Is this a stored record that holds base64 bytes instead of text? */
export const isBinaryRecord = (d) => !!d && typeof d === "object" && d.__b64 === true;

/** The base64 payload of a binary record — writers used .b64 or .data over
    the years; readers accept both. */
export const b64Of = (d) => (isBinaryRecord(d) ? d.b64 || d.data || "" : "");

/** Size (in bytes) of a file record, whatever shape its payload takes. */
export function recordBytes(item) {
  const d = item?.data;
  if (d == null) return 0;
  if (typeof d === "string") return d.length;
  if (isBinaryRecord(d)) return d.size ?? Math.floor(b64Of(d).length * 0.75);
  return d.size ?? 0;
}

export async function vsWrite(path, content, meta = {}) {
  await hydrate();
  const p = norm(path);
  const segs = p.split("\\").filter(Boolean);
  const name = segs.pop();
  const dir = ensureDir(segs.join("\\"));
  if (!dir) throw new Error(`Cannot write to ${p}`);

  const lower = name.toLowerCase();
  let item = (dir.data || []).find((c) => c.name.toLowerCase() === lower);
  if (!item) {
    item = bin.addItem(dir.id, {
      type: "file",
      name,
      data: content,
      info: { icon: iconFor(name), ...(meta.info || {}) },
    });
    item.created = Date.now();
  } else {
    item.data = content;
    item.type = "file";
  }
  item.updated = Date.now();
  if (meta.mime) item.mime = meta.mime;
  if (meta.info) item.info = { ...item.info, ...meta.info };
  item.size = recordBytes(item);

  persist();
  return { id: item.id, path: p, name: item.name, item };
}

export async function vsRead(path) {
  await hydrate();
  const item = resolvePath(bin, path);
  if (!item || item.type === "folder") return null;
  return {
    id: item.id,
    path: pathOf(item),
    name: item.name,
    content: item.data ?? "",
    mime: item.mime || "",
    updated: item.updated || 0,
    size: item.size ?? String(item.data ?? "").length,
  };
}

export async function vsList(dirPath) {
  await hydrate();
  const dir = resolvePath(bin, dirPath);
  if (!dir || dir.type !== "folder") return [];
  return (dir.data || []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    path: pathOf(c),
    updated: c.updated || 0,
    size: c.type === "folder" ? null : (c.size ?? String(c.data ?? "").length),
    icon: c.info?.icon || (c.type === "folder" ? "folder" : iconFor(c.name)),
  }));
}

export async function vsExists(path) {
  await hydrate();
  return !!resolvePath(bin, path);
}

/** Delete into the Recycle Bin (returns what was removed, so it can be undone). */
export async function vsRemove(path, { permanent = false } = {}) {
  await hydrate();
  const item = resolvePath(bin, path);
  if (!item || !item.host) return null;
  const snapshot = {
    path: pathOf(item),
    name: item.name,
    type: item.type,
    data: item.type === "folder" ? null : item.data,
    at: Date.now(),
  };
  if (!permanent) {
    const binList = (await idb.get("recycle").catch(() => null)) || [];
    binList.push({ id: snapshot.path, ...snapshot });
    await idb.set("recycle", binList).catch(() => {});
  }
  bin.removeItem(item.id);
  persist();
  return snapshot;
}

export async function vsMkdir(path) {
  await hydrate();
  const dir = ensureDir(path);
  persist();
  return dir ? { id: dir.id, path: pathOf(dir), name: dir.name } : null;
}

export async function vsRename(oldPath, newName) {
  await hydrate();
  const item = resolvePath(bin, oldPath);
  if (!item) return null;
  const taken = (item.host?.data || []).some(
    (c) => c !== item && c.name.toLowerCase() === String(newName).toLowerCase(),
  );
  if (taken) throw new Error(`"${newName}" already exists in this folder.`);
  bin.renameItem(item.id, newName);
  item.updated = Date.now();
  persist();
  return { id: item.id, path: pathOf(item), name: item.name };
}

export async function vsCopy(srcPath, destDir, { move = false, replace = false } = {}) {
  await hydrate();
  const src = resolvePath(bin, srcPath);
  const dst = ensureDir(destDir);
  if (!src || !dst) return null;

  const clone = (item, host) => {
    const copy = new Item({
      type: item.type,
      name: item.name,
      info: { ...item.info },
      host,
    });
    copy.created = Date.now();
    copy.updated = Date.now();
    if (item.type === "folder") {
      copy.data = (item.data || []).map((c) => clone(c, copy));
    } else {
      copy.data = item.data;
      copy.mime = item.mime;
      copy.size = item.size;
    }
    bin.setId(copy.id, copy);
    return copy;
  };

  let name = src.name;
  const base = name.replace(/(\.[^.]+)$/, "");
  const ext = name.endsWith(base) ? "" : name.slice(base.length);

  /* Replace: the user said so — drop the old one and keep the name. Keep
     both (the default): only then is a "name (2)" invented. */
  const clash = (dst.data || []).find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (clash && replace && clash.id !== src.id) {
    bin.removeItem(clash.id);
  } else if (clash && clash.id !== src.id) {
    let n = 2;
    while ((dst.data || []).some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      name = `${base} (${n})${ext}`;
      n += 1;
    }
  }

  const fresh = clone(src, dst);
  fresh.name = name;
  dst.data = [...(dst.data || []), fresh];
  if (move && src.host) bin.removeItem(src.id);
  persist();
  return { id: fresh.id, path: pathOf(fresh), name: fresh.name };
}

/* ------------------------------------------------------------------ *
 *  Icons
 * ------------------------------------------------------------------ */

const ICON_MAP = [
  [/^txt$|log$/i, "file"],
  [/^(png|jpe?g|gif|webp|bmp|svg|ico|heic)$/i, "pics"],
  [/^(mp3|wav|ogg|flac|m4a|aac)$/i, "music"],
  [/^(mp4|mkv|mov|avi|webm)$/i, "vid"],
  [/^(zip|rar|7z|tar|gz)$/i, "zip"],
  [/^(docx?|rtf|odt)$/i, "word"],
  [/^(xlsx?|csv|ods)$/i, "excel"],
  [/^(pptx?|odp)$/i, "ppt"],
  [/^(pdf)$/i, "pdf"],
  [/^(js|jsx|ts|tsx|json|css|scss|html|py|c|cpp|rs|go|java)$/i, "code"],
];

export function iconFor(name) {
  const ext =
    String(name || "")
      .split(".")
      .pop() || "";
  if (!ext || ext === name) return "file";
  for (const [re, ico] of ICON_MAP) if (re.test(ext)) return ico;
  return "file";
}

export function mimeFor(name) {
  const ext = (
    String(name || "")
      .split(".")
      .pop() || ""
  ).toLowerCase();
  const map = {
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    webm: "video/webm",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

export function bytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

/** Write a `data:` URL (or Blob) into the Virtual Storage as real bytes. */
export async function vsWriteDataUrl(path, dataUrl, meta = {}) {
  if (typeof dataUrl !== "string") {
    if (dataUrl instanceof Blob) {
      const b64 = await blobToB64(dataUrl);
      return vsWriteDataUrl(
        path,
        `data:${dataUrl.type || "application/octet-stream"};base64,${b64}`,
        meta,
      );
    }
    throw new Error("vsWriteDataUrl needs a data URL or a Blob");
  }
  const m = /^data:([^;,]*)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return vsWrite(path, dataUrl, meta); // plain text payload, keep it simple
  const mime = m[1] || mimeFor(path);
  if (m[2]) {
    await hydrate();
    const p = norm(path);
    const segs = p.split("\\").filter(Boolean);
    const name = segs.pop();
    const dir = ensureDir(segs.join("\\"));
    if (!dir) throw new Error(`Cannot write to ${p}`);
    const lower = name.toLowerCase();
    let item = (dir.data || []).find((c) => c.name.toLowerCase() === lower);
    if (!item) {
      item = bin.addItem(dir.id, {
        type: "file",
        name,
        data: { __b64: true, mime, b64: m[3] },
        info: { icon: iconFor(name), ...(meta.info || {}) },
      });
      item.created = Date.now();
    } else {
      item.data = { __b64: true, mime, b64: m[3] };
      item.type = "file";
    }
    item.mime = mime;
    item.updated = Date.now();
    item.size = Math.floor((m[3].length * 3) / 4);
    if (meta.info) item.info = { ...item.info, ...meta.info };
    persist();
    return { id: item.id, path: p, name: item.name, item };
  }
  return vsWrite(path, decodeURIComponent(m[3]), { ...meta, mime });
}

/** Read a file back as a `data:` URL — images, audio, anything binary. */
export async function vsReadDataUrl(path) {
  const rec = await vsRead(path);
  if (!rec) return null;
  if (isBinaryRecord(rec.content)) {
    return {
      ...rec,
      dataUrl: `data:${rec.content.mime || mimeFor(rec.name)};base64,${b64Of(rec.content)}`,
    };
  }
  const mime = rec.mime || mimeFor(rec.name);
  if (mime.startsWith("text/") || mime === "application/json") {
    return {
      ...rec,
      dataUrl: `data:${mime};charset=utf-8,${encodeURIComponent(String(rec.content ?? ""))}`,
    };
  }
  return { ...rec, dataUrl: `data:${mime};base64,${btoa(String(rec.content ?? ""))}` };
}

export function blobToB64(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] || "");
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

export default {
  hydrate,
  getBin,
  persist,
  vsWrite,
  vsRead,
  vsList,
  vsRemove,
  vsMkdir,
  vsRename,
  vsCopy,
  resolvePath,
  pathOf,
  userHome,
  setUserName,
  applyUserName,
  dispatchRefresh,
  vsWriteDataUrl,
  vsReadDataUrl,
  isBinaryRecord,
  recordBytes,
  blobToB64,
  iconFor,
  mimeFor,
  bytes,
};

/* ------------------------------------------------------------------ *
 *  Flat-filesystem compatibility API
 *  Older apps (Terminal, Store, extras) were written against the idb
 *  `files` store.  These wrappers keep that call shape but route every
 *  read and write through the Virtual Storage, so there is ONE file
 *  system that File Explorer, Notepad, Paint and Edge all agree on.
 * ------------------------------------------------------------------ */

const baseNameOf = (p) =>
  String(p || "")
    .replace(/\\+$/, "")
    .split("\\")
    .pop() || "C:\\";

/** Legacy `joinPath(...parts)` — normalises into a single Windows path. */
export function fsJoin(...parts) {
  const out = [];
  parts.filter(Boolean).forEach((part) => {
    String(part)
      .replace(/\//g, "\\")
      .split("\\")
      .forEach((seg) => {
        if (!seg || seg === ".") return;
        if (seg === "..") out.pop();
        else out.push(seg);
      });
  });
  let p = out.join("\\");
  if (/^[a-z]:$/i.test(p)) p += "\\";
  return p;
}

export function fsParent(p) {
  const s = String(p || "").replace(/\\+$/, "");
  const i = s.lastIndexOf("\\");
  return i > 2 ? s.slice(0, i) : s.slice(0, 3);
}

export async function fsEnsureDir(path) {
  const p = norm(fsJoin(path));
  await hydrate();
  const dir = ensureDir(p);
  if (!dir) return null;
  persist();
  dispatchRefresh(); // File Explorer must see terminal mkdirs live
  return { path: p, name: dir.name, type: "dir", content: "", updated: dir.updated || Date.now() };
}

export async function fsWrite(path, content) {
  const p = norm(fsJoin(path));
  const rec = await vsWrite(p, String(content ?? ""));
  dispatchRefresh(); // File Explorer must see terminal writes live
  return {
    path: p,
    name: rec.name,
    type: "file",
    content: String(content ?? ""),
    updated: Date.now(),
  };
}

export async function fsRead(path) {
  const p = norm(fsJoin(path));
  await hydrate();
  const item = resolvePath(bin, p);
  if (!item) return null;
  if (item.type === "folder") {
    return { path: p, name: item.name, type: "dir", content: "", updated: item.updated || 0 };
  }
  return {
    path: p,
    name: item.name,
    type: "file",
    content: isBinaryRecord(item.data) ? "" : String(item.data ?? ""),
    mime: item.mime || "",
    size: recordBytes(item),
    updated: item.updated || 0,
  };
}

export async function fsList(dir) {
  const p = norm(fsJoin(dir));
  const rows = await vsList(p);
  return rows.map((r) => ({
    path: r.path,
    name: r.name,
    type: r.type === "folder" ? "dir" : "file",
    content: "",
    size: r.size,
    updated: r.updated,
    mime: "",
  }));
}

export async function fsRm(path, { permanent = false } = {}) {
  const p = norm(fsJoin(path));
  const removed = await vsRemove(p, { permanent });
  if (removed) dispatchRefresh();
  return removed;
}
