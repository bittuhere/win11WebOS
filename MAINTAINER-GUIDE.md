# Maintainer guide — v1.02

[Documentation index](docs/README.md) · [Deployment](docs/DEPLOYMENT.md) · [Testing](docs/TESTING.md)

## One source of runtime version identity

`release.json` drives `OS` in `src/utils/os/version.js`, About, Settings and the updater. The human form is `v1.02`; npm/Tauri use `1.2.0`. A feed only advertises availability; it cannot change the installed code's identity.

For a release update the release JSON, package and lockfile, Tauri package versions, feed/history, matching notes, root/public structured metadata and current release docs. Keep these synchronized; `npm run verify` checks the release contract. Never edit generated build files to fix a version string.

## Publish checklist

1. Use Node 22.12+ and a clean `npm ci`.
2. Review `git status` and dependency changes. Build secrets do not belong in `CONTROL.env` or source.
3. Run `npm run verify`, focused browser tests and staged upgrade tests for updater changes. See the dated test report for what was actually executed.
4. Confirm `_headers`, favicon SVG, public docs, complete asset inventory, worker and network-only feed ship together. Keep transformation/injection rules off for hashed payloads.
5. Review [network dependencies](docs/NETWORK-AUDIT.md), third-party notices, and runtime/build-tool audit output separately.
6. Commit source/configuration/docs/lockfile, not `build/`, artifacts or download archives. Push normally to the configured production branch.
7. Pages uses `npm run build` and output `build`; verify the deployed headers, root, clean URLs and fresh-profile offline installation.
8. Publish a GitHub release/tag matching the deployed version. Do not publish a new feed pointing to files that are not yet deployed.
9. Test an existing profile's upgrade and a fresh profile offline. Preserve the previous deployment for rollback.
10. Complete Search Console/crawler actions separately; deploy success is not a ranking guarantee.

## First push and repository settings

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for exact push commands. Keep the About website set to `https://win11webos.pages.dev/`, use consistent Bittu/bittuhere naming, enable appropriate branch protection/CI checks and dependency/security notifications, and review PRs. Creating these account-level settings requires the owner's permissions; repository files do not configure them automatically.

## Update and recovery policy

- Automatic discovery runs once each boot after login. A restart/page reload checks again; a lock/unlock does not. Paused/offline/hidden boots defer their attempt. Pause and skip controls remain available. Manual checks remain available.
- A complete new cache is staged and hash-verified before activation; unrelated caches and user IndexedDB/localStorage are not cleared.
- The previous complete build is retained for old hashed chunks. Long-lived tabs older than that may need a reload; infinite historical compatibility is not promised.
- Failed downloads are retryable. History is confirmed after the new build boots, not when someone presses Install.
- Existing public v1.01 clients retain their old destructive updater until migration. Keep the network available during that first migration.
- Browser eviction/quota restrictions are outside app control. Diagnose worker/cache problems without deleting the user's file database. Export files before any deliberate factory reset.

## Branding, docs and builds

`public/favicon.svg` matches the existing raster favicon's four squares and blue color. Vite embeds this SVG in the initial installer via `__WOS_BRAND_SVG__`; the same file is the modern browser favicon. Keep PNG/ICO fallbacks and PWA icons intentionally aligned when changing the brand. Respect reduced motion and inspect error-state animation behavior.

Maintain [the docs index](docs/README.md), current guides, public HTML docs and release notes together. Historical release notes/audits are records, not current operating instructions. The doc checker excludes the archive and labeled historical release sections from current-version staleness checks.

## Security and dependency maintenance

Read [SECURITY.md](SECURITY.md) and [AUDIT.md](AUDIT.md). Track both `npm audit --omit=dev` and the full audit; development-tool findings still matter to contributors. Do not fix CSS-toolchain advisories with blind forced major upgrades. Test changes to Node/Vite/Sass/Tailwind against the full visual/build contract.

The local preview server is for QA and optional simple Node hosting; Cloudflare is the production host. Never expose the Vite development relay as a public production backend. The optional Tauri wrapper has separate Rust/platform requirements and needs its own packaging/security tests.

## Shell/update follow-up

The runtime feed now comes from the raw GitHub `main/public/updates/feed.json` path; the source copy is published through a Git push, not a local edit alone. Install payloads still come only from the same-origin service worker and must match the offered version. Invalid/unavailable feeds do not silently fall back to old metadata. Start and Quick Settings use a full slide; standard title bars have opaque theme-aware defaults. The focused browser error/motion checks are in `tests/shell_update_followup.py`.

Before publishing release metadata through GitHub, run `npm run release:feed`. It builds the artifact and copies the measured uncompressed payload size into `public/updates/feed.json`; review and commit that change. This command does not push or deploy. Keep the Pages deployment and advertised version aligned.
