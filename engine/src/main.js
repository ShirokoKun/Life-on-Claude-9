// Life on Claude Nine - the engine. Boot, load, light, shoot. The intro by default; other scenes by ?scene=.
//   ?scene=s02     load engine/scenes/s02/scene.js (shots, times of day, screens, props, performance)
//   ?render=1      headless film capture (window.renderFrame(n), window.__ready)
//   ?cam=px,py,pz,tx,ty,tz,mm,f   fixed camera in Blender coords (look-dev / parity checks)
//   ?q=med         lighter shadows and lens for slower machines
//   ?pq=balanced|fast   Studio preview quality (never applies to ?render=1): lower resolution, ?q=med, and for
//                  fast, textures decoded at 1K. The look (grade, lens, grain) is the same, only softer.
//   ?ivan=0        hide the character
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadEXR } from './exr.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import * as MAT from './materials.js';
import { createLights } from './lights.js';
import { createAtmosphere } from './atmosphere.js';
import { createPost, LOOK } from './post.js';
import { createScreens } from './screens.js';
import * as TOD from './timeofday.js';
import { B } from './shots.js';

const Q = new URLSearchParams(location.search);
const SCENE = Q.get('scene') || 'intro';
const SC = SCENE === 'intro' ? await import('./shots.js') : await import(`../scenes/${SCENE}/scene.js`);
const { FPS, DURATION, VO_OFFSET, SHOTS, CAPTIONS, cameraAt, shotAt } = SC;
const RENDER = Q.get('render') === '1';
const PREVIEW = RENDER ? null : { balanced: { scale: 0.75 }, fast: { scale: 0.5, tex: 1024 } }[Q.get('pq')] || null;
const QUALITY = Q.get('q') || (PREVIEW ? 'med' : 'high');
const $ = (id) => document.getElementById(id);
if (RENDER) document.body.classList.add('render');

// ---------------------------------------------------------------- renderer
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: RENDER, powerPreference: 'high-performance' });
renderer.setPixelRatio(RENDER ? 1 : Math.min(devicePixelRatio, 1.5) * (PREVIEW ? PREVIEW.scale : 1));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
MAT.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
if (PREVIEW && PREVIEW.tex) MAT.setTextureSize(PREVIEW.tex);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.03, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; controls.enableDamping = true;
const stats = new Stats(); if (!RENDER) { stats.dom.style.cssText = 'position:absolute;left:8px;bottom:8px;opacity:.6'; stage.appendChild(stats.dom); }

// ---------------------------------------------------------------- load
const status = (t) => { $('status').textContent = t; };
// THREE's LoadingManager keeps its isLoading flag private, so count the loads in flight ourselves
// (materials.js fires texture loads without awaiting them; boot waits for the count to reach zero)
const loads = { n: 0, idle: [] };
{
  const M = THREE.DefaultLoadingManager, start = M.itemStart, end = M.itemEnd;   // errors also end with itemEnd
  M.itemStart = (url) => { loads.n++; start(url); };
  M.itemEnd = (url) => { end(url); if (--loads.n === 0) loads.idle.splice(0).forEach((f) => f()); };
}
const gltf = new GLTFLoader();
const loadGLB = (url) => new Promise((res, rej) => gltf.load(url, res, undefined, rej));

const named = {};
let mixer, L, atmo, post, screens, exposureEV = 0;
let tod = null;                 // times of day (scenes that declare light(t))
let roomRoot = null;
const ivan = { head: null, root: null };
const cast = [];                // scene-specific extra performances: { url, t0, t1, root, head, mixer }

