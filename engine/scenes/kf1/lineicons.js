// Round 14: the white outline icon language (director, ref R3 white_outline_icons_ref.webp). Every pixel icon in kf1 is
// drawn as white lines one pixel thick, no fill, no black: a white core with a slight inherent glow (the deep glow,
// glow.js, gives the halo), dotted pixel arrows between them. Clean, minimal, readable at small size.
//
// Each icon is drawn with a PEN on a small pixel grid (lines, polylines, circles), so every pixel knows when the pen
// reached it: the icon can draw itself on (draw 0 -> 1, a hot pen tip running along the strokes), flicker (pixels
// dropping out), and its named layers (an eye's pupil, a magnifier, a tick, a line of text) can move or brighten on
// their own. Built in 3D as thin emissive voxels (an InstancedMesh of flat cubes): opaque, so they write depth and
// the lens focuses on them; every material carries userData.glow, so the deep glow picks them up.
//
//   const g = lineIcon('inbox', { px: 0.008 }); scene.add(g);
//   setLine(g, { draw: 0.6, k: 2.2, flick: 0, t });           // per frame
//   g.userData.parts.pupil.position.x = ...                    // a layer moves on its own
import * as THREE from 'three';

// ---------------------------------------------------------------- the pen
// x right, y down, integer cells. Each new pixel gets the next order number (the pen's path); layer() switches the
// layer the next strokes land on; clear() knocks pixels out (where one shape overlaps another, as icons do).
export function pen() {
  const px = new Map(); let n = 0, layer = 'main';
  const key = (x, y) => x + ',' + y;
  const P = {
    px,
    layer(name) { layer = name; return P; },
    dot(x, y) { const k = key(x, y), v = px.get(k); if (!v || v.layer !== layer) px.set(k, { x, y, o: n++, layer }); return P; },   // a later layer lies on top
    // a line as R3 draws them: a slant is a stair of runs (its folder: runs of two); a 45-degree line, where single
    // pixels would only touch at their corners and read as dots, is drawn as a stair of edge-joined pixels
    line(x0, y0, x1, y1) {
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      const stair = Math.min(dx, -dy) > 0.7 * Math.max(dx, -dy);
      let e = dx + dy, x = x0, y = y0;
      for (;;) {
        P.dot(x, y); if (x === x1 && y === y1) break;
        const e2 = 2 * e, mx = e2 >= dy, my = e2 <= dx;
        if (mx && my && stair) { if (dx >= -dy) P.dot(x + sx, y); else P.dot(x, y + sy); }   // the stair step
        if (mx) { e += dy; x += sx; } if (my) { e += dx; y += sy; }
      }
      return P;
    },
    // a hand-drawn bit (ASCII rows, '#' a pixel), drawn in `seq` order when given (a list of [x, y]) or row by row
    sprite(x0, y0, rows) { rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') P.dot(x0 + x, y0 + y); })); return P; },
    poly(pts, close = false) { for (let i = 0; i + 1 < pts.length; i++) P.line(...pts[i], ...pts[i + 1]); if (close) P.line(...pts[pts.length - 1], ...pts[0]); return P; },
    rect(x, y, w, h) { return P.poly([[x, y], [x + w - 1, y], [x + w - 1, y + h - 1], [x, y + h - 1]], true); },
    // a rect with its four corner pixels cut (the soft pixel corner)
    rrect(x, y, w, h) { return P.poly([[x + 1, y], [x + w - 2, y]]).poly([[x + w - 1, y + 1], [x + w - 1, y + h - 2]]).poly([[x + w - 2, y + h - 1], [x + 1, y + h - 1]]).poly([[x, y + h - 2], [x, y + 1]]); },
    // a circle (or an arc, angles in degrees, 0 = right, 90 = down) as a clean 1 px ring, centre may be on a half cell
    circle(cx, cy, r, a0 = -90, a1 = 270) {
      const pts = [], N = Math.max(24, Math.ceil(r * 16));
      for (let i = 0; i <= N; i++) {
        const a = THREE.MathUtils.degToRad(a0 + (a1 - a0) * i / N);
        const p = [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
        const l = pts[pts.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) pts.push(p);
      }
      for (let i = 0; i < pts.length; i++) {                                      // 4-connected, like the lines
        const p = pts[i], q = pts[i - 1];
        if (q && Math.abs(q[0] - p[0]) === 1 && Math.abs(q[1] - p[1]) === 1) {
          const out = (x, y) => Math.hypot(x - cx, y - cy);                           // the step on the side nearer the true ring
          const A = [p[0], q[1]], Bq = [q[0], p[1]];
          P.dot(...(Math.abs(out(...A) - r) < Math.abs(out(...Bq) - r) ? A : Bq));
        }
        P.dot(...p);
      }
      return P;
    },
    clear(fn) { for (const [k, v] of px) if (fn(v.x, v.y, v)) px.delete(k); return P; },
    // knock out every pixel of the other layers that touches this layer (a shape laid over another keeps a black gap)
    // (and everything inside it: a flood fill from outside finds what the layer encloses)
    knock(name, r = 1) {
      const mine = [...px.values()].filter((v) => v.layer === name);
      const xs = mine.map((m) => m.x), ys = mine.map((m) => m.y);
      const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
      const wall = new Set(mine.map((m) => key(m.x, m.y))), out = new Set([key(x0, y0)]), q = [[x0, y0]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          const k = key(a, b); if (a < x0 || a > x1 || b < y0 || b > y1 || out.has(k) || wall.has(k)) continue; out.add(k); q.push([a, b]);
        }
      }
      const inside = (x, y) => x > x0 && x < x1 && y > y0 && y < y1 && !out.has(key(x, y));
      for (const [k, v] of px) if (v.layer !== name && (inside(v.x, v.y) || mine.some((m) => Math.abs(m.x - v.x) <= r && Math.abs(m.y - v.y) <= r))) px.delete(k);
      return P;
    },
  };
  return P;
}

// a tiny 3 x 5 pixel font for the life-up labels (the strokes are lines already)
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'], L: ['#..', '#..', '#..', '#..', '###'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], x: ['...', '#.#', '.#.', '#.#', '...'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 3: ['###', '..#', '.##', '..#', '###'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'], '%': ['#..#', '..#.', '.#..', '#...', '#..#'], ' ': ['..', '..', '..', '..', '..'],
};
export function text(P, s, x0, y0) {
  let x = x0;
  for (const ch of s) { const g = FONT[ch] || FONT[' ']; g.forEach((r, y) => [...r].forEach((c, i) => { if (c === '#') P.dot(x + i, y0 + y); })); x += g[0].length + 1; }
  return P;
}

