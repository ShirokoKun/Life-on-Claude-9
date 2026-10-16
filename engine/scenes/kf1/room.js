// Round 14 (lane L5): Ivan's room and its daylight, for the Chapter 1 keyframes only. Everything here happens at
// runtime in kf1 (or comes from kf1's own assets), so s03 keeps its look. Refs: R1 reference/r14/room_bed_rug_ref.webp
// (a mattress on the floor in a navy sheet with a visible weave, a beige pillow, a dark polished floor, a Persian rug),
// R2 rug_pattern_ref.webp (a red Persian medallion on a red field, black medallion ground, worn and sun-faded).
//  - the rug: painted here in that design (procedural, not the reference image), pile, wear, fringe;
//  - the bed: engine/scenes/kf1/bed.glb (blender/scenes/kf1_bed.py: a cloth-simulated duvet, a soft mattress with a
//    piped seam, stuffed pillows) in place of the set's foam-block bed, lit by its own bake for each time of day
//    (lm_BED, blender/scenes/kf1_dawn_bake.py --bed), blended like the set's lightmaps;
//  - the floor: dark polished oak that holds the window's reflection;
//  - the world outside by day and at dawn: a sky dome (the set's Sky_Card sits past the camera's far plane, so the
//    window showed the black background: the "night in a day scene" of K11, K12, K50-K53), hazy hills, trees and
//    towers without their night windows, the city lights off;
//  - the reflections and Ivan's ambient: one room capture per time of day (it was the 3 AM capture all film long);
//  - the sun: kf1 day and dawn bakes whose sun is drawn live with a shadow map (the bakes keep its bounce), so the dawn
//    rays reach Ivan at the desk and everything shadows them true; god rays (engine/src/volume.js, the analytic
//    window shafts) and sunlit dust in the same direction; K47's beam climbing the glass.
// Look-dev: ?livesun=0 (the s03 bakes), ?newbed=0 (the set's bed), ?sunk= ?rays= (multipliers), ?crossk= (scene.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { B } from '../../src/shots.js';
import { createVolume } from '../../src/volume.js';
import { COMMON } from '../../src/atmosphere.js';
import { flipV, LM_FLIP } from '../s03/scene.js';

const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
// sun travel directions (Blender, into the room). DAWN is the kf1 bake's (set_room03 PRESETS.dawn_kf1).
export const DAY_DIR = [1.0, 0.30, -0.62];
export const DAWN_DIR = [1.0, 1.15, -0.55];
const tb = (v) => new THREE.Vector3(v[0], v[2], -v[1]);          // Blender direction -> three

// ------------------------------------------------------------------------------------------------- small helpers
let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function valueNoise(w, h, cell, s) {                               // a smooth value-noise field, cell in px
  seed = s; const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
}
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const css = (h, a = 1) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

