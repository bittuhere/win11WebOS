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
   app3.js — charts (SVG renderer + data editor), picture insert & crop,
   table cell editing, slide sorter view, full slideshow engine, reading view
   ========================================================================== */
(function () {
'use strict';
const { $, $$, el, esc, clamp, uid } = P;
const FSTACK = `'Calibri','Segoe UI',sans-serif`;

/* ==========================================================================
   CHARTS — Office 2016 look: white plot, #D6DCE4 gridlines, a1..a6 palette
   ========================================================================== */
function chartPalette() {
  const t = P.TH();
  return [t.a1, t.a2, t.a3, t.a4, t.a5, t.a6];
}
function niceScale(max) {
  if (!isFinite(max) || max <= 0) max = 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const r = max / pow;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * pow;
  const niceMax = Math.ceil(max / step - 1e-9) * step;
  let count = Math.round(niceMax / step);
  while (count > 6) { count /= 2; }
  while (niceMax / count > step * 1.0001) count++;
  const unit = niceMax / count;
  return { max: niceMax, unit, count };
}
function fmtTick(v) {
  if (Math.abs(v) >= 1000) return String(Math.round(v));
  return String(Math.round(v * 100) / 100);
}
const AXIS_C = '#595959', GRID_C = '#E1E1E1', AXISLINE_C = '#D8D8D8';
window.chartSVG = function chartSVG(o, w, h) {
  const d = o.chart || { kind: 'col', cats: [], series: [] };
  const kind = d.kind || d.type || 'col';
  const pal = chartPalette();
  const series = (d.series || []).map((s, i) => ({ name: s.name || 'Series ' + (i + 1), vals: s.vals || [], color: pal[i % pal.length] }));
  const cats = d.cats || [];
  const nC = Math.max(1, cats.length), nS = Math.max(1, series.length);
  const showTitle = d.showTitle !== false;
  const showLegend = d.legend !== false;
  const titleH = showTitle ? 26 : 6;
  const legH = showLegend ? 24 : 6;
  const axisFont = `font-family:${FSTACK};font-size:11px;fill:${AXIS_C}`;
  const escS = s => esc(s);
  if (kind === 'pie') {
    const cx0 = w * (showLegend ? 0.34 : 0.5), cy0 = titleH + (h - titleH - 8) / 2;
    const R = Math.min((h - titleH - 16) / 2, w * (showLegend ? 0.30 : 0.42));
    const vals = series[0] ? series[0].vals : [];
    const tot = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    let a0 = -Math.PI / 2;
    let slices = '';
    cats.forEach((c, i) => {
      const v = Math.max(0, vals[i] || 0);
      const a1 = a0 + (v / tot) * Math.PI * 2;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const x1 = cx0 + R * Math.cos(a0), y1 = cy0 + R * Math.sin(a0);
      const x2 = cx0 + R * Math.cos(a1), y2 = cy0 + R * Math.sin(a1);
      slices += `<path d="M${cx0} ${cy0} L${x1.toFixed(1)} ${y1.toFixed(1)} A${R.toFixed(1)} ${R.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${pal[i % pal.length]}" stroke="#fff" stroke-width="1.5"/>`;
      if (d.showVal && v) {
        const am = (a0 + a1) / 2, lr = R * 0.62;
        slices += `<text x="${(cx0 + lr * Math.cos(am)).toFixed(1)}" y="${(cy0 + lr * Math.sin(am) + 4).toFixed(1)}" text-anchor="middle" style="font-family:${FSTACK};font-size:11px;fill:#fff">${Math.round(v / tot * 100)}%</text>`;
      }
      a0 = a1;
    });
    let legend = '';
    if (showLegend) {
      const lx = cx0 + R + 26;
      const ly0 = cy0 - (cats.length * 20) / 2 + 10;
      cats.forEach((c, i) => {
        legend += `<rect x="${lx}" y="${ly0 + i * 20 - 9}" width="10" height="10" fill="${pal[i % pal.length]}"/><text x="${lx + 16}" y="${ly0 + i * 20}" style="${axisFont}">${escS(c)}</text>`;
      });
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${w} ${h}">${showTitle ? `<text x="${w / 2}" y="${titleH - 9}" text-anchor="middle" style="font-family:${FSTACK};font-size:14.5px;fill:${AXIS_C}">${escS(d.title || 'Chart Title')}</text>` : ''}${slices}${legend}</svg>`;
  }
  const maxV = Math.max(0.0001, ...series.flatMap(s => s.vals));
  const sc = niceScale(maxV);
  const padL = 8 + Math.max(24, String(fmtTick(sc.max)).length * 7 + 6), padR = 10;
  const padT = titleH, padB = legH + 20;
  const plotW = w - padL - padR, plotH = Math.max(10, h - padT - padB);
  const y0 = padT + plotH;
  const y = v => y0 - (v / sc.max) * plotH;
  let svg = '';
  // gridlines + y labels
  for (let i = 0; i <= sc.count; i++) {
    const v = sc.unit * i, yy = y(v);
    if (i > 0) svg += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${w - padR}" y2="${yy.toFixed(1)}" stroke="${GRID_C}" stroke-width="1"/>`;
    svg += `<text x="${padL - 7}" y="${(yy + 4).toFixed(1)}" text-anchor="end" style="${axisFont}">${fmtTick(v)}</text>`;
  }
  const title = showTitle ? `<text x="${w / 2}" y="${padT - 9}" text-anchor="middle" style="font-family:${FSTACK};font-size:14.5px;fill:${AXIS_C}">${esc(d.title || 'Chart Title')}</text>` : '';
  let legend = '';
  if (showLegend) {
    const items = series.map((s, i) => `<rect x="0" y="0" width="10" height="10" fill="${s.color}"/><text x="15" y="9.5" style="${axisFont}">${esc(s.name)}</text>`);
    const itemW = Math.max(...series.map(s => s.name.length), 6) * 7 + 34;
    const totW = itemW * series.length;
    let lx = Math.max(0, (w - totW) / 2);
    const ly = h - legH + 6;
    legend = series.map((s, i) => `<g transform="translate(${(lx + i * itemW).toFixed(1)},${ly})"><rect width="10" height="10" fill="${s.color}"/><text x="15" y="9.5" style="${axisFont}">${esc(s.name)}</text></g>`).join('');
  }
  if (kind === 'col') {
    const band = plotW / nC;
    const grpW = band * 0.62;
    const barW = grpW / nS;
    let body = '';
    cats.forEach((c, ci) => {
      const bx0 = padL + ci * band + (band - grpW) / 2;
      series.forEach((s, si) => {
        const v = s.vals[ci] || 0;
        const bh = Math.max(0.5, (v / sc.max) * plotH);
        body += `<rect x="${(bx0 + si * barW).toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1, barW - 1.5).toFixed(1)}" height="${bh.toFixed(1)}" fill="${s.color}"/>`;
        if (d.showVal && v) body += `<text x="${(bx0 + si * barW + barW / 2).toFixed(1)}" y="${(y(v) - 3).toFixed(1)}" text-anchor="middle" style="font-family:${FSTACK};font-size:9.5px;fill:${AXIS_C}">${fmtTick(v)}</text>`;
      });
      svg += `<text x="${(padL + ci * band + band / 2).toFixed(1)}" y="${y0 + 15}" text-anchor="middle" style="${axisFont}">${esc(c)}</text>`;
    });
    svg += `<line x1="${padL}" y1="${y0}" x2="${w - padR}" y2="${y0}" stroke="${AXISLINE_C}" stroke-width="1.2"/>` + body;
  } else if (kind === 'bar') {
    const band = plotH / nC;
    const grpW = band * 0.62;
    const barH = grpW / nS;
    let body = '';
    cats.forEach((c, ci) => { // first category at top, PowerPoint style
      const by0 = padT + ci * band + (band - grpW) / 2;
      series.forEach((s, si) => {
        const v = s.vals[ci] || 0;
        const bw = Math.max(0.5, (v / sc.max) * plotW);
        body += `<rect x="${padL}" y="${(by0 + si * barH).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, barH - 1.5).toFixed(1)}" fill="${s.color}"/>`;
        if (d.showVal && v) body += `<text x="${(padL + bw + 3).toFixed(1)}" y="${(by0 + si * barH + barH / 2 + 3.5).toFixed(1)}" style="font-family:${FSTACK};font-size:9.5px;fill:${AXIS_C}">${fmtTick(v)}</text>`;
      });
      svg += `<text x="${padL - 7}" y="${(padT + ci * band + band / 2 + 4).toFixed(1)}" text-anchor="end" style="${axisFont}">${esc(c)}</text>`;
    });
    // for bar: gridlines vertical instead
    svg = svg.replace(/<line x1="[^"]*" y1="[^"]*" x2="[^"]*" y2="[^"]*" stroke="#E1E1E1"[^/]*\/>/g, '');
    let gridV = '';
    for (let i = 1; i <= sc.count; i++) {
      const v = sc.unit * i, xx = padL + (v / sc.max) * plotW;
      gridV += `<line x1="${xx.toFixed(1)}" y1="${padT}" x2="${xx.toFixed(1)}" y2="${y0}" stroke="${GRID_C}" stroke-width="1"/>`;
    }
    svg = gridV + svg + body + `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${y0}" stroke="${AXISLINE_C}" stroke-width="1.2"/>`;
  } else if (kind === 'line') {
    const step = plotW / nC;
    let body = '';
    series.forEach(s => {
      const pts = cats.map((c, ci) => `${(padL + ci * step + step / 2).toFixed(1)},${y(s.vals[ci] || 0).toFixed(1)}`);
      body += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`;
      pts.forEach(p2 => { const [px, py] = p2.split(','); body += `<circle cx="${px}" cy="${py}" r="3.6" fill="${s.color}" stroke="#fff" stroke-width="1"/>`; });
      if (d.showVal) cats.forEach((c, ci) => { const v = s.vals[ci] || 0; if (v) body += `<text x="${(padL + ci * step + step / 2).toFixed(1)}" y="${(y(v) - 7).toFixed(1)}" text-anchor="middle" style="font-family:${FSTACK};font-size:9.5px;fill:${AXIS_C}">${fmtTick(v)}</text>`; });
    });
    cats.forEach((c, ci) => {
      svg += `<text x="${(padL + ci * step + step / 2).toFixed(1)}" y="${y0 + 15}" text-anchor="middle" style="${axisFont}">${esc(c)}</text>`;
    });
    svg += `<line x1="${padL}" y1="${y0}" x2="${w - padR}" y2="${y0}" stroke="${AXISLINE_C}" stroke-width="1.2"/>` + body;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${w} ${h}">${title}${svg}${legend}</svg>`;
};

/* -------- chart data editor -------- */
function chartDataDialog(o) {
  const d = o.chart;
  const kindNames = { col: 'Clustered Column', bar: 'Clustered Bar', line: 'Line', pie: 'Pie' };
  const grid = el('div', { class: 'cd-grid' });
  const build = () => {
    grid.innerHTML = '';
    const t = el('table', { class: 'cd-tbl' });
    const hr = el('tr', null, el('th', null, ''));
    d.series.forEach((s, si) => {
      const nm = el('input', { type: 'text', value: s.name });
      nm.addEventListener('input', () => s.name = nm.value);
      const del = el('button', { class: 'cd-x', title: 'Delete series' }, '×');
      del.addEventListener('mousedown', ev => { ev.preventDefault(); if (d.series.length > 1) { d.series.splice(si, 1); build(); } });
      hr.appendChild(el('th', null, nm, d.series.length > 1 ? del : ''));
    });
    t.appendChild(hr);
    d.cats.forEach((c, ci) => {
      const cat = el('input', { type: 'text', value: c });
      cat.addEventListener('input', () => d.cats[ci] = cat.value);
      const del = el('button', { class: 'cd-x', title: 'Delete category' }, '×');
      del.addEventListener('mousedown', ev => { ev.preventDefault(); if (d.cats.length > 1) { d.cats.splice(ci, 1); d.series.forEach(s => s.vals.splice(ci, 1)); build(); } });
      const tr = el('tr', null, el('td', { class: 'cd-cat' }, cat, del));
      d.series.forEach(s => {
        const v = el('input', { type: 'text', value: s.vals[ci] != null ? s.vals[ci] : 0 });
        v.addEventListener('input', () => { const n = parseFloat(v.value); s.vals[ci] = isNaN(n) ? 0 : n; });
        tr.appendChild(el('td', null, v));
      });
      t.appendChild(tr);
    });
    grid.appendChild(t);
  };
  build();
  const addCat = el('button', { class: 'btn' }, '+ Category');
  addCat.addEventListener('mousedown', e => { e.preventDefault(); d.cats.push('Category ' + (d.cats.length + 1)); d.series.forEach(s => s.vals.push(Math.round(Math.random() * 4 + 1))); build(); });
  const addSer = el('button', { class: 'btn' }, '+ Series');
  addSer.addEventListener('mousedown', e => {
    e.preventDefault();
    d.series.push({ name: 'Series ' + (d.series.length + 1), vals: d.cats.map(() => Math.round(Math.random() * 4 + 1)) });
    build();
  });
  P.dlg({
    title: 'Chart in PowerPoint — ' + (kindNames[d.kind || d.type] || 'Chart'), width: 520,
    body: el('div', null,
      el('div', { style: 'font-size:11px;color:#777;margin-bottom:6px' }, 'Click a cell and type. Use × to delete a row or column.'),
      grid,
      el('div', { style: 'display:flex;gap:8px;margin-top:8px' }, addCat, addSer)),
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        P.pushHistory('Edit chart data');
        P.renderAll(); P.markDirty();
      }
    }, { label: 'Cancel' }],
  });
}
P.chartDataDialog = chartDataDialog;

/* ==========================================================================
   PICTURES — insert from file + crop mode
   ========================================================================== */
function insertPictureDialog(target) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const src = String(rd.result);
      const img = new Image();
      img.onload = () => {
        P.pushHistory('Insert picture');
        if (target && (target.kind === 'picph' || target.kind === 'pic')) {
          target.kind = 'pic'; target.src = src; target.crop = null; target.ph = null; target.prompt = null;
        } else {
          const maxW = 820, maxH = 540;
          const sc = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
          const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
          const o = P.plainObj({ kind: 'pic', x: Math.round((P.SW() - w) / 2), y: Math.round((P.SH() - h) / 2), w, h, src, name: f.name });
          P.addObject(o);
        }
        P.renderAll(); P.markDirty();
        P.sbMsg('Picture inserted');
      };
      img.src = src;
    };
    rd.readAsDataURL(f);
  });
  inp.click();
}
P.insertPictureDialog = insertPictureDialog;

