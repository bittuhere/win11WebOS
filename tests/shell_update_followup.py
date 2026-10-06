"""Real clicks/motion, standard title-bar opacity and deterministic GitHub update UI errors.
Run against npm run preview. Never publishes a fake release or changes production data.
"""
import asyncio, copy, json, re
from pathlib import Path
from playwright.async_api import async_playwright, expect
from release_browser import ROOT, URL, INIT, unlock, dispatch
RAW='https://raw.githubusercontent.com/bittuhere/win11WebOS/refs/heads/main/public/'
ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  context=await browser.new_context(viewport={'width':1280,'height':800},record_video_dir=str(ART/'motion-recordings'),record_video_size={'width':1280,'height':800})
  await context.add_init_script(INIT+"localStorage.setItem('wos.update.muteUntil',Date.now()+7200000);")
  base=json.loads((ROOT/'build/updates/feed.json').read_text())
  state={'mode':'current','notes':'missing','requests':0}
  async def feed(route):
   state['requests']+=1
   mode=state['mode']; data=copy.deepcopy(base)
   if mode=='delay':await asyncio.sleep(.8)
   if mode=='timeout':await asyncio.sleep(13);await route.abort();return
   if mode=='network':await route.abort('failed');return
   if mode in ['404','500']:
    await route.fulfill(status=int(mode),body='Unavailable',headers={'Access-Control-Allow-Origin':'*'});return
   if mode=='invalid':
    await route.fulfill(status=200,body='<html>not JSON</html>',headers={'Access-Control-Allow-Origin':'*'});return
   if mode=='malformed':data={'feed':1,'latest':{'version':'garbage'}}
   if mode in ['quality','feature','mismatch','badnotes']:
    v,major,build=('2.00',2,0) if mode=='feature' else ('1.03',1,3)
    data['latest'].update(version=v,major=major,build=build,title='Fixture '+v,notes='updates/notes/'+v+'.md')
    if mode=='mismatch':data['latest']['build']=99
    if mode=='badnotes':data['latest']['notes']='../../private.md'
   if mode=='older':data['latest'].update(version='1.01',major=1,build=1)
   await route.fulfill(status=200,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*'})
  async def notes(route):
   if state['notes']=='missing':await route.fulfill(status=404,body='Not found',headers={'Access-Control-Allow-Origin':'*'})
   else:await route.fulfill(status=200,content_type='text/plain',body='# Future fixture notes\nVerified notes retry works.',headers={'Access-Control-Allow-Origin':'*'})
  await context.route(RAW+'updates/feed.json*',feed)
  await context.route(RAW+'updates/notes/*.md*',notes)
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(URL);await page.locator('.lockscreen').wait_for(timeout=120000);await unlock(page)
  sample='e=>{const s=getComputedStyle(e),m=new DOMMatrixReadOnly(s.transform);return {y:m.m42,a:m.a,d:m.d,visibility:s.visibility,transition:s.transitionDuration};}'
  for panel,button in [('.startMenu','.taskbar [data-action="STARTOGG"]'),('.sidePane','.taskbar [data-action="PANETOGG"]')]:
   el=page.locator(panel);btn=page.locator(button).first
   closed=await el.evaluate(sample);assert closed['y']>150,(panel,closed)
   await btn.click();await page.wait_for_timeout(90);middle=await el.evaluate(sample)
   assert 0<middle['y']<closed['y'],(panel,middle,closed)
   assert middle['a']==middle['d']==1,'flyout scales instead of sliding'
   await page.wait_for_timeout(450);opened=await el.evaluate(sample);assert abs(opened['y'])<.1
   await page.screenshot(path=str(ART/('start-open.png' if panel=='.startMenu' else 'quick-settings-open.png')))
   await btn.click();await page.wait_for_timeout(75);closing=await el.evaluate(sample)
   assert 0<closing['y']<closed['y'] and closing['visibility']=='visible',closing
   # Reverse during closing: must travel back from the current transform, not snap.
   await btn.click();await page.wait_for_timeout(500);assert abs((await el.evaluate(sample))['y'])<.1
   await btn.click();await page.wait_for_timeout(300)
   assert await el.get_attribute('inert') is not None
   assert (await el.evaluate(sample))['visibility']=='hidden'
   print('PASS actual taskbar clicks, slide open/close + interruption:',panel)
  await page.emulate_media(reduced_motion='reduce')
  for selector in ['.startMenu','.sidePane']:
   assert (await page.locator(selector).evaluate(sample))['transition']=='0s'
  await page.emulate_media(reduced_motion='no-preference')
  await dispatch(page,'SOLITAIREAPP');await dispatch(page,'UPDATEWIN')
  await expect(page.locator('.updHeroCopy h1')).to_have_text("You're up to date")
  for theme,color in [('light','rgb(243, 243, 243)'),('dark','rgb(32, 32, 32)')]:
   await page.evaluate('(theme)=>document.body.dataset.theme=theme',theme)
   for selector in ['#solitaireApp > .toolbar','#updateApp > .toolbar']:
    await expect(page.locator(selector)).to_have_css('background-color',color)
   await page.screenshot(path=str(ART/('titlebars-'+theme+'.png')))
  print('PASS solid light/dark standard title bars; reduced-motion switch')
  await page.evaluate("document.body.dataset.theme='light'")
  check=page.get_by_role('button',name='Check for updates',exact=True)
  async def check_mode(mode):
   state['mode']=mode;await check.click()
  await check_mode('delay');await expect(page.get_by_role('button',name='Checking…',exact=True)).to_be_disabled()
  await expect(page.locator('.updHeroCopy h1')).to_have_text("You're up to date")
  for mode in ['404','500','invalid','malformed','mismatch','badnotes','network','timeout']:
   await check_mode(mode)
   await expect(page.locator('.updError')).to_be_visible(timeout=30000)
   assert await page.get_by_role('button',name='Install now',exact=True).count()==0
   await expect(check).to_be_enabled()
   print('PASS recoverable update-feed error:',mode)
  for mode in ['quality','feature']:
   await check_mode(mode)
   await expect(page.get_by_role('button',name='Install now',exact=True)).to_be_enabled()
   await expect(page.locator('.updHeroCopy h1')).to_contain_text('WebOS 2' if mode=='feature' else '1.03')
   await expect(page.locator('.updNotesErr')).to_contain_text('not been published')
   assert await page.locator('.updNotesBody').count()==0,'stale installed notes displayed as future notes'
   state['notes']='ok';await page.get_by_role('button',name='Retry release notes').click()
   await expect(page.locator('.updNotesBody')).to_contain_text('Verified notes retry works')
   if mode=='quality':
    await page.evaluate("window.__wosStore.dispatch({type:'UPDATEWIN',payload:'resize',dim:{top:80,left:80,width:650,height:420}})")
    await page.wait_for_timeout(300)
    assert round(await page.locator('#updateApp').evaluate('e=>e.getBoundingClientRect().width'))==650
    assert not await page.locator('.updScreen').evaluate('e=>e.scrollWidth>e.clientWidth+2')
    await page.screenshot(path=str(ART/'update-available.png'))
    await page.get_by_role('button',name='Install now',exact=True).click()
    await expect(page.locator('.updError')).to_contain_text('newer than the deployed files',timeout=30000)
    assert await page.evaluate("localStorage.getItem('wos.update.pending')")==None
    assert await page.evaluate("localStorage.getItem('wos.update.history')")==None
    print('PASS GitHub-ahead-of-deployment install blocked safely; no false history')
   state['notes']='missing'
  await check_mode('older');await expect(page.locator('.updHeroCopy h1')).to_have_text("You're up to date")
  await expect(page.locator('.updNotesBody')).to_contain_text('v1.02')
  assert await page.get_by_role('button',name='Install now',exact=True).count()==0
  assert await page.locator('.updProgress').count()==0,'stale failed progress survived a new check'
  await context.set_offline(True);await check.click()
  await expect(page.locator('.updError')).to_contain_text('offline')
  assert not errors,errors
  print('PASS quality/feature/current/older/offline UI, notes retry + stale-content cleanup; zero page errors')
  await context.close();await browser.close()
if __name__=='__main__':asyncio.run(main())
