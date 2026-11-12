// "First Light": one cup of coffee in a black void, lit by dawn through window blinds.
// Shared by the light bake (tools/bake_void_cup.mjs, in Node) and the renderer (scene.js, in the browser),
// so both build the exact same vertices in the same order. Units are metres, three.js axes (y up).
// Method study after Leon Lin's room-at-dawn (MIT, reference/external/room-at-dawn): soft light is path traced
// once and stored per vertex; the live renderer adds the sharp sun, reflections, steam and the lens.
import * as THREE from 'three';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const norm = (a) => a.clone().normalize();

// ---- light rig (all deterministic) ----
export const SUN = {
  dir: norm(v3(-0.80, 0.27, 0.42)),      // towards the sun: low dawn sun from the left, a touch in front of the cup
  color: [1.0, 0.70, 0.46],                // warm, low in the sky
  E: 5.0,                                  // irradiance at normal incidence (scene units)
  radius: 0.0055,                          // angular radius in radians (the real sun is 0.0047; a touch of haze)
};
const W_DIST = 1.35;                        // window plane distance from the cup along the sun direction
const wn = SUN.dir.clone().multiplyScalar(-1);                    // window normal, facing the room
const wu = norm(v3(0, 1, 0).cross(wn).multiplyScalar(-1));        // horizontal axis in the window plane
const wv = norm(wn.clone().cross(wu)).multiplyScalar(-1);         // vertical axis
if (wv.y < 0) wv.multiplyScalar(-1);
export const WINDOW = {
  center: SUN.dir.clone().multiplyScalar(W_DIST).add(v3(0, 0.05, 0)),
  n: wn, u: wu, v: wv, w: 0.44, h: 0.40,
};
// Venetian blind across the opening: slats along u, stacked along v.
export const BLIND = { pitch: 0.024, depth: 0.025, thick: 0.0018, tilt: 0.64 };
export const SKY = { horizon: [1.0, 0.66, 0.42], zenith: [0.42, 0.55, 0.82], k: 0.85 };   // dawn sky radiance seen through the window

// Off-screen to the right, a sunlit wall across the (unseen) room: a big dim warm rectangle that gives the
// shadow side of the cup its shape and a soft reflection. It only emits; it never bounces.
export const CARD = (() => {
  const c = v3(0.78, 0.30, 0.18), n = norm(v3(0, 0.05, 0).sub(c)), u = norm(v3(0, 1, 0).cross(n)), v = norm(n.clone().cross(u));
  return { center: c, n, u, v, w: 0.9, h: 0.7, L: [0.44, 0.34, 0.25] };
})();

export function skyRadiance(d) {                // d = direction away from the room (towards the sky)
  const t = Math.sqrt(Math.max(0, Math.min(1, d.y * 2.2 + 0.08)));
  const s = SKY;
  return [0, 1, 2].map((i) => s.k * (s.horizon[i] + (s.zenith[i] - s.horizon[i]) * t));
}

