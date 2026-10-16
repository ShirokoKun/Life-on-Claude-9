// Debug probe: load a scene, go to a frame, report the room's lightmap sets, the sky and the exposure.
//   node tools/_probe.mjs <scene> <frame>
import { openPage } from './browser.mjs';
const { page, close } = await openPage({ gpu: true, w: 640, h: 360 });
page.on('console', (m) => { if (!/Failed to load/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 200)); });
await page.goto('http://localhost:8080/engine/index.html?render=1&scene=' + process.argv[2]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const r = await page.evaluate((f) => {
  window.renderFrame(f);
  const out = { room: [] };
  window.__scene.traverse((o) => {
    if (!o.isMesh) return;
    if (/^Sky_Card/.test(o.name)) out.sky = [o.material.emissiveIntensity, o.material.emissive.getHexString(), o.visible];
    let p = o; while (p && !/^Baked_/.test(p.name)) p = p.parent;
    if (p && out.room.length < 8) out.room.push([p.name, o.material.name, o.material.lightMap && o.material.lightMap.uuid.slice(0, 6), +o.material.lightMapIntensity.toFixed(3)]);
  });
  out.exp = window.__renderer.toneMappingExposure;
  out.at = {};
  const T = window.__THREE, bb = new T.Box3(), c = new T.Vector3(), sz = new T.Vector3();
  window.__scene.traverse((o) => {
    if (!/^(Phone_Screen|Alarm_Clock|Water_Glass|Water|Laptop_Screen|Monitor_Screen|Lamp_Shade|Lamp_Bulb_Desk)$/.test(o.name)) return;
    bb.setFromObject(o); bb.getCenter(c); bb.getSize(sz);
    const r = (v) => +v.toFixed(3);
    out.at[o.name] = { c: [r(c.x), r(-c.z), r(c.y)], size: [r(sz.x), r(sz.z), r(sz.y)] };   // Blender x, y, z
  });
  return out;
}, +process.argv[3]);
console.log(JSON.stringify(r));
await close();
