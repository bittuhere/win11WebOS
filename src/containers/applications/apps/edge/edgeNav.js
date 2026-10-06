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
 * Microsoft Edge (WebOS) — the address bar brain.
 *
 * Everything the old browser could do is still here, and nothing was removed:
 *
 *   • google.com            -> https://www.google.com/webhp?igu=1
 *     Google's "igu=1" endpoint is the one that does NOT send
 *     X-Frame-Options: SAMEORIGIN, so real Google works inside an iframe
 *     and you can actually search and click through from this OS.
 *   • bing.com              -> https://www.bing.com/search?q=web
 *   • youtube.com / youtu.be-> a Bing Videos search (YouTube refuses framing)
 *   • Bing's /search?format=rss  (proxied by vite.config.js) for native
 *     results, and api.bing.com/osjson.aspx for address-bar suggestions.
 *   • Bing's `a1...` redirect links are decoded back to the real URL.
 *
 * On top of that it now knows about the WebOS Browser Helper extension, so a
 * site that refuses to be framed can be fetched and read instead of failing.
 */

/* the browser opens on Google — the user's pick: the real google
   homepage with ?igu=1, which frames cleanly (verified by probe) */
export const HOME = "https://www.google.com/webhp?igu=1";
export const GOOGLE = "https://www.google.com/webhp?igu=1";
export const YT_SAFE = "https://www.bing.com/videos/search?q=nature+wildlife+documentary";

/** Pages that live inside the browser itself. */
export const INTERNAL = {
  "edge://newtab": "New tab",
  "edge://home": "New tab",
  "about:home": "New tab",
  "about:blank": "New tab",
  "edge://history": "History",
  "edge://downloads": "Downloads",
  "edge://favorites": "Favorites",
  "edge://settings": "Settings",
  "edge://extensions": "Extensions",
  "edge://apps": "Apps",
  "edge://about": "About Microsoft Edge",
  "edge://surf": "Let's Surf",
};

export const isInternal = (u) =>
  !!u && (INTERNAL[String(u).toLowerCase()] != null || /^edge:\/\//i.test(u));

/**
 * Sites that render inside WebOS Edge — they do NOT send
 * X-Frame-Options: SAMEORIGIN (unlike google.com, youtube.com, reddit.com,
 * github.com, msn.com…, which refuse to be framed without a helper
 * extension). Suggesters, quick links and favourites-bar seeds only ever
 * propose sites from this list, so every suggestion actually loads.
 */
export const FRAMEABLE = [
  { name: "Bing", url: "https://www.bing.com" },
  { name: "Wikipedia", url: "https://www.wikipedia.org" },
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org" },
  { name: "Internet Archive", url: "https://archive.org" },
  { name: "Project Gutenberg", url: "https://www.gutenberg.org" },
  { name: "Wiktionary", url: "https://www.wiktionary.org" },
];

const FRAMEABLE_HOSTS = FRAMEABLE.map((f) => {
  try {
    return new URL(f.url).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}).filter(Boolean);

/** May this URL render inside the frame? (internal pages always can;
    history items are trusted — they demonstrably loaded once.) */
export function isFrameable(url, { trustHistory = false } = {}) {
  if (!url) return false;
  if (isInternal(url)) return true;
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (FRAMEABLE_HOSTS.some((f) => h === f || h.endsWith("." + f))) return true;
    return trustHistory;
  } catch (e) {
    return false;
  }
}

/** Sites that Microsoft Edge ships pinned to the favourites bar — only
    frameable ones, so a fresh profile never suggests a refusing site. */
export const DEFAULT_FAVORITES = [
  { name: "Bing", url: "https://www.bing.com" },
  { name: "Wikipedia", url: "https://www.wikipedia.org" },
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org" },
  { name: "Internet Archive", url: "https://archive.org" },
];

/* ------------------------------------------------------------------ *
 *  URL classification
 * ------------------------------------------------------------------ */

const URL_RE =
  /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g;

export const isValidURL = (string) => String(string || "").match(URL_RE) !== null;

/** Is this something a person would type as an address rather than a query? */
export function looksLikeUrl(q) {
  const s = String(q || "").trim();
  if (!s) return false;
  if (/\s/.test(s)) return false;
  if (/^(edge|about|file|data|blob|chrome|firefox|safari):/i.test(s)) return true;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(s)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(s)) return true;
  // "example.com", "example.com/path", "sub.example.co.uk"
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(s);
}

export function decodeBingHref(url) {
  try {
    const u = new URL(url);
    const enc = u.searchParams.get("u");
    if (enc && /^a1/i.test(enc)) {
      const b64 = enc.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64 + "===".slice((b64.length + 3) % 4);
      return decodeURIComponent(escape(atob(pad)));
    }
  } catch (e) {}
  return url;
}

