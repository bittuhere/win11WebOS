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
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { Icon, Image, ToolBar, LazyComponent } from "../../../utils/general";
import "./assets/store.scss";

import { installApp, delApp } from "../../../actions";
import { notify, wosConfirm } from "../../../utils/os/ui";
import { idb, uid } from "../../../utils/idb";
import { WosSelect } from "../../../components/shared/Controls";
import * as ai from "./assets/store-ai";

const StarRow = ({ n = 4, size = 10 }) => (
  <span className="starRow">
    {[1, 2, 3, 4, 5].map((i) => (
      <Icon
        key={i}
        fafa="faStar"
        width={size}
        className={i <= Math.round(n) ? "text-orange-500" : "text-gray-500"}
      />
    ))}
  </span>
);

/* deterministic gradient for hero tiles and screenshot placeholders —
   the same app always wears the same colors, like the real Store's
   solid-color hero art */
function huePair(seed) {
  let h = 0;
  for (let i = 0; i < String(seed).length; i++) h = (h * 31 + String(seed).charCodeAt(i)) % 360;
  return [h, (h + 42) % 360];
}
const heroGrad = (seed) => {
  const [a, b] = huePair(seed);
  return { background: `linear-gradient(135deg, hsl(${a} 62% 34%), hsl(${b} 70% 16%))` };
};

/* Books live in their own Books & Reading section only — never in the
   Apps grid, search results or Home rows. Wikibooks/Wikisource (reference
   wikis) stay; Gutenberg/Open Library/Archive book shelves go. */
const isBookshelf = (a) =>
  a.category === "Books & Reading" && /gutenberg|openlibrary|^ia-/.test(a.id || "");

/* The faces of the Store. Every one of these really ships in the catalog and
   really opens; the carousel rotates through all of them. */
const HERO_IDS = [
  "jspaint",
  "photopea",
  "excalidraw",
  "minecraft",
  "wikipedia",
  "krunker",
  "arcade-hub",
  "geo-dash",
  "ztype",
  "windows96",
];
const HERO_MAX = HERO_IDS.length;

