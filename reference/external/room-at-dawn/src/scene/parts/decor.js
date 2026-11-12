// Room-level set dressing, so the wide shots read as a room somebody lives in: a rope laundry basket with a
// towel over its rim, a backpack slumped against the wall, sneakers kicked off by the door, a hook rail with a
// dressing gown and a scarf, a bin with crumpled paper under the desk, a string of (unlit) globe lights with
// photos pegged to it above the bed, a map print on the back wall, a rolled yoga mat on the wardrobe and a
// stack of books with yesterday's mug by the left wall. Everything is parametric and emitted in world space.
import * as THREE from 'three';
import { roundedBox, boxAt, gridPlane, tube, lathe, merge, mesh, group } from '../../core/geo.js';
import { makeCanvas, canvasTex, field, normalTex, avgColor } from '../../core/tex.js';
import { RNG, fbm2, fbm3, vnoise2, hash2, clamp, lerp, smoothstep } from '../../core/rng.js';
import { sc, pbr, fabric } from '../materials.js';

export const order = 70;
export const label = 'decor';

const PI = Math.PI, TAU = PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sp = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);
const SERIF = 'Georgia, "Times New Roman", serif', SANS = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
function M4(px, py, pz, ry = 0, rx = 0, rz = 0) {
  return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(px, py, pz);
}
function add(root, geo, mat, name, ud) { const o = mesh(geo, mat, name); if (ud) Object.assign(o.userData, ud); root.add(o); return o; }
const FLAT = { bakeOccluder: false };

