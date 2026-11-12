// Live mode: first-person walk-around with an idle "film" attract loop.
import * as THREE from 'three';
import { GI } from '../core/gi.js';
import { ROOM } from '../scene/layout.js';
import { filmState, applyFilmCamera, FILM_LENGTH } from '../render/film.js';
import { LOOK } from '../render/look.js';

export function startGame(api) {
  const { renderer, camera, pipe, resize, ctx, state } = api;
  const startEl = document.getElementById('start'), hint = document.getElementById('hint'), canvas = renderer.domElement;

  // ---- adaptive resolution: hold a steady frame rate on modest GPUs
  let scale = Math.min(1, 1600 / window.innerWidth), lastFit = 0, acc = 0, frames = 0;
  const fit = () => {
    const w = Math.max(320, Math.round(window.innerWidth * scale)), h = Math.max(180, Math.round(window.innerHeight * scale));
    resize(w, h, { msaa: 4 });
  };
  window.addEventListener('resize', fit); fit();

  // ---- player
  const P = { pos: new THREE.Vector3(3.95, 0, 3.15), vel: new THREE.Vector3(), yaw: 0.72, pitch: -0.06, eye: 1.62, eyeT: 1.62, bob: 0 };
  const keys = new Set();
  let mode = 'attract', filmT = 0;
  const R = 0.2;
  const blocked = (x, z) => {
    if (x < R + 0.02 || x > ROOM.W - R - 0.02 || z < R + 0.05 || z > ROOM.D - R - 0.02) return true;
    for (const c of ctx.colliders) {
      if (c.max[1] < 0.25 || c.min[1] > P.eye) continue;
      if (x > c.min[0] - R && x < c.max[0] + R && z > c.min[2] - R && z < c.max[2] + R) return true;
    }
    return false;
  };
  if (blocked(P.pos.x, P.pos.z)) P.pos.set(3.0, 0, 3.0);

  const lock = () => canvas.requestPointerLock && canvas.requestPointerLock();
  startEl.style.display = 'grid';
  // Sound: recorded dawn birdsong + leaves (heard through the closed window) and a quiet piano piece.
  // Sources and licences: see CREDITS.md. Nothing is synthesised.
  const base = import.meta.env.BASE_URL || './';
  const amb = new Audio(base + 'audio/ambience.m4a'), mus = new Audio(base + 'audio/music.m4a');
  amb.loop = true; mus.loop = true; amb.volume = 0.85; mus.volume = 0.5;
  const playAudio = () => { amb.play().catch(() => {}); mus.play().catch(() => {}); };
  startEl.addEventListener('click', () => { lock(); playAudio(); });
  canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas) lock(); });
  document.addEventListener('pointerlockchange', () => {
    const on = document.pointerLockElement === canvas;
    if (on) { mode = 'walk'; startEl.style.display = 'none'; hint.style.opacity = 0.75; setTimeout(() => (hint.style.opacity = 0), 6000); pipe.look.fade = 1; }
    else if (mode === 'walk') { startEl.style.display = 'grid'; }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas || mode !== 'walk') return;
    P.yaw -= e.movementX * 0.0019; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * 0.0019));
  });
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyC') { mode = mode === 'film' ? 'walk' : 'film'; filmT = 0; pipe.look.fade = 1; }
    if (e.code === 'KeyH') hint.style.opacity = hint.style.opacity > 0 ? 0 : 0.75;
    if (e.code === 'KeyM') { amb.muted = !amb.muted; mus.muted = amb.muted; }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(0.05, clock.getDelta());
    GI.uniforms.uTime.value += dt;
    for (const fn of ctx.animated) fn(GI.uniforms.uTime.value);

    if (mode === 'walk') {
      fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
      wish.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(fwd);
      if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(fwd);
      if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(right);
      const crouch = keys.has('ControlLeft') || keys.has('KeyQ');
      const speed = (keys.has('ShiftLeft') ? 0.7 : 1.5) * (crouch ? 0.6 : 1);
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
      P.vel.lerp(wish, 1 - Math.exp(-dt * 9));
      const nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
      if (!blocked(nx, P.pos.z)) P.pos.x = nx; else P.vel.x = 0;
      if (!blocked(P.pos.x, nz)) P.pos.z = nz; else P.vel.z = 0;
      P.eyeT = crouch ? 0.98 : 1.62; P.eye += (P.eyeT - P.eye) * (1 - Math.exp(-dt * 7));
      const sp = Math.hypot(P.vel.x, P.vel.z); P.bob += sp * dt * 6.2;
      camera.position.set(P.pos.x, P.eye + Math.sin(P.bob) * 0.011 * Math.min(1, sp), P.pos.z);
      camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
      camera.fov = 62; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    } else {
      filmT = (filmT + dt) % FILM_LENGTH;
      applyFilmCamera(api, filmState(filmT));
    }

    if (mode === 'walk') {
      camera.getWorldDirection(fwd); wish.set(1.5, 1.55, -0.2).sub(camera.position).normalize();
      const see = Math.max(0, Math.min(1, (fwd.dot(wish) - 0.15) / 0.65)), want = LOOK.exposure * (1.5 - 0.5 * see * see * (3 - 2 * see));
      pipe.look.exposure += (want - pipe.look.exposure) * (1 - Math.exp(-dt * 1.6));
    }
    renderer.info.reset();
    pipe.render();

    // adapt resolution once a second
    acc += dt; frames++;
    if (acc > 1) {
      const ms = (acc / frames) * 1000; acc = 0; frames = 0;
      const now = performance.now();
      if (now - lastFit > 1500) {
        if (ms > 24 && scale > 0.5) { scale = Math.max(0.5, scale * 0.88); lastFit = now; fit(); }
        else if (ms < 12.5 && scale < 1) { scale = Math.min(1, scale * 1.08); lastFit = now; fit(); }
      }
    }
    requestAnimationFrame(loop);
  };
  loop();
}
