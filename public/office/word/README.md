# Word Clone — Web Edition 📄

A pixel-faithful Microsoft Word (2016 "Colorful" theme) that runs entirely in your
browser. Zero dependencies, zero build step — open `index.html` and write.

![status](https://img.shields.io/badge/status-stable-2B579A)
![storage](https://img.shields.io/badge/storage-IndexedDB-2B579A)

## What it is

A full document editor with real print-layout pagination: pages reflow, margins move
on the ruler, headers & footers are editable, footnotes anchor to their page, and the
document round-trips to real **.docx** files (JSZip-based OOXML writer in `docx.js`).

## Feature atlas

| Area | Highlights |
| --- | --- |
| Editing | Rich text, styles gallery (Title → Heading 3, Quote, No Spacing), inline images with drag handles, tables, page breaks, find & replace |
| Ribbon | 9 tabs: Home · Insert · Draw · Design · Layout · References · Review · View · Help |
| Layout | Rulers with draggable margins/indents, portrait & landscape, page borders, watermarks |
| References | Footnotes (auto-renumbered), captions, bookmarks, table of contents |
| Review | Comments, navigation pane, document stats (words/pages) |
| Files | New / **Open .docx, .doc, .rtf, .html, .txt** / Save As / **.docx export** / .html / .txt, print-ready layout |
| Import | Real OOXML reader in `docx-import.js` (own ZIP inflater via `DecompressionStream`): text+styles, real lists (incl. style-carried `numPr` like *List Bullet*), tables w/ widths/shading/borders/merges, images, hyperlinks, footnotes, headers/footers + `PAGE` field, page size/margins/orientation, page color, page borders, text watermarks, `<ol start>` restarts. Legacy binary **.doc** recovered via CFB container + FIB piece table (text-level). |
| Drag & drop | Drop `.docx/.doc/.rtf` anywhere to open (unsaved-changes confirm), drop images to insert at the drop point, drop `.txt/.md/.html` to insert |
| Export fidelity | `.docx` carries the app's own geometry (size/margins/orientation), headers/footers (live `PAGE` fields), watermark (VML textpath, Word's own trick), page border, page color, footnotes at page bottom, hyperlinks, **real Word numbering** (no fake bullet characters), measured table widths/shading/borders + `gridSpan`/`vMerge`, schema-ordered XML (`pPr`/`rPr` element order, `w:u w:val`) — validates clean in LibreOffice, python-docx and Word-compatible parsers |
| Printing | Dynamic `@page` injection matches the document exactly (A4/Letter/…, portrait/landscape, zero margins) + `break-after` fixed so **1 on-screen page prints as exactly 1 sheet** — verified with headless `pdfinfo` page counts at 1, 2 and A4-landscape |
| Chrome | Quick Access Toolbar, AutoSave pill, Tell-Me search, zoom slider, status bar |

## Storage — IndexedDB, no localStorage

All persistence lives in the `word-web-edition` IndexedDB database (store `kv`,
hydrated by `idb.js` into the synchronous `window.XKV` facade):

| Key | Contents |
| --- | --- |
| `wc.docs` | Document registry `{ id: { name, savedAt, html, … } }` |
| `wc.session` | Crash-resilient live session |
| `wc.opts` | Options dialog state |
| `wc.hist` | Per-document revision history |
| `wc.feedback` | Feedback submissions |

## Architecture

| File | Role |
| --- | --- |
| `index.html` | Chrome skeleton (title bar, tab row, rulers, workspace) |
| `boot.js` | Launches after `XKV.ready`; owns the ☾ theme toggle |
| `idb.js` | IndexedDB write-behind key/value cache |
| `app.js` | Model, pagination engine, render, ribbon wiring, commands (≈5.6k lines) |
| `app2.js` | Dialogs, backstage, save/open library, print, export |
| `rib.js` | Ribbon definition (9 tabs) |
| `docx.js` | OOXML/.docx exporter (spec-correct ZIP: central-directory offsets, CRC32; schema-ordered XML; tables incl. `w:tblGrid`, merges, measured widths) |
| `docx-import.js` | OOXML/.docx importer + legacy .doc (CFB + piece table) + .rtf text recovery |
| `templates.js` | New-document templates |
| `icons.js` | Inline SVG icon system (theme-aware via `currentColor`) |
| `word.css` | Chrome + canvas styles incl. the `body.dark` pass |
## Honest gaps

- Undo/redo relies on the browser's `execCommand` stack (fine for typing; bulk
  structural ops raise one undo step).
- `.doc` (legacy binary) import recovers the full document text via the FIB piece
  table but flattens rich formatting — an intentional, clearly-flagged limit
  (re-export as `.docx` to regain styles). `.docx` import is the full-fidelity path.
- Ink/drawn annotations render on the in-app canvas only; they stay out of exports.
- Collaborative editing is out of scope (single-user by design).
---
<div align="center">
<i>Word Web Edition · Version 16.0 (Clone) · hand-rolled in vanilla JS.</i><br>
License: Apache License 2.0
</div>
