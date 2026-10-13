// Serve engine/ at http://localhost:8080 (any static server works; this one needs no install).
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'engine');
const PORT = +(process.argv[2] || 8080);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav', '.exr': 'application/octet-stream' };
http.createServer((req, res) => {
  const p = path.join(ENGINE, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ENGINE) || !fs.existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`Claude Nine engine: http://localhost:${PORT}/`));
