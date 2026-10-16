// Debug probe: does the key-legend decal exist, how many keys, where, and is it visible at a frame.
import { openPage } from './browser.mjs';
const { page, close } = await openPage({ gpu: true, w: 320, h: 180 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:8791/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const r = await page.evaluate((f) => {
  window.renderFrame(f);
  const T = window.__THREE, out = { keys: [] };
  window.__scene.traverse((o) => {
    if (o.name === 'Key legends') { let v = true, p = o; while (p) { v = v && p.visible; p = p.parent; } out.legend = { count: o.count, vis: v, layers: o.layers.mask }; const m = new T.Matrix4(), q = new T.Vector3(); for (let i = 0; i < Math.min(3, o.count); i++) { o.getMatrixAt(i, m); q.setFromMatrixPosition(m); out.legend['p' + i] = [q.x, q.y, q.z].map((x) => +x.toFixed(4)); } }
    if (o.isMesh && o.material && o.material.name === 'Keys') {
      const n = o.geometry.attributes.normal, pos = o.geometry.attributes.position; let up = 0;
      o.updateWorldMatrix(true, false); const nm = new T.Matrix3().getNormalMatrix(o.matrixWorld), v = new T.Vector3();
      for (let i = 0; i < n.count; i++) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); if (v.y > 0.92) up++; }
      const bb = new T.Box3().setFromObject(o);
      out.keys.push({ name: o.name, verts: pos.count, up, min: bb.min.toArray().map((x) => +x.toFixed(3)), max: bb.max.toArray().map((x) => +x.toFixed(3)) });
    }
  });
  return out;
}, +(process.argv[2] || 3151));
console.log(JSON.stringify(r, null, 1)); await close();
