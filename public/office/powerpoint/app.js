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
   PowerPoint clone — core application
   model | render | selection | text edit | manipulation | undo | save
   ========================================================================== */
'use strict';
const $ = s => document.querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, attrs, ...kids) => {
  const d = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') d.className = v;
    else if (k === 'style') d.style.cssText = v;
    else if (k.startsWith('on')) d.addEventListener(k.slice(2), v);
    else if (k === 'html') d.innerHTML = v;
    else d.setAttribute(k, v);
  }
  for (const k of kids) {
    if (k == null) continue;
    // Our own markup strings (icons, glyphs) render as HTML; plain text stays text.
    // User-derived content always arrives pre-escaped via esc(), so it can never start with '<'.
    if (typeof k === 'string' && k.trim().startsWith('<')) d.insertAdjacentHTML('beforeend', k);
    else d.append(k);
  }
  return d;
};
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => 'o' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(2, 5);

/* ---------------- constants ---------------- */
const SLW = 1280, SLH = 720;
function SW() { return (state && state.sizeW) || SLW; }
function SH() { return (state && state.sizeH) || SLH; }
const EMU_PX = 9525;
const FONTS = ['Calibri', 'Calibri Light', 'Cambria', 'Georgia', 'Arial', 'Arial Black', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Segoe UI'];
const FSTACK = `'Calibri','Segoe UI',sans-serif`;
const STD = ['#000000', '#44546A', '#E7E6E6', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#FF0000'];
const PALETTE_TOP = ['#000000', '#FFFFFF', '#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0'];

/* default Office theme (PowerPoint 2016). dk1/lt1/dk2/lt2 + 6 accents + hlink */
const OFFICE_THEME = {
  name: 'Office Theme', majFont: 'Calibri Light', minFont: 'Calibri',
  dk1: '#000000', lt1: '#FFFFFF', dk2: '#44546A', lt2: '#E7E6E6',
  a1: '#4472C4', a2: '#ED7D31', a3: '#A5A5A5', a4: '#FFC000', a5: '#5B9BD5', a6: '#70AD47', hl: '#0563C1',
};
const THEMES = [
  { name: 'Office Theme', majors: 'Calibri Light', t: OFFICE_THEME },
  { name: 'Facet', majors: 'Trebuchet MS', t: { ...OFFICE_THEME, name: 'Facet', majFont: 'Trebuchet MS', minFont: 'Trebuchet MS', dk2: '#90C226', lt2: '#54B021', a1: '#90C226', a2: '#54B021', a3: '#FF9501', a4: '#FFC408', a5: '#97CB3D', a6: '#B75F24', hl: '#006D9E' } },
  { name: 'Integral', majors: 'Arial', t: { ...OFFICE_THEME, name: 'Integral', majFont: 'Arial', minFont: 'Arial', dk2: '#1CADE4', lt2: '#2683C6', a1: '#1CADE4', a2: '#2683C6', a3: '#27CED7', a4: '#42BA97', a5: '#3E8853', a6: '#62A39F', hl: '#41436A' } },
  { name: 'Ion', majors: 'Cambria', t: { ...OFFICE_THEME, name: 'Ion', majFont: 'Cambria', minFont: 'Calibri', dk2: '#B01513', lt2: '#EA6312', a1: '#B01513', a2: '#EA6312', a3: '#E6B729', a4: '#6AAC90', a5: '#5F9F4D', a6: '#8D8E82', hl: '#56A0C1' } },
  { name: 'Retrospect', majors: 'Georgia', t: { ...OFFICE_THEME, name: 'Retrospect', majFont: 'Georgia', minFont: 'Georgia', dk2: '#F48312', lt2: '#E7E3E1', a1: '#F48312', a2: '#8E6C60', a3: '#9B624A', a4: '#F7B533', a5: '#695F5E', a6: '#9F9D6C', hl: '#B86E2D' } },
  { name: 'Berlin', majors: 'Trebuchet MS', t: { ...OFFICE_THEME, name: 'Berlin', majFont: 'Trebuchet MS', minFont: 'Trebuchet MS', dk2: '#589CA0', lt2: '#C2E0EB', a1: '#589CA0', a2: '#887E3E', a3: '#95B97D', a4: '#E7A316', a5: '#577990', a6: '#B2B18A', hl: '#44778F' } },
];
function TH() {
  const t = state.theme;
  const v = VARIANTS[state.variant];
  return v ? Object.assign({}, t, v) : t;
}
function themeColor(key) { return TH()[key] || key; }
/* variant recolor maps (like Design > Variants): tint accents */
const VARIANTS = [
  null,
  { a1: '#ED7D31', a2: '#70AD47', a3: '#FFC000', a4: '#4472C4', a5: '#5B9BD5', a6: '#A5A5A5' },
  { a1: '#70AD47', a2: '#4472C4', a3: '#ED7D31', a4: '#A5A5A5', a5: '#FFC000', a6: '#5B9BD5' },
  { a1: '#7030A0', a2: '#C00000', a3: '#548235', a4: '#2E75B6', a5: '#BF9000', a6: '#767171' },
];

/* ---------------- layouts ---------------- */
const LVL_FS = [28, 24, 20, 18, 16];
const LAYOUTS = {
  title: {
    nm: 'Title Slide',
    ph: [
      { ph: 'title', x: 122, y: 263, w: 1036, h: 116, fs: 44, al: 'c', anchor: 'b', prompt: 'Click to add title' , noBullet: true },
      { ph: 'body', x: 212, y: 388, w: 856, h: 90, fs: 24, al: 'c', anchor: 't', prompt: 'Click to add subtitle', noBullet: true },
    ],
  },
  titleContent: {
    nm: 'Title and Content',
    ph: [
      { ph: 'title', x: 51, y: 23, w: 1178, h: 114, fs: 40, al: 'l', anchor: 't', prompt: 'Click to add title' , noBullet: true },
      { ph: 'body', x: 51, y: 152, w: 1178, h: 504, fs: 28, al: 'l', anchor: 't', prompt: 'Click to add text' },
    ],
  },
  sectionHeader: {
    nm: 'Section Header',
    ph: [
      { ph: 'title', x: 51, y: 293, w: 1178, h: 116, fs: 40, al: 'l', anchor: 'b', prompt: 'Click to add title' , noBullet: true },
      { ph: 'body', x: 51, y: 413, w: 1178, h: 140, fs: 24, al: 'l', anchor: 't', prompt: 'Click to add text', noBullet: true },
    ],
  },
  twoContent: {
    nm: 'Two Content',
    ph: [
      { ph: 'title', x: 51, y: 23, w: 1178, h: 114, fs: 40, al: 'l', anchor: 't', prompt: 'Click to add title' , noBullet: true },
      { ph: 'body', x: 51, y: 152, w: 567, h: 504, fs: 28, al: 'l', anchor: 't', prompt: 'Click to add text' },
      { ph: 'body2', x: 662, y: 152, w: 567, h: 504, fs: 28, al: 'l', anchor: 't', prompt: 'Click to add text' },
    ],
  },
  comparison: {
    nm: 'Comparison',
    ph: [
      { ph: 'title', x: 51, y: 23, w: 1178, h: 114, fs: 40, al: 'l', anchor: 't', prompt: 'Click to add title' , noBullet: true },
      { ph: 'body', x: 51, y: 152, w: 567, h: 44, fs: 16, al: 'c', anchor: 'm', prompt: 'Click to add text', noBullet: true, cap: true },
      { ph: 'body2', x: 662, y: 152, w: 567, h: 44, fs: 16, al: 'c', anchor: 'm', prompt: 'Click to add text', noBullet: true, cap: true },
      { ph: 'body3', x: 51, y: 206, w: 567, h: 450, fs: 28, al: 'l', anchor: 't', prompt: 'Click to add text' },
      { ph: 'body4', x: 662, y: 206, w: 567, h: 450, fs: 28, al: 'l', anchor: 't', prompt: 'Click to add text' },
    ],
  },
  titleOnly: { nm: 'Title Only', ph: [{ ph: 'title', x: 51, y: 23, w: 1178, h: 114, fs: 40, al: 'l', anchor: 't', prompt: 'Click to add title' , noBullet: true }] },
  blank: { nm: 'Blank', ph: [] },
  contentCaption: {
    nm: 'Content with Caption',
    ph: [
      { ph: 'title', x: 51, y: 23, w: 340, h: 134, fs: 28, al: 'l', anchor: 't', prompt: 'Click to add title' , noBullet: true },
      { ph: 'body', x: 51, y: 172, w: 340, h: 484, fs: 16, al: 'l', anchor: 't', prompt: 'Click to add text' },
      { ph: 'body2', x: 446, y: 152, w: 783, h: 504, fs: 24, al: 'l', anchor: 't', prompt: 'Click to add text' },
    ],
  },
  picCaption: {
    nm: 'Picture with Caption',
    ph: [
      { ph: 'pic', x: 76, y: 24, w: 1128, h: 470, prompt: 'Click to insert picture' },
      { ph: 'title', x: 76, y: 508, w: 1128, h: 66, fs: 24, al: 'l', anchor: 't', prompt: 'Click to add title' , noBullet: true },
      { ph: 'body', x: 76, y: 578, w: 1128, h: 118, fs: 18, al: 'l', anchor: 't', prompt: 'Click to add text' },
    ],
  },
};
const LAYOUT_ORDER = ['title', 'titleContent', 'sectionHeader', 'twoContent', 'comparison', 'titleOnly', 'blank', 'contentCaption', 'picCaption'];
function layoutOf(s) { return LAYOUTS[s ? s.layout : cur().layout] || LAYOUTS.titleContent; }

/* ---------------- state ---------------- */
let state = null;
let editing = null;      // object id being text-edited
let objDrag = null;
let hist = [], hi = -1, pushTimer = null;
let clipObjs = [];
let rafPending = false;

function newRun(t, s) { return { t, ...(s || {}) }; }
function newPara(text, opts) {
  return { runs: [newRun(text || '')], align: (opts && opts.align) || null, level: (opts && opts.level) || 0, bullet: (opts && opts.bullet != null) ? opts.bullet : 'char', spaceAfter: null, line: null };
}
function plainObj(o) {
  return {
    id: o.id || uid(), kind: o.kind || 'text', ph: o.ph || null, cap: !!o.cap,
    x: o.x || 0, y: o.y || 0, w: o.w || 240, h: o.h || 120, rot: o.rot || 0,
    paras: o.paras || null, anchor: o.anchor || 't', noBullet: !!o.noBullet,
    fs: o.fs || 18, al: o.al || 'l', font: o.font || null,
    shape: o.shape || null, fill: o.fill, line: o.line || null, shadow: !!o.shadow,
    src: o.src || null, crop: o.crop || null,
    rows: o.rows || 0, cols: o.cols || 0, colW: o.colW || null, tbl: o.tbl || null, style: o.style || 'medium2',
    chart: o.chart || null, link: o.link || null, prompt: o.prompt || null, name: o.name || '',
    z: o.z || 0, video: null,
  };
}
function newPhObject(def) {
  return plainObj({
    kind: def.ph === 'pic' ? 'picph' : 'text', ph: def.ph === 'title' ? 'title' : (def.ph && def.ph.startsWith('body') ? 'body' : def.ph), cap: def.cap,
    x: def.x, y: def.y, w: def.w, h: def.h, anchor: def.anchor || 't', fs: def.fs || 18, al: def.al || 'l',
    noBullet: def.noBullet, prompt: def.prompt,
    paras: def.ph === 'pic' ? null : [newPara('', { align: def.al })],
  });
}
function newSlide(layout) {
  const s = { id: uid(), layout: LAYOUTS[layout] ? layout : 'titleContent', objects: [], notes: '', hidden: false, transition: null, anims: [], bg: null };
  (LAYOUTS[s.layout].ph || []).forEach(def => { if (def.ph !== 'pic') s.objects.push(newPhObject(def)); });
  return s;
}
function freshPres() {
  return {
    presName: 'Presentation1', theme: JSON.parse(JSON.stringify(OFFICE_THEME)), variant: 0,
    slides: [newSlide('title')], active: 0, sel: { objs: [] },
    zoom: 'fit', view: 'normal', notesOpen: true, dirty: false, created: Date.now(), modified: Date.now(),
    comments: {},
  };
}

/* ---------------- undo ---------------- */
function snapshot() {
  return JSON.stringify({ presName: state.presName, theme: state.theme, variant: state.variant, slides: state.slides, active: state.active, comments: state.comments, hf: state.hf || null, showSetup: state.showSetup || null, sizeW: state.sizeW || null, sizeH: state.sizeH || null });
}
function pushHistory(label, debounce) {
  const doPush = () => {
    pushTimer = null;
    const s = snapshot();
    if (hist[hi] === s) return;
    if (hi < hist.length - 1) hist = hist.slice(0, hi + 1);
    hist.push(s); hi = hist.length - 1;
    if (hist.length > 120) { hist.shift(); hi--; }
    updateUndoButtons();
    markDirty();
  };
  if (debounce) { if (!pushTimer) pushTimer = setTimeout(doPush, 420); }
  else { if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; } doPush(); }
}
function doUndo() {
  if (editing) endEdit(true);
  if (pushTimer) { // flush a pending debounced snapshot so undo steps one real action
    clearTimeout(pushTimer); pushTimer = null;
    const s = snapshot();
    if (hist[hi] !== s) { hist.push(s); hi = hist.length - 1; if (hist.length > 120) { hist.shift(); hi--; } updateUndoButtons(); }
  }
  if (hi <= 0) { sbMsg('Nothing to undo'); return; }
  hi--; restore(JSON.parse(hist[hi])); sbMsg('Undone');
}
function doRedo() {
  if (editing) endEdit(true);
  if (hi >= hist.length - 1) { sbMsg('Nothing to redo'); return; }
  hi++; restore(JSON.parse(hist[hi])); sbMsg('Redone');
}
function restore(sv) {
  const keepZoom = state.zoom, keepView = state.view;
  state.presName = sv.presName; state.theme = sv.theme; state.variant = sv.variant;
  state.slides = sv.slides; state.active = clamp(sv.active, 0, state.slides.length - 1);
  state.comments = sv.comments || {};
  state.hf = sv.hf || null; state.showSetup = sv.showSetup || null;
  state.sizeW = sv.sizeW || null; state.sizeH = sv.sizeH || null;
  layoutStage();
  state.sel = { objs: [] };
  state.zoom = keepZoom; state.view = keepView;
  applyThemeCSS();
  renderAll(); updateUndoButtons(); markDirty();
}
function updateUndoButtons() {
  const u = $('#qat-undo'), r = $('#qat-redo');
  if (u) u.disabled = hi <= 0;
  if (r) r.disabled = hi >= hist.length - 1;
}

/* ---------------- model helpers ---------------- */
function cur() { return state.slides[state.active]; }
function objById(id, s) { return (s || cur()).objects.find(o => o.id === id); }
function selObjs() { return cur().objects.filter(o => state.sel.objs.includes(o.id)); }
function firstSel() { return selObjs()[0] || null; }
function isTextish(o) { return o && (o.kind === 'text' || (o.kind === 'shape' && !(o.shape || '').startsWith('line')) || o.kind === 'table'); }
function objTextEmpty(o) {
  if (!o.paras || o.paras.length === 0) return true;
  return o.paras.every(p => !p.runs.some(r => r.t !== '')) && o.paras.length === 1;
}
function markDirty() { state.dirty = true; state.modified = Date.now(); clearTimeout(markDirty._t); markDirty._t = setTimeout(autoSave, 2600); }
function autoSave() {
  const opts = JSON.parse(XKV.get('pc.opts') || '{}');
  if (opts.autosave !== false) saveDoc(true);
}

/* ============================ render ============================ */
function Z() { return typeof state.zoom === 'number' ? state.zoom : fitZoom(); }
function fitZoom() {
  const st = $('#stage');
  const w = st.clientWidth - 84, h = st.clientHeight - 58;
  return clamp(Math.min(w / SW(), h / SH()), 0.05, 4);
}
function setZoom(z, label) {
  state.zoom = z === 'fit' ? 'fit' : clamp(z, 0.1, 4);
  layoutStage();
  renderAll();
  if (label) sbMsg('Zoom: ' + Math.round(Z() * 100) + '%');
}
function layoutStage() {
  const z = Z();
  const wrap = $('#slide-wrap');
  wrap.style.width = SW() * z + 'px'; wrap.style.height = SH() * z + 'px';
  const sl = $('#slide');
  sl.style.width = SW() + 'px'; sl.style.height = SH() + 'px';
  sl.style.transform = `scale(${z})`;
  const ov = $('#obj-overlay');
  ov.style.cssText = `position:absolute;left:0;top:0;width:${SW() * z}px;height:${SH() * z}px;pointer-events:none;z-index:40;`;
  const pct = Math.round(Z() * 100);
  $('#zoom-pct').textContent = state.zoom === 'fit' ? 'Fit' : pct + '%';
  $('#zoom-slider').value = clamp(pct, 10, 400);
}

/* ---------- text paragraphs → html ---------- */
function paraFontSize(o, p) { return o.fs * (o.ph === 'body' && p.level ? (LVL_FS[p.level] / LVL_FS[0] || 1) : 1); }
function runStyle(r, o, p) {
  const fs = (r.size || paraFontSize(o, p));
  const fam = r.font || o.font || (o.ph === 'title' ? TH().majFont : TH().minFont) || 'Calibri';
  const css = [`font-size:${fs.toFixed(1)}pt`, `font-family:'${fam}',${FSTACK}`];
  if (r.b) css.push('font-weight:700');
  if (r.i) css.push('font-style:italic');
  const dec = [];
  if (r.u) dec.push('underline');
  if (r.strike) dec.push('line-through');
  if (dec.length) css.push(`text-decoration:${dec.join(' ')}`);
  if (r.color) css.push(`color:${r.color}`);
  if (r.hl) css.push(`background-color:${r.hl}`);
  if (r.link) css.push('color:#0563C1;text-decoration:underline');
  return css.join(';');
}
function paraHTML(o, p, idx) {
  const fs = paraFontSize(o, p);
  const align = p.align || o.al || 'left';
  const al = { l: 'left', left: 'left', c: 'center', center: 'center', r: 'right', right: 'right', j: 'justify', justify: 'justify' }[align] || 'left';
  const css = [`text-align:${al}`, `font-size:${fs.toFixed(1)}pt`, `line-height:${(p.line || 1) === 1 ? '1.02' : p.line}`, `margin-bottom:${p.spaceAfter != null ? p.spaceAfter : 6}pt`];
  const bul = o.noBullet ? 'none' : (p.bullet || 'char');
  let cls = 'pl';
  if (bul === 'char' && !o.noBullet) {
    cls += ' bu-char';
    const chars = ['•', '–', '▪', '·', '–'];
    css.push(`--bullet:'${chars[Math.min(p.level || 0, 4)]}'`, `padding-left:22px`, `--bindent:-22px`);
  } else if (bul === 'num' && !o.noBullet) {
    cls += ' bu-auto';
    css.push('padding-left:24px', '--bindent:-24px');
  }
  if (p.level) css.push('margin-left:' + (p.level * 26) + 'px');
  const inner = p.runs.map(r => `<span style="${runStyle(r, o, p)}">${esc(r.t).replace(/\n/g, '<br>')}</span>`).join('');
  return `<div class="${cls}" data-pi="${idx}" style="${css.join(';')}">${inner || '<br>'}</div>`;
}

/* ---------- shape paths ---------- */
const SHAPE_DEFS = {
  rect: 'M0 0 H100 V100 H0 Z',
  roundRect: 'M12 0 H88 Q100 0 100 12 V88 Q100 100 88 100 H12 Q0 100 0 88 V12 Q0 0 12 0 Z',
  ellipse: 'M50 0 A50 50 0 1 1 49.9 0 Z',
  triangle: 'M50 0 L100 100 H0 Z',
  rtTriangle: 'M0 0 L100 100 H0 Z',
  diamond: 'M50 0 L100 50 L50 100 L0 50 Z',
  pentagon: 'M50 0 L100 38 L81 100 H19 L0 38 Z',
  hexagon: 'M25 0 H75 L100 50 L75 100 H25 L0 50 Z',
  octagon: 'M30 0 H70 L100 30 V70 L70 100 H30 L0 70 V30 Z',
  parallelogram: 'M22 0 H100 L78 100 H0 Z',
  trapezoid: 'M22 0 H78 L100 100 H0 Z',
  chevron: 'M0 0 H75 L100 50 L75 100 H0 L25 50 Z',
  star4: 'M50 0 L61 39 L100 50 L61 61 L50 100 L39 61 L0 50 L39 39 Z',
  star5: 'M50 0 L63 35 L100 35 L70 56 L80 91 L50 70 L20 91 L30 56 L0 35 L37 35 Z',
  heart: 'M50 32 C42 8 8 8 8 34 C8 56 34 72 50 90 C66 72 92 56 92 34 C92 8 58 8 50 32 Z',
  lightning: 'M62 0 L18 55 H44 L36 100 L82 42 H55 Z',
  sun: 'M50 22 A28 28 0 1 1 49.9 22 Z M50 0 V12 M50 88 V100 M0 50 H12 M88 50 H100 M15 15 L23 23 M77 77 L85 85 M85 15 L77 23 M23 77 L15 85',
  moon: 'M64 6 A44 44 0 1 0 94 78 A38 38 0 0 1 64 6 Z',
  cloud: 'M28 76 A18 18 0 0 1 32 40 A24 24 0 0 1 76 40 A15 15 0 0 1 84 76 Z',
  smiley: 'M50 0 A50 50 0 1 1 49.9 0 Z',
  donut: 'M50 0 A50 50 0 1 1 49.9 0 Z M50 30 A20 20 0 1 0 49.9 30 Z',
  pie: 'M50 50 L100 50 A50 50 0 1 1 50 0 Z',
  arrowRight: 'M0 32 H62 V12 L100 50 L62 88 V68 H0 Z',
  arrowLeft: 'M100 32 H38 V12 L0 50 L38 88 V68 H100 Z',
  arrowUp: 'M32 100 V38 H12 L50 0 L88 38 H68 V100 Z',
  arrowDown: 'M32 0 V62 H12 L50 100 L88 62 H68 V0 Z',
  arrowLR: 'M0 32 H28 V12 L52 50 L28 88 V68 H0 Z M100 32 H72 V12 L48 50 L72 88 V68 H100 Z',
  cube: 'M50 0 L100 25 V75 L50 100 L0 75 V25 Z M0 25 L50 50 L100 25 M50 50 V100',
  cylinder: 'M50 0 C22 0 8 8 8 16 V84 C8 92 22 100 50 100 C78 100 92 92 92 84 V16 C92 8 78 0 50 0 Z',
  cone: 'M50 0 L92 84 C92 92 76 100 50 100 C24 100 8 92 8 84 Z',
  frameCorner: 'M0 0 H100 V32 H32 V100 H0 Z',
  cross: 'M30 0 H70 V30 H100 V70 H70 V100 H30 V70 H0 V30 H30 Z',
  calloutRound: 'M50 8 A42 34 0 1 1 49.9 8 Z M30 60 L14 96 L44 66',
  calloutSquare: 'M6 6 H94 V66 H60 L40 96 L44 66 H6 Z',
  flow1: 'M0 12 H70 V0 L100 50 L70 100 V88 H0 Z',
  smileyEyes: '',
};
function shapeSVG(o) {
  let k = o.shape || 'rect';
  const d = SHAPE_DEFS[k] || SHAPE_DEFS.rect;
  const fill = resolveFill(o.fill, 'shape');
  const ln = o.line === 'none' ? null : (o.line || { c: TH().a1, w: 1.25 });
  const lineC = ln ? (themeColor(ln.c) || ln.c) : 'none';
  const lineW = ln ? (ln.w || 1.25) : 0;
  const lineAttrs = ln ? `stroke="${lineC}"` : 'stroke="none"';
  let fillAttrs;
  if (!fill) fillAttrs = `fill="${TH().a1}"`;
  else if (fill.t === 'none') fillAttrs = 'fill="none"';
  else fillAttrs = `fill="${fill.c}"${fill.alpha != null && fill.alpha < 1 ? ` fill-opacity="${fill.alpha}"` : ''}`;
  // Straight connectors render as a stroked segment, not a filled path
  if (k === 'line' || k === 'lineArrow') {
    const lc = ln ? lineC : (themeColor('tx1') || '#000');
    const lw = ln ? lineW : 1;
    const arrow = k === 'lineArrow'
      ? `<path d="M86 42 L99 50 L86 58" fill="none" stroke="${lc}" stroke-width="${lw}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    return `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="50" x2="99" y2="50" stroke="${lc}" stroke-width="${lw}" vector-effect="non-scaling-stroke"/>${arrow}</svg>`;
  }
  const deco = (k === 'cylinder' || k === 'cube' || k === 'cone')
    ? `<path d="${shapeDetails(k)}" fill="none" ${lineAttrs} stroke-width="${ln ? lineW : 1}" vector-effect="non-scaling-stroke"/>` : '';
  const face = k === 'smiley'
    ? `<circle cx="35" cy="40" r="6" fill="#3B3838"/><circle cx="65" cy="40" r="6" fill="#3B3838"/><path d="M30 64 Q50 80 70 64" stroke="#3B3838" stroke-width="4" fill="none" stroke-linecap="round"/>` : '';
  return `<svg width="100%" height="100%" viewBox="-2 -2 104 104" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="${d}" ${fillAttrs} ${lineAttrs} stroke-width="${lineW}" vector-effect="non-scaling-stroke"/>${deco}${face}</svg>`;
}
function shapeDetails(k) {
  if (k === 'cylinder') return 'M8 16 C8 24 22 30 50 30 C78 30 92 24 92 16 M8 84 C8 76 22 70 50 70 C78 70 92 76 92 84';
  if (k === 'cube') return 'M0 25 L50 50 L100 25 M50 50 V100';
  if (k === 'cone') return 'M8 84 C8 92 24 100 50 100 C76 100 92 92 92 84 M8 84 C8 76 24 70 50 70 C76 70 92 76 92 84';
  return '';
}
function resolveFill(f, kind) {
  if (f === undefined || f === null) return null;
  if (f.t === 'theme') return { t: 'solid', c: themeColor(f.c) };
  return f;
}

/* ---------- object html ---------- */
function objBaseStyle(o) {
  const rot = o.rot ? `;transform:rotate(${o.rot}deg)` : '';
  const sh = o.shadow ? ';filter:drop-shadow(2.5px 3.5px 3px rgba(0,0,0,.28))' : '';
  return `left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px${rot}${sh};z-index:${o.z || 0}`;
}
function anchorCSS(o) {
  const map = { t: 'flex-start', m: 'center', b: 'flex-end' };
  return `display:flex;flex-direction:column;justify-content:${map[o.anchor || 't']}`;
}
function objectHTML(o, opts) {
  opts = opts || {};
  const TXTID = opts.noSel ? `data-thtxt="${o.id}"` : `id="txt-${o.id}"`;
  const base = `class="obj ${o.ph ? 'ph-' + o.ph : ''}${o.ph && objTextEmpty(o) && editing !== o.id ? ' ph-empty' : ''}" data-oid="${o.id}" style="${objBaseStyle(o)}"`;
  const ghost = o.ph && objTextEmpty(o) && editing !== o.id ? `<div class="ph-ghost ${o.anchor === 'm' ? 'center' : o.anchor === 'b' ? 'bottom' : ''}" style="font-size:${Math.min(o.fs, 24)}pt;font-family:'${o.ph === 'title' ? TH().majFont : TH().minFont}',${FSTACK}">${esc(o.prompt || (o.ph === 'pic' ? '' : 'Click to add text'))}</div>` : '';
  if (o.kind === 'text') {
    const body = `<div class="txt pnum-reset" ${TXTID} style="${anchorCSS(o)}">${o.paras.map((p, i) => paraHTML(o, p, i)).join('')}</div>`;
    return `<div ${base}>${ghost}${body}</div>`;
  }
  if (o.kind === 'shape') {
    const face = shapeSVG(o);
    const txt = o.paras ? `<div class="st" style="padding:4px 6px"><div class="txt pnum-reset" ${TXTID} style="${anchorCSS(o)};min-height:0;flex:0 1 auto">${o.paras.map((p, i) => paraHTML(o, p, i)).join('')}</div></div>` : '';
    return `<div ${base}><div class="shape-cv">${face}</div>${txt ? `<div class="shape-cv">${txt}</div>` : ''}</div>`;
  }
  if (o.kind === 'pic' || o.kind === 'picph') {
    if (!o.src) {
      return `<div ${base}>${ghost}<div class="ph-pic">${svgIcon('pictures')}<span>${esc(o.prompt || 'Click to insert picture')}</span></div></div>`;
    }
    const c = o.crop || { l: 0, t: 0, r: 0, b: 0 };
    const sx = 100 / Math.max(1e-6, 100 - c.l - c.r), sy = 100 / Math.max(1e-6, 100 - c.t - c.b);
    const posL = -(c.l) * sx, posT = -(c.t) * sy;
    return `<div ${base} style="overflow:hidden;${objBaseStyle(o)}"><img src="${o.src}" draggable="false" style="position:absolute;left:${posL}%;top:${posT}%;width:${sx * 100}%;height:${sy * 100}%;max-width:none;max-height:none;user-select:none"/></div>`;
  }
  if (o.kind === 'table') return `<div ${base}>${tableHTML(o)}</div>`;
  if (o.kind === 'chart') return `<div ${base}><div class="chart-in" style="width:100%;height:100%;background:#fff">${chartSVG(o, o.w, o.h)}</div></div>`;
  return `<div ${base}></div>`;
}

/* ---------- tables ---------- */
function newTableObject(x, y, w, h, rows, cols) {
  const tbl = [];
  for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) row.push({ paras: [newPara('', { bullet: 'none' })], fill: null }); tbl.push(row); }
  return plainObj({ kind: 'table', x, y, w, h, rows, cols, colW: Array(cols).fill(1 / cols), tbl, style: 'medium2', fs: 16 });
}
function tableStyle(style, r, rows) {
  // PowerPoint "Medium Style 2 - Accent 1"
  const a1 = TH().a1;
  if (r === 0) return { bg: a1, color: '#FFFFFF', b: true, sz: 1.0 };
  const band = r % 2 === 1;
  return { bg: band ? '#DEEAF6' : '#FFFFFF', color: null, b: false, sz: 1 };
}
function tableHTML(o) {
  const rows = o.rows || (o.tbl ? o.tbl.length : 0);
  const cols = o.cols || (o.tbl && o.tbl[0] ? o.tbl[0].length : 0);
  if (!rows || !cols) return '';
  const colW = (Array.isArray(o.colW) && o.colW.length === cols) ? o.colW : Array.from({ length: cols }, () => 1 / cols);
  let out = `<table class="tbl" data-tid="${o.id}"><colgroup>${colW.map(w => `<col style="width:${(w * 100).toFixed(2)}%"/>`).join('')}</colgroup>`;
  for (let r = 0; r < rows; r++) {
    const st = tableStyle(o.style, r, rows);
    out += `<tr style="height:${(100 / rows).toFixed(2)}%">`;
    for (let c = 0; c < cols; c++) {
      const cell = (o.tbl && o.tbl[r] && o.tbl[r][c]) || { paras: [newPara('')] };
      if (!cell.paras) cell.paras = [newPara('')];
      const tag = r === 0 ? 'th' : 'td';
      const stt = [`background:${cell.fill || st.bg}`];
      if (st.color) stt.push(`color:${st.color}`);
      if (st.b) stt.push('font-weight:700');
      const paras = (cell.paras || []).map(p => paraHTML({ fs: o.fs, al: 'l', font: null, noBullet: true }, { ...p, bullet: 'none' }, 0)).join('');
      out += `<${tag} data-tr="${r}" data-tc="${c}" style="${stt.join(';')}">${paras || '<br>'}</${tag}>`;
    }
    out += '</tr>';
  }
  return out + '</table>';
}

/* ---------- renderers ---------- */
function renderSlideInto(host, slide, opts) {
  opts = opts || {};
  const objs = [...slide.objects].sort((a, b) => (a.z || 0) - (b.z || 0));
  host.innerHTML = '';
  host.style.background = slide.bg && slide.bg.color ? slide.bg.color : '#fff';
  for (const o of objs) {
    const d = document.createElement('div');
    d.innerHTML = objectHTML(o, opts);
    const node = d.firstElementChild;
    if (opts.noSel) node.style.pointerEvents = 'none';
    host.appendChild(node);
  }
  if (!opts.noHF) host.appendChild(hfNode(slide));
}
// Header/Footer layer: date (bottom-left), footer (bottom-center), slide # (bottom-right)
function hfNode(slide) {
  const hf = slide.hfOverride || (state && state.hf) || {};
  const layer = document.createElement('div');
  layer.className = 'hf-layer';
  const isTitle = slide.layout === 'title' || slide.layout === 'sectionHead';
  if (isTitle && hf.noTitle) return layer;
  const mk = (txt, cls) => {
    const d = document.createElement('div');
    d.className = 'hf-item ' + cls;
    d.textContent = txt;
    return d;
  };
  if (hf.dateOn) {
    let dt = hf.dateText || '';
    if (hf.dateAuto) dt = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    if (dt) layer.appendChild(mk(dt, 'hf-date'));
  }
  if (hf.footerOn && hf.footer) layer.appendChild(mk(hf.footer, 'hf-footer'));
  if (hf.numOn) layer.appendChild(mk(String((slide.idx != null ? slide.idx : state.slides.indexOf(slide)) + 1), 'hf-num'));
  return layer;
}
function renderMain() {
  if (editing || window._pptTblEdit) { renderOverlay(); return; } // never rebuild the DOM the user is typing in
  const host = $('#slide');
  renderSlideInto(host, cur(), {});
  attachObjectEvents(host);
  renderOverlay();
}
function renderOverlay() {
  const ov = $('#obj-overlay');
  const z = Z();
  let parts = [];
  const objs = selObjs();
  for (const o of objs) {
    const x = o.x * z, y = o.y * z, w = o.w * z, h = o.h * z;
    if (o.ph && objTextEmpty(o) && editing !== o.id) continue;
    const slim = editing === o.id ? ' slim' : '';
    const rot = o.rot ? `;transform:rotate(${o.rot}deg);transform-origin:center` : '';
    parts.push(`<div class="selbox${slim}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px${rot}"></div>`);
    if (editing !== o.id) {
      const hs = [[0, 0, 'nw'], [.5, 0, 'n'], [1, 0, 'ne'], [1, .5, 'e'], [1, 1, 'se'], [.5, 1, 's'], [0, 1, 'sw'], [0, .5, 'w']];
      for (const [fx, fy, dir] of hs) {
        parts.push(`<div class="handle" data-h="${dir}" style="left:${x + w * fx - 4.5}px;top:${y + h * fy - 4.5}px;cursor:${dir}-resize"></div>`);
      }
      parts.push(`<div class="rot-handle" data-h="rot" title="Rotate" style="left:${x + w / 2 - 5.5}px;top:${y - 26}px"></div>`);
    }
  }
  ov.innerHTML = parts.join('');
  $$('.handle, .rot-handle', ov).forEach(h2 => h2.addEventListener('mousedown', startHandleDrag));
}

/* thumbnails */
function renderThumbs() {
  const list = $('#thumb-list');
  list.innerHTML = '';
  state.slides.forEach((s, i) => {
    const t = el('div', { class: 'thumb' + (i === state.active ? ' on' : ''), draggable: 'true' });
    t.dataset.idx = i;
    const star = s.transition && s.transition.kind && s.transition.kind !== 'none' ? `<span class="tstar" title="Transition: ${s.transition.kind}"><svg viewBox="0 0 24 24" width="10" height="10"><path d="M12 2 L14.6 8.9 L22 9.2 L16.2 13.6 L18 20.8 L12 16.9 L6 20.8 L7.8 13.6 L2 9.2 L9.4 8.9 Z" fill="#C43E1C"/></svg></span>` : '';
    t.appendChild(el('div', { class: 'tn' }, String(i + 1), star ? '' : ''));
    const tn = t.querySelector('.tn');
    if (star) tn.innerHTML = (i + 1) + ' ' + star;
    const cv = el('div', { class: 'thumb-cv' });
    cv.appendChild(thumbNode(s, 152 / SW()));
    if (s.hidden) cv.appendChild(el('div', { class: 'thidden', html: svgIcon('hideSlide') }));
    t.appendChild(cv);
    t.addEventListener('mousedown', () => { if (i !== state.active) selectSlide(i); });
    t.addEventListener('dblclick', () => { });
    t.addEventListener('contextmenu', e => { e.preventDefault(); if (i !== state.active) selectSlide(i); if (P.slideCtxMenu) P.slideCtxMenu(e, i); });
    t.addEventListener('dragstart', e => { e.dataTransfer.setData('text/ppt-thumb', String(i)); e.dataTransfer.effectAllowed = 'move'; });
    t.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/ppt-thumb')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
    t.addEventListener('drop', e => {
      const from = +e.dataTransfer.getData('text/ppt-thumb');
      if (isNaN(from)) return;
      e.preventDefault();
      const rect = t.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      moveSlide(from, after ? i + 1 : i);
    });
    list.appendChild(t);
  });
  const de = $('#thumb-dropend');
  de.ondragover = e => { if (e.dataTransfer.types.includes('text/ppt-thumb')) e.preventDefault(); };
  de.ondrop = e => { const from = +e.dataTransfer.getData('text/ppt-thumb'); if (!isNaN(from)) moveSlide(from, state.slides.length); };
}
function thumbNode(slide, scale) {
  const d = el('div', { style: `width:${SW()}px;height:${SH()}px;transform:scale(${scale});transform-origin:0 0;position:absolute;left:0;top:0;background:#fff;pointer-events:none` });
  renderSlideInto(d, slide, { noSel: true });
  return d;
}
function selectSlide(i) {
  if (editing) endEdit(true);
  state.active = i;
  state.sel = { objs: [] };
  renderAll();
}
function moveSlide(from, to) {
  if (!(from >= 0 && from < state.slides.length)) return;
  to = clamp(to, 0, state.slides.length);
  if (from === to || from === to - 1) { afterSelChange(); return; }
  pushHistory('Move slide');
  const [s] = state.slides.splice(from, 1);
  let idx = clamp(to > from ? to - 1 : to, 0, state.slides.length);
  state.slides.splice(idx, 0, s);
  state.active = idx;
  afterSelChange();
}
function afterSelChange() {
  renderAll(); markDirty(); updateSB();
}

/* ---------- notes ---------- */
function syncNotes() {
  const n = $('#notes-editor');
  if (document.activeElement === n) return;
  const txt = cur().notes || '';
  n.textContent = txt;
  n.classList.toggle('empty', !txt);
  if (!txt) n.textContent = '';
}
function notesLabelUpdate() { $('#notes-label').textContent = cur().hidden ? 'Notes (hidden slide)' : 'Notes'; }

/* ---------- status bar ---------- */
function updateSB() {
  $('#sb-slide').textContent = `Slide ${state.active + 1} of ${state.slides.length}`;
  const cc = (state.comments[cur().id] || []).length;
  $('#sb-comments').textContent = 'Comments' + (cc ? ` (${cc})` : '');
  notesLabelUpdate();
}
let sbTimer = null;
function sbMsg(t) {
  $('#sb-msg').textContent = t;
  clearTimeout(sbTimer);
  sbTimer = setTimeout(() => { $('#sb-msg').textContent = ''; }, 5000);
}

/* ---------- master render ---------- */
function renderAll() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    layoutStage();
    renderMain();
    renderThumbs();
    if (state.view === 'sorter' && window.renderSorter) window.renderSorter();
    syncNotes();
    updateSB();
    if (window.updateSidePane) window.updateSidePane();
    if (window.updateRibbonState) window.updateRibbonState();
  });
}
function requestRender() { renderAll(); }

