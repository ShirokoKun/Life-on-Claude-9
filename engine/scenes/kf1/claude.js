// Claude, the character: the small blocky creature of board A r3c1 (the "spark" sprite), built as PS1-era voxels
// (voxel.js). Warm and friendly when it arrives (V10), a builder at 3 AM (V07a), a guide at the door (V17), one
// shade colder after "HE built that" (V27), hollow at dawn (V30b). Its light is real: a warm point light goes with it,
// so it lights Ivan's face and the desk. The film's bloom makes the glow.
//
//   const c = createClaude({ size: 0.012 }); scene.add(c.group);
//   c.set({ pos: B(...), yaw: 0.4, mood: 'warm', pose: 'wave', t, build: 1, glow: 1 });
import * as THREE from 'three';
import { voxels, voxelMaterial, assemble, hex } from './voxel.js';

// palette: Claude's orange (#d97757, ch1 style bible claude_orange), a hot core, the dark eyes
const MOODS = {
  warm:   { body: hex('#e2622a'), dark: hex('#8f2e12'), hot: hex('#ffc27a'), hotK: 3.2, glow: 1.15, light: 0xff9a55, lightK: 1.0, motes: ['#ffd43b', '#ffffff', '#ff9a4d'], moteGlow: 7 },
  bright: { body: hex('#f26a2c'), dark: hex('#9a3414'), hot: hex('#ffe0a8'), hotK: 4.5, glow: 1.35, light: 0xffa866, lightK: 1.6, motes: ['#ffe58a', '#ffffff', '#ffb36b'], moteGlow: 9 },
  cold:   { body: hex('#b8a6a0'), dark: hex('#4a5866'), hot: hex('#cfe6ff'), hotK: 2.6, glow: 1.0, light: 0xbfd4ff, lightK: 0.8, motes: ['#9fd8ff', '#ffffff', '#c9d6e8'], moteGlow: 5 },
  hollow: { body: hex('#8a5a46'), dark: hex('#3a2a24'), hot: hex('#b88a70'), hotK: 0.9, glow: 0.7, light: 0xd89a7a, lightK: 0.25, motes: ['#6b5a52'], moteGlow: 0.6 },
};

// front view, top row first: a lit top edge (H), a darker pixel outline (D), the eyes (E)
const BODY = [
  'DHHHHHHD',
  'DOEOOEOD',
  'DOEOOEOD',
  'DOOOOOOD',
  'DDDDDDDD',
];

