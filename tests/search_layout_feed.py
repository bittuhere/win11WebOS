"""Search -> Start coordinate regression and real worker feed-cache isolation.
Run after npm run build, against npm run preview (WOS_TEST_URL supported).
Uses isolated browser profiles and fixture GitHub responses; never publishes updates.
"""
import asyncio, copy, json, re
from playwright.async_api import async_playwright, expect
from release_browser import ROOT, URL, INIT, dispatch
RAW='https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/'
FEED=RAW+'updates/feed.json'
INIT_EXTRA="""
localStorage.setItem('wos.update.muteUntil',Date.now()+7200000);
localStorage.setItem('wos.rotateGate','off');
window.__feedFetches=[];
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.pathname.endsWith('/updates/feed.json')) {
  const request=new Request(input,init);
  window.__feedFetches.push({url:request.url,cache:request.cache});
 }
 return nativeFetch(input,init);
};
"""
GEOMETRY="""()=>{
 const d=document.querySelector('.desktop'),p=document.querySelector('.startMenu'),t=document.querySelector('.taskbar');
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
 return {desktop:box(d),panel:box(p),taskbar:box(t),scroll:[d.scrollTop,d.scrollLeft,document.documentElement.scrollTop,document.body.scrollTop],mode:p.dataset.mode,outerScroll:p.scrollTop};
}"""
async def open_desktop(page):
 await page.goto(URL)
 await page.locator('.lockscreen').wait_for(timeout=120000)
 await page.locator('.lockscreen').click(position={'x':180,'y':160})
 await page.locator('.lockPassRow input').fill('1234')
 await page.locator('.lockPassRow input').press('Enter')
 await page.locator('.appwrap').wait_for(state='visible',timeout=15000)
 await page.evaluate("window.__wosStore.dispatch({type:'DESKABOUT',payload:false})")
async def anchored(page):
 g=await page.evaluate(GEOMETRY);p=g['panel'];t=g['taskbar']
 assert g['scroll']==[0,0,0,0],g
 assert p['y']>=-1 and p['x']>=-1 and p['right']<=g['desktop']['width']+1,g
 assert 0<=t['y']-p['bottom']<=16,g
 assert g['outerScroll']==0,g
 return g
async def layout_case(browser,name,size,mobile=False):
 context=await browser.new_context(viewport=size,is_mobile=mobile,has_touch=mobile)
 await context.add_init_script(INIT+INIT_EXTRA)
 page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await open_desktop(page)
 search=page.locator('.taskbar [data-action="STARTSRC"]').first
 start=page.locator('.taskbar [data-action="STARTOGG"]').first
 await page.evaluate("""()=>{window.__layoutFrames=[];let frames=100;
 const sample=()=>{const d=document.querySelector('.desktop');window.__layoutFrames.push([d.scrollTop,d.scrollLeft,document.body.scrollTop,document.documentElement.scrollTop]);if(--frames)requestAnimationFrame(sample)};requestAnimationFrame(sample)}""")
 await search.click();await page.wait_for_timeout(500)
 await expect(page.get_by_role('textbox',name='Search apps and files')).to_be_focused()
 await anchored(page)
 await page.screenshot(path=str(ROOT/'artifacts'/('search-fixed-'+name+'.png')))
 await start.click();await page.wait_for_timeout(500)
 before=await anchored(page)
 await search.click();await page.wait_for_timeout(500)
 await expect(page.get_by_role('textbox',name='Search apps and files')).to_be_focused()
 assert all(v==[0,0,0,0] for v in await page.evaluate('window.__layoutFrames')),'desktop shifted during slide/focus'
 # Query/preview/scroll are contained inside Search, including long no-match input.
 inp=page.get_by_role('textbox',name='Search apps and files')
 for query in ['notpad','a','x'*200]:
  await inp.fill(query);await page.wait_for_timeout(150)
  await anchored(page)
  assert not await page.locator('.searchMenu').evaluate('e=>e.scrollWidth>e.clientWidth+2'),'Search overflow'
  await page.locator('.shResult').evaluate('e=>e.scrollTop=e.scrollHeight')
  await anchored(page)
 await start.click();await page.wait_for_timeout(500)
 after=await anchored(page)
 for key in ['x','y','width','height']:
  assert abs(before['panel'][key]-after['panel'][key])<1,(before,after)
 # Repeated real taskbar clicks during transitions must not corrupt shared state.
 for _ in range(3):
  await search.click();await page.wait_for_timeout(40)
  await search.click();await page.wait_for_timeout(40)
  await start.click();await page.wait_for_timeout(40)
 await page.wait_for_timeout(500);await anchored(page)
 await page.screenshot(path=str(ROOT/'artifacts'/('start-after-search-fixed-'+name+'.png')))
 # Search from an already-open Start must focus, select a fuzzy result and launch it.
 await search.click();await page.wait_for_timeout(500)
 await inp.fill('notpad');await inp.press('Enter')
 await expect(page.locator('#notepadApp')).to_be_visible(timeout=15000)
 await expect(page.locator('.startMenu')).to_have_attribute('data-hide','true')
 await search.click();await page.wait_for_timeout(500);await anchored(page)
 await page.emulate_media(reduced_motion='reduce')
 await start.click();await page.wait_for_timeout(100);await anchored(page)
 assert await page.locator('.startMenu').evaluate('e=>getComputedStyle(e).transitionDuration')=='0s'
 assert not errors,errors
 await context.close()
 print('PASS Search/Start geometry, rapid switching, bounded results, focus and launch:',name)
