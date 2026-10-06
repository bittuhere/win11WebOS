# Win11 WebOS by Bittu (bittuhere)

**Windows 11 WebOS · v1.02 / Build 2 · Apache-2.0**

An independent Windows 11-style desktop in your browser, built with React 18, Redux, SCSS and Vite 7. Local apps, files and BitBot resources work offline after the complete first download. Live services and external websites need internet.

[Live desktop](https://win11webos.pages.dev/) · [About](https://win11webos.pages.dev/about/) · [Public docs](https://win11webos.pages.dev/docs/) · [Documentation index](docs/README.md) · [Release notes](RELEASE-NOTES.md)

> Not Microsoft Windows, a virtual machine, Windows 365 or a Microsoft-affiliated product. Windows and other demonstrated brands belong to their respective owners. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Build and deploy

Use **Node 22.12+** (recommended; `.nvmrc` selects 22) and npm 9+. Node 20.19+ in the 20.x line is also supported. No global Vite, Python or Rust installation is required to build the web app.

```sh
git clone https://github.com/bittuhere/win11webos.git
cd win11webos
npm ci
npm run build
```

**Deploy the contents of `build/` to Cloudflare Pages.** For Git-integrated Pages, use:

| Setting | Value |
|---|---|
| Framework preset | None, or Vite with the output overridden below |
| Root directory | Repository root |
| Build command | `npm run build` |
| Build output directory | `build` — not `dist` |
| Node version | 22.12+ |
| Runtime environment variables | None required for the desktop |

`wrangler.jsonc` also declares the Pages output directory. Do not upload source, `node_modules/` or the repository ZIP as site contents. Do not run only `vite build`: the npm command also produces and validates the offline manifest and worker. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for Git push, direct upload, cache settings and rollback.

## Local development and production preview

```sh
npm start             # HMR development server, port 5173; no offline install
npm run build
npm run preview       # built site, port 4180; applies _headers and clean HTML redirects
npm run verify        # build + release/inventory checks + smoke + docs checks
```

Open the preview in a normal browser tab. Service workers require HTTPS or localhost. The development server is not a production server; a dev-only relay is not deployed to Pages. Full browser tests need Python/Playwright separately; see [TESTING.md](docs/TESTING.md).

## What is included?

- Start menu, taskbar, draggable/resizable windows, snap layouts and local account setup/login.
- File Explorer and a browser-backed virtual filesystem; Notepad, Paint, Photos, Camera, Terminal and other local tools.
- Bundled Office tools and games; a Store catalog that can also launch external online apps.
- BitBot's local neural weights and symbolic maths resources, loaded without eval or Firebase.
- A complete verified offline installer, visible file-count percentage, retry and explicit online-only fallback.
- Scheduled update discovery after login, staged installation, release notes and confirmed update history.
- Responsive update panels, soft Start/tray motion, reduced-motion support and an animated four-pane SVG matching the favicon.

The exact cache list and byte count are generated in `build/offline-manifest.json`, not maintained by hand. Expect roughly 33 MiB uncompressed; a staged update needs room for the old and new build. Browser storage can be cleared/evicted. Export important files.

## Offline does not mean every website is offline

The core desktop has no required external web fonts or runtime CDN scripts. Weather, maps, news, search, remote Store apps, optional email delivery and arbitrary browsing still contact their providers. Read the [network audit](docs/NETWORK-AUDIT.md) and [CSV inventory](docs/NETWORK-INVENTORY.csv).

Local sign-in is a simulation using this browser's storage, not a cloud account, encryption or a security boundary against someone controlling the browser. Clearing site data can remove your files/profile.

## Updates and versioning

`release.json` defines the running OS identity. v1.02 maps to npm/Tauri **1.2.0**. Discovery reads [the GitHub main-branch feed](https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/updates/feed.json) with no-store requests. Publish it by committing `public/updates/feed.json`; notes live under `public/updates/notes/`. Installed notes stay local/offline; notes for a future release load from GitHub. GitHub must advertise a version actually deployed on Pages before installation can succeed. App checks run after login, once per boot, with pause/skip controls and a manual check.

A new version is fully downloaded and hash-verified before activation. Failed downloads retain the installed build. History is recorded only after the new build boots. Existing public v1.01 installations still run their legacy updater until migration completes; keep them online through their first v1.02 download.

The worker supports Cloudflare's same-origin clean-URL redirects while verifying content. Do not enable edge HTML/JS rewriting or analytics injection into precached files; transformed bytes invalidate the manifest.

## Repository map

| Path | Purpose |
|---|---|
| `src/` | React desktop, apps, Redux, local storage and update client |
| `public/` | Shipped local assets, favicon SVG, docs, feed, notes and security headers |
| `scripts/` | Build inventory, worker template, checks and local preview |
| `tests/` | Release contracts, browser acceptance and broader regression suites |
| `docs/` | Deployment, architecture, testing, security/network notes and historical records |
| `src-tauri/` | Optional desktop wrapper; not required by Cloudflare Pages |
| `build/` | Generated deployment output; ignored by Git |
| `artifacts/`, `deliverables/` | Optional local test/download output; ignored by Git, not app source |

Commit the source, public assets, lockfile, release metadata, docs and deployment configuration. Do not commit build output, credentials or download archives. `CONTROL.env` contains public build-time switches—not secrets. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation and release status

- [Deploy to Cloudflare / push to GitHub](docs/DEPLOYMENT.md)
- [Current v1.02 architecture and migration](docs/RELEASE-1.02.md)
- [Test commands and actual results](docs/TESTING.md)
- [Maintainer checklist](MAINTAINER-GUIDE.md)
- [App source map](APPS-MAP.md) · [Add apps](ADDING_APPS.md)
- [Search/AI discoverability](docs/DISCOVERABILITY.md)
- [Security policy](SECURITY.md) · [Current audit](AUDIT.md)

Deployment readiness is not a promise of universal bug-free behavior or search indexing. Consult the dated test/audit reports for what was actually checked; avoid badges that imply an unrun test suite passed.

### Shell motion and title-bar follow-up

Start and the combined Wi-Fi/sound/battery Quick Settings panel slide upward from behind the taskbar (440 ms opening, 230 ms closing), without scale/pop motion. Closing remains visible until the slide finishes; rapid toggles reverse smoothly, and reduced motion is instant. Standard title bars now have a solid light/dark background. See `tests/shell_update_followup.py` for real-click and updater error-state acceptance.
