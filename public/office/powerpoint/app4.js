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
   app4.js — File/Backstage (Info/New/Open/Save/Save As/Print/Export/Account/
   Options/Feedback), templates, .pptx export+import wiring, PNG export,
   print view, Tell Me, help, window buttons
   ========================================================================== */
(function () {
'use strict';
const { $, $$, el, esc, clamp, uid } = P;

/* ---------------- utilities ---------------- */
function lib() { return JSON.parse(XKV.get('pc.docs') || '{}'); }
function setLib(l) { XKV.set('pc.docs', JSON.stringify(l)); }
function opts() { return JSON.parse(XKV.get('pc.opts') || '{}'); }
function setOpts(o) { XKV.set('pc.opts', JSON.stringify(o)); }
function fmtDT(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function download(name, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
async function confirmDiscardIfDirty() {
  if (!P.state.dirty) return true;
  return await new Promise(res => {
    P.msgBox('Microsoft PowerPoint', `Want to save your changes to '${P.state.presName}'?`, {
      icon: 'warn',
      buttons: [
        { label: 'Save', pri: true, fn: () => { P.saveDoc(true); res(true); } },
        { label: "Don't Save", fn: () => res(true) },
        { label: 'Cancel', fn: () => res(false) },
      ],
    });
  });
}

/* ---------------- new presentation / open ---------------- */
function newPres(name, slides, themeOverride) {
  P.state = P.freshPres();
  P.state.presName = name || nextUntitled();
  if (themeOverride) P.state.theme = JSON.parse(JSON.stringify(themeOverride));
  P.state.slides = slides || [P.newSlide('title')];
  P.state.active = 0;
  P.applyThemeCSS();
  P.setPresName(P.state.presName, true);
  P.renderAll();
  P.pushHistory('New presentation');
  P.saveDoc(true);
}
function nextUntitled() {
  const l = lib();
  let n = 1;
  while (l['Presentation' + n]) n++;
  return 'Presentation' + n;
}
async function openPresName(name) {
  const l = lib();
  if (!l[name]) return;
  if (!(await confirmDiscardIfDirty())) return;
  const j = JSON.parse(l[name].json);
  P.loadJSON(j);
  P.setPresName(j.presName || name, true);
  P.renderAll();
  P.pushHistory('Open');
  P.sbMsg(`Opened '${name}'`);
}
async function importPptxFile(file) {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (window.PptLegacy && PptLegacy.isLegacyPpt(buf)) {
      /* legacy binary .ppt (CFB) — import slide text */
      if (!(await confirmDiscardIfDirty())) return;
      const slides = PptLegacy.slidesFromPpt(P, buf);
      P.state = P.freshPres();
      P.state.presName = file.name.replace(/\.ppt$/i, '') || 'Imported';
      P.state.slides = slides;
      P.state.active = 0;
      P.applyThemeCSS();
      P.setPresName(P.state.presName, true);
      P.layoutStage();
      P.renderAll();
      P.pushHistory('Import .ppt');
      P.sbMsg(`Imported '${file.name}'`);
      P.msgBox('Microsoft PowerPoint', `'${file.name}' is a legacy .ppt (PowerPoint 97-2003). The slide text was imported; old formatting/pictures from that format cannot be recovered and are replaced by the current theme. Save it as a modern .pptx (Ctrl+S, then Export) to keep everything.`, { icon: 'info' });
      return;
    }
    const res = await Pptx.readPptx(buf);
    if (!(await confirmDiscardIfDirty())) return;
    P.state = P.freshPres();
    P.state.presName = file.name.replace(/\.pptx?$/i, '') || 'Imported';
    if (res.theme) P.state.theme = res.theme;
    P.state.slides = res.slides;
    if (res.sizeW) { P.state.sizeW = res.sizeW; P.state.sizeH = res.sizeH; }
    P.state.active = 0;
    P.applyThemeCSS();
    P.setPresName(P.state.presName, true);
    P.layoutStage();
    P.renderAll();
    P.pushHistory('Import .pptx');
    P.sbMsg(`Imported '${file.name}'`);
  } catch (err) {
    P.msgBox('Microsoft PowerPoint', 'Sorry, this file could not be opened: ' + err.message, { icon: 'warn' });
  }
}

/* ---------------- .pptx / .png export ---------------- */
async function exportPptx() {
  P.sbMsg('Building .pptx…');
  try {
    const u8 = await Pptx.buildPptx(P.state);
    download(P.state.presName + '.pptx', new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
    P.sbMsg('Exported ' + P.state.presName + '.pptx');
  } catch (err) {
    P.msgBox('Export', 'Export failed: ' + err.message, { icon: 'warn' });
  }
}
function slideToSvgXml(slide, scale) {
  const host = document.createElement('div');
  P.renderSlideInto(host, slide, { noSel: true });
  const W = P.SW(), H = P.SH();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}">`
    + `<foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${slide.bg && slide.bg.color ? slide.bg.color : '#fff'}">${host.innerHTML}</div></foreignObject></svg>`;
}
async function exportPng(slideIdx) {
  const slide = P.state.slides[slideIdx != null ? slideIdx : P.state.active];
  const scale = 1.5;
  const svg = slideToSvgXml(slide, scale);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const dataUrl = await new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = P.SW() * scale; cv.height = P.SH() * scale;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0);
      res(cv.toDataURL('image/png'));
    };
    img.onerror = () => res(null);
    img.src = url;
  });
  if (!dataUrl) { P.msgBox('Export', 'PNG export failed in this browser.', { icon: 'warn' }); return; }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = P.state.presName + ' - Slide ' + ((slideIdx != null ? slideIdx : P.state.active) + 1) + '.png';
  document.body.appendChild(a); a.click();
  setTimeout(() => a.remove(), 400);
  P.sbMsg('Exported PNG of current slide');
}

