# GitHub → Cloudflare Pages

Applies to **v1.02**, Vite 7, Node 22.12+ recommended. The web app is a static deployment; no Firebase backend or Python service is required.

## 1. Put the source in your repository

Use a clean extraction of the source archive, or apply the supplied patch to the matching original checkout. Copying files over an old checkout does not delete removed files (`src/components/login.js`, `.firebaserc`, `_dbg*.js`, `public/_redirects`). Review deletions explicitly. Do not replace your existing `.git` directory.

From the repository root:

```sh
npm ci
npm run verify
git status --short
git diff --check
git add -A
git diff --cached --stat
git commit -m "Release v1.02: offline installation, updates, docs and favicon branding"
git push origin main
```

Use your actual branch instead of `main` when appropriate. Configure your own Git identity/authentication; no account credentials or push have been supplied by the project. Review staged changes for secrets before committing. No force-push is needed.

Commit `package-lock.json`, `.nvmrc`, `release.json`, `wrangler.jsonc`, `public/_headers`, source/public assets, scripts, tests and docs. `.gitignore` excludes build output, node_modules, test artifacts, credentials and release archives. Existing tracked generated files must be removed from the index separately if your own branch previously committed them; do not blindly delete personal data.

## 2. Connect Cloudflare Pages to GitHub

Select the repository and production branch. Use repository root, build command **`npm run build`**, output **`build`**, Node **22.12+**. The checked-in `.nvmrc` selects Node 22. `wrangler.jsonc` declares `pages_build_output_dir`; it contains no account ID or token.

The build runs preflight checks, Vite, full inventory/hash generation and a deployment validator. It does not require running the full browser test suite inside Cloudflare. CI runs tests separately.

`npm start` is for local HMR, not a production start command. Static Pages does not need a start command, Procfile, Python, Rust, a Firebase project or a server process. `Procfile`/`app.json` only support optional non-Pages Node hosting.

## 3. Or use direct upload

```sh
npm ci
npm run build
```

Upload the **contents** of `build/`: `index.html` must sit at deployment root, with `assets/`, `sw.js`, `offline-manifest.json`, `_headers`, images, fonts and `updates/` beside it. A generated deployment ZIP can be used where the dashboard accepts ZIP uploads. It must not have an extra containing `build/` directory. A source ZIP is not a deployment ZIP.

Optional authenticated CLI workflow (Wrangler is not needed for ordinary builds):

```sh
npx wrangler pages deploy build --project-name win11webos
```

Use the correct account/project. A Git-integrated project and a direct-upload project have different creation workflows in Cloudflare; do not assume the repository config grants account access.

## 4. Cache / security settings

- Deploy all files from one build together. Do not edit files in `build/` afterward; regenerate instead.
- Keep `/updates/feed.json`, `/sw.js` and `/offline-manifest.json` network-fresh. Do not override their `no-store` policy with a Cache Everything rule.
- Hashed `/assets/` output can be immutable; HTML/public docs revalidate.
- Disable edge HTML/JS minification, injected analytics/beacons, or other response rewriting for precached files. Downloads are SHA-256 checked against build-time bytes. Compression is fine: hashing checks the decoded payload.
- Cloudflare clean URLs redirect `/index.html` to `/` and directory index files to their folders. The installer accepts same-origin in-scope redirects only, then verifies the hash and normalizes cached responses. Offline clean-URL aliases are handled too.
- There is deliberately **no catch-all SPA rewrite**. The desktop's shortcuts use `/?app=…`, not client-side path routing. Missing feeds/scripts must return errors, not an HTML desktop with status 200.
- `_headers` is the production policy. `npm run preview` reads the built policy; the older Python server is a test helper. Never enable the local `WOS_ALLOW_PREVIEW_EMBED=1` option on an internet-facing Node server unless you intentionally want embedding.
- Local files/BitBot do not need `unsafe-eval`. Keep protective CSP directives; do not replace the policy with a wildcard.

## 5. Validate the deployed site

1. Confirm root, `/about/`, `/docs/`, `/updates/` and the favicon SVG render.
2. Confirm both the deployed feed and the runtime [GitHub feed](https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/updates/feed.json) are valid JSON with version `1.02`; a missing URL must not return the desktop shell. Pushing the source feed publishes discovery through GitHub, independently of the Pages deployment finishing. An ahead-of-deployment feed is safely rejected at install time.
3. On a fresh profile, finish the first download and local setup/login; watch for hash or CSP failures.
4. Disconnect and reload. Open local apps and BitBot; confirm About/Settings show v1.02.
5. On an old v1.01 profile, test migration while online. Its legacy updater cannot be changed until the new app loads; do not clear IndexedDB/localStorage to fix a worker problem.
6. Retain the previous Cloudflare deployment for rollback. Do not manually edit only the feed to simulate a release.
7. Follow [DISCOVERABILITY.md](DISCOVERABILITY.md) for Search Console and crawler checks. Deployment is not indexing.

A same-version local preview can still show an older cached build. Use a fresh browser profile or another localhost port to test a candidate; do not erase personal site storage indiscriminately. Published updates should increment the build number.

## What is `deliverables`?

It is an optional folder holding generated ZIPs, patches and handoff notes for download. **It is not an app dependency, required repo folder, npm input or Cloudflare output.** It is ignored by Git. The authoritative code lives in this repository and the authoritative deployable output is generated as `build/`. You do not need any ZIP if you push source and let Cloudflare build it.

## Optional switches and domains

`CONTROL.env` is a public build-time file. `ES: OFF` suppresses the optional helper-extension setup step; the browser helper is not bundled. `EMAIL` configures a public feedback destination; check its behavior before enabling delivery and never put secrets in this file. Online services and user permission prompts remain feature-dependent.

For a custom domain, update canonical/structured-data URLs, sitemap, robots sitemap URL, public docs/links and package homepage consistently. Rebuild, deploy, and verify ownership at the new canonical origin. Browser storage is origin-specific; moving domains does not automatically transfer a user's local PC.

Before publishing release metadata through GitHub, run `npm run release:feed`. It builds the artifact and copies the measured uncompressed payload size into `public/updates/feed.json`; review and commit that change. This command does not push or deploy. Keep the Pages deployment and advertised version aligned.
