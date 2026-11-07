// Noor v2: an animated GLB (blender/characters/ps1_noor.py) drawn with the PS1 materials.
// The 12 s loop is played by an AnimationMixer set to the harness clock (deterministic: preview == render).
// The ember and the mouth are sampled over the loop once at load, so the smoke can be born from where the
// cigarette WAS a moment ago (a trail), not where it is now.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ps1Material } from '../lib/ps1.js';

export const LOOP = 12;
const SAMPLES = LOOP * 24;

export async function loadNoor(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material, map = src.map || null;
    if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true; }
    const hair = /hair|brow/i.test(o.name) || /hair|brow/i.test(src.name || '');
    o.material = ps1Material({ map, color: map ? 0xffffff : src.color, side: hair ? THREE.DoubleSide : THREE.FrontSide, alphaTest: hair ? 0.4 : 0 });
    o.frustumCulled = false;
  });
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(gltf.animations[0]); action.play();
  const cig = root.getObjectByName('cigarette');
  const head = root.getObjectByName('Head');
  // sample the ember and the mouth across the loop (in the root's own space)
  const ember = [], mouth = [], v = new THREE.Vector3();
  for (let i = 0; i <= SAMPLES; i++) {
    mixer.setTime(i / 24); root.updateMatrixWorld(true);
    ember.push(root.worldToLocal(cig ? cig.localToWorld(v.set(0, 0.04, 0)).clone() : new THREE.Vector3()));
    mouth.push(root.worldToLocal(head ? head.localToWorld(v.set(0, 0.0, 0.0)).clone().add(new THREE.Vector3(0, -0.05, 0.1)) : new THREE.Vector3()));
  }
  const at = (arr, t) => {
    const u = (((t % LOOP) + LOOP) % LOOP) * 24, i = Math.floor(u), f = u - i;
    return arr[i].clone().lerp(arr[Math.min(i + 1, SAMPLES)], f);
  };
  return {
    root, mixer,
    setTime: (t) => mixer.setTime(((t % LOOP) + LOOP) % LOOP),
    ember: (t) => at(ember, t), mouth: (t) => at(mouth, t),
    dragK: (t) => { t = ((t % LOOP) + LOOP) % LOOP; const s = (x) => Math.min(1, Math.max(0, x)); const sm = (x) => s(x) * s(x) * (3 - 2 * s(x)); return sm((t - 1.9) / 0.6) * (1 - sm((t - 3.7) / 0.7)); },
  };
}
