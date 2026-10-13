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
    THREE.MathUtils.degToRad(Math.min(lamp.spot_deg, 62) / 2), lamp.blend, 2);   // a pool on the keys, not a flood on his sweater
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
  L.screen = new THREE.RectAreaLight(new THREE.Color(...key.color), 0.22 * key.energy_w / (Math.PI * w * h), w, h);
  L.screen.position.copy(v3(key.location));
  L.screen.lookAt(L.screen.position.clone().add(dir3(key.forward)));
  scene.add(L.screen);
  L.screenBase = L.screen.intensity;

  // The reference split (the kid at the CRT): a saturated blue screen key on the face, warm tungsten behind.
  // Face key: from the laptop, narrow, blue; it throws his shadow onto the wall behind him.
  const lap = v3(key.location);
  // range 1.05 m: it reaches his face (0.55 m) and fades out before the wall behind him
  L.faceKey = new THREE.SpotLight(0x4a74ff, 0.7, 1.05, THREE.MathUtils.degToRad(24), 0.4, 1.4);
  L.faceKey.position.copy(lap.clone().add(new THREE.Vector3(0, 0.02, 0)));
  L.faceKey.target.position.copy(B(6.94, 2.66, 1.20));
  L.faceKey.castShadow = true; L.faceKey.shadow.mapSize.set(shadowSize, shadowSize);
  L.faceKey.shadow.bias = -0.0002; L.faceKey.shadow.normalBias = 0.015; L.faceKey.shadow.radius = 1.5;
  L.faceKey.shadow.camera.near = 0.1; L.faceKey.shadow.camera.far = 5;
  scene.add(L.faceKey, L.faceKey.target);
  // Warm backlight: the bathroom light he left on, behind his right shoulder. Rims hair, ear and shoulders.
  L.rim = new THREE.SpotLight(0xffcfa0, 1.3, 5, THREE.MathUtils.degToRad(15), 0.75, 2);
  L.rim.position.copy(B(7.75, 1.35, 1.95));
  L.rim.target.position.copy(B(6.93, 2.70, 1.15));
  scene.add(L.rim, L.rim.target);

  // Side key: the dashboard monitor at his right front. One dominant cool source from ~40 degrees carves the
  // face (the references' side keys); the laptop stays a low front fill. Shadows on, range stops at the wall.
  const mon = data.marks.Monitor_Screen;
  if (mon) {
    L.monitor = new THREE.SpotLight(0x86b8ff, 1.9, 1.7, THREE.MathUtils.degToRad(22), 0.5, 1.5);
    L.monitor.position.copy(v3(mon));
    L.monitor.target.position.copy(B(6.94, 2.70, 1.18));
    L.monitor.castShadow = true; L.monitor.shadow.mapSize.set(1024, 1024); L.monitor.shadow.radius = 2;
    L.monitor.shadow.bias = -0.0002; L.monitor.shadow.normalBias = 0.015; L.monitor.shadow.camera.near = 0.1; L.monitor.shadow.camera.far = 3;
    scene.add(L.monitor, L.monitor.target);
  }
  // Warm wall wash behind him (the reference's warm background): grazing from high on his right so the
  // plaster shows its texture, the shelf throws shadows, and the light falls off into the dark corners.
  L.wash = new THREE.SpotLight(0xffaa66, 2.6, 6, THREE.MathUtils.degToRad(30), 0.8, 2);   // a pool, not a fill
  L.wash.position.copy(B(8.55, 2.35, 2.30));
  L.wash.target.position.copy(B(6.55, 1.40, 0.95));
  L.wash.castShadow = true; L.wash.shadow.mapSize.set(1024, 1024); L.wash.shadow.radius = 6;
  L.wash.shadow.bias = -0.0003; L.wash.shadow.normalBias = 0.02;
  scene.add(L.wash, L.wash.target);
  // Sodium streetlight through the east window blinds: warm stripes across the ceiling and walls, the hard
  // light shapes every reference has (blind stripes in the CRT frame, the figure's shadow in the precinct).
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff'; for (let y = 34; y < 222; y += 15) g.fillRect(38, y, 180, 8);      // slats
  g.fillStyle = '#000'; g.fillRect(124, 30, 8, 196); g.filter = 'blur(1.5px)';            // the window mullion
  const blinds = new THREE.CanvasTexture(c); blinds.colorSpace = THREE.SRGBColorSpace;
  L.blinds = new THREE.SpotLight(0xff9a4a, 9, 0, THREE.MathUtils.degToRad(24), 0.25, 2);
  L.blinds.position.copy(B(11.6, 3.35, 0.55));
  L.blinds.target.position.copy(B(7.3, 3.0, 2.55));
  L.blinds.map = blinds; L.blinds.castShadow = true; L.blinds.shadow.mapSize.set(1024, 1024);
  L.blinds.shadow.camera.near = 0.5; L.blinds.shadow.camera.far = 12; L.blinds.shadow.bias = -0.0004;
  scene.add(L.blinds, L.blinds.target);
  // nothing they light moves (except Ivan's slight sway): draw these shadow maps once, not every frame
  for (const l of [L.wash, L.blinds]) { l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; }

  L.apply = ({ lamp: lk = 1, screen: sk = 1 } = {}) => {
    L.lamp.intensity = L.lampBase * lk;
    L.screen.intensity = L.screenBase * sk;
    if (L.monitor) L.monitor.intensity = 1.9 * sk;
    L.faceKey.intensity = 0.7 * sk;
  };
  return L;
}