async function boot() {
  status('Loading the flat...');
  await MAT.loadManifest();
  // a scene with its own set (SC.ROOM: a folder with room.glb, lights.json, lightmaps/) loads it instead of the flat;
  // its lightmaps are optional while the set is a grey-box (unbaked groups render with live light only)
  const ROOM = SC.ROOM || 'assets';
  const lm = (g) => (SC.ROOM ? loadEXR(`${ROOM}/lightmaps/lm_${g}.exr`).catch(() => null) : loadEXR(`${ROOM}/lightmaps/lm_${g}.exr`));
  const data = await (await fetch(`${ROOM}/lights.json`)).json();
  exposureEV = data.exposure || 0;
  const GROUPS = data.groups || ['ARCH', 'DESK', 'ROOM'];        // a set may bake more groups (lights.json)
  const [room, ...maps] = await Promise.all([loadGLB(`${ROOM}/room.glb`), ...GROUPS.map(lm)]);
  const LM = Object.fromEntries(GROUPS.map((g, i) => [g, maps[i]]));
  for (const t of Object.values(LM)) if (t) { t.channel = 1; t.flipY = false; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; }

  status('Dressing the set...');
  const jobs = [];
  room.scene.traverse((o) => {
    named[o.name] = o;
    if (!o.isMesh) return;
    let g = null; for (let p = o; p; p = p.parent) { const m = /^Baked_([A-Z]+)/.exec(p.name); if (m && m[1] in LM) { g = m[1]; break; } }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const dbg = Q.get('debug');
    if (dbg === 'lm') { o.material = g ? new THREE.MeshBasicMaterial({ map: LM[g], name: 'lm' }) : new THREE.MeshBasicMaterial({ color: 0x220000 }); return; }
    jobs.push(Promise.all(mats.map((m) => MAT.build(m.name, m, g ? LM[g] : null))).then((built) => {
      if (SC.tweakMaterial) built.forEach((m) => SC.tweakMaterial(m, o));   // a set's own finish (gloss, fog)
      o.material = Array.isArray(o.material) ? built : built[0];
      const n = (Array.isArray(o.material) ? o.material[0] : o.material).name || '';
      o.castShadow = !/Glass|Curtain|Bubble|Water|Screen|Facade|Lot Line/.test(n);
      o.receiveShadow = true;
      if (n === 'Water' || n === 'Air Bubble') o.renderOrder = 1;   // inside the glass: drawn before it
      if (n === 'Tumbler Glass') o.renderOrder = 2;
    }));
  });
  await Promise.all(jobs);
  scene.add(room.scene);
  if (!SC.ROOM) {                  // fixes for the flat's own export
    // The monitor body was baked into a group, so its children (screen, stickies) lost their parent and sit at
    // the origin. Put them back: monitor body at (7.36, 3.32, 0.88), tilted -4°, turned -28° toward Ivan.
    const C = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);   // Blender -> three axes
    const D = Math.PI / 180;
    const body = new THREE.Matrix4().compose(new THREE.Vector3(7.36, 3.32, 0.88),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-4 * D, 0, -28 * D, 'ZYX')), new THREE.Vector3(1, 1, 1));
    const toWorld = C.clone().multiply(body).multiply(C.clone().invert());
    for (const [n, o] of Object.entries(named)) {
      if (!/^Monitor_(Screen|Sticky)/.test(n)) continue;
      o.updateWorldMatrix(true, false);
      if (new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).length() < 0.5) o.applyMatrix4(toWorld);
    }
    // the two sticky notes on the monitor's corner baked black (the screen was dark in the bake) and cover the dashboard
    room.scene.traverse((o) => {
      if (o.isMesh && /^Sticky (Yellow|Pink)$/.test(o.material.name || '')) {
        const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
        if (p.distanceTo(B(7.17, 3.42, 1.19)) < 0.12) o.visible = false;
      }
    });
  }

  if (Q.get('ivan') !== '0' && SC.IVAN !== null) {   // IVAN = null: a set with nobody in it yet
    status('Seating Ivan...');
    const iv = await loadCast(Q.get('ivanglb') || SC.IVAN || 'assets/ivan.glb');   // ?ivanglb=: try a performance
    Object.assign(ivan, { head: iv.head, root: iv.root }); mixer = iv.mixer;
    for (const c of SC.CAST || []) cast.push({ ...c, ...(await loadCast(c.url)) });   // other Ivans (standing, ...)
  }

  L = (SC.createLights || createLights)(scene, data, { quality: QUALITY });   // a set brings its own live rig
  const lampShade = data.lights.find((l) => l.name === 'Desk_Lamp');
  const lampPos = B(...lampShade.location);
  atmo = createAtmosphere({ lamp: lampPos, lampTarget: lampPos.clone().add(new THREE.Vector3(lampShade.forward[0], lampShade.forward[2], -lampShade.forward[1]).multiplyScalar(0.55)),
    screen: B(...(data.marks.Laptop_Screen || [6.95, 3.22, 0.87])), count: QUALITY === 'high' ? 900 : 500,
    ...(SC.DUST ? { center: SC.DUST.center, spread: SC.DUST.spread } : {}) });   // a set's own air
  post = createPost(renderer, scene, camera, atmo);
  roomRoot = room.scene;
  if (SC.setup) await SC.setup({ scene, named, root: room.scene, THREE, camera, renderer, data, L, LM, loadEXR, roomDir: ROOM, atmo });   // a set's air, its times of day
  if (SC.light) {
    status('Loading the other times of day...');
    const sets = await TOD.loadSets(SC.SETS, loadEXR, { LM, exposure: data.exposure || 0 });
    tod = { sets, mixer: TOD.createMixer(renderer, room.scene, sets), day: TOD.createDayRig(scene), env: {}, envOn: null, lamp: 1 };
  }

  status('Waiting for textures...');
  await new Promise((res) => { if (loads.n === 0) res(); else loads.idle.push(res); setTimeout(res, 60000); });
  collectLiving();
  if (tod) {                                   // one environment per time of day: Ivan's ambient follows the light
    for (const n of SC.SETS) { applyTOD({ [n]: 1 }); tod.env[n] = await captureEnvironment(); }
  } else await captureEnvironment();
  screens = await createScreens(room.scene, SC.ACTING || 'assets/acting.json', SC.SCREENS);
  resize();
  if (!$('fx').checked) post.setEnabled(false);
  setTime(0);
  $('status').hidden = true;
  window.__scene = scene; window.__THREE = THREE; window.__post = post; window.__L = L; window.__renderer = renderer; window.__screens = screens; window.__ready = true;
}

