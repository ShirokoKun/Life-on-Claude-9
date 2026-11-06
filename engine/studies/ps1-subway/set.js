// The car: a late-night commuter train on an invented line (the Harrow Loop), built for one eye-level frame.
// Everything is low poly; the detail lives in hand-painted pixel textures (64 texels per metre on the walls),
// including the "baked" light: grime in corners, darker panel bottoms, worn aisle, sun-faded ads.
// Coordinates: three.js metres, y up. The car runs along x; the far wall is z = -W, the near wall z = +W.
import * as THREE from 'three';
import { ps1Material, ps1Unlit, paint, rng, fbm, hash2 } from '../lib/ps1.js';
import { box, quad, extrude } from '../lib/geo.js';

export const W = 1.45;                 // half width of the interior
export const X0 = -15.5, X1 = 4.2;     // car ends
const CEIL = 2.36, SLOPE_Y = 2.1, SLOPE_Z = 0.55, AD_D = 0.14;
const WIN_Y0 = 0.98, WIN_Y1 = 1.86;    // window band
export const DOORS = [-3.0, -11.0];    // door bay centres (both sides)
export const SECTIONS = [[-15.5, -11.75], [-10.25, -3.75], [-2.25, 3.45]];

// ------------------------------------------------------------------ palette (sRGB)
const C = {
  wall: '#8a8a6c', wallDk: '#5d5d47', post: '#9c9b80', gasket: '#23241f', ceil: '#b8b59e',
  vinyl: '#86321f', vinylDk: '#5a1f13', vinylHi: '#a54a33', steel: '#8d928e', steelDk: '#5b605d',
  floor: '#3f4547', ad: '#6a6956',
};

// ------------------------------------------------------------------ textures
const R = rng(9);

// shared grime: darker toward the bottom and the edges, low-frequency stains
function grime(P, seed, { bottom = 0.35, edge = 0.25, stain = 16 } = {}) {
  P.mottle(stain, seed, 0.09);
  P.shade((x, y) => Math.pow(y / P.h, 3) * bottom + (Math.min(x, P.w - 1 - x) < 2 ? edge : 0), 1, [20, 20, 14]);
  P.noise(5, seed + 3);
}

function roundHole(x0, y0, x1, y1, r) {   // inside test for a rounded rectangle
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
}

// a spray tag: a looping stroke with an outline, optional drips
function tag(P, x, y, w, h, fill, outline, seed, { drips = true, thick = 2 } = {}) {
  const r = rng(seed); const pts = [];
  let px = x, py = y + h * 0.6;
  const n = 7 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const nx = x + (w * (i + r() * 0.6)) / n, ny = y + h * (0.15 + r() * 0.75);
    for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push([px + (nx - px) * u, py + (ny - py) * u + Math.sin(u * Math.PI) * (r() - 0.5) * h * 0.6]); }
    px = nx; py = ny;
  }
  for (const [a, b] of pts) for (let dy = -thick; dy <= thick; dy++) for (let dx = -thick; dx <= thick; dx++) P.px(a + dx, b + dy, outline);
  for (const [a, b] of pts) for (let dy = -thick + 1; dy < thick; dy++) for (let dx = -thick + 1; dx < thick; dx++) P.px(a + dx, b + dy, fill);
  if (drips) for (let i = 0; i < 3; i++) { const [a, b] = pts[Math.floor(r() * pts.length)]; const L = 2 + Math.floor(r() * 6); P.rect(a, b, 1, L, fill, 200); }
}

