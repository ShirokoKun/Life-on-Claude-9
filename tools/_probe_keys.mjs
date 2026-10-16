import { openPage } from './browser.mjs';
const { page, close } = await openPage({ gpu: true, w: 320, h: 180 });
await page.goto('http://localhost:8080/engine/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const r = await page.evaluate(() => {
  const out = [];
  window.__scene.traverse((o) => {
    if (!o.isMesh || !/^Keys$|Key/.test(o.material.name || '')) return;
    const uv = o.geometry.attributes.uv, pos = o.geometry.attributes.position;
    let mn = [9, 9], mx = [-9, -9];
    if (uv) for (let i = 0; i < uv.count; i++) { mn[0] = Math.min(mn[0], uv.getX(i)); mn[1] = Math.min(mn[1], uv.getY(i)); mx[0] = Math.max(mx[0], uv.getX(i)); mx[1] = Math.max(mx[1], uv.getY(i)); }
    out.push({ name: o.name, mat: o.material.name, verts: pos.count, uv: uv ? [mn, mx].map((a) => a.map((v) => +v.toFixed(3))) : null, map: !!o.material.map, emissive: o.material.emissive && o.material.emissive.getHexString(), ei: o.material.emissiveIntensity });
  });
  return out;
});
console.log(JSON.stringify(r)); await close();
