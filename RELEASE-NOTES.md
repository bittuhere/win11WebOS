# Win11 WebOS v1.02

### v1.02 shell/update corrections

Real taskbar-origin slides for Start and Quick Settings; opaque theme-aware standard title bars; GitHub feed discovery, installed/offered notes separation, notes retry, and recoverable malformed/network/deployment-mismatch states. See `docs/TESTING.md` and the current validation report.

Released 5 October 2026 · Stable · Build 2 · Quality update

## Offline installation

The first production boot saves all bundled local files before opening setup/login. A real file-count percentage, spinner, file count and verified payload size show progress. Four bounded download workers verify SHA-256 hashes. Failed downloads can be retried; online-only mode is offered when storage is unavailable. BitBot weights, local fonts, wallpapers, Office and game resources are included.

The update feed is deliberately never cached. External websites, live weather, maps, news, remote music, web search and user-installed remote apps still require internet. Browser storage can be evicted; this is not a native OS installation.

## Safer updates

Automatic feed checks start after successful login, once per boot, with pause/skip controls. A manual check remains available. New files are staged and verified before activation; a failed download does not delete the current build or personal files. History is confirmed only after the expected build actually boots.

## Desktop and compatibility

About and Settings read the running version from release.json. Installed release notes do not offer to install the same release again. Update pages wrap inside smaller windows and support keyboard focus, dark mode, high contrast and reduced motion. Start and tray use a short weighted lift and subtle scale rather than a full-height linear slide.

Desktop windows, widgets, deep links and optional startup effects wait until unlock. The first offline download and the local account/theme reads necessarily occur before login. BitBot and Terminal load trusted local scripts without eval; unused Firebase login/configuration were removed. MP3 export no longer depends on a runtime CDN script.

## Project information

Public About and documentation pages describe Win11 WebOS by Bittu (bittuhere), its source, features, license and limitations without requiring JavaScript or login. Canonical links, sitemap and structured data are updated. Search engines and AI services decide independently whether and when to index or cite the project.

## Production packaging and brand follow-up

The installer now embeds the four-pane SVG used by the modern favicon, with reduced-motion-aware animation and paused error-state motion. Deployment accepts verified same-origin Cloudflare clean-URL redirects, removes the catch-all SPA rewrite, and adds preflight/artifact checks, a Node production preview, Pages configuration and reconciled current documentation.


---

> **Historical entries below:** old tool versions, test totals and update behavior describe their own releases, not the current v1.02 deployment contract.

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

# Windows 11 WebOS — Release Notes

## Round 27 — file types are real, and Notepad always opens the file you clicked

**The report.** *"In file explorer, when double clicked any text file, it opens it in notepad, but
after that it never opens — double click: opened notepad but not with the file!"* and *"double
click any .mp4 → movies, .mp3 → groove music, .html → browser (but if right clicked, also show
open with notepad), and so on! Give our windows support of many extensions!!"*

**Why the file never arrived.** Notepad restores its session asynchronously at boot. If you opened
a file while that read was still in flight, the restore landed *after* your document and replaced
it — so the second double-click raised Notepad showing yesterday's tab. Two more bugs sat behind
that one: a saved session path that differed only in a doubled separator
(`…\Documents\\a.txt`) was treated as a **different file**, so the same document got a second tab;
and paths were compared case-sensitively, so a renamed profile folder (`C:\Users\Blue` →
`C:\Users\Tester`) looked like a different machine.

- **The disk wins, always.** `OPENTXT` now reads the file out of the Virtual Storage *first* and
  only then touches the tabs; the session merge keeps any document that arrived while the restore
  was reading (restored tabs fill the gaps, the fresh one stays active). *Proven by suite, not by
  eye:* `tests/file_types.py` seeds a stale `notepad.session` for a path that has since changed on
  disk — the first double-click must show the disk bytes, not the saved copy.
- **One tab per file.** `normPath()` collapses repeated separators, `samePath()` compares
  case-insensitively and ignores a renamed profile folder, and `dedupeTabs()` keeps the freshest
  tab (the pathless *Untitled* tabs are never collapsed into anything).
- **Closing is a decision, not a hide.** The window close and the tab close both ask
  **Save / Don't save / Cancel**; Cancel leaves everything exactly as it was; "Don't save" runs
  `persistSession()`, which drops a discarded unsaved tab and reverts a dirty file to its last
  saved bytes — so the text you threw away does not come back on the next launch.

**The file-type system.** Every entry point — double-click, the desktop, Start, the Terminal's
`start <file>`, and "Open with" — now goes through one router, `src/utils/os/assoc.js`:
**120+ extensions → 10 kinds → the app that owns the kind**, with a per-PC override layer on top.

| you double-click | it opens |
| --- | --- |
| `.mp4` · `.m4v` · `.webm` · `.mkv` · `.mov` · `.avi` · `.mpg` · `.3gp` | **Movies & TV** (played, not just named) |
| `.mp3` · `.wav` · `.ogg` · `.m4a` · `.aac` · `.flac` · `.opus` · `.mid` | **Groove Music** |
| `.png` · `.jpg` · `.gif` · `.webp` · `.bmp` · `.svg` · `.avif` · `.heic` | **Photos** |
| `.html` · `.htm` · `.xhtml` · `.mht` | **Edge**, as a real page (`blob:` URL, scripts and styles live) |
| `.txt` · `.md` · `.json` · `.csv` · `.js` · `.py` · `.sh` · `.bat` · `.log` · `.yml` · … (60+) | **Notepad**, with the path attached so **Ctrl+S** writes back |
| `.exe` · `.msi` · `.zip` · `.7z` · `.iso` · `.ttf` · `.pdf` | **a toast that names the file and says why** — never an empty window |

