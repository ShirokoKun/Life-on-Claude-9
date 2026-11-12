// Lived-in clutter: a knit cardigan thrown over the back of the desk chair, a canvas tote hanging from the
// wardrobe handle, felt slippers by the bed, a water bottle on the desk, a few magazines on the floor, a phone
// charger in the socket by the bed with its cable left on the floor, a pair of socks in front of the nightstand.
// The cardigan is draped by a small deterministic cloth solve (position based dynamics against the chair
// shell); everything else is parametric. All geometry is emitted in world space.
import * as THREE from 'three';
import { roundedBox, boxAt, lathe, merge, mesh, group, surface } from '../../core/geo.js';
import { makeCanvas, canvasTex, field, normalTex, avgColor } from '../../core/tex.js';
import { RNG, fbm2, vnoise2, hash2, clamp, lerp, smoothstep } from '../../core/rng.js';
import { sc, pbr, fabric, lacquerNormal } from '../materials.js';

export const order = 60;
export const label = 'things';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lin = (c) => Math.pow(c, 2.2);
function M4(px, py, pz, ry = 0, rx = 0, rz = 0) {
  return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(px, py, pz);
}

// =====================================================================================================
// generic helpers
// =====================================================================================================
/** Smooth 1D interpolation through [t, value] pairs (non-uniform Catmull-Rom). */
function spline1(pts) {
  const n = pts.length;
  return (t) => {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (t > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const dt = p2[0] - p1[0], u = (t - p1[0]) / dt, u2 = u * u, u3 = u2 * u;
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * dt, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * dt;
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  };
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
/** lathe() with long profile segments split up, so tall walls get rows of vertices for the baked light. */
function lath(profile, segs, maxSeg = 0.012) {
  const out = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSeg));
    for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return lathe(out, segs);
}
function geoFrom(pos, nor, uv, idx, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
function white(g) { g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; }

// ---- thick cloth sheets ------------------------------------------------------------------------------
// A sheet is a grid G = { W, H, P (xyz), uv, col, th } of mid-surface points. It is drawn as two skins pushed
// apart by the thickness th, joined by a rolled edge wherever a side of the grid is a real hem.
function gridNormals(G) {
  const { W, H, P } = G, N = (G.N = new Float32Array(W * H * 3));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = (j * W + Math.min(W - 1, i + 1)) * 3, b = (j * W + Math.max(0, i - 1)) * 3, c = (Math.min(H - 1, j + 1) * W + i) * 3, d = (Math.max(0, j - 1) * W + i) * 3;
    const ux = P[a] - P[b], uy = P[a + 1] - P[b + 1], uz = P[a + 2] - P[b + 2], vx = P[c] - P[d], vy = P[c + 1] - P[d + 1], vz = P[c + 2] - P[d + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz), k = (j * W + i) * 3;
    if (l > 1e-14) { N[k] = nx / l; N[k + 1] = ny / l; N[k + 2] = nz / l; }
    else if (j > 0) { const q = ((j - 1) * W + i) * 3; N[k] = N[q]; N[k + 1] = N[q + 1]; N[k + 2] = N[q + 2]; }
    else N[k + 1] = 1;
  }
}
function perimeter(W, r0, r1) {
  const out = [];
  for (let i = 0; i < W - 1; i++) out.push([i, r0, 'v0']);
  for (let j = r0; j < r1; j++) out.push([W - 1, j, 'u1']);
  for (let i = W - 1; i > 0; i--) out.push([i, r1, 'v1']);
  for (let j = r1; j > r0; j--) out.push([0, j, 'u0']);
  return out;
}
/** Outward direction (in the sheet, across the edge) for every boundary point of the grid. */
function boundaryDirs(G) {
  const { W, H, P, N } = G, To = (G.To = new Float32Array(W * H * 3)), loop = perimeter(W, 0, H - 1), L = loop.length;
  for (let m = 0; m < L; m++) {
    const [i, j] = loop[m], [ia, ja] = loop[(m + 1) % L], [ib, jb] = loop[(m - 1 + L) % L];
    const k = (j * W + i) * 3, a = (ja * W + ia) * 3, b = (jb * W + ib) * 3;
    const bx = P[a] - P[b], by = P[a + 1] - P[b + 1], bz = P[a + 2] - P[b + 2];
    let tx = by * N[k + 2] - bz * N[k + 1], ty = bz * N[k] - bx * N[k + 2], tz = bx * N[k + 1] - by * N[k];
    const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    const ii = i === 0 ? 1 : i === W - 1 ? W - 2 : i, jj = j === 0 ? 1 : j === H - 1 ? H - 2 : j, q = (jj * W + ii) * 3;
    const s = tx * (P[k] - P[q]) + ty * (P[k + 1] - P[q + 1]) + tz * (P[k + 2] - P[q + 2]) < 0 ? -1 : 1;
    To[k] = tx * s; To[k + 1] = ty * s; To[k + 2] = tz * s;
  }
}
/** Rows r0..r1 of a sheet as a closed thick mesh. rim: which sides get a rolled hem { v0, v1, u0, u1 }. */
function thickSheet(G, r0, r1, rim, RS = 4) {
  const { W, P, N, To, uv, col, th } = G, rows = r1 - r0 + 1;
  const pos = [], nor = [], uvs = [], cols = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = r0; j <= r1; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, k3 = k * 3, h = th[k] * side, c = col[k];
      pos.push(P[k3] + N[k3] * h, P[k3 + 1] + N[k3 + 1] * h, P[k3 + 2] + N[k3 + 2] * h);
      nor.push(N[k3] * side, N[k3 + 1] * side, N[k3 + 2] * side); uvs.push(uv[k * 2], uv[k * 2 + 1]); cols.push(c, c, c);
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < W - 1; i++) { const a = base + j * W + i, b = a + 1, c = a + W + 1, d = a + W; idx.push(a, b, c, a, c, d); }
  }
  const loop = perimeter(W, r0, r1), L = loop.length, base = pos.length / 3, R = RS + 1;
  for (const [i, j] of loop) {
    const k = j * W + i, k3 = k * 3, h = th[k], c = col[k];
    for (let q = 0; q <= RS; q++) {
      const a = (q / RS) * Math.PI, cs = Math.cos(a), sn = Math.sin(a);
      const nx = N[k3] * cs + To[k3] * sn, ny = N[k3 + 1] * cs + To[k3 + 1] * sn, nz = N[k3 + 2] * cs + To[k3 + 2] * sn;
      pos.push(P[k3] + nx * h, P[k3 + 1] + ny * h, P[k3 + 2] + nz * h); nor.push(nx, ny, nz); uvs.push(uv[k * 2], uv[k * 2 + 1]); cols.push(c, c, c);
    }
  }
  for (let m = 0; m < L; m++) {
    if (!rim[loop[m][2]]) continue;
    const m2 = (m + 1) % L;
    for (let q = 0; q < RS; q++) { const a = base + m * R + q, b = base + m2 * R + q, c = b + 1, d = a + 1; idx.push(a, b, c, a, c, d); }
  }
  return orient(geoFrom(pos, nor, uvs, idx, cols));
}
/** One level of uniform cubic B-spline refinement of a W x H grid with nc components (edges are kept). */
function refine(src, W, H, nc) {
  const W2 = 2 * W - 1, H2 = 2 * H - 1, tmp = new Float64Array(W2 * H * nc), dst = new Float32Array(W2 * H2 * nc);
  const ev = (g, n, f) => {
    const G = (k) => (k < 0 ? 2 * g(0) - g(1) : k >= n ? 2 * g(n - 1) - g(n - 2) : g(k)), k = f >> 1;
    return f & 1 ? (G(k - 1) + 23 * G(k) + 23 * G(k + 1) + G(k + 2)) / 48 : (G(k - 1) + 4 * G(k) + G(k + 1)) / 6;
  };
  for (let j = 0; j < H; j++) for (let c = 0; c < nc; c++) { const g = (k) => src[(j * W + k) * nc + c]; for (let f = 0; f < W2; f++) tmp[(j * W2 + f) * nc + c] = ev(g, W, f); }
  for (let i = 0; i < W2; i++) for (let c = 0; c < nc; c++) { const g = (k) => tmp[(k * W2 + i) * nc + c]; for (let f = 0; f < H2; f++) dst[(f * W2 + i) * nc + c] = ev(g, H, f); }
  return dst;
}

/** Flat ribbon swept along samples [{ p, w (width direction), hw, ht }] with a stadium cross-section. */
function ribbon(samples) {
  const n = samples.length, ring = [], SEG = 3;
  for (let k = 0; k <= SEG; k++) { const a = -Math.PI / 2 + (k / SEG) * Math.PI; ring.push([1, Math.cos(a), Math.sin(a)]); }
  for (let k = 0; k <= SEG; k++) { const a = Math.PI / 2 + (k / SEG) * Math.PI; ring.push([-1, Math.cos(a), Math.sin(a)]); }
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
      nor.push(Wd.x * c + Nn.x * sn, Wd.y * c + Nn.y * sn, Wd.z * c + Nn.z * sn); uv.push(lx + (ly > 0 ? 0.05 : 0.1), len);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let r = 0; r < R; r++) { const a = i * R + r, b = i * R + ((r + 1) % R), c = b + R, d = a + R; idx.push(a, b, c, a, c, d); }
  return orient(geoFrom(pos, nor, uv, idx));
}