export const MicroStore = () => {
  const wnapp = useSelector((state) => state.apps.store);
  const appsState = useSelector((state) => state.apps);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [opapp, setOpapp] = useState(null);
  const [custom, setCustom] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [metrics, setMetrics] = useState({});
  const dispatch = useDispatch();

  /* the catalog (~190 curated canon apps) ships as a plain asset and is
     fetched only when the Store opens, so neither the bundle nor the rest
     of the OS ever pays for it */
  useEffect(() => {
    let alive = true;
    fetch("storeCatalog.json")
      .then((r) => r.json())
      .then((list) => {
        if (alive) setCatalog(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const allApps = useMemo(() => {
    const extra = custom.map((c) => ({ ...c, custom: true }));
    return [...catalog, ...extra];
  }, [catalog, custom]);

  useEffect(() => {
    idb.get("store.custom").then((list) => {
      if (Array.isArray(list)) setCustom(list);
    });
    ai.loadMetrics().then(setMetrics);
  }, [wnapp.hide]);

  const openApp = (a) => {
    ai.recordOpen(a)
      .then(() => ai.loadMetrics())
      .then((m) => setMetrics({ ...m }));
    setOpapp(a);
  };

  /* One uninstall path, used by the product page and by the Library: the
     window closes, the app leaves the session, the desktop and both stores of
     the install record (localStorage mirror + IndexedDB). */
  const uninstallApp = async (app) => {
    const inst = appsState[app.icon];
    if (inst?.action) dispatch({ type: inst.action, payload: "close" });
    dispatch({ type: "DELAPP", payload: app.icon });
    dispatch({ type: "DESKREM", payload: app.name });
    try {
      await idb.deleteFrom("installed", app.icon);
    } catch (e) {}
    let ls = [];
    try {
      ls = JSON.parse(localStorage.getItem("installed") || "[]") || [];
    } catch (e) {}
    ls = ls.filter((x) => x.icon !== app.icon);
    localStorage.setItem("installed", JSON.stringify(ls));
    let desk = [];
    try {
      desk = JSON.parse(localStorage.getItem("desktop") || "[]") || [];
    } catch (e) {}
    localStorage.setItem("desktop", JSON.stringify(desk.filter((n) => n !== app.name)));
    notify({
      app: "Microsoft Store",
      icon: "img/icon/store.png",
      title: "Uninstalled",
      body: `${app.name} was removed from this PC.`,
      kind: "info",
      life: 4,
    });
  };

  /* Everything the Library shows comes from two places, merged:
       · the catalog entry (publisher, category, rating, gallery) — the metadata
         the Store page already knows
       · the live app record (icon key, action, install date) — what actually
         exists in this session
     The old page read only the live records, which is why a fresh profile saw
     nothing but the apps that ship with the OS. */
  const installedList = useMemo(() => {
    const byIcon = new Map();
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("installed") || "[]") || [];
    } catch (e) {}
    /* The install record — written once, by installApp — is the source of
       truth for "what the user installed". Reading the live window state
       instead is what made the Library show only the handful of preinstalled
       apps that happen to render in an iframe window. */
    for (const rec of saved) {
      if (!rec || !rec.icon) continue;
      byIcon.set(rec.icon, { ...rec });
    }
    /* the live record adds the session action key and the freshest name */
    for (const [key, a] of Object.entries(appsState)) {
      if (key === "hz" || !a || !a.pwa) continue;
      if (!byIcon.has(a.icon)) continue;
      byIcon.set(a.icon, { ...byIcon.get(a.icon), ...a, key });
    }
    const cat = new Map(allApps.map((a) => [a.icon, a]));
    return [...byIcon.values()]
      .map((a) => {
        const meta = cat.get(a.icon) || {};
        return {
          ...meta,
          ...a,
          name: a.name || meta.name || "App",
          publisher: a.publisher || meta.publisher || "WebOS Store",
          category: a.category || meta.category || "",
          type: a.type || meta.type || "app",
          rating: meta.rating,
          gallery: meta.data?.gallery || [],
          installedAt: a.installedAt || 0,
        };
      })
      .sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0) || a.name.localeCompare(b.name));
  }, [appsState, allApps]);
  const installedKeys = useMemo(() => new Set(installedList.map((a) => a.icon)), [installedList]);

  /* What the OS brought along — including the Office apps. They are not
     Store installs and cannot be uninstalled, so the Library lists them
     separately instead of mixing them in with what the user chose. */
  const builtIn = useMemo(() => {
    const bought = new Set(installedList.map((a) => a.name));
    const names = [
      "File Explorer",
      "Edge",
      "Settings",
      "Store",
      "Notepad",
      "Paint",
      "Photos",
      "Terminal",
      "Whiteboard",
      "Solitaire Collection",
      "Calculator",
      "Clock",
      "Weather",
      "Word",
      "Excel",
      "PowerPoint",
      "OneNote",
    ];
    return names
      .filter((n) => !bought.has(n))
      .map((n) => {
        const hit = Object.values(appsState).find((a) => a && a.name === n);
        return hit || { name: n, icon: n.toLowerCase().replace(/[^a-z]/g, "") };
      });
  }, [appsState, installedList]);

  const go = (p) => {
    setPage(p);
    setOpapp(null);
    setQuery("");
  };

  return (
    <div
      className="wnstore floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{
        ...(wnapp.size == "cstm" ? wnapp.dim : null),
        zIndex: wnapp.z,
      }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Microsoft Store" />
      <div className="windowScreen flex">
        <LazyComponent show={!wnapp.hide}>
          {/* the Microsoft Store icon rail — Home, Apps, Gaming, Movies & TV,
              add-a-web-app, Library (0/1/2/3/4/5: the driver taps 0 and 4) */}
          <div className="storeNav h-full flex flex-col">
            <Icon
              fafa="faHome"
              onClick={() => go("home")}
              width={20}
              payload={page === "home" && !opapp}
            />
            <Icon
              fafa="faThLarge"
              onClick={() => go("apps")}
              width={18}
              payload={page === "apps" && !opapp}
            />
            <Icon
              fafa="faGamepad"
              onClick={() => go("games")}
              width={20}
              payload={page === "games" && !opapp}
            />
            <Icon
              fafa="faFilm"
              onClick={() => go("movies")}
              width={18}
              payload={page === "movies" && !opapp}
            />
            <Icon
              fafa="faPlus"
              onClick={() => go("add")}
              width={18}
              payload={page === "add" && !opapp}
            />
            <Icon
              fafa="faDownload"
              onClick={() => go("library")}
              width={20}
              payload={page === "library" && !opapp}
            />
          </div>
          <div className="restWindow msfull win11Scroll">
            {opapp ? (
              <DetailPage
                app={opapp}
                onBack={() => setOpapp(null)}
                installed={!!appsState[opapp.icon]}
                items={allApps}
                metrics={metrics}
                onOpen={openApp}
                onUninstall={uninstallApp}
              />
            ) : page === "library" ? (
              <LibraryPage
                apps={installedList}
                builtIn={builtIn}
                onOpen={(app) => dispatch({ type: app.action, payload: "full" })}
                onUninstall={(app) => uninstallApp(app)}
                onPin={(app) => dispatch({ type: "DESKADD", payload: app })}
                go={go}
              />
            ) : page === "add" ? (
              <AddAppPage
                onAdded={async (app) => {
                  const next = [...custom, app];
                  setCustom(next);
                  await idb.set("store.custom", next);
                  openApp(app);
                }}
              />
            ) : page === "home" ? (
              <HomePage
                items={allApps}
                metrics={metrics}
                onOpen={openApp}
                installedKeys={installedKeys}
                go={go}
                query={query}
                setQuery={setQuery}
              />
            ) : (
              <BrowsePage
                tab={page}
                query={query}
                setQuery={setQuery}
                items={allApps}
                metrics={metrics}
                onOpen={openApp}
              />
            )}
          </div>
        </LazyComponent>
      </div>
    </div>
  );
};

/* ================================================================
 *  Home — the real Store home: hero carousel, then AI-ranked rows
 * ================================================================ */

const HERO_MS = 6000;

