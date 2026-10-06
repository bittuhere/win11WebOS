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
   Excel clone — core application
   model | geometry | virtual render | selection | editing | recalc |
   clipboard | fill | sheets | ribbon | commands | menus | status bar
   ========================================================================== */
(function () {
'use strict';
const Calc = window.Calc;

/* ============================ 0. UTILS ============================ */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
function el(tag, attrs, html) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  if (html != null) e.innerHTML = html;
  return e;
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const X = window.X = {};
const PT = 96 / 72;

/* ============================ 1. ADDRESSING ============================ */
const a1 = (r, c) => Calc.idxToCol(c) + (r + 1);
const keyOf = (r, c) => r + ',' + c;
const rcOf = key => { const i = key.indexOf(','); return { r: +key.slice(0, i), c: +key.slice(i + 1) }; };
X.a1 = a1; X.keyOf = keyOf; X.rcOf = rcOf;

/* ============================ 2. STATE ============================ */
const MAXR = Calc.MAXR, MAXC = Calc.MAXC;
function newSheet(name) {
  return {
    name,
    cells: {},            // key -> {v,t,num,f,s}
    colW: {},             // c -> px at 100%
    rowH: {},             // r -> px at 100%
    hidC: {},             // c -> true (hidden)
    hidR: {},
    merges: [],           // [{r1,c1,r2,c2}]
    subOf: {},            // key -> masterKey (merge subordinates)
    tables: {},           // id -> {r1,c1,r2,c2,name,style,headerRow,filter:{col->[vals]}}
    validations: [],      // [{r1,c1,r2,c2,kind,min,max,list}]
    outline: [],          // [{axis:'r'|'c', at, size, collapsed}]
    charts: [],           // floating objects (charts/images/shapes/textboxes)
    notes: {},            // key -> text
    freeze: { r: 0, c: 0 },
  };
}
const state = {
  bookName: 'Book1',
  sheets: [newSheet('Sheet1')],
  active: 0,
  zoom: 1,
  showFormulas: false,
  showGrid: true,
  showHeads: true,
  showFxbar: true,
  dark: false,            // dark mode (persisted in IndexedDB as xc.theme)
  gridPrint: false,
  calcMode: 'auto',
  view: 'normal',         // normal | pbreak
  protected: false,       // active sheet protected
  protectPw: '',
  showNotes: false,
  printArea: null,        // {r1,c1,r2,c2} per book (active sheet)
  pageBreaks: [],         // rows where manual breaks inserted
  page: { size: 'Letter', w: 8.5, h: 11, orient: 'portrait', margins: { t: .75, r: .7, b: .75, l: .7 } },
  theme: { name: 'Office', accent: '#217346', colors: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] },
  fonts: 'Calibri',
  names: {},              // defined names: name -> {ref:'Sheet1!$A$1:$B$2'}
  fxd: false,
  circular: false,
  author: 'User',
  created: Date.now(),
  modified: Date.now(),
  sel: null,              // {a:{r,c}, b:{r,c}, type, ranges:[]}
  clipboard: null,
  editing: false,
  autosave: false,
  undoOn: true,
};
X.state = state;
const sheet = () => state.sheets[state.active];
X.sheet = sheet;

const DEFAULT_COLW = 64, DEFAULT_ROWH = 20;
const HDRW = 40, HDRH = 20;

/* fonts */
const FONTS = ['Calibri', 'Calibri Light', 'Cambria', 'Arial', 'Arial Narrow', 'Courier New', 'Georgia', 'Times New Roman', 'Consolas', 'Segoe UI', 'Tahoma', 'Verdana'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/* cell colors defaults */
state.colors = { fontcolor: '#C00000', bucket: '#FFFF00' };
X.FONTS = FONTS; X.SIZES = SIZES;

/* ============================ 3. CELL ACCESS ============================ */
function cellGet(r, c) { const cd = sheet().cells[keyOf(r, c)]; return cd || null; }
X.cellGet = cellGet;
function cellRaw(r, c) {
  const cd = cellGet(r, c);
  if (!cd) return undefined;
  if (cd.t === 'f') return cd.num;      // computed primitive
  if (cd.t === 'n') return (typeof cd.num === 'number') ? cd.num : parseFloat(cd.v);
  if (cd.t === 'b') return (typeof cd.num === 'boolean') ? cd.num : /true/i.test(String(cd.v));
  if (cd.t === 'e') return Calc.isErr(cd.num) ? cd.num : Calc.ERR(String(cd.num || cd.v || '#VALUE!'));
  return (cd.num !== null && cd.num !== undefined && cd.num !== '') ? cd.num : cd.v;
}
X.cellRaw = cellRaw;
function cellEnsure(r, c) {
  const k = keyOf(r, c);
  let cd = sheet().cells[k];
  if (!cd) { cd = { v: '', t: 's', num: '', f: null, s: null }; sheet().cells[k] = cd; }
  return cd;
}
function cellDelete(r, c) { delete sheet().cells[keyOf(r, c)]; }
X.cellEnsure = cellEnsure; X.cellDelete = cellDelete;

/* master cell for merges */
function mergeMasterOf(sh, r, c) {
  const sub = sh.subOf[keyOf(r, c)];
  return sub ? rcOf(sub) : null;
}
function mergeSpan(sh, r, c) {
  for (const m of sh.merges) if (m.r1 === r && m.c1 === c) return m;
  return null;
}
function mergeAt(sh, r, c) {
  for (const m of sh.merges) if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m;
  return null;
}
X.mergeAt = mergeAt; X.mergeSpan = mergeSpan;

/* ============================ 4. GEOMETRY ============================ */
let cpfx = null, cdeltas = [];
function rebuildGeom() {
  const sh = sheet();
  /* Ctrl+` Show Formulas: every column is twice as wide while the mode is on
     (Excel behavior), without mutating the real colW data */
  const fw = state.showFormulas ? 2 : 1;
  cpfx = new Float64Array(MAXC + 2);
  let y = 0;
  for (let c = 0; c <= MAXC; c++) {
    cpfx[c] = y;
    const w = sh.hidC[c] ? 0 : (sh.colW[c] != null ? sh.colW[c] : DEFAULT_COLW) * fw;
    y += w;
  }
  cpfx[MAXC + 1] = y;
  // sparse row deltas
  cdeltas = Object.entries(sh.rowH).map(([r, h]) => ({ r: +r, d: (sh.hidR[+r] ? 0 : h) - DEFAULT_ROWH }))
    .concat(Object.keys(sh.hidR).map(r => sh.rowH[+r] != null ? null : null).filter(Boolean));
  const hidOnly = Object.keys(sh.hidR).filter(r => sh.rowH[+r] == null).map(r => ({ r: +r, d: -DEFAULT_ROWH }));
  cdeltas = cdeltas.concat(hidOnly).sort((a, b) => a.r - b.r);
  let acc = 0;
  cdeltas.forEach(d => { acc += d.d; d.acc = acc; });
}
function colX(c) { return cpfx[c]; }
function colWpx(c) { return cpfx[c + 1] - cpfx[c]; }
function rowY(r) {
  if (!cdeltas.length) return r * DEFAULT_ROWH;
  // delta sum of entries with d.r < r
  let lo = 0, hi = cdeltas.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cdeltas[m].r < r) lo = m + 1; else hi = m; }
  const d = lo > 0 ? cdeltas[lo - 1].acc : 0;
  return r * DEFAULT_ROWH + d;
}
function rowHpx(r) { return rowY(r + 1) - rowY(r); }
function colAtX(x) { // unscaled x
  let lo = 0, hi = MAXC;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cpfx[m] <= x) lo = m; else hi = m - 1; }
  return lo;
}
function rowAtY(y) { // binary search over rowY
  let lo = 0, hi = MAXR - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rowY(m) <= y) lo = m; else hi = m - 1; }
  return lo;
}
const Z = () => state.zoom;
X.colX = colX; X.colWpx = colWpx; X.rowY = rowY; X.rowHpx = rowHpx; X.colAtX = colAtX; X.rowAtY = rowAtY; X.rebuildGeom = rebuildGeom;

/* spacer size */
function totalGeometry() {
  const z = Z();
  return { w: colX(MAXC + 1) * z + HDRW, h: rowY(MAXR) * z + HDRH };
}
function updateSpacer() {
  const g = totalGeometry();
  const sp = $('#grid-spacer');
  sp.style.width = Math.min(g.w, 33554400) + 'px';
  sp.style.height = Math.min(g.h, 33554400) + 'px';
}
X.updateSpacer = updateSpacer;

/* freeze geometry (scaled) */
function fzDims() {
  const sh = sheet(), z = Z();
  return { c: sh.freeze.c, r: sh.freeze.r, w: colX(sh.freeze.c) * z, h: rowY(sh.freeze.r) * z };
}

/* ============================ 5. VALUE / FORMAT RESOLUTION ============================ */
function cellDisplay(r, c) {
  // returns {text, t, color, err, raw}
  const cd = cellGet(r, c);
  if (!cd) return null;
  if (state.showFormulas && cd.t === 'f') return { text: cd.v, t: 's', color: '#333', raw: cd.v };
  let v, t;
  if (cd.t === 'f') { v = cd.num; t = typeof v === 'boolean' ? 'b' : typeof v === 'number' ? 'n' : Calc.isErr(v) ? 'e' : 's'; }
  else {
    t = cd.t;
    if (t === 'n') v = (typeof cd.num === 'number') ? cd.num : parseFloat(cd.v);
    else if (t === 'b') v = (typeof cd.num === 'boolean') ? cd.num : /true/i.test(String(cd.v));
    else if (t === 'e') v = cd.num;
    else v = (cd.num !== null && cd.num !== undefined && cd.num !== '') ? cd.num : cd.v;
  }
  if (t === 'n') {
    const r2 = Calc.fmt(v, cd.f);
    return r2.text === '' ? null : { text: r2.text, t: 'n', color: r2.color, raw: cd.v };
  }
  if (t === 'b') return { text: v ? 'TRUE' : 'FALSE', t: 'b', color: null, raw: cd.v };
  if (t === 'e') return { text: Calc.isErr(v) ? v.__err : String(v), t: 'e', color: '#C00000', raw: cd.v };
  if (v == null || v === '') return null;
  return { text: String(v), t: 's', color: null, raw: cd.v, spark: cd.spark };
}
X.cellDisplay = cellDisplay;

const measureCtx = document.createElement('canvas').getContext('2d');
/* canonical font stack — MUST match what cells render in CSS, so measurements are exact on any platform */
const CELLSTACK = `'Calibri','Segoe UI',sans-serif`;
function fontOf(s, zoom) {
  const fam = (s && s.font) ? `'${s.font}',${CELLSTACK}` : CELLSTACK;
  const size = ((s && s.size) || 11) * (zoom || 1);
  return `${s && s.i ? 'italic ' : ''}${s && s.b ? '700' : '400'} ${size}pt ${fam}`;
}
function textW(text, s, zoom) {
  measureCtx.font = fontOf(s, zoom);
  return measureCtx.measureText(String(text)).width;
}
/* exact DOM-based width (canvas measure runs ~8% narrow for Calibri) — used for text spill */
let domMeasureEl = null;
function textWdom(text, s, zoom) {
  if (!domMeasureEl) {
    domMeasureEl = document.createElement('span');
    domMeasureEl.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:nowrap;pointer-events:none';
    (document.body || document.documentElement).appendChild(domMeasureEl);
  }
  domMeasureEl.style.font = fontOf(s, zoom);
  domMeasureEl.textContent = String(text);
  return domMeasureEl.getBoundingClientRect().width;
}
X.textW = textW; X.fontOf = fontOf;