// =====================================================================================================
// geometry helpers
// =====================================================================================================
function geoFrom(pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
/** Flip any triangle whose winding disagrees with its vertex normals. */
function orient(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const d = (uy * vz - uz * vy) * (n[a] + n[b] + n[c]) + (uz * vx - ux * vz) * (n[a + 1] + n[b + 1] + n[c + 1]) + (ux * vy - uy * vx) * (n[a + 2] + n[b + 2] + n[c + 2]);
    if (d < 0) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  return g;
}
/** Sample fn(u, v, out) on a (nu+1) x (nv+1) grid and give it smooth normals. o: closedU, from [x,y,z] (normals
 *  point away from that point) or face [x,y,z] (normals point that way), rows [j0, j1] used for that test. */
function sampleGrid(fn, nu, nv, o = {}) {
  const W = nu + 1, H = nv + 1, P = new Float32Array(W * H * 3), N = new Float32Array(W * H * 3), p = V3(), bad = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { fn(o.closedU && i === nu ? 0 : i / nu, j / nv, p); const k = (j * W + i) * 3; P[k] = p.x; P[k + 1] = p.y; P[k + 2] = p.z; }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let ia = i + 1, ib = i - 1;
    if (o.closedU) { if (ia > nu) ia = 1; if (ib < 0) ib = nu - 1; } else { if (ia > nu) ia = nu; if (ib < 0) ib = 0; }
    const a = (j * W + ia) * 3, b = (j * W + ib) * 3, c = (Math.min(nv, j + 1) * W + i) * 3, d = (Math.max(0, j - 1) * W + i) * 3, k = (j * W + i) * 3;
    const ux = P[a] - P[b], uy = P[a + 1] - P[b + 1], uz = P[a + 2] - P[b + 2], vx = P[c] - P[d], vy = P[c + 1] - P[d + 1], vz = P[c + 2] - P[d + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l > 1e-12) { N[k] = nx / l; N[k + 1] = ny / l; N[k + 2] = nz / l; } else bad.push(j * W + i);
  }
  for (const q of bad) {       // poles and pinched rows take the mean normal of the next row in
    const j = Math.floor(q / W), jj = j === 0 ? 1 : j === nv ? nv - 1 : j + 1; let x = 0, y = 0, z = 0;
    for (let i = 0; i < W; i++) { const k = (jj * W + i) * 3; x += N[k]; y += N[k + 1]; z += N[k + 2]; }
    const l = Math.hypot(x, y, z) || 1; N[q * 3] = x / l; N[q * 3 + 1] = y / l; N[q * 3 + 2] = z / l;
  }
  if (o.from || o.face) {
    let s = 0; const j0 = o.rows ? o.rows[0] : 0, j1 = o.rows ? o.rows[1] : nv;
    for (let j = j0; j <= j1; j++) for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 3;
      s += o.face ? N[k] * o.face[0] + N[k + 1] * o.face[1] + N[k + 2] * o.face[2] : N[k] * (P[k] - o.from[0]) + N[k + 1] * (P[k + 1] - o.from[1]) + N[k + 2] * (P[k + 2] - o.from[2]);
    }
    if (s < 0) for (let k = 0; k < N.length; k++) N[k] = -N[k];
  }
  return { W, H, P, N };
}
/** One skin through a sampled grid. uS / vS: size of the grid in metres (texture coordinates). */
function skin(G, uS = 1, vS = 1) {
  const { W, H, P, N } = G, uv = [], idx = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) uv.push((i / (W - 1)) * uS, (j / (H - 1)) * vS);
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W; idx.push(a, b, c, a, c, d); }
  return orient(geoFrom(P, N, uv, idx));
}
/** Cloth with real thickness: two skins th apart round the sampled mid-surface, a rolled hem on all four sides. */
function thick(G, th, uS = 1, vS = 1) {
  const { W, H, P, N } = G, h = th / 2, pos = [], nor = [], uv = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 3;
      pos.push(P[k] + N[k] * h * side, P[k + 1] + N[k + 1] * h * side, P[k + 2] + N[k + 2] * h * side);
      nor.push(N[k] * side, N[k + 1] * side, N[k + 2] * side); uv.push((i / (W - 1)) * uS, (j / (H - 1)) * vS);
    }
    for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) { const a = base + j * W + i, b = a + 1, c = a + W + 1, d = a + W; idx.push(a, b, c, a, c, d); }
  }
  const loop = [];
  for (let i = 0; i < W - 1; i++) loop.push([i, 0]);
  for (let j = 0; j < H - 1; j++) loop.push([W - 1, j]);
  for (let i = W - 1; i > 0; i--) loop.push([i, H - 1]);
  for (let j = H - 1; j > 0; j--) loop.push([0, j]);
  const RS = 3, R = RS + 1, base = pos.length / 3, Ln = loop.length;
  for (const [i, j] of loop) {
    const k = (j * W + i) * 3, q = (clamp(j, 1, H - 2) * W + clamp(i, 1, W - 2)) * 3;
    let tx = P[k] - P[q], ty = P[k + 1] - P[q + 1], tz = P[k + 2] - P[q + 2];
    const dn = tx * N[k] + ty * N[k + 1] + tz * N[k + 2]; tx -= dn * N[k]; ty -= dn * N[k + 1]; tz -= dn * N[k + 2];
    const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    for (let r = 0; r <= RS; r++) {
      const a = (r / RS) * PI, cs = Math.cos(a), sn = Math.sin(a), nx = N[k] * cs + tx * sn, ny = N[k + 1] * cs + ty * sn, nz = N[k + 2] * cs + tz * sn;
      pos.push(P[k] + nx * h, P[k + 1] + ny * h, P[k + 2] + nz * h); nor.push(nx, ny, nz); uv.push((i / (W - 1)) * uS, (j / (H - 1)) * vS);
    }
  }
  for (let m = 0; m < Ln; m++) { const m2 = (m + 1) % Ln; for (let r = 0; r < RS; r++) { const a = base + m * R + r, b = base + m2 * R + r; idx.push(a, b, b + 1, a, b + 1, a + 1); } }
  return orient(geoFrom(pos, nor, uv, idx));
}
/** Flat band swept along samples [{ p, w (width direction), hw, ht }], stadium cross-section, closed ends. */
function ribbon(samples) {
  const n = samples.length, ring = [], SEG = 3;
  for (let k = 0; k <= SEG; k++) { const a = -PI / 2 + (k / SEG) * PI; ring.push([1, Math.cos(a), Math.sin(a)]); }
  for (let k = 0; k <= SEG; k++) { const a = PI / 2 + (k / SEG) * PI; ring.push([-1, Math.cos(a), Math.sin(a)]); }
  const R = ring.length, pos = [], nor = [], uv = [], idx = [], T = V3(), Wd = V3(), Nn = V3();
  let len = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    if (i) len += s.p.distanceTo(samples[i - 1].p);
    T.subVectors(samples[Math.min(n - 1, i + 1)].p, samples[Math.max(0, i - 1)].p).normalize();
    Wd.copy(s.w).addScaledVector(T, -s.w.dot(T)).normalize(); Nn.crossVectors(Wd, T);
    for (const [sg, c, sn] of ring) {
      const lx = sg * (s.hw - s.ht) + s.ht * c, ly = s.ht * sn;
      pos.push(s.p.x + Wd.x * lx + Nn.x * ly, s.p.y + Wd.y * lx + Nn.y * ly, s.p.z + Wd.z * lx + Nn.z * ly);
      nor.push(Wd.x * c + Nn.x * sn, Wd.y * c + Nn.y * sn, Wd.z * c + Nn.z * sn); uv.push(lx + s.hw, len);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let r = 0; r < R; r++) { const a = i * R + r, b = i * R + ((r + 1) % R), c = b + R, d = a + R; idx.push(a, b, c, a, c, d); }
  for (const e of [0, n - 1]) {
    const s = samples[e], o = samples[e === 0 ? 1 : n - 2], base = pos.length / 3;
    T.subVectors(s.p, o.p).normalize();
    pos.push(s.p.x, s.p.y, s.p.z); nor.push(T.x, T.y, T.z); uv.push(s.hw, 0);
    for (let r = 0; r < R; r++) { const k = (e * R + r) * 3; pos.push(pos[k], pos[k + 1], pos[k + 2]); nor.push(T.x, T.y, T.z); uv.push(s.hw, 0); }
    for (let r = 0; r < R; r++) idx.push(base, base + 1 + r, base + 1 + ((r + 1) % R));
  }
  return orient(geoFrom(pos, nor, uv, idx));
}
/** Parameter of fn(t) -> [x, y] at a given fraction of its arc length (so grids come out evenly spaced). */
function arcParam(fn, t0, t1, n = 720) {
  const L = new Float32Array(n + 1); let px = 0, py = 0;
  for (let i = 0; i <= n; i++) { const [x, y] = fn(t0 + ((t1 - t0) * i) / n); if (i) L[i] = L[i - 1] + Math.hypot(x - px, y - py); px = x; py = y; }
  return (s) => {
    const tg = clamp(s) * L[n]; let lo = 0, hi = n;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] <= tg) lo = mid; else hi = mid; }
    return t0 + ((t1 - t0) * (lo + (tg - L[lo]) / Math.max(1e-9, L[hi] - L[lo]))) / n;
  };
}
/** Point on a polyline [[a, b], ...] at a fraction of its length. */
function polyAt(pts) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1];
  const f = (t) => { const s = clamp(t) * tot; let i = 1; while (i < pts.length - 1 && L[i] < s) i++; const k = (s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; };
  f.len = tot; return f;
}
/** lathe() with long profile segments split up, winding checked. */
function lath(profile, segs, maxSeg = 0.03) {
  const out = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSeg));
    for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return orient(lathe(out, segs));
}
/** A ball of crumpled paper: a faceted lump with sharp creases. */
function paperBall(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3((v.x / r) * 1.6 + seed, (v.y / r) * 1.6, (v.z / r) * 1.6, { oct: 2, seed });
    v.multiplyScalar(0.76 + 0.5 * Math.abs(n * 2 - 1)); p.setXYZ(i, v.x, v.y * 0.9, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// =====================================================================================================
// textures
// =====================================================================================================
function waffleNormalTex() {     // waffle pique: small square cells between raised ribs
  const N = 256, C = 16;
  const H = field(N, N, (u, v) => {
    const x = u * C, y = v * C, fx = x - Math.floor(x), fy = y - Math.floor(y);
    return Math.max(Math.pow(Math.abs(fx - 0.5) * 2, 2.2), Math.pow(Math.abs(fy - 0.5) * 2, 2.2)) + (vnoise2(u * 90, v * 90, 5, 90) - 0.5) * 0.25;
  });
  return normalTex(H, N, N, 3.2);
}
function terryNormalTex() {      // towelling: a dense pile of little loops
  const N = 256;
  const H = field(N, N, (u, v) => fbm2(u * 72, v * 72, { oct: 2, seed: 15, period: 72 }) + 0.5 * vnoise2(u * 128, v * 128, 19, 128));
  return normalTex(H, N, N, 3.0);
}
function ribNormalTex() {        // chunky knitted rib
  const N = 256, RIBS = 12;
  const H = field(N, N, (u, v) => {
    const x = u * RIBS, ix = Math.floor(x), r = Math.pow(0.5 - 0.5 * Math.cos((x - ix) * TAU), 0.6);
    return r * (0.8 + 0.2 * Math.sin(v * 48 * TAU + ix * 2.1)) + (vnoise2(u * 100, v * 100, 3, 100) - 0.5) * 0.15;
  });
  return normalTex(H, N, N, 2.8);
}
function ropeNormalTex() {       // coiled cotton rope: one coil per tile (v), the lay of the strands on the diagonal
  const N = 128;
  const H = field(N, N, (u, v) => Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2)) * (0.76 + 0.24 * Math.cos(TAU * (3 * u + v))));
  return normalTex(H, N, N, 8.0);
}
function woodMat(tone, seed) {   // pale oak for small trim: fine streaks along u, 0.5 m x 0.09 m per tile
  const W = 256, H = 64, cv = makeCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true }), r = new RNG(seed);
  c.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 150; i++) {
    const y = r.range(0, H);
    c.strokeStyle = r.chance(0.6) ? `rgba(112,80,46,${r.range(0.05, 0.2).toFixed(3)})` : `rgba(255,242,218,${r.range(0.05, 0.2).toFixed(3)})`; c.lineWidth = r.range(0.4, 1.5);
    c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(W * 0.3, y + r.range(-2.5, 2.5), W * 0.7, y + r.range(-2.5, 2.5), W, y); c.stroke();
  }
  return pbr({ map: canvasTex(cv, { srgb: true, repeat: [1 / 0.5, 1 / 0.09] }), roughness: 0.55 }, { bake: { albedo: avgColor(c.getImageData(0, 0, W, H).data) } });
}
/** Wall print: a sheet of an invented topographic survey. Contour lines of a noise landscape. */
function paintPoster() {
  const W = 400, H = 560, cv = makeCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true });
  const img = c.createImageData(W, H), d = img.data, hg = new Float32Array(W * H);
  const mx0 = 34, mx1 = W - 34, my0 = 38, my1 = 410;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hg[y * W + x] = (fbm2(x / 150 + 3.1, y / 150 + 1.7, { oct: 4, seed: 41 }) + 0.36 * Math.exp(-(((x - 250) / 120) ** 2 + ((y - 190) / 130) ** 2))) * 15;
  const paper = [236, 230, 216], ink = [44, 66, 82], high = [203, 212, 196];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = i * 4, n = (hash2(x, y, 7) - 0.5) * 5;
    let k = 0, tint = 0;
    if (x > mx0 && x < mx1 && y > my0 && y < my1) {
      const h = hg[i], g = Math.max(1e-4, Math.hypot(hg[i + 1] - hg[i - 1], hg[i + W] - hg[i - W]) * 0.5);
      const f = h - Math.floor(h), dist = Math.min(f, 1 - f) / g, major = Math.round(h) % 5 === 0;      // pixels to the nearest contour
      k = clamp((major ? 1.3 : 0.75) - dist) * (major ? 0.95 : 0.6); tint = smoothstep(6.5, 11.5, h) * 0.85;
    }
    for (let q = 0; q < 3; q++) d[j + q] = lerp(lerp(paper[q], high[q], tint), ink[q], k) + n;
    d[j + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  c.strokeStyle = '#2c4252'; c.lineWidth = 1.2; c.strokeRect(mx0 + 0.5, my0 + 0.5, mx1 - mx0 - 1, my1 - my0 - 1);
  c.fillStyle = '#c0613f'; c.beginPath(); c.arc(250, 188, 5, 0, TAU); c.fill();
  c.fillStyle = '#2c4252'; c.textAlign = 'left';
  c.font = `600 36px ${SERIF}`; c.fillText('Tarnholt', mx0, 466);
  c.font = `italic 15px ${SERIF}`; c.fillText('the northern ridge and its two lakes', mx0, 490);
  c.font = `10px ${SANS}`; c.fillText('SHEET 14   ·   1 : 25 000   ·   CONTOUR INTERVAL 20 M', mx0, 524);
  c.textAlign = 'right'; c.fillStyle = '#c0613f'; c.font = `600 36px ${SERIF}`; c.fillText('14', mx1, 466);
  return { cv, avg: avgColor(c.getImageData(0, 0, W, H).data) };
}
/** Five small prints with a white border, side by side on one canvas. */
function paintPhotos() {
  const CW = 96, CH = 118, n = 5, cv = makeCanvas(CW * n, CH), c = cv.getContext('2d', { willReadFrequently: true }), r = new RNG(8841);
  for (let k = 0; k < n; k++) {
    const x0 = k * CW, ix = x0 + 7, iy = 7, iw = CW - 14, ih = CH - 30;
    c.fillStyle = '#efece4'; c.fillRect(x0, 0, CW, CH);
    c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
    const grad = (a, b) => { const g = c.createLinearGradient(0, iy, 0, iy + ih); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
    if (k === 0) {            // dusk over the sea
      c.fillStyle = grad('#66799b', '#e9b48c'); c.fillRect(ix, iy, iw, ih);
      c.fillStyle = '#f6dcb4'; c.beginPath(); c.arc(ix + iw * 0.62, iy + ih * 0.6, 7, 0, TAU); c.fill();
      c.fillStyle = '#465d73'; c.fillRect(ix, iy + ih * 0.62, iw, ih);
    } else if (k === 1) {     // pine trunks
      c.fillStyle = grad('#bcc8b2', '#6c8770'); c.fillRect(ix, iy, iw, ih);
      for (let q = 0; q < 8; q++) { c.fillStyle = q % 2 ? '#2d3a32' : '#42544a'; c.fillRect(ix + r.range(0, iw), iy, r.range(2, 7), ih); }
    } else if (k === 2) {     // ridges in haze
      c.fillStyle = grad('#d3dde3', '#b9c8d2'); c.fillRect(ix, iy, iw, ih);
      ['#93a6b5', '#667c90', '#41556a'].forEach((col, q) => {
        c.fillStyle = col; c.beginPath(); c.moveTo(ix, iy + ih);
        for (let p = 0; p <= 8; p++) c.lineTo(ix + (iw * p) / 8, iy + ih * (0.38 + q * 0.17) + r.range(-9, 9));
        c.lineTo(ix + iw, iy + ih); c.fill();
      });
    } else if (k === 3) {     // street lights out of focus
      c.fillStyle = '#1c2130'; c.fillRect(ix, iy, iw, ih);
      for (let q = 0; q < 16; q++) { c.fillStyle = r.pick(['rgba(244,196,120,0.55)', 'rgba(232,120,90,0.5)', 'rgba(150,190,220,0.45)']); c.beginPath(); c.arc(ix + r.range(0, iw), iy + r.range(ih * 0.2, ih), r.range(3, 8), 0, TAU); c.fill(); }
    } else {                  // one tree in a meadow
      c.fillStyle = grad('#dadfd2', '#c9d2c0'); c.fillRect(ix, iy, iw, ih);
      c.fillStyle = '#98a56c'; c.fillRect(ix, iy + ih * 0.66, iw, ih);
      c.fillStyle = '#4a5839'; c.fillRect(ix + iw * 0.44, iy + ih * 0.46, 3, ih * 0.22); c.beginPath(); c.arc(ix + iw * 0.46, iy + ih * 0.4, 13, 0, TAU); c.fill();
    }
    c.fillStyle = 'rgba(244,228,204,0.1)'; c.fillRect(ix, iy, iw, ih);
    c.restore();
  }
  return { cv, n, avg: avgColor(c.getImageData(0, 0, CW * n, CH).data) };
}

function makeMats() {
  const tile = (t, rx, ry = rx) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  const fab = (col, o = {}) => fabric(col, { slub: 0.6, rough: 0.96, ...o });
  const terry = terryNormalTex(), waffle = waffleNormalTex(), rib = ribNormalTex(), rope = ropeNormalTex(), m = {};
  // laundry basket
  m.rope = fab(sc(0.83, 0.79, 0.7), { sheen: 0.25, nscale: 1.3 }); m.rope.normalMap = tile(rope, 1 / 0.024, 1 / 0.014);
  m.ropeH = fab(sc(0.83, 0.79, 0.7), { sheen: 0.25, nscale: 1.0 }); m.ropeH.normalMap = tile(rope, 4, 1 / 0.012);
  m.towel = fab(sc(0.71, 0.5, 0.42), { sheen: 0.6, rough: 1 }); m.towel.normalMap = tile(terry, 1 / 0.05);
  m.laundry = fab(sc(0.85, 0.84, 0.81), { sheen: 0.3, rep: 9 });
  // backpack
  m.pack = fab(sc(0.135, 0.175, 0.275), { rep: 14, sheen: 0.2, rough: 0.84, nscale: 0.9 });
  m.packDark = fab(sc(0.08, 0.095, 0.15), { rep: 14, sheen: 0.15, rough: 0.82 });
  m.packMesh = fab(sc(0.21, 0.24, 0.31), { rep: 30, sheen: 0.1, rough: 0.92, nscale: 1.2 });
  m.zip = pbr({ color: sc(0.05, 0.055, 0.07), roughness: 0.45 });
  m.tan = pbr({ color: sc(0.62, 0.43, 0.27), roughness: 0.7 });
  // hook rail
  m.oak = woodMat([206, 176, 132], 311);
  m.robe = fab(sc(0.56, 0.54, 0.5), { sheen: 0.5, rough: 1, side: THREE.DoubleSide }); m.robe.normalMap = tile(waffle, 1 / 0.09);
  m.scarf = fab(sc(0.75, 0.56, 0.2), { sheen: 0.5, rough: 1, nscale: 1.1 }); m.scarf.normalMap = tile(rib, 1 / 0.07);
  // sneakers
  m.shoe = pbr({ color: sc(0.9, 0.89, 0.86), roughness: 0.62 });
  m.sole = pbr({ color: sc(0.93, 0.93, 0.91), roughness: 0.7 });
  m.gum = pbr({ color: sc(0.66, 0.5, 0.33), roughness: 0.82 });
  m.lining = fab(sc(0.45, 0.45, 0.46), { rep: 20, sheen: 0.2, side: THREE.DoubleSide });
  m.lace = pbr({ color: sc(0.92, 0.92, 0.9), roughness: 0.85 });
  m.heelTab = pbr({ color: sc(0.2, 0.33, 0.3), roughness: 0.6 });
  // bin, paper, mat, mug
  m.bin = pbr({ color: sc(0.86, 0.85, 0.82), roughness: 0.5 });
  m.paper = pbr({ color: sc(0.9, 0.9, 0.87), roughness: 0.75 });
  m.mat = pbr({ color: sc(0.36, 0.3, 0.36), roughness: 0.93 });
  m.band = pbr({ color: sc(0.1, 0.1, 0.11), roughness: 0.8 });
  m.mug = pbr({ color: sc(0.86, 0.83, 0.76), roughness: 0.28 });
  m.pages = pbr({ color: sc(0.9, 0.87, 0.79), roughness: 0.9 });
  // string of lights
  m.wire = pbr({ color: sc(0.06, 0.06, 0.06), roughness: 0.6 });
  m.bulb = pbr({ color: sc(0.93, 0.9, 0.82), roughness: 0.3 });
  return m;
}

// =====================================================================================================
// laundry basket of coiled cotton rope, a towel left hanging over the rim
// =====================================================================================================
function buildHamper(root, m, ctx) {
  const C = { x: 4.555, z: 0.965 }, H = 0.42, R0 = 0.158, R1 = 0.19, TH = 0.013, YR = H - 0.006;
  const prof = [[R0 - 0.02, 0.001], [R0 - 0.004, 0.003], [R0, 0.012]];
  for (let k = 1; k <= 10; k++) prof.push([lerp(R0, R1, k / 10), lerp(0.012, YR, k / 10)]);
  for (let k = 1; k <= 5; k++) { const a = (k / 5) * PI; prof.push([R1 - TH / 2 + (TH / 2) * Math.cos(a), YR + (TH / 2) * Math.sin(a)]); }
  for (let k = 1; k <= 8; k++) prof.push([lerp(R1 - TH, R0 - TH, k / 8), lerp(YR, 0.02, k / 8)]);
  prof.push([R0 - TH - 0.02, 0.016], [0.002, 0.016]);
  const Pf = polyAt(prof);
  // a soft basket is never round: it sags oval towards the top and leans a little
  const wob = (a, y) => 1 + (y / H) * (0.03 * Math.cos(2 * a + 0.7) + 0.018 * Math.cos(3 * a + 2.1)) + 0.012 * (fbm2((a / TAU) * 8, y * 9, { oct: 2, seed: 31, period: 8 }) - 0.5);
  const lean = (y) => 0.012 * (y / H) ** 2;
  const wall = (u, v, o) => { const a = u * TAU, [r, y] = Pf(v), k = wob(a, y); return o.set(C.x + r * k * Math.cos(a) + lean(y), y, C.z + r * k * Math.sin(a)); };
  add(root, skin(sampleGrid(wall, 60, 78, { closedU: true, from: [C.x, H / 2, C.z], rows: [4, 24] }), 1.2, Pf.len), m.rope, 'hamper');
  // two rope handles stitched to the wall, standing above the rim
  const hs = [];
  for (const a0 of [PI / 2 + 0.1, -PI / 2 + 0.1]) {
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, a = a0 + (t - 0.5) * 0.6, y = H - 0.085 + 0.135 * Math.pow(Math.sin(PI * t), 0.75), yw = Math.min(y, H);
      const r = lerp(R0, R1, yw / H) * wob(a, yw) + 0.009 + 0.012 * Math.sin(PI * t);
      pts.push(V3(C.x + r * Math.cos(a) + lean(yw), y, C.z + r * Math.sin(a)));
    }
    hs.push(tube(pts, 0.0075, { tubular: 30, radial: 8 }));
  }
  add(root, merge(hs), m.ropeH, 'hamperHandles');
  // what is in it
  const heap = (u, v, o) => {
    const a = u * TAU, r = 0.178 * v, x = r * Math.cos(a), z = r * Math.sin(a), yy = H - 0.075 + 0.075 * fbm2(x * 8 + 2, z * 8 + 5, { oct: 3, seed: 37 }) - 0.045 * v * v;
    const k = wob(a, yy);
    return o.set(C.x + x * k + lean(yy), yy, C.z + z * k);
  };
  add(root, skin(sampleGrid(heap, 44, 16, { closedU: true, face: [0, 1, 0] }), 1.1, 0.18), m.laundry, 'hamperLaundry');
  // cloth over the rim: up the inside, over the top, down the outside in loose folds
  const drape = (o) => {
    const rb = TH / 2 + o.th / 2 + 0.0015, bend = PI * rb;
    const fn = (u, v, out) => {
      const q = u * 2 - 1, Li = o.inside + o.skew * q, s = v * o.len;
      let rho, y, sq = 1;
      if (s < Li) { rho = -rb - 0.12 * (Li - s); y = YR - (Li - s); }
      else if (s < Li + bend) { const th = PI - ((s - Li) / bend) * PI; rho = rb * Math.cos(th); y = YR + rb * Math.sin(th); }
      else {
        const drop = s - Li - bend, g = smoothstep(0, 0.09, drop);
        rho = rb + 0.03 * drop + g * o.fold * (0.9 + 0.6 * Math.cos(q * o.nf * PI + o.ph) + 0.4 * Math.cos(q * o.nf * 1.9 * PI + 1.3 + drop * 5)) + 0.004 * (fbm2(q * 4 + 3, drop * 14, { oct: 2, seed: 43 }) - 0.5) * g;
        y = YR - drop; sq = 1 - 0.14 * g;
      }
      const a = o.a + q * (o.w / 2 / R1) * sq, r = R1 - TH / 2 + rho, k = wob(a, H);
      return out.set(C.x + r * k * Math.cos(a) + lean(H), y, C.z + r * k * Math.sin(a));
    };
    return thick(sampleGrid(fn, o.nu, o.nv), o.th, o.w, o.len);
  };
  add(root, drape({ a: PI - 0.32, w: 0.3, len: 0.47, inside: 0.15, skew: 0.065, th: 0.005, fold: 0.015, nf: 2.3, ph: 0.9, nu: 38, nv: 60 }), m.towel, 'hamperTowel');
  ctx.colliders.push({ min: [4.36, 0, 0.76], max: [4.77, 0.5, 1.17] });
}

