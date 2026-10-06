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

export class Item {
  constructor({ type, name, info, data, host }) {
    this.type = type || "folder";
    this.name = name;
    this.info = info || {};
    this.info.icon = this.info.icon || this.type;
    this.data = data;
    this.host = host;
    this.id = this.gene();
  }

  gene() {
    return Math.random().toString(36).substring(2, 10).toLowerCase();
  }

  getId() {
    return this.id;
  }

  getData() {
    return this.data;
  }

  setData(data) {
    this.data = data;
  }
}

export class Bin {
  constructor() {
    this.tree = [];
    this.lookup = {};
    this.special = {};
  }

  setSpecial(spid, id) {
    this.special[spid] = id;
  }

  setId(id, item) {
    this.lookup[id] = item;
  }

  getId(id) {
    return this.lookup[id];
  }

  /** Full Windows path of an item — "C:\\Users\\Blue\\Documents". */
  getPath(id) {
    const parts = [];
    let curr = this.getId(id);
    while (curr) {
      parts.unshift(curr.name);
      curr = curr.host;
    }
    let p = parts.join("\\");
    if (/^[a-z]:$/i.test(p)) p += "\\";
    if (/^[a-z]:\\/i.test(p)) p = p[0].toUpperCase() + p.slice(1);
    return p.replace(/\\{2,}/g, "\\");
  }

  parsePath(cpath) {
    if (cpath.includes("%")) {
      // "%desktop%", but also compound seeds like "%user%\Desktop":
      // resolve the special token, then walk the remaining names
      const parts = String(cpath)
        .split("\\")
        .map((x) => x.trim())
        .filter(Boolean);
      let id = this.special[parts[0]];
      if (id == null) return null;
      let node = this.getId(id);
      for (let i = 1; i < parts.length && node; i++) {
        node = (node.data || []).find(
          (c) => c && c.name && c.name.toLowerCase() === parts[i].toLowerCase(),
        );
      }
      return node ? node.id : null;
    }

    cpath = cpath
      .split("\\")
      .filter((x) => x !== "")
      .map((x) => x.trim().toLowerCase());
    if (cpath.length === 0) return null;

    var pid = null,
      curr = null;
    for (var i = 0; i < this.tree.length; i++) {
      if (this.tree[i].name.toLowerCase() === cpath[0]) {
        curr = this.tree[i];
        break;
      }
    }

    if (curr) {
      var i = 1,
        l = cpath.length;
      while (curr.type === "folder" && i < l) {
        var res = true;
        for (var j = 0; j < curr.data.length; j++) {
          if (curr.data[j].name.toLowerCase() === cpath[i]) {
            i += 1;
            if (curr.data[j].type === "folder") {
              res = false;
              curr = curr.data[j];
            }

            break;
          }
        }

        if (res) break;
      }

      if (i === l) pid = curr.id;
    }

    return pid;
  }

  parseFolder(data, name, host = null) {
    var item = new Item({
      type: data.type,
      name: data.name || name,
      info: data.info,
      host: host,
    });

    this.setId(item.id, item);

    if (data.info && data.info.spid) {
      this.setSpecial(data.info.spid, item.id);
    }

    if (item.type !== "folder") {
      item.setData(data.data);
    } else {
      var fdata = [];
      if (data.data) {
        for (const key of Object.keys(data.data)) {
          fdata.push(this.parseFolder(data.data[key], key, item));
        }
      }

      item.setData(fdata);
    }

    return item;
  }

  parse(data) {
    // VS re-parses the same Bin instance once IndexedDB has answered, so the
    // id lookup and the special-folder map have to start clean every time.
    this.lookup = {};
    this.special = {};

    var drives = Object.keys(data);
    var tree = [];
    for (var i = 0; i < drives.length; i++) {
      tree.push(this.parseFolder(data[drives[i]]));
    }

    this.tree = tree;
  }

  /** Every item in the tree, depth first. */
  walk(fn, root) {
    const visit = (item) => {
      if (!item) return;
      fn(item);
      if (item.type === "folder") (item.data || []).forEach(visit);
    };
    (root ? [root] : this.tree).forEach(visit);
  }

  uniqueName(parent, base) {
    const names = (parent.data || []).map((x) => x.name.toLowerCase());
    if (!names.includes(base.toLowerCase())) return base;
    let i = 2;
    while (names.includes(`${base} (${i})`.toLowerCase())) i += 1;
    return `${base} (${i})`;
  }

  addItem(parentId, { type = "folder", name, data, info }) {
    const host = this.getId(parentId);
    if (!host || host.type !== "folder") return null;
    const item = new Item({
      type,
      name: this.uniqueName(
        host,
        name || (type === "folder" ? "New folder" : "New Text Document.txt"),
      ),
      info: info || { icon: type === "folder" ? "folder" : "file" },
      data: type === "folder" ? [] : data || "",
      host,
    });
    this.setId(item.id, item);
    host.data = [...(host.data || []), item];
    return item;
  }

  removeItem(id) {
    const item = this.getId(id);
    if (!item || !item.host) return item;
    item.host.data = (item.host.data || []).filter((x) => x.id !== id);
    delete this.lookup[id];
    return item;
  }

  renameItem(id, name) {
    const item = this.getId(id);
    if (item && name) item.name = name;
    return item;
  }
}