/* ---------------- templates ---------------- */
const TEMPLATES = [
  {
    nm: 'Ion Boardroom', sub: 'Dark title bar, agenda and chart pages',
    theme: { ...P.THEMES[3].t },
    build() {
      const th = P.THEMES[3].t;
      const s1 = P.newSlide('title');
      s1.objects[0].paras = [{ runs: [P.newRun('Board Meeting', { size: 54, b: true, color: th.a1 })], align: 'c', level: 0, bullet: 'none' }];
      s1.objects[1].paras = [{ runs: [P.newRun('Quarterly Review  ·  FY26', { size: 20, color: '#595959' })], align: 'c', level: 0, bullet: 'none' }];
      const bar = P.plainObj({ kind: 'shape', shape: 'rect', x: 0, y: 0, w: 1280, h: 14, fill: { t: 'solid', c: th.a1 }, line: 'none' });
      s1.objects.push(bar);
      const s2 = P.newSlide('titleContent');
      s2.objects[0].paras = [{ runs: [P.newRun('Agenda', { b: true })], align: 'l', level: 0, bullet: 'none' }];
      s2.objects[1].paras = [
        { runs: [P.newRun('Financial results', {})], level: 0, bullet: 'char' },
        { runs: [P.newRun('Product roadmap', {})], level: 0, bullet: 'char' },
        { runs: [P.newRun('Hiring plan', {})], level: 0, bullet: 'char' },
        { runs: [P.newRun('Q&A', {})], level: 0, bullet: 'char' },
      ];
      const s3 = P.newSlide('titleContent');
      s3.objects[0].paras = [{ runs: [P.newRun('Revenue by Region', { b: true })], align: 'l', level: 0, bullet: 'none' }];
      const chart = P.plainObj({ kind: 'chart', x: 180, y: 170, w: 920, h: 470, chart: { kind: 'col', cats: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'North', vals: [4.3, 5.1, 4.8, 6.2] }, { name: 'South', vals: [2.4, 3.4, 3.8, 4.4] }, { name: 'West', vals: [2, 2.6, 3, 5] }], showTitle: false } });
      s3.objects.push(chart);
      return [s1, s2, s3];
    },
    deco(cv, th) {
      return `<div style="position:absolute;left:0;right:0;top:0;height:7%;background:${th.a1}"></div><div style="position:absolute;left:12%;top:38%;width:76%;height:10%;background:${th.a1};opacity:.9"></div><div style="position:absolute;left:20%;top:56%;width:60%;height:7%;background:#B9B9B9"></div>`;
    },
  },
  {
    nm: 'Facet Slice', sub: 'Fresh green accents with picture pages',
    theme: { ...P.THEMES[1].t },
    build() {
      const th = P.THEMES[1].t;
      const s1 = P.newSlide('title');
      s1.objects[0].paras = [{ runs: [P.newRun('Grow Together', { size: 54, b: true, color: th.a1 })], align: 'c', level: 0, bullet: 'none' }];
      s1.objects[1].paras = [{ runs: [P.newRun('Sustainability report', { size: 20, color: '#595959' })], align: 'c', level: 0, bullet: 'none' }];
      const tri = P.plainObj({ kind: 'shape', shape: 'triangle', x: 560, y: 150, w: 160, h: 120, fill: { t: 'solid', c: th.a2 }, line: 'none' });
      s1.objects.push(tri);
      const s2 = P.newSlide('twoContent');
      s2.objects[0].paras = [{ runs: [P.newRun('Two big ideas', { b: true })], align: 'l', level: 0, bullet: 'none' }];
      s2.objects[1].paras = [{ runs: [P.newRun('Plant 1M trees by 2030', {})], level: 0, bullet: 'char' }];
      s2.objects[2].paras = [{ runs: [P.newRun('Cut emissions 40%', {})], level: 0, bullet: 'char' }];
      return [s1, s2];
    },
    deco(cv, th) {
      return `<div style="position:absolute;left:44%;top:20%;width:12%;height:16%;background:${th.a2};clip-path:polygon(50% 0,100% 100%,0 100%)"></div><div style="position:absolute;left:12%;top:52%;width:76%;height:10%;background:${th.a1}"></div><div style="position:absolute;left:22%;top:68%;width:56%;height:6%;background:#B9B9B9"></div>`;
    },
  },
  {
    nm: 'Retrospect Bold', sub: 'Warm serif deck for storytelling',
    theme: { ...P.THEMES[4].t },
    build() {
      const th = P.THEMES[4].t;
      const s1 = P.newSlide('title');
      s1.bg = { color: '#F4EDE8' };
      s1.objects[0].paras = [{ runs: [P.newRun('Our Story', { size: 60, b: true, color: th.a1 })], align: 'c', level: 0, bullet: 'none' }];
      s1.objects[1].paras = [{ runs: [P.newRun('A year in review', { size: 22, i: true, color: '#776E6A' })], align: 'c', level: 0, bullet: 'none' }];
      const s2 = P.newSlide('sectionHeader');
      s2.objects[0].paras = [{ runs: [P.newRun('Chapter 1: The beginning', { b: true })], align: 'l', level: 0, bullet: 'none' }];
      s2.objects[1].paras = [{ runs: [P.newRun('Where it all started', {})], level: 0, bullet: 'none' }];
      const s3 = P.newSlide('titleContent');
      s3.objects[0].paras = [{ runs: [P.newRun('Milestones', { b: true })], align: 'l', level: 0, bullet: 'none' }];
      s3.objects[1].paras = [
        { runs: [P.newRun('January — first customer', {})], level: 0, bullet: 'char' },
        { runs: [P.newRun('April — 10,000 users', {})], level: 0, bullet: 'char' },
        { runs: [P.newRun('September — Series A', {})], level: 0, bullet: 'char' },
      ];
      return [s1, s2, s3];
    },
    deco(cv, th) {
      return `<div style="position:absolute;inset:0;background:#F4EDE8"></div><div style="position:absolute;left:18%;top:42%;width:64%;height:11%;background:${th.a1}"></div><div style="position:absolute;left:28%;top:60%;width:44%;height:6%;background:${th.a2};opacity:.7"></div>`;
    },
  },
];

