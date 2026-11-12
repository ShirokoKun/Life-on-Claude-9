// The 45 s film: shot list, camera interpolation and the offline frame exporter.
// Frames are rendered as averaged sub-frames (AA + thin-lens DOF + 180° shutter), graded once to
// HDR10 (PQ / BT.2020, 16-bit) and once to SDR, and streamed to ffmpeg through the dev server.
import * as THREE from 'three';
import { GI } from '../core/gi.js';
import { LOOK } from './look.js';

const V = (a) => new THREE.Vector3().fromArray(a);

// Each shot: dur seconds, keys = camera states along the move. ap = lens aperture radius in mm,
// focus = point the lens is focused on, samples = sub-frames per frame (more for shallow focus).
// Moves run at constant speed so cuts land "in motion".
export const SHOTS = [
  { name: 'wake', dur: 8.5, samples: 48, keys: [
    { pos: [0.92, 0.74, 3.42], target: [1.85, 1.16, 0.0], fov: 44, focus: [1.2, 0.72, 2.6], ap: 9 },
    { pos: [1.02, 0.86, 3.05], target: [1.80, 1.26, 0.0], fov: 44, focus: [1.6, 1.3, 0.0], ap: 7 } ] },
  { name: 'sill', dur: 7.0, samples: 64, exp: 0.62, keys: [
    { pos: [0.78, 1.10, 0.66], target: [1.55, 1.00, -0.05], fov: 34, focus: [1.2, 0.98, -0.03], ap: 9 },
    { pos: [1.28, 1.12, 0.72], target: [1.95, 1.02, -0.08], fov: 34, focus: [1.66, 1.0, -0.05], ap: 9 } ] },
  { name: 'leaves', dur: 5.5, samples: 96, exp: 0.8, keys: [
    { pos: [0.95, 1.72, 1.05], target: [0.35, 1.78, -0.3], fov: 32, focus: [0.3, 1.7, 0.5], ap: 7 },
    { pos: [1.10, 1.60, 1.15], target: [0.55, 1.70, -0.3], fov: 32, focus: [0.9, 1.7, -6.0], ap: 7 } ] },
  { name: 'duvet', dur: 6.0, samples: 64, exp: 1.2, keys: [
    { pos: [1.72, 0.74, 2.32], target: [0.5, 0.62, 2.95], fov: 40, focus: [1.0, 0.66, 2.7], ap: 10 },
    { pos: [1.60, 0.80, 2.95], target: [0.45, 0.62, 3.25], fov: 40, focus: [0.9, 0.66, 3.05], ap: 10 } ] },
  { name: 'macro', dur: 5.5, samples: 64, exp: 1.5, keys: [
    { pos: [3.08, 0.845, 0.64], target: [3.33, 0.748, 0.36], fov: 30, focus: [3.26, 0.75, 0.44], ap: 4 },
    { pos: [3.30, 0.845, 0.62], target: [3.52, 0.748, 0.36], fov: 30, focus: [3.46, 0.75, 0.44], ap: 4 } ] },
  { name: 'desk', dur: 5.0, samples: 48, exp: 1.5, keys: [
    { pos: [2.05, 1.18, 1.75], target: [3.35, 0.95, 0.2], fov: 38, focus: [3.2, 0.9, 0.5], ap: 8 },
    { pos: [2.42, 1.22, 1.90], target: [3.42, 0.97, 0.2], fov: 38, focus: [3.3, 0.9, 0.4], ap: 8 } ] },
  { name: 'room', dur: 7.5, samples: 32, exp: 1.1, keys: [
    { pos: [4.15, 1.42, 3.45], target: [1.55, 1.08, 0.3], fov: 52, focus: [2.0, 1.1, 0.6], ap: 4 },
    { pos: [4.42, 1.50, 3.78], target: [1.45, 1.05, 0.2], fov: 54, focus: [2.0, 1.1, 0.6], ap: 4 } ] },
];
export const FILM_LENGTH = SHOTS.reduce((s, x) => s + x.dur, 0);

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function sampleKeys(keys, u) {
  const n = keys.length - 1, x = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const k = (j) => keys[Math.min(n, Math.max(0, j))];
  const arr = (name) => [0, 1, 2].map((c) => catmull(k(i - 1)[name][c], k(i)[name][c], k(i + 1)[name][c], k(i + 2)[name][c], t));
  const num = (name) => k(i)[name] + (k(i + 1)[name] - k(i)[name]) * t;
  return { pos: arr('pos'), target: arr('target'), focus: arr('focus'), fov: num('fov'), ap: num('ap') };
}

