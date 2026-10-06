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
   pptx.js — real .pptx export (valid OOXML PresentationML package) + import
   Export: stored (uncompressed) ZIP with correct CRC32 — opens in real
   PowerPoint. Slides are emitted as p:sp shapes with explicit xfrm (EMU),
   a:tbl tables, p:pic images, transitions and a generated theme1.xml.
   Import: ZIP central-directory reader (method 0 raw, method 8 inflated via
   the browser DecompressionStream); parses slides back into the model.
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
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Not a ZIP file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
    const data = u8.subarray(lho + 30 + lnlen + lelen, lho + 30 + lnlen + lelen + csize);
    out.set(name, { method, data });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
async function entryText(map, name) {
  const e = map.get(name);
  if (!e) return null;
  const data = e.method === 8 ? await inflateRaw(e.data) : e.data;
  return td.decode(data);
}
async function entryBytes(map, name) {
  const e = map.get(name);
  if (!e) return null;
  return e.method === 8 ? await inflateRaw(e.data) : e.data;
}

/* ---------------- XML helpers ---------------- */
const xesc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const aesc = s => xesc(s).replace(/"/g, '&quot;');
const hx = c => { c = String(c || '').replace('#', ''); return c.length === 3 ? c.split('').map(x => x + x).join('').toUpperCase() : c.toUpperCase(); };
const EMU = px => Math.round(px * 9525);
const PX = emu => Math.round(emu / 9525);

/* shape name mapping (internal key <-> OOXML prstGeom) */
const GEO_TO = {
  rect: 'rect', roundRect: 'roundRect', oval: 'ellipse', triangle: 'triangle', rightTri: 'rtTriangle',
  rtTriangle: 'rtTriangle',
  diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon',
  parallelogram: 'parallelogram', trapezoid: 'trapezoid', chevron: 'chevron', star4: 'star4', star5: 'star5',
  heart: 'heart', lightning: 'lightningBolt', sun: 'sun', moon: 'moon', cloud: 'cloud',
  smiley: 'smileyFace', donut: 'donut', pie: 'pie', arrowRight: 'rightArrow', arrowLeft: 'leftArrow',
  arrowUp: 'upArrow', arrowDown: 'downArrow', arrowLR: 'leftRightArrow', cube: 'cube', cylinder: 'can',
  cone: 'cone', frameCorner: 'corner', cross: 'plus', calloutRound: 'wedgeRoundRectCallout',
  calloutSquare: 'wedgeRectCallout', line: 'line', lineArrow: 'line', flow1: 'rect',
};
const GEO_FROM = {};
for (const k in GEO_TO) if (!GEO_FROM[GEO_TO[k]]) GEO_FROM[GEO_TO[k]] = k;
GEO_FROM.rect = 'rect';

const ALGN = { l: 'l', c: 'ctr', r: 'r', j: 'just' };
const ALGN_FROM = { l: 'l', ctr: 'c', r: 'r', just: 'j' };
const BULLET_CH = { char: '•', dash: '–', square: '▪' };
const ANCHOR = { t: 't', m: 'ctr', b: 'b' };
const ANCHOR_FROM = { t: 't', ctr: 'm', b: 'b' };

/* ---------------- model → slide XML ---------------- */
function rPrXml(r, defs) {
  const sz = Math.round((r.size || defs.fs || 18) * 100);
  const at = [`lang="en-US"`, `sz="${sz}"`, `dirty="0"`];
  if (r.b) at.push('b="1"');
  if (r.i) at.push('i="1"');
  if (r.u) at.push('u="sng"');
  if (r.strike) at.push('strike="sngStrike"');
  if (r.spacing) at.push(`spc="${Math.round(r.spacing * 100)}"`);
  const col = r.color || defs.color;
  let inner = '';
  if (col && /^#/.test(col)) inner += `<a:solidFill><a:srgbClr val="${hx(col)}"/></a:solidFill>`;
  if (r.highlight) inner += `<a:highlight><a:srgbClr val="${hx(r.highlight)}"/></a:highlight>`;
  const font = r.font || defs.font;
  if (font) inner += `<a:latin typeface="${aesc(font)}"/>`;
  return `<a:rPr ${at.join(' ')}${inner ? '>' + inner + '</a:rPr>' : '/>'}`;
}
function paraXml(o, p, defs) {
  const runs = p.runs.filter(r => r.t !== '').length ? p.runs : (p.runs.length ? p.runs : [{ t: '' }]);
  const lvl = p.level || 0;
  let ppr = '';
  const attrs = [];
  if (lvl) attrs.push(`lvl="${lvl}"`);
  if (p.align && ALGN[p.align] && p.align !== defs.al) attrs.push(`algn="${ALGN[p.align]}"`);
  const bullet = o.noBullet ? 'none' : (p.bullet == null ? defs.bullet : p.bullet);
  let bulletXml = '';
  if (bullet === 'none') bulletXml = '<a:buNone/>';
  else if (bullet === 'num') { attrs.push('marL="342900"', 'indent="-342900"'); bulletXml = '<a:buFont typeface="Arial"/><a:buAutoNum type="arabicPeriod"/>'; }
  else if (bullet && bullet !== 'none') {
    attrs.push('marL="342900"', 'indent="-342900"');
    bulletXml = `<a:buFont typeface="Arial"/><a:buChar char="${aesc(BULLET_CH[bullet] || '•')}"/>`;
  }
  let spacingXml = '';
  if (p.spaceAfter) spacingXml += `<a:spcAft><a:spcPts val="${Math.round(p.spaceAfter * 100)}"/></a:spcAft>`;
  if (p.line && p.line !== 1) spacingXml += `<a:lnSpc><a:spcPct val="${Math.round(p.line * 100000)}"/></a:lnSpc>`;
  if (attrs.length || bulletXml || spacingXml) ppr = `<a:pPr ${attrs.join(' ')}>${spacingXml}${bulletXml}</a:pPr>`;
  const rXml = runs.map(r => `<a:r>${rPrXml(r, defs)}<a:t>${xesc(r.t)}</a:t></a:r>`).join('');
  const last = runs[runs.length - 1] || { t: '' };
  return `<a:p>${ppr}${rXml}<a:endParaRPr lang="en-US" sz="${Math.round((last.size || defs.fs || 18) * 100)}" dirty="0"/></a:p>`;
}
function txBodyXml(o) {
  const defs = { fs: o.fs || 18, al: o.al || 'l', bullet: 'char', font: o.font, color: o.color };
  const paras = (o.paras && o.paras.length ? o.paras : [{ runs: [{ t: '' }], level: 0 }]);
  return `<p:txBody><a:bodyPr vert="horz" wrap="square" anchor="${ANCHOR[o.anchor] || 't'}" rtlCol="0" lIns="91440" tIns="45720" rIns="91440" bIns="45720"/>`
    + `<a:lstStyle/><a:p0/>`.replace('<a:p0/>', '')
    + paras.map(p => paraXml(o, p, defs)).join('') + '</p:txBody>';
}
function fillXml(o, defThemeA1) {
  // returns [shapeFillXml, hasFill]
  const f = o.fill;
  if (f == null) return [`<a:solidFill><a:srgbClr val="${hx(defThemeA1)}"/></a:solidFill>`, true];
  if (f === 'none' || f.t === 'none') return ['<a:noFill/>', false];
  if (f.t === 'theme') return [`<a:solidFill><a:schemeClr val="${schemeOf(f.c)}"/></a:solidFill>`, true];
  if (f.t === 'grad') {
    const ang = Math.round(((f.ang || 90) % 360) * 60000);
    return [`<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="${hx(f.c1)}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${hx(f.c2)}"/></a:gs></a:gsLst><a:lin ang="${ang}" scaled="1"/></a:gradFill>`, true];
  }
  const alpha = f.alpha != null && f.alpha < 1 ? `<a:alpha val="${Math.round(f.alpha * 100000)}"/>` : '';
  return [`<a:solidFill><a:srgbClr val="${hx(f.c)}">${alpha}</a:srgbClr></a:solidFill>`, true];
}
function schemeOf(c) {
  return { a1: 'accent1', a2: 'accent2', a3: 'accent3', a4: 'accent4', a5: 'accent5', a6: 'accent6', dk1: 'dk1', lt1: 'lt1', dk2: 'dk2', lt2: 'lt2', hl: 'hlink' }[c] || 'accent1';
}
function lnXml(o, defThemeA1) {
  const ln = o.line;
  if (ln === 'none') return '<a:ln><a:noFill/></a:ln>';
  const real = ln || { c: defThemeA1, w: 1.25 };
  const w = Math.round((real.w || 1.25) * 12700);
  const c = /^#/.test(real.c || '') ? `<a:srgbClr val="${hx(real.c)}"/>` : `<a:schemeClr val="${schemeOf(real.c)}"/>`;
  return `<a:ln w="${w}"><a:solidFill>${c}</a:solidFill></a:ln>`;
}
function spXml(o, id, th) {
  const isTextBox = o.kind === 'text';
  const isLine = o.shape === 'line' || o.shape === 'lineArrow';
  const prst = isTextBox ? 'rect' : (GEO_TO[o.shape] || 'rect');
  const phXml = o.ph ? `<p:ph type="${o.ph === 'title' ? 'title' : 'body'}"${o.ph !== 'title' ? ' idx="1"' : ''}/>` : '';
  const rot = o.rot ? ` rot="${Math.round(o.rot * 60000)}"` : '';
  let fill, ln;
  if (isTextBox) { fill = fillXml(o.fill && o.fill.t !== 'none' ? o.fill : { t: 'none' }, th.a1)[0]; ln = '<a:ln><a:noFill/></a:ln>'; }
  else if (isLine) {
    const lnc = o.line && o.line !== 'none' ? o.line : { c: th.dk1, w: 1 };
    fill = '';
    ln = `<a:ln w="${Math.round((lnc.w || 1) * 12700)}"><a:solidFill>${/^#/.test(lnc.c || '') ? `<a:srgbClr val="${hx(lnc.c)}"/>` : `<a:schemeClr val="${schemeOf(lnc.c)}"/>`}</a:solidFill>${o.shape === 'lineArrow' ? '<a:tailEnd type="triangle"/>' : ''}</a:ln>`;
  } else { fill = fillXml(o.fill, th.a1)[0]; ln = lnXml(o, th.a1); }
  const eff = o.shadow ? '<a:effectLst><a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>' : '';
  const descr = [];
  if (o.link) descr.push('link:' + o.link);
  const descrAttr = descr.length ? ` descr="${aesc(descr.join(';'))}"` : '';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${aesc(o.name || (o.kind === 'shape' ? o.shape : 'TextBox') + ' ' + id)}"${descrAttr}/>`
    + `<p:cNvSpPr${isTextBox ? ' txBox="1"' : ''}/><p:nvPr>${phXml}</p:nvPr></p:nvSpPr>`
    + `<p:spPr><a:xfrm${rot}><a:off x="${EMU(o.x)}" y="${EMU(o.y)}"/><a:ext cx="${EMU(o.w)}" cy="${EMU(o.h)}"/></a:xfrm>`
    + `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fill}${ln}${eff}</p:spPr>`
    + (o.paras ? txBodyXml(o) : '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>')
    + '</p:sp>';
}
function picXml(o, id, rid) {
  const rot = o.rot ? ` rot="${Math.round(o.rot * 60000)}"` : '';
  const c = o.crop || { l: 0, t: 0, r: 0, b: 0 };
  const sr = (c.l || c.t || c.r || c.b)
    ? `<a:srcRect${c.l ? ` l="${Math.round(c.l * 1000)}"` : ''}${c.t ? ` t="${Math.round(c.t * 1000)}"` : ''}${c.r ? ` r="${Math.round(c.r * 1000)}"` : ''}${c.b ? ` b="${Math.round(c.b * 1000)}"` : ''}/>` : '';
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${aesc(o.name || 'Picture ' + id)}"/><p:cNvPicPr/><p:nvPr>${o.ph ? '<p:ph idx="1"/>' : ''}</p:nvPr></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch>${sr}</p:blipFill>`
    + `<p:spPr><a:xfrm${rot}><a:off x="${EMU(o.x)}" y="${EMU(o.y)}"/><a:ext cx="${EMU(o.w)}" cy="${EMU(o.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
function tableXml(o, id) {
  const grid = o.colW.map(w => `<a:gridCol w="${Math.round(w * EMU(o.w))}"/>`).join('');
  const rowH = Math.round(EMU(o.h) / o.rows);
  let trs = '';
  for (let r = 0; r < o.rows; r++) {
    let tcs = '';
    for (let c = 0; c < o.cols; c++) {
      const cell = o.tbl[r][c];
      const hdr = r === 0;
      const band = !hdr && r % 2 === 1;
      const fill = cell.fill ? `<a:solidFill><a:srgbClr val="${hx(cell.fill)}"/></a:solidFill>`
        : hdr ? '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>'
        : band ? `<a:solidFill><a:srgbClr val="DEEAF6"/></a:solidFill>` : '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>';
      const paras = (cell.paras && cell.paras.length ? cell.paras : [{ runs: [{ t: '' }] }]);
      const pXml = paras.map(p => {
        const rXml = (p.runs.length ? p.runs : [{ t: '' }]).map(rr => {
          const sz = Math.round((rr.size || o.fs || 16) * 100);
          let inner = '';
          if (hdr) inner = '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>';
          else if (rr.color && /^#/.test(rr.color)) inner = `<a:solidFill><a:srgbClr val="${hx(rr.color)}"/></a:solidFill>`;
          return `<a:r><a:rPr lang="en-US" sz="${sz}"${hdr || rr.b ? ' b="1"' : ''}${rr.i ? ' i="1"' : ''} dirty="0">${inner}</a:rPr><a:t>${xesc(rr.t)}</a:t></a:r>`;
        }).join('');
        return `<a:p><a:pPr${p.align && ALGN[p.align] ? ` algn="${ALGN[p.align]}"` : ''}/>${rXml}<a:endParaRPr lang="en-US" dirty="0"/></a:p>`;
      }).join('');
      tcs += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${pXml}</a:txBody><a:tcPr marL="91440" marR="91440" marT="45720" marB="45720" anchor="ctr">${fill}</a:tcPr></a:tc>`;
    }
    trs += `<a:tr h="${rowH}">${tcs}</a:tr>`;
  }
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${aesc(o.name || 'Table ' + id)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>`
    + `<p:xfrm><a:off x="${EMU(o.x)}" y="${EMU(o.y)}"/><a:ext cx="${EMU(o.w)}" cy="${EMU(o.h)}"/></p:xfrm>`
    + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>`
    + `<a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${grid}</a:tblGrid>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}
function transitionXml(tr) {
  if (!tr || !tr.kind || tr.kind === 'none') return '';
  const spd = tr.dur > 1.4 ? 'slow' : tr.dur < 0.6 ? 'fast' : 'med';
  const dir = { left: 'l', right: 'r', up: 'u', down: 'd' }[tr.dir] || tr.dir || 'r';
  let inner = '<p:fade/>';
  if (tr.kind === 'push') inner = `<p:push dir="${dir === 'l' ? 'r' : dir === 'r' ? 'l' : dir === 'u' ? 'd' : 'u'}"/>`;
  else if (tr.kind === 'wipe') inner = `<p:wipe dir="${dir}"/>`;
  else if (tr.kind === 'split') inner = `<p:split orient="horz" dir="out"/>`;
  else if (tr.kind === 'blinds') inner = `<p:blinds dir="v"/>`;
  else if (tr.kind === 'checker') inner = `<p:checker dir="across"/>`;
  else if (tr.kind === 'dissolve') inner = '<p:dissolve/>';
  return `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p14"><p:transition spd="${spd}" p14:dur="${Math.round((tr.dur || 0.7) * 1000)}">${inner}</p:transition></mc:Choice><mc:Fallback><p:transition spd="${spd}">${inner}</p:transition></mc:Fallback></mc:AlternateContent>`;
}

/* ---------------- package parts ---------------- */
function contentTypesXml(nSlides, media) {
  let mDefaults = '';
  const seen = {};
  for (const m of media) {
    const ext = m.name.split('.').pop().toLowerCase();
    if (seen[ext]) continue;
    seen[ext] = 1;
    const mt = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    mDefaults += `<Default Extension="${ext}" ContentType="${mt}"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>${mDefaults}
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${Array.from({ length: nSlides }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}
function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}
function presentationXml(state, nSlides) {
  const sldIds = Array.from({ length: nSlides }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${8 + i}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${sldIds}</p:sldIdLst>
<p:sldSz cx="${EMU(state.sizeW || 1280)}" cy="${EMU(state.sizeH || 720)}" type="custom"/>
<p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}
function presentationRelsXml(nSlides) {
  let rels = `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;
  rels += `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`;
  for (let i = 0; i < nSlides; i++) rels += `<Relationship Id="rId${8 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}
function themeXml(th) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${aesc(th.name || 'Office Theme')}">
<a:themeElements>
<a:clrScheme name="${aesc(th.name || 'Office')}"><a:dk1><a:srgbClr val="${hx(th.dk1)}"/></a:dk1><a:lt1><a:srgbClr val="${hx(th.lt1)}"/></a:lt1><a:dk2><a:srgbClr val="${hx(th.dk2)}"/></a:dk2><a:lt2><a:srgbClr val="${hx(th.lt2)}"/></a:lt2><a:accent1><a:srgbClr val="${hx(th.a1)}"/></a:accent1><a:accent2><a:srgbClr val="${hx(th.a2)}"/></a:accent2><a:accent3><a:srgbClr val="${hx(th.a3)}"/></a:accent3><a:accent4><a:srgbClr val="${hx(th.a4)}"/></a:accent4><a:accent5><a:srgbClr val="${hx(th.a5)}"/></a:accent5><a:accent6><a:srgbClr val="${hx(th.a6)}"/></a:accent6><a:hlink><a:srgbClr val="${hx(th.hl || '0563C1')}"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>
<a:fontScheme name="${aesc(th.name || 'Office')}"><a:majorFont><a:latin typeface="${aesc(th.majFont || 'Calibri Light')}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${aesc(th.minFont || 'Calibri')}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}
function slideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;
}
function slideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}
function slideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld><p:clrMapOvr><a:useMasterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}
function slideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}
function slideXml(slide, idx, th, picRids) {
  let id = 1;
  const nid = () => ++id;
  const objs = [...slide.objects].sort((a, b) => (a.z || 0) - (b.z || 0));
  let body = '';
  for (const o of objs) {
    if (o.kind === 'picph' && !o.src) continue;
    if ((o.kind === 'pic' || o.kind === 'picph') && o.src) { const pr = picRids.get(o.id); if (pr) body += picXml(o, nid(), pr.rid); continue; }
    if (o.kind === 'table') { body += tableXml(o, nid()); continue; }
    if (o.kind === 'chart') { const pr2 = picRids.get(o.id); if (pr2) body += picXml(o, nid(), pr2.rid); continue; }
    body += spXml(o, nid(), th);
  }
  const bg = slide.bg && slide.bg.color ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hx(slide.bg.color)}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : '';
  const show = slide.hidden ? ' show="0"' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"${show}>
<p:cSld>${bg}<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${body}
</p:spTree></p:cSld>
${transitionXml(slide.transition)}
</p:sld>`;
}
function slideRelsXml(picRids) {
  if (!picRids || !picRids.size) return null;
  let rels = '<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';
  for (const [, v] of picRids) rels = rels; // placeholder, real rels below
  let out = [];
  picRids.forEach((target, oid) => { out.push(`<Relationship Id="${target.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${target.file}"/>`); });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}${out.join('')}</Relationships>`;
}
function coreXml(state) {
  const iso = new Date().toISOString().replace(/\..+$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xesc(state.presName || 'Presentation')}</dc:title><dc:creator>PowerPoint</dc:creator><cp:lastModifiedBy>PowerPoint</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
}
function appXml(nSlides) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office PowerPoint 2016</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${nSlides}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides></Properties>`;
}

/* ---------------- chart rasterization ---------------- */
async function chartPng(o) {
  if (!window.chartSVG) return null;
  const W = Math.round(o.w * 2), H = Math.round(o.h * 2);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + o.w + ' ' + o.h + '">' + stripOuterSvg(window.chartSVG(o, o.w, o.h)) + '</svg>';
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return await new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, W, H);
      cx.drawImage(img, 0, 0, W, H);
      resolve(cv.toDataURL('image/png'));
      function resolve(v) { res(v); }
    };
    img.onerror = () => res(null);
    img.src = url;
  });
  function stripOuterSvg(s) { const m = String(s).match(/<svg[^>]*>([\s\S]*)<\/svg>/i); return m ? m[1] : s; }
}
function dataUrlBytes(u) {
  const i = u.indexOf(',');
  const meta = u.slice(0, i), b64 = u.slice(i + 1);
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
  const ext = /png/.test(meta) ? 'png' : /gif/.test(meta) ? 'gif' : 'png';
  return { u8, ext };
}