// =====================================================================================================
// textures
// =====================================================================================================
/** Stockinette: columns of little V stitches. One tile = 32 wales x 40 rows (0.16 m at 5 mm per wale). */
function knitNormalTex() {
  const N = 512, WALES = 32, ROWS = 40;
  const H = field(N, N, (u, v) => {
    const x = u * WALES, y = v * ROWS, ix = Math.floor(x), iy = Math.floor(y), fy = y - iy, d = Math.abs(x - ix - 0.5);
    const q = (d - 0.05 - 0.36 * fy) / 0.2;
    return Math.max(0, 1 - q * q) * (0.7 + 0.3 * Math.sin(Math.PI * fy)) * (0.8 + 0.4 * hash2(ix, iy, 91)) + (vnoise2(u * 180, v * 180, 7, 180) - 0.5) * 0.2;
  });
  return normalTex(H, N, N, 3.0);
}
/** 1x1 rib for cuffs and hems: ridges along v, 16 per tile. */
function ribNormalTex() {
  const N = 256, RIBS = 16;
  const H = field(N, N, (u, v) => {
    const x = u * RIBS, ix = Math.floor(x), r = Math.pow(0.5 - 0.5 * Math.cos((x - ix) * TAU), 0.65);
    return r * (0.82 + 0.18 * Math.sin(v * 40 * TAU + ix * 2.1)) + (vnoise2(u * 120, v * 120, 3, 120) - 0.5) * 0.12;
  });
  return normalTex(H, N, N, 2.6);
}
/** Pressed wool felt: matted fibres, no weave. */
function feltNormalTex() {
  const N = 256;
  const H = field(N, N, (u, v) => fbm2(u * 56, v * 56, { oct: 3, seed: 5, period: 56 }) + 0.6 * fbm2(u * 12, v * 96, { oct: 2, seed: 9, period: 12 }) + 0.6 * fbm2(u * 96, v * 12, { oct: 2, seed: 13, period: 96 }));
  return normalTex(H, N, N, 2.4);
}
function pagesTex() {
  const cv = makeCanvas(8, 256), c = cv.getContext('2d'), r = new RNG(60123);
  for (let y = 0; y < 256; y++) { const v = 226 + r.int(-15, 11); c.fillStyle = `rgb(${v + 8},${v + 4},${v - 8})`; c.fillRect(0, y, 8, 1); }
  return canvasTex(cv, { srgb: true, repeat: [1, 14] });
}
/** Natural canvas with the hem stitching and a small ink line drawing (hills and a sun in a ring). */
function totePrint() {
  const W = 512, H = 568, cv = makeCanvas(W * 2, H * 2), c = cv.getContext('2d'), r = new RNG(5521);
  c.scale(2, 2);
  c.fillStyle = '#d8ccb1'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 1100; i++) {
    c.fillStyle = r.chance(0.5) ? 'rgba(120,98,66,0.06)' : 'rgba(255,250,236,0.07)';
    const hz = r.chance(0.5); c.fillRect(r.range(0, W), r.range(0, H), hz ? r.range(6, 44) : 1.4, hz ? 1.4 : r.range(6, 44));
  }
  // doubled top hem: a soft shadow under the fold and two rows of stitches
  c.fillStyle = 'rgba(96,78,50,0.10)'; c.fillRect(0, H * 0.079, W, 5);
  for (const [y, col] of [[H * 0.07, 'rgba(92,76,52,0.35)'], [H * 0.0675, 'rgba(240,232,212,0.95)']]) {
    c.strokeStyle = col; c.lineWidth = 1.8; c.setLineDash([6, 4.5]); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }
  c.setLineDash([]);
  // the print
  const cx = W * 0.5, cy = H * 0.53, R = W * 0.19;
  c.strokeStyle = '#27303a'; c.fillStyle = '#27303a'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 4.2;
  c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
  c.save(); c.beginPath(); c.arc(cx, cy, R - 2, 0, TAU); c.clip();
  c.beginPath(); c.moveTo(cx - R, cy + R * 0.28); c.lineTo(cx - R * 0.42, cy - R * 0.3); c.lineTo(cx - R * 0.08, cy + R * 0.12); c.lineTo(cx + R * 0.34, cy - R * 0.52); c.lineTo(cx + R, cy + R * 0.34); c.stroke();
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx + R * 0.34, cy - R * 0.52); c.lineTo(cx + R * 0.22, cy - R * 0.22); c.lineTo(cx + R * 0.36, cy - R * 0.1); c.stroke();
  for (let k = 0; k < 3; k++) {
    const y0 = cy + R * (0.46 + k * 0.2); c.beginPath();
    for (let i = 0; i <= 40; i++) { const x = cx - R + (i / 40) * 2 * R, y = y0 + Math.sin(i * 0.62 + k * 1.9) * R * 0.045; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
  c.restore();
  c.lineWidth = 3.4; c.beginPath(); c.arc(cx - R * 0.42, cy - R * 0.56, R * 0.13, 0, TAU); c.stroke();
  for (const [bx, by, s] of [[cx + R * 1.18, cy - R * 0.92, 1], [cx + R * 1.42, cy - R * 0.7, 0.75]]) {
    c.beginPath(); c.moveTo(bx - 13 * s, by - 5 * s); c.quadraticCurveTo(bx - 5 * s, by - 9 * s, bx, by); c.quadraticCurveTo(bx + 5 * s, by - 9 * s, bx + 13 * s, by - 5 * s); c.stroke();
  }
  for (let k = -1; k <= 1; k++) { c.beginPath(); c.arc(cx + k * 15, cy + R * 1.32, 2.6, 0, TAU); c.fill(); }
  return canvasTex(cv, { srgb: true, wrap: false });
}

/** Webbing of the tote handles: folded canvas with a row of stitches along each edge. The ribbon's u is metres
 *  across the strap; one tile is the 25 mm width with the fold at u = 0.5 and the middle of the strap at u = 0. */
function strapTex() {
  const W = 128, H = 64, cv = makeCanvas(W, H), c = cv.getContext('2d');
  c.fillStyle = '#d8ccb1'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(96,78,50,0.2)'; c.fillRect(61, 0, 6, H);
  for (const x of [53.8, 74.2]) for (let k = 0; k < 4; k++) {
    c.fillStyle = 'rgba(92,76,52,0.4)'; c.fillRect(x - 0.5, k * 16 + 4, 3, 10);
    c.fillStyle = 'rgba(245,238,220,0.95)'; c.fillRect(x - 1.5, k * 16 + 3, 3, 10);
  }
  return canvasTex(cv, { srgb: true, repeat: [1 / 0.025, 1 / 0.0128] });
}
/** Powder coat of the bottle after a term in a backpack: hairline scuffs, chips along the base edge. */
function scuffTex() {
  const W = 512, H = 512, cv = makeCanvas(W, H), c = cv.getContext('2d'), r = new RNG(7719);
  c.fillStyle = '#546b75'; c.fillRect(0, 0, W, H);
  c.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const y = H * (1 - Math.pow(r.next(), 1.8) * 0.9), x = r.range(0, W), l = r.range(4, 46), a = r.gauss() * 0.25;
    c.strokeStyle = `rgba(190,205,210,${r.range(0.1, 0.4).toFixed(2)})`; c.lineWidth = r.range(0.5, 1.2);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(205,208,210,0.85)'; c.beginPath(); c.ellipse(r.range(0, W), H - r.range(2, 16), r.range(1, 3.2), r.range(0.7, 1.6), r.range(0, 3), 0, TAU); c.fill(); }
  return { tex: canvasTex(cv, { srgb: true }), avg: [0.09, 0.15, 0.18] };
}
/** Woven tab label sewn to the hem of the cardigan. */
function tabTex() {
  const W = 96, H = 128, cv = makeCanvas(W, H), c = cv.getContext('2d');
  c.fillStyle = '#e9e2d0'; c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 2) { c.fillStyle = 'rgba(120,104,80,0.10)'; c.fillRect(0, y, W, 1); }
  c.strokeStyle = '#3b4a44'; c.lineWidth = 3; c.beginPath(); c.arc(W / 2, 46, 17, 0, TAU); c.stroke();
  c.beginPath(); c.moveTo(W / 2 - 11, 52); c.lineTo(W / 2 - 2, 38); c.lineTo(W / 2 + 4, 47); c.lineTo(W / 2 + 11, 52); c.stroke();
  c.fillStyle = '#3b4a44'; c.textAlign = 'center'; c.font = `600 15px ${SANS}`; c.fillText('NORRE', W / 2, 88);
  c.font = `10px ${SANS}`; c.fillText('lambswool', W / 2, 104);
  for (const y of [5, H - 6]) for (let x = 6; x < W - 6; x += 9) { c.fillStyle = 'rgba(90,84,70,0.55)'; c.fillRect(x, y, 5, 1.6); }
  return canvasTex(cv, { srgb: true, wrap: false });
}