- **Right-click → Open with.** The menu lists the apps that make sense for that file (the default
  marked `· default`), so an `.html` offers **Notepad** and you can read the source; **Always use
  Browser for .html** stores the choice (`wos.fileAssoc`) and **Reset association** undoes it. The
  "Always use …" line now offers the app you **last chose by hand** (`alwaysKeyFor`) instead of the
  default it was already on — which was a no-op for exactly the case people try first.
- **Honest refusals.** A `.zip` and an `.exe` used to open in Notepad showing `packed` / `MZ` as if
  they were documents. A program or an archive is now refused out loud — with the file's name in
  the toast — while "Open with → Notepad" stays available for anyone who wants to peek inside.
- **The browser hand-off was fixed at the root.** A local `.html` was being turned into a web
  *search* for the literal text `blob:https://…`: the `EDGELINK` reducer only accepted `http(s)`
  URLs. It now passes through anything the browser can really load (`blob:` · `data:` · `file:` ·
  `about:` · `webos:`), and the suite asserts the page is **actually rendered in a frame**.
- **The tab you asked for is the tab you get.** Activation used to be a
  *deferred index* (`setTi(t.length)` on the next tick). Any tab that collapsed —
  a duplicate path, or a session restore merging tabs in — left that index
  pointing at the wrong document, which is another way the report reproduces.
  The arriving document is now remembered **by id** and activated by id
  (`pendingDoc`), whatever the list does around it.
- **A new suite, wired into CI.** `tests/file_types.py` — **39 checks**: the stale-session case,
  one tab per file, the extension matrix above, the refusals, Open with → Notepad, Always use →
  stored → used → reset, and the whole close path (asks, Cancel keeps, Don't save closes and does
  not resurrect). The suite also stopped lying to itself: it verifies each Terminal command's
  receipt before trusting a result, so a lost keystroke can no longer be mistaken for an app bug.

**The offline driver came back to green.** `scripts/drive.cjs` (the sandboxed, network-free
runner) had drifted: it still asserted the *old* Solitaire stylesheet that round 21 deleted,
read a fixed `matchMedia` answer that made a landscape phone look portrait forever, expected the
News saved list under a retired storage key, and counted the harness's own "the network is
blocked" warning as a crash. All of that is repaired, plus two real robustness fixes it caught:
`openExternal()` now honours the `window.open` that exists **at call time** (not only the one
captured at load), and the phone pass no longer shrinks the desktop tile's label font — the
interface on a phone is the desktop's, fitted.

**Verified in this round:** `tests/file_types.py` **39/0** · `tests/verify.py` 0 failed / 28 ·
`tests/rotate_gate_devices.py` 49/0 · `tests/mobile_layout.py` 59/0 · `tests/solitaire_aash.py`
51/0 · `scripts/drive.cjs` **167 steps, 0 failed, 0 runtime errors** · `npm run smoke` 0 console
errors.

## Round 24 — the gate goes through a device lab (and gets sharper)

The rotate screen was already back and on by default. This round it was put in front of the
phones people actually carry, and it did not survive the first run: **an iPad in portrait was
getting the gate.** So were Android tablets. The cause was trusting
`navigator.userAgentData.mobile`, which Chromium reports as `true` for Android tablets and which
iPads do not report at all — so the fallback guess caught them instead.

- **Detection is now a tested contract.** A device is a phone when it is a touch device *and*
  its **screen's short side is 740 px or less** — `screen`, not the viewport, so the answer
  cannot flip when the device turns. The platform hint can only *veto* (a touch laptop with a
  desktop UA is never gated), never promote. Portraits of **iPad Mini, iPad Pro 11, a touch
  laptop and a desktop are never interrupted**; seven phone profiles from an iPhone SE (375×667)
  to an iPhone 15 Pro Max (430×932), plus Pixel 5, Galaxy S8, Galaxy S9+ and Nexus 5, all get
  the gate in portrait and none of them in landscape. New suite:
  `tests/rotate_gate_devices.py` — **49 checks**, including a check that an iPhone Safari UA is
  recognised even though Safari ships no `userAgentData`.
- **iOS Safari is a first-class path, not an afterthought.** With `screen.orientation` deleted
  and every `requestFullscreen`/`webkitRequestFullscreen` removed — Safari as it really is — the
  gate still loads (no page error), still asks for the motion permission (counted, to prove the
  ask happens inside the tap), and then says the true thing: it locks neither orientation nor
  the screen, so turn the phone by hand. Two taps in, the portrait escape appears, and taking it
  is remembered.
- **The screen now measures, it does not decorate.** Where the device reports an angle, the gate
  becomes telemetry: a **degrees-to-go dial** (`90 − |γ|`), the sweep arc trading its animation
  for `stroke-dashoffset` so it *is* the progress meter, the phone illustration dropping its
  keyframe loop and rotating with the actual `--roll` — turn the phone 80° and the picture is
  80° round — and, inside 12°, a green arc with *"Almost there — N° more."* A phone lying flat
  (|γ| < 3 with |β| < 15) is deliberately ignored rather than guessed at, and a desktop with no
  sensor never sees a dial it cannot justify.
- **The checklist tells the truth about the tap.** *Tap the button / Full screen / Landscape* now
  tick when the browser confirms each step — `attempts > 0`,
  `document.fullscreenElement` (watched live through `fullscreenchange`), and
  `phase === "locked" && !stalled` — each row saying `waiting` until it is real.
- **No-fullscreen honesty.** A browser that cannot lock orientation *and* exposes no element
  fullscreen gets its own sentence, naming the fix (add it to the Home Screen) instead of the
  generic refusal.

