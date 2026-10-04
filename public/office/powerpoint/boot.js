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

/* boot.js — splash + launch */
(function () {
'use strict';
function splash() {
  const sp = document.createElement('div');
  sp.className = 'splash';
  sp.style.cssText = 'position:fixed;inset:0;background:#C43E1C;color:#fff;z-index:5000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:\'Segoe UI\',Calibri,sans-serif';
  sp.innerHTML = `
    <svg viewBox="0 0 32 32" width="72" height="72"><rect x="1" y="1" width="30" height="30" rx="5" fill="#fff"/><path d="M9 8h8a7 7 0 010 14h-3v4H9V8zm5 5v4h2.5a2 2 0 000-4H14z" fill="#C43E1C"/></svg>
    <div style="font-size:26px;font-weight:300;letter-spacing:.3px">PowerPoint</div>
    <div style="opacity:.85;font-size:13px">Starting...</div>
    <div style="margin-top:10px;width:150px;height:3px;background:rgba(255,255,255,.3);border-radius:2px;overflow:hidden"><div id="splash-bar" style="height:100%;width:0;background:#fff;transition:width .5s ease"></div></div>`;
  document.body.appendChild(sp);
  return sp;
}
function recoverSession() {
  try {
    const raw = XKV.get('pc.session');
    if (!raw) return false;
    const sess = JSON.parse(raw);
    if (!sess || !sess.json) return false;
    const j = JSON.parse(sess.json);
    if (!j.slides || !j.slides.length) return false;
    P.loadJSON(j);
    P.setPresName(j.presName || sess.name || 'Presentation1', true);
    P.state.dirty = true; // session restore counts as unsaved edits
    return true;
  } catch (e) {
    return false;
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  const sp = splash();
  await XKV.ready;
  /* theme: hydrate persisted dark preference + titlebar ☾ toggle (chrome-only dark) */
  (function initTheme() {
    const apply = v => document.body.classList.toggle('dark', !!v);
    let v = false;
    try { v = XKV.get('pc.theme') === 'dark'; } catch (e) { }
    apply(v);
    const right = document.getElementById('tb-right');
    if (right) {
      const btn = document.createElement('button');
      btn.id = 'tb-theme';
      btn.title = 'Toggle dark / light mode';
      btn.textContent = v ? '☀' : '☾';
      btn.addEventListener('click', () => {
        v = !document.body.classList.contains('dark');
        apply(v);
        btn.textContent = v ? '☀' : '☾';
        try { XKV.set('pc.theme', v ? 'dark' : 'light'); } catch (e) { }
      });
      const win = right.querySelector('.win-btn');
      right.insertBefore(btn, win || right.firstChild);
    }
    window.P_setDark = apply;
  })();
  const bar = sp.querySelector('#splash-bar');
  setTimeout(() => { if (bar) bar.style.width = '60%'; }, 60);
  setTimeout(() => {
    try {
      const restored = recoverSession();
      if (!restored) {
        P.state = P.freshPres();
        P.applyThemeCSS();
        P.setPresName('Presentation1', true);
      }
      P.layoutStage();
      P.initRibbonApp();
      P.initKeyboard();
      P.initApp4();
      P.renderAll();
      P.updateUndoButtons();
      P.pushHistory('Open'); // baseline undo anchor
      if (restored) P.sbMsg('Recovered your last session — Ctrl+S to save');
      else P.saveDoc(true);
      if (bar) bar.style.width = '100%';
    } catch (err) {
      console.error(err);
      sp.innerHTML = '<div style="font-size:18px">PowerPoint could not start</div><div style="font-size:12px;opacity:.85">' + String(err && err.message || err) + '</div><button onclick="XKV.del(\'pc.session\');location.reload()" style="margin-top:14px;padding:6px 16px;border:none;border-radius:3px;cursor:pointer">Clear session and retry</button>';
      return;
    }
    setTimeout(() => {
      sp.style.transition = 'opacity .25s';
      sp.style.opacity = '0';
      setTimeout(() => sp.remove(), 280);
    }, 480);
  }, 60);
});
})();