function coverMat(w, d, paint, rough) {
  const PW = 256, PH = Math.round((256 * d) / w), cv = makeCanvas(PW, PH), c = cv.getContext('2d');
  paint(c, PW, PH);
  const data = c.getImageData(0, 0, PW, PH).data;
  return pbr({ map: canvasTex(cv, { srgb: true, wrap: false, repeat: [1 / w, 1 / d] }), roughness: rough }, { bake: { albedo: avgColor(data) } });
}
const SERIF = 'Georgia, "Times New Roman", serif', SANS = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
function paintMagA(c, W, H) {      // quiet design magazine: clay arch on warm paper
  c.fillStyle = '#e6dfd0'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#b6714f'; c.beginPath(); c.moveTo(W * 0.2, H * 0.92); c.lineTo(W * 0.2, H * 0.55); c.arc(W * 0.5, H * 0.55, W * 0.3, Math.PI, 0); c.lineTo(W * 0.8, H * 0.92); c.closePath(); c.fill();
  c.fillStyle = '#d9b274'; c.beginPath(); c.arc(W * 0.7, H * 0.33, W * 0.085, 0, TAU); c.fill();
  c.fillStyle = '#2b2a28'; c.textAlign = 'left'; c.font = `600 ${W * 0.17}px ${SERIF}`; c.fillText('velda', W * 0.09, H * 0.17);
  c.font = `${W * 0.04}px ${SANS}`; c.fillText('ROOMS  ·  LIGHT  ·  QUIET  —  no. 14', W * 0.095, H * 0.215);
}
function paintMagB(c, W, H) {      // travel quarterly: sea-green block with a horizon
  c.fillStyle = '#51706b'; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, H * 0.3, 0, H * 0.9); g.addColorStop(0, '#cfd8d2'); g.addColorStop(0.55, '#e7d3bb'); g.addColorStop(0.56, '#7d9a98'); g.addColorStop(1, '#3f6163');
  c.fillStyle = g; c.fillRect(W * 0.1, H * 0.3, W * 0.8, H * 0.6);
  c.fillStyle = '#f1ece0'; c.textAlign = 'left'; c.font = `${W * 0.15}px ${SERIF}`; c.fillText('ormo', W * 0.1, H * 0.16);
  c.font = `${W * 0.04}px ${SANS}`; c.fillText('A QUARTERLY OF SLOW JOURNEYS', W * 0.1, H * 0.215);
  c.textAlign = 'right'; c.font = `italic ${W * 0.06}px ${SERIF}`; c.fillText('winter', W * 0.9, H * 0.16);
}
function paintBook(c, W, H) {      // paperback: ochre with a line of ink shapes
  c.fillStyle = '#c69a45'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#2a2620'; c.textAlign = 'center'; c.font = `600 ${W * 0.125}px ${SERIF}`; c.fillText('The Quiet', W / 2, H * 0.2); c.fillText('Orchard', W / 2, H * 0.29);
  c.strokeStyle = '#2a2620'; c.lineWidth = W * 0.012; c.lineCap = 'round';
  for (let k = 0; k < 5; k++) { const x = W * (0.22 + k * 0.14), y = H * 0.62; c.beginPath(); c.moveTo(x, y + H * 0.1); c.lineTo(x, y); c.stroke(); c.beginPath(); c.arc(x, y - H * 0.045, W * 0.055, 0, TAU); c.stroke(); }
  c.font = `${W * 0.06}px ${SANS}`; c.fillText('I D A   M A R E N', W / 2, H * 0.9);
}

function makeMats() {
  const tile = (t, rx, ry = rx) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  const m = {};
  // cardigan: dusty sage, soft and matt. fabric() gives the cloth shading; the weave is swapped for knit maps.
  const sage = sc(0.5, 0.55, 0.47);
  m.knit = fabric(sage, { slub: 0.6, rough: 0.98, sheen: 0.5, nscale: 1.0 });
  const knitN = knitNormalTex(), ribN = ribNormalTex();
  m.knit.normalMap = tile(knitN, 1 / 0.16); m.knit.vertexColors = true;
  m.rib = fabric(sage, { slub: 0.6, rough: 0.98, sheen: 0.5, nscale: 1.1 });
  m.rib.normalMap = tile(ribN, 1 / 0.16); m.rib.vertexColors = true;
  // tote: natural cotton canvas, threads about 0.8 mm apart
  const canvasCol = sc(0.847, 0.8, 0.694);
  m.canvas = fabric(canvasCol, { slub: 0.6, rep: 13, rough: 0.95, sheen: 0.2, nscale: 0.9 });
  m.canvasPrint = fabric(canvasCol, { slub: 0.6, rep: 13, rough: 0.95, sheen: 0.2, nscale: 0.9, side: THREE.DoubleSide });
  m.canvasPrint.map = totePrint(); m.canvasPrint.color = new THREE.Color(1, 1, 1);
  m.strap = fabric(canvasCol, { slub: 0.6, rep: 13, rough: 0.95, sheen: 0.2, nscale: 0.9 });
  m.strap.map = strapTex(); m.strap.color = new THREE.Color(1, 1, 1);
  // hem tab of the cardigan
  m.tab = pbr({ map: tabTex(), roughness: 0.75 }, { bake: { albedo: [0.76, 0.72, 0.6] } });
  // socks: heather blue-grey, finer gauge than the cardigan
  const sockCol = sc(0.44, 0.43, 0.42);
  m.sock = fabric(sockCol, { slub: 0.6, rough: 0.98, sheen: 0.45, nscale: 0.9 }); m.sock.normalMap = tile(knitN, 1 / 0.07);
  m.sockRib = fabric(sockCol, { slub: 0.6, rough: 0.98, sheen: 0.45, nscale: 1.0 }); m.sockRib.normalMap = tile(ribN, 1 / 0.05);
  // phone charger
  m.whitePlastic = pbr({ color: sc(0.92, 0.92, 0.905), roughness: 0.32 });
  m.cable = pbr({ color: sc(0.88, 0.88, 0.865), roughness: 0.5 });
  // slippers: grey wool felt on a dark felt sole
  const felt = feltNormalTex();
  m.felt = fabric(sc(0.5, 0.49, 0.47), { slub: 0.6, rough: 1, sheen: 0.7, nscale: 1.0 }); m.felt.normalMap = tile(felt, 1 / 0.07);
  m.feltDark = fabric(sc(0.17, 0.17, 0.18), { slub: 0.6, rough: 1, sheen: 0.4, nscale: 0.9 }); m.feltDark.normalMap = tile(felt, 1 / 0.05);
  // bottle
  const lac = (rep, s) => ({ normalMap: tile(lacquerNormal(), rep), normalScale: new THREE.Vector2(s, s) });
  const scuff = scuffTex();
  m.coat = pbr({ map: scuff.tex, roughness: 0.62, ...lac(50, 0.3) }, { bake: { albedo: scuff.avg } });
  m.steel = pbr({ color: sc(0.78, 0.78, 0.79), roughness: 0.36, metalness: 1.0 });
  m.grip = pbr({ color: sc(0.1, 0.1, 0.11), roughness: 0.7 });
  // paper things on the floor
  m.pages = pbr({ map: pagesTex(), roughness: 0.9 }, { bake: { albedo: [0.72, 0.68, 0.58] } });
  m.paperWhite = pbr({ color: sc(0.9, 0.89, 0.85), roughness: 0.6 });
  m.ochre = pbr({ color: sc(0.776, 0.604, 0.27), roughness: 0.62 });
  return m;
}

// =====================================================================================================
// cardigan over the chair back
// =====================================================================================================
const CHAIR = { x: 3.18, z: 1.0, ry: Math.PI - 0.35 };   // must match desk.js (buildChair)

/** The chair's moulded shell, same construction as desk.js: centre-line profile (z forward, y up) + width / wrap. */
function chairShell() {
  const ctrl = [[0.236, 0.392], [0.229, 0.417], [0.207, 0.437], [0.15, 0.444], [0.06, 0.436], [-0.03, 0.428], [-0.1, 0.432], [-0.155, 0.452], [-0.195, 0.492], [-0.222, 0.55], [-0.238, 0.62], [-0.25, 0.7], [-0.263, 0.77], [-0.28, 0.825]];
  const prof = new THREE.SplineCurve(ctrl.map((p) => new THREE.Vector2(p[0], p[1]))), len = prof.getLength();
  const Wf = spline1([[0, 0.2], [0.12, 0.224], [0.3, 0.234], [0.5, 0.232], [0.62, 0.226], [0.78, 0.214], [1, 0.19]]);
  const Df = spline1([[0, 0.02], [0.12, 0.03], [0.3, 0.05], [0.48, 0.08], [0.58, 0.088], [0.72, 0.066], [0.88, 0.044], [1, 0.03]]);
  const c2 = new THREE.Vector2(), t2 = new THREE.Vector2();
  const Q = (s, t, out) => {
    const v = clamp((t + 1) / 2, 0, 1);
    prof.getPointAt(v, c2); prof.getTangentAt(Math.max(v, 0.1), t2);
    const bowl = Df(v) * Math.pow(Math.abs(s), 2.2);
    return out.set(s * Wf(v), c2.y - t2.x * bowl, c2.x + t2.y * bowl);
  };
  const sq = (a, b) => {
    const m = Math.max(Math.abs(a), Math.abs(b)); if (m < 1e-9) return [0, 0];
    const L = Math.hypot(a, b), dx = a / L, dy = b / L, n = lerp(4.6, 3.7, smoothstep(-0.35, 0.35, dy));
    const rho = Math.pow(Math.pow(Math.abs(dx), n) + Math.pow(Math.abs(dy), n), -1 / n);
    return [dx * m * rho, dy * m * rho];
  };
  return { prof, len, Wf, Df, Q, sq };
}

