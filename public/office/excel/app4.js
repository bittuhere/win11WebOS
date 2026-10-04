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
   app4.js — dialogs | backstage | save/load | templates | tell-me | boot glue
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
const toast = m => X.toast(m);

/* small dialog field helpers */
function fld(labelText, input) {
  const f = el('div', { class: 'fld' });
  f.innerHTML = `<span>${esc(labelText)}</span>`;
  f.appendChild(input);
  return f;
}
function txtInp(val, w) { const i = el('input', { type: 'text', value: val == null ? '' : val }); if (w) i.style.width = w + 'px'; return i; }
/* all dialogs use the custom Excel-themed components (no native <select>/checkbox/spinner) */
function numInp(val, w) { return X.cSpin(val, w); }
function selInp(opts, val) { return X.cSelect(opts, val); }
function chkLbl(label, checked) { return X.cCheck(label, checked); }
function colorInp(val) { return X.cColorBtn(val); }
function parseRangeOrNull(str) {
  const m = String(str || '').trim().match(/^(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?$/);
  if (!m) return null;
  const a = Calc.parseRef(m[1].replace(/\$/g, '')), b = m[2] ? Calc.parseRef(m[2].replace(/\$/g, '')) : a;
  if (!a || !b) return null;
  return { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
}

/* ==========================================================================
   INSERT / DELETE DIALOGS
   ========================================================================== */
X.insertDialog = function () {
  const n = X.normSel(), s = state.sel;
  if (s.type === 'rows') { X.insertRowsAt(n.r1, n.r2 - n.r1 + 1); return; }
  if (s.type === 'cols') { X.insertColsAt(n.c1, n.c2 - n.c1 + 1); return; }
  const body = el('div', { class: 'fmtc-radio' });
  const opts = [
    ['right', 'Shift cells right'], ['down', 'Shift cells down'],
    ['row', 'Entire row'], ['col', 'Entire column'],
  ];
  const radios = opts.map(([v, lab], i) => {
    const l = el('label');
    const r = el('input', { type: 'radio', name: 'insop', value: v });
    if (i === 1) r.checked = true;
    l.appendChild(r); l.appendChild(document.createTextNode(lab));
    body.appendChild(l);
    return r;
  });
  X.dlg({
    title: 'Insert', body, width: 250,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const v = radios.find(r => r.checked).value;
        if (v === 'row') X.insertRowsAt(n.r1, n.r2 - n.r1 + 1);
        else if (v === 'col') X.insertColsAt(n.c1, n.c2 - n.c1 + 1);
        else X.insertCells(n, v);
      }
    }, { label: 'Cancel' }],
  });
};
X.deleteDialog = function () {
  const n = X.normSel(), s = state.sel;
  if (s.type === 'rows') { X.deleteRowsAt(n.r1, n.r2 - n.r1 + 1); return; }
  if (s.type === 'cols') { X.deleteColsAt(n.c1, n.c2 - n.c1 + 1); return; }
  const body = el('div', { class: 'fmtc-radio' });
  const opts = [
    ['left', 'Shift cells left'], ['up', 'Shift cells up'],
    ['row', 'Entire row'], ['col', 'Entire column'],
  ];
  const radios = opts.map(([v, lab], i) => {
    const l = el('label');
    const r = el('input', { type: 'radio', name: 'delop', value: v });
    if (i === 1) r.checked = true;
    l.appendChild(r); l.appendChild(document.createTextNode(lab));
    body.appendChild(l);
    return r;
  });
  X.dlg({
    title: 'Delete', body, width: 250,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const v = radios.find(r => r.checked).value;
        if (v === 'row') X.deleteRowsAt(n.r1, n.r2 - n.r1 + 1);
        else if (v === 'col') X.deleteColsAt(n.c1, n.c2 - n.c1 + 1);
        else X.deleteCells(n, v);
      }
    }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   SORT DIALOG (multi-level)
   ========================================================================== */
X.sortDialog = function () {
  const rg = X.regionUsed();
  if (!rg || rg.r2 - rg.r1 + 1 < 2) { X.msgBox('Microsoft Excel', 'To sort, select a range with at least two rows of data.', { icon: 'warn' }); return; }
  const hasHead = X.colHasHeader(rg);
  const colNameOf = c => {
    if (hasHead) { const d = X.cellDisplay(rg.r1, c); if (d && d.text) return d.text; }
    return 'Column ' + Calc.idxToCol(c);
  };
  const keys = [{ c: rg.c1, dir: 1 }];
  const body = el('div', { style: 'min-width:430px' });
  const hdrCk = chkLbl('My data has headers', hasHead);
  hdrCk.style.marginBottom = '8px';
  body.appendChild(hdrCk);
  const list = el('div', { style: 'display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto' });
  body.appendChild(list);
  function renderKeys() {
    list.innerHTML = '';
    const cols = [];
    for (let c = rg.c1; c <= rg.c2; c++) cols.push(c);
    keys.forEach((k, i) => {
      const row = el('div', { style: 'display:flex;gap:6px;align-items:center;font-size:12px' });
      row.appendChild(el('span', { style: 'color:var(--txt-3);min-width:56px;font-size:11.5px' }, i === 0 ? 'Sort by' : 'Then by'));
      const sel = selInp(cols.map(c => [String(c), colNameOf(c)]), String(k.c));
      sel.style.flex = '1';
      sel.addEventListener('change', () => { k.c = +sel.value; });
      const dirSel = selInp([['1', 'Smallest to Largest'], ['-1', 'Largest to Smallest']], String(k.dir));
      dirSel.addEventListener('change', () => { k.dir = +dirSel.value; });
      const del = el('button', { class: 'btn', style: 'min-width:26px;padding:0 6px', title: 'Delete level' }, '×');
      del.disabled = keys.length === 1;
      del.addEventListener('click', () => { if (keys.length > 1) { keys.splice(i, 1); renderKeys(); } });
      row.appendChild(sel); row.appendChild(dirSel); row.appendChild(del);
      list.appendChild(row);
    });
  }
  renderKeys();
  const addBtn = el('button', { class: 'btn', style: 'margin-top:8px;font-size:11.5px' }, '+ Add Level');
  addBtn.addEventListener('click', () => { keys.push({ c: keys[keys.length - 1].c, dir: 1 }); renderKeys(); });
  body.appendChild(addBtn);
  hdrCk.cb.addEventListener('change', renderKeys);
  X.dlg({
    title: 'Sort', body, width: 500,
    buttons: [
      { label: 'OK', pri: true, fn: () => { X.sortRange(rg, keys.map(k => ({ c: k.c, dir: k.dir })), hdrCk.cb.checked); X.focusGrid(); } },
      { label: 'Cancel' },
    ],
  });
};

/* ==========================================================================
   SERIES DIALOG
   ========================================================================== */
X.seriesDialog = function () {
  const n = X.normSel(), s = state.sel;
  if (s.type !== 'cell' && !s.ranges.length) {}
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:340px' });
  const dirRow = el('div', { style: 'display:flex;gap:16px;font-size:12px' });
  const rC = el('input', { type: 'radio', name: 'serdir', value: 'c' }); rC.checked = true;
  const rR = el('input', { type: 'radio', name: 'serdir', value: 'r' });
  dirRow.appendChild(Object.assign(el('label', null, ''), { }));
  dirRow.children[0].appendChild(rC); dirRow.children[0].appendChild(document.createTextNode('Down (columns)'));
  dirRow.appendChild(el('label')); dirRow.children[1].appendChild(rR); dirRow.children[1].appendChild(document.createTextNode('Across (rows)'));
  body.appendChild(fldWrap('Series in', dirRow));
  const typSel = selInp([['linear', 'Linear'], ['growth', 'Growth'], ['date', 'Date (days)']], 'linear');
  body.appendChild(fld('Type', typSel));
  const stepInp = numInp(1, 90);
  body.appendChild(fld('Step value', stepInp));
  const stopInp = txtInp('', 90);
  body.appendChild(fld('Stop value (optional)', stopInp));
  X.dlg({
    title: 'Series', body, width: 380,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const dir = rR.checked ? 'r' : 'c';
        const typ = typSel.value;
        const step = parseFloat(stepInp.value) || 1;
        const stop = stopInp.value === '' ? null : parseFloat(stopInp.value);
        X.pushUndo('Fill Series');
        const sh = sheet();
        // seeds: first col (dir c) or first row
        const seedR = n.r1, seedC = n.c1;
        let v0 = X.cellRaw(seedR, seedC);
        if (typeof v0 !== 'number') v0 = parseFloat(v0) || 1;
        const cnt = dir === 'c' ? n.r2 - n.r1 : n.c2 - n.c1;
        for (let i = 0; i <= cnt; i++) {
          const r = dir === 'c' ? n.r1 + i : n.r1;
          const c = dir === 'c' ? n.c1 : n.c1 + i;
          let v;
          if (i === 0) v = v0;
          else if (typ === 'linear') v = v0 + step * i;
          else if (typ === 'growth') v = v0 * Math.pow(step, i);
          else v = v0 + step * i; // date serial steps
          if (stop != null && ((step >= 0 && v > stop) || (step < 0 && v < stop))) break;
          const cd = X.cellEnsure(r, c);
          cd.v = String(+v.toFixed(10)); cd.t = 'n'; cd.num = v;
          if (typ === 'date' && !cd.f) cd.f = 'mm/dd/yyyy';
        }
        X.scheduleRecalc(); X.markDirty(); X.afterSelChange();
      }
    }, { label: 'Cancel' }],
  });

  function fldWrap(t, e2) { const d = el('div'); d.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2);margin-bottom:4px' }, t)); d.appendChild(e2); return d; }
};

/* ==========================================================================
   SUBTOTAL DIALOG
   ========================================================================== */
X.subtotalDialog = function () {
  const rg = X.regionUsed();
  if (!rg || rg.r2 - rg.r1 < 1) { X.msgBox('Microsoft Excel', 'Select a list with headers and multiple rows before adding subtotals.', { icon: 'warn' }); return; }
  const cols = [];
  for (let c = rg.c1; c <= rg.c2; c++) {
    const d = X.cellDisplay(rg.r1, c);
    cols.push([String(c), d && d.text ? d.text : 'Column ' + Calc.idxToCol(c)]);
  }
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:330px' });
  const atSel = selInp(cols, String(rg.c1));
  body.appendChild(fld('At each change in', atSel));
  const fnSel = selInp([['9', 'Sum'], ['1', 'Average'], ['2', 'Count (numbers)'], ['3', 'Count'], ['4', 'Max'], ['5', 'Min']], '9');
  body.appendChild(fld('Use function', fnSel));
  const addWrap = el('div', { style: 'display:flex;flex-direction:column;gap:4px' });
  addWrap.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2)' }, 'Add subtotal to'));
  const addCbs = cols.map(([c, lab]) => { const l = chkLbl(lab, +c === rg.c2); addWrap.appendChild(l); return [+c, l.cb]; });
  body.appendChild(addWrap);
  X.dlg({
    title: 'Subtotal', body, width: 400,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const gcol = +atSel.value;
        const datCols = addCbs.filter(([, cb]) => cb.checked).map(([c]) => c);
        if (!datCols.length) { X.msgBox('Microsoft Excel', 'Check at least one column to subtotal.', { icon: 'warn' }); return false; }
        X.pushUndo('Subtotal');
        const sh = sheet();
        const hdr = c => { const d = X.cellDisplay(rg.r1, c); return d && d.text ? d.text : Calc.idxToCol(c); };
        const fnName = { '9': 'SUM', '1': 'AVERAGE', '2': 'COUNT', '3': 'COUNTA', '4': 'MAX', '5': 'MIN' }[fnSel.value];
        // gather group boundaries (working bottom-up so row inserts stay valid)
        const groups = [];
        let start = rg.r1 + 1, lastVal = X.cellRaw(rg.r1 + 1, gcol);
        for (let r = rg.r1 + 2; r <= rg.r2 + 1; r++) {
          const v = r <= rg.r2 ? X.cellRaw(r, gcol) : '__END__';
          if (v !== lastVal) { groups.push({ s: start, e: r - 1, val: lastVal }); start = r; lastVal = v; }
        }
        // remove existing subtotal rows first: skip (fresh use expected)
        let inserted = 0;
        for (const g of groups) {
          if (g === groups[groups.length - 1]) continue;
          const at = g.e + 1 + inserted;
          X.insertRowsAt(at, 1);
          const d = X.cellEnsure(at, gcol);
          d.v = (g.val == null || g.val === '' ? '' : String(g.val)) + ' Total'; d.t = 's';
          const ds = d.s = d.s || {}; ds.b = true;
          for (const c2 of datCols) {
            if (c2 === gcol) continue;
            const fcd = X.cellEnsure(at, c2);
            fcd.v = `=${fnName}(${a1(g.s + inserted, c2)}:${a1(g.e + inserted, c2)})`; fcd.t = 'f';
            fcd.s = fcd.s || {}; fcd.s.b = true;
          }
          inserted++;
        }
        // grand total
        const gAt = rg.r2 + 1 + inserted;
        X.insertRowsAt(gAt, 1);
        const gd = X.cellEnsure(gAt, gcol);
        gd.v = 'Grand Total'; gd.t = 's'; gd.s = { b: true };
        for (const c2 of datCols) {
          if (c2 === gcol) continue;
          const fcd = X.cellEnsure(gAt, c2);
          fcd.v = `=${fnName}(${a1(rg.r1 + 1, c2)}:${a1(gAt - 1, c2)})`; fcd.t = 'f';
          fcd.s = { b: true };
        }
        X.scheduleRecalc(); X.markDirty(); X.afterSelChange();
        X.sbMsg('Subtotals added (rows are inserted at each change of "' + hdr(gcol) + '")');
      }
    }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   TEXT TO COLUMNS
   ========================================================================== */
