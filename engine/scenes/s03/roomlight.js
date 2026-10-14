// Times of day for Ivan's room (set_room03.PRESETS): lightmap sets baked on the same geometry, blended on the GPU,
// plus what the window shows (sky, city lights, trees) and the exposure for each. A scene asks for weights:
//   apply({ '3am': 0.3, day: 0.7 })   or   apply({ '4am_iso': 1 })
// '4am' is the 3am bake a little cooler and darker; '4am_iso' keeps only the desk lit (the rest of the room's
// lightmaps fall away), the chapter's "it's not all pleasant" spotlight.
import * as THREE from 'three';
import { flipV, LM_FLIP } from './scene.js';

const BAKED = ['3am', 'evening', 'day', 'sunrise'];
// what each state does beyond its lightmaps: exposure (stops, relative to lights.json), room-group scale (iso),
// the outside (sky tint and strength, city lights, tree glow) and a live sun for Ivan (no shadows: the bake has them)
const LOOKS = {
  '3am':    { base: '3am', ev: 0, room: 1, sky: [1, 1, 1], skyK: 1, city: 1, tree: 0x050c09, sun: 0 },
  '4am':    { base: '3am', ev: -0.25, room: 0.85, sky: [0.85, 0.9, 1.05], skyK: 0.9, city: 0.7, tree: 0x040a08, sun: 0 },
  '4am_iso':{ base: '3am', ev: -0.1, room: 0.12, sky: [0.6, 0.6, 0.7], skyK: 0.5, city: 0.4, tree: 0x020504, sun: 0 },
  evening:  { base: 'evening', ev: 0, room: 1, sky: [3.2, 1.6, 1.2], skyK: 2.2, city: 0.7, tree: 0x0b0d10, sun: 0 },
  day:      { base: 'day', ev: 0, room: 1, sky: [9, 11, 14], skyK: 1, city: 0, tree: 0x1d2c1c, sun: 0.9, sunColor: 0xfff0dd },
  sunrise:  { base: 'sunrise', ev: 0, room: 1, sky: [8, 5, 4], skyK: 1, city: 0.15, tree: 0x1a1612, sun: 0.7, sunColor: 0xffa060 },
  void:     { base: '3am', ev: 0, room: 0, sky: [0, 0, 0], skyK: 0, city: 0, tree: 0, sun: 0 },
};
// the air per state (volume.js): light direction through the window (Blender, travelling), its colour and density,
// the lamp's in-scatter and the haze. Night: thin cool moon shafts; day: warm beams with dust; sunrise: long and orange.
const MOON = [1, -0.35, -0.75], DAYSUN = [1, 0.3, -0.62], DAWN = [1, -0.2, -0.13];
const AIR = {
  '3am':    { dir: MOON, col: [0.45, 0.58, 1.0], k: 0.022, lamp: 0.0045, haze: 0.0012 },
  '4am':    { dir: MOON, col: [0.42, 0.55, 1.0], k: 0.018, lamp: 0.0030, haze: 0.0010 },
  '4am_iso':{ dir: MOON, col: [0.40, 0.50, 1.0], k: 0.005, lamp: 0.0008, haze: 0.0005 },
  evening:  { dir: [1, 0.0, -0.35], col: [1.0, 0.60, 0.42], k: 0.020, lamp: 0.0045, haze: 0.0014 },
  day:      { dir: DAYSUN, col: [1.0, 0.93, 0.82], k: 0.060, lamp: 0.0, haze: 0.0022 },
  sunrise:  { dir: DAWN, col: [1.0, 0.60, 0.32], k: 0.080, lamp: 0.0025, haze: 0.0018 },
  void:     { dir: MOON, col: [0, 0, 0], k: 0, lamp: 0, haze: 0 },
};
export const STATES = Object.keys(LOOKS);

