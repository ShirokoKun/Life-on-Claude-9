// Debug probe: close-ups of a held prop (mug) from four sides, for checking the grip.
//   node tools/_probe_hand.mjs <frame> <outPrefix> [url]
import { openPage } from './browser.mjs';
const f = +process.argv[2], out = process.argv[3], url = process.argv[4] || 'http://localhost:8791/index.html';
const { page, close } = await openPage({ gpu: true, w: 640, h: 360 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(url + '?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const c = await page.evaluate((n) => {
  window.renderFrame(n);
  let m = null; window.__scene.traverse((o) => { if (o.name === 'Mug (prop)' && o.visible) m = o; });
  if (!m) return null;
  const p = m.getWorldPosition(new window.__THREE.Vector3());
  return [p.x, -p.z, p.y];
}, f);
if (!c) { console.log('no mug'); await close(); process.exit(1); }
console.log('mug at', c.map((v) => v.toFixed(3)).join(', '));
const views = (process.env.V || '0,90,180,270').split(',').map(Number);
for (const a of views) {
  const r = (a * Math.PI) / 180, d = +(process.env.D || 0.32);
  const cam = [c[0] + Math.cos(r) * d, c[1] + Math.sin(r) * d, c[2] + +(process.env.H || 0.06), c[0] + +(process.env.OX || 0), c[1] + +(process.env.OY || 0), c[2] + +(process.env.OZ || 0), +(process.env.MM || 40), 22].join(',');
  await page.evaluate(([cam, n]) => { window.__cam = cam; window.renderFrame(n); }, [cam, f]);
  await page.screenshot({ path: `${out}_${a}.png` });
}
await close();
