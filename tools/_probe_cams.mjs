// Look-dev probe: render one keyframe from a grid of candidate cameras (window.__cam), to pick framings from a sheet
// instead of guessing.  node tools/_probe_cams.mjs <frame> <outPrefix> <cams.json>
//   cams.json: [{ "name": "a", "cam": [x, y, z, ax, ay, az, mm, f] }, ...]  (Blender metres)
import fs from 'fs';
import { openPage } from './browser.mjs';
const f = +process.argv[2], out = process.argv[3], cams = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
const url = process.env.KF_URL || 'http://localhost:8791/index.html';
const { page, close } = await openPage({ gpu: true, w: +(process.env.W || 640), h: +(process.env.H || 360) });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(url + '?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
await page.evaluate((n) => window.renderFrame(n), f);
for (const c of cams) {
  await page.evaluate(([cam, n]) => { window.__cam = cam; window.renderFrame(n); }, [c.cam.join(','), f]);
  await page.screenshot({ path: `${out}_${c.name}.png` });
}
await close();
console.log('wrote', cams.length);
