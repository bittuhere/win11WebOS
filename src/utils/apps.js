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

export const gene_name = () => Math.random().toString(36).substring(2, 10).toUpperCase();

let installed = [];
try {
  installed = JSON.parse(localStorage.getItem("installed") || "[]") || [];
} catch (e) {}

const apps = [
  {
    name: "Start",
    icon: "home",
    type: "action",
    action: "STARTMENU",
  },
  {
    name: "Search",
    icon: "search",
    type: "action",
    action: "SEARCHMENU",
  },
  {
    name: "Widget",
    icon: "widget",
    type: "action",
    action: "WIDGETS",
  },
  {
    name: "Settings",
    icon: "settings",
    type: "app",
    action: "SETTINGS",
  },
  {
    name: "Task Manager",
    icon: "taskmanager",
    type: "app",
    action: "TASKMANAGER",
  },
  {
    name: "File Explorer",
    icon: "explorer",
    type: "app",
    action: "EXPLORER",
  },
  {
    name: "Browser",
    icon: "edge",
    type: "app",
    action: "MSEDGE",
  },
  {
    name: "Store",
    icon: "store",
    type: "app",
    action: "WNSTORE",
  },
  {
    name: "Recycle Bin",
    icon: "bin0",
    type: "app",
    action: "RECYCLEBIN",
  },
  {
    name: "Clock",
    icon: "alarm",
    type: "app",
    action: "ALARMAPP",
  },
  {
    name: "Minesweeper",
    icon: "mine",
    type: "app",
    action: "MINEAPP",
  },
  {
    name: "Solitaire Collection",
    icon: "solitaire",
    type: "app",
    action: "SOLITAIREAPP",
  },
  {
    name: "Calculator",
    icon: "calculator",
    type: "app",
    action: "CALCUAPP",
  },
  {
    name: "Calendar",
    icon: "calendar",
    type: "app",
    action: "CALENDARAPP",
  },
  {
    name: "Camera",
    icon: "camera",
    type: "app",
    action: "CAMERA",
  },
  {
    name: "Your Phone",
    icon: "yphone",
    type: "app",
    action: "YPHONEAPP",
  },
  {
    name: "Feedback",
    icon: "feedback",
    type: "app",
    action: "FEEDBACKAPP",
  },
  {
    name: "Get Started",
    icon: "getstarted",
    type: "app",
    action: "OOBE",
  },
  {
    name: "Groove Music",
    icon: "groove",
    type: "app",
    action: "GROOVEAPP",
  },
  {
    name: "Help",
    icon: "help",
    type: "app",
    action: "HELPAPP",
    payload: "full",
  },
  {
    name: "Mail",
    icon: "mail",
    type: "app",
    action: "MAILAPP",
  },
  {
    name: "Movies",
    icon: "movies",
    type: "app",
    action: "MOVIESAPP",
  },
  {
    name: "Xbox",
    icon: "xbox",
    type: "app",
    action: "XBOXAPP",
  },
  {
    name: "Windows Update",
    icon: "update",
    type: "app",
    action: "UPDATEWIN",
  },
  {
    name: "Word",
    icon: "word",
    type: "app",
    action: "WORDOFFICE",
    pwa: true,
    data: { type: "IFrame", url: "office/word/index.html", invert: false },
  },
  {
    name: "Excel",
    icon: "excel",
    type: "app",
    action: "EXCELOFFICE",
    pwa: true,
    data: { type: "IFrame", url: "office/excel/index.html", invert: false },
  },
  {
    name: "PowerPoint",
    icon: "powerpoint",
    type: "app",
    action: "PPTOFFICE",
    pwa: true,
    data: { type: "IFrame", url: "office/powerpoint/index.html", invert: false },
  },
  {
    name: "OneNote",
    icon: "onenote",
    type: "app",
    action: "ONENOTEOFFICE",
    pwa: true,
    // served from GitHub Pages — keeps the whisper/transformers model weight
    // out of this repo entirely (storage fix)
    data: { type: "IFrame", url: "https://bittuhere.github.io/msoffice/onenote/", invert: false },
  },
  {
    name: "Narrator",
    icon: "narrator",
    type: "app",
    action: "NARRATORAPP",
  },
  {
    name: "News",
    icon: "news",
    type: "app",
    action: "NEWSAPP",
  },
  {
    name: "Notepad",
    icon: "notepad",
    type: "app",
    action: "NOTEPAD",
  },
  {
    name: "Sticky Notes",
    icon: "notes",
    type: "app",
    action: "STICKYAPP",
  },
  {
    name: "OneDrive",
    icon: "oneDrive",
    type: "app",
    action: "ONEDRIVEAPP",
  },
  {
    name: "Photos",
    icon: "photos",
    type: "app",
    action: "PHOTOSAPP",
  },
  {
    name: "Paint",
    icon: "paint",
    type: "app",
    action: "PAINTAPP",
  },
  {
    name: "Security",
    icon: "security",
    type: "app",
    action: "SECURITYAPP",
  },
  {
    name: "Snipping Tool",
    icon: "snip",
    type: "app",
    action: "SNIPAPP",
  },
  {
    name: "Terminal",
    icon: "terminal",
    type: "app",
    action: "TERMINAL",
  },
  {
    name: "Tips",
    icon: "tips",
    type: "app",
    action: "TIPSAPP",
  },
  {
    name: "To Do",
    icon: "todo",
    type: "app",
    action: "TODOAPP",
  },
  {
    name: "Maps",
    icon: "maps",
    type: "app",
    action: "MAPSAPP",
  },
  {
    name: "Voice Recorder",
    icon: "voice",
    type: "app",
    action: "VOICEAPP",
  },
  {
    name: "Weather",
    icon: "weather",
    type: "app",
    action: "WEATHERAPP",
  },
  {
    name: "Whiteboard",
    icon: "board",
    type: "app",
    action: "WHITEBOARD",
  },
  {
    name: "BitBot",
    icon: "cortana",
    type: "app",
    action: "CORTANAAPP",
  },
  {
    name: "Github",
    icon: "github",
    type: "app",
    action: "EXTERNALTAB",
    payload: "https://github.com/bittuhere/win11WebOS",
  },
  /* A reminder with a job: same destination as Github, wearing a star. */
  {
    name: "Star me on GitHub",
    icon: "starme",
    type: "app",
    action: "EXTERNALTAB",
    payload: "https://github.com/bittuhere/win11WebOS",
  },
];

/* Names that ship with WebOS — everything the OS brought along, as opposed to
   what this browser installed from the Store. The Library uses it to keep the
   two lists apart (it used to show only the handful of preinstalled apps that
   happen to render in an iframe window). */
const boughtNames = new Set((Array.isArray(installed) ? installed : []).map((a) => a && a.name));
export const preinstalled = new Set(
  apps.filter((a) => a && a.name && !boughtNames.has(a.name)).map((a) => a.name),
);

for (let i = 0; i < installed.length; i++) {
  installed[i].action = gene_name();
  apps.push(installed[i]);
}

export default apps;
