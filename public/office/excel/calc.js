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
   Calc: formula tokenizer, parser, evaluator, function library,
   reference adjustment, number formatting. Pure logic — no DOM.
   ========================================================================== */
(function () {
'use strict';

/* ---------------- address helpers ---------------- */
function colToIdx(letters) { // A->0 ... Z->25 AA->26
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}
function idxToCol(i) {
  let s = '';
  i = i + 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26; }
  return s;
}
const MAXR = 1048576, MAXC = 16383; // rows, cols(XFD)

/* parse "A1"/"$A$1"/"A$1" -> {c,r,cAbs,rAbs} or col-only {colOnly} row-only */
function parseRef(tok) {
  const m = tok.match(/^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)$/);
  if (m) return { c: colToIdx(m[2].toUpperCase()), r: parseInt(m[4], 10) - 1, cAbs: !!m[1], rAbs: !!m[3], colOnly: false };
  const mc = tok.match(/^(\$?)([A-Za-z]{1,3})$/);
  if (mc) return { c: colToIdx(mc[2].toUpperCase()), r: null, cAbs: !!mc[1], rAbs: true, colOnly: true };
  const mr = tok.match(/^(\$?)([0-9]+)$/);
  if (mr) return { c: null, r: parseInt(mr[2], 10) - 1, cAbs: true, rAbs: !!mr[1], rowOnly: true };
  return null;
}
function refToStr(r) {
  if (r.colOnly) return (r.cAbs ? '$' : '') + idxToCol(r.c);
  if (r.rowOnly) return (r.rAbs ? '$' : '') + (r.r + 1);
  return (r.cAbs ? '$' : '') + idxToCol(r.c) + (r.rAbs ? '$' : '') + (r.r + 1);
}

/* ---------------- errors ---------------- */
function ERR(kind) { return { __err: kind }; }
const E_DIV = () => ERR('#DIV/0!'), E_VAL = () => ERR('#VALUE!'), E_REF = () => ERR('#REF!'),
      E_NAME = () => ERR('#NAME?'), E_NA = () => ERR('#N/A'), E_NUM = () => ERR('#NUM!'), E_NULL = () => ERR('#NULL!');
function isErr(v) { return !!(v && v.__err); }

/* Excel's residual-noise cleanup on arithmetic (KB Q78113): when the true result
   is within ~1 ulp-scale of a short decimal (4.3-4.2 -> 0.1, 0.5-0.4-0.1 -> 0),
   Excel snaps AWAY the binary float dust before display AND comparison, so
   =0.1*3=0.3 is TRUE. Snapping is keyed to operand magnitude — genuine
   high-precision results (e.g. 1/3) are untouched. */
function fixNoise(res, a, b) {
  if (typeof res !== 'number' || !isFinite(res)) return res;
  if (res === 0) return 0;
  const mag = Math.max(Math.abs(a), Math.abs(b));
  if (mag === 0) return res;
  const approx = Number(res.toPrecision(13));
  if (Math.abs(res - approx) <= mag * 1.5e-14) return approx;
  return res;
}

/* ---------------- tokenizer ---------------- */
const T_NUM = 'num', T_STR = 'str', T_ID = 'id', T_REF = 'ref', T_OP = 'op',
      T_LP = '(', T_RP = ')', T_COMMA = ',', T_SHEET = 'sheet';
function tokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '"') {
      let j = i + 1, s = '';
      while (j < n) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j]; j++; }
      toks.push({ t: T_STR, v: s }); i = j + 1; continue;
    }
    if (ch === "'") { // 'Sheet Name'!A1
      let j = i + 1, nm = '';
      while (j < n && src[j] !== "'") { nm += src[j]; j++; }
      j++;
      if (src[j] === '!') { toks.push({ t: T_SHEET, v: nm }); i = j + 1; continue; }
      return null;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i, s = '';
      while (j < n && /[0-9.]/.test(src[j])) s += src[j++];
      if (src[j] === 'E' || src[j] === 'e') {
        const k = j + 1;
        if (/[0-9+-]/.test(src[k] || '')) { s += 'E'; let m = k; if (src[m] === '+' || src[m] === '-') s += src[m++]; while (m < n && /[0-9]/.test(src[m])) s += src[m++]; j = m; }
      }
      toks.push({ t: T_NUM, v: parseFloat(s) }); i = j; continue;
    }
    if (/[A-Za-z_$\\]/.test(ch)) {
      let j = i, s = '';
      while (j < n && /[A-Za-z0-9_.$]/.test(src[j])) s += src[j++];
      // 3D sheet span: Sheet1:Sheet5!  (deep cross-sheet reference)
      if (src[j] === ':') {
        const m3 = /^:([A-Za-z_][A-Za-z0-9_.]*)!/.exec(src.slice(j));
        if (m3 && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(s) && !/^\$?[A-Za-z]{1,3}\$?[0-9]+$/.test(s)) {
          toks.push({ t: T_SHEET, v: s + ':' + m3[1] });
          i = j + m3[0].length; continue;
        }
      }
      // sheet prefix like Sheet1!
      if (src[j] === '!' && /^[A-Za-z_][A-Za-z0-9_. ]*$/.test(s)) { toks.push({ t: T_SHEET, v: s }); i = j + 1; continue; }
      // cell reference?
      const isRef = /^(\$?[A-Za-z]{1,3}\$?[0-9]+)$/.test(s);
      const nextCh = src[j];
      if (isRef && nextCh !== '(') toks.push({ t: T_REF, v: s.toUpperCase() });
      else if (/^(\$?[A-Za-z]{1,3})$/.test(s)) {
        // range like A:A (col-only) — part of range only if next is ':'
        if (nextCh === ':') toks.push({ t: T_REF, v: s.toUpperCase() });
        else toks.push({ t: T_ID, v: s.toUpperCase() });
      }
      else if (/^\$?[0-9]+$/.test(s)) toks.push({ t: T_REF, v: s });
      else toks.push({ t: T_ID, v: s.toUpperCase() });
      i = j; continue;
    }
    if (/[0-9]/.test(ch)) { i++; continue; }
    const two = src.substr(i, 2);
    if (two === '<=' || two === '>=' || two === '<>') { toks.push({ t: T_OP, v: two }); i += 2; continue; }
    if ('+-*/^&%=<>():,'.includes(ch)) {
      if (ch === '(') toks.push({ t: T_LP }); else if (ch === ')') toks.push({ t: T_RP });
      else if (ch === ',') toks.push({ t: T_COMMA });
      else toks.push({ t: T_OP, v: ch });
      i++; continue;
    }
    if (ch === '{' || ch === '}') { toks.push({ t: ch }); i++; continue; } // array constants
    if (ch === ';') { toks.push({ t: T_COMMA, row: true }); i++; continue; }
    return null; // unknown char
  }
  return toks;
}

/* ---------------- parser ---------------- */
function parse(src) {
  if (typeof src === 'string' && src[0] === '=') src = src.slice(1);
  const toks = tokenize(src);
  if (!toks) return E_PARSE_FAIL_AST();
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  function expr() { return comparison(); }
  function comparison() {
    let l = concat();
    while (peek() && peek().t === T_OP && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = next().v; const r = concat(); l = { k: 'cmp', op, l, r };
    }
    return l;
  }
  function concat() {
    let l = addsub();
    while (peek() && peek().t === T_OP && peek().v === '&') { next(); l = { k: 'cat', l, r: addsub() }; }
    return l;
  }
  function addsub() {
    let l = muldiv();
    while (peek() && peek().t === T_OP && (peek().v === '+' || peek().v === '-')) {
      const op = next().v; l = { k: 'bin', op, l, r: muldiv() };
    }
    return l;
  }
  function muldiv() {
    let l = power();
    while (peek() && peek().t === T_OP && (peek().v === '*' || peek().v === '/')) {
      const op = next().v; l = { k: 'bin', op, l, r: power() };
    }
    return l;
  }
  function power() {
    let l = unary();
    while (peek() && peek().t === T_OP && peek().v === '^') { next(); l = { k: 'bin', op: '^', l, r: unary() }; }
    return l;
  }
  function unary() {
    if (peek() && peek().t === T_OP && (peek().v === '-' || peek().v === '+')) {
      const op = next().v; return { k: 'un', op, x: unary() };
    }
    return intersect();
  }
  /* implicit intersection: the SPACE between refs is an operator in Excel.
     The tokenizer drops spaces, so two adjacent ref/range/sheet tokens mean
     intersect (=A1:A10 C5:E5 gives C5's block). Binds tighter than +-/unary */
  function intersect() {
    let a = postfix();
    while (peek() && (peek().t === T_REF || peek().t === T_SHEET)) {
      a = { k: 'isect', l: a, r: postfix() };
    }
    return a;
  }
  function postfix() {
    let a = atom();
    while (peek() && peek().t === T_OP && peek().v === '%') { next(); a = { k: 'pct', x: a }; }
    return a;
  }
  function atom() {
    const tk = next();
    if (!tk) throw { parse: true };
    if (tk.t === T_NUM) return { k: 'num', v: tk.v };
    if (tk.t === T_STR) return { k: 'str', v: tk.v };
    if (tk.t === T_LP) { const e = expr(); if (!next() || toks[pos - 1].t !== T_RP) throw { parse: true }; return e; }
    if (tk.t === '{') { // 1-level array constant {1,2;3,4}
      const rows = [[]];
      if (peek() && peek().t === '}') { next(); return { k: 'arr', rows: [[]] }; }
      for (;;) {
        const e = expr(); rows[rows.length - 1].push(e);
        const nx = next();
        if (!nx) throw { parse: true };
        if (nx.t === T_COMMA && !nx.row) continue;
        if (nx.t === T_COMMA && nx.row) { rows.push([]); continue; }
        if (nx.t === '}') break;
        throw { parse: true };
      }
      return { k: 'arr', rows };
    }
    if (tk.t === T_SHEET || tk.t === T_REF || tk.t === T_ID) {
      let sheet = null, node = null, t2 = tk;
      if (tk.t === T_SHEET) { sheet = tk.v; t2 = next(); if (!t2 || (t2.t !== T_REF && t2.t !== T_ID)) throw { parse: true }; }
      if (t2.t === T_REF) {
        const r1 = parseRef(t2.v);
        if (!r1) throw { parse: true };
        node = { k: 'ref', ref: r1, sheet };
      } else if (t2.t === T_ID && sheet) {
        node = { k: 'name', name: t2.v, sheet };
      } else if (t2.t === T_ID) {
        // function call or name or bool
        if (peek() && peek().t === T_LP) {
          next();
          const args = [];
          if (!(peek() && peek().t === T_RP)) {
            for (;;) {
              args.push(peek() && peek().t === T_COMMA ? { k: 'missing' } : expr());
              const nx = next();
              if (!nx || nx.t === T_RP) break;
              if (nx.t !== T_COMMA) throw { parse: true };
              if (peek() && peek().t === T_RP) { args.push({ k: 'missing' }); next(); break; }
            }
          } else next();
          node = { k: 'call', fn: t2.v, args };
        } else if (t2.v === 'TRUE') node = { k: 'bool', v: true };
        else if (t2.v === 'FALSE') node = { k: 'bool', v: false };
        else node = { k: 'name', name: t2.v, sheet };
      }
      // range operator
      if (node && node.k === 'ref') {
        while (peek() && peek().t === T_OP && peek().v === ':') {
          next();
          let sh2 = null, t3 = next();
          if (!t3) throw { parse: true };
          if (t3.t === T_SHEET) { sh2 = t3.v; t3 = next(); }
          if (!t3 || t3.t !== T_REF) throw { parse: true };
          const r2 = parseRef(t3.v);
          if (!r2) throw { parse: true };
          node = { k: 'rng', a: node.ref, b: r2, sheet: sheet || sh2 };
        }
      }
      return node;
    }
    throw { parse: true };
  }
  try {
    const ast = expr();
    if (pos < toks.length) return E_PARSE_FAIL_AST();
    return ast;
  } catch (e) { return E_PARSE_FAIL_AST(); }
}
function E_PARSE_FAIL_AST() { return { k: '__parsefail' }; }

/* ---------------- evaluator ---------------- */
/* rectangle bounds of ref/rng/intersection nodes (for the space operator) */
function boundsOf(nd) {
  if (!nd) return null;
  if (nd.k === 'ref') {
    if (nd.ref.rowOnly) return { sheet: nd.sheet || null, r1: nd.ref.r, r2: nd.ref.r, c1: 0, c2: 16383, rowOnly: true };
    if (nd.ref.colOnly) return { sheet: nd.sheet || null, r1: 0, r2: 1048575, c1: nd.ref.c, c2: nd.ref.c, colOnly: true };
    return { sheet: nd.sheet || null, r1: nd.ref.r, c1: nd.ref.c, r2: nd.ref.r, c2: nd.ref.c };
  }
  if (nd.k === 'rng') {
    const rowOnly = nd.a.rowOnly || (nd.b && nd.b.rowOnly), colOnly = nd.a.colOnly || (nd.b && nd.b.colOnly);
    if (rowOnly) return { sheet: nd.sheet || null, r1: nd.a.r, r2: nd.b.r, c1: 0, c2: 16383, rowOnly: true };
    if (colOnly) return { sheet: nd.sheet || null, r1: 0, r2: 1048575, c1: nd.a.c, c2: nd.b.c, colOnly: true };
    return { sheet: nd.sheet || null, r1: nd.a.r, c1: nd.a.c, r2: nd.b.r, c2: nd.b.c };
  }
  if (nd.k === 'isect') {
    const L = boundsOf(nd.l), R = boundsOf(nd.r);
    if (!L || !R || L.sheet !== R.sheet) return null;
    const r1 = Math.max(Math.min(L.r1, L.r2), Math.min(R.r1, R.r2)), r2 = Math.min(Math.max(L.r1, L.r2), Math.max(R.r1, R.r2));
    const c1 = Math.max(Math.min(L.c1, L.c2), Math.min(R.c1, R.c2)), c2 = Math.min(Math.max(L.c1, L.c2), Math.max(R.c1, R.c2));
    if (r1 > r2 || c1 > c2) return null;
    return { sheet: L.sheet, r1, c1, r2, c2 };
  }
  return null;
}
function flatten(v) { return Array.isArray(v) && v.__rows ? v.flat() : v; }
function* iterArgs(args, ctx, emptyAsZero) {
  for (const a of args) {
    const v = evalNode(a, ctx);
    if (Array.isArray(v)) { const fl = v.__rows ? v.flat() : v; for (const x of fl) yield x; }
    else if (a.k === 'ref' || a.k === 'rng' || a.k === 'arr') yield v == null ? null : v;
    else yield v === 0 || v ? v : (emptyAsZero ? 0 : v);
  }
}

function evalNode(nd, ctx) {
  if (!nd) return 0;
  switch (nd.k) {
    case 'num': return nd.v;
    case 'str': return nd.v;
    case 'bool': return nd.v;
    case 'arr': {
      const rows = nd.rows.map(r => r.map(x => evalNode(x, ctx)));
      rows.__rows = true;
      return rows;
    }
    case 'missing': return null;
    case 'ref': {
      const v = ctx.get(nd.ref, nd.sheet);
      return v === undefined ? null : v;
    }
    case 'rng': return ctx.range(nd.a, nd.b, nd.sheet) || [];
    case 'isect': {
      /* intersect the bounding rectangles of both operands (Excel space operator).
         Non-overlap -> #NULL!. One cell -> scalar; more -> range matrix */
      const L = boundsOf(nd.l), R = boundsOf(nd.r);
      if (!L || !R) return E_NULL();
      if (L.sheet !== R.sheet) return E_NULL();
      const r1 = Math.max(Math.min(L.r1, L.r2), Math.min(R.r1, R.r2)), r2 = Math.min(Math.max(L.r1, L.r2), Math.max(R.r1, R.r2));
      const c1 = Math.max(Math.min(L.c1, L.c2), Math.min(R.c1, R.c2)), c2 = Math.min(Math.max(L.c1, L.c2), Math.max(R.c1, R.c2));
      if (r1 > r2 || c1 > c2) return E_NULL();
      const sh = L.sheet === null ? undefined : L.sheet;
      if (r1 === r2 && c1 === c2) return ctx.get({ r: r1, c: c1 }, sh);
      if (L.colOnly || R.colOnly) return ctx.range({ r: r1, c: null }, { r: r2, c: null }, sh);
      if (L.rowOnly || R.rowOnly) return ctx.range({ r: null, c: c1 }, { r: null, c: c2 }, sh);
      return ctx.range({ r: r1, c: c1 }, { r: r2, c: c2 }, sh);
    }
    case 'name': {
      if (ctx.getName) { const v = ctx.getName(nd.name, nd.sheet); if (v !== undefined) return v; }
      return E_NAME();
    }
    case 'un': {
      const v = toNum(evalNode(nd.x, ctx));
      if (isErr(v)) return v;
      return nd.op === '-' ? -v : v;
    }
    case 'pct': {
      const v = toNum(evalNode(nd.x, ctx));
      return isErr(v) ? v : v / 100;
    }
    case 'cat': {
      const l = toStr(evalNode(nd.l, ctx)), r = toStr(evalNode(nd.r, ctx));
      if (isErr(l)) return l; if (isErr(r)) return r;
      return l + r;
    }
    case 'cmp': {
      const l = evalNode(nd.l, ctx), r = evalNode(nd.r, ctx);
      if (isErr(l)) return l; if (isErr(r)) return r;
      return compare(l, r, nd.op);
    }
    case 'bin': {
      const l = evalNode(nd.l, ctx), r = evalNode(nd.r, ctx);
      if (isErr(l)) return l; if (isErr(r)) return r;
      const a = toNum(l), b = toNum(r);
      if (isErr(a)) return a; if (isErr(b)) return b;
      switch (nd.op) {
        case '+': return fixNoise(a + b, a, b);
        case '-': return fixNoise(a - b, a, b);
        case '*': return fixNoise(a * b, a, b);
        case '/': return b === 0 ? E_DIV() : fixNoise(a / b, a, b);
        case '^': { const v = Math.pow(a, b); return isNaN(v) ? E_NUM() : v; }
      }
      return E_VAL();
    }
    case 'call': {
      const fn = FUNCS[nd.fn];
      if (!fn) return E_NAME();
      return fn(nd.args, ctx);
    }
    default: return E_VAL();
  }
}