**The production pass that came with it.** CI did not exist, and the suites could not have been
committed if it had: `.gitignore` carried a blanket `*.py`. Both are fixed —
`.github/workflows/ci.yml` now builds, smokes and runs all four browser suites against the served
build on every push and pull request (screenshots uploaded as artifacts), and a
`!/tests/*.py` rule keeps the suites in the repository while still ignoring scratch scripts and
`tests/*.png`. The suites themselves moved into the project (`tests/`) and were made portable:
`build/` is resolved relative to the suite and screenshots are written next to it, so a fresh
clone on CI behaves exactly like the maintainer's machine. Stale metadata was swept too — the
README's version badge still said 0.1.1 and now says 0.2.0, with a CI badge beside it.

**Validation:** `npm run build` clean · `npm run smoke` 0 errors · **49/49** device matrix
(`rotate_gate_devices.py`) · **59/59** phone checks (`mobile_layout.py`) · **28/28** driver checks
(`verify.py`) · **51/51** Solitaire checks (`solitaire_aash.py`).

## Round 23 — the landscape gate, rebuilt (and a production pass)

**The gate is back, and it is a real piece of UI now.** Round 22 briefly shipped portrait as a
free-for-all with the rotate screen behind a flag; that is reverted — a phone held upright gets
the gate again, and the gate is better than it has ever been:

- **One tap does the whole job.** The button runs the sequence phones actually need: a 12 ms
  haptic tick, the motion-sensor permission ask while the gesture is still live (iOS only allows
  it then), full screen, then an orientation lock — trying `landscape`, `landscape-primary` and
  `landscape-secondary` in turn, because browsers disagree about which spelling they accept.
- **It never lies.** A resolved lock is not a promise that the screen moved — a phone with its
  own rotation lock on resolves the request and stays upright. One second later the gate
  re-checks the layout and, if it is still portrait, says exactly that: *"Landscape is locked,
  but the screen hasn't turned. Your phone's own rotation lock is probably on…"*. A browser that
  refuses outright says so in its own words.
- **A way out that respects the user.** After the browser has run out of ideas (a second refusal,
  or a stalled lock), **Continue in portrait mode** appears. Taking it remembers the choice
  (`wos.rotateGate = "off"`) and drops straight into the fitted portrait layout from Round 22 —
  same sizes as a PC, nothing enlarged. The flag is the same switch, so it can be set by hand.
- **Alive, not a dead screen.** 22 twinkling stars, a breathing aurora, a phone that turns
  portrait → landscape → back inside a dashed "target" outline, a sweeping progress arc, a pulsing
  ring while the browser is being asked, a spinning glyph while it works, and a green locked
  state when it succeeds. The phone illustration even **tilts with the real device** (DeviceOrientation,
  permission-gated, silently absent where unavailable).
- **Accessible and safe-area aware.** `role="alertdialog"` + `aria-modal` with a proper
  `aria-labelledby`/`aria-describedby`, a polite `aria-live` status line, a 46 px tap target that
  never takes a focus ring it was not given, `viewport-fit=cover` + `env(safe-area-inset-*)` so
  nothing hides under a notch or home bar, content that scrolls instead of clipping on short
  screens, and a `prefers-reduced-motion` mode that stops every animation.
- **A switch in the UI, not just a flag.** Settings ▸ Personalisation ▸ **Rotate prompt** turns
  the gate on or off and pings the running shell so a phone reacts without a reload; it also
  offers *Preview the gate on this device*, which shows the whole screen on a desktop too
  (labelled as a preview, nothing stored, one click to close).
- Portrait escape, `wos.rotateGate = "off"`, landscape and desktop: four escape conditions, all
  covered by tests.

**Production pass.** The build is now honest about being an app, not a page: the service worker
**precaches the entire shell** (`maximumFileSizeToCacheInBytes` raised to 3 MB; the 11 MB BitBot
weights stay out deliberately), so the OS boots offline and is installable; `manifest.json`'s
theme/background colours match the shell; the 220 KB of keyboard easter eggs (`react-pwa.js`) are
`defer`red off the critical path; `index.html` declares `viewport-fit=cover`; version moves to
**0.2.0**. Dead files removed: `src/service-worker.js.bak`,
`src/serviceWorkerRegistration.js.bak`, `public/serviceWorker.js`, `public/console.js`.

**Validation:** `npm run build` clean · `npm run smoke` 0 errors · **59/59** phone checks
(`tests/mobile_layout.py`: gate present by default, tap sequence + full screen, honest stall and
refusal verdicts, escape hatch + persistence, the Settings switch and its desktop preview,
desktop-sized portrait layout, landscape and desktop never gated, the shortcut opening a real
tab) · **28/28** driver checks (`tests/verify.py`) · **51/51** Solitaire checks · sandboxed
no-storage run: 0 console errors.

## Round 22 — Star me on GitHub, and phone support that respects the desktop