/* ---------------- backstage ---------------- */
let bsOpen = null;
function openBackstage(page) {
  closeBackstage();
  const root = el('div', { class: 'bs-root' });
  const side = el('div', { class: 'bs-side' });
  const back = el('div', { class: 'bs-back', title: 'Back' }, '<svg viewBox="0 0 24 24"><path d="M15 3 L6 12 L15 21" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  back.addEventListener('click', closeBackstage);
  side.appendChild(back);
  const items = [
    ['info', 'Info'], ['new', 'New'], ['open', 'Open'], ['save', 'Save'], ['saveas', 'Save As'],
    ['print', 'Print'], ['share', 'Share'], ['export', 'Export'], ['close', 'Close'],
    ['account', 'Account'], ['feedback', 'Feedback'], ['options', 'Options'],
  ];
  const main = el('div', { class: 'bs-main' });
  items.forEach(([id, lab]) => {
    const it = el('div', { class: 'bs-it', 'data-pg': id }, esc(lab));
    it.addEventListener('click', async () => {
      if (id === 'save') { P.saveDoc(); return; }
      if (id === 'close') { closeBackstage(); if (await confirmDiscardIfDirty()) { newPres(null); } return; }
      select(id);
    });
    side.appendChild(it);
  });
  side.appendChild(el('div', { class: 'bs-foot' }, ''));
  root.appendChild(side); root.appendChild(main);
  document.body.appendChild(root);
  bsOpen = root;
  document.addEventListener('keydown', bsKey, true);
  function select(pg) {
    $$('.bs-it', side).forEach(x => x.classList.toggle('on', x.dataset.pg === pg));
    main.innerHTML = '';
    PAGES[pg] && PAGES[pg](main);
  }
  function bsKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeBackstage(); } }
  root._sel = select;
  select(page || 'info');
}
function closeBackstage() {
  if (!bsOpen) return;
  document.removeEventListener('keydown', bsKey, true);
  bsOpen.remove(); bsOpen = null;
  P.renderAll();
}
function bsKey(e) { /* replaced per-open */ }
P.openBackstage = openBackstage;
P.closeBackstage = closeBackstage;

