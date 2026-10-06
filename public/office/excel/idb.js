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

/* idb.js — durable key/value storage on IndexedDB. NO localStorage.
   The whole store is hydrated into memory at boot so app code stays
   synchronous; writes update memory instantly and flush to IndexedDB
   asynchronously. XKV.flush() awaits every outstanding write (tests use it
   before reloading the page). */
(function () {
  'use strict';
  const DB_NAME = 'excel-web-edition';
  const STORE = 'kv';
  let db = null;
  const cache = new Map();
  const pending = new Set();
  const track = p => { pending.add(p); p.finally(() => pending.delete(p)); return p; };

  const ready = new Promise(resolve => {
    let settled = false;
    const fin = ok => { if (!settled) { settled = true; resolve(ok); } };
    if (!('indexedDB' in window)) { console.warn('[XKV] IndexedDB unavailable — storage is memory-only'); return fin(false); }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore(STORE); };
    req.onerror = () => { console.warn('[XKV] open failed:', req.error); fin(false); };
    req.onblocked = () => fin(false);
    req.onsuccess = () => {
      db = req.result;
      const tx = db.transaction(STORE, 'readonly');
      const vals = tx.objectStore(STORE).getAll();
      const keys = tx.objectStore(STORE).getAllKeys();
      tx.oncomplete = () => {
        (keys.result || []).forEach((k, i) => cache.set(k, vals.result[i]));
        fin(true);
      };
      tx.onerror = () => fin(false);
    };
  });

  function rw(op, arg) {
    if (!db) return Promise.resolve(false);
    return track(new Promise(res => {
      const tx = db.transaction(STORE, 'readwrite');
      if (op === 'put') tx.objectStore(STORE).put(arg[1], arg[0]);
      else if (op === 'del') tx.objectStore(STORE).delete(arg);
      else tx.objectStore(STORE).clear();
      tx.oncomplete = () => res(true);
      tx.onerror = () => { console.warn('[XKV]', op, 'failed:', tx.error); res(false); };
    }));
  }

  window.XKV = {
    ready,
    get(k) { return cache.has(k) ? cache.get(k) : null; },
    set(k, v) { cache.set(k, v); return rw('put', [k, v]); },
    del(k) { cache.delete(k); return rw('del', k); },
    clear() { cache.clear(); return rw('clear'); },
    flush() { return Promise.all([...pending]); },
    keys() { return [...cache.keys()]; },
    get engine() { return db ? 'IndexedDB' : 'memory-only'; },
  };
})();
