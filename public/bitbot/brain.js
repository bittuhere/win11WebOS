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
   BitBot BRAIN — a real neural network, from scratch, zero dependencies.
   Runs identically in the browser and Node.js.
     • Tokenizer + stemmer → bag-of-words features
     • Fully-connected net:  vocab → hidden(ReLU) → intents(softmax)
     • Trained with SGD + backpropagation (cross-entropy loss)
     • Seeded RNG → deterministic, reproducible training
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    // ── seeded RNG (mulberry32) ────────────────────────────────────────────
    function rng(seed) {
        var s = seed >>> 0;
        return function () {
            s |= 0; s = (s + 0x6D2B79F5) | 0;
            var t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // ── text pipeline ──────────────────────────────────────────────────────
    function tokenize(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(function (w) { return w.length > 0; });
    }
    function stem(w) {
        if (w === 'times') return 'times';   // keep distinct from 'time' (math vs clock!)
        if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
        if (w.length > 4 && /(sses|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
        if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
        if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
        if (w.length > 4 && /ed$/.test(w)) return w.slice(0, -2);
        return w;
    }
    function docs(intents) {                       // [tokens[], tag][]
        var out = [];
        intents.forEach(function (it) {
            it.patterns.forEach(function (p) { out.push([tokenize(p).map(stem), it.tag]); });
        });
        return out;
    }
    function buildVocab(allDocs) {
        var set = {}, vocab = [];
        allDocs.forEach(function (d) { d[0].forEach(function (w) { if (!set[w]) { set[w] = 1; vocab.push(w); } }); });
        var index = {}; vocab.forEach(function (w, i) { index[w] = i; });
        return { words: vocab, index: index };
    }
    /* ── v9: character-trigram hash features ──────────────────────────────
       Every token ALSO lights up a few of 512 hash buckets (its character
       trigrams). Words never seen in training (typos, new forms like
       "photosynthesiss" or "electromagnets") share trigrams with known
       words, so the net still gets a usable signal instead of silence.
       Bucket columns live right after the vocab columns in the input. */
    var HASH_BUCKETS = 512;
    function hashWord(w) {                       // FNV-1a, 32-bit
        var h = 0x811c9dc5;
        for (var i = 0; i < w.length; i++) { h ^= w.charCodeAt(i); h = Math.imul(h, 0x01000193); }
        return h >>> 0;
    }
    function bag(text, vocab) {
        var V = vocab.words.length, HB = vocab.HB || 0;
        var x = new Float32Array(V + HB);
        var toks = tokenize(text).map(stem), seenHash = null;
        if (HB) seenHash = {};
        for (var ti = 0; ti < toks.length; ti++) {
            var w = toks[ti];
            var i = vocab.index[w];
            if (i !== undefined) x[i] = 1;
            if (HB) {                            // trigram buckets (deduped per input)
                var pad = '#' + w + '#';
                for (var k = 0; k + 3 <= pad.length; k++) {
                    var b = hashWord(pad.substr(k, 3)) % HB;
                    if (!seenHash[b]) { seenHash[b] = 1; x[V + b] = 1; }
                }
            }
        }
        return x;
    }

    // ── the network ────────────────────────────────────────────────────────
    function Net(vocabSize, hidden, outSize, seed) {
        var r = rng(seed || 1337);
        function mat(rows, cols) {
            var m = new Float32Array(rows * cols);
            var scale = Math.sqrt(2 / cols);            // He init
            for (var i = 0; i < m.length; i++) m[i] = (r() * 2 - 1) * scale;
            return m;
        }
        this.V = vocabSize; this.H = hidden; this.N = outSize;
        this.W1 = mat(hidden, vocabSize); this.b1 = new Float32Array(hidden);
        this.W2 = mat(outSize, hidden);   this.b2 = new Float32Array(outSize);
    }
    // v8: bag-of-words inputs are SPARSE (~10 active words out of 2000+).
    // Gathering the active indices once and touching only those in layer 1
    // keeps the million-parameter net running in microseconds.
    function activeIdx(x, V) {
        var act = [];
        for (var i = 0; i < V; i++) if (x[i]) act.push(i);
        return act;
    }
    Net.prototype._forward = function (x, act) {        // act = precomputed active indices
        var z1 = new Float32Array(this.H), a1 = new Float32Array(this.H);
        var na = act.length;
        for (var h = 0; h < this.H; h++) {
            var s = this.b1[h], row = h * this.V;
            for (var k = 0; k < na; k++) { var i = act[k]; s += this.W1[row + i] * x[i]; }
            z1[h] = s; a1[h] = s > 0 ? s : 0;
        }
        var z2 = new Float32Array(this.N), max = -1e9;
        for (var n = 0; n < this.N; n++) {
            var s2 = this.b2[n], row2 = n * this.H;
            for (var h2 = 0; h2 < this.H; h2++) s2 += this.W2[row2 + h2] * a1[h2];
            z2[n] = s2; if (s2 > max) max = s2;
        }
        var p = new Float32Array(this.N), sum = 0;
        for (var n2 = 0; n2 < this.N; n2++) { p[n2] = Math.exp(z2[n2] - max); sum += p[n2]; }
        for (var n3 = 0; n3 < this.N; n3++) p[n3] /= sum;
        return { z1: z1, a1: a1, p: p };
    };
    Net.prototype.forward = function (x) {
        return this._forward(x, activeIdx(x, this.V));
    };
    Net.prototype.trainStep = function (x, y, lr) {
        var act = activeIdx(x, this.V);
        var f = this._forward(x, act), p = f.p;
        var loss = -Math.log(Math.max(p[y], 1e-9));
        // backprop
        var dz2 = new Float32Array(this.N);
        for (var n = 0; n < this.N; n++) dz2[n] = p[n] - (n === y ? 1 : 0);
        var da1 = new Float32Array(this.H);
        for (var n2 = 0; n2 < this.N; n2++) {
            var row2 = n2 * this.H, d = dz2[n2];
            this.b2[n2] -= lr * d;
            for (var h = 0; h < this.H; h++) {
                da1[h] += this.W2[row2 + h] * d;
                this.W2[row2 + h] -= lr * d * f.a1[h];
            }
        }
        var na = act.length;
        for (var h2 = 0; h2 < this.H; h2++) {
            if (f.z1[h2] <= 0) continue;                 // ReLU gate
            var d1 = da1[h2], row = h2 * this.V;
            this.b1[h2] -= lr * d1;
            for (var k = 0; k < na; k++) { var i = act[k]; this.W1[row + i] -= lr * d1 * x[i]; }
        }
        return loss;
    };
    Net.prototype.serialize = function () {
        return { V: this.V, H: this.H, N: this.N, W1: Array.from(this.W1), b1: Array.from(this.b1), W2: Array.from(this.W2), b2: Array.from(this.b2) };
    };

    // ── v8: quantized serialization (int16 → base64) ──────────────────────
    // 1.3M float params as JSON ≈ 26 MB. Quantized to int16 with a fixed
    // scale + base64 ≈ 3.5 MB — same brain, ~8× smaller file, still instant.
    function b64FromBytes(bytes) {
        if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
        var s = '', CH = 0x8000;
        for (var i = 0; i < bytes.length; i += CH)
            s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, bytes.length)));
        return btoa(s);
    }
    function bytesFromB64(str) {
        if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
        var s = atob(str), out = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
        return out;
    }
    function encodeQ(f32, scale) {
        var out = new Int16Array(f32.length);
        for (var i = 0; i < f32.length; i++) {
            var v = Math.round(f32[i] * scale);
            out[i] = v > 32767 ? 32767 : (v < -32768 ? -32768 : v);
        }
        return b64FromBytes(new Uint8Array(out.buffer));
    }
    function decodeQ(str, scale) {
        var q = new Int16Array(bytesFromB64(str).buffer);
        var out = new Float32Array(q.length);
        for (var i = 0; i < q.length; i++) out[i] = q[i] / scale;
        return out;
    }
    Net.prototype.maxAbsWeight = function () {
        var m = 0;
        [this.W1, this.b1, this.W2, this.b2].forEach(function (a) {
            for (var i = 0; i < a.length; i++) { var v = Math.abs(a[i]); if (v > m) m = v; }
        });
        return m;
    };
    Net.prototype.serializeQ = function () {
        // v9: int8 with PER-ROW scales (~4 decimals of effective precision,
        // 1 byte/param). Biases stay int16 (tiny). 75 lakh params ≈ 10MB b64.
        function encRows(mat, rows, cols) {
            var q = new Int8Array(rows * cols);
            var scales = new Array(rows);
            for (var r = 0; r < rows; r++) {
                var off = r * cols, mx = 1e-9;
                for (var c = 0; c < cols; c++) { var v = Math.abs(mat[off + c]); if (v > mx) mx = v; }
                var sc = mx / 127;
                scales[r] = +sc.toPrecision(5);
                for (var c2 = 0; c2 < cols; c2++) {
                    var qi = Math.round(mat[off + c2] / scales[r]);
                    q[off + c2] = qi > 127 ? 127 : (qi < -128 ? -128 : qi);
                }
            }
            return { b64: b64FromBytes(new Uint8Array(q.buffer)), scales: scales };
        }
        var w1 = encRows(this.W1, this.H, this.V), w2 = encRows(this.W2, this.N, this.H);
        var maxAbsB = 1e-9;
        [this.b1, this.b2].forEach(function (a) {
            for (var i = 0; i < a.length; i++) { var v = Math.abs(a[i]); if (v > maxAbsB) maxAbsB = v; }
        });
        var bscale = Math.min(10000, Math.floor(32000 / maxAbsB));
        return {
            q: 8, V: this.V, H: this.H, N: this.N,
            W1: w1.b64, S1: w1.scales, W2: w2.b64, S2: w2.scales,
            b1: encodeQ(this.b1, bscale), b2: encodeQ(this.b2, bscale), s: bscale
        };
    };
    Net.load = function (w) {
        var n = Object.create(Net.prototype);
        n.V = w.V; n.H = w.H; n.N = w.N;
        if (w.q === 8) {                                   // v9 int8 + per-row scales
            function decRows(b64, scales, rows, cols) {
                var q = new Int8Array(bytesFromB64(b64).buffer);
                var out = new Float32Array(rows * cols);
                for (var r = 0; r < rows; r++) {
                    var off = r * cols, sc = scales[r];
                    for (var c = 0; c < cols; c++) out[off + c] = q[off + c] * sc;
                }
                return out;
            }
            n.W1 = decRows(w.W1, w.S1, w.H, w.V);
            n.W2 = decRows(w.W2, w.S2, w.N, w.H);
            n.b1 = decodeQ(w.b1, w.s); n.b2 = decodeQ(w.b2, w.s);
        } else if (w.q) {                                  // v8 int16 global scale
            var s = w.s || 10000;
            n.W1 = decodeQ(w.W1, s); n.b1 = decodeQ(w.b1, s);
            n.W2 = decodeQ(w.W2, s); n.b2 = decodeQ(w.b2, s);
        } else {                                           // legacy JSON arrays
            n.W1 = Float32Array.from(w.W1); n.b1 = Float32Array.from(w.b1);
            n.W2 = Float32Array.from(w.W2); n.b2 = Float32Array.from(w.b2);
        }
        return n;
    };

    // ── trainer (works in Node and chunked in the browser) ────────────────
    function makeTrainer(intents, opts) {
        opts = opts || {};
        var seed = opts.seed || 1337;
        var hidden = opts.hidden || 40;
        var tags = intents.map(function (i) { return i.tag; });
        var tagIndex = {}; tags.forEach(function (t, i) { tagIndex[t] = i; });
        var D = docs(intents);
        var vocab = buildVocab(D);
        vocab.HB = HASH_BUCKETS;                       // v9: hash buckets ride with the vocab
        // precompute bags
        var X2 = D.map(function (d) { return bag(d[0].join(' '), vocab); });
        var Y = D.map(function (d) { return tagIndex[d[1]]; });
        var net = new Net(vocab.words.length + HASH_BUCKETS, hidden, tags.length, seed);
        var order = D.map(function (_, i) { return i; });
        function shuffle(r) {
            for (var i = order.length - 1; i > 0; i--) {
                var j = Math.floor(r() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t;
            }
        }
        return {
            net: net, vocab: vocab, tags: tags, tagIndex: tagIndex,
            epoch: function (r, lr) {                     // one pass, returns avg loss
                var rr = r || rng(seed + 999);
                shuffle(rr);
                var loss = 0;
                for (var k = 0; k < order.length; k++) {
                    var i = order[k];
                    loss += net.trainStep(X2[i], Y[i], lr || 0.10);
                }
                return loss / order.length;
            },
            accuracy: function () {
                var ok = 0;
                for (var i = 0; i < X2.length; i++) {
                    var p = net.forward(X2[i]).p, best = 0;
                    for (var n = 1; n < p.length; n++) if (p[n] > p[best]) best = n;
                    if (best === Y[i]) ok++;
                }
                return ok / X2.length;
            },
            predict: function (text) {
                var f = net.forward(bag(text, vocab)).p, best = 0;
                for (var n = 1; n < f.length; n++) if (f[n] > f[best]) best = n;
                return { tag: tags[best], prob: f[best] };
            }
        };
    }

    var BitBrain = {
        tokenize: tokenize, stem: stem, bag: bag, Net: Net,
        makeTrainer: makeTrainer, rng: rng, HASH_BUCKETS: HASH_BUCKETS
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = BitBrain;
    else root.BitBrain = BitBrain;
})(typeof window !== 'undefined' ? window : globalThis);