/* number width overflow -> ##### */
function fitNumeric(text, r, c, s, wAvail) {
  const sh = sheet();
  const w = colWpx(c) * Z();
  if (wAvail == null) wAvail = w;
  /* star-fill token: fmt() emits \uE000<char>\uE001 -> repeat <char> until the
     remaining cell width is filled (Excel's 0*- style filler) */
  const fm = text.match(/\uE000([\s\S])\uE001/);
  if (fm) {
    const ch = fm[1];
    let t2 = text.slice(0, fm.index) + ch + text.slice(fm.index + 3), guard = 0;
    while (textW(t2.slice(0, fm.index) + ch + t2.slice(fm.index + 1), s, Z()) < wAvail - 6 && guard++ < 200)
      t2 = t2.slice(0, fm.index) + ch + t2.slice(fm.index + 1);
    return t2;
  }
  if (textW(text, s, Z()) <= wAvail - 6) return text;
  // try shrinking decimals
  let t = text;
  const cd = cellGet(r, c);
  if (cd && cd.f && /\./.test(t)) {
    for (let cut = 0; cut < 8 && textW(t, s, Z()) > wAvail - 6; cut++) {
      const f2 = cd.f.replace(/\.([0#?]+)/, m => '.' + m.slice(1, Math.max(1, 1 + m.length - 1 - cut)));
      if (f2 === cd.f) break;
      t = Calc.fmt(cd.num, f2).text;
    }
    if (textW(t, s, Z()) <= wAvail - 6) return t;
  } else if (!cd || !cd.f) {
    /* Excel-parity for General (no custom format): a decimal number NEVER shows
       ### — displayed decimals are trimmed/rounded until the integer part (+dot)
       no longer fits; only then ###. Trims mantissa of scientific text too. */
    const m = /^-?(\d+)\.(\d+)(E[+-]\d+)?$/i.exec(t);
    if (m && cd && typeof cd.num === 'number') {
      const exp = m[3] || '';
      const mant = Math.abs(parseFloat(m[1] + '.' + m[2]));
      const neg = t[0] === '-' ? '-' : '';
      for (let d = m[2].length - 1; d >= 0 && textW(t, s, Z()) > wAvail - 6; d--) {
        if (exp) {
          t = neg + (d === 0 ? String(Math.round(mant))
            : mant.toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')) + exp.toUpperCase();
        } else {
          t = d === 0 ? String(Math.round(cd.num))
            : cd.num.toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
        }
      }
      if (textW(t, s, Z()) <= wAvail - 6) return t;
    }
  }
  let h = '###';
  while (textW(h, s, Z()) > wAvail - 6 && h.length > 1) h = h.slice(1);
  return Math.max(1, h.length) > 0 ? h : '###';
}

/* ============================ 6. RENDER ============================ */
const cellsLayer = () => $('#cells-layer');
const selLayer = () => $('#sel-layer');
let rafPending = false;
function requestRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; renderAll(); });
}
X.requestRender = requestRender;

function viewSize() {
  const gs = $('#grid-scroll');
  return { sl: gs.scrollLeft, st: gs.scrollTop, w: gs.clientWidth, h: gs.clientHeight };
}

/* computed display+css for a cell (shared across zones) */
function cellCSS(r, c, cd, d, spanW) {
  const s = (cd && cd.s) || {};
  const x = colX(c) * Z(), y = rowY(r) * Z();
  const w = (spanW != null ? spanW : colWpx(c) * Z());
  const h = (mergeSpan(sheet(), r, c) ? mergeH(r, c) : rowHpx(r) * Z());
  const css = [];
  css.push(`left:${x.toFixed(2)}px`, `top:${y.toFixed(2)}px`, `width:${w.toFixed(2)}px`, `height:${h.toFixed(2)}px`);
  const fs = ((s.size || 11) * Z()).toFixed(1);
  css.push(`font-size:${fs}pt`);
  css.push(`line-height:${(fs * 1.23).toFixed(1)}px`);
  if (s.font) css.push(`font-family:'${s.font}',${CELLSTACK}`);
  if (s.b) css.push('font-weight:700');
  if (s.i) css.push('font-style:italic');
  const dec = [];
  if (s.u) dec.push('underline');
  if (s.strike) dec.push('line-through');
  if (dec.length) css.push(`text-decoration:${dec.join(' ')}`);
  let color = d && d.color ? d.color : s.color || '';
  if (d && d.t === 'e') color = '#C00000';
  if (color) css.push(`color:${color}`);
  if (s.bg) css.push(`background:${s.bg}`);
  if (d) {
    const al = s.halign || (d.t === 'n' ? 'right' : d.t === 'b' || d.t === 'e' ? 'center' : 'left');
    css.push(`text-align:${al}`);
    if (al !== 'left' && (s.indent || 0) === 0) css.push('padding-right:3px');
  } else {
    css.push(`text-align:${s.halign || 'left'}`);
  }
  if (s.valign) css.push(`vertical-align:${s.valign === 'top' ? 'top' : s.valign === 'bottom' ? 'bottom' : 'middle'}`, 'display:flex', `flex-direction:column`, `justify-content:${s.valign === 'top' ? 'flex-start' : s.valign === 'bottom' ? 'flex-end' : 'center'}`);
  if (s.indent) css.push(`padding-left:${3 + s.indent * 9 * Z()}px`);
  // style borders override gridlines
  for (const side of ['bL', 'bR', 'bT', 'bB']) {
    const b = s[side];
    if (b && b.st) {
      const prop = side === 'bL' ? 'border-left' : side === 'bR' ? 'border-right' : side === 'bT' ? 'border-top' : 'border-bottom';
      css.push(`${prop}:${Math.round((b.w || 1) * Z())}px ${b.st} ${b.cl || '#000'}`);
    } else if (side === 'bL') css.push('border-left:none');
    else if (side === 'bT') css.push('border-top:none');
  }
  return css.join(';');
}
function mergeH(r, c) {
  const m = mergeSpan(sheet(), r, c);
  if (!m) return rowHpx(r) * Z();
  return (rowY(m.r2 + 1) - rowY(m.r1)) * Z();
}
function mergeW(r, c) {
  const m = mergeSpan(sheet(), r, c);
  if (!m) return colWpx(c) * Z();
  return (colX(m.c2 + 1) - colX(m.c1)) * Z();
}
X.mergeW = mergeW; X.mergeH = mergeH;

function renderZone(layerEl, r1, r2, c1, c2, zoneOX, zoneOY, clipX, clipY, clipW, clipH) {
  // coordinates passed are VISUAL (scaled, viewport-local)
  const sh = sheet();
  const parts = [];
  for (let r = r1; r <= r2; r++) {
    if (sh.hidR[r]) continue;
    for (let c = c1; c <= c2; c++) {
      if (sh.hidC[c]) continue;
      const sub = sh.subOf[keyOf(r, c)];
      if (sub) continue; // covered by master
      const cd = cellGet(r, c);
      const spanW = mergeSpan(sh, r, c) ? mergeW(r, c) : undefined;
      let d = cd ? cellDisplay(r, c) : null;
      // numeric overflow #####
      if (cd && d && d.t === 'n' && !((cd.s || {}).wrap)) {
        const wAvail = spanW != null ? spanW : colWpx(c) * Z();
        d = { ...d, text: fitNumeric(d.text, r, c, cd.s, wAvail) };
      }
      if (!cd && !d) continue;
      let cls = 'cell', extraHtml = null;
      const s = (cd && cd.s) || {};
      let noClip = false;
      if (d && s.wrap) cls += ' wrap';
      else if (d && !d.text.includes('\n')) {
        // spill check
        const al = s.halign || (d.t === 'n' ? 'right' : d.t === 'b' || d.t === 'e' ? 'center' : 'left');
        const tw = d.t === 's' ? textW(d.text, s, Z()) : 0;
        if (d.t === 's' && tw > colWpx(c) * Z() - 6 && !s.bg) {
          if (al === 'left') {
            if (spillFree(r, c + 1, 1)) noClip = true;
          } else if (al === 'right') {
            if (spillFree(r, c - 1, -1)) noClip = true;
          } else if (spillFree(r, c + 1, 1) && spillFree(r, c - 1, -1)) noClip = true;
        }
        if (!noClip && d.t !== 's') cls += ' nt';
      } else if (d) cls += ' nt';
      if (!noClip) cls = cls.includes('wrap') ? cls : cls;
      else cls += ' over';
      const css = cellCSS(r, c, cd, d, spanW);
      // zone offset & clip: main zone cells positioned with negative origins
      const x = parseFloat(css.match(/left:([\d.-]+)px/)[1]) - zoneOX;
      const y = parseFloat(css.match(/top:([\d.-]+)px/)[1]) - zoneOY;
      const w = parseFloat(css.match(/width:([\d.-]+)px/)[1]);
      // clip check
      if (x + w < -2 || x > clipW + 2 || y + parseFloat(css.match(/height:([\d.-]+)px/)[1]) < -2 || y > clipH + 2) continue;
      const css2 = css.replace(/left:[\d.-]+px/, `left:${x.toFixed(2)}px`).replace(/top:[\d.-]+px/, `top:${y.toFixed(2)}px`);
      let styleFinal = css2;
      if (noClip) {
        const overW = textW(d.text, s, Z()) + 10;
        const al = s.halign || 'left';
        const ow = al === 'right' ? -overW + w : 0;
        styleFinal += `;width:${overW.toFixed(2)}px;left:${(x + ow).toFixed(2)}px;z-index:2;background:${'#fff'}`;
        cls += ' nt';
      }
      let inner = d ? esc(d.text) : '';
      // sparklines
      if (cd && cd.spark && state.sparkRenders !== false) inner = sparkSVG(cd);
      // comment triangle
      const hasNote = sh.notes[keyOf(r, c)];
      parts.push(`<div class="${cls}" data-r="${r}" data-c="${c}" style="${styleFinal}">${inner}${hasNote ? '<span class="note-tri"></span>' : ''}</div>`);
    }
  }
  layerEl.innerHTML = parts.join('');
  layerEl.style.cssText = `position:absolute;left:${clipX}px;top:${clipY}px;width:${clipW}px;height:${clipH}px;overflow:hidden;pointer-events:${layerEl.id === 'cells-layer' ? 'none' : 'none'};`;
  if (!state.showGrid) layerEl.classList.add('no-grid'); else layerEl.classList.remove('no-grid');
}
function spillFree(r, c, dir) {
  const sh = sheet();
  while (c >= 0 && c <= MAXC) {
    if (colWpx(c) === 0) { c += dir; continue; }
    const cd = cellGet(r, c);
    if (cd) {
      const d = cellDisplay(r, c);
      if (d && d.text !== '') return false;
      if (cd.s && ((cd.s.bg && cd.s.bg !== '#fff' && cd.s.bg !== '#FFFFFF') || (cd.s.bR && cd.s.bR.st) || (cd.s.bL && cd.s.bL.st))) return false;
    }
    if (cellGet(r, c + dir)) {
      const nd = cellDisplay(r, c + dir);
      if (nd && nd.text !== '') return false;
    }
    if (cellDisplay(r, c + dir) == null) return true;
    c += dir;
  }
  return false;
}

/* sparkline svg */
function sparkSVG(cd) {
  const sp = cd.spark;
  const sh = sheet();
  const vals = [];
  for (let r = sp.r1; r <= sp.r2; r++) for (let c = sp.c1; c <= sp.c2; c++) { const v = cellRaw(r, c); vals.push(typeof v === 'number' ? v : null); }
  const nums = vals.map(v => v == null ? 0 : v);
  const min = Math.min(...nums), max = Math.max(...nums), rng = max - min || 1;
  const w = 100, h = 16;
  let inner = '';
  if (sp.type === 'line') {
    const pts = nums.map((v, i) => `${(i + 0.5) / nums.length * 100},${15 - (v - min) / rng * 12}`).join(' ');
    inner = `<polyline points="${pts}" fill="none" stroke="#2B78C5" stroke-width="1.4"/>`;
  } else {
    const bw = 100 / nums.length;
    inner = nums.map((v, i) => {
      const bh = (v - Math.min(0, min)) / (max - Math.min(0, min) || 1) * 13;
      const zl = max > 0 && min < 0 ? max / (max - min) * 13 : 0;
      const y = v >= 0 ? 14 - (max - Math.min(0, min) ? ((max - v) / (max - Math.min(0, min) || 1)) * 13 : 0) : 14 - 0 - 0;
      return `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${(v >= 0 ? 14 - zl - bh + (max > 0 && min < 0 ? 0 : 0) : 14 - zl).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${Math.abs(bh).toFixed(1)}" fill="${v < 0 ? '#C00000' : '#2B78C5'}"/>`;
    }).join('');
  }
  return `<svg width="100%" height="100%" viewBox="0 0 100 17" preserveAspectRatio="none" style="display:block">${inner}</svg>`;
}
X.sparkSVG = sparkSVG;

/* headers render */
function renderHeaders(v, fz) {
  const sh = sheet(), z = Z();
  const colhdr = $('#colhdr'), rowhdr = $('#rowhdr');
  const W = v.w, H = v.h;
  // column headers: frozen first, then scrolling
  const selCols = selColRange(), selRows = selRowRange();
  let html = '';
  const pushCH = (c, x, w) => {
    const inSel = selCols && c >= selCols[0] && c <= selCols[1];
    const act = state.sel && headerState(c, 'c');
    const cls = state.sel && state.sel.type === 'cols' && inSel ? 'fullsel' : (act === 2 ? 'act' : inSel ? 'sel' : '');
    html += `<td data-col="${c}" class="${cls}" style="left:${x}px;width:${w + 1}px;position:absolute;top:0;height:${HDRH + 0.5}px">${Calc.idxToCol(c)}<span class="ch-res" data-c="${c}"></span></td>`;
  };
  colhdr.style.cssText = `left:0px;top:0;width:${W}px;height:${HDRH}px;overflow:hidden;`;
  for (let c = 0; c < fz.c; c++) pushCH(c, HDRW + colX(c) * z, colWpx(c) * z);
  for (let c = fz.c; c <= MAXC; c++) {
    const x = HDRW + fz.w + (colX(c) - colX(fz.c)) * z - Math.max(0, v.sl - fz.w);
    const w = colWpx(c) * z;
    if (x < HDRW + fz.w) continue; // scrolled headers never overlap the frozen band
    if (x > W + 2) break;
    if (w > 0) pushCH(c, x, w);
  }
  colhdr.innerHTML = `<tbody><tr style="height:0">${html}</tr></tbody>`;
  // row headers
  let rhtml = '';
  const pushRH = (r, y, h) => {
    const inSel = selRows && r >= selRows[0] && r <= selRows[1];
    const act = state.sel && headerState(r, 'r');
    const cls = state.sel && state.sel.type === 'rows' && inSel ? 'fullsel' : (act === 2 ? 'act' : inSel ? 'sel' : '');
    rhtml += `<td data-row="${r}" class="${cls}" style="position:absolute;top:${y}px;left:0;height:${h + 0.7}px;width:${HDRW}px;line-height:${h}px;font-size:${Math.max(9, 11 * z * 1.05)}px">${r + 1}<span class="rh-res" data-r="${r}"></span></td>`;
  };
  rowhdr.style.cssText = `left:0;top:0;width:${HDRW}px;height:${H}px;overflow:hidden;`;
  for (let r = 0; r < fz.r; r++) pushRH(r, HDRH + rowY(r) * z, rowHpx(r) * z);
  for (let r = fz.r; r < MAXR; r++) {
    const y = HDRH + fz.h + (rowY(r) - rowY(fz.r)) * z - Math.max(0, v.st - fz.h);
    const h = rowHpx(r) * z;
    if (y < HDRH + fz.h) continue; // scrolled headers never overlap the frozen band
    if (y > H + 2) break;
    if (h > 0) pushRH(r, y, h);
  }
  rowhdr.innerHTML = `<tbody><tr style="width:0">${rhtml}</tr></tbody>`;
  rowhdr.style.display = colhdr.style.display = state.showHeads ? '' : 'none';
  $('#corner').style.display = state.showHeads ? '' : 'none';
}
function selColRange() {
  if (!state.sel) return null;
  const n = normSel();
  return [n.c1, n.c2];
}
function selRowRange() {
  if (!state.sel) return null;
  const n = normSel();
  return [n.r1, n.r2];
}
function headerState(i, axis) {
  // 0 none, 1 in selection, 2 active cell line
  const s = state.sel;
  if (!s) return 0;
  const n = normSel();
  const main = axis === 'c' ? s.a.c : s.a.r;
  if (axis === 'c') { if (i === s.a.c) return 2; if (i >= n.c1 && i <= n.c2) return 1; }
  else { if (i === s.a.r) return 2; if (i >= n.r1 && rInRanges(i)) return 1; }
  return 0;
}
function rInRanges() { return true; }

/* master render */
function renderAll() {
  const gs = $('#grid-scroll');
  const v = viewSize();
  const fz = fzDims();
  const z = Z();
  // stage covers viewport
  const stage = $('#grid-stage');
  // main zone origin in unscaled coords
  const slM = Math.max(0, v.sl - fz.w), stM = Math.max(0, v.st - fz.h);
  const c1 = fz.c + colAtX((colX(fz.c)) + slM / z);
  const firstC = Math.max(fz.c, colAtX(colX(fz.c) + slM / z) - 1);
  const firstR = Math.max(fz.r, rowAtY(rowY(fz.r) + stM / z) - 1);
  const lastC = Math.min(MAXC, colAtX(colX(fz.c) + (slM + v.w) / z) + 2);
  const lastR = Math.min(MAXR - 1, rowAtY(rowY(fz.r) + (stM + v.h) / z) + 2);
  renderZonesF(v, fz, firstR, lastR, firstC, lastC);
  renderHeaders(v, fz);
  renderObjects(v, fz);
  paintSel(v, fz);
  paintMarch(v, fz);
  updateSB();
  // retain editing reference boxes across re-renders
  if (typeof edit !== 'undefined' && edit) updateRefBoxes();
  // retain find highlights across re-renders
  if (typeof findHits !== 'undefined' && findHits.length) {
    paintHitCells();
    const h = findHits[findIdx];
    if (h && h.sh === state.active) {
      const el2 = $(`.cell[data-r="${h.r}"][data-c="${h.c}"]`);
      if (el2) el2.classList.add('hit-cell', 'cur');
    }
  }
}
/* proper zone offsets computed outside: patch layer offsets */
function renderZonesF(v, fz, firstR, lastR, firstC, lastC) {
  const z = Z();
  const slM = Math.max(0, v.sl - fz.w), stM = Math.max(0, v.st - fz.h);
  const absOx = colX(fz.c) * z + slM;
  const absOy = rowY(fz.r) * z + stM;
  // main (layer local (0,0) = content point (absOx, absOy))
  renderZone2(cellsLayer(), firstR, lastR, firstC, lastC,
    absOx, absOy,
    HDRW + fz.w, HDRH + fz.h, Math.max(0, v.w - HDRW - fz.w), Math.max(0, v.h - HDRH - fz.h));
  // frozen cols (scroll vertically only)
  if (fz.c > 0) renderZone2($('#frozencols-layer'), firstR, lastR, 0, fz.c - 1,
    0, absOy,
    HDRW, HDRH + fz.h, fz.w, Math.max(0, v.h - HDRH - fz.h));
  else $('#frozencols-layer').innerHTML = '';
  // frozen rows (scroll horizontally only)
  if (fz.r > 0) renderZone2($('#frozenrows-layer'), 0, fz.r - 1, firstC, lastC,
    absOx, 0,
    HDRW + fz.w, HDRH, Math.max(0, v.w - HDRW - fz.w), fz.h);
  else $('#frozenrows-layer').innerHTML = '';
  if (fz.r > 0 && fz.c > 0) renderZone2($('#frozencorner-layer'), 0, fz.r - 1, 0, fz.c - 1,
    0, 0, HDRW, HDRH, fz.w, fz.h);
  else $('#frozencorner-layer').innerHTML = '';
}
/* render zone: cell (r,c) is emitted at layer-local position
   lx = colX(c)*z - absOx,  ly = rowY(r)*z - absOy; layer positioned at (layerX,layerY). */
function renderZone2(layerEl, r1, r2, c1, c2, absOx, absOy, layerX, layerY, layerW, layerH) {
  const sh = sheet(), z = Z();
  const parts = [];
  for (let r = Math.max(0, r1); r <= r2; r++) {
    if (sh.hidR[r]) continue;
    for (let c = Math.max(0, c1); c <= c2; c++) {
      if (sh.hidC[c]) continue;
      if (sh.subOf[keyOf(r, c)]) continue;
      const cd = cellGet(r, c);
      let d = cd ? cellDisplay(r, c) : null;
      const spanW = mergeSpan(sh, r, c) ? mergeW(r, c) : undefined;
      const spanH = mergeSpan(sh, r, c) ? mergeH(r, c) : rowHpx(r) * z;
      const w = spanW != null ? spanW : colWpx(c) * z;
      if (cd && d && d.t === 'n' && !((cd.s || {}).wrap)) d = { ...d, text: fitNumeric(d.text, r, c, cd.s, w) };
      // emit every cell: empties carry the gridlines (transparent so spill text shows)
      computeAndEmit(parts, r, c, cd, d, w, spanH, absOx, absOy, layerX, layerY, layerW, layerH, sh);
    }
  }
  layerEl.innerHTML = parts.join('');
  layerEl.style.cssText = `position:absolute;left:${layerX}px;top:${layerY}px;width:${Math.max(0, layerW)}px;height:${Math.max(0, layerH)}px;overflow:hidden;pointer-events:auto;`;
  layerEl.classList.toggle('no-grid', !state.showGrid);
  layerEl.classList.toggle('white-bg', true);
}
function hasNoteBorder() { return false; }
function computeAndEmit(parts, r, c, cd, d, w, h, absOx, absOy, layerX, layerY, layerW, layerH, sh) {
  // layer-local position: content coordinate minus the zone's content origin
  const lx = colX(c) * Z() - absOx;
  const ly = rowY(r) * Z() - absOy;
  emitCell(parts, r, c, cd, d, lx, ly, w, h, layerW, layerH);
}

function emitCell(parts, r, c, cd, d, lx, ly, w, h, layerW, layerH) {
  if (lx + w < -2 || lx > layerW + 2 || ly + h < -2 || ly > layerH + 2) return;
  const s = (cd && cd.s) || {};
  const shCf = sheet();
  const cf = (shCf.cfRules && shCf.cfRules.length) ? X.cfApply(r, c, d) : null;
  const fs = ((s.size || 11) * Z()).toFixed(1);
  const css = [];
  css.push(`left:${lx.toFixed(2)}px`, `top:${ly.toFixed(2)}px`, `width:${w.toFixed(2)}px`, `height:${h.toFixed(2)}px`);
  css.push(`font-size:${fs}pt`, `line-height:${(fs * 1.23).toFixed(1)}px`);
  if (s.font) css.push(`font-family:'${s.font}',${CELLSTACK}`);
  if (s.b) css.push('font-weight:700');
  if (s.i) css.push('font-style:italic');
  const dec = [];
  if (s.u === 'double') dec.push('underline double');
  else if (s.u) dec.push('underline');
  if (s.strike) dec.push('line-through');
  if (dec.length) css.push(`text-decoration:${dec.join(' ')}`);
  let color = d && d.color ? d.color : s.color || '';
  if (d && d.t === 'e') color = '#C00000';
  if (cf && cf.color) color = cf.color;
  if (color) css.push(`color:${color}`);
  if (cd && cd.link) color = '';
  if (cd && cd.link) css.push('color:#0563C1;text-decoration:underline;cursor:pointer');
  const bgFill = (cf && cf.bg) || s.bg;
  if (bgFill) {
    css.push(`background:${bgFill}`);
    // fills hide the gridlines that would cross them (match Excel)
    if (!(s.bR && s.bR.st)) css.push(`border-right:1px solid ${bgFill}`);
    if (!(s.bB && s.bB.st)) css.push(`border-bottom:1px solid ${bgFill}`);
  } else if (!cd) css.push('background:transparent');
  const al = d ? (s.halign || (d.t === 'n' ? 'right' : d.t === 'b' || d.t === 'e' ? 'center' : 'left')) : (s.halign || 'left');
  css.push(`text-align:${al}`);
  if (s.valign) css.push('display:flex', 'flex-direction:column', `justify-content:${s.valign === 'top' ? 'flex-start' : s.valign === 'bottom' ? 'flex-end' : 'center'}`);
  if (s.indent) css.push(`padding-left:${(3 + s.indent * 9 * Z()).toFixed(1)}px`);
  for (const side of ['bL', 'bR', 'bT', 'bB']) {
    const b = s[side];
    const prop = side === 'bL' ? 'border-left' : side === 'bR' ? 'border-right' : side === 'bT' ? 'border-top' : 'border-bottom';
    if (b && b.st) css.push(`${prop}:${Math.max(1, Math.round((b.w || 1) * Z()))}px ${b.st} ${b.cl || '#000'}`);
    else if (side === 'bL' || side === 'bT') css.push(`${prop}-style:none`, `${prop}-width:0`);
  }
  let cls = 'cell';
  if (!state.showGrid) {} else {}
  let inner = '';
  const overWanted = d && !s.wrap && !d.text.includes('\n') && d.t === 's';
  if (d && s.wrap) { cls += ' wrap'; inner = esc(d.text); }
  else if (overWanted) {
    const tw = textWdom(d.text, s, Z());
    const al2 = s.halign || 'left';
    if (tw > w - 6 && !bgFill) {
      const canR = al2 !== 'right' && spillX(r, c, 1);
      const canL = al2 !== 'left' && spillX(r, c, -1);
      if (canR || canL) {
        // Excel spills text across empty neighbours with gridlines showing through — keep transparent
        const ow = tw + 10;
        css.push(`width:${ow.toFixed(1)}px`, 'z-index:2', 'overflow:visible');
        if (al2 === 'right' && canL) css.push(`left:${(lx + w - ow).toFixed(1)}px`);
      } else cls += ' nt';
    } else cls += ' nt';
    inner = esc(d.text);
  } else { cls += ' nt'; inner = d ? esc(d.text) : ''; }
  if (cd && cd.spark) inner = sparkSVG(cd);
  if (cf && cf.bar) {
    const pct = Math.max(2, Math.round(cf.bar.pct * 98));
    inner = `<span class="cf-bar" style="width:${pct}%;background:${cf.bar.color};opacity:.42"></span><span style="position:relative">${inner}</span>`;
  }
  const sh = sheet();
  const note = sh.notes[keyOf(r, c)];
  const noteHtml = note ? '<span class="note-tri" style="position:absolute;top:0;right:0;border:5px solid transparent;border-top-color:#C00000;border-right-color:#C00000;border-width:0 7px 7px 0"></span>' : '';
  parts.push(`<div class="${cls}" data-r="${r}" data-c="${c}" style="${css.join(';')}">${inner}${noteHtml}</div>`);
}
function spillX(r, c, dir) {
  const sh = sheet();
  let cc = c + dir;
  let guard = 0;
  while (cc >= 0 && cc <= MAXC && guard++ < 200) {
    if (colWpx(cc) === 0) { cc += dir; continue; }
    const cd = cellGet(r, cc);
    if (!cd) return true;
    const d = cellDisplay(r, cc);
    if (d && d.text !== '') return false;
    const s = cd.s || {};
    if (s.bg && s.bg !== '#fff' && s.bg !== '#FFFFFF') return false;
    if (dir > 0 && s.bL && s.bL.st) return false;
    if (dir < 0 && s.bR && s.bR.st) return false;
    return true;
  }
  return false;
}
X.renderAll = renderAll;

/* ============================ 7. SELECTION ============================ */
function normSel() {
  const s = state.sel;
  return {
    r1: Math.min(s.a.r, s.b.r), r2: Math.max(s.a.r, s.b.r),
    c1: Math.min(s.a.c, s.b.c), c2: Math.max(s.a.c, s.b.c),
  };
}
X.normSel = normSel;
/* Excel keeps the ACTIVE CELL distinct from the selection's anchor corner:
   Tab/Enter cycle it around inside a multi-cell block without disturbing the
   block itself. `s.cur` holds that cycled active cell (null/undefined = the
   anchor s.a is active). Every selection change funnels through
   afterSelChange, which clears it unless the change opts out via _keepCur. */
function curCell() { const s = state.sel; return s.cur || s.a; }
X.curCell = curCell;
function isSingle() { const s = state.sel; return s.a.r === s.b.r && s.a.c === s.b.c && (!s.ranges || !s.ranges.length); }
function setSel(a, b, type, skipRender) {
  state.sel = { a: { ...a }, b: { ...(b || a) }, type: type || 'cell', ranges: [], cur: null };
  if (!skipRender) afterSelChange();
}
X.setSel = setSel;
function afterSelChange() {
  const s = state.sel;
  if (s._keepCur) s._keepCur = false; else s.cur = null;
  // clamps
  s.a.r = clamp(s.a.r, 0, MAXR - 1); s.a.c = clamp(s.a.c, 0, MAXC);
  s.b.r = clamp(s.b.r, 0, MAXR - 1); s.b.c = clamp(s.b.c, 0, MAXC);
  const nm = normSel();
  $('#namebox-text').textContent = selLabel();
  syncFxFromModel();
  updateSBQuick();
  requestRender();
}
X.afterSelChange = afterSelChange;
function selLabel() {
  const s = state.sel;
  if (!s) return 'A1';
  if (s.type === 'all') return Calc.MAXR + 'R x ' + (Calc.MAXC + 1) + 'C';
  const n = normSel();
  if (s.type === 'cols') return (n.c2 - n.c1 + 1) + 'C';
  if (s.type === 'rows') return (n.r2 - n.r1 + 1) + 'R';
  if (n.r1 === n.r2 && n.c1 === n.c2) return a1(n.r1, n.c1);
  return `${n.r2 - n.r1 + 1}R x ${n.c2 - n.c1 + 1}C`;
}
function selViewportRect(v, fz, n) {
  // viewport-space rect covering normalized selection n {r1,r2,c1,c2}
  const z = Z();
  const x1 = cellVpX(n.c1, v, fz), x2 = cellVpX(n.c2, v, fz) + colWpx(n.c2) * z;
  const y1 = cellVpY(n.r1, v, fz), y2 = cellVpY(n.r2, v, fz) + rowHpx(n.r2) * z;
  return { x1, y1, x2, y2 };
}
function cellVpX(c, v, fz) {
  const z = Z();
  if (c < fz.c) return HDRW + colX(c) * z;
  return HDRW + fz.w + (colX(c) - colX(fz.c)) * z - Math.max(0, v.sl - fz.w);
}
function cellVpY(r, v, fz) {
  const z = Z();
  if (r < fz.r) return HDRH + rowY(r) * z;
  return HDRH + fz.h + (rowY(r) - rowY(fz.r)) * z - Math.max(0, v.st - fz.h);
}
X.cellVpX = cellVpX; X.cellVpY = cellVpY;

function paintSel(v, fz) {
  const layer = selLayer();
  v = v || viewSize(); fz = fz || fzDims();
  layer.style.cssText = `position:absolute;left:0;top:0;width:${v.w}px;height:${v.h}px;overflow:hidden;pointer-events:none;z-index:10`;
  if (!state.sel) { layer.innerHTML = ''; return; }
  const n = normSel();
  const parts = [];
  // whole col/row/all shading of headers handled in header render
  const rects = [];
  if (state.sel.type === 'all') rects.push({ r1: 0, c1: 0, r2: MAXR - 1, c2: MAXC });
  else {
    rects.push(n);
    (state.sel.ranges || []).forEach(rg => rects.push(rg));
  }
  rects.forEach((rg, idx) => {
    const R = selViewportRect(v, fz, rg);
    const x1 = Math.max(HDRW, R.x1), y1 = Math.max(HDRH, R.y1);
    const x2 = Math.min(v.w, R.x2), y2 = Math.min(v.h, R.y2);
    if (x2 <= x1 || y2 <= y1) return;
    if (idx === 0) {
      // range tint AROUND the active cell (never over it, or cell text is covered)
      const ar = activeViewRect(v, fz);
      if (ar) {
        const ax1 = clamp(ar.x1, x1, x2), ay1 = clamp(ar.y1, y1, y2);
        const ax2 = clamp(ar.x2, x1, x2), ay2 = clamp(ar.y2, y1, y2);
        // top / bottom / left / right strips
        if (ay1 > y1) parts.push(`<div class="sel-rect" style="left:${x1}px;top:${y1}px;width:${x2 - x1}px;height:${ay1 - y1}px;border-bottom:none"></div>`);
        if (ay2 < y2) parts.push(`<div class="sel-rect" style="left:${x1}px;top:${ay2}px;width:${x2 - x1}px;height:${y2 - ay2}px;border-top:none"></div>`);
        if (ax1 > x1) parts.push(`<div class="sel-rect" style="left:${x1}px;top:${ay1}px;width:${ax1 - x1}px;height:${Math.max(0, ay2 - ay1)}px;border-right:none"></div>`);
        if (ax2 < x2) parts.push(`<div class="sel-rect" style="left:${ax2}px;top:${ay1}px;width:${x2 - ax2}px;height:${Math.max(0, ay2 - ay1)}px;border-left:none"></div>`);
        if (ax2 > ax1 && ay2 > ay1) parts.push(`<div class="sel-active" style="left:${ax1}px;top:${ay1}px;width:${ax2 - ax1}px;height:${ay2 - ay1}px"></div>`);
        // fill handle
        const fhX = x2 - 3.5, fhY = y2 - 3.5;
        parts.push(`<div class="sel-fillhandle" id="fillhandle" style="left:${fhX}px;top:${fhY}px;pointer-events:auto"></div>`);
      } else {
        parts.push(`<div class="sel-rect" style="left:${x1}px;top:${y1}px;width:${x2 - x1}px;height:${y2 - y1}px"></div>`);
      }
    } else {
      parts.push(`<div class="sel-rect" style="left:${x1}px;top:${y1}px;width:${x2 - x1}px;height:${y2 - y1}px"></div>`);
    }
  });
  layer.innerHTML = parts.join('');
  X._paintSelMarch && X._paintSelMarch();
}
function activeViewRect(v, fz) {
  const s = state.sel;
  if (!s) return null;
  const z = Z();
  const cur = curCell();
  const sp = mergeAt(sheet(), cur.r, cur.c);
  let c1 = cur.c, c2 = cur.c, r1 = cur.r, r2 = cur.r;
  if (sp) { c1 = sp.c1; c2 = sp.c2; r1 = sp.r1; r2 = sp.r2; }
  const x1 = cellVpX(c1, v, fz), y1 = cellVpY(r1, v, fz);
  const x2 = cellVpX(c2, v, fz) + colWpx(c2) * z, y2 = cellVpY(r2, v, fz) + rowHpx(r2) * z;
  return { x1, y1, x2, y2 };
}
X._fillGhostData = null;

/* marching ants */
function paintMarch(v, fz) {
  const layer = selLayer();
  if (!state.clipboard) return;
  const cb = state.clipboard;
  if (cb.sheetId !== state.active) return;
  v = v || viewSize(); fz = fz || fzDims();
  const n = { r1: cb.r1, c1: cb.c1, r2: cb.r2, c2: cb.c2 };
  const R = selViewportRect(v, fz, n);
  const x1 = Math.max(HDRW, R.x1), y1 = Math.max(HDRH, R.y1);
  const x2 = Math.min(v.w, R.x2), y2 = Math.min(v.h, R.y2);
  if (x2 <= x1 || y2 <= y1) return;
  layer.innerHTML += `<div class="march" style="left:${x1}px;top:${y1}px;width:${x2 - x1}px;height:${y2 - y1}px"></div>`;
}

/* status bar quick stats */
function updateSBQuick() {
  const q = $('#sb-quick');
  const s = state.sel;
  if (!s || isSingle()) { q.innerHTML = ''; return; }
  let sum = 0, cnt = 0, cntN = 0, min = Infinity, max = -Infinity;
  eachRangeCell((r, c) => {
    const v = cellRaw(r, c);
    if (v !== undefined && v !== null && v !== '') cnt++;
    if (typeof v === 'number') { sum += v; cntN++; if (v < min) min = v; if (v > max) max = v; }
  });
  const parts = [];
  if (cntN) parts.push(`<span class="sq">Average: ${Calc.numToGeneral(Math.round(sum / cntN * 100) / 100)}</span>`);
  parts.push(`<span class="sq">Count: ${cnt}</span>`);
  if (cntN) parts.push(`<span class="sq">Sum: ${Calc.numToGeneral(Math.round(sum * 100) / 100)}</span>`);
  q.innerHTML = parts.join('');
}
X.updateSBQuick = updateSBQuick;

/* iterate cells in selection */
function eachRangeCell(fn) {
  const s = state.sel;
  const n = normSel();
  if (s.type === 'all') { forEachUsedCell(fn); return; }
  const ranges = [{ ...n }];
  (s.ranges || []).forEach(r => ranges.push(r));
  for (const rg of ranges) {
    const rMax = s.type === 'cols' ? usedR2() : rg.r2;
    const cMax = s.type === 'rows' ? usedC2() : rg.c2;
    for (let r = rg.r1; r <= (s.type === 'cell' ? rg.r2 : Math.min(rMax, Math.max(rg.r2, rg.r1))); r++) {
      for (let c = rg.c1; c <= (s.type === 'cell' ? rg.c2 : Math.min(cMax, Math.max(rg.c2, rg.c1))); c++) fn(r, c);
    }
  }
}
X.eachRangeCell = eachRangeCell;
function forEachUsedCell(fn) {
  const sh = sheet();
  Object.keys(sh.cells).forEach(k => { const { r, c } = rcOf(k); fn(r, c); });
}
X.forEachUsedCell = forEachUsedCell;
function usedR2() {
  let m = 0;
  forEachUsedCell(r => { if (r > m) m = r; });
  return m;
}
function usedC2() {
  let m = 0;
  forEachUsedCell((r, c) => { if (c > m) m = c; });
  return m;
}
X.usedR2 = usedR2; X.usedC2 = usedC2;
function regionUsed() {
  // current region around active cell (contiguous non-empty)
  const s = state.sel;
  const sh = sheet();
  const isEmpty = (r, c) => { const d = cellDisplay(r, c); return !d || d.text === ''; };
  let { r, c } = s.a;
  if (isEmpty(r, c)) { const u2 = { r2: usedR2(), c2: usedC2() }; return { r1: 0, c1: 0, r2: u2.r2, c2: u2.c2 }; }
  let r1 = r, r2 = r, c1 = c, c2 = c;
  const rowEmpty = rr => { for (let cc = 0; cc <= Math.max(usedC2(), c2); cc++) if (!isEmpty(rr, cc)) return false; return true; };
  const colEmpty = cc => { for (let rr = 0; rr <= Math.max(usedR2(), r2); rr++) if (!isEmpty(rr, cc)) return false; return true; };
  while (r1 > 0 && !rowEmpty(r1 - 1)) r1--;
  while (r2 < MAXR - 1 && !rowEmpty(r2 + 1) && r2 < usedR2() + 1) r2++;
  while (c1 > 0 && !colEmpty(c1 - 1)) c1--;
  while (c2 < MAXC && !colEmpty(c2 + 1) && c2 < usedC2() + 1) c2++;
  // trim to used
  return { r1, c1, r2: Math.min(r2, Math.max(usedR2(), r)), c2: Math.min(c2, Math.max(usedC2(), c)) };
}
X.regionUsed = regionUsed;

/* ============================ 8. RECALC ============================ */
const astCache = {};
function ctxFor(shId, self) {
  return {
    self,
    get(ref, sheetName) {
      /* a bare 3D cell ref can only collapse via a function context; a lone one is
         #NULL! (empty intersection), a dead span is #REF! */
      if (sheetName && String(sheetName).indexOf(':') >= 0) {
        const d = sheets3D(sheetName);
        return d && !d.err ? Calc.ERR('#NULL!') : Calc.ERR('#REF!');
      }
      const sh = sheetByName(sheetName) || sheet();
      if (ref.colOnly || ref.rowOnly) return undefined;
      const cd = sh.cells[keyOf(ref.r, ref.c)];
      if (!cd) return null;
      if (cd.t === 'f') return cd.num;
      if (cd.t === 'n') return cd.num;
      if (cd.t === 'b') return cd.num;
      if (cd.t === 'e') return Calc.ERR(cd.num);
      return cd.num;
    },
    range(a, b, sheetName) {
      let sh3 = null, sh;
      if (sheetName && String(sheetName).indexOf(':') >= 0) {   // 3D span: Sheet1:Sheet3!
        const d = sheets3D(sheetName);
        if (!d || d.err) return Calc.ERR('#REF!');
        sh3 = d.sheets;
      } else sh = sheetByName(sheetName) || sheet();
      const c1 = a.c == null ? 0 : Math.min(a.c, b.c == null ? MAXC : b.c);
      const c2 = a.c == null ? MAXC : Math.max(a.c, b.c == null ? MAXC : b.c);
      const r1 = a.r == null ? 0 : Math.min(a.r, b.r == null ? MAXR - 1 : b.r);
      const r2 = a.r == null ? MAXR - 1 : Math.max(a.r, b.r == null ? MAXR - 1 : b.r);
      const grab = (shx) => {
        const rows = [];
        for (let r = r1; r <= r2; r++) {
          const row = [];
          for (let c = c1; c <= c2; c++) {
            const cd = shx.cells[keyOf(r, c)];
            if (!cd) { row.push(null); continue; }
            if (cd.t === 'f') row.push(cd.num);
            else if (cd.t === 'n' || cd.t === 'b') row.push(cd.num);
            else if (cd.t === 'e') row.push(Calc.ERR(cd.num));
            else row.push(cd.num);
          }
          rows.push(row);
        }
        return rows;
      };
      // 3D: concatenate every in-span sheet's block, exactly like Excel feeds SUM-family
      const rows = sh3 ? sh3.reduce((acc, shx) => acc.concat(grab(shx)), []) : grab(sh);
      if (rows.length > 1 || (rows[0] && rows[0].length > 1)) { rows.__rows = rows.length > 1; return rows.length > 1 ? rows : rows[0]; }
      return rows.flat();
    },
    getName(name) {
      let def = state.names[name];
      if (!def) { // defined names are case-insensitive in Excel (formula ids arrive uppercased)
        const k2 = Object.keys(state.names).find(k => k.toLowerCase() === String(name).toLowerCase());
        if (k2) def = state.names[k2];
      }
      if (!def) return undefined;
      const m = def.ref.match(/^(?:'([^']+)'|([^!]+))!(\$?[A-Z]{1,3}\$?[0-9]+)(?::(\$?[A-Z]{1,3}\$?[0-9]+))?$/);
      if (!m) return undefined;
      const shName = m[1] || m[2];
      if (!sheetByName(shName)) return undefined;
      const a = Calc.parseRef(m[3].replace(/\$/g, '')), b = m[4] ? Calc.parseRef(m[4].replace(/\$/g, '')) : a;
      const ctx2 = ctxFor();
      return m[4] ? ctx2.range(a, b, shName) : ctx2.get(a, shName);
    },
    getFormula(ref, sheetName) {
      if (!ref || ref.colOnly || ref.rowOnly) return null;
      const sh = sheetByName(sheetName) || sheet();
      const cd = sh.cells[keyOf(ref.r, ref.c)];
      if (!cd || cd.t !== 'f') return null;
      return String(cd.v).startsWith('=') ? cd.v : '=' + cd.v;
    },
    isFormula(ref, sheetName) {
      if (!ref || ref.colOnly || ref.rowOnly) return false;
      const sh = sheetByName(sheetName) || sheet();
      const cd = sh.cells[keyOf(ref.r, ref.c)];
      return !!cd && cd.t === 'f';
    },
    /* ---- host hooks for SHEET/SHEETS/SUBTOTAL(1xx)/CELL("width") ---- */
    ownSheet() { return (shId && state.sheets.indexOf(shId) >= 0) ? shId : sheet(); },
    sheetIx() { return state.sheets.indexOf(this.ownSheet()) + 1; },
    sheetCount() { return state.sheets.length; },
    sheetIxByName(name) { const s = sheetByName(name); return s ? state.sheets.indexOf(s) + 1 : null; },
    isHiddenR(r, sheetName) { const sh = sheetByName(sheetName) || this.ownSheet(); return !!sh.hidR[r]; },
    colWidth(col, sheetName) { const sh = sheetByName(sheetName) || this.ownSheet(); const px = sh.colW[col] != null ? sh.colW[col] : DEFAULT_COLW; return Math.max(0, (px - 5) / 7); },
  };
}
function sheetByName(n) {
  if (!n) return null;
  return state.sheets.find(s => s.name.toLowerCase() === String(n).toLowerCase()) || null;
}
/* 3D span resolver: 'Sheet1:Sheet3' -> {sheets:[...]} (visible sheets inside the
   index span, either direction), {err:true} on a dead end, or null when `nm`
   isn't a span at all. Non-contiguous runtime order is exactly sheet-tab order,
   like Excel. */
function sheets3D(nm) {
  if (typeof nm !== 'string' || nm.indexOf(':') < 0) return null;
  const parts = nm.split(':');
  if (parts.length !== 2) return { err: true };
  const i1 = state.sheets.findIndex(s => s.name.toLowerCase() === parts[0].toLowerCase());
  const i2 = state.sheets.findIndex(s => s.name.toLowerCase() === parts[1].toLowerCase());
  if (i1 < 0 || i2 < 0) return { err: true };
  const lo = Math.min(i1, i2), hi = Math.max(i1, i2);
  const list = state.sheets.slice(lo, hi + 1).filter(sh => !sh.hidden);
  if (!list.length) return { err: true };
  return { sheets: list };
}
X.sheets3D = sheets3D;
X.sheetByName = sheetByName; X.ctxFor = ctxFor;
function recalcAll() {
  const visiting = new Set();
  const circularKeys = new Set();
  const evalCell = (sh, r, c, depth) => {
    const k = keyOf(r, c);
    const cd = sh.cells[k];
    if (!cd || cd.t !== 'f') return;
    const idk = state.sheets.indexOf(sh) + ':' + k;
    if (cd._done) return;
    if (visiting.has(idk)) { circularKeys.add(idk); return; }
    visiting.add(idk);
    let ast = astCache[idk];
    if (!ast || ast.src !== cd.v) { const p = Calc.parse(cd.v); ast = { ast: p, src: cd.v }; astCache[idk] = ast; }
    const ast2 = ast.ast;
    // evaluate deps first
    if (ast2 && ast2.k !== '__parsefail') {
      const refs = Calc.refsOf(ast2);
      for (const rf of refs) {
        const tsh = rf.sheet ? (sheetByName(rf.sheet) || sh) : sh;
        if (rf.b == null && !rf.a.colOnly && !rf.a.rowOnly) evalCell(tsh, rf.a.r, rf.a.c, depth + 1);
        else if (rf.b && !rf.a.colOnly && !rf.a.rowOnly && (rf.b.r - rf.a.r) * (rf.b.c - rf.a.c) < 5000) {
          for (let rr = Math.min(rf.a.r, rf.b.r); rr <= Math.max(rf.a.r, rf.b.r); rr++)
            for (let cc = Math.min(rf.a.c, rf.b.c); cc <= Math.max(rf.a.c, rf.b.c); cc++) evalCell(tsh, rr, cc, depth + 1);
        }
      }
      const ctx = ctxFor(sh, { r, c });
      const v = (Calc.eval3D || Calc.evalNode)(ast2, ctx);
      cd.num = v === undefined || v === null ? (Calc.isErr(v) ? v : v == null ? 0 : v) : v;
      if (Array.isArray(cd.num)) cd.num = cd.num.flat ? cd.num.flat()[0] : cd.num;
      cd.err = Calc.isErr(v) ? v.__err : null;
      if (Calc.isErr(v)) cd.num = v.__err.indexOf('#') === 0 ? v.__err : v;
    } else {
      cd.num = '#NAME?';
    }
    visiting.delete(idk);
    cd._done = true;
  };
  for (const sh of state.sheets) {
    Object.keys(sh.cells).forEach(k => { sh.cells[k]._done = false; });
  }
  for (const sh of state.sheets) {
    for (const k of Object.keys(sh.cells)) {
      const cd = sh.cells[k];
      if (cd.t !== 'f') { cd._done = true; continue; }
      const { r, c } = rcOf(k);
      evalCell(sh, r, c, 0);
    }
  }
  // circular detection
  state.circular = circularKeys.size > 0;
  if (state.circular) sbMsg('Circular References: one or more formulas reference their own cell');
  for (const sh of state.sheets) Object.keys(sh.cells).forEach(k => delete sh.cells[k]._done);
  updateTableTotals();
}
X.recalcAll = recalcAll;
let recalcTimer = null;
function scheduleRecalc() {
  /* Excel Manual mode: a freshly ENTERED formula still computes immediately —
     only the REST of the dirty graph waits for F9/Calculate Now */
  if (state.calcMode === 'manual') {
    if (state._pendFormula) { state._pendFormula = false; recalcAll(); }
    requestRender(); return;
  }
  if (recalcTimer) clearTimeout(recalcTimer);
  recalcTimer = setTimeout(() => { recalcAll(); requestRender(); }, 30);
}
X.scheduleRecalc = scheduleRecalc;

/* ============================ 9. ENTERING / PARSING INPUT ============================ */
/* Excel parity: typed values are truncated to 15 SIGNIFICANT digits at storage
   (1234567890123456 -> 1234567890123460, rounding the 15th digit like Excel) */
function sig15(num, typed) {
  const digits = String(typed).replace(/,/g, '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  if (digits.length > 15) return Number(num.toPrecision(15));
  return num;
}
const MONTHS3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function monthIdx(nm) {
  const k = String(nm).toLowerCase();
  const i = MONTHS3.findIndex(m => k === m || k.startsWith(m));
  return i;
}
function parseInput(str) {
  // returns {t, num, f(auto format or null)}
  if (typeof str !== 'string') str = String(str);
  const s = str;
  if (s === '') return { t: 'empty', num: '' };
  if (s[0] === '=') return { t: 'f', num: 0 };
  const t = s.trim();
  if (/^(true|false)$/i.test(t)) return { t: 'b', num: t.toLowerCase() === 'true' };
  // percent
  let m = t.match(/^(-?)\$?([0-9][0-9,]*(\.[0-9]+)?|\.[0-9]+)\s*%$/);
  if (m) { const num = parseFloat(m[2].replace(/,/g, '')) * (m[1] ? -1 : 1) / 100; return { t: 'n', num, f: (m[3] ? '0.' + '0'.repeat(m[3].length - 1) : '0') + '%' }; }
  m = t.match(/^(-?)\$([0-9][0-9,]*(\.[0-9]+)?|\.[0-9]+)$/);
  if (m) { const num = parseFloat(m[2].replace(/,/g, '')) * (m[1] ? -1 : 1); return { t: 'n', num, f: m[3] ? '$#,##0.' + '0'.repeat(m[3].length - 1) : '$#,##0.00' }; }
  // number
  if (/^-?[0-9][0-9,]*(\.[0-9]+)?$/.test(t) || /^-?\.[0-9]+$/.test(t)) {
    const num = sig15(parseFloat(t.replace(/,/g, '')), t);
    const f = /,/.test(t) ? (t.includes('.') ? '#,##0.' + '0'.repeat((t.split('.')[1] || '').length) : '#,##0') : null;
    return { t: 'n', num, f };
  }
  // fraction like 1/2 (simple)
  m = t.match(/^(-?)(\d+)\s+(\d+)\/(\d+)$/);
  if (m && +m[4] !== 0) { const num = (m[1] ? -1 : 1) * (+m[2] + +m[3] / +m[4]); return { t: 'n', num, f: '# ?/?' }; }
  // date mm/dd/yyyy or m/d/yy or yyyy-mm-dd
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const dt = new Date(Date.UTC(y, +m[1] - 1, +m[2]));
    if (dt.getUTCMonth() === +m[1] - 1 && dt.getUTCDate() === +m[2]) {
      const fmtCode = /-/.test(t) ? 'yyyy-mm-dd' : (m[3].length === 2 ? 'm/d/yy' : 'mm/dd/yyyy');
      return { t: 'n', num: Calc.dateToSerial(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())), f: fmtCode };
    }
  }
  // date yyyy/mm/dd or yyyy.mm.dd (ISO order, slash or dot separators)
  m = t.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m) {
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[3]) {
      const fmtCode = t.includes('.') ? 'yyyy.mm.dd' : 'yyyy/mm/dd';
      return { t: 'n', num: Calc.dateToSerial(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())), f: fmtCode };
    }
  }
  /* date with month NAMES: 20-Sep-26 / 20-September-2026 / Sep 20, 2026 / 20 Sep 2026 /
     Sep-2026 (day defaults to 1, exactly like Excel) */
  const mD = t.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})$/);          // 20-Sep-26
  const mM = t.match(/^([A-Za-z]{3,9})[-\s](\d{1,2}),?\s(\d{2,4})$/);          // Sep 20, 2026
  const mY = t.match(/^([A-Za-z]{3,9})[-\s/](\d{2,4})$/);                      // Sep-2026
  let dl, mm, y;
  if (mD) { dl = +mD[1]; mm = monthIdx(mD[2]); y = +mD[3]; }
  else if (mM) { mm = monthIdx(mM[1]); dl = +mM[2]; y = +mM[3]; }
  else if (mY) { mm = monthIdx(mY[1]); dl = 1; y = +mY[2]; }
  if (mm !== undefined && mm >= 0) {
    if (y <= 99) y += 2000;
    const dt = new Date(Date.UTC(y, mm, dl));
    if (dt.getUTCMonth() === mm && dt.getUTCDate() === dl) {
      return { t: 'n', num: Calc.dateToSerial(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())), f: 'dd-mmm-yy' };
    }
  }
  // time h:mm
  m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (m) {
    let h = +m[1];
    if (m[4]) { if (m[4].toLowerCase() === 'pm' && h < 12) h += 12; if (m[4].toLowerCase() === 'am' && h === 12) h = 0; }
    return { t: 'n', num: (h * 3600 + +m[2] * 60 + (+m[3] || 0)) / 86400, f: m[4] ? 'h:mm AM/PM' : 'h:mm' };
  }
  return { t: 's', num: str };
}
X.parseInput = parseInput;

