// One Cup: one cup, one day, five worlds cut on the same frame (match cuts). Each world is data: its set, its
// lights and its coffee level. The light bake (tools/bake_one_cup.mjs) and the renderer (scene.js) both build
// from here. Units are metres, three.js axes (y up); the cup stands at the origin, the camera looks along -z.
import * as THREE from 'three';
import { table, saucer, cup, handle, liquid, liquidAt, lathe, geom, merge, SAUCER_TOP } from './cupgeo.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const N = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// ---------- set-building helpers (subdivided, so per-vertex light has somewhere to live) ----------
// A plane (axes u, v, normal n) of size w x h around c, cut by rectangular holes [u0, u1, v0, v1] (in u/v metres).
export function panel(c, u, v, w, h, cell, holes = []) {
  const n = u.clone().cross(v).normalize();
  const cuts = (ext, k) => { const s = new Set(); for (let x = -ext / 2; x < ext / 2; x += cell) s.add(+x.toFixed(5)); s.add(ext / 2);
    for (const hl of holes) { s.add(hl[k]); s.add(hl[k + 1]); } return [...s].filter((x) => x >= -ext / 2 - 1e-6 && x <= ext / 2 + 1e-6).sort((a, b) => a - b); };
  const us = cuts(w, 0), vs = cuts(h, 2), pos = [], nor = [], idx = [];
  for (const b of vs) for (const a of us) { const p = c.clone().addScaledVector(u, a).addScaledVector(v, b); pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); }
  const nu = us.length;
  for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const cu = (us[i] + us[i + 1]) / 2, cv = (vs[j] + vs[j + 1]) / 2;
    if (holes.some((hl) => cu > hl[0] && cu < hl[1] && cv > hl[2] && cv < hl[3])) continue;
    const a = j * nu + i, b = a + nu;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return geom(pos, nor, idx);
}
// A box from its centre and half-extent vectors, each face subdivided.
export function gbox(c, hx, hy, hz, cell = 0.04) {
  const faces = [[hx, hy, hz], [hx.clone().negate(), hz, hy], [hy, hz, hx], [hy.clone().negate(), hx, hz], [hz, hx, hy], [hz.clone().negate(), hy, hx]];
  return merge(faces.map(([n, a, b]) => panel(c.clone().add(n), a.clone().normalize(), b.clone().normalize(), a.length() * 2, b.length() * 2, cell)));
}
const X = v3(1, 0, 0), Y = v3(0, 1, 0), Z = v3(0, 0, 1);
const boxAt = (x, y, z, sx, sy, sz, cell) => gbox(v3(x, y, z), X.clone().multiplyScalar(sx / 2), Y.clone().multiplyScalar(sy / 2), Z.clone().multiplyScalar(sz / 2), cell);

