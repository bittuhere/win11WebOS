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

import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { closeDialog, dismissToast, setDialogValue } from "../../utils/os/ui";
import { getUserName, vsList } from "../../utils/os/vs";
import "./ui.scss";

/* ================================================================== */
/*  Windows 11 toast notifications                                     */
/* ================================================================== */

const KIND_ICON = {
  info: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v6M12 7.6v.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 12.4l2.6 2.6L16 9.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warn: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M12 4l9 16H3l9-16z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4.4M12 17.2v.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

const Toast = ({ t }) => {
  const barRef = useRef(null);

  // toasts must linger like the real ones: 15-30s, default 20
  const life = t.life ? Math.max(15, Math.min(30, t.life)) : 0;
  useEffect(() => {
    if (!life) return;
    const out = setTimeout(() => dismissToast(t.id), life * 1000);
    return () => clearTimeout(out);
  }, [t.id, life]);

  // the thin progress line at the bottom, exactly like the Win11 toast timer
  useEffect(() => {
    const el = barRef.current;
    if (!el || !t.life) return;
    el.style.transition = "none";
    el.style.transform = "scaleX(1)";
    requestAnimationFrame(() => {
      el.style.transition = `transform ${life}s linear`;
      el.style.transform = "scaleX(0)";
    });
  }, [t.id, life]);

  return (
    <div
      className={`wosToast kind-${t.kind} ${t.leaving ? "out" : "in"}`}
      role="status"
      aria-live="polite"
      onClick={() => {
        if (t.actions?.length) return;
        dismissToast(t.id);
      }}
    >
      <div className="wosToastTop">
        <span className="wosToastApp">
          {t.icon ? <img src={t.icon} alt="" width="16" height="16" /> : null}
          <span className="wosToastAppName">{t.app}</span>
          <span className="wosToastNow">now</span>
        </span>
        <button
          type="button"
          className="wosToastX"
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            dismissToast(t.id);
          }}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="wosToastBody">
        <span className={`wosToastKind kind-${t.kind}`}>{KIND_ICON[t.kind] || KIND_ICON.info}</span>
        <div className="wosToastText">
          {t.title ? <div className="wosToastTitle">{t.title}</div> : null}
          {t.body ? <div className="wosToastMsg">{t.body}</div> : null}
        </div>
      </div>

      {t.hero ? <img className="wosToastHero" src={t.hero} alt="" /> : null}

      {t.actions?.length ? (
        <div className="wosToastActs">
          {t.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                a.onClick?.();
                dismissToast(t.id);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {t.life ? (
        <div className="wosToastTimer">
          <i ref={barRef} />
        </div>
      ) : null}
    </div>
  );
};

export const ToastCenter = () => {
  const toasts = useSelector((s) => s.ui.toasts);
  if (!toasts.length) return null;
  // Windows shows the newest at the top of the stack
  const shown = [...toasts].reverse().slice(0, 3);
  return (
    <div className="wosToastStack" data-count={shown.length}>
      {shown.map((t) => (
        <Toast key={t.id} t={t} />
      ))}
    </div>
  );
};

/* ================================================================== */
/*  Windows 11 ContentDialog — replaces alert / confirm / prompt       */
/* ================================================================== */

const DlgIcon = ({ kind }) => {
  if (kind === "warn" || kind === "danger") {
    return (
      <svg className="dlgGlyph warn" viewBox="0 0 32 32" width="32" height="32" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16 8v11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="23.4" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "info") {
    return (
      <svg className="dlgGlyph" viewBox="0 0 32 32" width="32" height="32" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16 14v10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="9.6" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  return null;
};

const Dialog = ({ d, top }) => {
  const inputRef = useRef(null);
  if (d.kind === "saveas" || d.kind === "open") return <FileDialog d={d} top={top} />;

  const isPrompt = d.kind === "prompt";
  const isSelect = d.kind === "select";

  useEffect(() => {
    if (!top) return;
    if (isPrompt || isSelect) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        if (isPrompt && d.selectAll !== false) inputRef.current?.select();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [top, d.id]);

  useEffect(() => {
    if (!top) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDialog(d.id, null);
      } else if (e.key === "Enter" && !e.shiftKey) {
        if (isPrompt || d.kind === "alert" || d.kind === "confirm" || isSelect) {
          e.preventDefault();
          e.stopPropagation();
          commit(true);
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [top, d.id, d.value]);

  const commit = (ok) => {
    if (d.kind === "alert") return closeDialog(d.id, true);
    if (!ok) return closeDialog(d.id, null);
    if (isPrompt) {
      const v = String(d.value ?? "");
      return closeDialog(d.id, v === "" ? (d.allowEmpty ? "" : null) : v);
    }
    /* a confirm resolves TRUE — it used to hand back d.value (undefined),
       so every `await wosConfirm(...)` saw falsy and aborted: delete,
       recycle, unsaved-changes prompts all silently did nothing */
    if (isSelect) return closeDialog(d.id, d.value);
    closeDialog(d.id, d.kind === "confirm" ? true : d.value);
  };

  return (
    <div
      className="wosDlgScrim"
      data-top={top}
      onMouseDown={() => top && d.kind !== "alert" && commit(false)}
    >
      <div
        className={`wosDlg ${top ? "top" : "behind"}`}
        role="dialog"
        aria-modal={top}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="wosDlgHead">
          <DlgIcon kind={d.danger ? "warn" : "info"} />
          <div className="wosDlgTitles">
            {d.title ? <h2>{d.title}</h2> : null}
            {d.text ? <p>{d.text}</p> : null}
          </div>
        </div>

        {d.children ? <div className="wosDlgBody">{d.children}</div> : null}

        {isPrompt ? (
          <div className="wosDlgField">
            {d.rows > 1 ? (
              <textarea
                ref={inputRef}
                rows={d.rows}
                value={d.value}
                placeholder={d.placeholder}
                onChange={(e) => setDialogValue(d.id, e.target.value)}
              />
            ) : (
              <input
                ref={inputRef}
                type={d.password ? "password" : "text"}
                value={d.value}
                placeholder={d.placeholder}
                spellCheck={false}
                onChange={(e) => setDialogValue(d.id, e.target.value)}
              />
            )}
          </div>
        ) : null}

        {isSelect ? (
          <div className="wosDlgOpts">
            {(d.options || []).map((o) => {
              const val = typeof o === "string" ? o : o.value;
              const label = typeof o === "string" ? o : o.label;
              return (
                <button
                  key={val}
                  type="button"
                  ref={d.value === val ? inputRef : null}
                  className={d.value === val ? "on" : ""}
                  onClick={() => closeDialog(d.id, val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="wosDlgActs">
          {d.kind === "alert" ? (
            <button type="button" className="wosBtn accent" onClick={() => commit(true)}>
              {d.okText}
            </button>
          ) : d.kind === "confirm" ? (
            <>
              <button type="button" className="wosBtn accent" onClick={() => commit(true)}>
                {d.okText}
              </button>
              {d.midText ? (
                <button
                  type="button"
                  className="wosBtn danger"
                  onClick={() => closeDialog(d.id, "mid")}
                >
                  {d.midText}
                </button>
              ) : null}
              <button type="button" className="wosBtn" onClick={() => commit(false)}>
                {d.cancelText}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="wosBtn accent" onClick={() => commit(true)}>
                {d.okText}
              </button>
              <button type="button" className="wosBtn" onClick={() => commit(false)}>
                {d.cancelText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  The real Save-As window (Virtual Storage browser)                  */
/* ================================================================== */

const QUICK = [
  { name: "Desktop", seg: "Desktop" },
  { name: "Documents", seg: "Documents" },
  { name: "Downloads", seg: "Downloads" },
  { name: "Pictures", seg: "Pictures" },
  { name: "Music", seg: "Music" },
  { name: "Videos", seg: "Videos" },
];

/* ------------------------------------------------------------------ */
/*  The Windows 11 file dialog — Save as / Open, one component.        */
/* ------------------------------------------------------------------ */
const FldrIco = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden>
    <path
      d="M2 5.2C2 4 3 3 4.2 3h3.1c.6 0 1.2.25 1.6.7l1 1.1h5.9C17 4.8 18 5.8 18 7v7.8c0 1.2-1 2.2-2.2 2.2H4.2C3 17 2 16 2 14.8V5.2z"
      fill="#f8c842"
    />
    <path d="M2 8h16v6.8c0 1.2-1 2.2-2.2 2.2H4.2C3 17 2 16 2 14.8V8z" fill="#ffd970" />
  </svg>
);
const FileIco = ({ name = "", s = 18 }) => {
  const ext = (String(name).split(".").pop() || "").toLowerCase();
  const hue =
    {
      txt: "#4cc2ff",
      md: "#4cc2ff",
      png: "#8ab4ff",
      jpg: "#8ab4ff",
      jpeg: "#8ab4ff",
      gif: "#8ab4ff",
      webp: "#8ab4ff",
      bmp: "#8ab4ff",
      mp3: "#c586ff",
      wav: "#c586ff",
      json: "#f8ce3b",
      html: "#ff8a65",
    }[ext] || "#9aa4ad";
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden>
      <path
        d="M4.5 2h7L16 6.5V17a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 17V3.5A1.5 1.5 0 0 1 4.5 2z"
        fill="#fff"
        stroke="#b9c0c8"
        strokeWidth="1"
      />
      <path d="M11.5 2L16 6.5h-4.5V2z" fill="#dde3e8" />
      <rect x="5.4" y="10.4" width="9.2" height="5.6" rx="1" fill={hue} opacity="0.92" />
      <text
        x="10"
        y="14.7"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill="#fff"
        fontFamily="Segoe UI, sans-serif"
      >
        {(ext || "file").slice(0, 4).toUpperCase()}
      </text>
    </svg>
  );
};
const PcIco = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden>
    <rect x="2" y="3.5" width="16" height="10" rx="1.4" fill="#7fb2e5" />
    <rect x="3.2" y="4.7" width="13.6" height="7.6" rx="0.7" fill="#d7ecff" />
    <rect x="6.5" y="14.5" width="7" height="1.8" rx="0.9" fill="#7fa8cc" />
  </svg>
);
const QuickIco = ({ name }) => {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (name === "Desktop")
    return (
      <svg width="17" height="17" viewBox="0 0 20 20">
        <rect x="2" y="3" width="16" height="11" rx="1.5" {...stroke} />
        <path d="M7 17h6" {...stroke} />
      </svg>
    );
  if (name === "Documents")
    return (
      <svg width="17" height="17" viewBox="0 0 20 20">
        <path
          d="M5 2.5h7L15.5 6v11a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"
          {...stroke}
        />
        <path d="M7 9h6M7 12h6" {...stroke} />
      </svg>
    );
  if (name === "Downloads")
    return (
      <svg width="17" height="17" viewBox="0 0 20 20">
        <path d="M10 3v9m0 0l-3.4-3.4M10 12l3.4-3.4" {...stroke} />
        <path d="M3.5 13.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" {...stroke} />
      </svg>
    );
  if (name === "Pictures")
    return (
      <svg width="17" height="17" viewBox="0 0 20 20">
        <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" {...stroke} />
        <circle cx="7" cy="8" r="1.4" {...stroke} />
        <path d="M3.5 14.5l4.4-4 3.2 3 2.4-2.2 3 2.7" {...stroke} />
      </svg>
    );
  if (name === "Music")
    return (
      <svg width="17" height="17" viewBox="0 0 20 20">
        <path d="M7.5 15.2V5l9-1.6v10.4" {...stroke} />
        <circle cx="5.4" cy="15.4" r="2.1" {...stroke} />
        <circle cx="14.4" cy="13.9" r="2.1" {...stroke} />
      </svg>
    );
  if (name === "Videos")
    return (
      <svg width="17" height="17" viewBox="0 0 20 20">
        <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" {...stroke} />
        <path d="M8.5 8l4 2-4 2V8z" {...stroke} />
      </svg>
    );
  return <PcIco />;
};

const FileDialog = ({ d, top }) => {
  const user = getUserName() || "User";
  const home = `C:\\Users\\${user}`;
  const isSave = d.kind !== "open";
  const [cwd, setCwd] = useState(d.dir || `${home}\\Documents`);
  const [name, setName] = useState(String(d.value || ""));
  const [rows, setRows] = useState([]);
  const [picked, setPicked] = useState(null);
  const [filter, setFilter] = useState("");
  const [back, setBack] = useState([]); // breadcrumb history
  const [typeIdx, setTypeIdx] = useState(0);
  const [typeOpen, setTypeOpen] = useState(false);
  const types = d.types && d.types.length ? d.types : [{ label: "All files", exts: null }];
  const activeType = types[Math.min(typeIdx, types.length - 1)];

  useEffect(() => {
    let alive = true;
    vsList(cwd)
      .then((r) => {
        if (!alive) return;
        setRows(
          (r || []).slice().sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          }),
        );
      })
      .catch(() => setRows([]));
    return () => {
      alive = false;
    };
  }, [cwd]);

  const extsOk = (n) => {
    if (!activeType.exts) return true;
    const e = (String(n).split(".").pop() || "").toLowerCase();
    return activeType.exts.includes(e);
  };
  const shown = rows.filter((r) => {
    const t = filter.trim().toLowerCase();
    if (t && !String(r.name).toLowerCase().includes(t)) return false;
    return isSave ? r.type === "folder" || extsOk(r.name) : r.type === "folder" || extsOk(r.name);
  });

  const join = (dir, n) => (dir.endsWith("\\") ? dir + n : dir + "\\" + n);
  const go = (dir) => {
    setBack((b) => [...b, cwd]);
    setCwd(dir);
    setPicked(null);
  };
  const up = () => {
    const i = cwd.lastIndexOf("\\");
    if (i > 2) go(cwd.slice(0, i));
  };
  const commit = (finalName) => {
    const n = String(finalName ?? name ?? "").trim();
    if (!n) return;
    const withExt =
      /\.[A-Za-z0-9]+$/.test(n) || !activeType.exts ? n : `${n}.${activeType.exts[0]}`;
    closeDialog(d.id, join(cwd, withExt));
  };
  const openRow = (r) => {
    if (r.type === "folder") go(r.path);
    else if (isSave) {
      setName(r.name);
      setPicked(r.path);
    } else closeDialog(d.id, r.path);
  };
  const save = () => {
    if (isSave) commit();
    else {
      const hit = shown.find((r) => r.path === picked && r.type === "file");
      if (hit) closeDialog(d.id, hit.path);
    }
  };

  useEffect(() => {
    if (!top) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDialog(d.id, null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        save();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, cwd, name, picked, typeIdx, rows]);

  const crumbs = cwd.split("\\").filter(Boolean);
  return (
    <div className="wosDlgScrim" data-top={top} onMouseDown={() => top && closeDialog(d.id, null)}>
      <div
        className={`wosDlg wosSave ${top ? "top" : "behind"}`}
        role="dialog"
        aria-modal={top}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* classic title bar */}
        <div className="fdTitleBar">
          <span className="fdTitleIco">
            {isSave ? <FileIco s={14} name="a.txt" /> : <FldrIco s={14} />}
          </span>
          <span className="fdTitle">{d.title || (isSave ? "Save As" : "Open")}</span>
          <button
            type="button"
            className="fdClose"
            title="Close"
            onClick={() => closeDialog(d.id, null)}
          >
            <svg viewBox="0 0 10 10" width="10" height="10">
              <path
                d="M1 1l8 8M9 1l-8 8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* toolbar: back, up, breadcrumbs, search */}
        <div className="fdBar">
          <button
            type="button"
            className="fdNav"
            title="Back"
            disabled={!back.length}
            onClick={() => {
              const prev = back[back.length - 1];
              if (prev) {
                setBack((b) => b.slice(0, -1));
                setCwd(prev);
                setPicked(null);
              }
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M10.5 3L5.5 8l5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="fdNav" title="Up one folder" onClick={up}>
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M8 13V4M4.5 7.5L8 4l3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="fdCrumb">
            <FldrIco s={14} />
            {crumbs.map((seg, i) => (
              <span key={i} className="fdCrumbSeg">
                {i > 0 && (
                  <svg viewBox="0 0 8 10" width="7" height="8" className="fdCrumbChev">
                    <path
                      d="M1.5 1l4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                <button
                  type="button"
                  title={crumbs.slice(0, i + 1).join("\\")}
                  onClick={() => {
                    if (i < crumbs.length - 1) go(crumbs.slice(0, i + 1).join("\\"));
                  }}
                >
                  {seg}
                </button>
              </span>
            ))}
          </div>
          <div className="fdSearch">
            <svg viewBox="0 0 16 16" width="12" height="12">
              <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M10.4 10.4L14 14"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${crumbs[crumbs.length - 1] || ""}`}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="wosSaveBody">
          <div className="wosSaveRail">
            <div className="fdRailHead">Quick access</div>
            <div className={`wosSaveLoc ${cwd === home ? "on" : ""}`} onClick={() => go(home)}>
              <QuickIco name="pc" /> This PC
            </div>
            {QUICK.map((q) => (
              <div
                key={q.seg}
                className={`wosSaveLoc ${cwd === join(home, q.seg) ? "on" : ""}`}
                onClick={() => go(join(home, q.seg))}
              >
                <QuickIco name={q.name} /> {q.name}
              </div>
            ))}
          </div>
          <div className="wosSaveMain fdMain">
            <div className="fdCols">
              <span>Name</span>
              <span>Date modified</span>
              <span>Type</span>
            </div>
            <div className="wosSaveList win11Scroll fdList">
              {shown.length === 0 ? (
                <div className="wosSaveEmpty">This folder is empty</div>
              ) : (
                shown.map((r) => {
                  const dt = r.updated ? new Date(r.updated) : null;
                  return (
                    <div
                      key={r.path}
                      className={`fdRow ${picked === r.path ? "on" : ""}`}
                      title={r.path}
                      onClick={() =>
                        r.type === "file"
                          ? (setPicked(r.path), isSave && setName(r.name))
                          : setPicked(null)
                      }
                      onDoubleClick={() => openRow(r)}
                    >
                      <span className="fdName">
                        {r.type === "folder" ? (
                          <FldrIco s={17} />
                        ) : (
                          <FileIco s={17} name={r.name} />
                        )}{" "}
                        <i>{r.name}</i>
                      </span>
                      <span className="fdWhen">
                        {dt
                          ? dt.toLocaleString(undefined, {
                              month: "2-digit",
                              day: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                      <span className="fdKind">
                        {r.type === "folder"
                          ? "File folder"
                          : (r.name.split(".").pop() || "file").toUpperCase() + " file"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="fdFoot">
          {isSave && (
            <>
              <label className="fdLbl">File name:</label>
              <input
                className="fdNameIn"
                value={name}
                autoFocus
                spellCheck={false}
                placeholder="File name"
                onChange={(e) => {
                  setName(e.target.value);
                  setPicked(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
              <label className="fdLbl">Save as type:</label>
              <div className="fdType">
                <button type="button" onClick={() => setTypeOpen(!typeOpen)}>
                  <span>{activeType.label}</span>
                  <svg viewBox="0 0 10 6" width="9" height="6">
                    <path
                      d="M1 1l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                {typeOpen && (
                  <div className="fdTypePop" role="listbox">
                    {types.map((t, i) => (
                      <button
                        key={t.label}
                        type="button"
                        className={i === typeIdx ? "on" : ""}
                        onClick={() => {
                          setTypeIdx(i);
                          setTypeOpen(false);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {!isSave && (
            <label className="fdLbl" style={{ width: "auto" }}>
              {picked ? String(picked).split("\\").pop() : "Select a file and press Open"}
            </label>
          )}
        </div>

        <div className="wosDlgActs fdActs">
          <button type="button" className="wosBtn accent" onClick={save}>
            {d.okText || (isSave ? "Save" : "Open")}
          </button>
          <button type="button" className="wosBtn" onClick={() => closeDialog(d.id, null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export const DialogHost = () => {
  const dialogs = useSelector((s) => s.ui.dialogs);
  if (!dialogs.length) return null;
  return (
    <div className="wosDlgHost">
      {dialogs.map((d, i) => (
        <Dialog key={d.id} d={d} top={i === dialogs.length - 1} />
      ))}
    </div>
  );
};

export const ShellUI = () => (
  <>
    <DialogHost />
    <ToastCenter />
  </>
);

export default ShellUI;
