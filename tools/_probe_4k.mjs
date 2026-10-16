// Compare a few frames at 1080p and 4K (the look must match): node tools/_probe_4k.mjs 120,1180,... [--out dir]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openPage, GPU_ARGS } from './browser.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frames = process.argv[2].split(',').map(Number);
const out = path.join(ROOT, 'renders', 'kf1', 'probe_4k'); fs.mkdirSync(out, { recursive: true });
for (const [w, h] of [[1920, 1080], [3840, 2160]]) {
  const { page, close } = await openPage({ gpu: true, w, h, headless: true, args: [...GPU_ARGS, '--enable-unsafe-webgpu'] });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto('http://localhost:8791/index.html?render=1&scene=kf1');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
  for (const f of frames) {
    const t0 = Date.now();
    await page.evaluate((k) => window.renderFrame(k), f);
    await page.screenshot({ path: path.join(out, `f${f}_${h}.png`) });
    console.log(`${h}p frame ${f} ${((Date.now() - t0) / 1000).toFixed(2)} s`);
  }
  await close();
}
