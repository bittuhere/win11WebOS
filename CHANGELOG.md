<!--
  Copyright 2026 bittuhere

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-10-04

**WebOS 1, v1.01.** The release that gives the PC an update path: it can now be told about a
newer build, read what changed, and install it. The repository version (semver `1.1.0`) is the
same release as WebOS `v1.01`; the OS version scheme is documented below.

### Added

- **Windows Update.** Every launch, a few seconds after the desktop is up, the PC asks a static
  feed (`public/updates/feed.json`) whether a newer build exists and says so in a notification —
  "You're up to date", or "Update ready — v1.02" with a button that opens the Update window.
  The window shows the version, the size, the release date, the kind of update and the release
  notes, and installs with one button: caches are cleared, the new build is fetched and the
  desktop restarts on it. A **Windows Update** page in Settings shows the same state, the update
  history and the feed the PC is reading.
- **Release notes that ship with the build** — `public/updates/notes/<version>.md`, rendered by
  a small markdown reader (`src/utils/os/md.js`) with images, tables, lists and links. Pictures
  resolve relative to the note, so a screenshot lives next to the notes that use it.
- **One declared version.** `src/utils/os/version.js` holds the family, major, build, channel and
  release date; the About panel, Settings, the taskbar-less identity line and the updater all read
  from it, so they cannot disagree. `1.01 → 1.02` is a quality update, `1.xx → 2.00` is a feature
  update, and the updater labels what it finds accordingly.
- **A cache-proof check.** The feed is fetched with a cache-busting query, `cache: "no-store"`,
  and `Cache-Control: no-store` on `/updates/*` in `public/_headers` — a browser cache can no
  longer hide a release.
- **Settings ▸ Windows Update** panels: update history, pause/resume automatic checks, and an
  advanced panel that reads the live feed.
- **The Store's featured row** is now ten slides — Paint, Photopea, Excalidraw, Minecraft 1.8.8,
  Wikipedia, Krunker, Arcade Hub, Geometry Dash, ZType and windows96 — with matching dots, and
  **Musopen** was removed.
- **Every Store icon ships with the PC.** `public/app-logos/` holds all 238 app logos locally
  (`scripts/fetch_app_logos.py` fills the folder); the Store no longer waits on other sites.
- **Search that forgives spelling.** The Start menu search ranks by exact name, word start,
  substring, letter order or a single typo ("notpad", "setings"), highlights the letters that
  matched, searches **apps and files already on this PC**, and offers All / Apps / Files / Web
  tabs — the Web tab hands the query to a real search engine in your browser.
- **Updated GitHub mark** for the _Star me on GitHub_ shortcut.

### Fixed

- **Local `.html` files open in Edge and finish loading.** A `blob:` page made by this PC was
  being sent to the page relay like any other URL; it now loads directly, so the tab title
  settles and the "This page cannot be displayed" screen is gone.
- **Ctrl+C / Ctrl+V / Ctrl+X belong to the window in front.** Notepad's clipboard shortcuts
  work again, including text copied outside the PC.
- **Saving the same file twice no longer creates `web (2).html`.** Saving an open document
  writes to its own path, and pasting a file onto an existing name in File Explorer asks first:
  **Replace the files / Keep both copies / Cancel**.
- **The power button boots.** Powering off and pressing **Power on** runs the boot sequence and
  returns to the lock screen.

## [1.0.0] — 2026-10-04

First stable release. Everything below is verified by the suites in `tests/` and the offline
driver in `scripts/`, all of which run in CI on every push and pull request.

### Added

- **File associations for 145 extensions.** One router (`src/utils/os/assoc.js`) decides which app
  opens a file for every entry point — double-click in File Explorer, the desktop, Start, the
  Terminal's `start`, and _Open with_. Video → Movies & TV, audio → Groove Music, images →
  Photos or Paint, HTML → the internal Edge, 60+ code and text types → Notepad. Every type has its
  own icon and human-readable type name (`src/utils/os/icons.js`).
- **Open with** and **Always use …** in the File Explorer context menu, including _Notepad_ for an
  `.html` file. Choices are stored per PC (`wos.fileAssoc`) and can be reset from the same menu.
- **Honest refusals.** A program (`.exe`, `.msi`, `.apk` …) or a packed archive (`.zip`, `.7z` …) is
  not a text document: it gets a notification naming the file, not an empty window.
- **Notepad tabs that follow the file system.** One tab per file, disk contents always win over a
  restored session, unsaved edits are defended by a prompt, and closing asks
  Save / Don't save / Cancel.
- **Landscape gate for phones** — a full-screen prompt with tap-to-rotate (full screen +
  orientation lock + motion permission), a sensor dial, a live three-step checklist, an honest
  verdict when the browser cannot lock orientation, and a switch in
  Settings ▸ Personalisation ▸ Rotate prompt.
- **Phone layout fitted to the identical desktop interface** — the same pixel sizes for icons,
  taskbar and tiles; only containers change.
- **CI pipeline** (`.github/workflows/ci.yml`) that builds, smoke-tests and runs every browser
  suite against the served production build.
