// "Last train, Harrow Loop": the PS1 study. One frame, built with intention:
//   eye-level camera across the aisle, the car receding to a lit end door at the left third,
//   Noor right of centre against a black window (negative space round her head), her red jacket the only hot colour,
//   warm fluorescent tubes overhead, tunnel lamps streaking past, smoke curling up in chunky pixels.
import * as THREE from 'three';
import { createPS1Renderer, ps1Material, ps1Unlit, paint, PS1, rng, hash2 } from '../lib/ps1.js';
import { run, keyed } from '../lib/harness.js';
import { box, loft } from '../lib/geo.js';
import { buildSet, updateSet, lampX, W } from './set.js';
import { loadNoor, LOOP } from './character_glb.js';

const Q = new URLSearchParams(location.search);
const RES = (Q.get('res') || '640x360').split('x').map(Number);
const ps = createPS1Renderer({ width: RES[0], height: RES[1], container: document.getElementById('stage'),
  grade: { lift: [0.03, 0.04, 0.045], gain: [0.96, 1.0, 1.02], sat: 0.98, contrast: 1.1 } });
PS1.affine.value = +(Q.get('affine') || 0.15);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0d0a');
scene.fog = new THREE.Fog('#1e2424', 7, 24);
const camera = new THREE.PerspectiveCamera(39, RES[0] / RES[1], 0.05, 60);

// ------------------------------------------------------------------ set + character
const loadImg = (n) => new Promise((res) => { const im = new Image(); im.onload = () => res([n, im]); im.onerror = () => res([n, null]); im.src = `./assets/paint/${n}.png`; });
const PAINT = Object.fromEntries((await Promise.all(['tag_violet', 'tag_cream', 'tag_teal', 'tag_pink', 'poster_noodle', 'poster_sleep', 'poster_lost', 'map', 'grime'].map(loadImg))).filter(([, im]) => im));
const set = buildSet(scene, PAINT);
// Noor v2: the animated GLB (CC0 base body, our outfit and styling), seated on the bench
const noor = await loadNoor('./assets/noor.glb');
const SEAT = new THREE.Vector3(-0.85, 0.548, -W + 0.235);
const ch = { root: new THREE.Group() };
ch.root.add(noor.root);
ch.root.position.set(SEAT.x, 0.02, -W + 0.3);    // the GLB's origin is the armature root, already dropped to seat height
ch.root.rotation.y = 0.12;            // turned a touch toward the lens
scene.add(ch.root);
// v3: the other passengers (same pipeline, original designs), each in their own small loop
const PASS = [   // [file, x, wall side (-1 far, +1 near), turn, time offset]
  ['reader', -4.9, -1, 0.0, 3.1],     // down the car on her side, reading
  ['commuter', -7.3, -1, 0.0, 6.4],   // further down, head over his phone
  ['sleeper', -9.4, -1, 0.0, 0],      // at the far end, asleep against the partition
];
const passengers = [];
for (const [name, x, side, turn, off] of PASS) {
  const p = await loadNoor(`./assets/${name}.glb`);
  const g = new THREE.Group(); g.add(p.root);
  g.position.set(x, 0.02, side * (W - 0.3)); g.rotation.y = (side > 0 ? Math.PI : 0) + turn; scene.add(g);
  passengers.push({ p, off, g, x, side });
}

