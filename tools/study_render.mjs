// Render a style study (engine/studies/<name>/) to stills or a film. It serves engine/ itself and drives the
// study's deterministic clock (window.renderAt(t)), so preview and render match frame for frame.
//   node tools/study_render.mjs --study ps1-subway --at 0,2.5,6 --out renders/studies/ps1-subway/stills
//   node tools/study_render.mjs --study ps1-subway --film --fps 24 [--seconds 12] [--frames 0-287] --out renders/studies/ps1-subway/film
//   options: --w 1920 --h 1080 (page size; PS1 studies upscale their low-res canvas with nearest), --query "res=640x360",
//            --gpu (use the real GPU instead of SwiftShader), --mp4 out.mp4 (encode after a film run)
import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { openPage } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine');
const A = process.argv.slice(2);
const opt = (k, d) => (A.includes(`--${k}`) ? A[A.indexOf(`--${k}`) + 1] : d);
const study = opt('study'); if (!study) { console.log('need --study <name>'); process.exit(1); }
const W = +opt('w', 1920), H = +opt('h', 1080), fps = +opt('fps', 24);
const out = path.resolve(ROOT, opt('out', `renders/studies/${study}/${A.includes('--film') ? 'film' : 'stills'}`));
fs.mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(ENGINE, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ENGINE) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const { page, close } = await openPage({ gpu: A.includes('--gpu'), w: W, h: H });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text().slice(0, 300)); });
page.on('pageerror', (e) => { console.log('[page error]', e.message); if (!pageReady) { console.log('the study failed to load'); process.exit(1); } });
let pageReady = false;
const q = opt('query', '');
await page.goto(`http://localhost:${port}/studies/${study}/index.html?render=1${q ? '&' + q : ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
pageReady = true;
const duration = await page.evaluate(() => window.__duration);

let times;
if (A.includes('--film')) {
  const n = Math.round(+opt('seconds', duration) * fps);
  let [a, b] = (opt('frames', `0-${n - 1}`)).split('-').map(Number);
  times = []; for (let f = a; f <= b; f++) times.push([f, f / fps]);
} else {
  times = opt('at', '0').split(',').map((s, i) => [i, +s]);
}
const t0 = Date.now();
for (const [f, t] of times) {
  const file = A.includes('--film') ? path.join(out, `f_${String(f).padStart(5, '0')}.png`) : path.join(out, `t${t.toFixed(2)}.png`);
  if (A.includes('--film') && fs.existsSync(file)) continue;
  await page.evaluate((tt) => window.renderAt(tt), t);
  await page.screenshot({ path: file + '.tmp.png' });
  fs.renameSync(file + '.tmp.png', file);
  if (f % 24 === 0 || !A.includes('--film')) console.log(path.relative(ROOT, file), `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await close(); server.close();
const mp4 = opt('mp4');
if (mp4) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(out, 'f_%05d.png'), '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.resolve(ROOT, mp4)]);
  console.log('wrote', mp4);
}