// =====================================================================================================
// backpack slumped against the wall
// =====================================================================================================
function buildBackpack(root, m, ctx) {
  const HH = 0.45, WH = 0.155, E2 = 0.42, px = 4.612, pz = 1.6, m4 = M4(px, 0, pz, -PI / 2 + 0.25), C = [px - 0.02, 0.22, pz];
  const eb = (b) => (b < 0 ? 0.32 : 0.55);
  const A = arcParam((a) => [WH * sp(Math.cos(a), E2), 0.08 * sp(Math.sin(a), E2)], 0, TAU);
  const B = arcParam((b) => [0.12 * Math.pow(Math.max(0, Math.cos(b)), eb(b)), 0.225 * sp(Math.sin(b), eb(b))], -PI / 2, PI / 2);
  const body = (u, v, out) => {
    const a = A(u - Math.floor(u)), b = B(v), e = eb(b);
    const cb = Math.pow(Math.max(0, Math.cos(b)), e), yn = 0.5 + 0.5 * sp(Math.sin(b), e), ca = sp(Math.cos(a), E2), sa = sp(Math.sin(a), E2);
    const w = WH * (1 - 0.14 * smoothstep(0.5, 1, yn));
    const d = sa > 0 ? 0.082 * (1.1 - 0.42 * smoothstep(0.3, 1, yn)) + 0.022 * Math.exp(-(((yn - 0.27) / 0.2) ** 2)) : 0.07;
    let x = w * cb * ca, z = d * cb * sa; const y = HH * yn, fr = Math.max(0, sa);
    // used, half-empty fabric: slack wrinkles on the front and a crease where the top folds forward
    z += fr * cb * (0.007 * (fbm2(x * 16 + 3, y * 13, { oct: 3, seed: 51 }) - 0.5) - 0.008 * Math.exp(-(((yn - 0.66 - 0.04 * Math.sin(x * 14)) / 0.03) ** 2)));
    x += 0.005 * cb * (fbm2(y * 11, z * 15 + 7, { oct: 2, seed: 53 }) - 0.5);
    z -= 0.3 * y * (1 - 0.25 * yn);          // leans back on the wall
    x += 0.035 * yn * yn;                    // and a little to one side
    out.set(x, y + 0.003, z).applyMatrix4(m4);
    if (out.x > 4.781) out.x = 4.781;
    return out;
  };
  add(root, skin(sampleGrid(body, 100, 72, { closedU: true, from: C }), 0.9, 0.69), m.pack, 'backpack');
  // surface point + outward normal of the body
  const pa = V3(), pb = V3(), pc = V3(), nrm = V3(), tmp = V3();
  const bodyN = (u, v) => {
    body(u, v, pa); body(u + 0.004, v, pb); body(u, v + 0.004, pc);
    nrm.crossVectors(pb.sub(pa), pc.sub(pa)).normalize();
    if (nrm.dot(tmp.set(pa.x - C[0], pa.y - C[1], pa.z - C[2])) < 0) nrm.negate();
  };
  const pillow = (a, b) => Math.sqrt(Math.max(0, 1 - Math.abs(a) ** 3)) * Math.sqrt(Math.max(0, 1 - Math.abs(b) ** 3));
  const patch = (u0, u1, v0, v1, hf) => (a, b, out, lift = 0) => { bodyN(lerp(u0, u1, (a + 1) / 2), lerp(v0, v1, (b + 1) / 2)); return out.copy(pa).addScaledVector(nrm, hf(a, b) + lift); };
  const gridOf = (at, nu, nv) => sampleGrid((s, t, o) => at(Math.sin((s - 0.5) * PI), Math.sin((t - 0.5) * PI), o), nu, nv, { from: C });
  // front pocket, bulging and sagging a little
  const front = patch(0.105, 0.395, 0.2, 0.56, (a, b) => 0.026 * pillow(a, b) * (1.1 - 0.25 * b) - 0.002);
  add(root, skin(gridOf(front, 40, 34), 0.27, 0.25), m.pack, 'backpackPocket');
  // elasticated side pocket
  const sideP = patch(-0.045, 0.075, 0.2, 0.44, (a, b) => (0.004 + 0.011 * smoothstep(-0.2, 1, b)) * Math.sqrt(Math.max(0, 1 - Math.abs(a) ** 4)) * Math.sqrt(Math.max(0, 1 - Math.max(0, -b) ** 4)) - 0.0015);
  add(root, skin(gridOf(sideP, 20, 20), 0.11, 0.16), m.packMesh, 'backpackSidePocket');
  // zips: one in an arc across the front pocket, the main one over the top from side to side
  const zips = [], pulls = [], cords = [];
  const pull = (p, n) => {
    pulls.push(roundedBox(0.008, 0.013, 0.005, { r: 0.0015, rs: 2 }).translate(p.x + n.x * 0.0045, p.y + n.y * 0.0045 - 0.003, p.z + n.z * 0.0045));
    cords.push(tube([V3(p.x + n.x * 0.006, p.y - 0.008, p.z + n.z * 0.006), V3(p.x + n.x * 0.01, p.y - 0.026, p.z + n.z * 0.01), V3(p.x + n.x * 0.009, p.y - 0.046, p.z + n.z * 0.009)], 0.0021, { tubular: 8, radial: 6 }));
  };
  { const pts = []; for (let k = 0; k <= 24; k++) { const a = lerp(-0.84, 0.84, k / 24); pts.push(front(a, 0.72 - 0.12 * a * a, V3(), 0.0018)); if (k === 5) pull(pts[k], nrm); }
    zips.push(tube(pts, 0.0028, { tubular: 48, radial: 6 })); }
  { const pts = []; for (let k = 0; k <= 44; k++) { const t = k / 44, up = t < 0.5; bodyN(up ? 0.05 : 0.45, up ? lerp(0.58, 0.985, t * 2) : lerp(0.985, 0.58, t * 2 - 1)); pts.push(pa.clone().addScaledVector(nrm, 0.0016)); if (k === 9 || k === 13) pull(pts[k], nrm); }
    zips.push(tube(pts, 0.003, { tubular: 80, radial: 6 })); }
  add(root, merge(zips), m.zip, 'backpackZips');
  add(root, merge(pulls), ctx.M.metal, 'backpackSliders', FLAT);
  add(root, merge(cords), m.tan, 'backpackPulls', FLAT);
  // grab handle on top, and one shoulder strap that has fallen out to the side and lies on the floor
  const web = [];
  { const S = []; bodyN(0.715, 0.9); const e0 = pa.clone(); bodyN(0.785, 0.9); const e1 = pa.clone(), wd = V3(-1, 0, 0);
    for (let k = 0; k <= 14; k++) { const t = k / 14, p = e0.clone().lerp(e1, t); p.y += 0.004 + 0.034 * Math.sin(PI * t); p.x -= 0.012 * Math.sin(PI * t); S.push({ p, w: wd, hw: 0.011, ht: 0.003 }); }
    web.push(ribbon(S)); }
  { const S = [], NS = 40, up = V3(0, 1, 0);
    for (let k = 0; k <= NS; k++) {
      const t = k / NS, bl = Math.pow(Math.sin(PI * t), 0.9), nar = smoothstep(0.52, 0.66, t);
      bodyN(0.925, lerp(0.83, 0.17, t));
      const p = pa.clone().addScaledVector(nrm, 0.006 + 0.085 * bl), ht = lerp(0.006, 0.0016, nar);
      p.x -= 0.03 * bl; p.y = Math.max(p.y - 0.1 * bl * t, ht + 0.001);
      const wd = V3().crossVectors(nrm, up).normalize();
      S.push({ p, w: wd, hw: lerp(0.03, 0.0125, nar), ht });
    }
    web.push(ribbon(S)); }
  add(root, merge(web), m.packDark, 'backpackStraps');
  ctx.colliders.push({ min: [4.46, 0, 1.4], max: [4.8, 0.47, 1.86] });
}

