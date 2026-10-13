// Frame-exact film capture: opens the film page in headless Chromium (software GL), steps
// window.renderFrame(n) and screenshots each frame; then ffmpeg encodes the MP4.
//
//   node tools/render_film.mjs --page http://localhost:8790/index.html --glb intro.glb --three <node_modules>
//        --out frames/ [--frames 0-959 | --at 4,11,19] [--w 1280 --h 720]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const page_ = arg('page'), glb = arg('glb', ''), three = arg('three'), out = arg('out', 'frames');
const W = +arg('w', 1280), H = +arg('h', 720);
fs.mkdirSync(out, { recursive: true });
let frames = [];
if (arg('at')) frames = arg('at').split(',').map((s) => Math.round(parseFloat(s) * 24));
else { const [a, b] = arg('frames', '0-959').split('-').map(Number); for (let i = a; i <= b; i++) frames.push(i); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (r) => {
  const f = three + '/three/' + r.request().url().split('three@0.170.0/')[1];
  r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) });
});
await page.route('**/intro-data*.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
await page.goto(`${page_}?render=1${glb ? '&glb=' + glb : ''}${arg('extra', '') ? '&' + arg('extra') : ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
const t0 = Date.now();
for (const [i, n] of frames.entries()) {
  await page.evaluate((k) => window.renderFrame(k), n);
  await page.screenshot({ path: `${out}/f_${String(n).padStart(5, '0')}.png`, timeout: 180000 });
  if (i % 24 === 0) console.log(`frame ${n} (${i + 1}/${frames.length}) ${((Date.now() - t0) / (i + 1) / 1000).toFixed(2)} s/frame`);
}
await browser.close();
