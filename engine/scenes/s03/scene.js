// Scene 1, rebuilt in Ivan's new room (scenes/03-ivan-room/PLAN.md, ref/plan_topdown.jpg). Same story, voiceover,
// captions and timing as the intro (engine/src/shots.js); the set is new: a dark green bedroom-study at 3 AM,
// lit by a table lamp, two monitors, the laptop and the night through a three-unit window.
//   http://localhost:8080/engine/index.html?scene=s03
// The room's axes are chosen so the desk faces +y as in the flat: the intro's desk shots, Ivan's performance and
// the screens move over by OFF unchanged. The two wide shots are new, made for this room.
import * as THREE from 'three';
import { createVolume } from '../../src/volume.js';
import { COMMON } from '../../src/atmosphere.js';
import { applyLook, lookExposure } from './looks.js';
export { LOOKS, LOOK_NAME } from './looks.js';
import { B, cameraIn, shotIn } from '../../src/shots.js';
import { SCREENS as CH1 } from '../ch1/screens.js';

// On the Ch 1 VO package clock (scenes/03-ivan-room/DIRECTION.md): chapter seconds 0-37.9, V01-V07b, then the
// flashback (s04). The sound is the package's full mix (VO + sound design), cut at 37.9 s.
export const FPS = 24;
export const DURATION = 37.9;
export const VO_OFFSET = 0.0;
export const VOICEOVER = 'scenes/s03/sound.wav';
export const FADE_OUT = false;                // it cuts into the flashback, it does not fade
export const ROOM = 'scenes/s03/room';        // room.glb, lights.json, lightmaps/ (built by blender/scenes/set_room03.py)
// the Tripo Ivan with the slim round glasses and his scene-3 performance on the VO clock (acting.py SCENE_S03).
// ivan.glb / acting.json keep the intro's performance (the kf1 board holds poses from it).
export const IVAN = 'scenes/s03/ivan_v2.glb';
export const ACTING = 'scenes/s03/acting_v2.json';
export const OFF = [-5.90, 1.23, 0.0];        // the flat's desk zone -> this room (set_room03.OFF)
export const CAST_OFFSET = OFF;
export const ENV_AT = [1.3, 2.9, 1.2];
export const DUST = { center: [1.4, 2.8], spread: 1.5 };   // motes through the whole room, thickest in the window light        // reflections are captured from the middle of the room

// marks (room metres, Blender axes): the glass's front surface is where the lens focuses, never its centre (the
// centre is inside the water and leaves both walls soft)
const DESK = [1.05, 4.42, 0.92];
const PHONE = [1.51, 4.205, 0.766];                  // the lock-screen clock, top of the phone
const FACE = [1.04, 3.95, 1.12];
const GLASS_S2 = [0.735, 4.345, 0.815];              // front wall seen from S2's camera
const GLASS_S2B = [0.726, 4.315, 0.845];             // front of the waterline seen from S2b's camera
const KEYS = [1.085, 4.29, 0.79];                    // his right index fingertip on the keys (measured)
const HAND = [1.09, 4.25, 0.81];                     // the back of his right hand, resting