const PAGES = {
  info(m) {
    const st = P.state;
    m.appendChild(el('div', { class: 'bs-h' }, 'Info'));
    const img = document.createElement('div');
    img.innerHTML = '<div style="width:240px;border:1px solid #D8D8D8;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>';
    const thumb = P.thumbNode(P.cur(), 240 / P.SW());
    img.firstChild.appendChild(thumb);
    m.appendChild(el('div', { style: 'display:flex;gap:26px;align-items:flex-start' },
      img,
      el('div', null,
        el('div', { style: 'font:600 15px "Segoe UI";margin-bottom:10px' }, esc(st.presName)),
        el('div', { class: 'bs-kv' }, el('span', null, 'Slides:'), el('b', null, String(st.slides.length))),
        el('div', { class: 'bs-kv' }, el('span', null, 'Size:'), el('b', null, fmtKB(JSON.stringify(P.presJSON()).length))),
        el('div', { class: 'bs-kv' }, el('span', null, 'Created:'), el('b', null, fmtDT(st.created || Date.now()))),
        el('div', { class: 'bs-kv' }, el('span', null, 'Last modified:'), el('b', null, fmtDT(st.modified || Date.now()))),
        el('div', { class: 'bs-kv' }, el('span', null, 'Theme:'), el('b', null, esc(st.theme.name || 'Office Theme'))),
        el('div', { style: 'margin-top:14px;display:flex;gap:8px' },
          mkBtn('Rename...', async () => {
            P.inputBox('Rename Presentation', 'File name:', st.presName, { onOk: v => { if (v && v.trim()) { const l = lib(); delete l[st.presName]; P.setPresName(v.trim()); P.saveDoc(true); openBackstage('info'); } } });
          }),
          mkBtn('Export .pptx', () => exportPptx())))));
  },
  new(m) {
    m.appendChild(el('div', { class: 'bs-h' }, 'New'));
    const row = el('div', { class: 'tpl-row' });
    const blank = el('div', { class: 'tpl' },
      el('div', { class: 'tpl-cv' }, '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#C43E1C"><svg viewBox="0 0 24 24" width="34" height="34"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#C43E1C" stroke-width="1.6"/><line x1="12" y1="7" x2="12" y2="17" stroke="#C43E1C" stroke-width="1.6"/><line x1="7" y1="12" x2="17" y2="12" stroke="#C43E1C" stroke-width="1.6"/></svg></div>'),
      el('div', { class: 'tpl-nm' }, 'Blank Presentation'),
      el('div', { class: 'tpl-sub' }, 'Start with a clean title slide'));
    blank.addEventListener('click', async () => { if (await confirmDiscardIfDirty()) { closeBackstage(); newPres(null); } });
    row.appendChild(blank);
    TEMPLATES.forEach(t => {
      const card = el('div', { class: 'tpl' },
        el('div', { class: 'tpl-cv' }, t.deco(null, t.theme)),
        el('div', { class: 'tpl-nm' }, esc(t.nm)),
        el('div', { class: 'tpl-sub' }, esc(t.sub)));
      card.addEventListener('click', async () => {
        if (!(await confirmDiscardIfDirty())) return;
        closeBackstage();
        newPres(t.nm.split(' ')[0] + ' Presentation', t.build(), t.theme);
        P.sbMsg('Created from template: ' + t.nm);
      });
      row.appendChild(card);
    });
    m.appendChild(row);
  },
  open(m) {
    m.appendChild(el('div', { class: 'bs-h' }, 'Open'));
    const l = lib();
    const names = Object.keys(l).sort((a, b) => (l[b].modified || 0) - (l[a].modified || 0));
    if (!names.length) m.appendChild(el('div', { style: 'color:#767171' }, 'No presentations saved yet. Ctrl+S saves to this PC.'));
    names.forEach(nm => {
      const it = l[nm];
      let slides = '?';
      try { slides = String(JSON.parse(it.json).slides.length); } catch (e) { }
      const row = el('div', { class: 'doc-row' },
        el('span', null, '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="4" width="18" height="13" rx="1.5" fill="none" stroke="#C43E1C" stroke-width="1.5"/><rect x="6" y="7" width="8" height="2.4" fill="#C43E1C"/><rect x="6" y="11" width="12" height="1.6" fill="#D8A195"/><rect x="6" y="14" width="10" height="1.6" fill="#D8A195"/><path d="M9 20.5 h6" stroke="#C43E1C" stroke-width="1.5"/></svg>'),
        el('div', null, el('div', { class: 'dn' }, esc(nm) + '.pptx'), el('div', { class: 'dm' }, `${slides} slide(s) · ${fmtKB(it.size)} · ${fmtDT(it.modified)}`)),
        (() => { const x = el('span', { class: 'dx', title: 'Delete' }, '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 6 h14 M9 6 V4 h6 v2 M7 6 l1 14 h8 l1 -14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'); x.addEventListener('click', ev => { ev.stopPropagation(); P.msgBox('Delete', `Delete '${nm}' permanently?`, { buttons: [{ label: 'Delete', pri: true, fn: () => { const l2 = lib(); delete l2[nm]; setLib(l2); openBackstage('open'); } }, { label: 'Cancel' }] }); }); return x; })());
      row.addEventListener('click', async () => { await openPresName(nm); closeBackstage(); });
      m.appendChild(row);
    });
    m.appendChild(el('div', { class: 'bs-h', style: 'margin-top:22px' }, 'Open from file'));
    const zone = el('div', { class: 'imp-zone' },
      el('div', null, '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 19 h16 M12 15 V4 M7 9 l5 -5 l5 5" fill="none" stroke="#C43E1C" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
      el('div', { style: 'margin-top:6px;font-weight:600' }, 'Import a .pptx / .ppt file'),
      el('div', { style: 'font-size:11px;color:#999;margin-top:2px' }, 'Click to browse — real PowerPoint files open in this clone'));
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pptx,.ppt'; inp.style.display = 'none';
    document.body.appendChild(inp);
    zone.addEventListener('click', () => inp.click());
    inp.addEventListener('change', async () => { const f = inp.files[0]; inp.remove(); if (f) { await importPptxFile(f); closeBackstage(); } });
    m.appendChild(zone);
  },
  saveas(m) {
    m.appendChild(el('div', { class: 'bs-h' }, 'Save As'));
    const nm = el('input', { type: 'text', value: P.state.presName, style: 'width:280px;padding:6px 8px;border:1px solid #B0B0B0;font-size:13px' });
    const saveBtn = mkBtn('Save', () => {
      const v = nm.value.trim();
      if (!v) return;
      const l = lib(); delete l[P.state.presName]; setLib(l);
      P.setPresName(v);
      P.saveDoc();
      closeBackstage();
    }, true);
    m.appendChild(el('div', { class: 'exp-box' },
      el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:4px' }, 'This PC'),
      el('div', { style: 'font-size:11px;color:#767171;margin-bottom:10px' }, 'Documents (browser storage)'),
      el('div', { style: 'display:flex;gap:8px;align-items:center' }, el('span', { style: 'font-size:12px' }, 'File name:'), nm, saveBtn)));
    m.appendChild(el('div', { class: 'exp-box' },
      el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:6px' }, 'Download a copy'),
      el('div', { style: 'display:flex;gap:8px' },
        mkBtn('Download .pptx', () => exportPptx()),
        mkBtn('Download .png (this slide)', () => exportPng()))));
  },
  print(m) {
    m.appendChild(el('div', { class: 'bs-h' }, 'Print'));
    const info = el('div', { style: 'font-size:11.5px;color:#767171;margin:-6px 0 12px' },
      `Print ${P.state.slides.length} slide(s), full page slides, color`);
    const pbtn = mkBtn('Print', () => printSlides(), true);
    pbtn.style.cssText += 'width:120px;height:40px;font-size:14px';
    const strip = el('div', { class: 'pp-strip' });
    P.state.slides.forEach((s, i) => {
      const pv = el('div', { class: 'pp-page', title: 'Slide ' + (i + 1) });
      pv.appendChild(P.thumbNode(s, 200 / P.SW()));
      strip.appendChild(pv);
    });
    m.appendChild(el('div', { style: 'display:flex;gap:26px' },
      el('div', null, pbtn, el('div', { style: 'margin-top:14px;font-size:12px;color:#444;line-height:1.8' },
        el('div', null, el('b', null, 'Printer'), el('div', null, 'Default system printer')),
        el('div', null, el('b', null, 'Settings'), el('div', null, 'Print All Slides'), el('div', null, 'Full Page Slides')))),
      el('div', null, el('div', { style: 'font-size:12px;color:#444;margin-bottom:6px' }, 'Preview'), info, strip)));
  },
  share(m) {
    m.appendChild(el('div', { class: 'bs-h' }, 'Share'));
    m.appendChild(el('div', { class: 'exp-box' },
      el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:6px' }, 'Send a copy'),
      el('div', { style: 'font-size:11.5px;color:#767171;margin-bottom:10px' }, 'Download the .pptx and attach it to an e-mail or chat.'),
      mkBtn('Download .pptx to share', () => exportPptx())));
  },
  export(m) {
    m.appendChild(el('div', { class: 'bs-h' }, 'Export'));
    m.appendChild(el('div', { class: 'exp-box' },
      el('div', { style: 'font-weight:600;font-size:13px' }, 'Create PowerPoint file'),
      el('div', { style: 'font-size:11px;color:#767171;margin:5px 0 10px' }, 'A real .pptx that opens in Microsoft PowerPoint.'),
      mkBtn('Create .pptx', () => exportPptx(), true)));
    m.appendChild(el('div', { class: 'exp-box' },
      el('div', { style: 'font-weight:600;font-size:13px' }, 'Change File Type'),
      el('div', { style: 'font-size:11px;color:#767171;margin:5px 0 10px' }, 'Save parts of the presentation as images.'),
      el('div', { style: 'display:flex;gap:8px' },
        mkBtn('PNG — current slide', () => exportPng()),
        mkBtn('PNG — all slides (.zip-less series)', async () => {
          for (let i = 0; i < P.state.slides.length; i++) { await exportPng(i); await new Promise(r => setTimeout(r, 250)); }
        }))));
  },
  account(m) {
    const o = opts();
    m.appendChild(el('div', { class: 'bs-h' }, 'Account'));
    m.appendChild(el('div', { style: 'display:flex;gap:30px;align-items:flex-start' },
      el('div', { class: 'exp-box', style: 'min-width:280px' },
        el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:8px' }, 'User Information'),
        el('div', { style: 'display:flex;gap:10px;align-items:center' },
          el('span', null, '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#C43E1C"/><circle cx="20" cy="15" r="6.5" fill="#fff"/><path d="M7 33 a14 10 0 0 1 26 0 Z" fill="#fff"/></svg>'),
          el('div', null, el('div', { style: 'font-weight:600' }, esc(o.userName || 'PowerPoint User')), el('div', { style: 'font-size:11px;color:#767171' }, 'Local account')))),
      el('div', { class: 'exp-box', style: 'min-width:280px' },
        el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:8px' }, 'Product Information'),
        el('div', { style: 'display:flex;gap:10px;align-items:center' },
          el('span', null, '<svg viewBox="0 0 40 40" width="40" height="40"><rect width="40" height="40" rx="7" fill="#C43E1C"/><path d="M12 10h10a8.6 8.6 0 010 17.2h-3.8V31H12V10zm6.2 6.2v4.8h3a2.5 2.5 0 000-4.8h-3z" fill="#fff"/></svg>'),
          el('div', null, el('div', { style: 'font-weight:600' }, 'Microsoft PowerPoint 2016'), el('div', { style: 'font-size:11px;color:#3B8238' }, 'Product Activated'))),
        el('div', { style: 'font-size:10.5px;color:#767171;margin-top:8px' }, 'Version 16.0 (HTML/CSS/JS build)'))));
  },
  feedback(m) {
    m.appendChild(el('div', { class: 'bs-h' }, 'Feedback to Microsoft'));
    const face = (happy) => `<svg viewBox="0 0 48 48" width="46" height="46"><circle cx="24" cy="24" r="22" fill="none" stroke="#C43E1C" stroke-width="2"/><circle cx="16.5" cy="19" r="2.6" fill="#C43E1C"/><circle cx="31.5" cy="19" r="2.6" fill="#C43E1C"/>${happy ? '<path d="M14 29 Q24 38 34 29" fill="none" stroke="#C43E1C" stroke-width="2.4" stroke-linecap="round"/>' : '<path d="M14 33 Q24 25 34 33" fill="none" stroke="#C43E1C" stroke-width="2.4" stroke-linecap="round"/>'}</svg>`;
    const mk = (happy) => {
      const b = el('div', { class: 'tpl', style: 'width:150px;text-align:center' }, el('div', { class: 'tpl-cv', style: 'display:flex;align-items:center;justify-content:center' }, face(happy)), el('div', { class: 'tpl-nm' }, happy ? 'Send a Smile' : 'Send a Frown'));
      b.addEventListener('click', () => feedbackForm(happy));
      return b;
    };
    m.appendChild(el('div', { class: 'tpl-row' }, mk(true), mk(false)));
  },
  options(m) {
    const o = opts();
    m.appendChild(el('div', { class: 'bs-h' }, 'Options'));
    const as = el('input', { type: 'checkbox' }); as.checked = o.autosave !== false;
    const un = el('input', { type: 'text', value: o.userName || 'PowerPoint User', style: 'width:200px;padding:4px 6px;border:1px solid #B0B0B0' });
    m.appendChild(el('div', { class: 'exp-box', style: 'max-width:480px' },
      el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:10px' }, 'General'),
      el('label', { class: 'chkrow' }, as, el('span', null, 'AutoSave every few seconds (to this PC)')),
      el('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12.5px' }, el('span', null, 'User name:'), un),
      el('div', { style: 'margin-top:14px' }, mkBtn('OK', () => {
        setOpts({ ...o, autosave: as.checked, userName: un.value.trim() || 'PowerPoint User' });
        $('#tb-user').textContent = un.value.trim() || 'PowerPoint User';
        P.sbMsg('Options saved'); closeBackstage();
      }, true))));
    m.appendChild(el('div', { class: 'exp-box', style: 'max-width:480px' },
      el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:6px' }, 'Storage'),
      el('div', { style: 'font-size:11.5px;color:#767171;margin-bottom:8px' }, `${Object.keys(lib()).length} presentation(s) · ${fmtKB((XKV.get('pc.docs') || '').length)} used`),
      el('div', { style: 'display:flex;gap:8px' }, mkBtn('Clear session restore', () => { XKV.del('pc.session'); P.sbMsg('Session restore cleared'); }))));
  },
};
function fmtKB(b) { return (b / 1024).toFixed(1) + ' KB'; }
function mkBtn(label, fn, pri) {
  const b = el('button', { class: 'btn' + (pri ? ' pri' : '') }, esc(label));
  b.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
  return b;
}
function feedbackForm(happy) {
  const ta = el('textarea', { style: 'width:100%;height:110px;border:1px solid #B0B0B0;padding:6px;font:12.5px Calibri', placeholder: happy ? 'Tell us what you liked…' : 'Tell us what was not working…' });
  P.dlg({
    title: happy ? 'Send a Smile' : 'Send a Frown', width: 430,
    body: el('div', null, ta),
    buttons: [{
      label: 'Send', pri: true, fn: () => {
        const fb = JSON.parse(XKV.get('pc.feedback') || '[]');
        fb.push({ kind: happy ? 'smile' : 'frown', text: ta.value, at: Date.now() });
        XKV.set('pc.feedback', JSON.stringify(fb));
        P.toast('Thanks for your feedback!');
      }
    }, { label: 'Cancel' }],
  });
}

