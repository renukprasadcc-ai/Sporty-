// Zero-dependency static server for Sporty. Usage: node server.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = +process.argv[2] || process.env.PORT || 8000;
const ROOT = __dirname;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.wasm':'application/wasm', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.txt':'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(d);
  });
}).listen(PORT, () => console.log(`Sporty running at http://localhost:${PORT}/`));