const HomePage = ({ items, metrics, onOpen, installedKeys, go, query, setQuery }) => {
  const heroes = useMemo(
    () =>
      HERO_IDS.map((id) => items.find((a) => a.id === id))
        .filter(Boolean)
        .slice(0, HERO_MAX),
    [items],
  );
  const [hi, setHi] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (!heroes.length) return undefined;
    const t = setInterval(() => {
      if (!paused.current) setHi((x) => (x + 1) % heroes.length);
    }, HERO_MS);
    return () => clearInterval(t);
  }, [heroes.length]);

  const noBooks = useMemo(() => items.filter((a) => !isBookshelf(a)), [items]);
  const picks = useMemo(
    () => ai.pickedForYou(noBooks, metrics, installedKeys, 12),
    [noBooks, metrics, installedKeys],
  );
  const topApps = useMemo(
    () =>
      ai
        .ranked(
          noBooks.filter((a) => a.type === "app"),
          metrics,
        )
        .slice(0, 12),
    [noBooks, metrics],
  );
  const topGames = useMemo(
    () =>
      ai
        .ranked(
          items.filter((a) => a.type === "game"),
          metrics,
        )
        .slice(0, 12),
    [items, metrics],
  );
  const movies = useMemo(
    () => items.filter((a) => a.category === "Movies & TV").slice(0, 12),
    [items],
  );

  const q = query.trim().toLowerCase();
  const searchHits = useMemo(
    () =>
      q
        ? ai.suggest(
            query,
            items.filter((a) => !isBookshelf(a)),
            metrics,
            24,
          )
        : [],
    [q, items, metrics],
  );

  /* the search bar renders FIRST — before the catalog arrives, even on a
     skeleton screen, so Home never appears without it */
  const topBar = (
    <div className="storeTop">
      <div>
        <div className="storeEyebrow">Microsoft Store</div>
        <h2>Home</h2>
      </div>
      <StoreSearch
        query={query}
        setQuery={setQuery}
        items={items}
        metrics={metrics}
        onOpen={onOpen}
      />
    </div>
  );

  if (!items.length)
    return (
      <div className="pagecont w-full absolute top-0 box-border p-8 storeBrowse storeHome">
        {topBar}
        <div className="storeHero storeSkeletonHero" />
        <div className="storeGrid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="storeSkeletonCard" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="pagecont w-full absolute top-0 box-border p-8 storeBrowse storeHome">
      {topBar}

      {q ? (
        <>
          <div className="storeRowHead">
            <h3>
              Results for “{query}”<span className="storeAiTag">AI</span>
            </h3>
          </div>
          <div className="storeGrid">
            {searchHits.map((item) => (
              <button key={item.id || item.name} className="storeCard" onClick={() => onOpen(item)}>
                <Image
                  className="rounded"
                  w={64}
                  h={64}
                  src={item.icon}
                  ext
                  err="img/icon/store.png"
                />
                <div className="storeCardMeta">
                  <div className="name">{item.name}</div>
                  <div className="pub">{item.publisher || item.type}</div>
                  <div className="row">
                    <StarRow n={item.rating || 4} />
                    <span className="price">{item.price || "Free"}</span>
                  </div>
                </div>
              </button>
            ))}
            {searchHits.length === 0 && (
              <div className="storeEmpty">
                Nothing matches “{query}”. Try fewer letters — the search forgives typos.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {heroes.length > 0 && (
            <div
              className="storeHero storeHeroReal"
              onMouseEnter={() => (paused.current = true)}
              onMouseLeave={() => (paused.current = false)}
              style={heroGrad(heroes[hi]?.id || "store")}
            >
              {heroes.map((a, i) => (
                <div
                  key={a.id}
                  className={`storeHeroSlide ${i === hi ? "on" : ""}`}
                  aria-hidden={i !== hi}
                >
                  <div className="storeHeroArt">
                    <Image
                      className="rounded"
                      w={110}
                      h={110}
                      src={a.icon}
                      ext
                      err="img/icon/store.png"
                    />
                  </div>
                  <div className="storeHeroCopy">
                    <div className="storeEyebrow">Featured</div>
                    <h3>{a.name}</h3>
                    <p>{(a.data?.desc || "").split("\n")[0].slice(0, 140)}</p>
                    <div className="storeHeroMeta">
                      <StarRow n={a.rating || 4} />
                      <span>{a.category}</span>
                      <span>Free</span>
                    </div>
                    <button className="instbtn storeHeroGet" onClick={() => onOpen(a)}>
                      Get
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="storeHeroArr left"
                aria-label="Previous"
                onClick={() => setHi((x) => (x - 1 + heroes.length) % heroes.length)}
              >
                ‹
              </button>
              <button
                className="storeHeroArr right"
                aria-label="Next"
                onClick={() => setHi((x) => (x + 1) % heroes.length)}
              >
                ›
              </button>
              <div className="storeHeroDots">
                {heroes.map((a, i) => (
                  <button
                    key={a.id}
                    className={i === hi ? "on" : ""}
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setHi(i)}
                  />
                ))}
              </div>
            </div>
          )}

          {picks.length > 0 && <StoreRow title="Picked for you" items={picks} onOpen={onOpen} ai />}
          <StoreRow title="Top free apps" items={topApps} onOpen={onOpen} />
          <StoreRow title="Top free games" items={topGames} onOpen={onOpen} />
          {movies.length > 0 && (
            <StoreRow title="Classic cinema — public domain" items={movies} onOpen={onOpen} />
          )}
          <div className="storeQuick">
            {["Books & Reading", "Music & Audio", "Creativity", "Reference"].map((c) => (
              <button key={c} className="storeQuickTile" onClick={() => go("apps")}>
                <Image
                  className="rounded"
                  w={40}
                  h={40}
                  src={(items.find((a) => a.category === c) || {}).icon}
                  ext
                  err="img/icon/store.png"
                />
                <span>{c}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* a horizontally scrolling Store row with the chevron paging buttons */
const StoreRow = ({ title, items, onOpen, ai: isAi }) => {
  const ref = useRef(null);
  if (!items.length) return null;
  const page = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(320, el.clientWidth - 200), behavior: "smooth" });
  };
  return (
    <div className="storeRow">
      <div className="storeRowHead">
        <h3>
          {title}
          {isAi && <span className="storeAiTag">AI</span>}
        </h3>
        <div className="storeRowBtns">
          <button className="storeRowBtn" aria-label="Scroll left" onClick={() => page(-1)}>
            ‹
          </button>
          <button className="storeRowBtn" aria-label="Scroll right" onClick={() => page(1)}>
            ›
          </button>
        </div>
      </div>
      <div className="storeRowCards win11Scroll" ref={ref}>
        {items.map((a) => (
          <button
            key={a.id || a.name}
            className="storeCard storeCardTall"
            onClick={() => onOpen(a)}
          >
            <div className="storeCardArt" style={heroGrad(a.id || a.name)}>
              <Image className="rounded" w={56} h={56} src={a.icon} ext err="img/icon/store.png" />
            </div>
            <div className="storeCardMeta">
              <div className="name">{a.name}</div>
              <div className="pub">{a.publisher || a.type}</div>
              <div className="row">
                <StarRow n={a.rating || 4} />
                <span className="price">{a.price || "Free"}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

/* search with live suggestions — real matches AI-ranked, then AI picks */
const StoreSearch = ({ query, setQuery, items, metrics, onOpen, ghost }) => {
  const [focus, setFocus] = useState(false);
  const sug = useMemo(
    () => (query.trim() ? ai.suggest(query, items, metrics, 7) : []),
    [query, items, metrics],
  );
  return (
    <div className={`storeSearchWrap ${ghost ? "ghost" : ""}`}>
      <input
        className="storeSearch"
        placeholder="Search apps, games, movies and more"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
      />
      {(focus || query.trim()) && sug.length > 0 && (
        <div className="storeSuggest">
          {sug.map((a) => (
            <button
              key={a.id || a.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onOpen(a)}
            >
              <Image className="rounded" w={20} h={20} src={a.icon} ext err="img/icon/store.png" />
              <span className="storeSugName">{a.name}</span>
              <span className="storeSugCat">{a.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ================================================================
 *  Browse — Apps / Gaming / Movies & TV, with chips + AI-ordered grid
 * ================================================================ */

const BrowsePage = ({ tab, query, setQuery, items, metrics, onOpen }) => {
  const title = tab === "games" ? "Gaming" : tab === "apps" ? "Apps" : "Movies & TV";
  const cats = useMemo(
    () => ["All", ...[...new Set(items.map((i) => i.category).filter(Boolean))]],
    [items],
  );
  const [cat, setCat] = useState("All");
  const [limit, setLimit] = useState(240);
  useEffect(() => {
    setCat("All");
    setLimit(240);
  }, [tab]);
  useEffect(() => setLimit(240), [cat, query]);

  const base = useMemo(() => {
    if (tab === "games") return items.filter((a) => a.type === "game");
    if (tab === "movies")
      return items.filter((a) => a.category === "Movies & TV" || a.category === "Music & Audio");
    return items.filter(
      (a) => !isBookshelf(a) && (a.type !== "game" || a.category === "Community picks"),
    );
  }, [items, tab]);

  useEffect(() => {
    if (query.trim()) ai.recordSearch(query);
  }, [query]);

  const shown = useMemo(() => {
    const q = query.trim();
    let list = cat === "All" ? base : base.filter((i) => i.category === cat);
    if (q) {
      // the AI grades every entry (typos, intent, partial words) — plain
      // string includes would miss "excrl" -> Excalidraw
      list = list.filter((a) => ai.matchScore(a, q) > 0);
      return [...list].sort((a, b) => ai.matchScore(b, q) - ai.matchScore(a, q));
    }
    return ai.ranked(list, metrics);
  }, [base, cat, query, metrics]);
  const page0 = shown.slice(0, limit);
  // a query that looks like a web address offers a one-click jump to Edge
  const looksLikeSite = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(query.trim());
  const dispatch = useDispatch();

  if (!items.length) return <StoreSkeleton />;

  return (
    <div className="pagecont w-full absolute top-0 box-border p-8 storeBrowse">
      <div className="storeTop">
        <div>
          <div className="storeEyebrow">Microsoft Store</div>
          <h2>{title}</h2>
        </div>
        <StoreSearch
          query={query}
          setQuery={setQuery}
          items={items}
          metrics={metrics}
          onOpen={onOpen}
        />
      </div>

      {tab === "games" && !query.trim() && (
        <div className="storeGamingSub">
          <span className="storeAiTag">All</span>
          All {base.length} games in the catalog — no sections, no filters, just games.
        </div>
      )}
      {tab === "movies" ? (
        <>
          <MovieSection
            title="Movies & TV"
            items={shown.filter((a) => a.category === "Movies & TV")}
            onOpen={onOpen}
          />
          <MovieSection
            title="Music & Audio"
            items={shown.filter((a) => a.category === "Music & Audio")}
            onOpen={onOpen}
          />
          {shown.length === 0 && <div className="storeEmpty">Nothing matches that search.</div>}
        </>
      ) : (
        <>
          {tab !== "games" && (
            <div className="storeChips">
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`storeChip ${c === cat ? "on" : ""}`}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="storeGrid">
            {page0.map((item) => (
              <button key={item.id || item.name} className="storeCard" onClick={() => onOpen(item)}>
                <Image
                  className="rounded"
                  w={64}
                  h={64}
                  src={item.icon}
                  ext
                  err="img/icon/store.png"
                />
                <div className="storeCardMeta">
                  <div className="name">{item.name}</div>
                  <div className="pub">{item.publisher || item.type}</div>
                  <div className="row">
                    <StarRow n={item.rating || 4} />
                    <span className="price">{item.price || "Free"}</span>
                  </div>
                </div>
              </button>
            ))}
            {shown.length === 0 && <div className="storeEmpty">No apps match that search.</div>}
          </div>
          {shown.length > page0.length && (
            <div className="storeMoreWrap">
              <button className="storeMore" onClick={() => setLimit((l) => l + 240)}>
                Show more — {shown.length - page0.length} remaining
              </button>
            </div>
          )}
          {looksLikeSite && (
            <div className="storeMoreWrap">
              <button
                className="storeMore"
                onClick={() => {
                  dispatch({ type: "MSEDGE", payload: "full" });
                  setTimeout(
                    () =>
                      dispatch({
                        type: "EDGELINK",
                        payload: "https://" + query.trim().toLowerCase(),
                      }),
                    350,
                  );
                }}
              >
                Open {query.trim().toLowerCase()} in Edge
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MovieSection = ({ title, items, onOpen }) => {
  const ref = useRef(null);
  if (!items.length) return null;
  const page = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(320, el.clientWidth - 200), behavior: "smooth" });
  };
  return (
    <div className="storeRow">
      <div className="storeRowHead">
        <h3>{title}</h3>
        <div className="storeRowBtns">
          <button className="storeRowBtn" onClick={() => page(-1)}>
            ‹
          </button>
          <button className="storeRowBtn" onClick={() => page(1)}>
            ›
          </button>
        </div>
      </div>
      <div className="storeRowCards win11Scroll" ref={ref}>
        {items.map((a) => (
          <button
            key={a.id || a.name}
            className="storeCard storeCardTall"
            onClick={() => onOpen(a)}
          >
            <div className="storeCardArt" style={heroGrad(a.id || a.name)}>
              <Image className="rounded" w={56} h={56} src={a.icon} ext err="img/icon/store.png" />
            </div>
            <div className="storeCardMeta">
              <div className="name">{a.name}</div>
              <div className="pub">{a.publisher || a.type}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

/* shimmering placeholders while the catalog arrives — the real Store
   never shows a blank page */
const StoreSkeleton = () => (
  <div className="pagecont w-full absolute top-0 box-border p-8 storeBrowse">
    <div className="storeHero storeSkeletonHero" />
    <div className="storeGrid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="storeCard storeSkeletonCard" />
      ))}
    </div>
  </div>
);

/* ================================================================
 *  Detail — the Microsoft Store product page: identity rail on the
 *  left; Screenshots, Description, Ratings and reviews, Features on
 *  the right. No management buttons anywhere, like the real Store.
 * ================================================================ */

const DetailPage = ({ app, onBack, installed, items, metrics, onOpen, onUninstall }) => {
  const apps = useSelector((state) => state.apps);
  const [dstate, setDown] = useState(installed ? 3 : 0);
  const dispatch = useDispatch();

  useEffect(() => {
    if (apps[app.icon]) setDown(3);
  }, [apps, app.icon]);

  const galItems = app.data?.gallery || [];
  const rel = useMemo(() => ai.related(app, items, metrics, 6), [app, items, metrics]);

  /* a ratings histogram derived from the rating the catalog already
     shows — the same number, visualized. Deterministic per app. */
  const hist = useMemo(() => {
    const r = Math.max(1, Math.min(5, app.rating || 4));
    const shape = [
      Math.pow(r, 4),
      r * r * 2,
      r * 3,
      Math.max(1, 6 - r * 1.4),
      Math.max(0.5, 5 - r * 1.1),
    ];
    let h = 0;
    for (let i = 0; i < String(app.id || app.name).length; i++)
      h = (h * 31 + String(app.id || app.name).charCodeAt(i)) % 97;
    const jit = shape.map((v, i) => v * (0.92 + ((h + i * 13) % 17) / 100));
    const total = jit.reduce((a, b) => a + b, 0);
    return jit.map((v) => Math.round((v / total) * 100));
  }, [app]);

  const download = () => {
    setDown(1);
    const payload = {
      name: app.name,
      icon: app.icon,
      type: app.type || "app",
      data: app.data,
    };
    setTimeout(() => {
      installApp(payload);
      ai.recordInstall(app);
      setDown(3);
    }, 900);
  };

  const openApp = () => {
    const inst = apps[app.icon];
    if (inst?.action) dispatch({ type: inst.action, payload: "full" });
  };

  const uninstall = () => {
    if (!apps[app.icon]) return;
    onUninstall?.(app);
    setDown(0);
  };

  return (
    <div className="detailpage w-full absolute top-0 flex storeDetail">
      <div className="detailcont">
        <button className="storeBack" onClick={onBack}>
          ← Back
        </button>
        <Image className="rounded" ext w={96} h={96} src={app.icon} err="img/icon/store.png" />
        <div className="flex flex-col items-center text-center relative">
          <div className="text-2xl font-semibold mt-6">{app.name}</div>
          <div className="text-xs text-blue-500">{app.publisher || "Community"}</div>
          {dstate === 0 && (
            <div className="instbtn mt-12 mb-8 handcr" onClick={download}>
              Get
            </div>
          )}
          {dstate === 1 && <div className="downbar mt-12 mb-8"></div>}
          {dstate === 3 && (
            <div className="storeBtnRow">
              <div className="instbtn mt-8 mb-4 handcr" onClick={openApp}>
                Open
              </div>
              <button className="storeLink" onClick={uninstall}>
                Uninstall
              </button>
            </div>
          )}
          <div className="flex mt-4">
            <div>
              <div className="flex items-center text-sm font-semibold">
                {app.rating || 4}
                <Icon className="text-orange-600 ml-1" fafa="faStar" width={14} />
              </div>
              <span className="text-xss">Average</span>
            </div>
            <div className="w-px bg-gray-300 mx-4"></div>
            <div>
              <div className="text-sm font-semibold">
                {Math.round((app.ratingsCount || 1000) / 100) / 10}K
              </div>
              <div className="text-xss mt-px pt-1">Ratings</div>
            </div>
          </div>
          <div className="storeFactsMini">
            <div>{app.category || app.type}</div>
            <div>{app.price || "Free"}</div>
          </div>
        </div>
      </div>
      <div className="growcont flex flex-col">
        {galItems.length > 0 && (
          <div className="briefcont py-2 pb-3">
            <div className="storeSecTitle">Screenshots</div>
            <GalleryViewer items={galItems} />
          </div>
        )}
        <div className="briefcont py-2 pb-3">
          <div className="storeSecTitle">Description</div>
          <div className="text-xs mt-4">
            <pre>{app.data?.desc}</pre>
          </div>
        </div>
        <div className="briefcont py-2 pb-3">
          <div className="storeSecTitle">Ratings and reviews</div>
          <div className="storeRate">
            <div className="storeRateBig">
              <div className="storeRateNum">{app.rating || 4}</div>
              <div className="storeRateSub">
                {(app.ratingsCount || 1000).toLocaleString()} RATINGS
              </div>
            </div>
            <div className="storeHist">
              {[5, 4, 3, 2, 1].map((star, i) => (
                <div key={star} className="storeHistRow">
                  <span className="storeHistStar">{star}</span>
                  <Icon className="text-orange-600" fafa="faStar" width={10} />
                  <div className="storeHistTrack">
                    <div className="storeHistBar" style={{ width: `${hist[i]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="storeGalHint">
            Ratings come from the catalog. Reviews are not collected in this build.
          </p>
        </div>
        {app.data?.feat && (
          <div className="briefcont py-2 pb-3">
            <div className="storeSecTitle">Features</div>
            <div className="text-xs mt-4">
              <pre>{app.data.feat}</pre>
            </div>
          </div>
        )}
        <div className="briefcont py-2 pb-3">
          <div className="storeSecTitle">Product details</div>
          <div className="text-xs mt-4 storeFacts">
            <div>
              <b>Category</b> {app.category || app.type}
            </div>
            <div>
              <b>Price</b> {app.price || "Free"}
            </div>
            <div>
              <b>Website</b> {app.data?.url}
            </div>
          </div>
        </div>
        {rel.length > 0 && (
          <div className="briefcont py-2 pb-3">
            <div className="storeSecTitle">
              More like this
              <span className="storeAiTag">AI</span>
            </div>
            <div className="storeRelRow">
              {rel.map((a) => (
                <button key={a.id || a.name} className="storeRelCard" onClick={() => onOpen(a)}>
                  <Image
                    className="rounded"
                    w={40}
                    h={40}
                    src={a.icon}
                    ext
                    err="img/icon/store.png"
                  />
                  <div className="storeRelMeta">
                    <div className="name">{a.name}</div>
                    <div className="pub">{a.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const fmtWhen = (ts) => {
  if (!ts) return "Installed earlier";
  const d = new Date(ts);
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0)
    return `Installed today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "Installed yesterday";
  if (days < 30) return `Installed ${days} days ago`;
  return `Installed on ${d.toLocaleDateString()}`;
};

const LibraryPage = ({ apps, builtIn = [], onOpen, onUninstall, onPin, go }) => {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);

  const counts = useMemo(
    () => ({
      all: apps.length,
      app: apps.filter((a) => (a.type || "app") === "app").length,
      game: apps.filter((a) => a.type === "game").length,
      web: apps.filter((a) => a.type === "web").length,
    }),
    [apps],
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return apps
      .filter((a) => (tab === "all" ? true : (a.type || "app") === tab))
      .filter((a) =>
        !needle
          ? true
          : `${a.name} ${a.publisher || ""} ${a.category || ""}`.toLowerCase().includes(needle),
      );
  }, [apps, q, tab]);

  const totalSize = useMemo(() => apps.reduce((n, a) => n + (Number(a.size) || 0), 0), [apps]);

  const askRemove = async (app) => {
    const ok = await wosConfirm(
      `"${app.name}" will be removed from this PC. It can be installed again from the Store at any time.`,
      { title: "Uninstall", okText: "Uninstall", cancelText: "Cancel", danger: true },
    );
    if (!ok) return;
    setBusy(app.icon);
    onUninstall?.(app);
    setTimeout(() => setBusy(""), 400);
  };

  return (
    <div className="pagecont w-full absolute top-0 box-border p-8 libPage">
      <div className="storeEyebrow">Microsoft Store</div>
      <h2 className="storeH2">Library</h2>
      <p className="storeLead">
        {apps.length === 0
          ? "Apps you install land here. Nothing to uninstall yet."
          : `${counts.all} installed app${counts.all === 1 ? "" : "s"}${
              counts.game ? ` · ${counts.game} game${counts.game === 1 ? "" : "s"}` : ""
            }${totalSize ? ` · ${fmtSize(totalSize)} on this PC` : ""}. Stored in IndexedDB, so a refresh keeps them.`}
      </p>

      {apps.length > 0 && (
        <div className="libBar">
          <div className="libTabs">
            {[
              ["all", `All (${counts.all})`],
              ["app", `Apps (${counts.app})`],
              ["game", `Games (${counts.game})`],
              ["web", `Web (${counts.web})`],
            ]
              .filter(([k]) => k === "all" || counts[k] > 0)
              .map(([k, label]) => (
                <button
                  key={k}
                  className={`libTab ${tab === k ? "on" : ""}`}
                  onClick={() => setTab(k)}
                  type="button"
                >
                  {label}
                </button>
              ))}
          </div>
          <div className="libSearch">
            <Icon fafa="faSearch" width={13} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your apps"
              aria-label="Search your installed apps"
            />
            {q && (
              <button
                className="libSearchX"
                onClick={() => setQ("")}
                aria-label="Clear"
                type="button"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="libEmpty">
          <Icon fafa="faDownload" width={28} />
          <h3>Nothing installed yet</h3>
          <p>
            Browse the Store and press Get — the app appears here, on your desktop and in Start.
          </p>
          <button className="instbtn" onClick={() => go("home")} type="button">
            Open Home
          </button>
        </div>
      ) : (
        <div className="libList">
          {list.map((a) => (
            <div key={a.icon} className="libRow" data-busy={busy === a.icon}>
              <Image
                className="rounded libIcon"
                w={40}
                h={40}
                src={a.icon}
                ext
                err="img/icon/store.png"
              />
              <div className="libMeta">
                <div className="libName">
                  {a.name}
                  <span className={`libKind ${a.type || "app"}`}>
                    {(a.type || "app") === "game" ? "Game" : a.type === "web" ? "Web app" : "App"}
                  </span>
                </div>
                <div className="libSub">
                  {a.publisher || "WebOS Store"}
                  {a.category ? ` · ${a.category}` : ""}
                  {a.rating ? ` · ★ ${Number(a.rating).toFixed(1)}` : ""}
                </div>
                <div className="libSub dim">
                  {fmtWhen(a.installedAt)}
                  {a.size ? ` · ${fmtSize(a.size)}` : ""}
                </div>
              </div>
              <div className="libActs">
                <button className="instbtn" onClick={() => onOpen(a)} type="button">
                  Open
                </button>
                <button
                  className="libBtn"
                  title="Pin to the desktop"
                  onClick={() => onPin?.(a)}
                  type="button"
                >
                  Pin
                </button>
                <button
                  className="libBtn danger"
                  title="Uninstall"
                  onClick={() => askRemove(a)}
                  type="button"
                >
                  {busy === a.icon ? "Removing…" : "Uninstall"}
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="storeEmpty">Nothing matches “{q}”. Try another name.</div>
          )}
        </div>
      )}

      {builtIn.length > 0 && (
        <div className="libBuiltIn">
          <h3>Included with WebOS</h3>
          <p>Part of the operating system — always available and not removable.</p>
          <div className="libChips">
            {builtIn.map((a) => (
              <span key={a.icon} className="libChip">
                <img src={`img/icon/${a.icon}.png`} alt="" width={16} height={16} />
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================
 *  The screenshots/videos viewer under an app. Shots come from
 *  storeCatalog.json (data.gallery) — read-only, like the real Store.
 * ================================================================ */

const isVidUrl = (u) => /\.(mp4|webm|mov|m4v|ogv)([?#]|$)/i.test(u || "");

const fmtTime = (t) => {
  const x = Math.max(0, Math.floor(t || 0));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
};

const WosVideo = ({ src, onOpen }) => {
  const vidRef = useRef(null);
  const [playing, setPlay] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const trackRef = useRef(null);

  const seekTo = (clientX) => {
    const el = trackRef.current;
    const v = vidRef.current;
    if (!el || !v || !v.duration) return;
    const box = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    v.currentTime = p * v.duration;
  };

  return (
    <div className="wosVid">
      <video
        ref={vidRef}
        src={src}
        onTimeUpdate={(e) => setT(e.target.currentTime)}
        onLoadedMetadata={(e) => setDur(e.target.duration)}
        onEnded={() => setPlay(false)}
      />
      <div className="wosVidBar">
        <button
          className="wosVidBtn"
          onClick={() => {
            const v = vidRef.current;
            if (!v) return;
            if (v.paused) {
              v.play();
              setPlay(true);
            } else {
              v.pause();
              setPlay(false);
            }
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div
          className="wosVidTrack"
          ref={trackRef}
          onPointerDown={(e) => seekTo(e.clientX)}
          onPointerMove={(e) => e.buttons === 1 && seekTo(e.clientX)}
        >
          <div className="wosVidFill" style={{ width: dur ? `${(t / dur) * 100}%` : "0%" }} />
        </div>
        <span className="wosVidTime">
          {fmtTime(t)} / {fmtTime(dur)}
        </span>
        <button
          className="wosVidBtn"
          onClick={() => onOpen && onOpen(src)}
          title="Open in a video window"
        >
          ⤢
        </button>
      </div>
    </div>
  );
};

const GalleryViewer = ({ items }) => {
  const [i, setI] = useState(0);
  const [light, setLight] = useState(false);

  const prevLen = useRef(items.length);
  useEffect(() => {
    if (items.length > prevLen.current) {
      setI(items.length - 1); // a fresh shot takes the stage
    } else if (i >= items.length) {
      setI(0);
    }
    prevLen.current = items.length;
  }, [items.length, i]);

  useEffect(() => {
    if (!items.length) return undefined;
    const k = (e) => {
      /* the viewer only answers while the Store is the window in front */
      const st = window.__wosStore?.getState?.().apps;
      const win = st?.store;
      if (!win || win.hide !== false || win.z !== st.hz) return;
      if (e.key === "ArrowRight") setI((x) => (x + 1) % items.length);
      else if (e.key === "ArrowLeft") setI((x) => (x - 1 + items.length) % items.length);
      else if (e.key === "Escape") setLight(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [items.length]);

  if (!items.length) return null;
  const cur = items[Math.min(i, items.length - 1)];

  return (
    <div className="storeGal">
      <div className="storeGalStage">
        <button
          type="button"
          className="storeGalArrow left"
          aria-label="Previous screenshot"
          onClick={() => setI((x) => (x - 1 + items.length) % items.length)}
        >
          ‹
        </button>
        <button
          type="button"
          className="storeGalMain"
          onClick={() => setLight(true)}
          aria-label="Open screenshot large"
        >
          {cur.type === "video" || isVidUrl(cur.src) ? (
            <WosVideo src={cur.src} />
          ) : (
            <img
              key={i}
              src={cur.src}
              alt={cur.alt || "screenshot"}
              className="storeGalImg"
              draggable={false}
            />
          )}
        </button>
        <button
          type="button"
          className="storeGalArrow right"
          aria-label="Next screenshot"
          onClick={() => setI((x) => (x + 1) % items.length)}
        >
          ›
        </button>
        <span className="storeGalCount">
          {Math.min(i + 1, items.length)} / {items.length}
        </span>
      </div>
      {items.length > 1 && (
        <div className="storeGalThumbs">
          {items.map((s, idx) => (
            <button
              key={idx}
              className={`storeGalThumb ${idx === i ? "on" : ""}`}
              onClick={() => setI(idx)}
              aria-label={`Screenshot ${idx + 1}`}
            >
              {s.type === "video" || isVidUrl(s.src) ? (
                <span className="storeGalThumbVid">▶</span>
              ) : (
                <img src={s.src} alt="" draggable={false} />
              )}
            </button>
          ))}
        </div>
      )}
      {light &&
        createPortal(
          <div className="storeLight" onClick={() => setLight(false)}>
            <button className="storeLightX" aria-label="Close">
              ×
            </button>
            {cur.type === "video" || isVidUrl(cur.src) ? (
              <video src={cur.src} controls autoPlay />
            ) : (
              <img src={cur.src} alt={cur.alt || "screenshot"} />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

const AddAppPage = ({ onAdded }) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("");
  const [type, setType] = useState("app");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);

  /* the apps this browser already added — visible, so adding one is not a
     one-shot magic trick you cannot inspect afterwards */
  useEffect(() => {
    idb.get("store.custom").then((list) => setMine(Array.isArray(list) ? list : []));
  }, [ok]);

  const href = useMemo(() => {
    const v = url.trim();
    if (!v) return "";
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }, [url]);

  const iconPreview = useMemo(() => {
    const v = icon.trim();
    return (
      v || (href ? `https://www.google.com/s2/favicons?domain=${new URL(href).hostname}&sz=64` : "")
    );
  }, [icon, href]);

  const host = useMemo(() => {
    try {
      return href ? new URL(href).hostname : "";
    } catch (e) {
      return "";
    }
  }, [href]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!name.trim()) return setErr("Give the app a name.");
    if (!href) return setErr("A web address is required.");
    try {
      new URL(href);
    } catch (err2) {
      return setErr("That does not look like a web address. Try https://example.com");
    }
    setBusy(true);
    const app = {
      id: uid("app"),
      name: name.trim(),
      icon: icon.trim() || "img/icon/store.png",
      publisher: "You",
      type,
      category: "Custom",
      price: "Free",
      rating: 5,
      ratingsCount: 1,
      data: {
        type: "IFrame",
        url: href,
        desc: desc.trim() || `${name.trim()} — added to this PC from its web address.`,
        feat: "Custom iframe app",
        gallery: [],
      },
    };
    try {
      await onAdded(app);
      setName("");
      setUrl("");
      setIcon("");
      setDesc("");
      setOk(`${app.name} was added — it is on your desktop and in the Library.`);
    } catch (err2) {
      setErr("Could not save that app. Storage may be full.");
    } finally {
      setBusy(false);
    }
  };

  const removeMine = async (app) => {
    const next = mine.filter((m) => m.id !== app.id);
    setMine(next);
    await idb.set("store.custom", next);
    let ls = [];
    try {
      ls = JSON.parse(localStorage.getItem("installed") || "[]") || [];
    } catch (e) {}
    localStorage.setItem("installed", JSON.stringify(ls.filter((x) => x.name !== app.name)));
    setOk(`${app.name} was removed from your list.`);
  };

  return (
    <div className="pagecont w-full absolute top-0 box-border p-8">
      <div className="storeEyebrow">Microsoft Store</div>
      <h2 className="storeH2">Add your own app</h2>
      <p className="storeLead">
        Any page that allows embedding becomes an app on this PC: it gets a desktop icon, a Start
        entry and a card in your Library. It is saved in IndexedDB, so it survives a refresh.
        Developers can also add entries to <code>public/storeCatalog.json</code> — see
        ADDING_APPS.md.
      </p>

      <div className="addWrap">
        <form className="storeForm" onSubmit={submit}>
          <label>
            App name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My app" />
          </label>
          <label>
            Web address
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              spellCheck={false}
            />
            {host && (
              <span className="addHint">
                Opens <b>{host}</b> inside a WebOS window
              </span>
            )}
          </label>
          <label>
            Icon — any image (png, jpg, webp, SVG, GIF), a <code>data:</code> URL, or a file on this
            PC (<code>vs:Pictures/icon.png</code>). Leave it empty to use the site's own favicon.
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="https://example.com/logo.svg"
              spellCheck={false}
            />
          </label>
          <label>
            Type
            <WosSelect
              value={type}
              onChange={(v) => setType(v)}
              options={[
                { value: "app", label: "App" },
                { value: "game", label: "Game" },
              ]}
            />
          </label>
          <label>
            Description
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </label>
          {err && <div className="ms-error">{err}</div>}
          {ok && <div className="addOk">{ok}</div>}
          <button className="instbtn" type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add to Store"}
          </button>
        </form>

        <aside className="addPreview">
          <div className="addCard">
            <div className="addCardArt">
              {iconPreview ? (
                <img
                  src={iconPreview}
                  alt=""
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
              ) : (
                <Icon fafa="faPlus" width={26} />
              )}
            </div>
            <div className="addCardName">{name.trim() || "Your app"}</div>
            <div className="addCardSub">{host || "no address yet"}</div>
          </div>
          <div className="addNote">
            Live preview — this is exactly how the card will look in the Store and in your Library.
          </div>

          {mine.length > 0 && (
            <div className="addMine">
              <h3>Apps you added ({mine.length})</h3>
              {mine.map((m) => (
                <div key={m.id} className="addMineRow">
                  <img
                    src={m.icon}
                    alt=""
                    width={18}
                    height={18}
                    onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  />
                  <span>{m.name}</span>
                  <button type="button" className="libBtn danger" onClick={() => removeMine(m)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default MicroStore;
