// CPU path tracer worker: diffuse GI for a list of surface points.
// All light comes from the sky. Inside the room every path vertex does next-event estimation
// through the window opening (the "portal"), combined with cosine sampling by MIS (balance
// heuristic, two-sample) so weights stay <= 1 both near the window and deep in the room.
// Whatever a portal ray meets outside (sky, leaves, the sill) is shaded by a short exterior sub-path.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

let bvh, triMat, mats, cfg, P, POS, IDX, CE = null, CB = null;
const MS = 9; // per material: albedo rgb, diffuse-transmission prob, transmission rgb, flags(1=two sided), straight-through prob
const ray = new THREE.Ray();
const EPS = 6e-4, INV_PI = 0.3183098862;
let seed = 1234567;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'init') {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    g.setIndex(new THREE.BufferAttribute(d.idx, 1));
    bvh = new MeshBVH(g, { targetLeafSize: 6, indirect: true });
    POS = d.pos; IDX = d.idx; triMat = d.triMat; mats = d.mats; cfg = d.cfg; P = cfg.portal; seed = d.seed;
    self.postMessage({ type: 'ready' });
  } else if (d.type === 'cache') {
    CE = d.ce; CB = d.cb; buildEnvMap(); self.postMessage({ type: 'cached' });
  } else if (d.type === 'job') {
    const out = job(d.samples, d.spp, d.mode);
    self.postMessage({ type: 'done', id: d.id, out }, [out.buffer]);
  }
};

const sk = [0, 0, 0];
function sky(dx, dy, dz) {
  const s = cfg.sky;
  if (dy >= 0) {
    const t = Math.sqrt(dy);
    let g = dx * s.glowDir[0] + dy * s.glowDir[1] + dz * s.glowDir[2]; g = g > 0 ? g * g : 0;
    sk[0] = s.horizon[0] + (s.zenith[0] - s.horizon[0]) * t + s.glow[0] * g;
    sk[1] = s.horizon[1] + (s.zenith[1] - s.horizon[1]) * t + s.glow[1] * g;
    sk[2] = s.horizon[2] + (s.zenith[2] - s.horizon[2]) * t + s.glow[2] * g;
  } else { sk[0] = s.ground[0]; sk[1] = s.ground[1]; sk[2] = s.ground[2]; }
}

const nd = [0, 0, 0];
function cosDir(nx, ny, nz) {
  const r1 = rnd(), r2 = rnd(), r = Math.sqrt(r1), ph = 6.283185307 * r2;
  const x = r * Math.cos(ph), y = r * Math.sin(ph), z = Math.sqrt(1 - r1);
  let tx, ty, tz;
  if (Math.abs(nx) > 0.9) { tx = 0; ty = 1; tz = 0; } else { tx = 1; ty = 0; tz = 0; }
  let bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
  const bl = 1 / Math.hypot(bx, by, bz); bx *= bl; by *= bl; bz *= bl;
  tx = by * nz - bz * ny; ty = bz * nx - bx * nz; tz = bx * ny - by * nx;
  nd[0] = tx * x + bx * y + nx * z; nd[1] = ty * x + by * y + ny * z; nd[2] = tz * x + bz * y + nz * z;
}
function portalPdf(px, py, pz, dx, dy, dz) {
  if (dz >= -1e-6) return 0;
  const t = (P.z - pz) / dz; if (t <= 0) return 0;
  const hx = px + dx * t, hy = py + dy * t;
  if (hx < P.x0 || hx > P.x1 || hy < P.y0 || hy > P.y1) return 0;
  return (t * t) / (P.area * -dz);
}
function inRoom(px, py, pz) {
  const b = cfg.room;
  return px > b[0] && px < b[3] && py > b[1] && py < b[4] && pz > b[2] && pz < b[5];
}

