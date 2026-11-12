// The grade: one place for exposure and colour decisions so stills, the game and the film agree.
import * as THREE from 'three';

export const LOOK = {
  exposure: 19,
  ext: 0.21,        // how much of the outside's true brightness the SDR grade shows
  extHdr: 0.55,     // …and the HDR10 grade (brighter window, same room)
  vib: 0.3,
  bloom: 0.08,
  vignette: 0.15,
  grain: 0.012,
  sat: 1.1,
  contrast: 1.02,
  peak: 1000,
  ao: 1.0,
  aoRadius: 0.16,
  shadowTint: [0.9, 0.98, 1.12],
  midTint: [0.97, 1.0, 1.04],
  highTint: [1.0, 1.0, 1.0],
  wb: [0.9, 0.985, 1.14],
};

export function applyLook(pipe, over = {}) {
  const L = { ...LOOK, ...over };
  for (const k of Object.keys(L)) {
    if (Array.isArray(L[k])) pipe.look[k] = new THREE.Color(L[k][0], L[k][1], L[k][2]);
    else pipe.look[k] = L[k];
  }
}
