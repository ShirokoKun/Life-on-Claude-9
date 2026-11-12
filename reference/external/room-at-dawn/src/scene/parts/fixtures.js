// Fixtures: curtains on a rod, panel radiator, wardrobe, nightstand (alarm clock, paperback, glass, glasses …),
// wool rug, paper-globe ceiling lamp, the windowsill still life and two framed prints.
// Everything is generated here: geometry from parametric surfaces / bevelled boxes, textures from noise or Canvas2D.
import * as THREE from 'three';
import { WARDROBE, RADIATOR, CURTAIN, NIGHTSTAND, RUG } from '../layout.js';
import { roundedBox, boxAt, gridPlane, tube, lathe, cyl, merge, mesh, group } from '../../core/geo.js';
import { RNG, fbm2, vnoise2, hash2, smoothstep, lerp, clamp } from '../../core/rng.js';
import { field, normalTex, colorTex, canvasTex, makeCanvas, avgColor, dataTex, packTex } from '../../core/tex.js';
import { sc, pbr, fabric, lacquerNormal, smudgeRough } from '../materials.js';

export const order = 10;
export const label = 'fixtures';

const PI = Math.PI, D2R = PI / 180;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lin = (c) => Math.pow(c, 2.2);
const sm01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// ------------------------------------------------------------------ small geometry helpers
function swapUV(g) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i)); return g; }
/** Cylinder along X (r0 at x0, r1 at x1). */
function cylX(r0, x0, x1, segs = 20, r1 = r0, hs = 1) { return new THREE.CylinderGeometry(r1, r0, x1 - x0, segs, hs, false).rotateZ(-PI / 2).translate((x0 + x1) / 2, 0, 0); }
/** Cylinder along Z (r0 at z0, r1 at z1). */
function cylZ(r0, z0, z1, segs = 20, r1 = r0, hs = 1) { return new THREE.CylinderGeometry(r1, r0, z1 - z0, segs, hs, false).rotateX(PI / 2).translate(0, 0, (z0 + z1) / 2); }
/** Faceted copy (hex nuts etc.). */
function flat(g) { const n = g.toNonIndexed(); n.computeVertexNormals(); return n; }
/** Hex nut along Y from y0 to y1, both ends chamfered. */
function hexY(r, y0, y1) { const c = Math.min(0.0016, (y1 - y0) * 0.22); return flat(merge([cyl(r * 0.86, y0, y0 + c, 6, r), cyl(r, y0 + c, y1 - c, 6), cyl(r, y1 - c, y1, 6, r * 0.86)])); }
function hexX(r, x0, x1) { return hexY(r, x0, x1).rotateZ(-PI / 2); }
/** Open band (no caps) with wrap-around UVs: u round the axis, v along it. */
function bandX(r, x0, x1, segs = 48) { return new THREE.CylinderGeometry(r, r, x1 - x0, segs, 1, true).rotateZ(-PI / 2).translate((x0 + x1) / 2, 0, 0); }
function bandY(r, y0, y1, segs = 48, rTop = r) { return new THREE.CylinderGeometry(rTop, r, y1 - y0, segs, 1, true).translate(0, (y0 + y1) / 2, 0); }
function add(grp, geo, mat, name, ud) { const m = mesh(geo, mat, name); if (ud) Object.assign(m.userData, ud); grp.add(m); return m; }
function softClamp(z, lo, hi, w = 0.012) {
  if (z > hi - w) return hi - w + w * Math.tanh((z - (hi - w)) / w);
  if (z < lo + w) return lo + w - w * Math.tanh((lo + w - z) / w);
  return z;
}

/** Grid surface from fn(i, j, p) -> p.{x,y,z,u,v,c}. Normal = dP/di x dP/dj (reversed by `flip`). */
function gridGeo(nu, nv, fn, opts = {}) {
  const { flip = false, colors = false, closedU = false } = opts;
  const W = nu + 1, n = W * (nv + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = colors ? new Float32Array(n * 3) : null;
  const p = { x: 0, y: 0, z: 0, u: 0, v: 0, c: 1 };
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    p.c = 1; fn(i, j, p); const k = j * W + i;
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = p.u; uv[k * 2 + 1] = p.v;
    if (col) col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = p.c;
  }
  const idx = new Uint32Array(nu * nv * 6); let q = 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
    if (flip) { idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = a; idx[q++] = d; idx[q++] = c; }
    else { idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = a; idx[q++] = c; idx[q++] = d; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  if (closedU) {
    const nr = g.attributes.normal;
    for (let j = 0; j <= nv; j++) {
      const a = j * W, b = a + nu;
      const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
      nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return g;
}

/** Flat sheet in XZ facing +Y with rectangular holes (cells where hole(i, j) is true are left out). */
function slotPlane(xs, zs, y, hole) {
  const pos = [], nor = [], uv = [], idx = [], W = xs.length;
  for (let j = 0; j < zs.length; j++) for (let i = 0; i < W; i++) { pos.push(xs[i], y, zs[j]); nor.push(0, 1, 0); uv.push(xs[i], zs[j]); }
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < W - 1; i++) {
    if (hole(i, j)) continue;
    const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
    idx.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}

// ------------------------------------------------------------------ texture helpers
const LAT = new Float32Array(65536);
{ const r = new RNG(60931); for (let i = 0; i < 65536; i++) LAT[i] = r.next(); }
/** Fast table value noise 0..1 that tiles every px x py lattice cells (both <= 256). */
function pn(x, y, px = 256, py = 256) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  let x0 = ix % px; if (x0 < 0) x0 += px; let y0 = iy % py; if (y0 < 0) y0 += py;
  const x1 = x0 + 1 === px ? 0 : x0 + 1, y1 = y0 + 1 === py ? 0 : y0 + 1;
  const a = LAT[(y0 << 8) | x0], b = LAT[(y0 << 8) | x1], c = LAT[(y1 << 8) | x0], d = LAT[(y1 << 8) | x1];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
/** Height field -> RGBA8 tangent-space normals (wraps). sx / sy: slope per unit height difference of neighbours. */
function normalBytes(H, w, h, sx, sy = sx) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = (y === 0 ? h - 1 : y - 1) * w, yp = (y === h - 1 ? 0 : y + 1) * w, yo = y * w;
    for (let x = 0; x < w; x++) {
      const dx = (H[yo + (x === w - 1 ? 0 : x + 1)] - H[yo + (x === 0 ? w - 1 : x - 1)]) * 0.5 * sx, dy = (H[yp + x] - H[ym + x]) * 0.5 * sy;
      const il = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (yo + x) * 4;
      out[i] = (-dx * il * 0.5 + 0.5) * 255 + 0.5; out[i + 1] = (-dy * il * 0.5 + 0.5) * 255 + 0.5; out[i + 2] = (il * 0.5 + 0.5) * 255 + 0.5; out[i + 3] = 255;
    }
  }
  return out;
}
/** 2D context of a canvas that will be read back (average colour, alpha masks): keeps it off the GPU so the
 *  read-back does not stall the build. Must be the first getContext call on that canvas. */
const c2d = (c) => c.getContext('2d', { willReadFrequently: true });
/** A mask painted white-on-black on a canvas -> texture of one colour whose alpha is the mask. */
function alphaTex(canvas, rgb, opts = {}) {
  const w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = d[i * 4]; }
  return dataTex(out, w, h, { srgb: true, ...opts });
}
/** Thin film lying on another surface (dust, stains, soot): alpha blended, lit by the bake, casts nothing. */
function decalMat(tex, params = {}) {
  const m = pbr({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...params });
  m.userData.bake = { ignore: true };
  return m;
}
function canvasMat(canvas, w, h, params = {}) {
  const tex = canvasTex(canvas, { srgb: true, wrap: false, repeat: [1 / w, 1 / h] });
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  return pbr({ map: tex, roughness: 0.8, ...params }, { bake: { albedo: avgColor(d) } });
}

/** Oak veneer: two book-matched leaves per tile, flat-sawn "cathedral" rings with porous earlywood, rays and
 *  pores. One tile = 1.6 m along the grain (u, wraps seamlessly) x 0.5 m across (v, wraps at a veneer joint). */
function oakVeneer() {
  const N = 1024, TU = 1.6, TV = 0.5, LEAVES = 2, LW = TV / LEAVES;
  const col = new Uint8Array(N * N * 4), Hh = new Float32Array(N * N), R = new Float32Array(N * N);
  const rng = new RNG(1907), leaf = [];
  for (let k = 0; k < LEAVES; k++) {
    const P = {
      c0: rng.range(0.07, 0.15), h0: rng.range(0.024, 0.04), a1: rng.range(0.012, 0.022), a2: rng.range(0.005, 0.011), p1: rng.range(0, 6.28), p2: rng.range(0, 6.28),
      rw: rng.range(0.0044, 0.0058), lum: rng.range(-0.02, 0.02), oy: rng.int(0, 180), b: new Float32Array(N), an: new Float32Array(N),
    };
    for (let x = 0; x < N; x++) {
      const u = x / N;
      P.b[x] = P.h0 + P.a1 * Math.sin(2 * PI * u + P.p1) + P.a2 * Math.sin(4 * PI * u + P.p2);
      P.an[x] = (pn(u * 4, 3.3 + P.oy, 4) - 0.5) * 0.03;
    }
    leaf.push(P);
  }
  const B0 = 0.85, B1 = 0.722, B2 = 0.54, acc = [0, 0, 0];
  for (let y = 0; y < N; y++) {
    const v = y / N, lk = Math.min(LEAVES - 1, Math.floor(v * LEAVES)), P = leaf[lk];
    const t = v * TV - lk * LW, joint = Math.min(t, LW - t) < 0.0005 ? 1 : 0, lum = 1 + P.lum, irw = 1 / P.rw, oy = P.oy;
    const yw = t * 24 + oy, ya = t * 300 + oy, yb = t * 900 + oy, yr = t * 620 + oy + 50;
    for (let x = 0; x < N; x++) {
      const u = x / N, b = P.b[x];
      const w1 = pn(u * 8, yw, 8), fa = pn(u * 32, ya, 32), fb = pn(u * 128, yb, 128), ry = pn(u * 256, yr);
      const a0 = t - P.c0 + P.an[x];
      const r = Math.sqrt(a0 * a0 + b * b) + (w1 - 0.5) * 0.012 + (fa - 0.5) * 0.0018;
      const p0 = r * irw, p = p0 + 0.8 * pn(p0 * 0.31 + oy, 7.3), f = p - Math.floor(p);
      const dr = (f < 0.14 ? f / 0.14 : 1) * (1 - sm01((f - 0.18) / 0.6));              // porous earlywood band of each ring
      const pore = dr * (0.4 + fa) * (fb > 0.3 ? 1 : 0.35), fleck = ry > 0.8 ? (ry - 0.8) * 5 : 0;
      const g = (fa - 0.5) * 0.09 + (fb - 0.5) * 0.06 + (w1 - 0.5) * 0.09 - pore * 0.15 - fleck * 0.07;
      const L = lum * (1 + g) * (1 - 0.05 * joint), dk = g < 0 ? -g : 0;
      const cr = Math.min(1, B0 * L), cg = Math.min(1, B1 * L * (1 - 0.1 * dk)), cb = Math.min(1, B2 * L * (1 - 0.3 * dk));
      const i = y * N + x, j = i * 4;
      col[j] = cr * 255 + 0.5; col[j + 1] = cg * 255 + 0.5; col[j + 2] = cb * 255 + 0.5; col[j + 3] = 255;
      Hh[i] = -0.06 * pore - 0.03 * (1 - fb) - 0.03 * fleck - 0.05 * joint;                // mm
      R[i] = clamp(0.47 + pore * 0.16 + (0.5 - fb) * 0.07 + fleck * 0.08);
      if ((x & 7) === 0 && (y & 7) === 0) { acc[0] += lin(cr); acc[1] += lin(cg); acc[2] += lin(cb); }
    }
  }
  const k = 64 / (N * N);
  return {
    map: dataTex(col, N, N, { srgb: true }), normalMap: dataTex(normalBytes(Hh, N, N, N / (TU * 1000), N / (TV * 1000)), N, N, {}), roughnessMap: packTex(N, N, null, R, null),
    avg: [acc[0] * k, acc[1] * k, acc[2] * k], rep: [1 / TU, 1 / TV],
  };
}

/** Linen plain weave, 512 x 512 threads on a 0.32 m tile (0.625 mm pitch): every yarn has its own width and
 *  tone, wefts carry slubs. Returns colour + normal maps (2048 px) and the mean linear colour. */
function linenMaps() {
  const N = 2048, NT = 512, CO = 256, TILE = 0.32;
  const rng = new RNG(8123);
  const wW = new Float32Array(NT), fW = new Float32Array(NT), wT = new Float32Array(NT), fT = new Float32Array(NT);
  let bw = 0, bf = 0;
  for (let k = 0; k < NT; k++) {
    if (k % 6 === 0) bw = rng.gauss() * 0.018;
    if (k % 4 === 0) bf = rng.gauss() * 0.026;
    wW[k] = 0.66 + 0.22 * rng.next(); fW[k] = 0.62 + 0.3 * rng.next();
    wT[k] = 1 + bw + rng.gauss() * 0.02; fT[k] = 1 + bf + rng.gauss() * 0.028;
  }
  const sW = new Float32Array(NT * CO), sF = new Float32Array(NT * CO);   // slub thickening along each warp / weft
  const slubs = (S, n, amp) => {
    for (let q = 0; q < n; q++) {
      const k = rng.int(0, NT - 1), c = rng.int(0, CO - 1), len = rng.range(2.5, 13), a = amp * rng.range(0.3, 1), r = Math.ceil(len * 2.2);
      for (let d = -r; d <= r; d++) S[k * CO + ((((c + d) % CO) + CO) % CO)] += a * Math.exp(-(d * d) / (len * len));
    }
  };
  slubs(sF, 430, 0.85); slubs(sW, 160, 0.55);
  const Hf = new Float32Array(N * N), col = new Uint8Array(N * N * 4);
  const SIN = [0.125, 0.375, 0.625, 0.875].map((f) => 0.6 + 0.4 * Math.sin(PI * f)), OFF = [0.75, 0.25, 0.25, 0.75];
  const b0 = 0.9, b1 = 0.858, b2 = 0.78, acc = [0, 0, 0, 0];
  for (let y = 0; y < N; y++) {
    const iy = y >> 2, qy = y & 3, cy = y >> 3, wf = fW[iy], tf = fT[iy], sy = SIN[qy], oy = OFF[qy], rowF = iy * CO;
    for (let x = 0; x < N; x++) {
      const ix = x >> 2, qx = x & 3, sw = sW[ix * CO + cy], sf = sF[rowF + (x >> 3)];
      const tx = 1 - OFF[qx] / (wW[ix] * (1 + sw)), ty = 1 - oy / (wf * (1 + sf)), over = (ix + iy) & 1;
      const warp = tx > 0 ? Math.sqrt(tx) * (over ? 1 : 0.55) * sy * (1 + 0.3 * sw) : 0;
      const weft = ty > 0 ? Math.sqrt(ty) * (over ? 0.55 : 1) * SIN[qx] * (1 + 0.3 * sf) : 0;
      const top = warp > weft, h = top ? warp : weft, i = y * N + x, j = i * 4;
      Hf[i] = h;
      const k = (top ? wT[ix] * (1 + 0.06 * sw) : tf * (1 + 0.08 * sf)) * (0.72 + 0.28 * (h > 0.8 ? 1 : h * 1.25));
      const r = Math.min(1, b0 * k), g = Math.min(1, b1 * k), b = Math.min(1, b2 * k);
      col[j] = r * 255; col[j + 1] = g * 255; col[j + 2] = b * 255; col[j + 3] = 255;
      if ((x * 7 + y * 13) % 61 === 0) { acc[0] += lin(r); acc[1] += lin(g); acc[2] += lin(b); acc[3]++; }
    }
  }
  const rp = [1 / TILE, 1 / TILE];
  return {
    map: dataTex(col, N, N, { srgb: true, repeat: rp }), normalMap: dataTex(normalBytes(Hf, N, N, 1.15), N, N, { repeat: rp }),
    avg: [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]],
  };
}

