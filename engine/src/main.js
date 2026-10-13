// Life on Claude Nine - intro scene. Boot, load, light, shoot.
//   ?render=1      headless film capture (window.renderFrame(n), window.__ready)
//   ?cam=px,py,pz,tx,ty,tz,mm,f   fixed camera in Blender coords (look-dev / parity checks)
//   ?q=med         lighter shadows and lens for slower machines
//   ?ivan=0        hide the character
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import * as MAT from './materials.js';
import { createLights } from './lights.js';
import { createAtmosphere } from './atmosphere.js';
import { createPost, LOOK } from './post.js';
import { B, FPS, DURATION, VO_OFFSET, SHOTS, CAPTIONS, cameraAt, shotAt } from './shots.js';

const Q = new URLSearchParams(location.search);
const RENDER = Q.get('render') === '1';
const QUALITY = Q.get('q') || 'high';
const $ = (id) => document.getElementById(id);
if (RENDER) document.body.classList.add('render');

// ---------------------------------------------------------------- renderer
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: RENDER, powerPreference: 'high-performance' });
renderer.setPixelRatio(RENDER ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
MAT.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.03, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; controls.enableDamping = true;
const stats = new Stats(); if (!RENDER) { stats.dom.style.cssText = 'position:absolute;left:8px;bottom:8px;opacity:.6'; stage.appendChild(stats.dom); }

// ---------------------------------------------------------------- load
const status = (t) => { $('status').textContent = t; };
const gltf = new GLTFLoader();
const loadGLB = (url) => new Promise((res, rej) => gltf.load(url, res, undefined, rej));
const loadEXR = (url) => new Promise((res, rej) => new EXRLoader().load(url, res, undefined, rej));

const named = {};
let mixer, L, atmo, post, exposureEV = 0;
const ivan = { head: null, root: null };

async function boot() {
  status('Loading the flat...');
  await MAT.loadManifest();
  const data = await (await fetch('assets/lights.json')).json();
  exposureEV = data.exposure || 0;
  const [room, lmA, lmD, lmR] = await Promise.all([
    loadGLB('assets/room.glb'),
    loadEXR('assets/lightmaps/lm_ARCH.exr'), loadEXR('assets/lightmaps/lm_DESK.exr'), loadEXR('assets/lightmaps/lm_ROOM.exr'),
  ]);
  const LM = { ARCH: lmA, DESK: lmD, ROOM: lmR };
  for (const t of Object.values(LM)) { t.channel = 1; t.flipY = false; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; }

  status('Dressing the set...');
  const jobs = [];
  room.scene.traverse((o) => {
    named[o.name] = o;
    if (!o.isMesh) return;
    let g = null; for (let p = o; p; p = p.parent) { const m = /^Baked_(ARCH|DESK|ROOM)/.exec(p.name); if (m) { g = m[1]; break; } }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const dbg = Q.get('debug');
    if (dbg === 'lm') { o.material = g ? new THREE.MeshBasicMaterial({ map: LM[g], name: 'lm' }) : new THREE.MeshBasicMaterial({ color: 0x220000 }); return; }
    jobs.push(Promise.all(mats.map((m) => MAT.build(m.name, m, g ? LM[g] : null))).then((built) => {
      o.material = Array.isArray(o.material) ? built : built[0];
      const n = (Array.isArray(o.material) ? o.material[0] : o.material).name || '';
      o.castShadow = !/Glass|Curtain|Bubble|Water|Screen|Facade|Lot Line/.test(n);
      o.receiveShadow = true;
    }));
  });
  await Promise.all(jobs);
  scene.add(room.scene);

  if (Q.get('ivan') !== '0') {
    status('Seating Ivan...');
    const iv = await loadGLB('assets/ivan.glb');
    iv.scene.traverse((o) => {
      if (o.isMesh) {
        const src = o.material;
        o.material = new THREE.MeshPhysicalMaterial({ map: src.map, normalMap: src.normalMap, roughness: 0.62, metalness: 0,
          sheen: 0.25, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x9a8c80), specularIntensity: 0.55, side: THREE.DoubleSide, name: 'Ivan' });
        if (src.normalMap) o.material.normalScale.set(0.8, 0.8);
        o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      }
      if (o.isBone && /Head$/.test(o.name) && !/Top/.test(o.name)) ivan.head = o;
    });
    ivan.root = iv.scene;
    scene.add(iv.scene);
    if (iv.animations.length) { mixer = new THREE.AnimationMixer(iv.scene); mixer.clipAction(iv.animations[0]).play(); }
  }

  L = createLights(scene, data, { quality: QUALITY });
  const lampShade = data.lights.find((l) => l.name === 'Desk_Lamp');
  const lampPos = B(...lampShade.location);
  atmo = createAtmosphere({ lamp: lampPos, lampTarget: lampPos.clone().add(new THREE.Vector3(lampShade.forward[0], lampShade.forward[2], -lampShade.forward[1]).multiplyScalar(0.55)),
    screen: B(...(data.marks.Laptop_Screen || [6.95, 3.22, 0.87])), count: QUALITY === 'high' ? 2400 : 1200 });
  post = createPost(renderer, scene, camera, atmo);

  status('Waiting for textures...');
  await new Promise((res) => { if (THREE.DefaultLoadingManager.isLoading === false) res(); THREE.DefaultLoadingManager.onLoad = res; setTimeout(res, 60000); });
  await captureEnvironment();
  resize();
  if (!$('fx').checked) post.setEnabled(false);
  setTime(0);
  $('status').hidden = true;
  window.__scene = scene; window.__THREE = THREE; window.__ready = true;
}

