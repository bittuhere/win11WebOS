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

# APPS-MAP — where every app lives, and how to edit it

Current baseline: v1.02, Vite 7. Built-in windows use the lazy `WINDOW_APPS` registry in `src/containers/applications/index.jsx`. The desktop starts after local login. See [deployment](docs/DEPLOYMENT.md) and [testing](docs/TESTING.md).

## The machine that makes an app appear (memorize this chain)

```
you click an icon
  └─ data-action="MINEAPP" (desktop/taskbar/start all dispatch the same)
       └─ src/reducers/apps.js        → openApp(): alive=true, hide=false, z rises
       └─ src/App.jsx (WINDOW_APPS)   → <Comp /> mounts inside <AppBoundary>
close:
  closeApp() sets closing=true (280ms fly-out) → APPREAP fully unmounts
  reopening during that window bumps session → guaranteed fresh mount
```

| Role                                                       | File                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| App registry (name/icon/action)                            | `src/utils/apps.js`                                                 |
| Window lifecycle (open/close/snap/z)                       | `src/reducers/apps.js`                                              |
| Which component renders per app                            | `src/App.jsx` → `WINDOW_APPS` list                                  |
| Window chrome + animations                                 | `src/containers/applications/tabs.scss`, `wnapp.scss`               |
| Crash isolation per window                                 | `AppBoundary` in `src/App.jsx`                                      |
| Start-menu pins                                            | `src/reducers/startmenu.js` + `src/utils/index.js` ("new arrivals") |
| Desktop icons                                              | `src/reducers/desktop.js`                                           |
| Taskbar pins                                               | `src/reducers/taskbar.js`                                           |
| Virtual file system seed (folders/files the PC boots with) | `src/reducers/dir.json`                                             |
| App icons (PNG)                                            | `public/img/icon/<name>.png`                                        |

Two apps are **links, not windows**: `Github` and `Star me on GitHub` both carry
`action: "EXTERNALTAB"` + the repository URL, so every surface (desktop double-click, Start
tile, taskbar) hands the URL to the middleware in `src/utils/os/links.js`, which opens a real
browser tab — see README ▸ _core shell behaviour_.

## Every app, one line each

**One file per app** in `src/containers/applications/apps/` (component `.jsx` + matching `.scss`):

| App                   | Logic                      | Styles                    |
| --------------------- | -------------------------- | ------------------------- |
| File Explorer         | `explorer.jsx` (996 L)     | `assets/fileexpo.scss`    |
| Settings              | `settings.jsx` (718 L)     | `assets/settings.scss`    |
| Notepad               | `notepad.jsx`              | `notepad.scss`            |
| Photos                | `photos.jsx`               | `photos.scss`             |
| Paint                 | `paint.jsx`                | `paint.scss`              |
| Whiteboard            | `whiteboard.jsx`           | `whiteboard.scss`         |
| Camera                | `camera.jsx`               | `camera.scss`             |
| Clock                 | `clock.jsx`                | (shared `extras.scss`)    |
| Weather               | `weather.jsx`              | 〃                        |
| Terminal              | `terminal.jsx`             | 〃                        |
| Task Manager          | `taskmanager.jsx`          | 〃                        |
| Store                 | `store.jsx`                | 〃                        |
| Spotify               | `spotify.jsx`              | 〃                        |
| Recycle Bin           | `recycle.jsx`              | `recycle.scss`            |
| Calculator            | `calculator.jsx`           | 〃                        |
| Get Started           | `getstarted.jsx`           | `assets/getstarted.scss`  |
| Discord (placeholder) | `discord.jsx`              | 〃                        |
| **Microsoft Edge**    | `edge/` folder — see below | `edge/edge.scss` (1821 L) |

**The "extras" bundle** — `extras.jsx` (1957 L) holds many apps in one file:
Calendar, Mail, People, Maps, Groove Music, Movies & TV, News, Tips, To Do,
Sticky Notes, Your Phone, Xbox, Feedback, OneDrive, SharePoint, Windows
Security, Snipping Tool, Voice Recorder, Cortana, Teams, Skype, Yammer,
Narrator, Outlook, Office/OneNote (placeholders — do not touch).
Shared styles: `extras.scss`. Search for `export const CalendarApp` etc.

**Games:**