// ------------------------------------------------------------------------------------------------- the rug (R2)
// 2.5 m (u, along Blender x) by 2.2 m (v). A worn Heriz-like medallion rug: a madder field with abrash, a black stepped
// medallion with a hooked gold outline, an orange star and an ivory cross at its heart, branching corner motifs, a
// main border of coral cartouches on black between thin guards, then the wear (a pale warp showing through in long
// streaks), the sun-fade and the knots.
const RUG = { field: 0x82201b, field2: 0x641714, black: 0x1f1513, coral: 0xa13a28, gold: 0xb5782f, ivory: 0xc9b088, olive: 0x66613a, navy: 0x262a3e, rust: 0x963a26, warp: 0xa08f7a };
export function paintRug(W = 2500, H = 2200) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const fill = (col, a = 1) => { g.fillStyle = css(col, a); };
  // the field, with abrash (bands of a darker dye lot across the weft)
  fill(RUG.field); g.fillRect(0, 0, W, H);
  seed = 11;
  for (let i = 0; i < 26; i++) { const x = rnd() * W, w = 20 + rnd() * 160; fill(RUG.field2, 0.18 + rnd() * 0.25); g.fillRect(x, 0, w, H); }
  // borders, from the outside in (px)
  const e = Math.round(W * 0.008), og = Math.round(W * 0.022), g1 = Math.round(W * 0.007), mb = Math.round(W * 0.085), g2 = Math.round(W * 0.012);
  const ring = (o, w, col) => { fill(col); g.fillRect(o, o, W - 2 * o, w); g.fillRect(o, H - o - w, W - 2 * o, w); g.fillRect(o, o, w, H - 2 * o); g.fillRect(W - o - w, o, w, H - 2 * o); };
  ring(0, e, 0x3a2a24);
  ring(e, og, RUG.rust);
  // the outer guard: a running zigzag in ivory and black
  const zig = (o, w, col, step) => {
    g.strokeStyle = css(col); g.lineWidth = Math.max(2, w * 0.16); g.lineJoin = 'miter';
    for (const side of [0, 1, 2, 3]) {
      g.beginPath();
      const len = side < 2 ? W - 2 * o : H - 2 * o;
      for (let k = 0; k <= len / step; k++) {
        const s = k * step, d = (k % 2 ? 0.2 : 0.8) * w;
        let x, y;
        if (side === 0) { x = o + s; y = o + d; } else if (side === 1) { x = o + s; y = H - o - d; } else if (side === 2) { x = o + d; y = o + s; } else { x = W - o - d; y = o + s; }
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  };
  zig(e, og, RUG.ivory, og * 0.9); zig(e + og * 0.15, og * 0.7, RUG.black, og * 0.9);
  const o1 = e + og; ring(o1, g1, RUG.ivory);
  const o2 = o1 + g1; ring(o2, mb, RUG.black);
  // the main border: coral cartouches with a rosette, black boxes with a small red flower between them
  const rosette = (x, y, r, petal, centre, n = 8) => {
    fill(petal);
    for (let k = 0; k < n; k++) { const a = k * Math.PI * 2 / n; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.2, a, 0, 7); g.fill(); }
    fill(centre); g.beginPath(); g.arc(x, y, r * 0.28, 0, 7); g.fill();
    fill(RUG.ivory); g.beginPath(); g.arc(x, y, r * 0.1, 0, 7); g.fill();
  };
  const cartouche = (x, y, w, h, horiz) => {          // a coral box with stepped (hooked) ends
    fill(RUG.coral);
    const s = Math.min(w, h) * 0.18;
    g.beginPath();
    if (horiz) { g.moveTo(x + s, y); g.lineTo(x + w - s, y); g.lineTo(x + w - s, y + s); g.lineTo(x + w, y + s); g.lineTo(x + w, y + h - s); g.lineTo(x + w - s, y + h - s); g.lineTo(x + w - s, y + h); g.lineTo(x + s, y + h); g.lineTo(x + s, y + h - s); g.lineTo(x, y + h - s); g.lineTo(x, y + s); g.lineTo(x + s, y + s); }
    else { g.moveTo(x, y + s); g.lineTo(x + s, y + s); g.lineTo(x + s, y); g.lineTo(x + w - s, y); g.lineTo(x + w - s, y + s); g.lineTo(x + w, y + s); g.lineTo(x + w, y + h - s); g.lineTo(x + w - s, y + h - s); g.lineTo(x + w - s, y + h); g.lineTo(x + s, y + h); g.lineTo(x + s, y + h - s); g.lineTo(x, y + h - s); }
    g.closePath(); g.fill();
    g.strokeStyle = css(RUG.gold, 0.8); g.lineWidth = 3; g.stroke();
    const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.36;
    rosette(cx - (horiz ? w * 0.24 : 0), cy - (horiz ? 0 : h * 0.24), r * 0.7, RUG.gold, RUG.field);
    rosette(cx + (horiz ? w * 0.24 : 0), cy + (horiz ? 0 : h * 0.24), r * 0.7, RUG.gold, RUG.field);
    rosette(cx, cy, r, RUG.ivory, RUG.coral, 6);
  };
  const bandIn = o2 + mb * 0.14, bw = mb * 0.72;
  const runs = (len, unit) => Math.max(3, Math.round(len / unit));
  for (const horiz of [true, false]) {
    const len = (horiz ? W : H) - 2 * (o2 + mb), n = runs(len, mb * 2.4), step = len / n;
    for (let k = 0; k < n; k++) {
      const s = o2 + mb + k * step;
      for (const far of [false, true]) {
        const a = far ? (horiz ? H : W) - bandIn - bw : bandIn;
        if (horiz) cartouche(s + step * 0.12, a, step * 0.62, bw, true); else cartouche(a, s + step * 0.12, bw, step * 0.62, false);
        // the small red flower in the black between
        const fx = horiz ? s + step * 0.87 : a + bw / 2, fy = horiz ? a + bw / 2 : s + step * 0.87;
        rosette(fx, fy, bw * 0.22, RUG.field, RUG.gold, 4);
      }
    }
    // corner squares
    for (const [cx, cy] of [[o2, o2], [W - o2 - mb, o2], [o2, H - o2 - mb], [W - o2 - mb, H - o2 - mb]]) {
      fill(RUG.coral); g.fillRect(cx + mb * 0.14, cy + mb * 0.14, mb * 0.72, mb * 0.72); rosette(cx + mb / 2, cy + mb / 2, mb * 0.26, RUG.ivory, RUG.field, 8);
    }
  }
  const o3 = o2 + mb; ring(o3, g2, RUG.navy);
  zig(o3, g2, RUG.gold, g2 * 1.2);
  ring(o3 + g2, Math.round(g2 * 0.4), RUG.ivory);
  const f0 = o3 + g2 + Math.round(g2 * 0.4);                         // the field's inner edge
  // a fine reciprocal line just inside
  g.strokeStyle = css(RUG.black, 0.7); g.lineWidth = 4; g.strokeRect(f0 + 16, f0 + 16, W - 2 * f0 - 32, H - 2 * f0 - 32);
  // hooked branch (the corner trees and the medallion's outline): a stepped stem with hooks to both sides
  const hookBranch = (x, y, ang, len, col, width, depth = 0) => {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    g.strokeStyle = css(col); g.lineWidth = width; g.lineCap = 'square';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * len, y + dy * len); g.stroke();
    if (depth > 2 || len < 28) return;
    const n = 3;
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 0.6), px = x + dx * len * t, py = y + dy * len * t;
      for (const s of [-1, 1]) hookBranch(px, py, ang + s * 0.9, len * 0.42, col, width * 0.8, depth + 1);
    }
    // the hook at the tip
    g.beginPath(); g.moveTo(x + dx * len, y + dy * len); g.lineTo(x + dx * len + Math.cos(ang + 1.57) * len * 0.15, y + dy * len + Math.sin(ang + 1.57) * len * 0.15); g.stroke();
  };
  // corner spandrels: branching gold trees reaching in from the four corners (R2's open corner motifs)
  for (const [cx, cy, a] of [[f0 + 40, f0 + 40, Math.PI / 4], [W - f0 - 40, f0 + 40, Math.PI * 3 / 4], [f0 + 40, H - f0 - 40, -Math.PI / 4], [W - f0 - 40, H - f0 - 40, -Math.PI * 3 / 4]]) {
    hookBranch(cx, cy, a, W * 0.17, RUG.gold, 9);
    hookBranch(cx, cy, a + 0.5, W * 0.09, RUG.rust, 7);
    hookBranch(cx, cy, a - 0.5, W * 0.09, RUG.rust, 7);
    rosette(cx + Math.cos(a) * W * 0.05, cy + Math.sin(a) * W * 0.05, 34, RUG.black, RUG.coral, 6);
    rosette(cx + Math.cos(a) * W * 0.15, cy + Math.sin(a) * W * 0.15, 26, RUG.ivory, RUG.field, 6);
  }
  // the medallion: a stepped hexagonal lozenge on black, hooked gold outline, pendants at the ends
  const mx = W / 2, my = H / 2, MWd = W * 0.24, MHt = H * 0.24;
  const lozenge = (sx, sy, steps) => {
    const pts = [];
    for (let k = 0; k <= steps; k++) { const t = k / steps; pts.push([mx - sx + t * sx * 0.55, my - sy * (0.25 + 0.75 * Math.sin(t * Math.PI / 2))]); }
    const top = pts.concat([[mx + sx * 0.0, my - sy]]);
    const poly = [];
    // a stepped outline: quantise the curve to steps
    const q = (v, s) => Math.round(v / s) * s;
    const st = W * 0.022;                          // coarse steps: a knotted, stepped outline
    const ang = (k) => k / 48 * Math.PI * 2;
    for (let k = 0; k < 48; k++) {
      const a = ang(k), ca = Math.cos(a), sa = Math.sin(a);
      // a hexagon-like super-ellipse, pointed at the ends of the long axis
      const r = 1 / Math.pow(Math.pow(Math.abs(ca), 1.15) + Math.pow(Math.abs(sa), 1.15), 1 / 1.15);
      poly.push([q(mx + ca * sx * r * (1 + 0.25 * Math.pow(Math.abs(ca), 6)), st), q(my + sa * sy * r, st)]);
    }
    void top;
    g.beginPath(); poly.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    return poly;
  };
  // pendants
  for (const s of [-1, 1]) {
    fill(RUG.black); g.beginPath(); g.moveTo(mx + s * MWd * 1.12, my); g.lineTo(mx + s * MWd * 1.28, my - MHt * 0.14); g.lineTo(mx + s * MWd * 1.42, my); g.lineTo(mx + s * MWd * 1.28, my + MHt * 0.14); g.closePath(); g.fill();
    g.strokeStyle = css(RUG.gold); g.lineWidth = 7; g.stroke();
    rosette(mx + s * MWd * 1.28, my, 30, RUG.coral, RUG.ivory, 6);
  }
  const outer = lozenge(MWd, MHt, 6); fill(RUG.black); g.fill();
  // the hooks round the outline (gold "rams' horns" pointing out)
  g.strokeStyle = css(RUG.gold); g.lineWidth = 8; g.stroke();
  outer.forEach(([x, y], k) => {
    if (k % 3) return;
    const a = Math.atan2(y - my, (x - mx) * MHt / MWd);
    const ox = Math.cos(a), oy = Math.sin(a);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + ox * 30, y + oy * 30); g.lineTo(x + ox * 30 - oy * 18, y + oy * 30 + ox * 18); g.stroke();
  });
  // inside: coloured florets scattered on the black (R2's dense medallion ground)
  seed = 23;
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.82;
    const x = mx + Math.cos(a) * MWd * r, y = my + Math.sin(a) * MHt * r;
    if (Math.hypot((x - mx) / MWd, (y - my) / MHt) < 0.5) continue;
    const pal = [RUG.coral, RUG.gold, RUG.olive, RUG.ivory, RUG.field];
    rosette(x, y, 14 + rnd() * 18, pal[(rnd() * pal.length) | 0], RUG.black, 5 + ((rnd() * 3) | 0));
  }
  // the inner star: an orange eight-pointed star with hooked tips, a red ring, an ivory cross, a red heart
  const star = (r0, r1, col, n = 8, rot = 0) => {
    fill(col); g.beginPath();
    for (let k = 0; k < n * 2; k++) { const a = rot + k * Math.PI / n, r = k % 2 ? r1 : r0; const x = mx + Math.cos(a) * r * (MWd / MHt) * 0.85, y = my + Math.sin(a) * r; k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.fill();
  };
  star(MHt * 0.62, MHt * 0.34, RUG.gold, 8, Math.PI / 8);
  for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; hookBranch(mx + Math.cos(a) * MHt * 0.5 * (MWd / MHt) * 0.85, my + Math.sin(a) * MHt * 0.5, a, MHt * 0.18, RUG.gold, 7, 2); }
  star(MHt * 0.44, MHt * 0.30, RUG.field, 8);
  star(MHt * 0.33, MHt * 0.20, RUG.coral, 8, Math.PI / 8);
  // the ivory cross
  fill(RUG.ivory); const cw = MHt * 0.07, cl = MHt * 0.26;
  g.fillRect(mx - cl * 1.15, my - cw, cl * 2.3, cw * 2); g.fillRect(mx - cw, my - cl, cw * 2, cl * 2);
  fill(RUG.field); g.beginPath(); g.arc(mx, my, MHt * 0.07, 0, 7); g.fill();
  rosette(mx, my, MHt * 0.06, RUG.coral, RUG.black, 6);

  // ---- the wear, the fade, the knots: a pixel pass (deterministic: the same rug every load)
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const nBig = valueNoise(W, H, 300, 5), nMid = valueNoise(W, H, 70, 7), nFleck = valueNoise(W, H, 3, 17), nDirt = valueNoise(W, H, 24, 19);
  const [wr, wg, wb] = hex(RUG.warp);
  const ss = (a0, a1, x) => { const t = Math.min(1, Math.max(0, (x - a0) / (a1 - a0))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      // worn zones (where the feet go), and inside them short pale flecks running along the warp (u): the pile worn
      // down to the knots; a few flecks everywhere
      const zone = ss(0.38, 0.78, 0.62 * nBig(x, y) + 0.38 * nMid(x, y));
      const fl = nFleck(x * 0.09, y);
      const worn = zone * ss(0.50, 0.78, fl) * 0.85 + ss(0.80, 0.95, fl) * 0.25;
      const edge = Math.min(x, y, W - x, H - y) < e ? 0 : 1;
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      const l = 0.3 * r + 0.59 * gg + 0.11 * b;                       // sun-fade: a little grey in, the darks lifted
      r = r * 0.88 + l * 0.12 + 8; gg = gg * 0.88 + l * 0.12 + 6; b = b * 0.88 + l * 0.12 + 5;
      const k = Math.min(0.8, worn) * edge;
      r += (wr - r) * k; gg += (wg - gg) * k; b += (wb - b) * k;
      const dirt = 0.86 + 0.2 * nDirt(x, y);                            // uneven dye and grime
      const kn = ((x % 3 === 0) || (y % 3 === 0)) ? 0.94 : 1.0;          // the knots: a 3 mm grid
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, fib = 0.92 + 0.16 * (h - Math.floor(h));
      const f = dirt * kn * fib;
      d[i] = r * f; d[i + 1] = gg * f; d[i + 2] = b * f;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function paintFringe(W = 512, H = 64) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  seed = 31;
  for (let x = 2; x < W; x += 3.2) {
    const len = H * (0.62 + rnd() * 0.36), sway = (rnd() - 0.5) * 8;
    g.strokeStyle = `rgba(${200 + rnd() * 30 | 0},${180 + rnd() * 25 | 0},${145 + rnd() * 25 | 0},1)`;
    g.lineWidth = 1.6 + rnd() * 0.8;
    g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + sway * 0.4, len * 0.6, x + sway, len); g.stroke();
  }
  return c;
}

