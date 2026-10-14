// Chapter 1's screen canvases (engine/scenes/ch1/screens.js) as PNGs at given times, without rendering the scene:
// laptop, monitor, monitor2, phone (and the optional chat card) side by side, one contact sheet per time.
//   node tools/screens_preview.mjs --at 3,40,45,70,118,170,177,200 --out renders/ch1_screens [--scale 0.5] [--split]
//   [--url http://localhost:8080/engine/scenes/ch1/screens_preview.html]
// Needs the Studio running (npm run studio) or any static server at --url. --split also writes each canvas at full size.
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const url = arg('url', 'http://localhost:8080/engine/scenes/ch1/screens_preview.html');
const out = arg('out', 'renders/ch1_screens'), scale = +arg('scale', 0.5), split = process.argv.includes('--split');
const times = arg('at', '3,40,45,70,118,170,177,200').split(',').map(Number).filter((x) => Number.isFinite(x));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
let errors = 0;
page.on('pageerror', (e) => { errors++; console.log('page error:', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const save = (file, dataURL) => { fs.writeFileSync(file, Buffer.from(dataURL.split(',')[1], 'base64')); return file; };
for (const t of times) {
  const info = await page.evaluate(([tt, s]) => window.drawAt(tt, s), [t, scale]);
  const tag = `t${t.toFixed(2).padStart(6, '0')}_${info.shot}`;
  const f = save(path.join(out, `ch1_screens_${tag}.png`), await page.evaluate(() => window.sheetURL()));
  if (split) for (const n of ['laptop', 'monitor', 'monitor2', 'phone', 'card']) save(path.join(out, `${tag}_${n}.png`), await page.evaluate((nn) => window.canvasURL(nn), n));
  console.log(`${t.toFixed(2)} s  ${info.shot} ${info.name}  ->  ${f}  (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);
}
await browser.close();
if (errors) { console.log(`${errors} page error(s)`); process.exit(1); }
