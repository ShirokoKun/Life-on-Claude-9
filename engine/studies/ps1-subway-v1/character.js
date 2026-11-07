// Noor: the only passenger. Built the way late-90s console characters were: segmented, low poly (about 1.4k
// triangles), smooth-shaded, every detail painted into small nearest-filtered textures. Red-and-black puffer
// jacket (the frame's one hot accent), black top, dark denim, white sneakers, a brown bob with a fringe,
// headphones round her neck, a cigarette (under the NO SMOKING sticker).
// Rig: an explicit skeleton. pose(t) returns joint positions (2-bone IK for the arms); meshes are aimed between
// joints every frame. Character space: metres, origin at the pelvis on the seat, facing +z, her left = +x.
import * as THREE from 'three';
import { ps1Material, ps1Unlit, paint, rng, fbm, hash2 } from '../lib/ps1.js';
import { loft, aim } from '../lib/geo.js';
import { keyed, smooth, clamp } from '../lib/harness.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const LOOP = 12;

// ------------------------------------------------------------------ textures
const RED = '#b5241b', REDDK = '#7c140f', BLK = '#18181a', PIPE = '#d9d6cc';

function quilt(P, x0, x1, step, col) { for (let y = 3; y < P.h; y += step) for (let x = x0; x < x1; x++) P.px(x, y, col, 170); }

const jacketTex = () => paint(64, 64, (c, P) => {
  P.fill(RED);
  P.each((x, y, c0) => { const k = 0.9 + 0.1 * Math.sin((y % 9) / 9 * Math.PI); return [c0[0] * k, c0[1] * k, c0[2] * k]; });   // puffy baffles
  quilt(P, 0, 64, 9, REDDK);
  P.rect(0, 0, 64, 17, BLK); P.rect(0, 17, 64, 1, PIPE);                               // the black yoke + piping
  P.rect(0, 58, 64, 6, BLK);                                                           // hem band
  P.rect(12, 0, 9, 64, BLK); P.rect(11, 0, 1, 64, '#8d8c86'); P.rect(21, 0, 1, 64, '#8d8c86');   // open front: black top, zip tapes
  P.rect(6, 38, 4, 1, '#3a0b08'); P.rect(23, 38, 4, 1, '#3a0b08');                     // pocket slits
  P.rect(25, 24, 3, 2, PIPE);                                                          // a tiny chest logo
  P.shade((x) => { const d = Math.min(Math.abs(x - 0), Math.abs(x - 32), Math.abs(x - 64)) / 6; return Math.max(0, 1 - d); }, 0.35, [20, 5, 5]);   // under the arms
  P.noise(6, 3);
});
const sleeveTex = () => paint(32, 64, (c, P) => {
  P.fill(RED); quilt(P, 0, 32, 8, REDDK);
  P.each((x, y, c0) => { const k = 0.9 + 0.1 * Math.sin((y % 8) / 8 * Math.PI); return [c0[0] * k, c0[1] * k, c0[2] * k]; });
  P.rect(0, 0, 32, 14, BLK); P.rect(0, 14, 32, 1, PIPE);                                 // shoulder: the yoke continues
  P.rect(0, 55, 32, 9, BLK);                                                             // cuff
  for (const x of [0, 16]) P.rect(x, 15, 1, 40, PIPE);                                 // white stripe down the outer arm
  P.shade((x) => Math.max(0, 1 - Math.abs(x - 24) / 5), 0.3, [20, 5, 5]);              // the inner arm in shade
  P.noise(6, 4);
});
const denimTex = () => paint(32, 64, (c, P) => {
  P.fill('#2d3a55');
  P.each((x, y, c0) => { const tw = ((x + y) % 3 === 0 ? 8 : 0) - (hash2(x, y, 5) > 0.85 ? 10 : 0); const f = (fbm(x * 0.15, y * 0.08, 6) - 0.5) * 20;
    return [c0[0] + tw + f, c0[1] + tw + f, c0[2] + tw * 1.3 + f]; });
  for (const x of [0, 16]) for (let y = 0; y < 64; y += 2) P.px(x, y, '#b98a4a', 200);   // side seams, gold stitch
  P.shade((x, y) => Math.max(0, 1 - Math.abs(y - 30) / 10) * Math.max(0, 1 - Math.abs(x - 8) / 6), -0.35, [255, 255, 255]);   // knee fade
  P.rect(0, 60, 32, 4, '#1f2940');
});
const skinTex = () => paint(16, 16, (c, P) => { P.fill('#d1a08c'); P.mottle(6, 9, 0.3, [1, 0.8, 0.7]); P.noise(3, 10); });
const shoeTex = () => paint(32, 16, (c, P) => {
  P.fill('#e4e0d4'); P.rect(0, 12, 32, 4, '#9c998e'); P.rect(0, 11, 32, 1, '#6d6b63');
  for (let x = 12; x < 22; x += 2) P.rect(x, 3, 1, 4, '#bdb8aa');                      // laces
  P.rect(2, 6, 6, 2, '#b5241b');                                                       // a red heel tab, echoing the jacket
  P.noise(5, 11);
});
const hairTex = () => paint(32, 32, (c, P) => {
  P.fill('#3e2416');
  P.each((x, y, c0) => { const s = (hash2(x, 0, 7) - 0.5) * 30 + (fbm(x * 0.5, y * 0.05, 8) - 0.5) * 24;
    const sheen = Math.max(0, 1 - Math.abs(y - 9) / 4) * 34;                      // the PS1 "angel ring" highlight
    return [c0[0] + s + sheen, c0[1] + s * 0.8 + sheen * 0.75, c0[2] + s * 0.6 + sheen * 0.5]; });
  P.each((x, y) => (y >= 28 + Math.floor(hash2(x, 3, 9) * 4) ? [0, 0, 0, 0] : null));   // ragged ends (alpha test)
});

