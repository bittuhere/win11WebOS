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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./recycle.scss";
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { idb } from "../../../utils/idb";
import * as vs from "../../../utils/os/vs";
import { notify, wosConfirm } from "../../../utils/os/ui";
import { iconForItem } from "../../../utils/os/icons";

/* ------------------------------------------------------------------ *
 *  Recycle Bin — restore, delete for good, empty.  Reads the same
 *  IndexedDB "recycle" list that File Explorer and vs.vsRemove write.
 * ------------------------------------------------------------------ */

const fmtBytes = (b) => {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};
const fmtDate = (t) =>
  t ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export const RecycleApp = () => {
  const wnapp = useSelector((s) => s.apps.bin0) || {};
  const dispatch = useDispatch();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState([]);
  const [sort, setSort] = useState({ key: "at", dir: -1 });

  const load = useCallback(async () => {
    setLoading(true);
    const list = (await idb.get("recycle").catch(() => [])) || [];
    setRows(Array.isArray(list) ? list : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!wnapp.alive) return;
    load();
  }, [wnapp.alive, wnapp.hide, load]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      const x = a[key],
        y = b[key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * dir;
    });
    return arr;
  }, [rows, sort]);

  const write = async (next) => {
    await idb.set("recycle", next);
    setRows(next);
  };

  const restore = async (list) => {
    const targets = list.length ? list : rows.filter((r) => sel.includes(r.path));
    if (!targets.length) return;
    let done = 0;
    for (const t of targets) {
      try {
        await vs.hydrate();
        const dest = t.path.split("\\").slice(0, -1).join("\\");
        await vs.ensureDir(dest);
        if (t.type === "folder") {
          await vs.vsMkdir(t.path);
        } else if (typeof t.data === "string" && t.data.startsWith("data:")) {
          await vs.vsWriteDataUrl(t.path, t.data);
        } else if (vs.isBinaryRecord(t.data)) {
          await vs.vsWriteDataUrl(
            t.path,
            `data:${t.data.mime || "application/octet-stream"};base64,${t.data.b64 || ""}`,
          );
        } else {
          await vs.vsWrite(t.path, t.data ?? "", { mime: t.mime || undefined });
        }
        done += 1;
      } catch (e) {
        notify({
          app: "Recycle Bin",
          icon: "img/icon/win/bin.png",
          title: `Could not restore "${t.name}"`,
          body: String(e?.message || e),
          kind: "error",
        });
      }
    }
    const kept = rows.filter((r) => !targets.some((t) => t.path === r.path));
    await write(kept);
    setSel([]);
    if (done) {
      notify({
        app: "Recycle Bin",
        icon: "img/icon/win/bin.png",
        title: done === 1 ? "Restored 1 item" : `Restored ${done} items`,
        body:
          targets.length > 1
            ? targets
                .map((t) => t.name)
                .slice(0, 3)
                .join(", ") + (targets.length > 3 ? "…" : "")
            : targets[0].path,
        kind: "success",
        life: 4,
      });
      dispatch({ type: "FILEREFRESH" });
    }
  };

  const purge = async (list) => {
    const targets = list.length ? list : rows.filter((r) => sel.includes(r.path));
    if (!targets.length) return;
    const go = await wosConfirm(
      targets.length === 1
        ? `Permanently delete "${targets[0].name}"?`
        : `Permanently delete ${targets.length} items?`,
      { title: "Recycle Bin", okText: "Delete", danger: true },
    );
    if (!go) return;
    await write(rows.filter((r) => !targets.some((t) => t.path === r.path)));
    setSel([]);
    notify({
      app: "Recycle Bin",
      icon: "img/icon/win/bin.png",
      title: "Deleted permanently",
      body: `${targets.length} item${targets.length === 1 ? "" : "s"}`,
      kind: "success",
      life: 3.5,
    });
  };

  const empty = async () => {
    if (!rows.length) return;
    const go = await wosConfirm(
      `Are you sure you want to permanently delete all ${rows.length} items?`,
      { title: "Empty Recycle Bin", okText: "Yes", danger: true },
    );
    if (!go) return;
    await write([]);
    setSel([]);
    notify({
      app: "Recycle Bin",
      icon: "img/icon/win/bin.png",
      title: "Recycle Bin emptied",
      kind: "success",
      life: 3.5,
    });
  };

  const onRow = (e, path) => {
    if (e.ctrlKey || e.metaKey) {
      setSel((s) => (s.includes(path) ? s.filter((x) => x !== path) : [...s, path]));
    } else if (e.shiftKey && sel.length) {
      const a = sorted.findIndex((r) => r.path === sel[sel.length - 1]);
      const b = sorted.findIndex((r) => r.path === path);
      setSel(sorted.slice(Math.min(a, b), Math.max(a, b) + 1).map((r) => r.path));
    } else {
      setSel([path]);
    }
  };

  const th = (key, label, w) => (
    <th
      style={w ? { width: w } : null}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))}
    >
      <span>{label}</span>
      {sort.key === key ? <i className="rbArr">{sort.dir === 1 ? "▲" : "▼"}</i> : null}
    </th>
  );

  if (!wnapp.alive) return null;

  const total = rows.reduce((a, r) => a + (r.size || 0), 0);

  return (
    <div
      className="recycleApp floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Recycle Bin" />

      <div className="windowScreen" data-dock="true">
        <div className="rbCmd">
          <button
            type="button"
            className="rbBtn"
            disabled={!sel.length}
            onClick={() => restore([])}
          >
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path
                d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5V5h2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Restore
          </button>
          <button
            type="button"
            className="rbBtn"
            disabled={!rows.length}
            onClick={() => restore(rows)}
          >
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path
                d="M2 5h5l2 2.2h7V15H2V5z"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
            Restore all
          </button>
          <i className="rbSep" />
          <button
            type="button"
            className="rbBtn danger"
            disabled={!sel.length}
            onClick={() => purge([])}
          >
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path
                d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"
                stroke="currentColor"
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Delete
          </button>
          <button type="button" className="rbBtn danger" disabled={!rows.length} onClick={empty}>
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path
                d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.8 9.5h6.4L12 4.5M6.5 7v4M9.5 7v4"
                stroke="currentColor"
                strokeWidth="1.25"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Empty Recycle Bin
          </button>
          <span className="rbSpacer" />
          <button type="button" className="rbBtn ico" title="Refresh" onClick={load}>
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1M13.5 2v3h-3"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="rbBody win11Scroll">
          {loading ? (
            <div className="rbEmpty">
              <p>Reading the Recycle Bin…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rbEmpty">
              <svg viewBox="0 0 64 64" width="54" height="54">
                <path
                  d="M14 18h36M26 18v-5h12v5M20 18l3 34h18l3-34M27 26v18M37 26v18"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h2>The Recycle Bin is empty</h2>
              <p>
                Deleted files and folders rest here until you empty it — everything lives on your
                Virtual Storage, so it survives a reload.
              </p>
            </div>
          ) : (
            <table className="rbTable">
              <thead>
                <tr>
                  {th("name", "Name")}
                  {th("path", "Original location")}
                  {th("at", "Date deleted", 168)}
                  {th("size", "Size", 92)}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr
                    key={r.path}
                    data-sel={sel.includes(r.path)}
                    onClick={(e) => onRow(e, r.path)}
                    onDoubleClick={() => restore([r])}
                  >
                    <td>
                      <img
                        src={`img/icon/${iconForItem({ name: r.name, type: r.type === "folder" ? "folder" : "file" }).src}.png`}
                        alt=""
                        onError={(e) => (e.target.style.visibility = "hidden")}
                      />
                      <span>{r.name}</span>
                    </td>
                    <td className="rbDim">
                      {r.path.split("\\").slice(0, -1).join("\\") || "This PC"}
                    </td>
                    <td className="rbDim">{fmtDate(r.at)}</td>
                    <td className="rbDim">{r.type === "folder" ? "Folder" : fmtBytes(r.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rbStatus">
          <span>
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </span>
          {sel.length ? <span>{sel.length} selected</span> : null}
          <span className="rbSpacer" />
          <span>{fmtBytes(total)}</span>
        </div>
      </div>
    </div>
  );
};

export default RecycleApp;
