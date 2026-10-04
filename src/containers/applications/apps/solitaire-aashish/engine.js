/*
 * Vendored engine — AashishChakravarty/solitaire (Klondike)
 * Upstream: https://github.com/AashishChakravarty/solitaire
 * MIT License, Copyright (c) 2025 Aashish Chakravarty (see the repository NOTICE).
 *
 * Adapted for Windows 11 WebOS. The rules, scoring and rendering logic are
 * upstream's; the differences are all about living inside an OS window
 * instead of owning a page, plus a few requested extras:
 *
 *   1. module-ised: `createSolitaire(root, options)` builds the board inside
 *      the element it is handed and returns a handle
 *      { newGame, restart, undo, hint, autoComplete, setDraw, getState, destroy };
 *   2. storage keys are namespaced under `solitaire.aash.*` and every access
 *      is guarded (a sandboxed frame can deny storage entirely);
 *   3. all listeners are scoped to the app window and removed by destroy();
 *      timeouts are tracked so a closing window cannot fire callbacks into a
 *      torn-down board;
 *   4. animation clones (`.moving`) are appended to the window, not
 *      `document.body` — the stylesheet is scoped to `#solitaireApp`, so a
 *      clone on the body would be unpainted (the "dragged card disappears"
 *      bug all over again);
 *   5. new: multi-level undo (upstream had one step), a Draw 1 / Draw 3
 *      toggle, a move counter, per-PC win/played tallies, and click-to-move
 *      (select a card, click a pile) so touch and trackpad users are not
 *      stuck with HTML5 drag-and-drop;
 *   6. the engine reports state through `onState`/`onWin` callbacks instead
 *      of writing into its own page chrome — the OS window owns the buttons.
 */

const STORE = {
  state: "solitaire.aash.state",
  high: "solitaire.aash.high",
  draw: "solitaire.aash.draw",
  tally: "solitaire.aash.tally",
};

const SUITS = ["♥", "♦", "♣", "♠"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const VALUE_MAP = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
};
const SUIT_TO_INDEX_MAP = { "♥": 0, "♦": 1, "♣": 2, "♠": 3 };
const UNDO_LIMIT = 200;

/* storage helpers — never throw, never assume storage exists */
const readLS = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};
const writeLS = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage denied (sandboxed frame / private mode) — the session just
       runs in memory, exactly like a fresh machine */
  }
};
const dropLS = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
};