/* crop: drag the black crop bars; image stays put, crop% changes */
let cropState = null;
P.startCropMode = function (o) {
  endCropMode(true);
  const slide = $('#slide');
  const node = slide.querySelector(`.obj[data-oid="${o.id}"]`);
  if (!node || !o.src) return;
  cropState = { o, orig: JSON.parse(JSON.stringify(o.crop || { l: 0, t: 0, r: 0, b: 0 })) };
  const z = P.Z();
  const ov = el('div', { class: 'crop-ov' });
  slide.appendChild(ov);
  cropState.ov = ov;
  const draw = () => {
    ov.innerHTML = '';
    const w = o.w * z, h = o.h * z;
    ov.style.cssText = `position:absolute;left:${o.x * z}px;top:${o.y * z}px;width:${w}px;height:${h}px;z-index:80;pointer-events:none`;
    const mk = (dir, style, cursor) => {
      const b = el('div', { class: 'crop-bar crop-' + dir, style: style + ';cursor:' + cursor });
      b.style.pointerEvents = 'auto';
      b.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        const start = { x: e.clientX, y: e.clientY, crop: { ...(o.crop || { l: 0, t: 0, r: 0, b: 0 }) } };
        const mm = ev => {
          const dx = (ev.clientX - start.x) / z, dy = (ev.clientY - start.y) / z;
          const c = o.crop = { ...start.crop };
          if (dir === 'l') c.l = clamp(start.crop.l + dx / o.w * 100, 0, 95 - c.r);
          if (dir === 'r') c.r = clamp(start.crop.r - dx / o.w * 100, 0, 95 - c.l);
          if (dir === 't') c.t = clamp(start.crop.t + dy / o.h * 100, 0, 95 - c.b);
          if (dir === 'b') c.b = clamp(start.crop.b - dy / o.h * 100, 0, 95 - c.t);
          P.renderMain(); slide.appendChild(ov); draw();
        };
        const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); P.pushHistory('Crop'); P.markDirty(); };
        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
      });
      return b;
    };
    ov.appendChild(mk('t', `left:-8px;right:-8px;top:-9px;height:18px`, 'ns-resize'));
    ov.appendChild(mk('b', `left:-8px;right:-8px;bottom:-9px;height:18px`, 'ns-resize'));
    ov.appendChild(mk('l', `top:-8px;bottom:-8px;left:-9px;width:18px`, 'ew-resize'));
    ov.appendChild(mk('r', `top:-8px;bottom:-8px;right:-9px;width:18px`, 'ew-resize'));
  };
  draw();
  const key = e => { if (e.key === 'Escape') endCropMode(false); else if (e.key === 'Enter') endCropMode(true); };
  const clk = e => { if (!ov.contains(e.target) && e.target !== ov) endCropMode(true); };
  document.addEventListener('keydown', key, true);
  setTimeout(() => document.addEventListener('mousedown', clk), 30);
  cropState.cleanup = () => { document.removeEventListener('keydown', key, true); document.removeEventListener('mousedown', clk); };
  P.sbMsg('Cropping — drag the black bars, Enter to accept, Esc to cancel');
};
function endCropMode(keep) {
  if (!cropState) return;
  if (!keep) cropState.o.crop = cropState.orig;
  cropState.cleanup && cropState.cleanup();
  cropState.ov && cropState.ov.remove();
  cropState = null;
  P.renderMain();
}