// ---------------------------------------------------------------- the icons (each designed from the word the VO says)
const page = (P, x, y, w, h, fold = 4) => P.poly([[x, y], [x + w - 1 - fold, y], [x + w - 1, y + fold], [x + w - 1, y + h - 1], [x, y + h - 1]], true)
  .poly([[x + w - 1 - fold, y], [x + w - 1 - fold, y + fold], [x + w - 1, y + fold]]);   // R3's document: a page, its corner folded
// a pencil, steep (R3 keeps its slants to stairs of edge-joined pixels), its tip at (tx, ty), writing down-left
const pencil = (P, tx, ty) => {
  const x = tx - 1, y = ty - 11;
  P.line(x + 1, y + 11, x + 1, y + 8).line(x + 1, y + 11, x + 3, y + 9);       // the tip
  P.line(x + 1, y + 8, x + 5, y + 0).line(x + 3, y + 9, x + 7, y + 1);         // the body
  P.line(x + 5, y + 0, x + 7, y + 1);                                           // the end
  P.line(x + 2, y + 6, x + 4, y + 7);                                           // where the wood meets the paint
  return P;
};
const person = (P, cx, top, w = 13) => {                   // a bust: a round head over rounded shoulders
  const r = (w - 7) / 2; if (r <= 2) P.rrect(cx - 2, top, 5, 5); else P.circle(cx, top + r, r);
  const y0 = top + 2 * r + 2, h = 5, x0 = cx - (w - 1) / 2, x1 = cx + (w - 1) / 2;
  P.poly([[x0, y0 + h], [x0, y0 + 3], [x0 + 3, y0], [x1 - 3, y0], [x1, y0 + 3], [x1, y0 + h], [x0, y0 + h]]);
  return P;
};
const magnifier = (P, cx, cy, r) => { P.circle(cx, cy, r); const d = Math.round(r * 0.72) + 1; P.line(cx + d, cy + d, cx + d + 3, cy + d + 3).line(cx + d + 1, cy + d, cx + d + 4, cy + d + 3); return P; };

