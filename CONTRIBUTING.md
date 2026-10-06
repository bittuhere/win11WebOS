# Contributing to Win11 WebOS

Current development baseline: **v1.02, React 18, Vite 7, Node 22.12+ recommended**. Read [README](README.md), [the app map](APPS-MAP.md) and [deployment guide](docs/DEPLOYMENT.md). Contributions follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Setup

```sh
npm ci
npm start
```

Use the lockfile for reproducible installs. Use `npm install` only when intentionally changing dependencies, then commit both manifests. Development uses port 5173 and skips the service worker. Test offline behavior against a production build, not HMR.

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Vite development server |
| `npm run build` | Preflight → Vite → offline inventory/worker → deployment validation |
| `npm run preview` | Node-only static production preview on 4180, with headers and clean URLs |
| `npm run verify` | Build, release contracts, smoke, documentation validation |
| `npm run test:release` | Tests against an existing build |
| `npm run smoke` | jsdom boot smoke against an existing build |
| `npm run test:driver` | Broad jsdom regression driver |
| `npm run check:docs` | Current local documentation link/staleness checks |
| `npm run audit:network` | Regenerate source URL inventory (Python required) |
| `npm run ghbuild` | Alias for the complete npm build, not a different release mode |

[TESTING.md](docs/TESTING.md) documents real browser, failure/retry, clean-URL and reduced-motion tests. GitHub Actions runs the checked-in workflows; no test-count badge should assert a run that did not happen.

## Code conventions and changes

- Keep React components/functionality in `src/`; reducer updates must be immutable.
- Register built-ins in `src/utils/apps.js` and the lazy `WINDOW_APPS` registry. Give lazy windows their own Suspense/error boundary, not a full-desktop loading screen.
- Use the existing virtual storage, file association, UI dialog and shared-control utilities instead of bypassing them.
- Any new local font/script/image must be bundled or put in `public/`, with attribution in `NOTICE` where needed. The emitted inventory picks it up automatically. Never hand-edit generated `sw.js` or maintain a competing cache list.
- New online features must declare their providers and fallback behavior in the network audit. Do not claim a remote app is offline because its icon is cached.
- Load trusted local classic scripts through `src/utils/os/scripts.js`, not eval/Function. Review CSP changes narrowly.
- Add icons/branding through `public/favicon.svg` where appropriate. The installer embeds that exact SVG at build time; no separate grid glyph or remote logo is needed. Motion must respect reduced motion and stop/pause on error states.
- Keep optional startup work behind successful local login. The initial offline download/local account read are intentional pre-login exceptions.
- Avoid layout/blur animation in hot paths; prefer transform/opacity, bounded work and cleanup of timers/listeners.
- For UI edits check light/dark, small resized windows, keyboard focus, reduced motion, offline and denied permissions/storage.

## Translations

Translations live under `public/locales/<language>/translate.json`; English is the shipped fallback. Only claim a language is complete if its file actually exists and was checked. Keep i18next configuration and the Settings language picker in sync when adding/removing translations. Strings added in v1.02 are not claimed to have complete translations.

## Public build switches

`CONTROL.env` is committed public configuration, never a secret store. `ES` controls the optional extension setup step; `EMAIL` is a visible destination. No Firebase account or API secret is required to build. Do not commit `.env`, tokens, browser storage snapshots or Playwright auth state.

## Before opening a PR

- Run `npm run verify` from a clean install and the relevant browser tests.
- For updater/offline changes also run `python tests/update_roundtrip.py`; it temporarily builds fixtures, so do not run it concurrently with another build.
- Report exact commands, outcomes and warnings. A screenshot alone is not an offline test.
- Check `git diff --check` and staged files. Generated `build/`, test `artifacts/` and optional `deliverables/` must not be committed.
- Update current docs for behavior changes; preserve old release notes as explicitly historical instead of silently changing their meaning.
- State any license, network, privacy, accessibility or persistence impact.

## Licence and trademarks

Original contributions use Apache-2.0. Keep third-party license/attribution notices intact. This independent browser simulation must not imply Microsoft endorsement or that it is a real Windows installation. Report security issues privately as described in [SECURITY.md](SECURITY.md).
