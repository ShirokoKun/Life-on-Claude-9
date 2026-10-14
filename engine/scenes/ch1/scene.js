// Chapter 1, "The Binge": the whole chapter as one film (scenes/ch1/CHAPTER1_PLAN.md, WORKFLOW.md).
// Shots, lenses, focus and VO lines come from engine/scenes/ch1/timeline.json, so re-timing to the real voiceover is an
// edit of that file only. The set, Ivan and the night look are scene s03's (Ivan's room). Shots whose set, light
// or performance is not built yet still play, framed in the room, and say so on the slate (the animatic stage).
//   http://localhost:8080/engine/index.html?scene=ch1
import * as THREE from 'three';
import { cameraIn, shotIn } from '../../src/shots.js';
import * as ROOM3 from '../s03/scene.js';

const T = await (await fetch(new URL('./timeline.json', import.meta.url))).json();

export const FPS = T.fps || 24;
export const DURATION = T.duration;
export const VO_OFFSET = 6.0;                         // until the Ch 1 VO arrives: the intro's read covers A01-A09
export const VOICEOVER = 'assets/voiceover.wav';
export const ROOM = ROOM3.ROOM;
export const IVAN = ROOM3.IVAN;
export const ACTING = ROOM3.ACTING;
export const CAST_OFFSET = ROOM3.CAST_OFFSET;
export const ENV_AT = ROOM3.ENV_AT;
export const createLights = ROOM3.createLights;
export const tweakMaterial = ROOM3.tweakMaterial;
export const setup = ROOM3.setup;

const PICKS = /^(eyes|screen|(lap|mon):\d+,\d+)$/;     // focus targets the engine can resolve by name
const focusOf = (f, s) => {
  if (Array.isArray(f) && Array.isArray(f[0])) return f.map(([t, p]) => [t, typeof p === 'string' && !PICKS.test(p) ? s.at0 : p]);
  if (typeof f === 'string') return PICKS.test(f) ? f : s.at0;
  return Array.isArray(f) ? f : s.at0;
};
const mm = (l) => (Array.isArray(l) ? l : [l, l]);

export const SHOTS = T.shots.map((s) => ({
  id: s.id, name: s.status === 'new' ? `${s.name} (to build)` : s.name, t0: s.t0, t1: s.t1,
  mm: mm(s.lens_mm), f: s.fstop || 2.8, from: s.from, to: s.to || s.from, at0: s.at0, at1: s.at1 || s.at0,
  ...(s.atKeys ? { atKeys: s.atKeys } : {}), focus: focusOf(s.focus, s), roll: s.roll || [0, 0],
  top: /ceiling pulled/.test(s.location + s.framing), why: `${s.why} [${s.status}] ${s.action || ''}`,
  status: s.status, light: s.light,
}));
export const shotAt = (t) => shotIn(SHOTS, t);
export const cameraAt = (t, pick) => cameraIn(SHOTS, t, pick);
export const CAPTIONS = (T.vo || []).map((v) => [v.t0, v.t1, v.who && v.who !== 'VO' ? `${v.who}: ${v.text}` : v.text]);

// wild north wall and the pulled ceiling, as in s03
export function props(t, { named }) {
  const s = shotAt(t);
  const camY = cameraAt(t, () => new THREE.Vector3()).pos.z * -1;
  const ceil = named.Baked_CEIL || named.Ceiling, wall = named.Baked_WALLN || named.Wall_N;
  if (ceil) ceil.visible = !s.top;
  if (wall) wall.visible = camY < 4.75;
}