// Ivan: Tripo PBR materials made physical, glasses rebuilt, the performance as an animation clip
async function loadCast(url) {
  const iv = await loadGLB(url), out = { root: iv.scene, head: null, mixer: null };
  iv.scene.traverse((o) => {
    if (o.isMesh) {
      const src = o.material, n = src.name || '';
      if (/Glasses Frame/.test(n)) o.material = new THREE.MeshPhysicalMaterial({ color: 0x0b0908, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.1, name: n });
      else if (/Glasses Lens/.test(n)) o.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.06,
        envMapIntensity: 1.6, specularIntensity: 1, depthWrite: false, name: n });
      else {
        // Tripo PBR: colour, roughness (G) and normal maps; a warm sheen gives skin and knit their soft edge glow
        o.material = new THREE.MeshPhysicalMaterial({ map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap || null,
          roughness: src.roughnessMap ? 1.0 : 0.62, metalness: 0, sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xb08a76),
          specularIntensity: 0.5, side: THREE.DoubleSide, name: 'Ivan' });
        if (src.normalMap) o.material.normalScale.set(0.9, 0.9);
        o.material.color.setScalar(0.84);            // off-white stays off-white instead of clipping under the keys
        o.material.envMapIntensity = 0.15;          // key-to-fill ~8:1 like the references: the shadow side falls off
      }
      o.castShadow = !/Lens/.test(o.material.name); o.receiveShadow = true; o.frustumCulled = false;
    }
    if (o.isBone && /Head$/.test(o.name) && !/Top/.test(o.name)) out.head = o;
  });
  if (SC.CAST_OFFSET) iv.scene.position.add(B(...SC.CAST_OFFSET));   // a performance made at the flat's desk, played at this set's
  scene.add(iv.scene);
  if (iv.animations.length) { out.mixer = new THREE.AnimationMixer(iv.scene); out.mixer.clipAction(iv.animations[0]).play(); }
  return out;
}

// Reflections and Ivan's ambient light: the room itself, rendered once into a cube from the desk.
async function captureEnvironment() {
  const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(0.05, 50, crt);
  cube.position.copy(B(...(SC.ENV_AT || [6.95, 2.95, 1.15])));
  const hidden = []; for (const r of [ivan.root, ...cast.map((c) => c.root)]) if (r && r.visible) { r.visible = false; hidden.push(r); }
  renderer.toneMapping = THREE.NoToneMapping;
  cube.update(renderer, scene);
  renderer.toneMapping = THREE.AgXToneMapping;
  hidden.forEach((o) => (o.visible = true));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(crt.texture).texture;
  scene.environmentIntensity = 1.0;
  return scene.environment;
}

// times of day: lightmaps, live rig, exposure, sky, practicals, environment
function applyTOD(w) {
  tod.mixer.set(w);
  TOD.applyRig(L, tod.day, w, { lamp: +$('lampK').value, screen: +$('scrK').value });
  tod.lamp = TOD.weigh(w, 'lamp'); tod.fairy = TOD.weigh(w, 'fairy');
  exposureEV = TOD.exposureFor(tod.sets, w);
  const dayness = TOD.weigh(w, 'sky');
  scene.background.setRGB(0.55 * dayness, 0.66 * dayness, 0.85 * dayness);
  for (const f of living.facades) { f.m.emissiveIntensity = f.base * (1 - dayness); f.m.color.setRGB(0.043 + 0.5 * dayness, 0.047 + 0.52 * dayness, 0.059 + 0.55 * dayness); }
  atmo.setLevels(+$('lampK').value * tod.lamp);
  const dom = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
  if (tod.env[dom] && tod.envOn !== dom) { scene.environment = tod.env[dom]; tod.envOn = dom; }
}

