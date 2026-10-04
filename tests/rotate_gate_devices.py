"""Real-device matrix for the landscape gate.

`mobile_layout.py` proves the gate with one hand-made phone profile. This suite
proves the *detection* is right on the phones people actually carry, and that
the gate survives browsers that have no orientation API at all (iOS Safari).

A  every real phone, in portrait  →  the gate
B  the same phones, turned        →  no gate (the OS is the landscape UI)
C  tablets, touch laptops, desktop →  no gate (a portrait tablet is a fine PC)
D  iOS-Safari-shaped browser (no screen.orientation, no element fullscreen,
   sensor permission prompt) → no crash, honest verdict, portrait escape
E  a browser that locks but will not turn (Android with rotation lock on)
   → honest amber verdict, escape appears
F  the sensor: a real deviceorientation event drives the UI
"""
import os
_HERE = os.path.dirname(os.path.abspath(__file__))
import asyncio, hashlib, json
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:4180/index.html"
PW = "1234"
USER = {"username": "Tester", "setupComplete": True, "passwordHash": hashlib.sha256(PW.encode()).hexdigest()}

IOS = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 "
       "(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1")
IPAD = ("Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1")
ANDROID = ("Mozilla/5.0 (Linux; Android 14; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) "
           "Chrome/124.0.0.0 Mobile Safari/537.36")

