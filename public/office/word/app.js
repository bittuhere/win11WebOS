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
   Word clone — core application
   Sections:
     1  utilities & state
     2  popups / menus / palettes / dialogs (framework)
     3  ribbon builder
     4  document model: pages, pagination, header/footer, footnotes
     5  selection & formatting engine
     6  commands
     7  menus (builders)
     8  status bar / rulers / zoom / views
     9  find & replace
     10 shortcuts, paste, context menu, tables
     11 boot glue (session restore lives in app2)
   ========================================================================== */
(function () {
'use strict';
const W = window.W = {};

/* ============================ 1. UTILITIES/STATE ============================ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, attrs, html) => {
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
W.$ = $; W.$$ = $$; W.el = el; W.esc = esc;

const PT = 96 / 72;                    // pt -> px
const PAGE_W = 816, PAGE_H = 1056, PAGE_M = 96;

const state = W.state = {
  zoom: 1, view: 'print', showPara: false, ruler: true,
  docName: 'Document1', docId: null, dirty: false,
  colors: { fontcolor: '#C00000', highlight: '#FFFF00', shading: '#FBE2D5', pagecolor: '' },
  margins: { t: PAGE_M, r: PAGE_M, b: PAGE_M, l: PAGE_M },
  pageSize: { w: PAGE_W, h: PAGE_H, name: 'Letter' },
  hf: { header: '', footer: '' },
  wm: null, pageBorder: null,
  comments: [], fnModel: {},
  painter: null, painterLock: false,
  spell: true, autosave: false,
  theme: 'colorful',
  ink: { tool: null, color: '#000000', width: 2, hlColor: '#FFFF00', strokes: [] },
};
W.PT = PT;

const opts = JSON.parse(XKV.get('wc.opts') || '{}');
Object.assign(state, {
  showPara: !!opts.showPara, ruler: opts.ruler !== false, spell: opts.spell !== false,
  autosave: !!opts.autosave, theme: opts.theme || 'colorful',
});
function saveOpts() {
  XKV.set('wc.opts', JSON.stringify({
    showPara: state.showPara, ruler: state.ruler, spell: state.spell,
    autosave: state.autosave, theme: state.theme,
  }));
}
W.saveOpts = saveOpts;

const app = () => $('#app');
const pagesRoot = () => $('#pages');
W.getZoom = () => state.zoom;
W.emit = (ev, data) => { (W._subs[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); };
W.on = (ev, f) => { (W._subs[ev] = W._subs[ev] || []).push(f); };
W._subs = {};

/* ============================ 2. POPUPS / MENUS / DIALOGS ============================ */
const overlayRoot = () => $('#overlay-root');
let popStack = [];
function closeTopPop() {
  const top = popStack.pop();
  if (top) { top.node.remove(); return true; }
  return false;
}
function closeAllPops() {
  while (popStack.length) closeTopPop();
}
W.closeAllPops = closeAllPops;
document.addEventListener('pointerdown', e => {
  const inPop = e.target.closest && e.target.closest('.popup');
  const inAnchor = popStack.some(p => p.anchor && p.anchor.contains(e.target));
  if (!inPop && !inAnchor) closeAllPops();
  // clicking another anchor closes existing pops (reopen logic in pop())
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (popStack.length) { closeTopPop(); e.stopPropagation(); return; }
    if (app().classList.contains('reading')) { setView('print'); }
  }
}, true);

function pop(anchor, node, opts) {
  opts = opts || {};
  if (anchor && popStack.some(p => p.anchor === anchor)) { closeAllPops(); return null; }
  const wrap = el('div', { class: 'popup' + (opts.cls ? ' ' + opts.cls : '') });
  wrap.appendChild(node);
  overlayRoot().appendChild(wrap);
  const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, bottom: innerHeight / 2, top: 0 };
  wrap.style.visibility = 'hidden';
  wrap.style.left = '0px'; wrap.style.top = '0px';
  const pw = wrap.offsetWidth, ph = wrap.offsetHeight;
  let x = opts.x != null ? opts.x : (opts.alignRight ? r.right - pw : r.left - (opts.dx || 0));
  let y = opts.y != null ? opts.y : r.bottom + 1;
  if (x + pw > innerWidth - 4) x = innerWidth - pw - 4;
  if (x < 2) x = 2;
  if (y + ph > innerHeight - 4) y = Math.max(2, r.top - ph - 1);
  if (y < 2) y = 2;
  wrap.style.left = x + 'px'; wrap.style.top = y + 'px';
  wrap.style.visibility = '';
  popStack.push({ node: wrap, anchor });
  return wrap;
}
W.pop = pop;
W.popupOpen = () => !!popStack.length;

function menu(items, opts) {
  // items: {icon, label, note, check, radio, action, submenu, dis, cls} | 'sep' | {label:'header', hdr:1}
  const m = el('div', { class: 'menu' });
  for (const it of items) {
    if (it === 'sep') { m.appendChild(el('div', { class: 'msep' })); continue; }
    if (it.hdr) { m.appendChild(el('div', { class: 'mlabel' }, esc(it.label))); continue; }
    const row = el('div', { class: 'mi' + (it.dis ? ' dis' : '') + (it.sel ? ' sel' : '') });
    let left = '';
    if (it.check !== undefined) left = `<span class="chk">${it.check ? svgIcon('check') : ''}</span>`;
    else if (it.icon) left = svgIcon(it.icon);
    else left = '<span class="chk"></span>';
    row.innerHTML = left + `<span>${it.html || esc(it.label)}</span>` +
      (it.note ? `<span class="mi-note">${esc(it.note)}</span>` : '') +
      (it.submenu ? `<span class="sub">${svgIcon('chev-r', 'ico-s')}</span>` : '');
    row.title = it.tip || '';
    row.addEventListener('click', ev => {
      if (it.dis || it.submenu) return;
      closeAllPops();
      if (it.action) it.action(ev);
    });
    if (it.submenu) {
      let subOpen = null;
      row.addEventListener('mouseenter', () => {
        if (subOpen) return;
        subOpen = pop(row, menu(it.submenu()), { x: row.getBoundingClientRect().right - 2, y: row.getBoundingClientRect().top - 4 });
        row.addEventListener('mouseleave', () => {
          setTimeout(() => { if (subOpen && !subOpen.matches(':hover')) { subOpen.remove(); popStack = popStack.filter(p => p.node !== subOpen); subOpen = null; } }, 120);
        }, { once: true });
      });
    }
    m.appendChild(row);
  }
  return m;
}
W.menu = menu;

/* Office-style color palette */
const THEME_COLS = [
  ['#FFFFFF', '#F2F2F2', '#D8D8D8', '#BFBFBF', '#A5A5A5', '#7F7F7F'],
  ['#000000', '#7F7F7F', '#595959', '#3F3F3F', '#262626', '#0C0C0C'],
  ['#E7E6E6', '#DDD9C3', '#BEBADA', '#B8CCE4', '#F2DCDB', '#CCC1D9'],
  ['#44546A', '#D6DCE4', '#ADB9CA', '#8496B0', '#5B677A', '#2E3B52'],
  ['#4472C4', '#D9E2F3', '#B4C6E7', '#8FAADC', '#2F5597', '#203864'],
  ['#ED7D31', '#FBE2D5', '#F7CBAD', '#F4B183', '#C55A11', '#833C00'],
  ['#A5A5A5', '#EDEDED', '#DBDBDB', '#C9C9C9', '#7B7B7B', '#3B3838'],
  ['#FFC000', '#FFF2CC', '#FFE699', '#FFD966', '#BF9000', '#7F6000'],
  ['#5B9BD5', '#DEEBF7', '#BDD7EE', '#9DC3E6', '#2E75B6', '#1F4E79'],
  ['#70AD47', '#E2EFDA', '#C6E0B4', '#A9D18E', '#538135', '#375623'],
];
const STD_COLORS = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];

function palette(opts) {
  // opts: {onPick(color), automatic:bool, noColor:bool, more:bool, current}
  const root = el('div', { class: 'palette' });
  if (opts.automatic) {
    const a = el('div', { class: 'pal-opt' }, `<span class="sw2" style="background:#000"></span><span>Automatic</span>`);
    a.addEventListener('click', () => { closeAllPops(); opts.onPick(''); });
    root.appendChild(a);
  }
  const t1 = el('div', { class: 'pal-title' }, 'Theme Colors');
  const g = el('div', { class: 'pal-grid' });
  for (let shade = 0; shade < 6; shade++) {
    for (let c = 0; c < 10; c++) {
      const col = THEME_COLS[c][shade];
      const s = el('div', { class: 'sw2', style: `background:${col}`, title: col });
      s.addEventListener('click', () => { closeAllPops(); opts.onPick(col); });
      g.appendChild(s);
    }
  }
  const t2 = el('div', { class: 'pal-title' }, 'Standard Colors');
  const g2 = el('div', { class: 'pal-grid' });
  STD_COLORS.forEach(col => {
    const s = el('div', { class: 'sw2', style: `background:${col}`, title: col });
    s.addEventListener('click', () => { closeAllPops(); opts.onPick(col); });
    g2.appendChild(s);
  });
  root.appendChild(t1); root.appendChild(g); root.appendChild(t2); root.appendChild(g2);
  if (opts.noColor) {
    const n = el('div', { class: 'pal-opt' }, `<span class="sw2" style="background:#fff;border-style:dashed"></span><span>${opts.noColorLabel || 'No Color'}</span>`);
    n.addEventListener('click', () => { closeAllPops(); opts.onPick(null); });
    root.appendChild(n);
  }
  if (opts.more !== false) {
    const m = el('div', { class: 'pal-opt' }, `<span class="sw2" style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red)"></span><span>More Colors...</span>`);
    m.addEventListener('click', () => {
      const inp = el('input', { type: 'color', style: 'position:fixed;opacity:0;pointer-events:none' });
      document.body.appendChild(inp);
      inp.addEventListener('change', () => { opts.onPick(inp.value.toUpperCase()); inp.remove(); });
      inp.click();
      closeAllPops();
    });
    root.appendChild(m);
  }
  return root;
}
W.palette = palette;

/* Generic dialog */
let dlgOpen = null;
function dlg(o) {
  // o: {title, body(node), buttons:[{label, pri, action(root)->bool false=keep open}], width, shade}
  if (dlgOpen) dlgOpen.remove();
  const bk = el('div', { class: 'dlg-backdrop' + (o.shade === false ? '' : ' shade') });
  const d = el('div', { class: 'dlg' });
  if (o.width) d.style.width = o.width + 'px';
  d.innerHTML = `<div class="dlg-h"><span class="dlg-t">${esc(o.title)}</span><button class="dlg-x">${svgIcon('close')}</button></div>`;
  const bd = el('div', { class: 'dlg-b' });
  bd.appendChild(o.body);
  const ft = el('div', { class: 'dlg-f' });
  const buttons = o.buttons === null ? [] : (o.buttons || [{ label: 'OK', pri: true }]);
  buttons.forEach(b => {
    const btn = el('button', { class: 'btn' + (b.pri ? ' pri' : '') }, esc(b.label));
    btn.addEventListener('click', () => {
      if (b.action) { if (b.action(root) === false) return; }
      close();
    });
    ft.appendChild(btn);
  });
  d.appendChild(bd);
  if (buttons.length) d.appendChild(ft);
  bk.appendChild(d);
  const root = bk;
  function close() { bk.remove(); if (dlgOpen === bk) dlgOpen = null; }
  d.querySelector('.dlg-x').addEventListener('click', close);
  bk.addEventListener('pointerdown', e => { if (e.target === bk) close(); });
  // draggable
  const h = d.querySelector('.dlg-h');
  h.addEventListener('pointerdown', e0 => {
    if (e0.target.closest('.dlg-x')) return;
    const r = d.getBoundingClientRect(); const ox = e0.clientX - r.left, oy = e0.clientY - r.top;
    d.style.position = 'fixed'; d.style.left = r.left + 'px'; d.style.top = r.top + 'px'; d.style.margin = '0';
    const mv = e => { d.style.left = (e.clientX - ox) + 'px'; d.style.top = Math.max(0, e.clientY - oy) + 'px'; };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  });
  overlayRoot().appendChild(bk);
  dlgOpen = bk;
  root.close = close;
  const first = bd.querySelector('input,select,textarea');
  if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 30);
  bk.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.target.closest('textarea') && !e.target.closest('.btn')) {
      const pri = ft.querySelector('.btn.pri'); if (pri) pri.click();
    }
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  return root;
}
W.dlg = dlg;

/* ============================ 3. RIBBON ============================ */
function icoBtn(cls, cfg) {
  // compact icon-only button with optional split caret
  const b = el('button', { class: cls, title: cfg.label + (cfg.tip ? '\n' + cfg.tip : '') });
  b.dataset.cmd = cfg.id;
  if (cfg.toggle) b.dataset.toggle = cfg.toggle;
  b.innerHTML = svgIcon(cfg.icon) + (cfg.menu && cfg.split ? `<span class="caret">${svgIcon('chev-d', 'ico-s')}</span>` : '');
  return b;
}

