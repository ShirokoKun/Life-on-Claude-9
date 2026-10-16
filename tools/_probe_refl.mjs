import { openPage } from './browser.mjs';
const { page, close } = await openPage({ gpu: true, w: 640, h: 360 });
await page.goto('http://localhost:8080/engine/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const r = await page.evaluate(() => {
  window.renderFrame(Math.round(150 * 24));
  const T = window.__THREE, g = window.__scene.getObjectByName('Lens reflections');
  const p = g.getWorldPosition(new T.Vector3()), c = p.clone().project(window.__camera);
  return { vis: g.visible, pos: [p.x, -p.z, p.y].map((v) => +v.toFixed(3)), ndc: [c.x, c.y, c.z].map((v) => +v.toFixed(3)) };
});
console.log(JSON.stringify(r)); await close();