X.textToColsDialog = function () {
  const n = X.normSel();
  if (n.c1 !== n.c2) { X.msgBox('Microsoft Excel', 'Select a single column of data for Text to Columns.', { icon: 'warn' }); return; }
  const c = n.c1;
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:360px' });
  body.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2)' }, 'Choose the delimiters that split your text:'));
  const dbox = el('div', { style: 'display:flex;gap:14px;flex-wrap:wrap' });
  const dels = [['tab', 'Tab', false], ['semi', 'Semicolon', false], ['comma', 'Comma', true], ['space', 'Space', false], ['other', 'Other:', false]];
  const dCbs = dels.map(([k, lab, on]) => { const l = chkLbl(lab, on); dbox.appendChild(l); return [k, l.cb]; });
  const otherInp = txtInp('', 30);
  dbox.appendChild(otherInp);
  body.appendChild(dbox);
  body.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2)' }, 'Data preview'));
  const prev = el('div', { style: 'border:1px solid var(--field-b);max-height:170px;overflow:auto;background:#fff' });
  body.appendChild(prev);
  const destInp = txtInp(a1(n.r1, n.c1), 90);
  body.appendChild(fld('Destination', destInp));
  function split(txt, dstr) {
    if (dstr.includes('other') && otherInp.value) {
      const ch = otherInp.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      dstr = dstr.filter(d => d !== 'other');
      if (dstr.length) return txt.split(new RegExp(`[${dstr.map(d => ({ tab: '\\t', semi: ';', comma: ',', space: ' ' })[d]).map(x => x === ' ' ? ' ' : '\\' + x).join('')}${ch}]`));
      return txt.split(new RegExp(ch));
    }
    if (!dstr.length) return [txt];
    const rx = new RegExp('[' + dstr.map(d => ({ tab: '\\t', semi: ';', comma: ',', space: ' ' })[d]).join('') + ']');
    return txt.split(rx);
  }
  function renderPrev() {
    const dstr = dCbs.filter(([, cb]) => cb.checked).map(([k]) => k);
    let html = '<table style="border-collapse:collapse;font-size:11.5px">';
    for (let r = n.r1; r <= Math.min(n.r1 + 7, X.usedR2()); r++) {
      const d = X.cellDisplay(r, c);
      if (!d) continue;
      const parts = split(d.text, dstr);
      html += '<tr>' + parts.map(p => `<td style="border:1px solid #D8D8D8;padding:2px 7px;white-space:pre">${esc(p)}</td>`).join('') + '</tr>';
    }
    prev.innerHTML = html + '</table>';
  }
  dCbs.forEach(([, cb]) => cb.addEventListener('change', renderPrev));
  otherInp.addEventListener('input', renderPrev);
  renderPrev();
  X.dlg({
    title: 'Convert Text to Columns Wizard', body, width: 440,
    buttons: [{
      label: 'Finish', pri: true, fn: () => {
        const dstr = dCbs.filter(([, cb]) => cb.checked).map(([k]) => k);
        if (!dstr.length && !otherInp.value) { X.msgBox('Microsoft Excel', 'Choose at least one delimiter.', { icon: 'warn' }); return false; }
        const dest = parseRangeOrNull(destInp.value);
        if (!dest) { X.msgBox('Microsoft Excel', 'The destination reference is not valid.', { icon: 'warn' }); return false; }
        X.pushUndo('Text to Columns');
        const sh = sheet();
        for (let r = n.r1; r <= X.usedR2(); r++) {
          const cd = X.cellGet(r, c);
          if (!cd || cd.v == null || cd.v === '') continue;
          const d = X.cellDisplay(r, c);
          const parts = split(d.text, dstr);
          const baseC = dest.c1, baseR = dest.r1 + (r - n.r1);
          // clear source col (matches Excel) then write parts
          for (let i = 0; i < parts.length; i++) {
            const tc = baseC + i, tr = baseR;
            const tcd = X.cellEnsure(tr, tc);
            tcd.v = null; tcd.t = 's'; tcd.num = null;
            const pin = X.parseInput(parts[i]);
            /* same contract as commitCell: v = raw text, num = parsed value
               (pin.v does not exist — the old code blanked every text token!) */
            if (pin.t !== 'empty') {
              tcd.v = parts[i];
              if (pin.t === 'f') tcd.t = 'f';
              else { tcd.t = pin.t; tcd.num = pin.num; }
              if (pin.f && (!tcd.f || tcd.f === 'General')) tcd.f = pin.f;
            }
          }
          /* Excel semantics: splitting INTO the origin replaces it with part[0];
             splitting ELSEWHERE clears the original. The old code deleted the
             freshly-written part[0] even in the same-origin case. */
          if (baseR !== r || baseC !== c) X.cellDelete(r, c);
        }
        X.scheduleRecalc(); X.markDirty(); X.afterSelChange();
        X.sbMsg('Text split into columns');
      }
    }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   DATA VALIDATION DIALOG
   ========================================================================== */
X.dataValDialog = function () {
  const n = X.normSel(), sh = sheet();
  const kinds = [['any', 'Any value'], ['whole', 'Whole number'], ['decimal', 'Decimal'], ['list', 'List'], ['date', 'Date'], ['textlen', 'Text length']];
  const ops = [['between', 'between'], ['not between', 'not between'], ['=', 'equal to'], ['<>', 'not equal to'], ['>', 'greater than'], ['<', 'less than'], ['>=', 'greater than or equal to'], ['<=', 'less than or equal to']];
  const cur = (sh.validations || []).find(v => !(n.r2 < v.r1 || n.r1 > v.r2 || n.c2 < v.c1 || n.c1 > v.c2));
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:330px' });
  const kindSel = selInp(kinds, cur ? cur.kind : 'any');
  body.appendChild(fld('Allow', kindSel));
  const opSel = selInp(ops, cur ? (cur.op || 'between') : 'between');
  body.appendChild(fld('Data', opSel));
  const minInp = txtInp(cur && cur.min != null ? cur.min : '');
  const maxInp = txtInp(cur && cur.max != null ? cur.max : '');
  const listInp = txtInp(cur && cur.list ? cur.list : '');
  body.appendChild(fld('Minimum', minInp));
  body.appendChild(fld('Maximum', maxInp));
  const listWrap = fld('Source (comma-separated or range)', listInp);
  body.appendChild(listWrap);
  const errCk = chkLbl('Show error alert when invalid data is entered', true);
  body.appendChild(errCk);
  function syncVis() {
    const k = kindSel.value;
    listWrap.style.display = k === 'list' ? '' : 'none';
    const mm = k !== 'any' && k !== 'list';
    $$('.fld input', body).forEach(x => {});
    // toggle min/max visibility via parent .fld
    minInp.closest('.fld').style.display = mm ? '' : 'none';
    maxInp.closest('.fld').style.display = mm && (opSel.value === 'between' || opSel.value === 'not between') ? '' : 'none';
    opSel.closest('.fld').style.display = mm ? '' : 'none';
  }
  kindSel.addEventListener('change', syncVis);
  opSel.addEventListener('change', syncVis);
  syncVis();
  const vButtons = [
    {
      label: 'OK', pri: true, fn: () => {
        X.pushUndo('Data Validation');
        sh.validations = (sh.validations || []).filter(v => v !== cur);
        const k = kindSel.value;
        if (k !== 'any') {
          sh.validations.push({
            r1: n.r1, r2: n.r2, c1: n.c1, c2: n.c2,
            kind: k, op: opSel.value,
            min: minInp.value, max: maxInp.value,
            list: k === 'list' ? listInp.value : null,
            showErr: errCk.cb.checked,
          });
        }
        X.markDirty();
        X.sbMsg(k === 'any' ? 'Validation cleared for the selection' : 'Data validation applied to the selection');
      }
    },
  ];
  if (cur) vButtons.push({ label: 'Clear All', fn: () => { X.pushUndo('Clear Validation'); sh.validations = sh.validations.filter(v => v !== cur); X.markDirty(); X.sbMsg('Validation cleared'); } });
  vButtons.push({ label: 'Cancel' });
  X.dlg({ title: 'Data Validation', body, width: 400, buttons: vButtons });
};

/* ==========================================================================
   PROTECT SHEET
   ========================================================================== */
X.protectDialog = function () {
  if (state.protected) {
    // unprotect
    const body = el('div');
    const inp = el('input', { type: 'password', placeholder: 'Password (if any)' });
    body.appendChild(fld('Password', inp));
    X.dlg({
      title: 'Unprotect Sheet', body, width: 300,
      buttons: [{
        label: 'OK', pri: true, fn: () => {
          if (state.protectPw && inp.value !== state.protectPw) { X.msgBox('Microsoft Excel', 'The password you supplied is not correct.', { icon: 'warn' }); return false; }
          state.protected = false; state.protectPw = '';
          X.updateProtectUI();
          X.sbMsg('Sheet unprotected');
        }
      }, { label: 'Cancel' }],
    });
    return;
  }
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:320px' });
  const pwInp = el('input', { type: 'password', placeholder: '(optional)' });
  body.appendChild(fld('Password to unprotect sheet', pwInp));
  body.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2)' }, 'Allow all users of this worksheet to:'));
  const allow = [chkLbl('Select locked cells', true), chkLbl('Select unlocked cells', true), chkLbl('Insert columns', false), chkLbl('Insert rows', false), chkLbl('Delete columns', false), chkLbl('Delete rows', false)];
  allow.forEach(l => body.appendChild(l));
  X.dlg({
    title: 'Protect Sheet', body, width: 380,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        state.protected = true;
        state.protectPw = pwInp.value || '';
        X.updateProtectUI();
        X.sbMsg('Sheet protected — editing is locked');
      }
    }, { label: 'Cancel' }],
  });
};
X.updateProtectUI = function () {
  document.body.classList.toggle('protected', state.protected);
  X.sbMode(state.protected ? 'Protected' : 'Ready');
  const pb = $('[data-cmd="protect"]');
  if (pb) {
    const tt = state.protected ? 'Unprotect Sheet' : 'Protect Sheet';
    pb.setAttribute('title', tt);
    const lab = pb.querySelector('.rb-lab, .rsm-lab');
    if (lab) lab.textContent = tt.replace(' Sheet', '\nSheet');
  }
  const prot2 = $('#rp-review [data-cmd="protect"]');
};

/* ==========================================================================
   ZOOM DIALOG
   ========================================================================== */
X.zoomDialog = function () {
  const cur = Math.round(state.zoom * 100);
  const body = el('div', { class: 'fmtc-radio' });
  const presets = [200, 100, 75, 50, 25];
  let custom;
  presets.forEach(p => {
    const l = el('label');
    const r = el('input', { type: 'radio', name: 'zoomop', value: String(p) });
    if (cur === p) r.checked = true;
    l.appendChild(r); l.appendChild(document.createTextNode(p + '%'));
    body.appendChild(l);
  });
  const lf = el('label');
  const rf = el('input', { type: 'radio', name: 'zoomop', value: 'fit' });
  lf.appendChild(rf); lf.appendChild(document.createTextNode('Fit selection'));
  body.appendChild(lf);
  const lc = el('label');
  const rc = el('input', { type: 'radio', name: 'zoomop', value: 'custom' });
  if (!presets.includes(cur)) rc.checked = true;
  lc.appendChild(rc); lc.appendChild(document.createTextNode('Custom: '));
  custom = numInp(cur, 60); custom.min = 40; custom.max = 200;
  lc.appendChild(custom); lc.appendChild(document.createTextNode(' %'));
  body.appendChild(lc);
  custom.addEventListener('focus', () => { rc.checked = true; });
  X.dlg({
    title: 'Zoom', body, width: 230,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const v = body.querySelector('input[name="zoomop"]:checked').value;
        if (v === 'fit') { X.CMDS.zoomsel.exec(); return; }
        const p = v === 'custom' ? clamp(parseInt(custom.value) || 100, 40, 200) : +v;
        X.setZoom(p / 100);
      }
    }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   SYMBOL DIALOG
   ========================================================================== */
X.symbolDialog = function () {
  const sets = {
    'Currency': '¢ £ ¥ € ₹ ₽ ₩ ₪ $',
    'Math': '± × ÷ ¼ ½ ¾ ² ³ µ ∞ ≈ ≠ ≤ ≥ ± ∑ ∏ √ ∫ ∆ π',
    'Greek': 'α β γ δ ε ζ η θ λ μ ν ξ π ρ σ τ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω',
    'Arrows': '← ↑ → ↓ ↔ ↕ ⇒ ⇐ ⇔ ▲ ▼ ◀ ▶',
    'Symbols': '© ® ™ ° § ¶ † ‡ • … ‰ ′ ″ ‹ › « » ¡ ¿',
    'Latin': 'À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý Þ ß à á â ã ä å æ ç è é ê ë ì í î ï ñ ò ó ô õ ö ø ù ú û ü ý þ ÿ',
  };
  const body = el('div', { style: 'min-width:430px' });
  const tabsRow = el('div', { style: 'display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap' });
  const grid = el('div', { class: 'sym-grid' });
  let picked = null;
  const recent = JSON.parse(XKV.get('xc.syms') || '[]');
  function render(set) {
    grid.innerHTML = '';
    const chars = set === 'Recent' ? recent : sets[set].split(' ');
    chars.forEach(ch => {
      const b = el('button', { class: 'sym-cell' }, ch);
      b.addEventListener('click', () => { picked = ch; $$('.sym-cell', grid).forEach(x => x.classList.toggle('on', x === b)); });
      b.addEventListener('dblclick', () => { picked = ch; insert(); });
      grid.appendChild(b);
    });
  }
  ['Recent', ...Object.keys(sets)].forEach((nm, i) => {
    const b = el('button', { class: 'btn', style: 'font-size:11.5px;min-width:0;padding:0 8px' + (i === 1 ? ';font-weight:700' : '') }, nm);
    b.addEventListener('click', () => { $$('button', tabsRow).forEach(x => x.style.fontWeight = '400'); b.style.fontWeight = '700'; render(nm); });
    tabsRow.appendChild(b);
  });
  body.appendChild(tabsRow);
  body.appendChild(grid);
  function insert() {
    if (!picked) return;
    recent.unshift(picked);
    XKV.set('xc.syms', JSON.stringify([...new Set(recent)].slice(0, 24)));
    const ed = X.editState();
    if (ed) { X.insertRefAtCaret(picked); }
    else {
      const s = state.sel;
      const cd = X.cellGet(s.a.r, s.a.c);
      X.startEdit((cd && cd.v != null ? String(cd.v) : '') + picked, 'replace');
    }
  }
  render(Object.keys(sets)[0]);
  X.dlg({
    title: 'Symbol', body, width: 470,
    buttons: [{ label: 'Insert', pri: true, fn: () => { if (!picked) { X.sbMsg('Pick a symbol first'); return false; } insert(); } }, { label: 'Close' }],
  });
};

/* ==========================================================================
   LINK DIALOG
   ========================================================================== */
X.linkDialog = function () {
  const s = state.sel;
  const cd = X.cellGet(s.a.r, s.a.c);
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:340px' });
  const textInp = txtInp(cd && cd.v != null && !cd.link ? String(cd.v) : '');
  const addrInp = txtInp(cd && cd.link ? cd.link : '');
  addrInp.placeholder = 'https://';
  body.appendChild(fld('Text to display', textInp));
  body.appendChild(fld('Address', addrInp));
  body.appendChild(el('div', { style: 'font-size:11px;color:var(--txt-3)' }, 'Link opens in a new browser tab when the cell is clicked.'));
  X.dlg({
    title: 'Insert Hyperlink', body, width: 400,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const addr = addrInp.value.trim();
        if (!addr) { X.msgBox('Microsoft Excel', 'Type a web address for the link.', { icon: 'warn' }); return false; }
        X.pushUndo('Hyperlink');
        const cell = X.cellEnsure(s.a.r, s.a.c);
        cell.v = textInp.value || addr;
        cell.t = 's'; cell.num = null;
        cell.link = /^https?:\/\//i.test(addr) ? addr : 'https://' + addr;
        X.markDirty(); X.afterSelChange();
      }
    }, { label: 'Cancel' }],
  });
};
// clicking a linked cell (single click, not editing) opens the link
document.addEventListener('click', e => {
  const celld = e.target.closest && e.target.closest('.cell');
  if (!celld || X.editState()) return;
  const cd = X.cellGet(+celld.dataset.r, +celld.dataset.c);
  if (cd && cd.link) { window.open(cd.link, '_blank', 'noopener'); X.sbMsg('Opened link in a new tab'); }
}, true);