function buildRibbon() {
  const tabsEl = $('#tabs'); const rib = $('#ribbon');
  tabsEl.innerHTML = ''; rib.innerHTML = '';
  const fileTab = el('button', { class: 'tab file' }, 'File');
  fileTab.addEventListener('click', () => W.openBackstage('home'));
  tabsEl.appendChild(fileTab);

  RIBBON.forEach((tab) => {
    const t = el('button', { class: 'tab' + (tab.id === W.activeTab ? ' active' : '') }, tab.label);
    t.dataset.tab = tab.id;
    t.addEventListener('click', () => {
      if (app().classList.contains('rib-collapsed')) { app().classList.remove('rib-collapsed'); }
      else if (W.activeTab === tab.id) { app().classList.toggle('rib-collapsed'); return; }
      setTab(tab.id);
    });
    t.addEventListener('dblclick', () => app().classList.toggle('rib-collapsed'));
    tabsEl.appendChild(t);
    const panel = el('div', { class: 'rpanel' + (tab.id === W.activeTab ? ' active' : ''), 'data-panel': tab.id });
    tab.groups.forEach(g => {
      const gr = el('div', { class: 'rgroup' });
      const body = el('div', { class: 'rg-body' });
      g.items.forEach(it => buildItem(body, it));
      gr.appendChild(body);
      const nm = el('div', { class: 'rg-name' }, esc(g.label));
      if (g.launch) {
        const lb = el('button', { class: 'rg-launch', title: g.label + ' dialog' }, svgIcon('dlg', 'ico-s'));
        lb.addEventListener('mousedown', e => e.preventDefault());
        lb.addEventListener('click', () => CMDS[g.launch].exec());
        nm.appendChild(lb);
      }
      gr.appendChild(nm);
      panel.appendChild(gr);
    });
    rib.appendChild(panel);
  });

  function buildItem(body, it) {
    switch (it.t) {
      case 'big': {
        if (it.menu && it.split) {
          const col = el('div', { class: 'rcol split-v rbig split' });
          const main = el('button', { class: 'rb-main', title: it.label }, svgIcon(it.icon, 'ico-32'));
          main.dataset.cmd = it.id;
          main.addEventListener('mousedown', e => e.preventDefault());
          main.addEventListener('click', ev => CMDS[it.id].exec(ev, main));
          const caret = el('button', { class: 'rb-caret', title: it.label }, `${esc(it.label)} ${svgIcon('chev-d', 'ico-s')}`);
          caret.addEventListener('mousedown', e => e.preventDefault());
          caret.addEventListener('click', () => MENU_BUILDERS[it.menu](caret));
          col.appendChild(main); col.appendChild(caret); body.appendChild(col);
        } else {
          const b = el('button', { class: 'rbig plain', title: it.label });
          b.dataset.cmd = it.id; if (it.toggle) b.dataset.toggle = it.toggle;
          b.innerHTML = svgIcon(it.icon, 'ico-32') +
            `<span class="rb-lab">${esc(it.label)}${it.menu ? ' ' + svgIcon('chev-d', 'ico-s') : ''}</span>`;
          b.addEventListener('mousedown', e => e.preventDefault());
          b.addEventListener('click', ev => {
            if (it.menu) MENU_BUILDERS[it.menu](b); else CMDS[it.id].exec(ev, b);
          });
          body.appendChild(b);
        }
        break;
      }
      case 'sm': {
        const b = el('button', { class: 'rsm', title: it.label });
        b.dataset.cmd = it.id; if (it.toggle) b.dataset.toggle = it.toggle;
        b.innerHTML = svgIcon(it.icon) + `<span>${esc(it.label)}</span>` + (it.menu ? `<span class="caret">${svgIcon('chev-d', 'ico-s')}</span>` : '');
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', ev => {
          if (it.menu) MENU_BUILDERS[it.menu](b); else CMDS[it.id].exec(ev, b);
        });
        body.appendChild(b);
        break;
      }
      case 'stack': {
        const st = el('div', { class: 'rstack' });
        it.items.forEach(x => buildItem(st, x));
        body.appendChild(st);
        break;
      }
      case 'rows': {
        const wrap = el('div', { class: 'rc-rows' });
        it.rows.forEach(rowCfg => {
          const row = el('div', { style: 'display:flex;align-items:center;gap:2px' });
          rowCfg.forEach(x => buildItem(row, x));
          wrap.appendChild(row);
        });
        body.appendChild(wrap);
        break;
      }
      case 'ic': {
        if (it.menu && it.split) {
          const wrap = el('span', { style: 'display:inline-flex' });
          const main = icoBtn('rsm', { ...it, split: false });
          main.addEventListener('mousedown', e => e.preventDefault());
          main.addEventListener('click', ev => CMDS[it.id].exec(ev, main));
          const caret = el('button', { class: 'rsm', style: 'padding:0 2px', title: it.label }, svgIcon('chev-d', 'ico-s'));
          caret.addEventListener('mousedown', e => e.preventDefault());
          caret.addEventListener('click', () => MENU_BUILDERS[it.menu](caret));
          wrap.appendChild(main); wrap.appendChild(caret);
          body.appendChild(wrap);
        } else {
          const b = icoBtn('rsm', it);
          if (it.menu) b.innerHTML += `<span class="caret">${svgIcon('chev-d', 'ico-s')}</span>`;
          b.addEventListener('mousedown', e => e.preventDefault());
          b.addEventListener('click', ev => it.menu ? MENU_BUILDERS[it.menu](b) : CMDS[it.id].exec(ev, b));
          body.appendChild(b);
        }
        break;
      }
      case 'color': {
        const wrap = el('span', { style: 'display:inline-flex;position:relative' });
        const cmd = it.id;
        const main = it.labeled
          ? el('button', { class: 'rsm', title: it.label + (it.tip ? '\n' + it.tip : '') })
          : icoBtn('rsm', it);
        if (it.labeled) { main.dataset.cmd = cmd; main.innerHTML = svgIcon(it.icon) + `<span>${esc(it.label)}</span>`; }
        const sw = el('span', { class: 'swbar', style: `background:${state.colors[cmd] || it.def || '#000'}` });
        if (it.labeled) sw.style.right = '2px';
        main.appendChild(sw);
        main.addEventListener('mousedown', e => e.preventDefault());
        main.addEventListener('click', ev => CMDS[cmd].exec(ev, main, state.colors[cmd]));
        const caret = el('button', { class: 'rsm', style: 'padding:0 2px', title: it.label }, svgIcon('chev-d', 'ico-s'));
        caret.addEventListener('mousedown', e => e.preventDefault());
        caret.addEventListener('click', () => {
          pop(caret, palette({
            automatic: cmd === 'fontcolor', noColor: true,
            onPick: c => { state.colors[cmd] = c; sw.style.background = c || (cmd === 'fontcolor' ? '#000' : 'transparent'); CMDS[cmd].exec(null, main, c); },
          }));
        });
        wrap._swbar = sw;
        wrap.appendChild(main); wrap.appendChild(caret);
        body.appendChild(wrap);
        break;
      }
      case 'combo': buildCombo(body, it); break;
      case 'gallery': buildGallery(body); break;
      case 'custom': if (W.CUST && W.CUST[it.id]) W.CUST[it.id](body); break;
    }
  }
  refreshStates();
}

function setTab(id) {
  W.activeTab = id;
  $$('.tab[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  $$('.rpanel').forEach(p => p.classList.toggle('active', p.dataset.panel === id));
}
W.setTab = setTab;

/* font/size combos */
const FONTS = ['Calibri', 'Calibri Light', 'Cambria', 'Georgia', 'Times New Roman', 'Arial', 'Arial Black', 'Arial Narrow', 'Book Antiqua', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Courier New', 'Franklin Gothic Medium', 'Garamond', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Verdana'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

function buildCombo(body, it) {
  const isFont = it.id === 'font';
  const wrap = el('span', { class: 'rcombo ' + (isFont ? 'rc-font' : 'rc-size') });
  const inp = el('input', { type: 'text', value: isFont ? 'Calibri' : '11' });
  inp.spellcheck = false;
  const btn = el('button', { class: 'rc-btn', tabindex: '-1' }, svgIcon('chev-d', 'ico-s'));
  wrap.appendChild(inp); wrap.appendChild(btn);
  if (isFont) W.fontInput = inp; else W.sizeInput = inp;
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => {
    const list = el('div', { class: 'menu', style: (isFont ? 'max-height:320px;overflow:auto;width:220px' : 'max-height:320px;overflow:auto;width:64px') });
    (isFont ? FONTS : SIZES).forEach(v => {
      const itm = el('div', { class: 'mi' });
      if (isFont) { itm.innerHTML = `<span style="font-family:'${v}',sans-serif">${esc(v)}</span>`; }
      else itm.innerHTML = `<span>${v}</span>`;
      itm.style.paddingLeft = '10px';
      itm.addEventListener('click', () => {
        closeAllPops();
        if (isFont) CMDS.font.exec(null, null, v); else CMDS.fontsize.exec(null, null, v);
      });
      list.appendChild(itm);
    });
    pop(btn, list, { cls: '' });
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = inp.value.trim();
      if (!v) return;
      if (isFont) CMDS.font.exec(null, null, v); else CMDS.fontsize.exec(null, null, parseFloat(v.replace(/[^\d.]/g, '')) || 11);
      inp.blur();
    }
    e.stopPropagation();
  });
  inp.addEventListener('focus', () => { W._comboFocus = true; });
  inp.addEventListener('blur', () => { W._comboFocus = false; });
  body.appendChild(wrap);
}

/* styles gallery */
function buildGallery(body) {
  const wrap = el('div', { class: 'sty-strip' });
  body.appendChild(wrap);
  const visible = STYLES.slice(0, 5);
  const render = () => {
    wrap.innerHTML = '';
    visible.forEach(st => {
      const itm = el('div', { class: 'sty-item', title: st.name });
      itm.dataset.styleid = st.id;
      const prev = stylePreview(st);
      itm.appendChild(prev);
      itm.appendChild(el('div', { class: 'sty-cap' }, esc(st.name)));
      itm.addEventListener('mousedown', e => e.preventDefault());
      itm.addEventListener('click', () => CMDS.style.exec(null, null, st.id));
      wrap.appendChild(itm);
    });
    const arrows = el('div', { class: 'sty-arrows' });
    const up = el('button', { title: 'Previous row' }, svgIcon('chev-up', 'ico-s'));
    const more = el('button', { title: 'More' }, svgIcon('chev-d', 'ico-s'));
    up.addEventListener('mousedown', e => e.preventDefault());
    more.addEventListener('mousedown', e => e.preventDefault());
    up.addEventListener('click', () => { const f = visible.shift(); visible.push(f); render(); });
    more.addEventListener('click', () => CMDS.stylesMore.exec(null, more));
    arrows.appendChild(up); arrows.appendChild(more);
    wrap.appendChild(arrows);
    markGallerySel();
  };
  render();
  W._galleryWrap = wrap;
}
function stylePreview(st) {
  const map = {
    normal: "font:14px Calibri,sans-serif", nosp: "font:14px Calibri,sans-serif",
    h1: "font:400 16px 'Calibri Light',Calibri,sans-serif;color:#2E74B5",
    h2: "font:400 14px 'Calibri Light',Calibri,sans-serif;color:#2E74B5",
    h3: "font:400 13px 'Calibri Light',Calibri,sans-serif;color:#1F4D78",
    title: "font:400 17px 'Calibri Light',Calibri,sans-serif;color:#444;letter-spacing:.3px",
    subtitle: "font:italic 12px Calibri,sans-serif;color:#5A5A5A",
    quote: "font:italic 12px Calibri,sans-serif;color:#404040",
    iquote: "font:italic 12px Calibri,sans-serif;color:#2E74B5",
  };
  return el('div', { class: 'sty-prev', style: (map[st.id] || map.normal) }, 'AaBbCcDd');
}
function markGallerySel() {
  const cur = currentBlockStyleId();
  $$('.sty-item', W._galleryWrap).forEach(i => i.classList.toggle('sel', i.dataset.styleid === cur));
}
function currentBlockStyleId() {
  const b = anchorBlock(); if (!b) return 'normal';
  if (b.classList.contains('sty-title')) return 'title';
  if (b.classList.contains('sty-subtitle')) return 'subtitle';
  if (b.classList.contains('sty-iquote')) return 'iquote';
  if (b.classList.contains('sty-nosp')) return 'nosp';
  const t = b.tagName.toLowerCase();
  if (t === 'h1') return 'h1'; if (t === 'h2') return 'h2'; if (t === 'h3') return 'h3';
  if (t === 'blockquote') return 'quote';
  return 'normal';
}
W.markGallerySel = markGallerySel;

/* ============================ 4. DOCUMENT MODEL ============================ */
function newPageEl() {
  const p = el('div', { class: 'page' });
  p.innerHTML =
    `<div class="wm"></div>` +
    `<div class="pborder" hidden></div>` +
    `<div class="phdr" contenteditable="false"></div>` +
    `<div class="pbody"></div>` +
    `<div class="pftr" contenteditable="false"></div>` +
    `<div class="fns"></div>`;
  p.addEventListener('mousedown', onPageMarginClick);
  return p;
}
function onPageMarginClick(e) {
  const page = e.currentTarget;
  const body = $('.pbody', page);
  if (e.target.closest('.pbody,.phdr,.pftr')) return;
  // click in margins: move caret to nearest text edge
  const pr = page.getBoundingClientRect();
  const first = body.firstElementChild, last = body.lastElementChild;
  e.preventDefault();
  const r = document.createRange();
  if ((e.clientY - pr.top) / state.zoom < state.margins.t && first) { r.setStart(first, 0); }
  else if (last) { r.selectNodeContents(last); r.collapse(false); }
  else { r.selectNodeContents(body); r.collapse(false); }
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  pagesRoot().focus();
}
function ensurePageStructure() {
  const root = pagesRoot();
  root.classList.toggle('showPara', state.showPara);
  if (!root.querySelector('.page')) {
    const pg = newPageEl();
    root.innerHTML = '';
    root.appendChild(pg);
  }
  $$('.page', root).forEach(pg => {
    if (!$('.pbody', pg)) pg.appendChild(el('div', { class: 'pbody' }));
    for (const [cls] of [['wm'], ['pborder'], ['phdr'], ['pftr'], ['fns']]) {
      if (!$(`.${cls}`, pg)) {
        const d = el('div', { class: cls });
        if (cls === 'pborder') d.hidden = true;
        if (cls === 'phdr' || cls === 'pftr') { d.contentEditable = 'false'; pg._hfSig = null; }
        pg.insertBefore(d, $('.pbody', pg));
      }
    }
    const b = $('.pbody', pg);
    if (!b.firstElementChild && !b.textContent.trim()) b.innerHTML = '<p><br></p>';
    // stray text nodes -> wrap
    Array.from(b.childNodes).forEach(n => {
      if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) {
        const p = el('p', null, esc(n.nodeValue)); b.replaceChild(p, n);
      }
    });
  });
}
W.ensurePageStructure = ensurePageStructure;

let paginating = false, paginatePending = false;
function schedulePaginate() {
  if (paginating) { paginatePending = true; return; }
  requestAnimationFrame(() => paginate());
}
W.schedulePaginate = schedulePaginate;

function paginate() {
  if (paginating) return;
  paginating = true;
  const root = pagesRoot();
  try {
  if (state.view === 'web') { trimPages(1); updateAfterLayout(); return; }
  const list = () => $$(':scope > .page', root);
  const overflowTok = pg => { const b = $('.pbody', pg); return b ? b.scrollHeight - b.clientHeight : 0; };
  // 1) handle explicit page breaks: break marker + trailing siblings move to next page
  {
    let pages = list();
    for (let i = 0; i < pages.length; i++) {
      const body = $('.pbody', pages[i]);
      if (!body) continue;
      const br = $(':scope > .pbreak', body);
      if (br && br !== body.firstElementChild) {
        const next = getOrCreatePage(i + 1);
        const nb = $('.pbody', next);
        const moving = [];
        let n = br;
        while (n) { moving.push(n); n = n.nextElementSibling; }
        const before = nb.firstElementChild;
        moving.forEach(m => nb.insertBefore(m, before));
        pages = list();
      }
    }
  }
  // 2) overflow -> move blocks to next page (with paragraph split)
  {
    let pages = list();
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      const body = $('.pbody', pg);
      if (!body) continue;
      let guard = 80;
      while (overflowTok(pg) > 1 && guard-- > 0) {
        const last = body.lastElementChild;
        if (!last) break;
        if (body.children.length === 1) {
          // lone block: split or bleed
          if (last.scrollHeight > body.clientHeight) {
            const rest = splitBlockToFit(last, body.clientHeight);
            if (rest) { $('.pbody', getOrCreatePage(i + 1)).insertBefore(rest, $('.pbody', getOrCreatePage(i + 1)).firstElementChild); pages = list(); continue; }
            pg.classList.add('bleed');
          }
          break;
        }
        pg.classList.remove('bleed');
        const nb = $('.pbody', getOrCreatePage(i + 1));
        nb.insertBefore(last, nb.firstElementChild);
        pages = list();
        // if the moved block alone overfills the next page, split it down
        if (nb.children.length === 1 && nb.scrollHeight > nb.clientHeight + 1) {
          const rest = splitBlockToFit(last, nb.clientHeight);
          if (rest) {
            const nb2 = $('.pbody', getOrCreatePage(i + 2));
            nb2.insertBefore(rest, nb2.firstElementChild);
            pages = list();
          }
        }
      }
    }
  }
  // 3) pull back blocks that fit
  {
    let pages = list();
    for (let i = 0; i < pages.length - 1; i++) {
      const body = $('.pbody', pages[i]);
      if (!body) continue;
      let guard = 40;
      while (guard-- > 0) {
        pages = list();
        if (i + 1 >= pages.length) break;
        const nxtBody = $('.pbody', pages[i + 1]);
        const cand = nxtBody && nxtBody.firstElementChild;
        if (!cand || cand.classList.contains('pbreak')) break;
        body.appendChild(cand);
        if (overflowTok(pages[i]) > 1) { nxtBody.insertBefore(cand, nxtBody.firstElementChild); break; }
      }
    }
  }
  trimPages();
  } finally {
    paginating = false;
    if (paginatePending) { paginatePending = false; setTimeout(schedulePaginate, 10); }
  }
  updateAfterLayout();
}
W.paginate = paginate;

function getOrCreatePage(i) {
  const root = pagesRoot();
  let pages = $$(':scope > .page', root);
  while (pages.length <= i) {
    const pg = newPageEl();
    root.appendChild(pg);
    pages = $$(':scope > .page', root);
  }
  return pages[i];
}
function trimPages(min) {
  const pages = $$(':scope > .page', pagesRoot());
  const keep = Math.max(min || 1, 1);
  for (let i = pages.length - 1; i >= keep; i--) {
    const b = $('.pbody', pages[i]);
    const hasContent = Array.from(b.children).some(c =>
      c.classList.contains('pbreak') || c.textContent.trim() ||
      c.querySelector('img,table,svg') || c.tagName === 'IMG' || c.tagName === 'TABLE');
    if (!hasContent && !b.textContent.trim()) {
      if (document.activeElement && pages[i].contains(document.activeElement)) break;
      pages[i].remove();
    } else break;
  }
}
function splitBlockToFit(block, cap) {
  // For a text paragraph: binary search how many words fit; return remainder block or null.
  if (!/^P|H[1-4]$|BLOCKQUOTE|DIV|LI/.test(block.tagName)) return null;
  const text = block.textContent;
  if (!text.trim() || !block.firstChild) return null;
  // clone approach: split text nodes at word boundaries
  const words = text.split(/(\s+)/);
  if (words.length < 2) return null;
  let lo = 1, hi = words.length, best = 0;
  const test = el(block.tagName, { class: block.className, style: block.getAttribute('style') || '' });
  const body = block.parentNode;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    test.textContent = words.slice(0, mid).join('');
    body.insertBefore(test, block);
    const fits = body.scrollHeight <= body.clientHeight + 1;
    test.remove();
    if (fits) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (best < 1 || best >= words.length) return null;
  const head = words.slice(0, best).join('');
  const tail = words.slice(best).join('');
  const rest = el(block.tagName, { class: block.className, style: block.getAttribute('style') || '' });
  rest.textContent = tail;
  block.textContent = head;
  return rest;
}
W.splitBlockToFit = splitBlockToFit;