// ---- profile helpers ----
// Round a polyline's corners (Chaikin) so no edge is knife-sharp, then resample to a maximum spacing.
function chaikin(pts, it) {
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
function resample(pts, maxEdge) {
  const o = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / maxEdge));
    for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return o;
}
// Lathe around y. Profile is [r, y] travelled counter-clockwise (outward normal = (dy, -dx)).
function lathe(profile, segs, y0 = 0) {
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
function geom(pos, nor, idx, loc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (loc) g.setAttribute('loc', new THREE.Float32BufferAttribute(loc, 3));
  g.setIndex(idx);
  return g;
}
// Box from 8 corners (for the wall and slats; never baked, never seen directly).
function box(c, ax, ay, az) {
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

function table() {
  // graded grid: 4.5 mm cells around the cup, growing outwards; the void swallows the far edges
  const axis = (ext) => {
    const o = [0]; let x = 0, st = 0.0045;
    while (x < ext) { x += st; o.push(Math.min(x, ext)); if (x > 0.22) st *= 1.045; }
    return [...o.slice(1).reverse().map((v) => -v), ...o];
  };
  const xs = axis(1.1), zs = axis(0.9);
  const pos = [], nor = [], idx = [];
  for (const z of zs) for (const x of xs) { pos.push(x, 0, z); nor.push(0, 1, 0); }
  const nx = xs.length;
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + nx;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return geom(pos, nor, idx);
}
function saucer() {
  return lathe([[0, 0.0030], [0.040, 0.0026], [0.0445, 0.0002], [0.0475, 0.0], [0.0505, 0.0016], [0.073, 0.0110], [0.0768, 0.0142],
    [0.0757, 0.0166], [0.0705, 0.0152], [0.056, 0.0118], [0.0365, SAUCER_TOP], [0.0, SAUCER_TOP]], 160);
}
function cup() {
  return lathe([[0, 0.0022], [0.0255, 0.0019], [0.0272, 0.0002], [0.0300, 0.0], [0.0318, 0.0030], [0.0352, 0.0100], [0.0392, 0.0300],
    [0.0418, 0.0600], [0.0431, 0.0840], [0.0432, 0.0893], [0.0416, 0.0904], [0.0400, 0.0888], [0.0394, 0.0800], [0.0381, 0.0550],
    [0.0350, 0.0280], [0.0300, 0.0130], [0.0230, 0.0082], [0.0, 0.0076]], 160, SAUCER_TOP);
}
function liquid() {
  // coffee surface with a slight meniscus climbing the wall
  const rings = 40, segs = 160, pos = [], nor = [], loc = [], idx = [];
  for (let s = 0; s <= segs; s++) {
    const th = (s / segs) * Math.PI * 2;
    for (let i = 0; i <= rings; i++) {
      const r = LIQUID_R * Math.pow(i / rings, 0.7), e = Math.max(0, (r - LIQUID_R + 0.0016) / 0.0016);
      pos.push(r * Math.cos(th), LIQUID_Y + e * e * 0.0011, r * Math.sin(th));
      nor.push(0, 1, 0); loc.push(r, LIQUID_Y, th);
    }
  }
  for (let s = 0; s < segs; s++) for (let i = 0; i < rings; i++) {
    const a = s * (rings + 1) + i, b = a + rings + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = geom(pos, nor, idx, loc); g.computeVertexNormals(); return g;
}
function handle() {
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
function wallAndBlind(tilt = BLIND.tilt) {
  const { center: C, u, v, n, w, h } = WINDOW, out = [];
  const big = 2.6, t = 0.02;
  // four slabs around the opening, behind the window plane
  const back = C.clone().addScaledVector(n, -t);
  const slab = (cu, cv, hu, hv) => box(back.clone().addScaledVector(u, cu).addScaledVector(v, cv), n.clone().multiplyScalar(t), u.clone().multiplyScalar(hu), v.clone().multiplyScalar(hv));
  out.push({ name: 'wall_l', g: slab(-(w / 2 + big / 2), 0, big / 2, big + h) });
  out.push({ name: 'wall_r', g: slab(w / 2 + big / 2, 0, big / 2, big + h) });
  out.push({ name: 'wall_t', g: slab(0, h / 2 + big / 2, w / 2, big / 2) });
  out.push({ name: 'wall_b', g: slab(0, -(h / 2 + big / 2), w / 2, big / 2) });
  const slats = [];
  for (let k = 0; ; k++) {
    const cv = -h / 2 + BLIND.pitch * (k + 0.5); if (cv > h / 2) break;
    slats.push(cv);
  }
  out.push({ name: 'slats', slats, build: (tl) => {
    const parts = [];
    for (const cv of slats) {
      const c = C.clone().addScaledVector(v, cv).addScaledVector(n, 0.03);
      const dn = n.clone().multiplyScalar(Math.cos(tl)).addScaledVector(v, -Math.sin(tl)).multiplyScalar(BLIND.depth / 2);
      const dv = v.clone().multiplyScalar(Math.cos(tl)).addScaledVector(n, Math.sin(tl)).multiplyScalar(BLIND.thick / 2);
      parts.push(box(c, dn, u.clone().multiplyScalar(w / 2 + 0.01), dv));
    }
    return merge(parts);
  } });
  return out;
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

// Albedo the bake uses for bounce light (the renderer's procedural materials average to these).
export const BAKE_ALBEDO = { table: [0.17, 0.11, 0.068], glaze: [0.70, 0.66, 0.58], liquid: [0.02, 0.012, 0.008], black: [0, 0, 0] };

export function buildSet() {
  const parts = [
    { name: 'table', mat: 'table', gi: true, g: table() },
    { name: 'saucer', mat: 'glaze', gi: true, g: saucer() },
    { name: 'cup', mat: 'glaze', gi: true, g: cup() },
    { name: 'handle', mat: 'glaze', gi: true, g: handle() },
    { name: 'liquid', mat: 'liquid', gi: true, g: liquid() },
  ];
  const wb = wallAndBlind();
  for (const p of wb) {
    if (p.build) parts.push({ name: p.name, mat: 'black', gi: false, g: p.build(BLIND.tilt), build: p.build });
    else parts.push({ name: p.name, mat: 'black', gi: false, g: p.g });
  }
  return parts;
}
