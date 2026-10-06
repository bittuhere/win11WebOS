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
 * File-type icons. Explorer, the desktop and the dialogs all go through here
 * so a .png always looks like a .png, wherever you meet it.
 */

/** extension -> [win/ icon name, human readable type] */
const MAP = {
  txt: ["notepad", "Text Document"],
  md: ["notepad", "Markdown Document"],
  log: ["notepad", "Log File"],
  rtf: ["winWord", "Rich Text Format"],
  json: ["code", "JSON File"],
  js: ["code", "JavaScript File"],
  jsx: ["code", "JavaScript JSX File"],
  ts: ["code", "TypeScript File"],
  tsx: ["code", "TypeScript JSX File"],
  css: ["code", "CSS File"],
  scss: ["code", "SCSS File"],
  html: ["edge", "HTML Document"],
  htm: ["edge", "HTML Document"],
  xml: ["code", "XML Document"],
  py: ["code", "Python File"],
  c: ["code", "C File"],
  cpp: ["code", "C++ File"],
  h: ["code", "C Header File"],
  java: ["code", "Java File"],
  rs: ["code", "Rust File"],
  go: ["code", "Go File"],
  sh: ["terminal", "Shell Script"],
  bat: ["terminal", "Windows Batch File"],
  ps1: ["terminal", "PowerShell Script"],
  png: ["pics", "PNG Image"],
  jpg: ["pics", "JPEG Image"],
  jpeg: ["pics", "JPEG Image"],
  gif: ["pics", "GIF Image"],
  webp: ["pics", "WebP Image"],
  bmp: ["pics", "Bitmap Image"],
  svg: ["pics", "SVG Document"],
  ico: ["pics", "Icon"],
  mp3: ["music", "MP3 Audio"],
  wav: ["music", "WAV Audio"],
  ogg: ["music", "OGG Audio"],
  flac: ["music", "FLAC Audio"],
  m4a: ["music", "M4A Audio"],
  aac: ["music", "AAC Audio"],
  opus: ["music", "Opus Audio"],
  weba: ["music", "WebM Audio"],
  mid: ["music", "MIDI File"],
  aiff: ["music", "AIFF Audio"],
  m4v: ["vid", "MPEG-4 Video"],
  ogv: ["vid", "Ogg Video"],
  mpg: ["vid", "MPEG Video"],
  mpeg: ["vid", "MPEG Video"],
  "3gp": ["vid", "3GPP Video"],
  avif: ["pics", "AVIF Image"],
  tif: ["pics", "TIFF Image"],
  tiff: ["pics", "TIFF Image"],
  heic: ["pics", "HEIC Image"],
  xhtml: ["edge", "XHTML Document"],
  mht: ["edge", "MHTML Document"],
  mhtml: ["edge", "MHTML Document"],
  jsonc: ["code", "JSON with Comments"],
  json5: ["code", "JSON5 File"],
  markdown: ["docs", "Markdown Document"],
  rst: ["docs", "reStructuredText"],
  ini: ["code", "Configuration Settings"],
  cfg: ["code", "Configuration Settings"],
  conf: ["code", "Configuration File"],
  toml: ["code", "TOML File"],
  yaml: ["code", "YAML File"],
  yml: ["code", "YAML File"],
  sql: ["code", "SQL Database Script"],
  srt: ["docs", "Subtitle File"],
  vtt: ["docs", "WebVTT Subtitle"],
  ass: ["docs", "SubStation Subtitle"],
  nfo: ["docs", "Information File"],
  wb: ["board", "Whiteboard"],
  ttf: ["docs", "TrueType Font"],
  otf: ["docs", "OpenType Font"],
  woff: ["docs", "Web Font"],
  woff2: ["docs", "Web Font"],
  iso: ["disc", "Disc Image"],
  mp4: ["vid", "MP4 Video"],
  mkv: ["vid", "Video File"],
  mov: ["vid", "QuickTime Movie"],
  avi: ["vid", "Video File"],
  webm: ["vid", "WebM Video"],
  pdf: ["pdfdoc", "PDF Document"],
  doc: ["winWord", "Word Document"],
  docx: ["winWord", "Word Document"],
  xls: ["excel", "Excel Worksheet"],
  xlsx: ["excel", "Excel Worksheet"],
  csv: ["excel", "CSV File"],
  ppt: ["powerpoint", "PowerPoint Presentation"],
  pptx: ["powerpoint", "PowerPoint Presentation"],
  zip: ["zip", "Compressed (zipped) Folder"],
  rar: ["zip", "WinRAR Archive"],
  "7z": ["zip", "7-Zip Archive"],
  gz: ["zip", "GZip Archive"],
  tar: ["zip", "Tar Archive"],
  exe: ["appx", "Application"],
  msi: ["appx", "Windows Installer Package"],
  lnk: ["appx", "Shortcut"],

  /* ---- one entry per openable extension (see utils/os/assoc.js) ---- */
  /* more code (Notepad) */
  mjs: ["code", "JavaScript Module"],
  cjs: ["code", "CommonJS Module"],
  cc: ["code", "C++ Source File"],
  hpp: ["code", "C++ Header File"],
  cs: ["code", "C# Source File"],
  rb: ["code", "Ruby File"],
  php: ["code", "PHP Script"],
  pl: ["code", "Perl Script"],
  lua: ["code", "Lua Script"],
  r: ["code", "R Script"],
  swift: ["code", "Swift File"],
  kt: ["code", "Kotlin File"],
  dart: ["code", "Dart File"],
  vue: ["code", "Vue Component"],
  svelte: ["code", "Svelte Component"],
  astro: ["code", "Astro Component"],
  tsm: ["code", "TypeScript Module"],
  less: ["code", "Less Stylesheet"],
  sass: ["code", "Sass Stylesheet"],
  gradle: ["code", "Gradle Build Script"],
  properties: ["code", "Properties File"],
  env: ["code", "Environment File"],
  dockerfile: ["code", "Dockerfile"],
  makefile: ["code", "Makefile"],
  diff: ["code", "Diff File"],
  patch: ["code", "Patch File"],
  db: ["code", "Database File"],
  sqlite: ["code", "SQLite Database"],
  ndjson: ["code", "Newline JSON"],
  editorconfig: ["code", "Editor Config"],
  gitignore: ["code", "Git Ignore File"],
  /* more shell */
  zsh: ["terminal", "Zsh Script"],
  bash: ["terminal", "Bash Script"],
  cmd: ["terminal", "Windows Command Script"],
  /* more text */
  text: ["docs", "Text Document"],
  readme: ["docs", "Readme"],
  license: ["docs", "Licence"],
  tsv: ["excel", "Tab-Separated Values"],
  /* the browser */
  shtml: ["edge", "Server-Parsed HTML"],
  /* more media */
  oga: ["music", "Ogg Audio"],
  heif: ["pics", "HEIF Image"],
  jfif: ["pics", "JPEG Image"],
  psd: ["pics", "Photoshop Document"],
  ai: ["pics", "Illustrator Artwork"],
  eps: ["pics", "Encapsulated PostScript"],
  /* more archives */
  bz2: ["zip", "BZip2 Archive"],
  xz: ["zip", "XZ Archive"],
  /* more programs — this PC cannot run any of them, and says so */
  apk: ["appx", "Android Package"],
  deb: ["appx", "Debian Package"],
  rpm: ["appx", "RPM Package"],
  dmg: ["appx", "Apple Disk Image"],
  com: ["appx", "MS-DOS Application"],
  scr: ["appx", "Screen Saver"],
  sys: ["appx", "System File"],
  dll: ["appx", "Application Extension"],
  eot: ["appx", "Embedded OpenType Font"],
};

