// The bed: oak frame, mattress under a fitted sheet, two pillows in housewife cases, the unmade duvet
// with a slate-blue sprig print (the hero cloth), a chunky cable-knit throw, a small fluffy cushion and
// a few things left lying about (an open paperback, a phone, a hair tie).
//
// Cloth is not simulated. Each piece is a dense sheet in "flat" bed coordinates (p along the bed
// width, z along its length) whose height above its support is designed: broad lobes and pillowy
// folds (tops rounded off by a peak-eroding filter), plus a field of individually rasterised creases
// (tension fans out of pinch points, bundles, crumple) — once coarse as real geometry, once fine as a
// 2048 px normal map with a cavity channel. `drape()` wraps that sheet over the mattress edge so cloth
// can hang down the right side, tall folds lean over, a page-curl turns one duvet corner back over
// itself, and the UVs are relaxed against the final 3D surface so print and knit keep their scale on
// steep folds. The throw lies on the duvet by construction (its support is the duvet's height function).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BED } from '../layout.js';
import { roundedBox, boxAt, merge, mesh, group, tube, surface, lathe, gridPlane } from '../../core/geo.js';
import { makeCanvas, canvasTex, dataTex, avgColor, field } from '../../core/tex.js';
import { RNG, hash2, fbm2, fbm3, worley2, smoothstep, clamp, lerp } from '../../core/rng.js';
import { pbr, sc, weaveNormal } from '../materials.js';

export const order = 20;
export const label = 'bed';

const TAU = Math.PI * 2, HP = Math.PI / 2;
const TOP = BED.top;                                                    // mattress top, y = 0.50
const MX0 = 0.125, MX1 = 1.555, MZ0 = 1.925, MZ1 = 3.957, MH = 0.2;     // mattress body
const P0 = 1.518, RC = 0.07, XE = P0 + RC;                              // drape: flat until P0, corner radius RC, then straight down at XE
const BOOK = { x: 0.74, z: 3.235, yaw: 0.32 }, TIE = { x: 0.985, z: 3.035 };   // things lying on the duvet (flat duvet coordinates)

// ---------------------------------------------------------------- small maths
const mod = (a, n) => ((a % n) + n) % n;
/** Value noise 0..1 with optional separate periods per axis. */
function pn(x, y, seed, px = 0, py = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  let x0 = ix, x1 = ix + 1, y0 = iy, y1 = iy + 1;
  if (px) { x0 = mod(x0, px); x1 = mod(x1, px); }
  if (py) { y0 = mod(y0, py); y1 = mod(y1, py); }
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const bill = (n) => { const b = Math.abs(2 * n - 1); return 1 - (1 - b) * (1 - b); };   // round tops, sharp creases
const ridge = (n) => 1 - Math.abs(2 * n - 1);                                            // sharp crests
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
/** Rounded edge profile: 0 at the hem, 1 from `w` inwards, vertical tangent at the hem. */
const prof = (d, w) => { if (d <= 0) return 0; if (d >= w) return 1; const t = 1 - d / w; return Math.pow(1 - t * t, 0.6); };

function sagAt(x, z) {
  const a = clamp((x - MX0) / (MX1 - MX0)) * 2 - 1, b = clamp((z - MZ0) / (MZ1 - MZ0)) * 2 - 1, a2 = a * a, b2 = b * b;
  return 0.007 * (1 - a2 * a2) * (1 - b2 * b2 * b2);
}
/** Flat sheet coordinate (p, z) + elevation e above the support -> world. */
function drape(p, z, e, o) {
  o.z = z;
  if (p <= P0) { o.x = p; o.y = TOP - sagAt(p, z) + e; return; }
  const a = (p - P0) / RC;
  if (a < HP) { o.x = P0 + (RC + e) * Math.sin(a); o.y = TOP - RC + (RC + e) * Math.cos(a); }
  else { o.x = XE + e; o.y = TOP - RC - (p - P0 - RC * HP); }
}

/** n+1 coordinates in 0..1 with the first/last few cells shrunk (m) so rounded hems get enough vertices. */
function gradedAxis(n, len, steps) {
  const m = steps.length, sum = steps.reduce((a, b) => a + b, 0), h = (len - 2 * sum) / (n - 2 * m);
  const out = new Float32Array(n + 1); let x = 0;
  for (let i = 0; i < n; i++) { out[i] = x / len; x += i < m ? steps[i] : i >= n - m ? steps[n - 1 - i] : h; }
  out[n] = 1; return out;
}
/** n+1 coordinates in 0..1 over `len` metres: cells of about `fine` between d0 and d1 (where the close-ups look),
 *  `coarse` elsewhere, and small ones towards both hems so the stitched band there is real geometry. */
function zonedAxis(n, len, d0, d1, fine, coarse) {
  const K = 4096, cum = new Float64Array(K + 1);
  for (let k = 0; k < K; k++) {
    const t = ((k + 0.5) / K) * len, zone = smoothstep(d0 - 0.06, d0, t) * (1 - smoothstep(d1, d1 + 0.06, t));
    cum[k + 1] = cum[k] + 1 / Math.min(lerp(coarse, fine, zone), 0.0015 + 0.075 * Math.min(t, len - t));
  }
  const out = new Float32Array(n + 1); let k = 0;
  for (let i = 1; i < n; i++) { const target = (cum[K] * i) / n; while (cum[k + 1] < target) k++; out[i] = (k + (target - cum[k]) / (cum[k + 1] - cum[k])) / K; }
  out[n] = 1; return out;
}

/** Triangles for a (nu x nv)-cell vertex grid. mask(i,j) selects cells, flip reverses the facing. */
function gridGeo(P, UV, nu, nv, { mask = null, flip = false, stride = 1 } = {}) {
  const W1 = nu + 1, remap = new Int32Array(W1 * (nv + 1)).fill(-1);
  const pos = new Float32Array(W1 * (nv + 1) * 3), uv = new Float32Array(W1 * (nv + 1) * 2), idx = new Uint32Array((nu / stride) * (nv / stride) * 6);
  let nvx = 0, ni = 0;
  const vid = (i, j) => {
    const k = j * W1 + i; let r = remap[k];
    if (r < 0) { r = remap[k] = nvx++; pos[r * 3] = P[k * 3]; pos[r * 3 + 1] = P[k * 3 + 1]; pos[r * 3 + 2] = P[k * 3 + 2]; uv[r * 2] = UV[k * 2]; uv[r * 2 + 1] = UV[k * 2 + 1]; }
    return r;
  };
  for (let j = 0; j < nv; j += stride) for (let i = 0; i < nu; i += stride) {
    if (mask && !mask(i, j)) continue;
    const a = vid(i, j), b = vid(i + stride, j), c = vid(i + stride, j + stride), d = vid(i, j + stride);
    const alt = ((i / stride + j / stride) & 1) === 1;
    if (!flip) { if (alt) { idx[ni++] = a; idx[ni++] = d; idx[ni++] = b; idx[ni++] = b; idx[ni++] = d; idx[ni++] = c; } else { idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; } }
    else if (alt) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = d; idx[ni++] = b; idx[ni++] = c; idx[ni++] = d; } else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, nvx * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv.slice(0, nvx * 2), 2));
  g.setIndex(new THREE.BufferAttribute(idx.slice(0, ni), 1));
  g.computeVertexNormals();
  g.userData.remap = remap;      // grid index -> vertex index (-1 if unused)
  return g;
}

/** Flatten a draped grid: find UVs (metres) whose edge lengths match the 3D surface, coarse to fine.
 *  Print and knit then keep their true scale on steep folds instead of stretching. */
function relaxUV(P, nu, nv, uv, iters = [260, 70, 30, 12]) {
  const W1 = nu + 1, N = W1 * (nv + 1);
  const dst = (a, b) => { const x = P[a * 3] - P[b * 3], y = P[a * 3 + 1] - P[b * 3 + 1], z = P[a * 3 + 2] - P[b * 3 + 2]; return Math.sqrt(x * x + y * y + z * z); };
  const rowS = new Float32Array(N), colS = new Float32Array(N);
  for (let j = 0; j <= nv; j++) for (let i = 1; i <= nu; i++) rowS[j * W1 + i] = rowS[j * W1 + i - 1] + dst(j * W1 + i - 1, j * W1 + i);
  for (let j = 1; j <= nv; j++) for (let i = 0; i <= nu; i++) colS[j * W1 + i] = colS[(j - 1) * W1 + i] + dst((j - 1) * W1 + i, j * W1 + i);
  let mu = 0, mv = 0; for (let k = 0; k < N; k++) { mu += uv[k * 2]; mv += uv[k * 2 + 1]; }
  const solve = (a, b, rest, st) => {
    const dx = uv[b * 2] - uv[a * 2], dy = uv[b * 2 + 1] - uv[a * 2 + 1], l = Math.sqrt(dx * dx + dy * dy) || 1e-9, f = (st * 0.5 * (l - rest)) / l;
    uv[a * 2] += dx * f; uv[a * 2 + 1] += dy * f; uv[b * 2] -= dx * f; uv[b * 2 + 1] -= dy * f;
  };
  const strides = [8, 4, 2, 1];
  for (let L = 0; L < strides.length; L++) {
    const k = strides[L], ni = nu / k, nj = nv / k, id = (I, J) => J * k * W1 + I * k;
    if (L > 0) {   // prolong from the coarser level, weighted by arc length
      for (let J = 0; J <= nj; J += 2) for (let I = 1; I < ni; I += 2) { const a = id(I - 1, J), b = id(I + 1, J), c = id(I, J), t = (rowS[c] - rowS[a]) / Math.max(1e-9, rowS[b] - rowS[a]); uv[c * 2] = lerp(uv[a * 2], uv[b * 2], t); uv[c * 2 + 1] = lerp(uv[a * 2 + 1], uv[b * 2 + 1], t); }
      for (let J = 1; J < nj; J += 2) for (let I = 0; I <= ni; I += 2) { const a = id(I, J - 1), b = id(I, J + 1), c = id(I, J), t = (colS[c] - colS[a]) / Math.max(1e-9, colS[b] - colS[a]); uv[c * 2] = lerp(uv[a * 2], uv[b * 2], t); uv[c * 2 + 1] = lerp(uv[a * 2 + 1], uv[b * 2 + 1], t); }
      for (let J = 1; J < nj; J += 2) for (let I = 1; I < ni; I += 2) { const c = id(I, J), a = id(I - 1, J), b = id(I + 1, J), d = id(I, J - 1), e = id(I, J + 1); uv[c * 2] = 0.25 * (uv[a * 2] + uv[b * 2] + uv[d * 2] + uv[e * 2]); uv[c * 2 + 1] = 0.25 * (uv[a * 2 + 1] + uv[b * 2 + 1] + uv[d * 2 + 1] + uv[e * 2 + 1]); }
    }
    const rH = new Float32Array(ni * (nj + 1)), rV = new Float32Array((ni + 1) * nj), rD = new Float32Array(ni * nj), rE = new Float32Array(ni * nj);
    for (let J = 0; J <= nj; J++) for (let I = 0; I < ni; I++) rH[J * ni + I] = rowS[id(I + 1, J)] - rowS[id(I, J)];
    for (let J = 0; J < nj; J++) for (let I = 0; I <= ni; I++) rV[J * (ni + 1) + I] = colS[id(I, J + 1)] - colS[id(I, J)];
    for (let J = 0; J < nj; J++) for (let I = 0; I < ni; I++) {
      let d1 = 0, d2 = 0; const i0 = I * k, j0 = J * k;
      for (let t = 0; t < k; t++) { d1 += dst((j0 + t) * W1 + i0 + t, (j0 + t + 1) * W1 + i0 + t + 1); d2 += dst((j0 + t) * W1 + i0 + k - t, (j0 + t + 1) * W1 + i0 + k - t - 1); }
      rD[J * ni + I] = d1; rE[J * ni + I] = d2;
    }
    for (let it = 0; it < iters[L]; it++) {
      const fwd = (it & 1) === 0;
      for (let jj = 0; jj <= nj; jj++) {
        const J = fwd ? jj : nj - jj;
        for (let ii = 0; ii <= ni; ii++) {
          const I = fwd ? ii : ni - ii, a = id(I, J);
          if (I < ni) solve(a, id(I + 1, J), rH[J * ni + I], 1);
          if (J < nj) solve(a, id(I, J + 1), rV[J * (ni + 1) + I], 1);
          if (I < ni && J < nj) { solve(a, id(I + 1, J + 1), rD[J * ni + I], 0.5); solve(id(I + 1, J), id(I, J + 1), rE[J * ni + I], 0.5); }
        }
      }
    }
  }
  let nu2 = 0, nv2 = 0; for (let k = 0; k < N; k++) { nu2 += uv[k * 2]; nv2 += uv[k * 2 + 1]; }
  const du = (mu - nu2) / N, dv = (mv - nv2) / N;
  for (let k = 0; k < N; k++) { uv[k * 2] += du; uv[k * 2 + 1] += dv; }
}

// ---------------------------------------------------------------- float fields: sampling, blurs, creases
/** Bilinear sample of a w x h field at texel coordinates (clamped). */
function bil(F, w, h, fx, fy) {
  fx = fx < 0 ? 0 : fx > w - 1.001 ? w - 1.001 : fx; fy = fy < 0 ? 0 : fy > h - 1.001 ? h - 1.001 : fy;
  const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, k = iy * w + ix, a = F[k] + (F[k + 1] - F[k]) * tx, b = F[k + w] + (F[k + w + 1] - F[k + w]) * tx;
  return a + (b - a) * ty;
}
/** Catmull-Rom sample (smooth first derivative), clamped. */
function cubicAt(F, w, h, fx, fy) {
  fx = fx < 1 ? 1 : fx > w - 2.001 ? w - 2.001 : fx; fy = fy < 1 ? 1 : fy > h - 2.001 ? h - 2.001 : fy;
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const a0 = ((-0.5 * tx + 1) * tx - 0.5) * tx, a1 = (1.5 * tx - 2.5) * tx * tx + 1, a2 = ((-1.5 * tx + 2) * tx + 0.5) * tx, a3 = (0.5 * tx - 0.5) * tx * tx;
  const b0 = ((-0.5 * ty + 1) * ty - 0.5) * ty, b1 = (1.5 * ty - 2.5) * ty * ty + 1, b2 = ((-1.5 * ty + 2) * ty + 0.5) * ty, b3 = (0.5 * ty - 0.5) * ty * ty;
  const row = (k) => F[k - 1] * a0 + F[k] * a1 + F[k + 1] * a2 + F[k + 2] * a3, k = iy * w + ix;
  return row(k - w) * b0 + row(k) * b1 + row(k + w) * b2 + row(k + 2 * w) * b3;
}
function boxBlurWrap(src, w, h, rx, ry) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w; let s = 0;
    for (let k = -rx; k <= rx; k++) s += src[o + ((k + w) % w)];
    for (let x = 0; x < w; x++) { tmp[o + x] = s / (2 * rx + 1); s += src[o + ((x + rx + 1) % w)] - src[o + ((x - rx + w) % w)]; }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -ry; k <= ry; k++) s += tmp[((k + h) % h) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = s / (2 * ry + 1); s += tmp[((y + ry + 1) % h) * w + x] - tmp[((y - ry + h) % h) * w + x]; }
  }
  return out;
}
function boxBlurClamp(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w; let s = 0;
    for (let k = -r; k <= r; k++) s += src[o + (k < 0 ? 0 : k >= w ? w - 1 : k)];
    for (let x = 0; x < w; x++) { tmp[o + x] = s / n; const a = x + r + 1, b = x - r; s += src[o + (a >= w ? w - 1 : a)] - src[o + (b < 0 ? 0 : b)]; }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[(k < 0 ? 0 : k >= h ? h - 1 : k) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = s / n; const a = y + r + 1, b = y - r; s += tmp[(a >= h ? h - 1 : a) * w + x] - tmp[(b < 0 ? 0 : b) * w + x]; }
  }
  return out;
}