// ------------------------------------------------------------------------------------------------- the day sky
// an equirect sky for a dome round the room (the set's Sky_Card sits 3.2 km out, past the camera's 400 m far plane, so
// it never drew: by day and at dawn the window showed the black background, the "night in a day scene" of K12 and K50).
// u: azimuth (the dome is turned so the window, west, looks at u = 0.5), v: elevation (the horizon at v = 0.5).
function paintSky(kind, W = 2048, H = 1024) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);                  // row 0 = the zenith
  if (kind === 'day') { gr.addColorStop(0, '#4f80c6'); gr.addColorStop(0.3, '#7aa6da'); gr.addColorStop(0.45, '#a6c4e4'); gr.addColorStop(0.49, '#d4e2ee'); gr.addColorStop(0.5, '#e6eef2'); gr.addColorStop(0.53, '#d6dfdc'); gr.addColorStop(1, '#a9b49a'); }
  else { gr.addColorStop(0, '#7d8fbb'); gr.addColorStop(0.28, '#b9a6b4'); gr.addColorStop(0.42, '#eebc95'); gr.addColorStop(0.5, '#ffd8a4'); gr.addColorStop(0.53, '#e4bf94'); gr.addColorStop(1, '#a58c70'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  seed = kind === 'day' ? 41 : 43;
  for (let i = 0; i < 70; i++) {                                   // soft cumulus low over the horizon, lit from above
    const cx = rnd() * W, cy = H * (0.30 + rnd() * 0.17), sz = 20 + rnd() * 70;
    for (let k = 0; k < 8; k++) {
      const x = cx + (rnd() - 0.5) * sz * 3, y = cy + (rnd() - 0.5) * sz * 0.4, r = sz * (0.4 + rnd() * 0.6);
      for (const dx of [0, -W, W]) {                               // wraps round the seam
        const rg = g.createRadialGradient(x + dx, y - r * 0.25, 0, x + dx, y, r);
        rg.addColorStop(0, kind === 'day' ? 'rgba(255,255,255,0.6)' : 'rgba(255,222,186,0.55)');
        rg.addColorStop(1, kind === 'day' ? 'rgba(220,230,240,0)' : 'rgba(240,170,130,0)');
        g.fillStyle = rg; g.beginPath(); g.ellipse(x + dx, y, r * 1.8, r * 0.55, 0, 0, 7); g.fill();
      }
    }
  }
  if (kind !== 'day') {                                            // the low sun's glow (u 0.636: where the dawn sun stands)
    const sx = W * 0.636, sy = H * 0.465;
    const rg = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.22);
    rg.addColorStop(0, 'rgba(255,246,214,1)'); rg.addColorStop(0.08, 'rgba(255,224,170,0.8)'); rg.addColorStop(0.4, 'rgba(255,190,130,0.25)'); rg.addColorStop(1, 'rgba(255,180,120,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  return c;
}

// ------------------------------------------------------------------------------------------------- fabrics
const TEX = 'assets/tex/';
const loader = new THREE.TextureLoader();
function texSet(key, rep, anis) {
  const mk = (map, srgb) => {
    const t = loader.load(TEX + key + '/' + map + '.jpg'); t.flipY = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = anis;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
  };
  return { albedo: mk('albedo', true), normal: mk('normal', false), rough: mk('rough', false) };
}
// mean linear albedo of a texture key (so a target colour is hit exactly, like materials.js)
const means = new Map();
function meanOf(key) {
  if (!means.has(key)) means.set(key, new Promise((res) => {
    const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 32, 32);
      const d = g.getImageData(0, 0, 32, 32).data; const lin = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const v = d[i + k] / 255; lin[k] += v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      res(lin.map((v) => v / (d.length / 4)));
    };
    img.onerror = () => res([0.5, 0.5, 0.5]); img.src = TEX + key + '/albedo.jpg';
  }));
  return means.get(key);
}

