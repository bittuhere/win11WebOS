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
   Excel clone — app2: commands, menus, dialogs, charts, notes,
   conditional formatting, backstage, export, print
   ========================================================================== */
(function () {
'use strict';
const X = window.X, Calc = window.Calc;
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
const state = X.state;
const sheet = X.sheet;
const a1 = (r, c) => Calc.idxToCol(c) + (r + 1);
const menu = items => X.menu(items);
const pop = (a, c, o) => X.pop(a, c, o);
const keyOf = (r, c) => r + ',' + c;

/* ============================ OFFICE PALETTE ============================ */
const THEME_COLORS = [
  ['#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'],
  ['#F2F2F2', '#7F7F7F', '#D0CECE', '#D6DCE4', '#D9E1F2', '#FCE4D6', '#EDEDED', '#FFF2CC', '#DDEBF7', '#E2EFDA'],
  ['#D8D8D8', '#595959', '#AEABAB', '#ADB9CA', '#B4C6E7', '#F8CBAD', '#DBDBDB', '#FFE699', '#BDD7EE', '#C6E0B4'],
  ['#BFBFBF', '#3F3F3F', '#757070', '#8496B0', '#8FAADC', '#F4B183', '#C9C9C9', '#FFD966', '#9DC3E6', '#A9D08E'],
  ['#A5A5A5', '#262626', '#3A3838', '#667799', '#5B79B8', '#E49C46', '#909090', '#E8B70C', '#4A8AC3', '#53993D'],
  ['#7F7F7F', '#0C0C0C', '#171616', '#33415C', '#2F5496', '#C55A11', '#767171', '#C09000', '#2E75B6', '#538135'],
];
const STD_COLORS = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
X.colorPalette = function (anchor, cmdId, onPick, opts) {
  opts = opts || {};
  const box = el('div', { class: 'pal' });
  box.appendChild(el('div', { class: 'pal-title' }, 'Theme Colors'));
  const grid = el('div', { class: 'pal-grid' });
  THEME_COLORS.forEach(row => row.forEach(c => {
    const sw = el('div', { class: 'pal-sw', style: `background:${c}`, title: c });
    sw.addEventListener('click', () => { onPick(c); X.closeAllPops(); });
    grid.appendChild(sw);
  }));
  box.appendChild(grid);
  box.appendChild(el('div', { class: 'pal-std-title' }, 'Standard Colors'));
  const grid2 = el('div', { class: 'pal-grid' });
  STD_COLORS.forEach(c => {
    const sw = el('div', { class: 'pal-sw', style: `background:${c}`, title: c });
    sw.addEventListener('click', () => { onPick(c); X.closeAllPops(); });
    grid2.appendChild(sw);
  });
  box.appendChild(grid2);
  const acts = el('div', { class: 'pal-actions' });
  const items = [];
  if (opts.none) items.push({ label: opts.none, action: () => { onPick(null); } });
  items.push({
    label: 'More Colors...', icon: 'options', action: () => {
      const body = el('div');
      const f = el('div', { class: 'fld' });
      f.innerHTML = '<span>Hex color (e.g. #1E7145)</span>';
      const inp = el('input', { type: 'text', value: '#217346' });
      const prev = el('div', { style: 'height:34px;border:1px solid #A6A6A6;background:#217346;margin-top:6px' });
      inp.addEventListener('input', () => { if (/^#[0-9a-f]{3,8}$/i.test(inp.value.trim())) prev.style.background = inp.value.trim(); });
      f.appendChild(inp); f.appendChild(prev);
      body.appendChild(f);
      X.dlg({
        title: 'Colors', body, width: 260,
        buttons: [{ label: 'OK', pri: true, fn: () => { const v = inp.value.trim(); if (/^#[0-9a-f]{3,8}$/i.test(v)) onPick(v.startsWith('#') ? v : '#' + v); } }, { label: 'Cancel' }],
      });
    },
  });
  acts.appendChild(menu(items));
  box.appendChild(acts);
  pop(anchor, box);
};

/* ============================ CUSTOM GROUPS ============================ */
X.CUST = {};
X.CUST.fontgrp = body => {
  const row1 = el('div', { class: 'rbtnrow', style: 'margin-bottom:1px' });
  row1.appendChild(buildFontCombo('font'));
  row1.appendChild(buildFontCombo('size'));
  row1.appendChild(mkBtn('growfont', 'growfont', 'Grow Font', () => bumpSize(1)));
  row1.appendChild(mkBtn('shrinkfont', 'shrinkfont', 'Shrink Font', () => bumpSize(-1)));
  body.appendChild(col([row1, buildFontRow2()]));
};
function col(children) { const c = el('span', { style: 'display:flex;flex-direction:column' }); children.forEach(x => c.appendChild(x)); return c; }
function mkBtn(id, icon, title, fn, opts) {
  opts = opts || {};
  const b = el('button', { class: 'rbtn', title });
  b.dataset.cmd = id;
  if (opts.toggle) b.dataset.toggle = opts.toggle;
  b.innerHTML = svgIcon(icon) + (opts.caret ? `<span class="caret-wrap">${svgIcon('chev-d', 'ico-s')}</span>` : '');
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', e => fn(e, b));
  return b;
}
function buildFontCombo(kind) {
  const isFont = kind === 'font';
  const wrap = el('span', { class: 'rcombo ' + (isFont ? 'rc-font' : 'rc-size') });
  const inp = el('input', { type: 'text', value: isFont ? 'Calibri' : '11' });
  inp.spellcheck = false;
  const btn = el('button', { class: 'rc-btn', tabindex: '-1' }, svgIcon('chev-d', 'ico-s'));
  wrap.appendChild(inp); wrap.appendChild(btn);
  if (isFont) X.fontInput = inp; else X.sizeInput = inp;
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => {
    const list = el('div', { style: 'max-height:300px;overflow:auto;' + (isFont ? 'width:220px' : 'width:60px') });
    (isFont ? X.FONTS : X.SIZES).forEach(v => {
      const itm = el('div', { class: 'mi' });
      itm.innerHTML = isFont ? `<span style="font-family:'${v}',sans-serif">${esc(v)}</span>` : `<span>${v}</span>`;
      itm.style.paddingLeft = '10px';
      itm.addEventListener('click', () => { X.closeAllPops(); if (isFont) CMDS.font.exec(null, null, v); else CMDS.fontsize.exec(null, null, v); });
      list.appendChild(itm);
    });
    pop(btn, list);
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isFont) CMDS.font.exec(null, null, inp.value.trim() || 'Calibri');
      else CMDS.fontsize.exec(null, null, parseFloat(inp.value.replace(/[^\d.]/g, '')) || 11);
      inp.blur(); X.focusGrid();
    }
    e.stopPropagation();
  });
  return wrap;
}
function buildFontRow2() {
  const row = el('div', { class: 'rbtnrow' });
  row.appendChild(mkBtn('bold', 'bold', 'Bold (Ctrl+B)', () => X.cycleToggle('b', 'Bold'), { toggle: 'bold' }));
  row.appendChild(mkBtn('italic', 'italic', 'Italic (Ctrl+I)', () => X.cycleToggle('i', 'Italic'), { toggle: 'italic' }));
  row.appendChild(mkBtn('under', 'under', 'Underline (Ctrl+U)', (e, b) => X.cycleToggle('u', 'Underline'), { toggle: 'under' }));
  row.appendChild(mkBtn('underm', 'chev-d', 'Underline options', (e, b) => MENU_BUILDERS.underMenu(b)));
  row.appendChild(mkBtn('strike', 'strike', 'Strikethrough', () => X.cycleToggle('strike', 'Strikethrough'), { toggle: 'strike' }));
  row.appendChild(sepv());
  // borders
  const bordWrap = el('span', { style: 'display:inline-flex' });
  bordWrap.appendChild(mkBtn('borderb', 'border', 'Bottom Border', () => X.applyBorder('bottom'), { }));
  bordWrap.appendChild(mkBtn('borderm', 'chev-d', 'Borders', (e, b) => MENU_BUILDERS.bordersMenu(b)));
  row.appendChild(bordWrap);
  const fillWrap = el('span', { style: 'display:inline-flex;position:relative' });
  const fb = mkBtn('bucket', 'bucket', 'Fill Color', (e, b) => { CMDS.bucket.exec(e, b, state.colors.bucket); });
  fb.insertAdjacentHTML('beforeend', '<span class="swbar" id="sw-fill" style="background:#FFFF00"></span>');
  fillWrap.appendChild(fb);
  fillWrap.appendChild(mkBtn('bucketm', 'chev-d', 'Fill Color', (e, b) => X.colorPalette(b, 'bucket', c => { state.colors.bucket = c || ''; $('#sw-fill').style.background = c || 'rgba(0,0,0,.1)'; CMDS.bucket.exec(null, null, c); }, { none: 'No Fill' })));
  row.appendChild(fillWrap);
  const fcWrap = el('span', { style: 'display:inline-flex;position:relative' });
  const fc = mkBtn('fontcolor', 'fontcolor', 'Font Color', (e, b) => { CMDS.fontcolor.exec(e, b, state.colors.fontcolor); });
  fc.insertAdjacentHTML('beforeend', '<span class="swbar" id="sw-font" style="background:#C00000"></span>');
  fcWrap.appendChild(fc);
  fcWrap.appendChild(mkBtn('fontcolm', 'chev-d', 'Font Color', (e, b) => X.colorPalette(b, 'fontcolor', c => { state.colors.fontcolor = c || '#000'; $('#sw-font').style.background = c || '#000'; CMDS.fontcolor.exec(null, null, c); }, { none: 'Automatic' })));
  row.appendChild(fcWrap);
  const sep = sepv();
  row.appendChild(sep);
  return row;
}
function sepv() { return el('span', { class: 'rsep', style: 'margin:2px 2px 2px;height:19px' }); }
X.CUST.aligngrp = body => {
  const row1 = el('div', { class: 'rbtnrow', style: 'margin-bottom:1px' });
  row1.appendChild(mkBtn('aligntop', 'aligntop', 'Align Top', () => setValign('top'), { toggle: 'aligntop' }));
  row1.appendChild(mkBtn('alignmid', 'alignmid', 'Middle Align', () => setValign('middle'), { toggle: 'alignmid' }));
  row1.appendChild(mkBtn('alignbot', 'alignbot', 'Align Bottom', () => setValign('bottom'), { toggle: 'alignbot' }));
  row1.appendChild(mkBtn('orient', 'orient', 'Orientation', (e, b) => MENU_BUILDERS.orientTextMenu(b)));
  const row2 = el('div', { class: 'rbtnrow' });
  row2.appendChild(mkBtn('alignl', 'alignl', 'Align Text Left', () => setHalign('left'), { toggle: 'alignl' }));
  row2.appendChild(mkBtn('alignc', 'alignc', 'Center', () => setHalign('center'), { toggle: 'alignc' }));
  row2.appendChild(mkBtn('alignr', 'alignr', 'Align Text Right', () => setHalign('right'), { toggle: 'alignr' }));
  const ind = col([
    (() => { const r = el('div', { class: 'rbtnrow' }); r.appendChild(mkBtn('outdent', 'outdent', 'Decrease Indent', () => bumpIndent(-1))); return r; })(),
    (() => { const r = el('div', { class: 'rbtnrow' }); r.appendChild(mkBtn('indent', 'indent', 'Increase Indent', () => bumpIndent(1))); return r; })(),
  ]);
  const wrapM = col([
    (() => { const r = el('div', { class: 'rbtnrow' }); r.appendChild(mkBtn('wrapm', 'wraptext', 'Wrap Text', (e, b) => CMDS.wrap.exec(e, b), { toggle: 'wrap' })); return r; })(),
    (() => { const r = el('div', { class: 'rbtnrow' }); r.appendChild(mkBtn('merge', 'merge', 'Merge & Center', (e, b) => CMDS.merge.exec(e, b), { toggle: 'merge' })); r.appendChild(mkBtn('mergem', 'chev-d', 'Merge options', (e, b) => MENU_BUILDERS.mergeMenu(b))); return r; })(),
  ]);
  body.appendChild(el('span', { style: 'display:flex;gap:2px' }, ));
  const host = el('span', { style: 'display:flex;align-items:flex-start;gap:0' });
  const colA = col([row1, row2]);
  host.appendChild(colA);
  host.appendChild(col([
    el('span', { style: 'display:flex;flex-direction:column' }),
  ]));
  const row3 = el('div', { class: 'rbtnrow', style: 'margin-left:6px' });
  host.appendChild(ind);
  host.appendChild(wrapM);
  body.appendChild(host);
};
function setHalign(a) { X.applyStyle(s => { s.halign = a; }, 'Alignment'); }
function setValign(a) { X.applyStyle(s => { s.valign = a; }, 'Alignment'); }
function bumpIndent(d) {
  X.applyStyle(s => { s.indent = Math.max(0, Math.min(40, (s.indent || 0) + d)); }, 'Indent');
}
function bumpSize(d) {
  pushSize(d);
}
function pushSize(d) {
  const s = X.state.sel;
  const cd = X.cellGet(s.a.r, s.a.c);
  const cur = (cd && cd.s && cd.s.size) || 11;
  const steps = X.SIZES;
  let target;
  if (d > 0) target = steps.find(x => x > cur + 0.01) || cur + 2;
  else target = [...steps].reverse().find(x => x < cur - 0.01) || Math.max(1, cur - 2);
  CMDS.fontsize.exec(null, null, target);
}
X.CUST.numgrp = body => {
  const row1 = el('div', { class: 'rbtnrow', style: 'margin-bottom:1px' });
  const fmtCombo = el('span', { class: 'rcombo', style: 'width:190px' });
  const fmtInp = el('input', { type: 'text', value: 'General', readonly: true, style: 'cursor:default' });
  X.fmtInput = fmtInp;
  const fmtBtn = el('button', { class: 'rc-btn', tabindex: '-1' }, svgIcon('chev-d', 'ico-s'));
  fmtCombo.appendChild(fmtInp); fmtCombo.appendChild(fmtBtn);
  fmtInp.addEventListener('mousedown', e => { e.preventDefault(); MENU_BUILDERS.numFmtMenu(fmtBtn); });
  fmtBtn.addEventListener('mousedown', e => e.preventDefault());
  fmtBtn.addEventListener('click', () => MENU_BUILDERS.numFmtMenu(fmtBtn));
  row1.appendChild(fmtCombo);
  row1.appendChild(mkBtn('datelong', 'datefmt', 'More Date Formats', (e, b) => MENU_BUILDERS.dateFmtMenu(b)));
  const row2 = el('div', { class: 'rbtnrow' });
  row2.appendChild(mkBtn('accounting', 'accounting', 'Accounting Number Format', (e, b) => CMDS.accounting.exec(e, b)));
  row2.appendChild(mkBtn('percent', 'percent', 'Percent Style (%)', () => CMDS.percent.exec()));
  row2.appendChild(mkBtn('comma', 'comma', 'Comma Style', () => CMDS.comma.exec()));
  row2.appendChild(mkBtn('decinc', 'decinc', 'Increase Decimal', () => X.bumpDecimal(1)));
  row2.appendChild(mkBtn('decdec', 'decdec', 'Decrease Decimal', () => X.bumpDecimal(-1)));
  body.appendChild(col([row1, row2]));
};

/* ============================ FUNCTION CATALOG ============================ */
const FLIB = X.FLIB = [
  { fn: 'SUM', cat: 'Math & Trig', sig: 'SUM(number1, [number2], ...)', desc: 'Adds all the numbers in a range of cells.' },
  { fn: 'SUMIF', cat: 'Math & Trig', sig: 'SUMIF(range, criteria, [sum_range])', desc: 'Adds the cells specified by a given condition or criteria.' },
  { fn: 'SUMIFS', cat: 'Math & Trig', sig: 'SUMIFS(sum_range, criteria_range1, criteria1, ...)', desc: 'Adds the cells specified by multiple criteria.' },
  { fn: 'SUMPRODUCT', cat: 'Math & Trig', sig: 'SUMPRODUCT(array1, [array2], ...)', desc: 'Returns the sum of the products of corresponding ranges or arrays.' },
  { fn: 'PRODUCT', cat: 'Math & Trig', sig: 'PRODUCT(number1, [number2], ...)', desc: 'Multiplies all the numbers given as arguments.' },
  { fn: 'ROUND', cat: 'Math & Trig', sig: 'ROUND(number, num_digits)', desc: 'Rounds a number to a specified number of digits.' },
  { fn: 'ROUNDUP', cat: 'Math & Trig', sig: 'ROUNDUP(number, num_digits)', desc: 'Rounds a number up, away from zero.' },
  { fn: 'ROUNDDOWN', cat: 'Math & Trig', sig: 'ROUNDDOWN(number, num_digits)', desc: 'Rounds a number down, toward zero.' },
  { fn: 'INT', cat: 'Math & Trig', sig: 'INT(number)', desc: 'Rounds a number down to the nearest integer.' },
  { fn: 'TRUNC', cat: 'Math & Trig', sig: 'TRUNC(number, [num_digits])', desc: 'Truncates a number to an integer.' },
  { fn: 'ABS', cat: 'Math & Trig', sig: 'ABS(number)', desc: 'Returns the absolute value of a number.' },
  { fn: 'SIGN', cat: 'Math & Trig', sig: 'SIGN(number)', desc: 'Returns the sign of a number: 1, 0 or -1.' },
  { fn: 'SQRT', cat: 'Math & Trig', sig: 'SQRT(number)', desc: 'Returns the square root of a number.' },
  { fn: 'POWER', cat: 'Math & Trig', sig: 'POWER(number, power)', desc: 'Returns the result of a number raised to a power.' },
  { fn: 'EXP', cat: 'Math & Trig', sig: 'EXP(number)', desc: 'Returns e raised to the power of a number.' },
  { fn: 'LN', cat: 'Math & Trig', sig: 'LN(number)', desc: 'Returns the natural logarithm of a number.' },
  { fn: 'LOG', cat: 'Math & Trig', sig: 'LOG(number, [base])', desc: 'Returns the logarithm of a number to a specified base.' },
  { fn: 'LOG10', cat: 'Math & Trig', sig: 'LOG10(number)', desc: 'Returns the base-10 logarithm of a number.' },
  { fn: 'MOD', cat: 'Math & Trig', sig: 'MOD(number, divisor)', desc: 'Returns the remainder after a number is divided by a divisor.' },
  { fn: 'PI', cat: 'Math & Trig', sig: 'PI()', desc: 'Returns the value of pi.' },
  { fn: 'RAND', cat: 'Math & Trig', sig: 'RAND()', desc: 'Returns a random number between 0 and 1.' },
  { fn: 'RANDBETWEEN', cat: 'Math & Trig', sig: 'RANDBETWEEN(bottom, top)', desc: 'Returns a random integer between the numbers you specify.' },
  { fn: 'SIN', cat: 'Math & Trig', sig: 'SIN(number)', desc: 'Returns the sine of an angle (radians).' },
  { fn: 'COS', cat: 'Math & Trig', sig: 'COS(number)', desc: 'Returns the cosine of an angle (radians).' },
  { fn: 'TAN', cat: 'Math & Trig', sig: 'TAN(number)', desc: 'Returns the tangent of an angle (radians).' },
  { fn: 'RADIANS', cat: 'Math & Trig', sig: 'RADIANS(angle)', desc: 'Converts degrees to radians.' },
  { fn: 'DEGREES', cat: 'Math & Trig', sig: 'DEGREES(angle)', desc: 'Converts radians to degrees.' },
  { fn: 'IF', cat: 'Logical', sig: 'IF(logical_test, [value_if_true], [value_if_false])', desc: 'Checks whether a condition is met, and returns one value if TRUE, another if FALSE.' },
  { fn: 'AND', cat: 'Logical', sig: 'AND(logical1, [logical2], ...)', desc: 'Checks whether all arguments are TRUE.' },
  { fn: 'OR', cat: 'Logical', sig: 'OR(logical1, [logical2], ...)', desc: 'Checks whether any argument is TRUE.' },
  { fn: 'NOT', cat: 'Logical', sig: 'NOT(logical)', desc: 'Reverses the logic of its argument.' },
  { fn: 'XOR', cat: 'Logical', sig: 'XOR(logical1, [logical2], ...)', desc: 'Returns a logical exclusive OR of all arguments.' },
  { fn: 'IFERROR', cat: 'Logical', sig: 'IFERROR(value, value_if_error)', desc: 'Returns value_if_error if expression is an error; otherwise the expression.' },
  { fn: 'IFNA', cat: 'Logical', sig: 'IFNA(value, value_if_na)', desc: 'Returns the value you specify if the expression resolves to #N/A.' },
  { fn: 'TRUE', cat: 'Logical', sig: 'TRUE()', desc: 'Returns the logical value TRUE.' },
  { fn: 'FALSE', cat: 'Logical', sig: 'FALSE()', desc: 'Returns the logical value FALSE.' },
  { fn: 'LEFT', cat: 'Text', sig: 'LEFT(text, [num_chars])', desc: 'Returns the leftmost characters from a text value.' },
  { fn: 'RIGHT', cat: 'Text', sig: 'RIGHT(text, [num_chars])', desc: 'Returns the rightmost characters from a text value.' },
  { fn: 'MID', cat: 'Text', sig: 'MID(text, start_num, num_chars)', desc: 'Returns characters from the middle of a text string.' },
  { fn: 'LEN', cat: 'Text', sig: 'LEN(text)', desc: 'Returns the number of characters in a text string.' },
  { fn: 'LOWER', cat: 'Text', sig: 'LOWER(text)', desc: 'Converts text to lowercase.' },
  { fn: 'UPPER', cat: 'Text', sig: 'UPPER(text)', desc: 'Converts text to uppercase.' },
  { fn: 'PROPER', cat: 'Text', sig: 'PROPER(text)', desc: 'Capitalizes the first letter in each word.' },
  { fn: 'TRIM', cat: 'Text', sig: 'TRIM(text)', desc: 'Removes extra spaces from text.' },
  { fn: 'CONCATENATE', cat: 'Text', sig: 'CONCATENATE(text1, [text2], ...)', desc: 'Joins several text strings into one string.' },
  { fn: 'CONCAT', cat: 'Text', sig: 'CONCAT(text1, [text2], ...)', desc: 'Combines the text from multiple ranges and/or strings.' },
  { fn: 'TEXTJOIN', cat: 'Text', sig: 'TEXTJOIN(delimiter, ignore_empty, text1, ...)', desc: 'Combines text from multiple ranges with a delimiter.' },
  { fn: 'EXACT', cat: 'Text', sig: 'EXACT(text1, text2)', desc: 'Checks whether two text strings are exactly the same (case-sensitive).' },
  { fn: 'FIND', cat: 'Text', sig: 'FIND(find_text, within_text, [start_num])', desc: 'Finds one text value within another (case-sensitive).' },
  { fn: 'SEARCH', cat: 'Text', sig: 'SEARCH(find_text, within_text, [start_num])', desc: 'Finds one text value within another (not case-sensitive).' },
  { fn: 'REPLACE', cat: 'Text', sig: 'REPLACE(old_text, start_num, num_chars, new_text)', desc: 'Replaces part of a text string with a different text string.' },
  { fn: 'SUBSTITUTE', cat: 'Text', sig: 'SUBSTITUTE(text, old_text, new_text, [instance_num])', desc: 'Substitutes new text for old text in a string.' },
  { fn: 'REPT', cat: 'Text', sig: 'REPT(text, number_times)', desc: 'Repeats text a given number of times.' },
  { fn: 'TEXT', cat: 'Text', sig: 'TEXT(value, format_text)', desc: 'Converts a value to text in a specific number format.' },
  { fn: 'VALUE', cat: 'Text', sig: 'VALUE(text)', desc: 'Converts a text argument to a number.' },
  { fn: 'CHAR', cat: 'Text', sig: 'CHAR(number)', desc: 'Returns the character specified by a code number.' },
  { fn: 'CODE', cat: 'Text', sig: 'CODE(text)', desc: 'Returns a numeric code for the first character in a text string.' },
  { fn: 'TODAY', cat: 'Date & Time', sig: 'TODAY()', desc: 'Returns the serial number of today\'s date.' },
  { fn: 'NOW', cat: 'Date & Time', sig: 'NOW()', desc: 'Returns the serial number of the current date and time.' },
  { fn: 'DATE', cat: 'Date & Time', sig: 'DATE(year, month, day)', desc: 'Returns the serial number of a particular date.' },
  { fn: 'TIME', cat: 'Date & Time', sig: 'TIME(hour, minute, second)', desc: 'Returns the serial number of a particular time.' },
  { fn: 'YEAR', cat: 'Date & Time', sig: 'YEAR(serial_number)', desc: 'Converts a serial number to a year.' },
  { fn: 'MONTH', cat: 'Date & Time', sig: 'MONTH(serial_number)', desc: 'Converts a serial number to a month.' },
  { fn: 'DAY', cat: 'Date & Time', sig: 'DAY(serial_number)', desc: 'Converts a serial number to a day of the month.' },
  { fn: 'HOUR', cat: 'Date & Time', sig: 'HOUR(serial_number)', desc: 'Converts a serial number to an hour.' },
  { fn: 'MINUTE', cat: 'Date & Time', sig: 'MINUTE(serial_number)', desc: 'Converts a serial number to a minute.' },
  { fn: 'SECOND', cat: 'Date & Time', sig: 'SECOND(serial_number)', desc: 'Converts a serial number to a second.' },
  { fn: 'WEEKDAY', cat: 'Date & Time', sig: 'WEEKDAY(serial_number, [return_type])', desc: 'Converts a serial number to a day of the week.' },
  { fn: 'DAYS', cat: 'Date & Time', sig: 'DAYS(end_date, start_date)', desc: 'Returns the number of days between two dates.' },
  { fn: 'EDATE', cat: 'Date & Time', sig: 'EDATE(start_date, months)', desc: 'Returns the serial number of the date before or after a number of months.' },
  { fn: 'EOMONTH', cat: 'Date & Time', sig: 'EOMONTH(start_date, months)', desc: 'Returns the serial number of the last day of the month.' },
  { fn: 'VLOOKUP', cat: 'Lookup & Reference', sig: 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])', desc: 'Looks in the first column of an array and moves across the row to return the value of a cell.' },
  { fn: 'HLOOKUP', cat: 'Lookup & Reference', sig: 'HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])', desc: 'Looks in the top row of an array and returns the value of the indicated cell.' },
  { fn: 'INDEX', cat: 'Lookup & Reference', sig: 'INDEX(array, row_num, [column_num])', desc: 'Returns a value or reference of the cell at the intersection of a row and column.' },
  { fn: 'MATCH', cat: 'Lookup & Reference', sig: 'MATCH(lookup_value, lookup_array, [match_type])', desc: 'Returns the relative position of an item in an array.' },
  { fn: 'CHOOSE', cat: 'Lookup & Reference', sig: 'CHOOSE(index_num, value1, [value2], ...)', desc: 'Chooses a value from a list of values based on an index.' },
  { fn: 'ROW', cat: 'Lookup & Reference', sig: 'ROW([reference])', desc: 'Returns the row number of a reference.' },
  { fn: 'COLUMN', cat: 'Lookup & Reference', sig: 'COLUMN([reference])', desc: 'Returns the column number of a reference.' },
  { fn: 'ROWS', cat: 'Lookup & Reference', sig: 'ROWS(array)', desc: 'Returns the number of rows in a reference.' },
  { fn: 'COLUMNS', cat: 'Lookup & Reference', sig: 'COLUMNS(array)', desc: 'Returns the number of columns in a reference.' },
  { fn: 'AVERAGE', cat: 'Statistical', sig: 'AVERAGE(number1, [number2], ...)', desc: 'Returns the average of its arguments.' },
  { fn: 'AVERAGEIF', cat: 'Statistical', sig: 'AVERAGEIF(range, criteria, [average_range])', desc: 'Returns the average of cells specified by a criteria.' },
  { fn: 'COUNT', cat: 'Statistical', sig: 'COUNT(value1, [value2], ...)', desc: 'Counts how many numbers are in the list of arguments.' },
  { fn: 'COUNTA', cat: 'Statistical', sig: 'COUNTA(value1, [value2], ...)', desc: 'Counts how many values are in the list of arguments.' },
  { fn: 'COUNTBLANK', cat: 'Statistical', sig: 'COUNTBLANK(range)', desc: 'Counts the number of blank cells within a range.' },
  { fn: 'COUNTIF', cat: 'Statistical', sig: 'COUNTIF(range, criteria)', desc: 'Counts the number of cells that meet a criteria.' },
  { fn: 'COUNTIFS', cat: 'Statistical', sig: 'COUNTIFS(criteria_range1, criteria1, ...)', desc: 'Counts cells that meet multiple criteria.' },
  { fn: 'MAX', cat: 'Statistical', sig: 'MAX(number1, [number2], ...)', desc: 'Returns the largest value in a set of values.' },
  { fn: 'MIN', cat: 'Statistical', sig: 'MIN(number1, [number2], ...)', desc: 'Returns the smallest value in a set of values.' },
  { fn: 'LARGE', cat: 'Statistical', sig: 'LARGE(array, k)', desc: 'Returns the k-th largest value.' },
  { fn: 'SMALL', cat: 'Statistical', sig: 'SMALL(array, k)', desc: 'Returns the k-th smallest value.' },
  { fn: 'MEDIAN', cat: 'Statistical', sig: 'MEDIAN(number1, [number2], ...)', desc: 'Returns the median of the given numbers.' },
  { fn: 'MODE.SNGL', cat: 'Statistical', sig: 'MODE.SNGL(number1, [number2], ...)', desc: 'Returns the most common value.' },
  { fn: 'STDEV.S', cat: 'Statistical', sig: 'STDEV.S(number1, [number2], ...)', desc: 'Estimates standard deviation based on a sample.' },
  { fn: 'STDEV.P', cat: 'Statistical', sig: 'STDEV.P(number1, [number2], ...)', desc: 'Calculates standard deviation on the whole population.' },
  { fn: 'VAR.S', cat: 'Statistical', sig: 'VAR.S(number1, [number2], ...)', desc: 'Estimates variance based on a sample.' },
  { fn: 'RANK.EQ', cat: 'Statistical', sig: 'RANK.EQ(number, ref, [order])', desc: 'Returns the rank of a number in a list of numbers.' },
  { fn: 'ISNUMBER', cat: 'Information', sig: 'ISNUMBER(value)', desc: 'Checks whether a value is a number.' },
  { fn: 'ISTEXT', cat: 'Information', sig: 'ISTEXT(value)', desc: 'Checks whether a value is text.' },
  { fn: 'ISBLANK', cat: 'Information', sig: 'ISBLANK(value)', desc: 'Checks whether a reference is to an empty cell.' },
  { fn: 'ISLOGICAL', cat: 'Information', sig: 'ISLOGICAL(value)', desc: 'Checks whether a value is a logical value.' },
  { fn: 'ISERROR', cat: 'Information', sig: 'ISERROR(value)', desc: 'Checks whether a value is an error.' },
  { fn: 'ISNA', cat: 'Information', sig: 'ISNA(value)', desc: 'Checks whether a value is #N/A.' },
  { fn: 'NA', cat: 'Information', sig: 'NA()', desc: 'Returns the error value #N/A.' },
];
const fnMenuItems = cat => FLIB.filter(f => f.cat === cat).map(f => ({
  label: f.fn + ' ' + (f.sig.includes('()') ? '' : '()'), note: f.sig.replace(/^[^(]*/, '').slice(0, 40),
  action: () => insertFn(f),
}));
function insertFn(f) {
  // insert function at active cell with signature hint
  const s = X.state.sel;
  const sig = f.sig.slice(f.sig.indexOf('(') + 1, f.sig.lastIndexOf(')'));
  X.commitCell(s.a.r, s.a.c, `=${f.fn}()`);
  X.startEdit(`=${f.fn}()`, 'replace');
  sbMsg(`${f.sig} — ${f.desc}`);
}

/* ============================ MENU BUILDERS ============================ */
const MENU_BUILDERS = X.MENU_BUILDERS = {};
function guardProt(fn) { return () => { if (state.protected) { X.sbMsg('This command cannot be used on a protected sheet.'); return; } fn(); }; }
MENU_BUILDERS.pasteMenu = a => pop(a, menu([
  { label: 'Paste', icon: 'paste', note: 'Ctrl+V', action: () => { const s = X.state.sel; X.pasteAt(s.a.r, s.a.c); } },
  { hdr: 1, label: 'Paste Special' },
  { label: 'Values', icon: 'pasteval', note: '123', action: () => { const s = X.state.sel; X.pasteAt(s.a.r, s.a.c, 'values'); } },
  { label: 'Formulas', icon: 'pasteform', note: 'fx', action: () => { const s = X.state.sel; X.pasteAt(s.a.r, s.a.c, 'formulas'); } },
  { label: 'Formats', icon: 'fpainter', action: () => { const s = X.state.sel; X.pasteAt(s.a.r, s.a.c, 'formats'); } },
  { label: 'Transpose', icon: 'pastetp', action: () => { const s = X.state.sel; X.pasteAt(s.a.r, s.a.c, 'transpose'); } },
  'sep',
  { label: 'Paste Special...', icon: 'options', action: () => MENU_BUILDERS.pasteDlg() },
]));
MENU_BUILDERS.pasteDlg = () => {
  if (!state.clipboard) { X.sbMsg('Nothing to paste. Copy something first.'); return; }
  const body = el('div');
  const mk = (l, v, on) => `<label class="fmtc-radio"><input type="radio" name="pm" value="${v}" ${on ? 'checked' : ''}> ${l}</label>`;
  body.innerHTML = mk('All', 'all', true) + mk('Values', 'values') + mk('Formulas', 'formulas') + mk('Formats', 'formats') + mk('Transpose', 'transpose');
  X.dlg({
    title: 'Paste Special', body, width: 320,
    buttons: [{ label: 'OK', pri: true, fn: d => { const v = d.querySelector('input[name="pm"]:checked').value; const s = X.state.sel; X.pasteAt(s.a.r, s.a.c, v === 'all' ? null : v); } }, { label: 'Cancel' }],
  });
};
MENU_BUILDERS.underMenu = a => pop(a, menu([
  { label: 'Single', check: true, action: () => X.applyStyle(s => { s.u = true; }, 'Underline') },
  { label: 'Double', action: () => X.applyStyle(s => { s.u = 'double'; }, 'Double Underline') },
]));
MENU_BUILDERS.bordersMenu = a => {
  const box = el('div', { class: 'bord-pop' });
  box.appendChild(el('div', { class: 'mi-hdr', style: 'padding:6px 8px 4px' }, 'Borders'));
  const grid = el('div', { class: 'bord-grid' });
  const kinds = [
    ['bottom', 'Bottom Border'], ['top', 'Top Border'], ['left', 'Left Border'], ['right', 'Right Border'],
    ['none', 'No Border'], ['all', 'All Borders'], ['outside', 'Outside Borders'], ['thickout', 'Thick Box Border'],
    ['bottomdouble', 'Double Bottom'], ['bottomthick', 'Thick Bottom'], ['topbottom', 'Top and Bottom'], ['inside', 'Inside Borders'],
  ];
  kinds.forEach(([k, lab]) => {
    const it = el('div', { class: 'bord-it', title: lab });
    it.innerHTML = borderIcon(k) + `<span>${lab.split(' ')[0] === 'No' ? 'None' : lab.replace(' Border', '').replace(' Borders', '')}</span>`;
    it.addEventListener('click', () => { X.closeAllPops(); X.applyBorder(k); });
    grid.appendChild(it);
  });
  box.appendChild(grid);
  box.appendChild(menu([
    { label: 'More Borders...', icon: 'options', action: () => X.formatCellsDialog('border') },
  ]));
  pop(a, box);
};
function borderIcon(kind) {
  const m = {
    bottom: [0, 0, 0, 1], top: [0, 0, 1, 0], left: [1, 0, 0, 0], right: [0, 1, 0, 0],
    none: [0, 0, 0, 0], all: [1, 1, 1, 1, 1, 1], outside: [1, 1, 1, 1], thickout: [2, 2, 2, 2],
    bottomdouble: ['d0', 0, 0, 1], bottomthick: [0, 0, 0, 2], topbottom: [0, 0, 1, 1], inside: [0, 0, 0, 0, 1, 1],
  }[kind] || [0, 0, 0, 0];
  const [l, r, t, b, iv, ih] = m;
  const line = (x1, y1, x2, y2, w, dbl) => w ? (w === 'd0' ? `<path d="M${x1} ${y1 - 1.6}h${x2 - x1}M${x1} ${y1 + 1.6}h${x2 - x1}" stroke="#444" stroke-width="1"/>` : `<path d="M${x1} ${y1}h${x2 - x1}" stroke="#444" stroke-width="${w * 1.4}"/>`) : '';
  const vline = (x1, y1, x2, y2, w) => w ? `<path d="M${x1} ${y1}v${y2 - y1}" stroke="#444" stroke-width="${w * 1.4}"/>` : '';
  return `<svg viewBox="0 0 30 18" width="30" height="18">${line(1, 2, 29, 2, t)}${line(1, 16, 29, 16, b)}${line(3, 9, 27, 9, ih && b ? 1 : ih)}${vline(2, 2, 2, 16, l)}${vline(28, 2, 28, 16, r)}${vline(15, 3, 15, 15, iv && l ? 1 : iv)}</svg>`;
}
MENU_BUILDERS.orientTextMenu = a => pop(a, menu([
  { label: 'Angle Counterclockwise', html: orientSample(45), action: () => X.applyStyle(s => { s.rotate = 45; }, 'Orientation') },
  { label: 'Angle Clockwise', html: orientSample(-45), action: () => X.applyStyle(s => { s.rotate = -45; }, 'Orientation') },
  { label: 'Vertical Text', html: orientSample(90), action: () => X.applyStyle(s => { s.rotate = 90; }, 'Orientation') },
  { label: 'Rotate Text Up', action: () => X.applyStyle(s => { s.rotate = -90; }, 'Orientation') },
  'sep',
  { label: 'Reset', action: () => X.applyStyle(s => { s.rotate = 0; }, 'Orientation') },
]));
function orientSample(deg) {
  return `<span style="display:inline-block;transform:rotate(${-deg}deg);border:1px solid #999;padding:1px 4px;margin-right:6px;font-size:10px">Text</span>`;
}
MENU_BUILDERS.mergeMenu = a => pop(a, menu([
  { label: 'Merge & Center', action: () => X.setMerge('center') },
  { label: 'Merge Across', action: () => X.setMerge('across') },
  { label: 'Merge Cells', action: () => X.setMerge('cells') },
  { label: 'Unmerge Cells', action: () => X.setMerge('unmerge') },
]));
const NUMFMTS = [
  ['General', null], ['Number', '0.00'], ['Currency', '$#,##0.00;($#,##0.00)'], ['Accounting', '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)'],
  ['Short Date', 'mm/dd/yyyy'], ['Long Date', 'dddd, mmmm dd, yyyy'], ['Time', 'h:mm:ss AM/PM'],
  ['Percentage', '0.00%'], ['Fraction', '# ?/?'], ['Scientific', '0.00E+00'], ['Text', '@'],
];
MENU_BUILDERS.numFmtMenu = a => pop(a, menu(NUMFMTS.map(([lab, code]) => ({
  label: lab, note: numfmtNote(lab), check: curFmtIs(code),
  action: () => { X.setNumFmt(code); X.fmtInput && (X.fmtInput.value = lab); },
})).concat(['sep', { label: 'More Number Formats...', icon: 'options', action: () => X.formatCellsDialog('number') }])));
function curFmtIs(code) {
  const s = X.state.sel;
  const cd = X.cellGet(s.a.r, s.a.c);
  return (cd ? cd.f : null) === code || (!code && !cd);
}
function numfmtNote(lab) {
  return { 'General': '', 'Number': '0.00', 'Currency': '$1,234.00', 'Accounting': '$ 1,234.00', 'Short Date': '1/1/2024', 'Long Date': 'Monday, January 1, 2024', 'Time': '12:00:00 AM', 'Percentage': '12.30%', 'Fraction': '1/2', 'Scientific': '1.20E+03', 'Text': 'abc' }[lab] || '';
}
MENU_BUILDERS.dateFmtMenu = a => pop(a, menu([
  { label: 'Short Date', note: Calc.fmt(45292, 'mm/dd/yyyy').text, action: () => X.setNumFmt('mm/dd/yyyy') },
  { label: 'Long Date', note: 'dddd, mmmm dd, yyyy', action: () => X.setNumFmt('mmmm d, yyyy') },
  { label: 'Time', note: Calc.fmt(0.5, 'h:mm AM/PM').text, action: () => X.setNumFmt('h:mm AM/PM') },
  { label: 'Date & Time', note: 'm/d/yyyy h:mm', action: () => X.setNumFmt('m/d/yyyy h:mm') },
  'sep',
  { label: 'More Date Formats...', icon: 'options', action: () => X.formatCellsDialog('number') },
]));
MENU_BUILDERS.condFmtMenu = a => pop(a, menu([
  { label: 'Highlight Cells Rules', icon: 'condfmt', sub: () => [
    { label: 'Greater Than...', action: () => cfRuleDialog('gt') },
    { label: 'Less Than...', action: () => cfRuleDialog('lt') },
    { label: 'Between...', action: () => cfRuleDialog('between') },
    { label: 'Equal To...', action: () => cfRuleDialog('eq') },
    { label: 'Text that Contains...', action: () => cfRuleDialog('contains') },
  ] },
  { label: 'Top/Bottom Rules', icon: 'condfmt', sub: () => [
    { label: 'Top 10 Items...', action: () => cfRuleDialog('top10') },
    { label: 'Bottom 10 Items...', action: () => cfRuleDialog('bottom10') },
    { label: 'Above Average...', action: () => cfRuleDialog('aboveavg') },
  ] },
  { label: 'Data Bars', icon: 'condfmt', sub: () => ['#4472C4', '#70AD47', '#E97132', '#B048B5', '#FFBB00', '#0070C0'].map(c => ({
    html: `<span style="display:inline-block;width:70px;height:14px;background:linear-gradient(90deg,${c} 60%,#eee 60%);margin-right:8px;vertical-align:-2px"></span>Gradient Fill`,
    action: () => cfAdd({ type: 'databar', color: c }, true),
  })) },
  { label: 'Color Scales', icon: 'condfmt', sub: () => [
    { html: scaleSample('#C00000', '#FFC000', '#00B050'), action: () => cfAdd({ type: 'scale', color: '#C00000', color2: '#00B050', color3: '#FFC000' }) },
    { html: scaleSample('#00B050', '#FFC000', '#C00000'), action: () => cfAdd({ type: 'scale', color: '#00B050', color2: '#C00000', color3: '#FFC000' }) },
    { html: scaleSample('#C00000', '#FFFFFF', '#00B050'), action: () => cfAdd({ type: 'scale', color: '#C00000', color2: '#00B050' }) },
    { html: scaleSample('#00B050', '#FFFFFF', '#C00000'), action: () => cfAdd({ type: 'scale', color: '#00B050', color2: '#C00000' }) },
  ] },
  'sep',
  { label: 'Clear Rules', icon: 'clear', sub: () => [
    { label: 'Clear Rules from Selected Cells', action: () => cfClear(false) },
    { label: 'Clear Rules from Entire Sheet', action: () => cfClear(true) },
  ] },
]));
function scaleSample(a, b, c) {
  return `<span style="display:inline-block;width:70px;height:14px;background:linear-gradient(90deg,${a},${b},${c});margin-right:8px;vertical-align:-2px"></span>Color Scale`;
}
function cfRuleDialog(kind) {
  const n = X.normSel();
  const body = el('div');
  const lbl = { gt: 'Format cells that are GREATER THAN:', lt: 'Format cells that are LESS THAN:', eq: 'Format cells that are EQUAL TO:', between: 'Format cells BETWEEN:', contains: 'Format cells that CONTAIN THE TEXT:', top10: 'Format TOP 10 ranked items:', bottom10: 'Format BOTTOM 10 ranked items:', aboveavg: 'Format cells that are ABOVE AVERAGE:' }[kind];
  body.appendChild(el('div', { style: 'margin-bottom:8px;font-size:12px' }, lbl));
  const row = el('div', { class: 'fld-row' });
  const showVal = !['aboveavg'].includes(kind);
  let in1 = null, in2 = null;
  if (showVal) {
    const base = sampleVal(n);
    const f1 = el('div', { class: 'fld' });
    in1 = el('input', { type: 'text', value: kind === 'gt' || kind === 'eq' ? String(base) : kind === 'lt' ? String(base + 10) : kind === 'contains' ? 'text' : kind === 'between' ? String(base) : '10' });
    f1.appendChild(in1);
    row.appendChild(f1);
    if (kind === 'between') {
      const f2 = el('div', { class: 'fld' });
      in2 = el('input', { type: 'text', value: String(base + 20) });
      row.appendChild(el('span', { style: 'align-self:center' }, 'and'));
      f2.appendChild(in2);
      row.appendChild(f2);
    }
  }
  const fs = el('div', { class: 'fld' });
  const sel = X.cSelect([['#FFC7CE|#9C0006', 'Light Red Fill with Dark Red Text'], ['#FFEB9C|#9C6500', 'Yellow Fill with Dark Yellow Text'], ['#C6EFCE|#006100', 'Green Fill with Dark Green Text'], ['#FFC7CE|', 'Light Red Fill'], ['|#9C0006', 'Red Text'], ['custom', 'Custom Format...']], '#FFC7CE|#9C0006');
  fs.appendChild(sel);
  row.appendChild(fs);
  body.appendChild(row);
  X.dlg({
    title: 'New Formatting Rule', body, width: 420,
    buttons: [{
      label: 'OK', pri: true, fn: d => {
        const [bg, fg] = sel.value.split('|');
        const rule = { type: 'rule', kind, v1: in1 ? in1.value : null, v2: in2 ? in2.value : null, bg: bg || null, fg: fg || null };
        cfAdd(rule);
      },
    }, { label: 'Cancel' }],
  });
}
function sampleVal(n) {
  for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) { const v = X.cellRaw(r, c); if (typeof v === 'number') return v; }
  return 50;
}
function cfAdd(rule, isSimple) {
  const sh = X.sheet();
  sh.cfRules = sh.cfRules || [];
  const n = X.normSel();
  const tgt = X.state.sel.type === 'cell' ? n : { r1: 0, c1: 0, r2: X.usedR2(), c2: X.usedC2() };
  sh.cfRules.push({ ...tgt, ...rule });
  X.markDirty(); X.requestRender();
  X.sbMsg('Conditional formatting applied');
}
function cfClear(all) {
  const sh = X.sheet();
  if (all) sh.cfRules = [];
  else {
    const n = X.normSel();
    sh.cfRules = (sh.cfRules || []).filter(cf => cf.r2 < n.r1 || cf.r1 > n.r2 || cf.c2 < n.c1 || cf.c1 > n.c2);
  }
  X.markDirty(); X.requestRender();
}
/* cf evaluation (called by render via X.cfApply) */
let cfCache = { seq: -1, data: new Map() };
X.cfApply = function (r, c, d) {
  const sh = X.sheet();
  const rules = sh.cfRules;
  if (!rules || !rules.length) return null;
  let res = null;
  for (const cf of rules) {
    if (r < cf.r1 || r > cf.r2 || c < cf.c1 || c > cf.c2) continue;
    if (cf.type === 'rule') {
      if (cfMatch(cf, d, r, c)) res = { bg: cf.bg, color: cf.fg || null };
    } else if (cf.type === 'databar') {
      const mm = cfMinMax(cf);
      const v = d && d.t === 'n' ? numOfRow(r, c) : null;
      if (typeof v === 'number' && mm.max > mm.min) {
        const pct = clamp((v - mm.min) / (mm.max - mm.min), 0, 1);
        res = res || {};
        res.bar = { color: cf.color, pct };
      }
    } else if (cf.type === 'scale') {
      const mm = cfMinMax(cf);
      const v = d && d.t === 'n' ? numOfRow(r, c) : null;
      if (typeof v === 'number' && mm.max > mm.min) {
        const pct = clamp((v - mm.min) / (mm.max - mm.min), 0, 1);
        res = res || {};
        if (cf.color3) res.bg = pct < 0.5 ? lerpColor(cf.color, cf.color2, pct * 2) : lerpColor(cf.color2, cf.color3, (pct - 0.5) * 2);
        else res.bg = lerpColor(cf.color, cf.color2, pct);
      }
    }
  }
  return res;
};
function lerpColor(c1, c2, t, c2alt) {
  const b = c2alt !== undefined ? c2alt : c2;
  const h = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const [r1, g1, b1] = h(c1), [r2, g2, b2] = h(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}
function numOfRow(r, c) { const v = X.cellRaw(r, c); return typeof v === 'number' ? v : NaN; }
function cfMinMax(cf) {
  let min = Infinity, max = -Infinity;
  for (let r = cf.r1; r <= cf.r2; r++) for (let c = cf.c1; c <= cf.c2; c++) { const v = numOfRow(r, c); if (typeof v === 'number' && !isNaN(v)) { if (v < min) min = v; if (v > max) max = v; } }
  if (!isFinite(min)) { min = 0; max = 1; }
  return { min, max };
}
function cfMatch(cf, d, r, c) {
  const txt = d ? d.text : '';
  const v = numOfRow(r, c);
  const isNum = !isNaN(v);
  const f = s => { const n = parseFloat(s); return isNaN(n) ? s : n; };
  switch (cf.kind) {
    case 'gt': { const t = f(cf.v1); return isNum && typeof t === 'number' ? v > t : txt > String(cf.v1); }
    case 'lt': { const t = f(cf.v1); return isNum && typeof t === 'number' ? v < t : txt < String(cf.v1); }
    case 'eq': { const t = f(cf.v1); return isNum && typeof t === 'number' ? v === t : txt.toLowerCase() === String(cf.v1).toLowerCase(); }
    case 'between': { const t1 = f(cf.v1), t2 = f(cf.v2); return isNum && v >= Math.min(t1, t2) && v <= Math.max(t1, t2); }
    case 'contains': return txt.toLowerCase().includes(String(cf.v1).toLowerCase());
    case 'top10': { const n2 = parseInt(cf.v1, 10) || 10; const vals = cfVals(cf); vals.sort((a, b) => b - a); return isNum && vals.indexOf(v) < n2; }
    case 'bottom10': { const n2 = parseInt(cf.v1, 10) || 10; const vals = cfVals(cf); vals.sort((a, b) => a - b); return isNum && vals.indexOf(v) < n2; }
    case 'aboveavg': { const vals = cfVals(cf); const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1); return isNum && v > avg; }
  }
  return false;
}
function cfVals(cf) {
  const vals = [];
  for (let r = cf.r1; r <= cf.r2; r++) for (let c = cf.c1; c <= cf.c2; c++) { const v = numOfRow(r, c); if (!isNaN(v)) vals.push(v); }
  return vals;
}
/* table style gallery */
const TSTYLES = [
  ['Plain Grid', null],
  ['Light Blue', { hd: '#4472C4', hdTx: '#fff', band: '#D6E4F0', line: '#B4C6E7' }],
  ['Light Green', { hd: '#70AD47', hdTx: '#fff', band: '#E2EFDA', line: '#C6E0B4' }],
  ['Light Orange', { hd: '#ED7D31', hdTx: '#fff', band: '#FCE4D6', line: '#F8CBAD' }],
  ['Light Purple', { hd: '#7030A0', hdTx: '#fff', band: '#E6E0EC', line: '#CFBBE0' }],
  ['Light Yellow', { hd: '#FFC000', hdTx: '#333', band: '#FFF2CC', line: '#FFE699' }],
  ['Medium Blue', { hd: '#215967', hdTx: '#fff', band: '#5B9BD5', bandTx: '#fff', line: '#9DC3E6' }],
  ['Medium Green', { hd: '#548235', hdTx: '#fff', band: '#A9D08E', line: '#C6E0B4' }],
  ['Dark Blue', { hd: '#2F5597', hdTx: '#fff', band: '#8EAADB', bandTx: '#fff', line: '#B4C6E7' }],
  ['Dark Red', { hd: '#833C00', hdTx: '#fff', band: '#F4B183', line: '#F8CBAD' }],
  ['Dark Gray', { hd: '#3B3838', hdTx: '#fff', band: '#AEAAAA', bandTx: '#fff', line: '#D0CECE' }],
];
MENU_BUILDERS.tableStyleMenu = a => {
  const gal = el('div', { class: 'tstyle-gal' });
  gal.appendChild(el('div', { class: 'tstyle-hdr' }, 'Light'));
  TSTYLES.concat([['Medium Mix', { hd: '#4472C4', hdTx: '#fff', band: '#8EAADB', bandTx: '#fff', line: '#B4C6E7' }]]).forEach(([name, st], idx) => {
    if (idx === 8) gal.appendChild(el('div', { class: 'tstyle-hdr' }, 'Medium / Dark'));
    const card = el('div', { class: 'tstyle', title: name });
    card.innerHTML = tstyleThumb(st);
    card.addEventListener('click', () => { X.closeAllPops(); applyTableStyle(st, name); });
    gal.appendChild(card);
  });
  pop(a, gal);
};
function tstyleThumb(st) {
  if (!st) return '<div class="ts" style="grid-template-rows:repeat(4,13px)"><span style="border:1px solid #ccc"></span><span style="border:1px solid #ccc"></span><span style="border:1px solid #ccc"></span><span style="border:1px solid #ccc"></span></div>';
  let h = '';
  for (let r = 0; r < 4; r++) {
    const bg = r === 0 ? st.hd : (r % 2 ? '#fff' : st.band);
    for (let ccol = 0; ccol < 2; ccol++) h += `<span style="background:${bg};border-bottom:1px solid ${st.line}"></span>`;
  }
  return `<div class="ts">${h}</div>`;
}
function applyTableStyle(st, name) {
  const s = X.state.sel;
  const n = s.type === 'cell' && !X.isSingleCell() ? X.normSel() : X.regionUsed();
  X.pushUndo('Format as Table');
  const sh = X.sheet();
  const id = 'tbl' + Date.now().toString(36);
  sh.tables[id] = { r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2, name: name.replace(/\s+/g, '') + id.slice(-3), style: st, headerRow: true, filter: {}, isAutoFilter: false };
  if (st) paintTable(sh.tables[id]);
  X.markDirty(); X.afterDataChange();
  X.sbMsg(`Table "${sh.tables[id].name}" created — use the header arrows to sort and filter`);
}
X.isSingleCell = () => { const s = X.state.sel; return s.a.r === s.b.r && s.a.c === s.b.c; };
function paintTable(t) {
  const st = t.style;
  if (!st) return;
  X.pushUndo('Table Style');
  for (let r = t.r1; r <= t.r2; r++) {
    for (let c = t.c1; c <= t.c2; c++) {
      const cd = X.cellEnsure(r, c);
      cd.s = cd.s || {};
      if (r === t.r1) { cd.s.bg = st.hd; cd.s.color = st.hdTx; cd.s.b = true; }
      else cd.s.bg = (r - t.r1) % 2 === 0 ? st.band : (st.bandTx ? st.band : '#FFFFFF'), cd.s.color = st.bandTx && (r - t.r1) % 2 === 0 ? st.bandTx : undefined;
      cd.s.bB = { w: 1, st: 'solid', cl: st.line };
      if (c === t.c1) cd.s.bL = { w: 1, st: 'solid', cl: st.hd };
      if (c === t.c2) cd.s.bR = { w: 1, st: 'solid', cl: st.hd };
    }
  }
}
/* cell styles gallery */
const CSTYLES = [
  { name: 'Normal', s: null },
  { name: 'Bad', s: { bg: '#FFC7CE', color: '#9C0006' } },
  { name: 'Good', s: { bg: '#C6EFCE', color: '#006100' } },
  { name: 'Neutral', s: { bg: '#FFEB9C', color: '#9C6500' } },
  { name: 'Calculation', s: { bg: '#F2F2F2', color: '#FF9900', b: false, border: true } },
  { name: 'Input', s: { bg: '#FFCC99', color: '#3F3F76', border: true } },
  { name: 'Warning Text', s: { color: '#C00000' } },
  { name: 'Heading 1', s: { b: true, size: 15, color: '#1F4E78', bB: true } },
  { name: 'Heading 2', s: { b: true, size: 12, color: '#1F4E78', bB: true } },
  { name: 'Title', s: { b: true, size: 16, color: '#1F4E78' } },
  { name: 'Total', s: { b: true, bT: true, bB: 'double' } },
  { name: 'Accent 1', s: { bg: '#4472C4', color: '#FFFFFF' } },
  { name: 'Accent 2', s: { bg: '#ED7D31', color: '#FFFFFF' } },
  { name: 'Accent 3', s: { bg: '#A5A5A5', color: '#FFFFFF' } },
  { name: 'Accent 4', s: { bg: '#FFC000', color: '#FFFFFF' } },
  { name: 'Accent 5', s: { bg: '#5B9BD5', color: '#FFFFFF' } },
  { name: 'Accent 6', s: { bg: '#70AD47', color: '#FFFFFF' } },
  { name: 'Comma', s: { fmt: '#,##0.00' } },
  { name: 'Currency', s: { fmt: '$#,##0.00;($#,##0.00)' } },
  { name: 'Percent', s: { fmt: '0.00%' } },
];
MENU_BUILDERS.cellStyleMenu = a => {
  const gal = el('div', { class: 'cstyle-gal' });
  CSTYLES.forEach(cs => {
    const card = el('div', { class: 'cstyle', title: cs.name }, esc(cs.name));
    if (cs.s) {
      if (cs.s.bg) card.style.background = cs.s.bg;
      if (cs.s.color) card.style.color = cs.s.color;
      if (cs.s.b) card.style.fontWeight = '700';
    }
    card.addEventListener('click', () => {
      X.closeAllPops();
      X.pushUndo('Cell Style');
      const s = cs.s || {};
      X.applyStyle(st => {
        Object.assign(st, {
          bg: s.bg !== undefined ? s.bg : undefined,
          color: s.color !== undefined ? s.color : undefined,
          b: s.b !== undefined ? s.b : undefined,
          size: s.size !== undefined ? s.size : undefined,
          bB: s.bB === true ? { w: 1, st: 'solid', cl: '#4F81BD' } : s.bB === 'double' ? { w: 1, st: 'double', cl: '#4F81BD' } : s.bB,
          bT: s.bT === true ? { w: 1, st: 'solid', cl: '#4F81BD' } : undefined,
        });
      }, 'Cell Style');
      if (s.fmt) X.setNumFmt(s.fmt);
    });
    gal.appendChild(card);
  });
  pop(a, gal);
};
MENU_BUILDERS.insertMenu = a => pop(a, menu([
  { label: 'Insert Cells...', icon: 'insertcells', action: () => X.insertDialog() },
  { label: 'Insert Sheet Rows', icon: 'insertcells', action: () => X.insertRowsAt(X.normSel().r1, X.normSel().r2 - X.normSel().r1 + 1) },
  { label: 'Insert Sheet Columns', icon: 'insertcells', action: () => X.insertColsAt(X.normSel().c1, X.normSel().c2 - X.normSel().c1 + 1) },
  { label: 'Insert Sheet', icon: 'sheetico', action: () => X.addSheet() },
]));
MENU_BUILDERS.deleteMenu = a => pop(a, menu([
  { label: 'Delete Cells...', icon: 'deletecells', action: () => X.deleteDialog() },
  { label: 'Delete Sheet Rows', icon: 'deletecells', action: () => X.deleteRowsAt(X.normSel().r1, X.normSel().r2 - X.normSel().r1 + 1) },
  { label: 'Delete Sheet Columns', icon: 'deletecells', action: () => X.deleteColsAt(X.normSel().c1, X.normSel().c2 - X.normSel().c1 + 1) },
  { label: 'Delete Sheet', icon: 'sheetico', action: () => X.deleteSheet(state.active) },
]));
MENU_BUILDERS.formatMenu = a => pop(a, menu([
  { label: 'Row Height...', icon: 'formatcells', action: () => numDlg('Row Height', 'Row height:', (sheet().rowH[state.sel.a.r] != null ? sheet().rowH[state.sel.a.r] : X.DEFAULT_ROWH).toFixed(1), v => { const n = X.normSel(); for (let r = n.r1; r <= n.r2; r++) sheet().rowH[r] = clamp(v, 1, 400); afterGeom(); }) },
  { label: 'AutoFit Row Height', action: () => { const n = X.normSel(); for (let r = n.r1; r <= n.r2; r++) X.autofitRow(r); } },
  { label: 'Column Width...', icon: 'formatcells', action: () => numDlg('Column Width', 'Column width:', (sheet().colW[state.sel.a.c] != null ? sheet().colW[state.sel.a.c] : X.DEFAULT_COLW).toFixed(1), v => { const n = X.normSel(); for (let c = n.c1; c <= n.c2; c++) sheet().colW[c] = clamp(v, 4, 400); afterGeom(); }) },
  { label: 'AutoFit Column Width', action: () => { const n = X.normSel(); for (let c = n.c1; c <= n.c2; c++) X.autofitCol(c); } },
  'sep',
  { label: 'Hide & Unhide', icon: 'options', sub: () => [
    { label: 'Hide Rows', action: X.hideRows },
    { label: 'Hide Columns', action: X.hideCols },
    { label: 'Unhide Rows', action: () => X.unhideRows(0, X.MAXR - 1) },
    { label: 'Unhide Columns', action: () => X.unhideCols(0, X.MAXC) },
  ] },
  'sep',
  { label: 'Format Cells...', icon: 'formatcells', note: 'Ctrl+1', action: () => X.formatCellsDialog() },
]));
function afterGeom() { X.rebuildGeom(); X.requestRender(); X.markDirty(); }
function numDlg(title, lab, val, fn) {
  const body = el('div');
  const f = el('div', { class: 'fld' });
  f.innerHTML = `<span>${esc(lab)}</span>`;
  const inp = el('input', { type: 'text', value: val });
  f.appendChild(inp); body.appendChild(f);
  X.dlg({ title, body, width: 240, buttons: [{ label: 'OK', pri: true, fn: () => { const v = parseFloat(inp.value); if (!isNaN(v)) fn(v); } }, { label: 'Cancel' }] });
}
MENU_BUILDERS.autosumMenu = a => pop(a, menu([
  { label: 'Sum', icon: 'autosum', action: () => X.autoSum('SUM') },
  { label: 'Average', action: () => X.autoSum('AVERAGE') },
  { label: 'Count Numbers', action: () => X.autoSum('COUNT') },
  { label: 'Max', action: () => X.autoSum('MAX') },
  { label: 'Min', action: () => X.autoSum('MIN') },
  'sep',
  { label: 'More Functions...', icon: 'morefuncs', action: () => X.insertFnDialog() },
]));
MENU_BUILDERS.fillMenu = a => pop(a, menu([
  { label: 'Down', icon: 'fill', note: 'Ctrl+D', action: X.fillDown },
  { label: 'Right', icon: 'fill', note: 'Ctrl+R', action: X.fillRight },
  { label: 'Up', action: () => fillUpLeft('up') },
  { label: 'Left', action: () => fillUpLeft('left') },
  'sep',
  { label: 'Series...', action: () => X.seriesDialog() },
  { label: 'Justify', off: true },
  { label: 'Flash Fill', off: true },
]));
function fillUpLeft(which) {
  const n = X.normSel();
  X.pushUndo('Fill');
  const sh = X.sheet();
  if (which === 'up') {
    for (let c = n.c1; c <= n.c2; c++) {
      const src = X.cellGet(n.r2, c); if (!src) continue;
      for (let r = n.r2 - 1; r >= n.r1; r--) { const cd = X.cellEnsure(r, c); const copy = JSON.parse(JSON.stringify(src)); if (copy.t === 'f') copy.v = Calc.adjustFormula(copy.v, 0, r - n.r2); Object.assign(cd, copy); }
    }
  } else {
    for (let r = n.r1; r <= n.r2; r++) {
      const src = X.cellGet(r, n.c2); if (!src) continue;
      for (let c = n.c2 - 1; c >= n.c1; c--) { const cd = X.cellEnsure(r, c); const copy = JSON.parse(JSON.stringify(src)); if (copy.t === 'f') copy.v = Calc.adjustFormula(copy.v, c - n.c2, 0); Object.assign(cd, copy); }
    }
  }
  X.scheduleRecalc(); X.markDirty(); X.requestRender();
}
MENU_BUILDERS.clearMenu = a => pop(a, menu([
  { label: 'Clear All', icon: 'clear', action: X.clearAll },
  { label: 'Clear Formats', action: X.clearFormats },
  { label: 'Clear Contents', note: 'Del', action: X.clearContents },
  { label: 'Clear Comments and Notes', action: () => { X.pushUndo('Clear Notes'); X.eachRangeCell((r, c) => { const k = keyOf(r, c); if (sheet().notes[k]) delete sheet().notes[k]; }); X.markDirty(); X.requestRender(); } },
]));
MENU_BUILDERS.sortFilterMenu = a => {
  const f = X.filterRegion();
  pop(a, menu([
    { label: 'Sort A to Z', icon: 'sortaz', action: () => X.sortSelection(1) },
    { label: 'Sort Z to A', icon: 'sortza', action: () => X.sortSelection(-1) },
    { label: 'Custom Sort...', icon: 'sortdlg', action: () => X.sortDialog() },
    'sep',
    { label: 'Filter', icon: 'filter', check: !!f, action: () => X.toggleFilter() },
    { label: 'Clear', icon: 'filterclr', off: !f || !Object.keys(f ? f.filter : {}).length, action: () => { const t = X.filterRegion(); if (t) { t.filter = {}; X.applyFilter(); } } },
    { label: 'Reapply', icon: 'refresh', off: !f, action: () => X.applyFilter() },
  ]));
};
MENU_BUILDERS.findMenu = a => pop(a, menu([
  { label: 'Find...', icon: 'find', note: 'Ctrl+F', action: () => X.openFindbar(false) },
  { label: 'Replace...', icon: 'replace', note: 'Ctrl+H', action: () => X.openFindbar(true) },
  'sep',
  { label: 'Go To...', icon: 'search', note: 'Ctrl+G', action: () => $('#namebox').dispatchEvent(new MouseEvent('click')) },
  { label: 'Go To Special: Formulas', action: () => gotoSpecial('formula') },
  { label: 'Go To Special: Constants', action: () => gotoSpecial('const') },
  { label: 'Go To Special: Blanks', action: () => gotoSpecial('blank') },
]));
function gotoSpecial(kind) {
  const n = X.normSel();
  const sel = X.state.sel;
  let found = [];
  const consider = (r, c) => {
    const cd = X.cellGet(r, c);
    if (kind === 'blank' && !cd) return true;
    if (kind === 'formula' && cd && cd.t === 'f') return true;
    if (kind === 'const' && cd && cd.t !== 'f') return true;
    return false;
  };
  for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) if (consider(r, c)) found.push({ r, c });
  if (!found.length) { X.sbMsg('No cells were found.'); return; }
  const first = found.shift();
  X.setSel(first, first);
  sel.ranges = found.map(p => ({ r1: p.r, c1: p.c, r2: p.r, c2: p.c })).slice(0, 400);
  X.afterSelChange();
  X.sbMsg(`${found.length + 1} cells selected`);
}
MENU_BUILDERS.shapesMenu = a => pop(a, menu([
  { label: 'Rectangle', html: '<svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="3.5" width="12" height="9" fill="none" stroke="#4472C4" stroke-width="1.5"/></svg> Rectangle', action: () => X.insertShape('rect') },
  { label: 'Oval', html: '<svg viewBox="0 0 16 16" width="16" height="16"><ellipse cx="8" cy="8" rx="6" ry="4.8" fill="none" stroke="#4472C4" stroke-width="1.5"/></svg> Oval', action: () => X.insertShape('oval') },
  { label: 'Right Arrow', html: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 6h8V3l4 5-4 5v-3H2z" fill="none" stroke="#4472C4" stroke-width="1.3"/></svg> Right Arrow', action: () => X.insertShape('arrow') },
  { label: 'Line', html: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 14 14 2" stroke="#4472C4" stroke-width="1.6"/></svg> Line', action: () => X.insertShape('line') },
  'sep',
  { label: 'Text Box', icon: 'textbox', action: () => CMDS.textbox.exec() },
]));
MENU_BUILDERS.symbolsMenu = a => pop(a, menu([
  { label: 'Symbol', icon: 'symbol', action: () => X.symbolDialog() },
  { label: 'Equation (Σ)', off: true },
]));
MENU_BUILDERS.chartColMenu = a => pop(a, chartGallery([['col', 'Clustered Column'], ['bar', 'Clustered Bar']]));
MENU_BUILDERS.chartLineMenu = a => pop(a, chartGallery([['line', 'Line'], ['area', 'Area']]));
MENU_BUILDERS.chartPieMenu = a => pop(a, chartGallery([['pie', 'Pie'], ['doughnut', 'Doughnut']]));
MENU_BUILDERS.chartXYMenu = a => pop(a, chartGallery([['scatter', 'Scatter']]));
/* does ANY stored cell inside `range` carry a value/formula?
   O(#non-empty cells) — safe even for whole-column selections */
function rangeHasValues(range) {
  const cells = sheet().cells;
  for (const k in cells) {
    const i = k.indexOf(',');
    const r = +k.slice(0, i), c = +k.slice(i + 1);
    if (r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2) {
      const cd = cells[k];
      if (cd && ((cd.v !== undefined && cd.v !== null && cd.v !== '') || cd.f)) return true;
    }
  }
  return false;
}
function chartGallery(kinds) {
  const g = el('div', { style: 'display:grid;grid-template-columns:repeat(2,110px);gap:6px;padding:8px' });
  let pv = null;
  const kill = () => { if (pv) { pv.remove(); pv = null; } };
  kinds.forEach(([k, name]) => {
    const card = el('div', { class: 'tstyle', style: 'padding:6px;text-align:center;font-size:10px' });
    card.innerHTML = chartThumb(k) + `<div style="margin-top:4px">${esc(name)}</div>`;
    card.addEventListener('click', () => { X.closeAllPops(); X.insertChart(k); });
    /* Excel-style LIVE PREVIEW: hovering a chart type renders the real chart
       built from the current data, in a floating pane next to the gallery */
    card.addEventListener('mouseenter', () => {
      kill();
      const range = X.detectChartRange ? X.detectChartRange() : null;
      /* a range that CONTAINS NOTHING (empty book, or an empty multi-cell selection)
         still deserves a live preview — fall through to sample data */
      const hasData = range && rangeHasValues(range);
      let fake, footnote;
      if (hasData) {
        fake = { id: 'objpreview01', kind: 'chart', chart: { type: k, title: 'Chart Title', range, byRow: false, legend: 'right' } };
        footnote = 'Source: ' + a1(range.r1, range.c1) + ':' + a1(range.r2, range.c2) + ' — click to insert';
      } else {
        /* no data selected — STILL show a live preview built from sample data */
        fake = { id: 'objpreview02', kind: 'chart', sample: true, chart: { type: k, title: 'Chart Title', range: { r1: -1, c1: -1, r2: -3, c2: -1 }, byRow: false, legend: 'right' } };
        footnote = 'Sample preview — select your data for a real preview, click to insert';
      }
      let bodyHtml;
      let svg = '';
      try { svg = X.chartSVG(fake, 356, 224) || ''; } catch (e) { svg = ''; }
      bodyHtml = svg || `<div class="cp-nodata">Select cells with data first, then hover to see a live preview.</div>`;
      pv = el('div', { class: 'chart-preview' });
      pv.innerHTML = `<div class="cp-h">${chartThumb(k)}<span>${esc(name)} — Live Preview</span></div>` +
        `<div class="cp-b">${bodyHtml}</div>` +
        `<div class="cp-f">${esc(footnote)}</div>`;
      const popEl = card.closest('.popup');
      (popEl || document.body).appendChild(pv);
      const r = (popEl || card).getBoundingClientRect();
      const pvW = 372, pvH = pv.offsetHeight || 300;
      /* placement tiers: right of gallery → left of gallery → below it */
      let x = r.right + 14, y = r.top - 4;
      if (x + pvW > window.innerWidth - 8) x = r.left - pvW - 14;
      if (x < 8) { x = clamp(r.left, 8, Math.max(8, window.innerWidth - pvW - 8)); y = r.bottom + 10; }
      y = clamp(y, 8, Math.max(8, window.innerHeight - pvH - 8));
      pv.style.left = x + 'px'; pv.style.top = y + 'px';
    });
    card.addEventListener('mouseleave', kill);
    g.appendChild(card);
  });
  return g;
}
function chartThumb(kind) {
  const C = '#4472C4', O = '#ED7D31';
  if (kind === 'col') return `<svg viewBox="0 0 60 44" width="90"><path d="M6 4v34h50" fill="none" stroke="#999"/><rect x="12" y="18" width="7" height="20" fill="${C}"/><rect x="21" y="24" width="7" height="14" fill="${O}"/><rect x="32" y="12" width="7" height="26" fill="${C}"/><rect x="41" y="8" width="7" height="30" fill="${O}"/></svg>`;
  if (kind === 'bar') return `<svg viewBox="0 0 60 44" width="90"><path d="M6 4v34h50" fill="none" stroke="#999"/><rect x="6" y="10" width="26" height="6" fill="${C}"/><rect x="6" y="19" width="38" height="6" fill="${O}"/><rect x="6" y="28" width="20" height="6" fill="${C}"/></svg>`;
  if (kind === 'line') return `<svg viewBox="0 0 60 44" width="90"><path d="M6 4v34h50" fill="none" stroke="#999"/><path d="M8 30 20 18l10 6 14-12" fill="none" stroke="${C}" stroke-width="2"/><path d="M8 34 20 28l10 4 14-8" fill="none" stroke="${O}" stroke-width="2"/></svg>`;
  if (kind === 'area') return `<svg viewBox="0 0 60 44" width="90"><path d="M6 4v34h50" fill="none" stroke="#999"/><path d="M8 32 20 16l10 8 14-14v28H8z" fill="${C}" opacity=".7"/></svg>`;
  if (kind === 'pie') return `<svg viewBox="0 0 60 44" width="90"><circle cx="26" cy="22" r="17" fill="${C}"/><path d="M26 22V5a17 17 0 0 1 15.6 10z" fill="${O}"/><path d="M26 22l15.6-7A17 17 0 0 1 36 37z" fill="#A5A5A5"/></svg>`;
  if (kind === 'doughnut') return `<svg viewBox="0 0 60 44" width="90"><circle cx="26" cy="22" r="17" fill="${C}"/><circle cx="26" cy="22" r="9" fill="#fff"/><path d="M26 22V5a17 17 0 0 1 15.6 10z" fill="${O}"/></svg>`;
  return `<svg viewBox="0 0 60 44" width="90"><path d="M6 4v34h50" fill="none" stroke="#999"/><circle cx="14" cy="28" r="2.4" fill="${C}"/><circle cx="22" cy="20" r="2.4" fill="${C}"/><circle cx="30" cy="24" r="2.4" fill="${C}"/><circle cx="38" cy="14" r="2.4" fill="${C}"/><circle cx="46" cy="10" r="2.4" fill="${C}"/></svg>`;
}
MENU_BUILDERS.marginsMenu = a => pop(a, menu([
  { label: 'Normal', note: 'T/B .75", L/R .7"', action: () => setMargins([.75, .7, .75, .7]) },
  { label: 'Wide', note: 'All 1"', action: () => setMargins([1, 1, 1, 1]) },
  { label: 'Narrow', note: 'T/B .75", L/R .25"', action: () => setMargins([.75, .25, .75, .25]) },
]));
function setMargins(arr) {
  state.page.margins = { t: arr[0], r: arr[1], b: arr[2], l: arr[3] };
  state.page.view = state.view;
  X.markDirty(); X.requestRender();
  X.sbMsg('Margins applied (used when printing)');
}
MENU_BUILDERS.orientMenu = a => pop(a, menu([
  { label: 'Portrait', check: state.page.orient === 'portrait', action: () => { state.page.orient = 'portrait'; X.requestRender(); X.markDirty(); } },
  { label: 'Landscape', check: state.page.orient === 'landscape', action: () => { state.page.orient = 'landscape'; X.requestRender(); X.markDirty(); } },
]));
MENU_BUILDERS.sizeMenu = a => pop(a, menu([
  { label: 'Letter (8.5" x 11")', check: state.page.size === 'Letter', action: () => setPaper('Letter', 8.5, 11) },
  { label: 'Legal (8.5" x 14")', check: state.page.size === 'Legal', action: () => setPaper('Legal', 8.5, 14) },
  { label: 'A4 (8.27" x 11.69")', check: state.page.size === 'A4', action: () => setPaper('A4', 8.27, 11.69) },
  { label: 'A5 (5.83" x 8.27")', check: state.page.size === 'A5', action: () => setPaper('A5', 5.83, 8.27) },
]));
function setPaper(name, w, h) { state.page.size = name; state.page.w = w; state.page.h = h; X.markDirty(); X.requestRender(); }
MENU_BUILDERS.printAreaMenu = a => pop(a, menu([
  { label: 'Set Print Area', action: () => { state.printArea = X.normSel(); X.markDirty(); X.sbMsg(`Print area set to ${a1(state.printArea.r1, state.printArea.c1)}:${a1(state.printArea.r2, state.printArea.c2)}`); } },
  { label: 'Clear Print Area', off: !state.printArea, action: () => { state.printArea = null; X.markDirty(); } },
]));
MENU_BUILDERS.breaksMenu = a => pop(a, menu([
  { label: 'Insert Page Break', action: () => {
    const r = X.state.sel.a.r;
    if (!state.pageBreaks.includes(r)) state.pageBreaks.push(r);
    state.pageBreaks.sort((x, y) => x - y);
    X.markDirty(); X.requestRender();
    X.sbMsg(`Manual page break inserted above row ${r + 1} (see Page Break Preview)`);
  } },
  { label: 'Remove Page Break', off: !state.pageBreaks.length, action: () => {
    const r = X.state.sel.a.r;
    const i = state.pageBreaks.indexOf(r);
    if (i >= 0) state.pageBreaks.splice(i, 1);
    X.markDirty(); X.requestRender();
  } },
  { label: 'Reset All Page Breaks', off: !state.pageBreaks.length, action: () => { state.pageBreaks = []; X.markDirty(); X.requestRender(); } },
]));
MENU_BUILDERS.freezeMenu = a => {
  const fz = X.sheet().freeze;
  pop(a, menu([
    { label: 'Freeze Panes', icon: 'freeze', check: fz.r > 0 || fz.c > 0, action: () => freezeAt() },
    { label: 'Freeze Top Row', action: () => { X.sheet().freeze = { r: 1, c: 0 }; frozen(); } },
    { label: 'Freeze First Column', action: () => { X.sheet().freeze = { r: 0, c: 1 }; frozen(); } },
    'sep',
    { label: 'Unfreeze Panes', icon: 'clear', off: !(fz.r || fz.c), action: () => { X.sheet().freeze = { r: 0, c: 0 }; frozen(); } },
  ]));
};
function freezeAt() {
  const s = X.state.sel;
  X.sheet().freeze = { r: s.a.r, c: s.a.c };
  frozen();
}
function frozen() {
  X.markDirty(); X.rebuildGeom(); X.requestRender();
  const fz = X.sheet().freeze;
  X.sbMsg(fz.r || fz.c ? `Frozen: ${fz.r ? fz.r + ' row(s)' : ''}${fz.r && fz.c ? ' + ' : ''}${fz.c ? fz.c + ' column(s)' : ''}` : 'Panes unfrozen');
}
X.freezeAt = freezeAt;
MENU_BUILDERS.autosumMenu = MENU_BUILDERS.autosumMenu;
MENU_BUILDERS.logicalMenu = a => pop(a, menu(fnMenuItems('Logical')));
MENU_BUILDERS.textMenu = a => pop(a, menu(fnMenuItems('Text')));
MENU_BUILDERS.dateTimeMenu = a => pop(a, menu(fnMenuItems('Date & Time')));
MENU_BUILDERS.lookupMenu = a => pop(a, menu(fnMenuItems('Lookup & Reference')));
MENU_BUILDERS.mathMenu = a => pop(a, menu(fnMenuItems('Math & Trig')));
MENU_BUILDERS.moreFuncsMenu = a => pop(a, menu([
  { label: 'Statistical', sub: () => fnMenuItems('Statistical') },
  { label: 'Information', sub: () => fnMenuItems('Information') },
  'sep',
  { label: 'Insert Function...', icon: 'insertfx', action: () => X.insertFnDialog() },
]));
MENU_BUILDERS.defineNameMenu = a => pop(a, menu([
  { label: 'Define Name...', action: () => X.defineNameDialog() },
  { label: 'Apply Names...', off: true },
  'sep',
  { label: 'Name Manager...', note: 'Ctrl+F3', action: () => X.nameManagerDialog() },
]));
MENU_BUILDERS.calcOptsMenu = a => pop(a, menu([
  { label: 'Automatic', check: state.calcMode === 'auto', action: () => { state.calcMode = 'auto'; X.sbMsg('Calculation: Automatic'); } },
  { label: 'Manual', check: state.calcMode === 'manual', action: () => { state.calcMode = 'manual'; X.sbMsg('Calculation: Manual — press Calculate Now or F9 to recalculate'); } },
  'sep',
  { label: 'Calculate Now', note: 'F9', action: () => { X.recalcAll(); X.requestRender(); X.sbMsg('Workbook recalculated'); } },
  { label: 'Calculate Sheet', action: () => { X.recalcAll(); X.requestRender(); } },
]));
MENU_BUILDERS.groupMenu = a => pop(a, menu([
  { label: 'Group Rows', action: () => X.groupSel('r') },
  { label: 'Group Columns', action: () => X.groupSel('c') },
]));
MENU_BUILDERS.ungroupMenu = a => pop(a, menu([
  { label: 'Ungroup Rows', action: () => X.ungroupSel('r') },
  { label: 'Ungroup Columns', action: () => X.ungroupSel('c') },
]));
MENU_BUILDERS.dataValMenu = a => pop(a, menu([
  { label: 'Data Validation...', icon: 'dataval', action: () => X.dataValDialog() },
  { label: 'Clear Validation Circles', icon: 'clear', action: () => { sheet().cfRules = (sheet().cfRules || []).filter(x => x.type !== 'invalid'); X.requestRender(); } },
]));
MENU_BUILDERS.protectMenu = a => pop(a, menu([
  { label: state.protected ? 'Unprotect Sheet...' : 'Protect Sheet...', icon: 'protect', action: () => X.protectDialog() },
  { label: 'Protect Workbook Structure', off: true },
]));
MENU_BUILDERS.symbolsMenu = a => pop(a, menu([
  { label: 'Symbol...', icon: 'symbol', action: () => X.symbolDialog() },
]));
MENU_BUILDERS.themeColorsMenu = a => pop(a, menu([
  { hdr: 1, label: 'Office Themes' },
  { label: 'Office (Green)', html: themeSample(['#217346', '#4472C4', '#ED7D31', '#FFC000']), check: state.theme.name === 'Office', action: () => X.applyTheme('Office', '#217346', ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']) },
  { label: 'Blue', html: themeSample(['#2B579A', '#4472C4', '#70AD47', '#FFC000']), action: () => X.applyTheme('Blue', '#2B579A', ['#2B579A', '#70AD47', '#FFC000', '#C00000', '#7030A0', '#ED7D31']) },
  { label: 'Violet', html: themeSample(['#7030A0', '#A64D79', '#00B0F0', '#FFC000']), action: () => X.applyTheme('Violet', '#7030A0', ['#7030A0', '#A64D79', '#00B0F0', '#FFC000', '#70AD47', '#4472C4']) },
  { label: 'Grayscale', html: themeSample(['#323F4F', '#777', '#aaa', '#ccc']), action: () => X.applyTheme('Grayscale', '#323F4F', ['#323F4F', '#5A6B7A', '#828F9B', '#ADB6BE', '#D3D8DC', '#EDEDED']) },
]));
function themeSample(colors) {
  return colors.map(c => `<span style="display:inline-block;width:11px;height:11px;background:${c};margin-right:2px;border:1px solid rgba(0,0,0,.15);vertical-align:-1px"></span>`).join('') + ' ';
}
MENU_BUILDERS.themeFontsMenu = a => pop(a, menu(['Calibri', 'Calibri Light', 'Cambria', 'Georgia', 'Arial', 'Consolas'].map(f => ({
  label: f, html: `<span style="font-family:'${f}',sans-serif">AaBbCcDd — ${f}</span>`, check: state.fonts === f,
  action: () => { applyThemeFont(f); },
}))));
function applyThemeFont(f) {
  X.pushUndo('Theme Fonts');
  state.fonts = f;
  document.documentElement.style.setProperty('--cell-font', `'${f}',sans-serif`);
  X.eachSsheet(sh => { });
  X.markDirty(); X.requestRender();
}
X.eachSsheet = fn => state.sheets.forEach(fn);
X.applyTheme = (name, accent, colors) => {
  X.pushUndo('Theme');
  state.theme = { name, accent, colors };
  applyAccent(accent);
  X.markDirty(); X.requestRender();
  X.sbMsg(`Theme "${name}" applied — workbook accent color and chart colors updated`);
};
function applyAccent(accent) {
  const d1 = shade(accent, -8), d2 = shade(accent, -18);
  const root = document.documentElement.style;
  root.setProperty('--acc', accent);
  root.setProperty('--acc-d', d1);
  root.setProperty('--acc-dd', d2);
  root.setProperty('--sel-bdr', accent);
  root.setProperty('--acc-t', accent + '1A');
  root.setProperty('--sel-fill', accent + '17');
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
X.applyAccent = applyAccent;

/* ============================ CMDS ============================ */
const CMDS = X.CMDS = {
  /* clipboard */
  paste: { exec: () => { const s = X.state.sel; X.pasteAt(s.a.r, s.a.c); } },
  cut: { exec: () => X.copySel(true) },
  copy: { exec: () => X.copySel(false) },
  painter: { exec: (e, b) => {
    if (state.painter) { state.painter = null; b.classList.remove('on'); X.sbMsg('Format Painter off'); return; }
    const s = X.state.sel;
    const cd = X.cellGet(s.a.r, s.a.c);
    state.painter = { s: cd ? JSON.parse(JSON.stringify(cd.s || {})) : {}, f: cd ? cd.f : null };
    b.classList.add('on');
    X.sbMsg('Format Painter: select destination cells to apply formatting');
    const once = () => {
      if (state.painter) {
        X.pushUndo('Format Painter');
        X.applyStyle(st => { Object.assign(st, JSON.parse(JSON.stringify(state.painter.s))); }, 'Format Painter');
        if (state.painter.f) X.setNumFmt(state.painter.f);
        state.painter = null;
        $$('#ribbon [data-cmd="painter"]').forEach(x => x.classList.remove('on'));
      }
      document.removeEventListener('mouseup', once, true);
    };
    document.addEventListener('mouseup', once, true);
  } },
  /* font */
  font: { exec: (e, b, fam) => { if (!fam) return; X.applyStyle(s => { s.font = fam; }, 'Font'); X.refreshStates(); } },
  fontsize: { exec: (e, b, pt) => { if (!pt) return; X.applyStyle(s => { s.size = pt; }, 'Font Size'); X.sizeInput && (X.sizeInput.value = pt); } },
  fontcolor: { exec: (e, b, c) => {
    c = c === undefined ? state.colors.fontcolor : c;
    X.applyStyle(s => { s.color = c || undefined; }, 'Font Color');
  } },
  bucket: { exec: (e, b, c) => {
    c = c === undefined ? state.colors.bucket : c;
    X.applyStyle(s => { s.bg = c || undefined; }, 'Fill Color');
  } },
  /* alignment */
  alignl: { exec: () => setHalign('left') },
  alignc: { exec: () => setHalign('center') },
  alignr: { exec: () => setHalign('right') },
  wrap: { exec: () => {
    const s = X.state.sel;
    const cd = X.cellGet(s.a.r, s.a.c);
    const cur = cd && cd.s && cd.s.wrap;
    X.applyStyle(st => { st.wrap = !cur; }, 'Wrap Text');
    const n = X.normSel();
    for (let r = n.r1; r <= n.r2; r++) X.autofitRow(r);
  } },
  merge: { exec: () => {
    const s = X.state.sel;
    if (X.mergeAt(X.sheet(), s.a.r, s.a.c) && (s.a.r === s.b.r && s.a.c === s.b.c)) X.setMerge('unmerge');
    else X.setMerge('center');
  } },
  /* number */
  accounting: { exec: () => X.setNumFmt('$#,##0.00;($#,##0.00)', 'Accounting') },
  percent: { exec: () => X.setNumFmt('0%', 'Percent') },
  comma: { exec: () => X.setNumFmt('#,##0.00', 'Comma') },
  /* editing */
  autosum: { exec: () => X.autoSum('SUM') },
  autosum2: { exec: () => X.autoSum('SUM') },
  insertcells: { exec: () => X.insertDialog() },
  deletecells: { exec: () => X.deleteDialog() },
  formatcellsbtn: { exec: (e, b) => MENU_BUILDERS.formatMenu(b) },
  sortfilter: { exec: (e, b) => MENU_BUILDERS.sortFilterMenu(b) },
  findselect: { exec: () => X.openFindbar(false) },
  condfmt: { exec: (e, b) => MENU_BUILDERS.condFmtMenu(b) },
  formattbl: { exec: (e, b) => MENU_BUILDERS.tableStyleMenu(b) },
  cellstyles: { exec: (e, b) => MENU_BUILDERS.cellStyleMenu(b) },
  /* insert */
  pivot: { exec: () => X.pivotDialog() },
  table: { exec: () => {
    const n = X.isSingleCell() ? X.regionUsed() : X.normSel();
    const body = el('div');
    body.innerHTML = `<div style="margin-bottom:8px;font-size:12px">Where is the data for your table?</div>`;
    const inp = el('input', { type: 'text', value: `=${a1(n.r1, n.c1)}:${a1(n.r2, n.c2)}`, style: 'width:100%;border:1px solid #8A8886;padding:3px 6px;font-size:12px' });
    body.appendChild(inp);
    const chk = X.cCheck('My table has headers', true);
    chk.style.marginTop = '8px';
    body.appendChild(chk);
    X.dlg({
      title: 'Create Table', body, width: 380,
      buttons: [{
        label: 'OK', pri: true, fn: () => {
          const m = inp.value.trim().match(/^=?\$?([A-Z]{1,3})\$?([0-9]+):\$?([A-Z]{1,3})\$?([0-9]+)$/);
          if (!m) { X.msgBox('Microsoft Excel', 'The reference is not valid.', { icon: 'warn' }); return false; }
          const c1 = Calc.colToIdx(m[1]), r1 = +m[2] - 1, c2 = Calc.colToIdx(m[3]), r2 = +m[4] - 1;
          X.state.sel = { a: { r: r1, c: c1 }, b: { r: r2, c: c2 }, type: 'cell', ranges: [] };
          X.pushUndo('Create Table');
          const sh = X.sheet();
          const id = 'tbl' + Date.now().toString(36);
          sh.tables[id] = { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2), name: 'Table' + (Object.keys(sh.tables).length + 1), style: TSTYLES[1][1], headerRow: chk.cb.checked, filter: {}, isAutoFilter: false };
          applyTableStyle(sh.tables[id].style, 'Light Blue');
          X.renameTableTo(sh.tables[id], 'Table' + Object.keys(sh.tables).length);
          X.markDirty(); X.afterSelChange();
        },
      }, { label: 'Cancel' }],
    });
  } },
  picture: { exec: () => {
    const inp = el('input', { type: 'file', accept: 'image/*' });
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const f = inp.files[0];
      if (!f) { inp.remove(); return; }
      const rd = new FileReader();
      rd.onload = () => { X.insertPicture(rd.result, f.name); inp.remove(); };
      rd.readAsDataURL(f);
    });
    inp.click();
  } },
  shapes: { exec: (e, b) => MENU_BUILDERS.shapesMenu(b) },
  textbox: { exec: () => X.insertShape('textbox') },
  symbol: { exec: () => X.symbolDialog() },
  link: { exec: () => X.linkDialog() },
  sparkline: { exec: () => X.sparkDialog('line') },
  sparkcol: { exec: () => X.sparkDialog('column') },
  /* layout */
  gridview: { exec: (e, b, on) => { state.showGrid = !!on; X.requestRender(); X.markDirty(); } },
  gridprint: { exec: (e, b, on) => { state.gridPrint = !!on; X.markDirty(); X.sbMsg(on ? 'Gridlines will print' : 'Gridlines will not print'); } },
  headview: { exec: (e, b, on) => { state.showHeads = !!on; X.requestRender(); X.markDirty(); } },
  showfx: { exec: (e, b, on) => { state.showFxbar = !!on; $('#fxbar').style.display = on ? '' : 'none'; X.requestRender(); X.markDirty(); } },
  showgrid: { exec: (e, b, on) => { state.showGrid = !!on; X.requestRender(); X.markDirty(); } },
  showhead: { exec: (e, b, on) => { state.showHeads = !!on; X.requestRender(); X.markDirty(); } },
  darkmode: { exec: (e, b, on) => { X.setDark(!!on); X.sbMsg(on ? 'Dark Mode: on (View tab to switch back)' : 'Dark Mode: off'); } },
  /* formulas */
  insertfx: { exec: () => X.insertFnDialog() },
  namemgr: { exec: () => X.nameManagerDialog() },
  definename: { exec: () => X.defineNameDialog() },
  showform: { exec: () => { state.showFormulas = !state.showFormulas; X.refreshStates(); X.requestRender(); X.sbMsg(state.showFormulas ? 'Showing formulas' : 'Showing values'); } },
  errorcheck: { exec: () => X.errorCheckDialog() },
  calcnow: { exec: () => { X.recalcAll(); X.requestRender(); X.sbMsg('Recalculated'); } },
  traceprec: { exec: () => X.trace('prec') },
  tracedep: { exec: () => X.trace('dep') },
  rmvarrows: { exec: () => X.clearArrows() },
  /* data */
  sortaz: { exec: () => X.sortSelection(1) },
  sortza: { exec: () => X.sortSelection(-1) },
  sortdlg: { exec: () => X.sortDialog() },
  filter: { exec: () => { X.toggleFilter(); X.refreshStates(); } },
  filterclr: { exec: () => { const t = X.filterRegion(); if (t) { t.filter = {}; X.applyFilter(); } else X.sbMsg('No filter is applied'); } },
  refresh: { exec: () => { X.recalcAll(); X.requestRender(); X.sbMsg('Workbook recalculated'); } },
  texttocols: { exec: () => X.textToColsDialog() },
  dataval: { exec: (e, b) => MENU_BUILDERS.dataValMenu(b) },
  subtotal: { exec: () => X.subtotalDialog() },
  /* review */
  newnote: { exec: () => X.noteDialog() },
  prevnote: { exec: () => navNote(-1) },
  nextnote: { exec: () => navNote(1) },
  shownotes: { exec: () => { state.showNotes = !state.showNotes; X.requestRender(); X.sbMsg(state.showNotes ? 'Showing all comments' : 'Comments hidden (hover the red marker to view)'); } },
  protect: { exec: () => X.protectDialog() },
  /* view */
  vnormal: { exec: () => { X.setView('normal'); X.refreshStates(); } },
  vpbreak: { exec: () => { X.setView('pbreak'); X.refreshStates(); } },
  zoom: { exec: () => X.zoomDialog() },
  zoom100: { exec: () => X.setZoom(1) },
  zoomsel: { exec: () => {
    const n = X.normSel();
    const z = X.state.zoom;
    const v = { w: $('#grid-scroll').clientWidth - X.HDRW, h: $('#grid-scroll').clientHeight - X.HDRH };
    const w = (X.colX(n.c2 + 1) - X.colX(n.c1)), h = (X.rowY(n.r2 + 1) - X.rowY(n.r1));
    const k = Math.min(v.w / Math.max(20, w), v.h / Math.max(20, h));
    X.setZoom(clamp(k, 0.4, 4));
    X.scrollCellVisible(n.r1, n.c1);
  } },
  freeze: { exec: () => {
    const fz = X.sheet().freeze;
    if (fz.r || fz.c) { X.sheet().freeze = { r: 0, c: 0 }; frozen(); }
    else MENU_BUILDERS.freezeMenu($('#ribbon [data-cmd="freeze"]'));
  } },
  newwin: { exec: () => { window.open(location.href, '_blank', 'width=1200,height=800'); } },
  /* help */
  help: { exec: () => X.helpDialog() },
  feedback: { exec: () => X.feedbackDialog() },
};
function navNote(dir) {
  const keys = Object.keys(sheet().notes).map(k => X.rcOf(k)).sort((a, b) => a.r - b.r || a.c - b.c);
  if (!keys.length) { X.sbMsg('No comments on this sheet'); return; }
  const s = X.state.sel;
  let i = keys.findIndex(p => p.r === s.a.r && p.c === s.a.c);
  i = i === -1 ? (dir > 0 ? 0 : keys.length - 1) : (i + dir + keys.length) % keys.length;
  const p = keys[i];
  X.setSel(p, p);
  X.scrollCellVisible(p.r, p.c);
  X.noteHoverShow(p.r, p.c, true);
}
X.navNote = navNote;
X.renameTableTo = (t, name) => { t.name = name; };

})();