async def feed_case(browser):
 context=await browser.new_context(viewport={'width':1280,'height':800})
 await context.add_init_script(INIT+INIT_EXTRA)
 base=json.loads((ROOT/'build/updates/feed.json').read_text());seen=[]
 async def reply(route):
  seen.append(route.request.url);data=copy.deepcopy(base);build=2+len(seen)
  data['latest'].update(version=f'1.{build:02d}',major=1,build=build,notes=f'updates/notes/1.{build:02d}.md')
  await route.fulfill(status=200,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=31536000'})
 await context.route(FEED+'*',reply)
 await context.route(RAW+'updates/notes/*.md*',lambda route:route.fulfill(status=404,body='Not published',headers={'Access-Control-Allow-Origin':'*'}))
 page=await context.new_page();await open_desktop(page)
 verification=re.search(r'name="google-site-verification" content="([^"]+)"',(ROOT/'index.html').read_text())
 assert verification,'Attached verification tag was dropped'
 await expect(page.locator('meta[name="google-site-verification"]')).to_have_attribute('content',verification.group(1))
 assert await page.evaluate('!!navigator.serviceWorker.controller')
 await dispatch(page,'UPDATEWIN')
 await expect(page.locator('.updHeroCopy h1')).to_contain_text('1.03')
 await page.get_by_role('button',name='Check for updates',exact=True).click()
 await expect(page.locator('.updHeroCopy h1')).to_contain_text('1.04')
 assert len(seen)==2 and seen[0]!=seen[1],seen
 requests=await page.evaluate('window.__feedFetches')
 assert len(requests)==2 and all(r['cache']=='no-store' for r in requests),requests
 assert all('cb=' in r['url'] for r in requests)
 cached=await page.evaluate("async()=>{const urls=[];for(const name of await caches.keys())for(const r of await(await caches.open(name)).keys())urls.push(r.url);return urls;}")
 assert not any('/updates/feed.json' in url for url in cached),cached
 response=await context.request.get(URL+'updates/feed.json')
 assert 'no-store' in response.headers.get('cache-control','')
 # Poison an isolated current app cache: neither local nor remote feed may be
 # served from CacheStorage, even with a stale entry left by older code.
 await page.evaluate("""async raw=>{const key=(await caches.keys()).find(k=>k.startsWith('wos-offline:'));window.__testCache=key;const c=await caches.open(key);for(const url of [new URL('updates/feed.json',location.href).href,raw])await c.put(url,new Response(JSON.stringify({latest:{version:'99.99'}}),{headers:{'Content-Type':'application/json'}}));}""",FEED)
 local=await page.evaluate("async()=>{const r=await fetch('updates/feed.json');return r.json();}")
 assert local['latest']['version']==base['latest']['version'],'service worker served poisoned local feed'
 await context.unroute(FEED+'*')
 await context.set_offline(True)
 results=await page.evaluate("""async raw=>{const result=[];for(const url of ['updates/feed.json',raw]){try{await fetch(url);result.push('cached')}catch{result.push('network-required')}}return result;}""",FEED)
 assert results==['network-required','network-required'],results
 await page.get_by_role('button',name='Check for updates',exact=True).click()
 await expect(page.locator('.updError')).to_contain_text('offline')
 assert await page.get_by_role('button',name='Install now',exact=True).count()==0
 await context.close()
 print('PASS attached HTML verification tag; changing GitHub responses; no-store + unique URLs; no cached feeds; poisoned-cache and offline rejection')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for name,size,mobile in [('desktop',{'width':1280,'height':800},False),('short-desktop',{'width':1024,'height':600},False),('narrow-desktop',{'width':480,'height':800},False),('phone-landscape',{'width':844,'height':390},True),('phone-portrait',{'width':390,'height':844},True)]:
   await layout_case(browser,name,size,mobile)
  await feed_case(browser)
  await browser.close()
if __name__=='__main__':asyncio.run(main())