// painted contact shadows (PS1 had no shadow maps; blobs + painted grime did the job)
const blobTex = paint(32, 32, (c, P) => P.each((x, y) => { const d = Math.hypot(x - 15.5, y - 15.5) / 16; return [0, 0, 0, Math.max(0, 1 - d) ** 1.3 * 255]; }), { wrap: false });
const blob = (w, d, x, y, z, a = 0.6, ry = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ps1Unlit({ map: blobTex, transparent: true, opacity: a, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, y, z); scene.add(m); return m;
};
blob(0.5, 0.5, SEAT.x, 0.478, SEAT.z + 0.05, 0.7);                // where she sits
blob(0.55, 0.42, SEAT.x + 0.02, 0.003, SEAT.z + 0.52, 0.55);      // under her feet
for (const { x, side } of PASS.map(([n, x, side]) => ({ x, side }))) {   // contact shadows under every passenger
  blob(0.5, 0.5, x, 0.478, side * (W - 0.235) - side * 0.05, 0.7); blob(0.55, 0.42, x, 0.003, side * (W - 0.235) - side * 0.52, 0.55);
}
const behind = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75), ps1Unlit({ map: blobTex, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
behind.position.set(SEAT.x, 0.82, -W + 0.06); behind.rotation.x = -0.12; scene.add(behind);   // her shadow on the seat back

// props with a reason: her bag on the seat beside her, a can rolling by the door, a newspaper someone left
const bagTex = paint(32, 32, (c, P) => { P.fill('#1d1e22'); P.mottle(10, 51, 0.2); P.rect(10, 12, 9, 7, '#b5241b'); P.text('N', 12, 12, '#e9e2cf', 1); P.rect(0, 0, 32, 2, '#2c2d33'); P.noise(5, 52); });
const bag = new THREE.Mesh(loft([{ t: 0, rx: 0.15, rz: 0.06 }, { t: 0.5, rx: 0.17, rz: 0.08 }, { t: 1, rx: 0.17, rz: 0.075 }], { length: 0.3, sides: 8, capStart: true }), ps1Material({ map: bagTex }));
bag.position.set(SEAT.x - 0.68, 0.78, -W + 0.2); bag.rotation.set(-0.25, 0.3, 0.12); scene.add(bag);
const strap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 3, 10, Math.PI), ps1Material({ color: '#18191c' }));
strap.position.set(SEAT.x - 0.66, 0.79, -W + 0.2); strap.rotation.set(0, 0.3, 0.1); scene.add(strap);
const canTex = paint(16, 16, (c, P) => { P.fill('#2a7ac0'); P.rect(0, 5, 16, 5, '#f2f0e6'); P.text('Z', 5, 4, '#c8382b', 1); P.rect(0, 0, 16, 1, '#c9ccd0'); P.rect(0, 15, 16, 1, '#c9ccd0'); P.noise(6, 53); });
const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8), ps1Material({ map: canTex }));
can.rotation.z = Math.PI / 2; can.position.set(-2.55, 0.034, -0.35); scene.add(can);
blob(0.18, 0.1, -2.55, 0.002, -0.33, 0.5);
const newsTex = paint(32, 24, (c, P) => { P.fill('#cfc8b4'); P.text('LOOP', 2, 2, '#222', 1); for (let y = 11; y < 23; y += 2) P.rect(2 + (y % 4), y, 26 - (y % 6), 1, '#77736a'); P.rect(18, 2, 12, 7, '#6b675e'); P.mottle(12, 54, 0.2); });
const news = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.3), ps1Material({ map: newsTex }));
news.position.set(-6.1, 0.483, -W + 0.27); news.rotation.y = 0.2; scene.add(news);

// ------------------------------------------------------------------ light (warm tubes overhead, a cool night in the shadows)
const hemi = new THREE.HemisphereLight('#d6dcd6', '#4a5250', 3.0); scene.add(hemi);
const cityFill = new THREE.DirectionalLight('#8fb0e0', 0); cityFill.position.set(-1, 1.2, -4); scene.add(cityFill);      // through the far windows
const cityFillNear = new THREE.DirectionalLight('#9a8fd0', 0); cityFillNear.position.set(-1, 1.0, 4); scene.add(cityFillNear);
const tubes = [];
for (const x of [2.6, -0.4, -3.4, -6.85, -10.2, -13.6]) {
  const l = new THREE.PointLight('#f2f7f6', 4.8, 8.5, 1.25); l.position.set(x, 1.85, 0); scene.add(l); tubes.push(l);
}
const flash = new THREE.PointLight('#ffbf6e', 0, 2.6, 1.6); scene.add(flash);
// v2: the tube right above her reads as her key: a soft warm pool on the face and shoulders
const faceKey = new THREE.PointLight('#f4f6f2', 1.8, 2.2, 1.4); faceKey.position.set(SEAT.x + 0.35, 1.95, -0.55); scene.add(faceKey);         // tunnel lamps sweeping her back
const endGlow = new THREE.PointLight('#ffd79a', 1.2, 3.5, 1.5); endGlow.position.set(-15.0, 1.5, 0); scene.add(endGlow);

// ------------------------------------------------------------------ smoke (dithered pixels; screen-door alpha like the hardware did)
const N_SMOKE = 92;
const smokeGeo = new THREE.BufferGeometry();
smokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N_SMOKE * 3), 3));
smokeGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(N_SMOKE), 1));
smokeGeo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(new Float32Array(N_SMOKE), 1));
const smokeMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: RES[1] * 0.9 }, uSnapRes: PS1.snapRes, fogColor: { value: scene.fog.color }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far } },
  vertexShader: `attribute float aSize, aAlpha; varying float vA; uniform float uScale; uniform vec2 uSnapRes; varying float vDepth;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; vDepth = -mv.z;
      vec4 p = gl_Position; p.xy = floor(p.xy / p.w * uSnapRes + 0.5) / uSnapRes * p.w; gl_Position = p;
      gl_PointSize = max(1.0, floor(aSize * uScale / -mv.z)); vA = aAlpha; }`,
  fragmentShader: `varying float vA; varying float vDepth; uniform vec3 fogColor; uniform float fogNear, fogFar;
    float bayer(vec2 p){ int x=int(mod(p.x,4.0)), y=int(mod(p.y,4.0)); int i=x+y*4;
      float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
      for(int k=0;k<16;k++) if(k==i) return (m[k]+0.5)/16.0; return 0.5; }
    void main(){ vec2 c = gl_PointCoord - 0.5; float edge = 1.0 - smoothstep(0.25, 0.5, max(abs(c.x), abs(c.y)) + 0.12*length(c));
      if (vA * edge < bayer(gl_FragCoord.xy)) discard;
      vec3 col = vec3(0.80, 0.79, 0.74); float f = smoothstep(fogNear, fogFar, vDepth);
      gl_FragColor = vec4(mix(col, fogColor, f), 1.0); }`,
  transparent: false, depthWrite: false,
});
const smoke = new THREE.Points(smokeGeo, smokeMat); smoke.frustumCulled = false; scene.add(smoke);

