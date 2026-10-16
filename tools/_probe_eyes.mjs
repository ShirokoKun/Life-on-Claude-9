// Where are Ivan's eyes (the eye bones of ivan_eyes.glb) at a frame, and which way do they look? Blender metres.
//   node tools/_probe_eyes.mjs <frame> [frame ...]
import { openPage } from './browser.mjs';
const { page, close } = await openPage({ gpu: true, w: 320, h: 180 });
await page.goto('http://localhost:8791/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
for (const f of process.argv.slice(2).map(Number)) {
  const r = await page.evaluate((k) => { window.renderFrame(k); const T = window.__THREE, out = {};
    window.__scene.traverse((o) => { if (o.isBone && /(Left|Right)Eye$/.test(o.name)) { let p = o, v = true; while (p) { v = v && p.visible; p = p.parent; } if (!v) return;
      const w = o.getWorldPosition(new T.Vector3()), d = new T.Vector3(0, 1, 0).applyQuaternion(o.getWorldQuaternion(new T.Quaternion()));
      out[o.name.replace(/^mixamorig:?/, '')] = { at: [w.x, -w.z, w.y].map((v) => +v.toFixed(3)), look: [d.x, -d.z, d.y].map((v) => +v.toFixed(2)) }; } });
    return out; }, f);
  console.log(f, JSON.stringify(r));
}
await close();