/* Excel type coercion */
function toNum(v) {
  if (isErr(v)) return v;
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return E_VAL();
    if (/^[-+]?[0-9.,$eE%]+$/.test(t)) {
      let x = Number(t.replace(/[$,]/g, '').replace(/%$/, ''));
      if (!isNaN(x)) { if (/%$/.test(t)) x = x / 100; return x; }
    }
    return E_VAL();
  }
  if (Array.isArray(v)) return toNum(v.flat()[0]);
  return E_VAL();
}
function toStr(v) {
  if (isErr(v)) return v;
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return numToGeneral(v);
  if (Array.isArray(v)) return toStr(v.flat()[0]);
  return '';
}
function toBool(v) {
  if (isErr(v)) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v == null) return false;
  if (typeof v === 'string') { const t = v.trim().toUpperCase(); if (t === 'TRUE') return true; if (t === 'FALSE') return false; return E_VAL(); }
  return E_VAL();
}
function compare(l, r, op) {
  // Excel ordering: number < string < boolean < blank;
  // a blank compares equal to 0 (vs number) and "" (vs string)
  if (l == null && typeof r === 'number') l = 0;
  else if (l == null && r === '') l = '';
  if (r == null && typeof l === 'number') r = 0;
  else if (r == null && l === '') r = '';
  const rank = v => v == null ? 4 : typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 3;
  let c;
  if (rank(l) !== rank(r)) c = rank(l) - rank(r);
  else if (typeof l === 'string') c = l.toLowerCase() < r.toLowerCase() ? -1 : l.toLowerCase() > r.toLowerCase() ? 1 : 0;
  else if (l == null) c = 0;
  else c = l < r ? -1 : l > r ? 1 : 0;
  switch (op) {
    case '=': return c === 0;
    case '<>': return c !== 0;
    case '<': return c < 0;
    case '>': return c > 0;
    case '<=': return c <= 0;
    case '>=': return c >= 0;
  }
}

/* numeric aggregation over arguments (Excel: numbers only, ignore text in refs) */
function numsFrom(args, ctx, opts) {
  const out = [];
  const o = opts || {};
  for (const a of args) {
    let v = evalNode(a, ctx);
    if (Array.isArray(v)) {
      for (const x of v.flat()) {
        if (isErr(x)) { if (!o.ignoreErr) return x instanceof Object ? { err: x } : x; out.err = x; }
        else if (typeof x === 'number') out.push(x);
      }
    } else if (a.k === 'ref' || a.k === 'rng' || a.k === 'missing') {
      if (typeof v === 'number') out.push(v);
      else if (isErr(v)) out.err = v;
    } else {
      const n = toNum(v);
      if (isErr(n)) { if (!o.ignoreErr) out.err = n; }
      else out.push(n);
    }
  }
  return out;
}
function aggErr(arr) { return arr.err || null; }

/* helpers for the expansion pack */
function gcd2(x, y) { x = Math.abs(x); y = Math.abs(y); while (y) { const t = x % y; x = y; y = t; } return x; }
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function twoArrays(a, c) { // paired numeric arrays, Excel pairwise semantics
  const X = evalNode(a[0], c), Y = evalNode(a[1], c);
  if (isErr(X)) return X; if (isErr(Y)) return Y;
  const ax = (Array.isArray(X) ? X.flat() : [X]), ay = (Array.isArray(Y) ? Y.flat() : [Y]);
  if (ax.length !== ay.length) return E_NA();
  const xs = [], ys = [];
  for (let i = 0; i < ax.length; i++) if (typeof ax[i] === 'number' && typeof ay[i] === 'number') { xs.push(ax[i]); ys.push(ay[i]); }
  return { xs, ys };
}
/* flatten a lookup vector: multi-row 2D arrays use their FIRST column, else flat.
   (single-row array constants {1,2,3} keep their full width) */
function colOf(v) {
  if (!Array.isArray(v)) return [v];
  if (v.__rows && v.length > 1 && Array.isArray(v[0])) return v.map(r => (r[0] === undefined ? null : r[0]));
  return v.flat();
}

/* rectangle of a reference node (for SUMIF-style anchored ranges) */
function refRect(nd) {
  if (!nd) return null;
  if (nd.k === 'ref' && nd.ref && !nd.ref.colOnly && !nd.ref.rowOnly && nd.ref.r != null && nd.ref.c != null)
    return { r1: nd.ref.r, c1: nd.ref.c, r2: nd.ref.r, c2: nd.ref.c };
  if (nd.k === 'rng' && nd.a && nd.b && nd.a.r != null && nd.a.c != null && nd.b.r != null && nd.b.c != null)
    return { r1: Math.min(nd.a.r, nd.b.r), c1: Math.min(nd.a.c, nd.b.c), r2: Math.max(nd.a.r, nd.b.r), c2: Math.max(nd.a.c, nd.b.c) };
  return null;
}

/* criteria matcher for SUMIF/COUNTIF/AVERAGEIF */
function mkCriteria(c) {
  if (isErr(c)) return () => ERR;
  // Excel quirk: numeric criteria also match numbers stored as text (and vice versa)
  if (typeof c === 'number') return v => (typeof v === 'number' && v === c) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) && Number(v) === c);
  if (typeof c === 'boolean') return v => v === c || (typeof v === 'string' && v.toUpperCase() === String(c).toUpperCase());
  const s = String(c);
  if (s === '=') return v => v == null || v === undefined;      // "=" matches true blanks only
  if (s === '<>') return v => !(v == null || v === undefined || v === '');
  if (s === '') return v => v == null || v === undefined || v === '';
  if (/^true$/i.test(s)) return v => v === true || (typeof v === 'string' && /^true$/i.test(v));
  if (/^false$/i.test(s)) return v => v === false || (typeof v === 'string' && /^false$/i.test(v));
  const m = s.match(/^(<=|>=|<>|=|<|>)(.*)$/);
  if (m) {
    const rhs = m[2];
    const num = rhs !== '' && !isNaN(Number(rhs)) ? Number(rhs) : null;
    return v => {
      let vv = v;
      if (num != null && typeof vv === 'string') {
        const t = vv.trim();
        if (t === '') return m[1] === '<>';                 // empty text <> number
        const nn = Number(t);
        if (isNaN(nn)) return m[1] === '<>';                // non-numeric text: only <> matches
        vv = nn;                                            // numeric text coerces (Excel criteria quirk)
      }
      if (num != null && typeof vv !== 'number') return m[1] === '<>' ? true : false;
      try { return compare(vv, num != null ? num : rhs, m[1]) === true; } catch (e) { return false; }
    };
  }
  const esc = s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/~\*/g, '\\*').replace(/~\?/g, '\\?');
  const re = new RegExp('^' + esc + '$', 'i');
  return v => {
    if (typeof v === 'string') return re.test(v);
    if (typeof v === 'number') { const n = Number(s); return (!isNaN(n) && s.trim() !== '' && v === n) || numToGeneral(v) === s; }
    return false;
  };
}
/* array-forced evaluation: Excel evaluates arithmetic/comparison elementwise
   inside SUMPRODUCT & friends. Scalars broadcast; unequal lengths -> #VALUE! */
function evalArr(nd, ctx) {
  switch (nd.k) {
    case 'bin': case 'cat': case 'cmp': case 'un': case 'pct': {
      if (nd.k === 'un' || nd.k === 'pct') {
        const v = evalArr(nd.x, ctx);
        if (isErr(v)) return v;
        const la = Array.isArray(v) ? v.flat() : [v];
        const f = nd.k === 'pct'
          ? (x => { const n = toNum(x); return isErr(n) ? n : n / 100; })
          : (x => { const n = toNum(x); return isErr(n) ? n : (nd.op === '-' ? -n : n); });
        return la.map(f);
      }
      const lr = evalArr(nd.l, ctx), rr = evalArr(nd.r, ctx);
      if (isErr(lr)) return lr; if (isErr(rr)) return rr;
      const bcast = (f) => {
        const la = Array.isArray(lr) ? lr.flat() : [lr];
        const ra = Array.isArray(rr) ? rr.flat() : [rr];
        if (la.length !== ra.length && la.length !== 1 && ra.length !== 1) return E_VAL();
        const n = Math.max(la.length, ra.length), out = [];
        for (let i = 0; i < n; i++) {
          const x = la.length === 1 ? la[0] : la[i], y = ra.length === 1 ? ra[0] : ra[i];
          out.push(f(x, y));
        }
        return out;
      };
      if (nd.k === 'cmp') return bcast((x, y) => { if (isErr(x)) return x; if (isErr(y)) return y; return compare(x, y, nd.op); });
      if (nd.k === 'cat') return bcast((x, y) => { const a = toStr(x), b = toStr(y); if (isErr(a)) return a; if (isErr(b)) return b; return a + b; });
      return bcast((x, y) => {
        const a = toNum(x), b = toNum(y);
        if (isErr(a)) return a; if (isErr(b)) return b;
        switch (nd.op) {
          case '+': return fixNoise(a + b, a, b); case '-': return fixNoise(a - b, a, b); case '*': return fixNoise(a * b, a, b);
          case '/': return b === 0 ? E_DIV() : fixNoise(a / b, a, b);
          case '^': { const v = Math.pow(a, b); return isNaN(v) ? E_NUM() : v; }
        }
        return E_VAL();
      });
    }
    default: return evalNode(nd, ctx);
  }
}

function rngPairs(a, b, ctx) {
  const va = evalNode(a, ctx), vb = evalNode(b, ctx);
  const A = Array.isArray(va) ? va.flat() : [va], B = Array.isArray(vb) ? vb.flat() : [vb];
  return { A, B };
}

/* date serial <-> JS date (1900 system with leap bug) */
const DAYMS = 86400000;
function dateToSerial(d) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / DAYMS);
}
function serialToDate(s) {
  const base = Date.UTC(1899, 11, 30);
  const t = base + Math.round(s * 1000) / 1000 * DAYMS;
  return new Date(t);
}
function fracOf(s) { return s - Math.floor(s); }
/* calendar (y,m,d) of a serial, emulating Excel's 1900 leap-bug for serials 1..60 */
function serialYMD(s) {
  const si = Math.floor(s);
  if (si >= 1 && si < 61) {
    if (si <= 31) return { y: 1900, m: 1, d: si };
    if (si <= 59) return { y: 1900, m: 2, d: si - 31 };
    return { y: 1900, m: 2, d: 29 }; // fictional Feb 29 1900 (Excel compatibility)
  }
  const dt = serialToDate(si);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}


/* ---------------- function library ---------------- */
function needNum(v) { const n = toNum(v); return n; }
function arg1(args, ctx) { return evalNode(args[0], ctx); }

/* shared impl for MAXIFS/MINIFS: collect numeric cells of range0 whose criteria rows all pass */
function ifsCollect(a, c) {
  const tgt = evalNode(a[0], c);
  const S = Array.isArray(tgt) ? tgt.flat() : [tgt];
  const ranges = [], crits = [];
  for (let i = 1; i + 1 < a.length; i += 2) { ranges.push(evalNode(a[i], c)); crits.push(mkCriteria(evalNode(a[i + 1], c))); }
  if (!ranges.length) return E_VAL();
  const Rs = ranges.map(r => Array.isArray(r) ? r.flat() : [r]);
  const out = [];
  outer: for (let i = 0; i < S.length; i++) {
    for (let j = 0; j < Rs.length; j++) { if (!crits[j](Rs[j][Math.min(i, Rs[j].length - 1)])) continue outer; }
    if (typeof S[i] === 'number') out.push(S[i]);
  }
  return out;
}

