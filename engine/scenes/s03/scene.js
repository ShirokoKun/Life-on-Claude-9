// Scene 1, rebuilt in Ivan's new room (scenes/03-ivan-room/PLAN.md, ref/plan_topdown.jpg). Same story, voiceover,
// captions and timing as the intro (engine/src/shots.js); the set is new: a dark green bedroom-study at 3 AM,
// lit by a table lamp, two monitors, the laptop and the night through a three-unit window.
//   http://localhost:8080/engine/index.html?scene=s03
// The room's axes are chosen so the desk faces +y as in the flat: the intro's desk shots, Ivan's performance and
// the screens move over by OFF unchanged. The two wide shots are new, made for this room.
import * as THREE from 'three';
import { B, cameraIn, shotIn, SHOTS as INTRO, CAPTIONS as INTRO_CAPS, VO_OFFSET as INTRO_VO, DURATION as INTRO_LEN } from '../../src/shots.js';

export const FPS = 24;
export const DURATION = INTRO_LEN;
export const VO_OFFSET = INTRO_VO;
export const VOICEOVER = 'assets/voiceover.wav';
export const ROOM = 'scenes/s03/room';        // room.glb, lights.json, lightmaps/ (built by blender/scenes/set_room03.py)
export const IVAN = 'scenes/s03/ivan.glb';    // the new Tripo Ivan, same intro performance (prep_tripo.py)
export const ACTING = 'scenes/s03/acting.json';
export const OFF = [-5.90, 1.23, 0.0];        // the flat's desk zone -> this room (set_room03.OFF)
export const CAST_OFFSET = OFF;
export const ENV_AT = [1.3, 2.9, 1.2];        // reflections are captured from the middle of the room

const shift = (p) => (Array.isArray(p) && typeof p[0] === 'number' ? [p[0] + OFF[0], p[1] + OFF[1], p[2] + OFF[2]] : p);
const shiftFocus = (f) => (Array.isArray(f) && Array.isArray(f[0]) ? f.map(([t, p]) => [t, shift(p)]) : shift(f));
const moved = (s) => ({ ...s, from: shift(s.from), to: shift(s.to), at0: shift(s.at0), at1: shift(s.at1), focus: shiftFocus(s.focus),
  ...(s.atKeys ? { atKeys: s.atKeys.map(([t, p]) => [t, shift(p)]) } : {}), ...(s.arc ? { arc: shift(s.arc) } : {}) });

const DESK = [1.05, 4.42, 0.92];
const NEW = {
  E1: { from: [2.25, 2.40, 3.45], to: [2.15, 2.40, 3.20], at0: [0.85, 2.40, 0.35], at1: [0.85, 2.42, 0.35], mm: [17, 18], f: 5.6,
    focus: [1.2, 2.4, 0.5], roll: [0, 0], top: true,
    why: 'Straight down into his room (the reference frame): bed, guitar, rugs, the lamp, and at the edge of it all the one lit desk. He is small inside his world.' },
  S1: { from: [3.72, 0.40, 1.78], to: [3.05, 1.45, 1.58], at0: DESK, at1: [1.05, 4.40, 1.00], mm: [22, 26], f: 2.8, focus: 'eyes', roll: [-1.0, -0.4],
    why: 'From the dark corner by the door, one long slow push across the room toward the only lit corner, where he works. "It\'s 3 AM."' },
};
export const SHOTS = INTRO.map((s) => (NEW[s.id] ? { ...s, ...NEW[s.id] } : moved(s)));
export const shotAt = (t) => shotIn(SHOTS, t);
export const cameraAt = (t, pick) => cameraIn(SHOTS, t, pick);
export const CAPTIONS = INTRO_CAPS;

// Shots that look at his face from the desk side stand where the north wall is: it is a wild wall, pulled for
// those shots as on a film set. The top shot takes the ceiling off.
export function props(t, { named }) {
  const s = shotAt(t);
  const camY = cameraAt(t, () => new THREE.Vector3()).pos.z * -1;      // three z = -Blender y
  const ceil = named.Baked_CEIL || named.Ceiling, wall = named.Baked_WALLN || named.Wall_N;   // baked or layout export
  if (ceil) ceil.visible = !s.top;
  if (wall) wall.visible = camY < 4.75;
}

