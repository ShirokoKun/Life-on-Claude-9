// Render a list of film frames (each twice: focus and history settle) for checking fixes.
//   node tools/_probe_frames.mjs <outDir> 2827,2856,... [--w 640]
import fs from 'fs';
import path from 'path';
import { openPage } from './browser.mjs';
const out = process.argv[2], frames = process.argv[3].split(',').map(Number);
const i = process.argv.indexOf('--w'), W = i > 0 ? +process.argv[i + 1] : 640, H = Math.round(W * 9 / 16);
fs.mkdirSync(out, { recursive: true });
const { page, close } = await openPage({ gpu: true, w: W, h: H });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto((process.env.KF_URL || 'http://localhost:8791/index.html') + '?render=1&scene=' + (process.env.SCENE || 'kf1'));
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
for (const f of frames) {
  await page.evaluate((n) => { window.renderFrame(n); window.renderFrame(n); }, f);
  await page.screenshot({ path: path.join(out, `f_${String(f).padStart(5, '0')}.png`) });
}
console.log('wrote', frames.length);
await close();