const FUNCS = {
  /* math & aggregate */
  SUM: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); return ns.reduce((x, y) => x + y, 0); },
  PRODUCT: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); if (!ns.length) return 0; return ns.reduce((x, y) => x * y, 1); },
  AVERAGE: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); return ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : E_DIV(); },
  COUNT: (a, c) => { return numsFrom(a, c).length; },
  COUNTA: (a, c) => { let n = 0; for (const v of iterArgs(a, c)) { if (v !== null && v !== undefined && v !== '') n++; } return n; },
  COUNTBLANK: (a, c) => { let n = 0; for (const v of iterArgs(a, c)) { if (v == null || v === '') n++; } return n; },
  MAX: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); return ns.length ? Math.max(...ns) : 0; },
  MIN: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); return ns.length ? Math.min(...ns) : 0; },
  LARGE: (a, c) => { const ns = numsFrom([a[0]], c); const k = toNum(evalNode(a[1], c)); if (isErr(k)) return k; ns.sort((x, y) => y - x); return ns[k - 1] != null ? ns[k - 1] : E_NUM(); },
  SMALL: (a, c) => { const ns = numsFrom([a[0]], c); const k = toNum(evalNode(a[1], c)); if (isErr(k)) return k; ns.sort((x, y) => x - y); return ns[k - 1] != null ? ns[k - 1] : E_NUM(); },
  MEDIAN: (a, c) => { const ns = numsFrom(a, c).sort((x, y) => x - y); if (!ns.length) return E_DIV(); const m = ns.length >> 1; return ns.length % 2 ? ns[m] : (ns[m - 1] + ns[m]) / 2; },
  'MODE.SNGL': (a, c) => { const ns = numsFrom(a, c); const fr = {}; let best = null, bn = 0; ns.forEach(x => { fr[x] = (fr[x] || 0) + 1; if (fr[x] > bn) { bn = fr[x]; best = x; } }); return bn > 1 ? best : E_NA(); },
  MODE: (a, c) => FUNCS['MODE.SNGL'](a, c),
  'STDEV.S': (a, c) => { const ns = numsFrom(a, c); if (ns.length < 2) return E_DIV(); const m = ns.reduce((x, y) => x + y, 0) / ns.length; return Math.sqrt(ns.reduce((x, y) => x + (y - m) * (y - m), 0) / (ns.length - 1)); },
  'STDEV.P': (a, c) => { const ns = numsFrom(a, c); if (!ns.length) return E_DIV(); const m = ns.reduce((x, y) => x + y, 0) / ns.length; return Math.sqrt(ns.reduce((x, y) => x + (y - m) * (y - m), 0) / ns.length); },
  STDEV: (a, c) => FUNCS['STDEV.S'](a, c),
  STDEVP: (a, c) => FUNCS['STDEV.P'](a, c),
  'VAR.S': (a, c) => { const v = FUNCS['STDEV.S'](a, c); return isErr(v) ? v : v * v; },
  'VAR.P': (a, c) => { const v = FUNCS['STDEV.P'](a, c); return isErr(v) ? v : v * v; },
  VAR: (a, c) => FUNCS['VAR.S'](a, c),
  SUMPRODUCT: (a, c) => {
    const arrs = a.map(x => { const v = evalArr(x, c); return Array.isArray(v) ? v.flat() : [v]; });
    if (arrs.some(isErr)) return arrs.find(isErr);
    const len = Math.max(...arrs.map(x => x.length));
    if (!arrs.every(x => x.length === len)) return E_VAL(); // Excel: SUMPRODUCT arguments must be same size
    let s = 0;
    for (let i = 0; i < len; i++) {
      let p = 1;
      for (const arr of arrs) {
        const v = arr[i];
        if (isErr(v)) return v;
        p *= typeof v === 'number' ? v : 0; // text/logicals/blanks inside arrays count as 0 in Excel
      }
      s += p;
    }
    return s;
  },
  SUMIF: (a, c) => {
    const crit = mkCriteria(evalNode(a[1], c));
    // Excel anchor semantics: sum_range may be just its top-left cell; it resizes to the criteria range's shape
    const rR = a[2] ? refRect(a[0]) : null, sR = a[2] ? refRect(a[2]) : null;
    if (a[2] && rR && sR && typeof c.get === 'function') {
      let s = 0;
      for (let r = rR.r1; r <= rR.r2; r++) for (let cc = rR.c1; cc <= rR.c2; cc++) {
        if (crit(c.get({ r, c: cc }))) {
          const v = c.get({ r: r - rR.r1 + sR.r1, c: cc - rR.c1 + sR.c1 });
          if (typeof v === 'number') s += v;
        }
      }
      return s;
    }
    const range = evalNode(a[0], c);
    const sumR = a[2] ? evalNode(a[2], c) : range;
    const A = Array.isArray(range) ? range.flat() : [range], B = Array.isArray(sumR) ? sumR.flat() : [sumR];
    let s = 0;
    for (let i = 0; i < A.length; i++) if (crit(A[i])) { const n = B[Math.min(i, B.length - 1)]; if (typeof n === 'number') s += n; }
    return s;
  },
  COUNTIF: (a, c) => {
    const crit = mkCriteria(evalNode(a[1], c));
    const range = evalNode(a[0], c);
    const A = Array.isArray(range) ? range.flat() : [range];
    return A.reduce((n, v) => n + (crit(v) ? 1 : 0), 0);
  },
  AVERAGEIF: (a, c) => {
    const crit = mkCriteria(evalNode(a[1], c));
    const rR = a[2] ? refRect(a[0]) : null, vR = a[2] ? refRect(a[2]) : null;
    if (a[2] && rR && vR && typeof c.get === 'function') {
      let s = 0, n = 0;
      for (let r = rR.r1; r <= rR.r2; r++) for (let cc = rR.c1; cc <= rR.c2; cc++) {
        if (crit(c.get({ r, c: cc }))) {
          const v = c.get({ r: r - rR.r1 + vR.r1, c: cc - rR.c1 + vR.c1 });
          if (typeof v === 'number') { s += v; n++; }
        }
      }
      return n ? s / n : E_DIV();
    }
    const range = evalNode(a[0], c);
    const avgR = a[2] ? evalNode(a[2], c) : range;
    const A = Array.isArray(range) ? range.flat() : [range], B = Array.isArray(avgR) ? avgR.flat() : [avgR];
    let s = 0, n = 0;
    for (let i = 0; i < A.length; i++) if (crit(A[i])) { const v = toNum(B[Math.min(i, B.length - 1)]); if (typeof v === 'number') { s += v; n++; } }
    return n ? s / n : E_DIV();
  },
  ROUND: (a, c) => { const x = needNum(arg1(a, c)), d = needNum(evalNode(a[1], c)); if (isErr(x)) return x; if (isErr(d)) return d; const p = Math.pow(10, Math.trunc(d)); return Math.round((x + (x >= 0 ? 1e-12 : -1e-12)) * p) / p; },
  ROUNDUP: (a, c) => { const x = needNum(arg1(a, c)), d = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(d)) return isErr(x) ? x : d; const p = Math.pow(10, Math.trunc(d)); return (x >= 0 ? Math.ceil(x * p) : Math.floor(x * p)) / p; },
  ROUNDDOWN: (a, c) => { const x = needNum(arg1(a, c)), d = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(d)) return isErr(x) ? x : d; const p = Math.pow(10, Math.trunc(d)); return (x >= 0 ? Math.floor(x * p) : Math.ceil(x * p)) / p; },
  INT: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.floor(x); },
  TRUNC: (a, c) => { const x = needNum(arg1(a, c)); const d = a.length > 1 ? needNum(evalNode(a[1], c)) : 0; if (isErr(x) || isErr(d)) return isErr(x) ? x : d; const p = Math.pow(10, Math.trunc(d)); return Math.trunc(x * p) / p; },
  ABS: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.abs(x); },
  SIGN: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.sign(x); },
  SQRT: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; return x < 0 ? E_NUM() : Math.sqrt(x); },
  POWER: (a, c) => { const x = needNum(arg1(a, c)), y = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(y)) return isErr(x) ? x : y; const v = Math.pow(x, y); return isNaN(v) ? E_NUM() : v; },
  EXP: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.exp(x); },
  LN: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; return x <= 0 ? E_NUM() : Math.log(x); },
  LOG10: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; return x <= 0 ? E_NUM() : Math.log10(x); },
  LOG: (a, c) => { const x = needNum(arg1(a, c)); const b = a.length > 1 ? needNum(evalNode(a[1], c)) : 10; if (isErr(x) || isErr(b)) return isErr(x) ? x : b; return (x <= 0 || b <= 0 || b === 1) ? E_NUM() : Math.log(x) / Math.log(b); },
  MOD: (a, c) => { const x = needNum(arg1(a, c)), y = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(y)) return isErr(x) ? x : y; if (y === 0) return E_DIV(); return x - y * Math.floor(x / y); },
  QUOTIENT: (a, c) => { const x = needNum(arg1(a, c)), y = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(y)) return isErr(x) ? x : y; if (y === 0) return E_DIV(); return Math.trunc(x / y); },
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (a, c) => { const x = needNum(arg1(a, c)), y = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(y)) return isErr(x) ? x : y; return Math.floor(Math.random() * (Math.ceil(y) - Math.floor(x) + 1)) + Math.floor(x); },
  DEGREES: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : x * 180 / Math.PI; },
  RADIANS: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : x * Math.PI / 180; },
  SIN: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.sin(x); },
  COS: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.cos(x); },
  TAN: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.tan(x); },
  ASIN: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : (x < -1 || x > 1 ? E_NUM() : Math.asin(x)); },
  ACOS: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : (x < -1 || x > 1 ? E_NUM() : Math.acos(x)); },
  ATAN: (a, c) => { const x = needNum(arg1(a, c)); return isErr(x) ? x : Math.atan(x); },
  ATAN2: (a, c) => { const x = needNum(arg1(a, c)), y = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(y)) return isErr(x) ? x : y; return Math.atan2(y, x); },

  /* logical */
  IF: (a, c) => {
    const cond = toBool(evalNode(a[0], c));
    if (isErr(cond)) return cond;
    if (cond) return a.length > 1 ? evalNode(a[1], c) : true;
    return a.length > 2 ? evalNode(a[2], c) : false;
  },
  AND: (a, c) => { let any = false; for (const v of iterArgs(a, c)) { if (isErr(v)) return v; if (typeof v === 'boolean') { any = true; if (!v) return false; } else if (typeof v === 'number') { any = true; if (v === 0) return false; } } return any ? true : E_VAL(); },
  OR: (a, c) => { let any = false; for (const v of iterArgs(a, c)) { if (isErr(v)) return v; if (typeof v === 'boolean') { any = true; if (v) return true; } else if (typeof v === 'number') { any = true; if (v !== 0) return true; } } return any ? false : E_VAL(); },
  NOT: (a, c) => { const v = toBool(evalNode(a[0], c)); return isErr(v) ? v : !v; },
  XOR: (a, c) => { let n = 0; for (const v of iterArgs(a, c)) { const b = toBool(v); if (isErr(b)) return b; if (b) n++; } return n % 2 === 1; },
  TRUE: () => true, FALSE: () => false,
  IFERROR: (a, c) => { const v = evalNode(a[0], c); if (isErr(v)) return a.length > 1 ? evalNode(a[1], c) : null; const chk = Array.isArray(v) ? v.flat()[0] : v; return isErr(chk) ? (a.length > 1 ? evalNode(a[1], c) : null) : v; },
  IFNA: (a, c) => { const v = evalNode(a[0], c); if (isErr(v) && v.__err === '#N/A') return a.length > 1 ? evalNode(a[1], c) : null; return v; },

  /* text */
  CONCAT: (a, c) => concatAll(a, c),
  CONCATENATE: (a, c) => concatAll(a, c),
  TEXTJOIN: (a, c) => {
    const delim = toStr(evalNode(a[0], c)); if (isErr(delim)) return delim;
    const ign = toBool(evalNode(a[1], c));
    let s = '';
    for (const arg of a.slice(2)) {
      const v = evalNode(arg, c);
      for (const x of (Array.isArray(v) ? v.flat() : [v])) {
        const t = toStr(x); if (isErr(t)) return t;
        if (t === '' && ign) continue;
        s = s === '' ? t : s + delim + t;
      }
    }
    return s;
  },
  LEFT: (a, c) => { const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; const n = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; if (isErr(n)) return n; if (n < 0) return E_VAL(); return s.slice(0, Math.trunc(n)); },
  RIGHT: (a, c) => { const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; const n = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; if (isErr(n)) return n; if (n < 0) return E_VAL(); return n === 0 ? '' : s.slice(-Math.trunc(n)); },
  MID: (a, c) => { const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; const st = needNum(evalNode(a[1], c)), n = needNum(evalNode(a[2], c)); if (isErr(st) || isErr(n)) return isErr(st) ? st : n; if (st < 1 || n < 0) return E_VAL(); return s.slice(st - 1, st - 1 + n); },
  LEN: (a, c) => { const s = toStr(evalNode(a[0], c)); return isErr(s) ? s : s.length; },
  LOWER: (a, c) => { const s = toStr(evalNode(a[0], c)); return isErr(s) ? s : s.toLowerCase(); },
  UPPER: (a, c) => { const s = toStr(evalNode(a[0], c)); return isErr(s) ? s : s.toUpperCase(); },
  PROPER: (a, c) => { const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; return s.toLowerCase().replace(/(^|[^a-zA-Z0-9'])([a-z])/g, (m, p, ch) => p + ch.toUpperCase()); },
  TRIM: (a, c) => { const s = toStr(evalNode(a[0], c)); return isErr(s) ? s : s.trim().replace(/ +/g, ' '); },
  EXACT: (a, c) => { const x = toStr(evalNode(a[0], c)), y = toStr(evalNode(a[1], c)); if (isErr(x) || isErr(y)) return isErr(x) ? x : y; return x === y; },
  REPLACE: (a, c) => { const s = toStr(evalNode(a[0], c)); const st = needNum(evalNode(a[1], c)), n = needNum(evalNode(a[2], c)), rep = toStr(evalNode(a[3], c)); if ([s, st, n, rep].some(isErr)) return E_VAL(); return s.slice(0, st - 1) + rep + s.slice(st - 1 + n); },
  SUBSTITUTE: (a, c) => {
    const s = toStr(evalNode(a[0], c)), o = toStr(evalNode(a[1], c)), nn = toStr(evalNode(a[2], c));
    if ([s, o, nn].some(isErr)) return E_VAL();
    if (o === '') return s;
    const idx = a.length > 3 ? needNum(evalNode(a[3], c)) : null;
    if (idx == null) return s.split(o).join(nn);
    let k = 0, pos = 0;
    while ((pos = s.indexOf(o, pos)) !== -1) { k++; if (k === idx) return s.slice(0, pos) + nn + s.slice(pos + o.length); pos += o.length; }
    return s;
  },
  FIND: (a, c) => { const f = toStr(evalNode(a[0], c)), s = toStr(evalNode(a[1], c)); const st = a.length > 2 ? needNum(evalNode(a[2], c)) : 1; const i = s.indexOf(f, st - 1); return i === -1 ? E_VAL() : i + 1; },
  SEARCH: (a, c) => { const f = toStr(evalNode(a[0], c)), s = toStr(evalNode(a[1], c)); const st = a.length > 2 ? needNum(evalNode(a[2], c)) : 1; const esc = f.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'); const re = new RegExp(esc, 'i'); const m = s.slice(st - 1).match(re); return m ? (m.index + st) : E_VAL(); },
  REPT: (a, c) => { const s = toStr(evalNode(a[0], c)); const n = needNum(evalNode(a[1], c)); if (isErr(n)) return n; return n <= 0 ? '' : s.repeat(Math.min(32767, Math.trunc(n))); },
  T: (a, c) => { const v = evalNode(a[0], c); return typeof v === 'string' ? v : ''; },
  VALUE: (a, c) => { const v = evalNode(a[0], c); const n = toNum(v); if (!isErr(n)) return n; const d = parseDateStr(toStr(v)); return d != null ? d : E_VAL(); },
  TEXT: (a, c) => { const v = evalNode(a[0], c); const f = toStr(evalNode(a[1], c)); if (isErr(f)) return f; if (typeof v === 'string') return v; if (isErr(v)) return v; const r = fmt(v, f || 'General'); return typeof r === 'string' ? r : r.text; },
  CHAR: (a, c) => { const n = needNum(evalNode(a[0], c)); if (isErr(n) || n < 1 || n > 255) return E_VAL(); return String.fromCharCode(Math.round(n)); },
  CODE: (a, c) => { const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; return s === '' ? E_VAL() : s.charCodeAt(0); },

  /* date & time */
  TODAY: () => dateToSerial(new Date()),
  NOW: () => dateToSerial(new Date()) + (() => { const d = new Date(); return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; })(),
  DATE: (a, c) => {
    let y = needNum(evalNode(a[0], c)), m = needNum(evalNode(a[1], c)), d = needNum(evalNode(a[2], c));
    if ([y, m, d].some(isErr)) return E_VAL();
    y = Math.trunc(y); if (y < 1900) y += 1900;
    m = Math.trunc(m); d = Math.trunc(d);
    // Excel's fictional Feb 1900: Feb 29 exists (serial 60), Feb 30+ rolls into March
    if (y === 1900 && m === 2 && d >= 29) return 60 + (d - 29);
    const dt = new Date(0); dt.setUTCFullYear(y, m - 1, d); dt.setUTCHours(0, 0, 0, 0);
    const nd = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    let ser = dateToSerial(nd);
    if (nd < new Date(Date.UTC(1900, 2, 1))) ser -= 1; // pre-Mar-1900 fictional calendar shift
    return ser;
  },
  TIME: (a, c) => { const h = needNum(evalNode(a[0], c)), m = needNum(evalNode(a[1], c)), s = needNum(evalNode(a[2], c)); if ([h, m, s].some(isErr)) return E_VAL(); const v = ((h * 3600 + m * 60 + s) / 86400) % 1; return v < 0 ? v + 1 : v; },
  YEAR: (a, c) => { const s = dateArg(a[0], c); if (isErr(s)) return s; return serialYMD(s).y; },
  MONTH: (a, c) => { const s = dateArg(a[0], c); if (isErr(s)) return s; return serialYMD(s).m; },
  DAY: (a, c) => { const s = dateArg(a[0], c); if (isErr(s)) return s; return serialYMD(s).d; },
  HOUR: (a, c) => { const v = timeArg(a[0], c); if (isErr(v)) return v; return Math.floor(v * 24 % 24); },
  MINUTE: (a, c) => { const v = timeArg(a[0], c); if (isErr(v)) return v; return Math.floor(v * 1440 % 60); },
  SECOND: (a, c) => { const v = timeArg(a[0], c); if (isErr(v)) return v; return Math.floor(Math.round(v * 86400) % 60); },
  WEEKDAY: (a, c) => { const s = dateArg(a[0], c); if (isErr(s)) return s; const t = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; const wd = serialToDate(s).getUTCDay() + 1; if (t === 2) return wd === 1 ? 7 : wd - 1; if (t === 3) return wd === 1 ? 6 : wd - 2; return wd; },
  DAYS: (a, c) => { const e = dateArg(a[0], c), s = dateArg(a[1], c); if (isErr(e) || isErr(s)) return isErr(e) ? e : s; return Math.floor(e) - Math.floor(s); },
  EDATE: (a, c) => { const s = dateArg(a[0], c), m = needNum(evalNode(a[1], c)); if (isErr(s) || isErr(m)) return isErr(s) ? s : m; const d = serialToDate(s); const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(m), d.getUTCDate())); if (nd.getUTCDate() !== d.getUTCDate()) nd.setUTCDate(0); return dateToSerial(nd); },
  EOMONTH: (a, c) => { const s = dateArg(a[0], c), m = needNum(evalNode(a[1], c)); if (isErr(s) || isErr(m)) return isErr(s) ? s : m; const d = serialToDate(s); const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(m) + 1, 0)); return dateToSerial(nd); },

  /* info */
  ISNUMBER: (a, c) => typeof evalNode(a[0], c) === 'number',
  ISTEXT: (a, c) => typeof evalNode(a[0], c) === 'string',
  ISNONTEXT: (a, c) => typeof evalNode(a[0], c) !== 'string',
  ISBLANK: (a, c) => { const v = evalNode(a[0], c); return v == null || v === ''; },
  ISLOGICAL: (a, c) => typeof evalNode(a[0], c) === 'boolean',
  ISERROR: (a, c) => isErr(evalNode(a[0], c)),
  ISERR: (a, c) => { const v = evalNode(a[0], c); return isErr(v) && v.__err !== '#N/A'; },
  ISNA: (a, c) => { const v = evalNode(a[0], c); return isErr(v) && v.__err === '#N/A'; },
  NA: () => E_NA(),

  /* lookup */
  VLOOKUP: (a, c) => lookupImpl(a, c, false),
  HLOOKUP: (a, c) => lookupImpl(a, c, true),
  MATCH: (a, c) => {
    const lk = evalNode(a[0], c); if (isErr(lk)) return lk;
    const arr = evalNode(a[1], c); if (!Array.isArray(arr)) return E_NA();
    const type = a.length > 2 ? needNum(evalNode(a[2], c)) : 1;
    const flat = arr.flat();
    if (type === 0) {
      const crit = mkCriteria(typeof lk === 'string' && /[*?]/.test(lk) ? lk : (typeof lk === 'string' ? lk : lk));
      for (let i = 0; i < flat.length; i++) {
        const v = flat[i];
        if ((typeof lk === 'number' && v === lk) || (typeof lk === 'boolean' && v === lk)) return i + 1;
        if (typeof lk === 'string' && typeof v === 'string' && (crit(v) || v.toLowerCase() === lk.toLowerCase())) return i + 1;
      }
      return E_NA();
    }
    let best = -1;
    for (let i = 0; i < flat.length; i++) { const v = flat[i]; if (typeof v !== 'number') continue; if (type === 1 ? v <= lk : v >= lk) best = i; else break; }
    if (type === -1 && best !== -1) { for (let i = best; i < flat.length; i++) { if (typeof flat[i] === 'number' && flat[i] >= lk) best = i; else break; } }
    return best === -1 ? E_NA() : best + 1;
  },
  INDEX: (a, c) => {
    const arr = evalNode(a[0], c); if (!Array.isArray(arr)) return E_REF();
    const rows = arr.__rows ? arr : null;
    const rn = a.length > 1 ? needNum(evalNode(a[1], c)) : null;
    const cn = a.length > 2 ? needNum(evalNode(a[2], c)) : null;
    if (isErr(rn) || isErr(cn)) return isErr(rn) ? rn : cn;
    if (rows) {
      const R = rows.length, C = rows[0] ? rows[0].length : 1;
      if (rn != null && cn == null) {
        if (R === 1) { const v = rows[0][rn - 1]; return v === undefined ? E_REF() : v; }   // INDEX(rowVector, n)
        if (C === 1) { const rr = rows[rn - 1]; if (!rr) return E_REF(); return rr[0] === undefined ? E_REF() : rr[0]; } // INDEX(colVector, n)
      }
      if (rn === 0 && cn) { rows.__rows = false; return rows.map(r => r[cn - 1]); }
      if (cn === 0 && rn) { const rr = rows[rn - 1]; if (!rr) return E_REF(); rr.__rows = false; return [].concat(rr); }
      const r = rows[(rn || 1) - 1]; if (!r) return E_REF(); const v = r[(cn || 1) - 1]; return v === undefined ? E_REF() : v;
    }
    const flat = [].concat(arr);
    const idx = (cn != null && cn > 1 ? cn : rn) - 1;
    return flat[idx] === undefined ? E_REF() : flat[idx];
  },
  CHOOSE: (a, c) => { const i = needNum(evalNode(a[0], c)); if (isErr(i)) return i; const idx = Math.trunc(i); if (idx < 1 || idx >= a.length) return E_VAL(); return evalNode(a[idx], c); },
  ROW: (a, c) => { if (!a.length || (a[0] && a[0].k === 'missing')) return c.self ? c.self.r + 1 : E_NA(); const nd = a[0]; if (nd.k === 'ref' && !nd.ref.colOnly && !nd.ref.rowOnly) return nd.ref.r + 1; if (nd.k === 'rng' && !nd.a.colOnly && !nd.a.rowOnly) return nd.a.r + 1; return E_NA(); },
  COLUMN: (a, c) => { if (!a.length || (a[0] && a[0].k === 'missing')) return c.self ? c.self.c + 1 : E_NA(); const nd = a[0]; if (nd.k === 'ref' && !nd.ref.colOnly && !nd.ref.rowOnly) return nd.ref.c + 1; if (nd.k === 'rng') return (nd.a.c != null ? nd.a.c : 0) + 1; return E_NA(); },
  ROWS: (a, c) => { const nd = a[0]; if (nd.k === 'rng') { if (nd.a.colOnly) return MAXR; return Math.abs((nd.b.r != null ? nd.b.r : nd.a.r) - (nd.a.r != null ? nd.a.r : nd.b.r)) + 1; } if (nd.k === 'arr') return nd.rows.length; if (nd.k === 'ref') return 1; const v = evalNode(a[0], c); return Array.isArray(v) ? (v.__rows ? v.length : 1) : E_NA(); },
  COLUMNS: (a, c) => { const nd = a[0]; if (nd.k === 'rng') { if (nd.a.rowOnly) return MAXC + 1; return Math.abs((nd.b.c != null ? nd.b.c : nd.a.c) - (nd.a.c != null ? nd.a.c : nd.b.c)) + 1; } if (nd.k === 'arr') return nd.rows[0] ? nd.rows[0].length : 0; if (nd.k === 'ref') return 1; const v = evalNode(a[0], c); if (Array.isArray(v)) return v.__rows ? (v[0] ? v[0].length : 0) : v.length; return E_NA(); },
  'RANK.EQ': (a, c) => { const x = needNum(evalNode(a[0], c)); if (isErr(x)) return x; const ns = numsFrom([a[1]], c).filter(v => typeof v === 'number'); const ord = a.length > 2 ? needNum(evalNode(a[2], c)) : 0; const cnt = ns.filter(v => (ord ? v < x : v > x)).length; return cnt + 1; },
  RANK: (a, c) => FUNCS['RANK.EQ'](a, c),
  COUNTIFS: (a, c) => {
    let n = 0;
    const ranges = [], crits = [];
    for (let i = 0; i + 1 < a.length; i += 2) { ranges.push(evalNode(a[i], c)); crits.push(mkCriteria(evalNode(a[i + 1], c))); }
    if (!ranges.length) return E_VAL();
    const A0 = Array.isArray(ranges[0]) ? ranges[0].flat() : [ranges[0]];
    const Bs = ranges.map(r => Array.isArray(r) ? r.flat() : [r]);
    outer: for (let i = 0; i < A0.length; i++) {
      for (let j = 0; j < Bs.length; j++) { if (!crits[j](Bs[j][Math.min(i, Bs[j].length - 1)])) continue outer; }
      n++;
    }
    return n;
  },
  SUMIFS: (a, c) => {
    const sumR = evalNode(a[0], c);
    const S = Array.isArray(sumR) ? sumR.flat() : [sumR];
    const ranges = [], crits = [];
    for (let i = 1; i + 1 < a.length; i += 2) { ranges.push(evalNode(a[i], c)); crits.push(mkCriteria(evalNode(a[i + 1], c))); }
    if (!ranges.length) return E_VAL();
    const Rs = ranges.map(r => Array.isArray(r) ? r.flat() : [r]);
    let s = 0;
    outer: for (let i = 0; i < S.length; i++) {
      for (let j = 0; j < Rs.length; j++) { if (!crits[j](Rs[j][Math.min(i, Rs[j].length - 1)])) continue outer; }
      const n = toNum(S[i]); if (typeof n === 'number') s += n;
    }
    return s;
  },
  MAXIFS: (a, c) => {
    const res = ifsCollect(a, c);
    if (isErr(res)) return res;
    return res.length ? Math.max(...res) : 0;
  },
  MINIFS: (a, c) => {
    const res = ifsCollect(a, c);
    if (isErr(res)) return res;
    return res.length ? Math.min(...res) : 0;
  },
  AVERAGEIFS: (a, c) => {
    const x = FUNCS.SUMIFS(a, c); if (isErr(x)) return x;
    const n = FUNCS.COUNTIFS(a.slice(1), c); if (isErr(n)) return n;
    return n ? x / n : E_DIV();
  },

  /* ================= EXPANSION PACK ================= */
  /* --- math: rounding families --- */
  CEILING: (a, c) => { const x = needNum(arg1(a, c)); let s = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; if (isErr(x) || isErr(s)) return isErr(x) ? x : s; if (s === 0) return 0; if ((x > 0 && s < 0) || (x < 0 && s > 0)) return E_NUM(); const m = Math.abs(s); return Math.sign(x || 1) * Math.ceil((Math.abs(x) - 1e-12) / m) * m; },
  FLOOR: (a, c) => { const x = needNum(arg1(a, c)); let s = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; if (isErr(x) || isErr(s)) return isErr(x) ? x : s; if (s === 0) return E_DIV(); if ((x > 0 && s < 0) || (x < 0 && s > 0)) return E_NUM(); const m = Math.abs(s); return Math.sign(x || 1) * Math.floor((Math.abs(x) + 1e-12) / m) * m; },
  'CEILING.MATH': (a, c) => { const x = needNum(arg1(a, c)); let s = a.length > 1 ? Math.abs(needNum(evalNode(a[1], c))) : 1; if (isErr(x) || isErr(s)) return isErr(x) ? x : s; if (!s) return 0; const mode = a.length > 2 ? needNum(evalNode(a[2], c)) : 0; if (x < 0) return mode ? -Math.ceil((Math.abs(x) - 1e-12) / s) * s : -Math.floor((Math.abs(x) + 1e-12) / s) * s; return Math.ceil((x - 1e-12) / s) * s; },
  'FLOOR.MATH': (a, c) => { const x = needNum(arg1(a, c)); let s = a.length > 1 ? Math.abs(needNum(evalNode(a[1], c))) : 1; if (isErr(x) || isErr(s)) return isErr(x) ? x : s; if (!s) return 0; const mode = a.length > 2 ? needNum(evalNode(a[2], c)) : 0; if (x < 0 && mode) return -Math.floor((-x + 1e-12) / s) * s; return Math.floor((x + 1e-12) / s) * s; },
  MROUND: (a, c) => { const x = needNum(arg1(a, c)), m = needNum(evalNode(a[1], c)); if (isErr(x) || isErr(m)) return isErr(x) ? x : m; if (m === 0) return 0; if (Math.sign(x) && Math.sign(m) && Math.sign(x) !== Math.sign(m)) return E_NUM(); const am = Math.abs(m); return Math.sign(x || 1) * Math.round(Math.abs(x) / am + 1e-9) * am; },
  EVEN: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; if (x === 0) return 0; return Math.sign(x) * (Math.ceil((Math.abs(x) - 1e-12) / 2) * 2); },
  ODD: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; if (x === 0) return 1; const v = Math.ceil(Math.abs(x) - 1e-12); const o = v % 2 === 1 ? v : v + 1; return Math.sign(x) * o; },
  FACT: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; const n = Math.trunc(x); if (n < 0) return E_NUM(); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  COMBIN: (a, c) => { const n0 = needNum(arg1(a, c)), k0 = needNum(evalNode(a[1], c)); if (isErr(n0) || isErr(k0)) return isErr(n0) ? n0 : k0; const n = Math.trunc(n0), k = Math.trunc(k0); if (n < 0 || k < 0 || k > n) return E_NUM(); let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); },
  GCD: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); if (!ns.length) return E_DIV(); let g = 0; for (const v of ns) { const n = Math.trunc(v); if (n < 0) return E_NUM(); g = gcd2(g, n); } return g; },
  LCM: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); if (!ns.length) return E_DIV(); let l = 1; for (const v of ns) { const n = Math.trunc(v); if (n < 0) return E_NUM(); if (n === 0) return 0; l = l / gcd2(l, n) * n; } return l; },
  SUMSQ: (a, c) => { const ns = numsFrom(a, c, { ignoreErr: false }); if (aggErr(ns)) return aggErr(ns); return ns.reduce((s, v) => s + v * v, 0); },
  SQRTPI: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; return x < 0 ? E_NUM() : Math.sqrt(x * Math.PI); },

  /* --- statistics --- */
  GEOMEAN: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); if (!ns.length) return E_DIV(); if (ns.some(v => v <= 0)) return E_NUM(); return Math.exp(ns.reduce((s, v) => s + Math.log(v), 0) / ns.length); },
  HARMEAN: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); if (!ns.length) return E_DIV(); if (ns.some(v => v <= 0)) return E_NUM(); return ns.length / ns.reduce((s, v) => s + 1 / v, 0); },
  AVEDEV: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); if (!ns.length) return E_DIV(); const m = ns.reduce((x, y) => x + y, 0) / ns.length; return ns.reduce((s, v) => s + Math.abs(v - m), 0) / ns.length; },
  DEVSQ: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); const m = ns.reduce((x, y) => x + y, 0) / (ns.length || 1); return ns.reduce((s, v) => s + (v - m) * (v - m), 0); },
  AVERAGEA: (a, c) => { let s = 0, n = 0; for (const v of iterArgs(a, c)) { if (isErr(v)) return v; if (v == null) { n++; continue; } if (typeof v === 'number') { s += v; n++; } else if (typeof v === 'boolean') { s += v ? 1 : 0; n++; } else if (typeof v === 'string') { if (v === '') { continue; } const num = toNum(v); if (typeof num === 'number') s += num; n++; } } return n ? s / n : E_DIV(); },
  'PERCENTILE.INC': (a, c) => { const ns = numsFrom([a[0]], c).sort((x, y) => x - y); const k = needNum(evalNode(a[1], c)); if (isErr(k)) return k; if (!ns.length) return E_NUM(); if (k < 0 || k > 1) return E_NUM(); const pos = k * (ns.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? ns[lo] : ns[lo] + (ns[hi] - ns[lo]) * (pos - lo); },
  PERCENTILE: (a, c) => FUNCS['PERCENTILE.INC'](a, c),
  'QUARTILE.INC': (a, c) => { const q = needNum(evalNode(a[1], c)); if (isErr(q)) return q; const qq = Math.trunc(q); if (qq < 0 || qq > 4) return E_NUM(); return FUNCS['PERCENTILE.INC']([a[0], { k: 'num', v: qq / 4 }], c); },
  QUARTILE: (a, c) => FUNCS['QUARTILE.INC'](a, c),
  'PERCENTRANK.INC': (a, c) => { const ns = numsFrom([a[0]], c).sort((x, y) => x - y); const x = needNum(evalNode(a[1], c)); if (isErr(x)) return x; if (!ns.length || x < ns[0] || x > ns[ns.length - 1]) return E_NA(); const sig = a.length > 2 ? Math.max(1, Math.trunc(needNum(evalNode(a[2], c)))) : 3; let r; if (x === ns[ns.length - 1]) r = 1; else { let i = 0; while (i < ns.length && ns[i] <= x) i++; i--; if (ns[i] === x) { /* rank of exact match (first occurrence counts) */ r = i / (ns.length - 1); } else { r = (i + (x - ns[i]) / (ns[i + 1] - ns[i])) / (ns.length - 1); } } const p = Math.pow(10, sig); return Math.floor(r * p + 1e-9) / p; },
  PERCENTRANK: (a, c) => FUNCS['PERCENTRANK.INC'](a, c),
  'RANK.AVG': (a, c) => { const x = needNum(evalNode(a[0], c)); if (isErr(x)) return x; const ns = numsFrom([a[1]], c); if (aggErr(ns)) return aggErr(ns); if (!ns.includes(x)) return E_NA(); const ord = a.length > 2 ? needNum(evalNode(a[2], c)) : 0; const better = ns.filter(v => (ord ? v < x : v > x)).length; const ties = ns.filter(v => v === x).length; return better + 1 + (ties - 1) / 2; },
  CORREL: (a, c) => { const p = twoArrays(a, c); if (isErr(p)) return p; const { xs, ys } = p; if (xs.length < 1) return E_DIV(); const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length; let num = 0, dx = 0, dy = 0; for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } if (dx === 0 || dy === 0) return E_DIV(); return num / Math.sqrt(dx * dy); },
  SLOPE: (a, c) => { const p = twoArrays(a, c); if (isErr(p)) return p; const ys = p.xs, xs = p.ys; /* Excel: SLOPE(known_y, known_x) */ if (!xs.length) return E_DIV(); const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length; let num = 0, dx = 0; for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; } return dx === 0 ? E_DIV() : num / dx; },
  INTERCEPT: (a, c) => { const p = twoArrays(a, c); if (isErr(p)) return p; const ys = p.xs, xs = p.ys; if (!xs.length) return E_DIV(); const sl = FUNCS.SLOPE(a, c); if (isErr(sl)) return sl; return ys.reduce((s, v) => s + v, 0) / ys.length - sl * (xs.reduce((s, v) => s + v, 0) / xs.length); },
  'FORECAST.LINEAR': (a, c) => { const x = needNum(evalNode(a[0], c)); if (isErr(x)) return x; const rest = [a[1], a[2]]; const sl = FUNCS.SLOPE(rest, c); if (isErr(sl)) return sl; const ic = FUNCS.INTERCEPT(rest, c); if (isErr(ic)) return ic; return ic + sl * x; },
  FORECAST: (a, c) => FUNCS['FORECAST.LINEAR'](a, c),
  RSQ: (a, c) => { const r = FUNCS.CORREL(a, c); return isErr(r) ? r : r * r; },

  /* --- financial --- */
  PMT: (a, c) => { const r = needNum(evalNode(a[0], c)), n = needNum(evalNode(a[1], c)), pv = needNum(evalNode(a[2], c)); const fv = a.length > 3 ? needNum(evalNode(a[3], c)) : 0, ty = a.length > 4 ? needNum(evalNode(a[4], c)) : 0; if ([r, n, pv, fv, ty].some(isErr)) return E_VAL(); if (n === 0) return E_NUM(); if (r === 0) return -(pv + fv) / n; const pw = Math.pow(1 + r, n); return -(pv * pw + fv) * r / ((1 + r * (ty ? 1 : 0)) * (pw - 1)); },
  FV: (a, c) => { const r = needNum(evalNode(a[0], c)), n = needNum(evalNode(a[1], c)), pmt = needNum(evalNode(a[2], c)); const pv = a.length > 3 ? needNum(evalNode(a[3], c)) : 0, ty = a.length > 4 ? needNum(evalNode(a[4], c)) : 0; if ([r, n, pmt, pv, ty].some(isErr)) return E_VAL(); if (r === 0) return -(pv + pmt * n); const pw = Math.pow(1 + r, n); return -(pv * pw + pmt * (1 + r * (ty ? 1 : 0)) * (pw - 1) / r); },
  PV: (a, c) => { const r = needNum(evalNode(a[0], c)), n = needNum(evalNode(a[1], c)), pmt = needNum(evalNode(a[2], c)); const fv = a.length > 3 ? needNum(evalNode(a[3], c)) : 0, ty = a.length > 4 ? needNum(evalNode(a[4], c)) : 0; if ([r, n, pmt, fv, ty].some(isErr)) return E_VAL(); if (r === 0) return -(fv + pmt * n); const pw = Math.pow(1 + r, n); return -(fv + pmt * (1 + r * (ty ? 1 : 0)) * (pw - 1) / r) / pw; },
  NPER: (a, c) => {
    const r = needNum(evalNode(a[0], c)), pmt = needNum(evalNode(a[1], c)), pv = needNum(evalNode(a[2], c));
    const fv = a.length > 3 ? needNum(evalNode(a[3], c)) : 0, ty = a.length > 4 ? needNum(evalNode(a[4], c)) : 0;
    if ([r, pmt, pv, fv, ty].some(isErr)) return E_VAL();
    if (r === 0) { if (pmt === 0) return E_NUM(); return -(pv + fv) / pmt; }
    const w = 1 + r * (ty ? 1 : 0);
    const q = pmt * w / r;
    const pw = (q - fv) / (pv + q);
    if (pw <= 0 || r <= -1) return E_NUM();
    return Math.log(pw) / Math.log(1 + r);
  },
  RATE: (a, c) => { const n = needNum(evalNode(a[0], c)), pmt = needNum(evalNode(a[1], c)), pv = needNum(evalNode(a[2], c)); const fv = a.length > 3 ? needNum(evalNode(a[3], c)) : 0, ty = a.length > 4 ? needNum(evalNode(a[4], c)) : 0; if ([n, pmt, pv, fv, ty].some(isErr)) return E_VAL(); const f = r => { if (Math.abs(r) < 1e-12) return pv + pmt * n + fv; const pw = Math.pow(1 + r, n); return pv * pw + pmt * (1 + r * (ty ? 1 : 0)) * (pw - 1) / r + fv; }; let r = a.length > 5 ? needNum(evalNode(a[5], c)) : 0.1; for (let i = 0; i < 60; i++) { const h = 1e-7, d = (f(r + h) - f(r - h)) / (2 * h); if (d === 0 || !isFinite(d)) break; const nr = r - f(r) / d; if (!isFinite(nr)) break; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } let lo = -0.999999, hi = 10, flo = f(lo), fhi = f(hi); if (flo * fhi > 0) return E_NUM(); for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, fm = f(mid); if (Math.abs(fm) < 1e-10) return mid; if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; } } return (lo + hi) / 2; },
  NPV: (a, c) => { const r = needNum(evalNode(a[0], c)); if (isErr(r)) return r; if (r <= -1) return E_NUM(); let s = 0, i = 0; for (const v of iterArgs(a.slice(1), c, true)) { if (isErr(v)) { if (v.__err) return v; continue; } const n = typeof v === 'number' ? v : 0; i++; s += n / Math.pow(1 + r, i); } return s; },
  IRR: (a, c) => { const vals = []; for (const v of iterArgs([a[0]], c)) vals.push(typeof v === 'number' ? v : 0); if (vals.length < 2) return E_NUM(); const npv = r => { let s = 0; for (let i = 0; i < vals.length; i++) s += vals[i] / Math.pow(1 + r, i); return s; }; let r = a.length > 1 ? needNum(evalNode(a[1], c)) : 0.1; for (let i = 0; i < 80; i++) { const h = 1e-7, d = (npv(r + h) - npv(r - h)) / (2 * h); if (!isFinite(d) || d === 0) break; const nr = r - npv(r) / d; if (!isFinite(nr) || nr <= -1) break; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } let lo = -0.9999999, hi = 100, flo = npv(lo), fhi = npv(hi); if (flo * fhi > 0) return E_NUM(); for (let i = 0; i < 300; i++) { const mid = (lo + hi) / 2, fm = npv(mid); if (Math.abs(fm) < 1e-9) return mid; if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; } } return (lo + hi) / 2; },
  IPMT: (a, c) => {
    const r = needNum(evalNode(a[0], c)), per = needNum(evalNode(a[1], c)), n = needNum(evalNode(a[2], c)), pv = needNum(evalNode(a[3], c));
    const fv = a.length > 4 ? needNum(evalNode(a[4], c)) : 0, ty = a.length > 5 ? needNum(evalNode(a[5], c)) : 0;
    if ([r, per, n, pv, fv, ty].some(isErr)) return E_VAL();
    if (per < 1 || per > n) return E_NUM();
    const pmt = FUNCS.PMT([a[0], a[2], a[3]].concat(a.length > 4 ? [a[4]] : []).concat(a.length > 5 ? [a[5]] : []), c);
    if (isErr(pmt)) return pmt;
    let bal = pv, interest = 0;
    for (let p = 1; p <= per; p++) {
      if (ty === 1) { interest = p === 1 ? 0 : bal * r; bal = (bal + pmt) * (1 + r); }
      else { interest = bal * r; bal = bal * (1 + r) + pmt; }
    }
    return -interest;
  },
  PPMT: (a, c) => { const pmt = FUNCS.PMT([a[0], a[2], a[3]].concat(a.length > 4 ? [a[4]] : []).concat(a.length > 5 ? [a[5]] : []), c); if (isErr(pmt)) return pmt; const ip = FUNCS.IPMT(a, c); if (isErr(ip)) return ip; return pmt - ip; },

  /* --- dates --- */
  DATEVALUE: (a, c) => { const v = evalNode(a[0], c); if (isErr(v)) return v; if (typeof v === 'number') return E_VAL(); const d = parseDateStr(toStr(v)); return d != null ? d : E_VAL(); },
  TIMEVALUE: (a, c) => { const t = timeArg(a[0], c); return t; },
  DAYS360: (a, c) => { const s = dateArg(a[0], c), e = dateArg(a[1], c); if (isErr(s) || isErr(e)) return isErr(s) ? s : e; const eu = a.length > 2 ? toBool(evalNode(a[2], c)) : false; const ds = serialToDate(Math.floor(s)), de = serialToDate(Math.floor(e)); let d1 = ds.getUTCDate(), d2 = de.getUTCDate(); if (eu) { d1 = Math.min(d1, 30); d2 = Math.min(d2, 30); } else { const ld1 = new Date(Date.UTC(ds.getUTCFullYear(), ds.getUTCMonth() + 1, 0)).getUTCDate(); if (d1 === ld1) d1 = 30; const ld2 = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth() + 1, 0)).getUTCDate(); if (d2 === ld2 && d1 === 30) d2 = 30; } return (de.getUTCFullYear() - ds.getUTCFullYear()) * 360 + (de.getUTCMonth() - ds.getUTCMonth()) * 30 + (d2 - d1); },
  NETWORKDAYS: (a, c) => { const s = dateArg(a[0], c), e = dateArg(a[1], c); if (isErr(s) || isErr(e)) return isErr(s) ? s : e; const hol = a.length > 2 ? new Set(numsFrom([a[2]], c).filter(v => typeof v === 'number').map(Math.floor)) : new Set(); let d = Math.floor(s), end = Math.floor(e), dir = 1; if (d > end) { const t = d; d = end; end = t; dir = -1; } let n = 0; for (; d <= end; d++) { const wd = serialToDate(d).getUTCDay(); if (wd !== 0 && wd !== 6 && !hol.has(d)) n++; } return dir * n; },
  'NETWORKDAYS.INTL': (a, c) => FUNCS.NETWORKDAYS(a, c),
  WORKDAY: (a, c) => { const s = dateArg(a[0], c); if (isErr(s)) return s; let n = needNum(evalNode(a[1], c)); if (isErr(n)) return n; const hol = a.length > 2 ? new Set(numsFrom([a[2]], c).filter(v => typeof v === 'number').map(Math.floor)) : new Set(); let d = Math.floor(s), step = n >= 0 ? 1 : -1; n = Math.abs(Math.trunc(n)); while (n > 0) { d += step; const wd = serialToDate(d).getUTCDay(); if (wd !== 0 && wd !== 6 && !hol.has(d)) n--; } return d; },
  YEARFRAC: (a, c) => { const s = dateArg(a[0], c), e = dateArg(a[1], c); if (isErr(s) || isErr(e)) return isErr(s) ? s : e; const basis = a.length > 2 ? Math.trunc(needNum(evalNode(a[2], c))) : 0; const S = Math.floor(s), E = Math.floor(e); if (basis === 0) return FUNCS.DAYS360([a[0], a[1]], c) / 360; if (basis === 2) return (E - S) / 360; if (basis === 3) return (E - S) / 365; if (basis === 4) return FUNCS.DAYS360([a[0], a[1], { k: 'bool', v: true }], c) / 360; if (basis === 1) { const d1 = serialToDate(S), d2 = serialToDate(E); let den; if (d1.getUTCFullYear() === d2.getUTCFullYear()) { den = isLeap(d1.getUTCFullYear()) ? 366 : 365; } else { let sd = S, tot = 0, cnt = 0; while (sd < E) { const y = serialToDate(sd).getUTCFullYear(); tot += isLeap(y) ? 366 : 365; cnt++; sd = dateToSerial(new Date(Date.UTC(y + 1, 0, 1))); } den = tot / (cnt || 1); } return (E - S) / (den || 365); } return E_NUM(); },
  DATEDIF: (a, c) => { let s = dateArg(a[0], c), e = dateArg(a[1], c); if (isErr(s) || isErr(e)) return isErr(s) ? s : e; s = Math.floor(s); e = Math.floor(e); if (e < s) return E_NUM(); const u = toStr(evalNode(a[2], c)).toUpperCase(); if (u === 'D') return e - s; const d1 = serialToDate(s), d2 = serialToDate(e); let months = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth()); if (d2.getUTCDate() < d1.getUTCDate()) months--; if (u === 'M') return months; if (u === 'YM') return ((months % 12) + 12) % 12; if (u === 'Y') return Math.trunc(months / 12); if (u === 'MD') { let d = d2.getUTCDate() - d1.getUTCDate(); if (d < 0) { const prev = new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), 0)); d += prev.getUTCDate(); } return d; } if (u === 'YD') { let anchor = dateToSerial(new Date(Date.UTC(d2.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate()))); if (anchor > e) anchor = dateToSerial(new Date(Date.UTC(d2.getUTCFullYear() - 1, d1.getUTCMonth(), d1.getUTCDate()))); return e - anchor; } return E_NUM(); },
  WEEKNUM: (a, c) => { const s = dateArg(a[0], c); if (isErr(s)) return s; const rt = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; const d = serialToDate(Math.floor(s)); const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); if (rt === 1) { return Math.floor((Math.floor(s) - dateToSerial(jan1) + jan1.getUTCDay()) / 7) + 1; } if (rt === 2) { const wd = (jan1.getUTCDay() + 6) % 7; return Math.floor((Math.floor(s) - dateToSerial(jan1) + wd) / 7) + 1; } if (rt === 21) return FUNCS.ISOWEEKNUM([a[0]], c); return E_NUM(); },
  ISOWEEKNUM: (a, c) => { const s = dateArg(a[0], c); if (isErr(s)) return s; const d = serialToDate(Math.floor(s)); const day = (d.getUTCDay() + 6) % 7; const thu = new Date(d.getTime()); thu.setUTCDate(d.getUTCDate() - day + 3); const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4)); const fday = (firstThu.getUTCDay() + 6) % 7; firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3); return 1 + Math.round((thu - firstThu) / (7 * DAYMS)); },

  /* --- text extras --- */
  CLEAN: (a, c) => { const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; return s.replace(/[\x00-\x1F]/g, ''); },
  FIXED: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; const dp = a.length > 1 ? Math.max(-127, Math.min(127, Math.trunc(needNum(evalNode(a[1], c))))) : 2; const nocom = a.length > 2 ? toBool(evalNode(a[2], c)) : false; if (Math.abs(dp) > 20) return E_VAL(); let s = x.toFixed(dp); if (!nocom) { const neg = s.startsWith('-'); s = s.replace(/^-/, ''); let parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = (neg ? '-' : '') + parts.join('.'); } return s; },
  DOLLAR: (a, c) => { const x = needNum(arg1(a, c)); if (isErr(x)) return x; const dp = a.length > 1 ? Math.trunc(needNum(evalNode(a[1], c))) : 2; const neg = x < 0; let s = Math.abs(x).toFixed(dp); let parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = parts.join('.'); return neg ? '($' + s + ')' : '$' + s; },
  NUMBERVALUE: (a, c) => { const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; const n = toNum(s); return isErr(n) ? E_VAL() : n; },
  TEXTBEFORE: (a, c) => { const s = toStr(evalNode(a[0], c)), d = toStr(evalNode(a[1], c)); if (isErr(s) || isErr(d)) return E_VAL(); if (d === '') return E_NA(); let inst = a.length > 2 ? Math.trunc(needNum(evalNode(a[2], c))) : 1; if (!inst) return E_NUM(); const parts = s.split(d); if (parts.length === 1) return E_NA(); const k = inst > 0 ? inst : parts.length + inst; if (k < 1 || k > parts.length - 1) return E_NA(); return parts.slice(0, k).join(d); },
  TEXTAFTER: (a, c) => { const s = toStr(evalNode(a[0], c)), d = toStr(evalNode(a[1], c)); if (isErr(s) || isErr(d)) return E_VAL(); if (d === '') return E_NA(); let inst = a.length > 2 ? Math.trunc(needNum(evalNode(a[2], c))) : 1; if (!inst) return E_NUM(); const parts = s.split(d); if (parts.length === 1) return E_NA(); const k = inst > 0 ? inst : parts.length + inst; if (k < 1 || k >= parts.length) return E_NA(); return parts.slice(k).join(d); },

  /* --- logic extras --- */
  IFS: (a, c) => { for (let i = 0; i + 1 < a.length; i += 2) { const cond = toBool(evalNode(a[i], c)); if (isErr(cond)) return cond; if (cond) return evalNode(a[i + 1], c); } return E_NA(); },
  SWITCH: (a, c) => { const v = evalNode(a[0], c); if (isErr(v)) return v; const pairs = a.length - 1; const hasDef = pairs % 2 === 1; const lim = hasDef ? a.length - 1 : a.length; for (let i = 1; i < lim; i += 2) { const m = evalNode(a[i], c); if (compare(v, m, '=')) return evalNode(a[i + 1], c); } return hasDef ? evalNode(a[a.length - 1], c) : E_NA(); },

  /* --- lookup extras --- */
  LOOKUP: (a, c) => { const lk = evalNode(a[0], c); if (isErr(lk)) return lk; const first = evalNode(a[1], c); if (!Array.isArray(first)) return E_NA(); const lflat = colOf(first); const res = a.length > 2 ? colOf(evalNode(a[2], c)) : ((first.__rows && first.length > 1 && Array.isArray(first[0])) ? first.map(r => r[r.length - 1]) : first.flat()); let best = -1; for (let i = 0; i < lflat.length; i++) { const v = lflat[i]; if (v == null) continue; if (compare(v, lk, '<=') === true) best = i; } if (best === -1) return E_NA(); return res[Math.min(best, res.length - 1)]; },
  XLOOKUP: (a, c) => {
    const lk = evalNode(a[0], c); if (isErr(lk)) return lk;
    const L = evalNode(a[1], c), R = evalNode(a[2], c);
    if (!Array.isArray(L)) return E_VAL();
    const lflat = colOf(L);
    const rflat = colOf(R);
    const cellAt = i => { let rv = rflat.length >= lflat.length ? rflat[i] : rflat[Math.min(i, rflat.length - 1)]; if (Array.isArray(rv)) rv = rv.flat()[0]; return rv === undefined ? undefined : (rv == null ? 0 : rv); };
    const notFound = a.length > 3 ? evalNode(a[3], c) : E_NA();
    const mode = a.length > 4 ? toNum(evalNode(a[4], c)) : 0;
    const searchMode = a.length > 5 ? toNum(evalNode(a[5], c)) : 1;
    if (isErr(mode) || isErr(searchMode)) return E_VAL();
    const idxs = lflat.map((_, i) => i);
    if (searchMode === -1) idxs.reverse();
    if (mode === 0 || mode === 2) {
      for (const i of idxs) {
        const v = lflat[i];
        let ok = false;
        if (mode === 0) ok = v === lk || (typeof v === 'string' && typeof lk === 'string' && v.toLowerCase() === lk.toLowerCase());
        else if (typeof lk === 'string' && typeof v === 'string') { try { ok = mkCriteria(lk)(v); } catch (e) { ok = false; } }
        if (ok) { const got = cellAt(i); return got === undefined ? notFound : got; }
      }
      return notFound;
    }
    if (mode === -1 || mode === 1) { // exact-or-next-smaller / -larger
      let exact = -1, best = -1;
      for (const i of idxs) {
        const v = lflat[i];
        if (v === lk || (typeof v === 'string' && typeof lk === 'string' && v.toLowerCase() === lk.toLowerCase())) { exact = i; break; }
        if (typeof v !== 'number' || typeof lk !== 'number') continue;
        if (mode === -1 ? v <= lk : v >= lk) { if (best === -1 || (mode === -1 ? lflat[i] > lflat[best] : lflat[i] < lflat[best])) best = i; }
      }
      const pick = exact !== -1 ? exact : best;
      if (pick === -1) return notFound;
      const got = cellAt(pick); return got === undefined ? notFound : got;
    }
    return E_VAL();
  },
  XMATCH: (a, c) => {
    const lk = evalNode(a[0], c); if (isErr(lk)) return lk;
    const L = evalNode(a[1], c); if (!Array.isArray(L)) return E_NA();
    const lflat = colOf(L);
    const mode = a.length > 2 ? needNum(evalNode(a[2], c)) : 0;
    const searchMode = a.length > 3 ? needNum(evalNode(a[3], c)) : 1;
    const idxs = lflat.map((_, i) => i); if (searchMode === -1) idxs.reverse();
    for (const i of idxs) {
      const v = lflat[i];
      if (mode === 0 && (v === lk || (typeof v === 'string' && typeof lk === 'string' && v.toLowerCase() === lk.toLowerCase()))) return i + 1;
      if (mode === 2 && typeof lk === 'string' && typeof v === 'string' && mkCriteria(lk)(v)) return i + 1;
    }
    if (mode === -1 || mode === 1) { let best = -1; for (const i of idxs) { const v = lflat[i]; if (typeof v !== 'number' || typeof lk !== 'number') continue; if (mode === -1 ? v <= lk : v >= lk) { if (best === -1 || (mode === -1 ? lflat[i] >= lflat[best] : lflat[i] <= lflat[best])) best = i; } } if (best !== -1) return best + 1; }
    return E_NA();
  },
  INDIRECT: (a, c) => {
    const s = toStr(evalNode(a[0], c)); if (isErr(s)) return s; if (a.length > 1) { const a1 = toBool(evalNode(a[1], c)); if (a1 === false) return E_REF(); }
    const m = s.trim().match(/^(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_. ]*))!(.+)$/) || null;
    let sheet = null, ref = s.trim();
    if (m) { sheet = m[1] || m[2]; ref = m[3].trim(); }
    const rg = ref.match(/^(.+):(.+)$/);
    if (rg) { const ra = parseRef(rg[1].trim()), rb = parseRef(rg[2].trim()); if (!ra || !rb) return E_REF(); return c.range(ra, rb, sheet) || []; }
    const r = parseRef(ref);
    if (r && !r.colOnly && !r.rowOnly) { const v = c.get(r, sheet); return v === undefined ? null : v; }
    if (c.getName) { const v = c.getName(r ? refToStr(r) : ref.toUpperCase(), sheet); if (v !== undefined) return v; }
    return E_REF();
  },
  OFFSET: (a, c) => {
    const anchor = a[0];
    if (!anchor || (anchor.k !== 'ref' && anchor.k !== 'rng')) return E_REF();
    const base = anchor.k === 'ref' ? anchor.ref : anchor.a;
    if (base.colOnly || base.rowOnly) return E_REF();
    const dr = toNum(evalNode(a[1], c)), dc = toNum(evalNode(a[2], c));
    if (isErr(dr) || isErr(dc)) return isErr(dr) ? dr : dc;
    let h = a.length > 3 ? toNum(evalNode(a[3], c)) : (anchor.k === 'rng' && anchor.b.r != null ? Math.abs(anchor.b.r - anchor.a.r) + 1 : 1);
    let w = a.length > 4 ? toNum(evalNode(a[4], c)) : (anchor.k === 'rng' && anchor.b.c != null ? Math.abs(anchor.b.c - anchor.a.c) + 1 : 1);
    if (isErr(h) || isErr(w)) return E_VAL();
    h = Math.trunc(h); w = Math.trunc(w);
    if (h === 0 || w === 0) return E_REF();
    const r1 = base.r + Math.trunc(dr), c1 = base.c + Math.trunc(dc);
    const r2 = h > 0 ? r1 + h - 1 : r1 + h + 1, cc2 = w > 0 ? c1 + w - 1 : c1 + w + 1;
    const ra = Math.min(r1, r2), rb = Math.max(r1, r2), ca = Math.min(c1, cc2), cb = Math.max(c1, cc2);
    if (ra < 0 || rb >= MAXR || ca < 0 || cb > MAXC) return E_REF();
    const sh = anchor.sheet || (anchor.k === 'rng' ? anchor.sheet : null);
    if (ra === rb && ca === cb) { const v = c.get({ c: ca, r: ra }, sh); return v === undefined ? null : v; }
    return c.range({ c: ca, r: ra }, { c: cb, r: rb }, sh) || [];
  },
  FORMULATEXT: (a, c) => { const nd = a[0]; if (nd && nd.k === 'ref' && c.getFormula) { const f = c.getFormula(nd.ref, nd.sheet); return f == null ? E_NA() : f; } return E_NA(); },

  /* --- info extras --- */
  TYPE: (a, c) => { const v = evalNode(a[0], c); if (Array.isArray(v)) return 64; if (isErr(v)) return 16; if (typeof v === 'number') return 1; if (typeof v === 'string') return 2; if (typeof v === 'boolean') return 4; return 1; },
  N: (a, c) => { const v = evalNode(a[0], c); if (isErr(v)) return v; if (typeof v === 'number') return v; if (v === true) return 1; return 0; },
  'ERROR.TYPE': (a, c) => { const v = evalNode(a[0], c); if (!isErr(v)) return E_NA(); const map = { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME?': 5, '#NUM!': 6, '#N/A': 7 }; return map[v.__err] || E_NA(); },
  ISFORMULA: (a, c) => { const nd = a[0]; if (nd && nd.k === 'ref' && c.isFormula) return !!c.isFormula(nd.ref, nd.sheet); return false; },
};
function lookupImpl(a, c, horiz) {
  const lk = evalNode(a[0], c); if (isErr(lk)) return lk;
  const tbl = evalNode(a[1], c); if (!Array.isArray(tbl)) return E_NA();
  const rows = tbl.__rows ? tbl : [tbl];
  const idx = needNum(evalNode(a[2], c)); if (isErr(idx)) return idx; if (idx < 1) return E_VAL();
  const approx = a.length > 3 ? toBool(evalNode(a[3], c)) : true;
  if (isErr(approx)) return approx;
  const line = horiz ? (rows[0] || []) : rows.map(r => r[0]);
  if (approx) {
    if (horiz) {
      let best = -1;
      for (let i = 0; i < line.length; i++) { const v = line[i]; if (typeof v === 'number' && typeof lk === 'number' && v <= lk) best = i; }
      if (best === -1) return E_NA();
      return (rows[Math.trunc(idx) - 1] || [])[best] !== undefined ? rows[Math.trunc(idx) - 1][best] : E_REF();
    }
    let best = -1;
    for (let i = 0; i < line.length; i++) { const v = line[i]; if (typeof v === 'number' && typeof lk === 'number' && v <= lk) best = i; }
    if (best === -1) return E_NA();
    const rr = rows[best] || [];
    return rr[Math.trunc(idx) - 1] !== undefined ? rr[Math.trunc(idx) - 1] : E_REF();
  }
  const matchRow = horiz ? -1 : (() => { for (let i = 0; i < rows.length; i++) { const v = (rows[i] || [])[0]; if (v === lk || (typeof v === 'string' && typeof lk === 'string' && v.toLowerCase() === lk.toLowerCase())) return i; } return -1; })();
  if (horiz) {
    for (let i = 0; i < line.length; i++) { const v = line[i]; if (v === lk || (typeof v === 'string' && typeof lk === 'string' && v.toLowerCase() === lk.toLowerCase())) { const rr = rows[Math.trunc(idx) - 1]; if (!rr) return E_REF(); return rr[i] !== undefined ? rr[i] : E_REF(); } }
    return E_NA();
  }
  const rr = matchRow === -1 ? null : rows[matchRow];
  if (!rr) return E_NA();
  return rr[Math.trunc(idx) - 1] !== undefined ? rr[Math.trunc(idx) - 1] : E_REF();
}
function concatAll(a, c) {
  let s = '';
  for (const arg of a) {
    const v = evalNode(arg, c);
    for (const x of (Array.isArray(v) ? v.flat() : [v])) {
      const t = toStr(x); if (isErr(t)) return t;
      s += t;
    }
  }
  return s;
}
function parseDateStr(s) {
  if (typeof s !== 'string') return null;
  const iso = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) { const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])); if (d.getUTCMonth() === +iso[2] - 1 && +iso[2] >= 1 && +iso[3] >= 1) return dateToSerial(d); return null; }
  const m = s.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(Date.UTC(y, +m[1] - 1, +m[2])); if (d.getUTCMonth() === +m[1] - 1) return dateToSerial(d); }
  return null;
}
function dateArg(node, c) {
  const v = evalNode(node, c);
  if (isErr(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const d = parseDateStr(v); if (d != null) return d; const n = toNum(v); if (!isErr(n)) return n; }
  return E_VAL();
}
function timeArg(node, c) {
  const v = evalNode(node, c);
  if (isErr(v)) return v;
  if (typeof v === 'number') return fracOf(v) < 0 ? fracOf(v) + 1 : fracOf(v);
  if (typeof v === 'string') { const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i); if (m) { let h = +m[1]; if (m[4]) { if (m[4].toUpperCase() === 'PM' && h < 12) h += 12; if (m[4].toUpperCase() === 'AM' && h === 12) h = 0; } return (h * 3600 + +m[2] * 60 + (+m[3] || 0)) / 86400; } }
  return E_VAL();
}

