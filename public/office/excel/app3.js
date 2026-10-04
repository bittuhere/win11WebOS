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
   app3.js — floating objects (charts / shapes / pictures / text boxes),
   notes UI, filter dropdown buttons, outline groups
   ========================================================================== */
(function () {
'use strict';
const Calc = window.Calc;
const X = window.X;
const $ = (s, e) => (e || document).querySelector(s);
const $$ = (s, e) => Array.from((e || document).querySelectorAll(s));
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
const state = X.state;
const sheet = X.sheet;
const keyOf = X.keyOf, rcOf = X.rcOf, a1 = X.a1;
const svgIcon = window.svgIcon;
X.toast = X.toast || function (msg) {
  const t = el('div', { class: 'toast' }, esc(msg));
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2100);
};

/* ==========================================================================
   1. FLOATING OBJECTS
   obj = { id, kind:'chart'|'rect'|'oval'|'arrow'|'line'|'textbox'|'picture',
           a:{r,c,ox,oy}, b:{r,c,ox,oy},          // anchors (offsets in px @100%)
           chart:{type,title,range:{r1,c1,r2,c2}|null,byRow,legend},
           shape:{fill,line,text}, pic:{src,name}, text } 
   ========================================================================== */
let objSeq = 1;
const objEls = new Map();   // id -> dom el
function objList() { return sheet().charts; }
function objById(id) { return objList().find(o => o.id === id); }
X.objSelected = null;       // id or null

function cellAnchorAt(absX, absY) {
  // content-absolute px -> nearest cell anchor + offsets (zoom aware)
  const z = X.state.zoom;
  const c = clamp(X.colAtX(absX / z), 0, Calc.MAXC);
  const r = clamp(X.rowAtY(absY / z), 0, Calc.MAXR - 1);
  return { r, c, ox: Math.round(absX / z - X.colX(c)), oy: Math.round(absY / z - X.rowY(r)) };
}
function anchorAbsXY(a) { return { x: (X.colX(a.c) + a.ox), y: (X.rowY(a.r) + a.oy) }; }

function objGeomVp(o, v, fz) {
  const z = X.state.zoom;
  const A = anchorAbsXY(o.a), B = anchorAbsXY(o.b);
  // viewport conversion per anchor cell (frozen aware)
  const vx = c => c < fz.c ? X.HDRW + X.colX(c) * z : null;
  let x1, y1, x2, y2;
  if (o.a.c < fz.c) x1 = X.HDRW + A.x * z;
  else x1 = X.cellVpX(o.a.c, v, fz) + o.a.ox * z;
  if (o.b.c < fz.c) x2 = X.HDRW + B.x * z;
  else x2 = X.cellVpX(o.b.c, v, fz) + o.b.ox * z;
  if (o.a.r < fz.r) y1 = X.HDRH + A.y * z;
  else y1 = X.cellVpY(o.a.r, v, fz) + o.a.oy * z;
  if (o.b.r < fz.r) y2 = X.HDRH + B.y * z;
  else y2 = X.cellVpY(o.b.r, v, fz) + o.b.oy * z;
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(24, Math.abs(x2 - x1)), h: Math.max(20, Math.abs(y2 - y1)) };
}

function placeNewObject(o) {
  // drop at middle of the current viewport over ~8 cols x 12 rows
  const v = { sl: $('#grid-scroll').scrollLeft, st: $('#grid-scroll').scrollTop, w: $('#grid-scroll').clientWidth, h: $('#grid-scroll').clientHeight };
  const fz = { r: sheet().freeze.r, c: sheet().freeze.c, w: 0, h: 0 };
  const s = X.state.sel;
  const startX = X.cellVpX(s.a.c, v, fz), startY = X.cellVpY(s.a.r, v, fz);
  const absX = (startX - X.HDRW + 30) / X.state.zoom + (fz.c ? X.colX(fz.c) : 0) + Math.max(0, v.sl) / X.state.zoom * 0 + cellScrollAbsX(v);
  return true;
}
function cellScrollAbsX(v) {
  const z = X.state.zoom, fz = sheet().freeze;
  return Math.max(0, v.sl - X.colX(fz.c) * z) / z + X.colX(fz.c);
}
function cellScrollAbsY(v) {
  const z = X.state.zoom, fz = sheet().freeze;
  return Math.max(0, v.st - X.rowY(fz.r) * z) / z + X.rowY(fz.r);
}

function defaultAnchor(wPx, hPx) {
  const v = { sl: $('#grid-scroll').scrollLeft, st: $('#grid-scroll').scrollTop, w: $('#grid-scroll').clientWidth, h: $('#grid-scroll').clientHeight };
  const z = X.state.zoom;
  /* Excel drops new objects at the CENTER of the visible grid — not over your data in the corner */
  const ax = cellScrollAbsX(v) + Math.max(6, (v.w / z - wPx) / 2);
  const ay = cellScrollAbsY(v) + Math.max(6, (v.h / z - hPx) / 2);
  const a = cellAnchorAt((ax) * z, (ay) * z);
  const b = cellAnchorAt((ax + wPx) * z, (ay + hPx) * z);
  return { a, b };
}

function addObject(o) {
  o.id = 'obj' + (objSeq++) + '_' + Date.now().toString(36);
  X.pushUndo(o.kind === 'chart' ? 'Insert Chart' : 'Insert Object');
  sheet().charts.push(o);
  X.objSelected = o.id;
  X.markDirty();
  X.renderAll();
  return o;
}

/* ---------------- insert entry points ---------------- */
/* shared with the ribbon chart gallery live preview */
function detectChartRange() {
  const sel = X.normSel();
  if ((sel.r2 - sel.r1 + 1) * (sel.c2 - sel.c1 + 1) > 1) return { ...sel };
  const rg = X.regionUsed();
  if (rg && (rg.r2 > rg.r1 || rg.c2 > rg.c1)) return rg;
  return null;
}
X.detectChartRange = detectChartRange;

X.insertChart = function (type) {
  const range = detectChartRange();
  const anch = defaultAnchor(440, 260);
  const o = addObject({
    kind: 'chart', ...anch,
    chart: { type, title: 'Chart Title', range, byRow: false, legend: 'right' },
  });
  if (!chartData(o).series.length) setTimeout(() => chartSettingsDialog(o, true), 30);
  else X.sbMsg('Chart inserted — drag to move, double-click for settings');
};

X.insertShape = function (kind) {
  if (kind === 'textbox') {
    const anch = defaultAnchor(180, 60);
    const o = addObject({ kind: 'textbox', ...anch, text: '' });
    setTimeout(() => editTextbox(o), 30);
    return;
  }
  const fills = { rect: '#4472C4', oval: '#4472C4', arrow: '#4472C4', line: '#4472C4' };
  const dims = kind === 'line' ? [200, 4] : kind === 'arrow' ? [160, 70] : [140, 100];
  const anch = defaultAnchor(dims[0], dims[1]);
  addObject({ kind, ...anch, shape: { fill: fills[kind] || '#4472C4', line: '#2E5AAC', text: '' } });
};

