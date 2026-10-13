// Scene "__TITLE__" (engine/scenes/__ID__/scene.js), made in the Studio. Same flat, same look, same Ivan as the
// intro; edit the shots below, then give the scene its own performance (IVAN, ACTING) and screens when it needs them.
//   http://localhost:8080/engine/index.html?scene=__ID__
import { B, cameraIn, shotIn } from '../../src/shots.js';

export const FPS = 24;
export const DURATION = 10;
export const VO_OFFSET = 0.0;
export const VOICEOVER = null;            // 'scenes/__ID__/voiceover.wav' once it exists
// export const IVAN = 'scenes/__ID__/ivan.glb';      // until then: the intro's performance
// export const ACTING = 'scenes/__ID__/acting.json';

const FACE = [6.94, 2.72, 1.12];

// A shot: one camera move. from/to = camera positions (Blender metres: x, y, z up), at0/at1 = what it looks at,
// mm = lens at start/end, f = f-stop, focus = 'eyes', a point, 'lap:x,y' or 'mon:x,y' (a pixel on a screen).
export const SHOTS = [
  { id: '1', name: 'Wide', t0: 0, t1: 5, mm: [24, 26], f: 2.8,
    from: [9.60, 4.30, 1.90], to: [9.40, 4.15, 1.85], at0: [7.0, 3.0, 1.0], at1: [7.0, 3.0, 1.0], focus: 'eyes', roll: [-0.5, -0.3],
    why: 'From the window corner: the flat, and Ivan at his desk.' },
  { id: '2', name: 'Close', t0: 5, t1: 10, mm: [50, 55], f: 2.0,
    from: [7.05, 3.66, 1.24], to: [7.06, 3.60, 1.24], at0: FACE, at1: FACE, track: 0.6, focus: 'eyes', roll: [0.3, 0.1],
    why: 'His face in the screen light.' },
];
export const shotAt = (t) => shotIn(SHOTS, t);
export const cameraAt = (t, pick) => cameraIn(SHOTS, t, pick);

export const CAPTIONS = [
  [0.5, 4.5, 'First line of the script.'],
  [5.5, 9.5, 'Second line.'],
];
