# Update feed — v1.02 contract

These are static release files, not a backend or account service. The app checks once on each boot, 15 seconds after successful local login. Lock/unlock does not repeat the check. Offline, hidden or paused boots defer the attempt until eligible; failed attempts can be retried manually or on the next boot. Pause/skip and Check now remain available.

- `feed.json`: newest published release; **network-only**. Runtime source: https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/updates/feed.json. Commit this source file to update the raw GitHub endpoint.
- `notes/<version>.md`: release text and relative media; bundled notes are cached for offline reading.
- `index.html`: public release documentation, not an install-the-same-version prompt.

## Version source

`release.json` at repository root defines the running major/build/channel/date. `src/utils/os/version.js` formats it. v1.02 means major 1, build 2; npm/Tauri semver is 1.2.0. A higher build is a quality update; a higher major is a feature update. About always reports compiled code, not merely the server's feed value.

## Feed fields

`latest.version` identifies the published release. `major`, `build`, `channel`, `released`, `title`, `notes`, `highlights` and `kind` describe it. `size` is replaced in the built feed by the generated offline payload's uncompressed byte total. Run `npm run release:feed` to build and synchronize that exact value into the source feed before committing it to GitHub; zero means unknown, never a guessed download size. `url` is informational, not an arbitrary executable download endpoint. `mandatory` is reserved metadata; current skip controls are not a forced-update policy. Top-level `history` describes published releases, while installed history is confirmed locally after a new build boots.

Keep notes paths relative, such as `updates/notes/1.02.md`. Notes images resolve relative to the Markdown file and should be local bundled assets with appropriate licenses.

## Publish

Update source version/package metadata, feed/history, matching notes and current public metadata together. Run `npm run verify`, relevant real-browser tests, then deploy the **whole build**. `npm run build` produces the manifest and worker; running only Vite is incomplete. Never publish a fake newer feed while serving old files just to show an update button.

The updater stages and hash-verifies the new payload before activation. A failed download preserves the installed build and personal files. History appears only after the new version boots. Already-installed public v1.01 clients have their legacy updater until migration; keep the first migration online.

The GitHub feed uses no-store requests and cache-busting; there is no silent fallback to a stale bundled feed after a network/server/JSON error. The deployed local feed remains excluded from offline caching and uses no-store host headers. The service worker deliberately does not intercept it. Worker/inventory discovery files also remain fresh. Cloudflare's clean HTML redirects are supported, but arbitrary cross-scope redirects and rewritten payloads are rejected.

See the repository's `docs/DEPLOYMENT.md`, `docs/RELEASE-1.02.md` and `docs/TESTING.md` for deployment, migration and test instructions.

Future-version notes resolve against the same raw GitHub public directory; installed-version notes use the bundled local file for offline reading. Missing/timed-out notes have their own retry button and do not masquerade as current release notes. Publish the new Pages build before advertising it on the production GitHub feed when releases are split across deployments; if the feed is ahead of deployment, installation safely refuses activation and explains the mismatch.