/* -------- table cell text editing -------- */
function beginCellEdit(obj, td) {
  if (!obj || !td || td.contentEditable === 'true') return;
  window._pptTblEdit = true;
  td.contentEditable = 'true';
  td.focus();
  const sel = window.getSelection(); sel.selectAllChildren(td); sel.collapseToEnd();
  let done = false;
  const commit = ok => {
    if (done) return; done = true;
    window._pptTblEdit = false;
    td.contentEditable = 'false';
    if (ok) {
      const rows = td.closest('.tbl').rows, ri = Array.from(rows).indexOf(td.parentNode);
      const ci = Array.from(td.parentNode.cells).indexOf(td);
      if (obj.tbl[ri] && obj.tbl[ri][ci]) {
        P.pushHistory('Edit table cell');
        const txt = td.innerText.replace(/\n+$/g, '');
        obj.tbl[ri][ci].paras = txt.split('\n').map(l => ({ runs: [{ t: l }], bullet: 'none', align: null, level: 0 }));
        P.markDirty();
      }
    }
    P.renderMain();
  };
  td.addEventListener('blur', () => commit(true), { once: true });
  td.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); commit(false); }
    else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(true); }
    ev.stopPropagation();
  });
}
/* Called from onStageDblClick (app.js). Ends any active text edit first —
   endEdit re-renders the slide, so re-resolve the cell in the fresh DOM. */