/* ==========================================================================
   SPARKLINE DIALOG
   ========================================================================== */
X.sparkDialog = function (type) {
  const n = X.normSel();
  // default data = selected row; location = cell just right of it
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:330px' });
  const dataInp = txtInp(`${a1(n.r1, n.c1)}:${a1(n.r1, Math.max(n.c1, n.c2))}`);
  const locInp = txtInp(a1(n.r1, n.c2 + 1));
  body.appendChild(fld('Data range', dataInp));
  body.appendChild(fld('Location cell', locInp));
  const typSel = selInp([['line', 'Line'], ['column', 'Column']], type || 'line');
  body.appendChild(fld('Type', typSel));
  X.dlg({
    title: 'Create Sparklines', body, width: 390,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const rng = parseRangeOrNull(dataInp.value);
        const loc = parseRangeOrNull(locInp.value);
        if (!rng || !loc || loc.r1 !== loc.r2 || loc.c1 !== loc.c2) { X.msgBox('Microsoft Excel', 'Check the data range and location cell.', { icon: 'warn' }); return false; }
        X.pushUndo('Sparkline');
        const cd = X.cellEnsure(loc.r1, loc.c1);
        cd.spark = { type: typSel.value, r1: rng.r1, c1: rng.c1, r2: rng.r2, c2: rng.c2 };
        cd.v = ' '; // reserve the cell so it renders
        X.markDirty(); X.afterSelChange();
        X.sbMsg('Sparkline created at ' + a1(loc.r1, loc.c1));
      }
    }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   PIVOT TABLE (summary report on a new sheet)
   ========================================================================== */
X.pivotDialog = function () {
  const rg = X.regionUsed();
  if (!rg || rg.r2 - rg.r1 < 1) { X.msgBox('Microsoft Excel', 'Select a list with a header row and at least two data rows to build a PivotTable.', { icon: 'warn' }); return; }
  const cols = [];
  for (let c = rg.c1; c <= rg.c2; c++) {
    const d = X.cellDisplay(rg.r1, c);
    cols.push({ c, name: d && d.text ? d.text : 'Column ' + Calc.idxToCol(c) });
  }
  const numCols = cols.filter(({ c }) => {
    for (let r = rg.r1 + 1; r <= Math.min(rg.r2, rg.r1 + 30); r++) if (typeof X.cellRaw(r, c) === 'number') return true;
    return false;
  });
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:320px' });
  body.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2)' }, `Source: ${sheet().name}!${a1(rg.r1, rg.c1)}:${a1(rg.r2, rg.c2)}`));
  const rowSel = selInp(cols.map(x => [String(x.c), x.name]), String(rg.c1));
  body.appendChild(fld('Rows (group by)', rowSel));
  const valSel = selInp((numCols.length ? numCols : cols).map(x => [String(x.c), x.name]), String((numCols[0] || cols[1] || cols[0]).c));
  body.appendChild(fld('Values (summarize)', valSel));
  const aggSel = selInp([['sum', 'Sum'], ['count', 'Count'], ['avg', 'Average'], ['max', 'Max'], ['min', 'Min']], 'sum');
  body.appendChild(fld('Summarize by', aggSel));
  X.dlg({
    title: 'PivotTable from table or range', body, width: 390,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const rowC = +rowSel.value, valC = +valSel.value, agg = aggSel.value;
        const groups = new Map();
        for (let r = rg.r1 + 1; r <= rg.r2; r++) {
          if (sheet().hidR[r]) continue;
          const k = X.cellRaw(r, rowC);
          const key = k == null ? '(blank)' : String(k);
          const v = X.cellRaw(r, valC);
          if (!groups.has(key)) groups.set(key, []);
          if (typeof v === 'number') groups.get(key).push(v); else groups.get(key).push(null);
        }
        const aggFn = {
          sum: a => a.reduce((x, y) => x + y, 0),
          count: a => a.filter(v => v != null).length || a.length,
          avg: a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : '',
          max: a => a.length ? Math.max(...a) : '',
          min: a => a.length ? Math.min(...a) : '',
        }[agg];
        const rowName = cols.find(x => x.c === rowC).name;
        const valName = cols.find(x => x.c === valC).name;
        const aggName = { sum: 'Sum', count: 'Count', avg: 'Average', max: 'Max', min: 'Min' }[agg];
        const nsh = X.addSheet('Pivot of ' + sheet().name, true);
        const put = (r, c, v, opts) => {
          const cd = X.cellEnsure(r, c);
          if (typeof v === 'number') { cd.v = String(+v.toFixed(8)); cd.t = 'n'; cd.num = v; }
          else { cd.v = String(v); cd.t = 's'; }
          if (opts && opts.b) cd.s = { ...(cd.s || {}), b: true };
          if (opts && opts.bg) cd.s = { ...(cd.s || {}), bg: opts.bg };
        };
        put(0, 0, `Pivot of ${sheet().name}`, { b: true });
        put(2, 0, 'Row Labels', { b: true, bg: '#D9E8DE' });
        put(2, 1, `${aggName} of ${valName}`, { b: true, bg: '#D9E8DE' });
        let r = 3, grand = [];
        for (const [k, arr] of Array.from(groups.entries()).sort((A, B) => Calc.compare(A[0], B[0], '<') ? -1 : 1)) {
          const nums = agg === 'count' ? arr : arr.filter(v => v != null);
          const val = aggFn(nums.map(v => v == null ? 0 : v));
          put(r, 0, k);
          if (val !== '') { put(r, 1, +Number(val).toFixed(6)); if (agg !== 'count') grand.push(val); }
          else put(r, 1, '');
          r++;
        }
        put(r, 0, 'Grand Total', { b: true });
        if (grand.length) put(r, 1, agg === 'avg' ? +(grand.reduce((a, b) => a + b, 0) / grand.length).toFixed(6) : agg === 'min' ? Math.min(...grand) : agg === 'max' ? Math.max(...grand) : agg === 'count' ? '' : +grand.reduce((a, b) => a + b, 0).toFixed(6), { b: true });
        nsh.colW[0] = 130; nsh.colW[1] = 130;
        X.selectSheet(state.sheets.indexOf(nsh));
        X.markDirty();
        X.sbMsg('PivotTable created on sheet "' + nsh.name + '"');
      }
    }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   INSERT FUNCTION DIALOG
   ========================================================================== */
X.insertFnDialog = function () {
  const FLIB = X.FLIB || [];
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:8px;min-width:430px' });
  const srch = txtInp('');
  srch.placeholder = 'Type a brief description of what you want to do and click Go';
  body.appendChild(srch);
  const catSel = selInp([['*', 'All'], ...[...new Set(FLIB.map(f => f.cat))].map(c => [c, c])], '*');
  body.appendChild(fld('Or select a category', catSel));
  const list = el('div', { class: 'fn-list' });
  body.appendChild(list);
  const desc = el('div', { class: 'fn-desc' }, 'Pick a function');
  body.appendChild(desc);
  let picked = null;
  function render() {
    const q = srch.value.trim().toLowerCase();
    const items = FLIB.filter(f => (catSel.value === '*' || f.cat === catSel.value) && (!q || f.fn.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q)));
    list.innerHTML = '';
    (items.length ? items : []).slice(0, 250).forEach(f => {
      const it = el('div', { class: 'fn-it' + (picked === f ? ' on' : '') }, esc(f.fn));
      it.addEventListener('click', () => {
        picked = f;
        $$('.fn-it', list).forEach(x => x.classList.toggle('on', x === it));
        desc.innerHTML = `<b>${esc(f.fn)}</b> ${esc(f.sig.replace(/^[^(]*/, ''))}<div>${esc(f.desc)}</div>`;
      });
      it.addEventListener('dblclick', () => { picked = f; doInsert(); });
      list.appendChild(it);
    });
    if (!items.length) list.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--txt-3)">No functions match your search.</div>';
    if (!picked && items.length) picked = items[0];
  }
  srch.addEventListener('input', render);
  srch.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doInsert(); } });
  catSel.addEventListener('change', render);
  render();
  function doInsert() {
    if (!picked) return;
    const f = picked;
    const s = state.sel;
    // smart default arg: numbers above or left
    let argTxt = '';
    const above = [], left = [];
    for (let r = s.a.r - 1; r >= 0 && above.length < 8; r--) { const v = X.cellRaw(r, s.a.c); if (typeof v === 'number') above.push(r); else break; }
    for (let c = s.a.c - 1; c >= 0 && left.length < 8; c--) { const v = X.cellRaw(s.a.r, c); if (typeof v === 'number') left.push(c); else break; }
    if (['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'MEDIAN', 'SUMPRODUCT', 'STDEV.S', 'STDEV.P', 'VAR.S'].includes(f.fn)) {
      if (above.length) argTxt = `${a1(above[above.length - 1], s.a.c)}:${a1(above[0], s.a.c)}`;
      else if (left.length) argTxt = `${a1(s.a.r, left[left.length - 1])}:${a1(s.a.r, left[0])}`;
    }
    X._closeDlg && X._closeDlg();
    X.startEdit(`=${f.fn}(${argTxt})`, 'replace');
    X.sbMsg(`${f.sig} — ${f.desc}`);
  }
  X.dlg({
    title: 'Insert Function', body, width: 480,
    buttons: [{ label: 'OK', pri: true, fn: () => { doInsert(); return false; } }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   DEFINED NAMES
   ========================================================================== */
X.defineNameDialog = function () {
  const n = X.normSel();
  const s = state.sel;
  // suggest a name from the cell to the left/above
  let suggest = '';
  const up = X.cellDisplay(n.r1 - 1, n.c1), left = X.cellDisplay(n.r1, n.c1 - 1);
  const cand = (up && up.text) || (left && left.text) || '';
  if (cand && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(cand.replace(/\s+/g, '_'))) suggest = cand.replace(/\s+/g, '_');
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:340px' });
  const nameInp = txtInp(suggest);
  const refInp = txtInp(`${sheet().name}!$${Calc.idxToCol(n.c1)}$${n.r1 + 1}${(n.r2 !== n.r1 || n.c2 !== n.c1) ? `:$${Calc.idxToCol(n.c2)}$${n.r2 + 1}` : ''}`);
  body.appendChild(fld('Name', nameInp));
  body.appendChild(fld('Refers to', refInp));
  X.dlg({
    title: 'New Name', body, width: 400,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        const nm = nameInp.value.trim();
        if (!/^[A-Za-z_\\][A-Za-z0-9_.]*$/.test(nm) || Calc.parseRef(nm)) { X.msgBox('Microsoft Excel', 'That name is not valid. Names must start with a letter or underscore and cannot look like a cell reference.', { icon: 'warn' }); return false; }
        // validate refers-to by parsing
        const t = Calc.parse('=' + refInp.value);
        if (!t || t.k === '__parsefail') { X.msgBox('Microsoft Excel', 'The reference you typed is not valid.', { icon: 'warn' }); return false; }
        X.pushUndo('Define Name');
        state.names[nm] = { ref: refInp.value };
        X.markDirty();
        X.sbMsg(`Name "${nm}" defined`);
      }
    }, { label: 'Cancel' }],
  });
};
X.nameManagerDialog = function () {
  const body = el('div', { style: 'min-width:520px' });
  const tbl = el('div', { class: 'nm-tbl' });
  body.appendChild(tbl);
  function render() {
    tbl.innerHTML = `<div class="nm-row nm-h"><span>Name</span><span>Refers To</span><span>Scope</span><span></span></div>`;
    const entries = Object.entries(state.names);
    if (!entries.length) tbl.appendChild(el('div', { style: 'padding:14px;font-size:12px;color:var(--txt-3)' }, 'No names are defined in this workbook.'));
    entries.forEach(([nm, d]) => {
      const row = el('div', { class: 'nm-row' });
      row.appendChild(el('span', { style: 'font-weight:600' }, esc(nm)));
      row.appendChild(el('span', { style: 'color:#0B6A3B' }, esc(d.ref)));
      row.appendChild(el('span', null, 'Workbook'));
      const del = el('button', { class: 'btn', style: 'min-width:0;padding:0 8px;font-size:11px' }, 'Delete');
      del.addEventListener('click', () => { X.pushUndo('Delete Name'); delete state.names[nm]; X.markDirty(); render(); });
      row.appendChild(del);
      row.style.cursor = 'default';
      row.addEventListener('dblclick', () => { X._closeDlg(); X.goToRef(d.ref.replace(/^'?([^'!]+)'?!/, '$1!')); });
      tbl.appendChild(row);
    });
  }
  render();
  const newBtn = el('button', { class: 'btn', style: 'margin-top:10px;font-size:11.5px' }, 'New...');
  newBtn.addEventListener('click', () => { X._closeDlg(); X.defineNameDialog(); });
  body.appendChild(newBtn);
  X.dlg({ title: 'Name Manager', body, width: 580, buttons: [{ label: 'Close', pri: true }] });
};

/* ==========================================================================
   ERROR CHECKING
   ========================================================================== */
X.errorCheckDialog = function () {
  const errs = [];
  X.forEachUsedCell((r, c) => {
    const d = X.cellDisplay(r, c);
    if (d && d.t === 'e') errs.push({ r, c, err: d.text, f: X.cellGet(r, c).v });
  });
  const body = el('div', { style: 'min-width:380px' });
  if (!errs.length) {
    body.appendChild(el('div', { style: 'font-size:12.5px;color:var(--txt-1);padding:8px 0' }, 'The error check is complete for the entire sheet. No errors were found.'));
    X.dlg({ title: 'Error Checking', body, width: 420, buttons: [{ label: 'OK', pri: true }] });
    return;
  }
  body.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2);margin-bottom:8px' }, `${errs.length} error${errs.length > 1 ? 's' : ''} in sheet "${sheet().name}"`));
  const list = el('div', { style: 'max-height:240px;overflow:auto;border:1px solid var(--field-b)' });
  errs.slice(0, 200).forEach(e => {
    const row = el('div', { class: 'err-row' });
    row.innerHTML = `<span class="err-cell">${a1(e.r, e.c)}</span><span class="err-code">${esc(e.err)}</span><span class="err-f">${esc(String(e.f || '').slice(0, 60))}</span>`;
    row.addEventListener('click', () => {
      X._closeDlg();
      X.setSel({ r: e.r, c: e.c });
      X.scrollCellVisible(e.r, e.c);
      X.focusGrid();
    });
    list.appendChild(row);
  });
  body.appendChild(list);
  body.appendChild(el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:8px' }, 'Click an error to go to its cell.'));
  X.dlg({ title: 'Error Checking', body, width: 470, buttons: [{ label: 'Close', pri: true }] });
};

/* ==========================================================================
   FORMAT CELLS (tabbed)
   ========================================================================== */
X.formatCellsDialog = function (tab) {
  const s = state.sel;
  const cd = X.cellGet(s.a.r, s.a.c) || {};
  const st = cd.s || {};
  const sampleRaw = X.cellRaw(s.a.r, s.a.c);
  const sample = el('div', { style: 'border:1px solid var(--field-b);background:#fff;padding:6px 10px;font-size:13px;min-height:22px;margin-bottom:8px' }, 'Sample');
  const paintSample = (fmt, stl) => {
    const Calc2 = window.Calc;
    let txt = 'AaBbCcYyZz', color = stl && stl.color || '#000', bg = stl && stl.bg || '#fff', bold = stl && stl.b, ital = stl && stl.i;
    if (typeof sampleRaw === 'number') {
      const r = Calc2.fmt(sampleRaw, fmt || cd.f || 'General');
      txt = r.text;
      if (r.color) color = r.color;
    } else if (fmt) { txt = fmt === '@' ? String(sampleRaw || 'text') : String(sampleRaw || 'text'); }
    else if (sampleRaw != null) txt = String(sampleRaw);
    sample.textContent = txt;
    sample.style.color = color; sample.style.background = bg;
    sample.style.fontWeight = bold ? '700' : '400';
    sample.style.fontStyle = ital ? 'italic' : 'normal';
    sample.style.fontFamily = stl && stl.font ? `'${stl.font}',sans-serif` : '';
    sample.style.fontSize = (stl && stl.size ? stl.size * 1.33 : 13) + 'px';
    sample.style.textDecoration = stl && stl.u ? (stl.u === 'double' ? 'underline double' : 'underline') : (stl && stl.strike ? 'line-through' : 'none');
    sample.style.textAlign = stl && stl.halign || 'left';
  };

  /* ---- Number tab ---- */
  const numTab = el('div', { class: 'fmtc-num' });
  const cats = ['General', 'Number', 'Currency', 'Date', 'Time', 'Percentage', 'Fraction', 'Scientific', 'Text', 'Custom'];
  const catList = el('div', { class: 'fmtc-cats' });
  const right = el('div', { class: 'fmtc-right' });
  numTab.appendChild(catList); numTab.appendChild(right);
  let chosenFmt = cd.f || 'General';
  let chosenCat = cd.f ? guessCat(cd.f) : 'General';
  function guessCat(f) {
    if (!f || f === 'General') return 'General';
    if (f === '@') return 'Text';
    if (/%/.test(f)) return 'Percentage';
    if (/E\+/.test(f)) return 'Scientific';
    if (/\?\/\?/.test(f)) return 'Fraction';
    if (/[ymd]/i.test(f) && !/AM\/PM/.test(f) && !/[h]/.test(f)) return 'Date';
    if (/[hsm]/i.test(f) && /:/.test(f)) return 'Time';
    if (/[$€£₹]/.test(f)) return 'Currency';
    return 'Number';
  }
  const dateFmts = ['mm/dd/yyyy', 'dd/mm/yyyy', 'dd-mmm-yy', 'd-mmm-yyyy', 'mmmm d, yyyy', 'mmm-yy', 'yyyy-mm-dd'];
  const timeFmts = ['h:mm AM/PM', 'h:mm:ss AM/PM', 'h:mm', 'h:mm:ss', 'mm:ss.0'];
  function fmtFor(cat, opts) {
    switch (cat) {
      case 'Number': {
        let f0 = opts.comma ? '#,##0' : '0';
        if (opts.dec > 0) f0 += '.' + '0'.repeat(opts.dec);
        return f0;
      }
      case 'Currency': {
        const sym = opts.sym || '$';
        let f0 = `"${sym}"#,##0`;
        if (opts.dec > 0) f0 += '.' + '0'.repeat(opts.dec); else f0 += '.00';
        return f0;
      }
      case 'Percentage': return '0' + (opts.dec ? '.' + '0'.repeat(opts.dec) : '') + '%';
      case 'Fraction': return opts.frac === '??/??' ? '# ??/??' : '# ?/?';
      case 'Scientific': return '0.00E+00';
      case 'Text': return '@';
      case 'Date': return opts.pick || 'mm/dd/yyyy';
      case 'Time': return opts.pick || 'h:mm AM/PM';
      default: return opts.custom != null ? opts.custom : 'General';
    }
  }
  function renderRight() {
    right.innerHTML = '';
    right.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt);margin-bottom:3px' }, 'Sample:'));
    right.appendChild(sample);
    const opts = { dec: 2, comma: chosenCat === 'Number', sym: '$', pick: null, frac: '?/?', custom: chosenFmt };
    if (chosenCat === 'Number' || chosenCat === 'Currency' || chosenCat === 'Percentage') {
      const decRow = el('div', { style: 'display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:8px' });
      decRow.appendChild(el('span', null, 'Decimal places:'));
      const dec = numInp(chosenCat === 'Percentage' ? 0 : 2, 55);
      dec.min = 0; dec.max = 10;
      dec.addEventListener('input', () => { opts.dec = clamp(+dec.value || 0, 0, 10); chosenFmt = fmtFor(chosenCat, opts); paintSample(chosenFmt); });
      decRow.appendChild(dec);
      right.appendChild(decRow);
      opts.dec = chosenCat === 'Percentage' ? 0 : 2;
      if (chosenCat === 'Number') {
        const ck = chkLbl('Use 1000 Separator (,)', false);
        ck.cb.addEventListener('change', () => { opts.comma = ck.cb.checked; chosenFmt = fmtFor(chosenCat, opts); paintSample(chosenFmt); });
        right.appendChild(ck);
      }
      if (chosenCat === 'Currency') {
        const symRow = el('div', { style: 'display:flex;align-items:center;gap:8px;font-size:12px;margin-top:6px' });
        symRow.appendChild(el('span', null, 'Symbol:'));
        const symSel = selInp([['$', '$'], ['€', '€'], ['£', '£'], ['₹', '₹']], '$');
        symSel.addEventListener('change', () => { opts.sym = symSel.value; chosenFmt = fmtFor(chosenCat, opts); paintSample(chosenFmt); });
        symRow.appendChild(symSel);
        right.appendChild(symRow);
      }
    }
    if (chosenCat === 'Date' || chosenCat === 'Time') {
      const lst = el('div', { class: 'fmtc-picks' });
      (chosenCat === 'Date' ? dateFmts : timeFmts).forEach(f0 => {
        const it = el('div', { class: 'fmtc-pick' }, esc(typeof sampleRaw === 'number' ? Calc.fmt(sampleRaw, f0).text : f0));
        it.addEventListener('click', () => { $$('.fmtc-pick', lst).forEach(x => x.classList.toggle('on', x === it)); opts.pick = f0; chosenFmt = f0; paintSample(f0); });
        if (f0 === chosenFmt) it.classList.add('on');
        lst.appendChild(it);
      });
      right.appendChild(lst);
    }
    if (chosenCat === 'Fraction') {
      const lst = el('div', { class: 'fmtc-picks' });
      ['# ?/?', '# ??/??'].forEach(f0 => {
        const it = el('div', { class: 'fmtc-pick' }, esc(f0 === '# ?/?' ? 'Up to one digit (1/4)' : 'Up to two digits (21/25)'));
        it.addEventListener('click', () => { $$('.fmtc-pick', lst).forEach(x => x.classList.toggle('on', x === it)); chosenFmt = f0; paintSample(f0); });
        lst.appendChild(it);
      });
      right.appendChild(lst);
    }
    if (chosenCat === 'Custom') {
      const hint = el('div', { style: 'font-size:11px;color:var(--txt-3);margin-bottom:6px' }, 'Type the number format code:');
      right.appendChild(hint);
      const inp = txtInp(chosenFmt === 'General' ? '' : chosenFmt);
      right.appendChild(inp);
      inp.addEventListener('input', () => { chosenFmt = inp.value || 'General'; paintSample(chosenFmt); });
      const lst = el('div', { class: 'fmtc-picks', style: 'margin-top:8px' });
      ['0', '0.00', '#,##0.00', '0%', '0.00%', 'mm/dd/yyyy', '"$"#,##0.00', '0.00E+00'].forEach(f0 => {
        const it = el('div', { class: 'fmtc-pick' }, esc(f0));
        it.addEventListener('click', () => { inp.value = f0; chosenFmt = f0; paintSample(f0); });
        lst.appendChild(it);
      });
      right.appendChild(lst);
    }
    if (chosenCat === 'General') right.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-3)' }, 'General format cells have no specific number format.'));
    if (chosenCat === 'Text') right.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-3)' }, 'Text format cells are treated as text even when a number is in the cell. The cell is displayed exactly as entered.'));
    if (chosenCat === 'Scientific') right.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-3)' }, 'Scientific format displays numbers in exponential notation, e.g. 1.23E+04.'));
    chosenFmt = chosenCat === 'Custom' ? chosenFmt : fmtFor(chosenCat, opts);
    if (chosenCat === 'Date' || chosenCat === 'Time') {
      const on = right.querySelector('.fmtc-pick.on');
      chosenFmt = on ? (on === right.querySelector('.fmtc-pick') ? (chosenCat === 'Date' ? dateFmts[0] : timeFmts[0]) : chosenFmt) : (chosenCat === 'Date' ? dateFmts[0] : timeFmts[0]);
      paintSample(chosenFmt);
    } else paintSample(chosenFmt);
  }
  cats.forEach(ct => {
    const it = el('div', { class: 'fmtc-cat' + (ct === chosenCat ? ' on' : '') }, ct);
    it.addEventListener('click', () => { chosenCat = ct; $$('.fmtc-cat', catList).forEach(x => x.classList.toggle('on', x === it)); renderRight(); });
    catList.appendChild(it);
  });
  renderRight();

  /* ---- Alignment tab ---- */
  const alTab = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:300px' });
  const hSel = selInp([['', 'General'], ['left', 'Left (Indent)'], ['center', 'Center'], ['right', 'Right (Indent)']], st.halign || '');
  const vSel = selInp([['bottom', 'Bottom'], ['middle', 'Middle'], ['top', 'Top']], st.valign === 'middle' ? 'middle' : (st.valign || 'bottom'));
  alTab.appendChild(fld('Horizontal', hSel));
  alTab.appendChild(fld('Vertical', vSel));
  const wrapCk = chkLbl('Wrap text', !!st.wrap);
  alTab.appendChild(wrapCk);
  const indInp = numInp(st.indent || 0, 60);
  alTab.appendChild(fld('Indent', indInp));
  vSel.value = st.valign || 'bottom';

  /* ---- Font tab ---- */
  const foTab = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:300px' });
  const fSel = selInp(X.FONTS.map(f => [f, f]), st.font || 'Calibri');
  foTab.appendChild(fld('Font', fSel));
  const stySel = selInp([['', 'Regular'], ['i', 'Italic'], ['b', 'Bold'], ['bi', 'Bold Italic']], st.b && st.i ? 'bi' : st.b ? 'b' : st.i ? 'i' : '');
  foTab.appendChild(fld('Font style', stySel));
  const szSel = selInp(X.SIZES.map(x => [String(x), String(x)]), String(st.size || 11));
  foTab.appendChild(fld('Size', szSel));
  const uSel = selInp([['', 'None'], ['single', 'Single'], ['double', 'Double']], st.u || '');
  foTab.appendChild(fld('Underline', uSel));
  const strikeCk = chkLbl('Strikethrough', !!st.strike);
  foTab.appendChild(strikeCk);
  const fColInp = colorInp(st.color || '#000000');
  foTab.appendChild(fld('Color', fColInp));

  /* ---- Border tab ---- */
  const boTab = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:300px' });
  boTab.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2)' }, 'Presets (applied when you click OK):'));
  const prRow = el('div', { style: 'display:flex;gap:8px' });
  let boPreset = null;
  [['none', 'None'], ['outside', 'Outline'], ['all', 'All']].forEach(([k, lab]) => {
    const b = el('button', { class: 'btn', style: 'min-width:64px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 0' });
    b.innerHTML = `<span style="display:inline-block;width:26px;height:20px;border:${k === 'none' ? '1px dashed #bbb' : k === 'outside' ? '1.6px solid #333' : '1px solid #333'};position:relative">${k === 'all' ? '<span style="position:absolute;left:0;right:0;top:9px;border-top:1px solid #333"></span><span style="position:absolute;top:0;bottom:0;left:12px;border-left:1px solid #333"></span>' : ''}</span><span style="font-size:11px">${lab}</span>`;
    b.addEventListener('click', () => { boPreset = k; $$('.btn', prRow).forEach(x => x.classList.toggle('pri', x === b)); });
    prRow.appendChild(b);
  });
  boTab.appendChild(prRow);
  const stSel = selInp([['solid,1', 'Thin'], ['solid,2', 'Medium'], ['dashed,1', 'Dashed'], ['dotted,1', 'Dotted'], ['double,2', 'Double']], 'solid,1');
  boTab.appendChild(fld('Line style', stSel));
  const boColInp = colorInp('#000000');
  boTab.appendChild(fld('Color', boColInp));

  /* ---- Fill tab ---- */
  const fiTab = el('div', { style: 'min-width:300px' });
  fiTab.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2);margin-bottom:8px' }, 'Background color:'));
  const fiSw = el('div', { style: 'display:grid;grid-template-columns:repeat(8,26px);gap:5px' });
  const themeCols = ['#FFFFFF', '#F2F2F2', '#D9D9D9', '#BFBFBF', '#808080', '#404040', '#000000', '#FFEB9C',
    '#FFE699', '#FFD966', '#FFC000', '#ED7D31', '#C00000', '#9C0006', '#7030A0', '#4472C4', '#2E75B6', '#1F4E79',
    '#70AD47', '#A9D08E', '#C6E0B4', '#E2EFDA', '#217346', '#63BE7B', '#FCE4EC', '#F8CBAD', '#FFDAD0', '#FFF2CC'];
  let fillPick = st.bg || null;
  themeCols.forEach(col => {
    const sw = el('button', { class: 'pal-sw', title: col, style: `width:26px;height:22px;background:${col};border:1px solid ${col === '#FFFFFF' ? '#ccc' : col}` });
    sw.addEventListener('click', () => { fillPick = col; $$('.pal-sw', fiSw).forEach(x => x.classList.toggle('on', x === sw)); paintSample(null, { bg: col }); });
    if (col === st.bg) sw.classList.add('on');
    fiSw.appendChild(sw);
  });
  fiTab.appendChild(fiSw);
  const noFill = el('button', { class: 'btn', style: 'margin-top:10px;font-size:11.5px' }, 'No Fill');
  noFill.addEventListener('click', () => { fillPick = null; $$('.pal-sw', fiSw).forEach(x => x.classList.remove('on')); paintSample(null, { bg: '#fff' }); });
  fiTab.appendChild(noFill);

  paintSample(cd.f, st);

  /* --- Protection tab --- */
  const prTab = el('div', { style: 'display:flex;flex-direction:column;gap:12px;padding:6px 2px' });
  const lockCk = chkLbl('Locked', !st || st.locked !== false);
  const hiddCk = chkLbl('Hidden', !!(st && st.hidden));
  prTab.appendChild(lockCk);
  prTab.appendChild(hiddCk);
  prTab.appendChild(el('div', { style: 'font-size:11.5px;color:var(--txt-2);line-height:1.55;max-width:400px' },
    'Locking cells or hiding formulas has no effect until you protect the sheet (Review tab, Protect Sheet).'));

  const startTabMap = { number: 0, numb: 0, alignment: 1, font: 2, border: 3, fill: 4, protection: 5, protect: 5 };
  const d = X.dlg({
    title: 'Format Cells',
    tabs: [
      { label: 'Number', body: numTab },
      { label: 'Alignment', body: alTab },
      { label: 'Font', body: foTab },
      { label: 'Border', body: boTab },
      { label: 'Fill', body: fiTab },
      { label: 'Protection', body: prTab },
    ],
    startTab: tab ? (startTabMap[tab] || 0) : 0,
    buttons: [
      {
        label: 'OK', pri: true, fn: () => {
          X.pushUndo('Format Cells');
          // number
          X.setNumFmt(chosenFmt === 'General' ? null : chosenFmt, 'Format Cells');
          // alignment + font + fill via applyStyle merge per cell
          const patch = {};
          if (hSel.value) patch.halign = hSel.value; else patch.halign = null;
          patch.valign = vSel.value === 'bottom' ? null : 'middle' && vSel.value;
          if (patch.valign === 'bottom') patch.valign = null;
          if (wrapCk.cb.checked) patch.wrap = true; else patch.wrap = null;
          patch.indent = +indInp.value || 0;
          patch.font = fSel.value;
          patch.b = stySel.value.includes('b') ? true : null;
          patch.i = stySel.value.includes('i') ? true : null;
          patch.size = +szSel.value;
          patch.u = uSel.value || null;
          patch.strike = strikeCk.cb.checked ? true : null;
          patch.color = fColInp.value;
          patch.bg = fillPick;
          patch.locked = lockCk.cb.checked ? null : false;
          patch.hidden = hiddCk.cb.checked ? true : null;
          X.applyStyleDeep(patch);
          // border
          if (boPreset) {
            const [sty, w] = stSel.value.split(',');
            X.applyBorderEx(boPreset, { w: +w, st: sty, cl: boColInp.value });
          }
          X.markDirty();
        }
      },
      { label: 'Cancel' },
    ],
    width: 480,
  });
};
/* deep patch of style over selection (null clears the property) */
X.applyStyleDeep = function (patch) {
  const n = X.normSel(), s = state.sel;
  const applyOne = (r, c) => {
    const cd = X.cellEnsure(r, c);
    cd.s = cd.s || {};
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === 0 && k === 'indent') delete cd.s[k];
      else cd.s[k] = v;
    }
    if (!Object.keys(cd.s).length) cd.s = null;
  };
  if (s.type === 'all') X.forEachUsedCell(applyOne);
  else if (s.type === 'cols') X.forEachUsedCell((r, c) => { if (c >= n.c1 && c <= n.c2) applyOne(r, c); });
  else if (s.type === 'rows') X.forEachUsedCell((r, c) => { if (r >= n.r1 && r <= n.r2) applyOne(r, c); });
  else X.eachRangeCell(applyOne);
  X.afterSelChange();
};
X.applyBorderEx = function (preset, border) {
  const n = X.normSel(), s = state.sel;
  const B = { ...border };
  const forAll = fn => {
    if (s.type === 'all') X.forEachUsedCell(fn);
    else if (s.type === 'cols') X.forEachUsedCell((r, c) => { if (c >= n.c1 && c <= n.c2) fn(r, c); });
    else if (s.type === 'rows') X.forEachUsedCell((r, c) => { if (r >= n.r1 && r <= n.r2) fn(r, c); });
    else for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) fn(r, c);
  };
  forAll((r, c) => {
    const cd = X.cellEnsure(r, c);
    cd.s = cd.s || {};
    if (preset === 'none') { cd.s.bL = cd.s.bR = cd.s.bT = cd.s.bB = null; return; }
    if (preset === 'all') { cd.s.bL = cd.s.bR = cd.s.bT = cd.s.bB = { ...B }; return; }
    if (preset === 'outside') {
      if (r === n.r1) cd.s.bT = { ...B };
      if (r === n.r2) cd.s.bB = { ...B };
      if (c === n.c1) cd.s.bL = { ...B };
      if (c === n.c2) cd.s.bR = { ...B };
    }
  });
  X.afterSelChange();
};