X.insertPicture = function (dataUrl, name) {
  const img = new Image();
  img.onload = () => {
    const w = Math.min(img.width, 480), h = img.height * (w / img.width);
    const anch = defaultAnchor(w, h);
    addObject({ kind: 'picture', ...anch, pic: { src: dataUrl, name: name || 'picture', w0: img.width, h0: img.height } });
  };
  img.src = dataUrl;
};

/* ---------------- chart data ---------------- */
function chartData(o) {
  const def = o.chart;
  if (!def) return { cats: [], series: [] };
  if (o.sample || def._sample) return { cats: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Sales', vals: [42, 58, 35, 61] }, { name: 'Profit', vals: [18, 24, 14, 29] }] };
  if (!def.range) return { cats: [], series: [] };
  const { r1, c1, r2, c2 } = def.range;
  const grid = [];
  for (let r = r1; r <= r2; r++) {
    const row = [];
    for (let c = c1; c <= c2; c++) row.push(X.cellRaw(r, c));
    grid.push(row);
  }
  if (!grid.length) return { cats: [], series: [] };
  const isTxt = v => typeof v === 'string';
  const firstRowTxt = grid[0].filter(v => v != null).length > 0 && grid[0].every(v => v == null || isTxt(v));
  // first column holds category labels when its data cells (below a possible header row) are all text
  const col0cells = grid.slice(firstRowTxt ? 1 : 0).map(row => row[0]);
  const firstColTxt = col0cells.length > 0 && col0cells.some(v => v != null && v !== '') && col0cells.every(v => v == null || isTxt(v));
  let cats = [], series = [];
  const nameOf = i => firstRowTxt && grid[0][i] != null && grid[0][i] !== '' ? String(grid[0][i]) : 'Series' + (series.length + 1);
  if (!def.byRow) {
    const dataR1 = firstRowTxt ? 1 : 0;
    const dataC1 = firstColTxt ? 1 : 0;
    cats = grid.slice(dataR1).map((row, i) => firstColTxt ? (row[0] != null ? String(row[0]) : String(i + 1)) : String(i + 1));
    for (let c = dataC1; c <= c2 - c1; c++) {
      const vals = grid.slice(dataR1).map(row => { const v = row[c]; return typeof v === 'number' ? v : isTxt(v) && v.trim() !== '' && !isNaN(+v) ? +v : null; });
      if (vals.every(v => v == null)) continue;
      series.push({ name: firstRowTxt ? (grid[0][c] != null ? String(grid[0][c]) : 'Series' + (c - dataC1 + 1)) : 'Series' + (c - dataC1 + 1), vals });
    }
  } else {
    const dataR1 = firstColTxt ? 1 : 0;
    const dataC1 = firstRowTxt ? 1 : 0;
    cats = grid[0].slice(dataC1).map((v, i) => firstRowTxt ? (v != null ? String(v) : String(i + 1)) : String(i + 1));
    for (let r = dataR1; r <= r2 - r1; r++) {
      const row = grid[r];
      const vals = row.slice(dataC1).map(v => typeof v === 'number' ? v : isTxt(v) && v.trim() !== '' && !isNaN(+v) ? +v : null);
      if (vals.every(v => v == null)) continue;
      series.push({ name: firstColTxt ? (row[0] != null ? String(row[0]) : 'Series' + (r - dataR1 + 1)) : 'Series' + (r - dataR1 + 1), vals });
    }
  }
  return { cats, series };
}

/* ---------------- nice axis scale ---------------- */
function niceScale(vmin, vmax) {
  let lo = Math.min(0, vmin), hi = Math.max(0, vmax);
  if (lo === hi) { hi = lo === 0 ? 1 : (lo > 0 ? lo * 2 : 0); lo = lo > 0 ? 0 : (lo < 0 ? lo * 2 : -1); }
  const span = hi - lo || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(span)));
  let step = mag;
  for (const m of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) { // Excel-like major units, favour ~5-8 ticks
    const s = m * mag;
    if (span / s <= 8) { step = s; break; }
  }
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step * 1e-9; t += step) ticks.push(t % 1 ? +t.toFixed(6) : t);
  return { lo, hi, ticks, step };
}
const fmtTick = v => {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toPrecision(3).replace(/\.?0+$/, '') + 'B';
  if (a >= 1e6) return (v / 1e6).toPrecision(4).replace(/\.?0+$/, '') + 'M';
  if (a >= 1e5) return String(Math.round(v / 1000)) + 'K';
  if (a !== 0 && a < 0.001) return v.toExponential(0);
  return String(Math.round(v * 1000) / 1000);
};

