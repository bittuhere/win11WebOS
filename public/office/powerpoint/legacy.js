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
   legacy.js — legacy .ppt IMPORT for the PowerPoint clone.
   Reads the OLE compound (CFB) container, opens the "PowerPoint Document"
   stream and walks its record tree for the SlideListWithText sequence:
   every SlidePersistAtom starts a slide; the TextCharsAtom (UTF-16LE),
   TextBytesAtom (ANSI) and CString atoms that follow carry its text.
   Text becomes per-slide title + bullet body (formatting is flattened;
   pictures/SmartArt from 2003-era files are not recoverable this way and
   that limitation is announced to the user).
   ========================================================================== */
(function () {
'use strict';

/* ============================ CFB container ============================ */
const FREE = 0xFFFFFFFF, EOC = 0xFFFFFFFE;
function cfbOpen(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  for (let i = 0; i < 8; i++) if (u8[i] !== magic[i]) throw new Error('not an OLE compound file');
  const secSize = 1 << dv.getUint16(30, true);
  const miniSecSize = 1 << dv.getUint16(32, true);
  const numDir = dv.getUint32(40, true);
  const numFat = dv.getUint32(44, true);
  const firstDir = dv.getUint32(48, true);
  const miniCutoff = dv.getUint32(56, true);
  const firstMiniFat = dv.getUint32(60, true);
  const numMiniFat = dv.getUint32(64, true);
  const firstDifat = dv.getUint32(68, true);
  const numDifat = dv.getUint32(72, true);
  const difat = [];
  for (let i = 0; i < 109; i++) { const v = dv.getUint32(76 + i * 4, true); if (v !== FREE) difat.push(v); }
  let difSec = firstDifat;
  for (let i = 0; i < numDifat && difSec !== EOC; i++) {
    const base = (difSec + 1) * secSize;
    for (let j = 0; j < secSize / 4 - 1; j++) { const v = dv.getUint32(base + j * 4, true); if (v !== FREE) difat.push(v); }
    difSec = dv.getUint32(base + secSize - 4, true);
  }
  const fat = [];
  difat.slice(0, numFat + numDifat + 8).forEach(sec => {
    const base = (sec + 1) * secSize;
    for (let j = 0; j < secSize / 4; j++) fat.push(dv.getUint32(base + j * 4, true));
  });
  const chain = start => {
    const out = []; let s = start, guard = 100000;
    while (s !== EOC && s !== FREE && s < fat.length && guard-- > 0) { out.push(s); s = fat[s]; }
    return out;
  };
  const readChain = (start, size) => {
    const secs = chain(start);
    const out = new Uint8Array(size); let p = 0;
    for (const s of secs) {
      const base = (s + 1) * secSize;
      const n = Math.min(secSize, size - p);
      if (n <= 0) break;
      out.set(u8.subarray(base, base + n), p); p += n;
    }
    return out;
  };
  const dirData = readChain(firstDir, Math.max(secSize, numDir * secSize || 0, 128 * 128));
  const ddv = new DataView(dirData.buffer, dirData.byteOffset, dirData.byteLength);
  const entries = [];
  for (let off = 0; off + 128 <= dirData.length; off += 128) {
    const nameLen = ddv.getUint16(off + 64, true);
    if (nameLen < 2) continue;
    let nm = '';
    for (let i = 0; i < Math.min(31, (nameLen - 2) / 2); i++) nm += String.fromCharCode(ddv.getUint16(off + i * 2, true));
    entries.push({ name: nm, type: ddv.getUint8(off + 66), start: ddv.getUint32(off + 116, true), size: ddv.getUint32(off + 120, true) });
  }
  const root = entries.find(e => e.type === 5);
  let miniFat = [], miniStream = null;
  if (numMiniFat && firstMiniFat !== EOC) {
    const mf = readChain(firstMiniFat, numMiniFat * secSize);
    const mdv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
    for (let i = 0; i + 4 <= mf.length; i += 4) miniFat.push(mdv.getUint32(i, true));
  }
  if (root && root.size) miniStream = readChain(root.start, root.size);
  const openStream = e => {
    if (e.size < miniCutoff && miniStream && miniFat.length) {
      const out = new Uint8Array(e.size);
      let p = 0, s = e.start, guard = 100000;
      while (s !== EOC && s < miniFat.length && p < e.size && guard-- > 0) {
        const base = s * miniSecSize;
        const n = Math.min(miniSecSize, e.size - p);
        out.set(miniStream.subarray(base, base + n), p);
        p += n; s = miniFat[s];
      }
      return out;
    }
    return readChain(e.start, e.size);
  };
  return { entries, openStream, find: nm => entries.find(e => e.name.toLowerCase() === nm.toLowerCase()) };
}

/* ================== PowerPoint Document record walk ================== */
const RT = { SLIDE_PERSIST: 1011 /* 0x03F3 */, TEXT_CHARS: 4000 /* 0x0FA0 */, TEXT_BYTES: 4008 /* 0x0FA8 */, CSTRING: 4026 /* 0x0FBA */, DOCUMENT: 1000, SLWTXT: 4080 /* 0x0FF0 */ };

function readPpt(buf) {
  const cfb = cfbOpen(buf);
  const ent = cfb.find('PowerPoint Document');
  if (!ent) throw new Error('no "PowerPoint Document" stream — this is not a legacy PowerPoint file');
  const d = cfb.openStream(ent);
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  /* depth-limited recursive walk looking for the SlideListWithText container */
  function* walk(start, end, depth) {
    let p = start;
    while (p + 8 <= end && depth < 64) {
      const verInst = dv.getUint16(p, true);
      const type = dv.getUint16(p + 2, true);
      const len = dv.getUint32(p + 4, true);
      if (p + 8 + len > end) break;
      yield { p, type, len, ver: verInst & 0xF };
      p += 8 + len;
    }
  }
  function findSlwt(start, end) {
    for (const r of walk(start, end, 0)) {
      if (r.type === RT.SLWTXT) return { start: r.p + 8, end: r.p + 8 + r.len };
      if (r.ver === 0xF) { const hit = findSlwt(r.p + 8, r.p + 8 + r.len); if (hit) return hit; }
    }
    return null;
  }
  const slwt = findSlwt(0, d.length);
  const slides = [];
  const pushText = (list, text) => {
    text.split('').join('').split(/[\r\n]+/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(s => s && !/^___PPT\d+$/i.test(s))    /* LibreOffice placeholder atoms */
      .forEach(l => list.push(l));
  };
  const collectInto = (target, start, end) => {
    for (const r of walk(start, end, 0)) {
      if (r.type === RT.TEXT_CHARS) {
        let s = '';
        for (let i = 0; i + 2 <= r.len; i += 2) s += String.fromCharCode(dv.getUint16(r.p + 8 + i, true));
        pushText(target, s);
      } else if (r.type === RT.TEXT_BYTES) {
        let s = '';
        for (let i = 0; i < r.len; i++) s += String.fromCharCode(dv.getUint8(r.p + 8 + i));
        pushText(target, s);
      } else if (r.type === RT.CSTRING) {
        let s = '';
        for (let i = 0; i + 2 <= r.len && dv.getUint16(r.p + 8 + i, true) !== 0; i += 2) s += String.fromCharCode(dv.getUint16(r.p + 8 + i, true));
        const t = s.trim();
        if (t && !/^___PPT\d+$/i.test(t)) target.push(t);   /* CString = title text */
      } else if (r.ver === 0xF) collectInto(target, r.p + 8, r.p + 8 + r.len);
    }
  };
  if (slwt) {
    /* MS Office style: SlideListWithText = FLAT SlidePersistAtom + text atoms */
    let cur = null;
    for (const r of walk(slwt.start, slwt.end, 0)) {
      if (r.type === RT.SLIDE_PERSIST) { cur = { lines: [] }; slides.push(cur); }
      else if (cur && (r.type === RT.TEXT_CHARS || r.type === RT.TEXT_BYTES || r.type === RT.CSTRING)) {
        collectInto(cur.lines, r.p, r.p + 8 + r.len);
      }
    }
  }
  /* LibreOffice style: Slwt carries persists only; real text lives inside each
     top-level RT_Slide (1006) container's Escher tree. Harvest those in
     stream order and use whichever route produced more text. */
  const slideContainers = [];
  (function findSlides(start, end) {
    for (const r of walk(start, end, 0)) {
      if (r.type === 1006) slideContainers.push(r);        /* RT_Slide */
      else if (r.ver === 0xF && r.type !== 1000) findSlides(r.p + 8, r.p + 8 + r.len);
      /* NOTE: do not descend into the Document container (1000) — Slwt persists
         there must not be confused with slide containers */
    }
  })(0, d.length);
  const loSlides = slideContainers.map(sc => { const lines = []; collectInto(lines, sc.p, sc.p + 8 + sc.len); return { lines }; });
  const score = list => list.reduce((n, s) => n + s.lines.length, 0);
  if (score(loSlides) >= score(slides)) { slides.length = 0; loSlides.forEach(x => slides.push(x)); }
  /* Fallback: nothing found anywhere — harvest every text atom in stream order */
  if (!score(slides)) {
    const all = [];
    const harvest = (start, end) => {
      for (const r of walk(start, end, 0)) {
        if (r.type === RT.TEXT_CHARS || r.type === RT.TEXT_BYTES) collectInto(all, r.p, r.p + 8 + r.len);
        else if (r.ver === 0xF) harvest(r.p + 8, r.p + 8 + r.len);
      }
    };
    harvest(0, d.length);
    if (all.length) slides = [{ lines: all }];
  }
  if (!score(slides)) throw new Error('no slide text found in this .ppt');
  const chosen = slides;
  return chosen.map((s, i) => ({ lines: s.lines, i })).filter(s => s.lines.length || s.i === 0);
}

/* Build app slides (title + content) from extracted lines */
function slidesFromPpt(P, buf) {
  const raw = readPpt(buf);
  return raw.map((s, i) => {
    const sl = P.newSlide('titleContent');
    sl.id = 's' + Date.now().toString(36) + '_p' + i;
    const titleObj = sl.objects.find(o => o.ph === 'title');
    const bodyObj = sl.objects.find(o => o.ph === 'body');
    const lines = s.lines.slice();
    if (titleObj) titleObj.paras = [P.newPara(lines.shift() || '', { align: 'c' })];
    if (bodyObj) bodyObj.paras = lines.map(l => P.newPara(l));
    if (!lines.length && bodyObj) bodyObj.paras = [P.newPara('')];
    return sl;
  });
}

function isLegacyPpt(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return u8.length > 8 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
}

window.PptLegacy = { cfbOpen, readPpt, slidesFromPpt, isLegacyPpt };
})();