**The new shortcut.** *Star me on GitHub* is now an app of its own — a desktop icon and a
Start tile (GitHub's cat wearing a star, drawn as `public/img/icon/starme.png`) that does
exactly what the Github app does: it opens
[github.com/bittuhere/win11WebOS](https://github.com/bittuhere/win11WebOS) in a **new tab of
your real browser**, never the internal Edge. It ships on the desktop and in the pinned Start
grid for new PCs *and* for PCs whose desktop/Start was saved before it existed (existing
`localStorage` layouts get the tile appended). Registered like every other link-app
(`EXTERNALTAB`), so double-click on the desktop, Start tile and any future surface all behave
identically.

**Phones now run the real interface at the desktop's sizes.** The portrait rotate-gate used to
stand in the way, and the *chrome* outgrew the desktop: the Start menu and the settings pane
stretched to `100vw` (844 px on a landscape phone against 640 px / 360 px on a PC), which is
exactly the "why are the icons bigger on mobile" effect. Now:

- **Portrait is laid out properly** — Round 23 rebuilt the gate that guards it (that round's
  short-lived "off by default" experiment was reverted there).
- **Same sizes, fitted containers.** Desktop icons 36 px, taskbar buttons 38 px with 24 px
  glyphs, Start tiles 32 px icons in the desktop's **6 columns**, windows full-bleed — measured
  identical on the phone and on a 1440×900 desktop by `tests/mobile_layout.py`.
- **Never wider than a PC.** The Start menu caps at `min(640px, 100vw)` and the quick-settings
  pane at `min(360px, 100vw)`, both centred; the widget pane keeps its own ratio. Long labels
  wrap to two lines with an ellipsis instead of widening a tile (`.dskApp`, `.pnApp`).
- **The taskbar can't collide with the clock.** The icon strip scrolls (hidden scrollbar,
  touch momentum) and the tray is laid out in flow beside it, so a row of running apps no
  longer slides under the time; the desktop's absolute positioning is untouched.
- The gate moved to `src/components/shared/RotateGate.jsx` (one component, opt-in switch); all
  phone CSS lives in `src/mobile.scss`, still behind `(pointer: coarse)` so **a PC never
  matches a phone rule**.

**Validation:** `npm run build` clean · `npm run smoke` 0 errors · **34/34** phone/desktop
layout checks (`tests/mobile_layout.py`: portrait gate off, icon sizes equal to the desktop,
6-column Start, no overflow, tray clearance, opt-in gate, the new shortcut opening a real tab,
desktop control untouched) · **28/28** driver checks (`tests/verify.py`) · **51/51** Solitaire
checks · sandboxed no-storage run: 0 console errors.

## Round 21 — Solitaire, third engine: AashishChakravarty/solitaire

The previous engine's own demo still played better than the port did, so the port is gone.
Solitaire now runs on **[AashishChakravarty/solitaire](https://github.com/AashishChakravarty/solitaire)**
— a single-file HTML5 Klondike, MIT licensed (© 2025 Aashish Chakravarty) — vendored,
adapted, and then improved rather than merely wrapped.

**What the player gets:** the real game — correct Klondike rules and Windows-style scoring
with a locally saved best score, drag **or** double-click **or** click-to-move, multi-level
undo, hints, auto-complete once the stock is clear, animated deals/flips/moves, and a deal
that survives closing the window and re-opening it. Plus two things upstream does not have:
a **Draw 1 / Draw 3** switch (persisted) and a per-PC tally of games played and won shown
next to the score.

**What changed under the hood**

- `src/containers/applications/apps/solitaire-aashish/` — the vendored engine:
  `engine.js` (the whole game as `createSolitaire(root, options)`) and `engine.css`
  (upstream's stylesheet, flattened and scoped under `#solitaireApp`, page-level rules and
  the remote font `@import` dropped). `README.md` in that folder lists every adaptation and
  every improvement; `NOTICE` now carries the MIT text.
- `src/containers/applications/apps/solitaire.jsx` + `solitaire.scss` — a thin Win11 host:
  action bar (New game / Restart / undo / Hint / Auto-complete / Draw 1|3 / score + moves +
  wins), a win toast, and teardown. The engine is created when the window opens and
  `destroy()`ed when it closes, so nothing leaks between sessions.
- **The reported bug is fixed by construction.** Upstream parents nothing to `<body>`; this
  engine creates no drag proxy at all — the card under the pointer *is* the card, marked
  `.dragging`, and a test asserts mid-drag that it is still painted (opacity 0.75, 132×185
  px, inside the window, `0` clones, `0` stray nodes on `<body>`). The flying clones used by
  moves and auto-complete are appended to the board root and positioned in board
  coordinates, so an ancestor transform can never drag them off target.
- **Fit without blur.** Instead of scaling the board with `transform: scale()` (the old
  approach, which also broke the fixed-position clones), the host measures the window and
  sets `--card-width / --card-height / --board-gap / --stack-offset`; the board re-lays out
  and stays crisp at any size, from the default window to maximised.
- The old `solitaire-engine/` folder (cango91 port) and the hand-written engine before it
  are deleted, together with the CardStarter card library they carried — the deck is now
  drawn in CSS, so the bundle got smaller (JS 2223 KiB vs 2255 KiB, CSS 435 KiB vs 454 KiB
  gzipped-down equivalents) and the package contains no third-party artwork.

**Validation:** `npm run build` clean · `npm run smoke` 0 errors · **28/28** driver checks
(`tests/verify.py`: About on boot / desktop context menu / after Restart, Github tiles
opening real browser tabs, deal integrity, mid-drag card painted, real drag landing, close +
re-open) · **51/51** dedicated Solitaire checks (`tests/solitaire_aash.py`: deal, fit,
scripted + trusted drags, run drags, click-to-move, double-click to foundation, Draw 1/3,
undo, hint, restart, auto-complete → win toast, teardown, re-open) · sandboxed no-storage
runs with 0 console errors.

## Round 20 — Solitaire rebuilt on cango91/solitaire

The hand-rolled Klondike engine kept misbehaving inside the OS's own window stack, so it
is gone. Solitaire now runs on the **cango91/solitaire** engine — the one this project was
always meant to use — vendored whole.

**What the player gets:** the real Windows-Solitaire feel — drag *or* double-click to send
a card home, single-click shortcuts, a full undo/redo history stack, draw **1** or **3**
with unlimited passes through the stock, a Finish button once the game is provably won,
classic card faces (the CardStarter SVG deck), dealing/flipping/moving animations, and the
engine's Microsoft-style scoring available in settings.

**What changed under the hood**

- `src/containers/applications/apps/solitaire-engine/` — the vendored engine: models
  (`card`, `piles`), `solitaire.js` (rules + commands + history), `renderer.js` (all DOM and
  animation work), `scoring.js`, the command objects, and the CardStarter card library.
  `solitaire-engine/README.md` records every adaptation; `NOTICE` records provenance.
- `src/containers/applications/apps/solitaire.jsx` — a thin Win11 wrapper: it renders the
  exact DOM the engine expects, runs upstream's controllers (`src/js/main.js`) scoped to the
  window, mirrors score/moves/undo state into React, and tears every listener down when the
  window closes (the engine's event bus is a singleton — a second window must not
  double-handle events).
- **The reported bug is fixed at the root:** upstream parents the drag proxy to
  `<body>`, where the engine's window-scoped styles cannot reach it — a dragged card was
  invisible and the pile looked like it vanished. The proxy now lives inside the game
  window (`dragHost`), is paint-checked mid-drag by the test suite (104×143 px, one card,
  opacity 0.9), and is always swept up — valid drop, cancelled drop, or window closed
  mid-drag.
- Null-safety guards for an interrupted drag (`renderCancelDrag`, `renderFinishDrop`,
  `_rebuildPileDOM`), and the drag controllers tolerate events whose target is not an
  element. No more `Cannot read properties of null` noise.
- The engine's stylesheet and card library are **scoped** to `#solitaireApp` so `.card`,
  `.slot`, `.header` and `.icon` cannot leak into (or inherit from) the desktop chrome, and
  the board scales to fit any OS window — maximised, snapped, or resized mid-game.

**Also in this round**

- **Fixed a production-only crash in the About panel.** The Ok button was
  `onClick={!counting && action}` — while the boot countdown ran that prop was literally
  `false`, and React's production build throws `TypeError: t.apply is not a function` on
  click: the dialog ignored the click and an uncaught error escaped. It is now
  `counting ? undefined : action`. Same class of bug fixed in `utils/general.jsx`.
- The About panel's contact line points at the project's own address again.
- The Xbox/store description for Solitaire now says what the app is: Klondike with real
  rules and real shuffles (it previously listed Spider, FreeCell, Pyramid and TriPeaks).

**Validation:** `npm run build` clean · `npm run smoke` 0 errors · 25/25 driver checks
(About on boot / context menu / after Restart, Github tiles opening real tabs, deal
integrity 1..7 + stock 24 + 52 cards, mid-drag proxy painted inside the window, a real drag
landing, window close + re-open clean) · 26/26 dedicated Solitaire checks · full setup →
desktop run inside a sandboxed no-storage frame with 0 console errors.

## Round 19 — boots anywhere, ships nothing of anyone else's

**Validation: production build clean, `npm run smoke` 0 errors, 14/14 driver checks, 0 console
errors — and a full setup → desktop run inside a `sandbox="allow-scripts"` frame (no storage
at all) with 0 console errors.**

### The OS now survives a context with no storage
A sandboxed iframe (like the preview panes people embed projects in), a private window, or a
profile with site data blocked hands the page a `window` where `localStorage`,
`sessionStorage`, `document.cookie` and `navigator.serviceWorker` **throw on access**, and
`indexedDB.open()` throws a `SecurityError`. Reading any of those four before first paint
killed the bundle before React mounted — the embed only ever showed white.

- `index.html` gained a small **storage safety net** that runs before any app code: each of
  the four APIs is probed; if it is missing or throwing, an in-memory stand-in is installed
  (live `length`, no-op cookie, a service worker stub) and `window.__wosStorageDegraded` is
  set so the shell knows persistence is off for the session. In a normal browser the probe
  passes and **nothing changes**.
- `src/utils/idb.js` now funnels every public method through one `run()` wrapper: the first
  denial flips the store into a silent no-op — writes resolve with their input, reads resolve
  empty, exactly like a brand-new machine — instead of rejecting once per call and stranding
  the setup wizard. `idb.available()` reports the state.
- `mirrorFlat()` no longer logs one error per file when there is no mirror to write.
- Proven by driving the complete Windows Setup flow inside a sandboxed frame: 5 clicks to the
  lock screen, unlocked with the chosen password, desktop rendered, About dialog opens,
  **0 console errors**.

### The default build no longer phones the previous author's analytics
`public/react-pwa.js` still injected a **Google Analytics tag (property `G-QNW5K71MZ0`)** on
every boot — the upstream project's property, plus a commented-out redirect to a
`win11.blueedge.me` host. Both are gone. The README claim "no analytics, no remote scripts"
is now literally true rather than aspirational.

### Dead code that carried someone else's credentials is gone
- `src/components/login.js` was unreachable (imported nowhere) yet held a live **Firebase
  config for the upstream author's project** (`auth.win11react.com`). Deleted.
- The News widget's second data source — `github.win11react.com/api-cache/news.json`, the
  upstream author's server — is gone; Wikinews and the bundled edition cover it, and the fork
  now talks to nobody else's infrastructure (see README ▸ *Privacy, honestly*).
- `.firebaserc` (pointing at the same project), the upstream CLA signer list in
  `signatures/`, and the author's `_dbg16.js` / `_dbg17.js` Playwright scratch files: removed.
- The `firebase` dependency followed the dead code out — `npm install` drops **82 packages**.
  The shipped bundle is unchanged (the code was never imported), so this is hygiene, not weight.

### Docs and metadata now describe *this* repository
`README.md`, `CONTRIBUTING.md`, `SECURITY.md` and `CODE_OF_CONDUCT.md` were rewritten for
`bittuhere/win11WebOS` — real setup steps (Node 18+, port 5173, `build/`, `npm run smoke`),
the repo's own layout and conventions, a private-advisory security process, and a Contributor
Covenant 2.1 with the fork's contact. `package.json`, `app.json`, `.gitignore`,
`public/404.html`, `public/sitemap.xml`, `public/manifest.json`, `src-tauri/*` and the English
locale strings were aligned in the same sweep (see Round 17/18 for the code fixes).

## Round 18 — the four reported bugs

**Validation: production build + headless-Chromium driver, 14/14 checks passed, 0 console
errors, 0 uncaught exceptions.** (`npm run smoke` + `npm run build` clean too.)

### Solitaire — the dragged card no longer vanishes
The drag proxy (`.clone-pile`) was built out of cards that only ever had *size* inside
`#solitaireApp`, while the proxy was appended to `<body>`: every clone was a zero-sized,
paint-less `div`, so the moment you grabbed a card the pile went blank and the card "hid"
until the drop resolved.

- `renderer.js` now parents the proxy to the game window when it can (body as fallback so the
  engine still works standalone), and copies the dragged cards' computed look — size, spacing,
  face/back artwork — onto the clones. The fanned stack now travels with the cursor.
- `engine.css` carries the proxy geometry as unscoped `.clone-pile` rules, and the proxy is
  removed from wherever it lives (`.remove()` instead of `body.removeChild`).
- `_dragUpdate` measures the proxy's own offset once, so fixed-position tracking stays exact
  even while a window-open animation makes the window a containing block.
- Safety net: if a drag ever ends without a resolved drop, the engine is asked to return the
  pile after 2 s, and closing the game mid-drag sweeps any leftover proxies. Cards can no
  longer be left invisible.

### About panel — it now appears on **every** boot
The dialog kept a one-shot local flag (`bootOpen`) set at mount. The component never remounts
inside a session, so "shown once per page load" quietly became "shown once, never again after a
Restart" — and the reducer-side `abOpen` was fighting it.

- Visibility is now driven by a single reducer flag. `App.jsx` dispatches
  `DESKABOUT { open, boot }` whenever a boot completes — cold start *and* the in-OS Restart —
  and Ok closes it until the next boot (`abBoot` keeps the 5-second delay for boot appearances
  only, so a right-click ▸ About is dismissible straight away).

### Github (and every external link) — a real browser tab
Two bugs, one cause. A boot-time patch replaced `window.open` globally, rerouting every new tab
into the internal Edge app — which is why Github opened in the OS window. The Start menu tile
also carried a URL payload that the menu's "close on open" test never matched, so the menu just
sat there while the link went nowhere visible.

- The global `window.open` hijack is **gone**. `src/utils/os/links.js` is the one way out:
  `openExternal()` opens a genuine new tab, severs `opener`, and falls back to a synthetic
  anchor click when a popup is refused (no more double tabs — `noopener` used to make a
  successful open look like a blocked one).
- `EXTERNALTAB` is performed by a **Redux middleware** instead of the reducer. It was a side
  effect inside a reducer: when the popup was refused, the anchor's click reached the shell's
  global click handler and Redux threw *error #9 — dispatch while dispatching*. Side effects
  stay out of reducers, the popup keeps its user activation, and `mailto:`/`tel:` ride the same
  path.
- The Start menu now closes for `EXTERNALTAB`, most importantly for the Github tile, and the
  desktop icon double-click routes through the same helper.

### Repo alignment for `bittuhere/win11WebOS`
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and `CODE_OF_CONDUCT.md` rewritten for this
  repository: correct links, real setup/test instructions, security policy with a private
  reporting channel and response targets, Contributor Covenant 2.1, and no upstream Discord or
  `blueedgetechno` references left.
- `package.json` / `app.json`: name, description, repo, homepage, issues and author point at
  `bittuhere/win11WebOS`; the dead `e2e` / `test:ext` scripts and a placeholder dependency are
  gone; `scripts/smoke.cjs` + its harness now ship so `npm run smoke` works in a fresh clone.
- Seven unused dependencies removed (including the Sentry SDK — the OS claims no telemetry, and
  none of it was ever imported). Bundle output is byte-identical without them.

## Round 17 — "if you fix all of these, I can believe you made the ultimate Win11"

**Validation: the automated UI driver runs 114 checks across three boots (OOBE → desktop →
apps → Store → simulated reload → persistence) — 114/114 passed, 0 failed, 0 runtime errors.**

---

### Identity & licensing
- **Apache-2.0 everywhere.** `scripts/aplicense.py` stamped 126 source files with Apache
  headers; repo-level `LICENSE` + `NOTICE` written; README and `package.json` updated from
  CC0 to Apache-2.0.
- **blueedge identity fully retired.** Title, OG/Twitter cards, console banner, issues link and
  the desktop GitHub shortcut now point at `github.com/bittuhere/win11WebOS`; Start-menu
  profile uses the Windows logo asset (`public/img/logo.png`).
- `google-site-verification` is a `REPLACE_WITH_YOUR_TOKEN` placeholder — paste your token
  after verifying the domain.

### Setup (OOBE) & control
- **`CONTROL.env` pipeline** (read at build time): `ES: OFF` (default) removes the extension
  screen from OOBE entirely; `ES: ON` brings it back. `EMAIL:` feeds every formsubmit surface;
  a build without an email shows the exact contract error.
- The About-this-PC screen now carries the project's own text (open-source, Apache-2.0,
  contact, Microsoft non-affiliation, trademark note).

### The desktop itself
- **Double-click opens desktop icons** (single click selects, like the real thing).
- **Drag-select rubber band** highlights icons it touches.
- Right-click menus work from **every** surface: desktop (View/Sort/New/Display/Personalize…),
  taskbar icons (**Open new window / Close window / Taskbar settings**), app tiles
  (**Open file location / Unpin from start / Properties** — all functional now).
- **New ▸ Folder / Text Document** creates real items in the Desktop folder.
- **Start search finds apps only**, focuses the caret the moment it opens, Documents tab gone.
- **Ctrl+Alt+R opens Run** (no Windows key needed; AltGr-proof).
- **Shutdown is a real sequence**: logo fade → black → "You have shut down your PC" power
  screen with a glowing power-on button. Restart unchanged.
- **Mobile**: portrait phones get the rotate-your-device animation with an honest
  "continue in portrait anyway" escape (44 px tap target).

### File system & Explorer
- Closed Explorer **resets its state** — reopening lands fresh at Home.
- **Deleted files stay deleted** (fixed a real state bug: the tree mutates in place, so list
  memos now follow the mutation epoch).
- Context menu: **Edit in Paint** for images; **html files open live in Edge** (blob URL,
  scripts intact); photos from device imports open in Photos — never "cannot show".
- Files: text → Notepad with content, images → Photos/Paint, html → Edge.

### Apps rebuilt or fixed
- **BitBot replaces Cortana** — the *real* engine from `bittuhere/ai`, vendored to
  `public/bitbot/` (82-lakh-parameter neural net + BitMath + BitWords, 11 MB with weights).
  Deterministic pipeline: name memory → BODMAS expressions with steps → symbolic equations
  verified by substitution → 33 word-problem solvers → neural net over 347 topics with
  typo tolerance and honest "I don't know". The window keeps Cortana's shell and styles;
  the dark-mode textbox contrast bug is fixed.
- **Microsoft Edge**: Google (frameable `igu=1` endpoint) is the default page *and* the home
  button target; extensions UI, Browser Helper, download-page button and Copilot CTA are gone;
  pages that refuse framing say so honestly and offer retry/reader/home.
- **News** pulls **live stories from Wikinews' open API** (en.wikinews.org, CORS-open, no
  key) into a "Live · Wikinews" tab with one-click "Read in Edge"; when offline it degrades
  to the bundled edition and *says so* — never a fake live chip.