/** Camera state at film time t (seconds). Returns {shot, pos, target, fov, focus, ap, fade}. */
export function filmState(t) {
  let acc = 0;
  for (let s = 0; s < SHOTS.length; s++) {
    const sh = SHOTS[s];
    if (t < acc + sh.dur || s === SHOTS.length - 1) {
      const u = Math.min(1, Math.max(0, (t - acc) / sh.dur));
      const st = sampleKeys(sh.keys, u);
      let fade = 1;
      if (s === 0) fade = Math.min(1, t / 1.6);
      if (s === SHOTS.length - 1) fade = Math.min(fade, Math.max(0, (FILM_LENGTH - t) / 1.8));
      fade = fade * fade * (3 - 2 * fade);
      return { shot: s, name: sh.name, local: t - acc, ...st, fade, exp: sh.exp || 1 };
    }
    acc += sh.dur;
  }
}

export function applyFilmCamera(api, st) {
  const { camera, state } = api;
  camera.position.fromArray(st.pos); camera.fov = st.fov; camera.up.set(0, 1, 0);
  camera.lookAt(V(st.target)); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  // focus distance measured along the view axis
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  state.lens.focus = Math.max(0.15, V(st.focus).sub(camera.position).dot(fwd));
  state.lens.aperture = st.ap / 1000;
  api.pipe.look.fade = st.fade;
  api.pipe.look.exposure = LOOK.exposure * (st.exp || 1);   // the camera opens up for the dim corners
}

let halfLut = null;
function lut() {
  if (halfLut) return halfLut;
  halfLut = new Uint16Array(65536);
  for (let i = 0; i < 65536; i++) { const v = THREE.DataUtils.fromHalfFloat(i); halfLut[i] = Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 65535) : 0; }
  return halfLut;
}

async function post(path, body, timeout = 120000) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), timeout);
  try { const r = await fetch(path, { method: 'POST', body, signal: ac.signal }); if (!r.ok) throw new Error(path + ' -> ' + (await r.text())); return r; }
  finally { clearTimeout(to); }
}
// Frames go up as Blobs: Chrome hands a Blob body to its network process by reference, while a raw
// typed array is copied through a slow path (measured ~9x slower for a 66 MB frame).
async function postFrame(id, seq, arr) {
  const url = `/api/ff/frame?id=${id}&seq=${seq}`;
  try { return await post(url, new Blob([arr])); } catch (e) { /* blob store full or socket hiccup: fall through */ }
  for (let attempt = 0; ; attempt++) {
    if (window.gc) window.gc();
    await new Promise((r) => setTimeout(r, 300));
    try { return await post(url, arr); } catch (e) { if (attempt >= 3) throw e; }   // raw array: slow but has no quota
  }
}

/** Render one continuous run of frames [from, to) of one shot into fast intermediate files
 *  (<out>_<shot>_<from>_hdr.mp4 / _sdr.mp4). The slow final encode happens later in tools/film.mjs.
 *  opts: { shot, from, to, w, h, fps, samples (base, scaled per shot), out, hdr, sdr } */
