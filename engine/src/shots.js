// The intro, v2: 37 s. A 6 s environment opening before the first line, then the voiceover (VO_OFFSET).
// Positions are Blender coordinates (metres, Z up); B() converts. Every move is one intention:
// a push, a drift, a rack, a dolly zoom. Lenses and stops are real (36 mm sensor, thin-lens depth of field).
//
// Shot fields
//   from/to        camera path (eased); arc: [cx, cy] swings around a centre instead
//   at0/at1        aim, or atKeys: [[t, target], ...] keyed like focus pulls (a target is a point or a pick)
//   track          0-1: blend the aim toward Ivan's eyes (follows his posture)
//   mm             [start, end] focal length, or dolly: k (mm per metre to the subject: a dolly zoom)
//   focus          a pick ('eyes', 'screen', 'lap:x,y', 'mon:x,y'), a point, or keyed [[t, target], ...]
import * as THREE from 'three';

export const FPS = 24;
export const DURATION = 37;
export const VO_OFFSET = 6.0;
export const B = (x, y, z) => new THREE.Vector3(x, z, -y);

const GLASS = [6.66, 3.10, 0.84];
const PHONE = [7.41, 2.975, 0.766];          // the lock-screen clock, top of the phone
const FACE = [6.94, 2.72, 1.12];

// reading on the laptop: terminal lines, then the Claude reply, then the file list (pixel picks on the screen)
const READ = [
  [20.6, 'lap:120,686'], [21.0, 'lap:160,686'], [21.4, 'lap:160,710'], [21.85, 'lap:180,734'], [22.25, 'lap:200,758'],
  [22.75, 'lap:1180,560'], [23.2, 'lap:1220,583'], [23.65, 'lap:1240,606'], [24.1, 'lap:1240,629'], [24.55, 'lap:1180,676'],
  [25.15, 'lap:70,75'], [25.5, 'lap:70,205'], [25.85, 'lap:80,283'], [26.2, 'lap:90,309'], [26.6, 'lap:90,335'],
];

export const SHOTS = [
  { id: 'E1', name: 'Three AM', t0: 0, t1: 2.8, mm: [24, 26], f: 2.8,
    from: [9.60, 4.30, 1.90], to: [9.30, 4.05, 1.80], at0: [7.00, 3.00, 1.00], at1: [7.00, 3.02, 1.00], focus: 'eyes', roll: [-0.6, -0.3],
    why: 'From the window corner of the dark flat: the bookcase, the string lights, and far away the one lit desk. He is small inside his world.' },
  { id: 'E2', name: '3:04', t0: 2.8, t1: 5.0, mm: [45, 50], f: 2.0,
    from: [7.47, 2.76, 0.92], to: [7.455, 2.79, 0.905], at0: [7.39, 2.96, 0.76], at1: [7.395, 2.95, 0.76], focus: PHONE, roll: [0.8, 0.5],
    why: 'His phone face up by the mouse: 3:04, three unanswered texts from Sasha, and Mail: 214 new messages.' },
  { id: 'S1', name: 'The zone', t0: 5.0, t1: 9.9, mm: [22, 26], f: 2.8,
    from: [9.25, 2.45, 1.95], to: [8.30, 2.62, 1.58], at0: [6.98, 3.20, 0.85], at1: [6.98, 3.16, 0.92], focus: 'eyes', roll: [-1.2, -0.5],
    why: 'From the dark corner of the flat, one long slow push toward the only lit corner, where he works. "It\'s 3 AM."' },
  { id: 'S2', name: 'Still full', t0: 9.9, t1: 16.0, mm: [28, 30], f: 4.0,
    from: [6.452, 3.223, 0.80], to: [6.47, 3.21, 0.803], at0: [7.22, 2.58, 1.07], at1: [7.22, 2.57, 1.08],
    focus: [[9.9, GLASS], [12.2, GLASS], [13.2, 'eyes'], [14.0, 'eyes'], [14.7, GLASS]], roll: [0.6, 0.3],
    why: 'Desk height, past the full glass. Focus holds the glass for the line, racks to Ivan typing behind it, then back on "still full".' },
  { id: 'S3', name: 'Bloodshot', t0: 16.0, t1: 20.6, dolly: 43, f: 2.0,
    from: [6.96, 3.30, 1.03], to: [6.97, 3.98, 1.03], at0: FACE, at1: FACE, track: 0.85, focus: 'eyes', roll: [0, 0],
    why: 'A dolly zoom on his face: the camera pulls back as the lens closes in, so his face holds still while the room crowds in behind him. He hunches deeper.' },
  { id: 'S4', name: 'Reading', t0: 20.6, t1: 26.6, mm: [60, 66], f: 1.4,
    from: [6.80, 2.90, 1.40], to: [6.82, 2.93, 1.37], atKeys: [[20.6, 'lap:300,740'], [22.3, 'lap:420,740'], [23.0, 'lap:1150,640'], [24.6, 'lap:1150,620'], [25.4, 'lap:500,260'], [26.6, 'lap:450,240']],
    focus: READ, roll: [0.6, 0.3],
    why: 'Over his left shoulder, close on the laptop. Focus moves line by line like his eyes: the terminal, Claude\'s reply streaming in, the growing list of scripts.' },
  { id: 'S4b', name: 'The pipeline', t0: 26.6, t1: 31.4, mm: [35, 38], f: 2.8,
    from: [6.72, 2.50, 1.28], to: [6.86, 2.43, 1.30], at0: [7.36, 3.31, 1.07], at1: [7.36, 3.31, 1.07], focus: 'mon:800,240', roll: [-0.4, 0.2],
    why: 'Behind him, sliding sideways: his head soft in the foreground, the pipeline on the monitor. Inbox, classify, draft, review, and send, still waiting on him.' },
  { id: 'S5a', name: 'Sent', t0: 31.4, t1: 32.7, mm: [70, 74], f: 2.0,
    from: [7.02, 2.86, 1.21], to: [7.03, 2.87, 1.21], at0: 'mon:1250,140', at1: 'mon:1290,130', focus: 'mon:1310,110', roll: [0, 0],
    why: 'His point of view: the first email the system sends on its own.' },
  { id: 'S5', name: 'Because he could', t0: 32.7, t1: 37, mm: [40, 34], f: 2.4,
    from: [7.05, 3.66, 1.24], to: [7.09, 4.02, 1.30], at0: FACE, at1: [6.94, 2.70, 1.20], track: 0.6, focus: 'eyes', roll: [0.3, -0.2],
    why: 'In front of him as it lands: an exhale, he leans back, hands behind his head, a small nod. The camera eases away and leaves him there.' },
];

