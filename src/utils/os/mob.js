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
 * The phone ratio — phones shrink the whole OS by a tunable factor,
 * PCs are never touched (the attribute simply never lands there).
 *
 * - detection mirrors the landscape gate: real phones only
 * - <html data-wos-mob="1"> switches the CSS hooks on
 * - --wos-ratio scales every rem-based size (Tailwind spacing + text)
 * - tune it: localStorage.setItem("wos.mobRatio", "0.8")  (0.6 – 1.0)
 */

const KEY = "wos.mobRatio";
const DEF = 0.85;

export function isPhoneDevice() {
  try {
    const ua = navigator.userAgentData;
    if (ua && typeof ua.mobile === "boolean") return ua.mobile;
  } catch (e) {}
  const touch = (navigator.maxTouchPoints || 0) > 0;
  const small = Math.min(window.screen?.width || 9999, window.screen?.height || 9999) <= 740;
  return touch && small;
}

export function applyMobScale() {
  const root = document.documentElement;
  if (isPhoneDevice()) {
    root.setAttribute("data-wos-mob", "1");
    let r = parseFloat(localStorage.getItem(KEY) || "");
    if (!Number.isFinite(r)) r = DEF;
    r = Math.min(1, Math.max(0.6, r));
    root.style.setProperty("--wos-ratio", String(r));
  } else {
    root.removeAttribute("data-wos-mob");
    root.style.removeProperty("--wos-ratio");
  }
}