/* ---------------- general number -> string ---------------- */
function numToGeneral(v) {
  if (typeof v !== 'number') return String(v);
  if (!isFinite(v)) return ERR('#NUM!').__err;
  if (v === 0) return '0';
  const av = Math.abs(v);
  let s;
  if (av >= 1e11 || av < 1e-9) {
    s = v.toExponential(9).replace(/(\.\d*?)0+e/, '$1e').replace(/\.e/, 'e');
    s = s.replace(/^(-?\d+)(e)/i, '$1.00$2').replace(/^(-?\d+\.\d)(e)/i, '$10$2');
  } else {
    s = String(v);
    /* Excel parity: General keeps up to 15 SIGNIFICANT digits (Excel's storage
       precision); the renderer decides about width (decimals trimmed / ###).
       The old 10-digit cap truncated real user data, e.g. 7.1092381093812. */
    const sig = s.replace(/[eE].*$/, '').replace(/[^0-9]/g, '').replace(/^0+/, '').length;
    if (sig > 15) s = String(Number(v.toPrecision(15)));
  }
  s = s.replace('e+', 'E+').replace('e-', 'E-');
  if (/E\+(\d)$/.test(s)) s = s.replace(/E\+(\d)$/, 'E+0$1');
  if (/E-(\d)$/.test(s)) s = s.replace(/E-(\d)$/, 'E-0$1');
  return s;
}