// Reflections and Ivan's ambient light: the room itself, rendered once into a cube from the desk.
async function captureEnvironment() {
  const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(0.05, 50, crt);
  cube.position.copy(B(6.95, 2.95, 1.15));
  const hidden = []; if (ivan.root) { ivan.root.visible = false; hidden.push(ivan.root); }
  renderer.toneMapping = THREE.NoToneMapping;
  cube.update(renderer, scene);
  renderer.toneMapping = THREE.AgXToneMapping;
  hidden.forEach((o) => (o.visible = true));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(crt.texture).texture;
  scene.environmentIntensity = 1.0;
}

// ---------------------------------------------------------------- picks for focus pulls
const tmpV = new THREE.Vector3();
function pick(what) {
  if (what === 'eyes' && ivan.head) {
    ivan.head.updateWorldMatrix(true, false);
    return ivan.head.getWorldPosition(tmpV.clone()).add(new THREE.Vector3(0, 0.085, -0.085));
  }
  if (what === 'screen') return B(6.98, 3.22, 0.90);
  return B(6.94, 2.72, 1.18);
}

// ---------------------------------------------------------------- time
let tNow = 0, playing = false, last = performance.now();
const audio = $('vo');
function setTime(t) {
  tNow = Math.max(0, Math.min(DURATION - 1 / FPS, t));
  if (mixer) { mixer.setTime(tNow); scene.updateMatrixWorld(true); }
  const fixed = Q.get('cam');
  let c;
  if (fixed) {
    const v = fixed.split(',').map(Number);
    const pos = B(v[0], v[1], v[2]), at = B(v[3], v[4], v[5]);
    const e = pick('eyes'); const fp = e.distanceTo(at) < 0.4 ? e : at;
    c = { pos, at, mm: v[6], f: v[7] || 8, focus: pos.distanceTo(fp), roll: 0, shot: shotAt(tNow) };
  } else c = cameraAt(tNow, pick);
  if (!controls.enabled) {
    camera.position.copy(c.pos); camera.up.set(0, 1, 0); camera.lookAt(c.at);
    // operator breathing behind the camera: low-frequency, sub-degree
    const a = c.shot.id === 'S2' ? 0.0010 : 0.0022, tt = tNow;
    camera.rotateX(a * (Math.sin(tt * 0.9) * 0.6 + Math.sin(tt * 2.3 + 1) * 0.25));
    camera.rotateY(a * (Math.sin(tt * 0.7 + 2) * 0.6 + Math.sin(tt * 1.9) * 0.2));
    camera.rotateZ(c.roll + a * 0.3 * Math.sin(tt * 0.5));
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(18 / c.mm / camera.aspect)); camera.updateProjectionMatrix();
    post.lens.focus = c.focus; post.lens.fstop = c.f; post.lens.mm = c.mm;
  }
  renderer.toneMappingExposure = Math.pow(2, exposureEV + LOOK.exposure + Number($('exp').value));
  atmo.setTime(tNow);
  const fade = Math.min(1, tNow / 0.8, (DURATION - tNow) / 1.2);
  post.film.uniforms.fade.value = Math.max(0, fade);
  post.film.uniforms.time.value = Math.floor(tNow * FPS) % 251;
  const cap = CAPTIONS.find(([a, b]) => tNow >= a && tNow < b);
  $('cap').textContent = cap && $('caps').checked ? cap[2] : '';
  $('slate').textContent = `${c.shot.id} · ${c.shot.name.toUpperCase()} · ${c.mm.toFixed(0)} mm · f/${c.f} · ${tNow.toFixed(2)} s`;
  $('time').value = tNow; $('timeOut').value = tNow.toFixed(1) + ' s';
  document.querySelectorAll('#shotChips button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === c.shot.id)));
}
function render() { if (controls.enabled) controls.update(); post.composer.render(); stats.update(); }
window.renderFrame = (n) => { setTime(n / FPS); render(); return true; };

