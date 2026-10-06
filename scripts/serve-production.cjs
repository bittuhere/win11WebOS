// Local static preview: compiled files, _headers and Pages-style clean HTML URLs.
// Not an API/backend and not a substitute for Cloudflare's production edge.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../build');
if (!fs.existsSync(path.join(ROOT, 'sw.js'))) throw new Error('Run npm run build first.');
const port = Number(process.env.PORT || process.argv[2] || 4180);
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.xml':'application/xml','.wasm':'application/wasm','.mp3':'audio/mpeg','.mp4':'video/mp4'};
const rules=[]; let rule;
for(const line of fs.readFileSync(path.join(ROOT,'_headers'),'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  if (!line.startsWith(' ')) { rule={pattern:new RegExp('^'+line.trim().replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('*','.*')+'$'),headers:{}}; rules.push(rule); }
  else if(rule) { const [key,...parts]=line.trim().split(':'); rule.headers[key]=parts.join(':').trim(); }
}
const isFile = name => { try {return fs.statSync(name).isFile();} catch {return false;} };
const server = http.createServer((req,res)=>{
  let url, pathname;
  try {url=new URL(req.url,'http://preview');pathname=decodeURIComponent(url.pathname);} catch {res.writeHead(400);res.end();return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  if(pathname.includes('\0') || pathname.includes('\\')){res.writeHead(400);res.end();return;}
  const headers={'Cache-Control':'no-cache'};
  for(const r of rules) if(r.pattern.test(pathname)) Object.assign(headers,r.headers);
  // A local HTTP server has no TLS listener: retaining upgrade-insecure-requests
  // would upgrade followed redirects to https://localhost and break installation.
  // The deployed _headers file is not changed, and HTTPS proxy previews retain it.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(req.headers.host || '') && req.headers['x-forwarded-proto'] !== 'https') {
    headers['Content-Security-Policy']=headers['Content-Security-Policy']?.replace('; upgrade-insecure-requests','');
  }
  // Only for the sandbox preview iframe, never enabled on Cloudflare deployments.
  if(process.env.WOS_ALLOW_PREVIEW_EMBED==='1') {
    delete headers['X-Frame-Options'];
    headers['Content-Security-Policy']=headers['Content-Security-Policy']?.replace("; frame-ancestors 'self'",'');
  }
  let file=path.resolve(ROOT,'.'+pathname);
  if(!file.startsWith(ROOT+path.sep) && file!==ROOT){res.writeHead(403);res.end();return;}
  const redirect=to=>{res.writeHead(308,{...headers,Location:encodeURI(to)+url.search});res.end();};
  if(isFile(file) && pathname.endsWith('.html')) return redirect(pathname.endsWith('/index.html') ? pathname.slice(0,-10) : pathname.slice(0,-5));
  if(pathname.endsWith('/')) file=path.join(file,'index.html');
  else if(!isFile(file) && isFile(file+'.html')) file+='.html';
  else if(!isFile(file) && isFile(path.join(file,'index.html'))) return redirect(pathname+'/');
  if(!isFile(file)){res.writeHead(404,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return;}
  const size=fs.statSync(file).size;
  headers['Content-Type']=mime[path.extname(file)] || 'application/octet-stream';
  headers['Accept-Ranges']='bytes';
  let start=0,end=size-1,status=200;
  if(req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(match && (match[1] || match[2])) {
      if(match[1]) {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}
      else start=Math.max(0,size-Number(match[2]));
    } else start=size;
    if(start>=size || start>end){res.writeHead(416,{...headers,'Content-Range':`bytes */${size}`});res.end();return;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=Math.max(0,end-start+1);
  res.writeHead(status,headers);
  if(req.method==='HEAD' || size===0){res.end();return;}
  const stream=fs.createReadStream(file,{start,end});
  stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
});
server.listen(port,'0.0.0.0',()=>console.log(`Production preview: http://localhost:${port} (bound to 0.0.0.0)`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
