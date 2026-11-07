// Paint textures with p5.brush in headless Chromium (engine/studies/painter/) and save them as PNGs.
//   node tools/paint_textures.mjs [--out engine/studies/ps1-subway-v2/assets/paint] [--only tag_violet,map]
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { openPage } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine');
const A = process.argv.slice(2);
const opt = (k, d) => (A.includes(`--${k}`) ? A[A.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(ROOT, opt('out', 'engine/studies/ps1-subway-v2/assets/paint'));
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(ENGINE, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ENGINE) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const { page, close } = await openPage({ gpu: false, w: 512, h: 512 });
page.on('pageerror', (e) => console.log('[page error]', e.message));
const PAGE = `http://localhost:${server.address().port}/studies/painter/index.html`;
const fresh = async () => { await page.goto(PAGE); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); };
await fresh();
const jobs = opt('only') ? opt('only').split(',') : await page.evaluate(() => window.jobs);
for (const j of jobs) {
  await fresh();                                   // p5.brush keeps internal buffers: a clean page per texture
  const url = await page.evaluate((n) => window.paint(n), j);
  fs.writeFileSync(path.join(out, `${j}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('painted', j);
}
await close(); server.close();