/**
 * The mapping table. Returns the URL Edge should actually load, or the input
 * unchanged when there is nothing special about it.
 */
export function normalizeBrowseUrl(raw, opts = {}) {
  if (!raw) return HOME;
  let qry = String(raw).trim();
  if (!qry) return HOME;
  const extLive = !!opts.ext; // helper live → no forced rewrites

  const low = qry.toLowerCase();
  if (INTERNAL[low]) return low;
  if (/^search:/i.test(qry)) return qry;

  qry = decodeBingHref(qry);

  const bare = qry
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");

  /* --- Google: without the helper, igu=1 is the frameable front door.
         With the helper live we open the real google.com — its X-Frame
         headers are lifted, so the true site loads and stays interactive. */
  if (
    !extLive &&
    (/^(https?:\/\/)?(www\.)?google\.([a-z.]{2,10})(\/|$|\?)/i.test(qry) || /^google\./i.test(bare))
  ) {
    // a deep google link (maps, images, a search result) keeps its path
    try {
      const u = new URL(/^https?:/i.test(qry) ? qry : "https://" + qry);
      if (u.hostname.replace(/^www\./, "") === "google.com") {
        if (u.pathname === "/" || u.pathname === "/webhp" || u.pathname === "") {
          return GOOGLE;
        }
        u.searchParams.set("igu", "1");
        return u.toString();
      }
    } catch (e) {}
    return GOOGLE;
  }

  if (/^(https?:\/\/)?(www\.)?bing\.com\/?$/i.test(qry) || bare === "bing.com") {
    return "https://www.bing.com/search?q=web";
  }

  /* --- YouTube refuses to be framed, send them to Bing Videos (only
         when the helper is NOT live — with it, the watch page loads). --- */
  if (!extLive && /(youtube\.com|youtu\.be)/i.test(qry)) {
    try {
      const u = new URL(/^https?:/i.test(qry) ? qry : "https://" + qry);
      const v = u.searchParams.get("v");
      if (v) {
        return `https://www.bing.com/videos/search?q=${encodeURIComponent(v)}`;
      }
    } catch (e) {}
    return YT_SAFE;
  }

  /* --- sites that are known to send X-Frame-Options: DENY ------------- */
  const BLOCKED = [
    /^(www\.)?(facebook|instagram|twitter|x|linkedin|netflix|amazon|flipkart)\.com$/i,
  ];
  if (BLOCKED.some((re) => re.test(bare))) return qry; // keep it, the reader handles it

  return qry;
}

/**
 * Everything the omnibox needs to know about what the user typed.
 *   kind: home | search | web | internal
 */
export function classifyInput(input, opts = {}) {
  let qry = String(input || "").trim();
  if (!qry) return { kind: "home", url: HOME, title: "New tab" };

  const engine = opts.engine || ENGINES.google;
  const asSearch = (q) => {
    // old-style: a search IS a web page on the engine — no custom results
    // layer, the address bar shows the real (encoded) engine URL
    const url = engine.build(q);
    return { kind: "web", url, title: engine.name + " search", searchQuery: q };
  };

  const low = qry.toLowerCase();
  if (INTERNAL[low]) return { kind: "internal", url: low, title: INTERNAL[low] };

  if (/^search:/i.test(qry)) return asSearch(qry.replace(/^search:/i, "").trim());

  const mapped = normalizeBrowseUrl(qry, opts);
  if (mapped !== qry) {
    if (/^search:/i.test(mapped)) return asSearch(mapped.replace(/^search:/i, "").trim());
    if (INTERNAL[String(mapped).toLowerCase()]) {
      return {
        kind: "internal",
        url: String(mapped).toLowerCase(),
        title: INTERNAL[String(mapped).toLowerCase()],
      };
    }
    return { kind: "web", url: mapped, title: hostOf(mapped) };
  }

  if (looksLikeUrl(qry) || isValidURL(qry)) {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(qry)) qry = "https://" + qry;
    const final = normalizeBrowseUrl(qry, opts);
    return { kind: "web", url: final, title: hostOf(final) };
  }

  return asSearch(qry);
}

export function hostOf(u) {
  try {
    if (!u) return "";
    if (isInternal(u)) return INTERNAL[u.toLowerCase()] || "Edge";
    if (/^search:/i.test(u)) return "Bing";
    if (u === HOME) return "New tab";
    /* pages this PC built itself — a blob:/data: URL has no host to show */
    if (/^(blob|data|file|webos|filesystem):/i.test(u)) return "Local page";
    return new URL(u).host;
  } catch {
    return "";
  }
}

export function originOf(u) {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
}

