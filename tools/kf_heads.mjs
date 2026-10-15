// Where is Ivan's head in each keyframe? Prints the Head bone and eye-line positions (Blender metres) for chosen shots,
// so cameras are aimed at measured points instead of guesses.
//   node tools/kf_heads.mjs K02 K06 K33 ...
import { openPage } from './browser.mjs';
import { readSceneModule } from '../studio/lib/project.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = readSceneModule(ROOT, { module: 'engine/scenes/kf1/scene.js' });
const ids = process.argv.slice(2);
const { page, close } = await openPage({ gpu: true, w: 320, h: 180 });
await page.goto((process.env.KF_URL || 'http://localhost:8080/engine/index.html') + '?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
for (const s of mod.shots.filter((x) => !ids.length || ids.includes(x.id))) {
  const f = Math.round(Math.max(s.t0 + 0.5 * (s.t1 - s.t0), 1) * 24);
  const r = await page.evaluate((n) => {
    window.renderFrame(n);
    const T = window.__THREE, out = [];
    const bl = (v) => [+v.x.toFixed(3), +(-v.z).toFixed(3), +v.y.toFixed(3)];
    window.__scene.traverse((o) => {
      if (!o.isBone || !/Head$/.test(o.name) || /Top/.test(o.name)) return;
      let p = o, vis = true; while (p) { if (!p.visible) vis = false; p = p.parent; }
      if (!vis) return;
      const h = o.getWorldPosition(new T.Vector3()), q = o.getWorldQuaternion(new T.Quaternion());
      const e = h.clone().add(new T.Vector3(0, 0.085, 0.085).applyQuaternion(q));
      const hand = {};
      o.parent.parent.parent.traverse((b) => { if (b.isBone && /(Left|Right)HandMiddle1$/.test(b.name)) hand[b.name.slice(-12, -7)] = bl(b.getWorldPosition(new T.Vector3())); });
      const fw = new T.Vector3(0, 0, 1).applyQuaternion(q); const fwd = [+fw.x.toFixed(2), +(-fw.z).toFixed(2), +fw.y.toFixed(2)];
      out.push({ head: bl(h), eye: bl(e), fwd, hand });
    });
    return { cam: bl(window.__camera.position), out };
  }, f);
  console.log(s.id, 'cam', JSON.stringify(r.cam), JSON.stringify(r.out));
}
await close();
