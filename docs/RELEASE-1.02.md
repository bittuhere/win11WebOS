# v1.02 — implementation and deployment guide

## Release contract

This guide describes the v1.02 source candidate. Building source does not publish a GitHub release or deploy to your Cloudflare account. See [deployment](DEPLOYMENT.md). The public-facing release is **v1.02 / Build 2**; the equivalent npm/Tauri semver is **1.2.0**.

`release.json` is the runtime version source. About, Settings and Windows Update import its values through `src/utils/os/version.js`. A feed advertises a release; it does not change the running version. Tests check package/feed/metadata alignment.

## Architecture and changes

- GitHub main-branch raw feed is authoritative for discovery; installed notes remain local, while future notes resolve from that repository. Invalid JSON/schema, HTTP/network/timeouts and ahead-of-deployment releases produce recoverable errors.
- Standard window title bars now have an opaque light/dark fallback; explicit app backgrounds and intentionally floating chrome remain intact.

- Installer branding embeds `public/favicon.svg`, matching the existing raster favicon, with reduced-motion-aware animation and paused motion on errors.
- Same-origin in-scope clean-URL redirects are accepted, content hashes still verified, and redirected responses normalized for offline navigation. No catch-all SPA rewrite hides missing resources.
- Current documentation, Git hygiene, Pages config and build validation are aligned; historical records are explicitly labeled.

- React 18 + Redux desktop; local profile and virtual files use IndexedDB/localStorage. The lock screen and OOBE already used local authentication. Removed the unused Firebase `src/components/login.js` and `.firebaserc`.
- Replaced Workbox's incomplete precache and unconditional activation with a generated complete local-file inventory and a small service worker. `npm run build` runs preflight, Vite, `scripts/build-offline.cjs` and deployment validation.
- First production boot displays a percentage, spinner, verified file count and uncompressed payload size. Four workers download with per-file timeouts, retries and SHA-256 verification. Interrupted installs retain verified files for retry. Storage-denied browsers can explicitly continue online only.
- Includes every emitted local file, including all bundled photos, fonts, Office/game code, lazy app chunks, release notes and BitBot's weights. Exceptions are hosting directives, source maps, the worker/inventory themselves, and the **network-only update feed**. This does not archive external websites.
- Updates stage an entire new build before activation. No origin-wide cache deletion or service-worker unregistration. A previous complete build is retained for old hashed chunks; unrelated apps' caches and user storage are untouched. Pending installation becomes history only after the expected or newer compiled version boots.
- Each boot schedules one automatic feed check 15 seconds after successful sign-in. An in-OS restart and a page reload are new boots; lock/unlock is not. If hidden, offline or paused, the attempt waits for the next eligible visible/online/timer event. A failed attempt does not trigger background polling again that boot (its bounded request retries still apply); use Check now or restart. Recent saved check timestamps never suppress a new boot. Pause/skip controls remain available. Browser-managed worker script checks are separate from application feed checks.
- Startup windows, optional scripts, app restoration, About and deep links wait for successful login. The initial offline download and local account/theme reads necessarily happen earlier. Locking an existing session hides/inerts the desktop instead of discarding unsaved window state. Live widgets fetch when opened, not on boot.
- BitBot/Terminal use a deduplicated same-origin classic-script loader instead of `new Function`. CSP can keep `unsafe-eval` disabled. Added same-origin/blob object support and secure WebSocket connections; kept useful security protections rather than using a wildcard policy.
- Installed release notes have no install-the-same-version prompt. Idle/error screens no longer falsely claim to be current. Update content wraps and scrolls inside small windows; buttons have keyboard focus, dark/high-contrast treatment and reduced-motion support.
- Start/Quick Settings use a full upward, interruptible taskbar slide with no scaling (440 ms opening, 230 ms closing); no permanent `will-change` layer. Heavy app code and app CSS are parsed on demand. Fixed Redux mutation in the taskbar selector. The hidden widget clock stops updating.
- Vendored LAME MP3 export instead of a CDN script. Replaced three unavailable remote easter-egg images with small local illustrated badges; static fallback news/history art now uses a bundled placeholder. Live article images remain an online feature.
- Added real public `/about/`, `/docs/`, `/updates/` HTML pages, branded metadata, author/software structured data, clean sitemap and optional `llms.txt`. These pages need neither JavaScript nor login. See `DISCOVERABILITY.md`.
- Updated Vite to 7, its React plugin, Crowdin CLI and safe dependency versions; moved Sass to development dependencies. Node **20.19+ in the 20.x line or 22.12+** is required; `.nvmrc` selects Node 22.

## Build and deploy to Cloudflare Pages

```sh
npm ci
npm run build
npm run test:release
npm run smoke
```

Cloudflare settings:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output | `build` |
| Node | 22.12+ (or supported Node 20.19+) |
| Production origin | `https://win11webos.pages.dev` |