// Real VO (measured on the narrator stem): V01 3.00-7.36 · V02 8.06-12.03 ("glass" 8.55) · V03 12.93-14.73 (sub drop
// 12.88) · V04 15.84-20.67 ("bloodshot" 19.7) · V05 21.17-26.24 ("a Claude chat" 22.87, "Python scripts" 24.6) ·
// V06 26.84-29.68 (pings 27.76, 28.46, 29.16) · V07a 30.58-34.45 ("Claude" 32.2, chime 32.50) · V07b 35.15-37.27
// (Enter 35.70, 36.30, 36.85; hit 36.25). Cuts land a few frames before the word they serve.
//
// Shot fields as in shots.js, plus:  lift  vertical aim offset in metres (negative: the subject rises in frame)
//                                    still true: the frame stops breathing (no operator drift)
export const SHOTS = [
  // E1, S1 and S4 keep the cameras set in the Studio (they were overrides in camera.json, now written in here so the
  // keyed focus below can play: an override fixes focus at its aim point)
  { id: 'E1', name: 'Three AM', t0: 0, t1: 2.65, mm: [13, 13], f: 2.8,
    from: [3.3328, 0.551, 1.3114], to: [3.2619, 0.6114, 1.816], at0: [0.2973, 3.1388, 0.8362], at1: [0.2973, 3.1388, 0.8362],
    focus: [0.2973, 3.1388, 0.8362], roll: [0, 0],
    why: 'Room tone before the first word. The whole room from the door corner, rising: the bed he is not in, the lamp, the window, and far off the one lit desk. He is small inside his world.' },
  { id: 'E2', name: '3:04', t0: 2.65, t1: 5.4, mm: [45, 50], f: 2.0,
    from: [1.57, 3.99, 0.92], to: [1.555, 4.02, 0.905], at0: [1.49, 4.19, 0.76], at1: [1.495, 4.18, 0.76], focus: PHONE, roll: [0.8, 0.5],
    why: '"It\'s 3 AM," over a dark phone; it wakes on the click (4.15): 3:04, Sarah\'s unanswered texts, Mail 214. The picture confirms the line a beat after the voice, and adds that someone is waiting for him.' },
  { id: 'S1', name: 'The zone', t0: 5.4, t1: 7.85, mm: [29, 29], f: 2.0,
    from: [2.5471, 2.5998, 1.4438], to: [3.2302, 3.5698, 1.317], at0: [0.9367, 4.3992, 0.9203], at1: [0.9367, 4.3992, 0.9203], focus: 'eyes', roll: [0, 0],
    why: '"...and Ivan hasn\'t eaten since lunch." The Studio move across the room toward the lit corner, now wide open (f/2) and focused on him, not the desk: the room falls soft and he is the one sharp thing.' },
  { id: 'S2', name: 'Six hours ago', t0: 7.85, t1: 12.8, mm: [35, 38], f: 5.6,
    from: [0.50, 4.48, 0.80], to: [0.535, 4.455, 0.80], at0: [1.30, 3.84, 1.04], at1: [1.28, 3.85, 1.02],
    focus: [[7.85, 'eyes'], [8.35, 'eyes'], [8.95, GLASS_S2], [12.8, GLASS_S2]], roll: [0.5, 0.3],
    why: 'Desk height behind the glass. It opens on Ivan typing, the glass a soft shape in front; on "glass" focus comes to it and stays while he types on, a blur behind. A slow push toward it.' },
  { id: 'S2b', name: 'Still full', t0: 12.8, t1: 15.7, mm: [65, 65], f: 5.6, still: true,
    from: [0.431, 4.185, 0.90], to: [0.431, 4.185, 0.90], at0: [0.76, 4.33, 0.838], at1: [0.76, 4.33, 0.838], focus: GLASS_S2B, roll: [0, 0],
    why: 'Cut on the sub drop. Macro on the waterline, locked off and breathless: the meniscus sharp, the laptop a blue bokeh behind it, his typing stopped. "It\'s still full."' },
  { id: 'S3', name: 'Bloodshot', t0: 15.7, t1: 21.05, dolly: 46, f: 2.0, lift: -0.085,
    from: [1.07, 4.53, 1.08], to: [1.09, 5.25, 1.10], at0: FACE, at1: FACE, track: 0.85, focus: 'eyes', roll: [0, 0],
    why: 'A dolly zoom on his face from just above the screen: the camera pulls back as the lens closes in, so his face holds while the room crowds in. He hunches on the chair creak; the eyes land on "bloodshot", high in frame.' },
  { id: 'S4', name: 'Reading', t0: 21.05, t1: 26.7, mm: [52, 52], f: 2.4,
    from: [0.1494, 3.6318, 1.2604], to: [0.3673, 3.6797, 1.2939],
    atKeys: [[21.05, 'lap:300,740'], [22.45, 'lap:420,740'], [22.95, 'lap:1150,640'], [24.25, 'lap:1150,620'], [24.85, 'lap:500,260'], [26.7, 'lap:450,240']],
    focus: [[21.3, 'lap:120,686'], [21.7, 'lap:160,686'], [22.05, 'lap:180,734'], [22.45, 'lap:200,758'],
      [22.9, 'lap:1180,560'], [23.45, 'lap:1220,583'], [23.95, 'lap:1240,606'], [24.35, 'lap:1240,629'],
      [24.75, 'lap:70,75'], [25.1, 'lap:70,205'], [25.5, 'lap:80,283'], [25.9, 'lap:90,309'], [26.3, 'lap:90,335']],
    roll: [0.6, 0.3],
    why: 'Over his shoulder onto the laptop. Focus moves with the words: the terminal ("a terminal window"), Claude\'s chat ("a Claude chat", the reply lands on its tick), the growing file list ("a growing sprawl of Python scripts").' },
  { id: 'S4b', name: 'The pipeline', t0: 26.7, t1: 30.45, mm: [35, 38], f: 4.0,
    from: [0.73, 3.70, 1.31], to: [0.87, 3.64, 1.33], at0: [1.46, 4.54, 1.07], at1: [1.46, 4.54, 1.07],
    focus: [[26.7, 'mon:786,214'], [27.6, 'mon:786,214'], [28.3, 'mon:1090,214'], [28.85, 'mon:1394,214'], [30.45, 'mon:1394,214']], roll: [-0.4, 0.2],
    why: 'Behind him, sliding sideways: his head a soft dark edge, the pipeline on the monitor. DRAFT, REVIEW, SEND light on their pings and the focus walks along with them; the first email goes out on its own.' },
  { id: 'S5a', name: 'Hands off', t0: 30.45, t1: 35.0, mm: [40, 42], f: 2.8,
    from: [1.40, 4.05, 0.87], to: [1.39, 4.08, 0.865], at0: [1.05, 4.38, 0.86], at1: [1.05, 4.39, 0.865],
    focus: [[30.45, HAND], [31.6, HAND], [32.25, 'lap:1240,560'], [35.0, 'lap:1240,560']], roll: [0.3, 0.1],
    why: '"Well..." his hands come off the keys and rest; "technically, Claude is doing the building": focus leaves his idle hand for the screen, where Claude writes the code by itself on the chime.' },
  { id: 'S5', name: 'Keeps saying yes', t0: 35.0, t1: 37.9, mm: [55, 58], f: 8.0,
    from: [1.33, 4.12, 0.93], to: [1.32, 4.13, 0.925], at0: [1.075, 4.31, 0.80], at1: [1.075, 4.31, 0.80], focus: KEYS, roll: [0, 0],
    why: 'Close on his right hand on the keys, looking down over the knuckles. Three yeses, each on its Enter; the screen glow flinches on the hit. Cut to two days ago.' },
];
export const shotAt = (t) => shotIn(SHOTS, t);
export function cameraAt(t, pick) {
  const c = cameraIn(SHOTS, t, pick);
  if (c.shot.lift) c.at.y += c.shot.lift;            // three's y is up
  return c;
}
export const CAPTIONS = [
  [3.0, 7.36, 'It\'s 3 AM, and Ivan hasn\'t eaten since lunch.'],
  [8.06, 12.03, 'There\'s a glass of water on his desk that he poured six hours ago.'],
  [12.93, 14.73, 'It\'s still full.'],
  [15.84, 20.67, 'He\'s hunched over his laptop, typing furiously, eyes bloodshot.'],
  [21.17, 26.24, 'A terminal window, a Claude chat, and a growing sprawl of Python scripts.'],
  [26.84, 29.68, 'He\'s building an email automation system.'],
  [30.58, 34.45, 'Well... technically, Claude is doing the building.'],
  [35.15, 37.27, 'Ivan keeps saying yes.'],
];