/* ---------------- chart svg ---------------- */
X.chartSVG = (o, W, H) => chartSVG(o, W, H);
function chartSVG(o, W, H) {
  const { type } = o.chart;
  const { cats, series } = chartData(o);
  const T = X.state.theme || { colors: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] };
  const colr = i => T.colors[i % T.colors.length];
  const uid = o.id.replace(/[^a-z0-9]/gi, '');
  const svg = [];
  const legendR = o.chart.legend === 'right' && (series.length > 1 || type === 'pie' || type === 'doughnut') ? Math.min(120, Math.max(70, W * 0.24)) : 0;
  const pw = W - 4, ph = H - 4;
  svg.push(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`);

  if (type === 'pie' || type === 'doughnut') {
    const vals = (series[0] ? series[0].vals : cats.map(() => 1)).map(v => Math.max(0, v || 0));
    const labels = series[0] ? cats : series.map(s => s.name);
    const total = vals.reduce((a, b) => a + b, 0);
    const cx = (W - legendR) / 2, cy = H / 2, R = Math.min(W - legendR, H) / 2 - 8;
    if (!total) svg.push(`<text x="${cx}" y="${cy}" font-size="11" fill="#999" text-anchor="middle">Add data to see your chart</text>`);
    let ang = -Math.PI / 2;
    vals.forEach((v, i) => {
      if (!total) return;
      const frac = v / total, a2 = ang + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
      const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
      if (type === 'pie') {
        svg.push(vals.length === 1
          ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${colr(i)}"/>`
          : `<path d="M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${colr(i)}" stroke="#fff" stroke-width="1"/>`);
      } else {
        const r2 = R * 0.55;
        const x3 = cx + r2 * Math.cos(a2), y3 = cy + r2 * Math.sin(a2);
        const x4 = cx + r2 * Math.cos(ang), y4 = cy + r2 * Math.sin(ang);
        svg.push(vals.length === 1
          ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${colr(i)}"/><circle cx="${cx}" cy="${cy}" r="${r2}" fill="#fff"/>`
          : `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${r2} ${r2} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z" fill="${colr(i)}" stroke="#fff" stroke-width="1"/>`);
      }
      ang = a2;
    });
    if (legendR) {
      labels.slice(0, 14).forEach((lab, i) => {
        svg.push(`<rect x="${W - legendR + 8}" y="${18 + i * 18}" width="9" height="9" fill="${colr(i)}"/>`);
        svg.push(`<text x="${W - legendR + 22}" y="${26 + i * 18}" font-size="10.5" fill="#444">${esc(String(lab).slice(0, 12))}</text>`);
      });
    }
    svg.push('</svg>');
    return svg.join('');
  }

  // cartesian
  const L = 42, Bm = 24, Tm = 8, Rm = 6 + legendR;
  const plotW = Math.max(30, pw - L - Rm), plotH = Math.max(30, ph - Tm - Bm);
  let flat = [];
  series.forEach(s => s.vals.forEach(v => { if (typeof v === 'number') flat.push(v); }));
  if (!flat.length) {
    /* no numeric values anywhere (empty range or all text) — Excel draws an empty plot,
       never a renderer crash */
    svg.push(`<rect x="${L}" y="${Tm}" width="${plotW}" height="${plotH}" fill="#FAFAFA" stroke="#E3E3E3"/>`);
    svg.push(`<text x="${L + plotW / 2}" y="${Tm + plotH / 2}" font-size="11" fill="#999" text-anchor="middle">Add numeric data to see your chart</text>`);
    svg.push('</svg>');
    return svg.join('');
  }
  let sc;
  if (type === 'scatter' && series.length >= 1) {
    const xs = series[0].vals.filter(v => typeof v === 'number');
    const ys = (series[1] ? series[1].vals : []).filter(v => typeof v === 'number');
    flat = ys.length ? ys : xs;
    sc = niceScale(Math.min(...flat, 0), Math.max(...flat, 1));
    var scX = niceScale(Math.min(...xs, 0), Math.max(...xs, 1));
  } else sc = niceScale(flat.length ? Math.min(...flat) : 0, flat.length ? Math.max(...flat) : 1);
  const Y = v => Tm + plotH - (v - sc.lo) / (sc.hi - sc.lo) * plotH;
  const horiz = type === 'bar';
  // gridlines + axis labels
  sc.ticks.forEach(t => {
    const gy = Y(t);
    if (horiz) {
      const gx = L + (t - sc.lo) / (sc.hi - sc.lo) * plotW;
      svg.push(`<line x1="${gx}" y1="${Tm}" x2="${gx}" y2="${Tm + plotH}" stroke="#E8E8E8"/>`);
      svg.push(`<text x="${gx}" y="${Tm + plotH + 13}" font-size="9.5" fill="#777" text-anchor="middle">${fmtTick(t)}</text>`);
    } else {
      if (Math.abs(t - sc.lo) > 1e-9) svg.push(`<line x1="${L}" y1="${gy}" x2="${L + plotW}" y2="${gy}" stroke="#E8E8E8"/>`);
      svg.push(`<text x="${L - 5}" y="${gy + 3.2}" font-size="9.5" fill="#777" text-anchor="end">${fmtTick(t)}</text>`);
    }
  });
  // baseline
  if (!horiz) svg.push(`<line x1="${L}" y1="${Y(Math.max(sc.lo, Math.min(sc.hi, 0)))}" x2="${L + plotW}" y2="${Y(Math.max(sc.lo, Math.min(sc.hi, 0)))}" stroke="#BFBFBF"/>`);
  else svg.push(`<line x1="${L}" y1="${Tm}" x2="${L}" y2="${Tm + plotH}" stroke="#BFBFBF"/>`);

  const n = Math.max(1, cats.length);
  if (!series.length) {
    svg.push(`<text x="${L + plotW / 2}" y="${Tm + plotH / 2}" font-size="11" fill="#999" text-anchor="middle">Add data to see your chart</text>`);
  }
  if (type === 'col' || type === 'bar') {
    const sN = Math.max(1, series.length);
    if (!horiz) {
      const slot = plotW / n, bw = Math.min(60, slot * 0.72 / sN);
      // category labels
      cats.forEach((ct, i) => { if (cats.length <= 15 || i % Math.ceil(cats.length / 12) === 0) svg.push(`<text x="${L + slot * (i + 0.5)}" y="${Tm + plotH + 13}" font-size="9.5" fill="#777" text-anchor="middle">${esc(String(ct).slice(0, 9))}</text>`); });
      series.forEach((s, si) => {
        s.vals.forEach((v, i) => {
          if (typeof v !== 'number') return;
          const x = L + slot * i + slot / 2 - (bw * sN) / 2 + si * bw;
          const y0 = Y(Math.max(sc.lo, 0)), y1 = Y(v);
          svg.push(`<rect x="${x.toFixed(2)}" y="${Math.min(y0, y1).toFixed(2)}" width="${Math.max(1.5, bw - 1.5).toFixed(2)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(2)}" fill="${colr(si)}"/>`);
        });
      });
    } else {
      const slot = plotH / n, bh = Math.min(40, slot * 0.7 / sN);
      cats.forEach((ct, i) => { if (cats.length <= 15 || i % Math.ceil(cats.length / 12) === 0) svg.push(`<text x="${L - 5}" y="${Tm + slot * (i + 0.5) + 3.2}" font-size="9.5" fill="#777" text-anchor="end">${esc(String(ct).slice(0, 8))}</text>`); });
      const scB = niceScale(flat.length ? Math.min(...flat) : 0, flat.length ? Math.max(...flat) : 1);
      const Xv = v => L + (v - scB.lo) / (scB.hi - scB.lo) * plotW;
      series.forEach((s, si) => {
        s.vals.forEach((v, i) => {
          if (typeof v !== 'number') return;
          const y = Tm + slot * i + slot / 2 - (bh * sN) / 2 + si * bh;
          const x0 = Xv(Math.max(scB.lo, 0)), x1 = Xv(v);
          svg.push(`<rect x="${Math.min(x0, x1).toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(1, Math.abs(x1 - x0)).toFixed(2)}" height="${Math.max(1.5, bh - 1.5).toFixed(2)}" fill="${colr(si)}"/>`);
        });
      });
    }
  } else if (type === 'line' || type === 'area') {
    const step = n > 1 ? plotW / (n - 1) : plotW;
    const Xp = i => L + (n > 1 ? step * i : plotW / 2);
    cats.forEach((ct, i) => { if (cats.length <= 15 || i % Math.ceil(cats.length / 12) === 0) svg.push(`<text x="${Xp(i)}" y="${Tm + plotH + 13}" font-size="9.5" fill="#777" text-anchor="middle">${esc(String(ct).slice(0, 9))}</text>`); });
    series.forEach((s, si) => {
      const pts = [];
      s.vals.forEach((v, i) => { if (typeof v === 'number') pts.push([Xp(i), Y(v)]); });
      if (pts.length < 1) return;
      const str = pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
      if (type === 'area') {
        const y0 = Y(Math.max(sc.lo, 0));
        svg.push(`<defs><linearGradient id="ag${uid}${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colr(si)}" stop-opacity=".75"/><stop offset="1" stop-color="${colr(si)}" stop-opacity=".45"/></linearGradient></defs>`);
        svg.push(`<polygon points="${pts[0][0].toFixed(2)},${y0.toFixed(2)} ${str} ${pts[pts.length - 1][0].toFixed(2)},${y0.toFixed(2)}" fill="url(#ag${uid}${si})"/>`);
      }
      svg.push(pts.length === 1
        ? `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="2.6" fill="${colr(si)}"/>`
        : `<polyline points="${str}" fill="none" stroke="${colr(si)}" stroke-width="2"/>`);
    });
  } else if (type === 'scatter') {
    const xs = series[0] ? series[0].vals : [];
    const Xv = v => L + (v - scX.lo) / (scX.hi - scX.lo) * plotW;
    scX.ticks.forEach(t => {
      const gx = Xv(t);
      svg.push(`<text x="${gx}" y="${Tm + plotH + 13}" font-size="9.5" fill="#777" text-anchor="middle">${fmtTick(t)}</text>`);
    });
    series.slice(1).forEach((s, si) => {
      s.vals.forEach((v, i) => {
        if (typeof v !== 'number' || typeof xs[i] !== 'number') return;
        svg.push(`<circle cx="${Xv(xs[i]).toFixed(2)}" cy="${Y(v).toFixed(2)}" r="3" fill="${colr(si)}"/>`);
      });
    });
  }
  if (legendR && series.length > 1) {
    series.slice(0, 12).forEach((s, i) => {
      svg.push(`<rect x="${W - legendR + 8}" y="${16 + i * 18}" width="9" height="9" fill="${colr(i)}"/>`);
      svg.push(`<text x="${W - legendR + 22}" y="${24 + i * 18}" font-size="10.5" fill="#444">${esc(String(s.name).slice(0, 12))}</text>`);
    });
  }
  svg.push('</svg>');
  return svg.join('');
}

