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

# Security Policy

## Supported versions

Security fixes land on the `main` branch and are included in the next release. There are
no back-ported branches; if you run a fork, please rebase on `main` to receive fixes.

| Version            | Supported |
| ------------------ | --------- |
| `main` (latest)    | ✅        |
| Older tags / forks | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Preferred channel — GitHub private advisory:

1. Go to <https://github.com/bittuhere/win11WebOS/security/advisories/new>
2. Describe the issue (or draft the fix — you can attach a patch to the advisory).

Fallback channel — email **anurag670singh@gmail.com** with `[SECURITY]` in the subject.

Please include, as far as you can:

- the affected page, app or file (e.g. `src/utils/os/links.js`, the Store, the Tauri shell),
- a minimal reproduction (steps, or a snippet that triggers it),
- the impact you believe it has,
- browser/OS and the commit hash you tested,
- whether you intend to publish, and roughly when.

### What to expect

| Stage                        | Target                                 |
| ---------------------------- | -------------------------------------- |
| Acknowledgement              | within **72 hours**                    |
| Triage + severity assessment | within **7 days**                      |
| Fix or mitigation            | **30–90 days**, depending on severity  |
| Public disclosure            | coordinated with you after a fix ships |

You will be credited in the release's `CHANGELOG.md` entry unless you prefer otherwise. There is no
bug-bounty programme; this is a volunteer project.

## Scope

In scope:

- the web application itself (`src/`, `index.html`, `public/`), including the service
  worker, the file-system store in IndexedDB, and the link-opening helpers,
- the optional Tauri desktop shell in `src-tauri/`,
- anything that lets a page or app inside the OS escape its sandbox, read another
  origin's data, or execute code the user did not ask for,
- XSS/HTML-injection in app content, and unsafe handling of user-supplied text,
- the build/test scripts shipped in `scripts/`.

Out of scope:

- third-party applications linked from the Store that are **hosted elsewhere** (they are
  other people's sites — report to their owners; see `public/storeCatalog.json`),
- denial of service through huge assets, and missing hardening headers on third-party
  static hosts,
- self-XSS, social engineering, and physical access to the device,
- the version of a dependency being "old" without a demonstrated, reachable exploit.

## Hardening shipped with the build

- `public/_headers` carries the security headers for static hosts: a Content-Security-Policy
  (`object-src 'none'`, `frame-ancestors 'self'`, explicit `img`/`media`/`connect` allowances for
  `blob:`, `data:` and the APIs the OS uses), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that keeps the
  camera/microphone prompts user-driven, and HSTS.
- No source maps are published with the production build, and the bundle contains no analytics,
  no remote fonts and no third-party scripts.
- Dependency installs are lockfile-pinned (`npm ci`), and CI builds from that lockfile.

## Architecture notes that help triage

- **There is no backend.** The OS is a static bundle; your files, settings and account
  live in your own browser storage (IndexedDB + `localStorage`). Nothing is uploaded.
- **No analytics, no remote scripts.** If you find a request to a third-party tracker in
  a stock build, that alone is a reportable bug.
- External links are opened through a single helper (`src/utils/os/links.js`); anything
  that bypasses it — e.g. re-introducing a global `window.open` override — is a bug.
- The Store catalog mixes curated in-repo apps with links to external, community-hosted
  apps; external entries are clearly URL-based and are not part of this codebase.

## Safe harbour

We will not pursue or support legal action against researchers who: act in good faith,
test only against their own installation or the public demo, avoid privacy violations and
data destruction, and give us reasonable time to fix the issue before publishing. If a
third party brings action against you for such research, we will make it clear that your
actions were carried out under this policy.