/* ---------------- build .pptx ---------------- */
async function buildPptx(state) {
  const th = state.theme || {};
  const media = []; // {name, data}
  const entries = [];
  const slides = state.slides;
  // gather media per slide
  const slidePicMaps = [];
  let mediaN = 0;
  for (let si = 0; si < slides.length; si++) {
    const m = new Map();
    for (const o of slides[si].objects) {
      if ((o.kind === 'pic' || o.kind === 'picph') && o.src) {
        const { u8, ext } = dataUrlBytes(o.src);
        const name = `image${++mediaN}.${ext}`;
        media.push({ name, data: u8 });
        m.set(o.id, { rid: 'rId' + (m.size + 2), file: name });
      } else if (o.kind === 'chart') {
        const png = await chartPng(o);
        if (png) {
          const { u8 } = dataUrlBytes(png);
          const name = `image${++mediaN}.png`;
          media.push({ name, data: u8 });
          m.set(o.id, { rid: 'rId' + (m.size + 2), file: name });
        }
      }
    }
    slidePicMaps.push(m);
  }
  entries.push({ name: '[Content_Types].xml', data: te.encode(contentTypesXml(slides.length, media)) });
  entries.push({ name: '_rels/.rels', data: te.encode(rootRelsXml()) });
  entries.push({ name: 'docProps/core.xml', data: te.encode(coreXml(state)) });
  entries.push({ name: 'docProps/app.xml', data: te.encode(appXml(slides.length)) });
  entries.push({ name: 'ppt/presentation.xml', data: te.encode(presentationXml(state, slides.length)) });
  entries.push({ name: 'ppt/_rels/presentation.xml.rels', data: te.encode(presentationRelsXml(slides.length)) });
  entries.push({ name: 'ppt/theme/theme1.xml', data: te.encode(themeXml(th)) });
  entries.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: te.encode(slideMasterXml()) });
  entries.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: te.encode(slideMasterRelsXml()) });
  entries.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: te.encode(slideLayoutXml()) });
  entries.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: te.encode(slideLayoutRelsXml()) });
  for (let si = 0; si < slides.length; si++) {
    entries.push({ name: `ppt/slides/slide${si + 1}.xml`, data: te.encode(slideXml(slides[si], si, th, slidePicMaps[si])) });
    const rels = slideRelsXml(slidePicMaps[si]);
    if (rels) entries.push({ name: `ppt/slides/_rels/slide${si + 1}.xml.rels`, data: te.encode(rels) });
  }
  for (const m of media) entries.push({ name: 'ppt/media/' + m.name, data: m.data });
  return zipStore(entries);
}

