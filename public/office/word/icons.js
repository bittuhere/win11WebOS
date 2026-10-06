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
   Each icon: { c: svg inner markup, vb: viewBox, raw: if true, caller sets
   its own fills/strokes/text. Default group: fill:none stroke:currentColor
   stroke-width:1.15 linecap/linejoin round }
   ========================================================================== */
(function () {
  const T = 'font-family="Segoe UI,Segoe UI Symbol,Arial,sans-serif"';
  const ICONS = {
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
    paste:     { raw:1, c:'<rect x="2.2" y="4.4" width="6.4" height="9.4" fill="#fff" stroke="currentColor"/><path d="M3.6 7h3.6M3.6 9.2h3.6M3.6 11.4h3.6" stroke="#9E9C9A" fill="none"/><rect x="5.8" y="2.6" width="8.4" height="11.4" rx="1" fill="#fff" stroke="currentColor"/><rect x="8.3" y="1.2" width="3.4" height="2.5" rx=".8" fill="#4472C4" stroke="none"/><path d="M7.4 6.4h5.2M7.4 8.7h5.2M7.4 11h5.2" stroke="#7FA5D4" fill="none"/>' },
    cut:       { c:'<circle cx="4.4" cy="11.3" r="1.9"/><circle cx="11.6" cy="11.3" r="1.9"/><path d="M5.9 10.1 12.6 3.1"/><path d="M10.1 10.1 3.4 3.1"/>' },
    copy:      { c:'<rect x="2.8" y="2.4" width="7.8" height="10.4" rx="1"/><rect x="5.6" y="5.2" width="7.8" height="10.4" rx="1" fill="#fff"/>' },
    fpainter:  { c:'<path d="M3.2 2.4h9.6v3.6H3.2z"/><path d="M7.2 6v1.5h1.6V6"/><rect x="7.1" y="7.5" width="1.8" height="6.1" rx=".9"/>' },
    growfont:  { raw:1, c:'<text x="1.4" y="12.2" font-size="10.5" font-weight="600" fill="currentColor" '+T+'>A</text><path d="M11.8 9V2.6M9.8 4.6l2-2 2 2" fill="none" stroke="currentColor"/>' },
    shrinkfont:{ raw:1, c:'<text x="1.4" y="12.2" font-size="9" font-weight="600" fill="currentColor" '+T+'>A</text><path d="M11.8 2.6V9M9.8 7l2 2 2-2" fill="none" stroke="currentColor"/>' },
    clearfmt:  { raw:1, c:'<text x="1" y="12.2" font-size="10.5" font-weight="500" fill="currentColor" '+T+'>A</text><g transform="rotate(45 11.2 7.2)"><rect x="8.6" y="6.2" width="5.2" height="2.2" fill="#F4A6C1" stroke="currentColor" stroke-width=".7"/><rect x="8.6" y="4.6" width="5.2" height="1.6" fill="#FBDCE9" stroke="currentColor" stroke-width=".7"/></g><path d="M7.4 13.8h7" stroke="currentColor" fill="none"/>' },
    bold:      { raw:1, c:'<text x="4.2" y="12.6" font-size="12.5" font-weight="700" fill="currentColor" '+T+'>B</text>' },
    italic:    { raw:1, c:'<text x="6.6" y="12.6" font-size="12.5" font-weight="500" font-style="italic" fill="currentColor" '+T+'>I</text>' },
    under:     { raw:1, c:'<text x="4.2" y="11.6" font-size="12" fill="currentColor" '+T+'>U</text><path d="M4.2 14.3h7.6" stroke="currentColor" fill="none" stroke-width="1.2"/>' },
    strike:    { raw:1, c:'<text x="2.2" y="10.8" font-size="9.5" fill="currentColor" '+T+'>abc</text><path d="M2 8h12" stroke="currentColor" fill="none"/>' },
    sub:       { raw:1, c:'<text x="2.4" y="11.4" font-size="10.5" fill="currentColor" '+T+'>X</text><text x="10.4" y="14.4" font-size="7" fill="currentColor" '+T+'>2</text>' },
    sup:       { raw:1, c:'<text x="2.4" y="12.6" font-size="10.5" fill="currentColor" '+T+'>X</text><text x="10.4" y="8.2" font-size="7" fill="currentColor" '+T+'>2</text>' },
    effects:   { raw:1, c:'<circle cx="8" cy="8" r="6.6" fill="#DEEAF6"/><text x="4.7" y="11.9" font-size="10.5" font-weight="600" fill="#2B579A" '+T+'>A</text>' },
    achar:     { raw:1, c:'<text x="3" y="12.8" font-size="12.5" font-weight="500" fill="currentColor" '+T+'>A</text>' },
    marker:    { c:'<path d="M5.2 12.2 9.7 2.9l2.5 1.3-4.5 9.3z"/><path d="M4.4 13.8 5.5 12l2 1-1.1 2z" fill="currentColor" stroke="none"/>' },
    bucket:    { c:'<path d="M3.4 7.4 7.6 3.2l4.4 4.4-4.2 4.2z"/><path d="M11 6.6l1.6 1.6M13 9.6c.8 1 1.1 1.7 1.1 2.3a1.15 1.15 0 1 1-2.3 0c0-.6.4-1.3 1.2-2.3z" fill="currentColor" stroke="none"/>' },
    bullets:   { c:'<circle cx="3" cy="4" r="1.15" fill="currentColor" stroke="none"/><circle cx="3" cy="8" r="1.15" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.15" fill="currentColor" stroke="none"/><path d="M6.6 4h6.8M6.6 8h6.8M6.6 12h6.8" stroke-width="1.3"/>' },
    numbering: { raw:1, c:'<text x="1.4" y="5.6" font-size="5.6" fill="currentColor" '+T+'>1.</text><text x="1.4" y="9.6" font-size="5.6" fill="currentColor" '+T+'>2.</text><text x="1.4" y="13.6" font-size="5.6" fill="currentColor" '+T+'>3.</text><path d="M6 4.4h7.4M6 8.4h7.4M6 12.4h7.4" stroke="currentColor" fill="none" stroke-width="1.2"/>' },
    multilevel:{ c:'<circle cx="2.8" cy="4" r="1" fill="currentColor" stroke="none"/><path d="M5 4h6" stroke-width="1.2"/><circle cx="4.4" cy="8" r="1" fill="currentColor" stroke="none"/><path d="M6.8 8h6" stroke-width="1.2"/><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M8.6 12h5" stroke-width="1.2"/>' },
    outdent:   { c:'<path d="M6.4 4h7M6.4 8h7M6.4 12h7" stroke-width="1.3"/><path d="M4.6 5.8 2.4 8l2.2 2.2"/>' },
    indent:    { c:'<path d="M6.4 4h7M6.4 8h7M6.4 12h7" stroke-width="1.3"/><path d="M2.4 5.8 4.6 8 2.4 10.2"/>' },
    sort:      { raw:1, c:'<text x="1.6" y="6.8" font-size="8" fill="currentColor" '+T+'>A</text><text x="1.9" y="13.8" font-size="8" fill="currentColor" '+T+'>Z</text><path d="M11.2 3.2v9.4M8.9 10.3l2.3 2.3 2.3-2.3" stroke="currentColor" fill="none"/>' },
    pilcrow:   { raw:1, c:'<text x="3.6" y="13" font-size="13" fill="currentColor" font-family="Cambria Math,Georgia,serif">\u00B6</text>' },
    alignl:    { c:'<path d="M2.5 4h11M2.5 7.4h7M2.5 10.8h11M2.5 14.2h7" stroke-width="1.3"/>' },
    alignc:    { c:'<path d="M2.5 4h11M4.5 7.4h7M2.5 10.8h11M4.5 14.2h7" stroke-width="1.3"/>' },
    alignr:    { c:'<path d="M2.5 4h11M6.5 7.4h7M2.5 10.8h11M6.5 14.2h7" stroke-width="1.3"/>' },
    alignj:    { c:'<path d="M2.5 4h11M2.5 7.4h11M2.5 10.8h11M2.5 14.2h11" stroke-width="1.3"/>' },
    linesp:    { c:'<path d="M4.6 3v10M3 4.6 4.6 3l1.6 1.6M3 11.4 4.6 13l1.6-1.6"/><path d="M7.4 4h6.2M7.4 8h6.2M7.4 12h6.2" stroke-width="1.3"/>' },
    border:    { c:'<rect x="2.6" y="2.6" width="10.8" height="10.8"/><path d="M2.6 13.9h10.8" stroke-width="2.4"/>' },
    replace:   { c:'<path d="M3.2 5.4h8M8.9 3.2l2.3 2.2-2.3 2.2"/><path d="M12.8 10.6h-8M7.1 8.4l-2.3 2.2 2.3 2.2"/>' },
    selectall: { c:'<path d="M4.6 2.4v9.8l2.4-2.5h4.2z" fill="#fff"/><path d="M10 3.2h3.6M10 5.6h3.6M10.6 8h3" stroke-dasharray="1.2 1.2" stroke-width="1.1"/>' },
    table:     { c:'<rect x="2.4" y="3" width="11.2" height="10" rx=".4"/><path d="M6.1 3v10M9.8 3v10"/><path d="M2.4 6.3h11.2M2.4 9.6h11.2"/>' },
    picture:   { raw:1, vb:'0 0 20 20', c:'<rect x="2.2" y="3.2" width="15.6" height="13.6" rx="1" fill="#fff" stroke="currentColor"/><circle cx="6.8" cy="6.8" r="1.7" fill="#FFC000" stroke="none"/><path d="M2.2 16.2 7.2 9.8l3.4 4 2.4-2.6 4.8 4v1.6H2.2z" fill="#70AD47" stroke="none"/>' },
    link:      { c:'<rect x="1.8" y="6.1" width="7.6" height="3.7" rx="1.85" transform="rotate(-30 5.6 8)"/><rect x="6.6" y="6.1" width="7.6" height="3.7" rx="1.85" transform="rotate(-30 10.4 8)"/>' },
    symbol:    { raw:1, c:'<text x="2.6" y="12.6" font-size="12" fill="currentColor" font-family="Cambria Math,Georgia,serif">\u03A9</text>' },
    datetime:  { c:'<rect x="1.8" y="3.2" width="9.4" height="9.2" rx="1"/><path d="M1.8 5.8h9.4M4 2v2.4M9 2v2.4"/><circle cx="11.2" cy="10.6" r="3.2" fill="#fff"/><path d="M11.2 8.9v1.9l1.3.8"/>' },
    textbox:   { c:'<rect x="2.2" y="4" width="11.6" height="8" rx=".3"/><path d="M4.2 6.4h5.4M4.2 8.1h7.4M4.2 9.8h5"/>' },
    pagebreak: { c:'<rect x="4.6" y="2.2" width="6.8" height="11.6"/><path d="M1.6 8.4h2M5.2 8.4h2M8.8 8.4h2M12.4 8.4h2"/>' },
    blankpage: { c:'<rect x="4.2" y="2.2" width="7.6" height="11.6"/><path d="M8 6v4.2M5.9 8.1h4.2"/>' },
    coverpage: { raw:1, c:'<rect x="4.2" y="2.2" width="7.6" height="11.6" fill="#fff" stroke="currentColor"/><rect x="5.4" y="4.8" width="5.2" height="2.4" fill="#4472C4" stroke="none"/><path d="M5.4 9.4h5.2M5.4 10.9h3.4" stroke="#9E9C9A" fill="none"/>' },
    comment:   { c:'<path d="M2.4 3.2h11.2v7.2H8.4L5 13.6v-3.2H2.4z"/><path d="M4.4 5.6h7.2M4.4 7.8h4.8"/>' },
    spelling:  { raw:1, c:'<text x="1.2" y="8" font-size="8" font-style="italic" fill="currentColor" '+T+'>abc</text><path d="M6.8 12l2.2 2.2 4.6-5.4" stroke="currentColor" fill="none" stroke-width="1.3"/>' },
    wordcount: { raw:1, c:'<rect x="4.4" y="2.2" width="7.2" height="11.6" fill="#fff" stroke="currentColor"/><text x="5.4" y="6.6" font-size="4.4" fill="currentColor" '+T+'>1</text><text x="5.3" y="9.8" font-size="4.4" fill="currentColor" '+T+'>2</text><text x="5.3" y="13" font-size="4.4" fill="currentColor" '+T+'>3</text><path d="M7.6 6h3.2M7.6 9.2h3.2M7.6 12.4h3.2" stroke="#9E9C9A" fill="none"/>' },
    readmode:  { c:'<path d="M2.2 4c2-1.1 4-1.1 5.8.3 1.8-1.4 3.8-1.4 5.8-.3v8.8c-2-1.1-4-1.1-5.8.3-1.8-1.4-3.8-1.4-5.8-.3z"/><path d="M8 4.3v8.8"/>' },
    printlayout:{ c:'<rect x="4.4" y="2.2" width="7.2" height="11.6"/><rect x="6" y="4.4" width="4.4" height="7.2" stroke-dasharray="1.4 1.2"/>' },
    weblayout: { c:'<circle cx="8" cy="8" r="5.6"/><ellipse cx="8" cy="8" rx="2.4" ry="5.6"/><path d="M2.5 8h11"/>' },
    ruler:     { c:'<rect x="1.8" y="5.6" width="12.4" height="4.8"/><path d="M4 5.6v2.2M6 5.6v1.3M8 5.6v2.2M10 5.6v1.3M12 5.6v2.2"/>' },
    navpane:   { c:'<rect x="2.4" y="3" width="2.8" height="2.8"/><rect x="2.4" y="6.6" width="2.8" height="2.8"/><rect x="2.4" y="10.2" width="2.8" height="2.8"/><path d="M7 4.4h6.6M7 8h6.6M7 11.6h6.6"/>' },
    zoom:      { c:'<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2 13.5 13.5"/><path d="M7 5.2v3.6M5.2 7h3.6"/>' },
    zoom100:   { raw:1, c:'<text x="1" y="11.6" font-size="7.2" font-weight="600" fill="currentColor" '+T+'>100%</text>' },
    pagewidth: { c:'<path d="M2.6 4v8M13.4 4v8"/><path d="M7 5.8 5 8l2 2.2M9 5.8 11 8l-2 2.2"/>' },
    margins:   { c:'<rect x="4.2" y="2.2" width="7.6" height="11.6"/><path d="M6.4 6.4V4.6H8M8 4.6h0M8 11.4H6.4V9.6M9.8 4.6h1.6v1.8M11.4 9.8v1.6H9.8"/>' },
    orient:    { c:'<rect x="2.4" y="4.6" width="9.6" height="6.8"/><path d="M13.6 2.8a3.4 3.4 0 0 1-1.6 6.2M13.6 2.8 13.2 6M13.6 2.8h-3.6"/>' },
    size:      { c:'<rect x="3.4" y="2.6" width="6.6" height="10.8"/><path d="M9.6 13.6l4-4M13.6 12.4V9.6h-2.8"/>' },
    columns2:  { c:'<rect x="2.6" y="2.6" width="10.8" height="10.8"/><path d="M8 2.6v10.8"/>' },
    columns3:  { c:'<rect x="2.6" y="2.6" width="10.8" height="10.8"/><path d="M6.2 2.6v10.8M9.8 2.6v10.8"/>' },
    breaks:    { c:'<rect x="2.4" y="2.6" width="5.2" height="6.8"/><rect x="8.4" y="6.6" width="5.2" height="6.8" fill="#fff"/><path d="M5 10.8c0 1.8.8 2.6 2.6 3"/>' },
    toc:       { raw:1, c:'<path d="M2.4 4.4h6M2.4 8.4h6M2.4 12.4h6" stroke="currentColor" fill="none" stroke-width="1.3"/><path d="M10.2 4.4h2.2M10.2 8.4h2.2M10.2 12.4h2.2" stroke="currentColor" fill="none" stroke-dasharray="1 1.1"/><text x="13" y="6.4" font-size="5.4" fill="currentColor" '+T+'>1</text><text x="13" y="10.4" font-size="5.4" fill="currentColor" '+T+'>2</text><text x="13" y="14.4" font-size="5.4" fill="currentColor" '+T+'>3</text>' },
    footnote:  { raw:1, c:'<rect x="3.4" y="2.6" width="7" height="10.8" fill="#fff" stroke="currentColor"/><path d="M5 6h4M5 8h4M5 10h3" stroke="#9E9C9A" fill="none"/><text x="10.8" y="7.4" font-size="7" fill="currentColor" '+T+'>1</text>' },
    header:    { raw:1, c:'<rect x="3.6" y="2.2" width="8.8" height="11.6" fill="#fff" stroke="currentColor"/><rect x="5.4" y="4" width="5.2" height="1.9" fill="currentColor" opacity=".5" stroke="none"/>' },
    footer:    { raw:1, c:'<rect x="3.6" y="2.2" width="8.8" height="11.6" fill="#fff" stroke="currentColor"/><rect x="5.4" y="10.1" width="5.2" height="1.9" fill="currentColor" opacity=".5" stroke="none"/>' },
    pageno:    { raw:1, c:'<rect x="3.8" y="2.2" width="8.4" height="11.6" fill="#fff" stroke="currentColor"/><text x="6.1" y="10.6" font-size="7.5" fill="currentColor" '+T+'>#</text>' },
    indl:      { c:'<path d="M6 4h7.4M6 8h7.4M6 12h7.4" stroke-width="1.3"/><path d="M2.4 5.8 4.2 8 2.4 10.2"/>' },
    indr:      { c:'<path d="M2.6 4h7.4M2.6 8h7.4M2.6 12h7.4" stroke-width="1.3"/><path d="M13.6 5.8 11.8 8l1.8 2.2"/>' },
    themes:    { raw:1, c:'<text x="5.2" y="11" font-size="12" font-weight="600" fill="currentColor" '+T+'>A</text><rect x="2.2" y="12.9" width="2.7" height="2.5" fill="#4472C4" stroke="none"/><rect x="5.3" y="12.9" width="2.7" height="2.5" fill="#ED7D31" stroke="none"/><rect x="8.4" y="12.9" width="2.7" height="2.5" fill="#70AD47" stroke="none"/><rect x="11.5" y="12.9" width="2.3" height="2.5" fill="#FFC000" stroke="none"/>' },
    colors:    { raw:1, c:'<circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor"/><circle cx="5.8" cy="6" r="1.05" fill="#4472C4" stroke="none"/><circle cx="10.2" cy="5.8" r="1.05" fill="#ED7D31" stroke="none"/><circle cx="6.2" cy="10.3" r="1.05" fill="#70AD47" stroke="none"/><circle cx="10.4" cy="10" r="1.05" fill="#FFC000" stroke="none"/>' },
    fonts:     { raw:1, c:'<text x="2.2" y="12.2" font-size="11.5" fill="currentColor" '+T+'>A</text><text x="10.2" y="13" font-size="9" font-style="italic" fill="currentColor" '+T+'>a</text>' },
    paraspacing:{ c:'<path d="M2.4 4h8M2.4 8h8M2.4 12h8" stroke-width="1.3"/><path d="M13 2.4v11.2M11.6 3.8 13 2.4l1.4 1.4M11.6 12.2l1.4 1.4 1.4-1.4"/>' },
    pagecolor: { raw:1, c:'<rect x="3.8" y="2.6" width="8.4" height="10.8" fill="#fff" stroke="currentColor"/><rect x="8.9" y="2.6" width="3.3" height="10.8" fill="#4472C4" opacity=".65" stroke="none"/>' },
    watermark: { raw:1, c:'<rect x="4" y="2.2" width="8" height="11.6" fill="#fff" stroke="currentColor"/><text x="4.6" y="12.4" font-size="11" fill="#9DC3E6" transform="rotate(-32 8 9)" '+T+'>A</text>' },
    pageborders:{ c:'<rect x="4" y="2.2" width="8" height="11.6"/><rect x="5.7" y="4" width="4.6" height="8"/>' },
    help:      { raw:1, c:'<circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor"/><text x="6.2" y="11.4" font-size="9" fill="currentColor" '+T+'>?</text>' },
    feedback:  { c:'<circle cx="8" cy="8" r="5.8"/><circle cx="5.9" cy="6.6" r=".95" fill="currentColor" stroke="none"/><circle cx="10.1" cy="6.6" r=".95" fill="currentColor" stroke="none"/><path d="M5 9.6a3.6 3.6 0 0 0 6 0"/>' },
    about:     { c:'<circle cx="8" cy="8" r="5.8"/><path d="M8 7.4v4M8 5.1v.2" stroke-width="1.6"/>' },
    proof:     { raw:1, c:'<rect x="3" y="2.6" width="8" height="11" fill="#fff" stroke="currentColor"/><circle cx="11" cy="5" r="2.8" fill="#107C10" stroke="#fff" stroke-width=".8"/><path d="M9.7 5l1 1 1.8-2" stroke="#fff" fill="none"/>' },
    pen:       { c:'<path d="M2.6 13.4 10.8 2.8a1.5 1.5 0 0 1 2.1 0h0a1.5 1.5 0 0 1 0 2.1L4.5 14.4z"/><path d="M2.6 13.4l1.9 1-2.2.4z" fill="currentColor" stroke="none"/>' },
    highlighter:{ c:'<path d="M4.8 11.8 9.5 2.6l3 1.7-4.7 9.2-1.7 2.2-2.6-1.2z"/><path d="M5.6 13.9h3.4M12.6 4.9l1.2.7" stroke-width="1.1"/>' },
    eraser:    { c:'<g transform="rotate(33 8 8)"><rect x="4.2" y="4.4" width="7.8" height="4.4" rx=".8"/><path d="M4.2 7h7.8"/></g><path d="M3.2 13.8h9.6"/>' },
    lasso:     { c:'<ellipse cx="7" cy="7.2" rx="4.4" ry="3.4" stroke-dasharray="2 1.8"/><path d="M11 10.6c.9 1.1.7 2.4-.7 3"/>' },
    open:      { c:'<path d="M2 4.2h4.2L7.6 5.8H14v5.8a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 11.6z"/><path d="M2 6.8h12"/>' },
    folder:    { c:'<path d="M2 4.2h4.2L7.6 5.8H14v5.8a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 11.6z"/><path d="M2 6.8h12"/>' },
    newdoc:    { c:'<rect x="4.2" y="2.2" width="7.6" height="11.6"/><path d="M8 5.6v4.6M5.7 7.9h4.6"/>' },
    print:     { c:'<path d="M4.6 6V2.4h6.8V6"/><rect x="2.4" y="6" width="11.2" height="4.6" rx="1"/><rect x="4.4" y="9.2" width="7.2" height="4.4" fill="#fff"/><path d="M11.4 7.8h1.2"/>' },
    share:     { c:'<circle cx="4.4" cy="8" r="2"/><circle cx="11.6" cy="4.2" r="2"/><circle cx="11.6" cy="11.8" r="2"/><path d="M6.2 7.1 9.8 5M6.2 8.9l3.6 2.1"/>' },
    export:    { c:'<path d="M2.6 6.6v6.8h10.8V9.8"/><path d="M8.2 9.4V2.2M5.8 4.6 8.2 2.2l2.4 2.4"/>' },
    info:      { c:'<circle cx="8" cy="8" r="5.8"/><path d="M8 7.4v4M8 5.1v.2" stroke-width="1.6"/>' },
    options:   { c:'<circle cx="8" cy="8" r="2"/><path d="M8 1.8v2.1M8 12.1v2.1M1.8 8h2.1M12.1 8h2.1M3.7 3.7l1.5 1.5M10.8 10.8l1.5 1.5M12.3 3.7l-1.5 1.5M5.2 10.8l-1.5 1.5"/>' },
    update:    { c:'<path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.7"/><path d="M13.2 1.9v2.6h-2.6"/>' },
    email:     { c:'<rect x="2.2" y="3.6" width="11.6" height="8.8" rx=".6"/><path d="M2.6 4.4 8 9.2l5.4-4.8"/>' },
    pdf:       { raw:1, c:'<rect x="3.6" y="2.2" width="8.8" height="11.6" fill="#fff" stroke="currentColor"/><rect x="3.6" y="7" width="8.8" height="3.2" fill="#C43E1C" stroke="none"/><text x="4.9" y="9.4" font-size="2.6" fill="#fff" '+T+'>PDF</text>' },
    txtfile:   { c:'<rect x="3.8" y="2.2" width="8.4" height="11.6"/><path d="M5.6 5.4h4.8M5.6 7.4h4.8M5.6 9.4h4.8M5.6 11.4h2.8"/>' },
    caption:   { c:'<rect x="2.4" y="3" width="11.2" height="7"/><path d="M4 12.6h8"/>' },
    bookmark:  { c:'<path d="M4.2 2.2h7.6v11.6l-3.8-2.7-3.8 2.7z"/>' },
    remove:    { c:'<circle cx="8" cy="8" r="5.4"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"/>' },
    dlg:       { c:'<path d="M6.4 12.4l6-6M7.6 6.4h4.8v4.8"/>' },
    shapeset:  { c:'<rect x="2.4" y="4.5" width="10" height="7"/>' },
    sellipse:  { c:'<ellipse cx="8" cy="8" rx="5.5" ry="3.6"/>' },
    stri:      { c:'<path d="M8 3 13.6 13H2.4z"/>' },
    sarrow:    { c:'<path d="M2.6 8h8.6M8.2 4.6 11.6 8l-3.4 3.4"/>' },
    sline:     { c:'<path d="M2.6 13.4 13.4 2.6"/>' },
    sstar:     { c:'<path d="M8 2.6l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8L2.5 6.6l3.8-.5z"/>' },
    stext:     { c:'<rect x="2.4" y="4.5" width="11.2" height="7"/><path d="M4 6.6h4M4 8.2h5.4M4 9.8h3"/>' },
    clock:     { c:'<circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.4l2.3 1.5"/>' },
    flower:    { c:'<circle cx="8" cy="5" r="1.8"/><circle cx="5.5" cy="7.5" r="1.8"/><circle cx="10.5" cy="7.5" r="1.8"/><circle cx="6.4" cy="10.6" r="1.8"/><circle cx="9.6" cy="10.6" r="1.8"/><circle cx="8" cy="8" r="1.2"/>' },
  };

  function svgIcon(name, cls, vb) {
    const ic = ICONS[name];
    if (!ic) return '';
    const w = ic.sw || 1.15;
    const inner = ic.raw ? ic.c :
      `<g fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ic.c}</g>`;
    return `<svg class="ico ${cls || ''}" viewBox="${ic.vb || '0 0 16 16'}" aria-hidden="true">${inner}</svg>`;
  }

  window.ICONS = ICONS;
  window.svgIcon = svgIcon;

  // Inject <use>-compatible symbols into the document so static HTML can reference them
  function inject() {
    let s = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>';
    for (const [name, ic] of Object.entries(ICONS)) {
      const w = ic.sw || 1.15;
      const inner = ic.raw ? ic.c :
        `<g fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ic.c}</g>`;
      s += `<symbol id="i-${name}" viewBox="${ic.vb || '0 0 16 16'}">${inner}</symbol>`;
    }
    s += '</defs></svg>';
    document.body.insertAdjacentHTML('afterbegin', s);
  }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);
})();