export const DESIGNS = {
  // K15 "sorts your inbox": a letter dropping into the in-tray
  inbox: (P) => {
    P.rect(2, 0, 12, 7).line(3, 1, 7, 4).line(12, 1, 8, 4);                                   // the letter, its flap
    P.line(0, 3, 0, 12).line(15, 3, 15, 12).line(0, 12, 15, 12);                               // the tray
    P.poly([[0, 8], [4, 8], [6, 10], [9, 10], [11, 8], [15, 8]]);                             // its front lip, dipped
  },
  // "sorts": the sort sign, an arrow down beside bars getting shorter
  sort: (P) => {
    P.line(2, 0, 2, 10).line(0, 8, 2, 10).line(4, 8, 2, 10);
    P.rect(6, 0, 11, 3).rect(6, 4, 8, 3).rect(6, 8, 5, 3);
  },
  // "drafts the replies": a reply bubble, its lines being written by a pencil
  draft: (P) => {
    P.rrect(0, 0, 16, 11).clear((x, y) => y === 10 && x >= 3 && x <= 4);
    P.poly([[2, 10], [2, 13], [5, 10]]);                                                       // the tail
    P.line(3, 3, 12, 3).layer('write').line(3, 6, 8, 6);
    P.layer('pencil'); pencil(P, 9, 11); P.knock('pencil');
  },
  // "for you": him
  you: (P) => { person(P, 6, 0, 13); },

  // K16 "you just review": a page looked over by an eye; the eye reads it line by line
  review: (P) => {
    page(P, 0, 0, 15, 19, 4);
    P.layer('l0').line(3, 4, 7, 4); P.layer('l1').line(3, 7, 11, 7); P.layer('l2').line(3, 10, 11, 10); P.layer('l3').line(3, 13, 6, 13);
    // the eye, laid over the lower right of the page (knocked out of it): an almond, a ring of iris, the pupil
    const ex = 13, ey = 17;
    P.layer('eye').poly([[ex - 8, ey], [ex - 6, ey - 2], [ex - 3, ey - 4], [ex + 3, ey - 4], [ex + 6, ey - 2], [ex + 8, ey], [ex + 6, ey + 2], [ex + 3, ey + 4], [ex - 3, ey + 4], [ex - 6, ey + 2], [ex - 8, ey]]);
    P.knock('eye');
    P.layer('pupil').circle(ex, ey, 2).rect(ex - 0, ey - 0, 1, 1);
  },
  // "and approve": a tick stamped in a ring
  approve: (P) => {
    P.circle(9, 9, 9);
    P.layer('tick').line(4, 9, 7, 12).line(7, 12, 14, 5);
  },
  // the arrowhead of a dotted pixel arrow (the dashes are drawn by the shader)
  head: (P) => { P.line(0, 0, 2, 2).line(2, 2, 0, 4).dot(1, 2); },

  // K21 / K22 / K49, the modules
  calendar: (P) => {
    P.rect(0, 2, 17, 15).line(1, 6, 15, 6);
    P.line(4, 0, 4, 3).line(12, 0, 12, 3);                                                    // the rings
    for (const y of [9, 13]) for (const x of [3, 6, 9, 12]) if (!(x === 12 && y === 13)) P.dot(x, y).dot(x + 1, y);
    P.layer('day').rect(11, 11, 4, 4);                                                         // today, ringed
  },
  meetings: (P) => {                                                                           // two people and the hour they meet
    P.layer('main'); person(P, 2, 9, 11); person(P, 18, 9, 11);
    P.layer('clock').circle(10, 5, 5).line(10, 5, 10, 2).line(10, 5, 12, 6); P.knock('clock');
  },
  documents: (P) => {                                                                          // a page being written
    page(P, 0, 0, 15, 20, 4);
    P.line(3, 4, 7, 4).line(3, 7, 11, 7).line(3, 10, 11, 10).line(3, 13, 10, 13);
    P.layer('write').line(3, 16, 7, 16);
    P.layer('pencil'); pencil(P, 8, 16); P.knock('pencil');
  },
  research: (P) => {                                                                           // an open book under a magnifier
    P.poly([[0, 2], [4, 1], [9, 3], [14, 1], [18, 2], [18, 14], [14, 13], [9, 15], [4, 13], [0, 14], [0, 2]]).line(9, 3, 9, 15);
    P.line(2, 5, 6, 5).line(2, 8, 7, 8).line(2, 11, 5, 11).line(11, 6, 16, 6).line(11, 9, 15, 9);
    P.layer('lens'); magnifier(P, 15, 13, 4); P.knock('lens');
  },

  // the envelope (K32's sending stream) and a sent one, ticked
  envelope: (P) => { P.rect(0, 0, 13, 9).line(1, 1, 6, 5).line(11, 1, 7, 5); },
  envelopeSent: (P) => { P.rect(0, 0, 13, 9).line(1, 1, 6, 5).line(11, 1, 7, 5); P.layer('tick').line(9, 9, 11, 11).line(11, 11, 15, 7); P.knock('tick'); },
  check: (P) => { P.line(0, 4, 3, 7).line(3, 7, 9, 1); },

  // K24, the life-ups (labels in the pixel font under each)
  coffee: (P) => {
    P.layer('steam'); for (const x of [3, 7]) P.dot(x + 1, 0).dot(x, 1).dot(x, 2).dot(x + 1, 3);
    P.layer('main').poly([[1, 5], [10, 5], [10, 12], [9, 13], [2, 13], [1, 12], [1, 5]]).poly([[10, 7], [12, 7], [13, 8], [13, 10], [12, 11], [10, 11]]);
  },
  hourglass: (P) => {
    P.line(0, 0, 10, 0).line(0, 14, 10, 14).poly([[1, 1], [1, 3], [4, 6], [4, 8], [1, 11], [1, 13]]).poly([[9, 1], [9, 3], [6, 6], [6, 8], [9, 11], [9, 13]]);
    P.layer('sand').line(3, 4, 7, 4).dot(5, 9).line(3, 12, 7, 12).line(4, 11, 6, 11);
  },
  battery: (P) => { P.rect(0, 2, 10, 15).line(3, 0, 6, 0).line(3, 0, 3, 1).line(6, 0, 6, 1); P.layer('cells'); for (const y of [12, 8, 4]) P.rect(2, y, 6, 3); },
  inboxEmpty: (P) => { P.line(0, 0, 0, 9).line(15, 0, 15, 9).line(0, 9, 15, 9).poly([[0, 5], [4, 5], [6, 7], [9, 7], [11, 5], [15, 5]]); },
  moon: (P) => { P.circle(7, 7, 7, 40, 320); P.circle(11, 5, 5.5, 95, 265); P.layer('twinkle').dot(15, 1).dot(14, 2).dot(16, 2).dot(15, 3); },
  star: (P) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.6; pts.push([Math.round(7.5 + r * Math.cos(a)), Math.round(8 + r * Math.sin(a))]); } P.poly(pts, true); },
};