function updateAfterLayout() {
  renderHF(); // cached: only fills pages missing current HF content (e.g. newly created)
  fnReflow();
  updateCounts();
  updateSbPage();
  W.emit('layout');
}
W.updateAfterLayout = updateAfterLayout;

/* header/footer + PAGE fields */
let hfSig = null; // signature of the HF content last rendered into pages
function renderHF(force) {
  const h = state.hf.header || '', f = state.hf.footer || '';
  const sig = h + '' + f;
  const changed = !!force || hfSig !== sig;
  const has = !!(h || f);
  const ae = document.activeElement;
  $$('.page').forEach(pg => {
    if (changed || pg._hfSig !== sig) {
      const hd = $('.phdr', pg), ft = $('.pftr', pg);
      // never rewrite the header/footer the user is actively typing in (caret lives there)
      if (!(ae && hd.contains(ae))) hd.innerHTML = h;
      if (!(ae && ft.contains(ae))) ft.innerHTML = f;
      pg.classList.toggle('has-hf', has);
      pg._hfSig = sig;
    }
  });
  hfSig = sig;
  updateFlds();
}
W.renderHF = renderHF;
function updateFlds() {
  const pages = $$('.page');
  if (!pages.length || !pagesRoot().querySelector('[data-fld="PAGE"]')) return;
  pages.forEach((pg, i) => {
    $$('[data-fld="PAGE"]', pg).forEach(s => {
      const t = String(i + 1);
      if (s.textContent !== t) s.textContent = t;
    });
  });
}
function enterHFEdit(which) {
  app().classList.add('hf-edit');
  const pagesRootEl = pagesRoot();
  pagesRootEl.contentEditable = 'false';
  // enable editing on first page's target; others mirror
  const pgs = $$('.page');
  pgs.forEach(pg => pg.classList.add('has-hf'));
  const target = pgs.map(pg => which === 'header' ? $('.phdr', pg) : $('.pftr', pg));
  target.forEach((t, i) => {
    t.contentEditable = 'true';
    if (i === 0) {
      t.focus();
      const r = document.createRange(); r.selectNodeContents(t); r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  });
  W._hfSync = (e) => {
    if (!e.target.classList || !(e.target.classList.contains('phdr') || e.target.classList.contains('pftr'))) return;
    const isH = e.target.classList.contains('phdr');
    const html = e.target.innerHTML;
    state.hf[isH ? 'header' : 'footer'] = html;
    $$('.page').forEach(pg => {
      const t = isH ? $('.phdr', pg) : $('.pftr', pg);
      if (t !== e.target) t.innerHTML = html;
    });
    updateFlds();
    markDirty();
  };
  document.addEventListener('input', W._hfSync, true);
}
function exitHFEdit() {
  if (!app().classList.contains('hf-edit')) return;
  app().classList.remove('hf-edit');
  document.removeEventListener('input', W._hfSync, true);
  $$('.phdr,.pftr').forEach(t => {
    const isH = t.classList.contains('phdr');
    state.hf[isH ? 'header' : 'footer'] = t.innerHTML;
    t.contentEditable = 'false';
  });
  renderHF();
  pagesRoot().contentEditable = 'true';
  pagesRoot().focus();
}
W.enterHFEdit = enterHFEdit; W.exitHFEdit = exitHFEdit;

/* footnotes */
let fnSeq = 0;
function insertFootnote() {
  restoreRange();
  const s = getSelection();
  if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  r.deleteContents();
  r.collapse(false);
  const id = ++fnSeq;
  const sup = el('sup', { 'data-fn': String(id), style: 'font-size:10px' });
  r.insertNode(sup);
  const rr = document.createRange(); rr.setStartAfter(sup); rr.collapse(true);
  s.removeAllRanges(); s.addRange(rr);
  state.fnModel[id] = '';
  markDirty();
  schedulePaginate();
  setTimeout(() => {
    const fitem = pagesRoot().querySelector(`.fn-i[data-fn="${id}"] .fn-t`);
    if (fitem) placeCaretIn(fitem);
  }, 80);
}
W.insertFootnote = insertFootnote;

function fnReflow() {
  const rootEl = pagesRoot();
  // fast path: no footnote refs and no leftover footnote islands -> nothing to do
  if (!rootEl.querySelector('.pbody sup[data-fn]') && !rootEl.querySelector('.fn-i')) return;
  const pgs = $$('.page');
  const refs = [];
  pgs.forEach((pg, i) => {
    $$('.pbody sup[data-fn]', pg).forEach(s => refs.push({ s, pg: i }));
  });
  refs.forEach((r, i) => { r.s.textContent = String(i + 1); r.s.dataset.n = i + 1; });
  pgs.forEach((pg, i) => {
    const fns = $('.fns', pg);
    const mine = refs.filter(r => r.pg === i);
    const existing = {};
    $$('.fn-i', fns).forEach(fi => existing[fi.dataset.fn] = fi);
    if (!mine.length) {
      if (fns.children.length) { fns.innerHTML = ''; $('.pbody', pg).style.height = ''; }
      return;
    }
    const frag = document.createDocumentFragment();
    frag.appendChild(el('hr', { class: 'fn-r' }));
    mine.forEach((r) => {
      const id = r.s.dataset.fn;
      const num = r.s.dataset.n;
      let fitem = existing[id];
      if (!fitem) {
        fitem = el('div', { class: 'fn-i', contenteditable: 'true', 'data-fn': id });
        fitem.innerHTML = `<sup>${num}</sup><span class="fn-t">${esc(state.fnModel[id] || '')}</span>`;
      } else {
        $('sup', fitem).textContent = num;
      }
      frag.appendChild(fitem);
    });
    // preserve caret inside edited footnote
    const active = document.activeElement;
    let caretInfo = null;
    if (active && active.classList && active.classList.contains('fn-t')) {
      caretInfo = { fid: active.closest('.fn-i').dataset.fn, off: caretOffsetIn(active) };
    }
    fns.innerHTML = ''; fns.appendChild(frag);
    if (caretInfo) {
      const tgt = fns.querySelector(`.fn-i[data-fn="${caretInfo.fid}"] .fn-t`);
      if (tgt) placeCaretIn(tgt, caretInfo.off);
    }
    // reserve space
    const h = fns.offsetHeight + 8;
    $('.pbody', pg).style.height = `calc(100% - ${h}px)`;
  });
}
function caretOffsetIn(node) {
  const s = getSelection();
  if (!s.rangeCount) return 0;
  const r = s.getRangeAt(0);
  const pre = r.cloneRange(); pre.selectNodeContents(node); pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}
function placeCaretIn(node, off) {
  const s = getSelection();
  const r = document.createRange();
  let target = node;
  if (off == null) { r.selectNodeContents(node); r.collapse(false); }
  else {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let acc = 0, t, found = null;
    while ((t = walker.nextNode())) {
      if (acc + t.nodeValue.length >= off) { found = { node: t, o: off - acc }; break; }
      acc += t.nodeValue.length;
    }
    if (found) r.setStart(found.node, found.o); else { r.selectNodeContents(node); r.collapse(false); }
  }
  s.removeAllRanges(); s.addRange(r);
}

/* ============================ 5. SELECTION & FORMATTING ============================ */
let savedRange = null;
function inPages(node) {
  return node && (node === pagesRoot() || (node.nodeType === 1 ? pagesRoot().contains(node) : pagesRoot().contains(node.parentElement)));
}
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (s.rangeCount && inPages(s.anchorNode)) {
    savedRange = s.getRangeAt(0).cloneRange();
  }
  refreshStates();
});
function saveRange() {
  const s = getSelection();
  if (s.rangeCount && inPages(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
}
function restoreRange() {
  const s = getSelection();
  if (s.rangeCount && inPages(s.anchorNode)) { pagesRoot().focus(); return; }
  if (savedRange && savedRange.startContainer && inPages(savedRange.startContainer)) {
    s.removeAllRanges(); s.addRange(savedRange);
  } else {
    const body = $('.page .pbody');
    const r = document.createRange(); r.selectNodeContents(body); r.collapse(false);
    s.removeAllRanges(); s.addRange(r);
  }
  pagesRoot().focus();
}
W.restoreRange = restoreRange; W.saveRange = saveRange;

function exec(cmd, val) {
  restoreRange();
  document.execCommand('styleWithCSS', false, true);
  try { document.execCommand(cmd, false, val); } catch (e) { console.warn(e); }
  markDirty(); schedulePaginate(); saveRange();
}
W.exec = exec;

function anchorBlock() {
  const s = getSelection();
  if (!s.rangeCount || !inPages(s.anchorNode)) return null;
  let n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
  while (n && n.parentElement && !n.parentElement.classList.contains('pbody') &&
         !n.parentElement.classList.contains('fn-t') && n.parentElement.id !== 'pages') {
    if (/^(LI|TD|TH)$/.test(n.tagName)) break;
    n = n.parentElement;
  }
  return n;
}
W.anchorBlock = anchorBlock;

function selectedBlocks() {
  const s = getSelection();
  if (!s.rangeCount || !inPages(s.anchorNode)) return [];
  const r = s.getRangeAt(0);
  const out = new Set();
  const addBlockOf = n => {
    let x = n.nodeType === 1 ? n : n.parentElement;
    while (x && x.parentElement && !x.parentElement.classList.contains('pbody') && !x.parentElement.classList.contains('fn-t')) {
      if (/^(LI|TD|TH)$/.test(x.tagName)) { out.add(x); return; }
      x = x.parentElement;
    }
    if (x && (x.parentElement && x.parentElement.classList.contains('pbody'))) out.add(x);
  };
  addBlockOf(r.startContainer); addBlockOf(r.endContainer);
  // blocks fully inside selection
  const walker = document.createTreeWalker(pagesRoot(), NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => {
      if (n.parentElement && n.parentElement.classList.contains('pbody') && r.intersectsNode(n)) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    },
  });
  let n; while ((n = walker.nextNode())) out.add(n);
  return Array.from(out).sort((a, b) => a.compareDocumentPosition(b) & 2 ? 1 : -1);
}
W.selectedBlocks = selectedBlocks;

function applyToBlocks(fn) {
  saveRange();
  restoreRange();
  const blocks = selectedBlocks();
  const list = blocks.length ? blocks : [anchorBlock()].filter(Boolean);
  list.forEach(fn);
  markDirty(); schedulePaginate();
}
W.applyToBlocks = applyToBlocks;

function applyInline(styles) {
  restoreRange();
  const s = getSelection();
  if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  if (r.collapsed) {
    const span = el('span', { style: cssText(styles) }, '​');
    r.insertNode(span);
    r.setStart(span.firstChild, span.firstChild.nodeValue.length ? 1 : 0);
    r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
    schedulePaginate(); markDirty();
    return;
  }
  // wrap each text node intersecting the range
  const tw = document.createTreeWalker(pagesRoot(), NodeFilter.SHOW_TEXT, {
    acceptNode: n => (r.intersectsNode(n) && n.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = []; let n;
  while ((n = tw.nextNode())) nodes.push(n);
  const spans = [];
  nodes.forEach(tn => {
    const nr = document.createRange();
    nr.selectNodeContents(tn);
    if (tn === r.startContainer) nr.setStart(tn, r.startOffset);
    if (tn === r.endContainer) nr.setEnd(tn, r.endOffset);
    if (nr.collapsed) return; // boundary-touch only: no characters of this node are inside
    // merge into an existing pure-formatting span instead of nesting (Word replaces run properties)
    const p = tn.parentElement;
    if (p && p.tagName === 'SPAN' && !p.className && Object.keys(p.dataset).length === 0 &&
      p.childNodes.length === 1 && nr.startOffset === 0 && nr.endOffset === tn.nodeValue.length) {
      Object.entries(styles).forEach(([k, v]) => p.style.setProperty(k, v));
      spans.push(p);
      return;
    }
    const frag = nr.extractContents();
    const span = el('span', { style: cssText(styles) });
    span.appendChild(frag);
    nr.insertNode(span);
    spans.push(span);
  });
  // keep the affected text selected, like Word does after applying a font attribute
  if (spans.length) {
    const nr2 = document.createRange();
    nr2.setStartBefore(spans[0]);
    nr2.setEndAfter(spans[spans.length - 1]);
    s.removeAllRanges(); s.addRange(nr2);
  } else s.removeAllRanges();
  markDirty(); schedulePaginate(); saveRange(); refreshStates();
}
function cssText(styles) { return Object.entries(styles).map(([k, v]) => `${k}:${v}`).join(';'); }
W.applyInline = applyInline;

function caretStyle() {
  const s = getSelection();
  let n = s.rangeCount ? s.anchorNode : null;
  if (!n || !inPages(n)) return null;
  let e = n.nodeType === 1 ? n : n.parentElement;
  if (e && !e.closest('.pbody,.phdr,.pftr,.fn-t')) e = $('.page .pbody');
  return e ? getComputedStyle(e) : null;
}

function setBlockStyle(styleId) {
  const st = STYLES.find(x => x.id === styleId);
  if (!st) return;
  applyToBlocks(b => {
    // if in list item, style the list item
    const target = b.tagName === 'LI' ? b : b;
    const nn = el(st.sel === 'h1' && st.id === 'title' ? 'h1' : st.sel, { class: '' });
    nn.innerHTML = target.innerHTML;
    nn.className = st.cls;
    if (st.id === 'normal') { nn.style.cssText = ''; }
    else if (target.tagName === 'BLOCKQUOTE' && st.sel !== 'blockquote') nn.style.cssText = '';
    target.replaceWith(nn);
  });
  markGallerySel();
}
W.setBlockStyle = setBlockStyle;

function clearFormatting() {
  restoreRange();
  const s = getSelection();
  const r = s.getRangeAt(0);
  const blocks = selectedBlocks();
  const fully = blocks.every(b => r.containsNode ? r.containsNode(b) : true);
  if (!r.collapsed && !fully) {
    const text = r.toString();
    exec('insertText', text);
  }
  applyToBlocks(b => {
    const p = el('p');
    p.textContent = b.textContent;
    b.replaceWith(p);
  });
  refreshStates();
}

/* ============================ 6. COMMANDS ============================ */
function markDirty() {
  state.dirty = true;
  updateTitleState();
  if (state.autosave) debouncedSave();
}
W.markDirty = markDirty;
let saveTimer = null;
function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => W.saveDoc && W.saveDoc(true), 1200);
}

const MENU_BUILDERS = W.MENU_BUILDERS = {};

const CMDS = W.CMDS = {
  /* ---- clipboard ---- */
  paste: { exec: async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { exec('insertText', t); }
    } catch (e) {
      W.sbMsg('Clipboard unavailable - press Ctrl+V instead');
    }
  } },
  cut: { exec: () => { exec('cut'); W.cmRender && W.cmRender(); } },
  copy: { exec: () => exec('copy') },
  fpainter: { exec: (ev, btn) => W.startPainter(btn) },
  undo: { exec: () => exec('undo') },
  redo: { exec: () => exec('redo') },
  save: { exec: () => W.saveDoc && W.saveDoc() },

  /* ---- font ---- */
  font: { exec: (e, b, fam) => {
    if (!fam) return;
    restoreRange();
    const s = getSelection();
    if (s.rangeCount && !s.getRangeAt(0).collapsed) document.execCommand('fontName', false, fam);
    else applyInline({ 'font-family': `'${fam}',sans-serif` });
    W.fontInput.value = fam;
    markDirty(); schedulePaginate();
  } },
  fontsize: { exec: (e, b, pt) => {
    if (!pt) return;
    const px = Math.round(pt * PT * 100) / 100;
    applyInline({ 'font-size': px + 'px' });
    if (W.sizeInput) W.sizeInput.value = pt;
  } },
  growfont: { exec: () => bumpSize(1) },
  shrinkfont: { exec: () => bumpSize(-1) },
  changecase: { exec: (e, b) => MENU_BUILDERS.caseMenu(b) },
  clearfmt: { exec: () => clearFormatting() },
  bold: { exec: () => exec('bold') },
  italic: { exec: () => exec('italic') },
  under: { exec: () => exec('underline') },
  strike: { exec: () => exec('strikeThrough') },
  sub: { exec: () => exec('subscript') },
  sup: { exec: () => exec('superscript') },
  fontcolor: { exec: (e, b, c) => { c = c === undefined ? state.colors.fontcolor : c; applyInline({ color: c || '#000' }); } },
  highlight: { exec: (e, b, c) => {
    c = c === undefined ? (state.colors.highlight || '#FFFF00') : c;
    applyInline({ 'background-color': c || 'transparent' });
  } },
  shading: { exec: (e, b, c) => { applyToBlocks(x => { x.style.backgroundColor = c || ''; }); } },
  pagecolor: { exec: (e, b, c) => {
    state.colors.pagecolor = c || '';
    $$('.page').forEach(pg => pg.style.background = c || '#fff');
    markDirty();
  } },

  /* ---- paragraph ---- */
  bullets: { exec: () => exec('insertUnorderedList') },
  numbering: { exec: () => exec('insertOrderedList') },
  multilevel: { exec: () => { exec('insertOrderedList'); } },
  outdent: { exec: () => shiftIndent(-1) },
  indent: { exec: () => shiftIndent(1) },
  sort: { exec: () => {
    applyToBlocks(() => {});
    const body = $('.page .pbody');
    const blocks = selectedBlocks();
    if (blocks.length > 1) {
      const parent = blocks[0].parentElement;
      const sorted = blocks.slice().sort((a, b) => a.textContent.localeCompare(b.textContent));
      const anchor = blocks[0];
      sorted.forEach(b2 => { anchor.parentNode.insertBefore(b2, anchor); });
      anchor.remove();
      markDirty(); schedulePaginate();
    } else W.sbMsg('Select at least two paragraphs to sort');
  } },
  pilcrow: { exec: () => {
    state.showPara = !state.showPara;
    pagesRoot().classList.toggle('showPara', state.showPara);
    saveOpts(); refreshStates();
  } },
  alignl: { exec: () => exec('justifyLeft') },
  alignc: { exec: () => exec('justifyCenter') },
  alignr: { exec: () => exec('justifyRight') },
  alignj: { exec: () => exec('justifyFull') },
  linesp: { exec: (e, b) => MENU_BUILDERS.lineSpaceMenu(b) },
  border: { exec: (e, b) => MENU_BUILDERS.borderMenu(b) },

  /* ---- styles & editing ---- */
  style: { exec: (e, b, id) => setBlockStyle(id) },
  stylesMore: { exec: (e, anchor) => {
    const grid = el('div', { class: 'sty-grid' });
    STYLES.forEach(st => {
      const itm = el('div', { class: 'sty-item' });
      itm.appendChild(stylePreview(st));
      itm.appendChild(el('div', { class: 'sty-cap' }, esc(st.name)));
      itm.addEventListener('mousedown', ev => ev.preventDefault());
      itm.addEventListener('click', () => { closeAllPops(); setBlockStyle(st.id); });
      grid.appendChild(itm);
    });
    pop(anchor || $('.rg-launch', $('[data-panel=home]')), grid, { cls: '' });
  } },
  find: { exec: () => W.openNav('find') },
  findreplace: { exec: () => W.openNav('replace') },
  sele: { exec: (e, b) => MENU_BUILDERS.selectMenu(b) },
  selectall: { exec: () => {
    // Content-only select-all: spans the first block of the first page body to the
    // last block of the last page body — never the .page/.pbody shells, so a follow-up
    // Backspace/Delete can never delete the page structure itself.
    ensurePageStructure();
    const bodies = $$('#pages .pbody');
    const first = bodies[0], last = bodies[bodies.length - 1];
    const r = document.createRange();
    r.selectNodeContents(first);
    if (last !== first) {
      const r2 = document.createRange();
      r2.selectNodeContents(last);
      r.setEnd(r2.endContainer, r2.endOffset);
    }
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    pagesRoot().focus();
  } },

  /* ---- font/para dialogs (in app2) ---- */
  fontDlg: { exec: () => W.fontDialog && W.fontDialog() },
  paraDlg: { exec: () => W.paraDialog && W.paraDialog() },
  pageSetupDlg: { exec: () => W.pageSetupDialog && W.pageSetupDialog() },
  wordcount: { exec: () => W.wordCountDialog && W.wordCountDialog() },

  /* ---- insert ---- */
  coverpage: { exec: () => W.insertCoverPage && W.insertCoverPage() },
  blankpage: { exec: () => W.insertPageBreak(true) },
  pagebreak: { exec: () => W.insertPageBreak(false) },
  table: { exec: (e, b) => MENU_BUILDERS.tableMenu(b) },
  pictures: { exec: () => W.pickImage && W.pickImage() },
  shapes: { exec: (e, b) => MENU_BUILDERS.shapesMenu(b) },
  link: { exec: () => W.linkDialog && W.linkDialog() },
  bookmark: { exec: () => W.bookmarkDialog && W.bookmarkDialog() },
  header: { exec: (e, b) => MENU_BUILDERS.headerMenu(b) },
  footer: { exec: (e, b) => MENU_BUILDERS.footerMenu(b) },
  pageno: { exec: (e, b) => MENU_BUILDERS.pageNoMenu(b) },
  textbox: { exec: () => {
    exec('insertHTML', '<p class="tbox">Grab your reader&rsquo;s attention with a great quote from the document, or use this space to emphasize a key point. To place this text box anywhere on the page, just drag it.<br><br></p>');
  } },
  datetime: { exec: () => W.dateTimeDialog && W.dateTimeDialog() },
  textfromfile: { exec: () => W.insertTextFromFile && W.insertTextFromFile() },
  symbol: { exec: (e, b) => MENU_BUILDERS.symbolMenu(b) },
  comment: { exec: () => W.newComment && W.newComment() },

  /* ---- design ---- */
  themes: { exec: (e, b) => MENU_BUILDERS.themesMenu(b) },
  themecolors: { exec: (e, b) => MENU_BUILDERS.designColorsMenu(b) },
  themefonts: { exec: (e, b) => MENU_BUILDERS.designFontsMenu(b) },
  paraspacing: { exec: (e, b) => MENU_BUILDERS.paraSpacingMenu(b) },
  watermark: { exec: () => W.watermarkDialog && W.watermarkDialog() },
  pageborders: { exec: () => W.pageBorderDialog && W.pageBorderDialog() },

  /* ---- layout ---- */
  margins: { exec: (e, b) => MENU_BUILDERS.marginsMenu(b) },
  orient: { exec: (e, b) => MENU_BUILDERS.orientMenu(b) },
  size: { exec: (e, b) => MENU_BUILDERS.sizeMenu(b) },
  columns: { exec: (e, b) => MENU_BUILDERS.columnsMenu(b) },
  breaks: { exec: (e, b) => MENU_BUILDERS.breaksMenu(b) },

  /* ---- references ---- */
  toc: { exec: (e, b) => MENU_BUILDERS.tocMenu(b) },
  updatetoc: { exec: () => W.updateTOC && W.updateTOC() },
  footnote: { exec: () => insertFootnote() },
  shownotes: { exec: () => {
    const pgs = $$('.page');
    for (const pg of pgs) { const f = $('.fn-i', pg); if (f) { scrollToEl(f); placeCaretIn($('.fn-t', f) || f); return; } }
    W.sbMsg('No footnotes in this document');
  } },
  caption: { exec: () => W.captionDialog && W.captionDialog() },

  /* ---- review ---- */
  spelling: { exec: () => {
    state.spell = !state.spell;
    pagesRoot().spellcheck = state.spell;
    saveOpts();
    W.sbMsg(state.spell ? 'Spelling & Grammar checking on' : 'Spelling & Grammar checking off');
  } },
  newcomment: { exec: () => W.newComment && W.newComment() },
  delcomment: { exec: (e, b) => MENU_BUILDERS.delCommentMenu(b) },
  prevcomment: { exec: () => W.navComment && W.navComment(-1) },
  nextcomment: { exec: () => W.navComment && W.navComment(1) },

  /* ---- view ---- */
  vread: { exec: () => setView('read') },
  vprint: { exec: () => setView('print') },
  vweb: { exec: () => setView('web') },
  ruler: { exec: () => toggleRuler() },
  navi: { exec: () => W.openNav('headings', true) },
  zoomdlg: { exec: () => W.zoomDialog && W.zoomDialog() },
  zoom100: { exec: () => setZoom(1) },
  zoomwidth: { exec: () => setZoom('width') },

  /* ---- help ---- */
  help: { exec: () => W.helpDialog && W.helpDialog() },
  feedback: { exec: () => W.feedbackDialog && W.feedbackDialog() },
  about: { exec: () => W.aboutDialog && W.aboutDialog() },

  /* ---- draw ---- */
  inkselect: { exec: () => W.inkSet && W.inkSet('lasso') },
  inkclear: { exec: () => { state.ink.strokes = []; W.inkRender && W.inkRender(); } },
};