- **Terminal** grew `calc` (the real BitMath engine: `calc 2+2*3`, `calc solve 2x+5=17`,
  steps + verification) and `history` (session command list). 36 commands now.
- **Movies & TV** plays your Videos folder with native controls (seek/volume/fullscreen).
- **Feedback Hub** sends via **formsubmit.co** with **attachments ≤ 5 MB (any file)** and an
  integrated thank-you screen; a copy always stays on the PC. Builder address baked at build
  time; missing email shows the exact contract error string.
- **Help** is a real FAQ (7 honest answers) + "Email the builder" form → win11webos@gmail.com.
- **Mail** says exactly what it is: a placeholder toast on open, honest copy inside.
- **Notepad**: closing a dirty tab asks to save; closing the window with dirty tabs asks too.
- **Maps** shows the **live OpenStreetMap embed** — search a city, fly there, marker set,
  attribution on-map.
- **Calendar / Narrator dark-mode invisible text — root cause fixed globally**: form-surface
  CSS variables were scoped to the Store, so every other app's inputs fell back to white in
  dark mode. Fixed once, for every app.
- **Settings**: the detail pane no longer floats over the title bar; responsive on narrow panes.
- **Widgets pane refetches** on-this-day + news the moment it opens.
- **Solitaire** verified end-to-end (deal 1..7, stock 24, draw, recycle, 52 conserved).

