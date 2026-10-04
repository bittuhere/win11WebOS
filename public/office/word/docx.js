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
   DocxExporter: converts the editor DOM into a real .docx (OOXML) package.
   Fidelity goals (verified against LibreOffice + python-docx + OOXML schema):
     - Valid ZIP container (stored, correct CRC32 + central-directory offsets).
     - Runs: b/i/u/strike/sub/sup/color/highlight/shading/font-family/font-size,
       small-caps/all-caps.  <br> stays a line break.
     - Paragraphs: styles (Heading 1-4/Title/Subtitle/Quote/IntenseQuote),
       alignment, indent, spacing, block shading, hr -> bottom border.
     - Lists: REAL Word lists via numbering.xml (bullets 3 lvls, decimal with
       letter/roman sub-levels); <ol start> honored via startOverride.
     - Tables: measured column widths, cell shading, borders sampled from the
       sheet, header-row repeat, colspan/rowspan (gridSpan/vMerge).
     - Hyperlinks: w:hyperlink + external relationships.
     - Footnotes: genuine footnotes.xml (bottom-of-page in Word), not an
       end-of-document dump.
     - Page geometry: size/orientation/margins from the app model; page color
       (w:background + settings displayBackgroundShape); page borders; water-
       mark (VML textpath in the page header, the way Word itself does it);
       header/footer parts incl. the PAGE field.
   ========================================================================== */
