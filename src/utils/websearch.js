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

export function favicon(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}

export function bingSearchUrl(q) {
  return "https://www.bing.com/search?q=" + encodeURIComponent(String(q || "").trim());
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

function parseRss(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = [...doc.querySelectorAll("item")];
  return items
    .map((item) => {
      const title = stripTags(item.querySelector("title")?.textContent || "");
      const url = item.querySelector("link")?.textContent || "";
      const snippet = stripTags(item.querySelector("description")?.textContent || "");
      let host = "";
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch (e) {}
      return {
        title,
        url,
        snippet,
        source: host || "Bing",
        kind: "web",
        favicon: favicon(url),
      };
    })
    .filter((r) => r.title && r.url);
}

export async function bingSuggest(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  // Google first (client=firefox speaks plain JSON), Bing proxy as backup
  try {
    const res = await fetch("/api/gsuggest?q=" + encodeURIComponent(q));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[1])) return data[1];
    }
  } catch (e) {
    /* fall through */
  }
  try {
    const res = await fetch("/api/bing-suggest?q=" + encodeURIComponent(q));
    const data = await res.json();
    return Array.isArray(data?.[1]) ? data[1] : [];
  } catch (e) {
    return [];
  }
}

export async function webosSearch(query) {
  const q = String(query || "").trim();
  const bingUrl = bingSearchUrl(q);
  if (!q) return { query: q, featured: null, results: [], bingUrl, iframeOnly: true };

  try {
    const res = await fetch("/api/bing-search?q=" + encodeURIComponent(q));
    if (!res.ok) throw new Error("bing");
    const xml = await res.text();
    if (!xml.includes("<item>")) throw new Error("empty");
    const results = parseRss(xml);
    return {
      query: q,
      featured: results[0] || null,
      results: results.slice(1),
      bingUrl,
      iframeOnly: results.length === 0,
    };
  } catch (e) {
    return { query: q, featured: null, results: [], bingUrl, iframeOnly: true };
  }
}