/* ---------------- object DOM rendering ---------------- */
function objSignature(o, w, h) {
  if (o.kind === 'chart') return 'ch:' + w + 'x' + h + ':' + JSON.stringify(o.chart) + ':' + dataSig(o.chart.range);
  return '';
}
function dataSig(rng) {
  if (!rng) return '';
  const vals = [];
  for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) {
    const v = X.cellRaw(r, c);
    vals.push(v == null ? '' : String(v));
  }
  return vals.join('') .length + ':' + vals.slice(0, 40).join(',').length + ':' + vals.join('|').length;
}
function buildObjBody(o, w, h) {
  if (o.kind === 'chart') return chartSVG(o, w, h);
  if (o.kind === 'picture') return `<img src="${o.pic.src}" style="width:100%;height:100%;display:block;pointer-events:none" draggable="false">`;
  if (o.kind === 'textbox') return `<div class="tb-text" style="width:100%;height:100%;padding:3px 5px;font-size:12px;color:#222;overflow:hidden;white-space:pre-wrap">${esc(o.text)}</div>`;
  // shapes
  const fill = o.shape.fill, line = o.shape.line;
  if (o.kind === 'rect') return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="${fill}" stroke="${line}" stroke-width="1.5"/></svg>`;
  if (o.kind === 'oval') return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 2}" ry="${h / 2 - 2}" fill="${fill}" stroke="${line}" stroke-width="1.5"/></svg>`;
  if (o.kind === 'arrow') {
    const hh = Math.min(h * 0.4, 30);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><path d="M2 ${(h - hh) / 2} h${w - hh - 6} v${-hh / 2} l${hh + 4} ${h / 2} l${-hh - 4} ${h / 2} v${-hh / 2} H2 z" fill="${fill}" stroke="${line}" stroke-width="1.5"/></svg>`;
  }
  if (o.kind === 'line') return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><line x1="2" y1="${h / 2}" x2="${w - 2}" y2="${h / 2}" stroke="${fill}" stroke-width="2.5"/></svg>`;
  return '';
}

function renderObjectsInto(v, fz) {
  const layer = $('#objects-layer');
  if (!layer) return;
  if (!v) { const gs = $('#grid-scroll'); v = { sl: gs.scrollLeft, st: gs.scrollTop, w: gs.clientWidth, h: gs.clientHeight }; }
  if (!fz) { const fzrc = X.sheet().freeze; const z = (X.state.zoom || 1); fz = { r: fzrc.r, c: fzrc.c, w: X.colX(fzrc.c) * z, h: X.rowY(fzrc.r) * z }; }
  layer.style.cssText = `position:absolute;left:0;top:0;width:${v.w}px;height:${v.h}px;overflow:visible;z-index:5;pointer-events:none;`;
  const wanted = new Set();
  for (const o of objList()) {
    wanted.add(o.id);
    const g = objGeomVp(o, v, fz);
    let div = objEls.get(o.id);
    if (!div || div._host !== layer) {
      div = el('div', { class: 'chart-obj' });
      div.dataset.oid = o.id;
      div.style.pointerEvents = 'auto';
      div.addEventListener('mousedown', e => objMouseDown(e, o.id));
      div.addEventListener('dblclick', e => objDblClick(e, o.id));
      div.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); objContextMenu(e, o.id); });
      objEls.set(o.id, div);
      div._sig = null;
      div._host = layer;
    }
    layer.appendChild(div);
    div.style.left = g.x + 'px'; div.style.top = g.y + 'px';
    div.style.width = g.w + 'px'; div.style.height = g.h + 'px';
    const sig = objSignature(o, Math.round(g.w), Math.round(g.h)) + '|' + (o.text || '') + '|' + (o.shape ? JSON.stringify(o.shape) : '');
    if (div._sig !== sig) {
      div._sig = sig;
      let inner = '';
      try {
        if (o.kind === 'chart') inner = `<div class="ch-title">${esc(o.chart.title)}</div>` + buildObjBody(o, Math.round(g.w), Math.round(g.h) - 26);
        else inner = buildObjBody(o, Math.round(g.w), Math.round(g.h));
      } catch (err) {
        /* one broken object must never take down the whole render pass */
        console.warn('object render failed', err);
        inner = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:11px">This object cannot be displayed</div>`;
        div._sig = sig;
      }
      for (const posn of ['nw', 'ne', 'sw', 'se']) {
        inner += `<div class="obj-res ${posn}" data-res="${posn}"></div>`;
      }
      div.innerHTML = inner;
    }
    div.classList.toggle('sel', X.objSelected === o.id);
  }
  // remove stale object els
  for (const [id, div] of Array.from(objEls.entries())) {
    if (!wanted.has(id) && div._host === layer) { div.remove(); objEls.delete(id); }
  }
  renderFilterButtons(layer, v, fz);
  renderOutlineBrackets(layer, v, fz);
  renderStickyNotes(layer, v, fz);
}
window.renderObjects = renderObjectsInto;
X.renderObjects = renderObjectsInto;

