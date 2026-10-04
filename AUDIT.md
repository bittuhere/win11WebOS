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

# Code-level audit: your backup (Round 6, `e81340b`) → v1.0.0-stable (`a04b53f`)

Method: full `git diff e81340b..HEAD` reviewed hunk-by-hunk on every shared
behavior layer (window system, start menu, App shell, reducers, utils),
plus deletion-scan of every rewritten app. This is the code match you asked
for — not a file-list match.

## Verdict
**Nothing from Round 6 was lost or weakened.** Every behavioral difference is
one of: (a) something you explicitly ordered, (b) a driver-verified bug fix,
(c) an additive feature. Details:

### Byte-identical to your backup (zero drift)
- `tabs.scss` — the entire window animation feel: open/close/minimize/resize
  transitions, hide scale 0.8, cubic-bezier(0.85,0.14,0.14,0.85) 250 ms.
  (A Round-9 experiment had muted these; it was reverted byte-for-byte.)
- `reducers/apps.js` — the whole window lifecycle: openApp, `closing` →
  `APPREAP` (mount/unmount), togg, snapping, z ordering.
- `wnapp.scss`, `apps.scss`, `taskbar/`, `desktop/`, `background/`,
  `reducers/settings.js`, `reducers/startmenu.js`, `reducers/taskbar.js`,
  `utils/general.js` — untouched since Round 6.

### Changed only by your explicit orders
- `startmenu.scss` — slide now rises from behind the taskbar
  (`translateY(calc(100% - 64px))`, 220 ms = the window curve). The deleted
  `.recApps/.reApps` blocks ARE the Recommended section you removed.
- `dir.json` + `vs.js` — Blue profile normalized to the real Windows set;
  TREE_VERSION 4 re-seeds old trees once.
- `reducers/ui.js` — toast life 15–30 s (default 20) + the Win11 timer line.
- `edge.jsx` — the "You'll be redirected?" sheet deleted (your "No asking!");
  Reader/Snapshot demoted to a 9 s fallback behind the live frame;
  Bing Copilot engine added; frame bridge listener.
- `explorer.jsx` — `%github%` quick-access renamed to Network (your order);
  uploads binary-safe; videos honest-toast instead of Notepad.

### Changed only by driver-verified fixes (all were your bug reports)
- `widget.jsx` — optional-chaining guard (the ~1-in-N boot BSOD).
- `App.jsx` — adds Escape-hides-Start and Alt+Tab; nothing removed.
- `reducers/files.js` — epoch bump so folder views refresh live.
- `utils/general.jsx` — `undefined.png` 404 guard.
- `bridge.js`, `vs.js` (b64Of) — binary records + helper API.
- `notepad.jsx` — byte-identical to your backup (the double-click bug lived
  in corrupted upload data, now fixed at the explorer/vs layer and proven by
  driver steps r10-uploads).

### The stale-build explanation (what actually "went wrong" for you)
Your console log (`index.5332a895.js`, SnapshotPage crash, `/api/bing-suggest`
404 spam, `/webos-proxy` 404s) is from an OLD build being served on
localhost:8000. That bundle hash does not exist in any build since Round 7;
every one of those errors was fixed in Rounds 7–8 and guarded by driver steps.
Serving this tree's `build/` folder eliminates them — they are not present in
this code.

## Verification at release
Driver 98/98 · 0 failed · 0 runtime errors · extension self-test 13/13 PASS.

## Later rounds (summary)

| Round | What changed | Verified by |
| ----- | ------------ | ----------- |
| 19–20 | Storage-less boot, analytics + credential dead code removed, docs rewritten for `bittuhere/win11WebOS`, Solitaire ported to a vendored engine | `iframe_flow_test.py`, `verify.py` |
| 21 | Solitaire rebuilt on **AashishChakravarty/solitaire** (MIT) with multi-level undo, Draw 1/3 and click-to-move on top | `solitaire_aash.py` (51) |
| 22 | **Star me on GitHub** shortcut; phones fitted to the desktop's sizes (Start capped at 640 px, panes at 360 px, no enlarged icons) | `mobile_layout.py` |
| 24 | The gate **audited against real phones**: `isPhone()` rewritten (screen-size test, platform hint can only veto) after the matrix caught iPads and Android tablets being gated; the advanced layer added — sensor dial, arc as progress meter, illustration mirroring the real angle, self-ticking 3-step checklist; honest no-fullscreen verdict; `rotate_gate_devices.py` suite added | `rotate_gate_devices.py` (49), `mobile_layout.py` (59), `verify.py` (28), `solitaire_aash.py` (51), `npm run smoke` |
| 27 | **File types are real**: one router (`utils/os/assoc.js`, 120+ extensions → app), `Open with` + per-PC `Always use` overrides, honest refusals for programs/archives, `.html` in a live `blob:` page; **Notepad** opens the double-clicked file every time (disk before session, one tab per file, paths normalised, activation by tab id) and closes with Save / Don't save / Cancel; `tests/file_types.py` added to CI; the offline driver repaired (167 steps, 0 failed) | `file_types.py` (39), `verify.py` (28), `mobile_layout.py` (59), `rotate_gate_devices.py` (49), `solitaire_aash.py` (51), `drive.cjs` (167), `npm run smoke` |
| 23 | The **landscape gate** rebuilt (tap-to-rotate with full screen + orientation lock, honest verdicts, portrait escape) and the production pass: offline shell precache, deferred extras, `viewport-fit=cover`, version 0.2.0, dead files removed | `mobile_layout.py` (59), `verify.py` (28), `solitaire_aash.py` (51), `npm run smoke` |

### Production checklist (state at v0.2.0)

- [x] Static build (`build/`) with no server dependency; deploys to Pages/Netlify/Cloudflare
- [x] Service worker precaches the app shell → **boots offline**; BitBot weights excluded on purpose
- [x] `manifest.json` (installable), theme colour matching the shell, `viewport-fit=cover`
- [x] No analytics, no third-party card art, no remote fonts; licence + provenance in `NOTICE`
- [x] Boot smoke test (`npm run smoke`) green on every build
- [x] Six green gates: the browser suites (28 + 39 + 59 + 49 + 51 checks), the offline driver
      (167 steps, 0 runtime errors) and the sandboxed no-storage run
- [x] The gate's device detection is a tested contract, not a guess: seven real phone profiles
      gated, tablets / touch laptops / desktops never gated, iOS Safari's missing APIs handled
- [x] The phone gate has a user-facing switch (Settings ▸ Personalisation ▸ Rotate prompt) with a
      device preview — no feature is reachable only by hand-editing `localStorage`
- [x] CI on every push and PR: `npm ci` → `build` → `smoke`, then the browser suites
      (verify · iframe flow · file types · rotate gate · phone layout · solitaire) against the
      served build, with screenshots uploaded as artifacts
- [x] The suites are **part of the repository** (`tests/*.py`, kept by a `!/tests/*.py` rule in
      `.gitignore`) and portable — screenshots go next to the suite, `build/` is resolved
      relative to it, so a fresh clone on CI behaves exactly like the maintainer's machine
- [x] No stale metadata: README badges, `package.json` (0.2.0), `manifest.json` and every doc
      agree on the version and the test counts
- [x] Docs current for the target repo: `README`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `NOTICE`, `APPS-MAP`, `RELEASE-NOTES`, per-engine READMEs