P.editTableCell = function editTableCell(obj, td) {
  if (!obj || !td) return;
  const tbl0 = td.closest('.tbl');
  const ri = tbl0 ? Array.from(tbl0.rows).indexOf(td.parentNode) : -1;
  const ci = td.parentNode ? Array.from(td.parentNode.cells).indexOf(td) : -1;
  if (P.editing) P.endEdit(true);
  let fresh = td.isConnected ? td : null;
  if (!fresh && ri >= 0 && ci >= 0) {
    const tbl = document.querySelector('#slide .tbl[data-tid="' + obj.id + '"]');
    if (tbl && tbl.rows[ri]) fresh = tbl.rows[ri].cells[ci] || null;
  }
  if (fresh) beginCellEdit(obj, fresh);
};

/* ==========================================================================
   SLIDE SORTER
   ========================================================================== */
window.renderSorter = function renderSorter() {
  const host = $('#sorter');
  host.innerHTML = '';
  P.state.slides.forEach((s, i) => {
    const hasTr = s.transition && s.transition.kind && s.transition.kind !== 'none';
    const it = el('div', { class: 'sort-item' + (i === P.state.active ? ' on' : '') + (s.hidden ? ' s-hidden' : ''), draggable: 'true' });
    const cap = el('div', { class: 'sort-cap' },
      el('span', { class: 'sort-num' }, String(i + 1)),
      hasTr ? el('span', { class: 'sort-star', title: 'Transition: ' + s.transition.kind }, '<svg viewBox="0 0 24 24" width="11" height="11"><path d="M12 2 L14.6 8.9 L22 9.2 L16.2 13.6 L18 20.8 L12 16.9 L6 20.8 L7.8 13.6 L2 9.2 L9.4 8.9 Z" fill="#C43E1C"/></svg>') : '',
      s.hidden ? el('span', { class: 'sort-hid', title: 'Hidden slide' }, 'H') : '');
    const cv = el('div', { class: 'sort-cv' });
    cv.appendChild(P.thumbNode(s, 300 / P.SW()));
    it.appendChild(cap); it.appendChild(cv);
    it.addEventListener('click', () => { P.selectSlide(i); });
    it.addEventListener('dblclick', () => { P.selectSlide(i); P.setViewApp('normal'); });
    it.addEventListener('contextmenu', e => { e.preventDefault(); P.selectSlide(i); P.slideCtxMenu(e, i); });
    it.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-sort', String(i)); e.dataTransfer.effectAllowed = 'move'; it.classList.add('dragging'); });
    it.addEventListener('dragend', () => it.classList.remove('dragging'));
    it.addEventListener('dragover', e => { e.preventDefault(); it.classList.add('drop-hint'); });
    it.addEventListener('dragleave', () => it.classList.remove('drop-hint'));
    it.addEventListener('drop', e => {
      e.preventDefault(); it.classList.remove('drop-hint');
      const from = parseInt(e.dataTransfer.getData('text/x-sort'));
      if (!isNaN(from)) { P.moveSlide(from, i + (from < i ? 1 : 0)); renderSorter(); }
    });
    host.appendChild(it);
  });
};

