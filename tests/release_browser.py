"""Production regression tests with real CacheStorage, offline mode and enforced CSP.
Run after npm run build and npm run preview:
  python tests/release_browser.py
"""
import asyncio, hashlib, json, os
from pathlib import Path
from playwright.async_api import async_playwright, expect
URL = os.environ.get('WOS_TEST_URL', 'http://127.0.0.1:4180/')
ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'artifacts'; ART.mkdir(exist_ok=True)
USER = {'username':'Release Tester','setupComplete':True,'passwordHash':hashlib.sha256(b'1234').hexdigest()}
INIT = "localStorage.setItem('wosUserMirror',JSON.stringify(%s));window.__violations=[];document.addEventListener('securitypolicyviolation',e=>window.__violations.push(e.violatedDirective));" % json.dumps(USER)
async def unlock(page):
    await page.locator('.lockscreen').click(position={'x':400,'y':220})
    await page.locator('.lockPassRow input').fill('1234')
    await page.locator('.lockPassRow input').press('Enter')
    await page.locator('.appwrap').wait_for(state='visible',timeout=15000)
    await page.evaluate("window.__wosStore.dispatch({type:'DESKABOUT',payload:false})")
async def dispatch(page, action, payload='full'):
    await page.evaluate('(a)=>window.__wosStore.dispatch(a)',{'type':action,'payload':payload})
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        ctx=await browser.new_context(viewport={'width':1280,'height':800})
        await ctx.add_init_script(INIT)
        async def github_feed(route):
            await route.fulfill(status=200,content_type='application/json',body=(ROOT/'build/updates/feed.json').read_text(),headers={'Access-Control-Allow-Origin':'*'})
        await ctx.route('https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/updates/feed.json*',github_feed)
        page=await ctx.new_page(); errors=[]; urls=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:urls.append(r.url))
        await page.goto(URL)
        await page.locator('.offlineBoot').wait_for()
        await page.screenshot(path=str(ART/'offline-download.png'))
        await page.locator('.lockscreen').wait_for(timeout=120000)
        await page.wait_for_timeout(17000)
        assert not any('updates/feed.json' in u for u in urls),'feed requested before login'
        assert await page.locator('.appwrap').count()==0,'desktop mounted before login'
        manifest=json.loads((ROOT/'build/offline-manifest.json').read_text())
        cached=await page.evaluate("async()=>{const n=(await caches.keys()).find(k=>k.startsWith('wos-offline:')); return (await(await caches.open(n)).keys()).map(r=>decodeURIComponent(new URL(r.url).pathname.slice(1)));}")
        assert set(f['url'] for f in manifest['files']).issubset(cached)
        assert 'updates/feed.json' not in cached
        assert not [u for u in urls if not u.startswith(URL)],'remote request before login'
        print('PASS complete inventory cached; no external or feed requests before login')
        # Recent successful/failed checks must not suppress the next boot's check.
        await page.evaluate("localStorage.setItem('wos.update.lastCheck',Date.now());localStorage.setItem('wos.update.lastAttempt',Date.now());")
        await unlock(page)
        await page.wait_for_timeout(17000)
        assert len([u for u in urls if 'updates/feed.json' in u])==1
        await dispatch(page,'WALLALOCK'); await unlock(page)
        await page.wait_for_timeout(16000)
        assert len([u for u in urls if 'updates/feed.json' in u])==1,'recheck on every login'
        await dispatch(page,'WALLRESTART')
        await page.locator('.lockscreen').wait_for(timeout=15000)
        await unlock(page)
        await page.wait_for_timeout(16000)
        assert len([u for u in urls if 'updates/feed.json' in u])==2,'in-OS restart did not check'
        await page.reload()
        await page.locator('.lockscreen').wait_for(timeout=30000)
        await page.wait_for_timeout(16000)
        assert len([u for u in urls if 'updates/feed.json' in u])==2,'feed before login on next boot'
        await unlock(page)
        await page.wait_for_timeout(16000)
        assert len([u for u in urls if 'updates/feed.json' in u])==3,'recent check suppressed next boot'
        print('PASS each-boot post-login checks, in-OS restart + hard reload, no duplicate on relogin')
        await dispatch(page,'UPDATEWIN')
        await expect(page.locator('#updateApp')).to_contain_text('v1.02')
        await expect(page.locator('#updateApp')).to_contain_text('Installed')
        assert await page.locator('#updateApp').get_by_role('button',name='Install now',exact=True).count()==0
        await page.screenshot(path=str(ART/'update-current.png'))
        # Resize a window (not only viewport): content must wrap and remain scrollable.
        await page.evaluate("window.__wosStore.dispatch({type:'UPDATEWIN',payload:'resize',dim:{width:360,height:380,top:25,left:20}})")
        await page.wait_for_timeout(400)
        overflow=await page.locator('.updScreen').evaluate('(el)=>el.scrollWidth>el.clientWidth+2')
        assert not overflow,'horizontal overflow in small update window'
        await page.screenshot(path=str(ART/'update-small.png'))
        await page.evaluate("document.body.dataset.theme='dark'")
        await page.screenshot(path=str(ART/'update-dark.png'))
        print('PASS installed notes, current-version CTA, small-window layout and dark render')
        await ctx.set_offline(True)
        await page.reload()
        await page.locator('.lockscreen').wait_for(timeout=30000)
        await unlock(page)
        await dispatch(page,'CORTANAAPP')
        await expect(page.locator('.bbInput')).to_be_enabled(timeout=60000)
        await page.locator('.bbInput').fill('2 + 2')
        await page.locator('.bbInput').press('Enter')
        await page.wait_for_timeout(1500)
        assert await page.evaluate('!!window.BitBrain && !!window.BitMath && !!window.BITBOT_WEIGHTS')
        assert not await page.evaluate('window.__violations'), 'CSP blocked local resources'
        await page.screenshot(path=str(ART/'bitbot-offline.png'))
        # All emitted assets return while offline, not just assets already opened in the UI.
        missing=await page.evaluate("""async files=>{
          const missing=[];
          for(const file of files){try{const r=await fetch(file); if(!r.ok)missing.push(file);}catch{missing.push(file);}}
          return missing;
        }""",[f['url'] for f in manifest['files']])
        assert not missing,missing
        assert not errors,errors
        print(f'PASS offline reload, BitBot CSP-safe boot, all {len(manifest["files"])} local resources fetched offline; zero page errors')
        await ctx.close()
        # Storage-denied and retry UI cannot leave the user on an infinite spinner.
        limited=await browser.new_context()
        await limited.add_init_script("Object.defineProperty(window,'caches',{value:undefined});")
        q=await limited.new_page(); await q.goto(URL)
        await expect(q.locator('#offline-detail')).to_contain_text('unavailable')
        await q.locator('#offline-online').click()
        await q.locator('.App').wait_for()
        print('PASS unsupported-storage online-only escape')
        await browser.close()
if __name__=='__main__': asyncio.run(main())
