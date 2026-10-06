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
   Word clone — extended application (backstage, dialogs, comments, ink)
   ========================================================================== */
(function () {
'use strict';
const W = window.W;
const $ = W.$, $$ = W.$$, el = W.el, esc = W.esc, svgIcon = window.svgIcon;
const state = W.state, CMDS = W.CMDS;

/* ============================ PAGE GEOMETRY / THEMES ============================ */
const SIZE_TABLE = { Letter: [8.5, 11], Legal: [8.5, 14], A4: [8.27, 11.69], A5: [5.83, 8.27], Executive: [7.25, 10.5] };

function applyPageChrome() {
  const m = state.margins, ps = state.pageSize;
  $$('.page').forEach(pg => {
    pg.style.width = ps.w + 'px';
    pg.style.height = ps.h + 'px';
    pg.style.padding = `${m.t}px ${m.r}px ${m.b}px ${m.l}px`;
    $('.phdr', pg).style.left = m.l + 'px'; $('.phdr', pg).style.right = m.r + 'px';
    $('.phdr', pg).style.top = Math.max(24, m.t / 2) + 'px';
    $('.pftr', pg).style.left = m.l + 'px'; $('.pftr', pg).style.right = m.r + 'px';
    $('.pftr', pg).style.bottom = Math.max(24, m.b / 2) + 'px';
    $('.fns', pg).style.left = m.l + 'px'; $('.fns', pg).style.right = m.r + 'px';
    $('.fns', pg).style.bottom = m.b + 'px';
  });
  W.drawRulers(); W.schedulePaginate();
}
W.applyPageChrome = applyPageChrome;

W.setMargins = arr => {
  state.margins = { t: arr[0], r: arr[1], b: arr[2], l: arr[3] };
  applyPageChrome(); W.markDirty();
};
W.setPageSize = (name, wIn, hIn) => {
  if (wIn == null) [wIn, hIn] = SIZE_TABLE[name] || SIZE_TABLE.Letter;
  const land = state.pageSize.landscape;
  const w = Math.round((land ? hIn : wIn) * 96), h = Math.round((land ? wIn : hIn) * 96);
  state.pageSize = { name, wIn, hIn, w, h, landscape: land };
  applyPageChrome(); W.markDirty();
};
W.setOrientation = o => {
  const land = o === 'landscape';
  if (state.pageSize.landscape === land) return;
  state.pageSize.landscape = land;
  W.setPageSize(state.pageSize.name);
};

W.applyTheme = name => {
  state.themeName = name;
  const map = {
    office: { h: '#2E74B5', hf: "'Calibri Light','Calibri',sans-serif", bf: "'Calibri','Carlito',sans-serif" },
    facet: { h: '#447A26', hf: "'Franklin Gothic Medium','Arial',sans-serif", bf: "'Franklin Gothic Book','Arial',sans-serif" },
    ion: { h: '#0F6CBD', hf: "'Century Gothic','Futura',sans-serif", bf: "'Century Gothic','Futura',sans-serif" },
    board: { h: '#7C2E3E', hf: "'Georgia',serif", bf: "'Georgia',serif" },
  };
  const t = map[name] || map.office;
  W.applyThemeColor(t.h); W.applyThemeFonts(t.hf, t.bf);
};
W.applyThemeColor = c => { $('#pages').style.setProperty('--hcolor', c); W.markDirty(); };
W.applyThemeFonts = (hf, bf) => {
  const p = $('#pages');
  p.style.setProperty('--hfont', hf); p.style.setProperty('--bfont', bf);
  W.markDirty(); W.schedulePaginate();
};

/* ============================ WATERMARK / PAGE BORDERS ============================ */
function renderWM() {
  $$('.page .wm').forEach(w => {
    if (!state.wm) { w.innerHTML = ''; return; }
    w.innerHTML = `<span style="font-size:${state.wm.size || 96}px;color:${state.wm.color || 'rgba(128,128,128,.28)'}">${esc(state.wm.text)}</span>`;
  });
}
W.renderWM = renderWM;
function renderPageBorder() {
  $$('.page .pborder').forEach(pb => {
    const b = state.pageBorder;
    if (!b || b.style === 'none') { pb.hidden = true; return; }
    pb.hidden = false;
    const inset = 32;
    pb.style.cssText = `position:absolute;inset:${inset}px;border:${b.width || 2}px ${b.style === 'double' ? 'double' : (b.style || 'solid')} ${b.color || '#000'};pointer-events:none;z-index:2;`;
  });
}
W.renderPageBorder = renderPageBorder;

W.watermarkDialog = () => {
  const body = el('div');
  body.innerHTML = `
    <div class="frm-row"><label style="width:80px">Text:</label><input type="text" id="wm-t" style="flex:1" value="${esc(state.wm ? state.wm.text : 'CONFIDENTIAL')}"></div>
    <div class="frm-row"><label style="width:80px">Color:</label>
      <select id="wm-c"><option value="rgba(128,128,128,.28)">Gray</option><option value="rgba(192,0,0,.3)">Red</option><option value="rgba(43,87,154,.28)">Blue</option><option value="rgba(56,118,29,.3)">Green</option></select></div>
    <div class="frm-row"><label style="width:80px">Size:</label>
      <select id="wm-s"><option>72</option><option selected>96</option><option>120</option><option>144</option></select></div>
    <div class="frm-note">The watermark is placed diagonally behind the text on every page.</div>`;
  if (state.wm) {
    setTimeout(() => {
      $('#wm-c', body).value = state.wm.color;
      $('#wm-s', body).value = String(state.wm.size || 96);
    });
  }
  W.dlg({
    title: 'Printed Watermark', body, width: 400,
    buttons: [
      { label: 'No Watermark', action: () => { state.wm = null; renderWM(); W.markDirty(); } },
      { label: 'Cancel' },
      { label: 'OK', pri: true, action: () => {
        state.wm = { text: $('#wm-t', body).value || 'CONFIDENTIAL', color: $('#wm-c', body).value, size: +$('#wm-s', body).value };
        renderWM(); W.markDirty();
      } },
    ],
  });
};

W.pageBorderDialog = () => {
  const body = el('div');
  body.innerHTML = `
    <div class="frm-row"><label style="width:70px">Style:</label>
      <select id="pb-s"><option>solid</option><option>double</option><option>dashed</option><option value="none">None</option></select></div>
    <div class="frm-row"><label style="width:70px">Color:</label>
      <select id="pb-c">${['#000000', '#2B579A', '#C00000', '#538135', '#7030A0', '#BF9000'].map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="frm-row"><label style="width:70px">Width:</label>
      <input type="number" id="pb-w" min="1" max="9" step="0.5" value="2" style="width:70px"> <span class="frm-note">pt</span></div>`;
  if (state.pageBorder) setTimeout(() => {
    $('#pb-s', body).value = state.pageBorder.style;
    $('#pb-c', body).value = state.pageBorder.color;
    $('#pb-w', body).value = state.pageBorder.width;
  });
  W.dlg({
    title: 'Page Border', body, width: 360,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      state.pageBorder = { style: $('#pb-s', body).value, color: $('#pb-c', body).value, width: +$('#pb-w', body).value };
      renderPageBorder(); W.markDirty();
    } }],
  });
};

/* ============================ FONT / PARAGRAPH DIALOGS ============================ */
W.fontDialog = () => {
  W.restoreRange();
  const cs = (() => {
    const s = getSelection();
    let n = s.rangeCount ? s.anchorNode : null;
    if (!n) return null;
    let e = n.nodeType === 1 ? n : n.parentElement;
    return e ? getComputedStyle(e) : null;
  })() || {};
  const fam0 = (cs.fontFamily || 'Calibri').split(',')[0].replace(/["']/g, '').trim();
  const body = el('div');
  body.innerHTML = `
    <div class="frm-row"><label style="width:88px">Font:</label>
      <select id="fd-f" style="flex:1">${['Calibri', 'Calibri Light', 'Cambria', 'Georgia', 'Times New Roman', 'Arial', 'Arial Black', 'Book Antiqua', 'Comic Sans MS', 'Consolas', 'Courier New', 'Garamond', 'Impact', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Verdana'].map(f => `<option ${f === fam0 ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
    <div class="frm-row"><label style="width:88px">Font style:</label>
      <select id="fd-st" style="flex:1"><option>Regular</option><option>Italic</option><option>Bold</option><option>Bold Italic</option></select></div>
    <div class="frm-row"><label style="width:88px">Size:</label>
      <select id="fd-z" style="flex:1">${[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(z => `<option>${z}</option>`).join('')}</select></div>
    <div class="frm-row"><label style="width:88px">Font color:</label><input type="color" id="fd-c" value="#000000" style="width:60px;height:24px;border:1px solid #8A8886;padding:0"></div>
    <div class="frm-row"><label style="width:88px">Underline:</label>
      <select id="fd-u" style="flex:1"><option value="none">(none)</option><option value="single">Single</option><option value="double">Double</option><option value="dotted">Dotted</option><option value="wavy">Wavy</option></select></div>
    <fieldset class="frm-grp"><legend>Effects</legend><div class="frm-chks" style="display:grid;grid-template-columns:1fr 1fr">
      <label><input type="checkbox" id="fd-strike"> Strikethrough</label>
      <label><input type="checkbox" id="fd-sup"> Superscript</label>
      <label><input type="checkbox" id="fd-sub"> Subscript</label>
      <label><input type="checkbox" id="fd-sc"> Small caps</label>
      <label><input type="checkbox" id="fd-ac"> All caps</label>
    </div></fieldset>
    <div class="dlg-preview" id="fd-p">AaBbYyZz</div>`;
  const prefill = () => {
    const w = parseInt(cs.fontWeight) >= 600, i = (cs.fontStyle || '') === 'italic';
    $('#fd-st', body).value = (w && i) ? 'Bold Italic' : w ? 'Bold' : i ? 'Italic' : 'Regular';
    const pt = Math.round((parseFloat(cs.fontSize) || 14.667) / W.PT);
    const sel = $('#fd-z', body); if ([...sel.options].some(o => +o.value === pt)) sel.value = pt;
    const hx = rgb => {
      const m = (rgb || '').match(/rgba?\(([^)]+)\)/); if (!m) return '#000000';
      const p = m[1].split(',').map(x => +x);
      return '#' + p.slice(0, 3).map(v => ('0' + Math.round(v).toString(16)).slice(-2)).join('');
    };
    if (cs.color) $('#fd-c', body).value = hx(cs.color);
    $('#fd-strike', body).checked = (cs.textDecorationLine || '').includes('line-through');
    $('#fd-sup', body).checked = (cs.verticalAlign || '') === 'super';
    $('#fd-sub', body).checked = (cs.verticalAlign || '') === 'sub';
  };
  prefill();
  const preview = () => {
    const st = $('#fd-st', body).value, p = $('#fd-p', body);
    p.style.cssText = `font-family:'${$('#fd-f', body).value}';font-size:${Math.min(28, +$('#fd-z', body).value * 1.2)}px;` +
      `font-weight:${st.includes('Bold') ? 700 : 400};font-style:${st.includes('Italic') ? 'italic' : 'normal'};` +
      `color:${$('#fd-c', body).value};` +
      `text-decoration-line:${($('#fd-u', body).value !== 'none' ? 'underline ' : '') + ($('#fd-strike', body).checked ? 'line-through' : '') || 'none'};` +
      `text-decoration-style:${$('#fd-u', body).value === 'single' ? 'solid' : $('#fd-u', body).value};` +
      ($('#fd-sc', body).checked ? 'font-variant-caps:small-caps;' : '') +
      ($('#fd-ac', body).checked ? 'text-transform:uppercase;' : '');
  };
  body.addEventListener('input', preview);
  preview();
  W.dlg({
    title: 'Font', body, width: 430,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const st = $('#fd-st', body).value;
      const sup = $('#fd-sup', body).checked, sub = $('#fd-sub', body).checked;
      const styles = {
        'font-family': `'${$('#fd-f', body).value}',sans-serif`,
        'font-size': (+$('#fd-z', body).value * W.PT).toFixed(2) + 'px',
        'font-weight': st.includes('Bold') ? '700' : '400',
        'font-style': st.includes('Italic') ? 'italic' : 'normal',
        color: $('#fd-c', body).value,
        'text-decoration-line': (($('#fd-u', body).value !== 'none' ? 'underline ' : '') + ($('#fd-strike', body).checked ? 'line-through' : '')) || 'none',
        'text-decoration-style': $('#fd-u', body).value === 'single' || $('#fd-u', body).value === 'none' ? 'solid' : $('#fd-u', body).value,
        'font-variant-caps': $('#fd-sc', body).checked ? 'small-caps' : 'normal',
        'text-transform': $('#fd-ac', body).checked ? 'uppercase' : 'none',
      };
      if (sup) styles['vertical-align'] = 'super';
      else if (sub) styles['vertical-align'] = 'sub';
      if (sup || sub) styles['font-size'] = '0.66em';
      W.applyInline(styles);
    } }],
  });
};

