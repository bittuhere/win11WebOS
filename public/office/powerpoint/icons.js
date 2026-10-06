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
   PowerPoint clone — icon library (proper hand-drawn SVG, no emojis)
   ========================================================================== */
(function () {
  const I = {};
  const S = (p, extra) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${p}</svg>`;
  const F = (p, vb) => `<svg viewBox="${vb || '0 0 16 16'}" fill="currentColor" stroke="none">${p}</svg>`;

  /* ---------- app chrome ---------- */
  I.pptlogo = `<svg viewBox="0 0 16 16"><rect width="16" height="16" rx="2.5" fill="#C43E1C"/><path d="M4 3.2h4.6A3.6 3.6 0 010 14H6.7v2.2H4V3.2zm2.7 2.5v3.1h1.7a1.55 1.55 0 000-3.1H6.7z" fill="#fff"/></svg>`;
  I.save = `<svg viewBox="0 0 16 16"><path d="M2.5 2.5h9L13.5 4.5v9h-11z" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M4.5 2.5h6V6h-6z" fill="currentColor" opacity=".45"/><rect x="4.5" y="8" width="7" height="5.5" fill="#fff" stroke="currentColor" stroke-width="1.1"/></svg>`;
  I.saveRed = `<svg viewBox="0 0 16 16"><path d="M2.5 2.5h9L13.5 4.5v9h-11z" fill="#fff" stroke="#444" stroke-width="1.1"/><path d="M4.5 2.5h6V6h-6z" fill="#C43E1C"/><rect x="4.5" y="8" width="7" height="5.5" fill="#fff" stroke="#444" stroke-width="1.1"/></svg>`;
  I.undo = S('<path d="M6.5 3.5L3 7l3.5 3.5"/><path d="M3.5 7h5a4 4 0 010 8H7"/>');
  I.redo = S('<path d="M9.5 3.5L13 7l-3.5 3.5"/><path d="M12.5 7h-5a4 4 0 000 8H9"/>');
  I.slideshow = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="9" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M6.8 5.2v4.6l4-2.3z" fill="currentColor"/><path d="M4.5 14h7M8 11.5V14" stroke="currentColor" stroke-width="1.1"/></svg>`;
  I.user = S('<circle cx="8" cy="5.2" r="2.7"/><path d="M2.8 13.7a5.3 5.3 0 0110.4 0"/>');
  I.rbup = S('<path d="M4 10l4-4 4 4"/>');
  I.rbdown = S('<path d="M4 6l4 4 4-4"/>');
  I.min = S('<path d="M3 12.5h10"/>');
  I.max = S('<rect x="3" y="3" width="10" height="10" rx=".5"/>');
  I.max2 = S('<rect x="4.5" y="2.5" width="9" height="9" rx=".5"/><path d="M2.5 13.5V4.5h1.5"/>');
  I.close = S('<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>');
  I.back = S('<path d="M9.5 3L5 8l4.5 5"/>', 'stroke-width="1.6"');
  I.pin = S('<path d="M9.5 2.5l4 4-2 .7-2.5 2.6-.8 2.4-2.9-2.9-3 3-.6-.6 3-3L1.7 5.8l2.4-.8 2.6-2.5z"/>');
  I.bulb = S('<path d="M8 1.8a4.2 4.2 0 00-2.6 7.5c.4.4.6 1 .6 1.7v.4h4v-.4c0-.7.3-1.3.6-1.7A4.2 4.2 0 008 1.8z"/><path d="M6.3 13h3.4M6.8 14.7h2.4"/>');
  I.search = S('<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2L14 14"/>');
  I.dd = F('<path d="M4.5 6.5L8 10l3.5-3.5z"/>');
  I.stark = `<svg viewBox="0 0 16 16"><path d="M8 1.5l1.8 4.2 4.5.4-3.4 3 1 4.4L8 11l-3.9 2.5 1-4.4-3.4-3 4.5-.4z" fill="#FFC000" stroke="#B8860B" stroke-width=".6"/></svg>`;
  I.wrench = S('<path d="M10.5 2.5l3 3L6 13l-3.5.5L3 10zM11.8 4.2l1 1"/>');
  I.check = S('<path d="M2.5 8.5l3.5 3.5 7.5-8"/>');

  /* ---------- clipboard ---------- */
  I.paste = `<svg viewBox="0 0 16 16"><rect x="3.5" y="2.8" width="9" height="11.2" rx=".8" fill="#fff" stroke="#444" stroke-width="1.1"/><rect x="5.8" y="1.4" width="4.4" height="2.4" rx="1" fill="#D9E8F5" stroke="#444" stroke-width="1"/><path d="M5.7 6.4h4.6M5.7 8.6h4.6M5.7 10.8h3.2" stroke="#C43E1C" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  I.cut = S('<circle cx="4.3" cy="4.5" r="1.8"/><circle cx="4.3" cy="11.5" r="1.8"/><path d="M5.7 5.7L14 12.9M5.7 10.3L14 3.1"/>');
  I.copy = `<svg viewBox="0 0 16 16"><rect x="5" y="4" width="8" height="10" rx=".7" fill="#fff" stroke="currentColor" stroke-width="1.15"/><path d="M11 4V2H3v10h2" fill="none" stroke="currentColor" stroke-width="1.15"/></svg>`;
  I.fmtpaint = S('<path d="M9.8 2.2l4 4L7 13H4v-3z"/><path d="M3 16h7"/><rect x="10.6" y="1.2" width="4" height="2.4" rx=".5" transform="rotate(45 12.6 2.4)"/>');

  /* ---------- slides group ---------- */
  I.newslide = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="9" rx=".8" fill="#fff" stroke="#444" stroke-width="1.1"/><rect x="3" y="4" width="6" height="1.6" fill="#C43E1C"/><rect x="3" y="6.6" width="10" height="1.1" fill="#9BB7D4"/><rect x="3" y="8.6" width="10" height="1.1" fill="#9BB7D4"/><path d="M12.6 11v4M10.6 13h4" stroke="#2E75B6" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  I.layout = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="13" height="12" rx=".8" fill="#fff" stroke="#444" stroke-width="1.1"/><rect x="3" y="3.5" width="10" height="1.7" fill="#C43E1C"/><rect x="3" y="6.5" width="4.6" height="6" fill="#BDD7EE" stroke="#8EAADB" stroke-width=".6"/><rect x="8.4" y="6.5" width="4.6" height="6" fill="#FBE5D6" stroke="#E3B9A0" stroke-width=".6"/></svg>`;
  I.reset = S('<path d="M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 1.5v3h-3"/><path d="M6 6.5h4M6 9.5h4"/>');
  I.dupslide = `<svg viewBox="0 0 16 16"><rect x="5" y="4.5" width="9.5" height="7.5" rx=".7" fill="#fff" stroke="#444" stroke-width="1.1"/><rect x="6.5" y="6" width="4" height="1.3" fill="#C43E1C"/><rect x="6.5" y="8.3" width="6.5" height="1" fill="#9BB7D4"/><path d="M3.5 12V2.5H12" fill="none" stroke="#666" stroke-width="1.1"/></svg>`;
  I.hideSlide = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="9" rx=".8" fill="#E7E6E6" stroke="#666" stroke-width="1.1" stroke-dasharray="2 1.4"/><path d="M3 13.5L13.5 3" stroke="#C0432B" stroke-width="1.3"/></svg>`;

  /* ---------- font group ---------- */
  I.aup = `<svg viewBox="0 0 16 16"><path d="M4 12L8 3.5 12 12M5.4 9h5.2" stroke="#444" stroke-width="1.3" fill="none"/><path d="M12.6 4.6l1.4-1.5 1.4 1.5" stroke="#C43E1C" stroke-width="1.2" fill="none"/></svg>`;
  I.adown = `<svg viewBox="0 0 16 16"><path d="M3 12L6.2 5.4 9.5 12M4.1 9.8h4.3" stroke="#444" stroke-width="1.2" fill="none"/><path d="M12.2 4.2l1.5 1.5 1.5-1.5" stroke="#C43E1C" stroke-width="1.2" fill="none"/></svg>`;
  I.aheight = `<svg viewBox="0 0 16 16"><path d="M4 13L8.5 2l4.5 11M5.6 9.3h5.8" stroke="#444" stroke-width="1.2" fill="none"/><path d="M13.6 2.2h2.2M13.6 11.8h2.2M14.7 2.2v9.6" stroke="#C43E1C" stroke-width="1" fill="none"/></svg>`;
  I.clearfmt = `<svg viewBox="0 0 16 16"><path d="M4 12.5L8 3.5l4 9M5.4 9.5h5.2" stroke="#444" stroke-width="1.2" fill="none"/><path d="M11 12l4 3M15 12l-4 3" stroke="#C0432B" stroke-width="1.3"/></svg>`;
  I.bold = F('<path d="M4 2h4.6a3 3 0 012 5.2A3.4 3.4 0 019.4 14H4zm2.4 2.2v3.2h2a1.6 1.6 0 000-3.2zm0 5.4v3.2h2.6a1.6 1.6 0 000-3.2z"/>');
  I.italic = F('<path d="M6.5 2.5L9.3 13.5h2.3L8.8 2.5zM11 2.5h3v1.8h-3zM4 12.2h3V14H4z" transform="translate(-1.5 0)"/>');
  I.underline = F('<path d="M4.5 2h2v5.3a1.9 1.9 0 003.8 0V2h2v5.4a3.9 3.9 0 01-7.8 0zM3.8 13h8.4v1.8H3.8z"/>');
  I.strike = F('<path d="M2 7.4h12v1.2H2zM5.2 6.6c-1-.4-1.5-1-1.5-1.9Q3.7 2.5 7 2.5c2.1 0 3.4 1 3.7 2.6l-1.7.5c-.2-.9-.9-1.4-2-1.4q-1.5 0-1.5 1c0 .6.6 1 1.7 1.3zm2.9 6.9c-2.3 0-3.7-1-4-2.7l1.8-.5c.2 1 1 1.5 2.2 1.5q1.6 0 1.6-1.1 0-.9-1.6-1.3l3.1.5q.4.7.4 1.3c0 1.5-1.3 2.3-3.5 2.3z"/>');
  I.shadowT = S('<path d="M4 11.5L7.5 3l3.5 8.5" stroke-width="1.2"/><path d="M7.5 5.1l3.5 8.4h1.6" opacity=".5"/><path d="M5.2 9h4.6" stroke-width="1.2"/><path d="M10.8 4h2.4v8" opacity=".45"/>');
  I.spacing = S('<path d="M5 4L8.5 4M5 8h6.5M5 12h4.5"/><path d="M12.8 2.5v11M11.3 4l1.5-1.8L14.3 4M11.3 12l1.5 1.8 1.5-1.8"/>');
  I.highlight = `<svg viewBox="0 0 16 16"><rect x="2.5" y="8.6" width="8" height="3" fill="#FFFF00"/><path d="M9.2 2.5l4.3 4.3-4 3.9-4.2-4.3z" fill="#E7E6E6" stroke="#444" stroke-width="1"/><path d="M3 13.8h10" stroke="#444" stroke-width="1"/></svg>`;
  I.fontcol = `<svg viewBox="0 0 16 16"><path d="M4.5 11.5L8 3l3.5 8.5M5.6 9h4.8" stroke="#444" stroke-width="1.2" fill="none"/><rect x="2" y="13" width="12" height="2.2" fill="#C0432B"/></svg>`;

  /* ---------- paragraph ---------- */
  I.al = `<svg viewBox="0 0 16 16"><path d="M2 3.5h12M2 6.5h7M2 9.5h12M2 12.5h7" stroke="currentColor" stroke-width="1.3"/></svg>`;
  I.ac = `<svg viewBox="0 0 16 16"><path d="M2 3.5h12M4.5 6.5h7M2 9.5h12M4.5 12.5h7" stroke="currentColor" stroke-width="1.3"/></svg>`;
  I.ar = `<svg viewBox="0 0 16 16"><path d="M2 3.5h12M7 6.5h7M2 9.5h12M7 12.5h7" stroke="currentColor" stroke-width="1.3"/></svg>`;
  I.aj = `<svg viewBox="0 0 16 16"><path d="M2 3.5h12M2 6.5h12M2 9.5h12M2 12.5h12" stroke="currentColor" stroke-width="1.3"/></svg>`;
  I.lspacing = S('<path d="M6.5 3.5h7M6.5 8h7M6.5 12.5h7"/><path d="M2.5 2v12M1 3.5L2.5 2 4 3.5M1 12.5L2.5 14 4 12.5"/>');
  I.bullets = S('<circle cx="2.6" cy="3.6" r="1.15" fill="#C43E1C" stroke="none"/><circle cx="2.6" cy="8" r="1.15" fill="#C43E1C" stroke="none"/><circle cx="2.6" cy="12.4" r="1.15" fill="#C43E1C" stroke="none"/><path d="M5.6 3.6H14M5.6 8H14M5.6 12.4H14"/>');
  I.numbering = S('<path d="M1.6 2.2h1.1v3h.9" stroke="#C43E1C"/><path d="M1.5 9.6c0-.9.7-1.4 1.5-1.4s1.4.4 1.4 1.1c0 1-1.3 1.3-1.4 2h1.5" stroke="#C43E1C" fill="none"/><path d="M6.5 3.6H14M6.5 8.9H14M6.5 12.6H14"/>');
  I.inddec = S('<path d="M8.5 3.5H14M8.5 8H14M8.5 12.5H14M5.5 4.5L3 7l2.5 2.5M1.5 3v11"/>');
  I.indinc = S('<path d="M4.5 3.5H14M4.5 8H14M4.5 12.5H14M3.5 4.5L6 7 3.5 9.5M2 3v11"/>');
  I.textdir = S('<rect x="2" y="2" width="12" height="12" rx=".8"/><path d="M6 11.5L8.5 4.5 11 11.5M6.7 9.4h3.6"/>', 'stroke-width="1.1"');
  I.aligntext = S('<rect x="2" y="2" width="12" height="12" rx=".8"/><path d="M4.5 5.5h7M4.5 8h7M7 10.5h2"/>', 'stroke-width="1.1"');
  I.twocont = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="13" height="12" rx=".8" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M4 4.5h3.4v7H4zM8.6 4.5H12v7H8.6z" fill="#9BB7D4"/></svg>`;

  /* ---------- drawing ---------- */
  I.shapesIc = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="6.5" height="6.5" fill="#FBE5D6" stroke="#C43E1C" stroke-width="1"/><path d="M11.7 1.8L15 8H8.4z" fill="#DEEAF6" stroke="#2E75B6" stroke-width="1"/><circle cx="5" cy="12" r="3" fill="#E2EFDA" stroke="#4C7628" stroke-width="1"/><path d="M9.5 9.5h5v5h-5z" fill="#FFF2CC" stroke="#BF9000" stroke-width="1"/></svg>`;
  I.arrange = `<svg viewBox="0 0 16 16"><circle cx="5" cy="5" r="3" fill="#DEEAF6" stroke="#2E75B6" stroke-width="1.1"/><rect x="7.5" y="7.5" width="6" height="6" fill="#FBE5D6" stroke="#C43E1C" stroke-width="1.1"/><circle cx="11" cy="3.2" r="2" fill="#E2EFDA" stroke="#4C7628" stroke-width="1"/></svg>`;
  I.quickstyles = `<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="6" height="6" fill="#2E75B6"/><rect x="8.5" y="1.5" width="6" height="6" fill="#fff" stroke="#2E75B6" stroke-width="1.3"/><rect x="1.5" y="8.5" width="6" height="6" fill="#fff" stroke="#C43E1C" stroke-width="1.3"/><rect x="8.5" y="8.5" width="6" height="6" fill="#C43E1C"/></svg>`;
  I.group = S('<rect x="2" y="2" width="5" height="5" stroke="#2E75B6"/><rect x="9" y="9" width="5" height="5" stroke="#C43E1C"/><rect x="1" y="1" width="14" height="14" stroke-dasharray="2.2 1.8"/>');
  I.find = S('<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2L14 14"/>');
  I.replace = S('<circle cx="6.2" cy="6.2" r="3.9"/><path d="M9.2 9.2l2.6 2.6"/><path d="M11.4 12.4l1.4-1.4 2.2 2.2-1.4 1.4z"/>');
  I.select = S('<path d="M5 3l7.5 6-4.2.7L6 14z"/><rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke-dasharray="1.8 1.5"/>');

  /* ---------- insert ---------- */
  I.table = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="13" height="12" fill="#fff" stroke="#444" stroke-width="1.1"/><rect x="1.5" y="2" width="13" height="3.4" fill="#C43E1C"/><path d="M1.5 8.2h13M1.5 11.1h13M6 2v12M10.5 2v12" stroke="#999" stroke-width=".8"/></svg>`;
  I.pictures = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" rx=".8" fill="#EAF3EA" stroke="#444" stroke-width="1.1"/><circle cx="5.3" cy="6" r="1.4" fill="#FFC000"/><path d="M3 12.5l3.3-3.4 2.2 2.2 2.9-3 1.6 2v2.2H3z" fill="#548235"/></svg>`;
  I.textbox = `<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="10" fill="none" stroke="#444" stroke-width="1.1"/><path d="M3.6 5.2H9M3.6 8h8.8M3.6 10.8h6.5" stroke="#C43E1C" stroke-width="1.1"/></svg>`;
  I.wordart = `<svg viewBox="0 0 16 16"><path d="M4 12.5L8 2.5l4 10M5.4 9.2h5.2" stroke="#2E75B6" stroke-width="2.6" fill="none" opacity=".55"/><path d="M4 12.5L8 2.5l4 10M5.4 9.2h5.2" stroke="#1F4E79" stroke-width="1" fill="none"/></svg>`;
  I.headerfooter = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="13" height="12" rx=".8" fill="#fff" stroke="#444" stroke-width="1.1"/><rect x="3" y="3" width="5" height="1.7" fill="#2E75B6"/><rect x="8" y="11.3" width="5" height="1.7" fill="#C43E1C"/></svg>`;
  I.slidenum = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" rx=".8" fill="#fff" stroke="#444" stroke-width="1.1"/><text x="6" y="10.6" font-family="Segoe UI" font-size="7" fill="#444" stroke="none">#</text></svg>`;
  I.symbol = `<svg viewBox="0 0 16 16"><path d="M8.3 4.6c1 0 1.9.6 2.3 1.5l1.5-.5C11.6 4 10.1 3 8.3 3 5.4 3 3 5.2 3 8s2.4 5 5.3 5c1.8 0 3.3-1 3.8-2.6l-1.5-.5c-.4.9-1.3 1.5-2.3 1.5-1.9 0-3.4-1.5-3.4-3.4s1.5-3.4 3.4-3.4z" fill="#444"/><path d="M12 8.5l1.2 2.4 2.6.3-2 1.8.6 2.6-2.4-1.3-2.4 1.3.6-2.6-2-1.8 2.6-.3z" fill="#FFC000" stroke="#B8860B" stroke-width=".5"/></svg>`;
  I.chartIc = `<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" fill="#fff" stroke="#444" stroke-width="1"/><rect x="3.5" y="8" width="2.5" height="4.5" fill="#4472C4"/><rect x="7" y="5.5" width="2.5" height="7" fill="#ED7D31"/><rect x="10.5" y="3" width="2.5" height="9.5" fill="#A5A5A5"/></svg>`;
  I.comment = `<svg viewBox="0 0 16 16"><path d="M2 2.5h12v8.5H8l-3.5 3v-3H2z" fill="#FFF2CC" stroke="#BF9000" stroke-width="1.1"/><path d="M4.2 5.4h7.6M4.2 7.7h5.4" stroke="#BF9000"/></svg>`;
  I.smartart = `<svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="2" fill="#2E75B6"/><circle cx="12.5" cy="3.5" r="2" fill="#C43E1C"/><circle cx="12.5" cy="12.5" r="2" fill="#548235"/><path d="M5.3 7.2l5.3-2.6M5.3 8.8l5.3 2.6" stroke="#888" stroke-width="1"/></svg>`;
  I.math = `<svg viewBox="0 0 16 16"><path d="M4 10h8M8 6v8" stroke="#444" stroke-width="1.4"/><circle cx="8" cy="3" r=".9" fill="#444"/></svg>`;

  /* ---------- design ---------- */
  I.slidesize = `<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="7.5" fill="#fff" stroke="#444" stroke-width="1.1"/><path d="M1.5 12.5h13M8 10.5v2" stroke="#888"/></svg>`;
  I.formatbg = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="13" height="12" fill="#FBE5D6" stroke="#C43E1C" stroke-width="1"/><path d="M9 12.8l4.7-4.7" stroke="#C43E1C" stroke-width="2.6" opacity=".5"/><path d="M9.8 6.2l2.4 2.4-5.4 5.4H4.4v-2.4z" fill="#fff" stroke="#444" stroke-width="1"/></svg>`;
  I.variants = `<svg viewBox="0 0 16 16"><circle cx="4.5" cy="5" r="2.8" fill="#4472C4"/><circle cx="11" cy="6.5" r="2.8" fill="#ED7D31" opacity=".9"/><circle cx="6.5" cy="11" r="2.8" fill="#70AD47" opacity=".85"/></svg>`;

  /* ---------- transitions ---------- */
  I.tr_none = S('<rect x="2" y="2.5" width="12" height="8"/><path d="M4 13.5L12 13.5M3.5 12L12.5 3.5" stroke="#C0432B"/>');
  I.tr_fade = `<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="8" rx=".6" fill="#fff" stroke="#888"/><rect x="3.2" y="3.7" width="5" height="1.4" fill="#C43E1C" opacity=".9"/><rect x="2" y="2.5" width="12" height="8" rx=".6" fill="#888" opacity=".22"/></svg>`;
  I.tr_push = `<svg viewBox="0 0 16 16"><rect x="3" y="3" width="9" height="7" fill="#fff" stroke="#888"/><path d="M12 12.5L16 14V9l-4 1.5z" fill="#C43E1C"/><path d="M9 12.5h4l7 1.5-7 1.5z" fill="none"/></svg>`;
  I.tr_wipe = `<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="8" rx=".6" fill="#fff" stroke="#888"/><path d="M9 2.5l5 8H9z" fill="#C43E1C" opacity=".85"/></svg>`;
  I.tr_split = `<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="8" rx=".6" fill="#fff" stroke="#888"/><path d="M8 3v7M14 6l-3 .5 3 .5M2 6l3 .5-3 .5" stroke="#C43E1C" stroke-width="1.1" fill="none"/></svg>`;
  I.tr_blinds = `<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="8" fill="#fff" stroke="#888"/><path d="M4.4 2.5v8M7 2.5v8M9.6 2.5v8M12.2 2.5v8" stroke="#C43E1C" stroke-width="1.1"/></svg>`;
  I.tr_checker = `<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="8" fill="#fff" stroke="#888"/><path d="M2 2.5h4v4H2zm8 0h4v4h-4zM6 6.5h4v4H6z" fill="#C43E1C" opacity=".85"/></svg>`;
  I.tr_dissolve = `<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="8" fill="#fff" stroke="#888"/><path d="M4 4h1.4v1.4H4zm4 0h1.4v1.4H8zm4 2h1.4v1.4H12zM6 6.5h1.4v1.4H6zm4 2.4h1.4v1.4H10zM4.5 8.6h1.4V10H4.5z" fill="#C43E1C"/></svg>`;
  I.tr_more = S('<path d="M3 3l2.5 2.5L8 3M3 8h3M13 8h-3M13 3l-2.5 2.5L8 3M3 13l3-3M13 13l-3-3"/>');
  I.effectopt = S('<rect x="2" y="2.5" width="12" height="8" rx=".6"/><path d="M8 2.5v8M2 6.5h12" stroke-dasharray="1.8 1.4"/>');
  I.duration = S('<circle cx="8" cy="8" r="5.8"/><path d="M8 4.8V8l2.3 1.7"/>');
  I.applyall = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="9" height="6" rx=".5" fill="#fff" stroke="#888"/><rect x="5.5" y="7.5" width="9" height="6" rx=".5" fill="#fff" stroke="#888"/><path d="M8 3.5l1.5 3 3.2.3-2.4 2.1.8 3.1L8 10.2l-3.1 1.8.8-3.1-2.4-2.1 3.2-.3z" fill="#FFC000" stroke="#B8860B" stroke-width=".5" transform="translate(2.2 2)"/></svg>`;
  I.advance = S('<path d="M3 8a4.5 4.5 0 018.8-1.2M13 8a4.5 4.5 0 01-8.8 1.2"/><path d="M11.8 3.5v3.3H8.5M4.2 9.2v3.3h3.3"/>');

  /* ---------- animations ---------- */
  I.an_appear = `<svg viewBox="0 0 16 16"><path d="M8 2l1.5 3.4L13 5.8l-2.7 2.4.8 3.5L8 9.9 4.9 11.7l.8-3.5L3 5.8l3.5-.4z" fill="#FFD966" stroke="#BF9000" stroke-width=".7"/></svg>`;
  I.an_fade = I.an_appear;
  I.an_flyin = `<svg viewBox="0 0 16 16"><path d="M8 1.5l1.4 3.2 3.4.3-2.5 2.2.7 3.3L8 8.7 5 10.5l.7-3.3-2.5-2.2 3.4-.3z" fill="#9DC3E6" stroke="#2E75B6" stroke-width=".7"/><path d="M8 10.5v3.5M6 12.5l2 2 2-2" stroke="#2E75B6" stroke-width=".9" fill="none"/></svg>`;
  I.an_floatin = `<svg viewBox="0 0 16 16"><path d="M8 3.5l1.2 2.6 2.9.3-2.1 1.9.6 2.8L8 9.6l-2.6 1.5.6-2.8-2.1-1.9 2.9-.3z" fill="#A9D18E" stroke="#548235" stroke-width=".7"/><path d="M6.6 1.2c.9.9 1.9.9 2.8 0M6.6 13.8c.9-.9 1.9-.9 2.8 0" stroke="#548235" stroke-width=".9" fill="none"/></svg>`;
  I.an_split = `<svg viewBox="0 0 16 16"><path d="M8 1.5l1.4 3.2 3.4.3-2.5 2.2.7 3.3L8 8.7 5 10.5l.7-3.3-2.5-2.2 3.4-.3z" fill="#B4C7E7" stroke="#2E75B6" stroke-width=".7"/><path d="M1.5 8h4M14.5 8h-4M3 6.4L1.5 8l1.5 1.6M13 6.4L14.5 8 13 9.6" stroke="#2E75B6" stroke-width=".9" fill="none"/></svg>`;
  I.an_wipe = `<svg viewBox="0 0 16 16"><path d="M8 1.8l1.4 3.1 3.4.3-2.5 2.2.7 3.3L8 8.9l-3 1.8.7-3.3-2.5-2.2 3.4-.3z" fill="#F4B183" stroke="#C0432B" stroke-width=".7"/><path d="M11.5 10.5h3v3h-3z" fill="none" stroke="#C0432B" stroke-width=".9" stroke-dasharray="1.2 1"/></svg>`;
  I.an_zoom = `<svg viewBox="0 0 16 16"><path d="M8 2.5l1.3 2.9 3.1.3-2.3 2 .7 3L8 9l-2.7 1.7.7-3-2.3-2 3.1-.3z" fill="#C5E0B4" stroke="#548235" stroke-width=".7"/><circle cx="8" cy="6.7" r="5.4" fill="none" stroke="#548235" stroke-width=".8" stroke-dasharray="1.6 1.4"/></svg>`;
  I.an_pulse = `<svg viewBox="0 0 16 16"><path d="M8 2.5l1.3 2.9 3.1.3-2.3 2 .7 3L8 9l-2.7 1.7.7-3-2.3-2 3.1-.3z" fill="#FFE699" stroke="#BF9000" stroke-width=".7" transform="scale(.82) translate(1.7 .9)"/><path d="M8 1.5l1.4 3.2 3.4.3-2.5 2.2.7 3.3L8 8.7 5 10.5l.7-3.3-2.5-2.2 3.4-.3z" fill="none" stroke="#BF9000" stroke-width=".7"/></svg>`;
  I.an_grow = `<svg viewBox="0 0 16 16"><path d="M8 4.5l1 2.3 2.5.2-1.9 1.6.6 2.5L8 9.7l-2.2 1.4.6-2.5-1.9-1.6 2.5-.2z" fill="#A9D18E" stroke="#548235" stroke-width=".7"/><path d="M2.5 10.5L6 10M13.5 10.5L10 10M2.5 5.5L5 7M13.5 5.5L11 7" stroke="#548235" stroke-width=".9"/></svg>`;
  I.an_spin = `<svg viewBox="0 0 16 16"><path d="M8 2.5l1.3 2.9 3.1.3-2.3 2 .7 3L8 9l-2.7 1.7.7-3-2.3-2 3.1-.3z" fill="#9DC3E6" stroke="#2E75B6" stroke-width=".7"/><path d="M13 11.5a5.7 5.7 0 01-9.7 1.3M3 10.2l-.4 3 2.9-.8" stroke="#2E75B6" stroke-width=".9" fill="none"/></svg>`;
  I.an_disappear = `<svg viewBox="0 0 16 16"><path d="M8 2l1.5 3.4L13 5.8l-2.7 2.4.8 3.5L8 9.9 4.9 11.7l.8-3.5L3 5.8l3.5-.4z" fill="#F0F0F0" stroke="#999" stroke-width=".7" stroke-dasharray="1.6 1.3"/></svg>`;
  I.an_exitfade = I.an_disappear;
  I.an_flyout = `<svg viewBox="0 0 16 16"><path d="M8 3.5l1.4 3.2 3.4.3-2.5 2.2.7 3.3L8 10.7 5 12.5l.7-3.3-2.5-2.2 3.4-.3z" fill="#F4B183" stroke="#C0432B" stroke-width=".7"/><path d="M8 .7V4M6.6 2L8 .4 9.4 2" stroke="#C0432B" stroke-width=".9" fill="none"/></svg>`;
  I.addanim = `<svg viewBox="0 0 16 16"><path d="M7 2.5l1.3 2.9 3.1.3L9.1 7.7l.7 3-2.8-1.7-2.8 1.7.7-3-2.3-2 3.1-.3z" fill="#FFD966" stroke="#BF9000" stroke-width=".7"/><path d="M11.8 9.2v4.4M9.6 11.4h4.4" stroke="#548235" stroke-width="1.3"/></svg>`;
  I.animpane = `<svg viewBox="0 0 16 16"><path d="M4.5 2.5l1 2.3 2.5.2-1.9 1.6.6 2.5-2.2-1.4-2.2 1.4.6-2.5-1.9-1.6 2.5-.2z" fill="#FFD966" stroke="#BF9000" stroke-width=".6"/><path d="M9.5 3.5H15M9.5 7.5H15M9.5 11.5H15" stroke="#888" stroke-width="1.2"/></svg>`;
  I.play = F('<path d="M4 2.5v11l9-5.5z" fill="#548235"/>');
  I.playall = F('<path d="M6.5 2.5v11l8-5.5zM3 2.5v11h2V2.5z" fill="#548235"/>');
  I.timing = S('<circle cx="8" cy="8" r="5.8"/><path d="M8 4.8V8l2.3 1.7"/>');

  /* ---------- review ---------- */
  I.spelling = `<svg viewBox="0 0 16 16"><path d="M2.5 8.5L6.5 12.5 13.5 4" stroke="#548235" stroke-width="1.6" fill="none"/><path d="M2 4.5h1.4l2.1 5.7M2.8 8.4h3" stroke="#444" stroke-width="1.1" fill="none" transform="translate(8.6 2.6) scale(.75)"/></svg>`;
  I.commentNew = `<svg viewBox="0 0 16 16"><path d="M2 2.5h12v8.5H8l-3.5 3v-3H2z" fill="#FFF2CC" stroke="#BF9000" stroke-width="1.1"/><path d="M8 4.5v4M6 6.5h4" stroke="#BF9000" stroke-width="1.2"/></svg>`;
  I.commentDel = `<svg viewBox="0 0 16 16"><path d="M2 2.5h12v8.5H8l-3.5 3v-3H2z" fill="#FFF2CC" stroke="#BF9000" stroke-width="1.1"/><path d="M5.8 4.8l4.4 4.4M10.2 4.8l-4.4 4.4" stroke="#C0432B" stroke-width="1.2"/></svg>`;
  I.commentShow = I.comment;
  I.compare = S('<rect x="1.5" y="2" width="6" height="9" rx=".5"/><rect x="8.5" y="5" width="6" height="9" rx=".5"/><path d="M6 11.5h2.5"/>');

  /* ---------- view ---------- */
  I.vNormal = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="13" height="12" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="2.7" y="3.2" width="3.6" height="8.2" fill="currentColor" opacity=".28"/><rect x="7" y="3.2" width="6.3" height="6.2" fill="currentColor" opacity=".55"/></svg>`;
  I.vSorter = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="6" height="4.5" fill="#fff" stroke="currentColor" stroke-width="1.1"/><rect x="8.5" y="2.5" width="6" height="4.5" fill="#fff" stroke="currentColor" stroke-width="1.1"/><rect x="1.5" y="9" width="6" height="4.5" fill="#fff" stroke="currentColor" stroke-width="1.1"/><rect x="8.5" y="9" width="6" height="4.5" fill="#fff" stroke="currentColor" stroke-width="1.1"/></svg>`;
  I.vReading = `<svg viewBox="0 0 16 16"><path d="M8 3.2C6.5 2.1 4.3 1.9 2.5 2.4v10.3c1.8-.5 4-.3 5.5.8 1.5-1.1 3.7-1.3 5.5-.8V2.4C11.7 1.9 9.5 2.1 8 3.2z" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M8 3.2v10.3" stroke="currentColor" stroke-width="1"/></svg>`;
  I.vShow = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="9" rx="1" fill="currentColor" opacity=".9"/><path d="M4.5 14h7M8 11.5V14" stroke="currentColor" stroke-width="1.2"/></svg>`;
  I.vShowSmall = `<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.4 5.3v3.4l3-1.7z" fill="currentColor"/></svg>`;
  I.ruler = `<svg viewBox="0 0 16 16"><rect x="1.5" y="5.5" width="13" height="5" fill="#fff" stroke="#444" stroke-width="1.1"/><path d="M4 5.5v2.2M6.5 5.5v2.2M9 5.5v2.2M11.5 5.5v2.2M14 5.5v2.2" stroke="#444" stroke-width=".8"/></svg>`;
  I.gridlines = `<svg viewBox="0 0 16 16"><path d="M2 5.2h12M2 8h12M2 10.8h12M5.2 2v12M8 2v12M10.8 2v12" stroke="#888" stroke-width=".9"/></svg>`;
  I.guides = S('<path d="M8 1.5v13M1.5 8h13" stroke-dasharray="2.4 1.8"/>');
  I.zoom = S('<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2L14 14M4.8 7h4.4M7 4.8v4.4"/>');
  I.fit = S('<rect x="2.5" y="2.5" width="11" height="7" rx=".5"/><path d="M4.8 12.8L2 15.6M11.2 12.8l2.8 2.8M4.8 3.2L2 .4M11.2 3.2L14 .4"/>');
  I.hundred = S('<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2L14 14"/><path d="M5.2 6.2c0-.9.7-1.5 1.8-1.5s1.8.6 1.8 1.5-0.7 1.5-1.8 1.5-1.8-.6-1.8-1.5z" stroke-width=".9"/>');

  /* ---------- backstage / misc ---------- */
  I.open = `<svg viewBox="0 0 16 16"><path d="M1.5 4.5A1.5 1.5 0 013 3h3.4l1.4 1.7h6.7v7.8a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 01-1.5-1.5z" fill="#FFD966" stroke="#BF9000" stroke-width="1"/><path d="M1.5 6.5h13l-1.6 6.4a1.4 1.4 0 01-1.4 1.1H3A1.5 1.5 0 011.5 12.5z" fill="#FFE699" stroke="#BF9000" stroke-width="1"/></svg>`;
  I.info = S('<circle cx="8" cy="8" r="6"/><path d="M8 7.2V12M8 4.4v.4"/>');
  I.print = S('<path d="M4.5 6V2.5h7V6"/><rect x="2.5" y="6" width="11" height="5.5" rx="1"/><rect x="4.5" y="9.5" width="7" height="4.5" fill="#fff"/><circle cx="11.9" cy="7.6" r=".6" fill="currentColor" stroke="none"/>');
  I.exportIc = S('<path d="M8 9.5V1.5M5 4l3-3 3 3"/><path d="M3 9.5v4.5h10V9.5"/>');
  I.upload = S('<path d="M8 11V3M5 6l3-3 3 3"/><path d="M2.5 13.5h11"/>');
  I.download = S('<path d="M8 3v8M5 8.5L8 11.5l3-3"/><path d="M2.5 13.5h11"/>');
  I.account = S('<circle cx="8" cy="5.4" r="3"/><path d="M2.5 13.8a5.6 5.6 0 0111 0"/><circle cx="8" cy="8" r="7" stroke-dasharray="2 1.6"/>');
  I.feedback = S('<path d="M2.5 2.5h11v8h-7l-4 3.2z"/><path d="M8 4.2v3M8 8.7v.6"/>');
  I.options = S('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5l.9 1.8 2-.3 1 1.7 1.8.8-.3 2 1.4 1.5-1.4 1.5.3 2-1.8.8-1 1.7-2-.3L8 16.5 7.1 14.7l-2 .3-1-1.7-1.8-.8.3-2L1.2 9l1.4-1.5-.3-2 1.8-.8 1-1.7 2 .3z"/>');
  I.help = S('<circle cx="8" cy="8" r="6.2"/><path d="M6.1 5.6c.2-1 1-1.6 2-1.6 1 0 1.9.6 1.9 1.6 0 1.4-1.6 1.5-1.6 2.8M8.4 11.4v.6"/>');
  I.clock = S('<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.8"/>');
  I.del = S('<path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 10h6.6L12 4M6.6 6.5v5M9.4 6.5v5"/>');
  I.plus = S('<rect x="2" y="2" width="12" height="12" rx="1"/><path d="M8 5v6M5 8h6"/>');
  I.editDoc = S('<path d="M9.9 3.1l3 3L6 13l-3.5.5L3 10z"/><path d="M11.2 4.4l1 1" opacity=".7"/>');
  I.link = S('<path d="M6.5 9.5a3 3 0 004.2 0l1.9-1.9a3 3 0 00-4.2-4.2l-.9.9"/><path d="M9.5 6.5a3 3 0 00-4.2 0l-1.9 1.9a3 3 0 004.2 4.2l.9-.9"/>');
  I.image = I.pictures;
  I.notesIc = `<svg viewBox="0 0 16 16"><rect x="2.5" y="1.5" width="11" height="13" rx=".7" fill="#fff" stroke="#444" stroke-width="1.1"/><path d="M4.5 4.5h7M4.5 6.8h7M4.5 9.1h7M4.5 11.4h4.5" stroke="#888"/></svg>`;
  I.abcd = `<svg viewBox="0 0 16 16"><path d="M2 12L5 4.5 8 12M3 9.7h4M8.6 12l2.1-5.3L13 12M9.7 9.9h2.2" stroke="#444" stroke-width="1.1" fill="none"/></svg>`;
  I.center = `<svg viewBox="0 0 16 16"><rect x="1.5" y="2" width="13" height="12" rx=".8" fill="none" stroke="#444" stroke-width="1.1"/><rect x="5" y="5" width="6" height="6" fill="#BDD7EE" stroke="#2E75B6"/></svg>`;
  I.textWr = S('<rect x="2" y="2" width="12" height="12" rx=".8"/><path d="M4 5h8M4 8h4M4 11h6"/>', 'stroke-width="1.05"');
  I.noanim = `<svg viewBox="0 0 16 16"><path d="M8 2l1.5 3.4L13 5.8l-2.7 2.4.8 3.5L8 9.9 4.9 11.7l.8-3.5L3 5.8l3.5-.4z" fill="none" stroke="#999" stroke-width=".8"/><path d="M3 13.5L13 2.5" stroke="#C0432B" stroke-width="1.2"/></svg>`;
  I.moreShapes = S('<path d="M2.5 9.5h4l1.5-5 1.5 8 1.5-5H14"/>');
  I.ellipsis = F('<circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/>');
  I.rotate = S('<path d="M13.2 8a5.2 5.2 0 11-1.5-3.7M13.2 1.6v3h-3"/>');
  I.crop = S('<path d="M5 1.5V11H14.5M1.5 5H11v9.5M11 5h3.5M5 11H1.5"/>');
  I.compress = S('<path d="M9 2H4.5A1.5 1.5 0 003 3.5v9A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V6zM9 2v4h4"/><path d="M7.2 12a2 2 0 002-1.1V9.6a2 2 0 00-2-1.1zm0 0c-.8 0-1.4-.6-1.4-1.3s.6-1.2 1.4-1.2z"/>');
  I.recolor = S('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5A5.5 5.5 0 018 13.5z" fill="currentColor" opacity=".35"/>');
  I.resetPic = S('<rect x="2" y="2.5" width="12" height="9" rx=".8"/><path d="M12.6 11.5a4.4 4.4 0 01-8-2M12.2 7.5l.6 3-3-.5" fill="none"/>');
  I.setup = S('<rect x="2" y="2.5" width="12" height="8.5" rx=".8"/><circle cx="8" cy="6.8" r="1.5"/><path d="M5 14h6M8.6 3.2l.9-1M5.5 4L6.4 3"/>');

  window.PPT_ICONS = I;
  window.svgIcon = function (name, attrs) {
    let s = I[name] || I.help;
    if (attrs) s = s.replace('<svg ', '<svg ' + attrs + ' ');
    return s;
  };
})();
