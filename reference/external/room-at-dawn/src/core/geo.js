// Geometry helpers. Surfaces are tessellated (maxEdge) because lighting is baked per vertex,
// and boxes get real bevels because razor-sharp edges are what makes CG look like CG.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const FACES = {
  px: { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, nx: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  py: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, ny: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  pz: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, nz: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
};

function lines(H, r, rs, maxEdge) {
  const out = [];
  const inner = H - r;
  if (r > 0) for (let k = 0; k < rs; k++) out.push(-H + (r * k) / rs);
  const n = Math.max(1, Math.ceil((2 * inner) / maxEdge));
  for (let k = 0; k <= n; k++) out.push(-inner + (2 * inner * k) / n);
  if (r > 0) for (let k = 1; k <= rs; k++) out.push(inner + (r * k) / rs);
  return out;
}

/** Box centred on origin with rounded edges. opts: r (bevel radius), rs (bevel segments),
 *  maxEdge (tessellation), skip (array of face ids to leave out, e.g. ['ny']). UVs are in metres. */
export function roundedBox(w, h, d, opts = {}) {
  const half = [w / 2, h / 2, d / 2];
  const r = Math.min(opts.r ?? 0.003, Math.min(...half) * 0.999), rs = opts.rs ?? 2, maxEdge = opts.maxEdge ?? 0.08;
  const skip = opts.skip || [];
  const pos = [], nor = [], uv = [], idx = [];
  for (const key in FACES) {
    if (skip.includes(key)) continue;
    const f = FACES[key];
    const ai = (a) => (a[0] ? 0 : a[1] ? 1 : 2);
    const ui = ai(f.u), vi = ai(f.v), ni = ai(f.n);
    const us = f.u[ui], vs = f.v[vi], ns = f.n[ni];
    const lu = lines(half[ui], r, rs, maxEdge), lv = lines(half[vi], r, rs, maxEdge);
    const base = pos.length / 3;
    for (let j = 0; j < lv.length; j++) for (let i = 0; i < lu.length; i++) {
      const q = [0, 0, 0]; q[ui] = lu[i] * us; q[vi] = lv[j] * vs; q[ni] = half[ni] * ns;
      const inn = [0, 0, 0]; let dl = 0; const dlt = [0, 0, 0];
      for (let k = 0; k < 3; k++) { const lim = half[k] - r; inn[k] = Math.max(-lim, Math.min(lim, q[k])); dlt[k] = q[k] - inn[k]; dl += dlt[k] * dlt[k]; }
      dl = Math.sqrt(dl);
      let nx, ny, nz;
      if (dl < 1e-9) { nx = f.n[0]; ny = f.n[1]; nz = f.n[2]; } else { nx = dlt[0] / dl; ny = dlt[1] / dl; nz = dlt[2] / dl; }
      pos.push(inn[0] + nx * r, inn[1] + ny * r, inn[2] + nz * r); nor.push(nx, ny, nz);
      uv.push(lu[i] + half[ui], lv[j] + half[vi]);
    }
    const W = lu.length;
    for (let j = 0; j < lv.length - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = base + j * W + i, b = a + 1, c = a + W + 1, dd = a + W;
      idx.push(a, b, c, a, c, dd);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Box placed by min corner + size instead of centre. */
export function boxAt(x, y, z, w, h, d, opts) { return roundedBox(w, h, d, opts).translate(x + w / 2, y + h / 2, z + d / 2); }

/** Tessellated plane in XY facing +Z, centred. UV in metres from the lower-left corner. */
export function gridPlane(w, h, maxEdge = 0.05) {
  const nx = Math.max(1, Math.ceil(w / maxEdge)), ny = Math.max(1, Math.ceil(h / maxEdge));
  const g = new THREE.PlaneGeometry(w, h, nx, ny);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

/** Tube along points with radius fn(t). Uses parallel-transport frames, optional closed caps. */
export function tube(points, radius, { tubular = 32, radial = 8, cap = true, curve = null, uvScale = 1 } = {}) {
  const c = curve || new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const rf = typeof radius === 'function' ? radius : () => radius;
  const fr = c.computeFrenetFrames(tubular, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3();
  let len = 0; const prev = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular; c.getPointAt(t, P);
    if (i > 0) len += P.distanceTo(prev); prev.copy(P);
    const N = fr.normals[i], B = fr.binormals[i], r = rf(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r); nor.push(nx, ny, nz); uv.push((j / radial) * uvScale, len * uvScale);
    }
  }
  const W = radial + 1;
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * W + j, b = a + W, cc = b + 1, d = a + 1;
    idx.push(a, d, b, b, d, cc);
  }
  if (cap) for (const end of [0, 1]) {
    const i = end * tubular, t = end; c.getPointAt(t, P);
    const T = fr.tangents[i], s = end ? 1 : -1, base = pos.length / 3;
    pos.push(P.x, P.y, P.z); nor.push(T.x * s, T.y * s, T.z * s); uv.push(0.5, 0.5);
    for (let j = 0; j <= radial; j++) { const k = i * W + j; pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); nor.push(T.x * s, T.y * s, T.z * s); uv.push(0, 0); }
    for (let j = 0; j < radial; j++) end ? idx.push(base, base + 1 + j, base + 2 + j) : idx.push(base, base + 2 + j, base + 1 + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Surface of revolution from [[radius, y], ...] (bottom to top). Smooth normals. */
export function lathe(profile, segs = 32) {
  const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(Math.max(p[0], 1e-5), p[1])), segs);
  return g;
}

/** Cylinder along Y from y0 to y1 (thin wrapper, capped). */
export function cyl(r, y0, y1, segs = 20, rTop = r) {
  return new THREE.CylinderGeometry(rTop, r, y1 - y0, segs, 1, false).translate(0, (y0 + y1) / 2, 0);
}

/** Merge geometries (drops attributes that not all share). */
export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => (g.index ? g : mergeVertices(g)));
  const keep = ['position', 'normal', 'uv'];
  const extra = Object.keys(list[0].attributes).filter((k) => !keep.includes(k) && list.every((g) => g.attributes[k]));
  for (const g of list) for (const k of Object.keys(g.attributes)) if (!keep.includes(k) && !extra.includes(k)) g.deleteAttribute(k);
  for (const g of list) if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return mergeGeometries(list, false);
}

/** Parametric surface f(u,v,target Vector3) on a nu x nv grid, with computed normals. */
export function surface(fn, nu, nv, { closedU = false } = {}) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2), idx = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    fn(i / nu, j / nv, p); const k = j * (nu + 1) + i;
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv;
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (closedU) { // weld the seam normals
    const n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) {
      const a = j * (nu + 1), b = a + nu;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return g;
}

export function mesh(geo, mat, name = '') { const m = new THREE.Mesh(geo, mat); m.name = name; return m; }
export function group(name, ...children) { const g = new THREE.Group(); g.name = name; for (const c of children) if (c) g.add(c); return g; }
