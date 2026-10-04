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
   xlsx.js — real .xlsx export (valid OOXML spreadsheet package) + import
   Export: stored (uncompressed) ZIP with correct CRC32 — opens in real Excel.
   Import: ZIP central-directory reader; method 0 raw, method 8 inflated via
   the browser DecompressionStream. Parses sharedStrings / styles / sheets.
   ========================================================================== */
(function () {
'use strict';
const te = new TextEncoder(), td = new TextDecoder();

/* ---------------- CRC32 + ZIP writer ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(entries) {
  const chunks = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const nameU8 = te.encode(e.name);
    const crc = crc32(e.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, 0x6C20, true); lh.setUint16(12, 0x5669, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, e.data.length, true); lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, nameU8.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameU8, e.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0x6C20, true);
    ch.setUint16(14, 0x5669, true); ch.setUint32(16, crc, true); ch.setUint32(20, e.data.length, true);
    ch.setUint32(24, e.data.length, true); ch.setUint16(28, nameU8.length, true); ch.setUint32(42, offset, true);
    central.push({ buf: new Uint8Array(ch.buffer), nameU8 });
    offset += 30 + nameU8.length + e.data.length;
  }
  let cdSize = 0; for (const c of central) cdSize += 46 + c.nameU8.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const ch of chunks) { out.set(ch, p); p += ch.length; }
  for (const c of central) { out.set(c.buf, p); p += c.buf.length; out.set(c.nameU8, p); p += c.nameU8.length; }
  out.set(new Uint8Array(end.buffer), p);
  return out;
}

/* ---------------- ZIP reader ---------------- */
function zipEntries(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  // find EOCD (scan back from end)
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0 && i >= u8.length - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP package');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = td.decode(u8.slice(off + 46, off + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lnlen + lelen;
    out.push({ name, method, data: u8.slice(dataStart, dataStart + csize) });
    off += 46 + nlen + elen + clen;
  }
  return out;
}
async function inflate(u8) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ---------------- shared helpers ---------------- */
const escXml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = c => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = (c - 1 - m) / 26; } return s; };

/* ==========================================================================
   OBJECTS EXPORT — charts (c:chartSpace), pictures (xdr:pic), shapes/textboxes
   (xdr:sp), anchored to cells. Produces ECMA-376-compliant parts that open
   natively in Microsoft Excel AND LibreOffice/OpenOffice Calc.
   ========================================================================== */
const EMU = 9525;                                           // 1 CSS px (96dpi) in EMU
const clampInt = v => Math.max(0, Math.round(v));
function refOf(sh, r1, c1, r2, c2) {
  const nm = /[^A-Za-z0-9_.]/.test(sh.name) ? `'${sh.name.replace(/'/g, "''")}'` : sh.name;
  return `${nm}!$${colName(c1)}$${r1 + 1}:$${colName(c2)}$${r2 + 1}`;
}
function cellRawOf(sh) {
  return (r, c) => {
    const cd = sh.cells[r + ',' + c];
    if (!cd) return undefined;
    if (cd.t === 'f') return cd.num;
    if (cd.t === 'n') return (typeof cd.num === 'number') ? cd.num : parseFloat(cd.v);
    if (cd.t === 'b') return (typeof cd.num === 'boolean') ? cd.num : /true/i.test(String(cd.v));
    if (cd.t === 'e') return cd.num && cd.num.__err ? undefined : cd.num;
    return (cd.num !== null && cd.num !== undefined && cd.num !== '') ? cd.num : cd.v;
  };
}
/* mirror of the in-app chartData(), plus the canonical range refs the chart XML needs */
function chartSeriesFor(sh, def) {
  const get = cellRawOf(sh);
  const { r1, c1, r2, c2 } = def.range;
  const grid = [];
  for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) row.push(get(r, c)); grid.push(row); }
  if (!grid.length) return { cats: [], series: [], catRef: null };
  const isTxt = v => typeof v === 'string';
  const firstRowTxt = grid[0].filter(v => v != null).length > 0 && grid[0].every(v => v == null || isTxt(v));
  const col0cells = grid.slice(firstRowTxt ? 1 : 0).map(row => row[0]);
  const firstColTxt = col0cells.length > 0 && col0cells.some(v => v != null && v !== '') && col0cells.every(v => v == null || isTxt(v));
  let cats = [], series = [], catRef = null;
  const abs1 = colName(def.range.c1);
  if (!def.byRow) {
    const dataR1 = firstRowTxt ? 1 : 0, dataC1 = firstColTxt ? 1 : 0;
    cats = grid.slice(dataR1).map((row, i) => firstColTxt ? (row[0] != null ? String(row[0]) : String(i + 1)) : String(i + 1));
    if (firstColTxt) catRef = refOf(sh, r1 + dataR1, c1, r2, c1);
    for (let c = dataC1; c <= c2 - c1; c++) {
      const vals = grid.slice(dataR1).map(row => { const v = row[c]; return typeof v === 'number' ? v : isTxt(v) && String(v).trim() !== '' && !isNaN(+v) ? +v : null; });
      if (vals.every(v => v == null)) continue;
      const nm = firstRowTxt && grid[0][c] != null && grid[0][c] !== '' ? String(grid[0][c]) : 'Series' + (c - dataC1 + 1);
      series.push({
        name: nm, vals,
        ref: refOf(sh, r1 + dataR1, c1 + c, r2, c1 + c),
        nameRef: firstRowTxt ? refOf(sh, r1, c1 + c, r1, c1 + c) : null,
      });
    }
  } else {
    const dataR1 = firstColTxt ? 1 : 0, dataC1 = firstRowTxt ? 1 : 0;
    cats = grid[0].slice(dataC1).map((v, i) => firstRowTxt ? (v != null ? String(v) : String(i + 1)) : String(i + 1));
    if (firstRowTxt) catRef = refOf(sh, r1, c1 + dataC1, r1, c2);
    for (let r = dataR1; r <= r2 - r1; r++) {
      const row = grid[r];
      const vals = row.slice(dataC1).map(v => typeof v === 'number' ? v : isTxt(v) && String(v).trim() !== '' && !isNaN(+v) ? +v : null);
      if (vals.every(v => v == null)) continue;
      const nm = firstColTxt && row[0] != null && row[0] !== '' ? String(row[0]) : 'Series' + (r - dataR1 + 1);
      series.push({
        name: nm, vals,
        ref: refOf(sh, r1 + r, c1 + dataC1, r1 + r, c2),
        nameRef: firstColTxt ? refOf(sh, r1 + r, c1, r1 + r, c1) : null,
      });
    }
  }
  return { cats, series, catRef };
}
function strCache(vals) {
  return `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${escXml(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
}
function numCache(vals) {
  const n = vals.filter(v => v != null).length;
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => v == null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache>`;
}
function catXml(catRef, cats) {
  if (catRef) return `<c:cat><c:strRef><c:f>${escXml(catRef)}</c:f>${strCache(cats)}</c:strRef></c:cat>`;
  return `<c:cat><c:strLit><c:ptCount val="${cats.length}"/>${cats.map((v, i) => `<c:pt idx="${i}"><c:v>${escXml(v)}</c:v></c:pt>`).join('')}</c:strLit></c:cat>`;
}
const hex = (c, d) => { const m = /^#?([0-9A-Fa-f]{6})/.exec(String(c || '')); return (m ? m[1] : d).toUpperCase(); };
const CHART_COLORS = ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '264478', '9E480E', '636363', '997300'];

