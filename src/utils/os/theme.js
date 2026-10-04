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
 * Theme + settings persistence.
 *
 * The old code "toggled" the theme on boot, which meant the theme you picked
 * before closing the tab was decided by whatever happened to be in the Redux
 * store at that instant — and after the OOBE wrote a partial `setting` object
 * to localStorage the store could end up with `person.theme === undefined`.
 * Dark went in, light came out.
 *
 * Everything here is explicit now:
 *   readStoredSettings()  -> deep merged, never partial
 *   applyTheme(theme)     -> sets body[data-theme] + dispatches the new value
 *   hydrateTheme()        -> runs before React paints, so there is no flash
 */

const LS_KEY = "setting";

export const DEFAULT_SETTINGS = {
  system: {
    power: { saver: { state: false }, battery: 100 },
    display: { brightness: 100, nightlight: { state: false }, connect: false },
  },
  person: { name: "Blue Edge", theme: "light", color: "blue" },
  devices: { bluetooth: false },
  network: { wifi: { state: true }, airplane: false },
  privacy: { location: { state: false } },
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Recursive merge that never lets a partial object wipe out a branch. */
export function deepMerge(base, patch) {
  if (!isObj(base) || !isObj(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  Object.keys(patch).forEach((k) => {
    out[k] = isObj(base[k]) || isObj(patch[k]) ? deepMerge(base[k], patch[k]) : patch[k];
  });
  return out;
}

export function readStoredSettings() {
  let raw = null;
  try {
    raw = localStorage.getItem(LS_KEY);
  } catch (e) {}
  let saved = {};
  if (raw) {
    try {
      saved = JSON.parse(raw) || {};
    } catch (e) {
      saved = {};
    }
  }
  return deepMerge(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), saved);
}

export function writeStoredSettings(sett) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sett));
  } catch (e) {}
}

export const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Paint the theme onto <body> — safe to call before React mounts. */
export function paintTheme(theme) {
  if (typeof document === "undefined") return;
  document.body.dataset.theme = theme === "dark" ? "dark" : "light";
}

/**
 * Apply a theme everywhere: DOM, Redux and storage.
 * Pass nothing to toggle.
 */
export function applyTheme(store, theme) {
  const cur = store.getState().setting?.person?.theme;
  const next = theme === "light" || theme === "dark" ? theme : cur === "dark" ? "light" : "dark";

  paintTheme(next);
  store.dispatch({ type: "STNGTHEME", payload: next });
  store.dispatch({ type: "PANETHEM", payload: next === "light" ? "sun" : "moon" });
  return next;
}

/**
 * Boot time theme restore. Returns the theme that is now on screen.
 * Called from index.jsx before the first paint and again from App once
 * IndexedDB has been read (IndexedDB wins if localStorage was cleared).
 */
export function hydrateTheme(store, override) {
  const sett = override || readStoredSettings();
  let theme = sett?.person?.theme;
  if (theme !== "light" && theme !== "dark") {
    theme = systemPrefersDark() ? "dark" : "light";
  }
  paintTheme(theme);
  if (override) store.dispatch({ type: "SETTLOAD", payload: sett });
  else store.dispatch({ type: "STNGTHEME", payload: theme });
  store.dispatch({ type: "PANETHEM", payload: theme === "light" ? "sun" : "moon" });
  return theme;
}

/** Read the theme straight out of storage, without touching React. */
export function peekTheme() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return systemPrefersDark() ? "dark" : "light";
    const t = JSON.parse(raw)?.person?.theme;
    return t === "dark" || t === "light" ? t : systemPrefersDark() ? "dark" : "light";
  } catch (e) {
    return "light";
  }
}
