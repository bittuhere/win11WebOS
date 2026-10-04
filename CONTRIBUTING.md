<!--
  Copyright 2026 bittuhere (anurag670singh@gmail.com)

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

# Contributing to Windows 11 WebOS

Thanks for taking the time to help! This project is a browser-native recreation of the
Windows 11 desktop: no backend, no build server, no accounts required. Everything —
contributions included — runs from a single `vite` build.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

**Repository:** <https://github.com/bittuhere/win11WebOS>

---

## Ways to contribute

| I want to…              | Start here                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Report a bug            | [Open an issue](https://github.com/bittuhere/win11WebOS/issues/new) with the steps + console log |
| Request a feature       | Open an issue first — quick chat beats a surprise PR                                             |
| Add an app to the Store | [ADDING_APPS.md](./ADDING_APPS.md)                                                               |
| Understand the app map  | [APPS-MAP.md](./APPS-MAP.md)                                                                     |
| Translate the UI        | `public/locales/<lang>/translate.json` (see below)                                               |
| Improve docs            | Any `*.md` in the root is fair game                                                              |
| Report a vulnerability  | **Privately** — see [SECURITY.md](./SECURITY.md)                                                 |

Maintainers should also read [MAINTAINER-GUIDE.md](./MAINTAINER-GUIDE.md): deployment,
repository settings, releases and the legal notes.

---

## Development setup

Requirements: **Node.js 18 or newer** and npm. No global tooling is needed.

```bash
git clone https://github.com/<your-user>/win11WebOS.git
cd win11WebOS
npm install
npm start            # dev server on http://localhost:5173
```

`npm start` gives you hot-reload. The first run shows the Windows Setup flow — pick any
username and password (minimum 4 characters); it is stored in your browser only.

### Scripts

| Script             | What it does                                                                   |
| ------------------ | ------------------------------------------------------------------------------ |
| `npm start`        | Vite dev server on port **5173**                                               |
| `npm run build`    | Production bundle into `build/` (this is the folder you deploy)                |
| `npm run ghbuild`  | Same as build with `CI=false`, for GitHub Actions/Pages                        |
| `npm run preview`  | Serves the built `build/` folder on port **4180** (what the suites use)        |
| `npm run smoke`    | Boots the built app in jsdom and fails on console errors — **run before a PR** |
| `npm run prettier` | Formats the tree with the repo's Prettier config                               |
| `npm run tauri`    | Runs the Tauri (desktop shell) CLI — needs the Rust toolchain                  |
| `npm run crowdin`  | Pushes/pulls translations — needs a Crowdin API token, contributors can ignore |

### The end-to-end suites (Playwright)

The shell is also covered by browser suites that drive the **built** app. Serve `build/` on
port **4180** first (`python3 -m http.server 4180 --directory build`), then:

| Suite                                              | What it guards                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python3 tests/verify.py`                          | Core shell regressions: the About panel on boot, from the desktop context menu and after a restart, Github opening real browser tabs, Solitaire a dragged card never hiding, a real drag landing, window close + re-open                                                                                                                                                                                                            |
| `python3 tests/solitaire_aash.py`                  | The vendored Solitaire engine end to end: deal, fit, scripted + trusted drags (single card and runs), click-to-move, Draw 1/3, undo, hint, auto-complete → win, teardown                                                                                                                                                                                                                                                            |
| `python3 tests/mobile_layout.py`                   | The landscape gate (default on, tap sequence, honest refusals, portrait escape, the Settings ▸ Personalisation ▸ Rotate prompt switch and desktop preview) and the phone layout: desktop sizes, 6-column Start, no overflow, landscape/desktop never gated                                                                                                                                                                          |
| `python3 tests/rotate_gate_devices.py`             | The gate's device matrix: iPhone SE/12/15 Pro Max, Pixel 5, Galaxy S8/S9+, Nexus 5 all gated in portrait and never in landscape; iPad Mini/Pro, a touch laptop and a desktop are **not** gated; an iOS-Safari-shaped browser (no `screen.orientation`, no element fullscreen) still gets the gate with an honest verdict; a lock that resolves without the screen turning says so; the sensor dial, progress arc and live checklist |
| `python3 tests/file_types.py`                      | File associations end to end: 145 extensions mapped to the right app, `.mp4`/`.webm` → Movies, `.mp3`/`.wav` → Groove, `.html` → Edge, images → Photos, text → Notepad, honest refusals for programs and archives, "Open with" (including Notepad for `.html`), per-extensions "Always use" overrides, the icon of every type, and Notepad's open/close path (disk wins over a session, one tab per file, unsaved-changes prompt)   |
| `python3 tests/iframe_flow_test.py`                | Full setup → desktop inside a sandboxed no-storage frame, 0 console errors                                                                                                                                                                                                                                                                                                                                                          |
| `node --experimental-vm-modules scripts/drive.cjs` | The offline driver: 168 steps over the whole shell in a network-free jsdom sandbox — OOBE, every app's mount and teardown, the Virtual Storage, persistence across reloads, the phone gate and the icon/association tables. No browser or network needed                                                                                                                                                                            |

They need `pip install playwright && python3 -m playwright install chromium` once. The suites
live in the repository (`tests/*.py`) and write their screenshots next to themselves — the
`.gitignore` keeps `tests/*.png` out of your commits while tracking the suites themselves.

### Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

| Job                | What it does                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build + smoke**  | `npm ci`, `npm run build`, `npm run smoke` (boots the production build and fails on any console error)                                                                                                                                 |
| **Browser suites** | builds, installs Playwright Chromium, serves `build/` on :4180 and runs `verify.py`, `iframe_flow_test.py`, `file_types.py`, `rotate_gate_devices.py`, `mobile_layout.py`, `solitaire_aash.py`; uploads the screenshots as an artifact |

A red suite is a blocking failure — do not merge around it.

To preview a production build locally:

```bash
npm run build
npx serve build        # or: npx http-server build
```

### Optional build switches

Some optional integrations are compile-time flags read from `CONTROL.env` in the repo
root (see the file for the format: `NAME: VALUE`, one per line, defaults `OFF`). Never
commit your personal `CONTROL.env` values.

---

## Repository layout

```
src/                 the OS itself
  components/        reusable UI (taskbar, start menu, login bits, …)
  containers/        applications and screens (oobe, apps/*, …)
  reducers/          Redux store, actions, app registry, window manager
  utils/             OS services: links, storage, theme, file system, dialogs
  assets/            icons and art used by the apps
public/              static files served as-is (fonts, locales, store catalog, bitbot)
scripts/             build helpers + the boot smoke test
src-tauri/           optional Tauri desktop shell (Rust)
docs/                deeper documents (store AI, browser helper protocol)
build/               production output — generated, never edited by hand
```

The window manager, start menu, taskbar and every app live in Redux. External side
effects (opening links, talking to the network) belong in middleware — not in reducers.

---

## Coding conventions

- **React 18** function components + hooks; no class components in new code.
- **Styling** is SCSS/CSS beside the component; the window chrome uses the shared
  `applications` classes so new apps inherit drag/resize/focus behaviour for free.
- **State** changes go through actions → reducers. A reducer must stay pure: never
  dispatch from inside a reducer, and keep `window.open`/`fetch`/storage writes out of it.
- **Persistence** uses the helpers in `src/utils/idb.js`. They already degrade to
  in-memory storage when a browser context denies storage — don't reintroduce raw
  `indexedDB` calls, and never let a storage error take down a render path.
- **Safe storage access:** `localStorage`/`sessionStorage` are shimmed at boot; still,
  prefer the helpers over direct calls in new code.
- **No new tracking or remote scripts.** The OS ships zero analytics; PRs that add
  third-party telemetry will be declined.
- **Licence headers:** every new source file starts with the Apache-2.0 header block
  used throughout `src/` (copy it from a neighbouring file).
- **Formatting:** run `npm run prettier` before committing. Keep diffs focused — no
  drive-by renames or mass reformatting.

### Adding a translation

1. Copy `public/locales/en/translate.json` to `public/locales/<tag>/translate.json`.
2. Translate the **values**; keep the keys untouched.
3. Test by building with `VITE_LANG=<tag>` (or through the Settings app's language
   list) and confirm no key renders as `undefined`.

---

## Before you open a PR

Everything below is what CI runs, in the order it runs it:

| Gate   | Command                                                     | Expected                                 |
| ------ | ----------------------------------------------------------- | ---------------------------------------- |
| Format | `npm run prettier`                                          | no unrelated reformatting in the diff    |
| Build  | `npm run build`                                             | clean output in `build/`                 |
| Boot   | `npm run smoke`                                             | **0 console errors**                     |
| Driver | `node --experimental-vm-modules scripts/drive.cjs`          | 168 steps, 0 failures                    |
| Suites | serve `build/` on :4180 and run the six `tests/*.py` suites | 227 checks + the iframe flow, 0 failures |

## Pull requests

1. Fork the repo and branch from `main`:
   `git checkout -b fix/solitaire-drag` or `feat/store-search`.
2. Keep the change scoped to one thing. Rebase if `main` moved.
3. Run the gates in the table above — all of them must pass. If your change touches the shell,
   the gate, or an app, run the matching suite too. Anything that touches `isPhone()` or the
   rotate screen must keep **both** `mobile_layout.py` and `rotate_gate_devices.py` green — the
   second one is what stops tablets being gated again. Anything that adds a file extension must
   keep both `tests/file_types.py` and the driver's icon check green. CI runs all of this for
   you; run them locally first if you can.
4. If the change is visual, add a screenshot or short clip to the PR description.
5. Describe the _why_, not just the what; link the issue it closes.

Review checklist used on every PR:

- [ ] Builds clean (`npm run build`) with no new warnings in the bundler output
- [ ] `npm run smoke` reports **0 errors**
- [ ] No console errors on a cold boot, and none after the action the PR changes
- [ ] No new network calls, trackers, or external scripts
- [ ] Works with storage blocked (private window / sandboxed frame) — the OS must boot
- [ ] Apache-2.0 headers present on new files; no borrowed code without attribution

---

## Licence and trademarks

Contributions are accepted under the **Apache License 2.0** — by opening a PR you agree
your work may be distributed under those terms. See [LICENSE](./LICENSE) and
[NOTICE](./NOTICE).

Windows, Microsoft and the Windows logo are trademarks of Microsoft Corporation. This is
an unaffiliated fan re-creation for educational use; do not present the project as an
official Microsoft product, and do not use Microsoft branding for your own fork's
identity.