/* ============================ selection & manipulation ============================ */
function ptInObj(o, px, py) {
  return px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h;
}
function stagePoint(e) {
  const wrap = $('#slide-wrap').getBoundingClientRect();
  const z = Z();
  return { x: (e.clientX - wrap.left) / z, y: (e.clientY - wrap.top) / z, vx: e.clientX - wrap.left, vy: e.clientY - wrap.top };
}
function attachObjectEvents(host) {
  if (host.dataset.evBound) return; // listeners survive re-renders
  host.dataset.evBound = '1';
  host.addEventListener('mousedown', onStageMouseDown);
  host.addEventListener('dblclick', onStageDblClick);
  host.addEventListener('contextmenu', onStageCtx);
}
/* Selection-only refresh: keeps the slide DOM stable so native click/dblclick
   dispatch (which needs the same DOM node across both clicks) keeps working. */
function selOnlyRender() {
  renderOverlay();
  if (window.updateRibbonState) window.updateRibbonState();
  if (window.updateSidePane) window.updateSidePane();
}
function onStageMouseDown(e) {
  if (e.button !== 0) return;
  const hit = e.target.closest('.obj');
  const pt = stagePoint(e);
  if (editing && (!hit || hit.dataset.oid !== editing)) { endEdit(true); }
  if (editing && hit && hit.dataset.oid === editing) return; // let caret logic proceed
  if (hit) {
    const o = objById(hit.dataset.oid);
    if (!o) return;
    if (e.shiftKey) {
      const i = state.sel.objs.indexOf(o.id);
      if (i < 0) state.sel.objs.push(o.id); else state.sel.objs.splice(i, 1);
      e.preventDefault();
      selOnlyRender();
      return;
    }
    const wasSelected = state.sel.objs.includes(o.id) && state.sel.objs.length === 1;
    if (!state.sel.objs.includes(o.id)) state.sel.objs = [o.id];
    selOnlyRender();
    // double purpose: drag to move OR pic placeholder to insert
    startObjDrag(e, o, pt, wasSelected);
  } else {
    if (state.sel.objs.length) { state.sel.objs = []; selOnlyRender(); }
    // marquee selection
    startMarquee(e, pt);
  }
  $('#stage').focus();
}
function onStageDblClick(e) {
  const hit = e.target.closest('.obj');
  if (!hit) return;
  const o = objById(hit.dataset.oid);
  if (!o) return;
  if ((o.kind === 'picph' || (o.kind === 'pic' && !o.src))) { insertPictureDialog(o); return; }
  if (o.kind === 'table') {
    const td = e.target.closest && e.target.closest('td, th');
    if (td && P.editTableCell) P.editTableCell(o, td);
    return;
  }
  if (isTextish(o)) { startTextEdit(o.id); }
}
function onStageCtx(e) {
  e.preventDefault();
  const hit = e.target.closest('.obj');
  if (hit) {
    const o = objById(hit.dataset.oid);
    if (o && !state.sel.objs.includes(o.id)) { state.sel.objs = [o.id]; selOnlyRender(); }
    if (o && P.objCtxMenu) { P.objCtxMenu(e, o); return; }
  }
  if (P.slideAreaCtxMenu) P.slideAreaCtxMenu(e);
}