/* indent/outdent: manual margin stepping (0.5" = 48px) — execCommand('indent')
   shreds our .page wrapper structure, so it must never be used here */
function shiftIndent(dir) {
  const step = 48;
  applyToBlocks(b => {
    const cur = parseFloat(b.style.marginLeft) || 0;
    const next = Math.min(960, Math.max(0, cur + dir * step));
    b.style.marginLeft = next ? next + 'px' : '';
  });
}
function bumpSize(dir) {
  restoreRange();
  const cs = caretStyle();
  const cur = cs ? parseFloat(cs.fontSize) / PT : 11;
  const steps = SIZES;
  let target;
  if (dir > 0) target = steps.find(x => x > cur + 0.01) || cur + 2;
  else target = [...steps].reverse().find(x => x < cur - 0.01) || Math.max(1, cur - 2);
  CMDS.fontsize.exec(null, null, target);
}

/* format painter */
W.startPainter = (btn) => {
  if (state.painter) { state.painter = null; document.body.style.cursor = ''; refreshStates(); return; }
  const cs = caretStyle() || {};
  const blk = anchorBlock();
  state.painter = {
    font: cs.fontFamily, size: cs.fontSize, color: cs.color, bg: cs.backgroundColor,
    bold: parseInt(cs.fontWeight) >= 600, italic: cs.fontStyle === 'italic',
    u: (cs.textDecorationLine || '').includes('underline'),
    strike: (cs.textDecorationLine || '').includes('line-through'),
    align: blk ? getComputedStyle(blk).textAlign : null,
  };
  document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><path d="M4 2h10v4H4z" fill="%23fff" stroke="%23333"/><rect x="8" y="6" width="2.4" height="7" rx="1" fill="%23fff" stroke="%23333"/></svg>') 2 2, auto`;
  refreshStates();
};
function applyPainter() {
  const p = state.painter;
  if (!p) return;
  restoreRange();
  const styles = { 'font-family': p.font, 'font-size': p.size, color: p.color, 'background-color': p.bg };
  applyInline(styles);
  const want = { b: p.bold, i: p.italic, u: p.u };
  const have = {
    b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline'),
  };
  ['b', 'i', 'u'].forEach(k => {
    if (want[k] !== have[k]) exec({ b: 'bold', i: 'italic', u: 'underline' }[k]);
  });
  if (p.align) applyToBlocks(b => b.style.textAlign = p.align);
  if (!state.painterLock) { state.painter = null; document.body.style.cursor = ''; }
  refreshStates();
}

/* ============================ 7. MENUS ============================ */
MENU_BUILDERS.pasteMenu = a => pop(a, menu([
  { html: 'Keep Source Formatting <b class="kbd">K</b>', icon: 'paste', action: () => CMDS.paste.exec() },
  { html: 'Merge Formatting <b class="kbd">M</b>', icon: 'copy', action: () => CMDS.paste.exec() },
  { html: 'Text Only <b class="kbd">T</b>', icon: 'txtfile', action: () => CMDS.paste.exec() },
]));

MENU_BUILDERS.caseMenu = a => pop(a, menu([
  { label: 'Sentence case.', action: () => changeCase('sentence') },
  { label: 'lowercase', action: () => changeCase('lower') },
  { label: 'UPPERCASE', action: () => changeCase('upper') },
  { label: 'Capitalize Each Word', action: () => changeCase('title') },
  { label: 'tOGGLE cASE', action: () => changeCase('toggle') },
]));
function changeCase(mode) {
  restoreRange();
  const s = getSelection(); if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  if (r.collapsed) { W.sbMsg('Select some text first'); return; }
  let t = r.toString();
  const fn = {
    sentence: x => x.toLowerCase().replace(/(^\s*\w|[.?!]\s+\w)/g, c => c.toUpperCase()),
    lower: x => x.toLowerCase(), upper: x => x.toUpperCase(),
    title: x => x.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    toggle: x => x.replace(/[a-z]/gi, c => c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()),
  }[mode](t);
  exec('insertText', fn);
}

MENU_BUILDERS.underMenu = a => pop(a, menu([
  { html: 'Single underline', icon: 'under', action: () => exec('underline') },
  { html: '<span style="text-decoration:underline double">Double underline</span>', action: () => applyInline({ 'text-decoration-line': 'underline', 'text-decoration-style': 'double' }) },
  { html: '<span style="text-decoration:underline dotted">Dotted underline</span>', action: () => applyInline({ 'text-decoration-line': 'underline', 'text-decoration-style': 'dotted' }) },
  { html: '<span style="text-decoration:underline wavy">Wavy underline</span>', action: () => applyInline({ 'text-decoration-line': 'underline', 'text-decoration-style': 'wavy' }) },
  'sep',
  { label: 'Remove Underline', action: () => applyInline({ 'text-decoration-line': 'none' }) },
]));

MENU_BUILDERS.effectsMenu = a => pop(a, menu([
  { html: '<span>No effect</span>', action: () => applyInline({ 'text-shadow': 'none' }) },
  { html: '<span style="text-shadow:0 0 5px #4472C4;color:#2B579A;font-size:15px">Glow (Blue)</span>', action: () => applyInline({ 'text-shadow': '0 0 5px #4472C4' }) },
  { html: '<span style="text-shadow:0 0 5px #ED7D31;color:#C55A11;font-size:15px">Glow (Orange)</span>', action: () => applyInline({ 'text-shadow': '0 0 5px #ED7D31' }) },
  { html: '<span style="text-shadow:2px 2px 3px rgba(0,0,0,.45);font-size:15px">Soft Shadow</span>', action: () => applyInline({ 'text-shadow': '2px 2px 3px rgba(0,0,0,.45)' }) },
]));

MENU_BUILDERS.bulletMenu = a => pop(a, menu([
  { html: '<span style="font-size:15px">&bull; &nbsp;Bullet</span>', check: true, action: () => exec('insertUnorderedList') },
  { html: '<span style="font-size:15px">&#9702; &nbsp;Hollow bullet</span>', action: () => { exec('insertUnorderedList'); applyToBlocks(b => { const ul = b.closest('ul') || (b.tagName === 'UL' ? b : null); if (ul) ul.style.listStyleType = 'circle'; }); } },
  { html: '<span style="font-size:15px">&#9642; &nbsp;Square bullet</span>', action: () => { exec('insertUnorderedList'); applyToBlocks(b => { const ul = b.tagName === 'UL' ? b : b.closest('ul'); if (ul) ul.style.listStyleType = 'square'; }); } },
  'sep',
  { label: 'Remove Bullets', icon: 'close', action: () => { document.execCommand('insertUnorderedList'); } },
]));