/* ==========================================================================
   SLIDESHOW — fullscreen engine: transitions, animation steps, kiosk loop
   ========================================================================== */
let show = null; // {root, host, idx, queue, animPtr, order[], advTimer}
function showOrder() {
  const ss = P.state.showSetup || { from: 1, to: 0 };
  const n = P.state.slides.length;
  const from = clamp((ss.from || 1) - 1, 0, n - 1);
  const to = ss.to ? clamp(ss.to - 1, from, n - 1) : n - 1;
  const order = [];
  for (let i = from; i <= to; i++) if (!P.state.slides[i].hidden) order.push(i);
  if (!order.length) order.push(from);
  return order;
}
function showScale() {
  const root = $('#show-root');
  const pad = 0;
  return Math.min((root.clientWidth - pad) / P.SW(), (root.clientHeight - pad) / P.SH());
}
function makeShowSlideNode(i) {
  const sc = showScale();
  const holder = el('div', { class: 'show-slide' });
  const inner = el('div', { class: 'show-slide-inner', style: `width:${P.SW()}px;height:${P.SH()}px;transform:scale(${sc});transform-origin:0 0;background:#fff;box-shadow:0 0 18px rgba(0,0,0,.55)` });
  P.renderSlideInto(inner, P.state.slides[i], { noSel: true });
  holder.appendChild(inner);
  return { holder, inner };
}
window.startSlideShow = function startSlideShow(fromIdx) {
  if (P.editing) P.endEdit(true);
  P.closeAllPops(); P.closeCtxMenu();
  const root = $('#show-root');
  root.hidden = false;
  root.innerHTML = '';
  const order = showOrder();
  let pos = fromIdx ? Math.max(0, order.indexOf(clamp(fromIdx, 0, P.state.slides.length - 1))) : 0;
  if (pos < 0) pos = 0;
  const host = el('div', { class: 'show-stage' });
  root.appendChild(host);
  const tb = el('div', { class: 'show-tb' },
    el('button', { title: 'Previous', class: 'show-tb-btn' }, '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 4 L7 12 L15 20" stroke="#ccc" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>'),
    el('button', { title: 'Next', class: 'show-tb-btn' }, '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 4 L17 12 L9 20" stroke="#ccc" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>'),
    el('button', { title: 'End Show (Esc)', class: 'show-tb-btn' }, '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="#ccc" stroke-width="2"/></svg>'));
  root.appendChild(tb);
  show = { root, host, order, pos, animQueue: [], animPtr: 0, ended: false, advTimer: 0, busy: false, inner: null };
  const [bPrev, bNext, bEnd] = tb.querySelectorAll('button');
  bPrev.addEventListener('click', e => { e.stopPropagation(); stepBack(); });
  bNext.addEventListener('click', e => { e.stopPropagation(); stepFwd(); });
  bEnd.addEventListener('click', e => { e.stopPropagation(); endShow(); });
  // first slide, no transition
  showSlideAt(order[pos], null);
  root.addEventListener('click', () => { if (!show) return; if (show.ended) return endShow(); stepFwd(); });
  document.addEventListener('keydown', showKey, true);
  document.addEventListener('fullscreenchange', onFsChange);
  (root.requestFullscreen && root.requestFullscreen().catch(() => { })) || undefined;
};
function onFsChange() {
  if (!document.fullscreenElement && show) endShow();
}
function showKey(e) {
  if (!show) return;
  const k = e.key;
  if (['ArrowRight', ' ', 'PageDown', 'Enter', 'ArrowLeft', 'PageUp', 'Backspace', 'Escape', 'Home', 'End', 'n', 'N', 'p', 'P'].includes(k)) {
    e.preventDefault(); e.stopPropagation();
  }
  if (k === 'Escape') return endShow();
  if (k === 'Home') return jumpShow(0);
  if (k === 'End') return jumpShow(-1);
  if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace' || k === 'p' || k === 'P') return stepBack();
  stepFwd();
}
function jumpShow(which) {
  if (!show || show.busy) return;
  pos = which === -1 ? show.order.length - 1 : 0;
  show.animPtr = 0;
  showSlideAt(show.order[pos], null);
}
function clearAdvTimer() { if (show && show.advTimer) { clearTimeout(show.advTimer); show.advTimer = 0; } }
function armAdvance(slide) {
  clearAdvTimer();
  const tr = slide.transition;
  if (tr && tr.advAfter && +tr.advAfter > 0) {
    show.advTimer = setTimeout(() => stepFwd(), (+tr.advAfter) * 1000 + ((tr.dur || 0.7) * 1000));
  }
}
function consumeShowPending() {
  if (!show || !show.pending) return;
  const p = show.pending; show.pending = null;
  if (p === 'back') stepBack(); else stepFwd();
}
async function showSlideAt(i, prevInner) {
  if (!show) return;
  clearAdvTimer();
  const { holder, inner } = makeShowSlideNode(i);
  show.inner = inner;
  show.holder = holder;
  if (prevInner) {
    show.busy = true;
    show.host.appendChild(holder);
    const tr = P.state.slides[i].transition;
    await P.playTransition(show.host, holder, prevInner.parentNode, tr && tr.kind !== 'none' ? tr : null, showScale());
    if (!show) return; // show was ended mid-transition (Esc)
    prevInner.parentNode && prevInner.parentNode.remove();
    show.busy = false;
  } else {
    show.host.appendChild(holder);
  }
  // hide entrance animations
  const slide = P.state.slides[i];
  show.animQueue = [...(slide.anims || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  show.animPtr = 0;
  show.animQueue.forEach(a => {
    if (a.cat === 'in') { const d = inner.querySelector(`.obj[data-oid="${a.obj}"]`); if (d) d.style.opacity = 0; }
  });
  armAdvance(slide);
}
async function playAnimBatch(from) {
  // play anim from index `from`, chaining with/after
  let i = from;
  const q = show.animQueue;
  const runOne = async a => {
    if (!show || !show.inner) return;
    const d = show.inner.querySelector(`.obj[data-oid="${a.obj}"]`);
    if (!d) return;
    if (a.cat === 'in') d.style.opacity = 1;
    await new Promise(r => setTimeout(r, a.delay || 0));
    if (!show) return;
    await P.playAnim(d, a);
    if (!show) return;
    if (a.cat === 'out') d.style.opacity = 0;
  };
  const first = q[i];
  const group = [first];
  i++;
  while (i < q.length && q[i].start === 'with') { group.push(q[i]); i++; }
  await Promise.all(group.map(runOne));
  while (i < q.length && q[i].start === 'after' && q[i]._played !== true) {
    if (q[i].start !== 'after') break;
    q[i]._played = true;
    await runOne(q[i]);
    const j = i + 1;
    while (j < q.length && q[j].start === 'with') { q[j]._played = true; await runOne(q[j]); i = j; }
    i++;
  }
  return i;
}
async function stepFwd() {
  if (!show) return;
  if (show.busy) { show.pending = 'fwd'; return; } // like PowerPoint: pressing advance mid-transition queues it
  if (show.ended) return endShow();
  clearAdvTimer();
  if (show.animPtr < show.animQueue.length) {
    show.busy = true;
    show.animPtr = await playAnimBatch(show.animPtr);
    if (!show) return;
    show.busy = false;
    const slide = P.state.slides[show.order[show.pos]];
    if (show.animPtr >= show.animQueue.length) armAdvance(slide);
    consumeShowPending();
    return;
  }
  if (show.pos >= show.order.length - 1) {
    const ss = P.state.showSetup;
    if (ss && (ss.loop || ss.type === 'kiosk')) return jumpShow(0);
    return showEndCard();
  }
  show.pos++;
  const prevInner = show.inner;
  await showSlideAt(show.order[show.pos], prevInner);
  consumeShowPending();
}
async function stepBack() {
  if (!show) return;
  if (show.busy) { show.pending = 'back'; return; }
  clearAdvTimer();
  if (show.ended) { // back to last slide
    show.ended = false;
    show.root.querySelector('.show-endcard') && show.root.querySelector('.show-endcard').remove();
    show.animPtr = show.animQueue.length;
    showSlideAt(show.order[show.pos], null);
    return;
  }
  if (show.animPtr > 0) { show.animPtr = 0; showSlideAt(show.order[show.pos], null); return; }
  if (show.pos > 0) {
    show.pos--;
    show.animPtr = (show.animQueue || []).length;
    showSlideAt(show.order[show.pos], null);
    const slide = P.state.slides[show.order[show.pos]];
    show.animQueue = [...(slide.anims || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    show.animPtr = show.animQueue.length;
  }
}
function showEndCard() {
  show.ended = true;
  const card = el('div', { class: 'show-endcard' }, 'End of slide show, click to exit.');
  show.root.appendChild(card);
}
function endShow() {
  if (!show) return;
  clearAdvTimer();
  document.removeEventListener('keydown', showKey, true);
  document.removeEventListener('fullscreenchange', onFsChange);
  const root = $('#show-root');
  root.hidden = true;
  root.innerHTML = '';
  show = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  P.renderAll();
  $('#stage').focus();
}
P.startSlideShowApp = window.startSlideShow;
P.endShowApp = endShow;

/* ==========================================================================
   READING VIEW
   ========================================================================== */
let reading = null;
window.startReading = function startReading() {
  if (P.editing) P.endEdit(true);
  const root = $('#reading-root');
  root.hidden = false;
  root.innerHTML = '';
  const i0 = P.state.active;
  const stage = el('div', { class: 'r-stage' });
  const bar = el('div', { class: 'rbar' },
    el('button', { class: 'r-btn', title: 'Previous slide' }, '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M15 4 L7 12 L15 20" stroke="#EDEDED" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>'),
    el('span', { class: 'r-count' }, ''),
    el('button', { class: 'r-btn', title: 'Next slide' }, '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M9 4 L17 12 L9 20" stroke="#EDEDED" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>'),
    el('span', { style: 'flex:1' }, ''),
    el('span', { style: 'opacity:.75' }, 'Press Esc to exit reading view'));
  root.appendChild(stage); root.appendChild(bar);
  reading = { root, stage, i: i0 };
  const render = () => {
    stage.innerHTML = '';
    const n = P.state.slides.length;
    reading.i = clamp(reading.i, 0, n - 1);
    const sc = Math.min((innerWidth - 8) / P.SW(), (innerHeight - 42) / P.SH());
    const inner = el('div', { style: `width:${P.SW()}px;height:${P.SH()}px;transform:scale(${sc});transform-origin:0 0;background:#fff;box-shadow:0 0 20px rgba(0,0,0,.6)` });
    P.renderSlideInto(inner, P.state.slides[reading.i], { noSel: true });
    stage.appendChild(inner);
    bar.querySelector('.r-count').textContent = `Slide ${reading.i + 1} of ${n}`;
  };
  const [prev, next] = bar.querySelectorAll('button');
  const fwd = () => {
    let i = reading.i + 1;
    while (i < P.state.slides.length && P.state.slides[i].hidden) i++;
    if (i < P.state.slides.length) { reading.i = i; render(); }
  };
  const back = () => {
    let i = reading.i - 1;
    while (i >= 0 && P.state.slides[i].hidden) i--;
    if (i >= 0) { reading.i = i; render(); }
  };
  prev.addEventListener('click', back);
  next.addEventListener('click', fwd);
  stage.addEventListener('click', fwd);
  const key = e => {
    if (e.key === 'Escape') { endReading(); }
    else if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); fwd(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); back(); }
  };
  document.addEventListener('keydown', key, true);
  reading.key = key;
  render();
};
function endReading() {
  if (!reading) return;
  document.removeEventListener('keydown', reading.key, true);
  P.state.active = reading.i;
  reading.root.hidden = true;
  reading.root.innerHTML = '';
  reading = null;
  P.renderAll();
}
P.endReadingApp = endReading;
P.isReading = () => !!reading;
})();