/* ---------------- print (one slide per page) ---------------- */
function printSlides() {
  document.body.classList.add('printing');
  let pr = $('#print-root');
  if (pr) pr.remove();
  pr = el('div', { id: 'print-root' });
  P.state.slides.forEach((s, i) => {
    const pg = el('div', { class: 'print-page' });
    const inner = el('div', { style: `width:${P.SW()}px;height:${P.SH()}px;transform:scale(0.75);transform-origin:0 0;position:relative;background:#fff` });
    P.renderSlideInto(inner, s, { noSel: true });
    pg.appendChild(inner);
    pr.appendChild(pg);
  });
  document.body.appendChild(pr);
  const done = () => { document.body.classList.remove('printing'); pr.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 4000); }, 350);
}

/* ---------------- Tell me ---------------- */
const TELLME = [
  { keys: 'bold', lab: 'Bold', icon: 'bold', cmd: 'bold', sub: 'Ctrl+B' },
  { keys: 'italic', lab: 'Italic', icon: 'italic', cmd: 'italic', sub: 'Ctrl+I' },
  { keys: 'underline', lab: 'Underline', icon: 'underline', cmd: 'underline', sub: 'Ctrl+U' },
  { keys: 'new slide add slide', lab: 'New Slide', icon: 'newslide', cmd: 'newslide', sub: 'Ctrl+M' },
  { keys: 'layout', lab: 'Slide Layout', icon: 'layout', cmd: 'layout' },
  { keys: 'picture image photo insert', lab: 'Insert Picture', icon: 'pictures', cmd: 'inpictures' },
  { keys: 'shape rectangle circle arrow', lab: 'Insert Shapes', icon: 'shapesIc', cmd: 'inshapes' },
  { keys: 'text box', lab: 'Text Box', icon: 'textbox', cmd: 'intextbox' },
  { keys: 'chart graph', lab: 'Insert Chart', icon: 'chartIc', cmd: 'inchart' },
  { keys: 'table', lab: 'Insert Table', icon: 'table', cmd: 'intable' },
  { keys: 'symbol omega degree', lab: 'Symbol', icon: 'symbol', cmd: 'insymbol' },
  { keys: 'transition fade push wipe', lab: 'Transitions', icon: 'tr_fade', jump: 'transitions' },
  { keys: 'animate animation fly zoom', lab: 'Animations', icon: 'an_flyin', jump: 'animations' },
  { keys: 'show present play slideshow start', lab: 'Start From Beginning', icon: 'slideshow', cmd: 'showbegin', sub: 'F5' },
  { keys: 'find search', lab: 'Find', icon: 'find', cmd: 'find', sub: 'Ctrl+F' },
  { keys: 'replace', lab: 'Replace', icon: 'replace', cmd: 'replace', sub: 'Ctrl+H' },
  { keys: 'spelling spellcheck', lab: 'Spelling', icon: 'spelling', cmd: 'spelling', sub: 'F7' },
  { keys: 'comment', lab: 'New Comment', icon: 'commentNew', cmd: 'cmnew' },
  { keys: 'theme design', lab: 'Browse Themes', icon: 'themesIc', jump: 'design' },
  { keys: 'background format', lab: 'Format Background', icon: 'formatbg', cmd: 'formatbg' },
  { keys: 'slide size widescreen standard', lab: 'Slide Size', icon: 'slidesize', cmd: 'slidesize' },
  { keys: 'slide number', lab: 'Slide Number', icon: 'slidenum', cmd: 'inslidenum' },
  { keys: 'header footer date', lab: 'Header and Footer', icon: 'headerfooter', cmd: 'inhdrftr' },
  { keys: 'wordart text effect', lab: 'WordArt', icon: 'wordart', cmd: 'inwordart' },
  { keys: 'zoom', lab: 'Zoom', icon: 'zoom', cmd: 'vzdialog' },
  { keys: 'sort sorter', lab: 'Slide Sorter view', icon: 'vSorter', cmd: 'vsorter' },
  { keys: 'reading view', lab: 'Reading View', icon: 'vReading', cmd: 'vreading' },
  { keys: 'save', lab: 'Save', icon: 'save', fn: () => P.saveDoc(), sub: 'Ctrl+S' },
  { keys: 'save as download export pptx', lab: 'Export .pptx', icon: 'export', fn: () => exportPptx() },
  { keys: 'open file', lab: 'Open...', icon: 'open', fn: () => openBackstage('open') },
  { keys: 'print', lab: 'Print', icon: 'print', fn: () => openBackstage('print'), sub: 'Ctrl+P' },
  { keys: 'help', lab: 'Help', icon: 'help', fn: () => helpDialog(), sub: 'F1' },
];
function initTellMe() {
  const inp = $('#tellme'), pop = $('#tellme-pop');
  let items = [];
  const hide = () => { pop.hidden = true; };
  const render = (q) => {
    q = (q || '').trim().toLowerCase();
    items = TELLME.filter(t => !q || t.keys.toLowerCase().includes(q) || t.lab.toLowerCase().includes(q)).slice(0, 9);
    pop.innerHTML = '';
    pop.appendChild(el('div', { class: 'tm-h' }, 'ACTIONS'));
    if (!items.length) pop.appendChild(el('div', { class: 'tm-it' }, el('span', { style: 'color:#999' }, 'No matches')));
    items.forEach((t, i) => {
      const it = el('div', { class: 'tm-it' + (i === 0 ? ' hot' : '') },
        el('span', { style: 'width:15px;height:15px;display:inline-flex' }, svgIcon(t.icon, 'width="15" height="15"')),
        el('span', null, esc(t.lab)), t.sub ? el('span', { class: 'tm-sub' }, esc(t.sub)) : '');
      it.addEventListener('mousedown', e => { e.preventDefault(); run(t); });
      pop.appendChild(it);
    });
    pop.hidden = false;
  };
  const run = t => {
    hide(); inp.value = ''; inp.blur();
    if (t.fn) return t.fn();
    if (t.jump) { const tab = $$('#tabs .tab').find(x => x.dataset.tab === t.jump); if (tab) tab.click(); return; }
    P.runCmdId(t.cmd);
  };
  inp.addEventListener('focus', () => render(inp.value));
  inp.addEventListener('input', () => render(inp.value));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && items[0]) { e.preventDefault(); run(items[0]); }
    if (e.key === 'Escape') hide();
  });
  document.addEventListener('mousedown', e => { if (!e.target.closest('#tellme-wrap')) hide(); });
}