/* ---------------- number format rendering ----------------
   Supports sections pos[;neg;zero[;text]], placeholders 0 # ? , . % E+ e+
   yy yyyy m mm mmm mmmm d dd h hh s ss AM/PM, [Red] color hint,
   "quoted" literals, _x spaces, \x escapes, [>=...] conditions. */
function fmt(v, fmtCode) {
  if (fmtCode == null || fmtCode === '' || fmtCode.toLowerCase() === 'general') {
    if (typeof v === 'boolean') return { text: v ? 'TRUE' : 'FALSE', color: null };
    if (typeof v === 'string') return { text: v, color: null };
    if (isErr(v)) return { text: v.__err, color: '#C00000' };
    return { text: numToGeneral(v), color: null };
  }
  if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
  if (isErr(v)) return { text: v.__err, color: '#C00000' };
  const sections = String(fmtCode).split(';');
  let sec, color = null;
  if (typeof v !== 'number') {
    // text value
    sec = sections.length >= 4 ? sections[3] : null;
    if (sec === null) return { text: String(v), color: null };
    const tm = sec.match(/\[([A-Za-z]+)\]/); if (tm) color = mkColor(tm[1]);
    if (sec.includes('@')) return { text: sec.replace(/\[.*?\]/g, '').replace(/@/g, String(v)).replace(/"([^"]*)"/g, '$1'), color };
    return { text: String(v), color };
  }
  // numeric: pick section
  if (sections.length === 1) sec = sections[0];
  else if (sections.length === 2) sec = v >= 0 ? sections[0] : sections[1];
  else sec = v > 0 ? sections[0] : v < 0 ? sections[1] : sections[2];
  if (sec === '') return { text: '', color: null };
  const cond = sec.match(/\[([<>=!]=?|>=|<=|<>)(-?[0-9.]+)\]/);
  if (cond) {
    const ok = compare(v, parseFloat(cond[2]), cond[1].replace('!', '<'));
    if (ok !== true) return fmt(v, sections.find((s, i) => i !== sections.indexOf(sec)) || 'General');
  }
  const cm = sec.match(/\[([A-Za-z]+)\]/);
  if (cm) { color = mkColor(cm[1]); sec = sec.replace(cm[0], ''); }
  const neg = v < 0;
  let x = Math.abs(v);
  const isDate = /(yy|mmmm|mmm|mm|dd|d\b|hh|ss|AM\/PM)/i.test(sec.replace(/"[^"]*"/g, '')) && !/[0#][.,]/.test(sec.replace(/m/g, '')) && /[ymdhHsS]/.test(sec) && (/\by+/.test(sec) || /\bh+/.test(sec) || (/\bd+/.test(sec)));
  // percents
  const pctCount = (sec.match(/%/g) || []).length;
  if (pctCount) x = x * 100 * (pctCount >= 1 ? 1 : 1);
  // scientific
  if (/[0#][.,0#]*E[+-][0#]+/i.test(sec)) {
    const mdp = sec.match(/[0#]\.([0#]+)E/i);
    const dp = mdp ? mdp[1].length : 2;
    let s = x.toExponential(dp);
    s = s.replace('e+', 'E+').replace('e-', 'E-');
    if (sec.includes('E+') || sec.includes('e+')) { s = s.replace(/E\+(\d)$/, 'E+0$1').replace(/E-(\d)$/, 'E-0$1'); }
    return { text: (neg && !/-/.test(sec) ? '-' : '') + s, color };
  }
  if (isDate && !pctCount) {
    return { text: renderDate(sec, x, neg), color };
  }
  // literal-only section (no numeric placeholder): emit literals as-is
  const bare = sec.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/_(.)/g, '');
  if (!/[0#?@]/.test(bare)) {
    let lit = sec.replace(/\[[^\]]*\]/g, '');
    lit = lit.replace(/"([^"]*)"/g, '$1').replace(/\\(.)/g, '$1').replace(/_(.)/g, ' ');
    return { text: lit, color };
  }
  // decimal places
  const dm = sec.match(/\.([0#?]+)/);
  const dp = dm ? dm[1].replace(/[?#]/g, '0').length : (sec.includes('.') ? 0 : (dm ? dm[1].length : 0));
  const dpShow = dm ? (m => { let n = 0; for (const ch of m) if (ch === '0') n++; return n; })(dm[1]) : 0;
  const dpOpt = dm ? dm[1].length - dpShow : 0;
  let num = x.toFixed(dm ? dm[1].length : 0);
  if (dpShow + dpOpt > 0 && dpOpt > 0) num = num.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const useComma = /,#|,0|,E/.test(sec) || sec.includes('#,##0') || sec.includes('0,000');
  if (useComma) {
    const parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    num = parts.join('.');
  }
  /* star-fill token: *X inside the pattern means "repeat X until the cell is
     full" — the renderer expands this private-use marker against the cell width */
  let starCh = null;
  if (/\*./.test(sec)) { starCh = sec.match(/\*(.)/)[1]; sec = sec.replace(/\*./, ''); }
  // minimum integer digits: '00000' zero-pads the integer part (Excel behavior)
  const im2 = sec.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').match(/([0?]+)(?=[.,%]|$)/);
  if (im2 && /^[0?]+$/.test(im2[1]) && !useComma) {
    const need = im2[1].length, parts2 = num.split('.');
    const padCh = /^0+$/.test(im2[1]) ? '0' : ' ';
    if (parts2[0].replace('-', '').length < need) parts2[0] = (parts2[0][0] === '-' ? '-' : '') + parts2[0].replace('-', '').padStart(need, padCh);
    num = parts2.join('.');
  }
  let prefix = tokensText(sec, 'before'), suffix = tokensText(sec, 'after');
  suffix = pctCount ? (suffix.includes('%') ? suffix : suffix + '%') : suffix;
  let out = prefix + num + (starCh !== null ? '\uE000' + starCh + '\uE001' : '') + suffix;
  if (neg && sections.length === 1) out = out.startsWith('-') ? out : '-' + out;
  return { text: out, color };
}
function tokensText(sec, side) {
  // literal text before/after the number part
  let s = sec.replace(/\[.*?\]/g, '');
  s = s.replace(/"([^"]*)"/g, (m, g) => '' + g + '');
  s = s.replace(/\\(.)/g, '$1');
  s = s.replace(/_(.)/g, ' ');
  const mnum = s.match(/[0#?,]+(?:\.[0#?]+)?(?:E[+-][0#]+)?/i);
  let pre = '', post = '';
  if (mnum) { pre = s.slice(0, mnum.index); post = s.slice(mnum.index + mnum[0].length); }
  const clean = t => t.replace(/[]/g, '').replace(/[,]+$/, '');
  return side === 'before' ? clean(pre) : clean(post);
}
function mkColor(c) {
  const map = { red: '#C00000', green: '#00B050', blue: '#0000FF', yellow: '#FFC000', black: '#000', white: '#fff', cyan: '#00B0F0', magenta: '#FF00FF' };
  return map[c.toLowerCase()] || null;
}
function renderDate(sec, serial, neg) {
  const yd = serialYMD(serial);
  const d = { getUTCFullYear: () => yd.y, getUTCMonth: () => yd.m - 1, getUTCDate: () => yd.d };
  const hh24 = (() => { const f = serial % 1; return Math.floor(f * 24 % 24); })();
  const mm2 = Math.floor((serial % 1) * 1440 % 60);
  const ss2 = Math.round((serial % 1) * 86400 % 60) % 60;
  const ampm = /AM\/PM/i.test(sec);
  let hh = hh24;
  if (ampm) { hh = hh24 % 12; if (hh === 0) hh = 12; }
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pad = (v, n) => String(v).padStart(n, '0');
  let out = '';
  let s = sec.replace(/"([^"]*)"/g, (m, g) => '' + g + '');
  const monthIsMinuteCtx = /h/i.test(s);
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '') { let j = i + 1; while (s[j] !== '' && j < s.length) j++; out += s.slice(i + 1, j); i = j + 1; continue; }
    const rest = s.slice(i);
    let m;
    if ((m = rest.match(/^AM\/PM/i))) { out += hh24 < 12 ? 'AM' : 'PM'; i += m[0].length; continue; }
    if ((m = rest.match(/^yyyy/i))) { out += d.getUTCFullYear(); i += 4; continue; }
    if ((m = rest.match(/^yy/i))) { out += pad(d.getUTCFullYear() % 100, 2); i += 2; continue; }
    if ((m = rest.match(/^mmmm/i))) { out += months[d.getUTCMonth()]; i += 4; continue; }
    if ((m = rest.match(/^mmm/i))) { out += months[d.getUTCMonth()].slice(0, 3); i += 3; continue; }
    if ((m = rest.match(/^mm/i))) { out += pad(monthIsMinuteContext(s, i) ? mm2 : d.getUTCMonth() + 1, 2); i += 2; continue; }
    if ((m = rest.match(/^m/i))) { out += monthIsMinuteContext(s, i) ? mm2 : d.getUTCMonth() + 1; i += 1; continue; }
    if ((m = rest.match(/^dd/i))) { out += pad(d.getUTCDate(), 2); i += 2; continue; }
    if ((m = rest.match(/^d/i))) { out += d.getUTCDate(); i += 1; continue; }
    if ((m = rest.match(/^hh/i))) { out += pad(hh, 2); i += 2; continue; }
    if ((m = rest.match(/^h/i))) { out += hh; i += 1; continue; }
    if ((m = rest.match(/^ss/i))) { out += pad(ss2, 2); i += 2; continue; }
    if ((m = rest.match(/^s/i))) { out += ss2; i += 1; continue; }
    out += ch; i++;
  }
  return (neg ? '-' : '') + out;
}
function monthIsMinuteContext(s, at) {
  const before = s.slice(0, at);
  if (/(h+\s*:?\s*)$/i.test(before.replace(/[^]*/g, ''))) return true;
  if (/^\s*:?\s*(s+)\b/i.test(s.slice(at))) return true;
  return false;
}

/* ==========================================================================
   Excel 2016 pro pack — exact semantics: AGGREGATE, SUBTOTAL, distributions,
   financials, engineering & unit conversion
   ========================================================================== */
function logFact(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
function erfAS(x) { // exact-to-double erf via regularized incomplete gamma: erf(x)=sgn(x)*P(x^2, 0.5)
  const sgn = x < 0 ? -1 : 1, ax = Math.abs(x);
  if (ax === 0) return 0;
  if (ax > 8) return sgn;           // |erf| = 1 to double precision beyond 8
  return sgn * gammaP(ax * ax, 0.5);
}
function lnGamma(z) { // Lanczos g=7
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < 9; i++) x += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function betaCf(x, a, b) { // regularized incomplete beta, continued fraction (Numerical Recipes)
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betaCont(x, a, b) / a;
  return 1 - bt * betaCont(1 - x, b, a) / b;
}
function betaCont(x, a, b) {
  const qab = a + b, qap = a + 1, qam = a - 1, MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function normCdf(z) { return 0.5 * (1 + erfAS(z / Math.SQRT2)); }
function tCdf(t, df) { const x = df / (df + t * t); const ib = betaCf(x, df / 2, 0.5); return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib; }
function chiCdf(x, k) { if (x <= 0) return 0; return gammaP(x / 2, k / 2); }
function gammaP(x, a) { // regularized lower incomplete gamma, series + CF
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 300; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 3e-14) break; }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}
function solveMonotone(f, lo, hi) { // bisection, f increasing
  let flo = f(lo), fhi = f(hi);
  if (flo > 0 || fhi < 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.abs(fm) < 1e-14) return mid;
    if (fm < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function normInvP(p) { // bisection on cdf (good to ~1e-12)
  const r = solveMonotone(z => normCdf(z) - p, -12, 12);
  return r == null ? (p <= 0 ? -Infinity : Infinity) : r;
}

function cumLoan(a, c, part) {
  const rate = needNum(evalNode(a[0], c)), nper = Math.trunc(needNum(evalNode(a[1], c))), pv = needNum(evalNode(a[2], c)),
    st = Math.trunc(needNum(evalNode(a[3], c))), en = Math.trunc(needNum(evalNode(a[4], c))), ty = Math.trunc(needNum(evalNode(a[5], c)));
  if (rate <= 0 || nper < 1 || st < 1 || en < st || en > nper) return E_NUM();
  const pmt = rate * pv / (1 - Math.pow(1 + rate, -nper));
  let bal = pv, tot = 0;
  for (let k = 1; k <= en; k++) {
    const ipmt = (ty === 1 && k === 1) ? 0 : bal * rate;
    const princ = pmt - ipmt;
    if (k >= st) tot += part === 'ipmt' ? ipmt : princ;
    bal -= princ;
  }
  return -tot;
}

Object.assign(FUNCS, {
  /* ---- the ifs/aggregate masters ---- */
  AGGREGATE: (a, c) => {
    const fn = Math.trunc(needNum(evalNode(a[0], c))), opts = Math.trunc(needNum(evalNode(a[1], c)));
    if (isErr(fn) || isErr(opts)) return E_VAL();
    if (fn < 1 || fn > 19 || opts < 0 || opts > 7) return E_VAL();
    const kNeed = fn >= 14; // LARGE..QUARTILE.EXC take k as last arg
    const refArgs = a.slice(2, kNeed ? a.length - 1 : undefined);
    const vals = numsFrom(refArgs, c, { ignoreErr: opts <= 3 || opts >= 6 });
    if (!kNeed && vals.err && !(opts <= 3 || opts >= 6)) return vals.err;
    const ns = Array.from(vals);
    if (vals.err && !isErr(vals.err) && vals.err.err) return vals.err.err;
    if (kNeed) {
      const k = needNum(evalNode(a[a.length - 1], c));
      if (isErr(k)) return k;
      const asc = [...ns].sort((x, y) => x - y);
      switch (fn) {
        case 14: { const kk = Math.trunc(k); if (kk < 1 || kk > asc.length) return E_NUM(); return asc[asc.length - kk]; }
        case 15: { const kk = Math.trunc(k); if (kk < 1 || kk > asc.length) return E_NUM(); return asc[kk - 1]; }
        case 16: return pctile(ns, k, true);                       // k is a 0..1 percentile — NOT truncated
        case 17: { const q = Math.trunc(k); if (q < 0 || q > 4) return E_NUM(); return pctile(ns, q * 0.25, true); }
        case 18: return pctile(ns, k, false);
        case 19: { const q = Math.trunc(k); if (q < 0 || q > 4) return E_NUM(); return pctile(ns, q * 0.25, false); }
      }
    }
    switch (fn) {
      case 1: return ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : E_DIV();
      case 2: return ns.length;
      case 3: { let n = 0; for (const x of iterArgs(refArgs, c)) if (x != null && x !== '') n++; return n; }
      case 4: return ns.length ? Math.max(...ns) : 0;
      case 5: return ns.length ? Math.min(...ns) : 0;
      case 6: return ns.reduce((x, y) => x * y, 1);
      case 7: { if (ns.length < 2) return E_DIV(); const m = ns.reduce((x, y) => x + y, 0) / ns.length; return Math.sqrt(ns.reduce((x, y) => x + (y - m) ** 2, 0) / (ns.length - 1)); }
      case 8: { if (!ns.length) return E_DIV(); const m = ns.reduce((x, y) => x + y, 0) / ns.length; return Math.sqrt(ns.reduce((x, y) => x + (y - m) ** 2, 0) / ns.length); }
      case 9: return ns.reduce((x, y) => x + y, 0);
      case 10: { if (ns.length < 2) return E_DIV(); const m = ns.reduce((x, y) => x + y, 0) / ns.length; return ns.reduce((x, y) => x + (y - m) ** 2, 0) / (ns.length - 1); }
      case 11: { if (!ns.length) return E_DIV(); const m = ns.reduce((x, y) => x + y, 0) / ns.length; return ns.reduce((x, y) => x + (y - m) ** 2, 0) / ns.length; }
      case 12: { const s2 = [...ns].sort((x, y) => x - y); const n = s2.length; if (!n) return E_DIV(); return n % 2 ? s2[(n - 1) / 2] : (s2[n / 2 - 1] + s2[n / 2]) / 2; }
      case 13: { const f = {}; let mx = 0, mode = null, ties = 0; for (const x of ns) { f[x] = (f[x] || 0) + 1; } for (const k2 in f) { if (f[k2] > mx) { mx = f[k2]; mode = +k2; ties = 0; } else if (f[k2] === mx) ties++; } return (mx <= 1 || ties > 0 && mode === null) ? E_NA() : (mx > 1 ? mode : E_NA()); }
    }
    return E_VAL();
  },
  SUBTOTAL: (a, c) => {
    let fn = needNum(evalNode(a[0], c)); if (isErr(fn)) return fn;
    fn = Math.trunc(fn); const manual = fn > 100; if (manual) fn -= 100;
    if (fn < 1 || fn > 11) return E_VAL();
    // hidden-row awareness when the host provides it
    const collect = [];
    outer: for (const nd of a.slice(1)) {
      if ((nd.k === 'ref' || nd.k === 'rng') && typeof c.isHiddenR === 'function') {
        const rc = refRect(nd);
        if (rc) {
          for (let r = rc.r1; r <= rc.r2; r++) for (let cc2 = rc.c1; cc2 <= rc.c2; cc2++) {
            if (manual && c.isHiddenR(r)) continue;
            const v = c.get({ r, c: cc2 });
            if (typeof v === 'number') collect.push(v);
          }
          continue outer;
        }
      }
      const v = evalNode(nd, c);
      if (Array.isArray(v)) for (const x of v.flat()) { if (typeof x === 'number') collect.push(x); }
      else if (typeof v === 'number') collect.push(v);
      else if (nd.k !== 'ref' && nd.k !== 'rng') { const n = toNum(v); if (typeof n === 'number') collect.push(n); }
    }
    switch (fn) {
      case 1: return collect.length ? collect.reduce((x, y) => x + y, 0) / collect.length : E_DIV();
      case 2: return collect.length;
      case 3: { let n = 0; for (const x of iterArgs(a.slice(1), c)) if (x != null && x !== '') n++; return n; }
      case 4: return collect.length ? Math.max(...collect) : 0;
      case 5: return collect.length ? Math.min(...collect) : 0;
      case 6: return collect.reduce((x, y) => x * y, 1);
      case 7: { if (collect.length < 2) return E_DIV(); const m = collect.reduce((x, y) => x + y, 0) / collect.length; return Math.sqrt(collect.reduce((x, y) => x + (y - m) ** 2, 0) / (collect.length - 1)); }
      case 8: { if (!collect.length) return E_DIV(); const m = collect.reduce((x, y) => x + y, 0) / collect.length; return Math.sqrt(collect.reduce((x, y) => x + (y - m) ** 2, 0) / collect.length); }
      case 9: return collect.reduce((x, y) => x + y, 0);
      case 10: { if (collect.length < 2) return E_DIV(); const m = collect.reduce((x, y) => x + y, 0) / collect.length; return collect.reduce((x, y) => x + (y - m) ** 2, 0) / (collect.length - 1); }
      case 11: { if (!collect.length) return E_DIV(); const m = collect.reduce((x, y) => x + y, 0) / collect.length; return collect.reduce((x, y) => x + (y - m) ** 2, 0) / collect.length; }
    }
    return E_VAL();
  },

  /* ---- distributions ---- */
  'NORM.DIST': (a, c) => { const x = needNum(evalNode(a[0], c)), m = needNum(evalNode(a[1], c)), sd = needNum(evalNode(a[2], c)), cum = toBool(evalNode(a[3], c)); if (isErr(x) || isErr(m) || isErr(sd)) return E_VAL(); if (sd <= 0) return E_NUM(); const z = (x - m) / sd; return cum ? normCdf(z) : Math.exp(-z * z / 2) / (sd * Math.sqrt(2 * Math.PI)); },
  NORMDIST: (a, c) => FUNCS['NORM.DIST'](a, c),
  'NORM.S.DIST': (a, c) => { const z = needNum(evalNode(a[0], c)), cum = toBool(evalNode(a[1], c)); if (isErr(z)) return E_VAL(); return cum ? normCdf(z) : Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI); },
  NORMSDIST: (a, c) => normCdf(needNum(evalNode(a[0], c))),
  'NORM.INV': (a, c) => { const p = needNum(evalNode(a[0], c)), m = needNum(evalNode(a[1], c)), sd = needNum(evalNode(a[2], c)); if ([p, m, sd].some(isErr)) return E_VAL(); if (p <= 0 || p >= 1 || sd <= 0) return E_NUM(); return m + sd * normInvP(p); },
  NORMINV: (a, c) => FUNCS['NORM.INV'](a, c),
  'NORM.S.INV': (a, c) => { const p = needNum(evalNode(a[0], c)); if (isErr(p)) return E_VAL(); if (p <= 0 || p >= 1) return E_NUM(); return normInvP(p); },
  NORMSINV: (a, c) => FUNCS['NORM.S.INV'](a, c),
  STANDARDIZE: (a, c) => { const x = needNum(evalNode(a[0], c)), m = needNum(evalNode(a[1], c)), sd = needNum(evalNode(a[2], c)); if (sd <= 0) return E_NUM(); return (x - m) / sd; },
  'BINOM.DIST': (a, c) => { const k = Math.trunc(needNum(evalNode(a[0], c))), n = Math.trunc(needNum(evalNode(a[1], c))), p = needNum(evalNode(a[2], c)), cum = toBool(evalNode(a[3], c)); if (p < 0 || p > 1 || k < 0 || n < 0) return E_NUM(); if (k > n) return 0; const pmf = i => Math.exp(logFact(n) - logFact(i) - logFact(n - i) + i * Math.log(p) + (n - i) * Math.log(1 - p)); if (!cum) return pmf(k); let s = 0; for (let i = 0; i <= k; i++) s += pmf(i); return Math.min(s, 1); },
  BINOMDIST: (a, c) => FUNCS['BINOM.DIST'](a, c),
  'POISSON.DIST': (a, c) => { const k = Math.trunc(needNum(evalNode(a[0], c))), l = needNum(evalNode(a[1], c)), cum = toBool(evalNode(a[2], c)); if (k < 0 || l <= 0) return E_NUM(); if (!cum) return Math.exp(k * Math.log(l) - l - logFact(k)); let s = 0; for (let i = 0; i <= k; i++) s += Math.exp(i * Math.log(l) - l - logFact(i)); return Math.min(s, 1); },
  POISSON: (a, c) => FUNCS['POISSON.DIST'](a, c),
  'EXPON.DIST': (a, c) => { const x = needNum(evalNode(a[0], c)), l = needNum(evalNode(a[1], c)), cum = toBool(evalNode(a[2], c)); if (x < 0 || l <= 0) return E_NUM(); return cum ? 1 - Math.exp(-l * x) : l * Math.exp(-l * x); },
  EXPONDIST: (a, c) => FUNCS['EXPON.DIST'](a, c),
  'CHISQ.DIST': (a, c) => { const x = needNum(evalNode(a[0], c)), k = needNum(evalNode(a[1], c)), cum = toBool(evalNode(a[2], c)); if (x < 0 || k < 1 || k > 1e10) return E_NUM(); if (!cum) return Math.exp(((k / 2) - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - lnGamma(k / 2)); return chiCdf(x, k); },
  'CHISQ.DIST.RT': (a, c) => { const x = needNum(evalNode(a[0], c)), k = needNum(evalNode(a[1], c)); if (x < 0 || k < 1) return E_NUM(); return 1 - chiCdf(x, k); },
  'CHISQ.INV': (a, c) => { const p = needNum(evalNode(a[0], c)), k = needNum(evalNode(a[1], c)); if (p < 0 || p > 1 || k < 1) return E_NUM(); return solveMonotone(x => chiCdf(x, k) - p, 0, Math.max(1e6, k + 40 * Math.sqrt(k))); },
  'T.DIST': (a, c) => { const x = needNum(evalNode(a[0], c)), df = Math.trunc(needNum(evalNode(a[1], c))), cum = toBool(evalNode(a[2], c)); if (df < 1) return E_NUM(); if (!cum) { const lg = lnGamma((df + 1) / 2) - lnGamma(df / 2); return Math.exp(lg) / Math.sqrt(df * Math.PI) * Math.pow(1 + x * x / df, -(df + 1) / 2); } return tCdf(x, df); },
  'T.DIST.2T': (a, c) => { const x = Math.abs(needNum(evalNode(a[0], c))), df = Math.trunc(needNum(evalNode(a[1], c))); if (df < 1) return E_NUM(); return 2 * (1 - tCdf(x, df)); },
  'T.DIST.RT': (a, c) => { const x = needNum(evalNode(a[0], c)), df = Math.trunc(needNum(evalNode(a[1], c))); if (df < 1) return E_NUM(); return 1 - tCdf(x, df); },
  TDIST: (a, c) => FUNCS['T.DIST.2T'](a, c),
  'T.INV': (a, c) => { const p = needNum(evalNode(a[0], c)), df = Math.trunc(needNum(evalNode(a[1], c))); if (p <= 0 || p >= 1 || df < 1) return E_NUM(); return solveMonotone(x => tCdf(x, df) - p, -1e6, 1e6); },
  'T.INV.2T': (a, c) => { const p = needNum(evalNode(a[0], c)), df = Math.trunc(needNum(evalNode(a[1], c))); if (p <= 0 || p > 1 || df < 1) return E_NUM(); const r = solveMonotone(x => (1 - tCdf(x, df)) - p / 2, 0, 1e6); return r == null ? E_NUM() : r; },
  TINV: (a, c) => FUNCS['T.INV.2T'](a, c),
  'F.DIST': (a, c) => { const x = needNum(evalNode(a[0], c)), d1 = Math.trunc(needNum(evalNode(a[1], c))), d2 = Math.trunc(needNum(evalNode(a[2], c))), cum = toBool(evalNode(a[3], c)); if (x < 0 || d1 < 1 || d2 < 1) return E_NUM(); const z = d1 * x / (d1 * x + d2); if (cum) return betaCf(z, d1 / 2, d2 / 2); const ln = lnGamma((d1 + d2) / 2) - lnGamma(d1 / 2) - lnGamma(d2 / 2); return Math.exp(ln) * Math.pow(d1 / d2, d1 / 2) * Math.pow(x, d1 / 2 - 1) * Math.pow(1 + d1 * x / d2, -(d1 + d2) / 2); },
  'F.DIST.RT': (a, c) => { const x = needNum(evalNode(a[0], c)), d1 = Math.trunc(needNum(evalNode(a[1], c))), d2 = Math.trunc(needNum(evalNode(a[2], c))); if (x < 0 || d1 < 1 || d2 < 1) return E_NUM(); return 1 - betaCf(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2); },
  'F.INV': (a, c) => { const p = needNum(evalNode(a[0], c)), d1 = Math.trunc(needNum(evalNode(a[1], c))), d2 = Math.trunc(needNum(evalNode(a[2], c))); if (p <= 0 || p >= 1 || d1 < 1 || d2 < 1) return E_NUM(); return solveMonotone(x => betaCf(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2) - p, 0, 1e10); },
  'F.INV.RT': (a, c) => { const p = needNum(evalNode(a[0], c)), d1 = Math.trunc(needNum(evalNode(a[1], c))), d2 = Math.trunc(needNum(evalNode(a[2], c))); if (p <= 0 || p >= 1 || d1 < 1 || d2 < 1) return E_NUM(); return solveMonotone(x => betaCf(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2) - (1 - p), 0, 1e10); },
  STEYX: (a, c) => { const p = twoArrays(a, c); if (isErr(p)) return p; const ys = p.xs, xs = p.ys; /* STEYX(known_ys, known_xs) — y's come FIRST */ const n = xs.length; if (n < 3) return E_DIV(); const mx = xs.reduce((x, y) => x + y, 0) / n, my = ys.reduce((x, y) => x + y, 0) / n; let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; } if (sxx === 0) return E_DIV(); return Math.sqrt((syy - sxy * sxy / sxx) / (n - 2)); },
  PROB: (a, c) => { const xs = Array.isArray(evalNode(a[0], c)) ? evalNode(a[0], c).flat() : [evalNode(a[0], c)]; const ps = Array.isArray(evalNode(a[1], c)) ? evalNode(a[1], c).flat() : [evalNode(a[1], c)]; const lo = needNum(evalNode(a[2], c)); if (xs.length !== ps.length) return E_NA(); const tv = ps.reduce((x, y) => x + (typeof y === 'number' ? y : 0), 0); if (Math.abs(tv - 1) > 1e-9) return E_NUM(); if (a.length < 4) { let s = 0; for (let i = 0; i < xs.length; i++) if (xs[i] === lo) s += ps[i]; return s; } const hi = needNum(evalNode(a[3], c)); let s = 0; for (let i = 0; i < xs.length; i++) if (typeof xs[i] === 'number' && xs[i] >= lo && xs[i] <= hi) s += ps[i]; return s; },

  /* ---- financials ---- */
  SLN: (a, c) => { const co = needNum(evalNode(a[0], c)), sv = needNum(evalNode(a[1], c)), lf = needNum(evalNode(a[2], c)); return (co - sv) / lf; },
  SYD: (a, c) => { const co = needNum(evalNode(a[0], c)), sv = needNum(evalNode(a[1], c)), lf = needNum(evalNode(a[2], c)), per = Math.trunc(needNum(evalNode(a[3], c))); return (co - sv) * (lf - per + 1) * 2 / (lf * (lf + 1)); },
  DB: (a, c) => { const co = needNum(evalNode(a[0], c)), sv = needNum(evalNode(a[1], c)), lf = Math.trunc(needNum(evalNode(a[2], c))), per = Math.trunc(needNum(evalNode(a[3], c))), mo = a.length > 4 ? needNum(evalNode(a[4], c)) : 12; if (co <= 0 || lf < 1 || per < 1) return E_NUM(); if (sv >= co) return 0; const rate = Math.round((1 - Math.pow(sv / co, 1 / lf)) * 1000) / 1000; let book = co, dep = 0; for (let p2 = 1; p2 <= Math.min(per, lf + 1); p2++) { if (p2 === 1) dep = co * rate * mo / 12; else if (p2 === lf + 1) dep = (book) * rate * (12 - mo) / 12; else dep = book * rate; if (p2 === lf + 1 && dep > book - sv) dep = book - sv; if (p2 > 1 && book - dep < sv) dep = book - sv; book -= dep; } return Math.max(dep, 0); },
  DDB: (a, c) => { const co = needNum(evalNode(a[0], c)), sv = needNum(evalNode(a[1], c)), lf = needNum(evalNode(a[2], c)), per = Math.trunc(needNum(evalNode(a[3], c))), f2 = a.length > 4 ? needNum(evalNode(a[4], c)) : 2; if (lf <= 0 || per < 1) return E_NUM(); let book = co, dep = 0; for (let p2 = 1; p2 <= per; p2++) { dep = Math.min(book * f2 / lf, Math.max(book - sv, 0)); book -= dep; } return dep; },
  VDB: (a, c) => {
    const co = needNum(evalNode(a[0], c)), sv = needNum(evalNode(a[1], c)), lf = needNum(evalNode(a[2], c));
    const st = needNum(evalNode(a[3], c)), en = needNum(evalNode(a[4], c)), f2 = a.length > 5 ? needNum(evalNode(a[5], c)) : 2;
    const noSw = a.length > 6 ? toBool(evalNode(a[6], c)) : false;
    if (lf <= 0 || en < st) return E_NUM();
    const L = Math.ceil(lf); let book = co;
    const deps = [0];
    for (let p2 = 1; p2 <= L; p2++) {
      const ddb = book * f2 / lf;
      let dep;
      if (noSw) dep = ddb;
      else { const sln = (book - sv) / (lf - p2 + 1); dep = ddb > sln ? ddb : sln; }
      dep = Math.min(dep, Math.max(book - sv, 0)); dep = Math.max(dep, 0);
      deps[p2] = dep; book -= dep;
    }
    let s = 0;
    for (let p2 = 1; p2 <= L; p2++) { const ov = Math.min(en, p2) - Math.max(st, p2 - 1); if (ov > 0) s += deps[p2] * ov; }
    return s;
  },
  MIRR: (a, c) => { const vs = (Array.isArray(evalNode(a[0], c)) ? evalNode(a[0], c).flat() : [evalNode(a[0], c)]); const fr = needNum(evalNode(a[1], c)), rr = needNum(evalNode(a[2], c)); const n = vs.length - 1; if (n < 1) return E_DIV(); let npvN = 0, npvP = 0; for (let i = 0; i <= n; i++) { const v = vs[i]; if (typeof v !== 'number') continue; if (v < 0) npvN += v / Math.pow(1 + fr, i); else npvP += v / Math.pow(1 + rr, i); } if (npvN === 0) return E_DIV(); return Math.pow(-npvP * Math.pow(1 + rr, n) / npvN, 1 / n) - 1; },
  XNPV: (a, c) => { const r = needNum(evalNode(a[0], c)); const vs = Array.isArray(evalNode(a[1], c)) ? evalNode(a[1], c).flat() : [evalNode(a[1], c)]; const dsRaw = evalNode(a[2], c); const ds = (Array.isArray(dsRaw) ? dsRaw.flat() : [dsRaw]).map(v => toNum(v)); if (vs.length !== ds.length || !vs.length) return E_VAL(); const d0 = ds[0]; let s = 0; for (let i = 0; i < vs.length; i++) { if (typeof vs[i] === 'number') s += vs[i] / Math.pow(1 + r, (ds[i] - d0) / 365); } return s; },
  XIRR: (a, c) => { const vs = Array.isArray(evalNode(a[0], c)) ? evalNode(a[0], c).flat() : [evalNode(a[0], c)]; const dsRaw = evalNode(a[1], c); const ds = (Array.isArray(dsRaw) ? dsRaw.flat() : [dsRaw]).map(v => toNum(v)); if (vs.length !== ds.length || vs.length < 2) return E_NUM(); if (!vs.some(v => v > 0) || !vs.some(v => v < 0)) return E_NUM(); let g = a.length > 2 ? needNum(evalNode(a[2], c)) : 0.1; const d0 = ds[0]; const f = r => { let s = 0; for (let i = 0; i < vs.length; i++) s += vs[i] / Math.pow(1 + r, (ds[i] - d0) / 365); return s; }; const fp = r => { let s = 0; for (let i = 0; i < vs.length; i++) { const t = (ds[i] - d0) / 365; s -= vs[i] * t / Math.pow(1 + r, t + 1); } return s; }; for (let i = 0; i < 100; i++) { const fv = f(g), dfv = fp(g); if (Math.abs(fv) < 1e-10) return g; if (dfv === 0) break; const ng = g - fv / dfv; if (ng <= -1) break; if (Math.abs(ng - g) < 1e-10) return ng; g = ng; } const rr = solveMonotone(f, -0.9999999, 10); return rr == null ? E_NUM() : rr; },
  CUMIPMT: (a, c) => cumLoan(a, c, 'ipmt'),
  CUMPRINC: (a, c) => cumLoan(a, c, 'ppmt'),
  PDURATION: (a, c) => { const r = needNum(evalNode(a[0], c)), pv = needNum(evalNode(a[1], c)), fv = needNum(evalNode(a[2], c)); if (r <= 0 || pv <= 0 || fv <= 0) return E_NUM(); return Math.log(fv / pv) / Math.log(1 + r); },
  RRI: (a, c) => { const n = needNum(evalNode(a[0], c)), pv = needNum(evalNode(a[1], c)), fv = needNum(evalNode(a[2], c)); if (n <= 0 || pv <= 0) return E_NUM(); if (fv < 0) return E_NUM(); return Math.pow(fv / pv, 1 / n) - 1; },
  EFFECT: (a, c) => { const nom = needNum(evalNode(a[0], c)), np = Math.trunc(needNum(evalNode(a[1], c))); if (nom <= 0 || np < 1) return E_NUM(); return Math.pow(1 + nom / np, np) - 1; },
  NOMINAL: (a, c) => { const eff = needNum(evalNode(a[0], c)), np = Math.trunc(needNum(evalNode(a[1], c))); if (eff <= 0 || np < 1) return E_NUM(); return np * (Math.pow(1 + eff, 1 / np) - 1); },
  FVSCHEDULE: (a, c) => { const pv = needNum(evalNode(a[0], c)); const sc = Array.isArray(evalNode(a[1], c)) ? evalNode(a[1], c).flat() : [evalNode(a[1], c)]; let v = pv; for (const x of sc) { const r = typeof x === 'number' ? x : 0; v *= (1 + r); } return v; },

  /* ---- engineering & misc ---- */
  DELTA: (a, c) => { const x = needNum(evalNode(a[0], c)); const y = a.length > 1 ? needNum(evalNode(a[1], c)) : 0; return x === y ? 1 : 0; },
  GESTEP: (a, c) => { const x = needNum(evalNode(a[0], c)); const y = a.length > 1 ? needNum(evalNode(a[1], c)) : 0; return x >= y ? 1 : 0; },
  ERF: (a, c) => { const x = needNum(evalNode(a[0], c)); if (a.length > 1) { const y = needNum(evalNode(a[1], c)); return erfAS(y) - erfAS(x); } return erfAS(x); },
  ERFC: (a, c) => 1 - erfAS(needNum(evalNode(a[0], c))),
  'ERF.PRECISE': (a, c) => erfAS(needNum(evalNode(a[0], c))),
  'ERFC.PRECISE': (a, c) => 1 - erfAS(needNum(evalNode(a[0], c))),
  BITAND: (a, c) => bitOp(a, c, (x, y) => x & y), BITOR: (a, c) => bitOp(a, c, (x, y) => x | y), BITXOR: (a, c) => bitOp(a, c, (x, y) => x ^ y),
  BITLSHIFT: (a, c) => bitOp(a, c, (x, y) => Math.abs(y) > 53 ? E_NUM() : x * Math.pow(2, y)),
  BITRSHIFT: (a, c) => bitOp(a, c, (x, y) => Math.abs(y) > 53 ? E_NUM() : Math.floor(x / Math.pow(2, y))),
  BASE: (a, c) => { const n = Math.trunc(needNum(evalNode(a[0], c))), r = Math.trunc(needNum(evalNode(a[1], c))); if (n < 0 || r < 2 || r > 36) return E_NUM(); let t = n.toString(r).toUpperCase(); if (a.length > 2) { const ml = Math.trunc(needNum(evalNode(a[2], c))); while (t.length < ml) t = '0' + t; } return t; },
  DECIMAL: (a, c) => { const t = toStr(evalNode(a[0], c)).trim().toUpperCase(), r = Math.trunc(needNum(evalNode(a[1], c))); if (r < 2 || r > 36) return E_NUM(); if (!/^[0-9A-Z]+$/.test(t)) return E_NUM(); let v = 0; for (const ch of t) { const d = parseInt(ch, 36); if (d >= r) return E_NUM(); v = v * r + d; } return v; },
  ARABIC: (a, c) => { const t = toStr(evalNode(a[0], c)).trim().toUpperCase(); if (t === '') return 0; const M = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let v = 0; for (let i = 0; i < t.length; i++) { const cur = M[t[i]], nxt = M[t[i + 1]] || 0; if (cur == null) return E_VAL(); v += cur < nxt ? -cur : cur; } return v < 0 || v > 3999 ? E_VAL() : v; },
  PERMUT: (a, c) => { const n = Math.trunc(needNum(evalNode(a[0], c))), k = Math.trunc(needNum(evalNode(a[1], c))); if (n < 0 || k < 0 || k > n) return E_NUM(); return Math.round(Math.exp(logFact(n) - logFact(n - k))); },
  PERMUTATIONA: (a, c) => { const n = Math.trunc(needNum(evalNode(a[0], c))), k = Math.trunc(needNum(evalNode(a[1], c))); if (n < 0 || k < 0) return E_NUM(); return Math.pow(n, k); },
  COMBINA: (a, c) => { const n = Math.trunc(needNum(evalNode(a[0], c))), k = Math.trunc(needNum(evalNode(a[1], c))); if (n < 0 || k < 0 || k > n) return E_NUM(); if (n === 0 && k === 0) return 1; return Math.round(Math.exp(logFact(n + k - 1) - logFact(k) - logFact(n - 1))); },
  MULTINOMIAL: (a, c) => { const ns = numsFrom(a, c); if (aggErr(ns)) return aggErr(ns); let sum = 0, den = 0; for (const x of ns) { const i = Math.trunc(x); if (i < 0) return E_NUM(); sum += i; den += logFact(i); } return Math.round(Math.exp(logFact(sum) - den)); },
  SERIESSUM: (a, c) => { const x = needNum(evalNode(a[0], c)), n = needNum(evalNode(a[1], c)), m = needNum(evalNode(a[2], c)); const cf = Array.isArray(evalNode(a[3], c)) ? evalNode(a[3], c).flat() : [evalNode(a[3], c)]; let s = 0; for (let i = 0; i < cf.length; i++) { const cv = typeof cf[i] === 'number' ? cf[i] : 0; s += cv * Math.pow(x, n + i * m); } return s; },
  'FLOOR.PRECISE': (a, c) => { const x = needNum(evalNode(a[0], c)), sg = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; if (sg === 0) return 0; const s2 = Math.abs(sg); return Math.floor(x / s2) * s2; },
  'ISO.CEILING': (a, c) => { const x = needNum(evalNode(a[0], c)), sg = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; if (sg === 0) return 0; const s2 = Math.abs(sg); return Math.ceil(x / s2) * s2; },
  'CEILING.PRECISE': (a, c) => { const x = needNum(evalNode(a[0], c)), sg = a.length > 1 ? needNum(evalNode(a[1], c)) : 1; if (sg === 0) return 0; const s2 = Math.abs(sg); return Math.ceil(x / s2) * s2; },
  DOLLARDE: (a, c) => { const f = needNum(evalNode(a[0], c)), base = Math.trunc(needNum(evalNode(a[1], c))); if (base < 1) return E_NUM(); const sign = f < 0 ? -1 : 1, af = Math.abs(f); const ip = Math.trunc(af); const dig = Math.max(1, Math.floor(Math.log10(base)) + 1); return sign * (ip + (af - ip) * Math.pow(10, dig) / base); },
  DOLLARFR: (a, c) => { const d2 = needNum(evalNode(a[0], c)), base = Math.trunc(needNum(evalNode(a[1], c))); if (base < 1) return E_NUM(); const sign = d2 < 0 ? -1 : 1, av = Math.abs(d2); const ip = Math.trunc(av); const dig = Math.max(1, Math.floor(Math.log10(base)) + 1); return sign * (ip + (av - ip) * base / Math.pow(10, dig)); },
  ISREF: (a) => !!(a[0] && (a[0].k === 'ref' || a[0].k === 'rng')),
  AREAS: (a) => (a[0] && (a[0].k === 'ref' || a[0].k === 'rng')) ? 1 : E_VAL(),
  SHEET: (a, c) => { if (a.length && a[0].k !== 'missing') { const v = evalNode(a[0], c); if (typeof v === 'string' && c.sheetIxByName) { const ix = c.sheetIxByName(v); return ix == null ? E_NA() : ix; } return E_NA(); } return c.sheetIx ? c.sheetIx() : 1; },
  SHEETS: (a, c) => c.sheetCount ? c.sheetCount() : 1,
  INFO: (a, c) => { const t = toStr(evalNode(a[0], c)).toLowerCase(); switch (t) { case 'directory': return '(this browser workbook)'; case 'numfile': return c.sheetCount ? c.sheetCount() : 1; case 'origin': return '$A$1'; case 'osversion': return 'Windows 10 (64-bit)'; case 'platform': return 'pcdos'; case 'recalc': return 'Automatic'; case 'release': return '16.0'; case 'system': return 'pcdos'; case 'totmem': case 'memavail': case 'memused': return E_NA(); } return E_NA(); },
  CELL: (a, c) => {
    const info = toStr(evalNode(a[0], c)).toLowerCase();
    let r = c.self ? c.self.r : 0, cc2 = c.self ? c.self.c : 0, useGet = true;
    if (a.length > 1 && !(a[1].k === 'missing')) { const rc = refRect(a[1]); if (!rc) return E_VAL(); r = rc.r1; cc2 = rc.c1; }
    const valAt = () => (typeof c.get === 'function' ? c.get({ r, c: cc2 }) : undefined);
    switch (info) {
      case 'address': return '$' + idxToCol(cc2) + '$' + (r + 1);
      case 'row': return r + 1;
      case 'col': return cc2 + 1;
      case 'type': { if (!useGet) return 'b'; const v = valAt(); return v == null || v === '' ? 'b' : (typeof v === 'string' ? 'l' : 'v'); }
      case 'contents': return useGet ? valAt() : undefined;
      case 'colwidth': { const w = c.colWidth ? c.colWidth(cc2) : 9; return [Math.round(w * 10) / 10, false]; }
      case 'format': return 'G';
      case 'filename': return '';
      case 'prefix': return '';
      case 'protect': return 0;
      case 'color': return 0;
      case 'parentheses': return 0;
    }
    return E_VAL();
  },
  CONVERT: (a, c) => {
    const n = needNum(evalNode(a[0], c));
    const from = String(toStr(evalNode(a[1], c))).trim(), to = String(toStr(evalNode(a[2], c))).trim();
    if (isErr(n)) return n;
    const r = convertUnit(n, from, to);
    return r == null ? E_NA() : r;
  },
});

/* exact percentile helper for AGGREGATE (inclusive/exclusive) */
function pctile(ns, k, inc) {
  const a2 = [...ns].sort((x, y) => x - y).filter(v => typeof v === 'number');
  const n = a2.length;
  if (!n) return E_NUM();
  if (inc) {
    if (k < 0 || k > 1) return E_NUM();
    const pos = 1 + (n - 1) * k, lo = Math.floor(pos), hi = Math.ceil(pos);
    return a2[lo - 1] + (pos - lo) * ((a2[hi - 1] !== undefined ? a2[hi - 1] : a2[lo - 1]) - a2[lo - 1]);
  }
  const pos = (n + 1) * k;
  if (pos < 1 || pos > n) return E_NUM();
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return a2[lo - 1] + (pos - lo) * ((a2[hi - 1] !== undefined ? a2[hi - 1] : a2[lo - 1]) - a2[lo - 1]);
}
function bitOp(a, c, f) {
  const x = needNum(evalNode(a[0], c)), y = needNum(evalNode(a[1], c));
  if (isErr(x) || isErr(y)) return E_NUM();
  if (x < 0 || y < 0 || x !== Math.trunc(x) || y !== Math.trunc(y)) return E_NUM();
  if (x >= Math.pow(2, 48) || y >= Math.pow(2, 48)) return E_NUM();
  const r = f(x, y);
  return isErr(r) ? r : r;
}

/* unit conversion (Excel 2016 unit set) */
function convertUnit(n, from, to) {
  // temperature special
  const tU = { C: 'C', F: 'F', K: 'K' };
  if (tU[from] && tU[to]) {
    let k = from === 'C' ? n + 273.15 : from === 'F' ? (n - 32) * 5 / 9 + 273.15 : n;
    return to === 'C' ? k - 273.15 : to === 'F' ? (k - 273.15) * 9 / 5 + 32 : k;
  }
  const baseOf = {
    // length (m)
    m: ['L', 1], mi: ['L', 1609.344], Nmi: ['L', 1852], in: ['L', 0.0254], ft: ['L', 0.3048], yd: ['L', 0.9144], ang: ['L', 1e-10], ell: ['L', 1.143], ly: ['L', 9.460528405e15], pica: ['L', 0.0254 / 6],
    // mass (kg)
    g: ['M', 0.001], sg: ['M', 14.5939029372], lbm: ['M', 0.45359237], u: ['M', 1.66053907e-27], ozm: ['M', 0.028349523125], grain: ['M', 6.479891e-5], cwt: ['M', 45.359237], shweight: ['M', 29.483534], ton: ['M', 907.18474], ukton: ['M', 1016.04691], ston: ['M', 6.3502932], hweight: ['M', 50.80234544], brtempo: null,
    // time (s)
    sec: ['T', 1], min: ['T', 60], hr: ['T', 3600], day: ['T', 86400], yr: ['T', 365.25 * 86400],
    // pressure (Pa)
    Pa: ['P', 1], atm: ['P', 101325], mmHg: ['P', 133.322387415], Torr: ['P', 133.322368421], psi: ['P', 6894.75729317],
    // energy (J)
    J: ['E', 1], e: ['E', 1e-7], c: ['E', 4.1868], cal: ['E', 4.1868], eV: ['E', 1.602176634e-19], ev: ['E', 1.602176634e-19], HPh: ['E', 2684519.537696173], Wh: ['E', 3600], wh: ['E', 3600], ftlb: ['E', 1.35581794833], BTU: ['E', 1055.05585262],
    // power (W)
    W: ['PW', 1], HP: ['PW', 745.699871582], PS: ['PW', 735.49875],
    // speed (m/s)
    mph: ['SP', 0.44704], 'km/h': ['SP', 1 / 3.6], kn: ['SP', 1852 / 3600], mknh: null, admkn: null,
    // volume (m^3)
    l: ['V', 1e-3], L: ['V', 1e-3], lt: ['V', 1e-3], ang3: null,
    tsp: ['V', 2.95735295625e-5 / 6], tbs: ['V', 2.95735295625e-5 / 2], oz: ['V', 2.95735295625e-5], cup: ['V', 2.365882365e-4], pt: ['V', 4.73176473e-4], us_pt: ['V', 4.73176473e-4], uk_pt: ['V', 5.6826125e-4], qt: ['V', 9.46352946e-4], uk_qt: ['V', 1.1365225e-3], gal: ['V', 3.785411784e-3], uk_gal: ['V', 4.54609e-3], barrel: ['V', 0.158987294928], bushel: ['V', 0.0352391], gilli: null, in3: ['V', 1.6387064e-5], ft3: ['V', 0.028316846592], yd3: ['V', 0.764554857984], mi3: ['V', 4168181825.4406], regton: ['V', 2.8316846592], MTON: ['V', 1.13267386368],
    // force (N)
    N: ['F', 1], dyn: ['F', 1e-5], dy: ['F', 1e-5], lbf: ['F', 4.4482216152605], pond: ['F', 0.00980665],
    // data (bits)
    bit: ['D', 1], byte: ['D', 8],
  };
  const metricBases = new Set(['m', 'g', 'sec', 'min', 'hr', 'day', 'yr', 'J', 'eV', 'W', 'Pa', 'N', 'l', 'L', 'bit', 'byte', 'Wh']);
  const PREF = { Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1, D: 1e1, d: 1e-1, c: 1e-2, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18 };
  const lookup = (u) => {
    if (baseOf[u]) return baseOf[u];
    // metric prefix (one or two letters: da / k / M / m / u ...)
    for (const plen of [2, 1]) {
      const pre = u.slice(0, plen), rest = u.slice(plen);
      if ((PREF[pre] != null) && metricBases.has(rest)) {
        const b = baseOf[rest];
        if (rest === 'byte') return [b[0], b[1] * PREF[pre]];
        if (rest === 'bit') return [b[0], b[1] * PREF[pre]];
        return [b[0], b[1] * PREF[pre]];
      }
      if (pre === 'µ' && metricBases.has(rest)) { const b = baseOf[rest]; return [b[0], b[1] * 1e-6]; }
    }
    return null;
  };
  const F = lookup(from), T = lookup(to);
  if (!F || !T || F[0] !== T[0]) return null;
  return n * F[1] / T[1];
}

/* ---------------- reference adjustment (copy / fill) ---------------- */
function adjustFormula(src, dC, dR) {
  const toks = tokenize(src[0] === '=' ? src.slice(1) : src);
  if (!toks) return src;
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === T_REF) {
      const r = parseRef(t.v);
      if (r) {
        if (!r.colOnly && !r.cAbs && r.c != null) r.c += dC;
        if (!r.rowOnly && !r.rAbs && r.r != null) r.r += dR;
        if (r.rowOnly && !r.rAbs) r.r += dR;
        if (r.colOnly && !r.cAbs) r.c += dC;
        if ((r.c != null && r.c < 0) || (r.c != null && r.c > MAXC) || (r.r != null && r.r < 0) || (r.r != null && r.r >= MAXR)) out += '#REF!';
        else out += refToStr(r);
        continue;
      }
      out += t.v; continue;
    }
    if (t.t === T_STR) { out += '"' + t.v.replace(/"/g, '""') + '"'; continue; }
    if (t.t === T_SHEET) { out += (/[^A-Za-z0-9_.]/.test(t.v) ? `'${t.v}'!` : t.v + '!'); continue; }
    if (t.t === T_NUM) { out += String(t.v); continue; }
    if (t.t === T_ID) { out += t.v; continue; }
    if (t.t === T_LP) { out += '('; continue; }
    if (t.t === T_RP) { out += ')'; continue; }
    if (t.t === T_COMMA) { out += t.row ? ';' : ','; continue; }
    if (t.t === '{' || t.t === '}') { out += t.t; continue; }
    out += t.v;
  }
  return '=' + out;
}

/* dependency scan: list refs/ranges used */
function refsOf(ast, out) {
  out = out || [];
  if (!ast || typeof ast !== 'object') return out;
  if (ast.k === 'ref') out.push({ a: ast.ref, b: null, sheet: ast.sheet });
  else if (ast.k === 'rng') out.push({ a: ast.a, b: ast.b, sheet: ast.sheet });
  for (const key of Object.keys(ast)) {
    const v = ast[key];
    if (Array.isArray(v)) v.forEach(x => refsOf(x, out));
    else if (v && typeof v === 'object' && v.k) refsOf(v, out);
  }
  return out;
}

/* whole-formula evaluator: a formula that IS one bare 3D reference (=Sheet1:S3!A1)
   collapses through SUM over the span (the only sane scalar meaning for a lone
   3D reference without a function context) */
function eval3D(ast, ctx) {
  if (ast && (ast.k === 'ref' || ast.k === 'rng') && typeof ast.sheet === 'string' && ast.sheet.indexOf(':') >= 0) {
    return evalNode({ k: 'call', fn: 'SUM', args: [ast] }, ctx);
  }
  return evalNode(ast, ctx);
}

const G = typeof window !== 'undefined' ? window : globalThis;
G.Calc = {
  parse, evalNode, eval3D, tokenize, adjustFormula, refsOf,
  colToIdx, idxToCol, parseRef, refToStr,
  isErr, toNum, toStr, toBool, compare, numToGeneral, fmt,
  dateToSerial, serialToDate, mkCriteria,
  FUNCS,
  E_DIV, E_VAL, E_REF, E_NAME, E_NA, E_NUM, ERR,
  MAXR, MAXC,
};
if (typeof module !== 'undefined' && module.exports) module.exports = window.Calc;
})();