// One crease = a soft tent along a (slightly bent) line: a crisp but rounded crest, concave flanks, and it
// narrows and dies away towards both ends. Cloth wrinkles are made of these, not of noise.
const PROF_N = 256, CR_PROF = new Float32Array(PROF_N + 2), CR_ENV = new Float32Array(PROF_N + 2);
for (let i = 0; i <= PROF_N + 1; i++) {
  const t = Math.min(1, i / PROF_N), r = 0.22;      // r: how far the crest is rounded off (cloth has thickness)
  CR_PROF[i] = Math.exp(-(Math.sqrt(t * t + r * r) - r) * 4.2) * (1 - t * t) * (1 - t * t);
  CR_ENV[i] = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.8))), 0.75);
}
/** Add a crease to field F (w x h, texel units). Starts at (x0,y0), runs L along `ang`; R = half width of its
 *  footprint (the crest's e-folding width is R/4.2), A = height, bend = sideways bow as a fraction of L/4.
 *  wrap needs power-of-two w and h. */
function crease(F, w, h, wrap, x0, y0, ang, L, R, A, bend = 0) {
  const cx = Math.cos(ang), cy = Math.sin(ang), x1 = x0 + cx * L, y1 = y0 + cy * L, m = R + Math.abs(bend) * L * 0.25 + 1;
  const ya = Math.floor(Math.min(y0, y1) - m), yb = Math.ceil(Math.max(y0, y1) + m), xa = Math.floor(Math.min(x0, x1) - m), xb = Math.ceil(Math.max(x0, x1) + m);
  const iL = 1 / L, iR = PROF_N / R, bl = bend * L;
  for (let y = ya; y <= yb; y++) {
    if (!wrap && (y < 0 || y >= h)) continue;
    const dy = y - y0, row = (wrap ? y & (h - 1) : y) * w;
    let lo = xa, hi = xb;
    if (cy > 1e-3 || cy < -1e-3) { const p = x0 + (dy * cx - m) / cy, q = x0 + (dy * cx + m) / cy; lo = Math.max(lo, Math.floor(Math.min(p, q))); hi = Math.min(hi, Math.ceil(Math.max(p, q))); }
    if (!wrap) { if (lo < 0) lo = 0; if (hi > w - 1) hi = w - 1; }
    for (let x = lo; x <= hi; x++) {
      const dx = x - x0, s = (dx * cx + dy * cy) * iL;
      if (s <= 0 || s >= 1) continue;
      let d = dy * cx - dx * cy - bl * s * (1 - s);
      if (d < 0) d = -d;
      const fs = s * PROF_N, is = fs | 0, env = CR_ENV[is] + (CR_ENV[is + 1] - CR_ENV[is]) * (fs - is);
      const fp = (d * iR) / (0.4 + 0.6 * env);
      if (fp >= PROF_N) continue;
      const ip = fp | 0;
      F[row + (wrap ? x & (w - 1) : x)] += A * env * (CR_PROF[ip] + (CR_PROF[ip + 1] - CR_PROF[ip]) * (fp - ip));
    }
  }
}

// ---------------------------------------------------------------- textures
/** Height field -> tangent-space normal map. sx/sy = slope per unit height difference between neighbouring texels. */
function normalFromHeight(H, w, h, sx, sy) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = ((y + h - 1) % h) * w, yp = ((y + 1) % h) * w, o = y * w;
    for (let x = 0; x < w; x++) {
      const dx = (H[o + ((x + 1) % w)] - H[o + ((x + w - 1) % w)]) * 0.5 * sx, dy = (H[yp + x] - H[ym + x]) * 0.5 * sy;
      const il = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (o + x) * 4;
      out[i] = (-dx * il * 0.5 + 0.5) * 255; out[i + 1] = (-dy * il * 0.5 + 0.5) * 255; out[i + 2] = (il * 0.5 + 0.5) * 255; out[i + 3] = 255;
    }
  }
  return out;
}
/** Normal map of a height field (mm, s texels per mm) with a cavity value in alpha: 0.5 = level, darker in the folds. */
function normalCavity(H, w, h, s, wrap) {
  const out = normalFromHeight(H, w, h, s, s), lw = w >> 2, lh = h >> 2;
  // local mean height (about 3 mm around), worked out at quarter resolution
  let low = new Float32Array(lw * lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    let a = 0;
    for (let j = 0; j < 4; j++) { const o = (y * 4 + j) * w + x * 4; a += H[o] + H[o + 1] + H[o + 2] + H[o + 3]; }
    low[y * lw + x] = a / 16;
  }
  low = wrap ? boxBlurWrap(boxBlurWrap(low, lw, lh, 2, 2), lw, lh, 2, 2) : boxBlurClamp(boxBlurClamp(low, lw, lh, 2), lw, lh, 2);
  const ix = (v, n) => (wrap ? ((v % n) + n) % n : v < 0 ? 0 : v >= n ? n - 1 : v);
  for (let y = 0; y < h; y++) {
    const fy = (y + 0.5) / 4 - 0.5, y0 = Math.floor(fy), ty = fy - y0, r0 = ix(y0, lh) * lw, r1 = ix(y0 + 1, lh) * lw, o = y * w;
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) / 4 - 0.5, x0 = Math.floor(fx), tx = fx - x0, xa = ix(x0, lw), xb = ix(x0 + 1, lw);
      const a = low[r0 + xa] + (low[r0 + xb] - low[r0 + xa]) * tx, b = low[r1 + xa] + (low[r1 + xb] - low[r1 + xa]) * tx, c = 0.5 + (H[o + x] - (a + (b - a) * ty)) * 0.6;
      out[(o + x) * 4 + 3] = c <= 0 ? 0 : c >= 1 ? 255 : c * 255;
    }
  }
  return out;
}

/** Slept-in cotton, one tile of WR_TILE metres: bundles and fans of tension creases with small buckles leaving
 *  them, patches of short crumple marks, soft undulation in between. Heights in mm. */
const WR_TILE = 0.64, WEAVE = 0.04;      // WEAVE: size of one tile of the thread-level detail map (96 threads)
function cottonWrinkles() {
  const N = 2048, px = N / (WR_TILE * 1000), H = new Float32Array(N * N), rng = new RNG(7719);
  const dirAt = (x, y) => 3.4 * pn((x / N) * 3 + 0.37, (y / N) * 3 + 0.71, 301, 3, 3);                      // which way the cloth is pulled (neighbouring wrinkles mostly agree)
  const busy = (x, y) => smoothstep(0.28, 0.62, pn((x / N) * 5 + 0.2, (y / N) * 5 + 0.6, 302, 5, 5));      // crumpled patches vs calm ones
  for (let k = 0; k < 60; k++) {
    const ox = rng.range(0, N), oy = rng.range(0, N), base = dirAt(ox, oy) + (rng.chance(0.12) ? HP : 0), fan = rng.chance(0.5), n = rng.int(2, 5), sp = rng.range(9, 17) * px;
    const cb = Math.cos(base), sb = Math.sin(base);
    for (let i = 0; i < n; i++) {
      const L = rng.range(40, 140) * px, a = base + (fan ? rng.range(-0.36, 0.36) : rng.range(-0.09, 0.09));
      const off = fan ? rng.range(-2, 2) * px : (i - (n - 1) / 2) * sp + rng.range(-2, 2) * px, st = fan ? rng.range(0, 5) * px : rng.range(-30, 30) * px;
      const x0 = ox - sb * off + cb * st, y0 = oy + cb * off + sb * st, Rmm = rng.range(9, 18), A = Rmm * rng.range(0.09, 0.17) * (rng.chance(0.18) ? -0.6 : 1);
      crease(H, N, N, true, x0, y0, a, L, Rmm * px, A, rng.range(-0.45, 0.45));
      for (let b = rng.int(0, 2); b > 0; b--) {
        const t = rng.range(0.2, 0.8);
        crease(H, N, N, true, x0 + Math.cos(a) * L * t, y0 + Math.sin(a) * L * t, a + rng.sign() * rng.range(0.6, 1.3), L * rng.range(0.12, 0.3), Rmm * px * 0.6, A * rng.range(0.3, 0.55), 0);
      }
    }
  }
  for (let k = 0; k < 1700; k++) {
    const x0 = rng.range(0, N), y0 = rng.range(0, N), keep = rng.next() < 0.2 + 0.8 * busy(x0, y0);
    const a = dirAt(x0, y0) + rng.gauss() * 0.6, Rmm = rng.range(4, 9), L = rng.range(12, 46) * px, A = Rmm * rng.range(0.055, 0.12) * (rng.chance(0.4) ? -0.8 : 1), bend = rng.range(-0.4, 0.4);
    if (keep) crease(H, N, N, true, x0, y0, a, L, Rmm * px, A, bend);
  }
  // soft undulation (3 cm) and the fine orange-peel of laundered percale (5 mm), from a coarse tiling grid
  const LN = 512, low = field(LN, LN, (u, v) => 1.0 * (pn(u * 22, v * 22, 44, 22, 22) - 0.5) + 0.1 * (pn(u * 128, v * 128, 43, 128, 128) - 0.5));
  for (let y = 0; y < N; y++) {
    const fy = y / 4, ya = fy | 0, ty = fy - ya, r0 = ya * LN, r1 = ((ya + 1) & (LN - 1)) * LN, o = y * N;
    for (let x = 0; x < N; x++) {
      const fx = x / 4, xa = fx | 0, tx = fx - xa, xb = (xa + 1) & (LN - 1), a = low[r0 + xa] + (low[r0 + xb] - low[r0 + xa]) * tx, b = low[r1 + xa] + (low[r1 + xb] - low[r1 + xa]) * tx;
      H[o + x] += a + (b - a) * ty;
    }
  }
  return dataTex(normalCavity(H, N, N, px, true), N, N, {});
}

/** One pillowcase (housewife style, opening at +x), 0.65 x 0.43 m: creases fanning out of the corners, a stitched
 *  and puckered hem at the open end, the inner flap showing through, storage folds, crumple. Also returns the
 *  coarse corner folds as a height function (metres) for the mesh. */
const PIL = { hw: 0.325, hl: 0.215, HEM: 0.03 };
function pillowFields() {
  const W = 1536, H = 1024, px = W / 650, py = H / 430, F = new Float32Array(W * H), rng = new RNG(6203), hw = 325, hl = 215;   // mm
  const X = (mm) => (mm + hw) * px, Y = (mm) => (mm + hl) * py;
  const cr = (x, y, a, L, R, A, bend = 0) => crease(F, W, H, false, X(x), Y(y), a, L * px, R * px, A * 1.45, bend);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {                 // dog-ear fans out of the four corners
    const base = Math.atan2(-sy * hl, -sx * hw);
    for (let i = rng.int(6, 9); i > 0; i--) { const R = rng.range(5, 11); cr(sx * (hw - 22) + rng.range(-9, 9), sy * (hl - 22) + rng.range(-9, 9), base + rng.range(-0.75, 0.75), rng.range(50, 190), R, R * rng.range(0.07, 0.14) * (rng.chance(0.15) ? -0.6 : 1), rng.range(-0.3, 0.3)); }
  }
  for (let i = 0; i < 9; i++) { const a = rng.range(0, TAU), d = rng.range(35, 70), R = rng.range(5, 9); cr(-10 + Math.cos(a) * d, 5 + Math.sin(a) * d * 0.8, a + rng.range(-0.3, 0.3), rng.range(40, 110), R, R * rng.range(0.05, 0.1), rng.range(-0.3, 0.3)); }   // out of the head's dent
  for (let k = 0; k < 20; k++) {                                                   // tension bundles, mostly lengthwise
    const ox = rng.range(-hw + 40, hw - 60), oy = rng.range(-hl + 30, hl - 30), base = rng.chance(0.7) ? rng.range(-0.35, 0.35) : rng.range(0, TAU), n = rng.int(2, 4), sp = rng.range(5, 10);
    for (let i = 0; i < n; i++) { const R = rng.range(5, 10), off = (i - (n - 1) / 2) * sp; cr(ox - Math.sin(base) * off + rng.range(-15, 15), oy + Math.cos(base) * off, base + rng.range(-0.1, 0.1), rng.range(50, 150), R, R * rng.range(0.06, 0.12), rng.range(-0.2, 0.2)); }
  }
  for (let k = 0; k < 1100; k++) { const R = rng.range(2.2, 5); cr(rng.range(-hw, hw), rng.range(-hl, hl), rng.range(0, TAU), rng.range(8, 34), R, R * rng.range(0.04, 0.09) * (rng.chance(0.4) ? -0.8 : 1), rng.range(-0.3, 0.3)); }
  cr(-hw + 12, 9, 0.012, 2 * hw - 60, 5, 0.3); cr(-18, -hl + 10, HP - 0.01, 2 * hl - 20, 5, 0.26);        // ironed-in folds from the linen cupboard
  // seams on three sides: short puckers running in from the edge
  for (let x = -hw + 12; x < hw - 40; x += rng.range(6, 11)) for (const s of [-1, 1]) { const R = rng.range(2.5, 4.5); cr(x, s * (hl - 2), -s * HP + rng.range(-0.35, 0.35), rng.range(8, 24), R, R * rng.range(0.05, 0.085)); }
  for (let y = -hl + 12; y < hl - 12; y += rng.range(6, 11)) { const R = rng.range(2.5, 4.5); cr(-hw + 2, y, rng.range(-0.35, 0.35), rng.range(8, 24), R, R * rng.range(0.05, 0.085)); }
  // the open end: a 3 cm hem, stitched; the stitching gathers the cloth into puckers on both sides of the line
  const hx = hw - PIL.HEM * 1000;
  for (let y = -hl + 6; y < hl - 6; y += rng.range(4.5, 8.5)) {
    let R = rng.range(2.5, 4); cr(hx, y, rng.range(-0.25, 0.25), rng.range(8, 20), R, R * rng.range(0.05, 0.09));
    R = rng.range(3, 5); cr(hx, y + rng.range(-3, 3), Math.PI + rng.range(-0.3, 0.3), rng.range(10, 30), R, R * rng.range(0.05, 0.09));
  }
  const xs = X(hx), xf = X(hw - 170);
  for (let y = 0; y < H; y++) {
    const dash = 0.5 + 0.5 * Math.cos((TAU * (y / py)) / 2.8), o = y * W;
    for (let x = Math.floor(xf) - 6; x < W; x++) {
      const d = (x - xs) / px, e = Math.exp(-d * d / 0.3);                         // mm from the stitch line
      F[o + x] += 0.13 * smoothstep(-1.2, 1.2, (x - xf) / px) + 0.16 * smoothstep(-0.6, 0.6, d) - 0.28 * e + 0.2 * dash * dash * e * e * e;
    }
  }
  const tex = dataTex(normalCavity(F, W, H, px, false), W, H, { wrap: false });
  // coarse folds for the mesh (2.5 mm cells, metres)
  const gw = 261, gh = 173, T = 400, G = new Float32Array(gw * gh), r2 = new RNG(6211);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const base = Math.atan2(-sy * 0.215, -sx * 0.325);
    for (let i = r2.int(3, 4); i > 0; i--) { const R = r2.range(0.034, 0.052); crease(G, gw, gh, false, (sx * 0.285 + 0.325 + r2.range(-0.012, 0.012)) * T, (sy * 0.18 + 0.215 + r2.range(-0.012, 0.012)) * T, base + r2.range(-0.65, 0.65), r2.range(0.1, 0.24) * T, R * T, R * r2.range(0.14, 0.24), r2.range(-0.25, 0.25)); }
  }
  for (let i = 0; i < 5; i++) { const R = r2.range(0.03, 0.045), a = r2.range(0, TAU); crease(G, gw, gh, false, (0.325 + Math.cos(a) * 0.07) * T, (0.215 + Math.sin(a) * 0.05) * T, a + r2.range(-0.4, 0.4), r2.range(0.08, 0.16) * T, R * T, R * r2.range(0.06, 0.1) * (r2.chance(0.3) ? -0.7 : 1), r2.range(-0.25, 0.25)); }
  return { tex, at: (x, z) => bil(G, gw, gh, (x + 0.325) * T, (z + 0.215) * T) };
}

