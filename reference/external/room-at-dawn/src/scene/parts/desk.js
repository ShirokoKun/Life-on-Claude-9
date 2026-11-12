// The desk corner: Micke-like desk, moulded shell chair, desk lamp, desk clutter, two wall shelves
// and a postcard collage on the window wall. Everything is generated here (geometry + Canvas2D art).
import * as THREE from 'three';
import { DESK, SHELVES, POSTCARDS } from '../layout.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { roundedBox, boxAt, tube, lathe, merge, mesh, group, surface } from '../../core/geo.js';
import { makeCanvas, canvasTex, normalTex } from '../../core/tex.js';
import { RNG, clamp, lerp, smoothstep } from '../../core/rng.js';
import { sc, pbr, lacquerNormal, smudgeRough } from '../materials.js';

export const order = 30;
export const label = 'desk';

// =====================================================================================================
// small helpers
// =====================================================================================================
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const TAU = Math.PI * 2;

function M4(px, py, pz, ry = 0, rx = 0, rz = 0) {
  return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(px, py, pz);
}
/** Per-vertex colour (sRGB triple) for the shared vertex-colour materials. */
function tint(geo, rgb) {
  const c = sc(rgb[0], rgb[1], rgb[2]), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function flat(geo) { const g = geo.toNonIndexed(); g.computeVertexNormals(); return g; }
/** Per-vertex colour (sRGB) + roughness in the alpha channel, for the 'vr' materials. */
function tintR(geo, rgb, rough = 0.5) {
  const c = sc(rgb[0], rgb[1], rgb[2]), n = geo.attributes.position.count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = c.r; a[i * 4 + 1] = c.g; a[i * 4 + 2] = c.b; a[i * 4 + 3] = rough; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 4));
  return geo;
}
/** Re-colour single vertices: fn(x, y, z, i) -> [r, g, b, rough] (sRGB) or null to leave the vertex alone. */
function paintV(geo, fn) {
  const p = geo.attributes.position, col = geo.attributes.color, c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const q = fn(p.getX(i), p.getY(i), p.getZ(i), i); if (!q) continue;
    c.setRGB(q[0], q[1], q[2], THREE.SRGBColorSpace); col.setXYZ(i, c.r, c.g, c.b);
    if (col.itemSize === 4 && q.length > 3) col.setW(i, q[3]);
  }
  return geo;
}
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Weld coincident vertices and recompute normals (after bending a slab / box out of shape). */
function resmooth(g, dropUV = false) { if (dropUV) g.deleteAttribute('uv'); const m = mergeVertices(g, 1e-6); m.computeVertexNormals(); return m; }
/** Matrix that lays something built along +Y flat on a surface: build-frame y = `at` lands on (x, z), its +Y end
 *  points along (-sin ry, -cos ry), build-frame +Z ends up on top (after `roll` about the long axis). */
function layM(x, y, z, ry, at = 0, roll = 0) {
  return M4(x, y, z, ry).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(roll)).multiply(new THREE.Matrix4().makeTranslation(0, -at, 0));
}
function remapUV(g, rg) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(rg.u0, rg.u1, uv.getX(i)), lerp(rg.v0, rg.v1, uv.getY(i))); return g; }
/** Cylinder / cone from point a (radius r0) to point b (radius r1). */
function rod(a, b, r0, r1 = r0, radial = 10, open = false) {
  const d = V().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, radial, 1, open).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(a.x, a.y, a.z);
}
/** Flip any triangle whose winding disagrees with its vertex normals (core tube() winds its walls inside-out). */
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
const pipe = (points, radius, opts) => orient(tube(points, radius, opts));
/** lathe() with long profile segments split up, so tall walls get rows of vertices for the baked light. */
function lath(profile, segs, maxSeg = 0.013) {
  const out = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSeg));
    for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return lathe(out, segs);
}
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

/** Flat slab with a rounded-rectangle plan (w along x, d along z, corner radius cr) and rounded
 *  top/bottom edges (er). Sits on y = 0, centred in x/z. UV = plan position (u across x, v towards -z). */
function slab(w, d, h, o = {}) {
  const { cr = 0.004, cs = 4, es = 2, maxEdge = 0.04, hs = 1 } = o;
  const er = Math.min(o.er ?? 0.001, h * 0.499, cr * 0.95);
  const hx = w / 2 - er, hz = d / 2 - er, rc = Math.max(cr - er, 1e-5);
  const axis = (H) => {
    const out = [], inner = H - rc;
    for (let k = 0; k < cs; k++) out.push(-H + (rc * k) / cs);
    const n = Math.max(1, Math.ceil((2 * inner) / maxEdge));
    for (let k = 0; k <= n; k++) out.push(-inner + (2 * inner * k) / n);
    for (let k = 1; k <= cs; k++) out.push(inner + (rc * k) / cs);
    return out;
  };
  const lx = axis(hx), lz = axis(hz), nx = lx.length, nz = lz.length, nn = nx * nz;
  const gx = new Float32Array(nn), gz = new Float32Array(nn), bx = new Float32Array(nn), bz = new Float32Array(nn);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const qx = lx[i], qz = lz[j], ix = clamp(qx, -(hx - rc), hx - rc), iz = clamp(qz, -(hz - rc), hz - rc);
    const dx = qx - ix, dz = qz - iz, L = Math.hypot(dx, dz), k = j * nx + i;
    if (L > 1e-9) { const m = Math.max(Math.abs(dx), Math.abs(dz)) / L; gx[k] = ix + dx * m; gz[k] = iz + dz * m; bx[k] = dx / L; bz[k] = dz / L; } else { gx[k] = qx; gz[k] = qz; }
  }
  const pos = [], nor = [], uv = [], idx = [];
  const vert = (x, y, z, a, b, c) => { pos.push(x, y, z); nor.push(a, b, c); uv.push(x / w + 0.5, 0.5 - z / d); };
  for (const top of [true, false]) {
    const base = pos.length / 3;
    for (let k = 0; k < nn; k++) vert(gx[k], top ? h : 0, gz[k], 0, top ? 1 : -1, 0);
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = base + j * nx + i, b = a + 1, c = a + nx + 1, dd = a + nx;
      if (top) idx.push(a, dd, c, a, c, b); else idx.push(a, b, c, a, c, dd);
    }
  }
  const loop = [];
  for (let i = 0; i < nx; i++) loop.push(i);
  for (let j = 1; j < nz; j++) loop.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) loop.push((nz - 1) * nx + i);
  for (let j = nz - 2; j >= 1; j--) loop.push(j * nx);
  const rings = [];
  for (let k = 0; k <= es; k++) { const a = ((k / es) * Math.PI) / 2; rings.push([er * Math.sin(a), h - er * (1 - Math.cos(a)), Math.sin(a), Math.cos(a)]); }
  for (let k = 1; k < hs; k++) rings.push([er, lerp(h - er, er, k / hs), 1, 0]);
  for (let k = 0; k <= es; k++) { const a = ((k / es) * Math.PI) / 2; rings.push([er * Math.cos(a), er - er * Math.sin(a), Math.cos(a), -Math.sin(a)]); }
  const base = pos.length / 3, Ln = loop.length;
  for (const [off, y, nh, nv] of rings) for (const k of loop) vert(gx[k] + bx[k] * off, y, gz[k] + bz[k] * off, bx[k] * nh, nv, bz[k] * nh);
  for (let r = 0; r < rings.length - 1; r++) for (let m = 0; m < Ln; m++) {
    const a = base + r * Ln + m, b = base + r * Ln + ((m + 1) % Ln), c = b + Ln, dd = a + Ln;
    idx.push(a, b, c, a, c, dd);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Thin cable through points: adaptive sampling (dense in bends, sparse on straights), parallel-transport frames. */
function wire(points, r, { radial = 6, maxAng = 0.2, maxLen = 0.03 } = {}) {
  const c = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const raw = c.getSpacedPoints(Math.max(40, Math.ceil(c.getLength() / 0.0015)));
  const keep = [raw[0]]; let last = 0; const dPrev = V().subVectors(raw[1], raw[0]).normalize(), d = V();
  for (let i = 1; i < raw.length - 1; i++) {
    d.subVectors(raw[i + 1], raw[i]).normalize();
    if (d.angleTo(dPrev) > maxAng || raw[i].distanceTo(raw[last]) > maxLen) { keep.push(raw[i]); last = i; dPrev.copy(d); }
  }
  keep.push(raw[raw.length - 1]);
  const n = keep.length, pos = [], nor = [], uv = [], idx = [], T = V(), B = V();
  const N = V(0, 1, 0);
  for (let i = 0; i < n; i++) {
    T.subVectors(keep[Math.min(n - 1, i + 1)], keep[Math.max(0, i - 1)]).normalize();
    if (i === 0 && Math.abs(T.y) > 0.9) N.set(1, 0, 0);
    N.addScaledVector(T, -N.dot(T)).normalize();
    B.crossVectors(T, N);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU, cs = Math.cos(a), sn = Math.sin(a);
      const x = cs * N.x + sn * B.x, y = cs * N.y + sn * B.y, z = cs * N.z + sn * B.z;
      pos.push(keep[i].x + x * r, keep[i].y + y * r, keep[i].z + z * r); nor.push(x, y, z); uv.push(j / radial, i / n);
    }
  }
  const W = radial + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = i * W + j, b = a + W, cc = b + 1, dd = a + 1; idx.push(a, dd, b, b, dd, cc); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Collects geometry per material and turns each bucket into one mesh. */
function makeBatch(root) {
  const map = new Map();
  return {
    add(name, mat, geo, ud) {
      let b = map.get(name); if (!b) map.set(name, (b = { mat, geos: [], ud }));
      const col = geo.attributes.color;
      if (mat.userData.vr) {
        if (!col) tintR(geo, [1, 1, 1], 0.5);
        else if (col.itemSize === 3) { const a = new Float32Array(col.count * 4); for (let i = 0; i < col.count; i++) a.set([col.getX(i), col.getY(i), col.getZ(i), 0.5], i * 4); geo.setAttribute('color', new THREE.BufferAttribute(a, 4)); }
      } else if (mat.vertexColors && !col) tint(geo, [1, 1, 1]);
      b.geos.push(geo);
    },
    flush() {
      let tris = 0;
      for (const [name, b] of map) {
        const g = merge(b.geos); tris += g.index.count / 3;
        const m = mesh(g, b.mat, name); if (b.ud) Object.assign(m.userData, b.ud);
        root.add(m);
      }
      return tris;
    },
  };
}

// =====================================================================================================
// procedural textures (Canvas2D)
// =====================================================================================================
const FONTS = ['Georgia, "Times New Roman", serif', '"Trebuchet MS", "Segoe UI", Arial, sans-serif', '"Palatino Linotype", "Book Antiqua", Georgia, serif', '"Courier New", Courier, monospace', 'Arial, Helvetica, sans-serif'];
const SYL = ['ma', 'ri', 'el', 'no', 'ta', 'vi', 'lu', 'sen', 'dor', 'al', 'ke', 'mi', 'ora', 'an', 'be', 'li', 'os', 'ne', 'ur', 'ha', 'ven', 'io', 'ca', 'su', 'rem', 'ty', 'ol', 'fa', 'ge', 'wyn', 'bri', 'est', 'und', 'ila', 'mor', 'pel'];
function word(r, n = r.int(2, 3)) { let s = ''; for (let i = 0; i < n; i++) s += r.pick(SYL); return s[0].toUpperCase() + s.slice(1); }
function phrase(r, n) { const a = []; for (let i = 0; i < n; i++) a.push(word(r)); return a.join(' '); }
// [cover, text, accent]
const PAL = [
  ['#2f3d54', '#ece4d2', '#c9a24a'], ['#8b9a83', '#23302a', '#f0eadc'], ['#c8a19b', '#3b2a2a', '#f3ece2'], ['#e9e2d0', '#2c2c2e', '#b7694c'],
  ['#c7a04c', '#2b2418', '#f4eedd'], ['#b3664b', '#f5ead9', '#2e2a28'], ['#38383b', '#e8e2d4', '#c8a19b'], ['#a8bbc9', '#22303c', '#f1ede4'],
  ['#3e594a', '#e9e3d0', '#c9a24a'], ['#f1eee6', '#2a2a2c', '#4b7a7c'], ['#6c4a59', '#efe4dc', '#d4c2a0'], ['#d3c19f', '#3a2e22', '#8f4338'],
  ['#4a7778', '#eef0e6', '#e9d9a8'], ['#8d4439', '#f2e6d6', '#d9b98a'],
];

function packer(W, pad) {
  let cx = 0, cy = 0, rowH = 0;
  return (w, h) => {
    if (cx + w + 2 * pad > W) { cx = 0; cy += rowH; rowH = 0; }
    const s = { x: cx + pad, y: cy + pad, w, h };
    cx += w + 2 * pad; rowH = Math.max(rowH, h + 2 * pad);
    return s;
  };
}
function fitText(c, text, maxW, size, font, weight = '') {
  let fs = size; c.font = `${weight} ${fs}px ${font}`;
  const m = c.measureText(text).width;
  if (m > maxW) { fs = Math.max(5, (fs * maxW) / m); c.font = `${weight} ${fs}px ${font}`; }
  return fs;
}
function paperGrain(c, W, H, r, alpha) {
  const n = 128, cv = makeCanvas(n, n), q = cv.getContext('2d');
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 226 + r.int(0, 29); q.fillStyle = `rgb(${v},${v},${v - 3})`; q.fillRect(x, y, 1, 1); }
  c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = 'multiply'; c.fillStyle = c.createPattern(cv, 'repeat'); c.fillRect(0, 0, W, H); c.restore();
}