// Shots that look at his face from the desk side stand where the north wall is: it is a wild wall, pulled for
// those shots as on a film set. The top shot takes the ceiling off.
// the meniscus: the thin bright line where the water meets the glass, the one detail that says "full"
let MENISCUS = null;
function meniscus(named, scene) {
  const w = named.Water; if (!w || MENISCUS || !scene) return;
  const b = new THREE.Box3().setFromObject(w), c = b.getCenter(new THREE.Vector3());
  MENISCUS = new THREE.Mesh(new THREE.TorusGeometry((b.max.x - b.min.x) / 2 - 0.0003, 0.0003, 6, 128),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.13, 0.16, 0.21) }));
  MENISCUS.rotation.x = Math.PI / 2; MENISCUS.position.set(c.x, b.max.y - 0.0002, c.z); MENISCUS.name = 'Meniscus';
  scene.add(MENISCUS);
}

export function props(t, { named, scene }) {
  meniscus(named, scene);
  // the string lights sat on his head like a halo in the bloodshot reverse: out of frame for that shot only
  const hideFairy = shotAt(t).id === 'S3';
  for (const [k, o] of Object.entries(named)) if (/^Fairy_/.test(k)) o.visible = !hideFairy;
  // decide from where the camera really is (the free camera too): a wall or the ceiling goes only when the camera
  // stands in it or beyond it; anywhere inside the room every wall is there
  const cam = window.__camera ? window.__camera.position : cameraAt(t, () => new THREE.Vector3()).pos;
  const camY = -cam.z, camZ = cam.y;                                    // three -> Blender
  const ceil = named.Baked_CEIL || named.Ceiling, wall = named.Baked_WALLN || named.Wall_N;   // baked or layout export
  if (ceil) ceil.visible = camZ < 2.66;
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

  // table lamp on the nightstand: warm, the "home" light. Baked (soft Cycles shadows, the reference's falloff);
  // live only as a faint unshadowed fill on Ivan when the set is unbaked.
  const lamp = by.Desk_Lamp;
  L.lamp = new THREE.PointLight(new THREE.Color(...lamp.color), baked ? 0 : lamp.energy_w / (4 * Math.PI), 0, 2);
  L.lamp.position.copy(B(...lamp.location));
  scene.add(L.lamp); L.lampBase = L.lamp.intensity;

  // the hazy moon over the valley: baked as a soft wash; live only as a faint cool edge on Ivan (no hard shadows)
  L.moon = new THREE.DirectionalLight(0x9db4ff, baked ? 0.06 : 0.6);
  L.moon.position.copy(B(-8.4, 5.1, 8.0)); L.moon.target.position.copy(B(1.6, 1.6, 0.5));   // set_room03.MOON
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
    // aimed from the screen at his face and chest (lights.json once exported this light pointing at the floor)
    s.position.copy(B(...key.location)); s.lookAt(B(1.05, 3.75, 1.15));
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
    // a soft side key, no shadow map: hands and arms must not print hard shapes on his face (S5)
    L.monitor = new THREE.SpotLight(0x86b8ff, 1.9, 1.9, THREE.MathUtils.degToRad(34), 0.95, 1.5);
    L.monitor.position.copy(B(...mon)); L.monitor.target.position.copy(FACE);
    scene.add(L.monitor, L.monitor.target);
  }
  // what the dark green walls give back: barely anything, a little blue (baked: the environment capture does it)
  // baked: a faint warm fill keeps live-lit things (Ivan, plants, books) from falling to pure black, as in the ref
  // baked: no fill light; the bake's bounce and the environment capture light Ivan and the props (LOOK_REVIEW.md B)
  if (!baked) { L.fill = new THREE.HemisphereLight(0x22305a, 0x0b0806, 0.10); scene.add(L.fill); }
  // baked: the night itself, the third layer. A deep-blue sky from above and a warm floor bounce from below, so
  // shadows land in readable navy and brown, never black (mood_4, look_night: black share under 10%).
  // ?amb=<k> tunes it for look-dev.
  else {
    const k = +(new URLSearchParams(location.search).get('amb') ?? 0.9);
    L.fill = new THREE.HemisphereLight(0x22325a, 0x140e0a, k); scene.add(L.fill);
  }

  L.apply = ({ lamp: lk = 1, screen: sk = 1 } = {}) => {
    L.lamp.intensity = L.lampBase * lk;
    for (const { s, base } of L.screens) s.intensity = base * sk;
    if (L.monitor) L.monitor.intensity = 1.9 * sk;
  };
  return L;
}