/* ---------------- object interactions ---------------- */
function objMouseDown(e, id) {
  e.stopPropagation(); e.preventDefault();
  const o = objById(id);
  if (!o) return;
  X.objSelected = id;
  X.renderAll();
  const res = e.target.closest('.obj-res');
  const startX = e.clientX, startY = e.clientY;
  const z = X.state.zoom;
  const gs = $('#grid-scroll');
  if (res) {
    const posn = res.dataset.res;
    const A0 = anchorAbsXY(o.a), B0 = anchorAbsXY(o.b);
    const mv = ev => {
      const dx = (ev.clientX - startX) / z, dy = (ev.clientY - startY) / z;
      let nx1 = A0.x, ny1 = A0.y, nx2 = B0.x, ny2 = B0.y;
      if (posn.includes('e')) nx2 = B0.x + dx;
      if (posn.includes('w')) nx1 = A0.x + dx;
      if (posn.includes('s')) ny2 = B0.y + dy;
      if (posn.includes('n')) ny1 = A0.y + dy;
      if (Math.abs(nx2 - nx1) < 16) return;
      if (Math.abs(ny2 - ny1) < 14) return;
      o.a = cellAnchorAt(Math.min(nx1, nx2) * z, Math.min(ny1, ny2) * z);
      o.b = cellAnchorAt(Math.max(nx1, nx2) * z, Math.max(ny1, ny2) * z);
      X.requestRender();
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); X.markDirty(); };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
    return;
  }
  // drag move
  const ax0 = anchorAbsXY(o.a), bx0 = anchorAbsXY(o.b);
  const gsRect = gs.getBoundingClientRect();
  const sx0 = cellScrollAbsX({ sl: gs.scrollLeft }) , sy0 = cellScrollAbsY({ st: gs.scrollTop });
  let moved = false;
  const offAx = (e.clientX - gsRect.left + gs.scrollLeft) / z; // unused, keep simple below
  const mv = ev => {
    moved = true;
    const dx = (ev.clientX - startX) / z, dy = (ev.clientY - startY) / z;
    const nAx = ax0.x + dx, nAy = ax0.y + dy, nBx = bx0.x + dx, nBy = bx0.y + dy;
    o.a = cellAnchorAt(nAx * z, nAy * z);
    o.b = cellAnchorAt(nBx * z, nBy * z);
    X.requestRender();
  };
  const up = () => {
    document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    if (moved) { X.requestRender(); X.markDirty(); }
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
}
function objDblClick(e, id) {
  e.stopPropagation(); e.preventDefault();
  const o = objById(id);
  if (!o) return;
  if (o.kind === 'chart') chartSettingsDialog(o);
  else if (o.kind === 'textbox') editTextbox(o);
  else if (o.shape) shapeFormatDialog(o);
}
function objContextMenu(e, id) {
  const o = objById(id);
  if (!o) return;
  X.objSelected = id; X.renderAll();
  const items = [];
  if (o.kind === 'chart') {
    items.push({ label: 'Chart Settings...', icon: 'chartcol', action: () => chartSettingsDialog(o) });
    items.push({
      label: 'Change Chart Type', icon: 'chartline', sub: () => ['col', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter'].map(k => ({
        label: { col: 'Column', bar: 'Bar', line: 'Line', area: 'Area', pie: 'Pie', doughnut: 'Doughnut', scatter: 'Scatter' }[k],
        check: o.chart.type === k ? 1 : null, icon: 'checkholder',
        action: () => { X.pushUndo('Change Chart Type'); o.chart.type = k; X.markDirty(); X.renderAll(); },
      })),
    });
    items.push({
      label: 'Switch Row/Column', action: () => { X.pushUndo('Switch Row/Column'); o.chart.byRow = !o.chart.byRow; X.markDirty(); X.renderAll(); },
    });
    items.push('sep');
  } else if (o.kind === 'textbox') {
    items.push({ label: 'Edit Text', action: () => editTextbox(o) });
  } else if (o.shape) {
    items.push({ label: 'Format Shape...', action: () => shapeFormatDialog(o) });
  }
  items.push({ label: 'Bring to Front', action: () => { const l = objList(); const i = l.indexOf(o); l.splice(i, 1); l.push(o); X.markDirty(); X.renderAll(); } });
  items.push({ label: 'Send to Back', action: () => { const l = objList(); const i = l.indexOf(o); l.splice(i, 1); l.unshift(o); X.markDirty(); X.renderAll(); } });
  items.push('sep');
  items.push({ label: 'Delete', icon: 'deletecells', note: 'Del', action: () => deleteObject(id) });
  X.pop({ clientX: e.clientX, clientY: e.clientY }, X.menu(items));
}
function deleteObject(id) {
  const o = objById(id);
  if (!o) return;
  X.pushUndo('Delete Object');
  const l = objList();
  l.splice(l.indexOf(o), 1);
  if (X.objSelected === id) X.objSelected = null;
  X.markDirty(); X.renderAll();
}
X.deleteObject = deleteObject;

// keyboard for objects (capture phase so the grid never sees it)
document.addEventListener('keydown', e => {
  if (!X.objSelected) return;
  if (e.target.closest('input, textarea, select, .dlg, .popup')) return;
  const o = objById(X.objSelected);
  if (!o) { X.objSelected = null; return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); deleteObject(o.id); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); X.objSelected = null; X.renderAll(); X.focusGrid(); }
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault(); e.stopPropagation();
    const z = X.state.zoom, d = (e.shiftKey ? 1 : 8);
    const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
    const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    const A = anchorAbsXY(o.a), B = anchorAbsXY(o.b);
    o.a = cellAnchorAt((A.x + dx) * z, (A.y + dy) * z);
    o.b = cellAnchorAt((B.x + dx) * z, (B.y + dy) * z);
    X.markDirty(); X.requestRender();
  }
}, true);
// clicking a cell deselects objects
document.addEventListener('mousedown', e => {
  if (X.objSelected && !e.target.closest('.chart-obj, .popup, .dlg, #ribbon, #tabrow, .rpanel')) {
    X.objSelected = null; X.requestRender();
  }
}, true);

function editTextbox(o) {
  const div = objEls.get(o.id);
  if (!div) return;
  X.objSelected = o.id; X.renderAll();
  const w = div.clientWidth, h = div.clientHeight;
  div.innerHTML = '';
  const ta = el('textarea', { style: `width:${w}px;height:${h}px;border:1px dashed var(--acc);outline:none;font:12px Calibri;padding:3px 5px;resize:none;background:#fff` });
  ta.value = o.text || '';
  div.appendChild(ta);
  ta.focus(); ta.select();
  const commit = () => {
    o.text = ta.value;
    objEls.get(o.id) && (objEls.get(o.id)._sig = null);
    X.markDirty(); X.renderAll(); X.focusGrid();
  };
  ta.addEventListener('blur', commit);
  ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { ta.blur(); } });
  ta.addEventListener('mousedown', e => e.stopPropagation());
}

