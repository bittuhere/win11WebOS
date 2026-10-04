"""Round 27 — file types and the Notepad open path.

Three things are guarded here:

A  a double-click in File Explorer always shows the file's CURRENT bytes,
   even when Notepad has an older copy of that path in its saved session
   (the reported "opened Notepad but not with the file")
B  every extension opens in the app that owns it — .mp4 in Movies, .mp3 in
   Groove, .html in the browser — "Open with" can override any of them, and
   a type this PC cannot run says so instead of opening an empty window
C  the taskbar button of a background window brings it forward (it used to
   minimize a maximized-but-unfocused window)
"""
import os, asyncio, hashlib, json
from playwright.async_api import async_playwright

_HERE = os.path.dirname(os.path.abspath(__file__))
URL = "http://127.0.0.1:4180/index.html"
PW = "1234"
USER = {"username": "Tester", "setupComplete": True, "passwordHash": hashlib.sha256(PW.encode()).hexdigest()}

RESULTS = []


def check(name, ok, extra=""):
    RESULTS.append((name, bool(ok)))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("   :: " + str(extra)) if extra else ""), flush=True)


NOTEPAD = """
() => {
  const w = document.querySelector('#notepadApp');
  if (!w) return { open: false };
  const ta = w.querySelector('textarea');
  return { open: w.dataset.hide === 'false', hidden: w.dataset.hide,
           tabs: [...w.querySelectorAll('.npTab')].map(n => n.textContent.trim()),
           text: ta ? ta.value : null, title: (w.querySelector('.tbTitle')?.textContent || '').trim() };
}
"""

WINDOWS = "() => [...document.querySelectorAll('[id$=App]')].map(n => ({ id: n.id, hide: n.dataset.hide }))"

TOP = "() => ({ hz: window.__wosStore.getState().apps.hz, z: Object.fromEntries(Object.entries(window.__wosStore.getState().apps).filter(([k]) => k !== 'hz').map(([k, v]) => [k, v && v.z])) })"


async def boot(page):
    await page.goto(URL, wait_until="domcontentloaded")
    await page.wait_for_timeout(4200)
    await page.add_style_tag(content=".wosRotateGate{display:none !important}")
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


async def goto_folder(page, folder):
    await page.evaluate("window.__wosStore.dispatch({type:'EXPLORER', payload:'full'})")
    await page.wait_for_timeout(1200)
    await page.dblclick("#explorerApp .fxPath")
    await page.wait_for_timeout(250)
    await page.fill("#explorerApp .fxPath input", folder)
    await page.keyboard.press("Enter")
    await page.wait_for_timeout(1100)


async def dblname(page, name, folder, wait=1700):
    """Raise Explorer, go to the folder, double-click the file — like a person."""
    await goto_folder(page, folder)
    el = await page.query_selector(f'#explorerApp .fxItem:has-text("{name}")')
    if not el:
        return False
    await el.dblclick()
    await page.wait_for_timeout(wait)
    return True


async def _prompt(page):
    return await page.evaluate("() => document.querySelector('#terminalApp #curcmd')?.textContent || ''")


async def _stack(page):
    return await page.evaluate("() => [...document.querySelectorAll('#terminalApp pre.cmdLine')].map(n => n.textContent)")


