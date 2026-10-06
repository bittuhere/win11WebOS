> **Win11 WebOS v1.02 integration:** This bundled component is copied into the full production build and included in the offline inventory. Build the OS with `npm ci` and `npm run build` at repository root; deploy `build/`. Prefer the OS production preview over opening `file://` URLs, which have different storage/security behavior. Component theme/version labels and feature notes below are not the OS release number or a current full-suite certification. No Microsoft affiliation is implied. See the repository `docs/DEPLOYMENT.md` and `docs/TESTING.md` for the current deployment contract.

<div align="center">

<img alt="Excel Clone" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect x='2' y='2' width='60' height='60' rx='10' fill='%23217346'/%3E%3Cpath d='M20 18h6l6.5 14L39 18h6l-9.5 19L45 51h-6l-6.5-13L26 51h-6l9.5-14z' fill='white'/%3E%3C/svg%3E">

# Excel Clone — Web Edition

**A pixel-faithful, zero-dependency desktop-class spreadsheet that runs from a folder of static files.**
No bundler. No framework. No `npm install` for the app itself. Serve the folder over HTTP(S) and open its index page to use this independent spreadsheet — ribbons, formula bar, marching ants, `.xlsx` files and all.

<br>

<img alt="zero dependencies" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='20'%3E%3Crect width='90' height='20' fill='%23555'/%3E%3Crect x='90' width='60' height='20' fill='%23217346'/%3E%3Ctext x='45' y='14' fill='white' font-size='11' font-family='Verdana' text-anchor='middle'%3Edependencies%3C/text%3E%3Ctext x='120' y='14' fill='white' font-size='11' font-family='Verdana' text-anchor='middle'%3Ezero%3C/text%3E%3C/svg%3E">
<img alt="265+ functions" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='20'%3E%3Crect width='78' height='20' fill='%23555'/%3E%3Crect x='78' width='72' height='20' fill='%23217346'/%3E%3Ctext x='39' y='14' fill='white' font-size='11' font-family='Verdana' text-anchor='middle'%3Efunctions%3C/text%3E%3Ctext x='114' y='14' fill='white' font-size='11' font-family='Verdana' text-anchor='middle'%3E265%2B%3C/text%3E%3C/svg%3E">

<br><br>

</div>

---

## Why this is not "yet another grid demo"

Most web spreadsheets are a table with `contenteditable`. This one is an **engineering study in Excel fidelity** — the tiny behaviors you only notice when they're wrong:

- **Roam, don't destroy.** Select a block, press <kbd>Tab</kbd> — the active cell cycles *inside* the block and wraps at the corners; the block itself survives. Same for <kbd>Enter</kbd>, <kbd>Shift+Tab</kbd>, <kbd>Shift+Enter</kbd>, and the move after committing an edit. Arrows, on the other hand, collapse the selection from the active cell. Just like the real thing.
- **Point-mode formula editing.** Type `=SUM(` and click cells — colored reference boxes drop onto the grid, the formula bar mirror is **byte-exact** to what you typed, and <kbd>F4</kbd> cycles `$A$1 → A$1 → $A1 → A1`, even inside ranges.
- **Marching ants.** Copy a range and the border crawls; press <kbd>Enter</kbd> to paste once and dismiss, <kbd>Esc</kbd> to just dismiss. TSV paste interops with your OS clipboard.
- **Ctrl+Enter** commits one value into *every* selected cell as a single atomic undo step.
- Football-field grid: the full **1,048,576 × 16,384** Excel address space on a sparse model — `XFD1048576` is a real place you can visit (Ctrl+End will, if you've been there).
- Hidden-row/column-aware navigation, merge-span traversal (Tab hops *over* a merge, never into one), freeze panes with four independently-scrolling panes, and a fill handle that auto-fills series.

---

## Feature atlas

<table>
<tr><th>Area</th><th>What you get</th></tr>
<tr><td><b>Ribbon UX</b></td><td>Eight ribbon tabs (Home, Insert, Page Layout, Formulas, Data, Review, View, Help) with grouped commands, split buttons and galleries, plus the File Backstage (New / Open / Save / Save As / Info / Options), "Tell me what you want to do", and a Quick Access Toolbar.</td></tr>
<tr><td><b>Formula engine</b></td><td><b>265+ worksheet functions</b> across math, stats, finance, engineering, text, date, logic, lookup and info — XLOOKUP, XMATCH, IFS, SWITCH, AGGREGATE, SUBTOTAL, OFFSET, INDIRECT, FORMULATEXT, TEXTJOIN/TEXTAFTER/TEXTBEFORE, NETWORKDAYS, WORKDAY, PMT, XIRR, XNPV, MIRR, CONVERT, ERF, BITAND & friends. Full 1900 date-serial system, error literals (<code>#DIV/0!</code>, <code>#N/A</code>, …), wildcards in criteria, range intersection (<code>B3:B5 B4:B4</code>), 3-D sheet refs, volatile recalc.</td></tr>
<tr><td><b>Formatting</b></td><td>Complete Format Cells dialog (6 tabs), custom number formats incl. zero-padding (<code>00000</code>), star-fill (<code>0*-</code>), dates, percent, currency; themes &amp; cell styles; <code>###</code> when the column's too narrow; format painter; double-click autofit.</td></tr>
<tr><td><b>Data tools</b></td><td>Sort &amp; filter, subtotal outlines, text-to-columns wizard, data validation, conditional formatting, Format as Table, PivotTable builder (summary report onto a new sheet), named ranges (Define Name).</td></tr>
<tr><td><b>Charts</b></td><td>Seven chart types (bar, line, pie, doughnut, scatter, area, …) with a live SVG preview gallery, right-click <i>Change Chart Type</i>, z-ordered floating objects — and they serialize as genuine OOXML chart parts, not screenshots.</td></tr>
<tr><td><b>Files</b></td><td>Exports real <b>.xlsx</b> (chart XML, drawings, rels, media — LibreOffice-verified well-formed parts) and <b>.csv</b>; imports <b>.xlsx</b> (including openpyxl-generated files with cross-sheet formulas, dates, hidden rows, col widths) and <b>.csv</b> via open dialog or drag-and-drop. Sessions persist to <b>IndexedDB</b> between reloads.</td></tr>
<tr><td><b>Print</b></td><td>File → Print exports the <i>sheet</i>, never a screen snapshot: real pagination from your paper size/orientation/margins, Excel's "down then over" column chunking, merged-cell spans, true column widths, optional row/column headings and gridlines, and a <b>Preparing-to-print modal with live progress + Cancel</b> that stays responsive on hundred-page sheets (built in async slices).</td></tr>
<tr><td><b>Appearance</b></td><td>View → <b>Dark Mode</b> — a measured dark theme (56+ tuned rules), persisted in IndexedDB and master-synced from the suite's Office dashboard.</td></tr>
<tr><td><b>Collaboration-ish</b></td><td>Cell notes/comments, hyperlinks (Ctrl+K), sheet protection honoring the <i>Locked</i> cell style, sheet tab management (add/rename/delete/reorder via context menu).</td></tr>
<tr><td><b>Editing surface</b></td><td>In-cell editor that grows with content, formula bar that mirrors every keystroke and expands for long formulas, Find &amp; Replace bar, Go To-style name box, undo/redo that restores the <i>selection</i>, not just the data.</td></tr>
<tr><td><b>Chrome</b></td><td>Status bar quick stats (Average / Count / Sum), zoom slider 10–200 %, Normal / Page Layout / Page Break views, Show Formulas mode (<code>Ctrl+`</code>) that doubles column widths like real Excel, AutoSave pill, window controls — the whole theater.</td></tr>
</table>

---

## Keyboard atlas

<table>
<tr><th>Category</th><th>Keys</th></tr>
<tr><td><b>Navigation</b></td><td>Arrows · <kbd>Ctrl</kbd>+Arrows (jump data edge) · <kbd>Home</kbd> / <kbd>Ctrl+Home</kbd> / <kbd>Ctrl+End</kbd> · <kbd>PgUp/PgDn</kbd> · <kbd>Tab</kbd>/<kbd>Shift+Tab</kbd> · <kbd>Enter</kbd>/<kbd>Shift+Enter</kbd> (cycle inside blocks!) · <kbd>Shift+Backspace</kbd> (snap view back)</td></tr>
<tr><td><b>Selection</b></td><td><kbd>Shift</kbd>+Arrows / click · <kbd>Ctrl</kbd>+click &amp; drag (multi-range) · <kbd>Ctrl+A</kbd> (region → all) · row/col headers · corner = select all</td></tr>
<tr><td><b>Editing</b></td><td>type to replace · <kbd>F2</kbd> / double-click to edit · <kbd>Esc</kbd> cancel · <kbd>Enter</kbd>/<kbd>Tab</kbd> commit &amp; move · <kbd>Alt+Enter</kbd> newline · <kbd>Ctrl+Enter</kbd> fill all selected cells · <kbd>F4</kbd> cycle <code>$</code> in refs · arrows insert refs in point mode · <kbd>Ctrl+;</kbd> today · <kbd>Ctrl+`</kbd> show formulas</td></tr>
<tr><td><b>Clipboard</b></td><td><kbd>Ctrl+C/X/V</kbd> (TSV-interop) · Enter = paste once from marching ants · <kbd>Esc</kbd> clears ants · right-click for Paste Values / Formulas / Formats / Transpose</td></tr>
<tr><td><b>Formatting</b></td><td><kbd>Ctrl+B/I/U</kbd> · <kbd>Ctrl+1</kbd> Format Cells · <kbd>Ctrl+9</kbd> hide rows · <kbd>Ctrl+0</kbd> hide columns</td></tr>
<tr><td><b>Data/File</b></td><td><kbd>Ctrl+D</kbd> fill down · <kbd>Ctrl+R</kbd> fill right · <kbd>Ctrl+F/H</kbd> find/replace · <kbd>Ctrl+K</kbd> hyperlink · <kbd>Ctrl+S</kbd> save · <kbd>Ctrl+Z/Y</kbd> undo/redo · <kbd>F4</kbd> redo · <kbd>F12</kbd> Save As</td></tr>
</table>

---

## Run it

```bash
cd excel-clone
python3 -m http.server 8001 --bind 0.0.0.0   # any static file server works
# open http://localhost:8001/
```

Or from the suite root you'll get the **Office dashboard** with Excel as a tile
(`python3 -m http.server 8002 --bind 0.0.0.0` in the parent folder → `http://localhost:8002/`).
Either way: that's the entire deployment story. There is no step 2.
| Suite | Checks | Domain |
|---|---:|---|
| `calctest.js` | 225 | formula engine, formatting, dates — headless |
| `_comply.js` | 262 | Excel-behavior compliance audit |
| `_batch2.js` | 29 | custom widgets (popups, sliders, formula bar, editors) |
| `_batch3.js` | 27 | charts context menus, CSV, text-to-columns, xlsx parts |
| `_batch5-tabnav.js` | 26 | block cycling, selection model, merge traps |
| `_batch6-fixes.js` | 28 | **print engine progress/cancel, autofill-ghost lifecycle, IndexedDB persistence, dark mode** |
| `_verify13.js` | 30 | icons, formerly-dead buttons, panels |
| `_insflow.js` | 4 | insert-cell flows |
| `_hooks-probe.js` | 15 | SHEET/SHEETS/SUBTOTAL/CELL host hooks |
| `_rt-probe.js` | 44 | .xlsx round-trip + foreign-file import |
| `xl-smoke.js` | ~18 | boot → type → format → undo → save |
| `xl-full.js` | ~19 | dialogs, functions, protection, reload |
| **Total** | **≈ 730** | **all green** |

> **Sandbox note:** browsers and `node_modules` aren't in the workspace snapshot — if a suite says
> "Cannot find module" or "executable doesn't exist", rerun the two npm/npx lines above.

Every script also fails hard on any uncaught `pageerror` — the exact tripwire that caught the `e_shift_mod` regression.

---

## Architecture — how 12k lines pretend to be Excel

```
index.html      chrome DOM: titlebar · tabs · ribbon · fx bar · grid · status
 │
 ├─ idb.js      IndexedDB key/value engine (XKV) — hydrated at boot, async flush
 ├─ icons.js    SVG glyph registry (every icon unique — there's a test for that)
 ├─ calc.js     formula tokenizer/parser/evaluator · 265+ fns · number fmt · 1900 dates
 ├─ xlsx.js     OOXML reader/writer: sheets, styles, merges, charts, media, rels
 ├─ rib.js      ribbon construction from the command table
 ├─ app.js      model · geometry · virtualized renderer · selection · editing ·
 │              clipboard · fill handle · undo · sheets   (~4.2k lines of the magic)
 ├─ app2.js     command table (X.CMDS) · menus · dialogs · charts · notes
 ├─ app3.js     more UI: backstage helpers, dialogs, find/replace, validation
 ├─ app4.js     backstage (open/save/templates) · print engine · pivots · t2c · options
 └─ boot.js     splash · hydrate XKV · mount · restore last session
```

**The render pipeline** is a set of stacked absolutely-positioned layers inside one scrolling stage — body cells, frozen rows, frozen columns, frozen corner, floating objects, selection — painted on demand from a geometry engine (`colX/rowY` prefix sums × zoom), so only the viewport pays for pixels.

**The selection model** is Excel's, not the web's: anchor corner + far corner + banked Ctrl-ranges, plus `sel.cur` — the roaming *active cell* that Tab/Enter move without disturbing the block. (This was the fix that birthed `_batch5-tabnav.js`; see [the story](#the-story-of-e_shift_mod) below.)

**The debug surface** is the app itself: everything interesting hangs off the global `X` object (`X.commitCell`, `X.setSel`, `X.cellDisplay`, `X.recalcAll`…), which is precisely how the test battery drives it.

### Conventions worth stealing

- **Byte-exact mirrors**: the formula-bar highlighter copies input verbatim and only *wraps* tokens in spans, so the overlay can never drift from the text.
- **Excel behavior documented inline**: merge spans, hidden-cell skips, 1900 leap-year compatibility, undo-restores-selection — the intent lives in comments next to the code.
- **Fail loud**: dev suites assert `pageerror` silence app-wide; a single undefined identifier anywhere fails the battery.

---

## The story of `e_shift_mod`

Once upon a refactor, `moveActive()` grew a condition referencing `e_shift_mod` — a variable that never existed in any scope. Because of short-circuit evaluation it lay dormant for *most* keypresses, detonating only when you pressed Tab or Enter with a Ctrl-assembled multi-range selection. The fix became more than deleting six characters: implementing Excel's real semantics (roaming active cell, merge traps, arrows-collapse-but-tabs-cycle) exposed three adjacent bugs — a selection model that couldn't represent "block + active cell", an `endEdit` refresh that ate the active cell on the same tick, and two naïve API usages in the test itself. `_batch5-tabnav.js` now stands guard over all of it: 26 checks, zero mercy, `PAGEERR` = fail.

---

## Known honest gaps

- The name box shows `4R x 3C` for multi-cell selections (Sheets-style) instead of the active-cell reference.
- Tab cycling is implemented for cell blocks; cycling *through* multiple Ctrl-ranges stays within the active range (Excel hops ranges at the boundary).
- No VBA/macros, no dynamic-array spilling, no threaded comments.
- Print covers cell content/styles/merges; floating charts are not yet rastered onto pages.
- AutoSave pill is currently decorative theater; sessions persist locally on real saves.

## Legacy `.xls` support (`legacy.js`)

- **Import `.xls`**: real BIFF8 reader over the OLE (CFB) container, in the
  browser — `BOUNDSHEET`, `SST` (incl. strings split across `CONTINUE` records,
  mid-string and even mid-wchar, with continuation re-flagging), `NUMBER`, `RK`,
  `MULRK`, `BOOLERR`, cached `FORMULA` results (incl. `STRING` follow-ups),
  `LABEL`, `COLINFO` widths, and Excel **dates** (`FORMAT`/`XF` records map the
  serial to a value + format the app understands). Every sheet is preserved.
  Verified against a LibreOffice-written Word-97-era fixture: strings (long +
  unicode), ints/floats, `=B2*C2` → 1140, TRUE/FALSE, `2026-01-15` as a real
  date cell. Legacy cell **styles are flattened** (clearly announced in the toast).
- **Export `.xls`**: SpreadsheetML 2003 ("Microsoft XML Spreadsheet") — the real
  XML dialect Excel 97-2003+ opens natively. Sheets, values, booleans, dates,
  column widths and core styling (bold/italic/underline/colors/fills/alignment/
  wrap) survive a re-open in any office → `.xlsx` round-trip asserted by openpyxl.

## Contributing

1. Reproduce against real Excel (or don't ship it — fidelity is the brand).
2. Drive your fix through `X.*` in a probe first (`_dbg*.js` pattern).
3. Leave a tracker: new behavior without a check in one of the suites is a future regression.
4. `pageerror` silence is sacred.

---

<div align="center">
<i>Excel Web Edition · Version 16.0 (Clone) · hand-rolled in vanilla JS.</i><br>
License: Apache License 2.0
</div>