export async function createRoomLight({ scene, root, renderer, data, loadEXR, LM, roomDir, L, volume }) {
  const groups = data.groups || Object.keys(LM);
  const sets = { '3am': { LM, exposure: data.exposure || 0 } };
  await Promise.all(BAKED.filter((n) => n !== '3am').map(async (n) => {
    const dir = `${roomDir}/../lighting/${n}`;
    const res = await fetch(`${dir}/lights.json`);
    if (!res.ok) { console.warn(`room light: no ${n} bake yet, using 3am`); sets[n] = sets['3am']; return; }
    const d = await res.json();
    const maps = await Promise.all(groups.map((g) => loadEXR(`${dir}/lightmaps/lm_${g}.exr`).catch(() => null)));
    const lm = {};
    groups.forEach((g, i) => {
      const t = maps[i] || LM[g];
      t.channel = 1; t.flipY = false; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; lm[g] = t;
      if (LM_FLIP && maps[i]) flipV(t);
    });
    sets[n] = { LM: lm, exposure: d.exposure || 0 };
  }));

  // the materials that use each group's lightmap, with their own intensity (iso scales it)
  const users = Object.fromEntries(groups.map((g) => [g, []]));
  const outside = { sky: [], city: [], trees: [] };
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const g of groups) if (LM[g] && m.lightMap === LM[g] && !users[g].some((u) => u.m === m)) users[g].push({ m, k: m.lightMapIntensity });
      if (/^Sky_Card/.test(o.name)) outside.sky.push({ m, c: m.emissive.clone(), k: m.emissiveIntensity });
      else if (/^(Street_|Valley_|House_Windows|Facade_Towers|Aviation_)/.test(o.name)) outside.city.push({ m, k: m.emissiveIntensity });
      else if (/^Tree_Line/.test(o.name)) outside.trees.push({ m });
    }
  });

  // GPU blend of two sets into render targets (one per group)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { a: { value: null }, b: { value: null }, w: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform sampler2D a, b; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(a, vUv), texture2D(b, vUv), w); }',
    depthTest: false, depthWrite: false,
  }));
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rts = {};
  const sun = new THREE.DirectionalLight(0xffffff, 0);          // a live sun on Ivan, from the window
  sun.position.set(-8, 4, -2.4); sun.target.position.set(1.0, 1.0, -3.8);
  scene.add(sun, sun.target);

  let lastMaps = '', exposure = 0;
  function blendMaps(wb) {                                      // wb: weights per baked set
    const on = Object.entries(wb).filter(([, w]) => w > 0.001).sort((x, y) => y[1] - x[1]).slice(0, 2);
    const key = on.map(([n, w]) => `${n}:${w.toFixed(3)}`).join(',');
    if (key === lastMaps) return; lastMaps = key;
    for (const g of groups) {
      let tex;
      if (on.length === 1) tex = sets[on[0][0]].LM[g];
      else {
        const [[na, wa], [nb, wbb]] = on, A = sets[na].LM[g], Bt = sets[nb].LM[g];
        if (A === Bt) tex = A;
        else {
          const size = Math.max(A.image.width, Bt.image.width);
          if (!rts[g] || rts[g].width !== size) {
            rts[g] = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false,
              minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.LinearSRGBColorSpace });
            rts[g].texture.channel = 1; rts[g].texture.flipY = false;
            if (LM_FLIP) flipV(rts[g].texture);        // the blend copies the maps texel for texel, so it keeps their orientation
          }
          quad.material.uniforms.a.value = A; quad.material.uniforms.b.value = Bt; quad.material.uniforms.w.value = wbb / (wa + wbb);
          const prev = renderer.getRenderTarget(), tm = renderer.toneMapping;
          renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rts[g]); renderer.render(qs, qc);
          renderer.setRenderTarget(prev); renderer.toneMapping = tm;
          tex = rts[g].texture;
        }
      }
      for (const u of users[g]) u.m.lightMap = tex;
    }
  }

  return {
    sets, sun,
    get exposure() { return exposure; },
    // weights over STATES (sum ~1)
    apply(w) {
      const wb = {}; let ev = 0, room = 0, skyK = 0, city = 0, sunK = 0;
      const sky = new THREE.Color(0, 0, 0), tree = new THREE.Color(0, 0, 0), sunC = new THREE.Color(0, 0, 0);
      for (const [n, k] of Object.entries(w)) {
        const s = LOOKS[n]; if (!s || k <= 0) continue;
        wb[s.base] = (wb[s.base] || 0) + k;
        ev += k * ((sets[s.base].exposure - sets['3am'].exposure) + s.ev);
        room += k * s.room; skyK += k * s.skyK; city += k * s.city; sunK += k * s.sun;
        sky.r += k * s.sky[0]; sky.g += k * s.sky[1]; sky.b += k * s.sky[2];
        tree.add(new THREE.Color(s.tree).multiplyScalar(k));
        if (s.sun) sunC.add(new THREE.Color(s.sunColor).multiplyScalar(k * s.sun));
      }
      blendMaps(wb);
      for (const g of groups) for (const u of users[g]) u.m.lightMapIntensity = u.k * (g === 'DESK' ? Math.max(room, 0.85) : room);
      for (const o of outside.sky) { o.m.emissive.setRGB(o.c.r * sky.r, o.c.g * sky.g, o.c.b * sky.b); o.m.emissiveIntensity = o.k * skyK; }
      for (const o of outside.city) o.m.emissiveIntensity = o.k * city;
      for (const o of outside.trees) o.m.emissive.copy(tree);
      sun.intensity = sunK; if (sunK > 0) sun.color.copy(sunC.multiplyScalar(1 / sunK));
      if (L && L.fill) L.fill.intensity = 0.35 * Math.min(1, room + 0.2);
      if (volume) {
        const u = volume.uniforms, dir = new THREE.Vector3(), col = new THREE.Color(0, 0, 0);
        let k = 0, lampK = 0, haze = 0;
        for (const [n, wt] of Object.entries(w)) {
          const a = AIR[n]; if (!a || wt <= 0) continue;
          dir.addScaledVector(new THREE.Vector3(...a.dir).normalize(), wt);
          col.r += wt * a.col[0] * a.k; col.g += wt * a.col[1] * a.k; col.b += wt * a.col[2] * a.k;
          k += wt * a.k; lampK += wt * a.lamp; haze += wt * a.haze;
        }
        u.winDir.value.copy(dir.normalize());
        if (k > 0) u.winColor.value.setRGB(col.r / k, col.g / k, col.b / k);
        u.winK.value = k; u.lampK.value = lampK; u.hazeK.value = haze;
      }
      exposure = ev;
    },
  };
}

