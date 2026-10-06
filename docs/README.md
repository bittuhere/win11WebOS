# Documentation index — Win11 WebOS v1.02

## Start here

- [Project overview and build](../README.md)
- [GitHub push and Cloudflare deployment](DEPLOYMENT.md)
- [Contributor workflow](../CONTRIBUTING.md)
- [Maintainer release checklist](../MAINTAINER-GUIDE.md)
- [Testing commands](TESTING.md) and [dated results](TEST-RESULTS-1.02.md)

## Architecture, apps and behavior

- [v1.02 implementation, migration and limits](RELEASE-1.02.md)
- [App source map](../APPS-MAP.md)
- [Adding Store/built-in apps](../ADDING_APPS.md)
- [Store's local ranker](STORE-AI.md)
- [Optional browser-helper protocol](BROWSER-HELPER-PROTOCOL.md)
- [Feed format and publishing](../public/updates/README.md)
- [Release notes](../RELEASE-NOTES.md) and [changelog](../CHANGELOG.md)

## Security, network and discovery

- [Security policy](../SECURITY.md), [current audit](../AUDIT.md), [third-party notices](../NOTICE)
- [Network audit](NETWORK-AUDIT.md), [URL inventory](NETWORK-INVENTORY.csv), [counts](NETWORK-SUMMARY.json)
- [Google/AI discoverability](DISCOVERABILITY.md)
- [Code of conduct](../CODE_OF_CONDUCT.md), [license](../LICENSE)

## Public pages

The shipped About, Docs and Releases HTML pages live under `public/` and work without JavaScript/login. They complement, not replace, the engineering guides here. The modern favicon and installer share `public/favicon.svg`; raster/ICO fallbacks remain available.

## Historical records

[Pre-v1.02 audit](archive/PRE-1.02-AUDIT.md). Older release entries and upstream protocol version examples are deliberately preserved, not changed to pretend they were always v1.02. Current Node/build/update instructions belong in the current guides above.

`deliverables/` means optional generated download packages, not application source. It can be absent entirely; `npm ci && npm run build` is the deployment workflow.