/* drag to move */
function startObjDrag(e, o, pt, wasSelected) {
  const z = Z();
  const so = selObjs();
  const start = so.map(x => ({ id: x.id, x: x.x, y: x.y }));
  const sx = pt.x, sy = pt.y;
  let moved = false;
  const mm = ev => {
    const dx = (ev.clientX - e.clientX) / z, dy = (ev.clientY - e.clientY) / z;
    if (!moved && Math.hypot(dx, dy) > 3) { moved = true; pushHistory('Move'); }
    if (!moved) return;
    for (const st of start) {
      const ob = objById(st.id);
      ob.x = clamp(st.x + dx, -ob.w + 24, SW() - 24);
      ob.y = clamp(st.y + dy, -ob.h + 24, SH() - 24);
    }
    renderMain();
  };
  const mu = () => {
    document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
    if (moved) markDirty(); else {
      // plain click: pic placeholder opens insert
      if (o.kind === 'picph' || (o.kind === 'pic' && !o.src)) { insertPictureDialog(o); return; }
      // click on an empty placeholder or second click on selected text → edit
      if (isTextish(o) && o.kind !== 'table' && ((o.ph && objTextEmpty(o)) || wasSelected)) {
        startTextEdit(o.id);
      }
    }
  };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
}

/* typing on a selected text object starts edit, replacing text (like PowerPoint) */
function startTypingOnSelection(e) {
  const o = firstSel();
  if (!o || !isTextish(o) || o.kind === 'table') return false;
  e.preventDefault();
  pushHistory('Text');
  o.paras = [newPara(e.key, { bullet: o.noBullet ? 'none' : (o.ph ? 'char' : 'none') })];
  startTextEdit(o.id); // caret lands at end, right after the typed char
  markDirty();
  return true;
}