function syncAudio() {
  if (!audio) return;
  const at = tNow - VO_OFFSET;
  if (!playing || at < 0 || at > audio.duration) { if (!audio.paused) audio.pause(); return; }
  if (Math.abs(audio.currentTime - at) > 0.08) audio.currentTime = at;
  if (audio.paused) audio.play().catch(() => {});
}

// ---------------------------------------------------------------- UI
SHOTS.forEach((s) => {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.id = s.id; b.textContent = `${s.id} ${s.name}`; b.title = s.why;
  b.addEventListener('click', () => { exitFree(); setTime(s.t0 + 0.01); syncAudio(); });
  $('shotChips').appendChild(b);
});
function exitFree() { controls.enabled = false; $('free').setAttribute('aria-pressed', 'false'); }
$('free').addEventListener('click', () => {
  controls.enabled = !controls.enabled; $('free').setAttribute('aria-pressed', String(controls.enabled));
  if (controls.enabled) { controls.target.copy(cameraAt(tNow, pick).at); post.lens.fstop = 64; } else setTime(tNow);
});
$('play').addEventListener('click', () => { playing = !playing; $('play').textContent = playing ? '❚❚ Pause' : '▶ Play'; last = performance.now(); syncAudio(); });
$('time').addEventListener('input', () => { setTime(+$('time').value); syncAudio(); });
$('fx').addEventListener('change', () => post.setEnabled($('fx').checked));
$('caps').addEventListener('change', () => setTime(tNow));
['exp', 'lampK', 'scrK'].forEach((id) => $(id).addEventListener('input', () => {
  L.apply({ lamp: +$('lampK').value, screen: +$('scrK').value }); atmo.setLevels(+$('lampK').value); setTime(tNow);
}));
if (Q.get('caps') === '1') $('caps').checked = true;
if (Q.get('fx') === '0') { $('fx').checked = false; }
if (RENDER) $('caps').checked = Q.get('caps') === '1';

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (post) post.setSize(w, h, renderer.getPixelRatio());
  if (window.__ready) setTime(tNow);
}
new ResizeObserver(resize).observe(stage);
if (!RENDER) renderer.setAnimationLoop(() => {
  const now = performance.now();
  if (playing && window.__ready) { let t = tNow + (now - last) / 1000; if (t >= DURATION - 0.05) { t = 0; } setTime(t); syncAudio(); }
  last = now;
  if (window.__ready) render();
});

boot().catch((e) => { console.error(e); status('Could not load: ' + e.message); });
