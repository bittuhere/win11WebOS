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

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Icon } from "../../utils/general";
import { handleFileOpen } from "../../actions";
import { openExternal } from "../../utils/os/links";
import * as vs from "../../utils/os/vs";
import { iconForItem } from "../../utils/os/icons";

/* ---------------------------------------------------------------------- *
 *  Search: how a hit is ranked, how the matched letters are shown, and
 *  where a web search goes.
 *
 *  Windows ranks by how well the NAME matches, never by alphabet: the whole
 *  name, a word start, a substring, the letters in order, or a single typo.
 *  "notpad", "note pad", "notpead" and "snipping" all land on the right app.
 * ---------------------------------------------------------------------- */

const SEQ = (n, q) => {
  let i = 0;
  for (let j = 0; j < n.length && i < q.length; j++) if (n[j] === q[i]) i++;
  return i === q.length;
};

/* one edit apart: a missing, an extra or a swapped letter */
const typo = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

const scoreName = (name, words) => {
  const n = String(name || "").toLowerCase();
  if (!n) return -1;
  const joined = words.join(" ");
  if (words.every((w) => n.includes(w))) {
    if (n === joined) return 100; // "notepad"
    if (n.startsWith(joined)) return 92; // "note"
    if (words.some((w) => n.startsWith(w))) return 82; // "pad" in "pad app"
    if (words.some((w) => n.split(/[\s\-_.]+/).includes(w))) return 74;
    return 64; // somewhere inside
  }
  if (words.length !== 1 || n.length < 2) return -1;
  const w = words[0];
  if (SEQ(n, w)) return 44; // n-o-t-p-a-d
  if (w.length >= 4) {
    const [short, long] = n.length <= w.length ? [n, w] : [w, n];
    if (long.startsWith(short) || typo(short, long)) return 34;
    if (n.split(/[\s\-_.]+/).some((t) => t.length >= 3 && typo(t, w))) return 30;
  }
  return -1;
};

