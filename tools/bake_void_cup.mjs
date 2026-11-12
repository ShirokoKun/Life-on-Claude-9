// Bake the soft light of the "First Light" study (engine/studies/void-cup) into its vertices.
// Method after room-at-dawn (Leon Lin, MIT): a CPU path tracer (three-mesh-bvh) runs once; the renderer
// then reads the result per vertex and every film frame costs milliseconds instead of a Cycles render.
//  - stored per vertex: gi = irradiance / PI (rgb) from the dawn sky through the blind plus every bounce
//    (including sun bounce), and vis = how much of the window this point can see (for reflection occlusion)
//  - the direct sun is left out on purpose: the renderer draws it live with a jittered shadow map, so the
//    slatted stripes stay razor-clean and can sway with the blind
//  - sky light: next-event estimation through the window opening (a portal) + cosine sampling, MIS balance
//   node tools/bake_void_cup.mjs [--spp 512] [--depth 4]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const geo = await import(path.join(ROOT, 'engine/studies/void-cup/geo.js'));
const A = process.argv.slice(2);
const opt = (k, d) => (A.includes(`--${k}`) ? A[A.indexOf(`--${k}`) + 1] : d);
const MAT_IDS = { table: 0, glaze: 1, liquid: 2, black: 3, slat: 4 };

function scene() {
  const parts = geo.buildSet();
  const pos = [], idx = [], triMat = [], verts = []; let base = 0;
  for (const p of parts) {
    const P = p.g.attributes.position.array, N = p.g.attributes.normal.array, I = p.g.index.array;
    const m = p.name === 'slats' ? MAT_IDS.slat : MAT_IDS[p.mat];
    for (let i = 0; i < P.length; i++) pos.push(P[i]);
    for (let i = 0; i < I.length; i++) idx.push(I[i] + base);
    for (let t = 0; t < I.length / 3; t++) triMat.push(m);
    if (p.gi) verts.push({ name: p.name, P, N, I, count: P.length / 3 });
    base += P.length / 3;
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), triMat: new Uint8Array(triMat), verts, parts };
}

