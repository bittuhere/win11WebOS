"""Build two real releases, test failed upgrade + retry + confirmed new boot.
Temporarily changes release.json/feed while creating fixtures; ALWAYS restores source.
Do not run concurrently with another build. Requires Python Playwright/Chromium.
"""
import asyncio, hashlib, json, shutil, subprocess, threading
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'artifacts/upgrade-old'
state={'root':OLD,'fail':False}
CSP=next(line.split(':',1)[1].strip() for line in (ROOT/'public/_headers').read_text().splitlines() if 'Content-Security-Policy:' in line)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(state['root']),**kwargs)
    def do_GET(self):
        if state['fail'] and self.path.split('?')[0]=='/bitbot/weights.js':
            self.send_response(404); self.send_header('Content-Length','18'); self.end_headers(); self.wfile.write(b'deliberate failure'); return
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control','no-store'); self.send_header('Content-Security-Policy',CSP)
        super().end_headers()
    def log_message(self,*args): pass
async def login(page):
    await page.locator('.lockscreen').wait_for(timeout=120000)
    await page.locator('.lockscreen').click(position={'x':400,'y':220})
    await page.locator('.lockPassRow input').fill('1234'); await page.locator('.lockPassRow input').press('Enter')
    await page.locator('.appwrap').wait_for(state='visible',timeout=15000)
    await page.evaluate("window.__wosStore.dispatch({type:'DESKABOUT',payload:false})")
async def test():
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        ctx=await browser.new_context(viewport={'width':1280,'height':800})
        user={'username':'Upgrade Tester','setupComplete':True,'passwordHash':hashlib.sha256(b'1234').hexdigest()}
        await ctx.add_init_script("localStorage.setItem('wosUserMirror',JSON.stringify(%s));"%json.dumps(user))
        async def github_feed(route):
            # Feed source follows the test's deployed release, including the staged failure.
            await route.fulfill(status=200,content_type='application/json',body=(state['root']/'updates/feed.json').read_text(),headers={'Access-Control-Allow-Origin':'*'})
        await ctx.route('https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/updates/feed.json*',github_feed)
        async def github_notes(route):
            relative=route.request.url.split('/public/',1)[1].split('?',1)[0]
            file=state['root']/relative
            await route.fulfill(status=200 if file.exists() else 404,content_type='text/plain',body=file.read_text() if file.exists() else 'Not found',headers={'Access-Control-Allow-Origin':'*'})
        await ctx.route('https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/updates/notes/*.md*',github_notes)
        page=await ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:4191/');await login(page)
        await page.evaluate("window.__wosStore.dispatch({type:'UPDATEWIN',payload:'full'});localStorage.setItem('personal-sentinel','keep');")
        await expect(page.locator('#updateApp')).to_contain_text('v1.01')
        await expect(page.locator('.updHeroCopy h1')).to_have_text("You're up to date")
        oldcache=await page.evaluate("async()=> (await caches.keys()).find(k=>k.startsWith('wos-offline:'))")
        await page.evaluate("async()=>{const c=await caches.open('another-app-cache');await c.put('/sentinel',new Response('keep'));}")
        state['root']=ROOT/'build'; state['fail']=True
        await page.get_by_role('button',name='Check for updates',exact=True).click()
        await expect(page.locator('.updHeroCopy h1')).to_contain_text('1.02')
        await page.get_by_role('button',name='Install now',exact=True).click()
        await expect(page.locator('.updError')).to_contain_text('not installed',timeout=120000)
        assert oldcache in await page.evaluate('caches.keys()')
        assert await page.evaluate("localStorage.getItem('personal-sentinel')")=='keep'
        assert await page.evaluate("localStorage.getItem('wos.update.history')")==None
        assert 'another-app-cache' in await page.evaluate('caches.keys()')
        print('PASS failed download preserves previous offline cache, unrelated app cache and personal data; no false success history')
        state['fail']=False
        await page.get_by_role('button',name='Check for updates',exact=True).click()
        await expect(page.get_by_role('button',name='Install now',exact=True)).to_be_enabled()
        await page.get_by_role('button',name='Install now',exact=True).click()
        await page.locator('.lockscreen').wait_for(timeout=120000)
        await login(page)
        await page.evaluate("window.__wosStore.dispatch({type:'DESKABOUT',payload:{open:true}})")
        await expect(page.locator('.aboutVerNum')).to_have_text('v1.02')
        await page.evaluate("window.__wosStore.dispatch({type:'DESKABOUT',payload:false});window.__wosStore.dispatch({type:'UPDATEWIN',payload:'full'})")
        await expect(page.locator('#updateApp')).to_contain_text('v1.02')
        await expect(page.locator('.updHeroCopy h1')).to_have_text("You're up to date")
        history=await page.evaluate("JSON.parse(localStorage.getItem('wos.update.history'))")
        assert history[0]['version']=='v1.02',history
        assert await page.evaluate("localStorage.getItem('personal-sentinel')")=='keep'
        assert 'another-app-cache' in await page.evaluate('caches.keys()')
        assert not errors,errors
        await ctx.set_offline(True);await page.reload();await login(page)
        print('PASS v1.01 → v1.02 install/restart, About version, confirmed history and offline reboot; zero page errors')
        await browser.close()
def main():
    saved={name:(ROOT/name).read_bytes() for name in ['release.json','public/updates/feed.json']}
    log=ROOT/'artifacts/upgrade-build.log';log.parent.mkdir(exist_ok=True)
    try:
        r=json.loads(saved['release.json']);r['build']=1;(ROOT/'release.json').write_text(json.dumps(r))
        feed=json.loads(saved['public/updates/feed.json']);feed['latest'].update(version='1.01',build=1,notes='updates/notes/1.01.md');(ROOT/'public/updates/feed.json').write_text(json.dumps(feed))
        with log.open('w') as out: subprocess.run(['npm','run','build'],cwd=ROOT,stdout=out,stderr=subprocess.STDOUT,check=True)
        shutil.rmtree(OLD,ignore_errors=True);shutil.copytree(ROOT/'build',OLD)
    finally:
        for name,data in saved.items():(ROOT/name).write_bytes(data)
        with log.open('a') as out:subprocess.run(['npm','run','build'],cwd=ROOT,stdout=out,stderr=subprocess.STDOUT,check=True)
    server=ThreadingHTTPServer(('127.0.0.1',4191),Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:asyncio.run(test())
    finally:server.shutdown();shutil.rmtree(OLD,ignore_errors=True)
if __name__=='__main__':main()