/* Bold the letters that matched, so a fuzzy hit explains itself. */
const Hi = ({ name, q }) => {
  const text = String(name || "");
  const low = text.toLowerCase();
  const words = String(q || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const hit = new Set();
  let solid = 0;
  words.forEach((w) => {
    const at = low.indexOf(w);
    if (at >= 0) {
      solid++;
      for (let k = at; k < at + w.length; k++) hit.add(k);
    }
  });
  if (!solid && words.length) {
    const w = words.join("");
    let i = 0;
    for (let j = 0; j < low.length && i < w.length; j++) {
      if (low[j] === w[i]) {
        hit.add(j);
        i++;
      }
    }
  }
  return (
    <>
      {[...text].map((ch, i) =>
        hit.has(i) ? (
          <b key={i} className="shHi">
            {ch}
          </b>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
};

/* Where the Web tab sends a query. The PC has no search index of its own,
   so a web tab that CANNOT reach a real engine is just decoration. */
const ENGINES = [
  ["Google", "https://www.google.com/search?q="],
  ["Bing", "https://www.bing.com/search?q="],
  ["DuckDuckGo", "https://duckduckgo.com/?q="],
  ["Wikipedia", "https://en.wikipedia.org/w/index.php?search="],
  ["YouTube", "https://www.youtube.com/results?search_query="],
  ["GitHub", "https://github.com/search?q="],
];

const TABS = ["All", "Apps", "Files", "Web"];

export const StartMenu = () => {
  const { align } = useSelector((state) => state.taskbar);
  const start = useSelector((state) => {
    // pure selector: never mutate the redux state — copy, pad, format
    const base = state.startmenu;
    const ln = (6 - (base.pnApps.length % 6)) % 6;
    const pnApps = ln
      ? base.pnApps.concat(Array.from({ length: ln }, () => ({ empty: true })))
      : base.pnApps;
    const fmt = (v) => {
      if (v == null) return "";
      if (v < 0) return "Recently Added";
      if (v < 10) return "Just Now";
      if (v < 60) return `${v}m ago`;
      if (v < 360) return `${Math.floor(v / 60)}h ago`;
      return v;
    };
    const rcApps = base.rcApps.map((r) => ({ ...r, lastUsed: fmt(r.lastUsed) }));
    const tmpApps = Object.keys(state.apps)
      .filter((x) => x != "hz")
      .map((key) => state.apps[key])
      .sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
    const allApps = Array.from({ length: 27 }, () => []);
    for (let i = 0; i < tmpApps.length; i++) {
      const t1 = tmpApps[i].name.trim().toUpperCase().charCodeAt(0);
      if (t1 > 64 && t1 < 91) allApps[t1 - 64].push(tmpApps[i]);
      else allApps[0].push(tmpApps[i]);
    }
    return { ...base, pnApps, rcApps, contApps: allApps, allApps: tmpApps };
  });

  const [atab, setTab] = useState("All");
  const srchRef = useRef(null);
  useEffect(() => {
    // the caret belongs in the search box, always — no hunting for it.
    // the menu is permanently mounted, so refocus every time it OPENS
    if (!start.hide) {
      srchRef.current?.focus?.();
      srchRef.current?.select?.();
    }
  }, [start.hide]);
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState({});
  const bestRef = useRef(null);

  /* every app and every file on this PC, scored against the query */
  const filesBin = useSelector((state) => state.files.data);
  /* the tree is mutated in place, so its identity never changes — a tick
     from the Virtual Storage is what tells us to re-walk it */
  const [fsTick, setFsTick] = useState(0);
  useEffect(() => {
    const bump = () => setFsTick((n) => n + 1);
    window.addEventListener("webos-vs-changed", bump);
    return () => window.removeEventListener("webos-vs-changed", bump);
  }, []);
  const allFiles = useMemo(() => {
    const bin = filesBin;
    if (!bin || !bin.lookup) return [];
    const out = [];
    Object.keys(bin.lookup).forEach((id) => {
      const it = bin.lookup[id];
      if (!it || !it.name || it.name.startsWith("%")) return;
      const path = vs.pathOf(it);
      /* an orphan (its parent was deleted) has no real Windows path */
      if (!/^[a-z]:\\/i.test(path)) return;
      out.push({ id: it.id, name: it.name, type: it.type, path });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesBin, fsTick]);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { apps: [], files: [] };
    const words = q.split(/\s+/).filter(Boolean);
    const apps = (start.allApps || [])
      .map((app) => ({
        kind: "app",
        name: app.name,
        icon: app.icon,
        action: app.action,
        payload: app.payload,
        s: scoreName(app.name, words),
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
    const files = allFiles
      .map((f) => {
        const ico = iconForItem({ type: f.type, name: f.name, info: {} });
        return {
          kind: f.type === "folder" ? "folder" : "doc",
          id: f.id,
          name: f.name,
          path: f.path,
          icon: ico.src,
          label: ico.label,
          s: scoreName(f.name, words),
        };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
    return { apps, files };
  }, [query, start.allApps, allFiles]);

  const foundCount = found.apps.length + found.files.length;

  /* the suggester: one flat, keyboard-walkable list per tab */
  const rows = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    if (atab === "Web")
      return ENGINES.map(([label, url]) => ({ kind: "engine", name: label, url }));
    let apps = found.apps;
    let files = found.files;
    if (atab === "Apps") files = [];
    if (atab === "Files") apps = [];
    const list = [
      ...apps.slice(0, atab === "All" ? 4 : 24),
      ...files.slice(0, atab === "All" ? 3 : 24),
    ];
    if (atab === "All") list.push({ kind: "web", name: q });
    return list;
  }, [query, atab, found]);

  const best = rows.find((r) => r.kind !== "web" && r.kind !== "engine") || null;

  const openItem = (item) => {
    if (!item) return;
    if (item.kind === "engine") {
      openExternal(item.url + encodeURIComponent(query.trim()));
      dispatch({ type: "STARTHID" });
      return;
    }
    if (item.kind === "doc") {
      handleFileOpen(item.id);
      dispatch({ type: "STARTHID" });
      return;
    }
    if (item.kind === "folder") {
      openLocation(item);
      return;
    }
    if (item.action) {
      dispatch({ type: item.action, payload: item.payload || "full" });
      dispatch({ type: "STARTHID" });
    }
  };

  /* Explorer, aimed at the folder that holds a file — the usual "Open file
     location" of a search result. */
  const openLocation = (item) => {
    const dir = String(item.path || "").replace(/\\[^\\]+$/, "");
    dispatch({ type: "FILEPATH", payload: dir, onFail: () => {} });
    dispatch({ type: "EXPLORER", payload: "full" });
    dispatch({ type: "STARTHID" });
  };

  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [query, atab]);
  const flatList = rows;
  const selItem = flatList[Math.min(sel, flatList.length - 1)] || best;

  const searchKey = (e) => {
    if (e.key === "Escape" && query) {
      /* first Escape empties the box, the next one closes the menu */
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!flatList.length) return;
      setSel((i) => {
        const n = flatList.length;
        return e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = flatList[sel];
      if (it) openItem(it);
      else if (query) dispatch({ type: "EDGELINK", payload: query });
    }
  };

  // const [pwctrl, setPowCtrl] = useState

  const dispatch = useDispatch();
  const tabSw = (e) => {
    setTab(e.target.innerText.trim());
  };

  const clickDispatch = (event) => {
    var action = {
      type: event.target.dataset.action,
      payload: event.target.dataset.payload,
    };

    if (action.type) {
      dispatch(action);
    }

    if (
      action.type &&
      (action.payload == "full" ||
        action.type == "EDGELINK" ||
        // a link that leaves for the real browser also closes the menu —
        // EXTERNALTAB carries a URL payload, so the "full" test above never
        // matched it and the menu used to stay open over the new tab
        action.type == "EXTERNALTAB")
    ) {
      dispatch({
        type: "STARTHID",
      });
    }

    if (action.type == "STARTALPHA") {
      var target = document.getElementById("char" + action.payload);
      if (target) {
        target.parentNode.scrollTop = target.offsetTop;
      } else {
        var target = document.getElementById("charA");
        target.parentNode.scrollTop = 0;
      }
    }
  };

  useEffect(() => {
    if (query.length) {
      for (var i = 0; i < start.allApps.length; i++) {
        if (start.allApps[i].name.toLowerCase().includes(query.toLowerCase())) {
          setMatch(start.allApps[i]);
          break;
        }
      }
    }
  }, [query]);

  const userName = useSelector((state) => state.setting.person.name);

  return (
    <div
      className="startMenu dpShad"
      data-hide={start.hide}
      style={{ "--prefix": "START" }}
      data-align={align}
    >
      {start.menu ? (
        <>
          <div className="stmenu" data-allapps={start.showAll}>
            <div className="menuUp">
              <div className="pinnedApps">
                <div className="stAcbar">
                  <div className="gpname">Pinned</div>
                  <div className="gpbtn prtclk" onClick={clickDispatch} data-action="STARTALL">
                    <div>All apps</div>
                    <Icon fafa="faChevronRight" width={8} />
                  </div>
                </div>
                <div className="pnApps">
                  {start.pnApps.map((app, i) => {
                    return app.empty ? (
                      <div key={i} className="pnApp pnEmpty"></div>
                    ) : (
                      <div
                        key={i}
                        className="prtclk pnApp"
                        value={app.action != null}
                        onClick={clickDispatch}
                        data-action={app.action}
                        data-payload={app.payload || "full"}
                        data-menu="app"
                        data-name={app.name}
                        data-icon={app.icon}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/x-wos-app", app.name);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                      >
                        <Icon className="pnIcon" src={app.icon} width={32} />
                        <div className="appName">{app.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="allCont" data-allapps={start.showAll}>
            <div className="appCont">
              <div className="stAcbar">
                <div className="gpname">All apps</div>
                <div className="gpbtn prtclk" onClick={clickDispatch} data-action="STARTALL">
                  <Icon className="chevLeft" fafa="faChevronLeft" width={8} />
                  <div>Back</div>
                </div>
              </div>
              <div className="allApps win11Scroll" data-alpha={start.alpha}>
                {start.contApps.map((ldx, i) => {
                  if (ldx.length == 0) return null;

                  var tpApps = [];
                  tpApps.push(
                    <div
                      key={i}
                      className="allApp prtclk"
                      data-action="STARTALPHA"
                      onClick={clickDispatch}
                      id={`char${i == 0 ? "#" : String.fromCharCode(i + 64)}`}
                    >
                      <div className="ltName">{i == 0 ? "#" : String.fromCharCode(i + 64)}</div>
                    </div>,
                  );

                  ldx.forEach((app, j) => {
                    tpApps.push(
                      <div
                        key={app.name}
                        className="allApp prtclk"
                        onClick={clickDispatch}
                        data-action={app.action}
                        data-payload={app.payload || "full"}
                        data-menu="app"
                        data-name={app.name}
                        data-icon={app.icon}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/x-wos-app", app.name);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                      >
                        <Icon className="pnIcon" src={app.icon} width={24} />
                        <div className="appName">{app.name}</div>
                      </div>,
                    );
                  });

                  return tpApps;
                })}
              </div>
              <div className="alphaBox" data-alpha={start.alpha}>
                <div className="alphaCont">
                  <div className="dullApp allApp">
                    <div className="ltName">&</div>
                  </div>
                  {start.contApps.map((ldx, i) => {
                    return (
                      <div
                        key={i}
                        className={ldx.length == 0 ? "dullApp allApp" : "allApp prtclk"}
                        data-action="STARTALPHA"
                        onClick={ldx.length == 0 ? null : clickDispatch}
                        data-payload={i == 0 ? "#" : String.fromCharCode(i + 64)}
                      >
                        <div className="ltName">{i == 0 ? "#" : String.fromCharCode(i + 64)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="menuBar">
            <div className="profile handcr">
              <Icon
                src="img/logo.png"
                ui
                rounded
                width={26}
                click="EXTERNALTAB"
                payload="https://github.com/bittuhere/win11WebOS"
              />
              <div className="usName">{userName}</div>
            </div>
            <div className="relative powerMenu">
              <div className="powerCont" data-vis={start.pwctrl}>
                <div
                  className="flex prtclk items-center gap-2"
                  onClick={clickDispatch}
                  data-action="WALLALOCK"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2a4 4 0 0 1 4 4v2h1.75A2.25 2.25 0 0 1 20 10.25v9.5A2.25 2.25 0 0 1 17.75 22H6.25A2.25 2.25 0 0 1 4 19.75v-9.5A2.25 2.25 0 0 1 6.25 8H8V6a4 4 0 0 1 4-4Zm5.75 7.5H6.25a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h11.5a.75.75 0 0 0 .75-.75v-9.5a.75.75 0 0 0-.75-.75Zm-5.75 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0-10A2.5 2.5 0 0 0 9.5 6v2h5V6A2.5 2.5 0 0 0 12 3.5Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Lock</span>
                </div>
                <div
                  className="flex prtclk items-center gap-2"
                  onClick={clickDispatch}
                  data-action="WALLSHUTDN"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.204 4.82a.75.75 0 0 1 .634 1.36A7.51 7.51 0 0 0 4.5 12.991c0 4.148 3.358 7.51 7.499 7.51s7.499-3.362 7.499-7.51a7.51 7.51 0 0 0-4.323-6.804.75.75 0 1 1 .637-1.358 9.01 9.01 0 0 1 5.186 8.162c0 4.976-4.029 9.01-9 9.01C7.029 22 3 17.966 3 12.99a9.01 9.01 0 0 1 5.204-8.17ZM12 2.496a.75.75 0 0 1 .743.648l.007.102v7.5a.75.75 0 0 1-1.493.102l-.007-.102v-7.5a.75.75 0 0 1 .75-.75Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Shut down</span>
                </div>
                <div
                  className="flex prtclk items-center gap-2"
                  onClick={clickDispatch}
                  data-action="WALLRESTART"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 4.5a7.5 7.5 0 1 1-7.419 6.392c.067-.454-.265-.892-.724-.892a.749.749 0 0 0-.752.623A9 9 0 1 0 6 5.292V4.25a.75.75 0 0 0-1.5 0v3c0 .414.336.75.75.75h3a.75.75 0 0 0 0-1.5H6.9a7.473 7.473 0 0 1 5.1-2Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Restart</span>
                </div>
              </div>
              <svg
                width="20"
                height="20"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                onClick={clickDispatch}
                data-action="STARTPWC"
              >
                <path
                  d="M8.204 4.82a.75.75 0 0 1 .634 1.36A7.51 7.51 0 0 0 4.5 12.991c0 4.148 3.358 7.51 7.499 7.51s7.499-3.362 7.499-7.51a7.51 7.51 0 0 0-4.323-6.804.75.75 0 1 1 .637-1.358 9.01 9.01 0 0 1 5.186 8.162c0 4.976-4.029 9.01-9 9.01C7.029 22 3 17.966 3 12.99a9.01 9.01 0 0 1 5.204-8.17ZM12 2.496a.75.75 0 0 1 .743.648l.007.102v7.5a.75.75 0 0 1-1.493.102l-.007-.102v-7.5a.75.75 0 0 1 .75-.75Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </>
      ) : (
        <div className="searchMenu">
          <div className="searchBar">
            <Icon className="searchIcon" src="search" width={16} />
            <input
              ref={srchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={searchKey}
              placeholder="Type here to search"
              spellCheck={false}
              autoComplete="off"
            />
            {query ? (
              <div className="srchClear handcr" title="Clear (Esc)" onClick={() => setQuery("")}>
                <Icon fafa="faXmark" width={11} />
              </div>
            ) : null}
          </div>
          <div className="flex py-3 px-1 text-xs">
            <div className="opts w-full flex justify-between">
              {TABS.map((t) => (
                <div key={t} className="prtclk handcr" value={atab === t} onClick={() => setTab(t)}>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="shResult w-full flex justify-between">
            <div className="leftSide flex-col px-1" data-width={query.length != 0}>
              {query.length ? (
                <>
                  <div className="text-sm font-semibold mb-3">
                    {atab === "Web" ? "Web search" : foundCount ? "Best match" : "No results"}
                  </div>
                  {foundCount || atab === "Web" ? (
                    <div className="textResult">
                      {rows.map((item, i) => {
                        if (item.kind === "web")
                          return (
                            <div
                              key="web"
                              className="smatch flex my-2 p-3 rounded handcr prtclk"
                              data-sel={sel === i}
                              onMouseEnter={() => setSel(i)}
                              onClick={clickDispatch}
                              data-action="EDGELINK"
                              data-payload={query}
                            >
                              <Icon className="blueicon" src="search" ui width={22} />
                              <div className="matchInfo flex-col px-2">
                                <div className="font-semibold text-xs">
                                  Search the PC for “{query.trim()}”
                                </div>
                                <div className="text-xss">Web</div>
                              </div>
                            </div>
                          );
                        if (item.kind === "engine")
                          return (
                            <div
                              key={item.name}
                              className="smatch flex my-2 p-3 rounded handcr prtclk"
                              data-sel={sel === i}
                              onMouseEnter={() => setSel(i)}
                              onClick={() => openItem(item)}
                            >
                              <Icon className="blueicon" src="search" ui width={22} />
                              <div className="matchInfo flex-col px-2">
                                <div className="font-semibold text-xs">
                                  {item.name}: “{query.trim()}”
                                </div>
                                <div className="text-xss">Web · opens in your browser</div>
                              </div>
                            </div>
                          );
                        return (
                          <div
                            key={item.kind + (item.id || item.name) + i}
                            className={`smatch flex my-2 p-3 rounded handcr prtclk ${i === 0 ? "smatchHero" : ""}`}
                            data-sel={sel === i}
                            onMouseEnter={() => setSel(i)}
                            onClick={() => openItem(item)}
                          >
                            <Icon src={item.icon} width={i === 0 ? 40 : 22} />
                            <div className="matchInfo flex-col px-2">
                              <div className={`font-semibold ${i === 0 ? "text-sm" : "text-xs"}`}>
                                <Hi name={item.name} q={query} />
                              </div>
                              <div className="text-xss">
                                {item.kind === "app"
                                  ? "App"
                                  : item.kind === "folder"
                                    ? `Folder · ${item.path}`
                                    : `File · ${item.path}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="shEmpty">
                      <div className="text-xs">
                        {foundCount
                          ? `Nothing in ${atab} matches “${query.trim()}”.`
                          : `Nothing on this PC matches “${query.trim()}”.`}
                      </div>
                      <div className="shHint">
                        {foundCount
                          ? "Switch to All — the hits are in the other tabs."
                          : "Spelling is forgiving (“notpad” finds Notepad). Only apps and files already on this PC are searched."}
                      </div>
                      <div
                        className="shWebBtn handcr prtclk"
                        onClick={() =>
                          openExternal(`${ENGINES[0][1]}${encodeURIComponent(query.trim())}`)
                        }
                      >
                        <Icon className="blueicon" src="search" ui width={16} />
                        <span>Search Google for “{query.trim()}”</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="topApps flex w-full justify-between">
                    {start.rcApps.slice(1, 7).map((app, i) => {
                      return (
                        <div
                          key={i}
                          className="topApp pt-6 py-4 ltShad prtclk"
                          onClick={clickDispatch}
                          data-action={app.action}
                          data-payload={app.payload || "full"}
                        >
                          <Icon src={app.icon} width={30} />
                          <div className="text-xs mt-2">{app.name}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-sm font-semibold mt-8">Quick Searches</div>
                  <div className="quickSearches mt-2">
                    {start.qksrch.map((srch, i) => {
                      return (
                        <div
                          key={i}
                          className="qksrch flex items-center p-3 my-1 handcr prtclk"
                          onClick={clickDispatch}
                          data-action="EDGELINK"
                          data-payload={srch[2]}
                        >
                          <Icon fafa={srch[0]} reg={srch[1]} />
                          <div className="ml-4 text-sm">{srch[2]}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {query.length && selItem ? (
              <div className="w-2/3 rightSide rounded" key={(selItem.path || selItem.name) + sel}>
                <Icon className="mt-6 shPrevIcon" src={selItem.icon} width={80} />
                <div className="shPrevName">
                  <Hi name={selItem.name} q={query} />
                </div>
                <div className="text-xss mt-2">
                  {selItem.kind === "app" ? "App" : selItem.kind === "folder" ? "Folder" : "File"}
                </div>
                {selItem.path ? <div className="shPrevPath">{selItem.path}</div> : null}
                <div className="hline mt-8"></div>
                <div
                  className="openlink w-4/5 flex prtclk handcr pt-3"
                  onClick={() => openItem(selItem)}
                >
                  <Icon className="blueicon" src="link" ui width={16} />
                  <div className="text-xss ml-3">
                    {selItem.kind === "doc"
                      ? "Open the file"
                      : selItem.kind === "folder"
                        ? "Open the folder"
                        : "Open"}
                  </div>
                </div>
                {selItem.kind === "doc" || selItem.kind === "folder" ? (
                  <div
                    className="openlink w-4/5 flex prtclk handcr pt-3"
                    onClick={() => openLocation(selItem)}
                  >
                    <Icon className="blueicon" src="folder" ui width={16} />
                    <div className="text-xss ml-3">Open file location</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
