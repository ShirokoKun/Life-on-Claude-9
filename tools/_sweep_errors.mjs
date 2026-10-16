// Error sweep: render every frame of a scene in order at a tiny size, no screenshots, and report each frame that throws
// (a board only renders shot middles, so a bug in a shot's first second can slip past it and stop a film render).
//   node tools/_sweep_errors.mjs [--scene kf1] [--frames 0-4839] [--url http://localhost:8791/index.html]
import { openPage } from './browser.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const [a, b] = arg('frames', '0-4839').split('-').map(Number);
const { page, close } = await openPage({ gpu: true, w: 320, h: 180 });
await page.goto(`${arg('url', 'http://localhost:8791/index.html')}?render=1&scene=${arg('scene', 'kf1')}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const bad = await page.evaluate(([a, b]) => {
  const out = [];
  for (let f = a; f <= b; f++) { try { window.renderFrame(f); } catch (e) { out.push([f, String(e && e.message)]); if (out.length > 40) break; } }
  return out;
}, [a, b]);
await close();
for (const [f, m] of bad) console.log(`frame ${f} (${(f / 24).toFixed(2)} s): ${m}`);
console.log(bad.length ? `${bad.length} failing frame(s)` : `frames ${a}-${b}: no errors`);
