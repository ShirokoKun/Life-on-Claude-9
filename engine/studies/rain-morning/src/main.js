import * as THREE from 'three';
import { buildScene } from './scene/index.js';
import { GI, applyBake, placeholderGi, packBake, captureEnv } from './core/gi.js';
import { setMaxAniso } from './core/tex.js';
import { Pipeline } from './render/pipeline.js';
import { CAMS } from './render/cams.js';
import { applyLook } from './render/look.js';

const Q = new URLSearchParams(location.search);
const SHOT = Q.has('shot') || Q.has('bake') || Q.has('film');
if (SHOT) document.body.classList.add('shot');
const msg = (t) => { const e = document.getElementById('loadmsg'); if (e) e.textContent = t; };

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: SHOT });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(1);
renderer.info.autoReset = false;
setMaxAniso(Math.min(16, renderer.capabilities.getMaxAnisotropy()));
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
console.log('[gpu]', gpuName);

const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 400);
const state = { time: 0, quality: Q.get('q') || 'high', ready: false, lens: { aperture: 0, focus: 3 } };

async function boot() {
  const t0 = performance.now();
  const { scene, ctx } = await buildScene((p) => msg('building ' + p + '…'));
  window.__scene = scene; window.__ctx = ctx;
  scene.updateMatrixWorld(true);
  console.log(`[boot] scene built in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

  const pipe = new Pipeline(renderer, scene, camera);
  applyLook(pipe);
  if (ctx.overlay) { pipe.overlay = ctx.overlay; pipe.overlayU = ctx.overlayU; }
  if (Q.has('candle')) ctx.candle.k = +Q.get('candle');
  if (ctx.overlayU) { ctx.overlayU.uSteamLight.value.setRGB(0.55, 0.62, 0.72).multiplyScalar(+(Q.get('steamL') || 0.12)); if (Q.has('steam')) ctx.overlayU.uSteam.value = +Q.get('steam'); if (Q.has('flame')) ctx.overlayU.uFlame.value = +Q.get('flame'); }
  window.__pipe = pipe;

  // ---- baked lighting
  let bakeInfo = null;
  if (Q.has('bake')) {
    placeholderGi(scene);
    const { runBake } = await import('./bake/baker.js');
    const spp = parseInt(Q.get('bake')) || 64, workers = parseInt(Q.get('workers')) || 6;
    const res = await runBake(scene, ctx.bake, { spp, workers, smooth: Q.has('smooth') ? parseInt(Q.get('smooth')) : 1 });
    const buf = packBake(res.list, { spp, secs: res.secs, samples: res.samples, tris: res.tris });
    const out = Q.get('out') || 'public/bake/gi.bin';
    await fetch('/api/save?path=' + encodeURIComponent(out), { method: 'POST', body: buf });
    bakeInfo = { spp, secs: res.secs, samples: res.samples, tris: res.tris, bytes: buf.byteLength };
    console.log('[bake] saved', out, (buf.byteLength / 1e6).toFixed(1) + ' MB');
  } else {
    let ok = false;
    try {
      const r = await fetch((import.meta.env.BASE_URL || './') + 'bake/' + (Q.get('gi') || 'gi.bin'), { cache: 'no-store' });
      if (r.ok) { const res = applyBake(scene, await r.arrayBuffer()); ok = res.ok; console.log('[gi] applied', res.applied, 'stale', res.stale, JSON.stringify(res.meta)); bakeInfo = res; }
    } catch (e) { console.warn(e); }
    if (!ok) { placeholderGi(scene); console.warn('[gi] no bake found — flat placeholder lighting'); }
  }

  // ---- reflections: capture the lit room once (twice so glossy surfaces reflect each other)
  const rb = ctx.roomBox, probe = new THREE.Vector3(2.35, 1.3, 2.0);
  const refreshEnv = () => {
    GI.uniforms.giExt.value = pipe.look.ext;   // reflections should show the window as bright as the grade shows it
    for (let i = 0; i < 2; i++) { const env = captureEnv(renderer, scene, probe, rb.min, rb.max, 256); if (ctx.glass) ctx.glass.uniforms.envMap.value = env; }
    GI.uniforms.giExt.value = 1;
  };
  refreshEnv();

  // ---- sizing
  const resize = (w, h, opts) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    pipe.setSize(w, h, opts);
  };

  const setCam = (c) => {
    const d = typeof c === 'string' ? CAMS[c] : c;
    camera.position.fromArray(d.pos); camera.fov = d.fov || 50; camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3().fromArray(d.target)); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    if (d.focus) state.lens.focus = d.focus; state.lens.aperture = d.aperture || 0;
  };

  // Sub-frame jitter: anti-aliasing, thin-lens depth of field and shutter (time) sampling.
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const basePos = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const makePrep = (t, shutter) => (i, n) => {
    if (i === 0) basePos.copy(camera.position);
    const jx = halton(i + 1, 2) - 0.5, jy = halton(i + 1, 3) - 0.5;
    GI.uniforms.uTime.value = t + shutter * (n > 1 ? (i + 0.5) / n - 0.5 : 0);
    for (const fn of ctx.animated) fn(GI.uniforms.uTime.value);
    camera.position.copy(basePos);
    let lx = 0, ly = 0;
    const ap = state.lens.aperture;
    if (ap > 0) {
      const a = halton(i + 1, 5) * Math.PI * 2, rr = Math.sqrt(halton(i + 1, 7)) * ap;
      lx = Math.cos(a) * rr; ly = Math.sin(a) * rr;
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.position.addScaledVector(right, lx).addScaledVector(up, ly);
    }
    camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
    const m = camera.projectionMatrix.elements;
    m[8] += (2 * jx) / pipe.w - (m[0] * lx) / state.lens.focus;
    m[9] += (2 * jy) / pipe.h - (m[5] * ly) / state.lens.focus;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if (i === n - 1) { /* restored by caller */ }
  };
  const restoreCam = () => { camera.position.copy(basePos); camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); };

  // ---- public API (used by tools/*.mjs through puppeteer, and by the cinematic renderer)
  const api = {
    gpu: gpuName, bakeInfo, CAMS, state, pipe, camera, renderer, scene, ctx, resize, setCam, makePrep, restoreCam, refreshEnv,
    async shot({ cam = 'bed', w = 1280, h = 720, accum = 8, time = 2.0, look = null } = {}) {
      if (look) Object.assign(pipe.look, look);
      resize(w, h, { msaa: 0 }); setCam(cam);
      basePos.copy(camera.position);
      pipe.renderAccum(accum, makePrep(time, 0), 0);
      restoreCam();
      gl.finish();
      return { w, h, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    },
    stats() {
      let meshes = 0, tris = 0, verts = 0;
      scene.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += n * (o.isInstancedMesh ? o.count : 1); verts += g.attributes.position.count; } });
      return { meshes, tris: Math.round(tris), verts };
    },
  };
  window.__api = api;

  if (Q.has('film')) { const { runFilm } = await import('./render/film.js'); window.__film = (o) => runFilm(api, o); }

  if (!SHOT) {
    const { startGame } = await import('./game/game.js');
    startGame(api);
  }
  state.ready = true; window.__ready = true;
  if (bakeInfo && Q.has('bake')) window.__bakeDone = bakeInfo;
  const ld = document.getElementById('loading'); if (ld) { ld.style.opacity = 0; setTimeout(() => ld.remove(), 900); }
  console.log(`[boot] ready in ${((performance.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(api.stats()));
}

boot().catch((e) => { console.error(e); window.__error = String(e && e.stack || e); msg('error: ' + e.message); });