// Garment pattern (metres). The body is one rectangle folded over the top of the chair back: NOUT rows hang
// behind it, NFR rows lie against the front of the back rest. Each sleeve is a strip sewn to the top of a side
// edge of the hanging part, cut so that it already points down and outwards.
const CG = { D: 0.015, NU: 34, NOUT: 33, NFR: 17, NA: 12, NS: 33, DS: 0.0152, PHI: 0.9, RC: 0.14, SHIFT: 0.02, SKEW: 0.07, HEM: 0.06, CUFF: 0.44 };
const sleeveW = (s) => lerp(CG.NA * CG.D, 0.118, smoothstep(0, 0.4, s)) * (1 - 0.25 * smoothstep(0.41, 0.45, s));

// ---- cloth solver kernels (position based dynamics) -----------------------------------------------------
function pbdIntegrate(X, Pp, n3, damp, gr, vmax) {
  const v2max = vmax * vmax;
  for (let k = 0; k < n3; k += 3) {
    let vx = (X[k] - Pp[k]) * damp, vy = (X[k + 1] - Pp[k + 1]) * damp - gr, vz = (X[k + 2] - Pp[k + 2]) * damp;
    const v2 = vx * vx + vy * vy + vz * vz;
    if (v2 > v2max) { const f = vmax / Math.sqrt(v2); vx *= f; vy *= f; vz *= f; }
    Pp[k] = X[k]; Pp[k + 1] = X[k + 1]; Pp[k + 2] = X[k + 2];
    X[k] += vx; X[k + 1] += vy; X[k + 2] += vz;
  }
}
function pbdSweep(X, CA, CB, CR, CF, nc, fwd) {
  for (let q = 0; q < nc; q++) {
    const c = fwd ? q : nc - 1 - q, a = CA[c], b = CB[c];
    const dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-9) continue;
    const f = ((d - CR[c]) / d) * CF[c];
    X[a] += dx * f; X[a + 1] += dy * f; X[a + 2] += dz * f; X[b] -= dx * f; X[b + 1] -= dy * f; X[b + 2] -= dz * f;
  }
}
/** Spheres of radius rs round the points sp (hashed in a grid): push out, stick or slip. Also the floor. */
function pbdShell(X, Pp, n3, sp, start, ord, G, rs, mu, floor) {
  const CS = G[0], bx = G[1], by = G[2], bz = G[3], gx = G[4], gy = G[5], gz = G[6], rs2 = rs * rs;
  let hits = 0;
  for (let k = 0; k < n3; k += 3) {
    let x = X[k], y = X[k + 1], z = X[k + 2];
    if (y < floor) { X[k] = Pp[k]; X[k + 1] = floor; X[k + 2] = Pp[k + 2]; continue; }
    const ix0 = Math.floor((x - rs - bx) / CS), ix1 = Math.floor((x + rs - bx) / CS), iy0 = Math.floor((y - rs - by) / CS), iy1 = Math.floor((y + rs - by) / CS), iz0 = Math.floor((z - rs - bz) / CS), iz1 = Math.floor((z + rs - bz) / CS);
    if (ix1 < 0 || iy1 < 0 || iz1 < 0 || ix0 >= gx || iy0 >= gy || iz0 >= gz) continue;
    let best = rs2, bj = -1;
    for (let cz = Math.max(0, iz0); cz <= Math.min(gz - 1, iz1); cz++) for (let cy = Math.max(0, iy0); cy <= Math.min(gy - 1, iy1); cy++) for (let cx = Math.max(0, ix0); cx <= Math.min(gx - 1, ix1); cx++) {
      const c = (cz * gy + cy) * gx + cx;
      for (let q = start[c]; q < start[c + 1]; q++) {
        const j = ord[q] * 3, ex = x - sp[j], ey = y - sp[j + 1], ez = z - sp[j + 2], d2 = ex * ex + ey * ey + ez * ez;
        if (d2 < best) { best = d2; bj = j; }
      }
    }
    if (bj < 0) continue;
    hits++;
    const d = Math.sqrt(best) || 1e-6, nx = (x - sp[bj]) / d, ny = (y - sp[bj + 1]) / d, nz = (z - sp[bj + 2]) / d, pen = rs - d;
    x = sp[bj] + nx * rs; y = sp[bj + 1] + ny * rs; z = sp[bj + 2] + nz * rs;
    let tx = x - Pp[k], ty = y - Pp[k + 1], tz = z - Pp[k + 2];
    const dn = tx * nx + ty * ny + tz * nz; tx -= dn * nx; ty -= dn * ny; tz -= dn * nz;
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz), fr = tl < 1e-9 ? 0 : ny > 0.35 ? 1 : Math.min(1, (mu * pen) / tl);   // sticks where it bears on top of the shell
    X[k] = x - tx * fr; X[k + 1] = y - ty * fr; X[k + 2] = z - tz * fr;
  }
  return hits;
}
/** The cloth against itself: particle spheres of diameter SD; neighbours in the weave are skipped. */
function pbdSelf(X, n, piece, gu, gv, head, nxt, SD) {
  const n3 = n * 3, SD2 = SD * SD;
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let k = 0; k < n3; k += 3) { const x = X[k], y = X[k + 1], z = X[k + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const nx = Math.floor((x1 - x0) / SD) + 1, ny = Math.floor((y1 - y0) / SD) + 1, nz = Math.floor((z1 - z0) / SD) + 1;
  if (nx * ny * nz > head.length) return;
  head.fill(-1, 0, nx * ny * nz);
  for (let i = 0, k = 0; i < n; i++, k += 3) { const c = (Math.floor((X[k + 2] - z0) / SD) * ny + Math.floor((X[k + 1] - y0) / SD)) * nx + Math.floor((X[k] - x0) / SD); nxt[i] = head[c]; head[c] = i; }
  for (let i = 0, k = 0; i < n; i++, k += 3) {
    const ix = Math.floor((X[k] - x0) / SD), iy = Math.floor((X[k + 1] - y0) / SD), iz = Math.floor((X[k + 2] - z0) / SD);
    for (let cz = Math.max(0, iz - 1); cz <= Math.min(nz - 1, iz + 1); cz++) for (let cy = Math.max(0, iy - 1); cy <= Math.min(ny - 1, iy + 1); cy++) for (let cx = Math.max(0, ix - 1); cx <= Math.min(nx - 1, ix + 1); cx++) {
      for (let j = head[(cz * ny + cy) * nx + cx]; j >= 0; j = nxt[j]) {
        if (j <= i) continue;
        const k2 = j * 3, ex = X[k2] - X[k], ey = X[k2 + 1] - X[k + 1], ez = X[k2 + 2] - X[k + 2], d2 = ex * ex + ey * ey + ez * ez;
        if (d2 >= SD2 || d2 < 1e-12) continue;
        if (piece[i] === piece[j]) { if (Math.abs(gu[i] - gu[j]) <= 2 && Math.abs(gv[i] - gv[j]) <= 2) continue; }
        else if ((piece[i] && gv[i] <= 2) || (piece[j] && gv[j] <= 2)) continue;
        const d = Math.sqrt(d2), f = ((SD - d) / d) * 0.5;
        X[k] -= ex * f; X[k + 1] -= ey * f; X[k + 2] -= ez * f; X[k2] += ex * f; X[k2 + 1] += ey * f; X[k2 + 2] += ez * f;
      }
    }
  }
}

/** Drapes the cardigan. Returns the settled grids in the chair's local frame (x across, y up, z towards the seat). */
export function simulateCardigan(dbg = null) {
  const { D, NU, NOUT, NFR, NA, NS, DS, PHI, RC, SHIFT, SKEW } = CG;
  const sh = chairShell(), { prof, len, Wf, Df } = sh;
  const NV = NOUT + NFR, Wb = NU * D, LB = NV * D, JS = NOUT - 2;
  // ---- collider: spheres along the shell's mid-surface (back rest + rear half of the seat)
  const sp = [];
  {
    const A = 60, B = 112, p = V3();
    for (let j = 0; j <= B; j++) for (let i = 0; i <= A; i++) { const [s, t] = sh.sq((i / A) * 2 - 1, (j / B) * 2 - 1); sh.Q(s, t, p); if (p.z < 0.07) sp.push(p.x, p.y, p.z); }
  }
  const nSp = sp.length / 3, CS = 0.024, bx = -0.27, by = 0.36, bz = -0.33, gx = 23, gy = 22, gz = 18;
  const start = new Int32Array(gx * gy * gz + 1), ord = new Int32Array(nSp);
  {
    const cell = new Int32Array(nSp);
    for (let k = 0; k < nSp; k++) { cell[k] = (Math.floor((sp[k * 3 + 2] - bz) / CS) * gy + Math.floor((sp[k * 3 + 1] - by) / CS)) * gx + Math.floor((sp[k * 3] - bx) / CS); start[cell[k] + 1]++; }
    for (let c = 0; c < gx * gy * gz; c++) start[c + 1] += start[c];
    const fill = start.slice(0, gx * gy * gz);
    for (let k = 0; k < nSp; k++) ord[fill[cell[k]]++] = k;
  }
  // ---- initial pose: an inverted U over the rim, flat across; the overhang falls into place during the solve
  const top = prof.getPointAt(1), tt = prof.getTangentAt(1), Z0 = top.x, Y0 = top.y, RHO = 0.017, THM = Math.atan2(tt.y, -tt.x), RPIN = 0.0105;
  const c2 = new THREE.Vector2(), t2 = new THREE.Vector2();
  const bowlAt = (x, v) => Df(v) * Math.pow(Math.min(Math.abs(x) / Wf(v), 1.3), 2.2);
  const place = (a, b, zo, out, k) => {
    const q = NOUT * D + SKEW * clamp(a, -Wb / 2, Wb / 2) - b, x = a + SHIFT;
    let y, z;
    if (q >= 0) {
      const th = q / RHO;
      if (th < Math.PI / 2) { z = Z0 - RHO * Math.sin(th); y = Y0 + RHO * Math.cos(th); } else { z = Z0 - RHO; y = Y0 - (q - (RHO * Math.PI) / 2); }
      z -= zo;
    } else {
      const l = -q, th = l / RHO;
      if (th < THM) { const bw = bowlAt(x, 1) * (th / THM); z = Z0 + RHO * Math.sin(th) + tt.y * bw; y = Y0 + RHO * Math.cos(th) - tt.x * bw; }
      else { const v = Math.max(0.3, 1 - (l - RHO * THM) / len); prof.getPointAt(v, c2); prof.getTangentAt(Math.max(v, 0.1), t2); const o = RHO + bowlAt(x, v); z = c2.x + t2.y * o; y = c2.y - t2.x * o; }
    }
    out[k] = x; out[k + 1] = y; out[k + 2] = z;
  };
  const bandOf = (b) => 1 - smoothstep(0.045, 0.085, Math.min(b, LB - b));
  const sleevePat = (sgn, u, v, out) => {
    const s = v * DS, al = Math.min(s, PHI * RC) / RC, ex = Math.max(0, s - PHI * RC);
    const cx = RC * Math.sin(al) + ex * Math.cos(al), cy = -RC * (1 - Math.cos(al)) - ex * Math.sin(al), k = (u / NA - 0.5) * sleeveW(s);
    out[0] = sgn * (Wb / 2 + cx - k * Math.sin(al)); out[1] = (JS - NA / 2) * D + cy - k * Math.cos(al);
  };
  // ---- particles
  const BW = NU + 1, BH = NV + 1, SW = NA + 1, SH = NS + 1, nBody = BW * BH, nSl = SW * NS, n = nBody + 2 * nSl, n3 = n * 3;
  const X = new Float64Array(n3), Pp = new Float64Array(n3), pat = new Float64Array(n * 2);
  const piece = new Uint8Array(n), gu = new Int16Array(n), gv = new Int16Array(n);
  const ids = [new Int32Array(nBody), new Int32Array(SW * SH), new Int32Array(SW * SH)], q2 = [0, 0];
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    const id = j * BW + i, a = (i - NU / 2) * D, b = j * D;
    ids[0][id] = id; gu[id] = i; gv[id] = j; pat[id * 2] = a * (1 - 0.06 * bandOf(b)); pat[id * 2 + 1] = b; place(a, b, 0, X, id * 3);
  }
  for (let p = 1; p <= 2; p++) {
    const sgn = p === 1 ? -1 : 1;
    for (let v = 0; v < SH; v++) for (let u = 0; u < SW; u++) {
      if (v === 0) { ids[p][u] = (JS - u) * BW + (sgn > 0 ? NU : 0); continue; }
      const id = nBody + (p - 1) * nSl + (v - 1) * SW + u;
      ids[p][v * SW + u] = id; piece[id] = p; gu[id] = u; gv[id] = v;
      sleevePat(sgn, u, v, q2); pat[id * 2] = q2[0]; pat[id * 2 + 1] = q2[1];
      place(q2[0], q2[1], 0.015 * smoothstep(0, 4, v), X, id * 3);
    }
  }
  Pp.set(X);
  // ---- constraints: 0 stretch, 1 shear, 2 bend (rest lengths from the pattern)
  const ca = [], cb = [], cr = [], ck = [];
  const link = (i0, i1, kind) => { if (i0 === i1) return; ca.push(i0); cb.push(i1); cr.push(Math.hypot(pat[i0 * 2] - pat[i1 * 2], pat[i0 * 2 + 1] - pat[i1 * 2 + 1])); ck.push(kind); };
  const wire = (id, W, H, sewn) => {
    for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
      const k = id[v * W + u], row = !(sewn && v === 0);
      if (u + 1 < W && row) link(k, id[v * W + u + 1], 0);
      if (v + 1 < H) link(k, id[(v + 1) * W + u], 0);
      if (u + 1 < W && v + 1 < H) { link(k, id[(v + 1) * W + u + 1], 1); link(id[v * W + u + 1], id[(v + 1) * W + u], 1); }
      if (u + 2 < W && row) link(k, id[v * W + u + 2], 2);
      if (v + 2 < H) link(k, id[(v + 2) * W + u], 2);
    }
  };
  wire(ids[0], BW, BH, false); wire(ids[1], SW, SH, true); wire(ids[2], SW, SH, true);
  const nc = ca.length, CA = Int32Array.from(ca), CB = Int32Array.from(cb), CR = Float64Array.from(cr), CK = Uint8Array.from(ck);
  // the fold is held where it crosses the flat middle of the rim
  const pin = [];
  for (let i = 0; i < BW; i++) {
    const a = (i - NU / 2) * D; if (Math.abs(a + SHIFT) > 0.1) continue;
    const id = Math.round((NOUT * D + SKEW * a) / D) * BW + i, px = a + SHIFT, pz = Z0;
    let py = 0;   // where a point dropped straight down at (px, pz) comes to rest on the rim
    for (let k = 0; k < sp.length; k += 3) { const h2 = (sp[k] - px) ** 2 + (sp[k + 2] - pz) ** 2; if (h2 < RPIN * RPIN) py = Math.max(py, sp[k + 1] + Math.sqrt(RPIN * RPIN - h2)); }
    if (py > 0.7) pin.push(id, px, py, pz);
  }
  const pins = () => { for (let k = 0; k < pin.length; k += 4) { const q = pin[k] * 3; X[q] = pin[k + 1]; X[q + 1] = pin[k + 2]; X[q + 2] = pin[k + 3]; } };

  // ---- solve
  const STEPS = 220, LATE = 60, GR = 0.0005, VMAX = 0.006, FLOOR = 0.012, MU = 1.5, SD = 0.0115;
  const KE = [1, 0.5, 0.12], KL = [1, 0.5, 0.06], CFE = new Float64Array(nc), CFL = new Float64Array(nc);
  for (let c = 0; c < nc; c++) { CA[c] *= 3; CB[c] *= 3; CFE[c] = 0.5 * KE[CK[c]]; CFL[c] = 0.5 * KL[CK[c]]; }
  const head = new Int32Array(500000), nxt = new Int32Array(n), GRID = [CS, bx, by, bz, gx, gy, gz];
  const T = dbg ? (dbg.time = [0, 0, 0, 0]) : null; let tm = T ? performance.now() : 0;
  const lap = (i) => { if (T) { const t = performance.now(); T[i] += t - tm; tm = t; } };
  for (let step = 0; step < STEPS; step++) {
    const late = step >= STEPS - LATE, iters = late ? 12 : 5, CF = late ? CFL : CFE;
    pbdIntegrate(X, Pp, n3, step >= STEPS - 10 ? 0.5 : 0.965, GR, VMAX); pins(); lap(0);
    for (let it = 0; it < iters; it++) { pbdSweep(X, CA, CB, CR, CF, nc, (it & 1) === 0); pins(); }
    lap(1);
    const hits = pbdShell(X, Pp, n3, sp, start, ord, GRID, late ? 0.0098 : 0.0115, MU, FLOOR); lap(2);
    if (step & 1) pbdSelf(X, n, piece, gu, gv, head, nxt, SD);
    pins(); lap(3);
    if (dbg && step % 20 === 0) {
      let lo = 1e9, hi = -1e9;
      for (let k = 1; k < nBody * 3; k += 3) { lo = Math.min(lo, X[k]); hi = Math.max(hi, X[k]); }
      (dbg.trace = dbg.trace || []).push('step ' + step + ' bodyY ' + lo.toFixed(3) + '..' + hi.toFixed(3) + ' contacts ' + hits + ' pins ' + pin.length / 4);
    }
  }
  for (let c = 0; c < nc; c++) { CA[c] /= 3; CB[c] /= 3; }
  if (dbg) {
    let mx = 0, sum = 0, cnt = 0;
    for (let c = 0; c < nc; c++) if (CK[c] === 0) { const a = CA[c] * 3, b = CB[c] * 3, e = Math.hypot(X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]) / CR[c] - 1; mx = Math.max(mx, Math.abs(e)); sum += e; cnt++; }
    Object.assign(dbg, { n, nc, nSp, maxStrain: mx, meanStrain: sum / cnt, sp });
  }
  const grab = (id) => { const P = new Float64Array(id.length * 3); for (let k = 0; k < id.length; k++) { P[k * 3] = X[id[k] * 3]; P[k * 3 + 1] = X[id[k] * 3 + 1]; P[k * 3 + 2] = X[id[k] * 3 + 2]; } return P; };
  return [{ kind: 'body', W: BW, H: BH, P: grab(ids[0]) }, { kind: 'sleeve', sgn: -1, W: SW, H: SH, P: grab(ids[1]) }, { kind: 'sleeve', sgn: 1, W: SW, H: SH, P: grab(ids[2]) }];
}

