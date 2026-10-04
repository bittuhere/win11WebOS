<!--
  Copyright 2026 bittuhere (anurag670singh@gmail.com)

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

# Maintainer guide

The code is finished and the repository is self-consistent. What is left are the things a
machine cannot do for you: creating the GitHub repository, switching on the safety nets,
replacing the handful of personal placeholders, and knowing which knob to turn when
something is off.

Work through this once, top to bottom, and you can forget about it afterwards.

---

## 1. Your first push (about five minutes)

The folder you are holding is already a complete project — there is no broken history to
repair, so a fresh repository is the cleanest possible start.

```bash
cd win11WebOS
git init -b main
git add -A
git commit -m "Windows 11 WebOS 1.0.0"
git remote add origin https://github.com/bittuhere/win11WebOS.git
git push -u origin main
```

A quick look before you push, if you want to be sure nothing local slipped in:

```bash
git status --short          # should list only real project files
git ls-files | wc -l        # a few hundred files, not thousands
git ls-files | grep -E "node_modules|build/"   # must print nothing
```

`.gitignore` is written for exactly this: builds, caches, editor and OS junk, screenshots,
logs, secrets, archives and Python scratch are all invisible to `git status`, and each rule
that looks unusual carries a comment saying why. If you ever _do_ want to commit something
it ignores, `git add -f <path>` always wins.

**Publish the demo.** After the first push, turn on Pages: **Settings ▸ Pages ▸ Source:
Deploy from a branch ▸ `main` / `root`** will serve the _source_ folder, which is not what
you want. Instead let Actions publish the build: add the Pages workflow (or run
`npm run build` locally and push the `build/` folder to a `gh-pages` branch). The site URL
is `https://win11webos.pages.dev/`, which is already what every doc and metadata
file points at.

---

## 2. Placeholders to make yours (fifteen minutes)

These are the only places still carrying my defaults. Nothing breaks if you leave them,
but the site looks unfinished to a visitor until you change them.

| File                                                        | What to change                                                                 | Why                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `package.json`                                              | `author`, `repository`, `homepage`, `bugs`                                     | Shows on npm/GitHub; also feeds the "Edit this page" links    |
| `index.html`                                                | `<link rel="canonical">`, `og:url`, `og:image`, `twitter:*`, the JSON-LD `url` | Previews on WhatsApp/X/Discord/LinkedIn all read these        |
| `public/sitemap.xml`                                        | the `<loc>` URLs (and `lastmod` after a big change)                            | Google indexes the pages you actually have                    |
| `public/robots.txt`                                         | the `Sitemap:` line                                                            | Same, for crawlers that read robots first                     |
| `README.md`                                                 | demo link, badges, screenshots section                                         | Your shop window                                              |
| `SECURITY.md`, `src/containers/applications/apps/about.jsx` | the contact address                                                            | Only if you would rather people did not write to that mailbox |
| `src-tauri/tauri.conf.json`                                 | `identifier`, `publisher`, `productName`                                       | Needed the day you actually wrap it as a desktop app          |

If you move to a custom domain, add a file named `CNAME` (one line, the bare domain) to
`public/` — it is copied into the build automatically — then update the six rows above.

---

## 3. Switch these on in the repository settings

Ten minutes, once, and then CI and GitHub do the policing for you.

| Where             | Setting                                                                                                                             | What it buys you                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| General           | **Description**, **Website**, **Topics** (`windows-11`, `react`, `vite`, `webos`, `desktop-environment`, `pwa`)                     | Findability; the descriptions come straight from the README's first paragraph    |
| Actions ▸ General | Workflow permissions: _Read and write_ is **not** needed — leave _Read repository contents_                                         | A hijacked dependency cannot push to your repo                                   |
| Branches          | Protection rule for `main`: require the **Build + smoke** and **Browser suites** checks, require a pull request, block force-pushes | The 228 browser checks become a real gate instead of advice                      |
| Security          | Enable **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** and **Push protection**                          | Free on public repositories; push protection refuses a commit containing a token |
| Security          | **Private vulnerability reporting**                                                                                                 | Gives researchers a quiet channel — the one SECURITY.md promises                 |
| Options           | **Issues** on, **Discussions** optional, **Sponsor** if you like                                                                    | The shipped issue forms and PR template light up automatically                   |