// ---------------------------------------------------------------- the set's finish and air (look_night.webp)
const OUTSIDE = /^(Tree_Line|Hill|Ground|Neighbourhood|Street_|Valley_|House_Windows|Facade_Towers|Aviation_|Sky_Card)/;

// Matte electronics (the reference's monitors and laptop read as objects, not mirrors); the city ignores the
// room's haze (it has its own distance in the lens).
export function tweakMaterial(m, o) {
  const n = m.name || '';
  // look-dev: ?nomap=<regex> drops the albedo texture, ?nolm=<regex> the lightmap, to see which one makes a pattern
  const Q = new URLSearchParams(location.search);
  if (Q.get('nomap') && new RegExp(Q.get('nomap')).test(n)) { m.map = null; m.needsUpdate = true; }
  if (Q.get('nolm') && new RegExp(Q.get('nolm')).test(n)) { m.lightMap = null; m.needsUpdate = true; }
  // baked surfaces reflect the room capture only faintly: at 1.0 every matte thing got a grey sheen (the plastic look)
  if (m.lightMap) m.envMapIntensity *= +(Q.get('env') ?? (/Floor/.test(n) ? 0.8 : 0.35));
  if (Q.get('lmonly') && m.lightMap) {             // look-dev: the bake alone, on white matte surfaces
    Object.assign(m, { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, roughness: 1, metalness: 0,
      clearcoat: 0, sheen: 0, envMapIntensity: 0 }); m.color.setRGB(0.5, 0.5, 0.5); m.needsUpdate = true;
  }
  if (/^(Tumbler Glass|Water|Air Bubble)$/.test(n)) return heroGlass(m, n);
  if (OUTSIDE.test(o.name) || /Glass/.test(n)) {
    m.fog = false;
    if (!/Glass/.test(n)) m.envMapIntensity = 0;                  // the room's reflections must not light the valley
    // the tree line and the slope hold a little of the city's glow, so they read as shapes against the lights
    if (/^Tree_Line/.test(o.name)) { m.emissive.setHex(0x050c09); m.emissiveIntensity = 1; }
    if (/^Hill/.test(o.name)) { m.emissive.setHex(0x06090c); m.emissiveIntensity = 1; }
    if (/^Facade_Towers/.test(o.name)) m.emissiveIntensity *= 0.08;   // towers: dark silhouettes, a few lit windows   // sparse lit windows, dark towers (the ref's skyline)
    if (/^Valley_/.test(o.name)) m.emissiveIntensity *= 0.15;
    // the night sky reads brighter than the room's shadows (look_night, mood_4): a lit navy, not a black hole
    if (/^Sky_Card/.test(o.name)) m.emissiveIntensity *= +(new URLSearchParams(location.search).get('sky') ?? 9);
    if (!/Glass/.test(n)) return;
    m.opacity = 0.04;                                              // clean glass: the city, not a grey film
  }
  if (/^ClassicNightstand/.test(n)) { m.color.multiplyScalar(4); m.roughness = Math.max(m.roughness, 0.6); }   // its scan reads 0.6% albedo: black
  else if (/^Trim$/.test(n) && m.normalScale) m.normalScale.multiplyScalar(0.25);   // door and trim: smooth paint, no plank grooves
  else if (/^Desk Walnut$/.test(n)) Object.assign(m, { clearcoat: 0, roughness: m.roughness * 1.3 });   // satin desk, not lacquer
  else if (/Laptop Alu/.test(n)) Object.assign(m, { roughness: 0.55, metalness: 0.6, clearcoat: 0, envMapIntensity: 0.35 });
  else if (/Monitor Black|Bezel|^Keys$|Trackpad/.test(n)) Object.assign(m, { roughness: 0.8, clearcoat: 0, envMapIntensity: 0.2 });
  else if (/^Lamp Shade$/.test(n)) m.emissiveIntensity *= 0.3;     // the shade glows like fabric, it does not blow out to white
  else if (/Screen/.test(n)) Object.assign(m, { clearcoat: 0.12, clearcoatRoughness: 0.5, roughness: 0.6, envMapIntensity: 0.08 });
}