/* ---------------- help ---------------- */
function helpDialog() {
  const rows = [
    ['Ctrl+N', 'New presentation'], ['Ctrl+O', 'Open'], ['Ctrl+S', 'Save'], ['Ctrl+P', 'Print'],
    ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Ctrl+X / C / V', 'Cut / Copy / Paste'], ['Ctrl+B / I / U', 'Bold / Italic / Underline'],
    ['Ctrl+M', 'New slide'], ['Ctrl+D', 'Duplicate object or slide'], ['Delete', 'Delete selected object'],
    ['Arrow keys', 'Nudge selected object'], ['Esc', 'Cancel / exit editing'],
    ['Ctrl+A', 'Select all objects (or all text when editing)'], ['Ctrl+F / Ctrl+H', 'Find / Replace'],
    ['Shift+F5', 'Slide show from current slide'], ['F5, click, →', 'Advance slide show'],
    ['Ctrl+F1', 'Collapse / expand the ribbon'], ['F1', 'This help'],
  ];
  P.dlg({
    title: 'PowerPoint Help', width: 520,
    body: el('div', { style: 'max-height:340px;overflow:auto' },
      el('div', { style: 'font:600 13px "Segoe UI";margin-bottom:8px' }, 'Keyboard shortcuts'),
      el('table', { class: 'help-tbl' }, ...rows.map(r => el('tr', null, el('td', { style: 'font-weight:600;width:170px' }, r[0]), el('td', null, r[1]))))),
    buttons: [{ label: 'OK', pri: true }],
  });
}
P.helpDialog = helpDialog;

