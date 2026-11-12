// One Cup (match-cut study): the cup, saucer, coffee and table builders, forked from void-cup/geo.js (frozen).
// Shared by the light bake (tools/bake_void_cup.mjs, in Node) and the renderer (scene.js, in the browser),
// so both build the exact same vertices in the same order. Units are metres, three.js axes (y up).
// Method study after Leon Lin's room-at-dawn (MIT, reference/external/room-at-dawn): soft light is path traced
// once and stored per vertex; the live renderer adds the sharp sun, reflections, steam and the lens.
import * as THREE from 'three';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const norm = (a) => a.clone().normalize();

import { Vector3 } from 'three';
const _unused = Vector3;
// ---- profile helpers ----
// Round a polyline's corners (Chaikin) so no edge is knife-sharp, then resample to a maximum spacing.
export function chaikin(pts, it) {
  for (let k = 0; k < it; k++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    o.push(pts[pts.length - 1]); pts = o;
  }
  return pts;
}
export function resample(pts, maxEdge) {
  const o = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / maxEdge));
    for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return o;
}
// Lathe around y. Profile is [r, y] travelled counter-clockwise (outward normal = (dy, -dx)).
export function lathe(profile, segs, y0 = 0) {
  const P = chaikin(profile, 3), R = resample(P, 0.0016);
  const n = R.length, pos = [], nor = [], loc = [], idx = [];
  const pn = R.map((p, i) => {
    const a = R[Math.max(0, i - 1)], b = R[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  });
  for (let s = 0; s <= segs; s++) {
    const th = (s / segs) * Math.PI * 2, c = Math.cos(th), si = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const [r, y] = R[i];
      pos.push(r * c, y + y0, r * si);
      let nr = pn[i][0], ny = pn[i][1];
      if (r < 1e-6) { nr = 0; ny = Math.sign(ny) || 1; }
      nor.push(nr * c, ny, nr * si);
      loc.push(r, y, th);
    }
  }
  for (let s = 0; s < segs; s++) for (let i = 0; i < n - 1; i++) {
    const a = s * n + i, b = (s + 1) * n + i;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return geom(pos, nor, idx, loc);
}
export function geom(pos, nor, idx, loc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (loc) g.setAttribute('loc', new THREE.Float32BufferAttribute(loc, 3));
  g.setIndex(idx);
  return g;
}
// Box from 8 corners (for the wall and slats; never baked, never seen directly).
export function box(c, ax, ay, az) {
  const pos = [], nor = [], idx = [];
  const faces = [[ax, ay, az], [ax.clone().negate(), ay, az.clone().negate()], [ay, az, ax], [ay.clone().negate(), az, ax.clone().negate()], [az, ax, ay], [az.clone().negate(), ax, ay.clone().negate()]];
  for (const [n, a, b] of faces) {
    const base = pos.length / 3, nn = norm(n);
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = c.clone().add(n).addScaledVector(a, s).addScaledVector(b, t);
      pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = geom(pos, nor, idx);
  return g;
}

// ---- the set ----
export const SAUCER_TOP = 0.0078;     // height of the saucer well where the cup stands
export const LIQUID_Y = SAUCER_TOP + 0.066;
export const LIQUID_R = 0.0384;

export function table(xExt = 1.1, z0 = -0.9, z1 = 0.9) {
  // graded grid: 4.5 mm cells around the cup, growing outwards; the void swallows the far edges
  const axis = (ext) => {
    const o = [0]; let x = 0, st = 0.0045;
    while (x < ext) { x += st; o.push(Math.min(x, ext)); if (x > 0.22) st *= 1.045; }
    return [...o.slice(1).reverse().map((v) => -v), ...o];
  };
  const xs = axis(xExt), zs = axis(Math.max(-z0, z1)).filter((z) => z >= z0 - 1e-9 && z <= z1 + 1e-9);
  const pos = [], nor = [], idx = [];
  for (const z of zs) for (const x of xs) { pos.push(x, 0, z); nor.push(0, 1, 0); }
  const nx = xs.length;
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + nx;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return geom(pos, nor, idx);
}
export function saucer() {
  return lathe([[0, 0.0030], [0.040, 0.0026], [0.0445, 0.0002], [0.0475, 0.0], [0.0505, 0.0016], [0.073, 0.0110], [0.0768, 0.0142],
    [0.0757, 0.0166], [0.0705, 0.0152], [0.056, 0.0118], [0.0365, SAUCER_TOP], [0.0, SAUCER_TOP]], 160);
}
export function cup() {
  return lathe([[0, 0.0022], [0.0255, 0.0019], [0.0272, 0.0002], [0.0300, 0.0], [0.0318, 0.0030], [0.0352, 0.0100], [0.0392, 0.0300],
    [0.0418, 0.0600], [0.0431, 0.0840], [0.0432, 0.0893], [0.0416, 0.0904], [0.0400, 0.0888], [0.0394, 0.0800], [0.0381, 0.0550],
    [0.0350, 0.0280], [0.0300, 0.0130], [0.0230, 0.0082], [0.0, 0.0076]], 160, SAUCER_TOP);
}
// inner wall of the cup (from the lathe profile above), radius at a height above the saucer well
const INNER = [[0.0076, 0.0], [0.0082, 0.023], [0.013, 0.030], [0.028, 0.035], [0.055, 0.0381], [0.080, 0.0394], [0.0888, 0.0400]];
export function innerR(y) { for (let i = 1; i < INNER.length; i++) if (y <= INNER[i][0]) { const [y0, r0] = INNER[i - 1], [y1, r1] = INNER[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0.04; }
export const liquidAt = (level) => { const yl = 0.012 + level * (0.075 - 0.012); return { y: SAUCER_TOP + yl, r: innerR(yl) - 0.0004 }; };
export function liquid(level = 0.85) {
  const { y: LIQUID_Y, r: LIQUID_R } = liquidAt(level);
  // coffee surface with a slight meniscus climbing the wall
  const rings = 40, segs = 160, pos = [], nor = [], loc = [], idx = [];
  for (let s = 0; s <= segs; s++) {
    const th = (s / segs) * Math.PI * 2;
    for (let i = 0; i <= rings; i++) {
      const r = LIQUID_R * Math.pow(i / rings, 0.7), e = Math.max(0, (r - LIQUID_R + 0.0016) / 0.0016);
      pos.push(r * Math.cos(th), LIQUID_Y + e * e * 0.0011, r * Math.sin(th));
      nor.push(0, 1, 0); loc.push(r, LIQUID_R, th);
    }
  }
  for (let s = 0; s < segs; s++) for (let i = 0; i < rings; i++) {
    const a = s * (rings + 1) + i, b = a + rings + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = geom(pos, nor, idx, loc); g.computeVertexNormals(); return g;
}
export function handle() {
  // a sweep along a soft C, cross-section an ellipse; both ends sink into the wall
  const y0 = SAUCER_TOP;
  const curve = new THREE.CatmullRomCurve3([v3(0.0375, y0 + 0.073, 0), v3(0.052, y0 + 0.074, 0), v3(0.066, y0 + 0.064, 0),
    v3(0.069, y0 + 0.045, 0), v3(0.060, y0 + 0.027, 0), v3(0.047, y0 + 0.021, 0), v3(0.0355, y0 + 0.022, 0)], false, 'centripetal');
  const N = 90, M = 28, pos = [], nor = [], loc = [], idx = [];
  const fr = curve.computeFrenetFrames(N, false);
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), T = fr.tangents[i];
    const B = v3(0, 0, 1), Nn = norm(B.clone().cross(T));
    const a = 0.0034 * (1 - 0.12 * Math.sin(Math.PI * t)), b = 0.0058;      // radial half-thickness, half-width
    for (let j = 0; j <= M; j++) {
      const ph = (j / M) * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
      const q = p.clone().addScaledVector(Nn, a * c).addScaledVector(B, b * s);
      const n = norm(Nn.clone().multiplyScalar(c / a).addScaledVector(B, s / b));
      pos.push(q.x, q.y, q.z); nor.push(n.x, n.y, n.z); loc.push(0.05, q.y - y0, 0);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = geom(pos, nor, idx, loc);
  // the camera sees the handle on the right, turned a little towards the back
  const rot = new THREE.Matrix4().makeRotationY(0.55); g.applyMatrix4(rot); return g;
}
export function merge(gs) {
  const pos = [], nor = [], idx = []; let base = 0;
  for (const g of gs) {
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(i + base);
    base += g.attributes.position.count;
  }
  return geom(pos, nor, idx);
}