MENU_BUILDERS.numberMenu = a => pop(a, menu([
  { html: '1. &nbsp;2. &nbsp;3.', action: () => { exec('insertOrderedList'); setListType('decimal'); } },
  { html: 'a. &nbsp;b. &nbsp;c.', action: () => { exec('insertOrderedList'); setListType('lower-alpha'); } },
  { html: 'A. &nbsp;B. &nbsp;C.', action: () => { exec('insertOrderedList'); setListType('upper-alpha'); } },
  { html: 'i. &nbsp;ii. &nbsp;iii.', action: () => { exec('insertOrderedList'); setListType('lower-roman'); } },
  { html: 'I. &nbsp;II. &nbsp;III.', action: () => { exec('insertOrderedList'); setListType('upper-roman'); } },
  'sep',
  { label: 'Remove Numbering', icon: 'close', action: () => exec('insertOrderedList') },
]));
function setListType(t) {
  applyToBlocks(b => {
    const list = b.tagName === 'OL' ? b : b.closest('ol');
    if (list) list.style.listStyleType = t;
  });
}

MENU_BUILDERS.multiMenu = a => pop(a, menu([
  { html: '<b>1.</b> Heading<br>&nbsp;&nbsp;&nbsp;&nbsp;<b>1.1</b> Item<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>1.1.1</b> Sub item', action: () => { exec('insertOrderedList'); W.sbMsg('Use Increase/Decrease Indent to change list level'); } },
]));

MENU_BUILDERS.lineSpaceMenu = a => {
  const items = ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'].map(v => ({
    label: v, action: () => applyToBlocks(b => b.style.lineHeight = v),
  }));
  items.push('sep');
  items.push({ label: 'Line Spacing Options...', icon: 'dlg', action: () => W.paraDialog && W.paraDialog() });
  pop(a, menu(items));
};

MENU_BUILDERS.borderMenu = a => pop(a, menu([
  { label: 'Bottom Border', action: () => bordersApply(['bottom']) },
  { label: 'Top Border', action: () => bordersApply(['top']) },
  { label: 'Left Border', action: () => bordersApply(['left']) },
  { label: 'Right Border', action: () => bordersApply(['right']) },
  { label: 'No Border', icon: 'close', action: () => applyToBlocks(b => { b.style.border = ''; }) },
  'sep',
  { label: 'All Borders', action: () => bordersApply(['all']) },
  { label: 'Outside Borders', action: () => bordersApply(['outside']) },
  { label: 'Inside Horizontal Borders', action: () => bordersApply(['inside']) },
]));
function bordersApply(kind) {
  applyToBlocks((b, i, arr) => {
    const sides = kind[0] === 'all' || kind[0] === 'outside' ? ['Top', 'Right', 'Bottom', 'Left'] :
      kind.map(k => k[0].toUpperCase() + k.slice(1));
    if (kind[0] === 'inside') { b.style.borderTop = i > 0 ? '1px solid #000' : ''; return; }
    sides.forEach(s => b.style['border' + s] = '1px solid #000');
  });
}

MENU_BUILDERS.selectMenu = a => pop(a, menu([
  { label: 'Select All', note: 'Ctrl+A', action: () => CMDS.selectall.exec() },
  { label: 'Select All Text', action: () => CMDS.selectall.exec() },
  { label: 'Select Text with Similar Formatting', action: () => {
    const cs = caretStyle(); if (!cs) return;
    const fam = cs.fontFamily, size = cs.fontSize, col = cs.color;
    const hits = [];
    const tw = document.createTreeWalker(pagesRoot(), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const cs2 = getComputedStyle(n.parentElement);
      if (cs2.fontFamily === fam && cs2.fontSize === size && cs2.color === col) {
        const r = document.createRange(); r.selectNodeContents(n); hits.push(r);
      }
    }
    const s = getSelection(); s.removeAllRanges();
    hits.slice(0, 100).forEach(r => { try { s.addRange(r); } catch (e) {} });
    W.sbMsg(`${hits.length} instance(s) with similar formatting selected`);
  } },
]));

/* ---- Insert menus ---- */
MENU_BUILDERS.tableMenu = a => {
  const wrap = el('div', { class: 'tgrid' });
  const lab = el('div', { class: 'tg-lab' }, 'Insert Table');
  const grid = el('div', { class: 'tg-grid' });
  const cells = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
    const cell = el('div', { class: 'tgc' });
    cell.dataset.r = r; cell.dataset.c = c;
    grid.appendChild(cell); cells.push(cell);
  }
  wrap.appendChild(lab); wrap.appendChild(grid);
  grid.addEventListener('mousemove', e => {
    if (!e.target.classList.contains('tgc')) return;
    const r = +e.target.dataset.r, c = +e.target.dataset.c;
    cells.forEach(x => x.classList.toggle('hot', +x.dataset.r <= r && +x.dataset.c <= c));
    lab.textContent = `${c + 1} x ${r + 1} Table`;
  });
  grid.addEventListener('click', e => {
    if (!e.target.classList.contains('tgc')) return;
    const rows = +e.target.dataset.r + 1, cols = +e.target.dataset.c + 1;
    closeAllPops();
    W.insertTable(rows, cols);
  });
  const more = menu([{ label: 'Insert Table...', icon: 'table', action: () => {
    W.numberDialog && W.numberDialog('Insert Table', [{ k: 'cols', label: 'Number of columns:', val: 5 }, { k: 'rows', label: 'Number of rows:', val: 2 }], v => W.insertTable(v.rows, v.cols));
  } }]);
  wrap.appendChild(el('div', { class: 'msep' }));
  wrap.appendChild(more);
  pop(a, wrap);
};
W.insertTable = (rows, cols) => {
  let html = '<table><tbody>';
  for (let r = 0; r < rows; r++) { html += '<tr>' + '<td>&nbsp;</td>'.repeat(cols) + '</tr>'; }
  html += '</tbody></table><p><br></p>';
  exec('insertHTML', html);
  restoreRange();
  schedulePaginate();
};

MENU_BUILDERS.shapesMenu = a => {
  const shapes = [
    { icon: 'shapeset', label: 'Rectangle', svg: '<rect x="8" y="18" width="124" height="64" />' },
    { icon: 'sellipse', label: 'Oval', svg: '<ellipse cx="70" cy="50" rx="62" ry="34" />' },
    { icon: 'stri', label: 'Triangle', svg: '<path d="M70 14 132 86 H8 Z" />' },
    { icon: 'sarrow', label: 'Right Arrow', svg: '<path d="M8 38 h76 v-16 l48 28 -48 28 v-16 h-76 z" />' },
    { icon: 'sstar', label: 'Star', svg: '<path d="M70 6 l17 36 40 5 -29 27 8 39 -36 -19 -36 19 8 -39 -29 -27 40 -5 z" />' },
    { icon: 'sline', label: 'Line', svg: '<path d="M8 80 L132 20" />' },
  ];
  pop(a, menu(shapes.map(s => ({ icon: s.icon, label: s.label, action: () => {
    exec('insertHTML', `<p><svg width="140" height="95" viewBox="0 0 140 95" style="vertical-align:top"><g fill="none" stroke="#4472C4" stroke-width="2.5" stroke-linejoin="round">${s.svg}</g></svg><br></p><p><br></p>`);
  } }))));
};

MENU_BUILDERS.headerMenu = a => pop(a, menu([
  { label: 'Blank (Edit Header)', icon: 'header', action: () => enterHFEdit('header') },
  { label: 'Remove Header', icon: 'close', action: () => { state.hf.header = ''; renderHF(); markDirty(); } },
]));
MENU_BUILDERS.footerMenu = a => pop(a, menu([
  { label: 'Blank (Edit Footer)', icon: 'footer', action: () => enterHFEdit('footer') },
  { label: 'Remove Footer', icon: 'close', action: () => { state.hf.footer = ''; renderHF(); markDirty(); } },
]));
MENU_BUILDERS.pageNoMenu = a => pop(a, menu([
  { hdr: 1, label: 'Bottom of Page' },
  { label: 'Plain Number 1 (Left)', action: () => { state.hf.footer = '<p style="text-align:left"><span data-fld="PAGE">1</span></p>'; renderHF(); markDirty(); } },
  { label: 'Plain Number 2 (Centered)', action: () => { state.hf.footer = '<p style="text-align:center"><span data-fld="PAGE">1</span></p>'; renderHF(); markDirty(); } },
  { label: 'Plain Number 3 (Right)', action: () => { state.hf.footer = '<p style="text-align:right"><span data-fld="PAGE">1</span></p>'; renderHF(); markDirty(); } },
  'sep',
  { hdr: 1, label: 'Top of Page' },
  { label: 'Plain Number 1 (Left)', action: () => { state.hf.header = '<p style="text-align:left"><span data-fld="PAGE">1</span></p>'; renderHF(); markDirty(); } },
  { label: 'Plain Number 2 (Centered)', action: () => { state.hf.header = '<p style="text-align:center"><span data-fld="PAGE">1</span></p>'; renderHF(); markDirty(); } },
  { label: 'Plain Number 3 (Right)', action: () => { state.hf.header = '<p style="text-align:right"><span data-fld="PAGE">1</span></p>'; renderHF(); markDirty(); } },
]));

const COMMON_SYMS = ['\u00A9', '\u00AE', '\u2122', '\u00A7', '\u00B6', '\u00B0', '\u00B1', '\u00D7', '\u00F7', '\u2260', '\u2264', '\u2265', '\u221E', '\u2248', '\u221A', '\u2211', '\u03B1', '\u03B2', '\u03B3', '\u0394', '\u03C0', '\u03A9', '\u00B5', '\u20AC', '\u00A3', '\u00A5', '\u20B9', '\u2190', '\u2191', '\u2192', '\u2193', '\u2194', '\u2022', '\u2026', '\u2013', '\u2014', '\u2018', '\u2019', '\u201C', '\u201D', '\u2713', '\u2714', '\u2605', '\u2606', '\u2660', '\u2663', '\u2665', '\u2666', '\u00AB', '\u00BB'];
MENU_BUILDERS.symbolMenu = a => {
  const wrap = el('div');
  const g = el('div', { class: 'sym-grid' });
  COMMON_SYMS.forEach(ch => {
    const c = el('div', { class: 'sym-c', title: 'U+' + ch.codePointAt(0).toString(16).toUpperCase() }, ch);
    c.addEventListener('mousedown', e => e.preventDefault());
    c.addEventListener('click', () => { closeAllPops(); exec('insertText', ch); });
    g.appendChild(c);
  });
  wrap.appendChild(g);
  const more = el('div', { class: 'mi', style: 'margin-top:2px' }, `<span class="chk"></span><span>More Symbols...</span>`);
  more.addEventListener('click', () => { closeAllPops(); W.symbolsDialog && W.symbolsDialog(); });
  wrap.appendChild(more);
  pop(a, wrap);
};

MENU_BUILDERS.dateFormats = null;

/* ---- Design menus ---- */
MENU_BUILDERS.themesMenu = a => pop(a, menu([
  { label: 'Office', check: state.themeName !== 'facet' && state.themeName !== 'ion' && state.themeName !== 'board', action: () => W.applyTheme('office') },
  { label: 'Facet (green)', action: () => W.applyTheme('facet') },
  { label: 'Ion (blue)', action: () => W.applyTheme('ion') },
  { label: 'Boardroom (wine)', action: () => W.applyTheme('board') },
]));
MENU_BUILDERS.designColorsMenu = a => pop(a, menu([
  { label: 'Office (Blue #2E74B5)', action: () => W.applyThemeColor('#2E74B5') },
  { label: 'Red (#C00000)', action: () => W.applyThemeColor('#C00000') },
  { label: 'Green (#538135)', action: () => W.applyThemeColor('#538135') },
  { label: 'Purple (#7030A0)', action: () => W.applyThemeColor('#7030A0') },
  { label: 'Gold (#BF8F00)', action: () => W.applyThemeColor('#BF8F00') },
  { label: 'Black (#000000)', action: () => W.applyThemeColor('#000000') },
]));
MENU_BUILDERS.designFontsMenu = a => pop(a, menu([
  { label: 'Calibri Light / Calibri', action: () => W.applyThemeFonts("'Calibri Light','Calibri',sans-serif", "'Calibri','Carlito',sans-serif") },
  { label: 'Cambria / Calibri', action: () => W.applyThemeFonts("'Cambria','Georgia',serif", "'Calibri','Carlito',sans-serif") },
  { label: 'Georgia / Georgia', action: () => W.applyThemeFonts("'Georgia',serif", "'Georgia',serif") },
  { label: 'Arial / Arial', action: () => W.applyThemeFonts("'Arial',sans-serif", "'Arial',sans-serif") },
  { label: 'Times New Roman', action: () => W.applyThemeFonts("'Times New Roman',serif", "'Times New Roman',serif") },
]));
MENU_BUILDERS.paraSpacingMenu = a => pop(a, menu([
  { label: 'Default', action: () => pagesRoot().className = pagesRoot().className.replace(/ps-\w+/g, '').trim() },
  { label: 'Compact', action: () => setParaSpacing('compact') },
  { label: 'Open', action: () => setParaSpacing('open') },
]));
function setParaSpacing(v) {
  const r = pagesRoot();
  r.classList.remove('ps-compact', 'ps-open');
  if (v) r.classList.add('ps-' + v);
}

/* ---- Layout menus ---- */
MENU_BUILDERS.marginsMenu = a => {
  const m = (name, inch) => ({ label: `${name} - ${inch.map(x => x + '"').join(', ')}`, note: 'T,R,B,L', action: () => W.setMargins(inch.map(x => x * 96)) });
  const cur = state.margins;
  pop(a, menu([
    { hdr: 1, label: `Last Custom Setting: ${(cur.t / 96).toFixed(2)}" ${(cur.r / 96).toFixed(2)}" ${(cur.b / 96).toFixed(2)}" ${(cur.l / 96).toFixed(2)}"` },
    m('Normal', [1, 1, 1, 1]),
    m('Narrow', [0.5, 0.5, 0.5, 0.5]),
    m('Moderate', [1, 0.75, 1, 0.75]),
    m('Wide', [1, 2, 1, 2]),
    'sep',
    { label: 'Custom Margins...', icon: 'dlg', action: () => W.pageSetupDialog && W.pageSetupDialog() },
  ]));
};
MENU_BUILDERS.orientMenu = a => pop(a, menu([
  { label: 'Portrait', check: state.pageSize.w < state.pageSize.h, action: () => W.setOrientation('portrait') },
  { label: 'Landscape', check: state.pageSize.w > state.pageSize.h, action: () => W.setOrientation('landscape') },
]));
MENU_BUILDERS.sizeMenu = a => pop(a, menu([
  { label: 'Letter (8.5" x 11")', check: state.pageSize.name === 'Letter', action: () => W.setPageSize('Letter', 8.5, 11) },
  { label: 'Legal (8.5" x 14")', check: state.pageSize.name === 'Legal', action: () => W.setPageSize('Legal', 8.5, 14) },
  { label: 'A4 (8.27" x 11.69")', check: state.pageSize.name === 'A4', action: () => W.setPageSize('A4', 8.27, 11.69) },
  { label: 'A5 (5.83" x 8.27")', check: state.pageSize.name === 'A5', action: () => W.setPageSize('A5', 5.83, 8.27) },
  { label: 'Executive (7.25" x 10.5")', check: state.pageSize.name === 'Executive', action: () => W.setPageSize('Executive', 7.25, 10.5) },
]));
MENU_BUILDERS.columnsMenu = a => pop(a, menu([
  { label: 'One', check: true, action: () => setColumns(1) },
  { label: 'Two', action: () => setColumns(2) },
  { label: 'Three', action: () => setColumns(3) },
]));
function setColumns(n) {
  saveRange();
  if (n === 1) {
    selectedBlocks().forEach(b => {
      const col = b.closest('.cols2,.cols3');
      if (col) { Array.from(col.children).forEach(c => col.parentNode.insertBefore(c, col)); col.remove(); }
    });
    markDirty(); schedulePaginate();
    return;
  }
  const blocks = selectedBlocks();
  if (!blocks.length) { W.sbMsg('Select paragraphs to format in columns'); return; }
  const wrap = el('div', { class: n === 2 ? 'cols2' : 'cols3' });
  blocks[0].parentNode.insertBefore(wrap, blocks[0]);
  blocks.forEach(b => wrap.appendChild(b));
  wrap.normalize();
  markDirty(); schedulePaginate();
}
W.setColumns = setColumns;

MENU_BUILDERS.breaksMenu = a => pop(a, menu([
  { label: 'Page Break', icon: 'pagebreak', note: 'Ctrl+Enter', action: () => W.insertPageBreak(false) },
]));

