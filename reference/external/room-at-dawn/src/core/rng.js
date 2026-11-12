// Deterministic randomness + noise. Everything procedural in the scene must go through
// these so the baked lighting file always lines up with the regenerated geometry.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  sign() { return this.f() < 0.5 ? -1 : 1; }
  gauss() {
    let u = 0; while (u === 0) u = this.f();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.f());
  }
  fork() { return new RNG(Math.floor(this.f() * 2147483647)); }
}

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const fract = (x) => x - Math.floor(x);

function h2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function h3(ix, iy, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2246822519) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hash2 = h2, hash3 = h3;
const mod = (a, n) => ((a % n) + n) % n;

// Value noise 0..1. period>0 makes it tile every `period` lattice cells.
export function vnoise2(x, y, seed = 0, period = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  let x0 = ix, x1 = ix + 1, y0 = iy, y1 = iy + 1;
  if (period) { x0 = mod(x0, period); x1 = mod(x1, period); y0 = mod(y0, period); y1 = mod(y1, period); }
  const a = h2(x0, y0, seed), b = h2(x1, y0, seed), c = h2(x0, y1, seed), d = h2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function vnoise3(x, y, z, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const n = (a, b, c) => h3(ix + a, iy + b, iz + c, seed);
  const x00 = lerp(n(0, 0, 0), n(1, 0, 0), u), x10 = lerp(n(0, 1, 0), n(1, 1, 0), u);
  const x01 = lerp(n(0, 0, 1), n(1, 0, 1), u), x11 = lerp(n(0, 1, 1), n(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

// fbm 0..1 (roughly). period applies to the base octave and doubles per octave.
export function fbm2(x, y, { oct = 4, gain = 0.5, lac = 2, seed = 0, period = 0 } = {}) {
  let a = 0.5, s = 0, n = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise2(x * f, y * f, seed + i * 17, period ? Math.round(period * f) : 0);
    n += a; a *= gain; f *= lac;
  }
  return s / n;
}
export function fbm3(x, y, z, { oct = 4, gain = 0.5, lac = 2, seed = 0 } = {}) {
  let a = 0.5, s = 0, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f, seed + i * 17); n += a; a *= gain; f *= lac; }
  return s / n;
}
// "Billow": round tops, sharp creases. Good for pillowy cloth.
export function billow2(x, y, opts = {}) {
  const { oct = 4, gain = 0.5, lac = 2, seed = 0 } = opts;
  let a = 0.5, s = 0, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * Math.abs(vnoise2(x * f, y * f, seed + i * 17) * 2 - 1); n += a; a *= gain; f *= lac; }
  return s / n;
}
// Cellular (Worley) noise: returns [f1, f2, cellId] in lattice units. Tiles with `period`.
export function worley2(x, y, seed = 0, period = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    let cx = ix + i, cy = iy + j;
    const hx = period ? mod(cx, period) : cx, hy = period ? mod(cy, period) : cy;
    const px = cx + h2(hx, hy, seed), py = cy + h2(hx, hy, seed + 101);
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; id = h2(hx, hy, seed + 202); } else if (d < f2) f2 = d;
  }
  return [f1, f2, id];
}