// window module: the wall around one window, the window itself transparent
function moduleTex(variant, wPx = 100, hPx = 56) {
  return paint(wPx, hPx, (ctx, P) => {
    P.fill(C.wall);
    grime(P, 40 + variant, { bottom: 0.18, edge: 0.0 });
    const inside = roundHole(7, 5, wPx - 8, hPx - 7, 6), ring = roundHole(5, 3, wPx - 6, hPx - 5, 7);
    P.each((x, y, c) => {
      if (inside(x, y)) return [0, 0, 0, 0];
      if (ring(x, y)) return [35, 36, 31, 255];
      return null;
    });
    // highlight on the sill edge (light from above), soot under it
    for (let x = 6; x < wPx - 6; x++) { P.px(x, hPx - 5, '#b1af93', 160); P.px(x, hPx - 4, '#4c4c3b', 120); }
    // posts between windows: slightly lighter, with a seam
    P.rect(0, 0, 3, hPx, C.post, 140); P.rect(wPx - 3, 0, 3, hPx, C.post, 140);
    if (variant === 1) {   // the no-smoking sticker, by her head (she ignores it)
      const sx = 1, sy = 14; P.rect(sx, sy, 6, 8, '#e8e4d6'); P.disc(sx + 3, sy + 3, 2, '#c22a1e'); P.disc(sx + 3, sy + 3, 1, '#e8e4d6');
      P.line(sx + 1, sy + 5, sx + 5, sy + 1, '#c22a1e'); P.rect(sx + 1, sy + 6, 4, 1, '#333');
    }
    if (variant === 2) tag(P, 10, hPx - 13, 30, 9, '#c9c6b5', '#2a2a2a', 77, { thick: 1 });
    if (variant === 3) for (let i = 0; i < 4; i++) P.rect(12 + i * 3, 2, 1, 2, '#3a3a30');
  }, { wrap: false });
}

// glass: faint, with scratched-in tags (scratchiti) and smears
function glassTex() {
  return paint(100, 56, (ctx, P) => {
    P.each(() => [6, 10, 10, 115]);
    const r = rng(5);
    for (let i = 0; i < 3; i++) {
      let x = 20 + r() * 60, y = 15 + r() * 25;
      for (let k = 0; k < 40; k++) { x += (r() - 0.5) * 3; y += (r() - 0.45) * 1.5; P.px(x, y, '#8a9a9a', 90); }
    }
    P.each((x, y, c, a) => { const s = fbm(x * 0.05, y * 0.12, 3); return s > 0.62 ? [30, 36, 36, 150] : null; });
  }, { wrap: false });
}

// the panels at bench ends: map, intercom, notices, tags
function endPanelTex(kind) {
  const w = 30, h = 58;
  return paint(w, h, (ctx, P) => {
    P.fill(C.wall); grime(P, 60 + kind.length, { bottom: 0.25 });
    if (kind === 'map') {
      P.rect(3, 6, 24, 34, '#d4cbae'); P.rect(3, 6, 24, 2, '#2d4f7c');
      const lines = [['#c8382b', [[5, 14], [12, 18], [18, 17], [25, 24]]], ['#2f7d4f', [[6, 34], [11, 26], [15, 21], [24, 12]]], ['#d5a020', [[4, 24], [14, 25], [20, 31], [25, 36]]]];
      for (const [col, pts] of lines) for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col);
      for (const [col, pts] of lines) for (const [x, y] of pts) P.rect(x, y, 1, 1, '#ffffff');
      P.rect(3, 40, 24, 1, '#5a5442'); P.mottle(10, 4, 0.2);
      tag(P, 4, 44, 22, 9, '#7a3fae', '#1d1530', 31);
    } else if (kind === 'intercom') {
      P.rect(9, 18, 12, 17, '#9b9f99'); P.rect(10, 19, 10, 6, '#2c2e2c');
      for (let i = 0; i < 4; i++) P.rect(11 + i * 2, 20, 1, 4, '#777');
      P.disc(15, 30, 2, '#c9271e'); P.rect(9, 37, 12, 3, '#e3c341'); P.text('SOS', 10, 38, '#000', 1, 0);
      tag(P, 2, 44, 25, 10, '#3a7bd5', '#0d1d33', 12);
    } else {
      tag(P, 3, 10, 24, 12, '#d8d2c0', '#26261f', 51); tag(P, 2, 32, 26, 14, '#2f8f86', '#102522', 52);
    }
  }, { wrap: false });
}

