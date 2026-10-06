// Build a complete, deterministic inventory AFTER Vite emits public + bundled assets.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../build');
const release = require('../release.json');
const sha = data => createHash('sha256').update(data).digest('hex');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const excluded = name => /(^|\/)_headers$|(^|\/)_redirects$|^updates\/feed\.json$|^sw\.js$|^offline-manifest\.json$|\.map$/.test(name);
const files = walk(root).map(file => ({file, url: path.relative(root, file).split(path.sep).join('/')}))
  .filter(x => !excluded(x.url)).sort((a, b) => a.url.localeCompare(b.url))
  .map(({file, url}) => { const bytes = fs.readFileSync(file); return {url, bytes: bytes.length, hash: sha(bytes)}; });
const manifest = { release, id: sha(JSON.stringify(files)).slice(0, 20), totalBytes: files.reduce((n, f) => n + f.bytes, 0), files };
fs.writeFileSync(path.join(root, 'offline-manifest.json'), JSON.stringify(manifest));
const template = fs.readFileSync(path.join(__dirname, 'sw-template.js'), 'utf8');
fs.writeFileSync(path.join(root, 'sw.js'), template.replace('/* MANIFEST */ null', JSON.stringify(manifest)));
// The feed's size is the uncompressed, verified offline payload, not a guessed bundle size.
const feedPath = path.join(root, 'updates/feed.json');
const feed = JSON.parse(fs.readFileSync(feedPath));
feed.latest.size = manifest.totalBytes;
fs.writeFileSync(feedPath, JSON.stringify(feed, null, 2));
console.log(`Offline ${release.major}.${String(release.build).padStart(2, '0')}: ${files.length} files, ${(manifest.totalBytes / 1048576).toFixed(2)} MiB, ${manifest.id}`);