// First real hit along a ray; surfaces with a straight-through fraction (sheer cloth) let it pass at random.
let H = null, hm = 0, hnx = 0, hny = 0, hnz = 0, hBack = false;
function trace(ox, oy, oz, dx, dy, dz) {
  for (let k = 0; k < 6; k++) {
    ray.origin.set(ox, oy, oz); ray.direction.set(dx, dy, dz);
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
    if (!hit) { H = null; return false; }
    const m = triMat[hit.faceIndex] * MS, thru = mats[m + 8];
    if (thru > 0 && rnd() < thru) { ox = hit.point.x + dx * EPS; oy = hit.point.y + dy * EPS; oz = hit.point.z + dz * EPS; continue; }
    H = hit; hm = m; hnx = hit.face.normal.x; hny = hit.face.normal.y; hnz = hit.face.normal.z;
    hBack = hnx * dx + hny * dy + hnz * dz > 0;
    return true;
  }
  H = null; return false;
}

// Surface response at the current hit: picks reflect / transmit, returns false if absorbed.
// Leaves the shading normal in (snx,sny,snz) and multiplies colour into (cr,cg,cb).
let snx = 0, sny = 0, snz = 0, cr = 1, cg = 1, cb = 1;
function scatter() {
  let nx = hnx, ny = hny, nz = hnz;
  if (hBack) { if (!(mats[hm + 7] & 1)) return false; nx = -nx; ny = -ny; nz = -nz; }
  const T = mats[hm + 3];
  if (T > 0 && rnd() < T) { nx = -nx; ny = -ny; nz = -nz; cr *= mats[hm + 4]; cg *= mats[hm + 5]; cb *= mats[hm + 6]; }
  else { cr *= mats[hm]; cg *= mats[hm + 1]; cb *= mats[hm + 2]; }
  snx = nx; sny = ny; snz = nz; return true;
}

// Radiance leaving the current exterior hit back along the ray: short cosine-sampled walk under the sky.
const X = [0, 0, 0];
function shadeExterior() {
  X[0] = X[1] = X[2] = 0;
  const sr = cr, sg = cg, sb = cb; cr = cg = cb = 1;
  for (let depth = 0; depth < 4; depth++) {
    if (!scatter()) break;
    if (depth >= 2) { const p = Math.min(0.9, Math.max(cr, cg, cb)); if (rnd() > p) break; const ip = 1 / p; cr *= ip; cg *= ip; cb *= ip; }
    const ox = H.point.x + snx * EPS, oy = H.point.y + sny * EPS, oz = H.point.z + snz * EPS;
    cosDir(snx, sny, snz);
    if (!trace(ox, oy, oz, nd[0], nd[1], nd[2])) { sky(nd[0], nd[1], nd[2]); X[0] = cr * sk[0]; X[1] = cg * sk[1]; X[2] = cb * sk[2]; break; }
    if (H.point.z > 1e-4) break; // went back into the room: treat as dark
  }
  cr = sr; cg = sg; cb = sb;
}
// Radiance arriving at o from direction d through the portal.
function Lin(ox, oy, oz, dx, dy, dz) {
  if (!trace(ox, oy, oz, dx, dy, dz)) { sky(dx, dy, dz); X[0] = sk[0]; X[1] = sk[1]; X[2] = sk[2]; return; }
  if (H.point.z > 1e-4) { X[0] = X[1] = X[2] = 0; return; }   // blocked inside the room
  shadeExterior();
}

