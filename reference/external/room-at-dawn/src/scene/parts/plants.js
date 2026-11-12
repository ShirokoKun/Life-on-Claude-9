// Golden pothos (Epipremnum aureum) x3: the big trailing one on a high shelf in the window corner,
// a small bushy one on the windowsill and one on the wall shelf above the desk.
// Vines are grown with a tiny "limp rope" simulation (stiff near the pot, then gravity wins, kinks at
// the nodes, tips turning back up to the light) that slides over the pot rim, shelf boards and the
// sill. Leaves are instanced: six blade variants, each a folded / curled height-field heart whose
// vertex normals stay flat (= the baked sample normal) while a per-variant normal map carries the
// fold, curl and veins, so one baked light sample per leaf still shades as a curved glossy blade.
import * as THREE from 'three';
import { RNG, fbm2, vnoise2, worley2, smoothstep, clamp, lerp } from '../../core/rng.js';
import { boxAt, lathe, merge, mesh, group, tube } from '../../core/geo.js';
import { dataTex, packTex, colorTex, field, normalTex } from '../../core/tex.js';
import { pbr, lacquerNormal } from '../materials.js';
import { PLANT_SHELF, SHELVES, RADIATOR, CURTAIN, WARDROBE, ROOM } from '../layout.js';

export const order = 40;
export const label = 'plants';

const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const lin = (c) => Math.pow(c, 2.2);
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ------------------------------------------------------------------------------------------------
// Leaf blade. Unit leaf: petiole joint at the origin, tip at (0,1,0), upper surface faces +Z.
// The outline is swept by "rows" (which are also the lateral veins) leaving the midrib point (0,t)
// at angle rowAng(t) with length rowLen(t): backwards at the base (the two heart lobes), square
// across the widest part, leaning forward towards the drip tip.
const A0 = -62 * D2R, AP = 3.6, A1 = 35 * D2R, AQ = 1.3;
const rowAng = (t) => A0 * Math.pow(1 - t, AP) + A1 * Math.pow(t, AQ);
const rowAngD = (t) => -A0 * AP * Math.pow(1 - t, AP - 1) + A1 * AQ * Math.pow(Math.max(t, 1e-4), AQ - 1);
const LA = 0.58, LB = 1.35, LK = 0.42 / 0.3074;
const rowLen = (t) => LK * Math.pow(t, LA) * Math.pow(1 - t, LB) * (1 - 0.28 * smoothstep(0.78, 1, t));   // slower start = shallow lobes, pinched end = drip tip
const LEAF_LEN = 1.12;                        // lobes-to-tip length of the unit leaf
const TS = 1.22, TY0 = 0.16, TN = 256;        // texture window (leaf units) and resolution
const ANCHOR_Y = 0.35;

/** Height of the blade over its flat outline: midrib fold, drooping halves, tip / lobe curl, twist, wavy margin. */
function leafH(P, x, y) {
  let h = P.fold * (Math.sqrt(x * x + 0.0006) - 0.024495) - P.cup * x * x;
  const yt = y - 0.45; if (yt > 0) h -= P.curl * yt * yt;
  const yb = 0.12 - y; if (yb > 0) h -= P.base * yb * yb;
  h += P.twist * x * (y - ANCHOR_Y);
  h += P.wave * (x * x * 6.9) * Math.sin(y * P.wf + P.wp + (x > 0 ? 0 : 1.7));
  return h;
}

