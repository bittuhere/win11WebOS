# v1.02 validation results — Search layout and feed-cache correction

Validated locally on **5 October 2026**, on Linux with Node **20.20.2** and **22.23.3**, Python Playwright **1.63.0** and Chromium. No GitHub push, hosted GitHub release or Cloudflare deployment was performed.

## Search failure reproduced and corrected

Before the fix, clicking taskbar Search changed `.desktop.scrollTop` from **0 to 401 px** and moved the menu's top from **20 to −381 px** in a 1280×800 Chromium viewport. Bare input autofocus during the slide scrolled an `overflow:hidden` ancestor. This was not a service-worker/feed-cache problem.

The corrected focus uses `preventScroll`, reacts to direct Start/Search mode changes, and resets only the shared panel's own scroll. The desktop uses `overflow:clip` to remain a non-scrolling viewport. Search has a bounded internal results scroller and fitting widths/heights on smaller screens. The attached `index.html` is preserved **byte-for-byte**, including the Google verification meta tag; the built page retains that tag.

`tests/search_layout_feed.py` passed desktop (1280×800), short desktop (1024×600), narrow desktop (480×800), and coarse-pointer landscape (844×390) / portrait (390×844) Chromium cases. Tests sample scroll offsets during motion, repeatedly toggle Search/Start, type long queries, scroll results, switch modes without closing, open Notepad with Enter, and enable reduced motion. Desktop/root offsets remain **zero** and Start stays above the taskbar. No page errors were observed.

The same test verified changing GitHub feed responses, distinct cache-busted `no-store` requests, absence of feed entries across CacheStorage, and deployed `no-store` headers. Fake feed entries were deliberately planted in the isolated test cache: neither same-origin nor GitHub discovery consumed them, including offline. Offline checks show an error, not cached "up to date" status. Fixtures do not publish a fake release.

After the fix, the full 169-check driver, all four focused browser suites and the staged failure/retry/successful update/restart test were rerun successfully. No ZIPs were created. Browser/provider behavior outside the tested scope remains subject to the limits below.

## Results

| Check | Observed result |
|---|---|
| Clean source checkout (no archive) | Source copied to a temporary test directory; Node 22 `npm ci` and `npm run verify` passed; its complete offline manifest matched the working build. Temporary copy removed. |
| `npm run verify` | Passed on Node 20 and Node 22: source preflight, Vite 7.3.6 build, generated worker/inventory, deployment validation, release tests, smoke boot and documentation checks |
| Final offline inventory | **701 resources**, **34,713,001 bytes** (~33.1 MiB), content ID `d6469660bca32455a116`; includes BitBot weights, fonts, images, lazy chunks and Office/game resources |
| `npm run test:release` | **8 test groups passed**, including identity/hash coverage, discovery exclusions, CSP-safe loaders, Firebase removal, public docs, split-chunk contracts, SVG and packaging/scheduling guards |
| `npm run smoke` | OOBE rendered; **0 runtime errors** |
| `npm run check:docs` | **23 current documents**, **83 local links** checked; stale daily-schedule instructions guarded against |
| Full `npm run test:driver` | **169 passed, 0 failed, 0 runtime errors**; this is the completed rerun, not merely targeted tests after an earlier failed run |
| `tests/release_browser.py` | Passed complete cache coverage, no pre-login feed/external requests, checks after each boot's login, in-OS restart and hard reload, no duplicate check on lock/unlock, current-version notes/CTA, small/dark layout, offline reload, BitBot under script CSP, **all 701 entries fetched offline**, and storage-denied online-only escape |
| `tests/production_ready.py` | Passed favicon-matched inline SVG, four panes/colour, paused error animation, reduced-motion fallback, Pages-style 308 HTML redirects, real 404, headers, complete cache and offline navigation through root/index, public docs and Word/Excel/PowerPoint clean URLs |
| `tests/update_roundtrip.py` | Passed isolated older fixture → v1.02 staged install, forced resource failure, old/unrelated cache retention, personal localStorage sentinel preservation, no premature success history, retry, About/history agreement and offline reboot; **0 page errors** |
| Node preview HTTP probes | SVG 200, missing asset 404, byte range 206 and invalid range 416 |
| Dependency audit | `npm audit --omit=dev`: **0** reported vulnerabilities; full audit: **5 high** development-tool advisories, **0 critical** |
| Git hygiene | `git diff --check` clean; generated output/secrets/archive paths ignored; new Python source remains visible to Git |