/* ==========================================================================
   HELP / FEEDBACK / OPTIONS
   ========================================================================== */
X.helpDialog = function () {
  const TOPICS = [
    ['Getting around', [['Move around', 'Arrow keys'], ['Jump to edge of data', 'Ctrl + Arrow'], ['Go to cell', 'Ctrl + G or the Name Box'], ['Next sheet', 'Ctrl + Page Down'], ['Previous sheet', 'Ctrl + Page Up']]],
    ['Editing', [['Edit cell', 'F2 or double-click'], ['Commit', 'Enter'], ['Cancel edit', 'Esc'], ['In-cell absolute reference', 'F4 while editing'], ['Fill down', 'Ctrl + D'], ['Fill right', 'Ctrl + R'], ['AutoSum', 'Alt + = (Σ button)']]],
    ['Clipboard', [['Copy', 'Ctrl + C'], ['Cut', 'Ctrl + X'], ['Paste', 'Ctrl + V'], ['Paste values', 'Paste menu → Values'], ['Paste transposed', 'Paste menu → Transpose']]],
    ['Formatting', [['Bold / Italic / Underline', 'Ctrl + B / I / U'], ['Format Cells', 'Ctrl + 1'], ['Find', 'Ctrl + F'], ['Replace', 'Ctrl + H'], ['Select all', 'Ctrl + A']]],
    ['Powers of this app', [['Formulas', '268 Excel functions incl. XLOOKUP/XMATCH, IFS/SWITCH, AGGREGATE/SUBTOTAL, full statistics (NORM/BINOM/POISSON/T/F/CHISQ + inverses), financial (PMT, XIRR, XNPV, MIRR, DB, DDB, VDB, CUMIPMT), engineering (CONVERT, ERF, BITAND, BASE/DECIMAL), dates (NETWORKDAYS, WORKDAY, DATEDIF), OFFSET, INDIRECT and more'], ['Charts', 'Insert tab → pick a chart from selected data'], ['Data tools', 'Sort, filter, subtotals, text-to-columns, validation, pivot tables'], ['Files', 'File → Export as real .xlsx or .csv, or Save to this browser']]],
  ];
  const body = el('div', { style: 'min-width:430px;display:flex;flex-direction:column;gap:4px' });
  const srch = txtInp(''); srch.placeholder = 'Search help'; srch.style.marginBottom = '8px';
  body.appendChild(srch);
  const list = el('div', { style: 'max-height:340px;overflow:auto' });
  body.appendChild(list);
  function render() {
    const q = srch.value.trim().toLowerCase();
    list.innerHTML = '';
    TOPICS.forEach(([h, rows]) => {
      const show = rows.filter(r => !q || (r[0] + r[1]).toLowerCase().includes(q));
      if (!show.length) return;
      list.appendChild(el('div', { style: 'font-weight:700;font-size:12.5px;margin:10px 0 4px;color:var(--acc)' }, h));
      show.forEach(([a, b]) => {
        const row = el('div', { style: 'display:flex;justify-content:space-between;gap:14px;font-size:12px;padding:2.5px 0;border-bottom:1px solid #F0EEEC' });
        row.appendChild(el('span', null, a));
        const kb = el('span', { style: 'color:var(--txt-3);text-align:right' }, b);
        row.appendChild(kb);
        list.appendChild(row);
      });
    });
    if (!list.children.length) list.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--txt-3)">No results.</div>';
  }
  srch.addEventListener('input', render);
  render();
  X.dlg({ title: 'Excel Help', body, width: 490, buttons: [{ label: 'Close', pri: true }] });
};
X.feedbackDialog = function () {
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:360px' });
  body.appendChild(el('div', { style: 'font-size:12.5px' }, 'How was your experience? We read every note.'));
  const ta = el('textarea', { style: 'width:100%;height:110px;border:1px solid var(--field-b);padding:6px;font:12.5px Calibri' });
  ta.placeholder = 'Tell us what you liked or what we could do better...';
  body.appendChild(ta);
  X.dlg({
    title: 'Feedback to Microsoft', body, width: 420,
    buttons: [{
      label: 'Send', pri: true, fn: () => {
        if (!ta.value.trim()) { X.sbMsg('Type some feedback first'); return false; }
        const log = JSON.parse(XKV.get('xc.feedback') || '[]');
        log.push({ at: Date.now(), book: state.bookName, text: ta.value.trim() });
        XKV.set('xc.feedback', JSON.stringify(log.slice(-50)));
        setTimeout(() => toast('Thank you — your feedback was logged locally'), 150);
      }
    }, { label: 'Cancel' }],
  });
};
X.optionsDialog = function () {
  const opts = JSON.parse(XKV.get('xc.opts') || '{}');
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;min-width:360px' });
  body.appendChild(el('div', { class: 'fld-h' }, 'General'));
  const authorInp = txtInp(state.author || 'User');
  body.appendChild(fld('User name (author of notes & files)', authorInp));
  const fontSel = selInp(X.FONTS.map(f => [f, f]), opts.font || 'Calibri');
  body.appendChild(fld('Default font for new workbooks', fontSel));
  body.appendChild(el('div', { class: 'fld-h' }, 'Formulas'));
  const calcSel = selInp([['auto', 'Automatic'], ['manual', 'Manual (F9 to calculate)']], state.calcMode);
  body.appendChild(fld('Workbook calculation', calcSel));
  body.appendChild(el('div', { class: 'fld-h' }, 'View'));
  const gridCk = chkLbl('Show gridlines on new sheets', opts.grid !== false);
  body.appendChild(gridCk);
  X.dlg({
    title: 'Excel Options', body, width: 430,
    buttons: [{
      label: 'OK', pri: true, fn: () => {
        state.author = authorInp.value.trim() || 'User';
        $('#user-name').textContent = state.author;
        state.calcMode = calcSel.value;
        XKV.set('xc.opts', JSON.stringify({ ...opts, font: fontSel.value, grid: gridCk.cb.checked }));
        X.markDirty();
        toast('Options saved');
      }
    }, { label: 'Cancel' }],
  });
};