W.paraDialog = () => {
  W.restoreRange();
  const b = W.anchorBlock();
  const cs = b ? getComputedStyle(b) : null;
  const px2in = x => Math.round((parseFloat(x) || 0) / 96 * 100) / 100;
  const px2pt = x => Math.round((parseFloat(x) || 0) / W.PT);
  const body = el('div');
  const ti = cs ? parseFloat(cs.textIndent) || 0 : 0;
  body.innerHTML = `
    <fieldset class="frm-grp"><legend>Indentation</legend>
      <div class="frm-row"><label style="width:52px">Left:</label><input type="number" id="pd-l" step="0.1" style="width:70px" value="${cs ? px2in(cs.marginLeft) : 0}"> <span class="frm-note">in</span>
        <label style="margin-left:14px;width:52px">Right:</label><input type="number" id="pd-r" step="0.1" style="width:70px" value="${cs ? px2in(cs.marginRight) : 0}"> <span class="frm-note">in</span></div>
      <div class="frm-row"><label style="width:52px">Special:</label>
        <select id="pd-sp" style="width:110px"><option value="none">(none)</option><option value="first">First line</option><option value="hang">Hanging</option></select>
        <label style="margin-left:14px">By:</label><input type="number" id="pd-by" step="0.05" style="width:60px" value="${ti ? Math.abs(px2in(ti)) : 0.25}"> <span class="frm-note">in</span></div>
    </fieldset>
    <fieldset class="frm-grp"><legend>Spacing</legend>
      <div class="frm-row"><label style="width:52px">Before:</label><input type="number" id="pd-b" step="6" style="width:70px" value="${cs ? px2pt(cs.marginTop) : 0}"> <span class="frm-note">pt</span>
        <label style="margin-left:14px;width:52px">After:</label><input type="number" id="pd-a" step="6" style="width:70px" value="${cs ? px2pt(cs.marginBottom) : 8}"> <span class="frm-note">pt</span></div>
      <div class="frm-row"><label style="width:80px">Line spacing:</label>
        <select id="pd-ls" style="width:110px"><option value="1">Single</option><option value="1.08">1.08</option><option value="1.15">1.15 lines</option><option value="1.5">1.5 lines</option><option value="2">Double</option><option value="2.5">2.5 lines</option><option value="3">3 lines</option></select></div>
    </fieldset>
    <div class="frm-row"><label style="width:80px">Alignment:</label>
      <select id="pd-al" style="width:110px"><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option><option value="justify">Justified</option></select></div>`;
  if (cs) {
    const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    const opts = [...$('#pd-ls', body).options].map(o => +o.value);
    const nearest = opts.reduce((a, b) => Math.abs(b - lh) < Math.abs(a - lh) ? b : a, opts[0]);
    $('#pd-ls', body).value = String(nearest);
    const al = cs.textAlign.replace('start', 'left').replace('end', 'right');
    $('#pd-al', body).value = ['justify', 'center', 'right'].includes(al) ? al : 'left';
    if (ti < 0) $('#pd-sp', body).value = 'hang'; else if (ti > 0) $('#pd-sp', body).value = 'first';
  }
  W.dlg({
    title: 'Paragraph', body, width: 420,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const sp = $('#pd-sp', body).value, by = +$('#pd-by', body).value;
      W.applyToBlocks(x => {
        x.style.marginLeft = (+$('#pd-l', body).value * 96) + 'px';
        x.style.marginRight = (+$('#pd-r', body).value * 96) + 'px';
        x.style.textIndent = sp === 'none' ? '0px' : (sp === 'hang' ? -by : by) * 96 + 'px';
        x.style.marginTop = (+$('#pd-b', body).value * W.PT).toFixed(1) + 'px';
        x.style.marginBottom = (+$('#pd-a', body).value * W.PT).toFixed(1) + 'px';
        x.style.lineHeight = $('#pd-ls', body).value;
        x.style.textAlign = $('#pd-al', body).value;
      });
    } }],
  });
};