function buildCardigan(root, mats) {
  const { D, NU, NOUT, NFR, NA, DS, HEM, CUFF } = CG, LB = (NOUT + NFR) * D;
  const m4 = M4(CHAIR.x, 0, CHAIR.z, CHAIR.ry), v = V3(), knit = [], rib = [];
  for (const pc of simulateCardigan()) {
    const W = 2 * pc.W - 1, H = 2 * pc.H - 1, P = refine(pc.P, pc.W, pc.H, 3);
    for (let k = 0; k < W * H; k++) { v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(m4); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; }
    const G = { W, H, P, uv: new Float32Array(W * H * 2), col: new Float32Array(W * H), th: new Float32Array(W * H) };
    const sides = { u0: true, u1: true };
    let parts;
    if (pc.kind === 'body') {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = j * W + i, a = (i / 2 - NU / 2) * D, b = (j / 2) * D, e = Math.min(b, LB - b);
        G.uv[k * 2] = a + 1; G.uv[k * 2 + 1] = b + 1;
        G.th[k] = 0.0024 + 0.0007 * (1 - smoothstep(HEM - 0.01, HEM + 0.004, e));
        G.col[k] = (0.95 + 0.09 * fbm2(a * 8 + 3, b * 8, { oct: 2, seed: 311 })) * (Math.abs(e - HEM) < 0.004 ? 0.8 : 1);
      }
      const r = Math.round((HEM / D) * 2);
      parts = [[0, r, { ...sides, v0: true }, rib], [r, H - 1 - r, sides, knit], [H - 1 - r, H - 1, { ...sides, v1: true }, rib]];
    } else {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = j * W + i, s = (j / 2) * DS, a = (i / (2 * NA) - 0.5) * sleeveW(s);
        G.uv[k * 2] = a + 0.37 + pc.sgn * 0.11; G.uv[k * 2 + 1] = s + 0.21;
        G.th[k] = lerp(0.0026, 0.004, smoothstep(0, 0.06, s)) + 0.0006 * smoothstep(CUFF - 0.012, CUFF + 0.004, s);
        G.col[k] = (0.95 + 0.09 * fbm2(a * 8 + 9 + pc.sgn, s * 8, { oct: 2, seed: 317 })) * (Math.abs(s - CUFF) < 0.004 ? 0.8 : 1);
      }
      const r = Math.round((CUFF / DS) * 2);
      parts = [[0, r, { ...sides, v0: true }, knit], [r, H - 1, { ...sides, v1: true }, rib]];
    }
    gridNormals(G); boundaryDirs(G);
    for (const [r0, r1, rim, list] of parts) list.push(thickSheet(G, r0, r1, rim));
    if (pc.kind === 'body') {
      // woven tab label on the outside of the hem that hangs behind the chair, near the side seam
      const i0 = W - 11, j0 = 2, ni = 2, nj = 3, pos = [], nor = [], uvs = [], idx = [];
      const out = V3(-Math.sin(CHAIR.ry), 0, -Math.cos(CHAIR.ry)), kc = ((j0 + 1) * W + i0 + 1) * 3;
      const sg = G.N[kc] * out.x + G.N[kc + 1] * out.y + G.N[kc + 2] * out.z < 0 ? -1 : 1;
      for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
        const k = (j0 + j) * W + i0 + i, k3 = k * 3, h = (G.th[k] + 0.0006) * sg;
        pos.push(G.P[k3] + G.N[k3] * h, G.P[k3 + 1] + G.N[k3 + 1] * h, G.P[k3 + 2] + G.N[k3 + 2] * h);
        nor.push(G.N[k3] * sg, G.N[k3 + 1] * sg, G.N[k3 + 2] * sg); uvs.push(sg > 0 ? i / ni : 1 - i / ni, j / nj);
      }
      for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const a = j * (ni + 1) + i, b = a + 1, c = a + ni + 2, d = a + ni + 1; idx.push(a, b, c, a, c, d); }
      const tab = mesh(orient(geoFrom(pos, nor, uvs, idx)), mats.tab, 'cardiganTab'); tab.userData.bakeOccluder = false;
      root.add(tab);
    }
  }
  root.add(mesh(merge(knit), mats.knit, 'cardigan'), mesh(merge(rib), mats.rib, 'cardiganRib'));
}