The shell/update follow-up reran the complete 169-check driver, each-boot browser suite, production-readiness suite and successful/failed staged update roundtrip. Remote discovery is intercepted with deterministic GitHub fixtures in automated tests. Final public wording corrections were followed by another build/source-feed-size synchronization, contract tests and smoke run.

The local HTTP preview retains script/content CSP, but omits `upgrade-insecure-requests` for loopback: otherwise followed redirects attempt TLS against a plain HTTP listener. An explicit workspace-only option relaxes frame embedding. Neither exception changes the deployed `public/_headers` policy.

## Shell/update follow-up acceptance

`tests/shell_update_followup.py` passed real taskbar clicks for Start and Quick Settings; sampled intermediate transforms during opening and closing; reversal mid-transition; hidden keyboard inertness; instant reduced motion; and opaque light/dark Windows Update/Solitaire title bars. The new movement is a full upward slide, not a spring scale/pop.

The same test passed checking/disabled controls, HTTP 404/500, malformed JSON, invalid schema/version/notes paths, network failure, request timeout, missing future notes + retry, quality and feature updates, current/older feeds (no downgrade), offline errors and stale notes/progress cleanup. A real 650×420 update window had no horizontal overflow. Advertising a fixture newer than the deployed worker produced an explicit refusal, with no pending/success history. **Zero page errors.**

The existing staged-update test separately passed failure/retry and a successful older fixture → v1.02 activation/restart, About/history and offline reboot through the GitHub-discovery route. No fake future version was published. The supplied live GitHub feed advertised **1.01 when inspected**; repository changes have not been pushed.

## Earlier failures addressed

- Static driver checks originally assumed all code/styles lived in one chunk. They now inspect all emitted chunks. The obsolete `_redirects` expectation was removed with the catch-all rewrite. The **full driver was rerun successfully**.
- Browser acceptance initially exposed the localhost HTTP-to-HTTPS redirect issue; corrected and retested as above.
- The previous daily update schedule was inconsistent with the requested each-boot behavior. The implementation, UI, docs and browser assertions now use each-boot-after-login semantics.

## Limits and remaining warnings

- The full audit's five high-severity findings are in the Tailwind 3 / braces / globbing / watcher development chain. A forced Tailwind 4 migration has not been attempted. Do not interpret a clean runtime audit as zero build-tool risk.
- A shared vendor chunk exceeds Vite's 500 kB advisory threshold. Inherited Sass deprecation warnings remain. No measured universal FPS claim is made.
- The older standalone browser suites for every app/device were not all rerun in this follow-up. They remain separate CI checks; a broad jsdom pass does not certify every device or remote provider.
- The update fixture uses the **new updater** in an older-version build. It is not the exact historical public Workbox client. The retained-data sentinel test is not exhaustive IndexedDB migration certification.
- Real Cloudflare account rules, Search Console ownership/indexing, Safari/Firefox, physical mobile devices, external APIs, arbitrary websites, long-lived multi-version tabs and browser cache eviction are not certified by these tests.
- Initial offline installation requires connectivity and browser storage. Cached files can be evicted; export important user files. Local sign-in is not storage encryption.

## Reproduce

See [TESTING.md](TESTING.md). Screenshots are generated under ignored `artifacts/`; they are not build inputs. The handoff includes an installer preview image separately. Checks and documentation describe a tested source candidate, not a deployment already performed on your account.