function leafGeometry(P) {
  const TT = [0, 0.012, 0.04, 0.085, 0.15, 0.24, 0.35, 0.47, 0.6, 0.72, 0.83, 0.92, 1];
  const SS = [-1, -0.7, -0.36, 0, 0.36, 0.7, 1];
  const nT = TT.length, nS = SS.length;
  const pos = new Float32Array(nT * nS * 3), nor = new Float32Array(nT * nS * 3), uv = new Float32Array(nT * nS * 2), idx = [];
  for (let j = 0; j < nT; j++) {
    const t = TT[j], a = rowAng(t), l = rowLen(t), ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < nS; i++) {
      const s = SS[i], sd = Math.sign(s), al = Math.abs(s) * l, x = sd * al * ca, y = t + al * sa, k = j * nS + i;
      pos[k * 3] = x * (1 + P.asym * sd); pos[k * 3 + 1] = y; pos[k * 3 + 2] = leafH(P, x, y);
      nor[k * 3 + 2] = 1;
      uv[k * 2] = x / TS + 0.5; uv[k * 2 + 1] = (y + TY0) / TS;
    }
  }
  for (let j = 0; j < nT - 1; j++) for (let i = 0; i < nS - 1; i++) {
    const a = j * nS + i, b = a + 1, c = a + nS + 1, d = a + nS;
    if (j > 0) idx.push(a, b, c);
    if (j < nT - 2) idx.push(a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function leafShader(shader) {
  // idle: the window is shut, so only a breath of convection — the tip moves < 2.5 mm, the joint not at all
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
	#ifdef USE_INSTANCING
	{
		float ph = dot( instanceMatrix[3].xyz, vec3( 7.3, 3.1, 5.7 ) );
		float sw = sin( uTime * 0.83 + ph ) * 0.6 + sin( uTime * 1.71 + ph * 1.9 ) * 0.4;
		float kk = transformed.y * transformed.y;
		transformed.z += sw * 0.02 * kk; transformed.x += sw * 0.007 * kk * sin( ph * 3.0 );
	}
	#endif`);
  // underside: paler, matt, hardly any sheen (the waxy cuticle is on top)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n\tif ( ! gl_FrontFacing ) diffuseColor.rgb = diffuseColor.rgb * 0.92 + vec3( 0.012, 0.02, 0.006 );')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\tif ( ! gl_FrontFacing ) roughnessFactor = min( 1.0, roughnessFactor + 0.2 );')
    // reflections of the sky are compressed: a leaf mirroring the window gets a soft sheen, never a white-out
    .replace('#include <lights_fragment_end>', '#if defined( RE_IndirectSpecular )\n\tradiance /= 1.0 + 1.6 * dot( radiance, vec3( 0.3333 ) );\n\tif ( ! gl_FrontFacing ) radiance *= 0.3;\n\t#endif\n\t#include <lights_fragment_end>');
}

/** Six blade variants: geometry + albedo (variegation differs) + normal map (fold/curl differs). */
function makeLeafLibrary() {
  const rng = new RNG(8123), N = TN, px = TS / N;
  // ---- inverse map (x,y) -> (t along the midrib, s across) for the outline; shared by all variants
  const tF = new Float32Array(N * N), sF = new Float32Array(N * N), latF = new Float32Array(N * N), midF = new Float32Array(N * N);
  const veinT = [[], []];
  for (let sd = 0; sd < 2; sd++) for (let k = 0; k < 10; k++) veinT[sd].push(Math.min(0.95, 0.03 + 0.9 * Math.pow((k + (sd ? 0.55 : 0.08) + rng.range(-0.14, 0.14)) / 10, 1.12)));
  for (let j = 0; j < N; j++) {
    const y = ((j + 0.5) / N) * TS - TY0;
    for (let i = N / 2; i < N; i++) {
      const x = ((i + 0.5) / N - 0.5) * TS;
      const F = (tt) => { const a = rowAng(tt); return x * Math.sin(a) - (y - tt) * Math.cos(a); };
      let t, out = false;
      if (F(0) >= 0) { t = 0; out = true; } else if (F(1) <= 0) { t = 1; out = true; } else {
        let lo = 0, hi = 1;
        for (let k = 0; k < 15; k++) { const m = (lo + hi) * 0.5; if (F(m) < 0) lo = m; else hi = m; }
        t = (lo + hi) * 0.5;
      }
      const a = rowAng(t), al = x * Math.cos(a) + (y - t) * Math.sin(a), l = rowLen(t);
      const s = out ? 1.5 : clamp(l > 1e-4 ? al / l : 1.5, 0, 1.5);
      const metric = Math.cos(a) + rowAngD(t) * al;
      const k1 = j * N + i, k0 = j * N + (N - 1 - i);
      tF[k1] = tF[k0] = t; sF[k1] = sF[k0] = s;
      const s1 = Math.min(1, s), w = 0.006 * (1 - 0.45 * s1);
      for (let sd = 0; sd < 2; sd++) {
        let dm = 9; for (const tv of veinT[sd]) dm = Math.min(dm, Math.abs(t - tv));
        const d = dm * metric;
        latF[sd ? k1 : k0] = out ? 0 : Math.exp(-(d * d) / (w * w)) * (1 - 0.7 * s1);
      }
      const wm = 0.0125 * (1 - 0.55 * clamp(y));
      midF[k1] = midF[k0] = Math.exp(-(x * x) / (wm * wm)) * smoothstep(-0.03, 0.02, y) * (1 - 0.45 * clamp(y));
    }
  }
  const tone = field(N, N, (u, v) => fbm2(u * 7, v * 7, { oct: 3, seed: 41 }));
  const fine = field(N, N, (u, v) => fbm2(u * 64, v * 64, { oct: 2, seed: 43 }));
  const R = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) R[k] = clamp(0.385 + 0.1 * latF[k] + 0.14 * midF[k] + (tone[k] - 0.5) * 0.16 + (fine[k] - 0.5) * 0.08, 0.2, 0.7);
  const roughTex = packTex(N, N, null, R, null, { wrap: false });

  const deep = [0.225, 0.365, 0.185], midc = [0.32, 0.495, 0.235], gold = [0.6, 0.68, 0.34], veinC = [0.45, 0.57, 0.3];
  // fold, cup, curl, base, twist, wave, variegation threshold / amount
  const defs = [
    [0.22, 0.5, 0.5, 1.2, 0.12, 0.014, 0.7, 0.45],
    [0.32, 0.7, 0.85, 0.4, -0.3, 0.022, 0.62, 0.8],
    [0.17, 0.35, 0.35, 2.0, 0.28, 0.01, 0.66, 0.6],
    [0.4, 0.8, 1.0, -0.4, -0.1, 0.028, 0.6, 0.9],
    [0.27, 0.6, 0.65, 1.5, 0.4, 0.018, 0.74, 0.35],
    [0.65, 0.35, 0.55, 0.6, 0.15, 0.01, 0.77, 0.25],      // freshly unfurled: still folded
  ];
  const lib = { geo: [], mat: [], probeH: [], n: defs.length };
  defs.forEach((d, vi) => {
    const P = { fold: d[0], cup: d[1], curl: d[2], base: d[3], twist: d[4], wave: d[5], wf: rng.range(9, 16), wp: rng.range(0, 6.28), asym: rng.range(-0.07, 0.07) };
    const sd = 100 + vi * 37, col = new Uint8Array(N * N * 4), H = new Float32Array(N * N), nd = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = ((i + 0.5) / N - 0.5) * TS, y = ((j + 0.5) / N) * TS - TY0, t = tF[k], s = Math.min(1, sF[k]), side = i < N / 2 ? 0 : 1;
      const st = fbm2(t * 22 + sd, s * 2.6 + side * 4.1 + sd * 0.3, { oct: 3, seed: sd });
      const pt = fbm2(x * 3.3 + sd, y * 3.3, { oct: 2, seed: sd + 9 });
      const m = smoothstep(d[6], d[6] + 0.16, st * 0.62 + pt * 0.38 + 0.06) * d[7];
      let c = mix3(deep, midc, clamp(0.3 + (tone[k] - 0.5) * 1.5 + 0.22 * s));
      c = mix3(c, gold, m * 0.62);
      c = mix3(c, veinC, clamp(0.3 * latF[k] + 0.55 * midF[k]));
      col[k * 4] = c[0] * 255; col[k * 4 + 1] = c[1] * 255; col[k * 4 + 2] = c[2] * 255; col[k * 4 + 3] = 255;
      H[k] = leafH(P, x, y) - 0.0034 * midF[k] - 0.0019 * latF[k] + 0.001 * (fine[k] - 0.5) + 0.0022 * (tone[k] - 0.5);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const xm = Math.max(0, i - 1), xp = Math.min(N - 1, i + 1), ym = Math.max(0, j - 1), yp = Math.min(N - 1, j + 1), k = j * N + i;
      const dx = (H[j * N + xp] - H[j * N + xm]) / ((xp - xm) * px), dy = (H[yp * N + i] - H[ym * N + i]) / ((yp - ym) * px);
      const il = 1 / Math.hypot(dx, dy, 1);
      nd[k * 4] = (-dx * il * 0.5 + 0.5) * 255; nd[k * 4 + 1] = (-dy * il * 0.5 + 0.5) * 255; nd[k * 4 + 2] = (il * 0.5 + 0.5) * 255; nd[k * 4 + 3] = 255;
    }
    const mat = pbr({
      map: dataTex(col, N, N, { srgb: true, wrap: false }), normalMap: dataTex(nd, N, N, { wrap: false }),
      roughnessMap: roughTex, roughness: 1, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5,
    }, {
      back: true, trans: new THREE.Color(0.2, 0.25, 0.07), key: 'pothosLeaf', onCompile: leafShader,
      bake: { albedo: [0.07, 0.16, 0.04], twoSided: true, trans: 0.2, transColor: [0.12, 0.35, 0.03] },
    });
    lib.geo.push(leafGeometry(P)); lib.mat.push(mat); lib.probeH.push(PROBE.map((pr) => leafH(P, pr[0], pr[1])));
  });
  return lib;
}

