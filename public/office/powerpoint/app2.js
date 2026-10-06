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
   PowerPoint clone — ribbon build, commands, galleries, dialogs
   ========================================================================== */
'use strict';
(function () {
  const { $, $$, el, esc, clamp, uid, THEMES, LAYOUTS, LAYOUT_ORDER, FONTS } = P;

  /* ============================ ribbon chrome ============================ */
  const TABS = ['File', 'Home', 'Insert', 'Design', 'Transitions', 'Animations', 'Slide Show', 'Review', 'View'];
  let activeTab = 'home';
  let ribbonCollapsed = false;

  function renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    TABS.forEach(t => {
      const isFile = t === 'File';
      const id = isFile ? 'file' : RIBBON.find(r => r.label === t).id;
      const b = el('div', { class: 'tab' + (isFile ? ' file' : '') + (id === activeTab && !isFile ? ' on' : ''), 'data-tab': id }, esc(t));
      b.addEventListener('mousedown', () => {
        if (isFile) { P.openBackstage(); return; }
        if (activeTab === id) toggleRibbon();
        else { activeTab = id; if (ribbonCollapsed) toggleRibbon(true, true); renderRibbon(); renderTabs(); }
      });
      b.addEventListener('dblclick', () => toggleRibbon());
      tabs.appendChild(b);
    });
  }
  function toggleRibbon(force, keepTab) {
    ribbonCollapsed = force === true ? false : !ribbonCollapsed;
    $('#ribbon').classList.toggle('nb', ribbonCollapsed);
    if (!ribbonCollapsed) renderRibbon();
    P.layoutStage(); P.renderAll();
  }
  function renderRibbon() {
    const rb = $('#ribbon');
    rb.innerHTML = '';
    const scroll = el('div', { id: 'rb-scroll' });
    const tab = RIBBON.find(r => r.id === activeTab);
    (tab.groups || []).forEach((g, gi) => {
      if (gi > 0) scroll.appendChild(el('div', { class: 'rb-sep' }));
      scroll.appendChild(buildGroup(g));
    });
    rb.appendChild(scroll);
    updateRibbonState();
  }
  function buildGroup(g) {
    const grp = el('div', { class: 'rb-group' });
    const body = el('div', { class: 'rb-body' });
    if (g.host && HOST_BUILDERS[g.host]) HOST_BUILDERS[g.host](body);
    else (g.items || []).forEach(it => body.appendChild(buildItem(it)));
    grp.appendChild(body);
    grp.appendChild(el('div', { class: 'rb-cap' }, esc(g.nm)));
    return grp;
  }
  function buildItem(it) {
    if (it.t === 'small') return smallButton(it);
    return bigButton(it);
  }
  function bigButton(it) {
    const b = el('button', { class: 'rbig', id: 'rb-' + it.id, title: (it.lab || '').replace(/\n/g, ' ') + (CMDS[it.id] && CMDS[it.id].tip ? '\n' + CMDS[it.id].tip : ''), 'data-cmd': it.id });
    b.innerHTML = svgIcon(it.icon) + `<span class="rl">${esc(it.lab || '').replace(/\n/g, '\n')}</span>` + (it.caret ? '<span class="car">▾</span>' : '');
    b.addEventListener('mousedown', e => { e.preventDefault(); runCmd(it.id, b, it); });
    return b;
  }
  function smallButton(it) {
    if (!smallButton.col) smallButton.col = null;
    if (!smallButton.cur || smallButton.cur.children.length >= 3) {
      smallButton.cur = el('div', { class: 'rcol' });
      smallButton.cur._p = smallButton.parent;
      smallButton.parent = null;
    }
    const b = el('button', { class: 'rsmall', id: 'rb-' + it.id, title: CMDS[it.id] && CMDS[it.id].tip ? CMDS[it.id].tip : '', 'data-cmd': it.id });
    b.innerHTML = svgIcon(it.icon) + (it.lab != null ? `<span>${esc(it.lab).replace(/\n/g, '<br>')}</span>` : '') + (it.caret ? '<span class="car" style="margin-left:2px">▾</span>' : '');
    b.addEventListener('mousedown', e => { e.preventDefault(); runCmd(it.id, b, it); });
    /* track parent assembly outside */
    b._isSmall = true;
    return b;
  }
  /* assemble smalls in columns of 3: patch buildGroup for items */
  const origBuildGroup = buildGroup;
  buildGroup = function (g) {
    if (g.host || !g.items) return origBuildGroup(g);
    const grp = el('div', { class: 'rb-group' });
    const body = el('div', { class: 'rb-body' });
    let col = null;
    g.items.forEach(it => {
      if (it.t === 'small') {
        if (!col || col.children.length >= 3) { col = el('div', { class: 'rcol' }); body.appendChild(col); }
        col.appendChild(smallButton(it));
      } else { col = null; body.appendChild(bigButton(it)); }
    });
    grp.appendChild(body);
    grp.appendChild(el('div', { class: 'rb-cap' }, esc(g.nm)));
    return grp;
  };
  function runCmd(id, btn, it) {
    if (btn.disabled) return;
    const c = CMDS[id];
    if (!c) return;
    if (it && it.toggle) btn.classList.toggle('on');
    c.exec(btn, it);
    updateRibbonState();
  }
  function updateRibbonState() {
    const sel = P.firstSel();
    const editing = P.editing;
    // font group live values
    const ctx = curTextCtx();
    if ($('#rb-font-name')) $('#rb-font-name').value = ctx.font || P.TH().minFont || 'Calibri';
    if ($('#rb-font-size')) $('#rb-font-size').value = ctx.size != null ? ctx.size : '18';
    setOn('rb-bold', ctx.b); setOn('rb-italic', ctx.i); setOn('rb-underline', ctx.u);
    setOn('rb-al', ctx.align === 'l'); setOn('rb-ac', ctx.align === 'c'); setOn('rb-ar', ctx.align === 'r'); setOn('rb-aj', ctx.align === 'j');
    setOn('rb-hideslidebtn', P.cur().hidden);
    const noText = !ctx.any;
    ['rb-bold', 'rb-italic', 'rb-underline', 'rb-strike', 'rb-shadowT', 'rb-clearfmt', 'rb-aup', 'rb-adown', 'rb-spacing', 'rb-casebtn', 'rb-highlightbtn', 'rb-fontcolbtn', 'rb-bullets', 'rb-numbering', 'rb-inddec', 'rb-indinc', 'rb-lspacing', 'rb-al', 'rb-ac', 'rb-ar', 'rb-aj', 'rb-textdir', 'rb-aligntext']
      .forEach(id => { const b = $('#' + id); if (b) b.disabled = !!noText && !editing; });
  }
  window.updateRibbonState = updateRibbonState;
  function setOn(id, on) { const b = $('#' + id); if (b) b.classList.toggle('on', !!on); }
  function curTextCtx() {
    const o = P.firstSel();
    if (P.editing) {
      const eo = P.objById(P.editing);
      if (eo && eo.paras && eo.paras[0]) {
        const r = eo.paras[0].runs[0] || {};
        return { any: true, b: !!r.b, i: !!r.i, u: !!r.u, size: r.size || eo.fs, font: r.font || eo.font || (eo.ph === 'title' ? P.TH().majFont : P.TH().minFont), align: eo.paras[0].align || eo.al };
      }
    }
    if (o && P.isTextish(o) && o.paras) {
      const r = (o.paras[0] || { runs: [{}] }).runs[0] || {};
      return { any: true, b: !!r.b, i: !!r.i, u: !!r.u, size: r.size || o.fs, font: r.font || o.font || (o.ph === 'title' ? P.TH().majFont : P.TH().minFont), align: o.paras[0].align || o.al };
    }
    return { any: false };
  }

  /* ============================ QAT + chrome ============================ */
  function buildChrome() {
    $('#tb-icon').innerHTML = svgIcon('pptlogo');
    const qat = $('#qat');
    const opts = JSON.parse(XKV.get('pc.opts') || '{}');
    const asw = el('span', { class: 'aswitch' + (opts.autosave !== false ? ' on' : ''), title: 'AutoSave' });
    const asState = el('span', { class: 'as-state', id: 'as-state' }, opts.autosave !== false ? 'On' : 'Off');
    asw.addEventListener('click', () => {
      const o = JSON.parse(XKV.get('pc.opts') || '{}');
      o.autosave = o.autosave === false ? true : false;
      XKV.set('pc.opts', JSON.stringify(o));
      asw.classList.toggle('on', o.autosave !== false);
      asState.textContent = o.autosave !== false ? 'On' : 'Off';
      P.sbMsg('AutoSave ' + (o.autosave !== false ? 'On' : 'Off'));
    });
    const as = el('span', { class: 'qat-as' }, el('span', { class: 'as-lab' }, 'AutoSave'), asw, asState);
    qat.appendChild(as);
    qat.appendChild(el('span', { class: 'qsep' }));
    [['save', 'Save (Ctrl+S)', () => P.saveDoc(false)], ['undo', 'Undo (Ctrl+Z)', () => P.doUndo()], ['redo', 'Redo (Ctrl+Y)', () => P.doRedo()], ['slideshow', 'Start From Beginning (F5)', () => startSlideShow(0)]].forEach(([ic, tip, fn]) => {
      const b = el('button', { class: 'qbtn', id: 'qat-' + ic, title: tip, html: svgIcon(ic) });
      b.addEventListener('click', fn);
      qat.appendChild(b);
    });
    $('#tb-user').innerHTML = svgIcon('user') + '<span>User</span>';
    $('#tb-ribbon-toggle').innerHTML = svgIcon('rbup');
    $('#tb-ribbon-toggle').addEventListener('click', () => toggleRibbon());
    $('#win-min').innerHTML = svgIcon('min');
    $('#win-max').innerHTML = svgIcon('max');
    $('#win-close').innerHTML = svgIcon('close');
    $('#tellme-ico').innerHTML = svgIcon('bulb');
    ['win-min', 'win-max', 'win-close'].forEach(id => $('#' + id).addEventListener('click', () => P.sbMsg('Window controls are decorative in the clone')));
    // view buttons in status bar
    [['view-normal', 'vNormal', () => setView('normal')], ['view-sorter', 'vSorter', () => setView('sorter')], ['view-reading', 'vReading', () => startReading()], ['view-show', 'vShowSmall', () => startSlideShow(0)]]
      .forEach(([id, ic, fn]) => { $('#' + id).innerHTML = svgIcon(ic); $('#' + id).addEventListener('click', fn); });
    $('#view-normal').classList.add('on');
    // zoom controls
    $('#zoom-out').addEventListener('click', () => P.setZoom(P.Z() / 1.25, 'z'));
    $('#zoom-in').addEventListener('click', () => P.setZoom(P.Z() * 1.25, 'z'));
    $('#zoom-slider').addEventListener('input', e => P.setZoom(+e.target.value / 100));
    $('#zoom-pct').addEventListener('click', () => P.setZoom('fit', 'z'));
    $('#sb-notes').addEventListener('click', () => {
      P.state.notesOpen = !P.state.notesOpen;
      $('#notesbar').classList.toggle('closed', !P.state.notesOpen);
      $('#sb-notes').classList.toggle('on', P.state.notesOpen);
    });
    $('#sb-comments').addEventListener('click', () => toggleCommentsPane(true));
    $('#notes-editor').addEventListener('mousedown', e => {
      const n = $('#notes-editor');
      if (n.contentEditable !== 'true') { n.contentEditable = 'true'; n.classList.remove('empty'); if (!n.textContent) n.innerHTML = ''; }
    });
    $('#notes-editor').addEventListener('input', () => { P.cur().notes = $('#notes-editor').textContent; P.markDirty(); });
    $('#notes-editor').addEventListener('blur', () => {
      const n = $('#notes-editor');
      P.cur().notes = n.textContent;
      n.contentEditable = 'false';
      P.syncNotes();
    });
    // doc name rename
    $('#doc-name').addEventListener('click', async () => {
      const v = await P.inputBox('Rename', 'Presentation name:', P.state.presName);
      if (v != null) P.setPresName(v);
    });
    P.updateUndoButtons();
  }
  function setView(v) {
    P.state.view = v;
    $('#stage').hidden = v !== 'normal';
    $('#sorter').hidden = v !== 'sorter';
    $('#notesbar').style.display = v !== 'normal' ? 'none' : '';
    $('#view-normal').classList.toggle('on', v === 'normal');
    $('#view-sorter').classList.toggle('on', v === 'sorter');
    $('#view-reading').classList.remove('on');
    if (v === 'sorter') renderSorter();
    P.renderAll();
  }
  P.setViewApp = setView;

  /* ============================ transition defs ============================ */
  const TRANSITIONS = [
    { id: 'none', nm: 'None' }, { id: 'fade', nm: 'Fade' }, { id: 'push', nm: 'Push' }, { id: 'wipe', nm: 'Wipe' },
    { id: 'split', nm: 'Split' }, { id: 'blinds', nm: 'Blinds' }, { id: 'checker', nm: 'Checkerboard' }, { id: 'dissolve', nm: 'Dissolve' },
  ];
  const TR_DIRS = {
    fade: null,
    push: [{ id: 'left', nm: 'From Right' }, { id: 'right', nm: 'From Left' }, { id: 'up', nm: 'From Bottom' }, { id: 'down', nm: 'From Top' }],
    wipe: [{ id: 'right', nm: 'From Left' }, { id: 'left', nm: 'From Right' }, { id: 'down', nm: 'From Top' }, { id: 'up', nm: 'From Bottom' }],
    split: [{ id: 'v-out', nm: 'Vertical Out' }, { id: 'v-in', nm: 'Vertical In' }, { id: 'h-out', nm: 'Horizontal Out' }, { id: 'h-in', nm: 'Horizontal In' }],
    blinds: [{ id: 'v', nm: 'Vertical' }, { id: 'h', nm: 'Horizontal' }],
    checker: [{ id: 'v', nm: 'From Top' }, { id: 'h', nm: 'From Left' }],
    dissolve: null, none: null,
  };
  function curTr() { return P.cur().transition || (P.cur().transition = { kind: 'none', dir: null, dur: 0.7, advClick: true, advAfter: 0 }); }
  function setTransition(kind, dir) {
    P.pushHistory('Set transition');
    const t = curTr();
    t.kind = kind;
    t.dir = dir || ((TR_DIRS[kind] || [])[0] ? TR_DIRS[kind][0].id : null);
    P.markDirty(); P.renderAll();
    previewTransition();
    updateTrStrip();
  }
  function updateTrStrip() {
    const t = curTr();
    $$('.tr-sw').forEach(sw => sw.classList.toggle('on', sw.dataset.tr === t.kind));
  }

  /* transition engine — animates a screenshot-like clone pair with WAAPI */
  function trFrames(host, dir, kind) {
    // returns [incomingKF, outgoingKF]
    const w = host.clientWidth || 1280, h = host.clientHeight || 720;
    const MV = { left: `translateX(${w}px)`, right: `translateX(${-w}px)`, up: `translateY(${h}px)`, down: `translateY(${-h}px)` };
    const kf = { inAnim: null, outAnim: null };
    if (kind === 'fade') { kf.inAnim = [{ opacity: 0 }, { opacity: 1 }]; }
    else if (kind === 'push') { kf.inAnim = [{ transform: MV[dir] || MV.left }, { transform: 'translate(0,0)' }]; const inv = { left: -w, right: w, up: -h, down: h }; kf.outAnim = [{ transform: 'translate(0,0)' }, { transform: dir === 'up' || dir === 'down' ? `translateY(${inv[dir]}px)` : `translateX(${inv[dir]}px)` }]; }
    else if (kind === 'wipe') {
      const clips = { right: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'], left: ['inset(0 0 0 100%)', 'inset(0 0 0 0)'], down: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'], up: ['inset(100% 0 0 0)', 'inset(0 0 0 0)'] };
      const c = clips[dir] || clips.right;
      kf.inAnim = [{ clipPath: c[0] }, { clipPath: c[1] }];
    } else if (kind === 'split') {
      const c = {
        'v-in': ['inset(0 50% 0 50%)', 'inset(0 0 0 0)'], 'h-in': ['inset(50% 0 50% 0)', 'inset(0 0 0 0)'],
        'v-out': ['inset(0 0 0 0)', 'inset(0 50% 0 50%)'], 'h-out': ['inset(0 0 0 0)', 'inset(50% 0 50% 0)'],
      }[dir] || ['inset(0 50% 0 50%)', 'inset(0 0 0 0)'];
      if (dir && dir.endsWith('out')) kf.outAnim = [{ clipPath: c[0] }, { clipPath: c[1] }];
      else kf.inAnim = [{ clipPath: c[0] }, { clipPath: c[1] }];
    } else if (kind === 'blinds') {
      kf.blinds = { n: 8, horiz: dir === 'h' };
    } else if (kind === 'checker') {
      kf.checker = true;
    } else if (kind === 'dissolve') {
      kf.dissolve = true;
    }
    return kf;
  }
  async function playTransition(host, inNode, outNode, tr, z) {
    // positions: inNode on top
    const durS = Math.max(0.05, (tr && tr.dur) || 0.7);
    const dur = durS * 1000;
    inNode.style.zIndex = 2; outNode.style.zIndex = 1;
    const dim = { duration: dur, easing: 'ease', fill: 'both' };
    const kf = trFrames(host, tr && tr.dir, tr ? tr.kind : 'none');
    const jobs = [];
    if (kf.inAnim) jobs.push(inNode.animate(kf.inAnim, dim).finished.catch(() => { }));
    if (kf.outAnim) jobs.push(outNode.animate(kf.outAnim, dim).finished.catch(() => { }));
    if (kf.blinds) {
      const n = kf.blinds.n, horiz = kf.blinds.horiz;
      for (let i = 0; i < n; i++) {
        const d = (dur * 0.4) * (i / n);
        const from = horiz ? `inset(0 ${100 - (i + 1) * (100 / n)}% 0 ${i * (100 / n)}%)` : `inset(${i * (100 / n)}% 0 ${100 - (i + 1) * (100 / n)}% 0)`;
        const strip = inNode.cloneNode(true);
        strip.style.cssText = inNode.style.cssText + `;clip-path:${from};z-index:2`;
        host.appendChild(strip);
        jobs.push(strip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.6, delay: d, fill: 'backwards' }).finished.catch(() => { }).then(() => strip.remove()));
      }
      inNode.style.opacity = 0;
      jobs.push(new Promise(r => setTimeout(() => { inNode.style.opacity = 1; r(); }, dur + 10)));
    }
    if (kf.checker) {
      const cols = 8, rows = 5;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const idx = tr && tr.dir === 'h' ? c : r;
        const d = (dur * 0.5) * (idx / Math.max(rows, cols)) + Math.random() * dur * 0.05;
        const cell = inNode.cloneNode(true);
        cell.style.cssText = inNode.style.cssText + `;clip-path:inset(${r * 20}% ${100 - (c + 1) * 12.5}% ${100 - (r + 1) * 20}% ${c * 12.5}%);z-index:2`;
        host.appendChild(cell);
        jobs.push(cell.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.45, delay: d, fill: 'backwards' }).finished.catch(() => { }).then(() => cell.remove()));
      }
      inNode.style.opacity = 0;
      jobs.push(new Promise(r => setTimeout(() => { inNode.style.opacity = 1; r(); }, dur + 10)));
    }
    if (kf.dissolve) {
      const cells = [];
      for (let i = 0; i < 40; i++) {
        const w2 = 100 / 10, h2 = 100 / 4;
        const c = i % 10, r = Math.floor(i / 10);
        const cell = inNode.cloneNode(true);
        cell.style.cssText = inNode.style.cssText + `;clip-path:inset(${r * h2}% ${100 - (c + 1) * w2}% ${100 - (r + 1) * h2}% ${c * w2}%);z-index:2`;
        host.appendChild(cell);
        cells.push(cell);
      }
      cells.sort(() => Math.random() - 0.5).forEach((cell, i) => {
        jobs.push(cell.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.4, delay: dur * 0.6 * (i / cells.length), fill: 'backwards' }).finished.catch(() => { }).then(() => cell.remove()));
      });
      inNode.style.opacity = 0;
      jobs.push(new Promise(r => setTimeout(() => { inNode.style.opacity = 1; r(); }, dur + 10)));
    }
    await Promise.all(jobs);
  }

  async function previewTransition() {
    const t = curTr();
    if (!t || t.kind === 'none') return;
    const stage = $('#slide');
    const prevIdx = Math.max(0, P.state.active - 1);
    const outN = el('div', { style: 'position:absolute;left:0;top:0;width:1280px;height:720px;background:#fff;overflow:hidden' });
    const inN = el('div', { style: 'position:absolute;left:0;top:0;width:1280px;height:720px;background:#fff;overflow:hidden' });
    P.renderSlideInto(outN, P.state.slides[prevIdx], { noSel: true });
    P.renderSlideInto(inN, P.cur(), { noSel: true });
    stage.style.overflow = 'hidden';
    outN.style.zIndex = 30; inN.style.zIndex = 31;
    stage.appendChild(outN); stage.appendChild(inN);
    await playTransition(stage, inN, outN, t);
    inN.remove(); outN.remove();
  }
  P.previewTransition = previewTransition;

  /* ============================ animation defs ============================ */
  const ANIMS = {
    appear: { cat: 'in', nm: 'Appear', icon: 'an_appear' },
    fade: { cat: 'in', nm: 'Fade', icon: 'an_fade' },
    flyin: { cat: 'in', nm: 'Fly In', icon: 'an_flyin', dirs: [['frombottom', 'From Bottom'], ['fromleft', 'From Left'], ['fromright', 'From Right'], ['fromtop', 'From Top']] },
    floatin: { cat: 'in', nm: 'Float In', icon: 'an_floatin', dirs: [['frombottom', 'Float Up'], ['fromtop', 'Float Down']] },
    split: { cat: 'in', nm: 'Split', icon: 'an_split', dirs: [['v-in', 'Vertical In'], ['h-in', 'Horizontal In']] },
    wipe: { cat: 'in', nm: 'Wipe', icon: 'an_wipe', dirs: [['fromleft', 'From Left'], ['frombottom', 'From Bottom'], ['fromright', 'From Right'], ['fromtop', 'From Top']] },
    zoomin: { cat: 'in', nm: 'Zoom', icon: 'an_zoom' },
    pulse: { cat: 'em', nm: 'Pulse', icon: 'an_pulse' },
    grow: { cat: 'em', nm: 'Grow/Shrink', icon: 'an_grow' },
    spin: { cat: 'em', nm: 'Spin', icon: 'an_spin' },
    fadeout: { cat: 'out', nm: 'Fade', icon: 'an_exitfade' },
    disappear: { cat: 'out', nm: 'Disappear', icon: 'an_disappear' },
    flyout: { cat: 'out', nm: 'Fly Out', icon: 'an_flyout', dirs: [['totop', 'To Top'], ['toleft', 'To Left'], ['toright', 'To Right'], ['tobottom', 'To Bottom']] },
    floatout: { cat: 'out', nm: 'Float Out', icon: 'an_floatin', dirs: [['totop', 'Float Up'], ['tobottom', 'Float Down']] },
    zoomout: { cat: 'out', nm: 'Zoom', icon: 'an_zoom' },
  };
  function animKF(a, W, H) {
    const d = a.dir;
    const inXY = { frombottom: [0, 60], fromtop: [0, -60], fromleft: [-60, 0], fromright: [60, 0], totop: [0, -60], tobottom: [0, 60], toleft: [-60, 0], toright: [60, 0] };
    switch (a.eff) {
      case 'appear': return { cls: 'vis' };
      case 'disappear': return { cls: 'vis-out' };
      case 'fade': return { kf: [{ opacity: 0 }, { opacity: 1 }] };
      case 'fadeout': return { kf: [{ opacity: 1 }, { opacity: 0 }] };
      case 'flyin': { const [x, y] = inXY[d] || [0, 60]; return { kf: [{ opacity: 0, transform: `translate(${x * 4}px, ${y * 4}px)` }, { opacity: 1, transform: 'translate(0,0)' }] }; }
      case 'floatin': { const up = (d || 'frombottom') === 'frombottom'; return { kf: [{ opacity: 0, transform: `translateY(${up ? 50 : -50}px)` }, { opacity: 1, transform: 'translateY(0)' }] }; }
      case 'split': return { kf: [{ opacity: 0, transform: d === 'h-in' ? 'scaleY(0)' : 'scaleX(0)' }, { opacity: 1, transform: 'scale(1,1)' }] };
      case 'wipe': { const clips = { fromleft: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'], fromright: ['inset(0 0 0 100%)', 'inset(0 0 0 0)'], fromtop: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'], frombottom: ['inset(100% 0 0 0)', 'inset(0 0 0 0)'] }; const c = clips[d] || clips.fromleft; return { kf: [{ clipPath: c[0] }, { clipPath: c[1] }] }; }
      case 'zoomin': return { kf: [{ opacity: 0, transform: 'scale(.45)' }, { opacity: 1, transform: 'scale(1)' }] };
      case 'pulse': return { kf: [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }] };
      case 'grow': return { kf: [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }] };
      case 'spin': return { kf: [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }] };
      case 'flyout': { const [x, y] = inXY[d] || [0, -60]; return { kf: [{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: `translate(${x * 4}px, ${y * 4}px)` }] }; }
      case 'floatout': { const up = (d || 'totop') === 'totop'; return { kf: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${up ? -50 : 50}px)` }] }; }
      case 'zoomout': return { kf: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.4)' }] };
    }
    return {};
  }
  function playAnim(elm, a) {
    const spec = animKF(a, 1280, 720);
    if (spec.cls) {
      // appear/disappear instantaneous after their delay
      return new Promise(r => setTimeout(() => { elm.style.opacity = spec.cls === 'vis' ? 1 : 0; r(); }, 30));
    }
    if (spec.kf) {
      return elm.animate(spec.kf, { duration: Math.max(50, (a.dur || 500)), fill: a.cat === 'out' ? 'forwards' : 'both' }).finished.catch(() => { });
    }
    return Promise.resolve();
  }
  P.playAnim = playAnim;
  P.playTransition = playTransition;
  P.TRANSITIONS = TRANSITIONS;
  P.curTr = curTr;
  async function previewAllAnims() {
    const anims = [...P.cur().anims].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!anims.length) { P.sbMsg('No animations on this slide — select an object and click Add Animation'); return; }
    // set entrances invisible, then run sequence
    anims.forEach(a => { const d = document.querySelector(`.obj[data-oid="${a.obj}"]`); if (d && a.cat === 'in') d.style.opacity = 0; });
    await new Promise(r => setTimeout(r, 260));
    for (const a of anims) {
      const d = document.querySelector(`.obj[data-oid="${a.obj}"]`);
      if (!d) continue;
      await new Promise(r => setTimeout(r, a.delay || 0));
      if (a.cat === 'in') d.style.opacity = 1;
      await playAnim(d, a);
    }
    // restore
    setTimeout(() => { anims.forEach(a => { const d = document.querySelector(`.obj[data-oid="${a.obj}"]`); if (d) { d.style.opacity = ''; d.getAnimations().forEach(x => x.cancel()); } }); }, 900);
  }
  P.previewAllAnims = previewAllAnims;
  function addAnim(eff) {
    const o = P.firstSel();
    if (!o) { P.sbMsg('Select an object first'); return; }
    const def = ANIMS[eff];
    if (!def) {
      // none -> remove anims of this object
      P.pushHistory('Remove animation');
      P.cur().anims = P.cur().anims.filter(a => a.obj !== o.id);
      P.renderAll(); updateSidePane(); return;
    }
    P.pushHistory('Add animation');
    const order = Math.max(0, ...P.cur().anims.map(a => a.order || 0)) + 1;
    if (!P.cur().anims) P.cur().anims = [];
    const dir = (def.dirs || [null])[0];
    P.cur().anims.push({ id: uid(), obj: o.id, eff, cat: def.cat, dir: dir && dir[0], dur: 500, delay: 0, start: 'click', order });
    P.markDirty(); P.renderAll(); updateSidePane();
    P.sbMsg(`${def.nm} — added to "${o.name || o.ph || o.kind}"`);
    // quick solo preview
    const d = document.querySelector(`.obj[data-oid="${o.id}"]`);
    if (d) { if (def.cat === 'in') { d.style.opacity = 0; setTimeout(() => { d.style.opacity = 1; playAnim(d, { eff, cat: def.cat, dir: dir && dir[0], dur: 500 }); }, 120); } else playAnim(d, { eff, cat: def.cat, dur: 500 }); }
  }
  P.addAnim = addAnim;

  /* -------- animation pane (side) -------- */
  function updateSidePane() {
    const sp = $('#sidepane');
    if (sp.hidden || sp.dataset.kind !== 'anim') return;
    const body = $('.sp-body', sp);
    body.innerHTML = '';
    const anims = [...(P.cur().anims || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!anims.length) body.appendChild(el('div', { style: 'color:#888;font-size:11px;padding:8px' }, 'No animations yet. Select an object on the slide and choose Add Animation.'));
    anims.forEach((a, i) => {
      const def = ANIMS[a.eff] || {};
      const o = P.objById(a.obj);
      const it = el('div', { class: 'anim-it' + (a.id === activeAnimId ? ' on' : '') });
      it.dataset.aid = a.id;
      it.innerHTML = `<span class="an-num">${i + 1}</span>
        <div class="an-nm">${svgIcon(def.icon || 'an_appear')}<span>${esc(def.nm || a.eff)} — ${esc(o && (o.name || o.ph) ? (o.ph === 'title' ? 'Title' : o.ph === 'body' ? 'Content' : o.name || o.kind) : 'Object')}</span>
        <span class="an-x" title="Remove">✕</span></div>
        <div class="an-sub">${a.cat === 'in' ? 'Entrance' : a.cat === 'em' ? 'Emphasis' : 'Exit'} · ${a.start === 'click' ? 'On Click' : a.start === 'with' ? 'With Previous' : 'After Previous'} · ${(a.dur / 1000).toFixed(2)}s${a.delay ? ' · delay ' + (a.delay / 1000).toFixed(2) + 's' : ''}</div>`;
      it.addEventListener('mousedown', ev => {
        if (ev.target.classList.contains('an-x')) { P.pushHistory('Remove animation'); P.cur().anims = P.cur().anims.filter(x => x.id !== a.id); P.renderAll(); updateSidePane(); return; }
        activeAnimId = a.id;
        if (o) { P.state.sel.objs = [o.id]; P.renderMain(); }
        updateSidePane();
      });
      it.addEventListener('dblclick', () => {
        const d = document.querySelector(`.obj[data-oid="${a.obj}"]`);
        if (d) { if (a.cat === 'in') { d.style.opacity = 0; setTimeout(() => { d.style.opacity = 1; playAnim(d, a); }, 120); } else playAnim(d, a); }
      });
      const ops = el('div', { style: 'position:absolute;right:26px;top:6px;display:flex;gap:2px' });
      const up = el('span', { title: 'Move earlier', style: 'cursor:pointer;color:#777;font-size:9px' }, '▲');
      const dn = el('span', { title: 'Move later', style: 'cursor:pointer;color:#777;font-size:9px' }, '▼');
      up.addEventListener('mousedown', ev => { ev.stopPropagation(); reorderAnim(a.id, -1); });
      dn.addEventListener('mousedown', ev => { ev.stopPropagation(); reorderAnim(a.id, 1); });
      ops.appendChild(up); ops.appendChild(dn);
      it.appendChild(ops);
      body.appendChild(it);
    });
  }
  let activeAnimId = null;
  function reorderAnim(aid, dlt) {
    const anims = P.cur().anims;
    const i = anims.findIndex(a => a.id === aid);
    if (i < 0) return;
    P.pushHistory('Reorder animation');
    const j = clamp(i + dlt, 0, anims.length - 1);
    [anims[i], anims[j]] = [anims[j], anims[i]];
    anims.forEach((a, k) => a.order = k + 1);
    P.markDirty(); updateSidePane();
  }
  P.updateSidePane = updateSidePane;
  window.updateSidePane = updateSidePane;
  function openAnimPane() {
    const sp = $('#sidepane');
    sp.hidden = false; sp.dataset.kind = 'anim';
    sp.innerHTML = '';
    const h = el('div', { class: 'sp-h' }, 'Animation Pane');
    const x = el('span', { class: 'x', html: svgIcon('close') });
    x.addEventListener('click', () => { sp.hidden = true; });
    h.appendChild(x);
    sp.appendChild(h);
    sp.appendChild(el('div', { class: 'sp-body' }));
    updateSidePane();
    P.layoutStage(); P.renderAll();
  }

  /* -------- comments pane -------- */
  function toggleCommentsPane(show) {
    const sp = $('#sidepane');
    if (!sp.hidden && sp.dataset.kind === 'comments' && !show) { sp.hidden = true; P.layoutStage(); return; }
    sp.hidden = false; sp.dataset.kind = 'comments';
    sp.innerHTML = '';
    const h = el('div', { class: 'sp-h' }, 'Comments');
    const x = el('span', { class: 'x', html: svgIcon('close') });
    x.addEventListener('click', () => { sp.hidden = true; P.layoutStage(); P.renderAll(); });
    h.appendChild(x);
    const body = el('div', { class: 'sp-body' });
    renderComments(body);
    const foot = el('div', { style: 'padding:8px' });
    const nb = el('button', { class: 'btn pri', style: 'width:100%' }, 'New Comment');
    nb.addEventListener('click', () => newCommentDialog(() => renderComments(body)));
    foot.appendChild(nb);
    sp.appendChild(h); sp.appendChild(body); sp.appendChild(foot);
    P.layoutStage(); P.renderAll();
  }
  function renderComments(body) {
    body.innerHTML = '';
    const list = P.state.comments[P.cur().id] || [];
    if (!list.length) body.appendChild(el('div', { style: 'color:#888;font-size:11px;padding:8px' }, 'No comments on this slide yet.'));
    list.forEach((c, i) => {
      const it = el('div', { class: 'anim-it' });
      it.innerHTML = `<span class="an-num">${i + 1}</span><div class="an-nm">${svgIcon('comment')}<span>${esc(c.author)}</span><span class="an-x" title="Delete">✕</span></div>
        <div style="margin-top:3px;color:#333">${esc(c.text)}</div><div class="an-sub">${new Date(c.at).toLocaleString()}</div>`;
      it.querySelector('.an-x').addEventListener('mousedown', () => {
        P.pushHistory('Delete comment');
        P.state.comments[P.cur().id].splice(i, 1);
        renderComments(body); P.updateSB(); P.markDirty();
      });
      body.appendChild(it);
    });
  }
  function newCommentDialog(after) {
    P.inputBox('New Comment', 'Comment text:', '').then(v => {
      if (v == null || !v.trim()) return;
      P.pushHistory('New comment');
      const list = P.state.comments[P.cur().id] || (P.state.comments[P.cur().id] = []);
      list.push({ id: uid(), author: 'User', text: v.trim(), at: Date.now() });
      P.updateSB(); P.markDirty();
      after && after();
    });
  }
  P.openCommentsPane = toggleCommentsPane;

  /* ============================ galleries ============================ */
  function layoutGallery(anchor) {
    const node = el('div', { style: 'padding:8px 10px' });
    node.appendChild(el('div', { class: 'mi-hdr' }, 'Office Theme'));
    const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(3,88px);gap:6px' });
    LAYOUT_ORDER.forEach(layId => {
      const lay = LAYOUTS[layId];
      const sw = el('div', { class: 'tr-sw', style: 'width:88px;height:64px', title: lay.nm });
      sw.innerHTML = layoutGlyph(lay);
      sw.addEventListener('mousedown', () => { P.closeAllPops(); P.setLayout(layId); });
      grid.appendChild(sw);
    });
    node.appendChild(grid);
    P.pop(anchor, node);
  }
  function layoutGlyph(lay) {
    // mini arrangement in an 88×64 box using placeholder rects
    let out = '';
    for (const ph of lay.ph) {
      const x = 4 + (ph.x / 1280) * 80, y = 3 + (ph.y / 720) * 58;
      const w = (ph.w / 1280) * 80, h = Math.max(2.5, (ph.h / 720) * 58);
      const col = ph.ph === 'title' ? '#C43E1C' : ph.ph === 'pic' ? '#8FAADC' : '#C9C9C9';
      if (ph.ph === 'title' && h > 6) {
        out += `<div style="position:absolute;left:${x}px;top:${y + h / 2 - 2}px;width:${w}px;height:4px;background:${col}"></div>`;
        continue;
      }
      out += `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;${ph.ph === 'pic' ? `height:${Math.min(h, 40)}px;background:${col};opacity:.75` : ''}">`;
      if (ph.ph !== 'pic') out += [0, 1, 2].map(i => `<div style="height:${Math.max(1.4, (h - 6) / 3 - 1.4)}px;background:${col};margin:1.2px 0"></div>`).join('');
      out += `</div>`;
    }
    return `<div style="position:absolute;inset:0">${out}</div><div class="tnm">${esc(lay.nm)}</div>`;
  }
  function themeTile(t, active) {
    const tc = t.t;
    const d = el('div', { class: 'tr-sw' + (active ? ' on' : ''), style: 'width:64px;height:48px', title: t.name });
    d.innerHTML = `<svg viewBox="0 0 64 48" style="flex:1;width:100%"><rect width="64" height="48" fill="#fff"/>
      <rect x="6" y="7" width="30" height="5" fill="${tc.a1}"/><rect x="6" y="16" width="52" height="3" fill="${tc.a3}"/>
      <rect x="6" y="22" width="52" height="3" fill="${tc.a3}" opacity=".7"/><rect x="6" y="28" width="40" height="3" fill="${tc.a3}" opacity=".5"/>
      <circle cx="55" cy="9" r="4" fill="${tc.a2}"/><text x="5" y="44" font-family="'${esc(tc.majFont)}',sans-serif" font-size="7.5" fill="${tc.dk1}">Aa</text>
      <rect x="14" y="40" width="6" height="6" fill="${tc.a1}"/><rect x="21" y="40" width="6" height="6" fill="${tc.a2}"/><rect x="28" y="40" width="6" height="6" fill="${tc.a6}"/></svg>
      <div class="tnm" style="font-size:8px">${esc(t.name)}</div>`;
    d.addEventListener('mousedown', () => applyTheme(t));
    return d;
  }
  function applyTheme(t) {
    P.pushHistory('Apply theme');
    P.state.theme = JSON.parse(JSON.stringify(t.t));
    P.state.variant = 0;
    P.applyThemeCSS();
    P.renderAll();
    P.sbMsg('Theme: ' + t.name);
    buildThemesStrip(); buildVariantsStrip();
  }
  function buildThemesStrip(hostEl) {
    const host = hostEl || $('#themes-strip');
    if (!host) return;
    host.innerHTML = '';
    THEMES.forEach(t => host.appendChild(themeTile(t, P.state.theme.name === t.name)));
    const dd = el('button', { class: 'rbig', style: 'min-width:20px;max-width:22px;justify-content:center' , title: 'More themes'});
    dd.innerHTML = '<span class="car" style="font-size:12px">▾</span>';
    dd.addEventListener('mousedown', () => themesGallery(dd));
    host.appendChild(dd);
  }
  function themesGallery(anchor) {
    const node = el('div', { style: 'padding:8px 10px' });
    node.appendChild(el('div', { class: 'mi-hdr' }, 'Office'));
    const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(3,64px);gap:6px' });
    THEMES.forEach(t => grid.appendChild(themeTile(t, P.state.theme.name === t.name)));
    grid.addEventListener('mousedown', () => setTimeout(() => P.closeAllPops(), 0));
    node.appendChild(grid);
    P.pop(anchor, node);
  }
  function variantTile(i) {
    const t = TH();
    const v = P.VARIANTS[i];
    const colors = v ? [v.a1, v.a2, v.a3] : [t.a1, t.a2, t.a3];
    const d = el('div', { class: 'tr-sw' + (P.state.variant === i ? ' on' : ''), style: 'width:34px;height:30px', title: 'Variant ' + (i + 1) });
    d.innerHTML = `<div style="display:flex;height:100%"><div style="flex:1;background:${colors[0]}"></div><div style="flex:1;background:${colors[1]}"></div><div style="flex:1;background:${colors[2]}"></div></div>`;
    d.addEventListener('mousedown', () => {
      P.pushHistory('Theme variant');
      P.state.variant = i;
      P.renderAll(); buildVariantsStrip();
      P.sbMsg('Variant ' + (i + 1));
    });
    return d;
  }
  function buildVariantsStrip(hostEl) {
    const host = hostEl || $('#variants-strip');
    if (!host) return;
    host.innerHTML = '';
    [0, 1, 2, 3].forEach(i => host.appendChild(variantTile(i)));
    const dd = el('button', { class: 'rbig', style: 'min-width:20px;max-width:22px;justify-content:center' });
    dd.innerHTML = '<span class="car" style="font-size:12px">▾</span>';
    dd.addEventListener('mousedown', () => variantsMenu(dd));
    host.appendChild(dd);
  }
  function variantsMenu(anchor) {
    const node = el('div');
    const mk = (lab, fn) => { const it = el('div', { class: 'mi' }, esc(lab)); it.addEventListener('mousedown', () => { P.closeAllPops(); fn(); }); node.appendChild(it); };
    mk('Colors', () => themeColorsMenu());
    mk('Fonts', () => themeFontsMenu());
    mk('Background Styles', () => bgStylesMenu());
    P.pop(anchor, node);
  }
  function themeColorsMenu() {
    const sets = [
      ['Office', ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']],
      ['Grayscale', ['#DDDDDD', '#B2B2B2', '#969696', '#808080', '#5F5F5F', '#4D4D4D']],
      ['Blue', ['#4472C4', '#5B9BD5', '#2E75B6', '#9DC3E6', '#1F4E79', '#BDD7EE']],
      ['Green', ['#70AD47', '#A9D18E', '#548235', '#C6E0B4', '#375623', '#E2EFDA']],
      ['Orange', ['#ED7D31', '#F4B183', '#C55A11', '#F8CBAD', '#833C00', '#FBE5D6']],
      ['Red', ['#C00000', '#FF0000', '#960000', '#FF6666', '#630000', '#FFCCCC']],
    ];
    const node = el('div', { style: 'padding:4px 0' });
    sets.forEach(([nm, cols]) => {
      const it = el('div', { class: 'mi', style: 'display:flex;align-items:center;gap:8px;padding-left:10px' });
      it.innerHTML = cols.map(c => `<span style="display:inline-block;width:9px;height:9px;background:${c};border:.5px solid rgba(0,0,0,.2)"></span>`).join('') + `<span style="margin-left:4px">${esc(nm)}</span>`;
      it.addEventListener('mousedown', () => {
        P.pushHistory('Theme colors');
        ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].forEach((k, i) => P.state.theme[k] = cols[i]);
        P.closeAllPops(); P.renderAll(); buildVariantsStrip(); buildThemesStrip();
      });
      node.appendChild(it);
    });
    P.pop($('#variants-strip'), node);
  }
  function themeFontsMenu() {
    const pairs = [['Calibri Light / Calibri', ['Calibri Light', 'Calibri']], ['Cambria / Calibri', ['Cambria', 'Calibri']], ['Georgia / Georgia', ['Georgia', 'Georgia']], ['Arial / Arial', ['Arial', 'Arial']], ['Trebuchet MS / Trebuchet MS', ['Trebuchet MS', 'Trebuchet MS']], ['Times New Roman / Times New Roman', ['Times New Roman', 'Times New Roman']] ];
    const node = el('div', { style: 'padding:4px 0' });
    pairs.forEach(([nm, [maj, min]]) => {
      const it = el('div', { class: 'mi', style: 'padding-left:10px' });
      it.innerHTML = `<span style="font-family:'${maj}'"><b>Aa</b></span>&nbsp;${esc(nm)}`;
      it.addEventListener('mousedown', () => {
        P.pushHistory('Theme fonts');
        P.state.theme.majFont = maj; P.state.theme.minFont = min;
        P.closeAllPops(); P.renderAll();
      });
      node.appendChild(it);
    });
    P.pop($('#variants-strip'), node);
  }
  function bgStylesMenu() {
    const node = el('div', { style: 'padding:6px 8px;display:flex;gap:6px' });
    ['#FFFFFF', '#F2F2F2', '#D9E5F1', '#262626'].forEach((c, i) => {
      const sw = el('div', { class: 'pal-sw', style: `width:34px;height:26px;background:${c};border:1px solid #aaa`, title: 'Style ' + (i + 1) });
      sw.addEventListener('mousedown', () => {
        P.pushHistory('Background style');
        P.state.slides.forEach(s => { if (!s.bg) s.bgStyle = c; });
        P.state.bgStyle = c === '#FFFFFF' ? null : c;
        P.closeAllPops(); P.renderAll();
      });
      node.appendChild(sw);
    });
    P.pop($('#variants-strip'), node);
  }

  /* -------- shapes gallery -------- */
  const SHAPE_GROUPS = [
    ['Lines', [['line', 'Line'], ['lineArrow', 'Arrow']]],
    ['Rectangles', [['rect', 'Rectangle'], ['roundRect', 'Rounded Rectangle']]],
    ['Basic Shapes', [['ellipse', 'Oval'], ['triangle', 'Triangle'], ['rtTriangle', 'Right Triangle'], ['diamond', 'Diamond'], ['pentagon', 'Pentagon'], ['hexagon', 'Hexagon'], ['octagon', 'Octagon'], ['parallelogram', 'Parallelogram'], ['trapezoid', 'Trapezoid'], ['cross', 'Cross'], ['cylinder', 'Can'], ['cube', 'Cube'], ['cone', 'Cone'], ['frameCorner', 'Frame'], ['donut', 'Donut'], ['pie', 'Pie'], ['smiley', 'Smiley Face'], ['sun', 'Sun'], ['moon', 'Moon'], ['cloud', 'Cloud'], ['heart', 'Heart'], ['lightning', 'Lightning Bolt']]],
    ['Block Arrows', [['arrowRight', 'Right Arrow'], ['arrowLeft', 'Left Arrow'], ['arrowUp', 'Up Arrow'], ['arrowDown', 'Down Arrow'], ['arrowLR', 'Left-Right Arrow'], ['chevron', 'Chevron']]],
    ['Stars and Banners', [['star4', '4-Point Star'], ['star5', '5-Point Star']]],
    ['Callouts', [['calloutRound', 'Oval Callout'], ['calloutSquare', 'Rectangular Callout']]],
  ];
  const QUICK_SHAPES = ['rect', 'roundRect', 'ellipse', 'triangle', 'arrowRight', 'line'];
  function shapesGallery(anchor) {
    const node = el('div', { style: 'padding:6px 8px;max-height:420px;overflow:auto;width:340px' });
    SHAPE_GROUPS.forEach(([gn, shapes]) => {
      node.appendChild(el('div', { class: 'mi-hdr' }, gn));
      const grid = el('div', { style: 'display:flex;flex-wrap:wrap;gap:2px;margin-bottom:4px' });
      shapes.forEach(([k, nm]) => {
        const b = el('button', { title: nm, style: 'width:34px;height:34px;border:1px solid transparent;background:#fff;cursor:pointer;padding:4px' });
        b.innerHTML = `<svg viewBox="-4 -4 108 108" style="width:100%;height:100%"><path d="${P.SHAPE_DEFS[k]}" fill="${k.startsWith('line') ? 'none' : '#DEEAF6'}" stroke="#2E75B6" stroke-width="3" ${k.startsWith('line') ? '' : ''}/>${k === 'line' ? '<line x1="4" y1="96" x2="96" y2="4" stroke="#2E75B6" stroke-width="4"/>' : ''}${k === 'lineArrow' ? '<line x1="4" y1="96" x2="96" y2="4" stroke="#2E75B6" stroke-width="4"/><path d="M96 4 L76 10 L90 24 Z" fill="#2E75B6"/>' : ''}</svg>`;
        b.addEventListener('mouseenter', () => b.style.borderColor = '#999');
        b.addEventListener('mouseleave', () => b.style.borderColor = 'transparent');
        b.addEventListener('mousedown', ev => { ev.preventDefault(); P.closeAllPops(); startInsertMode('shape', k); });
        grid.appendChild(b);
      });
      node.appendChild(grid);
    });
    P.pop(anchor, node);
  }
  function shapeGlyphForRibbon(k, active) {
    return `<svg viewBox="-4 -4 108 108" style="width:22px;height:22px">${k.startsWith('line') ? '<line x1="4" y1="96" x2="96" y2="4" stroke="#2E75B6" stroke-width="5"/>' : `<path d="${P.SHAPE_DEFS[k]}" fill="#DEEAF6" stroke="#2E75B6" stroke-width="4"/>`}</svg>`;
  }

  /* -------- insert mode (crosshair draw) -------- */
  let insertMode = null;
  function startInsertMode(kind, arg) {
    insertMode = { kind, arg };
    $('#stage').style.cursor = 'crosshair';
    P.sbMsg('Click and drag on the slide to draw — Esc to cancel');
  }
  P.installInsertMode = function () {
    $('#stage').addEventListener('mousedown', e => {
      if (!insertMode) return;
      e.preventDefault(); e.stopPropagation();
      const pt = P.stagePoint(e);
      const z = P.Z();
      const imk = insertMode; // snapshot: mu() clears insertMode before mk runs
      let dragging = false, ghost = null;
      const mk = (x, y, w, h) => {
        if (imk.kind === 'shape') {
          const defs = { line: { t: 'none' }, lineArrow: { t: 'none' } };
          const o = P.plainObj({ kind: 'shape', shape: imk.arg, x: clamp(x, 0, P.SW() - w), y: clamp(y, 0, P.SH() - h), w, h, fill: defs[imk.arg] || { t: 'theme', c: 'a1' }, line: { c: imk.arg.startsWith('line') ? '#2E5AAC' : '#B0280F', w: 1.25 }, paras: [P.newPara('', { bullet: 'none', align: 'c' })], fs: 16, anchor: 'm' });
          if (imk.arg.startsWith('line')) { o.paras = null; o.line = { c: '#2E2E2E', w: 1.5 }; if (imk.arg === 'lineArrow') o.arrowHead = true; }
          P.addObject(o);
        } else if (imk.kind === 'text') {
          const o = P.plainObj({ kind: 'text', x, y, w, h, fs: 16, paras: [P.newPara('', { bullet: 'none' })], anchor: 't', name: 'TextBox' });
          P.addObject(o);
          P.startTextEdit(o.id);
        }
      };
      const mm = ev => {
        dragging = true;
        const p2 = P.stagePoint(ev);
        const x = Math.min(pt.x, p2.x), y = Math.min(pt.y, p2.y);
        const w = Math.abs(p2.x - pt.x), h = Math.abs(p2.y - pt.y);
        ghost && ghost.remove();
        ghost = el('div', { style: `position:absolute;left:${x * z}px;top:${y * z}px;width:${w * z}px;height:${h * z}px;border:1px dashed var(--accD);background:rgba(196,62,28,.05);z-index:60` });
        $('#obj-overlay').appendChild(ghost);
        ghost._r = { x, y, w, h };
      };
      const mu = ev => {
        document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
        const r = ghost && ghost._r;
        ghost && ghost.remove();
        const im = insertMode; insertMode = null;
        $('#stage').style.cursor = '';
        if (im.kind === 'shape') {
          let w = r && dragging ? r.w : 160, h = r && dragging ? r.h : 120;
          if (im.arg.startsWith('line')) h = Math.max(2, h);
          const x = r && dragging ? r.x : clamp(pt.x - 80, 0, 1120);
          const y = r && dragging ? r.y : clamp(pt.y - 60, 0, 600);
          mk(x, y, Math.max(18, w), Math.max(im.arg.startsWith('line') ? 2 : 18, h));
          const n = P.firstSel();
        } else if (im.kind === 'text') {
          const w = r && dragging ? Math.max(60, r.w) : 220, h = r && dragging ? Math.max(24, r.h) : 40;
          mk(r && dragging ? r.x : clamp(pt.x - 110, 0, 1060), r && dragging ? r.y : clamp(pt.y - 20, 0, 680), w, h);
        }
      };
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    }, true);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && insertMode) { insertMode = null; $('#stage').style.cursor = ''; P.sbMsg(''); }
    });
  };
  P.startInsertMode = startInsertMode;

  /* ============================ HOST builders ============================ */
  const HOST_BUILDERS = {};
  (function registerHosts() {
    const reg = () => ({
      font: fontHost, drawing: drawingHost, themes: themesHost, variants: variantsHost,
      transitions: transitionsHost, trtiming: trTimingHost, animations: animationsHost,
      antiming: anTimingHost, showchk: showchkHost,
    });
    HOST_BUILDERS.install = () => Object.assign(HOST_BUILDERS, reg());
  })();
  function fontListPop(inp) {
    const node = el('div', { style: 'max-height:300px;overflow:auto;min-width:190px' });
    FONTS.forEach(f => {
      const it = el('div', { class: 'mi', style: `font-family:'${f}',sans-serif;font-size:12.5px;padding-left:8px` }, esc(f));
      it.addEventListener('mousedown', () => { applyFontName(f); P.closeAllPops(); });
      node.appendChild(it);
    });
    P.pop(inp, node);
  }
  function applyFontName(f) {
    if (P.editing) { P.applyRunCmd('font', f); }
    else {
      P.applyObjTextStyle({ font: f });
      const so = P.selObjs().filter(o => P.isTextish(o));
      if (so.length) { P.pushHistory('Font'); so.forEach(o => o.font = f); P.renderMain(); }
    }
    updateRibbonState();
  }
  function applyFontSize(sz) {
    sz = clamp(+sz || 18, 1, 400);
    if (P.editing) P.applyRunCmd('size', sz);
    else {
      const so = P.selObjs().filter(o => P.isTextish(o));
      if (so.length) { P.pushHistory('Font size'); so.forEach(o => { o.fs = sz; o.paras && o.paras.forEach(p => p.runs.forEach(r => { if (r.size != null) r.size = sz; r.size = sz; })); }); P.renderMain(); P.markDirty(); }
    }
    updateRibbonState();
  }
  const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
  function stepFontSize(du) {
    const ctx = curTextCtx();
    const curSz = ctx.size || 18;
    let next = SIZES.find(s => s > curSz + 0.01);
    let prev = [...SIZES].reverse().find(s => s < curSz - 0.01);
    const tgt = du > 0 ? (next || curSz + 8) : (prev || Math.max(1, curSz - 8));
    applyFontSize(tgt);
  }
  function fontHost(body) {
    const r1 = el('div', { class: 'rrow' });
    const finp = el('input', { class: 'rin', id: 'rb-font-name', style: 'width:128px', spellcheck: 'false' });
    finp.addEventListener('focus', () => fontListPop(finp));
    finp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyFontName(finp.value.trim() || 'Calibri'); } });
    const fsel = el('div', { class: 'rin-sel', style: 'width:128px' });
    const fin = el('input', { class: 'fv', id: 'rb-font-name-i', spellcheck: 'false' });
    fin.addEventListener('focus', () => fontListPop(fin));
    fin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyFontName(fin.value.trim() || 'Calibri'); } });
    fin.addEventListener('input', () => { $('#rb-font-name').value = fin.value; });
    fsel.appendChild(fin);
    fsel.appendChild(el('span', { class: 'car' }, '▾'));
    const sinc = el('input', { class: 'rin', id: 'rb-font-size', style: 'width:38px;text-align:center' });
    sinc.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyFontSize(+sinc.value); } });
    sinc.addEventListener('blur', () => { if (sinc.value) applyFontSize(+sinc.value); });
    const hiddenInp = el('input', { style: 'display:none', id: 'rb-font-name' });
    r1.appendChild(fsel); r1.appendChild(sinc); r1.appendChild(hiddenInp);
    [['aup', 'Increase Font Size'], ['adown', 'Decrease Font Size'], ['clearfmt', 'Clear All Formatting']].forEach(([ic, tip]) => {
      const b = el('button', { class: 'rsmall', id: 'rb-' + ic, title: tip, html: svgIcon(ic) });
      b.addEventListener('mousedown', e => {
        e.preventDefault();
        if (ic === 'aup') stepFontSize(1);
        else if (ic === 'adown') stepFontSize(-1);
        else { if (P.editing) { document.execCommand('removeFormat'); P.onEditInput(); } else P.applyObjTextStyle({ b: false, i: false, u: false, strike: false, color: null, size: null, font: null, hl: null }); }
      });
      r1.appendChild(b);
    });
    const menuCol = el('div', { class: 'rin-sel', style: 'width:16px;justify-content:center' , title: 'Case & spacing'});
    const r2 = el('div', { class: 'rrow' });
    [['bold', 'B', 'Bold (Ctrl+B)', 'font-weight:700'], ['italic', 'I', 'Italic (Ctrl+I)', 'font-style:italic'], ['underline', 'U', 'Underline (Ctrl+U)', 'text-decoration:underline'], ['strike', 'S', 'Strikethrough', 'text-decoration:line-through'], ['shadowT', 'S', 'Text Shadow', 'text-shadow:1px 1px 1px #888']].forEach(([ic, lab, tip, stl]) => {
      const b = el('button', { class: 'rsmall', id: 'rb-' + ic, title: tip, style: 'min-width:23px;justify-content:center;padding:0 3px' });
      b.innerHTML = `<span style="font-size:12px;${stl}">${lab}</span>`;
      b.addEventListener('mousedown', e => { e.preventDefault(); runFontFlag(ic === 'shadowT' ? 'sh' : ic[0] === 's' && ic !== 'shadowT' ? 'strike' : ic); });
      r2.appendChild(b);
    });
    [['spacing', 'Character Spacing'], ['casebtn', 'Change Case'], ['highlightbtn', 'Text Highlight Color'], ['fontcolbtn', 'Font Color']].forEach(([ic, tip]) => {
      const b = el('button', { class: 'rsmall', id: 'rb-' + ic, title: tip, style: 'padding:0 3px' });
      b.innerHTML = svgIcon(ic === 'spacing' ? 'spacing' : ic === 'casebtn' ? 'abcd' : ic === 'highlightbtn' ? 'highlight' : 'fontcol') + '<span class="car" style="font-size:7px;margin-left:1px">▾</span>';
      b.addEventListener('mousedown', e => {
        e.preventDefault();
        if (ic === 'spacing') spacingMenu(b);
        else if (ic === 'casebtn') caseMenu(b);
        else if (ic === 'highlightbtn') P.palettePopup(b, { noneLabel: 'No Color', onPick: c => { if (P.editing) P.applyRunCmd('hl', c === '__none__' ? null : c); else P.applyObjTextStyle({ hl: c === '__none__' ? null : c }); } });
        else P.palettePopup(b, { autoLabel: 'Automatic', onPick: c => { const cc = c === '__none__' ? null : (c && c.startsWith('#') ? c : P.themeColor(c)); if (P.editing) P.applyRunCmd('color', cc || '#000000'); else P.applyObjTextStyle({ color: c === P.themeColor && false ? null : cc }); } });
      });
      r2.appendChild(b);
    });
    const holder = el('div', { class: 'rcol' });
    holder.appendChild(r1); holder.appendChild(r2);
    body.appendChild(holder);
  }
  function runFontFlag(kind) {
    const map = { bold: 'b', italic: 'i', underline: 'u', strike: 'strike', sh: 'sh' };
    const k = map[kind];
    if (P.editing) {
      if (k === 'sh') { document.execCommand('insertHTML', false, null); P.sbMsg('Shadow applies to whole objects — select the object'); return; }
      P.applyRunCmd(k);
    } else {
      const so = P.selObjs().filter(o => P.isTextish(o));
      if (!so.length) return;
      const cur = so[0].paras && so[0].paras[0] && so[0].paras[0].runs[0] && so[0].paras[0].runs[0][k];
      P.applyObjTextStyle({ [k]: !cur });
    }
    updateRibbonState();
  }
  function spacingMenu(anchor) {
    const node = el('div');
    [['Very Tight', '-1px'], ['Tight', '-0.5px'], ['Normal', '0'], ['Loose', '1.5px'], ['Very Loose', '3px']].forEach(([nm, v]) => {
      const it = el('div', { class: 'mi' }, esc(nm));
      it.addEventListener('mousedown', () => { P.closeAllPops(); P.sbMsg('Spacing applied: ' + nm); P.applyObjTextStyle({ sp: v === '0' ? null : v }); if (P.editing) { const o = P.objById(P.editing); } });
      node.appendChild(it);
    });
    P.pop(anchor, node);
  }
  function caseMenu(anchor) {
    const node = el('div');
    [['UPPERCASE', t => t.toUpperCase()], ['lowercase', t => t.toLowerCase()], ['Capitalize Each Word', t => t.replace(/\b\w/g, m => m.toUpperCase())]].forEach(([nm, fn]) => {
      const it = el('div', { class: 'mi' }, esc(nm));
      it.addEventListener('mousedown', () => {
        P.closeAllPops();
        P.pushHistory('Change case');
        const transform = o => { o.paras && o.paras.forEach(p => p.runs.forEach(r => r.t = fn(r.t))); };
        const so = P.selObjs().filter(o => P.isTextish(o));
        so.forEach(transform);
        if (P.editing) { const o = P.objById(P.editing); if (o) { transform(o); P.reRenderEditText(o); } }
        P.renderMain(); P.markDirty();
      });
      node.appendChild(it);
    });
    P.pop(anchor, node);
  }
  function drawingHost(body) {
    const quick = el('div', { class: 'rcol', style: 'justify-content:center;flex-direction:row;align-items:center;gap:0;padding:0 3px' });
    QUICK_SHAPES.forEach(k => {
      const b = el('button', { class: 'rsmall', style: 'padding:2px', title: k });
      b.innerHTML = shapeGlyphForRibbon(k);
      b.addEventListener('mousedown', e => { e.preventDefault(); startInsertMode('shape', k); });
      quick.appendChild(b);
    });
    const more = el('button', { class: 'rsmall', title: 'More shapes', style: 'padding:2px 3px' });
    more.innerHTML = '<span class="car" style="font-size:10px">▾</span>';
    more.addEventListener('mousedown', () => shapesGallery(more));
    quick.appendChild(more);
    body.appendChild(quick);
    const col = el('div', { class: 'rcol' });
    [['sfill', 'Shape Fill', 'paint'], ['sline', 'Shape Outline', 'penc'], ['sfx', 'Shape Effects', 'fx']].forEach(([id, nm, ic]) => {
      const b = el('button', { class: 'rsmall', id: 'rb-' + id });
      b.innerHTML = (id === 'sfill' ? svgIcon('formatbg') : id === 'sline' ? svgIcon('editDoc') : svgIcon('stark')) + `<span>${nm}</span><span class="car" style="margin-left:3px">▾</span>`;
      b.addEventListener('mousedown', () => {
        if (id === 'sfill') P.palettePopup(b, {
          noneLabel: 'No Fill', onPick: c => {
            const so = P.selObjs().filter(o => o.kind === 'shape' || o.kind === 'text');
            if (!so.length) { P.sbMsg('Select a shape first'); return; }
            P.pushHistory('Shape fill');
            so.forEach(o => { if (o.kind === 'shape') o.fill = c === '__none__' ? { t: 'none' } : c && !c.startsWith('#') ? { t: 'theme', c } : { t: 'solid', c }; });
            P.renderAll(); P.markDirty();
          }
        });
        else if (id === 'sline') outlineMenu(b);
        else effectsMenu(b);
      });
      col.appendChild(b);
    });
    const qs = el('button', { class: 'rsmall', id: 'rb-quickstyles', title: 'Shape Quick Styles' });
    qs.innerHTML = svgIcon('quickstyles') + `<span>Quick Styles</span><span class="car" style="margin-left:3px">▾</span>`;
    qs.addEventListener('mousedown', () => quickStylesGallery(qs));
    col.appendChild(qs);
    body.appendChild(col);
  }
  const outlineMenu = anchor => {
    const node = el('div', { style: 'padding:6px 0' });
    const wRow = el('div', { class: 'mi-hdr' }, 'Weight');
    node.appendChild(wRow);
    [0.75, 1.25, 2.25, 3.5, 4.5, 6].forEach(w => {
      const it = el('div', { class: 'mi', style: 'display:flex;align-items:center;gap:9px' });
      it.innerHTML = `<span style="display:inline-block;width:42px;height:${w}px;background:#444"></span><span>${w} pt</span>`;
      it.addEventListener('mousedown', () => { applyOutline({ w }); P.closeAllPops(); });
      node.appendChild(it);
    });
    node.appendChild(el('div', { class: 'mi-sep' }));
    const noL = el('div', { class: 'mi' }, 'No Outline');
    noL.addEventListener('mousedown', () => { applyOutline({ none: true }); P.closeAllPops(); });
    node.appendChild(noL);
    P.pop(anchor, node);
  };
  function applyOutline(patch) {
    const so = P.selObjs().filter(o => o.kind === 'shape');
    if (!so.length) { P.sbMsg('Select a shape first'); return; }
    P.pushHistory('Shape outline');
    so.forEach(o => {
      if (patch.none) o.line = 'none';
      else o.line = { ...(o.line && o.line !== 'none' ? o.line : { c: '#B0280F' }), ...patch };
    });
    P.renderAll(); P.markDirty();
  }
  function effectsMenu(anchor) {
    const node = el('div');
    ['None', 'Shadow'].forEach(nm => {
      const it = el('div', { class: 'mi' }, esc(nm));
      it.addEventListener('mousedown', () => {
        const so = P.selObjs().filter(o => o.kind === 'shape' || o.kind === 'pic');
        if (!so.length) { P.sbMsg('Select an object first'); return; }
        P.pushHistory('Shape effects');
        so.forEach(o => o.shadow = nm === 'Shadow');
        P.closeAllPops(); P.renderAll(); P.markDirty();
      });
      node.appendChild(it);
    });
    P.pop(anchor, node);
  }
  function quickStylesGallery(anchor) {
    const t = TH();
    const presets = [
      { fill: t.a1, line: shade(t.a1, -25), txt: '#fff' }, { fill: t.a2, line: shade(t.a2, -25), txt: '#fff' },
      { fill: t.a3, line: shade(t.a3, -25), txt: '#fff' }, { fill: t.a4, line: shade(t.a4, -30), txt: '#3F3F3F' },
      { fill: t.a5, line: shade(t.a5, -25), txt: '#fff' }, { fill: t.a6, line: shade(t.a6, -25), txt: '#fff' },
      { fill: '#FFFFFF', line: t.a1, txt: '#262626' }, { fill: '#262626', line: 'none', txt: '#fff' },
    ];
    const node = el('div', { style: 'padding:8px;display:grid;grid-template-columns:repeat(4,64px);gap:5px' });
    presets.forEach((p, i) => {
      const sw = el('button', { style: `width:64px;height:42px;background:${p.fill};border:1.6px solid ${p.line === 'none' ? 'transparent' : p.line};color:${p.txt};font-size:10px;cursor:pointer` }, 'Style ' + (i + 1));
      sw.addEventListener('mousedown', () => {
        const so = P.selObjs().filter(o => o.kind === 'shape');
        if (!so.length) { P.sbMsg('Select a shape first'); P.closeAllPops(); return; }
        P.pushHistory('Quick style');
        so.forEach(o => {
          o.fill = { t: 'solid', c: p.fill };
          o.line = p.line === 'none' ? 'none' : { c: p.line, w: 1.25 };
          o.paras && o.paras.forEach(pa => pa.runs.forEach(r => r.color = p.txt));
        });
        P.closeAllPops(); P.renderAll(); P.markDirty();
      });
      node.appendChild(sw);
    });
    P.pop(anchor, node);
  }
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    const f = x => clamp(Math.round(x + 255 * pct / 100), 0, 255);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  P.shade = shade;

  function themesHost(body) {
    const strip = el('div', { id: 'themes-strip', style: 'display:flex;align-items:center;gap:4px;padding:2px 2px 0' });
    body.appendChild(strip);
    buildThemesStrip(strip);
  }
  function variantsHost(body) {
    const strip = el('div', { id: 'variants-strip', style: 'display:flex;align-items:center;gap:4px;padding:2px 2px 0' });
    body.appendChild(strip);
    buildVariantsStrip(strip);
  }
  function transitionsHost(body) {
    const strip = el('div', { id: 'transitions-strip', style: 'display:flex;align-items:center;gap:4px;padding:2px 2px 0' });
    body.appendChild(strip);
    const kinds = ['none', 'fade', 'push', 'wipe', 'split', 'blinds', 'checker', 'dissolve'];
    kinds.slice(0, 6).forEach(k => strip.appendChild(trTile(k)));
    const dd = el('button', { class: 'rbig', style: 'min-width:20px;max-width:22px;justify-content:center' });
    dd.innerHTML = '<span class="car" style="font-size:12px">▾</span>';
    dd.addEventListener('mousedown', () => transitionsGallery(dd));
    strip.appendChild(dd);
  }
  function trTile(kind) {
    const def = TRANSITIONS.find(t => t.id === kind);
    const d = el('div', { class: 'tr-sw', 'data-tr': kind, title: def.nm, style: 'width:58px;height:44px' });
    const ic = { none: 'tr_none', fade: 'tr_fade', push: 'tr_push', wipe: 'tr_wipe', split: 'tr_split', blinds: 'tr_blinds', checker: 'tr_checker', dissolve: 'tr_dissolve' }[kind];
    const iconSvg = svgIcon(ic).replace('<svg ', `<svg style="flex:1;width:100%" `);
    d.innerHTML = iconSvg + `<div class="tnm">${def.nm}</div>`;
    d.addEventListener('mousedown', () => setTransition(kind));
    return d;
  }
  function transitionsGallery(anchor) {
    const node = el('div', { style: 'padding:6px 8px' });
    node.appendChild(el('div', { class: 'an-h' }, 'SUBTLE & EXCITING'));
    const grid = el('div', { class: 'tr-grid', style: 'grid-template-columns:repeat(4,58px)' });
    TRANSITIONS.forEach(t => grid.appendChild(trTile(t.id)));
    grid.addEventListener('mousedown', () => setTimeout(() => P.closeAllPops(), 30));
    node.appendChild(grid);
    P.pop(anchor, node);
  }
  function trTimingHost(body) {
    const col = el('div', { class: 'rcol' });
    const eo = el('button', { class: 'rsmall', id: 'rb-effectopt' });
    eo.innerHTML = svgIcon('effectopt') + '<span>Effect Options</span><span class="car" style="margin-left:3px">▾</span>';
    eo.addEventListener('mousedown', () => {
      const t = curTr();
      const dirs = TR_DIRS[t.kind];
      if (!dirs) { P.sbMsg('This transition has no direction options'); return; }
      const node = el('div');
      dirs.forEach(([id, nm]) => {
        const it = el('div', { class: 'mi' + (t.dir === id ? ' cked' : '') }, esc(nm));
        it.addEventListener('mousedown', () => { P.closeAllPops(); setTransition(t.kind, id); });
        node.appendChild(document.createTextNode(''));
        node.appendChild(it);
      });
      P.pop(eo, node);
    });
    col.appendChild(eo);
    const durRow = el('div', { class: 'rrow', title: 'Duration (seconds)' });
    durRow.innerHTML = svgIcon('duration') + '<span style="font-size:10.5px">Duration</span>';
    const din = el('input', { class: 'rin', id: 'rb-tr-dur', style: 'width:44px;text-align:center', value: String(curTr().dur.toFixed(2)) });
    din.addEventListener('change', () => { const t = curTr(); t.dur = clamp(parseFloat(din.value) || 0.7, 0.25, 10); din.value = t.dur.toFixed(2); P.markDirty(); P.renderThumbs(); });
    durRow.appendChild(din);
    col.appendChild(durRow);
    const aa = el('button', { class: 'rsmall' });
    aa.innerHTML = svgIcon('applyall') + '<span>Apply To All</span>';
    aa.addEventListener('mousedown', () => {
      P.pushHistory('Apply transition to all');
      const t = curTr();
      P.state.slides.forEach(s => s.transition = JSON.parse(JSON.stringify(t)));
      P.markDirty(); P.renderThumbs(); P.sbMsg('Transition applied to all slides');
    });
    col.appendChild(aa);
    body.appendChild(col);
    const col2 = el('div', { class: 'rcol', style: 'justify-content:center' });
    const mkChk = (lab, id, def) => {
      const row = el('label', { class: 'chkrow', style: 'margin:1px 0;font-size:10.5px' });
      const cb = el('input', { type: 'checkbox', id });
      cb.checked = def;
      row.appendChild(cb); row.appendChild(el('span', null, lab));
      return { row, cb };
    };
    const oc = mkChk('On Mouse Click', 'rb-tr-oc', curTr().advClick !== false);
    const af = mkChk('After:', 'rb-tr-af', !!(curTr().advAfter > 0));
    const sec = el('input', { class: 'rin', style: 'width:44px;text-align:center', value: curTr().advAfter ? (curTr().advAfter / 1000).toFixed(2) : '00:05.00' });
    oc.cb.addEventListener('change', () => { curTr().advClick = oc.cb.checked; P.markDirty(); });
    af.cb.addEventListener('change', () => { curTr().advAfter = af.cb.checked ? parseTime(sec.value) : 0; P.markDirty(); });
    sec.addEventListener('change', () => { if (af.cb.checked) { curTr().advAfter = clamp(parseTime(sec.value), 0.2, 3599); sec.value = (curTr().advAfter / 1000).toFixed(2); P.markDirty(); } });
    col2.appendChild(oc.row);
    const afRow = el('div', { style: 'display:flex;align-items:center;gap:3px' });
    afRow.appendChild(af.row); afRow.appendChild(sec);
    col2.appendChild(afRow);
    body.appendChild(col2);
  }
  function parseTime(v) {
    v = String(v).trim();
    if (v.includes(':')) { const [m, s] = v.split(':'); return (parseFloat(m) * 60 + parseFloat(s || 0)) * 1000; }
    return parseFloat(v) * 1000 || 5000;
  }
  function animationsHost(body) {
    const strip = el('div', { id: 'animations-strip', style: 'display:flex;align-items:center;gap:4px;padding:2px 2px 0' });
    body.appendChild(strip);
    const none = el('div', { class: 'an-sw', title: 'None' });
    none.innerHTML = svgIcon('noanim') + '<div class="tnm">None</div>';
    none.addEventListener('mousedown', () => addAnim(null));
    strip.appendChild(none);
    ['fade', 'flyin', 'floatin', 'split', 'wipe'].forEach(eff => strip.appendChild(anTile(eff)));
    const dd = el('button', { class: 'rbig', style: 'min-width:20px;max-width:22px;justify-content:center' });
    dd.innerHTML = '<span class="car" style="font-size:12px">▾</span>';
    dd.addEventListener('mousedown', () => animGallery(dd));
    strip.appendChild(dd);
  }
  function anTile(eff) {
    const def = ANIMS[eff];
    const d = el('div', { class: 'an-sw', title: def.nm, style: 'width:52px;height:42px' });
    d.innerHTML = svgIcon(def.icon).replace('<svg ', '<svg style="flex:1;width:100%" ') + `<div class="tnm">${def.nm}</div>`;
    d.addEventListener('mousedown', () => addAnim(eff));
    return d;
  }
  function animGallery(anchor) {
    const node = el('div', { style: 'padding:4px 6px;max-width:290px' });
    [['ENTRANCE', 'in'], ['EMPHASIS', 'em'], ['EXIT', 'out']].forEach(([gn, cat]) => {
      node.appendChild(el('div', { class: 'an-h' }, gn));
      const grid = el('div', { class: 'an-grid', style: 'grid-template-columns:repeat(5,52px)' });
      Object.entries(ANIMS).filter(([, d]) => d.cat === cat).forEach(([eff]) => {
        const t = anTile(eff);
        t.addEventListener('mousedown', () => setTimeout(() => P.closeAllPops(), 30));
        grid.appendChild(t);
      });
      node.appendChild(grid);
    });
    P.pop(anchor, node);
  }
  function anTimingHost(body) {
    const col = el('div', { class: 'rcol' });
    const stSel = el('div', { class: 'rin-sel', style: 'width:96px', title: 'Start' });
    stSel.innerHTML = '<span class="v" id="rb-an-start-v">On Click</span><span class="car">▾</span>';
    stSel.addEventListener('mousedown', () => {
      const node = el('div');
      [['click', 'On Click'], ['with', 'With Previous'], ['after', 'After Previous']].forEach(([id, nm]) => {
        const it = el('div', { class: 'mi' }, esc(nm));
        it.addEventListener('mousedown', () => { P.closeAllPops(); applyAnimTiming({ start: id }); });
        node.appendChild(it);
      });
      P.pop(stSel, node);
    });
    col.appendChild(stSel);
    [['Duration', 'dur', 0.5], ['Delay', 'delay', 0]].forEach(([nm, k]) => {
      const row = el('div', { class: 'rrow' });
      row.appendChild(el('span', { style: 'font-size:10.5px' }, nm));
      const inp = el('input', { class: 'rin', id: 'rb-an-' + k, style: 'width:42px;text-align:center', value: k === 'dur' ? '00.50' : '00.00' });
      inp.addEventListener('change', () => applyAnimTiming({ [k]: clamp(parseFloat(inp.value) || 0, 0, 59) * 1000 }));
      row.appendChild(inp);
      col.appendChild(row);
    });
    body.appendChild(col);
    const eo = el('button', { class: 'rsmall' });
    eo.innerHTML = svgIcon('effectopt') + '<span>Effect Options</span><span class="car" style="margin-left:3px">▾</span>';
    eo.addEventListener('mousedown', () => {
      const a = activeAnim();
      if (!a) { P.sbMsg('Select an animation in the Animation Pane'); return; }
      const def = ANIMS[a.eff];
      if (!def || !def.dirs) { P.sbMsg('This effect has no direction options'); return; }
      const node = el('div');
      def.dirs.forEach(([id, nm]) => {
        const it = el('div', { class: 'mi' + (a.dir === id ? ' cked' : '') }, esc(nm));
        it.addEventListener('mousedown', () => { P.closeAllPops(); applyAnimTiming({ dir: id }); });
        node.appendChild(it);
      });
      P.pop(eo, node);
    });
    body.appendChild(eo);
  }
  function activeAnim() {
    const list = P.cur().anims || [];
    return list.find(a => a.id === activeAnimId) || list[list.length - 1];
  }
  function applyAnimTiming(patch) {
    const a = activeAnim();
    if (!a) { P.sbMsg('Select an animation in the Animation Pane'); return; }
    P.pushHistory('Animation timing');
    Object.assign(a, patch);
    P.markDirty(); updateSidePane();
    P.sbMsg('Updated: ' + (ANIMS[a.eff] || {}).nm);
  }
  function showchkHost(body) {
    [['ruler', 'Ruler'], ['gridlines', 'Gridlines'], ['guides', 'Guides']].forEach(([id, lab]) => {
      const row = el('label', { class: 'chkrow', style: 'margin:2px 0' });
      const cb = el('input', { type: 'checkbox', id: 'chk-' + id });
      cb.checked = !!P.state.show?.[id];
      cb.addEventListener('change', () => {
        P.state.show = P.state.show || {};
        P.state.show[id] = cb.checked;
        P.renderAll();
      });
      row.appendChild(cb); row.appendChild(el('span', null, lab));
      const col = el('div', { class: 'rcol' });
      col.appendChild(row);
      body.appendChild(col);
    });
  }

  /* ============================ commands ============================ */
  const CMDS = {
    paste: { exec: () => P.pasteClipboard() },
    cut: { exec: () => P.copySelected(true) },
    copy: { exec: () => P.copySelected(false) },
    fmtpaint: {
      exec: () => {
        const o = P.firstSel();
        if (!o || !P.isTextish(o)) { P.sbMsg('Select an object with formatting to paint'); return; }
        const src = JSON.parse(JSON.stringify({ paras: o.paras, fs: o.fs, fill: o.fill, line: o.line }));
        P.sbMsg('Format Painter — click an object to apply');
        const h = e => {
          const hit = e.target.closest('.obj');
          if (hit) {
            const t = P.objById(hit.dataset.oid);
            if (t && t !== o) {
              P.pushHistory('Format painter');
              if (t.paras && src.paras) {
                t.fs = src.fs;
                const srcRuns = src.paras[0] && src.paras[0].runs[0];
                if (srcRuns) t.paras.forEach(p => p.runs.forEach(r => Object.assign(r, { b: srcRuns.b, i: srcRuns.i, u: srcRuns.u, color: srcRuns.color, size: srcRuns.size, font: srcRuns.font })));
              }
              if (t.kind === 'shape') { if (src.fill !== undefined) t.fill = JSON.parse(JSON.stringify(src.fill)); t.line = src.line ? JSON.parse(JSON.stringify(src.line)) : t.line; }
              P.renderAll();
            }
          }
          document.removeEventListener('mousedown', h, true);
        };
        setTimeout(() => document.addEventListener('mousedown', h, true), 30);
      }
    },
    newslide: { exec: (b) => newSlideMenu(b) }, newslide2: { exec: (b) => newSlideMenu(b) },
    layout: { exec: (b) => layoutGallery(b) },
    resetph: {
      exec: () => {
        P.pushHistory('Reset slide');
        P.setLayout(P.cur().layout); // re-map placeholders to layout defaults, keep content
        P.sbMsg('Slide reset to layout');
      }
    },
    bullets: {
      exec: (b) => {
        const node = el('div', { style: 'padding:6px 8px' });
        [['None', 'none'], ['• bullet', 'char'], ['– dash bullet', 'dash'], ['▪ square bullet', 'square']].forEach(([nm, v]) => {
          const it = el('div', { class: 'mi' }, esc(nm));
          it.addEventListener('mousedown', () => {
            P.closeAllPops();
            if (P.editing) P.applyParaCmd('bullet', { none: 'none', dash: 'char', square: 'char' }[v]);
            else P.applyObjTextStyle({ bullet: v === 'none' ? 'none' : 'char' }, true);
            if (v !== 'none' && v !== 'char') setBulletChar(v === 'dash' ? '–' : '▪');
          });
          node.appendChild(it);
        });
        P.pop(b, node);
      }
    },
    numbering: {
      exec: (b) => {
        const node = el('div', { style: 'padding:6px 8px' });
        [['None', 'none'], ['1. 2. 3.', 'decimal'], ['I. II. III.', 'upper-roman'], ['a. b. c.', 'lower-alpha']].forEach(([nm, v]) => {
          const it = el('div', { class: 'mi' }, esc(nm));
          it.addEventListener('mousedown', () => {
            P.closeAllPops();
            if (P.editing) P.applyParaCmd('bullet', v === 'none' ? 'none' : 'num');
            else P.applyObjTextStyle({ bullet: v === 'none' ? 'none' : 'num' }, true);
            if (v !== 'none') setNumFmt(v);
          });
          node.appendChild(it);
        });
        P.pop(b, node);
      }
    },
    inddec: { exec: () => { if (P.editing) P.applyParaCmd('level-'); else shiftLevel(-1); } },
    indinc: { exec: () => { if (P.editing) P.applyParaCmd('level+'); else shiftLevel(1); } },
    lspacing: {
      exec: (b) => {
        const node = el('div');
        [1, 1.5, 2, 2.5, 3].forEach(v => {
          const it = el('div', { class: 'mi' }, v.toFixed(1));
          it.addEventListener('mousedown', () => {
            P.closeAllPops();
            if (P.editing) P.applyParaCmd('line', v);
            else P.applyObjTextStyle({ line: v === 1 ? null : v }, true);
          });
          node.appendChild(it);
        });
        P.pop(b, node);
      }
    },
    al: { exec: () => setAlign('l') }, ac: { exec: () => setAlign('c') }, ar: { exec: () => setAlign('r') }, aj: { exec: () => setAlign('j') },
    twocont: { exec: () => P.sbMsg('Use Insert > Shapes to draw side-by-side content boxes') },
    textdir: {
      exec: (b) => {
        const node = el('div');
        [['Horizontal', ''], ['Rotate all text 90°', '90'], ['Rotate all text 270°', '270']].forEach(([nm, v]) => {
          const it = el('div', { class: 'mi' }, esc(nm));
          it.addEventListener('mousedown', () => {
            P.closeAllPops();
            const so = P.selObjs();
            if (!so.length) { P.sbMsg('Select an object first'); return; }
            P.pushHistory('Text direction');
            so.forEach(o => o.rot = v === '' ? 0 : (v === '90' ? 90 : 270));
            P.renderMain(); P.markDirty();
          });
          node.appendChild(it);
        });
        P.pop(b, node);
      }
    },
    aligntext: {
      exec: (b) => {
        const node = el('div');
        [['Top', 't'], ['Middle', 'm'], ['Bottom', 'b']].forEach(([nm, v]) => {
          const it = el('div', { class: 'mi' }, esc(nm));
          it.addEventListener('mousedown', () => {
            P.closeAllPops();
            const so = P.selObjs().filter(o => P.isTextish(o));
            if (!so.length) { P.sbMsg('Select a text object first'); return; }
            P.pushHistory('Align text');
            so.forEach(o => o.anchor = v);
            P.renderMain(); P.markDirty();
          });
          node.appendChild(it);
        });
        P.pop(b, node);
      }
    },
    find: { exec: () => findDialog() },
    replace: { exec: () => replaceDialog() },
    selmenu: {
      exec: (b) => {
        const node = el('div');
        const mk = (lab, fn) => { const it = el('div', { class: 'mi' }, esc(lab)); it.addEventListener('mousedown', () => { P.closeAllPops(); fn(); }); node.appendChild(it); };
        mk('Select All', () => { P.state.sel.objs = P.cur().objects.map(o => o.id); P.renderMain(); });
        mk('Select Objects', () => { P.sbMsg('Click objects with the mouse; Shift adds to the selection'); });
        P.pop(b, node);
      }
    },
    intable: { exec: (b) => tableInsertPop(b) },
    inpictures: { exec: () => P.insertPictureDialog() },
    inshapes: { exec: (b) => shapesGallery(b) },
    inchart: { exec: () => chartInsertDialog() },
    intextbox: { exec: () => startInsertMode('text') },
    inhdrftr: { exec: () => headerFooterDialog() },
    inslidenum: { exec: () => headerFooterDialog(true) },
    inwordart: { exec: (b) => wordArtGallery(b) },
    insymbol: { exec: () => symbolDialog() },
    incomment: { exec: () => { toggleCommentsPane(true); newCommentDialog(() => { const sp = $('#sidepane'); const body = $('.sp-body', sp); body && renderComments(body); }); } },
    slidesize: {
      exec: (b) => {
        const node = el('div');
        const mk = (lab, fn) => { const it = el('div', { class: 'mi' }, esc(lab)); it.addEventListener('mousedown', () => { P.closeAllPops(); fn(); }); node.appendChild(it); };
        mk('Widescreen (16:9)', () => setSlideSize(1280, 720, 'Widescreen 16:9'));
        mk('Standard (4:3)', () => setSlideSize(960, 720, 'Standard 4:3'));
        mk('Custom Slide Size...', () => slideSizeDialog());
        P.pop(b, node);
      }
    },
    formatbg: { exec: () => formatBackgroundDialog() },
    trpreview: { exec: () => previewTransition() },
    anpreview: { exec: () => previewAllAnims() },
    addanimbtn: { exec: (b) => animGallery(b) },
    animpanebtn: { exec: () => openAnimPane() },
    showbegin: { exec: () => startSlideShow(0) },
    showcurrent: { exec: () => startSlideShow(P.state.active) },
    setupshow: { exec: () => setupShowDialog() },
    hideslidebtn: { exec: () => P.toggleHideSlide() },
    spelling: { exec: () => spellingRun() },
    cmnew: { exec: (b) => CMDS.incomment.exec(b) },
    cmdel: {
      exec: () => {
        const list = P.state.comments[P.cur().id] || [];
        if (!list.length) { P.sbMsg('No comments on this slide'); return; }
        P.pushHistory('Delete comments');
        P.state.comments[P.cur().id] = [];
        P.updateSB(); P.markDirty();
        const sp = $('#sidepane'); if (!sp.hidden && sp.dataset.kind === 'comments') { const bd = $('.sp-body', sp); bd && renderComments(bd); }
        P.sbMsg('Comments deleted on this slide');
      }
    },
    cmprev: { exec: () => jumpComment(-1) }, cmnext: { exec: () => jumpComment(1) },
    cmshow: { exec: () => toggleCommentsPane(false) },
    vnormal: { exec: () => setView('normal') },
    vsorter: { exec: () => setView('sorter') },
    vreading: { exec: () => startReading() },
    vzdialog: { exec: () => zoomDialog() },
    v100: { exec: () => P.setZoom(1, 'z') },
    vfit: { exec: () => P.setZoom('fit', 'z') },
  };
  function setBulletChar(ch) {
    const so = P.selObjs().filter(o => P.isTextish(o));
    so.forEach(o => o.paras && o.paras.forEach(p => p.bulletChar = ch));
    if (!P.editing) P.renderMain();
  }
  function setNumFmt(fmt) {
    const so = P.selObjs().filter(o => P.isTextish(o));
    so.forEach(o => o.paras && o.paras.forEach(p => p.numFmt = fmt));
    P.renderMain();
  }
  function setAlign(a) {
    if (P.editing) P.applyParaCmd('align', a);
    else P.applyObjTextStyle({ align: a }, true);
    updateRibbonState();
  }
  function shiftLevel(d) {
    const so = P.selObjs().filter(o => P.isTextish(o));
    if (!so.length) return;
    P.pushHistory('Change list level');
    so.forEach(o => o.paras && o.paras.forEach(p => p.level = clamp((p.level || 0) + d, 0, 4)));
    P.renderMain(); P.markDirty();
  }
  function setSlideSize(w, h, nm) {
    P.pushHistory('Slide size');
    P.state.sizeW = w; P.state.sizeH = h;
    P.renderAll();
    P.sbMsg('Slide size: ' + nm);
  }
  function slideSizeDialog() {
    const w = el('input', { type: 'text', value: ((P.state.sizeW || 1280) / 96).toFixed(2) });
    const h = el('input', { type: 'text', value: ((P.state.sizeH || 720) / 96).toFixed(2) });
    P.dlg({
      title: 'Slide Size', width: 380,
      body: el('div', null,
        el('div', { class: 'fld' }, el('span', null, 'Width (inches):'), w),
        el('div', { class: 'fld' }, el('span', null, 'Height (inches):'), h),
        el('div', { style: 'color:#777;font-size:10.5px' }, '16:9 = 13.33 x 7.50 in · 4:3 = 10.00 x 7.50 in')),
      buttons: [{ label: 'OK', pri: true, fn: () => { setSlideSize(clamp(Math.round((parseFloat(w.value) || 13.33) * 96), 240, 3360), clamp(Math.round((parseFloat(h.value) || 7.5) * 96), 200, 2400), 'Custom'); } }, { label: 'Cancel' }],
    });
  }
  function formatBackgroundDialog() {
    const t = P.TH();
    let picked = (P.cur().bg && P.cur().bg.color) || '#FFFFFF';
    const chips = el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;margin:8px 0' });
    const cols = [t.lt1, t.lt2, t.a1, t.a2, t.a3, t.a4, t.a5, t.a6, '#262626', '#595959'];
    cols.forEach(c => {
      const sw = el('span', { class: 'pal-sw', style: `width:24px;height:24px;background:${c};${c === '#FFFFFF' ? 'box-shadow:inset 0 0 0 1px #bbb' : ''}` });
      sw.addEventListener('mousedown', () => { picked = c; $$('.pal-sw', chips).forEach(x => x.style.outline = ''); sw.style.outline = '2px solid #000'; });
      chips.appendChild(sw);
    });
    const cust = el('input', { type: 'color', value: '#FFFFFF', style: 'width:100%;height:30px' });
    cust.addEventListener('input', () => picked = cust.value);
    const applyAll = el('input', { type: 'checkbox' });
    P.dlg({
      title: 'Format Background', width: 400,
      body: el('div', null,
        el('div', { class: 'fld-h' }, 'Solid fill'),
        chips,
        el('div', { class: 'fld' }, el('span', null, 'Custom color:'), cust),
        el('label', { class: 'chkrow' }, applyAll, el('span', null, 'Apply to all slides'))),
      buttons: [{
        label: 'OK', pri: true, fn: () => {
          P.pushHistory('Format background');
          if (applyAll.checked) P.state.slides.forEach(s => s.bg = { color: picked });
          else P.cur().bg = { color: picked };
          P.renderAll(); P.markDirty();
        }
      }, { label: 'Cancel' }],
    });
  }
  function newSlideMenu(anchor) {
    const node = el('div', { style: 'padding:8px 10px' });
    node.appendChild(el('div', { class: 'mi-hdr' }, 'Office Theme'));
    const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(3,88px);gap:6px' });
    LAYOUT_ORDER.forEach(layId => {
      const lay = LAYOUTS[layId];
      const sw = el('div', { class: 'tr-sw', style: 'width:88px;height:64px', title: lay.nm });
      sw.innerHTML = layoutGlyph(lay);
      sw.addEventListener('mousedown', () => { P.closeAllPops(); P.addSlide(layId); });
      grid.appendChild(sw);
    });
    node.appendChild(grid);
    node.appendChild(el('div', { class: 'mi-sep' }));
    const dup = el('div', { class: 'mi' }, 'Duplicate Selected Slide');
    dup.addEventListener('mousedown', () => { P.closeAllPops(); P.dupSlide(); });
    node.appendChild(dup);
    P.pop(anchor, node);
  }
  function tableInsertPop(anchor) {
    const node = el('div', { style: 'padding:8px 10px' });
    node.appendChild(el('div', { style: 'font-size:11px;color:#444;margin-bottom:6px' }, 'Insert Table'));
    const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(10,17px);grid-auto-rows:17px;gap:2px' });
    const lab = el('div', { style: 'text-align:center;font-size:10.5px;color:#666;margin-top:4px' }, '2 x 2 Table');
    for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
      const cell = el('div', { style: 'background:#fff;border:1px solid #C6C6C6;cursor:pointer' });
      cell.dataset.r = r; cell.dataset.c = c;
      cell.addEventListener('mouseenter', () => {
        $$('div', grid).forEach(x => {
          const on = +x.dataset.r <= r && +x.dataset.c <= c;
          x.style.background = on ? '#F4B08F' : '#fff';
          x.style.borderColor = on ? '#C43E1C' : '#C6C6C6';
        });
        lab.textContent = `${c + 1} x ${r + 1} Table`;
      });
      cell.addEventListener('mousedown', () => {
        P.closeAllPops();
        const o = P.newTableObject(240, 180, 800, 42 * (r + 1) + 4, r + 1, c + 1);
        P.addObject(o);
        P.sbMsg(`Table ${c + 1} × ${r + 1} — click a cell twice to type`);
      });
      grid.appendChild(cell);
    }
    node.appendChild(grid);
    node.appendChild(lab);
    P.pop(anchor, node);
  }
  function chartInsertDialog() {
    const kinds = [['col', 'Column'], ['bar', 'Bar'], ['line', 'Line'], ['pie', 'Pie']];
    let picked = 'col';
    const grid = el('div', { style: 'display:flex;gap:8px;margin:6px 0 10px' });
    kinds.forEach(([k, nm]) => {
      const card = el('div', { class: 'tr-sw', style: 'width:90px;height:64px', title: nm });
      card.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center">${svgIcon(k === 'pie' ? 'chartIc' : 'chartIc')}</div><div class="tnm" style="font-size:10px">${nm}</div>`;
      card.addEventListener('mousedown', () => { picked = k; $$('.tr-sw', grid).forEach(x => x.classList.remove('on')); card.classList.add('on'); });
      if (k === 'col') card.classList.add('on');
      grid.appendChild(card);
    });
    P.dlg({
      title: 'Insert Chart', width: 430, body: el('div', null, el('div', { class: 'fld-h' }, 'Choose a chart type'), grid),
      buttons: [{
        label: 'OK', pri: true, fn: () => {
          const chart = {
            type: picked, title: 'Chart Title', legend: 'right',
            cats: ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
            series: [{ name: 'Series 1', vals: [4.3, 2.5, 3.5, 4.5] }, { name: 'Series 2', vals: [2.4, 4.4, 1.8, 2.8] }, { name: 'Series 3', vals: [2, 2, 3, 5] }],
          };
          if (picked === 'pie') chart.series = chart.series.slice(0, 1);
          const o = P.plainObj({ kind: 'chart', x: 256, y: 140, w: 768, h: 440, chart });
          P.addObject(o);
          P.sbMsg('Chart inserted — right-click it to edit data');
        }
      }, { label: 'Cancel' }],
    });
  }
  function wordArtGallery(anchor) {
    const t = P.TH();
    const styles = [
      { fill: '#000', line: null, sz: 36, nm: 'Fill - Black' },
      { fill: t.a1, line: shade(t.a1, -35), sz: 36, nm: 'Fill - Accent 1' },
      { fill: t.a2, line: shade(t.a2, -35), sz: 36, nm: 'Fill - Accent 2' },
      { fill: '#fff', line: t.a1, sz: 36, nm: 'White fill, Accent outline' },
      { fill: t.a4, line: shade(t.a4, -40), sz: 36, nm: 'Fill - Accent 4' },
      { fill: t.a6, line: shade(t.a6, -35), sz: 36, nm: 'Fill - Accent 6' },
    ];
    const node = el('div', { style: 'padding:8px;display:grid;grid-template-columns:repeat(3,86px);gap:6px' });
    styles.forEach(s => {
      const b = el('button', { style: `width:86px;height:56px;background:#fff;border:1px solid #C6C6C6;cursor:pointer;font-size:26px;font-weight:700;color:${s.fill};${s.line ? `-webkit-text-stroke:1px ${s.line};` : ''}` }, 'A');
      b.addEventListener('mousedown', () => {
        P.closeAllPops();
        const o = P.plainObj({ kind: 'text', x: 400, y: 320, w: 480, h: 70, fs: s.sz, anchor: 'm', al: 'c', paras: [{ runs: [{ t: 'Your text here', b: true, color: s.fill, font: null }], align: 'c', level: 0, bullet: 'none', spaceAfter: null, line: null }] });
        P.addObject(o);
        P.startTextEdit(o.id, true);
      });
      node.appendChild(b);
    });
    P.pop(anchor, node);
  }
  function symbolDialog() {
    const SYMS = 'Ω μ π ∞ ≈ ≠ ≤ ≥ ± × ÷ √ ∑ ∫ ∂ ∆ ∇ € £ ¥ ¢ § ¶ † ‡ © ® ™ ° ‰ · • – — ′ ″ ← → ↑ ↓ ↔ ⇐ ⇒ α β γ δ ε θ λ σ φ ψ ω ∀ ∃ ∈ ∉ ⊂ ∪ ∩ ∅'.split(' ');
    const grid = el('div', { class: 'sym-grid' });
    SYMS.forEach(s => {
      const c = el('div', { class: 'sym-cell', title: s }, s);
      c.addEventListener('mousedown', () => {
        insertSymbol(s);
        P._closeDlg();
      });
      grid.appendChild(c);
    });
    P.dlg({ title: 'Symbol', body: grid, width: 370, buttons: [{ label: 'Close' }] });
  }
  function insertSymbol(s) {
    const txtEl = P.editing && document.querySelector('#slide #txt-' + P.editing);
    if (txtEl) {
      if (txtEl.contains(document.activeElement)) txtEl.focus();
      else if (window._pptSavedSel && P.restoreSelInEdit) P.restoreSelInEdit(window._pptSavedSel);
      document.execCommand('insertText', false, s);
      P.onEditInput();
    } else {
      const o = P.firstSel();
      if (o && P.isTextish(o) && o.paras) {
        P.pushHistory('Insert symbol');
        const p = o.paras[o.paras.length - 1];
        let r = p.runs[p.runs.length - 1];
        if (!r) { r = { t: '' }; p.runs.push(r); }
        r.t += s;
        P.renderMain(); P.markDirty();
      } else P.sbMsg('Click into a text box first');
    }
  }
  function headerFooterDialog(slideNumOnly) {
    const hf = P.state.hf || (P.state.hf = { dateOn: false, dateAuto: true, dateText: '', footerOn: false, footer: '', numOn: false, noTitle: false });
    const dCk = el('input', { type: 'checkbox' }); dCk.checked = !!hf.dateOn;
    const rAuto = el('input', { type: 'radio', name: 'hfdt' }); rAuto.checked = hf.dateAuto !== false;
    const rFix = el('input', { type: 'radio', name: 'hfdt' }); rFix.checked = hf.dateAuto === false;
    const dtIn = el('input', { type: 'text', value: hf.dateText || '', style: 'width:150px' });
    const nCk = el('input', { type: 'checkbox' }); nCk.checked = slideNumOnly ? true : !!hf.numOn;
    const fCk = el('input', { type: 'checkbox' }); fCk.checked = !!hf.footerOn;
    const fIn = el('input', { type: 'text', value: hf.footer || '', style: 'flex:1' });
    const tCk = el('input', { type: 'checkbox' }); tCk.checked = !!hf.noTitle;
    const sync = () => {
      dtIn.disabled = !dCk.checked || !rFix.checked;
      fIn.disabled = !fCk.checked;
      rAuto.disabled = rFix.disabled = !dCk.checked;
      dtIn.style.background = fIn.style.background = '';
    };
    [dCk, rAuto, rFix, fCk].forEach(c => c.addEventListener('change', sync));
    sync();
    const prev = el('div', { class: 'hf-prev' },
      el('div', { class: 'hf-prev-cap' }, 'Preview'),
      el('div', { class: 'hf-prev-slide' },
        el('div', { class: 'hf-pv hf-pv-date' }), el('div', { class: 'hf-pv hf-pv-foot' }), el('div', { class: 'hf-pv hf-pv-num' })));
    const updPrev = () => {
      prev.querySelector('.hf-pv-date').style.outline = dCk.checked ? '2px solid #C43E1C' : '1px solid #b8b0aa';
      prev.querySelector('.hf-pv-foot').style.outline = fCk.checked ? '2px solid #C43E1C' : '1px solid #b8b0aa';
      prev.querySelector('.hf-pv-num').style.outline = nCk.checked ? '2px solid #C43E1C' : '1px solid #b8b0aa';
    };
    [dCk, fCk, nCk].forEach(c => c.addEventListener('change', updPrev));
    setTimeout(updPrev, 0);
    P.dlg({
      title: 'Header and Footer', width: 470,
      body: el('div', { class: 'hf-dlg' },
        el('div', null,
          el('fieldset', { class: 'grp' }, el('legend', null, 'Include on slide'),
            el('div', { class: 'chkrow' }, dCk, el('span', null, 'Date and time')),
            el('div', { class: 'radrow', style: 'padding-left:22px' }, rAuto, el('span', null, 'Update automatically')),
            el('div', { class: 'radrow', style: 'padding-left:22px' }, rFix, el('span', null, 'Fixed'), dtIn),
            el('div', { class: 'chkrow' }, nCk, el('span', null, 'Slide number')),
            el('div', { class: 'chkrow' }, fCk, el('span', null, 'Footer'), fIn)),
          el('div', { class: 'chkrow', style: 'margin-top:8px' }, tCk, el('span', null, "Don't show on title slide"))),
        prev),
      buttons: [
        { label: 'Apply to All', pri: true, fn: () => applyHF(collect(true)) },
        { label: 'Apply', fn: () => applyHF(collect(false)) },
        { label: 'Cancel' },
      ],
    });
    function collect(all) {
      return {
        dateOn: dCk.checked, dateAuto: rAuto.checked, dateText: dtIn.value.trim(),
        numOn: nCk.checked, footerOn: fCk.checked, footer: fIn.value,
        noTitle: tCk.checked, all,
      };
    }
  }
  function applyHF(hf) {
    P.pushHistory('Header and footer');
    if (!hf.all) {
      // Apply to current slide only: store per-slide override
      const s = P.cur();
      s.hfOverride = hf;
      if (hf.numOn && !((P.state.hf || {}).numOn)) { /* keep global off */ }
    } else {
      P.state.hf = hf;
      P.state.slides.forEach(s => delete s.hfOverride);
    }
    P.renderAll(); P.markDirty();
    P.sbMsg(hf.all ? 'Applied to all slides' : 'Applied to this slide');
  }
  function spellingRun() {
    // gather words, naive check with tiny dictionary of common typos
    const typos = { teh: 'the', recieve: 'receive', adress: 'address', seperate: 'separate', occurance: 'occurrence', definately: 'definitely', wich: 'which', thier: 'their', beleive: 'believe', untill: 'until', succes: 'success', presenation: 'presentation' };
    const hits = [];
    P.state.slides.forEach((s, si) => s.objects.forEach(o => {
      if (!o.paras) return;
      o.paras.forEach((p, pi) => p.runs.forEach(r => {
        r.t.split(/\s+/).forEach(w => {
          const c = w.toLowerCase().replace(/[^a-z']/g, '');
          if (typos[c]) hits.push({ si, o, pi, bad: c, fix: typos[c], w });
        });
      }));
    }));
    if (!hits.length) { P.msgBox('Microsoft PowerPoint', 'Spelling check complete. You\u2019re good to go!'); return; }
    let i = 0;
    const showNext = () => {
      if (i >= hits.length) { P.msgBox('Microsoft PowerPoint', 'Spelling check complete. You\u2019re good to go!'); return; }
      const h = hits[i];
      P.selectSlide(h.si);
      P.state.sel.objs = [h.o.id];
      P.renderAll();
      P.dlg({
        title: 'Spelling', width: 360,
        body: el('div', null,
          el('div', { class: 'fld' }, el('span', null, 'Not in dictionary:'), el('b', null, esc(h.w))),
          el('div', { class: 'fld' }, el('span', null, 'Change to:'), el('span', null, esc(h.fix)))),
        buttons: [
          { label: 'Change', pri: true, fn: () => { P.pushHistory('Spelling'); h.o.paras[h.pi].runs.forEach(r => r.t = r.t.replace(new RegExp(h.bad, 'gi'), m => m[0] === m[0].toUpperCase() ? h.fix[0].toUpperCase() + h.fix.slice(1) : h.fix)); P.renderMain(); i++; showNext(); return false; } },
          { label: 'Ignore', fn: () => { i++; showNext(); } },
        ],
      });
    };
    showNext();
  }
  function jumpComment(dlt) {
    const list = P.state.comments[P.cur().id] || [];
    if (!list.length) { P.sbMsg('No comments on this slide'); return; }
    toggleCommentsPane(true);
  }
  function zoomDialog() {
    const cur = Math.round(P.Z() * 100);
    const radios = [400, 200, 100, 66, 50, 33].map(p => {
      const lab = el('label', { class: 'chkrow' });
      const rb = el('input', { type: 'radio', name: 'zm', value: p });
      rb.checked = Math.abs(cur - p) < 3;
      lab.appendChild(rb); lab.appendChild(el('span', null, p + '%'));
      return lab;
    });
    const fitB = el('label', { class: 'chkrow' });
    const fitR = el('input', { type: 'radio', name: 'zm', value: 'fit' });
    fitR.checked = P.state.zoom === 'fit';
    fitB.appendChild(fitR); fitB.appendChild(el('span', null, 'Fit'));
    P.dlg({
      title: 'Zoom', width: 220,
      body: el('div', null, ...radios, fitB),
      buttons: [{
        label: 'OK', pri: true, fn: () => {
          const v = document.querySelector('input[name="zm"]:checked').value;
          P.setZoom(v === 'fit' ? 'fit' : +v / 100, 'z');
        }
      }, { label: 'Cancel' }],
    });
  }
  function setupShowDialog() {
    const ss = P.state.showSetup || (P.state.showSetup = { type: 'speaker', loop: false, from: 1, to: 0, manual: false });
    const speaker = el('input', { type: 'radio', name: 'st', value: 'speaker' });
    speaker.checked = ss.type === 'speaker';
    const kiosk = el('input', { type: 'radio', name: 'st', value: 'kiosk' });
    kiosk.checked = ss.type === 'kiosk';
    const windowed = el('input', { type: 'radio', name: 'st', value: 'window' });
    windowed.checked = ss.type === 'window';
    const fIn = el('input', { type: 'text', value: String(ss.from || 1), style: 'width:40px' });
    const tIn = el('input', { type: 'text', value: ss.to ? String(ss.to) : '', style: 'width:40px' });
    const loop = el('input', { type: 'checkbox' }); loop.checked = ss.type === 'kiosk' || ss.loop;
    const man = el('input', { type: 'checkbox' }); man.checked = ss.manual;
    P.dlg({
      title: 'Set Up Show', width: 440,
      body: el('div', null,
        el('fieldset', { class: 'grp' }, el('legend', null, 'Show type'),
          el('label', { class: 'chkrow' }, speaker, el('span', null, 'Presented by a speaker (full screen)')),
          el('label', { class: 'chkrow' }, windowed, el('span', null, 'Browsed by an individual (window)')),
          el('label', { class: 'chkrow' }, kiosk, el('span', null, 'Browsed at a kiosk (full screen, loops)'))),
        el('fieldset', { class: 'grp' }, el('legend', null, 'Show slides'),
          el('label', { class: 'chkrow' }, el('span', null, `From ${' '}`), fIn, el('span', null, ' to '), tIn, el('span', { style: 'color:#777;margin-left:6px' }, `(blank = last, ${P.state.slides.length})`))),
        el('label', { class: 'chkrow' }, loop, el('span', null, "Loop continuously until 'Esc'")),
        el('label', { class: 'chkrow' }, man, el('span', null, 'Advance slides manually (ignore timings)'))),
      buttons: [{
        label: 'OK', pri: true, fn: () => {
          const type = kiosk.checked ? 'kiosk' : windowed.checked ? 'window' : 'speaker';
          P.state.showSetup = { type, loop: loop.checked || type === 'kiosk', from: clamp(parseInt(fIn.value) || 1, 1, P.state.slides.length), to: clamp(parseInt(tIn.value) || 0, 0, P.state.slides.length), manual: man.checked };
          P.sbMsg('Show setup saved');
        }
      }, { label: 'Cancel' }],
    });
  }

  /* -------- find & replace -------- */
  function findRuns(q) {
    const hits = [];
    if (!q) return hits;
    const ql = q.toLowerCase();
    P.state.slides.forEach((s, si) => s.objects.forEach(o => {
      if (!o.paras) return;
      o.paras.forEach(p => p.runs.forEach(r => { if (r.t.toLowerCase().includes(ql)) hits.push({ si, o }); }));
    }));
    return hits;
  }
  let findIdx = 0;
  function findDialog() {
    const inp = el('input', { type: 'text', style: 'width:100%;height:24px;border:1px solid #BFBFBF;padding:0 6px' });
    const cnt = el('div', { style: 'color:#777;font-size:10.5px;margin-top:6px' }, '');
    const go = dir => {
      const hits = findRuns(inp.value);
      if (!hits.length) { cnt.textContent = 'No matches'; return; }
      findIdx = (findIdx + (dir || 0) + hits.length) % hits.length;
      const h = hits[findIdx];
      P.selectSlide(h.si);
      P.state.sel.objs = [h.o.id];
      P.renderMain();
      cnt.textContent = `${findIdx + 1} of ${hits.length}`;
    };
    inp.addEventListener('input', () => { findIdx = 0; go(0); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.shiftKey ? go(-1) : go(1); } });
    P.dlg({
      title: 'Find', width: 360, body: el('div', null, el('div', { class: 'fld' }, el('span', null, 'Find what:'), inp), cnt),
      buttons: [{ label: 'Find Next', pri: true, fn: () => { go(1); return false; } }, { label: 'Close' }],
    });
    setTimeout(() => inp.focus(), 50);
  }
  function replaceDialog() {
    const f = el('input', { type: 'text', style: 'width:100%;height:24px;border:1px solid #BFBFBF;padding:0 6px' });
    const r = el('input', { type: 'text', style: 'width:100%;height:24px;border:1px solid #BFBFBF;padding:0 6px' });
    P.dlg({
      title: 'Replace', width: 380,
      body: el('div', null,
        el('div', { class: 'fld' }, el('span', null, 'Find what:'), f),
        el('div', { class: 'fld' }, el('span', null, 'Replace with:'), r)),
      buttons: [
        { label: 'Replace All', pri: true, fn: () => { const n = doReplace(f.value, r.value); P.sbMsg(n + ' replacement(s) made'); } },
        { label: 'Close' },
      ],
    });
  }
  function doReplace(fv, rv) {
    if (!fv) return 0;
    let n = 0;
    P.pushHistory('Replace all');
    const re = new RegExp(fv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    P.state.slides.forEach(s => s.objects.forEach(o => {
      if (!o.paras) return;
      o.paras.forEach(p => p.runs.forEach(run => {
        const m = run.t.replace(re, () => { n++; return rv; });
        run.t = m;
      }));
    }));
    P.renderAll(); P.markDirty();
    return n;
  }
  P.doReplace = doReplace;

  /* ============================ context menus ============================ */
  function objCtxMenu(e, o) {
    const multi = P.selObjs().length > 1;
    const items = [];
    if (P.isTextish(o) && o.kind !== 'table') items.push({ label: 'Edit Text', icon: 'editDoc', action: () => P.startTextEdit(o.id) });
    if ((o.kind === 'picph' || (o.kind === 'pic' && !o.src))) items.push({ label: 'Insert Picture...', icon: 'pictures', action: () => P.insertPictureDialog(o) });
    if (o.kind === 'pic' && o.src) items.push({ label: 'Crop', icon: 'crop', action: () => P.startCropMode(o) });
    if (o.kind === 'chart') items.push({ label: 'Edit Data', icon: 'chartIc', action: () => P.chartDataDialog(o) });
    if (o.kind === 'table') items.push({ label: 'Table Tools: Insert Row/Col or Delete (right-click a cell)', disabled: true });
    items.push('-');
    items.push({ label: 'Cut', icon: 'cut', action: () => P.copySelected(true) });
    items.push({ label: 'Copy', icon: 'copy', action: () => P.copySelected(false) });
    items.push({ label: 'Paste', icon: 'paste', action: () => P.pasteClipboard(), disabled: !P.clipObjs.length });
    items.push({ label: 'Duplicate', icon: 'dupslide', action: () => P.dupSelected() });
    items.push({ label: 'Delete', icon: 'del', action: () => P.deleteSelected() });
    items.push('-');
    items.push({ label: 'Bring to Front', icon: 'arrange', action: () => P.orderObjects('front') });
    items.push({ label: 'Send to Back', icon: 'arrange', action: () => P.orderObjects('back') });
    if (multi) items.push({ label: 'Group', icon: 'group', action: () => P.groupSelected() });
    if (o.grp) items.push({ label: 'Ungroup', icon: 'group', action: () => P.ungroupSelected() });
    P.ctxMenu(e, items);
  }
  function slideAreaCtxMenu(e) {
    P.ctxMenu(e, [
      { label: 'Paste', icon: 'paste', action: () => P.pasteClipboard(), disabled: !P.clipObjs.length },
      { label: 'New Slide', icon: 'plus', action: () => P.addSlide() },
      { label: 'Layout', icon: 'layout', action: () => layoutGallery({ left: e.clientX, bottom: e.clientY, top: e.clientY, right: e.clientX }) },
      '-',
      { label: 'Format Background...', icon: 'formatbg', action: () => formatBackgroundDialog() },
    ]);
  }
  function slideCtxMenu(e, i) {
    P.ctxMenu(e, [
      { label: 'New Slide', icon: 'plus', action: () => P.addSlide() },
      { label: 'Duplicate Slide', icon: 'dupslide', action: () => P.dupSlide(i) },
      { label: 'Delete Slide', icon: 'del', action: () => P.deleteSlide(i) },
      '-',
      { label: state.hiddenLabel || (P.state.slides[i].hidden ? 'Unhide Slide' : 'Hide Slide'), icon: 'hideSlide', action: () => P.toggleHideSlide(i) },
      '-',
      { label: 'Layout', icon: 'layout', action: () => layoutGallery({ left: e.clientX, bottom: e.clientY, top: e.clientY, right: e.clientX }) },
      { label: 'Photo/Notes...', icon: 'notesIc', action: () => $('#sb-notes').click() },
    ]);
  }
  P.objCtxMenu = objCtxMenu; P.slideAreaCtxMenu = slideAreaCtxMenu; P.slideCtxMenu = slideCtxMenu;

  /* ============================ init ============================ */
  P.runCmdId = function (id) {
    const b = document.getElementById('rb-' + id);
    if (b) {
      // Ribbon commands bind to mousedown (with preventDefault), not click —
      // dispatch the full press sequence so programmatic runs behave like a mouse.
      ['mousedown', 'mouseup', 'click'].forEach(t => b.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
      return true;
    }
    // Button not mounted (its ribbon tab isn't shown): run the command directly.
    if (CMDS[id] && CMDS[id].exec) { CMDS[id].exec(null); return true; }
    return false;
  };
  P.initRibbonApp = function () {
    HOST_BUILDERS.install();
    buildChrome();
    renderTabs();
    renderRibbon();
    $('#stage').tabIndex = 0;
    P.installInsertMode();
  };
})();