// Path from a vertex (o, n). Adds radiance into L. The first vertex's portal sample is reported
// separately (N0 + its direction) so the dominant light direction can be accumulated.
const L = [0, 0, 0], N0 = [0, 0, 0], ND = [0, 0, 0, 0, 0, 0];
let firstBack = 0;
function path(ox, oy, oz, nx, ny, nz, u1, u2) {
  L[0] = L[1] = L[2] = 0; N0[0] = N0[1] = N0[2] = 0;
  cr = cg = cb = 1;
  const maxD = cfg.maxDepth;
  for (let depth = 0; depth < maxD; depth++) {
    const interior = inRoom(ox, oy, oz);
    if (interior) {
      const qx = P.x0 + (P.x1 - P.x0) * (depth === 0 ? u1 : rnd()), qy = P.y0 + (P.y1 - P.y0) * (depth === 0 ? u2 : rnd());
      let dx = qx - ox, dy = qy - oy, dz = P.z - oz; const t2 = dx * dx + dy * dy + dz * dz, il = 1 / Math.sqrt(t2);
      dx *= il; dy *= il; dz *= il;
      const c = dx * nx + dy * ny + dz * nz;
      if (c > 1e-5 && dz < -1e-6) {
        const pp = t2 / (P.area * -dz), pc = c * INV_PI;
        const tr = cr, tg = cg, tb = cb;
        Lin(ox, oy, oz, dx, dy, dz);
        cr = tr; cg = tg; cb = tb;
        const w = pc / (pp + pc);
        const r = cr * X[0] * w, g = cg * X[1] * w, b = cb * X[2] * w;
        if (depth === 0) { N0[0] = r; N0[1] = g; N0[2] = b; ND[0] = dx; ND[1] = dy; ND[2] = dz; } else { L[0] += r; L[1] += g; L[2] += b; }
      }
    }
    cosDir(nx, ny, nz);
    const dx = nd[0], dy = nd[1], dz = nd[2];
    const pc = (dx * nx + dy * ny + dz * nz) * INV_PI;
    const got = trace(ox, oy, oz, dx, dy, dz);
    if (depth === 0) { ND[3] = dx; ND[4] = dy; ND[5] = dz; if (got && hBack && H.distance < 0.04 && !(mats[hm + 7] & 1)) firstBack = 1; }
    if (!got) {
      sky(dx, dy, dz);
      if (!interior) { L[0] += cr * sk[0]; L[1] += cg * sk[1]; L[2] += cb * sk[2]; }
      else { const pp = portalPdf(ox, oy, oz, dx, dy, dz); if (pp > 0) { const w = pc / (pc + pp); L[0] += cr * sk[0] * w; L[1] += cg * sk[1] * w; L[2] += cb * sk[2] * w; } }
      return;
    }
    if (interior && H.point.z < 1e-4) {            // left the room through the window and hit something outside
      const pp = portalPdf(ox, oy, oz, dx, dy, dz);
      if (pp > 0) { const w = pc / (pc + pp); shadeExterior(); L[0] += cr * X[0] * w; L[1] += cg * X[1] * w; L[2] += cb * X[2] * w; }
      return;
    }
    if (!scatter()) return;
    if (depth >= 2) { const p = Math.min(0.92, Math.max(cr, cg, cb)); if (rnd() > p) return; const ip = 1 / p; cr *= ip; cg *= ip; cb *= ip; }
    nx = snx; ny = sny; nz = snz;
    ox = H.point.x + nx * EPS; oy = H.point.y + ny * EPS; oz = H.point.z + nz * EPS;
  }
}

