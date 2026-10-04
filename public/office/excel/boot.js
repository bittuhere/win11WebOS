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
  sp.innerHTML = `
    <svg viewBox="0 0 32 32" width="72" height="72"><rect x="1" y="1" width="30" height="30" rx="5" fill="#fff"/><path d="M10 9h3l3 7 3-7h3l-4.5 9.5L22 23h-3l-3-6.5L13 23h-3l4.5-9z" fill="#217346"/></svg>
    <div style="font-size:26px;font-weight:600;letter-spacing:.3px">Excel</div>
    <div style="opacity:.85">Starting...</div>`;
  document.body.appendChild(sp);
  return sp;
}
document.addEventListener('DOMContentLoaded', () => {
  const sp = splash();
  setTimeout(async () => {
    try {
      /* hydrate IndexedDB-backed storage BEFORE the app reads the last session */
      if (window.XKV) await XKV.ready;
      window.X.init();
    } catch (err) {
      console.error(err);
      alert('Excel failed to start: ' + err.message);
      return;
    }
    setTimeout(() => {
      sp.style.transition = 'opacity .25s';
      sp.style.opacity = '0';
      setTimeout(() => sp.remove(), 280);
    }, 420);
  }, 30);
});
})();