function shapeFormatDialog(o) {
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;min-width:280px' });
  const mkColorFld = (label, val) => {
    const f = el('div', { class: 'fld' });
    f.innerHTML = `<span>${label}</span>`;
    const inp = X.cColorBtn(val);
    f.appendChild(inp);
    body.appendChild(f);
    return inp;
  };
  const fillInp = mkColorFld('Fill', o.shape.fill);
  const lineInp = mkColorFld('Outline', o.shape.line);
  X.dlg({
    title: 'Format Shape', body, width: 320,
    buttons: [
      {
        label: 'OK', pri: true, fn: () => {
          X.pushUndo('Format Shape');
          o.shape.fill = fillInp.value; o.shape.line = lineInp.value;
          const dv = objEls.get(o.id); if (dv) dv._sig = null;
          X.markDirty(); X.renderAll();
        }
      },
      { label: 'Cancel' },
    ],
  });
}

/* ---------------- chart settings dialog ---------------- */
function chartSettingsDialog(o, isNew) {
  const def = o.chart;
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:360px' });
  // type row
  const trow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
  const types = [['col', 'Column'], ['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['pie', 'Pie'], ['doughnut', 'Doughnut'], ['scatter', 'Scatter']];
  let chosen = def.type;
  const tbtns = types.map(([k, lab]) => {
    const b = el('button', { class: 'btn' + (k === chosen ? ' pri' : ''), style: 'min-width:58px;font-size:11.5px' }, lab);
    b.addEventListener('click', () => { chosen = k; tbtns.forEach(x => x.classList.remove('pri')); b.classList.add('pri'); });
    trow.appendChild(b);
    return b;
  });
  body.appendChild(el('div', { class: 'fld-h' }, 'Chart type'));
  body.appendChild(trow);
  const mkFld = (label, val) => {
    const f = el('div', { class: 'fld' });
    f.innerHTML = `<span>${label}</span>`;
    const inp = el('input', { type: 'text', value: val });
    f.appendChild(inp); body.appendChild(f);
    return inp;
  };
  const titleInp = mkFld('Chart title', def.title);
  const rngTxt = def.range ? `${a1(def.range.r1, def.range.c1)}:${a1(def.range.r2, def.range.c2)}` : '';
  const rngInp = mkFld('Data range (e.g. A1:C5)', rngTxt);
  const opts = el('div', { style: 'display:flex;gap:16px;align-items:center;font-size:12px' });
  const rowL = X.cCheck('Series in rows', def.byRow);
  const legL = X.cCheck('Show legend', def.legend !== 'none');
  const chkRow = rowL.cb, chkLeg = legL.cb;
  opts.appendChild(rowL); opts.appendChild(legL);
  body.appendChild(opts);
  X.dlg({
    title: 'Chart Settings', body, width: 420,
    buttons: [
      {
        label: 'OK', pri: true, fn: () => {
          X.pushUndo('Chart Settings');
          def.type = chosen;
          def.title = titleInp.value.trim() || 'Chart Title';
          const m = rngInp.value.trim().match(/^(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?$/);
          if (m) {
            const a = Calc.parseRef(m[1].replace(/\$/g, '')), b = m[2] ? Calc.parseRef(m[2].replace(/\$/g, '')) : a;
            if (a && b) def.range = { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
          } else if (!rngInp.value.trim()) def.range = null;
          else { X.msgBox('Microsoft Excel', 'The data range is not valid. Use a reference like A1:C5.', { icon: 'warn' }); return false; }
          def.byRow = chkRow.checked;
          def.legend = chkLeg.checked ? 'right' : 'none';
          const dv0 = objEls.get(o.id); if (dv0) dv0._sig = null;
          X.markDirty(); X.renderAll(); X.focusGrid();
        }
      },
      { label: 'Cancel' },
    ],
  });
}

/* ==========================================================================
   2. FILTER DROPDOWN BUTTONS
   ========================================================================== */
function filterTables() {
  return Object.entries(sheet().tables).filter(([, t]) => t.isAutoFilter);
}
function colFilterActive(t, c) {
  const f = t.filter && t.filter[c];
  if (!f) return false;
  return Object.values(f).some(v => v === false);
}
function renderFilterButtons(layer, v, fz) {
  const z = X.state.zoom;
  for (const [, t] of filterTables()) {
    for (let c = t.c1; c <= t.c2; c++) {
      const w = X.colWpx(c) * z;
      if (w < 26) continue;
      const bw = Math.min(17, w - 4), bh = Math.min(16, X.rowHpx(t.r1) * z - 4);
      if (bv(t.r1, c)) continue;
      const x = X.cellVpX(c, v, fz) + w - bw - 2;
      const y = X.cellVpY(t.r1, v, fz) + (X.rowHpx(t.r1) * z - bh) / 2;
      if (x < X.HDRW - 2 || y < X.HDRH - 2 || x > v.w - bw || y > v.h - bh) continue;
      const id = 'flt_' + t.r1 + '_' + c;
      let b = layer.querySelector(`[data-flt="${id}"]`);
      const active = colFilterActive(t, c);
      if (!b) {
        b = el('div', { class: 'flt-btn' });
        b.dataset.flt = id;
        b.style.pointerEvents = 'auto';
        b.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); filterDropdown(t, c, b); });
        layer.appendChild(b);
      }
      b.style.cssText += `;position:absolute;left:${x}px;top:${y}px;width:${bw}px;height:${bh}px;pointer-events:auto;`;
      const html = `<svg viewBox="0 0 10 10" width="${active ? 9 : 9}" height="9">${active
        ? '<path d="M1 1h8L6 5.5V9L4 8V5.5z" fill="#217346"/>'
        : '<path d="M2 3l3 3.4L8 3z" fill="#767676"/>'}</svg>`;
      if (b._h !== html) { b._h = html; b.innerHTML = html; }
      b.classList.toggle('on', active);
      b._tid = id;
    }
  }
  // cleanup stale buttons
  $$('.flt-btn', layer).forEach(b => {
    const [ , r, c] = b.dataset.flt.split('_').map(Number);
    const keep = filterTables().some(([, t]) => t.r1 === r && c >= t.c1 && c <= t.c2);
    if (!keep) b.remove();
  });
}
function bv() { return false; }
function colVals(t, c) {
  const seen = new Map();
  for (let r = t.r1 + 1; r <= t.r2; r++) {
    const d = X.cellDisplay(r, c);
    const txt = d ? d.text : '';
    const raw = X.cellRaw(r, c);
    const k = txt;
    if (!seen.has(k)) seen.set(k, { txt: txt === '' ? '(Blanks)' : txt, raw });
  }
  return Array.from(seen.entries()).slice(0, 500).map(([k, v]) => ({ key: k, label: v.label, txt: v.txt }));
}
function filterDropdown(t, c, btn) {
  const vals = [];
  const seen = new Set();
  for (let r = t.r1 + 1; r <= t.r2; r++) {
    const d = X.cellDisplay(r, c);
    const txt = d ? d.text : '';
    if (!seen.has(txt)) { seen.add(txt); vals.push(txt); }
    if (vals.length > 400) break;
  }
  vals.sort((A, B) => Calc.compare(A, B, '<') ? -1 : Calc.compare(A, B, '>') ? 1 : 0);
  t.filter = t.filter || {};
  const cur = t.filter[c] || (t.filter[c] = {});
  vals.forEach(v => { if (!(v in cur)) cur[v] = true; });

  const hdrName = (() => { const d = X.cellDisplay(t.r1, c); return d && d.text ? d.text : Calc.idxToCol(c); })();
  const box = el('div', { class: 'flt-pop' });
  const mi = (label, icon, fn) => {
    const it = el('div', { class: 'mi' });
    it.appendChild(el('span', { class: 'mi-lab' }, esc(label)));
    it.addEventListener('click', () => { X.closeAllPops(); fn(); });
    box.appendChild(it);
  };
  mi('Sort Smallest to Largest', null, () => X.sortRange({ r1: t.r1, r2: t.r2, c1: t.c1, c2: t.c2 }, [{ c, dir: 1 }], true));
  mi('Sort Largest to Smallest', null, () => X.sortRange({ r1: t.r1, r2: t.r2, c1: t.c1, c2: t.c2 }, [{ c, dir: -1 }], true));
  box.appendChild(el('div', { class: 'mi-sep' }));
  if (colFilterActive(t, c)) mi(`Clear Filter From "${hdrName}"`, null, () => {
    delete t.filter[c];
    X.applyFilter(t);
    X.markDirty(); X.renderAll();
  });
  box.appendChild(el('div', { class: 'mi-hdr' }, 'Filter by value'));
  const search = el('input', { class: 'flt-search', placeholder: 'Search', spellcheck: 'false' });
  box.appendChild(search);
  const list = el('div', { class: 'flt-list' });
  const allCb = el('input', { type: 'checkbox' });
  allCb.checked = vals.every(v => cur[v] !== false);
  const allRow = el('label', { class: 'flt-it' });
  allRow.appendChild(allCb); allRow.appendChild(el('span', null, '(Select All)'));
  list.appendChild(allRow);
  const cbs = [];
  vals.forEach(v => {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = cur[v] !== false;
    const lab = el('label', { class: 'flt-it' });
    lab.appendChild(cb);
    lab.appendChild(el('span', null, esc(v === '' ? '(Blanks)' : v)));
    list.appendChild(lab);
    cbs.push([v, cb]);
    cb.addEventListener('change', () => { allCb.checked = cbs.every(([, x]) => x.checked); });
  });
  allCb.addEventListener('change', () => cbs.forEach(([, x], i) => {
    if (search.value && list.children[i + 1].style.display === 'none') return; // Select All touches visible only
    x.checked = allCb.checked;
  }));
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    cbs.forEach(([v], i) => {
      const it = list.children[i + 1];
      it.style.display = !q || (v === '' ? '(blanks)' : v.toLowerCase()).includes(q) ? '' : 'none';
    });
  });
  box.appendChild(list);
  const foot = el('div', { class: 'flt-foot' });
  const ok = el('button', { class: 'btn pri', style: 'height:24px;font-size:11.5px' }, 'OK');
  const cancel = el('button', { class: 'btn', style: 'height:24px;font-size:11.5px' }, 'Cancel');
  ok.addEventListener('click', () => {
    cbs.forEach(([v, cb]) => { cur[v] = cb.checked; });
    if (cbs.every(([, cb]) => cb.checked)) delete t.filter[c];
    X.closeAllPops();
    X.applyFilter(t);
    X.markDirty(); X.renderAll();
  });
  cancel.addEventListener('click', () => X.closeAllPops());
  foot.appendChild(ok); foot.appendChild(cancel);
  box.appendChild(foot);
  X.pop(btn, box, { cls: 'flt-popup' });
}

