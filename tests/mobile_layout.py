"""Phone / desktop suite — the landscape gate, and "same interface, icons just fit".

Three real contexts against the :4180 build:
  * a portrait iPhone-class phone (390×844, touch, mobile UA),
  * the same phone in landscape (844×390),
  * a 1440×900 desktop as the control that must not have moved.

Checks
  A  the landscape gate is back and ON by default on a portrait phone
  B  its tap-to-rotate runs the full sequence and reports honestly
  C  a browser that cannot lock orientation offers "Continue in portrait"
     (and the choice sticks for the next boot)
  D  with the gate out of the way the phone shows the SAME desktop sizes
  E  nothing overflows; the icon strip never slides under the clock
  F  landscape phones and desktops never see the gate
  G  "Star me on GitHub" opens the repository in a real browser tab
"""
import os
_HERE = os.path.dirname(os.path.abspath(__file__))
import asyncio, hashlib, json
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:4180/index.html"
PW = "1234"
USER = {"username": "Tester", "setupComplete": True, "passwordHash": hashlib.sha256(PW.encode()).hexdigest()}
GH = "https://github.com/bittuhere/win11WebOS"
PHONE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")

RESULTS = []


def check(name, ok, extra=""):
    RESULTS.append((name, bool(ok)))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("   :: " + str(extra)) if extra else ""), flush=True)


GATE = """
() => {
  const g = document.querySelector('.wosRotateGate');
  if (!g) return { present: false };
  const cs = getComputedStyle(g);
  const btn = g.querySelector('.rgBtn');
  const b = btn ? btn.getBoundingClientRect() : null;
  return {
    present: true,
    visible: cs.display !== 'none' && cs.visibility !== 'hidden' && g.getBoundingClientRect().height > 100,
    phase: g.dataset.phase,
    title: (g.querySelector('.rgTitle')?.textContent || '').trim(),
    sub: (g.querySelector('.rgSub')?.textContent || '').trim(),
    btnLabel: (btn?.textContent || '').trim(),
    btnSize: b ? { w: Math.round(b.width), h: Math.round(b.height) } : null,
    disabled: !!btn?.disabled,
    status: (g.querySelector('.rgStatus')?.textContent || '').trim(),
    statusPhase: g.querySelector('.rgStatus')?.dataset.phase,
    steps: [...g.querySelectorAll('.rgSteps li')].map((n) => n.textContent.trim()),
    alt: !!g.querySelector('.rgAlt'),
    altLabel: (g.querySelector('.rgAlt')?.textContent || '').trim(),
    ariaModal: g.getAttribute('aria-modal'),
    role: g.getAttribute('role'),
    z: cs.zIndex,
    stars: g.querySelectorAll('.rgStars i').length,
  };
}
"""

PROBE = """
() => {
  const vw = innerWidth, vh = innerHeight;
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const dsk = document.querySelector('.dskApp');
  const dskIcon = dsk ? dsk.querySelector('img,svg') : null;
  const bar = document.querySelector('.tsbar');
  const tray = document.querySelector('.taskright');
  const startBtn = document.querySelector('.tsIcon[data-action="STARTOGG"]');
  const tile = document.querySelector('.pnApp:not(.pnEmpty)');
  const grid = document.querySelector('.pnApps');
  const over = [...document.querySelectorAll('body *')].filter((e) => {
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const insideGate = !!e.closest('.wosRotateGate');
      return b.width > vw + 1 && b.height > 1 && cs.position !== 'fixed'
             && !insideGate && !e.closest('.allApps') && !e.closest('.startMenu');
    }).slice(0, 8).map((e) => ({ cls: (e.className || e.tagName).toString().slice(0, 40),
                                 w: Math.round(e.getBoundingClientRect().width) }));
  return {
    vw, vh,
    gate: !!document.querySelector('.wosRotateGate'),
    dsk: rect(dsk),
    dskIcon: dskIcon ? { ...rect(dskIcon), css: getComputedStyle(dskIcon).width } : null,
    dskLabel: dsk ? getComputedStyle(dsk.querySelector('.appName')).fontSize : null,
    taskbar: rect(document.querySelector('.taskbar')),
    startBtn: rect(startBtn),
    startIcon: startBtn ? { ...rect(startBtn.querySelector('img,svg')),
      css: getComputedStyle(startBtn.querySelector('img,svg')).width } : null,
    tsbar: bar ? { ...rect(bar), scrollW: bar.scrollWidth, scrollable: bar.scrollWidth > bar.clientWidth + 1 } : null,
    overlap: (bar && tray) ? Math.max(0, Math.round(bar.getBoundingClientRect().right - tray.getBoundingClientRect().x)) : null,
    tile: rect(tile),
    tileIcon: tile ? { ...rect(tile.querySelector('img,svg')) } : null,
    cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : null,
    startMenu: rect(document.querySelector('.startMenu')),
    labelsClipped: [...document.querySelectorAll('.dskApp .appName')].filter((n) => n.scrollHeight > n.clientHeight + 1).length,
    desktopNames: [...document.querySelectorAll('.dskApp')].map((n) => n.dataset.name),
    tiles: [...document.querySelectorAll('.pnApp:not(.pnEmpty)')].map((n) => n.dataset.name),
    overflowing: over,
    stored: (() => { try { return localStorage.getItem('wos.rotateGate'); } catch (e) { return 'n/a'; } })(),
  };
}
"""


