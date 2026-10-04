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
 * A small markdown renderer, for release notes.
 *
 * Deliberately not a library: the PC ships no third-party markdown parser, and
 * release notes use a handful of constructs. Supports headings, bold/italic,
 * inline code, fenced code, links, images (with an optional caption), bullet and
 * numbered lists, blockquotes, tables, horizontal rules and paragraphs.
 *
 * Safety: every piece of text is HTML-escaped before any tag is emitted, and
 * links are restricted to http(s)/mailto plus project-relative paths — so notes
 * fetched from a feed cannot inject markup into the desktop.
 */

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Only addresses we are willing to put in an href. */
export const safeUrl = (url) => {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[./]/.test(u) || /^[\w-]+\//.test(u)) return u; // project-relative: updates/media/x.png
  if (/^data:image\//i.test(u)) return u;
  return "";
};

const inline = (text, base = "") =>
  esc(text)
    /* images first, so the ![..](..) does not get eaten by the link rule */
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, alt, src, title) => {
      const href = safeUrl(resolve(src, base));
      if (!href) return esc(alt || "");
      return `<img src="${esc(href)}" alt="${esc(alt)}"${title ? ` title="${esc(title)}"` : ""} loading="lazy" />`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, label, href, title) => {
      const url = safeUrl(resolve(href, base));
      if (!url) return esc(label);
      const ext = /^https?:/i.test(url);
      return `<a href="${esc(url)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}${title ? ` title="${esc(title)}"` : ""}>${esc(label)}</a>`;
    })
    .replace(/`([^`]+)`/g, (m, code) => `<code>${esc(code)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

const list = (items, ordered, depth = 0, base = "") => {
  const tag = ordered ? "ol" : "ul";
  const body = items.map((t) => `<li>${inline(t, base)}</li>`).join("");
  return `<${tag}${depth ? ' class="mdSub"' : ""}>${body}</${tag}>`;
};

/** A relative path in a note is relative to the NOTE, not to the page. */
const resolve = (href, base) => {
  const u = String(href || "").trim();
  if (!u || !base) return u;
  if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(u)) return u; // absolute, protocol-relative or anchor
  return base.replace(/[^/]*$/, "") + u;
};

/**
 * markdown → HTML string
 * `base` is the path the markdown itself lives at, so `media/shot.png` inside
 * `updates/notes/1.01.md` resolves to `updates/notes/media/shot.png`.
 */
export const mdToHtml = (src, base = "") => {
  const lines = String(src || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const out = [];
  let i = 0;

  const flushList = (ordered) => {
    const items = [];
    while (i < lines.length) {
      const m = ordered ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[i]) : /^\s*[-*+]\s+(.*)$/.exec(lines[i]);
      if (!m) break;
      items.push(m[1]);
      i += 1;
    }
    if (items.length) out.push(list(items, ordered, 0, base));
    return items.length > 0;
  };

  while (i < lines.length) {
    const line = lines[i];

    /* fenced code */
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, "").trim();
      i += 1;
      const buf = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(
        `<pre class="mdPre"${lang ? ` data-lang="${esc(lang)}"` : ""}><code>${esc(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }

    /* headings */
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = Math.min(6, h[1].length);
      out.push(`<h${lvl} class="mdH${lvl}">${inline(h[2], base)}</h${lvl}>`);
      i += 1;
      continue;
    }

    /* horizontal rule */
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push('<hr class="mdHr" />');
      i += 1;
      continue;
    }

    /* table */
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      const cells = (l) =>
        l
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      out.push(
        `<table class="mdTable"><thead><tr>${head
          .map((c) => `<th>${inline(c, base)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c, base)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }

    /* blockquote */
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote class="mdQuote">${mdToHtml(buf.join("\n"), base)}</blockquote>`);
      continue;
    }

    /* lists */
    if (/^\s*[-*+]\s+/.test(line)) {
      flushList(false);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushList(true);
      continue;
    }

    /* blank */
    if (!line.trim()) {
      i += 1;
      continue;
    }

    /* paragraph (swallows the run of plain lines) */
    const buf = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,6})\s|^\s*```|^\s*[-*+]\s|^\s*\d+[.)]\s|^\s*>|^\s*\|/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push(`<p class="mdP">${inline(buf.join(" "), base)}</p>`);
  }

  return out.join("\n");
};

export default mdToHtml;