/* ==========================================================================
   SAVE / LOAD / TEMPLATES / NEW BOOK
   ========================================================================== */
function serialize() {
  return JSON.stringify({
    ver: 1,
    bookName: state.bookName,
    author: state.author,
    created: state.created,
    modified: Date.now(),
    active: state.active,
    zoom: state.zoom,
    calcMode: state.calcMode,
    showGrid: state.showGrid,
    showNotes: state.showNotes,
    theme: state.theme,
    page: state.page,
    printArea: state.printArea,
    names: state.names,
    autosave: state.autosave,
    sheets: state.sheets.map(s => ({
      name: s.name, cells: s.cells, colW: s.colW, rowH: s.rowH, hidC: s.hidC, hidR: s.hidR,
      merges: s.merges, tables: s.tables, validations: s.validations, outline: s.outline,
      charts: s.charts, notes: s.notes, freeze: s.freeze,
    })),
  });
}
function loadFromJson(json, keepName) {
  const d = JSON.parse(json);
  // wipe
  state.sheets.length = 0;
  d.sheets.forEach(sd => {
    const sh = X.newSheetBlank(sd.name || 'Sheet');
    Object.assign(sh, JSON.parse(JSON.stringify(sd)));
    sh.cells = sh.cells || {};
    X.rebuildSubOfFor(sh);
    state.sheets.push(sh);
  });
  if (!state.sheets.length) state.sheets.push(X.newSheetBlank('Sheet1'));
  state.bookName = keepName ? state.bookName : (d.bookName || 'Book1');
  state.author = d.author || 'User';
  state.created = d.created || Date.now();
  state.modified = d.modified || Date.now();
  state.active = clamp(d.active || 0, 0, state.sheets.length - 1);
  state.names = d.names || {};
  state.calcMode = d.calcMode || 'auto';
  state.showGrid = d.showGrid !== false;
  state.showNotes = !!d.showNotes;
  if (d.theme) state.theme = d.theme;
  if (d.page) state.page = d.page;
  state.printArea = d.printArea || null;
  state.autosave = !!d.autosave;
  state.zoom = clamp(d.zoom || 1, 0.4, 2);
  state.sel = { a: { r: 0, c: 0 }, b: { r: 0, c: 0 }, type: 'cell', ranges: [] };
  state.undoStack && (state.undoStack.length = 0);
  X.setBookName(state.bookName, true);
  $('#user-name').textContent = state.author;
  if (d.theme && d.theme.accent) X.applyAccent(d.theme.accent);
  $('#as-pill').classList.toggle('on', state.autosave);
  $('#as-state').textContent = state.autosave ? 'On' : 'Off';
  X.setZoom(state.zoom);
  X.renderSheetTabs();
  X.recalcAll();
  X.afterSelChange();
  X.renderAll();
}
X._serialize = serialize;
X.saveDoc = function (silent) {
  try {
    state.modified = Date.now();
    const json = serialize();
    const lib = JSON.parse(XKV.get('xc.docs') || '{}');
    lib[state.bookName] = { json, modified: state.modified, size: json.length };
    XKV.set('xc.docs', JSON.stringify(lib));
    XKV.set('xc.session', JSON.stringify({ name: state.bookName, at: Date.now() }));
    state.dirty = false;
    if (!silent) { toast(`"${state.bookName}" saved to this browser`); X.sbMsg('Saved'); }
    return true;
  } catch (err) {
    if (!silent) X.msgBox('Microsoft Excel', 'The workbook could not be saved: ' + err.message, { icon: 'warn' });
    return false;
  }
};
X.loadDocByName = function (name) {
  const lib = JSON.parse(XKV.get('xc.docs') || '{}');
  const rec = lib[name];
  if (!rec) { X.msgBox('Microsoft Excel', `Sorry, "${name}" was not found.`, { icon: 'warn' }); return false; }
  try { loadFromJson(rec.json); toast(`Opened "${name}"`); return true; }
  catch (err) { X.msgBox('Microsoft Excel', 'This file could not be opened: ' + err.message, { icon: 'warn' }); return false; }
};
X.listDocs = function () {
  const lib = JSON.parse(XKV.get('xc.docs') || '{}');
  return Object.entries(lib).map(([name, rec]) => ({ name, modified: rec.modified, size: rec.size })).sort((a, b) => b.modified - a.modified);
};
X.deleteDoc = function (name) {
  const lib = JSON.parse(XKV.get('xc.docs') || '{}');
  delete lib[name];
  XKV.set('xc.docs', JSON.stringify(lib));
};
X.setBookName = function (name, silent) {
  state.bookName = name;
  $('#tb-name').textContent = name;
  document.title = name + ' - Excel';
  if (!silent) X.markDirty();
};
async function confirmLoseChanges() {
  if (!state.dirty) return true;
  const r = await X.msgBox('Microsoft Excel', `Do you want to save your changes to ${state.bookName}?`, { buttons: ['Save', "Don't Save", 'Cancel'], icon: 'warn' });
  if (r === 'Cancel') return false;
  if (r === 'Save') return X.saveDoc(true);
  return true;
}
X.newBook = async function (tplId) {
  if (!(await confirmLoseChanges())) return;
  state.sheets.length = 0;
  state.sheets.push(X.newSheetBlank('Sheet1'));
  state.active = 0;
  state.names = {};
  state.bookName = nextBookName();
  state.sel = { a: { r: 0, c: 0 }, b: { r: 0, c: 0 }, type: 'cell', ranges: [] };
  state.created = Date.now(); state.modified = Date.now();
  state.printArea = null;
  state.protected = false;
  if (tplId && tplId !== 'blank') buildTemplate(tplId);
  X.setBookName(state.bookName, true);
  X.setZoom(1);
  X.renderSheetTabs();
  X.rebuildGeom(); X.updateSpacer();
  X.recalcAll();
  X.afterSelChange();
  X.renderAll();
  X.updateProtectUI();
  state.dirty = false;
  closeBackstage();
};
function nextBookName() {
  const lib = JSON.parse(XKV.get('xc.docs') || '{}');
  let i = 1;
  while (lib['Book' + i]) i++;
  return 'Book' + i;
}