// ad cards in the slanted strip above the windows (invented brands only)
const ADS = [
  { bg: '#d9c48a', fg: '#7a1d14', l1: 'NOODLE KING', l2: 'OPEN 24H', art: 'bowl' },
  { bg: '#1d3150', fg: '#e8d9a8', l1: 'SLEEP IS', l2: 'A SERVICE', art: 'moon' },
  { bg: '#b8342a', fg: '#f3e6c8', l1: 'LOST?', l2: 'CALL 0800 9', art: 'arrow' },
  { bg: '#d6d2c4', fg: '#2b2b2b', l1: 'DR. HALE', l2: 'TEETH NOW', art: 'tooth' },
  { bg: '#2c5e3f', fg: '#e9e2b5', l1: 'HARROW', l2: 'LOOP', art: 'loop' },
];
function adTex(i) {
  const a = ADS[i % ADS.length], w = 128, h = 22;
  return paint(w, h, (ctx, P) => {
    P.fill(C.ad); P.rect(3, 2, w - 6, h - 4, a.bg);
    P.text(a.l1, 26, 4, a.fg, 1); P.text(a.l2, 26, 12, a.fg, 1);
    const x = 8, y = 5;
    if (a.art === 'bowl') { P.rect(x, y + 6, 12, 4, '#ffffff'); P.rect(x + 1, y + 10, 10, 2, '#e0e0e0'); for (let i = 0; i < 3; i++) P.rect(x + 3 + i * 3, y, 1, 6, a.fg); }
    if (a.art === 'moon') { P.disc(x + 6, y + 6, 5, '#e8d9a8'); P.disc(x + 8, y + 4, 4, a.bg); }
    if (a.art === 'arrow') { P.rect(x, y + 5, 10, 3, a.fg); for (let k = 0; k < 5; k++) P.rect(x + 9 + k, y + 1 + k, 1, 11 - k * 2, a.fg); }
    if (a.art === 'tooth') { P.rect(x + 1, y, 10, 7, '#ffffff'); P.rect(x + 2, y + 7, 3, 5, '#ffffff'); P.rect(x + 7, y + 7, 3, 5, '#ffffff'); }
    if (a.art === 'loop') { P.disc(x + 6, y + 6, 6, '#e9e2b5'); P.disc(x + 6, y + 6, 4, a.bg); P.rect(x + 9, y + 1, 4, 3, '#c8382b'); }
    P.mottle(14, 20 + i, 0.15);                            // sun-faded, smudged
    P.shade((x2, y2) => (y2 < 3 ? 0.6 : 0) + (x2 < 3 || x2 > w - 4 ? 0.4 : 0), 1, [30, 30, 24]);
    if (i === 1) tag(P, 70, 6, 40, 11, '#e44a8a', '#3a0f22', 90, { drips: false, thick: 1 });
  }, { wrap: false });
}

function vinylTex() {   // one seat: u = across the profile (0.5 m), v = along the car (one seat 0.48 m)
  return paint(32, 32, (ctx, P) => {
    P.fill(C.vinyl);
    P.each((x, y, c) => { const k = 1 - Math.abs(y - 16) / 16; const s = 0.85 + 0.25 * k; return [c[0] * s, c[1] * s, c[2] * s]; });
    P.mottle(14, 7, 0.12, [1, 0.6, 0.5]);
    for (let x = 0; x < 32; x++) { P.px(x, 0, C.vinylDk); P.px(x, 31, C.vinylDk); P.px(x, 1, '#6a2617', 150); }
    for (let i = 0; i < 18; i++) { const x = Math.floor(R() * 32), y = 3 + Math.floor(R() * 26); P.px(x, y, i % 3 ? C.vinylHi : '#3d150c', 160); }
    P.noise(6, 8);
  }, { repeat: [2, 1 / 0.48] });
}

function skirtTex() {   // stainless panel under the seats with a heater grille
  return paint(64, 24, (ctx, P) => {
    P.fill(C.steel); P.mottle(16, 11, 0.1);
    for (let x = 6; x < 58; x += 3) P.rect(x, 7, 2, 9, '#2b2e2c');
    P.rect(5, 6, 54, 1, '#b4b8b2'); P.rect(5, 16, 54, 1, '#4c504d');
    P.shade((x, y) => Math.pow(y / 24, 2), 0.7, [15, 15, 12]);
    P.noise(6, 12);
  }, { repeat: [1, 1] });
}

