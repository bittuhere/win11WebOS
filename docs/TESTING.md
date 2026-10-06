# Testing v1.02

Use Node 22.12+ recommended. All commands run from repository root. Current outcomes are recorded in [TEST-RESULTS-1.02.md](TEST-RESULTS-1.02.md); commands below are instructions, not claims they have all passed on every platform.

## Required local build gate

```sh
npm ci
npm run verify
```

This builds the real artifact, validates release identity/inventory/hashes/deployment contents, renders the jsdom smoke boot, and checks current documentation. Build output is ignored by Git; input files and lockfile are committed.

## Browser acceptance (real service worker and CSP)

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install --with-deps chromium
npm run build
npm run preview
```

In another terminal:

```sh
python tests/release_browser.py
python tests/production_ready.py
python tests/shell_update_followup.py
python tests/search_layout_feed.py
```

The Node preview on 4180 applies built `_headers` and canonical HTML redirects like Pages, rather than bypassing script/content CSP. HTTP localhost preview omits only the transport upgrade directive; the deployment keeps it. The initial SVG logo, error/retry states, reduced motion, cache contents, offline fetches, version UI and login-gated scheduling are checked against a production build. For a different port set `WOS_TEST_URL=http://127.0.0.1:4183/` in the test environment. `PORT` controls the preview server's port.

## Staged update failure and retry

```sh
python tests/update_roundtrip.py
```

This temporarily builds an isolated older fixture with the new updater, then the current version. It restores source version/feed files in `finally` and restores the production build. Do not run it concurrently with another build or a test reading the same `build/` directory. It checks download failure, old/unrelated cache preservation, retry, About/history and offline reboot. It is not an exact emulation of every historical Workbox client.

## Broad regression suites

```sh
npm run test:driver
```

The jsdom driver covers many app flows but cannot validate real service workers/CSP/layout. Its contract inspections must read all emitted chunks, not assume the first `index.*.js` contains every app.

For older browser suites serve production output on port 4180 and run the relevant files:

```sh
python tests/verify.py
python tests/iframe_flow_test.py
python tests/file_types.py
python tests/rotate_gate_devices.py
python tests/mobile_layout.py
python tests/solitaire_aash.py
```

Some inherited suites expect the simpler Python static server and have their own fixed sleeps/URL assumptions. The release CI separates focused production acceptance from these broader workflows. Report any skipped or failed cases, not just the final success of a build.

## Manual release checks

- Fresh profile: first download finishes, SVG matches favicon, no pre-login desktop/update side effects.
- Interrupt download; verify a readable error, Retry, and an explicit online-only escape rather than fake completion.
- Offline: reload root/docs/Office clean URLs, open local apps/BitBot. Online services explain their limits.
- Reduced motion: static logo and menu; error state pauses decorative motion; keyboard focus remains visible.
- Small/resized windows, dark mode, high contrast and storage denial.
- Existing profile upgrade and personal file retention; all version screens agree after reboot.
- Live Pages: verify redirects, exact response bytes, headers, no challenge/transform injection, fresh feed and real 404s. Local preview cannot certify Cloudflare account settings.

## Security and network audits

```sh
npm audit --omit=dev
npm audit
npm run audit:network
```

Keep production and build-tool findings distinct. Literal URL counts are not downloaded-asset counts. Regenerate the CSV after changing provider references; inspect real runtime requests per workflow for dynamic services.

## Output hygiene

Screenshots/logs/temporary update fixtures go under ignored `artifacts/` or test output paths. Playwright auth state, browser profiles and personal IndexedDB exports must not be committed. `.gitignore` no longer hides all Python source, so new test files remain visible. Optional ZIP/patch download bundles in `deliverables/` are ignored and are not build inputs.

The follow-up browser test uses real Start/Quick Settings button clicks and sampled intermediate transforms to verify sliding, closing visibility, reversal and reduced motion. It checks title-bar colours in both themes, plus malformed JSON/schema, missing/failed/timeout GitHub feed, missing notes/retry, quality/feature/current/older releases and ahead-of-deployment installation. Remote responses are isolated test fixtures; no fake version is published. The staged update test separately verifies a successful full install/restart.

## Search focus / desktop coordinates and feed-cache isolation

`tests/search_layout_feed.py` reproduces Search → Start transitions with actual taskbar clicks, samples desktop scroll offsets during animation, and checks focus/rapid toggles/query scrolling/app launch in desktop, short/narrow desktop and coarse-pointer portrait/landscape Chromium viewports. It checks that the owner-supplied Google verification meta tag survives the production build.

Its feed test observes changing GitHub responses and distinct no-store request URLs, inspects every CacheStorage entry, and deliberately inserts fake feed entries into an isolated test cache. Neither the same-origin feed nor GitHub feed may be served from that cache, even offline; the UI must show an offline error instead. Test fixtures never modify or publish the real GitHub feed. These tests cover browser/application behavior, not a promise about upstream GitHub/CDN propagation time.
