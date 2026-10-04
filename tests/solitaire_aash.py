"""Solitaire (AashishChakravarty/solitaire engine) acceptance test.

Runs against the real build served on :4180, in a real OS boot.

Sections
  A  the opening deal of a random game
  B  the board fits the OS window (and is not transform-scaled)
  C  the reported bug: a card must never vanish while it is dragged
  D  real, trusted drags — single card, and a whole run — on a hand-made deal
  E  click-to-move and double-click-to-foundation
  F  stock / waste, and the Draw 1 / Draw 3 toggle
  G  undo and hint
  H  restart, New game, auto-complete → win, close, re-open

Sections D–H run against a crafted deal (written straight into the engine's
localStorage slot) so the moves under test are guaranteed to exist; the rest of
the suite runs on whatever the shuffle produces.
"""
import os
_HERE = os.path.dirname(os.path.abspath(__file__))
import asyncio, hashlib, json
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:4180/index.html"
PW = "1234"
USER = {"username": "Tester", "setupComplete": True, "passwordHash": hashlib.sha256(PW.encode()).hexdigest()}
INIT = """
localStorage.setItem('wosUserMirror', JSON.stringify(%s));
localStorage.setItem('locked', 'false');
window.__ERRORS__ = [];
window.addEventListener('error', e => window.__ERRORS__.push('err: ' + String(e.message)));
window.addEventListener('unhandledrejection', e => window.__ERRORS__.push('rej: ' + String(e.reason)));
""" % json.dumps(USER)

RESULTS = []


def check(name, ok, extra=""):
    RESULTS.append((name, bool(ok)))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("   :: " + str(extra)) if extra else ""), flush=True)


PROBE = """
() => {
  const app = document.querySelector('#solitaireApp');
  if (!app) return { open: false };
  const host = app.querySelector('.solAash');
  const board = app.querySelector('.game-board');
  const container = app.querySelector('#game-container');
  const cards = [...(host ? host.querySelectorAll('.card') : [])];
  const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const piles = container && container.dataset.piles ? JSON.parse(container.dataset.piles) : null;
  const info = (el) => el ? { value: el.dataset.value, suit: el.dataset.suit,
                               faceDown: el.classList.contains('face-down') } : null;
  return {
    open: true, piles,
    hostRect: host ? rect(host) : null,
    boardRect: board ? rect(board) : null,
    cardRect: cards.length ? rect(cards[0]) : null,
    cardCount: cards.length,
    zeroSized: cards.filter((c) => { const r = rect(c); return r.w === 0 || r.h === 0; }).length,
    hidden: cards.filter((c) => getComputedStyle(c).visibility === 'hidden').length,
    ghosts: cards.filter((c) => c.classList.contains('ghost')).length,
    dragging: cards.filter((c) => c.classList.contains('dragging')).length,
    selected: cards.filter((c) => c.classList.contains('selected')).length,
    moving: document.querySelectorAll('.card.moving').length,
    hintHighlights: app.querySelectorAll('.hint-highlight').length,
    dragOver: app.querySelectorAll('.pile.drag-over').length,
    stockTop: info(app.querySelector('#stock-pile .card')),
    wasteTop: info(app.querySelector('#waste-pile .card')),
    foundationTops: [...app.querySelectorAll('.foundation-piles .pile')].map((p) => info(p.lastElementChild)),
    tableauTops: [...app.querySelectorAll('.tableau-pile')].map((p) => info(p.lastElementChild)),
    barTxt: (app.querySelector('.solBar')?.textContent || '').trim(),
    autoBtn: !!app.querySelector('.solBar button.accent'),
    toast: (app.querySelector('.solToast')?.textContent || '').trim(),
  };
}
"""