/** Light oak, grain along U. One tile = 1 m x 0.5 m. */
function oakTexture() {
  const W = 1024, H = 512, cv = makeCanvas(W, H), c = cv.getContext('2d'), r = new RNG(4101);
  c.fillStyle = 'rgb(208,177,137)'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    c.fillStyle = r.chance(0.5) ? `rgba(150,112,74,${r.range(0.03, 0.1)})` : `rgba(244,222,184,${r.range(0.03, 0.11)})`;
    c.fillRect(0, r.range(0, H), W, r.range(5, 44));
  }
  const warp = (x, y0) => 7 * Math.sin((x / W) * TAU + y0 * 0.011) + 3 * Math.sin((x / W) * TAU * 3 + y0 * 0.023 + 1.3);
  for (let i = 0; i < 560; i++) {
    const y0 = r.range(-12, H + 12);
    c.strokeStyle = `rgba(${128 + r.int(-22, 22)},${90 + r.int(-16, 16)},${56 + r.int(-10, 10)},${r.range(0.04, 0.22)})`; c.lineWidth = r.range(0.5, 1.7);
    c.beginPath();
    for (let x = 0; x <= W; x += 32) { const y = y0 + warp(x, y0); if (x) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
  for (let i = 0; i < 2800; i++) {
    const x = r.range(0, W), y = r.range(0, H);
    c.fillStyle = `rgba(104,72,44,${r.range(0.08, 0.26)})`; c.fillRect(x, y + warp(x, y), r.range(3, 13), r.range(0.6, 1.2));
  }
  return canvasTex(cv, { srgb: true, repeat: [1, 2] });
}

/** Page edges: fine irregular lines across the thickness. UVs are metres, so 10 tiles per metre. */
function pagesTexture() {
  const cv = makeCanvas(16, 2048), c = cv.getContext('2d'), r = new RNG(77123);
  let y = 0;
  while (y < 2048) {   // one texel = 0.05 mm: single sheets, now and then a thicker one or the dark gap between two signatures
    const t = r.chance(0.07) ? r.int(3, 5) : r.int(1, 3), gap = r.chance(0.035), v = gap ? 150 + r.int(-20, 20) : 226 + r.int(-22, 14);
    c.fillStyle = `rgb(${v + 9},${v + 5},${v - 8})`; c.fillRect(0, y, 16, t); y += t;
  }
  return canvasTex(cv, { srgb: true, repeat: [1, 10] });
}

// ---- dirt, dust and wear ------------------------------------------------------------------------------
function noiseTile(r, lo, hi, n = 256) {
  const cv = makeCanvas(n, n), q = cv.getContext('2d'), im = q.createImageData(n, n), d = im.data;
  for (let i = 0; i < n * n; i++) { const v = lo + r.next() * (hi - lo); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  q.putImageData(im, 0, 0); return cv;
}
function overlay(c, W, H, tile, alpha, op) {
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.globalCompositeOperation = op; c.fillStyle = c.createPattern(tile, 'repeat'); c.fillRect(0, 0, W, H); c.restore();
}
function softBlob(c, x, y, rad, rgb, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
/** A wandering hairline starting at (x, y). */
function strand(c, x, y, len, ang, bend, r) {
  const n = 6, st = len / n; let a = ang;
  c.beginPath(); c.moveTo(x, y);
  for (let i = 0; i < n; i++) {
    const mx = x + Math.cos(a) * st * 0.5, my = y + Math.sin(a) * st * 0.5; a += r.range(-bend, bend);
    x = mx + Math.cos(a) * st * 0.5; y = my + Math.sin(a) * st * 0.5; c.quadraticCurveTo(mx, my, x, y);
  }
  c.stroke();
}
function fingerprint(c, x, y, rx, ry, rot, col, a, r) {
  c.save(); c.translate(x, y); c.rotate(rot);
  softBlob(c, 0, 0, Math.max(rx, ry) * 1.3, col, a * 0.45);
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.clip();
  c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = 1.5;
  const ox = r.range(-0.2, 0.2) * rx, oy = r.range(0, 0.3) * ry, k = r.range(0.75, 0.95);
  for (let q = 2.2; q < ry * 2.3; q += 3.4) { c.beginPath(); c.ellipse(ox, oy + q * 0.35, q * k, q, 0, Math.PI * 0.92, Math.PI * 2.08); c.stroke(); }
  c.restore();
}

/** White melamine desk top, plan view (wall edge at the top of the canvas): colour + roughness.
 *  Dust film towards the wall and around things that never move, specks, lint, a few hairs, a tea ring,
 *  graphite where the eraser was used, hairline scratches, wipe marks and where the hands rest. */
function deskMaps(r) {
  const { x0, x1, z0, z1 } = DESK, W = 4096, H = 2304, cv = makeCanvas(W, H), c = cv.getContext('2d'), rv = makeCanvas(W / 2, H / 2), q = rv.getContext('2d');
  q.scale(0.5, 0.5);                                   // both canvases take the same coordinates
  const S = W / (x1 - x0), X = (x) => (x - x0) * S, Z = (z) => ((z - z0) * H) / (z1 - z0), mm = S / 1000;
  const both = (fn) => { fn(c, true); fn(q, false); };
  c.fillStyle = 'rgb(238,238,236)'; c.fillRect(0, 0, W, H); q.fillStyle = 'rgb(88,88,88)'; q.fillRect(0, 0, W, H);
  c.lineCap = q.lineCap = 'round';
  // sheen never is even: slow clouds, cloth wipes, greasier where the wrists rest
  for (let i = 0; i < 70; i++) softBlob(q, r.range(0, W), r.range(0, H), r.range(120, 620), r.chance(0.5) ? '150,150,150' : '40,40,40', r.range(0.05, 0.13));
  for (let i = 0; i < 16; i++) {
    const cx = r.range(0.1, 0.9) * W, cy = H * r.range(0.9, 1.6), rad = r.range(0.35, 0.9) * H, a0 = -Math.PI / 2 + r.range(-0.9, 0.9), da = r.range(0.25, 0.7);
    for (let k = 0; k < 7; k++) { q.strokeStyle = `rgba(${r.chance(0.6) ? '52,52,52' : '128,128,128'},${r.range(0.03, 0.08)})`; q.lineWidth = r.range(6, 60); q.beginPath(); q.arc(cx, cy, rad + r.range(-70, 70), a0, a0 + da); q.stroke(); }
  }
  for (const [hx, hz] of [[3.02, 0.585], [3.22, 0.6], [3.4, 0.6], [2.9, 0.6]]) for (let k = 0; k < 5; k++) softBlob(q, X(hx + r.range(-0.05, 0.05)), Z(hz + r.range(-0.03, 0.02)), r.range(50, 110) * mm, '36,36,36', r.range(0.06, 0.14));
  // dust film
  const dust = (x, z, rad, a) => { softBlob(c, X(x), Z(z), rad * S, '196,189,176', a); softBlob(q, X(x), Z(z), rad * S, '178,178,178', Math.min(1, a * 3.2)); };
  for (const [k, col, a] of [[c, '198,191,178', 0.2], [q, '182,182,182', 0.6]]) {
    const g = k.createLinearGradient(0, 0, 0, Z(0.115)); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.36, `rgba(${col},${a * 0.42})`); g.addColorStop(1, `rgba(${col},0)`);
    k.fillStyle = g; k.fillRect(0, 0, W, Z(0.115));
  }
  for (let i = 0; i < 26; i++) dust(r.range(x0, x1), z0 + Math.abs(r.gauss()) * 0.03, r.range(0.02, 0.06), r.range(0.04, 0.1));
  for (const [dx, dz, dr, da] of [[2.8, 0.165, 0.12, 0.07], [3.4, 0.2, 0.05, 0.05], [3.74, 0.3, 0.07, 0.08], [3.74, 0.1, 0.08, 0.09], [2.71, 0.08, 0.07, 0.09], [3.05, 0.1, 0.07, 0.06], [3.19, 0.19, 0.05, 0.05], [3.6, 0.22, 0.05, 0.06]]) dust(dx, dz, dr, da);
  // soft contact shadows of the thin things lying flat (they are no occluders for the light bake)
  {
    c.save(); c.filter = 'blur(5px)'; c.fillStyle = c.strokeStyle = 'rgba(64,70,88,0.2)'; c.lineJoin = 'round';
    const quad = (cx, cz, ry, hx, hz, off) => {
      const co = Math.cos(ry), si = Math.sin(ry); c.beginPath();
      [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(([lx, lz], i) => { const wx = X(cx + lx * co + lz * si + off * 0.9), wz = Z(cz - lx * si + lz * co + off * 0.4); if (i) c.lineTo(wx, wz); else c.moveTo(wx, wz); });
      c.closePath(); c.fill();
    };
    quad(NOTE.x, NOTE.z, NOTE.ry, 0.038, 0.038, 0.002); quad(NOTE.x, NOTE.z + 0.012, NOTE.ry, 0.037, 0.026, 0.0042);
    quad(3.062, 0.592, -0.05, 0.086, 0.015, 0.0013);
    for (const [x, z, rad] of [[3.458, 0.553, 0.01125], [3.4745, 0.5715, 0.0094], [3.438, 0.592, 0.01215]]) { c.beginPath(); c.arc(X(x + 0.0011), Z(z + 0.0005), rad * S, 0, TAU); c.fill(); }
    c.lineWidth = 0.0042 * S; c.beginPath(); c.ellipse(X(3.3572), Z(0.6026), 0.0235 * S, 0.0202 * S, -0.4, 0, TAU); c.stroke();
    const cab = [[3.3108, 0.3354], [3.3218, 0.335], [3.3328, 0.341], [3.337, 0.358], [3.332, 0.4], [3.326, 0.44], [3.318, 0.4753], [3.307, 0.492]];
    c.lineWidth = 0.0032 * S; c.beginPath();
    cab.forEach(([x, z], i) => { const px = X(x + 0.0011), pz = Z(z + 0.0004); if (!i) c.moveTo(px, pz); else if (i < cab.length - 1) c.quadraticCurveTo(px, pz, (px + X(cab[i + 1][0] + 0.0011)) / 2, (pz + Z(cab[i + 1][1] + 0.0004)) / 2); else c.lineTo(px, pz); });
    c.stroke(); c.restore();
  }
  both((k, isC) => { const e = 0.0021 * S; k.strokeStyle = isC ? 'rgba(204,201,194,0.5)' : 'rgba(160,160,160,0.5)'; k.lineWidth = isC ? 1.2 : 1.8; k.strokeRect(e, e, W - 2 * e, H - 2 * e); });   // glue line of the edge banding
  // specks
  for (let i = 0; i < 9000; i++) {
    const x = r.range(0, W), y = r.chance(0.3) ? Math.abs(r.gauss()) * 0.05 * S : r.range(0, H), s = r.range(0.6, 2.1) * (r.chance(0.06) ? 1.8 : 1);
    c.fillStyle = r.chance(0.6) ? `rgba(${r.int(70, 120)},${r.int(64, 108)},${r.int(56, 96)},${r.range(0.1, 0.42)})` : `rgba(252,251,248,${r.range(0.3, 0.7)})`;
    c.fillRect(x, y, s, s * r.range(0.6, 1.4));
    q.fillStyle = `rgba(215,215,215,${r.range(0.25, 0.7)})`; q.fillRect(x - 0.5, y - 0.5, s + 1, s + 1);
  }
  // lint and hairs
  for (let i = 0; i < 70; i++) {
    const x = r.range(0, W), y = r.chance(0.35) ? Math.abs(r.gauss()) * 0.06 * S : r.range(0, H), len = r.range(3, 14) * mm, a = r.range(0, TAU), col = r.pick(['120,118,128', '236,236,240', '96,88,80', '150,140,160']);
    both((k, isC) => { k.strokeStyle = isC ? `rgba(${col},0.45)` : 'rgba(205,205,205,0.5)'; k.lineWidth = isC ? 0.9 : 1.6; strand(k, x, y, len, a, 0.9, new RNG(i * 31 + 7)); });
  }
  for (let i = 0; i < 9; i++) {
    const x = X(r.range(2.75, 3.72)), y = Z(r.range(0.05, 0.62)), len = r.range(25, 80) * mm, a = r.range(0, TAU), col = i < 6 ? '58,40,30' : '170,140,100';
    both((k, isC) => { k.strokeStyle = isC ? `rgba(${col},0.55)` : 'rgba(200,200,200,0.4)'; k.lineWidth = isC ? 0.75 : 1.4; strand(k, x, y, len, a, 0.5, new RNG(900 + i)); });
  }
  // ring left by the mug, a few dried drops
  const ring = (x, z, rad, a) => both((k, isC) => {
    const rr = new RNG(Math.round(x * 1000)), cx = X(x), cy = Z(z), R = rad * S;
    if (isC) softBlob(k, cx, cy, R, '176,140,96', a * 0.08);
    for (let t = 0; t < 90; t++) {
      const a0 = (t / 90) * TAU, al = a * clamp(0.45 + 0.8 * Math.sin(a0 * 1.3 + 1.1) * Math.sin(a0 * 2.9 + 0.4) + rr.range(-0.12, 0.12), 0, 1);
      k.strokeStyle = isC ? `rgba(150,108,64,${al})` : `rgba(190,190,190,${Math.min(1, al * 1.5)})`; k.lineWidth = (isC ? 0.9 : 1.2) * mm * rr.range(0.7, 1.3);
      k.beginPath(); k.arc(cx, cy, R * (1 + 0.004 * Math.sin(a0 * 5)), a0, a0 + TAU / 90 + 0.01); k.stroke();
    }
  });
  ring(3.468, 0.493, 0.0322, 0.6); ring(2.93, 0.215, 0.0322, 0.22);
  for (const [x, z, rad] of [[3.428, 0.468, 0.0016], [3.352, 0.548, 0.0011], [3.44, 0.528, 0.0008], [3.5, 0.47, 0.0006]]) both((k, isC) => {
    k.fillStyle = isC ? 'rgba(160,120,78,0.16)' : 'rgba(170,170,170,0.3)'; k.beginPath(); k.arc(X(x), Z(z), rad * S, 0, TAU); k.fill();
    k.strokeStyle = isC ? 'rgba(140,98,58,0.34)' : 'rgba(190,190,190,0.4)'; k.lineWidth = 0.25 * mm; k.stroke();
  });
  // graphite: smears where the eraser was rubbed, dust around the sharpener and the pencil tip
  for (let i = 0; i < 16; i++) {
    const x = X(3.41 + r.gauss() * 0.03), y = Z(0.385 + r.gauss() * 0.022), a = 0.5 + r.range(-0.35, 0.35), L = r.range(8, 26) * mm;
    c.strokeStyle = `rgba(96,98,104,${r.range(0.025, 0.06)})`; c.lineWidth = r.range(2.5, 7) * mm; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const s = i < 600 ? [3.462, 0.292, 0.016] : [3.34, 0.28, 0.012], d = r.range(0.5, 1.5);
    c.fillStyle = `rgba(52,52,58,${r.range(0.2, 0.7)})`; c.fillRect(X(s[0] + r.gauss() * s[2]), Z(s[1] + r.gauss() * s[2]), d, d);
  }
  // hairline scratches, two stray pen marks
  for (let i = 0; i < 80; i++) {
    const x = r.range(0, W), y = r.range(0, H), len = r.range(8, 110) * mm * (r.chance(0.15) ? 2 : 1), a = r.range(0, TAU), deep = r.chance(0.2);
    both((k, isC) => { k.strokeStyle = isC ? `rgba(196,196,194,${deep ? 0.5 : 0.22})` : `rgba(190,190,190,${deep ? 0.75 : 0.4})`; k.lineWidth = isC ? 0.7 : 1.3; strand(k, x, y, len, a, 0.06, new RNG(3000 + i)); });
  }
  c.strokeStyle = 'rgba(38,58,142,0.55)'; c.lineWidth = 0.35 * mm; strand(c, X(3.012), Z(0.563), 9 * mm, 0.4, 0.5, new RNG(41));
  c.strokeStyle = 'rgba(38,58,142,0.4)'; strand(c, X(2.925), Z(0.345), 4 * mm, 2.0, 0.8, new RNG(42));
  overlay(c, W, H, noiseTile(r, 245, 255), 1, 'multiply');
  overlay(q, W / 2, H / 2, noiseTile(r, 108, 148), 0.5, 'overlay');
  return { map: canvasTex(cv, { srgb: true, wrap: false }), rough: canvasTex(rv, { wrap: false }) };
}

/** Laptop lid (hinge edge at the top of the canvas): anodised aluminium that has been carried around —
 *  palm grease, finger prints, sleeve streaks, settled dust, hairline scratches. Colour + roughness. */
function lidMaps(r) {
  const W = 2048, H = 1428, cv = makeCanvas(W, H), c = cv.getContext('2d'), rv = makeCanvas(W, H), q = rv.getContext('2d'), mm = W / 304;
  c.fillStyle = 'rgb(205,206,209)'; c.fillRect(0, 0, W, H); q.fillStyle = 'rgb(94,94,94)'; q.fillRect(0, 0, W, H);
  c.lineCap = q.lineCap = 'round';
  for (let i = 0; i < 40; i++) softBlob(q, r.range(0, W), r.range(0, H), r.range(100, 420), r.chance(0.5) ? '132,132,132' : '62,62,62', r.range(0.05, 0.12));
  const grease = (x, y, rad, a) => {
    const rot = r.range(0, Math.PI), sq = r.range(0.35, 0.85);
    for (const [k, col, al] of [[q, '34,34,34', a], [c, '160,158,158', a * 0.13]]) { k.save(); k.translate(x, y); k.rotate(rot); k.scale(1, sq); softBlob(k, 0, 0, rad * 1.25, col, al); k.restore(); }
  };
  for (const [px, py, n, sp] of [[0.5, 0.93, 9, 0.1], [0.1, 0.8, 7, 0.06], [0.9, 0.82, 7, 0.06], [0.3, 0.45, 5, 0.09], [0.72, 0.3, 4, 0.08]])
    for (let k = 0; k < n; k++) grease(W * (px + r.gauss() * sp), H * (py + r.gauss() * sp * 0.8), r.range(14, 34) * mm, r.range(0.08, 0.22));
  for (let i = 0; i < 10; i++) {
    const y = r.range(0.1, 0.9) * H, x = r.range(0, 0.6) * W;
    q.strokeStyle = `rgba(${r.chance(0.5) ? '120,120,120' : '56,56,56'},${r.range(0.04, 0.1)})`; q.lineWidth = r.range(8, 40);
    q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + W * 0.2, y + r.range(-60, 60), x + W * r.range(0.3, 0.5), y + r.range(-90, 90)); q.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const edge = i < 9, x = W * (edge ? 0.5 + r.gauss() * 0.16 : r.range(0.06, 0.94)), y = H * (edge ? r.range(0.8, 0.97) : r.range(0.08, 0.9)), rx = r.range(6.5, 8.5) * mm, ry = rx * r.range(1.15, 1.45), rot = r.range(-0.7, 0.7), a = r.range(0.35, 0.8);
    fingerprint(q, x, y, rx, ry, rot, '30,30,30', a * 0.8, new RNG(500 + i)); fingerprint(c, x, y, rx, ry, rot, '158,155,154', a * 0.16, new RNG(500 + i));
  }
  for (let i = 0; i < 3800; i++) {
    const x = r.range(0, W), y = r.range(0, H), s = r.range(0.7, 2.4) * (r.chance(0.05) ? 1.7 : 1);
    c.fillStyle = `rgba(238,238,236,${r.range(0.25, 0.75)})`; c.fillRect(x, y, s, s * r.range(0.6, 1.4));
    q.fillStyle = `rgba(225,225,225,${r.range(0.4, 0.9)})`; q.fillRect(x - 0.4, y - 0.4, s + 0.8, s + 0.8);
  }
  for (let i = 0; i < 22; i++) {
    const x = r.range(0, W), y = r.range(0, H), len = r.range(3, 12) * mm, a = r.range(0, TAU);
    for (const [k, st, lw] of [[c, 'rgba(232,232,236,0.55)', 0.9], [q, 'rgba(215,215,215,0.6)', 1.3]]) { k.strokeStyle = st; k.lineWidth = lw; strand(k, x, y, len, a, 0.9, new RNG(700 + i)); }
  }
  for (let i = 0; i < 46; i++) {
    const x = r.range(0, W), y = r.range(0, H), len = r.range(4, 60) * mm, a = r.range(0, TAU);
    for (const [k, st, lw] of [[c, `rgba(226,227,230,${r.range(0.2, 0.5)})`, 0.7], [q, 'rgba(150,150,150,0.5)', 1.0]]) { k.strokeStyle = st; k.lineWidth = lw; strand(k, x, y, len, a, 0.05, new RNG(800 + i)); }
  }
  overlay(c, W, H, noiseTile(r, 246, 255), 1, 'multiply');
  overlay(q, W, H, noiseTile(r, 108, 148), 0.5, 'overlay');
  return { map: canvasTex(cv, { srgb: true, wrap: false }), rough: canvasTex(rv, { wrap: false }) };
}

/** Speckled stoneware glaze (multiplies the mug's vertex colours). */
function speckleTexture() {
  const N = 512, cv = makeCanvas(N, N), c = cv.getContext('2d'), r = new RNG(5521);
  c.fillStyle = '#fff'; c.fillRect(0, 0, N, N);
  for (let i = 0; i < 22; i++) softBlob(c, r.range(135, N - 135), r.range(135, N - 135), r.range(40, 130), '212,198,190', r.range(0.05, 0.14));
  for (let i = 0; i < 520; i++) {
    const s = r.range(0.5, 1.7) * (r.chance(0.08) ? 1.8 : 1);
    c.fillStyle = `rgba(${r.int(70, 120)},${r.int(48, 80)},${r.int(34, 60)},${r.range(0.25, 0.75)})`; c.beginPath(); c.arc(r.range(3, N - 3), r.range(3, N - 3), s, 0, TAU); c.fill();
  }
  return canvasTex(cv, { srgb: true, repeat: [3, 2.2] });
}

/** Relief for the coins (invented designs): left half = sun face, right half = numeral face. */
function coinNormal(r) {
  const N = 256, W = N * 2, cv = makeCanvas(W, N), c = cv.getContext('2d');
  c.fillStyle = 'rgb(96,96,96)'; c.fillRect(0, 0, W, N);
  c.filter = 'blur(1.3px)'; c.lineCap = 'round';
  for (const side of [0, 1]) {
    const cx = side * N + N / 2, cy = N / 2;
    c.strokeStyle = 'rgb(205,205,205)'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, 121, 0, TAU); c.stroke();
    c.fillStyle = 'rgb(190,190,190)';
    for (let k = 0; k < 36; k++) { const a = (k / 36) * TAU; c.beginPath(); c.arc(cx + Math.cos(a) * 108, cy + Math.sin(a) * 108, 2.4, 0, TAU); c.fill(); }
    if (side === 0) {
      c.beginPath(); c.arc(cx, cy + 6, 30, 0, TAU); c.fill();
      c.lineWidth = 5; c.strokeStyle = 'rgb(180,180,180)';
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU, l = k % 2 ? 56 : 68; c.beginPath(); c.moveTo(cx + Math.cos(a) * 40, cy + 6 + Math.sin(a) * 40); c.lineTo(cx + Math.cos(a) * l, cy + 6 + Math.sin(a) * l); c.stroke(); }
      for (let k = 0; k < 13; k++) { const a = Math.PI * 1.12 + (k / 12) * Math.PI * 0.76; c.save(); c.translate(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90); c.rotate(a + Math.PI / 2); c.fillRect(-4, -5, r.range(5, 8), 10); c.restore(); }
    } else {
      c.font = `bold 150px ${FONTS[0]}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('5', cx - 20, cy + 8);
      c.lineWidth = 4; c.strokeStyle = 'rgb(170,170,170)';
      for (let k = 0; k < 7; k++) { const dy = k * 18 - 54; c.beginPath(); c.moveTo(cx + 36, cy + dy); c.lineTo(cx + Math.sqrt(96 * 96 - dy * dy) - 4, cy + dy); c.stroke(); }
    }
  }
  c.filter = 'none';
  const d = c.getImageData(0, 0, W, N).data, Hf = new Float32Array(W * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < W; x++) Hf[(N - 1 - y) * W + x] = d[(y * W + x) * 4] / 255;
  return normalTex(Hf, W, N, 9, { wrap: false });
}

/** Small printed things, one atlas: ruler scale, a sticky note with a scribbled list, the eraser's sleeve, washi tape. */
function paintPrints(r) {
  const W = 2048, H = 1024, cv = makeCanvas(W, H), c = cv.getContext('2d'), out = {};
  const reg = (x, y, w, h) => ({ u0: x / W, u1: (x + w) / W, v0: 1 - (y + h) / H, v1: 1 - y / H });
  c.fillStyle = '#e9e7df'; c.fillRect(0, 0, W, H);
  { // ruler, 172 x 30 mm: centimetres along the far edge, half-centimetre ticks along the near one
    const x = 4, y = 4, w = 2040, h = 356, mm = w / 172;
    c.fillStyle = '#ece9df'; c.fillRect(x - 4, y - 4, w + 8, h + 8);
    c.fillStyle = '#1d1d20'; c.textAlign = 'center'; c.textBaseline = 'top'; c.font = `${Math.round(3.4 * mm)}px ${FONTS[4]}`;
    for (let k = 0; k <= 150; k++) {
      const tx = x + (11 + k) * mm;
      c.fillRect(tx - 0.11 * mm, y, 0.22 * mm, (k % 10 === 0 ? 7.5 : k % 5 === 0 ? 5.6 : 3.6) * mm);
      if (k % 10 === 0) c.fillText(String(k / 10), tx, y + 8.6 * mm);
    }
    for (let k = 0; k <= 30; k++) { const l = (k % 2 ? 2.2 : 3.6) * mm; c.fillRect(x + (11 + k * 5) * mm - 0.11 * mm, y + h - l, 0.22 * mm, l); }
    c.textAlign = 'left'; c.font = `${Math.round(2.6 * mm)}px ${FONTS[4]}`; c.fillText('cm', x + 3.2 * mm, y + 9 * mm);
    c.strokeStyle = 'rgba(150,146,136,0.35)'; c.lineWidth = 1;
    for (let i = 0; i < 26; i++) strand(c, x + r.range(0, w), y + r.range(0, h), r.range(20, 200), r.range(0, TAU), 0.05, r);
    out.ruler = reg(x, y, w, h);
  }
  { // sticky note: a to-do list nobody else can read
    const x = 4, y = 372, w = 600, h = 600, ink = 'rgba(28,38,92,0.86)';
    c.fillStyle = '#f3e283'; c.fillRect(x - 4, y - 4, w + 8, h + 8);
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(120,96,0,0.07)'); g.addColorStop(0.22, 'rgba(120,96,0,0)'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const scribble = (sx, sy, len, amp, lw) => {
      c.strokeStyle = ink; c.lineWidth = lw; c.beginPath();
      let px = sx;
      while (px < sx + len) {
        let qx = px; const end = Math.min(px + r.range(28, 80), sx + len);
        c.moveTo(qx, sy + r.range(-0.3, 0.3) * amp);
        while (qx < end) { const st = r.range(5, 10), up = r.chance(0.18) ? 2.1 : r.chance(0.15) ? -1.5 : 1; c.quadraticCurveTo(qx + st * 0.5, sy - amp * up * r.range(0.6, 1.2), qx + st, sy + r.range(-0.2, 0.25) * amp); qx += st; }
        px = qx + r.range(12, 22);
      }
      c.stroke();
    };
    scribble(x + 70, y + 92, 300, 20, 3.4); c.lineWidth = 2.6; c.beginPath(); c.moveTo(x + 64, y + 118); c.lineTo(x + 372, y + 112); c.stroke();
    for (let i = 0; i < 6; i++) {
      const ly = y + 190 + i * 64 + r.range(-4, 4), len = r.range(230, 430);
      c.strokeStyle = ink; c.lineWidth = 2.6; c.strokeRect(x + 58 + r.range(-3, 3), ly - 22, 22, 22);
      if (i < 3 || i === 4) { c.beginPath(); c.moveTo(x + 60, ly - 12); c.lineTo(x + 68, ly - 3); c.lineTo(x + 86, ly - 28); c.stroke(); }
      scribble(x + 104, ly, len, 15, 3);
      if (i === 1) { c.beginPath(); c.moveTo(x + 100, ly - 6); c.lineTo(x + 110 + len, ly - 9); c.stroke(); }
    }
    c.strokeStyle = 'rgba(176,52,60,0.8)'; c.lineWidth = 3; c.beginPath(); c.ellipse(x + 250, y + 502, 170, 30, -0.04, 0.2, TAU + 0.5); c.stroke();
    out.note = reg(x, y, w, h);
  }
  { // eraser sleeve: bands that run round it, invented lettering in the middle
    const x = 616, y = 372, w = 324, h = 232, blue = '#1f478f', wh = '#f2efe6';
    c.fillStyle = blue; c.fillRect(x - 4, y - 4, w + 8, h + 8);
    c.fillStyle = wh; for (const bx of [22, 40, w - 44, w - 32]) c.fillRect(x + bx, y - 4, bx === 22 || bx === w - 32 ? 10 : 4, h + 8);
    c.fillRect(x + 66, y + 48, 192, 100);
    c.fillStyle = blue; for (let i = 0; i < 3; i++) c.fillRect(x + 78, y + 64 + i * 13, 26, 7);
    const name = word(r, 2).toLowerCase(); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; fitText(c, name, 132, 44, FONTS[1], 'bold'); c.fillText(name, x + 114, y + 100);
    c.fillRect(x + 78, y + 114, 168, 4); c.font = `14px ${FONTS[4]}`; c.fillText('SOFT  ·  DUST-FREE  ·  NO. 40', x + 78, y + 137);
    c.fillStyle = wh; for (let i = 0; i < 5; i++) c.fillRect(x + 66 + i * 38, y + 170, 30, 6); for (let i = 0; i < 4; i++) c.fillRect(x + 66 + i * 47, y + 186, 40, 6);
    out.sleeve = reg(x, y, w, h);
  }
  { // washi tape: little dashes on cream, wraps once round the roll
    const x = 948, y = 372, w = 1024, h = 100;
    c.fillStyle = '#ead9c4'; c.fillRect(x - 4, y - 4, w + 8, h + 8);
    for (let i = 0; i < 64; i++) for (let j = 0; j < 5; j++) { c.fillStyle = (i + j) % 3 ? '#b9694f' : '#6f8a78'; c.save(); c.translate(x + (i + 0.5 + (j % 2) * 0.5) * 16, y + 12 + j * 19); c.rotate(0.6); c.fillRect(-4.5, -1.6, 9, 3.2); c.restore(); }
    out.washi = reg(x, y, w, h);
  }
  paperGrain(c, W, H, r, 0.35);
  return { tex: canvasTex(cv, { srgb: true, wrap: false }), reg: out };
}

// ---- book covers ------------------------------------------------------------------------------------
function drawBook(c, b, r) {
  const { x, y, wp, sp, hp } = b.slot, [bg, fg, ac] = PAL[b.pal], font = FONTS[b.font];
  const sx = x + wp, fx = sx + sp, X0 = x - 5, WW = wp * 2 + sp + 10;
  c.fillStyle = bg; c.fillRect(X0, y - 5, WW, hp + 10);
  if (b.style === 1) { c.fillStyle = ac; c.fillRect(X0, y + hp * 0.055, WW, hp * 0.02); c.fillRect(X0, y + hp * 0.9, WW, hp * 0.02); }
  if (b.style === 2) { c.fillStyle = ac; c.fillRect(X0, y + hp * 0.72, WW, hp * 0.28 + 5); }
  if (b.style === 4) { c.fillStyle = ac; c.fillRect(X0, y - 5, WW, hp * 0.15 + 5); }
  let ink = fg;
  if (b.style === 3) { c.fillStyle = '#efe9da'; c.fillRect(sx + sp * 0.12, y + hp * 0.13, sp * 0.76, hp * 0.52); ink = '#2a2826'; }
  // spine lettering reads top to bottom
  c.save(); c.translate(sx + sp / 2, y + hp * 0.4); c.rotate(Math.PI / 2);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink;
  fitText(c, b.title, hp * (b.style === 3 ? 0.46 : 0.5), clamp(sp * 0.5, 9, hp * 0.085), font, b.bold ? 'bold' : '');
  c.fillText(b.title, 0, 0); c.restore();
  const low = b.style === 2 ? bg : fg;
  c.save(); c.translate(sx + sp / 2, y + hp * 0.8); c.rotate(Math.PI / 2);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = low; c.globalAlpha = 0.85;
  fitText(c, b.author.toUpperCase(), hp * 0.2, clamp(sp * 0.28, 7, hp * 0.04), FONTS[4]);
  c.fillText(b.author.toUpperCase(), 0, 0); c.restore();
  const mx = sx + sp / 2, my = y + hp * 0.955, mr = Math.min(sp * 0.2, hp * 0.018);
  c.fillStyle = low; c.strokeStyle = low; c.lineWidth = Math.max(1, sp * 0.05); c.beginPath();
  if (b.mark === 0) { c.arc(mx, my, mr, 0, TAU); c.stroke(); } else { c.moveTo(mx, my - mr); c.lineTo(mx + mr, my); c.lineTo(mx, my + mr); c.lineTo(mx - mr, my); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(250,244,232,0.14)'; c.fillRect(sx - 1.5, y, 3, hp); c.fillRect(fx - 1.5, y, 3, hp);                 // rubbed hinge edges
  c.fillStyle = 'rgba(250,244,232,0.2)'; c.fillRect(sx, y, sp, 2.5); c.fillRect(sx, y + hp - 2.5, sp, 2.5);                 // head and tail of the spine
  if (!b.full) return;
  // front cover
  const m = wp * 0.1, words = b.title.split(' '), wt = b.bold ? 'bold' : '';
  c.save(); c.beginPath(); c.rect(fx, y, wp, hp); c.clip(); c.textBaseline = 'alphabetic';
  if (b.cover === 0) {
    c.fillStyle = ac; c.beginPath(); c.arc(fx + wp * 0.7, y + hp * 0.66, wp * 0.4, 0, TAU); c.fill();
    c.fillStyle = bg; c.beginPath(); c.arc(fx + wp * 0.56, y + hp * 0.6, wp * 0.3, 0, TAU); c.fill();
    c.fillStyle = fg; c.textAlign = 'left';
    let ty = y + hp * 0.17; const fs = wp * 0.16;
    for (const wd of words) { fitText(c, wd, wp - 2 * m, fs, font, wt); c.fillText(wd, fx + m, ty); ty += fs * 1.08; }
    c.fillRect(fx + m, ty - fs * 0.62, wp * 0.18, Math.max(2, hp * 0.004));
    c.font = `${wp * 0.05}px ${FONTS[4]}`; c.fillText(b.author.toUpperCase(), fx + m, y + hp * 0.93);
  } else if (b.cover === 1) {
    c.strokeStyle = fg; c.lineWidth = Math.max(1.5, wp * 0.006); c.strokeRect(fx + m * 0.6, y + m * 0.6, wp - m * 1.2, hp - m * 1.2);
    c.fillStyle = fg; c.textAlign = 'center';
    let ty = y + hp * 0.3; const fs = wp * 0.13;
    for (const wd of words) { fitText(c, wd, wp - 2.6 * m, fs, font, wt); c.fillText(wd, fx + wp / 2, ty); ty += fs * 1.15; }
    c.fillStyle = ac; c.beginPath(); c.moveTo(fx + wp / 2, ty); c.lineTo(fx + wp / 2 + m * 0.3, ty + m * 0.3); c.lineTo(fx + wp / 2, ty + m * 0.6); c.lineTo(fx + wp / 2 - m * 0.3, ty + m * 0.3); c.closePath(); c.fill();
    c.fillRect(fx + wp * 0.2, ty + m * 0.28, wp * 0.22, Math.max(1.5, hp * 0.003)); c.fillRect(fx + wp * 0.58, ty + m * 0.28, wp * 0.22, Math.max(1.5, hp * 0.003));
    c.fillStyle = fg; c.font = `${wp * 0.052}px ${FONTS[4]}`; c.fillText(b.author.toUpperCase(), fx + wp / 2, y + hp * 0.84);
  } else {
    c.fillStyle = ac; for (let i = 0; i < 7; i++) c.fillRect(fx, y + hp * (0.07 + i * 0.062), wp, hp * 0.03);
    c.fillStyle = fg; c.textAlign = 'left';
    let ty = y + hp * 0.66; const fs = wp * 0.145;
    for (const wd of words) { fitText(c, wd, wp - 2 * m, fs, font, wt); c.fillText(wd, fx + m, ty); ty += fs * 1.1; }
    c.font = `${wp * 0.05}px ${FONTS[4]}`; c.fillText(b.author.toUpperCase(), fx + m, y + hp * 0.93);
  }
  c.restore();
  // back cover: blurb lines + a small label box
  c.save(); c.fillStyle = fg; c.globalAlpha = 0.5;
  for (let i = 0; i < 14; i++) c.fillRect(x + wp * 0.14, y + hp * (0.14 + i * 0.027), wp * (i % 5 === 4 ? r.range(0.25, 0.5) : r.range(0.66, 0.72)), Math.max(1.5, hp * 0.007));
  c.globalAlpha = 1; c.fillStyle = '#f4f1ea'; c.fillRect(x + wp * 0.14, y + hp * 0.82, wp * 0.3, hp * 0.09);
  c.fillStyle = '#26262a'; for (let i = 0; i < 17; i++) if (r.chance(0.62)) c.fillRect(x + wp * 0.158 + i * wp * 0.0155, y + hp * 0.832, wp * 0.008, hp * 0.064);
  c.restore();
}

function defineBooks(r) {
  const mk = (w, h, t, pal, o = {}) => ({
    w, h, t, pal, hard: false, full: false, style: 0, cover: 0, font: r.int(0, 3), bold: r.chance(0.4), mark: r.int(0, 1),
    title: phrase(r, r.chance(0.35) ? 1 : 2), author: word(r, 2) + ' ' + word(r, 2), ...o,
  });
  const stack = [
    mk(0.165, 0.235, 0.032, 0, { hard: true, full: true, style: 1, cover: 0, fine: true }),
    mk(0.152, 0.215, 0.022, 3, { full: true, style: 0, cover: 2, fine: true }),
    mk(0.14, 0.208, 0.027, 8, { hard: true, full: true, style: 0, cover: 1, fine: true }),
    mk(0.125, 0.19, 0.015, 2, { full: true, style: 3, cover: 0, fine: true }),
  ];
  const upright = [
    mk(0.14, 0.215, 0.024, 5, { style: 1 }), mk(0.125, 0.192, 0.031, 9, { style: 2, hard: true }), mk(0.155, 0.236, 0.016, 6, { style: 0 }),
    mk(0.135, 0.205, 0.027, 1, { style: 3 }), mk(0.12, 0.182, 0.034, 4, { style: 0, hard: true }), mk(0.15, 0.226, 0.019, 7, { style: 4 }),
    mk(0.145, 0.232, 0.025, 10, { style: 1, hard: true }),
  ];
  const leaning = [mk(0.135, 0.205, 0.022, 12, { style: 0 }), mk(0.128, 0.188, 0.028, 11, { style: 2, hard: true })];
  const lying = [mk(0.14, 0.2, 0.028, 13, { hard: true, full: true, style: 1, cover: 1 }), mk(0.13, 0.185, 0.016, 3, { full: true, style: 4, cover: 0 })];
  return { stack, upright, leaning, lying, all: [...stack, ...lying, ...upright, ...leaning] };
}

function paintBooks(list, r) {
  const W = 2048, H = 1536, PPM = 2000, cv = makeCanvas(W, H), c = cv.getContext('2d'), pack = packer(W, 5);
  c.fillStyle = '#777'; c.fillRect(0, 0, W, H);
  for (const b of list) {
    const hp = Math.round(b.h * PPM), sp = Math.max(14, Math.round(b.t * PPM)), wp = b.full ? Math.round(b.w * PPM) : 10;
    const s = pack(wp * 2 + sp, hp);
    b.slot = { x: s.x, y: s.y, wp, sp, hp };
    drawBook(c, b, r);
  }
  paperGrain(c, W, H, r, 0.55);
  return { tex: canvasTex(cv, { srgb: true, wrap: false }), W, H };
}

// ---- postcard art -----------------------------------------------------------------------------------
function blob(c, cx, cy, rad, r, fill) {
  const n = 7, pts = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * TAU + r.range(-0.2, 0.2), rr = rad * r.range(0.72, 1.15); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.15]); }
  c.beginPath();
  for (let k = 0; k <= n; k++) {
    const p = pts[k % n], q = pts[(k + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (k === 0) c.moveTo(mx, my); else c.quadraticCurveTo(p[0], p[1], mx, my);
  }
  c.closePath(); c.fillStyle = fill; c.fill();
}
function sheet(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x - 7, y - 7, w + 14, h + 14); }

function artBranch(c, x, y, w, h, r, o) {
  sheet(c, x, y, w, h, o.paper);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
  const lw = Math.max(1.3, w * 0.0065);
  const p0 = [w * (0.5 + r.range(-0.06, 0.06)), h * 0.86], p3 = [w * (0.5 + r.range(-0.1, 0.1)), h * 0.13];
  const p1 = [p0[0] + w * r.range(-0.16, 0.16), h * 0.62], p2 = [p3[0] + w * r.range(-0.16, 0.16), h * 0.36];
  const B = (t) => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, cc = 3 * u * t * t, d = t * t * t; return [a * p0[0] + b * p1[0] + cc * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + cc * p2[1] + d * p3[1]]; };
  c.strokeStyle = o.ink; c.lineWidth = lw * 1.15; c.beginPath(); c.moveTo(p0[0], p0[1]); c.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]); c.stroke();
  const n = o.round ? 8 : r.int(7, 9);
  for (let k = 0; k < n; k++) {
    const t = 0.1 + 0.88 * (k / (n - 1)), q = B(t), q2 = B(Math.min(1, t + 0.02)), dir = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
    for (const side of o.round ? [-1, 1] : [k % 2 ? 1 : -1]) {
      const ang = dir + side * r.range(0.65, 1.0), L = w * lerp(0.3, 0.13, t) * r.range(0.85, 1.1) * (o.round ? 0.6 : 1), wd = L * (o.round ? 0.4 : r.range(0.2, 0.28));
      c.save(); c.translate(q[0], q[1]); c.rotate(ang); c.beginPath(); c.moveTo(0, 0);
      if (o.round) { c.lineTo(L * 0.16, 0); c.ellipse(L * 0.58, 0, L * 0.42, wd, 0, Math.PI, Math.PI * 3); } else { c.quadraticCurveTo(L * 0.42, -wd * 1.6, L, 0); c.quadraticCurveTo(L * 0.5, wd * 1.6, 0, 0); }
      if (o.wash) { c.fillStyle = o.wash; c.fill(); }
      c.strokeStyle = o.ink; c.lineWidth = lw; c.stroke();
      if (!o.round) { c.beginPath(); c.moveTo(0, 0); c.lineTo(L * 0.78, 0); c.lineWidth = lw * 0.6; c.stroke(); }
      c.restore();
    }
  }
  c.fillStyle = o.ink; c.globalAlpha = 0.8; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = `italic ${Math.max(8, w * 0.046)}px ${FONTS[0]}`; c.fillText(o.caption, w / 2, h * 0.955);
  c.restore();
}

function artFlowers(c, x, y, w, h, r, o) {
  sheet(c, x, y, w, h, o.paper);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); c.lineCap = 'round';
  const lw = Math.max(1.3, w * 0.0065);
  for (let s = 0; s < 3; s++) {
    const bx = w * (0.42 + s * 0.08), by = h * 0.9, hx = w * (0.24 + s * 0.26 + r.range(-0.03, 0.03)), hy = h * (0.34 + r.range(-0.06, 0.1) - (s === 1 ? 0.14 : 0));
    const kx = bx + (hx - bx) * 0.1, ky = (by + hy) / 2;
    c.strokeStyle = o.ink; c.lineWidth = lw; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(kx, ky, hx, hy); c.stroke();
    const lx = (bx + 2 * kx + hx) / 4, ly = (by + 2 * ky + hy) / 4, L = w * 0.16, sd = s === 0 ? -1 : 1;
    c.save(); c.translate(lx, ly); c.rotate(-Math.PI / 2 + sd * 0.9); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.45, -L * 0.36, L, 0); c.quadraticCurveTo(L * 0.5, L * 0.36, 0, 0);
    c.fillStyle = o.leaf; c.fill(); c.stroke(); c.restore();
    const pet = r.int(6, 8), R = w * r.range(0.09, 0.115);
    for (let k = 0; k < pet; k++) {
      c.save(); c.translate(hx, hy); c.rotate((k / pet) * TAU + s); c.beginPath(); c.ellipse(R * 0.62, 0, R * 0.5, R * 0.25, 0, 0, TAU);
      c.fillStyle = o.petal[s % o.petal.length]; c.fill(); c.strokeStyle = o.ink; c.lineWidth = lw * 0.8; c.stroke(); c.restore();
    }
    c.beginPath(); c.arc(hx, hy, R * 0.2, 0, TAU); c.fillStyle = o.center; c.fill(); c.stroke();
  }
  c.fillStyle = o.ink; c.globalAlpha = 0.8; c.textAlign = 'center'; c.font = `italic ${Math.max(8, w * 0.046)}px ${FONTS[0]}`; c.fillText(o.caption, w / 2, h * 0.965);
  c.restore();
}

function artAbstract(c, x, y, w, h, r, o) {
  sheet(c, x, y, w, h, o.paper);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y);
  const [c1, c2, c3, c4] = o.pal;
  if (o.kind === 0) {
    const aw = w * 0.4, ax = w * 0.14, ay = h * 0.52;
    c.fillStyle = c1; c.beginPath(); c.moveTo(ax, h * 0.9); c.lineTo(ax, ay); c.arc(ax + aw / 2, ay, aw / 2, Math.PI, 0); c.lineTo(ax + aw, h * 0.9); c.closePath(); c.fill();
    c.fillStyle = o.paper; c.beginPath(); c.moveTo(ax + aw * 0.3, h * 0.9); c.lineTo(ax + aw * 0.3, ay + aw * 0.1); c.arc(ax + aw / 2, ay + aw * 0.1, aw * 0.2, Math.PI, 0); c.lineTo(ax + aw * 0.7, h * 0.9); c.closePath(); c.fill();
    c.fillStyle = c2; c.beginPath(); c.arc(w * 0.68, h * 0.27, w * 0.16, 0, TAU); c.fill();
    blob(c, w * 0.7, h * 0.68, w * 0.2, r, c3);
    c.strokeStyle = c4; c.lineWidth = Math.max(1.5, w * 0.008); c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(w * 0.12, h * (0.12 + i * 0.035)); c.lineTo(w * 0.36, h * (0.12 + i * 0.035)); c.stroke(); }
  } else if (o.kind === 1) {
    for (let i = 0; i < 4; i++) { c.strokeStyle = o.pal[i]; c.lineWidth = w * 0.07; c.beginPath(); c.arc(w * 0.5, h * 0.74, w * (0.36 - i * 0.085), Math.PI, 0); c.stroke(); }
    c.fillStyle = c2; c.beginPath(); c.arc(w * 0.76, h * 0.2, w * 0.085, 0, TAU); c.fill();
  } else {
    blob(c, w * 0.38, h * 0.36, w * 0.26, r, c1); blob(c, w * 0.64, h * 0.6, w * 0.27, r, c2);
    c.globalAlpha = 0.85; blob(c, w * 0.42, h * 0.74, w * 0.16, r, c3); c.globalAlpha = 1;
    c.fillStyle = c4; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(w * (0.66 + (i % 3) * 0.06), h * (0.16 + Math.floor(i / 3) * 0.045), w * 0.012, 0, TAU); c.fill(); }
  }
  c.restore();
}

function artLandscape(c, x, y, w, h, r, o) {
  sheet(c, x, y, w, h, '#f6f3ec');
  const m = w * o.border, ix = x + m, iy = y + m, iw = w - 2 * m, ih = h - 2 * m - (o.foot || 0) * h;
  c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
  const g = c.createLinearGradient(0, iy, 0, iy + ih * 0.8);
  o.sky.forEach((s, i) => g.addColorStop(i / (o.sky.length - 1), s));
  c.fillStyle = g; c.fillRect(ix, iy, iw, ih);
  c.fillStyle = o.sun; c.beginPath(); c.arc(ix + iw * o.sunX, iy + ih * o.sunY, iw * 0.055, 0, TAU); c.fill();
  const nl = o.hills.length;
  for (let k = 0; k < nl; k++) {
    const base = iy + ih * (o.horizon + (1 - o.horizon) * (k / nl) * 0.85), amp = ih * o.amp * (1 - k * 0.12);
    const f1 = r.range(2, 5), f2 = r.range(6, 11), q1 = r.range(0, 6), q2 = r.range(0, 6);
    c.fillStyle = o.hills[k]; c.beginPath(); c.moveTo(ix, iy + ih);
    for (let i = 0; i <= 48; i++) { const u = i / 48; c.lineTo(ix + u * iw, base - amp * (0.65 * Math.sin(u * f1 + q1) + 0.35 * Math.sin(u * f2 + q2))); }
    c.lineTo(ix + iw, iy + ih); c.closePath(); c.fill();
  }
  if (o.sea) {
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = Math.max(1, ih * 0.007);
    for (let i = 0; i < 16; i++) { const yy = iy + ih * (o.horizon + 0.08 + r.range(0, 0.4)), xx = ix + iw * r.range(0.05, 0.8); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + iw * r.range(0.04, 0.16), yy); c.stroke(); }
  }
  c.restore();
}

function artTypo(c, x, y, w, h, r, o) {
  sheet(c, x, y, w, h, o.paper);
  c.fillStyle = o.ink; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const fs = w * 0.16; let ty = y + h * 0.27;
  for (const line of o.lines) { fitText(c, line, w * 0.78, fs, FONTS[0], 'italic'); c.fillText(line, x + w * 0.11, ty); ty += fs * 1.16; }
  c.fillRect(x + w * 0.11, y + h * 0.83, w * 0.2, Math.max(1.5, h * 0.004));
  c.font = `${w * 0.04}px ${FONTS[4]}`; c.fillText(o.foot, x + w * 0.11, y + h * 0.9);
  c.fillStyle = o.accent; c.beginPath(); c.arc(x + w * 0.8, y + h * 0.13, w * 0.045, 0, TAU); c.fill();
}

function artMoon(c, x, y, w, h, r, o) {
  sheet(c, x, y, w, h, o.bg);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = o.moon;
  for (let i = 0; i < 26; i++) { c.globalAlpha = r.range(0.25, 0.8); c.beginPath(); c.arc(x + w * r.range(0.05, 0.95), y + h * r.range(0.03, 0.97), w * r.range(0.004, 0.009), 0, TAU); c.fill(); }
  c.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    const cx = x + w * 0.5, cy = y + h * (0.15 + i * 0.165), R = w * 0.115, ph = (i - 2) / 2;
    c.fillStyle = o.moon; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    if (i !== 2) { c.fillStyle = o.bg; c.beginPath(); c.arc(cx + ph * R * 1.15, cy, R * 1.03, 0, TAU); c.fill(); }
  }
  c.fillStyle = o.moon; c.globalAlpha = 0.85; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `${w * 0.05}px ${FONTS[4]}`; c.fillText(o.caption, x + w / 2, y + h * 0.965);
  c.restore();
}

function artSwatch(c, x, y, w, h, r, o) {
  sheet(c, x, y, w, h, o.paper);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  for (let i = 0; i < o.cols.length; i++) {
    const yy = y + h * (0.07 + i * 0.225);
    c.fillStyle = o.cols[i]; c.fillRect(x + w * 0.12, yy, w * 0.76, h * 0.145);
    c.fillStyle = '#4a4744'; c.font = `${w * 0.058}px ${FONTS[3]}`; c.fillText(o.names[i], x + w * 0.12, yy + h * 0.19);
  }
}

// Collage layout (offsets from POSTCARDS.x0 / y0, metres) — hand placed so nothing overlaps.
function defineCards() {
  return [
    { w: 0.105, h: 0.148, dx: 0.075, dy: 0.795, tape: 'top', rot: -0.02 },
    { w: 0.148, h: 0.105, dx: 0.225, dy: 0.81, tape: 'corners', rot: 0.025 },
    { w: 0.1, h: 0.12, dx: 0.245, dy: 0.675, tape: 'top', rot: -0.035 },
    { w: 0.125, h: 0.175, dx: 0.09, dy: 0.62, tape: 'corners', rot: 0.012 },
    { w: 0.105, h: 0.148, dx: 0.23, dy: 0.525, tape: 'top', rot: 0.03 },
    { w: 0.09, h: 0.09, dx: 0.075, dy: 0.44, tape: 'diag', rot: -0.045 },
    { w: 0.148, h: 0.105, dx: 0.1, dy: 0.295, tape: 'corners', rot: -0.015 },
    { w: 0.09, h: 0.13, dx: 0.245, dy: 0.345, tape: 'top', rot: 0.04 },
    { w: 0.105, h: 0.148, dx: 0.2, dy: 0.155, tape: 'top', rot: -0.028 },
    { w: 0.08, h: 0.11, dx: 0.065, dy: 0.14, tape: 'top', rot: 0.05 },
    { w: 0.1, h: 0.148, frame: true },   // print inside the picture frame on the shelf
  ];
}

function paintCards(cards, r) {
  const W = 2048, H = 1024, PPM = 2800, cv = makeCanvas(W, H), c = cv.getContext('2d'), pack = packer(W, 9);
  c.fillStyle = '#e9e6de'; c.fillRect(0, 0, W, H);
  const P = (i, fn, o) => {
    const k = cards[i], w = Math.round(k.w * PPM), h = Math.round(k.h * PPM), s = pack(w, h);
    k.uv = { u0: s.x / W, u1: (s.x + w) / W, v0: 1 - (s.y + h) / H, v1: 1 - s.y / H };
    fn(c, s.x, s.y, w, h, r.fork(), o);
  };
  P(0, artBranch, { paper: '#efe9da', ink: '#3c4a3b', wash: 'rgba(140,160,128,0.35)', caption: 'Salvea montrosa  ·  no. 12' });
  P(1, artLandscape, { border: 0.045, sky: ['#7f93a8', '#b9b3b4', '#e6c3a6', '#f0d9bd'], sun: 'rgba(255,246,228,0.95)', sunX: 0.68, sunY: 0.5, horizon: 0.56, amp: 0.07, hills: ['#8e9aa6', '#6f8290', '#536a75', '#3d5158', '#2c3b3f'] });
  P(2, artAbstract, { paper: '#f1ece1', kind: 0, pal: ['#b96f52', '#dcae6a', '#8c9c84', '#3a4350'] });
  P(3, artTypo, { paper: '#f3efe6', ink: '#2c2b2a', accent: '#c58b6c', lines: ['the light', 'comes back', 'every', 'morning.'], foot: 'NO. 07  —  PRINTED ON A TUESDAY' });
  P(4, artBranch, { paper: '#f2eee4', ink: '#44564a', wash: 'rgba(120,150,130,0.5)', round: true, caption: 'Eucalia verde  ·  no. 4' });
  P(5, artAbstract, { paper: '#ecd5cb', kind: 1, pal: ['#b5694f', '#e3b877', '#f4ead9', '#8a9a85'] });
  P(6, artLandscape, { border: 0.04, sea: true, sky: ['#aabccb', '#cfd5d6', '#ecd9c6'], sun: 'rgba(255,250,240,0.9)', sunX: 0.3, sunY: 0.36, horizon: 0.5, amp: 0.012, hills: ['#7d9aa8', '#668896', '#507383', '#3d5f70'] });
  P(7, artMoon, { bg: '#283246', moon: '#ece6d6', caption: 'l u n a r' });
  P(8, artFlowers, { paper: '#f3eee3', ink: '#3a3f3a', leaf: 'rgba(138,158,128,0.6)', petal: ['#d9a79c', '#e6c27f', '#c9b4c8'], center: '#c9953f', caption: 'wildflowers, late june' });
  P(9, artSwatch, { paper: '#f4f1ea', cols: ['#d8c9ad', '#b97a5c', '#7f8f72', '#aab4ba'], names: ['oat', 'clay', 'moss', 'fog'] });
  { // framed print: abstract shapes inside a wide off-white mount
    const k = cards[10], w = Math.round(k.w * PPM), h = Math.round(k.h * PPM), s = pack(w, h), m = Math.round(w * 0.17);
    k.uv = { u0: s.x / W, u1: (s.x + w) / W, v0: 1 - (s.y + h) / H, v1: 1 - s.y / H };
    sheet(c, s.x, s.y, w, h, '#f3f0e8');
    artAbstract(c, s.x + m, s.y + m, w - 2 * m, h - 2 * m, r.fork(), { paper: '#e9dfcf', kind: 2, pal: ['#b7785e', '#7c8f86', '#e0b46c', '#33414d'] });
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; c.strokeRect(s.x + m - 1, s.y + m - 1, w - 2 * m + 2, h - 2 * m + 2);
  }
  paperGrain(c, W, H, r, 0.5);
  return { tex: canvasTex(cv, { srgb: true, wrap: false }) };
}

// =====================================================================================================
// materials
// =====================================================================================================
function makeMats(M, bookTex, cardTex, printTex, r) {
  const lac = (rep, s, repY = rep) => { const t = lacquerNormal().clone(); t.repeat.set(rep, repY); t.needsUpdate = true; return { normalMap: t, normalScale: new THREE.Vector2(s, s) }; };
  const oak = oakTexture(), grey = { albedo: [0.45, 0.45, 0.45] };
  const m = {};
  m.white = M.white;                                   // satin melamine
  m.steel = M.metal;
  m.blackMetal = M.blackMetal;
  m.rubber = M.rubber;
  // vertex colour carries roughness in its alpha: one material for all the small mixed-finish things
  const vr = { key: 'deskVR', onCompile(sh) { sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef USE_COLOR_ALPHA\n\troughnessFactor = vColor.a;\n#endif'); } };
  m.vr = pbr({ color: 0xffffff, roughness: 0.5, vertexColors: true }, { bake: grey, ...vr });
  m.vr2 = pbr({ color: 0xffffff, roughness: 0.5, vertexColors: true, side: THREE.DoubleSide }, { bake: { albedo: [0.5, 0.42, 0.3], twoSided: true }, ...vr });   // pencil shavings
  m.vrMetal = pbr({ color: 0xffffff, roughness: 0.3, metalness: 1.0, vertexColors: true }, { bake: grey, ...vr });
  m.glaze = pbr({ color: 0xffffff, map: speckleTexture(), roughness: 0.14, vertexColors: true, ...lac(1.5, 0.12) }, { bake: { albedo: [0.5, 0.33, 0.3] }, ...vr });
  m.coin = pbr({ color: 0xffffff, roughness: 0.4, metalness: 1.0, vertexColors: true, normalMap: coinNormal(r), normalScale: new THREE.Vector2(1.3, 1.3) }, { bake: grey, ...vr });
  for (const k of ['vr', 'vr2', 'vrMetal', 'glaze', 'coin']) m[k].userData.vr = true;
  m.crumb = pbr({ color: 0xffffff, roughness: 0.85 }, { bake: { albedo: [0.5, 0.5, 0.5], ignore: true } });                   // instanced crumbs / grit
  m.clear = pbr({ color: sc(0.9, 0.93, 0.96), transparent: true, opacity: 0.3, roughness: 0.07, depthWrite: false, envMapIntensity: 2.2 }, { bake: { albedo: [0.8, 0.8, 0.8], ignore: true } });
  m.ink = pbr({ map: printTex, roughness: 0.6, side: THREE.DoubleSide }, { bake: { albedo: [0.6, 0.58, 0.48], twoSided: true } });
  const dk = deskMaps(r), lid = lidMaps(r);
  m.deskTop = pbr({ color: 0xffffff, map: dk.map, roughnessMap: dk.rough, roughness: 1, ...lac(15.4, 0.12, 8.7) }, { bake: { albedo: [0.85, 0.85, 0.84] } });
  const pr = lid.rough.clone(); pr.repeat.set(0.3, 0.62); pr.offset.set(0.36, 0.3); pr.needsUpdate = true;
  m.phone = pbr({ color: 0xffffff, roughness: 1, roughnessMap: pr, vertexColors: true }, { bake: grey });                    // satin glass back, handled all day
  m.aluLid = pbr({ color: 0xffffff, map: lid.map, roughnessMap: lid.rough, roughness: 1, metalness: 1.0, ...lac(22, 0.06, 15.4) }, { bake: { albedo: [0.6, 0.6, 0.62] } });
  const sm = smudgeRough(0.4, 0.12).clone(); sm.repeat.set(2.3, 2.3); sm.needsUpdate = true;
  m.shell = pbr({ color: sc(0.925, 0.925, 0.915), roughness: 1, roughnessMap: sm, ...lac(26, 0.07) });
  m.lamp = pbr({ color: sc(0.93, 0.93, 0.92), roughness: 0.3, ...lac(30, 0.05) });
  m.oak = pbr({ map: oak, roughness: 0.6, ...lac(16, 0.1) }, { bake: { albedo: [0.57, 0.39, 0.22] } });
  m.legWood = pbr({ map: oak, color: sc(1.0, 0.95, 0.87), roughness: 0.5 }, { bake: { albedo: [0.52, 0.34, 0.18] } });
  m.alu = pbr({ color: sc(0.8, 0.805, 0.815), roughness: 0.37, metalness: 1.0, ...lac(22, 0.06, 15.4) });
  m.paint = pbr({ color: 0xffffff, roughness: 0.66, vertexColors: true }, { bake: grey });       // paper, card, matte ceramic, rubber cable
  m.satin = pbr({ color: 0xffffff, roughness: 0.36, vertexColors: true }, { bake: grey });       // plastics, wax
  m.gloss = pbr({ color: 0xffffff, roughness: 0.1, vertexColors: true }, { bake: grey });        // glazed ceramic
  m.metalV = pbr({ color: 0xffffff, roughness: 0.3, metalness: 1.0, vertexColors: true }, { bake: grey });
  m.books = pbr({ map: bookTex, roughness: 0.6, ...lac(14, 0.22) }, { bake: { albedo: [0.3, 0.27, 0.24] } });
  m.pages = pbr({ map: pagesTexture(), roughness: 0.9 }, { bake: { albedo: [0.72, 0.68, 0.58] } });
  m.pad = pbr({ map: m.pages.map, color: sc(0.97, 0.88, 0.5), roughness: 0.85 }, { bake: { albedo: [0.7, 0.58, 0.2] } });   // block of sticky notes: sheet edges show on the sides
  m.cards = pbr({ map: cardTex, roughness: 0.82, ...lac(20, 0.18) }, { bake: { albedo: [0.6, 0.57, 0.52] } });
  m.print = pbr({ map: cardTex, roughness: 0.08 }, { bake: { albedo: [0.6, 0.57, 0.52] } });     // behind picture glass
  m.tape = m.paint;
  return m;
}

// =====================================================================================================
// furniture
// =====================================================================================================
function gridLines(a, b, f0, f1, coarse, fine) {
  const out = [a], seg = (p, q, st) => { const n = Math.max(1, Math.ceil((q - p - 1e-9) / st)); for (let k = 1; k <= n; k++) out.push(p + ((q - p) * k) / n); };
  f0 = clamp(f0, a, b); f1 = clamp(f1, a, b);
  if (f0 > a) seg(a, f0, coarse); if (f1 > f0) seg(f0, f1, fine); if (b > f1) seg(f1, b, coarse);
  return out;
}
/** Top face of the desk (with its half of the edge bevel, like roundedBox's 'py' face). Finer grid where the
 *  small things lie, so the bake can give them contact shadows. UV = 0..1 plan position, v = 1 at the wall. */
function deskTopGeo(x0, x1, z0, z1, yTop, rr, rs, fx, fz) {
  const lx = [], lz = [];
  for (let k = 0; k < rs; k++) { lx.push(x0 + (rr * k) / rs); lz.push(z0 + (rr * k) / rs); }
  lx.push(...gridLines(x0 + rr, x1 - rr, fx[0], fx[1], 0.016, 0.008)); lz.push(...gridLines(z0 + rr, z1 - rr, fz[0], fz[1], 0.016, 0.008));
  for (let k = 1; k <= rs; k++) { lx.push(x1 - rr + (rr * k) / rs); lz.push(z1 - rr + (rr * k) / rs); }
  const nx = lx.length, nz = lz.length, pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const ix = clamp(lx[i], x0 + rr, x1 - rr), iz = clamp(lz[j], z0 + rr, z1 - rr), dx = lx[i] - ix, dz = lz[j] - iz, l = Math.hypot(dx, rr, dz);
    pos.push(ix + (dx / l) * rr, yTop - rr + (rr / l) * rr, iz + (dz / l) * rr); nor.push(dx / l, rr / l, dz / l);
    uv.push((lx[i] - x0) / (x1 - x0), (z1 - lz[j]) / (z1 - z0));
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx + 1, d = a + nx; idx.push(a, d, c, a, c, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function buildDesk(add) {
  const { x0, x1, z0, z1, top } = DESK, T = 0.025, yb = top - T;
  add('deskTop', 'deskTop', deskTopGeo(x0, x1, z0, z1, top, 0.0022, 3, [x0, x1], [z0, z1]));
  add('deskEdge', 'white', boxAt(x0, yb, z0, x1 - x0, T, z1 - z0, { r: 0.0022, rs: 3, maxEdge: 0.016, skip: ['py'] }));
  const big = { r: 0.0016, rs: 2, maxEdge: 0.05 }, fr = { r: 0.0018, rs: 2, maxEdge: 0.04 };
  const pz0 = z0 + 0.012, pz1 = z1 - 0.01, th = 0.018;
  const px0 = x1 - 0.38, px1 = x1 - 0.002, fz = pz1 - 0.02, iw = px1 - px0 - 2 * th;   // pedestal x range, carcass front edge
  const B = (...a) => add('deskBody', 'white', boxAt(...a));
  B(x0 + 0.002, 0.0005, pz0, 0.02, yb - 0.0005, pz1 - pz0, big);                 // panel leg (left)
  B(px0, 0.0005, pz0, th, yb - 0.0005, fz - pz0, big);                           // pedestal sides
  B(px1 - th, 0.0005, pz0, th, yb - 0.0005, fz - pz0, big);
  B(px0 + th, 0.06, pz0, iw, th, fz - pz0, big);                                 // bottom
  B(px0 + th, 0.535, pz0 + 0.008, iw, th, fz - pz0 - 0.008, big);                // rail between drawer and door
  B(px0 + th, 0.078, pz0 + 0.002, iw, yb - 0.078, 0.006, big);                   // back
  B(px0 + th, 0.0005, fz - 0.03, iw, 0.0595, 0.016, big);                        // recessed plinth
  const fx0 = px0 + 0.0015, fw = px1 - px0 - 0.003;
  B(fx0, 0.558, fz + 0.002, fw, yb - 0.004 - 0.558, 0.018, fr);                  // drawer front
  B(fx0, 0.064, fz + 0.002, fw, 0.555 - 0.064, 0.018, fr);                       // door
  B(x0 + 0.022, 0.415, pz0 + 0.002, px0 - x0 - 0.022, yb - 0.415, 0.016, big);   // modesty panel
  // small knobs
  const knob = () => lathe([[0, 0], [0.0046, 0], [0.0046, 0.008], [0.0058, 0.0108], [0.0102, 0.0132], [0.0119, 0.0158], [0.0122, 0.0185], [0.0112, 0.021], [0.0075, 0.0224], [0, 0.0228]], 36).rotateX(Math.PI / 2);
  add('deskKnobs', 'steel', knob().translate((px0 + px1) / 2, 0.634, pz1));
  add('deskKnobs', 'steel', knob().translate(px0 + 0.048, 0.508, pz1));
}

// ---- moulded shell chair ---------------------------------------------------------------------------
function shellGeometry() {
  const NA = 56, NB = 96, RS = 5, hh = 0.0024;
  // centre-line profile (z forward, y up): waterfall lip -> seat -> back
  const ctrl = [[0.236, 0.392], [0.229, 0.417], [0.207, 0.437], [0.15, 0.444], [0.06, 0.436], [-0.03, 0.428], [-0.1, 0.432], [-0.155, 0.452], [-0.195, 0.492], [-0.222, 0.55], [-0.238, 0.62], [-0.25, 0.7], [-0.263, 0.77], [-0.28, 0.825]];
  const prof = new THREE.SplineCurve(ctrl.map((p) => new THREE.Vector2(p[0], p[1])));
  const len = prof.getLength();
  const Wf = spline1([[0, 0.2], [0.12, 0.224], [0.3, 0.234], [0.5, 0.232], [0.62, 0.226], [0.78, 0.214], [1, 0.19]]);        // half width
  const Df = spline1([[0, 0.02], [0.12, 0.03], [0.3, 0.05], [0.48, 0.08], [0.58, 0.088], [0.72, 0.066], [0.88, 0.044], [1, 0.03]]); // how far the sides wrap round the sitter
  const c2 = new THREE.Vector2(), t2 = new THREE.Vector2();
  const Q = (s, t, out) => {
    const v = clamp((t + 1) / 2, 0, 1);
    prof.getPointAt(v, c2); prof.getTangentAt(Math.max(v, 0.1), t2);   // the lip's corners lift up, not forward
    const bowl = Df(v) * Math.pow(Math.abs(s), 2.2);
    return out.set(s * Wf(v), c2.y - t2.x * bowl, c2.x + t2.y * bowl);
  };
  // unit square -> superellipse (squarer at the front edge, rounder at the top of the back)
  const sq = (a, b) => {
    const m = Math.max(Math.abs(a), Math.abs(b)); if (m < 1e-9) return [0, 0];
    const L = Math.hypot(a, b), dx = a / L, dy = b / L, n = lerp(4.6, 3.7, smoothstep(-0.35, 0.35, dy));
    const rho = Math.pow(Math.pow(Math.abs(dx), n) + Math.pow(Math.abs(dy), n), -1 / n);
    return [dx * m * rho, dy * m * rho];
  };
  const e = 1e-3, A = V(), B = V(), C = V(), D = V();
  const normalAt = (s, t, out) => { Q(s + e, t, A); Q(s - e, t, B); Q(s, Math.min(1, t + e), C); Q(s, Math.max(-1, t - e), D); A.sub(B); C.sub(D); return out.crossVectors(A, C).normalize(); };
  const W1 = NA + 1, nV = W1 * (NB + 1), P = new Float32Array(nV * 3), Nn = new Float32Array(nV * 3), ST = new Float32Array(nV * 2);
  const p = V(), n = V();
  for (let j = 0; j <= NB; j++) for (let i = 0; i <= NA; i++) {
    const [s, t] = sq((i / NA) * 2 - 1, (j / NB) * 2 - 1), k = j * W1 + i;
    Q(s, t, p); normalAt(s, t, n);
    P[k * 3] = p.x; P[k * 3 + 1] = p.y; P[k * 3 + 2] = p.z; Nn[k * 3] = n.x; Nn[k * 3 + 1] = n.y; Nn[k * 3 + 2] = n.z; ST[k * 2] = s; ST[k * 2 + 1] = t;
  }
  const pos = [], nor = [], uv = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let k = 0; k < nV; k++) {
      pos.push(P[k * 3] + Nn[k * 3] * hh * side, P[k * 3 + 1] + Nn[k * 3 + 1] * hh * side, P[k * 3 + 2] + Nn[k * 3 + 2] * hh * side);
      nor.push(Nn[k * 3] * side, Nn[k * 3 + 1] * side, Nn[k * 3 + 2] * side); uv.push(P[k * 3], ((ST[k * 2 + 1] + 1) / 2) * len);
    }
    for (let j = 0; j < NB; j++) for (let i = 0; i < NA; i++) { const a = base + j * W1 + i, b = a + 1, c = a + W1 + 1, d = a + W1; idx.push(a, b, c, a, c, d); }
  }
  // rolled rim joining the two skins
  const loop = [];
  for (let i = 0; i <= NA; i++) loop.push(i);
  for (let j = 1; j <= NB; j++) loop.push(j * W1 + NA);
  for (let i = NA - 1; i >= 0; i--) loop.push(NB * W1 + i);
  for (let j = NB - 1; j >= 1; j--) loop.push(j * W1);
  const Ln = loop.length, base = pos.length / 3, Bt = V(), Nv = V(), To = V(), R1 = V(), R2 = V();
  for (let m = 0; m < Ln; m++) {
    const k = loop[m], kp = loop[(m + 1) % Ln], km = loop[(m - 1 + Ln) % Ln];
    Bt.set(P[kp * 3] - P[km * 3], P[kp * 3 + 1] - P[km * 3 + 1], P[kp * 3 + 2] - P[km * 3 + 2]);
    Nv.set(Nn[k * 3], Nn[k * 3 + 1], Nn[k * 3 + 2]); To.crossVectors(Bt, Nv).normalize();
    Q(ST[k * 2], ST[k * 2 + 1], R1); Q(ST[k * 2] * 0.97, ST[k * 2 + 1] * 0.97, R2); R1.sub(R2);
    if (To.dot(R1) < 0) To.negate();
    for (let q = 0; q <= RS; q++) {
      const a = (q / RS) * Math.PI, cs = Math.cos(a), sn = Math.sin(a);
      pos.push(P[k * 3] + (Nv.x * cs + To.x * sn) * hh, P[k * 3 + 1] + (Nv.y * cs + To.y * sn) * hh, P[k * 3 + 2] + (Nv.z * cs + To.z * sn) * hh);
      nor.push(Nv.x * cs + To.x * sn, Nv.y * cs + To.y * sn, Nv.z * cs + To.z * sn); uv.push(P[k * 3], ((ST[k * 2 + 1] + 1) / 2) * len);
    }
  }
  const R = RS + 1;
  for (let m = 0; m < Ln; m++) for (let q = 0; q < RS; q++) { const a = base + m * R + q, b = base + ((m + 1) % Ln) * R + q, c = b + 1, d = a + 1; idx.push(a, b, c, a, c, d); }
  // make every triangle face the way its vertex normals point
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    A.set(pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]);
    B.set(pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]);
    C.crossVectors(A, B);
    if (C.x * (nor[a * 3] + nor[b * 3] + nor[c * 3]) + C.y * (nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1]) + C.z * (nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2]) < 0) { idx[i + 1] = c; idx[i + 2] = b; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // underside height of the seat at (x, z), for the leg mounts
  const underside = (x, z) => {
    let best = 1e9, q = 0;
    for (let k = 0; k < nV; k++) { if (P[k * 3 + 1] > 0.5) continue; const d = (P[k * 3] - x) ** 2 + (P[k * 3 + 2] - z) ** 2; if (d < best) { best = d; q = k; } }
    const nrm = V(Nn[q * 3], Nn[q * 3 + 1], Nn[q * 3 + 2]);
    return { p: V(P[q * 3], P[q * 3 + 1], P[q * 3 + 2]).addScaledVector(nrm, -hh), n: nrm };
  };
  const seamPts = [];
  for (let k = 0; k <= 40; k++) { const t = lerp(-0.86, 0.9, k / 40); Q(0, t, p); normalAt(0, t, n); seamPts.push(p.clone().addScaledVector(n, -(hh + 0.00012))); }
  return { geo: g, underside, seam: pipe(seamPts, 0.00042, { tubular: 80, radial: 5, cap: false }) };
}

function buildChair(add) {
  const m4 = M4(3.18, 0, 1.0, Math.PI - 0.35);
  const put = (name, key, geo) => add(name, key, geo, m4);
  const { geo, underside, seam } = shellGeometry();
  put('chairShell', 'shell', geo);
  put('chairShell', 'shell', seam);
  const tops = [[0.105, 0.1], [-0.105, 0.1], [-0.105, -0.12], [0.105, -0.12]], feet = [[0.2, 0.19], [-0.2, 0.19], [-0.2, -0.21], [0.2, -0.21]];
  const at = [];
  for (let i = 0; i < 4; i++) {
    const un = underside(tops[i][0], tops[i][1]), yu = un.p.y;
    const a = V(feet[i][0], 0.004, feet[i][1]), b = V(tops[i][0], yu - 0.013, tops[i][1]), dir = V().subVectors(b, a).normalize();
    const f = (t) => a.clone().lerp(b, t); at.push(f);
    const leg = pipe([a, f(0.5), b], (t) => lerp(0.0088, 0.0128, smoothstep(0, 0.8, t)), { tubular: 10, radial: 18, cap: true });
    const uv = leg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getY(k) + i * 0.13, uv.getX(k) * 0.055 + i * 0.21);   // grain runs along the leg
    put('chairLegs', 'legWood', leg);
    put('chairFeet', 'rubber', rod(a.clone().addScaledVector(dir, -0.007), f(0.03), 0.0093, 0.0095, 14));
    put('chairBase', 'blackMetal', rod(f(0.905), f(1.002), 0.0136, 0.0136, 16));                        // steel socket on the leg
    put('chairBase', 'blackMetal', rod(V(b.x, b.y - 0.001, b.z), un.p.clone().addScaledVector(un.n, -0.006), 0.0075, 0.0075, 12));
    put('chairFeet', 'rubber', rod(un.p.clone().addScaledVector(un.n, -0.0085), un.p.clone().addScaledVector(un.n, 0.0008), 0.0175, 0.019, 20));   // shock mount glued under the shell
  }
  for (let i = 0; i < 4; i++) {   // wire cross-bracing between neighbouring legs
    const j = (i + 1) % 4;
    put('chairBase', 'blackMetal', rod(at[i](0.93), at[j](0.5), 0.0026, 0.0026, 8, true));
    put('chairBase', 'blackMetal', rod(at[j](0.93), at[i](0.5), 0.0026, 0.0026, 8, true));
  }
}

// ---- desk lamp (off) --------------------------------------------------------------------------------
function buildLamp(add, top) {
  const m4 = M4(2.8, top, 0.165, -0.35);
  const put = (key, geo) => add('lamp_' + key, key, geo, m4);
  put('lamp', lath([[0, 0], [0.0705, 0], [0.0738, 0.0012], [0.075, 0.004], [0.075, 0.0105], [0.0738, 0.0138], [0.0705, 0.0155], [0.05, 0.0172], [0.022, 0.0186], [0.012, 0.02], [0.0092, 0.0235], [0.0085, 0.034], [0.0066, 0.037], [0.0052, 0.0375]], 72));
  const pts = [[0, 0.03, 0], [0, 0.12, 0], [0, 0.23, 0], [0.004, 0.31, 0], [0.022, 0.375, 0], [0.062, 0.418, 0], [0.112, 0.425, 0], [0.15, 0.398, 0], [0.166, 0.36, 0]].map((q) => V(q[0], q[1], q[2]));
  put('lamp', pipe(pts, 0.0052, { tubular: 72, radial: 14, cap: false }));
  // head: bell shade opening along the end of the neck
  const end = pts[pts.length - 1], dir = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getTangentAt(1).normalize();
  const hq = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), dir)).setPosition(end.x + dir.x * 0.014, end.y + dir.y * 0.014, end.z + dir.z * 0.014);
  const O0 = [[0.0105, 0], [0.019, -0.005], [0.0285, -0.0145], [0.037, -0.03], [0.0445, -0.049], [0.0515, -0.068], [0.0535, -0.074]];
  const rs = spline1(O0.map((q, i) => [i, q[0]])), ys = spline1(O0.map((q, i) => [i, q[1]])), O = [];
  for (let i = 0; i <= (O0.length - 1) * 3; i++) O.push([rs(i / 3), ys(i / 3)]);       // smooth bell outline
  const n = O.length - 1, prof = [[0.0001, -0.0042]];
  for (let k = 0; k < n; k++) prof.push([O[k][0] - 0.0016, Math.min(O[k][1] - 0.0011, -0.0042)]);
  prof.push([O[n][0] - 0.0016, O[n][1]], [O[n][0] - 0.0008, O[n][1] - 0.0009]);
  for (let k = n; k >= 0; k--) prof.push(O[k]);
  prof.push([0.0001, 0.0006]);
  const head = [
    ['lamp', new THREE.CylinderGeometry(0.0085, 0.0085, 0.026, 18).translate(0, 0.011, 0)],
    ['lamp', new THREE.CylinderGeometry(0.0115, 0.0125, 0.026, 18).translate(0, -0.0175, 0)],
    ['satin', tint(new THREE.SphereGeometry(0.0185, 22, 14).translate(0, -0.043, 0), [0.95, 0.95, 0.93])],
  ];
  for (const [key, g] of head) put(key, g.applyMatrix4(hq));
  const bell = tintR(lath(prof, 64, 0.008).applyMatrix4(hq), [0.93, 0.93, 0.92], 0.3), bn = bell.attributes.normal;
  paintV(bell, (x, y, z, i) => {
    const d = smoothstep(0.35, 0.95, bn.getY(i)) * (0.6 + 0.4 * Math.sin(x * 310 + z * 170) * Math.sin(z * 260 - x * 90));
    return d > 0 ? [...mix3([0.93, 0.93, 0.92], [0.78, 0.77, 0.74], 0.5 * d), 0.3 + 0.5 * d] : null;
  });
  put('vr', bell);
  put('satin', tint(roundedBox(0.015, 0.0045, 0.0085, { r: 0.0015, rs: 2 }).translate(-0.045, 0.0185, 0), [0.07, 0.07, 0.075]));   // rocker switch
}

// ---- plugs + cables down to the wall sockets --------------------------------------------------------
function buildCables(add, top, lap) {
  const W = [0.9, 0.9, 0.885], r = 0.0017, y = top + r;
  const pts = (a) => a.map((q) => V(q[0], q[1], q[2]));
  const s1 = 3.2, s2 = 3.281, sy = 0.32, sz = 0.0125;   // twin socket plate on the window wall
  // laptop charger: brick in the left socket, cable up behind the desk to the laptop's left side
  add('plugs', 'satin', tint(slab(0.05, 0.05, 0.028, { cr: 0.008, er: 0.003, cs: 4, es: 3, maxEdge: 0.03 }).rotateX(Math.PI / 2).translate(s1, sy, sz), W));
  add('plugs', 'satin', tint(rod(V(s1, sy - 0.024, sz + 0.014), V(s1, sy - 0.04, sz + 0.014), 0.0034, 0.0023, 10), W));
  const p0 = lap(-0.1655, 0.0054, -0.07), p1 = lap(-0.178, 0.0049, -0.0705), p2 = lap(-0.196, 0.0019, -0.068);
  add('cables', 'paint', tint(wire(pts([[p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], [p2.x, p2.y + 0.0003, p2.z], [2.914, y, 0.3], [2.912, y, 0.24], [2.925, y, 0.15], [2.938, y, 0.07], [2.942, y, 0.03],
    [2.9435, top + 0.0012, 0.0175], [2.9445, top - 0.007, 0.0115], [2.946, 0.7, 0.0105], [2.952, 0.6, 0.0105], [2.968, 0.46, 0.011], [3.01, 0.335, 0.013], [3.08, 0.262, 0.017], [3.15, 0.243, 0.022], [3.19, 0.257, 0.0255], [s1, 0.283, sz + 0.014]]), r), W));
  // lamp: flat plug in the right socket, cord over the back edge to the lamp base
  add('plugs', 'satin', tint(roundedBox(0.037, 0.044, 0.017, { r: 0.006, rs: 3 }).translate(s2, sy, sz + 0.0085), W));
  add('plugs', 'satin', tint(rod(V(s2, sy - 0.021, sz + 0.009), V(s2, sy - 0.037, sz + 0.009), 0.0033, 0.0022, 10), W));
  add('plugs', 'satin', tint(rod(V(2.7395, top + 0.0066, 0.1432), V(2.7265, top + 0.0042, 0.1347), 0.0034, 0.0023, 10), W));   // strain relief where the cord leaves the lamp base
  add('cables', 'paint', tint(wire(pts([[2.736, top + 0.0062, 0.141], [2.718, top + 0.0024, 0.129], [2.712, y, 0.1], [2.735, y, 0.06], [2.752, y, 0.03], [2.756, top + 0.0012, 0.0175], [2.758, top - 0.007, 0.0115],
    [2.762, 0.7, 0.0105], [2.775, 0.56, 0.0105], [2.8, 0.4, 0.011], [2.87, 0.25, 0.012], [2.98, 0.17, 0.014], [3.12, 0.15, 0.017], [3.23, 0.18, 0.02], [3.272, 0.235, 0.0215], [s2, 0.286, sz + 0.009]]), 0.0016), W));
}

// =====================================================================================================
// things on the desk
// =====================================================================================================
function buildLaptop(add, top) {
  const cx = 3.13, cz = 0.385, ry = 0.05, m4 = M4(cx, top, cz, ry);
  const o = { cr: 0.0115, er: 0.0016, cs: 6, es: 4, maxEdge: 0.025 };
  add('laptop', 'alu', slab(0.304, 0.212, 0.0094, o).translate(0, 0.0008, 0), m4);
  add('laptopLid', 'aluLid', slab(0.304, 0.212, 0.0052, o).translate(0, 0.0106, 0), m4);       // smudged, dusty lid (own maps)
  add('laptopDark', 'rubber', slab(0.3024, 0.2104, 0.0014, { cr: 0.0107, er: 0.0002, cs: 6, es: 1 }).translate(0, 0.0097, 0), m4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('laptopDark', 'rubber', new THREE.CylinderGeometry(0.0055, 0.0055, 0.0012, 14).translate(sx * 0.125, 0.0006, sz * 0.082), m4);
  add('laptopDark', 'rubber', rod(V(-0.118, 0.0101, -0.1026), V(0.118, 0.0101, -0.1026), 0.0036, 0.0036, 14), m4);                       // hinge barrel
  for (const [sx, pz] of [[-1, -0.05], [-1, -0.034], [1, -0.04]]) add('laptopDark', 'rubber', roundedBox(0.0008, 0.0028, 0.0088, { r: 0.00035, rs: 1 }).translate(sx * 0.1519, 0.0052, pz), m4);   // ports
  add('laptopDark', 'rubber', new THREE.CylinderGeometry(0.0018, 0.0018, 0.0008, 14).rotateZ(Math.PI / 2).translate(0.1519, 0.0052, -0.062), m4);
  add('plugs', 'satin', tint(roundedBox(0.0125, 0.0046, 0.0086, { r: 0.0016, rs: 2 }).translate(-0.152 - 0.0058, 0.0054, -0.07), [0.9, 0.9, 0.885]), m4);
  const c = Math.cos(ry), s = Math.sin(ry);
  return (lx, ly, lz) => V(cx + c * lx + s * lz, top + ly, cz - s * lx + c * lz);   // laptop-local -> world
}

function bookGeos(b, AW, AH) {
  const { w, h, t, hard } = b, ct = hard ? 0.0024 : 0.0007, ov = hard ? 0.003 : 0, { x, y, wp, sp, hp } = b.slot;
  const v0 = 1 - (y + hp) / AH, v1 = 1 - y / AH, bu0 = x / AW, bu1 = (x + wp) / AW, su1 = (x + wp + sp) / AW, fu1 = (x + 2 * wp + sp) / AW;
  const br = { r: Math.min(0.0008, ct * 0.45), rs: 1, maxEdge: b.fine ? 0.03 : 0.2 };
  const front = boxAt(0, t - ct, -h / 2, w, ct, h, br), back = boxAt(0, 0, -h / 2, w, ct, h, br), spine = boxAt(0, ct, -h / 2, ct, t - 2 * ct, h, br);
  const remap = (g, fn) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, fn(p.getX(i), p.getY(i)), lerp(v1, v0, clamp((p.getZ(i) + h / 2) / h, 0, 1))); return g; };
  remap(front, (px) => lerp(su1, fu1, clamp(px / w, 0, 1)));
  remap(back, (px) => lerp(bu1, bu0, clamp(px / w, 0, 1)));
  remap(spine, (px, py) => lerp(bu1, su1, clamp(py / t, 0, 1)));
  const gap = hard ? 0.0015 : 0;
  const pages = boxAt(ct + gap, ct, -h / 2 + ov, w - ct - ov - gap, t - 2 * ct, h - 2 * ov, { r: 0.0004, rs: 1, maxEdge: 0.2 });
  return { cover: [front, back, spine], pages };
}

function buildDeskThings(add, top, books, AW, AH, r, prints) {
  const placeBook = (b, m4) => { const g = bookGeos(b, AW, AH); for (const q of g.cover) add('bookCovers', 'books', q, m4); add('bookPages', 'pages', g.pages, m4); };
  // ---- stack of books, spines towards the room
  let y = top;
  for (const b of books.stack) {
    const m4 = M4(3.615 + r.range(-0.008, 0.008), y, 0.415 - b.w / 2 + r.range(-0.007, 0.004), Math.PI / 2 + r.range(-0.07, 0.07)).multiply(new THREE.Matrix4().makeTranslation(-b.w / 2, 0, 0));
    placeBook(b, m4); y += b.t;
    if (b === books.stack[0] || b === books.stack[2]) [[0.03, 0.42, [0.95, 0.36, 0.55]], [0.052, 0.6, [0.96, 0.84, 0.25]], [0.105, 0.5, [0.3, 0.62, 0.86]]].slice(0, b === books.stack[0] ? 3 : 1).forEach(([lx, ky, col]) =>
      add('vrThings', 'vr', tintR(roundedBox(0.0062, 0.00016, 0.013, { r: 0.00006, rs: 1 }).translate(lx, b.t * ky, -b.h / 2 + 0.001), col, 0.5), m4));
  }
  // ---- pen cup with pencils and pens
  {
    const m4 = M4(3.045, top, 0.105, 0.4), ri = 0.0312, rimY = 0.098, col = [0.74, 0.73, 0.71];
    add('paintThings', 'paint', tint(lath([[0, 0], [0.0318, 0], [0.0338, 0.0014], [0.0372, 0.096], [0.0366, 0.098], [0.0348, 0.098], [0.0342, 0.096], [0.0312, 0.0068], [0.0298, 0.0055], [0, 0.0055]], 56), col), m4);
    const items = [
      ['pencil', 0.176, [0.84, 0.64, 0.2], { eraser: true }], ['pen', 0.142, [0.9, 0.9, 0.88], {}], ['pencil', 0.158, [0.17, 0.3, 0.23], { eraser: false }],
      ['marker', 0.128, [0.62, 0.8, 0.7], {}], ['pencil', 0.183, [0.8, 0.67, 0.5], { eraser: true, tipUp: false }], ['pen', 0.146, [0.13, 0.17, 0.29], {}], ['pencil', 0.166, [0.6, 0.21, 0.19], { eraser: false }],
      ['scissors', 0.145, [0.12, 0.38, 0.4], {}],
    ];
    items.forEach(([kind, L, rgb, o], k) => {
      const az = (k / items.length) * TAU + r.range(-0.18, 0.18), ir = kind === 'marker' ? 0.0076 : kind === 'scissors' ? 0.011 : kind === 'pen' ? 0.0043 : 0.0037;
      const rr = ri - ir - 0.0004 - (rimY / 0.09) * 0.0003, rb = kind === 'marker' ? 0.02 : kind === 'scissors' ? 0.006 : r.range(0.0125, 0.0205), azb = az + r.range(-0.3, 0.3);
      const Bp = V(Math.cos(azb) * rb, 0.0062, Math.sin(azb) * rb), Rp = V(Math.cos(az) * rr, rimY, Math.sin(az) * rr), d = V().subVectors(Rp, Bp).normalize();
      const q = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d).multiply(new THREE.Quaternion().setFromAxisAngle(UP, r.range(0, TAU)))).setPosition(Bp);
      const parts = kind === 'pencil' ? pencilGeos(L, rgb, o) : kind === 'pen' ? penGeos(L, rgb) : kind === 'scissors' ? scissorsGeos(rgb) : markerGeos(L, rgb);
      for (const [key, g] of parts) add(key + 'Things', key, g.applyMatrix4(q), m4);
    });
  }
  // ---- notebook with an elastic band, pen on top
  {
    const m4 = M4(2.822, top, 0.47, 0.18), K = [0.71, 0.57, 0.41];
    add('paintThings', 'paint', tint(slab(0.148, 0.21, 0.0012, { cr: 0.006, er: 0.0004, maxEdge: 0.03 }), K), m4);
    add('paintThings', 'paint', tint(slab(0.1445, 0.2065, 0.0098, { cr: 0.005, er: 0.0003, es: 1 }).translate(-0.0008, 0.0012, 0), [0.93, 0.91, 0.85]), m4);
    add('paintThings', 'paint', tint(slab(0.148, 0.21, 0.0014, { cr: 0.006, er: 0.0005, maxEdge: 0.03 }).translate(0, 0.011, 0), K), m4);
    add('paintThings', 'paint', tint(slab(0.056, 0.024, 0.0002, { cr: 0.002, er: 0.00008, es: 1 }).translate(-0.008, 0.01238, -0.052), [0.92, 0.9, 0.84]), m4);
    add('paintThings', 'paint', tint(roundedBox(0.0062, 0.0134, 0.2112, { r: 0.0004, rs: 1, maxEdge: 0.05 }).translate(0.05, 0.0063, 0), [0.1, 0.1, 0.11]), m4);
    const pm = M4(2.822, top + 0.0124 + 0.0043, 0.47, 0.18 + 0.62).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(2.1)).multiply(new THREE.Matrix4().makeTranslation(0, -0.07, 0));
    for (const [key, g] of penGeos(0.144, [0.11, 0.11, 0.12])) add(key + 'Things', key, g, pm);
  }
  // ---- mug (glazed), half a cup of tea left in it
  {
    const m4 = M4(3.388, top, 0.518, -0.9), G = [0.79, 0.61, 0.57], tea = 0.054;
    const mug = tintR(lath([[0, 0.0012], [0.027, 0.0012], [0.0285, 0], [0.032, 0], [0.0365, 0.0026], [0.0396, 0.009], [0.0405, 0.02], [0.0405, 0.086], [0.0399, 0.0891], [0.0386, 0.09], [0.0373, 0.0891], [0.0367, 0.086],
      [0.0367, 0.0795], [0.0367, 0.0784], [0.0367, 0.0773], [0.0367, 0.076], [0.0367, 0.066], [0.0367, 0.061], [0.0367, 0.0585], [0.0367, 0.057], [0.0367, 0.0556], [0.0367, 0.0546], [0.0367, 0.0536], [0.0367, 0.013], [0.034, 0.0072], [0, 0.0066]], 72), G, 0.13);
    paintV(mug, (x, y, z) => {
      const rad = Math.hypot(x, z), a = Math.atan2(z, x);
      if (y > 0.0875) return [...mix3(G, [0.6, 0.42, 0.34], 0.5 * smoothstep(0.0875, 0.0895, y)), 0.2];      // the glaze breaks thin over the rim
      if (y < 0.0028 && rad > 0.026) return [0.78, 0.7, 0.6, 0.85];                                            // unglazed foot ring
      if (rad < 0.0368 && y > tea - 0.001 && y < 0.081) {                                                      // tide marks the tea left behind
        const n = 0.5 + 0.5 * Math.sin(a * 3 + 1) * Math.sin(a * 7 + 2.2), line = Math.exp(-(((y - 0.0556 - 0.0012 * Math.sin(a * 2)) / 0.0011) ** 2));
        const old = Math.exp(-(((y - 0.0778 - 0.0007 * Math.sin(a * 3 + 1)) / 0.0009) ** 2)), film = smoothstep(0.066, 0.055, y) * 0.28 + smoothstep(0.081, 0.07, y) * 0.07;
        const t = clamp(line * (0.45 + 0.4 * n) + old * (0.26 + 0.3 * n) + film * (0.4 + 0.6 * n), 0, 0.85);
        return [...mix3(G, [0.42, 0.26, 0.14], t), 0.13 + 0.5 * t];
      }
      return null;
    });
    add('mug', 'glaze', mug, m4);
    const hpts = [[0.039, 0.071], [0.052, 0.0738], [0.0645, 0.0645], [0.068, 0.048], [0.0625, 0.031], [0.05, 0.0222], [0.039, 0.022]].map((q) => V(q[0], q[1], 0));
    add('mug', 'glaze', tintR(pipe(hpts, 0.0047, { tubular: 40, radial: 18, cap: false }).applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 1.55)), G, 0.13), m4);
    // a drip that ran down the outside and dried
    const dp = [[0, 0.0888], [0.0003, 0.083], [-0.0004, 0.076], [0.0002, 0.069], [0.0006, 0.063], [0.0004, 0.0595], [0.0004, 0.0575]].map((q) => V(q[0], q[1], 0));
    const drip = pipe(dp, (t) => 0.00045 + 0.00022 * Math.sin(t * 9) ** 2 + 0.0008 * smoothstep(0.8, 0.94, t) * (1 - 0.6 * smoothstep(0.97, 1, t)), { tubular: 28, radial: 8, cap: true });
    drip.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 0.42)).translate(0, 0, 0.0405).rotateY(-0.262);
    add('mug', 'glaze', tintR(drip, [0.6, 0.42, 0.34], 0.22), m4);
    add('glossThings', 'gloss', tint(new THREE.CircleGeometry(0.0368, 32).rotateX(-Math.PI / 2).translate(0, tea, 0), [0.3, 0.17, 0.08]), m4);
    // the tea bag is still in: string over the rim, paper tag hanging against the outside
    const tagR = new THREE.Matrix4().makeRotationY(0.349), tagM = new THREE.Matrix4().makeRotationZ(0.07).setPosition(0.0004, 0.0375, 0.04135);
    const sp = [[0.002, 0.054, 0.03], [0.001, 0.07, 0.0345], [0, 0.085, 0.0362], [0, 0.0909, 0.0386], [0, 0.0886, 0.041], [0.0005, 0.075, 0.0411], [-0.0008, 0.058, 0.0411], [0, 0.0495, 0.0412]].map((q) => V(q[0], q[1], q[2]));
    add('vrThings', 'vr', tintR(wire(sp, 0.00032, { radial: 5, maxAng: 0.3, maxLen: 0.006 }), [0.92, 0.9, 0.84], 0.9).applyMatrix4(tagR), m4);
    add('vrThings', 'vr', tintR(roundedBox(0.019, 0.024, 0.0004, { r: 0.00015, rs: 1 }), [0.93, 0.9, 0.82], 0.85).applyMatrix4(tagM).applyMatrix4(tagR), m4);
    add('vrThings', 'vr', tintR(roundedBox(0.0191, 0.0052, 0.00044, { r: 0.00015, rs: 1 }).translate(0, 0.0072, 0), [0.42, 0.56, 0.45], 0.8).applyMatrix4(tagM).applyMatrix4(tagR), m4);
  }
  // ---- small white lidded box at the back right, with a label holder
  {
    const m4 = M4(3.4, top, 0.125, -0.04), Wc = [0.925, 0.92, 0.905];
    add('paintThings', 'paint', tint(slab(0.196, 0.126, 0.07, { cr: 0.004, er: 0.0012, hs: 2, maxEdge: 0.03 }), Wc), m4);
    add('paintThings', 'paint', tint(slab(0.2, 0.13, 0.03, { cr: 0.0055, er: 0.0015, maxEdge: 0.03 }).translate(0, 0.062, 0), Wc), m4);
    const f = [roundedBox(0.054, 0.004, 0.0018, { r: 0.0006, rs: 1 }).translate(0, 0.045, 0.0639), roundedBox(0.054, 0.004, 0.0018, { r: 0.0006, rs: 1 }).translate(0, 0.023, 0.0639),
      roundedBox(0.004, 0.026, 0.0018, { r: 0.0006, rs: 1 }).translate(-0.025, 0.034, 0.0639), roundedBox(0.004, 0.026, 0.0018, { r: 0.0006, rs: 1 }).translate(0.025, 0.034, 0.0639)];
    for (const g of f) add('metalVThings', 'metalV', tint(g, [0.8, 0.66, 0.4]), m4);
    add('paintThings', 'paint', tint(roundedBox(0.047, 0.019, 0.0008, { r: 0.0002, rs: 1 }).translate(0, 0.034, 0.0634), [0.94, 0.92, 0.86]), m4);
  }
  // ---- sticky notes, a roll of paper tape
  add('padBlock', 'pad', roundedBox(0.076, 0.008, 0.076, { r: 0.0003, rs: 1, maxEdge: 0.03 }).translate(0, 0.004, 0), M4(3.185, top, 0.118, 0.14));
  add('padSheet', 'vr2', tintR(surface((u, v, q) => { const x = (u - 0.5) * 0.076, z = (0.5 - v) * 0.076, d = Math.max(0, (x + z) / 0.076 - 0.55); q.set(x, 0.00808 + 0.03 * d * d, z); }, 10, 10), [0.95, 0.87, 0.5], 0.8), M4(3.185, top, 0.118, 0.152));
  {
    const m4 = M4(3.262, top, 0.222, 0.8), roll = tintR(lathe([[0.0165, 0.0003], [0.0168, 0], [0.0237, 0], [0.024, 0.0003], [0.024, 0.0147], [0.0237, 0.015], [0.0168, 0.015], [0.0165, 0.0147], [0.0165, 0.0003]], 48), [0.9, 0.84, 0.76], 0.7);
    paintV(roll, (x, y, z) => (Math.hypot(x, z) < 0.01665 ? [0.62, 0.5, 0.36, 0.9] : null));                 // cardboard core
    add('vrThings', 'vr', roll, m4);
    add('inkThings', 'ink', remapUV(new THREE.CylinderGeometry(0.02406, 0.02406, 0.0142, 48, 1, true).translate(0, 0.0075, 0), prints.washi), m4);
  }
  // ---- phone, face down in front of the laptop
  {
    const m4 = M4(3.238, top, 0.572, 1.38), C = [0.69, 0.75, 0.7], pw = 0.0715, ph = 0.1467;
    add('phoneBack', 'phone', tint(slab(pw, ph, 0.0078, { cr: 0.0115, er: 0.0028, cs: 6, es: 4, maxEdge: 0.03 }), C), m4);
    add('phoneBack', 'phone', tint(slab(0.031, 0.031, 0.0013, { cr: 0.0085, er: 0.0006, cs: 5, es: 2 }).translate(-pw / 2 + 0.0205, 0.0076, -ph / 2 + 0.0205), C.map((v) => v * 0.96)), m4);
    for (const [lx, lz] of [[-0.0055, -0.0055], [0.0055, 0.0055]]) {
      add('metalVThings', 'metalV', tint(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0012, 20).translate(-pw / 2 + 0.0205 + lx, 0.0093, -ph / 2 + 0.0205 + lz), [0.6, 0.65, 0.61]), m4);
      add('glossThings', 'gloss', tint(new THREE.CylinderGeometry(0.0048, 0.0048, 0.0006, 20).translate(-pw / 2 + 0.0205 + lx, 0.0099, -ph / 2 + 0.0205 + lz), [0.03, 0.03, 0.035]), m4);
    }
  }
}

const PENCIL_R = 0.00365, PENCIL_AP = PENCIL_R * Math.cos(Math.PI / 6);
/** Wooden pencil along +Y (tip at y = L): hexagonal lacquered shaft, sharpened cone that cuts the hexagon in
 *  scallops, graphite point, crimped ferrule and a used eraser — or a dipped end. */
function pencilGeos(L, rgb, { eraser = true, tipUp = true, cone = 0.021, blunt = 0.0003, er = [0.87, 0.52, 0.53], wear = 0.5, dip = null } = {}) {
  const R = PENCIL_R, ap = PENCIL_AP, yF = eraser ? 0.0188 : 0.0004, out = [], S6 = Math.PI / 3;
  const ang = []; for (let k = 0; k < 6; k++) for (const d of [-30, -26, -12, 0, 12, 26]) ang.push(((k * 60 + 30 + d) * Math.PI) / 180);
  const hexR = (a) => ap / Math.cos((((a % S6) + S6) % S6) - S6 / 2);
  const kc = (R - blunt) / cone, yS1 = L - cone, yS0 = L - (ap - blunt) / kc, gl = 0.0042, rows = [], ys = [];
  const nb = Math.max(2, Math.ceil((yS1 - yF) / 0.022));
  for (let k = 0; k <= nb; k++) ys.push(lerp(yF, yS1 - 0.0003, k / nb));
  if (dip) ys.push(0.012, 0.01215);
  ys.sort((a, b) => a - b);
  if (!eraser) rows.push([0, 0], [0, 0.9]);
  for (const y of ys) rows.push([y, 1]);
  for (let k = 0; k <= 8; k++) rows.push([lerp(yS1, yS0, k / 8), 1]);
  for (let k = 1; k <= 4; k++) rows.push([lerp(yS0, L - gl, k / 4), 1]);
  rows.push([L - gl + 0.00012, 1], [L - gl * 0.5, 1], [L - 0.00025, 1], [L, 0.72], [L, 0]);
  const nv = rows.length - 1, wood = [0.84, 0.69, 0.5];
  const body = surface((u, v, p) => {
    const a = ang[Math.round(u * 36) % 36], [y, s] = rows[Math.round(v * nv)], rad = Math.min(blunt + (L - y) * kc, hexR(a)) * s;
    p.set(Math.cos(a) * rad, y, -Math.sin(a) * rad);
  }, 36, nv, { closedU: true });
  tintR(body, rgb, 0.3);
  paintV(body, (x, y, z) => {
    const a = Math.atan2(-z, x);
    if (y >= L - gl + 0.0001) return [0.2, 0.2, 0.215, 0.36];
    if (y > yS1 + 1e-6 && Math.hypot(x, z) < hexR(a) - 2e-5) return [...mix3(wood, [0.74, 0.57, 0.38], 0.45 * (0.5 + 0.5 * Math.sin(a * 9 + y * 2600))), 0.78];
    if (dip && y < 0.01205) return [...dip, 0.3];
    return null;
  });
  out.push(['vr', body]);
  if (eraser) {
    const Rf = R * 1.035, prof = [[R * 0.8, 0.0058], [Rf, 0.006]];
    for (const y0 of [0.0078, 0.0112, 0.0146]) prof.push([Rf, y0], [Rf * 0.95, y0 + 0.0005], [Rf * 0.95, y0 + 0.0011], [Rf, y0 + 0.0016]);
    prof.push([Rf, 0.0194], [R * 0.9, 0.0198]);
    out.push(['vrMetal', tintR(lathe(prof, 24), [0.83, 0.75, 0.52], 0.3)]);
    const Re = R * 0.94, eg = lathe([[0, 0], [Re * 0.5, 0.00012], [Re * 0.82, 0.0007], [Re * 0.97, 0.0018], [Re, 0.0032], [Re, 0.0064]], 20), ep = eg.attributes.position;
    for (let i = 0; i < ep.count; i++) { const y = ep.getY(i); if (y < 0.0032) ep.setY(i, y + (ep.getX(i) / Re) * 0.0007 * wear * (1 - y / 0.0032)); }   // rubbed down on one side
    tintR(eg, er, 0.92); paintV(eg, (x, y) => (y < 0.002 ? [...mix3(er, [0.42, 0.38, 0.38], 0.4 * wear), 0.95] : null));
    out.push(['vr', eg]);
  }
  if (!tipUp) for (const q of out) q[1].rotateZ(Math.PI).translate(0, L, 0);
  return out;
}

/** Scissors standing points-down (along +Y, handles on top). */
function scissorsGeos(col) {
  const out = [], st = [0.78, 0.79, 0.8];
  for (const s of [-1, 1]) {
    out.push(['vrMetal', tintR(roundedBox(0.0085, 0.088, 0.0011, { r: 0.0004, rs: 1, maxEdge: 0.03 }).translate(s * 0.0022, 0.044, s * 0.0007), st, 0.24)]);
    out.push(['vr', tintR(roundedBox(0.0078, 0.026, 0.0042, { r: 0.0016, rs: 2 }).translate(s * 0.0056, 0.098, 0), col, 0.36)]);
    const rx = s < 0 ? 0.0098 : 0.0115, ry = s < 0 ? 0.0165 : 0.019, pts = [];
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; pts.push(V(s * (rx + 0.0028) + Math.cos(a) * rx, 0.1075 + ry + Math.sin(a) * ry, 0)); }
    out.push(['vr', tintR(pipe(null, 0.003, { tubular: 40, radial: 8, cap: false, curve: new THREE.CatmullRomCurve3(pts, true, 'centripetal') }).applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 0.75)), col, 0.36)]);
  }
  out.push(['vrMetal', tintR(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0036, 14).rotateX(Math.PI / 2).translate(0, 0.086, 0), st, 0.3)]);
  return out;
}
/** Stick ballpoint along +Y (point at y = 0): brass point, clear barrel with the ink tube inside, cap with clip posted on the end. */
function ballpointGeos(ink = [0.1, 0.16, 0.5]) {
  const seg = 18, dark = [ink[0] * 0.5, ink[1] * 0.5, ink[2] * 0.75];
  return [
    ['vrMetal', tintR(lathe([[0.00035, 0], [0.00062, 0.0004], [0.00105, 0.0042], [0.0023, 0.0112]], 14), [0.8, 0.69, 0.42], 0.28)],
    ['vr', tintR(lathe([[0.0023, 0.011], [0.0034, 0.0165], [0.0041, 0.024], [0.0041, 0.0262]], seg), ink, 0.3)],
    ['clear', new THREE.CylinderGeometry(0.00405, 0.00405, 0.0718, seg, 4, true).translate(0, 0.0621, 0)],
    ['vr', tintR(new THREE.CylinderGeometry(0.00155, 0.00155, 0.062, 10, 3, true).translate(0, 0.043, 0), dark, 0.22)],
    ['vr', tintR(new THREE.CylinderGeometry(0.00155, 0.00155, 0.026, 10, 1, true).translate(0, 0.087, 0), [0.8, 0.82, 0.84], 0.3)],
    ['vr', tintR(lath([[0.0044, 0.096], [0.0049, 0.0966], [0.0049, 0.146], [0.0045, 0.1492], [0.003, 0.15], [0, 0.15]], seg, 0.03), ink, 0.32)],
    ['vr', tintR(roundedBox(0.0032, 0.045, 0.0011, { r: 0.0005, rs: 2 }).translate(0, 0.1215, 0.0063), ink, 0.32)],
    ['vr', tintR(roundedBox(0.0032, 0.006, 0.0026, { r: 0.0005, rs: 2 }).translate(0, 0.1425, 0.0053), ink, 0.32)],
  ];
}
/** Capped fineliner along +Y (cap end at y = 0.137). */
function finelinerGeos(col = [0.1, 0.1, 0.11], acc = [0.16, 0.5, 0.52]) {
  const seg = 20, st = [0.8, 0.8, 0.81];
  const body = tintR(lath([[0, 0], [0.0034, 0], [0.0042, 0.0008], [0.0044, 0.003], [0.0044, 0.006], [0.0044, 0.00615], [0.0044, 0.092]], seg, 0.03), col, 0.36);
  paintV(body, (x, y) => (y < 0.0061 ? [...acc, 0.36] : null));
  return [
    ['vr', body],
    ['vr', tintR(lath([[0.0044, 0.0905], [0.005, 0.0912], [0.005, 0.133], [0.0047, 0.1362], [0.0036, 0.137], [0, 0.137]], seg, 0.03), col, 0.34)],
    ['vrMetal', tintR(roundedBox(0.0031, 0.037, 0.0007, { r: 0.0003, rs: 1 }).translate(0, 0.1135, 0.0061), st, 0.25)],
    ['vrMetal', tintR(lathe([[0.005, 0.1296], [0.0052, 0.1298], [0.0052, 0.1326], [0.005, 0.1328]], seg), st, 0.25)],
    ['vrMetal', tintR(roundedBox(0.0031, 0.0035, 0.002, { r: 0.0003, rs: 1 }).translate(0, 0.131, 0.0058), st, 0.25)],
  ];
}
/** Chunky highlighter lying flat along x (cap at +x), resting on y = -0.0005. */
function highlighterGeos(col = [0.86, 0.9, 0.22]) {
  const o = { cr: 0.0052, er: 0.0042, cs: 4, es: 4, maxEdge: 0.02 };
  return [
    ['vr', tintR(slab(0.079, 0.0215, 0.0128, o).translate(-0.019, 0, 0), col, 0.38)],
    ['vr', tintR(slab(0.0395, 0.0228, 0.0138, { ...o, cr: 0.0056 }).translate(0.0404, -0.0005, 0), col.map((v) => v * 0.9), 0.34)],
    ['vr', tintR(slab(0.004, 0.019, 0.0105, { cr: 0.004, er: 0.003, cs: 3, es: 2 }).translate(0.0205, 0.0012, 0), [0.08, 0.08, 0.08], 0.5)],
    ['vr', tintR(slab(0.011, 0.0219, 0.0131, { ...o, cr: 0.005 }).translate(-0.0535, -0.00015, 0), [0.1, 0.1, 0.105], 0.4)],
  ];
}
/** Vinyl eraser along x: one end rubbed round and grey with graphite, card sleeve round the other. Rests on y = -0.0003. */
function eraserGeos(sleeve) {
  let g = slab(0.044, 0.019, 0.0115, { cr: 0.0022, er: 0.0016, cs: 3, es: 3, maxEdge: 0.0022 });
  const p = g.attributes.position, Wh = [0.95, 0.95, 0.93];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = clamp((x - 0.007) / 0.015, 0, 1), f = Math.pow(1 - 0.81 * t * t, 0.42), wz = clamp(0.5 + z / 0.019, 0, 1);
    p.setXYZ(i, x - 0.003 * t * t * wz, 0.0045 + (y - 0.0045) * f - 0.0022 * t * t * wz * (y / 0.0115), z * (0.2 + 0.8 * f));
  }
  g = tintR(resmooth(g), Wh, 0.6);
  paintV(g, (x, y, z) => {
    const t = clamp(smoothstep(0.004, 0.02, x) * (0.55 + 0.25 * Math.sin(x * 700 + z * 500) * Math.sin(z * 900 - x * 300)), 0, 1) * 0.5;
    return [...mix3(Wh, [0.42, 0.43, 0.46], t), 0.6 + 0.25 * t];
  });
  return [['vr', g], ['ink', remapUV(slab(0.0265, 0.0196, 0.0121, { cr: 0.0024, er: 0.0017, cs: 3, es: 3, maxEdge: 0.01 }).translate(-0.0062, -0.0003, 0), sleeve)]];
}
/** Cast-metal wedge sharpener: slanted top with the screwed-on blade, hole in the +x end. */
function sharpenerGeos() {
  const out = [], body = roundedBox(0.0255, 0.0112, 0.0152, { r: 0.0009, rs: 2, maxEdge: 0.006 }).translate(0, 0.0056, 0), p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.0056) p.setY(i, y - ((p.getZ(i) + 0.0076) / 0.0152) * 0.004 * ((y - 0.0056) / 0.0056)); }
  out.push(['vrMetal', tintR(resmooth(body, true), [0.74, 0.75, 0.76], 0.52)]);
  const tilt = new THREE.Matrix4().makeRotationX(Math.atan2(0.004, 0.0152)).setPosition(0, 0.0092, 0);
  out.push(['vrMetal', tintR(roundedBox(0.0235, 0.0007, 0.0088, { r: 0.00025, rs: 1 }).translate(0, 0.00035, -0.0012).applyMatrix4(tilt), [0.82, 0.83, 0.85], 0.2)]);
  out.push(['vrMetal', tintR(new THREE.CylinderGeometry(0.0021, 0.0023, 0.0009, 16).translate(0.0015, 0.00115, -0.0012).applyMatrix4(tilt), [0.8, 0.8, 0.8], 0.3)]);
  out.push(['vr', tintR(roundedBox(0.0036, 0.0003, 0.00055, { r: 0.0001, rs: 1 }).rotateY(0.6).translate(0.0015, 0.00155, -0.0012).applyMatrix4(tilt), [0.05, 0.05, 0.05], 0.6)]);
  out.push(['vr', tintR(new THREE.CircleGeometry(0.0041, 20).rotateY(Math.PI / 2).translate(0.01277, 0.0048, 0.0004), [0.03, 0.03, 0.03], 0.8)]);
  return out;
}
/** One curl of pencil shaving: a strip of a cone, wood with a scalloped lacquer rim. */
function shavingGeo(r, lac) {
  const th = r.range(1.6, 5.2), r0 = r.range(0.0028, 0.0055), Wd = r.range(0.0045, 0.0085), be = r.range(0.7, 1.15), grow = r.range(0.05, 0.16), pitch = r.range(0.0002, 0.0009);
  const nu = Math.max(10, Math.round(th * 9)), ws = [0, 0.3, 0.6, 0.8, 0.89, 0.95, 1], ph = r.range(0, 6), c = sc(lac[0], lac[1], lac[2]);
  const g = surface((u, v, p) => {
    const a = u * th, w = ws[Math.round(v * 6)], rad = r0 * (1 + grow * a) + (w === 0 ? 0.07 * Math.sin(a * 7 + ph) : w) * Wd * Math.cos(be);
    p.set(Math.cos(a) * rad, w * Wd * Math.sin(be) + pitch * a, Math.sin(a) * rad);
  }, nu, 6);
  tintR(g, [0.86, 0.72, 0.52], 0.8);
  const col = g.attributes.color, uv = g.attributes.uv;
  for (let i = 0; i < col.count; i++) {
    const a = uv.getX(i) * th, w = ws[Math.round(uv.getY(i) * 6)], rim = (r0 * (1 + grow * a) + Wd * Math.cos(be)) * a;
    if (w >= 0.955 - 0.085 * Math.abs(Math.sin((rim / 0.0038) * Math.PI)) - 1e-6) col.setXYZW(i, c.r, c.g, c.b, 0.35);
  }
  return g;
}
/** 76 mm sticky note: the glued strip (far edge) lies flat, the free edge has lifted. Height above the desk at local (x, z). */
const noteLift = (x, z) => { const t = clamp((z + 0.022) / 0.06, 0, 1), u = x / 0.076 + 0.5; return 0.00012 + 0.0052 * t * t * (1 + 0.5 * u * u) + 0.0006 * t * Math.sin(u * 3.1); };
function noteGeo(rg) {
  return remapUV(surface((u, v, p) => { const x = (u - 0.5) * 0.076, z = (0.5 - v) * 0.076; p.set(x, noteLift(x, z), z); }, 12, 12), rg);
}
/** 15 cm ruler with a bevelled scale edge (far side). */
function rulerGeo(rg) {
  const g = slab(0.172, 0.03, 0.0022, { cr: 0.0022, er: 0.0005, cs: 3, es: 2, maxEdge: 0.006 }), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (y > 0.0011 && z < -0.0075) p.setY(i, lerp(y, y * 0.42, clamp((-0.0075 - z) / 0.007, 0, 1))); }
  return remapUV(resmooth(g), rg);
}
function paperclipGeo() {
  const pts = [], P = (x, z) => pts.push(V(x * 0.001, 0, z * 0.001)), arc = (cx, cz, rad, a0, a1, n) => { for (let k = 1; k <= n; k++) { const a = lerp(a0, a1, k / n); P(cx + Math.cos(a) * rad, cz + Math.sin(a) * rad); } };
  const H = Math.PI / 2;
  P(-13, 3.4); P(-4, 3.4); P(6, 3.4); P(10.6, 3.4); arc(10.6, 0, 3.4, H, -H, 6); P(2, -3.4); P(-10, -3.4);
  arc(-10, -0.55, 2.85, -H, -3 * H, 6); P(0, 2.3); P(7.6, 2.3); arc(7.6, 0.05, 2.25, H, -H, 5); P(2, -2.2); P(-5, -2.2);
  return wire(pts, 0.00045, { radial: 6, maxAng: 0.35, maxLen: 0.006 });
}
/** Coin lying on y = 0: body with a raised rim + a face disc that carries the relief (side 0 / 1 of the normal map). */
function coinGeos(R, h, rgb, side, ro) {
  const body = tintR(lathe([[0, 0], [R - 0.0003, 0], [R, 0.0003], [R, h - 0.0003], [R - 0.0003, h], [R * 0.93, h], [R * 0.925, h - 0.00012]], 40), rgb, ro), ub = body.attributes.uv;
  for (let i = 0; i < ub.count; i++) ub.setXY(i, 0.004, 0.01);                                          // a flat spot of the relief map
  const face = new THREE.CircleGeometry(R * 0.926, 40).rotateX(-Math.PI / 2).translate(0, h - 0.00012, 0), uv = face.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (side + uv.getX(i)) * 0.5, uv.getY(i));
  return [body, tintR(face, rgb, ro)];
}
/** Pebble-shaped earbud charging case. */
function earbudCaseGeos() {
  return [
    ['vr', tintR(slab(0.061, 0.046, 0.0212, { cr: 0.019, er: 0.0092, cs: 8, es: 6, maxEdge: 0.02 }), [0.93, 0.93, 0.92], 0.2)],
    ['vr', tintR(slab(0.06106, 0.04606, 0.0003, { cr: 0.01903, er: 0.0001, cs: 8, es: 1 }).translate(0, 0.0104, 0), [0.4, 0.4, 0.41], 0.5)],                  // lid seam
    ['vr', tintR(new THREE.CylinderGeometry(0.0007, 0.0007, 0.0004, 10).rotateX(Math.PI / 2).translate(0, 0.0075, 0.0229), [0.25, 0.6, 0.3], 0.3)],     // status light
    ['vrMetal', tintR(roundedBox(0.018, 0.0034, 0.0008, { r: 0.0003, rs: 1 }).translate(0, 0.0106, -0.0231), [0.8, 0.8, 0.81], 0.25)],                // hinge
  ];
}
/** USB-C plug along +Y: ribbed strain relief from y = 0, moulded grip, metal shell to y = 0.0378. Flat side = build z. */
function usbPlugGeos(Wc) {
  const stand = (w, d, h, o, y0) => slab(w, d, h, o).rotateX(Math.PI / 2).translate(0, y0 + d / 2, -h / 2);
  const relief = [[0.0016, 0]];
  for (let k = 0; k < 5; k++) { const y = 0.0012 + k * 0.0021, rr = lerp(0.0021, 0.0029, k / 4); relief.push([rr, y], [rr, y + 0.0012], [rr - 0.0005, y + 0.00125], [rr - 0.0005, y + 0.0021]); }
  return [
    ['vr', tintR(lathe(relief, 14), Wc, 0.5)],
    ['vr', tintR(stand(0.0112, 0.0195, 0.0062, { cr: 0.0026, er: 0.0022, cs: 4, es: 3 }, 0.0115), Wc, 0.42)],
    ['vrMetal', tintR(stand(0.0083, 0.0068, 0.0025, { cr: 0.0012, er: 0.0003, cs: 3, es: 1 }, 0.031), [0.82, 0.82, 0.84], 0.22)],
    ['vr', tintR(stand(0.0069, 0.0003, 0.0012, { cr: 0.0005, er: 0.0001, cs: 2, es: 1 }, 0.03775), [0.04, 0.04, 0.045], 0.6)],
  ];
}
/** Elastic hair tie: a slightly squashed loop that lifts off the desk in two places. */
function hairTieGeo() {
  const pts = [], n = 14;
  for (let k = 0; k < n; k++) { const a = (k / n) * TAU, rad = 0.0235 * (1 + 0.1 * Math.sin(a * 2 + 0.7) + 0.05 * Math.sin(a * 3 + 2)); pts.push(V(Math.cos(a) * rad, 0.0021 + 0.0012 * Math.max(0, Math.sin(a * 2 + 1.9)), Math.sin(a) * rad * 0.86)); }
  return pipe(null, (t) => 0.0021 + 0.00013 * Math.sin(t * TAU * 110), { tubular: 220, radial: 8, cap: false, curve: new THREE.CatmullRomCurve3(pts, true, 'centripetal') });
}

// =====================================================================================================
// loose things around the laptop — what a desk in use collects
// =====================================================================================================
const NOTE = { x: 3.385, z: 0.395, ry: -0.12 };
/** Height of whatever thin thing lies on the desk at world (x, z) — so crumbs sit on the note, not in it. */
function restY(x, z) {
  const dx = x - NOTE.x, dz = z - NOTE.z, c = Math.cos(NOTE.ry), s = Math.sin(NOTE.ry), lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < 0.038 && Math.abs(lz) < 0.038 ? noteLift(lx, lz) + 0.00008 : 0;
}

function buildLoose(add, top, P, r, lap) {
  const put = (name, parts, m4) => { for (const [key, g] of parts) add(name + '_' + key, key, g, m4); };
  const Wc = [0.9, 0.9, 0.885];
  // pencils: the one in use next to the note, a stub by the sharpener
  put('loose', pencilGeos(0.155, [0.9, 0.68, 0.14], { wear: 0.9 }), layM(3.4, top + PENCIL_AP, 0.315, 1.0, 0.0775));
  put('loose', pencilGeos(0.088, [0.62, 0.16, 0.15], { eraser: false, dip: [0.92, 0.9, 0.85], blunt: 0.0005 }), layM(3.4, top + PENCIL_AP, 0.245, -1.2, 0.044, Math.PI / 3));
  // pens
  put('loose', ballpointGeos(), layM(3.07, top + 0.0049, 0.535, -Math.PI / 2 - 0.12, 0.075, 1.1));
  put('loose', finelinerGeos(), layM(2.946, top + 0.005, 0.515, 0.1, 0.0685, -0.9));
  put('loose', highlighterGeos(), M4(3.6, top + 0.0965, 0.345, 0.4));                                   // left on the book stack
  // eraser, sharpener and what they leave behind
  put('loose', eraserGeos(P.sleeve), M4(3.452, top + 0.0003, 0.405, 3.6));
  put('loose', sharpenerGeos(), M4(3.462, top, 0.288, -0.35));
  [[3.432, 0.283], [3.445, 0.262], [3.49, 0.272], [3.474, 0.256], [3.452, 0.316], [3.485, 0.305], [3.425, 0.302]].forEach(([x, z], i) => {
    const g = shavingGeo(r, i % 3 === 1 ? [0.62, 0.16, 0.15] : [0.9, 0.68, 0.14]);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r.range(-0.5, 0.5) + (r.chance(0.4) ? Math.PI / 2 : 0), r.range(0, TAU), r.range(-0.5, 0.5))));
    g.computeBoundingBox(); const b = g.boundingBox;
    add('shavings', 'vr2', g.translate(x - (b.min.x + b.max.x) / 2, top + 0.00008 - b.min.y, z - (b.min.z + b.max.z) / 2));
  });
  // paper: the note with the list, the ruler
  add('looseNote', 'ink', noteGeo(P.note), M4(NOTE.x, top, NOTE.z, NOTE.ry));
  add('ruler', 'ink', rulerGeo(P.ruler), M4(3.062, top + 0.00005, 0.592, -0.05));
  // paper clips, coins, hair tie, earbud case
  for (const [x, z, ry, col] of [[3.345, 0.452, 0.7, null], [3.428, 0.455, -0.4, [0.2, 0.5, 0.52]], [3.502, 0.498, 2.2, null]])
    add(col ? 'clipsCoated' : 'clips', col ? 'vr' : 'vrMetal', tintR(paperclipGeo(), col || [0.8, 0.8, 0.82], col ? 0.4 : 0.25), M4(x, top + 0.00046, z, ry));
  for (const [x, z, R, h, rgb, side, ry, ro] of [[3.458, 0.553, 0.01125, 0.0019, [0.83, 0.68, 0.38], 0, 0.7, 0.36], [3.4745, 0.5715, 0.0094, 0.0016, [0.72, 0.45, 0.33], 0, 2.4, 0.46], [3.438, 0.592, 0.01215, 0.0021, [0.78, 0.78, 0.77], 1, 0.25, 0.38]])
    for (const g of coinGeos(R, h, rgb, side, ro)) add('coins', 'coin', g, M4(x, top, z, ry));
  add('hairTie', 'vr', tintR(hairTieGeo(), [0.075, 0.07, 0.08], 0.95), M4(3.356, top, 0.602, 0.4));
  put('loose', earbudCaseGeos(), M4(3.535, top, 0.553, 0.25));
  // short cable from the laptop's side port, its other plug lying loose near the phone
  const port = lap(0.152, 0.0052, -0.04), e0 = V(port.x + 0.031 * Math.cos(0.05), port.y, port.z - 0.031 * Math.sin(0.05));
  const ex = 3.307, ez = 0.492, dx = -0.55, dz = 0.835, yc = top + 0.0015;
  put('loose', usbPlugGeos(Wc), layM(port.x, port.y, port.z, Math.PI / 2 + 0.05, 0.031));
  put('loose', usbPlugGeos(Wc), layM(ex, top + 0.0031, ez, Math.atan2(-dx, -dz), 0));
  const cab = [[e0.x, e0.y, e0.z], [e0.x + 0.011, top + 0.0044, e0.z - 0.0004], [e0.x + 0.022, top + 0.0022, e0.z + 0.0055], [3.337, yc, 0.358], [3.332, yc, 0.4], [3.326, yc, 0.44], [ex - dx * 0.02, top + 0.0021, ez - dz * 0.02], [ex, top + 0.0031, ez]];
  add('usbCable', 'vr', tintR(wire(cab.map((q) => V(q[0], q[1], q[2])), 0.0015, { radial: 8 }), Wc, 0.5));
}

/** Eraser crumbs, sharpener debris and stray grit: one instanced mesh, one light sample each. */
function buildCrumbs(root, mat, top, r) {
  const list = [], blocked = [[3.452, 0.405, 3.6, 0.024, 0.0115], [3.462, 0.288, -0.35, 0.0145, 0.0095]];   // eraser, sharpener: x, z, ry, half sizes
  const free = (x, z) => blocked.every(([bx, bz, ry, hx, hz]) => { const dx = x - bx, dz = z - bz, c = Math.cos(ry), s = Math.sin(ry); return Math.abs(dx * c - dz * s) > hx || Math.abs(dx * s + dz * c) > hz; });
  const put = (x, z, s, rgb) => { if (x > 2.7 && x < 3.76 && z > 0.03 && z < 0.63 && free(x, z)) list.push([x, top + restY(x, z) + s[1] * 0.8, z, s, rgb]); };
  for (let i = 0; i < 150; i++) {   // rubbed-off eraser: thin grey rolls, a few pinkish ones from the pencil's own eraser
    const far = r.chance(0.2), x = 3.418 + r.gauss() * (far ? 0.045 : 0.024), z = 0.392 + r.gauss() * (far ? 0.035 : 0.018), L = r.range(0.001, 0.0034) * (r.chance(0.1) ? 1.4 : 1), w = r.range(0.00025, 0.0005), g = r.range(0.62, 0.88);
    put(x, z, [w, w * r.range(0.7, 1), L * 0.5], r.chance(0.06) ? [0.8, 0.6, 0.6] : [g, g, g * 1.03]);
  }
  for (let i = 0; i < 70; i++) { const s = r.range(0.0003, 0.0011); put(3.462 + r.gauss() * 0.02, 0.292 + r.gauss() * 0.017, [s, 0.00012, s * r.range(0.4, 0.9)], mix3([0.85, 0.7, 0.5], [0.7, 0.52, 0.34], r.next())); }   // wood flecks
  for (let i = 0; i < 46; i++) { const s = r.range(0.00012, 0.00032); put(3.46 + r.gauss() * 0.016, 0.294 + r.gauss() * 0.014, [s, s * 0.7, s], [0.16, 0.16, 0.18]); }                                              // graphite grains
  for (let i = 0; i < 90; i++) {    // grit that is simply there
    const s = r.range(0.00015, 0.00045);
    put(r.range(2.72, 3.74), r.chance(0.4) ? 0.03 + Math.abs(r.gauss()) * 0.04 : r.range(0.03, 0.63), [s * r.range(1, 2.2), s * 0.6, s], r.pick([[0.72, 0.68, 0.6], [0.5, 0.47, 0.42], [0.85, 0.84, 0.8], [0.34, 0.3, 0.27]]));
  }
  const geo = new THREE.IcosahedronGeometry(1, 0); geo.setAttribute('normal', geo.attributes.position.clone());
  const im = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, y, z, s, rgb], i) => {
    d.position.set(x, y, z); d.rotation.set(r.range(-0.1, 0.1), r.range(0, TAU), r.range(-0.1, 0.1)); d.scale.set(s[0], s[1], s[2]); d.updateMatrix();
    im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace));
  });
  im.name = 'deskCrumbs'; im.userData.giInstanced = true; im.userData.giNormal = V(0, 1, 0); im.userData.giAnchor = V(0, 1.5, 0);
  im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
  root.add(im);
  return list.length * 20;
}
function penGeos(L, rgb) {
  const R = 0.0043;
  return [
    ['satin', tint(new THREE.CylinderGeometry(R, R, L - 0.022, 14).translate(0, (L - 0.022) / 2 + 0.012, 0), rgb)],
    ['metalV', tint(new THREE.CylinderGeometry(R * 0.98, 0.0011, 0.012, 14, 1, true).translate(0, 0.006, 0), [0.76, 0.76, 0.77])],
    ['satin', tint(new THREE.CylinderGeometry(0.0026, 0.0026, 0.01, 10).translate(0, L - 0.005, 0), [0.2, 0.2, 0.21])],
    ['metalV', tint(roundedBox(0.0028, 0.036, 0.0011, { r: 0.0004, rs: 1 }).translate(0, L - 0.03, R + 0.0008), [0.78, 0.78, 0.79])],
  ];
}
function markerGeos(L, rgb) {
  const R = 0.0072, k = 0.68, dark = rgb.map((v) => v * 0.78);
  return [
    ['satin', tint(new THREE.CylinderGeometry(R, R * 0.96, L * k, 16).translate(0, (L * k) / 2, 0), [0.9, 0.9, 0.88])],
    ['satin', tint(new THREE.CylinderGeometry(R * 0.98, R * 1.05, L * (1 - k), 16).translate(0, L * k + (L * (1 - k)) / 2, 0), rgb)],
    ['satin', tint(new THREE.CylinderGeometry(R * 1.06, R * 1.06, 0.004, 16).translate(0, L * k + 0.002, 0), dark)],
  ];
}

// =====================================================================================================
// wall shelves and what stands on them
// =====================================================================================================
function buildShelves(add, books, cards, AW, AH, r) {
  const { x0, x1, depth, y: ys } = SHELVES, T = 0.018;
  ys.forEach((yt, i) => {
    const g = boxAt(x0, yt - T, 0.0005, x1 - x0, T, depth - 0.0005, { r: 0.0016, rs: 2, maxEdge: 0.016 });
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) + i * 0.37, uv.getY(k) + i * 0.251);
    add('shelfBoards', 'oak', g);
    for (const bx of [x0 + 0.055, x1 - 0.055]) {       // slim white steel brackets
      add('shelfBrackets', 'lamp', boxAt(bx - 0.011, yt - T - 0.003, 0.0005, 0.022, 0.003, 0.148, { r: 0.001, rs: 1, maxEdge: 0.04 }));
      add('shelfBrackets', 'lamp', boxAt(bx - 0.011, yt - T - 0.1, 0.0005, 0.022, 0.1, 0.003, { r: 0.001, rs: 1, maxEdge: 0.04 }));
      for (const sy of [0.032, 0.076]) add('shelfBrackets', 'lamp', new THREE.CylinderGeometry(0.0034, 0.0038, 0.0016, 12).rotateX(Math.PI / 2).translate(bx, yt - T - sy, 0.0043));
    }
  });
  const y1 = ys[0], y2 = ys[1];
  const placeBook = (b, m4) => { const g = bookGeos(b, AW, AH); for (const q of g.cover) add('bookCovers', 'books', q, m4); add('bookPages', 'pages', g.pages, m4); };
  const upright = (b, xL, zf) => new THREE.Matrix4().makeBasis(V(0, 0, -1), V(1, 0, 0), V(0, -1, 0)).setPosition(xL, y1 + b.h / 2, zf);
  // ---- lower shelf: a row of books, two leaning, two lying, a candle
  let cx = x0 + 0.016;
  for (const b of books.upright) { placeBook(b, upright(b, cx, Math.max(b.w + 0.008, 0.168 + r.range(-0.012, 0.01)))); cx += b.t + 0.0006; }
  const th = 0.2;
  for (const b of books.leaning) {
    const xp = cx + (b === books.leaning[0] ? b.h * Math.sin(th) : 0.0004);
    const lean = new THREE.Matrix4().makeTranslation(xp, y1, 0).multiply(new THREE.Matrix4().makeRotationZ(th)).multiply(new THREE.Matrix4().makeTranslation(-xp, -y1, 0));
    placeBook(b, lean.multiply(upright(b, xp, 0.166 + r.range(-0.008, 0.008))));
    cx = xp + b.t / Math.cos(th);
  }
  let ly = y1;
  for (const b of books.lying) {
    placeBook(b, M4(3.568 + r.range(-0.004, 0.004), ly, 0.102 + r.range(-0.004, 0.004), Math.PI / 2 + (ly === y1 ? 0.03 : -0.1)).multiply(new THREE.Matrix4().makeTranslation(-b.w / 2, 0, 0)));
    ly += b.t;
  }
  {
    const m4 = M4(3.717, y1, 0.112);
    add('metalVThings', 'metalV', tint(lathe([[0, 0], [0.034, 0], [0.0385, 0.0036], [0.039, 0.0052], [0.0378, 0.0056], [0.033, 0.003], [0, 0.003]], 36), [0.8, 0.65, 0.38]), m4);
    add('satinThings', 'satin', tint(lath([[0, 0.003], [0.0288, 0.003], [0.03, 0.0045], [0.03, 0.068], [0.0288, 0.0712], [0.021, 0.0704], [0.008, 0.066], [0, 0.0655]], 48), [0.925, 0.89, 0.81]), m4);
    add('paintThings', 'paint', tint(pipe([V(0, 0.065, 0), V(0.0004, 0.07, 0.0002), V(0.0022, 0.0745, 0.001)], 0.0008, { tubular: 5, radial: 6 }), [0.06, 0.055, 0.05]), m4);
  }
  // ---- upper shelf (left part only — the right part is kept free for the plant): framed print + vase
  {
    const w = 0.13, h = 0.18, bw = 0.011, dp = 0.016, ang = 0.16, k = cards[cards.length - 1];
    const m4 = M4(3.178, y2, h * Math.sin(ang) + 0.0008, 0, -ang);
    const fr = { r: 0.0012, rs: 2, maxEdge: 0.06 }, Bk = [0.075, 0.073, 0.07];
    for (const g of [boxAt(-w / 2, 0, 0, bw, h, dp, fr), boxAt(w / 2 - bw, 0, 0, bw, h, dp, fr), boxAt(-w / 2 + bw, 0, 0, w - 2 * bw, bw, dp, fr), boxAt(-w / 2 + bw, h - bw, 0, w - 2 * bw, bw, dp, fr)]) add('satinThings', 'satin', tint(g, Bk), m4);
    add('paintThings', 'paint', tint(boxAt(-w / 2 + 0.002, 0.002, 0.0005, w - 0.004, h - 0.004, 0.004, { r: 0.0005, rs: 1 }), [0.4, 0.33, 0.25]), m4);
    const pl = new THREE.PlaneGeometry(w - 2 * bw + 0.002, h - 2 * bw + 0.002, 4, 6), uv = pl.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(k.uv.u0, k.uv.u1, uv.getX(i)), lerp(k.uv.v0, k.uv.v1, uv.getY(i)));
    add('framedPrint', 'print', pl.translate(0, h / 2, 0.0105), m4);
  }
  {
    const m4 = M4(3.312, y2, 0.105);
    add('paintThings', 'paint', tint(lath([[0, 0], [0.02, 0], [0.0245, 0.002], [0.0335, 0.02], [0.037, 0.046], [0.034, 0.076], [0.022, 0.106], [0.0135, 0.126], [0.012, 0.14], [0.0145, 0.1515], [0.014, 0.153], [0.0128, 0.1525], [0.0102, 0.14], [0.0102, 0.126], [0, 0.122]], 56), [0.87, 0.85, 0.8]), m4);
    const stems = [[0.03, 0.2, -0.01, 0.0], [-0.045, 0.24, 0.02, 2.2], [0.012, 0.275, 0.035, 4.0], [-0.012, 0.17, -0.03, 5.1]];
    for (const [dx, hh, dz] of stems) {
      const a = V(0, 0.1, 0), b = V(dx * 0.25, 0.15 + hh * 0.3, dz * 0.25), c = V(dx * 0.75, 0.15 + hh * 0.75, dz * 0.75), d = V(dx, 0.15 + hh, dz);
      add('paintThings', 'paint', tint(pipe([a, b, c, d], 0.0008, { tubular: 12, radial: 5, cap: false }), [0.7, 0.61, 0.42]), m4);
      const dir = V().subVectors(d, c).normalize(), q = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir)).setPosition(d.x + dir.x * 0.012, d.y + dir.y * 0.012, d.z + dir.z * 0.012);
      add('paintThings', 'paint', tint(new THREE.SphereGeometry(1, 10, 8).applyMatrix4(new THREE.Matrix4().makeScale(0.0072, 0.0165, 0.0072)).applyMatrix4(q), [0.87, 0.81, 0.69]), m4);
    }
  }
}

// =====================================================================================================
// postcard collage
// =====================================================================================================
function buildCards(add, cards, r) {
  const tapes = [[0.84, 0.76, 0.6], [0.93, 0.92, 0.88], [0.82, 0.69, 0.67], [0.7, 0.76, 0.68], [0.84, 0.76, 0.6]];
  for (const k of cards) {
    if (k.frame) continue;
    const { w, h } = k, nx = Math.max(6, Math.round(w / 0.012)), ny = Math.max(6, Math.round(h / 0.012));
    const g = new THREE.PlaneGeometry(w, h, nx, ny), p = g.attributes.position, uv = g.attributes.uv;
    const free = k.tape === 'top';
    // corner lifts: [u, v, mm] — taped corners stay down, free ones curl towards the room
    const lifts = [[0, 0, r.range(0.002, 0.007)], [1, 0, r.range(0.002, 0.007)], [0, 1, free ? r.range(0.0008, 0.003) : 0], [1, 1, k.tape === 'corners' ? 0 : r.range(0.0008, 0.003)]];
    const bow = r.range(0.0002, 0.0012), R = 0.62 * Math.min(w, h);
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / w + 0.5, v = p.getY(i) / h + 0.5;
      let z = 0.001 + bow * (1 - (2 * u - 1) ** 2) * (1 - v * 0.6);
      for (const [cu, cv, lf] of lifts) { const d = Math.hypot((u - cu) * w, (v - cv) * h) / R; if (d < 1) z += lf * (1 - d) * (1 - d); }
      p.setZ(i, z); uv.setXY(i, lerp(k.uv.u0, k.uv.u1, u), lerp(k.uv.v0, k.uv.v1, v));
    }
    g.computeVertexNormals();
    const cx = POSTCARDS.x0 + k.dx + r.range(-0.003, 0.003), cy = POSTCARDS.y0 + k.dy + r.range(-0.003, 0.003), rot = k.rot + r.range(-0.01, 0.01);
    const m4 = M4(cx, cy, 0, 0, 0, rot);
    add('postcards', 'cards', g, m4);
    const tc = r.pick(tapes);
    const strip = (lx, ly, ang, tw = 0.034, tt = 0.0135) => {
      const tg = new THREE.PlaneGeometry(tw, tt, 4, 6), tp = tg.attributes.position;
      for (let i = 0; i < tp.count; i++) {   // torn, serrated ends; a shallow air bubble instead of a perfectly flat rectangle
        const x = tp.getX(i), row = Math.round((tp.getY(i) / tt + 0.5) * 6);
        if (Math.abs(x) > tw / 2 - 1e-6) tp.setX(i, x + Math.sign(x) * (row % 2 ? 0.0007 : -0.0003)); else tp.setZ(i, 0.00035 * (1 - ((2 * x) / tw) ** 2) * (row % 3 === 1 ? 1 : 0.4));
      }
      tg.computeVertexNormals();
      add('tape', 'tape', tint(tg, tc), M4(cx, cy, 0, 0, 0, rot).multiply(M4(lx, ly, 0.0019 + r.range(0, 0.0003), 0, 0, ang)));
    };
    if (k.tape === 'top') strip(r.range(-0.012, 0.012), h / 2 - 0.0015, r.range(-0.12, 0.12));
    else if (k.tape === 'corners') { strip(-w / 2 + 0.006, h / 2 - 0.006, 0.78 + r.range(-0.1, 0.1), 0.03); strip(w / 2 - 0.006, h / 2 - 0.006, -0.78 + r.range(-0.1, 0.1), 0.03); }
    else { strip(-w / 2 + 0.006, h / 2 - 0.006, 0.78, 0.03); strip(w / 2 - 0.008, h / 2 - 0.003, -0.5, 0.03); }
  }
}

// =====================================================================================================
export function build(ctx) {
  const t0 = performance.now();
  const root = group('desk'), rng = new RNG(30530), top = DESK.top;
  const books = defineBooks(rng.fork()), cards = defineCards();
  const bookAtlas = paintBooks(books.all, rng.fork()), cardAtlas = paintCards(cards, rng.fork());
  const rng2 = new RNG(77031), prints = paintPrints(rng2.fork());       // separate stream: the loose things don't reshuffle the rest
  const mats = makeMats(ctx.M, bookAtlas.tex, cardAtlas.tex, prints.tex, rng2.fork());
  const batch = makeBatch(root), noOcc = { bakeOccluder: false };
  // thin things lying flat must not carve a dark halo into the desk under them
  const flatThings = new Set(['postcards', 'tape', 'looseNote', 'ruler', 'clips', 'clipsCoated', 'coins', 'shavings', 'hairTie', 'usbCable']);
  const add = (name, key, geo, m4) => { if (m4) geo.applyMatrix4(m4); batch.add(name, mats[key], geo, flatThings.has(name) ? noOcc : null); return geo; };

  buildDesk(add);
  buildChair(add);
  buildLamp(add, top);
  const lap = buildLaptop(add, top);
  buildCables(add, top, lap);
  buildDeskThings(add, top, books, bookAtlas.W, bookAtlas.H, rng.fork(), prints.reg);
  buildLoose(add, top, prints.reg, rng2.fork(), lap);
  buildShelves(add, books, cards, bookAtlas.W, bookAtlas.H, rng.fork());
  buildCards(add, cards, rng.fork());
  const tris = batch.flush() + buildCrumbs(root, mats.crumb, top, rng2.fork());

  ctx.colliders.push({ min: [DESK.x0, 0, 0], max: [DESK.x1, top + 0.02, DESK.z1 + 0.02] });
  ctx.colliders.push({ min: [2.9, 0, 0.72], max: [3.46, 0.85, 1.31] });
  root.userData.tris = tris;
  if (typeof location !== 'undefined' && /only=/.test(location.search)) console.log(`[boot] desk part: ${Math.round(tris)} tris, built in ${(performance.now() - t0).toFixed(0)} ms`);
  return root;
}