// Face: planar projection from the front. 64x64 over x in [-FX, FX], y in [-FY, FY] (head space, metres).
const FX = 0.098, FY = 0.125;
const faceTex = (closed) => paint(64, 64, (c, P) => {
  P.fill('#d3a28f');
  P.each((x, y, c0) => {   // painted modelling: cheek light, jaw and temple shade, lip-to-chin shadow
    const u = (x - 32) / 32, v = (y - 32) / 32;
    const cheek = Math.max(0, 1 - Math.hypot(Math.abs(u) - 0.42, v - 0.25) / 0.35) * 14;
    const side = Math.pow(Math.abs(u), 3) * -30, jaw = Math.max(0, v - 0.55) * -40;
    return [c0[0] + cheek + side + jaw, c0[1] + cheek * 0.8 + side + jaw, c0[2] + cheek * 0.7 + side + jaw * 0.9];
  });
  P.each((x, y, c0) => { const b = Math.max(0, 1 - Math.hypot((Math.abs(x - 32) - 13) / 5, (y - 35) / 3)); return [c0[0] + b * 18, c0[1] - b * 4, c0[2] - b * 2]; });   // blush
  for (const s of [-1, 1]) {
    const ex = 32 + s * 11;
    P.line(ex - 5, 22, ex + 3, 22 - (s > 0 ? 0 : 0), '#2b1810', 255, 1); P.line(ex - 4, 21, ex + 2, 21, '#4a2c1c', 160); // brows
    if (!closed) {
      P.rect(ex - 3, 27, 7, 3, '#efe6dc');                                              // whites
      P.rect(ex - s - 1, 27, 3, 3, '#3a2216'); P.px(ex - s, 28, '#0d0806');            // iris + pupil, looking a little down
      P.line(ex - 4, 27, ex + 4, 27, '#1b100b'); P.px(ex + 4 * s, 26, '#1b100b'); P.px(ex + 5 * s, 26, '#1b100b');   // upper lid + flick of lashes
      P.line(ex - 3, 30, ex + 3, 30, '#a8735d', 140);
    } else {
      P.line(ex - 4, 29, ex + 4, 29, '#1b100b'); P.px(ex + 5 * s, 28, '#1b100b');
    }
    P.line(ex - 3, 31, ex + 2, 31, '#b07c64', 90);                                       // the soft bag under the eye
  }
  P.line(30, 30, 29, 37, '#b98468', 150); P.rect(29, 38, 2, 1, '#8c5845'); P.rect(33, 38, 2, 1, '#8c5845');   // nose
  P.rect(32, 31, 1, 6, '#e3b293', 130);                                                 // the bridge catches light
  P.rect(27, 45, 10, 1, '#5e2a26');                                                     // mouth line
  P.rect(28, 44, 8, 1, '#9b4943'); P.rect(29, 43, 6, 1, '#a9564f', 160);                // upper lip
  P.rect(28, 46, 8, 2, '#b2625a'); P.rect(30, 46, 3, 1, '#cf8a7f');                     // lower lip + highlight
  P.rect(29, 51, 6, 1, '#b5836a', 150);                                                 // under the lip
}, { wrap: false });