// =====================================================================================================
// canvas tote on the wardrobe handle
// =====================================================================================================
function buildTote(root, mats) {
  // right-hand bar handle of the wardrobe (fixtures.js): bar on two posts, the upper post is the hook
  const xc = 4.337, zd = 0.6003, yp = 1.125, rp = 0.0042;
  const W = 0.36, H = 0.4, yb = 0.47, sa = 0.36;
  const edge = (s) => Math.pow(Math.max(0, 1 - s * s), 0.55);
  const topE = (s) => { const m = Math.abs(s); return m < sa ? -0.007 * (1 - (m / sa) ** 2) : -0.034 * Math.pow((m - sa) / (1 - sa), 1.6); };
  const Pt = (s, v, front, out) => {
    const x = xc + s * (W / 2) * (1 - 0.045 * smoothstep(0.5, 1, v));
    const y = yb + v * H + topE(s) * v * v * v - 0.011 * (1 - s * s) * Math.pow(1 - v, 3) - (front ? 0.006 * smoothstep(0.6, 1, v) * edge(s) : 0);
    let z = zd + 0.0022 + 0.0035 * edge(s) * fbm2(s * 2.2 + 5, v * 2.5, { oct: 2, seed: 41 });
    if (front) {
      const sb = s + 0.12, bulge = 0.03 * Math.exp(-(((v - 0.3) / 0.3) ** 2)) * Math.exp(-((sb / 0.75) ** 2)) + 0.011 + 0.013 * smoothstep(0.6, 1, v) * (1 - Math.min(1, (s / 0.62) ** 2));
      const folds = 0.0045 * Math.sin(s * 6.5 + 0.9 + v * 1.3) * smoothstep(0.15, 0.7, v) + 0.007 * (fbm2(s * 2.6 + 9, v * 2.8 + 3, { oct: 2, seed: 47 }) - 0.5);
      z += edge(s) * Math.max(0.003, bulge + folds) * Math.pow(smoothstep(0, 0.14, v), 0.6);
    }
    return out.set(x, y, z);
  };
  const NUb = 96, NVb = 44;
  const body = surface((u, v, p) => { const front = u < 0.5; Pt(front ? -1 + 4 * u : 3 - 4 * u, v, front, p); }, NUb, NVb, { closedU: true });
  { const uv = body.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 2); }
  const print = mats.canvasPrint; print.normalMap.repeat.set(W * 13, H * 13);
  root.add(mesh(body, print, 'toteBody'));
  // rolled lip round the opening
  const plain = [];
  {
    const p = body.attributes.position, nr = body.attributes.normal, base = NVb * (NUb + 1), r = 0.0014, RS = 6, pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= NUb; i++) {
      const k = base + (i % NUb), ox = nr.getX(k), oz = nr.getZ(k), ol = Math.hypot(ox, oz) || 1;
      for (let q = 0; q <= RS; q++) {
        const a = (q / RS) * TAU, cs = Math.cos(a), sn = Math.sin(a), nx = (ox / ol) * cs, nz = (oz / ol) * cs;
        pos.push(p.getX(k) + nx * r, p.getY(k) + sn * r, p.getZ(k) + nz * r); nor.push(nx, sn, nz); uv.push((i / NUb) * 2 * W, q * 0.0015);
      }
    }
    for (let i = 0; i < NUb; i++) for (let q = 0; q < RS; q++) { const a = i * (RS + 1) + q, b = a + RS + 1, c = b + 1, d = a + 1; idx.push(a, b, c, a, c, d); }
    plain.push(orient(geoFrom(pos, nor, uv, idx)));
  }
  // straps: both loops over the hook, each twisting a quarter turn on the way up
  const tmp = V3(), straps = [];
  for (const front of [true, false]) {
    const S = [], R = rp + 0.0022, zs = front ? 0.6147 : 0.6052, a0 = (165 * Math.PI) / 180, va = front ? 0.895 : 0.95, zo = 0.0015;
    const at = (sgn, vv) => { Pt(sgn * sa, vv, front, tmp); return V3(tmp.x, tmp.y, tmp.z + zo); };
    const add = (p, psi, m) => S.push({ p, w: V3(Math.cos(psi), 0, Math.sin(psi)), hw: lerp(0.0125, 0.0046, m), ht: lerp(0.0008, 0.0021, m) });
    for (const sgn of [-1, 1]) {
      const leg = [], lo = at(sgn, va), hi = at(sgn, 1), tan = V3(xc + sgn * R * Math.cos(Math.PI - a0), yp + R * Math.sin(a0), zs);
      for (let k = 0; k < 6; k++) leg.push([lo.clone().lerp(hi, k / 6), 0, 0]);
      for (let k = 0; k <= 30; k++) { const t = k / 30, p = hi.clone().lerp(tan, t); p.z = lerp(hi.z, zs, smoothstep(0.2, 0.9, t)); leg.push([p, smoothstep(0.35, 0.95, t), smoothstep(0.45, 0.95, t)]); }
      if (sgn < 0) {
        for (const [p, tw, m] of leg) add(p, (tw * Math.PI) / 2, m);
        for (let k = 1; k < 16; k++) { const a = lerp(a0, Math.PI - a0, k / 16); add(V3(xc + R * Math.cos(a), yp + R * Math.sin(a), zs), Math.PI / 2, 1); }
      } else for (let k = leg.length - 1; k >= 0; k--) add(leg[k][0], Math.PI - (leg[k][1] * Math.PI) / 2, leg[k][2]);
    }
    straps.push(ribbon(S));
  }
  root.add(mesh(merge(plain), mats.canvas, 'toteLip'), mesh(merge(straps), mats.strap, 'toteStraps'));
}