MENU_BUILDERS.tocMenu = a => pop(a, menu([
  { label: 'Automatic Table 1', note: '"Contents"', action: () => W.insertTOC('Contents') },
  { label: 'Automatic Table 2', note: '"Table of Contents"', action: () => W.insertTOC('Table of Contents') },
  'sep',
  { label: 'Remove Table of Contents', icon: 'close', action: () => { const t = $('.toc', pagesRoot()); if (t) { t.remove(); schedulePaginate(); markDirty(); } } },
]));

MENU_BUILDERS.delCommentMenu = a => pop(a, menu([
  { label: 'Delete Comment', action: () => W.deleteComment && W.deleteComment() },
  { label: 'Delete All Comments Shown', action: () => W.deleteAllComments && W.deleteAllComments() },
  { label: 'Delete All Comments in Document', action: () => W.deleteAllComments && W.deleteAllComments() },
]));

/* ============================ 8. STATUS BAR / RULERS / ZOOM / VIEWS ============================ */
function pageText() {
  const clone = pagesRoot().cloneNode(true);
  $$('.wm,.fns,.pborder,.phdr,.pftr,.ink-layer,.cm-rail', clone).forEach(n => n.remove());
  return clone.textContent || '';
}
function docStats() {
  const t = pageText();
  const words = (t.match(/\S+/g) || []).length;
  const paras = $$('.pbody > p, .pbody > h1, .pbody > h2, .pbody > h3, .pbody > h4, .pbody > blockquote, .pbody > li').filter(p => p.textContent.trim()).length;
  return {
    pages: $$('.page').length,
    words,
    chars: t.replace(/\s/g, '').length,
    charsSpaces: t.length,
    paras,
    lines: $$('.page').length ? Math.round(($$('.pbody').reduce((a, b) => a + b.scrollHeight, 0)) / 15.84) : 0,
  };
}
W.docStats = docStats;

let countsTimer = null;
function updateCounts() {
  clearTimeout(countsTimer);
  countsTimer = setTimeout(() => {
    const st = docStats();
    $('#sb-words').textContent = 'Words: ' + st.words;
    updateSbPage();
  }, 150);
}
W.updateCounts = updateCounts;

function updateSbPage() {
  const s = getSelection();
  const pages = $$('.page');
  let cur = 1;
  if (s.rangeCount && inPages(s.anchorNode)) {
    const pg = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('.page');
    if (pg) cur = pages.indexOf(pg) + 1;
  } else {
    for (const pg of pages) {
      if (pg.getBoundingClientRect().bottom > 120) { cur = pages.indexOf(pg) + 1; break; }
    }
  }
  $('#sb-pages').textContent = `Page ${cur} of ${pages.length}`;
}
W.updateSbPage = updateSbPage;

W.sbMsg = txt => {
  const m = $('#sb-msg');
  m.textContent = txt;
  clearTimeout(W._sbT);
  W._sbT = setTimeout(() => { m.textContent = ''; }, 4000);
};

/* zoom */
function setZoom(z) {
  if (z === 'width') {
    const cw = $('#doc-scroll').clientWidth - 140;
    z = clamp(cw / state.pageSize.w, 0.1, 5);
  }
  state.zoom = clamp(z, 0.1, 5);
  pagesRoot().style.zoom = state.zoom;
  $('#z-slider').value = Math.round(state.zoom * 100);
  $('#z-pct').textContent = Math.round(state.zoom * 100) + '%';
  drawRulers(); W.emit('layout');
}
W.setZoom = setZoom;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* rulers */
function drawRulers() {
  const show = state.ruler && state.view === 'print';
  $('#hr-wrap').style.visibility = show ? '' : 'hidden';
  $('#vr-wrap').style.visibility = show ? '' : 'hidden';
  $('.hr-corner').style.visibility = show ? '' : 'hidden';
  if (!show) return;
  const z = state.zoom;
  const w = state.pageSize.w * z, h = state.pageSize.h * z;
  const ml = state.margins.l * z, mr = w - state.margins.r * z;
  const hi = $('#hr-inner');
  hi.innerHTML = ''; hi.style.width = Math.max(w, 1) + 'px';
  hi.appendChild(el('div', { class: 'hr-band', style: `left:0;width:${ml}px` }));
  hi.appendChild(el('div', { class: 'hr-band', style: `left:${mr}px;width:${Math.max(w - mr, 0)}px` }));
  buildTicks(hi, w, z, false);
  const vi = $('#vr-inner');
  vi.innerHTML = ''; vi.style.height = Math.max(h, 1) + 'px';
  buildTicks(vi, h, z, true);
}
function buildTicks(host, lenPx, z, vert) {
  const inch = 96 * z;
  for (let d = 0; d <= lenPx - 0.5; d += inch / 8) {
    const major = Math.abs(d / inch - Math.round(d / inch)) < 0.01;
    const half = Math.abs(d / (inch / 2) - Math.round(d / (inch / 2))) < 0.01;
    const t = el('div', { class: 'hr-tick' });
    const size = major ? 8 : half ? 6 : 4;
    if (vert) { t.style.top = d + 'px'; t.style.width = size + 'px'; }
    else { t.style.left = d + 'px'; t.style.height = size + 'px'; }
    host.appendChild(t);
    if (major && Math.round(d / inch) > 0 && Math.round(d / inch) < Math.round(lenPx / inch)) {
      const n = el('div', { class: 'hr-num' }, String(Math.round(d / inch)));
      if (vert) n.style.top = d + 'px'; else n.style.left = d + 'px';
      host.appendChild(n);
    }
  }
}
function syncRulerPos() {
  if (!state.ruler) return;
  const pg = $('.page'); if (!pg) return;
  const pr = pg.getBoundingClientRect();
  const hr = $('#hr-wrap').getBoundingClientRect();
  $('#hr-inner').style.left = (pr.left - hr.left) + 'px';
  const vr = $('#vr-wrap').getBoundingClientRect();
  $('#vr-inner').style.top = (pr.top - vr.top) + 'px';
}
W.drawRulers = drawRulers; W.syncRulerPos = syncRulerPos;

function toggleRuler() {
  state.ruler = !state.ruler;
  drawRulers(); saveOpts(); refreshStates();
}

/* views */
function setView(v) {
  state.view = v;
  app().classList.toggle('reading', v === 'read');
  app().classList.toggle('weblayout', v === 'web');
  $('#vw-read').classList.toggle('vw-act', v === 'read');
  $('#vw-print').classList.toggle('vw-act', v === 'print');
  $('#vw-web').classList.toggle('vw-act', v === 'web');
  if (v === 'web') { pagesRoot().style.zoom = 1; } else { pagesRoot().style.zoom = state.zoom; }
  if (v === 'read') W.ensureReadBar && W.ensureReadBar();
  drawRulers();
  schedulePaginate();
  setTimeout(() => { drawRulers(); W.emit('layout'); }, 30);
}
W.setView = setView;

/* ============================ 9. FIND & REPLACE ============================ */
let npMode = null, matches = [], cur = -1, navHeadMode = false;
function openNav(mode, toggle) {
  const pane = $('#navpane');
  const toggleSame = (npMode === (mode === 'headings' ? 'headings' : npMode));
  if (toggle && !pane.hidden && navHeadMode === (mode === 'headings')) { pane.hidden = true; navHeadMode = false; refreshStates(); return; }
  navHeadMode = mode === 'headings';
  npMode = mode;
  const withReplace = mode === 'replace';
  pane.innerHTML = `
    <div class="np-head"><b>${withReplace ? 'Replace' : (navHeadMode ? 'Navigation' : 'Search')}</b>
      <button class="np-x">${svgIcon('close')}</button></div>
    <div class="np-tabs" ${navHeadMode ? 'hidden' : ''}>
      <button class="np-tab act">Results</button>
      <button class="np-tab">Find</button>
      ${withReplace ? '<button class="np-tab act">Replace</button>' : ''}
    </div>
    ${navHeadMode ? '' : `
    <div class="np-search">${svgIcon('search')}<input type="text" placeholder="${withReplace ? 'Find what' : 'Search document'}">
      <span class="np-sbtns"><button class="np-up" title="Previous">&#8963;</button><button class="np-dn" title="Next">&#8964;</button></span></div>
    ${withReplace ? '<div class="np-replace"><input type="text" placeholder="Replace with"></div>' +
      '<div class="np-rbtns"><button class="btn np-rep">Replace</button><button class="btn np-repall">Replace All</button></div>' : ''}
    <div class="np-count"></div>`}
    <div class="np-list"></div>`;
  pane.hidden = false;
  $('.np-x', pane).addEventListener('click', () => { pane.hidden = true; navHeadMode = false; clearMarks(); refreshStates(); });
  // tabs: Results shows the list; Find keeps just the search box; Replace with UI stays
  $$('.np-tab', pane).forEach(t => {
    if (!withReplace && !navHeadMode && t.textContent === 'Replace') t.remove();
    t.addEventListener('click', () => {
      $$('.np-tab', pane).forEach(x => x.classList.remove('act'));
      t.classList.add('act');
      const list = $('.np-list', pane);
      const showList = t.textContent === 'Results' || t.textContent === 'Replace';
      if (list) list.style.display = showList ? '' : 'none';
      if (t.textContent === 'Find') { const inp2 = $('.np-search input', pane); if (inp2) inp2.focus(); }
    });
  });
  if (navHeadMode) { buildHeadings(); refreshStates(); return; }
  const inp = $('.np-search input', pane);
  inp.addEventListener('input', () => runFind(inp.value));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.shiftKey ? goto(cur - 1) : goto(cur + 1); } e.stopPropagation(); });
  $('.np-up', pane).addEventListener('click', () => goto(cur - 1));
  $('.np-dn', pane).addEventListener('click', () => goto(cur + 1));
  inp.focus();
  if (withReplace) {
    const rin = $('.np-replace input', pane);
    rin.addEventListener('keydown', e => e.stopPropagation());
    $('.np-rep', pane).addEventListener('click', () => replaceCurrent(rin.value));
    $('.np-repall', pane).addEventListener('click', () => replaceAll(inp.value, rin.value));
  }
  refreshStates();
}
W.openNav = openNav;

function buildHeadings() {
  const list = $('.np-list', $('#navpane'));
  const hs = $$('.pbody h1,.pbody h2,.pbody h3,.pbody h4');
  if (!hs.length) { list.innerHTML = '<div class="np-count" style="padding:10px 14px">No headings yet. Apply Heading 1-3 from Styles to build an outline.</div>'; return; }
  list.innerHTML = '';
  hs.forEach(h => {
    const lvl = +h.tagName[1];
    const it = el('div', { class: 'np-item', style: `padding-left:${12 + (lvl - 1) * 14}px` });
    it.innerHTML = `<span class="h-t">H${lvl}</span> ${esc(h.textContent || '(empty)')}`;
    it.addEventListener('click', () => scrollToEl(h));
    list.appendChild(it);
  });
}

function clearMarks() {
  $$('mark.fnd', pagesRoot()).forEach(m => {
    const t = document.createTextNode(m.textContent);
    m.replaceWith(t);
  });
  pagesRoot().normalize();
  matches = []; cur = -1;
}
function runFind(q) {
  clearMarks();
  const pane = $('#navpane');
  if (!q) { $('.np-count', pane).textContent = ''; $('.np-list', pane).innerHTML = ''; return; }
  const ql = q.toLowerCase();
  const bodies = $$('.pbody');
  for (const body of bodies) {
    const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement.closest('mark.fnd,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = []; let n;
    while ((n = tw.nextNode())) nodes.push(n);
    for (const tn of nodes) {
      let idx = 0;
      const low = tn.nodeValue.toLowerCase();
      const hits = [];
      while ((idx = low.indexOf(ql, idx)) !== -1) { hits.push(idx); idx += ql.length; }
      if (!hits.length) continue;
      let node = tn;
      for (let i = 0; i < hits.length; i++) {
        const rel = hits[i] - (node !== tn ? 0 : 0) ;
        // recompute against current node (it shrinks as we split)
        const pos = node.nodeValue.toLowerCase().indexOf(ql);
        if (pos === -1) break;
        const after = node.splitText(pos);
        const rest = after.nodeValue.length > ql.length ? after.splitText(ql.length) : null;
        const mark = el('mark', { class: 'fnd' });
        after.parentNode.insertBefore(mark, after);
        mark.appendChild(after);
        matches.push(mark);
        node = rest;
        if (!node) break;
      }
    }
  }
  const list = $('.np-list', pane);
  list.innerHTML = '';
  matches.forEach((m, i) => {
    const ctx = m.parentElement ? m.parentElement.textContent.trim() : '';
    const it = el('div', { class: 'np-item' });
    it.innerHTML = `<span class="h-t">Result ${i + 1}</span><br>${esc(trunc(ctx, 90))}`;
    it.addEventListener('click', () => goto(i));
    list.appendChild(it);
  });
  $('.np-count', pane).textContent = matches.length ? `${matches.length} result(s)` : 'No results';
  if (matches.length) goto(0);
}
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '...' : s;
function goto(i) {
  if (!matches.length) return;
  cur = ((i % matches.length) + matches.length) % matches.length;
  matches.forEach((m, k) => m.classList.toggle('cur', k === cur));
  const pane = $('#navpane');
  $('.np-count', pane).textContent = `Result ${cur + 1} of ${matches.length}`;
  $$('.np-item', pane).forEach((it, k) => it.classList.toggle('act', k === cur));
  scrollToEl(matches[cur]);
  const it = $$('.np-item', pane)[cur];
  if (it) it.scrollIntoView({ block: 'nearest' });
}
function scrollToEl(n) {
  n.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
W.scrollToEl = scrollToEl;

function replaceCurrent(withText) {
  if (cur < 0 || !matches[cur]) return;
  const m = matches[cur];
  m.replaceWith(document.createTextNode(withText));
  runFind($('.np-search input', '#navpane').value);
}
function replaceAll(q, withText) {
  if (!q) return;
  clearMarks();
  const ql = q.toLowerCase();
  const tw = document.createTreeWalker(pagesRoot(), NodeFilter.SHOW_TEXT);
  const nodes = []; let n;
  while ((n = tw.nextNode())) {
    if (n.parentElement.closest('mark,script,style')) continue;
    nodes.push(n);
  }
  let count = 0;
  for (const tn of nodes) {
    let low = tn.nodeValue.toLowerCase(), pos;
    while ((pos = low.indexOf(ql)) !== -1) {
      tn.nodeValue = tn.nodeValue.slice(0, pos) + withText + tn.nodeValue.slice(pos + q.length);
      low = tn.nodeValue.toLowerCase();
      count++;
    }
  }
  markDirty(); schedulePaginate();
  W.sbMsg(`Replaced ${count} occurrence(s)`);
  runFind('');
  $('.np-count', $('#navpane')).textContent = count ? `All done. ${count} replacement(s) made.` : '';
}
W.replaceAll = replaceAll;

/* ============================ 10. EVENTS: INPUT, KEYS, PASTE, CONTEXT ============================ */
function bindEditor() {
  const root = pagesRoot();
  root.addEventListener('input', e => {
    // footnote island edits
    if (e.target.classList && e.target.classList.contains('fn-t')) {
      const f = e.target.closest('.fn-i');
      state.fnModel[f.dataset.fn] = e.target.textContent;
      markDirty(); return;
    }
    if (e.target.classList && e.target.classList.contains('fn-i')) { markDirty(); return; }
    ensureAfterEdit();
    markDirty();
    schedulePaginate();
    clearEmptyMarkClusters();
  });
  root.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a && (e.ctrlKey || e.metaKey)) { window.open(a.href, '_blank'); e.preventDefault(); }
    const img = e.target.closest('img');
    selectImage(img);
    if (state.painter) applyPainter();
    W.cmRefresh && W.cmRefresh();
  });
  root.addEventListener('beforeinput', e => {
    if (app().classList.contains('hf-edit')) return;
    if (/^delete/.test(e.inputType) || e.inputType === 'deleteByCut' || e.inputType === 'deleteByDrag') {
      if (guardStructuralDelete(e)) return;
    } else if (/^insert/.test(e.inputType) || e.inputType === 'insertCompositionText') {
      clampCaretForInsert();
    }
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    }
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Tab') handleTabKey(e);
  });
  root.addEventListener('paste', onPaste);
  root.addEventListener('drop', onDrop);
  root.addEventListener('dragover', e => e.preventDefault());
  root.addEventListener('contextmenu', onContextMenu);
  root.addEventListener('dblclick', e => {
    if (e.target.closest('.phdr,.pftr')) return;
    // double click near top/bottom margin opens header/footer
    const pg = e.target.closest('.page');
    if (!pg) return;
    if (e.target.closest('.pbody')) return;
    const y = (e.clientY - pg.getBoundingClientRect().top) / state.zoom;
    if (y < state.margins.t) { enterHFEdit('header'); }
    else if (y > state.pageSize.h - state.margins.b) { enterHFEdit('footer'); }
  });
  $('#doc-scroll').addEventListener('scroll', () => {
    requestAnimationFrame(syncRulerPos);
    updateSbPage();
  });
  window.addEventListener('resize', () => { drawRulers(); syncRulerPos(); W.emit('layout'); });
}

