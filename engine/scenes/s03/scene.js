// Scene 1, rebuilt in Ivan's new room (scenes/03-ivan-room/PLAN.md, ref/plan_topdown.jpg). Same story, voiceover,
// captions and timing as the intro (engine/src/shots.js); the set is new: a dark green bedroom-study at 3 AM,
// lit by a table lamp, two monitors, the laptop and the night through a three-unit window.
//   http://localhost:8080/engine/index.html?scene=s03
// The room's axes are chosen so the desk faces +y as in the flat: the intro's desk shots, Ivan's performance and
// the screens move over by OFF unchanged. The two wide shots are new, made for this room.
import * as THREE from 'three';
import { createVolume } from '../../src/volume.js';
import { COMMON } from '../../src/atmosphere.js';
import { drawLaptop } from '../../src/screens.js';
import { applyLook, lookExposure } from './looks.js';
export { LOOKS, LOOK_NAME } from './looks.js';
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
export const ENV_AT = [1.3, 2.9, 1.2];
export const DUST = { center: [1.4, 2.8], spread: 1.5 };   // motes through the whole room, thickest in the window light        // reflections are captured from the middle of the room

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
  // reading: a little more depth of field, so focus rolls across the lines instead of cutting them out
  S4: { mm: [52, 56], f: 2.4 },
};
export const SHOTS = INTRO.map((s) => (NEW[s.id] ? { ...moved(s), ...NEW[s.id] } : moved(s)));
export const shotAt = (t) => shotIn(SHOTS, t);
export const cameraAt = (t, pick) => cameraIn(SHOTS, t, pick);
export const CAPTIONS = INTRO_CAPS;

// Shots that look at his face from the desk side stand where the north wall is: it is a wild wall, pulled for
// those shots as on a film set. The top shot takes the ceiling off.
export function props(t, { named }) {
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
  // (no glow sprites, no window veil: they drew shapes instead of air; LOOK_REVIEW.md)
}

// The laptop at 3 AM: the intro's editor, with the chat panel in dark mode (the intro's cream panel read as half the
// screen lit; the refs show one dark editor). 'difference' with white inverts the panel: dark ground, light text.
export const exposureBoost = () => lookExposure();

export const SCREENS = {
  laptop(g, t, keys) {
    drawLaptop(g, t, keys);
    g.save(); g.globalCompositeOperation = 'difference'; g.fillStyle = '#ffffff'; g.fillRect(990, 26, 610, 974); g.restore();
  },
};