function validateEntry(r, c, parsed) {
  // data validation; returns true if OK
  const sh = sheet();
  for (const v of sh.validations) {
    if (r < v.r1 || r > v.r2 || c < v.c1 || c > v.c2) continue;
    if (parsed.t === 'empty') continue;
    const num = parsed.t === 'n' ? parsed.num : parsed.t === 's' ? parsed.num : null;
    const isNum = parsed.t === 'n';
    const str = parsed.t === 's' ? parsed.num : String(parsed.num);
    switch (v.kind) {
      case 'any': return true;
      case 'whole': if (!isNum || Math.floor(num) !== num) return valWarn(); break;
      case 'decimal': if (!isNum) return valWarn(); break;
      case 'date': if (!isNum) return valWarn(); break;
      case 'textlen': if (!(str.length >= v.min && str.length <= v.max)) return valWarn(); break;
      case 'list': if (!v.list.split(',').map(x => x.trim().toLowerCase()).includes(str.toLowerCase())) return valWarn(); break;
      case 'custom':
        if (v.op && isNum) {
          if (v.op === 'between' && !(num >= v.min && num <= v.max)) return valWarn();
          if (v.op === 'greater' && !(num > v.min)) return valWarn();
          if (v.op === 'less' && !(num < v.min)) return valWarn();
          if (v.op === 'gte' && !(num >= v.min)) return valWarn();
          if (v.op === 'lte' && !(num <= v.min)) return valWarn();
          if (v.op === 'ne' && !(num !== v.min)) return valWarn();
          if (v.op === 'eq' && !(num === v.min)) return valWarn();
        }
        break;
    }
  }
  return true;
  function valWarn() {
    msgBox('Microsoft Excel', 'This value doesn\'t match the data validation restrictions defined for this cell.', { icon: 'warn', buttons: ['Retry', 'Cancel'] }).then(ans => {
      if (ans === 'Retry') startEdit(null);
    });
    return false;
  }
}
X.validateEntry = validateEntry;

function cellLocked(r, c) {
  const cd = cellGet(r, c);
  return !cd || !cd.s || cd.s.locked !== false; // Excel: all cells Locked by default
}
X.cellLocked = cellLocked;
function commitCell(r, c, str, opts) {
  opts = opts || {};
  const sh = sheet();
  if (state.protected && cellLocked(r, c)) { sbMsg('The cell or chart you are trying to change is on a protected sheet. Unprotect the sheet first.'); return false; }
  let parsed = parseInput(str);
  if (!validateEntry(r, c, parsed)) return false;
  if (!opts.skipUndo) pushUndo('Typing');
  if (parsed.t === 'empty') { delete sheet().cells[keyOf(r, c)]; }
  else {
    const cd = cellEnsure(r, c);
    cd.v = str;
    if (parsed.t === 'f') { cd.t = 'f'; state._pendFormula = true; }
    else { cd.t = parsed.t; cd.num = parsed.num; }
    if (parsed.f && (!cd.f || cd.f === 'General' || opts.autoFmt)) cd.f = parsed.f;
    if (parsed.t !== 'f') delete astCache[state.active + ':' + keyOf(r, c)];
    else delete astCache[state.active + ':' + keyOf(r, c)];
  }
  scheduleRecalc();
  markDirty();
  afterDataChange();
  return true;
}
X.commitCell = commitCell;
function afterDataChange() {
  clearArrows();
  updateSBQuick();
  scheduleRecalc();   // any data/layout change (incl. hide/unhide/filter) re-evaluates formulas — Excel parity
  if (!edit) syncFxFromModel();   // formula bar always mirrors the live model (paste/undo/fill/delete)
  requestRender();
}
function markDirty() {
  state.modified = Date.now();
  state.dirty = true;
  if (state.autosave) X.saveDoc(true);
  updateTitleDirty();
}
X.markDirty = markDirty;
function updateTitleDirty() {
  document.title = state.bookName + ' - Excel';
}

/* ============================ 10. UNDO / REDO ============================ */
const undoStack = [], redoStack = [];
function snapState() {
  return JSON.stringify({
    sheets: state.sheets.map(s => ({ name: s.name, cells: s.cells, colW: s.colW, rowH: s.rowH, hidC: s.hidC, hidR: s.hidR, merges: s.merges, subOf: s.subOf, tables: s.tables, validations: s.validations, outline: s.outline, charts: s.charts, notes: s.notes, freeze: s.freeze })),
    active: state.active, sel: state.sel, showFormulas: state.showFormulas,
  });
}
function restoreState(json) {
  const d = JSON.parse(json);
  d.sheets.forEach((sd, i) => {
    const sh = state.sheets[i] = state.sheets[i] || newSheet(sd.name);
    Object.assign(sh, JSON.parse(JSON.stringify(sd)));
  });
  state.sheets.length = d.sheets.length;
  state.active = Math.min(d.active, state.sheets.length - 1);
  state.sel = d.sel; state.showFormulas = d.showFormulas;
  for (const k of Object.keys(astCache)) delete astCache[k];
  rebuildGeom(); updateSpacer(); recalcAll();
  renderSheetTabs(); afterSelChange();
  requestRender();
}
function pushUndo(label) {
  if (!state.undoOn) return;
  undoStack.push({ label, json: snapState() });
  if (undoStack.length > 80) undoStack.shift();
  redoStack.length = 0;
  $('#qat-undo').classList.remove('off');
  $('#qat-redo').classList.add('off');
}
X.pushUndo = pushUndo;
function doUndo() {
  if (!undoStack.length) return;
  redoStack.push({ label: 'redo', json: snapState() });
  const u = undoStack.pop();
  restoreState(u.json);
  if (!undoStack.length) $('#qat-undo').classList.add('off');
  $('#qat-redo').classList.remove('off');
  sbMsg('Undo ' + u.label);
}
function doRedo() {
  if (!redoStack.length) return;
  undoStack.push({ label: 'undo', json: snapState() });
  const rd = redoStack.pop();
  restoreState(rd.json);
  if (!redoStack.length) $('#qat-redo').classList.add('off');
  $('#qat-undo').classList.remove('off');
  sbMsg('Redo');
}
X.doUndo = doUndo; X.doRedo = doRedo;

/* ============================ 11. EDITING ============================ */
let edit = null; // {r,c,mode:'replace'|'edit',val,refBoxes:[],target:'cell'|'fx'}
X.editState = () => edit;
function startEdit(initial, mode) {
  const cur0 = curCell();
  if (state.protected && cellLocked(cur0.r, cur0.c)) { sbMsg('The cell or chart you are trying to change is on a protected sheet.'); return; }
  if (edit) return;
  const s = state.sel;
  const r = cur0.r, c = cur0.c;
  const cd = cellGet(r, c);
  let cur = '';
  if (mode !== 'replace') {
    if (cd) cur = cd.v != null ? String(cd.v) : '';
  }
  const val = mode === 'replace' ? (initial != null ? initial : '') : (initial != null ? initial : cur);
  edit = { r, c, mode: 'edit', val, refBoxes: [], caretRef: false };
  // editor over cell
  const v = viewSize(), fz = fzDims();
  const z = Z();
  const sp = mergeAt(sheet(), r, c);
  const cc2 = sp ? sp.c2 : c, rr2 = sp ? sp.r2 : r;
  const x = cellVpX(sp ? sp.c1 : c, v, fz) - 1, y = cellVpY(sp ? sp.c1 : r, v, fz) - 1;
  const w = cellVpX(cc2, v, fz) + colWpx(cc2) * z - x, h = cellVpY(rr2, v, fz) + rowHpx(rr2) * z - y;
  const wrap = $('#cell-editor-wrap');
  const s2 = (cd && cd.s) || {};
  wrap.style.cssText = `left:${x - 1}px;top:${y - 1}px;min-width:${w + 2}px;min-height:${h + 2}px;width:${Math.max(60, w + 2)}px;height:${Math.max(h + 2, 20)}px;`;
  wrap.dataset.bw = Math.max(60, w + 2); wrap.dataset.bh = Math.max(h + 2, 20);
  wrap.style.zIndex = 20;
  wrap.hidden = false;
  const ed = $('#cell-editor');
  ed.value = val;
  ed.style.cssText = `font-family:${s2.font || state.fonts};font-size:${((s2.size || 11) * z).toFixed(1)}pt;${s2.b ? 'font-weight:700;' : ''}text-align:${s2.halign || 'left'};white-space:${s2.wrap ? 'pre-wrap' : 'pre'};`;
  const mir = $('#cell-mirror');
  mir.style.cssText = ed.style.cssText;
  ed.classList.add('fxm');
  updateMirrors();
  setTimeout(() => { ed.focus(); ed.setSelectionRange(mode === 'replace' ? 0 : ed.value.length, ed.value.length); if (mode === 'replace' && initial) ed.setSelectionRange(ed.value.length, ed.value.length); }, 0);
  sbMode('Edit');
  $('#fx-cancel').hidden = $('#fx-enter').hidden = false;
  syncFxFromEdit();
}
X.startEdit = startEdit;
function refTokensHighlight(str) {
  /* colorize refs/ranges with palette; returns {html, boxes}
     BYTE-EXACT by construction: every input character is either copied verbatim
     or wrapped in a span — the mirror can NEVER drift from the textarea text,
     regardless of spaces, number notation, quoting or case. (Token-based
     rendering dropped spaces, normalized 5E-3 -> 0.005, lost '1Q'! quotes and
     "" escapes — each one made typed formula text slide out of view.) */
  if (!str.startsWith('=')) return { html: esc(str), boxes: [] };
  const CLS = ['tkb', 'tkr', 'tkp', 'tkg'];
  let html = '=', ci = -1, i = 1;
  const n = str.length;
  const refWord = w => /^(\$?[A-Za-z]{1,3}\$?[0-9]+)$/.test(w);
  while (i < n) {
    const ch = str[i];
    if (ch === "'") {                       // quoted sheet name 'My Sheet'! / '1Q'!
      let j = i + 1;
      while (j < n) { if (str[j] === "'") { if (str[j + 1] === "'") { j += 2; continue; } break; } j++; }
      if (str[j] === "'" && str[j + 1] === '!') { html += esc(str.slice(i, j + 2)); i = j + 2; continue; }
      html += esc(ch); i++; continue;
    }
    if (ch === '"') {                       // string literal (keeps doubled quotes)
      let j = i + 1;
      while (j < n) { if (str[j] === '"') { if (str[j + 1] === '"') { j += 2; continue; } break; } j++; }
      const endS = Math.min(n, j + 1);
      html += `<span class="tkg">${esc(str.slice(i, endS))}</span>`; i = endS; continue;
    }
    if (/[A-Za-z_$\\]/.test(ch)) {        // identifier / ref / C:C range / sheet!
      let j = i; while (j < n && /[A-Za-z0-9_.$]/.test(str[j])) j++;
      const word = str.slice(i, j);
      if (str[j] === '!' && /^[A-Za-z_][A-Za-z0-9_. ]*$/.test(word)) { html += esc(word + '!'); i = j + 1; continue; }
      if (refWord(word) && str[j] !== '(') {
        let end = j, over = word;
        if (str[j] === ':') {
          let m = j + 1; while (m < n && /[A-Za-z0-9_.$]/.test(str[m])) m++;
          const w2 = str.slice(j + 1, m);
          if (refWord(w2)) { over = word + ':' + w2; end = m; }
        }
        ci++; html += `<span class="${CLS[ci % 4]}">${esc(over)}</span>`; i = end; continue;
      }
      /* whole-column range C:F (both sides bare letters, next char not '(') */
      if (/^[A-Za-z]{1,3}$/.test(word) && str[j] === ':') {
        let m = j + 1; while (m < n && /[A-Za-z0-9_.$]/.test(str[m])) m++;
        const w2 = str.slice(j + 1, m);
        if (/^[A-Za-z]{1,3}$/.test(w2) && str[m] !== '(') { ci++; html += `<span class="${CLS[ci % 4]}">${esc(word + ':' + w2)}</span>`; i = m; continue; }
      }
      html += esc(word); i = j; continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(str[i + 1] || ''))) {  // number (verbatim: 5E-3 stays 5E-3)
      let j = i; while (j < n && /[0-9.]/.test(str[j])) j++;
      if ((str[j] === 'E' || str[j] === 'e') && /[0-9+-]/.test(str[j + 1] || '')) {
        let m = j + 1; if (str[m] === '+' || str[m] === '-') m++;
        while (m < n && /[0-9]/.test(str[m])) m++; j = m;
      } else if (str[j] === ':' && /[0-9]/.test(str[j + 1] || '') && /^[0-9]+$/.test(str.slice(i, j))) {
        // whole-row range 3:7
        let m = j + 1; while (m < n && /[0-9]/.test(str[m])) m++;
        ci++; html += `<span class="${CLS[ci % 4]}">${esc(str.slice(i, m))}</span>`; i = m; continue;
      }
      html += esc(str.slice(i, j)); i = j; continue;
    }
    html += esc(ch); i++;                   // spaces, operators, parens — verbatim
  }
  return { html, boxes: [] };
}
function updateMirrors() {
  const ed = $('#cell-editor');
  const src = ed.value;
  const mir = $('#cell-mirror');
  const res = refTokensHighlight(src);
  mir.innerHTML = res.html + '​';
  // fx mirror
  const fx = $('#fx-input');
  const fxm = $('#fx-mirror');
  const res2 = refTokensHighlight(fx.value || '');
  fxm.innerHTML = res2.html + '​';
  $('#fx-input').classList.toggle('fxm', !!src.startsWith('='));
  ensureFxCaretVisible();
  // mirrors must EXACTLY track their textarea's scroll — otherwise colored text
  // and the (transparent) input text drift apart and text appears "invisible"
  mir.scrollTop = ed.scrollTop; mir.scrollLeft = ed.scrollLeft;
  fxm.scrollTop = fx.scrollTop; fxm.scrollLeft = fx.scrollLeft;
  growEditor();
  updateRefBoxes();
}
X.updateMirrors = updateMirrors;

const _mcv = (typeof document !== 'undefined') ? document.createElement('canvas').getContext('2d') : null;
/* keep the fx bar's caret position on-screen while typing (Excel tracks the caret;
   a scrolled-stuck formula bar is what made text "invisible") */
function ensureFxCaretVisible() {
  if (!edit) return;
  const ed = $('#cell-editor'), fx = $('#fx-input');
  if (fx.matches(':focus')) return;          // browser tracks the caret natively when editing in the bar
  const caret = ed.selectionEnd != null ? ed.selectionEnd : fx.value.length;
  const upto = fx.value.slice(0, caret);
  const nl = upto.lastIndexOf('\n');
  const pref = upto.slice(nl + 1);
  if (_mcv) _mcv.font = '13px Calibri, \'Segoe UI\', sans-serif';
  const pw = (_mcv ? _mcv.measureText(pref).width : pref.length * 7) + 10;
  if (pw < fx.scrollLeft + 4) fx.scrollLeft = Math.max(0, pw - 18);
  else if (pw > fx.scrollLeft + fx.clientWidth - 14) fx.scrollLeft = Math.max(0, pw - fx.clientWidth + 18);
  const lineNo = (upto.match(/\n/g) || []).length;
  const y = lineNo * 19;
  if (y < fx.scrollTop) fx.scrollTop = y;
  else if (y + 19 > fx.scrollTop + fx.clientHeight) fx.scrollTop = Math.max(0, y + 19 - fx.clientHeight);
}

/* Excel-style in-cell editing: the edit box GROWS with content (right/down),
   never covers itself with a browser scrollbar; beyond the cap a thin themed
   scrollbar appears. */