function floorTex() {   // u along the car (1 m), v across the full width
  const w = 64, h = 186;
  return paint(w, h, (ctx, P) => {
    P.fill(C.floor);
    P.each((x, y, c) => {
      const across = Math.abs(y - h / 2) / (h / 2);                 // 0 aisle centre, 1 at the walls
      const wear = Math.max(0, 1 - across * 1.6) * 14;              // the worn path down the aisle
      const edge = Math.pow(across, 6) * 40;                        // grime at the walls
      const sp = hash2(x, y, 3), fl = sp > 0.93 ? 26 : sp < 0.06 ? -18 : 0;   // rubber speckle
      const m = (fbm(x * 0.07, y * 0.05, 5) - 0.5) * 22;
      const v = wear - edge + fl + m;
      return [c[0] + v, c[1] + v * 1.02, c[2] + v * 1.05];
    });
    const r = rng(14);
    for (let i = 0; i < 9; i++) { const x = r() * w, y = h * 0.3 + r() * h * 0.4; P.disc(x, y, 1, '#24282a', 200); }   // gum
  }, { repeat: [1, 1] });
}

function ceilTex() {
  return paint(64, 64, (ctx, P) => {
    P.fill(C.ceil); P.mottle(12, 21, 0.06);
    for (let x = 0; x < 64; x++) P.px(x, 0, '#8c8a75');
    for (let y = 4; y < 64; y += 16) for (let x = 2; x < 64; x += 8) P.px(x, y, '#77755f');   // rivets
    P.noise(4, 22);
  });
}

function doorTex(left) {
  const w = 42, h = 126;
  return paint(w, h, (ctx, P) => {
    P.fill(C.steel); P.mottle(18, left ? 31 : 32, 0.07);
    const inside = roundHole(7, 16, w - 8, 62, 4), ring = roundHole(5, 14, w - 6, 64, 5);
    P.each((x, y) => (inside(x, y) ? [0, 0, 0, 0] : ring(x, y) ? [30, 31, 29, 255] : null));
    P.rect(left ? w - 3 : 0, 0, 3, h, '#2a2b28');                                // the rubber seal at the meeting edge
    P.rect(0, h - 22, w, 22, C.steelDk); for (let x = 2; x < w; x += 4) P.rect(x, h - 20, 2, 18, '#6d726e');   // kick plate
    if (left) { P.rect(6, 70, 30, 9, '#e0c13c'); P.text('MIND', 9, 71, '#1a1a1a', 1); }   // sticker
    else { P.rect(8, 70, 22, 6, '#c22a1e'); P.rect(10, 72, 18, 2, '#f0e8d8'); }
    tag(P, 3, 84, 34, 16, left ? '#b54ad6' : '#e9e3cf', left ? '#2b0f38' : '#262626', left ? 61 : 62);
    P.shade((x, y) => Math.pow(y / h, 4), 0.5, [10, 10, 10]); P.noise(5, 33);
  }, { wrap: false });
}

function tunnelTex() {   // 8 m of tunnel wall, scrolled past the windows
  const w = 256, h = 96;
  return paint(w, h, (ctx, P) => {
    P.fill('#24251f'); P.mottle(22, 41, 0.04);
    P.each((x, y, c) => { const s = fbm(x * 0.03, y * 0.2, 44); return s > 0.6 ? [c[0] - 10, c[1] - 10, c[2] - 8] : null; });
    for (let x = 0; x < w; x += 64) P.rect(x, 0, 2, h, '#141511');                // ring joints
    for (const y of [30, 34, 37]) { P.rect(0, y, w, 2, '#121310'); P.rect(0, y - 1, w, 1, '#3c3d33'); }   // cable runs
    for (let x = 10; x < w; x += 32) P.rect(x, 28, 2, 12, '#3a3b31');               // brackets
    P.noise(8, 45);
  }, { repeat: [1, 1] });
}

function diffuserTex() {
  return paint(8, 32, (ctx, P) => {
    P.each((x, y) => { const k = 1 - Math.abs(x - 3.5) / 5; const r = y % 4 === 0 ? 0.86 : 1; return [255 * r * (0.88 + 0.12 * k), 246 * r * (0.88 + 0.12 * k), 222 * r * (0.86 + 0.14 * k)]; });
  });
}

function signTex() {   // dot-matrix destination sign above the door
  const w = 96, h = 12;
  return paint(w, h, (ctx, P) => {
    P.fill('#0c0b09');
    P.text('NEXT>VESPER ST', 6, 3, '#ff8a2a', 1);
    P.each((x, y, c) => (x % 2 === 1 || y % 2 === 1) && c[0] > 100 ? [c[0] * 0.55, c[1] * 0.5, c[2] * 0.4] : null);
  }, { wrap: false });
}

