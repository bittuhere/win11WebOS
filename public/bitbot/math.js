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

/* ═══════════════════════════════════════════════════════════════════════════
   BitBot MATH ENGINE v9 — a REAL expression parser (no more regex hacks).
     • normalize: ÷ × − ² ³ √ π, lakh/crore/thousand words, Indian commas,
       word-operators ("plus", "divided by", "to the power of"…), prefixes
     • tokenize → parse (recursive descent, right-assoc ^, unary −, n!, √)
     • evaluate with guards (÷0, √negative, 170! overflow, Infinity)
     • STEP-BY-STEP simplification in true BODMAS order with reasons
   Runs in browser (window.BitMath) and Node (module.exports).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    var SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
    var BIG_WORDS = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, lac: 100000, lacs: 100000,
        crore: 10000000, crores: 10000000, million: 1000000, millions: 1000000, billion: 1000000000 };

    function normalize(raw) {
        var s = ' ' + String(raw == null ? '' : raw) + ' ';
        // unicode operators & symbols
        s = s.replace(/[÷∕⁄]/g, '/').replace(/[×✕✖∗]/g, '*').replace(/[−–—‐‑]/g, '-').replace(/√/g, ' sqrt ').replace(/∛/g, ' cbrt ');
        s = s.replace(/π/g, ' pi ');
        // superscript runs → ^(digits)   (handles ², ³, ¹⁰, ⁻² …)
        s = s.replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/g, function (m) {
            var d = '';
            for (var i = 0; i < m.length; i++) d += SUP[m[i]] || '';
            return d ? '^(' + d + ')' : '';
        });
        s = s.replace(/\^\s*-\s*/g, '^-');
        s = s.toLowerCase();
        // question prefixes / suffixes (chat noise around the expression)
        s = s.replace(/\b(simplify and explain|simplify|evaluate|calculate|compute|solve|what is|what's|whats|how much is|tell me|answer of|answer|find|kitna hota hai|kitna hai|kitna|batao|please|pls)\b/g, ' ');
        // "solve for x: …", "find the value of y …" — drop the ask, keep the math
        s = s.replace(/\b(?:for|the)\s+value\s+of\s+([a-z])\b/g, ' ');
        s = s.replace(/\bfor\s+([a-z])\s*[:\-]?\s*/g, ' ');
        s = s.replace(/\bexpand\b|\bfactorise\b|\bfactorize\b/g, ' ');
        s = s.replace(/(\d)\s*!/g, '$1§');              // protect factorials…
        s = s.replace(/[:?!।]+/g, ' ');                // …from the punctuation wipe
        s = s.replace(/§/g, ' ! ');
        // word operators (longest first so "divided by" beats "by")
        s = s.replace(/\bdivided by\b|\bdivide by\b/g, ' / ');
        s = s.replace(/\bmultiplied by\b|\bmultiplied with\b|\btimes\b|\binto\b/g, ' * ');
        s = s.replace(/\bplus\b|\badded to\b|\badd\b/g, ' + ');
        s = s.replace(/\bminus\b|\bsubtract\b|\bleda\b/g, ' - ');
        s = s.replace(/\bto the power of\b|\braised to the power of\b|\braised to\b|\bpower of\b|\bto the power\b/g, ' ^ ');
        s = s.replace(/\bsquare root of\b|\bsquare root\b|\bsqrt\b|\broot of\b/g, ' sqrt ');
        s = s.replace(/\bcube root of\b|\bcube root\b|\bcbrt\b/g, ' cbrt ');
        s = s.replace(/\bsquare of\s*(\d+(?:\.\d+)?)/g, '($1)^2').replace(/\bcube of\s*(\d+(?:\.\d+)?)/g, '($1)^3');
        s = s.replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3');
        s = s.replace(/\bmodulo\b|\bmod\b/g, ' % ');
        s = s.replace(/(\d+(?:\.\d+)?)\s*(percent|%)\s*of/g, '$1 / 100 *');
        s = s.replace(/\bfactorial of\s*(\d+(?:\.\d+)?)/g, '$1 !');
        // big-number words: "5 lakh" → 5*100000
        s = s.replace(/(\d+(?:\.\d+)?)\s*(hundred|thousand|lakhs?|lacs?|crores?|millions?|billion)\b/g, function (m, n, w) {
            return n + '*' + BIG_WORDS[w];
        });
        // "6x7" → 6*7  (x between numbers only — keeps words intact)
        s = s.replace(/(\d)\s*x\s*(?=\d)/g, '$1 * ');
        // indian/international digit grouping: 1,00,000 → 100000
        s = s.replace(/(\d),(\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1$2');
        // drop leftover words that are clearly not math (anything alphabetic except sqrt/pi)
        var stripped = [];
        // single letters (x, a, b…) survive as variables; longer unknown words are dropped
        s = s.replace(/[a-z]+/g, function (w) {
            if (w === 'sqrt' || w === 'cbrt' || w === 'pi' || w.length === 1) return w;
            stripped.push(w); return ' ';
        });
        return { expr: s.replace(/\s+/g, ' ').trim(), strippedWords: stripped };
    }

    // ── tokenizer ──────────────────────────────────────────────────────────
    function tokenize(s) {
        var out = [], i = 0;
        while (i < s.length) {
            var c = s[i];
            if (c === ' ') { i++; continue; }
            if (c >= '0' && c <= '9' || c === '.') {
                var j = i;
                while (j < s.length && (s[j] >= '0' && s[j] <= '9' || s[j] === '.')) j++;
                var numStr = s.slice(i, j);
                if ((numStr.match(/\./g) || []).length > 1) throw { msg: '"' + numStr + '" has too many decimal points' };
                out.push({ t: 'num', v: parseFloat(numStr) });
                i = j; continue;
            }
            if (s.startsWith('sqrt', i)) { out.push({ t: 'sqrt' }); i += 4; continue; }
            if (s.startsWith('cbrt', i)) { out.push({ t: 'cbrt' }); i += 4; continue; }
            if (s.startsWith('pi', i)) { out.push({ t: 'num', v: Math.PI }); i += 2; continue; }
            if (c === '=') { out.push({ t: '=' }); i++; continue; }
            // v10: single-letter variables (x, y, a, b, n…) — powers come from ^ or ²
            if (c >= 'a' && c <= 'z' && c !== 'e') { out.push({ t: 'var', v: c }); i++; continue; }
            if ('+-*/^%()!'.indexOf(c) !== -1) { out.push({ t: c }); i++; continue; }
            throw { msg: 'I do not understand the "' + c + '" in that math' };
        }
        return out;
    }

    // ── parser (recursive descent) ────────────────────────────────────────
    function parse(tokens) {
        var pos = 0;
        function peek() { return tokens[pos]; }
        function eat(t) {
            var tk = tokens[pos];
            if (!tk || tk.t !== t) throw { msg: 'the expression looks incomplete (expected "' + t + '")' };
            pos++; return tk;
        }
        function parseExpr() {                        // + -
            var node = parseTerm();
            while (peek() && (peek().t === '+' || peek().t === '-')) {
                var op = tokens[pos++].t;
                node = { op: op, a: node, b: parseTerm() };
            }
            return node;
        }
        function parseTerm() {                        // * / % (+ implicit: 2x, 3(x+1), 2√x)
            var node = parseUnary();
            while (peek() && (peek().t === '*' || peek().t === '/' || peek().t === '%' ||
                   peek().t === 'var' || peek().t === '(' || peek().t === 'sqrt' || peek().t === 'cbrt')) {
                if (peek().t !== '*' && peek().t !== '/' && peek().t !== '%') {
                    // implicit multiplication only when the left side can be multiplied
                    node = { op: '*', a: node, b: parseUnary() };
                    continue;
                }
                var op = tokens[pos++].t;
                node = { op: op, a: node, b: parseUnary() };
            }
            return node;
        }
        function parsePow() {                         // ^ (right-assoc, binds tighter than unary −)
            var node = parsePostfix();
            if (peek() && peek().t === '^') {
                pos++;
                node = { op: '^', a: node, b: parseUnary() };   // 2^−1 works
            }
            return node;
        }
        function parseUnary() {                       // leading −  (−3² = −(3²) = −9, standard maths)
            if (peek() && peek().t === '-') { pos++; return { op: 'neg', a: parseUnary() }; }
            if (peek() && peek().t === '+') { pos++; return parseUnary(); }
            return parsePow();
        }
        function parsePostfix() {                     // n!
            var node = parsePrimary();
            while (peek() && peek().t === '!') { pos++; node = { op: 'fact', a: node }; }
            return node;
        }
        function parsePrimary() {
            var tk = peek();
            if (!tk) throw { msg: 'the expression ends too early' };
            if (tk.t === 'num') { pos++; return { op: 'num', v: tk.v }; }
            if (tk.t === 'var') { pos++; return { op: 'var', v: tk.v }; }
            if (tk.t === 'sqrt') {
                pos++;
                if (peek() && peek().t === '(') { return { op: 'sqrt', a: parseParenInner() }; }
                return { op: 'sqrt', a: parseUnary() };
            }
            if (tk.t === 'cbrt') {
                pos++;
                if (peek() && peek().t === '(') { return { op: 'cbrt', a: parseParenInner() }; }
                return { op: 'cbrt', a: parseUnary() };
            }
            if (tk.t === '(') return parseParenInner();
            throw { msg: 'unexpected "' + tk.t + '" in the expression' };
        }
        function parseParenInner() {
            eat('(');
            var inner = parseExpr();
            eat(')');
            return { op: 'paren', a: inner };
        }
        var ast = parseExpr();
        // v10: equations — "lhs = rhs" becomes an eq node
        if (peek() && peek().t === '=') {
            pos++;
            var rhs = parseExpr();
            ast = { op: 'eq', a: ast, b: rhs };
        }
        if (pos < tokens.length) throw { msg: 'extra symbols after the expression' };
        return ast;
    }

    /* ══════════ v10 SYMBOLIC ALGEBRA ══════════════════════════════════════
       A polynomial = list of terms { c: coefficient, e: {var: power} }.
       Supports + − × ÷(by constant) ^(non-negative int) over any number of
       variables — enough for all Class-8 algebra (identities, polynomials,
       linear & quadratic equations). Anything else throws and we fall back. */
    function keyOf(e) {
        var ks = Object.keys(e).filter(function (v) { return e[v] !== 0; }).sort();
        return ks.map(function (v) { return e[v] === 1 ? v : v + '^' + e[v]; }).join('*');
    }
    function Poly(terms) { this.t = terms || []; this.trim(); }
    Poly.prototype.trim = function () {
        var map = {};
        this.t.forEach(function (tm) {
            var k = keyOf(tm.e);
            if (!map[k]) map[k] = { c: 0, e: tm.e };
            map[k].c += tm.c;
        });
        this.t = Object.keys(map).map(function (k) { return map[k]; })
            .filter(function (tm) { return Math.abs(tm.c) > 1e-12; });
        return this;
    };
    Poly.prototype.isZero = function () { return this.t.length === 0; };
    function pConst(v) { return new Poly([{ c: v, e: {} }]); }
    function pVar(name) { var e = {}; e[name] = 1; return new Poly([{ c: 1, e: e }]); }
    function pAdd(p, q) { return new Poly(p.t.concat(q.t)); }
    function pNeg(p) { return new Poly(p.t.map(function (tm) { return { c: -tm.c, e: tm.e }; })); }
    function pSub(p, q) { return pAdd(p, pNeg(q)); }
    function pMul(p, q) {
        var out = [];
        p.t.forEach(function (A) {
            q.t.forEach(function (B) {
                var e = {};
                Object.keys(A.e).forEach(function (v) { e[v] = (e[v] || 0) + A.e[v]; });
                Object.keys(B.e).forEach(function (v) { e[v] = (e[v] || 0) + B.e[v]; });
                out.push({ c: A.c * B.c, e: e });
            });
        });
        return new Poly(out);
    }
    function pScale(p, k) { return new Poly(p.t.map(function (tm) { return { c: tm.c * k, e: tm.e }; })); }
    function pPow(p, n) {
        if (n < 0 || n !== Math.floor(n)) throw { msg: 'symbolic powers need a whole number ≥ 0 exponent' };
        if (n > 12) throw { msg: 'expanding to the power ' + n + ' would explode — that is beyond Class 8 (and sanity!)' };
        var r = pConst(1);
        for (var i = 0; i < n; i++) { r = pMul(r, p); if (r.t.length > 400) throw { msg: 'that expansion is too big to show' }; }
        return r;
    }
    // degree of a single-variable poly (0 for constant). Returns -1 if multivar/unsupported.
    function pVars(p) {
        var set = {};
        p.t.forEach(function (tm) { Object.keys(tm.e).forEach(function (v) { set[v] = 1; }); });
        return Object.keys(set);
    }
    function pCoeffs(p, v) {                     // → [c0, c1, c2, …] in v; throws if not univariate-poly
        var deg = 0;
        p.t.forEach(function (tm) {
            var pw = tm.e[v] || 0;
            var others = Object.keys(tm.e).filter(function (k) { return k !== v && tm.e[k] !== 0; });
            if (others.length) throw { msg: 'that mixes several variables — I solve one at a time' };
            if (pw > deg) deg = pw;
        });
        var c = new Array(deg + 1).fill(0);
        p.t.forEach(function (tm) { c[tm.e[v] || 0] += tm.c; });
        return c;
    }
    // AST → Poly (throws on factorial / sqrt / non-integer power / ÷ by variable)
    function toPoly(node) {
        switch (node.op) {
            case 'num': return pConst(node.v);
            case 'var': return pVar(node.v);
            case 'paren': return toPoly(node.a);
            case 'neg': return pNeg(toPoly(node.a));
            case '+': return pAdd(toPoly(node.a), toPoly(node.b));
            case '-': return pSub(toPoly(node.a), toPoly(node.b));
            case '*': return pMul(toPoly(node.a), toPoly(node.b));
            case '/': {
                var den = toPoly(node.b);
                if (den.t.length !== 1 || Object.keys(den.t[0].e).length) throw { msg: 'division by a variable is not a polynomial' };
                return pScale(toPoly(node.a), 1 / den.t[0].c);
            }
            case '^': {
                var base = toPoly(node.a);
                var exN = node.b.op === 'paren' ? node.b.a : node.b;   // x^(2) from x²
                if (exN.op !== 'num') throw { msg: 'symbolic powers need a number exponent' };
                return pPow(base, exN.v);
            }
            case 'fact': case 'sqrt': case 'cbrt': throw { msg: 'factorials/roots of variables are beyond polynomial algebra' };
            default: throw { msg: 'cannot handle "' + node.op + '" symbolically' };
        }
    }
    // render a Poly in textbook standard form (a² + 2ab + b² style)
    function varPart(e) {
        return Object.keys(e).sort().filter(function (v) { return e[v]; }).map(function (v) {
            var pw = e[v];
            return pw === 1 ? v : pw === 2 ? v + '²' : pw === 3 ? v + '³' : v + '^' + pw;
        }).join('');
    }
    function polyStr(p) {
        if (p.isZero()) return '0';
        var vs = pVars(p);
        var order = p.t.slice().sort(function (A, B) {
            for (var i = 0; i < vs.length; i++) {
                var d = (B.e[vs[i]] || 0) - (A.e[vs[i]] || 0);
                if (d) return d;
            }
            return 0;
        });
        var s = '';
        order.forEach(function (tm, i) {
            var c = Math.round(tm.c * 1e9) / 1e9;
            var mag = Math.abs(c);
            var vp = varPart(tm.e);
            var sign = c < 0 ? (i === 0 ? '−' : ' − ') : (i === 0 ? '' : ' + ');
            var coef = vp ? (mag === 1 ? '' : fmtN(mag)) : fmtN(mag);
            s += sign + coef + vp;
        });
        return s || '0';
    }

    function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
    function fracStr(v) {                          // exact fraction string for a rational v
        if (v === null || v === undefined || !isFinite(v)) return null;
        if (Math.abs(v - Math.round(v)) < 1e-10) return String(Math.round(v));
        for (var d = 2; d <= 10000; d++) {
            var n = Math.round(v * d);
            if (Math.abs(v - n / d) < 1e-10) {
                var g = gcd(n, d) || 1;
                n /= g; d /= g;
                return d === 1 ? String(n) : n + '/' + d;
            }
        }
        return null;
    }

    /* Solve a univariate polynomial equation p = 0 (degree ≤ 2) with steps. */
    function solvePoly(p, v) {
        var c = pCoeffs(p, v);
        var deg = c.length - 1;
        while (deg > 0 && Math.abs(c[deg]) < 1e-12) deg--;      // trim leading zeros
        var steps = [];
        if (deg === 0) {
            if (Math.abs(c[0]) < 1e-12) return { infinite: true, steps: steps };
            return { none: true, steps: steps };                 // e.g. 5 = 0
        }
        if (deg === 1) {
            var a1 = c[1], b1 = c[0];
            var lhs = (a1 === 1 ? '' : a1 === -1 ? '−' : fmtN(a1)) + v;
            if (Math.abs(b1) > 1e-12)
                steps.push({ why: 'Transpose the constant to the RHS (sign flips)', calc: lhs + (b1 > 0 ? ' + ' + fmtN(b1) : ' − ' + fmtN(-b1)) + ' = 0  →  ' + lhs + ' = ' + fmtN(-b1), expr: '' });
            var xv = -b1 / a1;
            if (Math.abs(a1 - 1) > 1e-12)
                steps.push({ why: 'Divide both sides by ' + fmtN(a1), calc: v + ' = ' + fmtN(-b1) + ' ÷ ' + fmtN(a1) + ' = ' + fmtN(xv), expr: '' });
            return { roots: [xv], exact: [fracStr(xv)], steps: steps, kind: 'linear' };
        }
        if (deg === 2) {
            var a = c[2], b = c[1], cc = c[0];
            var D = b * b - 4 * a * cc;
            steps.push({ why: 'Discriminant D = b² − 4ac', calc: 'D = (' + fmtN(b) + ')² − 4(' + fmtN(a) + ')(' + fmtN(cc) + ') = ' + fmtN(D), expr: '' });
            if (D < -1e-12) {
                steps.push({ why: 'D < 0', calc: 'no real roots (two complex roots)', expr: '' });
                return { complex: true, D: D, steps: steps, kind: 'quadratic' };
            }
            var sq = Math.sqrt(D);
            var r1 = (-b + sq) / (2 * a), r2 = (-b - sq) / (2 * a);
            steps.push({ why: 'Quadratic formula  ' + v + ' = (−b ± √D) ÷ 2a', calc: v + ' = (' + fmtN(-b) + ' ± √' + fmtN(D) + ') ÷ ' + fmtN(2 * a) + ' = (' + fmtN(-b) + ' ± ' + fmtN(sq) + ') ÷ ' + fmtN(2 * a), expr: '' });
            if (Math.abs(r1 - r2) < 1e-12) {
                steps.push({ why: 'D = 0 → equal roots', calc: v + ' = ' + fmtN(r1), expr: '' });
                return { roots: [r1], exact: [fracStr(r1)], steps: steps, kind: 'quadratic' };
            }
            var roots = [r1, r2].sort(function (m, n) { return m - n; });
            steps.push({ why: 'Two roots', calc: v + ' = ' + fmtN(roots[0]) + '  or  ' + v + ' = ' + fmtN(roots[1]), expr: '' });
            if (Math.abs(a - 1) < 1e-12) {           // show the school factorised form too
                var f1 = fracStr(roots[0]), f2 = fracStr(roots[1]);
                var intish = function (f) { return f && f.indexOf('/') === -1; };
                if (intish(f1) && intish(f2)) {
                    var fac = function (r) { var n = -Number(r); return '(' + v + (n >= 0 ? ' + ' + fmtN(n) : ' − ' + fmtN(-n)) + ')'; };
                    steps.push({ why: 'Factorised form', calc: polyStr(p) + ' = ' + fac(f1) + fac(f2), expr: '' });
                }
            }
            return { roots: roots, exact: roots.map(fracStr), steps: steps, kind: 'quadratic' };
        }
        throw { msg: 'I solve equations up to degree 2 symbolically (this one is degree ' + deg + ')' };
    }

    function evalSub(node, vname, vval) {          // numeric evaluate with one variable substituted
        switch (node.op) {
            case 'num': return node.v;
            case 'var':
                if (node.v !== vname) throw { msg: 'unexpected variable ' + node.v };
                return vval;
            case 'paren': return evalSub(node.a, vname, vval);
            case 'neg': return -evalSub(node.a, vname, vval);
            case 'fact': return factorial(evalSub(node.a, vname, vval));
            case 'sqrt': return Math.sqrt(evalSub(node.a, vname, vval));
            case 'cbrt': return Math.cbrt(evalSub(node.a, vname, vval));
            default: {
                var a = evalSub(node.a, vname, vval), b = evalSub(node.b, vname, vval);
                switch (node.op) {
                    case '+': return a + b; case '-': return a - b;
                    case '*': return a * b; case '/': return a / b; case '%': return a % b;
                    case '^': return Math.pow(a, b);
                }
            }
        }
        throw { msg: 'cannot check' };
    }

    /* Top-level: solve "lhs = rhs". Returns {ok, variable, roots, steps, checks}. */
    function solveEquation(text) {
        var norm = normalize(text);
        if (!/[a-z]/.test(norm.expr) || norm.expr.indexOf('=') === -1) return { ok: false };
        var ast;
        try { ast = parse(tokenize(norm.expr)); } catch (e) { return { ok: false, error: e && e.msg }; }
        if (ast.op !== 'eq') return { ok: false };
        var lp, rp;
        try { lp = toPoly(ast.a); rp = toPoly(ast.b); }
        catch (e) { return { ok: false, error: (e && e.msg) || 'not a polynomial equation' }; }
        var diff = pSub(lp, rp);
        var vs = pVars(diff);
        if (vs.length === 0) {                       // 2 = 2, 2+2 = 4 or 2 = 3
            var holds = diff.isZero();
            var idRes = { ok: true, identity: holds, steps: [{ why: 'No variable left', calc: holds ? 'both sides are identical — true for EVERY value' : 'the two sides can never be equal — no solution', expr: '' }] };
            try { var lv0 = evaluate(ast.a), rv0 = evaluate(ast.b); idRes.numeric = true; idRes.lhsVal = lv0; idRes.rhsVal = rv0; } catch (e) { }
            return idRes;
        }
        if (vs.length > 1) return { ok: false, error: 'that equation has ' + vs.length + ' variables (' + vs.join(', ') + ') — I need exactly one to solve' };
        var v = vs[0];
        var steps = [];
        var ra = render(ast.a, 0), rb = render(ast.b, 0);
        var sa = polyStr(lp), sb = polyStr(rp);
        var sup = function (s) { return s.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\s+/g, ' ').trim(); };
        if (sup(ra) !== sup(sa) || sup(rb) !== sup(sb))
            steps.push({ why: 'Expand brackets & collect like terms', calc: sa + ' = ' + sb, expr: '' });
        steps.push({ why: 'Move every term to the LHS (subtract RHS from both sides)', calc: polyStr(diff) + ' = 0', expr: '' });
        var res;
        try { res = solvePoly(diff, v); } catch (e) { return { ok: false, error: e && e.msg }; }
        steps = steps.concat(res.steps);
        if (res.infinite) return { ok: true, variable: v, infinite: true, steps: steps };
        if (res.none) return { ok: true, variable: v, none: true, steps: steps };
        if (res.complex) return { ok: true, variable: v, complex: true, D: res.D, steps: steps };
        // verify every root by substitution (the school "check" step)
        var checks = [];
        res.roots.forEach(function (r) {
            try {
                var lv = evalSub(ast.a, v, r), rv = evalSub(ast.b, v, r);
                checks.push({ root: r, lhs: Math.round(lv * 1e9) / 1e9, rhs: Math.round(rv * 1e9) / 1e9, ok: Math.abs(lv - rv) < 1e-6 });
            } catch (e) { checks.push({ root: r, ok: null }); }
        });
        return { ok: true, variable: v, roots: res.roots, exact: res.exact, steps: steps, checks: checks, kind: res.kind, lhsStr: ra, rhsStr: rb };
    }

    /* Expand / simplify a symbolic expression (no '=') to standard form. */
    function expand(text) {
        var norm = normalize(text);
        if (!/[a-z]/.test(norm.expr) || norm.expr.indexOf('=') !== -1) return { ok: false };
        var ast;
        try { ast = parse(tokenize(norm.expr)); } catch (e) { return { ok: false, error: e && e.msg }; }
        var p;
        try { p = toPoly(ast); } catch (e) { return { ok: false, error: (e && e.msg) || 'not a polynomial' }; }
        return { ok: true, input: render(ast, 0), result: polyStr(p), vars: pVars(p) };
    }

    // ── evaluation with honest guards ──────────────────────────────────────
    function factorial(n) {
        if (n !== Math.floor(n) || n < 0) throw { msg: 'factorials need a whole number ≥ 0' };
        if (n > 170) throw { msg: n + '! overflows even 64-bit floats (max 170!) — try a smaller number' };
        var r = 1; for (var k = 2; k <= n; k++) r *= k;
        return r;
    }
    function evaluate(node) {
        switch (node.op) {
            case 'num': return node.v;
            case 'var': throw { msg: '"' + node.v + '" is a variable — ask me to SOLVE an equation ("solve 2x+3=11") or EXPAND an expression ("expand (a+b)²")' };
            case 'eq': throw { msg: 'that is an equation — say "solve" and I will find the variable' };
            case 'paren': return evaluate(node.a);
            case 'neg': return -evaluate(node.a);
            case 'fact': return factorial(evaluate(node.a));
            case 'sqrt': {
                var sv = evaluate(node.a);
                if (sv < 0) throw { msg: 'cannot take the square root of a negative number (no real answer)' };
                return Math.sqrt(sv);
            }
            case 'cbrt': return Math.cbrt(evaluate(node.a));
            default: {
                var a = evaluate(node.a), b = evaluate(node.b);
                switch (node.op) {
                    case '+': return a + b;
                    case '-': return a - b;
                    case '*': return a * b;
                    case '/':
                        if (Math.abs(b) < 1e-12) throw { msg: 'division by zero is undefined — even for me!' };
                        return a / b;
                    case '%':
                        if (Math.abs(b) < 1e-12) throw { msg: 'modulo by zero is undefined' };
                        return a % b;
                    case '^': {
                        var pv = Math.pow(a, b);
                        if (!isFinite(pv)) throw { msg: 'that power explodes past Infinity 🤯 — try smaller numbers' };
                        return pv;
                    }
                }
            }
        }
        throw { msg: 'unknown operation' };
    }

    // ── pretty rendering (precedence-aware brackets) ───────────────────────
    var PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, neg: 4, fact: 5, sqrt: 5, cbrt: 5, num: 9, paren: 9, var: 9, eq: 0 };
    var SYM = { '+': ' + ', '-': ' − ', '*': ' × ', '/': ' ÷ ', '%': ' mod ', '^': '^' };
    function fmtN(v) {
        if (Number.isInteger(v)) return Math.abs(v) >= 1e15 ? v.toExponential(6) : String(v);
        var r = Math.round(v * 1e10) / 1e10;
        return String(+r.toPrecision(12));
    }
    function render(node, parentPrec) {
        var s;
        switch (node.op) {
            case 'num': s = node.v === Math.PI ? 'π' : fmtN(node.v); break;
            case 'var': s = node.v; break;
            case 'eq': s = render(node.a, 0) + ' = ' + render(node.b, 0); break;
            case 'paren':
                s = render(node.a, 0);
                // keep brackets visible when the inside is an operation —
                // "(2+3)×4" must NOT print as "2 + 3 × 4" (different value!)
                if (node.a && ['+', '-', '*', '/', '%', '^', 'neg'].indexOf(node.a.op) !== -1) s = '(' + s + ')';
                break;
            case 'neg': s = '−' + render(node.a, PREC.neg); break;
            case 'fact': s = render(node.a, PREC.fact) + '!'; break;
            case 'sqrt': s = '√(' + render(node.a, 0) + ')'; break;
            case 'cbrt': s = '∛(' + render(node.a, 0) + ')'; break;
            default:
                s = render(node.a, PREC[node.op]) + SYM[node.op] +
                    (node.op === '^' ? render(node.b, 0) : render(node.b, PREC[node.op] + 0.5));
        }
        var my = PREC[node.op] || 0;
        if (node.op === 'paren') my = 9;
        if (parentPrec !== undefined && my < parentPrec) return '(' + s + ')';
        return s;
    }

    // ── BODMAS step generator ──────────────────────────────────────────────
    var RANK = { fact: 5.5, sqrt: 5.4, cbrt: 5.45, neg: 5.3, '^': 5, '*': 4, '/': 4, '%': 4, '+': 3, '-': 3 };
    var WHY = { '+': 'Addition', '-': 'Subtraction', '*': 'Multiplication', '/': 'Division', '%': 'Modulo (remainder)',
        '^': 'Exponent (power)', fact: 'Factorial', sqrt: 'Square root', cbrt: 'Cube root', neg: 'Negative sign' };
    function collectOps(node, depth, inParen, acc, path) {
        if (!node || node.op === 'num') return;
        if (RANK[node.op] !== undefined && node.op !== 'paren')
            acc.push({ node: node, path: path.slice(), depth: depth, inParen: inParen });
        if (node.op === 'paren') collectOps(node.a, depth + 1, true, acc, path.concat('a'));
        else if (node.op === 'neg' || node.op === 'fact' || node.op === 'sqrt' || node.op === 'cbrt') collectOps(node.a, depth, inParen, acc, path.concat('a'));
        else if (node.a && node.b) {
            collectOps(node.a, depth, inParen, acc, path.concat('a'));
            collectOps(node.b, depth, inParen, acc, path.concat('b'));
        }
    }
    function setPath(root, path, val) {
        var n = root;
        for (var i = 0; i < path.length; i++) n = n[path[i]];
        return n;
    }
    function cloneAst(node) {
        if (!node) return node;
        var c = { op: node.op };
        if (node.v !== undefined) c.v = node.v;
        if (node.a) c.a = cloneAst(node.a);
        if (node.b) c.b = cloneAst(node.b);
        return c;
    }
    function foldParens(node) {                        // (7) → 7
        if (!node) return node;
        if (node.a) node.a = foldParens(node.a);
        if (node.b) node.b = foldParens(node.b);
        if (node.op === 'paren' && node.a && node.a.op === 'num') return node.a;
        return node;
    }
    function isReadyNode(n) {                          // all direct operands are plain values
        if (n.op === 'num' || n.op === 'paren') return true;
        var a = !n.a || n.a.op === 'num' || n.a.op === 'paren';
        var b = !n.b || n.b.op === 'num' || n.b.op === 'paren';
        return a && b;
    }
    function steps(ast) {
        var out = [], guard = 0;
        ast = cloneAst(ast);
        while (ast.op !== 'num' && guard++ < 60) {
            var acc = [];
            collectOps(ast, 0, false, acc, []);
            if (!acc.length) break;
            // BODMAS: deepest (inside brackets) first, then by operation rank,
            // then reducible-now first, then leftmost
            var best = acc[0];
            for (var i = 1; i < acc.length; i++) {
                var s1 = acc[i].depth * 100 + RANK[acc[i].node.op] + (isReadyNode(acc[i].node) ? 0.6 : 0);
                var s0 = best.depth * 100 + RANK[best.node.op] + (isReadyNode(best.node) ? 0.6 : 0);
                if (s1 > s0) best = acc[i];
            }
            var target = best.node;
            var val, calc;
            if (target.op === 'neg') { val = -evaluate(target.a); calc = '−' + render(target.a, 9) + ' = ' + fmtN(val); }
            else if (target.op === 'fact') { val = evaluate(target); calc = render(target.a, 9) + '! = ' + fmtN(val); }
            else if (target.op === 'sqrt') { val = evaluate(target); calc = '√(' + render(target.a, 0) + ') = ' + fmtN(val); }
            else if (target.op === 'cbrt') { val = evaluate(target); calc = '∛(' + render(target.a, 0) + ') = ' + fmtN(val); }
            else {
                var a = evaluate(target.a), b = evaluate(target.b);
                val = evaluate(target);
                calc = fmtN(a) + SYM[target.op] + fmtN(b) + ' = ' + fmtN(val);
            }
            // replace the target node with its value inside a fresh tree
            var rebuilt = cloneAst(ast);
            var parent = best.path.length ? setPath(rebuilt, best.path.slice(0, -1)) : null;
            var leaf = { op: 'num', v: val };
            if (parent) parent[best.path[best.path.length - 1]] = leaf; else rebuilt = leaf;
            rebuilt = foldParens(rebuilt);
            out.push({
                why: (best.inParen ? 'Brackets first → ' : '') + WHY[target.op],
                calc: calc,
                expr: rebuilt.op === 'num' ? fmtN(rebuilt.v) : render(rebuilt, 0)
            });
            ast = rebuilt;
        }
        return { steps: out, final: ast.op === 'num' ? ast.v : null };
    }

    // ── exact-fraction helper (same spirit as v6's toFrac) ─────────────────
    function toFrac(v) {
        if (!isFinite(v) || Number.isInteger(v)) return null;
        var sign = v < 0 ? -1 : 1; v = Math.abs(v);
        var bn = 0, bd = 1, be = 1;
        for (var d = 2; d <= 500; d++) {
            var n = Math.round(v * d);
            var err = Math.abs(v - n / d);
            if (err < be) { be = err; bn = n; bd = d; }
            if (be < 1e-9) break;
        }
        if (be > 1e-9 || bd === 1 || bn === 0) return null;
        return (sign < 0 ? '-' : '') + bn + '/' + bd;
    }

    // ── the one entry point the UI calls ───────────────────────────────────
    function solve(text) {
        var norm = normalize(text);
        if (!norm.expr) return { ok: false, error: 'no expression found', normalized: norm.expr };
        if (!/[\d]|pi/.test(norm.expr)) return { ok: false, error: 'no numbers found', normalized: norm.expr };
        var tokens, ast, value;
        try {
            tokens = tokenize(norm.expr);
            ast = parse(tokens);
            value = evaluate(ast);
        } catch (e) {
            return { ok: false, error: (e && e.msg) || 'that expression looks broken', normalized: norm.expr };
        }
        if (!isFinite(value)) return { ok: false, error: 'the answer explodes past Infinity', normalized: norm.expr };
        var valueRounded = Math.round(value * 1e10) / 1e10;
        var st = steps(ast);
        return {
            ok: true,
            value: valueRounded,
            expr: render(ast, 0),
            normalized: norm.expr,
            strippedWords: norm.strippedWords,
            steps: st.steps,
            opCount: st.steps.length,
            fraction: toFrac(valueRounded)
        };
    }

    // Is this text a pure math expression? (deterministic skill_calc pre-catch)
    function looksLikeMath(text) {
        var s = String(text || '').trim();
        if (s.length > 100 || !/\d/.test(s)) return false;
        // after stripping safe math chars, only chat-noise words may remain
        var core = s.toLowerCase()
            .replace(/[÷×−–—⁰¹²³⁴⁵⁶⁷⁸⁹√π^%*/+().!\-]/g, ' ')
            .replace(/\d+/g, ' ')
            .replace(/\b(what|what's|whats|is|are|calculate|compute|solve|simplify|evaluate|tell|me|the|answer|of|please|pls|and|then|equal|equals|to|ka|ki|kya|kitna|hota|hoga|hai|batao|value|expression|sqrt|cbrt|root)\b/g, ' ')
            .replace(/[^a-z]/g, '');
        if (core.length !== 0) return false;
        var low = s.toLowerCase();
        if (/\b(sqrt|cbrt)\b/.test(low)) return true;                       // word-form roots: sqrt(10), cbrt 27
        if (/[+*/^%÷×!√π²³¹]|[⁰⁴⁵⁶⁷⁸⁹]|sup/.test(low)) return true;         // operators, !, √, π, superscripts
        return low.indexOf('-') > 0 && /\d/.test(low);                      // "9-08" yes; bare "-5" no
    }

    /* v10: equations & expansions also count as "math" for the deterministic
       pre-catch: "2x+3=11", "solve for x: 5x-2=3x+8", "expand (a+b)^2", "(a+b)(a-b)" */
    var ALG_NOISE = /\b(solve|for|find|the|value|of|what|is|expand|simplify|factorise|factorize|expression|equation|to|ka|ki|kya|kitna|hota|hoga|hai|batao|bataye|bata|karo|kar|nikalo|kare|kijiye|please|pls|and|minus|plus)\b/g;
    function looksLikeEquation(text) {
        var s = String(text || '').trim().toLowerCase();
        if (s.length > 80 || s.length < 3) return false;
        var core = s
            .replace(/[\u00f7\u00d7\u2212\u2013\u2014\u2070\u00b9\u00b2\u00b3\u2074-\u2079\u221a\u03c0^%*/+().!=:\-]/g, ' ')
            .replace(/\d+/g, ' ')
            .replace(ALG_NOISE, ' ')
            .replace(/\b[a-z]\b/g, ' ')               // single-letter variables
            .replace(/[^a-z]/g, '');
        if (core.length !== 0) return false;
        var hasVar = /[a-z]/.test(s.replace(ALG_NOISE, ' '));
        if (!hasVar) return false;
        return s.indexOf('=') > -1 || /(expand|simplify|factori[sz]e)/.test(s) || s.indexOf('(') > -1;
    }

    var BitMath = {
        normalize: normalize, tokenize: tokenize, parse: parse, evaluate: evaluate,
        render: render, steps: steps, solve: solve, toFrac: toFrac, looksLikeMath: looksLikeMath,
        fmtN: fmtN, factorial: factorial,
        solveEquation: solveEquation, expand: expand, polyStr: polyStr, looksLikeEquation: looksLikeEquation
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = BitMath;
    else root.BitMath = BitMath;
})(typeof window !== 'undefined' ? window : globalThis);