// =====================================================================================================
// hook rail on the right wall: a waffle dressing gown hung by its collar, a scarf
// =====================================================================================================
const RAIL = { X: 4.8, y: 1.772, z0: 1.89, z1: 2.45, hooks: [1.96, 2.1, 2.24, 2.38] };
function buildRail(root, m, ctx) {
  const { X, y, z0, z1, hooks } = RAIL, hk = [];
  add(root, boxAt(X - 0.019, y - 0.036, z0, 0.019, 0.072, z1 - z0, { r: 0.004, rs: 2, maxEdge: 0.05 }), m.oak, 'hookRail', FLAT);
  for (const z of hooks) {
    hk.push(new THREE.CylinderGeometry(0.011, 0.011, 0.003, 18).rotateZ(PI / 2).translate(X - 0.0205, y - 0.006, z));
    hk.push(tube([V3(X - 0.019, y - 0.006, z), V3(X - 0.044, y - 0.009, z), V3(X - 0.058, y - 0.003, z), V3(X - 0.062, y + 0.013, z)], 0.0045, { tubular: 14, radial: 8 }));
    hk.push(new THREE.SphereGeometry(0.0066, 10, 8).translate(X - 0.062, y + 0.014, z));
  }
  add(root, merge(hk), ctx.M.blackMetal, 'hooks', FLAT);
}