/** Cream cotton with a scattered slate-blue sprig print, a little washed out. Tile = PRINT_TILE metres. */
const PRINT_TILE = 0.74;
function printTexture() {
  const S = 2048, U = S / (PRINT_TILE * 1000);          // px per mm
  const cv = makeCanvas(S, S), c = cv.getContext('2d');
  const GROUND = 'rgb(233,228,217)';
  c.fillStyle = GROUND; c.fillRect(0, 0, S, S);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const rng = new RNG(4411), G = 15, cell = S / G, sprigs = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) sprigs.push({ x: (i + 0.5 + rng.range(-0.34, 0.34)) * cell, y: (j + 0.5 + rng.range(-0.34, 0.34)) * cell, a: rng.range(0, TAU), seed: rng.int(1, 2147483000) });
  const leaf = (r, x, y, ang, len, ink) => {
    const wid = len * r.range(0.2, 0.27);
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.42, -wid * 1.9, len, 0); c.quadraticCurveTo(len * 0.5, wid * 1.9, 0, 0); c.closePath();
    c.fillStyle = ink; c.fill();
    c.strokeStyle = 'rgba(233,228,217,0.55)'; c.lineWidth = 0.35 * U; c.beginPath(); c.moveTo(len * 0.12, 0); c.lineTo(len * 0.8, 0); c.stroke();
    c.restore();
  };
  const flower = (r, x, y, rad, ink, dark) => {
    const n = 5, a0 = r.range(0, TAU);
    c.fillStyle = ink;
    for (let k = 0; k < n; k++) { const a = a0 + (k * TAU) / n; c.beginPath(); c.ellipse(x + Math.cos(a) * rad * 0.62, y + Math.sin(a) * rad * 0.62, rad * 0.55, rad * 0.4, a, 0, TAU); c.fill(); }
    c.fillStyle = dark; c.beginPath(); c.arc(x, y, rad * 0.26, 0, TAU); c.fill();
  };
  const draw = (r) => {
    // washed ink: each sprig took the dye a little differently
    const tone = r.range(-9, 9), al = r.range(0.6, 0.84), ink = `rgba(${118 + tone},${131 + tone},${151 + tone},${al.toFixed(2)})`, soft = `rgba(${140 + tone},${152 + tone},${170 + tone},${(al * 0.85).toFixed(2)})`, dark = `rgba(${90 + tone},${102 + tone},${124 + tone},${(al + 0.08).toFixed(2)})`;
    const L = r.range(25, 41) * U, bend = r.range(-0.36, 0.36) * L, x1 = L * 0.5, y1 = bend, x2 = L, y2 = bend * r.range(-0.2, 0.5);
    const pt = (t) => [2 * (1 - t) * t * x1 + t * t * x2, 2 * (1 - t) * t * y1 + t * t * y2];
    const tg = (t) => Math.atan2(2 * (1 - 2 * t) * y1 + 2 * t * y2, 2 * (1 - 2 * t) * x1 + 2 * t * x2);
    c.strokeStyle = ink; c.lineWidth = r.range(0.5, 0.75) * U;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(x1, y1, x2, y2); c.stroke();
    const n = r.int(4, 7); let side = r.sign();
    for (let k = 0; k < n; k++) {
      const t = 0.1 + (0.8 * k) / (n - 1) + r.range(-0.03, 0.03), [x, y] = pt(t), a = tg(t);
      leaf(r, x, y, a + side * r.range(0.55, 1.0), lerp(8, 5, t) * r.range(0.85, 1.15) * U, r.chance(0.25) ? soft : ink);
      if (r.chance(0.3)) leaf(r, x, y, a - side * r.range(0.6, 1.0), lerp(6.2, 4, t) * U, soft);
      side = -side;
    }
    const [ex, ey] = pt(1);
    if (r.chance(0.6)) flower(r, ex + Math.cos(tg(1)) * 1.9 * U, ey + Math.sin(tg(1)) * 1.9 * U, r.range(1.9, 2.5) * U, soft, dark);
    else leaf(r, ex, ey, tg(1) + r.range(-0.2, 0.2), r.range(5.5, 7.5) * U, ink);
    // a side twig carrying berries or a small flower
    const nt = r.int(0, 2);
    for (let k = 0; k < nt; k++) {
      const t = r.range(0.25, 0.6), [x, y] = pt(t), a = tg(t) + r.sign() * r.range(0.7, 1.15), l = r.range(7, 12) * U;
      const bx = x + Math.cos(a) * l, by = y + Math.sin(a) * l, mx = x + Math.cos(a - 0.25) * l * 0.55, my = y + Math.sin(a - 0.25) * l * 0.55;
      c.strokeStyle = ink; c.lineWidth = 0.5 * U; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
      if (r.chance(0.5)) flower(r, bx, by, r.range(1.5, 2.0) * U, soft, dark);
      else for (let b = 0; b < 3; b++) { const ba = a + (b - 1) * 0.8, bl = r.range(1.7, 2.7) * U; c.fillStyle = b === 1 ? dark : ink; c.beginPath(); c.arc(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl, r.range(0.8, 1.15) * U, 0, TAU); c.fill(); }
    }
  };
  // tiny fillers between the sprigs: a pair of leaves or a few dots
  const filler = (r) => {
    const tone = r.range(-8, 8), ink = `rgba(${126 + tone},${139 + tone},${159 + tone},0.68)`;
    if (r.chance(0.5)) { leaf(r, 0, 0, 0.5, r.range(4.5, 6.5) * U, ink); leaf(r, 0, 0, -0.6, r.range(3.8, 5.5) * U, ink); }
    else for (let b = 0; b < 3; b++) { c.fillStyle = ink; c.beginPath(); c.arc(r.range(-3, 3) * U, r.range(-3, 3) * U, r.range(0.7, 1.1) * U, 0, TAU); c.fill(); }
  };
  for (let k = 0; k < 150; k++) sprigs.push({ x: rng.range(0, S), y: rng.range(0, S), a: rng.range(0, TAU), seed: rng.int(1, 2147483000), small: true });
  for (const sp of sprigs) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const px = sp.x + ox * S, py = sp.y + oy * S, m = 80 * U;
    if (px < -m || px > S + m || py < -m || py > S + m) continue;
    c.save(); c.translate(px, py); c.rotate(sp.a); (sp.small ? filler : draw)(new RNG(sp.seed)); c.restore();
  }
  const sm = makeCanvas(64, 64), sc2 = sm.getContext('2d');   // average colour for the bounce light, from a downscaled copy
  sc2.drawImage(cv, 0, 0, 64, 64);
  const avg = avgColor(sc2.getImageData(0, 0, 64, 64).data);
  return { tex: canvasTex(cv, { srgb: true, repeat: [1 / PRINT_TILE, 1 / PRINT_TILE] }), avg };
}

// ---- cable knit: one repeat is 14 stitches x 8 rows: purl 2 | rope cable 6 | purl 2 | knit rib 4
const KN = { SW: 0.0115, RH: 0.0082, COLS: 14, ROWS: 8, W: 1024, H: 512 };      // chunky yarn: stitches 11.5 mm wide
const K_ASP = KN.RH / KN.SW;
let capT = 0, capS = 0;
function cap(px, py, ax, ay, bx, by, r) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  let t = (wx * vx + wy * vy) / (vx * vx + vy * vy); t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = wx - vx * t, dy = wy - vy * t, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return 0;
  capT = t; capS = (dx * vy - dy * vx) > 0 ? Math.sqrt(d2) / r : -Math.sqrt(d2) / r;
  return Math.sqrt(1 - d2 / (r * r));
}
/** Stockinette: a column of nested V stitches. fx across the stitch 0..1, y in rows. Height in stitch widths. */
function vst(fx, y) {
  const r0 = Math.floor(y), fy = y - r0, k0 = fy < 0.26 ? -1 : 0, k1 = fy > 0.37 ? 1 : 0; let h = 0;
  for (let k = k0; k <= k1; k++) {
    const yy = (y - (r0 + k)) * K_ASP;
    for (let s = 0; s < 2; s++) {
      const c = cap(fx, yy, s ? 0.56 : 0.44, -0.32 * K_ASP, s ? 0.85 : 0.15, 0.95 * K_ASP, 0.205);
      if (c > 0) {
        const env = 0.62 + 0.38 * Math.sin(Math.PI * capT), ply = 1 + 0.07 * Math.sin(TAU * (capT * 3.3 + capS * 0.34 * (s ? 1 : -1)));
        const v = 0.205 * c * env * ply; if (v > h) h = v;
      }
    }
  }
  return h;
}
/** Reverse stockinette: rows of interlocking purl bumps. x in stitches (continuous), y in rows. */
function pst(x, y) {
  const r0 = Math.floor(y), fx = x - Math.floor(x), dA = fx - 0.5, dB = fx - Math.round(fx); let h = 0;
  for (let k = -1; k <= 1; k++) {
    const yy = y - (r0 + k);
    let ex = Math.max(Math.abs(dA) - 0.33, 0), ey = (yy - (0.3 + 0.11 * (1 - dA * dA * 6.25))) * K_ASP, d2 = (ex * ex + ey * ey) / (0.195 * 0.195);
    if (d2 < 1) h = Math.max(h, 0.19 * Math.sqrt(1 - d2) * (1 + 0.07 * Math.sin(TAU * dA * 5.2)));
    ex = Math.max(Math.abs(dB) - 0.31, 0); ey = (yy - (0.81 - 0.1 * (1 - dB * dB * 6.25))) * K_ASP; d2 = (ex * ex + ey * ey) / (0.185 * 0.185);
    if (d2 < 1) h = Math.max(h, 0.165 * Math.sqrt(1 - d2) * (1 + 0.07 * Math.sin(TAU * dB * 5.2)));
  }
  return h;
}
let kYarn = 0;
function knitH(su, sv) {
  if (su < 2 || (su >= 8 && su < 10)) { const p = pst(su, sv); kYarn = 0.06 + 0.8 * p; return 0.05 + p; }
  if (su >= 10) { const x = su - 10; kYarn = vst(x - Math.floor(x), sv); return 0.17 + 0.07 * Math.sin((Math.PI * x) / 4) + kYarn; }
  const xc = su - 2, ph = clamp((sv - 2) / 4), S = ph * ph * (3 - 2 * ph), bell = Math.sin(Math.PI * ph);
  let best = -1, by = 0;
  for (let o = 0; o < 2; o++) {   // o = 0: the strand crossing over (left to right), 1: the one passing under
    const xl = xc - (o ? 4.5 - 3 * S : 1.5 + 3 * S) + 1.5;
    if (xl < 0 || xl >= 3) continue;
    const v = vst(xl - Math.floor(xl), sv), e = (xl - 1.5) / 1.56, hh = 0.36 + 0.3 * Math.sqrt(Math.max(0, 1 - e * e)) + (o ? -0.2 : 0.27) * bell + v;
    if (hh > best) { best = hh; by = v; }
  }
  if (best < 0) { const p = pst(su, sv); kYarn = 0.06 + 0.8 * p; return 0.05 + p; }
  kYarn = by; return best;
}
function knitTextures() {
  const { W, H, COLS, ROWS, SW } = KN, n = W * H;
  const Ht = new Float32Array(n), Yn = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; Ht[i] = knitH(((x + 0.5) / W) * COLS, ((y + 0.5) / H) * ROWS); Yn[i] = kYarn; }
  // relief down to the single stitch goes into real geometry (vertex displacement); plies and fibres into the normal map
  let low = boxBlurWrap(Ht, W, H, 10, 12); low = boxBlurWrap(low, W, H, 10, 12);
  const fine = new Float32Array(n), col = new Uint8Array(n * 4), base = [0.7, 0.672, 0.632];      // undyed oatmeal grey
  let ar = 0, ag = 0, ab = 0;
  for (let i = 0; i < n; i++) {
    const x = i % W, y = (i / W) | 0;
    const fuzz = (hash2(x, y, 91) - 0.5) * 0.02 + (hash2(x >> 2, y >> 1, 92) - 0.5) * 0.02;
    fine[i] = (Ht[i] - low[i] + fuzz) * SW * 1000;       // mm
    const cav = smoothstep(0.0, 0.12, Yn[i]), deep = smoothstep(0.05, 0.75, Ht[i]);
    // heathered wool: light and dark fibres spun together, the odd dark or pale fleck
    const hz = (hash2(x >> 3, y >> 1, 94) - 0.5) * 0.1 + (pn((x / W) * 28, (y / H) * 56, 95, 28, 56) - 0.5) * 0.13, fleck = hash2(x >> 2, y >> 3, 96);
    const k = (0.74 + 0.26 * cav) * (0.84 + 0.16 * deep) * (1 + (hash2(x >> 1, y, 93) - 0.5) * 0.07 + hz) * (fleck > 0.985 ? 0.72 : fleck > 0.965 ? 1.09 : 1);
    const r = clamp(base[0] * k * (1 + 0.1 * hz)), g = clamp(base[1] * k), b = clamp(base[2] * k * (1 - 0.14 * hz));
    col[i * 4] = r * 255; col[i * 4 + 1] = g * 255; col[i * 4 + 2] = b * 255; col[i * 4 + 3] = 255;
    ar += Math.pow(r, 2.2); ag += Math.pow(g, 2.2); ab += Math.pow(b, 2.2);
  }
  const tw = COLS * SW, th = ROWS * KN.RH, rep = [1 / tw, 1 / th];
  const LW = 512, LH = 256, lowS = new Float32Array(LW * LH); let lmin = 1e9;
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const v = low[y * 2 * W + x * 2]; lowS[y * LW + x] = v; if (v < lmin) lmin = v; }
  const lowAt = (u, v) => {   // metres of outward displacement at a UV (metres)
    let fu = (u / tw) * LW - 0.5, fv = (v / th) * LH - 0.5; const iu = Math.floor(fu), iv = Math.floor(fv); fu -= iu; fv -= iv;
    const x0 = mod(iu, LW), x1 = (x0 + 1) % LW, y0 = mod(iv, LH), y1 = (y0 + 1) % LH;
    return (lerp(lerp(lowS[y0 * LW + x0], lowS[y0 * LW + x1], fu), lerp(lowS[y1 * LW + x0], lowS[y1 * LW + x1], fu), fv) - lmin) * SW;
  };
  return {
    map: dataTex(col, W, H, { srgb: true, repeat: rep }),
    normalMap: dataTex(normalFromHeight(fine, W, H, W / (tw * 1000), H / (th * 1000)), W, H, { repeat: rep }),
    avg: [ar / n, ag / n, ab / n], lowAt,
  };
}

