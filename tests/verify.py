"""Verification harness for the four reported bugs. Prints PASS/FAIL per check."""
import os
_HERE = os.path.dirname(os.path.abspath(__file__))
import asyncio, hashlib, json, sys
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
    RESULTS.append((name, ok))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("   :: " + str(extra)) if extra else ""), flush=True)


CRAFT = """
() => {
  const mk = (suit, value, faceUp) => ({ suit, value,
      color: (suit === '♥' || suit === '♦') ? 'red' : 'black', faceUp });
  const deck = [];
  for (const s of ['♠', '♥', '♦', '♣'])
    for (const v of ['A','2','3','4','5','6','7','8','9','10','J','Q','K']) deck.push([s, v]);
  const up = (suit, value) => {
    const i = deck.findIndex((c) => c[0] === suit && c[1] === value);
    deck.splice(i, 1);
    return mk(suit, value, true);
  };
  const filler = (n) => Array.from({ length: n }, () => { const c = deck.pop(); return mk(c[0], c[1], false); });
  const tableau = [
    [up('♠','K')],
    [...filler(1), up('♥','Q')],
    [...filler(3), up('♦','J')],
    [...filler(2), up('♥','10'), up('♥','A')],
    [...filler(3), up('♦','K'), up('♣','Q')],
    [...filler(5), up('♥','3')],
    [],
  ];
  const stock = filler(deck.length);
  localStorage.setItem('solitaire.aash.state', JSON.stringify(
    { stock, waste: [], foundations: [[], [], [], []], tableau, score: 0, moves: 0, hasSavedGame: true }));
  return tableau.map((p) => p.length);
}
"""

SOL_PROBE = """
() => {
  const app = document.querySelector('#solitaireApp');
  if (!app) return { open: false };
  const host = app.querySelector('.solAash');
  const board = app.querySelector('.game-board');
  const container = app.querySelector('#game-container');
  const cards = [...(host ? host.querySelectorAll('.card') : [])];
  const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const piles = container && container.dataset.piles ? JSON.parse(container.dataset.piles) : null;
  return {
    open: true,
    piles,
    total: piles ? piles.total : cards.length,
    deck: piles ? piles.stock : 0,
    waste: piles ? piles.waste : 0,
    tableau: piles ? piles.tableau : [],
    found: piles ? piles.foundations : [],
    zeroSized: cards.filter(c => { const r = rect(c); return r.w === 0 || r.h === 0; }).length,
    ghosted: cards.filter(c => c.classList.contains('ghost')).length,
    hidden: cards.filter(c => getComputedStyle(c).visibility === 'hidden').length,
    dragging: cards.filter(c => c.classList.contains('dragging')).length,
    clone: !!document.querySelector('.card.moving'),
    straysOnBody: document.querySelectorAll('body > .card').length,
    boardRect: board ? rect(board) : null,
    wrapRect: host ? rect(host) : null,
    transform: host ? getComputedStyle(host).transform : null,
  };
}
"""


async def sol_deal(page, timeout=20):
    """Wait for the opening deal of the current game."""
    waited = 0
    while waited < timeout * 1000:
        st = await page.evaluate(SOL_PROBE)
        if st.get("open") and st["tableau"] == [1, 2, 3, 4, 5, 6, 7] and st["deck"] >= 24:
            return st
        await page.wait_for_timeout(300)
        waited += 300
    return await page.evaluate(SOL_PROBE)


async def sol_open(page):
    if await page.query_selector("#solitaireApp"):
        await page.click("#solitaireApp .closeBtn", timeout=6000)
        await page.wait_for_timeout(900)
    await page.evaluate("window.__wosStore.dispatch({type:'SOLITAIREAPP', payload:'full'})")
    await page.wait_for_selector("#solitaireApp .solAash", timeout=10000)
    await page.wait_for_timeout(400)


async def sol_drag(page, src_sel, dst_sel, grab_from_top=None):
    """A real, trusted HTML5 drag; grab_from_top presses the exposed head of a stack."""
    b1 = await page.locator(src_sel).bounding_box()
    b2 = await page.locator(dst_sel).bounding_box()
    if not b1 or not b2:
        raise RuntimeError(f"no box for {src_sel!r} / {dst_sel!r}")
    cx = b1["x"] + b1["width"] / 2
    cy = b1["y"] + (grab_from_top if grab_from_top else b1["height"] / 2)
    tx, ty = b2["x"] + b2["width"] / 2, b2["y"] + b2["height"] / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.wait_for_timeout(90)
    for k in range(1, 13):
        await page.mouse.move(cx + (tx - cx) * k / 12, cy + (ty - cy) * k / 12, steps=2)
        await page.wait_for_timeout(45)
    await page.mouse.up()