// =====================================================================================================
// felt slippers
// =====================================================================================================
function slipperGeos(side, seed) {
  const L = 0.272, HS = 0.013;
  const wAt = (x) => { const xn = x / (L / 2); return lerp(0.0365, 0.0505, smoothstep(-0.75, 0.3, xn)) * (1 - 0.07 * smoothstep(0.45, 1, xn)); };
  const zc = (x) => { const xn = x / (L / 2); return side * 0.007 * (xn * xn - 0.35); };
  const pw = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);
  const ring = (ph, k, d, y, out) => { const cx = pw(Math.cos(ph), 0.85), x = k * (L / 2 - d) * cx; return out.set(x, y, zc(x) + k * (wAt((L / 2) * cx) - d) * pw(Math.sin(ph), 0.72)); };
  const hwAt = (x) => { const c = Math.pow(Math.min(1, Math.abs(x) / (L / 2)), 1 / 0.85); return wAt(x) * Math.pow(Math.sqrt(Math.max(0, 1 - c * c)), 0.72); };
  const SP = [[0, 0, 0.0004], [0.55, 0, 0.0004], [1, 0.0035, 0.0004], [1, 0.001, 0.0018], [1, 0, 0.004], [1, 0, HS - 0.004], [1, 0.0008, HS - 0.0012], [1, 0.003, HS]];
  const BP = [[1, 0.003, HS], [0.9, 0, HS - 0.0012], [0.72, 0, HS - 0.0028], [0.48, 0, HS - 0.0036], [0.24, 0, HS - 0.004], [0, 0, HS - 0.004]];
  const loft = (prof, wall) => {
    const g = surface((u, v, p) => { const q = prof[Math.round(v * (prof.length - 1))]; ring(-u * TAU, q[0], q[1], q[2], p); }, 56, prof.length - 1, { closedU: true });
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) if (wall) uv.setXY(k, uv.getX(k) * 0.66, p.getY(k)); else uv.setXY(k, p.getX(k), p.getZ(k));
    return g;
  };
  // upper: a felt vamp over the front of the foot, open towards the heel
  const KA = 18, MB = 22, W = 2 * KA + 1, H = MB + 1, xo = 0.014, xt = L / 2 - 0.0035;
  const G = { W, H, P: new Float32Array(W * H * 3), uv: new Float32Array(W * H * 2), col: new Float32Array(W * H).fill(1), th: new Float32Array(W * H).fill(0.0023) };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = i / KA - 1, b = j / MB, x = lerp(xo - 0.062 * Math.pow(Math.abs(a), 1.7), xt, Math.pow(b, 0.92)), f = clamp((x - xo) / (xt - xo), 0, 1);
    const Hh = 0.056 * Math.pow(1 - Math.pow(f, 2.3), 0.55) + 0.02 * Math.min(0, x - xo), arch = Math.pow(1 - Math.pow(Math.abs(a), 2.5), 1 / 2.1);
    const nz = fbm2(x * 30 + seed, a * 2.5, { oct: 2, seed }) - 0.5, k = j * W + i;
    G.P[k * 3] = x; G.P[k * 3 + 1] = HS - 0.005 + (Hh * (1 + 0.07 * nz) - 0.0028 * Math.exp(-(((x - 0.058) / 0.013) ** 2))) * arch;
    G.P[k * 3 + 2] = zc(x) + a * (hwAt(x) + 0.0015) * (1 + 0.035 * arch);
    G.uv[k * 2] = a * 0.07; G.uv[k * 2 + 1] = x;
  }
  gridNormals(G); boundaryDirs(G);
  return { sole: loft(SP, true), bed: loft(BP, false), upper: thickSheet(G, 0, H - 1, { v0: true }) };
}
function buildSlippers(root, mats) {
  const y = 0.0131, felt = [], dark = [];   // they stand on the rug
  for (const [side, seed, m4] of [[1, 71, M4(1.95, y, 2.375, 0.1)], [-1, 83, M4(1.985, y, 2.505, -0.17)]]) {
    const g = slipperGeos(side, seed);
    dark.push(g.sole.applyMatrix4(m4)); felt.push(g.bed.applyMatrix4(m4), g.upper.applyMatrix4(m4));
  }
  for (const g of felt) g.deleteAttribute('color');
  root.add(mesh(merge(felt), mats.felt, 'slippers'), mesh(merge(dark), mats.feltDark, 'slipperSoles'));
}

// =====================================================================================================
// water bottle on the desk
// =====================================================================================================
function buildBottle(root, mats) {
  const m4 = M4(3.612, 0.74, 0.535, 0.7);
  const sh = [];   // shoulder: quarter-ish curve from the wall to the neck
  for (let k = 0; k <= 8; k++) { const a = (k / 8) * (Math.PI / 2); sh.push([0.0245 + 0.011 * Math.cos(a), 0.166 + 0.03 * Math.sin(a)]); }
  root.add(mesh(lath([[0.0342, 0.012], [0.0355, 0.0145], [0.0355, 0.166], ...sh.slice(1), [0.0245, 0.203]], 56).applyMatrix4(m4), mats.coat, 'bottleBody'));
  // the cap is screwed on only so far: a few millimetres of the steel neck and two turns of thread show under it
  const yc = 0.2086, CP = [[0.0258, 0, 0], [0.0268, 0.0012, 0.2], [0.027, 0.0032, 1], [0.027, 0.0296, 1], [0.0268, 0.0318, 0.2], [0.026, 0.035, 0], [0.0236, 0.0365, 0], [0.0002, 0.0365, 0]];
  const cap = surface((u, v, p) => {
    const q = CP[Math.round(v * (CP.length - 1))], a = -u * TAU, r = q[0] - q[2] * 0.00028 * (0.5 + 0.5 * Math.cos(a * 60));   // knurled grip
    p.set(r * Math.cos(a), yc + q[1], r * Math.sin(a));
  }, 240, CP.length - 1, { closedU: true });
  root.add(mesh(merge([
    lath([[0, 0.0005], [0.0305, 0.0005], [0.033, 0.0014], [0.0342, 0.004], [0.0342, 0.012]], 56),
    lath([[0.0245, 0.2022], [0.0238, 0.2032], [0.0226, 0.2036], [0.0226, 0.2092]], 56, 0.008),
    new THREE.TorusGeometry(0.0229, 0.00055, 6, 56).rotateX(Math.PI / 2 + 0.022).translate(0, 0.2049, 0),
    new THREE.TorusGeometry(0.0229, 0.00055, 6, 56).rotateX(Math.PI / 2 + 0.022).translate(0, 0.2069, 0),
    cap,
  ]).applyMatrix4(m4), mats.steel, 'bottleSteel'));
  root.add(mesh(merge([
    new THREE.TorusGeometry(0.0135, 0.0031, 10, 28, Math.PI).translate(0, yc + 0.0359, 0),
    new THREE.TorusGeometry(0.0246, 0.0007, 6, 56).rotateX(Math.PI / 2).translate(0, yc - 0.0002, 0),   // gasket peeping out under the cap
  ]).applyMatrix4(m4), mats.grip, 'bottleLoop'));
}