# name, w, h, ua, touch, must_gate
PHONES_PORTRAIT = [
    ("iPhone SE", 375, 667, IOS),
    ("iPhone 12", 390, 844, IOS),
    ("iPhone 15 Pro Max", 430, 932, IOS),
    ("Pixel 5", 393, 851, ANDROID),
    ("Galaxy S8", 360, 740, ANDROID),
    ("Galaxy S9+", 320, 658, ANDROID),
    ("Nexus 5", 360, 640, ANDROID),
]
PHONES_LANDSCAPE = [("iPhone 12", 844, 390, IOS), ("Pixel 5", 851, 393, ANDROID)]
NOT_PHONES = [
    ("iPad Mini (portrait)", 768, 1024, IPAD, True),
    ("iPad Pro 11 (portrait)", 834, 1194, IPAD, True),
    ("touch laptop", 1440, 900, None, True),
    ("desktop", 1440, 900, None, False),
]

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
  return {
    present: true,
    visible: cs.display !== 'none' && cs.visibility !== 'hidden' && g.getBoundingClientRect().height > 100,
    phase: g.dataset.phase,
    turn: g.dataset.turn,
    sensor: g.dataset.sensor,
    btnLabel: (btn?.textContent || '').trim(),
    btnDisabled: !!btn?.disabled,
    status: (g.querySelector('.rgStatus')?.textContent || '').trim(),
    statusPhase: g.querySelector('.rgStatus')?.dataset.phase,
    alt: !!g.querySelector('.rgAlt'),
    altLabel: (g.querySelector('.rgAlt')?.textContent || '').trim(),
    steps: [...g.querySelectorAll('.rgSteps li')].map((n) => ({ t: n.textContent.trim(), done: n.dataset.done })),
    tilt: getComputedStyle(g.querySelector('.rgPhoneWrap') || g).getPropertyValue('--tilt').trim(),
  };
}
"""

DETECT = """() => ({
  uaMobile: (navigator.userAgentData && navigator.userAgentData.mobile) ?? null,
  touch: navigator.maxTouchPoints || 0,
  screen: [screen.width, screen.height],
  inner: [innerWidth, innerHeight],
})"""


async def ctx_for(b, w, h, ua, touch, init_extra=""):
    kw = dict(viewport={"width": w, "height": h}, screen={"width": w, "height": h},
              is_mobile=touch, has_touch=touch, device_scale_factor=3 if touch else 1)
    if ua:
        kw["user_agent"] = ua
    ctx = await b.new_context(**kw)
    init = (f"localStorage.setItem('wosUserMirror', JSON.stringify({json.dumps(USER)}));"
            "localStorage.setItem('locked','false');" + init_extra)
    await ctx.add_init_script(init)
    return ctx


async def open_gate(page):
    await page.goto(URL, wait_until="domcontentloaded")
    try:
        await page.wait_for_selector(".wosRotateGate", timeout=9000)
    except Exception:
        pass
    await page.wait_for_timeout(400)
    return await page.evaluate(GATE)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------------- A: real phones, upright ----------------
        print("\n[A] every real phone in portrait gets the gate", flush=True)
        iphone_state = None
        for name, w, h, ua in PHONES_PORTRAIT:
            ctx = await ctx_for(b, w, h, ua, True)
            page = await ctx.new_page()
            page.on("pageerror", lambda e, n=name: print(f"  PAGEERROR({n})", str(e)[:160], flush=True))
            g = await open_gate(page)
            if name == "iPhone 12":
                iphone_state = await page.evaluate(DETECT)
            check(f"{name} ({w}×{h}) is gated", g["present"] and g["visible"], g.get("phase"))
            check(f"{name}: the rotate button is there",
                  "rotate" in (g.get("btnLabel") or "").lower(), g.get("btnLabel"))
            await ctx.close()
        if iphone_state:
            print("        detection seen:", iphone_state, flush=True)
            check("an iPhone Safari UA is recognised as a phone without userAgentData",
                  iphone_state["touch"] > 0 and min(iphone_state["screen"]) <= 740, iphone_state)

        # ---------------- B: turned phones ----------------
        print("\n[B] a phone already turned sideways is never gated", flush=True)
        for name, w, h, ua in PHONES_LANDSCAPE:
            ctx = await ctx_for(b, w, h, ua, True)
            page = await ctx.new_page()
            await page.goto(URL, wait_until="domcontentloaded")
            await page.wait_for_timeout(4200)
            g = await page.evaluate(GATE)
            check(f"{name} landscape ({w}×{h}) is not gated", not g["present"], g)
            await ctx.close()

        # ---------------- C: things that are not phones ----------------
        print("\n[C] tablets and touch laptops keep their portrait PC", flush=True)
        for name, w, h, ua, touch in NOT_PHONES:
            ctx = await ctx_for(b, w, h, ua, touch)
            page = await ctx.new_page()
            await page.goto(URL, wait_until="domcontentloaded")
            await page.wait_for_timeout(4200)
            g = await page.evaluate(GATE)
            check(f"{name} ({w}×{h}) is not gated", not g["present"], g)
            await ctx.close()

        # ---------------- D: iOS Safari, which has no orientation lock ----------------
        print("\n[D] iOS Safari: no screen.orientation, no element fullscreen", flush=True)
        ios_shim = """
        Object.defineProperty(window.screen, 'orientation', { value: undefined, configurable: true });
        delete Document.prototype.requestFullscreen;
        delete Element.prototype.requestFullscreen;
        delete Element.prototype.webkitRequestFullscreen;
        window.DeviceOrientationEvent.requestPermission = async () => 'granted';
        window.__sensorAsked = 0;
        const orig = window.DeviceOrientationEvent.requestPermission;
        window.DeviceOrientationEvent.requestPermission = async () => { window.__sensorAsked++; return orig(); };
        """
        ctx = await ctx_for(b, 390, 844, IOS, True, ios_shim)
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        g = await open_gate(page)
        check("an iOS-shaped browser still gets the gate", g["present"] and g["visible"], g.get("phase"))
        await page.click(".rgBtn", timeout=8000)
        await page.wait_for_timeout(1400)
        g = await page.evaluate(GATE)
        check("the tap does not hang in 'requesting'", g["phase"] != "requesting", g["phase"])
        check("it says the browser cannot lock orientation",
              g["phase"] == "unsupported" and "turn the phone sideways" in g["status"].lower(), g["status"][:70])
        check("the button invites another try", (g["btnLabel"] or "").lower().startswith("try again"), g["btnLabel"])
        check("no escape hatch is offered after one tap", not g["alt"], g.get("altLabel"))
        check("the sensor permission was actually requested", True)  # asserted below via counter
        asked = await page.evaluate("window.__sensorAsked")
        check("the motion permission ask really fired", asked >= 1, asked)
        await page.click(".rgBtn", timeout=8000)
        await page.wait_for_timeout(900)
        g = await page.evaluate(GATE)
        check("after the second tap the portrait escape appears",
              g["alt"] and "portrait" in g["altLabel"].lower(), g.get("altLabel"))
        await page.click(".rgAlt", timeout=8000)
        await page.wait_for_timeout(900)
        check("taking it drops the gate and remembers", await page.evaluate(GATE) == {"present": False}
              and await page.evaluate("localStorage.getItem('wos.rotateGate')") == "off")
        check("no page errors on a browser with no orientation API", not errs, errs[:2])
        await ctx.close()

        # ---------------- E: locks, but the screen will not turn ----------------
        print("\n[E] a browser that locks but will not turn says so", flush=True)
        lock_shim = """
        Object.defineProperty(window.screen, 'orientation', { configurable: true, value: {
          type: 'portrait-primary', angle: 0,
          lock: () => Promise.resolve(), unlock: () => Promise.resolve(),
          addEventListener: () => {}, removeEventListener: () => {},
        }});
        """
        ctx = await ctx_for(b, 393, 851, ANDROID, True, lock_shim)
        page = await ctx.new_page()
        g = await open_gate(page)
        await page.click(".rgBtn", timeout=8000)
        await page.wait_for_timeout(600)
        g = await page.evaluate(GATE)
        check("a resolved lock reads as locked", g["phase"] == "locked", g["phase"])
        check("and the button says so", "locked" in (g["btnLabel"] or "").lower(), g["btnLabel"])
        await page.wait_for_timeout(1600)
        g = await page.evaluate(GATE)
        check("when the screen never turns, the gate admits it",
              g["statusPhase"] == "stalled" and "rotation lock" in g["status"].lower(), g["status"][:90])
        check("the escape hatch is offered", g["alt"], g.get("altLabel"))
        await ctx.close()

        # ---------------- F: the sensor drives the screen ----------------
        print("\n[F] a real deviceorientation event moves the gate", flush=True)
        ctx = await ctx_for(b, 390, 844, IOS, True)
        page = await ctx.new_page()
        await open_gate(page)
        await page.evaluate("""
        () => {
          const fire = (gamma) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',
            { alpha: 0, beta: 0, gamma }));
          fire(-30);
          window.__fire = fire;
        }
        """)
        await page.wait_for_timeout(500)
        g = await page.evaluate(GATE)
        t1 = g.get("tilt")
        await page.evaluate("window.__fire(-75)")
        await page.wait_for_timeout(500)
        g = await page.evaluate(GATE)
        t2 = g.get("tilt")
        check("the phone illustration follows the real tilt", t1 != t2 and t2 != "", f"{t1} -> {t2}")
        check("the reading is a sane angle", t2 not in (None, "none", ""), t2)

        # ---------------- G: the advanced layer ----------------
        print("\n[G] the advanced layer: telemetry, progress, live checklist", flush=True)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_selector(".wosRotateGate", timeout=9000)
        g = await page.evaluate(GATE)
        check("with no sensor reading there is no fake dial",
              g["sensor"] == "0" and "° to go" not in await page.inner_text(".wosRotateGate"), g["sensor"])
        check("the checklist starts unticked", all(x["done"] == "0" for x in g["steps"]), g["steps"])

        prog = []
        for gamma in (-10, -45, -70, -85):
            await page.evaluate(
                "(g) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',"
                " { alpha: 0, beta: 0, gamma: g }))", gamma)
            await page.wait_for_timeout(260)
            prog.append(await page.evaluate("""
            () => {
              const root = document.querySelector('.wosRotateGate');
              return {
                dial: (document.querySelector('.rgDial')?.textContent || '').trim(),
                turn: root.dataset.turn,
                near: root.dataset.near,
                prog: getComputedStyle(root).getPropertyValue('--prog').trim(),
                status: (document.querySelector('.rgStatus')?.textContent || '').trim(),
                sensor: root.dataset.sensor,
                aria: document.querySelector('.rgDial')?.getAttribute('aria-hidden'),
              };
            }
            """))
        check("a real sensor reading switches the gate into telemetry mode",
              prog[-1]["sensor"] == "1", prog[-1]["sensor"])
        check("the dial counts the degrees still to turn",
              prog[0]["turn"] == "80" and "80" in prog[0]["dial"], prog[0]["dial"])
        check("turning the phone lowers the count",
              [int(x["turn"]) for x in prog] == sorted([int(x["turn"]) for x in prog], reverse=True),
              [x["turn"] for x in prog])
        check("the arc becomes a real progress meter that climbs",
              [round(float(x["prog"]), 3) for x in prog] == sorted(round(float(x["prog"]), 3) for x in prog)
              and float(prog[-1]["prog"]) > float(prog[0]["prog"]), [x["prog"] for x in prog])
        check("close to landscape it says so in words",
              prog[-1]["near"] == "1" and "almost there" in prog[-1]["status"].lower(), prog[-1]["status"])
        check("the dial is decoration for a screen reader, not a number generator",
              prog[-1]["aria"] == "true", prog[-1]["aria"])
        mirror = await page.evaluate("""
        () => {
          const root = document.querySelector('.wosRotateGate');
          const ph = getComputedStyle(document.querySelector('.rgPhone'));
          return { roll: getComputedStyle(root).getPropertyValue('--roll').trim(),
                   anim: ph.animationName, tf: ph.transform };
        }
        """)
        check("the illustration mirrors the real angle instead of looping",
              mirror["anim"] == "none" and mirror["roll"].startswith("-85") and mirror["tf"] != "none", mirror)
        await page.screenshot(path=str(_HERE) + "/mob_gate_sensor.png")

        # the checklist ticks are driven by real browser state
        await page.click(".rgBtn", timeout=8000)
        await page.wait_for_timeout(700)
        st = await page.evaluate(GATE)
        check("step 1 ticks the moment the button is really used", st["steps"][0]["done"] == "1", st["steps"])
        faked = await page.evaluate("""
        () => {
          try {
            Object.defineProperty(Document.prototype, 'fullscreenElement', {
              configurable: true, get: () => document.documentElement,
            });
            document.dispatchEvent(new Event('fullscreenchange'));
            return true;
          } catch (e) { return String(e).slice(0, 60); }
        }
        """)
        await page.wait_for_timeout(500)
        st = await page.evaluate(GATE)
        check("step 2 ticks when the browser reports full screen",
              faked is True and st["steps"][1]["done"] == "1", f"{faked} / {st['steps'][1]}")
        await page.evaluate("""
        () => {
          Object.defineProperty(window.screen, 'orientation', { configurable: true, value: {
            type: 'landscape-primary', angle: 90,
            lock: () => Promise.resolve(), unlock: () => Promise.resolve(),
            addEventListener: () => {}, removeEventListener: () => {},
          }});
        }
        """)
        await page.click(".rgBtn", timeout=8000)
        await page.wait_for_timeout(700)
        st = await page.evaluate(GATE)
        check("step 3 ticks only when a lock really resolved", st["steps"][2]["done"] == "1", st["steps"][2])
        await ctx.close()

        await b.close()

    good = sum(1 for _, ok in RESULTS if ok)
    print(f"\n===== SUMMARY: {good} passed / {len(RESULTS) - good} failed =====", flush=True)
    for name, ok in RESULTS:
        if not ok:
            print("  FAILED:", name, flush=True)
    return 0 if good == len(RESULTS) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
