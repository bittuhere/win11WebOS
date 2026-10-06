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

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./notepad.scss";
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { idb, uid } from "../../../utils/idb";
import * as vs from "../../../utils/os/vs";
import { ownsKeyboard } from "../../../utils/os/keys";
import {
  notify,
  wosConfirm,
  wosConfirmEx,
  wosPrompt,
  wosFileSave,
  wosFileOpen,
} from "../../../utils/os/ui";
import { iconForItem } from "../../../utils/os/icons";

/* ------------------------------------------------------------------ *
 *  Model — one tab per document, exactly like the Win11 Notepad
 * ------------------------------------------------------------------ */

const blankDoc = (path) => ({
  id: uid("doc"),
  name: "Untitled",
  text: "",
  saved: true,
  path: path || null,
  eol: "crlf",
  enc: "utf8",
  wrap: true,
});

const withExt = (n) => (/\.[a-z0-9]+$/i.test(n) ? n : `${n}.txt`);

/* Windows itself collapses repeated separators: C:\Users\Blue\Documents\\a.txt is
   the same file as C:\Users\Blue\Documents\a.txt. A saved session (or a path typed
   by hand) can carry the doubled form — showing it as a second tab is how
   one document ends up open twice. */
const normPath = (p) =>
  String(p || "")
    .trim()
    .replace(/[\\\\/]+/g, "\\")
    .replace(/[\\]+$/, "");

/* Windows paths are case-insensitive, and the profile folder can be renamed
   underneath a saved session — so "the same file" is decided here, once,
   instead of by a string comparison that quietly misses. */
const samePath = (a, b) => {
  const n = (p) =>
    normPath(p)
      .toLowerCase()
      /* this PC has one account, and its profile folder can be renamed
         (C:\Users\Blue → C:\Users\Tester). A saved session from before the
         rename is still the same file, not a second copy of it. */
      .replace(/^([a-z]:\\users\\)[^\\]+/, "$1<user>");
  return !!normPath(a) && !!normPath(b) && n(a) === n(b);
};

/** Collapse tabs that point at the same file; the last one wins (it is the
    freshest read). Untitled tabs have no path and are never collapsed. */
const dedupeTabs = (list) => {
  const out = [];
  for (const t of list) {
    const i = t.path ? out.findIndex((x) => samePath(x.path, t.path)) : -1;
    if (i >= 0) out[i] = t;
    else out.push(t);
  }
  return out;
};

const UNTITLED = /^Untitled( \(\d+\))?(\.txt)?$/i;

/* ------------------------------------------------------------------ *
 *  Notepad
 * ------------------------------------------------------------------ */