/** Which asset folder an icon name lives in. */
const IN_WIN = new Set([
  "folder",
  "pics",
  "music",
  "vid",
  "docs",
  "desk",
  "down",
  "user",
  "onedrive",
  "disc",
  "disk",
  "bin",
  "bin-em",
  "net",
  "star",
  "thispc",
  "folder3d",
  "info",
  "pinned",
  "shield",
  "store",
  "themes",
  "zip",
  "appx",
  "pdfdoc",
]);

export function extOf(name) {
  const s = String(name || "");
  const i = s.lastIndexOf(".");
  return i > 0 ? s.slice(i + 1).toLowerCase() : "";
}

/** Returns { src, label } for a file or folder. */
export function iconForItem(item) {
  if (!item) return { src: "win/folder", label: "File folder" };
  if (item.type === "folder") {
    const special = item.info?.icon;
    if (special && special !== "folder") {
      return {
        src: IN_WIN.has(special) ? `win/${special}` : special,
        label: "File folder",
      };
    }
    return { src: "win/folder", label: "File folder" };
  }
  const ext = extOf(item.name);
  const hit = MAP[ext];
  if (!hit) return { src: "notepad", label: "File" };
  const [name, label] = hit;
  return { src: IN_WIN.has(name) ? `win/${name}` : name, label };
}

/** The icon name VS should stamp on an item's info, kept for compatibility. */
export function simpleIcon(name) {
  const ext = extOf(name);
  if (!ext) return "file";
  const hit = MAP[ext];
  if (!hit) return "file";
  const n = hit[0];
  if (["pics", "music", "vid", "folder"].includes(n)) return n;
  return "file";
}

export function typeLabel(item) {
  if (!item) return "";
  if (item.type === "folder") return "File folder";
  return iconForItem(item).label;
}

export default { iconForItem, simpleIcon, extOf, typeLabel };