// ------------------------------------------------------------------ materials local to this part
function makeLib(M) {
  const lacN = lacquerNormal();
  const rep = (t, rx, ry, ox = 0, oy = 0) => { const c = t.clone(); c.repeat.set(rx, ry); c.offset.set(ox, oy); c.needsUpdate = true; return c; };
  const oak = oakVeneer();
  const wood = (ou = 0, ov = 0, tint = null, ns = 0.6) => {
    const col = tint || new THREE.Color(1, 1, 1), [ru, rv] = oak.rep;
    return pbr({ color: col, map: rep(oak.map, ru, rv, ou, ov), normalMap: rep(oak.normalMap, ru, rv, ou, ov), roughnessMap: rep(oak.roughnessMap, ru, rv, ou, ov), roughness: 1, normalScale: new THREE.Vector2(ns, ns) },
      { bake: { albedo: [oak.avg[0] * col.r, oak.avg[1] * col.g, oak.avg[2] * col.b] } });
  };
  // No refraction in this pipeline, so glass is a faint veil that turns denser towards grazing angles, where it
  // also picks up the light it gathers (bright rims when back-lit, soft ones in the dim of the room).
  const glass = (opacity, color, rim, glow) => {
    const m = pbr({ color, transparent: true, opacity, roughness: 0.04, metalness: 0, depthWrite: false, envMapIntensity: 3.5 }, {
      key: 'fxGlass' + rim + '|' + glow,
      onCompile(sh) {
        sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `{
          float fxFr = pow( 1.0 - clamp( abs( dot( normalize( vViewPosition ), normal ) ), 0.0, 1.0 ), 2.2 );
          outgoingLight += vGi * giScale * ( ${glow.toFixed(2)} * fxFr + 0.05 );
          diffuseColor.a = mix( diffuseColor.a, ${rim.toFixed(2)}, fxFr );
        }
        #include <opaque_fragment>`);
      },
    });
    m.userData.bake = { ignore: true };
    return m;
  };
  // page edges: fine horizontal lines
  const PW = 32, PH = 256;
  const pl = field(PW, PH, (u, v, x, y) => hash2(y, 3, 7) * 0.65 + hash2(y >> 1, 5, 9) * 0.25 + hash2(x >> 2, y, 11) * 0.1);
  const pagesMap = colorTex(PW, PH, (u, v, x, y) => { const k = 0.78 + 0.22 * pl[y * PW + x]; return [0.93 * k, 0.91 * k, 0.85 * k]; }, { repeat: [5, 20] });
  const pagesN = normalTex(pl, PW, PH, 1.1, { repeat: [5, 20] });
  const smudge = smudgeRough(0.42, 0.12);
  return {
    rep, lacN, wood, glass,
    oakV: wood(0.11, 0.07),                  // long vertical panels (geometry UVs swapped so u runs along the length)
    oakH: wood(0.37, 0.56),                  // horizontal boards
    oakS: wood(0.63, 0.31),                  // small parts
    boxWood: wood(0.2, 0.83, sc(0.9, 0.8, 0.7), 0.8),
    door: pbr({ color: sc(0.865, 0.87, 0.865), roughness: 0.6, normalMap: rep(lacN, 9, 9), normalScale: new THREE.Vector2(0.18, 0.18) }),
    void: pbr({ color: sc(0.035, 0.035, 0.035), roughness: 1 }),
    nickel: pbr({ color: sc(0.82, 0.8, 0.77), roughness: 0.24, metalness: 1 }),
    darkCore: pbr({ color: sc(0.2, 0.2, 0.2), roughness: 0.9 }),
    greyPlastic: pbr({ color: sc(0.6, 0.61, 0.62), roughness: 0.5 }),
    // stove enamel on pressed steel: a touch warmer than the wall paint, orange peel, wiped unevenly
    radEnamel: pbr({ color: sc(0.935, 0.93, 0.912), roughness: 1, roughnessMap: rep(smudge, 2.1, 2.1), normalMap: rep(lacN, 9, 9), normalScale: new THREE.Vector2(0.36, 0.36) }),
    chip: pbr({ color: sc(0.33, 0.29, 0.26), roughness: 0.85 }),
    clockBody: pbr({ color: sc(0.05, 0.05, 0.055), roughness: 0.44, normalMap: rep(lacN, 30, 30), normalScale: new THREE.Vector2(0.1, 0.1) }),
    clockLens: pbr({ color: sc(0.012, 0.012, 0.016), roughness: 0.1 }),
    wax: pbr({ color: sc(0.93, 0.915, 0.87), roughness: 0.46 }),
    waxTop: pbr({ color: sc(0.93, 0.915, 0.87), roughness: 0.4, vertexColors: true, normalMap: rep(lacN, 60, 60), normalScale: new THREE.Vector2(0.25, 0.25) }),
    soot: pbr({ color: sc(0.03, 0.03, 0.03), roughness: 1 }),
    glass: glass(0.1, sc(0.3, 0.34, 0.34), 0.72, 1.0),
    glassThick: glass(0.24, sc(0.5, 0.58, 0.56), 0.8, 1.3),
    lens: glass(0.05, sc(0.4, 0.45, 0.46), 0.45, 0.6),
    water: glass(0.12, sc(0.45, 0.53, 0.55), 0.5, 0.8),
    gold: pbr({ color: sc(0.86, 0.68, 0.38), roughness: 0.24, metalness: 1 }),
    pages: pbr({ map: pagesMap, normalMap: pagesN, roughness: 0.9, normalScale: new THREE.Vector2(0.5, 0.5) }, { bake: { albedo: [0.72, 0.69, 0.6] } }),
  };
}

// ================================================================== CURTAINS
// A panel is a sheet of fabric of flat width L hung from rings. Each horizontal section is built by
// integrating a heading angle along the cloth (so the sheet never stretches sideways). At the top the cloth is
// creased where a ring clips it and bellies into the room between two rings; further down the creases relax
// into round folds, a second, broader set of folds takes over, phases drift and amplitudes vary. Every section
// is solved to the gathered width at that height (tight at the rings, flaring at the hem).
// Besides position / uv / colour the geometry carries `aHem` = (distance to the nearer side edge, to the bottom
// edge, to the top edge, position along the cloth), all in metres on the flat cloth: the material draws the
// doubled hems, their stitching and the storage creases from it.
export function curtainPanel(o) {
  const { x0t, x1t, x0h, x1h, zc, yTop, yHem, loops, seed, mirror } = o;
  const rng = new RNG(seed);
  const H = yTop - yHem, Wt = x1t - x0t, Wh = x1h - x0h;
  const L = Wt / 0.37, e0 = 0.022, e1 = 0.03;
  // rings clip the cloth at the back creases; between two rings it bellies into the room as one loop
  const raw = [];
  for (let k = 0; k < loops; k++) raw.push(rng.range(0.62, 1.5));
  const ks = (L - e0 - e1) / raw.reduce((a, b) => a + b, 0);
  const ringS = [e0]; for (const r of raw) ringS.push(ringS[ringS.length - 1] + r * ks);
  const nR = ringS.length;
  // phase runs 2*PI per loop with the crease (z minimum) at the ring; `be` > 0 hurries it through the crease so
  // the back of each fold is pinched while the front stays round
  const warp = (t, be) => t + (be / (2 * PI)) * Math.sin(2 * PI * t);
  const phase = (s, be) => {
    if (s <= ringS[0]) return -PI / 2 + (2 * PI * (1 + be) * (s - ringS[0])) / (ringS[1] - ringS[0]);
    if (s >= ringS[nR - 1]) return 2 * PI * (nR - 1) - PI / 2 + (2 * PI * (1 + be) * (s - ringS[nR - 1])) / (ringS[nR - 1] - ringS[nR - 2]);
    let k = 0; while (s > ringS[k + 1]) k++;
    return 2 * PI * k - PI / 2 + 2 * PI * warp((s - ringS[k]) / (ringS[k + 1] - ringS[k]), be);
  };
  // a second, broader system of folds that takes over further down (folds merging as the cloth relaxes)
  const m2 = Math.max(2, Math.round(loops * 0.55)), k2 = [0], psi = rng.range(0, 2 * PI);
  {
    const r2 = []; for (let k = 0; k < 2 * m2; k++) r2.push(rng.range(0.6, 1.5));
    const s2 = r2.reduce((a, b) => a + b, 0); let acc = 0;
    for (const r of r2) { acc += (r / s2) * L; k2.push(acc); }
  }
  const phase2 = (s) => { let k = 0; while (k < k2.length - 2 && s > k2[k + 1]) k++; return (k + (s - k2[k]) / (k2[k + 1] - k2[k])) * PI + psi; };
  const nS = Math.ceil(L / 0.004), SUB = 3, Mn = nS * SUB, ds = L / Mn, NW = nS + 1;
  // rows: distance below the top edge
  const dl = [], tape = 0.07, hem = 0.09;
  const range = (a, b, step) => { const n = Math.max(1, Math.round((b - a) / step)); for (let k = 0; k < n; k++) dl.push(a + ((b - a) * k) / n); };
  range(0, 0.012, 0.006); range(0.012, tape - 0.0015, 0.014); dl.push(tape - 0.0015, tape, tape + 0.0015);
  range(tape + 0.012, 0.42, 0.02); range(0.42, H - hem - 0.03, 0.023);
  range(H - hem - 0.03, H - hem - 0.0015, 0.014); dl.push(H - hem - 0.0015, H - hem, H - hem + 0.0015);
  range(H - hem + 0.012, H, 0.013); dl.push(H);
  const nv = dl.length - 1;

  const PX = new Float32Array(NW * (nv + 1)), PZ = new Float32Array(NW * (nv + 1));
  const th0 = new Float32Array(Mn), tcap = new Float32Array(Mn), xs = new Float32Array(NW), zs = new Float32Array(NW);
  // heading limits: just short of square-on at a pinch (the two sides of a crease must not cross), a little
  // past it in the belly of a loop (gathered cloth bulges wider than its neck)
  const a0 = 76 * D2R, capPinch = 83 * D2R, capBelly = 99 * D2R, zlo = -0.054, zhi = 0.07;
  const off = Array.from({ length: 10 }, () => rng.range(0, 60));
  const ringIdx = ringS.map((s) => Math.round((s / L) * nS));
  let c0 = 0;
  for (let j = 0; j <= nv; j++) {
    const d = dl[j], v = d / H;
    const drift = 1.1 * smoothstep(0.06, 1.5, d) + 0.35 * smoothstep(1.4, H, d);
    const kS = lerp(1.5, 1.15, smoothstep(0.1, H, d));
    const wand = 0.22 * smoothstep(0.12, 1.3, d), amod = 0.34;
    const w1 = 1, w2 = 0.34 * smoothstep(0.04, 1.1, d);
    const be = lerp(0.3, 0.1, smoothstep(0.05, 1.2, d)), pinch = 1 - smoothstep(0.04, 0.75, d);
    for (let m = 0; m < Mn; m++) {
      const s = (m + 0.5) * ds;
      const ph = phase(s, be) + drift * (fbm2(s * 8 + off[0], d * 0.5 + off[1], { oct: 2, seed }) - 0.5) * 2.8;
      const k = kS * (0.7 + 0.8 * vnoise2(s * 14 + off[2], d * 0.6 + off[3], seed + 3));
      const Ss = Math.tanh(k * Math.cos(ph)) / Math.tanh(k);                      // relaxed fold: round front and back
      const tl = (ph + PI / 2) / (2 * PI), tf = tl - Math.floor(tl), u = PI * tf, su = Math.sin(u);
      const Sp = Math.cos(u) * (0.72 + 1.7 * su * su) * 0.9;                       // clipped fold: creased at the ring, bellied in between
      const S = Ss + (Sp - Ss) * pinch;
      const S2 = Math.cos(phase2(s) + 0.6 * drift * (fbm2(s * 3.1 + off[8], d * 0.45 + off[9], { oct: 2, seed: seed + 13 }) - 0.5) * 2.8);
      const A = 1 + amod * (fbm2(s * 10 + off[4], d * 0.5 + off[5], { oct: 2, seed: seed + 5 }) - 0.5) * 2.6;
      th0[m] = A * a0 * (w1 * S + w2 * S2) + wand * (fbm2(s * 3 + off[6], d * 0.6 + off[7], { oct: 2, seed: seed + 9 }) - 0.5) * 2.6;
      tcap[m] = lerp(capPinch, capBelly, smoothstep(0.02, 0.15, Math.min(tf, 1 - tf)));
    }
    const f = Math.pow(v, 1.35), W = lerp(Wt, Wh, f);
    let lo = 0.2, hi = 14;
    for (let it = 0; it < 20; it++) {
      const mid = (lo + hi) / 2; let w = 0;
      for (let m = 0; m < Mn; m++) w += Math.cos(tcap[m] * Math.tanh((mid * th0[m]) / tcap[m]));
      if (w * ds > W) lo = mid; else hi = mid;
    }
    const mul = (lo + hi) / 2;
    let x = 0, z = 0; xs[0] = 0; zs[0] = 0;
    for (let m = 0; m < Mn; m++) {
      const t = tcap[m] * Math.tanh((mul * th0[m]) / tcap[m]);
      x += Math.cos(t) * ds; z += Math.sin(t) * ds;
      if ((m + 1) % SUB === 0) { const i = (m + 1) / SUB; xs[i] = x; zs[i] = z; }
    }
    // remove the mean and tilt of the section so the panel hangs straight under the rod
    let sx = 0, sz = 0, sxx = 0, sxz = 0;
    for (let i = 0; i < NW; i++) { sx += xs[i]; sz += zs[i]; sxx += xs[i] * xs[i]; sxz += xs[i] * zs[i]; }
    const slope = (NW * sxz - sx * sz) / (NW * sxx - sx * sx), icpt = (sz - slope * sx) / NW;
    if (j === 0) { for (const i of ringIdx) c0 += zs[i] - (icpt + slope * xs[i]); c0 *= 0.5 / nR; }   // rings end up a little behind the rod, the bulk of the cloth under it
    const latN = 0.004 * (fbm2(d * 1.2 + off[8], 7.7, { oct: 2, seed }) - 0.5) * 2 * smoothstep(0.1, 0.8, d);
    const X0 = lerp(x0t, x0h, f) + latN, X1 = lerp(x1t, x1h, f) + latN;
    const bow = 0.004 * Math.sin(PI * Math.min(1, v * 1.1)), cr = 0.0013 * smoothstep(0.05, 0.3, d);
    for (let i = 0; i < NW; i++) {
      const crumple = cr * (fbm2((i / nS) * L * 17 + off[1], d * 8 + off[4], { oct: 2, seed: seed + 31 }) - 0.5) * 2;   // linen never hangs glass-smooth
      const zz = softClamp(zs[i] - (icpt + slope * xs[i]) - c0, zlo, zhi) + bow + crumple;
      PX[j * NW + i] = mirror ? X1 - xs[i] : X0 + xs[i];
      PZ[j * NW + i] = zc + zz;
    }
  }
  const yTopEdge = (s) => yTop - 0.004 * (0.5 + 0.5 * Math.sin(phase(s, 0.62)));
  const hemY = (s) => yHem + 0.005 * (fbm2(s * 5 + off[9], 3.1, { oct: 2, seed }) - 0.5) * 2 - 0.006 * (Math.exp(-s / 0.05) + Math.exp(-(L - s) / 0.05));
  const hemA = new Float32Array(NW * (nv + 1) * 4);
  const geo = gridGeo(nS, nv, (i, j, p) => {
    const s = (i / nS) * L, d = dl[j], k = j * NW + i;
    p.x = PX[k]; p.z = PZ[k]; p.y = lerp(yTopEdge(s), hemY(s), d / H);
    p.u = s; p.v = p.y;
    // slow mottling plus warp-wise streaks: yarn lots never take the dye quite alike
    p.c = (1 - 0.075 * fbm2(s * 3 + off[3], d * 1.6 + off[5], { oct: 3, seed: seed + 21 })) * (0.972 + 0.056 * vnoise2(s * 55 + off[2], d * 0.35 + off[6], seed + 41));
    hemA[k * 4] = Math.min(s, L - s); hemA[k * 4 + 1] = H - d; hemA[k * 4 + 2] = d; hemA[k * 4 + 3] = s;
  }, { flip: !mirror, colors: true });
  geo.setAttribute('aHem', new THREE.BufferAttribute(hemA, 4));
  return { geo, rings: ringIdx.map((i) => ({ x: PX[i], z: PZ[i] })) };
}

function ringGeo(rng, rodR, dz) {
  const R = 0.0155, tb = 0.0017, cy = rodR - (R - tb);
  const gm = merge([
    new THREE.TorusGeometry(R, tb, 8, 28).rotateY(PI / 2).translate(0, cy, 0),
    new THREE.TorusGeometry(0.0032, 0.0008, 5, 10).translate(0, cy - R - 0.0026, 0),
    // sprung clip: two jaws on a little barrel
    roundedBox(0.0075, 0.012, 0.0034, { r: 0.0008, rs: 1 }).translate(0, -0.03, 0),
    cylX(0.0011, -0.0042, 0.0042, 8).translate(0, -0.0255, 0),
  ]);
  gm.rotateY(rng.range(-0.22, 0.22)).rotateZ(rng.range(-0.09, 0.09));
  gm.rotateX(-Math.asin(clamp(dz / 0.03, -0.6, 0.6)));
  return gm;
}