function growEditor() {
  const wr = $('#cell-editor-wrap');
  if (!wr || wr.hidden) return;
  const ed = $('#cell-editor'), mir = $('#cell-mirror');
  const bw = parseFloat(wr.dataset.bw) || 60, bh = parseFloat(wr.dataset.bh) || 20;
  /* mirror is width/height:max-content — offsetWidth/Height are the NATURAL content
     size, independent of the wrap (no feedback loop) */
  const needW = mir.offsetWidth + 16;
  const needH = mir.offsetHeight + 8;
  const gs = $('#grid-scroll').getBoundingClientRect();
  const wl = wr.getBoundingClientRect().left;
  const maxW = Math.max(160, gs.right - wl - 46);
  const W = Math.max(bw, Math.min(needW, maxW));
  const H = Math.max(bh, Math.min(needH, 150));
  wr.style.width = Math.round(W) + 'px';
  wr.style.height = Math.round(H) + 'px';
  ed.classList.toggle('capped', needH > 150);
}
function updateRefBoxes() {
  // draw colored boxes around referenced cells while editing
  const ed = $('#cell-editor');
  if (!edit || !ed.value.startsWith('=')) { clearRefBoxes(); return; }
  const src = ed.value;
  const toks = Calc.tokenize(src.slice(1));
  clearRefBoxes();
  if (!toks) return;
  const layer = selLayer();
  if (!layer) return;
  const v = viewSize(), fz = fzDims();
  const CREF = ['#2B78C5', '#C93C3C', '#8E44AD', '#1A7A4A'];
  let colorIdx = -1;
  const parts = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === 'sheet') { tokens_sheet = t.v; continue; }
    if (t.t !== 'ref') continue;
    let sheetNm = tokens_sheet; tokens_sheet = null;
    const sh2 = sheetNm ? sheetByName(sheetNm) : sheet();
    if (sh2 !== sheet()) continue;
    let a = Calc.parseRef(t.v), b = a;
    if (toks[i + 1] && toks[i + 1].t === 'op' && toks[i + 1].v === ':' && toks[i + 2] && toks[i + 2].t === 'ref') { b = Calc.parseRef(toks[i + 2].v); i += 2; }
    if (!a || a.colOnly || a.rowOnly) continue;
    colorIdx++;
    const col = CREF[colorIdx % 4];
    const r1 = Math.min(a.r, b.r == null ? a.r : b.r), r2 = Math.max(a.r, b.r == null ? a.r : b.r);
    const c1 = Math.min(a.c, b.c == null ? a.c : b.c), c2 = Math.max(a.c, b.c == null ? a.c : b.c);
    const R = selViewportRect(v, fz, { r1, r2, c1, c2 });
    parts.push(`<div class="edit-refbox" style="left:${R.x1}px;top:${R.y1}px;width:${R.x2 - R.x1}px;height:${R.y2 - R.y1}px;border-color:${col}"></div>`);
  }
  edit._refHtml = parts.join('');
  layer.innerHTML = layer.innerHTML + edit._refHtml;
}
var tokens_sheet = null;
function clearRefBoxes() { $$('.edit-refbox').forEach(x => x.remove()); }
function syncFxFromModel() {
  const s = state.sel;
  if (!s) return;
  const cur0 = curCell();
  const cd = cellGet(cur0.r, cur0.c);
  const fx = $('#fx-input');
  if (edit) return;
  // protected sheet + Hidden style conceals the formula in the formula bar (Excel behavior)
  if (state.protected && cd && cd.s && cd.s.hidden) fx.value = '';
  else fx.value = cd ? (cd.v != null ? String(cd.v) : '') : '';  $('#fx-mirror').innerHTML = esc(fx.value) + ' ';
  $('#fx-input').classList.remove('fxm');
  fx.scrollTop = 0; fx.scrollLeft = 0;    // never leave long formulas scrolled out of sight
}
function syncFxFromEdit() {
  if (!edit) return;
  const ed = $('#cell-editor');
  if (!$('#fx-input').matches(':focus')) $('#fx-input').value = ed.value;
}
function sbMode(m) { $('#sb-mode').textContent = m; }
X.sbMode = sbMode;
function sbMsg(m) {
  $('#sb-msg').textContent = m || '';
  if (m) { clearTimeout(sbMsg._t); sbMsg._t = setTimeout(() => { $('#sb-msg').textContent = ''; }, 6000); }
}
/* dark mode — View > Dark Mode; persisted in IndexedDB as xc.theme */
function setDark(v) {
  state.dark = !!v;
  document.body.classList.toggle('dark', state.dark);
  if (window.XKV) XKV.set('xc.theme', state.dark ? 'dark' : 'light');
  requestRender();
}
X.setDark = setDark;
X.sbMsg = sbMsg;

function endEdit(save, moveDir) {
  if (!edit) return;
  const ed = $('#cell-editor');
  const str = ed.value;
  const { r, c } = edit;
  $('#cell-editor-wrap').hidden = true;
  clearRefBoxes();
  edit = null;
  $('#fx-cancel').hidden = $('#fx-enter').hidden = true;
  sbMode('Ready');
  if (save) {
    commitCell(r, c, str);
    /* committing with Enter/Tab cycles the active cell within a block (Excel) */
    if (moveDir === 'down') moveActive(1, 0, false, true);
    else if (moveDir === 'up') moveActive(-1, 0, false, true);
    else if (moveDir === 'right') moveActive(0, 1, false, true);
    else if (moveDir === 'left') moveActive(0, -1, false, true);
  }
  syncFxFromModel();
  /* skip the redundant refresh when a move just happened: moveActive funnels
     through afterSelChange itself, and a second call would wipe the s.cur it
     may have just set for in-block cycling (_keepCur is single-use) */
  if (!(save && moveDir)) afterSelChange();
  focusGrid();
}
X.endEdit = endEdit;

/* point mode: clicking cells while editing inserts refs */
function insertRefAtCaret(r1, c1, r2, c2, isRange) {
  if (!edit) return false;
  const ed = $('#cell-editor');
  const s2 = state.sel;
  const refStr = isRange ? `${a1(r1, c1)}:${a1(r2, c2)}` : a1(r1, c1);
  const st = ed.selectionStart, en = ed.selectionEnd;
  const v = ed.value;
  ed.value = v.slice(0, st) + refStr + v.slice(en);
  ed.setSelectionRange(st + refStr.length, st + refStr.length);
  edit.caretRef = true;
  updateMirrors();
  return true;
}
X.insertRefAtCaret = insertRefAtCaret;

/* F4 cycle $ in current ref at caret */
function cycleDollar() {
  if (!edit) return;
  const ed = $('#cell-editor');
  const v = ed.value, pos = ed.selectionStart;
  const m = v.slice(0, pos).match(/(\$?)([A-Z]{1,3})(\$?)([0-9]+)(?::(\$?)([A-Z]{1,3})(\$?)([0-9]+))?$/);
  if (!m) return;
  const forms = [mm => mm, mm => mm.replace(/^(\$?)([A-Z]+)(\$?)([0-9]+)/, (x, d1, L, d2, N) => '$' + L + '$' + N), mm => mm.replace(/^(\$?)([A-Z]+)(\$?)([0-9]+)/, (x, d1, L, d2, N) => L + '$' + N), mm => mm.replace(/(\$?)([A-Z]+)(\$?)([0-9]+)/, (x, d1, L, d2, N) => '$' + L + N), mm => mm.replace(/\$/g, '')];
  const cAbs = m[1] === '$', rAbs = m[3] === '$';
  const state2 = !cAbs && !rAbs ? 0 : cAbs && rAbs ? 1 : !cAbs && rAbs ? 2 : 3;
  let seg = m[0];
  const letters = seg.replace(/[^A-Z$0-9:]/g, '');
  let repl = seg;
  const parts = seg.split(':').map(p => {
    const m2 = p.match(/(\$?)([A-Z]+)(\$?)([0-9]+)/);
    if (!m2) return p;
    const next = (state2 + 1) % 4;
    const L = m2[2], N = m2[4];
    return next === 0 ? L + N : next === 1 ? '$' + L + '$' + N : next === 2 ? L + '$' + N : '$' + L + N;
  });
  repl = parts.join(':');
  const nv = v.slice(0, pos - m[0].length) + repl + v.slice(pos);
  ed.value = nv;
  ed.setSelectionRange(pos - m[0].length + repl.length, pos - m[0].length + repl.length);
  updateMirrors();
}
X.cycleDollar = cycleDollar;

/* ============================ 12. NAVIGATION ============================ */
function focusGrid() { $('#grid-scroll').focus({ preventScroll: true }); }
X.focusGrid = focusGrid;
/* true if any merged range overlaps rectangle n {r1,c1,r2,c2} */
function blockHasMerge(sh, n) {
  for (const m of sh.merges) {
    if (m.r2 >= n.r1 && m.r1 <= n.r2 && m.c2 >= n.c1 && m.c1 <= n.c2) return true;
  }
  return false;
}
X.blockHasMerge = blockHasMerge;
function moveActive(dR, dC, shift, cycleOK) {
  if (edit) return;
  const s = state.sel;
  if (!s) { setSel({ r: 0, c: 0 }); return; }
  if (shift) {
    let nr = s.b.r + dR, nc = s.b.c + dC;
    s.b = { r: clamp(nr, 0, MAXR - 1), c: clamp(nc, 0, MAXC) };
    s.type = 'cell';
    snapToMergeExtend();
    scrollCellVisible(s.b.r, s.b.c);
  } else {
    const cur0 = curCell();
    const base = mergeAt(sheet(), cur0.r, cur0.c);
    let r = cur0.r + dR, c = cur0.c + dC;
    if (base) {
      if (dR > 0) r = base.r2 + 1; else if (dR < 0) r = base.r1 - 1;
      if (dC > 0) c = base.c2 + 1; else if (dC < 0) c = base.c1 - 1;
    }
    /* Excel: Tab/Enter inside a multi-cell block moves the ACTIVE CELL within
       the block and loops at the edges — the block itself survives. Applies to
       ordinary drag selections as well as Ctrl multi-range selections. Only
       Tab/Enter (and post-commit moves) cycle — plain arrows collapse the
       block. The anchor (s.a) and far corner (s.b) are left untouched so the
       block stays painted; the roaming active cell lives in s.cur. Blocks
       overlapping a merge are skipped (merge-span movement above handles them
       so the active cell can never land inside a merged region). */
    const block = (cycleOK && s.type === 'cell' && (Math.abs(dR) + Math.abs(dC) === 1)) ? normSel() : null;
    if (block && (block.r1 !== block.r2 || block.c1 !== block.c2) && !blockHasMerge(sheet(), block)) {
      let ar = clamp(cur0.r, block.r1, block.r2), ac = clamp(cur0.c, block.c1, block.c2);
      if (dC > 0) { ac++; if (ac > block.c2) { ac = block.c1; ar = ar + 1 > block.r2 ? block.r1 : ar + 1; } }
      else if (dC < 0) { ac--; if (ac < block.c1) { ac = block.c2; ar = ar - 1 < block.r1 ? block.r2 : ar - 1; } }
      else if (dR > 0) { ar++; if (ar > block.r2) { ar = block.r1; ac = ac + 1 > block.c2 ? block.c1 : ac + 1; } }
      else if (dR < 0) { ar--; if (ar < block.r1) { ar = block.r2; ac = ac - 1 < block.c1 ? block.c2 : ac - 1; } }
      s.cur = { r: ar, c: ac };
      s._keepCur = true;
      scrollCellVisible(ar, ac);
      afterSelChange();
      return;
    }
    r = clamp(r, 0, MAXR - 1); c = clamp(c, 0, MAXC);
    // skip hidden
    while (directionSkip(r, c, dR, dC)) { r += dR; c += dC; r = clamp(r, 0, MAXR - 1); c = clamp(c, 0, MAXC); }
    s.a = { r, c }; s.b = { r, c }; s.type = 'cell'; s.ranges = [];
    const m2 = mergeAt(sheet(), r, c);
    if (m2) { s.a = { r: m2.r1, c: m2.c1 }; s.b = { r: m2.r2, c: m2.c2 }; }
    scrollCellVisible(r, c);
  }
  afterSelChange();
}
X.moveActive = moveActive;
function directionSkip(r, c, dR, dC) {
  const sh = sheet();
  if (dR && sh.hidR[r]) return true;
  if (dC && sh.hidC[c]) return true;
  return false;
}
function snapToMergeExtend() {
  const s = state.sel, sh = sheet();
  const m1 = mergeAt(sh, s.a.r, s.a.c), m2 = mergeAt(sh, s.b.r, s.b.c);
  if (m1) { s.a = { r: Math.min(s.a.r, m1.r1, m1.r2), c: Math.min(s.a.c, m1.c1, m1.c2) }; }
  if (m2) { s.b = { r: Math.max(s.b.r, m2.r1, m2.r2), c: Math.max(s.b.c, m2.c1, m2.c2) }; }
}
function jumpEdge(dR, dC) {
  // Ctrl+Arrow: jump to edge of data region (from the active cell)
  const s = state.sel;
  let { r, c } = curCell();
  const sh = sheet();
  const empty = (rr, cc) => { const d = cellDisplay(rr, cc); return !d || d.text === ''; };
  const startEmpty = empty(r, c);
  let nr = r, nc = c;
  const step = 200;
  if (dC) {
    let cc = c;
    for (let i = 0; i < MAXC; i++) {
      const n2 = cc + dC;
      if (n2 < 0 || n2 > MAXC) break;
      if (startEmpty && !empty(nr, n2)) { nc = n2; break; }
      if (!startEmpty && empty(nr, n2)) { nc = cc; break; }
      nc = cc = n2;
    }
  } else {
    let rr = r;
    for (let i = 0; i < MAXR; i++) {
      const n2 = rr + dR;
      if (n2 < 0 || n2 > MAXR - 1) break;
      if (startEmpty && !empty(n2, nc)) { nr = n2; break; }
      if (!startEmpty && empty(n2, nc)) { nr = rr; break; }
      nr = rr = n2;
    }
  }
  s.a = { r: nr, c: nc }; s.b = { r: nr, c: nc }; s.ranges = [];
  scrollCellVisible(nr, nc);
  afterSelChange();
}
X.jumpEdge = jumpEdge;
function scrollCellVisible(r, c) {
  const gs = $('#grid-scroll');
  const v = viewSize(), fz = fzDims(), z = Z();
  if (c >= fz.c) {
    const x1 = cellVpX(c, v, fz), x2 = x1 + colWpx(c) * z;
    if (x1 < HDRW + fz.w) gs.scrollLeft += x1 - (HDRW + fz.w) - 2;
    else if (x2 > v.w) gs.scrollLeft += x2 - v.w + 2;
  }
  if (r >= fz.r) {
    const y1 = cellVpY(r, v, fz), y2 = y1 + rowHpx(r) * z;
    if (y1 < HDRH + fz.h) gs.scrollTop += y1 - (HDRH + fz.h) - 2;
    else if (y2 > v.h) gs.scrollTop += y2 - v.h + 2;
  }
  requestRender();
}
X.scrollCellVisible = scrollCellVisible;
function pageMove(dir) {
  const gs = $('#grid-scroll');
  const rows = Math.max(1, Math.floor((viewSize().h - HDRH - fzDims().h) / (DEFAULT_ROWH * Z())) - 1);
  moveActive(rows * dir, 0, false);
}
X.pageMove = pageMove;

/* ============================ 13. CLIPBOARD ============================ */
function copySel(cut) {
  const s = state.sel;
  if (!s) return;
  /* multi-selection geometry check (Excel): non-adjacent ranges may only be
     copied when they line up on shared rows or shared columns — anything else
     raises "This action won't work on multiple selections." */
  const rngs = (s.ranges || []).filter(Boolean);
  if (rngs.length > 1) {
    const b = rngs[0];
    const sameRows = rngs.every(rg => rg.r1 === b.r1 && rg.r2 === b.r2);
    const sameCols = rngs.every(rg => rg.c1 === b.c1 && rg.c2 === b.c2);
    if (!sameRows && !sameCols) {
      X.msgBox('Microsoft Excel', "This action won't work on multiple selections.", { icon: 'warn' });
      return false;
    }
  }
  const n = normSel();
  const sh = sheet();
  const cells = [];
  for (let r = n.r1; r <= n.r2; r++) {
    const row = [];
    for (let c = n.c1; c <= n.c2; c++) {
      const cd = cellGet(r, c);
      row.push(cd ? JSON.parse(JSON.stringify(cd)) : null);
    }
    cells.push(row);
  }
  state.clipboard = { mode: cut ? 'cut' : 'copy', sheetId: state.active, r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2, cells, srcMerges: JSON.parse(JSON.stringify(sh.merges.filter(m => m.r1 >= n.r1 && m.r2 <= n.r2 && m.c1 >= n.c1 && m.c2 <= n.c2))) };
  systemWrite();
  sbMsg(cut ? 'Cut selection to clipboard' : 'Copied selection to clipboard');
  requestRender();
}
X.copySel = copySel;
function systemWrite() {
  // TSV of display values
  const cb = state.clipboard;
  let out = '';
  for (let r = cb.r1; r <= cb.r2; r++) {
    const line = [];
    for (let c = cb.c1; c <= cb.c2; c++) {
      const d = cellDisplay(r, c);
      line.push(d ? d.text : '');
    }
    out += line.join('\t') + '\n';
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.replace(/\n$/, '')).catch(() => {});
}
function pasteAt(r0, c0, mode) {
  // mode: null=normal paste, 'values', 'formulas', 'formats', 'transpose'
  const cb = state.clipboard;
  if (!cb) return false;
  const dstSh = sheet();
  const rows = cb.cells.length, cols = cb.cells[0].length;
  const tr = mode === 'transpose';
  const rowsOut = tr ? cols : rows, colsOut = tr ? rows : cols;
  // unmerge target area
  pushUndo('Paste');
  if (cb.mode === 'cut' && cb.sheetId === state.active) {
    // clear source
    for (let r = cb.r1; r <= cb.r2; r++) for (let c = cb.c1; c <= cb.c2; c++) cellDelete(r, c);
    clearMergesIn({ r1: cb.r1, c1: cb.c1, r2: cb.r2, c2: cb.c2 });
  }
  clearMergesIn({ r1: r0, c1: c0, r2: r0 + rowsOut - 1, c2: c0 + colsOut - 1 });
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const src = cb.cells[i][j];
      const rr = tr ? r0 + j : r0 + i, cc = tr ? c0 + i : c0 + j;
      if (rr > MAXR - 1 || cc > MAXC) continue;
      if (!src) {
        if (mode !== 'formats') cellDelete(rr, cc);
        continue;
      }
      if (mode === 'values') {
        const d = cellDisplay(cb.r1 + i, cb.c1 + j);
        if (d) { const cd = cellEnsure(rr, cc); cd.v = d.raw != null ? String(d.raw) : d.text; cd.t = d.t === 'n' ? 'n' : d.t === 'b' ? 'b' : d.t === 'e' ? 'e' : 's'; cd.num = d.t === 'n' || d.t === 'b' ? cb.cells[i][j].num : cd.v; cd.spark = null; cd.link = null; }
        else cellDelete(rr, cc);
        continue;
      }
      if (mode === 'formats') {
        if (src.s) cellEnsure(rr, cc).s = JSON.parse(JSON.stringify(src.s));
        continue;
      }
      const cd = cellEnsure(rr, cc);
      const copy = JSON.parse(JSON.stringify(src));
      if (copy.t === 'f') copy.v = Calc.adjustFormula(copy.v, cc - (cb.c1 + j), rr - (cb.r1 + i));
      Object.assign(cd, copy);
      if (mode === 'transpose') { /* already positioned */ }
    }
  }
  // recreate merges
  if (!mode || mode === 'normal') {
    (cb.srcMerges || []).forEach(m => {
      const mm = { r1: r0 + (m.r1 - cb.r1), c1: c0 + (m.c1 - cb.c1), r2: r0 + (m.r2 - cb.r1), c2: c0 + (m.c2 - cb.c1) };
      if (doMerge(mm, true)) dstSh.merges.push(mm), rebuildSubOf();
    });
  }
  if (cb.mode === 'cut') state.clipboard = null;
  scheduleRecalc();
  markDirty();
  afterDataChange();
  setSel({ r: r0, c: c0 }, { r: r0 + rowsOut - 1, c: c0 + colsOut - 1 });
  sbMsg('Pasted');
  return true;
}
X.pasteAt = pasteAt;
function clearMergesIn(n) {
  const sh = sheet();
  sh.merges = sh.merges.filter(m => m.r2 < n.r1 || m.r1 > n.r2 || m.c2 < n.c1 || m.c1 > n.c2);
  rebuildSubOf();
}
X.clearMergesIn = clearMergesIn;
function rebuildSubOf() {
  const sh = sheet();
  sh.subOf = {};
  for (const m of sh.merges) {
    for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) {
      if (r === m.r1 && c === m.c1) continue;
      sh.subOf[keyOf(r, c)] = keyOf(m.r1, m.c1);
    }
  }
}
X.rebuildSubOf = rebuildSubOf;
X.rebuildSubOfFor = function (sh) {
  sh.subOf = {};
  for (const m of sh.merges) {
    for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) {
      if (r === m.r1 && c === m.c1) continue;
      sh.subOf[keyOf(r, c)] = keyOf(m.r1, m.c1);
    }
  }
};
X.newSheetBlank = newSheet;
function doMerge(m, skipCleanup) {
  const sh = sheet();
  if (m.r2 > MAXR - 1 || m.c2 > MAXC || m.r1 < 0 || m.c1 < 0) return false;
  if (!skipCleanup) clearMergesIn(m);
  // keep master content; clear others
  for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) {
    if (r === m.r1 && c === m.c1) continue;
    cellDelete(r, c);
  }
  return true;
}
X.doMerge = doMerge;
function pasteTSV(text, r0, c0) {
  const rows = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
  if (!rows.length || (rows.length === 1 && rows[0][0] === '' && !text)) return false;
  pushUndo('Paste');
  let n = 0;
  clearMergesIn({ r1: r0, c1: c0, r2: r0 + rows.length, c2: c0 + rows[0].length });
  rows.forEach((cells, i) => {
    cells.forEach((val, j) => {
      const rr = r0 + i, cc = c0 + j;
      if (rr > MAXR - 1 || cc > MAXC) return;
      commitCell(rr, cc, val, { skipUndo: true });
      n++;
    });
  });
  setSel({ r: r0, c: c0 }, { r: r0 + rows.length - 1, c: c0 + rows[0].length - 1 });
  sbMsg(`Pasted ${n} cells`);
  return true;
}
X.pasteTSV = pasteTSV;

/* ============================ 14. DELETE / CLEAR / INSERT CELLS ============================ */
function clearContents() {
  pushUndo('Clear');
  eachRangeCell((r, c) => {
    if (state.sel.type !== 'cell' && state.sel.type !== 'all') { if (cellUsedBeyond(r, c)) return; }
    cellDelete(r, c);
  });
  scheduleRecalc(); markDirty(); afterDataChange();
  sbMsg('Cleared contents (Delete keeps formats — use Clear All to remove both)');
}
function cellUsedBeyond() { return false; }
X.clearContents = clearContents;
function clearAll() {
  pushUndo('Clear All');
  eachRangeCell((r, c) => cellDelete(r, c));
  clearMergesIn(normSel());
  scheduleRecalc(); markDirty(); afterDataChange();
}
function clearFormats() {
  pushUndo('Clear Formats');
  eachRangeCell((r, c) => { const cd = cellGet(r, c); if (cd) { cd.s = null; cd.f = null; } });
  clearMergesIn(normSel());
  markDirty(); afterDataChange();
}
X.clearAll = clearAll; X.clearFormats = clearFormats;