| Game                     | Logic                                                                                                                                                                                                                                                            | Styles                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Minesweeper              | `minesweeper.jsx` (249 L — grid, first-click-safe, flags, timer, best time)                                                                                                                                                                                      | `minesweeper.scss`                                                               |
| Solitaire Collection     | UI: `solitaire.jsx` (action bar, fit-to-window, win toast) · **engine (vendored AashishChakravarty/solitaire, MIT): `solitaire-aashish/engine.js`** — `createSolitaire()` builds the whole game: rules, scoring, deal/draw, undo, hint, auto-complete, animation | `solitaire.scss` + `solitaire-aashish/engine.css` (scoped under `#solitaireApp`) |
| Let's Surf (edge://surf) | **Not React** — vendored static site in `public/surf/` (index.html + resources/js/surf.bundle.js). Copied as-is into `build/surf/`. Edit gameplay there or replace files.                                                                                        | `resources/css/interface.css`                                                    |

## The browser (Microsoft Edge) — the 4 files that matter

| File                    | Lines | What lives there                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `edge/edge.jsx`         | 1473  | The window: tabs state, omnibox, navigation (`loadInto`/`navigate`), the live iframe (`frameUrl` pinning), in-frame bridge listener, history/favourites, Copilot sidepane, `edge://surf` render + `SurfPage`                                                                                                                                                   |
| `edge/EdgeInternal.jsx` | 910   | Internal pages: **NewTabPage** (search box + quick links), History, Downloads, Favorites, Settings page (engine picker, toggles), SnapshotPage, ReaderPage, ErrorPage, small components ( Fav, IcoWarn…)                                                                                                                                                       |
| `edge/edgeNav.js`       | 519   | **Pure logic, no UI** — the best file for URL behavior: `HOME`, `INTERNAL` (edge:// pages map), `FRAMEABLE` allowlist + `isFrameable()`, `DEFAULT_FAVORITES`, `ENGINES` (bing/google/duckduckgo/**copilot**, each `build(q)`), `classifyInput()` (typed text → kind + URL), `normalizeBrowseUrl()`, `bingSuggest()`, `ytEmbed`, `absolutizeHtml`, `displayUrl` |
| `edge/edge.scss`        | 1821  | All browser styling incl. dark/light theme blocks                                                                                                                                                                                                                                                                                                              |

Common browser edits:

- Change home page → `HOME` in `edgeNav.js`
- Add/remove an `edge://` page → `INTERNAL` map in `edgeNav.js` + a render branch in `edge.jsx` (`tab.kind === "internal" && …`)
- Change what a search does → `ENGINES` + `classifyInput` in `edgeNav.js`
- Change suggested sites → `FRAMEABLE` + `DEFAULT_FAVORITES` (omnibox/new-tab filter through `isFrameable`)
- Change tab bar / omnibox looks → `edge.scss`

## File types — the one router every open goes through

```
double-click / desktop / Start / Terminal / "Open with" / drop
  └─ src/actions/index.js   handleFileOpen(id)   → looks the item up in the VS
       └─ src/utils/os/assoc.js   appForFile(name)   → EXT_KIND[ext] → BY_KIND[kind][0]
            └─ openFileWith(appKey, item, opts)     → the app's action + its file
```

- **`src/utils/os/assoc.js` is the single source of truth.** `EXT_KIND` maps 120+ extensions to a
  kind (`image` · `audio` · `video` · `web` · `board` · `text` · `font` · `archive` · `program` ·
  `unknown`), `BY_KIND` maps the kind to the app (`photos`/`paint`, `groove`, `movies`, `edge`,
  `whiteboard`, `notepad`), and `appForFile()` applies the per-PC override on top. Add a new
  extension by adding **one line**; add a new app by adding it to `APPS` + `BY_KIND`.
- **`openFileWith`** is the only place that knows how to hand a file over: media goes through
  `mediaBus` (a mailbox + `wos:openMedia` event, so Groove/Movies pick the file up whether they
  were already running or not), web goes through `EDGELINK` as a `blob:` URL (so a local page's
  scripts and styles are live), text goes through `OPENTXT` with the path attached for Save.
- **Honest refusals.** A `program` (`.exe`, `.msi`, …) or an `archive` (`.zip`, `.7z`, …) is not
  text, whatever bytes it holds: it gets a toast that names the file and says why, and no window.
- **`Open with` + `Always use`** (Explorer's context menu): `openWith(name)` lists the apps that
  make sense for that kind (the default first, marked `· default`); `alwaysKeyFor(name)` offers —
  and `setOverride(ext, key)` stores — the app you last chose by hand, in `wos.fileAssoc`
  (localStorage), with `Reset .ext association` to undo it. `wos:assocChanged` tells open views.
- **Notepad's contract** (`notepad.jsx`): one tab per file — `normPath()` collapses repeated
  separators and `samePath()` compares case-insensitively (and ignores a renamed profile folder),
  so a restored session can never show the same document twice. `OPENTXT` **re-reads the file from
  the Virtual Storage first** (the disk always wins over a saved session) and only then updates the
  tab; dirty tabs are asked before the reload. Closing asks Save / Don't save / Cancel, and
  `persistSession()` decides what survives — a discarded untitled tab dies, a dirty file reverts to
  its last saved bytes.
- **Icons ship with the type.** `src/utils/os/icons.js` maps every openable extension to a glyph
  and a human name (`MAP` → `img/icon/<name>.png`, or `img/icon/win/<name>.png` for the Fluent
  set); a fresh extension falls back to the generic page icon. The driver asserts the two tables
  stay in step — _145 openable extensions, each with a real icon file_ — so a new extension can
  never ship as a broken image.
- **Coverage:** `tests/file_types.py` — disk-beats-session, one tab per file, the
  extension matrix (.mp4/.webm/.mkv → Movies, .mp3/.wav/.m4a → Groove, .html → Edge, .png → Photos,
  .json/.txt → Notepad), the refusals, Open with, Always use, and Notepad's close path.

## Store apps (PWA tiles)

`public/storeCatalog.json` — flat list; per app:
`id, name, icon (URL), publisher, category, price, rating, ratingsCount,
data: { type: "IFrame", url (WHERE IT OPENS), desc }`.
Edit `data.url` to repoint an app, `icon` to re-skin it.

## Files & folders of the PC itself

- Seed tree: `src/reducers/dir.json` (profile `Blue`: Desktop/Documents/Downloads/Music/Pictures/Videos/OneDrive)
- FS engine + versions: `src/utils/os/vs.js` (`TREE_VERSION` re-seeds once when bumped)
- Real uploads: explorer `importFiles` — text as text, binaries as `__b64` records

## Phone layout

Everything phone-specific is CSS in **`src/mobile.scss`**, behind
`(pointer: coarse)` — a PC never matches a rule in it.

- `html[data-wos-mob="1"]` (set by `src/utils/os/mob.js`) scales the rem ratio; the phone pass
  below only _fits_ containers and never enlarges an icon.
- Portrait phones keep the desktop's sizes: desktop icon 36 px, taskbar button 38 px with a
  24 px glyph, Start tiles 32 px in the same **6 columns**.
- Caps so a phone can't outgrow a PC: Start menu `min(640px, 100vw)`, side pane
  `min(360px, 100vw)`, both centred; labels wrap to two lines (`.dskApp .appName`,
  `.pnApp .appName`).
- Taskbar on a phone: the icon strip scrolls (hidden scrollbar) and the tray sits in flow
  beside it, so the clock is never covered; the widget button unpins from `position: absolute`.
- The rotate screen is `src/components/shared/RotateGate.jsx` + `src/rotategate.scss` —
  **on by default** on portrait phones. Tap to rotate = haptics + sensor permission + full
  screen + orientation lock (three mode spellings), then an honest verdict; after a refusal or
  a stalled lock it offers _Continue in portrait mode_, which writes
  `localStorage.setItem("wos.rotateGate", "off")` — the same switch you can set by hand.
- **Who counts as a phone** (`isPhone()`): touch **and** `min(screen.width, screen.height) <= 740`
  — the _screen_, not the viewport, so the answer does not flip when the device turns; 740 is the
  same breakpoint as `src/mobile.scss`. `navigator.userAgentData.mobile === false` can only veto
  (a touch laptop), never promote: Chromium claims `mobile: true` for Android tablets and iPads
  report nothing at all, which is exactly how tablets used to get gated by mistake.
- **The advanced layer**, all driven by real signals, never by theatre:
  `DeviceOrientationEvent` (gamma) → `--roll` (the illustration _is_ the phone's angle, keyframe
  loop off), `turnLeft = 90 − |roll|` → the `.rgDial` degrees-to-go chip and `data-near` (green
  arc + "Almost there — N° more."), `--prog` → `.rgArcPath` stops sweeping and becomes a progress
  meter (`pathLength="100"`, `stroke-dashoffset: calc(100 - var(--prog) * 100)`), and
  `document.fullscreenElement` + `phase === "locked" && !stalled` tick the two checklist rows.
  A phone lying flat (|gamma| < 3 and |beta| < 15) is ignored rather than guessed at, and a
  desktop with no sensor sees no dial at all.
- Settings ▸ **Personalisation ▸ Rotate prompt** (`settingsData.json` tile + `RotateGatePanel`
  in `settings.jsx`) is the user-facing switch: the toggle reads/writes `wos.rotateGate` and
  pings the shell with a `resize` + `orientationchange` so a phone reacts instantly, and
  _Preview the gate on this device_ dispatches `wos:rotateGatePreview`, which makes the gate
  render anywhere (desktop included) in `preview` state — no stored flag, "Close preview" to
  leave.
  Tests: `tests/mobile_layout.py` and the real-device matrix
  `tests/rotate_gate_devices.py` (49 checks: seven phone profiles gated, tablets and touch
  laptops not, iOS-Safari-shaped browser with no orientation API, lock-but-no-turn, sensor).

## Toasts / dialogs / shared controls

- Toasts: `src/reducers/ui.js` (life 15–30s) + `src/containers/ui/index.jsx` (render/timer)
- Win11 dialogs (confirm/prompt/save/open): `src/utils/os/ui.js`
- ComboBox/Toggle (portal to body): `src/components/shared/Controls.jsx`, styles in `src/containers/ui/ui.scss`

## After ANY edit

```
npm ci               # Node 22.12+ recommended; reproduce the lockfile
npm run build        # → build/ including offline worker/inventory
node --experimental-vm-modules scripts/drive.cjs   # broad regression driver
npm run smoke                                      # production build, 0 console errors
python3 tests/mobile_layout.py                     # gate + Settings switch + phone layout
python3 tests/rotate_gate_devices.py               # gate on real phone/tablet/desktop profiles
python3 tests/verify.py                            # core shell behaviour
python3 tests/solitaire_aash.py                    # Solitaire engine
python3 tests/file_types.py                        # file types + icons + Notepad open/close
python3 tests/iframe_flow_test.py                  # handed-over links open in real tabs
```

All Python suites live in the repository (`tests/`) and drive the built app on
`http://127.0.0.1:4180` (Playwright Chromium). They resolve `build/` and their screenshots
relative to themselves, and CI runs the checked-in workflows; see `docs/TESTING.md` for focused production and broader suites.

## Microsoft Store

- **Layout** (`store.jsx` + `assets/store.scss`): narrow icon rail (Home · Apps · Gaming · Movies & TV · Add-a-web-app · Library), hero carousel with gradient art + dots/arrows/auto-advance, horizontally scrolling app rows with chevron paging, chip-filtered grids **paginated 120 at a time** ("Show more"), skeleton shimmer while the catalog fetches, dark+light.
- **Catalog**: `public/storeCatalog.json` — the curated remote-app catalog (inspect the current JSON for counts; third-party availability can change) (Wikimedia sitematrix editions, OSM country+city embeds, Gutenberg top classics, Internet Archive films/audio/playable MS-DOS games, community picks). Regenerate: `python3 scripts/gen_store_catalog.py` (GET-probes every URL; verdicts cached). Store lazy-fetches it on open.
- **Detail page = the real product page**: identity rail (icon/name/publisher/Get·Open/rating summary), **Screenshots** (read-only gallery: arrows, counter, thumbnails, keyboard, lightbox portal, video transport `WosVideo`), **Description**, **Ratings and reviews** with the orange 5-star histogram (deterministic from the catalog rating), **Features** (`data.feat`), Product details, "More like this". No add/remove-gallery buttons anywhere — manage UI retired in r16 by design; catalog seeds via `data.gallery`.
- **On-device AI**: `assets/store-ai.js` — a tiny linear ranker over your opens/installs/searches (IndexedDB `store.metrics`, nothing leaves the PC). Powers the **"Picked for you"** row, **search suggestions** (type-ahead dropdown), and **"More like this"**. See `docs/STORE-AI.md`.
- Add-your-own-app still lives on the rail (+): `.storeForm` → detail → Get → desktop.
- **Icons from anywhere**: `Icon`/`Image` (utils/general.jsx) accept http(s) URLs of any type (SVG ✓), data:/blob: URLs, and Virtual Storage paths (`C:\Users\...\x.png` or `vs:Pictures/x.png` → resolved to a data URL at render).