function buildCurtains(ctx) {
  const M = ctx.M, C = CURTAIN, g = group('curtains');
  const rodY = C.rodY, zc = C.z, rodR = 0.01, yTop = rodY - 0.03;
  const lm = linenMaps();
  const linen = fabric(sc(0.79, 0.755, 0.69), {
    trans: 0.12, side: THREE.DoubleSide, slub: 0.6, rep: 11, nscale: 0.9, sheen: 0.25, key: 'Curtain',
    onCompile(sh) {
      // barely perceptible breathing; pinned at the rings, free at the hem. Rest pose is what the bake sees.
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute vec4 aHem;\nvarying vec4 vHem;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        vHem = aHem;
        { float cw = clamp( ( ${yTop.toFixed(3)} - position.y ) / 2.3, 0.0, 1.0 ); cw *= cw;
          transformed.z += cw * 0.003 * sin( uTime * 0.6 + position.x * 2.1 );
          transformed.x += cw * 0.001 * sin( uTime * 0.43 + position.x * 3.3 + 1.7 ); }`);
      // doubled hems (2 cm sides, 9 cm bottom, 7 cm heading tape) with their rows of stitches, and the faint
      // horizontal creases left from lying folded in the packet
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vHem;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float hs = vHem.x, hb = vHem.y, ht = vHem.z, sa = vHem.w;
          float hpx = fwidth( hb ) + fwidth( hs );
          float dbl = max( 1.0 - smoothstep( 0.0197, 0.0203, hs ), max( 1.0 - smoothstep( 0.0897, 0.0903, hb ), 1.0 - smoothstep( 0.0697, 0.0703, ht ) ) );
          diffuseColor.rgb *= 1.0 - 0.085 * dbl;
          float st = ( 1.0 - smoothstep( 0.00024, 0.00048, abs( hs - 0.0168 ) ) ) * step( 0.3, fract( hb / 0.0034 ) );
          st = max( st, ( 1.0 - smoothstep( 0.00024, 0.00048, abs( hb - 0.0862 ) ) ) * step( 0.3, fract( sa / 0.0034 ) ) );
          st = max( st, ( 1.0 - smoothstep( 0.00024, 0.00048, abs( ht - 0.0662 ) ) ) * step( 0.3, fract( sa / 0.0034 + 0.4 ) ) );
          st = max( st, ( 1.0 - smoothstep( 0.00024, 0.00048, abs( ht - 0.0045 ) ) ) * step( 0.3, fract( sa / 0.0034 + 0.7 ) ) );
          diffuseColor.rgb *= 1.0 - 0.3 * st * ( 1.0 - smoothstep( 0.0005, 0.0016, hpx ) );
        }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef USE_NORMALMAP_TANGENTSPACE
        {
          float cy = vHem.y / 0.345 + 0.31, cid = floor( cy ), ce = ( fract( cy ) - 0.5 ) / 0.014;
          float camp = ( 0.5 + 0.5 * sin( cid * 2.4 + 1.0 ) ) * ( 0.65 + 0.35 * sin( vHem.w * 21.0 + cid * 1.7 ) ) * ( mod( cid, 2.0 ) < 0.5 ? 1.0 : -1.0 );
          normal = normalize( normal + tbn[1] * ( ce * exp( -0.5 * ce * ce ) * 0.3 * camp ) );
        }
        #endif`);
    },
  });
  linen.map = lm.map; linen.normalMap = lm.normalMap; linen.color.setRGB(1, 1, 1);
  linen.userData.bake.albedo = lm.avg;
  linen.vertexColors = true;
  const panels = [
    { x0t: C.left[0] + 0.02, x1t: C.left[1] - 0.03, x0h: C.left[0], x1h: C.left[1], loops: 7, seed: 4101, mirror: false },
    { x0t: C.right[0] + 0.025, x1t: C.right[1] - 0.015, x0h: C.right[0], x1h: C.right[1], loops: 6, seed: 7323, mirror: true },
  ];
  const rg = new RNG(991), ringGeos = [];
  panels.forEach((p, k) => {
    const { geo, rings } = curtainPanel({ ...p, zc, yTop, yHem: C.bottom });
    add(g, geo, linen, k ? 'curtainR' : 'curtainL');
    for (const r of rings) ringGeos.push(ringGeo(rg, rodR, r.z - zc).translate(r.x, rodY, zc));
  });
  add(g, merge(ringGeos), M.metal, 'curtainRings', { bakeOccluder: false });

  // rod with turned finials
  const finial = () => lathe([[0, 0], [0.0102, 0], [0.0119, 0.0012], [0.0119, 0.0046], [0.0106, 0.006], [0.0106, 0.0076], [0.0128, 0.0096], [0.0143, 0.0136], [0.0147, 0.018], [0.0139, 0.0226], [0.0113, 0.0263], [0.007, 0.0286], [0.0028, 0.0297], [0, 0.0299]], 28);
  const rod = merge([
    cylX(rodR, 0.25, 2.75, 20, rodR, 50).translate(0, rodY, zc),
    finial().rotateZ(PI / 2).translate(0.2525, rodY, zc), finial().rotateZ(-PI / 2).translate(2.7475, rodY, zc),
  ]);
  add(g, rod, M.metal, 'curtainRod');
  // wall brackets: rosette with two slotted screws, stem, cup that carries the rod, set screw
  const br = [], dk = [];
  for (const bx of [0.292, 1.5, 2.708]) {
    br.push(cylZ(0.022, 0, 0.0045, 32).translate(bx, rodY, 0), cylZ(0.022, 0.0045, 0.0062, 32, 0.0195).translate(bx, rodY, 0), cylZ(0.0118, 0.0062, 0.0105, 24, 0.0092).translate(bx, rodY, 0));
    br.push(cylZ(0.0058, 0.006, zc - 0.012, 16).translate(bx, rodY, 0), cylZ(0.0058, zc - 0.012, zc - 0.006, 16, 0.0085).translate(bx, rodY, 0));
    br.push(cylX(0.0134, bx - 0.009, bx + 0.009, 28).translate(0, rodY, zc), cylX(0.0142, bx - 0.0098, bx - 0.0082, 28).translate(0, rodY, zc), cylX(0.0142, bx + 0.0082, bx + 0.0098, 28).translate(0, rodY, zc));
    br.push(flat(cyl(0.003, 0, 0.0042, 6)).translate(bx, rodY + 0.0128, zc));
    for (const sy of [-1, 1]) {
      br.push(cylZ(0.0031, 0.006, 0.0074, 12, 0.0026).translate(bx, rodY + sy * 0.0148, 0));
      dk.push(roundedBox(0.0046, 0.0007, 0.0006, { r: 0.0002, rs: 1 }).rotateZ(0.5 + sy).translate(bx, rodY + sy * 0.0148, 0.0074));
    }
  }
  add(g, merge(br), M.metal, 'curtainBrackets', { bakeOccluder: false });
  add(g, merge(dk), M.shadowGap || M.rubber, 'curtainScrewSlots', { bakeOccluder: false });
  return g;
}

// ================================================================== RADIATOR
function paintRadTop() {
  // the top grille as seen from above: enamel under a film of settled dust and lint (thicker towards the wall)
  const W = 2048, H = 160, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(2207);
  x.fillStyle = '#eeede8'; x.fillRect(0, 0, W, H);
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(150,144,134,0.05)'); gr.addColorStop(1, 'rgba(150,144,134,0.2)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(146,140,130,${rng.range(0.03, 0.08).toFixed(3)})`; x.beginPath(); x.ellipse(rng.range(0, W), rng.range(0, H), rng.range(30, 130), rng.range(14, 50), 0, 0, 2 * PI); x.fill(); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${rng.int(110, 150)},${rng.int(106, 144)},${rng.int(98, 134)},${rng.range(0.12, 0.5).toFixed(2)})`; x.fillRect(rng.range(0, W), rng.range(0, H), rng.range(0.7, 2), rng.range(0.7, 1.8)); }
  x.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const px = rng.range(0, W), py = rng.range(0, H), l = rng.range(6, 26), a = rng.range(0, 2 * PI);
    x.lineWidth = rng.range(0.6, 1.1); x.strokeStyle = `rgba(128,124,118,${rng.range(0.25, 0.55).toFixed(2)})`;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + rng.range(-5, 5), py + Math.sin(a) * l * 0.5 + rng.range(-5, 5), px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return c;
}
function paintThermoRing() {
  const W = 1024, H = 64, c = makeCanvas(W, H), x = c2d(c);
  x.fillStyle = '#e6e6e3'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#34373b'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['✱', '1', '2', '3', '4', '5'].forEach((m, k) => {
    const u = (((0.875 + (k - 3) * 0.135) % 1) + 1) % 1;
    x.font = k ? '700 40px Arial, Helvetica, sans-serif' : '700 30px "Segoe UI Symbol", Arial, sans-serif';
    for (const w of [-W, 0, W]) x.fillText(m, u * W + w, H * 0.55);
    if (k < 5) for (let q = 1; q <= 3; q++) {
      const pu = (((u + (0.135 * q) / 4) % 1) + 1) % 1, big = q === 2;
      x.fillRect(pu * W - (big ? 2 : 1.3), H * 0.55 - (big ? 9 : 5), big ? 4 : 2.6, big ? 18 : 10);
    }
  });
  return c;
}
/** Small irregular flake (paint chip) in the XY plane facing +Z. */
function chipGeo(rng, r) {
  const n = 9, pos = [0, 0, 0], nor = [0, 0, 1], uv = [0, 0], idx = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * 2 * PI, rr = r * (0.5 + 0.7 * rng.next()); pos.push(Math.cos(a) * rr * 1.35, Math.sin(a) * rr, 0); nor.push(0, 0, 1); uv.push(0, 0); }
  for (let k = 0; k < n; k++) idx.push(0, 1 + k, 1 + ((k + 1) % n));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}

function buildRadiator(ctx, lib) {
  const M = ctx.M, g = group('radiator');
  const { x0, x1, y0, y1, z0, z1 } = RADIATOR;
  // ---- pressed steel front panel: vertical flutes between seam grooves, plain header zones top and bottom
  const px0 = x0 + 0.009, pw = x1 - x0 - 0.018, ph = y1 - y0 - 0.009;
  const pitch = 1 / 30, nCh = Math.floor((pw - 0.012) / pitch), mrg = (pw - nCh * pitch) / 2;
  const zb = z1 - 0.0135, bulge = 0.0095;
  const xs = [0, 0.0015, 0.004];
  for (let k = 0; k < nCh; k++) for (const f of [0, 0.06, 0.12, 0.18, 0.3, 0.5, 0.7, 0.82, 0.88, 0.94]) xs.push(mrg + (k + f) * pitch);
  xs.push(mrg + nCh * pitch, pw - 0.004, pw - 0.0015, pw);
  const eb = [0, 0.0015, 0.004, 0.009, 0.016, 0.026, 0.034, 0.04, 0.046, 0.052, 0.06];
  const ys = eb.slice(), nm = Math.ceil((ph - 0.12) / 0.04);
  for (let k = 1; k < nm; k++) ys.push(0.06 + ((ph - 0.12) * k) / nm);
  for (let k = eb.length - 1; k >= 0; k--) ys.push(ph - eb[k]);
  const hgt = (xl, yl) => {
    const ex = Math.min(xl, pw - xl), ey = Math.min(yl, ph - yl);
    const F = smoothstep(0.002, 0.013, ex) * smoothstep(0.002, 0.016, ey);
    const q = (xl - mrg) / pitch, dxg = Math.abs(q - Math.round(q)) * pitch;
    const gv = (1 - smoothstep(0.001, 0.006, dxg)) * smoothstep(0.03, 0.05, ey);
    const crown = 0.9 + 0.1 * smoothstep(0.004, pitch / 2, dxg);
    return bulge * F * (1 - 0.88 * gv) * crown;
  };
  const nu = xs.length - 1, nv = ys.length - 1;
  const front = gridGeo(nu, nv, (i, j, p) => {
    p.x = px0 + xs[i]; p.y = y0 + ys[j];
    p.z = (i === 0 || i === nu || j === 0 || j === nv) ? zb - 0.012 : zb + hgt(xs[i], ys[j]);
    p.u = p.x; p.v = p.y;
  });
  add(g, front, lib.radEnamel, 'radFront');

  // ---- casing: end covers, top grille with two rows of slots, rolled lips
  const cs = [];
  const capH = y1 - y0 - 0.006, capD = z1 - z0 - 0.012;
  cs.push(boxAt(x0, y0 + 0.006, z0 + 0.012, 0.01, capH, capD, { r: 0.0022, rs: 2, maxEdge: 0.05 }));
  cs.push(boxAt(x1 - 0.01, y0 + 0.006, z0 + 0.012, 0.01, capH, capD, { r: 0.0022, rs: 2, maxEdge: 0.05 }));
  const gx0 = x0 + 0.01, gx1 = x1 - 0.01, gz0 = z0 + 0.012, gz1 = z1 - 0.001, gy = y1 - 0.0016;
  const slotP = 0.011, slotW = 0.0058, nSl = Math.floor((gx1 - gx0 - 0.02) / slotP), sx0 = (gx0 + gx1) / 2 - (nSl * slotP) / 2;
  const gxs = [gx0];
  for (let k = 0; k < nSl; k++) { const c = sx0 + (k + 0.5) * slotP; gxs.push(c - slotW / 2, c + slotW / 2); }
  gxs.push(gx1);
  const mB = 0.006, mF = 0.017, bar = 0.012, sl = (gz1 - gz0 - mB - mF - bar) / 2;
  const gzs = [gz0, gz0 + mB, gz0 + mB + sl, gz0 + mB + sl + bar, gz1 - mF, gz1];
  // the grille is where dust settles: its own material with the dust film painted across the whole length
  const topCv = paintRadTop(), topTex = canvasTex(topCv, { srgb: true });
  topTex.repeat.set(1 / (gx1 - gx0), 1 / (gz1 - gz0)); topTex.offset.set(-gx0 / (gx1 - gx0), -gz0 / (gz1 - gz0));
  const topMat = pbr({ map: topTex, roughness: 0.66, normalMap: lib.rep(lib.lacN, 9, 9), normalScale: new THREE.Vector2(0.3, 0.3) }, { bake: { albedo: avgColor(topCv.getContext('2d').getImageData(0, 0, topCv.width, topCv.height).data) } });
  add(g, slotPlane(gxs, gzs, gy, (i, j) => (i & 1) === 1 && (j === 1 || j === 3)), topMat, 'radGrille');
  cs.push(boxAt(gx0, y1 - 0.0105, z1 - 0.0038, gx1 - gx0, 0.0102, 0.0036, { r: 0.0012, rs: 2, maxEdge: 0.06 }));
  cs.push(boxAt(gx0, y1 - 0.0105, gz0, gx1 - gx0, 0.0102, 0.003, { r: 0.0012, rs: 2, maxEdge: 0.06 }));
  // wall brackets peeking out underneath
  for (const bx of [x0 + 0.17, x1 - 0.17]) {
    cs.push(boxAt(bx - 0.013, y0 - 0.016, 0.0005, 0.026, 0.06, z0 + 0.016, { r: 0.002, rs: 1 }));
    cs.push(boxAt(bx - 0.013, y0 - 0.016, z0 + 0.012, 0.026, 0.012, 0.03, { r: 0.002, rs: 1 }));
  }
  add(g, merge(cs), lib.radEnamel, 'radCasing');
  // convector core seen through the slots
  add(g, boxAt(x0 + 0.011, y0 + 0.012, z0 + 0.012, x1 - x0 - 0.022, y1 - y0 - 0.034, z1 - z0 - 0.0275, { r: 0.001, rs: 1, maxEdge: 0.3 }), lib.darkCore, 'radCore');
  // two tiny chips in the enamel (a knock from the vacuum cleaner low down, one on the front lip)
  {
    const rc = new RNG(411), chips = [];
    const at = (xl, yl, r, rot) => chips.push(chipGeo(rc, r).rotateZ(rot).translate(px0 + xl, y0 + yl, zb + hgt(xl, yl) + 0.00012));
    at(mrg + 20.5 * pitch, 0.021, 0.0016, 0.4); at(mrg + 20.5 * pitch + 0.006, 0.0175, 0.0008, 1.9); at(mrg + 6.5 * pitch, 0.024, 0.0011, 2.6);
    chips.push(chipGeo(rc, 0.0013).rotateZ(0.2).translate(x0 + 0.71, y1 - 0.0052, z1 - 0.00008));
    add(g, merge(chips), lib.chip, 'radChips', { bakeOccluder: false });
  }

  // ---- valves and pipework
  const yv = y0 + 0.05, zv = z0 + 0.05;
  const ni = [], wh = [];
  // left: angled thermostatic valve, pipe rising from the floor
  const lx = x0 - 0.036;
  ni.push(hexX(0.0135, x0 - 0.018, x0 + 0.001).translate(0, yv, zv));
  ni.push(cylX(0.0095, x0 - 0.05, x0 - 0.018, 16).translate(0, yv, zv));
  ni.push(cyl(0.0095, yv - 0.03, yv, 16).translate(lx, 0, zv));
  ni.push(hexY(0.013, yv - 0.044, yv - 0.03).translate(lx, 0, zv));
  ni.push(cyl(0.0086, yv - 0.047, yv - 0.044, 16).translate(lx, 0, zv));                    // olive of the compression joint
  ni.push(cylX(0.0158, x0 - 0.0625, x0 - 0.05, 28).translate(0, yv, zv));
  const rosette = () => lathe([[0.0225, 0], [0.0225, 0.004], [0.018, 0.0095], [0.0085, 0.0115]], 24);
  wh.push(cyl(0.0075, 0, yv - 0.046, 14).translate(lx, 0, zv), rosette().translate(lx, 0.0003, zv));
  // right: lockshield with a plastic cap
  const rx = x1 + 0.034;
  ni.push(hexX(0.0135, x1 - 0.001, x1 + 0.018).translate(0, yv, zv));
  ni.push(cylX(0.0095, x1 + 0.018, x1 + 0.047, 16).translate(0, yv, zv));
  ni.push(cyl(0.0095, yv - 0.03, yv, 16).translate(rx, 0, zv));
  ni.push(hexY(0.013, yv - 0.044, yv - 0.03).translate(rx, 0, zv));
  ni.push(cyl(0.0086, yv - 0.047, yv - 0.044, 16).translate(rx, 0, zv));
  wh.push(cyl(0.0075, 0, yv - 0.046, 14).translate(rx, 0, zv), rosette().translate(rx, 0.0003, zv));
  wh.push(lathe([[0, 0], [0.0128, 0], [0.0128, 0.017], [0.011, 0.021], [0.006, 0.0225], [0, 0.0225]], 20).rotateZ(-PI / 2).translate(x1 + 0.046, yv, zv));
  // bleed valve (top right) and blanking plug (top left)
  ni.push(hexX(0.0078, x1 - 0.001, x1 + 0.0075).translate(0, y1 - 0.045, zv), cylX(0.0028, x1 + 0.0075, x1 + 0.0115, 8).translate(0, y1 - 0.045, zv));
  wh.push(hexX(0.0085, x0 - 0.006, x0 + 0.001).translate(0, y1 - 0.045, zv));
  add(g, merge(ni), lib.nickel, 'radValves');
  add(g, merge(wh), lib.radEnamel, 'radPipes');
  // thermostat head: smooth scale ring with printed numbers, ribbed grip, tapered nose
  const hx = x0 - 0.0625, nuH = 120, ribsN = 24;
  const prof = [[0, 0.0162, 0], [0.003, 0.0184, 0], [0.011, 0.0184, 0], [0.0122, 0.0222, 0], [0.0132, 0.0232, 0], [0.0228, 0.0232, 0], [0.0242, 0.0226, 0.4], [0.027, 0.0236, 1], [0.04, 0.0238, 1], [0.052, 0.0232, 1], [0.058, 0.0222, 1], [0.0625, 0.0205, 0.3], [0.068, 0.0175, 0], [0.072, 0.012, 0], [0.074, 0.005, 0], [0.0745, 0.00002, 0]];
  const head = gridGeo(nuH, prof.length - 1, (i, j, p) => {
    const a = (i / nuH) * 2 * PI, [ax, r0, rb] = prof[j];
    const r = r0 * (1 - rb * 0.05 * smoothstep(0.2, 0.9, Math.cos(ribsN * a)));
    p.x = hx - ax; p.y = yv + r * Math.cos(a); p.z = zv + r * Math.sin(a); p.u = (i / nuH) * 0.15; p.v = ax;
  }, { closedU: true, flip: true });
  add(g, head, M.plasticWhite, 'radThermostat');
  add(g, bandX(0.02328, hx - 0.0224, hx - 0.0136, 64).translate(0, yv, zv), canvasMat(paintThermoRing(), 1, 1, { roughness: 0.4 }), 'radThermoScale', { bakeOccluder: false });
  add(g, merge([cylX(0.01875, hx - 0.0105, hx - 0.0035, 36).translate(0, yv, zv), boxAt(hx - 0.0098, yv + 0.0185, zv - 0.0013, 0.0056, 0.0013, 0.0026, { r: 0.0004, rs: 1 })]), lib.greyPlastic, 'radThermoBand');
  return g;
}