W.pageSetupDialog = () => {
  const m = state.margins, ps = state.pageSize;
  const body = el('div');
  body.innerHTML = `
    <fieldset class="frm-grp"><legend>Margins (inches)</legend>
      <div class="frm-row">
        <label style="width:52px">Top:</label><input type="number" id="ps-t" step="0.1" style="width:64px" value="${(m.t / 96).toFixed(2)}">
        <label style="width:52px;margin-left:10px">Bottom:</label><input type="number" id="ps-b" step="0.1" style="width:64px" value="${(m.b / 96).toFixed(2)}"></div>
      <div class="frm-row">
        <label style="width:52px">Left:</label><input type="number" id="ps-l" step="0.1" style="width:64px" value="${(m.l / 96).toFixed(2)}">
        <label style="width:52px;margin-left:10px">Right:</label><input type="number" id="ps-r" step="0.1" style="width:64px" value="${(m.r / 96).toFixed(2)}"></div>
    </fieldset>
    <fieldset class="frm-grp"><legend>Paper</legend>
      <div class="frm-row"><label style="width:52px">Size:</label>
        <select id="ps-s">${Object.keys(SIZE_TABLE).map(k => `<option ${k === ps.name ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="frm-row frm-chks"><label><input type="radio" name="ps-o" ${ps.landscape ? '' : 'checked'} value="p"> Portrait</label>
        <label style="margin-left:14px"><input type="radio" name="ps-o" ${ps.landscape ? 'checked' : ''} value="l"> Landscape</label></div>
    </fieldset>`;
  W.dlg({
    title: 'Page Setup', body, width: 380,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      W.setMargins([+$('#ps-t', body).value, +$('#ps-r', body).value, +$('#ps-b', body).value, +$('#ps-l', body).value].map(v => Math.max(0.25, v) * 96));
      const land = body.querySelector('input[name=ps-o]:checked').value === 'l';
      if (state.pageSize.name !== $('#ps-s', body).value || state.pageSize.landscape !== land) {
        state.pageSize.landscape = land;
        W.setPageSize($('#ps-s', body).value);
      } else applyPageChrome();
    } }],
  });
};

W.numberDialog = (title, fields, cb) => {
  const body = el('div');
  body.innerHTML = fields.map(f => `<div class="frm-row"><label style="width:150px">${esc(f.label)}</label><input type="number" data-k="${f.k}" value="${f.val}" min="1" max="100" style="width:80px"></div>`).join('');
  W.dlg({
    title, body, width: 320,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const v = {};
      $$('input', body).forEach(i => v[i.dataset.k] = Math.max(1, +i.value || 1));
      cb(v);
    } }],
  });
};

W.zoomDialog = () => {
  const cur = Math.round(state.zoom * 100);
  const body = el('div');
  body.innerHTML = `
    <div class="frm-chks">
      <label><input type="radio" name="z" value="200" ${cur === 200 ? 'checked' : ''}> 200%</label>
      <label><input type="radio" name="z" value="100" ${cur === 100 ? 'checked' : ''}> 100%</label>
      <label><input type="radio" name="z" value="75" ${cur === 75 ? 'checked' : ''}> 75%</label>
      <label><input type="radio" name="z" value="width"> Page width</label>
      <label><input type="radio" name="z" value="custom"> Percent: <input type="number" id="z-c" value="${cur}" min="10" max="500" style="width:70px"></label>
    </div>`;
  W.dlg({
    title: 'Zoom', body, width: 260,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const v = body.querySelector('input[name=z]:checked').value;
      W.setZoom(v === 'width' ? 'width' : v === 'custom' ? (+$('#z-c', body).value || 100) / 100 : +v / 100);
    } }],
  });
};

W.symbolsDialog = () => {
  const CATS = {
    'Currency': ['$', '\u00A2', '\u00A3', '\u00A5', '\u20AC', '\u20B9', '\u20BD', '\u20A9'],
    'Math': ['\u00B1', '\u00D7', '\u00F7', '\u2260', '\u2264', '\u2265', '\u2212', '\u221E', '\u2248', '\u221A', '\u2211', '\u220F', '\u2202', '\u222B', '\u2030', '\u00B0'],
    'Arrows': ['\u2190', '\u2191', '\u2192', '\u2193', '\u2194', '\u2195', '\u21D0', '\u21D1', '\u21D2', '\u21D3', '\u21B5'],
    'Greek': ['\u03B1', '\u03B2', '\u03B3', '\u03B4', '\u03B5', '\u03B8', '\u03BB', '\u03BC', '\u03C0', '\u03C3', '\u03C6', '\u03C9', '\u0394', '\u03A3', '\u03A9', '\u03B8'],
    'Punctuation': ['\u2013', '\u2014', '\u2018', '\u2019', '\u201C', '\u201D', '\u2026', '\u2022', '\u00B7', '\u00AB', '\u00BB', '\u00A1', '\u00BF', '\u00A7', '\u00B6', '\u2020', '\u2021'],
    'Legal & Shapes': ['\u00A9', '\u00AE', '\u2122', '\u2117', '\u2103', '\u2109', '\u2713', '\u2714', '\u2717', '\u2605', '\u2606', '\u2660', '\u2663', '\u2665', '\u2666', '\u266A'],
    'Latin': ['\u00E0', '\u00E1', '\u00E2', '\u00E4', '\u00E5', '\u00E6', '\u00E7', '\u00E8', '\u00E9', '\u00EA', '\u00EB', '\u00ED', '\u00F1', '\u00F3', '\u00F6', '\u00F8', '\u00FA', '\u00FC', '\u00FF', '\u0153', '\u00C6', '\u00D1', '\u00D6', '\u00DC'],
  };
  const body = el('div');
  const grid = el('div', { class: 'sym-grid', style: 'grid-template-columns:repeat(8,30px)' });
  const sel = el('select', { style: 'width:100%;height:24px;margin-bottom:6px' }, Object.keys(CATS).map(k => `<option>${k}</option>`).join(''));
  const render = k => {
    grid.innerHTML = '';
    CATS[k].forEach(ch => {
      const c = el('div', { class: 'sym-c', style: 'width:30px;height:30px;font-size:16px' }, ch);
      c.addEventListener('mousedown', e => e.preventDefault());
      c.addEventListener('click', () => { $$('.sym-c.sel', grid).forEach(x => x.classList.remove('sel')); c.classList.add('sel'); grid._sel = ch; });
      c.addEventListener('dblclick', () => { W.exec('insertText', ch); });
      grid.appendChild(c);
    });
  };
  sel.addEventListener('change', () => render(sel.value));
  body.appendChild(sel); body.appendChild(grid);
  render(Object.keys(CATS)[0]);
  W.dlg({
    title: 'Symbol', body, width: 300,
    buttons: [{ label: 'Cancel' }, { label: 'Insert', pri: true, action: () => {
      if (grid._sel) W.exec('insertText', grid._sel); else return false;
    } }],
  });
};

W.linkDialog = (existing) => {
  W.saveRange();
  const s = getSelection();
  const selText = s.rangeCount ? s.getRangeAt(0).toString() : '';
  const body = el('div');
  body.innerHTML = `
    <div class="frm-row"><label style="width:96px">Text to display:</label><input type="text" id="lk-t" style="flex:1" value="${esc(existing ? existing.textContent : selText)}"></div>
    <div class="frm-row"><label style="width:96px">Address:</label><input type="text" id="lk-a" style="flex:1" placeholder="https://" value="${existing ? esc(existing.getAttribute('href') || '') : ''}"></div>
    <div class="frm-row"><label style="width:96px">ScreenTip:</label><input type="text" id="lk-tt" style="flex:1" placeholder="Shown on hover" value="${existing ? esc(existing.getAttribute('title') || '') : ''}"></div>`;
  W.dlg({
    title: existing ? 'Edit Hyperlink' : 'Insert Hyperlink', body, width: 430,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const addr = $('#lk-a', body).value.trim();
      if (!addr) return false;
      const txt = $('#lk-t', body).value || addr;
      const href = /^https?:|^mailto:|^#/.test(addr) ? addr : 'https://' + addr;
      const tt = $('#lk-tt', body).value.trim();
      if (existing) {
        existing.setAttribute('href', href);
        existing.setAttribute('title', tt);
        existing.textContent = txt;
        W.markDirty();
      } else {
        W.exec('insertHTML', `<a href="${esc(href)}" target="_blank" ${tt ? `title="${esc(tt)}"` : ''}>${esc(txt)}</a>`);
      }
    } }],
  });
};

W.bookmarkDialog = () => {
  const body = el('div');
  body.innerHTML = `<div class="frm-row"><label style="width:110px">Bookmark name:</label><input type="text" id="bm-n" style="flex:1" placeholder="Introduction"></div>`;
  W.dlg({
    title: 'Bookmark', body, width: 340,
    buttons: [{ label: 'Cancel' }, { label: 'Add', pri: true, action: () => {
      const n = $('#bm-n', body).value.trim().replace(/\s+/g, '_');
      if (!n) return false;
      W.exec('insertHTML', `<span data-bookmark="${esc(n)}" style="border-bottom:1px dashed #2B579A"></span>`);
      W.sbMsg('Bookmark "' + n + '" added');
    } }],
  });
};

W.dateTimeDialog = () => {
  const now = new Date();
  const fmts = [
    ['dddd, MMMM d, yyyy', now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
    ['MMMM d, yyyy', now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['d MMMM yyyy', now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['MMMM yyyy', now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })],
    ['M/d/yyyy', now.toLocaleDateString('en-US')],
    ['yyyy-MM-dd', now.toISOString().slice(0, 10)],
    ['d-MMM-yy', now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ /g, '-')],
    ['h:mm AM/PM', now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })],
    ['h:mm:ss AM/PM', now.toLocaleTimeString('en-US')],
    ['MMMM d, yyyy h:mm AM/PM', now.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })],
  ];
  const body = el('div');
  body.innerHTML = `<div class="dlg-list" style="max-height:220px">` +
    fmts.map((f, i) => `<div class="li${i === 1 ? ' sel' : ''}" data-i="${i}">${esc(f[1])}</div>`).join('') + `</div>`;
  $$('.li', body).forEach(li => li.addEventListener('click', () => {
    $$('.li', body).forEach(x => x.classList.remove('sel')); li.classList.add('sel');
  }));
  $$('.li', body).forEach(li => li.addEventListener('dblclick', () => { W.exec('insertText', fmts[+li.dataset.i][1]); }));
  W.dlg({
    title: 'Date and Time', body, width: 320,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const seli = $('.li.sel', body); if (!seli) return false;
      W.exec('insertText', fmts[+seli.dataset.i][1]);
    } }],
  });
};

W.captionDialog = (img) => {
  if (!img) {
    const s = getSelection();
    let n = s.rangeCount ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) : null;
    img = n && n.closest ? n.closest('img') : null;
    if (!img) { W.sbMsg('Select a picture or table first'); return; }
  }
  const body = el('div');
  body.innerHTML = `
    <div class="frm-row"><label style="width:80px">Caption:</label><input type="text" id="cp-t" style="flex:1" placeholder="Description"></div>
    <div class="frm-row"><label style="width:80px">Label:</label>
      <select id="cp-l"><option>Figure</option><option>Table</option><option>Equation</option></select></div>
    <div class="frm-row"><label style="width:80px">Position:</label>
      <select id="cp-p"><option value="below">Below selected item</option><option value="above">Above selected item</option></select></div>`;
  W.dlg({
    title: 'Caption', body, width: 420,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const lab = $('#cp-l', body).value, txt = $('#cp-t', body).value.trim();
      const n = $$('.pbody .fig-cap').filter(p => p.textContent.startsWith(lab)).length + 1;
      const host = img.closest('p') || img;
      const cap = el('p', { class: 'fig-cap' }, `${esc(lab)} ${n}${txt ? ': ' + esc(txt) : ''}`);
      if ($('#cp-p', body).value === 'below') host.after(cap); else host.before(cap);
      W.markDirty(); W.schedulePaginate();
    } }],
  });
};

W.imgSizeDialog = (img) => {
  const wIn = (img.getBoundingClientRect().width / state.zoom / 96);
  const body = el('div');
  body.innerHTML = `
    <div class="frm-row"><label style="width:90px">Width (in):</label><input type="number" id="is-w" step="0.1" min="0.2" style="width:80px" value="${wIn.toFixed(2)}"></div>
    <div class="frm-note">Height is adjusted automatically to preserve the aspect ratio.</div>`;
  W.dlg({
    title: 'Size', body, width: 300,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      img.style.width = Math.max(0.2, +$('#is-w', body).value) * 96 + 'px';
      img.style.height = 'auto';
      W.markDirty(); W.schedulePaginate();
    } }],
  });
};

W.wordCountDialog = () => {
  const s = W.docStats();
  const body = el('div');
  body.innerHTML = `<div class="bs-kv">
    <b>Pages</b><span>${s.pages}</span>
    <b>Words</b><span>${s.words}</span>
    <b>Characters (no spaces)</b><span>${s.chars}</span>
    <b>Characters (with spaces)</b><span>${s.charsSpaces}</span>
    <b>Paragraphs</b><span>${s.paras}</span>
    <b>Lines</b><span>${s.lines}</span></div>`;
  W.dlg({ title: 'Word Count', body, width: 330, buttons: [{ label: 'Close', pri: true }] });
};

W.goToPageDialog = () => {
  const body = el('div');
  body.innerHTML = `<div class="frm-row"><label style="width:110px">Enter page number:</label><input type="number" id="gp-n" min="1" max="${$$('.page').length}" value="1" style="width:80px"></div>`;
  W.dlg({
    title: 'Go To', body, width: 300,
    buttons: [{ label: 'Close' }, { label: 'Go To', pri: true, action: () => {
      const n = Math.min($$('.page').length, Math.max(1, +$('#gp-n', body).value));
      W.scrollToEl($$('.page')[n - 1]);
      return false ? undefined : undefined;
    } }],
  });
};

W.helpDialog = () => {
  const rows = [
    ['Ctrl+B / I / U', 'Bold, Italic, Underline'],
    ['Ctrl+S', 'Save document'],
    ['Ctrl+P', 'Print'],
    ['Ctrl+F / Ctrl+H', 'Find / Replace'],
    ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'],
    ['Ctrl+Enter', 'Insert page break'],
    ['Ctrl+L / E / R / J', 'Left, Center, Right, Justify'],
    ['Ctrl+F1', 'Collapse / expand the ribbon'],
    ['Alt+Q', 'Tell me what you want to do'],
    ['F1', 'This help window'],
    ['Ctrl+Mouse wheel', 'Zoom in and out'],
    ['Tab in a table', 'Move to next cell (adds a row at the end)'],
    ['Double-click page margin', 'Edit header or footer'],
    ['Esc', 'Close menus, exit Read Mode'],
  ];
  const body = el('div');
  body.innerHTML = `<table class="hlp-table">${rows.map(r => `<tr><td><span class="kbd">${r[0]}</span></td><td>${r[1]}</td></tr>`).join('')}</table>`;
  W.dlg({ title: 'Word Help', body, width: 460, buttons: [{ label: 'OK', pri: true }] });
};

W.feedbackDialog = () => {
  const body = el('div');
  body.innerHTML = `
    <div class="frm-note" style="margin-bottom:6px">Tell us what you like, or what we could do better.</div>
    <textarea id="fb-t" rows="6" style="width:100%;border:1px solid #8A8886;border-radius:2px;padding:8px;font-size:12.5px;resize:vertical"></textarea>`;
  W.dlg({
    title: 'Feedback to Microsoft', body, width: 420,
    buttons: [{ label: 'Cancel' }, { label: 'Submit', pri: true, action: () => {
      const t = $('#fb-t', body).value.trim();
      const all = JSON.parse(XKV.get('wc.feedback') || '[]');
      if (t) all.push({ at: Date.now(), text: t });
      XKV.set('wc.feedback', JSON.stringify(all));
      W.sbMsg('Thanks for your feedback');
    } }],
  });
};

W.aboutDialog = () => {
  const body = el('div');
  body.innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:14px">
      <svg viewBox="0 0 32 32" width="52" height="52"><rect x="1" y="1" width="30" height="30" rx="5" fill="#2B579A"/><path d="M8.4 9h2.8l2.4 10.6 2.7-10.6h2.3l2.7 10.6L23.5 9h2.8L22.6 23.4h-2.8L17 12.6l-2.8 10.8h-2.8z" fill="#fff"/></svg>
      <div><div style="font-size:19px;font-weight:600">Microsoft Word</div>
      <div style="color:#605E5C;font-size:12.5px">Version 1.0 (Web Edition)</div></div>
    </div>
    <div class="frm-note">A pixel-faithful recreation of the Word editing experience, built entirely with HTML, CSS and JavaScript. Documents can be exported as genuine .docx files that open in Microsoft Word.</div>
    <div class="frm-note" style="margin-top:8px">&copy; 2026 Word Web Edition. Educational project.</div>`;
  W.dlg({ title: 'About Microsoft Word', body, width: 440, buttons: [{ label: 'OK', pri: true }] });
};

W.optionsDialog = () => {
  const body = el('div');
  body.innerHTML = `
    <fieldset class="frm-grp"><legend>General</legend><div class="frm-chks">
      <label><input type="checkbox" id="op-para" ${state.showPara ? 'checked' : ''}> Show paragraph marks and formatting symbols</label>
      <label><input type="checkbox" id="op-ruler" ${state.ruler ? 'checked' : ''}> Show vertical and horizontal rulers</label>
      <label><input type="checkbox" id="op-spell" ${state.spell ? 'checked' : ''}> Check spelling as you type</label>
      <label><input type="checkbox" id="op-auto" ${state.autosave ? 'checked' : ''}> AutoSave: save my document automatically</label>
    </div></fieldset>
    <fieldset class="frm-grp"><legend>Office Theme</legend>
      <div class="frm-row"><select id="op-theme" style="width:160px">
        <option value="colorful" ${state.theme === 'colorful' ? 'selected' : ''}>Colorful</option>
        <option value="silver" ${state.theme === 'silver' ? 'selected' : ''}>Silver</option>
        <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Dark Gray</option>
      </select></div>
    </fieldset>`;
  W.dlg({
    title: 'Word Options', body, width: 440,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      state.showPara = $('#op-para', body).checked;
      $('#pages').classList.toggle('showPara', state.showPara);
      state.ruler = $('#op-ruler', body).checked; W.drawRulers();
      state.spell = $('#op-spell', body).checked; $('#pages').spellcheck = state.spell;
      state.autosave = $('#op-auto', body).checked;
      $('#as-pill').classList.toggle('on', state.autosave);
      state.theme = $('#op-theme', body).value;
      W.applyChromeTheme();
      W.saveOpts(); W.refreshStates();
    } }],
  });
};

