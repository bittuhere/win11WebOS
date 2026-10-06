// Fast preflight used by every production build; no account/network access.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const [major,minor]=process.versions.node.split('.').map(Number);
assert.ok((major===20 && minor>=19) || (major===22 && minor>=12) || major>22,'Use Node 22.12+ (recommended), or Node 20.19+ in the 20.x line.');
for(const file of ['package-lock.json','release.json','wrangler.jsonc','public/_headers','public/favicon.svg','public/updates/feed.json','scripts/sw-template.js','index.html']) assert.ok(fs.existsSync(path.join(root,file)),`Missing build input: ${file}`);
const release=JSON.parse(read('release.json')), feed=JSON.parse(read('public/updates/feed.json'));
const version=`${release.major}.${String(release.build).padStart(2,'0')}`;
assert.equal(feed.latest.version,version,'release.json and feed version disagree');
assert.ok(fs.existsSync(path.join(root,'public',feed.latest.notes)),'Release notes are missing');
assert.equal(JSON.parse(read('wrangler.jsonc')).pages_build_output_dir,'./build');
assert.ok(!fs.existsSync(path.join(root,'public/_redirects')),'Do not restore the catch-all SPA redirect: missing assets must be errors.');
assert.ok(!fs.existsSync(path.join(root,'src/components/login.js')),'Remove the obsolete Firebase login file from older checkouts.');
assert.match(read('public/favicon.svg'),/viewBox="0 0 480 480"/);
assert.equal((read('scripts/sw-template.js').match(/\/\* MANIFEST \*\/ null/g)||[]).length,1);
console.log(`Source preflight passed for v${version}; deploy output is build/.`);