/* handles (resize/rotate) */
function startHandleDrag(e) {
  e.preventDefault(); e.stopPropagation();
  const dir = e.currentTarget.dataset.h;
  const so = firstSel(); if (!so) return;
  const z = Z();
  const st = { x: so.x, y: so.y, w: so.w, h: so.h, rot: so.rot || 0 };
  const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
  pushHistory(dir === 'rot' ? 'Rotate' : 'Resize');
  const aspect = ev => ev.shiftKey || so.kind === 'pic' || so.kind === 'chart';
  const mm = ev => {
    const dx = (ev.clientX - e.clientX) / z, dy = (ev.clientY - e.clientY) / z;
    if (dir === 'rot') {
      const wrap = $('#slide-wrap').getBoundingClientRect();
      const pcx = wrap.left + (cx) * z, pcy = wrap.top + (cy) * z;
      const ang = Math.atan2(ev.clientY - pcy, ev.clientX - pcx) * 180 / Math.PI;
      so.rot = Math.round((ang + 90) / (ev.shiftKey ? 15 : 1)) * (ev.shiftKey ? 15 : 1);
    } else {
      let { x, y, w, h } = st;
      if (dir.includes('e')) w = st.w + dx;
      if (dir.includes('s')) h = st.h + dy;
      if (dir.includes('w')) { w = st.w - dx; x = st.x + dx; }
      if (dir.includes('n')) { h = st.h - dy; y = st.y + dy; }
      if (aspect(ev) && dir.length === 2) {
        const k = Math.max(w / st.w, h / st.h);
        w = st.w * k; h = st.h * k;
        if (dir.includes('w')) x = st.x + st.w - w;
        if (dir.includes('n')) y = st.y + st.h - h;
      }
      if (w >= 16) { so.w = w; if (dir.includes('w')) so.x = x; else so.x = st.x; }
      if (h >= 16) { so.h = h; if (dir.includes('n')) so.y = y; else so.y = st.y; }
    }
    renderMain();
  };
  const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); markDirty(); renderMain(); };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
}