function ensureAfterEdit() {
  const root = pagesRoot();
  ensurePageStructure();  // rebuilds any missing .page/.pbody/bands and <p><br></p>
  // repair: stray top-level nodes (transplant into page 0's body)
  Array.from(root.childNodes).forEach(n => {
    if (n.classList && n.classList.contains('page')) return;
    const body = $('.page .pbody', root);
    if (!body) return;
    if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) {
      body.appendChild(el('p', null, esc(n.nodeValue))); n.remove();
    } else if (n.nodeType === 1) {
      body.appendChild(n);
    } else if (n.nodeType === Node.TEXT_NODE) n.remove();
  });
  $$('.page .pbody').forEach(b => {
    if (!b.firstElementChild && !b.textContent) b.innerHTML = '<p><br></p>';
    Array.from(b.childNodes).forEach(n => {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        const p = el('p', null, esc(n.nodeValue)); b.replaceChild(p, n);
      } else if (n.nodeType === 3) n.remove();
    });
  });
  rescueCaret();
  updateCounts();
}
/* If the caret points at a deleted node / the #pages shell itself / a .page wrapper,
   re-plant it at the end of the last body so typing always lands in real text. */
function rescueCaret() {
  const s = getSelection();
  if (!s.rangeCount) return;
  const n = s.anchorNode;
  const broken = !n || !document.contains(n) || n === pagesRoot() ||
    (n.nodeType === 1 && n.classList && n.classList.contains('page'));
  if (!broken) return;
  const bodies = $$('#pages .pbody');
  const b = bodies[bodies.length - 1];
  const tgt = (b && b.lastElementChild) || b;
  if (!tgt) return;
  const r = document.createRange(); r.selectNodeContents(tgt); r.collapse(false);
  s.removeAllRanges(); s.addRange(r);
}
function setCaretAt(node, off) {
  const s = getSelection();
  const r = document.createRange();
  try {
    r.setStart(node, Math.min(off, (node.childNodes || []).length));
    r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
    pagesRoot().focus();
  } catch (e) { }
}
function notifyEdited() {
  ensureAfterEdit(); markDirty(); schedulePaginate(); clearEmptyMarkClusters();
}
/* Structural deletion guards: the editable host is #pages (it must be, for multi-page
   editing), so default browser deletes can erase .pbody/.page shells. We intercept any
   destructive beforeinput that would leave a single body, plus cross-page merges. */
function _blockOf(body, node) {
  let n = node.nodeType === 1 ? node : node.parentNode;
  while (n && n.parentNode !== body) { if (n === document.body) return null; n = n.parentNode; }
  return n && n.nodeType === 1 ? n : null;
}
function rangeAtBlockStart(block, r) {
  const q = document.createRange();
  try { q.selectNodeContents(block); q.setEnd(r.startContainer, r.startOffset); } catch (e) { return false; }
  return !q.toString() && !q.cloneContents().querySelector('img,table,hr,svg,br,ul,ol,p,h1,h2,h3,h4,blockquote');
}
function rangeAtBlockEnd(block, r) {
  const q = document.createRange();
  try { q.selectNodeContents(block); q.setStart(r.endContainer, r.endOffset); } catch (e) { return false; }
  return !q.toString() && !q.cloneContents().querySelector('img,table,hr,svg,br,ul,ol,p,h1,h2,h3,h4,blockquote');
}
function firstBodyBlock(b) {
  return Array.from(b.children).find(c => !/(^| )(wm|pborder|phdr|pftr|fns)( |$)/.test(c.className || '')) || null;
}
function mergeBlockIntoPrevPage(body, block, bodies) {
  const i = bodies.indexOf(body);
  if (i <= 0) return;                     // document start: Word does nothing here
  const prev = bodies[i - 1];
  const preLast = prev.lastElementChild;
  if (preLast && /^(P|DIV|H[1-6]|BLOCKQUOTE)$/.test(preLast.tagName) && /^(P|DIV|H[1-6]|BLOCKQUOTE)$/.test(block.tagName)) {
    const seam = preLast.childNodes.length;
    while (block.firstChild) preLast.appendChild(block.firstChild);
    block.remove();
    if (preLast.tagName === 'P' && !preLast.textContent && !preLast.querySelector('img,br')) preLast.innerHTML = '<br>';
    setCaretAt(preLast, seam);
  } else {
    prev.appendChild(block);
    setCaretAt(block, 0);
  }
  notifyEdited();
}
function mergeBlockFromNextPage(body, block, bodies) {
  const i = bodies.indexOf(body);
  if (i < 0 || i >= bodies.length - 1) return;      // document end: nothing
  const nxt = bodies[i + 1];
  const nb = firstBodyBlock(nxt);
  if (!nb) return;
  if (/^(P|DIV|H[1-6]|BLOCKQUOTE)$/.test(block.tagName) && /^(P|DIV|H[1-6]|BLOCKQUOTE)$/.test(nb.tagName)) {
    const seam = block.childNodes.length;
    while (nb.firstChild) block.appendChild(nb.firstChild);
    nb.remove();
    setCaretAt(block, seam);
  } else {
    body.appendChild(nb);
    setCaretAt(block, block.childNodes.length);
  }
  notifyEdited();
}
function manualDeleteAcross(r, bodies) {
  const touched = bodies.filter(b => { try { return r.intersectsNode(b); } catch (e) { return false; } });
  if (!touched.length) return;
  const first = touched[0], last = touched[touched.length - 1];
  touched.forEach((b, idx) => {
    const sub = document.createRange();
    if (touched.length === 1) { sub.setStart(r.startContainer, r.startOffset); sub.setEnd(r.endContainer, r.endOffset); }
    else if (idx === 0) { sub.selectNodeContents(b); sub.setStart(r.startContainer, r.startOffset); }
    else if (idx === touched.length - 1) { sub.selectNodeContents(b); sub.setEnd(r.endContainer, r.endOffset); }
    else sub.selectNodeContents(b);
    sub.deleteContents();   // Range.deleteContents preserves the containers themselves
  });
  let caret = null;
  if (first !== last) {
    const hb = first.lastElementChild, tb = last.firstElementChild;
    if (hb && tb && /^(P|DIV)/.test(hb.tagName) && /^(P|DIV)/.test(tb.tagName)) {
      const seam = hb.childNodes.length;
      while (tb.firstChild) hb.appendChild(tb.firstChild);
      tb.remove();
      caret = { node: hb, off: seam };
    } else if (hb) caret = { node: hb, off: hb.childNodes.length };
  }
  // pages left with truly empty bodies (no text/media/page-break) are removed
  $$('.page').forEach(pg => {
    const b = $('.pbody', pg);
    if (b && $$('.page').length > 1 && !b.textContent.trim() && !b.querySelector('img,table,svg,.pbreak')) pg.remove();
  });
  notifyEdited();
  if (caret && document.contains(caret.node)) setCaretAt(caret.node, caret.off);
}
function guardStructuralDelete(e) {
  const s = getSelection();
  if (!s.rangeCount) return false;
  const r = s.getRangeAt(0);
  // never interfere with header/footer/footnote band editing
  const an = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  if (an && an.closest && an.closest('.phdr,.pftr,.fns')) return false;
  const bodies = $$('#pages .pbody');
  if (!bodies.length) { e.preventDefault(); ensureAfterEdit(); return true; }
  const inB = n => bodies.find(b => b.contains(n));
  if (!r.collapsed) {
    const sb = inB(r.startContainer), eb = inB(r.endContainer);
    if (!sb || !eb || sb !== eb) {
      e.preventDefault();
      if (e.inputType === 'deleteByCut') { try { document.execCommand('copy'); } catch (err) { } }
      manualDeleteAcross(r, bodies);
      return true;
    }
    return false; // strictly inside one body: containers are preserved, safe
  }
  const b = inB(r.startContainer);
  if (!b) { e.preventDefault(); rescueCaret(); return true; }
  const block = _blockOf(b, r.startContainer);
  const back = /Backward/.test(e.inputType);
  if (block && block.previousElementSibling && block.previousElementSibling.classList.contains('pbreak')) {
    if (back && rangeAtBlockStart(block, r)) {
      e.preventDefault(); block.previousElementSibling.remove(); setCaretAt(block, 0); notifyEdited(); return true;
    }
  }
  const nx = block && block.nextElementSibling;
  if (nx && nx.classList && nx.classList.contains('pbreak') && !back && rangeAtBlockEnd(block, r)) {
    e.preventDefault(); nx.remove(); setCaretAt(block, block.childNodes.length); notifyEdited(); return true;
  }
  if (back && block && block === firstBodyBlock(b) && rangeAtBlockStart(block, r)) {
    e.preventDefault(); mergeBlockIntoPrevPage(b, block, bodies); return true;
  }
  if (!back && block && block === b.lastElementChild && rangeAtBlockEnd(block, r)) {
    e.preventDefault(); mergeBlockFromNextPage(b, block, bodies); return true;
  }
  return false;
}
function clampCaretForInsert() {
  const s = getSelection();
  const n = s.rangeCount ? s.anchorNode : null;
  const elx = n && (n.nodeType === 1 ? n : n.parentElement);
  if (elx && document.contains(elx) && elx.closest && elx.closest('.pbody,.phdr,.pftr,.fn-t')) return;
  const bodies = $$('#pages .pbody');
  if (!bodies.length) { ensurePageStructure(); return; }
  const b = bodies[bodies.length - 1];
  const tgt = b.lastElementChild || b;
  const r = document.createRange(); r.selectNodeContents(tgt); r.collapse(false);
  s.removeAllRanges(); s.addRange(r);
  pagesRoot().focus();
}
function clearEmptyMarkClusters() {
  // unwrap empty anchors
  const root = pagesRoot();
  if (!root.querySelector('.cm-anchor')) return;
  $$('.cm-anchor', root).forEach(a => { if (!a.textContent) a.remove(); });
}

function handleTabKey(e) {
  const s = getSelection(); if (!s.rangeCount) return;
  let n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
  const td = n && n.closest ? n.closest('td') : null;
  if (!td) {
    // Normal text: Word inserts a tab stop (the browser default would yank focus
    // OUT of the page). Insert an atomic tab spacer via Range (execCommand's
    // insertHTML would strip the class), then park the caret after it.
    e.preventDefault();
    if (n && n.closest && n.closest('li') && !app().classList.contains('hf-edit')) {
      exec(e.shiftKey ? 'outdent' : 'indent'); markDirty(); schedulePaginate(); return;
    }
    const sel = getSelection(); if (!sel.rangeCount) return;
    const rng = sel.getRangeAt(0); rng.deleteContents();
    const sp = el('span', { class: 'wtab' }, '\u00A0\u00A0\u00A0\u00A0');
    rng.insertNode(sp);
    // Chromium's whitespace rebalancing drags typing back inside a bare span at
    // the caret boundary — a zero-width-space text node after the spacer makes a
    // stable, invisible landing pad. Exporters strip \u200B.
    const pad = document.createTextNode('\u200B');
    sp.after(pad);
    sel.setBaseAndExtent(pad, 1, pad, 1);
    markDirty(); schedulePaginate();
    return;
  }
  e.preventDefault();
  const tr = td.parentElement;
  const table = td.closest('table');
  if (e.shiftKey) {
    const prev = td.previousElementSibling || (tr.previousElementSibling && tr.previousElementSibling.lastElementChild);
    if (prev) placeCaretIn(prev);
    return;
  }
  const next = td.nextElementSibling;
  if (next) { placeCaretIn(next); return; }
  const ncol = tr.children.length;
  const ntr = el('tr', null, '<td>&nbsp;</td>'.repeat(ncol));
  if (tr.nextElementSibling) tr.nextElementSibling.after(ntr); else tr.parentElement.appendChild(ntr);
  placeCaretIn(ntr.firstElementChild);
  markDirty(); schedulePaginate();
}

const SANITIZE_KEEP = new Set(['P','DIV','BR','B','STRONG','I','EM','U','S','STRIKE','SUB','SUP','SPAN','FONT','UL','OL','LI','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TD','TH','IMG','A','HR','CENTER','PRE','CODE','MARK']);
function sanitizeNode(n) {
  if (n.nodeType === Node.TEXT_NODE) return;
  if (n.nodeType !== Node.ELEMENT_NODE) { n.remove(); return; }
  if (!SANITIZE_KEEP.has(n.tagName)) {
    const frag = document.createDocumentFragment();
    while (n.firstChild) frag.appendChild(n.firstChild);
    n.replaceWith(frag);
    return;
  }
  Array.from(n.attributes).forEach(a => {
    const nm = a.name.toLowerCase();
    if (nm.startsWith('on') || nm === 'id' || nm.startsWith('data-mso')) n.removeAttribute(a.name);
    if (nm === 'class' && !/^(wtab|pbreak|fns|fn-r|toc)$/.test(n.className)) n.removeAttribute('class');
    if (nm === 'style') {
      n.style.cssText = n.style.cssText.replace(/mso-[^:]+:[^;]+;?/g, '').replace(/position\s*:[^;]+;?/g, '');
    }
    if (nm === 'src' && !/^data:|^https?:|^blob:/.test(n.src)) n.removeAttribute('src');
  });
  Array.from(n.childNodes).forEach(sanitizeNode);
}
function onPaste(e) {
  const cd = e.clipboardData;
  if (!cd) return;
  if (cd.files && cd.files.length) {
    e.preventDefault();
    Array.from(cd.files).filter(f => f.type.startsWith('image/')).forEach(f => {
      const rd = new FileReader();
      rd.onload = () => exec('insertHTML', `<img src="${rd.result}" style="max-width:100%"><p></p>`);
      rd.readAsDataURL(f);
    });
    return;
  }
  const html = cd.getData('text/html');
  if (html) {
    e.preventDefault();
    const tmp = el('div', null, html);
    Array.from(tmp.childNodes).forEach(sanitizeNode);
    const clean = tmp.innerHTML;
    if (clean.trim()) exec('insertHTML', clean);
    else exec('insertText', cd.getData('text/plain'));
  }
}
function onDrop(e) {
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) {
    e.preventDefault();
    Array.from(dt.files).forEach(f => {
      if (f.type.startsWith('image/')) {
        const rd = new FileReader();
        rd.onload = () => exec('insertHTML', `<img src="${rd.result}" style="max-width:100%"><p></p>`);
        rd.readAsDataURL(f);
      } else if (/text|\.txt|\.md/.test(f.type) || /\.(txt|md)$/i.test(f.name)) {
        const rd = new FileReader();
        rd.onload = () => insertPlainText(rd.result);
        rd.readAsText(f);
      }
    });
  }
}
function insertPlainText(t) {
  const paras = t.replace(/\r\n?/g, '\n').split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join('');
  exec('insertHTML', paras);
}
W.insertPlainText = insertPlainText;