// A back wall at z = zw with a window opening; returns the wall, the reveal (jambs), the glass, and the portal.
function backWall(zw, o, cell = 0.05) {
  const [x0, x1, y0, y1] = o, W = 3.4, H = 1.9, cy = 0.75;
  const wall = panel(v3(0, cy, zw), X, Y, W, H, cell, [[x0, x1, y0 - cy, y1 - cy]]);
  const d = 0.09, zc = zw - d / 2, hz = Z.clone().multiplyScalar(d / 2);
  const jambs = merge([
    panel(v3(x0, (y0 + y1) / 2, zc), Z.clone().negate(), Y, d, y1 - y0, 0.03),         // left jamb faces +x
    panel(v3(x1, (y0 + y1) / 2, zc), Z, Y, d, y1 - y0, 0.03),                            // right jamb faces -x
    panel(v3((x0 + x1) / 2, y0, zc), X, Z.clone().negate(), x1 - x0, d, 0.03),           // sill faces up
    panel(v3((x0 + x1) / 2, y1, zc), X, Z, x1 - x0, d, 0.03),                            // head faces down
  ]);
  void hz;
  const glass = panel(v3((x0 + x1) / 2, (y0 + y1) / 2, zw - d), X, Y, x1 - x0, y1 - y0, 0.2);
  const portal = { center: v3((x0 + x1) / 2, (y0 + y1) / 2, zw), n: Z.clone(), u: X.clone(), v: Y.clone(), w: x1 - x0, h: y1 - y0 };
  return { wall, jambs, glass, portal };
}
function mullions(o, zw, vx = [], hy = [], t = 0.032) {
  const [x0, x1, y0, y1] = o, z = zw - 0.06, gs = [];
  for (const x of vx) gs.push(boxAt(x, (y0 + y1) / 2, z, t, y1 - y0, 0.045, 0.03));
  for (const y of hy) gs.push(boxAt((x0 + x1) / 2, y, z, x1 - x0, t, 0.045, 0.03));
  return merge(gs);
}
// Venetian blind across a portal (slats along u, stacked along v), at +0.03 n in front of the opening.
function blindGeo(P, B, visible) {
  const gs = [];
  for (let k = 0; ; k++) {
    const cv = -P.h / 2 + B.pitch * (k + 0.5); if (cv > P.h / 2) break;
    const c = P.center.clone().addScaledVector(P.v, cv).addScaledVector(P.n, 0.03);
    const dn = P.n.clone().multiplyScalar(Math.cos(B.tilt)).addScaledVector(P.v, -Math.sin(B.tilt)).multiplyScalar(B.depth / 2);
    const dv = P.v.clone().multiplyScalar(Math.cos(B.tilt)).addScaledVector(P.n, Math.sin(B.tilt)).multiplyScalar(B.thick / 2);
    gs.push(gbox(c, P.u.clone().multiplyScalar(P.w / 2 + 0.01), dv, dn, visible ? 0.05 : 1));
  }
  return merge(gs);
}
function shell(alb, opt = {}) {
  const c = 0.16, hgt = 1.9, y0 = -0.2, xL = -1.7, xR = 1.7, zB = 1.5;
  return { name: 'shell', mat: plaster(alb), g: merge([
    panel(v3(xL, y0 + hgt / 2, (ZW + zB) / 2), Z, Y, zB - ZW, hgt, c),                    // left wall faces +x
    panel(v3(xR, y0 + hgt / 2, (ZW + zB) / 2), Z.clone().negate(), Y, zB - ZW, hgt, c),     // right wall faces -x
    panel(v3(0, y0 + hgt / 2, zB), X.clone().negate(), Y, xR - xL, hgt, c),                // behind the camera, faces -z
    panel(v3(0, y0 + hgt, (ZW + zB) / 2), X, Z.clone().negate(), xR - xL, zB - ZW, c),     // ceiling faces down
  ]) };
}
const cupParts = (level, opt = {}) => {
  const p = [
    { name: 'saucer', mat: 'saucer', g: saucer() },
    { name: 'cup', mat: 'cup', g: cup() },
    { name: 'handle', mat: 'handle', g: handle() },
  ];
  if (level > 0) p.push({ name: 'liquid', mat: 'liquid', g: liquid(level) });
  if (opt.noSaucer) p.shift();
  return p;
};

// ---------- materials (kind = shader branch; alb = linear albedo the bake bounces) ----------
const M = {
  walnut: { kind: 0, alb: [0.17, 0.11, 0.068], woodA: [0.23, 0.148, 0.090], woodB: [0.13, 0.078, 0.045] },
  oak: { kind: 0, alb: [0.36, 0.27, 0.18], woodA: [0.46, 0.34, 0.22], woodB: [0.30, 0.21, 0.13] },
  ash: { kind: 0, alb: [0.46, 0.40, 0.32], woodA: [0.56, 0.49, 0.39], woodB: [0.42, 0.35, 0.27] },
  cup: { kind: 1, alb: [0.70, 0.66, 0.58] }, saucer: { kind: 2, alb: [0.70, 0.66, 0.58] }, handle: { kind: 3, alb: [0.70, 0.66, 0.58] },
  liquid: { kind: 4, alb: [0.06, 0.033, 0.016] },
  black: { kind: 9, alb: [0, 0, 0] },
  glass: { kind: 10, alb: [0, 0, 0] },
  screen: { kind: 11, alb: [0, 0, 0] },
};
const plain = (alb, rough = 0.6) => ({ kind: 5, alb, rough });
const plaster = (alb) => ({ kind: 6, alb, rough: 0.9 });

