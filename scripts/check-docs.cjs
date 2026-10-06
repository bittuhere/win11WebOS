// Check local links and known stale operational instructions in current guides.
// Historical release records/upstream notes are intentionally not rewritten as current claims.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.md')&&!['CHANGELOG.md','RELEASE-NOTES.md'].includes(f)),...fs.readdirSync(path.join(root,'docs')).filter(f=>f.endsWith('.md')).map(f=>'docs/'+f),'public/updates/README.md','public/updates/notes/1.02.md','public/docs/index.html','public/about/index.html','public/updates/index.html','.github/pull_request_template.md'];
const failures=[];let links=0;
for(const file of files){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 for(const match of text.matchAll(/\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)){
  const url=match[1];if(/^[a-z][a-z0-9+.-]*:|^#|^\/\//i.test(url)||/[<>*]/.test(url))continue;
  const relative=decodeURIComponent(url.split(/[?#]/)[0]);if(!relative)continue;
  const dest=path.resolve(path.dirname(path.join(root,file)),relative);
  links++;if(!fs.existsSync(dest))failures.push(`${file}: missing link ${url}`);
 }
 if (/on a daily schedule|post-login,? daily|at most once per day|hourly failure backoff/.test(text))failures.push(`${file}: stale daily update schedule; use each-boot after-login contract`);
 // Check commands/badges, not explanatory sentences about old versions.
 if(/^\s*vite build\s*(?:#.*)?$/m.test(text))failures.push(`${file}: use npm run build, not bare vite build`);
 if(/build-Vite%203|version-1\.0\.0-informational|suites-227/.test(text))failures.push(`${file}: obsolete status badge`);
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`Documentation checks passed: ${files.length} current guides, ${links} local links. Historical/upstream records are preserved separately.`);