// ================================================================== WARDROBE
function paintBoxLabel() {
  const W = 232, H = 96, c = makeCanvas(W, H), x = c2d(c);
  x.fillStyle = '#e9e4d6'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#2b3140'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '44px "Ink Free", "Segoe Print", "Comic Sans MS", cursive'; x.fillText('winter', W / 2, H / 2 + 2);
  return c;
}

function buildWardrobe(ctx, lib) {
  const M = ctx.M, g = group('wardrobe');
  const x0 = WARDROBE.x0, x1 = WARDROBE.x1, zb = 0.016, zf = WARDROBE.z1, h = WARDROBE.h, t = 0.02, dep = zf - zb;
  const P = { r: 0.0012, rs: 2, maxEdge: 0.055 };
  // carcass in light oak: sides run to the floor, top / bottom boards and plinth sit between them
  add(g, merge([
    swapUV(boxAt(x0, 0, zb, t, h, dep, { ...P, skip: ['nz'] })),
    swapUV(boxAt(x1 - t, 0, zb, t, h, dep, { ...P, skip: ['nz'] })),
  ]), lib.oakV, 'wardrobeSides');
  add(g, merge([
    boxAt(x0 + t, h - t, zb, x1 - x0 - 2 * t, t, dep, { ...P, skip: ['nz'] }),
    boxAt(x0 + t, 0.08, zb, x1 - x0 - 2 * t, t, dep, { ...P, skip: ['nz', 'ny'] }),
    boxAt(x0 + t, 0, zb + 0.02, x1 - x0 - 2 * t, 0.08, dep - 0.065, { ...P, skip: ['nz', 'ny', 'py'] }),
  ]), lib.oakH, 'wardrobeBoards');
  // inset doors with 3 mm shadow gaps; the dark behind them is a matte black plane. No two doors ever hang
  // alike: the right one sits a good millimetre low, a hair proud and leans by half a millimetre
  const ox0 = x0 + t, ow = x1 - x0 - 2 * t, oy0 = 0.1, oh = h - t - oy0, gap = 0.003;
  const dw = (ow - 3 * gap) / 2, dh = oh - 2 * gap, dt = 0.018;
  const door = () => roundedBox(dw, dh, dt, { r: 0.0018, rs: 3, maxEdge: 0.05, skip: ['nz'] });
  add(g, door().translate(ox0 + gap + dw / 2, oy0 + gap + dh / 2, zf - 0.0006 - dt / 2), lib.door, 'wardrobeDoorL');
  add(g, door().rotateZ(0.00055).translate(ox0 + 2 * gap + dw * 1.5 + 0.0003, oy0 + gap + dh / 2 - 0.0013, zf + 0.0006 - dt / 2), lib.door, 'wardrobeDoorR');
  add(g, gridPlane(ow, oh, 0.5).translate(ox0 + ow / 2, oy0 + oh / 2, zf - 0.03), lib.void, 'wardrobeVoid');
  // slim bar handles either side of the centre gap: bar on two posts, each post on a collar
  const hs = [], cxm = ox0 + ow / 2, hy = 1.07, hl = 0.165;
  for (const sgn of [-1, 1]) {
    const hx = cxm + sgn * 0.047, fz = zf - 0.0004;
    hs.push(roundedBox(0.009, hl, 0.008, { r: 0.003, rs: 3, maxEdge: 0.04 }).translate(hx, hy, fz + 0.024));
    for (const dy of [-0.055, 0.055]) hs.push(cylZ(0.0042, fz, fz + 0.022, 12).translate(hx, hy + dy, 0), cylZ(0.0068, fz, fz + 0.0012, 16).translate(hx, hy + dy, 0), cylZ(0.0068, fz + 0.0012, fz + 0.0022, 16, 0.0048).translate(hx, hy + dy, 0));
  }
  add(g, merge(hs), M.metal, 'wardrobeHandles');

  // wooden storage box with a lid on top, a finger hole and a label holder
  const bx = group('storageBox');
  const bw = 0.44, bh = 0.185, bd = 0.3;
  add(bx, merge([
    roundedBox(bw, bh, bd, { r: 0.003, rs: 2, maxEdge: 0.06, skip: ['ny'] }).translate(0, bh / 2, 0),
    roundedBox(bw + 0.012, 0.026, bd + 0.012, { r: 0.0035, rs: 2, maxEdge: 0.06 }).translate(0, bh + 0.013 - 0.004, 0),
  ]), lib.boxWood, 'boxBody');
  add(bx, new THREE.CylinderGeometry(0.0125, 0.0125, 0.0012, 28).rotateX(PI / 2).scale(3.6, 1, 1).translate(0, bh * 0.68, bd / 2 + 0.0004), lib.void, 'boxGrip', { bakeOccluder: false });
  {
    const fw = 0.074, fh = 0.036, fy = bh * 0.34, fz = bd / 2, B = { r: 0.0005, rs: 1 };
    add(bx, merge([
      boxAt(-fw / 2, fy - fh / 2, fz, fw, 0.004, 0.0014, B), boxAt(-fw / 2, fy + fh / 2 - 0.004, fz, fw, 0.004, 0.0014, B),
      boxAt(-fw / 2, fy - fh / 2, fz, 0.004, fh, 0.0014, B), boxAt(fw / 2 - 0.004, fy - fh / 2, fz, 0.004, fh, 0.0014, B),
      cylZ(0.0016, fz, fz + 0.0019, 8).translate(-fw / 2 - 0.004, fy, 0), cylZ(0.0016, fz, fz + 0.0019, 8).translate(fw / 2 + 0.004, fy, 0),
      boxAt(-fw / 2 - 0.007, fy - 0.0035, fz, 0.007, 0.007, 0.0008, B), boxAt(fw / 2, fy - 0.0035, fz, 0.007, 0.007, 0.0008, B),
    ]), M.metal, 'boxLabelFrame', { bakeOccluder: false });
    add(bx, gridPlane(fw - 0.006, fh - 0.006, 0.04).translate(0, fy, fz + 0.0005), canvasMat(paintBoxLabel(), fw - 0.006, fh - 0.006, { roughness: 0.9 }), 'boxLabel', { bakeOccluder: false });
  }
  bx.position.set(4.3, h + 0.0004, 0.31); bx.rotation.y = -0.07;
  g.add(bx);
  ctx.colliders.push({ min: [x0, 0, 0], max: [x1, h, zf] });
  return g;
}

