# Security policy — Win11 WebOS

## Supported version

The current maintenance target is **v1.02 / Build 2**. Previous notes are historical; no lifetime support or security certification is implied.

## Reporting

Use the repository's private vulnerability reporting feature if enabled, or contact the maintainer at **anurag670singh@gmail.com**. Do not publish secrets, personal browser files or an active exploit in a public issue. Include the commit/version, affected browser/host, minimal reproduction, impact and relevant headers/logs. Response timing depends on maintainer availability; no unverified response-time guarantee is made.

## Trust boundaries

- This is a client-side browser desktop, not Windows or an isolation boundary equivalent to a native OS.
- Local login is not storage encryption and cannot protect against someone controlling the browser/devtools. IndexedDB/localStorage may contain personal files; clearing site data deletes them.
- Remote websites, Store apps, optional feedback providers and helper extensions have their own trust/privacy/security properties. The core offline cache does not make them local or trusted.
- Firebase is not part of active login; its unused source/config were removed. Old Git history may still contain public legacy client configuration.
- `CONTROL.env` is embedded public configuration, not a secrets mechanism. All code/public assets sent to a browser are inspectable.

## Protections and limits

`public/_headers` ships CSP, nosniff, referrer, permission and framing protections for Pages. Same-origin and specifically needed blob/data resources are permitted; BitBot/Terminal do not require unsafe-eval. Inline styles/scripts and remote HTTPS imagery/connections/frames remain permitted for existing app features; this is not a strict nonce-only CSP. Review changes rather than disabling the policy.

The generated offline installer verifies each file against build-time SHA-256, permits only in-scope same-origin redirect destinations, and refuses mixed/rewritten payloads. This checks deployment consistency, **not authenticity against a compromised origin**: someone controlling the origin could replace both manifest and files. TLS, account security and review remain necessary.

Update installation stages a new cache before activation and preserves personal/unrelated-app data. Cache quota, eviction and browser restrictions can prevent offline availability. Stored documents may contain active content; inspect untrusted HTML and use the app's intended sandbox/reader paths.

The Vite `/webos-proxy` and search proxies are development features, not a secure deployed relay service. Do not publish the development server as production. A separately hosted proxy requires its own SSRF controls, rate limits, origin policy and security review.

## Dependency status and testing

See [AUDIT.md](AUDIT.md) and the dated [test results](docs/TEST-RESULTS-1.02.md). Production-only and complete npm audits cover different scopes. Known build-tool advisories are not erased just because the browser runtime audit is clean. Test versions are reproducible via the committed lockfile; audit databases change over time.

Run `npm ci`, `npm run verify`, relevant browser suites and `npm audit` when reviewing a release. The local production preview applies headers and clean URLs for testing, but is not a complete Cloudflare edge emulator or penetration test.

## Safe testing

Use a local clone and disposable browser profile. Do not attack remote Store sites, providers, other users, or the live project without authorization. Report privately and avoid accessing data beyond the minimum needed to demonstrate an issue.

## Shell/update follow-up

The runtime feed now comes from the raw GitHub `main/public/updates/feed.json` path; the source copy is published through a Git push, not a local edit alone. Install payloads still come only from the same-origin service worker and must match the offered version. Invalid/unavailable feeds do not silently fall back to old metadata. Start and Quick Settings use a full slide; standard title bars have opaque theme-aware defaults. The focused browser error/motion checks are in `tests/shell_update_followup.py`.