export async function runFilm(api, opts = {}) {
  const { w = 3840, h = 2160, fps = 30, samples = 16, out = 'out/film', hdr = true, sdr = true, crf = 8, preset = 'ultrafast', pools = 8, perShot = true } = opts;
  const { pipe, renderer } = api;
  api.resize(w, h, { msaa: 0 });
  const L = lut();
  const hdrBuf = hdr ? new Uint16Array(w * h * 4) : null, sdrBuf = sdr ? new Uint8Array(w * h * 4) : null;
  const starts = []; { let a = 0; for (const s of SHOTS) { starts.push(a); a += s.dur; } }
  const si = opts.shot, sh = SHOTS[si], f0 = Math.round(starts[si] * fps), f1 = Math.round((starts[si] + sh.dur) * fps);
  const a = Math.max(f0, opts.from ?? f0), b = Math.min(f1, opts.to ?? f1);
  const tag = String(si + 1).padStart(2, '0') + '_' + sh.name + '_' + String(a).padStart(5, '0');
  const n = perShot && sh.samples ? Math.max(4, Math.round((sh.samples * samples) / 16)) : samples;
  if (hdr) await post('/api/ff/start?id=hdr', JSON.stringify(['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba64le', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-vf', 'vflip,zscale=matrix=2020_ncl:range=limited,format=yuv420p10le', '-c:v', 'libx265', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p10le',
    '-color_primaries', 'bt2020', '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc', '-color_range', 'tv',
    '-x265-params', `pools=${pools}:repeat-headers=1:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:range=limited:log-level=error`, '-tag:v', 'hvc1', `${out}_${tag}_hdr.mp4`]));
  if (sdr) await post('/api/ff/start?id=sdr', JSON.stringify(['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-vf', 'vflip,format=yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '8', '-threads', String(pools), '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', `${out}_${tag}_sdr.mp4`]));
  const t0 = performance.now(), T = { render: 0, convert: 0, send: 0 }; let tm = 0;
  const tick = (k) => { const now = performance.now(); T[k] += now - tm; tm = now; };
  for (let f = a; f < b; f++) {
    const t = f / fps, st = filmState(t + 1e-4);
    applyFilmCamera(api, st); tm = performance.now();
    pipe.renderAccum(n, api.makePrep(t, 0.5 / fps), hdr ? 1 : 2);
    api.restoreCam();
    if (hdr) renderer.readRenderTargetPixels(pipe.rtOut, 0, 0, w, h, hdrBuf);
    if (sdr) renderer.readRenderTargetPixels(hdr ? pipe.present(2) : pipe.rtSdr, 0, 0, w, h, sdrBuf);
    tick('render');
    if (hdr) for (let i = 0, m = hdrBuf.length; i < m; i++) hdrBuf[i] = L[hdrBuf[i]];
    tick('convert');
    await Promise.all([hdr ? postFrame('hdr', f, hdrBuf) : 0, sdr ? postFrame('sdr', f, sdrBuf) : 0]);
    if (window.gc) window.gc();
    tick('send');
    window.__filmProgress = { frame: f, at: Date.now() };
    if ((f - a) % 15 === 0) console.log(`[film] ${tag} frame ${f - a + 1}/${b - a}  ${((performance.now() - t0) / 1000 / (f - a + 1)).toFixed(2)} s/frame`);
  }
  const res = {};
  if (hdr) res.hdr = (await (await post('/api/ff/end?id=hdr', '', 600000)).json()).code;
  if (sdr) res.sdr = (await (await post('/api/ff/end?id=sdr', '', 600000)).json()).code;
  for (const k in T) T[k] = +(T[k] / Math.max(1, b - a) / 1000).toFixed(2);
  api.pipe.look.fade = 1; api.pipe.look.exposure = LOOK.exposure;
  console.log(`[film] ${tag} done: ${b - a} frames, ${n} samples, ${((performance.now() - t0) / 60000).toFixed(1)} min, per frame ${JSON.stringify(T)}`);
  return { tag, frames: b - a, samples: n, stages: T, ...res };
}

/** Frame ranges of every shot, for the driver script. */
export function shotRanges(fps = 30) {
  let a = 0; return SHOTS.map((s, i) => { const r = { shot: i, name: s.name, from: Math.round(a * fps), to: Math.round((a + s.dur) * fps) }; a += s.dur; return r; });
}

/** One film frame as an SDR still on the canvas (for previews). */
export function filmStill(api, t, { w = 1280, h = 720, samples = 16, fps = 30 } = {}) {
  api.resize(w, h, { msaa: 0 });
  applyFilmCamera(api, filmState(t));
  api.pipe.renderAccum(samples, api.makePrep(t, 0.5 / fps), 0);
  api.restoreCam(); api.pipe.look.fade = 1; api.pipe.look.exposure = LOOK.exposure;
}
export { GI };