async def term(page, folder, lines):
    """Type into the Terminal's contentEditable prompt, like a person would.

    Each line is verified twice — what the prompt really holds before Enter,
    and the "Wrote …" receipt afterwards — because a keystroke or an Enter
    lost to a re-render used to leave files missing (or worse, named after the
    next command: "page.htmlecho \"hello\" > page.html") and then look like an
    app bug."""
    await page.evaluate("window.__wosStore.dispatch({type:'TERMINAL', payload:'full'})")
    await page.wait_for_timeout(1400)

    async def run(line):
        """Put the line in the prompt, then press Enter for real.

        Typing the line with the keyboard is what a person does, but under
        automation the prompt can lose single characters (a browser artifact —
        plain typing is exercised by the other suites). Setting the prompt's
        text and pressing Enter still runs the REAL command path."""
        for attempt in range(4):
            await page.evaluate("""(t) => {
                const n = document.querySelector('#terminalApp #curcmd');
                if (!n) return false;
                n.textContent = t;
                n.focus();
                return true;
            }""", line)
            before = len(await _stack(page))
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(600)
            if (await _prompt(page)).strip() == "" or len(await _stack(page)) > before:
                return True
            print("        (Enter did not reach the prompt — retrying the line)", flush=True)
        return False

    await run(f"cd {folder}")
    for line in lines:
        await run(line)

    # the stack is the receipt: no "Wrote" means the file is not there
    for line in lines:
        if ">" not in line:
            continue
        target = line.split(">")[-1].strip()
        if not any(w.strip().endswith(target) for w in await _stack(page) if w.startswith("Wrote")):
            print(f"        (no receipt for {target} — writing it again)", flush=True)
            await run(line)
    await page.wait_for_timeout(300)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900})
        await ctx.add_init_script(
            f"localStorage.setItem('wosUserMirror', JSON.stringify({json.dumps(USER)}));"
            "localStorage.setItem('locked','false');")
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("  PAGEERROR", str(e)[:200], flush=True))
        await boot(page)

        # ---------------------------------------------------------------- A
        print("\n[A] the saved session never beats the file on disk", flush=True)
        await goto_folder(page, "C:\\Users\\Blue\\Documents")
        folder = await page.evaluate("() => window.__wosStore.getState().files.cpath")
        check("Explorer is somewhere real", bool(folder), folder)

        await term(page, folder, [
            'echo "first-file-contents" > a.txt',
            'echo "second-file-contents" > b.txt',
        ])
        await goto_folder(page, folder)
        items = await page.evaluate("() => [...document.querySelectorAll('#explorerApp .fxItem')].map(n=>n.textContent.trim())")
        check("both files are in the folder", "a.txt" in items and "b.txt" in items, items)

        # an old copy of a.txt, as a returning user would have
        await page.evaluate("""async (p) => {
            await new Promise((res, rej) => {
              const rq = indexedDB.open('WebOS', 3);
              rq.onsuccess = () => {
                const tx = rq.result.transaction('kv', 'readwrite');
                tx.objectStore('kv').put({ key: 'notepad.session', value: [
                  { id: 'doc-old', name: 'a.txt', text: 'STALE-CONTENT-FROM-LAST-SESSION',
                    path: p, eol: 'crlf', enc: 'utf8', wrap: true }] });
                tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error);
              };
            });
        }""", folder + "\\a.txt")
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(4500)
        await page.add_style_tag(content=".wosRotateGate{display:none !important}")
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
        await goto_folder(page, folder)

        await dblname(page, "a.txt", folder)
        st = await page.evaluate(NOTEPAD)
        check("the double-click opens the real file, not the saved copy",
              st["text"] == "first-file-contents", repr(st["text"])[:60])
        check("and the window really is the Notepad", st["open"], st)

        await dblname(page, "b.txt", folder)
        st = await page.evaluate(NOTEPAD)
        check("a second file opens with its own contents", st["text"] == "second-file-contents", repr(st["text"])[:60])
        titles = await page.evaluate("() => [...document.querySelectorAll('#notepadApp .npTab')].map(n => n.getAttribute('title'))")
        check("both files have their own tab", sorted(st["tabs"]) == ["a.txt", "b.txt"],
              f'{st["tabs"]} / {titles}')
        check("every tab shows one clean Windows path",
              bool(titles) and all("\\\\" not in t for t in titles), titles)

        await dblname(page, "a.txt", folder, wait=1500)
        st = await page.evaluate(NOTEPAD)
        check("re-opening a file still shows that file", st["text"] == "first-file-contents", repr(st["text"])[:60])
        check("re-opening does not duplicate its tab", st["tabs"].count("a.txt") == 1, st["tabs"])

        # the disk wins even after the file changes underneath an open tab
        await term(page, folder, ['echo "changed-on-disk" > a.txt'])
        await dblname(page, "a.txt", folder)
        st = await page.evaluate(NOTEPAD)
        check("an edited-on-disk file reloads to the new bytes", st["text"] == "changed-on-disk", repr(st["text"])[:60])

        # unsaved edits are defended, not destroyed
        await page.click("#notepadApp textarea")
        await page.keyboard.type("MY-UNSAVED-EDIT")
        await page.wait_for_timeout(400)
        await dblname(page, "b.txt", folder, wait=1500)
        await dblname(page, "a.txt", folder, wait=1600)
        dlg = await page.query_selector(".wosDlg")
        check("a dirty tab asks before a reload throws edits away", bool(dlg),
              (await page.inner_text(".wosDlg"))[:60] if dlg else "no dialog")
        if dlg:
            await (await page.query_selector(".wosDlg button:has-text('Keep my edits')")).click()
            await page.wait_for_timeout(600)
        st = await page.evaluate(NOTEPAD)
        check("choosing to keep them keeps them",
              "MY-UNSAVED-EDIT" in (st["text"] or ""), repr(st["text"])[:40])

        # ---------------------------------------------------------------- B
        print("\n[B] every extension opens in the app that owns it", flush=True)
        await term(page, folder, [
            'echo "hello from a page" > page.html',
            'echo "not really video" > clip.mp4',
            'echo "not really video" > clip.webm',
            'echo "not really audio" > song.mp3',
            'echo "not really audio" > song.wav',
            'echo "just text" > notes.txt',
            'echo "packed" > bundle.zip',
            'echo "MZ" > setup.exe',
        ])

        async def dbl(name, wait=2000):
            """Double-click a file in Explorer and report which windows are open.

            Toasts are matched against THIS file's name, so a toast from an
            earlier step can never be mistaken for this one's answer."""
            await goto_folder(page, folder)
            el = await page.query_selector(f'#explorerApp .fxItem:has-text("{name}")')
            if not el:
                # the listing may predate the file: ask for a refresh and retry
                await page.evaluate("() => { const s = window.__wosStore.getState().files;"
                                    " window.__wosStore.dispatch({type:'FILEDIR', payload:s.cdir}); }")
                await page.wait_for_timeout(900)
                el = await page.query_selector(f'#explorerApp .fxItem:has-text("{name}")')
            if not el:
                listing = await page.evaluate("() => [...document.querySelectorAll('#explorerApp .fxItem')].map(n=>n.textContent.trim())")
                print("        (folder holds:", listing, ")", flush=True)
                return {"missing": True, "listing": listing}
            before = [w["id"] for w in await page.evaluate(WINDOWS) if w["hide"] == "false"]
            listing = []
            await el.dblclick()
            waited, open_ids, toast = 0, [], []
            while waited < wait:
                await page.wait_for_timeout(200)
                waited += 200
                open_ids = [w["id"] for w in await page.evaluate(WINDOWS) if w["hide"] == "false"]
                toast = await page.evaluate("""(n) => [...document.querySelectorAll('.wosToastTitle, .wosToastMsg')]
                    .map(x => x.textContent).filter(t => t.includes(n))""", name)
                if toast or [i for i in open_ids if i not in before]:
                    break
            return {"open": open_ids, "toast": toast, "new": [i for i in open_ids if i not in before]}

        r = await dbl("clip.mp4")
        check(".mp4 opens in Movies", "moviesApp" in r.get("open", []), r)

        r = await dbl("clip.webm")
        check(".webm opens in Movies too", "moviesApp" in r.get("open", []), r)

        r = await dbl("song.mp3")
        check(".mp3 opens in Groove Music", "grooveApp" in r.get("open", []), r)

        r = await dbl("song.wav")
        check(".wav opens in Groove Music", "grooveApp" in r.get("open", []), r)

        r = await dbl("page.html")
        check(".html opens in the browser", "edgeApp" in r.get("open", []), r)
        frames = await page.evaluate("() => [...document.querySelectorAll('#edgeApp iframe')].map(f => f.getAttribute('src') || '')")
        check("the page is really loaded in it", any(x.startswith("blob:") for x in frames), frames[:2])

        r = await dbl("notes.txt")
        check(".txt still opens in Notepad", "notepadApp" in r.get("open", []), r)

        r = await dbl("bundle.zip", wait=1600)
        check("a .zip is refused honestly, with a toast and no new window",
              bool(r.get("toast")) and not r.get("new"), r)

        r = await dbl("setup.exe", wait=1600)
        check("a .exe says it cannot run here",
              bool(r.get("toast")) and not r.get("new"), r)

        # ---- Open with: the .html case from the report
        await goto_folder(page, folder)
        el = await page.query_selector('#explorerApp .fxItem:has-text("page.html")')
        await el.click(button="right")
        await page.wait_for_timeout(500)
        menu = await page.inner_text(".fxCtx")
        check("right-clicking .html offers “Open with”", "Open with" in menu, menu[:90].replace("\n", " | "))
        check("…and Notepad is one of the choices", "Notepad" in menu, menu[:90].replace("\n", " | "))
        before = sorted([w["id"] for w in await page.evaluate(WINDOWS) if w["hide"] == "false"])
        await page.click('.fxCtx .fxCtxApp[data-app="notepad"]')
        await page.wait_for_timeout(1600)
        st = await page.evaluate(NOTEPAD)
        check("choosing Notepad opens the HTML as text", st["text"] == "hello from a page", repr(st["text"])[:60])

        # ---- the "Always use" override is a real association
        await goto_folder(page, folder)
        el = await page.query_selector('#explorerApp .fxItem:has-text("notes.txt")')
        await el.click(button="right")
        await page.wait_for_timeout(500)
        await page.click(".fxCtx .fxCtxApp[data-app='edge']")
        await page.wait_for_timeout(1400)
        win = await page.evaluate("() => document.querySelector('#notepadApp')?.dataset.hide")
        check("“Open with → Browser” opens the browser, not Notepad",
              await page.evaluate("() => document.querySelector('#edgeApp')?.dataset.hide") == "false", win)

        await goto_folder(page, folder)
        el = await page.query_selector('#explorerApp .fxItem:has-text("notes.txt")')
        await el.click(button="right")
        await page.wait_for_timeout(500)
        await page.click(".fxCtx .fxCtxAlways")
        await page.wait_for_timeout(700)
        check("“Always use Browser for .txt” is stored",
              await page.evaluate("() => (JSON.parse(localStorage.getItem('wos.fileAssoc')||'{}')).txt") == "edge",
              await page.evaluate("() => localStorage.getItem('wos.fileAssoc')"))

        r = await dbl("notes.txt")
        check("after the override, .txt double-clicks into the browser", "edgeApp" in r.get("open", []), r)

        await goto_folder(page, folder)
        el = await page.query_selector('#explorerApp .fxItem:has-text("notes.txt")')
        await el.click(button="right")
        await page.wait_for_timeout(500)
        await page.click(".fxCtx .fxCtxAlways")
        await page.wait_for_timeout(700)
        r = await dbl("notes.txt")
        check("resetting the association restores Notepad", "notepadApp" in r.get("open", []), r)

        # exotic types: the icon is real, not a broken image or a guess
        await term(page, folder, ['echo "x" > poster.psd', 'echo "x" > theme.svelte',
                                  'echo "x" > data.tsv', 'echo "x" > app.apk'])
        await goto_folder(page, folder)
        icons = await page.evaluate("""() => [...document.querySelectorAll('#explorerApp .fxItem')].map(n => {
            const img = n.querySelector('img.fxItemIco');
            return { name: (n.textContent || '').trim(), src: img ? img.getAttribute('src') : null,
                     w: img ? img.naturalWidth : 0 };
        })""")
        wanted = ["poster.psd", "theme.svelte", "data.tsv", "app.apk"]
        got = {i["name"]: i for i in icons if i["name"] in wanted}
        check("every exotic file type shows a real icon (no broken images)",
              len(got) == len(wanted) and all(i["src"] and i["w"] > 0 for i in got.values()), got)

        # an image goes to Photos
        await page.evaluate("""() => {
            const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
            const st = window.__wosStore.getState().files;
            window.__wosWritePhoto = null;
        }""")
        await term(page, folder, ['echo "x" > pic.png'])
        r = await dbl("pic.png")
        check("a .png goes to Photos", "photosApp" in r.get("open", []), r)

        # the long tail — the request was "and so on", not just three types
        await term(page, folder, ['echo "x" > extra.mkv', 'echo "x" > extra.m4a', 'echo "x" > code.json'])
        r = await dbl("extra.mkv")
        check(".mkv also opens in Movies", "moviesApp" in r.get("open", []), r)
        r = await dbl("extra.m4a")
        check(".m4a also opens in Groove Music", "grooveApp" in r.get("open", []), r)
        await dbl("code.json", wait=1600)
        st = await page.evaluate(NOTEPAD)
        check(".json opens as text in Notepad",
              "code.json" in st.get("tabs", []) and (st["text"] or "").strip() == "x", st.get("tabs"))

        # ---------------------------------------------------------------- C
        print("\n[C] the taskbar brings a background window forward", flush=True)
        await dblname(page, "b.txt", folder, wait=1500)
        top = await page.evaluate(TOP)
        check("Notepad is in front after opening a file",
              top["z"].get("notepad") == top["hz"], (top["hz"], top["z"].get("notepad")))

        await page.click('.tsbar .tsIcon[data-action="EXPLORER"]')
        await page.wait_for_timeout(800)
        top2 = await page.evaluate(TOP)
        wins = await page.evaluate(WINDOWS)
        exp = [w for w in wins if w["id"] == "explorerApp"][0]
        check("clicking Explorer's taskbar button raises it, not hides it",
              top2["z"].get("explorer") == top2["hz"] and exp["hide"] == "false",
              (top2["hz"], top2["z"].get("explorer"), exp["hide"]))

        await page.click('.tsbar .tsIcon[data-action="EXPLORER"]')
        await page.wait_for_timeout(800)
        top3 = await page.evaluate(TOP)
        check("clicking it again minimizes the focused window (Windows behaviour)",
              top3["z"].get("explorer") != top3["hz"], (top3["hz"], top3["z"].get("explorer")))

        # ---------------------------------------------------------------- D
        print("\n[D] Notepad closes like Windows Notepad", flush=True)
        await dblname(page, "notes.txt", folder, wait=1600)
        await page.click("#notepadApp textarea")
        await page.keyboard.type("MY-CLOSE-EDIT")
        await page.wait_for_timeout(500)
        await page.evaluate("window.__wosStore.dispatch({type:'NOTEPAD', payload:'full'})")
        await page.wait_for_timeout(700)

        await page.click("#notepadApp .closeBtn")
        await page.wait_for_timeout(900)
        dlg = await page.query_selector(".wosDlg")
        text = (await page.inner_text(".wosDlg")) if dlg else ""
        check("closing with unsaved tabs asks first",
              bool(dlg) and ("save changes" in text.lower() or "unsaved" in text.lower()),
              text[:70].replace("\n", " | "))

        if dlg:
            await page.click(".wosDlg .wosBtn:not(.accent):not(.danger)")   # Cancel
            await page.wait_for_timeout(800)
        st = await page.evaluate(NOTEPAD)
        check("“Cancel” keeps the window open with the edits",
              st.get("open") and "MY-CLOSE-EDIT" in (st.get("text") or ""), (st.get("open"), repr(st.get("text"))[:30]))

        await page.click("#notepadApp .closeBtn")
        await page.wait_for_timeout(900)
        if await page.query_selector(".wosDlg"):
            await page.click(".wosDlg .wosBtn.danger")                     # Don't save
            await page.wait_for_timeout(1400)
        st = await page.evaluate(NOTEPAD)
        check("“Don't save” really closes the window", st.get("hidden") == "true" or not st.get("open"), st.get("hidden"))

        await page.evaluate("window.__wosStore.dispatch({type:'NOTEPAD', payload:'full'})")
        await page.wait_for_timeout(1800)
        tab = await page.query_selector("#notepadApp .npTab:has-text('notes.txt')")
        if tab:
            await tab.click()
            await page.wait_for_timeout(700)
        st = await page.evaluate(NOTEPAD)
        check("reopening shows the file from disk, not the discarded edit",
              "MY-CLOSE-EDIT" not in (st.get("text") or ""), repr(st.get("text"))[:40])

        # ---------------------------------------------------------------- E
        # the installable app's shortcuts deep-link straight into an app
        print("\n[E] a manifest shortcut boots into its app", flush=True)
        await page.goto(URL + "?app=notepad", wait_until="domcontentloaded")
        await page.wait_for_timeout(5400)
        await page.add_style_tag(content=".wosRotateGate{display:none !important}")
        if await page.query_selector(".lockscreen"):
            await page.click(".lockscreen", position={"x": 100, "y": 200})
            await page.wait_for_timeout(900)
            await page.keyboard.type(PW)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(4200)
        for _ in range(3):
            # the restored Notepad can sit above the About panel here — dismiss
            # it straight through the DOM, this step is about the deep link
            await page.evaluate("document.querySelector('.aboutApp .okbtn div')?.click()")
            await page.wait_for_timeout(500)
        st = await page.evaluate(NOTEPAD)
        check("?app=notepad opens Notepad on boot (Store/PWA shortcuts)", bool(st.get("open")), st.get("open"))

        await page.screenshot(path=os.path.join(_HERE, "file_types_end.png"))
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