// "3am", "3am -> day (blend 38.0-40.4)", "dusk (day -> evening)", "time-lapse: evening -> 3am -> sunrise -> day -> evening",
// "4am + green spill", "void -> white": a shot's light field from the timeline -> weights at time t
export function weightsFor(field, t, t0, t1) {
  const f = String(field || '3am').toLowerCase();
  const names = (f.match(/4am_iso|4am|3am|evening|day|sunrise|void/g) || ['3am']).map((n) => n);
  if (/dusk/.test(f) && !names.includes('evening')) names.push('evening');
  const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  if (/time-lapse/.test(f) && names.length > 1) {                     // run through the list across the shot
    const u = Math.min(0.9999, Math.max(0, (t - t0) / (t1 - t0))) * (names.length - 1);
    const i = Math.floor(u), k = smooth(u - i);
    return k < 0.001 ? { [names[i]]: 1 } : { [names[i]]: 1 - k, [names[i + 1]]: k };
  }
  if (names.length > 1) {                                             // "a -> b", optionally "(blend x-y)"
    const m = /blend\s*([\d.]+)\s*-\s*([\d.]+)/.exec(f);
    const [b0, b1] = m ? [+m[1], +m[2]] : [t0, t1];
    const k = smooth((t - b0) / (b1 - b0));
    const a = names[0], b = names[names.length - 1];
    return a === b ? { [a]: 1 } : { [a]: 1 - k, [b]: k };
  }
  return { [names[0]]: 1 };
}
