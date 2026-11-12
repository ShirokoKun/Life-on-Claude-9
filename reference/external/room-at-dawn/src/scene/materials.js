// Material library. Every texture here is synthesised at load time from noise — no image files.
import * as THREE from 'three';
import { giPatch } from '../core/gi.js';
import { field, normalTex, packTex, colorTex, dataTex, normalData } from '../core/tex.js';
import { fbm2, vnoise2, worley2, hash2, smoothstep, lerp, clamp, RNG } from '../core/rng.js';

export const sc = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const lin = (c) => Math.pow(c, 2.2);

/** Standard PBR material wired to baked GI. extra: {phys, back, trans, box, onCompile, key, bake} */
export function pbr(params, extra = {}) {
  const m = extra.phys ? new THREE.MeshPhysicalMaterial(params) : new THREE.MeshStandardMaterial(params);
  giPatch(m, extra);
  if (extra.bake) m.userData.bake = extra.bake;
  return m;
}

const cache = new Map();
function once(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// ---------------------------------------------------------------- noise helpers local to this file
const LAT = new Float32Array(65536);
{ const r = new RNG(90210); for (let i = 0; i < 65536; i++) LAT[i] = r.next(); }
/** Fast value noise 0..1 (table lookup + smoothstep). Repeats every 256 lattice cells on both axes. */
function vn(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const x0 = ix & 255, x1 = (ix + 1) & 255, r0 = (iy & 255) << 8, r1 = ((iy + 1) & 255) << 8;
  const a = LAT[r0 | x0], b = LAT[r0 | x1], c = LAT[r1 | x0], d = LAT[r1 | x1];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
/** Same value noise as core/rng vnoise2, but tiling with separate (integer) periods along x and y. */
function pnoise(x, y, seed, px, py) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  let x0 = ix % px, y0 = iy % py; if (x0 < 0) x0 += px; if (y0 < 0) y0 += py;
  const x1 = x0 + 1 === px ? 0 : x0 + 1, y1 = y0 + 1 === py ? 0 : y0 + 1;
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm of pnoise (same octave layout as core/rng fbm2), tiling px x py base cells. */
function pfbm(x, y, oct, seed, px, py) {
  let a = 0.5, s = 0, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * pnoise(x * f, y * f, seed + i * 17, px * f, py * f); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
const sm01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** Height field -> RGBA8 tangent-space normals. H and the texel sizes px/py share one unit (mm). Wraps, rounds. */
function normalBytes(H, w, h, px, py) {
  const out = new Uint8Array(w * h * 4), kx = 0.5 / px, ky = 0.5 / py;
  for (let y = 0; y < h; y++) {
    const ym = (y === 0 ? h - 1 : y - 1) * w, yp = (y === h - 1 ? 0 : y + 1) * w, yo = y * w;
    for (let x = 0; x < w; x++) {
      const dx = (H[yo + (x === w - 1 ? 0 : x + 1)] - H[yo + (x === 0 ? w - 1 : x - 1)]) * kx, dy = (H[yp + x] - H[ym + x]) * ky;
      const il = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (yo + x) * 4;
      out[i] = (-dx * il * 0.5 + 0.5) * 255 + 0.5; out[i + 1] = (-dy * il * 0.5 + 0.5) * 255 + 0.5; out[i + 2] = (il * 0.5 + 0.5) * 255 + 0.5; out[i + 3] = 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------- shared detail maps
/** Woodchip wallpaper (Raufaser) under roller-applied paint. Tiles every 0.9 m. */
export function wallNormal() {
  return once('wallN', () => {
    const N = 1024, px = 900 / N;                       // mm per texel
    const A = new Float32Array(N * N), rng = new RNG(4711);
    // wood chips: small flat flakes lying at random angles, glued into the paper and rounded off by paint
    for (let i = 0; i < 13000; i++) {
      const cx = rng.range(0, N), cy = rng.range(0, N), ang = rng.range(0, Math.PI), size = rng.next(), big = size > 0.93;
      const a = (big ? rng.range(3.4, 5.4) : 1.2 + size * 2.5) / px, b = (big ? rng.range(1.3, 2.1) : rng.range(0.75, 1.5)) / px;
      const hgt = (big ? 0.5 : 0.25 + size * 0.16) * rng.range(0.7, 1.3), ca = Math.cos(ang), sa = Math.sin(ang), rad = Math.ceil(a) + 1;
      const x0 = Math.floor(cx), y0 = Math.floor(cy);
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const ox = x0 + dx + 0.5 - cx, oy = y0 + dy + 0.5 - cy;
        const lu = (ox * ca + oy * sa) / a, lv = (oy * ca - ox * sa) / b, q = 1 - lu * lu - lv * lv;
        if (q <= 0) continue;
        const hv = hgt * sm01(q / 0.6), k = (((y0 + dy) & 1023) << 10) | ((x0 + dx) & 1023);
        if (hv > A[k]) A[k] = hv;
      }
    }
    // the paint film bridges the sharp flake edges, then the roller leaves its own fine stipple on top
    const H = new Float32Array(N * N);
    const blurRow = (y) => {
      const ym = ((y + N - 1) & 1023) << 10, yo = y << 10, yp = ((y + 1) & 1023) << 10, v = y / N;
      for (let x = 0; x < N; x++) {
        const xm = (x + N - 1) & 1023, xp = (x + 1) & 1023, u = x / N;
        const s = (A[yo | x] * 4 + (A[yo | xm] + A[yo | xp] + A[ym | x] + A[yp | x]) * 2 + A[ym | xm] + A[ym | xp] + A[yp | xm] + A[yp | xp]) / 16;
        H[yo | x] = s + (vn(u * 256, v * 256) - 0.5) * 0.075 + (vn(u * 512 + 31.7, v * 512 + 11.3) - 0.5) * 0.04;
      }
    };
    for (let y = 0; y < N; y++) blurRow(y);
    return dataTex(normalBytes(H, N, N, px, px), N, N, {});
  });
}

/** Large-scale wall character, tile 3.2 m: RG = slope of the plaster surface (never truly flat),
 *  B = paint coverage (roller laps, slow clouding), A = sheen variation. All of it very subtle. */
function wallLowTex() {
  return once('wallLow', () => {
    const N = 256, px = 3200 / N, S = 0.03;             // mm per texel, slope that maps to full scale
    const h = new Float32Array(N * N), out = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = (pfbm((x / N) * 5, (y / N) * 5, 3, 61, 5, 5) - 0.5) * 7.0;   // mm
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = (y * N + x) * 4;
      const sx = (h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N]) / (2 * px), sy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) / (2 * px);
      const paint = 0.5 + (pfbm(u * 3, v * 3, 3, 71, 3, 3) - 0.5) * 1.1 + (pnoise(u * 11, v * 2, 73, 11, 2) - 0.5) * 0.45;
      const sheen = 0.5 + (pfbm(u * 4, v * 4, 3, 83, 4, 4) - 0.5) * 1.1 + (pnoise(u * 13, v * 2, 89, 13, 2) - 0.5) * 0.6;
      out[i] = (0.5 + clamp(sx / S, -1, 1) * 0.5) * 255 + 0.5; out[i + 1] = (0.5 + clamp(sy / S, -1, 1) * 0.5) * 255 + 0.5;
      out[i + 2] = clamp(paint) * 255 + 0.5; out[i + 3] = clamp(sheen) * 255 + 0.5;
    }
    return dataTex(out, N, N, { aniso: 2 });
  });
}
/** Shader hook for painted walls: bends the normal with the low-frequency plaster slope and lets paint
 *  coverage / sheen drift a little. rep = low-map tiles per normal-map tile, off = uv offset. */
function wallFx(rep, off, slope, paint, sheen) {
  const uni = { tWallLow: { value: wallLowTex() }, uWallLow: { value: new THREE.Vector4(rep, rep, off[0], off[1]) }, uWallAmp: { value: new THREE.Vector3(slope * 0.06, paint, sheen) } };
  return {
    key: 'wall',
    onCompile(shader) {
      Object.assign(shader.uniforms, uni);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tWallLow; uniform vec4 uWallLow; uniform vec3 uWallAmp;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef USE_NORMALMAP_TANGENTSPACE
{
	vec4 wl = texture2D( tWallLow, vNormalMapUv * uWallLow.xy + uWallLow.zw );
	normal = normalize( normal - ( tbn[0] * ( wl.x - 0.5 ) + tbn[1] * ( wl.y - 0.5 ) ) * uWallAmp.x );
	diffuseColor.rgb *= 1.0 + ( wl.z - 0.5 ) * uWallAmp.y;
	roughnessFactor = clamp( roughnessFactor + ( wl.w - 0.5 ) * uWallAmp.z, 0.05, 1.0 );
}
#endif`);
    },
  };
}

/** Very fine orange-peel for lacquered / powder-coated surfaces. */
export function lacquerNormal() {
  return once('lacN', () => {
    const N = 512;
    const H = field(N, N, (u, v) => fbm2(u * 64, v * 64, { oct: 3, seed: 21, period: 64 }));
    return normalTex(H, N, N, 1.4);
  });
}

/** Smudge / wear roughness variation, large scale. */
export function smudgeRough(base = 0.4, amp = 0.12) {
  return once('smudge' + base + amp, () => {
    const N = 512;
    const R = field(N, N, (u, v) => clamp(base + (fbm2(u * 6, v * 6, { oct: 5, seed: 33, period: 6 }) - 0.5) * 2 * amp + (fbm2(u * 90, v * 90, { oct: 2, seed: 35, period: 90 }) - 0.5) * amp * 0.5));
    return packTex(N, N, null, R, null);
  });
}

/** Window-sill laminate: satin-gloss melamine with a thin film of settled dust that thickens towards the
 *  frame. One tile = 1 m along the board (u) x 0.25 m across (v = 0 at the room-side nose). */
function sillRough() {
  return once('sillR', () => {
    const W = 1024, Hh = 256, R = new Float32Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / Hh, depth = v * 0.25;
      const back = sm01((depth - 0.035) / 0.13) * (1 - sm01((depth - 0.205) / 0.04));
      const cloud = pfbm(u * 6, v * 2, 4, 91, 6, 2), wipe = pnoise(u * 5, v * 9, 93, 5, 9);
      const g = vn(u * 512, v * 128), speck = g > 0.9 ? (g - 0.9) * 10 : 0;
      R[y * W + x] = clamp(0.25 + back * (0.03 + 0.085 * sm01((cloud - 0.38) / 0.3)) + (cloud - 0.5) * 0.04 + (wipe - 0.5) * 0.03 + speck * (0.06 + 0.14 * back));
    }
    return packTex(W, Hh, null, R, null, { repeat: [1, 4] });
  });
}

/** Plain-weave cloth normal map. `slub` adds linen-like thread irregularity. */
export function weaveNormal(slub = 0.3, strength = 2.0, threads = 96) {
  return once(`weave${slub}|${strength}|${threads}`, () => {
    const N = 512, T = threads;
    const H = field(N, N, (u, v) => {
      const x = u * T, y = v * T;
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const over = (ix + iy) & 1;                           // which thread is on top
      const wx = 0.75 + slub * (hash2(ix, 7, 1) - 0.5) * 1.6, wy = 0.75 + slub * (hash2(3, iy, 2) - 0.5) * 1.6;
      const tx = Math.max(0, 1 - Math.abs(fx - 0.5) * 2 / wx), ty = Math.max(0, 1 - Math.abs(fy - 0.5) * 2 / wy);
      const warp = Math.sqrt(tx) * (over ? 1 : 0.55) * (0.6 + 0.4 * Math.sin(fy * Math.PI));
      const weft = Math.sqrt(ty) * (over ? 0.55 : 1) * (0.6 + 0.4 * Math.sin(fx * Math.PI));
      return Math.max(warp, weft) + (vnoise2(u * 40, v * 40, 4, 40) - 0.5) * 0.25 * slub;
    });
    return normalTex(H, N, N, strength);
  });
}

// ---------------------------------------------------------------- floor
/** Oak laminate, single-strip planks 1.29 m x 0.19 m with a 4-sided micro-bevel, laid towards the window.
 *  One tile covers 2.28 m (12 plank widths, u) x 3.87 m (3 plank lengths, v); end joints are staggered. */
export function floorMaps() {
  return once('floor', () => {
    const N = 2048, ROWS = 12, LEN = 3, PW = 0.19, PL = 1.29;
    const TW = ROWS * PW, TL = LEN * PL, pxu = (TW / N) * 1000, pxv = (TL / N) * 1000;   // texel size in mm
    const H = new Float32Array(N * N), R = new Float32Array(N * N), col = new Uint8Array(N * N * 4);
    const rng = new RNG(77);
    // row offsets: every end joint at least ~35 cm from the joints of the neighbouring rows, no stair steps
    const cd = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
    const off = [];
    for (let r = 0; r < ROWS; r++) {
      let o = 0;
      for (let k = 0; k < 300; k++) {
        o = rng.next();
        if (r > 0 && cd(o, off[r - 1]) < 0.27) continue;
        if (r > 1 && cd(o, off[r - 2]) < 0.09) continue;
        if (r === ROWS - 1 && cd(o, off[0]) < 0.27) continue;
        if (r >= ROWS - 2 && cd(o, off[(r + 2) % ROWS]) < 0.09) continue;
        break;
      }
      off.push(o);
    }
    // every plank is its own print: cathedral (flat-sawn) or straight (rift) grain, own tone, own sheen
    const planks = [];
    for (let i = 0; i < ROWS * LEN; i++) {
      const cath = rng.chance(0.62), knot = rng.chance(0.14);
      planks.push({
        ox: rng.range(0, 256), oy: rng.range(0, 256),
        lum: clamp(rng.gauss() * 0.04, -0.085, 0.085), warm: rng.range(-1, 1),
        c0: cath ? rng.range(0.03, 0.16) : (rng.chance(0.5) ? rng.range(-0.5, -0.12) : rng.range(0.31, 0.7)),
        h0: cath ? rng.range(0.012, 0.05) : rng.range(0.0, 0.2),
        k: (cath ? rng.range(0.03, 0.085) : rng.range(0.0, 0.05)) * rng.sign(),
        rw: rng.range(0.0048, 0.0085), ring: rng.range(0.07, 0.13), gloss: rng.range(-0.03, 0.03),
        ks: rng.range(0.15, 1.14), kt: rng.range(0.045, 0.145), kr: knot ? rng.range(0.0045, 0.008) : 0.0,
      });
    }
    // slow gloss drift over the whole tile (cleaning, wear), tileable
    const WN = 256, wear = new Float32Array(WN * WN);
    for (let y = 0; y < WN; y++) for (let x = 0; x < WN; x++) wear[y * WN + x] = pfbm((x / WN) * 4, (y / WN) * 6, 4, 23, 4, 6);
    const tOf = new Float32Array(N), xStart = new Int32Array(ROWS + 1).fill(N);
    for (let x = N - 1; x >= 0; x--) { const a = (x / N) * ROWS, r = Math.floor(a); tOf[x] = (a - r) * PW; xStart[r] = x; }
    const B0 = 0.784, B1 = 0.679, B2 = 0.543, acc = new Float64Array(4);
    // one texture row (= one position along the planks) at a time, so the JIT sees a small hot function
    const fillRow = (y) => {
      const v = y / N, wy0 = y >> 3, wfy = (y & 7) / 8, wr0 = (wy0 & 255) * WN, wr1 = ((wy0 + 1) & 255) * WN, sample = (y & 7) === 0;
      for (let rI = 0; rI < ROWS; rI++) {
        const vv = v * LEN + off[rI], fl = Math.floor(vv), s = (vv - fl) * PL, P = planks[rI * LEN + (fl % LEN)];
        const b0 = P.h0 + P.k * (s - 0.645), b2 = b0 * b0, n1 = s * 2.6 + P.ox, n2 = s * 7 + P.ox, n3 = s * 23 + P.oy;
        const es = s < PL - s ? s : PL - s, gEnd = es < 0.0026 ? sm01((0.0026 - es) / 0.0019) : 0.0;
        const ds = s - P.ks, kr = P.kr, knot = kr > 0 && ds > -0.1 && ds < 0.1;
        const c0 = P.c0, oy = P.oy, ox = P.ox, irw = 1 / P.rw, ring = P.ring, lum = 1 + P.lum, warm = P.warm, gloss = 0.30 + P.gloss;
        const xb = xStart[rI + 1];
        for (let x = xStart[rI]; x < xb; x++) {
          const t = tOf[x], a0 = t - c0;
          const w1 = vn(n1, t * 22 + oy), fa = vn(n2, t * 260 + oy), fb = vn(n3, t * 700 + ox);
          // growth rings: distance from the pith of a log that runs slightly askew to the board
          let r = Math.sqrt(a0 * a0 + b2) + (w1 - 0.5) * 0.016 + (fa - 0.5) * 0.002;
          let kn = 0.0, kd = 0.0;
          if (knot) {
            const dt = t - P.kt;
            r += 2.4 * P.rw * Math.exp(-(ds * ds * 0.16 + dt * dt) / (kr * kr * 6));        // grain flows around the knot
            kd = Math.sqrt(ds * ds * 0.6 + dt * dt) / kr;
            if (kd < 1.3) kn = 1 - sm01((kd - 0.5) / 0.75);
          }
          const p0 = r * irw, p = p0 + 0.85 * vn(p0 * 0.31 + ox, oy + 7.3), f = p - Math.floor(p);   // good and lean years
          const dr = (f < 0.14 ? f / 0.14 : 1) * (1 - sm01((f - 0.18) / 0.6));            // porous earlywood band of each ring
          const pore = dr * (0.45 + fa);
          const g = (fa - 0.5) * 0.11 + (fb - 0.5) * 0.08 + (w1 - 0.5) * 0.09 - pore * ring;
          // micro-bevel on all four edges
          const et = t < PW - t ? t : PW - t;
          let gr = gEnd;
          if (et < 0.0017) { const g2 = sm01((0.0017 - et) / 0.0013); if (g2 > gr) gr = g2; }
          const L = lum * (1 + g) * (1 - kn * (0.34 + 0.07 * Math.sin(kd * 10))) * (1 - 0.42 * gr), dk = g < 0 ? -g : 0.0;
          let cr = B0 * L * (1 + 0.012 * warm), cg = B1 * L * (1 - 0.1 * dk - 0.04 * kn), cb = B2 * L * (1 - 0.28 * dk - 0.12 * kn - 0.03 * warm);
          if (cr > 1) cr = 1; if (cg > 1) cg = 1; if (cb > 1) cb = 1;
          const i = y * N + x, wx0 = x >> 3, wfx = (x & 7) / 8, wx1 = (wx0 + 1) & 255;
          const wa = wear[wr0 + wx0], wb = wear[wr1 + wx0], wt = wa + (wear[wr0 + wx1] - wa) * wfx, w = wt + (wb + (wear[wr1 + wx1] - wb) * wfx - wt) * wfy;
          H[i] = -0.32 * gr - 0.05 * pore - 0.03 * (1 - fb) - 0.03 * kn;                  // mm: bevel + embossed pores
          const rr = gloss + pore * 0.045 + (0.5 - fb) * 0.05 + (w - 0.5) * 0.16 + gr * 0.35 + kn * 0.06;
          R[i] = rr < 0.12 ? 0.12 : rr > 1 ? 1 : rr;
          const j = i * 4;
          col[j] = cr * 255 + 0.5; col[j + 1] = cg * 255 + 0.5; col[j + 2] = cb * 255 + 0.5; col[j + 3] = 255;
          if (sample && (x & 7) === 0) { acc[0] += lin(cr); acc[1] += lin(cg); acc[2] += lin(cb); acc[3]++; }
        }
      }
    };
    for (let y = 0; y < N; y++) fillRow(y);
    const rep = [1 / TW, 1 / TL];
    return {
      map: dataTex(col, N, N, { srgb: true, repeat: rep, aniso: 16 }),
      normalMap: dataTex(normalBytes(H, N, N, pxu, pxv), N, N, { repeat: rep, aniso: 16 }),
      roughnessMap: packTex(N, N, null, R, null, { repeat: rep, aniso: 16 }),
      avg: [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]],
    };
  });
}

