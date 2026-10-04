# The update feed

Three files decide what every installed copy of WebOS is told when it checks for
an update:

```
public/updates/
├── feed.json          what the newest build is
├── notes/<version>.md the release notes for it (markdown)
└── notes/media/       the pictures those notes use
```

They are plain static files — no server, no API, no account. Change them, push,
and every PC that boots afterwards learns about the new build.

---

## `feed.json`

```json
{
  "feed": 1,
  "channel": "stable",
  "latest": {
    "version": "1.02",
    "released": "2026-11-02",
    "title": "WebOS 1, version 1.02",
    "size": 3120000,
    "url": "/updates/",
    "notes": "updates/notes/1.02.md",
    "highlights": ["One line per highlight, shown in the Update window"],
    "mandatory": false
  },
  "history": [{ "version": "1.01", "build": 1, "released": "2026-10-04", "kind": "quality" }]
}
```

| Field        | Required | What it does                                                                                  |
| ------------ | -------- | --------------------------------------------------------------------------------------------- |
| `version`    | **yes**  | `1.02`, `2.00`, … — the build a person installs                                               |
| `released`   | no       | shown in the window; `YYYY-MM-DD` sorts itself                                                |
| `title`      | no       | the line under the headline                                                                   |
| `size`       | no       | bytes; shown as "3.0 MB"                                                                      |
| `url`        | no       | where to read more; only GitHub, `*.pages.dev`, Cloudflare and same-origin links are accepted |
| `notes`      | no       | path to the markdown release notes                                                            |
| `highlights` | no       | short bullet points shown before the notes                                                    |
| `mandatory`  | no       | reserved: marks an update the UI will not let you skip                                        |
| `history`    | no       | the release timeline shown in the window                                                      |

### The version scheme

| You bump              | It means                             | The updater shows  |
| --------------------- | ------------------------------------ | ------------------ |
| `build` (1.01 → 1.02) | fixes, no new features               | **Quality update** |
| `major` (1.xx → 2.00) | new apps, new features, a new family | **Feature update** |

The running build is declared once, in `src/utils/os/version.js`:

```js
export const OS = {
  family: "WebOS",
  major: 1,
  build: 1,
  channel: "stable",
  released: "2026-10-04",
};
```

Bump it there for a release; the desktop, About panel, Settings and the updater
all read from that one object.

---

## Release notes

`notes/<version>.md` is plain markdown: headings, bold, links, lists, tables,
blockquotes, fenced code and images. The PC renders it locally (no library, no
network) and pictures are resolved **relative to the note file**, so:

```markdown
![The new Store](media/store.png)
```

points at `public/updates/notes/media/store.png`.

Write for a person who already uses the PC: what changed, what it fixes, what
they should do. Keep the file name equal to the version, and point `notes` at it
from `feed.json`.

---

## Publishing a release

1. Make the change; bump `OS.build` (or `OS.major`) in `src/utils/os/version.js`.
2. Add `notes/<version>.md` and any pictures under `notes/media/`.
3. Update `feed.json` — `latest` becomes the new build; push the old one onto
   `history`.
4. Commit, push, deploy. The next PC to boot checks within ten seconds and shows
   a toast; **Windows Update** (Start menu → Windows Update, or Settings) shows
   the full picture and installs it.

### Why the cache-buster matters

A browser will happily answer a fetch from its own cache for hours. Every update
request therefore carries a `?cb=<random>` parameter, sends `cache: no-store`,
and `public/_headers` marks `/updates/*` as `Cache-Control: no-store`. Without
that trio a released update could stay invisible until the cache expires — which
is the failure this whole design exists to avoid.

Once a week, sanity-check the live feed:

```bash
curl -s "https://win11webos.pages.dev/updates/feed.json?cb=$(date +%s)" | head -20
```

Then open Windows Update on a deployed build and confirm the version, the size
and the notes render.
