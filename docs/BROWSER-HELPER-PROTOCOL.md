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

# WebOS Browser Helper protocol — build your own extension

The OS has **no bundled extension** anymore. This document is the full
contract any extension must satisfy so WebOS Edge (and the OS) recognise it
and unlock live rendering of frame-blocking sites.

## 1. How the browser detects helper on/off

`src/utils/os/bridge.js` (bundled into the app) does this, ~forever:

1. Every `PING_INTERVAL` ms it broadcasts into the page:
   `window.postMessage({ src: "WEBOS_BRIDGE", type: "ping" }, "*")`
2. A helper is **ON** when a content script running in the OS page answers:
   `window.postMessage({ src: "WEBOS_BRIDGE", type: "pong", id, version, browser }, "*")`
   (same window — `e.source === window`).
3. Fast path: the helper may also write
   `localStorage.__webos_bridge = JSON.stringify({ id, version, at })`.
4. Anything answering on one of the OS origins counts as live:
   `localhost`, `127.0.0.1`, `win11-web.pages.dev`, `win11-web.github.io`.

That is the whole on/off switch — `extLive` in Edge.

## 2. What the helper should do (optional, per message)

All messages use `src: "WEBOS_BRIDGE"`. The OS page sends, the helper answers:

| request | answer |
|---|---|
| `{type:"ping"}` | `{type:"pong", id, version, browser}` |
| `{type:"fetch", rid, url, as:"text"}` | `{type:"fetch-result", rid, ok, status, statusText, contentType, body, finalUrl}` — fetch with the extension's host permissions (ignores page CORS) |
| `{type:"ai-chat", rid, messages}` | `{type:"ai-result", rid, ok, text, model}` — any keyless LLM relay you like |
| (in frames) link click / GET submit | `{type:"navigate", url, title}` sent to `window.parent` — the OS re-originates the navigation so header rules apply |
| (in frames) pushState/popstate/hashchange | `{type:"location", url, title}` to `window.parent` — keeps the address bar honest |

## 3. The header strip (this is what makes sites load live)

`manifest.json` (MV3):
```json
{
  "manifest_version": 3,
  "name": "Your Helper",
  "version": "1.0.0",
  "permissions": ["declarativeNetRequest"],
  "host_permissions": ["http://*/*", "https://*/*"],
  "declarative_net_request": {
    "rule_resources": [{ "id": "net_rules", "enabled": true, "path": "net_rules.json" }]
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_start",
    "all_frames": true
  }]
}
```

`net_rules.json` (two rules — both needed):
```json
[
  { "id": 1,
    "action": { "type": "modifyHeaders", "responseHeaders": [
      { "header": "Content-Security-Policy", "operation": "remove" },
      { "header": "X-Frame-Options", "operation": "remove" } ] },
    "condition": { "initiatorDomains": ["localhost", "127.0.0.1", "win11-web.pages.dev", "win11-web.github.io"] } },
  { "id": 2,
    "action": { "type": "modifyHeaders", "responseHeaders": [
      { "header": "Content-Security-Policy", "operation": "remove" },
      { "header": "X-Frame-Options", "operation": "remove" } ] },
    "condition": { "resourceTypes": ["sub_frame"] } }
]
```
Rule 1 covers top-level navigations started by the OS; rule 2 covers every
iframe load **regardless of initiator** (navigations a site starts inside the
frame initiate from the site's own domain).

## 4. Scoping rules (do not skip)

The content script must be fully inert unless the page is an OS origin
(top) or embedded by one (`location.ancestorOrigins`). Off-scope: no badge,
no writes, no link takeover, no relays.