# a deal in which every move the tests make is guaranteed to be legal:
#   tableau-0 [K♠]            tableau-1 [x, Q♥]     tableau-2 [x,x,x, J♦]
#   tableau-3 [x,x, 10♥, A♥]  tableau-4 [x,x,x, K♦, Q♣]
#   tableau-5 [x,x,x,x,x, 3♥] tableau-6 [] (empty)
CRAFT = """
() => {
  const mk = (suit, value, faceUp) => ({ suit, value,
      color: (suit === '♥' || suit === '♦') ? 'red' : 'black', faceUp });
  const deck = [];
  for (const s of ['♠', '♥', '♦', '♣'])
    for (const v of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) deck.push([s, v]);
  const up = (suit, value) => {
    const i = deck.findIndex((c) => c[0] === suit && c[1] === value);
    deck.splice(i, 1);
    return mk(suit, value, true);
  };
  const filler = (n) => Array.from({ length: n }, () => { const c = deck.pop(); return mk(c[0], c[1], false); });
  const tableau = [
    [up('♠', 'K')],
    [...filler(1), up('♥', 'Q')],
    [...filler(3), up('♦', 'J')],
    [...filler(2), up('♥', '10'), up('♥', 'A')],
    [...filler(3), up('♦', 'K'), up('♣', 'Q')],
    [...filler(5), up('♥', '3')],
    [],
  ];
  const stock = filler(deck.length);
  const state = { stock, waste: [], foundations: [[], [], [], []], tableau, score: 0, moves: 0, hasSavedGame: true };
  localStorage.setItem('solitaire.aash.state', JSON.stringify(state));
  return { stock: stock.length, tableau: tableau.map((p) => p.length) };
}
"""

# every card but the spades sits in the foundations; the spades are stacked
# face-up in one column, so Auto-complete has a clean run to the win
CRAFT_WIN = """
() => {
  const mk = (suit, value, faceUp) => ({ suit, value,
      color: (suit === '♥' || suit === '♦') ? 'red' : 'black', faceUp });
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const foundation = (s) => values.map((v) => mk(s, v, true));
  /* columns must be built A→K from the top, so store them reversed */
  const spades = values.map((v) => mk('♠', v, true)).reverse();
  const tableau = [spades, [], [], [], [], [], []];
  const state = {
    stock: [], waste: [],
    foundations: [foundation('♥'), foundation('♦'), foundation('♣'), []],
    tableau, score: 0, moves: 0, hasSavedGame: true,
  };
  localStorage.setItem('solitaire.aash.state', JSON.stringify(state));
  return true;
}
"""


async def boot(page):
    await page.goto(URL, wait_until="domcontentloaded")
    await page.wait_for_timeout(3500)
    if await page.query_selector(".lockscreen"):
        await page.click(".lockscreen", position={"x": 700, "y": 300})
        await page.wait_for_timeout(800)
        await page.keyboard.type(PW)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(2600)
    if await page.is_visible(".aboutApp"):
        await page.click(".aboutApp .okbtn div", timeout=8000)
    await page.wait_for_timeout(400)


async def open_game(page):
    if await page.query_selector("#solitaireApp"):
        await page.click("#solitaireApp .closeBtn", timeout=6000)
        await page.wait_for_timeout(900)
    await page.evaluate("window.__wosStore.dispatch({type:'SOLITAIREAPP', payload:'full'})")
    await page.wait_for_selector("#solitaireApp .solAash", timeout=10000)
    await page.wait_for_timeout(400)


async def deal(page, timeout=20):
    waited = 0
    while waited < timeout * 1000:
        st = await page.evaluate(PROBE)
        p = st.get("piles")
        if p and p["stock"] >= 24 and p["tableau"] == [1, 2, 3, 4, 5, 6, 7]:
            return st
        await page.wait_for_timeout(300)
        waited += 300
    return await page.evaluate(PROBE)