// =====================================================================================================
// phone charger in the socket by the bed, its cable left lying on the floor
// =====================================================================================================
function buildCharger(root, mats) {
  // socket plate on the left wall (room.js): centre (0, 0.3, 1.65), facing +x; its collar stands 12.8 mm proud
  const m4 = M4(0, 0.3, 1.65, Math.PI / 2);   // local +z -> into the room, local x -> along the wall
  const body = merge([
    new THREE.CylinderGeometry(0.0186, 0.0186, 0.006, 28).rotateX(Math.PI / 2).translate(0, 0, 0.0128),
    roundedBox(0.039, 0.039, 0.023, { r: 0.0055, rs: 3, maxEdge: 0.02 }).translate(0, 0, 0.0128 + 0.0125),
    roundedBox(0.0124, 0.017, 0.0064, { r: 0.0012, rs: 2 }).translate(0, -0.0195 - 0.0075, 0.0128 + 0.0125),       // USB plug in the port underneath
    new THREE.CylinderGeometry(0.0021, 0.0027, 0.011, 10).translate(0, -0.0195 - 0.0165 - 0.0045, 0.0128 + 0.0125),   // strain relief
  ]).applyMatrix4(m4);
  root.add(mesh(body, mats.whitePlastic, 'chargerBrick'));
  // cable: hangs to the floor in front of the skirting, wanders off in a loose loop, ends in the phone plug
  const yf = 0.0019, x0 = 0.0128 + 0.0125, pts = [
    [x0, 0.3 - 0.046, 1.65], [x0 + 0.002, 0.2, 1.651], [x0 + 0.006, 0.1, 1.654], [x0 + 0.012, 0.03, 1.66], [0.06, 0.004, 1.685], [0.105, yf, 1.735], [0.19, yf, 1.795], [0.3, yf, 1.79],
    [0.372, yf, 1.715], [0.36, yf, 1.63], [0.295, yf, 1.585], [0.225, yf, 1.6], [0.19, yf, 1.64], [0.2, yf, 1.685],
  ].map((p) => V3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), N = 150, pos = [], nor = [], uv = [], idx = [], R = 0.0015, RS = 6;
  const fr = curve.computeFrenetFrames(N, false), P = V3();
  for (let i = 0; i <= N; i++) {
    curve.getPointAt(i / N, P);
    for (let q = 0; q <= RS; q++) { const a = (q / RS) * TAU, cs = Math.cos(a), sn = Math.sin(a), n = fr.normals[i], b = fr.binormals[i]; const nx = n.x * cs + b.x * sn, ny = n.y * cs + b.y * sn, nz = n.z * cs + b.z * sn; pos.push(P.x + nx * R, P.y + ny * R, P.z + nz * R); nor.push(nx, ny, nz); uv.push(q / RS, i / N); }
  }
  for (let i = 0; i < N; i++) for (let q = 0; q < RS; q++) { const a = i * (RS + 1) + q, b = a + RS + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const cable = mesh(orient(geoFrom(pos, nor, uv, idx)), mats.cable, 'chargerCable'); cable.userData.bakeOccluder = false;
  root.add(cable);
  // phone end: moulded grip and the metal tip, lying where the cable stops
  const end = curve.getPointAt(1), tan = curve.getTangentAt(1), ry = Math.atan2(tan.x, tan.z), e4 = M4(end.x, 0.0004, end.z, ry);
  root.add(mesh(roundedBox(0.0105, 0.0058, 0.02, { r: 0.0018, rs: 2 }).translate(0, 0.0029, 0.009).applyMatrix4(e4), mats.whitePlastic, 'chargerPlug'));
  root.add(mesh(roundedBox(0.0083, 0.0025, 0.0068, { r: 0.001, rs: 2 }).translate(0, 0.0029, 0.0222).applyMatrix4(e4), mats.steel, 'chargerTip'));
}

// =====================================================================================================
// a pair of socks taken off by the bed
// =====================================================================================================
function buildSocks(root, mats) {
  const knit = [], rib = [];
  const sock = (m4, seed, bend) => {
    const r = new RNG(seed), n = 46, leg = 0.15, tot = 0.345, ds = tot / n, S = [];
    let x = 0, z = 0;
    for (let k = 0; k <= n; k++) {
      const s = k * ds, ang = bend * smoothstep(leg - 0.04, leg + 0.04, s) + 0.12 * Math.sin(s * 19 + seed);
      if (k) { x += Math.cos(ang) * ds; z += Math.sin(ang) * ds; }
      const toe = Math.max(0, (s - (tot - 0.04)) / 0.04), heel = Math.exp(-(((s - leg) / 0.03) ** 2));
      const hw = Math.max(0.006, (lerp(0.043, 0.039, smoothstep(0, 0.1, s)) + 0.006 * heel) * Math.sqrt(Math.max(0.02, 1 - toe * toe)));
      const ht = Math.min(hw * 0.6, (0.0044 + 0.002 * fbm2(s * 40 + seed, 3.1, { oct: 2, seed }) + 0.0022 * heel) * (k === 0 ? 0.35 : 1) * (1 - 0.5 * toe * toe));
      S.push({ p: V3(x, ht + 0.0004 + 0.0018 * Math.max(0, Math.sin(s * 31 + seed * 1.7)) * smoothstep(0.02, 0.06, s) * (1 - toe), z).applyMatrix4(m4), w: V3(-Math.sin(ang), 0, Math.cos(ang)).transformDirection(m4), hw, ht });
    }
    const cut = Math.round(0.05 / ds);
    rib.push(ribbon(S.slice(0, cut + 1))); knit.push(ribbon(S.slice(cut)));
    void r;
  };
  sock(M4(1.74, 0, 3.07, -0.5), 5, 0.85); sock(M4(2.2, 0, 3.2, 2.9), 11, 0.6);
  root.add(mesh(merge(knit), mats.sock, 'socks'), mesh(merge(rib), mats.sockRib, 'sockCuffs'));
}

// =====================================================================================================
// magazines and a paperback on the floor
// =====================================================================================================
const PILE = { x: 2.3, z: 3.79 };
function buildFloorPile(root, mats) {
  const items = [
    { w: 0.225, d: 0.297, t: 0.0062, tc: 0.0004, ry: 0.22, dx: 0, dz: 0, top: coverMat(0.225, 0.297, paintMagB, 0.42), edge: mats.paperWhite },
    { w: 0.21, d: 0.275, t: 0.0048, tc: 0.0004, ry: -0.14, dx: 0.012, dz: -0.008, top: coverMat(0.21, 0.275, paintMagA, 0.5), edge: mats.paperWhite },
    { w: 0.132, d: 0.2, t: 0.019, tc: 0.0006, ry: 0.55, dx: -0.018, dz: 0.02, top: coverMat(0.132, 0.2, paintBook, 0.6), edge: mats.ochre },
  ];
  let y = 0.0004;
  const pages = [];
  items.forEach((o, i) => {
    const m4 = M4(PILE.x + o.dx, y, PILE.z + o.dz, o.ry + Math.PI).multiply(new THREE.Matrix4().makeTranslation(-o.w / 2, 0, 0));
    const B = { r: Math.min(0.0003, o.tc * 0.45), rs: 1, maxEdge: 0.03 };
    root.add(mesh(boxAt(0, o.t - o.tc, -o.d / 2, o.w, o.tc, o.d, B).applyMatrix4(m4), o.top, 'pileCover' + i));
    root.add(mesh(merge([boxAt(0, 0, -o.d / 2, o.w, o.tc, o.d, B), boxAt(-0.0003, 0, -o.d / 2, o.tc + 0.0003, o.t, o.d, B)]).applyMatrix4(m4), o.edge, 'pileSpine' + i));
    pages.push(boxAt(o.tc, o.tc, -o.d / 2 + 0.0004, o.w - o.tc - 0.0004, o.t - 2 * o.tc, o.d - 0.0008, { r: 0.0003, rs: 1, maxEdge: 0.06, skip: ['py', 'ny'] }).applyMatrix4(m4));
    y += o.t + 0.0002;
  });
  root.add(mesh(merge(pages), mats.pages, 'pilePages'));
}

// =====================================================================================================
export function build(ctx) {
  const t0 = performance.now();
  const root = group('clutter'), mats = makeMats();
  const t1 = performance.now();
  buildCardigan(root, mats);
  const t2 = performance.now();
  buildTote(root, mats); buildSlippers(root, mats); buildBottle(root, mats); buildFloorPile(root, mats); buildCharger(root, mats); buildSocks(root, mats);
  let tris = 0;
  root.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  root.userData.tris = tris;
  console.log(`[boot] clutter: ${Math.round(tris / 1000)}k tris, ${(performance.now() - t0).toFixed(0)} ms (textures ${(t1 - t0).toFixed(0)}, cardigan ${(t2 - t1).toFixed(0)})`);
  return root;
}
