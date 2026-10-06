# Current release audit — v1.02

This is the current audit entry point. [The previous audit](docs/archive/PRE-1.02-AUDIT.md) is preserved as historical material; its old dependency/test counts and guarantees are not current claims.

## Scope and evidence

- [Release implementation and limits](docs/RELEASE-1.02.md)
- [Testing commands](docs/TESTING.md) and [dated results](docs/TEST-RESULTS-1.02.md)
- [Network dependency audit](docs/NETWORK-AUDIT.md), [literal URL inventory](docs/NETWORK-INVENTORY.csv), [summary](docs/NETWORK-SUMMARY.json)
- [Security policy](SECURITY.md)
- [Production deployment contract](docs/DEPLOYMENT.md)

## Material changes

Unused Firebase login/configuration removed; CSP-safe local script loading; full offline payload rather than shell-only Workbox precaching; staged non-destructive updates; each-boot post-login discovery; version consistency; lazy app chunks and Redux-selector correction; accessible update motion/layout; public identity/docs and deploy checks.

The release candidate also replaces the installer grid glyph with the favicon SVG, supports Cloudflare's actual clean-HTML redirects, and removes the catch-all rewrite that could hide missing assets/feed behind a successful HTML response. Redirect destinations remain scope-restricted and downloaded bytes remain hash-verified.

## Known limits

No claim of universal offline durability, complete security, all-browser certification or guaranteed search/AI indexing. Online features remain online. A local password is not encryption. Previous v1.01 code cannot be changed retroactively on an installed client. See the release guide before migrating personal files.

At the previous v1.02 dependency check, production dependencies had zero reported advisories; the full audit reported five high-severity development-tool advisories in the Tailwind/glob/watcher chain. Consult the latest dated test report and rerun both audits—these are observations, not permanent guarantees. The large shared vendor chunk and inherited Sass deprecations also remain optimization/maintenance work.

Do not replace actual testing with a static 'all checks passing' badge. Builds, focused release tests, broad regression tests, deployment validation and live production verification are separate results.

## Shell/update follow-up

The runtime feed now comes from the raw GitHub `main/public/updates/feed.json` path; the source copy is published through a Git push, not a local edit alone. Install payloads still come only from the same-origin service worker and must match the offered version. Invalid/unavailable feeds do not silently fall back to old metadata. Start and Quick Settings use a full slide; standard title bars have opaque theme-aware defaults. The focused browser error/motion checks are in `tests/shell_update_followup.py`.