The workflow in `.github/workflows/ci.yml` already builds the app, runs the offline driver,
serves the production build and runs the six Playwright suites. Screenshots from a failing
run are uploaded as an artifact — that is the first thing to open when CI goes red.

---

## 4. The rules that keep secrets out

There is nothing to configure today: the app is 100 % client-side, has no backend, no
accounts and no analytics, and it ships no API keys. Keep it that way and you will never
have a key to leak.

- **Anything inside `src/` or `public/` is public.** It ends up in `build/` and in the
  browser. `public/storeCatalog.json` is a published file: catalog entries are names,
  icons and links only.
- **`.env` files are ignored** (`.env`, `.env.*`, with `.env.example` deliberately
  tracked). If you ever need a real key, it belongs in a small serverless function
  (a Cloudflare Worker is enough) with the key in the host's environment variables, and the
  browser calls that function.
- **Never paste a token into an issue, a commit, a screenshot or a PR description.** If one
  does land in a commit, treat it as burnt: revoke it first, then clean the history — and
  remember that push protection will normally stop you before GitHub ever accepts it.
- The Google Drive link and the zip are no longer part of anything. Delete the zip, keep the
  repository as the single source of truth.

---

## 5. Legal and trademark caution

Straightforward, and worth reading once:

- **Your code** is Apache-2.0. Anyone may use, modify and redistribute it as long as they
  keep the licence, the `NOTICE` file and the copyright headers.
- **Windows, Microsoft, the Windows logo, the Fluent icon set, the Microsoft Store and the
  Solitaire card art are Microsoft's trademarks and artwork.** This project is an
  unaffiliated fan re-creation for learning. Keep it that way:
  - do not sell it, put ads on it, or offer it as a paid product;
  - do not rename it to something that looks official ("Microsoft Windows 11" is out);
  - do not register a domain that trades on Microsoft's name;
  - keep the disclaimer that already sits in `README.md`, `NOTICE` and the About dialog.
- **Third-party code is credited in `NOTICE`**: the Solitaire engine (MIT, Aashish
  Chakravarty), the keyboard easter eggs (MIT, Wei-Chia Chang), the office viewers and
  document-preview libraries. If you add a dependency, add its licence there in the same
  breath.
- If Microsoft or any rights-holder ever asks you to take it down, comply politely and
  promptly. A fan project is not worth an argument.

---

## 6. Release checklist (for this version and every one after)

```bash
npm ci                     # exact, reproducible install from package-lock.json
npm run build              # writes build/
npm run preview            # serve build/ on :4180 to click around yourself
npm run smoke              # boots the bundle in jsdom — expect "errors (0)"
node --experimental-vm-modules scripts/drive.cjs   # 168 steps, offline, no browser
```

Then the browser suites (they need `pip install playwright` and
`python -m playwright install --with-deps chromium` once):

```bash
python3 tests/verify.py             # 28 checks   — the core shell behaviour
python3 tests/file_types.py         # 41 checks   — associations, icons, Notepad
python3 tests/mobile_layout.py      # 59 checks   — the fitted phone interface
python3 tests/rotate_gate_devices.py# 49 checks   — the landscape gate, device by device
python3 tests/solitaire_aash.py     # 51 checks   — Solitaire end to end
python3 tests/iframe_flow_test.py   # 0 console errors on the handed-over links
```

**Green means:** 228 browser checks pass, the driver reports `168 passed, 0 failed,
0 runtime errors`, smoke reports `errors (0)`, and CI is green on `main`.

To cut a release:

1. Bump the version in **four** places — `src/utils/os/version.js` (`OS.major` / `OS.build` — the
   only copy the OS itself reads), `package.json`, `src-tauri/tauri.conf.json`, and a new
   section in `CHANGELOG.md`.
2. Move `CHANGELOG.md`'s `[Unreleased]` entries under today's version.
3. **Publish the update feed** — this is the step that decides whether existing PCs hear about
   the release at all:
   - write `public/updates/notes/<version>.md` (markdown; pictures go in `notes/media/`);
   - update `public/updates/feed.json`: `latest` becomes the new version, the previous `latest`
     moves onto `history`, and `notes` points at the markdown you just wrote;
   - the feed is served `Cache-Control: no-store` by `public/_headers`, and the client adds its
     own cache-buster, so a deploy is enough — nothing else to purge.
   - Sanity-check the live feed after deploying:
     `curl -s "https://win11webos.pages.dev/updates/feed.json?cb=$(date +%s)"`.
