// Scene 3: Ivan's room (scenes/03-ivan-room/PLAN.md). The new set, rebuilt from the look target
// (scenes/03-ivan-room/ref/look_target.webp): a dark teal bedroom-study at 3 AM, lit by a warm table lamp, two
// monitors and the night through a big three-unit window. For now a look-dev tour of the set; the shots of the
// reworked intro come once the set is signed off. Ivan arrives with the new model.
//   http://localhost:8080/engine/index.html?scene=s03
import * as THREE from 'three';
import { B, cameraIn, shotIn } from '../../src/shots.js';

export const FPS = 24;
export const DURATION = 18;
export const VO_OFFSET = 0.0;
export const VOICEOVER = null;
export const IVAN = null;                     // the new Tripo Ivan goes in after the set is signed off
export const ROOM = 'scenes/s03/room';        // room.glb, lights.json, lightmaps/ (built by blender/scenes/set_room03.py)
export const ENV_AT = [2.6, 2.4, 1.2];        // reflections are captured from the middle of the room

const DESK = [3.05, 3.95, 0.95];
export const SHOTS = [
  { id: '3.1', name: 'The room at 3 AM', t0: 0, t1: 8, mm: [24, 24], f: 4.0,
    from: [2.70, 0.22, 1.18], to: [2.72, 0.55, 1.16], at0: [2.84, 4.2, 0.92], at1: [2.86, 4.2, 0.92], focus: DESK, roll: [0, 0],
    why: 'The look-target angle: window centred, bed left, desk and shelf right, foreground soft.' },
  { id: '3.2', name: 'Desk', t0: 8, t1: 13, mm: [35, 35], f: 2.8,
    from: [3.95, 1.55, 1.30], to: [3.80, 1.80, 1.28], at0: DESK, at1: DESK, focus: DESK, roll: [0, 0],
    why: 'Where Ivan works: monitors against the night window.' },
  { id: '3.3', name: 'Bed corner', t0: 13, t1: 18, mm: [28, 28], f: 2.8,
    from: [3.90, 0.55, 1.45], to: [3.70, 0.60, 1.40], at0: [0.60, 3.40, 0.80], at1: [0.60, 3.40, 0.80], focus: [0.30, 3.95, 0.95], roll: [0, 0],
    why: 'The warm corner: lamp, nightstand, the bed under the window.' },
];
export const shotAt = (t) => shotIn(SHOTS, t);
export const cameraAt = (t, pick) => cameraIn(SHOTS, t, pick);
export const CAPTIONS = [];

// The live rig. Everything here is a light the camera can see the source of (the references' rule): the lamp,
// the screens and the window. Units follow lights.js: W -> I = W / 4pi; area W -> L = W / (pi A).
export function createLights(scene, data, { quality = 'high' } = {}) {
  const by = Object.fromEntries(data.lights.map((l) => [l.name, l]));
  const room = data.room, L = {};
  const shadow = quality === 'high' ? 2048 : 1024;
  const [x0, x1, sill, head] = room.window;
  const winC = B((x0 + x1) / 2, room.d + 0.05, (sill + head) / 2);

  // table lamp: warm, the "home" light in the corner; shadows of the bed and nightstand onto the wall
  const lamp = by.Desk_Lamp;
  L.lamp = new THREE.PointLight(new THREE.Color(...lamp.color), lamp.energy_w / (4 * Math.PI), 0, 2);
  L.lamp.position.copy(B(...lamp.location));
  L.lamp.castShadow = true; L.lamp.shadow.mapSize.set(1024, 1024); L.lamp.shadow.radius = 4;
  L.lamp.shadow.bias = -0.0005; L.lamp.shadow.normalBias = 0.02; L.lamp.shadow.camera.near = 0.08;
  scene.add(L.lamp); L.lampBase = L.lamp.intensity;

  // moon + city sky: a cool, hard-ish key from high outside; the window frame and blinds print onto the room
  L.moon = new THREE.DirectionalLight(0x9db4ff, 0.55);
  L.moon.position.copy(B(1.2, 12, 7.5)); L.moon.target.position.copy(B(2.9, 2.2, 0));
  L.moon.castShadow = true; L.moon.shadow.mapSize.set(shadow, shadow);
  Object.assign(L.moon.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
  L.moon.shadow.bias = -0.0004; L.moon.shadow.normalBias = 0.02; L.moon.shadow.radius = 2;
  scene.add(L.moon, L.moon.target);

  // the window as a soft source: night sky glow over the desk and the bed
  L.window = new THREE.RectAreaLight(0x5d7dff, 0.9, x1 - x0, head - sill);
  L.window.position.copy(winC); L.window.lookAt(winC.clone().add(new THREE.Vector3(0, 0, 1)));
  scene.add(L.window);

  // the two monitors and the laptop: blue-white panels facing the room
  L.screens = [];
  for (const n of ['Monitor_Screen', 'Monitor_Screen_L', 'Laptop_Screen']) {
    const p = data.marks[n]; if (!p) continue;
    const s = new THREE.RectAreaLight(0x8fb0ff, n === 'Laptop_Screen' ? 2.2 : 3.2, n === 'Laptop_Screen' ? 0.33 : 0.56, n === 'Laptop_Screen' ? 0.21 : 0.33);
    s.position.copy(B(p[0], p[1] - 0.03, p[2])); s.lookAt(B(p[0], p[1] - 1, p[2] - 0.15));
    scene.add(s); L.screens.push({ s, base: s.intensity });
  }
  // what the dark walls give back: barely anything, a little blue
  L.fill = new THREE.HemisphereLight(0x22305a, 0x0b0806, 0.12);
  scene.add(L.fill);

  L.apply = ({ lamp: lk = 1, screen: sk = 1 } = {}) => {
    L.lamp.intensity = L.lampBase * lk;
    for (const { s, base } of L.screens) s.intensity = base * sk;
  };
  return L;
}