// The live rig. Every light has a source the camera can see: the lamp, the screens, the window.
// Units follow lights.js: W -> I = W / 4pi; area W -> L = W / (pi A).
export function createLights(scene, data, { quality = 'high' } = {}) {
  const by = Object.fromEntries(data.lights.map((l) => [l.name, l]));
  const room = data.room, L = {};
  const shadow = quality === 'high' ? 2048 : 1024;
  const [y0, y1, sill, head] = room.window;
  const winC = B(-0.06, (y0 + y1) / 2, (sill + head) / 2);
  const FACE = B(1.04, 3.95, 1.14);
  // baked (lights.json lists lightmap groups): the room's light is in the lightmaps, minus the lamp's and the laptop's
  // direct light, which stay live so Ivan shadows the desk. Unbaked layout exports get a full live rig instead.
  const baked = !!data.groups;

  // table lamp on the nightstand: warm, the "home" light behind his left shoulder
  const lamp = by.Desk_Lamp;
  L.lamp = new THREE.PointLight(new THREE.Color(...lamp.color), lamp.energy_w / (4 * Math.PI), 0, 2);
  L.lamp.position.copy(B(...lamp.location));
  L.lamp.castShadow = true; L.lamp.shadow.mapSize.set(1024, 1024); L.lamp.shadow.radius = 4;
  L.lamp.shadow.bias = -0.0005; L.lamp.shadow.normalBias = 0.02; L.lamp.shadow.camera.near = 0.12;
  scene.add(L.lamp); L.lampBase = L.lamp.intensity;

  // moon over the valley: a cool, hard-ish key from high outside the west window; frame and blinds print on the bed
  // (baked: a faint live copy on top, for crisp window shadows and Ivan's cool edge)
  L.moon = new THREE.DirectionalLight(0x9db4ff, baked ? 0.12 : 0.6);
  L.moon.position.copy(B(-8.4, 5.1, 8.0)); L.moon.target.position.copy(B(1.6, 1.6, 0.5));   // set_room03.MOON
  L.moon.castShadow = true; L.moon.shadow.mapSize.set(shadow, shadow);
  Object.assign(L.moon.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
  L.moon.shadow.bias = -0.0004; L.moon.shadow.normalBias = 0.02; L.moon.shadow.radius = 2;
  scene.add(L.moon, L.moon.target);

  // the window as a soft source: night sky over the bed and the floor (baked: in the lightmaps)
  if (!baked) {
    L.window = new THREE.RectAreaLight(0x5d7dff, 0.8, y1 - y0, head - sill);
    L.window.position.copy(winC); L.window.lookAt(winC.clone().add(new THREE.Vector3(1, 0, 0)));
    scene.add(L.window);
  }

  // screens: blue-white panels facing him; the right monitor is the side key that carves his face.
  // Baked: only the laptop stays live (its direct light is subtracted from the bake), at the intro's 0.22.
  L.screens = [];
  const key = by.Key_Laptop;
  if (baked && key) {
    const [w, h] = key.size;
    const s = new THREE.RectAreaLight(new THREE.Color(...key.color), 0.22 * key.energy_w / (Math.PI * w * h), w, h);
    s.position.copy(B(...key.location)); s.lookAt(s.position.clone().add(new THREE.Vector3(key.forward[0], key.forward[2], -key.forward[1])));
    scene.add(s); L.screens.push({ s, base: s.intensity });
  }
  for (const n of baked ? [] : ['Monitor_Screen', 'Monitor2_Screen', 'Laptop_Screen']) {
    const p = data.marks[n]; if (!p) continue;
    const lap = n === 'Laptop_Screen';
    const s = new THREE.RectAreaLight(0x8fb0ff, lap ? 2.0 : 2.6, lap ? 0.29 : 0.56, lap ? 0.18 : 0.33);
    s.position.copy(B(p[0], p[1] - 0.03, p[2])); s.lookAt(B(p[0], p[1] - 1, p[2] - 0.1));
    scene.add(s); L.screens.push({ s, base: s.intensity });
  }
  const mon = data.marks.Monitor_Screen;
  if (mon) {
    L.monitor = new THREE.SpotLight(0x86b8ff, 1.9, 1.7, THREE.MathUtils.degToRad(22), 0.5, 1.5);
    L.monitor.position.copy(B(...mon)); L.monitor.target.position.copy(FACE);
    L.monitor.castShadow = true; L.monitor.shadow.mapSize.set(1024, 1024); L.monitor.shadow.radius = 2;
    L.monitor.shadow.bias = -0.0002; L.monitor.shadow.normalBias = 0.015;
    scene.add(L.monitor, L.monitor.target);
  }
  // what the dark green walls give back: barely anything, a little blue (baked: the environment capture does it)
  if (!baked) { L.fill = new THREE.HemisphereLight(0x22305a, 0x0b0806, 0.10); scene.add(L.fill); }

  L.apply = ({ lamp: lk = 1, screen: sk = 1 } = {}) => {
    L.lamp.intensity = L.lampBase * lk;
    for (const { s, base } of L.screens) s.intensity = base * sk;
    if (L.monitor) L.monitor.intensity = 1.9 * sk;
  };
  return L;
}
