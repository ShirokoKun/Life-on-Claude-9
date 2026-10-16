// Debug probe: for a frame, for each hand, where each fingertip sits relative to its palm (cm):
// along = toward the fingers' direction, palm = along the palm normal (+ = into the palm), across = index side.
// A curled finger has small/negative 'along' and positive 'palm'. Prints the bone names found too.
import { openPage } from './browser.mjs';
const [frame] = process.argv.slice(2);
const { page, close } = await openPage({ gpu: true, w: 320, h: 180 });
await page.goto('http://localhost:8791/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const r = await page.evaluate((f) => { window.renderFrame(+f); window.renderFrame(+f);
  const T = window.__THREE, out = {};
  let ivan = null; window.__scene.traverse((o) => { if (!ivan && o.isBone && /LeftHandIndex1$/.test(o.name)) { let p = o, v = true; while (p) { v = v && p.visible; p = p.parent; } if (v) ivan = o; } });
  if (!ivan) return 'no ivan';
  let root = ivan; while (root.parent && root.parent.type !== 'Scene') root = root.parent;
  const B = {}; root.traverse((o) => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
  const W = (n) => B[n].getWorldPosition(new T.Vector3());
  for (const S of ['Left', 'Right']) {
    const across = W(S + 'HandIndex1').sub(W(S + 'HandPinky1')).normalize(), along = W(S + 'HandMiddle1').sub(W(S + 'Hand')).normalize();
    const normal = new T.Vector3().crossVectors(across, along).normalize();
    const res = {};
    for (const F of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const base = W(S + 'Hand' + F + '1'), tipName = B[S + 'Hand' + F + '4'] ? S + 'Hand' + F + '4' : S + 'Hand' + F + '3';
      const d = W(tipName).sub(base);
      res[F] = [d.dot(along), d.dot(normal), d.dot(across)].map((v) => +(v * 100).toFixed(1));
    }
    out[S] = res;
  }
  return out;
}, frame);
console.log(JSON.stringify(r, null, 0)); await close();
