// What is under a pixel: raycast from a fixed camera in the engine and print object, material and lightmap UV.
//   node tools/pick.mjs --scene s03 --cam x,y,z,tx,ty,tz,mm,f --pts 0.2,0.8;0.5,0.5   (pts in 0..1 screen, y down)
import { openPage } from './browser.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const { page, close } = await openPage({ gpu: true, w: 960, h: 540 });
await page.goto(`${arg('url', 'http://localhost:8080/engine/index.html')}?render=1&scene=${arg('scene', 's03')}&cam=${arg('cam')}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
await page.evaluate(() => window.renderFrame(120));
const pts = arg('pts').split(';').map((p) => p.split(',').map(Number));
const out = await page.evaluate((pts) => {
  const T = window.__THREE, sc = window.__scene; let cam = null; sc.traverse((o) => { if (o.isCamera && !cam) cam = o; });
  cam = cam || window.__camera;
  const rc = new T.Raycaster();
  return pts.map(([x, y]) => {
    rc.setFromCamera(new T.Vector2(x * 2 - 1, -(y * 2 - 1)), window.__camera);
    const h = rc.intersectObjects(sc.children, true).filter((i) => i.object.visible && i.object.isMesh)[0];
    if (!h) return `${x},${y}: nothing`;
    const m = [].concat(h.object.material)[h.face.materialIndex ?? 0] || [].concat(h.object.material)[0];
    return `${x},${y}: ${h.object.name} | ${m.name} | d ${h.distance.toFixed(2)} | uv1 ${h.uv1 ? h.uv1.x.toFixed(3) + ',' + h.uv1.y.toFixed(3) : '-'} | lm ${m.lightMap ? 'yes' : 'no'}`;
  });
}, pts);
console.log(out.join('\n'));
await close();