Commit the changed source and lockfile to your repository, then let Pages build it. Alternatively, upload the **contents** of the supplied Cloudflare deployment archive using your Pages deployment workflow. Do not put an extra `build/` folder above `index.html`. Do not deploy `src/`, `node_modules`, or just the hashed assets.

The deployed `sw.js`, `offline-manifest.json`, HTML, assets and feed must belong to the same build. A mixed deployment deliberately fails integrity verification rather than marking a partial install successful. Avoid content-transforming edge rules for precached files. Ensure custom cache rules do not override `no-store` for `/updates/feed.json`, `/sw.js` or `/offline-manifest.json`.

### First migration from the public v1.01

The already-installed v1.01 client still runs its old updater until it loads v1.02; this patch cannot retroactively change that JavaScript. Use its Check for updates / Install now flow after deploying v1.02. That legacy flow clears caches before reloading, so stay connected until the new initial download completes. The non-destructive staged updater applies once v1.02 is running. If the old client is stuck, close other tabs and unregister **only this site's worker** in developer tools; do not clear IndexedDB/localStorage, which contain personal files/settings.

### Verifying a real update

1. Check that the live feed reports `1.02` and its notes URL returns Markdown.
2. On an existing v1.01 installation, sign in, check manually, install and finish the first offline download.
3. After restart/sign-in, About, Settings and Windows Update must show `v1.02` / Build 2.
4. Disconnect, reload the same origin/profile, sign in and open BitBot/local apps.
5. The same release must no longer have an Install now button. For staged v1.02-and-later updates, history appears only after the new version boots.

Do **not** advertise a fake newer version in the public feed merely to see an update button. Use the isolated two-build test below; it restores release source files automatically.

## Tests

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install --with-deps chromium
# Terminal 1 — production preview, not Vite dev mode:
npm run preview
# Terminal 2:
python tests/release_browser.py
python tests/shell_update_followup.py
python tests/update_roundtrip.py
```

- `tests/release.test.cjs`: version alignment, every emitted file's inventory/hash, discovery exclusions, CSP loader/Firebase removal and crawlable docs.
- `tests/release_browser.py`: actual CacheStorage, pre-login request isolation, each-boot scheduling, relogin, installed notes, small/dark window renders, offline reload, BitBot under enforced CSP, every manifest file fetched offline, and storage-unavailable recovery.
- `tests/update_roundtrip.py`: builds an isolated v1.01 **using the new updater** and v1.02, injects a failed resource download, verifies old/unrelated caches and user data survive, retries, confirms About/history, then boots offline. This does not claim to emulate every historical Workbox deployment.
- The Node preview applies built headers and Cloudflare-style clean URLs. The local-only `WOS_ALLOW_PREVIEW_EMBED=1` option relaxes framing for a workspace iframe; normal preview and Cloudflare keep the framing policy.
- The legacy jsdom driver was adapted for split chunks, classic local scripts and post-login startup. Its many app-specific cases are broader than this release's focused acceptance tests; see the accompanying test report for actual results, not an assumption that every browser/app path passed.

## Remaining limits / follow-up plan

- No honest guarantee of “100% error free,” universal frame-rate gains, indexing, or offline durability. Cache storage can be evicted; sandbox/private policies vary. An already-registered worker with externally cleared partial CacheStorage may require reinstalling the site's worker. Export important files.
- The complete first install is approximately 33 MiB uncompressed. Transfer compression changes network byte totals. A full new staged cache temporarily needs room for both releases; storage failure leaves the installed build untouched.
- Only bundled local files are covered. Network APIs, third-party iframes, optional feedback delivery, remote Store apps and arbitrary user browsing remain online. Dynamic third-party subresources cannot have a fixed global asset count.
- The vendor bundle still exceeds Vite's 500 kB advisory threshold. Further work should split icon imports and large shared dependencies, move BitBot inference to a worker, and profile drag/resize/blur on representative low-end devices. No FPS claim is made from bundle-size changes alone.
- Local login is not encrypted storage or protection from someone controlling the browser. Do not store sensitive credentials in the simulated OS.
- `npm audit --omit=dev` was clean after dependency remediation. The full audit still reports five high-severity build-tool dependency advisories in the Tailwind 3 dependency chain; migrate Tailwind separately with visual regression coverage rather than force an incompatible major release here.
- Existing unrelated apps, all operating systems/browsers, long-lived multi-release tabs, accessibility with every assistive technology, and all remote services are not exhaustively certified.

## Future releases

Bump `release.json`, package/lock and desktop wrapper versions; publish matching feed, notes and public metadata. Build/test a complete artifact before changing the production feed. The manifest and worker content ID are generated from actual bytes, not a manually maintained asset list. Keep the previous deployment available for rollback, and treat deployment and indexing as separate workflows.