- **Notices and policies** — `NOTICE` with third-party attribution, `SECURITY.md` with a
  disclosure process, `CODE_OF_CONDUCT.md`, and `CONTRIBUTING.md`.

- Installable web app data: **`?app=` deep links** (`./?app=notepad`, `./?app=explorer`,
  `./?app=solitaire`) used by the Start menu, the manifest shortcuts and any link you post.
- A proper **application icon set** — `icon-192.png`, `icon-512.png` and a maskable
  `icon-512-maskable.png` — plus a 1200 × 630 **`og-image.png`** captured from the live desktop.
- **`robots.txt`**, **`sitemap.xml`** (including the deep-link URLs) and structured data so search
  engines and social previews render a rich card.
- **`_headers`** / **`_redirects`** for Cloudflare Pages, Netlify and any host that reads them, and a
  `Deploying` section in the README covering GitHub Pages, Cloudflare, Netlify, Vercel and a plain
  web server.
- `.editorconfig`, `.gitattributes`, `.nvmrc`, Dependabot, a pull-request template and issue forms.
- This changelog.

### Changed

- Asset URLs are **relative** (`vite.config.js` → `base: "./"`), so one build runs at a domain root,
  on a GitHub Pages project path, or inside any sub-folder.
- The keyboard easter eggs (`react-pwa.js`, ~220 KB) are fetched **after** the desktop is on screen
  instead of blocking every boot; the BitBot weights stay out of the service worker cache on purpose.
- The generated service-worker manifest was dropped in favour of the hand-written
  `public/manifest.json`, which carries real icons, screenshots, categories and shortcuts.
- Production builds ship **no source maps**.

### Fixed

- The `<html lang>` attribute now follows the interface language instead of being pinned to `en`.
- Notepad could raise its window without the double-clicked document: the saved session was
  restored _after_ the new file had been opened and replaced it.
- A saved path that differed only in a repeated separator (`…\Documents\\file.txt`) was treated as
  a second file, showing the same document twice.
- Tab activation used a deferred index, so any tab that collapsed or was merged could leave a
  different document on screen.
- Local `.html` files opened as a web _search_ for the literal text `blob:https://…`.
- Data loss on close: "Don't save" could resurrect discarded text on the next launch.
- `window.open` calls were ignored when a shell or wrapper replaced it after load.
- The phone stylesheet shrank the desktop tile label font; it no longer touches text sizes.

### Security

- No analytics, no telemetry, no remote fonts and no third-party card art. All state stays in the
  browser (IndexedDB + localStorage).
- Unused dependencies removed (`react-scripts` and its ESLint config), the deprecated
  `i18next-xhr-backend` replaced by `i18next-http-backend`, and `axios` upgraded to the 1.x line.
- Security headers for static hosts added in `public/_headers` (see the Deploying section of the
  README).

## [0.2.0] — 2026-07-18

### Added

- Solitaire Collection rebuilt on the vendored MIT engine
  ([AashishChakravarty/solitaire](https://github.com/AashishChakravarty/solitaire)), with
  multi-level undo, Draw 1/Draw 3 and click-to-move on top.
- Microsoft Store with a 1,898-entry catalogue, product pages, on-device recommendations and a
  search that suggests before you finish typing.
- Settings app, Task Manager, Security, Weather (live), News (live + offline edition), Maps
  (live OpenStreetMap), Camera with filters, Photos, Paint, Whiteboard, Snipping Tool, Sticky
  Notes, To Do, Calendar, Clock & Alarms, Calculator, Minesweeper, Xbox, Media Player,
  Voice Recorder, Your Phone and the local BitBot AI.
- Offline-capable service worker, installable web app manifest, and locale files wired to Crowdin.

### Fixed

- Sandboxed and storage-less embeds booted to a blank page — storage, cookies and
  `navigator.serviceWorker` are now probed and stubbed before any app code runs.
- Infinite `setTimeout` loops in shipped binaries removed; the boot path no longer relies on
  removed globals.

## [0.1.0] — 2026-01-20

### Added

- The desktop: window manager (drag, snap, resize, minimize, maximize, close), Start menu with
  pinned and all-apps views, taskbar with system tray and clock, desktop icons with rubber-band
  selection, context menus, lock screen with PIN or password sign-in, and the first-run setup.
- Virtual Storage backed by IndexedDB, with the File Explorer, Notepad, Paint, Photos and
  Terminal reading and writing the same tree.
- Microsoft Edge with tabs, history, favourites, downloads and reader view, plus the optional
  browser-helper extension for sites that refuse to be framed.
- The Office suite (Word, Excel, PowerPoint, OneNote), Mail, People, Get Started, Feedback Hub
  and the Store's "add your own app" flow.

[1.0.0]: https://github.com/bittuhere/win11WebOS/releases/tag/v1.0.0
[0.2.0]: https://github.com/bittuhere/win11WebOS/releases/tag/v0.2.0
[0.1.0]: https://github.com/bittuhere/win11WebOS/releases/tag/v0.1.0
