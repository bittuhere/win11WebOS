/*
 * Copyright 2026 bittuhere
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* ==========================================================================
   Icon system: inline SVG <symbol> registry (no emojis anywhere)
   Each icon: { c: svg inner markup, vb: viewBox, raw: caller sets own fills.
   Default group: fill:none stroke:currentColor stroke-width:1.15 round caps }
   ========================================================================== */
(function () {
  const T = 'font-family="Segoe UI,Segoe UI Symbol,Arial,sans-serif"';
  const BLU = '#4472C4', GRN = '#70AD47', RED = '#C00000', ORG = '#ED7D31', YEL = '#FFC000';
  const ICONS = {
    /* ---- generic chrome ---- */
    save:      { c:'<path d="M3 2.5h7.4l3.1 3.1v6.9A1.5 1.5 0 0 1 12 14H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 2.5z"/><path d="M5 2.6v2.9h5V2.6"/><path d="M5.5 14v-3.6h5V14"/>' },
    undo:      { c:'<path d="M6.3 3 2.7 6.6l3.6 3.6"/><path d="M2.9 6.6h6.4a4.1 4.1 0 0 1 0 8.2H5"/>' },
    redo:      { c:'<path d="M9.7 3l3.6 3.6-3.6 3.6"/><path d="M13.1 6.6H6.7a4.1 4.1 0 0 0 0 8.2H11"/>' },
    'chev-d':  { c:'<path d="M4.5 6.5 8 10l3.5-3.5"/>' },
    'chev-up': { c:'<path d="M4.5 9.5 8 6l3.5 3.5"/>' },
    'chev-r':  { c:'<path d="M6.5 4.5 10 8l-3.5 3.5"/>' },
    'chev-l':  { c:'<path d="M9.5 4.5 6 8l3.5 3.5"/>' },
    back:      { c:'<path d="M9.9 2.8 5 8l4.9 5.2"/>', sw:1.5 },
    search:    { c:'<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2 13.5 13.5"/>' },
    bulb:      { c:'<path d="M8 2.2a3.6 3.6 0 0 0-2 6.6c.5.4.7.8.7 1.5h2.6c0-.7.2-1.1.7-1.5A3.6 3.6 0 0 0 8 2.2z"/><path d="M6.9 12.3h2.2"/><path d="M7.2 13.9h1.6"/>' },
    person:    { c:'<circle cx="8" cy="5.2" r="2.6"/><path d="M3 13.8c.7-3.2 2.7-4.8 5-4.8s4.3 1.6 5 4.8"/>' },
    minus:     { c:'<path d="M3.5 8h9"/>' },
    plus:      { c:'<path d="M3.5 8h9M8 3.5v9"/>' },
    check:     { c:'<path d="M3 8.6l3.2 3.2L13 4.8"/>' },
    close:     { c:'<path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8"/>' },
    folder:    { c:'<path d="M2.2 4.2a1 1 0 0 1 1-1h3.1l1.4 1.7h5.1a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1z"/>' },
    newdoc:    { c:'<rect x="3.4" y="2" width="8.2" height="12" rx="1"/><path d="M9.4 2v2.6h2.2" fill="#fff"/><path d="M9.4 2l2.2 2.6"/>' },
    print:     { c:'<path d="M4.6 6.4V2.6h6.8v3.8"/><rect x="2.5" y="6.4" width="11" height="5.2" rx="1"/><rect x="4.6" y="9.6" width="6.8" height="4" fill="#fff"/><path d="M13 8h.6" stroke-width="1.6"/>' },
    share:     { c:'<circle cx="4" cy="8" r="2"/><circle cx="11.6" cy="3.8" r="2"/><circle cx="11.6" cy="12.2" r="2"/><path d="M5.8 7.1 9.8 4.7M5.8 8.9l4 2.4"/>' },
    export:    { c:'<path d="M8 2v7.2M5.2 6 8 8.8 10.8 6"/><path d="M3 10.6v2A1.4 1.4 0 0 0 4.4 14h7.2a1.4 1.4 0 0 0 1.4-1.4v-2"/>' },
    info:      { c:'<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v3.6M8 4.6v.4" stroke-width="1.5"/>' },
    options:   { c:'<circle cx="8" cy="8" r="2.1"/><path d="M8 2.2v1.8M8 12v1.8M2.2 8h1.8M12 8h1.8M3.9 3.9l1.3 1.3M10.8 10.8l1.3 1.3M12.1 3.9l-1.3 1.3M5.2 10.8l-1.3 1.3"/>' },
    help:      { c:'<circle cx="8" cy="8" r="6.2"/><path d="M6.2 6.2A1.9 1.9 0 0 1 8 4.6c1.1 0 1.9.7 1.9 1.6 0 1.3-1.9 1.5-1.9 2.8"/><path d="M8 11.6v.4" stroke-width="1.5"/>' },
    lock:      { c:'<rect x="3.6" y="7" width="8.8" height="6.4" rx="1"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/>' },
    link:      { c:'<circle cx="7" cy="7" r="4.9"/><ellipse cx="7" cy="7" rx="2.2" ry="4.9"/><path d="M2.3 5.4h9.4M2.3 8.6h9.4"/><path d="M9.6 12.6l1.2-1.2a1.55 1.55 0 0 1 2.2 2.2l-1.2 1.2a1.55 1.55 0 0 1-2.2-2.2z" fill="#fff"/>' },
    shapes:    { c:'<circle cx="5.2" cy="5.4" r="3.4"/><rect x="8" y="2.2" width="6" height="6" rx=".6"/><path d="M6.4 13.8 8.6 9.9l3 3.9z"/><path d="M11.6 13.8h2.6"/>' },

    /* ---- clipboard ---- */
    paste:     { raw:1, c:'<rect x="2.2" y="4.4" width="6.4" height="9.4" fill="#fff" stroke="currentColor"/><path d="M3.6 7h3.6M3.6 9.2h3.6M3.6 11.4h3.6" stroke="#9E9C9A" fill="none"/><rect x="5.8" y="2.6" width="8.4" height="11.4" rx="1" fill="#fff" stroke="currentColor"/><rect x="8.3" y="1.2" width="3.4" height="2.5" rx=".8" fill="'+GRN+'" stroke="none"/><path d="M7.4 6.4h5.2M7.4 8.7h5.2M7.4 11h5.2" stroke="#A9D08E" fill="none"/>' },
    pasteval:  { raw:1, c:'<rect x="2.8" y="2.4" width="10.4" height="11.6" rx="1" fill="#fff" stroke="currentColor"/><text x="4" y="11.2" font-size="7.5" fill="#444" '+T+'>123</text>' },
    pasteform: { raw:1, c:'<rect x="2.8" y="2.4" width="10.4" height="11.6" rx="1" fill="#fff" stroke="currentColor"/><text x="4.6" y="11.4" font-size="8.5" font-style="italic" fill="#444" font-family="Cambria,Georgia,serif">fx</text>' },
    pastetp:   { raw:1, c:'<path d="M2.8 8.4a5.2 5.2 0 0 1 10.4 0M13.2 8.4a5.2 5.2 0 0 1-10.4 0" fill="none" stroke="currentColor"/><rect x="1.8" y="1.8" width="4.4" height="4.4" fill="#fff" stroke="currentColor"/><rect x="9.8" y="9.8" width="4.4" height="4.4" fill="#fff" stroke="currentColor"/>' },
    cut:       { c:'<circle cx="4.4" cy="11.3" r="1.9"/><circle cx="11.6" cy="11.3" r="1.9"/><path d="M5.9 10.1 12.6 3.1"/><path d="M10.1 10.1 3.4 3.1"/>' },
    copy:      { c:'<rect x="2.8" y="2.4" width="7.8" height="10.4" rx="1"/><rect x="5.6" y="5.2" width="7.8" height="10.4" rx="1" fill="#fff"/>' },
    fpainter:  { c:'<path d="M3.2 2.4h9.6v3.6H3.2z"/><path d="M7.2 6v1.5h1.6V6"/><rect x="7.1" y="7.5" width="1.8" height="6.1" rx=".9"/>' },

    /* ---- font group ---- */
    growfont:  { raw:1, c:'<text x="1.4" y="12.2" font-size="10.5" font-weight="600" fill="currentColor" '+T+'>A</text><path d="M11.8 9V2.6M9.8 4.6l2-2 2 2" fill="none" stroke="currentColor"/>' },
    shrinkfont:{ raw:1, c:'<text x="1.4" y="12.2" font-size="9" font-weight="600" fill="currentColor" '+T+'>A</text><path d="M11.8 2.6V9M9.8 7l2 2 2-2" fill="none" stroke="currentColor"/>' },
    clearfmt:  { raw:1, c:'<text x="1" y="12.2" font-size="10.5" font-weight="500" fill="currentColor" '+T+'>A</text><g transform="rotate(45 11.2 7.2)"><rect x="8.6" y="6.2" width="5.2" height="2.2" fill="#F4A6C1" stroke="currentColor" stroke-width=".7"/><rect x="8.6" y="4.6" width="5.2" height="1.6" fill="#FBDCE9" stroke="currentColor" stroke-width=".7"/></g><path d="M7.4 13.8h7" stroke="currentColor" fill="none"/>' },
    bold:      { raw:1, c:'<text x="4.2" y="12.6" font-size="12.5" font-weight="700" fill="currentColor" '+T+'>B</text>' },
    italic:    { raw:1, c:'<text x="6.6" y="12.6" font-size="12.5" font-weight="500" font-style="italic" fill="currentColor" '+T+'>I</text>' },
    under:     { raw:1, c:'<text x="4.2" y="11.6" font-size="12" fill="currentColor" '+T+'>U</text><path d="M4.2 14.3h7.6" stroke="currentColor" fill="none" stroke-width="1.2"/>' },
    dblunder:  { raw:1, c:'<text x="4.2" y="10.6" font-size="12" fill="currentColor" '+T+'>U</text><path d="M4.2 12.9h7.6M4.2 15h7.6" stroke="currentColor" fill="none" stroke-width="1"/>' },
    strike:    { raw:1, c:'<text x="2.2" y="10.8" font-size="9.5" fill="currentColor" '+T+'>abc</text><path d="M2 8h12" stroke="currentColor" fill="none"/>' },
    fontcolor: { raw:1, c:'<text x="3.6" y="11.4" font-size="11.5" font-weight="500" fill="currentColor" '+T+'>A</text><path d="M3 13.9h10" stroke="'+RED+'" stroke-width="2.2" fill="none"/>' },
    bucket:    { raw:1, c:'<path d="M4.6 6.2 8 2.8l4.6 4.6-4.6 4.6z" fill="#fff" stroke="currentColor"/><path d="M11.6 6.2l1.7 1.7c.9 1 1.3 1.8 1.3 2.4a1.25 1.25 0 1 1-2.5 0c0-.6.3-1.3-.5-2.5z" fill="'+YEL+'" stroke="currentColor" stroke-width=".6"/><path d="M2.8 13.9h10.4" stroke="'+YEL+'" stroke-width="2.2" fill="none"/>' },
    border:    { c:'<rect x="2.6" y="2.6" width="10.8" height="10.8"/><path d="M2.6 13.9h10.8" stroke-width="2.4"/>' },

    /* ---- alignment ---- */
    aligntop:  { c:'<path d="M2.6 2.6h10.8" stroke-width="1.6"/><path d="M4.2 5.4h2M4.2 8.2h2M9.8 5.4h2M9.8 8.2h2" stroke-width="1.2"/>' },
    alignmid:  { c:'<path d="M2.6 8h10.8" stroke-width="1.6"/><path d="M4.2 4.6h2M4.2 11.4h2M9.8 4.6h2M9.8 11.4h2" stroke-width="1.2"/>' },
    alignbot:  { c:'<path d="M2.6 13.4h10.8" stroke-width="1.6"/><path d="M4.2 8h2M4.2 10.8h2M9.8 8h2M9.8 10.8h2" stroke-width="1.2"/>' },
    orient:    { raw:1, c:'<g transform="rotate(-24 8 9)"><text x="3" y="11.6" font-size="9" fill="currentColor" '+T+'>ab</text></g><path d="M10.6 3.4 12 6l-2.9-.3" fill="none" stroke="currentColor"/><path d="M12 6c-2.2 4.2-5.4 6.4-9.4 6.9" fill="none" stroke="currentColor" stroke-dasharray="1.4 1.1"/>' },
    alignl:    { c:'<path d="M2.5 4h11M2.5 7.4h7M2.5 10.8h11M2.5 14.2h7" stroke-width="1.3"/>' },
    alignc:    { c:'<path d="M2.5 4h11M4.5 7.4h7M2.5 10.8h11M4.5 14.2h7" stroke-width="1.3"/>' },
    alignr:    { c:'<path d="M2.5 4h11M6.5 7.4h7M2.5 10.8h11M6.5 14.2h7" stroke-width="1.3"/>' },
    outdent:   { c:'<path d="M6.4 4h7M6.4 8h7M6.4 12h7" stroke-width="1.3"/><path d="M4.6 5.8 2.4 8l2.2 2.2"/>' },
    indent:    { c:'<path d="M6.4 4h7M6.4 8h7M6.4 12h7" stroke-width="1.3"/><path d="M2.4 5.8 4.6 8 2.4 10.2"/>' },
    wraptext:  { c:'<path d="M2.4 4.6h6.4M2.4 8h10.4M2.4 11.4h6.4"/><path d="M12.6 2.8v5.8c0 2.5-1.6 3.4-3.8 3.4M10.4 10.2 8.8 12l1.6 1.8"/>' },
    merge:     { c:'<rect x="2.2" y="5" width="5.2" height="6"/><rect x="8.6" y="5" width="5.2" height="6"/><path d="M6 8h4M8.4 6.4 10 8l-1.6 1.6" /><path d="M10 8H6M7.6 6.4 6 8l1.6 1.6"/>' },
    unmerge:   { c:'<rect x="2.2" y="5" width="11.6" height="6"/><path d="M8 5v6M7 8h-1M9 8h1" stroke-dasharray="1.5 1.2"/>' },

    /* ---- number group ---- */
    numfmt:    { raw:1, c:'<text x="1.4" y="12.4" font-size="11" font-weight="500" fill="currentColor" '+T+'>123</text>' },
    accounting:{ raw:1, c:'<rect x="1.6" y="4" width="12.8" height="8" rx=".8" fill="#fff" stroke="currentColor"/><circle cx="8" cy="8" r="2.6" fill="#fff" stroke="currentColor" stroke-width=".9"/><text x="6.6" y="9.8" font-size="6.2" fill="currentColor" '+T+'>$</text><path d="M3 6h1.2M3 10h1.2M11.8 6H13M11.8 10H13" stroke="currentColor" stroke-width=".8"/>' },
    percent:   { raw:1, c:'<text x="1.2" y="12.6" font-size="12.5" fill="currentColor" '+T+'>%</text>' },
    comma:     { raw:1, c:'<text x="0.6" y="9.6" font-size="7.6" fill="currentColor" '+T+'>000</text><text x="12" y="12.4" font-size="10" fill="currentColor" '+T+'>,</text><path d="M1 12.9h11" stroke="currentColor" stroke-width="1.1" fill="none"/>' },
    decinc:    { raw:1, c:'<text x="0.8" y="8.4" font-size="6.8" fill="currentColor" '+T+'>.0</text><text x="9" y="14.4" font-size="6.4" fill="currentColor" '+T+'>.00</text><path d="M4.6 9.4 9.8 12M7.9 10.1l2 1.9-2.6.6" fill="none" stroke="currentColor"/>' },
    decdec:    { raw:1, c:'<text x="0.8" y="12.8" font-size="6.8" fill="currentColor" '+T+'>.00</text><text x="10.6" y="6.8" font-size="6.4" fill="currentColor" '+T+'>.0</text><path d="M11.2 11 6 8.6M8.1 6.7l-2 1.9 2.6.6" fill="none" stroke="currentColor"/>' },
    datefmt:   { c:'<rect x="2.2" y="3" width="11.6" height="10.6" rx="1"/><path d="M2.2 5.8h11.6M5.2 1.8v2.4M10.8 1.8v2.4"/><path d="M4.4 8h1.6M7.2 8h1.6M10 8h1.6M4.4 10.6h1.6M7.2 10.6h1.6" stroke-width="1.4"/>' },

    /* ---- styles / cells ---- */
    condfmt:   { raw:1, c:'<rect x="1.8" y="2.6" width="12.4" height="10.8" rx=".6" fill="#fff" stroke="currentColor"/><rect x="2.8" y="7.4" width="3.4" height="5" fill="'+BLU+'" stroke="none"/><rect x="6.8" y="5" width="3.4" height="7.4" fill="'+GRN+'" stroke="none"/><rect x="10.8" y="3.6" width="2.4" height="8.8" fill="'+RED+'" stroke="none"/>' },
    formattbl: { raw:1, c:'<rect x="1.8" y="2.6" width="12.4" height="10.8" fill="#fff" stroke="currentColor"/><rect x="1.8" y="2.6" width="12.4" height="2.6" fill="'+BLU+'" stroke="none"/><rect x="1.8" y="7.4" width="12.4" height="2.2" fill="#D6E4F0" stroke="none"/><rect x="1.8" y="11.2" width="12.4" height="2.2" fill="#D6E4F0" stroke="none"/><path d="M6 2.6v10.8M10.4 2.6v10.8" stroke="currentColor" stroke-width=".7" fill="none"/>' },
    cellstyles:{ raw:1, c:'<rect x="1.8" y="2.2" width="5.6" height="5.6" fill="#C6E0B4" stroke="currentColor" stroke-width=".8"/><rect x="8.6" y="2.2" width="5.6" height="5.6" fill="#F8CBAD" stroke="currentColor" stroke-width=".8"/><rect x="1.8" y="9" width="5.6" height="5.6" fill="#FFD966" stroke="currentColor" stroke-width=".8"/><rect x="8.6" y="9" width="5.6" height="5.6" fill="#BDD7EE" stroke="currentColor" stroke-width=".8"/>' },
    insertcells:{c:'<rect x="1.8" y="2.2" width="8.6" height="7.6"/><path d="M1.8 4.7h8.6M1.8 7.2h8.6M4.7 2.2v7.6M7.6 2.2v7.6"/><circle cx="11.3" cy="11.6" r="3.4" fill="#fff"/><path d="M11.3 9.8v3.6M9.5 11.6h3.6" stroke="'+GRN+'" stroke-width="1.4"/>' },
    deletecells:{c:'<rect x="1.8" y="2.2" width="8.6" height="7.6"/><path d="M1.8 4.7h8.6M1.8 7.2h8.6M4.7 2.2v7.6M7.6 2.2v7.6"/><circle cx="11.3" cy="11.6" r="3.4" fill="#fff"/><path d="M10 10.3l2.6 2.6M12.6 10.3 10 12.9" stroke="'+RED+'" stroke-width="1.3"/>' },
    formatcells:{c:'<rect x="1.8" y="2.2" width="8.6" height="7.6"/><path d="M1.8 4.7h8.6M1.8 7.2h8.6M4.7 2.2v7.6M7.6 2.2v7.6"/><circle cx="11.3" cy="11.6" r="3.4" fill="#fff"/><path d="M11.3 9.4v4.4M9.1 11.6h4.4M9.7 9.9l3.2 3.2M12.9 9.9 9.7 13.1"/>' },

    /* ---- editing group ---- */
    autosum:   { raw:1, c:'<text x="2.2" y="12.8" font-size="13.5" fill="currentColor" font-family="Cambria Math,Georgia,serif">Σ</text>' },
    fill:      { c:'<rect x="1.8" y="7.8" width="12.4" height="6" /><path d="M1.8 10.8h12.4M6 7.8v6M10.2 7.8v6"/><path d="M8 1.6v3.8M6.3 4 8 5.7 9.7 4"/>' },
    clear:     { c:'<path d="M9.9 2.6 13.4 6l-6.6 6.6H3.2l-1.8-1.8z" fill="#fff"/><path d="M9.9 2.6 13.4 6l-6.6 6.6H3.2l-1.8-1.8z"/><path d="M6 13.9h8"/>' },
    sortaz:    { raw:1, c:'<text x="1.4" y="6.6" font-size="7.8" fill="currentColor" '+T+'>A</text><text x="1.6" y="13.8" font-size="7.8" fill="currentColor" '+T+'>Z</text><path d="M11 3v9.6M8.8 10.3l2.2 2.3 2.2-2.3" stroke="currentColor" fill="none"/>' },
    sortza:    { raw:1, c:'<text x="1.4" y="6.6" font-size="7.8" fill="currentColor" '+T+'>Z</text><text x="1.6" y="13.8" font-size="7.8" fill="currentColor" '+T+'>A</text><path d="M11 12.6V3M8.8 5.3 11 3l2.2 2.3" stroke="currentColor" fill="none"/>' },
    sortdlg:   { raw:1, c:'<text x="1.4" y="6.4" font-size="7.6" fill="currentColor" '+T+'>A</text><text x="1.6" y="12.4" font-size="7.6" fill="currentColor" '+T+'>Z</text><path d="M8.6 4.6h2.2l-2.2 6.8h2.6" stroke="currentColor" fill="none" stroke-width="1"/><path d="M13.8 2.8v5.4l1.2 1.6M13.8 2.8l-1.9 6.4" stroke="currentColor" fill="none"/><path d="M12 7.2h3.6" stroke="currentColor"/>' },
    filter:    { c:'<path d="M2.2 3h11.6L9.6 8.4v4.4l-3.2 1.6V8.4z"/>' },
    filterclr: { c:'<path d="M2.2 3h9.4l-3 3.9v4.2L5.6 12.5V6.9z"/><path d="M11.8 10.4l3 3M14.8 10.4l-3 3" stroke="'+RED+'"/>' },
    find:      { c:'<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2 13.5 13.5"/>' },
    replace:   { c:'<path d="M3.2 5.4h8M8.9 3.2l2.3 2.2-2.3 2.2"/><path d="M12.8 10.6h-8M7.1 8.4l-2.3 2.2 2.3 2.2"/>' },
    selectall: { c:'<path d="M4.6 2.4v9.8l2.4-2.5h4.2z" fill="#fff"/><path d="M10 3.2h3.6M10 5.6h3.6M10.6 8h3" stroke-dasharray="1.2 1.2" stroke-width="1.1"/>' },

    /* ---- insert ---- */
    pivot:     { raw:1, c:'<rect x="1.8" y="3" width="6.6" height="10" fill="#fff" stroke="currentColor"/><path d="M1.8 5.4h6.6M1.8 10.6h6.6M4.6 3v10" stroke="currentColor" fill="none"/><rect x="9.6" y="2.2" width="4.6" height="3.6" fill="'+BLU+'" stroke="none" opacity=".9"/><rect x="9.6" y="9.4" width="4.6" height="3.6" fill="'+GRN+'" stroke="none" opacity=".9"/><path d="M8.4 7.4l3.4 1M9 5.8l1.8 3.8" stroke="currentColor" fill="none"/>' },
    table:     { raw:1, c:'<rect x="1.8" y="2.6" width="12.4" height="10.8" fill="#fff" stroke="currentColor"/><rect x="1.8" y="2.6" width="12.4" height="2.6" fill="'+BLU+'" stroke="none"/><path d="M1.8 7.4h12.4M1.8 10h12.4M6 5.2v8.2M10.2 5.2v8.2" stroke="currentColor" fill="none" stroke-width=".8"/>' },
    chartcol:  { raw:1, c:'<path d="M2.4 2v12h11.6" fill="none" stroke="currentColor"/><rect x="4" y="7" width="2.2" height="7" fill="'+BLU+'" stroke="none"/><rect x="7" y="4.4" width="2.2" height="9.6" fill="'+ORG+'" stroke="none"/><rect x="10" y="6" width="2.2" height="8" fill="#A5A5A5" stroke="none"/>' },
    chartbar:  { raw:1, c:'<path d="M2.4 2v12h11.6" fill="none" stroke="currentColor"/><rect x="2.4" y="4" width="8" height="2.2" fill="'+BLU+'" stroke="none"/><rect x="2.4" y="7.4" width="11" height="2.2" fill="'+ORG+'" stroke="none"/><rect x="2.4" y="10.8" width="6" height="2.2" fill="#A5A5A5" stroke="none"/>' },
    chartline: { raw:1, c:'<path d="M2.4 2v12h11.6" fill="none" stroke="currentColor"/><path d="M3.4 11.4 6.4 6.8l3 2.4 3.4-5" fill="none" stroke="'+BLU+'" stroke-width="1.8"/>' },
    chartpie:  { raw:1, c:'<circle cx="8" cy="8" r="6.2" fill="#fff" stroke="currentColor"/><path d="M8 8V1.8A6.2 6.2 0 0 1 13.9 6z" fill="'+BLU+'" stroke="none"/><path d="M8 8l5.9-2A6.2 6.2 0 0 1 11.4 13z" fill="'+ORG+'" stroke="none"/><path d="M8 8l3.4 5A6.2 6.2 0 0 1 3.4 11.4z" fill="#A5A5A5" stroke="none"/>' },
    chartarea: { raw:1, c:'<path d="M2.4 2v12h11.6" fill="none" stroke="currentColor"/><path d="M2.4 11 6 6.4l3 2.6L13.4 4v10H2.4z" fill="'+BLU+'" stroke="none" opacity=".85"/>' },
    scatter:   { raw:1, c:'<path d="M2.4 2v12h11.6" fill="none" stroke="currentColor"/><circle cx="5.4" cy="10" r="1.1" fill="'+BLU+'" stroke="none"/><circle cx="7.6" cy="7.4" r="1.1" fill="'+BLU+'" stroke="none"/><circle cx="10" cy="8.6" r="1.1" fill="'+BLU+'" stroke="none"/><circle cx="11.8" cy="5.4" r="1.1" fill="'+BLU+'" stroke="none"/>' },
    sparkline: { raw:1, c:'<rect x="1.8" y="3" width="12.4" height="10" fill="#fff" stroke="currentColor"/><path d="M2.8 10.4 5.4 7l2.2 2 2.4-3.4 2.6 2" fill="none" stroke="'+BLU+'" stroke-width="1.4"/>' },
    picture:   { raw:1, c:'<rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1" fill="#fff" stroke="currentColor"/><circle cx="5.6" cy="6" r="1.3" fill="'+YEL+'" stroke="none"/><path d="M2.2 11.8 5.6 7.6l2.6 2.8 1.8-1.8 3.8 3.2 0 .6H2.2z" fill="'+GRN+'" stroke="none"/>' },
    textbox:   { c:'<rect x="1.8" y="4" width="12.4" height="8" rx=".4"/><path d="M3.8 6.2h8.4M3.8 8h8.4M3.8 9.8h5.4"/>' },
    symbol:    { raw:1, c:'<text x="2.6" y="12.6" font-size="12" fill="currentColor" font-family="Cambria Math,Georgia,serif">Ω</text>' },

    /* ---- page layout ---- */
    themes:    { raw:1, c:'<text x="2" y="12.8" font-size="13" font-weight="600" fill="currentColor" '+T+'>A</text><path d="M2.6 14.6h3.2" stroke="'+BLU+'" stroke-width="2"/><path d="M6.2 14.6h3.2" stroke="'+ORG+'" stroke-width="2"/><path d="M9.8 14.6h3.2" stroke="#A5A5A5" stroke-width="2"/>' },
    margins:   { c:'<rect x="3" y="1.8" width="10" height="12.4"/><path d="M5 4h6M5 6h6M5 8h6M5 10h4" stroke-dasharray="1 1.1"/>', },
    orient:    { c:'<rect x="1.8" y="4.6" width="8" height="6.8"/><rect x="6.4" y="4.6" width="8" height="6.8" fill="#fff"/>' },
    size:      { c:'<rect x="2.4" y="2" width="11.2" height="12"/><path d="M9 2h4.6v4.6"/><path d="M13.6 2 8.4 7.2"/>' },
    printarea: { c:'<rect x="2.4" y="2" width="11.2" height="12"/><path d="M4.4 4h7.2M4.4 6.6h7.2M4.4 9.2h5" stroke-dasharray="1 1.1"/><rect x="3.6" y="3.2" width="8.8" height="6.6" stroke-dasharray="1.6 1.3"/>' },
    breaks:    { c:'<rect x="2.4" y="2" width="11.2" height="12"/><path d="M2.4 7.8h11.2" stroke-dasharray="1.8 1.5" stroke-width="1.3"/>' },
    printtitles:{c:'<rect x="2.4" y="2" width="11.2" height="12"/><path d="M2.4 4.6h11.2" stroke-width="1.6"/><path d="M4.4 7h7.2M4.4 9.6h7.2" stroke-dasharray="1 1.1"/>' },

    /* ---- formulas ---- */
    fx:        { raw:1, c:'<text x="3.4" y="12.4" font-size="12" font-style="italic" font-weight="500" fill="currentColor" font-family="Cambria,Georgia,serif">fx</text>' },
    logical:   { raw:1, c:'<text x="3.2" y="6.4" font-size="6.4" fill="currentColor" '+T+'>2=2+2</text><text x="2.4" y="12.8" font-size="6.4" fill="currentColor" '+T+'>TRUE</text><path d="M1.8 8.6h12.4" stroke="currentColor" stroke-width=".7" fill="none"/>' },
    formtext:  { raw:1, c:'<text x="2" y="6.6" font-size="6" fill="currentColor" '+T+'>"Enabled"</text><text x="3" y="12.6" font-size="6" fill="currentColor" '+T+'>"  ab"</text><path d="M1.8 8.6h12.4" stroke="currentColor" stroke-width=".7" fill="none"/>' },
    datetime:  { c:'<circle cx="6" cy="8" r="4.4"/><path d="M6 5v3l2.2 1.4"/><rect x="9" y="8.8" width="5.4" height="5" fill="#fff"/><path d="M9 10.4h5.4M10.6 8.8v5M12.8 8.8v5"/>' },
    lookup:    { c:'<rect x="1.8" y="2.4" width="8.6" height="7.4"/><path d="M1.8 4.9h8.6M1.8 7.3h8.6M4.7 2.4v7.4M7.6 2.4v7.4"/><circle cx="11.2" cy="10.4" r="2.4" fill="#fff"/><circle cx="11.2" cy="10.4" r="2.4"/><path d="M13 12.2l1.8 1.8"/>' },
    math:      { raw:1, c:'<text x="2.2" y="6.2" font-size="6.4" fill="currentColor" '+T+'>Σx</text><text x="3" y="12.8" font-size="6.4" fill="currentColor" '+T+'>SUM</text><path d="M1.8 8.6h12.4" stroke="currentColor" stroke-width=".7" fill="none"/>' },
    morefuncs: { raw:1, c:'<text x="2.6" y="11.4" font-size="10" font-style="italic" fill="currentColor" font-family="Cambria,Georgia,serif">fx</text><path d="M8 13.9h7" stroke="currentColor" fill="none" stroke-width="1.1"/>' },
    namemgr:   { c:'<path d="M2.4 2.6h6.2l4.8 4.8a1.2 1.2 0 0 1 0 1.7l-4.3 4.3a1.2 1.2 0 0 1-1.7 0L2.6 8.6z"/><circle cx="5.4" cy="5.4" r="1"/>' },
    definename:{ c:'<path d="M2.4 2.6h6.2l4.8 4.8a1.2 1.2 0 0 1 0 1.7l-4.3 4.3a1.2 1.2 0 0 1-1.7 0L2.6 8.6z"/><text x="5.2" y="10.4" font-size="6.4" fill="currentColor" '+T+' xml:space="preserve">A1</text>' },
    traceprec: { c:'<rect x="1.8" y="3" width="7.6" height="7.6"/><path d="M1.8 5.5h7.6M1.8 8h7.6M4.4 3v7.6M7 3v7.6"/><path d="M10.6 5.6l3.4 2.8-3.4 2.8M14 8.4h-4.4" stroke="'+BLU+'"/>' },
    tracedep:  { c:'<rect x="6.6" y="3" width="7.6" height="7.6"/><path d="M6.6 5.5h7.6M6.6 8h7.6M9.2 3v7.6M11.8 3v7.6"/><path d="M5 5.6 1.6 8.4 5 11.2M1.6 8.4h4.4" stroke="'+BLU+'"/>' },
    rmvarrows: { c:'<rect x="1.8" y="3" width="7.6" height="7.6"/><path d="M1.8 5.5h7.6M1.8 8h7.6M4.4 3v7.6M7 3v7.6"/><path d="M10.4 4.6l5 5M15.4 4.6l-5 5" stroke="'+RED+'"/>' },
    showform:  { raw:1, c:'<text x="2.2" y="6.2" font-size="6.4" fill="currentColor" '+T+'>=B1+C1</text><text x="3" y="12.8" font-size="6.4" fill="currentColor" '+T+'>193</text><path d="M1.8 8.6h12.4" stroke="currentColor" stroke-width=".7" fill="none"/>' },
    errorcheck:{ raw:1, c:'<path d="M8 1.8 14.4 13.6H1.6z" fill="'+YEL+'" stroke="currentColor"/><path d="M8 6v3.6M8 11.2v.4" stroke="currentColor" fill="none" stroke-width="1.3"/>' },
    calcnow:   { c:'<rect x="3.4" y="1.8" width="9.2" height="12.4" rx="1"/><rect x="4.8" y="3.2" width="6.4" height="2.4"/><path d="M4.8 7.6h1.6M7.2 7.6h1.6M9.6 7.6h1.6M4.8 9.8h1.6M7.2 9.8h1.6M9.6 9.8h1.6M4.8 12h1.6M7.2 12h1.6M9.6 12h1.6"/>' },

    /* ---- data ---- */
    refresh:   { c:'<path d="M13 8A5 5 0 1 1 8 3c1.9 0 3.4.9 4.3 2.2"/><path d="M13.1 1.8v3.4h-3.4" transform="translate(-.6 .2)"/>' },
    texttocols:{ raw:1, c:'<rect x="1.8" y="3" width="12.4" height="10" fill="#fff" stroke="currentColor"/><path d="M8 3v10" stroke="currentColor" fill="none"/><path d="M3 6h3.4M3 8.6h3.4M3 11.2h3.4M9.6 6H13M9.6 8.6H13M9.6 11.2H13" stroke="#A5A5A5" fill="none"/>' },
    flashfill: { raw:1, c:'<rect x="1.8" y="3" width="12.4" height="10" fill="#fff" stroke="currentColor"/><path d="M8 3v10" stroke="currentColor" fill="none"/><path d="M9 4.4 10.2 7h-1l2 5-3.4-5h1.2z" fill="'+YEL+'" stroke="currentColor" stroke-width=".6"/>' },
    dataval:   { c:'<circle cx="6.2" cy="8" r="4.6"/><path d="M4.4 8l1.2 1.2L8 6.8"/><circle cx="11.6" cy="11.6" r="3.2" fill="#fff"/><path d="M11.6 13.2l-2.2-2.2 2.2-2.2 2.2 2.2z" fill="'+RED+'" stroke="none"/>' },
    group:     { c:'<rect x="2" y="2.6" width="10" height="3" fill="#fff"/><rect x="3.8" y="7.6" width="10" height="3" fill="#fff"/><path d="M4 5.6 6 7.4M12 5.6l-2 1.8"/>' },
    ungroup:   { c:'<rect x="2" y="2.6" width="10" height="3" fill="#fff"/><rect x="3.8" y="7.6" width="10" height="3" fill="#fff"/><path d="M5.6 7.2 3.6 5.6M10.4 7.2l2-1.6"/>' },
    subtotal:  { raw:1, c:'<text x="2" y="6" font-size="6.4" fill="currentColor" '+T+'>North</text><text x="2" y="10" font-size="6.4" fill="currentColor" '+T+'>North Total</text><path d="M1.8 7.2h12.4" stroke="'+BLU+'" fill="none"/>' },

    /* ---- review ---- */
    spelling:  { raw:1, c:'<text x="1.4" y="12.2" font-size="11" fill="currentColor" '+T+'>abc</text><path d="M8.4 13 11 15l4-6.4" fill="none" stroke="currentColor" stroke-width="1.3"/>' },
    note:      { c:'<path d="M2.6 2.6h10.8v8.2H8.4L5 13.8v-3H2.6z" fill="#fff"/><path d="M2.6 2.6h10.8v8.2H8.4L5 13.8v-3H2.6z"/><path d="M5 5.6h6M5 7.8h4.4"/>' },
    protect:   { c:'<rect x="2" y="2" width="8.6" height="7.4" fill="#fff"/><path d="M2 4.5h8.6M4.5 2v7.4"/><rect x="8" y="8.4" width="6.4" height="5.2" rx=".8" fill="#fff"/><rect x="8" y="8.4" width="6.4" height="5.2" rx=".8"/><path d="M9.6 8.4V6.8a1.6 1.6 0 0 1 3.2 0v1.6"/>' },

    /* ---- view ---- */
    normview:  { c:'<rect x="1.8" y="2.6" width="12.4" height="10.8"/><path d="M6 2.6v10.8M10.2 2.6v10.8M1.8 6.2h12.4M1.8 9.8h12.4"/>' },
    playout:   { c:'<rect x="1.8" y="1.6" width="7.6" height="12.8" fill="#fff"/><path d="M3.4 4h4.4M3.4 6.2h4.4M3.4 8.4h4.4" stroke-dasharray="1 1"/><rect x="8.6" y="1.6" width="5.6" height="8" fill="#fff" opacity=".6"/><rect x="8.6" y="10.6" width="5.6" height="3.8" fill="#fff" opacity=".6"/>' },
    pbreak:    { c:'<rect x="2" y="1.6" width="7.4" height="12.8" fill="#fff"/><path d="M2 6.8h7.4M4.8 1.6v12.8" stroke-dasharray="1.6 1.4"/><rect x="9.4" y="5.8" width="4.8" height="6.8" fill="#fff" opacity=".7"/>' },
    gridview:  { c:'<rect x="2" y="2" width="12" height="12"/><path d="M6 2v12M10 2v12M2 6h12M2 10h12"/>' },
    zoom:      { c:'<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2 13.5 13.5"/><path d="M4.6 7h4.8M7 4.6v4.8"/>' },
    zoomsel:   { c:'<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2 13.5 13.5"/><rect x="4.6" y="4.6" width="4.8" height="4.8" stroke-dasharray="1.3 1.2"/>' },
    freeze:    { raw:1, c:'<rect x="1.8" y="2.2" width="12.4" height="11.6" fill="#fff" stroke="currentColor"/><rect x="1.8" y="2.2" width="4.4" height="4.4" fill="#BDD7EE" stroke="currentColor" stroke-width=".8"/><path d="M10.6 6.4v5.2M8 9h5.2M9.3 7.1l2.6 3.8M11.9 7.1l-2.6 3.8" stroke="currentColor" fill="none" stroke-width=".9"/>' },
    split:     { c:'<rect x="1.8" y="2.2" width="12.4" height="11.6"/><path d="M8 2.2v11.6M1.8 8h12.4" stroke-dasharray="1.6 1.3"/>' },
    newwin:    { c:'<rect x="2" y="2.4" width="8.6" height="7.2" fill="#fff"/><path d="M2 4.4h8.6"/><rect x="5.4" y="6.4" width="8.6" height="7.2" fill="#fff"/><path d="M5.4 8.4H14"/>' },

    /* ---- misc app ---- */
    chartmove: { c:'<path d="M8 2.2v11.6M2.2 8h11.6M8 2.2 6.4 3.8M8 2.2l1.6 1.6M8 13.8l-1.6-1.6M8 13.8l1.6-1.6M2.2 8l1.6-1.6M2.2 8l1.6 1.6M13.8 8l-1.6-1.6M13.8 8l-1.6 1.6"/>' },
    sheetico:  { raw:1, c:'<rect x="2.4" y="1.8" width="11.2" height="12.4" fill="#fff" stroke="currentColor"/><rect x="2.4" y="1.8" width="11.2" height="2.6" fill="'+GRN+'" stroke="none"/><path d="M6.2 4.4v9.8M10 4.4v9.8M2.4 7.8h11.2M2.4 11h11.2" stroke="currentColor" fill="none" stroke-width=".8"/>' },
    warn:      { raw:1, c:'<path d="M8 1.8 14.4 13.6H1.6z" fill="'+YEL+'" stroke="currentColor"/><path d="M8 6v3.6M8 11.2v.4" stroke="currentColor" fill="none" stroke-width="1.3"/>' },
    doc:       { c:'<rect x="3.4" y="2" width="9.2" height="12" rx="1"/><path d="M5.4 5h5.2M5.4 7.6h5.2M5.4 10.2h5.2M5.4 12.8h3.2"/>' },
    csv:       { raw:1, c:'<rect x="2" y="1.8" width="12" height="12.4" fill="#fff" stroke="currentColor"/><path d="M3.6 4.6h8.8M3.6 6.8h8.8M3.6 9h8.8M3.6 11.2h8.8" stroke="#A5A5A5" fill="none" stroke-width="1"/><path d="M5.6 4.6 7.2 6.8M7.2 4.6 5.6 6.8" stroke="'+RED+'" fill="none"/>' },
    template:  { c:'<rect x="2.4" y="1.8" width="11.2" height="12.4"/><rect x="4" y="3.4" width="8" height="3.4"/><path d="M4 8.6h8M4 10.6h8M4 12.6h5"/>' },
    calendar:  { c:'<rect x="2.2" y="3" width="11.6" height="10.6" rx="1"/><path d="M2.2 5.8h11.6M5.2 1.8v2.4M10.8 1.8v2.4"/><path d="M4.4 8h1.6M7.2 8h1.6M10 8h1.6M4.4 10.6h1.6M7.2 10.6h1.6" stroke-width="1.4"/>' },
    todolist:  { c:'<rect x="2.4" y="1.8" width="11.2" height="12.4"/><path d="M4.4 4.6l.8.8 1.4-1.6M8 4.8h3.6M4.4 8l.8.8 1.4-1.6M8 8.2h3.6M4.4 11.4l.8.8 1.4-1.6M8 11.6h3.6"/>' },
    budget:    { c:'<circle cx="8" cy="8" r="6.2"/><path d="M8 3.6v8.8M10.4 5.4c-.6-.8-1.5-1.1-2.4-1.1-1.3 0-2.3.7-2.3 1.7 0 2.4 5 1.1 5 3.6 0 1.1-1.1 1.8-2.6 1.8-1 0-2-.4-2.6-1.2"/>' },
    drag:      { c:'<circle cx="6" cy="4" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="4" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="1" fill="currentColor" stroke="none"/>' },
    menu:      { c:'<circle cx="8" cy="3.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="8" cy="12.6" r="1.1" fill="currentColor" stroke="none"/>' },
  };

  const svgNS = 'http://www.w3.org/2000/svg';
  function svgIcon(name, cls) {
    const ic = ICONS[name] || ICONS.help;
    const vb = ic.vb || '0 0 16 16';
    return `<svg class="ico ${cls || ''}" viewBox="${vb}" aria-hidden="true" focusable="false">` +
      (ic.raw ? ic.c : `<g fill="none" stroke="currentColor" stroke-width="${ic.sw || 1.15}" stroke-linecap="round" stroke-linejoin="round">${ic.c}</g>`) +
      `</svg>`;
  }
  window.ICON_REG = ICONS;
  window.svgIcon = svgIcon;
  document.addEventListener('DOMContentLoaded', () => {
    const defs = document.createElementNS(svgNS, 'svg');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.style.position = 'absolute'; defs.style.display = 'none';
    for (const [name, ic] of Object.entries(ICONS)) {
      const s = document.createElementNS(svgNS, 'symbol');
      s.id = 'i-' + name; s.setAttribute('viewBox', ic.vb || '0 0 16 16');
      s.innerHTML = ic.raw ? ic.c : `<g fill="none" stroke="currentColor" stroke-width="${ic.sw || 1.15}" stroke-linecap="round" stroke-linejoin="round">${ic.c}</g>`;
      defs.appendChild(s);
    }
    document.body.appendChild(defs);
  });
})();