// ================================================================== NIGHTSTAND + what is on it
const SEG = { a: [0, 1, 0], g: [0, 0, 0], d: [0, -1, 0], f: [-1, 0.5, 1], b: [1, 0.5, 1], e: [-1, -0.5, 1], c: [1, -0.5, 1] };
const DIGIT = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' };
/** Seven-segment digits as flat hexagonal bars in the XY plane (z = 0). */
function segGeo(items, { hgt = 0.024, wid = 0.0125, t = 0.0028, gap = 0.0006, slant = 0.09 } = {}) {
  const pos = [], idx = [];
  const hh = hgt / 2 - t / 2, ww = wid / 2 - t / 2;
  const hex = (cx, cy, len, vert) => {
    const l = len / 2, k = t / 2, pts = [[-l, 0], [-l + k, k], [l - k, k], [l, 0], [l - k, -k], [-l + k, -k]];
    const b = pos.length / 3;
    for (const [px, py] of pts) { const x = vert ? py : px, y = vert ? px : py; pos.push(cx + x + (cy + y) * slant, cy + y, 0); }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2, b, b + 4, b + 3, b, b + 5, b + 4);
  };
  for (const it of items) {
    if (it.colon) { for (const dy of [-0.0052, 0.0052]) { const b = pos.length / 3, k = t * 0.55, cx = it.x + dy * slant; pos.push(cx - k, dy - k, 0, cx + k, dy - k, 0, cx + k, dy + k, 0, cx - k, dy + k, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); } continue; }
    for (const ch of it.segs) { const s = SEG[ch]; hex(it.x + s[0] * ww, s[1] * hh, (s[2] ? hh : 2 * ww) - gap, !!s[2]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

/** The lit segments blurred into a halo: what the smoked lens and the bezel catch of the LEDs. */
function paintGlow(lit, w, h, y0) {
  const CW = 472, CH = 200, c = makeCanvas(CW, CH), x = c2d(c);
  x.fillStyle = '#000'; x.fillRect(0, 0, CW, CH);
  const p = lit.attributes.position, ix = lit.index;
  const P = (i) => [(p.getX(i) / w + 0.5) * CW, (1 - (p.getY(i) - y0) / h) * CH];
  for (const [blur, a] of [[30, 0.55], [10, 0.6]]) {
    x.shadowColor = `rgba(255,255,255,${a})`; x.shadowBlur = blur; x.fillStyle = 'rgba(255,255,255,0.3)';
    x.beginPath();
    for (let k = 0; k < ix.count; k += 3) { const a0 = P(ix.getX(k)), b0 = P(ix.getX(k + 1)), d0 = P(ix.getX(k + 2)); x.moveTo(a0[0], a0[1]); x.lineTo(b0[0], b0[1]); x.lineTo(d0[0], d0[1]); x.closePath(); }
    x.fill();
  }
  return c;
}

function buildClock(lib) {
  const g = group('alarmClock');
  const w = 0.118, h = 0.05, d = 0.044, fz = d / 2;
  add(g, merge([
    roundedBox(w, h, d, { r: 0.0065, rs: 4, maxEdge: 0.03 }).translate(0, h / 2 + 0.0016, 0),
    boxAt(-0.045, 0, -0.014, 0.012, 0.002, 0.028, { r: 0.0008, rs: 1 }), boxAt(0.033, 0, -0.014, 0.012, 0.002, 0.028, { r: 0.0008, rs: 1 }),
    // snooze bar and two setting buttons on top
    boxAt(-0.036, h + 0.0012, -0.009, 0.034, 0.002, 0.014, { r: 0.0009, rs: 2 }),
    boxAt(0.008, h + 0.0012, -0.006, 0.011, 0.0016, 0.008, { r: 0.0007, rs: 1 }), boxAt(0.024, h + 0.0012, -0.006, 0.011, 0.0016, 0.008, { r: 0.0007, rs: 1 }),
  ]), lib.clockBody, 'clockBody');
  // parting line between the front and rear shells, and the speaker slots in the back half of the lid
  const seam = [];
  seam.push(boxAt(-w / 2 + 0.006, h + 0.00155, 0.0098, w - 0.012, 0.0002, 0.0005, { r: 0.0001, rs: 1 }));
  for (const sx of [-1, 1]) seam.push(boxAt(sx > 0 ? w / 2 - 0.00015 : -w / 2 - 0.00005, 0.008, 0.0098, 0.0002, h - 0.013, 0.0005, { r: 0.0001, rs: 1 }));
  for (let k = 0; k < 5; k++) seam.push(boxAt(0.03 + k * 0.0036, h + 0.00155, -0.017, 0.0016, 0.0002, 0.007, { r: 0.0001, rs: 1 }));
  add(g, merge(seam), lib.void, 'clockSeams', { bakeOccluder: false });
  add(g, roundedBox(w - 0.009, h - 0.009, 0.0016, { r: 0.0006, rs: 1 }).translate(0, h / 2 + 0.0016, fz), lib.clockLens, 'clockLens');
  // LED digits "6:51" (leading digit dark), plus the ghost of the unlit segments
  const xs = [-0.0329, -0.0163, 0.0123, 0.0289].map((x) => x - 0.003), cy = h / 2 + 0.0016, cz = fz + 0.00095;
  const lit = segGeo([{ x: xs[1], segs: DIGIT[6] }, { x: (xs[1] + xs[2]) / 2, colon: true }, { x: xs[2], segs: DIGIT[5] }, { x: xs[3], segs: DIGIT[1] }]).translate(0, cy, cz + 0.0001);
  const ghost = segGeo(xs.map((x) => ({ x, segs: DIGIT[8] }))).translate(0, cy, cz);
  const led = new THREE.Color(0.5, 0.74, 1.12);
  const ledMat = new THREE.MeshBasicMaterial({ color: led, side: THREE.DoubleSide });
  const ghostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0045, 0.0052, 0.0065), side: THREE.DoubleSide });
  ledMat.userData.bake = { ignore: true }; ghostMat.userData.bake = { ignore: true };
  add(g, ghost, ghostMat, 'clockGhost', { gi: false });
  add(g, lit, ledMat, 'clockDigits', { gi: false });
  const dot = new THREE.CircleGeometry(0.0011, 10).translate(-0.047, cy + 0.011, cz + 0.0001);
  add(g, dot, ledMat, 'clockDot', { gi: false });
  // the light the digits spill: a halo in the lens that runs out over the bezel, and a breath of it on the table
  const glowMat = new THREE.MeshBasicMaterial({ map: canvasTex(paintGlow(lit, w, h, 0.0016), { srgb: true, wrap: false }), color: led.clone().multiplyScalar(0.34), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  glowMat.userData.bake = { ignore: true };
  add(g, new THREE.PlaneGeometry(w, h).translate(0, cy, cz + 0.00005), glowMat, 'clockGlow', { gi: false, bakeOccluder: false }).renderOrder = 3;
  const sp = makeCanvas(128, 64), sx = sp.getContext('2d'), gr = sx.createRadialGradient(64, 0, 2, 64, 0, 62);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  sx.fillStyle = '#000'; sx.fillRect(0, 0, 128, 64); sx.fillStyle = gr; sx.fillRect(0, 0, 128, 64);
  const spillMat = new THREE.MeshBasicMaterial({ map: canvasTex(sp, { srgb: true, wrap: false }), color: led.clone().multiplyScalar(0.018), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  spillMat.userData.bake = { ignore: true };
  add(g, new THREE.PlaneGeometry(0.2, 0.09).rotateX(-PI / 2).translate(0, 0.0006, fz + 0.045), spillMat, 'clockSpill', { gi: false, bakeOccluder: false }).renderOrder = 2;
  return g;
}

function paintCover(seed) {
  const W = 512, H = 784, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(seed);
  x.fillStyle = '#d9d1c0'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#34505f'; x.beginPath(); x.arc(W * 0.5, H * 0.36, W * 0.27, 0, 2 * PI); x.fill();
  x.fillStyle = '#d9d1c0';
  for (let k = 0; k < 4; k++) { // pale tide lines cutting the disc
    const y0 = H * (0.36 + k * 0.045); x.beginPath(); x.moveTo(0, y0);
    for (let i = 0; i <= 40; i++) x.lineTo((i / 40) * W, y0 + Math.sin(i * 0.5 + k * 1.3) * 5 + Math.sin(i * 0.17 + k) * 6);
    x.lineTo(W, y0 + 9 + k * 2.5); for (let i = 40; i >= 0; i--) x.lineTo((i / 40) * W, y0 + 9 + k * 2.5 + Math.sin(i * 0.5 + k * 1.3) * 5 + Math.sin(i * 0.17 + k) * 6);
    x.closePath(); x.fill();
  }
  x.fillStyle = '#b9694d'; x.beginPath(); x.arc(W * 0.68, H * 0.2, W * 0.055, 0, 2 * PI); x.fill();
  x.fillStyle = '#2a3238'; x.textAlign = 'center';
  x.font = '600 46px Georgia, "Times New Roman", serif'; x.fillText('S L O W   T I D E S', W / 2, H * 0.72);
  x.font = 'italic 24px Georgia, "Times New Roman", serif'; x.fillText('a novel', W / 2, H * 0.775);
  x.font = '22px Georgia, "Times New Roman", serif'; x.fillText('M A R A   A R D E N', W / 2, H * 0.92);
  x.globalAlpha = 0.05; for (let i = 0; i < 2500; i++) { x.fillStyle = rng.chance(0.5) ? '#000' : '#fff'; x.fillRect(rng.range(0, W), rng.range(0, H), 2, 2); }
  x.globalAlpha = 0.1; x.strokeStyle = '#000'; x.lineWidth = 3; x.beginPath(); x.moveTo(14, 0); x.lineTo(14, H); x.stroke();   // spine crease
  // a thumbed corner and a soft dog-ear shadow
  x.globalAlpha = 0.08; x.fillStyle = '#5a4630'; x.beginPath(); x.moveTo(W, H); x.lineTo(W - 90, H); x.lineTo(W, H - 120); x.closePath(); x.fill();
  x.globalAlpha = 1;
  return c;
}
/** Spine of the paperback (reads along the book's height): title, author, and the white cracks of a read book. */
function paintSpine(seed) {
  const W = 784, H = 84, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(seed);
  x.fillStyle = '#d9d1c0'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#34505f'; x.beginPath(); x.arc(52, H / 2, 17, 0, 2 * PI); x.fill();
  x.fillStyle = '#2a3238'; x.textBaseline = 'middle'; x.textAlign = 'left';
  x.font = '600 34px Georgia, "Times New Roman", serif'; x.fillText('S L O W   T I D E S', 110, H / 2 + 2);
  x.textAlign = 'right'; x.font = '24px Georgia, "Times New Roman", serif'; x.fillText('A R D E N', W - 36, H / 2 + 2);
  for (let k = 0; k < 5; k++) {
    const y0 = H * rng.range(0.2, 0.8), xa = rng.range(0, W * 0.3), xb = rng.range(W * 0.6, W);
    for (const [dy, col, lw] of [[1.2, 'rgba(60,50,38,0.22)', 1.4], [0, 'rgba(250,247,240,0.75)', rng.range(0.9, 1.9)]]) {
      x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
      for (let i = 0; i <= 40; i++) { const px = lerp(xa, xb, i / 40), py = y0 + dy + Math.sin(i * 0.7 + k * 2) * 1.2 + Math.sin(i * 0.23 + k) * 2.2; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
      x.stroke();
    }
  }
  x.globalAlpha = 0.06; for (let i = 0; i < 700; i++) { x.fillStyle = rng.chance(0.5) ? '#000' : '#fff'; x.fillRect(rng.range(0, W), rng.range(0, H), 2, 2); }
  x.globalAlpha = 1;
  return c;
}

/** Book lying flat. Local frame: spine along z at x = 0, cover faces +y, readable from +z. */
function makeBook(lib, o) {
  const { w, d, t, cover, top = cover, spine = cover, hard = false, name = 'book' } = o;
  const g = group(name), tc = hard ? 0.0022 : 0.0006, ov = hard ? 0.003 : 0.0003, rr = hard ? 0.0009 : 0.00025;
  const B = { r: rr, rs: hard ? 2 : 1, maxEdge: 0.035 };
  add(g, boxAt(0, t - tc, -d / 2, w, tc, d, B), top, name + 'Top');
  add(g, boxAt(0, 0, -d / 2, w, tc, d, B), cover, name + 'Cover');
  add(g, boxAt(-0.0004, 0, -d / 2, tc + 0.0004, t, d, B), spine, name + 'Spine');
  add(g, boxAt(tc, tc, -d / 2 + ov, w - tc - ov, t - 2 * tc, d - 2 * ov, { r: 0.0005, rs: 1, maxEdge: 0.06, skip: ['py', 'ny'] }), lib.pages, name + 'Pages');
  return g;
}

/** Elastic hair tie lying flat: a slightly uneven closed loop. */
function hairTie(rng, R, r, squash = 1) {
  const n = 14, ph = rng.range(0, 6), pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * PI, rr = R * (1 + 0.07 * Math.sin(2 * a + ph) + 0.035 * rng.range(-1, 1));
    pts.push(V3(Math.cos(a) * rr, r + 0.0003 * (1 + Math.sin(3 * a + ph)), Math.sin(a) * rr * squash));
  }
  return tube(null, r, { curve: new THREE.CatmullRomCurve3(pts, true, 'centripetal'), tubular: 60, radial: 8, cap: false });
}

function paintBalm() {
  const W = 480, H = 320, c = makeCanvas(W, H), x = c2d(c);
  x.fillStyle = '#dfa888'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#f3e7d8'; x.fillRect(0, 0, W, 14); x.fillRect(0, H - 14, W, 14);
  x.save(); x.translate(150, H / 2); x.rotate(-PI / 2);
  x.fillStyle = '#4b2f27'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'italic 600 78px Georgia, serif'; x.fillText('balm', 0, 0);
  x.font = '22px "Trebuchet MS", Arial, sans-serif'; x.fillText('S H E A   &   O A T', 0, 62);
  x.font = '17px "Trebuchet MS", Arial, sans-serif'; x.fillText('lip care  ·  4.8 g', 0, 92);
  x.restore();
  return c;
}

/** Round wire-rim glasses, folded, lying on their temples with the lenses up. */
function buildGlasses(lib) {
  const g = group('glasses'), R = 0.0232, tb = 0.0011, cx = 0.0322;
  const frame = [], tips = [], pads = [], lens = [];
  for (const s of [-1, 1]) {
    frame.push(new THREE.TorusGeometry(R, tb, 8, 48).translate(s * cx, 0, 0));
    lens.push(new THREE.CircleGeometry(R - 0.0003, 40).translate(s * cx, 0, 0.0002));
    const hx = s * (cx + R * Math.cos(0.42)), hy = R * Math.sin(0.42);
    frame.push(tube([V3(hx, hy, 0), V3(hx + s * 0.0034, hy + 0.0006, -0.0006), V3(hx + s * 0.0048, hy + 0.0006, -0.0034)], 0.001, { tubular: 6, radial: 6 }));
    frame.push(roundedBox(0.0022, 0.003, 0.0038, { r: 0.0006, rs: 1 }).translate(hx + s * 0.0048, hy + 0.0006, -0.0048));
    // pad arm and nose pad
    const px = s * (cx - R * Math.cos(0.5)), py = -R * Math.sin(0.5);
    frame.push(tube([V3(px, py, 0), V3(px - s * 0.0012, py - 0.0006, -0.003), V3(px - s * 0.0028, py + 0.0004, -0.0058)], 0.0005, { tubular: 5, radial: 5 }));
    pads.push(new THREE.SphereGeometry(0.003, 10, 8).scale(0.42, 1, 0.7).rotateY(s * 0.5).translate(px - s * 0.003, py + 0.0004, -0.0062));
    // temple folded across the back: wire, then the acetate ear piece curving down
    const zo = s < 0 ? 0 : 0.0028, tz = -0.0064 - zo, x0 = hx + s * 0.0048;
    frame.push(tube([V3(x0, hy + 0.0006, -0.0052), V3(x0 - s * 0.004, hy + 0.0006, tz), V3(s * 0.02, hy + 0.0005, tz - 0.0006), V3(-s * 0.026, hy + 0.0002, tz - 0.0012)], 0.00085, { tubular: 14, radial: 6 }));
    tips.push(tube([V3(-s * 0.02, hy + 0.0003, tz - 0.001), V3(-s * 0.034, hy - 0.0008, tz - 0.0014), V3(-s * 0.047, hy - 0.0062, tz - 0.0016), V3(-s * 0.059, hy - 0.016, tz - 0.0016)], (t) => 0.0016 - 0.0003 * t, { tubular: 16, radial: 8 }));
  }
  frame.push(tube([V3(-(cx - R * Math.cos(0.55)), R * Math.sin(0.55), 0), V3(0, R * Math.sin(0.55) + 0.0028, -0.0008), V3(cx - R * Math.cos(0.55), R * Math.sin(0.55), 0)], 0.00105, { tubular: 10, radial: 6 }));
  add(g, merge(frame), lib.gold, 'glassesFrame');
  add(g, merge(tips), pbr({ color: sc(0.16, 0.1, 0.07), roughness: 0.3 }), 'glassesTips');
  add(g, merge(pads), pbr({ color: sc(0.82, 0.82, 0.78), roughness: 0.3 }), 'glassesPads', { bakeOccluder: false });
  add(g, merge(lens), lib.lens, 'glassesLens').renderOrder = 7;
  // rests on the lower rims and the ear pieces
  const yb = -(R + tb), yt = R * Math.sin(0.42) - 0.016 - 0.0013, zt = -0.0064 - 0.0028 - 0.0016 - 0.0013;
  const al = Math.atan2(yb - yt, -zt);        // (negative) tilt that brings the rim bottoms and the ear-piece ends level
  g.userData.tilt = al; g.userData.lift = -(yb * Math.cos(al));
  return g;
}

function buildNightstand(ctx, lib) {
  const g = group('nightstand'), N = NIGHTSTAND, M = ctx.M;
  const tx0 = N.x0 + 0.01, tz0 = N.z0 + 0.015, tw = 0.4, td = 0.4, top = N.top, tt = 0.022;
  add(g, boxAt(tx0, top - tt, tz0, tw, tt, td, { r: 0.0045, rs: 3, maxEdge: 0.018 }), lib.oakH, 'nsTop');
  // aprons + lower shelf
  const ap = [], ah = 0.05, at = 0.016, ins = 0.032;
  ap.push(boxAt(tx0 + ins, top - tt - ah, tz0 + ins, tw - 2 * ins, ah, at, { r: 0.0015, maxEdge: 0.05 }), boxAt(tx0 + ins, top - tt - ah, tz0 + td - ins - at, tw - 2 * ins, ah, at, { r: 0.0015, maxEdge: 0.05 }));
  ap.push(boxAt(tx0 + ins, top - tt - ah, tz0 + ins, at, ah, td - 2 * ins, { r: 0.0015, maxEdge: 0.05 }), boxAt(tx0 + tw - ins - at, top - tt - ah, tz0 + ins, at, ah, td - 2 * ins, { r: 0.0015, maxEdge: 0.05 }));
  ap.push(boxAt(tx0 + 0.03, 0.15, tz0 + 0.03, tw - 0.06, 0.016, td - 0.06, { r: 0.003, rs: 2, maxEdge: 0.03 }));
  add(g, merge(ap), lib.oakH, 'nsRails');
  // four square legs with soft corners, splayed a touch
  const lw = 0.03, lh = top - 0.008;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = add(g, swapUV(roundedBox(lw, lh, lw, { r: 0.007, rs: 3, maxEdge: 0.06 }).translate(0, -lh / 2, 0)), lib.oakV, 'nsLeg');
    leg.position.set(tx0 + tw / 2 + sx * (tw / 2 - 0.036), top - 0.008, tz0 + td / 2 + sz * (td / 2 - 0.036));
    leg.rotation.set(-sz * 0.022, 0, sx * 0.022);
  }
  const Y = top + 0.0003, rn = new RNG(1733);
  // alarm clock, facing the room and turned a little towards the pillow
  const clock = buildClock(lib);
  clock.position.set(tx0 + 0.115, Y, tz0 + 0.085); clock.rotation.y = PI + 0.2;
  g.add(clock);
  // paperback, read: cracked spine, a card bookmark two thirds in, a hair tie left on the cover
  const cover = canvasMat(paintCover(311), 0.128, 0.196, { roughness: 0.62 });
  const plain = pbr({ color: sc(0.82, 0.79, 0.72), roughness: 0.7 });
  const book = makeBook(lib, { w: 0.128, d: 0.196, t: 0.021, cover: plain, top: cover, spine: canvasMat(paintSpine(313), 0.196, 0.021, { roughness: 0.62 }), name: 'paperback' });
  add(book, boxAt(0.052, 0.0128, -0.098 - 0.013, 0.034, 0.0004, 0.06, { r: 0.00015, rs: 1 }), pbr({ color: sc(0.74, 0.4, 0.3), roughness: 0.8 }), 'bookmark', { bakeOccluder: false });
  const elastic = pbr({ color: sc(0.72, 0.44, 0.4), roughness: 0.95, normalMap: lib.rep(lib.lacN, 400, 400), normalScale: new THREE.Vector2(0.8, 0.8) });
  add(g, hairTie(rn, 0.022, 0.0021, 0.88).rotateY(0.7).translate(tx0 + 0.353, Y, tz0 + 0.202), elastic, 'hairTieA');
  book.position.set(tx0 + 0.2, Y, tz0 + 0.27); book.rotation.y = 0.24;
  g.add(book);
  // glass of water left overnight: thick base, meniscus, small bubbles clinging to the wall
  const gl = group('waterGlass');
  const R1 = 0.0345, R0 = 0.0295, Hg = 0.105, wl = 0.0022, bs = 0.01, rAt = (y) => lerp(R0, R1, y / Hg);
  add(gl, lathe([[0, 0.0003], [R0 - 0.003, 0.0003], [R0, 0.003], [R1, Hg - 0.001], [R1 - wl / 2, Hg], [R1 - wl, Hg - 0.001], [rAt(bs + 0.004) - wl, bs + 0.004], [rAt(bs) - wl - 0.004, bs], [0, bs]], 48), lib.glass, 'glassBody').renderOrder = 7;
  add(gl, lathe([[0, 0.0014], [R0 - 0.0042, 0.0014], [R0 - 0.0026, 0.003], [rAt(bs) - 0.0026, bs - 0.0012], [rAt(bs) - 0.0045, bs - 0.0004], [0, bs - 0.0004]], 48), lib.glassThick, 'glassBase').renderOrder = 5;
  const wy = 0.068;
  add(gl, lathe([[0, bs + 0.0005], [rAt(bs) - wl - 0.0045, bs + 0.0005], [rAt(bs + 0.005) - wl - 0.0004, bs + 0.005], [rAt(wy) - wl - 0.0004, wy + 0.0011], [rAt(wy) - wl - 0.0012, wy + 0.0004], [rAt(wy) - wl - 0.0032, wy], [0, wy]], 48), lib.water, 'glassWater').renderOrder = 6;
  {
    const bub = [];
    for (let k = 0; k < 24; k++) {
      const low = k < 5, r = rn.range(0.00035, 0.0008), a = rn.range(0, 2 * PI), y = low ? bs + 0.0006 + r : rn.range(bs + 0.007, wy - 0.006);
      const rad = low ? rn.range(0.004, rAt(bs) - wl - 0.008) : rAt(y) - wl - 0.0004 - r * 0.85;
      bub.push(new THREE.SphereGeometry(r, 8, 6).translate(Math.cos(a) * rad, y, Math.sin(a) * rad));
    }
    add(gl, merge(bub), lib.glass, 'glassBubbles', { bakeOccluder: false }).renderOrder = 6;
  }
  gl.position.set(tx0 + 0.315, Y, tz0 + 0.095);
  g.add(gl);
  // lip balm standing by the clock
  {
    const lb = group('lipBalm'), cv = paintBalm();
    add(lb, merge([
      lathe([[0, 0], [0.0088, 0], [0.0094, 0.0006], [0.0094, 0.0052], [0.009, 0.0056], [0.009, 0.0062], [0.0094, 0.0066], [0.0094, 0.0505], [0, 0.0505]], 28),
    ]), pbr({ color: sc(0.93, 0.91, 0.87), roughness: 0.42 }), 'balmBody');
    add(lb, bandY(0.00948, 0.0072, 0.05, 40), canvasMat(cv, 1, 1, { roughness: 0.48 }), 'balmLabel', { bakeOccluder: false });
    add(lb, lathe([[0.0092, 0.0505], [0.0101, 0.0509], [0.0101, 0.0662], [0.0094, 0.0678], [0.006, 0.0684], [0, 0.0684]], 28), pbr({ color: sc(0.95, 0.9, 0.84), roughness: 0.36 }), 'balmCap');
    lb.position.set(tx0 + 0.238, Y, tz0 + 0.1); lb.rotation.y = 2.2;
    g.add(lb);
  }
  // second hair tie on the table, and the glasses next to the book
  add(g, hairTie(rn, 0.025, 0.002, 0.92).translate(tx0 + 0.062, Y, tz0 + 0.175), pbr({ color: sc(0.07, 0.07, 0.075), roughness: 0.95, normalMap: lib.rep(lib.lacN, 400, 400), normalScale: new THREE.Vector2(0.8, 0.8) }), 'hairTieB');
  const gls = buildGlasses(lib);
  gls.rotation.set(gls.userData.tilt, PI + 0.35, 0, 'YXZ'); gls.position.set(tx0 + 0.098, Y + gls.userData.lift, tz0 + 0.292);
  g.add(gls);
  ctx.colliders.push({ min: [N.x0, 0, N.z0], max: [N.x1, top, N.z1] });
  return g;
}

// ================================================================== RUG
function rugMaterial() {
  // looped wool: rows of loops, every loop with its own height and twist
  const N = 1024, rows = 80, cols = 44, base = [0.925, 0.86, 0.73];
  const Hf = new Float32Array(N * N), col = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    const v = y / N, r = Math.floor(v * rows), fy = v * rows - r, offr = hash2(r, 11, 5), dir = r & 1 ? 1 : -1;
    for (let x = 0; x < N; x++) {
      const uu = (x / N) * cols + offr, c = Math.floor(uu), fx = uu - c, cm = c % cols;
      const h1 = hash2(cm, r, 21), h2 = hash2(cm, r, 37);
      const ex = (fx - 0.5) * 2, ey = (fy - 0.5) * 2;
      const b = Math.sqrt(Math.max(0, 1 - ex * ex * 0.95) * Math.max(0, 1 - ey * ey * 0.9)) * (0.62 + 0.38 * h1);
      const tw = 0.5 + 0.5 * Math.sin((fx * 3.2 + fy * 1.4 * dir) * 6.2831);   // yarn twist
      const hgt = b * (0.8 + 0.2 * tw) + (hash2(x, y, 3) - 0.5) * 0.07;
      const i = y * N + x; Hf[i] = hgt;
      const k = (0.66 + 0.34 * hgt + (h2 - 0.5) * 0.06) * (h2 > 0.94 ? 0.9 : 1);
      col[i * 4] = clamp(base[0] * k) * 255; col[i * 4 + 1] = clamp(base[1] * k * (0.985 + 0.015 * hgt)) * 255; col[i * 4 + 2] = clamp(base[2] * k * (0.95 + 0.05 * hgt)) * 255; col[i * 4 + 3] = 255;
    }
  }
  const rp = [2.5, 2.5];
  const m = pbr({
    map: dataTex(col, N, N, { srgb: true, repeat: rp }), normalMap: dataTex(normalBytes(Hf, N, N, 3.6), N, N, { repeat: rp }), normalScale: new THREE.Vector2(1, 1),
    roughness: 1, vertexColors: true, sheen: 0.45, sheenRoughness: 0.85, sheenColor: sc(0.92, 0.87, 0.78),
  }, { phys: true, bake: { albedo: base.map((c) => lin(c) * 0.8) } });
  return m;
}

function buildRug() {
  const g = group('rug'), { x0, x1, z0, z1 } = RUG, th = 0.012, rr = 0.011;
  const edge = [0, 0.003, 0.007, 0.012, 0.02, 0.034];
  const axis = (a, b) => {
    const out = edge.map((e) => a + e), lo = a + edge[edge.length - 1], hi = b - edge[edge.length - 1], n = Math.ceil((hi - lo) / 0.036);
    for (let k = 1; k < n; k++) out.push(lo + ((hi - lo) * k) / n);
    for (let k = edge.length - 1; k >= 0; k--) out.push(b - edge[k]);
    return out;
  };
  const xs = axis(x0, x1), zs = axis(z0, z1), nx = xs.length - 1, nz = zs.length - 1;
  // a slight ripple where the rug was pushed up by a chair leg: a low ridge running askew near the desk end
  const rc = Math.cos(0.42), rs = Math.sin(0.42);
  const P = (x, z, p, up) => {
    const e = Math.min(x - x0, x1 - x, z - z0, z1 - z);
    const prof = e >= rr ? 1 : Math.sqrt(1 - (1 - e / rr) ** 2);
    const inner = smoothstep(0.02, 0.2, e);
    const lift = 0.0045 * Math.exp(-(((x - x0) ** 2 + (z1 - z) ** 2) / (0.09 * 0.09)));     // one corner never lies quite flat
    const dx = x - 3.08, dz = z - 1.66, al = dx * rc + dz * rs, ac = -dx * rs + dz * rc;
    const ripple = 0.0058 * Math.exp(-((ac / 0.05) ** 2)) * Math.exp(-((al / 0.3) ** 2)) * inner;
    p.x = x + 0.005 * (fbm2(z * 1.1 + 3.3, x * 0.25, { oct: 2, seed: 61 }) - 0.5) * 2;
    p.z = z + 0.005 * (fbm2(x * 1.1 + 8.1, z * 0.25, { oct: 2, seed: 67 }) - 0.5) * 2;
    p.y = 0.0006 + th * prof * (0.95 + 0.1 * fbm2(x * 6, z * 6, { oct: 2, seed: 71 })) + inner * 0.0016 * (fbm2(x * 2.2, z * 2.2, { oct: 2, seed: 73 }) - 0.4) + lift + ripple + up;
    p.u = p.x; p.v = p.z;
    p.c = (0.9 + 0.1 * fbm2(x * 1.6 + 1.7, z * 1.6, { oct: 3, seed: 79 })) * (0.93 + 0.07 * smoothstep(0, 0.03, e));
  };
  add(g, gridGeo(nx, nz, (i, j, p) => P(xs[i], zs[j], p, 0), { flip: true, colors: true }), rugMaterial(), 'rug', { bakeOccluder: false });
  // bound edge: a woven cotton tape folded round the rim and sewn down, 12 mm wide
  const tape = fabric(sc(0.76, 0.7, 0.6), { slub: 0.6, rep: 30, nscale: 0.9, sheen: 0.15 });
  const up = 0.0005, strips = [];
  strips.push(gridGeo(3, nz, (i, j, p) => P(xs[i], zs[j], p, up), { flip: true }), gridGeo(3, nz, (i, j, p) => P(xs[nx - 3 + i], zs[j], p, up), { flip: true }));
  strips.push(gridGeo(nx, 3, (i, j, p) => P(xs[i], zs[j], p, up), { flip: true }), gridGeo(nx, 3, (i, j, p) => P(xs[i], zs[nz - 3 + j], p, up), { flip: true }));
  add(g, merge(strips), tape, 'rugBinding', { bakeOccluder: false });
  return g;
}

// ================================================================== CEILING LIGHT (off)
/** Rice paper for the globe: long fibres, the glued seam of a gore (at u = 0) and four spiral ribs per tile. */
function paperMaps() {
  const N = 512, c = makeCanvas(N, N), x = c2d(c), rng = new RNG(5113);
  x.fillStyle = '#eeebe2'; x.fillRect(0, 0, N, N);
  x.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const px = rng.range(0, N), py = rng.range(0, N), l = rng.range(10, 70), a = rng.range(0, 2 * PI);
    x.lineWidth = rng.range(0.5, 1.4); x.strokeStyle = rng.chance(0.6) ? `rgba(255,255,255,${rng.range(0.25, 0.6).toFixed(2)})` : `rgba(150,140,118,${rng.range(0.08, 0.2).toFixed(2)})`;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + rng.range(-12, 12), py + Math.sin(a) * l * 0.5 + rng.range(-12, 12), px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  x.fillStyle = 'rgba(120,112,96,0.12)'; x.fillRect(0, 0, 14, N);
  x.fillStyle = 'rgba(96,90,78,0.2)'; x.fillRect(13, 0, 1.5, N);
  for (let k = 0; k <= 4; k++) {
    const y = (k * N) / 4;
    x.fillStyle = 'rgba(110,104,90,0.07)'; x.fillRect(0, y - 8, N, 16);
    x.fillStyle = 'rgba(92,86,74,0.3)'; x.fillRect(0, y - 1.7, N, 3.4);
  }
  const Hf = field(N, N, (u, v) => {
    const dv = Math.abs(v * 4 - Math.round(v * 4)) / 4;
    return 0.9 * Math.exp(-((dv / 0.006) ** 2)) + (u < 14 / N ? 0.22 : 0) + 0.2 * pn(u * 64, v * 64, 64, 64) + 0.12 * pn(u * 16, v * 128, 16, 128);
  });
  const d = x.getImageData(0, 0, N, N).data;
  return { map: canvasTex(c, { srgb: true }), normalMap: dataTex(normalBytes(Hf, N, N, 2.2), N, N, {}), avg: avgColor(d) };
}

function buildCeilingLight(ctx, lib) {
  const M = ctx.M, g = group('ceilingLight');
  const cx = 2.4, cz = 2.0, R = 0.17, cy = 2.075, ribs = 20;
  const t0 = Math.asin(0.045 / R), t1 = PI - Math.asin(0.06 / R);
  const nu = 64, nv = ribs * 4;
  const globe = gridGeo(nu, nv, (i, j, p) => {
    const a = (i / nu) * 2 * PI, t = j / nv, th = lerp(t0, t1, t);
    const sag = Math.sin(PI * ribs * t) ** 2;
    const r = R * (1 - 0.015 * sag) * (1 + 0.006 * (fbm2(Math.cos(a) * 1.5 + 4, t * 5 + Math.sin(a) * 1.5, { oct: 2, seed: 91 }) - 0.5));
    p.x = cx + r * Math.sin(th) * Math.cos(a); p.z = cz + r * Math.sin(th) * Math.sin(a); p.y = cy + r * Math.cos(th);
    p.u = a * R; p.v = th * R;
  }, { closedU: true });
  const pm = paperMaps(), prx = 8 / (2 * PI * R), pry = ribs / (4 * R * (t1 - t0)), poy = -t0 * R * pry;
  const paper = pbr({ map: lib.rep(pm.map, prx, pry, 0, poy), normalMap: lib.rep(pm.normalMap, prx, pry, 0, poy), roughness: 0.92, side: THREE.DoubleSide, normalScale: new THREE.Vector2(0.55, 0.55) },
    { back: true, trans: new THREE.Color(0.5, 0.49, 0.45), bake: { albedo: pm.avg, trans: 0.4, transColor: [0.8, 0.78, 0.72], twoSided: true } });
  add(g, globe, paper, 'lampGlobe');
  const yT = cy + R * Math.cos(t0), yB = cy + R * Math.cos(t1);
  const hw = [
    new THREE.TorusGeometry(0.045, 0.0013, 6, 36).rotateX(PI / 2).translate(cx, yT, cz),
    new THREE.TorusGeometry(0.06, 0.0013, 6, 40).rotateX(PI / 2).translate(cx, yB, cz),
    lathe([[0, 2.467], [0.012, 2.467], [0.04, 2.476], [0.047, 2.492], [0.047, 2.5]], 28).translate(cx, 0, cz),
    tube([V3(cx, 2.47, cz), V3(cx + 0.0015, 2.36, cz + 0.001), V3(cx, yT - 0.012, cz)], 0.0023, { tubular: 10, radial: 8 }),
    lathe([[0, yT - 0.07], [0.016, yT - 0.07], [0.02, yT - 0.064], [0.02, yT - 0.02], [0.012, yT - 0.01], [0, yT - 0.01]], 20).translate(cx, 0, cz),
    // wire spreader holding the shade open
    tube([V3(cx - 0.045, yT, cz), V3(cx - 0.03, yT - 0.03, cz), V3(cx - 0.02, yT - 0.05, cz)], 0.001, { tubular: 6, radial: 5 }),
    tube([V3(cx + 0.045, yT, cz), V3(cx + 0.03, yT - 0.03, cz), V3(cx + 0.02, yT - 0.05, cz)], 0.001, { tubular: 6, radial: 5 }),
  ];
  add(g, merge(hw), M.plasticWhite, 'lampHardware', { bakeOccluder: false });
  add(g, new THREE.SphereGeometry(0.03, 20, 14).scale(1, 1.15, 1).translate(cx, yT - 0.1, cz), pbr({ color: sc(0.88, 0.88, 0.86), roughness: 0.35 }), 'lampBulb');
  return g;
}

// ================================================================== WINDOWSILL
function paintLabel() {
  const W = 640, H = 352, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(4407);
  x.fillStyle = '#ebe6d9'; x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.05; for (let i = 0; i < 2600; i++) { x.fillStyle = rng.chance(0.5) ? '#6b5a3c' : '#ffffff'; x.fillRect(rng.range(0, W), rng.range(0, H), rng.range(1, 4), 1); }
  x.globalAlpha = 1;
  x.strokeStyle = '#3a3a38'; x.lineWidth = 2.4; x.strokeRect(20, 20, W - 40, H - 40); x.lineWidth = 1; x.strokeRect(27, 27, W - 54, H - 54);
  x.fillStyle = '#2e2e2c'; x.textAlign = 'center';
  x.font = '26px Georgia, serif'; x.fillText('N o .  1 2', W / 2, 92);
  x.font = '600 44px Georgia, serif'; x.fillText('F I G  &  C E D A R', W / 2, 172);
  x.fillRect(W / 2 - 60, 198, 120, 1.5);
  x.font = 'italic 27px Georgia, serif'; x.fillText('soy wax candle  ·  180 g', W / 2, 246);
  x.font = '15px Georgia, serif'; x.fillText('P O U R E D   B Y   H A N D    ·    B U R N S   4 0   H', W / 2, 298);
  return c;
}
function paintMatchbox() {
  const W = 424, H = 288, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(977);
  x.fillStyle = '#c8933c'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#263645'; x.lineWidth = 5; x.strokeRect(16, 16, W - 32, H - 32);
  // sun rising behind two hills
  x.save(); x.beginPath(); x.rect(40, 40, 150, H - 80); x.clip();
  x.fillStyle = '#f0e2c0'; x.beginPath(); x.arc(115, 172, 52, 0, 2 * PI); x.fill();
  x.fillStyle = '#263645'; x.beginPath(); x.moveTo(40, 250); x.lineTo(40, 215); x.quadraticCurveTo(95, 150, 150, 214); x.quadraticCurveTo(170, 190, 190, 204); x.lineTo(190, 250); x.closePath(); x.fill();
  x.restore();
  x.fillStyle = '#263645'; x.textAlign = 'left';
  x.font = '700 60px Georgia, serif'; x.fillText('fyrke', 206, 128);
  x.font = '600 19px "Trebuchet MS", Arial, sans-serif'; x.fillText('SAFETY  MATCHES', 210, 166);
  x.font = '17px "Trebuchet MS", Arial, sans-serif'; x.fillText('45 sticks · strike gently', 210, 196);
  x.font = 'italic 16px Georgia, serif'; x.fillText('keep dry', 210, 236);
  // scuffed edges
  x.globalAlpha = 0.28; x.fillStyle = '#eadcc0';
  for (let i = 0; i < 260; i++) {
    const e = rng.int(0, 3), t = rng.next();
    const px = e < 2 ? t * W : (e === 2 ? rng.range(0, 7) : W - rng.range(0, 7)), py = e === 0 ? rng.range(0, 7) : e === 1 ? H - rng.range(0, 7) : t * H;
    x.fillRect(px, py, rng.range(1, 5), rng.range(1, 3));
  }
  x.globalAlpha = 1;
  return c;
}
function paintDustStrip() {   // white = dust; the bottom of the canvas is the back of the sill
  const W = 1024, H = 128, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(3391);
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.04)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0.24)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 5200; i++) { const t = Math.pow(rng.next(), 0.55), a = (0.1 + 0.5 * rng.next()) * t; x.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; x.fillRect(rng.range(0, W), t * H, rng.range(0.6, 1.6), rng.range(0.6, 1.4)); }
  x.lineWidth = 0.8; x.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const px = rng.range(20, W - 20), py = H * (0.35 + 0.65 * Math.pow(rng.next(), 0.6)), l = rng.range(5, 20), a0 = rng.range(0, 2 * PI);
    x.strokeStyle = `rgba(255,255,255,${rng.range(0.25, 0.6).toFixed(2)})`;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a0) * l * 0.5 + rng.range(-4, 4), py + Math.sin(a0) * l * 0.25 + rng.range(-3, 3), px + Math.cos(a0) * l, py + Math.sin(a0) * l * 0.4); x.stroke();
  }
  return c;
}
function paintWaterRing() {   // tide mark where a wet pot once stood
  const N = 256, c = makeCanvas(N, N), x = c2d(c), rng = new RNG(1213);
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  x.translate(N / 2, N / 2);
  const gr = x.createRadialGradient(0, 0, 40, 0, 0, 94); gr.addColorStop(0, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, 'rgba(255,255,255,0.08)');
  x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 92, 0, 2 * PI); x.fill();
  for (let k = 0; k < 360; k++) {
    const a = (k / 360) * 2 * PI, a2 = ((k + 1.4) / 360) * 2 * PI;
    const R0 = 93 + 1.6 * Math.sin(a * 3 + 1) + 1.1 * Math.sin(a * 7), w = 1.2 + 1.5 * Math.max(0, Math.sin(a * 2 + 0.6)) + rng.range(0, 0.5);
    const al = 0.22 + 0.42 * Math.max(0, Math.sin(a + 2.2)) * (0.6 + 0.4 * rng.next());
    x.strokeStyle = `rgba(255,255,255,${al.toFixed(3)})`; x.lineWidth = w; x.beginPath(); x.arc(0, 0, R0, a, a2); x.stroke();
  }
  return c;
}
function paintDryLeaf() {
  const W = 256, H = 128, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(661);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#8d6b34'); g.addColorStop(0.5, '#a5833f'); g.addColorStop(1, '#6f4e27');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { x.fillStyle = rng.chance(0.5) ? 'rgba(70,45,22,0.18)' : 'rgba(196,166,88,0.16)'; x.beginPath(); x.ellipse(rng.range(0, W), rng.range(0, H), rng.range(4, 26), rng.range(3, 12), rng.range(0, 3), 0, 2 * PI); x.fill(); }
  const e = x.createLinearGradient(0, 0, 0, H); e.addColorStop(0, 'rgba(60,38,18,0.55)'); e.addColorStop(0.16, 'rgba(60,38,18,0)'); e.addColorStop(0.84, 'rgba(60,38,18,0)'); e.addColorStop(1, 'rgba(60,38,18,0.55)');
  x.fillStyle = e; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(66,44,20,0.55)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke();
  x.lineWidth = 1; x.strokeStyle = 'rgba(66,44,20,0.35)';
  for (let k = 1; k < 9; k++) for (const s of [-1, 1]) { const px = k * 27; x.beginPath(); x.moveTo(px, H / 2); x.quadraticCurveTo(px + 22, H / 2 + s * 26, px + 44, H / 2 + s * 60); x.stroke(); }
  return c;
}