/* marquee */
function startMarquee(e, pt0) {
  const ov = $('#obj-overlay');
  const z = Z();
  const rect = el('div', { style: 'position:absolute;border:1px dashed var(--accD);background:rgba(196,62,28,.06);z-index:50' });
  ov.appendChild(rect);
  const mm = ev => {
    const x1 = Math.min(pt0.x, pt0.x + (ev.clientX - e.clientX) / z), x2 = Math.max(pt0.x, pt0.x + (ev.clientX - e.clientX) / z);
    const y1 = Math.min(pt0.y, pt0.y + (ev.clientY - e.clientY) / z), y2 = Math.max(pt0.y, pt0.y + (ev.clientY - e.clientY) / z);
    rect.style.cssText = `position:absolute;border:1px dashed var(--accD);background:rgba(196,62,28,.06);z-index:50;left:${x1 * z}px;top:${y1 * z}px;width:${(x2 - x1) * z}px;height:${(y2 - y1) * z}px`;
    rect._rng = { x1, y1, x2, y2 };
  };
  const mu = () => {
    document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
    const rng = rect._rng;
    rect.remove();
    if (!rng || (rng.x2 - rng.x1 < 6 && rng.y2 - rng.y1 < 6)) { renderOverlay(); return; }
    state.sel.objs = cur().objects.filter(o => o.x < rng.x2 && o.x + o.w > rng.x1 && o.y < rng.y2 && o.y + o.h > rng.y1).map(o => o.id);
    selOnlyRender();
  };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
}

