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

# How to add apps to the Microsoft Store

The Store catalog is a JSON file. You do **not** need a server. Installed apps are saved in **IndexedDB** (and mirrored to `localStorage` so they still appear after a refresh).

## 1. Edit the catalog (best for a real list)

Open:

```
public/storeCatalog.json
```

Each entry looks like this:

```json
{
  "id": "my-app",
  "name": "My App",
  "icon": "https://example.com/icon.png",
  "publisher": "You",
  "type": "app",
  "category": "Productivity",
  "price": "Free",
  "rating": 4.5,
  "ratingsCount": 1000,
  "data": {
    "type": "IFrame",
    "url": "https://example.com",
    "desc": "What the app does.",
    "feat": "Feature one\nFeature two",
    "gallery": []
  }
}
```

Rules:

- `id` must be unique.
- `type` is `"app"` or `"game"` (Store tabs filter on this).
- `data.type` must be `"IFrame"` (the window host already in this project).
- `data.url` must allow embedding (many sites send `X-Frame-Options: DENY` — those will show a blank frame; pick sites that allow iframes).
- `icon` can be a full URL or a local path such as `img/icon/store.png`.

Restart the dev server after editing JSON.

## 2. Add an app from the Store UI

1. Open **Microsoft Store**.
2. Click the **+** icon in the left rail.
3. Fill in name, iframe URL, optional icon, app vs game.
4. **Add to Store** — it is stored in IndexedDB under `store.custom` and shows up on Home.

Then press **Get** on the detail page. The app is installed, pinned to the desktop, and kept in IndexedDB (`installed` store).

## 3. Add an app from Terminal

```
install MyApp https://example.com https://example.com/favicon.ico
```

## Uninstall

On the app’s Store page, press **Uninstall**, or right-click the desktop icon and delete the shortcut (PWA apps can be removed from the context menu).

## Built-in apps (not the Store)

Windows apps such as Calendar, Mail, Photos, Paint, Clock, Weather, etc. live in:

```
src/containers/applications/apps/extras.jsx
src/utils/apps.js
```

To register a new built-in app:

1. Add an object in `src/utils/apps.js` with a unique `icon` and `action` (e.g. `"MYAPP"`).
2. Export a component from `extras.jsx` (or a new file) that reads `state.apps.<icon>`.
3. Re-export it from `src/containers/applications/index.jsx`.

## v1.02 build and offline requirements

Built-in window implementations are lazy-loaded by `WINDOW_APPS` in `src/containers/applications/index.jsx`; keep the app registry and that mapping aligned. Put licensed local resources in `public/` or import them through Vite, then run `npm run verify`. The build inventories every emitted local asset. Do not hand-edit `build/sw.js`.

Remote Store entries remain online features; caching their icon/catalog entry does not archive the remote site. Declare new provider references in the network audit, check CSP/frame restrictions without bypassing other sites' protections, and test graceful offline failure. A provider can change its framing policy after publication. See [the current app map](APPS-MAP.md) and [testing guide](docs/TESTING.md).