/** What the address bar shows for a URL — Edge trims the scheme on https. */
export function displayUrl(u) {
  if (!u || u === HOME) return "";
  if (isInternal(u)) return u;
  if (/^search:/i.test(u)) return u.replace(/^search:/i, "");
  try {
    const url = new URL(u);
    if (url.protocol === "https:") return url.host + url.pathname.replace(/\/$/, "") + url.search;
    return url.toString();
  } catch {
    return u;
  }
}

export function isSecure(u) {
  if (!u) return false;
  if (isInternal(u)) return true;
  try {
    const p = new URL(u).protocol;
    return p === "https:" || p === "edge:" || p === "about:";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 *  Search plumbing (the Bing RSS + suggestion proxies)
 * ------------------------------------------------------------------ */

export function bingSearchUrl(q) {
  return "https://www.bing.com/search?q=" + encodeURIComponent(String(q || "").trim());
}

export function googleSearchUrl(q) {
  return "https://www.google.com/search?igu=1&q=" + encodeURIComponent(String(q || "").trim());
}

export function ddgSearchUrl(q) {
  return "https://duckduckgo.com/?q=" + encodeURIComponent(String(q || "").trim());
}

export const ENGINES = {
  google: { name: "Google", build: googleSearchUrl },
  bing: { name: "Bing", build: bingSearchUrl },
  duckduckgo: { name: "DuckDuckGo", build: ddgSearchUrl },
  /* the user's pick: Bing Copilot Search — an AI answer page that frames
     fine, opened LIVE (no custom results page on top of it) */
  copilot: {
    name: "Bing Copilot",
    build: (q) => "https://www.bing.com/copilotsearch?q=" + encodeURIComponent(q),
    live: true,
  },
};

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function favicon(url, size = 64) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`;
  } catch {
    return "";
  }
}

/**
 * Address-bar suggestions. The old build hit /api/bing-suggest here, which
 * 404-spams the console on every static host (and every keystroke). Edge
 * feels local-first anyway: the omnibox mixes your own history and
 * favourites (in the browser component), and this tops it up with search
 * completions for common prefixes WITHOUT touching the network.
 */
const SUGGEST_SEEDS = [
  "how to",
  "what is",
  "near me",
  "weather",
  "news",
  "youtube",
  "gmail",
  "google docs",
  "google maps",
  "translate",
  "calculator",
  "wikipedia",
];
export async function bingSuggest(query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return [];
  return SUGGEST_SEEDS.filter((s) => s.startsWith(q) && s !== q)
    .concat(q.length >= 3 ? SUGGEST_SEEDS.filter((s) => s.includes(q) && !s.startsWith(q)) : [])
    .slice(0, 6);
}

/* ------------------------------------------------------------------ *
 *  Reading a page that refuses to be framed
 * ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  "A",
  "P",
  "DIV",
  "SPAN",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "CODE",
  "STRONG",
  "EM",
  "B",
  "I",
  "U",
  "S",
  "BR",
  "HR",
  "IMG",
  "FIGURE",
  "FIGCAPTION",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TD",
  "TH",
  "ARTICLE",
  "SECTION",
  "HEADER",
  "FOOTER",
  "MAIN",
  "ASIDE",
  "NAV",
  "SMALL",
  "SUB",
  "SUP",
  "MARK",
  "TIME",
  "DETAILS",
  "SUMMARY",
  "PICTURE",
  "SOURCE",
]);

const KEEP_ATTRS = { A: ["href", "title"], IMG: ["src", "alt", "title", "width", "height"] };

/**
 * Boil a fetched page down to readable HTML with every script, style,
 * iframe and event handler removed. Relative links are made absolute so the
 * reader stays navigable, and each link carries data-wos so Edge can take the
 * click instead of the iframe.
 */

/* --- YouTube: the watch page blocks framing (SAMEORIGIN), but Google
   explicitly allows the embed player. Swap it in so videos actually play
   inside the OS instead of dying in a "refused to connect" frame. ------- */
export function ytEmbed(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    const id =
      (h === "youtu.be" && u.pathname.slice(1)) ||
      (/(^|\.)youtube(-nocookie)?\.com$/.test(h) &&
        u.pathname === "/watch" &&
        u.searchParams.get("v")) ||
      (/(^|\.)youtube(-nocookie)?\.com$/.test(h) &&
        /^\/embed\/([\w-]{6,})/.test(u.pathname) &&
        null);
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (t) params.set("start", String(parseInt(t, 10) || 0));
    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  } catch (e) {
    return null;
  }
}

/**
 * Rewrite EVERY url in a fetched document so it points at the real site:
 * links, images, srcset, media, iframes, forms, <style> url(...), inline
 * style urls, and <link rel=stylesheet>. That is what lets a page fetched
 * through the helper render with its real CSS and pictures instead of a
 * naked unstyled skeleton — the browser simply loads the sub-resources
 * straight from the origin (they are not CORS-locked like the document).
 */
export function absolutizeHtml(html, baseUrl) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  } catch (e) {
    return "";
  }
  const abs = (v) => {
    try {
      return new URL(v, baseUrl).toString();
    } catch {
      return v;
    }
  };
  // strip anything that would fight the snapshot
  doc
    .querySelectorAll("base, script, noscript, meta[http-equiv='Content-Security-Policy' i]")
    .forEach((n) => n.remove());

  const URL_ATTRS = ["href", "src", "poster", "action", "formaction", "data", "longdesc"];
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of URL_ATTRS) {
      const v = el.getAttribute(a);
      if (v && !/^data:|^blob:|^about:|^#/i.test(v.trim())) el.setAttribute(a, abs(v.trim()));
    }
    const ss = el.getAttribute("srcset");
    if (ss) {
      el.setAttribute(
        "srcset",
        ss
          .split(",")
          .map((part) => {
            const bits = part.trim().split(/\s+/);
            if (bits[0]) bits[0] = abs(bits[0]);
            return bits.join(" ");
          })
          .join(", "),
      );
    }
    // integrity pins the bytes of the ORIGINAL origin response; sub-resources
    // fetched cross-origin still match, but proxied rewrites would not — drop it
    el.removeAttribute("integrity");
    el.removeAttribute("nonce");
    const st = el.getAttribute("style");
    if (st && st.includes("url("))
      el.setAttribute(
        "style",
        st.replace(
          /url\((['"]?)([^'")]+)\1\)/gi,
          (m, q, u) => `url(${q}${/^data:/i.test(u) ? u : abs(u)}${q})`,
        ),
      );
  });
  doc.querySelectorAll("style").forEach((el) => {
    if (el.textContent && el.textContent.includes("url(")) {
      el.textContent = el.textContent.replace(
        /url\((['"]?)([^'")]+)\1\)/gi,
        (m, q, u) => `url(${q}${/^data:/i.test(u) ? u : abs(u)}${q})`,
      );
    }
  });
  // real base so anything we missed still resolves to the site
  const baseEl = doc.createElement("base");
  baseEl.setAttribute("href", baseUrl);
  doc.head ? doc.head.prepend(baseEl) : doc.documentElement.prepend(baseEl);
  return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
}

export function toReadableHtml(html, baseUrl) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  } catch (e) {
    return "";
  }

  doc
    .querySelectorAll("script,style,noscript,iframe,object,embed,svg,form,link,meta")
    .forEach((n) => n.remove());

  const title = doc.querySelector("title")?.textContent?.trim() || "";
  const main =
    doc.querySelector("article") ||
    doc.querySelector("main") ||
    doc.querySelector("[role=main]") ||
    doc.body;
  if (!main) return title ? `<h1>${title}</h1>` : "";

  const out = document.createElement("div");
  if (title) {
    const h = document.createElement("h1");
    h.textContent = title;
    out.appendChild(h);
  }

  const walk = (src, dst) => {
    [...src.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        const t = node.textContent.replace(/\s+/g, " ");
        if (t.trim()) dst.appendChild(document.createTextNode(t));
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName;
      if (!ALLOWED_TAGS.has(tag)) {
        walk(node, dst);
        return;
      }
      const el = document.createElement(tag);
      (KEEP_ATTRS[tag] || []).forEach((a) => {
        const v = node.getAttribute(a);
        if (v == null) return;
        if (a === "href" || a === "src") {
          try {
            el.setAttribute(a, new URL(v, baseUrl).toString());
          } catch {
            return;
          }
          if (a === "href") el.setAttribute("data-wos-link", el.getAttribute("href"));
        } else {
          el.setAttribute(a, v);
        }
      });
      if (tag === "A") el.setAttribute("target", "_self");
      walk(node, el);
      if (el.childNodes.length || tag === "IMG" || tag === "BR" || tag === "HR")
        dst.appendChild(el);
    });
  };

  walk(main, out);
  return out.innerHTML;
}

/** A human sentence for why a page could not be shown. */
export function frameErrorText({ status, xfo, csp, error }) {
  if (status === 404) return "That page could not be found on this website.";
  if (status === 403) return "This website refused the request (403 Forbidden).";
  if (status >= 500) return `The website is having trouble right now (${status}).`;
  if (/deny/i.test(xfo || ""))
    return "This site sends X-Frame-Options: DENY, so no browser is allowed to show it inside another page.";
  if (/sameorigin/i.test(xfo || ""))
    return "This site only allows itself to frame its own pages (X-Frame-Options: SAMEORIGIN).";
  if (/frame-ancestors/i.test(csp || ""))
    return "The site's Content-Security-Policy names who may frame it, and this OS is not on the list.";
  if (error) return String(error);
  return "The website did not respond.";
}
