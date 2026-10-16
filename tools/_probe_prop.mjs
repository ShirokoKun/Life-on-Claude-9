// Look-dev probe: orbit views of a held prop (mug or phone) at a frame, to check the grip from every side.
//   node tools/_probe_prop.mjs <frame> <outPrefix> [propName=Phone (prop)] [dist=0.35]
import { openPage } from './browser.mjs';
const [frame, out, name = 'Phone (prop)', dist = '0.35'] = process.argv.slice(2);
const { page, close } = await openPage({ gpu: true, w: 480, h: 360 });
await page.goto('http://localhost:8791/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const c = await page.evaluate(([f, n]) => { window.renderFrame(+f); window.renderFrame(+f);
  let m = null; window.__scene.traverse((o) => { if (o.name === n && o.visible) m = o; });
  if (!m) return null; const p = m.getWorldPosition(new window.__THREE.Vector3()); return [p.x, -p.z, p.y]; }, [frame, name]);
if (!c) { console.log('not found'); await close(); process.exit(1); }
const views = [[0, 0], [60, 0], [120, 0], [180, 0], [240, 0], [300, 0], [0, 60], [180, -40]];
for (const [az, el] of views) {
  const a = az * Math.PI / 180, e = el * Math.PI / 180, d = +dist;
  const cam = [c[0] + d * Math.cos(e) * Math.sin(a), c[1] + d * Math.cos(e) * Math.cos(a), c[2] + d * Math.sin(e), ...c, 35, 11].join(',');
  await page.evaluate(([cm, f]) => { window.__cam = cm; window.renderFrame(+f); }, [cam, frame]);
  await page.screenshot({ path: `${out}_az${az}_el${el}.png` });
}
await close(); console.log('ok', c.map((v) => v.toFixed(3)).join(','));