// ------------------------------------------------------------------------------------------------
// Thin tubes written straight into shared arrays (petioles, aerial roots).
class TubeSoup {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; }
  add(pts, r0, r1, radial, c0, c1) {
    const n = pts.length, base = this.pos.length / 3, T = V(), N = V(), B = V();
    for (let i = 0; i < n; i++) {
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      if (i === 0) { B.set(0, 1, 0); if (Math.abs(T.y) > 0.9) B.set(1, 0, 0); N.crossVectors(T, B).normalize(); }
      else { N.addScaledVector(T, -N.dot(T)); if (N.lengthSq() < 1e-8) N.set(T.y, T.z, T.x).cross(T); N.normalize(); }
      B.crossVectors(T, N);
      const f = i / (n - 1), r = r0 + (r1 - r0) * f, p = pts[i];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        const nx = N.x * cs + B.x * sn, ny = N.y * cs + B.y * sn, nz = N.z * cs + B.z * sn;
        this.pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r); this.nor.push(nx, ny, nz);
        this.col.push(c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
      const a = base + i * radial + j, b = base + i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
      this.idx.push(a, b, c, b, d, c);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((this.pos.length / 3) * 2), 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// ------------------------------------------------------------------------------------------------
// Things the plants must stay out of: walls, boxes (shelf, curtain, radiator …) and the pot itself.
class Env {
  constructor({ minX = -1e9, minZ = -1e9, maxY = 1e9, boxes = [], pots = [] }) {
    this.minX = minX; this.minZ = minZ; this.maxY = maxY; this.boxes = boxes; this.pots = pots; this.n = V();
  }
  /** Push p out of everything with clearance m. Returns true if it moved; this.n = summed push direction.
   *  solid: treat pots as solid (leaf blades) instead of hollow (stems climbing out over the rim). */
  push(p, m, solid, mw = m) {
    const n = this.n.set(0, 0, 0); let hit = false;
    if (p.x < this.minX + mw) { p.x = this.minX + mw; n.x += 1; hit = true; }
    if (p.z < this.minZ + mw) { p.z = this.minZ + mw; n.z += 1; hit = true; }
    if (p.y > this.maxY - m) { p.y = this.maxY - m; n.y -= 1; hit = true; }
    for (const bx of this.boxes) {
      const b = bx.b, x0 = b[0] - m, y0 = b[1] - m, z0 = b[2] - m, x1 = b[3] + m, y1 = b[4] + m, z1 = b[5] + m;
      if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1 || p.z <= z0 || p.z >= z1) continue;
      const f = bx.faces || '-x+x-y+y-z+z';
      let best = 1e9, ax = 0, sg = 0, to = 0;
      const tryF = (key, pen, a, s, dst) => { if (f.includes(key) && pen < best) { best = pen; ax = a; sg = s; to = dst; } };
      if (x0 > this.minX + mw) tryF('-x', p.x - x0, 0, -1, x0);
      tryF('+x', x1 - p.x, 0, 1, x1);
      tryF('-y', p.y - y0, 1, -1, y0); tryF('+y', y1 - p.y, 1, 1, y1);
      if (z0 > this.minZ + mw) tryF('-z', p.z - z0, 2, -1, z0);
      tryF('+z', z1 - p.z, 2, 1, z1);
      if (!sg) continue;
      p.setComponent(ax, to); n.setComponent(ax, n.getComponent(ax) + sg); hit = true;
    }
    for (const c of this.pots) {
      const dx = p.x - c.x, dz = p.z - c.z, r = Math.hypot(dx, dz) + 1e-9;
      if (solid) {
        if (p.y >= c.yRim - 0.004 || p.y <= c.y0 - m || r >= c.rOut + m) continue;
        if (c.yRim - 0.004 - p.y < c.rOut + m - r) { p.y = c.yRim - 0.004; n.y += 1; }
        else { const k = (c.rOut + m) / r; p.x = c.x + dx * k; p.z = c.z + dz * k; n.x += dx / r; n.z += dz / r; }
        hit = true; continue;
      }
      if (p.y >= c.yRim + m || p.y <= c.y0 - m || r >= c.rOut + m) continue;
      if (r < c.rIn - m) { if (p.y < c.ySoil - 0.008) { p.y = c.ySoil - 0.008; hit = true; n.y += 1; } continue; }
      if (p.y > c.yRim - 0.035) { p.y = c.yRim + m; n.y += 1; }
      else { const k = (c.rOut + m) / r; p.x = c.x + dx * k; p.z = c.z + dz * k; n.x += dx / r; n.z += dz / r; }
      hit = true;
    }
    return hit;
  }
}

/** Grow one stem: stiff at first, gravity takes over (bend0 -> bend1 over `ramp` metres), kinks at nodes. */
function growVine(rng, env, o) {
  const ds = o.ds, n = Math.max(3, Math.round(o.len / ds));
  const p = o.start.clone(), d = o.dir.clone().normalize(), q = V(), pts = [p.clone()], nodes = [];
  const sd = rng.int(1, 9999), head = o.head, side = V().crossVectors(UP, head).normalize();
  let nextNode = o.firstNode, par = rng.sign(), resting = false;
  for (let i = 1; i <= n; i++) {
    const s = i * ds, rem = o.len - s;
    d.addScaledVector(side, (vnoise2(s * 5, 1.3, sd) - 0.5) * o.wander * 2);
    d.addScaledVector(head, (vnoise2(s * 5, 7.7, sd) - 0.5) * o.wander);
    d.y -= lerp(o.bend0, o.bend1, smoothstep(0, o.ramp, s));
    if (o.hook > 0 && rem < o.hookLen) { const h = 1 - rem / o.hookLen; d.addScaledVector(o.hookDir, o.hook * h * h); }
    if (resting) d.addScaledVector(head, 0.3);
    d.normalize();
    q.copy(p).addScaledVector(d, ds);
    resting = false;
    if (env.push(q, o.margin, false, o.wallMargin)) {
      if (env.n.y > 0.5) resting = true;
      d.subVectors(q, p);
      if (d.length() < ds * 0.6) { q.addScaledVector(head, ds * 0.8); env.push(q, o.margin, false, o.wallMargin); d.subVectors(q, p); }
      if (d.lengthSq() < 1e-10) d.copy(head);
      d.normalize(); q.copy(p).addScaledVector(d, ds); env.push(q, o.margin, false, o.wallMargin);
      if (q.distanceToSquared(p) < 1e-8) q.addScaledVector(head, ds * 0.5);
    }
    p.copy(q); pts.push(p.clone());
    if (s >= nextNode && rem > 0.012) {
      nodes.push({ i, s, par }); par = -par;
      nextNode = s + o.internode(s, rem);
      const kk = o.kink * rng.range(0.5, 1.4);
      d.addScaledVector(side, par * kk * rng.range(0.3, 1)).addScaledVector(head, rng.range(-1, 1) * kk * 0.6).normalize();
    }
  }
  return { pts, nodes };
}

// leaf-blade probe points (unit leaf x,y) used to keep blades out of walls and furniture
const PROBE = [[0, 1.0], [0, 0.55], [0.4, 0.2], [-0.4, 0.2], [0.2, -0.1], [-0.2, -0.1], [0.3, 0.62], [-0.3, 0.62]];
const C_STEM = [[lin(0.36), lin(0.32), lin(0.2)], [lin(0.3), lin(0.4), lin(0.17)], [lin(0.42), lin(0.55), lin(0.24)]];
const C_PET0 = [lin(0.32), lin(0.43), lin(0.19)], C_PET1 = [lin(0.4), lin(0.53), lin(0.24)], C_ROOT = [lin(0.32), lin(0.24), lin(0.15)], C_ROOT1 = [lin(0.45), lin(0.36), lin(0.24)];

/** One plant. Appends leaf instances / stems to the shared collectors in S. */
function growPlant(S, c) {
  const rng = new RNG(c.seed), env = c.env;
  const t1 = V(), t2 = V(), e1 = V(), e2 = V(), r = V(), pdir = V(), O = V(), toL = V(), F = V(), q = V(), push = V(), jit = V();
  const rv = (out, k) => out.set(rng.gauss() * k, rng.gauss() * k, rng.gauss() * k);
  const outward = (p, out) => {
    out.set(clamp(1 - (p.x - env.minX) / 0.3), 0, clamp(1 - (p.z - env.minZ) / 0.3));
    const dx = p.x - c.cx, dz = p.z - c.cz, rr = Math.hypot(dx, dz) + 1e-6, w = smoothstep(c.rimY - 0.2, c.rimY, p.y) * 1.2;
    out.x += (dx / rr) * w; out.z += (dz / rr) * w;
    out.addScaledVector(c.bias, 0.45);
    if (out.lengthSq() < 1e-4) out.copy(c.bias);
    return out.normalize();
  };

  function addLeaf(P, T, par, size, crown, young) {
    outward(P, O);
    e1.copy(O).addScaledVector(T, -O.dot(T));
    if (e1.lengthSq() < 0.02) e1.set(T.z, T.x, T.y).addScaledVector(T, -e1.dot(T));
    e1.normalize(); e2.crossVectors(T, e1);
    const az = par * rng.range(35, 105) * D2R;
    r.copy(e1).multiplyScalar(Math.cos(az)).addScaledVector(e2, Math.sin(az));
    const pl = size * lerp(rng.range(0.5, 0.85), rng.range(0.8, 1.3), crown) * (1 - 0.3 * young);
    pdir.copy(r).addScaledVector(UP, lerp(0.35, 1.0, crown) * rng.range(0.55, 1.3)).addScaledVector(T, 0.22 * (1 - crown)).addScaledVector(O, 0.3).normalize();
    const B = V().copy(P).addScaledVector(pdir, pl);
    env.push(B, 0.016, true);
    toL.copy(c.light).sub(B).normalize();
    const droop = lerp(rng.range(0.55, 1.35), rng.range(0.05, 0.6), crown) * (1 - 0.5 * young);
    const Y = V().copy(pdir).multiplyScalar(0.6).addScaledVector(UP, -droop).addScaledVector(O, 0.2).addScaledVector(toL, 0.15).add(rv(jit, 0.16)).normalize();
    F.copy(O).multiplyScalar(0.5).addScaledVector(UP, lerp(0.38, 0.95, crown)).addScaledVector(toL, 0.35).addScaledVector(c.bias, 0.5).add(rv(jit, rng.chance(0.2) ? 0.9 : 0.5));
    const Z = V().copy(F).addScaledVector(Y, -F.dot(Y));
    if (Z.lengthSq() < 1e-4) Z.copy(e1).addScaledVector(Y, -e1.dot(Y));
    Z.normalize();
    const X = V().crossVectors(Y, Z);
    const roll = rng.range(-0.32, 0.32); t1.copy(X); X.multiplyScalar(Math.cos(roll)).addScaledVector(Z, Math.sin(roll)); Z.multiplyScalar(Math.cos(roll)).addScaledVector(t1, -Math.sin(roll));
    const vi = young > 0.45 ? 5 : rng.int(0, 4), ph = S.lib.probeH[vi];
    let sy = size / LEAF_LEN, sx = sy * rng.range(0.9, 1.1), bad = 1;
    for (let it = 0; it < 12 && bad; it++) {
      bad = 0; push.set(0, 0, 0);
      for (let k = 0; k < PROBE.length; k++) { q.copy(B).addScaledVector(X, PROBE[k][0] * sx).addScaledVector(Y, PROBE[k][1] * sy).addScaledVector(Z, ph[k] * sy); if (env.push(q, 0.017, true)) { push.add(env.n); bad++; } }
      if (!bad) break;
      if (push.lengthSq() < 1e-6) break;
      push.normalize();
      Y.addScaledVector(push, 0.45).normalize();
      Z.addScaledVector(push, 0.35).addScaledVector(Y, -Z.dot(Y));
      if (Z.lengthSq() < 1e-4) Z.copy(push).addScaledVector(Y, -push.dot(Y));
      Z.normalize(); X.crossVectors(Y, Z);
      B.addScaledVector(push, 0.006);
      if (it >= 6) { sx *= 0.88; sy *= 0.88; }
    }
    if (bad) return false;
    // petiole: leaves the node sideways, arrives roughly along the blade's midrib
    t1.copy(P).addScaledVector(pdir, pl * 0.5); t2.copy(B).addScaledVector(Y, -pl * 0.4);
    const C = V().lerpVectors(t1, t2, 0.5).addScaledVector(UP, -pl * 0.04);
    env.push(C, 0.008, true);
    const pp = [];
    for (let k = 0; k <= 3; k++) { const f = k / 3, a = (1 - f) * (1 - f), b = 2 * f * (1 - f), cc = f * f; pp.push(V(P.x * a + C.x * b + B.x * cc, P.y * a + C.y * b + B.y * cc, P.z * a + C.z * b + B.z * cc)); }
    const pr0 = clamp(size * 0.021, 0.0011, 0.0022);
    S.tubes.add(pp, pr0, pr0 * 0.62, 4, C_PET0, C_PET1);

    const m = new THREE.Matrix4().makeBasis(X.multiplyScalar(sx), Y.multiplyScalar(sy), Z.multiplyScalar(sy)).setPosition(B);
    const v = rng.range(0.8, 1.12) * (1 + 0.1 * crown), yl = rng.chance(0.012) ? 1 : 0;
    const col = new THREE.Color(v * (1 + young * 0.4 + yl * 0.9), v * (1 + young * 0.32 + yl * 0.55), v * (1 - young * 0.1 - yl * 0.3) * rng.range(0.9, 1.1));
    S.leaves[vi].push({ m, col });
    return true;
  }

  const vine = (v, shoot) => {
    const th = v.th * D2R, head = V(Math.cos(th), 0, Math.sin(th));
    const a0 = th + rng.range(-0.5, 0.5), r0 = c.rIn * (shoot ? rng.range(0.1, 0.72) : rng.range(0.4, 0.72));
    const start = V(c.cx + Math.cos(a0) * r0, c.soilY - 0.006, c.cz + Math.sin(a0) * r0);
    const limp = !shoot && v.b0 > 0.05, el = (v.el + (limp ? rng.range(-8, 8) : 0)) * D2R, dir = V(head.x * Math.cos(el), Math.sin(el), head.z * Math.cos(el));
    const hookDir = V().copy(c.light).sub(start).setY(0).normalize().multiplyScalar(0.5).addScaledVector(c.bias, 0.35).add(UP).normalize();
    const R0 = c.stemR[0] * (shoot ? 0.8 : rng.range(0.85, 1.1)), R1 = c.stemR[1];
    const g = growVine(rng, env, {
      start, dir, head, len: v.len, ds: 0.015, bend0: v.b0 * (limp ? rng.range(0.75, 1.35) : 1), bend1: v.b1, ramp: v.ramp, hook: v.hook || 0, hookLen: v.hookLen || 0.14, hookDir,
      wander: v.wander ?? 0.012, kink: v.kink ?? 0.2, margin: R0 + 0.0015, wallMargin: R0 + 0.016, firstNode: rng.range(0.012, 0.035),
      internode: (s, rem) => (shoot ? rng.range(0.02, 0.036) : s < 0.15 ? rng.range(0.022, 0.038) : rem < 0.12 ? rng.range(0.022, 0.034) : rng.range(c.inter[0], c.inter[1])),
    });
    const pts = g.pts, total = (pts.length - 1) * 0.015;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); curve.arcLengthDivisions = pts.length * 4;
    const nodeT = g.nodes.map((nd) => nd.s / total), tubular = Math.max(4, Math.round(total / c.seg)), radial = 5;
    const rf = (t) => {
      let b = 0;
      for (const nt of nodeT) { const dd = ((t - nt) * total) / 0.0045; if (dd > -2.5 && dd < 2.5) b = Math.max(b, Math.exp(-dd * dd)); }
      return lerp(R0, R1, Math.pow(t, 0.8)) * (t > 0.96 ? lerp(1, 0.5, (t - 0.96) / 0.04) : 1) * (1 + 0.3 * b);
    };
    const geo = tube(pts, rf, { tubular, radial, cap: true, curve });
    const nv = geo.attributes.position.count, col = new Float32Array(nv * 3), ring = radial + 1, body = (tubular + 1) * ring;
    for (let k = 0; k < nv; k++) {
      const f = k < body ? Math.floor(k / ring) / tubular : k < body + ring + 1 ? 0 : 1;
      const cc = mix3(mix3(C_STEM[0], C_STEM[1], smoothstep(0.03, 0.3, f * total)), C_STEM[2], smoothstep(0.6, 1, f));
      col[k * 3] = cc[0]; col[k * 3 + 1] = cc[1]; col[k * 3 + 2] = cc[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    S.vines.push(geo);
    // leaves, one per node, alternating sides
    const T = V();
    for (const nd of g.nodes) {
      const P = pts[nd.i], rem = v.len - nd.s;
      T.subVectors(pts[Math.min(pts.length - 1, nd.i + 1)], pts[nd.i - 1]).normalize();
      const crown = shoot ? 1 : smoothstep(c.rimY - 0.05, c.rimY + 0.03, P.y) * smoothstep(0.32, 0.14, nd.s);
      const young = shoot ? (rem < 0.03 ? rng.range(0, 0.6) : 0) : smoothstep(0.11, 0.0, rem);
      if (!shoot && crown < 0.3 && young < 0.1 && rng.chance(c.bare)) continue;
      const size = lerp(c.size[0], c.size[1], Math.pow(rng.next(), 0.8)) * (1 - 0.55 * young) * (1 + 0.08 * crown);
      addLeaf(P, T, nd.par, size, crown, young);
      // aerial root nub on the older, hanging part of the stem
      if (!shoot && crown < 0.2 && young < 0.05 && rng.chance(0.4)) {
        outward(P, O); t1.copy(O).multiplyScalar(-0.6).addScaledVector(UP, -0.7).add(rv(jit, 0.3)).normalize();
        const rl = rng.range(0.005, 0.013);
        const ra = V().copy(P).addScaledVector(t1, rl * 0.55), rb = V().copy(P).addScaledVector(t1, rl).addScaledVector(UP, -rl * 0.25);
        env.push(ra, 0.012, true); env.push(rb, 0.012, true);
        if (rb.distanceToSquared(P) > 4e-6 && ra.distanceToSquared(rb) > 1e-6 && ra.distanceToSquared(P) > 1e-6) S.tubes.add([P.clone(), ra, rb], 0.0011, 0.0004, 4, C_ROOT, C_ROOT1);
      }
    }
  };
  for (const v of c.vines) vine(v, false);
  for (let i = 0; i < c.shoots.n; i++) {
    const th = lerp(c.shoots.th[0], c.shoots.th[1], (i + rng.next()) / c.shoots.n);
    vine({ th, el: rng.range(52, 86), len: rng.range(c.shoots.len[0], c.shoots.len[1]), b0: 0.004, b1: 0.03, ramp: 0.2, wander: 0.05, kink: 0.2 }, true);
  }
}

// ------------------------------------------------------------------------------------------------
// Pots
function soilDisc(R, seed) {
  const nr = 6, ns = 30, pos = [], uv = [], idx = [];
  const bump = (x, z) => (fbm2(x * 55 + seed, z * 55, { oct: 3, seed }) - 0.5) * 0.013 + 0.004 * (1 - (x * x + z * z) / (R * R));
  pos.push(0, bump(0, 0), 0); uv.push(0.5, 0.5);
  for (let i = 1; i <= nr; i++) for (let j = 0; j < ns; j++) {
    const rr = (R * i) / nr, a = (j / ns) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    pos.push(x, bump(x, z) * (1 - Math.pow(i / nr, 4) * 0.7), z); uv.push(x / 0.09 + 0.5, z / 0.09 + 0.5);
  }
  for (let j = 0; j < ns; j++) idx.push(0, 1 + ((j + 1) % ns), 1 + j);
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < ns; j++) {
    const a = 1 + i * ns + j, b = 1 + i * ns + ((j + 1) % ns), cc = b + ns, d = a + ns;
    idx.push(a, b, d, b, cc, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function potMaterials() {
  const lacN = lacquerNormal();
  const rep = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  // speckled off-white stoneware (matt glaze, iron flecks)
  const stone = colorTex(256, 256, (u, v) => {
    const n = fbm2(u * 6, v * 6, { oct: 3, seed: 61, period: 6 });
    const [f1, , id] = worley2(u * 44, v * 44, 63, 44);
    const sp = id > 0.7 ? smoothstep(0.17, 0.05, f1) * (id - 0.7) * 3.3 : 0;
    const k = 0.94 + (n - 0.5) * 0.14;
    return [clamp(0.86 * k - sp * 0.42), clamp(0.84 * k - sp * 0.47), clamp(0.79 * k - sp * 0.52)];
  });
  stone.repeat.set(2, 1.5);
  // sage / olive reactive glaze: mottled, breaks brown where it runs thin
  const sage = colorTex(256, 256, (u, v) => {
    const n = fbm2(u * 5, v * 5, { oct: 4, seed: 71, period: 5 }), n2 = fbm2(u * 40, v * 40, { oct: 2, seed: 73, period: 40 });
    const run = fbm2(u * 16, v * 2, { oct: 2, seed: 75, period: 16 });
    const k = 0.86 + (n - 0.5) * 0.36 + (n2 - 0.5) * 0.1;
    return mix3([0.47 * k, 0.5 * k, 0.33 * k], [0.36, 0.3, 0.18], clamp((run - 0.58) * 2.2) * 0.55);
  });
  const terra = colorTex(256, 256, (u, v) => {
    const n = fbm2(u * 6, v * 6, { oct: 4, seed: 81, period: 6 }), n2 = fbm2(u * 48, v * 48, { oct: 2, seed: 83, period: 48 });
    const bloom = smoothstep(0.52, 0.72, fbm2(u * 4, v * 3, { oct: 3, seed: 85, period: 4 }));
    const k = 0.84 + (n - 0.5) * 0.3 + (n2 - 0.5) * 0.12;
    return mix3([0.7 * k, 0.41 * k, 0.27 * k], [0.8, 0.71, 0.63], bloom * 0.3);
  });
  const terraN = normalTex(field(128, 128, (u, v) => fbm2(u * 48, v * 48, { oct: 3, seed: 87, period: 48 })), 128, 128, 1.6);
  terraN.repeat.set(3, 2);
  const soilC = colorTex(128, 128, (u, v) => {
    const [f1, f2, id] = worley2(u * 26, v * 26, 91, 26);
    const n = fbm2(u * 9, v * 9, { oct: 3, seed: 93, period: 9 });
    if (id > 0.955 && f1 < 0.3) return [0.74, 0.72, 0.66];                 // perlite
    const k = (0.55 + 0.6 * n) * (0.75 + 0.5 * clamp(f2 - f1)) * (id < 0.12 ? 1.5 : 1);
    return [clamp(0.15 * k), clamp(0.115 * k), clamp(0.085 * k)];
  });
  const soilN = normalTex(field(128, 128, (u, v) => { const [f1, f2] = worley2(u * 26, v * 26, 91, 26); return clamp(f2 - f1) + fbm2(u * 60, v * 60, { oct: 2, seed: 95, period: 60 }) * 0.4; }), 128, 128, 3.5);
  return {
    stone: pbr({ map: stone, roughness: 0.6, normalMap: rep(lacN, 3, 2), normalScale: new THREE.Vector2(0.25, 0.25) }, { bake: { albedo: [0.68, 0.65, 0.56] } }),
    sage: pbr({ map: sage, roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.08, normalMap: rep(lacN, 2, 1.5), normalScale: new THREE.Vector2(0.18, 0.18) }, { phys: true, bake: { albedo: [0.17, 0.2, 0.085] } }),
    terra: pbr({ map: terra, roughness: 0.88, normalMap: terraN, normalScale: new THREE.Vector2(0.5, 0.5) }, { bake: { albedo: [0.4, 0.13, 0.055] } }),
    soil: pbr({ map: soilC, roughness: 0.97, normalMap: soilN, normalScale: new THREE.Vector2(1.2, 1.2) }, { bake: { albedo: [0.02, 0.013, 0.008] } }),
  };
}

// ------------------------------------------------------------------------------------------------
export function build(ctx) {
  const t0 = performance.now();
  const { M } = ctx;
  const g = group('plants');
  const lib = makeLeafLibrary();
  const S = { lib, leaves: lib.geo.map(() => []), tubes: new TubeSoup(), vines: [] };
  const PM = potMaterials();
  const put = (geo, mat, name, x, y, z) => { const m = mesh(geo.translate(x, y, z), mat, name); g.add(m); return m; };

  // ============ 1. the big one: high shelf on the left wall, right in the window corner ============
  {
    const sh = PLANT_SHELF, T = 0.02;
    const parts = [boxAt(sh.x0 + 0.0006, sh.y - T, sh.z0, sh.x1 - sh.x0 - 0.0006, T, sh.z1 - sh.z0, { r: 0.0025, rs: 2, maxEdge: 0.02 })];
    const br = [];
    for (const zc of [sh.z0 + 0.1, sh.z1 - 0.1]) {
      br.push(boxAt(0.0006, sh.y - T - 0.125, zc - 0.011, 0.0035, 0.125, 0.022, { r: 0.001, rs: 1, maxEdge: 0.03 }));
      br.push(boxAt(0.0006, sh.y - T - 0.0035, zc - 0.011, 0.165, 0.0035, 0.022, { r: 0.001, rs: 1, maxEdge: 0.03 }));
    }
    g.add(mesh(merge(parts), M.white, 'plantShelf'));
    g.add(mesh(merge(br), M.white, 'plantShelfBrackets'));

    const cx = 0.105, cz = 0.555, y0 = sh.y + 0.0004, H = 0.14, soil = 0.121;
    const prof = [[0, 0], [0.054, 0], [0.061, 0.0015], [0.0645, 0.006]];
    for (let k = 1; k <= 7; k++) { const y = 0.006 + (0.128 * k) / 7; prof.push([lerp(0.0645, 0.078, Math.pow((y - 0.006) / 0.128, 0.85)), y]); }
    prof.push([0.0786, 0.1365], [0.0782, 0.1392], [0.076, 0.1404], [0.0736, 0.1394], [0.0724, 0.136], [0.0716, 0.122], [0.0705, 0.105]);
    put(lathe(prof, 44), PM.stone, 'potBig', cx, y0, cz);
    put(soilDisc(0.0715, 3), PM.soil, 'soilBig', cx, y0 + soil, cz);
    const cu = CURTAIN.left;
    const env = new Env({
      minX: 0, minZ: 0, maxY: ROOM.H - 0.008,
      boxes: [
        { b: [0, sh.y - T - 0.002, sh.z0 - 0.001, sh.x1 + 0.0015, sh.y, sh.z1 + 0.001] },
        { b: [cu[0] - 0.012, 0, 0, cu[1] + 0.012, 2.47, 0.288], faces: '-x+x+z' },          // curtain panel
        { b: [0.215, CURTAIN.rodY - 0.04, CURTAIN.z - 0.05, 2.8, CURTAIN.rodY + 0.04, CURTAIN.z + 0.05] },  // rod
        { b: [0.262, CURTAIN.rodY - 0.035, 0, 0.322, CURTAIN.rodY + 0.035, CURTAIN.z] },                     // its wall bracket
      ],
      pots: [{ x: cx, z: cz, rOut: 0.079, rIn: 0.0715, y0, yRim: y0 + H, ySoil: y0 + soil }],
    });
    const hang = { b0: 0.22, b1: 0.1, ramp: 0.3, hook: 0.38 }, arch = { hook: 0.42, hookLen: 0.18 };
    growPlant(S, {
      seed: 4041, cx, cz, rIn: 0.0715, rimY: y0 + H, soilY: y0 + soil, env, light: V(1.5, 1.55, -0.3), bias: V(0.45, 0, 0.9).normalize(),
      size: [0.078, 0.118], stemR: [0.0027, 0.0015], inter: [0.032, 0.054], bare: 0.07, seg: 0.014,
      vines: [
        // into the corner: along the shelf, off its end, down between the wall and the curtain
        { th: -90, el: 38, len: 1.5, ...hang }, { th: -74, el: 45, len: 1.12, ...hang }, { th: -60, el: 35, len: 0.82, ...hang },
        // over the front edge of the shelf
        { th: -40, el: 40, len: 1.3, ...hang }, { th: -24, el: 30, len: 0.9, ...hang }, { th: -6, el: 42, len: 1.55, ...hang },
        { th: 12, el: 33, len: 1.05, ...hang }, { th: 30, el: 36, len: 1.35, ...hang }, { th: 48, el: 40, len: 0.72, ...hang },
        // off the room-side end of the shelf
        { th: 64, el: 38, len: 1.15, ...hang }, { th: 78, el: 45, len: 0.75, ...hang }, { th: 92, el: 35, len: 1.4, ...hang }, { th: 86, el: 50, len: 1.0, ...hang },
        // reaching for the light: long arcs out in front of the curtain and across the corner of the window
        { th: -22, el: 34, len: 1.75, b0: 0.012, b1: 0.085, ramp: 0.7, ...arch }, { th: -10, el: 30, len: 1.5, b0: 0.014, b1: 0.085, ramp: 0.6, ...arch },
        { th: 6, el: 36, len: 2.05, b0: 0.011, b1: 0.08, ramp: 0.75, ...arch }, { th: -16, el: 38, len: 1.3, b0: 0.016, b1: 0.09, ramp: 0.5, ...arch },
        { th: -3, el: 32, len: 1.9, b0: 0.012, b1: 0.08, ramp: 0.7, ...arch }, { th: -13, el: 44, len: 1.6, b0: 0.01, b1: 0.08, ramp: 0.85, ...arch },
        { th: 2, el: 28, len: 1.15, b0: 0.016, b1: 0.09, ramp: 0.55, ...arch },
      ],
      shoots: { n: 22, th: [-105, 105], len: [0.06, 0.2] },
    });
  }

  // ============ 2. small bushy one on the windowsill, spilling over in front of the radiator ============
  {
    const cx = 1.62, cz = -0.05, y0 = ROOM.win.y0 + 0.002 + 0.0003, py = y0 + 0.0055, H = 0.1062, soil = 0.092;
    const sau = [[0, 0.004], [0.05, 0.004], [0.056, 0], [0.062, 0], [0.066, 0.004], [0.0685, 0.011], [0.0677, 0.0126], [0.0655, 0.0116], [0.063, 0.0062], [0.05, 0.0055], [0, 0.0055]];
    const prof = [[0, 0.003], [0.036, 0.003], [0.04, 0], [0.0445, 0], [0.048, 0.004], [0.0505, 0.012], [0.053, 0.03], [0.0555, 0.05], [0.0575, 0.07], [0.059, 0.088], [0.06, 0.098], [0.0612, 0.102], [0.0606, 0.1054], [0.058, 0.1062], [0.0556, 0.1046], [0.0548, 0.1], [0.054, 0.085], [0.0535, 0.07]];
    put(lathe(sau, 40), PM.sage, 'saucerSill', cx, y0, cz);
    put(lathe(prof, 40), PM.sage, 'potSill', cx, py, cz);
    put(soilDisc(0.0542, 11), PM.soil, 'soilSill', cx, py + soil, cz);
    const env = new Env({
      minZ: -0.125, maxY: 2.2,
      boxes: [
        { b: [0.3, -1, -1, 2.7, y0, 0.048], faces: '+y+z' },                                                        // sill board and the wall under it
        { b: [RADIATOR.x0 - 0.04, 0.06, -1, RADIATOR.x1 + 0.04, RADIATOR.y1 + 0.03, RADIATOR.z1 + 0.012], faces: '+z' },
      ],
      pots: [{ x: cx, z: cz, rOut: 0.0688, rIn: 0.054, y0, yRim: py + H, ySoil: py + soil }],
    });
    const sp = { b0: 0.15, b1: 0.1, ramp: 0.3, hook: 0.4, hookLen: 0.12 };
    growPlant(S, {
      seed: 5077, cx, cz, rIn: 0.054, rimY: py + H, soilY: py + soil, env, light: V(1.62, 2.0, -0.7), bias: V(0, 0, 1),
      size: [0.056, 0.09], stemR: [0.0021, 0.0012], inter: [0.03, 0.05], bare: 0.04, seg: 0.01,
      vines: [
        { th: 95, el: 40, len: 0.62, ...sp }, { th: 68, el: 35, len: 0.5, ...sp }, { th: 118, el: 45, len: 0.72, ...sp },
        { th: 172, el: 35, len: 0.24, b0: 0.05, b1: 0.15, ramp: 0.12, hook: 0.5, hookLen: 0.1 }, { th: 12, el: 30, len: 0.2, b0: 0.05, b1: 0.15, ramp: 0.12, hook: 0.5, hookLen: 0.1 },
        { th: 150, el: 50, len: 0.2, b0: 0.04, b1: 0.12, ramp: 0.15, hook: 0.5, hookLen: 0.1 }, { th: 35, el: 55, len: 0.22, b0: 0.04, b1: 0.12, ramp: 0.15, hook: 0.5, hookLen: 0.1 },
      ],
      shoots: { n: 21, th: [-30, 210], len: [0.05, 0.16] },
    });
  }

  // ============ 3. on the upper wall shelf above the desk ============
  {
    const cx = 3.58, cz = 0.11, y0 = SHELVES.y[1] + 0.0004, py = y0 + 0.0055, H = 0.1105, soil = 0.094;
    const sau = [[0, 0.004], [0.05, 0.004], [0.056, 0], [0.061, 0], [0.065, 0.004], [0.0675, 0.012], [0.0665, 0.0135], [0.0643, 0.0125], [0.062, 0.0062], [0.05, 0.0055], [0, 0.0055]];
    const prof = [[0, 0], [0.04, 0], [0.043, 0.002], [0.0445, 0.008]];
    for (let k = 1; k <= 5; k++) prof.push([lerp(0.0445, 0.058, k / 5), lerp(0.008, 0.086, k / 5)]);
    prof.push([0.0588, 0.0878], [0.0626, 0.089], [0.0637, 0.092], [0.0646, 0.1075], [0.0636, 0.11], [0.06, 0.1105], [0.0576, 0.109], [0.057, 0.095], [0.056, 0.08]);
    put(lathe(sau, 40), PM.terra, 'saucerShelf', cx, y0, cz);
    put(lathe(prof, 40), PM.terra, 'potShelf', cx, py, cz);
    put(soilDisc(0.0572, 23), PM.soil, 'soilShelf', cx, py + soil, cz);
    const env = new Env({
      minZ: 0, maxY: ROOM.H - 0.008,
      boxes: [
        { b: [SHELVES.x0 - 0.01, SHELVES.y[0] - 0.04, 0, SHELVES.x1 + 0.01, y0, SHELVES.depth + 0.004], faces: '+y+z' },   // both boards and whatever stands between them
        { b: [WARDROBE.x0 - 0.008, 0, 0, ROOM.W, WARDROBE.h + 0.02, WARDROBE.z1 + 0.02], faces: '-x+y+z' },
        { b: [SHELVES.x0 - 0.01, y0, 0, 3.385, y0 + 0.47, SHELVES.depth], faces: '+x+y+z' },                  // the left part of that shelf is taken (frame, vase of dried stems)
      ],
      pots: [{ x: cx, z: cz, rOut: 0.0678, rIn: 0.057, y0, yRim: py + H, ySoil: py + soil }],
    });
    const sp = { b0: 0.22, b1: 0.1, ramp: 0.3, hook: 0.38, hookLen: 0.13 };
    growPlant(S, {
      seed: 6113, cx, cz, rIn: 0.057, rimY: py + H, soilY: py + soil, env, light: V(1.5, 1.6, -0.2), bias: V(-0.35, 0, 0.94).normalize(),
      size: [0.062, 0.1], stemR: [0.0024, 0.0013], inter: [0.032, 0.054], bare: 0.05, seg: 0.012,
      vines: [
        { th: 85, el: 38, len: 0.8, ...sp }, { th: 110, el: 42, len: 0.62, ...sp }, { th: 62, el: 35, len: 0.88, ...sp }, { th: 128, el: 40, len: 0.5, ...sp },
        { th: 98, el: 50, len: 0.38, ...sp }, { th: 74, el: 46, len: 0.56, ...sp }, { th: 140, el: 44, len: 0.7, ...sp },
      ],
      shoots: { n: 19, th: [5, 175], len: [0.05, 0.16] },
    });
  }

  // ---------------- stems (vines + petioles + aerial roots), one mesh
  const stemMat = pbr({ color: 0xffffff, vertexColors: true, roughness: 0.55 }, { bake: { albedo: [0.1, 0.16, 0.04] } });
  g.add(mesh(merge([...S.vines, S.tubes.geometry()]), stemMat, 'stems'));

  // ---------------- leaves: one InstancedMesh per blade variant, one baked light sample per leaf
  let nLeaves = 0;
  S.leaves.forEach((list, vi) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(lib.geo[vi], lib.mat[vi], list.length);
    im.name = 'leaves' + vi;
    list.forEach((l, i) => { im.setMatrixAt(i, l.m); im.setColorAt(i, l.col); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    im.userData.giInstanced = true; im.userData.giNormal = V(0, 0, 1); im.userData.giAnchor = V(0, ANCHOR_Y, 0);
    im.computeBoundingSphere();
    g.add(im); nLeaves += list.length;
  });
  console.log(`[boot] plants: ${nLeaves} leaves, ${S.vines.length} stems, ${(performance.now() - t0).toFixed(0)} ms`);
  return g;
}
