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
import { useSelector, useDispatch } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { handleFileOpen, openFileWith } from "../../../actions";
import {
  APPS,
  alwaysKeyFor,
  appForFile,
  kindOf,
  openWith,
  overrides,
  setOverride,
  extOf as assocExt,
} from "../../../utils/os/assoc";
import { iconForItem, typeLabel, extOf } from "../../../utils/os/icons";
import * as vs from "../../../utils/os/vs";
import { notify, wosConfirm, wosConfirmEx, wosPrompt } from "../../../utils/os/ui";
import { WosFlyout } from "../../../components/shared/Controls";
import { bytes } from "../../../utils/os/vs";
import "./assets/fileexpo.scss";

/* ================================================================== *
 *  Little helpers
 * ================================================================== */

const Glyph = ({ d, size = 16, fill = false }) => (
  <svg
    viewBox="0 0 20 20"
    width={size}
    height={size}
    aria-hidden
    fill={fill ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.45"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

const G = {
  back: <path d="M12.5 4L6.5 10l6 6" />,
  fwd: <path d="M7.5 4l6 6-6 6" />,
  up: <path d="M10 15.5V5M5 10l5-5 5 5" />,
  reload: (
    <>
      <path d="M16 10a6 6 0 1 1-1.9-4.4" />
      <path d="M16 3.5v4h-4" />
    </>
  ),
  cut: (
    <>
      <circle cx="6.2" cy="14.5" r="2.3" />
      <circle cx="13.8" cy="14.5" r="2.3" />
      <path d="M7.8 12.8L14 3.5M12.2 12.8L6 3.5" />
    </>
  ),
  copy: (
    <>
      <rect x="7" y="3.5" width="9" height="11" rx="1.4" />
      <path d="M13 16.5H5.4A1.4 1.4 0 0 1 4 15.1V6.5" />
    </>
  ),
  paste: (
    <>
      <path d="M7.5 4.5H6A1.5 1.5 0 0 0 4.5 6v10A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 14 4.5h-1.5" />
      <rect x="7.5" y="2.8" width="5" height="3.4" rx="1" />
    </>
  ),
  rename: <path d="M4 15.4L13.4 6l2.6 2.6L6.6 18H4z" />,
  share: (
    <>
      <circle cx="14.5" cy="5" r="2.2" />
      <circle cx="5.5" cy="10" r="2.2" />
      <circle cx="14.5" cy="15" r="2.2" />
      <path d="M7.5 8.9l5-2.8M7.5 11.1l5 2.8" />
    </>
  ),
  bin: (
    <>
      <path d="M4 6h12M8 6V4h4v2M6 6l1 10.5h6L14 6" />
    </>
  ),
  sort: (
    <>
      <path d="M5 5.5h10M5 10h7M5 14.5h4" />
    </>
  ),
  view: (
    <>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1" />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="6.6" />
      <path d="M10 9v5M10 6.4v.6" />
    </>
  ),
  folderPlus: (
    <>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.8 2H15A1.5 1.5 0 0 1 16.5 8.5v7A1.5 1.5 0 0 1 15 17H4.5A1.5 1.5 0 0 1 3 15.5z" />
      <path d="M9.8 12.2h4.4M12 10v4.4" />
    </>
  ),
  filePlus: (
    <>
      <path d="M12 3H6.5A1.5 1.5 0 0 0 5 4.5v11A1.5 1.5 0 0 0 6.5 17h7a1.5 1.5 0 0 0 1.5-1.5V7z" />
      <path d="M12 3v4h3M9.5 11.5h3M11 10v3" />
    </>
  ),
  dots: (
    <>
      <circle cx="10" cy="4.4" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="15.6" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  chevR: <path d="M8 5.5l4.5 4.5L8 14.5" />,
  chevD: <path d="M5.5 8l4.5 4.5L14.5 8" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5.2" />
      <path d="M12.9 12.9L16.5 16.5" />
    </>
  ),
  star: <path d="M10 3l2.2 4.5 5 .7-3.6 3.5.9 5L10 14.4 5.5 16.7l.9-5L2.8 8.2l5-.7z" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.6" />
      <path d="M3.5 8.5h13M8.5 3.5v13" />
    </>
  ),
  list: (
    <>
      <path d="M4 5.5h12M4 10h12M4 14.5h12" />
    </>
  ),
  details: (
    <>
      <rect x="3.5" y="4" width="13" height="12" rx="1.4" />
      <path d="M3.5 8h13M8.5 8v8" />
    </>
  ),
  home: <path d="M3.5 9.5L10 4l6.5 5.5V16a.5.5 0 0 1-.5.5h-4v-4.5H8v4.5H4a.5.5 0 0 1-.5-.5z" />,
  upload: (
    <>
      <path d="M10 15.5V5M6 9l4-4 4 4M4 17h12" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="14" height="11" rx="1.6" />
      <path d="M6 8.5l2.5 2L6 12.5M10.5 13h3.5" />
    </>
  ),
  file: (
    <>
      <path d="M12 3H6.5A1.5 1.5 0 0 0 5 4.5v11A1.5 1.5 0 0 0 6.5 17h7a1.5 1.5 0 0 0 1.5-1.5V7z" />
      <path d="M12 3v4h3" />
    </>
  ),
  edge: (
    <>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M4.2 8.4c3.6-1.4 8.6-1.2 12 .6" />
      <path d="M13 16.4c-1.4-2.6-4.4-4.6-8-5" />
    </>
  ),
  cog: (
    <>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3.2v2M10 14.8v2M3.2 10h2M14.8 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M14.8 5.2l-1.4 1.4M6.6 13.4l-1.4 1.4" />
    </>
  ),
};

const fmtDate = (ts) =>
  ts
    ? new Date(ts).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/** Which app should open this file? */
/* One table for the whole OS (utils/os/assoc). Explorer keeps its own
   vocabulary for the bits of UI that talk about kinds, but the *decision*
   about which app a file belongs to is never made here. */
const opensAs = (item) => {
  if (item.type === "folder") return "folder";
  return kindOf(item.name); // image | audio | video | web | board | text | program | archive | font | unknown
};

/* ================================================================== *
 *  File Explorer
 * ================================================================== */

export const Explorer = () => {
  const wnapp = useSelector((s) => s.apps.explorer);
  const apps = useSelector((s) => s.apps);
  const files = useSelector((s) => s.files);
  const personName = useSelector((s) => s.setting.person.name);
  const dispatch = useDispatch();

  const [selected, setSelected] = useState([]);
  const [renaming, setRenaming] = useState(null);
  const [renVal, setRenVal] = useState("");
  const [editingPath, setEditingPath] = useState(false);
  const [pathText, setPathText] = useState("");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [anchor, setAnchor] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const contentRef = useRef(null);
  const rootRef = useRef(null);
  const fileInput = useRef(null);
  const lastClick = useRef(null);

  const cdir = files.cdir;
  /* the item the context menu is about — read from the click, not the
     (asynchronously updated) selection */
  const ctxItem = ctx?.on ? files.data.getId(ctx.on) : null;
  const cdata = files.data?.getId(cdir);
  const cpath = files.cpath || "";

  const selItems = useMemo(
    () => selected.map((id) => files.data?.getId(id)).filter(Boolean),
    // epoch: the Bin mutates in place, so follow its epoch too
    [selected, files.data, cdir, files.epoch],
  );

  /* clear the selection whenever the folder changes */
  useEffect(() => {
    setSelected([]);
    setSearch("");
    setCtx(null);
    setEditingPath(false);
    lastClick.current = null;
  }, [cdir]);

  useEffect(() => setPathText(cpath), [cpath]);

  /* ---- the Windows drag-select band over the file area ---- */
  const bandRef = useRef(null);
  const bandDrag = useRef(null);
  const bandMove = (e) => {
    if (!bandDrag.current || !bandRef.current) return;
    const [x0, y0] = bandDrag.current;
    const el = bandRef.current;
    el.style.display = "block";
    el.style.left = Math.min(x0, e.clientX) + "px";
    el.style.top = Math.min(y0, e.clientY) + "px";
    el.style.width = Math.abs(e.clientX - x0) + "px";
    el.style.height = Math.abs(e.clientY - y0) + "px";
    /* band rect straight from the drag coordinates — element rects are
       unreliable (zero-size in test DOMs, and cheap anyway) */
    const bl = Math.min(x0, e.clientX);
    const bt = Math.min(y0, e.clientY);
    const br = Math.max(x0, e.clientX);
    const bb = Math.max(y0, e.clientY);
    const hits = [];
    contentRef.current?.querySelectorAll("[data-id]").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (!(r.right < bl || r.left > br || r.bottom < bt || r.top > bb)) hits.push(n.dataset.id);
    });
    setSelected(hits);
  };
  const bandUp = () => {
    bandDrag.current = null;
    if (bandRef.current) bandRef.current.style.display = "none";
    window.removeEventListener("pointermove", bandMove);
    window.removeEventListener("pointerup", bandUp);
  };
  const bandDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".fxItem, .fxTable, input, button")) return;
    setSelected([]);
    bandDrag.current = [e.clientX, e.clientY];
    window.addEventListener("pointermove", bandMove);
    window.addEventListener("pointerup", bandUp);
  };

  /* a closed Explorer forgets everything — reopening is a fresh window at home */
  useEffect(() => {
    return () => {
      dispatch({ type: "FILEHOME" });
    };
  }, []);

  /* ---------------- the file list ---------------- */
  const list = useMemo(() => {
    if (!cdata?.data) return [];
    let arr = cdata.data.slice();
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((x) => x.name.toLowerCase().includes(q));
    }
    const { by = "name", asc = true } = files.sort || {};
    const dir = asc ? 1 : -1;
    arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      if (by === "size")
        return ((a.size ?? 0) - (b.size ?? 0)) * dir || a.name.localeCompare(b.name);
      if (by === "modified")
        return ((a.updated ?? 0) - (b.updated ?? 0)) * dir || a.name.localeCompare(b.name);
      if (by === "type") {
        const t = typeLabel(a).localeCompare(typeLabel(b));
        return t * dir || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true }) * dir;
    });
    return arr;
    // files.epoch: the tree mutates in place — without it the list would
    // only refresh after closing and reopening the folder
  }, [cdata, search, files.sort, files.epoch]);

  /* ---------------- navigation ---------------- */
  const goto = (id) => id && dispatch({ type: "FILEDIR", payload: id });
  const goPath = (p) => {
    const id = files.data.parsePath(p);
    if (id) {
      dispatch({ type: "FILEDIR", payload: id });
      return true;
    }
    notify({
      app: "File Explorer",
      icon: "img/icon/explorer.png",
      title: "Can't find that folder",
      body: p,
      kind: "error",
      life: 4,
    });
    return false;
  };

  const open = useCallback(
    (item) => {
      if (!item) return;
      if (item.type === "folder") {
        goto(item.id);
        return;
      }
      /* the shared router: same answer here, on the desktop, in Start and in
         "Open with" — and the media apps get the file itself, not just a nudge */
      handleFileOpen(item.id);
    },
    [dispatch],
  );

  /* ---------------- editing ---------------- */
  const startRename = (item) => {
    if (!item) return;
    setRenaming(item.id);
    const n = item.name;
    const dot = item.type === "file" ? n.lastIndexOf(".") : -1;
    setRenVal(n);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-ren="${item.id}"] input`);
      if (el) {
        el.focus();
        el.setSelectionRange(0, dot > 0 ? dot : n.length);
      }
    });
  };

  const commitRename = async () => {
    const item = files.data?.getId(renaming);
    const name = renVal.trim();
    setRenaming(null);
    if (!item || !name || name === item.name) return;
    try {
      dispatch({ type: "FILEREN", payload: { id: item.id, name } });
      await vs.vsRename(vs.pathOf(item), name).catch(() => {});
    } catch (e) {
      notify({
        app: "File Explorer",
        icon: "img/icon/explorer.png",
        title: "Rename failed",
        body: String(e?.message || e),
        kind: "error",
      });
    }
  };

  const newFolder = async () => {
    dispatch({ type: "FILEMKDIR" });
    const id = files.selected;
    // the reducer selects the fresh item; rename it straight away like Windows
    setTimeout(() => {
      const made = [...(files.data?.getId(cdir)?.data || [])].pop();
      if (made) startRename(made);
    }, 40);
  };

  const newTextFile = async () => {
    dispatch({ type: "FILEMKFILE" });
    setTimeout(() => {
      const made = [...(files.data?.getId(cdir)?.data || [])].pop();
      if (made) startRename(made);
    }, 40);
  };

  const del = async (ids) => {
    const items = ids.map((i) => files.data?.getId(i)).filter(Boolean);
    if (!items.length) return;
    const ok = await wosConfirm(
      items.length === 1
        ? `Are you sure you want to move "${items[0].name}" to the Recycle Bin?`
        : `Are you sure you want to move these ${items.length} items to the Recycle Bin?`,
      { title: "Delete", okText: "Yes", cancelText: "No", danger: true },
    );
    if (!ok) return;
    dispatch({ type: "FILEDEL", payload: ids });
    for (const it of items) await vs.vsRemove(vs.pathOf(it)).catch(() => {});
    setSelected([]);
    notify({
      app: "File Explorer",
      icon: "img/icon/explorer.png",
      title:
        items.length === 1
          ? `"${items[0].name}" moved to Recycle Bin`
          : `${items.length} items moved to Recycle Bin`,
      kind: "success",
      life: 4,
    });
  };

  /* Windows asks before it invents a second copy. Pasting onto an existing
     name offers Replace / Keep both / Cancel instead of silently creating
     "file (2).ext" behind the user's back. */
  const paste = async () => {
    const clip = files.clip;
    if (!clip?.ids?.length) return;

    const host = files.data?.getId(cdir);
    const kids = host?.data || [];
    const clashes = clip.ids
      .map((id) => files.data?.getId(id))
      .filter(Boolean)
      .filter((src) => !kids.some((c) => c.id === src.id))
      .map((src) => src.name)
      .filter((n) => kids.some((c) => c.name.toLowerCase() === n.toLowerCase()));

    let mode = "keepboth";
    if (clashes.length) {
      const r = await wosConfirmEx(
        clashes.length === 1
          ? `"${clashes[0]}" is already in this folder. What do you want to do?`
          : `${clashes.length} items are already in this folder. What do you want to do?`,
        {
          title: "Confirm File Replace",
          okText: "Replace the files",
          midText: "Keep both copies",
          cancelText: "Cancel",
          danger: true,
        },
      );
      if (r === null) return; // Cancel
      mode = r === true ? "replace" : "keepboth";
    }

    dispatch({ type: "FILEPASTE", payload: { replace: mode === "replace" } });
    for (const id of clip.ids) {
      const src = files.data?.getId(id);
      if (!src) continue;
      await vs
        .vsCopy(vs.pathOf(src), cpath, { move: clip.mode === "cut", replace: mode === "replace" })
        .catch(() => {});
    }
  };

  /* ---------------- importing real files ---------------- */
  /* text-ish files keep their bytes as text; everything else is stored as a
     real binary record — reading a photo through f.text() corrupts it */
  const fileText = (f) =>
    typeof f.text === "function"
      ? f.text()
      : new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result || ""));
          r.onerror = () => rej(r.error);
          r.readAsText(f);
        });

  const isTexty = (f) =>
    (f.type || "").startsWith("text/") ||
    /\.(txt|md|markdown|json|js|jsx|ts|tsx|css|scss|html|htm|xml|csv|tsv|log|ini|cfg|conf|yml|yaml|bat|sh|py|c|cpp|h|java|rs|go)$/i.test(
      f.name || "",
    );

  const importFiles = async (fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    setBusy(true);
    let done = 0;
    for (const f of arr) {
      try {
        if (isTexty(f)) {
          const text = await fileText(f);
          dispatch({
            type: "FILEIMPORT",
            payload: { name: f.name, data: text, mime: f.type, size: f.size },
          });
          await vs.vsWrite(`${cpath}\\${f.name}`, text, { mime: f.type }).catch(() => {});
        } else {
          const b64 = await vs.blobToB64(f);
          const rec = { __b64: true, mime: f.type || "application/octet-stream", b64 };
          dispatch({
            type: "FILEIMPORT",
            payload: { name: f.name, data: rec, mime: rec.mime, size: f.size },
          });
          await vs.vsWrite(`${cpath}\\${f.name}`, rec, { mime: rec.mime }).catch(() => {});
        }
        done += 1;
      } catch (e) {}
    }
    setBusy(false);
    notify({
      app: "File Explorer",
      icon: "img/icon/explorer.png",
      title:
        done === arr.length
          ? `${done} file${done === 1 ? "" : "s"} copied to this PC`
          : `${done} of ${arr.length} copied`,
      body: cpath,
      kind: done ? "success" : "warn",
    });
  };

  /* ---------------- selection ---------------- */
  const select = (item, e) => {
    if (!item) return;
    if (e?.shiftKey && lastClick.current) {
      const a = list.findIndex((x) => x.id === lastClick.current);
      const b = list.findIndex((x) => x.id === item.id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelected(list.slice(lo, hi + 1).map((x) => x.id));
        return;
      }
    }
    if (e?.ctrlKey || e?.metaKey) {
      setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]));
      lastClick.current = item.id;
      return;
    }
    setSelected([item.id]);
    lastClick.current = item.id;
    dispatch({ type: "FILESEL", payload: item.id });
  };

  /* ---------------- keyboard ----------------
     Windows rule: the FOCUSED window owns the keyboard. This handler used to
     run whenever Explorer merely existed, so Ctrl+V typed in Notepad pasted a
     file into whatever folder Explorer last showed — and the preventDefault
     swallowed the paste the text editor was about to receive. */
  useEffect(() => {
    if (!wnapp.alive || wnapp.hide) return;
    const onKey = (e) => {
      if (wnapp.z !== apps.hz) return; // another window is in front
      const el = e.target;
      const inField =
        /INPUT|TEXTAREA|SELECT/.test(el?.tagName || "") || el?.isContentEditable === true;
      if (inField && !rootRef.current?.contains(el)) return; // a field in someone else's window
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "a" && !inField) {
          e.preventDefault();
          setSelected(list.map((x) => x.id));
        } else if (k === "c" && selected.length && !inField) {
          e.preventDefault();
          dispatch({ type: "FILECLIP", payload: selected, mode: "copy" });
        } else if (k === "x" && selected.length && !inField) {
          e.preventDefault();
          dispatch({ type: "FILECLIP", payload: selected, mode: "cut" });
        } else if (k === "v" && !inField && files.clip?.ids?.length) {
          e.preventDefault();
          paste();
        } else if (k === "l" && !inField) {
          e.preventDefault();
          setEditingPath(true);
        } else if (k === "e" && !inField) {
          e.preventDefault();
          dispatch({ type: "EXPLORER", payload: "full" });
        } else if (k === "n" && e.shiftKey && !inField) {
          e.preventDefault();
          newFolder();
        }
        return;
      }
      if (inField) return;
      if (e.key === "F2" && selected.length === 1) {
        e.preventDefault();
        startRename(files.data.getId(selected[0]));
      } else if (e.key === "Delete" && selected.length) {
        e.preventDefault();
        del(selected);
      } else if (e.key === "F5") {
        e.preventDefault();
        dispatch({ type: "FILEDIR", payload: cdir });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: "FILEPREV" });
      } else if (e.key === "Enter" && selected.length === 1) {
        e.preventDefault();
        open(files.data.getId(selected[0]));
      } else if (e.key === "Escape") {
        setSelected([]);
        setCtx(null);
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        dispatch({ type: "FILEPREV" });
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "FILENEXT" });
      } else if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        dispatch({ type: "FILEBACK" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wnapp.alive, wnapp.hide, wnapp.z, list, selected, cdir, cpath, files.clip, apps.hz]);

  if (!cdata) return null;

  /* ---------------- breadcrumb ---------------- */
  const crumbs = [];
  let walk = cdata;
  while (walk) {
    crumbs.unshift(walk);
    walk = walk.host;
  }

  const propsItem = selItems.length === 1 ? selItems[0] : null;

  const showProps = async () => {
    if (!propsItem) return;
    const p = vs.pathOf(propsItem);
    const isDir = propsItem.type === "folder";
    const kids = isDir ? (propsItem.data || []).length : null;
    const size = isDir ? null : (propsItem.size ?? String(propsItem.data ?? "").length);
    await wosConfirm(
      [
        `Type of item:  ${typeLabel(propsItem)}`,
        `Location:  ${p.slice(0, p.lastIndexOf("\\")) || p}`,
        isDir
          ? `Contains:  ${kids} item${kids === 1 ? "" : "s"}`
          : `Size:  ${bytes(size)} (${size?.toLocaleString?.() ?? 0} bytes)`,
        `Created:  ${fmtDate(propsItem.created || propsItem.updated)}`,
        `Modified:  ${fmtDate(propsItem.updated)}`,
        "",
        `Full path:  ${p}`,
      ].join("\n"),
      { title: `${propsItem.name} Properties`, okText: "OK", cancelText: "Close" },
    );
  };

  return (
    <div
      ref={rootRef}
      className="msfiles fxp floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
      data-view={files.view}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="File Explorer" />

      <div className="windowScreen flex flex-col">
        {/* ---------------- command bar ---------------- */}
        <div className="fxCmd">
          <WosFlyout
            align="left"
            width={230}
            trigger={
              <button type="button" className="fxCmdBtn fxNew">
                <span className="fxIco">{<Glyph d={G.folderPlus} />}</span>
                <span>New</span>
                <span className="fxChev">{<Glyph d={G.chevD} size={11} />}</span>
              </button>
            }
            items={[
              { head: "Create a new item" },
              {
                label: "Folder",
                icon: <Glyph d={G.folderPlus} />,
                kbd: "Ctrl+Shift+N",
                onClick: newFolder,
              },
              { label: "Text Document", icon: <Glyph d={G.filePlus} />, onClick: newTextFile },
              { sep: true },
              {
                label: "Upload from this device",
                icon: <Glyph d={G.upload} />,
                onClick: () => fileInput.current?.click(),
              },
            ]}
          />

          <span className="fxSep" />

          <button
            type="button"
            className="fxCmdBtn ico"
            disabled={!selected.length}
            title="Cut (Ctrl+X)"
            onClick={() => dispatch({ type: "FILECLIP", payload: selected, mode: "cut" })}
          >
            <Glyph d={G.cut} />
          </button>
          <button
            type="button"
            className="fxCmdBtn ico"
            disabled={!selected.length}
            title="Copy (Ctrl+C)"
            onClick={() => dispatch({ type: "FILECLIP", payload: selected, mode: "copy" })}
          >
            <Glyph d={G.copy} />
          </button>
          <button
            type="button"
            className="fxCmdBtn ico"
            disabled={!files.clip}
            title="Paste (Ctrl+V)"
            onClick={paste}
          >
            <Glyph d={G.paste} />
          </button>
          <button
            type="button"
            className="fxCmdBtn ico"
            disabled={selected.length !== 1}
            title="Rename (F2)"
            onClick={() => startRename(selItems[0])}
          >
            <Glyph d={G.rename} />
          </button>
          <button
            type="button"
            className="fxCmdBtn ico"
            disabled={!selected.length}
            title="Share"
            onClick={() =>
              notify({
                app: "File Explorer",
                icon: "img/icon/explorer.png",
                title: "Sharing is not set up",
                body: "This PC keeps its files to itself.",
                kind: "info",
              })
            }
          >
            <Glyph d={G.share} />
          </button>
          <button
            type="button"
            className="fxCmdBtn ico danger"
            disabled={!selected.length}
            title="Delete (Del)"
            onClick={() => del(selected)}
          >
            <Glyph d={G.bin} />
          </button>

          <span className="fxSep" />

          <WosFlyout
            align="left"
            width={210}
            trigger={
              <button type="button" className="fxCmdBtn">
                <span className="fxIco">
                  <Glyph d={G.sort} />
                </span>
                <span>Sort</span>
              </button>
            }
            items={[
              { head: "Sort by" },
              {
                label: "Name",
                icon: files.sort?.by === "name" ? "✓" : null,
                onClick: () => dispatch({ type: "FILESORT", payload: { by: "name" } }),
              },
              {
                label: "Date modified",
                icon: files.sort?.by === "modified" ? "✓" : null,
                onClick: () => dispatch({ type: "FILESORT", payload: { by: "modified" } }),
              },
              {
                label: "Type",
                icon: files.sort?.by === "type" ? "✓" : null,
                onClick: () => dispatch({ type: "FILESORT", payload: { by: "type" } }),
              },
              {
                label: "Size",
                icon: files.sort?.by === "size" ? "✓" : null,
                onClick: () => dispatch({ type: "FILESORT", payload: { by: "size" } }),
              },
              { sep: true },
              {
                label: "Ascending",
                icon: files.sort?.asc !== false ? "✓" : null,
                onClick: () => dispatch({ type: "FILESORT", payload: { asc: true } }),
              },
              {
                label: "Descending",
                icon: files.sort?.asc === false ? "✓" : null,
                onClick: () => dispatch({ type: "FILESORT", payload: { asc: false } }),
              },
            ]}
          />

          <WosFlyout
            align="left"
            width={210}
            trigger={
              <button type="button" className="fxCmdBtn">
                <span className="fxIco">
                  <Glyph d={G.view} />
                </span>
                <span>View</span>
              </button>
            }
            items={[
              { head: "Layout" },
              {
                label: "Large icons",
                icon: files.view === 1 ? "✓" : null,
                onClick: () => dispatch({ type: "FILEVIEW", payload: 1 }),
              },
              {
                label: "Tiles",
                icon: files.view === 3 ? "✓" : null,
                onClick: () => dispatch({ type: "FILEVIEW", payload: 3 }),
              },
              {
                label: "List",
                icon: files.view === 4 ? "✓" : null,
                onClick: () => dispatch({ type: "FILEVIEW", payload: 4 }),
              },
              {
                label: "Details",
                icon: files.view === 5 ? "✓" : null,
                onClick: () => dispatch({ type: "FILEVIEW", payload: 5 }),
              },
              { sep: true },
              {
                label: details ? "Hide the details pane" : "Show the details pane",
                icon: <Glyph d={G.info} />,
                onClick: () => setDetails((v) => !v),
              },
            ]}
          />

          <span className="fxSpacer" />

          <button
            type="button"
            className="fxCmdBtn ico"
            title={details ? "Hide details" : "Show details"}
            data-on={details}
            onClick={() => setDetails((v) => !v)}
          >
            <Glyph d={G.info} />
          </button>
          <WosFlyout
            align="right"
            width={230}
            trigger={
              <button type="button" className="fxCmdBtn ico" title="See more">
                <Glyph d={G.dots} />
              </button>
            }
            items={[
              {
                label: "Open in Terminal",
                icon: <Glyph d={G.terminal} />,
                onClick: () => dispatch({ type: "OPENTERM", payload: cpath }),
              },
              {
                label: "Copy path",
                icon: <Glyph d={G.copy} />,
                onClick: () => {
                  try {
                    navigator.clipboard?.writeText(cpath);
                  } catch (e) {}
                  notify({
                    app: "File Explorer",
                    icon: "img/icon/explorer.png",
                    title: "Path copied",
                    body: cpath,
                    kind: "success",
                    life: 3,
                  });
                },
              },
              { sep: true },
              {
                label: "Refresh",
                kbd: "F5",
                icon: <Glyph d={G.reload} />,
                onClick: () => dispatch({ type: "FILEDIR", payload: cdir }),
              },
              {
                label: "Properties",
                kbd: "Alt+Enter",
                icon: <Glyph d={G.info} />,
                disabled: !propsItem,
                onClick: showProps,
              },
            ]}
          />
        </div>

        {/* ---------------- address bar ---------------- */}
        <div className="fxAddr">
          <button
            type="button"
            className="fxNav"
            disabled={files.hid === 0}
            title="Back (Alt+←)"
            onClick={() => dispatch({ type: "FILEPREV" })}
          >
            <Glyph d={G.back} />
          </button>
          <button
            type="button"
            className="fxNav"
            disabled={files.hid + 1 >= files.hist.length}
            title="Forward (Alt+→)"
            onClick={() => dispatch({ type: "FILENEXT" })}
          >
            <Glyph d={G.fwd} />
          </button>
          <button
            type="button"
            className="fxNav"
            disabled={!cdata.host}
            title="Up (Alt+↑)"
            onClick={() => dispatch({ type: "FILEBACK" })}
          >
            <Glyph d={G.up} />
          </button>
          <button
            type="button"
            className="fxNav"
            title="Refresh (F5)"
            onClick={() => dispatch({ type: "FILEDIR", payload: cdir })}
          >
            <Glyph d={G.reload} />
          </button>

          <div
            className="fxPath"
            onDoubleClick={() => {
              setEditingPath(true);
            }}
          >
            {editingPath ? (
              <input
                autoFocus
                value={pathText}
                spellCheck={false}
                onChange={(e) => setPathText(e.target.value)}
                onBlur={() => {
                  setEditingPath(false);
                  setPathText(cpath);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    goPath(pathText.trim());
                    setEditingPath(false);
                  }
                  if (e.key === "Escape") {
                    setEditingPath(false);
                    setPathText(cpath);
                  }
                }}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="fxCrumb root"
                  title="This PC"
                  onClick={() => {
                    const pc = files.data.parsePath("C:\\");
                    if (pc) goto(pc);
                  }}
                >
                  <Glyph d={G.home} size={14} />
                </button>
                {crumbs.map((c) => (
                  <React.Fragment key={c.id}>
                    <span className="fxChevron">
                      <Glyph d={G.chevR} size={10} />
                    </span>
                    <button
                      type="button"
                      className="fxCrumb"
                      onClick={() => goto(c.id)}
                      title={vs.pathOf(c)}
                    >
                      {c.name}
                    </button>
                  </React.Fragment>
                ))}
                <span className="fxPathPad" onClick={() => setEditingPath(true)} />
              </>
            )}
          </div>

          <div className="fxSearch">
            <span className="fxSearchIco">
              <Glyph d={G.search} size={14} />
            </span>
            <input
              value={search}
              placeholder={`Search ${cdata.name}`}
              spellCheck={false}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button type="button" className="fxSearchX" onClick={() => setSearch("")}>
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
          </div>
        </div>

        {/* ---------------- body ---------------- */}
        <div className="fxBody">
          <NavPane
            currentId={cdir}
            onGoto={goto}
            name={personName}
            special={files.data.special}
            parsePath={files.data.parsePath.bind(files.data)}
          />

          <div
            className={`fxContent ${dragOver ? "drop" : ""}`}
            ref={contentRef}
            tabIndex={-1}
            onMouseDown={bandDown}
            onClick={() => {
              setSelected([]);
              setCtx(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCtx({ x: e.clientX, y: e.clientY, on: null });
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer?.files?.length) importFiles(e.dataTransfer.files);
            }}
          >
            <div className="fxBand" ref={bandRef} />
            {list.length === 0 ? (
              <div className="fxEmpty">
                <svg viewBox="0 0 64 48" width="72" height="54" aria-hidden>
                  <path
                    d="M4 12a4 4 0 0 1 4-4h14l6 6h28a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.5"
                  />
                </svg>
                <p>{search ? `No items match "${search}".` : "This folder is empty."}</p>
                {!search ? (
                  <button
                    type="button"
                    className="fxEmptyBtn"
                    onClick={() => fileInput.current?.click()}
                  >
                    Upload from this device
                  </button>
                ) : null}
              </div>
            ) : null}

            {files.view === 5 ? (
              <table className="fxTable">
                <thead>
                  <tr>
                    {["Name", "Date modified", "Type", "Size"].map((h, i) => (
                      <th
                        key={h}
                        onClick={() =>
                          dispatch({
                            type: "FILESORT",
                            payload: {
                              by: ["name", "modified", "type", "size"][i],
                              asc:
                                files.sort?.by === ["name", "modified", "type", "size"][i]
                                  ? !files.sort?.asc
                                  : true,
                            },
                          })
                        }
                      >
                        <span>{h}</span>
                        {files.sort?.by === ["name", "modified", "type", "size"][i] ? (
                          <i className="fxSortArr">{files.sort.asc === false ? "↓" : "↑"}</i>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => {
                    const ico = iconForItem(item);
                    return (
                      <tr
                        key={item.id}
                        data-id={item.id}
                        draggable
                        onDragStart={(e) => {
                          const ids = selected.includes(item.id) ? selected : [item.id];
                          e.dataTransfer.setData("application/x-wos-files", JSON.stringify(ids));
                          e.dataTransfer.effectAllowed = "copyMove";
                        }}
                        data-sel={selected.includes(item.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          select(item, e);
                        }}
                        onDoubleClick={() => open(item)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!selected.includes(item.id)) setSelected([item.id]);
                          setCtx({ x: e.clientX, y: e.clientY, on: item.id });
                        }}
                      >
                        <td>
                          {renaming === item.id ? (
                            <input
                              data-ren={item.id}
                              value={renVal}
                              autoFocus
                              onChange={(e) => setRenVal(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setRenaming(null);
                              }}
                            />
                          ) : (
                            <>
                              <img
                                src={`img/icon/${ico.src}.png`}
                                alt=""
                                width="16"
                                height="16"
                                onError={(e) => (e.target.src = "img/icon/win/folder.png")}
                              />
                              <span>{item.name}</span>
                            </>
                          )}
                        </td>
                        <td>{fmtDate(item.updated)}</td>
                        <td>{typeLabel(item)}</td>
                        <td>
                          {item.type === "folder"
                            ? ""
                            : bytes(item.size ?? String(item.data ?? "").length)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div
                className={`fxGrid ${files.view === 4 ? "list" : files.view === 3 ? "tiles" : "large"}`}
              >
                {list.map((item) => {
                  const ico = iconForItem(item);
                  return (
                    <div
                      key={item.id}
                      className="fxItem"
                      data-id={item.id}
                      draggable
                      onDragStart={(e) => {
                        const ids = selected.includes(item.id) ? selected : [item.id];
                        e.dataTransfer.setData("application/x-wos-files", JSON.stringify(ids));
                        e.dataTransfer.effectAllowed = "copyMove";
                      }}
                      data-sel={selected.includes(item.id)}
                      data-clip={files.clip?.ids?.includes(item.id) && files.clip?.mode === "cut"}
                      onClick={(e) => {
                        e.stopPropagation();
                        select(item, e);
                      }}
                      onDoubleClick={() => open(item)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selected.includes(item.id)) setSelected([item.id]);
                        setCtx({ x: e.clientX, y: e.clientY, on: item.id });
                      }}
                      title={item.name}
                    >
                      {renaming === item.id ? (
                        <div className="fxRenBox" data-ren={item.id}>
                          <input
                            value={renVal}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setRenVal(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") setRenaming(null);
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <img
                            className="fxItemIco"
                            src={`img/icon/${ico.src}.png`}
                            alt=""
                            onError={(e) => (e.target.src = "img/icon/win/folder.png")}
                          />
                          <span className="fxItemName">{item.name}</span>
                          {files.view === 3 || files.view === 4 ? (
                            <span className="fxItemMeta">
                              {item.type === "folder"
                                ? `${(item.data || []).length} items`
                                : bytes(item.size ?? String(item.data ?? "").length)}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {details ? (
            <DetailsPane item={propsItem} count={list.length} sel={selItems.length} path={cpath} />
          ) : null}
        </div>

        {/* ---------------- status bar ---------------- */}
        <div className="fxStatus">
          <span>
            {list.length} item{list.length === 1 ? "" : "s"}
          </span>
          {selected.length ? (
            <span>
              {selected.length} item{selected.length === 1 ? "" : "s"} selected
            </span>
          ) : null}
          {selected.length === 1 && selItems.length === 1 && selItems[0]?.type !== "folder" ? (
            <span>{bytes(selItems[0].size ?? String(selItems[0].data ?? "").length)}</span>
          ) : null}
          <span className="fxStatusSpacer" />
          {busy ? <span>Working…</span> : null}
          {[1, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              className="fxViewBtn"
              data-on={files.view === v}
              title={{ 1: "Large icons", 3: "Tiles", 4: "List", 5: "Details" }[v]}
              onClick={() => dispatch({ type: "FILEVIEW", payload: v })}
            >
              <Glyph d={v === 5 ? G.details : v === 4 ? G.list : G.grid} size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- context menu ---------------- */}
      {ctx ? (
        <div
          className="wosFlyout fxCtx"
          style={{
            position: "fixed",
            left: Math.min(ctx.x, window.innerWidth - 240),
            top: Math.min(ctx.y, window.innerHeight - 340),
            width: 232,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctx.on ? (
            <>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  open(files.data.getId(ctx.on));
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.fwd} />
                </span>
                <span className="lbl">Open</span>
              </button>
              {ctxItem && ctxItem.type === "file" ? (
                <>
                  <div className="wosFlyHead">Open with</div>
                  {openWith(ctxItem.name).map((key) => {
                    const app = APPS[key];
                    if (!app) return null;
                    const isDefault = appForFile(ctxItem.name) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="wosFlyItem fxCtxApp"
                        data-app={key}
                        data-default={isDefault ? "1" : "0"}
                        onClick={() => {
                          openFileWith(
                            key,
                            { ...ctxItem, path: vs.pathOf(ctxItem) },
                            { explicit: true },
                          );
                          setCtx(null);
                        }}
                      >
                        <span className="glyph">
                          <Glyph d={key === "edge" ? G.edge : G.file} />
                        </span>
                        <span className="lbl">
                          {app.label}
                          {isDefault ? "  ·  default" : ""}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="wosFlyItem fxCtxAlways"
                    onClick={() => {
                      const it = ctxItem;
                      const ext = assocExt(it.name);
                      const cur = overrides()[ext];
                      if (cur) {
                        setOverride(ext, null);
                        notify({
                          app: "File Explorer",
                          icon: "img/icon/explorer.png",
                          title: `Reset .${ext}`,
                          body: `Back to the default app for .${ext}.`,
                          kind: "info",
                          life: 4,
                        });
                      } else {
                        /* the app they just picked by hand, or the default —
                           never a silent no-op on the default app */
                        const key = alwaysKeyFor(it.name);
                        setOverride(ext, key);
                        notify({
                          app: "File Explorer",
                          icon: "img/icon/explorer.png",
                          title: `Always open .${ext} with ${APPS[key]?.label || key}`,
                          body: "Change it any time from this same menu.",
                          kind: "info",
                          life: 5,
                        });
                      }
                      setCtx(null);
                    }}
                  >
                    <span className="glyph">
                      <Glyph d={G.cog} />
                    </span>
                    <span className="lbl">
                      {overrides()[assocExt(ctxItem.name)]
                        ? `Reset .${assocExt(ctxItem.name)} association`
                        : `Always use ${APPS[alwaysKeyFor(ctxItem.name)]?.label || "Notepad"} for .${assocExt(ctxItem.name) || "this type"}`}
                    </span>
                  </button>
                </>
              ) : null}
              <div className="wosFlySep" />
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  dispatch({ type: "FILECLIP", payload: selected, mode: "cut" });
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.cut} />
                </span>
                <span className="lbl">Cut</span>
                <span className="kbd">Ctrl+X</span>
              </button>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  dispatch({ type: "FILECLIP", payload: selected, mode: "copy" });
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.copy} />
                </span>
                <span className="lbl">Copy</span>
                <span className="kbd">Ctrl+C</span>
              </button>
              <div className="wosFlySep" />
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  startRename(selItems[0]);
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.rename} />
                </span>
                <span className="lbl">Rename</span>
                <span className="kbd">F2</span>
              </button>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  del(selected);
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.bin} />
                </span>
                <span className="lbl">Delete</span>
                <span className="kbd">Del</span>
              </button>
              <div className="wosFlySep" />
              {selItems.length === 1 && selItems[0].type === "folder" ? (
                <button
                  type="button"
                  className="wosFlyItem"
                  onClick={() => {
                    dispatch({ type: "OPENTERM", payload: vs.pathOf(selItems[0]) });
                    setCtx(null);
                  }}
                >
                  <span className="glyph">
                    <Glyph d={G.terminal} />
                  </span>
                  <span className="lbl">Open in Terminal</span>
                </button>
              ) : null}
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  setCtx(null);
                  showProps();
                }}
              >
                <span className="glyph">
                  <Glyph d={G.info} />
                </span>
                <span className="lbl">Properties</span>
                <span className="kbd">Alt+Enter</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  newFolder();
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.folderPlus} />
                </span>
                <span className="lbl">New folder</span>
                <span className="kbd">Ctrl+Shift+N</span>
              </button>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  newTextFile();
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.filePlus} />
                </span>
                <span className="lbl">New text document</span>
              </button>
              <div className="wosFlySep" />
              <button
                type="button"
                className="wosFlyItem"
                disabled={!files.clip}
                onClick={() => {
                  paste();
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.paste} />
                </span>
                <span className="lbl">Paste</span>
                <span className="kbd">Ctrl+V</span>
              </button>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  fileInput.current?.click();
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.upload} />
                </span>
                <span className="lbl">Upload from this device</span>
              </button>
              <div className="wosFlySep" />
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  dispatch({ type: "OPENTERM", payload: cpath });
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.terminal} />
                </span>
                <span className="lbl">Open in Terminal</span>
              </button>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  dispatch({ type: "FILEDIR", payload: cdir });
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.reload} />
                </span>
                <span className="lbl">Refresh</span>
                <span className="kbd">F5</span>
              </button>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  dispatch({ type: "FILEVIEW", payload: files.view === 5 ? 1 : 5 });
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.view} />
                </span>
                <span className="lbl">View</span>
              </button>
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  setDetails((v) => !v);
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.info} />
                </span>
                <span className="lbl">{details ? "Hide" : "Show"} details pane</span>
              </button>
              <div className="wosFlySep" />
              <button
                type="button"
                className="wosFlyItem"
                onClick={() => {
                  dispatch({ type: "SETTINGS", payload: "full" });
                  setCtx(null);
                }}
              >
                <span className="glyph">
                  <Glyph d={G.star} />
                </span>
                <span className="lbl">Personalise</span>
              </button>
            </>
          )}
        </div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          importFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
};

/* ================================================================== *
 *  Navigation pane
 * ================================================================== */

const NAV = [
  {
    head: "Quick access",
    items: [
      { icon: "desk", title: "Desktop", spid: "%desktop%" },
      { icon: "down", title: "Downloads", spid: "%downloads%" },
      { icon: "docs", title: "Documents", spid: "%documents%" },
      { icon: "pics", title: "Pictures", spid: "%pictures%" },
      { icon: "music", title: "Music", spid: "%music%" },
      { icon: "vid", title: "Videos", spid: "%videos%" },
    ],
  },
];

const NavPane = ({ currentId, onGoto, name, special, parsePath }) => {
  const [open, setOpen] = useState({ qa: true, pc: true });
  const go = (spid) => special[spid] && onGoto(special[spid]);
  const user = name || "Tester";

  const Row = ({ icon, title, spid, path, indent = 0, bold = false }) => {
    const id = spid ? special[spid] : path ? parsePath(path) : null;
    return (
      <button
        type="button"
        className="fxNavRow"
        data-on={id && id === currentId}
        style={{ paddingLeft: 10 + indent * 16 }}
        onClick={() => id && onGoto(id)}
        title={title}
      >
        <img
          src={`img/icon/win/${icon}-sm.png`}
          alt=""
          width="16"
          height="16"
          onError={(e) => (e.target.src = "img/icon/win/folder-sm.png")}
        />
        <span className={bold ? "b" : ""}>{title}</span>
      </button>
    );
  };

  return (
    <div className="fxPane win11Scroll">
      <button
        type="button"
        className="fxNavHead"
        onClick={() => setOpen((o) => ({ ...o, qa: !o.qa }))}
      >
        <span className="fxNavChev" data-open={open.qa}>
          <Glyph d={G.chevD} size={11} />
        </span>
        <img src="img/icon/win/star-sm.png" alt="" width="16" height="16" />
        <span>Quick access</span>
      </button>
      {open.qa ? (
        <div className="fxNavKids">
          {NAV[0].items.map((x) => (
            <Row key={x.spid} {...x} indent={1} />
          ))}
          <Row icon="folder" title={user} spid="%user%" indent={1} />
        </div>
      ) : null}

      <button
        type="button"
        className="fxNavHead"
        onClick={() => go("%onedrive%")}
        data-on={special["%onedrive%"] === currentId}
      >
        <span className="fxNavChev static">
          <Glyph d={G.chevD} size={11} style={{ opacity: 0 }} />
        </span>
        <img src="img/icon/win/onedrive-sm.png" alt="" width="16" height="16" />
        <span>OneDrive</span>
      </button>

      <button
        type="button"
        className="fxNavHead"
        onClick={() => setOpen((o) => ({ ...o, pc: !o.pc }))}
      >
        <span className="fxNavChev" data-open={open.pc}>
          <Glyph d={G.chevD} size={11} />
        </span>
        <img src="img/icon/win/thispc-sm.png" alt="" width="16" height="16" />
        <span>This PC</span>
      </button>
      {open.pc ? (
        <div className="fxNavKids">
          <Row icon="desk" title="Desktop" spid="%desktop%" indent={1} />
          <Row icon="docs" title="Documents" spid="%documents%" indent={1} />
          <Row icon="down" title="Downloads" spid="%downloads%" indent={1} />
          <Row icon="music" title="Music" spid="%music%" indent={1} />
          <Row icon="pics" title="Pictures" spid="%pictures%" indent={1} />
          <Row icon="vid" title="Videos" spid="%videos%" indent={1} />
          <Row icon="disc" title="OS (C:)" spid="%cdrive%" indent={1} />
          <Row icon="disk" title="Data (D:)" spid="%ddrive%" indent={1} />
        </div>
      ) : null}

      <button type="button" className="fxNavHead" onClick={() => go("%network%")} data-on={false}>
        <span className="fxNavChev static">
          <Glyph d={G.chevD} size={11} style={{ opacity: 0 }} />
        </span>
        <img
          src="img/icon/win/net.png"
          alt=""
          width="16"
          height="16"
          onError={(e) => (e.target.src = "img/icon/win/folder-sm.png")}
        />
        <span>Network</span>
      </button>

      <div className="fxNavFoot">
        <span>Virtual Storage</span>
        <i>Backed by IndexedDB</i>
      </div>
    </div>
  );
};

/* ================================================================== *
 *  Details pane
 * ================================================================== */

const DetailsPane = ({ item, count, sel, path }) => (
  <div className="fxDetails">
    {item ? (
      <>
        <img
          className="fxDetailsIco"
          src={`img/icon/${iconForItem(item).src}.png`}
          alt=""
          onError={(e) => (e.target.src = "img/icon/win/folder.png")}
        />
        <b className="fxDetailsName">{item.name}</b>
        <span className="fxDetailsType">{typeLabel(item)}</span>
        <dl>
          <dt>Location</dt>
          <dd>{path}</dd>
          {item.type !== "folder" ? (
            <>
              <dt>Size</dt>
              <dd>{bytes(item.size ?? String(item.data ?? "").length)}</dd>
            </>
          ) : (
            <>
              <dt>Contains</dt>
              <dd>{(item.data || []).length} items</dd>
            </>
          )}
          <dt>Modified</dt>
          <dd>{fmtDate(item.updated) || "—"}</dd>
          {item.mime ? (
            <>
              <dt>Content type</dt>
              <dd>{item.mime}</dd>
            </>
          ) : null}
        </dl>
        <p className="fxDetailsNote">
          Stored in Virtual Storage on this device. Nothing leaves your browser.
        </p>
      </>
    ) : (
      <>
        <img className="fxDetailsIco" src="img/icon/win/folder.png" alt="" />
        <b className="fxDetailsName">{sel ? `${sel} items selected` : "No item selected"}</b>
        <span className="fxDetailsType">
          {count} item{count === 1 ? "" : "s"} in this folder
        </span>
        <dl>
          <dt>Folder</dt>
          <dd>{path}</dd>
        </dl>
        <p className="fxDetailsNote">Select a file to see its properties. Right-click for more.</p>
      </>
    )}
  </div>
);

export default Explorer;
