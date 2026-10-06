// Validate the exact folder uploaded to Pages. Never run a server or change files here.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../build');
const json=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const manifest=json('offline-manifest.json'),feed=json('updates/feed.json');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const emitted=walk(root);
assert.ok(emitted.length<=20000,'Too many files for the standard Pages deployment limit');
for(const file of emitted){
 assert.ok(fs.statSync(file).size<=25*1024*1024,`File exceeds Pages per-file limit: ${file}`);
 assert.ok(!/\.(map|pem|key|env)$/.test(file),`Unexpected private/debug artifact: ${file}`);
}
let bytes=0;const names=new Set();
for(const f of manifest.files){
 assert.ok(!names.has(f.url),`Duplicate cache entry ${f.url}`);names.add(f.url);
 assert.ok(!f.url.startsWith('/') && !f.url.split('/').includes('..'),`Unsafe path ${f.url}`);
 const data=fs.readFileSync(path.join(root,f.url));bytes+=data.length;
 assert.equal(data.length,f.bytes,`Size mismatch: ${f.url}`);
 assert.equal(createHash('sha256').update(data).digest('hex'),f.hash,`Hash mismatch: ${f.url}`);
}
assert.equal(bytes,manifest.totalBytes);assert.equal(bytes,feed.latest.size);
for(const url of ['index.html','favicon.svg','bitbot/weights.js','about/index.html','docs/index.html','updates/index.html']) assert.ok(names.has(url),`Not offline: ${url}`);
for(const url of ['sw.js','offline-manifest.json','updates/feed.json','_headers']) assert.ok(!names.has(url),`Discovery/config must not be cached: ${url}`);
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.ok(sw.includes(manifest.id));assert.ok(!sw.includes('/* MANIFEST */ null'));
assert.equal(feed.latest.version,`${manifest.release.major}.${String(manifest.release.build).padStart(2,'0')}`);
console.log(`Deployment validated: ${emitted.length} emitted files; ${names.size} offline resources; ${(bytes/1048576).toFixed(2)} MiB.`);
