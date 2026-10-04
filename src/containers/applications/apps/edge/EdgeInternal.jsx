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
import { idb, uid } from "../../../../utils/idb";
import { wosConfirm, wosPrompt, notify } from "../../../../utils/os/ui";
import { WosSelect, WosToggle } from "../../../../components/shared/Controls";
import {
  DEFAULT_FAVORITES,
  ENGINES,
  HOME,
  INTERNAL,
  bingSuggest,
  displayUrl,
  favicon,
  hostOf,
  isFrameable,
  isValidURL,
  looksLikeUrl,
} from "./edgeNav";

/* ------------------------------------------------------------------ *
 *  Small shared bits
 * ------------------------------------------------------------------ */

const EdgeGlyph = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <defs>
      <linearGradient id={`eg-${size}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#50e6ff" />
        <stop offset="55%" stopColor="#0078d4" />
        <stop offset="100%" stopColor="#32d4fa" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill={`url(#eg-${size})`} />
    <path
      d="M13 26c6-11 22-12 25-4-8-2-14 1-17 8 6-2 12 0 17 5-8 6-22 4-25-9z"
      fill="#fff"
      opacity="0.95"
    />
  </svg>
);

const ago = (ts) => {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)} min ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const dayKey = (ts) => new Date(ts).toDateString();

const Fav = ({ url, size = 16 }) => {
  const [src, setSrc] = useState(favicon(url, 64));
  const f = favicon(url, 64);
  useEffect(() => setSrc(f), [f]);
  if (!src) return <span className="egFavLetter">{(hostOf(url) || "?")[0].toUpperCase()}</span>;
  return (
    <img className="egFav" src={src} width={size} height={size} alt="" onError={() => setSrc("")} />
  );
};

const PageHead = ({ eyebrow, title, sub, right }) => (
  <div className="egPageHead">
    <div>
      {eyebrow ? <div className="egEyebrow">{eyebrow}</div> : null}
      <h1>{title}</h1>
      {sub ? <p>{sub}</p> : null}
    </div>
    {right ? <div className="egPageHeadRight">{right}</div> : null}
  </div>
);

/* ================================================================== *
 *  edge://newtab — the Microsoft Edge start page
 * ================================================================== */

