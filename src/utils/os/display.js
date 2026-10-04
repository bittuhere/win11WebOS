// Copyright 2026 bittuhere (anurag670singh@gmail.com)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Real display effects for Settings.
 *
 * The brightness slider and the Night light toggle persist their values in
 * the settings store — this module makes the desktop actually respond:
 *   - brightness  -> a CSS brightness filter on <html>
 *   - night light -> a warm multiply overlay above everything
 *
 * startDisplaySync() subscribes once (from App) so any change anywhere
 * applies instantly and survives reloads (values come back with settings).
 */
import store from "../../reducers";

let overlay = null;

const read = (path, dflt) => {
  try {
    const v = String(path)
      .split(".")
      .reduce((o, k) => (o == null ? undefined : o[k]), store.getState().setting);
    return v === undefined ? dflt : v;
  } catch (e) {
    return dflt;
  }
};

export function applyDisplay() {
  const root = document.documentElement;
  const brightness = Number(read("system.display.brightness", 100)) || 100;
  const night = !!read("system.display.nightlight.state", false);

  if (brightness < 100) {
    root.style.filter = `brightness(${Math.max(20, Math.min(100, brightness)) / 100})`;
  } else {
    root.style.removeProperty("filter");
  }

  if (!overlay && typeof document !== "undefined") {
    overlay = document.createElement("div");
    overlay.id = "webosNightLight";
    overlay.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:2147483000;" +
      "background:rgb(255 152 38 / 18%);mix-blend-mode:multiply;" +
      "opacity:0;transition:opacity .5s ease";
    const mount = () => {
      (document.body || document.documentElement).appendChild(overlay);
    };
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  }
  if (overlay) overlay.style.opacity = night ? "1" : "0";
}

let started = false;
export function startDisplaySync() {
  if (started || typeof store.subscribe !== "function") return;
  started = true;
  store.subscribe(applyDisplay);
  applyDisplay();
}
