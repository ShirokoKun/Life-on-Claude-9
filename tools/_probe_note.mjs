import { openPage } from './browser.mjs';
const { page, close } = await openPage({ gpu: true, w: 640, h: 360 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:8080/engine/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const r = await page.evaluate(() => {
  window.renderFrame(Math.round(66 * 24));
  const n = window.__scene.getObjectByName('Sticky note');
  if (!n) return 'no note';
  const T = window.__THREE, p = n.getWorldPosition(new T.Vector3()), c = p.clone().project(window.__camera);
  let vis = true, o = n; while (o) { if (!o.visible) vis = false; o = o.parent; }
  return { vis, pos: [p.x, -p.z, p.y].map((v) => +v.toFixed(3)), ndc: [c.x, c.y, c.z].map((v) => +v.toFixed(3)), cam: [window.__camera.position.x, -window.__camera.position.z, window.__camera.position.y].map((v) => +v.toFixed(3)) };
});
console.log(JSON.stringify(r));
await close();