// the bed's own lightmaps (lm_BED, one per baked time of day: blender/scenes/kf1_dawn_bake.py --bed), blended by
// vlmW like roomlight blends the set's, read in the same terms (materials.js patchBaked: bounce only from the bake,
// reflections fade where the room is dark)
function vlmPatch(m, mottle = 0.2) {
  const U = { vlmK: { value: Math.PI }, vlmW: { value: 0 }, lmA: { value: null }, lmB: { value: null }, mottle: { value: mottle } };
  m.userData.vlm = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute vec2 lmUv; varying vec2 vLmUv; varying vec3 vWp;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  vLmUv = vec2(lmUv.x, ${LM_FLIP ? '1.0 - lmUv.y' : 'lmUv.y'});\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    // the cloth's colour varies at the scales a camera across the room reads (dye, wear, the slub of the yarn): a
    // weave texture alone is sub-pixel from the top-downs
    sh.fragmentShader = `uniform float vlmK, vlmW, mottle; uniform sampler2D lmA, lmB; varying vec2 vLmUv; varying vec3 vWp;
      float kh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float kvn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(kh3(i), kh3(i + vec3(1, 0, 0)), f.x), mix(kh3(i + vec3(0, 1, 0)), kh3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(kh3(i + vec3(0, 0, 1)), kh3(i + vec3(1, 0, 1)), f.x), mix(kh3(i + vec3(0, 1, 1)), kh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float mt = 0.5 * kvn(vWp * 2.3) + 0.3 * kvn(vWp * 7.5) + 0.2 * kvn(vWp * vec3(90.0, 9.0, 90.0));   // the last: slub along the weft
        diffuseColor.rgb *= mix(1.0 - mottle, 1.0 + mottle, mt); }`).replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      { vec3 lmI = mix(texture2D(lmA, vLmUv).rgb, texture2D(lmB, vLmUv).rgb, vlmW);   // the two strongest times of day
        lmI = max(lmI, vec3(0.0));
        float lmLum = dot(lmI, vec3(0.2126, 0.7152, 0.0722));
        radiance *= smoothstep(0.0, 0.06, lmLum);
        iblIrradiance = vec3(0.0);
        irradiance += lmI * vlmK; }`);
  };
  m.customProgramCacheKey = () => 'kf1bedlm';
  return m;
}

async function fabric({ key, rep, color, rough = 0.95, nrm = 0.8, sheen = 0.8, sheenCol, anis = 8, mottle = 0.2 }) {
  const T = texSet(key, rep, anis);
  const mean = await meanOf(key);
  const target = new THREE.Color(color);                         // sRGB hex -> linear
  const m = new THREE.MeshPhysicalMaterial({ map: T.albedo, normalMap: T.normal, roughnessMap: T.rough, roughness: rough / 0.6, metalness: 0,
    sheen, sheenRoughness: 0.55, sheenColor: new THREE.Color(sheenCol ?? color), envMapIntensity: 0.35, side: THREE.DoubleSide });
  m.color.setRGB(target.r / Math.max(mean[0], 0.02), target.g / Math.max(mean[1], 0.02), target.b / Math.max(mean[2], 0.02));
  m.normalScale.set(nrm, nrm);
  return vlmPatch(m, mottle);
}

// ------------------------------------------------------------------------------------------------- set-up
const S = {};          // module state
export async function createRoom(args, RL) {
  const { scene, named, root, renderer, data, loadEXR, atmo } = args;
  Object.assign(S, { scene, renderer, RL, named, root, data, lens: args.post && args.post.lens });
  const anis = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // --- the kf1 bakes replace the day and sunrise lightmaps (same geometry, same UVs: room.glb's own TEXCOORD_1); their
  // sun is drawn live (the bakes keep only its bounce). ?livesun=0 shows the s03 bakes.
  S.live = {};
  if (Q.get('livesun') !== '0') {
    await Promise.all([['sunrise', 'dawn'], ['day', 'day']].map(async ([set, dir0]) => {
      if (!RL.sets[set]) return;
      try {
        const dir = `scenes/kf1/lighting/${dir0}`;
        const info = await (await fetch(`${dir}/lights.json`)).json();
        const groups = data.groups || Object.keys(RL.sets['3am'].LM);
        const maps = await Promise.all(groups.map((g) => loadEXR(`${dir}/lightmaps/lm_${g}.exr`).catch(() => null)));
        if (!maps.every(Boolean) || !info.sun) return;
        const LM = {};
        groups.forEach((g, i) => { const t = maps[i]; t.channel = 1; t.flipY = false; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; if (LM_FLIP) flipV(t); LM[g] = t; });
        RL.sets[set] = { LM, exposure: info.exposure ?? RL.sets[set].exposure };
        S.live[set] = info;
      } catch (e) { console.warn(`kf1 ${dir0} bake missing, using the s03 ${set}`, e.message); }
    }));
  }
  S.dawn = S.live.sunrise;

  // --- the rug (R2)
  const rug = named.Baked_DESK_34;
  if (rug) {
    const m = rug.material;
    const map = new THREE.CanvasTexture(paintRug()); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = anis; map.flipY = true;
    m.map = map; m.color.setRGB(1, 1, 1);
    if (m.normalMap) { m.normalMap = m.normalMap.clone(); m.normalMap.repeat.set(2.5 / 0.35, 2.2 / 0.35); m.normalMap.needsUpdate = true; m.normalScale.set(0.7, 0.7); }
    if (m.roughnessMap) { m.roughnessMap = m.roughnessMap.clone(); m.roughnessMap.repeat.set(2.5 / 0.35, 2.2 / 0.35); m.roughnessMap.needsUpdate = true; }
    m.roughness = 1.0 / 0.6; m.sheen = 0.6; m.sheenRoughness = 0.7; m.sheenColor.setRGB(0.55, 0.22, 0.16);
    m.envMapIntensity = 0.15; m.needsUpdate = true;
    // the fringe at the two short ends (x = 0.2 and 2.7), lit by the rug's own lightmap (extrapolated a few cm)
    const g = rug.geometry, P = g.attributes.position, U1 = g.attributes.uv1;
    const corner = (i) => ({ x: P.getX(i), z: P.getZ(i), u: U1.getX(i), v: U1.getY(i) });
    const C = [0, 1, 2, 3].map(corner);
    const lmAt = (x, z) => {                                         // bilinear in the quad (x 0.2..2.7, z -4.35..-2.15)
      const fx = (x - 0.2) / 2.5, fz = (z + 4.35) / 2.2;
      const at = (cx, cz) => C.find((c) => Math.abs(c.x - cx) < 1e-3 && Math.abs(c.z - cz) < 1e-3);
      const a = at(0.2, -4.35), b = at(2.7, -4.35), c = at(0.2, -2.15), d = at(2.7, -2.15);
      return [(1 - fx) * (1 - fz) * a.u + fx * (1 - fz) * b.u + (1 - fx) * fz * c.u + fx * fz * d.u, (1 - fx) * (1 - fz) * a.v + fx * (1 - fz) * b.v + (1 - fx) * fz * c.v + fx * fz * d.v];
    };
    const ft = new THREE.CanvasTexture(paintFringe()); ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = anis;
    const fm = m.clone(); fm.map = ft; fm.alphaTest = 0.5; fm.transparent = false; fm.normalMap = null; fm.roughnessMap = null; fm.roughness = 0.9; fm.side = THREE.DoubleSide;
    fm.lightMap = m.lightMap; fm.onBeforeCompile = m.onBeforeCompile; fm.customProgramCacheKey = m.customProgramCacheKey;
    for (const x0 of [0.2, 2.7]) {
      const L = 0.07, s = x0 < 1 ? -1 : 1;
      const geo = new THREE.PlaneGeometry(L, 2.2, 1, 1); geo.rotateX(-Math.PI / 2);
      geo.translate(x0 + s * L / 2, 0.009, -3.25);
      const p2 = geo.attributes.position, uv = geo.attributes.uv, uv1 = new Float32Array(p2.count * 2);
      for (let i = 0; i < p2.count; i++) {
        const [u, v] = lmAt(Math.min(2.69, Math.max(0.21, p2.getX(i))), p2.getZ(i)); uv1[i * 2] = u; uv1[i * 2 + 1] = v;
        uv.setXY(i, (p2.getZ(i) + 4.35) / 2.2 * 6, (p2.getX(i) - x0) * s / L);   // threads run outward from the rug
      }
      geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
      ft.wrapS = THREE.RepeatWrapping;
      const f = new THREE.Mesh(geo, fm); f.name = 'Kf1_Rug_Fringe'; f.receiveShadow = true; rug.parent.add(f);
    }
  }

  // --- the window's muntins: one glazing bar down the middle of each sash (two-light sashes), so the sun through the
  // window carries the bars onto the bed and the floor as the god rays already do (volume.js prints a muntin at each
  // unit's centre); live-lit, they cast the live sun's shadow
  {
    const [y0, y1, sill, head] = data.room.window, uw = (y1 - y0) / 3, mid = (sill + head) / 2;
    const mm = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.62, 0.60, 0.56).convertSRGBToLinear(), roughness: 0.5, envMapIntensity: 0.6 });
    for (let k = 0; k < 3; k++) {
      const y = y0 + (k + 0.5) * uw;
      for (const [x, z0, z1] of [[-0.14, sill + 0.08, mid + 0.02], [-0.20, mid - 0.02, head - 0.07]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, z1 - z0, 0.024), mm);
        bar.position.copy(B(x, y, (z0 + z1) / 2)); bar.castShadow = true; bar.receiveShadow = true; bar.name = 'Kf1_Muntin';
        named.Baked_ARCH.add(bar);
      }
    }
  }

  // --- the floor (R1: dark polished wood, the window in it)
  const floor = named.Baked_ARCH_3;
  if (floor) {
    const m = floor.material;
    m.color.multiply(new THREE.Color(0.52, 0.42, 0.38));
    m.clearcoat = 0.55; m.clearcoatRoughness = 0.1; m.envMapIntensity = 1.1; m.roughness *= 0.85; m.needsUpdate = true;
  }

  // --- the bed (bed.glb), lit by its own bake for each time of day
  const oldBed = ['Baked_ROOM_1', 'Baked_ROOM_2', 'Baked_ROOM_3'].map((n) => named[n]).filter(Boolean);
  if (Q.get('newbed') !== '0' && oldBed.length === 3) {
    const [glb, ...lms] = await Promise.all([new GLTFLoader().loadAsync('scenes/kf1/bed.glb'),
      ...['3am', 'evening', 'day', 'dawn'].map((d) => loadEXR(`scenes/kf1/lighting/${d}/lightmaps/lm_BED.exr`))]);
    for (const t of lms) { t.flipY = false; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; }
    const [duvetM, sheetM, pillowM] = await Promise.all([
      fabric({ key: 'fabric_weave', rep: 1 / 0.30, color: 0x161d33, nrm: 1.3, sheen: 0.9, sheenCol: 0x3c4a70, anis, mottle: 0.26 }),   // navy duvet, a canvas weave
      fabric({ key: 'fabric_weave', rep: 1 / 0.24, color: 0x1b2440, nrm: 1.2, sheen: 0.8, sheenCol: 0x45547c, anis, mottle: 0.22 }),         // the fitted sheet, a lighter navy
      fabric({ key: 'linen', rep: 1 / 0.16, color: 0xae9068, nrm: 1.0, sheen: 0.7, sheenCol: 0xe6cfa6, anis, mottle: 0.12 }),        // beige linen pillows (R1)
    ]);
    const bed = new THREE.Group(); bed.name = 'Kf1_Bed';
    const meshes = [];
    glb.scene.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.material.name || '';
      o.material = /Pillow/.test(n) ? pillowM : /Sheet/.test(n) ? sheetM : duvetM;
      const uv1 = o.geometry.attributes.uv1; if (uv1) o.geometry.setAttribute('lmUv', uv1);
      o.castShadow = o.receiveShadow = true; meshes.push(o);
    });
    while (glb.scene.children.length) bed.add(glb.scene.children[0]);
    named.Baked_ROOM.add(bed);                                     // zones hide it with the rest of the room
    for (const o of oldBed) o.material.visible = false;          // the set's bed stays (its intensity is our level), unseen
    S.bed = { meshes, mats: [duvetM, sheetM, pillowM], src: named.Baked_ROOM_1.material, lms };
  }

  // --- the outside
  S.outside = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material; if (Array.isArray(m)) return;
    const kind = /^Sky_Card/.test(o.name) ? 'sky' : /^Facade_Towers/.test(o.parent?.name || o.name) || /^Facade_Towers/.test(o.name) ? 'tower'
      : /^Neighbourhood/.test(o.parent?.name || '') || /^Neighbourhood/.test(o.name) ? 'house' : /^Tree_Line/.test(o.name) ? 'tree'
      : /^(Hill|Ground)/.test(o.name) ? 'hill' : /^(Street_|Valley_|House_Windows|Aviation_)/.test(o.name) || /^Aviation_/.test(o.parent?.name || '') ? 'lights' : null;
    if (kind) S.outside.push({ o, m, kind, map0: m.emissiveMap || null, color0: m.color.clone(), emis0: m.emissive.clone(), k0: m.emissiveIntensity, vis0: o.visible });
    if (kind && kind !== 'lights') { m.roughness = 1; m.metalness = 0; if ('specularIntensity' in m) m.specularIntensity = 0; }   // no plastic glints out there (the live sun reaches it)
  });
  S.sky = { day: new THREE.CanvasTexture(paintSky('day')), dawn: new THREE.CanvasTexture(paintSky('dawn')) };
  for (const t of Object.values(S.sky)) { t.colorSpace = THREE.SRGBColorSpace; t.flipY = true; t.wrapS = THREE.RepeatWrapping; }
  S.dome = new THREE.Mesh(new THREE.SphereGeometry(396, 64, 32), new THREE.MeshBasicMaterial({ map: S.sky.day, side: THREE.BackSide, fog: false, depthWrite: false }));
  S.dome.position.copy(B(1.5, 2.4, 1.3)); S.dome.rotation.y = Math.PI; S.dome.renderOrder = -10; S.dome.frustumCulled = false;
  S.dome.name = 'Kf1_Sky'; S.dome.visible = false; scene.add(S.dome);

  // --- the live dawn sun: direct light with a shadow map (the bake keeps its bounce only)
  const sun = new THREE.DirectionalLight(0xffa868, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -3.4; sc.right = 3.4; sc.top = 3.4; sc.bottom = -3.4; sc.near = 0.5; sc.far = 16;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012; sun.shadow.radius = 2.5;
  sun.target.position.copy(B(1.6, 3.0, 0.8));
  scene.add(sun, sun.target); S.sun = sun;
  aimSun(DAWN_DIR);
  // K47: the beam that climbs the glass (a spot with a soft horizontal band for a cookie)
  const bc = document.createElement('canvas'); bc.width = bc.height = 256; const bg = bc.getContext('2d');
  bg.fillStyle = '#000'; bg.fillRect(0, 0, 256, 256);
  const lg = bg.createLinearGradient(0, 0, 0, 256); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(0.40, 'rgba(0,0,0,1)'); lg.addColorStop(0.47, 'rgba(255,255,255,1)'); lg.addColorStop(0.56, 'rgba(255,255,255,1)'); lg.addColorStop(0.62, 'rgba(70,70,70,1)'); lg.addColorStop(1, 'rgba(25,25,25,1)');
  bg.fillStyle = lg; bg.fillRect(0, 0, 256, 256);
  const rgd = bg.createRadialGradient(128, 128, 60, 128, 128, 128); rgd.addColorStop(0, 'rgba(0,0,0,0)'); rgd.addColorStop(1, 'rgba(0,0,0,1)'); bg.fillStyle = rgd; bg.fillRect(0, 0, 256, 256);
  const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
  const beam = new THREE.SpotLight(0xffb070, 0, 5, THREE.MathUtils.degToRad(7), 0.2, 1.0);
  beam.map = btex; beam.castShadow = true; beam.shadow.mapSize.set(1024, 1024); beam.shadow.bias = -0.0005;
  scene.add(beam, beam.target); S.beam = beam;
  // ...and the beam ON the glass: a band of sunlight caught in the tumbler's wall, brightest on the sun side and at the
  // rims of the silhouette (where the glass is seen edge-on), soft above and below (a thin shell just outside the glass)
  S.band = new THREE.Mesh(new THREE.CylinderGeometry(0.0386, 0.0352, 0.100, 64, 24, true), new THREE.ShaderMaterial({
    uniforms: { h: { value: 0 }, k: { value: 0 }, col: { value: new THREE.Color(1.0, 0.72, 0.42) }, sunV: { value: tb(DAWN_DIR).normalize().negate() } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vW;
      void main() { vY = position.y / 0.100 + 0.5; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float h, k; uniform vec3 col, sunV; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vW;
      void main() {
        float d = (vY - h) / 0.055;
        float band = exp(-d * d) + 0.22 * step(vY, h);   // the band, and the lit glass below it
        float side = 0.25 + 0.75 * smoothstep(-0.3, 0.6, dot(normalize(vN), sunV));
        float fr = pow(max(0.0, 1.0 - abs(dot(normalize(vN), vV))), 2.0);
        float streak = 0.75 + 0.25 * sin(atan(vN.z, vN.x) * 9.0 + vY * 4.0);
        gl_FragColor = vec4(col * k * band * side * (0.18 + 1.4 * fr) * streak, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));   // no depth: it sits on the water, whose depth keeps it sharp in the lens (a depth write blacked the transmission)
  S.band.position.copy(B(0.76, 4.33, 0.80)); S.band.visible = false; S.band.renderOrder = 3; S.band.name = 'Kf1_Glass_Beam'; scene.add(S.band);

  // --- god rays: the analytic window shafts (volume.js), and dust that only shows in them
  if (atmo) {
    S.vol = atmo.add(createVolume({ room: data.room, lamp: data.marks.Lamp_Shade || data.lights[0].location, COMMON }));
    S.vol.mesh.visible = false;
    S.motes = atmo.add(sunDust(data.room, S.vol.uniforms));
    S.motes.mesh.visible = false;
  }
}

function aimSun(dir) {
  const d = tb(dir).normalize();
  S.sun.position.copy(S.sun.target.position).addScaledVector(d, -8);
  S.sun.target.updateMatrixWorld(); S.sun.updateMatrixWorld();
}

// dust motes lit only inside the window shafts (the atmosphere's dust is lit by the lamp and the screens)
function sunDust(room, VU, count = 6000) {
  const pos = new Float32Array(count * 3), sd = new Float32Array(count * 4);
  seed = 77;
  for (let i = 0; i < count; i++) {
    const x = 0.05 + rnd() * 2.8, y = 1.0 + rnd() * 3.7, z = 0.15 + rnd() * 2.2;
    pos.set([x, z, -y], i * 3); sd.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
  const uniforms = { tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) }, near: { value: 0.03 }, far: { value: 400 },
    time: { value: 0 }, px: { value: 1 }, gain: { value: 0 }, focus: { value: 1 }, cocK: { value: 0 },
    winDir: VU.winDir, win: VU.win, unitW: VU.unitW, roomSize: VU.roomSize, winColor: VU.winColor };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `attribute vec4 seed; uniform float time, px, cocK, focus; uniform vec2 res; uniform vec3 winDir, roomSize; uniform vec4 win; uniform float unitW;
      varying float vI; varying float vSoft; varying float vDepth;
      float band(float x, float c, float hw) { return smoothstep(hw, hw + 0.012, abs(x - c)); }
      float windowLit(vec3 b) {
        if (b.x < 0.0 || b.x > roomSize.x || b.y < 0.0 || b.y > roomSize.y || b.z < 0.0 || b.z > roomSize.z) return 0.0;
        float t = b.x / max(winDir.x, 1e-3); vec3 q = b - winDir * t;
        float inY = smoothstep(win.x, win.x + 0.02, q.y) * (1.0 - smoothstep(win.y - 0.02, win.y, q.y));
        float inZ = smoothstep(win.z, win.z + 0.02, q.z) * (1.0 - smoothstep(win.w - 0.02, win.w, q.z));
        float bars = 1.0;
        for (int k = 1; k < 3; k++) bars *= band(q.y, win.x + float(k) * unitW, 0.06);
        for (int k = 0; k < 3; k++) bars *= band(q.y, win.x + (float(k) + 0.5) * unitW, 0.012);
        bars *= band(q.z, 0.5 * (win.z + win.w + 0.40), 0.05);
        return inY * inZ * bars;
      }
      void main() {
        vec3 p = position; float t = time * (0.04 + 0.06 * seed.x);
        p += vec3(sin(t + seed.y * 6.28) * 0.07, sin(t * 0.7 + seed.z * 6.28) * 0.05 - time * 0.003 * seed.w, cos(t * 0.9 + seed.x * 6.28) * 0.07);
        vec3 b = vec3(p.x, -p.z, p.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = max(-mv.z, 0.01); vDepth = d;
        float lit = windowLit(b);
        float size = (0.0006 + 0.0010 * seed.w) * px / d;
        float coc = cocK * abs(d - focus) / d;
        float sz = max(size, coc * 2.0);
        vI = lit * (0.4 + 0.6 * seed.z) * (size * size) / (sz * sz + 1e-4) * clamp(size, 0.0, 1.0) * smoothstep(0.5, 1.3, d);   // never in the lens
        vSoft = clamp(coc / 3.0, 0.0, 1.0);
        gl_PointSize = clamp(sz, 1.0, 48.0 * max(1.0, res.y / 1080.0));
        gl_Position = lit > 0.001 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `${COMMON} uniform float gain; uniform vec3 winColor; varying float vI; varying float vSoft; varying float vDepth;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0; float rr = dot(q, q); if (rr > 1.0) discard;
        float disc = mix(exp(-rr * 4.0), smoothstep(1.0, 0.75, rr) * (0.8 + 0.2 * rr), vSoft);
        float occ = smoothstep(-0.02, 0.05, sceneDist(gl_FragCoord.xy / res) - vDepth);
        gl_FragColor = vec4(winColor * max(vI, 0.0) * disc * occ * gain, 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Points(g, mat); mesh.frustumCulled = false;
  return { mesh, material: mat, update(camera, t) {
    uniforms.time.value = t;
    const r = S.renderer.getDrawingBufferSize(new THREE.Vector2()), f = camera.projectionMatrix.elements[5];
    uniforms.px.value = r.y * 0.5 * f;
    if (S.lens) { uniforms.cocK.value = S.lens.mat.uniforms.k.value * 2.0 * (S.lens.px || 1); uniforms.focus.value = S.lens.mat.uniforms.focus.value; }
  } };
}

// ------------------------------------------------------------------------------------------------- environments
function captureEnv(at) {
  const { scene, renderer } = S;
  const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(0.05, 50, crt); cube.position.copy(B(...at));
  const prev = renderer.getRenderTarget(), tm = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping; cube.update(renderer, scene); renderer.toneMapping = tm; renderer.setRenderTarget(prev);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromCubemap(crt.texture).texture; pm.dispose(); crt.dispose();
  return env;
}
// one capture per time of day, all made on the first frame (deterministic: never depends on which frame came first)
function captureAll(ctx, restoreW, envAt) {
  const { scene } = S;
  const hide = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) { let r = o; while (r.parent && r.parent !== scene) r = r.parent; if (r.visible && !hide.includes(r)) hide.push(r); } });
  for (const r of hide) r.visible = false;
  S.env = { '3am': ctx.scene.environment };
  for (const n of ['day', 'sunrise', 'evening']) {
    S.RL.apply({ [n]: 1 });
    outsideFor(n, 1, 1);
    S.sun.intensity = 0;
    S.env[n] = captureEnv(envAt);
  }
  for (const r of hide) r.visible = true;
  S.RL.apply(restoreW);
}

// ------------------------------------------------------------------------------------------------- per frame
const BASE = (n) => (/^(3am|4am|4am_iso|void)$/.test(n) ? 0 : n === 'evening' ? 1 : n === 'day' ? 2 : 3);
function outsideFor(light, dim, expo) {
  const day = light === 'day', dawn = light === 'sunrise';
  S.dome.visible = day || dawn;
  if (S.dome.visible) {
    const t = day ? S.sky.day : S.sky.dawn;
    if (S.dome.material.map !== t) { S.dome.material.map = t; S.dome.material.needsUpdate = true; }
    S.dome.material.color.setScalar((day ? 1.55 : 1.45) * dim / Math.max(expo, 1e-4));
  }
  for (const x of S.outside) {
    const { m, kind } = x;
    if (!day && !dawn) {                                          // night and dusk: the set as it was (roomlight and kf1 tint it)
      if (kind === 'tower' && m.emissiveMap !== x.map0) { m.emissiveMap = x.map0; m.needsUpdate = true; }
      m.color.copy(x.color0);
      if (light !== 'evening' && /^(hill|house)$/.test(kind)) m.emissiveIntensity = x.k0;   // (dusk: scene.js's haze sets it)
      x.o.visible = x.vis0;
      continue;
    }
    // by day the outside is a lit, hazy world; emissive (nothing out there is lit live), held at one level on screen
    // whatever the shot's exposure: k is the display level before the tone map
    const k = dim / Math.max(expo, 1e-4);
    if (kind === 'sky') { x.o.visible = x.vis0; continue; }
    else if (kind === 'lights') { x.o.visible = false; continue; }
    else {
      if (kind === 'tower' && m.emissiveMap) { m.emissiveMap = null; m.needsUpdate = true; }
      const C = day ? { tower: 0xaebfd2, house: 0x98a4ae, tree: 0x62804f, hill: 0xa3b289 } : { tower: 0xcfa79e, house: 0xae9384, tree: 0x6a5c48, hill: 0xc9a77c };
      m.color.setRGB(0, 0, 0); m.emissive.setHex(C[kind]); m.emissiveIntensity = (kind === 'tower' ? 1.25 : kind === 'house' ? 1.0 : 0.9) * k;
    }
    x.o.visible = x.vis0;
  }
}

// light per shot (the K-fields stay in scene.js): sun, rays, dust, beam, the outside, the bed's baked light
// the live sun: the bake's own (lights.json: energy, colour, travel), scaled to taste
const SUN_K = { sunrise: 3.0, day: 1.3 };   // the dawn sun pushed: it must read on Ivan (K48, K50, K51)
export function roomFrame(t, s, ctx, o) {
  const { zone, dim, weights, lens } = o;
  if (lens) S.lens = lens;
  const light = String(s.light || '3am').match(/4am_iso|4am|3am|evening|day|sunrise|void/)?.[0] || '3am';
  if (!S.env && ctx.scene.environment) captureAll(ctx, weights, o.envAt);
  const expo = S.renderer.toneMappingExposure;
  outsideFor(zone ? 'night' : light, zone ? 1 : (s.dim ?? 1), expo);
  // reflections and Ivan's ambient follow the time of day
  if (S.env) { const e = S.env[light === '4am' || light === '4am_iso' || light === 'void' ? '3am' : light] || S.env['3am']; if (ctx.scene.environment !== e) ctx.scene.environment = e; }
  // the bed: its baked light blended like the lightmaps, at the old bed's intensity (roomlight's room scale x kf1's dim)
  if (S.bed) {
    const w4 = [0, 0, 0, 0];
    for (const [n, k] of Object.entries(weights)) w4[BASE(n)] += k;
    const on = w4.map((k, i) => [i, k]).sort((x, y) => y[1] - x[1]);
    const [a, b] = [on[0], on[1][1] > 0.001 ? on[1] : on[0]];
    for (const m of S.bed.mats) {
      const U = m.userData.vlm; U.lmA.value = S.bed.lms[a[0]]; U.lmB.value = S.bed.lms[b[0]];
      U.vlmW.value = b === a ? 0 : b[1] / (a[1] + b[1]); U.vlmK.value = S.bed.src.lightMapIntensity;
    }
  }
  // the dawn sun: live, shadow-mapped, only where the kf1 dawn bake took its direct light out
  // the live sun: only where a kf1 bake took its direct light out (day, sunrise); blended by the light weights
  let sunK = 0, sunDir = null, sunCol = new THREE.Color(0, 0, 0);
  for (const [n, k] of Object.entries(weights)) {
    const L = S.live[n]; if (!L || zone) continue;
    const e = L.sun.energy * SUN_K[n] * k; sunK += e;
    sunCol.add(new THREE.Color(...L.sun.color).multiplyScalar(e));
    sunDir = sunDir || L.sun.travel;
  }
  sunK *= (s.sunK ?? 1) * (s.dim ?? 1) * +(Q.get('sunk') ?? 1);   // ?sunk=, ?rays=: look-dev multipliers
  if (s.id === 'K47') sunK *= 0.25;                                // K47: the sun is only just in; the beam carries the shot
  if (sunDir) aimSun([sunDir[0], sunDir[1], sunDir[2]]);
  S.sun.intensity = sunK; if (sunK > 0) S.sun.color.copy(sunCol.multiplyScalar(1 / Math.max(1e-6, sunCol.r, sunCol.g, sunCol.b)));
  S.sun.castShadow = sunK > 0;
  const liveW = Object.entries(weights).reduce((a, [n, k]) => a + (S.live[n] ? k : 0), 0);
  if (liveW > 0 && S.RL.sun) S.RL.sun.intensity *= 1 - liveW;      // roomlight's unshadowed sun would double it
  // K47: the beam climbs the glass, bottom to top, over the shot
  if (s.id === 'K47' && !zone) {
    const u = Math.min(1, Math.max(0, (t - (s.t0 + 0.4)) / (s.t1 - s.t0 - 0.5)));
    const e = u * u * (3 - 2 * u);
    const at = B(0.76, 4.33, 0.70 + 0.30 * e);
    S.beam.target.position.copy(at); S.beam.position.copy(at).addScaledVector(tb(DAWN_DIR).normalize(), -2.2);
    const fade = Math.min(1, Math.max(0, (t - s.t0) / 0.6));
    S.beam.intensity = 26 * fade; S.beam.target.updateMatrixWorld();
    S.band.visible = true; S.band.material.uniforms.h.value = 0.12 + 0.95 * e; S.band.material.uniforms.k.value = 3.2 * fade * (s.dim ?? 1);
  } else { S.beam.intensity = 0; S.band.visible = false; }
  S.beam.castShadow = S.beam.intensity > 0;
  // god rays and the dust in them (day: the bake's sun; dawn: the live sun's direction)
  if (S.vol) {
    const R = !zone && (light === 'day' || light === 'sunrise') ? (light === 'day' ? { dir: DAY_DIR, col: [1.0, 0.93, 0.80], k: 0.022, haze: 0.0, dust: 1.4 } : { dir: DAWN_DIR, col: [1.0, 0.66, 0.38], k: 0.045, haze: 0.0006, dust: 7.0 }) : null;
    const rk = R ? (s.rays ?? 1) * dim * +(Q.get('rays') ?? 1) : 0;
    S.vol.mesh.visible = rk > 0; S.motes.mesh.visible = rk > 0 && (s.dust ?? 1) > 0;
    if (R) {
      const u = S.vol.uniforms;
      u.winDir.value.set(...R.dir).normalize(); u.winColor.value.setRGB(...R.col);
      u.winK.value = R.k * rk; u.lampK.value = 0; u.hazeK.value = R.haze * rk; u.hazeColor.value.setRGB(0.32, 0.25, 0.2);
      u.win.value.w = data().room.window[3] - 0.40;
      S.motes.material.uniforms.gain.value = R.dust * rk * (s.dust ?? 1);
    }
  }
}
const data = () => S.data;
export const roomState = S;
