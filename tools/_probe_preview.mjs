// Preview vs render: renders the same frames three ways and saves them side by side, to find why the Studio's web
// player and the film differ.
//   A  render mode (?render=1, what render_mp4 and kf_board use): a cold jump to the frame, rendered twice
//   B  player mode (no ?render=1, the Studio's iframe), a cold jump: setTime once, as a click on the timeline does
//   C  player mode, played into the frame: real-time steps through the 3 s before it (what playback shows)
//   node tools/_probe_preview.mjs --frames 958,4236 --out <dir> [--url http://localhost:8791/index.html] [--w 1280 --h 720] [--dpr 2]
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { GPU_ARGS } from './browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const url = arg('url', 'http://localhost:8791/index.html'), out = arg('out', 'renders/_preview_probe');
const W = +arg('w', 1280), H = +arg('h', 720), DPR = +arg('dpr', 1);
const frames = arg('frames', '958').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: GPU_ARGS, headless: true });

async function page(render, dpr) {
  const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${url}?scene=kf1${render ? '&render=1' : '&panel=0'}`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
  return p;
}
const shot = (p, f) => p.locator('canvas').first().screenshot({ path: f });
//   D  render mode, rendered in order through the --run frames before it (what render_mp4 does for a film)
const RUN = +arg('run', 240);
const A = await page(true, 1), B = await page(false, DPR), C = await page(false, DPR), D = await page(true, 1);
for (const n of frames) {
  await A.evaluate((n) => { window.renderFrame(n); window.renderFrame(n); }, n);
  await shot(A, path.join(out, `f${n}_A_render.png`));
  await D.evaluate((a) => { for (let k = a[0]; k <= a[1]; k++) window.renderFrame(k); }, [Math.max(0, n - RUN), n]);
  await shot(D, path.join(out, `f${n}_D_inorder.png`));
  await B.evaluate((n) => window.studio.seek(n / 24), n); await B.waitForTimeout(400);
  await shot(B, path.join(out, `f${n}_B_seek.png`));
  await C.evaluate(async (n) => { for (let k = n - 72; k <= n; k++) { window.studio.seek(k / 24); await new Promise((r) => requestAnimationFrame(r)); } }, n);
  await C.waitForTimeout(400);
  await shot(C, path.join(out, `f${n}_C_played.png`));
  const st = await C.evaluate(() => window.studio.state());
  console.log('frame', n, 'shot', st.shot);
}
await browser.close();
