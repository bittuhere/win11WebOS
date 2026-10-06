# Network and offline asset audit — v1.02

## What “how many online assets?” means here

There is no single honest fixed count for every possible session: the Browser and Store can open arbitrary external sites, whose own scripts, fonts, images and API responses can change. A URL literal is also not necessarily a request—license comments, SVG/XML namespaces and outbound links are not downloaded assets.

This audit therefore distinguishes the **bundled desktop** from **optional online features**, and includes the reproducible source inventory rather than claiming that all URL matches are active dependencies.

## Bundled core

- **0 external font files required by the desktop.** The build contains 5 local font files: SettingsIcons WOFF2, Spotify WOFF2/TTF under emitted assets, plus the two legacy public font copies. System fonts such as Segoe UI/system-ui use fonts already installed on the device; they are not web downloads.
- **0 external script/CDN files required for core boot, BitBot or MP3 encoding.** React, Redux, icons and app code are bundled; BitBot resources ship under `bitbot/`; LAME MP3 encoding is now under `vendor/`.
- The tested production build includes **701 precached local files**, approximately **33.1 MiB uncompressed**. `build/offline-manifest.json` is the exact per-build authority for paths, sizes and SHA-256 hashes. Progress measures verified files, not compressed transfer bytes.
- Browser tests observed **0 cross-origin application requests before login**, loaded BitBot offline under the enforced CSP, and fetched all manifest entries with the browser network disabled.
- The authoritative GitHub raw update feed is network-only; the deployed same-origin publication copy is also excluded from the cache. Worker/inventory discovery files and hosting directives are excluded too; they are not offline app content.
- Cloudflare/browser-level network reporting and browser service-worker update behavior are outside the application's own request scheduler.

## Remote dependencies by feature

| Feature | Hosts / mechanism | Offline behavior |
|---|---|---|
| Update discovery and future-version notes | `raw.githubusercontent.com` | Discovery waits for sign-in and needs internet; installed release notes remain local/offline. No stale-feed fallback after a failed check. |
| Weather / weather widgets / Terminal weather | `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Local UI can open; fresh forecasts/search require internet. |
| News and On This Day | `en.wikinews.org`, `en.wikipedia.org`; article thumbnails may add Wikimedia/provider hosts | Bundled fallback data uses local placeholder artwork. Fresh news/images require internet. |
| Maps/search | `photon.komoot.io`, `www.openstreetmap.org` iframe; provider tiles/subresources are dynamic | Map service requires internet. |
| Optional IP-based location | `ipapi.co`, `ipwho.is`, `ippubblico.org` | Lookup unavailable offline. |
| Public holiday lookup | `openholidaysapi.org` | Fresh holiday lookup needs internet. |
| Search/suggestions/site icons | Same-origin dev relay routes; Bing, Google, DuckDuckGo links; `www.google.com/s2/favicons` | External search and provider favicons need internet. The dev proxy is not a Cloudflare Pages Function. |
| Optional feedback email | `formsubmit.co`, only when configured and explicitly submitted | Network delivery needs internet; do not confuse local feedback storage with sending email. |
| Browser / embedded services / video | User-supplied targets, Wikipedia/OpenStreetMap/YouTube reader/embed routes, extension relay | Arbitrary third-party content is not included in the offline payload. |
| Remote Store apps | `storeCatalog.json` and optional user catalog contain external app URLs and legacy icon candidates | Built-in local apps work offline; remote apps remain online even if their icon/catalog entry is cached. |
| Outbound help/source/download links | GitHub, browser-vendor sites, project links, mailto | Navigation links, not automatic boot assets. |
| OS-provided speech voices | Browser/OS-dependent | Some installed voices work offline; a provider may use online voices. No universal offline speech guarantee. |

No Firebase package or sign-in is used by the active project. Removed the unused source file and its legacy project configuration. This does not rewrite Git history or claim that any old public Firebase client configuration was a secret credential.

## Static references found

Run `python scripts/audit-network.py` to regenerate:

- `NETWORK-INVENTORY.csv`: file, line, hostname, classification and literal URL.
- `NETWORK-SUMMARY.json`: summary counts and caveats.

At this audit: **1,827 literal occurrences**, **1,160 distinct literal URLs**, **217 hostnames**. These are **not** 1,160 downloaded assets or 217 required services.

| Classification | Occurrences |
|---|---:|
| Comment/license/reference | 195 |
| Runtime or navigation — call-site review needed | 98 |
| Namespace, not network | 248 |
| Optional remote Store catalog URLs/icons | 884 |
| Vendored library references | 8 |
| Unimported legacy Store/music data/modules | 138 |
| Offline fallback article outbound links | 256 |

The scanner intentionally exposes uncertain cases instead of silently calling them offline. It cannot enumerate runtime-generated URLs, future user-installed apps, redirects, extension traffic or every resource inside a third-party iframe.

## Static dependency changes

1. BitBot's ~11 MB weights are no longer excluded from the offline inventory.
2. The Settings Microsoft icon now uses bundled artwork.
3. LAME 1.2.1 is vendored locally with its upstream license notice/source attribution, replacing a blocked runtime CDN script.
4. Three Imgur easter-egg assets were unavailable during retrieval (HTTP 429); rather than silently leave an offline gap, they were replaced with small local labeled SVG badges. This changes the easter-egg artwork, not its trigger.
5. Static fallback news/history thumbnails use a local SVG instead of dozens of remote image URLs. Live provider imagery remains explicitly online.
6. Available font files are local and included in the generated inventory, as are lazy-loaded app scripts/styles and bundled Office/game resources.

## Follow-up testing

Use browser DevTools Network with Preserve log and Disable cache, then exercise each online feature separately. Export a HAR per workflow if a request-exact runtime count is needed. A root-page trace alone cannot certify every app's network behavior. Do not claim offline support for external content merely because its launcher is cached.

## Production follow-up

The favicon-matched installer SVG is embedded during the build, so there is no additional logo request. Public pages use the same local SVG. Feed checks now run once on each boot after sign-in, rather than a persisted daily schedule; lock/unlock does not repeat a completed boot check. Hosting is static: the development-only API proxy does not become a Cloudflare backend. See [DEPLOYMENT.md](DEPLOYMENT.md).