/* ==========================================================================
   3. OUTLINE GROUPS
   ========================================================================== */
X.groupSel = function (axis) {
  const s = X.state.sel, sh = sheet();
  const n = X.normSel();
  X.pushUndo('Group');
  if ((axis === 'r' && s.type === 'rows') || (axis === 'r' && s.type !== 'cols')) {
    sh.outline.push({ axis: 'r', start: n.r1, end: n.r2, collapsed: false });
    sh.outline.sort((a, b) => a.start - b.start);
  } else {
    sh.outline.push({ axis: 'c', start: n.c1, end: n.c2, collapsed: false });
    sh.outline.sort((a, b) => a.start - b.start);
  }
  X.markDirty(); X.renderAll();
  X.sbMsg('Group created — use the bracket button to collapse or expand');
};
X.ungroupSel = function (axis) {
  const n = X.normSel(), sh = sheet();
  const ax = axis === 'c' || X.state.sel.type === 'cols' ? 'c' : 'r';
  const hit = sh.outline.filter(g => g.axis === ax && Math.min(g.end, ax === 'r' ? n.r2 : n.c2) >= Math.max(g.start, ax === 'r' ? n.r1 : n.c1));
  if (!hit.length) { X.sbMsg('No group found in the selection'); return; }
  X.pushUndo('Ungroup');
  for (const g of hit) {
    setGroupCollapsed(sh, g, false);
    sh.outline.splice(sh.outline.indexOf(g), 1);
  }
  X.markDirty(); X.renderAll();
};
function setGroupCollapsed(sh, g, collapsed) {
  sh._grpHid = sh._grpHid || {};
  g.collapsed = collapsed;
  for (let i = g.start; i <= g.end; i++) {
    const k = g.axis + i;
    if (collapsed) {
      if (g.axis === 'r') { if (!sh.hidR[i]) sh._grpHid[k] = 1; sh.hidR[i] = true; }
      else { if (!sh.hidC[i]) sh._grpHid[k] = 1; sh.hidC[i] = true; }
    } else if (sh._grpHid[k]) {
      delete sh._grpHid[k];
      if (g.axis === 'r') delete sh.hidR[i]; else delete sh.hidC[i];
    }
  }
}
function renderOutlineBrackets(layer, v, fz) {
  const sh = sheet(), z = X.state.zoom;
  $$('.ol-btn, .ol-line', layer).forEach(x => x.remove());
  for (const g of sh.outline) {
    if (g.axis === 'r') {
      const y1 = X.cellVpY(g.start, v, fz), y2 = X.cellVpY(g.end, v, fz) + X.rowHpx(g.end) * z;
      const x = X.HDRW - 13;
      if (y2 < X.HDRH || y1 > v.h) continue;
      const ln = el('div', { class: 'ol-line v', style: `left:${x + 4}px;top:${clamp(y1, X.HDRH, v.h)}px;height:${clamp(y2, X.HDRH, v.h) - clamp(y1, X.HDRH, v.h) - 12}px` });
      layer.appendChild(ln);
      const btn = el('div', { class: 'ol-btn', style: `left:${x - 1}px;top:${clamp(y2, X.HDRH, v.h) - 11}px;pointer-events:auto` }, g.collapsed ? '+' : '−');
      btn.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        X.pushUndo(g.collapsed ? 'Expand Group' : 'Collapse Group');
        setGroupCollapsed(sh, g, g.collapsed ? false : true);
        X.markDirty(); X.renderAll();
      });
      layer.appendChild(btn);
    } else {
      const x1 = X.cellVpX(g.start, v, fz), x2 = X.cellVpX(g.end, v, fz) + X.colWpx(g.end) * z;
      const y = X.HDRH - 13;
      if (x2 < X.HDRW || x1 > v.w) continue;
      const ln = el('div', { class: 'ol-line h', style: `top:${y + 4}px;left:${clamp(x1, X.HDRW, v.w)}px;width:${clamp(x2, X.HDRW, v.w) - clamp(x1, X.HDRW, v.w) - 12}px` });
      layer.appendChild(ln);
      const btn = el('div', { class: 'ol-btn', style: `top:${y - 1}px;left:${clamp(x2, X.HDRW, v.w) - 11}px;pointer-events:auto` }, g.collapsed ? '+' : '−');
      btn.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        X.pushUndo(g.collapsed ? 'Expand Group' : 'Collapse Group');
        setGroupCollapsed(sh, g, g.collapsed ? false : true);
        X.markDirty(); X.renderAll();
      });
      layer.appendChild(btn);
    }
  }
}