/* ---------------- templates ---------------- */
function buildTemplate(id) {
  const sh = sheet();
  const opts = JSON.parse(XKV.get('xc.opts') || '{}');
  const put = (r, c, v, style) => {
    const cd = X.cellEnsure(r, c);
    if (typeof v === 'number') { cd.v = String(v); cd.t = 'n'; cd.num = v; }
    else { cd.v = String(v); cd.t = String(v).startsWith('=') ? 'f' : 's'; }
    if (style) cd.s = style;
    return cd;
  };
  const GREEN = '#217346';
  if (id === 'budget') {
    put(0, 0, 'Monthly Budget', { b: true, size: 16, color: GREEN });
    put(2, 0, 'Category', { b: true, bg: '#D9EAD9' });
    put(2, 1, 'Budget', { b: true, bg: '#D9EAD9' });
    put(2, 2, 'Actual', { b: true, bg: '#D9EAD9' });
    put(2, 3, 'Difference', { b: true, bg: '#D9EAD9' });
    const rows = [['Rent', 1200, 1200], ['Groceries', 450, 512], ['Transport', 180, 165], ['Utilities', 210, 230], ['Entertainment', 120, 95], ['Savings', 500, 500]];
    rows.forEach(([cat, b, a], i) => {
      put(3 + i, 0, cat);
      put(3 + i, 1, b).f = '"$"#,##0';
      put(3 + i, 2, a).f = '"$"#,##0';
      put(3 + i, 3, `=B${4 + i}-C${4 + i}`).f = '"$"#,##0';
    });
    put(3 + rows.length, 0, 'Total', { b: true });
    put(3 + rows.length, 1, `=SUM(B4:B${3 + rows.length})`, { b: true }).f = '"$"#,##0';
    put(3 + rows.length, 2, `=SUM(C4:C${3 + rows.length})`, { b: true }).f = '"$"#,##0';
    put(3 + rows.length, 3, `=SUM(D4:D${3 + rows.length})`, { b: true }).f = '"$"#,##0';
    sh.colW[0] = 130; sh.colW[1] = sh.colW[2] = 100; sh.colW[3] = 116;
    sh.freeze = { r: 3, c: 0 };
    const id2 = 't' + Math.random().toString(36).slice(2, 8);
    sh.tables[id2] = { r1: 2, c1: 0, r2: 3 + rows.length, c2: 3, name: 'BudgetTable', style: 'TableStyleMedium2', isAutoFilter: true, filter: {} };
  } else if (id === 'calendar') {
    const now = new Date();
    put(0, 0, `${now.toLocaleString('en', { month: 'long' })} ${now.getFullYear()}`, { b: true, size: 16, color: GREEN });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach((d0, i) => put(2, i, d0, { b: true, bg: '#D9EAD9', halign: 'center' }));
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let r = 3, c = first;
    const today = now.getDate();
    for (let d0 = 1; d0 <= dim; d0++) {
      const cd = put(r, c, String(d0), { halign: 'center', ...(d0 === today ? { b: true, bg: '#FFE699' } : {}) });
      cd.f = '0';
      c++;
      if (c === 7) { c = 0; r++; }
    }
    for (let i = 0; i < 7; i++) sh.colW[i] = 92;
  } else if (id === 'todo') {
    put(0, 0, 'To-Do List', { b: true, size: 16, color: GREEN });
    ['Task', 'Due', 'Status', 'Done'].forEach((h, i) => put(2, i, h, { b: true, bg: '#D9EAD9' }));
    const items = [['Draft project outline', '=TODAY()+1', 'In progress'], ['Review with team', '=TODAY()+3', 'Not started'], ['Send final file', '=TODAY()+5', 'Not started']];
    items.forEach(([t0, due, st0], i) => {
      put(3 + i, 0, t0);
      put(3 + i, 1, due).f = 'mm/dd/yyyy';
      put(3 + i, 2, st0);
      put(3 + i, 3, '');
    });
    sh.colW[0] = 220; sh.colW[1] = 90; sh.colW[2] = 110; sh.colW[3] = 60;
    const id2 = 't' + Math.random().toString(36).slice(2, 8);
    sh.tables[id2] = { r1: 2, c1: 0, r2: 5, c2: 3, name: 'TodoTable', style: 'TableStyleMedium2', isAutoFilter: true, filter: {} };
    sh.validations.push({ r1: 3, r2: 30, c1: 2, c2: 2, kind: 'list', list: 'Not started,In progress,Done', showErr: true });
  } else if (id === 'invoice') {
    put(0, 0, 'INVOICE', { b: true, size: 22, color: GREEN });
    put(1, 0, 'Invoice #', { b: true }); put(1, 1, '1001');
    put(2, 0, 'Date', { b: true }); put(2, 1, '=TODAY()').f = 'mm/dd/yyyy';
    ['Item', 'Qty', 'Price', 'Amount'].forEach((h, i) => put(4, i, h, { b: true, bg: '#D9EAD9' }));
    const items = [['Consulting hours', 10, 85], ['Design package', 1, 450], ['Support plan', 3, 60]];
    items.forEach(([it, q, p], i) => {
      put(5 + i, 0, it);
      put(5 + i, 1, q);
      put(5 + i, 2, p).f = '"$"#,##0.00';
      put(5 + i, 3, `=B${6 + i}*C${6 + i}`).f = '"$"#,##0.00';
    });
    put(9, 2, 'Subtotal', { b: true }); put(9, 3, '=SUM(D6:D8)').f = '"$"#,##0.00';
    put(10, 2, 'Tax (8%)', { b: true }); put(10, 3, '=D10*0.08').f = '"$"#,##0.00';
    put(11, 2, 'Total due', { b: true, size: 13 }); put(11, 3, '=D10+D11', { b: true, size: 13 }).f = '"$"#,##0.00';
    sh.colW[0] = 180; sh.colW[1] = 60; sh.colW[2] = 90; sh.colW[3] = 110;
  }
}

/* ==========================================================================
   EXPORT (xlsx / csv) + IMPORT
   ========================================================================== */
function download(u8, name, mime) {
  const blob = new Blob([u8], { type: mime });
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
X.exportXlsx = function () {
  try {
    const u8 = window.Xlsx.buildXlsx(X);
    download(u8, state.bookName.replace(/\.xlsx$/i, '') + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    X.sbMsg('Downloaded a real .xlsx — opens in Microsoft Excel');
  } catch (err) {
    X.msgBox('Microsoft Excel', 'Export failed: ' + err.message, { icon: 'warn' });
  }
};
X.exportCsv = function () {
  const csv = window.Xlsx.buildCsv(X);
  download(new TextEncoder().encode(csv), state.bookName.replace(/\.xlsx$/i, '') + '.csv', 'text/csv');
};
X.exportXlsXml = function () {
  try {
    const xml = window.XlsLegacy.buildXlsXml(X);
    download(new TextEncoder().encode(xml), state.bookName.replace(/\.xlsx?$/i, '') + '.xls', 'application/vnd.ms-excel');
    X.sbMsg('Downloaded .xls (Excel 97-2003 XML) — opens in legacy Excel');
  } catch (err) {
    X.msgBox('Microsoft Excel', 'Legacy export failed: ' + err.message, { icon: 'warn' });
  }
};
X.importFile = async function (file) {
  try {
    if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      if (!(await confirmLoseChanges())) return;
      const rows = window.Xlsx.parseCsvText(text);
      state.sheets.length = 0;
      state.sheets.push(X.newSheetBlank(file.name.replace(/\.csv$/i, '').slice(0, 31) || 'Sheet1'));
      state.active = 0;
      state.names = {};
      state.bookName = file.name.replace(/\.csv$/i, '');
      const colChars = {};   // widest display text per column, for Excel-free auto-fit
      rows.forEach((row, r) => {
        if (r > 100000) return;
        row.forEach((val, c) => {
          if (val === '') return;
          /* same write contract as commitCell: v = raw text, num = parsed value.
             (parseInput has NO .v — assigning pin.v here silently blanked every
             TEXT cell of every CSV ever imported!) */
          const pin = X.parseInput(val);
          const cd = X.cellEnsure(r, c);
          cd.v = val;
          if (pin.t === 'f') cd.t = 'f';
          else { cd.t = pin.t; cd.num = pin.num; }
          if (pin.f && (!cd.f || cd.f === 'General')) cd.f = pin.f;
          let disp = val;
          try { disp = (cd.t === 'n' || cd.t === 'b') ? window.Calc.fmt(cd.num, cd.f || 'General').text : String(cd.v); } catch (e) { }
          if (r < 5000) { const w = String(disp).length; if (w > (colChars[c] || 0)) colChars[c] = w; }
        });
      });
      /* LibreOffice/Excel-style: size columns to content on import so long numbers
         never collapse into ####. 9.4px/char calibrated to the app's own textW
         metric (digits ≈ 9.32px in our 11pt Calibri world) + padding, with caps */
      const sh0 = X.sheet();
      Object.entries(colChars).forEach(([c, w]) => {
        const px = Math.min(280, Math.max(64, Math.ceil(w * 9.4) + 12));
        if (px > (sh0.colW[c] || 64)) sh0.colW[c] = px;
      });
      X.rebuildGeom();
      X.setBookName(state.bookName, true);
      X.renderSheetTabs(); X.recalcAll(); X.afterSelChange(); X.renderAll();
      toast(`Imported "${file.name}"`);
      return;
    }
    const buf = await file.arrayBuffer();
    if (!(await confirmLoseChanges())) return;
    const legacy = window.XlsLegacy && XlsLegacy.isLegacyXls(buf);
    const out = legacy ? XlsLegacy.applyXls(X, buf) : await window.Xlsx.readXlsx(X, buf);
    state.sheets.length = 0;
    out.sheets.forEach(sh => state.sheets.push(sh));
    state.names = out.names || {};
    state.active = clamp(out.activeTab || 0, 0, state.sheets.length - 1);
    state.bookName = file.name.replace(/\.xlsx?$/i, '');
    state.sel = { a: { r: 0, c: 0 }, b: { r: 0, c: 0 }, type: 'cell', ranges: [] };
    X.setBookName(state.bookName, true);
    X.renderSheetTabs();
    X.recalcAll();
    X.afterSelChange();
    X.renderAll();
    state.dirty = true; // imported content not yet saved to the library
    toast(legacy
      ? `Opened "${file.name}" (legacy .xls — values and dates imported; old cell styles are flattened) — press Ctrl+S to keep it`
      : `Opened "${file.name}" — press Ctrl+S to keep it in this browser`);
  } catch (err) {
    console.error(err);
    X.msgBox('Microsoft Excel', `We found a problem with "${file.name}". It may use features this app cannot read yet. (${err.message})`, { icon: 'warn' });
  }
};

/* ==========================================================================
   PRINT
   ========================================================================== */
function printCellCss(cd, d, gridOn) {
  const st = (cd && cd.s) || {};
  const css = [gridOn ? 'border:1px solid #999' : 'border:1px solid transparent'];
  if (st.b) css.push('font-weight:700');
  if (st.i) css.push('font-style:italic');
  if (st.u) css.push('text-decoration:underline');
  if (st.color) css.push('color:' + st.color);
  if (st.bg) css.push('background:' + st.bg);
  if (st.halign) css.push('text-align:' + st.halign);
  else if (d && d.t === 'n') css.push('text-align:right');
  if (st.font) css.push(`font-family:${st.font}`);
  if (st.size) css.push(`font-size:${st.size}pt`);
  for (const side of ['bL', 'bR', 'bT', 'bB']) {
    const b = st[side];
    if (b && b.st) css.push(`${side === 'bL' ? 'border-left' : side === 'bR' ? 'border-right' : side === 'bT' ? 'border-top' : 'border-bottom'}:${Math.max(1, b.w || 1)}px ${b.st} ${b.cl || '#000'}`);
  }
  css.push(st.wrap ? 'white-space:normal;word-wrap:break-word' : 'white-space:nowrap;overflow:hidden');
  return css.join(';');
}
const PRINT_PAGE_CAP = 1500;    // defends the browser against absurd areas; footer notes it
const PRINT_SLICE = 600;        // rows emitted per task slice (UI stays alive)
const printTick = () => new Promise(r => setTimeout(r, 0));
function colLetter(c) { let s = ''; c = c + 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = (c - 1 - m) / 26; } return s; }
function printPageGeom() {
  const o = state.page;
  const wIn = o.orient === 'landscape' ? o.h : o.w, hIn = o.orient === 'landscape' ? o.w : o.h;
  return { cwIn: wIn - o.margins.l - o.margins.r, chIn: hIn - o.margins.t - o.margins.b, o };
}
/* real paginated printout, built in async slices so even huge sheets keep the
   UI alive and report honest progress (never a screen snapshot) */