/** Generic wood (desk tops, shelves, bed frame). tone: [r,g,b] sRGB base. Tile = 1 m along grain (u). Tiles seamlessly. */
export function woodMaps(name, tone, { scale = 1, contrast = 1, seed = 5 } = {}) {
  return once('wood' + name, () => {
    const N = 1024;
    const H = new Float32Array(N * N), R = new Float32Array(N * N), col = new Uint8Array(N * N * 4);
    // whole numbers of rings / streaks / pores per tile, and noise that wraps with exactly those periods
    const fr = Math.max(1, Math.round(22 * scale)), fs = Math.max(1, Math.round(140 * scale)), fp = Math.max(1, Math.round(700 * scale));
    const fillRow = (y) => {
      const v = y / N;
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const warp = pfbm(u * 3, v * 5, 3, seed, 3, 5);
        const rings = Math.sin((v * fr + warp * 5) * Math.PI * 2);
        const streak = pfbm(u * 4, v * fs, 3, seed + 3, 4, fs);
        const pores = pnoise(u * 90, v * fp, seed + 7, 90, fp);
        const g = clamp(0.5 + (0.22 * rings * warp + (streak - 0.5) * 0.6) * contrast);
        const dark = pores > 0.82 ? (pores - 0.82) * 2 : 0;
        const k = 0.8 + g * 0.3 - dark * 0.45, i = y * N + x;
        H[i] = (g - 0.5) * 0.2 - dark * 0.4; R[i] = clamp(0.5 + (0.5 - g) * 0.14 + dark * 0.3);
        col[i * 4] = clamp(tone[0] * k) * 255; col[i * 4 + 1] = clamp(tone[1] * k) * 255; col[i * 4 + 2] = clamp(tone[2] * k) * 255; col[i * 4 + 3] = 255;
      }
    };
    for (let y = 0; y < N; y++) fillRow(y);
    return {
      map: dataTex(col, N, N, { srgb: true }), normalMap: dataTex(normalData(H, N, N, 1.6, true), N, N, {}), roughnessMap: packTex(N, N, null, R, null),
      avg: tone.map((c) => lin(c) * 0.9),
    };
  });
}

