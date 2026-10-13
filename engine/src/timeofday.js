// Times of day for scenes that leave 3 AM. Each time of day is a lighting set: Cycles lightmaps baked on the
// same geometry (assets/lighting/<name>/lightmaps/lm_*.exr; 3am lives in assets/lightmaps) and a live rig.
// Blends between sets are done on the GPU: the lightmaps are mixed into render targets, the live lights
// and the exposure are interpolated, and the environment (Ivan's ambient) follows the dominant set.
//
// A scene declares light(t) -> { '3am': w, day: w, ... } (weights sum to 1).
import * as THREE from 'three';
import { B } from './shots.js';

// live rig per time of day: multipliers for the night rig's lights, plus sun and sky for the day sets
export const RIGS = {
  '3am':   { lamp: 1, fairy: 1, screen: 1, face: 1, rim: 1, monitor: 1, wash: 1, blinds: 1, sun: 0, sky: 0 },
  evening: { lamp: 1, fairy: 1, screen: 1, face: 0.8, rim: 0.8, monitor: 1, wash: 0.7, blinds: 0.5, sun: 0, sky: 0.15 },
  day:     { lamp: 0, fairy: 0, screen: 0.35, face: 0.15, rim: 0, monitor: 0.4, wash: 0, blinds: 0, sun: 1, sky: 1,
             sunAz: 118, sunEl: 40, sunColor: 0xfff0dd, sunK: 3.2 },
  sunrise: { lamp: 0, fairy: 0.4, screen: 0.6, face: 0.4, rim: 0, monitor: 0.6, wash: 0, blinds: 0, sun: 1, sky: 0.45,
             sunAz: 100, sunEl: 9, sunColor: 0xffa060, sunK: 4.0 },
};

const sunDir = (az, el) => {             // Blender: from north, clockwise; towards the sun
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};

export async function loadSets(names, loadEXR, base) {
  const out = { '3am': base };
  await Promise.all(names.filter((n) => n !== '3am').map(async (n) => {
    const dir = `assets/lighting/${n}`;
    const data = await (await fetch(`${dir}/lights.json`)).json();
    const [a, d, r] = await Promise.all(['ARCH', 'DESK', 'ROOM'].map((g) => loadEXR(`${dir}/lightmaps/lm_${g}.exr`)));
    for (const t of [a, d, r]) { t.channel = 1; t.flipY = false; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; }
    out[n] = { LM: { ARCH: a, DESK: d, ROOM: r }, exposure: data.exposure || 0 };
  }));
  return out;
}

// Lightmap mixer: materials point at one set's textures when a single set is active, at a mixed
// render target while two blend.
export function createMixer(renderer, root, sets) {
  const users = { ARCH: [], DESK: [], ROOM: [] };
  const night = sets['3am'].LM;
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const g of Object.keys(users)) if (m.lightMap === night[g] && !users[g].includes(m)) users[g].push(m);
    }
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { a: { value: null }, b: { value: null }, w: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform sampler2D a, b; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(a, vUv), texture2D(b, vUv), w); }',
    depthTest: false, depthWrite: false,
  }));
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rts = {};
  let last = '';
  return {
    set(weights) {
      const on = Object.entries(weights).filter(([, w]) => w > 0.001).sort((x, y) => y[1] - x[1]);
      const key = on.map(([n, w]) => `${n}:${w.toFixed(3)}`).join(',');
      if (key === last) return; last = key;
      for (const g of Object.keys(users)) {
        let tex;
        if (on.length === 1) tex = sets[on[0][0]].LM[g];
        else {
          const [[na, wa], [nb, wb]] = on;
          const A = sets[na].LM[g], Bt = sets[nb].LM[g];
          const size = Math.max(A.image.width, Bt.image.width);
          if (!rts[g] || rts[g].width !== size) {
            rts[g] = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false,
              minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.LinearSRGBColorSpace });
            rts[g].texture.channel = 1; rts[g].texture.flipY = false;
          }
          quad.material.uniforms.a.value = A; quad.material.uniforms.b.value = Bt;
          quad.material.uniforms.w.value = wb / (wa + wb);
          const prev = renderer.getRenderTarget(), tm = renderer.toneMapping;
          renderer.toneMapping = THREE.NoToneMapping;
          renderer.setRenderTarget(rts[g]); renderer.render(qs, qc);
          renderer.setRenderTarget(prev); renderer.toneMapping = tm;
          tex = rts[g].texture;
        }
        for (const m of users[g]) m.lightMap = tex;
      }
    },
  };
}

// The day rig: a sun with shadows (through the east window), and a soft sky fill from the windows.
export function createDayRig(scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 0.5; sc.far = 30;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2;
  sun.target.position.copy(B(7.0, 3.0, 0.9));
  scene.add(sun, sun.target);
  const sky = new THREE.RectAreaLight(0xbcd0ff, 0, 2.6, 1.6);       // the east window as a soft source
  sky.position.copy(B(9.8, 3.6, 1.6)); sky.lookAt(B(6.0, 3.6, 1.0));
  scene.add(sky);
  return { sun, sky };
}

export const weigh = (weights, field) => Object.entries(weights).reduce((s, [n, w]) => s + w * (RIGS[n][field] ?? 0), 0);

// interpolate the live rig: night lights scaled, sun aimed and coloured by the weighted day sets
export function applyRig(L, day, weights, base) {
  const k = (field) => weigh(weights, field);
  L.lamp.intensity = L.lampBase * base.lamp * k('lamp');
  L.screen.intensity = L.screenBase * base.screen * k('screen');
  L.faceKey.intensity = 0.7 * base.screen * k('face');
  L.rim.intensity = 1.3 * k('rim');
  if (L.monitor) L.monitor.intensity = 1.9 * base.screen * k('monitor');
  L.wash.intensity = 2.6 * k('wash');
  L.blinds.intensity = 9 * k('blinds');
  const sunW = Object.entries(weights).filter(([n]) => RIGS[n].sun);
  const tw = sunW.reduce((s, [, w]) => s + w, 0);
  if (tw > 0) {
    const d = new THREE.Vector3(), c = new THREE.Color(0, 0, 0);
    let I = 0;
    for (const [n, w] of sunW) {
      const r = RIGS[n];
      d.addScaledVector(sunDir(r.sunAz, r.sunEl), w);
      c.add(new THREE.Color(r.sunColor).multiplyScalar(w / tw));
      I += r.sunK * w;
    }
    day.sun.position.copy(day.sun.target.position).addScaledVector(d.normalize(), 12);
    day.sun.color.copy(c); day.sun.intensity = I;
  } else day.sun.intensity = 0;
  day.sky.intensity = 6 * k('sky');
}

export function exposureFor(sets, weights) {           // blend exposure in stops
  return Object.entries(weights).reduce((s, [n, w]) => s + w * (sets[n]?.exposure ?? 0), 0);
}
