<!--
  Copyright 2026 bittuhere

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

# The Store's on-device AI (`store-ai.js`)

A **minimal, honest recommendation engine** — no network, no accounts, no
tracking. It exists to make the Store feel alive the way the real one does:
"Picked for you", ranked search suggestions, "More like this".

## What it learns (this PC only)
| Signal | Where | Weight pathway |
|---|---|---|
| You open an app | `recordOpen` → `store.metrics.opens` | category + type affinity |
| You install an app | `recordInstall` → `installs` | category + type affinity |
| You search a term | `recordSearch` → `searches` | future ranking helpers |

Metrics live in IndexedDB, kv store, key `store.metrics`. Flush is debounced
(400 ms). Delete the key and the AI forgets everything.

## The score
```
score = 0.34·categoryAffinity + 0.22·popularity + 0.16·quality
      + 0.12·typeAffinity + ≤0.16·recentOpenBoost
```
- affinities are Laplace-smoothed frequency tables (one open tilts, never nukes)
- popularity = log-scaled `ratingsCount` (the catalog's own number)
- quality = the catalog rating, normalized
- recent opens decay (~7-day half-life)

With a query, matches (substring or fuzzy subsequence) dominate; otherwise
the affinity score orders rows, suggestions and "More like this".

## Where it shows up
- Home → **"Picked for you"** row (`pickedForYou`: top scorers you don't
  have, max 2 per category so one category can't crowd the shelf)
- Search → type-ahead dropdown (`suggest`: real matches, AI-ordered)
- Detail → **"More like this"** (`related`: same category first)

## Scope and limits
- Recommendations come from the shipped catalog, not generated app URLs. Third-party availability/framing policies can change; catalog membership is not a live uptime or safety guarantee.
- Cold start (empty metrics) = popularity/quality ranking, still sensible.

## v1.02 integration

The Store is a lazy app chunk, included in the offline inventory. Local ranking does not require a remote inference API, but launching remote catalog apps still needs internet. Metrics stay in this browser subject to storage eviction. See [network audit](NETWORK-AUDIT.md) and [testing](TESTING.md).