function buildRobe(root, m) {
  const X = RAIL.X, ZC = RAIL.hooks[1], YT = 1.778, L = 1.04, TW = 0.4;
  const hw = (t) => lerp(0.05, 0.2, Math.pow(smoothstep(0, 0.2, t), 0.85)) + 0.018 * smoothstep(0.3, 1, t);
  const gap = (t) => (t < TW ? 0.038 * Math.pow(Math.sin(PI * Math.pow(clamp(t / TW), 0.8)), 1.35) : 0);
  const D0 = (t) => (lerp(0.058, 0.098, smoothstep(0, 0.32, t)) + 0.014 * t) * (1 - 0.1 * Math.exp(-(((t - TW) / 0.05) ** 2)));
  const prof = (s) => Math.pow(Math.max(0, 1 - Math.abs(s) ** 3), 0.6);
  // vertical folds that fan out from the hook; they are pulled together under the belt and open up towards the hem
  const folds = (s, t) => {
    const g = smoothstep(0.06, 0.36, t) * (1 + 0.45 * smoothstep(0.6, 1, t)) * (1 - 0.6 * Math.exp(-(((t - TW - 0.015) / 0.035) ** 2)));
    return g * (0.015 * Math.cos(TAU * (2.4 * s + 0.13 + 0.05 * Math.sin(t * 5.1))) + 0.007 * Math.cos(TAU * (4.1 * s + 0.4 + 0.07 * Math.sin(t * 3.3 + 1)))) + 0.005 * (fbm2(s * 5 + 9, t * 8, { oct: 2, seed: 71 }) - 0.5);
  };
  // the doubled front bands are stiffer than the single cloth: the folds die out under them
  const stiff = (s, t) => {
    const ca = eA(t) - 0.13, cb = eB(t) + 0.13, wb = 1 - smoothstep(TW, TW + 0.06, t);
    return (1 - 0.8 * Math.exp(-(((s - ca) / 0.17) ** 2))) * (1 - 0.8 * wb * Math.exp(-(((s - cb) / 0.17) ** 2)));
  };
  const depth = (s, t) => 0.014 + D0(t) * prof(s) + folds(s, t) * stiff(s, t) * (1 - smoothstep(0.8, 1, Math.abs(s)));
  const at = (s, t, lift, out) => out.set(X - depth(s, t) - lift, YT - L * t * (1 + 0.018 * Math.sin(2.3 * s + 0.8)) - 0.035 * Math.pow(Math.abs(s), 1.5) * (1 - smoothstep(0, 0.25, t)), ZC + s * hw(t));
  // the two fronts: open in a narrow V above the waist, wrapped over one another below it
  const eA = (t) => (t < TW ? -gap(t) / hw(t) : lerp(0, 0.16, smoothstep(TW, TW + 0.12, t)));
  const eB = (t) => (t < TW ? gap(t) / hw(t) : lerp(0, -0.12, smoothstep(TW, TW + 0.12, t)));
  const lap = (t) => smoothstep(TW - 0.05, TW + 0.1, t);
  const panelA = (u, v, o) => { const e = eA(v), s = lerp(-1, e, u); return at(s, v, 0.006 * smoothstep(e - 0.5, e, s) * lap(v), o); };
  const panelB = (u, v, o) => { const e = eB(v), s = lerp(e, 1, u), ea = eA(v); return at(s, v, -0.006 * (1 - smoothstep(ea + 0.02, ea + 0.2, s)) * lap(v), o); };
  const cloth = [skin(sampleGrid(panelA, 30, 104, { face: [-1, 0, 0] }), 0.24, L), skin(sampleGrid(panelB, 26, 104, { face: [-1, 0, 0] }), 0.22, L)];
  // the inside of the back, seen through the V
  cloth.push(skin(sampleGrid((u, v, o) => { const q = u * 2 - 1, t = lerp(0.015, TW + 0.03, v); return o.set(X - 0.02 - 0.005 * Math.cos(q * 3), YT - L * t, ZC + q * (gap(t) + 0.03)); }, 8, 26, { face: [-1, 0, 0] }), 0.12, 0.44));
  // sleeves hanging from the collapsed shoulders
  // (they start as a flat ridge on the slope of the shoulder, swing out and then hang straight, a little uneven)
  for (const sg of [-1, 1]) {
    const SL = sg < 0 ? 0.67 : 0.65, fn = (u, v, o) => {
      const a = u * TAU, t = v, out = smoothstep(0, 0.3, t);
      const rz = lerp(0.02, 0.057, out) * (1 - 0.08 * smoothstep(0.75, 0.98, t)), rx = lerp(0.009, 0.041, smoothstep(0, 0.36, t));
      const f = 1 + 0.13 * Math.cos(3 * a + 1.3 * sg + 3.4 * t) * smoothstep(0.1, 0.35, t) + 0.06 * Math.sin(t * 38 + 1.8 * Math.sin(a + sg)) * smoothstep(0.3, 0.45, t) * (1 - smoothstep(0.72, 0.86, t)) + (t > 0.925 ? 0.08 : 0);
      const sway = 0.01 * Math.sin(t * 4.2 + sg);
      return o.set(X - 0.069 - 0.021 * out - 0.01 * t - rx * f * Math.cos(a), YT - 0.1 - SL * t, ZC + sg * (0.085 + 0.105 * out + 0.012 * t) + sway * t + rz * f * Math.sin(a));
    };
    cloth.push(skin(sampleGrid(fn, 28, 66, { closedU: true, from: [X - 0.09, 1.3, ZC + sg * 0.19], rows: [24, 60] }), 0.36, SL));
  }
  add(root, merge(cloth), m.robe, 'robe');
  // doubled front band: over the hook as the collar, down both fronts (the under one disappears below the waist)
  const trim = [];
  {
    const S = [], side = (sg, t) => {
      const bw = lerp(0.03, 0.025, smoothstep(0.1, 0.5, t)), e = sg < 0 ? eA(t) : eB(t), dS = bw / hw(t), s = e + sg * dS, p = V3();
      at(s, t, 0, p);
      let dm = 0; for (const k of [-1, -0.5, 0, 0.5, 1]) dm = Math.max(dm, depth(s + k * dS, t));   // rides on the cloth across its whole width
      p.x = X - dm - 0.0075 - (sg < 0 ? 0.006 : -0.004) * lap(t);
      return { p, w: V3(0, 0, sg), hw: bw, ht: 0.007 };
    };
    for (let k = 96; k >= 0; k--) S.push(side(-1, (k / 96) * 0.995));
    const top = S[S.length - 1].p, top2 = side(1, 0).p, cz = (top.z + top2.z) / 2, rr = (top2.z - top.z) / 2;
    for (let k = 1; k < 10; k++) { const a = PI - (k / 10) * PI; S.push({ p: V3(lerp(top.x, top2.x, k / 10) - 0.004 * Math.sin(a), top.y + rr * 1.1 * Math.sin(a), cz + rr * Math.cos(a)), w: V3(0, Math.sin(a), Math.cos(a)), hw: 0.03, ht: 0.007 }); }
    for (let k = 0; k <= 44; k++) S.push(side(1, (k / 44) * (TW + 0.035)));
    trim.push(ribbon(S));
  }
  // belt: round the waist on top of the gathered folds, knotted off-centre, the two ends hanging
  {
    const S = [], env = (s, t) => 0.014 + D0(t) * prof(s) + 0.012;
    for (let k = 0; k <= 40; k++) {
      const q = (k / 40) * 2 - 1, s = q * 0.84, t = TW + 0.012 + 0.024 * (1 - q * q) + 0.012 * q, tilt = 0.25 * Math.sin(q * 4.3 + 0.6);
      S.push({ p: V3(X - env(s, t) - 0.011 - 0.012 * smoothstep(0.55, 0.15, Math.abs(s)) - 0.004 * Math.cos(q * 9), YT - L * t, ZC + s * hw(t)), w: V3(tilt, 1, 0), hw: 0.021 * (1 + 0.1 * Math.sin(q * 6)), ht: 0.004 });
    }
    trim.push(ribbon(S));
    const ks = 0.14, kt = TW + 0.036 + 0.012 * 0.17, kp = V3(X - env(ks, kt) - 0.031, YT - L * kt, ZC + ks * hw(kt));
    trim.push(roundedBox(0.03, 0.036, 0.042, { r: 0.014, rs: 3 }).rotateX(0.35).rotateY(0.2).translate(kp.x, kp.y, kp.z));
    for (const [sg, len, tw] of [[-1, 0.34, 0.9], [1, 0.25, -1.2]]) {
      const T = [];
      for (let k = 0; k <= 30; k++) {
        const t = k / 30, y = kp.y - 0.008 - len * t, tt = (YT - y) / L, z = kp.z + sg * (0.006 + 0.03 * Math.sqrt(t)) + 0.014 * t * Math.sin(t * 4 + sg), s = (z - ZC) / hw(tt), a = tw * t + 0.3 * Math.sin(t * 5 + sg);
        T.push({ p: V3(X - env(s, tt) - 0.022 - 0.012 * Math.sin(PI * t), y, z), w: V3(Math.sin(a), 0.12 * sg * (1 - t), Math.cos(a)), hw: 0.021 * (1 - 0.12 * Math.sin(PI * t)), ht: 0.0035 });
      }
      trim.push(ribbon(T));
    }
  }
  add(root, merge(trim), m.robe, 'robeTrim');
}

function buildScarf(root, m) {
  const X = RAIL.X, Z = RAIL.hooks[3], YH = RAIL.y + 0.004, parts = [], fringe = [];
  for (const [sg, len, ph, dx] of [[1, 0.8, 0.3, 0.006], [-1, 0.63, 1.9, -0.004]]) {
    const fn = (u, v, o) => {
      const q = u * 2 - 1, s = v * len, g = smoothstep(0.02, 0.22, s), hwid = lerp(0.02, 0.052, smoothstep(0, 0.3, s));
      // starts bunched over the peg, then falls in two or three lengthwise folds
      const fold = g * (0.011 * Math.cos(q * 1.5 * PI + ph + 0.8 * s) - 0.012 * q * q) + 0.004 * (fbm2(q * 2 + 4 * sg, s * 7, { oct: 2, seed: 81 }) - 0.5);
      const over = Math.max(0, 0.05 - s);
      return o.set(X - 0.036 - dx - fold + over * 0.35, YH + 0.008 - s - 2.2 * over * over * 10 * 0.1, Z + sg * (0.004 + 0.03 * smoothstep(0, 0.25, s)) + q * hwid + 0.012 * Math.sin(s * 2.6 + ph) * s);
    };
    parts.push(thick(sampleGrid(fn, 12, 56), 0.006, 0.12, len));
    // fringe: a row of short tassels along the end
    const rng = new RNG(700 + len * 100), e = V3();
    for (let i = 0; i < 11; i++) {
      fn((i + 0.5) / 11, 1, e);
      const l = rng.range(0.04, 0.055), dz = rng.range(-0.004, 0.004), dx = rng.range(-0.003, 0.003);
      fringe.push(tube([V3(e.x, e.y + 0.004, e.z), V3(e.x + dx * 0.5, e.y - l * 0.5, e.z + dz * 0.6), V3(e.x + dx, e.y - l, e.z + dz)], (t) => 0.0026 - 0.001 * t, { tubular: 4, radial: 5 }));
    }
  }
  add(root, merge(parts), m.scarf, 'scarf');
  add(root, merge(fringe), m.scarf, 'scarfFringe', FLAT);
}