// ---------------------------------------------------------------- picks for focus pulls
const tmpV = new THREE.Vector3();
function pick(what) {
  const on = cast.find((c) => c.root.visible && c.head);
  const head = on ? on.head : ivan.head;
  if (what === 'eyes' && head) {
    head.updateWorldMatrix(true, false);
    return head.getWorldPosition(tmpV.clone()).add(new THREE.Vector3(0, 0.085, -0.085));
  }
  if (what === 'screen') return B(6.98, 3.22, 0.90);
  const m = /^(lap|mon):(\d+),(\d+)$/.exec(what);              // a pixel on a screen: 'lap:420,300'
  if (m && screens) { const p = screens.screenPoint(m[1], +m[2], +m[3]); if (p) return p; }
  return B(6.94, 2.72, 1.18);
}

// ---------------------------------------------------------------- time
let tNow = 0, playing = false, last = performance.now();
const audio = $('vo');
if (audio && SC.VOICEOVER !== undefined) { if (SC.VOICEOVER) audio.src = SC.VOICEOVER; else audio.removeAttribute('src'); }   // a scene's own voiceover
function setTime(t) {
  tNow = Math.max(0, Math.min(DURATION - 1 / FPS, t));
  if (cast.length || SC.ivanVisible) {
    for (const c of cast) { c.root.visible = tNow >= c.t0 && tNow < c.t1; if (c.mixer) c.mixer.setTime(Math.max(0, tNow - c.t0)); }
    if (ivan.root) ivan.root.visible = SC.ivanVisible ? SC.ivanVisible(tNow) : true;
  }
  if (mixer) { mixer.setTime(tNow); scene.updateMatrixWorld(true); }
  const fixed = window.__cam || Q.get('cam');            // window.__cam: set from a script for look-dev
  let c;
  if (fixed) {
    const v = fixed.split(',').map(Number);
    const pos = B(v[0], v[1], v[2]), at = B(v[3], v[4], v[5]);
    const e = pick('eyes'); const fp = e.distanceTo(at) < 0.4 ? e : at;
    c = { pos, at, mm: v[6], f: v[7] || 8, focus: pos.distanceTo(fp), roll: 0, shot: shotAt(tNow) };
  } else c = cameraAt(tNow, pick);
  if (!controls.enabled) {
    // a slow drift of a few millimetres on top of the move: the camera is never perfectly still
    const dr = new THREE.Vector3(Math.sin(tNow * 0.31) * 0.004 + Math.sin(tNow * 0.83 + 1.3) * 0.002,
      Math.sin(tNow * 0.27 + 2.0) * 0.003, Math.sin(tNow * 0.41 + 0.7) * 0.003);
    camera.position.copy(c.pos).add(dr); camera.up.set(0, 1, 0); camera.lookAt(c.at);
    // operator breathing behind the camera: low-frequency, sub-degree
    const a = c.shot.id === 'S2' ? 0.0010 : 0.0022, tt = tNow;
    camera.rotateX(a * (Math.sin(tt * 0.9) * 0.6 + Math.sin(tt * 2.3 + 1) * 0.25));
    camera.rotateY(a * (Math.sin(tt * 0.7 + 2) * 0.6 + Math.sin(tt * 1.9) * 0.2));
    camera.rotateZ(c.roll + a * 0.3 * Math.sin(tt * 0.5));
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(18 / c.mm / camera.aspect)); camera.updateProjectionMatrix();
    post.lens.focus = c.focus; post.lens.fstop = c.f; post.lens.mm = c.mm;
  }
  renderer.toneMappingExposure = Math.pow(2, exposureEV + LOOK.exposure + Number($('exp').value) + (SC.exposureBoost ? SC.exposureBoost(tNow) : 0));
  if (tod) applyTOD(SC.light(tNow));
  life(tNow);
  if (SC.props) SC.props(tNow, { named, root: roomRoot, scene, THREE, ivan: ivan.root });
  if (screens) screens.update(tNow);
  atmo.setTime(SC.atmoTime ? SC.atmoTime(tNow) : tNow);          // a scene can freeze the air
  const fade = Math.min(1, tNow / 0.8, SC.FADE_OUT === false ? 1 : (DURATION - tNow) / 1.2);
  post.film.uniforms.fade.value = Math.max(0, fade);
  post.film.uniforms.time.value = Math.floor(tNow * FPS) % 251;
  const cap = CAPTIONS.find(([a, b]) => tNow >= a && tNow < b);
  $('cap').textContent = cap && $('caps').checked ? cap[2] : '';
  $('slate').textContent = `${c.shot.id} · ${c.shot.name.toUpperCase()} · ${c.mm.toFixed(0)} mm · f/${c.f} · ${tNow.toFixed(2)} s`;
  $('time').value = tNow; $('timeOut').value = tNow.toFixed(1) + ' s';
  document.querySelectorAll('#shotChips button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === c.shot.id)));
}
// Small signs of life, all deterministic in t (frame-exact capture): string lights breathe a little,
// the monitor's backlight flickers, LEDs blink, the lamp hums.
const living = { fairy: [], screens: [], leds: [], facades: [] };
function collectLiving() {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material; if (!m || Array.isArray(m)) return;
    if (/Fairy Bulb/.test(m.name)) living.fairy.push({ m, base: m.emissiveIntensity, ph: o.position.x * 13.1 + o.position.z * 7.7 });
    else if (/Screen/.test(m.name)) living.screens.push({ m, base: m.emissiveIntensity });
    else if (/^LED/.test(m.name)) living.leds.push({ m, base: m.emissiveIntensity, ph: o.position.x * 5.3 });
    else if (/^Facade/.test(m.name) && !living.facades.some((f) => f.m === m)) living.facades.push({ m, base: m.emissiveIntensity });
  });
}
function life(t) {
  const fairyK = tod ? tod.fairy : 1, lampTod = tod ? tod.lamp : 1;
  for (const f of living.fairy) f.m.emissiveIntensity = fairyK * f.base * (0.88 + 0.08 * Math.sin(t * 1.7 + f.ph) + 0.04 * Math.sin(t * 5.3 + f.ph * 2.0));
  for (const s of living.screens) s.m.emissiveIntensity = s.base * (1 + 0.012 * Math.sin(t * 9.0) + 0.008 * Math.sin(t * 23.0));
  for (const l of living.leds) l.m.emissiveIntensity = l.base * ((Math.sin(t * 2.2 + l.ph) > -0.6) ? 1 : 0.15);
  if (L) L.lamp.intensity = L.lampBase * (+$('lampK').value) * lampTod * (1 + 0.006 * Math.sin(t * 50.0) + 0.01 * Math.sin(t * 0.9));
  // the moment it sends: the monitor's light on his face lifts and greens a little, then settles
  if (L && L.monitor && SCENE === 'intro') {
    const k = t > 31.6 ? Math.exp(-(t - 31.6) / 1.6) * Math.min(1, (t - 31.6) / 0.25) : 0;
    L.monitor.intensity = 1.9 * (+$('scrK').value) * (1 + 0.22 * k);
    L.monitor.color.setHex(0x86b8ff).lerp(new THREE.Color(0x9ff0c4), 0.45 * k);
  }
}
function render() { if (controls.enabled) controls.update(); post.composer.render(); stats.update(); }
window.renderFrame = (n) => { setTime(n / FPS); render(); return true; };

function syncAudio() {
  if (!audio || !audio.getAttribute('src')) return;
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
// Studio (studio/): the player embedded in the Studio is driven from the parent page through this
window.studio = {
  seek(t) { exitFree(); setTime(t); syncAudio(); },
  play(on = !playing) { if (on !== playing) $('play').click(); },
  state: () => ({ t: tNow, duration: DURATION, fps: FPS, playing, shot: window.__ready ? shotAt(tNow).id : null, scene: SCENE, ready: !!window.__ready }),
  // the Studio keeps a loaded player alive while you visit other pages: hidden, it stops drawing (and playing)
  active(on) { if (RENDER) return; if (!on) this.play(false); renderer.setAnimationLoop(on ? loop : null); last = performance.now(); },
};
if (Q.get('panel') === '0') document.body.classList.add('collapsed');
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
function loop() {
  const now = performance.now();
  if (playing && window.__ready) { let t = tNow + (now - last) / 1000; if (t >= DURATION - 0.05) { t = 0; } setTime(t); syncAudio(); }
  last = now;
  if (window.__ready) render();
}
if (!RENDER) renderer.setAnimationLoop(loop);

boot().catch((e) => { console.error(e); status('Could not load: ' + e.message); });
