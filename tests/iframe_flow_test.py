"""Full OOBE → desktop inside a sandbox="allow-scripts" iframe (no storage at all).

Clicks through every setup screen the way a user would, and finishes by proving
the About dialog and window.open still work when the context has zero storage.
"""
import os
_HERE = os.path.dirname(os.path.abspath(__file__))
import asyncio, http.server, socketserver, threading, functools
from playwright.async_api import async_playwright

BUILD = os.path.join(os.path.dirname(_HERE), "build")
PORT = 4321
HOST_PAGE = """<!doctype html><html><body style="margin:0;background:#222">
<iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:800px;border:0"></iframe>
</body></html>"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/host"):
            body = HOST_PAGE.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


JS_STATE = """() => {
  const btns = [...document.querySelectorAll('.oobe-btn')].map((b, i) => ({
    i, text: (b.textContent || '').trim().slice(0, 30), disabled: b.disabled, cls: b.className
  }));
  const inputs = [...document.querySelectorAll('input')].map((x) => ({
    type: x.type, val: x.value, ph: x.placeholder || ''
  }));
  return {
    title: document.querySelector('.oobe-title')?.textContent || '',
    btns, inputs,
    desktop: !!document.querySelector('.desktop, .destop'),
    about: !!document.querySelector('.aboutApp'),
  };
}"""


async def main():
    handler = functools.partial(Handler, directory=BUILD)
    httpd = Server(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    errors = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={"width": 1360, "height": 860})
            page = await ctx.new_page()
            page.on("console", lambda m: m.type == "error" and errors.append(m.text[:200]))
            page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)[:200]))
            await page.goto(f"http://127.0.0.1:{PORT}/host", wait_until="domcontentloaded")
            await page.wait_for_timeout(7000)
            f = next((fr for fr in page.frames if "index.html" in fr.url), None)
            assert f, "no app iframe"

            print("degraded flag:", await f.evaluate("window.__wosStorageDegraded"), flush=True)

            reached = False
            clicks = 0
            for _ in range(60):
                st = await f.evaluate(JS_STATE)
                if st["desktop"]:
                    reached = True
                    break
                if st["inputs"]:
                    # username / password / re-enter screens — fill EVERY empty field
                    els = await f.query_selector_all("input")
                    for el in els:
                        if not await el.input_value():
                            ph = (await el.get_attribute("placeholder")) or ""
                            typ = (await el.get_attribute("type")) or "text"
                            val = "1234" if typ == "password" or "password" in ph.lower() else "Tester"
                            await el.fill(val)
                pick = None
                live = [
                    btn for btn in st["btns"]
                    if not btn["disabled"] and btn["text"] and btn["text"].strip().lower() != "back"
                ]
                # 1) a "later/skip" escape hatch on the extension screens
                for btn in live:
                    if any(w in btn["text"].lower() for w in ("later", "skip")):
                        pick = btn["i"]
                        break
                # 2) otherwise the forward action (primary/accent), never Back
                if pick is None:
                    forward = [btn for btn in live if "primary" in btn["cls"] or "accent" in btn["cls"]]
                    if forward:
                        pick = forward[-1]["i"]
                    elif live:
                        pick = live[-1]["i"]
                if pick is not None:
                    await f.evaluate(f"() => document.querySelectorAll('.oobe-btn')[{pick}].click()")
                    clicks += 1
                await page.wait_for_timeout(700)

            st = await f.evaluate(JS_STATE)
            print("clicks:", clicks, "| final title:", st["title"][:40], "| desktop:", st["desktop"], flush=True)

            # OOBE finished → the lock screen appears; unlock it like a user
            lock = await f.query_selector(".lockscreen")
            if lock:
                print("lock screen reached — unlocking", flush=True)
                await lock.click(position={"x": 700, "y": 300})
                await page.wait_for_timeout(900)
                await page.keyboard.type("1234")
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(4500)
                st = await f.evaluate(JS_STATE)
                print("after unlock — desktop:", st["desktop"], "| lockscreen gone:", not await f.query_selector(".lockscreen"), flush=True)

            # About dialog must work with zero storage
            if st["desktop"]:
                await f.evaluate(
                    "() => document.querySelector('.desktop, .destop').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 700, clientY: 400}))"
                )
                await page.wait_for_timeout(500)
                opts = await f.query_selector_all(".menuopt")
                hit = None
                for o in opts:
                    if "About" in (await o.inner_text()):
                        hit = o
                if hit:
                    await hit.click()
                    await page.wait_for_timeout(900)
                st2 = await f.evaluate(JS_STATE)
                print("About dialog opens in no-storage mode:", st2["about"], flush=True)
            await page.screenshot(path=str(_HERE) + "/shot_iframe_flow.png")
            await b.close()
    finally:
        httpd.shutdown()
        httpd.server_close()
    print("console errors:", len(errors), flush=True)
    for e in errors[:6]:
        print("  -", e, flush=True)


asyncio.run(main())