// =====================================================================================================
// a pair of sneakers kicked off by the door
// =====================================================================================================
function sneaker(side, m4, G) {
  const L = 0.285, YS = 0.028, D = 0.003;
  const wAt = (x) => { const xn = x / (L / 2); return lerp(0.036, 0.0485, smoothstep(-0.8, 0.3, xn)) * (1 - 0.1 * smoothstep(0.5, 1, xn)); };
  const zc = (x) => { const xn = x / (L / 2); return side * 0.008 * (xn * xn - 0.35); };
  const hTop = (x) => YS + 0.027 * Math.sqrt(clamp((L / 2 - x) / 0.05)) + 0.046 * smoothstep(0.08, -0.03, x) - 0.007 * smoothstep(-0.05, -0.09, x) + 0.014 * smoothstep(-0.1, -0.135, x);
  const gapAt = (x) => (0.012 * smoothstep(0.06, 0.035, x) + 0.017 * smoothstep(-0.015, -0.055, x)) * Math.sqrt(clamp((x + L / 2 - 0.014) / 0.03));
  const outline = (ph, d) => { const c = sp(Math.cos(ph), 0.85), x = (L / 2 - d) * c; return [x, zc(x) + (wAt((L / 2) * c) - d) * sp(Math.sin(ph), 0.72)]; };
  const rimPt = (ph) => { const c = sp(Math.cos(ph), 0.85), x = lerp(-L / 2 + 0.014, L / 2 - 0.04, (c + 1) / 2); return [x, hTop(x), zc(x) + gapAt(x) * sp(Math.sin(ph), 0.6)]; };
  const put = (list, g) => list.push(g.applyMatrix4(m4));
  // sole: gum outsole under a white midsole
  const loft = (pr) => skin(sampleGrid((u, v, o) => { const q = pr[Math.round(v * (pr.length - 1))], [x, z] = outline(-u * TAU, q[0]); return o.set(x, q[1], z); }, 56, pr.length - 1, { closedU: true, from: [0, 0.015, 0] }), 0.7, 0.03);
  put(G.gum, loft([[0.014, 0.0006], [0.004, 0.0012], [0, 0.004], [0, 0.0075]]));
  put(G.sole, loft([[0, 0.0075], [-0.0012, 0.0095], [-0.0012, 0.0262], [0.0006, 0.0282], [0.004, 0.0292], [0.012, 0.0292]]));
  // upper: from the edge of the sole up to the ridge of the toe box / the lips of the throat and collar
  const upper = (u, v, o) => {
    const ph = -u * TAU, [xb, zb] = outline(ph, D), [xt, yt, zt] = rimPt(ph), th = (v * PI) / 2, cs = Math.pow(Math.max(0, Math.cos(th)), 0.8), sn = Math.pow(Math.sin(th), 0.8);
    return o.set(xt + (xb - xt) * cs, YS - 0.004 + (yt - YS + 0.004) * sn, zt + (zb - zt) * cs);
  };
  put(G.shoe, skin(sampleGrid(upper, 64, 14, { closedU: true, from: [0, 0.04, 0] }), 0.7, 0.09));
  const A0 = 1.08, rim = [];
  for (let k = 0; k <= 40; k++) { const [x, y, z] = rimPt(lerp(A0, TAU - A0, k / 40)); rim.push(V3(x, y + 0.001, z)); }
  put(G.shoe, tube(rim, (t) => lerp(0.0016, 0.0045, smoothstep(0, -0.045, rimPt(lerp(A0, TAU - A0, t))[0])), { tubular: 60, radial: 6 }));
  // lining down into the shoe
  const LR = [[1, 0], [0.93, 0.012], [0.85, 0.04], [0.5, 0.058], [0.02, 0.058]];
  put(G.lining, skin(sampleGrid((u, v, o) => { const [x, y, z] = rimPt(-u * TAU), q = LR[Math.round(v * (LR.length - 1))]; return o.set(-0.04 + (x + 0.04) * q[0], y - q[1], zc(x) + (z - zc(x)) * q[0]); }, 48, LR.length - 1, { closedU: true, face: [0, 1, 0] }), 0.3, 0.08));
  // padded tongue standing up out of the throat
  const tongue = (u, v, o) => { const s = u * 2 - 1, x = lerp(0.06, -0.064, v), xr = Math.max(x, -0.03); return o.set(x, hTop(xr) - 0.0055 + Math.max(0, -0.03 - x) * 0.7 - 0.007 * s * s - Math.max(0, x - 0.045) * 0.3, zc(x) + s * lerp(0.019, 0.027, v)); };
  put(G.shoe, thick(sampleGrid(tongue, 8, 18), 0.005, 0.05, 0.13));
  put(G.tab, roundedBox(0.004, 0.03, 0.02, { r: 0.0015, rs: 2 }).translate(-L / 2 + 0.0035, 0.076, zc(-L / 2)));
  // laces: five rows crossing over the tongue, tied in a bow that has flopped over the sides
  const eye = (k, sg) => { const x = 0.042 - k * 0.0155; return V3(x, hTop(x) + 0.002, zc(x) + sg * (gapAt(x) + 0.0075)); };
  put(G.lace, tube([eye(0, -1), eye(0, 0), eye(0, 1)], 0.0017, { tubular: 6, radial: 5 }));
  for (let k = 0; k < 4; k++) for (const sg of [-1, 1]) {
    const a = eye(k, sg), b = eye(k + 1, -sg), mid = a.clone().lerp(b, 0.5); mid.y += sg > 0 ? 0.0055 : 0.003;
    put(G.lace, tube([a, mid, b], 0.0017, { tubular: 8, radial: 5 }));
  }
  const xk = -0.024, yk = hTop(xk) + 0.007, K = V3(xk, yk, zc(xk));
  put(G.lace, new THREE.SphereGeometry(0.0042, 8, 6).translate(K.x, K.y, K.z));
  for (const sg of [-1, 1]) {
    const Q = (dx, y, dz) => V3(xk + dx, y, zc(xk) + sg * dz);
    put(G.lace, tube([K.clone(), Q(0.008, yk + 0.003, 0.014), Q(0.016, yk - 0.012, 0.034), Q(0.008, yk - 0.026, 0.046), Q(-0.008, yk - 0.014, 0.035), Q(-0.006, yk + 0.001, 0.013), Q(-0.001, yk, 0.001)], 0.0017, { tubular: 22, radial: 5 }));
    put(G.lace, tube([K.clone(), Q(0.014 + 0.004 * sg, yk + 0.001, 0.012), Q(0.03 + 0.006 * sg, yk - 0.022, 0.041), Q(0.04, yk - 0.05, 0.052), Q(0.045, yk - 0.07, 0.0545)], 0.0017, { tubular: 16, radial: 5 }));
  }
}
function buildSneakers(root, m, ctx) {
  const G = { gum: [], sole: [], shoe: [], lining: [], lace: [], tab: [] };
  sneaker(-1, M4(4.6, 0, 2.345, 0.14), G); sneaker(1, M4(4.582, 0, 2.478, -0.24), G);
  add(root, merge(G.gum), m.gum, 'sneakerOutsoles'); add(root, merge(G.sole), m.sole, 'sneakerSoles'); add(root, merge(G.shoe), m.shoe, 'sneakers');
  add(root, merge(G.lining), m.lining, 'sneakerLining'); add(root, merge(G.lace), m.lace, 'sneakerLaces', FLAT); add(root, merge(G.tab), m.heelTab, 'sneakerTabs', FLAT);
  ctx.colliders.push({ min: [4.46, 0, 1.86], max: [4.8, 1.8, 2.56] });   // shoes and the gown above them
}

// =====================================================================================================
// waste bin in the knee space of the desk
// =====================================================================================================
function buildBin(root, m) {
  const bx = 2.872, bz = 0.31, R0 = 0.094, R1 = 0.114, Hh = 0.272;
  const bin = lath([[0.001, 0.0015], [R0 - 0.006, 0.0015], [R0, 0.006], [R1, Hh - 0.002], [R1 + 0.0016, Hh + 0.0008], [R1 + 0.0004, Hh + 0.0026], [R1 - 0.0018, Hh], [R0 - 0.002, 0.009], [R0 - 0.01, 0.0065], [0.001, 0.0065]], 44, 0.028);
  add(root, bin.translate(bx, 0, bz), m.bin, 'wasteBin');
  const balls = [];
  for (const [x, y, z, r, s, ry] of [[-0.03, 0.2, 0.012, 0.043, 3, 0.4], [0.038, 0.215, -0.03, 0.038, 9, 1.9], [0.012, 0.243, 0.04, 0.036, 14, 3.1], [-0.072, 0.031, 0.19, 0.036, 21, 0.9]]) balls.push(paperBall(r, s).rotateY(ry).translate(bx + x, y, bz + z));
  add(root, merge(balls), m.paper, 'paperBalls');
}