function pouchGeo(cx, y0, cz) {
  const a = 0.085, b = 0.054, hgt = 0.112, n = 3.2, ribs = 38, nu = ribs * 4;
  // equal-arc-length parametrisation of the rounded-rectangle outline
  const T = 720, ox = [], oz = [], cum = [0];
  for (let k = 0; k <= T; k++) {
    const t = (k / T) * 2 * PI, c = Math.cos(t), s = Math.sin(t);
    ox.push(Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * a); oz.push(Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * b);
    if (k) cum.push(cum[k - 1] + Math.hypot(ox[k] - ox[k - 1], oz[k] - oz[k - 1]));
  }
  const per = cum[T], outline = [];
  for (let i = 0, k = 0; i <= nu; i++) {
    const target = (i / nu) * per; while (k < T - 1 && cum[k + 1] < target) k++;
    const f = clamp((target - cum[k]) / (cum[k + 1] - cum[k] || 1));
    outline.push([lerp(ox[k], ox[k + 1], f), lerp(oz[k], oz[k + 1], f)]);
  }
  outline[nu] = outline[0];
  // rows: [height fraction, outline scale, inward inset (m), rib strength, rim wobble weight]
  const rows = [[0, 0.9, 0, 0.2, 0], [0.012, 0.945, 0, 0.5, 0], [0.04, 0.965, 0, 0.9, 0.05]];
  for (let k = 1; k <= 8; k++) { const t = 0.04 + (0.94 * k) / 8; rows.push([t, 0.92 + 0.08 * Math.sin(PI * Math.min(1, 0.16 + 0.8 * t)), 0, 1, t]); }
  rows.push([1.012, 0.93, 0.0012, 0.8, 1], [1.018, 0.93, 0.0032, 0.4, 1], [1.012, 0.93, 0.0052, 0.5, 1], [0.97, 0.93, 0.006, 0.8, 1], [0.6, 0.95, 0.006, 0.8, 0.6], [0.2, 0.95, 0.006, 0.6, 0.2], [0.09, 0.9, 0.006, 0.2, 0.1], [0.085, 0.0001, 0, 0, 0.1]);
  let len = 0, prev = null;
  const vs = rows.map((r) => { const q = [r[1] * a - r[2], r[0] * hgt]; if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; return len; });
  return gridGeo(nu, rows.length - 1, (i, j, p) => {
    const q = i / nu, [t, s, inset, rib, wob] = rows[j], [px, pz] = outline[i];
    const rl = Math.hypot(px, pz) || 1, dx = px / rl, dz = pz / rl;
    const slump = 1 + 0.04 * Math.sin(q * 2 * PI * 2 + 0.8) * t + 0.02 * Math.sin(q * 2 * PI * 5 + 2.1) * t;
    const lean = 0.006 * Math.sin(t * 2.4 + q * 9) * Math.min(1, t);                       // ribs of a soft knit never run dead straight
    const off = -inset + rib * 0.0013 * Math.cos((q + lean) * 2 * PI * ribs);
    p.x = cx + px * s * slump + dx * off; p.z = cz + pz * s * slump + dz * off;
    p.y = y0 + t * hgt + wob * (0.0055 * Math.sin(q * 2 * PI * 2 + 1.1) + 0.003 * Math.sin(q * 2 * PI * 3 + 4));
    p.u = q * per; p.v = vs[j];
  }, { closedU: true, flip: true });
}