export function createClaude({ size = 0.012, motes = 40 } = {}) {
  const group = new THREE.Group(); group.name = 'Claude';
  const rig = new THREE.Group(); group.add(rig);                      // bob and tilt live here
  const mats = [];
  const mat = () => { const m = voxelMaterial(); mats.push(m); return m; };
  const pal = (M) => ({ O: M.body, D: M.dark, H: M.hot.map((v) => v * M.hotK), E: hex('#140b08'), A: M.body, L: M.dark });

  const body = voxels(BODY, pal(MOODS.warm), { size, depth: 4, frontOnly: { E: 'O' }, material: mat() });
  body.position.y = 2 * size;                                          // the legs are two voxels tall
  rig.add(body);
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 4 * size, 4.0 * size, 0);                 // shoulder: the body's side, mid-height
    const m = voxels(['AA'], pal(MOODS.warm), { size, depth: 2, material: mat() });
    m.position.x = side * 1.0 * size; m.position.y = -0.5 * size;
    pivot.add(m); rig.add(pivot); return pivot;
  };
  const armL = arm(-1), armR = arm(1);
  const legs = [-2.5, -1.5, 1.5, 2.5].map((x) => {
    const pivot = new THREE.Group(); pivot.position.set(x * size, 2 * size, 0);
    const m = voxels(['L', 'L'], pal(MOODS.warm), { size, depth: 2, material: mat() });
    m.position.y = -2 * size; pivot.add(m); rig.add(pivot); return pivot;
  });

  // the motes: a slow orbit of hot pixels around it (the "magic"), each one a voxel
  const moteMat = voxelMaterial({ color: [1, 1, 1], glow: 5 });
  const mote = new THREE.InstancedMesh(new THREE.BoxGeometry(size * 0.3, size * 0.3, size * 0.3), moteMat, motes);
  mote.frustumCulled = false; group.add(mote);

  // round 13: the warm halo in the air around it (r6 had it: Claude lit the air and his face; it went missing). A soft
  // additive glow that breathes, behind the voxels; with the light it makes Claude a source, not an object
  const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hg = hc.getContext('2d');
  const hgr = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
  hgr.addColorStop(0, 'rgba(255,255,255,0.55)'); hgr.addColorStop(0.25, 'rgba(255,255,255,0.18)'); hgr.addColorStop(0.6, 'rgba(255,255,255,0.05)'); hgr.addColorStop(1, 'rgba(255,255,255,0)');
  hg.fillStyle = hgr; hg.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa36b }));
  halo.position.y = 4 * size; halo.renderOrder = 5; group.add(halo);
  // round 14: a tighter inner glow round its body (the warm air right at it), under the wide halo
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo.material.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa36b }));
  core.position.y = 3.5 * size; core.renderOrder = 5; group.add(core);
  const light = new THREE.PointLight(0xffa36b, 0, 1.2, 2);
  light.position.y = 4 * size; group.add(light);

  const parts = [body, ...armL.children, ...armR.children, ...legs.flatMap((l) => l.children)];
  const st = { mood: '' };

  function set({ pos, yaw = 0, pitch = 0, scale = 1, mood = 'warm', pose = 'hover', t = 0, build = 1, glow = 1,
    lightK = 1, glitch = 0, moteK = 1, blink = 0, halo: haloK = 1 } = {}) {
    const M = MOODS[mood] || MOODS.warm;
    if (pos) group.position.copy(pos);
    group.rotation.set(pitch, yaw, 0); group.scale.setScalar(scale);
    // colour by mood (re-tint the instances once per mood change)
    if (st.mood !== mood) {
      const c = new THREE.Color(), P = pal(M);
      for (const p of parts) {
        p.userData.cells.forEach((v, i) => {
          const k = 0.86 + 0.22 * (v.y / 4);
          p.setColorAt(i, c.setRGB(...(P[v.ch] || M.body)).multiplyScalar(v.ch === 'H' ? 1 : Math.min(1.08, k)));
        });
        p.instanceColor.needsUpdate = true;
      }
      const mc = M.motes.map((h) => new THREE.Color(h));
      for (let i = 0; i < motes; i++) mote.setColorAt(i, mc[i % mc.length]);
      mote.instanceColor.needsUpdate = true;
      st.mood = mood;
    }
    for (const m of mats) { m.uniforms.uGlow.value = M.glow * glow; m.uniforms.uGlitch.value = glitch; m.uniforms.uTime.value = t; }
    moteMat.uniforms.uGlow.value = M.moteGlow * glow * moteK;
    // round 14 (A2): its glow is ALWAYS on: a halo in the air that breathes (size and strength on a slow pulse, a second
    // faster one under it), and its light breathing with it, so Claude reads as a source in every frame it is in
    const br = 0.5 + 0.5 * Math.sin(t * 1.9), br2 = 0.5 + 0.5 * Math.sin(t * 4.3 + 1.1);
    light.color.setHex(M.light); light.intensity = 2.2 * M.lightK * glow * lightK * build * scale * scale * (0.9 + 0.12 * br);
    light.distance = 1.8 * scale;
    halo.material.color.setHex(M.light).multiplyScalar(Math.max(0.3, 0.6 * glow) * haloK * build * (0.8 + 0.25 * br + 0.06 * br2));
    halo.scale.setScalar(size * 26 * scale * (0.94 + 0.12 * br));
    core.material.color.setHex(M.light).multiplyScalar(Math.max(0.35, 0.7 * glow) * haloK * build * (0.85 + 0.2 * br2));
    core.scale.setScalar(size * 12 * scale * (0.96 + 0.06 * br2));

    // poses (degrees in comments): arms rotate about z at the shoulder, legs swing about x at the hip
    const A = { hover: [-20, 20], wave: [-25, 150], present: [-60, 60], type: [-70, 70], hold: [160, -160], cheer: [140, -140],
      sit: [-30, 30], point: [-25, 95], idle: [-10, 10], shrug: [40, -40] }[pose] || [-20, 20];
    const wob = pose === 'wave' ? 18 * Math.sin(t * 9) : 0;
    armL.rotation.z = THREE.MathUtils.degToRad(A[0]);
    armR.rotation.z = THREE.MathUtils.degToRad(A[1] + wob);
    if (pose === 'type') { armL.rotation.x = armR.rotation.x = -0.9; } else { armL.rotation.x = armR.rotation.x = 0; }
    const walk = pose === 'walk' ? Math.sin(t * 10) * 0.5 : 0;
    legs.forEach((l, i) => { l.rotation.x = (i % 2 ? walk : -walk); l.rotation.z = pose === 'sit' ? (i < 2 ? -1.2 : 1.2) : 0; });
    rig.position.y = pose === 'sit' ? -1.6 * size : (pose === 'hover' || pose === 'wave' || pose === 'present' ? 0.6 * size * Math.sin(t * 2.4) : 0);
    rig.rotation.z = pose === 'shrug' ? 0.08 : 0;
    // blink: the eyes squash (a held still can show eyes shut)
    body.scale.set(1, 1, 1);
    if (blink) body.userData.blink = blink;

    // build: materialising (V10, V15) or dissolving (V30b) voxel by voxel
    for (const p of parts) assemble(p, build, { spread: 5, seed: p.id });
    mote.visible = moteK > 0 && build > 0.05;

    // motes: a ring that breathes
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < motes; i++) {
      const a = i / motes * Math.PI * 2 + t * 0.6 * (i % 2 ? 1 : -0.7);
      const r = size * (7 + 3 * Math.sin(i * 1.7 + t * 0.9)) * (0.6 + 0.4 * build);
      const y = size * (3.5 + 3.2 * Math.sin(i * 2.3 + t * 1.3));
      m4.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r * 0.7);
      mote.setMatrixAt(i, m4);
    }
    mote.instanceMatrix.needsUpdate = true;
  }
  set({});
  return { group, set, light, halo, core, size };
}