// =====================================================================================================
// string of globe lights (off) in loose swags above the bed, a few photos pegged to it
// =====================================================================================================
function buildLights(root, m, ctx) {
  const ZW = 3.9925, r = new RNG(4407), anchors = [[0.205, 2.085], [0.6, 2.15], [1.03, 2.135], [1.48, 2.075]];
  const pts = [V3(0.178, 1.665, ZW + 0.001), V3(0.184, 1.82, ZW), V3(0.196, 1.98, ZW)];
  for (let k = 0; k < anchors.length; k++) {
    const [x0, y0] = anchors[k]; pts.push(V3(x0, y0, ZW + 0.003));
    if (k === anchors.length - 1) break;
    const [x1, y1] = anchors[k + 1], sag = r.range(0.075, 0.105);
    for (let q = 1; q < 6; q++) { const t = q / 6; pts.push(V3(lerp(x0, x1, t), lerp(y0, y1, t) - sag * 4 * t * (1 - t), ZW - 0.002 * Math.sin(PI * t))); }
  }
  pts.push(V3(1.512, 1.99, ZW), V3(1.522, 1.9, ZW), V3(1.519, 1.83, ZW));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), len = curve.getLength();
  const dark = [tube(pts, 0.0011, { tubular: 280, radial: 5, curve })], bulbs = [], pegs = [], cards = [], P = V3();
  const ph = paintPhotos(), cw = 0.074, ch = 0.091, STEP = 0.105, photoAt = [1, 4, 6, 9, 11];
  let nb = 0, np = 0;
  for (let s = 0.47; s < len - 0.16; s += STEP, nb++) {
    curve.getPointAt(s / len, P);
    bulbs.push(new THREE.SphereGeometry(0.0095, 10, 8).translate(P.x, P.y - 0.0142, P.z - 0.0025));
    dark.push(new THREE.CylinderGeometry(0.0034, 0.0034, 0.006, 8).translate(P.x, P.y - 0.0035, P.z - 0.001));
    if (!photoAt.includes(nb) || np >= ph.n) continue;
    curve.getPointAt((s + STEP * 0.5) / len, P);
    const tilt = r.range(-0.09, 0.09), g = gridPlane(cw, ch, 0.04), uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, (np + uv.getX(i) / cw) / ph.n, uv.getY(i) / ch); pos.setZ(i, 0.004 * (pos.getX(i) / cw) ** 2 * 4 + 0.003 * (0.5 - pos.getY(i) / ch)); }
    g.computeVertexNormals();
    cards.push(g.translate(0, -ch / 2 - 0.004, 0).rotateY(PI).rotateZ(tilt).translate(P.x, P.y, ZW - 0.003));
    pegs.push(roundedBox(0.007, 0.024, 0.006, { r: 0.001, rs: 1 }).translate(0, -0.006, 0).rotateZ(tilt).translate(P.x, P.y, ZW - 0.004));
    np++;
  }
  dark.push(roundedBox(0.032, 0.07, 0.018, { r: 0.004, rs: 2 }).translate(0.178, 1.632, 3.99));     // battery box at the end of the lead
  const clips = anchors.map(([x, y]) => roundedBox(0.012, 0.017, 0.005, { r: 0.002, rs: 2 }).translate(x, y - 0.002, 3.9972));
  add(root, merge(dark), m.wire, 'lightString', FLAT); add(root, merge(bulbs), m.bulb, 'lightBulbs', FLAT);
  add(root, merge(clips), ctx.M.plasticWhite, 'lightClips', FLAT); add(root, merge(pegs), m.oak, 'photoPegs', FLAT);
  add(root, merge(cards), pbr({ map: canvasTex(ph.cv, { srgb: true, wrap: false }), roughness: 0.55 }, { bake: { albedo: ph.avg } }), 'photos', FLAT);
}

// =====================================================================================================
// map print in a wooden hanger on the back wall
// =====================================================================================================
function buildPoster(root, m, ctx) {
  const cx = 2.94, cy = 1.5, w = 0.5, h = 0.7, ZW = 4.0, art = paintPoster();
  const g = gridPlane(w, h, 0.035), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / w, v = pos.getY(i) / h; pos.setZ(i, 0.005 * Math.cos(PI * u) * (0.4 + 0.6 * Math.cos(PI * v)) + 0.0025 * Math.sin(v * 7 + u * 3)); }
  g.computeVertexNormals();
  add(root, g.rotateY(PI).translate(cx, cy, ZW - 0.0065), pbr({ map: canvasTex(art.cv, { srgb: true, wrap: false, repeat: [1 / w, 1 / h] }), roughness: 0.8 }, { bake: { albedo: art.avg } }), 'poster', FLAT);
  const bars = [], B = { r: 0.002, rs: 2, maxEdge: 0.06 }, yT = cy + h / 2, yB = cy - h / 2;
  for (const y of [yT - 0.004, yB - 0.014]) bars.push(boxAt(cx - w / 2 - 0.012, y, ZW - 0.0145, w + 0.024, 0.018, 0.014, B));
  add(root, merge(bars), m.oak, 'posterHanger', FLAT);
  const nail = V3(cx, yT + 0.135, ZW - 0.006), cord = [];
  for (const sg of [-1, 1]) cord.push(tube([V3(cx + sg * 0.2, yT + 0.012, ZW - 0.008), nail.clone().lerp(V3(cx + sg * 0.2, yT + 0.012, ZW - 0.008), 0.5), nail], 0.0009, { tubular: 6, radial: 5 }));
  cord.push(new THREE.CylinderGeometry(0.0022, 0.0022, 0.01, 8).rotateX(PI / 2).translate(nail.x, nail.y, ZW - 0.005));
  add(root, merge(cord), m.wire, 'posterCord', FLAT);
}

// =====================================================================================================
// rolled yoga mat on top of the wardrobe, in front of the box
// =====================================================================================================
function buildMat(root, m) {
  const R0 = 0.013, PITCH = 0.0052, TURNS = 8, TH = 0.0042, LEN = 0.61, th1 = TURNS * TAU, RO = R0 + PITCH * TURNS;
  const fn = (u, v, o) => { const th = u * th1, r = R0 + (PITCH * th) / TAU, a = th - th1 - PI / 2 - 0.5; return o.set((v - 0.5) * LEN, r * Math.sin(a), r * Math.cos(a)); };
  const m4 = M4(4.168, 2.1205 + RO + TH / 2, 0.541, 0.025);
  add(root, thick(sampleGrid(fn, TURNS * 24, 10), TH, 2.0, LEN).applyMatrix4(m4), m.mat, 'yogaMat');
  const bands = [-0.2, 0.19].map((x) => new THREE.TorusGeometry(RO + TH / 2 + 0.0012, 0.0023, 6, 40).rotateY(PI / 2).translate(x, 0, 0).applyMatrix4(m4));
  add(root, merge(bands), m.band, 'yogaMatBands', FLAT);
}