/** Oak for the bed: glued-up staves 10 cm wide, each cut from a different part of a log (its own ring pattern
 *  and tone), open pores, hairline glue joints. Tile = OAK_U m along the grain (u) x OAK_V m across. Tiles. */
const OAK_U = 1.6, OAK_V = 0.8;
function oakMaps() {
  const W = 768, Hh = 512, NST = 8, n = W * Hh, col = new Uint8Array(n * 4), Ht = new Float32Array(n), rg = new Uint8Array(n * 4), rng = new RNG(8817), st = [];
  for (let s = 0; s < NST; s++) st.push({ c0: rng.range(-0.05, 0.15), b: rng.range(0.015, 0.08), tone: rng.range(-0.032, 0.032), warm: rng.range(-1, 1), ox: rng.range(0, 40), rw: rng.range(0.0032, 0.0058), ph: rng.range(0, TAU) });
  const base = [0.85, 0.765, 0.635]; let ar = 0, ag = 0, ab = 0;
  for (let y = 0; y < Hh; y++) {
    const sv = (y / Hh) * NST, si = Math.floor(sv), t = (sv - si) * 0.1, S = st[si], et = Math.min(t, 0.1 - t), joint = et < 0.0016 ? 1 - et / 0.0016 : 0;
    for (let x = 0; x < W; x++) {
      const u = x / W, i = y * W + x;
      const w1 = pn(u * 5 + S.ox, t * 26 + si * 3.7, 51, 5, 0), fa = pn(u * 9 + S.ox, t * 640 + si * 11.3, 52, 9, 0), fb = pn(u * 150 + S.ox, t * 640 + si * 5.1, 53, 150, 0);
      // growth rings: distance from the pith of a log lying slightly askew to the board
      const bb = S.b + 0.012 * Math.sin(TAU * u + S.ph), r = Math.sqrt((t - S.c0) * (t - S.c0) + bb * bb) + (w1 - 0.5) * 0.014 + (fa - 0.5) * 0.0015;
      const p = r / S.rw, f = p - Math.floor(p), dr = (f < 0.14 ? f / 0.14 : 1) * (1 - smoothstep(0.18, 0.8, f)), pore = dr * (0.4 + fb);
      const gq = (fa - 0.5) * 0.11 + (fb - 0.5) * 0.06 + (w1 - 0.5) * 0.07 - pore * 0.17, dk = gq < 0 ? -gq : 0;
      const L = (1 + S.tone) * (1 + gq) * (1 - 0.3 * joint);
      const cr = clamp(base[0] * L * (1 + 0.012 * S.warm)), cg = clamp(base[1] * L * (1 - 0.1 * dk)), cb = clamp(base[2] * L * (1 - 0.26 * dk - 0.03 * S.warm));
      col[i * 4] = cr * 255; col[i * 4 + 1] = cg * 255; col[i * 4 + 2] = cb * 255; col[i * 4 + 3] = 255;
      Ht[i] = -0.3 * joint - 0.07 * pore - 0.03 * (1 - fb);                                 // mm
      rg[i * 4] = 255; rg[i * 4 + 1] = clamp(0.47 + pore * 0.09 + (0.5 - fb) * 0.07 + joint * 0.25 + (w1 - 0.5) * 0.1) * 255; rg[i * 4 + 2] = 255; rg[i * 4 + 3] = 255;   // matt lacquer, duller in the pores
      ar += Math.pow(cr, 2.2); ag += Math.pow(cg, 2.2); ab += Math.pow(cb, 2.2);
    }
  }
  return { map: dataTex(col, W, Hh, { srgb: true }), normalMap: dataTex(normalFromHeight(Ht, W, Hh, W / (OAK_U * 1000), Hh / (OAK_V * 1000)), W, Hh, {}), roughnessMap: dataTex(rg, W, Hh, {}), avg: [ar / n, ag / n, ab / n] };
}