/* image selection + resize */
let imgSel = null;
function selectImage(img) {
  if (imgSel && imgSel.img !== img) imgSel.box.remove(), imgSel = null;
  if (!img) { if (imgSel) { imgSel.box.remove(); imgSel = null; } return; }
  positionImageHandles(img);
  if (!imgSel) {
    const box = el('div', { class: 'img-handles' });
    const dot = el('div', { class: 'h-dot' });
    box.appendChild(dot);
    $('#docwrap').appendChild(box);
    imgSel = { img, box, dot };
    dot.addEventListener('pointerdown', e0 => {
      e0.preventDefault();
      const z = pagesRoot().style.zoom ? state.zoom : state.zoom;
      const startW = img.getBoundingClientRect().width / state.zoom;
      const sx = e0.clientX;
      const mv = e => {
        const w = Math.max(20, startW + (e.clientX - sx) / state.zoom);
        img.style.width = w + 'px';
        positionImageHandles(img);
      };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); markDirty(); schedulePaginate(); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
  } else imgSel.img = img;
}
function positionImageHandles(img) {
  if (imgSel) positionImageHandlesTick(img);
}
function positionImageHandlesTick(img) {
  if (!imgSel || !document.contains(img)) { if (imgSel) { imgSel.box.remove(); imgSel = null; } return; }
  const r = img.getBoundingClientRect();
  const w = $('#docwrap').getBoundingClientRect();
  imgSel.box.style.left = (r.left - w.left) + 'px';
  imgSel.box.style.top = (r.top - w.top) + 'px';
  imgSel.box.style.width = r.width + 'px';
  imgSel.box.style.height = r.height + 'px';
}
document.addEventListener('scroll', () => { if (imgSel) positionImageHandlesTick(imgSel.img); }, true);
W.on('layout', () => { if (imgSel) positionImageHandlesTick(imgSel.img); });

/* context menu */
function onContextMenu(e) {
  e.preventDefault();
  const items = [];
  items.push({ label: 'Cut', icon: 'cut', action: () => CMDS.cut.exec() });
  items.push({ label: 'Copy', icon: 'copy', action: () => CMDS.copy.exec() });
  items.push({ label: 'Paste', icon: 'paste', action: () => CMDS.paste.exec() });
  items.push('sep');
  const td = e.target.closest && e.target.closest('td');
  if (td) {
    const table = td.closest('table');
    items.push({ label: 'Insert Rows Above', action: () => tableRows(table, td.parentElement, 'before') });
    items.push({ label: 'Insert Rows Below', action: () => tableRows(table, td.parentElement, 'after') });
    items.push({ label: 'Insert Columns Left', action: () => tableCols(table, td, 'before') });
    items.push({ label: 'Insert Columns Right', action: () => tableCols(table, td, 'after') });
    items.push('sep');
    items.push({ label: 'Delete Row', action: () => { td.parentElement.remove(); if (!table.querySelector('tr')) table.remove(); markDirty(); schedulePaginate(); } });
    items.push({ label: 'Delete Column', action: () => tableDelCol(table, td) });
    items.push({ label: 'Delete Table', action: () => { table.remove(); markDirty(); schedulePaginate(); } });
    items.push('sep');
  }
  const a = e.target.closest && e.target.closest('a[href]');
  if (a) {
    items.push({ label: 'Open Hyperlink', action: () => window.open(a.href, '_blank') });
    items.push({ label: 'Edit Hyperlink...', action: () => W.linkDialog && W.linkDialog(a) });
    items.push({ label: 'Remove Hyperlink', action: () => { a.replaceWith(...a.childNodes); markDirty(); } });
    items.push('sep');
  }
  const img = e.target.closest && e.target.closest('img');
  if (img) {
    items.push({ label: 'Insert Caption...', action: () => W.captionDialog && W.captionDialog(img) });
    items.push({ label: 'Size and Position...', action: () => W.imgSizeDialog && W.imgSizeDialog(img) });
    items.push('sep');
  }
  items.push({ label: 'Font...', icon: 'achar', action: () => W.fontDialog && W.fontDialog() });
  items.push({ label: 'Paragraph...', icon: 'linesp', action: () => W.paraDialog && W.paraDialog() });
  const m = menu(items.filter(Boolean));
  pop(null, m, { x: e.clientX, y: e.clientY });
}
function tableRows(table, tr, where) {
  const ncol = tr.children.length;
  const ntr = el('tr', null, '<td>&nbsp;</td>'.repeat(ncol));
  if (where === 'before') tr.before(ntr); else tr.after(ntr);
  markDirty(); schedulePaginate();
}
function tableCols(table, td, where) {
  const idx = Array.from(td.parentElement.children).indexOf(td);
  $$(':scope > tbody > tr, :scope > tr', table).forEach(tr => {
    const c = el('td', null, '&nbsp;');
    if (where === 'before') tr.insertBefore(c, tr.children[idx] || null);
    else tr.insertBefore(c, tr.children[idx + 1] || null);
  });
  markDirty(); schedulePaginate();
}
function tableDelCol(table, td) {
  const idx = Array.from(td.parentElement.children).indexOf(td);
  $$(':scope > tbody > tr, :scope > tr', table).forEach(tr => { if (tr.children[idx]) tr.children[idx].remove(); });
  markDirty(); schedulePaginate();
}

/* insert page break: splits the current block at the caret (like Word) */
W.insertPageBreak = (wholeBlank) => {
  restoreRange();
  const marker = el('div', { class: 'pbreak' });
  let b = anchorBlock();
  // breaks act on top-level blocks; inside tables/lists, go beyond the container
  if (b && /^(TD|TH|LI)$/.test(b.tagName)) {
    let x = b;
    while (x.parentElement && !x.parentElement.classList.contains('pbody')) x = x.parentElement;
    b = x;
  }
  if (wholeBlank || !b) {
    if (b) b.after(marker, el('p', null, '<br>'));
    else { const body = $('.page .pbody'); body.appendChild(marker); body.appendChild(el('p', null, '<br>')); }
  } else {
    const s = getSelection();
    if (s.rangeCount && inPages(s.anchorNode) && !s.getRangeAt(0).collapsed) s.getRangeAt(0).deleteContents();
    if (s.rangeCount && inPages(s.anchorNode)) {
      const r = s.getRangeAt(0);
      const tail = r.cloneRange();
      tail.selectNodeContents(b);
      tail.setStart(r.endContainer, r.endOffset);
      const frag = tail.extractContents();
      const p2 = el(b.tagName, { class: b.className || '' });
      if (b.getAttribute('style')) p2.setAttribute('style', b.getAttribute('style'));
      p2.appendChild(frag);
      b.after(marker, p2);
      if (!b.textContent.trim() && !b.querySelector('img,table,svg')) b.remove();
      if (!p2.textContent && !p2.childElementCount) p2.innerHTML = '<br>';
      placeCaretIn(p2);
    } else {
      b.after(marker, el('p', null, '<br>'));
    }
  }
  markDirty(); schedulePaginate();
};

/* insert cover page */
W.insertCoverPage = () => {
  const first = getOrCreatePage(0);
  const body = $('.pbody', first);
  const cover = el('div', { class: 'cover' });
  cover.innerHTML =
    `<p class="sty-title" style="margin-top:180px">Document Title</p>` +
    `<p class="sty-subtitle">Document Subtitle</p>` +
    `<p style="margin-top:60px;color:#5A5A5A">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` +
    `<p style="color:#5A5A5A">Author Name</p>`;
  cover.appendChild(el('div', { class: 'pbreak' }));
  body.insertBefore(cover, body.firstChild);
  markDirty(); schedulePaginate();
};

/* TOC */
W.insertTOC = (title) => {
  const old = $('.toc', pagesRoot());
  const headings = $$('.pbody h1,.pbody h2,.pbody h3').filter(h => !(h.closest && h.closest('.toc')));
  const toc = el('div', { class: 'toc' });
  let html = `<div class="toc-t">${esc(title)}</div>`;
  if (!headings.length) html += '<p style="color:#8A8886">No headings found. Apply Heading 1, 2 or 3 styles to include entries in the table of contents.</p>';
  headings.forEach(h => {
    const pg = h.closest('.page');
    const idx = $$('.page').indexOf(pg) + 1;
    const lvl = +h.tagName[1];
    html += `<div class="toc-l toc-l${lvl}"><span>${esc(h.textContent)}</span><span class="dots"></span><span>${idx}</span></div>`;
  });
  toc.innerHTML = html;
  if (old) { old.after(toc); old.remove(); }
  else {
    const body = $('.page .pbody');
    body.insertBefore(toc, body.firstChild);
  }
  const p = el('p', null, '<br>');
  toc.after(p);
  markDirty(); schedulePaginate();
};
W.updateTOC = () => {
  const t = $('.toc', pagesRoot());
  if (!t) { W.sbMsg('No table of contents in this document'); return; }
  W.insertTOC($('.toc-t', t).textContent || 'Contents');
};

/* ============================ state refresh ============================ */
function refreshStates() {
  if (W._comboFocus) { /* don't fight the typing in combos */ }
  const s = document.getSelection();
  const inside = s.rangeCount && inPages(s.anchorNode);
  const q = c => { try { return document.queryCommandState(c); } catch (e) { return false; } };
  const cs = inside ? caretStyle() : null;
  $$('[data-toggle]').forEach(b => {
    const t = b.dataset.toggle;
    let on = false;
    if (t === 'pilcrow') on = state.showPara;
    else if (t === 'ruler') on = state.ruler;
    else if (t.startsWith('ink:')) on = state.ink && state.ink.tool === t.slice(4);
    else if (t === 'navpane') on = navHeadMode && !$('#navpane').hidden;
    else if (inside) {
      if (['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript',
           'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(t)) on = q(t);
      // reconcile with computed style (format painter / dialog applied CSS)
      if (t === 'bold' && cs) on = on || parseInt(cs.fontWeight) >= 600;
      if (t === 'italic' && cs) on = on || cs.fontStyle === 'italic';
      if (t === 'underline' && cs) on = on || (cs.textDecorationLine || '').includes('underline');
      if (t === 'strikeThrough' && cs) on = on || (cs.textDecorationLine || '').includes('line-through');
      if (t === 'subscript' && cs) on = on || cs.verticalAlign === 'sub';
      if (t === 'superscript' && cs) on = on || cs.verticalAlign === 'super';
      if (t.startsWith('justify') && anchorBlock()) {
        const al = getComputedStyle(anchorBlock()).textAlign;
        on = (t === 'justifyLeft' && (al === 'left' || al === 'start')) ||
             (t === 'justifyCenter' && al === 'center') ||
             (t === 'justifyRight' && (al === 'right' || al === 'end')) ||
             (t === 'justifyFull' && al === 'justify');
      }
    }
    b.classList.toggle('active', !!on);
  });
  if (W.fontInput && W.sizeInput && !W._comboFocus && inside && cs) {
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const known = FONTS.find(f => fam.toLowerCase().includes(f.toLowerCase())) || fam;
    W.fontInput.value = known || 'Calibri';
    const pt = Math.round((parseFloat(cs.fontSize) / PT) * 10) / 10;
    W.sizeInput.value = String(pt % 1 ? pt : Math.round(pt));
  }
  if (inside) markGallerySel();
  if (W._fpaintBtn) W._fpaintBtn.classList.toggle('active', !!state.painter);
}
W.refreshStates = refreshStates;

/* title state */
function updateTitleState() {
  $('#tb-name').textContent = state.docName;
  document.title = state.docName + ' - Word';
}
W.updateTitleState = updateTitleState;

/* keyboard shortcuts */
function bindShortcuts() {
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (app().classList.contains('reading') && e.key === 'Escape') { setView('print'); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); CMDS.save.exec(); return; }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); W.print ? W.print() : window.print(); return; }
    if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); openNav('find'); return; }
    if (mod && e.key.toLowerCase() === 'h') { e.preventDefault(); openNav('replace'); return; }
    if (mod && e.key.toLowerCase() === 'a') {
      if (document.activeElement && (pagesRoot().contains(document.activeElement) || app().classList.contains('hf-edit'))) {
        e.preventDefault(); CMDS.selectall.exec();
      }
      return;
    }
    if (mod && e.key === 'Enter') { e.preventDefault(); W.insertPageBreak(false); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); exec('redo'); return; }
    if (mod && e.key.toLowerCase() === 'l') { if (!packagesEditable()) return; e.preventDefault(); exec('justifyLeft'); }
    if (mod && e.key.toLowerCase() === 'e') { if (!packagesEditable()) return; e.preventDefault(); exec('justifyCenter'); }
    if (mod && e.key.toLowerCase() === 'r') { if (!packagesEditable()) return; e.preventDefault(); exec('justifyRight'); }
    if (mod && e.key.toLowerCase() === 'j') { if (!packagesEditable()) return; e.preventDefault(); exec('justifyFull'); }
    if (mod && e.shiftKey && e.code === 'Digit8') { e.preventDefault(); CMDS.pilcrow.exec(); }
    if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); setZoom(state.zoom + 0.1); }
    if (mod && e.key === '-' && !e.shiftKey) { e.preventDefault(); setZoom(state.zoom - 0.1); }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); exec('underline'); }
    if (e.key === 'F1') { e.preventDefault(); W.helpDialog && W.helpDialog(); }
    if (e.altKey && e.key.toLowerCase() === 'q') { e.preventDefault(); $('#tellme').click(); }
  });
  document.addEventListener('wheel', e => {
    if ((e.ctrlKey || e.metaKey) && e.target.closest('.doc-scroll')) {
      e.preventDefault();
      setZoom(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }
  }, { passive: false });
}
function packagesEditable() {
  const ae = document.activeElement;
  return ae && (pagesRoot().contains(ae) || ae.closest && !!ae.closest('.phdr,.pftr,.fn-t'));
}

/* ============================ boot ============================ */
let initialized = false;
W.init = function () {
  if (initialized) return;
  initialized = true;
  W.activeTab = 'home';
  buildRibbon();
  bindEditor();
  bindShortcuts();

  // chrome bindings
  $('#qat-save').addEventListener('click', () => CMDS.save.exec());
  $('#qat-undo').addEventListener('click', () => { restoreRange(); exec('undo'); });
  $('#qat-redo').addEventListener('click', () => { restoreRange(); exec('redo'); });
  $('#ribtoggle').addEventListener('click', () => app().classList.toggle('rib-collapsed'));
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'F1') app().classList.toggle('rib-collapsed'); });
  $('#tellme').addEventListener('click', ev => W.tellMe(ev.currentTarget));

  $('#sb-words').addEventListener('click', () => W.wordCountDialog && W.wordCountDialog());
  $('#sb-pages').addEventListener('click', () => W.goToPageDialog && W.goToPageDialog());
  $('#z-pct').addEventListener('click', () => W.zoomDialog && W.zoomDialog());
  $('#vw-read').addEventListener('click', () => setView('read'));
  $('#vw-print').addEventListener('click', () => setView('print'));
  $('#vw-web').addEventListener('click', () => setView('web'));
  const zs = $('#z-slider');
  zs.addEventListener('input', () => setZoom(+zs.value / 100));
  $('#z-in').addEventListener('click', () => setZoom(state.zoom + 0.1));
  $('#z-out').addEventListener('click', () => setZoom(state.zoom - 0.1));
  $('#hr-wrap').parentElement.addEventListener('dblclick', e => { W.pageSetupDialog && W.pageSetupDialog(); });

  // document events not covered elsewhere
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.pages') && !e.target.closest('.phdr,.pftr') && app().classList.contains('hf-edit')) exitHFEdit();
    const pane = $('#navpane');
  });
  document.addEventListener('selectionchange', () => { updateSbPage(); });

  ensurePageStructure();
  renderHF();
  updateTitleState();
  pagesRoot().spellcheck = state.spell;
  if (window.WBOOT) WBOOT();       // app2 session restore + backstage + extras
  setView('print');
  setZoom(1);
  applyChromeTheme();
  if (!state.asAppliedOnce) {}
  $('#as-pill').classList.toggle('on', state.autosave);
  $('#as-pill').addEventListener('click', () => {
    state.autosave = !state.autosave;
    $('#as-pill').classList.toggle('on', state.autosave);
    saveOpts();
    W.sbMsg('AutoSave ' + (state.autosave ? 'On' : 'Off'));
    if (state.autosave && W.saveDoc) W.saveDoc(true);
  });
  setTimeout(() => {
    paginate();
    updateCounts();
    drawRulers(); syncRulerPos();
    const first = $('.page .pbody > p');
    if (first && !pagesRoot().textContent.trim()) { pagesRoot().focus(); placeCaretIn(first); }
  }, 60);
  setTimeout(() => { drawRulers(); syncRulerPos(); }, 300);
};

function applyChromeTheme() {
  const map = { colorful: '#2B579A', silver: '#7B88A0', dark: '#232323' };
  document.documentElement.style.setProperty('--wd', state.theme in map ? map[state.theme] : state.theme || map.colorful);
  document.documentElement.style.setProperty('--wd-acc', state.theme === 'colorful' ? '#2B579A' : '#2B579A');
}
W.applyChromeTheme = applyChromeTheme;

/* keep proofing status text in sync */
W.on('layout', () => {});

})();