async function buildPrintView(opts, onProgress, token) {
  opts = opts || {};
  const sh = sheet();
  let area = opts.selection ? X.normSel() : (state.printArea || { r1: 0, c1: 0, r2: X.usedR2(), c2: X.usedC2() });
  area = { r1: Math.max(0, area.r1), c1: Math.max(0, area.c1), r2: Math.max(area.r1, area.r2), c2: Math.max(area.c1, area.c2) };
  const view = $('#print-view') || el('div', { id: 'print-view' });
  if (!view.parentNode) document.body.appendChild(view);
  const P = printPageGeom();
  const PX2IN = 0.75 / 72;                     // 96 CSS px = 1 in
  /* visible columns with real widths (inches), split into page-width chunks
     like Excel's "down, then over" pagination */
  const headW = opts.heads ? 0.34 : 0, headH = opts.heads ? 0.24 : 0;
  const allCols = [];
  for (let c = area.c1; c <= area.c2; c++) { if (!sh.hidC[c]) allCols.push({ c, w: Math.max(0.22, X.colWpx(c) * PX2IN) }); }
  const colChunks = [[]]; let wAcc = headW;
  for (const col of allCols) {
    if (wAcc + col.w > P.cwIn && colChunks[colChunks.length - 1].length) { colChunks.push([]); wAcc = headW; }
    colChunks[colChunks.length - 1].push(col); wAcc += col.w;
  }
  /* row pages by real row heights */
  const rowPages = [[]]; let hAcc = headH;
  for (let r = area.r1; r <= area.r2; r++) {
    if (sh.hidR[r]) continue;
    const h = Math.max(0.16, X.rowHpx(r) * PX2IN);
    if (hAcc + h > P.chIn && rowPages[rowPages.length - 1].length) { rowPages.push([]); hAcc = headH; }
    rowPages[rowPages.length - 1].push({ r, h }); hAcc += h;
  }
  /* merges intersecting the area (spans capped to each page's visible portion) */
  const masters = {}, coveredBy = new Map();
  for (const m of sh.merges) {
    if (m.r2 < area.r1 || m.r1 > area.r2 || m.c2 < area.c1 || m.c1 > area.c2) continue;
    masters[X.keyOf(m.r1, m.c1)] = m;
    for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) { if (r !== m.r1 || c !== m.c1) coveredBy.set(X.keyOf(r, c), m); }
  }
  const totalPages = colChunks.length * rowPages.length || 1;
  const totalRows = rowPages.reduce((a, p) => a + p.length, 0);
  const total = totalRows * colChunks.length || 1;
  let done = 0, pageNo = 0, truncated = false, html = '';
  outer:
  for (const cc of colChunks) {
    const chunkCols = new Set(cc.map(col => col.c));
    for (const rp of rowPages) {
      const pageRows = new Set(rp.map(row => row.r));
      pageNo++;
      html += '<div class="ppage"><table><colgroup>';
      if (opts.heads) html += `<col style="width:${headW}in">`;
      for (const col of cc) html += `<col style="width:${col.w}in">`;
      html += '</colgroup>';
      if (opts.heads) html += `<thead><tr style="height:${headH}in"><th class="ph"></th>${cc.map(col => `<th class="ph">${colLetter(col.c)}</th>`).join('')}</tr></thead>`;
      html += '<tbody>';
      for (const row of rp) {
        html += `<tr style="height:${row.h}in">`;
        if (opts.heads) html += `<th class="pnum">${row.r + 1}</th>`;
        for (const col of cc) {
          const k = X.keyOf(row.r, col.c);
          const cov = coveredBy.get(k);
          if (cov) {
            /* skip only when this page's table emits the master cell; otherwise
               keep an empty continuation cell so columns stay aligned */
            if (chunkCols.has(cov.c1) && pageRows.has(cov.r1)) continue;
            html += `<td style="${printCellCss(null, null, opts.grid)}"></td>`;
            continue;
          }
          const m = masters[k];
          let span = '';
          if (m) {
            const cs = cc.filter(col => col.c >= m.c1 && col.c <= m.c2).length;
            const rs = rp.filter(row => row.r >= m.r1 && row.r <= m.r2).length;
            if (cs > 1) span += ` colspan="${cs}"`;
            if (rs > 1) span += ` rowspan="${rs}"`;
          }
          const d = X.cellDisplay(row.r, col.c), cd = X.cellGet(row.r, col.c);
          html += `<td${span} style="${printCellCss(cd, d, opts.grid)}">${esc(d ? d.text : '')}</td>`;
        }
        html += '</tr>';
        done++;
        if (done % PRINT_SLICE === 0) {
          if (onProgress) onProgress(done, total, pageNo);
          await printTick();
          if (token && token.cancelled) return false;
        }
      }
      html += `</tbody></table><div class="pfoot">${esc(sheet().name)} — Page ${pageNo} of ${totalPages}</div></div>`;
      if (pageNo >= PRINT_PAGE_CAP) { truncated = true; break outer; }
    }
  }
  if (truncated) html += `<div class="ppage"><div class="pfoot" style="font-size:11pt;padding-top:24px">Output truncated at ${PRINT_PAGE_CAP.toLocaleString()} pages — set a smaller Print Area.</div></div>`;
  view.innerHTML = html;
  let st2 = $('#print-orient');
  if (!st2) { st2 = el('style', { id: 'print-orient' }); document.head.appendChild(st2); }
  st2.textContent = `@page { size: ${P.o.size} ${P.o.orient}; margin: ${P.o.margins.t}in ${P.o.margins.r}in ${P.o.margins.b}in ${P.o.margins.l}in; }`;
  return true;
}
function prepPrintOpen() {
  const ovl = el('div', { class: 'prep-ovl' });
  ovl.innerHTML = `<div class="prep-box" role="alertdialog" aria-label="Preparing to print">
    <div class="prep-title"><span class="prep-spin"></span><span>Preparing to print</span></div>
    <div class="prep-msg">Laying out pages…</div>
    <div class="prep-track"><div class="prep-fill"></div></div>
    <div class="prep-foot"><button class="prep-cancel">Cancel</button></div></div>`;
  document.body.appendChild(ovl);
  const token = { cancelled: false };
  ovl.querySelector('.prep-cancel').addEventListener('click', () => { token.cancelled = true; });
  return { ovl, token };
}
function prepPrintUpdate(m, done, total, pageNo) {
  const pct = Math.max(2, Math.min(100, Math.round(done / total * 100)));
  m.ovl.querySelector('.prep-msg').textContent = `Building page ${pageNo.toLocaleString()} — ${pct}% (${done.toLocaleString()} of about ${total.toLocaleString()} rows)`;
  m.ovl.querySelector('.prep-fill').style.width = pct + '%';
}
X.doPrint = async function (opts) {
  closeBackstage();                       // the paper shows the SHEET, never the backstage screen
  const m = prepPrintOpen();
  let ok = false;
  try { ok = await buildPrintView(opts || {}, (d, t, p) => prepPrintUpdate(m, d, t, p), m.token); }
  catch (err) {
    console.error(err);
    m.ovl.remove();
    X.msgBox('Microsoft Excel', 'Could not prepare the printout: ' + err.message, { icon: 'error' });
    return;
  }
  m.ovl.remove();
  if (!ok) { X.sbMsg('Printing cancelled'); return; }
  setTimeout(() => window.print(), 80);
};

/* ==========================================================================
   BACKSTAGE
   ========================================================================== */
