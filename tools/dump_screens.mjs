// Dump the live screen canvases at given times (story check without rendering the scene).
//   node tools/dump_screens.mjs --out /tmp/scr --at 5,15.5,21,26,31.8
import { chromium } from 'playwright';
import fs from 'fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'screens'); fs.mkdirSync(out, { recursive: true });
const times = arg('at', '5,15.5,21,26,31.8').split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`${arg('url', 'http://localhost:8791/index.html')}?render=1&ivan=0&fx=0&q=med`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
for (const t of times) {
  const urls = await page.evaluate((tt) => { window.__screens.update(tt); const c = window.__screens.canvases; return [c.lap.toDataURL(), c.mon.toDataURL()]; }, t);
  urls.forEach((u, i) => fs.writeFileSync(`${out}/${['lap', 'mon'][i]}_${t.toFixed(1)}.png`, Buffer.from(u.split(',')[1], 'base64')));
  console.log('t', t);
}
await browser.close();