// The full glass, the chapter's one image. It used to fall into the window branch below (opacity 0.04: gone), and
// the water wrote no depth, so the lens blurred it by whatever stood behind. Now the water is real transmission and
// writes depth so focus lands on it; its refraction is frosted (roughness 0.7) because three's transmission samples a
// sharp copy of the room, which inside an in-focus glass read as a picture pasted in the glass. The glass shell writes
// no depth, so the room seen through it stays as soft as the room around it; the glass is a thin clear
// shell drawn over the water (three draws no transmission through transmission) whose walls catch the screens' light
// as a cool fresnel edge, which is what makes a glass read at night.
function heroGlass(m, n) {
  const Q = new URLSearchParams(location.search);
  if (n === 'Air Bubble') { m.opacity = 0.10; return; }           // clinging bubbles: a hint, not glitter
  const water = n === 'Water';
  if (water) {
    Object.assign(m, { transmission: 1, transparent: false, opacity: 1, depthWrite: true, roughness: +(Q.get('wRough') ?? 0.7), metalness: 0,
      ior: 1.33, thickness: 0.07, specularIntensity: 1, clearcoat: 0.4, clearcoatRoughness: 0.02, envMapIntensity: 1.4,
      emissiveIntensity: 0 });
    m.color.set(0xe8f6ff); m.attenuationColor.set(0x7fbfff); m.attenuationDistance = 0.15;
  } else {
    Object.assign(m, { transparent: true, opacity: +(Q.get('glassOp') ?? 0.07), depthWrite: Q.get('glassDepth') === '1', roughness: 0.02, metalness: 0,
      specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.0 });
    m.color.set(0xf4fbff);
  }
  const rimK = +(Q.get('rim') ?? (water ? 0.03 : 0.14));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(0x9cc8ff).multiplyScalar(rimK) };
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
      float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
      gl_FragColor.rgb += uRim * fr;
      ${water ? '' : 'gl_FragColor.a = max(gl_FragColor.a, min(0.5, fr * 0.55));'}`);
  };
  m.customProgramCacheKey = () => `heroGlass${water}${rimK}`;
  m.needsUpdate = true;
}

// Ivan's skin and hair: engine/src/skin.js, shared by every scene he plays in.

function radialTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function linearTexture(stops, w = 16, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const veil = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, opacity, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: true });

// Haze: the dark teal air that lifts the blacks a touch (fog), the glow that hangs around every practical plus the
// lens. All additive, all soft, all in the lens (depth of field blurs them like air).
const SOFT_AIR = false;
export let VOLUME = null;                     // the room's volumetric light (volume.js); times of day retune it
// The room's lightmaps are stored bottom-up relative to the glTF lightmap UVs (lightmap.py writes Blender pixel
// rows), so they are read mirrored in v. Unflipped, every surface sampled another island's light: the stripes, boxes
// and blotches of LESSONS.md. ?lmflip=0 shows the old, wrong sampling.
export function flipV(t) {
  if (!t || t.userData.flippedV) return t;
  t.repeat.set(1, -1); t.offset.set(0, 1); t.updateMatrix(); t.userData.flippedV = true; t.needsUpdate = true;
  return t;
}
export const LM_FLIP = new URLSearchParams(location.search).get('lmflip') !== '0';

export function setup({ scene, data, atmo, LM, L, root, post, renderer }) {
  if (LM && LM_FLIP) for (const t of Object.values(LM)) flipV(t);
  applyLook({ post, root, LM, L, renderer });       // ?look= mood preset (looks.js)
  if (atmo) {
    atmo.beamMesh.visible = false;            // the intro's desk-lamp cone; this lamp is a shaded table lamp
    // the volume (volume.js) is off until it is redone soft (LOOK_REVIEW.md G); dust stays
    if (SOFT_AIR) VOLUME = atmo.add(createVolume({ room: data.room, lamp: data.marks.Lamp_Shade || data.lights[0].location, COMMON }));
  }
  scene.fog = new THREE.FogExp2(0x060a10, 0.045);
  // PCFSoftShadowMap ignores shadow.radius, so the monitor and lamp printed pixel-sharp shadows on his face; PCF
  // honours it (a 50 cm screen at arm's length casts a very soft shadow)
  if (renderer) { renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.needsUpdate = true; }
  if (L && L.monitor) L.monitor.shadow.radius = 9;
  if (L && L.lamp && L.lamp.shadow) L.lamp.shadow.radius = 6;
  // (no glow sprites, no window veil: they drew shapes instead of air; LOOK_REVIEW.md)
}

// the hit on "yes" (36.25): the screen glow flinches, a fraction of a stop, gone in a quarter second
const HIT = 36.25;
export const exposureBoost = (t = 0) => lookExposure() + (t >= HIT ? 0.16 * Math.exp(-(t - HIT) / 0.09) : 0);

// ------------------------------------------------------------------ screens on the VO clock
// The Chapter 1 screens (ch1/screens.js) run on the chapter plan's clock. Two maps put their moments on the sound:
// piecewise linear [scene time, plan time].
const pw = (M) => (t) => {
  if (t <= M[0][0]) return M[0][1] + (t - M[0][0]);
  for (let i = 1; i < M.length; i++) {
    const [a, pa] = M[i - 1], [b, pb] = M[i];
    if (t <= b) return pa + (pb - pa) * (t - a) / (b - a);
  }
  const [a, pa] = M[M.length - 1]; return pa + (t - a);
};
// laptop: the reply streams in on the chat tick (23.94); Claude starts writing code on "technically" so the chime
// (32.50) lands mid-stream; the three y/n prompts are answered on the three Enters (35.70, 36.30, 36.85)
const LAP = pw([[0, 0], [21.17, 20.8], [23.9, 22.75], [26.24, 26.4], [26.84, 27.0], [31.9, 31.4], [34.9, 34.0],
  [35.70, 34.6], [36.30, 35.4], [36.85, 35.9], [37.9, 36.9]]);
// monitor: REVIEW and SEND go live on ping b (28.46); the first automatic email crosses and pops on the send
// confirm (28.84)
const MON = pw([[0, 0], [26.84, 27.0], [28.42, 31.2], [28.84, 31.6], [37.9, 33.4]]);
const PINGS = [[27.76, 2], [28.46, 3], [29.16, 4]];  // DRAFT, REVIEW, SEND (node index on the monitor)
const WAKE = 4.15;                                    // the phone's wake click
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// The laptop at 3 AM keeps its chat panel in dark mode (the cream panel read as half the screen lit; the refs show
// one dark editor). 'difference' with white inverts the panel: dark ground, light text.
export const SCREENS = {
  laptop(g, t, keys = []) {
    const p = LAP(t);
    CH1.laptop(g, p, keys.map(LAP));
    if (p < 34.0) { g.save(); g.globalCompositeOperation = 'difference'; g.fillStyle = '#ffffff'; g.fillRect(990, 26, 610, 974); g.restore(); }
  },
  monitor(g, t) {
    CH1.monitor(g, MON(t));
    // each stage rings on its ping: a bright outline that fades over 0.7 s
    for (const [tp, i] of PINGS) {
      const u = t - tp; if (u < 0 || u > 0.7) continue;
      const a = 1 - smooth(u / 0.7), x = 60 + i * 304;
      g.save(); g.strokeStyle = `rgba(182,255,208,${a})`; g.lineWidth = 6; g.shadowColor = '#7fd3a0'; g.shadowBlur = 28 * a;
      g.beginPath(); g.roundRect(x - 4, 146, 244, 136, 16); g.stroke(); g.restore();
    }
  },
  monitor2(g, t) { CH1.monitor2(g, MON(t)); },
  // dark until the wake click, lit with the night's lock screen, then the screen times out
  phone(g, t) {
    const lit = smooth((t - WAKE) / 0.12) * (1 - smooth((t - 16) / 0.8));
    if (lit <= 0.001) { g.fillStyle = '#000000'; g.fillRect(0, 0, 720, 1560); return; }
    CH1.phone(g, 3.6);
    if (lit < 1) { g.fillStyle = `rgba(0,0,0,${1 - lit})`; g.fillRect(0, 0, 720, 1560); }
  },
};
