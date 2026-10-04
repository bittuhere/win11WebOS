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
   BitBot WORD-PROBLEM ENGINE v10 — deterministic solvers for Class 1–8 maths
   word problems (DAV syllabus). Every solver shows school-style steps and,
   where possible, a verification. Returns null when it doesn't recognise the
   problem, so the caller (doMath / respond) can fall through safely.

   Covered: numbers & linear setups, ages, consecutive numbers, speed–distance–
   time, work & time (incl. pipes), unitary method, direct/inverse variation,
   ratio division, percentages, profit–loss–discount, GST/VAT, SI & CI (all
   compounding), population growth/depreciation, 2-D mensuration, Pythagoras,
   polygon angles, 3-D mensuration, perfect squares/cubes, prime-factorisation
   roots, averages, probability, 2×2 simultaneous word problems and simple
   Class 1–5 story sums (with number-words like "twenty five" → 25).
   Runs in browser (window.BitWords) and Node (module.exports).
   ═════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    /* ── helpers ─────────────────────────────────────────────────────────── */
    function fmt(v) {                                  // tidy number display
        if (!isFinite(v)) return String(v);
        var r = Math.round(v * 1e6) / 1e6;
        if (Math.abs(r) >= 1e7 || (Math.abs(r) < 1e-6 && r !== 0)) return r.toExponential(4).replace('e+', 'e');
        return String(r);
    }
    function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
    function fracStr(v) {                              // exact fraction if v is a clean rational
        if (!isFinite(v)) return null;
        if (Math.abs(v - Math.round(v)) < 1e-10) return String(Math.round(v));
        for (var d = 2; d <= 10000; d++) {
            var n = Math.round(v * d);
            if (Math.abs(v - n / d) < 1e-10) {
                var g = gcd(n, d) || 1; n /= g; d /= g;
                return d === 1 ? String(n) : n + '/' + d;
            }
        }
        return null;
    }
    function plu(w) {                                     // smart plural: "mangoes" stays, "toy"→"toys", "box"→"boxes"
        w = String(w || '');
        if (/s$/.test(w)) return w;
        if (/(?:[sxzo]|ch|sh)$/.test(w)) return w + 'es';
        if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
        return w + 's';
    }
    function nice(v) {                                 // "6" or "18/5 ( = 3.6 )" style
        var f = fracStr(v), r = fmt(v);
        return (f && f !== r) ? '**' + f + '** ( = ' + r + ' )' : '**' + r + '**';
    }
    function R(title, given, steps, answer, check) {
        return { title: title, given: given, steps: steps, answer: answer, check: check || null };
    }
    function st(steps, why, calc) { steps.push({ why: why, calc: calc || '' }); return steps; }

    var NUMW = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
        ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
        seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
        sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
        lakh: 100000, lac: 100000, million: 1000000, crore: 10000000, dozen: 12
    };
    function wordsToNums(t) {                          // "twenty five" → 25, "two hundred" → 200
        t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g,
            function (_, a, b) { return NUMW[a] + NUMW[b]; });
        t = t.replace(/\b(one|two|three|four|five|six|seven|eight|nine)[\s-]+(hundred|thousand|lakh|lac|million|crore)\b/g,
            function (_, a, b) { return NUMW[a] * NUMW[b]; });
        t = t.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|dozen)\b/g,
            function (w) { return NUMW[w]; });
        return t;
    }
    function norm(text) {
        var t = String(text || '').toLowerCase();
        t = t.replace(/₹/g, ' rs ').replace(/\b(rupees|inr)\b/g, ' rs ');
        t = t.replace(/\u00f7/g, '/').replace(/\u00d7/g, '*').replace(/[\u2212\u2013\u2014]/g, '-');
        t = t.replace(/(\d),(\d\d\d)\b/g, '$1$2');      // Indian/US thousands commas
        t = t.replace(/(\d)\.(\d)/g, '$1\u0001$2');     // protect decimals…
        t = t.replace(/\./g, ' ');                      // …then dots become spaces (sentences merge)
        t = t.replace(/\u0001/g, '.');
        /* v14: Hinglish story-sum words → English (safe subset only) */
        t = t.replace(/\bke paas\b/g, 'has').replace(/\bpaas\b/g, 'has')
             .replace(/\b(?:kha liya|khaya|khaa liya|kha)\b/g, 'ate')
             .replace(/\b(?:bach gaye|bach gaya|bache|bachi)\b/g, 'left')
             .replace(/\bkitne\b/g, 'how many').replace(/\busne\b/g, 'he')
             .replace(/\b(?:de diya|de diye|diya|diye)\b/g, 'gave')
             .replace(/\bek\b/g, 'one').replace(/\bteen\b/g, 'three')
             .replace(/\bchaar\b/g, 'four').replace(/\bpaanch\b/g, 'five');
        t = wordsToNums(t);
        t = t.replace(/\s+/g, ' ').replace(/\s*\?\s*/g, ' ? ').trim();
        return t;
    }
    function N(s) { return parseFloat(s); }
    var NUM = '(\\d+(?:\\.\\d+)?)';
    function numAt(t, re) { var m = t.match(re); return m ? N(m[1]) : null; }
    function allNums(t) {
        var out = [], re = new RegExp(NUM, 'g'), m;
        while ((m = re.exec(t)) !== null) out.push({ v: N(m[0]), i: m.index });
        return out;
    }
    function factorise(n) {                            // prime factorisation → [[p,e],...]
        var f = [], d = 2; n = Math.abs(Math.round(n));
        if (n < 2) return [];
        while (d * d <= n) { while (n % d === 0) { f.push(d); n /= d; } d++; }
        if (n > 1) f.push(n);
        var out = []; f.forEach(function (p) {
            if (out.length && out[out.length - 1][0] === p) out[out.length - 1][1]++;
            else out.push([p, 1]);
        });
        return out;
    }
    function facStr(n) {
        return factorise(n).map(function (pe) { return pe[1] === 1 ? String(pe[0]) : pe[0] + '^' + pe[1]; }).join(' × ');
    }
    function PI_FOR() {
        var vs = Array.prototype.slice.call(arguments);
        for (var i = 0; i < vs.length; i++) if (vs[i] % 7 === 0) return { v: 22 / 7, s: '22/7' };
        return { v: 3.14, s: '3.14' };
    }

    /* ── shape words ─────────────────────────────────────────────────────── */
    var SHAPES = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, enneagon: 9, decagon: 10, dodecagon: 12 };
    function shapeSides(t) {
        var m = t.match(/(\d+)[\s-]*(?:sided|sides)/);
        if (m) return N(m[1]);
        m = t.match(/polygon (?:of|with) (\d+) sides/);
        if (m) return N(m[1]);
        for (var k in SHAPES) if (t.indexOf(k) !== -1) return SHAPES[k];
        return null;
    }

    /* ── the solver table ────────────────────────────────────────────────── */
    var SOLVERS = [];
    function S(name, re, fn) { SOLVERS.push({ name: name, re: re, fn: fn }); }

    /* 1. sum & difference of two numbers */
    S('sum-difference', new RegExp('sum of (?:two|2|the two) numbers?[^.]*?is\\s*' + NUM + '[\\s\\S]*?difference (?:of the numbers |between them |of them )?is\\s*' + NUM),
        function (m) {
            var S1 = N(m[1]), D = N(m[2]), steps = [];
            var big = (S1 + D) / 2, small = (S1 - D) / 2;
            if (small < 0) return null;
            st(steps, 'Let the numbers be b (bigger) and s (smaller)', 'b + s = ' + fmt(S1) + '   and   b − s = ' + fmt(D));
            st(steps, 'Add the two equations', '2b = ' + fmt(S1) + ' + ' + fmt(D) + ' = ' + fmt(S1 + D) + '  →  b = ' + fmt(big));
            st(steps, 'Substitute b back', 's = ' + fmt(S1) + ' − ' + fmt(big) + ' = ' + fmt(small));
            return R('Sum & Difference of two numbers', 'sum = ' + fmt(S1) + ', difference = ' + fmt(D), steps,
                'Bigger number = ' + nice(big) + ',  Smaller number = ' + nice(small),
                fmt(big) + ' + ' + fmt(small) + ' = ' + fmt(big + small) + ' ✔  and  ' + fmt(big) + ' − ' + fmt(small) + ' = ' + fmt(big - small) + ' ✔');
        });

    /* 2. sum given, one number known */
    S('sum-one-known', new RegExp('sum of (?:two|2) numbers?[^.]*?is\\s*' + NUM + '[\\s\\S]*?(?:one|1|first|second)(?: number)? is\\s*' + NUM),
        function (m) {
            var S1 = N(m[1]), X = N(m[2]), steps = [];
            st(steps, 'Let the other number be y', X + ' + y = ' + fmt(S1));
            st(steps, 'Transpose', 'y = ' + fmt(S1) + ' − ' + fmt(X) + ' = ' + fmt(S1 - X));
            return R('Sum given, one number known', 'sum = ' + fmt(S1) + ', one number = ' + fmt(X), steps,
                'The other number = ' + nice(S1 - X), fmt(X) + ' + ' + fmt(S1 - X) + ' = ' + fmt(S1) + ' ✔');
        });

    /* 3. one number is k times the other, sum given */
    S('times-other-sum', new RegExp('(?:one|1) number is\\s*' + NUM + ' times (?:the )?other[\\s\\S]*?sum[^.]*?is\\s*' + NUM),
        function (m) { return timesSum(m[1], m[2]); });
    S('times-other-sum2', new RegExp('sum[^.]*?(?:of two numbers|of them|of the numbers)? is\\s*' + NUM + '[\\s\\S]*?(?:one|1) number is\\s*' + NUM + ' times (?:the )?other'),
        function (m) { return timesSum(m[2], m[1]); });
    function timesSum(kS, S1) {
        var k = N(kS), sum = N(S1), steps = [];
        var x = sum / (k + 1);
        st(steps, 'Let the smaller number be x, so the bigger is ' + fmt(k) + 'x', 'x + ' + fmt(k) + 'x = ' + fmt(sum));
        st(steps, 'Collect like terms', fmt(k + 1) + 'x = ' + fmt(sum) + '  →  x = ' + fmt(sum) + ' ÷ ' + fmt(k + 1) + ' = ' + fmt(x));
        return R('One number is ' + fmt(k) + '× the other', 'sum = ' + fmt(sum), steps,
            'Numbers are ' + nice(x) + ' and ' + nice(k * x), fmt(x) + ' + ' + fmt(k * x) + ' = ' + fmt(x + k * x) + ' ✔');
    }

    /* 4. word-linear: "twice a number increased by 5 is 17" */
    S('word-linear', null, function (m, t) {
        var mult = null, mm;
        if ((mm = t.match(/\b(twice|double|thrice|triple)\b/))) mult = { twice: 2, double: 2, thrice: 3, triple: 3 }[mm[1]];
        else if ((mm = t.match(new RegExp(NUM + ' times a number')))) mult = N(mm[1]);
        else if ((mm = t.match(new RegExp('a number (?:multiplied|multiply|multiplying) by\\s*' + NUM)))) mult = N(mm[1]);
        if (mult === null) return null;
        if (!/number/.test(t)) return null;
        var c = 0, cM;
        if ((cM = t.match(new RegExp(NUM + ' (?:is )?(?:added to|plus)')))) c = N(cM[1]);
        else if ((cM = t.match(new RegExp(NUM + ' (?:is )?(?:subtracted from|minus)')))) c = -N(cM[1]);
        else if ((cM = t.match(new RegExp('(increased|added) by\\s*' + NUM)))) c = N(cM[2]);
        else if ((cM = t.match(new RegExp('(decreased|reduced|subtracted|diminished|lessened) by\\s*' + NUM)))) c = -N(cM[2]);
        var resM = t.match(new RegExp('(?:is|are|equals?|gives?|becomes?|we get|result is)\\s*' + NUM + '\\s*(?:\\?|$|,)'));
        if (!resM) resM = t.match(new RegExp('(?:is|are|equals?|gives?|becomes?|we get|result is)\\s*' + NUM));
        if (!resM) return null;
        var rhs = N(resM[1]);
        if (rhs === Math.abs(c) && c !== 0) return null;   // grabbed the wrong number
        var x = (rhs - c) / mult, steps = [];
        st(steps, 'Let the number be x — translate the sentence', fmt(mult) + 'x' + (c >= 0 ? ' + ' + fmt(c) : ' − ' + fmt(-c)) + ' = ' + fmt(rhs));
        if (c !== 0) st(steps, 'Transpose the constant', fmt(mult) + 'x = ' + fmt(rhs) + (c >= 0 ? ' − ' + fmt(c) : ' + ' + fmt(-c)) + ' = ' + fmt(rhs - c));
        if (mult !== 1) st(steps, 'Divide both sides by ' + fmt(mult), 'x = ' + fmt(rhs - c) + ' ÷ ' + fmt(mult) + ' = ' + fmt(x));
        return R('Linear equation from words', 'the sentence as an equation', steps, 'The number = ' + nice(x),
            fmt(mult) + ' × ' + fmt(x) + (c >= 0 ? ' + ' + fmt(c) : ' − ' + fmt(-c)) + ' = ' + fmt(mult * x + c) + ' ✔');
    });

    /* 5. fraction of a number */
    S('fraction-of-number', new RegExp(NUM + '\\s*/\\s*' + NUM + ' of (?:a |the )?number is\\s*' + NUM),
        function (m) {
            var a = N(m[1]), b = N(m[2]), res = N(m[3]);
            if (b === 0 || a === 0) return null;
            var steps = [], x = res * b / a;
            st(steps, 'Let the number be x', '(' + a + '/' + b + ') × x = ' + fmt(res));
            st(steps, 'Multiply both sides by ' + b + '/' + a, 'x = ' + fmt(res) + ' × ' + b + '/' + a + ' = ' + fmt(res * b) + '/' + a + ' = ' + fmt(x));
            return R('Fraction of a number', a + '/' + b + ' of x = ' + fmt(res), steps, 'The number = ' + nice(x),
                a + '/' + b + ' × ' + fmt(x) + ' = ' + fmt(a * x / b) + ' ✔');
        });

    /* 6. consecutive numbers */
    S('consecutive', null, function (m, t) {
        var mm = t.match(new RegExp('sum of (?:the )?(?:first )?' + NUM + ' consecutive (even |odd )?(?:natural |whole )?(?:numbers|integers)[^.]*?is\\s*' + NUM));
        if (!mm) return null;
        var n = N(mm[1]), parity = (mm[2] || '').trim(), Sm = N(mm[3]), steps = [];
        if (n < 2 || n > 500) return null;
        var first, step2 = parity ? 2 : 1;
        if (parity === 'even') { var y = (Sm - n * (n - 1)) / (2 * n); if (Math.abs(y - Math.round(y)) > 1e-9) return null; first = 2 * y; }
        else if (parity === 'odd') { var z = (Sm - n * n) / (2 * n); if (Math.abs(z - Math.round(z)) > 1e-9) return null; first = 2 * z + 1; }
        else { first = (Sm - n * (n - 1) / 2) / n; if (Math.abs(first - Math.round(first)) > 1e-9) return null; }
        var list = []; for (var i = 0; i < Math.min(n, 20); i++) list.push(first + i * step2);
        st(steps, 'Let the first number be x — consecutive numbers differ by ' + step2,
            'x, ' + (first + step2) + ', ' + (first + 2 * step2) + (n > 3 ? ', … (' + fmt(n) + ' numbers in all)' : ''));
        st(steps, 'Their sum = ' + fmt(Sm) + ' — solve for x', 'x = ' + fmt(first));
        return R('Consecutive ' + parity + ' numbers', 'count = ' + fmt(n) + ', sum = ' + fmt(Sm), steps,
            'The numbers are **' + (n <= 20 ? list.join(', ') : list.join(', ') + ', … , ' + fmt(first + (n - 1) * step2)) + '**',
            'their sum = ' + fmt(Sm) + ' ✔');
    });

    /* 7. ages */
    S('age-present', new RegExp('(?:present|current) age of ([a-z]+) is\\s*' + NUM + '[\\s\\S]*?' + NUM + ' years? (ago|before|hence|later|after)'),
        function (m) {
            var who = m[1], now = N(m[2]), n = N(m[3]), dir = m[4];
            var past = (dir === 'ago' || dir === 'before');
            var target = past ? now - n : now + n;
            if (target < 0) return null;
            var steps = [];
            st(steps, 'Present age of ' + who, fmt(now) + ' years');
            st(steps, past ? n + ' years ago → subtract ' + n : n + ' years hence → add ' + n,
                fmt(now) + (past ? ' − ' : ' + ') + fmt(n) + ' = ' + fmt(target));
            return R('Age — past/future', who + "'s present age = " + fmt(now), steps,
                who + "'s age " + (past ? fmt(n) + ' years ago' : 'after ' + fmt(n) + ' years') + ' = ' + nice(target) + ' years');
        });
    S('age-family', null, function (m, t) {
        if (!/(age|old|son|daughter|father|mother|brother|sister|uncle|aunt)/.test(t)) return null;
        if (/(present|current) age of [a-z]+ is/.test(t)) return null;          // age-present handles it
        var kM = t.match(new RegExp('is\\s*' + NUM + ' times'));
        var sumM = t.match(new RegExp('sum of[^.]{0,45}?ages?[^.]{0,45}?(?:is|are|was|will be)\\s*' + NUM));
        var diffM = t.match(new RegExp('difference of (?:their )?ages[^.]*?(?:is|was|will be)\\s*' + NUM));
        if (!kM && !diffM) return null;
        var steps = [], s, b, label = '';
        if (kM && sumM) {
            var k = N(kM[1]), sum = N(sumM[1]), nAfter = 0;
            var aft = t.match(new RegExp('(?:after|in|hence|later)\\s*' + NUM + '\\s*years?'));
            var bef = t.match(new RegExp(NUM + '\\s*years? (?:ago|before)'));
            var willBe = /will be|after|ago|before|hence/.test(t);
            if (willBe && aft) nAfter = N(aft[1]);
            else if (willBe && bef) nAfter = -N(bef[1]);
            st(steps, 'Let the younger age = x, so the elder = ' + fmt(k) + 'x', '');
            if (nAfter !== 0) {
                st(steps, (nAfter > 0 ? 'After ' + nAfter + ' years' : -nAfter + ' years ago') + ' both ages shift by ' + fmt(Math.abs(nAfter)) + ' → total shifts by ' + fmt(2 * nAfter),
                    '(' + fmt(k) + 'x' + (nAfter > 0 ? ' + ' + nAfter : ' − ' + (-nAfter)) + ') + (x' + (nAfter > 0 ? ' + ' + nAfter : ' − ' + (-nAfter)) + ') = ' + fmt(sum));
                s = (sum - 2 * nAfter) / (k + 1);
            } else {
                st(steps, 'Sum of present ages', fmt(k) + 'x + x = ' + fmt(sum) + '  →  ' + fmt(k + 1) + 'x = ' + fmt(sum));
                s = sum / (k + 1);
            }
            if (s < 0) return null;
            b = k * s;
            st(steps, 'Solve', 'x = ' + fmt(s) + (nAfter !== 0 ? '  (present age)' : ''));
            label = 'Ages — ' + fmt(k) + '× ratio & sum';
        } else if (diffM && sumM) {
            var D = N(diffM[1]), S2 = N(sumM[1]);
            b = (S2 + D) / 2; s = (S2 - D) / 2;
            st(steps, 'Elder + younger = ' + fmt(S2) + ',  Elder − younger = ' + fmt(D), 'adding: 2 × elder = ' + fmt(S2 + D));
            st(steps, 'Solve', 'elder = ' + fmt(b) + ',  younger = ' + fmt(s));
            label = 'Ages — sum & difference';
        } else if (kM && diffM) {
            var k2 = N(kM[1]), D2 = N(diffM[1]);
            s = D2 / (k2 - 1); b = k2 * s;
            if (k2 === 1 || s < 0) return null;
            st(steps, 'Elder − younger = ' + fmt(D2) + ' and elder = ' + fmt(k2) + '× younger', fmt(k2) + 'x − x = ' + fmt(D2) + '  →  x = ' + fmt(s));
            label = 'Ages — ratio & difference';
        } else return null;
        return R(label, 'solved with a linear equation', steps,
            'Younger = ' + nice(s) + ' years,  Elder = ' + nice(b) + ' years',
            fmt(b) + (kM ? ' = ' + fmt(N(kM[1])) + ' × ' + fmt(s) + ' ✔' : ''));
    });

    /* 8. speed–distance–time (unit aware: km/h, m/s, miles, minutes…) */
    S('speed-time', null, function (m, t) {
        if (!/(km|kilomet|mile|met(?:er|re)|\bm\b|m\/s)/.test(t) || !/(hour|hr|min|sec|speed|distance|time|far|long|fast)/.test(t)) return null;
        if (/(average speed)/.test(t)) return null;                            // average-speed solver handles it
        var dM = t.match(new RegExp(NUM + '\\s*(km(?!\\s*(?:/|per|ph))|kilomet(?:er|re)s?|miles?|met(?:er|re)s?|m(?!\\s*/))\\b'));
        var sM = t.match(new RegExp(NUM + '\\s*(km\\s*/\\s*(?:h|hr|hour)(?:s|ph)?|km per hour|kmph|kilomet(?:er|re)s? per hour|miles? per hour|mph|m\\s*/\\s*s|m per second)'));
        var tM = t.match(new RegExp(NUM + '\\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\\b'));
        var have = (dM ? 1 : 0) + (sM ? 1 : 0) + (tM ? 1 : 0);
        if (have !== 2) return null;
        var isMS = sM && /m\s*\/\s*s|m per second/.test(sM[2]);
        var d = dM ? N(dM[1]) : null, du = dM ? dM[2].replace(/\s+/g, '') : '';
        var sp = sM ? N(sM[1]) : null;
        var tv = tM ? N(tM[1]) : null, tu = tM ? tM[2] : '';
        var lenU, timU, spU;
        if (isMS) {                                                             // work in metres & seconds
            lenU = 'm'; timU = 's'; spU = 'm/s';
            if (d !== null && /^k/.test(du)) d *= 1000;
            if (d !== null && /^mile/.test(du)) d *= 1609.34;
            if (tv !== null) { if (/^min/.test(tu)) tv *= 60; else if (/^h/.test(tu)) tv *= 3600; }
        } else {                                                                // work in km & hours
            lenU = 'km'; timU = 'hour'; spU = 'km/hour';
            if (d !== null) { if (/^m/.test(du)) d /= 1000; else if (/^mile/.test(du)) d *= 1.60934; }
            if (tv !== null) { if (/^min/.test(tu)) tv /= 60; else if (/^sec/.test(tu)) tv /= 3600; }
            if (sp !== null && /mph|miles? per hour/.test(sM[2])) sp *= 1.60934;
        }
        var steps = [], out;
        if (sp === null) {
            sp = d / tv;
            st(steps, 'Formula', 'Speed = Distance ÷ Time');
            st(steps, 'Substitute (converted to ' + lenU + ' & ' + timU + 's)', 'Speed = ' + fmt(d) + ' ÷ ' + fmt(tv) + ' = ' + fmt(sp) + ' ' + spU);
            out = R('Finding speed', 'distance = ' + fmt(d) + ' ' + lenU + ', time = ' + fmt(tv) + ' ' + timU, steps,
                'Speed = ' + nice(sp) + ' ' + spU, fmt(sp) + ' × ' + fmt(tv) + ' = ' + fmt(sp * tv) + ' ' + lenU + ' ✔');
        } else if (d === null) {
            d = sp * tv;
            st(steps, 'Formula', 'Distance = Speed × Time');
            st(steps, 'Substitute', 'Distance = ' + fmt(sp) + ' × ' + fmt(tv) + ' = ' + fmt(d) + ' ' + lenU);
            out = R('Finding distance', 'speed = ' + fmt(sp) + ' ' + spU + ', time = ' + fmt(tv) + ' ' + timU, steps,
                'Distance = ' + nice(d) + ' ' + lenU, fmt(d) + ' ÷ ' + fmt(tv) + ' = ' + fmt(d / tv) + ' ' + spU + ' ✔');
        } else {
            tv = d / sp;
            st(steps, 'Formula', 'Time = Distance ÷ Speed');
            st(steps, 'Substitute', 'Time = ' + fmt(d) + ' ÷ ' + fmt(sp) + ' = ' + fmt(tv) + ' ' + timU + (isMS ? 's' : 's'));
            var extra = '';
            if (!isMS && Math.abs(tv - Math.round(tv)) > 1e-9) {
                var h = Math.floor(tv), mn = Math.round((tv - h) * 60);
                extra = ' (= ' + h + ' h ' + mn + ' min)';
            }
            out = R('Finding time', 'distance = ' + fmt(d) + ' ' + lenU + ', speed = ' + fmt(sp) + ' ' + spU, steps,
                'Time = ' + nice(tv) + ' ' + timU + (isMS ? 's' : 's') + extra, fmt(sp) + ' × ' + fmt(tv) + ' = ' + fmt(sp * tv) + ' ' + lenU + ' ✔');
        }
        return out;
    });

    /* 9. work & time (+ pipes/tanks) */
    S('work-together', null, function (m, t) {
        if (!/together|both|all of them|simultaneously/.test(t)) return null;
        if (!/(work|job|task|tank|cistern|pool|fill|empty|piece)/.test(t)) return null;
        var dayNums = [], dm, re = new RegExp(NUM + '\\s*(days?|hours?|minutes?)\\b', 'g');
        while ((dm = re.exec(t)) !== null) dayNums.push({ v: N(dm[1]), u: dm[2], i: dm.index });
        if (dayNums.length < 2 || dayNums.length > 3) return null;
        if (dayNums.some(function (d) { return d.u !== dayNums[0].u; })) return null;
        var pipeMode = /(pipe|tap|inlet|outlet|cistern|tank|pool)/.test(t);
        var steps = [], unit = dayNums[0].u;
        var togetherFirst = /together[\s\S]{0,40}?(?:in|takes?|take|can|do|does|finish|complete)[\s\S]{0,20}?\d/.test(t) &&
            /together/.test(t.slice(Math.max(0, dayNums[0].i - 60), dayNums[0].i + 10));
        if (togetherFirst && dayNums.length >= 2) {                            // T together & A alone → find B
            var T = dayNums[0].v, A = dayNums[1].v;
            var rate = 1 / T - 1 / A;
            if (rate <= 0) return null;
            var B = 1 / rate;
            st(steps, 'A+B together — 1 ' + unit + "'s work", '1/' + fmt(T));
            st(steps, 'A alone — 1 ' + unit + "'s work", '1/' + fmt(A));
            st(steps, "B's 1 " + unit + " work = together − A", '1/' + fmt(T) + ' − 1/' + fmt(A) + ' = ' + fmt(rate) + ' = 1/' + fmt(B));
            return R('Work & time — find the missing worker', 'together = ' + fmt(T) + ' ' + unit + ', A alone = ' + fmt(A) + ' ' + unit, steps,
                'B alone takes ' + nice(B) + ' ' + unit, '1/' + fmt(A) + ' + 1/' + fmt(B) + ' = ' + fmt(1 / A + 1 / B) + ' = 1/' + fmt(T) + ' ✔');
        }
        var emptyI = pipeMode ? t.search(/(empties?|drains?|outlet|leak)/) : -1;
        var rates = dayNums.map(function (d, i) {
            var r = 1 / d.v;
            if (emptyI !== -1 && d.i > emptyI && i > 0) return -r;               // pipe after "empty" word drains
            return r;
        });
        var total = rates.reduce(function (a, b) { return a + b; }, 0);
        if (total <= 0) return null;
        dayNums.forEach(function (d, i) {
            st(steps, (pipeMode ? 'Part of tank in 1 ' : 'Work done in 1 ') + unit.replace(/s$/, ''),
                (rates[i] < 0 ? '−' : '') + '1/' + fmt(d.v) + (rates[i] < 0 ? '  (this one EMPTIES — negative rate)' : ''));
        });
        st(steps, 'Add the rates: ' + dayNums.map(function (d, i) { return (rates[i] < 0 ? '−' : '') + '1/' + fmt(d.v); }).join(' + '), '= ' + fmt(total));
        st(steps, 'Time together = 1 ÷ total rate', '= 1 ÷ ' + fmt(total) + ' = ' + fmt(1 / total) + ' ' + unit);
        var fr = fracStr(1 / total);
        return R('Work & time — working together', dayNums.map(function (d) { return fmt(d.v) + ' ' + d.u; }).join(', '), steps,
            'Together they take ' + (fr && fr.indexOf('/') !== -1 ? '**' + fr + '** = ' + fmt(1 / total) : '**' + fmt(1 / total) + '**') + ' ' + unit);
    });

    /* 10. unitary method — direct variation (cost/earn/consume) */
    S('unitary-cost', null, function (m, t) {
        if (!/(cost|price|earn|wage|charge|consume|litres?|liters?|fuel|\brs\b|rupees|pay)/.test(t)) return null;
        if (/(profit|loss|discount|gst|vat|interest|simple interest|compound)/.test(t)) return null;
        var all = allNums(t);
        if (all.length !== 3) return null;
        if (!/(find|what|how much|cost of|price of|\?)/.test(t)) return null;
        var between = t.slice(all[0].i, all[1].i);
        var q1, c1, q2 = all[2].v;
        if (/(costs?|for\b|is\b|are\b|=)/.test(between) && !/\bin\b/.test(between)) { q1 = all[0].v; c1 = all[1].v; }
        else { c1 = all[0].v; q1 = all[1].v; }
        if (q1 === 0) return null;
        var unitCost = c1 / q1, ans = unitCost * q2, steps = [];
        st(steps, 'Unitary method — value of ONE unit', c1 + ' ÷ ' + fmt(q1) + ' = ' + fmt(unitCost));
        st(steps, 'Multiply by the required quantity', fmt(q2) + ' × ' + fmt(unitCost) + ' = ' + fmt(ans));
        return R('Unitary method (direct variation)', fmt(q1) + ' units for ' + fmt(c1) + ', find for ' + fmt(q2), steps,
            'Answer = ' + nice(ans) + ' rupees', 'per-unit × count = ' + fmt(unitCost) + ' × ' + fmt(q2) + ' = ' + fmt(ans) + ' ✔');
    });

    /* 11. inverse variation — workers/days */
    S('inverse-workers', null, function (m, t) {
        var mm = t.match(new RegExp(NUM + '\\s*(men|man|workers?|labourers?|laborers?|people|boys|girls|students?|persons?|machines?|pumps?|cows|buffaloes?|workers)[\\s\\S]{0,60}?(?:in|takes?|took|finish|complete|can do|need)[\\s\\S]{0,30}?' + NUM + '\\s*(days?|hours?)[\\s\\S]{0,60}?' + NUM + '\\s*\\2'));
        if (!mm) return null;
        var x = N(mm[1]), y = N(mm[3]), z = N(mm[5]);
        if (z === 0) return null;
        var steps = [], ans = x * y / z;
        st(steps, 'Total work = workers × time (this product stays constant)', fmt(x) + ' × ' + fmt(y) + ' = ' + fmt(x * y) + ' worker-' + mm[4]);
        st(steps, 'Now with ' + fmt(z) + ' ' + mm[2] + ' → divide the constant by ' + fmt(z), fmt(x * y) + ' ÷ ' + fmt(z) + ' = ' + fmt(ans) + ' ' + mm[4]);
        return R('Inverse variation (more workers → less time)', fmt(x) + ' ' + mm[2] + ' → ' + fmt(y) + ' ' + mm[4] + '; now ' + fmt(z) + ' ' + mm[2], steps,
            fmt(z) + ' ' + mm[2] + ' will take ' + nice(ans) + ' ' + mm[4],
            fmt(z) + ' × ' + fmt(ans) + ' = ' + fmt(z * ans) + ' = same total work ✔');
    });

    /* 12. divide in a ratio */
    S('ratio-divide', null, function (m, t) {
        var mm = t.match(new RegExp('(?:divide|split|distributed?|shared?)\\s*(?:rs\\.?\\s*)?' + NUM + '[\\s\\S]{0,60}?ratio\\s*' + NUM + '\\s*:\\s*' + NUM + '(?:\\s*:\\s*' + NUM + ')?'));
        if (!mm) mm = t.match(new RegExp(NUM + '[\\s\\S]{0,40}?(?:divided|distributed|shared)[\\s\\S]{0,40}?ratio\\s*' + NUM + '\\s*:\\s*' + NUM + '(?:\\s*:\\s*' + NUM + ')?'));
        if (!mm) return null;
        var S1 = N(mm[1]), parts = [N(mm[2]), N(mm[3])];
        if (mm[4]) parts.push(N(mm[4]));
        var sum = parts.reduce(function (a, b) { return a + b; }, 0), steps = [];
        var one = S1 / sum;
        st(steps, 'Sum of the ratio parts', parts.join(' + ') + ' = ' + fmt(sum));
        st(steps, 'Value of one part', fmt(S1) + ' ÷ ' + fmt(sum) + ' = ' + fmt(one));
        st(steps, 'Each share', parts.map(function (p, i) { return 'Share ' + (i + 1) + ' = ' + fmt(p) + ' × ' + fmt(one) + ' = ' + fmt(p * one); }).join('   ·   '));
        var check = parts.map(function (p) { return fmt(p * one); }).join(' + ') + ' = ' + fmt(one * sum);
        return R('Division in a given ratio', 'amount = ' + fmt(S1) + ', ratio = ' + parts.join(':'), steps,
            'Shares = **' + parts.map(function (p) { return fmt(p * one); }).join(', ') + '**', check + ' ✔');
    });

    /* 13. percentage increase/decrease of a value */
    S('percent-change-value', new RegExp(NUM + ' is (increased|decreased) by\\s*' + NUM + '\\s*%'),
        function (m) {
            var A = N(m[1]), dir = m[2], p = N(m[3]), steps = [];
            var change = A * p / 100, nv = dir === 'increased' ? A + change : A - change;
            st(steps, 'Find ' + fmt(p) + '% of ' + fmt(A), fmt(A) + ' × ' + fmt(p) + '/100 = ' + fmt(change));
            st(steps, dir === 'increased' ? 'Add it' : 'Subtract it', fmt(A) + (dir === 'increased' ? ' + ' : ' − ') + fmt(change) + ' = ' + fmt(nv));
            return R('Percentage ' + (dir === 'increased' ? 'increase' : 'decrease'), 'value = ' + fmt(A) + ', change = ' + fmt(p) + '%', steps,
                'New value = ' + nice(nv));
        });

    /* 14. boys/girls percentage → total */
    S('percent-boys-girls', null, function (m, t) {
        var mm = t.match(new RegExp(NUM + '\\s*%[\\s\\S]{0,30}?(boys|girls|men|women|students)[\\s\\S]{0,60}?(boys|girls|men|women|students)[^.]*?(?:are|is|=|:)?\\s*' + NUM));
        if (!mm) return null;
        var p = N(mm[1]), pctOf = mm[2], cntOf = mm[3], cnt = N(mm[4]);
        if (pctOf === cntOf) return null;
        var fracOther = 1 - p / 100;
        if (fracOther <= 0) return null;
        var total = cnt / fracOther, steps = [];
        st(steps, 'If ' + fmt(p) + '% are ' + pctOf + ', then ' + fmt(100 - p) + '% are ' + cntOf, fmt(100 - p) + '% of total = ' + fmt(cnt));
        st(steps, 'Find the total', 'total = ' + fmt(cnt) + ' × 100/' + fmt(100 - p) + ' = ' + fmt(total));
        return R('Percentage → total count', fmt(p) + '% ' + pctOf + ', number of ' + cntOf + ' = ' + fmt(cnt), steps,
            'Total = ' + nice(total) + '  (' + pctOf + ' = ' + fmt(total * p / 100) + ', ' + cntOf + ' = ' + fmt(cnt) + ')',
            fmt(p) + '% of ' + fmt(total) + ' = ' + fmt(total * p / 100) + ' ✔');
    });

    /* 15. marks percentage */
    S('marks-percent', null, function (m, t) {
        var mm = t.match(new RegExp('(?:scored|got|obtained|secures?|makes?)\\s*' + NUM + '\\s*(?:marks?\\s*)?(?:out of|/|of)\\s*' + NUM)) ||
            t.match(new RegExp(NUM + '\\s*(?:marks?\\s*)?(?:out of|/)\\s*' + NUM + '\\s*(?:marks?|total)?'));
        if (!mm) return null;
        if (!/(percent|%|marks|score|exam|test|result)/.test(t)) return null;
        var O = N(mm[1]), T = N(mm[2]);
        if (T === 0 || O > T) return null;
        var steps = [], pc = O / T * 100;
        st(steps, 'Percentage = (marks obtained ÷ total marks) × 100', '(' + fmt(O) + ' ÷ ' + fmt(T) + ') × 100 = ' + fmt(pc) + '%');
        return R('Marks percentage', O + ' out of ' + T, steps, 'Percentage = ' + nice(pc) + '%');
    });

    /* 16. profit & loss (CP & SP both given) */
    S('profit-loss', null, function (m, t) {
        if (!/(cost price|\bcp\b|bought|purchased|buy|buys)/.test(t) || !/(selling price|\bsp\b|sold|sells|sell)/.test(t)) return null;
        if (/(profit|loss|gain) of\s*'?\s*\d+\s*%/.test(t)) return null;          // % variants handled below
        var cpM = t.match(new RegExp('(?:cost price|cp|bought|purchased|buys?)\\s*(?:of|for|is|=|:)?\\s*(?:rs\\.?\\s*)?' + NUM));
        var spM = t.match(new RegExp('(?:selling price|sp|sold|sells|sell)\\s*(?:for|at|is|=|:)?\\s*(?:rs\\.?\\s*)?' + NUM));
        if (!cpM || !spM) return null;
        var CP = N(cpM[1]), SP = N(spM[1]), steps = [];
        var diff = SP - CP, pc = Math.abs(diff) / CP * 100;
        st(steps, 'Compare SP with CP', 'SP − CP = ' + fmt(SP) + ' − ' + fmt(CP) + ' = ' + fmt(diff));
        st(steps, diff >= 0 ? 'SP > CP → PROFIT' : 'SP < CP → LOSS',
            (diff >= 0 ? 'Profit' : 'Loss') + ' % = (' + fmt(Math.abs(diff)) + ' ÷ ' + fmt(CP) + ') × 100 = ' + fmt(pc) + '%');
        return R(diff >= 0 ? 'Profit' : 'Loss', 'CP = ₹' + fmt(CP) + ', SP = ₹' + fmt(SP), steps,
            (diff >= 0 ? 'Profit' : 'Loss') + ' = ' + nice(Math.abs(diff)) + ' rupees  (' + fmt(pc) + '%)',
            'CP ' + (diff >= 0 ? '+' : '−') + ' ' + fmt(Math.abs(diff)) + ' = ' + fmt(CP + diff) + ' = SP ✔');
    });

    /* 17. SP from CP & profit/loss % */
    S('sp-from-profit', new RegExp('(?:cost price|cp|costing|costs|bought|purchased|buy|buys)[\\s\\S]{0,40}?(?:rs\\.?\\s*)?' + NUM + '[\\s\\S]*?(?:at a |at |with a |of )?(profit|loss|gain) of\\s*' + NUM + '\\s*%'),
        function (m) {
            var CP = N(m[1]), dir = m[2], p = N(m[3]);
            if (p >= 100 && dir === 'loss') return null;
            var steps = [], SP = dir === 'loss' ? CP * (1 - p / 100) : CP * (1 + p / 100);
            st(steps, 'Formula', 'SP = CP × (1 ' + (dir === 'loss' ? '−' : '+') + ' ' + fmt(p) + '/100)');
            st(steps, 'Substitute', 'SP = ' + fmt(CP) + ' × ' + fmt(dir === 'loss' ? 1 - p / 100 : 1 + p / 100) + ' = ' + fmt(SP));
            return R('SP from CP and ' + dir + ' %', 'CP = ₹' + fmt(CP) + ', ' + dir + ' = ' + fmt(p) + '%', steps,
                'Selling Price = ' + nice(SP) + ' rupees',
                (dir === 'loss' ? 'CP − loss' : 'CP + profit') + ' = ' + fmt(CP) + ' ' + (dir === 'loss' ? '−' : '+') + ' ' + fmt(Math.abs(CP * p / 100)) + ' = ' + fmt(SP) + ' ✔');
        });

    /* 18. CP from SP & profit/loss % */
    S('cp-from-sp', new RegExp('(?:selling price|sp|sold for|sold at|sells for|sells at)[\\s\\S]{0,40}?(?:rs\\.?\\s*)?' + NUM + '[\\s\\S]*?(?:at a |with a |of |a )?(profit|loss|gain) of\\s*' + NUM + '\\s*%'),
        function (m) {
            var SP = N(m[1]), dir = m[2], p = N(m[3]);
            if (p >= 100 && dir === 'loss') return null;
            var steps = [], CP = dir === 'loss' ? SP / (1 - p / 100) : SP / (1 + p / 100);
            st(steps, 'Formula', 'CP = SP ÷ (1 ' + (dir === 'loss' ? '−' : '+') + ' ' + fmt(p) + '/100)');
            st(steps, 'Substitute', 'CP = ' + fmt(SP) + ' ÷ ' + fmt(dir === 'loss' ? 1 - p / 100 : 1 + p / 100) + ' = ' + fmt(CP));
            return R('CP from SP and ' + dir + ' %', 'SP = ₹' + fmt(SP) + ', ' + dir + ' = ' + fmt(p) + '%', steps,
                'Cost Price = ' + nice(CP) + ' rupees',
                fmt(CP) + ' × ' + fmt(dir === 'loss' ? 1 - p / 100 : 1 + p / 100) + ' = ' + fmt(CP * (dir === 'loss' ? 1 - p / 100 : 1 + p / 100)) + ' = SP ✔');
        });

    /* 19. discount */
    S('discount-sp', new RegExp('(?:marked price|mp|list price|m p)[\\s\\S]{0,40}?(?:rs\\.?\\s*)?' + NUM + '[\\s\\S]*?discount of\\s*' + NUM + '\\s*%'),
        function (m) {
            var MP = N(m[1]), d = N(m[2]);
            if (d >= 100) return null;
            var steps = [], disc = MP * d / 100, SP = MP - disc;
            st(steps, 'Discount amount = MP × d%', fmt(MP) + ' × ' + fmt(d) + '/100 = ' + fmt(disc));
            st(steps, 'SP = MP − discount', fmt(MP) + ' − ' + fmt(disc) + ' = ' + fmt(SP));
            return R('Discount → Selling Price', 'MP = ₹' + fmt(MP) + ', discount = ' + fmt(d) + '%', steps,
                'Discount = ' + nice(disc) + ' rupees,  SP = ' + nice(SP) + ' rupees');
        });
    S('discount-mp', new RegExp('(?:sold for|selling price|sp|bought for|paid)[\\s\\S]{0,40}?(?:rs\\.?\\s*)?' + NUM + '[\\s\\S]*?(?:after )?(?:a )?discount of\\s*' + NUM + '\\s*%[\\s\\S]*?(?:marked price|mp|list price)'),
        function (m) {
            var SP = N(m[1]), d = N(m[2]);
            if (d >= 100) return null;
            var steps = [], MP = SP / (1 - d / 100);
            st(steps, 'SP = MP × (1 − d/100)  →  MP = SP ÷ (1 − d/100)', 'MP = ' + fmt(SP) + ' ÷ ' + fmt(1 - d / 100) + ' = ' + fmt(MP));
            return R('Find Marked Price', 'SP = ₹' + fmt(SP) + ', discount = ' + fmt(d) + '%', steps,
                'Marked Price = ' + nice(MP) + ' rupees', 'MP − ' + fmt(d) + '% = ' + fmt(MP - MP * d / 100) + ' = SP ✔');
        });

    /* 20. GST / VAT / sales tax */
    S('gst-total', new RegExp('(?:bill|amount|price|cost|value)[\\s\\S]{0,50}?(?:rs\\.?\\s*)?' + NUM + '[\\s\\S]*?(?:gst|vat|sales tax|tax) of\\s*' + NUM + '\\s*%'),
        function (m) {
            var A = N(m[1]), p = N(m[2]), steps = [];
            var tax = A * p / 100, tot = A + tax;
            st(steps, 'Tax amount = ' + fmt(p) + '% of ' + fmt(A), fmt(A) + ' × ' + fmt(p) + '/100 = ' + fmt(tax));
            st(steps, 'Total bill = amount + tax', fmt(A) + ' + ' + fmt(tax) + ' = ' + fmt(tot));
            return R('GST / VAT bill', 'amount = ₹' + fmt(A) + ', tax = ' + fmt(p) + '%', steps,
                'Tax = ' + nice(tax) + ' rupees,  Total = ' + nice(tot) + ' rupees');
        });
    S('gst-included', new RegExp('including[\\s\\S]{0,30}?' + NUM + '\\s*%\\s*(?:gst|vat|tax)[\\s\\S]{0,40}?(?:is|was|=|of)\\s*(?:rs\\.?\\s*)?' + NUM),
        function (m) {
            var p = N(m[1]), T = N(m[2]), steps = [];
            var base = T / (1 + p / 100), tax = T - base;
            st(steps, 'Total includes ' + fmt(p) + '% tax  →  base = Total ÷ (1 + p/100)', 'base = ' + fmt(T) + ' ÷ ' + fmt(1 + p / 100) + ' = ' + fmt(base));
            st(steps, 'Tax = Total − base', fmt(T) + ' − ' + fmt(base) + ' = ' + fmt(tax));
            return R('Reverse GST (tax included)', 'total = ₹' + fmt(T) + ' incl. ' + fmt(p) + '% tax', steps,
                'Base amount = ' + nice(base) + ' rupees,  Tax = ' + nice(tax) + ' rupees',
                fmt(base) + ' + ' + fmt(p) + '% of ' + fmt(base) + ' = ' + fmt(base * (1 + p / 100)) + ' ✔');
        });

    /* 21–22. simple & compound interest */
    S('simple-interest', null, function (m, t) {
        if (!/(simple interest|\bs ?i\b)/.test(t) || /compound/.test(t)) return null;
        return interestSolve(t, false);
    });
    S('compound-interest', null, function (m, t) {
        if (!/(compound interest|\bc ?i\b|compounded)/.test(t)) return null;
        return interestSolve(t, true);
    });
    function interestSolve(t, compound) {
        var pM = t.match(new RegExp('(?:principal|sum|invest(?:ed)?|deposited?|lent|borrowed|p\\s*=)[^.]*?(?:of|is|=|:)?\\s*(?:rs\\.?\\s*)?' + NUM)) ||
            t.match(new RegExp('rs\\.?\\s*' + NUM + '[\\s\\S]{0,30}?(?:at|for)')) ||
            t.match(new RegExp(NUM));
        var rM = t.match(new RegExp(NUM + '\\s*%'));
        var tM = t.match(new RegExp(NUM + '\\s*(years?|yrs?|months?)'));
        if (!pM || !rM || !tM) return null;
        var P = N(pM[1]), Rr = N(rM[1]), T = N(tM[1]), unit = tM[2];
        if (/^month/.test(unit)) T = T / 12;
        if (P === Rr || P === T) return null;                                   // grabbed the same number twice
        var steps = [], A, I;
        var freq = /half[\s-]?yearly/.test(t) ? 2 : /quarterly/.test(t) ? 4 : 1;
        if (!compound) {
            I = P * Rr * T / 100; A = P + I;
            st(steps, 'Formula  SI = P × R × T ÷ 100', 'SI = ' + fmt(P) + ' × ' + fmt(Rr) + ' × ' + fmt(T) + ' ÷ 100 = ' + fmt(I));
            st(steps, 'Amount = P + SI', 'A = ' + fmt(P) + ' + ' + fmt(I) + ' = ' + fmt(A));
            return R('Simple Interest', 'P = ₹' + fmt(P) + ', R = ' + fmt(Rr) + '% p.a., T = ' + fmt(T) + ' yr', steps,
                'SI = ' + nice(I) + ' rupees,  Amount = ' + nice(A) + ' rupees');
        }
        var label = freq === 2 ? 'half-yearly' : freq === 4 ? 'quarterly' : 'annually';
        var Rf = Rr / freq, nf = freq * T;
        if (nf > 40) return null;
        A = P * Math.pow(1 + Rf / 100, nf); I = A - P;
        st(steps, 'Compounded ' + label + ': rate per period = ' + fmt(Rr) + ' ÷ ' + freq + ' = ' + fmt(Rf) + '%, number of periods = ' + fmt(T) + ' × ' + freq + ' = ' + fmt(nf), 'A = P(1 + R/100)^n');
        st(steps, 'Substitute', 'A = ' + fmt(P) + ' × (1 + ' + fmt(Rf) + '/100)^' + fmt(nf) + ' = ' + fmt(P) + ' × ' + fmt(Math.pow(1 + Rf / 100, nf)) + ' = ' + fmt(A));
        st(steps, 'CI = A − P', 'CI = ' + fmt(A) + ' − ' + fmt(P) + ' = ' + fmt(I));
        if (nf <= 8 && freq === 1) {
            var run = P, tbl = [];
            for (var y = 1; y <= nf; y++) { run += run * Rf / 100; tbl.push('End of yr ' + y + ': A = ' + fmt(run)); }
            st(steps, 'Year by year (interest earns interest — that is the whole point of CI!)', tbl.join('   ·   '));
        }
        var si = P * Rr * T / 100;
        return R('Compound Interest (' + label + ')', 'P = ₹' + fmt(P) + ', R = ' + fmt(Rr) + '% p.a., T = ' + fmt(T) + ' yr', steps,
            'Amount = ' + nice(A) + ' rupees,  CI = ' + nice(I) + ' rupees',
            'CI − SI = ' + fmt(I - si) + ' (CI ≥ SI whenever T > 1 — interest on interest!) ✔');
    }

    /* 23. population growth / depreciation */
    S('population', new RegExp('(?:population|value|price|worth)[\\s\\S]{0,50}?' + NUM + '[\\s\\S]*?(?:grows|increases|rises|decreases|declines|depreciates|falls)[\\s\\S]{0,30}?' + NUM + '\\s*%[\\s\\S]*?(?:after|in|for)\\s*' + NUM + '\\s*(?:years?|yrs?)'),
        function (m) {
            var P = N(m[1]), r = N(m[2]), n = N(m[3]);
            if (n > 50) return null;
            var steps = [], down = /(decreas|declin|depreciat|fall)/.test(m[0]);
            var A = P * Math.pow(1 + (down ? -r : r) / 100, n);
            st(steps, 'Formula  A = P(1 ' + (down ? '−' : '+') + ' R/100)ⁿ', 'A = ' + fmt(P) + ' × (1 ' + (down ? '−' : '+') + ' ' + fmt(r) + '/100)^' + fmt(n));
            st(steps, 'Compute', 'A = ' + fmt(P) + ' × ' + fmt(Math.pow(1 + (down ? -r : r) / 100, n)) + ' = ' + fmt(A));
            return R(down ? 'Depreciation' : 'Population growth', 'P = ' + fmt(P) + ', R = ' + fmt(r) + '%/yr, n = ' + fmt(n) + ' yrs', steps,
                'After ' + fmt(n) + ' years = ' + nice(Math.round(A)) + (down ? ' (loss of ' + fmt(Math.round(P - A)) + ')' : ' (increase of ' + fmt(Math.round(A - P)) + ')'));
        });

    /* 24. 2-D mensuration (flexible word order) */
    S('rect-per-diff', new RegExp('perimeter of (?:a |the )?rectangle is\\s*' + NUM + '[\\s\\S]*?length is\\s*' + NUM + '[\\s\\S]*?(?:more than|greater than)[\\s\\S]{0,20}?(?:breadth|width)'),
        function (m) {
            var P = N(m[1]), k = N(m[2]), steps = [];
            var b = (P / 2 - k) / 2, l = b + k;
            if (b <= 0) return null;
            st(steps, 'Let breadth = b, so length = b + ' + fmt(k), 'P = 2(l + b) = 2(b + ' + fmt(k) + ' + b) = ' + fmt(P));
            st(steps, 'Solve for b', '4b = ' + fmt(P) + ' − ' + fmt(2 * k) + ' = ' + fmt(P - 2 * k) + '  →  b = ' + fmt(b) + ',  l = ' + fmt(l));
            return R('Rectangle — dimensions from perimeter', 'P = ' + fmt(P) + ', length is ' + fmt(k) + ' more than breadth', steps,
                'Breadth = ' + nice(b) + ',  Length = ' + nice(l) + ',  Area = ' + nice(l * b),
                '2(' + fmt(l) + ' + ' + fmt(b) + ') = ' + fmt(2 * (l + b)) + ' = P ✔');
        });
    S('rect-perimeter-side', null, function (m, t) {
        {
            if (!/rectangle/.test(t)) return null;
            if (/(?:more than|greater than)/.test(t)) return null;                 // rect-per-diff's job
            var pm = t.match(new RegExp('perimeter[^.]{0,25}?(?:is|hai|=|:)\\s*' + NUM)) || t.match(new RegExp('perimeter[^.]{0,8}?' + NUM));
            var lm = t.match(new RegExp('length[^.]{0,30}?' + NUM));
            if (!pm || !lm) return null;
            var P = N(pm[1]), l = N(lm[1]);
            if (l >= P / 2) return null;
            var steps = [], b = P / 2 - l;
            st(steps, 'P = 2(l + b)  →  l + b = P ÷ 2', 'l + b = ' + fmt(P) + ' ÷ 2 = ' + fmt(P / 2));
            st(steps, 'b = P/2 − l', 'b = ' + fmt(P / 2) + ' − ' + fmt(l) + ' = ' + fmt(b));
            return R('Rectangle — breadth from perimeter', 'P = ' + fmt(P) + ', length = ' + fmt(l), steps,
                'Breadth = ' + nice(b) + ',  Area = ' + nice(l * b), '2(' + fmt(l) + ' + ' + fmt(b) + ') = ' + fmt(P) + ' ✔');
        }
    });
    S('rectangle-lb', null, function (m, t) {
        if (!/rectangle/.test(t)) return null;
        if (new RegExp('perimeter[^.]{0,25}?is\\s*' + NUM).test(t)) return null;    // perimeter-given variants above
        var lm = t.match(new RegExp('length[^.]{0,30}?' + NUM)), bm = t.match(new RegExp('(?:breadth|width|breath)[^.]{0,30}?' + NUM));
        if (!lm || !bm) return null;
        var l = N(lm[1]), b = N(bm[1]), area = l * b, per = 2 * (l + b), steps = [];
        st(steps, 'Area = length × breadth', 'A = ' + fmt(l) + ' × ' + fmt(b) + ' = ' + fmt(area));
        st(steps, 'Perimeter = 2 × (length + breadth)', 'P = 2 × (' + fmt(l) + ' + ' + fmt(b) + ') = ' + fmt(per));
        var wantP = /perimeter/.test(t), wantA = /area/.test(t);
        var ans = wantP && !wantA ? 'Perimeter = ' + nice(per) : wantA && !wantP ? 'Area = ' + nice(area) :
            'Area = ' + nice(area) + ',  Perimeter = ' + nice(per);
        return R('Rectangle — area & perimeter', 'length = ' + fmt(l) + ', breadth = ' + fmt(b), steps, ans);
    });
    S('square-side', null, function (m, t) {
        if (!/square/.test(t) || /(root|perfect|cubic|metre|meter)/.test(t)) return null;
        var sm = t.match(new RegExp('(?:side|edge)[^.]{0,25}?' + NUM));
        if (!sm) return null;
        var s = N(sm[1]), steps = [];
        st(steps, 'Area = side × side', 'A = ' + fmt(s) + '² = ' + fmt(s * s));
        st(steps, 'Perimeter = 4 × side', 'P = 4 × ' + fmt(s) + ' = ' + fmt(4 * s));
        var wantP = /perimeter/.test(t), wantA = /area/.test(t);
        var ans = wantP && !wantA ? 'Perimeter = ' + nice(4 * s) : wantA && !wantP ? 'Area = ' + nice(s * s) :
            'Area = ' + nice(s * s) + ',  Perimeter = ' + nice(4 * s);
        return R('Square — area & perimeter', 'side = ' + fmt(s), steps, ans);
    });
    S('square-area', new RegExp('area of (?:a |the )?square is\\s*' + NUM),
        function (m) {
            var A = N(m[1]); if (A < 0) return null;
            var s = Math.sqrt(A), steps = [];
            st(steps, 'side = √area', 's = √' + fmt(A) + ' = ' + fmt(s));
            st(steps, 'Perimeter = 4 × side', 'P = 4 × ' + fmt(s) + ' = ' + fmt(4 * s));
            return R('Square — side from area', 'area = ' + fmt(A), steps,
                'Side = ' + nice(s) + ',  Perimeter = ' + nice(4 * s), fmt(s) + ' × ' + fmt(s) + ' = ' + fmt(s * s) + ' ✔');
        });
    S('triangle-bh', null, function (m, t) {
        if (!/(triangle|triangular)/.test(t) || /right (?:angled )?triangle|pythagor|hypotenuse/.test(t)) return null;
        var bm = t.match(new RegExp('base[^.]{0,25}?' + NUM)), hm = t.match(new RegExp('(?:height|altitude)[^.]{0,25}?' + NUM));
        if (!bm || !hm) return null;
        var b = N(bm[1]), h = N(hm[1]), steps = [];
        st(steps, 'Area = ½ × base × height', 'A = ½ × ' + fmt(b) + ' × ' + fmt(h) + ' = ' + fmt(b * h) + ' ÷ 2 = ' + fmt(b * h / 2));
        return R('Triangle — area', 'base = ' + fmt(b) + ', height = ' + fmt(h), steps, 'Area = ' + nice(b * h / 2));
    });
    S('trapezium', null, function (m, t) {
        if (!/trapezium|trapezoid/.test(t)) return null;
        var pm = t.match(new RegExp('parallel sides[^.]{0,25}?' + NUM + '[^.]{0,10}?(?:and|,)[^.]{0,10}?' + NUM));
        var hm = t.match(new RegExp('(?:height|distance between)[^.]{0,25}?' + NUM));
        if (!pm || !hm) return null;
        var a = N(pm[1]), b = N(pm[2]), h = N(hm[1]), steps = [];
        st(steps, 'Area = ½ × (sum of parallel sides) × height', 'A = ½ × (' + fmt(a) + ' + ' + fmt(b) + ') × ' + fmt(h));
        st(steps, 'Compute', 'A = ½ × ' + fmt(a + b) + ' × ' + fmt(h) + ' = ' + fmt((a + b) * h / 2));
        return R('Trapezium — area', 'parallel sides = ' + fmt(a) + ' & ' + fmt(b) + ', height = ' + fmt(h), steps,
            'Area = ' + nice((a + b) * h / 2));
    });
    S('rhombus-diag', null, function (m, t) {
        if (!/rhombus/.test(t)) return null;
        var dm = t.match(new RegExp('diagonals?[^.]{0,25}?' + NUM + '[^.]{0,10}?(?:and|,)[^.]{0,10}?' + NUM));
        var sm = t.match(new RegExp('side[^.]{0,25}?' + NUM));
        var steps = [];
        if (dm) {
            var d1 = N(dm[1]), d2 = N(dm[2]);
            st(steps, 'Area = ½ × d₁ × d₂', 'A = ½ × ' + fmt(d1) + ' × ' + fmt(d2) + ' = ' + fmt(d1 * d2 / 2));
            return R('Rhombus — area from diagonals', 'd₁ = ' + fmt(d1) + ', d₂ = ' + fmt(d2), steps, 'Area = ' + nice(d1 * d2 / 2));
        }
        if (sm) {
            var s = N(sm[1]);
            st(steps, 'Perimeter = 4 × side (all sides of a rhombus are equal)', 'P = 4 × ' + fmt(s) + ' = ' + fmt(4 * s));
            return R('Rhombus — perimeter', 'side = ' + fmt(s), steps, 'Perimeter = ' + nice(4 * s));
        }
        return null;
    });
    S('parallelogram', null, function (m, t) {
        if (!/parallelogram/.test(t)) return null;
        var bm = t.match(new RegExp('base[^.]{0,25}?' + NUM)), hm = t.match(new RegExp('(?:height|altitude)[^.]{0,25}?' + NUM));
        if (!bm || !hm) return null;
        var b = N(bm[1]), h = N(hm[1]), steps = [];
        st(steps, 'Area = base × height', 'A = ' + fmt(b) + ' × ' + fmt(h) + ' = ' + fmt(b * h));
        return R('Parallelogram — area', 'base = ' + fmt(b) + ', height = ' + fmt(h), steps, 'Area = ' + nice(b * h));
    });
    S('circle', null, function (m, t) {
        if (!/(circle|circular)/.test(t)) return null;
        var rm = t.match(new RegExp('(radius|diameter)[^.]{0,25}?' + NUM));
        if (!rm) return null;
        var r = rm[1] === 'diameter' ? N(rm[2]) / 2 : N(rm[2]), steps = [];
        var P = PI_FOR(r);
        st(steps, 'Take π = ' + P.s + (rm[1] === 'diameter' ? '  (radius = diameter ÷ 2 = ' + fmt(r) + ')' : ''), '');
        st(steps, 'Circumference = 2πr', 'C = 2 × ' + P.s + ' × ' + fmt(r) + ' = ' + fmt(2 * P.v * r));
        st(steps, 'Area = πr²', 'A = ' + P.s + ' × ' + fmt(r) + '² = ' + P.s + ' × ' + fmt(r * r) + ' = ' + fmt(P.v * r * r));
        var wantC = /circumference|perimeter/.test(t), wantA = /area/.test(t);
        var ans = wantC && !wantA ? 'Circumference = ' + nice(2 * P.v * r) : wantA && !wantC ? 'Area = ' + nice(P.v * r * r) :
            'Circumference = ' + nice(2 * P.v * r) + ',  Area = ' + nice(P.v * r * r);
        return R('Circle — circumference & area', 'radius = ' + fmt(r) + ', π = ' + P.s, steps, ans);
    });

    /* 25. Pythagoras */
    S('pythagoras-legs', new RegExp('(?:legs|sides)[^.]{0,40}?' + NUM + '[^.]{0,10}?(?:and|,)[^.]{0,10}?' + NUM + '[\\s\\S]*?hypotenuse'),
        function (m) {
            var a = N(m[1]), b = N(m[2]), steps = [];
            var h = Math.sqrt(a * a + b * b);
            st(steps, 'Pythagoras theorem  h² = a² + b²', 'h² = ' + fmt(a) + '² + ' + fmt(b) + '² = ' + fmt(a * a) + ' + ' + fmt(b * b) + ' = ' + fmt(a * a + b * b));
            st(steps, 'Take the square root', 'h = √' + fmt(a * a + b * b) + ' = ' + fmt(h));
            return R('Pythagoras theorem', 'legs = ' + fmt(a) + ' & ' + fmt(b), steps, 'Hypotenuse = ' + nice(h),
                fmt(a) + '² + ' + fmt(b) + '² = ' + fmt(h * h) + ' = h² ✔');
        });
    S('pythagoras-hyp', new RegExp('hypotenuse[^.]{0,30}?' + NUM + '[\\s\\S]*?(?:one )?(?:leg|side)[^.]{0,30}?' + NUM),
        function (m) {
            var h = N(m[1]), a = N(m[2]); if (a >= h) return null;
            var b = Math.sqrt(h * h - a * a), steps = [];
            st(steps, 'b² = h² − a²', 'b² = ' + fmt(h) + '² − ' + fmt(a) + '² = ' + fmt(h * h) + ' − ' + fmt(a * a) + ' = ' + fmt(h * h - a * a));
            st(steps, 'Take the square root', 'b = √' + fmt(h * h - a * a) + ' = ' + fmt(b));
            return R('Pythagoras theorem', 'hypotenuse = ' + fmt(h) + ', one leg = ' + fmt(a), steps,
                'Other leg = ' + nice(b), fmt(a) + '² + ' + fmt(b) + '² = ' + fmt(h) + '² ✔');
        });
    S('ladder', null, function (m, t) {
        if (!/ladder/.test(t)) return null;
        var seg = t.slice(Math.max(0, t.indexOf('ladder') - 20));
        var all = allNums(seg).filter(function (x) { return x.v > 0; });
        if (all.length < 2) return null;
        var L = Math.max(all[0].v, all[1].v), D = Math.min(all[0].v, all[1].v);
        if (D >= L) return null;
        var H = Math.sqrt(L * L - D * D), steps = [];
        st(steps, 'The ladder, the wall and the ground form a right-angled triangle', 'ladder = hypotenuse');
        st(steps, 'height = √(ladder² − distance²)', 'height = √(' + fmt(L) + '² − ' + fmt(D) + '²) = √' + fmt(L * L - D * D) + ' = ' + fmt(H));
        return R('Ladder problem (Pythagoras)', 'ladder = ' + fmt(L) + ', foot distance = ' + fmt(D), steps,
            'Height reached on the wall = ' + nice(H), fmt(D) + '² + ' + fmt(H) + '² = ' + fmt(L * L) + ' = ' + fmt(L) + '² ✔');
    });

    /* 26. polygon angles */
    S('polygon-angles', null, function (m, t) {
        if (!/(polygon|triangle|quadrilateral|pentagon|hexagon|heptagon|octagon|nonagon|decagon|dodecagon)/.test(t)) return null;
        if (/right angled triangle|right triangle|pythagor|hypotenuse|area|perimeter of/.test(t)) return null;
        var mm = t.match(new RegExp('(interior|exterior) angle[\\s\\S]{0,25}?is\\s*' + NUM + '\\s*(?:°|degrees?)?[\\s\\S]{0,40}?(?:number of )?sides'));
        if (mm) {
            var ang = N(mm[2]), steps = [], n;
            if (mm[1] === 'exterior') { n = 360 / ang; st(steps, 'Sum of exterior angles = 360° and each exterior angle = 360°/n', 'n = 360 ÷ ' + fmt(ang) + ' = ' + fmt(n)); }
            else { n = 360 / (180 - ang); st(steps, 'Each interior angle = 180° − 360°/n', fmt(ang) + ' = 180 − 360/n  →  360/n = ' + fmt(180 - ang) + '  →  n = ' + fmt(n)); }
            if (Math.abs(n - Math.round(n)) > 1e-9 || n < 3) return null;
            return R('Polygon — sides from angle', 'each ' + mm[1] + ' angle = ' + fmt(ang) + '°', steps,
                'Number of sides = ' + nice(n), 'check: 360 ÷ ' + n + ' = ' + fmt(360 / n) + '° ✔');
        }
        var n = shapeSides(t);
        if (!n || n < 3) return null;
        var steps2 = [], parts = [];
        var sumI = (n - 2) * 180, eachE = 360 / n, eachI = sumI / n, diag = n * (n - 3) / 2;
        if (/sum of (?:all )?(?:the )?interior angles/.test(t)) {
            st(steps2, 'Sum of interior angles = (n − 2) × 180°', '(' + n + ' − 2) × 180 = ' + (n - 2) + ' × 180 = ' + sumI + '°');
            parts.push('Sum of interior angles = **' + sumI + '°**');
        }
        if (/exterior angle/.test(t)) {
            st(steps2, 'Each exterior angle = 360° ÷ n  (their sum is ALWAYS 360°)', '360 ÷ ' + n + ' = ' + fmt(eachE) + '°');
            parts.push('Each exterior angle = **' + fmt(eachE) + '°**');
        }
        if (/each interior angle|interior angle of a regular|interior angle of the polygon/.test(t)) {
            st(steps2, 'Each interior angle = (n − 2) × 180° ÷ n', sumI + ' ÷ ' + n + ' = ' + fmt(eachI) + '°');
            parts.push('Each interior angle = **' + fmt(eachI) + '°**');
        }
        if (/diagonals?/.test(t)) {
            st(steps2, 'Number of diagonals = n(n − 3) ÷ 2', n + '(' + n + ' − 3) ÷ 2 = ' + n + ' × ' + (n - 3) + ' ÷ 2 = ' + fmt(diag));
            parts.push('Number of diagonals = **' + fmt(diag) + '**');
        }
        if (!parts.length) {
            st(steps2, 'Sum of interior angles = (n − 2) × 180°', '(' + n + ' − 2) × 180 = ' + sumI + '°');
            st(steps2, 'Each exterior angle = 360° ÷ n', '360 ÷ ' + n + ' = ' + fmt(eachE) + '°');
            parts.push('Sum of interior angles = **' + sumI + '°**', 'Each exterior angle = **' + fmt(eachE) + '°**');
        }
        return R('Polygon angle properties', n + '-sided polygon', steps2, parts.join(',   '));
    });

    /* 27. 3-D mensuration */
    S('cube-side', null, function (m, t) {
        if (!/cube/.test(t) || /cuboid|root|perfect/.test(t)) return null;
        var sm = t.match(new RegExp('(?:side|edge)[^.]{0,25}?' + NUM));
        if (!sm) return null;
        var s = N(sm[1]), steps = [];
        var V = s * s * s, TSA = 6 * s * s, LSA = 4 * s * s;
        st(steps, 'Volume = side³', 'V = ' + fmt(s) + '³ = ' + fmt(V));
        st(steps, 'Total surface area = 6 × side²', 'TSA = 6 × ' + fmt(s) + '² = 6 × ' + fmt(s * s) + ' = ' + fmt(TSA));
        var wantV = /volume/.test(t), wantT = /total surface|tsa/.test(t), wantL = /lateral|curved|lsa|csa/.test(t);
        var ans = [];
        if (wantV || !(wantT || wantL)) ans.push('Volume = ' + nice(V));
        if (wantT || !(wantV || wantL)) ans.push('TSA = ' + nice(TSA));
        if (wantL) ans.push('LSA = ' + nice(LSA));
        return R('Cube — volume & surface area', 'side = ' + fmt(s), steps, ans.join(',   '));
    });
    S('cuboid', null, function (m, t) {
        if (!/(cuboid|rectangular (?:box|prism|solid|tank)|brick|carton|book\b|matchbox)/.test(t)) return null;
        var lm = t.match(new RegExp('length[^.]{0,25}?' + NUM)), bm = t.match(new RegExp('(?:breadth|width)[^.]{0,25}?' + NUM)), hm = t.match(new RegExp('(?:height|depth|thick)[^.]{0,25}?' + NUM));
        if (!lm || !bm || !hm) return null;
        var l = N(lm[1]), b = N(bm[1]), h = N(hm[1]), steps = [];
        var V = l * b * h, TSA = 2 * (l * b + b * h + h * l), CSA = 2 * h * (l + b);
        st(steps, 'Volume = l × b × h', 'V = ' + fmt(l) + ' × ' + fmt(b) + ' × ' + fmt(h) + ' = ' + fmt(V));
        st(steps, 'TSA = 2(lb + bh + hl)', 'TSA = 2(' + fmt(l * b) + ' + ' + fmt(b * h) + ' + ' + fmt(h * l) + ') = 2 × ' + fmt(l * b + b * h + h * l) + ' = ' + fmt(TSA));
        st(steps, 'CSA (lateral) = 2h(l + b)', 'CSA = 2 × ' + fmt(h) + ' × (' + fmt(l) + ' + ' + fmt(b) + ') = ' + fmt(CSA));
        var wantV = /volume|capacity|hold|water|fill/.test(t), wantT = /total surface|tsa/.test(t), wantC = /lateral|curved|csa|lsa|four walls|plaster|paint/.test(t);
        var ans = [];
        if (wantV || !(wantT || wantC)) ans.push('Volume = ' + nice(V));
        if (wantT || !(wantV || wantC)) ans.push('TSA = ' + nice(TSA));
        if (wantC) ans.push('CSA = ' + nice(CSA));
        return R('Cuboid — volume & surface area', 'l = ' + fmt(l) + ', b = ' + fmt(b) + ', h = ' + fmt(h), steps, ans.join(',   '));
    });
    S('cylinder', null, function (m, t) {
        if (!/(cylinder|cylindrical|well|pipe|tube|glass|vessel|drum|can\b|pillar|column)/.test(t)) return null;
        var rm = t.match(new RegExp('(radius|diameter)[^.]{0,25}?' + NUM)), hm = t.match(new RegExp('(?:height|length|deep|depth)[^.]{0,25}?' + NUM));
        if (!rm || !hm) return null;
        var r = rm[1] === 'diameter' ? N(rm[2]) / 2 : N(rm[2]), h = N(hm[1]), steps = [];
        var P = PI_FOR(r, h);
        var V = P.v * r * r * h, CSA = 2 * P.v * r * h, TSA = 2 * P.v * r * (r + h);
        st(steps, 'Take π = ' + P.s + (rm[1] === 'diameter' ? '  (r = d/2 = ' + fmt(r) + ')' : ''), '');
        st(steps, 'Volume = πr²h', 'V = ' + P.s + ' × ' + fmt(r) + '² × ' + fmt(h) + ' = ' + fmt(V));
        st(steps, 'Curved surface = 2πrh', 'CSA = 2 × ' + P.s + ' × ' + fmt(r) + ' × ' + fmt(h) + ' = ' + fmt(CSA));
        st(steps, 'Total surface = 2πr(r + h)', 'TSA = 2 × ' + P.s + ' × ' + fmt(r) + ' × (' + fmt(r) + ' + ' + fmt(h) + ') = ' + fmt(TSA));
        var wantV = /volume|capacity|hold|water|fill/.test(t), wantC = /curved|lateral|csa|lsa/.test(t), wantT = /total surface|tsa/.test(t);
        var ans = [];
        if (wantV || !(wantC || wantT)) ans.push('Volume = ' + nice(V));
        if (wantC || !(wantV || wantT)) ans.push('Curved SA = ' + nice(CSA));
        if (wantT || !(wantV || wantC)) ans.push('Total SA = ' + nice(TSA));
        return R('Cylinder — volume & surface area', 'r = ' + fmt(r) + ', h = ' + fmt(h) + ', π = ' + P.s, steps, ans.join(',   '));
    });

    /* 28. perfect square / cube completion */
    S('perfect-complete', null, function (m, t) {
        var mm = t.match(new RegExp('(?:smallest|least)[\\s\\S]{0,60}?' + NUM + '[\\s\\S]*?perfect (square|cube)'));
        if (!mm) return null;
        var divide = /(divided|divide)/.test(t), multiply = /(multiplied|multiply)/.test(t);
        if (!divide && !multiply) return null;
        if (divide && multiply) return null;
        var Nn = Math.round(N(mm[1])), want = mm[2], g = want === 'cube' ? 3 : 2;
        if (Nn < 2 || Nn > 1e9) return null;
        var fac = factorise(Nn), need = 1, steps = [];
        st(steps, 'Prime factorise ' + Nn, Nn + ' = ' + facStr(Nn));
        fac.forEach(function (pe) {
            var p = pe[0], e = pe[1], rem = e % g;
            if (divide) { if (rem) need *= Math.pow(p, rem); }
            else { if (rem) need *= Math.pow(p, g - rem); }
        });
        if (divide) st(steps, 'For a perfect ' + want + ' every prime needs a complete group of ' + g + ' — leftover copies must be REMOVED', 'divide by ' + need);
        else st(steps, 'For a perfect ' + want + ' every prime needs a complete group of ' + g + ' — missing copies must be MULTIPLIED', 'multiply by ' + need);
        var res = divide ? Nn / need : Nn * need;
        if (need === 1) return R('Already a perfect ' + want, 'N = ' + Nn, steps, '✅ Nothing to do — ' + Nn + ' is already a perfect ' + want + '!');
        st(steps, 'Result', (divide ? Nn + ' ÷ ' + need : Nn + ' × ' + need) + ' = ' + res + (want === 'cube' ? ' = ' + fmt(Math.round(Math.pow(res, 1 / 3))) + '³' : ' = ' + fmt(Math.round(Math.sqrt(res))) + '²'));
        return R('Make a perfect ' + want, 'N = ' + Nn, steps,
            (divide ? 'Divide by ' : 'Multiply by ') + '**' + need + '** → ' + fmt(res) + ' is a perfect ' + want +
            (want === 'cube' ? ' (cube root = ' + fmt(Math.round(Math.pow(res, 1 / 3))) + ')' : ' (square root = ' + fmt(Math.round(Math.sqrt(res))) + ')'));
    });
    S('is-perfect', new RegExp('is\\s*' + NUM + '\\s*(?:a )?perfect (square|cube)'),
        function (m) {
            var n = Math.round(N(m[1])), want = m[2], steps = [];
            st(steps, 'Prime factorise', n + ' = ' + facStr(n));
            var g = want === 'cube' ? 3 : 2;
            var ok = n >= 1 && factorise(n).every(function (pe) { return pe[1] % g === 0; });
            st(steps, "Check every prime's exponent is a multiple of " + g, ok ? 'yes — all groups are complete' : 'no — a group is incomplete');
            return R('Is it a perfect ' + want + '?', 'N = ' + n, steps,
                ok ? '✅ **YES** — ' + n + ' is a perfect ' + want + (want === 'cube' ? ' (' + fmt(Math.round(Math.pow(n, 1 / 3))) + '³)' : ' (' + fmt(Math.round(Math.sqrt(n))) + '²)')
                    : '❌ **NO** — ' + n + ' is not a perfect ' + want);
        });

    /* 29. square/cube root by prime factorisation */
    S('root-by-factors', null, function (m, t) {
        var mm = t.match(new RegExp('(square|cube) root of\\s*' + NUM + '[\\s\\S]*?(?:prime )?factori[sz]ation'));
        if (!mm) return null;
        var want = mm[1], n = Math.round(N(mm[2])), g = want === 'cube' ? 3 : 2;
        if (n < 1) return null;
        var fac = factorise(n), steps = [], groups = [];
        st(steps, 'Prime factorise ' + n, n + ' = ' + facStr(n));
        fac.forEach(function (pe) {
            for (var k = 0; k < Math.floor(pe[1] / g); k++) groups.push(pe[0]);
        });
        var leftover = fac.filter(function (pe) { return pe[1] % g !== 0; });
        if (leftover.length) return R('Root by prime factorisation', 'N = ' + n, steps,
            '❌ ' + n + ' is NOT a perfect ' + want + ' — ' + leftover.map(function (pe) { return pe[0] + '^' + pe[1]; }).join(' × ') + ' cannot form complete groups of ' + g +
            '. (The smallest number to ' + (want === 'cube' ? 'multiply' : 'multiply') + ' by: see "smallest number to make ' + n + ' a perfect ' + want + '")');
        var root = groups.reduce(function (a, b) { return a * b; }, 1);
        st(steps, 'Take one factor from each group of ' + g, (want === 'cube' ? '∛' : '√') + n + ' = ' + groups.join(' × ') + ' = ' + fmt(root));
        return R((want === 'cube' ? 'Cube' : 'Square') + ' root by prime factorisation', 'N = ' + n, steps,
            (want === 'cube' ? '∛' : '√') + n + ' = **' + fmt(root) + '**', fmt(root) + (want === 'cube' ? '³' : '²') + ' = ' + n + ' ✔');
    });

    /* 30. averages */
    S('average-series', new RegExp('average of (?:the )?first\\s*' + NUM + '\\s*(natural|whole|even|odd)?[^.]*?numbers?'),
        function (m) {
            var n = N(m[1]), kind = m[2] || 'natural', steps = [], avg, series;
            if (n < 1 || n > 1e6) return null;
            if (kind === 'even') { avg = n + 1; series = '2, 4, 6, …, ' + 2 * n; }
            else if (kind === 'odd') { avg = n; series = '1, 3, 5, …, ' + (2 * n - 1); }
            else if (kind === 'whole') { avg = (n - 1) / 2; series = '0, 1, 2, …, ' + (n - 1); }
            else { avg = (n + 1) / 2; series = '1, 2, 3, …, ' + n; }
            st(steps, 'The numbers are', series);
            st(steps, 'Average = Sum ÷ count — shortcut for this series', 'average = ' + fmt(avg));
            return R('Average of a number series', 'first ' + fmt(n) + ' ' + kind + ' numbers', steps, 'Average = ' + nice(avg),
                'sum = ' + fmt(avg * n) + ' and ' + fmt(avg * n) + ' ÷ ' + fmt(n) + ' = ' + fmt(avg) + ' ✔');
        });
    S('average-speed', null, function (m, t) {
        if (!/average speed/.test(t)) return null;
        var all = allNums(t).filter(function (x2) { return x2.v > 0; });
        if (all.length < 2) return null;
        {
            var x = all[0].v, y = all[1].v, steps = [];
            var avg = 2 * x * y / (x + y);
            st(steps, 'For EQUAL distances, average speed = 2xy ÷ (x + y)', '2 × ' + fmt(x) + ' × ' + fmt(y) + ' ÷ (' + fmt(x) + ' + ' + fmt(y) + ') = ' + fmt(2 * x * y) + ' ÷ ' + fmt(x + y) + ' = ' + fmt(avg));
            return R('Average speed (equal distances)', 'speeds = ' + fmt(x) + ' and ' + fmt(y), steps,
                'Average speed = ' + nice(avg),
                'Careful: (x+y)/2 = ' + fmt((x + y) / 2) + ' would be WRONG for equal distances!');
        }
    });

    /* 31. probability */
    S('prob-coin', /(toss|coin)[\s\S]*?(head|tail)/, function (m) {
        var steps = [];
        st(steps, 'A fair coin has 2 equally likely outcomes: Head, Tail', 'favourable = 1, total = 2');
        st(steps, 'P(E) = favourable ÷ total', '1/2');
        return R('Probability — coin', 'fair coin toss', steps,
            'P(' + (m[2] === 'head' ? 'Head' : 'Tail') + ') = **1/2** = 0.5 = 50%');
    });
    S('prob-die', null, function (m, t) {
        if (!/(die|dice)/.test(t)) return null;
        var faces = [1, 2, 3, 4, 5, 6], fav, label, mm;
        if ((mm = t.match(new RegExp('(?:greater than|more than)\\s*' + NUM)))) {
            fav = faces.filter(function (f) { return f > N(mm[1]); }); label = 'number > ' + mm[1];
        } else if ((mm = t.match(new RegExp('(?:less than|smaller than|below)\\s*' + NUM)))) {
            fav = faces.filter(function (f) { return f < N(mm[1]); }); label = 'number < ' + mm[1];
        } else if ((mm = t.match(new RegExp('multiple of\\s*' + NUM)))) {
            var k = N(mm[1]); if (k < 1) return null;
            fav = faces.filter(function (f) { return f % k === 0; }); label = 'multiple of ' + mm[1];
        } else if ((mm = t.match(new RegExp('(?:getting|shows?|showing|rolling|comes? up)\\s*' + NUM + '\\b')))) {
            var kk = N(mm[1]); if (kk < 1 || kk > 6) return null;
            fav = faces.filter(function (f) { return f === kk; }); label = 'getting ' + kk;
        } else if (/even/.test(t)) { fav = faces.filter(function (f) { return f % 2 === 0; }); label = 'even number'; }
        else if (/odd/.test(t)) { fav = faces.filter(function (f) { return f % 2 === 1; }); label = 'odd number'; }
        else if (/prime/.test(t)) { fav = faces.filter(function (f) { return [2, 3, 5].indexOf(f) !== -1; }); label = 'prime number'; }
        else return null;
        if (!fav.length) return R('Probability — die', 'rolling a fair die', [], 'P(' + label + ') = **0** — impossible!');
        var steps = [], g = gcd(fav.length, 6);
        st(steps, 'A die has 6 equally likely outcomes', '1, 2, 3, 4, 5, 6');
        st(steps, 'Favourable outcomes for ' + label, '{ ' + fav.join(', ') + ' } → ' + fav.length + ' outcome' + (fav.length > 1 ? 's' : ''));
        st(steps, 'P(E) = favourable ÷ total', fav.length + '/6' + (g > 1 ? ' = ' + (fav.length / g) + '/' + (6 / g) : ''));
        return R('Probability — die', 'rolling a fair die', steps,
            'P(' + label + ') = **' + fracStr(fav.length / 6) + '** = ' + fmt(fav.length / 6) + ' ≈ ' + fmt(fav.length / 6 * 100) + '%');
    });
    S('prob-balls', null, function (m, t) {
        if (!/(bag|box|jar|urn)/.test(t)) return null;
        var mm = t.match(/(\d+)\s*red[^.]*?(\d+)\s*blue(?:[^.]*?(\d+)\s*(?:green|yellow|white|black))?/);
        if (!mm) return null;
        var red = N(mm[1]), blue = N(mm[2]), other = mm[3] ? N(mm[3]) : 0;
        var otherName = mm[4] || 'green';
        var total = red + blue + other, steps = [];
        var wantM = t.match(/probability of[^.]*?(not red|not blue|red|blue|green|yellow|white|black)/);
        if (!wantM) return null;
        var want = wantM[1];
        var fav = want === 'red' ? red : want === 'blue' ? blue : want === otherName ? other
            : want === 'not red' ? total - red : want === 'not blue' ? total - blue : 0;
        if (fav <= 0 && want.indexOf('not') === -1) return null;
        st(steps, 'Total balls', red + ' red + ' + blue + ' blue' + (other ? ' + ' + other + ' ' + otherName : '') + ' = ' + total);
        st(steps, 'Favourable outcomes for "' + want + '"', String(fav));
        var g = gcd(fav, total) || 1;
        st(steps, 'P(E) = favourable ÷ total', fav + '/' + total + (g > 1 ? ' = ' + (fav / g) + '/' + (total / g) : ''));
        return R('Probability — coloured balls', total + ' balls in the bag', steps,
            'P(' + want + ') = **' + fracStr(fav / total) + '** ≈ ' + fmt(fav / total));
    });

    /* 32. simultaneous equations from words (2 items & prices) */
    S('system-2x2', null, function (m, t) {
        var re = new RegExp(NUM + '\\s*([a-z]+)s?\\s*(?:and|,|\\+)\\s*' + NUM + '\\s*([a-z]+)s?[\\s\\S]{0,30}?(?:cost|costs|is|are|=|for)[\\s\\S]{0,10}?(?:rs\\.?\\s*)?' + NUM, 'g');
        var found = [], mm;
        while ((mm = re.exec(t)) !== null) {
            found.push({ a: N(mm[1]), x: mm[2], b: N(mm[3]), y: mm[4], c: N(mm[5]) });
            if (found.length >= 2) break;
        }
        if (found.length < 2) return null;
        var e1 = found[0], e2 = found[1];
        if (e1.x !== e2.x || e1.y !== e2.y) return null;
        if (!/(cost|price|worth|\brs\b|rupees)/.test(t)) return null;
        var det = e1.a * e2.b - e1.b * e2.a;
        if (det === 0) return null;
        var px = (e1.c * e2.b - e1.b * e2.c) / det;
        var py = (e1.a * e2.c - e1.c * e2.a) / det;
        if (px < 0 || py < 0) return null;
        var steps = [];
        st(steps, 'Let one ' + e1.x + ' cost p and one ' + e1.y + ' cost q — write both sentences as equations',
            fmt(e1.a) + 'p + ' + fmt(e1.b) + 'q = ' + fmt(e1.c) + '  …(i)      ' + fmt(e2.a) + 'p + ' + fmt(e2.b) + 'q = ' + fmt(e2.c) + '  …(ii)');
        st(steps, 'Eliminate q: (i)×' + fmt(e2.b) + ' − (ii)×' + fmt(e1.b), fmt(det) + 'p = ' + fmt(e1.c * e2.b - e2.c * e1.b) + '  →  p = ' + fmt(px));
        st(steps, 'Substitute p in (i)', fmt(e1.b) + 'q = ' + fmt(e1.c) + ' − ' + fmt(e1.a) + '×' + fmt(px) + ' = ' + fmt(e1.c - e1.a * px) + '  →  q = ' + fmt(py));
        return R('Two linear equations from words', 'items: ' + e1.x + ' & ' + e1.y, steps,
            'One ' + e1.x + ' = ' + nice(px) + ' rupees,  one ' + e1.y + ' = ' + nice(py) + ' rupees',
            fmt(e1.a) + '(' + fmt(px) + ') + ' + fmt(e1.b) + '(' + fmt(py) + ') = ' + fmt(e1.a * px + e1.b * py) + ' ✔    ' +
            fmt(e2.a) + '(' + fmt(px) + ') + ' + fmt(e2.b) + '(' + fmt(py) + ') = ' + fmt(e2.a * px + e2.b * py) + ' ✔');
    });

    /* 33. Class 1–5 story sums (kept LAST — the most generic) */
    var LOSSVERB = '(?:gave|given|gives|give|lost|lose|eaten|eats|eat|ate|used|uses|use|sold|sell|spends|spend|spent|drops|drop|dropped|drank|drink|consumed|removed|remove)';
    S('story-gave', new RegExp('(?:has|have|had|bought|purchased|picked|plucked|collected)\\s*' + NUM + '\\s*([a-z]+)[\\s\\S]*?' + LOSSVERB + '\\s*(?:away |him |her |them |it |up |by him |by her )?' + NUM +
        '|(?:has|have|had|bought|purchased|picked|plucked|collected)\\s*' + NUM + '\\s*([a-z]+)[\\s\\S]*?' + NUM + '\\s*(?:\\w+\\s+){0,2}?' + LOSSVERB),
        function (m, t) {
            var a = N(m[1]), item = m[2], b = N(m[3]);
            if (!item) {                                    // reversed order: "One he eaten"
                if (!/(left|remain|now|how many|bache|\?)/.test(t)) return null;
                a = N(m[4]); item = m[5]; b = N(m[6]);
            }
            if (!item || /^(rs|rupees|kg|gm)$/.test(item)) return null;
            if (b > a || /each|per|every|total cost|price/.test(m[0])) return null;
            var steps = [];
            st(steps, 'Started with ' + fmt(a) + ' ' + plu(item) + '; ' + fmt(b) + ' went away → subtract', fmt(a) + ' − ' + fmt(b) + ' = ' + fmt(a - b));
            var ip = plu(item);
            return R('Story sum — subtraction', fmt(a) + ' ' + ip + ', ' + fmt(b) + ' given away/lost/used/eaten', steps,
                ip.charAt(0).toUpperCase() + ip.slice(1) + ' left = ' + nice(a - b),
                fmt(a - b) + ' + ' + fmt(b) + ' = ' + fmt(a) + ' ✔');
        });
    var GAINVERB = '(?:got|gets|received?|finds?|found|buys|bought|takes?|picks?|came|come|arrived?|joined|added)';
    S('story-got', new RegExp('(?:has|have|had)\\s*' + NUM + '\\s*([a-z]+)[\\s\\S]*?' + GAINVERB + '\\s*(?:another\\s+|more\\s+)?' + NUM +
        '|(?:has|have|had)\\s*' + NUM + '\\s*([a-z]+)[\\s\\S]*?' + NUM + '\\s*(?:more\\s+)?(?:\\w+\\s+){0,2}?' + GAINVERB),
        function (m, t) {
            if (!/(total|in all|altogether|now|how many|sum)/.test(t)) return null;
            var a = N(m[1]), item = m[2], b = N(m[3]), steps = [];
            if (!item) { a = N(m[4]); item = m[5]; b = N(m[6]); }   // reversed: "7 more birds came"
            if (!item || /^(rs|rupees|kg|gm)$/.test(item)) return null;
            st(steps, 'Had ' + fmt(a) + ', added ' + fmt(b) + ' more', fmt(a) + ' + ' + fmt(b) + ' = ' + fmt(a + b));
            return R('Story sum — addition', fmt(a) + ' + ' + fmt(b) + ' more ' + plu(item), steps,
                'Total ' + plu(item) + ' = ' + nice(a + b), fmt(a + b) + ' − ' + fmt(b) + ' = ' + fmt(a) + ' ✔');
        });
    S('story-each', new RegExp(NUM + '\\s*(boxes|bags|packets|baskets|groups|shelves|tables|classes|cartons|crates)\\s*(?:of)?[\\s\\S]*?each[\\s\\S]*?(?:has|have|had|contains?|containing|holding|with)?\\s*' + NUM),
        function (m) {
            var k = N(m[1]), p = N(m[3]), steps = [];
            if (!/total|how many|altogether|in all|\?/.test(m.input || '') && !/total|how many|altogether|in all|\?/.test(m[0])) { /* still fine */ }
            st(steps, k + ' groups × ' + p + ' items in each → multiply', fmt(k) + ' × ' + fmt(p) + ' = ' + fmt(k * p));
            return R('Story sum — multiplication (equal groups)', fmt(k) + ' groups of ' + fmt(p) + ' items each', steps,
                'Total items = ' + nice(k * p), fmt(k * p) + ' ÷ ' + fmt(k) + ' = ' + fmt(p) + ' per group ✔');
        });
    S('story-share', new RegExp(NUM + '\\s*([a-z]+)s?[\\s\\S]*?(?:shared|distributed?|divided|split)\\s*(?:equally)?\\s*(?:among|between|into|amongst)\\s*' + NUM),
        function (m) {
            var n = N(m[1]), item = m[2], k = N(m[3]);
            if (k === 0) return null;
            var steps = [], each = n / k;
            st(steps, 'Equal sharing → divide', fmt(n) + ' ÷ ' + fmt(k) + ' = ' + fmt(each) + (n % k ? '   (remainder ' + (n % k) + ')' : ''));
            return R('Story sum — equal sharing', fmt(n) + ' ' + plu(item) + ' among ' + fmt(k), steps,
                'Each gets ' + nice(each) + ' ' + plu(item) + (n % k ? ' (' + fmt(n % k) + ' left over)' : ''),
                fmt(k) + ' × ' + fmt(each) + ' = ' + fmt(k * each) + (n % k ? ' + ' + fmt(n % k) + ' = ' + fmt(n) : ' = ' + fmt(n)) + ' ✔');
        });

    /* ── the gate: does this look like a word problem worth trying? ──────── */
    var TOPIC_RE = /(sum of|difference of|twice|thrice|times a number|times the other|consecutive|as old|years old|years? (?:ago|hence|later)|present age|speed|distance|km|how (?:far|long|fast)|per hour|work|days|together|pipe|tank|cost of|costs|price|unitary|ratio|divide|divided|percent|%|profit|loss|discount|marked price|gst|vat|sales tax|interest|principal|compound|population|depreciat|perimeter|area|volume|surface|rectangle|square|triangle|circle|trapezium|rhombus|parallelogram|polygon|angle|diagonal|ladder|hypotenuse|pythagor|probability|die|dice|coin|toss|average|perfect square|perfect cube|square root|cube root|factori[sz]ation|apples|mangoes|balls|marbles|rupees|₹|\brs\b|pencils|erasers|bananas|oranges|toys|sweets|ages?|earn|wages|ke paas|bache|khaya|aam|how many left|how many)/;
    var ASK_RE = /(find|what|how|calculate|compute|determine|prove|show|kitna|kya|batao|nikalo|solve|\?)/;
    var SKIP_RE = /(who is|what is your|your name|joke|weather|capital of|full form|meaning of|who invented|who wrote|lyrics|recipe|news|movie|song)/;
    function looksLikeWordProblem(text) {
        var t = String(text || '');
        if (t.length < 12 || t.length > 400) return false;
        var low = norm(t);
        if (!/\d/.test(low) && !/(probability|dice|\bdie\b|coin|toss)/.test(low)) return false;   // digit-less probability ok — solve() is still the real guard
        if (!ASK_RE.test(low)) return false;
        if (!TOPIC_RE.test(low)) return false;
        if (SKIP_RE.test(low)) return false;
        return true;
    }

    /* ── top level ───────────────────────────────────────────────────────── */
    function solve(text) {
        var t = norm(text);
        for (var i = 0; i < SOLVERS.length; i++) {
            var s = SOLVERS[i];
            try {
                if (s.re && !s.re.test(t)) continue;
                var mm = s.re ? t.match(s.re) : [];
                var res = s.fn(mm || [], t);
                if (res) return res;
            } catch (e) { /* a broken solver must never break the chat */ }
        }
        return null;
    }

    var BitWords = { norm: norm, solve: solve, looksLikeWordProblem: looksLikeWordProblem, fmt: fmt, fracStr: fracStr };
    if (typeof module !== 'undefined' && module.exports) module.exports = BitWords;
    else root.BitWords = BitWords;
})(typeof window !== 'undefined' ? window : globalThis);