// ------------------------------------------------------------------ build
export function buildSet(scene) {
  const g = new THREE.Group(); scene.add(g);
  const M = {
    vinyl: ps1Material({ map: vinylTex() }),
    skirt: ps1Material({ map: skirtTex() }),
    floor: ps1Material({ map: floorTex() }),
    ceil: ps1Material({ map: ceilTex() }),
    wall: ps1Material({ map: paint(32, 32, (c, P) => { P.fill(C.wall); grime(P, 70); }) }),
    post: ps1Material({ color: '#a3a28a' }),
    trim: ps1Material({ color: '#4a4b42' }),
    pole: ps1Material({ map: paint(4, 16, (c, P) => { P.each((x) => { const v = [205, 214, 175, 120][x]; return [v, v * 1.0, v * 0.96]; }); }) }),
    strap: ps1Material({ color: '#1f201c' }),
    handle: ps1Material({ color: '#d9d4c0' }),
    diffuser: ps1Unlit({ map: diffuserTex() }),
    housing: ps1Material({ color: '#9a9884' }),
    glass: ps1Unlit({ map: glassTex(), transparent: true, depthWrite: false }),
    tunnel: ps1Material({ map: tunnelTex() }),
    sign: ps1Unlit({ map: signTex() }),
    black: ps1Unlit({ color: '#050605' }),
  };
  M.diffFlicker = ps1Unlit({ map: M.diffuser.map });
  const dyn = { tunnels: [], lamps: [], flicker: [] };
  const add = (geo, mat, x, y, z, ry = 0, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };

  // floor, ceiling (center flat + two slopes), end walls
  const L = X1 - X0, XM = (X0 + X1) / 2;
  const fl = add(quad(L, 2 * W), M.floor, XM, 0, 0); fl.rotation.x = -Math.PI / 2;
  M.floor.map.repeat.set(L, 1);
  const ce = add(quad(L, 2 * SLOPE_Z, 1), M.ceil, XM, CEIL, 0); ce.rotation.x = Math.PI / 2;
  // ceiling vent strip down the middle
  add(box(L, 0.02, 0.16, 1), M.trim, XM, CEIL - 0.01, 0);

  for (const end of [X0, X1]) {
    const s = end === X0 ? 1 : -1;
    const wall = add(quad(2 * W, CEIL, 1), M.wall, end + s * 0.001, CEIL / 2, 0, s * Math.PI / 2);
    if (end === X0) {   // the end door into the next car: a lit window at the vanishing point
      const fr = new THREE.Group(); fr.position.set(end + 0.02, 0, 0); g.add(fr);
      add(box(0.04, 1.95, 0.8, 1), M.post, 0, 0.975, 0, 0, fr);
      const win = add(quad(0.42, 0.62), ps1Unlit({ color: '#e9d6a4' }), 0.03, 1.38, 0, Math.PI / 2, fr);
      add(box(0.02, 0.68, 0.48, 1), M.trim, 0.025, 1.38, 0, 0, fr);
      win.position.x = 0.04;
      dyn.endGlow = win;
    }
  }

  // ---------------------------------------------------------------- one side (built for the far wall; mirrored for the near)
  const sideTex = { mods: [0, 1, 2, 3].map((v) => moduleTex(v)), ends: { map: endPanelTex('map'), intercom: endPanelTex('intercom'), tags: endPanelTex('tags') }, ads: ADS.map((_, i) => adTex(i)), doorL: doorTex(true), doorR: doorTex(false) };
  const matCache = new Map();
  const texMat = (t, opts = {}) => { if (!matCache.has(t)) matCache.set(t, ps1Material({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, ...opts })); return matCache.get(t); };

  function buildSide(near) {
    const sg = new THREE.Group(); g.add(sg);
    if (near) sg.scale.z = -1;
    const zW = -W;
    let adI = near ? 2 : 0, modI = near ? 2 : 0;

    // slope + ad strip + upper strip, full length
    const slopeLen = Math.hypot(W - AD_D - SLOPE_Z, CEIL - SLOPE_Y);
    const sl = add(quad(L, slopeLen, 1), M.ceil, XM, (CEIL + SLOPE_Y) / 2, -(SLOPE_Z + (W - AD_D)) / 2, 0, sg);
    sl.rotation.x = Math.PI / 2 - Math.atan2(CEIL - SLOPE_Y, W - AD_D - SLOPE_Z);
    add(quad(L, WIN_Y0, 1), M.wall, XM, WIN_Y0 / 2, zW + 0.001, 0, sg);              // wall behind the benches
    add(box(L, 0.06, 0.03, 1), M.trim, XM, WIN_Y1 + 0.03, zW + 0.015, 0, sg);         // the rail under the ad strip

    // light fixtures on the slope, nearly continuous
    for (let x = X0 + 0.9; x < X1 - 0.5; x += 1.55) {
      const fx = new THREE.Group(); fx.position.set(x, 2.24, -0.86); fx.rotation.x = sl.rotation.x - Math.PI / 2; sg.add(fx);
      add(box(1.3, 0.05, 0.2, 1), M.housing, 0, 0.0, 0, 0, fx);
      const d = add(quad(1.24, 0.15), M.diffuser, 0, -0.026, 0, 0, fx); d.rotation.x = Math.PI / 2;
      if (Math.abs(x - -6.85) < 0.8 && !near) { d.material = M.diffFlicker; dyn.flicker.push(d); }
    }

    for (const [s0, s1] of SECTIONS) {
      const len = s1 - s0;
      // bench: one extrusion (seat + back) and the steel skirt
      const prof = [[0, 0.38], [0.45, 0.38], [0.48, 0.41], [0.48, 0.452], [0.45, 0.476], [0.11, 0.476], [0.085, 0.53], [0.05, 0.93], [0.025, 0.968], [0, 0.968]];
      const bench = add(extrude(prof, len - 0.1), M.vinyl, s1 - 0.05, 0, zW, -Math.PI / 2, sg);
      bench.userData.kind = 'bench';
      add(box(len - 0.1, 0.38, 0.02, 1), M.skirt, (s0 + s1) / 2, 0.19, zW + 0.43, 0, sg);
      // end panels + window modules in the window band
      const panelW = 0.45, span = len - 2 * panelW, n = Math.max(1, Math.round(span / 1.55)), mw = span / n;
      const kinds = s0 === -2.25 ? ['map', 'tags'] : s0 === -10.25 ? ['intercom', 'map'] : ['tags', 'intercom'];
      [[s0 + panelW / 2, kinds[0]], [s1 - panelW / 2, kinds[1]]].forEach(([x, k]) => {
        add(quad(panelW, WIN_Y1 - WIN_Y0), texMat(sideTex.ends[k]), x, (WIN_Y0 + WIN_Y1) / 2, zW + 0.002, 0, sg);
      });
      for (let i = 0; i < n; i++) {
        const x = s0 + panelW + mw * (i + 0.5);
        const variant = !near && s0 === -2.25 && i === 1 ? 1 : (modI++ % 4 === 1 ? 0 : modI % 4);
        add(quad(mw, WIN_Y1 - WIN_Y0), texMat(sideTex.mods[variant]), x, (WIN_Y0 + WIN_Y1) / 2, zW + 0.002, 0, sg);
        add(quad(mw - 0.1, WIN_Y1 - WIN_Y0 - 0.1), M.glass, x, (WIN_Y0 + WIN_Y1) / 2, zW - 0.05, 0, sg);
        add(box(mw - 0.12, 0.025, 0.07, 1), M.post, x, WIN_Y0 + 0.07, zW - 0.02, 0, sg);    // the sill
      }
      // ad strip: slanted cards, one per window-ish
      const nAds = Math.max(1, Math.round(len / 1.5)), aw = len / nAds;
      for (let i = 0; i < nAds; i++) {
        const x = s0 + aw * (i + 0.5);
        const ad = add(quad(aw - 0.02, 0.235), texMat(sideTex.ads[adI++ % ADS.length], { alphaTest: 0 }), x, (WIN_Y1 + 0.06 + SLOPE_Y) / 2 + 0.02, zW + AD_D / 2, 0, sg);
        ad.rotation.x = Math.atan2(AD_D, SLOPE_Y - WIN_Y1 - 0.06);
      }
      // stanchions at the bench ends, a grab rail above, and straps
      for (const x of [s0 + 0.06, s1 - 0.06]) add(new THREE.CylinderGeometry(0.019, 0.019, CEIL - 0.12, 6), M.pole, x, (CEIL - 0.12) / 2, zW + 0.52, 0, sg);
      const rail = add(new THREE.CylinderGeometry(0.016, 0.016, len - 0.12, 6), M.pole, (s0 + s1) / 2, 1.98, zW + 0.52, 0, sg); rail.rotation.z = Math.PI / 2;
      for (let x = s0 + 0.5; x < s1 - 0.3; x += 0.62) {
        const swing = (hash2(Math.round(x * 10), near ? 1 : 0) - 0.5) * 0.12;
        const st = new THREE.Group(); st.position.set(x, 1.98, zW + 0.52); st.rotation.x = swing; sg.add(st);
        add(box(0.025, 0.2, 0.006, 1), M.strap, 0, -0.1, 0, 0, st);
        const h = add(new THREE.TorusGeometry(0.045, 0.009, 4, 8), M.handle, 0, -0.245, 0, 0, st);
        dyn.straps = dyn.straps || []; dyn.straps.push(st);
      }
      // the glass + tunnel behind this section
      const tun = add(quad(len + 2, 3.2), M.tunnel, (s0 + s1) / 2, 1.2, zW - 0.9, 0, sg);
      dyn.tunnels.push(tun);
    }

    // door bays: frames, two leaves with windows, a threshold, the sign above
    for (const dx of DOORS) {
      for (const s of [-1, 1]) add(box(0.09, 2.02, 0.08, 1), M.post, dx + s * 0.7, 1.01, zW + 0.03, 0, sg);
      add(box(1.5, CEIL - 2.02, 0.06, 1), M.wall, dx, (2.02 + SLOPE_Y) / 2, zW + 0.02, 0, sg);
      add(quad(0.65, 1.95), texMat(sideTex.doorL), dx - 0.325, 0.975 + 0.02, zW + 0.012, 0, sg);
      add(quad(0.65, 1.95), texMat(sideTex.doorR), dx + 0.325, 0.975 + 0.02, zW + 0.012, 0, sg);
      add(quad(1.2, 0.75), M.glass, dx, 1.37, zW - 0.04, 0, sg);
      add(box(1.4, 0.012, 0.3, 1), M.skirt, dx, 0.006, zW + 0.15, 0, sg);
      if (!near) add(quad(0.64, 0.08), M.sign, dx, 2.07, zW + 0.06, 0, sg);
      add(box(0.7, 0.11, 0.05, 1), M.trim, dx, 2.07, zW + 0.03, 0, sg);
      add(new THREE.CylinderGeometry(0.02, 0.02, CEIL, 6), M.pole, dx, CEIL / 2, near ? -0.0 : 0.0, 0, sg);
      const tun = add(quad(2.2, 3.2), M.tunnel, dx, 1.2, zW - 0.9, 0, sg); dyn.tunnels.push(tun);
    }
    // tunnel lamps: sodium-ish streaks passing the windows (moved in update)
    for (let i = 0; i < 7; i++) {
      const lamp = add(box(0.9, 0.05, 0.02, 1), ps1Unlit({ color: '#ffe0a8' }), 0, 1.55, zW - 0.85, 0, sg);
      lamp.userData.i = i; dyn.lamps.push(lamp);
    }
    return sg;
  }
  buildSide(false); buildSide(true);
  return { group: g, M, dyn };
}

// train motion: tunnel scrolls, lamps streak by, one tube flickers, straps sway. Deterministic in t.
export const SPEED = 13.0;   // m/s
export const LAMP_GAP = 6.5;
export function lampX(i, t) {   // the x of tunnel lamp i at time t (repeats along the car)
  const span = LAMP_GAP * 7;
  return X1 + 2 - ((((i * LAMP_GAP + t * SPEED) % span) + span) % span);
}
export function updateSet(set, t) {
  const { dyn, M } = set;
  M.tunnel.map.offset.x = (t * SPEED) / 8;
  for (const l of dyn.lamps) l.position.x = lampX(l.userData.i, t);
  const f = Math.sin(t * 37) * Math.sin(t * 11.3) > 0.35 || (t % 3.7) < 0.08 ? 0.35 : 1;
  M.diffFlicker.color.setScalar(f);
  if (dyn.straps) dyn.straps.forEach((s, k) => { s.rotation.x = Math.sin(t * 1.9 + k * 0.4) * 0.05 + Math.sin(t * 0.7) * 0.04; });
  return f;
}