/* ---------------- window buttons + F1 ---------------- */
function initChromeRest() {
  $('#win-min').addEventListener('click', () => P.toast('This is a web app — it cannot minimize'));
  $('#win-max').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    else document.documentElement.requestFullscreen().catch(() => { });
  });
  $('#win-close').addEventListener('click', async () => {
    if (!(await confirmDiscardIfDirty())) return;
    P.saveDoc(true);
    document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;flex-direction:column;background:#f3f3f3;font:14px Segoe UI;color:#555;gap:8px"><div style="font-size:20px;font-weight:300">Presentation closed</div><div style="font-size:12px">Reload the page to come back — your work is saved on this PC.</div></div>';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'F1') { e.preventDefault(); helpDialog(); }
    if (e.key === 'F7') { e.preventDefault(); P.runCmdId('spelling'); }
  });
}
P.initApp4 = function () {
  initTellMe();
  initChromeRest();
  const o = opts();
  if (o.userName) $('#tb-user').textContent = o.userName;
};
P.exportPptx = exportPptx;
P.importFile = importPptxFile;   /* routes .pptx (zip) and .ppt (CFB) automatically */
P.exportPng = exportPng;
P.newPres = newPres;
P.openPresName = openPresName;
P.confirmDiscardIfDirty = confirmDiscardIfDirty;
})();