4. `git tag -a v1.1.0 -m "WebOS 1, v1.01" && git push --tags`.
5. Create the GitHub release. The **description** is the release note a person reads on GitHub;
   the notes in `public/updates/notes/` are the ones the PC itself renders. Keep them in step,
   and keep personal working notes out of the repository. Attach a zipped `build/` only if you
   want one — archives are ignored by git (`.zip`, `.tar.gz`), so use `git add -f` or the
   release upload UI, never a commit.

---

## 7. Day-to-day maintenance

| Rhythm                                           | What to do                                                                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When Dependabot opens a PR                       | Read it, let CI run, merge if green. The workflow covers the lockfile, Actions and the Rust shell.                                                                                                                                        |
| When you touch a file association or an icon     | `src/utils/os/assoc.js` and `src/utils/os/icons.js` are the single tables; the driver's icon check and `tests/file_types.py` both fail if they drift apart — that is the point.                                                           |
| When you add a document type                     | Add the entry to `assoc.js`, an icon to `icons.js`, then run `tests/file_types.py`.                                                                                                                                                       |
| When you add a Store app                         | `public/storeCatalog.json` (see [ADDING_APPS.md](./ADDING_APPS.md)) — no server, no rebuild of the catalog.                                                                                                                               |
| When you translate                               | The `locales/` JSON files; `npm run prettier` before committing.                                                                                                                                                                          |
| Whenever you write a commit message or a comment | Describe **what the product does and why**, never "user reported", "round 12", "as requested", "fixed the bug from feedback". Those read as notes-to-self and age badly; `CHANGELOG.md` is the only place that records changes over time. |

---

## 8. Hosting notes worth knowing

- **GitHub Pages** is free and fine for a fan project: soft limits around 1 GB per
  repository and ~100 GB of traffic a month. It cannot set custom headers, so `_headers` is
  ignored there — the app is safe without it (the CSP is a belt on top of braces), but if
  you want the strict headers live, use **Cloudflare Pages** or **Netlify** with the same
  `build/` folder; both read `public/_headers` and `public/_redirects` as-is.
- **Caching** is already right: hashed files under `assets/` are immutable for a year, the
  HTML is revalidated on every load, so a deploy is live the moment the DNS/edge catches up.
- **Offline** works through the service worker, which precaches the app shell. The 11 MB
  BitBot model and the keyboard easter eggs are deliberately kept out of that cache, and
  the easter eggs load only after the desktop is up — that is why the first screen is fast.
- **On phones**, install from the browser menu ("Add to Home screen") to get the real
  full-screen experience, including the landscape gate. Test the installed app over the
  deployed https URL, not over a local server, because installability and the service
  worker behave differently without a real origin.
- **`base` is relative on purpose** (`vite.config.js` → `base: "./"`). Do not switch it back
  to `"/"`: that is what makes the same build work at a domain root, on
  `/win11WebOS/`, and inside any sub-folder.

---

## 9. If something looks wrong

| Symptom                                                       | First thing to check                                                                                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI red, uploads screenshots                                   | Open the artifact from the failed run; the last lines name the failing check                                                                                                     |
| Blank page after deploying                                    | The host is serving the repository root instead of `build/`; check the publish directory                                                                                         |
| Old version still cached                                      | The service worker is doing its job — hard-reload once (Ctrl/Cmd + Shift + R)                                                                                                    |
| The About panel appears on every boot                         | That is intentional — it is a desktop sign-in panel, re-opened by the boot effect in `src/App.jsx` (search `DESKABOUT`). Delete that one line if you would rather it appear once |
| The landscape gate blocks a small laptop or an unusual device | Settings ▸ Touch & rotation, or set `wos.rotateGate` to `off` in DevTools ▸ Application ▸ Local Storage — the flag the gate itself reads                                         |
| A file opens in the wrong app                                 | Right-click ▸ _Open with_ ▸ tick **Always use this app**; the override lives in `wos.fileAssoc` and can be cleared the same way                                                  |
| A whole app misbehaves after you experiment                   | Clear that origin's storage in DevTools ▸ Application ▸ Storage — files live in IndexedDB, the rest in Local Storage, and both rebuild their defaults                            |

---

That is the whole list. Keep the changelog honest, keep the gates green, and the project
takes care of itself.