(function () {
  'use strict';

  const te = new TextEncoder();

  /* ---------------- CRC32 ---------------- */
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

  /* ---------------- ZIP (store) ---------------- */
  function zipStore(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const dosTime = 0, dosDate = 0x21;
    for (const e of entries) {
      const nameU8 = te.encode(e.name);
      const crc = crc32(e.data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, e.data.length, true);
      lh.setUint32(22, e.data.length, true);
      lh.setUint16(26, nameU8.length, true);
      lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nameU8, e.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, dosTime, true);
      ch.setUint16(12, dosDate, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, e.data.length, true);
      ch.setUint32(24, e.data.length, true);
      ch.setUint16(28, nameU8.length, true);
      ch.setUint32(42, offset, true);   // REQUIRED, else every entry resolves to offset 0 (the LibreOffice-crashing bug)
      central.push({ buf: new Uint8Array(ch.buffer), nameU8, offset });
      offset += 30 + nameU8.length + e.data.length;
    }
    let cdSize = 0;
    for (const c of central) cdSize += 46 + c.nameU8.length;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);
    const outLen = offset + cdSize + 22;
    const out = new Uint8Array(outLen);
    let p = 0;
    for (const ch of chunks) { out.set(ch, p); p += ch.length; }
    for (const c of central) { out.set(c.buf, p); p += c.buf.length; out.set(c.nameU8, p); p += c.nameU8.length; }
    out.set(new Uint8Array(end.buffer), p);
    return out;
  }

  /* ---------------- unit / color helpers ---------------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const px2pt = px => px * 0.75;
  const px2twip = px => Math.round(px2pt(px) * 20);   // 1px = 15 twips at 96dpi
  const pt2half = pt => Math.round(pt * 2);
  const zoom = () => (window.W && W.getZoom) ? W.getZoom() : 1;

  function rgbToHex(rgb) {
    if (!rgb) return null;
    const m = String(rgb).match(/rgba?\(([^)]+)\)/);
    if (!m) return /^#/.test(rgb) ? rgb.replace('#', '').toUpperCase() : null;
    const parts = m[1].split(',').map(x => parseFloat(x));
    if (parts.length > 3 && parts[3] === 0) return null;
    return parts.slice(0, 3).map(v => ('0' + Math.round(v).toString(16)).slice(-2)).join('').toUpperCase();
  }
  function rgbaParts(rgba) { // -> {hex, alpha} for watermarks
    const m = String(rgba || '').match(/rgba?\(([^)]+)\)/);
    if (!m) { const h = rgbToHex(rgba); return h ? { hex: h, alpha: 1 } : { hex: 'C0C0C0', alpha: 0.3 }; }
    const p = m[1].split(',').map(x => parseFloat(x));
    return { hex: rgbToHex(rgba) || 'C0C0C0', alpha: p.length > 3 ? p[3] : 1 };
  }
  const HL_NAMES = { '#FFFF00': 'yellow', '#00FF00': 'green', '#00FFFF': 'cyan', '#FF00FF': 'magenta', '#0000FF': 'blue', '#FF0000': 'red', '#000080': 'darkBlue', '#008080': 'darkCyan', '#008000': 'darkGreen', '#800080': 'darkMagenta', '#800000': 'darkRed', '#808000': 'darkYellow', '#808080': 'darkGray', '#C0C0C0': 'lightGray', '#000000': 'black', '#FFFFFF': 'white' };

  /* ---------------- inline run collection ---------------- */
  /* env = per-paragraph format chain {fmt, link}; ctx = shared document context */
  function runsFromNode(node, env, out) {
    if (node.nodeType === Node.TEXT_NODE) {
      const v = node.nodeValue.replace(/\u200B/g, '');
      if (!v.length) return;
      if (v.includes('\t')) {   // literal tabs become real Word tab stops
        v.split('\t').forEach((seg, i) => {
          if (i > 0) out.push({ tab: true, fmt: env.fmt.slice(), link: env.link });
          if (seg.length) out.push({ text: seg, fmt: env.fmt.slice(), link: env.link });
        });
        return;
      }
      out.push({ text: v, fmt: env.fmt.slice(), link: env.link });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return;
    if (tag === 'br') { out.push({ brk: 'line', fmt: env.fmt.slice() }); return; }
    if (el.classList && el.classList.contains('wtab')) { out.push({ tab: true, fmt: env.fmt.slice(), link: env.link }); return; }
    if ((tag === 'ul' || tag === 'ol') && env.ctx.inList) return; // nested lists are emitted as their own paragraphs
    if (tag === 'img') {
      const src = el.getAttribute('src') || '';
      if (src.startsWith('data:')) {
        const w = el.getBoundingClientRect().width || el.naturalWidth || 300;
        const h = el.getBoundingClientRect().height || el.naturalHeight || 200;
        out.push({ img: src, w: w / zoom(), h: h / zoom() });
      }
      return;
    }
    if (el.classList && el.classList.contains('fns')) return;
    if (el.dataset && el.dataset.fld === 'PAGE') { out.push({ fld: 'PAGE', text: el.textContent || '1', fmt: env.fmt.slice() }); return; }
    if (el.dataset && el.dataset.fn) {  // footnote reference
      const idx = env.ctx.fnIndex(el.dataset.fn);
      if (idx > 0) out.push({ fnRef: idx, fmt: env.fmt.slice() });
      return;
    }
    const fmt = env.fmt.slice();
    const cs = getComputedStyle(el);
    if (tag === 'b' || tag === 'strong' || parseInt(cs.fontWeight) >= 600) fmt.push(['b']);
    if (tag === 'i' || tag === 'em' || cs.fontStyle === 'italic') fmt.push(['i']);
    if (tag === 'u' || (cs.textDecorationLine || '').includes('underline')) fmt.push(['u']);
    if (tag === 's' || tag === 'strike' || tag === 'del' || (cs.textDecorationLine || '').includes('line-through')) fmt.push(['strike']);
    if (tag === 'sub') fmt.push(['vertAlign', 'subscript']);
    if (tag === 'sup' && !el.dataset.fn) fmt.push(['vertAlign', 'superscript']);
    const col = cs.color && rgbToHex(cs.color);
    if (col && col !== '000000') fmt.push(['color', col]);
    const bg = cs.backgroundColor && rgbToHex(cs.backgroundColor);
    if (bg && bg !== 'FFFFFF') fmt.push(['shd', bg]);
    const fs = parseFloat(cs.fontSize);
    if (fs) fmt.push(['sz', pt2half(px2pt(fs))]);
    const fam = cs.fontFamily && cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (fam && !/^(sans-serif|serif|inherit|initial|unset|monospace)$/.test(fam)) fmt.push(['rFonts', fam]);
    const st = el.getAttribute && el.getAttribute('style') || '';
    if (/font-variant-caps:\s*small-caps/.test(st)) fmt.push(['smallCaps']);
    if (/text-transform:\s*uppercase/.test(st)) fmt.push(['caps']);

    const prevLink = env.link;
    if (tag === 'a') {
      const href = el.getAttribute('href');
      if (href && /^https?:\/\//i.test(href)) env.link = env.ctx.linkId(href);
    }
    el.childNodes.forEach(n => runsFromNode(n, { fmt, link: env.link, ctx: env.ctx }, out));
    env.link = prevLink;
  }

  function dedupeFmt(fmt) {
    const seen = {};
    for (const f of fmt) seen[f[0]] = f[1];
    return seen;
  }
  /* w:rPr must follow the CT_RPr schema order or strict validators complain */
  function rPrXml(fmt, extra) {
    const m = dedupeFmt(fmt);
    let s = '';
    if (m.rStyle) s += `<w:rStyle w:val="${m.rStyle}"/>`;
    if (m.rFonts) s += `<w:rFonts w:ascii="${esc(m.rFonts)}" w:hAnsi="${esc(m.rFonts)}" w:cs="${esc(m.rFonts)}"/>`;
    if ('b' in m) s += '<w:b/>';
    if ('i' in m) s += '<w:i/>';
    if ('caps' in m) s += '<w:caps/>';
    if ('smallCaps' in m) s += '<w:smallCaps/>';
    if ('strike' in m) s += '<w:strike/>';
    if (m.color) s += `<w:color w:val="${m.color}"/>`;
    if (m.sz) s += `<w:sz w:val="${m.sz}"/><w:szCs w:val="${m.sz}"/>`;
    if (m.shd) {
      if (HL_NAMES['#' + m.shd]) s += `<w:highlight w:val="${HL_NAMES['#' + m.shd]}"/>`;
      else s += `<w:shd w:val="clear" w:color="auto" w:fill="${m.shd}"/>`;
    }
    if ('u' in m) s += '<w:u w:val="single"/>';
    if (m.vertAlign) s += `<w:vertAlign w:val="${m.vertAlign}"/>`;
    if (extra) s += extra;
    return s ? `<w:rPr>${s}</w:rPr>` : '';
  }
  function runXml(r) {
    if (r.brk === 'line') return `<w:r>${rPrXml(r.fmt)}<w:br/></w:r>`;
    if (r.brk === 'page') return '<w:r><w:br w:type="page"/></w:r>';
    if (r.tab) return `<w:r>${rPrXml(r.fmt)}<w:tab/></w:r>`;
    if (r.fld === 'PAGE') {
      return `<w:fldSimple w:instr=" PAGE \\* MERGEFORMAT "><w:r>${rPrXml(r.fmt)}<w:t>${esc(r.text || '1')}</w:t></w:r></w:fldSimple>`;
    }
    if (r.fnRef) {
      return `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${r.fnRef}"/></w:r>`;
    }
    const inner = `<w:r>${rPrXml(r.fmt)}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
    if (r.link) return `<w:hyperlink r:id="${r.link}" w:history="1">${inner}</w:hyperlink>`;
    return inner;
  }

  /* ---------------- paragraph conversion ---------------- */
  /* CT_PPr order: pStyle, numPr, pBdr, shd, spacing, ind, jc, ... rPr (para mark) */
  function paraXml(el, ctx, opts) {
    opts = opts || {};
    const cs = getComputedStyle(el);
    let pPr = '';
    const styleMap = { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', h4: 'Heading4' };
    const cls = el.classList || { contains: () => false };
    let pstyle = styleMap[el.tagName.toLowerCase()] || null;
    if (cls.contains('sty-title')) pstyle = 'Title';
    if (cls.contains('sty-subtitle')) pstyle = 'Subtitle';
    if (el.tagName.toLowerCase() === 'blockquote' || cls.contains('sty-quote')) pstyle = 'Quote';
    if (cls.contains('sty-iquote')) pstyle = 'IntenseQuote';
    if (pstyle) pPr += `<w:pStyle w:val="${pstyle}"/>`;

    const isList = opts.list;
    if (isList) pPr += `<w:numPr><w:ilvl w:val="${Math.min(2, isList.level)}"/><w:numId w:val="${isList.numId}"/></w:numPr>`;

    if (el.tagName.toLowerCase() === 'hr') {
      pPr += `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>`;
    }

    const blockBg = cs.backgroundColor && rgbToHex(cs.backgroundColor);
    if (blockBg && blockBg !== 'FFFFFF') pPr += `<w:shd w:val="clear" w:color="auto" w:fill="${blockBg}"/>`;

    const mb = parseFloat(cs.marginBottom) || 0;
    const mt = parseFloat(cs.marginTop) || 0;
    const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    let spAttr = ` w:after="${Math.round(px2twip(mb))}"`;
    if (mt) spAttr += ` w:before="${Math.round(px2twip(mt))}"`;
    if (lh && lh > 0.5 && Math.abs(lh - 1.08) > 0.02) spAttr += ` w:line="${Math.round(lh * 240)}" w:lineRule="auto"`;
    pPr += `<w:spacing${spAttr}/>`;

    const ml = parseFloat(cs.marginLeft) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const ti = parseFloat(cs.textIndent) || 0;
    let indAttr = '';
    let leftTw = px2twip(ml);
    if (isList) leftTw += (Math.min(2, isList.level) + 1) * 390;
    if (leftTw) indAttr += ` w:left="${Math.round(leftTw)}"`;
    if (mr) indAttr += ` w:right="${px2twip(mr)}"`;
    if (isList) indAttr += ' w:hanging="390"';
    else if (ti) {
      if (ti < 0) indAttr += ` w:hanging="${px2twip(-ti)}"`;
      else indAttr += ` w:firstLine="${px2twip(ti)}"`;
    }
    if (indAttr) pPr += `<w:ind${indAttr}/>`;

    const align = cs.textAlign;
    if (align && align !== 'start' && align !== 'left') {
      const jc = { center: 'center', right: 'right', justify: 'both', end: 'right' }[align.replace(/-moz-|-webkit-/g, '')];
      if (jc) pPr += `<w:jc w:val="${jc}"/>`;
    }

    if (el.tagName.toLowerCase() === 'hr') return `<w:p><w:pPr>${pPr}</w:pPr></w:p>`;
    const runs = [];
    runsFromNode(el, { fmt: [], link: null, ctx }, runs);
    let body = '';
    for (const r of runs) body += r.img ? ctx.imgXml(r) : runXml(r);
    if (!body) body = '<w:r><w:t xml:space="preserve"></w:t></w:r>';
    return `<w:p><w:pPr>${pPr}</w:pPr>${body}</w:p>`;
  }

  /* ---------------- table conversion (measured, faithful) ---------------- */
  function tableXml(el, ctx) {
    const trs = Array.from(el.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'));
    if (!trs.length) return '';
    const z = zoom();
    // measured column widths (px -> dxa) from the first row
    const firstCells = Array.from(trs[0].querySelectorAll(':scope > td, :scope > th'));
    const colW = firstCells.map(td => Math.max(240, Math.round(px2twip(parseFloat(getComputedStyle(td).width) / z))));
    // border sample from the first cell
    let bVal = 'single', bSz = 4, bCol = '000000';
    if (firstCells.length) {
      const cs = getComputedStyle(firstCells[0]);
      const bw = parseFloat(cs.borderTopWidth) || 0;
      if (bw <= 0 || cs.borderTopStyle === 'none' || cs.borderTopStyle === 'hidden') bVal = 'nil';
      else {
        bSz = Math.max(2, Math.round(px2pt(bw) * 8));
        bCol = rgbToHex(cs.borderTopColor) || '000000';
        bVal = { double: 'double', dashed: 'dashed', dotted: 'dotted' }[cs.borderTopStyle] || 'single';
      }
    }
    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(b => bVal === 'nil' ? `<w:${b} w:val="nil"/>`
        : `<w:${b} w:val="${bVal}" w:sz="${bSz}" w:space="0" w:color="${bCol}"/>`).join('');

    // rowspan/colspan state machine (vMerge/gridSpan)
    const merges = {}; // col -> rows remaining
    let rowsXml = '';
    trs.forEach((tr, ri) => {
      let cellsXml = '', col = 0;
      const cells = Array.from(tr.querySelectorAll(':scope > td, :scope > th'));
      const allTh = cells.length > 0 && cells.every(c => c.tagName.toLowerCase() === 'th');
      cells.forEach(td => {
        while (merges[col] > 0) { // vMerge continuation cell
          cellsXml += `<w:tc><w:tcPr><w:tcW w:w="${colW[col] || 2400}" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>`;
          merges[col]--; col++;
        }
        const colspan = +(td.getAttribute('colspan') || 1);
        const rowspan = +(td.getAttribute('rowspan') || 1);
        const w = colW.slice(col, col + colspan).reduce((a, b) => a + b, 0) || 2400;
        const csTd = getComputedStyle(td);
        const shd = rgbToHex(csTd.backgroundColor);
        let tcPr = `<w:tcW w:w="${w}" w:type="dxa"/>`;
        if (colspan > 1) tcPr += `<w:gridSpan w:val="${colspan}"/>`;
        if (rowspan > 1) tcPr += `<w:vMerge w:val="restart"/>`;
        if (shd && shd !== 'FFFFFF') tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${shd}"/>`;
        const va = csTd.verticalAlign;
        if (va === 'middle' || va === 'bottom') tcPr += `<w:vAlign w:val="${va === 'middle' ? 'center' : 'bottom'}"/>`;
        let inner = '';
        const isBlockTag = n => /^(p|div|h[1-6]|table|ul|ol|blockquote|section|article|figure|hr)$/i.test(n.tagName);
        const blocks = blockChildren(td).filter(isBlockTag);
        if (!blocks.length) inner = paraXml(td, ctx);
        else blocks.forEach(b => inner += blockXml(b, ctx));
        cellsXml += `<w:tc><w:tcPr>${tcPr}</w:tcPr>${inner}</w:tc>`;
        if (rowspan > 1) for (let k = 0; k < colspan; k++) merges[col + k] = rowspan - 1;
        col += colspan;
      });
      while (merges[col] > 0) {
        cellsXml += `<w:tc><w:tcPr><w:tcW w:w="${colW[col] || 2400}" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>`;
        merges[col]--; col++;
      }
      const trPr = (ri === 0 && allTh) ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
      rowsXml += `<w:tr>${trPr}${cellsXml}</w:tr>`;
    });
    const totalW = colW.reduce((a, b) => a + b, 0) || 2400;
    const grid = `<w:tblGrid>${colW.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders>` +
      `<w:tblLayout w:type="fixed"/></w:tblPr>${grid}${rowsXml}</w:tbl>`;
  }

  function blockChildren(el) {
    return Array.from(el.children).filter(c => !c.classList ||
      (!c.classList.contains('fns') && !c.classList.contains('wm') && !c.classList.contains('pborder') && !c.classList.contains('hf-band')));
  }

  /* lists -> real Word numbering */
  function listXml(listEl, ctx, numId, level) {
    let s = '';
    const isUl = listEl.tagName.toLowerCase() === 'ul';
    Array.from(listEl.children).forEach(li => {
      if (li.tagName.toLowerCase() !== 'li') return;
      const myNumId = isUl ? ctx.bulletNumId : numId;
      s += paraXml(li, ctx, { list: { numId: myNumId, level } });
      Array.from(li.children).forEach(sub => {
        const t = sub.tagName.toLowerCase();
        if (t === 'ul') s += listXml(sub, ctx, 0, Math.min(2, level + 1));
        else if (t === 'ol') s += listXml(sub, ctx, ctx.newNumberedList(+sub.getAttribute('start') || 1), Math.min(2, level + 1));
      });
    });
    return s;
  }

  function blockXml(el, ctx) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'table') return tableXml(el, ctx);
    if (tag === 'ul') return listXml(el, ctx, 0, 0);
    if (tag === 'ol') return listXml(el, ctx, ctx.newNumberedList(+el.getAttribute('start') || 1), 0);
    if (el.classList && el.classList.contains('pbreak')) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    return paraXml(el, ctx);
  }

  function collectFootnotes(pagesRoot) {
    const list = [];
    pagesRoot.querySelectorAll('.fns .fn-i').forEach(fn => {
      const id = +(fn.dataset.fn || 0);
      if (id) list[id - 1] = fn.textContent.replace(/^\d+\s*/, '');
    });
    return list;
  }

  /* ---------------- header / footer parts ---------------- */
  function partXmlFromBand(band, ctx) {
    let xml = '';
    if (band) blockChildren(band).forEach(b => { xml += blockXml(b, ctx); });
    return xml || '<w:p/>';
  }

  function watermarkPict(wm) {
    if (!wm || !wm.text) return '';
    const { hex, alpha } = rgbaParts(wm.color);
    const sc = (wm.size || 96) / 96;
    const wpt = (527 * sc).toFixed(1), hpt = (132 * sc).toFixed(1);
    const op = Math.round(Math.min(1, Math.max(0.05, alpha)) * 100) / 100;
    return `<w:p><w:r><w:pict>` +
      `<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,0l@8,0m@5,21600l@6,21600e">` +
      `<v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @4"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas>` +
      `<v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/>` +
      `<v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles>` +
      `<o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>` +
      `<v:shape id="PowerPlusWaterMarkObject1" o:spid="_x0000_s1025" type="#_x0000_t136" ` +
      `style="position:absolute;margin-left:0;margin-top:0;width:${wpt}pt;height:${hpt}pt;rotation:315;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" ` +
      `o:allowincell="f" fillcolor="#${hex}" stroked="f">` +
      `<v:fill opacity="${op}"/>` +
      `<v:textpath style="font-family:&quot;Calibri Light&quot;;font-size:1pt" string="${esc(wm.text)}"/></v:shape>` +
      `</w:pict></w:r></w:p>`;
  }

  /* ---------------- public API ---------------- */
  function exportDocx(pagesRoot, docName, opts) {
    opts = opts || {};
    const st = (window.W && W.state) || {};
    const ps = opts.pageSize || st.pageSize || { w: 816, h: 1056, landscape: false };
    const mg = opts.margins || st.margins || { t: 96, r: 96, b: 96, l: 96 };
    const hf = opts.hf !== undefined ? opts.hf : (st.hf || { header: '', footer: '' });
    const wm = opts.wm !== undefined ? opts.wm : st.wm;
    const pageBorder = opts.pageBorder !== undefined ? opts.pageBorder : st.pageBorder;
    const pageColor = opts.pageColor !== undefined ? opts.pageColor : (st.colors && st.colors.pagecolor);

    // footnote order: appearance of sup[data-fn] in the body text
    const fnSeq = [];
    pagesRoot.querySelectorAll('.pbody sup[data-fn]').forEach(s => {
      const id = +s.dataset.fn;
      if (id && !fnSeq.includes(id)) fnSeq.push(id);
    });
    const fnTexts = collectFootnotes(pagesRoot);

    const ctx = {
      imgs: [], links: [], bulletNumId: 1, numSeq: 2,
      inList: false, link: null,
      linkId(href) {
        let f = ctx.links.find(l => l.href === href);
        if (!f) { f = { href, rid: 'rId' + (100 + ctx.links.length) }; ctx.links.push(f); }
        return f.rid;
      },
      fnIndex(fnId) {
        const i = fnSeq.indexOf(+fnId);
        return i < 0 ? 0 : i + 2;   // 0/1 = separator ids
      },
      newNumberedList(start) {
        const id = ctx.numSeq++;
        ctx.numOverrides.push({ id, start: start || 1 });
        return id;
      },
      numOverrides: [],
      imgXml(r) {
        const m = r.img.match(/^data:(image\/(png|jpeg|gif));base64,(.+)$/);
        if (!m) return '';
        const ext = m[2] === 'jpeg' ? 'jpeg' : m[2];
        const fname = `image${ctx.imgs.length + 1}.${ext}`;
        const bin = Uint8Array.from(atob(m[3]), c => c.charCodeAt(0));
        ctx.imgs.push({ fname, bin, mime: m[1] });
        const rid = 'rId' + (50 + ctx.imgs.length);
        const maxW = ps.w - mg.l - mg.r;
        let w = r.w, h = r.h;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        const cx = Math.round(w * 9525), cy = Math.round(h * 9525);
        return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
          `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${100 + ctx.imgs.length}" name="Picture ${ctx.imgs.length}"/>` +
          `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
          `<pic:pic><pic:nvPicPr><pic:cNvPr id="${ctx.imgs.length}" name="${fname}"/><pic:cNvPicPr/></pic:nvPicPr>` +
          `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
          `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
          `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
          `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      },
    };

    /* body */
    const pages = pagesRoot.querySelectorAll(':scope > .page > .pbody');
    let bodyXml = '';
    pages.forEach(pb => {
      blockChildren(pb).forEach(b => {
        const t = b.tagName.toLowerCase();
        if (t === 'ul' || t === 'ol') { ctx.inList = true; bodyXml += blockXml(b, ctx); ctx.inList = false; }
        else bodyXml += blockXml(b, ctx);
      });
    });

    /* headers/footers (live bands mirror state.hf and carry computed styles) */
    const firstPage = pagesRoot.querySelector('.page');
    let headerXml = null, footerXml = null;
    const hdrBand = firstPage && firstPage.querySelector('.phdr');
    const ftrBand = firstPage && firstPage.querySelector('.pftr');
    const hasHeader = !!(hdrBand && hdrBand.textContent.trim()) || !!(hdrBand && hdrBand.querySelector('img'));
    const hasFooter = !!(ftrBand && ftrBand.textContent.trim()) || !!(ftrBand && ftrBand.querySelector('img'));
    const wmPict = watermarkPict(wm);
    if (hasHeader || wmPict) headerXml = (hasHeader ? partXmlFromBand(hdrBand, ctx) : '<w:p/>').replace(/<w:p\/>$/, '') + wmPict || '<w:p/>';
    if (hasFooter) footerXml = partXmlFromBand(ftrBand, ctx);

    /* section properties — geometry straight from the app model */
    let sectPr = '';
    if (headerXml !== null) sectPr += '<w:headerReference w:type="default" r:id="rIdH1"/>';
    if (footerXml !== null) sectPr += '<w:footerReference w:type="default" r:id="rIdF1"/>';
    sectPr += `<w:pgSz w:w="${px2twip(ps.w)}" w:h="${px2twip(ps.h)}"${ps.landscape ? ' w:orient="landscape"' : ''}/>`;
    sectPr += `<w:pgMar w:top="${px2twip(mg.t)}" w:right="${px2twip(mg.r)}" w:bottom="${px2twip(mg.b)}" w:left="${px2twip(mg.l)}" ` +
      `w:header="${px2twip(Math.max(24, mg.t / 2))}" w:footer="${px2twip(Math.max(24, mg.b / 2))}" w:gutter="0"/>`;
    if (pageBorder && pageBorder.style && pageBorder.style !== 'none') {
      const map = { solid: 'single', double: 'double', dashed: 'dashed', dotted: 'dotted' };
      const val = map[pageBorder.style] || 'single';
      const col = (pageBorder.color || '#000000').replace('#', '').toUpperCase();
      const sz = Math.round((pageBorder.width || 2) * 8);
      sectPr += `<w:pgBorders w:offsetFrom="page">` +
        ['top', 'left', 'bottom', 'right'].map(b => `<w:${b} w:val="${val}" w:sz="${Math.min(96, sz)}" w:space="24" w:color="${col}"/>`).join('') +
        `</w:pgBorders>`;
    }

    const bgXml = pageColor ? `<w:background w:color="${pageColor.replace('#', '')}"/>` : '';
    const documentXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ` +
      `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
      `xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ` +
      `xmlns:v="urn:schemas-microsoft-com:vml" ` +
      `xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ` +
      `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
      `xmlns:w10="urn:schemas-microsoft-com:office:word" ` +
      `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
      `xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ` +
      `xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ` +
      `xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ` +
      `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
      `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ` +
      `mc:Ignorable="w14 wp14">` +
      `${bgXml}<w:body>${bodyXml}<w:sectPr>${sectPr}</w:sectPr></w:body></w:document>`;

    /* styles — mirror the app's own typography so the file looks like the view */
    const stylesXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>` +
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:color w:val="2E74B5"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="1"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:color w:val="2E74B5"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="2"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:color w:val="2E74B5"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="3"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:color w:val="2E74B5"/><w:i/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:color w:val="444444"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:i/><w:color w:val="5A5A5A"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:spacing w:after="160"/><w:ind w:left="615" w:right="615"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="IntenseQuote"><w:name w:val="Intense Quote"/><w:basedOn w:val="Quote"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="2E74B5"/></w:pBdr></w:pPr><w:rPr><w:i/><w:color w:val="2E74B5"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/>` +
      `<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>` +
      `</w:styles>`;

    /* numbering — real bullets + decimal with ols restartable via startOverride */
    // Word's canonical bullet glyphs: U+F0B7 (Symbol), "o" (Courier New), U+F0A7 square (Wingdings)
    const bulletLvls = [
      `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\uF0B7"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="390" w:hanging="390"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>`,
      `<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="o"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="780" w:hanging="390"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:hint="default"/></w:rPr></w:lvl>`,
      `<w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\uF0A7"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1170" w:hanging="390"/></w:pPr><w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings" w:hint="default"/></w:rPr></w:lvl>`,
    ].join('');
    const decLvls = [
      ['decimal', '%1.', 390], ['lowerLetter', '%2.', 780], ['lowerRoman', '%3.', 1170],
    ].map((c, i) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${c[0]}"/><w:lvlText w:val="${c[1]}"/>` +
      `<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${c[2]}" w:hanging="390"/></w:pPr></w:lvl>`).join('');
    let numberingXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bulletLvls}</w:abstractNum>` +
      `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${decLvls}</w:abstractNum>` +
      `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>`;
    ctx.numOverrides.forEach(o => {
      numberingXml += `<w:num w:numId="${o.id}"><w:abstractNumId w:val="1"/>` +
        `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${o.start}"/></w:lvlOverride></w:num>`;
    });
    numberingXml += `</w:numbering>`;

    /* footnotes */
    let footnotesXml = null;
    if (fnSeq.length) {
      footnotesXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:footnote w:type="separator" w:id="0"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
        `<w:footnote w:type="continuationSeparator" w:id="1"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>`;
      fnSeq.forEach((id, i) => {
        const txt = (fnTexts[id - 1] || '').trim();
        footnotesXml += `<w:footnote w:id="${i + 2}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>` +
          `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r>` +
          `<w:r><w:t xml:space="preserve"> ${esc(txt)}</w:t></w:r></w:p></w:footnote>`;
      });
      footnotesXml += `</w:footnotes>`;
    }

    const settingsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:zoom w:percent="100"/>` + (pageColor ? '<w:displayBackgroundShape/>' : '') +
      `<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`;

    /* ---- package wiring ---- */
    const overrides = [
      ['/word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'],
      ['/word/styles.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml'],
      ['/word/numbering.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml'],
      ['/word/settings.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml'],
      ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
      ['/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml'],
    ];
    if (footnotesXml) overrides.push(['/word/footnotes.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml']);
    if (headerXml !== null) overrides.push(['/word/header1.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml']);
    if (footerXml !== null) overrides.push(['/word/footer1.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml']);

    const contentTypes =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      (ctx.imgs.some(i => i.fname.endsWith('png')) ? `<Default Extension="png" ContentType="image/png"/>` : '') +
      (ctx.imgs.some(i => i.fname.endsWith('jpeg')) ? `<Default Extension="jpeg" ContentType="image/jpeg"/>` : '') +
      (ctx.imgs.some(i => i.fname.endsWith('gif')) ? `<Default Extension="gif" ContentType="image/gif"/>` : '') +
      overrides.map(o => `<Override PartName="${o[0]}" ContentType="${o[1]}"/>`).join('') +
      `</Types>`;

    const rootRels =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
      `</Relationships>`;

    let docRels =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`;
    if (footnotesXml) docRels += `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>`;
    if (headerXml !== null) docRels += `<Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`;
    if (footerXml !== null) docRels += `<Relationship Id="rIdF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
    ctx.imgs.forEach((im, i) => {
      docRels += `<Relationship Id="rId${51 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.fname}"/>`;
    });
    ctx.links.forEach(l => {
      docRels += `<Relationship Id="${l.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l.href)}" TargetMode="External"/>`;
    });
    docRels += `</Relationships>`;

    const hdrPart = headerXml !== null ?
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
      `xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" ` +
      `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
      `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      headerXml + `</w:hdr>` : null;
    const ftrPart = footerXml !== null ?
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
      `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
      `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      footerXml + `</w:ftr>` : null;

    const now = new Date().toISOString();
    const core =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
      `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
      `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${esc(docName)}</dc:title><dc:creator>User</dc:creator>` +
      `<cp:lastModifiedBy>User</cp:lastModifiedBy>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    const appXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
      `<Application>Word Web Edition</Application></Properties>`;

    const files = [
      { name: '[Content_Types].xml', data: te.encode(contentTypes) },
      { name: '_rels/.rels', data: te.encode(rootRels) },
      { name: 'word/document.xml', data: te.encode(documentXml) },
      { name: 'word/styles.xml', data: te.encode(stylesXml) },
      { name: 'word/numbering.xml', data: te.encode(numberingXml) },
      { name: 'word/settings.xml', data: te.encode(settingsXml) },
      { name: 'word/_rels/document.xml.rels', data: te.encode(docRels) },
      { name: 'docProps/core.xml', data: te.encode(core) },
      { name: 'docProps/app.xml', data: te.encode(appXml) },
    ];
    if (footnotesXml) files.push({ name: 'word/footnotes.xml', data: te.encode(footnotesXml) });
    if (hdrPart) files.push({ name: 'word/header1.xml', data: te.encode(hdrPart) });
    if (ftrPart) files.push({ name: 'word/footer1.xml', data: te.encode(ftrPart) });
    ctx.imgs.forEach(im => files.push({ name: 'word/media/' + im.fname, data: im.bin }));
    return zipStore(files);
  }

  window.Docx = { exportDocx, crc32, zipStore };
})();