/* ============================ text editing ============================ */
function startTextEdit(objId, selectAll) {
  const o = objById(objId);
  if (!o || !isTextish(o) || o.kind === 'table') return;
  if (!state.sel.objs.includes(objId)) state.sel.objs = [objId];
  if (!o.paras) o.paras = [newPara('', { bullet: 'none' })];
  if (!document.querySelector('#slide #txt-' + objId)) renderMain(); // first edit of a paras-less shape: build the txt node
  editing = objId;
  renderMain(); // guarded (editing set): overlay only, slide DOM untouched
  const txtEl = document.querySelector('#slide #txt-' + objId);
  if (!txtEl) { editing = null; return; }
  // The DOM may be one model-change behind (e.g. a char was typed to start
  // this edit and renderMain skipped rebuilding). Re-sync content exactly.
  txtEl.innerHTML = o.paras.map((p, i) => paraHTML(o, p, i)).join('');
  txtEl.contentEditable = 'true';
  txtEl.spellcheck = true;
  txtEl.addEventListener('input', onEditInput);
  txtEl.addEventListener('keydown', onEditKey, true);
  txtEl.addEventListener('blur', onEditBlur);
  // Focus synchronously: with a deferred focus, fast typing loses keystrokes
  // that land before the timeout fires.
  txtEl.focus();
  if (selectAll) document.execCommand('selectAll');
  else {
    const r = document.createRange(); r.selectNodeContents(txtEl); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  sbMsg('Click outside the text to finish — F5 starts the show');
  renderOverlay(); // NOT renderMain: that would replace the node we just made editable
}
function endEdit(commit) {
  if (!editing) return;
  const txtEl = document.querySelector('#slide #txt-' + editing);
  const o = objById(editing);
  if (txtEl) {
    txtEl.contentEditable = 'false';
    if (o) syncModelFromDOM(txtEl, o);
  }
  editing = null;
  renderMain();
}
function onEditBlur() { if (editing) window._pptSavedSel = saveSelInEdit(); setTimeout(() => { if (editing && !document.activeElement.closest('#slide, .pop, .dlg, .ctxmenu, #ribbon, #tellme-wrap')) endEdit(true); }, 60); }
function onEditInput(e) {
  const txtEl = (e && e.currentTarget) || document.querySelector('#slide #txt-' + editing);
  const o = objById(editing);
  if (!txtEl || !o) return;
  syncModelFromDOM(txtEl, o);
  markDirty();
  renderThumbsDebounced();
  if (window.updateRibbonState) window.updateRibbonState();
}
/* selection stash: ribbon inputs steal focus; we restore caret before execCommand */
function saveSelInEdit() {
  const txtEl = document.querySelector('#slide #txt-' + editing);
  const sel = getSelection();
  if (!txtEl || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!txtEl.contains(r.startContainer)) return null;
  const pre = r.cloneRange(); pre.selectNodeContents(txtEl); pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  return { start, end: start + r.toString().length };
}
function restoreSelInEdit(st) {
  if (!st) return;
  const txtEl = document.querySelector('#slide #txt-' + editing);
  if (!txtEl) return;
  txtEl.focus();
  const tw = document.createTreeWalker(txtEl, NodeFilter.SHOW_TEXT);
  let n, pos = 0, sNode = null, sOff = 0, eNode = null, eOff = 0;
  while ((n = tw.nextNode())) {
    const len = n.nodeValue.length;
    if (sNode === null && st.start <= pos + len) { sNode = n; sOff = st.start - pos; }
    if (eNode === null && st.end <= pos + len) { eNode = n; eOff = st.end - pos; break; }
    pos += len;
  }
  if (!sNode) { const r = document.createRange(); r.selectNodeContents(txtEl); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
  if (!eNode) { eNode = sNode; eOff = sOff; }
  const r = document.createRange(); r.setStart(sNode, sOff); r.setEnd(eNode, eOff);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
let thumbTimer = null;
function renderThumbsDebounced() { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 400); }
function onEditKey(e) {
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); endEditWithUndo(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const o = objById(editing); if (!o) return;
    const p = caretPara();
    if (p != null) {
      pushHistory('Change indent');
      const para = o.paras[p.i];
      para.level = clamp((para.level || 0) + (e.shiftKey ? -1 : 1), 0, 4);
      if (!e.shiftKey && para.bullet === 'none') para.bullet = 'char';
      reRenderEditText(o, p);
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    pushHistory('Format text', true);
    document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]);
    onEditInput();
    return;
  }
}
function endEditWithUndo() {
  if (!editing) return;
  const o = objById(editing);
  if (o) {
    const txtEl = document.querySelector('#slide #txt-' + editing);
    syncModelFromDOM(txtEl, o);
    pushHistory('Edit text', true);
  }
  endEdit(true);
}
function caretPara() {
  const s = getSelection();
  if (!s.rangeCount) return null;
  let n = s.anchorNode;
  const container = document.querySelector('#slide #txt-' + editing);
  while (n && n !== container && n.nodeType === 3) n = n.parentElement;
  while (n && n.parentElement && n.parentElement !== container) n = n.parentElement;
  if (!n || n === container) return null;
  // contenteditable clones data-pi onto new paragraphs on Enter — compute index by child position
  const kids = Array.from(container.children);
  let i = kids.indexOf(n);
  if (i < 0 && n.dataset && n.dataset.pi != null) i = +n.dataset.pi;
  if (i < 0 || i >= (objById(editing) ? objById(editing).paras.length : 0)) i = Math.max(0, kids.length - 1);
  return { i, off: s.anchorOffset, node: n };
}
function reRenderEditText(o, keep) {
  const txtEl = document.querySelector('#slide #txt-' + o.id);
  txtEl.innerHTML = o.paras.map((p, i) => paraHTML(o, p, i)).join('');
  if (keep) {
    const node = txtEl.querySelector(`[data-pi="${keep.i}"]`);
    if (node) {
      const r = document.createRange();
      let target = node;
      while (target.firstChild && target.firstChild.nodeType !== 3) target = target.firstChild;
      const len = target.textContent.length;
      r.setStart(target.nodeType === 3 ? target : node, clamp(Math.min(keep.off, len), 0, target.nodeType === 3 ? len : 0));
      r.collapse(true);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  }
}
/* parse contenteditable DOM back to model */
function syncModelFromDOM(txtEl, o) {
  const paras = [];
  const blocks = [];
  for (const node of txtEl.childNodes) {
    if (node.nodeName === 'DIV' || node.nodeName === 'P') blocks.push(node);
    else if (node.nodeName === 'BR') { if (!blocks.length || blocks[blocks.length - 1] !== '') blocks.push(''); }
    else if (node.nodeType === 3) blocks.push(node);
  }
  if (!blocks.length) blocks.push('');
  for (const b of blocks) {
    const p = { runs: [], align: null, level: 0, bullet: o.noBullet ? 'none' : 'char', spaceAfter: null, line: null };
    if (b !== '') {
      const cs = b.style || {};
      const ta = cs.textAlign;
      if (ta && ta !== 'start') p.align = { left: 'l', center: 'c', right: 'r', justify: 'j' }[ta] || 'l';
      if (cs.marginLeft) p.level = clamp(Math.round(parseInt(cs.marginLeft) / 26), 0, 4);
      p.bullet = b.classList && b.classList.contains('bu-auto') ? 'num' : (o.noBullet ? 'none' : 'char');
      if (b.classList && !b.classList.contains('bu-char') && !b.classList.contains('bu-auto') && o.noBullet) p.bullet = 'none';
      if (cs.marginBottom != null && cs.marginBottom !== '') p.spaceAfter = parseFloat(cs.marginBottom) || null;
      if (cs.lineHeight && cs.lineHeight !== '1.02' && cs.lineHeight !== 'normal') p.line = parseFloat(cs.lineHeight) || null;
      // walk text nodes, inheriting formatting from ancestor elements
      const collectRun = tn => {
        const r = { t: tn.nodeValue };
        let node = tn.parentNode;
        let weight = null, fstyle = null, deco = '', color = null, hl = null, size = null, font = null;
        while (node && node !== txtEl && node.nodeType === 1) {
          const nm = node.nodeName, s = node.style || {};
          if (nm === 'B' || nm === 'STRONG') weight = 'b';
          if (nm === 'I' || nm === 'EM') fstyle = 'i';
          if (nm === 'U') deco += ' underline';
          if (nm === 'S' || nm === 'STRIKE') deco += ' line-through';
          if (nm === 'FONT') {
            if (node.getAttribute('color') && !color) color = node.getAttribute('color');
            if (node.getAttribute('face') && !font) font = node.getAttribute('face');
          }
          if (s.fontWeight) weight = (s.fontWeight === 'bold' || parseInt(s.fontWeight) >= 600) ? 'b' : '';
          if (s.fontStyle) fstyle = s.fontStyle === 'italic' ? 'i' : '';
          if (s.textDecorationLine || s.textDecoration) deco = s.textDecorationLine || s.textDecoration || deco;
          if (s.color && !color) color = s.color;
          if (s.backgroundColor && !hl && !/transparent|rgba\(0, ?0, ?0, ?0\)/.test(s.backgroundColor)) hl = s.backgroundColor;
          if (s.fontSize && !size) size = s.fontSize;
          if (s.fontFamily && !font) font = s.fontFamily;
          node = node.parentNode;
        }
        if (weight === 'b') r.b = true;
        if (fstyle === 'i') r.i = true;
        if (/underline/.test(deco)) r.u = true;
        if (/line-through/.test(deco)) r.strike = true;
        if (color) r.color = rgbToHex(color);
        if (hl) r.highlight = rgbToHex(hl);
        if (size) { const n = parseFloat(size); const pt = /pt\s*$/.test(size) ? n : pxToPt(n); if (pt) r.size = Math.round(pt * 2) / 2; }
        if (font) r.font = font.split(',')[0].replace(/["']/g, '');
        return r;
      };
      const walk = bEl => {
        if (!bEl) { p.runs.push({ t: '' }); return; }
        const tw = document.createTreeWalker(bEl, NodeFilter.SHOW_TEXT);
        let tn; let any = false;
        while ((tn = tw.nextNode())) { p.runs.push(collectRun(tn)); any = true; }
        if (!any) p.runs.push({ t: '' });
      };
      walk(b);
      // flatten runs: merge \n into text, drop empties
      const flat = [];
      for (const r of p.runs) {
        if (r.t === '') continue;
        const last = flat[flat.length - 1];
        if (last && last.b === !!r.b && last.i === !!r.i && last.u === !!r.u && last.color === r.color && last.size === r.size && last.font === r.font && last.strike === !!r.strike && last.hl === r.hl) last.t += r.t;
        else flat.push({ ...r, b: !!r.b, i: !!r.i, u: !!r.u, strike: !!r.strike });
      }
      p.runs = flat;
    }
    if (!p.runs.length) p.runs = [{ t: '' }];
    paras.push(p);
  }
  // the current paragraph being typed keeps its own align/level/bullet from DOM;
  // preserve previous values for props not encoded in DOM
  o.paras = paras.map((np, i) => {
    const old = o.paras[i];
    if (old) {
      if (np.align == null && old.align) np.align = null; // DOM wins (default left) only when old not in DOM; keep old.align
      if (old.align) np.align = np.align || old.align;
      if (old.level && !np.level) np.level = old.level;
      if (old.bullet !== 'char') np.bullet = np.bullet === 'char' ? (o.noBullet ? 'none' : old.bullet) : np.bullet;
      if (old.line && np.line == null) np.line = old.line;
      if (old.spaceAfter != null && np.spaceAfter == null) np.spaceAfter = old.spaceAfter;
    }
    return np;
  });
}
function pxToPt(px) { return px * 0.75; }
function rgbToHex(c) {
  if (!c) return null;
  if (c.startsWith('#')) return c.length === 4 ? '#' + c.slice(1).split('').map(x => x + x).join('') : c;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  const h = n => (+n).toString(16).padStart(2, '0');
  return '#' + h(m[1]) + h(m[2]) + h(m[3]);
}

/* apply run formatting to current selection while editing (ribbon commands) */
function applyRunCmd(kind, val) {
  if (!editing) return false;
  const txtEl0 = document.querySelector('#slide #txt-' + editing);
  if (txtEl0 && !txtEl0.contains(document.activeElement) && window._pptSavedSel) restoreSelInEdit(window._pptSavedSel);
  pushHistory('Format text', true);
  if (kind === 'b') document.execCommand('bold');
  else if (kind === 'i') document.execCommand('italic');
  else if (kind === 'u') document.execCommand('underline');
  else if (kind === 'strike') document.execCommand('strikeThrough');
  else if (kind === 'color') document.execCommand('foreColor', false, val);
  else if (kind === 'hl') document.execCommand(val ? 'hiliteColor' : 'removeFormat', false, val || '');
  else if (kind === 'size') document.execCommand('fontSize', false, 7);
  else if (kind === 'font') document.execCommand('fontName', false, val);
  onEditInput();
  if (kind === 'size') {
    // execCommand size 7 marks spans with size=7 then we normalize to real pt
    const txtEl = document.querySelector('#slide #txt-' + editing);
    $$('font[size="7"]', txtEl).forEach(f => { f.removeAttribute('size'); f.style.fontSize = val + 'pt'; });
    onEditInput();
  }
  return true;
}
function applyParaCmd(kind, val) {
  if (!editing) return false;
  const o = objById(editing); if (!o) return false;
  const p = caretPara();
  pushHistory('Paragraph');
  if (p) {
    const para = o.paras[p.i];
    if (kind === 'align') para.align = val;
    else if (kind === 'bullet') para.bullet = val;
    else if (kind === 'level+') { para.level = clamp((para.level || 0) + 1, 0, 4); }
    else if (kind === 'level-') { para.level = clamp((para.level || 0) - 1, 0, 4); }
    else if (kind === 'line') para.line = val === 1 ? null : val;
    else if (kind === 'spaceAfter') para.spaceAfter = val;
    reRenderEditText(o, p);
  }
  return true;
}
/* apply to whole selected objects when NOT editing */
function applyObjTextStyle(patch, para) {
  const so = selObjs().filter(isTextish);
  if (!so.length) return false;
  pushHistory('Format');
  for (const o of so) {
    if (!o.paras) continue;
    o.paras.forEach(p => {
      if (para) {
        if (patch.align !== undefined) p.align = patch.align;
        if (patch.bullet !== undefined) p.bullet = patch.bullet;
        if (patch.level !== undefined) p.level = patch.level;
      } else {
        p.runs.forEach(r => Object.assign(r, patch));
      }
    });
  }
  renderMain(); markDirty();
  return true;
}

/* ============================ object ops ============================ */
function addObject(o, select) {
  pushHistory('Insert');
  o.id = o.id || uid();
  o.z = Math.max(0, ...cur().objects.map(x => x.z || 0)) + 1;
  cur().objects.push(o);
  if (select !== false) state.sel = { objs: [o.id] };
  renderAll(); markDirty();
  return o;
}
function deleteSelected() {
  if (!state.sel.objs.length) return;
  pushHistory('Delete');
  cur().objects = cur().objects.filter(o => !state.sel.objs.includes(o.id));
  cur().anims = cur().anims.filter(a => state.sel.objs.indexOf(a.obj) < 0);
  state.sel.objs = [];
  renderAll(); markDirty(); sbMsg('Deleted');
}
function dupSelected() {
  const so = selObjs();
  if (!so.length) return;
  pushHistory('Duplicate');
  const newIds = [];
  for (const o of so) {
    const c = JSON.parse(JSON.stringify(o));
    c.id = uid(); c.x += 24; c.y += 24; c.z = Math.max(0, ...cur().objects.map(x => x.z || 0)) + 1;
    cur().objects.push(c); newIds.push(c.id);
  }
  state.sel.objs = newIds;
  renderAll(); markDirty();
}
function copySelected(cut) {
  const so = selObjs();
  if (!so.length) return;
  clipObjs = so.map(o => JSON.parse(JSON.stringify(o)));
  if (cut) deleteSelected();
  else sbMsg(so.length + ' object' + (so.length > 1 ? 's' : '') + ' copied');
}
function pasteClipboard() {
  if (!clipObjs.length) { sbMsg('Nothing to paste'); return; }
  pushHistory('Paste');
  const ids = [];
  for (const co of clipObjs) {
    const o = JSON.parse(JSON.stringify(co));
    o.id = uid(); o.x += 20; o.y += 20;
    o.z = Math.max(0, ...cur().objects.map(x => x.z || 0)) + 1;
    cur().objects.push(o); ids.push(o.id);
  }
  state.sel.objs = ids;
  renderAll(); markDirty();
}
function orderObjects(mode) {
  const so = selObjs(); if (!so.length) return;
  pushHistory('Arrange');
  const zs = cur().objects.map(o => o.z || 0);
  const maxZ = Math.max(...zs), minZ = Math.min(...zs);
  for (const o of so) {
    if (mode === 'front') o.z = maxZ + 1;
    else if (mode === 'back') o.z = minZ - 1;
    else if (mode === 'fwd') o.z = Math.min(maxZ + 1, o.z + 1.5);
    else o.z = Math.max(minZ - 1, o.z - 1.5);
  }
  // normalize
  const sorted = [...cur().objects].sort((a, b) => (a.z || 0) - (b.z || 0));
  sorted.forEach((o, i) => o.z = i);
  renderAll(); markDirty();
}
function alignObjects(mode) {
  const so = selObjs(); if (so.length < 2 && mode !== 'cm' && mode !== 'mm') return;
  pushHistory('Align');
  const box = mode === 'cm' || mode === 'mm' ? { x1: 0, y1: 0, x2: SW(), y2: SH() } : {
    x1: Math.min(...so.map(o => o.x)), y1: Math.min(...so.map(o => o.y)),
    x2: Math.max(...so.map(o => o.x + o.w)), y2: Math.max(...so.map(o => o.y + o.h)),
  };
  for (const o of so) {
    if (mode === 'l') o.x = box.x1;
    else if (mode === 'c' || mode === 'cm') o.x = (box.x1 + box.x2) / 2 - o.w / 2;
    else if (mode === 'r') o.x = box.x2 - o.w;
    else if (mode === 't') o.y = box.y1;
    else if (mode === 'm' || mode === 'mm') o.y = (box.y1 + box.y2) / 2 - o.h / 2;
    else if (mode === 'b') o.y = box.y2 - o.h;
  }
  markDirty(); renderMain();
}
function groupSelected() {
  const so = selObjs();
  if (so.length < 2) return;
  pushHistory('Group');
  const x1 = Math.min(...so.map(o => o.x)), y1 = Math.min(...so.map(o => o.y));
  const x2 = Math.max(...so.map(o => o.x + o.w)), y2 = Math.max(...so.map(o => o.y + o.h));
  // simple grouping: mark parentId; selection moves all together (lightweight)
  const gid = uid();
  so.forEach(o => o.grp = gid);
  renderAll(); sbMsg('Grouped — move together');
}
function ungroupSelected() {
  pushHistory('Ungroup');
  selObjs().forEach(o => delete o.grp);
  renderAll(); sbMsg('Ungrouped');
}

/* ============================ slide ops ============================ */
function addSlide(layout, atEnd) {
  pushHistory('Insert slide');
  const s = newSlide(layout || 'titleContent');
  const i = atEnd ? state.slides.length : state.active + 1;
  state.slides.splice(i, 0, s);
  state.active = i;
  state.sel = { objs: [] };
  renderAll(); markDirty(); sbMsg('Inserted new slide — layout: ' + layoutOf(s).nm);
  return s;
}
function dupSlide(i) {
  i = i == null ? state.active : i;
  pushHistory('Duplicate slide');
  const c = JSON.parse(JSON.stringify(state.slides[i]));
  c.id = uid();
  c.objects.forEach(o => o.id = uid());
  (c.anims || []).forEach(a => { a.id = uid(); });
  state.slides.splice(i + 1, 0, c);
  state.active = i + 1;
  renderAll(); markDirty();
}
function deleteSlide(i) {
  i = i == null ? state.active : i;
  if (state.slides.length <= 1) { sbMsg('A presentation must contain at least one slide.'); return; }
  pushHistory('Delete slide');
  state.slides.splice(i, 1);
  state.active = clamp(i, 0, state.slides.length - 1);
  state.sel = { objs: [] };
  renderAll(); markDirty();
}
function setLayout(layId) {
  pushHistory('Change layout');
  const lay = LAYOUTS[layId];
  const s = cur();
  s.layout = layId;
  // drop untouched placeholders, then re-map slots using only pre-existing objects
  s.objects = s.objects.filter(o => !(o.ph && objTextEmpty(o)));
  const pool = s.objects.slice();
  const used = new Set();
  let z = Math.max(0, ...s.objects.map(x => x.z || 0));
  (lay.ph || []).forEach(def => {
    const isTitle = def.ph === 'title';
    let match = isTitle
      ? pool.find(o => o.ph === 'title' && !used.has(o.id))
      : pool.find(o => o.ph && o.ph.startsWith('body') && !used.has(o.id));
    if (match) {
      used.add(match.id);
      Object.assign(match, { x: def.x, y: def.y, w: def.w, h: def.h, fs: def.fs, al: def.al, anchor: def.anchor || 't', noBullet: !!def.noBullet, cap: !!def.cap, prompt: def.prompt });
    } else if (def.ph !== 'pic') {
      const no = newPhObject(def);
      no.z = ++z;
      s.objects.push(no);
    }
  });
  renderAll(); markDirty();
  sbMsg('Layout: ' + lay.nm);
}
function toggleHideSlide(i) {
  i = i == null ? state.active : i;
  pushHistory('Hide slide');
  state.slides[i].hidden = !state.slides[i].hidden;
  renderAll(); markDirty();
  sbMsg(state.slides[i].hidden ? 'Slide hidden in the slide show' : 'Slide shown');
}

/* ============================ ui primitives ============================ */
function closeAllPops() { $$('.pop').forEach(p => p.remove()); HV = null; }
let HV = null;
function pop(anchor, node, opts) {
  opts = opts || {};
  closeAllPops();
  const p = el('div', { class: 'pop' + (opts.cls ? ' ' + opts.cls : ''), style: opts.style || '' });
  p.appendChild(node);
  $('#pop-root').appendChild(p);
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  let x = r.left, y = r.bottom + 2;
  if (opts.at === 'right') { x = r.right + 4; y = r.top; }
  p.style.left = '0px'; p.style.top = '-9999px';
  requestAnimationFrame(() => {
    const pw = p.offsetWidth, ph = p.offsetHeight;
    x = clamp(x, 4, window.innerWidth - pw - 6);
    if (y + ph > window.innerHeight - 30 && r.top - ph - 2 > 6) y = r.top - ph - 2;
    y = clamp(y, 4, Math.max(4, window.innerHeight - ph - 6));
    p.style.left = x + 'px'; p.style.top = y + 'px';
  });
  if (anchor && anchor.classList) setTimeout(() => document.addEventListener('mousedown', off), 0);
  function off(e) { if (!p.contains(e.target) && e.target !== anchor) { p.remove(); document.removeEventListener('mousedown', off); } }
  return p;
}
/* dlg */
function dlg(opts) {
  closeAllPops();
  $$('.dlg, .dlg-back').forEach(x => x.remove());
  const root = $('#dlg-root');
  root.classList.add('on');
  const back = el('div', { class: 'dlg-back' });
  const d = el('div', { class: 'dlg', style: opts.width ? `width:${opts.width}px` : '' });
  d.appendChild(el('div', { class: 'dlg-h' }, esc(opts.title || ''), (() => { const x = el('span', { class: 'x', html: svgIcon('close') }); x.addEventListener('click', close); return x; })()));
  let body;
  if (opts.tabs) {
    const th = el('div', { class: 'dlg-tabs' });
    const pgs = [];
    const start = clamp(opts.startTab || 0, 0, opts.tabs.length - 1);
    opts.tabs.forEach((t, i) => {
      const tb = el('button', { class: 'dlg-tab' + (i === start ? ' on' : '') }, esc(t.label));
      tb.addEventListener('click', () => { $$('.dlg-tab', th).forEach((x, j) => x.classList.toggle('on', j === i)); pgs.forEach((p, j) => p.style.display = j === i ? 'block' : 'none'); });
      th.appendChild(tb);
      const pg = el('div', { style: i === start ? '' : 'display:none' });
      pg.appendChild(t.body); pgs.push(pg);
    });
    d.appendChild(th);
    body = el('div', { class: 'dlg-body' });
    pgs.forEach(p => body.appendChild(p));
  } else {
    body = el('div', { class: 'dlg-body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
  }
  d.appendChild(body);
  const f = el('div', { class: 'dlg-f' });
  (opts.buttons || [{ label: 'Cancel' }]).forEach(bd => {
    const b = el('button', { class: 'btn' + (bd.pri ? ' pri' : '') }, esc(bd.label));
    b.addEventListener('click', () => {
      if (bd.fn) { const r = bd.fn(); if (r === false) return; }
      close();
    });
    f.appendChild(b);
  });
  if (opts.buttons !== null) d.appendChild(f);
  back.addEventListener('mousedown', () => { if (!opts.modal) close(); });
  root.appendChild(back); root.appendChild(d);
  function close() { root.classList.remove('on'); d.remove(); back.remove(); }
  P._closeDlg = close;
  return d;
}
function msgBox(title, text, opts) {
  opts = opts || {};
  return new Promise(res => {
    const btns = (opts.buttons || ['OK']).map(l => ({ label: l, pri: l === (opts.buttons ? opts.buttons[0] : 'OK'), fn: () => { res(l); } }));
    const body = el('div', { style: 'max-width:380px;line-height:1.55' }, esc(text));
    dlg({ title: title || 'Microsoft PowerPoint', body, buttons: btns, width: 420 });
  });
}
/* input box */
function inputBox(title, label, def, opts) {
  return new Promise(res => {
    const inp = el('input', { type: 'text', value: def || '', style: 'width:100%;height:25px;border:1px solid #BFBFBF;padding:0 6px;font-size:12px' });
    dlg({
      title, body: el('div', null, el('div', { style: 'margin-bottom:8px;color:#444' }, esc(label)), inp),
      width: (opts && opts.width) || 400,
      buttons: [{ label: 'OK', pri: true, fn: () => { res(inp.value); } }, { label: 'Cancel', fn: () => res(null) }],
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
  });
}
/* context menu */
function ctxMenu(e, items) {
  closeCtxMenu();
  const root = $('#ctx-root');
  root.classList.add('on');
  root.innerHTML = '';
  const m = el('div', { class: 'ctxmenu' });
  const KO = { New: 'plus', Delete: 'del', Duplicate: 'copy' };
  for (const it of items) {
    if (it === '-') { m.appendChild(el('div', { class: 'mi-sep' })); continue; }
    const mi = el('div', { class: 'mi' + (it.disabled ? ' disabled' : '') });
    if (it.icon) mi.innerHTML = svgIcon(it.icon);
    mi.appendChild(el('span', null, esc(it.label)));
    if (!it.disabled) mi.addEventListener('click', () => { closeCtxMenu(); it.action && it.action(); });
    m.appendChild(mi);
  }
  root.appendChild(m);
  m.style.left = clamp(e.clientX, 4, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = clamp(e.clientY, 4, innerHeight - m.offsetHeight - 8) + 'px';
  root.onclick = ev => { if (ev.target === root) closeCtxMenu(); };
}
function closeCtxMenu() { const r = $('#ctx-root'); r.classList.remove('on'); r.innerHTML = ''; }

/* color palette */
function palettePopup(anchor, opts) {
  opts = opts || {};
  const t = TH();
  const node = el('div', { class: 'pal' });
  if (opts.auto !== false) {
    const row = el('div', { class: 'pal-auto' });
    const sw = el('span', { class: 'pal-sw', style: 'background:' + (opts.autoColor || '#000000') });
    sw.dataset.col = opts.autoColor || '#000000';
    row.appendChild(sw); row.appendChild(el('span', null, opts.autoLabel || 'Automatic'));
    row.addEventListener('click', () => { opts.onPick && opts.onPick(opts.autoColor || null); closeAllPops(); });
    node.appendChild(row);
  }
  if (opts.noneLabel) {
    const b = el('button', { class: 'btn', style: 'width:100%;height:23px;margin-bottom:5px' }, esc(opts.noneLabel));
    b.addEventListener('click', () => { opts.onPick && opts.onPick('__none__'); closeAllPops(); });
    node.appendChild(b);
  }
  node.appendChild(el('div', { class: 'pl-h' }, 'Theme Colors'));
  const themeRow = el('div', { class: 'pal-grid' });
  const tcols = [['dk1', 'Text 1'], ['lt1', 'Background 1'], ['dk2', 'Text 2'], ['lt2', 'Background 2'], ['a1', 'Accent 1'], ['a2', 'Accent 2'], ['a3', 'Accent 3'], ['a4', 'Accent 4'], ['a5', 'Accent 5'], ['a6', 'Accent 6']];
  tcols.forEach(([k, nm]) => {
    const sw = el('span', { class: 'pal-sw', title: nm, style: `background:${t[k]};${k === 'lt1' ? 'box-shadow:inset 0 0 0 1px #bbb' : ''}` });
    sw.addEventListener('click', () => { opts.onPick && opts.onPick(k); closeAllPops(); });
    themeRow.appendChild(sw);
  });
  node.appendChild(themeRow);
  node.appendChild(el('div', { class: 'pl-h' }, 'Standard Colors'));
  const stdRow = el('div', { class: 'pal-grid' });
  ['#C00000', '#ED7D31', '#FFC000', '#70AD47', '#4472C4', '#7030A0', '#FF0000', '#FF6600', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#FF66CC', '#996633', '#808080', '#BFBFBF', '#FFFFFF', '#000000'].forEach(c => {
    const sw = el('span', { class: 'pal-sw', title: c, style: `background:${c};${c === '#FFFFFF' ? 'box-shadow:inset 0 0 0 1px #bbb' : ''}` });
    sw.addEventListener('click', () => { opts.onPick && opts.onPick(c); closeAllPops(); });
    stdRow.appendChild(sw);
  });
  node.appendChild(stdRow);
  if (opts.onCustom) {
    const more = el('div', { class: 'pal-more' });
    const b = el('button', { class: 'btn', style: 'width:100%;height:23px' }, 'Custom Color...');
    b.addEventListener('click', () => { closeAllPops(); opts.onCustom(); });
    more.appendChild(b);
    node.appendChild(more);
  }
  pop(anchor, node);
}
function customColorDialog(onPick) {
  const inp = el('input', { type: 'color', value: '#4472C4', style: 'width:100%;height:34px;border:1px solid #bbb' });
  dlg({
    title: 'Custom color', body: inp, width: 300,
    buttons: [{ label: 'OK', pri: true, fn: () => onPick(inp.value) }, { label: 'Cancel' }],
  });
}

/* ============================ keyboard ============================ */
function onStageKey(e) {
  if (editing) return; // editor handles its own keys
  const meta = e.ctrlKey || e.metaKey;
  const so = selObjs();
  if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); return; }
  if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
  if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); saveDoc(false); return; }
  if (meta && e.key.toLowerCase() === 'a') { e.preventDefault(); state.sel.objs = cur().objects.map(o => o.id); selOnlyRender(); return; }
  if (meta && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelected(false); return; }
  if (meta && e.key.toLowerCase() === 'x') { e.preventDefault(); copySelected(true); return; }
  if (meta && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard(); return; }
  if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); dupSelected(); return; }
  if (meta && e.key.toLowerCase() === 'm') { e.preventDefault(); addSlide(); return; }
  if (meta && e.key.toLowerCase() === 'f') { if (P.runCmdId && P.runCmdId('find')) { e.preventDefault(); return; } }
  if (meta && e.key.toLowerCase() === 'h') { if (P.runCmdId && P.runCmdId('replace')) { e.preventDefault(); return; } }
  if (e.key === 'F5') { e.preventDefault(); startSlideShow(e.shiftKey ? state.active : 0); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  if (!meta && !e.altKey && e.key.length === 1) { if (startTypingOnSelection(e)) return; }
  if (e.key === 'F2' || (e.key === 'Enter' && !meta)) {
    const o = firstSel();
    if (o && isTextish(o) && o.kind !== 'table') { e.preventDefault(); startTextEdit(o.id); return; }
    if (e.key === 'Enter' && !so.length) { addSlide(); return; }
  }
  if (e.key === 'Escape') { state.sel.objs = []; selOnlyRender(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const objs = cur().objects;
    if (!objs.length) return;
    let i = objs.findIndex(o => state.sel.objs.includes(o.id));
    i = (i + (e.shiftKey ? -1 : 1) + objs.length) % objs.length;
    state.sel.objs = [objs[i].id];
    selOnlyRender();
    return;
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && so.length) {
    e.preventDefault();
    const steps = e.shiftKey ? 10 : 1;
    const dx = { ArrowLeft: -steps, ArrowRight: steps, ArrowUp: 0, ArrowDown: 0 }[e.key];
    const dy = { ArrowUp: -steps, ArrowDown: steps, ArrowLeft: 0, ArrowRight: 0 }[e.key];
    pushHistory('Nudge', true);
    so.forEach(o => { o.x += dx; o.y += dy; });
    renderMain(); markDirty();
    return;
  }
  if (meta && ['b', 'i', 'u'].includes(e.key.toLowerCase()) && so.length) {
    e.preventDefault();
    const k = e.key.toLowerCase();
    const cur2 = so[0].paras && so[0].paras[0] && so[0].paras[0].runs[0] && so[0].paras[0].runs[0][k];
    applyObjTextStyle({ [k]: !cur2 });
    return;
  }
}

/* ============================ save/load ============================ */
function presJSON() {
  return { v: 1, presName: state.presName, theme: state.theme, variant: state.variant, slides: state.slides, active: state.active, notesOpen: state.notesOpen, comments: state.comments, hf: state.hf || null, showSetup: state.showSetup || null, sizeW: state.sizeW || null, sizeH: state.sizeH || null, savedAt: Date.now() };
}
function loadJSON(j) {
  state = { ...freshPres(), ...j, sel: { objs: [] }, zoom: 'fit', view: 'normal', dirty: false };
  if (!Array.isArray(state.slides) || !state.slides.length) state.slides = [newSlide('title')];
  state.slides.forEach(s => {
    if (!LAYOUTS[s.layout]) s.layout = 'titleContent';
    if (!Array.isArray(s.objects)) s.objects = [];
    if (!s.id) s.id = uid();
  });
  state.active = clamp(j.active || 0, 0, state.slides.length - 1);
  applyThemeCSS();
}
function saveDoc(silent) {
  const lib = JSON.parse(XKV.get('pc.docs') || '{}');
  const json = presJSON();
  lib[state.presName] = { json: JSON.stringify(json), modified: Date.now(), size: JSON.stringify(json).length };
  XKV.set('pc.docs', JSON.stringify(lib));
  XKV.set('pc.session', JSON.stringify({ name: state.presName, at: Date.now(), json: JSON.stringify(json) }));
  state.dirty = false;
  if (!silent) sbMsg(`Saved '${state.presName}' to this PC`);
}
function setPresName(name, silent) {
  name = String(name || '').trim();
  if (!name) return;
  const old = state.presName;
  state.presName = name.replace(/\.pptx?$/i, '');
  document.title = state.presName + ' - PowerPoint';
  $('#doc-name').textContent = state.presName;
  const lib = JSON.parse(XKV.get('pc.docs') || '{}');
  if (old !== state.presName && lib[old] != null) { lib[state.presName] = lib[old]; delete lib[old]; XKV.set('pc.docs', JSON.stringify(lib)); }
  if (!silent) markDirty();
  updateSB();
}

/* theme css vars */
function applyThemeCSS() {
  // accent app chrome stays PowerPoint red; slide theme affects slides only
  document.documentElement.style.setProperty('--theme-a1', TH().a1);
}

/* init keyboard global */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#ctx-root.on')) { closeCtxMenu(); return; }
    const inDlg = e.target.closest('.dlg, .pop, .ctxmenu, #sidepane, #notes-editor, input, select, .bs-root');
    // App-level commands (like Ctrl+M = new slide) work even from the notes pane, like real PowerPoint.
    const appCmd = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && ['m', 'M'].includes(e.key) && (e.target.closest('#notes-editor') || e.target.id === 'notes-editor');
    if (inDlg && e.key !== 'F5' && !appCmd) return;
    onStageKey(e);
  });
  window.addEventListener('resize', () => { if (state.zoom === 'fit') { layoutStage(); renderAll(); } });
}