// ---- final gather: one bounce, then read the smoothed first-pass result stored on the hit triangle
function cacheRad() {
  if (hBack && !(mats[hm + 7] & 1)) { X[0] = X[1] = X[2] = 0; return; }
  const f = H.faceIndex * 3, a = IDX[f] * 3, b = IDX[f + 1] * 3, c = IDX[f + 2] * 3;
  const ax = POS[a], ay = POS[a + 1], az = POS[a + 2];
  const v0x = POS[b] - ax, v0y = POS[b + 1] - ay, v0z = POS[b + 2] - az, v1x = POS[c] - ax, v1y = POS[c + 1] - ay, v1z = POS[c + 2] - az;
  const v2x = H.point.x - ax, v2y = H.point.y - ay, v2z = H.point.z - az;
  const d00 = v0x * v0x + v0y * v0y + v0z * v0z, d01 = v0x * v1x + v0y * v1y + v0z * v1z, d11 = v1x * v1x + v1y * v1y + v1z * v1z;
  const d20 = v2x * v0x + v2y * v0y + v2z * v0z, d21 = v2x * v1x + v2y * v1y + v2z * v1z, den = d00 * d11 - d01 * d01;
  let v = 0.333, wq = 0.333; if (den > 1e-20) { v = (d11 * d20 - d01 * d21) / den; wq = (d00 * d21 - d01 * d20) / den; }
  if (v < 0) v = 0; if (wq < 0) wq = 0; let u = 1 - v - wq; if (u < 0) u = 0;
  const F = hBack ? CB : CE, O = hBack ? CE : CB, T = mats[hm + 3];
  for (let k = 0; k < 3; k++) {
    const ef = u * F[a + k] + v * F[b + k] + wq * F[c + k];
    X[k] = (1 - T) * mats[hm + k] * ef;
    if (T > 0) X[k] += T * mats[hm + 4 + k] * (u * O[a + k] + v * O[b + k] + wq * O[c + k]);
  }
}
// Light arriving through the window from far away (sky, trees, houses) barely depends on where in the
// opening you stand, and a diffuse wall integrates it over a wide angle anyway. So it is tabulated
// once per direction (averaged over the opening, lightly blurred): that removes the leaf/sky
// salt-and-pepper from the direct light without changing its value.
let EM = null; const EMW = 128, EMH = 96, EXT_Z = -0.45;
function buildEnvMap() {
  const save = seed; seed = 424242;
  const M = new Float32Array(EMW * EMH * 3), K = 40;
  for (let j = 0; j < EMH; j++) for (let i = 0; i < EMW; i++) {
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < K; k++) {
      const az = ((i + rnd()) / EMW - 0.5) * Math.PI, el = ((j + rnd()) / EMH - 0.5) * Math.PI;
      const ce = Math.cos(el), dx = Math.sin(az) * ce, dy = Math.sin(el), dz = -Math.cos(az) * ce;
      if (dz > -0.03) { sky(dx, dy, dz); r += sk[0]; g += sk[1]; b += sk[2]; continue; }
      const qx = P.x0 + (P.x1 - P.x0) * rnd(), qy = P.y0 + (P.y1 - P.y0) * rnd(), t = (EXT_Z - P.z) / dz;
      if (!trace(qx + dx * t, qy + dy * t, EXT_Z, dx, dy, dz)) { sky(dx, dy, dz); r += sk[0]; g += sk[1]; b += sk[2]; }
      else { cacheRad(); r += X[0]; g += X[1]; b += X[2]; }
    }
    const o = (j * EMW + i) * 3; M[o] = r / K; M[o + 1] = g / K; M[o + 2] = b / K;
  }
  EM = new Float32Array(M.length);
  let src = M, dst = EM;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < EMH; j++) for (let i = 0; i < EMW; i++) for (let c = 0; c < 3; c++) {
      let s = 0, w = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const jj = Math.min(EMH - 1, Math.max(0, j + dj)), ii = Math.min(EMW - 1, Math.max(0, i + di)), ww = (di === 0 ? 2 : 1) * (dj === 0 ? 2 : 1);
        s += src[(jj * EMW + ii) * 3 + c] * ww; w += ww;
      }
      dst[(j * EMW + i) * 3 + c] = s / w;
    }
    const tmp = src; src = dst; dst = tmp;
  }
  EM = src; seed = save;
}
function envLook(dx, dy, dz) {
  const az = Math.atan2(dx, -dz), el = Math.asin(dy > 1 ? 1 : dy < -1 ? -1 : dy);
  let u = (az / Math.PI + 0.5) * EMW - 0.5, v = (el / Math.PI + 0.5) * EMH - 0.5;
  if (u < 0) u = 0; if (u > EMW - 1.001) u = EMW - 1.001; if (v < 0) v = 0; if (v > EMH - 1.001) v = EMH - 1.001;
  const i = u | 0, j = v | 0, fu = u - i, fv = v - j, a = (j * EMW + i) * 3, b = a + 3, c = a + EMW * 3, d = c + 3;
  for (let k = 0; k < 3; k++) X[k] = (EM[a + k] * (1 - fu) + EM[b + k] * fu) * (1 - fv) + (EM[c + k] * (1 - fu) + EM[d + k] * fu) * fv;
}
function gather(ox, oy, oz, nx, ny, nz, u1, u2) {
  L[0] = L[1] = L[2] = 0; N0[0] = N0[1] = N0[2] = 0;
  const interior = inRoom(ox, oy, oz);
  if (interior) {
    const qx = P.x0 + (P.x1 - P.x0) * u1, qy = P.y0 + (P.y1 - P.y0) * u2;
    let dx = qx - ox, dy = qy - oy, dz = P.z - oz; const t2 = dx * dx + dy * dy + dz * dz, il = 1 / Math.sqrt(t2);
    dx *= il; dy *= il; dz *= il;
    const c = dx * nx + dy * ny + dz * nz;
    if (c > 1e-5 && dz < -1e-6) {
      const pp = t2 / (P.area * -dz), pc = c * INV_PI, w = pc / (pp + pc);
      if (!trace(ox, oy, oz, dx, dy, dz) || H.point.z < EXT_Z) envLook(dx, dy, dz);
      else if (H.point.z > 1e-4) { X[0] = X[1] = X[2] = 0; } else cacheRad();
      N0[0] = X[0] * w; N0[1] = X[1] * w; N0[2] = X[2] * w; ND[0] = dx; ND[1] = dy; ND[2] = dz;
    }
  }
  cosDir(nx, ny, nz);
  const dx = nd[0], dy = nd[1], dz = nd[2], pc = (dx * nx + dy * ny + dz * nz) * INV_PI;
  ND[3] = dx; ND[4] = dy; ND[5] = dz;
  const got = trace(ox, oy, oz, dx, dy, dz);
  if (got && hBack && H.distance < 0.04 && !(mats[hm + 7] & 1)) firstBack = 1;
  let w = 1;
  if (interior && (!got || H.point.z < 1e-4)) { const pp = portalPdf(ox, oy, oz, dx, dy, dz); w = pp > 0 ? pc / (pc + pp) : 0; }
  if (w <= 0) return;
  if ((interior || oz > -0.4) && dz < -0.03 && (!got || H.point.z < EXT_Z)) envLook(dx, dy, dz);
  else if (!got) { sky(dx, dy, dz); X[0] = sk[0]; X[1] = sk[1]; X[2] = sk[2]; } else cacheRad();
  L[0] = X[0] * w; L[1] = X[1] * w; L[2] = X[2] * w;
}

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = (i / b) | 0; } return r; };
let H2 = null, H3 = null;
// samples: [px,py,pz,nx,ny,nz]*n  ->  out: [Er,Eg,Eb,Dx,Dy,Dz,valid]*n   (E is irradiance/PI)
function job(S, spp, mode) {
  if (!H2 || H2.length !== spp) { H2 = new Float32Array(spp); H3 = new Float32Array(spp); for (let s = 0; s < spp; s++) { H2[s] = halton(s + 1, 2); H3[s] = halton(s + 1, 3); } }
  const n = S.length / 6, out = new Float32Array(n * 7);
  for (let i = 0; i < n; i++) {
    const px = S[i * 6], py = S[i * 6 + 1], pz = S[i * 6 + 2], nx = S[i * 6 + 3], ny = S[i * 6 + 4], nz = S[i * 6 + 5];
    const ox = px + nx * EPS * 1.5, oy = py + ny * EPS * 1.5, oz = pz + nz * EPS * 1.5;
    let er = 0, eg = 0, eb = 0, ddx = 0, ddy = 0, ddz = 0, wl = 0, back = 0;
    const j1 = rnd(), j2 = rnd();
    for (let s = 0; s < spp; s++) {
      let u1 = H2[s] + j1, u2 = H3[s] + j2; if (u1 >= 1) u1 -= 1; if (u2 >= 1) u2 -= 1;
      firstBack = 0;
      if (mode === 1) gather(ox, oy, oz, nx, ny, nz, u1, u2); else path(ox, oy, oz, nx, ny, nz, u1, u2);
      back += firstBack;
      const lr = Math.min(L[0], 30), lg = Math.min(L[1], 30), lb = Math.min(L[2], 30);
      er += lr + N0[0]; eg += lg + N0[1]; eb += lb + N0[2];
      const l1 = 0.2126 * N0[0] + 0.7152 * N0[1] + 0.0722 * N0[2], l2 = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      ddx += ND[0] * l1 + ND[3] * l2; ddy += ND[1] * l1 + ND[4] * l2; ddz += ND[2] * l1 + ND[5] * l2; wl += l1 + l2;
    }
    const k = 1 / spp, o = i * 7;
    out[o] = er * k; out[o + 1] = eg * k; out[o + 2] = eb * k;
    if (wl > 1e-9) { out[o + 3] = ddx / wl; out[o + 4] = ddy / wl; out[o + 5] = ddz / wl; }
    out[o + 6] = back > spp * 0.35 ? 0 : 1;
  }
  return out;
}
