// Frame-exact capture of the engine (engine/index.html?render=1) with headless Chromium, then encode with ffmpeg.
//   node tools/capture.mjs --url http://localhost:8791/index.html --out frames/ [--frames 0-767 --step 1 | --at 4,10.5]
//        [--w 1920 --h 1080] [--extra "cam=...&q=med"] [--gpu]
// --gpu uses the machine's GPU (fast, for local renders); default is software GL (works anywhere, slow).
import { chromium } from 'playwright';
import fs from 'fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);
const url = arg('url', 'http://localhost:8791/index.html'), out = arg('out', 'frames');
const W = +arg('w', 1920), H = +arg('h', 1080);
fs.mkdirSync(out, { recursive: true });
let frames = [];
if (arg('at')) frames = arg('at').split(',').map((s) => Math.round(parseFloat(s) * 24));
else { const [a, b] = arg('frames', '0-767').split('-').map(Number); const st = +arg('step', 1); for (let i = a; i <= b; i += st) frames.push(i); }
if (has('skip-existing')) frames = frames.filter((n) => !fs.existsSync(`${out}/f_${String(n).padStart(5, '0')}.png`));

const args = has('gpu') ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('console', m.text().slice(0, 300)); });
await page.goto(`${url}?render=1${arg('extra', '') ? '&' + arg('extra') : ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
const t0 = Date.now();
for (const [i, n] of frames.entries()) {
  await page.evaluate((k) => window.renderFrame(k), n);
  await page.screenshot({ path: `${out}/f_${String(n).padStart(5, '0')}.png`, timeout: 300000 });
  if (i % 12 === 0) console.log(`frame ${n} (${i + 1}/${frames.length}) ${((Date.now() - t0) / (i + 1) / 1000).toFixed(2)} s/frame`);
}
await browser.close();