// the life-ups (K24): the icon, its label in the pixel font (meaning kept from round 13)
export const LIFE_ICONS = [
  { name: 'coffee', label: 'COFFEE x99' }, { name: 'hourglass', label: '+38H' }, { name: 'battery', label: '100%' },
  { name: 'inboxEmpty', label: '0 UNREAD' }, { name: 'moon', label: 'SKIP SLEEP' }, { name: 'star', label: 'LVL UP' },
];

// the drawn pixels of a design: [{x, y, o (0..1 along the pen), layer}], plus its grid size
export function design(name) {
  const P = pen(); DESIGNS[name](P);
  const v = [...P.px.values()];
  const n = Math.max(1, v.length - 1);
  const minX = Math.min(...v.map((p) => p.x)), minY = Math.min(...v.map((p) => p.y));
  const o = [...v].sort((a, b) => a.o - b.o);
  o.forEach((p, i) => { p.o = i / n; p.x -= minX; p.y -= minY; });
  return { px: o, w: Math.max(...o.map((p) => p.x)) + 1, h: Math.max(...o.map((p) => p.y)) + 1 };
}

// ---------------------------------------------------------------- 3D
// a white core (a hair warm, as R3's) that the glow pass and the film's bloom turn into a soft halo. Front faces full,
// the sides of each flat voxel a little dimmer so the strokes keep a body when seen at an angle.
const VERT = /* glsl */ `
attribute float aOrder; attribute vec2 aCell;
uniform float uDraw, uFlick, uTime, uSeed, uDash, uDashSpeed, uHot;
varying float vB; varying float vFront;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float drawn = step(aOrder, uDraw);
  float fl = uFlick > 0.0 ? step(uFlick, h(aCell.x * 7.13 + aCell.y * 13.71 + floor(uTime * 24.0) * 1.37 + uSeed)) : 1.0;
  float dash = uDash > 0.0 ? step(fract((aCell.x - uTime * uDashSpeed) / uDash), 0.62) : 1.0;
  float vis = drawn * fl * dash;
  float tip = smoothstep(0.09, 0.0, max(uDraw - aOrder, 0.0)) * drawn;           // the pen tip runs hot
  vB = 1.0 + uHot * tip;
  vFront = step(0.5, normal.z);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * vis, 1.0);
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uK, uLayerK;
varying float vB; varying float vFront;
void main() {
  vec3 c = uColor * uK * uLayerK * vB * mix(0.5, 1.0, vFront);
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;
const WHITE = new THREE.Color(1.0, 0.975, 0.94);
// look-dev: ?linek=0.5 scales every line icon's brightness (to tune the white against a frame without editing it)
const GK = typeof location !== 'undefined' ? +(new URLSearchParams(location.search).get('linek') ?? 1) : 1;

// lineIcon(name, { px, k, color }): a Group, centred on its grid, facing +z. userData.parts[layer] = that layer's mesh
// (its own position / scale to animate), userData.u = the uniforms shared by all its layers.
export function lineIcon(name, { px = 0.008, k = 2.2, color = WHITE, depth = 0.55, dash = 0, dashSpeed = 6, seed = Math.random() * 100 } = {}) {
  const D = typeof name === 'string' ? design(name) : name;
  const g = new THREE.Group(); g.name = 'Line icon ' + (typeof name === 'string' ? name : 'custom');
  const u = { uDraw: { value: 2 }, uK: { value: k }, uFlick: { value: 0 }, uTime: { value: 0 }, uSeed: { value: seed }, uHot: { value: 1.2 },
    uColor: { value: new THREE.Color(color) }, uDash: { value: dash }, uDashSpeed: { value: dashSpeed } };
  const layers = {};
  for (const p of D.px) (layers[p.layer] = layers[p.layer] || []).push(p);
  const geo = new THREE.BoxGeometry(px * 1.002, px * 1.002, px * depth);
  g.userData.parts = {}; g.userData.u = u; g.userData.size = [D.w * px, D.h * px]; g.userData.px = px; g.userData.mats = [];
  for (const [ln, cells] of Object.entries(layers)) {
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, fog: false,
      uniforms: { ...u, uLayerK: { value: 1 } }, userData: { glow: 1, line: true } });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    const order = new Float32Array(cells.length), cell = new Float32Array(cells.length * 2), m = new THREE.Matrix4();
    cells.forEach((c, i) => {
      m.makeTranslation((c.x - (D.w - 1) / 2) * px, ((D.h - 1) / 2 - c.y) * px, 0); mesh.setMatrixAt(i, m);
      order[i] = c.o; cell[i * 2] = c.x; cell[i * 2 + 1] = c.y;
    });
    mesh.geometry = geo.clone();
    mesh.geometry.setAttribute('aOrder', new THREE.InstancedBufferAttribute(order, 1));
    mesh.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
    mesh.name = ln; mesh.userData.cells = cells;
    // the pivot sits at the layer's own centre (a blink, a turn, a punch act about it); the mesh keeps its cells
    const cx = (Math.min(...cells.map((c) => c.x)) + Math.max(...cells.map((c) => c.x))) / 2, cy = (Math.min(...cells.map((c) => c.y)) + Math.max(...cells.map((c) => c.y))) / 2;
    const piv = new THREE.Group(); piv.name = 'layer ' + ln; piv.add(mesh); g.add(piv);
    piv.position.set((cx - (D.w - 1) / 2) * px, ((D.h - 1) / 2 - cy) * px, 0); mesh.position.copy(piv.position).negate();
    piv.userData.p0 = piv.position.clone();
    g.userData.parts[ln] = piv; g.userData.mats.push(mat); piv.userData.mat = mat;
  }
  return g;
}
// per frame: draw (0..1 along the pen; >= 1 done), k (brightness), flick (0..1 of the pixels dropped this frame), t
export function setLine(g, { draw, k, flick, t, hot } = {}) {
  const u = g.userData.u;
  if (draw !== undefined) u.uDraw.value = draw >= 1 ? 2 : draw * 1.1;
  if (k !== undefined) u.uK.value = k * GK;
  if (flick !== undefined) u.uFlick.value = flick;
  if (t !== undefined) u.uTime.value = t;
  if (hot !== undefined) u.uHot.value = hot;
}
export const layerK = (g, ln, k) => { const p = g.userData.parts[ln]; if (p) p.userData.mat.uniforms.uLayerK.value = k; };

// a dotted pixel arrow, `len` cells long (pointing +x), its dashes marching toward the head; px is the icons' pixel
// (the arrow is drawn at half of it, finer than the icons, as in R3)
export function dottedArrow(len = 24, { px = 0.008, k = 1.8, speed = 5 } = {}) {
  const fine = px * 0.5;
  const g = new THREE.Group(); g.name = 'Dotted arrow';
  const P = pen(); P.line(0, 2, len - 2, 2);
  const shaft = { px: [...P.px.values()].map((p, i, a) => ({ ...p, o: i / Math.max(1, a.length - 1) })), w: len + 1, h: 5 };
  const s = lineIcon(shaft, { px: fine, k, dash: 3, dashSpeed: speed }); g.add(s);
  const hd = design('head'); hd.px.forEach((p) => { p.x += len - 2; p.y += 0; }); hd.w = len + 1; hd.h = 5;
  const h = lineIcon(hd, { px: fine, k }); g.add(h);
  g.userData.lines = [s, h];
  return g;
}
export function setArrow(a, o) { for (const l of a.userData.lines) setLine(l, o); }