/** The paperback's wrap-around cover (back | spine | front), 270 x 197 mm at 4 px/mm. Title and author are invented. */
function bookCover() {
  const Wc = 1080, Hc = 788, cv = makeCanvas(Wc, Hc), c = cv.getContext('2d'), s0 = 512, s1 = 568, fx = s1 + 256, rng = new RNG(9931);
  c.fillStyle = '#a8614a'; c.fillRect(0, 0, Wc, Hc);
  c.save(); c.beginPath(); c.rect(s1, 0, Wc - s1, Hc); c.clip();                       // front: a pale sun going down behind two hills
  c.fillStyle = '#ead9bd'; c.beginPath(); c.arc(fx, 430, 118, 0, TAU); c.fill();
  c.fillStyle = '#7d4433'; c.beginPath(); c.moveTo(s1, 520); c.bezierCurveTo(s1 + 120, 430, s1 + 260, 470, s1 + 330, 520); c.bezierCurveTo(s1 + 400, 560, s1 + 470, 500, Wc, 480); c.lineTo(Wc, Hc); c.lineTo(s1, Hc); c.closePath(); c.fill();
  c.fillStyle = '#5e3327'; c.beginPath(); c.moveTo(s1, 640); c.bezierCurveTo(s1 + 150, 560, s1 + 300, 640, Wc, 590); c.lineTo(Wc, Hc); c.lineTo(s1, Hc); c.closePath(); c.fill();
  c.fillStyle = '#f1e6d2'; c.textAlign = 'center'; c.font = '600 60px Georgia, "Times New Roman", serif'; c.fillText('SMALL', fx, 148); c.fillText('HOURS', fx, 216);
  c.font = 'italic 26px Georgia, "Times New Roman", serif'; c.fillText('a novel', fx, 262);
  c.font = '500 30px Georgia, "Times New Roman", serif'; c.fillText('IDA MARLOW', fx, 736);
  c.restore();
  c.fillStyle = '#96553f'; c.fillRect(s0, 0, s1 - s0, Hc);                              // spine
  c.save(); c.translate((s0 + s1) / 2, Hc / 2); c.rotate(HP); c.fillStyle = '#f1e6d2'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '600 30px Georgia, "Times New Roman", serif'; c.fillText('SMALL HOURS', -130, 0); c.font = '500 21px Georgia, "Times New Roman", serif'; c.fillText('IDA MARLOW', 210, 0); c.restore();
  // back: the blurb and a barcode box
  const blurb = ['It is four in the morning and the house is not asleep.', 'Upstairs a window has been left open; somewhere below, a kettle is filled and put back down. Over one long night, three people who have run out of things to say to each other find that the dark is easier to talk to.', 'A quiet, exact and unexpectedly funny book about the hours nobody plans to be awake for.'];
  c.fillStyle = 'rgba(241,230,210,0.9)'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  let ty = 150;
  for (let p = 0; p < blurb.length; p++) {
    c.font = (p === 0 ? 'italic 21px' : '16px') + ' Georgia, "Times New Roman", serif';
    const words = blurb[p].split(' '), max = p === 0 ? 36 : 47; let line = '';
    for (const w of words) { if ((line + ' ' + w).length > max) { c.fillText(line, 72, ty); ty += p === 0 ? 30 : 23; line = w; } else line = line ? line + ' ' + w : w; }
    c.fillText(line, 72, ty); ty += 44;
  }
  c.fillStyle = '#f4efe6'; c.fillRect(322, 646, 122, 80); c.fillStyle = '#2a2624'; for (let i = 0; i < 31; i++) c.fillRect(330 + i * 3.4, 653, rng.pick([1, 1, 2, 2.6]), 52);
  c.font = '11px Arial, sans-serif'; c.fillText('9 780000 000002', 338, 719);
  // wear: white stress lines along both hinges, rubbed corners and edges
  c.strokeStyle = 'rgba(246,238,226,0.5)'; c.lineWidth = 1.4;
  for (const x of [s0 - 6, s0 + 3, s1 - 3, s1 + 7, s1 + 19]) { c.beginPath(); c.moveTo(x + rng.range(-1, 1), rng.range(0, 60)); c.lineTo(x + rng.range(-1.5, 1.5), Hc - rng.range(0, 80)); c.stroke(); }
  c.fillStyle = 'rgba(244,236,222,0.55)';
  for (const [x, y] of [[0, 0], [Wc, 0], [0, Hc], [Wc, Hc]]) { c.beginPath(); c.arc(x, y, rng.range(10, 20), 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(244,236,222,0.3)'; c.fillRect(0, 0, Wc, 3); c.fillRect(0, Hc - 3, Wc, 3); c.fillRect(0, 0, 3, Hc); c.fillRect(Wc - 3, 0, 3, Hc);
  return canvasTex(cv, { srgb: true });
}
/** The duvet cover's care label: white satin ribbon with a few lines of small print and wash symbols. */
function careLabel() {
  const cv = makeCanvas(96, 144), c = cv.getContext('2d');
  c.fillStyle = '#eeece6'; c.fillRect(0, 0, 96, 144);
  c.fillStyle = 'rgba(70,74,84,0.85)'; c.textAlign = 'center';
  c.font = 'bold 10px Arial, sans-serif'; c.fillText('100% COTTON', 48, 52);
  c.font = '8px Arial, sans-serif'; c.fillText('140 x 200 cm', 48, 66); c.fillText('wash before use', 48, 100); c.fillText('do not bleach', 48, 111);
  c.strokeStyle = 'rgba(70,74,84,0.85)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(14, 76); c.lineTo(18, 88); c.lineTo(30, 88); c.lineTo(34, 76); c.stroke();      // wash tub
  c.beginPath(); c.moveTo(42, 88); c.lineTo(49, 75); c.lineTo(56, 88); c.closePath(); c.stroke();         // bleach triangle
  c.strokeRect(64, 76, 12, 12); c.beginPath(); c.arc(70, 82, 4.5, 0, TAU); c.stroke();                    // tumble dry
  c.fillStyle = 'rgba(70,74,84,0.4)'; c.fillRect(8, 124, 80, 1.5);
  return canvasTex(cv, { srgb: true });
}

// ---------------------------------------------------------------- materials
/** Cotton: on top of the wrinkle normal map, a much finer one (the weave), a cavity term from the wrinkle map's
 *  alpha (creases a little darker, crests lighter), thread-level shading and a slow warm/cool drift. */
function detailPatch(tex, rep, str, cav, tint, shade) {
  return (shader) => {
    shader.uniforms.uDetN = { value: tex }; shader.uniforms.uDetRep = { value: new THREE.Vector2(rep[0], rep[1]) }; shader.uniforms.uDetStr = { value: str };
    shader.uniforms.uCav = { value: cav }; shader.uniforms.uTint = { value: new THREE.Vector3(tint[0], tint[1], tint[2]) }; shader.uniforms.uShade = { value: shade };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetN; uniform vec2 uDetRep; uniform float uDetStr; uniform float uCav; uniform vec3 uTint; uniform float uShade;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	#ifdef USE_NORMALMAP_TANGENTSPACE
	{
		vec3 dN = texture2D( uDetN, vNormalMapUv * uDetRep ).xyz * 2.0 - 1.0;
		normal = normalize( normal + ( tbn[0] * dN.x + tbn[1] * dN.y ) * uDetStr );
		float bedCav = min( texture2D( normalMap, vNormalMapUv ).a * 2.0 - 1.0, 0.0 );
		// the baked light's own normal-map term can more than double the brightness of a flank that tips towards the
		// window on a backlit slope; cloth shows such wrinkles as soft shadow, not as glowing veins: cap the gain
		if ( dot( vGd, vGd ) > 1e-6 ) {
			float bedF = clamp( ( 1.0 + giK * dot( normal, vGd ) ) / max( 0.3, 1.0 + giK * dot( nonPerturbedNormal, vGd ) ), 0.0, 2.5 );
			diffuseColor.rgb *= min( 1.0, 1.1 / max( bedF, 0.001 ) );
		}
		float bedMv = sin( vGiW.x * 6.3 + sin( vGiW.z * 4.7 ) * 1.9 ) * sin( vGiW.z * 5.9 + vGiW.x * 2.3 + 1.3 );
		// the room's light comes from the window: wrinkle flanks turned towards it are lighter, those turned away darker
		float bedSh = dot( normal - nonPerturbedNormal, normalize( ( viewMatrix * vec4( 0.2, 0.32, -0.93, 0.0 ) ).xyz ) );
		diffuseColor.rgb *= clamp( 1.0 + uShade * bedSh, 0.6, 1.1 ) * ( 1.0 + uCav * bedCav ) * ( 1.0 - 0.9 * uDetStr * dot( dN.xy, dN.xy ) ) * mix( vec3( 1.0 ), uTint, 0.5 + 0.5 * bedMv );
	}
	#endif`);
  };
}
function makeMats() {
  const tm = [performance.now()], lap = (v) => { tm.push(performance.now()); return v; };
  const wr = lap(cottonWrinkles()), weave = weaveNormal(0.25, 2.0, 96), print = lap(printTexture()), knit = lap(knitTextures()), pil = lap(pillowFields()), oak = lap(oakMaps());
  const lin = (v) => Math.pow(v, 2.2), M = { pillowFold: pil.at, times: tm.slice(1).map((t, i) => Math.round(t - tm[i])).join('/') };
  const tile = (rot) => { const t = wr.clone(); t.repeat.set(1 / WR_TILE, 1 / WR_TILE); t.rotation = rot; t.needsUpdate = true; return t; };
  const caseMap = (flip) => { const t = pil.tex.clone(); t.repeat.set(1 / (2 * PIL.hw), (flip ? -1 : 1) / (2 * PIL.hl)); t.offset.set(0, flip ? 1 : 0); t.needsUpdate = true; return t; };
  const pilDet = [(2 * PIL.hw) / WEAVE, (2 * PIL.hl) / WEAVE];
  const cotton = ({ color = sc(1, 1, 1), map = null, albedo, nmap, wrScale = 0.9, rough = 0.9, sheen = 0.35, weaveStr = 0.3, cav = 0.3, shade = 0.7, det = [WR_TILE / WEAVE, WR_TILE / WEAVE], tint = [1, 1, 1] }) => {
    const p = { color, roughness: rough, normalMap: nmap, normalScale: new THREE.Vector2(wrScale, wrScale), sheen, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 1, 1) };
    if (map) p.map = map;
    return pbr(p, { phys: true, key: 'bedcotton4', onCompile: detailPatch(weave, det, weaveStr, cav, tint, shade), bake: { albedo } });
  };
  // the set is not one white: cream cover and pillowcase, a cooler bleached fitted sheet
  M.duvet = cotton({ map: print.tex, albedo: print.avg, nmap: tile(0.4), wrScale: 1.1, cav: 0.32, shade: 0.75, tint: [0.982, 0.99, 1.0] });
  M.sheet = cotton({ color: sc(0.868, 0.884, 0.9), albedo: [lin(0.868), lin(0.884), lin(0.9)], nmap: tile(1.15), wrScale: 0.9, cav: 0.25, shade: 0.6, sheen: 0.42, tint: [0.99, 0.995, 1.0] });
  M.pillowA = cotton({ color: sc(0.905, 0.89, 0.86), albedo: [lin(0.905), lin(0.89), lin(0.86)], nmap: caseMap(true), wrScale: 1.1, cav: 0.3, shade: 0.75, det: pilDet, tint: [1.0, 0.99, 0.975] });
  M.pillowB = cotton({ map: print.tex, albedo: print.avg, nmap: caseMap(false), wrScale: 1.1, cav: 0.3, shade: 0.75, det: pilDet, tint: [0.985, 0.99, 1.0] });
  M.knit = pbr({ map: knit.map, normalMap: knit.normalMap, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 1, sheen: 0.8, sheenRoughness: 0.8, sheenColor: sc(0.8, 0.78, 0.74) }, {
    phys: true, key: 'bedknit2', bake: { albedo: knit.avg },
    onCompile: (shader) => {    // the yarn is not dyed evenly along its length
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	{ float bedHv = sin( vGiW.x * 31.0 + sin( vGiW.z * 23.0 ) * 2.1 ) * sin( vGiW.z * 37.0 + vGiW.y * 43.0 + 0.7 ); diffuseColor.rgb *= 1.0 + 0.06 * bedHv; }`);
    },
  });
  M.knitLow = knit.lowAt;
  M.wood = pbr({ map: oak.map, normalMap: oak.normalMap, roughnessMap: oak.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(0.7, 0.7), vertexColors: true }, { bake: { albedo: oak.avg } });
  // teddy fleece: a tiling field of small round tufts (about 8 mm) with fine fibre noise on top
  const furN = dataTex(normalFromHeight(field(256, 256, (u, v) => {
    const f1 = worley2(u * 18, v * 18, 77, 18)[0];
    return 2.6 * Math.sqrt(Math.max(0, 1 - (f1 / 0.66) * (f1 / 0.66))) + 0.5 * pn(u * 90, v * 90, 78, 90, 90);
  }), 256, 256, 1.7, 1.7), 256, 256, { repeat: [6, 3] });
  M.plush = pbr({ color: sc(0.91, 0.88, 0.81), roughness: 1, normalMap: furN, normalScale: new THREE.Vector2(1.3, 1.3), sheen: 1, sheenRoughness: 0.85, sheenColor: sc(1, 0.97, 0.9) }, { phys: true, key: 'bedplush' });
  // small things
  M.button = pbr({ color: sc(0.9, 0.885, 0.85), roughness: 0.32 });
  M.dark = pbr({ color: sc(0.035, 0.035, 0.04), roughness: 0.6 });
  M.steel = pbr({ color: sc(0.62, 0.62, 0.63), roughness: 0.4, metalness: 1 });
  const edgeN = dataTex(normalFromHeight(field(4, 256, (u, v, x, y) => hash2(3, y, 17) * 0.6 + hash2(5, y >> 2, 18) * 0.6), 4, 256, 0, 1.4), 4, 256, { repeat: [1, 1 / 0.012] });
  M.paper = pbr({ color: sc(0.93, 0.905, 0.84), roughness: 0.9, normalMap: edgeN, normalScale: new THREE.Vector2(1, 1) });
  M.cover = pbr({ map: bookCover(), roughness: 0.42, side: THREE.DoubleSide }, { bake: { albedo: [0.36, 0.12, 0.07] } });
  M.label = pbr({ map: careLabel(), roughness: 0.45, side: THREE.DoubleSide }, { bake: { albedo: [0.82, 0.81, 0.78] } });
  M.tie = pbr({ color: sc(0.1, 0.1, 0.115), roughness: 0.95 });
  M.phone = pbr({ color: sc(0.37, 0.43, 0.41), roughness: 0.36 });
  M.lens = pbr({ color: sc(0.02, 0.02, 0.025), roughness: 0.08 });
  return M;
}

// ---------------------------------------------------------------- frame
/** A board with the grain along axis `grain`. Bevels are worn (lacquer rubbed thin: paler), feet scuffed. */
function woodBox(x, y, z, w, h, d, grain, voff, opts) {
  const g = boxAt(x, y, z, w, h, d, opts), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const P = [p.getX(i), p.getY(i), p.getZ(i)], N = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))];
    const na = N[0] > N[1] ? (N[0] > N[2] ? 0 : 2) : N[1] > N[2] ? 1 : 2;
    let ua = grain, va;
    if (na === grain) { ua = (grain + 1) % 3; va = (grain + 2) % 3; } else va = 3 - grain - na;
    uv.setXY(i, P[ua] / OAK_U + voff * 0.37, P[va] / OAK_V + voff);
    const edge = 1 - smoothstep(0.86, 0.995, Math.max(N[0], N[1], N[2]));
    const wear = edge * smoothstep(0.28, 0.7, pn(P[0] * 23 + P[1] * 17 + 1.3, P[2] * 23 - P[1] * 11 + 4.7, 181)) * (0.55 + 0.45 * smoothstep(0.3, 0.9, P[1]));
    const tone = 1 + 0.05 * (pn(P[0] * 2.1 + P[1] * 2.7, P[2] * 2.1 + P[1] * 1.3, 182) - 0.5) - 0.07 * (1 - smoothstep(0.0, 0.04, P[1]));
    col[i * 3] = tone * (1 + 0.16 * wear); col[i * 3 + 1] = tone * (1 + 0.15 * wear); col[i * 3 + 2] = tone * (1 + 0.13 * wear);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function buildFrame(g, M) {
  const o = { r: 0.004, rs: 2, maxEdge: 0.05 };
  const parts = [
    woodBox(0.1, 0.16, 1.9, 0.025, 0.2, 2.0595, 2, 0.02, o),            // side rails run the whole length...
    woodBox(1.555, 0.16, 1.9, 0.025, 0.2, 2.0595, 2, 0.31, o),
    woodBox(0.1258, 0.16, 1.9, 1.4284, 0.2, 0.025, 0, 0.57, o),         // ...the foot rail is butted in between them (hairline joints)
    woodBox(0.1, 0.1, 3.96, 1.48, 0.85, 0.024, 0, 0.0, { r: 0.007, rs: 3, maxEdge: 0.045 }),   // headboard
  ];
  for (const [lx, lz] of [[0.1, 1.9], [1.53, 1.9], [0.1, 3.912], [1.53, 3.912]]) parts.push(woodBox(lx, 0, lz, 0.05, 0.1594, 0.05, 1, 0.75, { r: 0.004, rs: 2, maxEdge: 0.06 }));
  g.add(mesh(merge(parts), M.wood, 'frame'));
  // slatted base, simplified to one board: keeps light from leaking up through the mattress
  g.add(mesh(woodBox(0.125, 0.272, 1.925, 1.43, 0.028, 2.035, 2, 0.4, { r: 0.002, rs: 1, maxEdge: 0.12 }), M.wood, 'slats'));
  // connector bolts through the side rail into the end of the foot rail
  const heads = [], sockets = [];
  for (const y of [0.215, 0.305]) {
    heads.push(lathe([[0.0072, 0], [0.0068, 0.0009], [0.0052, 0.0016], [0.00001, 0.0016]], 20).rotateZ(-HP).translate(1.58, y, 1.9125));
    sockets.push(new THREE.CylinderGeometry(0.0027, 0.0027, 0.0003, 6).translate(0, 0.00165, 0).rotateZ(-HP).translate(1.58, y, 1.9125));
  }
  g.add(mesh(merge(heads), M.steel, 'bolts'), mesh(merge(sockets), M.dark, 'boltSockets'));
}

// ---------------------------------------------------------------- mattress + fitted sheet
function buildMattress(g, M) {
  const w = MX1 - MX0, d = MZ1 - MZ0, R = 0.05;
  const geo = roundedBox(w, MH, d, { r: R, rs: 5, maxEdge: 0.021, skip: ['ny'] }).translate((MX0 + MX1) / 2, TOP - MH / 2, (MZ0 + MZ1) / 2);
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    const side = Math.hypot(nx, nz), hv = clamp((y - (TOP - MH)) / MH);
    // elastic pulls the sheet tight: the sides bow out a little and gather into vertical tension folds,
    // strongest round the corners where the elastic bunches the cloth
    const corner = Math.min(1, 2 * Math.abs(nx * nz)), tens = side * (ridge(pn((x + z) * 14, y * 3, 62)) ** 2) * (0.0025 + 0.004 * corner) * hv;
    const off = 0.004 * Math.sin(Math.PI * hv) * side + (fbm2(x * 9 + y * 5, z * 9 - y * 5, { oct: 3, seed: 61 }) - 0.5) * 0.003 * (1 - 0.5 * Math.max(0, ny)) + tens;
    x += nx * off; z += nz * off; y += ny * off - sagAt(x, z) * Math.max(0, ny);
    p.setXYZ(i, x, y, z);
  }
  g.add(mesh(geo, M.sheet, 'mattress'));
  // piping seam under the sheet, running round the top edge
  const k = R * (1 - Math.SQRT1_2), x0 = MX0 + k, x1 = MX1 - k, z0 = MZ0 + k, z1 = MZ1 - k, rc = R - k, y = TOP - k + 0.0012, pts = [];
  const arc = (cx, cz, a0) => { for (let s = 0; s <= 6; s++) { const a = a0 + (s / 6) * HP; pts.push(new THREE.Vector3(cx + Math.cos(a) * rc, y, cz + Math.sin(a) * rc)); } };
  const line = (ax, az, bx, bz, m) => { for (let s = 1; s < m; s++) pts.push(new THREE.Vector3(lerp(ax, bx, s / m), y - sagAt(lerp(ax, bx, s / m), lerp(az, bz, s / m)) * 0.3, lerp(az, bz, s / m))); };
  arc(x1 - rc, z1 - rc, 0); line(x1 - rc, z1, x0 + rc, z1, 14); arc(x0 + rc, z1 - rc, HP); line(x0, z1 - rc, x0, z0 + rc, 20);
  arc(x0 + rc, z0 + rc, Math.PI); line(x0 + rc, z0, x1 - rc, z0, 14); arc(x1 - rc, z0 + rc, Math.PI * 1.5); line(x1, z0 + rc, x1, z1 - rc, 20);
  g.add(mesh(tube(null, 0.0042, { curve: new THREE.CatmullRomCurve3(pts, true, 'centripetal'), tubular: 260, radial: 6, cap: false }), M.sheet, 'piping'));
}

// ---------------------------------------------------------------- pillows
function pillowGeo(S, fold) {
  const { hw, hl } = PIL, { T, seed, dent, tilt, bend, yaw, hs = 0.026, flip = 1 } = S;
  const NU = 104, NV = 72, W1 = NU + 1, n = W1 * (NV + 1);
  const top = new Float32Array(n * 3), bot = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  // slump: the pillow bends about its width axis (lies flat at the front, leans on the headboard at the back)
  const NC = 64, cZ = new Float32Array(NC + 1), cY = new Float32Array(NC + 1), cA = new Float32Array(NC + 1);
  for (let k = 0; k <= NC; k++) {
    cA[k] = tilt * smoothstep(bend[0], bend[1], -1 + (2 * k) / NC);
    if (k > 0) { const am = (cA[k] + cA[k - 1]) / 2, ds = (2 * hl) / NC; cZ[k] = cZ[k - 1] + Math.cos(am) * ds; cY[k] = cY[k - 1] + Math.sin(am) * ds; }
  }
  const zMid = cZ[NC / 2], cy = Math.cos(yaw), sy = Math.sin(yaw);
  const put = (X, y, Z, arr, k) => {
    const f = clamp((Z / hl + 1) / 2) * NC, i0 = Math.min(NC - 1, Math.floor(f)), t = f - i0;
    const a = lerp(cA[i0], cA[i0 + 1], t), zz = lerp(cZ[i0], cZ[i0 + 1], t) - zMid - y * Math.sin(a), yy = lerp(cY[i0], cY[i0 + 1], t) + y * Math.cos(a);
    arr[k * 3] = X * cy + zz * sy; arr[k * 3 + 1] = yy; arr[k * 3 + 2] = -X * sy + zz * cy;
  };
  // the seam's height above the mattress; the open end (+x) is an empty, flat hem band that droops and ripples
  const seamH = (u, v, X) => { const open = smoothstep(hw - 0.08, hw - 0.006, X); return hs * (0.8 + 0.5 * pn(u * 2.3 + seed, v * 2.3 + 1.7, seed + 5)) * (1 - 0.8 * open) + 0.0035 * open * (1 + Math.sin(v * 7 + seed)); };
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const tu = -1 + (2 * i) / NU, tv = -1 + (2 * j) / NV, u = Math.sin(tu * HP), v = Math.sin(tv * HP), pu = Math.cos(tu * HP), pv = Math.cos(tv * HP), k = j * W1 + i;
    const X = hw * u * (1 - 0.085 * pv * pv), Z = hl * v * (1 - 0.105 * pu * pu);            // the filling pulls the sides in: the corners stick out
    const pp = Math.max(0, pu * pv) * (1 - smoothstep(hw - 0.074, hw - PIL.HEM, X));        // the filling stops short of the hem
    const dx = X - dent[0] * hw, dz = Z - dent[1] * hl, rr = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    const puff = Math.pow(pp, 0.8) * (1 - dent[3] * Math.exp(-(rr * rr) / (dent[2] * dent[2])));
    const radial = 0.007 * ridge(pn((ang / TAU) * 14 + 7, rr * 5 + seed, seed + 3, 14, 0)) ** 2 * smoothstep(0.03, 0.11, rr) * (1 - smoothstep(0.2, 0.34, rr));
    const wr = 0.006 * bill(pn(X * 6 + seed, Z * 8 + 3.1, seed + 1)) + 0.003 * bill(pn(X * 13 + 1.7, Z * 15 + seed, seed + 2)) + radial + fold(X, Z * flip);
    const sh = seamH(u, v, X);
    put(X, sh + T * puff + wr * Math.sqrt(pp), Z, top, k);
    put(X, sh * (1 - Math.min(1, 1.5 * Math.pow(pp, 0.6))), Z, bot, k);
    uv[k * 2] = X + hw; uv[k * 2 + 1] = Z + hl;
  }
  const geo = merge([gridGeo(top, uv, NU, NV), gridGeo(bot, uv, NU, NV, { flip: true, stride: 2 })]);
  // settle it: lowest point just into the mattress, back against the headboard (or at S.z)
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(S.x, TOP - 0.006 - bb.min.y, S.backAt !== undefined ? S.backAt - bb.max.z : S.z);
  geo.computeBoundingBox();
  return geo;
}
function buildPillows(g, M) {
  const a = pillowGeo({ T: 0.112, seed: 301, dent: [0.1, -0.05, 0.13, 0.34], tilt: 0.16, bend: [-0.3, 0.9], yaw: 0.07, x: 0.49, backAt: 3.945, flip: -1 }, M.pillowFold);
  const b = pillowGeo({ T: 0.118, seed: 317, dent: [-0.1, 0.0, 0.17, 0.32], tilt: 0.9, bend: [-0.8, 0.3], yaw: -0.09, x: 1.175, backAt: 3.952 }, M.pillowFold);
  g.add(mesh(a, M.pillowA, 'pillowA'), mesh(b, M.pillowB, 'pillowB'));
  return b.boundingBox.min.z;      // where the leaning pillow's front edge is (the phone lies in front of it)
}

// ---------------------------------------------------------------- duvet
const DV_T = 0.05;
const DC = { c00: [0.21, 2.02], c10: [1.84, 2.0], c01: [0.2, 3.42], c11: [1.7, 3.45] };   // flat outline: foot-left, foot-right, head-left, head-right
const DV_EDGE = (() => {
  const mk = (a, b) => { let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const l = Math.hypot(nx, nz); nx /= l; nz /= l; let c = -(nx * a[0] + nz * a[1]); if (nx * 1.0 + nz * 2.7 + c < 0) { nx = -nx; nz = -nz; c = -c; } return [nx, nz, c]; };
  return [mk(DC.c00, DC.c01), mk(DC.c10, DC.c11), mk(DC.c00, DC.c10), mk(DC.c01, DC.c11)];
})();
/** Distance from the duvet's hem (positive inside), with rounded corners. */
function dvEdge(x, z) {
  const E = DV_EDGE, a = Math.min(E[0][0] * x + E[0][1] * z + E[0][2], E[1][0] * x + E[1][1] * z + E[1][2]), b = Math.min(E[2][0] * x + E[2][1] * z + E[2][2], E[3][0] * x + E[3][1] * z + E[3][2]), R = 0.07;
  return a < R && b < R ? R - Math.hypot(R - a, R - b) : Math.min(a, b);
}
// the turned-back corner: everything past this line is folded over towards the foot-left
const FL0 = [1.33, 3.14], FN = [0.6, 0.8], FT = [-0.8, 0.6];
function foldQ(x, z) { const dx = x - FL0[0], dz = z - FL0[1], tau = dx * FT[0] + dz * FT[1]; return dx * FN[0] + dz * FN[1] + 0.02 * Math.sin(tau * 5.2 + 0.8) + 0.008 * Math.sin(tau * 13 + 2); }
// How bunched-up the duvet is: 1 = piled into tall rolls, ~0.3 = an ordinary slept-in duvet lying fairly flat.
const LOBE_SCALE = 0.3;
const LOBES = [
  [0.88, 2.6, 0.34, 0.17, 12, 0.185],     // the big bunch: a tall roll lying across the bed...
  [0.8, 2.93, 0.3, 0.13, 20, 0.142],      // ...a lower one pushed up against it (a deep crease between them)
  [0.62, 2.5, 0.3, 0.165, -25, 0.118],    // ...and its shoulder towards the wall
  [0.36, 2.76, 0.52, 0.2, 97, 0.095],     // pushed up against the wall
  [0.7, 2.24, 0.42, 0.22, 8, 0.072],      // foot
  [0.47, 3.18, 0.34, 0.2, -18, 0.078],    // head, left
  [1.0, 3.14, 0.33, 0.19, 24, 0.06],      // head, middle
  [1.34, 2.46, 0.42, 0.32, 80, 0.06],     // bunched up under the throw
  [1.2, 2.9, 0.28, 0.18, -35, 0.03],      // under the turned-back corner
  [1.1, 2.26, 0.27, 0.16, -20, 0.05],
].map(([cx, cz, a, b, deg, h]) => ({ cx, cz, ia: 1 / a, ib: 1 / b, c: Math.cos((deg * Math.PI) / 180), s: Math.sin((deg * Math.PI) / 180), h: h * LOBE_SCALE }));
/** Where the cloth is held calm: under the throw (tm), under the turned-back flap (fm), under the book (bk). */
const CALM = { tm: 0, fm: 0, bk: 0 };
function calmAt(x, z) {
  const tm = smoothstep(1.1, 1.24, x) * smoothstep(2.05, 2.16, z) * (1 - smoothstep(2.66, 2.78, z));
  const q = foldQ(x, z), tau = (x - FL0[0]) * FT[0] + (z - FL0[1]) * FT[1];
  const fm = smoothstep(-0.46, -0.33, q) * (1 - smoothstep(0.0, 0.05, q)) * smoothstep(-0.6, -0.48, tau) * (1 - smoothstep(0.48, 0.58, tau));
  const bx = (x - BOOK.x) / 0.13, bz = (z - BOOK.z) / 0.13, b2 = bx * bx + bz * bz, bk = Math.exp(-b2 * b2);
  CALM.tm = tm; CALM.fm = fm; CALM.bk = bk;
  return (1 - 0.8 * tm) * (1 - 0.7 * fm) * (1 - 0.92 * bk);
}
/** Designed height of the duvet's top above its support: lobes and long pillowy folds (no creases yet). */
function dvBase(x, z) {
  const w1 = pn(x * 2.6 + 3.1, z * 2.6 + 1.7, 101) - 0.5, w2 = pn(x * 2.6 + 9.4, z * 2.6 + 5.2, 102) - 0.5;
  const wx = x + w1 * 0.1, wz = z + w2 * 0.1;
  const hang = smoothstep(P0 - 0.05, P0 + 0.09, x), calm = calmAt(x, z), fm = CALM.fm;
  let M = 0;
  for (let i = 0; i < LOBES.length; i++) {
    const L = LOBES[i], dx = wx - L.cx, dz = wz - L.cz, u = (dx * L.c + dz * L.s) * L.ia, v = (-dx * L.s + dz * L.c) * L.ib, r2 = u * u + v * v;
    if (r2 >= 1) continue;
    // a tall bunch is really a few rolls pressed together: sharp grooves along its length, uneven height
    const sub = L.h > 0.09 ? 0.8 + 0.3 * bill(pn(u * 0.9 + i * 7.1 + w1 * 1.6, v * 1.7 + i * 3.7 + w2 * 1.3, 160 + i)) : 1;
    M = smax(M, L.h * (1 - r2 * Math.sqrt(r2)) * Math.pow(1 - r2, 0.35) * sub, 0.009);   // a roll: broad rounded top, steep sides (not a cone)
  }
  // long pillowy folds: A runs with the big bunch (diagonal), B along the bed near its sides, C across it near the foot
  const ua = wx * 0.766 - wz * 0.643, va = wx * 0.643 + wz * 0.766;
  const bA = Math.abs(2 * pn(ua / 0.6 + 1.3, va / 0.118 + 0.4, 111) - 1), bB = Math.abs(2 * pn(wz / 0.62 + 4.2, wx / 0.125 + 2.2, 113) - 1), bC = Math.abs(2 * pn(wx / 0.58 + 8.8, wz / 0.12 + 3.3, 115) - 1);
  const fA = 1 - (1 - bA) * (1 - bA) + 0.4 * bill(pn(ua / 0.24 + va * 1.1, va / 0.057 + 7.7, 112));
  const fB = 1 - (1 - bB) * (1 - bB) + 0.4 * bill(pn(wz / 0.25 + 1.9, wx / 0.06 + wz * 1.3, 114));
  const fC = 1 - (1 - bC) * (1 - bC) + 0.4 * bill(pn(wx / 0.24 + 5.1, wz / 0.058 + wx * 0.9, 116));
  const wB = Math.max(smoothstep(0.62, 0.3, x), smoothstep(1.22, 1.46, x) * (1 - hang)), wC = smoothstep(2.6, 2.22, z) * (1 - wB * 0.6), wA = clamp(1 - 0.75 * wB - 0.75 * wC);
  const folds = wA * 0.042 * fA + wB * 0.03 * fB + wC * 0.032 * fC;
  // where it hangs over the side: broad vertical flutes that open towards the hem
  let fl = 0;
  if (x > P0) { const gh = x - P0; fl = 0.05 * smoothstep(0.04, 0.3, gh) * bill(pn(z / 0.2 + 0.35 * Math.sin(z * 9 + gh * 3), gh * 1.4 + 0.3, 121)); }
  const am = (0.6 + 0.75 * pn(x * 1.7 + 11.3, z * 1.7 + 0.9, 117)) * (1 + 1.3 * M);   // bunched-up cloth is also the most folded
  let H = DV_T * (0.92 + 0.3 * pn(x * 3.1 + 2.7, z * 3.1 + 8.1, 118) * (1 - fm)) + M * (1 - 0.9 * hang) * (1 - 0.8 * fm) * (1 - 0.9 * CALM.bk) + folds * am * (1 - hang) * calm + fl - 0.007 * CALM.bk;
  if (H > 0.23) H = 0.23 + 0.035 * Math.tanh((H - 0.23) / 0.035);
  return H;
}
/** The duvet's height field, precomputed: B = the designed shape with its tops rounded off (5 mm cells),
 *  C = creases as real relief (2.5 mm cells). */
const DF = { x0: 0.13, z0: 1.93, h: 0.005, nx: 361, nz: 321, B: null, h2: 0.0025, nx2: 721, nz2: 641, C: null };
function buildDuvetField() {
  const { x0, z0, h, nx, nz, h2, nx2, nz2 } = DF, B = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) B[j * nx + i] = dvBase(x0 + i * h, z0 + j * h);
  // filled cloth has no peaks: nothing may stand more than about a centimetre above its surroundings. Valleys stay sharp.
  let bl = boxBlurClamp(B, nx, nz, 5); bl = boxBlurClamp(bl, nx, nz, 5);
  for (let k = 0; k < B.length; k++) B[k] = -smax(-B[k], -(bl[k] + 0.012), 0.012);
  DF.B = B;
  const C = new Float32Array(nx2 * nz2), rng = new RNG(5521), T = 1 / h2, cx = (x) => (x - x0) * T, cz = (z) => (z - z0) * T;
  const one = (x, z, a, L, amp = 1) => { const R = rng.range(0.024, 0.04); crease(C, nx2, nz2, false, cx(x), cz(z), a, L * T, R * T, R * rng.range(0.16, 0.3) * amp, rng.range(-0.3, 0.3)); };
  // tension fans out of the places where the cloth is pinched or pulled
  const fan = (x, z, dir, spread, n, lmin, lmax) => { for (let i = 0; i < n; i++) one(x + rng.range(-0.02, 0.02), z + rng.range(-0.02, 0.02), dir + rng.range(-spread, spread), rng.range(lmin, lmax)); };
  fan(1.2, 2.68, 0.2, 0.9, 7, 0.12, 0.3);             // head end of the big roll
  fan(0.56, 2.52, Math.PI + 0.2, 0.8, 6, 0.1, 0.26);  // its other end
  fan(0.6, 2.77, 0.28, 0.25, 4, 0.14, 0.34);          // along the crease between the two rolls
  fan(1.47, 3.2, Math.PI, 0.7, 6, 0.1, 0.28);         // pulled over the edge of the bed
  fan(0.35, 3.33, -1.2, 0.8, 5, 0.1, 0.24);           // tucked against the cushion
  fan(0.3, 2.12, 0.9, 0.6, 5, 0.1, 0.26); fan(1.42, 2.1, 2.2, 0.6, 4, 0.1, 0.24);   // foot corners
  for (const t of [-0.3, 0, 0.3]) fan(FL0[0] + FT[0] * t - FN[0] * 0.07, FL0[1] + FT[1] * t - FN[1] * 0.07, Math.atan2(-FN[1], -FN[0]), 0.6, 3, 0.08, 0.2);   // away from the turned-back corner
  // everywhere else: single creases and bundles, roughly following the local pull
  for (let k = 0; k < 200; k++) {
    const x = rng.range(0.2, 1.62), z = rng.range(2.0, 3.45), base = 7.5 * pn(x * 1.3 + 5.3, z * 1.3 + 2.9, 171) + (rng.chance(0.25) ? HP : 0), n = rng.int(1, 3), sp = rng.range(0.025, 0.055), neg = rng.chance(0.3) ? -0.8 : 1;
    for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * sp; one(x - Math.sin(base) * off + rng.range(-0.03, 0.03), z + Math.cos(base) * off + rng.range(-0.03, 0.03), base + rng.range(-0.15, 0.15), rng.range(0.06, 0.24), neg); }
  }
  for (let j = 0; j < nz2; j++) for (let i = 0; i < nx2; i++) {
    const x = x0 + i * h2, z = z0 + j * h2, k = j * nx2 + i;
    if (C[k] === 0) continue;
    C[k] *= calmAt(x, z) * (1 - smoothstep(P0 - 0.05, P0 + 0.09, x)) * (0.35 + 0.65 * smoothstep(0.02, 0.09, dvEdge(x, z))) * (0.7 + 0.6 * pn(x * 2.3 + 1.1, z * 2.3 + 7.7, 172));
  }
  DF.C = C;
  // The paperback presses the cloth flat under itself: fit a plane to the duvet under the book's two resting edges
  // (least squares; the sample layout is symmetric so the terms separate), sink it in, cap the cloth to it.
  const cyb = Math.cos(BOOK.yaw), syb = Math.sin(BOOK.yaw), S = [];
  for (const lx of [-0.128, 0.128]) for (const lz of [-0.09, -0.045, 0, 0.045, 0.09]) S.push([lx, lz, dvH(BOOK.x + lx * cyb + lz * syb, BOOK.z - lx * syb + lz * cyb)]);
  let pa = 0, pb = 0, pc = 0, sxx = 0, szz = 0;
  for (const [lx, lz, e] of S) { pa += e / S.length; pb += e * lx; pc += e * lz; sxx += lx * lx; szz += lz * lz; }
  pb /= sxx; pc /= szz;
  const res = S.map(([lx, lz, e]) => e - (pa + pb * lx + pc * lz)).sort((p, q) => p - q);
  pa += res[3] - 0.001;          // most of the cloth under the edges stood higher than this: it gets pressed down
  DF.book = { a: pa, b: pb, c: pc };
  const under = (x, z) => { const dx = x - BOOK.x, dz = z - BOOK.z, lx = dx * cyb - dz * syb, lz = dx * syb + dz * cyb; CALM.lx = lx; CALM.lz = lz; return (1 - smoothstep(0.135, 0.165, Math.abs(lx))) * (1 - smoothstep(0.1, 0.13, Math.abs(lz))); };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const m = under(x0 + i * h, z0 + j * h), k = j * nx + i;
    if (m <= 0) continue;
    const cap = pa + pb * CALM.lx + pc * CALM.lz + 0.026 * Math.max(0, 1 - Math.abs(CALM.lx) / 0.135) - 0.0005;      // there is room under the tent of the open book
    if (B[k] > cap) B[k] = lerp(B[k], cap, m);
  }
  for (let j = 0; j < nz2; j++) for (let i = 0; i < nx2; i++) { const m = under(x0 + i * h2, z0 + j * h2); if (m > 0) C[j * nx2 + i] *= 1 - 0.95 * m; }
}
/** Height of the duvet's top above its support, before the hem taper. */
function dvH(x, z) {
  return cubicAt(DF.B, DF.nx, DF.nz, (x - DF.x0) / DF.h, (z - DF.z0) / DF.h) + bil(DF.C, DF.nx2, DF.nz2, (x - DF.x0) / DF.h2, (z - DF.z0) / DF.h2);
}
// The hem: the cover's two layers lie flat on each other for BAND metres, sewn through along the inside of that
// band (a groove, the cloth puckered along it); only inside the stitching does the filling lift the cloth.
const HEM = 0.0036, BAND = 0.016;
const hemProf = (ed) => Math.pow(prof(ed - BAND, 0.07), 1.25);
function hemElev(H, ed, x, z) {
  if (ed > BAND + 0.07) return H;
  const pr = hemProf(ed), u = (ed - BAND) / 0.0024;
  const lip = HEM + 0.0035 * pn(x * 31 + 2.2, z * 31 + 7.9, 157) * smoothstep(-0.002, 0.012, ed);     // the flat band is a little wavy
  const puck = 0.0022 * (pn(x * 55 + 1.3, z * 55 + 4.1, 158) - 0.5) * Math.exp(-Math.abs(ed - BAND) / 0.014) * smoothstep(0, BAND, ed);
  return Math.max(0.0024, H * pr + lip * (1 - pr) + puck - 0.0011 * Math.exp(-u * u));
}
/** Elevation of the duvet's upper side at a flat position (unfolded part). */
function dvElev(x, z) { return hemElev(dvH(x, z), dvEdge(x, z), x, z); }
// The cover closes at the foot with a row of buttons; between them the two layers gape.
const BTN_X = [0.34, 0.575, 0.81, 1.045, 1.28, 1.515, 1.75], GAPE = [0.004, 0.012, 0.007, 0.002, 0.002, 0.002];
function footGape(x, z) {
  const E = DV_EDGE[2], d = E[0] * x + E[1] * z + E[2];
  if (d > 0.05 || x <= BTN_X[0] || x >= BTN_X[6]) return 0;
  let k = 0; while (x > BTN_X[k + 1]) k++;
  const s = Math.sin((Math.PI * (x - BTN_X[k])) / (BTN_X[k + 1] - BTN_X[k]));
  return GAPE[k] * s * s * (1 - smoothstep(0.0, 0.045, d));
}
const flapT = (x, z) => 0.05 + 0.02 * bill(pn(x / 0.17 + 3.3, z / 0.17 + 9.1, 151)) + 0.009 * bill(pn(x / 0.07 + 1.3, z / 0.07 + 4.4, 152));
// the whole sheet is nudged about in plan so hems and folds are never ruler-straight
const WARP = 0.022;
const warpX = (x, z) => WARP * (pn(x * 1.9 + 0.3, z * 1.9 + 4.1, 131) * 2 - 1), warpZ = (x, z) => WARP * (pn(x * 1.9 + 6.7, z * 1.9 + 2.9, 132) * 2 - 1);
/** Sheet position (mx, mz) at elevation e -> world. Tall folds lean over (by the height eRef of the duvet
 *  there), so lobes get a steep overhanging side and a gentle one instead of being symmetric bumps. */
const LEAN = 0.42;
function dvPlace(mx, mz, e, eRef, o) {
  let X = mx + warpX(mx, mz), Z = mz + warpZ(mx, mz);
  const amt = LEAN * Math.max(0, eRef - 0.055) * (1 - smoothstep(P0 - 0.16, P0 - 0.03, X));
  if (amt > 0) { const a = 3.7 + 2.6 * (pn(mx * 0.9 + 4.2, mz * 0.9 + 1.3, 133) - 0.5); X += Math.cos(a) * amt; Z += Math.sin(a) * amt; }
  drape(X, Z, e, o);
}
/** The duvet under a bed position X, Z: its sheet coordinates and elevation there (what the throw lies on). */
function duvetSupport(X, Z, o) {
  const mx = X - warpX(X, Z), mz = Z - warpZ(X, Z);
  o.mx = X - warpX(mx, mz); o.mz = Z - warpZ(mx, mz); o.e = Math.max(0, dvElev(o.mx, o.mz));
}

function buildDuvet(g, M) {
  const NS = 320, NT = 304, W1 = NS + 1, N = W1 * (NT + 1);
  const sA = zonedAxis(NS, 1.58, 0.19, 1.27, 0.0042, 0.0095), tA = zonedAxis(NT, 1.43, 0.4, 1.34, 0.0042, 0.0095);
  const A = new Float32Array(N * 3), B = new Float32Array(N * 3), U = new Float32Array(N * 3), uv = new Float32Array(N * 2), Q = new Float32Array(N), PX = new Float32Array(N);
  const o = { x: 0, y: 0, z: 0 }, { c00, c10, c01, c11 } = DC;
  const set = (arr, k) => { arr[k * 3] = o.x; arr[k * 3 + 1] = o.y; arr[k * 3 + 2] = o.z; };
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
    const a = sA[i], b = tA[j], k = j * W1 + i;
    const mx = lerp(lerp(c00[0], c10[0], a), lerp(c01[0], c11[0], a), b), mz = lerp(lerp(c00[1], c10[1], a), lerp(c01[1], c11[1], a), b);
    const ed = dvEdge(mx, mz), pr = hemProf(ed), E = hemElev(dvH(mx, mz), ed, mx, mz) + footGape(mx, mz), q = foldQ(mx, mz);
    uv[k * 2] = mx; uv[k * 2 + 1] = mz; Q[k] = q; PX[k] = mx + warpX(mx, mz);
    dvPlace(mx, mz, E, E, o); set(U, k);                   // unfolded shape: only used to measure the cloth for its UVs
    if (q <= 0) {
      set(A, k);
      dvPlace(mx, mz, Math.max(0.0012, (E - DV_T * pr - HEM) * smoothstep(0, -0.05, q)), E, o); set(B, k);   // underside (only built where it can be seen: the hanging hem)
    } else {
      // page curl: round a roll at the fold line, then lie back on top of the duvet
      const lx = mx - FN[0] * q, lz = mz - FN[1] * q, eL = Math.max(0, dvElev(lx, lz)), tf = Math.max(0.004, flapT(mx, mz) * prof(ed, 0.03));
      const Rr = Math.max(0.003, 0.5 * (eL + tf)), qr = 2.4 * Rr;
      let w, e, eRef = eL;
      if (q < qr) { const th = (Math.PI * q) / qr; w = Rr * Math.sin(th); e = Rr * (1 - Math.cos(th)); }
      else { w = -(q - qr); eRef = Math.max(0, dvElev(lx + FN[0] * w, lz + FN[1] * w)); e = eRef + tf; }
      dvPlace(lx + FN[0] * w, lz + FN[1] * w, e, eRef, o); set(B, k);
      const tq = Math.min(q, 0.03) * 0.6, ax = lx - FN[0] * tq, az = lz - FN[1] * tq, eA = Math.max(0, dvElev(ax, az));   // the upper side tucks into the crease, out of sight
      dvPlace(ax, az, eA - 0.001, eA, o); set(A, k);
    }
  }
  relaxUV(U, NS, NT, uv, [220, 80, 40, 18]);
  const cq = (i, j, f) => f(Q[j * W1 + i], Q[j * W1 + i + 1], Q[(j + 1) * W1 + i], Q[(j + 1) * W1 + i + 1]);
  const upper = gridGeo(A, uv, NS, NT, { mask: (i, j) => cq(i, j, Math.min) < 0.012 });
  const flap = gridGeo(B, uv, NS, NT, { flip: true, mask: (i, j) => cq(i, j, Math.max) > -0.012 });
  const hem = gridGeo(B, uv, NS, NT, { flip: true, stride: 2, mask: (i, j) => Math.max(Q[j * W1 + i], Q[j * W1 + i + 2], Q[(j + 2) * W1 + i], Q[(j + 2) * W1 + i + 2]) < -0.012 && Math.max(PX[j * W1 + i + 2], PX[(j + 2) * W1 + i + 2]) > P0 - 0.02 });
  // the turned seam all the way round the hem (it follows whichever side of the cloth is showing)
  const rim = [], pushRim = (k) => { const s = Q[k] <= 0 ? A : B; rim.push(new THREE.Vector3(s[k * 3], s[k * 3 + 1], s[k * 3 + 2])); };
  for (let i = 0; i < NS; i += 3) pushRim(i);
  for (let j = 0; j < NT; j += 3) pushRim(j * W1 + NS);
  for (let i = NS; i > 0; i -= 3) pushRim(NT * W1 + i);
  for (let j = NT; j > 0; j -= 3) pushRim(j * W1);
  const seamCurve = new THREE.CatmullRomCurve3(rim, true, 'centripetal'); seamCurve.arcLengthDivisions = 1400;
  const seam = tube(null, 0.0017, { curve: seamCurve, tubular: 900, radial: 5, cap: false });
  // foot closure: the cover's lower layer, seen in the gaps between the buttons
  const FD = [-0.004, 0.0, 0.007, 0.016, 0.028, 0.042], FJ = FD.length - 1, LP = new Float32Array(W1 * (FJ + 1) * 3), LUV = new Float32Array(W1 * (FJ + 1) * 2), E2 = DV_EDGE[2];
  for (let j = 0; j <= FJ; j++) for (let i = 0; i <= NS; i++) {
    const k = j * W1 + i, mx = lerp(c00[0], c10[0], sA[i]) + E2[0] * FD[j], mz = lerp(c00[1], c10[1], sA[i]) + E2[1] * FD[j];
    dvPlace(mx, mz, j === 0 ? 0.0012 : 0.0016, 0, o); LP[k * 3] = o.x; LP[k * 3 + 1] = o.y; LP[k * 3 + 2] = o.z; LUV[k * 2] = mx; LUV[k * 2 + 1] = mz;
  }
  g.add(mesh(merge([upper, flap, hem, seam, gridGeo(LP, LUV, NS, FJ)]), M.duvet, 'duvet'));
  // buttons, sewn through the hem band of the upper layer
  const discs = [], holes = [], Y = new THREE.Vector3(0, 1, 0), qt = new THREE.Quaternion(), P = new THREE.Vector3(), Pu = new THREE.Vector3(), Pv = new THREE.Vector3(), mat = new THREE.Matrix4();
  const top = (mx, mz, out) => { const e = dvElev(mx, mz) + footGape(mx, mz); dvPlace(mx, mz, e, e, o); out.set(o.x, o.y, o.z); };
  for (let b = 0; b < BTN_X.length; b++) {
    const a = (BTN_X[b] - c00[0]) / (c10[0] - c00[0]), mx = lerp(c00[0], c10[0], a) + E2[0] * 0.008, mz = lerp(c00[1], c10[1], a) + E2[1] * 0.008;
    top(mx, mz, P); top(mx + 0.004, mz, Pu); top(mx, mz + 0.004, Pv);
    const nrm = Pv.sub(P).cross(Pu.sub(P)).normalize();
    mat.compose(P.addScaledVector(nrm, 0.0003), qt.setFromUnitVectors(Y, nrm), new THREE.Vector3(1, 1, 1));
    discs.push(lathe([[0.0066, 0], [0.0066, 0.0014], [0.006, 0.002], [0.0052, 0.002], [0.0044, 0.0012], [0.00001, 0.0012]], 20).applyMatrix4(mat));
    for (const s of [-1, 1]) holes.push(new THREE.CircleGeometry(0.0008, 8).rotateX(-HP).translate(s * 0.0017, 0.00128, 0).rotateY(b * 1.3).applyMatrix4(mat));
  }
  g.add(mesh(merge(discs), M.button, 'buttons'), mesh(merge(holes), M.dark, 'buttonHoles'));
  // the care label, sewn into the foot seam and hanging out of the widest gap
  const lg = gridPlane(0.022, 0.034, 0.0045), luv = lg.attributes.uv;
  for (let i = 0; i < luv.count; i++) luv.setXY(i, luv.getX(i) / 0.022, luv.getY(i) / 0.034);
  lg.scale(1.2, 1.35, 1).rotateX(-HP);                      // 26 x 46 mm
  const lp = lg.attributes.position;
  for (let i = 0; i < lp.count; i++) { const t = clamp(-lp.getZ(i) / 0.023); lp.setY(i, 0.006 * t * t + 0.0012 * Math.sin(lp.getX(i) * 180 + 1)); }
  lg.computeVertexNormals();
  dvPlace(0.69, lerp(c00[1], c10[1], (0.69 - c00[0]) / (c10[0] - c00[0])), 0.0022, 0, o);
  g.add(mesh(lg.rotateY(0.22).translate(o.x, o.y, o.z - 0.017), M.label, 'careLabel'));
}

// ---------------------------------------------------------------- knit throw
function thLift(x, z) {
  const w1 = pn(x * 2.7 + 1.2, z * 2.7 + 2.4, 201) - 0.5, w2 = pn(x * 2.7 + 7.7, z * 2.7 + 4.1, 202) - 0.5, w3 = pn(x * 6.1 + 3.3, z * 6.1 + 0.4, 205) - 0.5;
  const r1 = Math.pow(0.5 - 0.5 * Math.cos(TAU * ((x * 0.9 + z * 0.44) / 0.2 + w1 * 2.6 + w3 * 0.5)), 0.62), A1 = 0.028 + 0.085 * smoothstep(0.25, 0.75, pn(x * 2.6 + 3.3, z * 2.6 + 9.9, 203));
  const r2 = Math.pow(0.5 - 0.5 * Math.cos(TAU * ((-x * 0.5 + z * 0.87) / 0.105 + w2 * 2.0)), 0.7), A2 = 0.042 * smoothstep(0.3, 0.8, pn(x * 3.4 + 1.1, z * 3.4 + 5.6, 204));
  const dx = (x - 1.44) / 0.2, dz = (z - 2.5) / 0.3, cx = (x - 1.5) / 0.16, cz = (z - 2.2) / 0.16;
  const h = 0.03 * Math.exp(-(dx * dx + dz * dz)) + A1 * r1 + A2 * r2;
  return 0.1 * Math.tanh(h / 0.1) * (1 - 0.45 * Math.exp(-(cx * cx + cz * cz)));
}
function buildThrow(g, M) {
  const NS = 200, NT = 256, W1 = NS + 1, N = W1 * (NT + 1), TT = 0.008;
  const sA = gradedAxis(NS, 0.55, [0.0011, 0.0016, 0.0022]), tA = gradedAxis(NT, 0.7, [0.0011, 0.0016, 0.0022]);
  const A = new Float32Array(N * 3), B = new Float32Array(N * 3), uv = new Float32Array(N * 2), PR = new Float32Array(N), o = { x: 0, y: 0, z: 0 }, sp = { mx: 0, mz: 0, e: 0 };
  const xl = (b) => 1.14 + 0.05 * b + 0.03 * Math.sin(b * 7 + 1) + 0.018 * Math.sin(b * 17 + 2), xr = (b) => 1.6 + 0.014 * Math.sin(b * 9 + 2) + 0.2 * Math.exp(-(((b - 0.38) / 0.2) ** 2));
  const zf = (a) => 2.1 - 0.05 * a + 0.025 * Math.sin(a * 8 + 0.5) + 0.012 * Math.sin(a * 19 + 1), zh = (a) => 2.74 - 0.05 * a + 0.03 * Math.sin(a * 6.5 + 2.2) + 0.014 * Math.sin(a * 15 + 0.3);
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
    // squircle the parameter square a little so the outline has soft corners
    const su = sA[i] * 2 - 1, sv = tA[j] * 2 - 1, a = 0.5 + 0.5 * su * Math.sqrt(1 - 0.3 * sv * sv * 0.5), b = 0.5 + 0.5 * sv * Math.sqrt(1 - 0.3 * su * su * 0.5), k = j * W1 + i;
    const x = lerp(xl(b), xr(b), a), z = lerp(zf(a), zh(a), b);
    const d = Math.min(Math.min(sA[i], 1 - sA[i]) * 0.55, Math.min(tA[j], 1 - tA[j]) * 0.7), pr = prof(d, 0.012);
    duvetSupport(x, z, sp);
    const lift = thLift(x, z) * (0.15 + 0.85 * smoothstep(0, 0.12, d));
    uv[k * 2] = x; uv[k * 2 + 1] = z; PR[k] = pr;
    dvPlace(sp.mx, sp.mz, sp.e + lift + TT * pr + 0.0008, sp.e, o); A[k * 3] = o.x; A[k * 3 + 1] = o.y; A[k * 3 + 2] = o.z;
    dvPlace(sp.mx, sp.mz, sp.e + Math.max(0.0006, lift - 0.0004), sp.e, o); B[k * 3] = o.x; B[k * 3 + 1] = o.y; B[k * 3 + 2] = o.z;
  }
  relaxUV(A, NS, NT, uv, [200, 60, 24, 10]);
  const up = gridGeo(A, uv, NS, NT);
  // cables, ribs and single stitches stand proud in real geometry; the plies of the yarn are left to the normal map
  const p = up.attributes.position, nr = up.attributes.normal, tu = up.attributes.uv, remap = up.userData.remap;
  for (let q = 0; q < N; q++) { const k = remap[q]; if (k < 0) continue; const h = M.knitLow(tu.getX(k), tu.getY(k)) * PR[q]; p.setXYZ(k, p.getX(k) + nr.getX(k) * h, p.getY(k) + nr.getY(k) * h, p.getZ(k) + nr.getZ(k) * h); }
  up.computeVertexNormals();
  const under = gridGeo(B, uv, NS, NT, { flip: true, stride: 4 });
  g.add(mesh(merge([up, under]), M.knit, 'throw'));
}

// ---------------------------------------------------------------- small fluffy cushion by the left pillow
function buildPlush(g, M) {
  const geo = new THREE.SphereGeometry(1, 56, 36), p = geo.attributes.position, R = [0.135, 0.08, 0.12];
  const rot = new THREE.Matrix4().makeRotationY(0.5), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // a round cushion: squarish in plan, lumpy, tufted
    const sq = 1 + 0.12 * Math.pow(Math.abs(x * z) * 2, 0.8);
    const r = sq * (1 + 0.16 * (fbm3(x * 1.9 + 3, y * 1.9, z * 1.9 + 7, { oct: 3, seed: 71 }) - 0.5) + 0.07 * (fbm3(x * 7, y * 7, z * 7, { oct: 2, seed: 72 }) - 0.5));
    if (y < 0) y *= 0.7;                                   // it sits, so the underside flattens
    v.set(x * R[0] * r, y * R[1] * r, z * R[2] * r).applyMatrix4(rot);
    p.setXYZ(i, v.x + 0.335, v.y + TOP + 0.06, v.z + 3.43);
  }
  geo.computeVertexNormals();
  // the sphere's u-seam has doubled vertices: give each pair the same normal
  const n = geo.attributes.normal, W = 57;
  for (let j = 0; j <= 36; j++) { const a = j * W, b = a + 56, nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b), l = Math.hypot(nx, ny, nz) || 1; n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l); }
  for (const j of [0, 36]) {                               // ...and the poles one normal each
    let sx = 0, sy = 0, sz = 0; for (let i = 0; i < W; i++) { sx += n.getX(j * W + i); sy += n.getY(j * W + i); sz += n.getZ(j * W + i); }
    const l = Math.hypot(sx, sy, sz) || 1; for (let i = 0; i < W; i++) n.setXYZ(j * W + i, sx / l, sy / l, sz / l);
  }
  g.add(mesh(geo, M.plush, 'plush'));
}

// ---------------------------------------------------------------- things left on the bed
/** A flat slab with rounded corners and a soft edge, lying in the xz plane on y = 0. */
function slab(w, d, r, thick, bevel) {
  const s = new THREE.Shape(), x = -w / 2 + bevel, y = -d / 2 + bevel, ww = w - 2 * bevel, dd = d - 2 * bevel, rr = r - bevel;
  s.moveTo(x + rr, y); s.lineTo(x + ww - rr, y); s.absarc(x + ww - rr, y + rr, rr, -HP, 0, false); s.lineTo(x + ww, y + dd - rr); s.absarc(x + ww - rr, y + dd - rr, rr, 0, HP, false);
  s.lineTo(x + rr, y + dd); s.absarc(x + rr, y + dd - rr, rr, HP, Math.PI, false); s.lineTo(x, y + rr); s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  let geo = new THREE.ExtrudeGeometry(s, { depth: thick - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-5); geo.computeVertexNormals();
  return geo.rotateX(-HP).translate(0, bevel, 0);
}
function buildProps(g, M, zPillow) {
  const o = { x: 0, y: 0, z: 0 };
  const onDuvet = (mx, mz, lift = 0) => { const e = dvElev(mx, mz); dvPlace(mx, mz, e + lift, e, o); return new THREE.Vector3(o.x, o.y, o.z); };

  // --- a paperback, open and face-down where it was put down last night
  const BW = 0.128, BH = 0.197, SP = 0.014, hsp = 0.0388, K = [0.268, 0.293], TP = [0.0105, 0.0072];     // two unequal halves: read a third of the way through
  const cyK = (s, k) => hsp - k * (s - 0.022 * (1 - Math.exp(-s / 0.022)));
  const half = (k, tp) => {
    const w = BW - 0.001, geo = roundedBox(w, tp, BH - 0.002, { r: 0.0005, rs: 1, maxEdge: 0.011 }), p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const s = p.getX(i) + w / 2, t = tp / 2 - p.getY(i), m = -k * (1 - Math.exp(-s / 0.022)), il = 1 / Math.sqrt(1 + m * m), nx = n.getX(i), ny = n.getY(i);
      p.setXY(i, SP / 2 + s + t * m * il, cyK(s, k) - t * il);
      n.setXY(i, nx * il - ny * m * il, nx * m * il + ny * il);
    }
    return geo;
  };
  const pages = merge([half(K[0], TP[0]), half(K[1], TP[1]).rotateY(Math.PI)]);
  const cover = surface((u, v, P) => {
    const qx = (u - 0.5) * (2 * BW + SP), s = Math.max(0, Math.abs(qx) - SP / 2);
    P.set(qx, cyK(s, qx > 0 ? K[0] : K[1]) + 0.0004, (0.5 - v) * BH);
  }, 48, 20);
  // it lies on the plane the duvet was pressed to (see buildDuvetField)
  const cy = Math.cos(BOOK.yaw), sy = Math.sin(BOOK.yaw), bp = DF.book;
  const at = (lx, lz) => { const e = bp.a + bp.b * lx + bp.c * lz; dvPlace(BOOK.x + lx * cy + lz * sy, BOOK.z - lx * sy + lz * cy, e, e, o); return new THREE.Vector3(o.x, o.y, o.z); };
  const org = at(0, 0), bx = at(0.1, 0).sub(org).normalize(), bn = at(0, 0.1).sub(org).cross(bx).normalize();
  if (bn.y < 0) bn.negate();
  const bz = bx.clone().cross(bn).normalize();
  const bm = new THREE.Matrix4().makeBasis(bx, bn, bz).setPosition(org);
  g.add(mesh(pages.applyMatrix4(bm), M.paper, 'bookPages'), mesh(cover.applyMatrix4(bm), M.cover, 'bookCover'));

  // --- a hair tie dropped on the duvet: a soft loop that follows the cloth
  const pts = [];
  for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU, r = 0.025 * (1 + 0.13 * Math.sin(2 * a + 0.7) + 0.06 * Math.sin(3 * a + 2.1)); pts.push(onDuvet(TIE.x + r * Math.cos(a), TIE.z + 0.92 * r * Math.sin(a), 0.0026)); }
  g.add(mesh(tube(null, 0.0023, { curve: new THREE.CatmullRomCurve3(pts, true, 'centripetal'), tubular: 120, radial: 8, cap: false }), M.tie, 'hairTie'));

  // --- a phone, face-down on the sheet between the duvet and the leaning pillow
  const z0 = 3.475, room = zPillow - z0;
  if (room > 0.06) {                     // (when it is tight the phone's far edge slips under the pillow's rim)
    const px = 1.13, pz = z0 + Math.min(room / 2, 0.075), rot = new THREE.Matrix4().makeRotationY(1.38).setPosition(px, TOP - sagAt(px, pz) + 0.0009, pz);
    const body = merge([slab(0.0715, 0.147, 0.0115, 0.0082, 0.0011), slab(0.03, 0.03, 0.0085, 0.0015, 0.0006).translate(-0.0145, 0.0082, -0.052)]);
    const lens = (x, z, r) => lathe([[r, 0], [r, 0.0006], [r * 0.82, 0.001], [0.00001, 0.001]], 18).translate(x, 0.0097, z);
    g.add(mesh(body.applyMatrix4(rot), M.phone, 'phone'), mesh(merge([lens(-0.021, -0.0585, 0.0056), lens(-0.008, -0.0455, 0.0056), lens(-0.0075, -0.0595, 0.0019)]).applyMatrix4(rot), M.lens, 'phoneLenses'));
  }
}

// ---------------------------------------------------------------- assemble
export function build(ctx) {
  const t0 = performance.now(), g = group('bed'), M = makeMats(), t1 = performance.now();
  buildFrame(g, M); buildMattress(g, M);
  const zPillow = buildPillows(g, M), t2 = performance.now();
  buildDuvetField(); buildDuvet(g, M);
  const t3 = performance.now();
  buildThrow(g, M); buildPlush(g, M); buildProps(g, M, zPillow);
  ctx.colliders.push({ min: [0.08, 0, 1.88], max: [1.7, 0.95, 4.0] });
  let tris = 0; g.traverse((m) => { if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
  const t4 = performance.now();
  console.log(`[boot] bed: ${Math.round(tris / 1000)}k tris, ${(t4 - t0).toFixed(0)} ms (textures ${(t1 - t0).toFixed(0)} = wrinkles/print+weave/knit/pillowcase/oak ${M.times}, frame+pillows ${(t2 - t1).toFixed(0)}, duvet ${(t3 - t2).toFixed(0)}, throw+props ${(t4 - t3).toFixed(0)})`);
  return g;
}