const ember = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.011, 0.011), ps1Unlit({ color: '#ff6a1c' })); scene.add(ember);
const _w = new THREE.Vector3();
const toWorld = (v) => _w.copy(v).applyMatrix4(ch.root.matrixWorld);
function updateSmoke(t) {
  ch.root.updateMatrixWorld();
  const pos = smokeGeo.attributes.position, sz = smokeGeo.attributes.aSize, al = smokeGeo.attributes.aAlpha;
  let k = 0;
  // the ember's thread: born every 0.1 s, rising, curling, spreading
  for (let i = 0; i < 70; i++, k++) {
    const a = (t % 0.06) + i * 0.06, tb = t - a, J = { dragK: noor.dragK(tb) };
    const o = toWorld(noor.ember(tb)), s = hash2(Math.round(tb * 16.7), 0, 3);
    const curl = Math.sin(a * 2.4 + s * 6) * 0.03 * a + Math.sin(a * 5.1 + tb) * 0.008;
    pos.setXYZ(k, o.x + curl * 0.6 + a * 0.012, o.y + a * 0.13 + a * a * 0.01, o.z - a * 0.03);   // v3: rises and curls, drifts back toward the window
    sz.setX(k, 0.011 + a * 0.02);
    al.setX(k, 0.8 * Math.min(1, a * 5) * Math.max(0, 1 - a / 2.8) * (1 - J.dragK * 0.7 * Math.max(0, 1 - a)));
  }
  // the exhale after the drag: a soft push forward, then it rises and opens up
  for (let i = 0; i < N_SMOKE - 70; i++, k++) {
    const tb = 4.1 + i * 0.055, a = ((t - tb) % LOOP + LOOP) % LOOP;
    if (a > 2.2) { al.setX(k, 0); continue; }
    const o = toWorld(noor.mouth(tb).add(new THREE.Vector3(0.02, -0.01, 0.05))), s = hash2(i, 7, 1) - 0.5;
    const push = 1 - Math.exp(-a * 2.2);
    pos.setXYZ(k, o.x + push * (0.2 + s * 0.08) + a * 0.12, o.y - push * 0.03 + a * a * 0.025 + a * 0.02, o.z + push * (0.22 + s * 0.06));
    sz.setX(k, 0.014 + a * 0.03 + push * 0.02);
    al.setX(k, 0.5 * Math.min(1, a * 3) * Math.max(0, 1 - a / 2.2));
  }
  pos.needsUpdate = sz.needsUpdate = al.needsUpdate = true;
}

// ------------------------------------------------------------------ camera: fixed, eye level across the aisle, with the train's sway
const CAM = { pos: new THREE.Vector3(0.22, 1.1, 0.55), at: new THREE.Vector3(-2.4, 0.95, -1.15) };   // v2: closer, she fills the right third like the reference
if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); CAM.pos.set(c[0], c[1], c[2]); CAM.at.set(c[3], c[4], c[5]); if (c[6]) camera.fov = c[6]; }
function updateCamera(t) {
  const w = (2 * Math.PI) / LOOP;
  const sway = Math.sin(t * w * 3) * 0.006 + Math.sin(t * w * 7 + 1) * 0.002;   // periods divide the loop: seamless
  const bump = Math.max(0, Math.sin(t * w * 2 - 0.5)) ** 24 * 0.006;           // a rail joint
  camera.position.copy(CAM.pos).add(new THREE.Vector3(sway * 0.4, bump + Math.sin(t * w * 5) * 0.002, sway));
  camera.lookAt(CAM.at.x, CAM.at.y + bump * 0.5, CAM.at.z);
  camera.rotateZ(sway * 0.35);
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ the clock
function update(t) {
  const flick = updateSet(set, t);
  tubes[3].intensity = 4.6 * (0.25 + 0.75 * flick);
  // the tunnel lamp nearest Noor lights her from behind as it passes
  let best = 1e9, bx = 0;
  for (let i = 0; i < 7; i++) { const x = lampX(i, t); const d = Math.abs(x - SEAT.x); if (d < best) { best = d; bx = x; } }
  flash.position.set(bx, 1.5, -W - 0.35);
  flash.intensity = 2.2 * Math.max(0, 1 - best / 1.8);
  noor.setTime(t);
  ember.position.copy(toWorld(noor.ember(t))); const dk = noor.dragK(t); ember.material.color.setRGB(1, 0.35 + 0.35 * dk, 0.08 + 0.1 * dk);
  for (const { p, off } of passengers) p.setTime(t + off);
  // the elevated stretch: cool city light through the windows, the warm tubes a little lower against it
  const open = set.open || 0;
  cityFill.intensity = 1.4 * open; cityFillNear.intensity = 0.9 * open;
  hemi.color.set('#d6dcd6').lerp(new THREE.Color('#b9c6d6'), open * 0.5);
  updateSmoke(t);
  updateCamera(t);
}
run({ duration: LOOP, update, render: () => ps.render(scene, camera) });
