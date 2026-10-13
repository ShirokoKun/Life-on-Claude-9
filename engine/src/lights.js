// Live lights. Only the lights that must move or cast shadows from Ivan are live; everything else
// (city glow, sodium lamps, string lights, bathroom spill, monitor glow, all bounce) lives in the
// Cycles lightmaps. Values are converted from Blender's physical units, so both agree:
//   spot/point:  W -> candela-like intensity  I = W / (4 pi)    (three: irradiance = I / d^2)
//   area:        W -> radiance                L = W / (pi A)
// With 2 shadowed lights + 2 area lights + 1 rim we stay far below the per-material light limits.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { B } from './shots.js';

RectAreaLightUniformsLib.init();
const v3 = (a) => B(a[0], a[1], a[2]);
const dir3 = (a) => new THREE.Vector3(a[0], a[2], -a[1]);

export function createLights(scene, data, { quality = 'high' } = {}) {
  const by = Object.fromEntries(data.lights.map((l) => [l.name, l]));
  const L = {};
  const shadowSize = quality === 'high' ? 2048 : 1024;

  // Desk lamp: warm, hard-ish, the one real shadow caster (hands, keyboard, mug, Ivan on the wall)
  const lamp = by.Desk_Lamp;
  L.lamp = new THREE.SpotLight(new THREE.Color(...lamp.color), lamp.energy_w / (4 * Math.PI), 0,
    THREE.MathUtils.degToRad(lamp.spot_deg / 2), lamp.blend, 2);
  L.lamp.position.copy(v3(lamp.location));
  L.lamp.target.position.copy(L.lamp.position.clone().add(dir3(lamp.forward)));
  L.lamp.castShadow = true;
  L.lamp.shadow.mapSize.set(shadowSize, shadowSize);
  L.lamp.shadow.camera.near = 0.05; L.lamp.shadow.camera.far = 6;
  L.lamp.shadow.bias = -0.00012; L.lamp.shadow.normalBias = 0.012; L.lamp.shadow.radius = 3;
  scene.add(L.lamp, L.lamp.target);
  L.lampBase = L.lamp.intensity;

  // Laptop screen as an area light (soft, cool) + a weak shadow-only spot so his hands shadow the keys
  const key = by.Key_Laptop;
  const [w, h] = key.size;
  // x0.45: in Cycles the screen panel shades its own key; the cool light stays a key on his face, not a room fill
  L.screen = new THREE.RectAreaLight(new THREE.Color(...key.color), 0.45 * key.energy_w / (Math.PI * w * h), w, h);
  L.screen.position.copy(v3(key.location));
  L.screen.lookAt(L.screen.position.clone().add(dir3(key.forward)));
  scene.add(L.screen);
  L.screenBase = L.screen.intensity;

  // Ivan only: a cool rim from behind-left (the window side) to separate his hair and shoulders from the
  // dark room. Narrow and weak so it barely touches the baked set.
  L.rim = new THREE.SpotLight(0x8aa6ff, 0.9, 3.2, THREE.MathUtils.degToRad(14), 0.8, 2);
  L.rim.position.copy(B(6.35, 1.95, 1.75));
  L.rim.target.position.copy(B(6.95, 2.72, 1.22));
  scene.add(L.rim, L.rim.target);

  // Monitor kicker on his right cheek (the dashboard light) - no shadows, small.
  const mon = data.marks.Monitor_Screen;
  if (mon) {
    L.monitor = new THREE.RectAreaLight(0x9fc8ff, 1.6, 0.52, 0.30);
    L.monitor.position.copy(v3(mon));
    L.monitor.lookAt(B(6.95, 2.70, 1.15));
    scene.add(L.monitor);
  }
  L.apply = ({ lamp: lk = 1, screen: sk = 1 } = {}) => {
    L.lamp.intensity = L.lampBase * lk;
    L.screen.intensity = L.screenBase * sk;
    if (L.monitor) L.monitor.intensity = 1.6 * sk;
  };
  return L;
}
