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

import { Bin, Item } from "../utils/bin";
import fdata from "./dir.json";
import * as vs from "../utils/os/vs";

const defState = {
  cdir: "%user%",
  hist: [],
  hid: 0,
  view: 1,
  clip: null,
  selected: null,
  sort: { by: "name", asc: true },
  ready: false,
};

defState.hist.push(defState.cdir);
defState.data = new Bin();
defState.data.parse(fdata);

/**
 * Hand the reducer's Bin to VS, which re-parses the stored tree into it.
 * VS cannot see the store from here (this module is imported *by* the store),
 * so it fires a window event and reducers/index.js turns that into FILEHYDRATE.
 */
vs.hydrate(null, defState.data)
  .then(() => {
    const special = defState.data.special["%user%"];
    if (special && defState.cdir === "%user%") defState.hist[0] = special;
    try {
      window.dispatchEvent(new CustomEvent("webos-vs-ready"));
    } catch (e) {}
  })
  .catch(() => {});

const persist = () => vs.persist();

const fileReducer = (state = defState, action) => {
  var tmp = { ...state };
  var navHist = false;
  var dirty = false;

  if (action.type === "FILEHYDRATE") {
    tmp.ready = true;
    // ids changed when VS re-parsed the tree — re-anchor the current folder
    const special = tmp.data.special["%user%"];
    if (!tmp.data.getId(tmp.cdir) && special) {
      tmp.cdir = special;
      tmp.hist = [special];
      tmp.hid = 0;
    }
  } else if (action.type === "FILEHOME") {
    // closing File Explorer forgets where you were — next open starts at home
    const home = tmp.data.special["%user%"];
    if (home) {
      tmp.cdir = home;
      tmp.hist = [home];
      tmp.hid = 0;
      tmp.selected = null;
      tmp.clip = null;
    }
  } else if (action.type === "FILEDIR") {
    tmp.cdir = action.payload;
  } else if (action.type === "FILEPATH") {
    var pathid = tmp.data.parsePath(action.payload);
    if (pathid) tmp.cdir = pathid;
    else if (action.onFail) action.onFail(action.payload);
  } else if (action.type === "FILEBACK") {
    var item = tmp.data.getId(tmp.cdir);
    if (item?.host) tmp.cdir = item.host.id;
  } else if (action.type === "FILEVIEW") {
    tmp.view = Number(action.payload) || 1;
  } else if (action.type === "FILESORT") {
    tmp.sort = { ...tmp.sort, ...action.payload };
  } else if (action.type === "FILEPREV") {
    tmp.hid = Math.max(0, tmp.hid - 1);
    navHist = true;
  } else if (action.type === "FILENEXT") {
    tmp.hid = Math.min(tmp.hist.length - 1, tmp.hid + 1);
    navHist = true;
  } else if (action.type === "FILESEL") {
    // payload may be an id, an array of ids, or null
    tmp.selected = action.payload;
  } else if (action.type === "FILEMKDIR") {
    const made = tmp.data.addItem(tmp.cdir, {
      type: "folder",
      name: action.payload || "New folder",
      info: { icon: "folder" },
    });
    if (made) {
      made.created = made.updated = Date.now();
      tmp.selected = made.id;
      dirty = true;
    }
  } else if (action.type === "FILEMKFILE") {
    const name = action.payload || "New Text Document.txt";
    const made = tmp.data.addItem(tmp.cdir, {
      type: "file",
      name,
      data: action.data ?? "",
      info: { icon: vs.iconFor(name) },
    });
    if (made) {
      made.created = made.updated = Date.now();
      made.size = String(made.data || "").length;
      tmp.selected = made.id;
      dirty = true;
    }
  } else if (action.type === "FILEDEL") {
    const ids = Array.isArray(action.payload)
      ? action.payload
      : [action.payload || tmp.selected].filter(Boolean);
    const gone = [];
    ids.forEach((id) => {
      const it = tmp.data.getId(id);
      if (it) gone.push(it);
    });
    if (gone.length) {
      import("../utils/idb").then(({ idb }) => {
        idb.get("recycle").then((bin) => {
          const list = Array.isArray(bin) ? bin : [];
          gone.forEach((g) => {
            const path = vs.pathOf(g);
            // one entry per path — replacing whatever was there before
            const kept = list.filter((r) => r.path !== path);
            kept.push({
              path,
              id: path,
              name: g.name,
              type: g.type,
              data: g.type === "folder" ? null : g.data,
              mime: g.mime || "",
              size: vs.recordBytes(g),
              at: Date.now(),
            });
            list.length = 0;
            kept.forEach((r) => list.push(r));
          });
          idb.set("recycle", list);
        });
      });
      gone.forEach((g) => tmp.data.removeItem(g.id));
      dirty = true;
    }
    tmp.selected = null;
  } else if (action.type === "FILEREN") {
    const id = action.payload?.id || tmp.selected;
    const name = action.payload?.name;
    if (id && name) {
      tmp.data.renameItem(id, name);
      const it = tmp.data.getId(id);
      if (it) {
        it.updated = Date.now();
        if (it.type !== "folder") {
          it.info = { ...it.info, icon: vs.iconFor(name) };
          it.size = String(it.data ?? "").length;
        }
      }
      dirty = true;
    }
  } else if (action.type === "FILECLIP") {
    const ids = Array.isArray(action.payload)
      ? action.payload
      : [action.payload || tmp.selected].filter(Boolean);
    if (ids.length) tmp.clip = { ids, mode: action.mode || "copy" };
  } else if (action.type === "FILEPASTE") {
    if (tmp.clip?.ids?.length) {
      tmp.clip.ids.forEach((id) => {
        const src = tmp.data.getId(id);
        if (!src) return;
        const cloneInto = (host, item) => {
          const copy = new Item({
            type: item.type,
            name: item.name,
            info: { ...item.info },
            host,
          });
          copy.created = copy.updated = Date.now();
          if (item.type === "folder") {
            copy.data = (item.data || []).map((c) => cloneInto(copy, c));
          } else {
            copy.data = item.data;
            copy.mime = item.mime;
            copy.size = item.size;
          }
          tmp.data.setId(copy.id, copy);
          return copy;
        };
        let name = src.name;
        const base = name.replace(/(\.[^.]+)$/, "");
        const ext = name.endsWith(base) ? "" : name.slice(base.length);
        const host = tmp.data.getId(tmp.cdir);
        const replace = action.payload?.replace === true;
        /* Replace drops the original; Keep both (the default) is the only
           path that may invent "name (2)" — and only because it was asked
           for. Never rename silently. */
        const clash = (host?.data || []).find(
          (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== src.id,
        );
        if (clash && replace) {
          tmp.data.removeItem(clash.id);
        } else if (clash) {
          let n = 2;
          while ((host?.data || []).some((c) => c.name.toLowerCase() === name.toLowerCase())) {
            name = `${base} (${n})${ext}`;
            n += 1;
          }
        }
        const fresh = cloneInto(host, src);
        fresh.name = name;
        host.data = [...(host.data || []), fresh];
        if (tmp.clip.mode === "cut") tmp.data.removeItem(src.id);
      });
      if (tmp.clip.mode === "cut") tmp.clip = null;
      dirty = true;
    }
  } else if (action.type === "FILEREFRESH") {
    // another app (Recycle Bin, Paint, Edge downloads…) changed the tree
    dirty = true;
  } else if (action.type === "FILEIMPORT") {
    // a real file dropped from the user's actual computer
    const { name, data, mime, size } = action.payload || {};
    if (name) {
      const made = tmp.data.addItem(tmp.cdir, {
        type: "file",
        name,
        data,
        info: { icon: vs.iconFor(name) },
      });
      if (made) {
        made.mime = mime;
        made.size = size;
        made.created = made.updated = Date.now();
        tmp.selected = made.id;
        dirty = true;
      }
    }
  }

  if (dirty) {
    persist();
    // the Bin tree mutates in place, so folder nodes keep the same object
    // identity — bump an epoch so views that select() this slice actually
    // recompute their lists after create/delete/rename/upload/paste.
    tmp.epoch = (tmp.epoch || 0) + 1;
  }

  if (!navHist && tmp.cdir != tmp.hist[tmp.hid]) {
    tmp.hist = tmp.hist.slice(0, tmp.hid + 1);
    tmp.hist.push(tmp.cdir);
    tmp.hid = tmp.hist.length - 1;
  }

  tmp.cdir = tmp.hist[tmp.hid] ?? tmp.cdir;
  if (tmp.cdir && tmp.cdir.includes("%")) {
    if (tmp.data.special[tmp.cdir] != null) {
      tmp.cdir = tmp.data.special[tmp.cdir];
      tmp.hist[tmp.hid] = tmp.cdir;
    }
  }

  tmp.cpath = tmp.data.getPath(tmp.cdir);
  return tmp;
};

export default fileReducer;