function chartPartXml(sh, o) {
  const def = o.chart, type = def.type;
  const { cats, series, catRef } = chartSeriesFor(sh, def);
  const axCat = 111111111, axVal = 222222222;
  let parts = '';
  parts += `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  parts += `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
  parts += `<c:chart>`;
  if (def.title != null) {
    parts += `<c:title><c:tx><c:rich><a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="0" i="0" u="none" strike="noStrike"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:r><a:rPr lang="en-US" sz="1400"/><a:t>${escXml(def.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
  }
  parts += `<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>`;
  const serXml = (t) => series.map((s, i) => {
    const col = CHART_COLORS[i % CHART_COLORS.length];
    const marker = (type === 'line' || type === 'scatter') ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></a:ln></c:spPr></c:marker>` : '';
    const smooth = t === 'lineChart' ? `<c:smooth val="0"/>` : '';
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>` +
      (s.nameRef ? `<c:tx><c:strRef><c:f>${escXml(s.nameRef)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escXml(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`
                 : `<c:tx><c:v>${escXml(s.name)}</c:v></c:tx>`) +
      `<c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></a:ln></c:spPr>` +
      marker +
      catXml(catRef, cats) +
      `<c:val><c:numRef><c:f>${escXml(s.ref)}</c:f>${numCache(s.vals)}</c:numRef></c:val>${smooth}</c:ser>`;
  }).join('');
  const axXml = (barSwapped) => {
    const catPos = barSwapped ? 'l' : 'b', valPos = barSwapped ? 'b' : 'l';
    return `<c:catAx><c:axId val="${axCat}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${catPos}"/><c:tickLblPos val="nextTo"/><c:crossAx val="${axVal}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
      `<c:valAx><c:axId val="${axVal}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${valPos}"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="${axCat}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  };
  if (type === 'col' || type === 'bar') {
    parts += `<c:barChart><c:barDir val="${type === 'col' ? 'col' : 'bar'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${serXml('barChart')}<c:gapWidth val="150"/><c:axId val="${axCat}"/><c:axId val="${axVal}"/></c:barChart>` + axXml(type === 'bar');
  } else if (type === 'line') {
    parts += `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${serXml('lineChart')}<c:marker val="1"/><c:axId val="${axCat}"/><c:axId val="${axVal}"/></c:lineChart>` + axXml(false);
  } else if (type === 'area') {
    parts += `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${serXml('areaChart')}<c:axId val="${axCat}"/><c:axId val="${axVal}"/></c:areaChart>` + axXml(false);
  } else if (type === 'pie' || type === 'doughnut') {
    const s = series[0] || { name: 'Series1', vals: [], ref: catRef || refOf(sh, 0, 0, 0, 0), nameRef: null };
    const col = i => CHART_COLORS[i % CHART_COLORS.length];
    const pts = s.vals.map((v, i) => v == null ? '' : `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${col(i)}"/></a:solidFill></c:spPr></c:dPt>`).join('');
    const one = `<c:ser><c:idx val="0"/><c:order val="0"/>` +
      (s.nameRef ? `<c:tx><c:strRef><c:f>${escXml(s.nameRef)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escXml(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>` : `<c:tx><c:v>${escXml(s.name)}</c:v></c:tx>`) +
      pts + catXml(catRef, cats) +
      `<c:val><c:numRef><c:f>${escXml(s.ref)}</c:f>${numCache(s.vals)}</c:numRef></c:val></c:ser>`;
    if (type === 'pie') parts += `<c:pieChart><c:varyColors val="1"/>${one}<c:firstSliceAng val="0"/></c:pieChart>`;
    else parts += `<c:doughnutChart><c:varyColors val="1"/>${one}<c:holeSize val="55"/><c:firstSliceAng val="0"/></c:doughnutChart>`;
  } else if (type === 'scatter') {
    const xs = series[0] || { vals: [], ref: catRef || refOf(sh, 0, 0, 0, 0) };
    const one = series.slice(1).map((s, i) => {
      const col = CHART_COLORS[i % CHART_COLORS.length];
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>` +
        `<c:tx><c:v>${escXml(s.name)}</c:v></c:tx>` +
        `<c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></a:ln></c:spPr>` +
        `<c:xVal><c:numRef><c:f>${escXml(xs.ref)}</c:f>${numCache(xs.vals)}</c:numRef></c:xVal>` +
        `<c:yVal><c:numRef><c:f>${escXml(s.ref)}</c:f>${numCache(s.vals)}</c:numRef></c:yVal><c:smooth val="0"/></c:ser>`;
    }).join('');
    parts += `<c:scatterChart><c:scatterStyle val="lineMarker"/>${one}<c:axId val="${axCat}"/><c:axId val="${axVal}"/></c:scatterChart>` +
      `<c:valAx><c:axId val="${axCat}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="${axVal}"/><c:crosses val="autoZero"/></c:valAx>` +
      `<c:valAx><c:axId val="${axVal}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="${axCat}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  }
  parts += `</c:plotArea>`;
  if (def.legend !== 'none') parts += `<c:legend><c:legendPos val="${{ right: 'r', left: 'l', top: 't', bottom: 'b' }[def.legend] || 'r'}"/><c:overlay val="0"/></c:legend>`;
  parts += `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
  return parts;
}

function shapePrst(o) {
  const fill = hex(o.shape && o.shape.fill, '4472C4'), line = hex(o.shape && o.shape.line, '2E5AAC');
  const geom = { rect: 'rect', oval: 'ellipse', arrow: 'rightArrow', line: 'line' }[o.kind] || 'rect';
  return { fill, line, geom };
}
function dataUrlToU8(src) {
  const m = /^data:(image\/(png|jpe?g|gif));base64,(.+)$/i.exec(src || '');
  if (!m) return null;
  const bin = atob(m[3]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { u8, ext: /jpe?g/i.test(m[2]) ? 'jpeg' : m[2].toLowerCase(), ct: /jpe?g/i.test(m[2]) ? 'image/jpeg' : (m[1].toLowerCase()) };
}
const argb = hex => { hex = (hex || '').replace('#', ''); if (hex.length === 3) hex = hex.split('').map(x => x + x).join(''); return ('FF' + hex).toUpperCase(); };
const hexOf = a => { if (!a) return null; a = a.slice(-6); return '#' + a.toUpperCase(); };

/* Built-in number format ids we recognise on import / reuse on export */
const BUILTIN_FMTS = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%',
  11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'mm/dd/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm',
  17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yy h:mm',
  37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)',
  44: '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)', 45: 'mm:ss', 46: '[h]:mm:ss',
  47: 'mmss.0', 48: '##0.0E+0', 49: '@',
};
const BUILTIN_BY_CODE = {}; for (const [k, v] of Object.entries(BUILTIN_FMTS)) BUILTIN_BY_CODE[v.toLowerCase()] = +k;

/* ==========================================================================
   EXPORT
   ========================================================================== */
function buildXlsx(X) {
  const Calc = window.Calc;
  const state = X.state;
  const files = [];

  /* --- style tables --- */
  const numFmts = new Map();   // code -> id
  const fonts = [], fills = [], borders = [], xfs = [];
  const fontKey = {}, fillKey = {}, borderKey = {}, xfKey = {};
  const baseFont = { name: 'Calibri', size: 11, color: '#000000' };
  fonts.push(baseFont); fontKey[JSON.stringify(baseFont)] = 0;
  fills.push({ pat: 'none' }, { pat: 'gray125' }); fillKey['none'] = 0; fillKey['gray125'] = 1;
  borders.push({}); borderKey['{}'] = 0;
  function numFmtId(code) {
    if (!code || code.toLowerCase() === 'general') return 0;
    if (BUILTIN_BY_CODE[code.toLowerCase()] != null) return BUILTIN_BY_CODE[code.toLowerCase()];
    if (numFmts.has(code)) return numFmts.get(code);
    const id = 164 + numFmts.size; numFmts.set(code, id); return id;
  }
  function fontId(s) {
    const f = { name: s.font || 'Calibri', size: +((s.size || 11).toFixed ? (s.size || 11) : 11) || 11 };
    if (s.b) f.b = 1; if (s.i) f.i = 1; if (s.u === 'double') f.u2 = 1; else if (s.u) f.u = 1;
    if (s.strike) f.strike = 1; f.color = s.color || '#000000';
    const k = JSON.stringify(f);
    if (fontKey[k] != null) return fontKey[k];
    fonts.push(f); return (fontKey[k] = fonts.length - 1);
  }
  function fillId(s) {
    const k = s.bg ? 'solid:' + s.bg : 'none';
    if (fillKey[k] != null) return fillKey[k];
    fills.push(s.bg ? { pat: 'solid', fg: s.bg } : { pat: 'none' }); return (fillKey[k] = fills.length - 1);
  }
  const bmap = st => st === 'dashed' ? 'dashed' : st === 'dotted' ? 'dotted' : st === 'double' ? 'double' : ((st === 'solid' || !st) ? 'thin' : 'thin');
  function borderId(s) {
    const b = {};
    for (const [ours, xml] of [['bL', 'l'], ['bR', 'r'], ['bT', 't'], ['bB', 'b']]) {
      if (s[ours] && s[ours].st) b[xml] = { st: (s[ours].w || 1) >= 2.5 ? 'medium' : bmap(s[ours].st), cl: s[ours].cl || '#000000' };
    }
    const k = JSON.stringify(b);
    if (borderKey[k] != null) return borderKey[k];
    borders.push(b); return (borderKey[k] = borders.length - 1);
  }
  function xfId(cd) {
    const s = cd.s || {};
    const xf = {
      numFmtId: numFmtId(cd.f),
      fontId: fontId(s), fillId: fillId(s), borderId: borderId(s),
      h: s.halign === 'right' ? 'right' : s.halign === 'center' ? 'center' : null,
      v: s.valign === 'top' ? 'top' : s.valign === 'bottom' ? 'bottom' : s.valign ? 'center' : null,
      wrap: s.wrap ? 1 : 0, indent: s.indent || 0,
    };
    const k = JSON.stringify(xf);
    if (xfKey[k] != null) return xfKey[k];
    xfs.push(xf); return (xfKey[k] = xfs.length - 1);
  }

  /* --- sheets --- */
  const sheetXml = [];
  state.sheets.forEach((sh, si) => {
    // first pass: collect styles for existing cells + used bounds
    let usedR = 0, usedC = 0;
    for (const k of Object.keys(sh.cells)) {
      const cd = sh.cells[k];
      if (!cd || (cd.v == null && !cd.s)) continue;
      const i = k.indexOf(',');
      const rr = +k.slice(0, i), cc = +k.slice(i + 1);
      if (rr > usedR) usedR = rr; if (cc > usedC) usedC = cc;
      cd._xf = xfId(cd);
    }
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
    xml += `<dimension ref="A1:${colName(Math.max(0, usedC))}${Math.max(1, usedR + 1)}"/>`;
    xml += `<sheetViews><sheetView workbookViewId="0"${si === state.active ? ' tabSelected="1"' : ''}${state.showGrid ? '' : ' showGridLines="0"'}>`;
    if (sh.freeze.r || sh.freeze.c) {
      const panes = [];
      if (sh.freeze.c) panes.push(`xSplit="${sh.freeze.c}"`);
      if (sh.freeze.r) panes.push(`ySplit="${sh.freeze.r}"`);
      xml += `<pane ${panes.join(' ')} topLeftCell="${colName(sh.freeze.c)}${sh.freeze.r + 1}" activePane="${sh.freeze.r && sh.freeze.c ? 'bottomRight' : sh.freeze.r ? 'bottomLeft' : 'topRight'}" state="frozen"/>`;
    }
    xml += `</sheetView></sheetViews>`;
    xml += `<sheetFormatPr defaultRowHeight="15"/>`;
    const colKeys = Object.keys(sh.colW).map(Number).sort((a, b) => a - b);
    if (colKeys.length || Object.keys(sh.hidC).length) {
      xml += '<cols>';
      for (const c of colKeys) {
        const hidden = sh.hidC[c] ? ' hidden="1"' : '';
        xml += `<col min="${c + 1}" max="${c + 1}" width="${(sh.colW[c] / 7).toFixed(2)}" customWidth="1"${hidden}/>`;
      }
      for (const c of Object.keys(sh.hidC).map(Number)) if (!sh.colW[c]) xml += `<col min="${c + 1}" max="${c + 1}" width="9.14" hidden="1"/>`;
      xml += '</cols>';
    }
    xml += '<sheetData>';
    for (let r = 0; r <= usedR; r++) {
      if (sh.hidR[r] && !Object.keys(sh.cells).some(k => +k.split(',')[0] === r)) { xml += `<row r="${r + 1}" hidden="1"/>`; continue; }
      const rowCells = [];
      for (let c = 0; c <= usedC; c++) {
        const cd = sh.cells[r + ',' + c];
        if (!cd || (cd.v == null && !cd.s)) continue;
        rowCells.push([c, cd]);
      }
      if (!rowCells.length && !sh.rowH[r] && !sh.hidR[r]) continue;
      const rh = sh.rowH[r] ? ` ht="${(sh.rowH[r] * 0.75).toFixed(1)}" customHeight="1"` : '';
      xml += `<row r="${r + 1}"${rh}${sh.hidR[r] ? ' hidden="1"' : ''}>`;
      for (const [c, cd] of rowCells) {
        const ref = colName(c) + (r + 1);
        const sAttr = cd._xf ? ` s="${cd._xf}"` : '';
        if (cd.v == null) { xml += `<c r="${ref}"${sAttr}/>`; continue; }
        if (cd.t === 'f') {
          const f = String(cd.v).replace(/^=/, '');
          const v = cd.num;
          if (typeof v === 'number' && isFinite(v)) xml += `<c r="${ref}"${sAttr}><f>${escXml(f)}</f><v>${v}</v></c>`;
          else if (typeof v === 'boolean') xml += `<c r="${ref}"${sAttr} t="b"><f>${escXml(f)}</f><v>${v ? 1 : 0}</v></c>`;
          else if (Calc.isErr(v)) xml += `<c r="${ref}"${sAttr} t="e"><f>${escXml(f)}</f><v>${v.__err}</v></c>`;
          else if (typeof v === 'string' && v !== '') xml += `<c r="${ref}"${sAttr} t="str"><f>${escXml(f)}</f><v>${escXml(v)}</v></c>`;
          else xml += `<c r="${ref}"${sAttr}><f>${escXml(f)}</f></c>`;
        } else if (cd.t === 'n') {
          const n = parseFloat(cd.v);
          xml += isNaN(n) ? `<c r="${ref}"${sAttr} t="inlineStr"><is><t>${escXml(cd.v)}</t></is></c>` : `<c r="${ref}"${sAttr}><v>${n}</v></c>`;
        } else if (cd.t === 'b') {
          xml += `<c r="${ref}"${sAttr} t="b"><v>${cd.num ? 1 : 0}</v></c>`;
        } else if (cd.t === 'e') {
          xml += `<c r="${ref}"${sAttr} t="e"><v>${escXml(cd.num && cd.num.__err ? cd.num.__err : cd.v)}</v></c>`;
        } else {
          xml += `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escXml(cd.v)}</t></is></c>`;
        }
      }
      xml += '</row>';
    }
    xml += '</sheetData>';
    for (const t of Object.values(sh.tables)) {
      if (t.isAutoFilter) xml += `<autoFilter ref="${colName(t.c1)}${t.r1 + 1}:${colName(t.c2)}${t.r2 + 1}"/>`;
    }
    if (sh.merges.length) {
      xml += `<mergeCells count="${sh.merges.length}">`;
      for (const m of sh.merges) xml += `<mergeCell ref="${colName(m.c1)}${m.r1 + 1}:${colName(m.c2)}${m.r2 + 1}"/>`;
      xml += '</mergeCells>';
    }
    xml += '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>';
    if (sh.charts && sh.charts.length) xml += `<drawing r:id="rId900"/>`;
    xml += '</worksheet>';
    files.push({ name: `xl/worksheets/sheet${si + 1}.xml`, data: te.encode(xml) });
    sheetXml.push(xml);
  });

  /* --- drawings: charts / pictures / shapes per sheet --- */
  const chartCTO = [], imgDefaults = new Set();
  let chartSeq = 1, imgSeq = 1;
  state.sheets.forEach((sh, si) => {
    const objs = (sh.charts || []).filter(o => o && o.a && o.b);
    if (!objs.length) return;
    const relEntries = [];
    let dr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`;
    objs.forEach((o, oi) => {
      const id = (si + 1) * 100 + oi + 2;
      const from = `<xdr:from><xdr:col>${o.a.c}</xdr:col><xdr:colOff>${clampInt(o.a.ox * EMU)}</xdr:colOff><xdr:row>${o.a.r}</xdr:row><xdr:rowOff>${clampInt(o.a.oy * EMU)}</xdr:rowOff></xdr:from>`;
      const to = `<xdr:to><xdr:col>${o.b.c}</xdr:col><xdr:colOff>${clampInt(o.b.ox * EMU)}</xdr:colOff><xdr:row>${o.b.r}</xdr:row><xdr:rowOff>${clampInt(o.b.oy * EMU)}</xdr:rowOff></xdr:to>`;
      if (o.kind === 'chart') {
        const rid = 'rId' + (oi + 1);
        dr += `<xdr:twoCellAnchor>${from}${to}<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="${escXml('Chart ' + (oi + 1))}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
        relEntries.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartSeq}.xml"/>`);
        files.push({ name: `xl/charts/chart${chartSeq}.xml`, data: te.encode(chartPartXml(sh, o)) });
        chartCTO.push(`<Override PartName="/xl/charts/chart${chartSeq}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        chartSeq++;
      } else if (o.kind === 'picture' && o.pic && o.pic.src) {
        const img = dataUrlToU8(o.pic.src);
        if (img) {
          const rid = 'rId' + (oi + 1);
          const imgName = `image${imgSeq}.${img.ext}`;
          dr += `<xdr:twoCellAnchor>${from}${to}<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="${escXml(o.pic.name || 'Picture')}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
          relEntries.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imgName}"/>`);
          files.push({ name: `xl/media/${imgName}`, data: img.u8 });
          imgDefaults.add(`<Default Extension="${img.ext}" ContentType="${img.ct}"/>`);
          imgSeq++;
        }
      } else if (o.kind === 'textbox' || o.shape) {
        const { fill, line, geom } = shapePrst(o);
        const tx = o.kind === 'textbox';
        const text = String(o.text || o.shape && o.shape.text || '');
        dr += `<xdr:twoCellAnchor>${from}${to}<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${escXml(tx ? 'TextBox' : 'Shape')}${oi + 1}"/><xdr:cNvSpPr${tx ? ' txBox="1"' : ''}/></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${tx ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>`}<a:ln w="12700">${tx ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${line}"/></a:solidFill>`}</a:ln></xdr:spPr><xdr:txBody><a:bodyPr wrap="square"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1200"/><a:t>${escXml(text)}</a:t></a:r></a:p></xdr:txBody></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>`;
      }
    });
    dr += '</xdr:wsDr>';
    files.push({ name: `xl/drawings/drawing${si + 1}.xml`, data: te.encode(dr) });
    /* OPC scoping (the "charts not opening" bug): relationship ids are resolved
       against the OWNING part. r:id/r:embed inside drawingN.xml resolve via
       xl/drawings/_rels/drawingN.xml.rels — NOT the sheet's rels. Without this
       part Excel "repairs" the drawing away and LibreOffice silently drops it. */
    if (relEntries.length) {
      const drels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntries.join('')}</Relationships>`;
      files.push({ name: `xl/drawings/_rels/drawing${si + 1}.xml.rels`, data: te.encode(drels) });
    }
    /* the sheet's own rels only carry the sheet -> drawing link */
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId900" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${si + 1}.xml"/></Relationships>`;
    files.push({ name: `xl/worksheets/_rels/sheet${si + 1}.xml.rels`, data: te.encode(rels) });
  });
  const objCTO = chartCTO.join('') + Array.from(imgDefaults).join('');

  /* --- workbook --- */
  let wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl"/><workbookPr defaultThemeVersion="124226"/>`;
  wb += `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="16384" windowHeight="8192" activeTab="${state.active}"/></bookViews>`;
  wb += '<sheets>';
  state.sheets.forEach((sh, i) => { wb += `<sheet name="${escXml(sh.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`; });
  wb += '</sheets>';
  const nameEntries = Object.entries(state.names || {});
  if (nameEntries.length || state.printArea) {
    wb += '<definedNames>';
    nameEntries.forEach(([n, d]) => { wb += `<definedName name="${escXml(n)}">${escXml(d.ref)}</definedName>`; });
    if (state.printArea) {
      const pa = state.printArea, shN = state.sheets[pa.si || 0] ? state.sheets[pa.si || 0].name : 'Sheet1';
      wb += `<definedName name="_xlnm.Print_Area" localSheetId="${pa.si || 0}">${escXml(`'${shN}'!$${colName(pa.c1)}$${pa.r1 + 1}:$${colName(pa.c2)}$${pa.r2 + 1}`)}</definedName>`;
    }
    wb += '</definedNames>';
  }
  wb += `<calcPr calcId="191029" calcMode="${state.calcMode === 'manual' ? 'manual' : 'auto'}" fullCalcOnLoad="1"/></workbook>`;
  files.push({ name: 'xl/workbook.xml', data: te.encode(wb) });

  /* --- styles --- */
  let st = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;
  if (numFmts.size) {
    st += `<numFmts count="${numFmts.size}">`;
    for (const [code, id] of numFmts) st += `<numFmt numFmtId="${id}" formatCode="${escXml(code)}"/>`;
    st += '</numFmts>';
  }
  st += `<fonts count="${fonts.length}">`;
  for (const f of fonts) {
    st += '<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') + (f.u2 ? '<u val="double"/>' : f.u ? '<u/>' : '') + (f.strike ? '<strike/>' : '') +
      `<sz val="${f.size}"/><color rgb="${argb(f.color || '#000000')}"/><name val="${escXml(f.name)}"/><family val="2"/></font>`;
  }
  st += '</fonts>';
  st += `<fills count="${fills.length}">`;
  for (const fl of fills) {
    st += fl.pat === 'solid' ? `<fill><patternFill patternType="solid"><fgColor rgb="${argb(fl.fg)}"/><bgColor indexed="64"/></patternFill></fill>` : `<fill><patternFill patternType="${fl.pat}"/></fill>`;
  }
  st += '</fills>';
  st += `<borders count="${borders.length}">`;
  for (const b of borders) {
    st += '<border>';
    for (const side of ['l', 'r', 't', 'b']) {
      const d = b[side];
      const tag = side === 'l' ? 'left' : side === 'r' ? 'right' : side === 't' ? 'top' : 'bottom';
      st += d ? `<${tag} style="${d.st}"><color rgb="${argb(d.cl)}"/></${tag}>` : `<${tag}/>`;
    }
    st += '<diagonal/></border>';
  }
  st += '</borders>';
  st += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
  st += `<cellXfs count="${xfs.length}">`;
  for (const x of xfs) {
    const align = (x.h || x.v || x.wrap || x.indent) ? `<alignment${x.h ? ` horizontal="${x.h}"` : ''}${x.v ? ` vertical="${x.v}"` : ''}${x.wrap ? ' wrapText="1"' : ''}${x.indent ? ` indent="${x.indent}"` : ''}/>` : '';
    st += `<xf numFmtId="${x.numFmtId}" fontId="${x.fontId}" fillId="${x.fillId}" borderId="${x.borderId}" xfId="0"${x.numFmtId ? ' applyNumberFormat="1"' : ''}${x.fontId ? ' applyFont="1"' : ''}${x.fillId ? ' applyFill="1"' : ''}${x.borderId ? ' applyBorder="1"' : ''}${align ? ' applyAlignment="1"' : ''}>${align}</xf>`;
  }
  st += '</cellXfs>';
  st += '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';
  files.push({ name: 'xl/styles.xml', data: te.encode(st) });

  /* --- theme (standard Office) --- */
  const th = state.theme || { colors: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] };
  const accs = th.colors.map((c, i) => `<a:accent${i + 1}><a:srgbClr val="${(c || '#4472C4').slice(1).toUpperCase()}"/></a:accent${i + 1}>`);
  let theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>${accs.join('')}<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  files.push({ name: 'xl/theme/theme1.xml', data: te.encode(theme) });

  /* --- rels + content types + docprops --- */
  files.push({
    name: '[Content_Types].xml', data: te.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${state.sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${objCTO}</Types>`)
  });
  files.push({
    name: '_rels/.rels', data: te.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`)
  });
  files.push({
    name: 'xl/_rels/workbook.xml.rels', data: te.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${state.sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${state.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId${state.sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
  });
  const now = new Date().toISOString().replace(/\..*/, 'Z');
  files.push({
    name: 'docProps/core.xml', data: te.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escXml(state.bookName)}</dc:title><dc:creator>${escXml(state.author || 'User')}</dc:creator><cp:lastModifiedBy>${escXml(state.author || 'User')}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(state.created || Date.now()).toISOString().replace(/\..*/, 'Z')}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`)
  });
  files.push({
    name: 'docProps/app.xml', data: te.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" baseType="variant" size="2"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${state.sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" baseType="lpstr" size="${state.sheets.length}">${state.sheets.map(s => `<vt:lpstr>${escXml(s.name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>`)
  });

  // cleanup transient xf cache so it never leaks into the saved model
  for (const sh of state.sheets) for (const k of Object.keys(sh.cells)) delete sh.cells[k]._xf;

  window.XLSX_LAST_PARTS = files.map(f => ({ name: f.name, data: f.data })); // test/diagnostics hook
  return zipStore(files);
}

/* ==========================================================================
   IMPORT  (.xlsx -> our model)   async
   ========================================================================== */
async function readXlsx(X, buf) {
  const Calc = window.Calc;
  const entries = zipEntries(buf);
  const map = {};
  for (const e of entries) {
    let data = e.data;
    if (e.method === 8) data = await inflate(e.data);
    map[e.name] = td.decode(data);
  }
  if (!map['xl/workbook.xml']) throw new Error('Not an Excel workbook');
  const parser = new DOMParser();
  const doc = n => parser.parseFromString(map[n], 'application/xml');

  /* shared strings */
  const shared = [];
  if (map['xl/sharedStrings.xml']) {
    const sd = doc('xl/sharedStrings.xml');
    sd.querySelectorAll('si').forEach(si => {
      shared.push(Array.from(si.querySelectorAll('t')).map(t => t.textContent).join(''));
    });
  }
  /* styles */
  const fmtCodes = { ...BUILTIN_FMTS };
  const fonts = [], fills = [], xfs = [];
  if (map['xl/styles.xml']) {
    const sd = doc('xl/styles.xml');
    sd.querySelectorAll('numFmts > numFmt').forEach(n => { fmtCodes[+n.getAttribute('numFmtId')] = n.getAttribute('formatCode'); });
    sd.querySelectorAll('fonts > font').forEach(f => {
      const fo = {};
      fo.b = !!f.querySelector('b'); fo.i = !!f.querySelector('i');
      const u = f.querySelector('u'); if (u) fo.u = u.getAttribute('val') === 'double' ? 'double' : true;
      fo.strike = !!f.querySelector('strike');
      const sz = f.querySelector('sz'); if (sz) fo.size = parseFloat(sz.getAttribute('val'));
      const nm = f.querySelector('name'); if (nm) fo.font = nm.getAttribute('val');
      const cl = f.querySelector('color'); if (cl && cl.getAttribute('rgb')) fo.color = hexOf(cl.getAttribute('rgb'));
      fonts.push(fo);
    });
    sd.querySelectorAll('fills > fill').forEach(fl => {
      const fg = fl.querySelector('patternFill > fgColor');
      const pat = fl.querySelector('patternFill');
      fills.push(pat && pat.getAttribute('patternType') === 'solid' && fg && fg.getAttribute('rgb') ? { bg: hexOf(fg.getAttribute('rgb')) } : {});
    });
    sd.querySelectorAll('cellXfs > xf').forEach(x => {
      const al = x.querySelector('alignment');
      xfs.push({
        f: fmtCodes[+x.getAttribute('numFmtId') || 0] || null,
        font: fonts[+x.getAttribute('fontId') || 0] || {},
        fill: fills[+x.getAttribute('fillId') || 0] || {},
        h: al ? al.getAttribute('horizontal') : null,
        v: al ? al.getAttribute('vertical') : null,
        wrap: al && al.getAttribute('wrapText') === '1',
        indent: al ? +(al.getAttribute('indent') || 0) : 0,
      });
    });
  }
  /* rels */
  const relMap = {};
  const rd = doc('xl/_rels/workbook.xml.rels');
  rd.querySelectorAll('Relationship').forEach(r => { relMap[r.getAttribute('Id')] = r.getAttribute('Target'); });
  /* workbook */
  const wb = doc('xl/workbook.xml');
  const sheets = [];
  wb.querySelectorAll('sheets > sheet').forEach(s => {
    const rid = s.getAttribute('r:id') || s.getAttribute('id');
    let target = relMap[rid] || ('worksheets/sheet' + (sheets.length + 1) + '.xml');
    let tgt = String(target).replace(/^[\\/]+/, '');      // strip leading '/' (openpyxl) or '\\'
    if (!/^xl\//.test(tgt)) tgt = 'xl/' + tgt;   // 'worksheets/sheet1.xml' -> 'xl/...'
    target = tgt;
    sheets.push({ name: s.getAttribute('name'), path: target });
  });
  const names = {};
  wb.querySelectorAll('definedNames > definedName').forEach(d => {
    const n = d.getAttribute('name');
    if (!n.startsWith('_xlnm.')) names[n] = { ref: d.textContent };
  });

  const out = { names, activeTab: 0 };
  const at = wb.querySelector('bookViews > workbookView');
  if (at) out.activeTab = Math.min(sheets.length - 1, +(at.getAttribute('activeTab') || 0));

  out.sheets = sheets.map(sd => {
    const sh = X.newSheetBlank(sd.name);
    if (!map[sd.path]) return sh;
    const sdoc = doc(sd.path);
    const pane = sdoc.querySelector('pane');
    if (pane) sh.freeze = { r: +(pane.getAttribute('ySplit') || 0), c: +(pane.getAttribute('xSplit') || 0) };
    const sv = sdoc.querySelector('sheetView');
    if (sv && sv.getAttribute('showGridLines') === '0') sh.noGrid = true;
    sdoc.querySelectorAll('cols > col').forEach(col => {
      const min = +col.getAttribute('min') - 1, max = Math.min(+col.getAttribute('max') - 1, min + 30);
      const w = parseFloat(col.getAttribute('width') || '9.14');
      for (let c = min; c <= max; c++) {
        sh.colW[c] = Math.round(w * 7);
        if (col.getAttribute('hidden') === '1') sh.hidC[c] = true;
      }
    });
    sdoc.querySelectorAll('sheetData > row').forEach(row => {
      const r = +row.getAttribute('r') - 1;
      if (row.getAttribute('hidden') === '1') sh.hidR[r] = true;
      if (row.getAttribute('ht')) sh.rowH[r] = Math.round(parseFloat(row.getAttribute('ht')) / 0.75);
      row.querySelectorAll('c').forEach(cv => {
        const ref = cv.getAttribute('r');
        const m = ref.match(/^([A-Z]+)(\d+)$/);
        if (!m) return;
        const pr = Calc.parseRef(m[1] + m[2]);
        const rr = pr.r, cc = pr.c;
        if (rr > 500000 || cc > 2000) return; // sanity
        const t = cv.getAttribute('t') || 'n';
        const sIdx = +(cv.getAttribute('s') || 0);
        const xf = xfs[sIdx] || null;
        const vEl = cv.querySelector('v'), fEl = cv.querySelector('f');
        if (fEl) {
          const f = fEl.textContent;
          if (/^(Table|\[)/.test(f)) return; // structured refs unsupported — keep cached
        }
        let cd = null;
        const rawV = vEl ? vEl.textContent : null;
        if (fEl && fEl.textContent) {
          cd = { v: '=' + fEl.textContent, t: 'f', num: rawV != null && rawV !== '' ? (t === 'str' ? rawV : t === 'b' ? rawV === '1' : t === 'e' ? { __err: rawV } : parseFloat(rawV)) : null, f: null, s: null };
        } else if (t === 's') {
          cd = { v: shared[+rawV] != null ? shared[+rawV] : '', t: 's', num: null, f: null, s: null };
        } else if (t === 'inlineStr') {
          cd = { v: Array.from(cv.querySelectorAll('t')).map(x => x.textContent).join(''), t: 's', num: null, f: null, s: null };
        } else if (t === 'str') {
          cd = { v: rawV || '', t: 's', num: null, f: null, s: null };
        } else if (t === 'b') {
          cd = { v: rawV === '1' ? 'TRUE' : 'FALSE', t: 'b', num: rawV === '1', f: null, s: null };
        } else if (t === 'e') {
          cd = { v: rawV || '#VALUE!', t: 'e', num: { __err: rawV || '#VALUE!' }, f: null, s: null };
        } else if (rawV != null && rawV !== '') {
          cd = { v: rawV, t: 'n', num: parseFloat(rawV), f: null, s: null };
        }
        if (!cd && (xf || sIdx)) cd = { v: null, t: 's', num: null, f: null, s: {} };
        if (!cd) return;
        if (xf) {
          cd.f = xf.f && xf.f !== 'General' ? xf.f : null;
          const st = {};
          Object.assign(st, xf.font);
          if (xf.fill.bg && xf.fill.bg !== '#FFFFFF') st.bg = xf.fill.bg;
          if (xf.h && xf.h !== 'general') st.halign = xf.h === 'centerContinuous' ? 'center' : xf.h;
          if (xf.v && xf.v !== 'bottom') st.valign = xf.v;
          if (xf.wrap) st.wrap = true;
          if (xf.indent) st.indent = xf.indent;
          if (st.u === true) st.u = 'single';
          for (const k of Object.keys(st)) if (st[k] == null || st[k] === false) delete st[k];
          if (Object.keys(st).length) cd.s = st;
        }
        sh.cells[rr + ',' + cc] = cd;
      });
    });
    sdoc.querySelectorAll('mergeCells > mergeCell').forEach(mc => {
      const mm = mc.getAttribute('ref').match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!mm) return;
      const a = Calc.parseRef(mm[1] + mm[2]), b = Calc.parseRef(mm[3] + mm[4]);
      sh.merges.push({ r1: a.r, c1: a.c, r2: b.r, c2: b.c });
    });
    const af = sdoc.querySelector('autoFilter');
    if (af) {
      const mm = af.getAttribute('ref').match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (mm) {
        const a = Calc.parseRef(mm[1] + mm[2]), b = Calc.parseRef(mm[3] + mm[4]);
        const id = 't' + Math.random().toString(36).slice(2, 8);
        sh.tables[id] = { r1: a.r, c1: a.c, r2: b.r, c2: b.c, name: 'Table1', style: null, isAutoFilter: true, filter: {} };
      }
    }
    X.rebuildSubOfFor(sh);
    return sh;
  });
  if (!out.sheets.length) out.sheets.push(X.newSheetBlank('Sheet1'));
  return out;
}

/* ---------------- CSV ---------------- */
function buildCsv(X) {
  const sh = X.sheet();
  const r2 = X.usedR2(sh), c2 = X.usedC2(sh);
  const lines = [];
  for (let r = 0; r <= r2; r++) {
    const row = [];
    for (let c = 0; c <= c2; c++) {
      const d = X.cellDisplay(r, c);
      let v = d ? d.text : '';
      if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      row.push(v);
    }
    lines.push(row.join(','));
  }
  return lines.join('\r\n');
}
function parseCsvText(text) {
  const rows = [];
  let cur = [], f = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inQ = false; }
      else f += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { cur.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(f); f = ''; rows.push(cur); cur = [];
    } else f += ch;
  }
  if (f !== '' || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}

window.Xlsx = { buildXlsx, readXlsx, buildCsv, parseCsvText, crc32, zipStore };
})();
