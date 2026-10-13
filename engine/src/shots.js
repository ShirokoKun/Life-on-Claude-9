// The film: 32 s, five shots, four cuts, timed to the voiceover (which starts at VO_OFFSET).
// Positions are Blender coordinates (metres, Z up); B() converts. Every move is one intention:
// a push, a drift, a rack, an arc. Lenses and stops are real (36 mm sensor, thin-lens depth of field).
import * as THREE from 'three';

export const FPS = 24;
export const DURATION = 32;
export const VO_OFFSET = 1.5;
export const B = (x, y, z) => new THREE.Vector3(x, z, -y);

const GLASS = [6.66, 3.10, 0.84];

export const SHOTS = [
  { id: 'S1', name: 'The zone', t0: 0, t1: 5.6, mm: [24, 30], f: 2.8,
    from: [4.30, 4.95, 1.70], to: [5.25, 4.20, 1.42], at0: [6.90, 2.85, 1.02], at1: [6.92, 2.80, 1.08], focus: 'eyes', roll: [-1.2, -0.4],
    why: 'A slow descending push from the dark living room into the only lit corner: the lamp pool, the two screens, the string lights, the clock at 3:04. He is small inside his world.' },
  { id: 'S2', name: 'Still full', t0: 5.6, t1: 11.4, mm: [24, 26], f: 2.0,
    from: [6.38, 3.27, 0.83], to: [6.41, 3.23, 0.836], at0: [7.16, 2.62, 1.06], at1: [7.16, 2.60, 1.08],
    focus: [[5.6, GLASS], [7.6, GLASS], [8.8, 'eyes'], [9.9, 'eyes'], [10.7, GLASS]], roll: [0.6, 0.3],
    why: 'Desk height, past the cold take-out and the full glass. Focus holds the glass for the line, racks to Ivan typing behind it, then back to the glass on "still full".' },
  { id: 'S3', name: 'Lit by the work', t0: 11.4, t1: 16.2, mm: [50, 62], f: 2.0,
    from: [6.86, 3.98, 1.14], to: [6.90, 3.58, 1.15], at0: [6.94, 2.72, 1.18], at1: [6.94, 2.72, 1.19], focus: 'eyes', roll: [0, 0],
    why: 'Push in on his face over the laptop lid: the screen is his key light, the string lights fall to bokeh behind him. He leans in, typing faster.' },
  { id: 'S4', name: 'The sprawl', t0: 16.2, t1: 22.2, mm: [30, 35], f: 2.8,
    from: [7.62, 2.46, 1.36], to: [7.44, 2.66, 1.26], at0: [7.05, 3.20, 0.92], at1: [7.16, 3.26, 0.98], focus: 'screen', roll: [1.0, 0.4],
    why: 'Over his right shoulder into the screens: terminal, the Claude chat, scripts piling up; his eyes flick to the dashboard climbing on the second monitor.' },
  { id: 'S5', name: 'Because he could', t0: 22.2, t1: 32, mm: [35, 26], f: 3.2, arc: [6.95, 2.75],
    from: [7.30, 4.25, 1.52], to: [5.95, 4.30, 1.58], at0: [6.96, 2.78, 1.06], at1: [6.92, 2.85, 1.05], focus: 'eyes', roll: [0.4, -0.8],
    why: 'A slow arc from his right to his left and out: his cocoon of light, the dark flat around it. On the last line, a small nod. Fade on the room.' },
];

export const CAPTIONS = [
  [1.5, 5.3, "It's 3 AM and Ivan hasn't eaten since lunch."],
  [6.0, 9.3, "There's a glass of water on his desk that he poured six hours ago."],
  [10.1, 11.2, "It's still full."],
  [11.7, 15.8, "He's hunched over his laptop, typing furiously, eyes bloodshot."],
  [16.3, 21.9, 'On the screen: a terminal window, a Claude chat, and a growing sprawl of Python scripts.'],
  [22.5, 24.5, "He's building an email automation system."],
  [25.1, 26.7, 'Not because anyone asked him to.'],
  [27.4, 29.0, 'Because he realized he could.'],
];

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const easeInOut = (x) => { x = Math.min(1, Math.max(0, x)); return 0.5 - 0.5 * Math.cos(Math.PI * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function shotAt(t) { return SHOTS.find((s) => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1]; }

// pick: (name) -> THREE.Vector3 for 'eyes' / 'screen' (live positions from the scene)
export function cameraAt(t, pick) {
  const s = shotAt(t), u = easeInOut((t - s.t0) / (s.t1 - s.t0));
  let pos;
  if (s.arc) {
    const c = B(s.arc[0], s.arc[1], 0), p0 = B(...s.from), p1 = B(...s.to);
    const a0 = Math.atan2(p0.z - c.z, p0.x - c.x), a1 = Math.atan2(p1.z - c.z, p1.x - c.x);
    const r0 = Math.hypot(p0.x - c.x, p0.z - c.z), r1 = Math.hypot(p1.x - c.x, p1.z - c.z);
    let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    const a = a0 + da * u, r = lerp(r0, r1, u);
    pos = new THREE.Vector3(c.x + Math.cos(a) * r, lerp(p0.y, p1.y, u), c.z + Math.sin(a) * r);
  } else pos = B(...lerp3(s.from, s.to, u));
  const at = B(...lerp3(s.at0, s.at1, u));
  const mm = lerp(s.mm[0], s.mm[1], u);
  const roll = THREE.MathUtils.degToRad(lerp(s.roll[0], s.roll[1], u));
  const resolve = (f) => (typeof f === 'string' ? pick(f) : B(...f));
  let focusPt;
  if (Array.isArray(s.focus)) {                       // keyed focus pulls: [[time, target], ...]
    const k = s.focus; let i = 0; while (i < k.length - 1 && t > k[i + 1][0]) i++;
    const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
    const w = b[0] > a[0] ? ease((t - a[0]) / (b[0] - a[0])) : 0;
    focusPt = resolve(a[1]).lerp(resolve(b[1]), w);
  } else focusPt = resolve(s.focus);
  return { pos, at, mm, f: s.f, focus: pos.distanceTo(focusPt), roll, shot: s, u };
}