// ------------------------------------------------------------------ head geometry
function headGeo() {
  const g = new THREE.SphereGeometry(1, 16, 12);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let X = x * 0.077, Y = y * 0.117, Z = z * 0.092;
    if (y < 0) { const k = Math.pow(-y, 1.4); X *= 1 - 0.32 * k; Z *= 1 - 0.12 * k; }           // jaw tapers to the chin
    if (y < -0.75 && z > 0.2) Z += 0.008;                                                     // chin forward
    if (z < 0) Z *= 1.1;                                                                       // the back of the skull
    if (z > 0.6 && Math.abs(x) < 0.3 && y > -0.42 && y < 0.12) Z += 0.016 * (1 - Math.abs(x) / 0.3) * Math.sin((y + 0.42) / 0.54 * Math.PI);   // nose
    if (z > 0.5 && Math.abs(Math.abs(x) - 0.36) < 0.14 && Math.abs(y - 0.12) < 0.12) Z -= 0.006; // eye sockets
    p.setXYZ(i, X, Y, Z);
    uv.setXY(i, 0.5 + X / (2 * FX), 0.5 + Y / (2 * FY));
  }
  g.computeVertexNormals();
  return g;
}

// The bob: a cap that falls straight to the jaw at the sides and back, a fringe in front. s in 0..1 = the dome,
// 1..2 = the straight drop with a slight flare at the ends. The front opening frames the face.
function hairGeo() {
  const S = 20, R = 10, pos = [], uv = [], idx = [];
  const rx = 0.091, ry = 0.13, rz = 0.106;
  const smax = (th) => {
    const d = Math.abs(((th - Math.PI / 2 + Math.PI) % (2 * Math.PI)) - Math.PI);   // angle from the front
    if (d < 0.75) return 0.8 + 0.06 * Math.cos(d * 9);                                 // the fringe, slightly uneven
    if (d < 1.15) return 0.8 + (d - 0.75) / 0.4 * 1.15;
    return 1.95 + 0.06 * Math.sin(th * 5);
  };
  for (let i = 0; i <= R; i++) for (let j = 0; j <= S; j++) {
    const th = (j / S) * Math.PI * 2, s = smax(th) * (i / R);
    let x, y, z;
    if (s <= 1) { const ph = s * Math.PI / 2; x = rx * Math.sin(ph) * Math.cos(th); z = rz * Math.sin(ph) * Math.sin(th); y = ry * Math.cos(ph); }
    else { const k = s - 1, fl = 1 + 0.14 * k * k; x = rx * fl * Math.cos(th); z = rz * fl * Math.sin(th); y = -k * 0.115; }
    pos.push(x, y + 0.012, z - 0.004); uv.push(j / S * 3, 1 - i / R);
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) {
    const a = i * (S + 1) + j, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ pose
const ARM_U = 0.265, ARM_F = 0.245;
function ik(S, T, a, b, pole) {
  const d0 = T.clone().sub(S); let d = d0.length(); const u = d0.normalize();
  d = clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  const v = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
  const E = S.clone().addScaledVector(u, x).addScaledVector(v, h);
  const W = S.clone().addScaledVector(u, d);
  return [E, W];
}

// the left wrist (cigarette hand): rest by the chin, a drag at 2.0-4.4 s, down to the knee and an ash tap, back up
const WRIST_L = [[0, [0.175, 0.37, 0.225]], [1.8, [0.175, 0.37, 0.225]], [2.6, [0.128, 0.505, 0.156]], [3.7, [0.128, 0.505, 0.156]],
  [4.5, [0.175, 0.37, 0.225]], [7.2, [0.175, 0.365, 0.225]], [8.0, [0.175, 0.29, 0.2]], [8.55, [0.175, 0.29, 0.2]], [8.65, [0.18, 0.27, 0.21]],
  [8.8, [0.175, 0.29, 0.2]], [9.6, [0.175, 0.29, 0.2]], [10.6, [0.175, 0.37, 0.225]], [12, [0.175, 0.37, 0.225]]];
const HEAD = [[0, [0.12, 0.13, 0.04]], [2.0, [0.12, 0.13, 0.04]], [2.6, [0.08, -0.02, 0.02]], [3.7, [0.08, -0.02, 0.02]], [4.6, [0.1, 0.06, 0.03]],
  [6.0, [-0.18, 0.04, -0.02]], [7.6, [-0.18, 0.06, -0.02]], [8.4, [0.18, 0.22, 0.05]], [10.0, [0.18, 0.2, 0.05]], [11.2, [0.12, 0.13, 0.04]], [12, [0.12, 0.13, 0.04]]];   // yaw, pitch, roll

export function pose(t) {
  t = ((t % LOOP) + LOOP) % LOOP;
  const br = Math.sin(t / 4 * Math.PI * 2) * 0.006;                                // breathing, period 4 s
  const J = {};
  J.pelvis = V(0, 0, 0); J.hem = V(0, -0.045, -0.015);
  J.neckBase = V(0, 0.49 + br, -0.075); J.neckTop = V(0, 0.585 + br, -0.05);
  J.head = V(0, 0.665 + br, -0.035);
  [J.hy, J.hp, J.hr] = keyed(HEAD, t);
  J.shL = V(0.172, 0.44 + br, -0.075); J.shR = V(-0.172, 0.44 + br, -0.075);
  const wl = V(...keyed(WRIST_L, t));
  [J.elL, J.wrL] = ik(J.shL, wl, ARM_U, ARM_F, V(1, -0.9, -0.1));
  [J.elR, J.wrR] = ik(J.shR, V(-0.135, 0.125, 0.3), ARM_U, ARM_F, V(-1, -0.6, -0.6));
  // the cigarette hand: fingers up toward the lips during the drag, relaxed otherwise
  const dragK = smooth((t - 1.9) / 0.6) * (1 - smooth((t - 3.7) / 0.7));
  J.mouth = V(0.006 + J.hy * 0.08, 0.607 + br - J.hp * 0.05, 0.052);
  // the cigarette hand points up when resting, and comes in from the front-left to the lips for the drag
  const hdir = V(-0.25, 0.9, 0.1).normalize().lerp(V(-0.62, 0.62, -0.49).normalize(), dragK).normalize();
  J.handL = J.wrL.clone().addScaledVector(hdir, 0.15);
  J.handR = J.wrR.clone().add(V(0.01, -0.05, 0.14).normalize().multiplyScalar(0.15));
  J.hipL = V(0.095, -0.02, 0.02); J.hipR = V(-0.095, -0.02, 0.02);
  J.kneeL = V(0.13, 0.005, 0.43); J.kneeR = V(-0.12, 0.0, 0.43);
  J.ankL = V(0.15, -0.445, 0.5); J.ankR = V(-0.13, -0.445, 0.47);
  J.toeL = V(0.165, -0.485, 0.7); J.toeR = V(-0.15, -0.485, 0.67);
  J.dragK = dragK;
  // cigarette between the first two fingers: out and forward at rest; at the drag its filter sits at the lips
  const cdir = V(0.6, 0.35, 0.7).normalize().lerp(V(0.5, -0.05, 0.86).normalize(), dragK).normalize();
  const restBase = J.wrL.clone().addScaledVector(hdir, 0.12);
  J.cigBase = restBase.lerp(J.mouth.clone().add(V(0.012, -0.004, 0.016)), dragK);
  J.ember = J.cigBase.clone().addScaledVector(cdir, 0.078);
  J.blink = [1.2, 6.8, 10.9].some((b) => t >= b && t < b + 0.13);
  return J;
}

// ------------------------------------------------------------------ build
export function buildCharacter() {
  const root = new THREE.Group();
  const T = { jacket: jacketTex(), sleeve: sleeveTex(), denim: denimTex(), skin: skinTex(), shoe: shoeTex(), hair: hairTex(), face: faceTex(false), faceClosed: faceTex(true) };
  const M = {
    jacket: ps1Material({ map: T.jacket }), sleeve: ps1Material({ map: T.sleeve }), denim: ps1Material({ map: T.denim }),
    skin: ps1Material({ map: T.skin }), shoe: ps1Material({ map: T.shoe }), black: ps1Material({ color: '#161618' }),
    hair: ps1Material({ map: T.hair, alphaTest: 0.5, side: THREE.DoubleSide }), face: ps1Material({ map: T.face }),
    phones: ps1Material({ color: '#2b2c2e' }), cig: ps1Material({ color: '#efeadf' }), filter: ps1Material({ color: '#c98a45' }),
    ember: ps1Unlit({ color: '#ff6a1c' }), metal: ps1Material({ color: '#c7c9c4' }),
  };
  const parts = {};
  const mk = (name, geo, mat) => { const m = new THREE.Mesh(geo, mat); root.add(m); parts[name] = m; return m; };
  const r = (t, rx, rz, x = 0, z = 0) => ({ t, rx, rz, x, z });

  // torso (aimed neck -> hem); the puffer gives it bulk
  mk('torso', loft([r(0, 0.07, 0.06), r(0.06, 0.15, 0.1), r(0.14, 0.192, 0.118), r(0.32, 0.186, 0.126, 0, 0.006), r(0.55, 0.17, 0.122, 0, 0.01), r(0.8, 0.178, 0.126), r(0.9, 0.174, 0.122), r(1, 0.165, 0.115)], { sides: 12, capEnd: true }), M.jacket);
  mk('collar', loft([r(0, 0.062, 0.058), r(0.5, 0.068, 0.064), r(1, 0.08, 0.07)], { sides: 10, capEnd: false }), M.black);
  mk('hips', loft([r(0, 0.155, 0.112), r(0.5, 0.17, 0.13), r(1, 0.15, 0.11)], { sides: 10, capStart: true }), M.denim);
  mk('neck', loft([r(0, 0.04, 0.042), r(1, 0.046, 0.05)], { sides: 8, capEnd: false }), M.skin);
  // arms: upper (sleeve, puffy), forearm (sleeve to the cuff), mitten hands with a thumb
  for (const s of ['L', 'R']) {
    mk('up' + s, loft([r(0, 0.07, 0.07), r(0.25, 0.068, 0.066), r(0.7, 0.058, 0.058), r(1, 0.052, 0.052)], { sides: 8, capStart: true }), M.sleeve);
    mk('fo' + s, loft([r(0, 0.054, 0.054), r(0.5, 0.05, 0.048), r(0.86, 0.046, 0.044), r(0.88, 0.05, 0.048), r(1, 0.05, 0.048)], { sides: 8 }), M.sleeve);
    mk('hand' + s, loft([r(0, 0.026, 0.018), r(0.35, 0.04, 0.017), r(0.75, 0.038, 0.014), r(1, 0.026, 0.01)], { sides: 6 }), M.skin);
    mk('thumb' + s, loft([r(0, 0.012, 0.012), r(1, 0.009, 0.009)], { sides: 5 }), M.skin);
    mk('th' + s, loft([r(0, 0.09, 0.085), r(0.5, 0.083, 0.078), r(1, 0.064, 0.06)], { sides: 9, capStart: true }), M.denim);
    mk('sh' + s, loft([r(0, 0.06, 0.058), r(0.3, 0.056, 0.052), r(0.8, 0.044, 0.042), r(1, 0.052, 0.05)], { sides: 9 }), M.denim);
    mk('foot' + s, loft([r(0, 0.042, 0.04), r(0.25, 0.048, 0.05), r(0.7, 0.045, 0.048), r(0.93, 0.036, 0.04), r(1, 0.02, 0.025)], { sides: 8, capStart: true }), M.shoe);
    mk('cup' + s, new THREE.CylinderGeometry(0.036, 0.036, 0.02, 8), M.phones);
  }
  // head, face, hair
  const head = new THREE.Group(); head.scale.setScalar(1.1); root.add(head); parts.head = head;
  const face = new THREE.Mesh(headGeo(), M.face); head.add(face); parts.face = face;
  const hair = new THREE.Mesh(hairGeo(), M.hair); head.add(hair);
  const ear = new THREE.Mesh(new THREE.SphereGeometry(0.003, 4, 3), M.metal); ear.position.set(0.081, -0.035, 0.0); head.add(ear);   // a stud catches light under the bob
  // headphones: band round the back of the neck, cups resting on the collarbones
  mk('band', new THREE.TorusGeometry(0.083, 0.008, 4, 12, Math.PI * 1.15), M.phones);
  // cigarette + ember
  mk('cig', loft([r(0, 0.0045, 0.0045), r(0.25, 0.0045, 0.0045), r(1, 0.0045, 0.0045)], { sides: 5, capStart: true }), M.cig);
  mk('ember', new THREE.BoxGeometry(0.01, 0.01, 0.01), M.ember);

  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { root, parts, M, T };
}

const FRONT = V(0, 0, 1), UP = V(0, 1, 0);
export function applyPose(ch, J) {
  const P = ch.parts;
  aim(P.torso, J.neckBase, J.hem, FRONT, null); P.torso.scale.y = J.neckBase.distanceTo(J.hem);
  aim(P.collar, J.neckTop.clone().lerp(J.neckBase, 0.45), J.neckBase.clone().add(V(0, -0.03, 0)), FRONT); P.collar.scale.y = 0.06;
  aim(P.hips, V(0, 0.09, -0.02), V(0, -0.075, 0.0), FRONT); P.hips.scale.y = 0.17;
  aim(P.neck, J.neckTop, J.neckBase, FRONT); P.neck.scale.y = J.neckTop.distanceTo(J.neckBase);
  for (const s of ['L', 'R']) {
    const sh = J['sh' + s], el = J['el' + s], wr = J['wr' + s], hd = J['hand' + s], out = V(s === 'L' ? 1 : -1, 0, 0);
    aim(P['up' + s], sh, el, FRONT); P['up' + s].scale.y = sh.distanceTo(el);
    aim(P['fo' + s], el, wr, out); P['fo' + s].scale.y = el.distanceTo(wr);
    const palm = s === 'L' ? V(-0.6, 0, -1) : V(0, 1, 0);
    aim(P['hand' + s], wr, hd, palm); P['hand' + s].scale.y = wr.distanceTo(hd);
    const tb = wr.clone().lerp(hd, 0.25), side = hd.clone().sub(wr).cross(palm).normalize().multiplyScalar(s === 'L' ? -1 : 1);
    aim(P['thumb' + s], tb, tb.clone().addScaledVector(side, 0.035).addScaledVector(hd.clone().sub(wr).normalize(), 0.035), UP); P['thumb' + s].scale.y = 0.05;
    aim(P['th' + s], J['hip' + s], J['knee' + s], UP); P['th' + s].scale.y = J['hip' + s].distanceTo(J['knee' + s]);
    aim(P['sh' + s], J['knee' + s], J['ank' + s], FRONT); P['sh' + s].scale.y = J['knee' + s].distanceTo(J['ank' + s]);
    const heel = J['ank' + s].clone().add(V(0, -0.02, -0.05));
    aim(P['foot' + s], heel, J['toe' + s], UP); P['foot' + s].scale.y = heel.distanceTo(J['toe' + s]);
    P['cup' + s].position.copy(J.neckBase).add(V(s === 'L' ? 0.075 : -0.075, -0.01, 0.07));
    P['cup' + s].rotation.set(0.5, 0, s === 'L' ? 1.2 : -1.2);
  }
  P.band.position.copy(J.neckBase).add(V(0, 0.015, 0.0)); P.band.rotation.set(-Math.PI / 2 + 0.25, 0, -Math.PI * 0.075 + Math.PI);
  P.head.position.copy(J.head);
  P.head.rotation.set(J.hp, J.hy, J.hr, 'YXZ');
  P.face.material.map = J.blink ? ch.T.faceClosed : ch.T.face;
  aim(P.cig, J.cigBase, J.ember, UP); P.cig.scale.y = J.cigBase.distanceTo(J.ember);
  P.ember.position.copy(J.ember);
  const glow = 0.75 + 0.25 * J.dragK;
  P.ember.material.color.setRGB(1, 0.32 + 0.25 * J.dragK, 0.08).multiplyScalar(glow);
}
