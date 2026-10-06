"""Production packaging acceptance: favicon SVG, animation and clean-URL offline navigation.
Run against npm run preview. Python/Playwright are test-only dependencies.
"""
import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright, expect
from release_browser import URL, INIT
ROOT=Path(__file__).resolve().parents[1]
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        # With storage denied, the screen remains available for reliable visual assertions.
        context=await browser.new_context(viewport={'width':1200,'height':800})
        await context.add_init_script("Object.defineProperty(window,'caches',{value:undefined});")
        page=await context.new_page()
        await page.goto(URL)
        await expect(page.locator('#offline-detail')).to_contain_text('unavailable')
        logo=page.locator('.offlineLogo svg')
        await expect(logo).to_have_attribute('viewBox','0 0 480 480')
        assert await logo.locator('rect').count()==4
        assert await logo.locator('rect').first.evaluate('(e)=>getComputedStyle(e).fill')=='rgb(25, 118, 211)'
        assert await logo.evaluate('(e)=>getComputedStyle(e).animationPlayState')=='paused'
        await page.emulate_media(reduced_motion='reduce')
        assert await logo.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
        assert await logo.locator('rect').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
        await page.screenshot(path=str(ROOT/'artifacts/favicon-installer-reduced-motion.png'))
        print('PASS favicon-matched inline SVG, four panes, error pause and reduced-motion fallback')
        await context.close()
        context=await browser.new_context(viewport={'width':1200,'height':800})
        await context.add_init_script(INIT)
        page=await context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto(URL)
        await page.locator('.offlineLogo svg').wait_for(timeout=10000)
        await page.screenshot(path=str(ROOT/'artifacts/favicon-installer-animated.png'))
        await page.locator('.lockscreen').wait_for(timeout=120000)
        # The static server actually canonicalizes HTML; the worker accepted these
        # during install and normalized their cached response metadata.
        resp=await context.request.get(URL+'index.html',max_redirects=0)
        assert resp.status==308
        assert (await context.request.get(URL+'definitely-missing.js')).status==404
        assert 'Content-Security-Policy'.lower() in (await context.request.get(URL)).headers
        manifest=json.loads((ROOT/'build/offline-manifest.json').read_text())
        cached=await page.evaluate("async()=>{const name=(await caches.keys()).find(k=>k.startsWith('wos-offline:'));return (await (await caches.open(name)).keys()).length;}")
        assert cached>=len(manifest['files'])
        await context.set_offline(True)
        for path in ['index.html','about/','docs/','office/word/','office/excel/','office/powerpoint/']:
            response=await page.goto(URL+path)
            assert response and response.status==200,path
            await expect(page.locator('body')).to_contain_text(re.compile(r'\S'),timeout=15000)
        assert not errors,errors
        print('PASS Pages-style HTML redirects, real 404s, CSP, complete cache, and root/docs/Office navigation offline')
        await browser.close()
if __name__=='__main__':asyncio.run(main())