### Store
- **The catalog is user canon** (bittuhere's own catalog, 186 entries). Gutenberg/Open Library
  mass entries removed (kept: Wikibooks, Wikisource, Wikiquote, Bible Gateway…); books appear
  **only** in Books & Reading — never in Apps/Search/Home/featured.
- The user's own `bittuhere.github.io/2048` stays; **external** 2048 and every other
  known-blocked host are driver-enforced against.
- **Icon sweep**: all 184 icon URLs probed; 7 dead ones replaced (verified 200s or honest
  letter tiles). Store Home has its own search (typo-tolerant, AI-ranked); gaming tab has no
  chips row; the suggester popup is opaque in both themes.

### Driver (the proof)
`node --experimental-vm-modules scripts/drive.cjs` — 114 checks, three boots, covering OOBE,
every core app, Store browsing, cross-boot persistence and this round's new features.
**114/114 · 0 failed · 0 runtime errors.**

### Social round
- The **About dialog** (boot + desktop right-click ▸ About) now carries the project's exact
  statement — Win11 WebOS, Apache-2.0, win11webos@gmail.com, Microsoft non-affiliation,
  not Windows 365, trademark note — replacing the last win11React-era text.
- **Fixed: right-clicking a taskbar icon crashed the desktop** (a missing menu metadata
  entry). The menu now renders Open new window / Close window / Taskbar settings.
- **Fixed: switching Edge tabs reloaded the page.** Every web tab keeps its own live
  iframe layer now — switching only shows/hides it, exactly like a real browser.
- **Weather, polished**: a sky-gradient hero that changes with the actual conditions
  (clear / cloud / rain / snow / fog, plus a night sky), hourly rain bars, daily
  min→max temperature range bars, card layout in both themes.
- **Clock**: a real analog dial (hour/minute/second hands + tick marks) lives inside the
  focus ring, panes animate on tab switches.
- **README** rewritten, user-facing; **OneNote served from GitHub Pages** (repo weight down);
  the **Store catalog is the maintainer's file, byte-exact — the code never edits it.**

### Rework round
- **Repo slimmed from ~96 MB to ~55 MB**: squashed the bloated git history into one clean
  release commit (.git 49 → 24 MB), deleted the stray bitbot.zip, unused gallery/screenshot
  images and the orphaned store artwork (public/img/store).
- **Desktop junk removed** — the legacy "Blue" icon is gone; the desktop now shows only real
  apps. The dead Spotify launcher in the quick pane and terminal map are cleaned too.
- **Get Started rebuilt as a real tour**: 8 cards, every button performs its action
  (Settings, live theme flip, Start, Store, Snipping Tool, Terminal, Edge, Help), ticks
  itself off with an animation, progress persists on this PC. Zero placeholders.

### UI rebuild round
- **Fixed: right-clicking inside any app window opened the desktop menu** (the windows live
  inside the desktop container, so the event bubbled up). The desktop menu now belongs to
  bare wallpaper only — app windows keep their own context menus, and text fields keep the
  browser's copy/paste menu.
- **Fixed: Word's tile icon** was pointing at a name that didn't exist on disk (winWord.png
  shipped as `word`); `img/icon/word.png` now ships.
- **Fixed: Paint's Save As now opens the real Save dialog** — the Virtual Storage browser
  (quick locations, folders, existing files) instead of a bare text prompt.
- **Narrator rebuilt**: voice picker (your system's real voices), rate + pitch sliders,
  hero header with a live "speaking" indicator, honest fallback when the browser has no
  speech engine.
- **Fluent refresh across every standard app** (Calendar, Sticky Notes, To Do, Mail, News,
  Camera, Movies, OneDrive, Xbox, Your Phone, Terminal, Feedback, Help): consistent card
  surfaces with hover lift, animated headers, segmented chips with the Win11 selected-pill,
  staggered card entry animations, dark-mode-correct surfaces everywhere.

### Store + Edge round
- **Store home has its search bar** — always, even in the first second while the
  catalog loads (the skeleton screen used to swallow it).
- **The search is a real little AI now**: tokenizes your words, understands intent
  ("i want to draw" → Excalidraw/Paint, "car game" → racing games), forgives typos
  including mid-word ones ("jspint" → Paint, "photp" → Photopea, "solitare" →
  Solitaire, "gogle" → Google), matches app ids and site addresses, and grades the
  whole catalog field-by-field. Browse tabs use it too, and typing a web address
  offers a one-click "Open in Edge".
- **Gaming** shows every game in the catalog on one page — a banner states it, and
  the section selector stays gone.
- **Suggestion dropdowns are opaque** in both themes (the acrylic panels went
  97% solid so background text can never bleed through).
- **Store-installed apps no longer lie**: the "may be blocking / Open in Edge"
  banner had a stale-timer bug and appeared even over perfectly loaded apps; now
  a spinner covers the load, and the banner only appears if the frame truly
  never loaded after 12 seconds.
- **Edge is on Google**: opening the browser, the + new-tab button, and the home
  button all load the real google.com/webhp?igu=1 page in the frame (no internal
  newtab page), typed searches go to encoded google.com/search URLs, and the
  address-bar suggestions try Google first.

### Desktop, menus & widgets round
- **Desktop right-click menu**: Win11-style open animation (scale + fade from the
  click origin), solid acrylic panel, submenus that slide in; every item wired —
  View sizes, Sort by, Refresh, New ▸ Folder / Text Document (items now really
  appear ON the desktop and open), Display settings, Personalize, Next
  background, Open in Terminal, About.
- **Desktop icon right-click menu**: every action works (Open, file location,
  unpin, properties, delete) — the icons now carry their identity for the menu.
- **Taskbar icon right-click** gained Pin to desktop + Uninstall (built-in apps
  answer honestly); **Start menu tiles** open the same app menu on right-click.
- **Rubber-band multi-select**: drag on the wallpaper, Delete key removes the
  selection, Escape clears — desktop restores cleanly.
- **Search (Start)**: the caret is IN the box the moment it opens, results are
  apps only (no files anywhere), honest empty state.
- **Widgets pane**: live weather from open-meteo (glyphs, no dead metaweather
  images), live Wikinews headlines that open in OUR Edge, ticking clock + date,
  refresh button, market card honestly labelled demo, On-this-day opens in Edge.
- **GitHub** opens a real browser tab at github.com/bittuhere/win11WebOS (the one
  new-tab exception), from the desktop icon double-click and the Start profile.
- **Social/SEO**: OG + Twitter cards point at a real preview.jpg, canonical +
  keywords ("Windows 11 WebOS", "Win11 WebOS", "Win11 in react"), theme-color.

### Context-menu motion + loader + catalog placement
- **Fixed: the context menu could stay on screen after dismissing** — last round's
  entrance animation used a fill-mode that pinned opacity over the hidden state.
  The container is now hidden by plain CSS in its base state and animates only
  while open, so it hides instantly, every time.
- **The menu motion is the real Win11 Show-Popup spec**: scales 95% → 100% anchored
  at the cursor (growing down and outward), fades in on the FastInSlowOut curve
  (200ms), the drop shadow blooms as it lifts "off" the desktop, acrylic backdrop
  (blur 40px, saturated) lets the wallpaper bleed through, rows light up with a
  fast 80ms ease, submenus inherit the same scale-and-fade with a slight outward
  slide, and dismissal is a quick 90ms fade + shrink.
- **Store-app loading**: the plain spinner is replaced by the blocks-scale loader
  (four blocks pulsing in sequence, the magecdn SVG, colored by the accent) while
  a downloaded app opens.
- **Catalog placement** (your order): Arcade Hub and The Password Game were typed
  as apps — they're games now, so the Gaming container shows all 48. Only those
  two type fields changed; nothing else in your file was touched.

### Solitaire Collection — fixed
The game logic was always fine (the engine dealt, drew and conserved all 52
cards) but every card was an **invisible div**: the vendored engine CSS carried
only the red-back rule — no card size, no blue back, and none of the 52
face rules. Fixed by completing the card visual layer in engine.css:
- cards sized to their slots (4.0em × 5.5em) with rounded corners and shadow,
- face-down cards show the blue deck pattern (red deck still available),
- all 52 face rules mapped to the vendored SVG art (A/J/Q/K + r02–r10 per suit).
The build now ships all 54 card artworks, and the driver verifies the rules,
the assets and a live dealt game (faced + back counts).
