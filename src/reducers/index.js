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

import { applyMiddleware, combineReducers, createStore } from "redux";

import wallReducer from "./wallpaper";
import taskReducer from "./taskbar";
import deskReducer from "./desktop";
import menuReducer from "./startmenu";
import paneReducer from "./sidepane";
import widReducer from "./widpane";
import appReducer from "./apps";
import menusReducer from "./menu";
import globalReducer from "./globals";
import settReducer from "./settings";
import fileReducer from "./files";
import uiReducer from "./ui";
import { externalLinkMiddleware } from "../utils/os/links";

const allReducers = combineReducers({
  wallpaper: wallReducer,
  taskbar: taskReducer,
  desktop: deskReducer,
  startmenu: menuReducer,
  sidepane: paneReducer,
  widpane: widReducer,
  apps: appReducer,
  menus: menusReducer,
  globals: globalReducer,
  setting: settReducer,
  files: fileReducer,
  ui: uiReducer,
});

/* The one middleware the OS needs: it performs the leaving-the-OS side
   effects (new browser tab, mailto:) outside the reducer, so no reducer ever
   has to touch window.open / window.location. */
var store = createStore(allReducers, applyMiddleware(externalLinkMiddleware));

/**
 * VS finishes hydrating the filesystem asynchronously (IndexedDB), long after
 * this module was evaluated. It announces itself on `window`, and we turn that
 * into a normal action so File Explorer re-renders against the stored tree.
 */
if (typeof window !== "undefined") {
  window.addEventListener("webos-vs-ready", () => {
    try {
      store.dispatch({ type: "FILEHYDRATE" });
    } catch (e) {}
  });
  // another app (Terminal, Paint, Edge downloads, Recycle Bin…) wrote to the
  // Virtual Storage — nudge File Explorer so it re-reads the shared tree
  window.addEventListener("webos-vs-changed", () => {
    try {
      store.dispatch({ type: "FILEREFRESH" });
    } catch (e) {}
  });
}

// automation seam: the OS driver (and power users) can reach the store
if (typeof window !== "undefined") {
  try {
    window.__wosStore = store;
  } catch (e) {}
}

export default store;