async def wait_for_github_tab(ctx, before, timeout=8000):
    """Count real browser tabs that finished pointing at github.com."""
    waited = 0
    while waited < timeout:
        tabs = [pg for pg in ctx.pages if "github.com" in pg.url]
        if len(tabs) >= before + 1:
            return tabs
        await asyncio.sleep(250)
        waited += 250
    return [pg for pg in ctx.pages if "github.com" in pg.url]


async def boot(page):
    await page.goto(URL, wait_until="domcontentloaded")
    await page.wait_for_timeout(3500)
    await unlock(page)
    await page.wait_for_timeout(2500)


async def unlock(page):
    if await page.query_selector(".lockscreen"):
        await page.click(".lockscreen", position={"x": 700, "y": 300})
        await page.wait_for_timeout(900)
        await page.keyboard.type(PW)
        await page.wait_for_timeout(200)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(2600)


async def dismiss_about(page):
    if await page.is_visible(".aboutApp"):
        await page.click(".aboutApp .okbtn div", timeout=8000)
        await page.wait_for_timeout(400)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        popups = []
        page.on("popup", lambda pg: popups.append(pg.url))
        page.on("pageerror", lambda e: print("  PAGEERROR", str(e)[:300], flush=True))
        await ctx.add_init_script(INIT)

        await boot(page)
        print("\n[A] About panel on boot", flush=True)
        check("about appears on cold boot", await page.is_visible(".aboutApp"))
        await dismiss_about(page)

        print("\n[B] Desktop right-click -> About", flush=True)
        await page.click(".desktop", position={"x": 900, "y": 600}, button="right")
        await page.wait_for_timeout(700)
        item = page.locator(".menuopt", has=page.locator(".nopt", has_text="About")).last
        await item.click(timeout=6000)
        await page.wait_for_timeout(800)
        check("about opens from desktop context menu", await page.is_visible(".aboutApp"))
        await page.click(".aboutApp .okbtn div", timeout=6000)
        await page.wait_for_timeout(400)
        check("right-click About closes at once (no boot delay)", not await page.is_visible(".aboutApp"))

        print("\n[C] About after a Restart", flush=True)
        await page.evaluate("window.__wosStore.dispatch({type:'WALLRESTART'})")
        await page.wait_for_timeout(13000)
        await unlock(page)
        await page.wait_for_timeout(2500)
        check("about appears again after restart", await page.is_visible(".aboutApp"))
        await dismiss_about(page)

        print("\n[D] Start menu -> Github (must open a REAL browser tab)", flush=True)
        before = len([pg for pg in ctx.pages if "github.com" in pg.url])
        await page.click(".tsIcon[data-action='STARTOGG']", timeout=6000)
        await page.wait_for_timeout(700)
        tile = page.locator(".pnApp[data-name='Github']")
        check("github tile present in start menu", await tile.count() > 0)
        await tile.first.click(timeout=6000)
        await page.wait_for_timeout(2000)
        check("start menu closes after clicking github", await page.get_attribute(".startMenu", "data-hide") == "true")
        gh = await wait_for_github_tab(ctx, before)
        check("real new tab opened in the browser", len(gh) == before + 1, f"tabs={len(gh)} popups={popups}")
        check("internal Edge app NOT opened", await page.evaluate("!window.__wosStore.getState().apps.edge.alive"))

        print("\n[E] Desktop Github icon (must open a REAL browser tab)", flush=True)
        before = len([pg for pg in ctx.pages if "github.com" in pg.url])
        await page.dblclick(".dskApp[data-name='Github']", timeout=6000)
        gh = await wait_for_github_tab(ctx, before)
        check("real new tab opened in the browser", len(gh) == before + 1, f"tabs={len(gh)}")
        check("internal Edge app NOT opened", await page.evaluate("!window.__wosStore.getState().apps.edge.alive"))

        print("\n[F] Solitaire — deal integrity", flush=True)
        await sol_open(page)
        st = await sol_deal(page)
        print("    stock:", st["deck"], "tableau:", st["tableau"], flush=True)
        check("solitaire deals 1..7 on the tableaux", st["tableau"] == [1, 2, 3, 4, 5, 6, 7], st["tableau"])
        check("solitaire stock holds 24 cards", st["deck"] == 24, st["deck"])
        check("52 cards on the table", st["total"] == 52, st["total"])
        check("no card is zero-sized", st["zeroSized"] == 0, st["zeroSized"])
        br, wr = st["boardRect"], st["wrapRect"]
        check("board is sized to fit the window",
              br["w"] <= wr["w"] + 2 and br["h"] <= wr["h"] + 40, f"board={br} host={wr}")
        check("the board is not transform-scaled (cards stay crisp)", st["transform"] == "none", st["transform"])

        print("\n[G] Solitaire — a dragged card must stay visible (the reported bug)", flush=True)
        await page.evaluate(
            """() => {
                const app = document.querySelector('#solitaireApp');
                const piles = [...app.querySelectorAll('.tableau-pile')];
                const pile = piles.find((p) => p.querySelectorAll('.card').length > 1) || piles[0];
                const card = [...pile.querySelectorAll('.card')].filter((c) => !c.classList.contains('face-down')).pop();
                if (!card) return;
                const dt = new DataTransfer();
                const r = card.getBoundingClientRect();
                card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt,
                    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
            }"""
        )
        await page.wait_for_timeout(120)
        mid = await page.evaluate(
            """() => {
                const card = document.querySelector('#solitaireApp .card.dragging');
                if (!card) return { dragged: false };
                const r = card.getBoundingClientRect();
                const cs = getComputedStyle(card);
                return {
                    dragged: true,
                    inWindow: document.querySelector('#solitaireApp').contains(card),
                    w: Math.round(r.width), h: Math.round(r.height),
                    visibility: cs.visibility, display: cs.display, opacity: cs.opacity,
                    painted: cs.visibility === 'visible' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.1,
                    clones: document.querySelectorAll('.card.moving').length,
                    straysOnBody: document.querySelectorAll('body > .card').length,
                };
            }"""
        )
        print("    mid-drag:", mid, flush=True)
        check("the card is marked as dragging", bool(mid.get("dragged")))
        check("the dragged card stays painted mid-drag", bool(mid.get("painted")), mid)
        check("it stays inside the game window", bool(mid.get("inWindow")))
        check("no drag proxy is created (and nothing is appended to <body>)",
              mid.get("clones") == 0 and mid.get("straysOnBody") == 0, mid)
        await page.evaluate(
            """() => { const c = document.querySelector('#solitaireApp .card.dragging');
                c.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() })); }"""
        )
        await page.wait_for_timeout(500)
        st2 = await page.evaluate(SOL_PROBE)
        check("nothing is left ghosted, hidden or dimmed after the drag", st2["ghosted"] == 0 and st2["hidden"] == 0, st2)

        print("\n[H] Solitaire — a real drag lands", flush=True)
        # a crafted deal where a legal move always exists: Q♥ onto K♠
        await page.evaluate(CRAFT)
        await sol_open(page)
        st = await page.evaluate(SOL_PROBE)
        check("the crafted deal loads", st["tableau"] == [1, 2, 4, 4, 5, 6, 0] and st["total"] == 52, st["tableau"])
        before = st["tableau"]
        try:
            await sol_drag(page, "#solitaireApp #tableau-1 .card:last-child", "#solitaireApp #tableau-0 .card:last-child")
        except Exception as e:
            print("    drag:", str(e)[:140], flush=True)
        await page.wait_for_timeout(1500)
        after = await page.evaluate(SOL_PROBE)
        print(f"    {before} -> {after['tableau']}", flush=True)
        check("a real drag moved the card", after["tableau"] == [2, 1, 4, 4, 5, 6, 0], after["tableau"])
        check("52 cards still on the table", after["total"] == 52, after["total"])
        check("nothing invisible or stuck after the drop",
              after["zeroSized"] == 0 and not after["clone"] and after["ghosted"] == 0 and after["dragging"] == 0)

        print("\n[I] Solitaire — window closes cleanly", flush=True)
        await page.click("#solitaireApp .closeBtn", timeout=6000)
        await page.wait_for_timeout(1000)
        check("closing the window removes the board", await page.evaluate("!document.querySelector('#solitaireApp .solAash #game-container')"))
        await sol_open(page)
        await page.wait_for_timeout(600)
        st3 = await page.evaluate(SOL_PROBE)
        check("re-opening still shows exactly 52 cards", st3["total"] == 52, st3["piles"])
        await page.click("#solitaireApp #stock-pile", position={"x": 20, "y": 20}, timeout=6000)
        await page.wait_for_timeout(600)
        st4 = await page.evaluate(SOL_PROBE)
        check("the re-opened board still responds to clicks",
              st4["deck"] == st3["deck"] - 1 and st4["waste"] == st3["waste"] + 1, f"{st3['piles']} -> {st4['piles']}")
        await page.click("#solitaireApp .closeBtn", timeout=6000)
        await page.wait_for_timeout(800)

        errs = await page.evaluate("window.__ERRORS__")
        if errs:
            print("  page errors:", errs, flush=True)

        print("\n===== SUMMARY =====", flush=True)
        for n, ok in RESULTS:
            print(("PASS  " if ok else "FAIL  ") + n, flush=True)
        print("failed:", sum(1 for _, ok in RESULTS if not ok), "/", len(RESULTS), flush=True)
        await page.screenshot(path=str(_HERE) + "/shot_final.png")
        await b.close()


asyncio.run(main())