export function createSolitaire(root, options = {}) {
  if (!root) throw new Error("createSolitaire: a root element is required");
  const onState = options.onState || (() => {});
  const onWin = options.onWin || (() => {});

  /* ------------------------------------------------------------------ *
   *  Board DOM (upstream's markup, built here instead of in index.html)
   * ------------------------------------------------------------------ */
  const container = document.createElement("div");
  container.id = "game-container";
  container.innerHTML = `
    <div class="game-board">
      <div class="top-piles">
        <div class="stock-waste-piles">
          <div id="stock-pile" class="pile stock" title="Click to draw"></div>
          <div id="waste-pile" class="pile waste"></div>
        </div>
        <div class="foundation-piles">
          <div id="foundation-0" data-suit="hearts" class="pile foundation hearts"></div>
          <div id="foundation-1" data-suit="diamonds" class="pile foundation diamonds"></div>
          <div id="foundation-2" data-suit="clubs" class="pile foundation clubs"></div>
          <div id="foundation-3" data-suit="spades" class="pile foundation spades"></div>
        </div>
      </div>
      <div class="tableau-piles">
        ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<div id="tableau-${i}" class="pile tableau-pile"></div>`).join("")}
      </div>
    </div>`;
  root.appendChild(container);

  const gameBoardEl = container.querySelector(".game-board");
  const stockPileEl = container.querySelector("#stock-pile");
  const wastePileEl = container.querySelector("#waste-pile");
  const foundationPileEls = [...container.querySelectorAll(".foundation-piles .pile")];
  const tableauPileEls = [...container.querySelectorAll(".tableau-piles .pile")];

  /* ------------------------------------------------------------------ *
   *  State (upstream's shape + the extras)
   * ------------------------------------------------------------------ */
  let stock = [];
  let waste = [];
  let foundations = [[], [], [], []];
  let tableau = [[], [], [], [], [], [], []];

  let initialGameState = {};
  let undoStack = [];
  let isAnimating = false;
  let destroyed = false;
  let score = 0;
  let highScore = readLS(STORE.high, 0) || 0;
  let drawCount = readLS(STORE.draw, 1) === 3 ? 3 : 1;
  let moves = 0;
  let won = false;

  /* wins / games started, per PC */
  let tally = readLS(STORE.tally, { won: 0, played: 0 }) || { won: 0, played: 0 };

  let draggedCards = [];
  let sourcePile = null;
  let sourceElement = null;
  let selection = null; // click-to-move: { ...sourcePile, cards: [...] }

  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  /* card offset inside a tableau pile — read from CSS so the host can scale
     the board without the engine having to know about pixels */
  const stackStep = () => {
    const v = parseFloat(getComputedStyle(root).getPropertyValue("--stack-offset"));
    return Number.isFinite(v) && v > 0 ? v : 30;
  };
  const cssMs = (name, fallback) => {
    const v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  const pileCounts = () => ({
    stock: stock.length,
    waste: waste.length,
    foundations: foundations.map((p) => p.length),
    tableau: tableau.map((p) => p.length),
    total:
      stock.length +
      waste.length +
      foundations.reduce((n, p) => n + p.length, 0) +
      tableau.reduce((n, p) => n + p.length, 0),
  });

  const emit = () => {
    if (destroyed) return;
    try {
      container.dataset.piles = JSON.stringify(pileCounts());
    } catch (e) {}
    onState({
      score,
      highScore,
      moves,
      won,
      canUndo: undoStack.length > 0,
      canAutoComplete: isAutoCompleteAvailable(),
      drawCount,
      played: tally.played,
      wins: tally.won,
    });
  };

  /* ------------------------------------------------------------------ *
   *  Deck, deal, save / load  (upstream logic)
   * ------------------------------------------------------------------ */
  function createDeck() {
    return SUITS.flatMap((suit) =>
      VALUES.map((value) => ({
        suit,
        value,
        color: suit === "♥" || suit === "♦" ? "red" : "black",
        faceUp: false,
      })),
    );
  }

  function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function dealCards(deck) {
    for (let i = 0; i < 7; i++) {
      for (let j = i; j < 7; j++) tableau[j].push(deck.pop());
    }
    tableau.forEach((pile) => {
      if (pile.length > 0) pile[pile.length - 1].faceUp = true;
    });
    stock = deck;
  }

  function saveInitialState() {
    initialGameState = {
      stock: JSON.parse(JSON.stringify(stock)),
      tableau: JSON.parse(JSON.stringify(tableau)),
    };
  }

  function startGame() {
    dropLS(STORE.state);
    stock = [];
    waste = [];
    foundations = [[], [], [], []];
    tableau = [[], [], [], [], [], [], []];
    undoStack = [];
    selection = null;
    isAnimating = false;
    won = false;
    moves = 0;
    score = 0;
    tally = { ...tally, played: tally.played + 1 };
    writeLS(STORE.tally, tally);
    updateScore(0);

    dealCards(shuffleDeck(createDeck()));
    saveInitialState();
    renderAll();
    saveGameState();
    emit();
  }

  function restartGame() {
    if (!initialGameState.stock || !initialGameState.tableau) return;
    dropLS(STORE.state);
    stock = JSON.parse(JSON.stringify(initialGameState.stock));
    tableau = JSON.parse(JSON.stringify(initialGameState.tableau));
    waste = [];
    foundations = [[], [], [], []];
    undoStack = [];
    selection = null;
    isAnimating = false;
    won = false;
    moves = 0;
    score = 0;
    updateScore(0);
    renderAll();
    saveGameState();
    emit();
  }

  function saveGameState() {
    if (won) return;
    writeLS(STORE.state, { stock, waste, foundations, tableau, score, moves, hasSavedGame: true });
  }

  function loadGameState() {
    const gameState = readLS(STORE.state, null);
    if (!gameState || !gameState.hasSavedGame) return false;
    try {
      stock = gameState.stock || [];
      waste = gameState.waste || [];
      foundations = gameState.foundations || [[], [], [], []];
      tableau = gameState.tableau || [[], [], [], [], [], [], []];
      score = gameState.score || 0;
      moves = gameState.moves || 0;
      updateScore(0);
      renderAll();
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ *
   *  Rendering (upstream logic; clones are hosted by the window)
   * ------------------------------------------------------------------ */
  function renderAll() {
    renderStock();
    renderWaste();
    renderFoundations();
    renderTableau();
    applySelection();
    emit();
  }

  function createCardElement(card) {
    const cardEl = document.createElement("div");
    cardEl.classList.add("card", card.color);
    cardEl.dataset.value = card.value;
    cardEl.dataset.suit = card.suit;

    if (card.faceUp) {
      cardEl.innerHTML = `
        <span class="card-corner top">${card.value}${card.suit}</span>
        <span class="card-suit-main">${card.suit}</span>
        <span class="card-corner bottom">${card.value}${card.suit}</span>`;
      cardEl.draggable = true;
    } else {
      cardEl.classList.add("face-down");
    }
    return cardEl;
  }

  function renderStock() {
    stockPileEl.innerHTML = "";
    stockPileEl.classList.toggle("empty", stock.length === 0);
    if (stock.length > 0) stockPileEl.appendChild(createCardElement(stock[stock.length - 1]));
  }

  function renderWaste() {
    wastePileEl.innerHTML = "";
    if (waste.length > 0) wastePileEl.appendChild(createCardElement(waste[waste.length - 1]));
  }

  function renderFoundations() {
    foundationPileEls.forEach((pileEl, index) => {
      pileEl.innerHTML = "";
      const pile = foundations[index];
      if (pile.length > 0) pileEl.appendChild(createCardElement(pile[pile.length - 1]));
    });
  }

  function renderTableau() {
    const step = stackStep();
    tableauPileEls.forEach((pileEl, index) => {
      pileEl.innerHTML = "";
      tableau[index].forEach((card, cardIndex) => {
        const cardEl = createCardElement(card);
        cardEl.style.top = `${cardIndex * step}px`;
        pileEl.appendChild(cardEl);
      });
    });
  }

  function applySelection() {
    if (!selection) return;
    const el = pileElFor(selection);
    if (!el) return;
    const cards = [...el.children];
    /* mark the selected run: from the clicked card to the end of the pile */
    const from =
      selection.type === "tableau" ? cards.length - selection.cards.length : cards.length - 1;
    cards.forEach((c, i) => c.classList.toggle("selected", i >= from));
  }

  const pileElFor = (src) => {
    if (!src) return null;
    if (src.type === "waste") return wastePileEl;
    if (src.type === "foundation") return foundationPileEls[src.index];
    return tableauPileEls[src.index];
  };

  /* ------------------------------------------------------------------ *
   *  Rules & scoring (upstream logic)
   * ------------------------------------------------------------------ */
  function updateScore(change) {
    score = Math.max(0, score + change);
    if (score > highScore) {
      highScore = score;
      writeLS(STORE.high, highScore);
    }
    emit();
  }

  function pushUndo() {
    undoStack.push({
      stock: JSON.parse(JSON.stringify(stock)),
      waste: JSON.parse(JSON.stringify(waste)),
      foundations: JSON.parse(JSON.stringify(foundations)),
      tableau: JSON.parse(JSON.stringify(tableau)),
      score,
      moves,
    });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  function undoMove() {
    if (!undoStack.length || isAnimating) return;
    const s = undoStack.pop();
    stock = s.stock;
    waste = s.waste;
    foundations = s.foundations;
    tableau = s.tableau;
    score = s.score;
    moves = s.moves;
    selection = null;
    updateScore(0);
    renderAll();
    saveGameState();
  }

  const canPlaceOnFoundation = (card, foundationPile) => {
    const topCard = foundationPile.length > 0 ? foundationPile[foundationPile.length - 1] : null;
    const cardValue = VALUE_MAP[card.value];
    if (!topCard) return cardValue === 1;
    return card.suit === topCard.suit && cardValue === VALUE_MAP[topCard.value] + 1;
  };

  const canPlaceOnTableau = (cards, tableauPile) => {
    const movingCard = cards[0];
    const topCard = tableauPile.length > 0 ? tableauPile[tableauPile.length - 1] : null;
    if (!topCard) return VALUE_MAP[movingCard.value] === 13;
    return (
      movingCard.color !== topCard.color &&
      VALUE_MAP[movingCard.value] === VALUE_MAP[topCard.value] - 1
    );
  };

  const findFoundationIndexFor = (card) => SUIT_TO_INDEX_MAP[card.suit];

  function flipTopTableauCard(pile, pileEl) {
    return new Promise((resolve) => {
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        if (!topCard.faceUp) {
          updateScore(5);
          topCard.faceUp = true;
          const cardEl = pileEl.children[pile.length - 1];
          if (cardEl && cardEl.classList.contains("face-down")) {
            const flip = cssMs("--animation-speed-ms", 200);
            cardEl.classList.add("flipping");
            later(() => {
              cardEl.classList.remove("face-down");
              cardEl.draggable = true;
              cardEl.innerHTML = `
                <span class="card-corner top">${topCard.value}${topCard.suit}</span>
                <span class="card-suit-main">${topCard.suit}</span>
                <span class="card-corner bottom">${topCard.value}${topCard.suit}</span>`;
            }, flip / 2);
            later(() => {
              cardEl.classList.remove("flipping");
              resolve(true);
            }, flip);
            return;
          }
        }
      }
      resolve(false);
    });
  }

  function checkWinCondition() {
    const total = foundations.reduce((sum, pile) => sum + pile.length, 0);
    if (total === 52 && !won) {
      won = true;
      dropLS(STORE.state);
      tally = { ...tally, won: tally.won + 1 };
      writeLS(STORE.tally, tally);
      emit();
      later(() => onWin({ score, moves }), 400);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Moves — one implementation, used by drop, double-click and click
   * ------------------------------------------------------------------ */
  function tryMove(src, cards, targetEl) {
    if (!targetEl || !src || !cards || !cards.length) return false;
    const targetId = targetEl.id;

    if (targetId.startsWith("foundation")) {
      const idx = parseInt(targetId.split("-")[1], 10);
      const card = cards[0];
      if (
        cards.length !== 1 ||
        findFoundationIndexFor(card) !== idx ||
        !canPlaceOnFoundation(card, foundations[idx])
      ) {
        return false;
      }
      pushUndo();
      foundations[idx].push(card);
      if (src.type === "waste") waste.pop();
      else if (src.type === "foundation") foundations[src.index].pop();
      else tableau[src.index].splice(-1);
      updateScore(15);
      moves++;
      afterMove(src);
      return true;
    }

    if (targetId.startsWith("tableau")) {
      const idx = parseInt(targetId.split("-")[1], 10);
      if (idx === src.index && src.type === "tableau") return false;
      if (!canPlaceOnTableau(cards, tableau[idx])) return false;
      pushUndo();
      tableau[idx].push(...cards);
      if (src.type === "waste") {
        waste.pop();
        updateScore(5);
      } else if (src.type === "foundation") {
        foundations[src.index].pop();
        updateScore(-15);
      } else {
        tableau[src.index].splice(-cards.length);
      }
      moves++;
      afterMove(src);
      return true;
    }
    return false;
  }

  async function afterMove(src) {
    if (src.type === "tableau") {
      await flipTopTableauCard(tableau[src.index], tableauPileEls[src.index]);
    }
    renderAll();
    saveGameState();
    checkWinCondition();
  }

  /* ------------------------------------------------------------------ *
   *  Animations (upstream logic; the clone lives inside the window)
   * ------------------------------------------------------------------ */
  function animateCardMove(cardEl, targetEl, targetPileLength) {
    return new Promise((resolve) => {
      const rootRect = root.getBoundingClientRect();
      const startRect = cardEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      /* cloned cards fly inside `root` (position: absolute), so a transform
         anywhere above the window cannot drag the animation off target */
      const startTop = startRect.top - rootRect.top;
      const startLeft = startRect.left - rootRect.left;
      let targetTop = targetRect.top - rootRect.top;
      const targetLeft = targetRect.left - rootRect.left;
      if (targetEl.id.startsWith("tableau")) {
        targetTop += targetPileLength * stackStep();
      }

      const movingEl = cardEl.cloneNode(true);
      movingEl.classList.add("moving");
      root.appendChild(movingEl); // inside the window — see file header note 4
      movingEl.style.top = `${startTop}px`;
      movingEl.style.left = `${startLeft}px`;

      cardEl.classList.add("ghost");
      requestAnimationFrame(() => {
        movingEl.style.top = `${targetTop}px`;
        movingEl.style.left = `${targetLeft}px`;
      });

      later(
        () => {
          if (movingEl.parentNode) movingEl.parentNode.removeChild(movingEl);
          cardEl.classList.remove("ghost");
          resolve();
        },
        cssMs("--move-animation-speed-ms", 300),
      );
    });
  }

  function isAutoCompleteAvailable() {
    const noStock = stock.length === 0 && waste.length === 0;
    const allFaceUp = tableau.every((pile) => pile.every((card) => card.faceUp));
    return noStock && allFaceUp;
  }

  async function startAutoComplete() {
    if (isAnimating) return;
    isAnimating = true;
    emit();
    pushUndo();
    let found = true;
    while (found && !destroyed) {
      found = false;
      for (let i = 0; i < tableau.length; i++) {
        if (tableau[i].length > 0) {
          const card = tableau[i][tableau[i].length - 1];
          const fi = findFoundationIndexFor(card);
          if (canPlaceOnFoundation(card, foundations[fi])) {
            updateScore(15);
            await animateCardMove(tableauPileEls[i].lastElementChild, foundationPileEls[fi], 0);
            if (destroyed) return;
            foundations[fi].push(tableau[i].pop());
            moves++;
            renderAll();
            found = true;
            break;
          }
        }
      }
    }
    isAnimating = false;
    checkWinCondition();
    emit();
  }

  /* ------------------------------------------------------------------ *
   *  Hint (upstream's search, unchanged)
   * ------------------------------------------------------------------ */
  function findHint() {
    if (waste.length > 0) {
      const card = waste[waste.length - 1];
      const fi = findFoundationIndexFor(card);
      if (canPlaceOnFoundation(card, foundations[fi])) {
        return { sourceEl: wastePileEl.firstElementChild, targetEl: foundationPileEls[fi] };
      }
    }
    for (let i = 0; i < tableau.length; i++) {
      if (tableau[i].length > 0) {
        const card = tableau[i][tableau[i].length - 1];
        const fi = findFoundationIndexFor(card);
        if (canPlaceOnFoundation(card, foundations[fi])) {
          return { sourceEl: tableauPileEls[i].lastElementChild, targetEl: foundationPileEls[fi] };
        }
      }
    }
    if (waste.length > 0) {
      const card = waste[waste.length - 1];
      for (let i = 0; i < tableau.length; i++) {
        if (canPlaceOnTableau([card], tableau[i])) {
          return { sourceEl: wastePileEl.firstElementChild, targetEl: tableauPileEls[i] };
        }
      }
    }
    for (let i = 0; i < tableau.length; i++) {
      if (tableau[i].length > 0) {
        for (let j = 0; j < tableau[i].length; j++) {
          if (tableau[i][j].faceUp) {
            const stackToMove = tableau[i].slice(j);
            for (let k = 0; k < tableau.length; k++) {
              if (i === k) continue;
              if (canPlaceOnTableau(stackToMove, tableau[k])) {
                return { sourceEl: tableauPileEls[i].children[j], targetEl: tableauPileEls[k] };
              }
            }
          }
        }
      }
    }
    if (stock.length > 0) return { sourceEl: stockPileEl, targetEl: wastePileEl };
    if (stock.length === 0 && waste.length > 0)
      return { sourceEl: stockPileEl, targetEl: stockPileEl };
    return null;
  }

  function showHint() {
    if (isAnimating) return false;
    const hint = findHint();
    if (!hint) return false;
    updateScore(-5);
    const { sourceEl, targetEl } = hint;
    if (sourceEl) sourceEl.classList.add("hint-highlight");
    if (targetEl) targetEl.classList.add("hint-highlight");
    later(() => {
      if (sourceEl) sourceEl.classList.remove("hint-highlight");
      if (targetEl) targetEl.classList.remove("hint-highlight");
    }, 700);
    return true;
  }

  /* ------------------------------------------------------------------ *
   *  Event handlers (scoped to the window; removed by destroy)
   * ------------------------------------------------------------------ */
  const isEl = (t) => !!t && typeof t.matches === "function";
  const inRoot = (t) => isEl(t) && root.contains(t);

  const onStockClick = (e) => {
    if (isAnimating || !inRoot(e.target)) return;
    pushUndo();
    selection = null;
    if (stock.length > 0) {
      const n = Math.min(drawCount, stock.length);
      for (let i = 0; i < n; i++) {
        const card = stock.pop();
        card.faceUp = true;
        waste.push(card);
      }
    } else if (waste.length > 0) {
      stock = waste.reverse().map((card) => ({ ...card, faceUp: false }));
      waste = [];
    }
    moves++;
    renderAll();
    saveGameState();
  };

  const onDragStart = (e) => {
    if (
      !inRoot(e.target) ||
      isAnimating ||
      !e.target.classList.contains("card") ||
      e.target.classList.contains("face-down")
    ) {
      e.preventDefault();
      return;
    }
    selection = null;
    sourceElement = e.target;
    later(() => sourceElement && sourceElement.classList.add("dragging"), 0);
    const parentId = sourceElement.parentElement.id;
    if (parentId.startsWith("tableau")) {
      const pileIndex = parseInt(parentId.split("-")[1], 10);
      const cardIndex = [...sourceElement.parentElement.children].indexOf(sourceElement);
      sourcePile = { type: "tableau", index: pileIndex };
      draggedCards = tableau[pileIndex].slice(cardIndex);
    } else if (parentId === "waste-pile") {
      sourcePile = { type: "waste" };
      draggedCards = [waste[waste.length - 1]];
    } else if (parentId.startsWith("foundation")) {
      const pileIndex = parseInt(parentId.split("-")[1], 10);
      sourcePile = { type: "foundation", index: pileIndex };
      draggedCards = [foundations[pileIndex][foundations[pileIndex].length - 1]];
    }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", "");
      } catch (err) {}
    }
  };

  const onDragOver = (e) => {
    if (!inRoot(e.target)) return;
    e.preventDefault();
    const pileEl = isEl(e.target) ? e.target.closest(".pile") : null;
    if (!pileEl) return;
    /* the pile the drag came from is not a drop target for itself */
    if (sourceElement && sourceElement.parentElement === pileEl) return;
    pileEl.classList.add("drag-over");
  };

  const onDragLeave = (e) => {
    if (!inRoot(e.target)) return;
    const pileEl = isEl(e.target) ? e.target.closest(".pile") : null;
    pileEl && pileEl.classList.remove("drag-over");
  };

  const onDragEnd = () => {
    if (sourceElement) sourceElement.classList.remove("dragging");
    root.querySelectorAll(".pile.drag-over").forEach((el) => el.classList.remove("drag-over"));
    sourceElement = null;
    sourcePile = null;
    draggedCards = [];
  };

  const onDrop = async (e) => {
    if (!inRoot(e.target)) return;
    e.preventDefault();
    if (isAnimating) return;
    const dropTarget = isEl(e.target) ? e.target.closest(".pile") : null;
    if (!dropTarget || !sourcePile) return;
    const src = sourcePile;
    const cards = draggedCards;
    onDragEnd();
    tryMove(src, cards, dropTarget);
  };

  /* click-to-move: pick a card up, click the pile you want it on */
  const onBoardClick = (e) => {
    if (!inRoot(e.target) || isAnimating) return;
    const pileEl = isEl(e.target) ? e.target.closest(".pile") : null;
    if (!pileEl) return;
    if (pileEl === stockPileEl) return; // the stock has its own handler
    const cardEl = isEl(e.target) ? e.target.closest(".card") : null;

    if (selection) {
      const same = cardEl && pileElFor(selection) === pileEl && selection.tapped === cardEl;
      if (same) {
        /* tapping the selected card again clears it */
        selection = null;
        root.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
        return;
      }
      const target = pileEl; /* note: an invalid move simply clears the selection below */
      if (tryMove(selection, selection.cards, target)) {
        selection = null;
        return;
      }
      if (cardEl && !cardEl.classList.contains("face-down")) {
        selectFromClick(cardEl, pileEl);
        return;
      }
      selection = null;
      root.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
      return;
    }

    if (cardEl && !cardEl.classList.contains("face-down")) selectFromClick(cardEl, pileEl);
  };

  function selectFromClick(cardEl, pileEl) {
    const pileId = pileEl.id;
    if (pileId.startsWith("tableau")) {
      const pileIndex = parseInt(pileId.split("-")[1], 10);
      const cardIndex = [...pileEl.children].indexOf(cardEl);
      const card = tableau[pileIndex][cardIndex];
      if (!card || !card.faceUp) return;
      selection = {
        type: "tableau",
        index: pileIndex,
        cards: tableau[pileIndex].slice(cardIndex),
        tapped: cardEl,
      };
    } else if (pileId.startsWith("foundation")) {
      const pileIndex = parseInt(pileId.split("-")[1], 10);
      const pile = foundations[pileIndex];
      if (!pile.length) return;
      selection = {
        type: "foundation",
        index: pileIndex,
        cards: [pile[pile.length - 1]],
        tapped: cardEl,
      };
    } else if (pileId === "waste-pile") {
      if (!waste.length) return;
      selection = { type: "waste", cards: [waste[waste.length - 1]], tapped: cardEl };
    } else {
      return;
    }
    applySelection();
  }

  const onBoardDblClick = async (e) => {
    if (!inRoot(e.target) || isAnimating) return;
    const cardEl = isEl(e.target) ? e.target.closest(".card") : null;
    if (!cardEl || cardEl.classList.contains("face-down")) return;
    selection = null;
    const parentId = cardEl.parentElement.id;
    let card = null;
    let source = null;
    let sourceEl = null;

    if (parentId === "waste-pile" && waste.length > 0) {
      card = waste[waste.length - 1];
      source = { type: "waste" };
      sourceEl = wastePileEl.firstElementChild;
    } else if (parentId.startsWith("tableau")) {
      const pileIndex = parseInt(parentId.split("-")[1], 10);
      const pile = tableau[pileIndex];
      if (pile.length > 0 && cardEl === tableauPileEls[pileIndex].lastElementChild) {
        card = pile[pile.length - 1];
        source = { type: "tableau", index: pileIndex };
        sourceEl = tableauPileEls[pileIndex].lastElementChild;
      }
    }
    if (!card || !sourceEl) return;

    const fi = findFoundationIndexFor(card);
    if (!canPlaceOnFoundation(card, foundations[fi])) return;

    pushUndo();
    isAnimating = true;
    updateScore(15);
    moves++;
    await animateCardMove(sourceEl, foundationPileEls[fi], 0);
    if (destroyed) return;
    foundations[fi].push(card);
    if (source.type === "waste") waste.pop();
    else {
      tableau[source.index].pop();
      await flipTopTableauCard(tableau[source.index], tableauPileEls[source.index]);
    }
    isAnimating = false;
    renderAll();
    saveGameState();
    checkWinCondition();
  };

  stockPileEl.addEventListener("click", onStockClick);
  container.addEventListener("click", onBoardClick);
  container.addEventListener("dragstart", onDragStart);
  gameBoardEl.addEventListener("dragover", onDragOver);
  gameBoardEl.addEventListener("dragleave", onDragLeave);
  gameBoardEl.addEventListener("drop", onDrop);
  gameBoardEl.addEventListener("dragend", onDragEnd);
  gameBoardEl.addEventListener("dblclick", onBoardDblClick);

  /* ------------------------------------------------------------------ *
   *  Public handle
   * ------------------------------------------------------------------ */
  const api = {
    newGame: startGame,
    restart: restartGame,
    undo: undoMove,
    hint: () => {
      const ok = showHint();
      emit();
      return ok;
    },
    autoComplete: startAutoComplete,
    setDraw: (n) => {
      drawCount = n === 3 ? 3 : 1;
      writeLS(STORE.draw, drawCount);
      emit();
    },
    getState: () => ({
      score,
      highScore,
      moves,
      won,
      canUndo: undoStack.length > 0,
      canAutoComplete: isAutoCompleteAvailable(),
      drawCount,
      played: tally.played,
      wins: tally.won,
    }),
    destroy() {
      destroyed = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      stockPileEl.removeEventListener("click", onStockClick);
      container.removeEventListener("click", onBoardClick);
      container.removeEventListener("dragstart", onDragStart);
      gameBoardEl.removeEventListener("dragover", onDragOver);
      gameBoardEl.removeEventListener("dragleave", onDragLeave);
      gameBoardEl.removeEventListener("drop", onDrop);
      gameBoardEl.removeEventListener("dragend", onDragEnd);
      gameBoardEl.removeEventListener("dblclick", onBoardDblClick);
      container.remove();
    },
  };

  root.__solitaire = api; // handy in the console; removed with the node
  if (!loadGameState()) startGame();
  emit();
  return api;
}

export default createSolitaire;