function insertCells(shift, whole) {
  pushUndo('Insert');
  const n = normSel();
  const sh = sheet();
  const s = state.sel;
  if (whole === 'row' || s.type === 'rows') {
    const count = n.r2 - n.r1 + 1;
    insertRowsAt(n.r1, count);
  } else if (whole === 'col' || s.type === 'cols') {
    const count = n.c2 - n.c1 + 1;
    insertColsAt(n.c1, count);
  } else {
    const move = shift || 'down';
    shiftCells(n, move);
  }
  afterStructural('Insert');
}
function insertRowsAt(r0, count) {
  const sh = sheet();
  remapCells((r, c) => r >= r0 ? { r: r + count, c } : null, 'insert');
  // merges
  sh.merges = sh.merges.filter(m => !(m.r1 >= r0 && m.r2 < r0 + count));
  sh.merges.forEach(m => { if (m.r1 >= r0) { m.r1 += count; m.r2 += count; } else if (m.r2 >= r0) m.r2 += count; });
  const rowH2 = {};
  Object.keys(sh.rowH).forEach(r => { const nr = +r >= r0 ? +r + count : +r; rowH2[nr] = sh.rowH[r]; });
  sh.rowH = rowH2;
  const hid2 = {};
  Object.keys(sh.hidR).forEach(r => { const nr = +r >= r0 ? +r + count : +r; hid2[nr] = true; });
  sh.hidR = hid2;
  // notes
  const notes2 = {};
  Object.keys(sh.notes).forEach(k => { const { r, c } = rcOf(k); notes2[keyOf(r >= r0 ? r + count : r, c)] = sh.notes[k]; });
  sh.notes = notes2;
  adjustAllFormulas(nr => nr.r >= r0 && !nr.rIsAbs ? { ...nr, r: nr.r + count } : null, r0, null);
}
function insertColsAt(c0, count) {
  const sh = sheet();
  remapCells((r, c) => c >= c0 ? { r, c: c + count } : null, 'insert');
  sh.merges = sh.merges.filter(m => !(m.c1 >= c0 && m.c2 < c0 + count));
  sh.merges.forEach(m => { if (m.c1 >= c0) { m.c1 += count; m.c2 += count; } else if (m.c2 >= c0) m.c2 += count; });
  const colW2 = {};
  Object.keys(sh.colW).forEach(c => { const nc = +c >= c0 ? +c + count : +c; colW2[nc] = sh.colW[c]; });
  sh.colW = colW2;
  const hid2 = {};
  Object.keys(sh.hidC).forEach(c => { const nc = +c >= c0 ? +c + count : +c; hid2[nc] = true; });
  sh.hidC = hid2;
  const notes2 = {};
  Object.keys(sh.notes).forEach(k => { const { r, c } = rcOf(k); notes2[keyOf(r, c >= c0 ? c + count : c)] = sh.notes[k]; });
  sh.notes = notes2;
  adjustAllFormulas(nr => nr.c >= c0 && !nr.cIsAbs ? { ...nr, c: nr.c + count } : null, null, c0);
}
function deleteCells(shift, whole) {
  pushUndo('Delete');
  const n = normSel();
  const s = state.sel;
  if (whole === 'row' || s.type === 'rows') deleteRowsAt(n.r1, n.r2 - n.r1 + 1);
  else if (whole === 'col' || s.type === 'cols') deleteColsAt(n.c1, n.c2 - n.c1 + 1);
  else shiftCellsDelete(n, shift || 'up');
  afterStructural('Delete');
}
function deleteRowsAt(r0, count) {
  const sh = sheet();
  clearMergesIn({ r1: r0, r2: r0 + count - 1, c1: 0, c2: MAXC });
  remapCells((r, c) => (r >= r0 && r < r0 + count) ? { del: true } : r >= r0 ? { r: r - count, c } : null, 'delete');
  const rowH2 = {};
  Object.keys(sh.rowH).forEach(r => { if (+r >= r0 && +r < r0 + count) return; rowH2[+r >= r0 ? +r - count : +r] = sh.rowH[r]; });
  sh.rowH = rowH2;
  sh.merges.forEach(m => { if (m.r1 >= r0 + count) { m.r1 -= count; m.r2 -= count; } else if (m.r2 >= r0) m.r2 = Math.max(m.r1, r0 - 1) - 0; });
  const notes2 = {};
  Object.keys(sh.notes).forEach(k => { const { r, c } = rcOf(k); if (r >= r0 && r < r0 + count) return; notes2[keyOf(r >= r0 ? r - count : r, c)] = sh.notes[k]; });
  sh.notes = notes2;
  adjustAllFormulas(nr => nr.r >= r0 + count && !nr.rIsAbs ? { ...nr, r: nr.r - count } : nr.r >= r0 && nr.r < r0 + count ? { ...nr, invalid: true } : null, r0, null, count);
}
function deleteColsAt(c0, count) {
  const sh = sheet();
  clearMergesIn({ c1: c0, c2: c0 + count - 1, r1: 0, r2: MAXR - 1 });
  remapCells((r, c) => (c >= c0 && c < c0 + count) ? { del: true } : c >= c0 ? { r, c: c - count } : null, 'delete');
  const colW2 = {};
  Object.keys(sh.colW).forEach(c => { if (+c >= c0 && +c < c0 + count) return; colW2[+c >= c0 ? +c - count : +c] = sh.colW[c]; });
  sh.colW = colW2;
  sh.merges.forEach(m => { if (m.c1 >= c0 + count) { m.c1 -= count; m.c2 -= count; } else if (m.c2 >= c0) m.c2 = c0 - 1; });
  const notes2 = {};
  Object.keys(sh.notes).forEach(k => { const { r, c } = rcOf(k); if (c >= c0 && c < c0 + count) return; notes2[keyOf(r, c >= c0 ? c - count : c)] = sh.notes[k]; });
  sh.notes = notes2;
  adjustAllFormulas(nr => nr.c >= c0 + count && !nr.cIsAbs ? { ...nr, c: nr.c - count } : nr.c >= c0 && nr.c < c0 + count ? { ...nr, invalid: true } : null, null, c0, count);
}
function shiftCells(n, move) {
  const sh = sheet();
  if (move === 'down') {
    for (let r = MAXR - 1; r >= n.r2 + 1; r--) {} // bounded below by used
    remapCellsDelta(n, move);
  } else {
    remapCellsDelta(n, move);
  }
}
function remapCellsDelta(n, move) {
  clearMergesIn(n);
  remapCells((r, c) => {
    if (r >= n.r1 && r <= n.r2 && c >= n.c1 && c <= n.c2) return null; // hole stays for others to fill
    if (move === 'down') return (r >= n.r1 && r < n.r2 + 1 && c >= n.c1 && c <= n.c2) ? null : null;
    return null;
  }, 'shift', (r, c) => {
    if (c >= n.c1 && c <= n.c2) {
      if (move === 'down' && r >= n.r1 && r <= n.r2) return { r: r + (n.r2 - n.r1 + 1), c };
    }
    if (r >= n.r1 && r <= n.r2) {
      if (move === 'right' && c >= n.c1 && c <= n.c2) return { r, c: c + (n.c2 - n.c1 + 1) };
    }
    return null;
  });
}
function shiftCellsDelete(n, shift) {
  clearMergesIn(n);
  remapCells(null, 'shiftDelete', (r, c) => {
    if (r >= n.r1 && r <= n.r2 && c >= n.c1 && c <= n.c2) return { del: true };
    if (shift === 'up' && c >= n.c1 && c <= n.c2 && r > n.r2) return { r: r - (n.r2 - n.r1 + 1), c };
    if (shift === 'left' && r >= n.r1 && r <= n.r2 && c > n.c2) return { r, c: c - (n.c2 - n.c1 + 1) };
    return null;
  });
}
function remapCells(baseMap, kind, deltaMap) {
  const sh = sheet();
  const next = {};
  const keys = Object.keys(sh.cells).sort((ka, kb) => { const A = rcOf(ka), B = rcOf(kb); return A.r - B.r || A.c - B.c; });
  for (const k of keys) {
    const { r, c } = rcOf(k);
    let dst = deltaMap ? deltaMap(r, c) : null;
    if (dst == null && baseMap) dst = baseMap(r, c);
    if (dst == null) dst = { r, c };
    if (dst.del) continue;
    next[keyOf(dst.r, dst.c)] = sh.cells[k];
  }
  sh.cells = next;
  for (const k of Object.keys(astCache)) delete astCache[k];
}
function adjustAllFormulas(maper, atRow, atCol, count) {
  if (!maper) return;
  for (const sh of state.sheets) {
    for (const k of Object.keys(sh.cells)) {
      const cd = sh.cells[k];
      if (cd.t !== 'f') continue;
      const toks = Calc.tokenize(cd.v.slice(1));
      if (!toks) continue;
      let changed = false;
      for (const t of toks) {
        if (t.t !== 'ref') continue;
        const ref = Calc.parseRef(t.v);
        if (!ref || ref.colOnly || ref.rowOnly) continue;
        const nr = maper({ r: ref.r, c: ref.c, rIsAbs: ref.rAbs, cIsAbs: ref.cAbs });
        if (nr) {
          changed = true;
          if (nr.invalid || nr.r < 0 || nr.c < 0 || nr.r > MAXR - 1 || nr.c > MAXC) { t.v = '#REF!'; t.t = 'id'; }
          else { ref.r = nr.r; ref.c = nr.c; t.v = Calc.refToStr(ref); }
        }
      }
      if (changed) {
        let out = '';
        for (const t of toks) {
          if (t.t === 'str') out += '"' + t.v.replace(/"/g, '""') + '"';
          else if (t.t === 'num') out += String(t.v);
          else if (t.t === 'id' || t.t === 'ref') out += t.v;
          else if (t.t === 'sheet') out += (/[^A-Za-z0-9_.]/.test(t.v) ? `'${t.v}'!` : t.v + '!');
          else if (t.t === '(') out += '(';
          else if (t.t === ')') out += ')';
          else if (t.t === ',') out += t.row ? ';' : ',';
          else if (t.t === 'op') out += t.v;
          else out += t.v !== undefined ? t.v : t.t;
        }
        cd.v = '=' + out;
      }
    }
  }
}
X.insertCells = insertCells; X.deleteCells = deleteCells;
X.insertRowsAt = insertRowsAt; X.insertColsAt = insertColsAt;
X.deleteRowsAt = deleteRowsAt; X.deleteColsAt = deleteColsAt;
function afterStructural(label) {
  rebuildGeom(); updateSpacer(); scheduleRecalc(); markDirty(); renderSheetTabs(); afterDataChange();
}

/* ============================ 15. SORT & FILTER ============================ */
function colHasHeader(n) {
  // heuristic: first row all-text & below rows mixed types
  const sh = sheet();
  let headerish = true;
  for (let c = n.c1; c <= n.c2; c++) {
    const cd = cellGet(n.r1, c);
    const d = cd && cellDisplay(n.r1, c);
    if (!d || d.t !== 's') { headerish = false; break; }
    const belowType = cellDisplay(n.r1 + 1, c);
    if (belowType && belowType.t === 's' && d.text === belowType.text) headerish = false;
  }
  return headerish;
}
function sortRange(n, keys, hasHeader) {
  // keys: [{c, dir}] column idx (absolute) & 1|-1
  pushUndo('Sort');
  const sh = sheet();
  const dataR1 = hasHeader ? n.r1 + 1 : n.r1;
  const rows = [];
  for (let r = dataR1; r <= n.r2; r++) {
    const rec = { r, cells: [], sorts: [] };
    for (const k of keys) {
      const raw = cellRaw(r, k.c);
      rec.sorts.push(raw === null || raw === undefined ? null : raw);
    }
    rows.push(rec);
  }
  rows.sort((A, B) => {
    for (let i = 0; i < keys.length; i++) {
      const a = A.sorts[i], b = B.sorts[i];
      if (a == null && b == null) continue;
      if (a == null) return 1;
      if (b == null) return -1;
      let cmp;
      if (typeof a === 'number' && typeof b === 'number') cmp = a - b;
      else if (typeof a === 'boolean' || typeof b === 'boolean') cmp = (a ? 1 : 0) - (b ? 1 : 0);
      else cmp = String(a).toLowerCase().localeCompare(String(b).toLowerCase());
      if (cmp !== 0) return cmp * keys[i].dir;
    }
    return A.r - B.r;
  });
  // rewrite cells row-wise
  const colCount = n.c2 - n.c1 + 1;
  const snapshot = rows.map(rec => {
    const row = [];
    for (let c = n.c1; c <= n.c2; c++) { const cd = cellGet(rec.r, c); row.push(cd ? JSON.parse(JSON.stringify(cd)) : null); }
    return row;
  });
  rows.forEach((rec, i) => {
    const target = dataR1 + i;
    snapshot[i].forEach((cd, j) => {
      const c = n.c1 + j;
      const k = keyOf(target, c);
      if (cd) {
        const cc = JSON.parse(JSON.stringify(cd));
        if (cc.t === 'f') cc.v = Calc.adjustFormula(cc.v, 0, target - rec.r);
        sh.cells[k] = cc;
      } else delete sh.cells[k];
    });
  });
  for (const k of Object.keys(astCache)) delete astCache[k];
  scheduleRecalc(); markDirty(); afterDataChange();
  sbMsg(`Sorted ${rows.length} rows`);
}
X.sortRange = sortRange; X.colHasHeader = colHasHeader;
function sortSelection(dir) {
  const s = state.sel;
  const n = s.type === 'cols' ? null : (isSingle() ? regionUsed() : normSel());
  if (!n) { const nn = normSel(); sortRange({ r1: 0, r2: usedR2(), c1: nn.c1, c2: nn.c2 }, [{ c: nn.c1, dir }], colHasHeader({ r1: 0, r2: usedR2(), c1: nn.c1, c2: nn.c2 })); return; }
  const keyCol = s.type === 'rows' ? n.c1 : clamp(s.a.c, n.c1, n.c2);
  const hasHeader = colHasHeader(n);
  sortRange(n, [{ c: keyCol, dir }], hasHeader);
}
X.sortSelection = sortSelection;

/* autofilter */
function toggleFilter() {
  const sh = sheet();
  const tids = Object.keys(sh.tables).filter(id => sh.tables[id].isAutoFilter);
  if (tids.length) {
    pushUndo('Filter');
    tids.forEach(id => delete sh.tables[id]);
    unhideAllFilter();
    markDirty(); afterDataChange();
    return;
  }
  const n = isSingle() ? regionUsed() : normSel();
  // single row? detect region header row = n.r1 if cells present
  pushUndo('Filter');
  const id = 'af' + Date.now().toString(36);
  sh.tables[id] = { isAutoFilter: true, r1: n.r1, c1: n.c1, r2: Math.max(n.r2, usedR2()), c2: n.c2, name: '', style: null, headerRow: true, filter: {} };
  markDirty(); afterDataChange();
}
X.toggleFilter = toggleFilter;
function filterRegion() {
  const sh = sheet();
  const tids = Object.keys(sh.tables).filter(id => sh.tables[id].isAutoFilter);
  if (!tids.length) return null;
  return sh.tables[tids[0]];
}
X.filterRegion = filterRegion;
function unhideAllFilter() {
  const sh = sheet();
  Object.keys(sh.hidR).forEach(r => { if (sh._filtHid && sh._filtHid[+r]) delete sh.hidR[+r]; });
  sh._filtHid = {};
}
function applyFilter() {
  const sh = sheet();
  const t = filterRegion();
  if (!t) return;
  unhideAllFilter();
  sh._filtHid = sh._filtHid || {};
  const cols = Object.keys(t.filter);
  if (!cols.length) { afterDataChange(); return; }
  for (let r = t.r1 + 1; r <= t.r2; r++) {
    let hide = false;
    for (const cStr of cols) {
      const c = +cStr;
      const allowed = t.filter[cStr];
      if (!allowed) continue;
      const d = cellDisplay(r, c);
      const txt = d ? d.text : '';
      if (!allowed[txt]) { hide = true; break; }
    }
    if (hide) { sh.hidR[r] = true; sh._filtHid[r] = true; }
  }
  updateTableFilterIcons();
  afterDataChange();
}
X.applyFilter = applyFilter;
function updateTableFilterIcons() {}
X.updateTableFilterIcons = updateTableFilterIcons;
function updateTableTotals() {}
X.updateTableTotals = updateTableTotals;

/* ============================ 16. AUTOFILL ============================ */
let filling = null;
function startFill(v, fz) {
  const n = normSel();
  filling = { sr1: n.r1, sc1: n.c1, sr2: n.r2, sc2: n.c2, tr2: n.r2, tc2: n.c2, dir: null };
  document.addEventListener('mousemove', fillMove);
  document.addEventListener('mouseup', fillEnd, { once: true });
  /* safety net: if the button is released OUTSIDE the window (drag past the
     edge, Alt+Tab, OS blur) the mouseup may never reach the document and the
     autofill ghost would stick on screen until reload. These cover that. */
  window.addEventListener('blur', fillEnd, { once: true });
}
function fillMove(e) {
  if (!filling) return;
  /* button no longer pressed but no mouseup arrived (released outside the
     window): treat the next move as the end of the drag */
  if (e.buttons !== undefined && !(e.buttons & 1)) { fillEnd(); return; }
  const gs = $('#grid-scroll');
  const rect = gs.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const cell = cellAtVp(x, y);
  if (!cell) return;
  const f = filling;
  // decide direction: pick dominant axis
  const dC = cell.c - f.sc2, dCn = f.sc1 - 1 - cell.c;
  const dR = cell.r - f.sr2, dRn = f.sr1 - 1 - cell.r;
  const useCols = Math.max(dC, dCn) > Math.max(dR, dRn) || (Math.max(dR, dRn) <= 0 && Math.max(dC, dCn) > 0);
  if (Math.max(dC, dCn, 0) === 0 && Math.max(dR, dRn, 0) === 0) { // back at origin
    f.tr2 = f.sr2; f.tc2 = f.sc2; f.dir = null;
  } else if (useCols) {
    f.dir = 'c';
    if (dC > 0) f.tc2 = clamp(cell.c, f.sc2, MAXC);
    else f.tc1 = clamp(cell.c, 0, f.sc1 - 1), f.tc2 = f.sc1 - 1;
    if (dC > 0) { f.tc1 = f.sc1; } else { f.tc1 = clamp(cell.c, 0, f.sc1); }
  } else {
    f.dir = 'r';
    if (dR > 0) { f.tr1 = f.sr1; f.tr2 = clamp(cell.r, f.sr2, MAXR - 1); }
    else { f.tr1 = clamp(cell.r, 0, f.sr1), f.tr2 = f.sr1 - 1; }
  }
  paintFillGhost();
}
function cellAtVp(x, y) {
  const v = viewSize(), fz = fzDims(), z = Z();
  let c, r;
  if (x < HDRW || y < HDRH) return null;
  if (x < HDRW + fz.w) c = colAtX((x - HDRW) / z);
  else c = colAtX(colX(fz.c) + (x - HDRW - fz.w + Math.max(0, v.sl - fz.w)) / z);
  if (y < HDRH + fz.h) r = rowAtY((y - HDRH) / z);
  else r = rowAtY(rowY(fz.r) + (y - HDRH - fz.h + Math.max(0, v.st - fz.h)) / z);
  return { r: clamp(r, 0, MAXR - 1), c: clamp(c, 0, MAXC) };
}
X.cellAtVp = cellAtVp;
function paintFillGhost() {
  const f = filling, gs = $('#autofill-ghost');
  const v = viewSize(), fz = fzDims();
  let n;
  if (!f.dir) { gs.hidden = true; return; }
  if (f.dir === 'c') {
    if (f.tc2 > f.sc2) n = { r1: f.sr1, c1: f.sc2 + 1, r2: f.sr2, c2: f.tc2 };
    else n = { r1: f.sr1, c1: f.tc1, r2: f.sr2, c2: f.tc2 };
  } else {
    if (f.tr2 > f.sr2) n = { r1: f.sr2 + 1, c1: f.sc1, r2: f.tr2, c2: f.sc2 };
    else n = { r1: f.tr1, c1: f.sc1, r2: f.tr2, c2: f.sc2 };
  }
  f.target = n;
  const R = selViewportRect(v, fz, n);
  gs.style.cssText = `left:${R.x1}px;top:${R.y1}px;width:${R.x2 - R.x1}px;height:${R.y2 - R.y1}px;display:block;`;
  gs.hidden = false;
}
function fillEnd(e) {
  document.removeEventListener('mousemove', fillMove);
  document.removeEventListener('mouseup', fillEnd);
  window.removeEventListener('blur', fillEnd);
  $('#autofill-ghost').hidden = true;
  if (!filling || !filling.target) { filling = null; return; }
  const f = filling;
  filling = null;
  doFill(f);
}
function doFill(f) {
  pushUndo('AutoFill');
  const sh = sheet();
  const n = f.target;
  const srcRows = f.sr2 - f.sr1 + 1, srcCols = f.sc2 - f.sc1 + 1;
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WD3 = WD.map(x => x.slice(0, 3));
  const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MO3 = MO.map(x => x.slice(0, 3));
  const findSeq = t => {
    const tl = String(t).toLowerCase();
    for (const arr of [WD, WD3, MO, MO3]) { const i = arr.findIndex(x => x.toLowerCase() === tl); if (i >= 0) return { arr, i }; }
    return null;
  };
  for (let r = n.r1; r <= n.r2; r++) {
    for (let c = n.c1; c <= n.c2; c++) {
      // source coordinates (wrap around source span)
      let sr, sc;
      if (f.dir === 'r') {
        sr = f.sr1 + ((r - n.r1) % srcRows + srcRows) % srcRows;
        if (r > f.sr2) sr = f.sr1 + (r - f.sr2 - 1) % srcRows;
        else sr = f.sr2 - (f.sr1 - 1 - r) % srcRows;
        sc = c;
      } else {
        sr = r;
        if (c > f.sc2) sc = f.sc1 + (c - f.sc2 - 1) % srcCols;
        else sc = f.sc2 - (f.sc1 - 1 - c) % srcCols;
      }
      const srcCd = cellGet(sr, sc);
      if (!srcCd) { cellDelete(r, c); continue; }
      const cd = cellEnsure(r, c);
      const copy = JSON.parse(JSON.stringify(srcCd));
      // series detection (only when single source row/col of numbers/dates or patterns)
      const dist = f.dir === 'r' ? (r > f.sr2 ? r - f.sr2 : f.sr1 - r) : (c > f.sc2 ? c - f.sc2 : f.sc1 - c);
      if (copy.t === 'f') {
        copy.v = Calc.adjustFormula(copy.v, f.dir === 'c' ? (c - sc) * (c > f.sc2 ? 1 : -1) * 0 + (c - sc) : 0, f.dir === 'r' ? (r - sr) : 0);
      } else if (copy.t === 'n') {
        if (srcRows === 1 && srcCols === 1) {
          // single numeric: Excel copies (series needs 2+ seeds or dates)
          if (copy.f && /(yy|dd|h:mm)/i.test(copy.f)) {
            const isTime = /h:mm/i.test(copy.f) && !/[myd]/i.test(copy.f);
            copy.num = srcCd.num + dist * (isTime ? 1 / 24 : (copy.f.includes('mm') && copy.f.includes('yy') ? 1 : 1));
          }
        } else if ((f.dir === 'r' ? srcRows : srcCols) > 1) {
          // linear trend from first/last seeds
          const seeds = [];
          if (f.dir === 'r') for (let rr = f.sr1; rr <= f.sr2; rr++) seeds.push(cellRaw(rr, sc));
          else for (let cc = f.sc1; cc <= f.sc2; cc++) seeds.push(cellRaw(sr, cc));
          if (seeds.every(x => typeof x === 'number')) {
            const k = f.dir === 'r' ? (r - f.sr1) / srcRows : (c - f.sc1) / srcCols;
            const step = (seeds[seeds.length - 1] - seeds[0]) / (seeds.length - 1);
            copy.num = seeds[srcIdxOf(r, c, f)] + step * distWithin(r, c, f, seeds.length);
          }
        }
      } else if (copy.t === 's') {
        const t = String(srcCd.num);
        const seq = findSeq(t);
        if (seq) {
          const idx = (seq.i + distOfSrc(r, c, f) * 1 + seq.arr.length * 100) % seq.arr.length;
          copy.num = seq.arr[(idx) % seq.arr.length];
        } else {
          const m = t.match(/^(.*?)(\d+)$/);
          if (m) copy.num = m[1] + (parseInt(m[2], 10) + distOfSrc(r, c, f));
        }
      }
      Object.assign(cd, copy);
      cd.num = copy.num; cd.v = copy.v;
    }
  }
  setSel({ r: f.sr1, c: f.sc1 }, { r: Math.max(f.sr2, n.r2), c: Math.max(f.sc2, n.c2) });
  scheduleRecalc(); markDirty(); afterDataChange();
}
function srcIdxOf(r, c, f) {
  if (f.dir === 'r') return clamp((r <= f.sr2 ? r - f.sr1 : f.sr2 - f.sr1), 0, f.sr2 - f.sr1);
  return clamp((c <= f.sc2 ? c - f.sc1 : f.sc2 - f.sc1), 0, f.sc2 - f.sc1);
}
function distWithin(r, c, f, len) {
  if (f.dir === 'r') return r <= f.sr2 ? 0 : Math.ceil((r - f.sr2) / 1);
  return c <= f.sc2 ? 0 : Math.ceil((c - f.sc2) / 1);
}
function distOfSrc(r, c, f) {
  const srcRows = f.sr2 - f.sr1 + 1, srcCols = f.sc2 - f.sc1 + 1;
  if (f.dir === 'r') return r > f.sr2 ? Math.floor((r - f.sr1) / srcRows) : -Math.ceil((f.sr1 - r) / srcRows);
  return c > f.sc2 ? Math.floor((c - f.sc1) / srcCols) : -Math.ceil((f.sc1 - c) / srcCols);
}
X.doFill = doFill;

/* ============================ 17. SHEETS ============================ */
function uniqueSheetName(base) {
  let n = base, i = 2;
  while (state.sheets.some(s => s.name === n)) { n = base + ' ' + i++; }
  return n;
}
function addSheet(name, gotoIt) {
  pushUndo('Insert Sheet');
  const sh = newSheet(name || uniqueSheetName('Sheet' + (state.sheets.length + 1)));
  state.sheets.push(sh);
  if (gotoIt !== false) state.active = state.sheets.length - 1;
  rebuildGeom(); renderSheetTabs(); afterSelChange(); requestRender();
  return sh;
}
X.addSheet = addSheet;
function selectSheet(i) {
  if (i < 0 || i >= state.sheets.length || i === state.active) return;
  endEdit(true);
  state.active = i;
  rebuildGeom(); updateSpacer();
  renderSheetTabs(); afterSelChange(); recalcAll(); requestRender();
  X.updateProtectUI && X.updateProtectUI();
}
X.selectSheet = selectSheet;
function renameSheet(i, name) {
  name = String(name || '').trim();
  if (!name || state.sheets.some(s => s.name === name)) { sbMsg('That name is already taken or invalid.'); return false; }
  pushUndo('Rename Sheet');
  const old = state.sheets[i].name;
  state.sheets[i].name = name;
  // update formulas & names referencing
  for (const sh of state.sheets) {
    for (const k of Object.keys(sh.cells)) {
      const cd = sh.cells[k];
      if (cd.t === 'f' && (cd.v.includes(old + '!') || cd.v.includes(`'${old}'!`))) {
        cd.v = cd.v.split(`'${old}'!`).join(`'${name}'!`).split(old + '!').join((/[^A-Za-z0-9_.]/.test(name) ? `'${name}'!` : name + '!'));
      }
    }
  }
  Object.keys(state.names).forEach(nm => {
    state.names[nm].ref = state.names[nm].ref.split(`${old}!`).join(`${name}!`).split(`'${old}'!`).join(`'${name}'!`);
  });
  markDirty(); renderSheetTabs(); scheduleRecalc();
  return true;
}
X.renameSheet = renameSheet;
function deleteSheet(i) {
  if (state.sheets.length <= 1) { sbMsg('A workbook must contain at least one sheet.'); return; }
  /* Excel parity: deleting a sheet is a DESTRUCTIVE structural change — the
     whole Undo/Redo transaction history is wiped the moment it happens */
  undoStack.length = 0; redoStack.length = 0;
  $('#qat-undo').classList.add('off'); $('#qat-redo').classList.add('off');
  state.sheets.splice(i, 1);
  state.active = Math.min(state.active, state.sheets.length - 1);
  rebuildGeom(); updateSpacer(); renderSheetTabs(); afterSelChange(); recalcAll(); requestRender(); markDirty();
}
X.deleteSheet = deleteSheet;
function moveSheet(from, to) {
  const [sh] = state.sheets.splice(from, 1);
  state.sheets.splice(to, 0, sh);
  state.active = to;
  renderSheetTabs(); markDirty();
}
X.moveSheet = moveSheet;
function renderSheetTabs() {
  const host = $('#sheet-tabs');
  host.innerHTML = '';
  state.sheets.forEach((sh, i) => {
    const t = el('div', { class: 'shtab' + (i === state.active ? ' active' : ''), draggable: 'true' });
    t.textContent = sh.name;
    t.title = sh.name;
    t.addEventListener('mousedown', e => { if (e.button === 0 && !t.querySelector('input')) selectSheet(i); });
    t.addEventListener('dblclick', e => {
      e.stopPropagation();
      const inp = el('input', { type: 'text', value: sh.name });
      t.textContent = ''; t.appendChild(inp);
      inp.focus(); inp.select();
      const done = ok => {
        const nm = inp.value;
        t.textContent = sh.name;
        if (ok && nm !== sh.name) { if (!renameSheet(i, nm)) t.textContent = sh.name; }
      };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); ev.stopPropagation(); });
      inp.addEventListener('blur', () => done(true));
      inp.addEventListener('mousedown', ev => ev.stopPropagation());
    });
    t.addEventListener('contextmenu', e => {
      e.preventDefault();
      pop(e, menu([
        { label: 'Insert...', icon: 'plus', action: () => { addSheet(null, true); X.selectSheet(state.sheets.length - 1); } },
        { label: 'Delete', icon: 'close', action: () => deleteSheet(i), off: state.sheets.length <= 1 },
        { label: 'Rename', icon: 'sheetico', action: () => t.dispatchEvent(new MouseEvent('dblclick')) },
        'sep',
        { label: 'Move Left', icon: 'chev-l', off: i === 0, action: () => moveSheet(i, i - 1) },
        { label: 'Move Right', icon: 'chev-r', off: i === state.sheets.length - 1, action: () => moveSheet(i, i + 1) },
      ]));
    });
    t.addEventListener('dragstart', e => { e.dataTransfer.setData('text/xshtab', String(i)); });
    t.addEventListener('dragover', e => { e.preventDefault(); t.classList.add('dragover'); });
    t.addEventListener('dragleave', () => t.classList.remove('dragover'));
    t.addEventListener('drop', e => { e.preventDefault(); t.classList.remove('dragover'); const from = +e.dataTransfer.getData('text/xshtab'); if (!isNaN(from) && from !== i) moveSheet(from, i); });
    host.appendChild(t);
  });
  $('#sn-prev').classList.toggle('off', state.active === 0);
  $('#sn-next').classList.toggle('off', state.active === state.sheets.length - 1);
}
X.renderSheetTabs = renderSheetTabs;

/* ============================ 18. STATUS BAR / ZOOM ============================ */
function updateSB() {
  $('#zoom-pct').textContent = Math.round(Z() * 100) + '%';
  const sl = $('#zoom-slider');
  if (+sl.value !== Math.round(Z() * 100)) sl.value = Math.round(Z() * 100);
  $$('.sb-view').forEach(b => b.classList.toggle('on', b.dataset.view === (state.view === 'normal' ? 'normal' : 'pagebreak')));
  if (state.protected) sbMode('Protected'); else if (!edit) sbMode('Ready');
}
function setZoom(z, center) {
  z = clamp(z, 0.4, 2);
  if (Math.abs(z - state.zoom) < 0.001) return;
  const gs = $('#grid-scroll');
  const v = viewSize();
  const mx = v.sl + v.w / 2, my = v.st + v.h / 2;
  const k = z / state.zoom;
  state.zoom = z;
  updateSpacer();
  gs.scrollLeft = mx * k - v.w / 2;
  gs.scrollTop = my * k - v.h / 2;
  renderAll();
}
X.setZoom = setZoom;

