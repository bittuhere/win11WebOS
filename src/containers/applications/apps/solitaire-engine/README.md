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

# Vendored: cango91/solitaire (Klondike)

This is retained legacy source, not the engine registered by the v1.02 Solitaire app. The active host imports `solitaire-aashish`; see its README and the root app map. The historical implementation here comes from
[cango91/solitaire](https://github.com/cango91/solitaire) — an MVC engine with a
command/history stack (undo, redo), an event bus that decouples game logic from the DOM,
scoring, draw-1/draw-3 with unlimited passes, "thoughtful mode", and a proven HTML5
drag-and-drop implementation. Card faces are the CardStarter SVG library that ships with
the engine.

> **Licence note:** the upstream repository declares no licence file. It is used here with
> attribution to its author; the adaptations are ours and are Apache-2.0 like the rest of
> the OS. See the repository `NOTICE` for the full statement, and open an issue if you are
> the author and want different terms.

## Layout

```
solitaire-engine/
  card.js  command.js  dataObject.js  eventSystem.js  utils.js
  piles.js            Deck / Waste / Tableau / Foundation / Pile models
  renderer.js         all DOM work, animations, drag proxy
  solitaire.js        the game: rules, commands, undo/redo, dealing, win/lose
  scoring.js          Microsoft-style scoring (off by default)
  commands/           MoveToTableau / MoveToFoundation / Hit / CollectWastePile
  engine.css          generated: upstream src/css/main.css, scoped
  card-library/       CardStarter css (scoped) + the SVG deck
```

`engine.css` and `card-library/css/cards.css` are **generated** — see
“Regenerating the stylesheets” below. Everything else is the upstream source, with the
changes listed here.

## What we changed (all deliberate, all in this folder)

| # | Change | Why |
| - | ------ | --- |
| 1 | `initializeGameDOM({ …, dragHost })` and a new `_removeDragElement()`; the drag proxy and every clone cleanup target the host element. | Upstream appends `.clone-pile` to `<body>`. The engine's stylesheet is scoped to `#solitaireApp`, so a proxy on the body is unpainted — **this is the bug where a dragged card “hid”**. Default is still `document.body` so the engine works standalone. |
| 2 | `_restoreSourcePile()` helper replaces three spellings of the "put the source pile's opacity back" loop, and `renderCancelDrag` / `renderFinishDrop` / `_rebuildPileDOM` bail out safely when the proxy or a pile element is missing. | A `drop`/`dragend` that arrives without a validated drag (window closed mid-drag, synthetic events, state out of sync) used to throw `Cannot read properties of null`. |
| 3 | `engine.css` and `cards.css` are **scoped** copies of `src/css/main.css` and `card-library/css/cardstarter.css`: every selector is prefixed with `#solitaireApp`, page-level `html`/`body` rules are dropped, `:root` custom properties are re-declared on the window, `@charset`/source-map comments stripped. | The engine expects to own the whole page. Without scoping, `.card`, `.slot`, `.header`, `.icon` would fight the Windows 11 desktop chrome. |
| 4 | (host side, in `../solitaire.jsx`) the controllers from `src/js/main.js` run inside the app window instead of on the document, `selfOrParentCheck` calls are guarded for non-Element targets, the event bus is cleared on unmount, the board is scaled to fit the window, and score/moves/undo state is mirrored into React. | Upstream is a single-page app; the OS needs many windows, openable and closable at will. |

Game rules, the command/history model, the animations and the card artwork are upstream's,
untouched.

## Regenerating the stylesheets

They are produced from the upstream sources by prefixing selectors. If upstream changes,
re-run the scoper (the exact algorithm is: split top-level blocks, prefix every selector
with `#solitaireApp`, drop `html`/`body` rules, recurse into `@media`, copy
`@keyframes`/`@font-face` verbatim) and keep the generated header comment.

## Host integration contract (`../solitaire.jsx`)

- The board DOM the engine requires: `#deck-slot`, `#waste-slot`, `.foundation`
  (`#foundation-slot-1..4`), `.tableau` (`#tableau-1..7`), `#fake-drag`, plus the optional
  header icons `#undo`, `#redo`, `#fast-forward`. Pile ids must end in the pile number.
- The wrapper must supply `dragHost` **outside** any transformed ancestor: the proxy is
  `position: fixed` in viewport coordinates (`_dragUpdate` writes `clientX - 65`).
- The event system is a **singleton** — listeners registered by the engine and by the host
  must be removed when the window closes (`renderer.clearListeners()` plus clearing the
  host's events), or a second window double-handles every event.