/* ==========================================================================
   4. NOTES (yellow sticky notes)
   ========================================================================== */
X.noteDialog = function () {
  const s = X.state.sel, sh = sheet();
  const k = keyOf(s.a.r, s.a.c);
  const cur = sh.notes[k] || '';
  const body = el('div');
  body.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2);margin-bottom:6px' }, `${a1(s.a.r, s.a.c)} — ${esc(X.state.author || 'User')}:`));
  const ta = el('textarea', { style: 'width:100%;height:120px;border:1px solid var(--field-b);padding:6px;font:12px Calibri;resize:vertical' });
  ta.value = cur;
  body.appendChild(ta);
  X.dlg({
    title: cur ? 'Edit Note' : 'New Note', body, width: 360,
    buttons: [
      {
        label: 'OK', pri: true, fn: () => {
          X.pushUndo(cur ? 'Edit Note' : 'New Note');
          const txt = ta.value.replace(/\s+$/, '');
          if (!txt) delete sh.notes[k]; else sh.notes[k] = txt;
          X.markDirty(); X.renderAll();
          X.sbMsg(txt ? 'Note saved to ' + a1(s.a.r, s.a.c) : 'Note deleted');
        }
      },
      { label: 'Cancel' },
    ],
  });
};
X.deleteNoteAt = function (r, c) {
  const sh = sheet(), k = keyOf(r, c);
  if (!sh.notes[k]) return;
  X.pushUndo('Delete Note');
  delete sh.notes[k];
  X.markDirty(); X.renderAll();
};
function notePopupEl(r, c, txt, sticky) {
  const np = el('div', { class: 'note-pop' + (sticky ? ' sticky' : '') });
  np.innerHTML = `<div class="np-author">${esc(X.state.author || 'User')}:</div><div class="np-text">${esc(txt)}</div>`;
  if (sticky) {
    const xb = el('button', { class: 'np-x', title: 'Close' }, '×');
    xb.addEventListener('mousedown', e => { e.stopPropagation(); np.remove(); if (X.notePopup === np) X.notePopup = null; });
    np.appendChild(xb);
  }
  np.dataset.note = r + ',' + c;
  np.style.pointerEvents = 'auto';
  np.addEventListener('mousedown', e => e.stopPropagation());
  return np;
}
X.noteHoverShow = function (r, c, sticky) {
  const sh = sheet();
  const txt = sh.notes[keyOf(r, c)];
  if (!txt) return;
  if (X.notePopup) { X.notePopup.remove(); X.notePopup = null; }
  const v = { sl: $('#grid-scroll').scrollLeft, st: $('#grid-scroll').scrollTop, w: $('#grid-scroll').clientWidth, h: $('#grid-scroll').clientHeight };
  const fz = { r: sh.freeze.r, c: sh.freeze.c, w: 0, h: 0 };
  const layer = $('#objects-layer');
  const np = notePopupEl(r, c, txt, sticky);
  layer.appendChild(np);
  const x = X.cellVpX(c, v, fz) + X.colWpx(c) * X.state.zoom + 4;
  const y = X.cellVpY(r, v, fz);
  np.style.left = clamp(x, 4, v.w - np.offsetWidth - 6) + 'px';
  np.style.top = clamp(y, X.HDRH + 2, v.h - np.offsetHeight - 6) + 'px';
  X.notePopup = np;
  X.focusGrid();
};
// hover: show note after a short pause over a marked cell
(function () {
  let timer = null, lastKey = null;
  document.addEventListener('mousemove', e => {
    if (X.state.showNotes) return; // all-notes mode renders them statically
    const celld = e.target.closest && e.target.closest('.cell');
    const k = celld ? celld.dataset.r + ',' + celld.dataset.c : null;
    if (k === lastKey) return;
    lastKey = k;
    clearTimeout(timer);
    if (X.notePopup && !X.notePopup.classList.contains('sticky')) { X.notePopup.remove(); X.notePopup = null; }
    if (k && sheet().notes[k]) {
      const [r, c] = k.split(',').map(Number);
      timer = setTimeout(() => X.noteHoverShow(r, c, false), 350);
    }
  }, true);
  document.addEventListener('mousedown', e => {
    if (X.notePopup && !e.target.closest('.note-pop')) { X.notePopup.remove(); X.notePopup = null; }
  }, true);
})();
function renderStickyNotes(layer, v, fz) {
  if (!X.state.showNotes) { $$('.note-pop.show-all', layer).forEach(x => x.remove()); return; }
  const sh = sheet(), z = X.state.zoom;
  const seen = new Set();
  for (const k of Object.keys(sh.notes)) {
    const { r, c } = rcOf(k);
    seen.add('sa_' + k);
    let np = layer.querySelector(`[data-sa="${CSS.escape(k)}"]`);
    const w = 190;
    if (!np) {
      np = notePopupEl(r, c, sh.notes[k], false);
      np.classList.add('show-all');
      np.dataset.sa = k;
      layer.appendChild(np);
    }
    const x = X.cellVpX(c, v, fz) + X.colWpx(c) * z + 3;
    const y = X.cellVpY(r, v, fz);
    np.style.left = clamp(x, 2, v.w - w) + 'px';
    np.style.top = clamp(y, X.HDRH, v.h - 40) + 'px';
  }
  $$('.note-pop.show-all', layer).forEach(np => { if (!seen.has('sa_' + np.dataset.sa)) np.remove(); });
}

})();
