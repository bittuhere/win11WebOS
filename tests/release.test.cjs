const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const json = name => JSON.parse(read(name));
test('release identity agrees across compiled version, npm, feed and metadata', () => {
 const r=json('release.json'), v=`${r.major}.${String(r.build).padStart(2,'0')}`;
 assert.equal(json('package.json').version,`${r.major}.${r.build}.0`);
 assert.equal(json('package-lock.json').version,`${r.major}.${r.build}.0`);
 assert.equal(json('public/updates/feed.json').latest.version,v);
 assert.match(read('src/utils/os/version.js'), /import release from/);
 assert.match(read('index.html'), new RegExp(`"softwareVersion": "${v}"`));
 assert.ok(fs.existsSync(path.join(root,`public/updates/notes/${v}.md`)));
});
test('manifest covers every shipped local file except explicit discovery/hosting files', () => {
 const m=json('build/offline-manifest.json');
 const inventory=new Set(m.files.map(f=>f.url));
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 for(const file of walk(path.join(root,'build'))){
  const url=path.relative(path.join(root,'build'),file).split(path.sep).join('/');
  if(/(^|\/)_headers$|(^|\/)_redirects$|^updates\/feed\.json$|^sw\.js$|^offline-manifest\.json$|\.map$/.test(url)) continue;
  assert.ok(inventory.has(url),url);
 }
 for(const f of m.files){
  const data=fs.readFileSync(path.join(root,'build',f.url));
  assert.equal(f.bytes,data.length);
  assert.equal(f.hash,createHash('sha256').update(data).digest('hex'),f.url);
 }
 assert.ok(inventory.has('bitbot/weights.js'));
 assert.ok([...inventory].some(f=>f.endsWith('.woff2')));
 assert.ok(inventory.has('updates/notes/1.02.md'));
 assert.ok(!inventory.has('updates/feed.json'));
 assert.ok(!inventory.has('sw.js'));
 assert.equal(m.totalBytes,m.files.reduce((sum,f)=>sum+f.bytes,0));
});
test('local loaders work without unsafe-eval and Firebase is removed', () => {
 const hdr=read('public/_headers');
 assert.ok(!hdr.includes("'unsafe-eval'"));
 assert.match(hdr,/worker-src 'self' blob:/);
 for(const name of ['extras.jsx','terminal.jsx']) assert.ok(!read('src/containers/applications/apps/'+name).includes('new Function('));
 assert.ok(!fs.existsSync(path.join(root,'src/components/login.js')));
 assert.ok(!fs.existsSync(path.join(root,'.firebaserc')));
});
test('crawlable docs expose identity without executing JavaScript', () => {
 for(const page of ['about','docs','updates']) {
  const html=read(`public/${page}/index.html`);
  assert.match(html,/<h1>/);
  assert.match(html,/bittuhere/);
  assert.match(html,/<link rel="canonical"/);
  assert.ok(!html.includes('noindex'));
 }
 assert.match(read('public/sitemap.xml'),/\/about\//);
});
test('split chunks retain bridge, keyboard, browser fallback and Store motion contracts', () => {
 const assets=path.join(root,'build/assets');
 const all=ext=>fs.readdirSync(assets).filter(f=>f.endsWith(ext)).map(f=>fs.readFileSync(path.join(assets,f),'utf8')).join('\n');
 const js=all('.js'), css=all('.css').replace(/\s/g,'');
 assert.match(js,/WEBOS_BRIDGE/);
 assert.match(js,/type:\s*["']ping["']/);
 assert.ok(js.replace(/\s/g,'').includes('key==="Escape"'));
 assert.match(js,/altKey/); assert.match(js,/"Tab"/);
 assert.match(js,/\.frameBlocked/);assert.match(js,/kind:\s*"snapshot"/);assert.match(js,/copilotsearch/);
 for(const token of ['@keyframesstoreIn','@keyframesstorePop','@keyframesgalIn','.storeGrid.storeCard{animation:storeIn']) assert.ok(css.includes(token),token);
});
test('production packaging and branding inputs stay committed and consistent', () => {
 const svg=read('public/favicon.svg');
 assert.equal((svg.match(/<rect /g)||[]).length,4);
 assert.match(svg,/fill="#1976d3"/);
 assert.match(read('src/utils/os/offline.js'),/__WOS_BRAND_SVG__/);
 assert.ok(!read('src/utils/os/offline.js').includes('▦'));
 assert.match(read('src/release-polish.scss'),/prefers-reduced-motion/);
 assert.ok(!fs.existsSync(path.join(root,'public/_redirects')));
 assert.equal(json('wrangler.jsonc').pages_build_output_dir,'./build');
 assert.match(read('.gitignore'),/\/deliverables\//);
 assert.ok(!/^\*\.py$/m.test(read('.gitignore')));
 assert.equal(json('package.json').scripts.preview,'node scripts/serve-production.cjs');
 assert.match(read('src/App.jsx'),/bootUpdateChecked\.current = false/);
 assert.ok(!read('src/utils/os/updates.js').includes('CHECK_INTERVAL'));
 assert.match(read('src/containers/applications/apps/settings.jsx'),/once per boot/);
});

test('taskbar slide, titlebar fallback and GitHub discovery contracts', () => {
 const motion=read('src/release-polish.scss');
 assert.match(motion,/translateY\(calc\(100% \+ 24px\)\)/);
 assert.match(motion,/transform 440ms/);
 assert.match(motion,/visibility 0s 230ms/);
 assert.match(read('src/utils/general.scss'),/background: var\(--wos-titlebar-bg, #f3f3f3\)/);
 const updates=read('src/utils/os/updates.js');
 assert.match(updates,/raw\.githubusercontent\.com\/bittuhere\/win11WebOS\/refs\/heads\/main\/public\//);
 assert.match(updates,/code = "bad-feed"/);
 assert.match(updates,/request === notesRequest/);
 assert.match(read('src/components/updates/index.jsx'),/Retry release notes/);
 assert.ok(json('public/updates/feed.json').latest.size>0,'Publish a measured source feed size');
});
test('Search focus cannot pan the desktop and site verification survives the build', () => {
 const start=read('src/components/start/start.jsx');
 assert.match(start,/focus\(\{ preventScroll: true \}\)/);
 assert.match(start,/\[start\.hide, start\.menu\]/);
 assert.match(read('src/index.css'),/overflow: clip/);
 assert.match(read('src/components/start/searchpane.scss'),/overscroll-behavior: contain/);
 const verification=read('index.html').match(/<meta name="google-site-verification" content="([^"]+)"/);
 assert.ok(verification,'Keep the owner-supplied verification tag');
 assert.ok(read('build/index.html').includes(verification[1]));
 const sw=read('scripts/sw-template.js');
 assert.ok(sw.indexOf("relative === 'updates/feed.json'")<sw.indexOf('e.respondWith('));
 assert.match(read('src/utils/os/updates.js'),/cache: "no-store"/);
});
