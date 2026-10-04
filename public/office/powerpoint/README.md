# PowerPoint Clone — Web Edition 📊

A pixel-faithful Microsoft PowerPoint (2016 "Colorful" theme) that runs entirely in
your browser. Zero dependencies, zero build step — open `index.html` and present.

![status](https://img.shields.io/badge/status-stable-C43E1C)
![storage](https://img.shields.io/badge/storage-IndexedDB-C43E1C)
![dark%20mode](https://img.shields.io/badge/dark%20mode-yes-C43E1C)
![dependencies](https://img.shields.io/badge/dependencies-0-C43E1C)

## What it is

A real slide-deck editor: slides, layouts, shapes, images, charts, speaker notes,
slide sorter, transitions, animations — and actual **full-screen slideshow** — with
round-trip **.pptx** files (OOXML package in `pptx.js`).

## Feature atlas

| Area | Highlights |
| --- | --- |
| Slides | Thumbnail strip, duplicate/delete/hide, layouts (Title, Title+Content, Blank…), drag in sorter view |
| Objects | Text boxes (drag/resize/rotate via handles), shapes, pictures, tables, charts |
| Design | Theme gallery, slide background, variants |
| Motion | Transitions tab + per-object Animations tab with timing grid |
| Present | Slide Show tab → full-screen show (from start / current slide), keyboard navigation |
| Review | Comments, speaker notes pane |
| Files | New / Open / Save As / **.pptx import & export** / print handouts |
| Ribbon | 9 tabs: Home · Insert · Design · Transitions · Animations · Slide Show · Review · View · Help |

## Storage — IndexedDB, no localStorage

All persistence lives in the `ppt-web-edition` IndexedDB database (store `kv`,
hydrated by `idb.js` into the synchronous `window.XKV` facade):

| Key | Contents |
| --- | --- |
| `pc.docs` | Deck registry `{ name: { json, modified, size } }` |
| `pc.session` | Crash-resilient live session (restores on boot) |
| `pc.opts` | Options dialog state |
| `pc.feedback` | Feedback submissions |
| `pc.theme` | `dark` / `light` |

## Architecture

| File | Role |
| --- | --- |
| `index.html` | Chrome skeleton (title bar, thumbs, stage, notes, statusbar) |
| `boot.js` | Splash → `XKV.ready` → session restore → app boot; owns ☾ |
| `idb.js` | IndexedDB write-behind key/value cache |
| `app.js` | Deck model, slide render, stage, undo history |
| `app2.js` | Text engine, ribbon commands, editing interactions |
| `app3.js` | Sorter, slideshow, presenter plumbing |
| `app4.js` | Backstage (New/Open/Save/Options), feedback, help |
| `rib.js` | Ribbon definition (9 tabs) |
| `pptx.js` | .pptx OOXML reader/writer |
| `icons.js` | Inline SVG icon system |
| `ppt.css` | Chrome + stage styles incl. the `body.dark` pass |

## Honest gaps

- Presenter View is a single-window show (no second-screen chords).
- Slide masters are per-theme presets, not a full master editor.
- Video/audio embedding is not supported (images only).
---
<div align="center">
<i>PowerPoint Web Edition · Version 16.0 (Clone) · hand-rolled in vanilla JS.</i><br>
License: Apache License 2.0
</div>
