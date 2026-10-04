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
   legacy.js — legacy-format support for the Excel clone.
     .xls IMPORT:  real BIFF8 reader over the OLE compound-file (CFB) container.
                   Reads every sheet's BOUNDSHEET/SST/NUMBER/RK/MULRK/LABELSST/
                   FORMULA/BOOLERR/LABEL records live in the browser — values,
                   booleans, errors and Excel date formats included. Cell
                   styles/arich-text are flattened (announced to the user).
     .xls EXPORT:  SpreadsheetML 2003 ("Microsoft XML Spreadsheet") — the real
                   XML dialect Excel 97-2003+ understands; carries sheets,
                   values, formulas as results and core cell styling.
   ========================================================================== */
(function () {
'use strict';
const td = new TextDecoder('utf-8'), tdLat = new TextDecoder('windows-1252');

/* ============================ CFB container ============================ */
const FREE = 0xFFFFFFFF, EOC = 0xFFFFFFFE;
function cfbOpen(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf, u8.byteOffset, u8.byteLength);
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

/* ============================ BIFF8 workbook ============================ */
/* Record ids we read */
const R = {
  BOF: 0x0809, EOF: 0x000A, BOUNDSHEET: 0x0085, SST: 0x00FC, CONTINUE: 0x003C,
  LABELSST: 0x00FD, NUMBER: 0x0203, RK: 0x027E, MULRK: 0x00BD, BOOLERR: 0x0205,
  FORMULA: 0x0006, STRING: 0x0207, LABEL: 0x0204, RSTRING: 0x00D6,
  FORMAT: 0x041E, XF: 0x00E0, COLINFO: 0x007D, DIMENSIONS: 0x0200
};
/* SST strings straddle CONTINUE records; the first byte of each continuation
   is a NEW encoding flag (per MS-XLS), so strings need a segment-aware reader. */
function segReader(segs) {
  let si = 0, p = 0;
  const rd = {
    segIndex: () => si,
    segLeft: () => (si < segs.length ? segs[si].length - p : 0),
    nextSeg() { si++; p = 0; if (si >= segs.length) throw new Error('SST ran past its CONTINUE records'); },
    byte() { if (p >= segs[si].length) rd.nextSeg(); return segs[si][p++]; },
    u16() { return rd.byte() | (rd.byte() << 8); },
    u32() { return (rd.byte() | (rd.byte() << 8) | (rd.byte() << 16) | (rd.byte() << 24)) >>> 0; },
    skip(n) { while (n-- > 0) rd.byte(); }
  };
  return rd;
}
function readXLStr(rd) {
  /* XLUnicodeString with continuation rules (rich/phonetic trailers skipped) */
  const cch = rd.u16();
  let opt = rd.byte();
  const rich = opt & 0x08, ext = opt & 0x04;
  let is16 = opt & 0x01;
  const cRun = rich ? rd.u16() : 0;
  const cbExt = ext ? rd.u32() : 0;
  let out = '';
  let charsLeft = cch;
  while (charsLeft > 0) {
    if (rd.segLeft() === 0) { rd.nextSeg(); is16 = rd.byte() & 0x01; }  // continuation re-flag
    if (is16) {
      const avail = Math.floor(rd.segLeft() / 2);
      if (avail === 0) {
        // split WCHAR: first byte here, rest in next segment
        const b0 = rd.byte(); rd.nextSeg(); rd.byte(); // consume + new flag (same meaning mid-char)
        const b1 = rd.byte();
        out += String.fromCharCode(b0 | (b1 << 8));
        charsLeft--;
        continue;
      }
      const take = Math.min(avail, charsLeft);
      let s = '';
      for (let i = 0; i < take; i++) s += String.fromCharCode(rd.u16());
      out += s; charsLeft -= take;
    } else {
      const take = Math.min(rd.segLeft(), charsLeft);
      let s = '';
      for (let i = 0; i < take; i++) s += String.fromCharCode(rd.byte());
      out += s; charsLeft -= take;
    }
  }
  rd.skip(cRun * 4);
  rd.skip(cbExt);
  return out;
}
function decodeRK(rk) {
  const div100 = rk & 0x01, isInt = rk & 0x02;
  let v;
  if (isInt) { v = rk >> 2; if (v & 0x20000000) v -= 0x40000000; }   // sign-extend 30-bit
  else { const b = new ArrayBuffer(8); const d = new DataView(b); d.setUint32(4, rk & 0xFFFFFFFC, true); v = d.getFloat64(0, true); }
  if (div100) v /= 100;
  return v;
}
const BIFF_BUILTIN_FMTS = { 14: 'mm/dd/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'hh:mm', 21: 'hh:mm:ss', 22: 'm/d/yy h:mm', 27: 'yyyy"年"m"月"', 30: 'm/d/yy', 31: 'yyyy"年"m"月"d"日"', 36: 'yyyy"年"m"月"', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 50: 'yyyy"年"m"月"', 57: 'yyyy"年"m"月"' };
const ERRS = { 0x00: '#NULL!', 0x07: '#DIV/0!', 0x0F: '#VALUE!', 0x17: '#REF!', 0x1D: '#NAME?', 0x24: '#NUM!', 0x2A: '#N/A' };

function biffRead(buf) {
  const cfb = cfbOpen(buf);
  const ent = cfb.find('Workbook') || cfb.find('Book');
  if (!ent) throw new Error('no Workbook stream — this .xls is not a BIFF5/8 workbook');
  const d = cfb.openStream(ent);
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  /* 1) walk the global section for BOUNDSHEET / SST(+CONTINUE) / FORMAT / XF */
  const bounds = [], formats = {}, xfs = [];
  let sstSegs = null, sstAt = -1;
  let pos = 0;
  const rd16 = o => dv.getUint16(o, true), rd32 = o => dv.getUint32(o, true);
  while (pos + 4 <= dv.byteLength) {
    const sid = rd16(pos), len = rd16(pos + 2);
    const dataStart = pos + 4;
    if (sid === R.BOUNDSHEET) {
      const ofs = rd32(dataStart);
      const cch = dv.getUint8(dataStart + 6), grbit = dv.getUint8(dataStart + 7);
      let nm = '';
      for (let i = 0; i < cch; i++) nm += grbit & 1 ? String.fromCharCode(rd16(dataStart + 8 + i * 2)) : String.fromCharCode(dv.getUint8(dataStart + 8 + i));
      bounds.push({ ofs, name: nm });
    } else if (sid === R.SST) {
      sstSegs = [d.subarray(dataStart, dataStart + len)]; sstAt = bounds.length; // marker
      let p2 = dataStart + len;
      while (p2 + 4 <= dv.byteLength && rd16(p2) === R.CONTINUE) { const l2 = rd16(p2 + 2); sstSegs.push(d.subarray(p2 + 4, p2 + 4 + l2)); p2 += 4 + l2; }
      pos = p2; continue;
    } else if (sid === R.FORMAT) {
      const ifmt = rd16(dataStart);
      const cch = rd16(dataStart + 2); const grbit = dv.getUint8(dataStart + 4);
      let code = '';
      for (let i = 0; i < cch; i++) code += grbit & 1 ? String.fromCharCode(rd16(dataStart + 5 + i * 2)) : String.fromCharCode(dv.getUint8(dataStart + 5 + i));
      formats[ifmt] = code;
    } else if (sid === R.XF) {
      xfs.push(rd16(dataStart + 2));           // ifmt
    } else if (sid === R.EOF && sstSegs) {
      /* end of globals */
      pos = dataStart + len;
      break;
    }
    pos = dataStart + len;
  }
  /* 2) shared strings */
  const strings = [];
  if (sstSegs) {
    const rd = segReader(sstSegs);
    rd.u32(); const unique = rd.u32();
    for (let i = 0; i < unique; i++) strings.push(readXLStr(rd));
  }
  /* 3) per-sheet cell records */
  const sheets = [];
  bounds.forEach((b, bi) => {
    const cells = []; // {r,c,kind,v,xf}
    const cols = [];  // {first,last,px}
    const end = (bi + 1 < bounds.length) ? bounds[bi + 1].ofs : dv.byteLength;
    let p = b.ofs;
    let pendingStr = null;  // FORMULA awaiting its STRING result
    const dateFmt = xf => {
      const ifmt = xfs[xf] || 0;
      const code = formats[ifmt] || BIFF_BUILTIN_FMTS[ifmt] || '';
      return code && /[ymdhHsS]/.test(code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')) ? code : null;
    };
    while (p + 4 <= end) {
      const sid = rd16(p), len = rd16(p + 2);
      if (p + 4 + len > dv.byteLength) break;
      const o = p + 4;
      if (sid === R.EOF) break;
      switch (sid) {
        case R.COLINFO: {
          const c1 = rd16(o), c2 = rd16(o + 2), w = rd16(o + 4);
          cols.push({ c1, c2, px: Math.round((w / 256) * 7.3) + 6 });
          break;
        }
        case R.LABELSST: {
          const idx = rd32(o + 6);
          cells.push({ r: rd16(o), c: rd16(o + 2), xf: rd16(o + 4), kind: 's', v: strings[idx] != null ? strings[idx] : '' });
          break;
        }
        case R.NUMBER:
          cells.push({ r: rd16(o), c: rd16(o + 2), xf: rd16(o + 4), kind: 'n', v: dv.getFloat64(o + 6, true) });
          break;
        case R.RK:
          cells.push({ r: rd16(o), c: rd16(o + 2), xf: rd16(o + 4), kind: 'n', v: decodeRK(rd32(o + 6)) });
          break;
        case R.MULRK: {
          const rw = rd16(o), cFirst = rd16(o + 2), cLast = rd16(o + len - 2);   /* colLast = final 2 bytes of the record */
          for (let c = cFirst; c <= cLast; c++) {
            const ro = o + 4 + (c - cFirst) * 6;
            cells.push({ r: rw, c, xf: rd16(ro), kind: 'n', v: decodeRK(rd32(ro + 2)) });
          }
          break;
        }
        case R.BOOLERR: {
          const isErr = dv.getUint8(o + 7);
          cells.push({ r: rd16(o), c: rd16(o + 2), xf: rd16(o + 4), kind: isErr ? 'e' : 'b', v: isErr ? (ERRS[dv.getUint8(o + 6)] || '#VALUE!') : !!dv.getUint8(o + 6) });
          break;
        }
        case R.FORMULA: {
          const rw = rd16(o), cl = rd16(o + 2), xf = rd16(o + 4);
          const b6 = dv.getUint8(o + 12), b7 = dv.getUint8(o + 13);
          if (b6 === 0xFF && b7 === 0xFF) {
            const t0 = dv.getUint8(o + 6);
            if (t0 === 0) pendingStr = { rw, cl, xf };               // STRING record follows
            else if (t0 === 1) cells.push({ r: rw, c: cl, xf, kind: 'b', v: !!dv.getUint8(o + 8) });
            else if (t0 === 2) cells.push({ r: rw, c: cl, xf, kind: 'e', v: ERRS[dv.getUint8(o + 8)] || '#VALUE!' });
            /* t0 === 3 → empty string result */
          } else cells.push({ r: rw, c: cl, xf, kind: 'n', v: dv.getFloat64(o + 6, true) });
          break;
        }
        case R.STRING: {
          if (pendingStr) {
            const rd = segReader([d.subarray(o, o + len)]);
            cells.push({ r: pendingStr.rw, c: pendingStr.cl, xf: pendingStr.xf, kind: 's', v: readXLStr(rd) });
            pendingStr = null;
          }
          break;
        }
        case R.LABEL: case R.RSTRING: {
          const rd = segReader([d.subarray(o + 6, o + len)]);
          try { cells.push({ r: rd16(o), c: rd16(o + 2), xf: rd16(o + 4), kind: 's', v: readXLStr(rd) }); } catch (e) { }
          break;
        }
      }
      p = o + len;
    }
    sheets.push({ name: b.name, cells, cols, dateFmt });
  });
  return { sheets };
}

/* Convert biffRead output into live app sheets (contract = xlsx.js readXlsx) */
function applyXls(X, buf) {
  const { sheets } = biffRead(buf);
  const out = [];
  sheets.forEach(sh => {
    const app = X.newSheetBlank(sh.name.slice(0, 31) || 'Sheet1');
    (sh.cols || []).forEach(ci => {
      for (let c = ci.c1; c <= Math.min(ci.c2, 255); c++) app.colW[c] = Math.min(400, Math.max(40, ci.px));
    });
    sh.cells.forEach(cell => {
      const k = cell.r + ',' + cell.c;
      const cd = { v: '', t: 's', num: '', f: null, s: null };
      if (cell.kind === 'n') {
        let f = sh.dateFmt(cell.xf);
        if (f) f = f.replace(/\\(.)/g, '$1');     /* BIFF escapes literals with backslashes */
        if (f) {
          cd.t = 'n'; cd.num = cell.v; cd.f = f;
          try { cd.v = window.Calc.fmt(cell.v, f).text; } catch (e) { cd.v = String(cell.v); }
        } else { cd.t = 'n'; cd.num = cell.v; cd.v = String(cell.v); }
      } else if (cell.kind === 'b') { cd.t = 'b'; cd.num = cell.v ? 1 : 0; cd.v = cell.v ? 'TRUE' : 'FALSE'; }
      else if (cell.kind === 'e') { cd.t = 's'; cd.num = ''; cd.v = cell.v; }
      else { cd.t = 's'; cd.v = cell.v; }
      app.cells[k] = cd;
    });
    out.push(app);
  });
  return { sheets: out.length ? out : [X.newSheetBlank('Sheet1')], valueOnly: true };
}

function isLegacyXls(buf) {
  const u8 = new Uint8Array(buf);
  return u8.length > 8 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
}

/* ============================ SpreadsheetML 2003 export ============================ */
/* Real Microsoft XML that Excel 97-2003+ opens natively. */
function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function buildXlsXml(X) {
  const state = X.state;
  let doc = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">\n<Styles>\n' +
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/></Style>\n';
  /* one style per unique cell-style signature */
  const styleIds = ['Default'];
  const styleKey = s => s ? [s.b, s.i, s.u, s.color || '', s.bg || '', s.halign || '', s.f || '', s.font || '', s.size || ''].join('|') : '';
  const sig2id = {};
  const fmtToSS = f => {
    if (!f) return '';
    if (f === 'General') return '';
    if (/(yy|dd|h:mm|AM\/PM)/i.test(f)) return f.replace(/AM\/PM/ig, 'AM/PM');
    return f;
  };
  state.sheets.forEach(sh => {
    Object.values(sh.cells).forEach(cd => {
      if (!cd || !cd.s) return;
      const sig = styleKey(cd.s) + '|' + (cd.f || '');
      if (!sig2id[sig]) {
        const id = 's' + styleIds.length; styleIds.push(id); sig2id[sig] = id;
        const st = cd.s;
        doc += `<Style ss:ID="${id}">`;
        doc += `<Alignment ss:Vertical="Bottom"${st.halign ? ` ss:Horizontal="${st.halign === 'center' ? 'Center' : st.halign === 'right' ? 'Right' : 'Left'}"` : ''}${st.wrap ? ' ss:WrapText="1"' : ''}/>`;
        if (st.bg) doc += `<Interior ss:Color="${escXml(st.bg)}" ss:Pattern="Solid"/>`;
        doc += `<Font ss:FontName="${escXml(st.font || 'Calibri')}" ss:Size="${st.size || 11}" ss:Color="${escXml(st.color || '#000000')}"${st.b ? ' ss:Bold="1"' : ''}${st.i ? ' ss:Italic="1"' : ''}${st.u ? ' ss:Underline="Single"' : ''}${st.strike ? ' ss:StrikeThrough="1"' : ''}/>`;
        const nf = fmtToSS(cd.f);
        if (nf) doc += `<NumberFormat ss:Format="${escXml(nf)}"/>`;
        doc += '</Style>\n';
      }
    });
  });
  doc += '</Styles>\n';
  const a1 = (r, c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = (c - m - 1) / 26; } return s + (r + 1); };
  const isDateFmt = f => f && /[ymdhHsS]/.test(String(f).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, ''));
  const isoOfSerial = s => {
    const t = Date.UTC(1899, 11, 30) + Math.round(s * 86400000);
    return new Date(t).toISOString().slice(0, 19);   // "yyyy-mm-ddThh:mm:ss"
  };
  state.sheets.forEach(sh => {
    const grid = { r2: -1, c2: -1 };
    Object.keys(sh.cells).forEach(k => {
      const cd = sh.cells[k];
      if (!cd || (cd.v === '' || cd.v == null) && cd.t !== 'f') return;
      const p = k.split(','); const r = +p[0], c = +p[1];
      if (r > grid.r2) grid.r2 = r; if (c > grid.c2) grid.c2 = c;
    });
    doc += `<Worksheet ss:Name="${escXml(sh.name || 'Sheet')}"><Table>`;
    if (sh.colW) Object.keys(sh.colW).sort((a, b) => a - b).forEach(c => {
      if (+c <= grid.c2) doc += `<Column ss:Index="${+c + 1}" ss:Width="${Math.round((sh.colW[c] || 64) * 0.75)}"/>`;
    });
    for (let r = 0; r <= grid.r2; r++) {
      doc += '<Row>';
      for (let c = 0; c <= grid.c2; c++) {
        const cd = sh.cells[r + ',' + c];
        if (!cd) continue;
        const sig = cd.s ? styleKey(cd.s) + '|' + (cd.f || '') : '';
        const sidAttr = sig2id[sig] ? ` ss:StyleID="${sig2id[sig]}"` : '';
        let typ = 'String', data = cd.v != null ? String(cd.v) : '';
        if (cd.t === 'n' && typeof cd.num === 'number' && isFinite(cd.num)) {
          if (isDateFmt(cd.f)) { typ = 'DateTime'; data = isoOfSerial(cd.num); }
          else { typ = 'Number'; data = String(cd.num); }
        }
        else if (cd.t === 'b') { typ = 'Boolean'; data = cd.num ? '1' : '0'; }
        doc += `<Cell${sidAttr}><Data ss:Type="${typ}">${escXml(data)}</Data></Cell>`;
      }
      doc += '</Row>\n';
    }
    doc += '</Table></Worksheet>\n';
  });
  doc += '</Workbook>';
  return doc;
}

window.XlsLegacy = { cfbOpen, biffRead, applyXls, isLegacyXls, buildXlsXml };
})();