/* ============================ TELL ME ============================ */
W.tellMe = (anchor) => {
  const cmds = [
    ['Bold', 'bold', 'bold'], ['Italic', 'italic', 'italic'], ['Underline', 'under', 'under'],
    ['Insert Table', 'table', 'table'], ['Insert Picture', 'picture', 'pictures'], ['Insert Page Break', 'pagebreak', 'pagebreak'],
    ['Find', 'search', 'find'], ['Replace', 'replace', 'findreplace'], ['Word Count', 'wordcount', 'wordcount'],
    ['Zoom', 'zoom', 'zoomdlg'], ['Save', 'save', 'save'], ['Print', 'print', '__print'],
    ['New Comment', 'comment', 'newcomment'], ['Insert Footnote', 'footnote', 'footnote'],
    ['Table of Contents', 'toc', 'toc'], ['Hyperlink', 'link', 'link'], ['Symbol', 'symbol', 'symbol'],
    ['Watermark', 'watermark', 'watermark'], ['Page Color', 'pagecolor', '__pc'], ['Margins', 'margins', 'margins'],
    ['Line Spacing', 'linesp', 'linesp'], ['Clear Formatting', 'clearfmt', 'clearfmt'],
    ['Show Paragraph Marks', 'pilcrow', 'pilcrow'], ['Strikethrough', 'strike', 'strike'],
    ['Superscript', 'sup', 'sup'], ['Subscript', 'sub', 'sub'], ['Highlight Color', 'marker', 'highlight'],
    ['Font Color', 'achar', 'fontcolor'], ['Sort', 'sort', 'sort'], ['Header', 'header', 'header'], ['Footer', 'footer', 'footer'],
    ['Page Number', 'pageno', 'pageno'], ['Date and Time', 'datetime', 'datetime'], ['Text Box', 'textbox', 'textbox'],
    ['Heading 1', 'fonts', '__h1'], ['Read Mode', 'readmode', 'vread'], ['Web Layout', 'weblayout', 'vweb'], ['Spelling', 'spelling', 'spelling'],
  ];
  const wrap = el('div', { style: 'width:300px' });
  const inp = el('input', { type: 'text', placeholder: 'Type a command...', style: 'width:100%;height:28px;border:0;border-bottom:1px solid #E4E2E1;outline:none;padding:0 10px;font-size:12.5px' });
  const list = el('div', { class: 'menu', style: 'max-height:280px;overflow:auto' });
  wrap.appendChild(inp); wrap.appendChild(list);
  const render = q => {
    list.innerHTML = '';
    const qq = (q || '').toLowerCase();
    cmds.filter(c => !qq || c[0].toLowerCase().includes(qq)).slice(0, 9).forEach((c, i) => {
      const it = el('div', { class: 'mi' + (i === 0 ? ' sel' : '') });
      it.innerHTML = svgIcon(c[1]) + `<span>${c[0]}</span>`;
      it.addEventListener('click', () => { run(c); });
      list.appendChild(it);
    });
    if (!list.children.length) list.innerHTML = '<div class="np-count" style="padding:8px 12px">No matching commands</div>';
  };
  const run = c => {
    W.closeAllPops();
    if (c[2] === '__print') W.print();
    else if (c[2] === '__pc') MENU_OPEN_PAGE_COLOR();
    else if (c[2] === '__h1') W.setBlockStyle('h1');
    else CMDS[c[2]].exec();
  };
  function MENU_OPEN_PAGE_COLOR() {
    W.pop($('#tb-title'), W.palette({ noColor: true, onPick: c => CMDS.pagecolor.exec(null, null, c) }));
  }
  inp.addEventListener('input', () => render(inp.value));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = list.querySelector('.mi'); if (first) first.click(); }
    e.stopPropagation();
  });
  render('');
  W.pop(anchor, wrap);
  setTimeout(() => inp.focus(), 30);
};

/* ============================ SAVE / OPEN / NEW / LIBRARY ============================ */
function collectDoc() {
  return {
    name: state.docName, savedAt: Date.now(),
    html: $('#pages').innerHTML,
    margins: state.margins, pageSize: state.pageSize,
    hf: state.hf, wm: state.wm, pageBorder: state.pageBorder,
    colors: state.colors, themeName: state.themeName,
    pagesVars: $('#pages').getAttribute('style') || '',
    comments: state.comments,
    fnModel: state.fnModel,
    ink: state.ink.strokes,
  };
}
function applyDoc(d, opts) {
  opts = opts || {};
  state.docName = d.name || 'Document1';
  if (opts.newId !== false) state.docId = d.id || state.docId || null;
  if (d.html != null) $('#pages').innerHTML = d.html;
  if (d.margins) state.margins = d.margins;
  if (d.pageSize) state.pageSize = d.pageSize;
  if (d.hf) state.hf = d.hf;
  state.wm = d.wm || null;
  state.pageBorder = d.pageBorder || null;
  if (d.colors) Object.assign(state.colors, d.colors);
  state.comments = d.comments || {};
  state.fnModel = d.fnModel || {};
  state.ink.strokes = d.ink || [];
  const pagesEl = $('#pages');
  if (d.pagesVars) pagesEl.setAttribute('style', d.pagesVars);
  W.ensurePageStructure();
  applyPageChrome();
  W.renderHF(); renderWM(); renderPageBorder();
  W.cmRender && W.cmRender();
  W.inkRender && W.inkRender();
  W.updateTitleState();
  state.dirty = false;
  W.paginate(); W.updateCounts();
}
W.saveDoc = (silent, skipReg) => {
  const doc = collectDoc();
  if (!state.docId) state.docId = 'd' + Date.now().toString(36);
  doc.id = state.docId;
  XKV.set('wc.session', JSON.stringify(doc));
  if (!skipReg) {
    const reg = JSON.parse(XKV.get('wc.docs') || '{}');
    reg[state.docId] = doc;
    XKV.set('wc.docs', JSON.stringify(reg));
  }
  state.dirty = false;
  if (!silent) W.sbMsg('Document saved');
};
function restoreSession() {
  try {
    const ses = JSON.parse(XKV.get('wc.session') || 'null');
    if (ses && ses.html) {
      applyDoc(ses, { newId: true });
      if (ses.id) state.docId = ses.id;
      return true;
    }
  } catch (e) { console.warn(e); }
  return false;
}

function downloadBlob(name, blob) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
W.downloadBlob = downloadBlob;