// ---------- the worlds ----------
const ZW = -0.62;   // the back wall
function dawn() {
  // the approved First Light set: side sun from the left through an off-screen blind, a black void
  const sunDir = N(-0.80, 0.27, 0.42);
  const wn = sunDir.clone().negate(), wu = Y.clone().cross(wn).negate().normalize(), wv = wn.clone().cross(wu).negate().normalize();
  const P = { center: sunDir.clone().multiplyScalar(1.35).add(v3(0, 0.05, 0)), n: wn, u: wu, v: wv, w: 0.44, h: 0.40 };
  const B = { pitch: 0.024, depth: 0.025, thick: 0.0018, tilt: 0.64 };
  const big = 2.6, back = P.center.clone().addScaledVector(P.n, -0.02);
  const slab = (cu, cv, hu, hv) => gbox(back.clone().addScaledVector(P.u, cu).addScaledVector(P.v, cv), P.n.clone().multiplyScalar(0.02), P.u.clone().multiplyScalar(hu), P.v.clone().multiplyScalar(hv), 4);
  const cardC = v3(0.78, 0.30, 0.18), cn = v3(0, 0.05, 0).sub(cardC).normalize(), cu = Y.clone().cross(cn).normalize(), cv = cn.clone().cross(cu).normalize();
  return {
    id: 'dawn', label: 'Dawn, through the blind', level: 0.86, steam: 260, exposure: 1.0,
    sun: { dir: sunDir, color: [1.0, 0.70, 0.46], E: 5.0, radius: 0.0055 },
    window: { ...P, mask: 'blind', sky: { horizon: [1.0, 0.66, 0.42], zenith: [0.42, 0.55, 0.82], k: 0.85 }, visible: false },
    blind: B,
    rects: [{ center: cardC, n: cn, u: cu, v: cv, w: 0.9, h: 0.7, L: [0.44, 0.34, 0.25] }],
    parts: [
      { name: 'table', mat: 'walnut', g: table() }, ...cupParts(0.86),
      { name: 'occl', mat: 'black', gi: false, g: merge([slab(-(P.w / 2 + big / 2), 0, big / 2, big + P.h), slab(P.w / 2 + big / 2, 0, big / 2, big + P.h), slab(0, P.h / 2 + big / 2, P.w / 2, big / 2), slab(0, -(P.h / 2 + big / 2), P.w / 2, big / 2)]) },
      { name: 'slats', mat: 'black', gi: false, sway: true, g: blindGeo(P, B, false) },
    ],
  };
}
function rain() {
  const o = [-0.95, 0.30, 0.03, 0.86], bw = backWall(ZW, o);
  return {
    id: 'rain', label: 'Rain, late morning', level: 0.68, steam: 300, exposure: 0.78,
    sun: null,
    window: { ...bw.portal, mask: 'rain', sky: { horizon: [0.80, 0.85, 0.90], zenith: [0.60, 0.68, 0.80], k: 1.7 }, visible: true },
    rects: [{ center: v3(0.9, 0.35, 0.5), n: N(-1, -0.1, -0.5), u: N(0.5, 0, -1), v: Y.clone(), w: 1.0, h: 0.8, L: [0.10, 0.11, 0.12] }],
    parts: [
      { name: 'table', mat: 'ash', g: table(1.3, ZW, 0.9) }, ...cupParts(0.68),
      { name: 'wall', mat: plaster([0.62, 0.63, 0.62]), g: bw.wall }, { name: 'jambs', mat: plaster([0.66, 0.66, 0.65]), g: bw.jambs },
      { name: 'mull', mat: plain([0.70, 0.70, 0.68], 0.5), g: mullions(o, ZW, [-0.33]) },
      { name: 'glass', mat: 'glass', gi: false, bvh: false, g: bw.glass }, shell([0.60, 0.61, 0.60]),
    ],
  };
}
function room() {
  // the tutorial room's desk corner: grey-green wall, venetian blind lit by the day, the monitor glowing
  const o = [-0.95, -0.08, 0.06, 0.74], bw = backWall(ZW, o);
  const B = { pitch: 0.026, depth: 0.025, thick: 0.002, tilt: 0.35 };
  const scr = { center: v3(0.34, 0.235, -0.425), n: Z.clone(), u: X.clone(), v: Y.clone(), w: 0.50, h: 0.29, L: [0.42, 0.55, 0.78] };
  return {
    id: 'room', label: 'The room, afternoon', level: 0.5, steam: 200, exposure: 0.95,
    sun: null,
    window: { ...bw.portal, mask: 'blind', sky: { horizon: [0.92, 0.93, 0.92], zenith: [0.78, 0.82, 0.90], k: 2.2 }, visible: true },
    blind: B,
    rects: [scr],
    parts: [
      { name: 'table', mat: plain([0.50, 0.47, 0.42], 0.38), g: table(1.3, ZW, 0.9) }, ...cupParts(0.5),
      { name: 'wall', mat: plaster([0.43, 0.45, 0.40]), g: bw.wall }, { name: 'jambs', mat: plaster([0.47, 0.48, 0.44]), g: bw.jambs },
      { name: 'slats', mat: plain([0.80, 0.80, 0.78], 0.5), g: blindGeo(bw.portal, B, true) },
      { name: 'glass', mat: 'glass', gi: false, bvh: false, g: bw.glass },
      { name: 'monitor', mat: plain([0.035, 0.035, 0.038], 0.45), g: merge([boxAt(0.34, 0.235, -0.445, 0.53, 0.32, 0.03, 0.03), boxAt(0.34, 0.045, -0.47, 0.05, 0.09, 0.03, 0.03), boxAt(0.34, 0.006, -0.46, 0.22, 0.012, 0.16, 0.03)]) },
      { name: 'screen', mat: 'screen', gi: false, bvh: false, g: panel(scr.center, X, Y, scr.w, scr.h, 0.1) },
      shell([0.45, 0.47, 0.42]),
      { name: 'books', mat: plain([0.30, 0.22, 0.16], 0.7), g: merge([boxAt(-0.30, 0.017, -0.36, 0.24, 0.034, 0.17, 0.03), boxAt(-0.31, 0.047, -0.36, 0.22, 0.026, 0.16, 0.03), boxAt(-0.29, 0.071, -0.355, 0.20, 0.022, 0.15, 0.03)]) },
    ],
  };
}
function golden() {
  // late sun straight through a mullioned window behind the cup: rim light, a long shadow toward us, dust in the beam
  const o = [-0.80, 0.06, 0.04, 0.74], bw = backWall(ZW, o);
  return {
    id: 'golden', label: 'Golden hour', level: 0.32, steam: 110, exposure: 0.85, dust: true,
    sun: { dir: N(-0.45, 0.155, -0.62), color: [1.0, 0.55, 0.26], E: 7.5, radius: 0.0055 },
    window: { ...bw.portal, mask: 'none', sky: { horizon: [1.0, 0.56, 0.28], zenith: [0.62, 0.48, 0.62], k: 1.8 }, visible: true, sunDisk: true },
    rects: [{ center: v3(0.9, 0.35, 0.6), n: N(-1, -0.1, -0.6), u: N(0.6, 0, -1), v: Y.clone(), w: 1.0, h: 0.8, L: [0.07, 0.05, 0.035] }],
    parts: [
      { name: 'table', mat: 'oak', g: table(1.3, ZW, 0.9) }, ...cupParts(0.32),
      { name: 'wall', mat: plaster([0.55, 0.46, 0.37]), g: bw.wall }, { name: 'jambs', mat: plaster([0.58, 0.49, 0.40]), g: bw.jambs },
      { name: 'mull', mat: plain([0.16, 0.11, 0.07], 0.6), g: mullions(o, ZW, [-0.37], [0.39], 0.034) }, shell([0.55, 0.47, 0.39]),
      { name: 'glass', mat: 'glass', gi: false, bvh: false, g: bw.glass },
    ],
  };
}
function night() {
  // a warm desk lamp on the cup, the city cool and out of focus beyond the glass
  const o = [-0.90, 0.25, 0.04, 0.80], bw = backWall(ZW, o);
  const lampP = v3(-0.30, 0.40, 0.03);
  const shade = lathe([[0.0, 0.0], [0.034, 0.0], [0.034, 0.002], [0.062, -0.085], [0.0605, -0.0855], [0.032, -0.0015], [0.0, -0.0015]].map(([r, y]) => [r, y]), 64, 0);
  shade.translate(lampP.x, lampP.y + 0.05, lampP.z);
  return {
    id: 'night', label: 'Night, the lamp and the city', level: 0.12, steam: 0, exposure: 0.95,
    sun: null,
    window: { ...bw.portal, mask: 'none', sky: { horizon: [0.30, 0.13, 0.40], zenith: [0.06, 0.10, 0.28], k: 0.32 }, visible: true },
    lamp: { p: lampP, r: 0.02, L: [1.0 * 1300, 0.62 * 1300, 0.30 * 1300] },
    rects: [],
    bokeh: true,
    parts: [
      { name: 'table', mat: 'walnut', g: table(1.3, ZW, 0.9) }, ...cupParts(0.12),
      { name: 'wall', mat: plaster([0.30, 0.30, 0.33]), g: bw.wall }, { name: 'jambs', mat: plaster([0.32, 0.32, 0.35]), g: bw.jambs },
      { name: 'mull', mat: plain([0.05, 0.05, 0.055], 0.5), g: mullions(o, ZW, [-0.32], [0.46]) },
      { name: 'shade', mat: plain([0.10, 0.09, 0.08], 0.8), g: shade }, shell([0.30, 0.30, 0.33]),
      { name: 'glass', mat: 'glass', gi: false, bvh: false, g: bw.glass },
    ],
  };
}
export const WORLD_BUILDERS = { dawn, rain, room, golden, night };
export function buildWorld(id) {
  const w = WORLD_BUILDERS[id]();
  for (const p of w.parts) {
    p.m = typeof p.mat === 'string' ? M[p.mat] : p.mat;
    if (p.gi === undefined) p.gi = !w.live && p.m.kind !== 9;
    if (p.bvh === undefined) p.bvh = true;
  }
  w.liquid = liquidAt(w.level);
  return w;
}
export const SKY_RADIANCE = (sky, d) => {     // d points out of the room
  const t = Math.sqrt(Math.max(0, Math.min(1, d.y * 2.2 + 0.08)));
  return [0, 1, 2].map((i) => sky.k * (sky.horizon[i] + (sky.zenith[i] - sky.horizon[i]) * t));
};
export { SAUCER_TOP };