async def unlock(page):
    if await page.query_selector(".lockscreen"):
        await page.click(".lockscreen", position={"x": 100, "y": 200})
        await page.wait_for_timeout(900)
        await page.keyboard.type(PW)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(4200)
    for _ in range(3):
        if await page.is_visible(".aboutApp"):
            await page.click(".aboutApp .okbtn div", timeout=6000)
            await page.wait_for_timeout(400)


async def hide_gate(page):
    """Move the barrier aside without taking its escape hatch.

    The gate is a real barrier: it covers the lock screen too, so every check
    that needs the machine underneath clears it out of the way with CSS (which
    never touches the gate's own state or storage).
    """
    await page.add_style_tag(content=".wosRotateGate{display:none !important}")


async def boot(page, hide_first=False):
    await page.goto(URL, wait_until="domcontentloaded")
    await page.wait_for_timeout(4200)
    if hide_first:
        await hide_gate(page)
    await unlock(page)


async def phone_ctx(b, w, h, flag=None):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=3,
                              is_mobile=True, has_touch=True, user_agent=PHONE_UA)
    init = (f"localStorage.setItem('wosUserMirror', JSON.stringify({json.dumps(USER)}));"
            "localStorage.setItem('locked','false');")
    if flag is not None:
        init += f"localStorage.setItem('wos.rotateGate','{flag}');"
    await ctx.add_init_script(init)
    return ctx


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------------- A/B: the gate itself ----------------
        print("\n[A] portrait phone — the landscape gate is back, on by default", flush=True)
        ctx = await phone_ctx(b, 390, 844)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("  PAGEERROR", str(e)[:200], flush=True))
        # the gate is up over the lock screen from the very first frame — that
        # is the point of a barrier, so it is inspected before unlocking
        await page.goto(URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(4200)
        g = await page.evaluate(GATE)
        check("the gate appears on a portrait phone with no flag set", g["present"] and g["visible"], g)
        check("it is a modal dialog at the top of the stack",
              g.get("role") == "alertdialog" and g.get("ariaModal") == "true" and int(g.get("z", 0)) > 2_000_000_000,
              f"role={g.get('role')} z={g.get('z')}")
        check("it tells you to rotate your device",
              "rotate" in (g["title"] or "").lower() and "sideways" in (g["sub"] or "").lower(), g["title"])
        check("the tap target is a comfortable button", g["btnSize"]["h"] >= 44, g["btnSize"])
        check("a status line is announced politely", bool(g["status"]), g["status"])
        check("it lists what to do", len(g["steps"]) == 3, g["steps"])
        check("it is decorated (stars + phone illustration)",
              g["stars"] >= 12 and await page.evaluate("!!document.querySelector('.rgPhone')"))
        await page.screenshot(path=str(_HERE) + "/mob_gate_default.png")

        print("\n[B] tap to rotate — the whole sequence, reported honestly", flush=True)
        await page.click(".rgBtn", timeout=6000)
        await page.wait_for_timeout(1800)
        g = await page.evaluate(GATE)
        check("the tap is acknowledged (phase left idle)", g["phase"] in ("requesting", "locked", "unsupported"), g)
        check("the browser is asked for full screen", await page.evaluate("!!document.fullscreenElement"))
        check("the verdict reaches the user in words",
              g["statusPhase"] in ("locked", "unsupported", "stalled") and len(g["status"]) > 10, g["status"])
        check("the button returns to a usable state", not g["disabled"], g["disabled"])
        await page.screenshot(path=str(_HERE) + "/mob_gate_after_tap.png")

        print("\n[C] when the screen can't turn, the gate says why and offers a way out", flush=True)
        turned = not await page.evaluate("matchMedia('(orientation: portrait)').matches")
        if not turned:
            # either the lock resolved while a hardware rotation-lock keeps the
            # screen upright, or the browser refused the lock outright — both
            # must end with the user told and the escape hatch in reach
            await page.wait_for_timeout(1800)
            g = await page.evaluate(GATE)
            if not g["alt"]:
                await page.click(".rgBtn", timeout=6000)  # a second, deliberate try
                await page.wait_for_timeout(1600)
                g = await page.evaluate(GATE)
            check("the gate reports the real reason, not a green lie",
                  g["statusPhase"] in ("unsupported", "stalled"), g["statusPhase"])
            check("it explains the rotation-lock case in words",
                  len(g["status"]) > 30 and ("rotation lock" in g["status"] or "lock orientation" in g["status"]),
                  g["status"][:90])
            check("the escape hatch appears once the browser has run out of ideas", g["alt"], g)
            check("the escape is a real button", "portrait" in (g["altLabel"] or "").lower(), g["altLabel"])
            await page.click(".rgAlt", timeout=6000)
            await page.wait_for_timeout(1000)
            g2 = await page.evaluate(GATE)
            st = await page.evaluate(PROBE)
            check("taking it puts the OS on screen", not g2["present"], g2)
            check("the choice is remembered for the next boot", st["stored"] == "off", st["stored"])
            await page.screenshot(path=str(_HERE) + "/mob_portrait_mode.png")
        else:
            check("a lock that turns the screen is enough on its own", True, "landscape")
            await page.evaluate("document.querySelector('.wosRotateGate')?.remove()")

        # now move the barrier aside and reach the machine underneath
        await hide_gate(page)
        await unlock(page)
        await page.wait_for_timeout(600)

        print("\n[D] the same interface — nothing enlarged", flush=True)
        st = await page.evaluate(PROBE)
        check("desktop icon keeps its desktop size (36px)",
              st["dskIcon"] and abs(float(st["dskIcon"]["css"].replace("px", "")) - 36) < 0.6, st["dskIcon"])
        check("label uses the same kind of size as the desktop", st["dskLabel"] in ("10.5px", "10.88px"), st["dskLabel"])
        check("taskbar icons keep their desktop size (24px in a 38px button)",
              st["startBtn"]["w"] == 38 and float(st["startIcon"]["css"].replace("px", "")) == 24, st["startIcon"])
        check("no desktop label is clipped", st["labelsClipped"] == 0, st["labelsClipped"])
        await page.click(".tsIcon[data-action='STARTOGG']")
        await page.wait_for_timeout(1000)
        st = await page.evaluate(PROBE)
        check("pinned grid is the desktop's 6 columns", st["cols"] == 6, st["cols"])
        check("tiles keep the desktop icon size (32px)", st["tileIcon"] and st["tileIcon"]["w"] == 32, st["tileIcon"])
        check("tiles are narrower than a PC's, because the screen is",
              st["tile"]["w"] < 90 and st["tile"]["h"] == 84, st["tile"])

        print("\n[E] nothing overflows the phone", flush=True)
        check("no element is wider than the screen", len(st["overflowing"]) == 0, st["overflowing"])
        check("taskbar never slides under the clock", st["overlap"] == 0, st["overlap"])

        print("\n[G] Star me on GitHub — a shortcut that works like Github", flush=True)
        check("it has a desktop shortcut", "Star me on GitHub" in st["desktopNames"], st["desktopNames"])
        check("it is pinned in the start menu", "Star me on GitHub" in st["tiles"], st["tiles"][:4])
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)
        before = len([pg for pg in ctx.pages if "github.com" in pg.url])
        await page.dblclick(".dskApp[data-name='Star me on GitHub']", timeout=6000)
        await page.wait_for_timeout(2500)
        gh = [pg for pg in ctx.pages if "github.com" in pg.url]
        check("double-clicking the desktop shortcut opens a REAL new tab",
              len(gh) == before + 1 and any(pg.url.startswith(GH) for pg in gh), [pg.url for pg in gh])
        check("the internal Edge app was NOT opened",
              not await page.evaluate("!!window.__wosStore.getState().apps.edge.alive"))
        await ctx.close()

        # ---------------- D2: the flag path ----------------
        print("\n[D2] opted out by flag: no gate, fitted portrait layout", flush=True)
        ctx2 = await phone_ctx(b, 390, 844, flag="off")
        page2 = await ctx2.new_page()
        await boot(page2)
        g = await page2.evaluate(GATE)
        st = await page2.evaluate(PROBE)
        check("wos.rotateGate='off' boots straight to the desktop", not g["present"], g)
        check("the desktop is there, fitted", st["dsk"] and st["dsk"]["w"] >= 60, st["dsk"])
        check("and the icons are still desktop-sized", st["dskIcon"]["css"] == "36px", st["dskIcon"])
        await page2.screenshot(path=str(_HERE) + "/mob_portrait_desktop.png")
        await ctx2.close()

        # ---------------- C2: a browser that refuses the lock, on purpose ----------------
        print("\n[C2] a browser that refuses orientation lock (iOS-Safari behaviour)", flush=True)
        ctx5 = await phone_ctx(b, 390, 844)
        await ctx5.add_init_script(
            """Object.defineProperty(window.screen, 'orientation', {
                 configurable: true,
                 value: { type: 'portrait-primary', angle: 0,
                          lock: () => Promise.reject(new DOMException('no lock', 'NotSupportedError')),
                          unlock: () => Promise.resolve(),
                          addEventListener() {}, removeEventListener() {} },
               });""")
        page5 = await ctx5.new_page()
        await page5.goto(URL, wait_until="domcontentloaded")
        await page5.wait_for_timeout(4200)
        g5 = await page5.evaluate(GATE)
        check("the gate still appears", g5["present"], g5)
        await page5.click(".rgBtn", timeout=6000)
        await page5.wait_for_timeout(1200)
        g5 = await page5.evaluate(GATE)
        check("a refusal is reported as a refusal", g5["statusPhase"] == "unsupported", g5["statusPhase"])
        check("no escape hatch on the first try (the user still has the phone)", not g5["alt"], g5["alt"])
        check("the button offers another try", "again" in g5["btnLabel"].lower() or g5["btnLabel"] == "Try again", g5["btnLabel"])
        await page5.click(".rgBtn", timeout=6000)
        await page5.wait_for_timeout(1200)
        g5 = await page5.evaluate(GATE)
        check("after the second refusal the way out appears", g5["alt"], g5)
        await page5.click(".rgAlt", timeout=6000)
        await page5.wait_for_timeout(900)
        g5b = await page5.evaluate(GATE)
        check("it drops straight into portrait mode", not g5b["present"], g5b)
        await ctx5.close()

        # ---------------- F: landscape + desktop never see it ----------------
        print("\n[F] landscape phone and desktop never see the gate", flush=True)
        ctx3 = await phone_ctx(b, 844, 390)
        page3 = await ctx3.new_page()
        await boot(page3)
        g3 = await page3.evaluate(GATE)
        stl = await page3.evaluate(PROBE)
        check("no gate in landscape", not g3["present"], g3)
        check("landscape boots the OS", stl["dsk"] is not None)
        check("nothing overflows in landscape", len(stl["overflowing"]) == 0, stl["overflowing"])
        check("taskbar tray keeps clear of the icons", stl["overlap"] == 0, stl["overlap"])
        await page3.click(".tsIcon[data-action='STARTOGG']")
        await page3.wait_for_timeout(900)
        stl = await page3.evaluate(PROBE)
        check("start menu is no wider than a PC's 640px", stl["startMenu"]["w"] <= 640, stl["startMenu"])
        check("its tiles are the desktop's 96-ish px", 96 <= stl["tile"]["w"] <= 110 and stl["tile"]["h"] == 84, stl["tile"])
        await page3.screenshot(path=str(_HERE) + "/mob_landscape_start.png")
        await ctx3.close()

        ctx4 = await b.new_context(viewport={"width": 1440, "height": 900})
        await ctx4.add_init_script(f"localStorage.setItem('wosUserMirror', JSON.stringify({json.dumps(USER)}));"
                                   "localStorage.setItem('locked','false');")
        page4 = await ctx4.new_page()
        await boot(page4)
        g4 = await page4.evaluate(GATE)
        st4 = await page4.evaluate(PROBE)
        check("no gate on a desktop", not g4["present"], g4)
        check("desktop icon still 36px", st4["dskIcon"]["css"] == "36px", st4["dskIcon"])
        check("desktop label still 12.8px", st4["dskLabel"] == "12.8px", st4["dskLabel"])
        await page4.click(".tsIcon[data-action='STARTOGG']")
        await page4.wait_for_timeout(900)
        st4 = await page4.evaluate(PROBE)
        check("start grid still 6 columns", st4["cols"] == 6, st4["cols"])
        check("tile still the desktop size", st4["tile"]["h"] == 84 and st4["tile"]["w"] >= 90, st4["tile"])
        check("the new shortcut is on the PC desktop too", "Star me on GitHub" in st4["desktopNames"], st4["desktopNames"])
        await page4.screenshot(path=str(_HERE) + "/mob_desktop_control.png")

        print("\n[H] Settings ▸ Personalisation ▸ Rotate prompt drives the gate", flush=True)
        await page4.keyboard.press("Escape")
        await page4.wait_for_timeout(500)
        await page4.evaluate("window.__wosStore.dispatch({type:'SETTINGS', payload:'full'})")
        await page4.wait_for_timeout(2500)
        # find it the way a person would: Settings search
        await page4.fill("input.search", "Rotate prompt")
        await page4.wait_for_timeout(900)
        clicked_tile = await page4.evaluate("""() => {
            const hit = document.querySelector('.searchResult');
            if (!hit) return false;
            hit.click();
            return true;
        }""")
        await page4.wait_for_timeout(1200)
        body_txt = await page4.inner_text("body")
        check("the Rotate prompt entry exists in Settings", clicked_tile, "tile found" if clicked_tile else body_txt[:80])
        if clicked_tile:
            check("its panel explains itself", "portrait" in body_txt.lower() and "landscape" in body_txt.lower())
            # the setting is on by default (no flag stored)
            state = await page4.evaluate("localStorage.getItem('wos.rotateGate')")
            check("the prompt is on by default", state in (None, "on"), state)
            # preview works on a desktop too
            await page4.click("text=Preview the gate on this device", timeout=6000)
            await page4.wait_for_timeout(900)
            g = await page4.evaluate(GATE)
            check("previewing renders the gate on a desktop", g["present"] and g["visible"], g.get("present"))
            check("the preview is a preview, not a trap", bool(await page4.query_selector(".rgAlt")),
                  await page4.inner_text(".rgAlt") if await page4.query_selector(".rgAlt") else None)
            await page4.click(".rgAlt", timeout=6000)
            await page4.wait_for_timeout(700)
            g = await page4.evaluate(GATE)
            check("closing the preview leaves the desktop alone", not g["present"], g)
            check("and stores nothing", await page4.evaluate("localStorage.getItem('wos.rotateGate')") in (None, "on"))
            # switching it off writes the flag
            await page4.click("text=Rotate prompt on portrait phones")
            await page4.wait_for_timeout(600)
            check("turning it off is remembered", await page4.evaluate("localStorage.getItem('wos.rotateGate')") == "off",
                  await page4.evaluate("localStorage.getItem('wos.rotateGate')"))
            await page4.screenshot(path=str(_HERE) + "/mob_settings_rotate.png")
        await ctx4.close()

        await b.close()

    bad = [n for n, ok in RESULTS if not ok]
    print(f"\n===== SUMMARY: {len(RESULTS) - len(bad)} passed / {len(bad)} failed =====", flush=True)
    for n in bad:
        print("  FAILED:", n, flush=True)


asyncio.run(main())
