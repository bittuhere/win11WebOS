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

import icons from "./apps";

// corrupted localStorage must never take the shell down at boot
const lsParse = (key, fb) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fb;
    const v = JSON.parse(raw);
    return v ?? fb;
  } catch (e) {
    return fb;
  }
};

var { taskbar, desktop, pinned, recent } = {
  taskbar: lsParse("taskbar", null) || ["Settings", "File Explorer", "Browser", "Store"],
  desktop: lsParse("desktop", null) || [
    "Recycle Bin",
    "File Explorer",
    "Store",
    "Browser",
    "Github",
    "Star me on GitHub",
  ],
  pinned: (localStorage.getItem("pinned") && JSON.parse(localStorage.getItem("pinned"))) || [
    "Browser",
    "Get Started",
    "Task Manager",
    "Mail",
    "Settings",
    "Store",
    "Notepad",
    "Whiteboard",
    "Calculator",
    "File Explorer",
    "Terminal",
    "Github",
    "Star me on GitHub",
    "Camera",
    "Word",
    "Excel",
    "PowerPoint",
    "OneNote",
  ],
  recent: (localStorage.getItem("recent") && JSON.parse(localStorage.getItem("recent"))) || [
    "Mail",
    "Terminal",
    "Github",
    "File Explorer",
    "Edge",
  ],
};

if (desktop.includes("Buy me a coffee") === false) {
  desktop.push("Buy me a coffee");
}

/* New arrivals show up in Start even for PCs that pinned things before. */
[
  "Minesweeper",
  "Weather",
  "Clock",
  "Solitaire Collection",
  "Word",
  "Excel",
  "PowerPoint",
  "OneNote",
].forEach((n) => {
  if (!pinned.includes(n)) pinned.push(n);
});

/* Same deal for the desktop: new arrivals land there even on PCs whose
   desktop was saved before they existed. */
["Star me on GitHub"].forEach((n) => {
  if (!desktop.includes(n)) desktop.push(n);
});

export const taskApps = icons.filter((x) => taskbar.includes(x.name));

export const desktopApps = icons
  .filter((x) => desktop.includes(x.name))
  .sort((a, b) => {
    return desktop.indexOf(a.name) > desktop.indexOf(b.name) ? 1 : -1;
  });

export const pinnedApps = icons
  .filter((x) => pinned.includes(x.name))
  .sort((a, b) => {
    return pinned.indexOf(a.name) > pinned.indexOf(b.name) ? 1 : -1;
  });

export const recentApps = icons
  .filter((x) => recent.includes(x.name))
  .sort((a, b) => {
    return recent.indexOf(a.name) > recent.indexOf(b.name) ? 1 : -1;
  });

export const allApps = icons.filter((app) => {
  return app.type === "app";
});

export const dfApps = {
  taskbar,
  desktop,
  pinned,
  recent,
};
