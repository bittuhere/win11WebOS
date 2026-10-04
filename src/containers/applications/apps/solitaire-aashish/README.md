# Solitaire engine — vendored from AashishChakravarty/solitaire

This folder is a **vendored, adapted** copy of the Klondike game in
[`AashishChakravarty/solitaire`](https://github.com/AashishChakravarty/solitaire)
— MIT licensed, © 2025 Aashish Chakravarty. See `NOTICE` for the full licence
text.

Upstream is a single-page HTML file: a `<style>` block, a small amount of
markup, and one `<script>` that holds the whole game. Here that file is split
into two modules so the OS can mount the game inside its own window:

| file | what it holds |
| --- | --- |
| `engine.js` | the whole game as `createSolitaire(root, options)`: deck, deal, rules, scoring, rendering, animation, save/resume, undo, hint, auto-complete, input handling |
| `engine.css` | the upstream stylesheet, scoped under `#solitaireApp`, with page-level rules (`html`, `body`) dropped |

The Win11 host lives one level up, in `../solitaire.jsx` + `../solitaire.scss`.

## Using it

```js
import { createSolitaire } from "./solitaire-aashish/engine";
import "./solitaire-aashish/engine.css";

const game = createSolitaire(rootElement, {
  onState: (s) => { /* s.score, s.moves, s.canUndo, s.drawCount, s.wins, … */ },
  onWin: (info) => { /* info.score, info.moves */ },
});

game.newGame();       // fresh shuffle
game.restart();       // replay the same deal
game.undo();          // multi-level history
game.hint();          // highlights a legal move (costs 5 points)
game.autoComplete();  // finish the game once the stock and waste are empty
game.setDraw(1 | 3);  // cards per stock flip
game.getState();      // the same payload onState receives
game.destroy();       // removes the board, its listeners and its timers
```

The engine builds its own DOM inside `root` (`#stock-pile`, `#waste-pile`,
`#foundation-0..3`, `#tableau-0..6`, `.game-board`, `.pile`, `.card`) and never
touches anything outside it.

**Sizing.** The host sets four custom properties on `#solitaireApp` —
`--card-width`, `--card-height`, `--board-gap`, `--stack-offset` — and the whole
board follows. Nothing is `transform: scale`d, so cards stay crisp and the
engine's flying-card animations stay anchored (see below). The engine reads
`--animation-speed-ms` / `--move-animation-speed-ms` for its timer durations.

## Adaptations for the OS window

1. **Module instead of a page.** Upstream's script runs on `DOMContentLoaded`,
   reads its own markup and binds document-level listeners. Here it is a
   factory: it creates the board inside `root`, binds every listener to the
   container (not `document`), and `destroy()` removes the board, the listeners
   and every pending timer — so closing and re-opening the window is clean, with
   no duplicated handlers on the second open.
2. **No `<body>` children.** Everything the engine draws lives inside the game
   window. This is the fix for the reported bug: the old port parented its
   drag-proxy to `<body>`, where the window-scoped styles could not reach it, so
   a dragged card went invisible. This engine creates **no proxy at all** — the
   card under the pointer is the real card, marked `.dragging`, and it stays
   painted. The animation clones that *do* exist (`.card.moving`, when a card
   flies to a foundation or auto-completes) are appended to the board root and
   positioned in the board's own coordinate space, so no ancestor transform can
   drag them off target.
3. **Scoped CSS.** The upstream `<style>` is flattened and prefixed with
   `#solitaireApp`, its `html`/`body` rules are dropped, and the Google Fonts
   `@import` for Inter is gone — the OS makes no remote requests, so the game
   uses the system UI font stack.
4. **CSS-drawn deck.** Upstream already draws pips with Unicode suit glyphs;
   the corner indices and suit sizing here are expressed in `em`-like
   `calc(var(--card-width) * …)` terms so the faces scale with the window. No
   card-library assets to vendor.

## Improvements over upstream

- **Multi-level undo** (`UNDO_LIMIT = 200` snapshots) — upstream's Undo is a
  single step.
- **Draw 1 / Draw 3 toggle**, persisted, with the stock refill rule kept honest
  for both.
- **Click-to-move** in addition to drag and double-click: click a face-up card
  to pick it up (the run highlights in gold), click a pile to drop it; clicking
  the same card again clears the selection.
- **Move counter** next to the score, and a per-PC tally of games played and won.
- **Storage namespacing and safety**: every key is `solitaire.aash.*` and every
  read/write is wrapped in try/catch, so the game runs inside a sandboxed frame
  with no `localStorage` at all (the OS preview does exactly that).
- **A state hook for the host**: `onState`/`getState` and a
  `data-piles` snapshot on the DOM node give the Win11 bar its score, moves,
  draw mode and undo/auto-complete availability without reaching into the
  engine.
- **Timer hygiene**: all `setTimeout`s are tracked and cleared on `destroy()`,
  and async loops (auto-complete, animations) bail out if the window closed.

## Rebuilding from upstream

Upstream ships no build step, so "rebuilding" means comparing against the
source:

```bash
git clone --depth 1 https://github.com/AashishChakravarty/solitaire /tmp/aash
# index.html: <style> is the base for engine.css, <script> for engine.js
```

Then re-apply the four adaptations above. The likely pitfalls, in order:
page-level selectors leaking into the OS chrome, the `@import` font loading
nothing in an offline frame, listeners bound to `document` surviving a window
close, and any host that puts a `transform` on the element that contains the
board.