/** Jar candle that has been burnt a few evenings: set melt pool, charred wick, soot on the inside of the rim. */
function buildCandle(ctx, lib) {
  const jar = group('candleJar'), R = 0.036, Hh = 0.086, wall = 0.0032, base = 0.0095, rw = R - wall - 0.0004, yw = 0.049;
  add(jar, lathe([[0, base + 0.0002], [rw, base + 0.0002], [rw, yw + 0.0034]], 40), lib.wax, 'candleWax');
  const NU = 64, NR = 26;
  add(jar, gridGeo(NU, NR, (i, j, p) => {
    const a = (i / NU) * 2 * PI, r = rw * (1 - Math.pow(1 - j / NR, 1.25)), x = r * Math.cos(a), z = r * Math.sin(a);
    const rr = r * (1 + 0.1 * Math.sin(2 * a + 0.5) + 0.06 * Math.sin(3 * a + 2));
    const pool = 1 - smoothstep(0.0145, 0.022, rr), climb = smoothstep(rw - 0.0055, rw, r);
    p.x = x; p.z = z;
    p.y = yw - 0.0013 * pool + 0.0034 * climb * climb + 0.0009 * Math.exp(-((r / 0.0028) ** 2)) + 0.00035 * (fbm2(x * 260 + 3, z * 260, { oct: 2, seed: 17 }) - 0.5) * (1 - 0.6 * pool);
    p.u = x; p.v = z;
    const soot = Math.exp(-((r / 0.0048) ** 2)), speck = r < 0.016 && r > 0.001 && hash2(i * 7 + j * 131, j, 5) > 0.9 ? 0.28 * (1 - r / 0.016) : 0;
    p.c = (0.985 + 0.03 * climb - 0.04 * pool) * (1 - 0.6 * soot * (0.5 + 0.5 * vnoise2(x * 900, z * 900, 3))) - speck;
  }, { closedU: true, colors: true }), lib.waxTop, 'candleWaxTop');
  add(jar, merge([
    tube([V3(0, yw - 0.001, 0), V3(0.0004, yw + 0.003, 0.0002), V3(0.0016, yw + 0.0062, 0.0008), V3(0.0036, yw + 0.0078, 0.0016)], (t) => 0.00085 - 0.00025 * t, { tubular: 8, radial: 6 }),
    new THREE.SphereGeometry(0.0011, 8, 6).translate(0.0038, yw + 0.008, 0.0017),
  ]), lib.soot, 'candleWick', { bakeOccluder: false });
  // paper label
  const lw = R + 0.00035, la = 0.95;
  const labelGeo = gridGeo(24, 3, (i, j, p) => { const a = lerp(-la, la, i / 24); p.x = lw * Math.sin(a); p.z = lw * Math.cos(a); p.y = lerp(0.02, 0.058, j / 3); p.u = i / 24; p.v = j / 3; });
  add(jar, labelGeo, canvasMat(paintLabel(), 1, 1, { roughness: 0.78 }), 'candleLabel', { bakeOccluder: false });
  // soot film inside the rim, heavier on one side
  const sootTex = colorTex(128, 64, (u, v) => [0.1, 0.09, 0.08, Math.pow(v, 1.7) * 0.5 * (0.3 + 0.7 * pn(u * 8 + 3, v * 3, 8))], { wrap: true });
  add(jar, bandY(R - wall - 0.00025, Hh - 0.034, Hh - 0.0025, 44), decalMat(sootTex, { side: THREE.DoubleSide, roughness: 0.9 }), 'candleSoot', { bakeOccluder: false }).renderOrder = 5;
  // thick pressed-glass base, then the jar itself
  add(jar, lathe([[0, 0.0012], [R - 0.0038, 0.0012], [R - 0.0034, 0.0016], [R - 0.0034, base - 0.0012], [R - 0.0045, base - 0.0006], [0, base - 0.0006]], 44), lib.glassThick, 'candleGlassBase').renderOrder = 6;
  add(jar, lathe([[0, 0.0003], [R - 0.003, 0.0003], [R, 0.003], [R, Hh - 0.0015], [R - wall / 2, Hh], [R - wall, Hh - 0.0015], [R - wall, base + 0.003], [R - wall - 0.003, base], [0, base]], 44), lib.glass, 'candleGlass').renderOrder = 7;
  return jar;
}

/** Box of matches, tray pushed a little way out. Local frame: length along x, standing on y = 0. */
function buildMatchbox(lib) {
  const g = group('matchbox'), L = 0.053, Wd = 0.0355, Hh = 0.0152, t = 0.0006, out = 0.0125, rng = new RNG(5151);
  const B = { r: 0.00022, rs: 1, maxEdge: 0.03 };
  const card = pbr({ color: sc(0.74, 0.55, 0.26), roughness: 0.8 });
  const striker = pbr({ color: sc(0.2, 0.12, 0.1), roughness: 1, normalMap: lib.rep(lib.lacN, 220, 220), normalScale: new THREE.Vector2(1.2, 1.2) });
  const board = pbr({ color: sc(0.74, 0.7, 0.62), roughness: 0.9 });
  add(g, boxAt(-L / 2, Hh - t, -Wd / 2, L, t, Wd, B), canvasMat(paintMatchbox(), L, Wd, { roughness: 0.62 }), 'matchboxTop');
  add(g, boxAt(-L / 2, 0, -Wd / 2, L, t, Wd, B), card, 'matchboxBase');
  add(g, merge([boxAt(-L / 2, t, -Wd / 2, L, Hh - 2 * t, t, B), boxAt(-L / 2, t, Wd / 2 - t, L, Hh - 2 * t, t, B)]), striker, 'matchboxStriker');
  const tl = L - 0.001, tw = Wd - 2 * t - 0.0005, th = Hh - 2 * t - 0.0004, tx = -tl / 2 + out, ty = t + 0.0002, tz = -tw / 2, bt = 0.0005;
  add(g, merge([
    boxAt(tx, ty, tz, tl, bt, tw, B), boxAt(tx, ty, tz, tl, th, bt, B), boxAt(tx, ty, tz + tw - bt, tl, th, bt, B),
    boxAt(tx, ty, tz, bt, th, tw, B), boxAt(tx + tl - bt, ty, tz, bt, th, tw, B),
  ]), board, 'matchboxTray');
  const sticks = [boxAt(tx + 0.001, ty + bt, tz + 0.001, tl - 0.002, th - 0.0048, tw - 0.002, { r: 0.0003, rs: 1 })], heads = [];
  const xh = tx + tl - 0.0042, ys = ty + th - 0.0027, nM = 12;
  for (let k = 0; k < nM; k++) {
    const z = tz + 0.0024 + (k * (tw - 0.0048)) / (nM - 1) + rng.range(-0.0002, 0.0002), y = ys + rng.range(-0.0005, 0.0004), yaw = rng.range(-0.012, 0.012), dx = rng.range(-0.0012, 0.0003);
    sticks.push(roundedBox(0.043, 0.0021, 0.0021, { r: 0.0003, rs: 1 }).rotateX(rng.range(0, 1.5)).rotateY(yaw).translate(xh - 0.0215 + dx, y, z));
    heads.push(new THREE.SphereGeometry(0.00155, 10, 8).scale(1.45, 1, 1).translate(xh + dx - 0.0004, y, z - yaw * 0.021));
  }
  add(g, merge(sticks), pbr({ color: sc(0.86, 0.78, 0.6), roughness: 0.85 }), 'matchSticks');
  add(g, merge(heads), pbr({ color: sc(0.5, 0.13, 0.1), roughness: 0.75 }), 'matchHeads', { bakeOccluder: false });
  return g;
}

/** Small glazed dish with a ring and two hair grips. */
function buildDish(lib) {
  const g = group('trinketDish'), rng = new RNG(88);
  const speck = colorTex(256, 256, (u, v, x, y) => {
    const s = hash2(x, y, 3), t = pn(u * 96, v * 96, 96, 96), k = 0.97 + 0.05 * pn(u * 12, v * 12, 12, 12);
    return s > 0.985 && t > 0.45 ? [0.5, 0.4, 0.3] : [0.9 * k, 0.875 * k, 0.81 * k];
  }, { repeat: [5, 2] });
  const glaze = pbr({ map: speck, roughness: 0.22, normalMap: lib.rep(lib.lacN, 3, 3), normalScale: new THREE.Vector2(0.12, 0.12) }, { bake: { albedo: [0.76, 0.72, 0.6] } });
  const yf = 0.0038;   // inside floor
  add(g, lathe([[0, 0.0006], [0.022, 0.0006], [0.0245, 0], [0.0262, 0.0002], [0.027, 0.0018], [0.0375, 0.0082], [0.0402, 0.0122], [0.0404, 0.0132], [0.0398, 0.0137], [0.039, 0.0131], [0.0362, 0.009], [0.027, 0.0047], [0.02, yf], [0, yf]], 56), glaze, 'dish');
  add(g, new THREE.TorusGeometry(0.0088, 0.00085, 10, 44).rotateX(PI / 2).translate(-0.007, yf + 0.00085, 0.0085), lib.gold, 'dishRing', { bakeOccluder: false });
  const pin = () => {
    const pts = [V3(-0.021, 0, 0), V3(-0.007, 0, 0), V3(0.007, 0, 0), V3(0.0195, 0, 0), V3(0.0213, 0, 0.0011), V3(0.0195, 0, 0.0023)];
    for (let k = 1; k <= 12; k++) { const u = k / 12; pts.push(V3(0.0195 - u * 0.039, 0, 0.0023 + 0.0007 * Math.sin(u * PI * 6) * (u < 0.9 ? 1 : 0) + 0.0006 * u)); }
    return merge([tube(pts, 0.00042, { tubular: 60, radial: 5 }), new THREE.SphereGeometry(0.0008, 8, 6).translate(-0.021, 0, 0), new THREE.SphereGeometry(0.0008, 8, 6).translate(-0.0195, 0, 0.0029)]);
  };
  const pins = [pin().rotateY(0.5 + rng.range(-0.1, 0.1)).translate(0.004, yf + 0.0005, -0.006), pin().rotateZ(0.035).rotateY(-0.9).translate(0.0015, yf + 0.0013, -0.001)];
  add(g, merge(pins), pbr({ color: sc(0.1, 0.075, 0.06), roughness: 0.34, metalness: 0.7 }), 'dishPins', { bakeOccluder: false });
  return g;
}