/* toast */
function toast(msg) {
  $$('.toast').forEach(t => t.remove());
  const t = el('div', { class: 'toast' }, esc(msg));
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ---------------- exports (partial; extended by app2/3/4) ---------------- */
window.P = {
  $, $$, el, esc, clamp, uid, SLW, SLH, SW, SH, EMU_PX, FONTS, THEMES, VARIANTS, LAYOUTS, LAYOUT_ORDER, SHAPE_DEFS,
  get state() { return state; }, set state(v) { state = v; },
  freshPres, newSlide, newPara, newRun, plainObj, newPhObject, newTableObject,
  cur, objById, selObjs, firstSel, isTextish, objTextEmpty, layoutOf, TH: () => TH(), themeColor, resolveFill,
  Z, fitZoom, setZoom, layoutStage,
  pushHistory, doUndo, doRedo, markDirty, saveDoc, setPresName, presJSON, loadJSON,
  renderAll, renderMain, renderThumbs, renderOverlay, requestRender, afterSelChange, selectSlide, moveSlide, thumbNode,
  startTextEdit, endEdit, onEditInput, syncModelFromDOM, applyRunCmd, applyParaCmd, applyObjTextStyle, caretPara, reRenderEditText, rgbToHex, pxToPt, saveSelInEdit, restoreSelInEdit,
  addObject, deleteSelected, dupSelected, copySelected, pasteClipboard, orderObjects, alignObjects, groupSelected, ungroupSelected,
  addSlide, dupSlide, deleteSlide, setLayout, toggleHideSlide,
  pop, dlg, msgBox, inputBox, ctxMenu, closeCtxMenu, closeAllPops, palettePopup, customColorDialog, sbMsg, toast, updateSB,
  stagePoint, startObjDrag, objectHTML, renderSlideInto, tableHTML, tableStyle,
  get editing() { return editing; }, set editing(v) { editing = v; },
  get clipObjs() { return clipObjs; }, set clipObjs(v) { clipObjs = v; },
  initKeyboard, updateUndoButtons, applyThemeCSS, syncNotes,
};
