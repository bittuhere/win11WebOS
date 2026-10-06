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

/* boot: launch the app once the DOM is ready (IndexedDB hydrated first) */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await XKV.ready;
    /* theme: hydrate persisted dark preference + titlebar ☾ toggle */
    (function initTheme() {
      const apply = v => document.body.classList.toggle('dark', !!v);
      let v = false;
      try { v = XKV.get('wc.theme') === 'dark'; } catch (e) { }
      apply(v);
      const wc = document.querySelector('.tb-right .wc') || document.querySelector('.tb-right');
      if (wc) {
        const btn = document.createElement('button');
        btn.id = 'tb-theme';
        btn.title = 'Toggle dark / light mode';
        btn.textContent = v ? '☀' : '☾';
        btn.addEventListener('click', () => {
          v = !document.body.classList.contains('dark');
          apply(v);
          btn.textContent = v ? '☀' : '☾';
          try { XKV.set('wc.theme', v ? 'dark' : 'light'); } catch (e) { }
        });
        wc.parentElement.insertBefore(btn, wc);
      }
      window.W_setDark = apply;
    })();
    window.W.init();
  } catch (e) {
    console.error('Word clone failed to start:', e);
    document.body.insertAdjacentHTML('beforeend',
      '<div style="position:fixed;inset:auto 12px 12px auto;background:#A4262C;color:#fff;padding:10px 14px;border-radius:4px;font:12px sans-serif;z-index:9999">Startup error: ' + (e && e.message) + '</div>');
  }
});