function buildSill(ctx, lib) {
  const g = group('sillThings'), Y = 0.8623, M = ctx.M;
  // ---- ribbed cream fabric pouch (far left, out of the way)
  const pouchMat = fabric(sc(0.875, 0.845, 0.775), { slub: 0.6, rep: 14, nscale: 1.0, sheen: 0.3 });
  add(g, pouchGeo(0.985, Y, -0.046), pouchMat, 'sillPouch');
  // ---- candle, the matches that light it, one spent match
  const jar = buildCandle(ctx, lib);
  jar.position.set(1.19, Y, -0.048); jar.rotation.y = -0.25;
  g.add(jar);
  const mb = buildMatchbox(lib);
  mb.position.set(1.288, Y, -0.004); mb.rotation.y = 0.5;
  g.add(mb);
  {
    const sm = group('spentMatch');
    add(sm, tube([V3(0, 0, 0), V3(0.012, 0, 0.0005), V3(0.0245, 0.0002, 0.0002)], 0.00105, { tubular: 6, radial: 6 }), pbr({ color: sc(0.84, 0.75, 0.57), roughness: 0.85 }), 'matchWood', { bakeOccluder: false });
    add(sm, merge([
      tube([V3(0.024, 0.0002, 0.0002), V3(0.031, 0.0007, -0.0008), V3(0.0368, 0.0021, -0.0022), V3(0.0402, 0.0037, -0.003)], (t) => 0.001 - 0.0004 * t, { tubular: 10, radial: 6 }),
      new THREE.SphereGeometry(0.00105, 8, 6).scale(1.3, 1, 1).translate(0.0406, 0.0039, -0.0031),
    ]), lib.soot, 'matchChar', { bakeOccluder: false });
    sm.position.set(1.158, Y + 0.00105, 0.004); sm.rotation.y = -0.38;
    g.add(sm);
  }
  // ---- small dish with a ring and hair grips
  const dish = buildDish(lib);
  dish.position.set(1.395, Y, -0.062); dish.rotation.y = 0.8;
  g.add(dish);
  // ---- what the plant leaves behind: a dry fallen leaf, crumbs of potting soil, the tide mark of an old watering
  {
    const len = 0.05, NU = 16, NH = 5, cv = paintDryLeaf();
    const wf = (u) => 0.0165 * Math.pow(Math.sin(PI * Math.pow(u, 0.75)), 0.85) * (1 - 0.2 * u) + 0.0004;
    const leaf = gridGeo(NU, 2 * NH, (i, j, p) => {
      const u = i / NU, v = j / NH - 1, w = wf(u), q = Math.abs(v);
      p.x = u * len + 0.003 * v * v * (u - 0.3);
      p.z = v * w * (1 - 0.18 * q * q) + 0.004 * Math.sin(u * 2.6);
      p.y = 0.0004 + (0.0085 * Math.pow(q, 1.7) * (0.5 + 0.9 * u) + 0.007 * u * u * u + 0.0012 * (1 + Math.sin(u * 9 + v * 2.5))) * Math.min(1, w / 0.004);
      p.u = u; p.v = v * 0.5 + 0.5;
    }, { flip: true });
    const leafMat = pbr({ map: canvasTex(cv, { srgb: true, wrap: false }), roughness: 0.82, side: THREE.DoubleSide },
      { back: true, trans: new THREE.Color(0.1, 0.07, 0.025), bake: { albedo: avgColor(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data), trans: 0.1, transColor: [0.5, 0.35, 0.12], twoSided: true } });
    const lf = group('dryLeaf');
    add(lf, leaf, leafMat, 'leafBlade', { bakeOccluder: false });
    add(lf, tube([V3(0.001, 0.0008, 0), V3(-0.006, 0.0011, 0.0012), V3(-0.012, 0.0008, 0.003)], (t) => 0.0007 - 0.0002 * t, { tubular: 6, radial: 5 }), pbr({ color: sc(0.42, 0.3, 0.16), roughness: 0.8 }), 'leafStalk', { bakeOccluder: false });
    lf.position.set(1.832, Y, 0.012); lf.rotation.y = -0.55;
    g.add(lf);

    // soil crumbs (and the odd grain of perlite) in an arc in front of where the pot stands
    const cg = new THREE.IcosahedronGeometry(1, 0), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const k = 0.7 + 0.6 * hash2(Math.round(cp.getX(i) * 100), Math.round(cp.getY(i) * 100) + 31 * Math.round(cp.getZ(i) * 100), 7);
      cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k * 0.7, cp.getZ(i) * k);
    }
    cg.computeVertexNormals();
    const rc = new RNG(2929), nC = 38, crumbMat = pbr({ color: new THREE.Color(1, 1, 1), roughness: 1 }, { bake: { albedo: [0.03, 0.02, 0.015] } });
    const im = new THREE.InstancedMesh(cg, crumbMat, nC), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(0, 1, 0);
    const soil = sc(0.17, 0.125, 0.09), perlite = sc(0.82, 0.8, 0.74), tmpC = new THREE.Color();
    for (let k = 0; k < nC; k++) {
      const a = lerp(0.25, PI - 0.25, rc.next()) + (rc.chance(0.5) ? 0.12 : -0.12), rad = 0.078 + 0.05 * Math.pow(rc.next(), 1.6);
      const s = rc.range(0.0004, 0.0013) * (rc.chance(0.12) ? 1.6 : 1);
      q.setFromAxisAngle(up, rc.range(0, 2 * PI));
      m4.compose(V3(1.62 + Math.cos(a) * rad, Y + s * 0.6, -0.05 + Math.sin(a) * rad * 0.62), q, V3(s, s, s));
      im.setMatrixAt(k, m4);
      im.setColorAt(k, rc.chance(0.14) ? perlite : tmpC.copy(soil).multiplyScalar(rc.range(0.7, 1.3)));
    }
    im.name = 'soilCrumbs'; im.userData.giInstanced = true; im.userData.giNormal = V3(0, 1, 0); im.userData.giAnchor = V3(0, 1.3, 0); im.userData.bakeOccluder = false;
    g.add(im);

    const ring = add(g, gridPlane(0.1, 0.1, 0.025).rotateX(-PI / 2).translate(1.905, Y - 0.0001, -0.062), decalMat(alphaTex(paintWaterRing(), [150, 138, 120], { wrap: false, repeat: [10, 10] }), { roughness: 0.9 }), 'sillWaterRing', { bakeOccluder: false });
    ring.renderOrder = -1;
  }
  // ---- dust that gathers along the back of the sill, against the frame
  {
    const x0 = 0.57, x1 = 2.43, zf = -0.0735, zb = -0.1335;
    const dust = add(g, gridPlane(x1 - x0, zf - zb, 0.03).rotateX(-PI / 2).translate((x0 + x1) / 2, Y - 0.0001, (zf + zb) / 2), decalMat(alphaTex(paintDustStrip(), [172, 166, 156], { repeat: [1 / 0.5, 1 / (zf - zb)] })), 'sillDust', { bakeOccluder: false });
    dust.renderOrder = -1;
  }
  // ---- short stack of notebooks, spines to the room, a pencil left on top
  {
    const st = group('sillBooks');
    const cloth = fabric(sc(0.4, 0.44, 0.49), { slub: 0.6, rep: 26, nscale: 0.5, sheen: 0.2 });
    const kraft = pbr({ color: sc(0.62, 0.52, 0.4), roughness: 0.85, normalMap: lib.rep(lib.lacN, 30, 30), normalScale: new THREE.Vector2(0.3, 0.3) });
    const black = pbr({ color: sc(0.075, 0.08, 0.085), roughness: 0.55, normalMap: lib.rep(lib.lacN, 40, 40), normalScale: new THREE.Vector2(0.35, 0.35) });
    const specs = [
      { w: 0.152, d: 0.226, t: 0.017, cover: cloth, hard: true, name: 'bookA', x: 2.1, z: -0.036, ry: PI / 2 + 0.012 },
      { w: 0.148, d: 0.21, t: 0.0095, cover: kraft, name: 'bookB', x: 2.094, z: -0.034, ry: PI / 2 - 0.045 },
      { w: 0.13, d: 0.19, t: 0.0135, cover: black, hard: true, name: 'bookC', x: 2.108, z: -0.03, ry: PI / 2 + 0.11 },
    ];
    let y = Y;
    for (const s of specs) {
      const b = makeBook(lib, s);
      if (s.name === 'bookC') add(b, boxAt(s.w - 0.024, -0.0003, -s.d / 2 - 0.0003, 0.006, s.t + 0.0006, s.d + 0.0006, { r: 0.0003, rs: 1 }), M.rubber, 'bookBand');
      // local spine is at x = 0; centre the book on (x, z) before turning it
      const cxl = s.w / 2, c = Math.cos(s.ry), sn = Math.sin(s.ry);
      b.rotation.y = s.ry; b.position.set(s.x - cxl * c, y, s.z + cxl * sn);
      st.add(b); y += s.t + 0.0002;
    }
    // pencil: hexagonal, lacquered green, ferrule and eraser, sharpened by hand
    const pc = group('pencil'), pr = 0.0036;
    add(pc, flat(cylX(pr, -0.07, 0.056, 6)), pbr({ color: sc(0.15, 0.3, 0.24), roughness: 0.36 }), 'pencilBody');
    add(pc, merge([cylX(pr * 0.94, 0.056, 0.073, 14, 0.0011)]), pbr({ color: sc(0.83, 0.68, 0.48), roughness: 0.8 }), 'pencilCone', { bakeOccluder: false });
    add(pc, cylX(0.0011, 0.073, 0.0772, 10, 0.0003), pbr({ color: sc(0.12, 0.12, 0.125), roughness: 0.35, metalness: 0.3 }), 'pencilLead', { bakeOccluder: false });
    add(pc, merge([cylX(0.0037, -0.082, -0.07, 18), cylX(0.00385, -0.0795, -0.0785, 18), cylX(0.00385, -0.0735, -0.0725, 18)]), lib.gold, 'pencilFerrule', { bakeOccluder: false });
    add(pc, lathe([[0, 0], [0.0026, 0], [0.0034, 0.0009], [0.0034, 0.0075], [0, 0.0075]], 16).rotateZ(PI / 2).translate(-0.0816, 0, 0), pbr({ color: sc(0.8, 0.5, 0.47), roughness: 0.9 }), 'pencilEraser', { bakeOccluder: false });
    pc.position.set(2.118, y + pr * 0.866 + 0.0001, -0.018); pc.rotation.y = 0.19;
    st.add(pc);
    g.add(st);
  }
  return g;
}

// ================================================================== FRAMED PRINTS
function paintPrint(kind, seed) {
  const W = 720, H = 960, c = makeCanvas(W, H), x = c2d(c), rng = new RNG(seed);
  x.fillStyle = '#f0eee8'; x.fillRect(0, 0, W, H);                     // mount board
  const mx = W * 0.15, my = H * 0.135, aw = W - 2 * mx, ah = H - 2 * my;
  x.fillStyle = '#cbc8bf'; x.fillRect(mx - 3, my - 3, aw + 6, ah + 6);  // bevel cut of the mount
  x.save(); x.beginPath(); x.rect(mx, my, aw, ah); x.clip();
  if (kind === 0) {
    const gr = x.createLinearGradient(0, my, 0, my + ah); gr.addColorStop(0, '#e6dfd0'); gr.addColorStop(1, '#d6d2c8');
    x.fillStyle = gr; x.fillRect(mx, my, aw, ah);
    x.fillStyle = '#c9856a'; x.beginPath(); x.arc(mx + aw * 0.64, my + ah * 0.3, aw * 0.13, 0, 2 * PI); x.fill();
    const cols = ['#b7c1c4', '#8ea1aa', '#6c8490', '#4d6470', '#33454e'];
    cols.forEach((col, k) => {
      const yb = my + ah * (0.46 + k * 0.105), p1 = rng.range(0, 6), p2 = rng.range(0, 6), a1 = rng.range(14, 30), a2 = rng.range(6, 14);
      x.fillStyle = col; x.beginPath(); x.moveTo(mx, my + ah);
      for (let i = 0; i <= 60; i++) { const u = i / 60; x.lineTo(mx + u * aw, yb + Math.sin(u * 4.2 + p1) * a1 + Math.sin(u * 11 + p2) * a2); }
      x.lineTo(mx + aw, my + ah); x.closePath(); x.fill();
    });
  } else {
    x.fillStyle = '#e8e2d5'; x.fillRect(mx, my, aw, ah);
    x.fillStyle = '#8c997f'; x.beginPath(); x.moveTo(mx + aw * 0.14, my + ah * 0.92); x.lineTo(mx + aw * 0.14, my + ah * 0.5);
    x.arc(mx + aw * 0.36, my + ah * 0.5, aw * 0.22, PI, 0); x.lineTo(mx + aw * 0.58, my + ah * 0.92); x.closePath(); x.fill();
    x.fillStyle = '#c68868'; x.beginPath(); x.arc(mx + aw * 0.66, my + ah * 0.3, aw * 0.17, 0, 2 * PI); x.fill();
    x.fillStyle = '#3c495a'; x.beginPath(); x.arc(mx + aw * 0.7, my + ah * 0.78, aw * 0.2, PI, 2 * PI); x.closePath(); x.fill();
    x.strokeStyle = '#2d2d2b'; x.lineWidth = 2.2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(mx + aw * 0.3, my + ah * 0.95); x.bezierCurveTo(mx + aw * 0.34, my + ah * 0.7, mx + aw * 0.22, my + ah * 0.5, mx + aw * 0.33, my + ah * 0.16); x.stroke();
    for (let k = 0; k < 6; k++) {
      const u = 0.2 + k * 0.12, px = mx + aw * (0.31 - 0.05 * Math.sin(u * 3.4)), py = my + ah * (0.92 - u * 0.86), sg = k & 1 ? 1 : -1;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + sg * aw * 0.11, py - ah * 0.05, px + sg * aw * 0.15, py - ah * 0.012); x.quadraticCurveTo(px + sg * aw * 0.08, py + ah * 0.02, px, py); x.stroke();
    }
  }
  x.restore();
  x.globalAlpha = 0.035; for (let i = 0; i < 5000; i++) { x.fillStyle = rng.chance(0.5) ? '#000' : '#fff'; x.fillRect(rng.range(0, W), rng.range(0, H), 2, 2); }
  x.globalAlpha = 1;
  return c;
}

function buildPrints(ctx, lib) {
  const g = group('prints'), zW = 4.0, w = 0.3, h = 0.4, fw = 0.011, fd = 0.018;
  // picture glass: nothing but its reflection of the room (added on top of the print behind it)
  const pane = pbr({ color: new THREE.Color(0, 0, 0), roughness: 0.03, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.9 });
  pane.userData.bake = { ignore: true };
  [[0.64, 1.6, 0, 0.006], [1.04, 1.598, 1, -0.011]].forEach(([cx, cy, kind, tilt], k) => {
    const fr = group('print' + k);
    const B = { r: 0.0014, rs: 2, maxEdge: 0.08 };
    add(fr, merge([boxAt(-w / 2, h / 2 - fw, 0, w, fw, fd, B), boxAt(-w / 2, -h / 2, 0, w, fw, fd, B)]), lib.oakS, 'frameH', { bakeOccluder: false });
    add(fr, merge([swapUV(boxAt(-w / 2, -h / 2 + fw, 0, fw, h - 2 * fw, fd, B)), swapUV(boxAt(w / 2 - fw, -h / 2 + fw, 0, fw, h - 2 * fw, fd, B))]), lib.oakS, 'frameV', { bakeOccluder: false });
    const aw = w - 2 * fw + 0.002, ah = h - 2 * fw + 0.002;
    add(fr, gridPlane(aw, ah, 0.05).translate(0, 0, fd - 0.007), canvasMat(paintPrint(kind, 500 + k * 37), aw, ah, { roughness: 0.9 }), 'printArt', { bakeOccluder: false });
    add(fr, gridPlane(aw, ah, 0.05).translate(0, 0, fd - 0.0045), pane, 'printGlass', { bakeOccluder: false }).renderOrder = 4;
    fr.position.set(cx, cy, zW - 0.0004); fr.rotation.set(0, PI, tilt);
    g.add(fr);
  });
  return g;
}

// ================================================================== assemble
export function build(ctx) {
  const t0 = performance.now();
  const lib = makeLib(ctx.M);
  const root = group('fixtures');
  const tm = [`lib ${(performance.now() - t0).toFixed(0)}`];
  for (const [name, fn] of [['curtains', buildCurtains], ['radiator', buildRadiator], ['wardrobe', buildWardrobe], ['nightstand', buildNightstand], ['rug', buildRug], ['lamp', buildCeilingLight], ['sill', buildSill], ['prints', buildPrints]]) {
    const t1 = performance.now(); root.add(fn(ctx, lib)); tm.push(`${name} ${(performance.now() - t1).toFixed(0)}`);
  }
  ctx.colliders.push({ min: [RADIATOR.x0 - 0.14, 0, 0], max: [RADIATOR.x1 + 0.07, RADIATOR.y1 + 0.01, RADIATOR.z1 + 0.01] });
  let tris = 0;
  root.traverse((o) => { if (o.isMesh) tris += ((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1); });
  console.log(`[boot] fixtures: ${Math.round(tris / 1000)}k tris, ${(performance.now() - t0).toFixed(0)} ms (${tm.join(', ')})`);
  return root;
}