/* ============================ 19. DIALOG / MENU FRAMEWORK ============================ */
function closeAllPops() { $$('.popup, .subpopup').forEach(p => p.remove()); document.removeEventListener('mousedown', popAwayHandler, true); document.removeEventListener('keydown', popKeyHandler, true); }
X.closeAllPops = closeAllPops;
function popAwayHandler(e) { if (!e.target.closest('.popup, .subpopup') && !e.target.closest('.rbtn, .rsm, .rbig, .rcombo, button[data-keep]')) closeAllPops(); }
function popKeyHandler(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAllPops(); } }
let popTimer = null;
function pop(anchor, content, opts) {
  closeAllPops();
  opts = opts || {};
  const p = el('div', { class: 'popup' + (opts.cls ? ' ' + opts.cls : '') });
  p.appendChild(content);
  document.body.appendChild(p);
  let ax, ay;
  if (anchor && anchor.clientX != null) { ax = anchor.clientX; ay = anchor.clientY; }
  else {
    const rect = anchor.getBoundingClientRect();
    ax = opts.alignRight ? rect.right - p.offsetWidth : rect.left;
    ay = rect.bottom + 1;
  }
  p.style.left = '0px'; p.style.top = '0px';
  p.style.left = clamp(ax, 2, window.innerWidth - p.offsetWidth - 4) + 'px';
  p.style.top = clamp(ay, 2, window.innerHeight - p.offsetHeight - 4) + 'px';
  if (document.querySelector('.dlg')) p.style.zIndex = '620';  // never behind a dialog (color palette, selects...)
  document.addEventListener('mousedown', popAwayHandler, true);
  document.addEventListener('keydown', popKeyHandler, true);
  return p;
}
X.pop = pop;

/* ==========================================================================
   CUSTOM FORM COMPONENTS — Excel-themed replacements for native
   <select>, <input type=checkbox>, number spinners, color & range inputs.
   ========================================================================== */
const CHEV_SVG = '<svg viewBox="0 0 10 6" width="8" height="5"><path d="M1 1l4 4 4-4" stroke="#555" fill="none" stroke-width="1.3"/></svg>';

/* cSelect — themed dropdown. API compatible with the old native <select>:
     .value (get/set), addEventListener('change', ...), ArrowUp/Down + Enter/Space. */
function cSelect(opts, val) {
  const wrap = el('div', { class: 'csel', tabindex: '0', role: 'listbox', 'aria-expanded': 'false' });
  const lab = el('span', { class: 'csel-lab' });
  const chev = el('span', { class: 'csel-chev' });
  chev.innerHTML = CHEV_SVG;
  wrap.appendChild(lab); wrap.appendChild(chev);
  let cur;
  const setVal = (v, fire) => {
    cur = v;
    const hit = opts.find(o => String(o[0]) === String(v));
    lab.textContent = hit ? String(hit[1]) : (v == null ? '' : String(v));
    wrap.title = lab.textContent;
    if (fire) wrap.dispatchEvent(new Event('change', { bubbles: true }));
  };
  Object.defineProperty(wrap, 'value', { get: () => cur, set: v => setVal(v, false) });
  const open = () => {
    const lst = el('div', { class: 'csel-list' });
    opts.forEach(o => {
      const it = el('div', { class: 'csel-it' + (String(o[0]) === String(cur) ? ' on' : '') });
      it.textContent = String(o[1]);
      it.addEventListener('click', ev => { ev.stopPropagation(); setVal(o[0], true); closeAllPops(); });
      it.addEventListener('mouseenter', () => { $$('.csel-it', lst).forEach(x => x.classList.toggle('on', x === it)); });
      lst.appendChild(it);
    });
    const inDlg = !!wrap.closest('.dlg, .bs-root');
    const p = pop(wrap, lst, { cls: 'csel-pop' + (inDlg ? ' hi' : '') });
    lst.style.minWidth = Math.max(wrap.offsetWidth - 2, 96) + 'px';
    const onIt = $('.csel-it.on', lst);
    if (onIt) setTimeout(() => { onIt.scrollIntoView({ block: 'nearest' }); }, 0);
    return p;
  };
  wrap.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); open(); });
  wrap.addEventListener('keydown', e => {
    const ix = opts.findIndex(o => String(o[0]) === String(cur));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nx = ix < 0 ? 0 : clamp(ix + (e.key === 'ArrowDown' ? 1 : -1), 0, opts.length - 1);
      setVal(opts[nx][0], true);
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    else if (e.key === 'Escape') closeAllPops();
  });
  setVal(val, false);
  return wrap;
}
X.cSelect = cSelect;

/* cCheck — themed checkbox. Returns <label>; element.cb is the box:
   box.checked (get/set), box.indeterminate, fires bubbling 'change'. */
function cCheck(labelText, checked) {
  const l = el('label', { class: 'cchk' });
  const box = el('span', { class: 'cchk-box', tabindex: '0', role: 'checkbox' });
  Object.defineProperty(box, 'checked', {
    get() { return box.classList.contains('chk'); },
    set(v) { box.classList.toggle('chk', !!v); },
  });
  Object.defineProperty(box, 'indeterminate', {
    get() { return box.classList.contains('mid'); },
    set(v) { box.classList.toggle('mid', !!v); },
  });
  box.checked = !!checked;
  const flip = () => { box.checked = !box.checked; box.classList.remove('mid'); box.dispatchEvent(new Event('change', { bubbles: true })); };
  l.appendChild(box);
  l.appendChild(el('span', { class: 'cchk-txt' }, labelText));
  l.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); flip(); box.focus(); });
  box.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); flip(); } });
  l.cb = box;
  return l;
}
X.cCheck = cCheck;

/* cSpin — text field with custom stepper buttons (Excel spin control).
   .value get/set; 'input'/'change' bubble from the inner field; min/max honored. */
function cSpin(val, w) {
  const wrap = el('div', { class: 'cspin' });
  const i = el('input', { type: 'text', inputmode: 'decimal', spellcheck: 'false', autocomplete: 'off', value: val == null ? '' : String(val) });
  if (w) i.style.width = w + 'px';
  const btns = el('span', { class: 'cspin-btns' });
  const mk = dir => {
    const b = el('button', { type: 'button', class: 'cspin-b', tabindex: '-1' });
    b.innerHTML = `<svg viewBox="0 0 8 5" width="7" height="4"><path d="${dir > 0 ? 'M1 4l3-3 3 3' : 'M1 1l3 3 3-3'}" fill="none" stroke="#555" stroke-width="1.1"/></svg>`;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => {
      const cur = parseFloat(i.value); let v = isNaN(cur) ? 0 : cur + dir;
      const exp = k => (wrap[k] !== undefined && wrap[k] !== null && wrap[k] !== '' ? +wrap[k] : (i[k] !== undefined && i[k] !== '' ? +i[k] : null));
      const mn = exp('min'), mx = exp('max');
      if (mn != null && !isNaN(mn)) v = Math.max(mn, v);
      if (mx != null && !isNaN(mx)) v = Math.min(mx, v);
      i.value = String(v);
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return b;
  };
  btns.appendChild(mk(1)); btns.appendChild(mk(-1));
  wrap.appendChild(i); wrap.appendChild(btns);
  Object.defineProperty(wrap, 'value', { get: () => i.value, set: v => { i.value = v; } });
  wrap.input = i;
  return wrap;
}
X.cSpin = cSpin;

/* cColorBtn — swatch button that opens the theme palette popup. .value get/set, 'change' fires. */
function cColorBtn(val, opts) {
  const b = el('button', { type: 'button', class: 'cclr', title: 'Pick a color' });
  const sw = el('span', { class: 'cclr-sw' });
  sw.style.background = val || '#000000';
  const chev = el('span', { class: 'cclr-chev' });
  chev.innerHTML = CHEV_SVG;
  b.appendChild(sw); b.appendChild(chev);
  Object.defineProperty(b, 'value', {
    get: () => b.dataset.v || '#000000',
    set: v => { b.dataset.v = v; sw.style.background = v; },
  });
  b.value = val || '#000000';
  b.addEventListener('click', e => {
    e.preventDefault();
    X.colorPalette(b, 'fill', c => { b.value = c; b.dispatchEvent(new Event('change', { bubbles: true })); }, opts);
  });
  return b;
}
X.cColorBtn = cColorBtn;

/* cSlider — themed drag slider (status-bar zoom). */
function cSlider(elm, opt) {
  const min = opt.min, max = opt.max, step = opt.step || 1;
  let cur = opt.value != null ? opt.value : min;
  const v2p = v => (clamp(v, min, max) - min) / (max - min);
  const paint = () => {
    const p = v2p(cur) * 100;
    $('.cslider-fill', elm).style.width = p + '%';
    $('.cslider-thumb', elm).style.left = `calc(${p}% - 8px)`;
    elm.setAttribute('aria-valuenow', String(cur));
  };
  const set = (v, fire) => {
    const nv = clamp(Math.round(v / step) * step, min, max);
    if (nv === cur && fire !== 'paint') { paint(); return; }
    cur = nv; paint();
    if (fire) elm.dispatchEvent(new CustomEvent('slide', { detail: cur, bubbles: true }));
  };
  Object.defineProperty(elm, 'value', { get: () => cur, set: v => set(v, false) });
  const fromEvent = e => { const r = elm.getBoundingClientRect(); set(min + (max - min) * clamp((e.clientX - r.left) / r.width, 0, 1), true); };
  elm.addEventListener('mousedown', e => {
    e.preventDefault(); fromEvent(e);
    const mv = ev => fromEvent(ev);
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  elm.addEventListener('wheel', e => { e.preventDefault(); set(cur + (e.deltaY < 0 ? step : -step), true); }, { passive: false });
  elm.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(cur - step, true); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(cur + step, true); }
    if (e.key === 'Home') { e.preventDefault(); set(min, true); }
    if (e.key === 'End') { e.preventDefault(); set(max, true); }
  });
  set(cur, 'paint');
  return elm;
}
X.cSlider = cSlider;
function menu(items) {
  const m = el('div', { class: 'menu', style: 'max-height:' + (window.innerHeight - 60) + 'px;overflow:auto' });
  if (!Array.isArray(items)) {           // defensive: a broken builder must never crash the chrome
    console.warn('menu() received non-array', items);
    if (items && items.nodeType === 1) { m.appendChild(items); return m; }
    return m;
  }
  items.forEach(it => {
    if (it === 'sep') { m.appendChild(el('div', { class: 'mi-sep' })); return; }
    if (it.hdr) { m.appendChild(el('div', { class: 'mi-hdr' }, esc(it.label))); return; }
    const mi = el('div', { class: 'mi' + (it.off ? ' off' : '') + (it.sub ? ' has-sub' : '') });
    if (it.icon || it.check != null) {
      const ck = el('span', { class: 'mi-ck' });
      if (it.check) ck.innerHTML = svgIcon('check');
      mi.appendChild(ck);
    }
    if (it.icon) { const ic = el('span', { class: 'mi-ico' }); ic.innerHTML = svgIcon(it.icon); mi.appendChild(ic); }
    if (it.html) { const sp = el('span', { class: 'mi-html' }); sp.innerHTML = it.html; mi.appendChild(sp); }
    else mi.appendChild(el('span', { class: 'mi-lab' }, esc(it.label)));
    if (it.note) mi.appendChild(el('span', { class: 'mi-note' }, esc(it.note)));
    if (it.sub) {
      let subPop = null;
      mi.addEventListener('mouseenter', () => {
        closeSubs();
        subPop = el('div', { class: 'popup subpopup' });
        subPop.appendChild(menu(it.sub()));
        document.body.appendChild(subPop);
        if (document.querySelector('.dlg')) subPop.style.zIndex = '620';
        const r = mi.getBoundingClientRect();
        subPop.style.left = clamp(r.right - 2, 2, window.innerWidth - subPop.offsetWidth - 4) + 'px';
        subPop.style.top = clamp(r.top - 3, 2, window.innerHeight - subPop.offsetHeight - 4) + 'px';
      });
    }
    if (it.action) mi.addEventListener('click', e => { e.stopPropagation(); closeAllPops(); it.action(); });
    m.appendChild(mi);
  });
  function closeSubs() { $$('.subpopup').forEach(s => s.remove()); }
  return m;
}
X.menu = menu;
function dlg(opts) {
  // {title, body(el), buttons:[{label, pri, fn(dlgEl)->bool keep?}], width, tabs}
  $$('.dlg, .dlg-backdrop').forEach(x => x.remove());
  const bd = el('div', { class: 'dlg-backdrop' });
  const d = el('div', { class: 'dlg' });
  if (opts.width) d.style.width = opts.width + 'px';
  const title = el('div', { class: 'dlg-title' }, esc(opts.title));
  const xb = el('button', { class: 'dlg-x', title: 'Close' }, svgIcon('close', 'ico-s'));
  xb.addEventListener('click', () => close());
  title.appendChild(xb);
  d.appendChild(title);
  let bodyHost = d;
  if (opts.tabs) {
    const th = el('div', { class: 'dlg-tabs' });
    const pgs = [];
    const start = Math.min(Math.max(0, opts.startTab || 0), opts.tabs.length - 1);
    opts.tabs.forEach((t, i) => {
      const tb = el('button', { class: 'dlg-tab' + (i === start ? ' on' : '') }, esc(t.label));
      tb.addEventListener('click', () => {
        $$('.dlg-tab', th).forEach((x, j) => x.classList.toggle('on', j === i));
        pgs.forEach((p, j) => p.classList.toggle('on', j === i));
      });
      th.appendChild(tb);
      const pg = el('div', { class: 'dlg-tabpg' + (i === start ? ' on' : '') });
      pg.appendChild(t.body);
      pgs.push(pg);
    });
    d.appendChild(th);
    const body = el('div', { class: 'dlg-body' });
    pgs.forEach(p => body.appendChild(p));
    d.appendChild(body);
    bodyHost = body;
  } else {
    const body = el('div', { class: 'dlg-body' });
    if (opts.body) body.appendChild(opts.body);
    d.appendChild(body);
    bodyHost = body;
  }
  const foot = el('div', { class: 'dlg-foot' });
  (opts.buttons || [{ label: 'OK', pri: true }]).forEach(b => {
    const bt = el('button', { class: 'btn' + (b.pri ? ' pri' : '') }, esc(b.label));
    bt.addEventListener('click', () => {
      if (b.fn) { const r = b.fn(d); if (r === false) return; }
      close();
    });
    foot.appendChild(bt);
  });
  if (opts.buttons !== null) d.appendChild(foot);
  document.body.appendChild(bd); document.body.appendChild(d);
  const r = d.getBoundingClientRect();
  d.style.left = Math.max(8, (window.innerWidth - r.width) / 2) + 'px';
  d.style.top = Math.max(8, (window.innerHeight - r.height) / 2 - 30) + 'px';
  bd.addEventListener('mousedown', () => { if (opts.modal === false) close(); });
  function close() { d.remove(); bd.remove(); }
  X._closeDlg = close;
  const f = d.querySelector('input, select, textarea');
  if (f) setTimeout(() => f.focus(), 30);
  return d;
}
X.dlg = dlg;
function msgBox(title, text, opts) {
  opts = opts || {};
  return new Promise(res => {
    const body = el('div', { class: 'msgbox-row', style: 'min-width:300px;max-width:440px' });
    if (opts.icon !== false) body.appendChild(el('span', { class: 'msgbox-ico' }, svgIcon(opts.icon === 'warn' ? 'warn' : 'info', 'ico-32')));
    body.appendChild(el('div', null, esc(text)));
    const buttons = (opts.buttons || ['OK']).map((b, i) => ({ label: b, pri: i === 0, fn: () => { res(b); } }));
    const d = dlg({
      title: title || 'Microsoft Excel', body, buttons,
      width: null,
    });
  });
}
X.msgBox = msgBox;