async def drag_mouse(page, src_sel, dst_sel, hold_ms=90, grab_from_top=None):
    """A real, trusted HTML5 drag: press, move in small steps, release.

    `grab_from_top` presses that many pixels below the source card's top edge —
    the exposed strip of a card that sits at the head of a stack (its centre is
    covered by the cards below it, exactly like a real hand of cards).
    """
    b1 = await page.locator(src_sel).bounding_box()
    b2 = await page.locator(dst_sel).bounding_box()
    if not b1 or not b2:
        raise RuntimeError(f"no box for {src_sel!r} / {dst_sel!r}")
    cx = b1["x"] + b1["width"] / 2
    cy = b1["y"] + (grab_from_top if grab_from_top else b1["height"] / 2)
    tx, ty = b2["x"] + b2["width"] / 2, b2["y"] + b2["height"] / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.wait_for_timeout(hold_ms)
    for k in range(1, 13):
        await page.mouse.move(cx + (tx - cx) * k / 12, cy + (ty - cy) * k / 12, steps=2)
        await page.wait_for_timeout(45)
    await page.mouse.up()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900})
        await ctx.add_init_script(INIT)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("  PAGEERROR", str(e)[:200], flush=True))
        page.on("console", lambda m: m.type == "error" and "404" not in m.text
               and print("  CONSOLE-ERR", m.text[:200], flush=True))

        await boot(page)

        print("\n[A] the opening deal", flush=True)
        await open_game(page)
        st = await deal(page)
        print("   piles:", st.get("piles"), flush=True)
        check("the window opens with the engine's board", st["open"] and st["cardCount"] > 0, st.get("hostRect"))
        check("stock holds 24 after the deal", st["piles"]["stock"] == 24, st["piles"]["stock"])
        check("tableau piles hold 1..7", st["piles"]["tableau"] == [1, 2, 3, 4, 5, 6, 7], st["piles"]["tableau"])
        check("all 52 cards are in play", st["piles"]["total"] == 52, st["piles"]["total"])
        check("28 tableau cards + the stock card are rendered", st["cardCount"] == 29, st["cardCount"])
        check("no card is zero-sized", st["zeroSized"] == 0, st["zeroSized"])
        check("the top card of every tableau pile is face-up",
              sum(1 for t in st["tableauTops"] if t and not t["faceDown"]) == 7)
        check("foundations start empty", st["piles"]["foundations"] == [0, 0, 0, 0])

        print("\n[B] the board fits the OS window", flush=True)
        hr, br = st["hostRect"], st["boardRect"]
        check("board fits inside the window host", br["w"] <= hr["w"] + 2 and br["h"] <= hr["h"] + 40, f"board={br} host={hr}")
        check("cards are sized by the window", st["cardRect"]["w"] >= 56 and st["cardRect"]["h"] >= 78, st["cardRect"])
        check("the board is not transform-scaled (cards stay crisp)",
              await page.evaluate("getComputedStyle(document.querySelector('#solitaireApp .solAash')).transform") == "none")
        check("no card is hidden or ghosted at rest", st["hidden"] == 0 and st["ghosts"] == 0, st)

        print("\n[C] the drag itself — the reported bug", flush=True)
        await page.evaluate(
            """() => {
                const app = document.querySelector('#solitaireApp');
                const piles = [...app.querySelectorAll('.tableau-pile')];
                const pile = piles.find((p) => p.querySelectorAll('.card').length > 1) || piles[0];
                const card = [...pile.querySelectorAll('.card')].filter((c) => !c.classList.contains('face-down')).pop();
                window.__mid = { exists: !!card };
                if (!card) return;
                const dt = new DataTransfer();
                const r = card.getBoundingClientRect();
                card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt,
                    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
            }"""
        )
        await page.wait_for_timeout(120)  # the engine adds .dragging on the next tick
        mid = await page.evaluate(
            """() => {
                const app = document.querySelector('#solitaireApp');
                const card = app.querySelector('.card.dragging');
                const stillThere = document.querySelectorAll('.tableau-pile .card').length;
                if (!card) return { dragged: false, cards: stillThere };
                const r = card.getBoundingClientRect();
                const cs = getComputedStyle(card);
                return {
                    dragged: true, cards: stillThere,
                    inWindow: app.contains(card),
                    rect: { w: Math.round(r.width), h: Math.round(r.height) },
                    visibility: cs.visibility, opacity: cs.opacity, display: cs.display,
                    clones: document.querySelectorAll('.card.moving').length,
                    straysOnBody: document.querySelectorAll('body > .card').length,
                    faceStillPainted: cs.visibility === 'visible' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.1,
                };
            }"""
        )
        print("   mid-drag:", mid, flush=True)
        check("dragging marks the card and nothing else", mid.get("dragged") and mid.get("cards", 0) >= 28, mid)
        check("the dragged card stays painted (the reported bug)", mid.get("faceStillPainted"), mid)
        check("no clone or proxy is created for the drag, and nothing hits <body>",
              mid.get("clones") == 0 and mid.get("straysOnBody") == 0, mid)
        await page.screenshot(path=str(_HERE) + "/shot_aash_middrag.png")
        await page.evaluate(
            """() => {
                const card = document.querySelector('#solitaireApp .card.dragging');
                card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() }));
            }"""
        )
        await page.wait_for_timeout(500)
        st = await page.evaluate(PROBE)
        check("after dragend nothing is left ghosted, hidden or highlighted",
              st["ghosts"] == 0 and st["hidden"] == 0 and st["dragOver"] == 0 and st["dragging"] == 0, st)
        check("the board still totals 52", st["piles"]["total"] == 52)

        print("\n[D] real, trusted drags on a crafted deal", flush=True)
        print("   crafted:", await page.evaluate(CRAFT), flush=True)
        await open_game(page)  # re-open: the engine loads the crafted deal
        st = await page.evaluate(PROBE)
        check("the crafted deal loads", st["piles"]["tableau"] == [1, 2, 4, 4, 5, 6, 0] and st["piles"]["total"] == 52, st["piles"])

        # D1 — single card: Q♥ from tableau-1 onto K♠ in tableau-0
        await drag_mouse(page, "#solitaireApp #tableau-1 .card:last-child", "#solitaireApp #tableau-0 .card:last-child")
        await page.wait_for_timeout(1400)
        st = await page.evaluate(PROBE)
        check("a real drag moved the card onto the target pile",
              st["piles"]["tableau"] == [2, 1, 4, 4, 5, 6, 0], st["piles"]["tableau"])
        check("52 cards are still accounted for", st["piles"]["total"] == 52, st["piles"]["total"])
        check("nothing is left ghosted / in flight / dimmed after the drop",
              st["ghosts"] == 0 and st["moving"] == 0 and st["dragging"] == 0 and st["hidden"] == 0, st)
        check("the move counted and scored", "1 move" in st["barTxt"] and "Score 0" not in st["barTxt"], st["barTxt"][-46:])

        # D2 — a whole run: grab the K♦ that heads the [K♦, Q♣] run in tableau-4
        #      and drop the pair on the empty tableau-6
        await drag_mouse(page, "#solitaireApp #tableau-4 .card:nth-last-child(2)", "#solitaireApp #tableau-6",
                         grab_from_top=12)
        await page.wait_for_timeout(1600)
        st = await page.evaluate(PROBE)
        check("dragging a run moves both cards to the empty pile",
              st["piles"]["tableau"] == [2, 1, 4, 4, 3, 6, 2], st["piles"]["tableau"])
        check("the run's cards are the ones that moved",
              st["tableauTops"][6]["value"] == "Q" and st["tableauTops"][6]["suit"] == "♣", st["tableauTops"][6])
        check("nothing was lost in the run move", st["piles"]["total"] == 52 and st["ghosts"] == 0)

        print("\n[E] click-to-move and double-click to the foundation", flush=True)
        # E1 — click J♦ in tableau-2, then click the Q♣ that now heads tableau-6
        await page.click("#solitaireApp #tableau-2 .card:last-child", timeout=5000)
        await page.wait_for_timeout(250)
        st = await page.evaluate(PROBE)
        check("clicking a card selects it", st["selected"] >= 1, st["selected"])
        await page.click("#solitaireApp #tableau-6 .card:last-child", position={"x": 30, "y": 30}, timeout=5000)
        await page.wait_for_timeout(1000)
        st = await page.evaluate(PROBE)
        check("clicking the target pile completes the move",
              st["piles"]["tableau"] == [2, 1, 3, 4, 3, 6, 3] and st["selected"] == 0, st["piles"]["tableau"])
        # E2 — double-click the A♥ in tableau-3 home to the hearts foundation
        await page.dblclick("#solitaireApp #tableau-3 .card:last-child", timeout=5000)
        await page.wait_for_timeout(1200)
        st = await page.evaluate(PROBE)
        check("double-click sends the ace to its foundation",
              st["piles"]["foundations"] == [1, 0, 0, 0] and st["piles"]["tableau"][3] == 3, st["piles"])

        print("\n[F] stock / waste / the Draw toggle", flush=True)
        await page.click("#solitaireApp .solBar button:has-text('New game')", timeout=5000)
        await page.wait_for_timeout(400)
        st = await deal(page)
        check("New game deals a fresh, full table", st["piles"]["total"] == 52 and st["piles"]["tableau"] == [1, 2, 3, 4, 5, 6, 7], st["piles"])
        check("Draw 1 is the default", "Draw 1" in st["barTxt"] and st["piles"]["stock"] == 24)
        await page.click("#solitaireApp #stock-pile", position={"x": 20, "y": 20}, timeout=6000)
        await page.wait_for_timeout(600)
        st = await page.evaluate(PROBE)
        check("at Draw 1, clicking the stock turns exactly one card",
              st["piles"]["waste"] == 1 and st["piles"]["stock"] == 23, st["piles"])
        check("the waste card is face-up", st["wasteTop"] and not st["wasteTop"]["faceDown"], st["wasteTop"])
        await page.click("#solitaireApp .solBar button:has-text('Draw 3')", timeout=5000)
        await page.wait_for_timeout(250)
        st = await page.evaluate(PROBE)
        check("choosing Draw 3 is reflected in the bar", "Draw 3" in st["barTxt"] and st["piles"]["waste"] == 1, st["barTxt"][-30:])
        await page.click("#solitaireApp #stock-pile", position={"x": 20, "y": 20}, timeout=6000)
        await page.wait_for_timeout(700)
        st = await page.evaluate(PROBE)
        check("at Draw 3, clicking the stock turns three cards",
              st["piles"]["waste"] == 4 and st["piles"]["stock"] == 20, st["piles"])
        await page.click("#solitaireApp .solBar button:has-text('Draw 1')", timeout=5000)
        await page.wait_for_timeout(250)
        await page.click("#solitaireApp #stock-pile", position={"x": 20, "y": 20}, timeout=6000)
        await page.wait_for_timeout(600)
        st = await page.evaluate(PROBE)
        check("switching back to Draw 1 turns a single card again",
              st["piles"]["waste"] == 5 and st["piles"]["stock"] == 19, st["piles"])

        print("\n[G] undo and hint", flush=True)
        before = await page.evaluate(PROBE)
        await page.click("#solitaireApp .solBar button:has-text('↶')", timeout=5000)
        await page.wait_for_timeout(700)
        after = await page.evaluate(PROBE)
        check("undo takes the last stock flip back", after["piles"]["waste"] == 4 and after["piles"]["stock"] == 20,
              f"{before['piles']} -> {after['piles']}")
        check("undo keeps the deck whole", after["piles"]["total"] == 52)
        undo = await page.evaluate("() => document.querySelector('#solitaireApp .solAash').__solitaire.getState()")
        check("the engine reports undo availability", undo["canUndo"] is True, undo)
        await page.click("#solitaireApp .solBar button:has-text('Hint')", timeout=5000)
        await page.wait_for_timeout(300)
        st = await page.evaluate(PROBE)
        check("the hint highlights a move on the board",
              st["hintHighlights"] >= 1 or "No moves" in st["barTxt"], f"highlights={st['hintHighlights']}")
        await page.wait_for_timeout(1500)
        st = await page.evaluate(PROBE)
        check("the hint highlight clears itself", st["hintHighlights"] == 0, st["hintHighlights"])

        print("\n[H] auto-complete to a win, then teardown and re-open", flush=True)
        print("   crafted win:", await page.evaluate(CRAFT_WIN), flush=True)
        await open_game(page)
        st = await page.evaluate(PROBE)
        check("a board that can be finished offers Auto-complete",
              st["autoBtn"] and st["piles"]["foundations"] == [13, 13, 13, 0], st["piles"])
        await page.click("#solitaireApp .solBar button:has-text('Auto-complete')", timeout=5000)
        won = False
        for _ in range(40):
            await page.wait_for_timeout(500)
            st = await page.evaluate(PROBE)
            if st["piles"]["foundations"] == [13, 13, 13, 13]:
                won = True
                break
        check("Auto-complete sends every card home", won, st["piles"])
        await page.wait_for_timeout(1200)  # the win toast follows the last animation
        st = await page.evaluate(PROBE)
        check("the win is announced in the window", "You win" in st["toast"], st["toast"][:60])
        check("the win is counted in the score bar", "W 1/" in st["barTxt"] or "W 2/" in st["barTxt"], st["barTxt"][-40:])
        check("nothing is left in flight after the win", st["moving"] == 0 and st["ghosts"] == 0, st)
        await page.screenshot(path=str(_HERE) + "/shot_aash_win.png")
        await page.click("#solitaireApp .solToast button", timeout=5000)
        await page.wait_for_timeout(1500)
        st = await page.evaluate(PROBE)
        check("Play again deals a fresh table", st["piles"]["total"] == 52 and not st["toast"], st["piles"])

        await page.click("#solitaireApp .closeBtn", timeout=6000)
        await page.wait_for_timeout(1200)
        check("closing the window destroys the board",
              await page.evaluate("!document.querySelector('#solitaireApp .solAash #game-container')"))
        await open_game(page)
        await page.wait_for_timeout(600)
        st = await page.evaluate(PROBE)
        check("re-opening restores a playable 52-card board", st["piles"]["total"] == 52, st["piles"])
        await page.click("#solitaireApp #stock-pile", position={"x": 20, "y": 20}, timeout=6000)
        await page.wait_for_timeout(600)
        st2 = await page.evaluate(PROBE)
        check("the re-opened board still responds to clicks (no leaked listeners)",
              st2["piles"]["stock"] == st["piles"]["stock"] - 1 and st2["piles"]["waste"] == st["piles"]["waste"] + 1,
              f"{st['piles']} -> {st2['piles']}")
        await page.click("#solitaireApp .closeBtn", timeout=6000)
        await page.wait_for_timeout(900)
        await open_game(page)
        await page.wait_for_timeout(600)
        st3 = await page.evaluate(PROBE)
        check("a second re-open is still exactly one board", st3["cardCount"] <= 30, st3["cardCount"])
        errs = await page.evaluate("window.__ERRORS__")
        check("no uncaught page errors during the whole run", len(errs) == 0, errs[:2])

        await page.screenshot(path=str(_HERE) + "/shot_aash_board.png")
        await b.close()

    bad = [n for n, ok in RESULTS if not ok]
    print(f"\n===== SUMMARY: {len(RESULTS) - len(bad)} passed / {len(bad)} failed =====", flush=True)
    for n in bad:
        print("  FAILED:", n, flush=True)


asyncio.run(main())
