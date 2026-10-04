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
   DocxImport: open Word files in the app.
     .docx — full OOXML import: paragraphs+styles, inline formatting, real
             lists (numbering.xml), tables (widths/shading/merges/borders),
             images, hyperlinks, footnotes, headers/footers (PAGE field),
             page geometry (size/margins/orientation), page color, page
             borders and text watermarks.
     .doc  — legacy binary (CFB container + FIB piece table): the document
             text is recovered faithfully; complex formatting is flattened
             (documented limitation).
     .rtf  — text-level import (control words stripped).
   Zero dependencies. Runs entirely in the page.
   ========================================================================== */
(function () {
  'use strict';

  const te = new TextDecoder('utf-8');
  const td1252 = new TextDecoder('windows-1252');
  const td16 = new TextDecoder('utf-16le');

  /* ============================ ZIP READER ============================ */
  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip package');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const out = new Map();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = te.decode(u8.subarray(off + 46, off + 46 + nlen));
      const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lelen;
      const raw = u8.subarray(start, start + csize);
      let data = null;
      if (method === 0) data = raw;
      else if (method === 8) data = await inflateRaw(raw);
      if (data) out.set(name, data);
      off += 46 + nlen + elen + clen;
    }
    return out;
  }

  /* ============================ XML HELPERS ============================ */
  const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const parser = new DOMParser();
  function xmlOf(files, name) {
    const b = files.get(name);
    if (!b) return null;
    const doc = parser.parseFromString(te.decode(b), 'text/xml');
    if (doc.querySelector('parsererror')) return null;
    return doc;
  }
  const kids = (n, ln) => n ? Array.from(n.children).filter(c => c.localName === ln) : [];
  const kid = (n, ln) => kids(n, ln)[0] || null;
  function attr(n, ln) {
    if (!n) return null;
    for (const a of n.attributes) if (a.localName === ln) return a.value;
    return null;
  }
  const twip2px = v => Math.round((parseFloat(v) || 0) / 15 * 10) / 10;   // 1 twip = 1/15 px @96dpi
  const halfPt2px = v => Math.round((parseFloat(v) || 0) / 2 * 96 / 72 * 100) / 100;
  const HL_HEX = { yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', black: '#000000', lightGray: '#C0C0C0', darkGray: '#808080', white: '#FFFFFF' };
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ============================ DOCX IMPORT ============================ */
  function readRels(xml) {
    const map = {};
    if (!xml) return map;
    Array.from(xml.documentElement.children).forEach(r => {
      map[attr(r, 'Id')] = { target: attr(r, 'Target'), type: attr(r, 'Type') || '', external: attr(r, 'TargetMode') === 'External' };
    });
    return map;
  }

  function rprToProps(rPr, into) {
    // flatten w:rPr into property bag; explicit val=0/false means OFF
    if (!rPr) return into;
    const onOff = e => {
      if (!e) return undefined;
      const v = attr(e, 'val');
      return (v === '0' || v === 'false' || v === 'off') ? false : true;
    };
    let e;
    if ((e = kid(rPr, 'b'))) { const v = onOff(e); if (v !== undefined) into.b = v; }
    if ((e = kid(rPr, 'i'))) { const v = onOff(e); if (v !== undefined) into.i = v; }
    if ((e = kid(rPr, 'strike')) || (e = kid(rPr, 'dstrike'))) { const v = onOff(e); if (v !== undefined) into.strike = v; }
    if ((e = kid(rPr, 'caps'))) { const v = onOff(e); if (v !== undefined) into.caps = v; }
    if ((e = kid(rPr, 'smallCaps'))) { const v = onOff(e); if (v !== undefined) into.sc = v; }
    if ((e = kid(rPr, 'u'))) {
      const v = attr(e, 'val');
      if (v && v !== 'none') { into.u = true; into.uStyle = v; }
      else if (v === 'none') { into.u = false; }
    }
    if ((e = kid(rPr, 'color'))) { const v = attr(e, 'val'); if (v && v !== 'auto') into.color = '#' + v.toUpperCase(); }
    if ((e = kid(rPr, 'highlight'))) { const v = attr(e, 'val'); if (HL_HEX[v]) into.bg = HL_HEX[v]; }
    if ((e = kid(rPr, 'shd'))) { const v = attr(e, 'fill'); if (v && v !== 'auto' && v !== 'FFFFFF') into.bg = '#' + v.toUpperCase(); }
    if ((e = kid(rPr, 'sz'))) { const v = attr(e, 'val'); if (v) into.sz = halfPt2px(v); }
    if ((e = kid(rPr, 'rFonts'))) {
      const v = attr(e, 'ascii') || attr(e, 'hAnsi');
      if (v) into.font = v;
    }
    if ((e = kid(rPr, 'vertAlign'))) { const v = attr(e, 'val'); if (v === 'superscript') into.sup = true; else if (v === 'subscript') into.sub = true; else { into.sup = into.sub = false; } }
    if ((e = kid(rPr, 'rStyle'))) { const v = attr(e, 'val'); if (v) into.cstyle = v; }
    return into;
  }

  function propsToHtml(textHtml, p) {
    let inner = textHtml;
    const st = [];
    if (p.color) st.push(`color:${p.color}`);
    if (p.bg) st.push(`background-color:${p.bg}`);
    if (p.font) st.push(`font-family:'${String(p.font).replace(/'/g, '')}';`);
    if (p.sz) st.push(`font-size:${p.sz}px`);
    if (p.caps) st.push('text-transform:uppercase');
    if (p.sc) st.push('font-variant-caps:small-caps');
    if (p.b === false) st.push('font-weight:400');
    if (p.i === false) st.push('font-style:normal');
    if (p.u === false) st.push('text-decoration:none');
    if (st.length) inner = `<span style="${st.join(';')}">${inner}</span>`;
    if (p.sup) inner = `<sup>${inner}</sup>`;
    if (p.sub) inner = `<sub>${inner}</sub>`;
    if (p.strike) inner = `<s>${inner}</s>`;
    if (p.u) inner = `<u${p.uStyle && p.uStyle !== 'single' ? ` style="text-decoration-style:${p.uStyle === 'wavy' ? 'wavy' : p.uStyle}"` : ''}>${inner}</u>`;
    if (p.i) inner = `<i>${inner}</i>`;
    if (p.b) inner = `<b>${inner}</b>`;
    return inner;
  }

  async function importDocx(buf, name) {
    const files = await unzip(buf);
    if (!files.has('word/document.xml')) throw new Error('word/document.xml missing — not a .docx');
    const docXml = xmlOf(files, 'word/document.xml');
    const stylesXml = xmlOf(files, 'word/styles.xml');
    const numXml = xmlOf(files, 'word/numbering.xml');
    const settingsXml = xmlOf(files, 'word/settings.xml');
    const relsXml = xmlOf(files, 'word/_rels/document.xml.rels');
    const warnings = [];
    const rels = readRels(relsXml);

    /* styles: styleId -> {name, rPr} */
    const styles = {};
    if (stylesXml) kids(stylesXml.documentElement, 'style').forEach(s => {
      const id = attr(s, 'styleId');
      const nm = attr(kid(s, 'name'), 'val') || id;
      const pPr = kid(s, 'pPr');
      const npr = pPr ? kid(pPr, 'numPr') : null;
      styles[id] = {
        name: nm, rpr: rprToProps(kid(s, 'rPr'), {}),
        // styles like "List Bullet"/"List Number" carry the list identity for the paragraph
        num: npr ? { numId: attr(kid(npr, 'numId'), 'val') || '1', ilvl: attr(kid(npr, 'ilvl'), 'val') || '0' } : null,
      };
    });
    const styleTag = sid => {
      const s = styles[sid];
      const key = (s ? s.name : sid || '').toLowerCase();
      if (/heading\s*1/.test(key)) return { tag: 'h1' };
      if (/heading\s*2/.test(key)) return { tag: 'h2' };
      if (/heading\s*3/.test(key)) return { tag: 'h3' };
      if (/heading\s*4|heading\s*5|heading\s*6/.test(key)) return { tag: 'h4' };
      if (key === 'title') return { tag: 'p', cls: 'sty-title' };
      if (key === 'subtitle') return { tag: 'p', cls: 'sty-subtitle' };
      if (key === 'quote') return { tag: 'blockquote' };
      if (/intense quote/.test(key)) return { tag: 'p', cls: 'sty-iquote' };
      if (/no spacing/.test(key)) return { tag: 'p', cls: 'sty-nosp' };
      return null;
    };
    const styleRpr = sid => styles[sid] ? styles[sid].rpr : {};

    /* numbering: numId -> ilvl -> fmt */
    const abstract = {};
    if (numXml) {
      kids(numXml.documentElement, 'abstractNum').forEach(a => {
        const id = attr(a, 'abstractNumId');
        abstract[id] = {};
        kids(a, 'lvl').forEach(l => {
          abstract[id][attr(l, 'ilvl') || '0'] = attr(kid(l, 'numFmt'), 'val') || 'bullet';
        });
      });
    }
    const numFmt = {}, numStart = {};
    if (numXml) kids(numXml.documentElement, 'num').forEach(n => {
      const numId = attr(n, 'numId');
      const absId = attr(kid(n, 'abstractNumId'), 'val');
      numFmt[numId] = abstract[absId] || {};
      const ov = kid(n, 'lvlOverride');
      const so = ov && kid(ov, 'startOverride');
      if (so && attr(so, 'val')) numStart[numId] = parseInt(attr(so, 'val')) || 1;
    });

    /* media -> data URL */
    const b64 = u8 => {
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };
    const mediaUrl = rid => {
      const rel = rels[rid];
      if (!rel) return null;
      const path = 'word/' + rel.target.replace(/^\//, '');
      const data = files.get(path);
      if (!data) return null;
      const ext = (path.split('.').pop() || 'png').toLowerCase();
      if (!MIME[ext]) { warnings.push('Skipped an embedded ' + ext.toUpperCase() + ' image (format not displayable in the browser)'); return null; }
      return `data:${MIME[ext]};base64,${b64(data)}`;
    };

    /* field state machine (PAGE/NUMPAGES markers vs visible results) */
    const fld = { depth: 0, instr: '', suppress: false };

    function runHtml(r, baseRpr, ctx) {
      const rPr = kid(r, 'rPr');
      const own = rprToProps(rPr, {});
      const props = Object.assign({}, baseRpr, own);
      let parts = [];
      const emitText = t => { if (t) parts.push(escHtml(t)); };
      Array.from(r.childNodes).forEach(ch => {
        const ln = ch.localName;
        if (ln === 't') { if (!fld.suppress) emitText(ch.textContent); }
        else if (ln === 'tab') { if (!fld.suppress) parts.push('<span class="wtab">\u00A0\u00A0\u00A0\u00A0</span>'); }
        else if (ln === 'br' || ln === 'cr') {
          if (attr(ch, 'type') === 'page') { if (!fld.suppress) parts.push({ pageBreak: true }); }
          else if (!fld.suppress) parts.push('<br>');
        }
        else if (ln === 'noBreakHyphen') { if (!fld.suppress) parts.push('\u2011'); }
        else if (ln === 'softHyphen') { /* invisible */ }
        else if (ln === 'fldChar') {
          const t = attr(ch, 'fldCharType');
          if (t === 'begin') { fld.depth++; if (fld.depth === 1) { fld.instr = ''; fld.suppress = false; } }
          else if (t === 'separate' && fld.depth === 1) {
            if (/\b(PAGE|NUMPAGES)\b/.test(fld.instr)) {
              parts.push({ field: /NUMPAGES/.test(fld.instr) ? 'NUMPAGES' : 'PAGE' });
              fld.suppress = true;
            }
          }
          else if (t === 'end') { if (fld.depth === 1) { fld.suppress = false; } fld.depth = Math.max(0, fld.depth - 1); }
        }
        else if (ln === 'instrText') { if (fld.depth) fld.instr += ch.textContent; }
        else if (ln === 'footnoteReference') {
          const id = attr(ch, 'id');
          if (id && +id >= 2) parts.push({ fnRef: +id });
        }
        else if (ln === 'drawing' || ln === 'pict') {
          const blip = ch.getElementsByTagName('a:blip')[0] || ch.getElementsByTagName('blip')[0];
          const rid = blip && (attr(blip, 'embed') || attr(blip, 'link'));
          const url = rid && mediaUrl(rid);
          if (url) {
            const ext = ch.getElementsByTagName('wp:extent')[0];
            let w = 0, h = 0;
            if (ext) { w = Math.round((+attr(ext, 'cx') || 0) / 9525); h = Math.round((+attr(ext, 'cy') || 0) / 9525); }
            if (!w) {
              const xext = ch.getElementsByTagName('a:ext')[0];
              if (xext) { w = Math.round((+attr(xext, 'cx') || 0) / 9525); h = Math.round((+attr(xext, 'cy') || 0) / 9525); }
            }
            parts.push({ img: url, w: w || 300, h: h || 200 });
          } else if (ln === 'drawing') warnings.push('An embedded image could not be decoded');
        }
      });
      if (props.cstyle && /hyperlink/i.test(props.cstyle) && !props.u) { props.u = true; if (!props.color) props.color = '#0563C1'; }
      if (props.sup || props.sub) { props.sz = null; } // keep app convention: sup/sub shrink via tag
      return parts.map(p => typeof p === 'string' ? propsToHtml(p, props) : Object.assign(p, { fmt: props }));
    }

    function paraContents(p, ctx) {
      const pPr = kid(p, 'pPr');
      const sid = pPr ? attr(kid(pPr, 'pStyle'), 'val') : null;
      const baseRpr = Object.assign({}, sid ? styleRpr(sid) : {});
      let out = [];
      Array.from(p.childNodes).forEach(ch => {
        const ln = ch.localName;
        if (ln === 'r') out = out.concat(runHtml(ch, baseRpr, ctx));
        else if (ln === 'hyperlink') {
          const rid = attr(ch, 'id');
          const anchor = attr(ch, 'anchor');
          const href = rid && rels[rid] ? rels[rid].target : (anchor ? '#' + anchor : null);
          let inner = [];
          Array.from(ch.childNodes).forEach(r => { if (r.localName === 'r') inner = inner.concat(runHtml(r, baseRpr, ctx)); });
          inner.forEach(p2 => {
            if (typeof p2 === 'string') out.push(href ? `<a href="${escHtml(href)}" target="_blank">${p2}</a>` : p2);
            else out.push(p2);
          });
        }
        else if (ln === 'fldSimple') {
          const instr = attr(ch, 'instr') || '';
          if (/\bPAGE\b/.test(instr)) out.push({ field: 'PAGE' });
          else if (/\bNUMPAGES\b/.test(instr)) out.push({ field: 'NUMPAGES' });
          else Array.from(ch.childNodes).forEach(r => { if (r.localName === 'r') out = out.concat(runHtml(r, baseRpr, ctx)); });
        }
        else if (ln === 'smartTag' || ln === 'ins' || ln === 'sdt') {
          const inner = ln === 'sdt' ? (kid(ch, 'sdtContent') || ch) : ch;
          Array.from(inner.childNodes).forEach(r => { if (r.localName === 'r') out = out.concat(runHtml(r, baseRpr, ctx)); });
        }
        else if (ln === 'del' || ln === 'proofErr' || ln === 'bookmarkStart' || ln === 'bookmarkEnd' || ln === 'commentRangeStart' || ln === 'commentRangeEnd' || ln === 'permStart' || ln === 'permEnd' || ln === 'lastRenderedPageBreak') { /* skip */ }
      });
      return { parts: out, sid };
    }

    function paraElement(p, ctx) {
      const pPr = kid(p, 'pPr');
      const { parts, sid } = paraContents(p, ctx);
      // split on explicit page breaks into: para, .pbreak, para, ...
      const nodes = [];
      let cur = parts, seg = [];
      cur.forEach(pt => {
        if (pt && pt.pageBreak) { nodes.push(seg); seg = []; }
        else seg.push(pt);
      });
      nodes.push(seg);
      const st = styleTag(sid);
      const built = nodes.map((segParts, idx) => {
        if (!segParts.length && idx < nodes.length - 1) return null;
        const tag = idx === 0 ? (st ? st.tag : 'p') : 'p';
        const el = document.createElement(tag);
        if (idx === 0 && st && st.cls) el.className = st.cls;
        let html = '';
        segParts.forEach(pt => {
          if (typeof pt === 'string') html += pt;
          else if (pt.field) html += `<span data-fld="${pt.field}">1</span>`;
          else if (pt.img) html += `<img src="${pt.img}" style="width:${pt.w}px;height:${pt.h}px;max-width:100%">`;
          else if (pt.fnRef) {
            const seq = ctx.fnSeq++;
            ctx.fnMap[pt.fnRef] = seq;
            html += `<sup data-fn="${seq}" style="font-size:10px">${ctx.fnCount++}</sup>`;
          }
        });
        el.innerHTML = html || '<br>';
        // paragraph properties (first segment only)
        if (idx === 0 && pPr) {
          const css = el.style;
          const jc = attr(kid(pPr, 'jc'), 'val');
          if (jc === 'center') css.textAlign = 'center';
          else if (jc === 'right' || jc === 'end') css.textAlign = 'right';
          else if (jc === 'both') css.textAlign = 'justify';
          const sp = kid(pPr, 'spacing');
          if (sp) {
            if (attr(sp, 'before')) css.marginTop = twip2px(attr(sp, 'before')) + 'px';
            if (attr(sp, 'after')) css.marginBottom = twip2px(attr(sp, 'after')) + 'px';
            const lr = attr(sp, 'lineRule'), lv = parseFloat(attr(sp, 'line'));
            if (lv) {
              if (!lr || lr === 'auto') css.lineHeight = String(Math.round(lv / 240 * 100) / 100);
              else css.lineHeight = twip2px(lv) + 'px';
            }
          }
          const ind = kid(pPr, 'ind');
          const hasNumPr = !!kid(pPr, 'numPr');
          if (ind && !hasNumPr) {
            if (attr(ind, 'left')) css.marginLeft = twip2px(attr(ind, 'left')) + 'px';
            if (attr(ind, 'right')) css.marginRight = twip2px(attr(ind, 'right')) + 'px';
            if (attr(ind, 'firstLine')) css.textIndent = twip2px(attr(ind, 'firstLine')) + 'px';
            if (attr(ind, 'hanging')) css.textIndent = '-' + twip2px(attr(ind, 'hanging')) + 'px';
          }
          const shd = kid(pPr, 'shd');
          if (shd) { const f = attr(shd, 'fill'); if (f && f !== 'auto' && f !== 'FFFFFF') css.backgroundColor = '#' + f; }
          const pBdr = kid(pPr, 'pBdr');
          if (pBdr && kid(pBdr, 'bottom') && !html.trim()) {
            css.borderBottom = '1px solid ' + ('#' + (attr(kid(pBdr, 'bottom'), 'color') || '000000')).replace('#auto', '#000000');
            css.minHeight = '1em';
          }
          if (kid(pPr, 'pageBreakBefore')) ctx.pendingBreak = true;
        }
        return el;
      }).filter(Boolean);
      // interleave page-break markers
      const final = [];
      built.forEach((n, i) => { if (i > 0) final.push(pbreakEl()); final.push(n); });
      if (ctx.pendingBreak) { final.unshift(pbreakEl()); ctx.pendingBreak = false; }
      return final;
    }
    function pbreakEl() {
      const d = document.createElement('div');
      d.className = 'pbreak';
      return d;
    }

    function tableElement(tbl, ctx) {
      const t = document.createElement('table');
      t.style.borderCollapse = 'collapse';
      const tblPr = kid(tbl, 'tblPr');
      let borders = null; // {val,sz,color}
      if (tblPr) {
        const w = kid(tblPr, 'tblW');
        if (w) {
          const type = attr(w, 'type'), v = parseFloat(attr(w, 'w'));
          if (type === 'pct') t.style.width = (v / 50) + '%';
          else if (type === 'dxa' && v) t.style.width = twip2px(v) + 'px';
        }
        const jc = attr(kid(tblPr, 'jc'), 'val');
        if (jc === 'center') t.style.margin = '0 auto';
        const tb = kid(tblPr, 'tblBorders');
        if (tb) {
          const any = kid(tb, 'top');
          const val = any ? (attr(any, 'val') || 'single') : 'single';
          if (val === 'nil' || val === 'none') borders = { none: true };
          else borders = {
            val: { double: 'double', dashed: 'dashed', dotted: 'dotted' }[val] || 'solid',
            px: Math.max(1, Math.round((parseFloat(attr(any, 'sz')) || 4) / 8 * 96 / 72)),
            color: '#' + (attr(any, 'color') || '000000').toUpperCase(),
          };
        }
      }
      if (borders && !borders.none) t.style.border = `${borders.px}px ${borders.val} ${borders.color}`;
      const gridCols = kids(kid(tbl, 'tblGrid'), 'gridCol').map(g => twip2px(attr(g, 'w')));
      if (gridCols.length) {
        const cg = document.createElement('colgroup');
        gridCols.forEach(w => {
          const c = document.createElement('col');
          if (w) c.style.width = w + 'px';
          cg.appendChild(c);
        });
        t.appendChild(cg);
      }
      const merges = {}; // col -> td element awaiting continuation rows
      kids(tbl, 'tr').forEach(tr => {
        const row = document.createElement('tr');
        const rowCells = kids(tr, 'tc');
        let col = 0;
        rowCells.forEach(tc => {
          while (merges[col] === 'skip') col++;   // col occupied by a continued vertical merge
          const tcPr = kid(tc, 'tcPr');
          const vm = kid(tcPr, 'vMerge');
          if (vm && attr(vm, 'val') !== 'restart') {
            const owner = merges[col];
            if (owner && owner !== 'skip') { owner.rowSpan = (owner.rowSpan || 1) + 1; }
            col++;
            return;
          }
          const el = document.createElement('td');
          const gs = parseInt(attr(kid(tcPr, 'gridSpan'), 'val') || '1');
          if (gs > 1) el.colSpan = gs;
          if (vm && attr(vm, 'val') === 'restart') merges[col] = el;
          else delete merges[col];
          const shd = kid(tcPr, 'shd');
          if (shd) { const f = attr(shd, 'fill'); if (f && f !== 'auto' && f !== 'FFFFFF') el.style.backgroundColor = '#' + f; }
          const va = attr(kid(tcPr, 'vAlign'), 'val');
          if (va) el.style.verticalAlign = va === 'center' ? 'middle' : va;
          if (borders && !borders.none) el.style.border = `${borders.px}px ${borders.val} ${borders.color}`;
          else if (!borders) el.style.border = '1px solid #C8C6C4';
          el.style.padding = '4px 7px';
          const frag = convertChildren(tc, ctx);
          if (!frag.length) el.innerHTML = '<p><br></p>';
          else frag.forEach(n => el.appendChild(n));
          row.appendChild(el);
          for (let k = 1; k < gs; k++) col++;
          col++;
        });
        t.appendChild(row);
      });
      return t;
    }

    /* flatten a container (body/cell/sdtContent) into block nodes w/ list nesting */
    function convertChildren(container, ctx) {
      const out = [];
      let listStack = []; // [{ilvl, fmt, el, liEl}]
      const closeListsTo = lvl => { while (listStack.length > lvl) listStack.pop(); };
      const listTagFor = fmt => fmt === 'bullet' ? 'ul' : 'ol';
      Array.from(container.children).forEach(ch => {
        const ln = ch.localName;
        if (ln === 'p') {
          const pPr = kid(ch, 'pPr');
          let nprInfo = null;
          const npr = pPr ? kid(pPr, 'numPr') : null;
          if (npr) nprInfo = { numId: attr(kid(npr, 'numId'), 'val') || '1', ilvl: attr(kid(npr, 'ilvl'), 'val') || '0' };
          else {
            // numbering inherited from the paragraph style (List Bullet/List Number)
            const sid = pPr ? attr(kid(pPr, 'pStyle'), 'val') : null;
            if (sid && styles[sid] && styles[sid].num) nprInfo = styles[sid].num;
          }
          if (nprInfo) {
            const numId = nprInfo.numId;
            let ilvl = parseInt(nprInfo.ilvl);
            ilvl = Math.min(2, isNaN(ilvl) ? 0 : ilvl);
            const fmt = (numFmt[numId] && (numFmt[numId][ilvl] || numFmt[numId]['0'])) || 'bullet';
            while (listStack.length > ilvl + 1) listStack.pop();   // dedent: close deeper levels only
            let top = listStack[ilvl];
            if (!(top && top.ilvl === ilvl && top.fmt === fmt && top.numId === numId)) {
              if (listStack.length > ilvl) listStack.pop();        // replace this level's list
              const li = document.createElement(listTagFor(fmt));
              if (fmt === 'lowerLetter') li.style.listStyleType = 'lower-alpha';
              else if (fmt === 'lowerRoman') li.style.listStyleType = 'lower-roman';
              else if (fmt === 'upperLetter') li.style.listStyleType = 'upper-alpha';
              else if (fmt === 'upperRoman') li.style.listStyleType = 'upper-roman';
              const startOverride = numStart[numId];
              if (li.tagName === 'OL' && startOverride && startOverride > 1) li.start = startOverride;
              const parentLi = ilvl > 0 ? (listStack[ilvl - 1] && listStack[ilvl - 1].liEl) : null;
              if (parentLi) parentLi.appendChild(li); else out.push(li);
              listStack.push({ ilvl, fmt, numId, el: li, liEl: null });
              top = listStack[listStack.length - 1];
            }
            const nodes = paraElement(ch, ctx);
            nodes.forEach(n => {
              if (n.classList && n.classList.contains('pbreak')) { out.push(n); return; }
              const li = document.createElement('li');
              // move content into the li, preserving the paragraph's inline style
              if (n.style && n.style.cssText) li.style.cssText = n.style.cssText;
              if (n.className) li.className = n.className;
              li.innerHTML = n.innerHTML;
              top.el.appendChild(li);
              top.liEl = li;
            });
          } else {
            closeListsTo(0);
            paraElement(ch, ctx).forEach(n => out.push(n));
          }
          if (kid(kid(ch, 'pPr'), 'sectPr')) { closeListsTo(0); out.push(pbreakEl()); } // section break -> new page
        }
        else if (ln === 'tbl') { closeListsTo(0); out.push(tableElement(ch, ctx)); }
        else if (ln === 'sdt') {
          const inner = kid(ch, 'sdtContent');
          if (inner) convertChildren(inner, ctx).forEach(n => out.push(n));
        }
        else if (ln === 'sectPr') { /* handled by caller */ }
      });
      return out;
    }

    /* run the body */
    const ctx = { fnSeq: 1, fnCount: 1, fnMap: {}, pendingBreak: false };
    const root = document.createElement('div');
    convertChildren(docXml.documentElement && kid(docXml.documentElement, 'body') || docXml.documentElement, ctx).forEach(n => root.appendChild(n));
    if (!root.children.length) root.innerHTML = '<p><br></p>';

    /* footnotes */
    const fnModel = {};
    const fnXml = xmlOf(files, 'word/footnotes.xml');
    if (fnXml) {
      kids(fnXml.documentElement, 'footnote').forEach(f => {
        const id = +(attr(f, 'id') || 0);
        if (ctx.fnMap[id]) {
          const sub = document.createElement('div');
          convertChildren(f, {}).forEach(n => sub.appendChild(n));
          fnModel[ctx.fnMap[id]] = sub.textContent.trim();
        }
      });
    }

    /* section properties: geometry, borders, background */
    const body = kid(docXml.documentElement, 'body');
    const sects = [];
    if (body) {
      const direct = kid(body, 'sectPr');
      if (direct) sects.push(direct);
      kids(body, 'p').forEach(p => { const s = kid(kid(p, 'pPr'), 'sectPr'); if (s) sects.push(s); });
    }
    const sect = sects[sects.length - 1] || null;
    const out = {
      name, html: root.innerHTML, hf: { header: '', footer: '' },
      margins: null, pageSize: null, pageColor: '', pageBorder: null, wm: null,
      fnModel, warnings,
    };
    let bg = kid(docXml.documentElement, 'background');
    if (bg) {
      const c = attr(bg, 'color');
      if (c && c !== 'auto') out.pageColor = '#' + c.toUpperCase();
    }
    let hdrPart = null, ftrPart = null;
    if (sect) {
      const pgSz = kid(sect, 'pgSz');
      if (pgSz) {
        const wIn = Math.round((parseFloat(attr(pgSz, 'w')) || 12240) / 1440 * 100) / 100;
        const hIn = Math.round((parseFloat(attr(pgSz, 'h')) || 15840) / 1440 * 100) / 100;
        const land = attr(pgSz, 'orient') === 'landscape';
        const SIZE_TABLE = { Letter: [8.5, 11], Legal: [8.5, 14], A4: [8.27, 11.69], A5: [5.83, 8.27], Executive: [7.25, 10.5] };
        let nm = 'Custom';
        for (const k of Object.keys(SIZE_TABLE)) {
          const [a, b] = SIZE_TABLE[k];
          if (Math.abs(a - wIn) < 0.04 && Math.abs(b - hIn) < 0.04) { nm = k; break; }
        }
        out.pageSize = { name: nm, wIn, hIn, w: Math.round(wIn * 96), h: Math.round(hIn * 96), landscape: land };
      }
      const pgMar = kid(sect, 'pgMar');
      if (pgMar) {
        out.margins = {
          t: twip2px(attr(pgMar, 'top')), r: twip2px(attr(pgMar, 'right')),
          b: twip2px(attr(pgMar, 'bottom')), l: twip2px(attr(pgMar, 'left')),
        };
      }
      const pgB = kid(sect, 'pgBorders');
      if (pgB) {
        const top = kid(pgB, 'top');
        if (top && attr(top, 'val') && attr(top, 'val') !== 'none' && attr(top, 'val') !== 'nil') {
          out.pageBorder = {
            style: { single: 'solid', double: 'double', dashed: 'dashed', dotted: 'dotted' }[attr(top, 'val')] || 'solid',
            color: '#' + (attr(top, 'color') || '000000').toUpperCase(),
            width: Math.max(0.5, Math.round((parseFloat(attr(top, 'sz')) || 8) / 8 * 2) / 2),
          };
        }
      }
      kids(sect, 'headerReference').forEach(h => {
        if (attr(h, 'type') === 'default') {
          const rel = rels[attr(h, 'id')];
          if (rel && !hdrPart) hdrPart = 'word/' + rel.target;
        }
      });
      kids(sect, 'footerReference').forEach(f => {
        if (attr(f, 'type') === 'default') {
          const rel = rels[attr(f, 'id')];
          if (rel && !ftrPart) ftrPart = 'word/' + rel.target;
        }
      });
    }
    const bandHtml = path => {
      if (!path || !files.has(path)) return '';
      const x = xmlOf(files, path);
      if (!x || !x.documentElement) return '';
      // watermark recovery (Word stores text watermarks as VML in the header)
      const raw = te.decode(files.get(path));
      const wmIdx = raw.indexOf('PowerPlusWaterMarkObject');
      if (wmIdx >= 0 && !out.wm) {
        const seg = raw.slice(wmIdx, wmIdx + 3000);
        const txtM = seg.match(/<v:textpath[^>]*?string="([^"]*)"/);
        if (txtM) {
          const colM = seg.match(/fillcolor="(#[0-9A-Fa-f]{3,6}|[0-9A-Fa-f]{6}|[a-zA-Z]+)"/);
          const sizeM = seg.match(/width:([\d.]+)pt/);
          const opM = seg.match(/<v:fill[^>]*?opacity="([\d.]+)"/);
          const wpt = sizeM ? parseFloat(sizeM[1]) : 527;
          const alpha = opM ? Math.round(parseFloat(opM[1]) * 100) / 100 : 0.28;
          let color = 'rgba(128,128,128,.28)';
          let col = colM ? colM[1] : null;
          if (col && /^[0-9A-Fa-f]{6}$/.test(col)) col = '#' + col;
          if (col && col[0] === '#' && col.length === 7) {
            color = `rgba(${parseInt(col.slice(1, 3), 16)},${parseInt(col.slice(3, 5), 16)},${parseInt(col.slice(5, 7), 16)},${alpha})`;
          }
          out.wm = { text: txtM[1], color, size: Math.max(48, Math.round(wpt / 527 * 96)) };
        }
      }
      const holder = document.createElement('div');
      convertChildren(x.documentElement, {}).forEach(n => holder.appendChild(n));
      // strip watermark paragraphs (empty text with a pict)
      Array.from(holder.querySelectorAll('p')).forEach(p => {
        if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
      });
      return holder.innerHTML;
    };
    if (hdrPart) out.hf.header = bandHtml(hdrPart);
    if (ftrPart) out.hf.footer = bandHtml(ftrPart);

    out.warnings = warnings;
    return out;
  }

  /* ============================ LEGACY .doc (CFB) ============================ */
  const FREE = 0xFFFFFFFF, EOC = 0xFFFFFFFE, FATSECT = 0xFFFFFFFD, DIFSECT = 0xFFFFFFFC;
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
    const chain = (start, maxGuard) => {
      const out = [];
      let s = start, guard = maxGuard || 100000;
      while (s !== EOC && s !== FREE && s < fat.length && guard-- > 0) { out.push(s); s = fat[s]; }
      return out;
    };
    const readChain = (start, size) => {
      const secs = chain(start);
      const out = new Uint8Array(size);
      let p = 0;
      for (const s of secs) {
        const base = (s + 1) * secSize;
        const n = Math.min(secSize, size - p);
        if (n <= 0) break;
        out.set(u8.subarray(base, base + n), p);
        p += n;
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
      entries.push({
        name: nm, type: ddv.getUint8(off + 66),
        start: ddv.getUint32(off + 116, true), size: ddv.getUint32(off + 120, true),
      });
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

  function docExtractText(buf) {
    const cfb = cfbOpen(buf);
    const wdEntry = cfb.find('WordDocument');
    if (!wdEntry) throw new Error('not a Word binary document');
    const wd = cfb.openStream(wdEntry);
    const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
    const flags = dv.getUint16(0x0A, true);
    const tblName = (flags & 0x0200) ? '1Table' : '0Table';
    let fcClx = 0, lcbClx = 0;
    if (wd.length > 0x01A6) { fcClx = dv.getUint32(0x01A2, true); lcbClx = dv.getUint32(0x01A6, true); }
    let text = '';
    const tbl = cfb.find(tblName);
    if (tbl && lcbClx) {
      const tblData = cfb.openStream(tbl);
      const tdv = new DataView(tblData.buffer, tblData.byteOffset, tblData.byteLength);
      let off = fcClx;
      const clxEnd = fcClx + lcbClx;
      // skip Prc entries (0x01)
      while (off < clxEnd && tdv.getUint8(off) === 0x01) {
        const cb = tdv.getUint16(off + 1, true);
        off += 3 + cb;
      }
      if (off < clxEnd && tdv.getUint8(off) === 0x02) {
        const lcb = tdv.getUint32(off + 1, true);
        const plc = off + 5;
        const n = (lcb - 4) / 12;
        for (let i = 0; i < n; i++) {
          const cpStart = tdv.getUint32(plc + i * 4, true);
          const cpEnd = tdv.getUint32(plc + (i + 1) * 4, true);
          const pcd = plc + (n + 1) * 4 + i * 8;
          const fcRaw = tdv.getUint32(pcd + 2, true);
          const compressed = (fcRaw & 0x40000000) !== 0;
          const fc = compressed ? (fcRaw & 0x3FFFFFFF) / 2 : fcRaw;
          const chars = cpEnd - cpStart;
          if (chars <= 0 || fc >= wd.length) continue;
          if (compressed) text += td1252.decode(wd.subarray(fc, Math.min(wd.length, fc + chars)));
          else text += td16.decode(wd.subarray(fc, Math.min(wd.length, fc + chars * 2)));
        }
      }
    }
    if (!text) { // fallback: raw printable scan of the WordDocument stream
      let cur = '';
      for (let i = 0; i < wd.length; i++) {
        const c = wd[i];
        if (c >= 32 && c < 127) cur += String.fromCharCode(c);
        else { if (cur.length > 400) { text += cur + '\n'; } cur = ''; }
      }
    }
    return text;
  }

  function docToModel(buf, name) {
    let text = docExtractText(buf);
    text = text
      .replace(/[\x00-\x08\x0E-\x1F]/g, '')
      .replace(/\x0B/g, ' ')
      .replace(/\x0C/g, '\rPBREAK\r')
      .replace(/\x07+/g, '')
      .replace(/\u0013[^\u0014]*\u0014?/g, '')   // field begin..separate
      .replace(/\u0015/g, '');                  // field end
    const blocks = [];
    text.split('\r').forEach(line => {
      if (line === 'PBREAK') { blocks.push('<div class="pbreak"></div>'); return; }
      const t = line.trim();
      blocks.push(t ? `<p>${escHtml(t.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0'))}</p>` : '');
    });
    const html = blocks.filter(b => b).join('') || '<p><br></p>';
    return {
      name, html, hf: { header: '', footer: '' }, margins: null, pageSize: null,
      pageColor: '', pageBorder: null, wm: null, fnModel: {},
      warnings: ['This is a legacy .doc file: the full text was imported, but rich formatting is flattened. Export back as .docx to keep formatting.'],
    };
  }

  /* ============================ RTF (text level) ============================ */
  function rtfToModel(text, name) {
    let s = text.replace(/\r\n?/g, '\n');
    s = s.replace(/^\s*\{\\(fonttbl|colortbl|stylesheet|info|pict|generator)\b[\s\S]*?\n?\}/m, '');
    let out = '', depth = 0, i = 0, skipDepth = -1;
    while (i < s.length) {
      const c = s[i];
      if (c === '{') { depth++; i++; continue; }
      if (c === '}') { if (skipDepth === depth) skipDepth = -1; depth--; i++; continue; }
      if (c === '\\') {
        const m = s.slice(i).match(/^\\([a-zA-Z]+)(-?\d+)? ?|^\\([^{\\])|^\\'([0-9a-fA-F]{2})/);
        if (m) {
          if (m[4]) { out += String.fromCharCode(parseInt(m[4], 16)); }
          else if (m[3]) { out += m[3]; }
          else if (m[1] === 'par' || m[1] === 'line') { if (skipDepth < 0) out += '\n'; }
          else if (m[1] === 'tab') out += '\t';
          else if (m[1] === 'u' && m[2]) out += String.fromCharCode(parseInt(m[2]) & 0xFFFF);
          else if (['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict'].includes(m[1])) skipDepth = depth;
          i += m[0].length;
          continue;
        }
        i++; continue;
      }
      if (skipDepth < 0) out += c;
      i++;
    }
    const esc = s2 => escHtml(s2);
    const html = out.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => `<p>${esc(l.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0'))}</p>`).join('') || '<p><br></p>';
    return {
      name, html, hf: { header: '', footer: '' }, margins: null, pageSize: null,
      pageColor: '', pageBorder: null, wm: null, fnModel: {},
      warnings: ['RTF files are imported as text.'],
    };
  }

  /* ============================ detection + dispatch ============================ */
  const u8head = (buf, n) => new Uint8Array(buf, 0, Math.min(n, buf.byteLength));
  async function importBuffer(buf, name) {
    const head = u8head(buf, 8);
    const isZip = head[0] === 0x50 && head[1] === 0x4B;
    const isCfb = head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0;
    const isRtf = te.decode(head.subarray(0, 5)) === '{\\rtf';
    if (isZip) return importDocx(buf, name);
    if (isCfb) return docToModel(buf, name);
    if (isRtf) return rtfToModel(te.decode(new Uint8Array(buf)), name);
    throw new Error('Unrecognized file format (not .docx, .doc or .rtf)');
  }

  window.DocxImport = { importBuffer, importDocx, docToModel, rtfToModel, unzip, cfbOpen, docExtractText };
})();