if (isMainThread) {
  const spp = +opt('spp', 512), depth = +opt('depth', 4);
  const S = scene();
  const list = []; for (const v of S.verts) for (let i = 0; i < v.count; i++) list.push([v.P[i * 3], v.P[i * 3 + 1], v.P[i * 3 + 2], v.N[i * 3], v.N[i * 3 + 1], v.N[i * 3 + 2]]);
  const flat = new Float32Array(list.flat());
  const nW = Math.max(1, os.cpus().length), total = list.length, out = new Float32Array(total * 4);
  console.log(`baking ${total} vertices, ${spp} paths each, depth ${depth}, ${nW} workers`);
  const t0 = Date.now(); let done = 0;
  const chunk = 512; let next = 0;
  await Promise.all(Array.from({ length: nW }, () => new Promise((res) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { spp, depth } });
    const feed = () => {
      if (next >= total) { w.terminate(); res(); return; }
      const a = next, b = Math.min(total, next + chunk); next = b;
      w.postMessage({ a, b, pts: flat.slice(a * 6, b * 6) });
    };
    w.on('message', (m) => {
      if (m.ready) { feed(); return; }
      out.set(m.res, m.a * 4); done += m.b - m.a;
      if ((done / chunk) % 20 < 1) process.stdout.write(`\r${(100 * done / total).toFixed(0)}%  ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
      feed();
    });
  })));
  console.log(`\nbaked in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

  // denoise: average each vertex with its mesh neighbours that face the same way (two passes),
  // then weld the duplicated seam / pole vertices of the lathes so no seam shows.
  let o = 0;
  for (const v of S.verts) {
    const n = v.count, seg = out.subarray(o * 4, (o + n) * 4), nb = Array.from({ length: n }, () => new Set());
    for (let t = 0; t < v.I.length; t += 3) { const a = v.I[t], b = v.I[t + 1], c = v.I[t + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
    const ndot = (i, j) => v.N[i * 3] * v.N[j * 3] + v.N[i * 3 + 1] * v.N[j * 3 + 1] + v.N[i * 3 + 2] * v.N[j * 3 + 2];
    for (let pass = 0; pass < 2; pass++) {
      const src = seg.slice();
      for (let i = 0; i < n; i++) {
        let w = 1, r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2], s = src[i * 4 + 3];
        for (const j of nb[i]) { if (ndot(i, j) < 0.85) continue; const k = 0.6; w += k; r += src[j * 4] * k; g += src[j * 4 + 1] * k; b += src[j * 4 + 2] * k; s += src[j * 4 + 3] * k; }
        seg[i * 4] = r / w; seg[i * 4 + 1] = g / w; seg[i * 4 + 2] = b / w; seg[i * 4 + 3] = s / w;
      }
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) { const k = `${Math.round(v.P[i * 3] * 1e5)},${Math.round(v.P[i * 3 + 1] * 1e5)},${Math.round(v.P[i * 3 + 2] * 1e5)}`; (groups.get(k) || groups.set(k, []).get(k)).push(i); }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      for (let ch = 0; ch < 4; ch++) { let s = 0; for (const i of g) s += seg[i * 4 + ch]; s /= g.length; for (const i of g) seg[i * 4 + ch] = s; }
    }
    o += n;
  }
  // write: 'VCGI' | json length | json | float16 data (rgb + vis per vertex)
  const man = JSON.stringify({ spp, depth, parts: S.verts.map((v) => ({ name: v.name, count: v.count })) });
  const jb = Buffer.from(man), pad = (4 - ((8 + jb.length) % 4)) % 4;
  const half = new Uint16Array(out.length); for (let i = 0; i < out.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(60000, out[i]));
  const head = Buffer.alloc(8); head.write('VCGI', 0); head.writeUInt32LE(jb.length, 4);
  const file = path.join(ROOT, 'engine/studies/void-cup/assets/gi.bin');
  fs.writeFileSync(file, Buffer.concat([head, jb, Buffer.alloc(pad), Buffer.from(half.buffer)]));
  console.log('wrote', path.relative(ROOT, file), (fs.statSync(file).size / 1e6).toFixed(2), 'MB');
} else {
  // ---------------- worker: the path tracer ----------------
  const { spp, depth: maxD } = workerData;
  const S = scene();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(S.pos, 3)); g.setIndex(new THREE.BufferAttribute(S.idx, 1));
  const bvh = new MeshBVH(g, { maxLeafTris: 6 });
  const ALB = [geo.BAKE_ALBEDO.table, geo.BAKE_ALBEDO.glaze, geo.BAKE_ALBEDO.liquid, [0, 0, 0], [0, 0, 0]];
  const W = geo.WINDOW, WC = W.center, WU = W.u, WV = W.v, WN = W.n, AREA = W.w * W.h;
  const SUN = geo.SUN, SC = SUN.color.map((c) => c * SUN.E);
  const ray = new THREE.Ray(), EPS = 3e-4, INV_PI = 1 / Math.PI;
  let seed = 1;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const nd = [0, 0, 0];
  const cosDir = (nx, ny, nz) => {
    const r1 = rnd(), r2 = rnd(), r = Math.sqrt(r1), ph = 2 * Math.PI * r2, x = r * Math.cos(ph), y = r * Math.sin(ph), z = Math.sqrt(1 - r1);
    let tx = Math.abs(nx) > 0.9 ? 0 : 1, ty = Math.abs(nx) > 0.9 ? 1 : 0, tz = 0;
    let bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx; const bl = 1 / Math.hypot(bx, by, bz); bx *= bl; by *= bl; bz *= bl;
    tx = by * nz - bz * ny; ty = bz * nx - bx * nz; tz = bx * ny - by * nx;
    nd[0] = tx * x + bx * y + nx * z; nd[1] = ty * x + by * y + ny * z; nd[2] = tz * x + bz * y + nz * z;
  };
  let hit = null;
  const trace = (ox, oy, oz, dx, dy, dz, skipSlats = false) => {
    for (let k = 0; k < 8; k++) {
      ray.origin.set(ox, oy, oz); ray.direction.set(dx, dy, dz);
      hit = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (!hit) return false;
      if (skipSlats && S.triMat[hit.faceIndex] === MAT_IDS.slat) { ox = hit.point.x + dx * EPS; oy = hit.point.y + dy * EPS; oz = hit.point.z + dz * EPS; continue; }
      return true;
    }
    return false;
  };
  // pdf (solid angle) of picking direction d by sampling the opening uniformly; 0 if d misses it
  const portalPdf = (ox, oy, oz, dx, dy, dz) => {
    const den = dx * WN.x + dy * WN.y + dz * WN.z; if (den > -1e-6) return 0;
    const t = ((WC.x - ox) * WN.x + (WC.y - oy) * WN.y + (WC.z - oz) * WN.z) / den; if (t <= 0) return 0;
    const hx = ox + dx * t - WC.x, hy = oy + dy * t - WC.y, hz = oz + dz * t - WC.z;
    const a = hx * WU.x + hy * WU.y + hz * WU.z, b = hx * WV.x + hy * WV.y + hz * WV.z;
    if (Math.abs(a) > W.w / 2 || Math.abs(b) > W.h / 2) return 0;
    return (t * t) / (AREA * -den);
  };
  const skyV = new THREE.Vector3();
  const sky = (dx, dy, dz) => geo.skyRadiance(skyV.set(dx, dy, dz));
  const L = [0, 0, 0];
  function path(ox, oy, oz, nx, ny, nz, u1, u2) {
    let tr = 1, tg = 1, tb = 1;
    for (let d = 0; d < maxD; d++) {
      // sky through the opening (NEE)
      {
        const a = (d === 0 ? u1 : rnd()) - 0.5, b = (d === 0 ? u2 : rnd()) - 0.5;
        const qx = WC.x + WU.x * W.w * a + WV.x * W.h * b, qy = WC.y + WU.y * W.w * a + WV.y * W.h * b, qz = WC.z + WU.z * W.w * a + WV.z * W.h * b;
        let dx = qx - ox, dy = qy - oy, dz = qz - oz; const t2 = dx * dx + dy * dy + dz * dz, dist = Math.sqrt(t2); dx /= dist; dy /= dist; dz /= dist;
        const c = dx * nx + dy * ny + dz * nz, cp = -(dx * WN.x + dy * WN.y + dz * WN.z);
        if (c > 0 && cp > 0) {
          const pp = t2 / (AREA * cp), pc = c * INV_PI;
          if (!(trace(ox, oy, oz, dx, dy, dz) && hit.distance < dist)) {
            const s = sky(dx, dy, dz), w = pc / (pp + pc);
            L[0] += tr * s[0] * w; L[1] += tg * s[1] * w; L[2] += tb * s[2] * w;
          }
        }
      }
      // the sunlit wall on the right (NEE only; BSDF rays never count it, so there is no double counting)
      {
        const K = geo.CARD, a = rnd() - 0.5, b = rnd() - 0.5;
        const qx = K.center.x + K.u.x * K.w * a + K.v.x * K.h * b, qy = K.center.y + K.u.y * K.w * a + K.v.y * K.h * b, qz = K.center.z + K.u.z * K.w * a + K.v.z * K.h * b;
        let dx = qx - ox, dy = qy - oy, dz = qz - oz; const t2 = dx * dx + dy * dy + dz * dz, dist = Math.sqrt(t2); dx /= dist; dy /= dist; dz /= dist;
        const c = dx * nx + dy * ny + dz * nz, cl = -(dx * K.n.x + dy * K.n.y + dz * K.n.z);
        if (c > 0 && cl > 0 && !(trace(ox, oy, oz, dx, dy, dz) && hit.distance < dist)) {
          const g = c * cl * K.w * K.h / t2 * INV_PI;
          L[0] += tr * K.L[0] * g; L[1] += tg * K.L[1] * g; L[2] += tb * K.L[2] * g;
        }
      }
      // the sun, only after the first bounce (the renderer draws direct sun itself)
      if (d > 0) {
        const r = SUN.radius * Math.sqrt(rnd()), ph = 2 * Math.PI * rnd();
        const sx = SUN.dir.x + WU.x * r * Math.cos(ph) + WV.x * r * Math.sin(ph), sy = SUN.dir.y + WU.y * r * Math.cos(ph) + WV.y * r * Math.sin(ph), sz = SUN.dir.z + WU.z * r * Math.cos(ph) + WV.z * r * Math.sin(ph);
        const sl = Math.hypot(sx, sy, sz), c = (sx * nx + sy * ny + sz * nz) / sl;
        if (c > 0 && !trace(ox, oy, oz, sx / sl, sy / sl, sz / sl)) { L[0] += tr * SC[0] * c * INV_PI; L[1] += tg * SC[1] * c * INV_PI; L[2] += tb * SC[2] * c * INV_PI; }
      }
      cosDir(nx, ny, nz);
      const dx = nd[0], dy = nd[1], dz = nd[2], pc = (dx * nx + dy * ny + dz * nz) * INV_PI;
      if (!trace(ox, oy, oz, dx, dy, dz)) {
        const pp = portalPdf(ox, oy, oz, dx, dy, dz);
        if (pp > 0) { const s = sky(dx, dy, dz), w = pc / (pp + pc); L[0] += tr * s[0] * w; L[1] += tg * s[1] * w; L[2] += tb * s[2] * w; }
        return;
      }
      const m = S.triMat[hit.faceIndex], al = ALB[m];
      if (al[0] + al[1] + al[2] === 0) return;
      tr *= al[0]; tg *= al[1]; tb *= al[2];
      if (d >= 1) { const p = Math.min(0.95, Math.max(tr, tg, tb) * 4); if (rnd() > p) return; tr /= p; tg /= p; tb /= p; }
      let hx = hit.face.normal.x, hy = hit.face.normal.y, hz = hit.face.normal.z;
      if (hx * dx + hy * dy + hz * dz > 0) { hx = -hx; hy = -hy; hz = -hz; }
      nx = hx; ny = hy; nz = hz;
      ox = hit.point.x + nx * EPS; oy = hit.point.y + ny * EPS; oz = hit.point.z + nz * EPS;
    }
  }
  parentPort.on('message', ({ a, b, pts }) => {
    const res = new Float32Array((b - a) * 4), side = Math.max(1, Math.round(Math.sqrt(spp)));
    for (let i = 0; i < b - a; i++) {
      seed = (a + i) * 9781 + 17;
      let [px, py, pz, nx, ny, nz] = pts.subarray(i * 6, i * 6 + 6);
      const ox = px + nx * EPS * 2, oy = py + ny * EPS * 2, oz = pz + nz * EPS * 2;
      L[0] = L[1] = L[2] = 0;
      for (let s = 0; s < spp; s++) { const u1 = ((s % side) + rnd()) / side, u2 = ((Math.floor(s / side) % side) + rnd()) / side; path(ox, oy, oz, nx, ny, nz, u1, u2); }
      // window visibility, ignoring the slats (the renderer's reflection already draws the blind)
      let vis = 0; const VN = 48;
      for (let s = 0; s < VN; s++) {
        const qa = rnd() - 0.5, qb = rnd() - 0.5;
        const qx = WC.x + WU.x * W.w * qa + WV.x * W.h * qb, qy = WC.y + WU.y * W.w * qa + WV.y * W.h * qb, qz = WC.z + WU.z * W.w * qa + WV.z * W.h * qb;
        let dx = qx - ox, dy = qy - oy, dz = qz - oz; const dist = Math.hypot(dx, dy, dz); dx /= dist; dy /= dist; dz /= dist;
        if (!(trace(ox, oy, oz, dx, dy, dz, true) && hit.distance < dist)) vis++;
      }
      res[i * 4] = L[0] / spp; res[i * 4 + 1] = L[1] / spp; res[i * 4 + 2] = L[2] / spp; res[i * 4 + 3] = vis / VN;
    }
    parentPort.postMessage({ a, b, res }, [res.buffer]);
  });
  parentPort.postMessage({ ready: true });
}
