# Windows 11 WebOS

> A faithful, open-source recreation of the **Windows 11 desktop that runs entirely in your
> browser** — Start menu, taskbar, snap layouts, a real file system, Microsoft Edge, a Store,
> an Office suite and a local AI. No server, no install, no telemetry.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![CI](https://github.com/bittuhere/win11WebOS/actions/workflows/ci.yml/badge.svg)](https://github.com/bittuhere/win11WebOS/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-informational.svg)](./CHANGELOG.md)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/build-Vite%203-646cff.svg)](https://vitejs.dev)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Tests](https://img.shields.io/badge/suites-227%20checks%20passing-brightgreen.svg)](./CONTRIBUTING.md#before-you-open-a-pr)
[![Code of Conduct](https://img.shields.io/badge/Code%20of%20Conduct-Contributor%20Covenant%202.1-e1007a.svg)](./CODE_OF_CONDUCT.md)

**Repository:** [github.com/bittuhere/win11WebOS](https://github.com/bittuhere/win11WebOS) ·
**Live demo:** [win11webos.pages.dev](https://win11webos.pages.dev/) ·
**Issues:** [report a bug](https://github.com/bittuhere/win11WebOS/issues) ·
**Security:** [SECURITY.md](./SECURITY.md) ·
**Changelog:** [CHANGELOG.md](./CHANGELOG.md)

## Notice

> This project is **not affiliated with Microsoft** and should not be confused with
> Microsoft's operating system or products. This is **not** Windows 365.
> "Windows" and "Microsoft Edge" are trademarks of the Microsoft group of companies.
> Every Microsoft-branded experience here is an original, unofficial recreation built with
> open web technologies.

---

## Highlights

- **A real desktop** — drag, snap (Win + Arrow, hover layouts), minimize, maximize, resize,
  double-click icons, rubber-band select, right-click menus everywhere, and honest shutdown /
  restart sequences with a lock screen and PIN or password sign-in.
- **A file system that persists** — the Virtual Storage (IndexedDB) holds your files, installed
  apps, settings and account. Refresh, close the tab, come back tomorrow: your PC is exactly as
  you left it. Clear site data and you get a factory-fresh machine.
- **Microsoft Edge (internal)** — tabs, history, favourites, downloads and reader view, with
  honest handling of sites that refuse to be embedded. Links that belong to the wider web open
  in a **new tab of your real browser** instead.
- **Microsoft Store** — 238 curated, genuinely working apps (books, games, reference,
  creativity, news, travel), AI-ranked picks and typo-tolerant search. One click installs a tile
  to your Start menu and desktop.
- **Windows Update** — the PC checks a static feed on every launch, tells you honestly when a
  newer build exists, shows its size and release notes in a window of its own, and installs it
  with one button (caches cleared, then reloaded onto the new build). Versioning reads
  `1.01 → 1.02` for fixes and `1.xx → 2.00` for feature releases; see **Updates** below.
- **Office suite** — Word, Excel, PowerPoint and OneNote.
- **BitBot, the local AI** — an ~82.4-lakh-parameter (8.24 M) quantised neural network that runs
  on _this_ PC, plus real symbolic engines: step-by-step BODMAS, equations verified by
  substitution, 33 word-problem solvers and 347 knowledge intents. It says "I don't know"
  instead of guessing.
- **File Explorer with real file associations** — cut/copy/paste, rename, delete to the Recycle
  Bin, upload from your device, and one router that every entry point shares (double-click,
  desktop, Start, Terminal, "Open with"): images → Photos or Paint, audio → Groove Music,
  video → Movies & TV, HTML → the internal Edge, 80+ code and text types → Notepad, and a
  program or a packed archive is **refused out loud** instead of opening an empty window.
  Right-click any file for **Open with** (including _Notepad_ for an `.html`, so you can read the
  source) and **Always use …** to make the choice stick — stored per PC and resettable. Every one
  of those 145 types also gets its **own icon and type name** in Explorer, not a generic page.
- **Notepad that opens what you clicked** — one tab per file, always the bytes on disk (a stale
  session can never win), Windows-accurate path handling, and a close that asks: Save /
  Don't save / Cancel, where "Don't save" really discards.
- **Terminal** — 40+ commands with aliases (`dir`, `cd`, `tree`, `echo hi > note.txt`,
  `calc solve 2x+5=17`, `install`, `theme`, `neofetch`, `systeminfo`, `vs`, `whoami` …).
- **And**: Solitaire Collection, Minesweeper, Calculator, Calendar, Clock & Alarms, Weather
  (live Open-Meteo), News (live Wikinews + offline edition), Maps (live OpenStreetMap), Camera,
  Paint, Photos, Snipping Tool, Notepad with tabs, Sticky Notes, To Do, Task Manager, Security
  scans, Xbox, Media Player and more.
- **Phones** — a phone held upright gets the **landscape gate**: a full-screen, animated
  "rotate your device" screen built around one button that does the whole job — haptics, the
  motion-sensor permission (asked while the gesture is still live, which is the only moment iOS
  allows), full screen, then an orientation lock tried under three mode spellings. It never
  guesses: a phone that locks but does not physically turn (its own rotation lock is on) is told
  exactly that, in amber; a browser that cannot lock _and_ offers no full screen is told that,
  too. Where the device reports it, the screen goes further — a live **degrees-to-go dial**, the
  sweep arc turning into a real progress meter, the illustration mirroring the phone's actual
  angle, and a three-step checklist that ticks only when each step really happened.
  Only phones are gated (touch, and a short screen side of 740 px or less): a portrait **tablet**
  is a perfect little desktop and is never interrupted, and neither is a touch laptop. If the
  browser has run out of ideas (a second refusal, or a stalled lock), **Continue in portrait
  mode** appears — the same interface at the same sizes, laid out for a narrow screen: desktop
  icons still 36 px, Start still 6 columns, menu and panes capped at their desktop widths
  (640 px / 360 px). The gate is on by default and lives in
  **Settings ▸ Personalisation ▸ Rotate prompt**, where you can turn it off or preview it on any
  device; the same switch is `localStorage["wos.rotateGate"]` (`"off"` disables it).
- **Star me on GitHub** — a desktop-and-Start shortcut (GitHub's cat wearing a star) that opens
  the project repository in a new tab of your real browser, as a nudge for visitors to ⭐ it.

## Tech stack

| Layer         | What we use                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| UI            | React 18, Redux 4 (`redux` + `react-redux`), SCSS + Tailwind-style utility classes                                  |
| Build         | Vite 3 (`npm start` / `npm run build`), `vite-plugin-pwa` — the app shell is **precached**, so the OS opens offline |
| Icons         | Font Awesome 6 + hand-drawn inline SVG icon set                                                                     |
| Persistence   | IndexedDB ("Virtual Storage") with a localStorage mirror for the account record                                     |
| Desktop shell | [Tauri](https://tauri.app) 1.x config ships in `src-tauri/` for an optional native window                           |
| AI            | BitBot — quantised int8 network in `public/bitbot/`, plus rule/symbolic engines                                     |
| i18n          | i18next + `crowdin.yml` for translated UI strings                                                                   |

## Run it

Requirements: **Node 18+** and npm 9+.

```bash
git clone https://github.com/bittuhere/win11WebOS.git
cd win11WebOS
npm install
npm start          # dev server → http://localhost:5173
npm run build      # production build → build/
npm run smoke      # boots the production build headlessly, asserts zero console errors
node --experimental-vm-modules scripts/drive.cjs   # the offline driver: 168 steps, no network
```

The browser suites live in `tests/` and drive the **built** app on port 4180:

```bash
npx serve -l 4180 build     # or: python3 -m http.server 4180 --directory build
pip install playwright && python3 -m playwright install --with-deps chromium   # once
python3 tests/verify.py                # core shell behaviour               (28 checks)
python3 tests/file_types.py            # file types, icons, Open with, Notepad open/close (41 checks)
python3 tests/iframe_flow_test.py      # handed-over links, real browser tabs
python3 tests/rotate_gate_devices.py   # the gate, device by device         (49 checks)
python3 tests/mobile_layout.py         # phones, the fitted desktop, the Settings switch (59 checks)
python3 tests/solitaire_aash.py        # the Solitaire engine end to end    (51 checks)
```

All of them also run in CI on every push and pull request (`.github/workflows/ci.yml`).

Then serve the folder it produced — `npx serve build` or any static server. The OS works
offline after the first visit (the shell is in the service worker cache), and is installable
from the browser's "Install" / "Add to Home Screen" action.

The production build is fully static: drop `build/` on GitHub Pages, Cloudflare Pages, Netlify,
Vercel or any web server. Two host files ship with it — `public/_redirects` (SPA fallback, used by
Netlify and Cloudflare Pages) and `public/_headers` (security headers: CSP, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, HSTS where the host serves HTTPS). The canonical
deployment is GitHub Pages at `https://win11webos.pages.dev/`.

### Optional build switches — `CONTROL.env`

Create `CONTROL.env` in the repo root before building (colon format, defaults ship OFF):

```
ES: OFF                          # OFF hides the OOBE browser-extension screen
EMAIL: you@example.com           # address the Feedback / Help forms send to
```

The file is read at build time by `vite.config.js` and is **not** required.

## Deploying

The build is static and host-agnostic — the same `build/` folder works at the domain root, on a
GitHub Pages **project** path (`/win11WebOS/`), or inside any sub-folder, because every asset URL
is relative.

| Host                 | What to do                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Pages**     | Push, then Settings ▸ Pages ▸ _Deploy from a branch_ → `gh-pages`/`docs`, or point a workflow at `build/`. `.github/workflows/ci.yml` already builds it. |
| **Cloudflare Pages** | Build command `npm run build`, output directory `build`. `public/_headers` and `public/_redirects` are picked up automatically.                          |
| **Netlify**          | Build command `npm run build`, publish directory `build`. Same two files apply.                                                                          |
| **Vercel**           | Framework preset _Vite_, output `build`.                                                                                                                 |
| **Any web server**   | Copy `build/` and serve it; make unknown paths fall back to `index.html`.                                                                                |

What already ships for production:

- **Security headers** — `public/_headers` (CSP with `object-src 'none'` and `frame-ancestors 'self'`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP) and long-lived immutable caching
  for the hashed `assets/`.
- **No source maps.** Nothing to reverse-engineer; smaller deploys.
- **SEO and social** — a full meta set in `index.html` (canonical, Open Graph with a 1200 × 630
  `og-image.png`, Twitter card, `robots.txt`, `sitemap.xml`) plus `WebApplication` structured data so
  search engines can render a rich result.
- **Installable web app** — `public/manifest.json` with maskable 192/512 icons, screenshots,
  categories and **shortcuts** that deep-link into apps (`./?app=notepad`, `./?app=explorer`,
  `./?app=solitaire`).
- **Offline shell** — the service worker precaches the app; the 11 MB BitBot weights stay out on
  purpose, and the keyboard easter eggs load only after the desktop is up.

## Updates

This PC updates itself from a **static feed** — three files, no server, no account, no telemetry:

```
public/updates/
├── feed.json          what the newest build is (version, size, date, notes path, download link)
├── notes/<version>.md the release notes for it, in markdown
└── notes/media/       the pictures those notes use
```

A few seconds after the desktop boots, the PC fetches `updates/feed.json` with a cache-busting
query and `cache: "no-store"` (and `/updates/*` is served `Cache-Control: no-store`), so a
browser cache can never hide a release. If the feed names a newer build, a notification says so
and offers **See what's new**; either way the answer is honest — "You're up to date — v1.01".

**Windows Update** (Start menu, or **Settings ▸ Windows Update**) shows the version, size,
release date, the kind of update and the full release notes rendered locally by
`src/utils/os/md.js`. **Install now** clears every cached copy of the old build — service
worker, Cache Storage, the update check itself — reloads onto the new one and records the
install in the update history. Your files, apps and settings live in IndexedDB and are kept.

### The version scheme

| Number        | Meaning                              | The updater calls it |
| ------------- | ------------------------------------ | -------------------- |
| `1.01 → 1.02` | fixes, no new features               | **quality** update   |
| `1.xx → 2.00` | a new release family: apps, features | **feature** update   |

The running build is declared **once**, in `src/utils/os/version.js`:

```js
export const OS = {
  family: "WebOS",
  major: 1,
  build: 1,
  channel: "stable",
  released: "2026-10-04",
};
```

The desktop, the About panel, Settings and the updater all read that one object, so they cannot
disagree. `npm`'s `package.json` version and `src-tauri/tauri.conf.json` carry the same release
as semver (`1.1.0` for WebOS `v1.01`).

### Publishing a release

1. Make the change and bump `OS.build` (a fix) or `OS.major` (a feature release) in
   `src/utils/os/version.js`; mirror it in `package.json` and `src-tauri/tauri.conf.json`.
2. Write `public/updates/notes/<version>.md` and add any pictures under `notes/media/`.
3. Point `feed.json`'s `latest` at the new version (push the old entry onto `history`) and keep
   `notes` pointing at the markdown file.
4. Commit, push, deploy. Every PC that boots afterwards hears about it.

The full reference — every feed field, the notes format, the publishing checklist — is in
[`public/updates/README.md`](public/updates/README.md).

## Privacy, honestly

- There is **no server** and no analytics. Your files, notes, account and settings live in your
  browser's IndexedDB on your device.
- Network calls are only the ones you would expect:
  [Open-Meteo](https://open-meteo.com) for weather, [Wikinews](https://en.wikinews.org) and
  [Wikipedia](https://en.wikipedia.org) for the News / “on this day” widgets,
  [OpenStreetMap](https://www.openstreetmap.org) for Maps, the real sites behind Store apps and
  Edge tabs, and the feedback form you explicitly submit. Nothing else, and no third-party
  caches — every widget falls back to bundled data when a call fails.
- Every placeholder is honest: if an app is local-only, it tells you so.

## Project structure

```
src/
  App.jsx                    boot sequence, error boundary, window manager wiring
  components/                shell chrome — start menu, taskbar, context menus, login
  containers/
    applications/            the window manager + one file per built-in app
    background/              wallpaper, boot screen, lock screen
    oobe/                    first-run setup
  reducers/                  Redux slices (apps, desktop, files, settings, wallpaper …)
  utils/                     icons, Virtual Storage, OS services, shared dialogs
    os/assoc.js              the file-type table: extension → app, "Open with", per-PC overrides
public/                      static assets: locales, Store catalog, BitBot weights, icons,
                             og-image, manifest.json, robots.txt, sitemap.xml, _headers, _redirects
scripts/                     dev tooling: the boot smoke test, the offline driver, the harness
                             they share, the Store catalogue generator
docs/                        deeper design notes (Store AI, browser helper protocol)
tests/                       the browser suites (Playwright) — run against build/ on :4180
```

`MAINTAINER-GUIDE.md` is the short list of things only you can do — creating the GitHub
repository, the settings to switch on, the placeholders to replace, release and maintenance
steps. `APPS-MAP.md` indexes every screen and app and explains how to edit each one; `ADDING_APPS.md`
walks through adding an app to the Store; `CHANGELOG.md` records what each release contains; and
`docs/` holds the deeper design notes (Store recommendations, the browser-helper protocol).

## Contributing

Contributions are very welcome — code, translations, docs, bug reports and ideas.

- Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow, coding conventions and PR checklist.
- Be kind: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) applies to every space of this project.
- Found a security problem? Please follow [SECURITY.md](./SECURITY.md) — do not open a public issue.
- Good first steps: search the [open issues](https://github.com/bittuhere/win11WebOS/issues),
  read `APPS-MAP.md` and pick an app to improve, add an extension to
  `src/utils/os/assoc.js`, or translate the interface in `public/locales/`.

## Credits

- Desktop lineage: the wonderful open-source [win11React](https://github.com/blueedgetechno/win11React)
  by [blueedgetechno](https://github.com/blueedgetechno).
- Solitaire engine: [AashishChakravarty/solitaire](https://github.com/AashishChakravarty/solitaire)
  — a single-file Klondike game (MIT, © 2025 Aashish Chakravarty), vendored into
  `src/containers/applications/apps/solitaire-aashish/` and adapted for the OS window
  (see that folder's README for every adaptation and improvement).
- Office suite: [bittuhere/msoffice](https://github.com/bittuhere/msoffice).
- BitBot's brain: [bittuhere/ai](https://github.com/bittuhere/ai).
- Card faces: drawn in CSS with Unicode suit glyphs by the Solitaire engine — no card artwork is bundled.
- Data: weather © [Open-Meteo](https://open-meteo.com) · news © [Wikinews](https://en.wikinews.org)
  (CC BY 2.5) · maps © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors ·
  Store apps belong to their creators.
- Icon artwork and fonts are the property of their respective owners and are used here for a
  non-commercial, educational recreation.

## License

[Apache License 2.0](./LICENSE) — see also [NOTICE](./NOTICE) for attribution requirements.

**Contact:** [win11webos@gmail.com](mailto:win11webos@gmail.com)