// =====================================================================================================
// books stacked on the floor by the left wall, a mug left on top
// =====================================================================================================
function buildBooks(root, m, ctx) {
  const X0 = 0.205, Z0 = 1.21, CT = 0.0028;
  const list = [
    { w: 0.235, d: 0.3, t: 0.028, col: [84, 102, 116], ink: '#e9e3d3', title: 'ATLAS OF QUIET PLACES', sub: 'second edition', ry: 0.04, dx: 0, dz: 0 },
    { w: 0.215, d: 0.28, t: 0.019, col: [176, 106, 80], ink: '#f3e7d6', title: 'NOTES ON CLAY', sub: 'R. HALDEN', ry: -0.07, dx: 0.006, dz: -0.006 },
    { w: 0.23, d: 0.295, t: 0.011, col: [232, 228, 218], ink: '#2b2a28', title: 'velda  —  no. 12', sub: 'ROOMS · LIGHT · QUIET', ry: 0.12, dx: -0.004, dz: 0.008 },
    { w: 0.19, d: 0.25, t: 0.033, col: [62, 84, 70], ink: '#e6dcc0', title: 'A FIELD GUIDE TO MOSSES', sub: '', ry: -0.03, dx: 0.012, dz: -0.014 },
    { w: 0.165, d: 0.23, t: 0.021, col: [203, 186, 150], ink: '#3a2f25', title: 'The Slow Garden', sub: 'IDA MAREN', ry: 0.2, dx: -0.002, dz: 0.012 },
  ];
  // spines, one row per book
  const RW = 512, RH = 40, cv = makeCanvas(RW, RH * list.length), c = cv.getContext('2d', { willReadFrequently: true });
  list.forEach((o, k) => {
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgb(${o.col[0]},${o.col[1]},${o.col[2]})`; c.fillRect(0, k * RH, RW, RH);
    const sx = (RW / o.d) / (RH / o.t), fs = clamp(0.0085 / o.t, 0.3, 0.62) * RH;   // keep the letters square on the spine
    c.setTransform(sx, 0, 0, 1, 0, 0); c.fillStyle = o.ink; c.textBaseline = 'middle';
    c.textAlign = 'left'; c.font = `600 ${fs.toFixed(1)}px ${o.title === o.title.toUpperCase() ? SANS : SERIF}`; c.fillText(o.title, 26 / sx, k * RH + RH / 2 + 1);
    c.textAlign = 'right'; c.font = `${(fs * 0.62).toFixed(1)}px ${SANS}`; c.fillText(o.sub, (RW - 26) / sx, k * RH + RH / 2 + 1);
  });
  c.setTransform(1, 0, 0, 1, 0, 0);
  const pages = [], labels = [];
  let y = 0.0005, topM4 = null;
  list.forEach((o, k) => {
    const m4 = M4(X0 + o.dx, y, Z0 + o.dz, o.ry), B = { r: 0.0012, rs: 2, maxEdge: 0.05 };
    const cover = merge([boxAt(-o.w / 2, 0, -o.d / 2, o.w, CT, o.d, B), boxAt(-o.w / 2, o.t - CT, -o.d / 2, o.w, CT, o.d, B), boxAt(o.w / 2 - CT, 0, -o.d / 2, CT, o.t, o.d, B)]).applyMatrix4(m4);
    add(root, cover, pbr({ color: sc(o.col[0] / 255, o.col[1] / 255, o.col[2] / 255), roughness: 0.78 }), 'bookCover' + k);
    pages.push(boxAt(-o.w / 2 + 0.004, CT, -o.d / 2 + 0.004, o.w - 0.004 - CT, o.t - 2 * CT, o.d - 0.008, { r: 0.0005, rs: 1, maxEdge: 0.05 }).applyMatrix4(m4));
    const lb = gridPlane(o.d - 0.003, o.t - 0.0026, 0.06), uv = lb.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (o.d - 0.003), 1 - (k + 1 - uv.getY(i) / (o.t - 0.0026)) / list.length);
    labels.push(lb.rotateY(PI / 2).translate(o.w / 2 + 0.0003, o.t / 2, 0).applyMatrix4(m4));
    y += o.t + 0.0003; topM4 = m4;
  });
  add(root, merge(pages), m.pages, 'bookPages');
  add(root, merge(labels), pbr({ map: canvasTex(cv, { srgb: true, wrap: false }), roughness: 0.78 }, { bake: { albedo: avgColor(c.getImageData(0, 0, RW, RH * list.length).data) } }), 'bookSpines', FLAT);
  // mug
  const mm = M4(X0 - 0.025, y, Z0 + 0.04, 2.2);
  const mug = merge([
    lath([[0.001, 0.001], [0.035, 0.001], [0.0385, 0.004], [0.0405, 0.088], [0.0398, 0.0905], [0.0385, 0.0885], [0.0365, 0.009], [0.001, 0.007]], 36, 0.02),
    new THREE.TorusGeometry(0.023, 0.0052, 8, 18, PI).rotateZ(-PI / 2).scale(0.85, 1, 1).translate(0.0395, 0.047, 0),
  ]).applyMatrix4(mm);
  add(root, mug, m.mug, 'mug');
  void topM4;
  ctx.colliders.push({ min: [0.02, 0, 1.03], max: [0.36, 0.24, 1.39] });
}

// =====================================================================================================
// cork pinboard on the left wall at the foot of the bed
// =====================================================================================================
function paintBoard(pins) {
  const W = 620, H = 440, cv = makeCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true }), r = new RNG(9917);
  const img = c.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = (y * W + x) * 4, g = hash2(x >> 1, y >> 1, 11), k = 0.86 + 0.16 * vnoise2(x / 5, y / 5, 13) + (g > 0.9 ? -0.2 : g < 0.07 ? 0.12 : 0) + 0.06 * vnoise2(x / 60, y / 60, 17);
    d[j] = 182 * k; d[j + 1] = 143 * k; d[j + 2] = 100 * k; d[j + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  // a sheet of paper lying on the cork: soft contact shadow, slight rotation; draw() works in paper coordinates
  const sheet = (x, y, w, h, rot, col, draw, pin = [0.5, 0.07]) => {
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot);
    c.shadowColor = 'rgba(40,24,10,0.45)'; c.shadowBlur = 7; c.shadowOffsetX = -3; c.shadowOffsetY = 4;
    c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h);
    c.shadowColor = 'transparent'; c.translate(-w / 2, -h / 2);
    if (draw) draw(w, h);
    c.restore();
    if (pin) { const px = (pin[0] - 0.5) * w, py = (pin[1] - 0.5) * h; pins.push([x + w / 2 + px * Math.cos(rot) - py * Math.sin(rot), y + h / 2 + px * Math.sin(rot) + py * Math.cos(rot)]); }
  };
  // month sheet of a wall calendar
  sheet(34, 44, 176, 236, -0.025, '#f1eee6', (w, h) => {
    c.fillStyle = '#b5553c'; c.fillRect(0, 0, w, 44);
    c.fillStyle = '#f6efe2'; c.textAlign = 'left'; c.font = `600 22px ${SERIF}`; c.fillText('May', 14, 30);
    c.textAlign = 'right'; c.font = `11px ${SANS}`; c.fillText('week 18 – 22', w - 12, 28);
    c.fillStyle = '#4a4744'; c.textAlign = 'center'; c.font = `10px ${SANS}`;
    'MTWTFSS'.split('').forEach((ch, i) => c.fillText(ch, 20 + i * 22.6, 64));
    c.font = `12px ${SANS}`;
    for (let n = 1; n <= 31; n++) { const q = n + 2, col = q % 7, row = Math.floor(q / 7); c.fillStyle = col > 4 ? '#b5553c' : '#35332f'; c.fillText(String(n), 20 + col * 22.6, 90 + row * 28); }
    c.strokeStyle = '#3d6a8a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(20 + 3 * 22.6, 86 + 2 * 28, 10, 9, 0.2, 0, TAU); c.stroke();
    c.strokeStyle = '#b5553c'; c.beginPath(); c.moveTo(12 + 1 * 22.6, 94 + 3 * 28); c.lineTo(28 + 3 * 22.6, 93 + 3 * 28); c.stroke();
  });
  // postcards
  sheet(236, 30, 150, 106, 0.05, '#e9e2d0', (w, h) => {
    c.fillStyle = '#7f9a8c'; c.fillRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#d9b274'; c.beginPath(); c.arc(w * 0.68, h * 0.42, 17, 0, TAU); c.fill();
    c.fillStyle = '#4c6a63'; c.beginPath(); c.moveTo(8, h - 8); c.lineTo(w * 0.3, h * 0.45); c.lineTo(w * 0.52, h * 0.7); c.lineTo(w * 0.7, h * 0.52); c.lineTo(w - 8, h - 8); c.fill();
  });
  sheet(418, 52, 104, 148, -0.06, '#22303d', (w, h) => {
    c.strokeStyle = '#e7dcc4'; c.lineWidth = 1.3;
    for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(w / 2, h * 0.46, 8 + k * 6, 0, TAU); c.stroke(); }
    c.fillStyle = '#e7dcc4'; c.textAlign = 'center'; c.font = `9px ${SANS}`; c.fillText('LISTENING ROOM', w / 2, h - 14);
  });
  // lined note with a few lines of handwriting, a sticky note, a ticket, a strip of four small photos
  sheet(250, 168, 138, 176, 0.03, '#f4f1e8', (w, h) => {
    c.strokeStyle = 'rgba(120,150,190,0.5)'; c.lineWidth = 1; for (let y = 30; y < h - 10; y += 16) { c.beginPath(); c.moveTo(10, y); c.lineTo(w - 10, y); c.stroke(); }
    c.strokeStyle = '#2f3a52'; c.lineWidth = 1.3;
    for (let k = 0; k < 6; k++) { const y0 = 27 + k * 16, len = r.range(0.45, 0.95) * (w - 26); c.beginPath(); for (let x = 0; x < len; x += 3) c.lineTo(13 + x, y0 - 3 + 3.2 * Math.sin(x * 0.55 + k * 2) * (0.5 + 0.5 * Math.sin(x * 0.13 + k))); c.stroke(); }
  });
  sheet(404, 232, 92, 92, 0.09, '#e6cf6e', (w, h) => {
    c.strokeStyle = '#4a4330'; c.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = 0; x < w - 30 - k * 12; x += 3) c.lineTo(14 + x, 30 + k * 19 + 3 * Math.sin(x * 0.6 + k * 1.7)); c.stroke(); }
  }, [0.5, 0.1]);
  sheet(60, 316, 150, 62, 0.04, '#e9dcc0', (w, h) => {
    c.strokeStyle = '#8a6f4a'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(w * 0.72, 0); c.lineTo(w * 0.72, h); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#5a3f2c'; c.textAlign = 'left'; c.font = `600 14px ${SERIF}`; c.fillText('Lantern Cinema', 10, 24);
    c.font = `9px ${SANS}`; c.fillText('ROW 7   SEAT 12   20:30', 10, 44); c.font = `600 15px ${SANS}`; c.fillText('07', w * 0.78, 38);
  }, [0.1, 0.5]);
  sheet(536, 196, 52, 196, 0.02, '#f0ede6', (w, h) => {
    ['#5b6e7a', '#3a4650', '#8a7a68', '#4d5b4c'].forEach((col, k) => { c.fillStyle = col; c.fillRect(5, 6 + k * 46, w - 10, 40); c.fillStyle = 'rgba(240,220,190,0.35)'; c.beginPath(); c.arc(w / 2 + (k % 2 ? 5 : -4), 22 + k * 46, 8, 0, TAU); c.fill(); });
  }, [0.5, 0.03]);
  return { cv, W, H, avg: avgColor(c.getImageData(0, 0, W, H).data) };
}
function buildPinboard(root, m) {
  const zc = 1.565, yc = 1.46, w = 0.62, h = 0.44, fw = 0.017, fd = 0.015, pins = [], art = paintBoard(pins);
  const face = gridPlane(w, h, 0.04).rotateY(PI / 2).translate(0.0075, yc, zc);          // faces +x; u runs towards -z
  add(root, face, pbr({ map: canvasTex(art.cv, { srgb: true, wrap: false, repeat: [1 / w, 1 / h] }), roughness: 0.88 }, { bake: { albedo: art.avg } }), 'pinboard', FLAT);
  const B = { r: 0.002, rs: 2, maxEdge: 0.06 }, z0 = zc - w / 2, y0 = yc - h / 2;
  const swap = (g) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i)); return g; };
  add(root, merge([
    boxAt(0.0003, y0 - fw, z0 - fw, fd, fw, w + 2 * fw, B), boxAt(0.0003, y0 + h, z0 - fw, fd, fw, w + 2 * fw, B),
    swap(boxAt(0.0003, y0, z0 - fw, fd, h, fw, B)), swap(boxAt(0.0003, y0, z0 + w, fd, h, fw, B)),
  ]), m.oak, 'pinboardFrame', FLAT);
  // push pins: canvas x runs along -z (the board is seen from +x), canvas y runs down
  const heads = [], cols = [];
  pins.forEach(([px, py], k) => {
    const z = zc + w / 2 - (px / art.W) * w, y = yc + h / 2 - (py / art.H) * h;
    (k % 3 === 0 ? cols : heads).push(lath([[0.0001, 0], [0.0042, 0], [0.0042, 0.002], [0.002, 0.0035], [0.002, 0.007], [0.004, 0.0085], [0.004, 0.0105], [0.0001, 0.011]], 10, 0.01).rotateZ(-PI / 2).translate(0.0078, y, z));
  });
  add(root, merge(heads), pbr({ color: sc(0.86, 0.85, 0.82), roughness: 0.35 }), 'pinsWhite', FLAT);
  add(root, merge(cols), pbr({ color: sc(0.7, 0.3, 0.22), roughness: 0.35 }), 'pinsRed', FLAT);
}

// =====================================================================================================
export function build(ctx) {
  const t0 = performance.now(), root = group('decor'), m = makeMats(), log = [];
  const count = () => { let n = 0; root.traverse((o) => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; };
  let prev = 0;
  for (const [name, fn] of [['hamper', buildHamper], ['backpack', buildBackpack], ['rail', buildRail], ['robe', buildRobe], ['scarf', buildScarf], ['sneakers', buildSneakers], ['bin', buildBin], ['lights', buildLights], ['poster', buildPoster], ['mat', buildMat], ['books', buildBooks], ['pinboard', buildPinboard]]) {
    const t1 = performance.now(); fn(root, m, ctx);
    const n = count(); log.push(`${name} ${((n - prev) / 1000).toFixed(1)}k/${(performance.now() - t1).toFixed(0)}ms`); prev = n;
  }
  let bad = 0;
  root.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) { bad++; console.warn('[boot] decor: NaN in ' + o.name); break; } });
  root.userData.tris = prev;
  console.log(`[boot] decor: ${Math.round(prev / 1000)}k tris, ${(performance.now() - t0).toFixed(0)} ms (${log.join(', ')})${bad ? ' NaN meshes: ' + bad : ''}`);
  return root;
}