let bsEl = null;
function closeBackstage() { if (bsEl) { bsEl.remove(); bsEl = null; } }
X.closeBackstage = closeBackstage;
X.openBackstage = function (panel) {
  closeBackstage();
  const root = el('div', { class: 'bs-root' });
  bsEl = root;
  const rail = el('div', { class: 'bs-rail' });
  const back = el('button', { class: 'bs-back', title: 'Back' }, '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M12.5 3.5L6 10l6.5 6.5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  back.addEventListener('click', () => { closeBackstage(); X.focusGrid(); });
  rail.appendChild(back);
  const main = el('div', { class: 'bs-main' });
  const items = [
    ['home', 'Home'], ['new', 'New'], ['open', 'Open'], ['info', 'Info'],
    ['save', 'Save'], ['saveas', 'Save As'], ['print', 'Print'], ['export', 'Export'],
    ['account', 'Account'], ['options', 'Options'],
  ];
  let cur = panel || 'home';
  items.forEach(([id, lab]) => {
    const b = el('button', { class: 'bs-it' + (id === cur ? ' on' : ''), 'data-bs': id }, esc(lab));
    b.addEventListener('click', () => {
      if (id === 'save') { X.saveDoc(); closeBackstage(); X.focusGrid(); return; }
      cur = id;
      $$('.bs-it', rail).forEach(x => x.classList.toggle('on', x === b));
      renderMain();
    });
    rail.appendChild(b);
  });
  rail.appendChild(el('div', { class: 'sp' }));
  rail.appendChild(el('div', { class: 'bs-ver' }, 'Excel Web Edition<br>Version 16.0 (Clone)'));
  root.appendChild(rail);
  root.appendChild(main);
  document.body.appendChild(root);

  function tplCard(id, name, sub, deco) {
    const card = el('div', { class: 'tpl-card' });
    card.innerHTML = deco;
    card.appendChild(el('div', { class: 'tp-name' }, esc(name)));
    card.appendChild(el('div', { class: 'tp-sub' }, esc(sub)));
    card.addEventListener('click', () => X.newBook(id));
    return card;
  }
  const tplDecos = {
    blank: `<div class="tp-thumb"><div class="tgrid">${'<i></i>'.repeat(12)}</div></div>`,
    budget: `<div class="tp-thumb"><span class="tln g" style="width:55%"></span><span class="tln" style="width:80%"></span><div class="tgrid"><i class="h"></i><i class="h"></i><i class="h"></i>${'<i></i>'.repeat(9)}</div></div>`,
    calendar: `<div class="tp-thumb"><span class="tln g" style="width:45%"></span><div class="tgrid">${'<i></i>'.repeat(12)}</div></div>`,
    todo: `<div class="tp-thumb"><span class="tln g" style="width:50%"></span><span class="tln" style="width:90%"></span><span class="tln" style="width:75%"></span><span class="tln" style="width:82%"></span></div>`,
    invoice: `<div class="tp-thumb"><span class="tln g" style="width:35%;height:10px"></span><span class="tln" style="width:70%"></span><span class="tln" style="width:70%"></span><span class="tln" style="width:40%"></span></div>`,
  };
  function tplGrid() {
    const grid = el('div', { class: 'tpl-grid' });
    (window.SHTPLS || [{ id: 'blank', name: 'Blank workbook', sub: '' }]).forEach(t => {
      grid.appendChild(tplCard(t.id, t.name, t.sub, tplDecos[t.id] || tplDecos.blank));
    });
    return grid;
  }
  function docRows(onOpen) {
    const wrap = el('div');
    const docs = X.listDocs();
    if (!docs.length) wrap.appendChild(el('div', { style: 'color:var(--txt-3);font-size:13px;padding:10px 0' }, 'No workbooks saved in this browser yet.'));
    docs.forEach(d0 => {
      const row = el('div', { class: 'doc-row' });
      row.innerHTML = `<span class="ic">${'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="4" y="2.5" width="19" height="27" rx="1.5" fill="#fff" stroke="#217346" stroke-width="1.4"/><path d="M10 10h3l2.5 5 2.5-5h3l-4 7 4 8h-3l-2.5-5.5L13 20h-3l4-7z" fill="#217346"/></svg>'}</span>`;
      const nm = el('div', { class: 'nm' }, esc(d0.name));
      const mt = el('div', { class: 'mt' }, new Date(d0.modified).toLocaleString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' · ' + Math.max(1, Math.round(d0.size / 1024)) + ' KB');
      const box = el('div', { style: 'flex:1' });
      box.appendChild(nm); box.appendChild(mt);
      row.appendChild(box);
      const openB = el('button', { class: 'btn', style: 'font-size:11.5px' }, 'Open');
      openB.addEventListener('click', async e => {
        e.stopPropagation();
        if (!(await confirmLoseChanges())) return;
        if (X.loadDocByName(d0.name)) { closeBackstage(); X.focusGrid(); }
        onOpen && onOpen();
      });
      const delB = el('button', { class: 'btn', style: 'font-size:11.5px;color:#A33' }, 'Delete');
      delB.addEventListener('click', async e => {
        e.stopPropagation();
        const r = await X.msgBox('Microsoft Excel', `Delete "${d0.name}" from this browser? This cannot be undone.`, { buttons: ['Delete', 'Cancel'], icon: 'warn' });
        if (r === 'Delete') { X.deleteDoc(d0.name); row.remove(); }
      });
      row.appendChild(openB); row.appendChild(delB);
      row.addEventListener('click', async () => {
        if (!(await confirmLoseChanges())) return;
        if (X.loadDocByName(d0.name)) { closeBackstage(); X.focusGrid(); }
      });
      wrap.appendChild(row);
    });
    return wrap;
  }
  function importRow() {
    const wrap = el('div', { style: 'margin-top:24px;max-width:520px' });
    wrap.appendChild(el('h2', null, 'Import from your device'));
    const rz = el('div', { class: 'imp-zone' });
    rz.innerHTML = `<div style="font-size:13px;color:var(--txt)">Drop an <b>.xlsx</b>, <b>.xls</b> or <b>.csv</b> here, or</div>`;
    const btn = el('button', { class: 'btn pri', style: 'margin-top:8px' }, 'Browse files');
    const inp = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', style: 'display:none' });
    btn.addEventListener('click', () => inp.click());
    inp.addEventListener('change', () => { if (inp.files[0]) { X.importFile(inp.files[0]).then(() => { closeBackstage(); X.focusGrid(); }); } });
    rz.appendChild(btn); rz.appendChild(inp);
    rz.addEventListener('dragover', e => { e.preventDefault(); rz.classList.add('over'); });
    rz.addEventListener('dragleave', () => rz.classList.remove('over'));
    rz.addEventListener('drop', e => {
      e.preventDefault(); rz.classList.remove('over');
      const f = e.dataTransfer.files[0];
      if (f) X.importFile(f).then(() => { closeBackstage(); X.focusGrid(); });
    });
    wrap.appendChild(rz);
    return wrap;
  }
  function renderMain() {
    main.innerHTML = '';
    if (cur === 'home') {
      main.appendChild(el('h1', null, 'Good ' + (new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening')));
      main.appendChild(el('h2', null, 'New'));
      main.appendChild(tplGrid());
      main.appendChild(el('h2', null, 'Recent'));
      main.appendChild(docRows());
    } else if (cur === 'new') {
      main.appendChild(el('h1', null, 'New workbook'));
      main.appendChild(tplGrid());
    } else if (cur === 'open') {
      main.appendChild(el('h1', null, 'Open'));
      main.appendChild(el('h2', null, 'Saved in this browser'));
      main.appendChild(docRows());
      main.appendChild(importRow());
    } else if (cur === 'info') {
      main.appendChild(el('h1', null, 'Info'));
      const box = el('div', { class: 'bs-info' });
      box.innerHTML = `
        <div class="kv"><span style="width:150px;color:var(--txt-3)">Workbook name</span><span><b>${esc(state.bookName)}</b></span></div>
        <div class="kv"><span style="width:150px;color:var(--txt-3)">Sheets</span><span>${state.sheets.length} (${state.sheets.map(s2 => esc(s2.name)).join(', ')})</span></div>
        <div class="kv"><span style="width:150px;color:var(--txt-3)">Author</span><span>${esc(state.author)}</span></div>
        <div class="kv"><span style="width:150px;color:var(--txt-3)">Created</span><span>${new Date(state.created).toLocaleString()}</span></div>
        <div class="kv"><span style="width:150px;color:var(--txt-3)">Last modified</span><span>${new Date(state.modified || Date.now()).toLocaleString()}</span></div>
        <div class="kv"><span style="width:150px;color:var(--txt-3)">Status</span><span>${state.protected ? 'Sheet protected' : state.dirty ? 'Unsaved changes' : 'All changes saved'}</span></div>`;
      main.appendChild(box);
      const row = el('div', { class: 'bs-stage-row', style: 'margin-top:22px' });
      const pb = el('button', { class: 'btn' }, state.protected ? 'Unprotect Sheet' : 'Protect Sheet');
      pb.addEventListener('click', () => { closeBackstage(); X.protectDialog(); });
      const nb = el('button', { class: 'btn' }, 'Rename...');
      nb.addEventListener('click', () => { closeBackstage(); $('#tb-title').click(); });
      row.appendChild(pb); row.appendChild(nb);
      main.appendChild(row);
    } else if (cur === 'saveas') {
      main.appendChild(el('h1', null, 'Save As'));
      const nmInp = txtInp(nextBookNameIfDup());
      nmInp.style.maxWidth = '300px';
      nmInp.style.fontSize = '14px'; nmInp.style.height = '30px';
      main.appendChild(el('h2', null, 'Workbook name'));
      main.appendChild(nmInp);
      const row = el('div', { class: 'bs-stage-row', style: 'margin-top:16px' });
      const sb = el('button', { class: 'btn pri' }, 'Save');
      sb.addEventListener('click', () => {
        const nm = nmInp.value.trim();
        if (!nm) return;
        X.setBookName(nm);
        X.saveDoc();
        closeBackstage(); X.focusGrid();
      });
      const xb = el('button', { class: 'btn pri' }, 'Download .xlsx');
      xb.addEventListener('click', () => { X.setBookName(nmInp.value.trim() || state.bookName); X.exportXlsx(); });
      row.appendChild(sb); row.appendChild(xb);
      main.appendChild(row);
      main.appendChild(importRow());
    } else if (cur === 'print') {
      main.appendChild(el('h1', null, 'Print'));
      const o = state.page;
      const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:12px;max-width:360px;font-size:13px' });
      const whatSel = selInp([['sheet', 'Print Active Sheet'], ['selection', 'Print Selection']], 'sheet');
      wrap.appendChild(fld('Print', whatSel));
      const orSel = selInp([['portrait', 'Portrait Orientation'], ['landscape', 'Landscape Orientation']], o.orient);
      wrap.appendChild(fld('Orientation', orSel));
      const sizeSel = selInp([['Letter', 'Letter'], ['A4', 'A4'], ['Legal', 'Legal']], o.size);
      wrap.appendChild(fld('Paper size', sizeSel));
      const gridCk = chkLbl('Print gridlines', state.gridPrint);
      wrap.appendChild(gridCk);
      const headsCk = chkLbl('Print row and column headings', false);
      wrap.appendChild(headsCk);
      const pb = el('button', { class: 'btn pri', style: 'width:150px;height:34px;font-size:13.5px;margin-top:6px' }, 'Print');
      pb.addEventListener('click', () => {
        o.orient = orSel.value; o.size = sizeSel.value; state.gridPrint = gridCk.cb.checked;
        X.doPrint({ selection: whatSel.value === 'selection', grid: gridCk.cb.checked, heads: headsCk.cb.checked });
      });
      wrap.appendChild(pb);
      main.appendChild(wrap);
    } else if (cur === 'export') {
      main.appendChild(el('h1', null, 'Export'));
      const mk = (t0, sub, fn) => {
        const card = el('div', { class: 'doc-row', style: 'width:460px' });
        card.innerHTML = `<span class="ic"></span>`;
        const box = el('div', { style: 'flex:1' });
        box.appendChild(el('div', { class: 'nm' }, t0));
        box.appendChild(el('div', { class: 'mt' }, sub));
        card.appendChild(box);
        const b = el('button', { class: 'btn pri', style: 'font-size:11.5px' }, 'Download');
        b.addEventListener('click', e => { e.stopPropagation(); fn(); });
        card.appendChild(b);
        return card;
      };
      main.appendChild(mk('Excel Workbook (.xlsx)', 'A real Excel file that opens in Microsoft Excel', X.exportXlsx));
      main.appendChild(el('div', { style: 'height:10px' }));
      main.appendChild(mk('Excel 97-2003 Workbook (.xls)', 'Legacy Excel format (Microsoft XML) that old Excel versions open', X.exportXlsXml));
      main.appendChild(mk('CSV (Comma delimited) (.csv)', 'Plain text values of the active sheet', X.exportCsv));
      main.appendChild(importRow());
    } else if (cur === 'account') {
      main.appendChild(el('h1', null, 'Account'));
      const card = el('div', { style: 'display:flex;gap:18px;align-items:center;background:#fff;border:1px solid #E1DFDD;padding:22px;max-width:460px' });
      card.innerHTML = `<span style="width:54px;height:54px;border-radius:50%;background:var(--acc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600">${esc((state.author || 'U')[0].toUpperCase())}</span>`;
      const box = el('div');
      box.appendChild(el('div', { style: 'font-size:16px;font-weight:600' }, esc(state.author || 'User')));
      box.appendChild(el('div', { style: 'font-size:12px;color:var(--txt-3);margin-top:2px' }, 'Local account — files stay in this browser'));
      card.appendChild(box);
      main.appendChild(card);
      main.appendChild(el('div', { style: 'margin-top:22px;font-size:12.5px;color:#666;max-width:460px;line-height:1.6' },
        'This is a faithful web recreation of Microsoft Excel for learning and personal use. Your workbooks are stored only in this browser (IndexedDB on your machine) unless you export them.'));
    } else if (cur === 'options') {
      closeBackstage();
      X.optionsDialog();
      return;
    }
  }
  function nextBookNameIfDup() {
    const lib = JSON.parse(XKV.get('xc.docs') || '{}');
    if (!lib[state.bookName]) return state.bookName;
    return nextBookName();
  }
  renderMain();
};
// Esc closes the backstage
document.addEventListener('keydown', e => { if (e.key === 'Escape' && bsEl) { closeBackstage(); X.focusGrid(); } }, true);

/* ==========================================================================
   TELL ME
   ========================================================================== */
(function () {
  const input = $('#tellme-input');
  if (!input) return;
  let items = [];
  function collect() {
    items = [];
    (window.RIBBON || []).forEach(t => t.groups.forEach(g => (g.items || []).forEach(function walk(it) {
      if (it.id && X.CMDS && X.CMDS[it.id]) items.push({ id: it.id, label: (it.label || it.id).replace(/\n/g, ' '), tab: t.label });
      if (it.items) it.items.forEach(walk);
    })));
    items.push({ id: '__save', label: 'Save workbook', tab: 'File', run: () => X.saveDoc() });
    items.push({ id: '__export', label: 'Download as Excel (.xlsx)', tab: 'File', run: () => X.exportXlsx() });
    items.push({ id: '__exportxls', label: 'Download as Excel 97-2003 (.xls)', tab: 'File', run: () => X.exportXlsXml() });
    items.push({ id: '__print', label: 'Print', tab: 'File', run: () => X.openBackstage('print') });
    items.push({ id: '__new', label: 'New workbook', tab: 'File', run: () => X.newBook() });
    items.push({ id: '__opts', label: 'Options', tab: 'File', run: () => X.optionsDialog() });
  }
  function runItem(it) {
    X.closeAllPops();
    input.value = '';
    input.blur();
    if (it.run) { it.run(); return; }
    const cmd = X.CMDS[it.id];
    if (cmd && cmd.exec) cmd.exec();
  }
  function openList() {
    const q = input.value.trim().toLowerCase();
    const hits = items.filter(it => !q || it.label.toLowerCase().includes(q)).slice(0, 9);
    const box = el('div', { class: 'menu', style: 'width:340px' });
    if (!hits.length) box.appendChild(el('div', { style: 'padding:10px 14px;font-size:12.5px;color:var(--txt-3)' }, 'No actions found. Try “sort”, “chart”, “format”…'));
    hits.forEach((it, i) => {
      const mi = el('div', { class: 'mi' + (i === 0 ? ' tt-first' : '') });
      mi.innerHTML = `<span class="mi-lab">${esc(it.label)}</span><span class="mi-note">${esc(it.tab || '')}</span>`;
      mi.addEventListener('click', () => runItem(it));
      box.appendChild(mi);
    });
    X.pop(input, box, { cls: 'tt-pop' });
  }
  input.addEventListener('focus', () => { collect(); openList(); });
  input.addEventListener('input', openList);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim().toLowerCase();
      const hits = items.filter(it => !q || it.label.toLowerCase().includes(q));
      if (hits.length) runItem(hits[0]);
    } else if (e.key === 'Escape') { input.value = ''; X.closeAllPops(); input.blur(); }
  });
})();

/* ==========================================================================
   XBOOT — final glue once app.js init has run
   ========================================================================== */
window.XBOOT = function () {
  // fx button opens Insert Function
  $('#fx-btn').addEventListener('click', () => X.insertFnDialog());
  // restore last session if one exists
  let restored = false;
  try {
    const ses = JSON.parse(XKV.get('xc.session') || 'null');
    if (ses && ses.name) {
      const lib = JSON.parse(XKV.get('xc.docs') || '{}');
      if (lib[ses.name]) {
        state.undoOn = false;
        loadFromJson(lib[ses.name].json);
        state.undoOn = true;
        restored = true;
      }
    }
  } catch (err) { console.warn('session restore failed', err); }
  const opts = JSON.parse(XKV.get('xc.opts') || '{}');
  if (opts.author) state.author = opts.author;
  $('#user-name').textContent = state.author || 'User';
  X.updateProtectUI();
  // Ctrl keymap extras not handled by app.js
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .dlg, .popup')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); X.saveDoc(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); X.openBackstage('print'); }
    if (e.key === 'F9') { e.preventDefault(); X.recalcAll(); X.renderAll(); X.sbMsg('Calculated'); }
  });
  state.dirty = false;
};

})();