export const Notepad = () => {
  const wnapp = useSelector((s) => s.apps.notepad);
  const hz = useSelector((s) => s.apps.hz);
  const personName = useSelector((s) => s.setting.person.name);
  const dispatch = useDispatch();

  const [tabs, setTabs] = useState([blankDoc()]);
  const [ti, setTi] = useState(0);
  /* the document that just arrived and must become the visible tab. It is
     remembered by ID, not by index: dedupeTabs can collapse tabs and the
     session merge can insert restored ones, and either would leave a stale
     index pointing at somebody else's document — the exact "opened Notepad
     but not with the file" symptom. */
  const pendingDoc = useRef(null);
  const [zoom, setZoom] = useState(100);
  const [menu, setMenu] = useState(null); // 'file' | 'edit' | 'view'
  const [find, setFind] = useState(null); // {q, r, open, case, wrap}
  const [caret, setCaret] = useState({ ln: 1, col: 1, sel: 0 });
  const [booted, setBooted] = useState(false);
  const ta = useRef(null);
  const rootRef = useRef(null);
  /* the open effect reads the live tab list without depending on it — a
     re-run on every keystroke would re-read the file the user is typing into */
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const doc = tabs[ti] || tabs[0];

  /* Restore the documents that were open when the app was last closed.

     The read is asynchronous, so a file double-clicked in Explorer can land
     while it is still in flight. Replacing the tab list wholesale used to
     throw that freshly opened document away — the window came up showing the
     old tab, which is exactly the "opened Notepad but not with the file"
     report. So the restore merges: restored tabs first, then anything that
     arrived while we were reading, and the newest document stays active. */
  useEffect(() => {
    (async () => {
      let restored = [];
      try {
        const st = await idb.get("notepad.session");
        if (Array.isArray(st) && st.length) {
          restored = st.map((d) => ({
            ...blankDoc(normPath(d.path) || null),
            id: d.id || uid("doc"),
            name: d.name || "Untitled",
            text: d.text || "",
            saved: true,
            eol: d.eol || "crlf",
            enc: d.enc || "utf8",
            wrap: d.wrap !== false,
          }));
        }
      } catch (e) {}
      setTabs((prev) => {
        // nothing was opened while we were reading: the plain restore
        const untouched = prev.length === 1 && !prev[0].path && !prev[0].text;
        if (untouched) return restored.length ? restored : prev;
        /* A document that arrived while we were reading is NEWER than the
           saved copy of the same path — it was just read from the file.
           So the fresh tabs win, and the restored ones only fill the gaps. */
        const fresh = prev.filter((p) => !(p.path === null && !p.text));
        const filled = restored.filter((r) => !fresh.some((p) => samePath(p.path, r.path)));
        return dedupeTabs([...filled, ...fresh]);
      });
      setBooted(true);
      /* anything opened during the read is active, not buried */
      setTi((i) => (i >= 0 ? i : 0));
    })();
  }, []);

  /* whatever the list did — appended, replaced or merged — the document the
     user asked for is the one on screen, and the active index always exists */
  useEffect(() => {
    const want = pendingDoc.current;
    if (want) {
      const i = tabs.findIndex((t) => t.id === want);
      if (i >= 0) {
        if (i !== ti) setTi(i);
        pendingDoc.current = null;
        return;
      }
    }
    if (ti > tabs.length - 1) setTi(Math.max(0, tabs.length - 1));
  }, [tabs, ti]);

  useEffect(() => {
    if (!booted || wnapp.hide) return;
    const t = setTimeout(() => {
      idb
        .set(
          "notepad.session",
          tabs.map((d) => ({
            id: d.id,
            name: d.name,
            text: d.text,
            path: d.path,
            eol: d.eol,
            enc: d.enc,
            wrap: d.wrap,
          })),
        )
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [tabs, booted, wnapp.hide]);

  /* the authoritative session write for a REAL close. The 500 ms autosave
     above is crash recovery; but close must decide what survives — otherwise
     "Don't save" resurrects the discarded text on the next launch and closing
     feels like hiding. Discarded untitled docs die; dirty files revert to
     their on-disk text. */
  const persistSession = async (list) => {
    const keep = [];
    for (const t of list) {
      if (t.saved) {
        keep.push({
          id: t.id,
          name: t.name,
          text: t.text,
          path: t.path,
          eol: t.eol,
          enc: t.enc,
          wrap: t.wrap,
        });
        continue;
      }
      if (!t.path) continue; // never-saved doc the user chose to discard — gone for good
      const rec = await vs.vsRead(t.path).catch(() => null); // dirty file — back to its last saved bytes
      if (rec)
        keep.push({
          id: t.id,
          name: rec.name || t.name,
          text: String(rec.content || ""),
          path: t.path,
          eol: t.eol,
          enc: t.enc,
          wrap: t.wrap,
        });
    }
    await idb.set("notepad.session", keep).catch(() => {});
  };

  /* A file was double-clicked (Explorer, the desktop, Start, "Open with").

     The window and its session tabs may already hold an older copy of the
     same file — Windows Notepad re-reads the file, and so does this one. The
     disk wins; the saved session is only a convenience. If the tab has
     unsaved edits, they are never silently destroyed: the user is asked. */
  useEffect(() => {
    if (!wnapp.openDoc) return;
    const d = wnapp.openDoc;
    const path = normPath(d.path) || null;
    let alive = true;

    (async () => {
      let fromDisk = null;
      if (path) {
        try {
          const rec = await vs.vsRead(path);
          if (rec && rec.type !== "folder") fromDisk = rec;
        } catch (e) {}
      }
      if (!alive) return;

      const text = fromDisk
        ? String(fromDisk.content ?? "")
        : typeof d.text === "string"
          ? d.text
          : "";

      const existing = tabsRef.current.find((x) => samePath(x.path, path));
      if (existing && existing.text !== text) {
        if (!existing.saved) {
          /* the tab is dirty: the file changed underneath it. Ask, don't guess. */
          const keep = await wosConfirm(
            `“${existing.name}” has unsaved changes, and the file on disk is different.\n\nReload from disk and lose those changes?`,
            { title: "Notepad", okText: "Reload from disk", cancelText: "Keep my edits" },
          ).catch(() => null);
          /* `keep` is true only for "Reload from disk" */
          if (!alive) return;
          if (!keep) {
            /* keep the edits: show that tab and leave it exactly as it is */
            setTi(tabsRef.current.findIndex((x) => x.id === existing.id));
            dispatch({ type: "OPENTXT" });
            return;
          }
        }
      }

      setTabs((t) => {
        const at = t.findIndex((x) => samePath(x.path, path));
        if (at >= 0) {
          // same file, fresh bytes (and its on-disk name, in case it was renamed)
          const next = [...t];
          next[at] = {
            ...next[at],
            name: (fromDisk && fromDisk.name) || d.name || next[at].name,
            text,
            saved: true,
          };
          pendingDoc.current = next[at].id;
          return dedupeTabs(next);
        }
        const fresh = {
          ...blankDoc(path),
          name: d.name || "Untitled",
          text,
          saved: !!(path && fromDisk),
        };
        pendingDoc.current = fresh.id;
        return dedupeTabs([...t, fresh]);
      });
      dispatch({ type: "OPENTXT" });
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wnapp.openDoc]);

  /* Edits address the document by its ID, never by its position. The tab list
     can be rebuilt under us — dedupeTabs collapses two tabs for one file and
     the session restore merges saved tabs in — and an index captured before
     that points at somebody else's document (or past the end), which silently
     swallowed every keystroke. */
  const patch = (partial) =>
    setTabs((list) =>
      list.map((t) =>
        t.id === doc?.id
          ? { ...t, ...partial, saved: "saved" in partial ? partial.saved : false }
          : t,
      ),
    );

  const markDirty = (text) =>
    setTabs((list) => list.map((t) => (t.id === doc?.id ? { ...t, text, saved: false } : t)));

  /* ---------------- commands ---------------- */

  const askUnsaved = async (d) => {
    if (d.saved) return true;
    /* one dialog, three real doors: Save / Don't save (close anyway) /
       Cancel — the old flow needed TWO dialogs to discard */
    const r = await wosConfirmEx(`Do you want to save changes to ${d.name}?`, {
      title: "Notepad",
      okText: "Save",
      midText: "Don't save",
      cancelText: "Cancel",
    });
    if (r === true) {
      const saved = await saveDoc(d);
      return !!saved; // a failed save or cancelled Save-As keeps the doc open
    }
    if (r === "mid") return true; // close without saving
    return false; // cancel — stay open
  };

  const saveDoc = async (d = doc, forcePath) => {
    let path = forcePath || d.path;
    // a forced path (Save As just answered) carries its own name — never re-prompt
    let name = forcePath ? String(forcePath).split("\\").pop() : d.name;

    if (!path || UNTITLED.test(name)) {
      // the real Save-As window: browse the Virtual Storage, pick folder + name
      const answer = await wosFileSave({
        title: "Save as",
        value: UNTITLED.test(name) ? withExt(name) : name,
      });
      if (answer === null) return false;
      name = withExt(String(answer).split("\\").pop() || "Untitled.txt");
      path = answer;
    }

    try {
      await vs.hydrate();
      const text =
        d.eol === "lf" ? d.text.replace(/\r\n/g, "\n") : d.text.replace(/\r?\n/g, "\r\n");
      await vs.vsWrite(path, text, { mime: "text/plain" });

      const savedDoc = { ...d, name: path.split("\\").pop(), path, saved: true, text: d.text };
      setTabs((list) =>
        list.map((t) =>
          t.id === d.id ? { ...t, name: savedDoc.name, path, saved: true, text: d.text } : t,
        ),
      );
      notify({
        app: "Notepad",
        icon: "img/icon/notepad.png",
        title: "Saved",
        body: path,
        kind: "success",
        life: 3,
      });
      return savedDoc;
    } catch (e) {
      notify({
        app: "Notepad",
        icon: "img/icon/notepad.png",
        title: "Could not save the file",
        body: String(e?.message || e),
        kind: "error",
      });
      return false;
    }
  };

  const saveAs = async () => {
    const answer = await wosFileSave({
      title: "Save as",
      value: withExt(doc.name),
    });
    if (answer === null) return;
    const name = withExt(String(answer).split("\\").pop() || "Untitled.txt");
    await saveDoc(doc, answer);
  };

  const newDoc = async () => {
    if (!(await askUnsaved(doc))) return;
    setTabs((t) => [...t, blankDoc()]);
    setTi(tabs.length);
  };

  const openDoc = async () => {
    await vs.hydrate();
    const user = vs.getUserName() || personName || "User";
    const answer = await wosFileOpen({
      title: "Open",
      dir: `C:\\Users\\${user}\\Documents`,
      types: [
        {
          label: "Text documents (*.txt, *.md, *.json, *.log)",
          exts: ["txt", "md", "json", "log", "csv", "js", "jsx", "html", "css"],
        },
        { label: "All files", exts: null },
      ],
    });
    if (!answer) return;
    const rec = await vs.vsRead(answer).catch(() => null);
    if (!rec) {
      notify({
        app: "Notepad",
        icon: "img/icon/notepad.png",
        title: "Can't open that file",
        body: answer,
        kind: "error",
      });
      return;
    }
    setTabs((t) => [
      ...t,
      {
        ...blankDoc(rec.path),
        name: rec.name,
        text: String(rec.content || "").replace(/\r\n/g, "\n"),
        saved: true,
      },
    ]);
    setTi(tabs.length);
  };

  const closeTab = async (i, e) => {
    e?.stopPropagation();
    const d = tabs[i];
    if (!d) return;
    if (!(await askUnsaved(d))) return;
    const next = tabs.filter((_, idx) => idx !== i);
    const list = next.length ? next : [blankDoc()];
    setTabs(list);
    /* land on the neighbour, and never on an index that no longer exists */
    const want = i < list.length ? i : list.length - 1;
    setTi(Math.max(0, want));
  };

  const print = () => {
    try {
      const html = `<pre style="font:13px/1.5 Consolas,monospace;white-space:pre-wrap">${doc.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`;
      const f = document.createElement("iframe");
      f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(f);
      f.contentDocument.open();
      f.contentDocument.write(html);
      f.contentDocument.close();
      f.contentWindow.focus();
      f.contentWindow.print();
      setTimeout(() => f.remove(), 1200);
    } catch (e) {
      notify({
        app: "Notepad",
        icon: "img/icon/notepad.png",
        title: "Printing is not available",
        body: String(e?.message || e),
        kind: "warn",
      });
    }
  };

  /* ---------------- edit commands ---------------- */
  const applyEdit = (fn) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const out = fn(value, a, b);
    if (out == null) return;
    markDirty(out.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(out.selStart ?? a, out.selEnd ?? out.selStart ?? a);
    });
  };

  const EDIT = {
    undo: () => document.execCommand?.("undo"),
    redo: () => document.execCommand?.("redo"),
    cut: () => document.execCommand?.("cut"),
    copy: () => document.execCommand?.("copy"),
    paste: async () => {
      try {
        const t = await navigator.clipboard.readText();
        applyEdit((v, a, b) => ({ text: v.slice(0, a) + t + v.slice(b), selStart: a + t.length }));
      } catch {
        notify({
          app: "Notepad",
          icon: "img/icon/notepad.png",
          title: "Paste blocked",
          body: "The browser will not hand over the clipboard. Use Ctrl+V.",
          kind: "warn",
        });
      }
    },
    del: () => applyEdit((v, a, b) => ({ text: v.slice(0, a) + v.slice(b), selStart: a })),
    all: () => {
      ta.current?.focus();
      ta.current?.setSelectionRange(0, doc.text.length);
    },
    time: () => {
      const s = new Date().toLocaleTimeString();
      applyEdit((v, a, b) => ({ text: v.slice(0, a) + s + v.slice(b), selStart: a + s.length }));
    },
  };

  /* ---------------- find & replace ---------------- */
  const doFind = (dir = 1) => {
    const q = find?.q;
    if (!q) return;
    const text = find.case ? doc.text : doc.text.toLowerCase();
    const needle = find.case ? q : q.toLowerCase();
    const from = ta.current?.selectionEnd ?? 0;
    let at = dir > 0 ? text.indexOf(needle, from) : text.lastIndexOf(needle, from - 1);
    if (at < 0) at = dir > 0 ? text.indexOf(needle) : text.lastIndexOf(needle);
    if (at < 0) {
      notify({
        app: "Notepad",
        icon: "img/icon/notepad.png",
        title: `Can't find "${q}"`,
        kind: "info",
        life: 3,
      });
      return;
    }
    ta.current?.focus();
    ta.current?.setSelectionRange(at, at + q.length);
    scrollCaretIntoView(at);
  };

  const scrollCaretIntoView = (at) => {
    const el = ta.current;
    if (!el) return;
    const before = el.value.slice(0, at);
    const line = before.split("\n").length - 1;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, line * lh - el.clientHeight / 2);
  };

  const doReplace = () => {
    if (!find?.q) return;
    const q = find.q;
    const r = find.r || "";
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), find.case ? "g" : "gi");
    const before = doc.text;
    const after = before.replace(re, r);
    const n = (before.match(re) || []).length;
    if (!n) {
      notify({
        app: "Notepad",
        icon: "img/icon/notepad.png",
        title: "Nothing to replace",
        kind: "info",
        life: 3,
      });
      return;
    }
    markDirty(after);
    notify({
      app: "Notepad",
      icon: "img/icon/notepad.png",
      title: `Replaced ${n} occurrence${n === 1 ? "" : "s"}`,
      kind: "success",
      life: 3,
    });
  };

  /* ---------------- caret tracking ---------------- */
  const trackCaret = () => {
    const el = ta.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const lines = before.split("\n");
    setCaret({
      ln: lines.length,
      col: lines[lines.length - 1].length + 1,
      sel: el.selectionEnd - el.selectionStart,
    });
  };

  const stats = useMemo(() => {
    const t = doc?.text || "";
    return {
      chars: t.length,
      charsNoSpace: t.replace(/\s/g, "").length,
      words: (t.match(/\S+/g) || []).length,
      lines: t.split("\n").length,
    };
  }, [doc?.text]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    if (!ownsKeyboard(wnapp, hz)) return;
    const onKey = (e) => {
      const c = e.ctrlKey || e.metaKey;
      if (!c) {
        if (e.key === "F3") {
          e.preventDefault();
          doFind(e.shiftKey ? -1 : 1);
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "s" && e.shiftKey) {
        e.preventDefault();
        saveAs();
      } else if (k === "s") {
        e.preventDefault();
        saveDoc();
      } else if (k === "n" && e.shiftKey) {
        e.preventDefault();
        newDoc();
      } else if (k === "n") {
        e.preventDefault();
        newDoc();
      } else if (k === "o") {
        e.preventDefault();
        openDoc();
      } else if (k === "w") {
        e.preventDefault();
        closeTab(ti);
      } else if (k === "p") {
        e.preventDefault();
        print();
      } else if (k === "f") {
        e.preventDefault();
        setFind({ q: "", r: "", case: false, open: true });
      } else if (k === "h") {
        e.preventDefault();
        setFind({ q: "", r: "", case: false, open: true, replace: true });
      } else if (k === "+" || k === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(400, z + 10));
      } else if (k === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(25, z - 10));
      } else if (k === "0") {
        e.preventDefault();
        setZoom(100);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wnapp.alive, wnapp.hide, hz, ti, doc, find]);

  /* close the menu on an outside click */
  useEffect(() => {
    if (!menu) return;
    const away = (e) => {
      if (e.target.closest?.(".npMenuBtn") || e.target.closest?.(".npDrop")) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [menu]);

  /* ---------------- render ---------------- */

  const MenuBtn = ({ id, label, children }) => (
    <div className="npMenuSlot">
      <button
        type="button"
        className={`npMenuBtn ${menu === id ? "on" : ""}`}
        onClick={() => setMenu(menu === id ? null : id)}
        onMouseEnter={() => menu && menu !== id && setMenu(id)}
      >
        {label}
      </button>
      {menu === id ? <div className="npDrop">{children}</div> : null}
    </div>
  );

  const MI = ({ label, kbd, onClick, disabled, sep, check }) =>
    sep ? (
      <div className="npDropSep" />
    ) : (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setMenu(null);
          onClick?.();
        }}
      >
        <span className="npMiLbl">
          {check ? <i>✓</i> : null}
          {label}
        </span>
        {kbd ? <span className="npMiKbd">{kbd}</span> : null}
      </button>
    );

  return (
    <div
      ref={rootRef}
      className="notepad win11notepad floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar
        app={wnapp.action}
        icon={wnapp.icon}
        size={wnapp.size}
        name={`${doc.name}${doc.saved ? "" : " •"} - Notepad`}
        onClose={async () => {
          const dirty = tabs.filter((t) => !t.saved);
          let verdict = true;
          if (dirty.length) {
            /* the same three doors as the tab close: Save / Don't save / Cancel */
            verdict = await wosConfirmEx(
              dirty.length === 1
                ? `Do you want to save changes to ${dirty[0].name}?`
                : `You have ${dirty.length} unsaved tabs. Save them before closing?`,
              {
                title: "Notepad",
                okText: dirty.length === 1 ? "Save" : "Save all",
                midText: "Don't save",
                cancelText: "Cancel",
                danger: dirty.length > 1,
              },
            );
            if (verdict === null) return; // Cancel — stay open
            if (verdict === true) {
              const savedDocs = [];
              for (const d of dirty) {
                const saved = await saveDoc(d);
                if (!saved) return; // save failed or Save-As cancelled — don't close
                savedDocs.push(saved);
              }
              // build the final list with the freshly saved (path/name) docs
              var finalTabs = tabs.map((t) => savedDocs.find((x) => x.id === t.id) || t);
            }
          }
          // close decides what survives — never the crash-recovery autosave
          await persistSession(typeof finalTabs !== "undefined" ? finalTabs : tabs);
          dispatch({ type: wnapp.action, payload: "close" });
        }}
      />

      <div className="windowScreen flex flex-col" data-dock="true">
        {/* ---- tabs ---- */}
        <div className="npTabs">
          <div className="npTabScroller">
            {tabs.map((t, i) => (
              <div
                key={t.id}
                className={`npTab ${i === ti ? "on" : ""}`}
                onClick={() => setTi(i)}
                onAuxClick={(e) => e.button === 1 && closeTab(i, e)}
                title={t.path || t.name}
              >
                <img
                  className="npTabIco"
                  src={`img/icon/${iconForItem({ name: t.name, type: "file" }).src}.png`}
                  alt=""
                  onError={(e) => (e.target.style.display = "none")}
                />
                <span className="npTabName">{t.name}</span>
                {!t.saved ? <i className="npTabDot" /> : null}
                <b
                  className="npTabX"
                  aria-label="Close"
                  onClick={(e) => closeTab(i, e)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 12 12" width="8" height="8">
                    <path
                      d="M1 1l10 10M11 1L1 11"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </b>
              </div>
            ))}
          </div>
          <button type="button" className="npAdd" title="New tab (Ctrl+Shift+N)" onClick={newDoc}>
            <svg viewBox="0 0 14 14" width="11" height="11">
              <path
                d="M7 1.5v11M1.5 7h11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ---- menu bar ---- */}
        <div className="npMenu" onClick={(e) => e.target.tagName !== "BUTTON" && setMenu(null)}>
          <MenuBtn id="file" label="File">
            <MI label="New" kbd="Ctrl+N" onClick={newDoc} />
            <MI
              label="New window"
              kbd="Ctrl+Shift+N"
              onClick={() => dispatch({ type: "NOTEPAD", payload: "full" })}
            />
            <MI sep />
            <MI label="Open…" kbd="Ctrl+O" onClick={openDoc} />
            <MI label="Save" kbd="Ctrl+S" onClick={() => saveDoc()} />
            <MI label="Save as…" kbd="Ctrl+Shift+S" onClick={saveAs} />
            <MI sep />
            <MI
              label="Page setup…"
              onClick={() =>
                notify({
                  app: "Notepad",
                  icon: "img/icon/notepad.png",
                  title: "Page setup is not part of this build",
                  kind: "info",
                })
              }
            />
            <MI label="Print…" kbd="Ctrl+P" onClick={print} />
            <MI sep />
            <MI
              label="Show in File Explorer"
              onClick={() => {
                if (doc.path)
                  dispatch({
                    type: "FILEPATH",
                    payload: doc.path.split("\\").slice(0, -1).join("\\"),
                  });
                dispatch({ type: "EXPLORER", payload: "full" });
              }}
            />
            <MI
              label="Properties"
              onClick={() =>
                wosConfirm(
                  [
                    `File: ${doc.name}`,
                    doc.path ? `Path: ${doc.path}` : "Path: not saved yet",
                    `Lines: ${stats.lines}`,
                    `Words: ${stats.words}`,
                    `Characters: ${stats.chars.toLocaleString()}`,
                    `Characters (no spaces): ${stats.charsNoSpace.toLocaleString()}`,
                    `Encoding: ${doc.enc === "utf8" ? "UTF-8" : "ANSI"}`,
                    `Line endings: ${doc.eol === "crlf" ? "Windows (CRLF)" : "Unix (LF)"}`,
                  ].join("\n"),
                  { title: `${doc.name} — Properties`, okText: "OK", cancelText: "Close" },
                )
              }
            />
            <MI sep />
            <MI label="Close tab" kbd="Ctrl+W" onClick={() => closeTab(ti)} />
          </MenuBtn>

          <MenuBtn id="edit" label="Edit">
            <MI label="Undo" kbd="Ctrl+Z" onClick={EDIT.undo} />
            <MI label="Redo" kbd="Ctrl+Y" onClick={EDIT.redo} />
            <MI sep />
            <MI label="Cut" kbd="Ctrl+X" onClick={EDIT.cut} />
            <MI label="Copy" kbd="Ctrl+C" onClick={EDIT.copy} />
            <MI label="Paste" kbd="Ctrl+V" onClick={EDIT.paste} />
            <MI label="Delete" kbd="Del" onClick={EDIT.del} />
            <MI sep />
            <MI
              label="Find…"
              kbd="Ctrl+F"
              onClick={() => setFind({ q: "", r: "", case: false, open: true })}
            />
            <MI label="Find next" kbd="F3" onClick={() => doFind(1)} />
            <MI label="Find previous" kbd="Shift+F3" onClick={() => doFind(-1)} />
            <MI
              label="Replace…"
              kbd="Ctrl+H"
              onClick={() => setFind({ q: "", r: "", case: false, open: true, replace: true })}
            />
            <MI
              label="Go to…"
              kbd="Ctrl+G"
              onClick={async () => {
                const g = await wosPrompt("Line number:", {
                  title: "Go to Line",
                  value: String(caret.ln),
                });
                const n = parseInt(g, 10);
                if (!n || n < 1) return;
                const lines = doc.text.split("\n");
                if (n > lines.length) {
                  notify({
                    app: "Notepad",
                    icon: "img/icon/notepad.png",
                    title: `Cannot go to line ${n}`,
                    body: `The document has ${lines.length} lines.`,
                    kind: "warn",
                  });
                  return;
                }
                const at = lines.slice(0, n - 1).reduce((a, l) => a + l.length + 1, 0);
                ta.current?.focus();
                ta.current?.setSelectionRange(at, at);
                scrollCaretIntoView(at);
                trackCaret();
              }}
            />
            <MI sep />
            <MI label="Select all" kbd="Ctrl+A" onClick={EDIT.all} />
            <MI label="Time/date" kbd="F5" onClick={EDIT.time} />
          </MenuBtn>

          <MenuBtn id="view" label="View">
            <MI
              label="Zoom in"
              kbd="Ctrl++"
              onClick={() => setZoom((z) => Math.min(400, z + 10))}
            />
            <MI
              label="Zoom out"
              kbd="Ctrl+-"
              onClick={() => setZoom((z) => Math.max(25, z - 10))}
            />
            <MI label="Restore default zoom" kbd="Ctrl+0" onClick={() => setZoom(100)} />
            <MI sep />
            <MI
              label="Status bar"
              check
              onClick={() =>
                notify({
                  app: "Notepad",
                  icon: "img/icon/notepad.png",
                  title: "The status bar is always on in this build",
                  kind: "info",
                  life: 3,
                })
              }
            />
            <MI label="Word wrap" check={doc.wrap} onClick={() => patch({ wrap: !doc.wrap })} />
          </MenuBtn>
        </div>

        {/* ---- find / replace ---- */}
        {find?.open ? (
          <div className="npFind" data-replace={!!find.replace}>
            <div className="npFindHead">
              <b>{find.replace ? "Replace" : "Find"}</b>
              <button
                type="button"
                className="npFindX"
                onClick={() => setFind(null)}
                aria-label="Close"
              >
                <svg viewBox="0 0 12 12" width="9" height="9">
                  <path
                    d="M1 1l10 10M11 1L1 11"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <label className="npFindRow">
              <span>Find</span>
              <input
                autoFocus
                value={find.q}
                onChange={(e) => setFind({ ...find, q: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    doFind(e.shiftKey ? -1 : 1);
                  }
                  if (e.key === "Escape") setFind(null);
                }}
              />
            </label>
            {find.replace ? (
              <label className="npFindRow">
                <span>Replace with</span>
                <input
                  value={find.r || ""}
                  onChange={(e) => setFind({ ...find, r: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      doReplace();
                    }
                    if (e.key === "Escape") setFind(null);
                  }}
                />
              </label>
            ) : null}
            <div className="npFindActs">
              <label className="npCheck">
                <input
                  type="checkbox"
                  checked={!!find.case}
                  onChange={(e) => setFind({ ...find, case: e.target.checked })}
                />
                <span>Match case</span>
              </label>
              <button type="button" className="npFindBtn" onClick={() => doFind(-1)}>
                Previous
              </button>
              <button type="button" className="npFindBtn" onClick={() => doFind(1)}>
                Next
              </button>
              {find.replace ? (
                <button type="button" className="npFindBtn accent" onClick={doReplace}>
                  Replace all
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ---- the document ---- */}
        <div className="restWindow h-full flex-grow">
          <textarea
            ref={ta}
            className="noteText win11Scroll"
            style={{
              fontSize: (14 * zoom) / 100,
              whiteSpace: doc.wrap ? "pre-wrap" : "pre",
              overflowWrap: doc.wrap ? "break-word" : "normal",
            }}
            value={doc.text}
            spellCheck={false}
            wrap={doc.wrap ? "soft" : "off"}
            onChange={(e) => markDirty(e.target.value)}
            onClick={() => {
              setMenu(null);
              trackCaret();
            }}
            onKeyUp={trackCaret}
            onSelect={trackCaret}
          />
        </div>

        {/* ---- status bar ---- */}
        <div className="npStatus">
          <span>
            Ln {caret.ln}, Col {caret.col}
          </span>
          {caret.sel ? <span>{caret.sel} selected</span> : null}
          <span>{stats.chars.toLocaleString()} characters</span>
          <span className="npStatusSpacer" />
          <span>{zoom}%</span>
          <button
            type="button"
            className="npStatusSel"
            onClick={() => setMenu("view")}
            title="Word wrap"
          >
            {doc.wrap ? "Word wrap: On" : "Word wrap: Off"}
          </button>
          <button
            type="button"
            className="npStatusSel"
            title="Line endings"
            onClick={async () => {
              const pick = await wosPrompt("Line endings — type crlf or lf:", {
                title: "Line endings",
                value: doc.eol,
              });
              if (pick && /^(crlf|lf)$/i.test(pick.trim()))
                patch({ eol: pick.trim().toLowerCase() });
            }}
          >
            {doc.eol === "lf" ? "Unix (LF)" : "Windows (CRLF)"}
          </button>
          <span className="npStatusSel static">{doc.enc === "utf8" ? "UTF-8" : "ANSI"}</span>
        </div>
      </div>
    </div>
  );
};

export default Notepad;