// ---------------------------------------------------------------- the library
export function makeMaterials() {
  const M = {};
  const wallN = wallNormal(), lacN = lacquerNormal();
  const rep = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };

  M.wall = pbr({ color: sc(0.925, 0.925, 0.915), roughness: 0.93, normalMap: rep(wallN, 1 / 0.9, 1 / 0.9), normalScale: new THREE.Vector2(1.0, 1.0) }, wallFx(0.9 / 3.2, [0, 0], 1.0, 0.045, 0.07));
  M.ceiling = pbr({ color: sc(0.94, 0.94, 0.935), roughness: 0.95, normalMap: rep(wallN, 1 / 1.1, 1 / 1.1), normalScale: new THREE.Vector2(0.55, 0.55) }, wallFx(1.1 / 3.2, [0.37, 0.61], 0.8, 0.035, 0.05));
  const fl = floorMaps();
  M.floor = pbr({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.0 }, { bake: { albedo: fl.avg } });
  const sm = smudgeRough(0.42, 0.12);
  M.white = pbr({ color: sc(0.93, 0.93, 0.925), roughness: 1, roughnessMap: rep(sm, 1.3, 1.3), normalMap: rep(lacN, 14, 14), normalScale: new THREE.Vector2(0.12, 0.12) });
  M.whiteMatte = pbr({ color: sc(0.92, 0.92, 0.91), roughness: 0.78, normalMap: rep(lacN, 10, 10), normalScale: new THREE.Vector2(0.2, 0.2) });
  M.sill = pbr({ color: sc(0.9, 0.9, 0.89), roughness: 1, roughnessMap: sillRough(), normalMap: rep(lacN, 12, 12), normalScale: new THREE.Vector2(0.08, 0.08) });
  M.frame = pbr({ color: sc(0.115, 0.125, 0.135), roughness: 0.52, metalness: 0.0, normalMap: rep(lacN, 40, 40), normalScale: new THREE.Vector2(0.25, 0.25) });
  M.rubber = pbr({ color: sc(0.05, 0.05, 0.05), roughness: 0.85 });
  M.handle = pbr({ color: sc(0.085, 0.09, 0.095), roughness: 0.34, metalness: 0.0, normalMap: rep(lacN, 30, 30), normalScale: new THREE.Vector2(0.12, 0.12) });   // satin black window hardware
  M.silicone = pbr({ color: sc(0.74, 0.745, 0.74), roughness: 0.4 });                    // sanitary silicone / acrylic joint at the window
  M.caulk = pbr({ color: sc(0.85, 0.85, 0.835), roughness: 0.62 });                      // painted-over acrylic seam above the skirting
  M.shadowGap = pbr({ color: sc(0.035, 0.035, 0.035), roughness: 0.9 });                 // inside of joints, key holes, socket pins
  M.baseboard = pbr({ color: sc(0.93, 0.93, 0.92), roughness: 0.5, normalMap: rep(lacN, 12, 12), normalScale: new THREE.Vector2(0.15, 0.15) });
  M.metal = pbr({ color: sc(0.78, 0.78, 0.79), roughness: 0.32, metalness: 1.0 });
  M.chrome = pbr({ color: sc(0.9, 0.9, 0.9), roughness: 0.12, metalness: 1.0 });
  M.blackMetal = pbr({ color: sc(0.07, 0.07, 0.075), roughness: 0.45, metalness: 0.6 });
  M.plasticWhite = pbr({ color: sc(0.9, 0.9, 0.89), roughness: 0.38, normalMap: rep(lacN, 20, 20), normalScale: new THREE.Vector2(0.08, 0.08) });
  M.plasticBlack = pbr({ color: sc(0.06, 0.06, 0.065), roughness: 0.4 });
  M.exteriorWall = pbr({ color: sc(0.82, 0.8, 0.76), roughness: 0.95 }, { box: false });
  // light-tight shell used only by the bake (never drawn)
  M.blocker = pbr({ color: new THREE.Color(0, 0, 0), side: THREE.DoubleSide }, { bake: { albedo: [0, 0, 0], twoSided: true } });
  return M;
}

/** Woven fabric. color: THREE.Color. opts: slub, threads, rep (tiles per metre), trans (0..1 light through), sheen */
export function fabric(color, opts = {}) {
  const { slub = 0.3, threads = 96, rep = 6, trans = 0, sheen = 0.35, rough = 0.95, nscale = 0.8, side = THREE.FrontSide, key = '' } = opts;
  const n = weaveNormal(slub, 2.0, threads).clone(); n.repeat.set(rep, rep); n.needsUpdate = true;
  const tc = opts.transColor || color.clone().multiplyScalar(0.9);
  const m = pbr({ color, roughness: rough, normalMap: n, normalScale: new THREE.Vector2(nscale, nscale), sheen, sheenRoughness: 0.6, sheenColor: color.clone().lerp(new THREE.Color(1, 1, 1), 0.5), side },
    { phys: true, back: trans > 0 || side === THREE.DoubleSide, trans: new THREE.Color(tc.r * trans * 2.2, tc.g * trans * 2.2, tc.b * trans * 2.2), key: 'fab' + key, onCompile: opts.onCompile });
  m.userData.bake = { albedo: [color.r, color.g, color.b], trans, transColor: [tc.r, tc.g, tc.b], twoSided: true };
  return m;
}