/* ============================ 20. RIBBON BUILD ============================ */
function buildRibbon() {
  const tabsEl = $('#tabs'), rib = $('#ribbon');
  tabsEl.innerHTML = ''; rib.innerHTML = '';
  const fileTab = el('button', { class: 'tab file' }, 'File');
  fileTab.addEventListener('click', () => X.openBackstage('home'));
  tabsEl.appendChild(fileTab);
  RIBBON.forEach(t => {
    const b = el('button', { class: 'tab' + (X.activeTab === t.id ? ' active' : ''), 'data-tab': t.id }, t.label);
    b.addEventListener('click', () => setTab(t.id));
    tabsEl.appendChild(b);
    if (!document.getElementById('rp-' + t.id)) {
      const p = el('div', { class: 'rpanel', 'data-panel': t.id, id: 'rp-' + t.id });
      t.groups.forEach(g => p.appendChild(buildGroup(g)));
      rib.appendChild(p);
    }
  });
  setTab(X.activeTab || 'home');
}
function buildGroup(g) {
  const grp = el('div', { class: 'rgroup' + (g.custom ? ' rel' : '') });
  const body = el('div', { class: 'rbody' });
  if (g.custom) { X.CUST[g.custom](body); }
  else (g.items || []).forEach(it => body.appendChild(buildItem(it)));
  grp.appendChild(body);
  const lab = el('div', { class: 'rlabel' }, g.label);
  grp.appendChild(lab);
  return grp;
}
function buildItem(it) {
  switch (it.t) {
    case 'big': return buildBig(it);
    case 'stack': {
      const st = el('span', { class: 'rstack' });
      it.items.forEach(x => st.appendChild(buildItem(x)));
      return st;
    }
    case 'sm': return buildSm(it);
    case 'color': return buildColorIt(it);
    case 'chk': return buildChk(it);
    case 'combo': return el('span');
    default: return el('span');
  }
}
function execCmd(e, b, it) {
  const cmd = X.CMDS[it.id];
  if (cmd) { cmd.exec(e, b); return; }
  // fallback: a ribbon button with a menu but no explicit command opens its menu (never dead)
  if (it.menu && X.MENU_BUILDERS[it.menu]) X.MENU_BUILDERS[it.menu](b);
}
function buildBig(it) {
  const b = el('button', { class: 'rbig' + (it.split ? ' split' : ' plain'), title: it.label.replace(/\n/g, ' ') });
  b.dataset.cmd = it.id;
  const icon = svgIcon(it.icon, 'ico-32');
  if (it.split || it.menu) {
    const main = el('span', { class: 'rb-main' });
    main.innerHTML = icon + `<span class="rb-lab">${esc(it.label).replace(/\n/g, '<br>')}</span>`;
    b.appendChild(main);
    const caret = el('span', { class: 'rb-splitcaret' }, `<span>${it.split ? '' : esc(it.label).replace(/\n/g, ' ')}</span>${svgIcon('chev-d', 'ico-s')}`);
    if (!it.split) {
      // entire button opens menu
      b.innerHTML = icon + `<span class="rb-lab">${esc(it.label).replace(/\n/g, '<br>')}</span>`;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', e => execCmd(e, b, it));
      return b;
    }
    const mwrap = el('button', { class: 'rbig split-caret onlycaret', title: it.label.replace(/\n/g, ' ') + ' options' });
    mwrap.innerHTML = `<span class="rb-splitcaret">${svgIcon('chev-d', 'ico-s')}</span>`;
    const wrap = el('span', { style: 'display:flex;flex-direction:column;align-items:center' });
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', e => execCmd(e, b, it));
    mwrap.addEventListener('mousedown', e => e.preventDefault());
    mwrap.addEventListener('click', e => { e.stopPropagation(); X.MENU_BUILDERS[it.menu] && X.MENU_BUILDERS[it.menu](mwrap); });
    wrap.appendChild(b); wrap.appendChild(mwrap);
    return wrap;
  }
  b.innerHTML = icon + `<span class="rb-lab">${esc(it.label).replace(/\n/g, '<br>')}</span>`;
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', e => execCmd(e, b, it));
  return b;
}
function buildSm(it) {
  const b = el('button', { class: 'rsm', title: it.label });
  b.dataset.cmd = it.id;
  b.innerHTML = svgIcon(it.icon) + `<span>${esc(it.label)}</span>` + (it.menu ? `<span class="caret">${svgIcon('chev-d', 'ico-s')}</span>` : '');
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', e => execCmd(e, b, it));
  return b;
}
function buildColorIt(it) {
  const wrap = el('span', { style: 'display:inline-flex;position:relative' });
  const cmd = it.id;
  const sw = el('span', { class: 'swbar', style: `background:${state.colors[cmd] || it.def || '#000'}` });
  const main = icoBtn('rsm' + (it.labeled ? ' labeled' : ''), it);
  main.title = it.label;
  if (it.labeled) main.innerHTML = svgIcon(it.icon) + `<span>${esc(it.label)}</span>`;
  main.appendChild(sw);
  main.addEventListener('mousedown', e => e.preventDefault());
  main.addEventListener('click', e => { const c = X.CMDS[cmd]; c && c.exec(e, main, state.colors[cmd]); });
  const caret = el('button', { class: 'rsm', style: 'padding:0 3px 0 0;margin-left:-3px', title: it.label + ' — choose color' });
  caret.innerHTML = svgIcon('chev-d', 'ico-s');
  caret.addEventListener('mousedown', e => e.preventDefault());
  caret.addEventListener('click', () => X.colorPalette(caret, cmd, c => {
    state.colors[cmd] = c;
    sw.style.background = c;
    const cm = X.CMDS[cmd]; cm && cm.exec(null, main, c);
  }));
  wrap.appendChild(main); wrap.appendChild(caret);
  return wrap;
}
function buildChk(it) {
  const b = el('button', { class: 'rsm rchk2' });
  b.dataset.cmd = it.id;
  b.innerHTML = `<input type="checkbox" tabindex="-1"> <span>${esc(it.label)}</span>`;
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', e => {
    e.preventDefault();
    const inp = $('input', b);
    inp.checked = !inp.checked;
    const cmd = X.CMDS[it.id]; cmd && cmd.exec(e, b, inp.checked);
  });
  return b;
}
function icoBtn(cls, cfg) {
  const b = el('button', { class: cls, title: cfg.label + (cfg.tip ? '\n' + cfg.tip : '') });
  b.dataset.cmd = cfg.id;
  b.innerHTML = svgIcon(cfg.icon);
  return b;
}
function setTab(id) {
  X.activeTab = id;
  $$('.tab[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  $$('.rpanel').forEach(p => p.classList.toggle('active', p.dataset.panel === id));
}
X.setTab = setTab;
X.buildRibbon = buildRibbon; X.buildItem = buildItem;
function refreshStates() {
  // combos + toggle states from active cell
  const s = state.sel;
  if (!s) return;
  const cd = cellGet(s.a.r, s.a.c);
  const st = (cd && cd.s) || {};
  if (X.fontInput && X.sizeInput) {
    X.fontInput.value = st.font || state.fonts || 'Calibri';
    X.sizeInput.value = String(st.size || 11);
  }
  const d = cd ? cellDisplay(s.a.r, s.a.c) : null;
  $$('[data-toggle]').forEach(b => {
    const t = b.dataset.toggle;
    let on = false;
    if (t === 'fx') on = false;
    else if (t === 'showform') on = state.showFormulas;
    else if (t === 'filter') on = !!filterRegion();
    else if (t === 'shownotes') on = state.showNotes;
    else if (t === 'vnormal') on = state.view === 'normal';
    else if (t === 'vpbreak') on = state.view === 'pbreak';
    else if (t === 'merge') on = !!mergeAt(sheet(), s.a.r, s.a.c);
    else if (t === 'wrap') on = !!st.wrap;
    else if (t === 'freeze') on = sheet().freeze.r > 0 || sheet().freeze.c > 0;
    else if (st) {
      if (t === 'bold') on = !!st.b;
      else if (t === 'italic') on = !!st.i;
      else if (t === 'under') on = !!st.u;
      else if (t === 'strike') on = !!st.strike;
      else if (t === 'alignl') on = (st.halign || (d && d.t === 'n' ? 'right' : d && (d.t === 'b' || d.t === 'e') ? 'center' : 'left')) === 'left';
      else if (t === 'alignc') on = (st.halign || (d && (d.t === 'n' ? 'right' : d && (d.t === 'b' || d.t === 'e') ? 'center' : 'left'))) === 'center';
      else if (t === 'alignr') on = (st.halign || (d && d.t === 'n' ? 'right' : 'left')) === 'right';
      else if (t === 'aligntop') on = st.valign === 'top';
      else if (t === 'alignmid') on = st.valign === 'middle' || !st.valign;
      else if (t === 'alignbot') on = st.valign === 'bottom';
    }
    b.classList.toggle('on', !!on);
  });
  $$('.sb-view').forEach(b => b.classList.toggle('on', b.dataset.view === (state.view === 'pbreak' ? 'pagebreak' : 'normal')));
  // checkbox ribbon items sync
  const chkMap = { gridview: state.showGrid, gridprint: state.gridPrint, showfx: state.showFxbar, showgrid: state.showGrid, showhead: state.showHeads, headview: state.showHeads, darkmode: state.dark };
  Object.entries(chkMap).forEach(([id, val]) => {
    const b = $(`#ribbon [data-cmd="${id}"] input`);
    if (b) b.checked = !!val;
  });
}
X.refreshStates = refreshStates;
setInterval(refreshStates, 700);

/* ============================ 21. FORMATTING APPLY ============================ */
function applyStyle(mut, label) {
  pushUndo(label || 'Formatting');
  const s = state.sel;
  const single = isSingle();
  const applyOne = (r, c) => {
    const cd = cellEnsure(r, c);
    cd.s = cd.s || {};
    mut(cd.s, r, c);
  };
  if (s.type === 'all') { forEachUsedCell(applyOne); }
  else if (s.type === 'cols') {
    const n = normSel();
    for (let c = n.c1; c <= n.c2; c++) {
      sh_colStyle(c, mut);
      forEachUsedCell((r, cc) => { if (cc === c) applyOne(r, c); });
    }
  } else if (s.type === 'rows') {
    const n = normSel();
    for (let r = n.r1; r <= n.r2; r++) {
      sh_rowStyle(r, mut);
      forEachUsedCell((rr, c) => { if (rr === r) applyOne(r, c); });
    }
  } else {
    eachRangeCell(applyOne);
    // apply style to blank neighbors borders? no
  }
  markDirty(); afterDataChange();
}
X.applyStyle = applyStyle;
function sh_colStyle(c, mut) { const sh = sheet(); sh.colStyles = null; }
function sh_rowStyle(r, mut) {}
function cycleToggle(prop, label) {
  const s = state.sel;
  const cd = cellGet(s.a.r, s.a.c);
  const cur = cd && cd.s && cd.s[prop];
  applyStyle(st => { st[prop] = !cur; }, label);
}
X.cycleToggle = cycleToggle;
function setNumFmt(code, label) {
  pushUndo(label || 'Number Format');
  const applyOne = (r, c) => { const cd = cellEnsure(r, c); cd.f = code || null; };
  const s = state.sel;
  if (s.type === 'all') forEachUsedCell(applyOne);
  else if (s.type === 'cols') { const n = normSel(); forEachUsedCell((r, c) => { if (c >= n.c1 && c <= n.c2) applyOne(r, c); }); }
  else if (s.type === 'rows') { const n = normSel(); forEachUsedCell((r, c) => { if (r >= n.r1 && r <= n.r2) applyOne(r, c); }); }
  else eachRangeCell(applyOne);
  markDirty(); afterDataChange();
}
X.setNumFmt = setNumFmt;
function bumpDecimal(dir) {
  pushUndo('Decimals');
  eachRangeCell((r, c) => {
    const cd = cellGet(r, c);
    if (!cd) return;
    let f = cd.f;
    const num = cd.num;
    if (!f) {
      if (cd.t === 'n' || cd.t === 'f') {
        const s = Calc.numToGeneral(typeof num === 'number' ? num : 0);
        const dp = dir > 0 ? ((s.split('.')[1] || '').length + 1) : Math.max(0, ((s.split('.')[1] || '').length) - 1);
        cd.f = dp ? '0.' + '0'.repeat(dp) : '0';
      } else cd.f = dir > 0 ? '0.0' : '0';
      return;
    }
    const m = f.match(/\.([0#?]+)/);
    if (!m) {
      if (dir > 0) cd.f = f + '.' + '0';
      return;
    }
    if (dir > 0) cd.f = f.replace(/\.([0#?]+)/, '.' + m[1] + '0');
    else {
      if (m[1].length > 1) cd.f = f.replace(/\.([0#?]+)/, '.' + m[1].slice(0, -1));
      else cd.f = f.replace(/\.[0#?]+/, '');
    }
  });
  markDirty(); afterDataChange();
}
X.bumpDecimal = bumpDecimal;
function applyBorder(kind, color) {
  color = color || '#000';
  pushUndo('Borders');
  const n = normSel();
  const s = state.sel;
  const forAll = fn => {
    if (s.type === 'all') forEachUsedCell(fn);
    else if (s.type === 'cols') forEachUsedCell((r, c) => { if (c >= n.c1 && c <= n.c2) fn(r, c); });
    else if (s.type === 'rows') forEachUsedCell((r, c) => { if (r >= n.r1 && r <= n.r2) fn(r, c); });
    else for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) fn(r, c);
  };
  const thin = { w: 1, st: 'solid', cl: color };
  forAll((r, c) => {
    const cd = cellEnsure(r, c);
    cd.s = cd.s || {};
    switch (kind) {
      case 'bottom': cd.s.bB = { ...thin }; break;
      case 'top': cd.s.bT = { ...thin }; break;
      case 'left': cd.s.bL = { ...thin }; break;
      case 'right': cd.s.bR = { ...thin }; break;
      case 'none': cd.s.bL = cd.s.bR = cd.s.bT = cd.s.bB = null; break;
      case 'all': cd.s.bL = cd.s.bR = cd.s.bT = cd.s.bB = { ...thin }; break;
      case 'outside':
        if (r === n.r1) cd.s.bT = { ...thin };
        if (r === n.r2) cd.s.bB = { ...thin };
        if (c === n.c1) cd.s.bL = { ...thin };
        if (c === n.c2) cd.s.bR = { ...thin };
        break;
      case 'thickout':
        if (r === n.r1) cd.s.bT = { w: 2, st: 'solid', cl: color };
        if (r === n.r2) cd.s.bB = { w: 2, st: 'solid', cl: color };
        if (c === n.c1) cd.s.bL = { w: 2, st: 'solid', cl: color };
        if (c === n.c2) cd.s.bR = { w: 2, st: 'solid', cl: color };
        break;
      case 'bottomdouble': cd.s.bB = { w: 1, st: 'double', cl: color }; break;
      case 'bottomthick': cd.s.bB = { w: 2, st: 'solid', cl: color }; break;
      case 'topbottom':
        if (r === n.r1) cd.s.bT = { ...thin };
        if (r === n.r2) cd.s.bB = { ...thin };
        break;
      case 'inside':
        if (r < n.r2) cd.s.bB = { ...thin };
        if (c < n.c2) cd.s.bR = { ...thin };
        break;
      case 'insideh': if (r < n.r2) cd.s.bB = { ...thin }; break;
      case 'insidev': if (c < n.c2) cd.s.bR = { ...thin }; break;
      case 'diagd': cd.s.diag = { dir: 'd', cl: color }; break;
    }
  });
  markDirty(); afterDataChange();
}
X.applyBorder = applyBorder;
function setMerge(mode) {
  const s = state.sel;
  const n = normSel();
  pushUndo('Merge');
  const sh = sheet();
  if (mode === 'unmerge') {
    clearMergesIn(n);
  } else if (mode === 'across') {
    for (let r = n.r1; r <= n.r2; r++) {
      const m = { r1: r, c1: n.c1, r2: r, c2: n.c2 };
      if (m.c1 !== m.c2 && doMerge(m)) sh.merges.push(m);
    }
  } else if (mode === 'cells') {
    // merge each into cells but not into one big: same as across rows? Excel "Merge Cells" merges each selected cell row-wise? "Merge Cells" merges all into one like Merge&Center without centering.
    if ((n.r2 > n.r1 || n.c2 > n.c1) && doMerge(n)) sh.merges.push(n);
  } else { // center
    if ((n.r2 > n.r1 || n.c2 > n.c1) && doMerge(n)) sh.merges.push(n);
    const cd = cellEnsure(n.r1, n.c1);
    cd.s = cd.s || {}; cd.s.halign = 'center';
  }
  rebuildSubOf();
  markDirty(); scheduleRecalc(); afterDataChange();
}
X.setMerge = setMerge;

/* ============================ 22. ARROWS (trace) ============================ */
let arrowParts = [];
function clearArrows() { arrowParts.forEach(x => x.remove()); arrowParts = []; }
X.clearArrows = clearArrows;
function trace(mode) {
  clearArrows();
  const s = state.sel;
  const cd = cellGet(s.a.r, s.a.c);
  if (!cd || cd.t !== 'f') { sbMsg('The active cell does not contain a formula.'); return; }
  const v = viewSize(), fz = fzDims();
  const layer = selLayer();
  let targets = [];
  if (mode === 'prec') {
    const ast = Calc.parse(cd.v);
    Calc.refsOf(ast).forEach(rf => targets.push({ rf, direct: true }));
  } else {
    // dependents: scan formulas referencing this cell
    for (const k of Object.keys(sheet().cells)) {
      const o = sheet().cells[k];
      if (o.t !== 'f' || k === keyOf(s.a.r, s.a.c)) continue;
      const refs = Calc.refsOf(Calc.parse(o.v));
      for (const rf of refs) {
        if (rf.b == null && !rf.a.colOnly && !rf.a.rowOnly && rf.a.r === s.a.r && rf.a.c === s.a.c) targets.push({ to: rcOf(k) });
        else if (rf.b && !rf.a.colOnly && !rf.a.rowOnly && s.a.r >= Math.min(rf.a.r, rf.b.r) && s.a.r <= Math.max(rf.a.r, rf.b.r) && s.a.c >= Math.min(rf.a.c, rf.b.c) && s.a.c <= Math.max(rf.a.c, rf.b.c)) targets.push({ to: rcOf(k) });
      }
    }
  }
  if (!targets.length) { sbMsg(mode === 'prec' ? 'The formula has no precedents on this sheet.' : 'No dependents found.'); return; }
  const srcC = cellVpX(s.a.c, v, fz) + colWpx(s.a.c) * Z() / 2;
  const srcR = cellVpY(s.a.r, v, fz) + rowHpx(s.a.r) * Z() / 2;
  targets.forEach(t => {
    let tr, tc, tr2, tc2;
    if (t.rf) {
      const a = t.rf.a, b = t.rf.b || a;
      if (a.colOnly || a.rowOnly) return;
      if (t.rf.sheet && sheetByName(t.rf.sheet) !== sheet()) return;
      tr = Math.min(a.r, b.r == null ? a.r : b.r); tc = Math.min(a.c, b.c == null ? a.c : b.c);
      tr2 = Math.max(a.r, b.r == null ? a.r : b.r); tc2 = Math.max(a.c, b.c == null ? a.c : b.c);
      // if self cell inside, skip drawing arrow to self region center
    } else { tr = t.to.r; tc = t.to.c; tr2 = tr; tc2 = tc; }
    if (tr === s.a.r && tc === s.a.c && tr2 === s.a.r && tc2 === s.a.c) return;
    const x1 = cellVpX(tc, v, fz) + colWpx(tc) * Z() / 2;
    const y1 = cellVpY(tr, v, fz) + rowHpx(tr) * Z() / 2;
    const x2 = cellVpX(tc2, v, fz) + colWpx(tc2) * Z();
    const y2 = cellVpY(tr2, v, fz) + rowHpx(tr2) * Z();
    const d = el('div', { class: 'edit-refbox', style: `left:${Math.min(x1, x2 - 2)}px;top:${Math.min(y1, y2 - 2)}px;width:${Math.abs(x2 - x1) - 2}px;height:${Math.abs(y2 - y1) - 2}px;border-color:#2B78C5;pointer-events:none` });
    d.dataset.arrow = '1';
    selLayer().appendChild(d);
    arrowParts.push(d);
    // arrow line from that box to active cell
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'trace-svg');
    svg.style.cssText = `position:absolute;left:0;top:0;width:${v.w}px;height:${v.h}px;pointer-events:none;z-index:9`;
    const fromX = t.rf ? x1 + (x2 - x1) / 2 : (mode === 'dep' ? srcC : x1);
    const fromY = t.rf ? y1 + (y2 - y1) / 2 : (mode === 'dep' ? srcR : y1);
    const toX = mode === 'dep' ? x1 : srcC, toY = mode === 'dep' ? y1 : srcR;
    svg.innerHTML = `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="#2B78C5"/></marker></defs>` +
      `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="#2B78C5" stroke-width="1.4" marker-end="url(#ah)"/>`;
    selLayer().appendChild(svg);
    arrowParts.push(svg);
  });
}
X.trace = trace;

/* ============================ 23. FIND / REPLACE ============================ */
let findHits = [], findIdx = 0;
function openFindbar(replace) {
  const fb = $('#findbar');
  fb.classList.add('on');
  $('#fb-repl-row').style.display = replace ? '' : 'none';
  $('#fb-find').focus(); $('#fb-find').select();
}
function closeFindbar() { $('#findbar').classList.remove('on'); clearFindHits(); }
X.closeFindbar = closeFindbar;
function runFind(q, opts) {
  findHits = [];
  clearHitClasses(false);
  if (!q) { $('#fb-count').textContent = ''; return; }
  const shs = opts && opts.book ? state.sheets : [sheet()];
  shs.forEach(sh => {
    Object.keys(sh.cells).forEach(k => {
      const cd = sh.cells[k];
      let hay = String(cd.v != null ? cd.v : '');
      const d = cellDisplay(...Object.values(rcOf(k)));
      const hay2 = d ? d.text : '';
      const match = (h) => opts && opts.case ? h.includes(q) : h.toLowerCase().includes(q.toLowerCase());
      if (match(hay) || match(hay2)) findHits.push({ sh: state.sheets.indexOf(sh), ...rcOf(k) });
    });
  });
  findHits.sort((a, b) => a.sh - b.sh || a.r - b.r || a.c - b.c);
  findIdx = 0;
  $('#fb-count').textContent = findHits.length ? `${findHits.length} found` : 'None found';
  if (findHits.length) gotoHit(0);
}
function gotoHit(i) {
  if (!findHits.length) return;
  findIdx = ((i % findHits.length) + findHits.length) % findHits.length;
  const h = findHits[findIdx];
  if (h.sh !== state.active) selectSheet(h.sh);
  setSel({ r: h.r, c: h.c });
  scrollCellVisible(h.r, h.c);
  clearHitClasses(true);
  const el2 = $(`.cell[data-r="${h.r}"][data-c="${h.c}"]`);
  if (el2) el2.classList.add('hit-cell', 'cur');
  $('#fb-count').textContent = `${findIdx + 1} of ${findHits.length}`;
  paintHitCells();
}
function clearHitClasses(keep) {
  $$('.hit-cell').forEach(x => x.classList.remove('hit-cell', 'cur'));
}
function paintHitCells() {
  findHits.forEach((h, i) => {
    if (h.sh !== state.active) return;
    const el2 = $(`.cell[data-r="${h.r}"][data-c="${h.c}"]`);
    if (el2 && i !== findIdx) el2.classList.add('hit-cell');
  });
}
function clearFindHits() { findHits = []; findIdx = 0; clearHitClasses(); }
function replaceOne(q, rep) {
  const s = state.sel;
  const cd = cellGet(s.a.r, s.a.c);
  if (!cd) return;
  const str = String(cd.v != null ? cd.v : cd.num);
  if (!(str.toLowerCase().includes(q.toLowerCase()))) { gotoHit(findIdx + 1); return; }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  commitCell(s.a.r, s.a.c, str.replace(re, rep));
  runFind(q);
}
function replaceAll(q, rep, opts) {
  pushUndo('Replace All');
  let n = 0;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const shs = opts && opts.book ? state.sheets : [sheet()];
  state.undoOn = false;
  shs.forEach(sh => {
    Object.keys(sh.cells).forEach(k => {
      const cd = sh.cells[k];
      const str = String(cd.v != null ? cd.v : '');
      if (str.toLowerCase().includes(q.toLowerCase())) {
        const { r, c } = rcOf(k);
        const sh2 = state.sheets[state.active];
        if (sh !== sh2) { const t = state.active; state.active = shs.indexOf(sh); commitCell(r, c, str.replace(re, rep), { skipUndo: true }); state.active = t; }
        else commitCell(r, c, str.replace(re, rep), { skipUndo: true });
        n++;
      }
    });
  });
  state.undoOn = true;
  scheduleRecalc();
  sbMsg(`All done. We made ${n} replacement${n === 1 ? '' : 's'}.`);
  runFind(q);
  return n;
}
X.replaceAll = replaceAll; X.runFind = runFind; X.gotoHit = gotoHit; X.replaceOne = replaceOne; X.openFindbar = openFindbar; X.findHits = () => findHits; X.findIdx = () => findIdx;

/* ============================ 24. INPUT / MOUSE / KEYS ============================ */
let dragging = null;
function cellFromEvent(e) {
  const gs = $('#grid-scroll');
  const rect = gs.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  return cellAtVp(x, y);
}
function bindGrid() {
  const gs = $('#grid-scroll');
  gs.tabIndex = 0;
  gs.addEventListener('mousedown', e => {
    if (e.button === 2) return; // context
    focusGrid();
    const cell = cellFromEvent(e);
    if (!cell) return;
    closeAllPops();
    if (edit) {
      // point mode (formula) or commit
      const ed = $('#cell-editor');
      if (ed.value.startsWith('=')) { insertRefAtCellStart(e, cell); return; }
      endEdit(true);
    }
    if (e.shiftKey) {
      state.sel.b = cell;
      state.sel.type = 'cell';
      snapToMergeExtend();
      afterSelChange();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      // add range
      state.sel.ranges = state.sel.ranges || [];
      const n = normSel();
      state.sel.ranges.push(n);
      state.sel.a = { ...cell }; state.sel.b = { ...cell };
      afterSelChange();
      dragging = { kind: 'sel', start: cell, ctrl: true };
      return;
    }
    const m = mergeAt(sheet(), cell.r, cell.c);
    if (m) setSel({ r: m.r1, c: m.c1 }, { r: m.r2, c: m.c2 }, 'cell');
    else setSel(cell, cell, 'cell');
    dragging = { kind: 'sel', start: cell };
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    if (dragging.kind === 'sel') {
      const cell = cellFromEvent(e);
      if (!cell) return;
      if (e.clientX > window.innerWidth - 20) gs.scrollLeft += 18;
      if (e.clientY > window.innerHeight - 60) gs.scrollTop += 18;
      if (e.clientY < 190) gs.scrollTop -= 18;
      state.sel.b = cell;
      snapToMergeExtend();
      afterSelChange();
    }
  });
  document.addEventListener('mouseup', () => { dragging = null; });
  gs.addEventListener('dblclick', e => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    startEdit(null);
  });
  gs.addEventListener('wheel', e => {
    if (e.ctrlKey) { e.preventDefault(); setZoom(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1)); return; }
    e.preventDefault();
    gs.scrollTop += e.deltaY;
    gs.scrollLeft += e.deltaX || (e.shiftKey ? e.deltaY : 0);
    requestRender();
  }, { passive: false });
  gs.addEventListener('scroll', () => { requestRender(); syncSheetTabbar(); });
  gs.addEventListener('contextmenu', onContextMenu);
  gs.addEventListener('keydown', onKey);
  gs.addEventListener('copy', e => { if (edit) return; if (state.sel) { if (copySel(false) === false) return; e.clipboardData.setData('text/plain', lastTSV()); e.preventDefault(); } });
  gs.addEventListener('cut', e => { if (edit) return; if (state.sel) { if (copySel(true) === false) return; e.clipboardData.setData('text/plain', lastTSV()); e.preventDefault(); } });
  gs.addEventListener('paste', e => {
    if (edit) return;
    const txt = e.clipboardData.getData('text/plain');
    const s = state.sel;
    if (txt && navigator.clipboard) {
      // external clipboard: paste TSV (prefer internal model if it matches text? use internal for fidelity)
      if (state.clipboard && lastTSV().replace(/\r/g, '') === txt.replace(/\r/g, '')) { pasteAt(s.a.r, s.a.c); }
      else pasteTSV(txt, s.a.r, s.a.c);
      e.preventDefault();
    } else if (state.clipboard) { pasteAt(s.a.r, s.a.c); e.preventDefault(); }
  });
  // header interactions
  $('#colhdr').addEventListener('mousedown', onColHdrDown);
  $('#rowhdr').addEventListener('mousedown', onRowHdrDown);
  $('#colhdr').addEventListener('dblclick', e => {
    if (e.target.classList && e.target.classList.contains('ch-res')) {
      e.preventDefault();
      const td = e.target.closest('td');
      const c = +td.dataset.col;
      selColsFor(c).forEach(cc => autofitCol(cc));
    }
  });
  $('#rowhdr').addEventListener('dblclick', e => {
    if (e.target.classList && e.target.classList.contains('rh-res')) {
      e.preventDefault();
      const td = e.target.closest('td');
      const r = +td.dataset.row;
      selRowsFor(r).forEach(rr => autofitRow(rr));
    }
  });
  $('#corner').addEventListener('mousedown', e => { e.preventDefault(); selectAll(); });
  // fill handle
  document.addEventListener('mousedown', e => {
    if (e.target.id === 'fillhandle') { e.preventDefault(); startFill(); }
  }, true);
  // editor events
  const ed = $('#cell-editor');
  ed.addEventListener('keydown', onEditorKey);
  ed.addEventListener('input', () => { syncFxFromEdit(); updateMirrors(); });
  ed.addEventListener('scroll', () => { const m = $('#cell-mirror'); m.scrollTop = ed.scrollTop; m.scrollLeft = ed.scrollLeft; });
  ed.addEventListener('blur', e => {
    // commit if focus left the app chrome (not to another editor/fx)
    if (edit && !e.relatedTarget) return;
  });
  const fx = $('#fx-input');
  fx.addEventListener('focus', () => {
    if (!edit) { startEdit($('#fx-input').value); edit.target = 'fx'; setTimeout(() => { $('#cell-editor').focus(); }, 0); }
  });
  fx.addEventListener('keydown', e => {
    if (!edit) return;
    if (e.key === 'Enter') { e.preventDefault(); $('#cell-editor').value = fx.value; endEdit(true, 'down'); }
    if (e.key === 'Escape') { e.preventDefault(); endEdit(false); }
    if (e.key === 'Tab') { e.preventDefault(); $('#cell-editor').value = fx.value; endEdit(true, 'right'); }
  });
  fx.addEventListener('input', () => {
    if (edit) { $('#cell-editor').value = fx.value; updateMirrors(); }
  });
  fx.addEventListener('scroll', () => { const m = $('#fx-mirror'); m.scrollTop = fx.scrollTop; m.scrollLeft = fx.scrollLeft; });
  fx.addEventListener('blur', () => { fx.scrollTop = 0; fx.scrollLeft = 0; const m = $('#fx-mirror'); m.scrollTop = 0; m.scrollLeft = 0; });
  $('#fx-enter').addEventListener('click', () => { if (edit) endEdit(true, 'down'); });
  $('#fx-cancel').addEventListener('click', () => { if (edit) endEdit(false); });
  $('#fx-expand').addEventListener('click', () => $('#fxbar').classList.toggle('expanded'));
  $('#namebox').addEventListener('click', () => {
    const body = el('div');
    const f1 = el('div', { class: 'fld' });
    f1.innerHTML = `<span>Go to cell or range (e.g. B5 or A1:C10)</span>`;
    const inp = el('input', { type: 'text', value: selLabel().includes('x') ? '' : a1(state.sel.a.r, state.sel.a.c) });
    f1.appendChild(inp);
    body.appendChild(f1);
    dlg({
      title: 'Go To', body, width: 320,
      buttons: [
        { label: 'OK', pri: true, fn: () => { goToRef(inp.value.trim()); } },
        { label: 'Cancel' },
      ],
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
  // zoom
  cSlider($('#zoom-slider'), { min: 40, max: 200, step: 10, value: 100 });
  $('#zoom-slider').addEventListener('slide', e => setZoom(+e.detail / 100));
  $('#zoom-in').addEventListener('click', () => setZoom(state.zoom + 0.1));
  $('#zoom-out').addEventListener('click', () => setZoom(state.zoom - 0.1));
  $('#zoom-pct').addEventListener('click', () => X.zoomDialog());
  $$('.sb-view').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.view;
    setView(v === 'pagebreak' ? 'pbreak' : 'normal');
  }));
  function syncSheetTabbar() {}
}
X.setView = setViewWrapper;
function setViewWrapper(v) {
  state.view = v;
  requestRender();
  sbMsg(v === 'pbreak' ? 'Page Break Preview: dashed lines show where pages will break when printed' : 'Normal view');
}
function insertRefAtCellStart(e, cell) {
  if (!edit) return;
  const ed = $('#cell-editor');
  const st = ed.selectionStart;
  const isFormula = ed.value.startsWith('=');
  if (!isFormula) { endEdit(true); return; }
  // if last token is operator/'('/','/'=' → point
  insertRefAtCaret(cell.r, cell.c, cell.r, cell.c, false);
  dragging = { kind: 'point', start: cell };
  const mv = ev => {
    const c2 = cellFromEvent(ev);
    if (!c2) return;
    const ed2 = $('#cell-editor');
    // replace last typed ref segment with range
    const v = ed2.value;
    const m = v.slice(0, ed2.selectionStart).match(/([A-Z]{1,3}[0-9]+)(?::([A-Z]{1,3}[0-9]+))?$/);
    if (m) {
      const refStr = `${a1(cell.r, cell.c)}:${a1(c2.r, c2.c)}`;
      ed2.value = v.slice(0, ed2.selectionStart - m[0].length) + refStr + v.slice(ed2.selectionStart);
      ed2.setSelectionRange(ed2.selectionStart - m[0].length + refStr.length, ed2.selectionStart - m[0].length + refStr.length);
      updateMirrors();
    }
  };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); dragging = null; };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
  e.preventDefault();
}
function selectAll() {
  setSel({ r: 0, c: 0 }, { r: MAXR - 1, c: MAXC }, 'all');
}
X.selectAll = selectAll;
function goToRef(str) {
  const m = str.match(/^\s*(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_. ]*)!)?(\$?[A-Za-z]{1,3}\$?[0-9]+)(?::(\$?[A-Za-z]{1,3}\$?[0-9]+))?\s*$/);
  if (!m) { sbMsg('Invalid reference'); return; }
  const shN = m[1] || (m[2] ? m[2].replace(/!$/, '') : null);
  if (shN) { const sh = sheetByName(shN); if (sh) selectSheet(state.sheets.indexOf(sh)); }
  const a = Calc.parseRef(m[3].replace(/\$/g, ''));
  const b = m[4] ? Calc.parseRef(m[4].replace(/\$/g, '')) : a;
  if (!a || !b) { sbMsg('Invalid reference'); return; }
  setSel({ r: a.r, c: a.c }, { r: b.r, c: b.c });
  scrollCellVisible(Math.min(a.r, b.r), Math.min(a.c, b.c));
}
X.goToRef = goToRef;

/* last TSV of internal clipboard (for system clipboard writes) */
function lastTSV() {
  const cb = state.clipboard;
  if (!cb) return '';
  let out = '';
  for (let r = cb.r1; r <= cb.r2; r++) {
    const line = [];
    for (let c = cb.c1; c <= cb.c2; c++) { const d = cellDisplay(r, c); line.push(d ? d.text : ''); }
    out += line.join('\t') + (r < cb.r2 ? '\n' : '');
  }
  return out;
}

/* column header interactions */
function onColHdrDown(e) {
  const td = e.target.closest('td');
  if (!td) return;
  e.preventDefault();
  const c = +td.dataset.col;
  if (e.target.classList.contains('ch-res')) { startColResize(c, e); return; }
  const r2 = usedR2();
  if (e.shiftKey) { state.sel.b = { r: MAXR - 1, c }; state.sel.type = 'cols'; afterSelChange(); return; }
  if (e.ctrlKey || e.metaKey) {
    state.sel.ranges = state.sel.ranges || [];
    state.sel.ranges.push(normSel());
    setSel({ r: 0, c }, { r: MAXR - 1, c }, 'cols');
    return;
  }
  setSel({ r: 0, c }, { r: MAXR - 1, c }, 'cols');
  dragging = { kind: 'colsel' };
  const mv = ev => {
    const td2 = document.elementFromPoint(ev.clientX, ev.clientY);
    const t2 = td2 && td2.closest && td2.closest('#colhdr td');
    if (t2) { state.sel.b = { r: MAXR - 1, c: +t2.dataset.col }; afterSelChange(); }
  };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
}
function onRowHdrDown(e) {
  const td = e.target.closest('td');
  if (!td) return;
  e.preventDefault();
  const r = +td.dataset.row;
  if (e.target.classList.contains('rh-res')) { startRowResize(r, e); return; }
  if (e.shiftKey) { state.sel.b = { r, c: MAXC }; state.sel.type = 'rows'; afterSelChange(); return; }
  if (e.ctrlKey || e.metaKey) {
    state.sel.ranges = state.sel.ranges || [];
    state.sel.ranges.push(normSel());
    setSel({ r, c: 0 }, { r, c: MAXC }, 'rows');
    return;
  }
  setSel({ r, c: 0 }, { r, c: MAXC }, 'rows');
  const mv = ev => {
    const td2 = document.elementFromPoint(ev.clientX, ev.clientY);
    const t2 = td2 && td2.closest && td2.closest('#rowhdr td');
    if (t2) { state.sel.b = { r: +t2.dataset.row, c: MAXC }; afterSelChange(); }
  };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
}
/* resize */
function selColsFor(c) {
  // if the dragged column is inside a column selection, resize applies to all of them (Excel parity)
  const s = state.sel;
  if (s && s.type === 'cols' && c >= Math.min(s.a.c, s.b.c) && c <= Math.max(s.a.c, s.b.c)) {
    const out = [];
    for (let i = Math.min(s.a.c, s.b.c); i <= Math.max(s.a.c, s.b.c); i++) out.push(i);
    return out;
  }
  return [c];
}
function startColResize(c, e) {
  e.preventDefault();
  const startX = e.clientX;
  const sh = sheet();
  const cols = selColsFor(c);
  const w0s = cols.map(cc => (sh.colW[cc] != null ? sh.colW[cc] : DEFAULT_COLW));
  const w0 = sh.colW[c] != null ? sh.colW[c] : DEFAULT_COLW;
  let curW = w0;
  let undoPushed = false;
  const gs = $('#grid-scroll');
  const v = viewSize(), fz = fzDims(), z = Z();
  const guide = el('div', { class: 'resize-guide', style: `left:${cellVpX(c + 1, v, fz)}px;top:0;width:1.2px;height:${v.h}px` });
  $('#grid-stage').appendChild(guide);
  const tip = el('div', { class: 'resize-tip' });
  document.body.appendChild(tip);
  const mv = ev => {
    curW = clamp(w0 + (ev.clientX - startX) / z, 0, 400);
    guide.style.left = cellVpX(c, v, fz) + curW * z + 'px';
    tip.textContent = `Width: ${(curW / 7.5).toFixed(2)} (${Math.round(curW)} pixels)`;
    tip.style.left = ev.clientX + 12 + 'px'; tip.style.top = ev.clientY + 14 + 'px';
  };
  const up = ev => {
    document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    guide.remove(); tip.remove();
    state.undoOn = true;
    const dx = ((ev && ev.clientX != null ? ev.clientX : startX) - startX) / z;
    if (Math.abs(dx) < 0.5) return; // pure click on the boundary (or first half of a dblclick): no change, no undo entry
    pushUndo('Column Width');
    cols.forEach((cc, i) => {
      const w = clamp(w0s[i] + dx, 0, 400);
      if (w < 0.5) { sh.hidC[cc] = true; }
      else { sh.colW[cc] = w; delete sh.hidC[cc]; }
    });
    rebuildGeom(); updateSpacer(); markDirty(); requestRender();
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
}
function selRowsFor(r) {
  const s = state.sel;
  if (s && s.type === 'rows' && r >= Math.min(s.a.r, s.b.r) && r <= Math.max(s.a.r, s.b.r)) {
    const out = [];
    for (let i = Math.min(s.a.r, s.b.r); i <= Math.max(s.a.r, s.b.r); i++) out.push(i);
    return out;
  }
  return [r];
}
function startRowResize(r, e) {
  e.preventDefault();
  const startY = e.clientY;
  const sh = sheet();
  const rows = selRowsFor(r);
  const h0s = rows.map(rr => (sh.rowH[rr] != null ? sh.rowH[rr] : DEFAULT_ROWH));
  const h0 = (sh.rowH[r] != null ? sh.rowH[r] : DEFAULT_ROWH);
  let curH = h0;
  const v = viewSize(), fz = fzDims(), z = Z();
  const guide = el('div', { class: 'resize-guide', style: `top:${cellVpY(r + 1, v, fz)}px;left:0;height:1.2px;width:${v.w}px` });
  $('#grid-stage').appendChild(guide);
  const tip = el('div', { class: 'resize-tip' });
  document.body.appendChild(tip);
  const mv = ev => {
    curH = clamp(h0 + (ev.clientY - startY) / z, 0, 400);
    guide.style.top = cellVpY(r, v, fz) + curH * z + 'px';
    tip.textContent = `Height: ${(curH * 0.75).toFixed(2)} pt (${Math.round(curH)} pixels)`;
    tip.style.left = ev.clientX + 12 + 'px'; tip.style.top = ev.clientY + 14 + 'px';
  };
  const up = (ev) => {
    document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    guide.remove(); tip.remove();
    state.undoOn = true;
    const dy = ((ev && ev.clientY != null ? ev.clientY : startY) - startY) / z;
    if (Math.abs(dy) < 0.5) return;
    pushUndo('Row Height');
    rows.forEach((rr, i) => {
      const h = clamp(h0s[i] + dy, 0, 400);
      if (h < 0.5) sh.hidR[rr] = true;
      else { sh.rowH[rr] = h; delete sh.hidR[rr]; }
    });
    rebuildGeom(); updateSpacer(); markDirty(); requestRender();
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
}
function autofitCol(c) {
  const sh = sheet();
  let max = 8;
  forEachUsedCell((r, cc) => {
    if (cc !== c) return;
    const d = cellDisplay(r, cc);
    if (d) max = Math.max(max, textW(d.text, cellGet(r, cc) && cellGet(r, cc).s, 1) + 10);
  });
  pushUndo('AutoFit Column');
  sh.colW[c] = clamp(max / Z(), 20, 400);
  if (sh.hidC[c]) delete sh.hidC[c];
  rebuildGeom(); updateSpacer(); markDirty(); requestRender();
}
X.autofitCol = autofitCol;
function autofitRow(r) {
  const sh = sheet();
  let max = DEFAULT_ROWH / Z();
  forEachUsedCell((rr, c) => {
    if (rr !== r) return;
    const cd = cellGet(rr, c);
    if (cd && cd.s && cd.s.wrap) {
      const d = cellDisplay(rr, c);
      if (!d) return;
      const wAvail = colWpx(c) - 6;
      const lines = Math.ceil(textW(d.text, cd.s, 1) / Math.max(20, wAvail));
      max = Math.max(max, lines * 18 + 4);
    }
  });
  pushUndo('AutoFit Row');
  sh.rowH[r] = clamp(max, 16, 400);
  if (sh.hidR[r]) delete sh.hidR[r];
  rebuildGeom(); updateSpacer(); markDirty(); requestRender();
}
X.autofitRow = autofitRow;

/* context menu */
function onContextMenu(e) {
  e.preventDefault();
  const cell = cellFromEvent(e);
  const inSel = cell && (() => { const n = normSel(); return cell.r >= n.r1 && cell.r <= n.r2 && cell.c >= n.c1 && cell.c <= n.c2; })();
  if (cell && !inSel && state.sel.type === 'cell') setSel(cell, cell, 'cell');
  const items = [];
  const single = isSingle();
  items.push({ label: 'Cut', icon: 'cut', action: () => copySel(true), off: state.protected });
  items.push({ label: 'Copy', icon: 'copy', action: () => copySel(false) });
  items.push({ label: 'Paste', icon: 'paste', off: !state.clipboard, action: () => pasteAt(state.sel.a.r, state.sel.a.c) });
  items.push({
    label: 'Paste Special', icon: 'pasteval', sub: () => [
      { label: 'Paste', icon: 'paste', action: () => pasteAt(state.sel.a.r, state.sel.a.c) },
      { label: 'Values', icon: 'pasteval', note: '123', action: () => pasteAt(state.sel.a.r, state.sel.a.c, 'values') },
      { label: 'Formulas', icon: 'pasteform', note: 'fx', action: () => pasteAt(state.sel.a.r, state.sel.a.c, 'formulas') },
      { label: 'Formats', icon: 'fpainter', action: () => pasteAt(state.sel.a.r, state.sel.a.c, 'formats') },
      { label: 'Transpose', icon: 'pastetp', action: () => pasteAt(state.sel.a.r, state.sel.a.c, 'transpose') },
    ],
  });
  items.push('sep');
  items.push({
    label: 'Insert...', icon: 'insertcells', action: () => X.insertDialog(),
    off: state.protected,
  });
  items.push({ label: 'Delete...', icon: 'deletecells', action: () => X.deleteDialog(), off: state.protected });
  items.push({ label: 'Clear Contents', icon: 'clear', note: 'Del', action: clearContents, off: state.protected });
  items.push('sep');
  const d = cell ? cellDisplay(cell.r, cell.c) : null;
  if (sheet().tables && Object.keys(sheet().tables).length) {
    items.push({ label: 'Filter', icon: 'filter', sub: () => filterMenuItems(cell) });
  }
  items.push({ label: 'Sort', icon: 'sortdlg', sub: () => [
    { label: 'Sort A to Z', icon: 'sortaz', action: () => sortSelection(1) },
    { label: 'Sort Z to A', icon: 'sortza', action: () => sortSelection(-1) },
    { label: 'Custom Sort...', icon: 'sortdlg', action: () => X.sortDialog() },
  ] });
  items.push('sep');
  items.push({ label: 'Insert Comment', icon: 'note', action: () => X.CMDS.newnote.exec(), off: !!sheet().notes[keyOf(state.sel.a.r, state.sel.a.c)] });
  items.push({ label: 'Format Cells...', icon: 'formatcells', note: 'Ctrl+1', action: () => X.formatCellsDialog() });
  pop(e, menu(items.filter(Boolean)));
}
X.onContextMenu = onContextMenu;
function filterMenuItems(cell) {
  const t = filterRegion();
  if (!t) return [{ label: '(no filter)', off: true }];
  const items = [];
  for (let c = t.c1; c <= t.c2; c++) {
    const hdr = cellDisplay(t.r1, c);
    items.push({ label: 'Filter by "' + (hdr ? hdr.text : a1(t.r1, c)) + '"', icon: 'filter', action: () => { quickFilterBy(cell, c); } });
  }
  items.push('sep');
  items.push({ label: 'Clear Filter', icon: 'filterclr', action: () => { const t2 = filterRegion(); t2.filter = {}; applyFilter(); } });
  return items;
}
function quickFilterBy(cell, c) {
  const t = filterRegion();
  const d = cellDisplay(cell.r, cell.c);
  const val = d ? d.text : '';
  const colIdx = (cell.c - t.c1) + t.c1;
  t.filter[String(cell.c)] = {}; t.filter[String(cell.c)][val] = true;
  applyFilter();
}
X.quickFilterBy = quickFilterBy;

/* keyboard */
function onKey(e) {
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  /* Ctrl+` toggles Show Formulas (columns double via rebuildGeom) */
  if (ctrl && !edit && (e.code === 'Backquote' || k === '`' || k === '~')) {
    e.preventDefault();
    state.showFormulas = !state.showFormulas;
    rebuildGeom(); updateSpacer(); recalcAll(); requestRender();
    X.sbMsg(state.showFormulas ? 'Show Formulas: ON — cell text now shows raw expressions (Ctrl+` to exit)' : 'Show Formulas: OFF');
    return;
  }
  if (edit) {
    // while editing, keys go to the editor — except ones that arrive in the
    // first instant of an edit (focus still settling): forward them so fast
    // typists never lose characters or the finishing Enter/Tab
    const edEl = $('#cell-editor');
    if (edEl && e.target !== edEl && e.target.id !== 'fx-input') {
      const en = edEl.selectionEnd == null ? null : edEl.selectionEnd;
      const st = edEl.selectionStart == null ? edEl.value.length : edEl.selectionStart;
      if (k && k.length === 1 && !ctrl) {
        e.preventDefault();
        edEl.value = edEl.value.slice(0, st) + k + edEl.value.slice(en == null ? st : en);
        edEl.setSelectionRange(st + 1, st + 1);
        edEl.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (k === 'Enter') { e.preventDefault(); endEdit(true, e.shiftKey ? 'up' : 'down'); return; }
      if (k === 'Tab') { e.preventDefault(); e.stopPropagation(); endEdit(true, 'right'); return; }
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); endEdit(false); return; }
    }
    return;
  }
  // combos
  if (ctrl) {
    const L = k.toLowerCase();
    if (L === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (L === 'y') { e.preventDefault(); doRedo(); return; }
    if (L === 'b') { e.preventDefault(); cycleToggle('b', 'Bold'); return; }
    if (L === 'i') { e.preventDefault(); cycleToggle('i', 'Italic'); return; }
    if (L === 'u') { e.preventDefault(); cycleToggle('u', 'Underline'); return; }
    if (L === 's') { e.preventDefault(); X.saveDoc(); return; }
    if (L === 'f') { e.preventDefault(); openFindbar(false); return; }
    if (L === 'h') { e.preventDefault(); openFindbar(true); return; }
    if (L === 'a') { e.preventDefault(); const s = state.sel; if (s.type === 'all') selectAll(); else { const r = regionUsed(); setSel({ r: r.r1, c: r.c1 }, { r: r.r2, c: r.c2 }); } return; }
    if (L === 'k') { e.preventDefault(); X.linkDialog(); return; }
    if (L === '1') { e.preventDefault(); X.formatCellsDialog(); return; }
    if (L === '9') { e.preventDefault(); hideRows(); return; }
    if (L === '0') { e.preventDefault(); hideCols(); return; }
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      jumpEdge(k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0);
      return;
    }
    if (L === 'home') { e.preventDefault(); setSel({ r: 0, c: 0 }); scrollCellVisible(0, 0); return; }
    if (L === 'end') { e.preventDefault(); const r2 = usedR2(), c2 = usedC2(); setSel({ r: r2, c: c2 }); scrollCellVisible(r2, c2); return; }
    if (L === 'd') { e.preventDefault(); fillDown(); return; }
    if (L === 'r') { e.preventDefault(); fillRight(); return; }
    if (L === 'e') { e.preventDefault(); return; }
    if (k === ';') { e.preventDefault(); const cd = new Date(); commitCell(state.sel.a.r, state.sel.a.c, ''); const r = state.sel.a.r, c = state.sel.a.c; pushUndo('Date'); const cdd = cellEnsure(r, c); cdd.t = 'n'; cdd.num = Calc.dateToSerial(cd); cdd.f = cdd.f || 'mm/dd/yyyy'; scheduleRecalc(); markDirty(); afterDataChange(); return; }
    return;
  }
  switch (k) {
    case 'ArrowDown': e.preventDefault(); moveActive(1, 0, e.shiftKey); return;
    case 'ArrowUp': e.preventDefault(); moveActive(-1, 0, e.shiftKey); return;
    case 'ArrowRight': e.preventDefault(); moveActive(0, 1, e.shiftKey); return;
    case 'ArrowLeft': e.preventDefault(); moveActive(0, -1, e.shiftKey); return;
    case 'Tab': e.preventDefault(); moveActive(0, e.shiftKey ? -1 : 1, false, true); return;
    case 'Enter': e.preventDefault(); if (state.clipboard) { const cc0 = curCell(); if (pasteAt(cc0.r, cc0.c)) return; } moveActive(e.shiftKey ? -1 : 1, 0, false, true); return;
    case 'PageDown': e.preventDefault(); pageMove(1); return;
    case 'PageUp': e.preventDefault(); pageMove(-1); return;
    case 'Home': e.preventDefault(); { const s = state.sel; moveActiveHome(e.shiftKey); } return;
    case 'Delete': case 'Backspace':
      /* Shift+Backspace: snap the viewport back to the active cell WITHOUT
         touching the selection (Excel behavior during/after big selections) */
      if (k === 'Backspace' && e.shiftKey) { e.preventDefault(); scrollCellVisible(state.sel.a.r, state.sel.a.c); return; }
      e.preventDefault(); clearContents(); return;
    case 'F2': e.preventDefault(); startEdit(null); return;
    case 'F4': e.preventDefault(); doRedo(); return;
    case 'Escape': e.preventDefault(); state.clipboard = null; requestRender(); return;
    case 'F12': e.preventDefault(); X.openBackstage('saveas'); return;
  }
  if (k.length === 1 && !e.altKey) {
    e.preventDefault();
    startEdit(k, 'replace');
  }
}
function moveActiveHome(shift) {
  const s = state.sel;
  if (shift) { s.b = { r: s.b.r, c: 0 }; }
  else { const cc0 = curCell(); s.a = { r: cc0.r, c: 0 }; s.b = s.a; }
  scrollCellVisible(s.a.r, 0);
  afterSelChange();
}
function hideRows() { pushUndo('Hide Rows'); const n = normSel(); for (let r = n.r1; r <= n.r2; r++) sheet().hidR[r] = true; rebuildGeom(); updateSpacer(); markDirty(); afterDataChange(); }
function hideCols() { pushUndo('Hide Columns'); const n = normSel(); for (let c = n.c1; c <= n.c2; c++) sheet().hidC[c] = true; rebuildGeom(); updateSpacer(); markDirty(); afterDataChange(); }
X.hideRows = hideRows; X.hideCols = hideCols;
function unhideRows(r1, r2) { pushUndo('Unhide Rows'); for (let r = r1; r <= r2; r++) delete sheet().hidR[r]; rebuildGeom(); updateSpacer(); markDirty(); afterDataChange(); }
function unhideCols(c1, c2) { pushUndo('Unhide Columns'); for (let c = c1; c <= c2; c++) delete sheet().hidC[c]; rebuildGeom(); updateSpacer(); markDirty(); afterDataChange(); }
X.unhideRows = unhideRows; X.unhideCols = unhideCols;
function fillDown() {
  const n = normSel();
  if (n.r1 === n.r2) return;
  pushUndo('Fill Down');
  for (let c = n.c1; c <= n.c2; c++) {
    const src = cellGet(n.r1, c);
    if (!src) continue;
    for (let r = n.r1 + 1; r <= n.r2; r++) {
      const cd = cellEnsure(r, c);
      const copy = JSON.parse(JSON.stringify(src));
      if (copy.t === 'f') copy.v = Calc.adjustFormula(copy.v, 0, r - n.r1);
      Object.assign(cd, copy);
    }
  }
  scheduleRecalc(); markDirty(); afterDataChange();
}
function fillRight() {
  const n = normSel();
  if (n.c1 === n.c2) return;
  pushUndo('Fill Right');
  for (let r = n.r1; r <= n.r2; r++) {
    const src = cellGet(r, n.c1);
    if (!src) continue;
    for (let c = n.c1 + 1; c <= n.c2; c++) {
      const cd = cellEnsure(r, c);
      const copy = JSON.parse(JSON.stringify(src));
      if (copy.t === 'f') copy.v = Calc.adjustFormula(copy.v, c - n.c1, 0);
      Object.assign(cd, copy);
    }
  }
  scheduleRecalc(); markDirty(); afterDataChange();
}
X.fillDown = fillDown; X.fillRight = fillRight;

function onEditorKey(e) {
  const k = e.key;
  const ed = $('#cell-editor');
  if (k === 'Enter') {
    e.preventDefault(); e.stopPropagation();
    if (e.altKey) { // line break in cell
      const st = ed.selectionStart;
      ed.value = ed.value.slice(0, st) + '\n' + ed.value.slice(ed.selectionEnd);
      ed.setSelectionRange(st + 1, st + 1);
      return;
    }
    /* Ctrl+Enter: commit the typed value to EVERY cell of the selection as ONE
       atomic undo transaction (Excel behavior) */
    if (e.ctrlKey || e.metaKey) {
      const val = ed.value;
      endEdit(false);              // leave edit mode cleanly, keep the selection
      const n = normSel();
      pushUndo('Typing');          // ONE undo step for the whole bulk drop
      for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) commitCell(r, c, val, { skipUndo: true });
      afterSelChange(); requestRender();
      sbMsg('Filled ' + ((n.r2 - n.r1 + 1) * (n.c2 - n.c1 + 1)) + ' cells (Ctrl+Enter) — one undo reverts all');
      return;
    }
    endEdit(true, e.shiftKey ? 'up' : 'down');
    return;
  }
  if (k === 'Tab') { e.preventDefault(); endEdit(true, 'right'); return; }
  if (k === 'Escape') { e.preventDefault(); endEdit(false); return; }
  if (k === 'F4') { e.preventDefault(); e.stopPropagation(); cycleDollar(); return; }
  if ((k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') && ed.value.startsWith('=')) {
    // point mode movement
    e.preventDefault();
    const delta = k === 'ArrowDown' ? [1, 0] : k === 'ArrowUp' ? [-1, 0] : k === 'ArrowRight' ? [0, 1] : [0, -1];
    e.stopPropagation();
    pointMove(delta[0], delta[1]);
    return;
  }
  e.stopPropagation();
}
let pointState = null;
function pointMove(dr, dc) {
  // find last ref segment at caret and move it
  const ed = $('#cell-editor');
  const pos = ed.selectionStart;
  const v = ed.value;
  const m = v.slice(0, pos).match(/([A-Z]{1,3}[0-9]+)(?::([A-Z]{1,3}[0-9]+))?$/);
  let anchor;
  if (m) {
    const a = Calc.parseRef(m[1]);
    anchor = { r: a.r, c: a.c };
  } else {
    anchor = { r: edit.r, c: edit.c };
    if (pointState) anchor = pointState;
  }
  const cur = pointState || anchor;
  const nr = clamp(cur.r + dr, 0, MAXR - 1), nc = clamp(cur.c + dc, 0, MAXC);
  pointState = { r: nr, c: nc };
  const refStr = a1(nr, nc);
  const before = v.slice(0, pos), after = v.slice(pos);
  const m2 = before.match(/([A-Z]{1,3}[0-9]+)(?::([A-Z]{1,3}[0-9]+))?$/);
  let nb;
  if (m2) nb = before.slice(0, before.length - m2[0].length) + refStr;
  else nb = before + refStr;
  ed.value = nb + after;
  ed.setSelectionRange(nb.length, nb.length);
  scrollCellVisible(nr, nc);
  updateMirrors();
}
function resetPoint() { pointState = null; }

/* ============================ 25. AUTOSUM ============================ */
function autoSum(fn) {
  const s = state.sel;
  const r = s.a.r, c = s.a.c;
  // guess range above then left — Excel stops the scan at text/empty cells (e.g. headers)
  const numish = (rr, cc) => { const d = cellDisplay(rr, cc); return d && d.t === 'n'; };
  let guess = null;
  if (r > 0 && numish(r - 1, c)) {
    let r1 = r - 1;
    while (r1 > 0 && numish(r1 - 1, c)) r1--;
    guess = { r1, c1: c, r2: r - 1, c2: c };
  }
  if (!guess && c > 0 && numish(r, c - 1)) {
    let c1 = c - 1;
    while (c1 > 0 && numish(r, c1 - 1)) c1--;
    guess = { r1: r, c1, r2: r, c2: c - 1 };
  }
  fn = fn || 'SUM';
  const fx = guess ? `=${fn}(${a1(guess.r1, guess.c1)}:${a1(guess.r2, guess.c2)})` : `=${fn}()`;
  commitCell(r, c, fx);
  if (guess) { setSel({ r, c }); }
}
X.autoSum = autoSum;

/* ============================ 26. NOTES (comments) ============================ */
X.notePopup = null;

/* ============================ 27. INIT ============================ */
X.init = function () {
  state.sel = { a: { r: 0, c: 0 }, b: { r: 0, c: 0 }, type: 'cell', ranges: [] };
  setDark(window.XKV && XKV.get('xc.theme') === 'dark');   // boot.js awaited XKV.ready already
  buildRibbon();
  bindGrid();
  $('#qat-save').innerHTML = svgIcon('save');
  $('#qat-undo').innerHTML = svgIcon('undo');
  $('#qat-redo').innerHTML = svgIcon('redo');
  $('#qat-more').innerHTML = svgIcon('chev-d', 'ico-s');
  $$('.sb-view')[0] && ($$('.sb-view')[0].innerHTML = svgIcon('normview'), $$('.sb-view')[1].innerHTML = svgIcon('playout'), $$('.sb-view')[2].innerHTML = svgIcon('pbreak'));
  const sbv = $$('.sb-view');
  if (sbv.length >= 3) { sbv[1].remove(); } // only normal + page break preview exist
  $('#qat-save').addEventListener('click', () => X.saveDoc());
  $('#qat-undo').addEventListener('click', doUndo);
  $('#qat-redo').addEventListener('click', doRedo);
  $('#qat-undo').classList.add('off'); $('#qat-redo').classList.add('off');
  $('#qat-more').addEventListener('click', e => {
    pop(e.currentTarget, menu([
      { label: 'New', icon: 'newdoc', action: () => X.newBook() },
      { label: 'Open', icon: 'folder', action: () => X.openBackstage('open') },
      { label: 'Save', icon: 'save', note: 'Ctrl+S', action: () => X.saveDoc() },
      'sep',
      { label: 'More Commands...', icon: 'options', action: () => X.optionsDialog && X.optionsDialog() },
    ]));
  });
  $('#tb-title').addEventListener('click', e => {
    const body = el('div');
    const f = el('div', { class: 'fld' });
    f.innerHTML = '<span>Workbook name</span>';
    const inp = el('input', { type: 'text', value: state.bookName });
    f.appendChild(inp); body.appendChild(f);
    dlg({ title: 'Rename Workbook', body, width: 340, buttons: [{ label: 'OK', pri: true, fn: () => { X.setBookName(inp.value.trim() || state.bookName); } }, { label: 'Cancel' }] });
  });
  $('#autosave').addEventListener('click', () => {
    state.autosave = !state.autosave;
    $('#as-pill').classList.toggle('on', state.autosave);
    $('#as-state').textContent = state.autosave ? 'On' : 'Off';
    sbMsg(state.autosave ? 'AutoSave is On — changes are saved automatically' : 'AutoSave is Off — press Ctrl+S to save');
    if (state.autosave) X.saveDoc(true);
  });
  $('#win-min').addEventListener('click', () => { document.body.style.transition = 'opacity .15s'; document.body.style.opacity = '.3'; setTimeout(() => { document.body.style.opacity = '1'; }, 500); });
  $('#win-max').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  $('#win-close').addEventListener('click', () => {
    window.close();
    const sp = el('div', { class: 'splash' });
    sp.innerHTML = `<svg viewBox="0 0 32 32" width="60" height="60"><rect x="1" y="1" width="30" height="30" rx="5" fill="#fff"/><path d="M10 9h3l3 7 3-7h3l-4.5 9.5L22 23h-3l-3-6.5L13 23h-3l4.5-9z" fill="#217346"/></svg>
      <div style="font-size:15px">${esc(state.bookName)} has been closed. Your work is saved in this browser.</div>
      <button class="btn pri" style="min-width:140px;height:32px">Back to Workbook</button>`;
    $('button', sp).addEventListener('click', () => sp.remove());
    document.body.appendChild(sp);
  });
  $('#tb-logo').addEventListener('click', () => X.openBackstage('home'));
  // sheet bar
  $('#sheet-new').addEventListener('click', () => { addSheet(); markDirty(); sbMsg('Inserted new sheet'); });
  $('#sn-first').addEventListener('click', () => selectSheet(0));
  $('#sn-prev').addEventListener('click', () => selectSheet(state.active - 1));
  $('#sn-next').addEventListener('click', () => selectSheet(state.active + 1));
  $('#sn-last').addEventListener('click', () => selectSheet(state.sheets.length - 1));
  // findbar
  $('#fb-find').addEventListener('input', e => runFind(e.target.value));
  $('#fb-find').addEventListener('keydown', e => { if (e.key === 'Enter') gotoHit(findIdx + (e.shiftKey ? -1 : 1)); if (e.key === 'Escape') closeFindbar(); });
  $('#fb-next').addEventListener('click', () => gotoHit(findIdx + 1));
  $('#fb-prev').addEventListener('click', () => gotoHit(findIdx - 1));
  $('#fb-x').addEventListener('click', closeFindbar);
  $('#fb-repl').addEventListener('keydown', e => { if (e.key === 'Enter') replaceOne($('#fb-find').value, e.target.value); });
  $('#fb-repl-one').addEventListener('click', () => replaceOne($('#fb-find').value, $('#fb-repl').value));
  $('#fb-repl-all').addEventListener('click', () => replaceAll($('#fb-find').value, $('#fb-repl').value));
  // global keys when grid not focused (e.g. after ribbon clicks): route to grid for safe combos
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .dlg, .popup, #cell-editor')) return;
    if (edit) return;
    if (e.key === 'F2' && !e.target.closest('#grid-scroll')) { e.preventDefault(); startEdit(null); }
  });
  rebuildGeom(); updateSpacer();
  renderSheetTabs();
  afterSelChange();
  recalcAll();
  // boot with CMDS etc. defined in app2 by now
  if (window.XBOOT) XBOOT();
  setTab('home');
  setZoom(state.zoom);
  renderAll();
  sbMode('Ready');
  focusGrid();
};
X._bindGrid = bindGrid;
X._menu = menu;
X._setTab = setTab;
Object.defineProperty(X, 'DEFAULT_COLW', { get: () => DEFAULT_COLW });
Object.defineProperty(X, 'DEFAULT_ROWH', { get: () => DEFAULT_ROWH });
X.HDRW = HDRW; X.HDRH = HDRH; X.MAXR = MAXR; X.MAXC = MAXC;

})();