export const CAPTIONS = [
  [6.0, 9.8, "It's 3 AM and Ivan hasn't eaten since lunch."],
  [10.5, 13.8, "There's a glass of water on his desk that he poured six hours ago."],
  [14.6, 15.7, "It's still full."],
  [16.2, 20.3, "He's hunched over his laptop, typing furiously, eyes bloodshot."],
  [20.8, 26.4, 'On the screen: a terminal window, a Claude chat, and a growing sprawl of Python scripts.'],
  [27.0, 29.0, "He's building an email automation system."],
  [29.6, 31.2, 'Not because anyone asked him to.'],
  [31.9, 33.5, 'Because he realized he could.'],
];

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const easeInOut = (x) => { x = Math.min(1, Math.max(0, x)); return 0.5 - 0.5 * Math.cos(Math.PI * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function shotIn(shots, t) { return shots.find((s) => t >= s.t0 && t < s.t1) || shots[shots.length - 1]; }
export function shotAt(t) { return shotIn(SHOTS, t); }

// keyed targets: [[time, target], ...], eased between keys, held at the ends
function keyed(k, t, resolve) {
  let i = 0; while (i < k.length - 1 && t > k[i + 1][0]) i++;
  const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
  const w = b[0] > a[0] ? ease((t - a[0]) / (b[0] - a[0])) : 0;
  return resolve(a[1]).lerp(resolve(b[1]), w);
}

// pick: (name) -> THREE.Vector3 for 'eyes' / 'screen' / 'lap:x,y' / 'mon:x,y' (live positions from the scene)
export function cameraAt(t, pick) { return cameraIn(SHOTS, t, pick); }
export function cameraIn(shots, t, pick) {
  const s = shotIn(shots, t), u = easeInOut((t - s.t0) / (s.t1 - s.t0));
  const resolve = (f) => (typeof f === 'string' ? pick(f).clone() : B(...f));
  let pos;
  if (s.arc) {
    const c = B(s.arc[0], s.arc[1], 0), p0 = B(...s.from), p1 = B(...s.to);
    const a0 = Math.atan2(p0.z - c.z, p0.x - c.x), a1 = Math.atan2(p1.z - c.z, p1.x - c.x);
    const r0 = Math.hypot(p0.x - c.x, p0.z - c.z), r1 = Math.hypot(p1.x - c.x, p1.z - c.z);
    let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    const a = a0 + da * u, r = lerp(r0, r1, u);
    pos = new THREE.Vector3(c.x + Math.cos(a) * r, lerp(p0.y, p1.y, u), c.z + Math.sin(a) * r);
  } else pos = B(...lerp3(s.from, s.to, u));
  let at = s.atKeys ? keyed(s.atKeys, t, resolve) : resolve(s.at0).lerp(resolve(s.at1), u);
  if (s.track) at.lerp(pick('eyes').clone().add(new THREE.Vector3(0, -0.02, 0)), s.track);
  const roll = THREE.MathUtils.degToRad(lerp(s.roll[0], s.roll[1], u));
  const focusPt = Array.isArray(s.focus) && Array.isArray(s.focus[0]) ? keyed(s.focus, t, resolve) : resolve(s.focus);
  // a dolly zoom keeps the subject's size: focal length grows with distance
  const mm = s.dolly ? s.dolly * pos.distanceTo(pick('eyes')) : lerp(s.mm[0], s.mm[1], u);
  return { pos, at, mm, f: s.f, focus: pos.distanceTo(focusPt), roll, shot: s, u };
}