function exportDocx() {
  const data = window.Docx.exportDocx($('#pages'), state.docName, {
    pageSize: state.pageSize, margins: state.margins, hf: state.hf, wm: state.wm,
    pageBorder: state.pageBorder, pageColor: state.colors.pagecolor,
  });
  W.downloadBlob(state.docName + '.docx', new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  W.sbMsg('Saved as ' + state.docName + '.docx');
}
function exportTxt() {
  W.downloadBlob(state.docName + '.txt', new Blob([W.docStats ? pageTextForExport() : ''], { type: 'text/plain' }));
}
function pageTextForExport() {
  const clone = $('#pages').cloneNode(true);
  $$('.wm,.fns,.pborder,.phdr,.pftr', clone).forEach(n => n.remove());
  let out = '';
  $$('.pbody > *', clone).forEach(b => {
    if (b.classList.contains('pbreak')) { out += '\n'; return; }
    out += b.innerText.replace(/¶/g, '') + '\n';
  });
  return out;
}
function exportHtml() {
  /* Same-as-view export: instead of a hand-written CSS subset that drifts out of
     sync, we lift the app's own live stylesheet rules that can match inside
     .pages, so the file always looks like the editor (pages, cards, headings,
     watermarks, headers/footers, footnotes, ink — everything the user sees). */
  const clone = $('#pages').cloneNode(true);
  clone.removeAttribute('contenteditable'); clone.removeAttribute('style');
  $$('[contenteditable]', clone).forEach(n => n.removeAttribute('contenteditable'));
  $$('[spellcheck]', clone).forEach(n => n.removeAttribute('spellcheck'));
  // strip editing-only artifacts; keep everything visible (wm, phdr/pftr, fns, pborder, ink)
  $$('.img-handles,.img-sel,.cm-anchor,.caret,#csel,.lasso,.edit-hint,.ph-txt', clone).forEach(n => n.remove());
  let css = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of Array.from(rules)) {
        if (!r.selectorText) continue;
        if (/(^|[\s,+>~.])(\.pages|\.page\b|\.pbody|\.pb-para|\.sty-|\.wm|\.fns|\.phdr|\.pftr|\.pborder|\.pbreak|\.hf-band|\.toc|\.cmt|\.ink-layer|\.footnote)/.test(r.selectorText)) css += r.cssText + '\n';
      }
    }
  } catch (e) { }
  const ps = state.pageSize;
  const wIn = ps.wIn || (ps.w / 96), hIn = ps.hIn || (ps.h / 96);
  const pw = ps.landscape ? hIn : wIn, ph = ps.landscape ? wIn : hIn;
  css += `
html,body{margin:0;padding:0;background:#E8E8E8;}
body{font-family:Calibri,Carlito,'Segoe UI',sans-serif;}
.pages{padding:28px 0 40px;}
.pages>.page{margin-left:auto;margin-right:auto;}
.pages>.page+.page{margin-top:18px;}
@page{ size:${pw}in ${ph}in; margin:0; }
@media print{ body{background:#fff;} .pages{padding:0;}
.pages>.page{box-shadow:none;margin:0 !important;overflow:hidden;break-inside:avoid;page-break-inside:avoid;}
.pages>.page+.page{margin-top:0;}
.pages>.page:not(:last-child){break-after:page;page-break-after:always;} }`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.docName)}</title><style>${css}</style></head><body><div class="pages" id="pages">${clone.innerHTML}</div></body></html>`;
  W.downloadBlob(state.docName + '.html', new Blob([html], { type: 'text/html' }));
}

W.pickImage = () => {
  const inp = el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
  document.body.appendChild(inp);
  inp.addEventListener('change', () => {
    Array.from(inp.files).forEach(f => {
      const rd = new FileReader();
      rd.onload = () => W.exec('insertHTML', `<img src="${rd.result}" style="max-width:100%"><p></p>`);
      rd.readAsDataURL(f);
    });
    inp.remove();
  });
  inp.click();
};
W.insertTextFromFile = () => {
  const inp = el('input', { type: 'file', accept: '.txt,.md,.text', style: 'display:none' });
  document.body.appendChild(inp);
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => W.insertPlainText(rd.result);
    rd.readAsText(f);
    inp.remove();
  });
  inp.click();
};

/* ============================ IMPORT (OPEN .docx/.doc) ============================ */
function applyImported(res, name) {
  applyDoc({
    name, html: '<div class="page">' + pageShell(res.html) + '</div>',
    margins: res.margins || undefined, pageSize: res.pageSize || undefined,
    hf: res.hf, fnModel: res.fnModel || {}, comments: {},
  }, { newId: false });
  state.docId = null;
  if (res.pageColor) CMDS.pagecolor.exec(null, null, res.pageColor);
  else state.colors.pagecolor = '';
  if (res.pageBorder) { state.pageBorder = res.pageBorder; renderPageBorder(); }
  if (res.wm) { state.wm = res.wm; renderWM(); }
  W.paginate(); W.updateCounts();
  if (res.warnings && res.warnings.length) {
    W.dlg({
      title: 'Opened with notes', width: 420,
      body: el('div', null, `<p style="margin:0 0 6px">${esc(name)} was opened:</p><ul style="margin:0;padding-left:18px">${res.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`),
      buttons: [{ label: 'OK', pri: true }],
    });
  }
  W.sbMsg('Opened ' + name);
}

/* Confirm before replacing a dirty document, then import. */
function withDirtyConfirm(name, go) {
  if (!state.dirty) { go(); return; }
  const body = el('div', null, `<p style="margin:0">Opening <b>${esc(name)}</b> replaces the current document, which has unsaved changes. Open anyway?</p>`);
  W.dlg({
    title: 'Open file', body, width: 380,
    buttons: [{ label: 'Cancel' }, { label: 'Open', pri: true, action: go }],
  });
}

async function importBuffer(buf, name) {
  const res = await window.DocxImport.importBuffer(buf, name);
  withDirtyConfirm(name, () => { W.closeBackstage(); applyImported(res, name); });
  return res;
}
W.importBuffer = importBuffer;

async function importFileObject(file) {
  const buf = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, '');
  try { await importBuffer(buf, name); }
  catch (e) {
    console.error(e);
    W.dlg({
      title: 'Cannot open file', width: 380,
      body: el('div', null, `<p style="margin:0">${esc(file.name)} could not be opened:</p><p class="frm-note" style="margin:8px 0 0">${esc(e.message || String(e))}</p>`),
      buttons: [{ label: 'OK', pri: true }],
    });
  }
  return true;
}
W.importFileObject = importFileObject;

/* unified routing used by File > Open, drag & drop, and the test trackers */
W.openFilePrompt = () => {
  const inp = el('input', { type: 'file', accept: '.docx,.doc,.rtf,.txt,.md,.html,.htm', style: 'display:none' });
  document.body.appendChild(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; inp.remove();
    if (!f) return;
    if (/\.(docx|doc|rtf)$/i.test(f.name)) { await importFileObject(f); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const base = f.name.replace(/\.[^.]+$/, '');
      if (/\.html?$/i.test(f.name)) {
        const tmp = el('div', { style: 'display:none' });
        document.body.appendChild(tmp);
        tmp.innerHTML = rd.result;
        $$('script,style,title,meta,link,head', tmp).forEach(n => n.remove());
        const bodyHtml = tmp.querySelector('body') ? tmp.querySelector('body').innerHTML : tmp.innerHTML;
        tmp.remove();
        withDirtyConfirm(base, () => { applyDoc({ name: base, html: '<div class="page">' + pageShell(bodyHtml) + '</div>' }, { newId: false }); state.docId = null; W.closeBackstage(); });
      } else {
        withDirtyConfirm(base, () => {
          const paras = String(rd.result).replace(/\r\n?/g, '\n').split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join('');
          applyDoc({ name: base, html: '<div class="page">' + pageShell(paras) + '</div>' }, { newId: false });
          state.docId = null; W.closeBackstage();
        });
      }
    };
    rd.readAsText(f);
  });
  inp.click();
};

/* ============================ DRAG & DROP ============================ */
function bindDragDrop() {
  const veil = el('div', { class: 'drop-veil' });
  veil.innerHTML = `<div class="drop-card">${svgIcon('newdoc', 'ico-32')}<b>Drop to open</b><span>.docx, .doc, .rtf — or drop pictures / text / HTML to insert</span></div>`;
  document.body.appendChild(veil);
  let dragDepth = 0;
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; veil.classList.add('on'); });
  window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; veil.classList.remove('on'); } });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;   // native text drop inside the editor keeps working
    e.preventDefault();
    dragDepth = 0; veil.classList.remove('on');
    const files = Array.from(e.dataTransfer.files || []);
    const docs = files.filter(f => /\.(docx|doc|rtf)$/i.test(f.name));
    const imgs = files.filter(f => /^image\//.test(f.type));
    const texts = files.filter(f => /\.(txt|md|text)$/i.test(f.name));
    const htmls = files.filter(f => /\.html?$/i.test(f.name));
    if (docs.length) { importFileObject(docs[0]); return; }
    // position caret at the drop point for inserts
    let placed = false;
    const pages = $('#pages');
    if (pages && e.target instanceof Node && pages.contains(e.target)) {
      const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
      if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); placed = true; }
    }
    if (!placed) {
      const b = $('#pages .page .pbody');
      if (b) {
        const r = document.createRange(); r.selectNodeContents(b); r.collapse(false);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        pages.focus();
      }
    }
    imgs.forEach((f, i) => {
      const rd = new FileReader();
      rd.onload = () => W.exec('insertHTML', `<img src="${rd.result}" style="max-width:100%">${i === imgs.length - 1 ? '<p></p>' : ''}`);
      rd.readAsDataURL(f);
    });
    if (texts.length) {
      const rd = new FileReader();
      rd.onload = () => W.insertPlainText(rd.result);
      rd.readAsText(texts[0]);
    }
    if (htmls.length && !imgs.length) {
      const rd = new FileReader();
      rd.onload = () => {
        const tmp = el('div', { style: 'display:none' }); document.body.appendChild(tmp);
        tmp.innerHTML = rd.result;
        $$('script,style,title,meta,link,head', tmp).forEach(n => n.remove());
        W.exec('insertHTML', tmp.querySelector('body') ? tmp.querySelector('body').innerHTML : tmp.innerHTML);
        tmp.remove();
      };
      rd.readAsText(htmls[0]);
    }
  });
}

/* ============================ PRINT ============================ */
/* The page model is fixed-size: browser defaults (paper size + margins) used to
   squeeze 8.5in-wide pages onto smaller printable areas and spill onto extra
   sheets. We inject a dynamic @page rule that matches the document exactly. */
function ensurePrintStyle() {
  let st = document.getElementById('print-page-setup');
  if (!st) { st = el('style', { id: 'print-page-setup' }); document.head.appendChild(st); }
  const ps = state.pageSize;
  const wIn = ps.wIn || (ps.w / 96), hIn = ps.hIn || (ps.h / 96);
  const w = ps.landscape ? hIn : wIn, h = ps.landscape ? wIn : hIn;
  st.textContent = `@page{ size:${w}in ${h}in; margin:0; }`;
}
W.print = () => { ensurePrintStyle(); window.print(); };
window.addEventListener('beforeprint', ensurePrintStyle);

/* ============================ BACKSTAGE ============================ */
let bs = null;
W.openBackstage = (section) => {
  if (!bs) buildBackstage();
  bs.classList.add('open');
  showSection(section || 'home');
};
W.closeBackstage = () => { if (bs) bs.classList.remove('open'); };

const BS_SECTIONS = [
  ['home', 'Home'], ['new', 'New'], ['open', 'Open'], ['info', 'Info'],
  ['save', 'Save'], ['saveas', 'Save As'], ['print', 'Print'], ['share', 'Share'], ['export', 'Export'], ['close', 'Close'],
];

function buildBackstage() {
  bs = el('div', { class: 'backstage' });
  const rail = el('div', { class: 'bs-rail' });
  rail.innerHTML = `<button class="bs-back" title="Back">${svgIcon('back')}</button>`;
  $('.bs-back', rail).addEventListener('click', W.closeBackstage);
  BS_SECTIONS.forEach(([id, label]) => {
    const it = el('button', { class: 'bs-it', 'data-sec': id }, esc(label));
    it.addEventListener('click', () => {
      if (id === 'save') { W.saveDoc(); W.closeBackstage(); return; }
      if (id === 'close') { W.closeBackstage(); return; }
      showSection(id);
    });
    rail.appendChild(it);
  });
  rail.appendChild(el('div', { class: 'bs-sp' }));
  const acct = el('button', { class: 'bs-it', 'data-sec': 'account' }, 'Account');
  acct.addEventListener('click', () => showSection('account'));
  rail.appendChild(acct);
  const optsB = el('button', { class: 'bs-it', 'data-sec': 'options' }, 'Options');
  optsB.addEventListener('click', () => { W.closeBackstage(); W.optionsDialog(); });
  rail.appendChild(optsB);
  rail.appendChild(el('div', { class: 'bs-info' }, 'Word Web Edition'));
  const main = el('div', { class: 'bs-main' });
  bs.appendChild(rail); bs.appendChild(main);
  document.body.appendChild(bs);
}
function showSection(id) {
  $$('.bs-it', bs).forEach(x => x.classList.toggle('act', x.dataset.sec === id));
  const main = $('.bs-main', bs);
  main.innerHTML = '';
  const sec = el('div', { class: 'bs-sec' });
  main.appendChild(sec);
  ({ home: bsHome, new: bsNew, open: bsOpen, info: bsInfo2, saveas: bsSaveAs, print: bsPrint, share: bsShare, export: bsExport, account: bsAccount })[id](sec);
}

function recentDocs() {
  const reg = JSON.parse(XKV.get('wc.docs') || '{}');
  return Object.values(reg).sort((a, b) => b.savedAt - a.savedAt);
}
function docRow(d, sec) {
  const row = el('div', { class: 'doc-row' });
  row.innerHTML = `<svg class="d-ic" viewBox="0 0 30 38"><rect x="1" y="1" width="22" height="28" rx="2" fill="#fff" stroke="#2B579A"/><path d="M9 26 15 6l5 20" transform="scale(.6)" stroke="#2B579A" stroke-width="2.4" fill="none" style="transform-origin:center"/><rect x="4" y="20" width="22" height="16" rx="3" fill="#2B579A"/><text x="15" y="31.5" fill="#fff" font-size="9" text-anchor="middle" font-family="Segoe UI" font-weight="600">W</text></svg>
    <div style="flex:1;min-width:0"><b>${esc(d.name)}</b><small>${new Date(d.savedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} &middot; Word Web</small></div>
    <button class="btn" style="min-width:64px">Open</button>`;
  $('button', row).addEventListener('click', ev => { ev.stopPropagation(); openStored(d.id); });
  row.addEventListener('click', () => openStored(d.id));
  row.title = d.name;
  return row;
}
function openStored(id) {
  const reg = JSON.parse(XKV.get('wc.docs') || '{}');
  if (reg[id]) { applyDoc(reg[id], { newId: true }); state.docId = id; W.closeBackstage(); W.sbMsg('Opened ' + reg[id].name); }
}

function bsHome(sec) {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  sec.innerHTML = `<h1>${greet}</h1><h2>Recent</h2><div id="bs-recent"></div><h2>New from template</h2>`;
  const rec = $('#bs-recent', sec);
  const docs = recentDocs().slice(0, 6);
  if (!docs.length) rec.innerHTML = '<div class="frm-note" style="padding:8px 0 16px">You have not saved any documents yet. Press Ctrl+S to save the current one.</div>';
  docs.forEach(d => rec.appendChild(docRow(d)));
  const row = el('div', { class: 'tmpl-row' });
  TEMPLATES.forEach(t => row.appendChild(tmplCard(t)));
  sec.appendChild(row);
}
function tmplCard(t) {
  const c = el('button', { class: 'tmpl-card' });
  const thumb = el('div', { class: 'tmpl-thumb' });
  const inner = el('div', { class: 'tt-in' });
  if (t.id === 'blank') inner.innerHTML = '<div style="width:60%;height:10px;background:#D6D6D6;margin:40px auto 0"></div>';
  else if (t.id === 'notes') inner.innerHTML = '<div style="width:70%;height:9px;background:#2B579A;margin-bottom:8px"></div><div style="width:95%;height:5px;background:#C8C6C4;margin:5px 0"></div><div style="width:90%;height:5px;background:#C8C6C4;margin:5px 0"></div><div style="width:60%;height:5px;background:#C8C6C4;margin:5px 0"></div><div style="width:100%;height:48px;border:1px solid #C8C6C4;margin-top:10px"></div>';
  else if (t.id === 'report') inner.innerHTML = '<div style="width:80%;height:13px;background:#444;margin-bottom:6px"></div><div style="width:55%;height:6px;font-style:italic;background:#A6A6A6;margin-bottom:10px"></div><div style="width:40%;height:8px;background:#2B579A;margin:8px 0 6px"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:3px"><div style="height:14px;border:1px solid #8A8886"></div><div style="height:14px;border:1px solid #8A8886"></div><div style="height:14px;border:1px solid #8A8886"></div><div style="height:14px;border:1px solid #8A8886"></div></div>';
  else inner.innerHTML = '<div style="width:55%;height:11px;background:#444;margin-bottom:4px"></div><div style="width:90%;height:4px;background:#C8C6C4;margin:4px 0"></div><div style="width:100%;height:6px;background:#2E74B5;margin:10px 0 5px;border-bottom:1px solid #8A8886"></div><div style="width:100%;height:4px;background:#C8C6C4;margin:5px 0"></div><div style="width:88%;height:4px;background:#C8C6C4;margin:5px 0"></div><div style="width:92%;height:4px;background:#C8C6C4;margin:5px 0"></div>';
  thumb.appendChild(inner);
  c.appendChild(thumb);
  c.appendChild(el('div', { class: 'tmpl-cap' }, `${esc(t.name)}<small>${esc(t.sub)}</small>`));
  c.addEventListener('click', () => loadTemplate(t));
  return c;
}
function loadTemplate(t) {
  // templates that don't specify page setup fall back to the Normal-template
  // defaults (Letter, 1in margins) instead of leaking the previous document's setup
  applyDoc({
    name: t.id === 'blank' ? nextUntitledName() : t.name,
    html: `<div class="page">` + pageShell(t.html) + `</div>`,
    margins: t.margins || { t: 96, r: 96, b: 96, l: 96 },
    pageSize: t.pageSize || { w: 816, h: 1056, name: 'Letter' },
    hf: t.hf || { header: '', footer: '' },
  }, { newId: false });
  state.colors.pagecolor = t.pageColor || '';
  state.docId = null;
  W.closeBackstage();
  setTimeout(() => { $('#pages').focus(); }, 50);
}
function pageShell(innerHtml) {
  return `<div class="wm"></div><div class="pborder" hidden></div><div class="phdr" contenteditable="false"></div><div class="pbody">${innerHtml}</div><div class="pftr" contenteditable="false"></div><div class="fns"></div>`;
}
function nextUntitledName() {
  let i = 1;
  const names = recentDocs().map(d => d.name).concat([state.docName]);
  while (names.includes('Document' + i)) i++;
  return 'Document' + i;
}

function bsNew(sec) {
  sec.innerHTML = `<h1>New</h1>
    <input class="bs-search" placeholder="Search for online templates" id="bs-nsearch">
    <h2>Featured</h2><div class="tmpl-row" id="bs-trow"></div>`;
  TEMPLATES.forEach(t => $('#bs-trow', sec).appendChild(tmplCard(t)));
  const q = $('#bs-nsearch', sec);
  q.addEventListener('input', () => {
    const v = q.value.toLowerCase();
    $$('.tmpl-card', sec).forEach(c => c.style.display = !v || c.textContent.toLowerCase().includes(v) ? '' : 'none');
  });
  q.addEventListener('keydown', e => e.stopPropagation());
}

function bsOpen(sec) {
  sec.innerHTML = `<h1>Open</h1><h2>Recent</h2><div id="bs-recent2"></div>
    <h2>This PC</h2>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn big" id="bs-browse">${svgIcon('folder')} Browse...</button>
    </div>
    <div class="frm-note" style="margin-top:10px">Supported: Word documents <b>.docx</b> and <b>.doc</b>, <b>.rtf</b>, web pages <b>.html</b>, and text <b>.txt/.md</b>. Tip: you can also drag &amp; drop files anywhere onto the editor.</div>`;
  const rec = $('#bs-recent2', sec);
  const docs = recentDocs();
  if (!docs.length) rec.innerHTML = '<div class="frm-note" style="padding:6px 0">No recent documents.</div>';
  docs.forEach(d => rec.appendChild(docRow(d)));
  $('#bs-browse', sec).addEventListener('click', () => W.openFilePrompt());
}

function bsInfo2(sec) {
  const s = W.docStats();
  const ses = JSON.parse(XKV.get('wc.session') || '{}');
  sec.innerHTML = `<h1>Info</h1>
    <div class="bs-info-grid">
      <div style="flex:1">
        <h2 style="margin-top:0">Properties</h2>
        <div class="bs-kv">
          <b>File name</b><span>${esc(state.docName)}</span>
          <b>Location</b><span>This PC &gt; Documents (browser storage)</span>
          <b>Pages</b><span>${s.pages}</span>
          <b>Words</b><span>${s.words}</span>
          <b>Characters</b><span>${s.charsSpaces}</span>
          <b>Last modified</b><span>${ses.savedAt ? new Date(ses.savedAt).toLocaleString() : 'Not saved yet'}</span>
        </div>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn big" id="bs-rename">Rename...</button>
      <button class="btn big" id="bs-version">Version History</button>
      <button class="btn big" id="bs-protect" disabled title="Requires OneDrive">Protect Document</button>
    </div>`;
  $('#bs-rename', sec).addEventListener('click', () => renameDialog());
  $('#bs-version', sec).addEventListener('click', () => versionList(sec));
}
function renameDialog() {
  const body = el('div');
  body.innerHTML = `<div class="frm-row"><label style="width:70px">File name:</label><input type="text" id="rn-n" style="flex:1" value="${esc(state.docName)}"></div>`;
  W.dlg({
    title: 'Rename', body, width: 380,
    buttons: [{ label: 'Cancel' }, { label: 'OK', pri: true, action: () => {
      const v = $('#rn-n', body).value.trim();
      if (!v) return false;
      state.docName = v; W.updateTitleState(); W.saveDoc(true); W.sbMsg('Renamed to ' + v);
    } }],
  });
}
function versionList(sec) {
  const hist = JSON.parse(XKV.get('wc.hist') || '[]').filter(h => h.id === state.docId).slice(-12).reverse();
  const body = el('div');
  body.innerHTML = hist.length ? '' : '<div class="frm-note">No previous versions. Versions are kept every time you save.</div>';
  const list = el('div', { class: 'dlg-list' });
  hist.forEach(h => {
    const it = el('div', { class: 'li' }, `${new Date(h.at).toLocaleString()} - ${esc(h.name)}`);
    it.addEventListener('click', () => { applyDoc(h.doc, { newId: false }); W.sbMsg('Previous version restored'); });
    list.appendChild(it);
  });
  body.appendChild(list);
  W.dlg({ title: 'Version History', body, width: 420, buttons: [{ label: 'Close', pri: true }] });
}
// keep a rolling version history on save
const _origSave = W.saveDoc;
W.saveDoc = (silent, skipReg) => {
  _origSave(silent, skipReg);
  if (!silent) {
    const hist = JSON.parse(XKV.get('wc.hist') || '[]');
    hist.push({ id: state.docId, at: Date.now(), name: state.docName, doc: collectDoc() });
    while (hist.length > 60) hist.shift();
    XKV.set('wc.hist', JSON.stringify(hist));
  }
};

function bsSaveAs(sec) {
  sec.innerHTML = `<h1>Save As</h1><h2>This PC</h2>
    <div class="tmpl-row" style="gap:12px">
      ${saveAsCard('docx', 'Word Document', '.docx', 'The standard format. Opens in Microsoft Word.', () => exportDocx())}
      ${saveAsCard('htmlfile', 'Web Page', '.html', 'A single HTML file with all formatting.', () => exportHtml())}
      ${saveAsCard('txtfile', 'Plain Text', '.txt', 'Text only, no formatting.', () => exportTxt())}
    </div>
    <h2>Rename or change location</h2>
    <div class="frm-row"><input type="text" id="bs-sa-name" style="width:280px;height:26px;border:1px solid #8A8886;padding:0 8px" value="${esc(state.docName)}"><button class="btn" id="bs-sa-save">Save</button></div>`;
  $('#bs-sa-save', sec).addEventListener('click', () => {
    const v = $('#bs-sa-name', sec).value.trim();
    if (v) { state.docName = v; W.updateTitleState(); }
    W.saveDoc(); W.closeBackstage();
  });
}
function saveAsCard(icon, name, ext, sub, fn) {
  const id = 'sa-' + ext.replace(/\W/g, '');
  setTimeout(() => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { fn(); }); });
  return `<button class="tmpl-card" id="${id}" style="width:210px">
    <div class="tmpl-thumb" style="height:90px;display:flex;align-items:center;justify-content:center">${svgIcon(icon === 'docx' ? 'newdoc' : icon, 'ico-32')}</div>
    <div class="tmpl-cap">${name} (<b>${ext}</b>)<small>${sub}</small></div></button>`;
}

function bsPrint(sec) {
  const s = W.docStats();
  sec.innerHTML = `<h1>Print</h1>
    <div class="bs-info-grid" style="max-width:520px">
      <div style="flex:1">
        <div class="bs-kv">
          <b>Printer</b><span>System dialog (any printer / Save as PDF)</span>
          <b>Pages</b><span>${s.pages}</span>
          <b>Layout</b><span>${state.pageSize.name}, ${state.pageSize.landscape ? 'Landscape' : 'Portrait'}</span>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
          <button class="btn pri big" id="bs-print-now" style="min-width:110px">Print</button>
          <span class="frm-note">Ctrl+P. Use your browser's print preview for copies and color options.</span>
        </div>
      </div>
    </div>`;
  $('#bs-print-now', sec).addEventListener('click', () => { W.closeBackstage(); setTimeout(() => W.print(), 150); });
}

function bsShare(sec) {
  sec.innerHTML = `<h1>Share</h1>
    <div class="tmpl-row" style="gap:12px">
      <button class="tmpl-card" id="sh-mail" style="width:250px"><div class="tmpl-thumb" style="height:80px;display:flex;align-items:center;justify-content:center">${svgIcon('email', 'ico-32')}</div><div class="tmpl-cap">Email<small>Send the document text as an email</small></div></button>
      <button class="tmpl-card" id="sh-link" style="width:250px"><div class="tmpl-thumb" style="height:80px;display:flex;align-items:center;justify-content:center">${svgIcon('link', 'ico-32')}</div><div class="tmpl-cap">Copy Link<small>Copy the app URL to the clipboard</small></div></button>
    </div>`;
  $('#sh-mail', sec).addEventListener('click', () => {
    const body = encodeURIComponent(pageTextForExport().slice(0, 1800));
    location.href = `mailto:?subject=${encodeURIComponent(state.docName)}&body=${body}`;
  });
  $('#sh-link', sec).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); W.sbMsg('Link copied'); }
    catch (e) { W.sbMsg(location.href); }
  });
}

function bsExport(sec) {
  sec.innerHTML = `<h1>Export</h1><h2>Create Document</h2>
    <div class="tmpl-row" style="gap:12px">
      ${saveAsCard('newdoc', 'Word Document', '.docx', 'Download a genuine OOXML package.', () => exportDocx())}
      ${saveAsCard('htmlfile', 'Web Page', '.html', 'Download a styled HTML file.', () => exportHtml())}
      ${saveAsCard('txtfile', 'Plain Text', '.txt', 'Download the raw text.', () => exportTxt())}
    </div>
    <h2>Change File Type</h2>
    <div class="doc-list">
      <div class="doc-row" id="ex-docx"><b>Document (*.docx)</b><button class="btn">Save As</button></div>
      <div class="doc-row" id="ex-htm"><b>Web Page (*.htm, *.html)</b><button class="btn">Save As</button></div>
      <div class="doc-row" id="ex-txt"><b>Plain Text (*.txt)</b><button class="btn">Save As</button></div>
    </div>`;
  $('#ex-docx', sec).addEventListener('click', exportDocx);
  $('#ex-htm', sec).addEventListener('click', exportHtml);
  $('#ex-txt', sec).addEventListener('click', exportTxt);
}

function bsAccount(sec) {
  sec.innerHTML = `<h1>Account</h1>
    <div class="bs-info-grid" style="max-width:560px">
      <div style="display:flex;gap:18px;align-items:center;flex:1">
        <span style="width:56px;height:56px;border-radius:50%;background:#2B579A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px">U</span>
        <div><div style="font-size:17px;font-weight:600">User</div>
        <div class="frm-note">user@example.com</div></div>
      </div>
    </div>
    <div class="frm-note" style="margin-top:16px">This is a local account for the web edition. Documents are stored in this browser.</div>
    <h2>Office Theme</h2>
    <div class="tmpl-row" style="gap:12px;max-width:600px">
      ${['colorful', 'silver', 'dark'].map(t => `<button class="tmpl-card" data-th="${t}" style="width:150px"><div class="tmpl-thumb" style="height:46px;background:${{ colorful: '#2B579A', silver: '#7B88A0', dark: '#232323' }[t]}"></div><div class="tmpl-cap" style="text-transform:capitalize">${t}</div></button>`).join('')}
    </div>`;
  $$('[data-th]', sec).forEach(b => b.addEventListener('click', () => {
    state.theme = b.dataset.th;
    W.applyChromeTheme(); W.saveOpts();
  }));
}

/* ============================ READ BAR ============================ */
W.ensureReadBar = () => {
  if ($('.read-bar')) return;
  const bar = el('div', { class: 'read-bar' });
  bar.innerHTML = `
    <svg viewBox="0 0 32 32" width="18" height="18"><rect x="2" y="2" width="28" height="28" rx="4" fill="#2B579A"/><path d="M9 9.4h2.6l2.2 9.9 2.6-9.9h2.2l2.6 9.9 2.3-9.9H26l-3.4 13.2h-2.5l-2.6-10-2.6 10h-2.5z" fill="#fff"/></svg>
    <b style="font-size:13px" id="rb-name"></b>
    <div style="flex:1"></div>
    <button class="btn" id="rb-edit" style="min-width:110px">Edit Document</button>
    <span class="sb-sep" style="background:#D6D6D6"></span>
    <button class="zbtn" id="rb-zout" style="color:#444">${svgIcon('minus', 'ico-s2')}</button>
    <span id="rb-zpct" style="font-size:12px;width:44px;text-align:center"></span>
    <button class="zbtn" id="rb-zin" style="color:#444">${svgIcon('plus', 'ico-s2')}</button>`;
  $('#app').insertBefore(bar, $('#workspace'));
  $('#rb-name', bar).textContent = state.docName;
  const upd = () => { $('#rb-zpct', bar).textContent = Math.round(state.zoom * 100) + '%'; };
  $('#rb-edit', bar).addEventListener('click', () => W.setView('print'));
  $('#rb-zin', bar).addEventListener('click', () => { W.setZoom(state.zoom + 0.1); upd(); });
  $('#rb-zout', bar).addEventListener('click', () => { W.setZoom(state.zoom - 0.1); upd(); });
  upd();
};

/* ============================ TITLE POPOVER / WINDOW BUTTONS ============================ */
function bindTitleChrome() {
  $('#tb-title-btn').addEventListener('click', ev => {
    const b = ev.currentTarget;
    const ses = JSON.parse(XKV.get('wc.session') || '{}');
    const wrap = el('div', { style: 'width:340px;padding:14px' });
    wrap.innerHTML = `
      <div style="font-size:11px;color:#605E5C;margin-bottom:4px">File Name</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" id="tp-name" value="${esc(state.docName)}" style="flex:1;height:28px;border:0;border-bottom:2px solid #2B579A;outline:none;font-size:15px"></div>
      <div style="font-size:11px;color:#605E5C;margin:14px 0 4px">Location</div>
      <div style="font-size:12.5px">This PC &gt; Documents (browser storage)</div>
      <div style="font-size:11px;color:${state.dirty ? '#A4262C' : '#107C10'};margin-top:12px">${state.dirty ? 'Changes not saved' : (ses.savedAt ? 'Saved - ' + new Date(ses.savedAt).toLocaleString() : 'Not saved yet')}</div>
      <div style="margin-top:14px;border-top:1px solid #E4E2E1;padding-top:10px">
        <button class="mi" id="tp-versions" style="width:100%;padding-left:0">${svgIcon('update')}<span>Version History</span></button>
        <button class="mi" id="tp-save" style="width:100%;padding-left:0">${svgIcon('save')}<span>Save</span></button>
      </div>`;
    W.pop(b, wrap, { x: Math.max(8, b.getBoundingClientRect().left), y: b.getBoundingClientRect().bottom + 2 });
    const inp = $('#tp-name', wrap);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); e.stopPropagation(); });
    inp.addEventListener('blur', () => {
      const v = inp.value.trim();
      if (v && v !== state.docName) { state.docName = v; W.updateTitleState(); W.markDirty(); }
    });
    $('#tp-versions', wrap).addEventListener('click', () => { W.closeAllPops(); versionList(document.body); });
    $('#tp-save', wrap).addEventListener('click', () => { W.closeAllPops(); W.saveDoc(); });
  });
  $('#tb-user').addEventListener('click', () => W.openBackstage('account'));

  let chip = null;
  $('#win-min').addEventListener('click', () => {
    $('#app').style.display = 'none';
    chip = el('div', { style: 'position:fixed;left:14px;bottom:14px;z-index:5000;display:flex;align-items:center;gap:10px;background:#2B579A;color:#fff;padding:9px 14px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:12.5px;cursor:pointer' });
    chip.innerHTML = `<svg viewBox="0 0 32 32" width="18" height="18"><rect x="2" y="2" width="28" height="28" rx="4" fill="#1F3E77"/><path d="M9 9.4h2.6l2.2 9.9 2.6-9.9h2.2l2.6 9.9 2.3-9.9H26l-3.4 13.2h-2.5l-2.6-10-2.6 10h-2.5z" fill="#fff"/></svg> ${esc(state.docName)} - Word <b>Restore</b>`;
    chip.addEventListener('click', () => { $('#app').style.display = ''; chip.remove(); chip = null; setTimeout(() => { W.drawRulers(); W.syncRulerPos(); }, 30); });
    document.body.appendChild(chip);
  });
  $('#win-max').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  $('#win-close').addEventListener('click', () => {
    window.close();
    const sp = el('div', { class: 'splash' });
    sp.innerHTML = `<svg viewBox="0 0 32 32" width="60" height="60"><rect x="1" y="1" width="30" height="30" rx="5" fill="#2B579A"/><path d="M8.4 9h2.8l2.4 10.6 2.7-10.6h2.3l2.7 10.6L23.5 9h2.8L22.6 23.4h-2.8L17 12.6l-2.8 10.8h-2.8z" fill="#fff"/></svg>
      <div style="font-size:15px;color:#444">${esc(state.docName)} has been closed. Your work is saved in this browser.</div>
      <button class="btn pri" style="min-width:140px;height:32px">Back to Document</button>`;
    $('button', sp).addEventListener('click', () => sp.remove());
    document.body.appendChild(sp);
  });
  $('#qat-more').addEventListener('click', ev => {
    W.pop(ev.currentTarget, W.menu([
      { label: 'New', icon: 'newdoc', action: () => W.openBackstage('new') },
      { label: 'Open', icon: 'folder', action: () => W.openBackstage('open') },
      { label: 'Save', icon: 'save', note: 'Ctrl+S', action: () => W.saveDoc() },
      'sep',
      { label: 'More Commands...', icon: 'options', action: () => W.optionsDialog() },
    ]));
  });
}

/* ============================ COMMENTS ============================ */
let cmSeq = 0;
W.newComment = () => {
  W.restoreRange();
  const s = getSelection();
  if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  const id = 'c' + (++cmSeq) + Date.now().toString(36);
  const anchor = el('span', { class: 'cm-anchor', 'data-cid': id });
  try {
    if (!r.collapsed) r.surroundContents(anchor);
    else {
      const b = W.anchorBlock();
      const r2 = document.createRange(); r2.selectNodeContents(b || r.commonAncestorContainer);
      r2.surroundContents(anchor);
    }
  } catch (e) {
    // multi-block selection: wrap per text node
    const tw = document.createTreeWalker($('#pages'), NodeFilter.SHOW_TEXT, { acceptNode: n => r.intersectsNode(n) && n.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = []; let n; while ((n = tw.nextNode())) nodes.push(n);
    nodes.forEach(tn => {
      const nr = document.createRange(); nr.selectNodeContents(tn);
      if (tn === r.startContainer) nr.setStart(tn, r.startOffset);
      if (tn === r.endContainer) nr.setEnd(tn, r.endOffset);
      const a2 = el('span', { class: 'cm-anchor', 'data-cid': id });
      nr.surroundContents(a2);
    });
  }
  state.comments[id] = { text: '', at: Date.now(), author: 'User' };
  cmRender();
  setTimeout(() => {
    const card = $(`.cm-card[data-cid="${id}"] textarea`);
    if (card) card.focus();
  }, 60);
  W.markDirty();
};
function cmRender() {
  const rail = $('#cm-rail');
  rail.innerHTML = '';
  const ids = Object.keys(state.comments).filter(id => $(`.cm-anchor[data-cid="${id}"]`));
  ids.forEach(id => { if (!state.comments[id]) delete state.comments[id]; });
  if (!ids.length) { rail.hidden = true; $('#docpad').style.paddingRight = ''; return; }
  rail.hidden = false;
  const pagesEl = $('#pages');
  rail.style.left = (pagesEl.offsetLeft + state.pageSize.w * state.zoom + 14) + 'px';
  const wrapR = $('#docwrap').getBoundingClientRect();
  let lastBottom = -100;
  ids.forEach(id => {
    const a = $(`.cm-anchor[data-cid="${id}"]`);
    if (!a) return;
    const r = a.getBoundingClientRect();
    let top = r.top - wrapR.top - 4;
    if (top < lastBottom) top = lastBottom;
    const c = state.comments[id];
    const card = el('div', { class: 'cm-card', 'data-cid': id, style: `top:${Math.max(0, top)}px;left:0` });
    card.innerHTML = `<div class="cm-who">${esc(c.author)}</div>`;
    const ta = el('textarea', { rows: 2, placeholder: 'Start a conversation' }, esc(c.text || ''));
    ta.addEventListener('input', () => { c.text = ta.value; W.markDirty(); ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
    ta.addEventListener('keydown', e => e.stopPropagation());
    card.appendChild(ta);
    const btns = el('div', { class: 'cm-btns' });
    const del = el('button', null, 'Delete');
    del.addEventListener('click', () => { W.deleteComment(id); });
    const res = el('button', null, 'Resolve');
    res.addEventListener('click', () => {
      $$(`.cm-anchor[data-cid="${id}"]`).forEach(an => an.classList.add('resolved'));
      delete state.comments[id]; cmRender();
    });
    btns.appendChild(res); btns.appendChild(del);
    card.appendChild(btns);
    card.addEventListener('mouseenter', () => a.style.outline = '2px solid #FFC000');
    card.addEventListener('mouseleave', () => a.style.outline = '');
    rail.appendChild(card);
    lastBottom = Math.max(0, top) + card.offsetHeight + 10;
  });
  $('#docpad').style.paddingRight = (ids.length ? 300 : 48) + 'px';
}
W.cmRender = cmRender;
W.cmRefresh = () => cmRender();
W.on('layout', () => { if (!$('#cm-rail').hidden) cmRender(); });

W.deleteComment = (id) => {
  if (!id) {
    const s = getSelection();
    let n = s.rangeCount ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) : null;
    const a = n && n.closest ? n.closest('.cm-anchor') : null;
    if (!a) { W.sbMsg('Place the cursor in a comment anchor first'); return; }
    id = a.dataset.cid;
  }
  $$(`.cm-anchor[data-cid="${id}"]`).forEach(an => an.replaceWith(...an.childNodes));
  delete state.comments[id];
  cmRender(); W.markDirty();
};
W.deleteAllComments = () => {
  $$('.cm-anchor').forEach(an => an.replaceWith(...an.childNodes));
  state.comments = {};
  cmRender(); W.markDirty();
};
W.navComment = (dir) => {
  const anchors = $$('.cm-anchor');
  if (!anchors.length) { W.sbMsg('No comments'); return; }
  const s = getSelection();
  let idx = -1;
  if (s.rangeCount) {
    const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
    const a = n && n.closest ? n.closest('.cm-anchor') : null;
    if (a) idx = anchors.indexOf(a);
  }
  idx = ((idx + dir) % anchors.length + anchors.length) % anchors.length;
  W.scrollToEl(anchors[idx]);
};

/* ============================ INK (Draw tab) ============================ */
const ink = state.ink;
const inkLayer = () => $('#ink-layer');
W.inkSet = tool => {
  ink.tool = ink.tool === tool ? null : tool;
  $('#app').classList.toggle('inkmode', !!ink.tool && ink.tool !== 'select');
  if (ink.tool === 'select') $('#app').classList.remove('inkmode');
  if (ink.tool && ink.tool !== 'select' && ink.tool !== 'lasso') $('#app').classList.add('inkmode');
  if (ink.tool === 'lasso') $('#app').classList.add('inkmode');
  if (!ink.tool) $('#app').classList.remove('inkmode');
  W.refreshStates();
  W.sbMsg(ink.tool ? ({ pen: 'Pen active - draw on the page', hl: 'Highlighter active', eraser: 'Eraser active - drag across strokes', lasso: 'Lasso: drag around strokes, then press Delete' })[ink.tool] || '' : 'Ink off');
};
function inkRender() {
  const svg = inkLayer();
  const wrap = $('#docwrap');
  const w = Math.max(wrap.scrollWidth, wrap.clientWidth), h = Math.max(wrap.scrollHeight, wrap.clientHeight);
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.style.left = '0'; svg.style.top = '0';
  svg.innerHTML = '';
  ink.strokes.forEach((st, i) => {
    if (st.pts.length < 2) return;
    const d = 'M' + st.pts.map(p => (p[0] * state.zoom).toFixed(1) + ' ' + (p[1] * state.zoom).toFixed(1)).join(' L');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', st.sel ? '#C00000' : st.color);
    path.setAttribute('stroke-width', st.width * state.zoom);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    if (st.hl) path.setAttribute('opacity', '0.42');
    if (st.sel) path.setAttribute('stroke-dasharray', '5 3');
    svg.appendChild(path);
  });
}
W.inkRender = inkRender;
W.on('layout', () => { if (!$('#cm-rail').hidden || ink.strokes.length) inkRender(); });

function bindInk() {
  const svg = inkLayer();
  let drawing = false, cur = null, lassoRect = null, lassoStart = null;
  const toLogical = e => {
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) / state.zoom, (e.clientY - r.top) / state.zoom];
  };
  svg.addEventListener('pointerdown', e => {
    if (!ink.tool) return;
    if (ink.tool === 'select') return;
    e.preventDefault();
    const p = toLogical(e);
    if (ink.tool === 'eraser') { eraseAt(p); drawing = true; return; }
    if (ink.tool === 'lasso') { lassoStart = p; drawing = true; ink.strokes.forEach(s => s.sel = false); inkRender(); return; }
    drawing = true;
    cur = { pts: [p], color: ink.tool === 'hl' ? ink.hlColor : ink.color, width: ink.tool === 'hl' ? 12 : ink.width, hl: ink.tool === 'hl' };
    ink.strokes.push(cur);
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = toLogical(e);
    if (ink.tool === 'eraser') { eraseAt(p); return; }
    if (ink.tool === 'lasso') { lassoRect = [lassoStart, p]; markLasso(); return; }
    cur.pts.push(p);
    inkRender();
  });
  svg.addEventListener('pointerup', () => {
    drawing = false;
    if (cur && cur.pts.length < 2) ink.strokes.pop();
    cur = null; lassoRect = null;
    inkRender(); W.markDirty();
  });
  function eraseAt(p) {
    const R = 8;
    ink.strokes = ink.strokes.filter(st => !st.pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < R));
    inkRender();
  }
  function markLasso() {
    const [a, b2] = lassoRect;
    const x0 = Math.min(a[0], b2[0]), x1 = Math.max(a[0], b2[0]);
    const y0 = Math.min(a[1], b2[1]), y1 = Math.max(a[1], b2[1]);
    ink.strokes.forEach(st => { st.sel = st.pts.some(q => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1); });
    inkRender();
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Delete' && ink.strokes.some(s => s.sel)) {
      ink.strokes = ink.strokes.filter(s => !s.sel);
      inkRender(); W.markDirty();
    }
  });
}

/* pen controls in the Draw ribbon (custom builder) */
W.CUST = W.CUST || {};
W.CUST.drawtools = (body) => {
  const mk = (id, icon, label, menuFn) => {
    const tool = id === 'inkselect' ? 'select' : id === 'inklasso' ? 'lasso' : id === 'inkpen' ? 'pen' : id === 'inkhl' ? 'hl' : 'eraser';
    const b = el('button', { class: 'rbig plain', title: label });
    b.dataset.cmd = id;
    b.dataset.toggle = 'ink:' + tool;
    b.innerHTML = svgIcon(icon, 'ico-32') + `<span class="rb-lab">${esc(label)}${menuFn ? ' ' + svgIcon('chev-d', 'ico-s') : ''}</span>`;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => {
      if (menuFn) { menuFn(b); return; }
      W.inkSet(tool);
    });
    body.appendChild(b);
    return b;
  };
  mk('inkselect', 'selectall', 'Select');
  mk('inkeraser', 'eraser', 'Eraser');
  mk('inklasso', 'lasso', 'Lasso Select');
  mk('inkpen', 'pen', 'Pen', (b) => {
    W.pop(b, W.menu([
      { hdr: 1, label: 'Pen color' },
      ...[['#000000', 'Black'], ['#C00000', 'Red'], ['#2B579A', 'Blue'], ['#538135', 'Green']].map(([c, n]) => ({
        html: `<span class="sw2" style="width:14px;height:14px;background:${c};display:inline-block;vertical-align:-2px;margin-right:6px"></span>${n}`,
        check: ink.color === c,
        action: () => { ink.color = c; W.inkSet('pen'); },
      })),
      'sep',
      { hdr: 1, label: 'Thickness' },
      ...[[0.8, '0.5 mm'], [1.5, '1.0 mm'], [2.5, '2.0 mm'], [4, '3.5 mm']].map(([w, n]) => ({
        label: n, check: ink.width === w, action: () => { ink.width = w; W.inkSet('pen'); },
      })),
    ]));
  });
  mk('inkhl', 'highlighter', 'Highlighter', (b) => {
    W.pop(b, W.menu([['#FFFF00', 'Yellow'], ['#7CFC00', 'Green'], ['#FF9FF3', 'Pink'], ['#9BE7FF', 'Blue']].map(([c, n]) => ({
      html: `<span class="sw2" style="width:14px;height:14px;background:${c};display:inline-block;vertical-align:-2px;margin-right:6px"></span>${n}`,
      check: ink.hlColor === c, action: () => { ink.hlColor = c; W.inkSet('hl'); },
    }))));
  });
};
W.CUST.paraset = (body) => {
  const mkCol = (caption, rows) => {
    const col = el('div', { style: 'display:flex;flex-direction:column;gap:1px' });
    col.appendChild(el('div', { style: 'font-size:10.5px;color:#605E5C;line-height:1.1;padding-bottom:1px' }, caption));
    rows.forEach(([label, id, unit, step]) => {
      const r = el('div', { style: 'display:flex;align-items:center;gap:3px;height:21px;font-size:11px;color:#444' });
      r.innerHTML = `<span style="width:${unit === 'in' ? 31 : 39}px">${label}</span>` +
        `<input type="number" step="${step}" style="width:44px;height:18px;border:1px solid #B3B0AD;padding:0 3px;font-size:11px" id="${id}">` +
        `<span style="color:#8A8886;font-size:10px">${unit === 'in' ? '&quot;' : 'pt'}</span>`;
      col.appendChild(r);
    });
    return col;
  };
  const wrap = el('div', { style: 'display:flex;gap:10px;align-items:flex-start;padding-top:1px' });
  const c1 = mkCol('Indent', [['Left:', 'pi-l', 'in', 0.1], ['Right:', 'pi-r', 'in', 0.1]]);
  const c2 = mkCol('Spacing', [['Before:', 'pi-b', 'pt', 6], ['After:', 'pi-a', 'pt', 6]]);
  wrap.appendChild(c1); wrap.appendChild(c2);
  wrap.addEventListener('mousedown', e => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
  const apply = () => {
    const vl = +$('#pi-l', wrap).value || 0, vr = +$('#pi-r', wrap).value || 0;
    const vb = +$('#pi-b', wrap).value || 0, va = +$('#pi-a', wrap).value || 0;
    W.applyToBlocks(x => {
      x.style.marginLeft = vl * 96 + 'px';
      x.style.marginRight = vr * 96 + 'px';
      x.style.marginTop = vb * W.PT + 'px';
      x.style.marginBottom = va * W.PT + 'px';
    });
  };
  ['pi-l', 'pi-r', 'pi-b', 'pi-a'].forEach(id => $('#' + id, wrap).addEventListener('change', apply));
  wrap.addEventListener('keydown', e => { if (e.key === 'Enter') { apply(); e.target.blur(); } e.stopPropagation(); });
  document.addEventListener('selectionchange', () => {
    if (wrap.contains(document.activeElement)) return;
    const blk = W.anchorBlock(); if (!blk) return;
    const cs = getComputedStyle(blk);
    $('#pi-l', wrap).value = (parseFloat(cs.marginLeft) / 96).toFixed(2);
    $('#pi-r', wrap).value = (parseFloat(cs.marginRight) / 96).toFixed(2);
    $('#pi-b', wrap).value = Math.round(parseFloat(cs.marginTop) / W.PT || 0);
    $('#pi-a', wrap).value = Math.round(parseFloat(cs.marginBottom) / W.PT || 8);
  });
  body.appendChild(wrap);
};

/* ============================ WBOOT (called by W.init) ============================ */
window.WBOOT = function () {
  bindTitleChrome();
  bindInk();
  bindDragDrop();
  if (!restoreSession()) {
    // fresh blank document
    state.docId = null;
  }
  applyPageChrome();
  drawColorSwatches();
  setTimeout(() => { W.cmRender(); W.inkRender(); }, 120);
};
function drawColorSwatches() {
  // sync color split-button bars with state
  $$('.rsm .swbar').forEach(() => {});
}
/* public export hooks (also used by the Playwright trackers) */
W.exportDocx = exportDocx;
W.exportHtml = exportHtml;
W.exportTxt = exportTxt;
})();