export const NewTabPage = ({ onGo, settings, favs, history, extInstalled }) => {
  const [q, setQ] = useState("");
  const [hints, setHints] = useState([]);
  const [hi, setHi] = useState(-1);
  const [focus, setFocus] = useState(false);
  const inputRef = useRef(null);

  const engine = ENGINES[settings.engine] || ENGINES.google;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 220);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setHints([]);
      setHi(-1);
      return;
    }
    const t = setTimeout(() => {
      bingSuggest(q)
        .then((r) => {
          setHints(r || []);
          setHi(-1);
        })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  // quick links: pinned favourites first, then the sites you actually visit
  const quick = useMemo(() => {
    const seen = new Map();
    history.forEach((h) => {
      if (!h.url || h.url.startsWith("search:") || h.url.startsWith("edge:")) return;
      const host = hostOf(h.url);
      if (!host) return;
      const prev = seen.get(host);
      if (prev) prev.hits += 1;
      else seen.set(host, { url: h.url, host, hits: 1, title: h.title || host });
    });
    const fromFav = favs
      .filter((f) => isFrameable(f.url))
      .map((f) => ({
        url: f.url,
        host: hostOf(f.url),
        title: f.name,
        hits: 999,
        pinned: true,
      }));
    const fromHist = [...seen.values()].sort((a, b) => b.hits - a.hits).slice(0, 8);
    const out = [];
    const usedHost = new Set();
    [...fromFav, ...fromHist].forEach((x) => {
      if (usedHost.has(x.host)) return;
      usedHost.add(x.host);
      out.push(x);
    });
    return out.slice(0, 10);
  }, [favs, history]);

  /* a plain query becomes the ENGINE'S OWN page — never an empty or
     relative url, no matter what happens around the form submit */
  const goQuery = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return;
    if (/^https?:\/\//i.test(v) || looksLikeUrl(v) || isValidURL(v)) return onGo(v);
    onGo(engine.build(v));
  };

  const submit = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (hi >= 0 && hints[hi]) return onGo(hints[hi]);
    goQuery(q);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((n) => Math.min(hints.length - 1, n + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((n) => Math.max(-1, n - 1));
    } else if (e.key === "Escape") {
      setHints([]);
      setHi(-1);
    } else if (e.key === "Enter") {
      // not every environment fires the form's implicit submit on Enter —
      // route it through submit() so the query ALWAYS searches
      e.preventDefault();
      submit(e);
    }
  };

  const shown = hi >= 0 && hints[hi] ? hints[hi] : q;

  return (
    <div className="egNewTab" data-wall={settings.ntpWall}>
      <div className="egNtpGlow" />
      <div className="egNtpInner">
        <div className="egNtpBrand">
          <EdgeGlyph size={34} />
          <span>Microsoft Edge</span>
        </div>

        <form className="egNtpSearch" onSubmit={submit}>
          <svg className="egNtpMag" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.6-3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={shown}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(-1);
            }}
            onKeyDown={onKey}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 120)}
            placeholder={`Search with ${engine.name} or type a web address`}
            autoComplete="off"
            spellCheck={false}
          />
          {q ? (
            <button
              type="button"
              className="egNtpClear"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              aria-label="Clear"
            >
              <svg viewBox="0 0 12 12" width="10" height="10">
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
          <button type="submit" className="egNtpGo">
            Search
          </button>

          {hints.length && focus ? (
            <div className="egNtpHints">
              {hints.slice(0, 8).map((h, i) => (
                <button
                  type="button"
                  key={h + i}
                  className={i === hi ? "on" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goQuery(h)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M20 20l-3.6-3.6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  {h}
                </button>
              ))}
            </div>
          ) : null}
        </form>

        {quick.length ? (
          <div className="egNtpQuick">
            {quick.map((x) => (
              <button type="button" key={x.url} onClick={() => onGo(x.url)} title={x.url}>
                <span className="egNtpTile">
                  <Fav url={x.url} size={22} />
                </span>
                <span className="egNtpTileName">{x.title || x.host}</span>
              </button>
            ))}
            <button
              type="button"
              className="egNtpAdd"
              onClick={() => onGo("edge://favorites")}
              title="Manage favourites"
            >
              <span className="egNtpTile add">
                <svg viewBox="0 0 20 20" width="18" height="18">
                  <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="egNtpTileName">Add</span>
            </button>
          </div>
        ) : null}

        <div className="egNtpFoot">
          <span>
            Some sites refuse to be shown inside another page — for those, open them in a real
            browser tab.
          </span>
          <button type="button" onClick={() => onGo("edge://settings")}>
            Customise this page
          </button>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== *
 *  edge://history
 * ================================================================== */

export const HistoryPage = ({ history, onGo, onClear, onDelete, onOpenDownloads }) => {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const list = history
      .filter(
        (h) =>
          !q ||
          (h.title || "").toLowerCase().includes(q.toLowerCase()) ||
          (h.url || "").toLowerCase().includes(q.toLowerCase()),
      )
      .slice()
      .sort((a, b) => b.at - a.at);
    const out = [];
    let cur = null;
    list.forEach((h) => {
      const k = dayKey(h.at);
      if (!cur || cur.key !== k) {
        cur = {
          key: k,
          label:
            k === new Date().toDateString()
              ? "Today - " +
                new Date(h.at).toLocaleDateString(undefined, { month: "long", day: "numeric" })
              : new Date(h.at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }),
          items: [],
        };
        out.push(cur);
      }
      cur.items.push(h);
    });
    return out;
  }, [history, q]);

  return (
    <div className="egPage egHistory">
      <PageHead
        eyebrow="Microsoft Edge"
        title="History"
        right={
          <div className="egRowBtns">
            <button type="button" className="egBtn" onClick={onOpenDownloads}>
              Downloads
            </button>
            <button
              type="button"
              className="egBtn"
              onClick={async () => {
                const ok = await wosConfirm("Clear all browsing history from this PC?", {
                  title: "Clear browsing data",
                  okText: "Clear",
                  danger: true,
                });
                if (ok) {
                  onClear();
                  notify({
                    app: "Microsoft Edge",
                    icon: "img/icon/edge.png",
                    title: "Browsing history cleared",
                    kind: "success",
                    life: 3,
                  });
                }
              }}
            >
              Clear history
            </button>
          </div>
        }
      />
      <div className="egSearchField">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.6-3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search history"
          spellCheck={false}
        />
      </div>

      {!groups.length ? (
        <div className="egEmpty">Your browsing history will show up here.</div>
      ) : null}

      {groups.map((g) => (
        <div className="egHistDay" key={g.key}>
          <h3>{g.label}</h3>
          <div className="egList">
            {g.items.map((h) => (
              <div className="egRow" key={h.id || h.at + h.url}>
                <button type="button" className="egRowMain" onClick={() => onGo(h.url)}>
                  <Fav url={h.url.startsWith("search:") ? "https://www.bing.com" : h.url} />
                  <span className="egRowTitle">{h.title || h.url}</span>
                  <span className="egRowUrl">
                    {h.url.startsWith("search:") ? "Bing · " + h.url.slice(7) : displayUrl(h.url)}
                  </span>
                </button>
                <span className="egRowTime">
                  {new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  type="button"
                  className="egRowX"
                  aria-label="Remove"
                  onClick={() => onDelete(h.id)}
                >
                  <svg viewBox="0 0 12 12" width="10" height="10">
                    <path
                      d="M1 1l10 10M11 1L1 11"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ================================================================== *
 *  edge://downloads
 * ================================================================== */

export const DownloadsPage = ({ downloads, onRedownload, onDelete, onClear }) => (
  <div className="egPage egDownloads">
    <PageHead
      eyebrow="Microsoft Edge"
      title="Downloads"
      sub="Everything you download is written to Virtual Storage — C:\Users\<you>\Downloads — and stays on this PC."
      right={
        downloads.length ? (
          <button type="button" className="egBtn" onClick={onClear}>
            Clear list
          </button>
        ) : null
      }
    />
    {!downloads.length ? (
      <div className="egEmpty">
        <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden>
          <path
            d="M24 6v26M14 22l10 10 10-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8 38h32" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <p>Nothing downloaded yet.</p>
      </div>
    ) : (
      <div className="egList">
        {downloads.map((d) => (
          <div className="egRow egDl" key={d.id}>
            <span className="egDlIco">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <path
                  d="M13 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M13 2v6h6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <div className="egDlInfo">
              <div className="egDlName">{d.name}</div>
              <div className="egDlMeta">
                {d.path} · {d.sizeLabel || ""} · {ago(d.at)}
              </div>
            </div>
            <div className="egRowBtns">
              <button type="button" className="egBtn ghost" onClick={() => onRedownload(d)}>
                Open
              </button>
              <button type="button" className="egBtn ghost" onClick={() => onDelete(d.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

/* ================================================================== *
 *  edge://favorites
 * ================================================================== */

export const FavoritesPage = ({ favs, onGo, onAdd, onRename, onDelete }) => (
  <div className="egPage egFavs">
    <PageHead
      eyebrow="Microsoft Edge"
      title="Favourites"
      right={
        <button
          type="button"
          className="egBtn accent"
          onClick={async () => {
            const url = await wosPrompt("Web address:", {
              title: "Add a favourite",
              okText: "Add",
            });
            if (!url) return;
            const name = await wosPrompt("Name:", {
              title: "Add a favourite",
              value: hostOf(url) || url,
              okText: "Add",
            });
            if (name === null) return;
            onAdd({ name: name || hostOf(url) || url, url });
          }}
        >
          Add favourite
        </button>
      }
    />
    {!favs.length ? (
      <div className="egEmpty">
        No favourites yet. Press the star in the address bar to add one.
      </div>
    ) : null}
    <div className="egFavGrid">
      {favs.map((f, i) => (
        <div className="egFavCard" key={f.url + i}>
          <button type="button" className="egFavOpen" onClick={() => onGo(f.url)}>
            <Fav url={f.url} size={24} />
            <span>{f.name}</span>
            <i>{displayUrl(f.url)}</i>
          </button>
          <div className="egFavActs">
            <button type="button" title="Rename" onClick={() => onRename(i)}>
              <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden>
                <path
                  d="M3 14.5L13.5 4l2.5 2.5L5.5 17H3v-2.5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button type="button" title="Delete" onClick={() => onDelete(i)}>
              <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden>
                <path
                  d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ================================================================== *
 *  edge://settings
 * ================================================================== */

export const SettingsPage = ({
  settings,
  onChange,
  favs,
  onGo,
  historyCount,
  downloadCount,
  extInstalled,
}) => {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <div className="egPage egSettings">
      <PageHead eyebrow="Microsoft Edge" title="Settings" />

      <section className="egSetSec">
        <h3>Start, home, and new tabs</h3>
        <div className="egSetRow">
          <div>
            <b>Home button</b>
            <p>Where the house icon takes you.</p>
          </div>
          <input
            className="egInput wide"
            value={settings.home}
            onChange={(e) => set("home", e.target.value)}
            placeholder="edge://newtab"
            spellCheck={false}
          />
        </div>
        <div className="egSetRow">
          <div>
            <b>Open the new tab page on start-up</b>
            <p>Edge always starts with a fresh tab.</p>
          </div>
          <WosToggle on={settings.openNewTab} onChange={(v) => set("openNewTab", v)} />
        </div>
        <div className="egSetRow">
          <div>
            <b>New tab background</b>
            <p>The picture behind the search box.</p>
          </div>
          <WosSelect
            value={settings.ntpWall}
            onChange={(v) => set("ntpWall", v)}
            options={[
              { value: "bloom", label: "Bloom (default)" },
              { value: "dark", label: "Dark" },
              { value: "wall0", label: "Windows wallpaper — light" },
              { value: "wall1", label: "Windows wallpaper — dark" },
              { value: "plain", label: "Plain" },
            ]}
          />
        </div>
      </section>

      <section className="egSetSec">
        <h3>Search engine</h3>
        <div className="egSetRow">
          <div>
            <b>Address bar search</b>
            <p>Used when what you type is not a web address.</p>
          </div>
          <WosSelect
            value={settings.engine}
            onChange={(v) => set("engine", v)}
            options={Object.keys(ENGINES).map((k) => ({ value: k, label: ENGINES[k].name }))}
          />
        </div>
        <div className="egSetRow">
          <div>
            <b>Show suggestions as I type</b>
            <p>Bing suggestions in the address bar and on the new tab page.</p>
          </div>
          <WosToggle on={settings.suggest} onChange={(v) => set("suggest", v)} />
        </div>
      </section>

      <section className="egSetSec">
        <h3>Appearance</h3>
        <div className="egSetRow">
          <div>
            <b>Show the favourites bar</b>
            <p>{favs.length} favourites.</p>
          </div>
          <WosToggle on={settings.showFavBar} onChange={(v) => set("showFavBar", v)} />
        </div>
        <div className="egSetRow">
          <div>
            <b>Show the sidebar</b>
            <p>Tools, Chat and Apps on the right of every page.</p>
          </div>
          <WosToggle on={settings.showSidebar} onChange={(v) => set("showSidebar", v)} />
        </div>
        <div className="egSetRow">
          <div>
            <b>Follow the Windows theme</b>
            <p>Edge paints itself with the desktop theme.</p>
          </div>
          <WosToggle on={settings.followTheme} onChange={(v) => set("followTheme", v)} />
        </div>
      </section>

      <section className="egSetSec">
        <h3>Privacy, search, and services</h3>
        <div className="egSetRow">
          <div>
            <b>Tracking prevention</b>
            <p>Balanced stops most trackers from following you between sites.</p>
          </div>
          <WosSelect
            value={settings.tracking}
            onChange={(v) => set("tracking", v)}
            options={[
              { value: "basic", label: "Basic" },
              { value: "balanced", label: "Balanced (recommended)" },
              { value: "strict", label: "Strict" },
            ]}
          />
        </div>
        <div className="egSetRow">
          <div>
            <b>Clear browsing data</b>
            <p>
              {historyCount} history entries · {downloadCount} downloads on this PC.
            </p>
          </div>
          <button
            type="button"
            className="egBtn"
            onClick={async () => {
              const ok = await wosConfirm(
                "This clears history, downloads and cached favicons from this PC.",
                { title: "Clear browsing data", okText: "Clear now", danger: true },
              );
              if (ok) {
                await idb.clear("history").catch(() => {});
                notify({
                  app: "Microsoft Edge",
                  icon: "img/icon/edge.png",
                  title: "Browsing data cleared",
                  kind: "success",
                  life: 3,
                });
                onChange({ ...settings, __cleared: Date.now() });
              }
            }}
          >
            Choose what to clear
          </button>
        </div>
      </section>

      <section className="egSetSec"></section>

      <section className="egSetSec">
        <h3>About Microsoft Edge</h3>
        <div className="egAbout">
          <EdgeGlyph size={44} />
          <div>
            <b>Microsoft Edge</b>
            <p>Version 126.0.2592.102 (WebOS build)</p>
            <p>
              Chromium 126.0.6478.127 · A faithful recreation for this desktop. Not affiliated with
              Microsoft Corporation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ================================================================== *
 *  snapshot: the full original page, urls absolutized, rendered in a
 *  sandboxed frame. The site's own CSS + images load — it looks like
 *  itself, minus the scripts.
 * ================================================================== */
/* A static copy of a page that refuses to embed — shown only WITHOUT the
   helper. No bar, no chrome: scripts and styles run; a toast explains. */
export const SnapshotPage = ({ html, url, title }) => (
  <div className="egSnap">
    <iframe
      title={title || url}
      className="egSnapFrame"
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
    />
  </div>
);

/* ================================================================== *
 *  edge:// reader (a page fetched through the helper)
 * ================================================================== */

export const ReaderPage = ({ html, url, title, onLink }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const click = (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;
      e.preventDefault();
      onLink?.(a.getAttribute("href"));
    };
    el.addEventListener("click", click);
    return () => el.removeEventListener("click", click);
  }, [html, onLink]);

  return (
    <div className="egPage egReader">
      <div className="egReaderBar">
        <span>
          <Fav url={url} size={14} /> {title || hostOf(url)}
        </span>
        <em>Reader — this site blocks framing, so Edge fetched and re-rendered it as text</em>
      </div>
      <article className="egReaderBody" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

/* ================================================================== *
 *  The "can't reach this page" screen — honest about framing, offers
 *  the escape hatches that still exist (retry, reader, home, real tab).
 * ================================================================== */
const ERR_HEAD = {
  xfo: "This site refuses to be shown inside another page",
  net: "Hmm… your internet access is blocked", // kept for parity; network errors surface below
  dns: "We can't reach this site",
  cert: "Your connection isn't private",
  http: "This page isn't working",
  strip: "This site can't be reached",
};

export const ErrorPage = ({
  url,
  reason,
  kind,
  code,
  detail,
  canRead,
  onRetry,
  onHome,
  onReader,
}) => {
  const head = ERR_HEAD[kind] || "This page can't be displayed";
  return (
    <div className="egError">
      <div className="egErrorArt">
        <EdgeGlyph size={72} />
      </div>
      <h1>{head}</h1>
      <div className="egErrorUrl">{url}</div>
      <p className="egErrorWhy">
        {reason ||
          "Some sites — banking, streaming and a few big names — will never allow themselves to be shown inside another page. That is their choice, not a fault in this browser."}
      </p>
      {detail ? <div className="egErrorDetail">{detail}</div> : null}
      <div className="egErrorActs">
        {onRetry ? (
          <button type="button" className="egBtn" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {canRead && onReader ? (
          <button type="button" className="egBtn" onClick={onReader}>
            Read it here (reader view)
          </button>
        ) : null}
        {onHome ? (
          <button type="button" className="egBtn ghost" onClick={onHome}>
            Go home
          </button>
        ) : null}
      </div>
      <div className="egErrorHelp">
        <b>Why am I seeing this?</b>
        <ul>
          <li>Check the address for typos, or go back to your home page.</li>
          <li>
            If the site embeds fine elsewhere, its security policy changed — reader view may still
            work.
          </li>
          <li>
            Some sites (banking, streaming) will never allow themselves to be shown inside another
            page. For those, open them in a real browser tab.
          </li>
        </ul>
        <code>{url}</code>
      </div>
    </div>
  );
};

export { EdgeGlyph, Fav, INTERNAL, DEFAULT_FAVORITES };