/* ---------------- import ---------------- */
function parseXml(s) {
  const d = new DOMParser().parseFromString(s, 'application/xml');
  if (d.querySelector('parsererror')) throw new Error('XML parse error');
  return d;
}
const qAll = (n, sel) => Array.from(n.getElementsByTagName(sel));
function first(n, sel) { const a = n.getElementsByTagName(sel); return a.length ? a[0] : null; }
function attr(n, k) { return n && n.getAttribute ? n.getAttribute(k) : null; }
function childElements(n) { return Array.from(n.children || []); }
function localOf(n) { return n.localName || n.nodeName.split(':').pop(); }
function* iterSpTree(spTree) {
  for (const n of childElements(spTree)) {
    const ln = localOf(n);
    if (ln === 'sp' || ln === 'pic' || ln === 'graphicFrame' || ln === 'cxnSp') yield n;
  }
}
function xfrmOf(spPr) {
  const xf = first(spPr, 'a:xfrm');
  if (!xf) return { x: 0, y: 0, w: 240, h: 120, rot: 0 };
  const off = first(xf, 'a:off'), ext = first(xf, 'a:ext');
  return {
    x: off ? PX(+attr(off, 'x')) : 0, y: off ? PX(+attr(off, 'y')) : 0,
    w: ext ? PX(+attr(ext, 'cx')) : 240, h: ext ? PX(+attr(ext, 'cy')) : 120,
    rot: attr(xf, 'rot') ? (+attr(xf, 'rot')) / 60000 : 0,
  };
}
function colorFromFillEl(fillEl) {
  if (!fillEl) return null;
  const srgb = first(fillEl, 'a:srgbClr');
  if (srgb) return '#' + attr(srgb, 'val');
  const scheme = first(fillEl, 'a:schemeClr');
  if (scheme) return { scheme: attr(scheme, 'val') };
  return null;
}
function schemeToHex(scheme, th) {
  return { accent1: th.a1, accent2: th.a2, accent3: th.a3, accent4: th.a4, accent5: th.a5, accent6: th.a6, dk1: th.dk1, lt1: th.lt1, dk2: th.dk2, lt2: th.lt2, tx1: th.dk1, tx2: th.dk2, bg1: th.lt1, bg2: th.lt2, hlink: th.hl }[scheme] || null;
}
function parseParagraphs(txBody, th) {
  const paras = [];
  for (const p of qAll(txBody, 'a:p').filter(p => p.parentNode === txBody)) {
    const ppr = first(p, 'a:pPr');
    const para = { runs: [], align: null, level: ppr && attr(ppr, 'lvl') ? +attr(ppr, 'lvl') : 0, bullet: null };
    if (ppr) {
      const algn = attr(ppr, 'algn');
      if (algn && ALGN_FROM[algn]) para.align = ALGN_FROM[algn];
      if (first(ppr, 'a:buNone')) para.bullet = 'none';
      else if (first(ppr, 'a:buAutoNum')) para.bullet = 'num';
      else {
        const bu = first(ppr, 'a:buChar');
        if (bu) {
          const ch = attr(bu, 'char');
          para.bullet = ch === '–' ? 'dash' : (ch === '▪' ? 'square' : 'char');
        }
      }
      const spc = first(ppr, 'a:spcAft');
      if (spc) { const pts = first(spc, 'a:spcPts'); if (pts) para.spaceAfter = (+attr(pts, 'val')) / 100; }
      const lnS = first(ppr, 'a:lnSpc');
      if (lnS) { const pct = first(lnS, 'a:spcPct'); if (pct) para.line = (+attr(pct, 'val')) / 100000; }
    }
    for (const r of childElements(p)) {
      const ln = localOf(r);
      if (ln === 'r') {
        const rpr = first(r, 'a:rPr');
        const t = first(r, 'a:t');
        const run = { t: t ? t.textContent : '' };
        if (rpr) {
          if (attr(rpr, 'sz')) run.size = (+attr(rpr, 'sz')) / 100;
          if (attr(rpr, 'b') === '1') run.b = true;
          if (attr(rpr, 'i') === '1') run.i = true;
          if (attr(rpr, 'u') && attr(rpr, 'u') !== 'none') run.u = true;
          if (attr(rpr, 'strike')) run.strike = true;
          if (attr(rpr, 'spc')) run.spacing = (+attr(rpr, 'spc')) / 100;
          const latin = first(rpr, 'a:latin');
          if (latin && attr(latin, 'typeface') && !/^\+/.test(attr(latin, 'typeface'))) run.font = attr(latin, 'typeface');
          const fill = first(rpr, 'a:solidFill');
          const col = colorFromFillEl(fill);
          if (col) run.color = typeof col === 'string' ? col : (schemeToHex(col.scheme, th) || undefined);
          const hlEl = first(rpr, 'a:highlight');
          if (hlEl) { const hlc = colorFromFillEl(hlEl); if (hlc && typeof hlc === 'string') run.highlight = hlc; }
        }
        para.runs.push(run);
      } else if (ln === 'br') {
        // treat a:br as new paragraph fragment
        para.runs.push({ t: '\n' });
      }
    }
    if (!para.runs.length) para.runs.push({ t: '' });
    paras.push(para);
  }
  return paras.length ? paras : [{ runs: [{ t: '' }], level: 0, bullet: null }];
}
async function readPptx(u8buf) {
  const zip = zipEntries(u8buf);
  const presText = await entryText(zip, 'ppt/presentation.xml');
  if (!presText) throw new Error('Not a PowerPoint file');
  const pres = parseXml(presText);
  const sldSz = first(pres, 'p:sldSz');
  const sizeW = sldSz ? PX(+attr(sldSz, 'cx')) : 1280;
  const sizeH = sldSz ? PX(+attr(sldSz, 'cy')) : 720;
  // theme
  let theme = null;
  const themeText = await entryText(zip, 'ppt/theme/theme1.xml');
  if (themeText) {
    try {
      const t = parseXml(themeText);
      const clr = n => { const el = first(t, 'a:' + n); const v = el && first(el, 'a:srgbClr'); return v ? '#' + attr(v, 'val') : null; };
      theme = {
        name: attr(t.documentElement, 'name') || 'Imported Theme',
        dk1: clr('dk1') || '#000000', lt1: clr('lt1') || '#FFFFFF', dk2: clr('dk2') || '#44546A', lt2: clr('lt2') || '#E7E6E6',
        a1: clr('accent1') || '#4472C4', a2: clr('accent2') || '#ED7D31', a3: clr('accent3') || '#A5A5A5',
        a4: clr('accent4') || '#FFC000', a5: clr('accent5') || '#5B9BD5', a6: clr('accent6') || '#70AD47',
        hl: clr('hlink') || '#0563C1',
        majFont: 'Calibri Light', minFont: 'Calibri',
      };
      const mf = first(t, 'a:majorFont'); if (mf) { const l = first(mf, 'a:latin'); if (l && attr(l, 'typeface')) theme.majFont = attr(l, 'typeface'); }
      const nf = first(t, 'a:minorFont'); if (nf) { const l = first(nf, 'a:latin'); if (l && attr(l, 'typeface')) theme.minFont = attr(l, 'typeface'); }
    } catch (e) { /* fall through */ }
  }
  // slide order via rels
  const relsText = await entryText(zip, 'ppt/_rels/presentation.xml.rels');
  const rels = new Map();
  if (relsText) {
    const r = parseXml(relsText);
    for (const rel of qAll(r, 'Relationship')) rels.set(attr(rel, 'Id'), attr(rel, 'Target'));
  }
  const sldIds = qAll(pres, 'p:sldId').map(n => attr(n, 'r:id') || attr(n, 'id'));
  const slidePaths = sldIds.map(rid => {
    const t = rels.get(rid) || '';
    return t.startsWith('ppt/') ? t : 'ppt/' + t.replace(/^\//, '');
  }).filter(p => /\.xml$/.test(p));
  const slides = [];
  for (let si = 0; si < slidePaths.length; si++) {
    const path = slidePaths[si];
    const sText = await entryText(zip, path);
    if (!sText) continue;
    const sDoc = parseXml(sText);
    const slide = {
      id: 's' + Date.now().toString(36) + '_' + si, layout: 'title' /* reassigned below */, objects: [],
      notes: '', hidden: attr(sDoc.documentElement, 'show') === '0', transition: null, anims: [], bg: null,
    };
    // background
    const bgEl = first(sDoc, 'p:bg');
    if (bgEl) { const col = colorFromFillEl(first(bgEl, 'a:solidFill')); if (col) slide.bg = { color: typeof col === 'string' ? col : (schemeToHex(col.scheme, theme) || '#FFFFFF') }; }
    // transition
    const trEl = first(sDoc, 'p:transition');
    if (trEl) {
      let type = 'fade', dir = null;
      for (const c of childElements(trEl)) {
        const ln = localOf(c);
        if (ln === 'push') { type = 'push'; dir = attr(c, 'dir') === 'r' ? 'l' : attr(c, 'dir') === 'u' ? 'd' : attr(c, 'dir') === 'd' ? 'u' : 'r'; }
        else if (ln === 'wipe') { type = 'wipe'; dir = attr(c, 'dir') || 'r'; }
        else if (ln === 'blinds') type = 'blinds';
        else if (ln === 'checker') type = 'checker';
        else if (ln === 'split') type = 'split';
        else if (ln === 'dissolve') type = 'dissolve';
        else if (ln === 'cut') type = 'none';
      }
      slide.transition = { kind: type, dir, dur: 0.7, advClick: true, advAfter: 0 };
    }
    // slide rels (for pictures)
    const relsPath = path.replace('slides/', 'slides/_rels/') + '.rels';
    const sRels = new Map();
    const sRelsText = await entryText(zip, relsPath);
    if (sRelsText) for (const rel of qAll(parseXml(sRelsText), 'Relationship')) sRels.set(attr(rel, 'Id'), attr(rel, 'Target'));
    const spTree = first(sDoc, 'p:spTree');
    let hasTitle = false, maxZ = 0;
    for (const node of iterSpTree(spTree)) {
      const ln = localOf(node);
      if (ln === 'pic') {
        const nv = first(node, 'p:cNvPr');
        const blip = first(node, 'a:blip');
        const rid = attr(blip, 'r:embed');
        const target = sRels.get(rid);
        if (!target) continue;
        const mediaPath = 'ppt/media/' + target.split('/').pop();
        const bytes = await entryBytes(zip, mediaPath);
        if (!bytes) continue;
        const ext = mediaPath.split('.').pop().toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        let bin = '';
        for (let k = 0; k < bytes.length; k += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 8192));
        const xf = xfrmOf(first(node, 'p:spPr'));
        const srcRect = first(node, 'a:srcRect');
        const crop = srcRect ? { l: (+attr(srcRect, 'l') || 0) / 1000, t: (+attr(srcRect, 't') || 0) / 1000, r: (+attr(srcRect, 'r') || 0) / 1000, b: (+attr(srcRect, 'b') || 0) / 1000 } : null;
        slide.objects.push({
          id: 'o' + Math.random().toString(36).slice(2, 9), kind: 'pic', ph: null, cap: false,
          x: xf.x, y: xf.y, w: xf.w, h: xf.h, rot: xf.rot, paras: null, anchor: 't', noBullet: false,
          fs: 18, al: 'l', font: null, shape: null, fill: null, line: null, shadow: false,
          src: 'data:' + mime + ';base64,' + btoa(bin), crop, rows: 0, cols: 0, colW: null, tbl: null,
          style: 'medium2', chart: null, link: null, prompt: null, name: attr(nv, 'name') || '', z: maxZ++, video: null,
        });
        continue;
      }
      if (ln === 'graphicFrame') {
        const gd = first(node, 'a:graphicData');
        if (!gd || !/table/.test(attr(gd, 'uri') || '')) continue;
        const tblEl = first(gd, 'a:tbl');
        if (!tblEl) continue;
        const gridCols = qAll(tblEl, 'a:gridCol').map(g => +attr(g, 'w') || 1);
        const gridSum = gridCols.reduce((a, b) => a + b, 0);
        const xfEl = first(node, 'p:xfrm');
        const off = first(xfEl, 'a:off'), ext = first(xfEl, 'a:ext');
        const x = off ? PX(+attr(off, 'x')) : 100, y = off ? PX(+attr(off, 'y')) : 100;
        const w = ext ? PX(+attr(ext, 'cx')) : 640, h = ext ? PX(+attr(ext, 'cy')) : 360;
        const trs = qAll(tblEl, 'a:tr');
        const rows = trs.length, cols = gridCols.length || (trs[0] ? qAll(trs[0], 'a:tc').length : 1);
        const tbl = [];
        for (let r = 0; r < rows; r++) {
          const row = [];
          const tcs = qAll(trs[r], 'a:tc');
          for (let c = 0; c < cols; c++) {
            const tc = tcs[c];
            if (!tc) { row.push({ paras: [{ runs: [{ t: '' }] }], fill: null }); continue; }
            const tx = first(tc, 'a:txBody');
            const paras = tx ? parseParagraphs(tx, theme) : [{ runs: [{ t: '' }] }];
            let fill = null;
            const tcPr = first(tc, 'a:tcPr');
            if (tcPr) { const colEl = colorFromFillEl(first(tcPr, 'a:solidFill')); if (colEl && typeof colEl === 'string') fill = colEl; else if (colEl && colEl.scheme) fill = schemeToHex(colEl.scheme, theme); }
            if (r === 0 && fill && theme && fill.toUpperCase() === String(theme.a1).toUpperCase()) fill = null; // keep theme banding
            row.push({ paras, fill });
          }
          tbl.push(row);
        }
        slide.objects.push({
          id: 'o' + Math.random().toString(36).slice(2, 9), kind: 'table', ph: null, cap: false,
          x, y, w, h, rot: 0, paras: null, anchor: 't', noBullet: true,
          fs: 16, al: 'l', font: null, shape: null, fill: null, line: null, shadow: false,
          src: null, crop: null, rows, cols, colW: gridCols.map(g => g / gridSum), tbl,
          style: 'medium2', chart: null, link: null, prompt: null, name: 'Table', z: maxZ++, video: null,
        });
        continue;
      }
      // sp / cxnSp
      const spPr = first(node, 'p:spPr');
      const xf = xfrmOf(spPr);
      const nv = first(node, 'p:cNvPr');
      const phEl = first(node, 'p:ph');
      const phType = phEl ? (attr(phEl, 'type') || 'body') : null;
      const geom = first(spPr, 'a:prstGeom');
      const prst = geom ? attr(geom, 'prst') : 'rect';
      const txBody = first(node, 'p:txBody');
      const hasText = txBody && qAll(txBody, 'a:t').some(t => t.textContent !== '');
      const paras = txBody ? parseParagraphs(txBody, theme) : null;
      const bodyPr = txBody ? first(txBody, 'a:bodyPr') : null;
      const anchor = bodyPr && attr(bodyPr, 'anchor') ? (ANCHOR_FROM[attr(bodyPr, 'anchor')] || 't') : 't';
      // fills
      let fill = null, line = null;
      const fills = childElements(spPr).filter(e => ['solidFill', 'noFill', 'gradFill', 'blipFill', 'pattFill'].includes(localOf(e)));
      const fillElRaw = fills[0];
      if (fillElRaw) {
        const fl = localOf(fillElRaw);
        if (fl === 'noFill') fill = { t: 'none' };
        else if (fl === 'solidFill') {
          const col = colorFromFillEl(fillElRaw);
          if (typeof col === 'string') fill = { t: 'solid', c: col };
          else if (col && col.scheme) fill = { t: 'theme', c: { accent1: 'a1', accent2: 'a2', accent3: 'a3', accent4: 'a4', accent5: 'a5', accent6: 'a6', dk1: 'dk1', lt1: 'lt1', dk2: 'dk2', lt2: 'lt2' }[col.scheme] || 'a1' };
        } else if (fl === 'gradFill') {
          const gs = qAll(fillElRaw, 'a:gs');
          const c1 = gs[0] ? colorFromFillEl(gs[0]) : null, c2 = gs[1] ? colorFromFillEl(gs[1]) : null;
          const lin = first(fillElRaw, 'a:lin');
          fill = { t: 'grad', c1: (typeof c1 === 'string' ? c1 : '#FFFFFF'), c2: (typeof c2 === 'string' ? c2 : '#000000'), ang: lin ? (+attr(lin, 'ang') || 0) / 60000 : 90 };
        }
      }
      const lnEl = first(spPr, 'a:ln');
      if (lnEl) {
        if (first(lnEl, 'a:noFill')) line = 'none';
        else {
          const col = colorFromFillEl(first(lnEl, 'a:solidFill'));
          const wpt = attr(lnEl, 'w') ? (+attr(lnEl, 'w')) / 12700 : 1;
          line = { c: typeof col === 'string' ? col : (col && col.scheme ? (schemeToHex(col.scheme, theme) || '#000000') : '#000000'), w: wpt };
        }
      }
      if (prst === 'line' && !line) {
        line = { c: '#000000', w: 1 };
        if (first(spPr, 'a:tailEnd') || (lnEl && first(lnEl, 'a:tailEnd'))) { /* arrow handled via shape key below */ }
      }
      const isArrowLine = prst === 'line' && lnEl && first(lnEl, 'a:tailEnd');
      const cNvSpPr = first(node, 'p:cNvSpPr');
      const isTxBox = !!(cNvSpPr && attr(cNvSpPr, 'txBox') === '1');
      const hasFill = !!(fill && fill.t !== 'none');
      const hasLine = !!(line && line !== 'none');
      const kind = phType ? 'text' : (isTxBox ? 'text' : (prst === 'line' || (GEO_FROM[prst] && prst !== 'rect') || hasFill || hasLine ? 'shape' : (hasText ? 'text' : 'shape')));
      const o = {
        id: 'o' + Math.random().toString(36).slice(2, 9), kind, ph: phType ? (phType.toLowerCase().includes('title') || phType === 'ctrTitle' ? 'title' : 'body') : null,
        cap: false, x: xf.x, y: xf.y, w: xf.w, h: xf.h, rot: xf.rot, paras, anchor,
        noBullet: !!(phType && paras && paras.length && paras[0].bullet === 'none'),
        fs: 18, al: (paras && paras[0] && paras[0].align) || 'l', font: null,
        shape: kind === 'shape' ? (isArrowLine ? 'lineArrow' : (GEO_FROM[prst] || 'rect')) : null,
        fill, line, shadow: !!(first(spPr, 'a:effectLst') && first(first(spPr, 'a:effectLst'), 'a:outerShdw')),
        src: null, crop: null, rows: 0, cols: 0, colW: null, tbl: null, style: 'medium2',
        chart: null, link: null, prompt: null, name: attr(nv, 'name') || '', z: maxZ++, video: null,
      };
      if (kind === 'shape' && o.shape === 'rect' && !hasFill && !hasLine && hasText && !phType) { o.kind = 'text'; o.shape = null; } // plain textbox
      if (o.kind === 'text' && o.fill && o.fill.t === 'none') o.fill = null;
      if (o.ph === 'title') hasTitle = true;
      slide.objects.push(o);
    }
    slides.push(slide);
  }
  if (!slides.length) throw new Error('No slides found');
  // crude layout guess for round-trip niceness
  slides.forEach(s => {
    const kinds = s.objects.map(o => o.ph);
    if (kinds[0] === 'title' && kinds.filter(Boolean).length === 2 && s.objects.length === 2) s.layout = 'title';
    else if (kinds.filter(Boolean).length) s.layout = 'titleContent';
    else s.layout = 'blank';
  });
  return { slides, theme, sizeW, sizeH };
}

window.Pptx = { buildPptx, readPptx, crc32, zipStore };
})();
