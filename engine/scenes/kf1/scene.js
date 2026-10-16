// Chapter 1 keyframes, round 5: one composed, lit, posed frame per VO line, held on the real voiceover clock, now
// mapped line by line to the director's storyboard (IVAN vs AI board, 2026-10-15) and its render references
// (scenes/ch1-keyframes/KEYFRAMES.md). Played in the Studio it is the story reel; rendered at each shot's middle it is
// the keyframe board. Each shot is a held still; tr = how we get into it from the shot before (TRANSITIONS in the doc).
//   http://localhost:8080/engine/index.html?scene=kf1
// The set, the look and the live rig are Ivan's room (s03). Ivan's poses are held frames of the existing performances
// (s03 = the 3 AM take, s04 = the flashback take); standing, a hand on a mug or a phone, a lifted head, and the faceted
// look are runtime tools (rig.js, pix.js) that never touch his files. Claude (claude.js), the zone and the balcony
// (stage.js) and the pixel props (props.js) are built in code.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { B, cameraIn, shotIn } from '../../src/shots.js';
import * as ROOM3 from '../s03/scene.js';
import { createRoomLight, weightsFor } from '../s03/roomlight.js';
import { SCREENS as CH1, phoneGlow, sentToasts, outbox } from '../ch1/screens.js';
import { SCREENS as S4 } from '../s04/scene.js';
import { createClaude } from './claude.js';
import { createStage } from './stage.js';
import { GlowPass } from './glow.js';
import { holoTick } from './voxel.js';
import { icon, envelope, codeBlock, pipeIcon, pixelArrow, checkMark, MODULE_ORDER, PIPE_ORDER, lifeUp, LIFE_UPS, reviewIcon, approveIcon, burst, setLine, layerK, setArrow } from './props.js';
import { captureRest, stand, plantFeet, lookUp, reach, grip, handWorld, bones, makeMug, makePhone, begin, end, orientHand, curl, gripPoint, touch, pointIndex, curlAnat, palmFrame } from './rig.js';
import { setPix } from './pix.js';
import { addKeyLegends } from './keys.js';
import { createRoom, roomFrame, roomState } from './room.js';   // round 14 (L5): the room's materials, bed, outside and sun
export { LOOKS, LOOK_NAME } from '../s03/looks.js';

export const FPS = 24;
export const DURATION = 201.64;                // the Ch 1 VO package: 3.0 s pre-roll, 36 beats, 6.0 s tail
export const VO_OFFSET = 0.0;
export const VOICEOVER = 'scenes/kf1/ch01_full_mix.mp3';
export const ROOM = ROOM3.ROOM;
export const IVAN = 'scenes/s03/ivan_eyes.glb';   // with real eyeballs and eye bones (prep_tripo.py --eyes)
export const ACTING = 'scenes/s03/acting.json';
export const CAST_OFFSET = ROOM3.CAST_OFFSET;
export const ENV_AT = ROOM3.ENV_AT;
export const DUST = ROOM3.DUST;
export const createLights = ROOM3.createLights;
export const tweakMaterial = ROOM3.tweakMaterial;
export const FADE_OUT = false;

// marks in the room (Blender metres; x east from the window wall, y north to the desk wall, z up), read from the
// running scene (tools/_probe.mjs), not from the plan
const GLASS = [0.76, 4.33, 0.84];
const WATER = [0.76, 4.33, 0.845];
const PHONE = [1.50, 4.16, 0.758];               // on the desk, right of the mouse (board C r1c2)
const NOTE = [1.12, 4.489, 0.925];
const ISO_CAM = [2.45, 2.70, 2.30], ISO_AT = [1.18, 4.30, 1.02];            // the desk-in-the-void view (ref Group 9)
const BEHIND = [1.05, 2.55, 1.55], BEHIND_AT = [1.05, 4.55, 1.24];          // board B r1c2 / r3c1 from behind
const STAND = [1.04, 3.85];                                                  // his mark when he stands in the zone

// Keyframe fields (beyond the camera): light, iv [take, second], scr (screens' plan clock), s4 (flashback laptop clock),
// cl (Claude), zone (+ zopt), icons, env, card, pipe, glass, note, cyan/green, thin, ghosts, black, top (ceiling off),
// stand, place {at, yaw}, look (head pitch), hand {side, to: 'mouth'|'phone'|[x,y,z], prop}, pix (faceted Ivan),
// refl (lens reflections), cross (window-bar light), board (the storyboard panel), tr (the transition into the shot).
// Round 14 (room.js, day and sunrise only): rays (god-ray strength, 1 = default), dust (sunlit motes), sunK (live sun).
export const SHOTS = [
  { id: 'K01', name: 'Three AM', t0: 0, t1: 3.0, mm: [18, 18], f: 5.6,
    from: [2.10, 3.88, 3.40], to: [2.07, 3.88, 3.32], at0: [0.95, 3.92, 0.60], at1: [0.95, 3.92, 0.60], focus: [1.05, 3.95, 0.90], roll: [0, 0],   // round 14: Ivan in the centre (was: the room centred, him at the edge)
    fadeIn: [0.0, 1.0], light: '3am', iv: ['s03', 0.6, 3.6], scr: 4, top: true, beat: 'pre-roll', board: '(establishing)', tr: 'fade up from black',
    why: 'Pre-roll, room tone. Straight down into his room: the bed he is not in, the lamp, the one lit desk. The first of three top-downs (night, day, dawn).' },
  { id: 'K02', name: 'Hasn’t eaten since lunch', t0: 3.0, t1: 7.8, mm: [85, 85], f: 11,
    from: [1.165, 4.534, 1.049], to: [1.162, 4.524, 1.051], at0: [1.074, 4.194, 1.124], at1: [1.074, 4.194, 1.124], focus: [1.083, 4.216, 1.119], roll: [0, 0],   // round 14: f/11, focus 1 cm in front of the eye: the glasses read sharp with it
    light: '3am', iv: ['s03', 6.0], scr: 6, look: 12, cyan: 0.12, ev: -0.6, beat: 'V01', board: 'r1c1 (B r1c3: the side eye)', tr: 'cut: from the room to the eye',
    why: 'V01 “It’s 3 AM, and Ivan hasn’t eaten since lunch.” Extreme close on his eye in profile through the round glasses, the screen light in it.' },
  { id: 'K03', name: 'Six hours ago', t0: 7.8, t1: 12.7, mm: [28, 28], f: 3.2,
    from: [0.552, 4.453, 0.80], to: [0.52, 4.415, 0.8], at0: [1.32, 3.81, 1.07], at1: [1.288, 3.772, 1.07], focus: GLASS, roll: [0, 0],
    light: '3am', iv: ['s03', 10.2, 15.1], scr: 11, beat: 'V02', board: 'r1c2 (A r1c2)', tr: 'cut',
    why: 'V02 “a glass of water on his desk that he poured six hours ago.” The full glass sharp in front, Ivan typing behind it in blue.' },
  { id: 'K04', name: 'Still full', t0: 12.7, t1: 15.6, mm: [60, 60], f: 4.0,
    from: [0.46, 3.96, 0.93], to: [0.46, 3.96, 0.93], at0: WATER, at1: [0.76, 4.33, 0.845], focus: WATER, roll: [0, 0],
    light: '3am', iv: ['s03', 13.0], scr: 13, cyan: 0.14, beat: 'V03 *', board: 'r1c2', tr: 'cut in (same axis, tighter) on the sub drop',
    why: 'V03 “It’s still full.” The glass alone, the screen glow behind it. The frame stops breathing.' },
  { id: 'K05', name: 'Hunched over his laptop', t0: 15.6, t1: 18.3, mm: [30, 30], f: 2.8,
    from: [1.30, 2.70, 1.58], to: [1.287, 2.805, 1.545], at0: [1.08, 4.45, 1.00], at1: [1.08, 4.45, 1.0], focus: [1.05, 3.95, 1.1], roll: [0, 0],
    leanK: [[15.6, 9], [16.3, 9], [17.7, -3]], lookK: [[15.6, -4, 0], [16.4, -4, 0], [17.6, 8, 0]], light: '3am', iv: ['s03', 16.4, 19.1], scr: 19.8, key: { at: [1.06, 4.42, 1.30], color: 0x9fc8ff, k: 0.5 }, beat: 'V04 a', board: 'r1c3 (B r1c2: from behind)', tr: 'cut: wide, from behind',
    why: 'V04 “He’s hunched over his laptop,” From behind: his back curved into the light of the screens, the dark room around him.' },
  { id: 'K06', name: 'Eyes bloodshot', t0: 18.3, t1: 20.9, mm: [45, 45], f: 2.8,
    from: [1.03, 4.88, 1.06], to: [1.031, 4.86, 1.061], at0: [1.07, 4.20, 1.10], at1: [1.07, 4.2, 1.1], focus: 'eyes', roll: [0, 0],
    lookK: [[18.3, -8, 0], [19.1, -8, 0], [20.8, 8, -14]], gaze: [[18.3, 'screen'], [19.6, 'screen'], [20.6, 'monitor']], light: '3am', iv: ['s03', 10.2, 12.8], scr: 20, look: 14, key: { at: [1.07, 4.45, 0.98], color: 0x9cc8ff, k: 2.4 }, ev: -1.3, dim: 0.5, beat: 'V04 b', board: 'r1c4 (the photo ref; render ref Editing_image)', tr: 'reverse: from the screens back at him',
    why: 'V04 “typing furiously, eyes bloodshot.” His face over the monitor’s edge, cold light from the screen, the bed and the lamp dark behind him.' },
  { id: 'K07', name: 'A terminal, a chat, scripts', t0: 20.9, t1: 26.6, mm: [24, 24], f: 5.6,
    from: [1.40, 4.02, 1.10], to: [1.31, 4.15, 1.05], at0: [1.05, 4.40, 0.86], at1: [1.04, 4.45, 0.90], focus: [1.05, 4.42, 0.88], mv: [20.9, 26.6], roll: [0, 0],
    light: '3am', iv: ['s03', 0.4, 5.6], scr: 24.0, green: 0.1, ev: -0.4, beat: 'V05', board: 'r1c5 (A r1c4, green screen light)', tr: 'cut: from his eyes into the screen (board r1c5: the screen is the frame)',
    why: 'V05 “A terminal window, a Claude chat, and a growing sprawl of Python scripts.” Over his shoulder onto the three things the line names, the screen’s green on everything.' },
  { id: 'K08', name: 'Email automation system', t0: 26.6, t1: 30.3, mm: [35, 35], f: 2.8,
    from: [1.05, 3.70, 1.42], to: [1.058, 3.725, 1.412], at0: [1.40, 4.48, 1.02], at1: [1.40, 4.48, 1.02], focus: 'mon:800,240', roll: [0, 0],   // round 14: the screen is the subject (the pipeline being built reads whole), his head soft in the corner
    light: '3am', hide: ['Baked_DESK_19', 'Baked_DESK_20'], iv: ['s03', 22.4, 25.0], scr: 28.9, label: true, beat: 'V06', board: 'r1c5 (A r2c1, the label)', tr: 'cut: tilt up to the monitor',
    why: 'V06 “He’s building an email automation system.” The monitor’s pipeline going green, the board’s hand-lettered label pointing at it.' },
  { id: 'K09', name: 'Claude is doing the building', t0: 30.3, t1: 34.9, mm: [35, 35], f: 4.0,
    from: [1.584, 4.042, 1.065], to: [1.575, 4.053, 1.058], at0: [1.27, 4.40, 0.82], at1: [1.27, 4.4, 0.82], focus: [1.30, 4.38, 0.82], roll: [0, 0],
    weaveT0: 31.3, light: '3am', iv: ['s03', 31.9], scr: 32.6, beat: 'V07a', board: 'r1c6 (experimental, kept)', tr: 'cut: down to desk level on the chime',
    cl: { at: [1.30, 4.38, 0.75], face: [1.584, 4.042, 1.065], s: 1.3, pose: 'hold', glow: 1.0, lightK: 0.3, born: 30.35 }, blocks: 'build',
    why: 'V07a “Well... technically, Claude is doing the building.” On the desk a small glowing Claude builds: a half-ring wall of code bricks rising round it course by course, a brick lifted over its head, more flying in from the laptop. Ivan, soft behind, only watches the screen.' },
  { id: 'K10', name: 'Ivan keeps saying yes', t0: 34.9, t1: 37.9, mm: [35, 35], f: 2.8,
    from: [0.70, 4.72, 1.08], to: [0.633, 4.676, 1.08], at0: [1.07, 4.16, 1.00], at1: [1.003, 4.116, 1.0], focus: 'eyes', mv: [34.9, 36.25], roll: [0, 0],
    light: '3am', iv: ['s03', 6.2, 9.2], scr: 35.6, green: 0.5, look: 10, beat: 'V07b *', board: 'r1c6', tr: 'cut on the hit (36.25): round to his face in the screen light (board r1c6)',
    cl: { at: [1.70, 4.05, 1.06], face: [0.70, 4.72, 1.08], s: 1.3, mood: 'warm', pose: 'hover', glow: 0.8, lightK: 0.5 },
    why: 'V07b “Ivan keeps saying yes.” His finger on the keys, the y/n prompt above, Claude a warm blur behind, waiting for the next yes.' },

  { id: 'K11', name: 'Two days ago', t0: 37.9, t1: 41.9, mm: [18, 18], f: 5.6,
    from: [2.10, 3.88, 3.40], to: [2.07, 3.88, 3.32], at0: [0.95, 3.92, 0.60], at1: [0.95, 3.92, 0.60], focus: [1.05, 3.95, 0.90], roll: [0, 0],   // round 14: Ivan in the centre (was: the room centred, him at the edge)
    light: 'day', iv: ['s04', 5.1, 8.5], s4: 4.2, glass: false, top: true, beat: 'V08', board: 'r1c7 (flashback)', tr: 'match on K01: the same top-down, the night drains into day',
    why: 'V08 “It started two days ago.” The K01 top-down in afternoon light, no glass poured. Clean: the same room, the same man, two days earlier; the only change is the light.' },
  { id: 'K12', name: '400 unread', t0: 41.9, t1: 46.4, mm: [30, 30], f: 2.0,
    from: [2.10, 3.92, 1.16], to: [2.042, 4.391, 1.16], at0: [1.00, 3.98, 1.20], at1: [1.00, 3.98, 1.20], focus: 'eyes', mv: [45.6, 46.4], ease: 'in', arc: [1.05, 4.03], roll: [0, 0],
    lookK: [[41.9, -16, -15], [46.4, -18, -18]], breath: 0.32, gaze: 'phone', light: 'day', rays: 1.6, iv: ['s04', 14.8], s4: 8.0, glass: false, lean: 10, look: 2, hand: { side: 'R', to: 'phone', prop: 'phone', ph: 44.0 },
    cl: { at: [0.92, 4.30, 1.20], face: [1.05, 4.02, 1.15], s: 1.5, pose: 'hover', glow: 0.7, lightK: 0.4, born: 42.2, exit: 46.1, path: [[42.2, [1.30, 4.28, 1.18]], [43.2, [1.10, 4.55, 1.32]], [44.0, [0.66, 4.12, 1.36]], [44.8, [0.98, 3.70, 1.30]], [45.6, [0.92, 4.30, 1.20]]] }, beat: 'V09 a', board: 'r1c7 (A r2c4 “complaining to claude”)', tr: 'push down from the top-down into him',
    why: 'V09 IVAN “i have like 400 unread emails. every single one wants a reply.” Leaning back in the afternoon light, talking into the phone held up near his face. Claude, small and warm, circles him and drifts round in front of him as he talks (the orbit is animated: it starts behind his shoulder and ends between him and the phone).' },
  { id: 'K13', name: 'Drowning here!', t0: 46.4, t1: 51.01, mm: [40, 40], f: 2.2,
    from: [1.923, 5.472, 1.08], to: [0.82, 5.70, 1.08], at0: [1.06, 4.05, 1.02], at1: [1.06, 4.05, 1.02], focus: 'eyes', mv: [46.4, 47.6], ease: 'out', arc: [1.05, 4.03], roll: [0, 0],
    rise: [46.4], breath: 0.4, lookK: [[46.4, -20, -30], [51.0, -24, -32]], gaze: 'phone', light: 'void', iv: ['s04', 14.8], look: 10, armrest: 'L', hand: { side: 'R', to: 'phone', prop: 'phone', ph: 47.0 }, zone: 'drown', zopt: { head: [1.05, 4.02, 1.15], cam: [0.82, 5.70, 1.08] },
    key: { at: [0.85, 4.80, 1.70], color: 0xffc090, k: 1.4 }, ev: -0.3,
    beat: 'V09 b', board: 'r1c7 (director ref: the man in his chair inside a storm of paper)', tr: 'the room drops away around his chair as the pages rise; out: snap back to the daylit desk (K14)',
    why: 'V09 IVAN “i’m fucking drowning here!” The imagined moment: the room is gone, he sits in his chair in a dark void, hundreds of glowing pages hang around him at every depth, the near ones soft and huge past the lens, a fine snow of specks between them.' },
  { id: 'K14', name: 'Hello, Claude', t0: 51.01, t1: 55.3, mm: [40, 40], f: 2.0,
    from: [1.66, 4.40, 1.22], to: [1.64, 4.37, 1.22], at0: [1.08, 4.23, 1.20], at1: [1.08, 4.23, 1.20], focus: 'iris', roll: [0, 0],
    lookK: [[51.0, -18, -15], [51.9, -18, -15], [53.8, 8, -22]], gaze: [[51.0, 'phone'], [52.0, 'phone'], [52.7, 'claude']], light: 'day', ev: -0.9, iv: ['s04', 14.8], s4: 14.4, glass: false, hand: { side: 'R', to: 'phone', prop: 'phone', ph: 50.0 }, beat: 'V10 a', board: 'r1c8 (A r3c1)', tr: 'cut on the chime (51.01)',
    // round 14 (A2): the voxel character, not the spark: it climbs out of the phone (below the frame) and stops in the lens's
    // focal plane beside his face (0.6 m, the iris distance; at f/2 the plane is ~3 cm deep), turned three-quarters to us
    cl: { at: [1.055, 4.315, 1.205], face: [1.40, 4.30, 1.20], s: 0.85, pose: 'wave', glow: 1.0, lightK: 1.0, born: 51.01, bornDur: 0.6, path: [[51.01, [1.08, 4.39, 1.06]], [52.0, [1.055, 4.315, 1.205]], [55.3, [1.052, 4.322, 1.215]]] },
    why: 'V10 CLAUDE “That sounds genuinely exhausting...” Claude pops out of the phone and waves; its warm light on his face as he looks up at it.' },
  { id: 'K15', name: 'The offer', t0: 55.3, t1: 60.0, mm: [28, 28], f: 2.8, boardAt: 59.7,
    from: [1.28, 3.30, 1.42], to: [1.339, 3.311, 1.42], at0: [1.05, 4.55, 1.28], at1: [1.109, 4.561, 1.28], focus: [1.08, 4.50, 1.34], roll: [0, 0],
    lookK: [[55.3, 6, 12], [59.6, 8, -12]], dimIn: [1.0, 1.0], gaze: [[55.3, [0.70, 4.50, 1.30]], [59.5, [1.40, 4.50, 1.30]]], light: 'day', iv: ['s04', 24.9], s4: 19.5, glass: false, dim: 0.16, ev: -1.7, hide: ['Baked_DESK_8', 'Baked_DESK_9'], pipe: { born: [56.2, 57.0, 58.1, 59.2], state: 'offer', at: [1.08, 4.50, 1.34], bright: 0.85, light: 0.08 }, beat: 'V10 b', board: 'r1c9 (MOTION GRAPHICS)', tr: 'the room dims (not to a void: about a sixth of its light) as the offer builds module by module in the air; the dim carries on into K18 and the V13 void',
    // round 14: no Claude in this keyframe (director: the offer alone, on camera)
    why: 'V10 CLAUDE “I can write a script that sorts your inbox and drafts the replies for you.” The afternoon room dims and the offer assembles above the desk as white outline pixel icons: inbox, sort, draft, you. Ivan reads it from his chair.' },
  // round 14 (B1): K15, K16 and K17 are ONE composition, no cuts. K16 holds K15's frame: the four offer icons flicker
  // off and REVIEW and APPROVE come on in the same place; K17 zooms in on them (flow F5)
  { id: 'K16', name: 'You just review and approve', t0: 60.0, t1: 64.11, mm: [28, 28], f: 2.8,
    from: [1.339, 3.311, 1.42], to: [1.339, 3.311, 1.42], at0: [1.109, 4.561, 1.28], at1: [1.109, 4.561, 1.28], focus: [1.08, 4.50, 1.34], roll: [0, 0],
    lookK: [[60.0, 8, -12], [64.11, 8, -4]], gaze: [[60.0, [1.40, 4.50, 1.30]], [61.2, [1.05, 4.50, 1.30]]], light: 'day', iv: ['s04', 24.9], s4: 23.5, glass: false, dim: 0.16, ev: -1.7, hide: ['Baked_DESK_8', 'Baked_DESK_9'],
    pipe: { born: [56.2, 57.0, 58.1, 59.2], state: 'review', at: [1.08, 4.50, 1.34], off: [60.0, 60.5], review: 60.55, approve: 61.35, bright: 0.85, light: 0.08 }, beat: 'V10 c', board: 'r1c9', tr: 'no cut: the same frame, the offer flickers off and review + approve come on',
    why: 'V10 CLAUDE “You just review and approve. Want me to build one?” The same frame as K15: the four offer icons flicker out, and in their place REVIEW (a page looked over) and APPROVE (a tick stamped on it) light up as he reads.' },
  { id: 'K17', name: 'Review and approve', t0: 64.11, t1: 68.5, mm: [28, 46], f: 2.8,
    from: [1.339, 3.311, 1.42], to: [1.30, 3.47, 1.41], at0: [1.109, 4.561, 1.28], at1: [1.08, 4.50, 1.345], focus: [1.08, 4.50, 1.34], mv: [64.11, 68.5], roll: [0, 0],   // a zoom (28 -> 46 mm) with a little push; the lens stays clear of his head
    lookK: [[64.11, 8, -4]], gaze: [1.05, 4.50, 1.30], light: 'day', iv: ['s04', 24.9], s4: 27.6, glass: false, dim: 0.16, ev: -1.7, hide: ['Baked_DESK_8', 'Baked_DESK_9'],
    pipe: { born: [56.2, 57.0, 58.1, 59.2], state: 'review', at: [1.08, 4.50, 1.34], off: [60.0, 60.5], review: 60.55, approve: 61.35, bright: 0.85, light: 0.08 }, beat: 'V11 *', board: 'r1c9', tr: 'no cut: a slow zoom in to the review and approve icons',
    why: 'V11 “That was the plan. Review and approve.” Still the K15 frame, now closing in on the two icons over his head: that was all he was meant to do.' },

  // round 14: the laptop screen is the frame (from just over his hands, his eye line): 'email sent' toasts stacking
  { id: 'K18', name: 'Once the email system was working', t0: 68.5, t1: 71.2, mm: [35, 35], f: 2.8,
    from: [1.085, 4.12, 1.01], to: [1.081, 4.145, 1.0], at0: [1.075, 4.456, 0.866], at1: [1.075, 4.456, 0.866], focus: 'lap:1130,420', mv: [68.5, 71.2], roll: [0, 0],
    dimIn: [0.0, 0.6], light: 'evening', dim: 0.16, iv: ['s03', 31.9], scr: 71.5, lap: 'toasts', beat: 'V12 a', board: 'r2c1 (B r2c1)', tr: 'dissolve by light: the room sinks to dusk; on the laptop the sends start',
    why: 'V12 “But once the email system was working,” Dusk; the laptop screen fills the frame and "email sent" notifications pop in one after another, faster and faster, each with a tick, who it went to and the subject. A slow push in.' },
  { id: 'K19', name: 'Hands on the keys', t0: 71.2, t1: 72.6, mm: [50, 50], f: 2.0,
    from: [1.06, 4.95, 1.02], to: [1.059, 4.92, 1.019], at0: [1.04, 3.95, 1.00], at1: [1.04, 3.95, 1.0], focus: 'eyes', roll: [0, 0],
    gaze: [[71.2, 'screen'], [71.9, [1.06, 5.6, 1.25]]], light: 'evening', iv: ['s03', 8.0, 9.4], scr: 72, look: 12, beat: 'V12 b', board: 'r2c2 (B r2c2)', tr: 'cut: the pipeline clears, the same axis',
    why: 'V12 “Ivan saw...” Front, both hands spread on the keyboard, mouth a little open: the idea arriving.' },
  { id: 'K20', name: 'What else was possible', t0: 72.6, t1: 74.1, mm: [100, 100], f: 2.0,
    from: [1.06, 4.86, 1.00], to: [1.06, 4.86, 1.0], at0: [1.04, 3.97, 1.10], at1: [1.04, 3.97, 1.1], focus: 'eyes', roll: [0, 0],
    gaze: [1.06, 5.6, 1.25], light: 'evening', iv: ['s03', 9.3], scr: 72.5, look: 12, beat: 'V12 c', board: 'r2c3 + r2c4 (B r2c3/r2c4)', tr: 'cut in: the same axis, onto the eyes',
    why: 'V12 “...what else was possible.” Both eyes through the glasses, close.' },
  { id: 'K21a', name: 'Calendar management', t0: 74.1, t1: 75.9, mm: [28, 28], f: 4.0,
    from: ISO_CAM, to: ISO_CAM, at0: ISO_AT, at1: ISO_AT, focus: [1.10, 4.10, 1.00], flow: 'F2', roll: [0, 0],
    iconsBorn: [74.35, 76.09, 77.83, 79.80], light: '3am', zone: 'iso', iv: ['s03', 0.6, 2.4], scr: 76.0, icons: 1, beat: 'V13a', board: 'r2c5 (B r3c1; render ref Group 9)', tr: 'round 14: cut straight into the void (the room is gone from the first frame)',
    cl: { at: [0.62, 4.62, 1.38], face: ISO_CAM, s: 1.2, pose: 'cheer', born: 74.2 },
    why: 'V13a “Calendar management.” (ping 74.35) High, from behind his right shoulder: Ivan at his desk in a full void, and the first small white outline icon lights in the air above it.' },
  { id: 'K21b', name: 'Meeting scheduling', t0: 75.9, t1: 77.65, mm: [28, 28], f: 4.0,
    from: ISO_CAM, to: ISO_CAM, at0: ISO_AT, at1: ISO_AT, focus: [1.10, 4.10, 1.00], flow: 'F2', roll: [0, 0],
    iconsBorn: [74.35, 76.09, 77.83, 79.80], light: '3am', zone: 'iso', iv: ['s03', 2.4, 4.15], scr: 77.0, icons: 2, beat: 'V13b', board: 'r2c5', tr: 'the same frame: the room is gone',
    cl: { at: [1.12, 4.70, 1.56], face: ISO_CAM, s: 1.2, pose: 'cheer', path: [[75.85, [0.62, 4.62, 1.38]], [76.35, [1.12, 4.70, 1.56]]] },
    why: 'V13b “Meeting scheduling.” (ping 76.09) The room is gone: desk, chair, screens and Ivan in black. A second module.' },
  { id: 'K21c', name: 'Document drafting', t0: 77.65, t1: 79.6, mm: [28, 28], f: 4.0,
    from: ISO_CAM, to: ISO_CAM, at0: ISO_AT, at1: ISO_AT, focus: [1.10, 4.10, 1.00], flow: 'F2', roll: [0, 0],
    iconsBorn: [74.35, 76.09, 77.83, 79.80], light: '3am', zone: 'iso', iv: ['s03', 4.15, 6.1], scr: 78.5, icons: 3, beat: 'V13c', board: 'r2c5', tr: 'the same frame',
    cl: { at: [1.66, 4.66, 1.48], face: ISO_CAM, s: 1.2, pose: 'cheer', path: [[77.6, [1.12, 4.70, 1.56]], [78.1, [1.66, 4.66, 1.48]]] },
    why: 'V13c “Document drafting.” (ping 77.83) Three.' },
  { id: 'K21d', name: 'Research summaries', t0: 79.6, t1: 81.8, mm: [28, 28], f: 4.0,
    from: ISO_CAM, to: ISO_CAM, at0: ISO_AT, at1: ISO_AT, focus: [1.10, 4.10, 1.00], flow: 'F2', roll: [0, 0],
    iconsBorn: [74.35, 76.09, 77.83, 79.80], light: '3am', zone: 'iso', iv: ['s03', 6.1, 8.3], scr: 80.5, icons: 4, beat: 'V13d', board: 'r2c5', tr: 'the same frame',
    cl: { at: [2.10, 4.40, 1.30], face: ISO_CAM, s: 1.2, pose: 'cheer', path: [[79.55, [1.66, 4.66, 1.48]], [80.05, [2.10, 4.40, 1.30]]], exit: 81.5 },
    why: 'V13d “Research summaries.” (ping 79.80) Four modules glowing over a desk floating in black.' },
  // round 14: no ghost Ivans; he types (the s03 typing take), close on his hands and the keys, still in the void
  { id: 'K22', name: 'A few hours of coding', t0: 81.8, t1: 85.2, mm: [32, 32], f: 2.8,
    from: [1.46, 3.94, 1.20], to: [1.43, 3.99, 1.17], at0: [1.05, 4.40, 0.88], at1: [1.05, 4.40, 0.88], focus: [1.05, 4.38, 0.87], roll: [0, 0],
    light: '3am', zone: 'iso', iv: ['s03', 0.4, 5.6], scr: 82, icons: 4, iconsIdle: true, iconIdleK: 0.9, iconsBorn: [74.35, 76.09, 77.83, 79.80], iconScale: 0.3, iconSpots: [[1.146, 4.727, 0.956], [1.22, 4.755, 0.965], [1.173, 4.703, 0.864], [1.247, 4.732, 0.876]], beat: 'V14a', board: 'r2c5', tr: 'cut in: over his right shoulder onto his hands, the same void',
    why: 'V14a “Each one a few hours of coding.” Over his shoulder in the void: his hands typing fast on the laptop, the code scrolling, the four small icons idle above.' },
  { id: 'K23', name: 'Another task gone', t0: 85.2, t1: 89.9, mm: [55, 55], f: 4.0,
    from: [0.90, 4.13, 1.40], to: [0.90, 4.13, 1.40], at0: 'lap:520,420', at1: 'lap:520,420', focus: [1.05, 4.46, 0.94], roll: [0, 0],
    light: '3am', iv: ['s03', 32.0, 33.3], scr: 87.5, beat: 'V14b', board: 'r2c5', tr: 'cut: back in the room, over his shoulder',
    why: 'V14b “Each one removing another task from his daily routine.” Over his shoulder onto TODO.md ticking itself off.' },
  // round 14: K24 rebuilt (director: no grid forming under him, no orbit, not in his room; a frame that says he figured
  // it out). He stands alone in the night void, lit from straight above; the six life-ups fly in out of the dark and
  // snap into their slots on a ring round him, each snap turning the light above him up a step; when the last locks a
  // dotted line runs round and joins them. One slow push in. (The crane into K25, flow F3, is gone: K25 is a cut.)
  { id: 'K24', name: 'A cheat code for life', t0: 89.9, t1: 93.8, mm: [24, 24], f: 2.8,
    from: [2.05, 10.45, 1.15], to: [2.02, 10.10, 1.16], at0: [1.04, 3.85, 1.98], at1: [1.04, 3.85, 1.99], focus: 'eyes', roll: [0, 0], ev: -0.6,
    lifeBorn: [90.4, 90.65, 90.9, 91.15, 91.4, 91.65], light: 'void', iv: ['s03', 8.0], stand: true, look: 24, zone: 'cheat', zopt: { snaps: [90.4, 90.65, 90.9, 91.15, 91.4, 91.65], topK: 0.7, ring: { o: 'h', r: 1.6, z: 3.2, dot: 0.024 }, crown: 1.9 }, lifeScale: 1.9, lifeUps: true,
    beat: 'V15 *', board: 'r2c6 (rebuilt round 14: night void, black to dark violet, stars)', tr: 'cut on the rush: out of the room into the void',
    why: 'V15 “It’s like discovering a cheat code for life.” He has figured it out: alone in a starry violet-black void, lit from above, the six life-ups snapping into a ring round him like a solved puzzle.' },
  { id: 'K25', name: 'Hours into minutes', t0: 93.8, t1: 97.4, mm: [30, 30], f: 3.2,
    from: [1.04, 4.95, 2.85], to: [1.04, 4.918, 2.793], at0: [1.04, 3.90, 0.95], at1: [1.04, 3.9, 0.95], focus: 'eyes', roll: [0, 0],
    light: 'void', iv: ['s03', 8.0], stand: true, look: 40, zone: 'down', beat: 'V16', board: 'r2c7 (B r3c3; render ref Group 6/7)', tr: 'the desk drops away; he is standing in the dark',
    why: 'V16 “Every problem that used to take hours now takes minutes.” From high above, he stands in the dark looking up at us; soft bars of red, orange, peach and cyan drift around him at every depth.' },
  { id: 'K26', name: 'A different frequency', t0: 97.4, t1: 100.9, mm: [28, 28], f: 2.0,
    from: [1.04, 2.85, 1.05], to: [1.04, 2.85, 1.05], at0: [1.04, 8.0, 3.2], at1: [1.04, 8.0, 3.2], focus: [1.04, 3.85, 1.25], flow: 'F4', roll: [0, 0],
    zoneAt: 96.4, light: 'void', iv: ['s03', 8.0], stand: true, look: 18, zone: 'dome', zopt: { tunnel: { straight: [98.6, 101.2] } }, beat: 'V17 a', board: 'r2c8 (B r3c4; render refs Group 5, 10)', tr: 'cut: from above to below and behind',
    why: 'V17 “Ivan feels like he’s vibrating at a different frequency” Low behind him: rings of light streaking around him like a long exposure, teal and orange, his hair edged with light.' },
  { id: 'K27', name: 'Than everyone around him', t0: 100.9, t1: 102.3, mm: [28, 28], f: 2.0,
    from: [1.78, 4.12, 1.02], to: [1.78, 4.12, 1.02], at0: [1.02, 4.00, 1.45], at1: [1.02, 4.00, 1.45], focus: 'eyes', flow: 'F4', roll: [0, 0],
    light: 'void', iv: ['s03', 8.0], stand: true, look: 28, zone: 'dome', zopt: { crowd: true, tunnel: { straight: [98.6, 101.2] } }, beat: 'V17 b', board: 'r2c8 (render ref Group 11)', tr: 'cut: round to his profile',
    why: 'V17 “than everyone around him,” Low profile, looking up into the rings; far off in the dark, grey people walk at normal speed.' },
  // round 14 (B2): K28 is gone; K29 carries the whole of "like he's stepped through a door that others can't even see".
  // An extreme close-up of his eye and glasses: the camera orbits from the right side of his face round to the front
  // (arc about his head), while the reflected lines slide across the lenses left to right (refl.slide)
  { id: 'K29', name: 'A door others can’t see', t0: 102.3, t1: 105.35, mm: [60, 60], f: 4.0,
    from: [1.262, 4.150, 1.372], to: [1.07, 4.262, 1.372], at0: [1.07, 4.015, 1.392], at1: [1.07, 4.015, 1.392], focus: 'eyes', mv: [102.3, 105.15], arc: [1.07, 4.015], roll: [0, 0],
    cutBlack: 105.15, light: 'void', iv: ['s03', 8.0], stand: true, look: 22, zone: 'iso', refl: { kind: 'lines', k: 1.5, tint: 0.1, slide: [[102.3, -0.55], [105.15, 0.55]] }, key: { at: [1.08, 4.50, 1.15], color: 0xff6a35, k: 0.6 }, imag: { k: 1, duo: 0.4, poster: 5, stip: 0.65 }, ev: -0.4, beat: 'V17 c+d', board: 'r2c9 (B r4c1: the eye)', tr: 'cut in to the eye from the rings (K27); cut dead at the vacuum (105.15)',
    why: 'V17 “like he’s stepped through a door that others can’t even see.” Extreme close on his eye through the glasses, the glowing lines reflected in the lenses sliding left to right as the camera comes round from the side of his face to the front. Then the vacuum cut.' },

  { id: 'K30', name: 'He’s barely slept', t0: 105.35, t1: 109.9, mm: [45, 45], f: 4.0,
    from: [1.62, 2.88, 1.42], to: [1.565, 2.856, 1.42], at0: [1.20, 3.84, 1.22], at1: [1.145, 3.816, 1.22], focus: [1.21, 3.82, 1.37], roll: [0, 0],
    fadeIn: [105.65, 0.5], light: 'void', iv: ['s03', 8.0], stand: true, yaw: -100, look: -4, zone: 'balcony', zopt: { spill: 3.0 }, hand: { side: 'L', to: 'mouth', prop: 'mug', sip: [[105.35, 0.0], [107.0, 0.0], [107.9, 1.0], [108.5, 1.0], [109.3, 0.25]] }, pix: false, pixable: true,
    refl: { kind: 'warm', k: 0.8, tint: 0.04 }, beat: 'V18 a', board: 'r3c1 (C r1c1; render ref Group 12)', tr: 'from black (the vacuum): the phone buzz (105.65) brings the night back, outside',
    why: 'V18 “He’s barely slept.” On the balcony at night, mug in hand, the warm light of the flat on his face and the city behind him. He is starting to break into facets.' },
  { id: 'K31', name: 'She stopped texting', t0: 109.9, t1: 112.8, mm: [40, 40], f: 2.8,
    // round 14: no orbit, a straight push in on the phone; its screen sleeps after "stopped texting" (dim at 111.35, black by 111.8)
    from: [1.80, 3.98, 1.02], to: [1.665, 4.063, 0.928], at0: [1.50, 4.16, 0.758], at1: [1.50, 4.16, 0.758], focus: PHONE, mv: [109.9, 112.8], ease: 'lin', roll: [0, 0],
    light: '3am', iv: ['s03', 19.8], scr: 118.2, phoneLit: { sleep: [111.35, 111.8] }, beat: 'V18 b', board: 'r3c2 (C r1c2)', tr: 'cut: inside, the phone on the desk',
    why: 'V18 “His girlfriend stopped texting because he wasn’t responding.” The phone lit on the desk beside the laptop: 3:33, Sarah’s last messages, unanswered. We push in on it; after “stopped texting” the screen dims and goes black.' },
  { id: 'K32', name: 'Responds to everyone else', t0: 112.8, t1: 117.7, mm: [32, 32], f: 2.8,
    // round 14: no Ivan; the laptop alone at work, its Sent box firing replies in step with the envelopes leaving it
    from: [1.44, 3.96, 1.26], to: [1.40, 4.01, 1.24], at0: [0.95, 4.45, 0.98], at1: [0.95, 4.45, 0.98], focus: 'lap:900,420', mv: [112.8, 117.7], roll: [0, 0],
    light: '3am', iv: null, scr: 121, lap: 'outbox', env: 'send', beat: 'V19', board: 'r3c3 (C r1c3)', tr: 'cut: the laptop alone',
    why: 'V19 “Ironic, given that his system now responds to everyone else.” Nobody at the desk: the laptop on its own, its Sent box filling with replies (Sending..., then Sent ✓), one envelope leaving the screen with each.' },
  { id: 'K33', name: 'He knows', t0: 117.7, t1: 121.6, mm: [50, 50], f: 2.8,
    from: [1.54, 3.11, 1.36], to: [1.54, 3.11, 1.36], at0: [1.20, 3.84, 1.32], at1: [1.20, 3.84, 1.32], focus: [1.21, 3.82, 1.37], flow: 'F6', roll: [0, 0],
    light: 'void', iv: ['s03', 8.0], stand: true, yaw: -100, look: 0, zone: 'balcony', zopt: { spill: 3.0 }, hand: { side: 'L', to: 'mouth', prop: 'mug', sip: [[117.7, 1.0], [119.2, 1.0], [121.6, 0.45]] }, pix: false, pixable: true,
    refl: { kind: 'warm', k: 0.8, tint: 0.04 }, beat: 'V20 a', board: 'r3c4 (C r1c4; render ref Group 8)', tr: 'cut: back out on the balcony, close',
    why: 'V20 “He knows this isn’t healthy.” Close, mug at his lips, dark under his eyes, the city in bokeh behind; his face in facets.' },
  { id: 'K34', name: 'A thinness to his thoughts', t0: 121.6, t1: 126.3, mm: [50, 50], f: 2.8,
    from: [1.56, 3.10, 1.36], to: [1.56, 3.10, 1.36], at0: [1.20, 3.84, 1.32], at1: [1.20, 3.84, 1.32], focus: [1.21, 3.82, 1.37], flow: 'F6', roll: [0, 0],
    light: 'void', iv: ['s03', 8.0], stand: true, yaw: -100, look: 0, zone: 'balcony', zopt: { spill: 3.0, trails: [121.75, 125.6] }, hand: { side: 'L', to: 'mouth', prop: 'mug', sip: [[121.6, 0.45], [123.4, 0.25], [126.3, 0.25]] }, pix: false, pixable: true,
    refl: { kind: 'warm', k: 0.8, tint: 0.04 }, beat: 'V20 b', board: 'r3c5 (C r2c1; render ref Group 7 bottom)', tr: 'the same frame: the city stretches into lines',
    why: 'V20 “something fraying at the edges of his mind, a thinness to his thoughts.” The same close; behind him the city’s own lights stretch from discs into long thin trails streaming past (R4). No lines come in from outside (round 14).' },
  { id: 'K35', name: 'Close to something', t0: 126.3, t1: 129.4, mm: [35, 35], f: 2.4,
    from: [0.95, 4.55, 1.38], to: [0.91, 4.50, 1.38], at0: [1.88, 3.30, 1.31], at1: [1.88, 3.30, 1.31], focus: 'iris', roll: [0, 0],
    light: 'void', iv: ['s03', 8.0], stand: true, yaw: -100, look: 0, zone: 'balcony', zopt: { spill: 3.0 }, hand: { side: 'L', to: 'mouth', prop: 'mug', sip: [[126.3, 0.3], [127.4, 1.0], [128.4, 1.0], [129.4, 0.6]] }, pix: false, pixable: true, amber: 0.35,
    refl: { kind: 'warm', k: 0.8, tint: 0.04 }, beat: 'V21', board: 'r3c6 (C r2c2; render ref Group 8 bottom)', tr: 'cut: round behind his left shoulder (ref Group 8 bottom): ear, glasses arm, mug at the lips, the city low',
    why: 'V21 “But he’s close to something.” Behind his shoulder as he drinks, the city lights in bokeh beyond the rail.' },
  // round 14 (B3): K37 is gone; K36 runs to its end. Not the typing shot: close on his mouth at the mug, locked there,
  // one gulp on "One more module" and one on "One more integration", then held through "Then he'll rest"
  { id: 'K36', name: 'One more module', t0: 129.4, t1: 136.9, mm: [70, 85], f: 2.8,
    from: [0.70, 4.13, 1.13], to: [0.78, 4.12, 1.13], at0: [1.05, 4.12, 1.11], at1: [1.05, 4.12, 1.11], focus: 'eyes', mv: [129.4, 136.9], roll: [0, 0],
    light: '3am', iv: ['s03', 24.0], scr: 142.95, gaze: 'screen', hand: { side: 'R', to: 'mouth', prop: 'mug', sip: [[129.4, 1.0], [136.9, 1.0]], gulps: [130.1, 132.0] },
    beat: 'V22 (Ivan) + V23', board: 'r3c6', tr: 'cut: back at the desk, close on his mouth at the mug',
    why: 'V22 IVAN “One more module. One more integration.” V23 “Then he’ll rest.” Close in profile on his mouth, the mug held at his lips: a gulp on each line, the screen light on his face. He doesn’t put it down.' },
  { id: 'K38', name: 'It’s not all pleasant', t0: 136.9, t1: 140.0, mm: [38, 38], f: 4.0,
    from: [2.05, 3.10, 1.75], to: [2.02, 3.14, 1.73], at0: [1.15, 4.32, 0.98], at1: [1.15, 4.32, 0.98], focus: [1.10, 4.10, 1.00], roll: [0, 0],
    light: '4am', zone: 'iso', iv: ['s03', 10.0, 13.1], scr: 148, mugs: true, beat: 'V24 a', board: 'r3c7 (C r3c1; render ref Group 9)', tr: 'time-skip tick: the room falls to black (the K21 frame again)',
    why: 'V24 “It’s not all pleasant. Around 4 AM,” The desk alone in the void again, as in the module frames, now with no modules: just him, the screens and the dark.' },
  { id: 'K39', name: 'Eyes burn', t0: 140.0, t1: 143.4, mm: [75, 75], f: 2.8,
    from: [1.06, 4.86, 0.92], to: [1.059, 4.833, 0.925], at0: [1.04, 3.97, 1.08], at1: [1.04, 3.97, 1.08], focus: 'eyes', roll: [0, 0],
    light: '4am', iv: ['s03', 15.0], scr: 150, look: 8, key: { at: [1.05, 4.45, 0.86], color: 0x9fd2ff, k: 0.9 }, ev: -0.3, beat: 'V24 b', board: 'r3c8 (C r3c2)', tr: 'cut: low, from behind the screens',
    why: 'V24 “when his eyes burn” Low from behind the screens, the cold light up into his face.' },
  { id: 'K40', name: 'Hands shake', t0: 143.4, t1: 147.4, mm: [32, 32], f: 2.8,
    from: [0.80, 4.90, 1.30], to: [0.806, 4.854, 1.281], at0: [0.90, 4.15, 0.93], at1: [0.90, 4.15, 0.93], focus: [0.92, 4.34, 0.90], roll: [0, 0],
    light: '4am', iv: ['s03', 16.4, 19.4], scr: 152, hand: { side: 'L', to: [0.80, 4.18, 0.90], lat: 0.09, prop: 'mug', sip: [[143.4, 0.5], [145.8, 0.6], [147.4, 0.64]], shake: true }, beat: 'V24 c', board: 'r3c9 (C r3c3)', tr: 'cut: top-down',
    why: 'V24 “and his hands shake from a caffeine overload, Ivan feels a creeping dread.” Top-down: one hand typing, the other lifting a mug that won’t keep still.' },
  // round 14: tighter, only the eyes and the glasses (brow to the bridge of the nose); the code in the lenses encrypts
  { id: 'K41', name: 'Doesn’t fully understand', t0: 147.4, t1: 152.4, mm: [135, 135], f: 11,
    from: [1.058, 4.75, 1.084], to: [1.040, 4.752, 1.084], at0: [1.049, 4.22, 1.080], at1: [1.047, 4.22, 1.080], focus: 'bone:Ivan_GlassesLens', roll: [0, 0],
    light: '4am', iv: ['s03', 13.0], scr: 155, refl: { kind: 'code', scr: [148.2, 151.9], k: 1.6, tint: 0.06 }, beat: 'V25 a', board: 'r4c1 (C r3c4)', tr: 'cut in: his eyes',
    why: 'V25 “A sense that he’s building something he doesn’t fully understand.” Only his eyes behind the glasses; in both lenses the code he is running (def send_reply(email): ...) breaks down letter by letter into symbols, then into solid blocks, like an encrypted message.' },
  { id: 'K42', name: 'It takes something from him', t0: 152.4, t1: 158.0, mm: [20, 20], f: 4.0,
    from: [2.70, 1.20, 0.55], to: [2.7, 1.2, 0.55], at0: [1.30, 5.50, 2.55], at1: [1.3, 5.5, 2.9], focus: [1.05, 3.95, 1.0], mv: [153.4, 157.6], roll: [0, 0],
    light: '4am', iv: ['s03', 0.4, 5.6], scr: 156, zone: 'tower', beat: 'V25 b', board: 'r4c2 (W.I.P.; experimental, kept)', tr: 'the walls fall away again, cold',
    cl: { at: [1.55, 6.6, 4.55], face: [2.70, 1.20, 0.55], s: 18, pose: 'idle', born: 156.0, bornDur: 1.2 },
    why: 'V25 “each automation takes something from him, even as it gives something back.” His desk small at the foot of the thing he built, a tower of modules in the dark, Claude huge and cold on it. His warm light streams up into it.' },
  { id: 'K43', name: 'Finishes another module', t0: 158.0, t1: 162.2, mm: [70, 70], f: 8,
    from: [1.36, 4.46, 0.86], to: [1.352, 4.455, 0.857], at0: [1.163, 4.326, 0.78], at1: [1.163, 4.326, 0.78], focus: 'bone:mixamorigRightHandIndex4', mv: [158.0, 160.2], roll: [0, 0],
    press: 160.2, tapKey: true, light: '4am', iv: ['s03', 30.75], scr: 175.5, point: 'R', beat: 'V26 a', board: 'r4c3 (C r4c1)', tr: 'cut: macro, the finger',
    why: 'V26 “But then he finishes another module, and it works,” One finger coming down on Enter.' },
  { id: 'K44', name: 'Pure satisfaction', t0: 162.2, t1: 166.0, mm: [35, 35], f: 2.8,
    from: [1.08, 4.58, 1.00], to: [1.081, 4.593, 0.997], at0: [1.05, 4.15, 1.10], at1: [1.05, 4.15, 1.1], focus: 'eyes', roll: [0, 0],
    flick: [162.2, 166.0], light: '4am', iv: ['s03', 30.75], scr: 177.6, look: 16, cyan: 0.3, amber: 0.45, ev: -1.1, beat: 'V26 b', board: 'r4c4', tr: 'cut on the pass chord: the screen flares',
    why: 'V26 “and the dread dissolves into a rush of pure satisfaction.” The screen flares and washes his face cyan-white, the room glowing amber behind him.' },
  // round 14: the machine is too big to see: set back 60 m and seen whole (all four edges in frame) from low on the
  // pale ground, a 24 mm lens 20 m behind him; he stands tiny in the lower left, looking up at it. A slow push.
  { id: 'K45', name: 'HE... built that', t0: 166.0, t1: 168.85, mm: [24, 24], f: 8.0,
    from: [3.0, -20.0, 0.40], to: [3.15, -19.3, 0.42], at0: [41.0, 64.0, 20.0], at1: [41.0, 64.0, 20.25], focus: [1.04, 3.85, 1.0], roll: [0, 0],
    light: 'void', iv: ['s03', 8.0], stand: true, look: 30, zone: 'monolith', zopt: { bldAt: [10, 60], fog: 0.0028 }, beat: 'V27 a * (Ivan)', board: 'r4c5', tr: 'hard cut on “HE” (166.00): white',
    why: 'V27 IVAN “HE... built that.” Low on the pale ground: the whole machine, a dark block of lit windows spelling his modules, edge to edge in the frame; Ivan tiny in the corner, looking up at it.' },
  { id: 'K46', name: 'What HE told it to do', t0: 168.85, t1: 172.4, mm: [32, 32], f: 2.8,
    from: [1.04, 5.10, 3.50], to: [1.04, 4.62, 2.55], at0: [1.04, 3.88, 0.90], at1: [1.04, 3.88, 0.90], focus: [1.04, 3.95, 1.40], mv: [168.85, 171.94], dolly: 13.37, roll: [0, 0],
    cutBlack: 171.94, gaze: 'cam', light: 'void', iv: ['s03', 8.0], stand: true, look: 42, zone: 'monolith', zopt: { noBuilding: true }, beat: 'V27 b (Ivan)', board: 'r4c6', tr: 'cut on the drop (168.85): from above',
    why: 'V27 IVAN “The machine does what HE told it to do.” From high above, he looks up at us, small on the pale ground. The machine’s view of him.' },

  { id: 'K47', name: 'Dawn', t0: 172.4, t1: 175.2, mm: [60, 60], f: 4.0,
    from: [0.46, 3.96, 0.93], to: [0.46, 3.96, 0.93], at0: WATER, at1: [0.76, 4.33, 0.845], focus: WATER, roll: [0, 0],
    fadeIn: [172.4, 0.8], light: 'sunrise', iv: ['s03', 36.6], scr: 200.7, beat: 'V28 a', board: 'r4c7 (MOTION GRAPHICS)', tr: 'the vacuum (171.94), then dawn rises (173.28) on the K04 frame',
    why: 'V28 “By sunrise,” The K04 glass at dawn, gold now: still full.' },
  { id: 'K48', name: 'By sunrise', t0: 175.2, t1: 177.8, mm: [18, 18], f: 5.6,
    from: [2.10, 3.88, 3.40], to: [2.13, 3.88, 3.48], at0: [0.95, 3.92, 0.60], at1: [0.95, 3.92, 0.60], focus: [1.05, 3.95, 0.90], roll: [0, 0],   // round 14: the K01 framing, Ivan centred
    grade: { con: 0.25, sat: 1.05 }, light: 'sunrise', iv: ['s03', 30.75, 33.3], scr: 200.7, top: true, ev: 0.3, amber: 0.5, beat: 'V28 b', board: 'r4c7', tr: 'match on K01 / K11: the third top-down',
    why: 'V28 “...Ivan has a system that handles his email,” The third top-down: the room gold, the bed untouched.' },
  // round 14 (V1): the white icons' focus and glow more prominent: the lens on the wall of icons (f/2.8, Ivan soft in
  // front), brighter, bigger; and they are the words of the line: his email (already handled), calendar, documents, reading
  { id: 'K49', name: 'Calendar, documents, reading', t0: 177.8, t1: 182.5, mm: [28, 28], f: 2.0,
    from: BEHIND, to: [1.17, 2.55, 1.55], at0: BEHIND_AT, at1: [1.17, 4.55, 1.24], focus: [1.28, 4.68, 1.65], roll: [0, 0],
    grade: { con: 0.35, sat: 1.12 }, iconSet: ['inbox', 'calendar', 'documents', 'research'], iconsBorn: [177.0, 178.3, 179.6, 181.0], light: 'sunrise', iv: ['s03', 32.0, 33.3], scr: 204.6, icons: 4, iconsIdle: true, iconIdleK: 1, iconK: 0.9, iconTint: [0.9, 0.97, 1.0], iconScale: 1.5, iconLight: 0.1, ev: -0.4, iconsWall: true, beat: 'V28 c', board: 'r4c7', tr: 'cut: from behind, the desk wall',
    cl: { at: [1.58, 4.48, 1.235], face: BEHIND, s: 1.8, pose: 'sit', glow: 0.6, born: 177.9, bornDur: 0.9 },
    why: 'V28 “...manages his calendar, drafts his documents, and summarizes his reading.” From behind at dawn: on the wall over the desk the white icons of what he built light one by one on the words (email, calendar, documents, reading), sharp and glowing, Ivan soft in front of them, Claude sitting on the monitor with nothing to do.' },
  { id: 'K50', name: 'Exhausted and wired', t0: 182.5, t1: 188.8, mm: [35, 35], f: 2.2,
    from: [1.32, 4.75, 1.12], to: [1.309, 4.718, 1.122], at0: [1.05, 3.95, 1.16], at1: [1.05, 3.95, 1.16], focus: [1.06, 4.04, 1.21], roll: [0, 0],
    grade: { con: 0.25, sat: 1.05 }, lacedRamp: [182.9, 184.1], gaze: [1.06, 6.0, 1.3], light: 'sunrise', laced: true, iv: ['s03', 33.0, 36.8], scr: 210, cross: 1, beat: 'V29', board: 'r4c8 (C r4c4)', tr: 'cut: in front of him',
    why: 'V29 “He leans back in his chair, exhausted and wired.” Hands behind his head, the sun across him in the shape of the window bars.' },
  // round 14 (B4): K51 and K52 are one shot: straight down onto his face as he looks up at the ceiling, one constant
  // zoom from wide to very close across both lines (the ceiling is off, as in the top-downs)
  { id: 'K51', name: 'Then he realizes... what now', t0: 188.8, t1: 195.5, mm: [24, 70], f: 2.8,
    from: [1.05, 3.965, 2.55], to: [1.05, 3.958, 1.80], at0: [1.05, 3.95, 1.22], at1: [1.05, 3.95, 1.22], focus: 'eyes', mv: [188.8, 195.52], ease: 'lin', roll: [0, 0],   // a hair north of the face: the top of his head is up in frame
    grade: { con: 0.25, sat: 1.05 }, cutBlack: 195.52, gaze: [1.05, 3.95, 2.7], look: 34, top: true, light: 'sunrise', laced: true, iv: ['s03', 36.8], scr: 212, cross: 1, beat: 'V30a + V30b *', board: 'r4c8 + r4c9', tr: 'cut: overhead, straight down on his face',
    why: 'V30 “Then he realizes... he doesn’t know what he’s supposed to do now.” From directly above: his face turned up to the ceiling, hands behind his head, the sun across him; one slow constant zoom from the whole chair to his eyes. Then black (195.52).' },
  { id: 'K53', name: 'Black', t0: 195.5, t1: 201.64, mm: [85, 85], f: 2.0,
    from: [1.16, 4.50, 1.14], to: [1.16, 4.50, 1.14], at0: [1.05, 3.99, 1.21], at1: [1.05, 3.99, 1.21], focus: 'eyes', roll: [0, 0],
    light: 'sunrise', iv: null, black: true, beat: 'tail', board: '(end)', tr: 'cut to black on the vacuum (195.52)',
    why: 'Black before the hollow chime (196.04); the chime rings out over nothing.' },
];
export const shotAt = (t) => shotIn(SHOTS, t);
// the animation pass (ANIMATION_PLAN.md): a shot's camera move can run in a window inside the shot (mv: [a, b]: it
// lands on a beat and then holds), and a flow (flow: 'F1') runs ONE eased move across several keyframes (FLOWS)
export const FLOWS = {
  // (no F1: K07's camera sits between his face and the laptop and K08's is behind him, and a move between them would pass
  // through his head, so K07 -> K08 is a cut)
  F2: { t0: 74.1, t1: 81.8, cam: { from: [2.45, 2.70, 2.30], to: [2.367, 2.796, 2.215], at0: [1.18, 4.30, 1.02], at1: [1.18, 4.30, 1.02], mm: [28, 28] } },   // K21a-d: push 6% at the island
  // (no F3: round 14, K24 holds its own push and cuts to K25's top shot)
  F4: { t0: 97.4, t1: 102.3, cam: { from: [1.04, 2.85, 1.05], to: [1.78, 4.12, 1.02], arc: [1.04, 3.95], at0: [1.04, 5.4, 2.1], at1: [1.02, 4.00, 1.45], mm: [28, 28] } },   // K26 to K27: orbit round him (radius 1.1 to 0.76 m) to his profile, the aim coming down from the rings to his face
  F6: { t0: 117.7, t1: 126.3, cam: { from: [1.54, 3.11, 1.36], to: [1.574, 3.135, 1.358], at0: [1.20, 3.84, 1.32], at1: [1.20, 3.84, 1.32], mm: [50, 50] } },   // K33 to K34: one slow push, ending past the K34 keyframe
};
export const cameraAt = (t, pick) => {
  const s = shotAt(t);
  const F = s.flow && FLOWS[s.flow];
  const w = F ? [F.t0, F.t1] : s.mv;
  if (!w) return cameraIn(SHOTS, t, pick);
  const src = F ? { ...s, ...F.cam } : s;
  const s2 = { ...src, t0: w[0], t1: w[1] };
  let tt = Math.min(w[1] - 1e-4, Math.max(w[0], t));
  if (s.ease) {                                   // ease 'in' (accelerate into a cut) or 'out' (leave a cut at speed): remap through smoothstep's inverse
    const u = (tt - w[0]) / (w[1] - w[0]), q = s.ease === 'in' ? u * u : 1 - (1 - u) * (1 - u);
    tt = w[0] + (s.ease === 'lin' ? Math.acos(1 - 2 * u) / Math.PI                // 'lin': undo cameraIn's cosine ease exactly (K51's constant zoom)
      : 0.5 - Math.sin(Math.asin(1 - 2 * q) / 3)) * (w[1] - w[0]);
  }
  const c = cameraIn([s2], tt, pick);
  return { ...c, shot: s, u: (t - s.t0) / (s.t1 - s.t0) };
};

export const CAPTIONS = [
  [3.0, 7.36, 'It’s 3 AM, and Ivan hasn’t eaten since lunch.'],
  [8.06, 12.03, 'There’s a glass of water on his desk that he poured six hours ago.'],
  [12.93, 14.73, 'It’s still full.'],
  [15.84, 20.67, 'He’s hunched over his laptop, typing furiously, eyes bloodshot.'],
  [21.17, 26.24, 'A terminal window, a Claude chat, and a growing sprawl of Python scripts.'],
  [26.84, 29.68, 'He’s building an email automation system.'],
  [30.58, 34.45, 'Well... technically, Claude is doing the building.'],
  [35.15, 37.27, 'Ivan keeps saying yes.'],
  [38.87, 41.22, 'It started two days ago.'],
  [42.22, 50.26, 'IVAN: i have like 400 unread emails. every single one wants a reply. i’m fucking drowning here!'],
  [51.16, 62.81, 'CLAUDE: That sounds genuinely exhausting - and you’re definitely not alone! I can write a script that sorts your inbox and drafts the replies for you. You just review and approve. Want me to build one?'],
  [64.11, 67.74, 'That was the plan. Review and approve.'],
  [68.74, 73.50, 'But once the email system was working, Ivan saw what else was possible.'],
  [74.30, 75.79, 'Calendar management.'],
  [76.04, 77.53, 'Meeting scheduling.'],
  [77.78, 79.50, 'Document drafting.'],
  [79.75, 81.32, 'Research summaries.'],
  [82.02, 85.02, 'Each one a few hours of coding.'],
  [85.37, 89.24, 'Each one removing another task from his daily routine.'],
  [90.24, 93.71, 'It’s like discovering a cheat code for life.'],
  [94.06, 97.14, 'Every problem that used to take hours now takes minutes.'],
  [97.64, 105.35, 'Ivan feels like he’s vibrating at a different frequency than everyone around him, like he’s stepped through a door that others can’t even see.'],
  [107.55, 112.38, 'He’s barely slept. His girlfriend stopped texting because he wasn’t responding.'],
  [112.98, 116.95, 'Ironic, given that his system now responds to everyone else.'],
  [117.95, 125.66, 'He knows this isn’t healthy. He can feel something fraying at the edges of his mind, a thinness to his thoughts.'],
  [126.56, 129.07, 'But he’s close to something.'],
  [129.67, 133.06, 'IVAN: One more module. One more integration.'],
  [133.41, 135.53, 'Then he’ll rest.'],
  [137.13, 146.77, 'It’s not all pleasant. Around 4 AM, when his eyes burn and his hands shake from a caffeine overload, Ivan feels a creeping dread.'],
  [147.67, 157.31, 'A sense that he’s building something he doesn’t fully understand. That each automation takes something from him, even as it gives something back.'],
  [158.31, 165.15, 'But then he finishes another module, and it works, and the dread dissolves into a rush of pure satisfaction.'],
  [165.95, 171.99, 'IVAN: HE... built that. The machine does what HE told it to do.'],
  [173.78, 182.07, 'By sunrise, Ivan has a system that handles his email, manages his calendar, drafts his documents, and summarizes his reading.'],
  [182.77, 187.68, 'He leans back in his chair, exhausted and wired.'],
  [189.08, 191.12, 'Then he realizes...'],
  [192.72, 195.64, 'he doesn’t know what he’s supposed to do now.'],
];

// ---------------------------------------------------------------- who is on screen: held poses of the performances
const kf = (t) => shotAt(t);
// animation helpers: smoothstep, a ramp between two times, an overshooting landing (3%), keyed points (eased)
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ramp = (t, a, b) => sm((t - a) / Math.max(1e-4, b - a));
const land = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const e = 1 - Math.pow(1 - x, 3); return e + Math.sin(x * Math.PI) * 0.06 * x; };
function keyedP(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const u = sm((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])); return keys[i - 1][1].map((v, k) => v + (keys[i][1][k] - v) * u); }
  return keys[keys.length - 1][1];
}
const prevShot = (s) => shotAt(Math.max(0, s.t0 - 0.01));
// a performance clock: iv [clip, a] holds at a; iv [clip, a, b] plays from a at 1x and holds at b (rate: iv[3])
const ivOf = (t) => { const s = kf(t), v = s.iv; if (!v || v.length < 3) return v; return [v[0], Math.min(v[2], v[1] + (t - (s.ivT0 ?? s.t0)) * (v[3] ?? 1))]; };
export const ivanVisible = (t) => { const v = ivOf(t); return !!v && v[0] === 's03' && !kf(t).black; };
export const ivanTime = (t) => { const o = typeof window !== 'undefined' && window.__ivt; if (o !== undefined && o !== null) return o; const v = ivOf(t); return v && v[0] === 's03' ? v[1] : 0; };   // window.__ivt: scrub the performance (look-dev)
const ghost = (i, src) => ({
  visible: (t) => { const s = kf(t), g = s.ghosts; if (!g || !g[i] || g[i][0] !== src) return false; const T = s.ghostTicks; return !T || (t >= T[i] && t < T[2]); },   // the time-skip: each ghost on its tick, gone at the collapse
  time: (t) => { const s = kf(t), g = s.ghosts; if (!g || !g[i]) return 0; return g[i][2] !== undefined ? Math.min(g[i][2], g[i][1] + (t - s.t0)) : g[i][1]; },
});
export const CAST = [
  { url: 'scenes/s04/ivan_eyes.glb', t0: 0, t1: 0, role: 'main4', visible: (t) => { const v = ivOf(t); return !!v && v[0] === 's04'; }, time: (t) => { const v = ivOf(t); return v ? v[1] : 0; } },
  { url: 'scenes/s04/ivan_eyes.glb', t0: 0, t1: 0, role: 'ghost0', ...ghost(0, 's04') },
  { url: 'scenes/s04/ivan_eyes.glb', t0: 0, t1: 0, role: 'ghost1', ...ghost(1, 's04') },
];

// ---------------------------------------------------------------- screens on each keyframe's own clock
const card = document.createElement('canvas'); card.width = 1600; card.height = 900;
const cardG = card.getContext('2d');
const phoneCanvas = document.createElement('canvas'); phoneCanvas.width = 720; phoneCanvas.height = 1560;
const phoneG = phoneCanvas.getContext('2d');
// the phone fully lit on Sarah's last message: the chapter's own wake moment (found once; 118.2 s fell in its dimmed tail)
const PHONE_LIT_T = (() => { for (let t = 100; t < 140; t += 0.01) if (phoneGlow(t) > 0.995) return t + 0.05; return 118.2; })();
// a screen's clock runs on through the shot from its keyframe value (the work keeps happening), unless scrHold
// round 12 (K43): the right index fingertip over the Enter key, hovering 3 cm above it, down onto it at s.press and
// off again (arm IK: the wrist is moved so the tip lands, two passes because the hand turns with the forearm)
function tapEnter(root, t, s) {
  const key = legends && legends.userData.enter, b = bones(root), tip = b.RightHandIndex4, hand = b.RightHand;
  if (!key || !tip || !hand) return;
  const down = s.press ? ramp(t, s.press - 0.22, s.press) - ramp(t, s.press + 0.15, s.press + 0.5) : 0;
  const goal = key.clone().add(new THREE.Vector3(0.0095, 0.004 + 0.03 * (1 - down), -0.0044));   // the tip bone sits behind the pad: measured on the K43 frame
  for (let i = 0; i < 3; i++) {
    root.updateMatrixWorld(true);
    const tp = tip.getWorldPosition(new THREE.Vector3()), hp = hand.getWorldPosition(new THREE.Vector3());
    reach(root, 'R', hp.add(goal.clone().sub(tp)), new THREE.Vector3(0.5, -1, 0.3));
  }
  root.updateMatrixWorld(true);
}
// how lit the desk phone is (0..1). phoneLit: true (on), or { sleep: [a, b] }: the screen sleeps as a phone does, a
// dim to a third at a, held, then black by b (round 14, K31: it goes dark after "stopped texting")
function phoneLitAt(s, t) {
  const P = s.phoneLit; if (!P) return 0; if (P === true || !P.sleep) return 1;
  const [a, b] = P.sleep, m = a + (b - a) * 0.55;
  return t < m ? 1 - 0.68 * ramp(t, a, a + 0.12) : 0.32 * (1 - ramp(t, m, b));
}
const scrT = (s, t, k) => (s[k] ?? 4) + (s.scrHold ? 0 : Math.max(0, t - s.t0));
export const SCREENS = {
  laptop(g, t, keys = []) {
    const s = kf(t);
    if (s.lap === 'toasts') return sentToasts(g, t - s.t0, { bgT: s.scr });          // round 14 (K18): 'email sent' notifications stacking
    if (s.lap === 'outbox') return outbox(g, t - s.t0, { clock: s.scr });           // round 14 (K32): the Sent box firing replies
    if (s.s4 !== undefined) return S4.laptop(g, scrT(s, t, 's4'), keys); return CH1.laptop(g, scrT(s, t, 'scr'), keys);
  },
  monitor(g, t) { const s = kf(t); return CH1.monitor(g, s.s4 !== undefined ? 38 + scrT(s, t, 's4') : scrT(s, t, 'scr')); },
  monitor2(g, t) { const s = kf(t); return CH1.monitor2(g, s.s4 !== undefined ? 38 + scrT(s, t, 's4') : scrT(s, t, 'scr')); },
  phone(g, t) {
    const s = kf(t);
    const lit = phoneLitAt(s, t);
    if (lit > 0.001) { CH1.phone(g, PHONE_LIT_T); if (lit < 1) { g.fillStyle = `rgba(0,0,0,${1 - lit})`; g.fillRect(0, 0, 720, 1560); } return; }
    g.fillStyle = '#000'; g.fillRect(0, 0, 720, 1560);
  },
};

// ---------------------------------------------------------------- set-up
let RL = null, claude = null, stage = null, note = null, cardMesh = null, label = null, rig = null;
let atmoRef = null, glowPass = null, clearLens = null, lensMat = null, keyLight = null, imagPass = null, legends = null, postRef = null, bloom0 = null;
let winLight = null, crossLight = null, cyanLight = null, amberLight = null, mug = null, mugGhosts = [], phone = null, refl = null;
let ghostChairs = [], beam = null, weave = null, lifeUps = [], icons = {}, iconLights = [], envs = [], blocks = [], pipe = null, thin = null, phoneLight = null, greenLight = null;

export async function setup(args) {
  ROOM3.setup(args);
  RL = await createRoomLight({ ...args, volume: ROOM3.VOLUME });
  const { scene, L } = args;
  args.renderer.localClippingEnabled = true;
  args.renderer.shadowMap.enabled = true;
  rig = { L, lamp: {}, monitor: {}, screens: (L.screens || []).map(() => ({})), glow: [] };
  args.root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const m = o.material;
    if (/^(desk_lamp_arm_01_light|Lamp_Bulb|Lamp Shade)$/.test(m.name) && !rig.glow.some((x) => x.m === m)) rig.glow.push({ m, st: {} });
  });
  captureRest(scene);
  legends = addKeyLegends(args.root, scene);
  refineGlass(args.named || {}, scene);                          // every Ivan's bind pose, before any performance touches the bones

  claude = createClaude({ size: 0.011 }); scene.add(claude.group); claude.group.visible = false;
  atmoRef = args.atmo || null;   // round 14 (A2): Claude is always the voxel character (the starburst spark is gone)
  stage = createStage(scene, { center: [1.04, 3.95] });
  for (const mode of ['cheat', 'door', 'dome', 'down', 'tower', 'balcony', 'monolith']) stage.set(mode, 0);   // fill every buffer once
  stage.set(null);

  // the modules (round 14: white outline icons after R3), each with a small warm-white light (they touch the desk and
  // his hair as they arrive). One of every module design, plus the inbox (K49: "handles his email")
  icons = {};
  for (const n of [...MODULE_ORDER, 'inbox']) { const m = icon(n, { px: 0.0082 }); m.visible = false; scene.add(m); icons[n] = m; }
  iconLights = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffe9d2, 0, 1.4, 2); scene.add(l); return l; });
  for (let i = 0; i < 70; i++) { const e = envelope({ px: 0.0042, check: i % 2 === 0 }); e.visible = false; scene.add(e); envs.push(e); }
  lifeUps = LIFE_UPS.map((_, i) => { const g = lifeUp(i, { px: 0.014 }); scene.add(g); return g; });
  // the time-skip ghosts sit on ghost chairs (copies of his chair, tinted like each ghost), beside him at the desk
  {
    let chair = null; args.root.traverse((o) => { if (o.name === 'Baked_ROOM_21') chair = o; });
    if (chair) {
      chair.updateWorldMatrix(true, false);
      for (const tint of [new THREE.Color(0.45, 0.85, 1.0), new THREE.Color(1.0, 0.72, 0.45)]) {
        const c = new THREE.Mesh(chair.geometry, new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(0.5), transparent: true, opacity: 0.07, depthWrite: false }));
        c.matrixAutoUpdate = false; c.userData.base = chair.matrixWorld.clone(); c.visible = false; scene.add(c); ghostChairs.push(c);
      }
    }
  }
  // V25 "it takes something from him": a shaft of his warm light rising from the desk into the cold thing he built
  {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,170,90,0.6)'); gr.addColorStop(0.45, 'rgba(255,190,140,0.2)'); gr.addColorStop(0.85, 'rgba(160,205,255,0.06)'); gr.addColorStop(1, 'rgba(150,200,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
    const geo = new THREE.CylinderGeometry(1, 0.22, 1, 32, 1, true); geo.translate(0, 0.5, 0);
    beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    beam.visible = false; scene.add(beam);
  }
  // Claude's construction of light (V07a): orbs on a dome lattice joined by fine threads, built ring by ring
  {
    const RINGS = 6, PER = 16, NFLY = 22;
    const orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }), RINGS * PER + NFLY + 1);
    orbs.frustumCulled = false;
    // (the threads are 1 px lines: above 1080p their opacity rises so they keep their weight in a 4K frame)
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(1.3, 0.85, 0.45), transparent: true, opacity: Math.min(1, 0.4 * Math.max(1, innerHeight / 1080)), blending: THREE.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false;
    const haloC = document.createElement('canvas'); haloC.width = haloC.height = 64; const hg = haloC.getContext('2d');
    const gr = hg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,170,0.9)'); gr.addColorStop(0.3, 'rgba(255,200,140,0.25)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
    hg.fillStyle = gr; hg.fillRect(0, 0, 64, 64);
    const glow = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.05, map: new THREE.CanvasTexture(haloC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
    glow.frustumCulled = false;
    weave = new THREE.Group(); weave.add(orbs, lines, glow); weave.visible = false; scene.add(weave);
    weave.userData = { orbs, lines, glow, RINGS, PER, NFLY };
  }
  for (let i = 0; i < 48; i++) { const b = codeBlock(i, { size: 0.009 }); b.visible = false; scene.add(b); blocks.push(b); }

  // the pipeline (round 14: white outline icons after R3): inbox -> sort -> draft -> you with dotted arrows between,
  // ticks above when it runs (K18); and in the same place REVIEW -> APPROVE (K16, K17). Local units: metres at scale 1
  pipe = new THREE.Group(); pipe.visible = false; scene.add(pipe);
  {
    const PX = 0.0098, GAP = 0.235;                                       // icon pixel, centre-to-centre
    PIPE_ORDER.forEach((n, i) => {
      const m = pipeIcon(n, { px: PX }); m.position.x = (i - 1.5) * GAP; m.name = n; m.userData.mi = i; m.userData.kind = 'offer'; m.userData.p0 = m.position.clone(); pipe.add(m);
      if (i < 3) { const a = pixelArrow({ px: PX, len: 12 }); a.position.set((i - 1.5) * GAP + GAP / 2, 0, 0); a.userData.mi = i + 0.6; a.userData.kind = 'offer'; a.userData.arrow = true; a.userData.p0 = a.position.clone(); pipe.add(a); }
      const tick = checkMark({ px: PX * 0.9 }); tick.position.set((i - 1.5) * GAP, 0.15, 0); tick.name = 'tick'; tick.userData.mi = i; tick.userData.p0 = tick.position.clone(); pipe.add(tick);
    });
    const RX = 0.17;                                                       // review and approve either side of the centre
    const rv = reviewIcon({ px: 0.0105 }); rv.position.set(-RX, 0, 0); rv.userData.kind = 'review'; rv.name = 'review'; pipe.add(rv);
    const ap = approveIcon({ px: 0.0105 }); ap.position.set(RX, -0.004, 0); ap.userData.kind = 'approve'; ap.name = 'approve'; pipe.add(ap);
    const bu = burst({ px: 0.0105 }); bu.position.copy(ap.position); bu.userData.kind = 'burst'; bu.name = 'burst'; pipe.add(bu);
    const ar = pixelArrow({ px: 0.0105, len: 16 }); ar.position.set(0.004, 0, 0); ar.userData.kind = 'raArrow'; ar.userData.arrow = true; ar.name = 'review arrow'; pipe.add(ar);
    // how much of approve's pen path is the ring (it draws first, then the tick strokes on)
    const ring = ap.userData.parts.main.children[0].count, all = ring + ap.userData.parts.tick.children[0].count; ap.userData.ringF = ring / all;
  }
  pipe.userData.light = new THREE.PointLight(0xffeedd, 0, 1.6, 2); scene.add(pipe.userData.light);

  // REVIEW + APPROVE on the back of the lid (scene 4's note)
  const nc = document.createElement('canvas'); nc.width = nc.height = 256;
  const n = nc.getContext('2d');
  n.fillStyle = '#f2d35b'; n.fillRect(0, 0, 256, 256); n.fillStyle = 'rgba(0,0,0,0.06)'; n.fillRect(0, 0, 256, 34);
  n.fillStyle = '#23201a'; n.textAlign = 'center'; n.font = 'bold 50px "Comic Sans MS", "Marker Felt", sans-serif';
  n.fillText('REVIEW', 128, 112); n.font = 'bold 44px "Comic Sans MS", "Marker Felt", sans-serif'; n.fillText('+ APPROVE', 128, 172);
  const ntex = new THREE.CanvasTexture(nc); ntex.colorSpace = THREE.SRGBColorSpace; ntex.anisotropy = 8;
  note = new THREE.Mesh(new THREE.PlaneGeometry(0.076, 0.076), new THREE.MeshBasicMaterial({ map: ntex, color: new THREE.Color(0.55, 0.55, 0.55), polygonOffset: true, polygonOffsetFactor: -4 }));
  const a20 = 20 * Math.PI / 180, nrm = [0, Math.cos(a20), -Math.sin(a20)];
  note.position.copy(B(NOTE[0] + nrm[0] * 0.003, NOTE[1] + nrm[1] * 0.003, NOTE[2] + nrm[2] * 0.003));
  note.lookAt(note.position.clone().add(B(...nrm))); note.rotateZ(-0.05); note.visible = false; note.name = 'Sticky note'; scene.add(note);

  // a floating chat window (K12): soft white, big, in the afternoon light
  const tex = new THREE.CanvasTexture(card); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5625), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.05, 1.05, 1.05), side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
  cardMesh.visible = false; cardMesh.userData.tex = tex; scene.add(cardMesh);

  // board A r2c1's hand-lettered label: "EMAIL AUTOMATION SYSTEM" with a pointer, chalk on the dark
  const lc = document.createElement('canvas'); lc.width = 1024; lc.height = 300;
  const lg = lc.getContext('2d'); lg.clearRect(0, 0, 1024, 300);
  lg.strokeStyle = lg.fillStyle = '#f4f1ea'; lg.lineWidth = 5; lg.lineCap = 'round';
  lg.font = '64px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
  lg.fillText('EMAIL AUTOMATION', 300, 110); lg.fillText('SYSTEM.', 420, 190);
  lg.beginPath(); lg.moveTo(290, 92); lg.lineTo(170, 92); lg.lineTo(70, 250); lg.stroke();
  lg.beginPath(); lg.arc(70, 258, 12, 0, 7); lg.stroke();
  const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
  label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.123), new THREE.MeshBasicMaterial({ map: ltex, transparent: true, alphaTest: 0.3, color: new THREE.Color(1.6, 1.6, 1.6) }));
  label.visible = false; scene.add(label);

  // the thinness (V20): lines of light behind him (in the room: beyond the window; on the balcony: the city)
  thin = new THREE.Group(); thin.visible = false; scene.add(thin);
  for (let i = 0; i < 120; i++) {
    const r = (k) => { const x = Math.sin((i + k) * 91.3) * 43758.5; return x - Math.floor(x); };
    const c = r(5) > 0.75 ? new THREE.Color(0.35, 1.3, 1.5) : new THREE.Color(1.6, 0.95, 0.5);
    const len = 2 + r(3) * 9;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02 + r(2) * 0.05, 0.02), new THREE.MeshBasicMaterial({ color: c.multiplyScalar(0.25 + r(4) * 0.9), fog: false }));
    bar.position.copy(B(1.04 + (r(1) - 0.2) * 22, 3.85 + 4 + r(6) * 18, -1.5 + r(7) * 5.0));
    // round 12: each line grows out of a point like a light trail (staggered over ~2 s), then keeps drifting sideways
    bar.userData = { x0: bar.position.x, len, delay: r(8) * 1.9, grow: 0.7 + r(9) * 1.3, v: (0.15 + r(10) * 0.5) * (r(11) > 0.5 ? 1 : -1) };
    thin.add(bar);
  }

  // props held in a hand
  mug = makeMug(); scene.add(mug);
  for (let i = 0; i < 2; i++) { const g = makeMug(); g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.28; o.material.depthWrite = false; } }); scene.add(g); mugGhosts.push(g); }
  phone = makePhone(phoneCanvas); scene.add(phone);

  // reflections in the lenses (K29 streaks, K41 code, the balcony's warm glow): drawn on a canvas, shown only on the
  // lens meshes. Round 14: the canvas is both lenses side by side (left half = the lens on the camera's left), laid out
  // as the camera sees them, so a streak can slide from one lens into the other and text can be drawn mirrored
  refl = new THREE.Group(); refl.visible = false; refl.name = 'Lens reflections'; scene.add(refl);
  const rc = document.createElement('canvas'); rc.width = 1024; rc.height = 512; refl.userData.canvas = rc;
  refl.userData.tex = new THREE.CanvasTexture(rc); refl.userData.tex.colorSpace = THREE.SRGBColorSpace;
  refl.userData.tex.wrapS = refl.userData.tex.wrapT = THREE.ClampToEdgeWrapping; refl.userData.tex.anisotropy = 8;
  // the imagined frames (the zones, the eye) get their own texture, apart from the room: a stipple grain that lives in
  // the mid-tones, a soft posterise, and for the eye a rust duotone (ref: the eye with the light in its glasses);
  // saturated highlights (the streaks, the pixel glows) keep their colour. k = 0 leaves the frame untouched.
  if (args.post && args.post.bloom) { postRef = args.post; bloom0 = { s: args.post.bloom.strength, r: args.post.bloom.radius, th: args.post.bloom.threshold }; }
  if (args.post && args.post.composer) {
    imagPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, k: { value: 0 }, con: { value: 0 }, gsat: { value: 1 }, lo: { value: new THREE.Vector3() }, hi: { value: new THREE.Vector3() }, duo: { value: 0 }, poster: { value: 6 }, stip: { value: 0.5 }, seed: { value: 0 },
        res: { value: new THREE.Vector2(1280, 720) }, cLo: { value: new THREE.Color(0.02, 0.006, 0.003) }, cMid: { value: new THREE.Color(0.55, 0.17, 0.08) }, cHi: { value: new THREE.Color(1.0, 0.66, 0.46) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float k, con, gsat, duo, poster, stip, seed; uniform vec3 lo, hi; uniform vec2 res; uniform vec3 cLo, cMid, cHi; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
        void main(){
          vec4 src = texture2D(tDiffuse, vUv); vec3 c = src.rgb;
          if (con > 0.0 || gsat != 1.0) { float g0 = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(g0), c, gsat); c = mix(c, c * c * (3.0 - 2.0 * clamp(c, 0.0, 1.0)), con); src.rgb = c; }   // per-shot grade: an S-curve
          { float lg = clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0); c = max(c + lo * (1.0 - lg) * (1.0 - lg) + hi * lg * lg, 0.0); src.rgb = c; }   // round 13: split tone
          if (k <= 0.0) { gl_FragColor = src; return; }
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = mx > 0.0 ? (mx - mn) / mx : 0.0;
          vec2 px = floor(vUv * res);
          float n = h(px), n2 = h(px + 17.0);
          float lp = floor(l * poster + n * 0.9) / poster;
          float dots = step(n2 * 0.85 + n * 0.15, pow(max(l, 0.0), 0.85));
          float ls = mix(l, mix(lp, dots, 0.22), stip);
          vec3 d = l < 0.45 ? mix(cLo, cMid, smoothstep(0.0, 0.45, ls)) : mix(cMid, cHi, smoothstep(0.45, 1.0, ls));
          vec3 tone = c * (ls / max(l, 1e-3));
          vec3 o = mix(tone, d, duo * (1.0 - smoothstep(0.2, 0.5, sat) * smoothstep(0.2, 0.45, l)));
          o += (n - 0.5) * 0.06;
          gl_FragColor = vec4(mix(c, o, k), src.a);
        }` });
    args.post.composer.addPass(imagPass);
    // round 13: the deep glow, after the tone mapper (OutputPass) and before the film grade, so grain and vignette sit on top
    glowPass = new GlowPass(args.scene || scene, args.camera);
    const oi = args.post.composer.passes.findIndex((p) => p.constructor && p.constructor.name === 'OutputPass');
    args.post.composer.insertPass(glowPass, oi >= 0 ? oi + 1 : args.post.composer.passes.length - 1);
    { const v = args.renderer.getDrawingBufferSize(new THREE.Vector2()); glowPass.setSize(v.x, v.y); }
    args.renderer.getDrawingBufferSize(imagPass.uniforms.res.value);
    imagPass.uniforms.res.value.divideScalar(Math.max(1, imagPass.uniforms.res.value.y / 1080));   // stipple cells in 1080p pixels (4K keeps the look)
  }
  // the glasses' lens is a transmission material: three renders it from a lower-resolution, softened copy of the scene,
  // so the eyes behind it go milky and flat. Here it is thin clear glass: nearly invisible face-on, a soft sheen at the
  // rim, a crisp highlight; the eyes render directly through it.
  clearLens = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 1, depthWrite: false,
    side: THREE.FrontSide, envMapIntensity: 0.35, specularIntensity: 0.6 });
  clearLens.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      float fr = pow(max(0.0, 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)))), 3.0);
      gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(1.2));                       // HDR reflections must not turn the glass into a lamp
      gl_FragColor.a = clamp(0.02 + 0.28 * fr, 0.0, 0.3);`);
  };
  // one material per side (uSide: 0 the camera-left lens, 1 the right); uFlip turns each lens's flat map so that u runs
  // to the camera's right and v up (set per frame from the camera, so it holds from any angle). The rim fades softly.
  const LU = { map: { value: refl.userData.tex }, uOff: { value: new THREE.Vector2() }, tint: { value: 0.55 }, k: { value: 2.6 } };
  lensMat = [0, 1].map((side) => new THREE.ShaderMaterial({ transparent: true, depthWrite: true,   // depth: the lens blur must see the reflection on the glass, not the face behind it
    uniforms: { ...LU, uSide: { value: side }, uFlip: { value: new THREE.Vector2() } },
    vertexShader: 'attribute vec2 lensUv; varying vec2 vUv; void main(){ vUv = lensUv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float k, tint, uSide; uniform vec2 uOff, uFlip; varying vec2 vUv;
      void main(){
        vec2 lu = mix(vUv, 1.0 - vUv, uFlip);
        vec2 uv = vec2((lu.x + uSide) * 0.5, lu.y) + uOff;
        vec3 c = texture2D(map, uv).rgb * k; float l = max(c.r, max(c.g, c.b));
        float e = length(lu - 0.5) * 2.0, rim = 1.0 - 0.45 * smoothstep(0.55, 1.0, e);
        gl_FragColor = vec4(c * rim, clamp((tint + l) * rim, 0.0, 1.0)); }` }));

  // the window as a light source by day and at dawn; the window bars across him at sunrise (a cookie on a spot)
  winLight = new THREE.RectAreaLight(0xffa060, 0, 2.8, 1.56);
  winLight.position.copy(B(0.02, 2.35, 1.64)); winLight.lookAt(B(2.0, 2.35, 1.40)); scene.add(winLight);
  const cc = document.createElement('canvas'); cc.width = cc.height = 256;
  const cg = cc.getContext('2d'); cg.fillStyle = '#000'; cg.fillRect(0, 0, 256, 256);
  const grd = cg.createRadialGradient(128, 128, 20, 128, 128, 128); grd.addColorStop(0, '#fff'); grd.addColorStop(1, '#000');
  cg.fillStyle = grd; cg.fillRect(0, 0, 256, 256); cg.fillStyle = '#000';
  cg.filter = 'blur(3px)'; cg.fillRect(118, 0, 20, 256); cg.fillRect(0, 108, 256, 16); cg.filter = 'none';
  const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace;
  crossLight = new THREE.SpotLight(0xffb070, 0, 6, THREE.MathUtils.degToRad(16), 0.3, 1.2);
  crossLight.map = ctex; crossLight.castShadow = true; crossLight.shadow.mapSize.set(512, 512);
  crossLight.position.copy(B(-0.7, 2.6, 1.9)); crossLight.target.position.copy(B(1.05, 4.0, 1.22)); scene.add(crossLight, crossLight.target);   // aimed at his face (window bars across it)
  keyLight = new THREE.PointLight(0xff7040, 0, 3.0, 2); scene.add(keyLight);
  cyanLight = new THREE.PointLight(0xc8f6ff, 0, 1.8, 2); cyanLight.position.copy(B(1.05, 4.40, 1.02)); scene.add(cyanLight);
  amberLight = new THREE.PointLight(0xff9a3c, 0, 4.0, 1.4); amberLight.position.copy(B(1.20, 3.20, 1.55)); scene.add(amberLight);
  phoneLight = new THREE.PointLight(0x9fb8ff, 0, 0.9, 2); phoneLight.position.copy(B(PHONE[0], PHONE[1], PHONE[2] + 0.06)); scene.add(phoneLight);
  greenLight = new THREE.PointLight(0x7dffb0, 0, 1.6, 2); greenLight.position.copy(B(1.10, 4.36, 1.02)); scene.add(greenLight);
  await createRoom(args, RL);   // round 14 (L5): rug, bed, floor, the outside by day, the dawn bake and its live sun, rays, dust
}

// ---------------------------------------------------------------- light per keyframe
// round 13, the colour script (NOTES_R13_LOOK.md section 3; ref OpenKnight: low key, practicals paint the face, one
// colour idea per sequence): how much of the baked bounce stays (room), the practicals (lamp, monitor key, laptop
// screens) and their colour, and the grade (contrast, saturation, a split tone: lo = shadows tint, hi = highlights tint)
const MOOD = {
  '3am':     { room: 0.38, lamp: 1.6, mon: 2.5, scr: 1.6, monCol: 0x5ea2ff, beam: 1.8, con: 0.26, sat: 1.16, lo: [-0.014, 0.004, 0.028], hi: [0.03, 0.014, -0.012] },
  '3am_soft':{ room: 0.75, lamp: 1.3, mon: 1.8, scr: 1.4, monCol: 0x6aa6ff, beam: 1.2, con: 0.22, sat: 1.1, lo: [-0.012, 0.004, 0.03], hi: [0.02, 0.012, 0.0] },   // K37: the moonlit bed must read
  '4am':     { room: 0.3, lamp: 0.9, mon: 2.9, scr: 1.8, monCol: 0x5a96ff, beam: 1.2, con: 0.3, sat: 1.08, lo: [-0.018, 0.0, 0.034], hi: [0.0, 0.012, 0.024] },
  '4am_iso': { room: 0.3, lamp: 1.2, mon: 2.0, scr: 1.6, monCol: 0x78aaff, con: 0.26, sat: 1.1, lo: [-0.014, 0.0, 0.03], hi: [0.02, 0.01, 0.0] },
  day:       { room: 0.95, lamp: 1.0, mon: 1.2, scr: 1.2, monCol: 0xcfe6ff, con: 0.12, sat: 0.97, lo: [-0.01, 0.012, 0.006], hi: [0.004, 0.01, 0.0] },
  evening:   { room: 0.8, lamp: 1.4, mon: 1.4, scr: 1.3, monCol: 0x9fb6ff, con: 0.2, sat: 1.15, lo: [0.012, -0.006, 0.03], hi: [0.035, 0.012, -0.015] },
  sunrise:   { room: 1.0, lamp: 1.0, mon: 1.0, scr: 1.0, monCol: 0xffd9b0, con: 0.18, sat: 1.14, lo: [0.012, -0.004, 0.018], hi: [0.04, 0.018, -0.012] },
  void:      { room: 1.0, lamp: 1.0, mon: 1.0, scr: 1.0, monCol: 0x86b8ff, con: 0.18, sat: 1.12, lo: [0.0, 0.0, 0.02], hi: [0.02, 0.01, 0.0] },
};
// the zones carry their own colour idea (the balcony: a cold night, amber and teal city)
const ZMOOD = { balcony: { ...MOOD.void, con: 0.26, sat: 1.15, lo: [-0.012, 0.0, 0.036], hi: [0.032, 0.012, -0.01] },
  // round 14 (L2): the lens haze (LOOK, locked) lifts every void's black to a navy; the R5 worlds sit on true black, K24 on
  // a black-violet: a negative shadow lift sinks the haze back (the highlights and the skin keep their tone)
  cheat: { ...MOOD.void, con: 0.2, lo: [-0.034, -0.058, -0.088], hi: [0.02, 0.01, 0.0] },
  down: { ...MOOD.void, con: 0.22, lo: [-0.048, -0.06, -0.125], hi: [0.02, 0.008, -0.004] },
  dome: { ...MOOD.void, con: 0.22, lo: [-0.045, -0.055, -0.115], hi: [0.02, 0.008, -0.004] } };
const moodOf = (s) => MOOD[s.mood] || ZMOOD[s.zone] || MOOD[(String(s.light || '3am').match(/4am_iso|4am|3am|evening|day|sunrise|void/) || ['3am'])[0]];
export function exposureBoost(t) {
  if (!RL) return 0;
  const s = kf(t), w = weightsFor(s.light, t, s.t0, s.t1);
  // round 14: give roomlight back its own lightmap levels before it runs. It reads any change since its last write as a
  // Look-editor edit and re-bases on it, so our dim (props, below) compounded frame after frame: a film rendered in
  // order grew darker the longer it ran, while a board or a preview seek (cold) did not. Preview and render now agree.
  if (lmUsers) for (const m of lmUsers) if (m.userData.lmw !== undefined && Math.abs(m.lightMapIntensity - m.userData.lmw) < 1e-6) m.lightMapIntensity = m.userData.lm0;
  RL.apply(w);
  const night = (w['3am'] || 0) + (w['4am'] || 0) + (w['4am_iso'] || 0) + 0.6 * (w.evening || 0) + 0.5 * (w.sunrise || 0) + (w.void || 0);
  if (rig) {
    const M = moodOf(s);   // round 13: the mood scales the practicals INSIDE follow (a multiply after it compounds frame to frame)
    follow(rig.L, 'lampBase', rig.lamp, night * M.lamp);
    if (rig.L.monitor) follow(rig.L.monitor, 'intensity', rig.monitor, (0.3 + 0.7 * Math.min(1, night)) * M.mon);
    (rig.L.screens || []).forEach((x, i) => follow(x.s, 'intensity', rig.screens[i], (0.4 + 0.6 * Math.min(1, night)) * M.scr));
    for (const x of rig.glow) follow(x.m, 'emissiveIntensity', x.st, Math.min(1, night));
  }
  const zoneEV = { drown: 0.3, balcony: 0.0, monolith: 0.4, down: 0.6, dome: 0.4, iso: 0.2 }[s.zone] || 0;
  if (s.black || (s.cutBlack && t >= s.cutBlack)) return -30;
  let fade = 0;
  if (s.fadeIn) fade = Math.log2(Math.max(0.002, ramp(t, s.fadeIn[0], s.fadeIn[0] + s.fadeIn[1])));   // a linear-light fade (log2 of the level)
  if (s.fadeIn && t < s.fadeIn[0]) return -30;                                   // black until the hit
  const evK = s.evTo ? (s.ev || 0) + (s.evTo[0] - (s.ev || 0)) * ramp(t, s.evTo[1], s.evTo[1] + s.evTo[2]) : (s.ev || 0);
  return RL.exposure + (LIGHT_EV[s.light] || 0) + zoneEV + evK + fade;
}
// the imagined worlds wear the imagination texture lightly (the eye, K29, wears it fully: see its imag)
const ZONE_IMAG = { drown: 0.2, cheat: 0.35, tower: 0.35, down: 0.3, dome: 0.3, door: 0.35, iso: 0.25, monolith: 0.3 };
// the day and dawn bakes are exported at a lower exposure than the night (lights.json): bring them up to a read
const LIGHT_EV = { day: 1.8, sunrise: 1.6, evening: 0.3 };
function follow(o, key, st, k) {
  if (st.w === undefined || Math.abs(o[key] - st.w) > 1e-6) st.base = o[key];
  o[key] = st.w = st.base * k;
}

// ---------------------------------------------------------------- what is in the frame
const KEEP_IN_ZONE = /^(Baked_DESK|Laptop_Hinge|Laptop_Screen|Monitor_Screen|Water|Water_Bubbles|Water_Glass|Ring_Stain_\d|Lamp_Bulb_Desk)$/;
const FIGURE_ZONES = ['down', 'dome', 'door', 'balcony', 'monolith', 'cheat'];          // he stands; no desk
let roomVis = null, outside = null, lmUsers = null, menS03 = null;
const DESK_SWEEP = new THREE.Plane(new THREE.Vector3(0, -1, 0), 99);   // keeps y < constant
const SHELF_CUT = new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.41);       // keeps x > 0.41 (three x = Blender x)
export function props(t, ctx) {
  holoTick(t);   // round 13: the holographic icons' scanlines and shimmer
  ROOM3.props(t, ctx);
  const { named, root, cast, scene } = ctx;
  const s = kf(t);
  const zone = s.zone && !(s.zoneAt && t < s.zoneAt) ? s.zone : null;

  // the zone: the room falls away (the desk stays, except where he stands on nothing)
  if (!roomVis) { roomVis = new Map(); root.children.forEach((o) => roomVis.set(o, o.visible)); }
  root.children.forEach((o) => {
    if (!zone) { if (o.name !== 'Baked_CEIL' && o.name !== 'Baked_WALLN') o.visible = roomVis.get(o); return; }
    o.visible = zone === 'drown' ? o.name === 'Baked_ROOM' : (KEEP_IN_ZONE.test(o.name) || o.name === 'Baked_ROOM') && !FIGURE_ZONES.includes(zone);
  });
  // the lamp's head floats detached in the voids (its arm is cut with the shelf), so in every zone it is gone; per shot,
  // `hide` clears named desk pieces off a frame (K08: the sticky notes over the monitor's header)
  if (named.Baked_DESK) named.Baked_DESK.children.forEach((c) => { c.visible = (!/^Baked_DESK_(8|9|34)$/.test(c.name) || !zone) && !(s.hide || []).includes(c.name); });   // lamp and rug: not in the voids
  if (named.Lamp_Bulb_Desk) named.Lamp_Bulb_Desk.visible = !zone && !(s.hide || []).includes('Baked_DESK_9');
  if (legends) legends.visible = !!named.Baked_DESK && named.Baked_DESK.visible && !s.black;
  if (named.Baked_ROOM) named.Baked_ROOM.children.forEach((c) => { c.visible = !zone || c.name === 'Baked_ROOM_21'; });   // in a void only his chair stays (he must sit on something)
  stage.setFigure(new THREE.Vector3(STAND[0], STAND[1], 0));
  let z0 = s; for (let k = 0; k < 8; k++) { const p = prevShot(z0); if (!p || p === z0 || p.zone !== s.zone) break; z0 = p; }
  stage.set(zone, t, { ...(s.zopt || {}), rise: s.rise, age: t - (s.zoneAt ?? z0.zoneAt ?? z0.t0), camV: camPos(t), cam: ctx.camera });
  if (glowPass) glowPass.params.gain = ({ dome: 0.6, door: 0.7, down: 0.8 })[zone] ?? 1.45;   // the ray worlds: dozens of sources, gentler halos
  // the desk falls away (K24 into K25): a plane sweeps it off from the top while the camera is overhead
  DESK_SWEEP.constant = s.deskAway ? 1.7 - 1.85 * ramp(t, s.deskAway[0], s.deskAway[1]) : 99;
  const clips = (zone ? [SHELF_CUT] : []).concat(s.deskAway && t > s.deskAway[0] ? [DESK_SWEEP] : []);
  if (named.Baked_DESK) named.Baked_DESK.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) m.clippingPlanes = clips.length ? clips : null; });
  for (const n of ['Baked_ROOM', 'Laptop_Hinge', 'Laptop_Screen', 'Monitor_Screen', 'Water', 'Water_Glass']) if (named[n]) named[n].traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) m.clippingPlanes = s.deskAway && t > s.deskAway[0] ? [DESK_SWEEP] : (n === 'Baked_ROOM' ? null : m.clippingPlanes); });
  scene.fog.density = zone ? (s.zopt?.fog ?? { balcony: 0.0, monolith: 0.006, drown: 0.16, tower: 0.035 }[zone] ?? 0.004) : 0.045;   // round 14: a shot may set its own haze (K45)
  scene.fog.color.set(zone === 'tower' ? 0x0a1a2c : zone === 'cheat' ? 0x0d0624 : zone === 'monolith' ? 0xd8dee3 : zone ? 0x02050a : 0x060a10);   // monolith: pale haze, the far end of the block fades

  // dim: the room sinks toward black around a lit desk (a transition state on the way into the zone)
  if (!lmUsers) { lmUsers = []; root.traverse((o) => { if (o.isMesh && !/^Baked_DESK/.test(o.parent?.name || '') && !/^Baked_DESK/.test(o.name) && o.material && o.material.lightMap) lmUsers.push(o.material); }); }
  const dim = (s.dimIn ? s.dimIn[0] + ((s.dim ?? 1) - s.dimIn[0]) * ramp(t, s.t0 + (s.dimIn[2] || 0), s.t0 + (s.dimIn[2] || 0) + s.dimIn[1]) : (s.dim ?? 1)) * (zone ? 1 : moodOf(s).room);   // round 13: the mood keeps less bounce at night
  for (const m of lmUsers) { if (m.userData.lm0 === undefined || Math.abs(m.lightMapIntensity - (m.userData.lmw ?? -1)) > 1e-6) m.userData.lm0 = m.lightMapIntensity; m.lightMapIntensity = m.userData.lmw = m.userData.lm0 * dim; }

  // the world outside the window by day and at dawn: a bright haze (the window reads as the light source)
  if (!outside) { outside = []; root.traverse((o) => { if (o.isMesh && /^(Hill|Ground|Neighbourhood|Tree_Line|Facade_Towers)/.test(o.name)) outside.push({ m: o.material, e: o.material.emissive.clone(), k: o.material.emissiveIntensity }); }); }
  const haze = { evening: [0x6a4a6a, 0.6] }[s.light];   // round 14: day and dawn have their own outside (room.js: a day sky, hazy hills and towers)
  for (const o of outside) { if (haze) { o.m.emissive.setHex(haze[0]); o.m.emissiveIntensity = haze[1] * dim; } else o.m.emissive.copy(o.e); }

  for (const k of ['Water', 'Water_Bubbles', 'Water_Glass']) if (named[k]) named[k].visible = s.glass !== false && (!zone || ['tower', 'iso'].includes(zone));
  if (named.Water_Glass) for (const d of named.Water_Glass.userData.details || []) d.visible = named.Water_Glass.visible;   // rim, base, meniscus (left floating in the voids before)
  // round 14 (K04): s03 adds its own meniscus, an OPAQUE dark ring at the waterline. Here the clear water refracts the
  // opaque scene, so that ring was drawn twice: on the waterline and again, smaller, inside the water's surface (the
  // "circles on top of the water"). kf1 has its own meniscus (refineGlass), so s03's is hidden in this scene only.
  if (!menS03) scene.traverse((o) => { if (o.name === 'Meniscus' && o.parent === scene) menS03 = o; });
  if (menS03) menS03.visible = false;

  // Ivan: held pose, then standing, placing, feet, head, hands, the faceted look
  begin();
  const all = [ctx.ivan, ...cast.map((c) => c.root)].filter((r) => r && r.visible);
  let who = null;
  for (const r of all) {
    place(r, null);
    if (s.stand) { place(r, { at: STAND, yaw: s.yaw || 0 }); stand(r); plantFeet(r); }
    if (s.place) place(r, s.place);
    const cr = cast.find((c) => c.root === r);
    if (cr && /^ghost/.test(cr.role)) r.position.x += cr.role === 'ghost0' ? -GHOST_DX : GHOST_DX;   // time-skip: the earlier hims beside him, each on its own chair
    const lean = s.leanK ? keyedP(s.leanK.map(([kt, v]) => [kt, [v]]), t)[0] : (s.lean || 0);
    leanBack(r, lean + 0.7 * Math.sin(t * Math.PI * 2 * (s.breath || 0.22)));   // breath
    if (typeof window !== 'undefined' && window.__look) lookUp(r, window.__look[0], window.__look[1]);
    else if (s.lookK) { const v = keyedP(s.lookK.map(([kt, l, y]) => [kt, [l, y || 0]]), t); lookUp(r, v[0], v[1]); } else lookUp(r, s.look || 0);
    if (s.armrest) armsOnChair(r, s.armrest === 'L' ? ['L'] : ['L', 'R']);
    if (s.laced && (r === ctx.ivan)) handsBehindHead(r, s.lacedRamp ? ramp(t, s.lacedRamp[0], s.lacedRamp[1]) : 1);
    if (s.point && (r === ctx.ivan || cast.find((c) => c.root === r && c.role === 'main4'))) pointIndex(r, s.point, s.press ? 34 * (ramp(t, s.press - 0.18, s.press) - ramp(t, s.press + 0.12, s.press + 0.4)) : 0);
    if (s.tapKey && r === ctx.ivan) tapEnter(r, t, s);
    if (r === ctx.ivan || cast.find((c) => c.root === r && c.role === 'main4')) who = r;
    setPix(r, !!s.pix || (s.pixable && new URLSearchParams(location.search).get('pixall') === '1'));
  }
  holdProp(s, who, ctx, t);
  { const zoneStand = s.stand && !s.gaze; const g = s.gaze ?? (zoneStand ? null : 'screen');   // seated at the desk: on the laptop by default
    for (const r of all) if (g) aimEyes(r, gazePoint(g, t, ctx), t); }
  end();

  // ghosts (time compressed into one frame): see-through Ivans
  cast.forEach((c) => {
    if (!/^ghost/.test(c.role) || c.root.userData.ghosted) return;
    const tint = c.role === 'ghost0' ? new THREE.Color(0.45, 0.85, 1.0) : new THREE.Color(1.0, 0.72, 0.45);       // one cool, one warm
    c.root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.28; o.material.depthWrite = false; o.castShadow = false;
      if (o.material.color) o.material.color.multiply(tint); if (o.material.emissive) { o.material.emissive.copy(tint).multiplyScalar(0.12); } } });
    c.root.userData.ghosted = true;
  });

  ghostChairs.forEach((c, i) => { c.visible = !!(s.ghosts && s.ghosts[i]) && !s.black && (!s.ghostTicks || (t >= s.ghostTicks[i] && t < s.ghostTicks[2])); if (c.visible) c.matrix.copy(c.userData.base).premultiply(new THREE.Matrix4().makeTranslation(i ? GHOST_DX : -GHOST_DX, 0, 0)); });

  // Claude
  const cl = s.cl;
  claude.group.visible = !!cl && !s.black;
  if (cl) {
    // birth: assembles bottom-up over 0.5 s from `born`, its light 0.2 s behind; exit: top-down in 0.3 s from `exit`
    let build = cl.build ?? 1, lk = 1;
    if (cl.born !== undefined) { build = Math.min(build, ramp(t, cl.born, cl.born + (cl.bornDur || 0.5))); lk = ramp(t, cl.born + (cl.bornDur || 0.5), cl.born + (cl.bornDur || 0.5) + 0.25); }
    if (cl.exit !== undefined) { const e = 1 - ramp(t, cl.exit, cl.exit + 0.3); build = Math.min(build, e); lk = Math.min(lk, e); }
    claude.group.visible = build > 0.001 && !s.black;
    const at = cl.path ? keyedP(cl.path, t) : cl.at;
    const p = B(...at);
    const yaw = cl.face ? Math.atan2(B(...cl.face).x - p.x, B(...cl.face).z - p.z) : 0;
    claude.set({ pos: p, yaw, scale: cl.s || 1, mood: cl.mood, pose: cl.pose, t, build, glow: cl.glow ?? 1, lightK: (cl.lightK ?? 1) * lk, halo: cl.halo });
  }
  if (atmoRef && atmoRef.beam) atmoRef.beam.uniforms.gain.value = zone ? 1 : (moodOf(s).beam ?? 1);   // the lamp's cone in the air
  if (atmoRef) {                                                   // round 13: the dust round Claude catches its light (magic in the air)
    const u = atmoRef.dust.uniforms, on = claude.group.visible && !zone;
    u.orbK.value = on ? 1.6 * (cl?.glow ?? 1) : 0;
    if (on) { claude.halo.getWorldPosition(u.orbPos.value); u.orbCol.value.copy(claude.light.color); }
  }

  // the modules: lit one by one over the desk in the void (V13), orbiting (V15), idle on the wall at dawn (V28).
  // Round 14: small white outline icons (R3) that draw themselves on as they pop up, each with a small life of its own
  // (the pencil writes, the magnifier scans, today's date pulses). s.iconSet picks which designs (K49 adds the inbox)
  const ISO_SPOTS = [[0.70, 4.12, 1.36], [0.96, 4.43, 1.44], [1.29, 4.67, 1.45], [1.66, 4.80, 1.35]];   // an arc over the desk (screen 0.33-0.75 across, measured on the K21 frame), each by where Claude presents it
  const WALL_SPOTS = [[0.74, 4.66, 1.62], [1.10, 4.69, 1.68], [1.46, 4.69, 1.68], [1.82, 4.66, 1.60]];   // on the desk wall, over the monitor and laptop, clear of the lamp
  const SET = s.iconSet || MODULE_ORDER;
  for (const n in icons) icons[n].visible = false;
  iconLights.forEach((l) => (l.intensity = 0));
  SET.forEach((n, i) => {
    const m = icons[n], bt = s.iconsBorn ? s.iconsBorn[i] : -1e9;
    const on = (s.icons || 0) > i && !s.black && t >= bt;
    if (!on || !m) return;
    m.visible = true;
    const age = t - bt, pop = land(age / 0.32), draw = Math.min(1, age / 0.55);
    let p;
    if (s.iconsOrbit) { const a = i / 4 * Math.PI * 2 + 0.6; p = B(1.04 + Math.cos(a) * 1.25, 3.95 + Math.sin(a) * 1.25, 1.75 + 0.25 * Math.sin(i * 2)); }
    else if (s.iconsWall) p = B(...(s.iconSpots || WALL_SPOTS)[i]);
    else p = B(...(s.iconSpots || ISO_SPOTS)[i]);
    p.y -= (1 - Math.min(1, pop)) * 0.05;                                                 // it pops up into place
    p.y += 0.004 * Math.sin(t * 2.2 + i * 1.9);                                         // idle bob
    m.position.copy(p); m.lookAt(camPos(t));
    m.scale.setScalar((s.iconScale ?? 1) * (0.55 + 0.45 * Math.max(0, pop)));
    const newest = i === (s.icons || 0) - 1 && !s.iconsOrbit && !s.iconsIdle;
    const k = (s.iconK ?? 1.0) * (s.iconsIdle ? (s.iconIdleK ?? 0.8) : newest ? 1.15 : 1) * (1 + 1.4 * Math.max(0, 1 - age / 0.45));   // a flash as it lands
    setLine(m, { draw, k, t, hot: 1.6 });
    m.userData.u.uColor.value.setRGB(...(s.iconTint || [1.0, 0.975, 0.94]));   // R3's white; a frame may cool it a hair to sit apart from a warm wall
    // each one's small life
    const P = m.userData.parts, px = m.userData.px;
    if (P.pencil) P.pencil.position.copy(P.pencil.userData.p0).add(new THREE.Vector3(px * 0.6 * Math.sin(t * 7.0 + i), px * 0.35 * Math.abs(Math.sin(t * 14.0 + i)), 0));   // writing
    if (P.write) layerK(m, 'write', 1 + 0.35 * Math.max(0, Math.sin(t * 3.0 + i)));
    if (P.lens) P.lens.position.copy(P.lens.userData.p0).add(new THREE.Vector3(px * 1.2 * Math.cos(t * 1.6 + i), px * 0.9 * Math.sin(t * 1.6 + i), 0));   // scanning the page
    if (P.day) layerK(m, 'day', 1.0 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.4 + i)));
    iconLights[i].position.copy(p); iconLights[i].intensity = (s.iconLight ?? (s.iconsIdle ? 0.05 : newest ? 0.3 : 0.16)) * (s.iconsOrbit ? 3 : 1) * Math.min(1, Math.max(0, pop));
  });

  // envelopes
  const r = (i, k) => { const x = Math.sin((i * 13 + k) * 78.233) * 43758.5453; return x - Math.floor(x); };
  envs.forEach((e, i) => {
    e.visible = !!s.env && !s.black;
    if (!e.visible) return;
    let p;
    if (s.env === 'drown') { const a = r(i, 1) * Math.PI * 2, rad = 0.35 + r(i, 2) * 0.8; p = B(1.04 + Math.cos(a) * rad, 3.85 + Math.sin(a) * rad * 0.8, 0.55 + r(i, 3) * 1.1); }
    else if (s.env === 'pile') { const a = r(i, 1) * Math.PI * 2, rad = 0.25 + r(i, 2) * 0.9; p = B(1.10 + Math.cos(a) * rad, 3.95 + Math.sin(a) * rad * 0.7, 0.05 + r(i, 3) * 0.9); }
    else {                                                                          // send: one envelope at a time leaves the screen
      // round 13: a readable stream, not a clump (a shared looping offset stacked them by the laptop, each tumbling):
      // every 0.38 s an envelope leaves the top of the screen, rides one rising arc up and to the left, grows in and fades
      const per = 0.38, life = 3.2, t0 = s.t0 + 0.9, cyc = envs.length * per;
      const tt = (((t - t0 - i * per) % cyc) + cyc) % cyc;
      if (t < t0 + i * per || tt > life) { e.visible = false; return; }
      const u = tt / life, w = (r(i, 4) - 0.5) * 0.18;
      p = B(1.02 - 0.5 * u + w * u, 4.46 + 0.06 * u + w * 0.3 * u, 0.96 + 0.42 * u - 0.08 * u * u);
      // round 14: white line envelopes, turned to the lens (a flat line icon edge-on would vanish), a little tilt each
      e.position.copy(p); e.lookAt(camPos(t)); e.rotateZ((r(i, 8) - 0.5) * 0.3 + 0.12);
      e.scale.setScalar(sm(Math.min(1, u * 9)) * (1 - sm(Math.max(0, (u - 0.8) / 0.2))));
      setLine(e, { draw: 1, k: 0.9 * (1 + 0.8 * Math.max(0, 1 - u * 6)), t });
      return;
    }
    e.position.copy(p); e.rotation.set(r(i, 6) * 0.8 - 0.4, r(i, 7) * 6.28, r(i, 8) * 0.6 - 0.3);
    e.scale.setScalar(s.env === 'drown' || s.env === 'pile' ? 1.2 : 0.9);
  });

  // Claude's code bricks (V07a)
  beam.visible = false;   // round 11: the block of light read badly; the motes carry the idea
  if (beam.visible) {
    const a = B(1.05, 4.15, 0.95), b2 = B(s.cl.at[0], s.cl.at[1], s.cl.at[2] + 1.4), d = b2.clone().sub(a);
    beam.position.copy(a); beam.scale.set(0.55, d.length(), 0.55);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }

  // the cheat code for his life (V15, round 14): each life-up flies in out of the dark on its own curve, turning, and
  // snaps into its slot on the ring round him (stage.lifeSlot) with a small overshoot and a flash; then it hangs there,
  // bobbing a little
  lifeUps.forEach((g, i) => {
    const bt = s.lifeBorn ? s.lifeBorn[i] : -1e9;
    g.visible = !!s.lifeUps && !s.black && t >= bt; if (!g.visible) return;
    const FLY = 0.5, u = Math.min(1, Math.max(0, (t - bt) / FLY));
    const slot = B(...stage.lifeSlot(i));
    const a = (i / 6) * Math.PI * 2 + 0.9, from = B(1.04 + Math.cos(a) * 6.5, 3.85 + Math.sin(a) * 5.0 - 2.0, 6.5 + 1.5 * Math.sin(i * 2.3));   // out of the dark, high and far
    const e = 1 - Math.pow(1 - u, 3), p = from.clone().lerp(slot, e);
    p.y += Math.sin(e * Math.PI) * 0.25;                                              // an arc, not a straight line
    const snap = t - bt - FLY, pop = snap > 0 ? 1 + 0.22 * Math.exp(-snap * 9) * Math.cos(snap * 30) : 0.35 + 0.65 * e;   // the lock: a quick ring-down
    p.y += snap > 0 ? 0.012 * Math.sin(t * 2.1 + i * 1.7) : 0;
    g.scale.setScalar(Math.max(0.02, pop) * (s.lifeScale || 1));
    g.position.copy(p);
    g.lookAt(camPos(t));
    const sp = g.getObjectByName('sprite'); if (sp) sp.rotation.y = snap > 0 ? 0.25 * Math.sin(t * 1.3 + i) * Math.min(1, snap * 2) : (1 - e) * 6.0;   // spinning in, settling
    const age = t - bt;                                                              // round 14: white line power-ups draw on as they fly in
    setLine(sp, { draw: Math.min(1, age / 0.4), k: 1.05 * (1 + 1.0 * Math.max(0, 1 - age / 0.4)), t, hot: 1.5 });
    setLine(g.getObjectByName('label'), { draw: Math.min(1, Math.max(0, (age - 0.15) / 0.3)), k: 0.9, t, hot: 1.2 });
  });

  // Claude building (V07a): a dome of light woven round it, ring by ring (the top rings unfinished); one bright orb
  // lifted in its hands; orbs streaming in from the laptop on an arc, each with a fading trail
  blocks.forEach((b) => (b.visible = false));
  weave.visible = !!(s.blocks && s.cl) && !s.black;
  if (weave.visible) {
    const { orbs, lines, glow, RINGS, PER, NFLY } = weave.userData;
    const C0 = B(...s.cl.at), R = 0.15, m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const GOLD = new THREE.Color(1.7, 0.95, 0.38), CYAN = new THREE.Color(0.45, 1.35, 1.6), WHITE = new THREE.Color(2.4, 2.0, 1.5);
    const camA = Math.atan2(camPos(t).z - C0.z, camPos(t).x - C0.x);                       // the dome opens toward the lens
    const P = [], cols = [], seg = [];
    let n = 0;
    const put = (p, r, c) => { m.compose(p, q, new THREE.Vector3(r, r, r)); orbs.setMatrixAt(n, m); orbs.setColorAt(n, c); P.push(p); cols.push(c.r / 2.2, c.g / 2.2, c.b / 2.2); n++; };
    const grid = [];
    for (let k = 0; k < RINGS; k++) {
      const el = (k / RINGS) * Math.PI * 0.46, kT = (s.weaveT0 ?? -1e9) + k * 0.55, kp = Math.min(1, Math.max(0, (t - kT) / 0.5));
      const done = Math.round((k < 4 ? PER : k === 4 ? 11 : 5) * kp);
      grid.push([]);
      for (let j = 0; j < PER; j++) {
        const a = (j / PER) * Math.PI * 2 + k * 0.26;
        const off = Math.abs(Math.atan2(Math.sin(a - camA), Math.cos(a - camA)));
        if (j >= done || off < 0.62) { grid[k].push(null); continue; }
        const p = new THREE.Vector3(C0.x + Math.cos(a) * Math.cos(el) * R, C0.y + 0.004 + Math.sin(el) * R * 0.95, C0.z + Math.sin(a) * Math.cos(el) * R);
        grid[k].push(p); put(p, 0.0045 + 0.0015 * ((j + k) % 3 === 0), (j + k) % 4 === 0 ? CYAN : GOLD);
      }
    }
    for (let k = 0; k < RINGS; k++) for (let j = 0; j < PER; j++) {
      const p = grid[k][j]; if (!p) continue;
      const r = grid[k][(j + 1) % PER]; if (r) seg.push(p, r);
      const u = k + 1 < RINGS ? grid[k + 1][j] : null; if (u) seg.push(p, u);
    }
    put(new THREE.Vector3(C0.x, C0.y + 0.14, C0.z), 0.011, WHITE);                       // the orb it holds up
    const from = B(1.08, 4.44, 0.96), to = new THREE.Vector3(C0.x, C0.y + 0.15, C0.z);
    for (let i = 0; i < NFLY; i++) {                                                     // the stream, with trails
      const head = Math.floor(i / 5), tr = i % 5, u = (((t * 0.55 + head * 0.21) % 1) + 1) % 1 - tr * 0.025;   // flowing, with trails
      if (u <= 0 || t < (s.weaveT0 ?? -1e9)) { m.makeScale(0, 0, 0); orbs.setMatrixAt(n, m); n++; P.push(to); cols.push(0, 0, 0); continue; }
      const p = from.clone().lerp(to, u); p.y += Math.sin(u * Math.PI) * 0.08;
      put(p, (0.006 - tr * 0.001), col.copy(head % 2 ? CYAN : GOLD).multiplyScalar(1 - tr * 0.18));
    }
    orbs.count = n; orbs.instanceMatrix.needsUpdate = true; if (orbs.instanceColor) orbs.instanceColor.needsUpdate = true;
    lines.geometry.dispose(); lines.geometry = new THREE.BufferGeometry().setFromPoints(seg);            // fresh: the count grows as it weaves
    glow.geometry.dispose(); glow.geometry = new THREE.BufferGeometry().setFromPoints(P); glow.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }

  // the pipeline: above the desk (the offer), or across the bottom of the frame between us and him (it works).
  // Round 14 (B1): K15 the four offer icons draw on one by one, dotted arrows marching between them; K16 they stutter
  // and go out (pipe.off), REVIEW draws on (pipe.review: a page, an eye reading it line by line) and APPROVE (pipe.approve:
  // a ring, then a tick stamped into it with a small burst); both hold through K17's zoom
  pipe.visible = !!s.pipe && !s.black; pipe.userData.light.intensity = 0;
  if (s.pipe) {
    const S = s.pipe, front = S.front, review = S.state === 'review';
    pipe.position.copy(front ? B(1.04, 4.56, 1.052) : B(...(S.at || [1.05, 4.50, 1.30])));   // (front: the line icons sit on their centres, 4 cm up keeps K18's row in frame)
    pipe.scale.setScalar(front ? 0.38 : (S.scale ?? 1));   // front: clear of the frame edges (K18)
    pipe.lookAt(camPos(t));
    const BT = S.born, TK = S.ticks, K0 = S.bright ?? 0.85;
    const off = review && S.off ? S.off : null;
    // the stutter: a few hard on/off cuts, more off than on toward the end, then dark
    // (each icon on its own stutter, so mid-flicker some are on, some off, some half gone)
    const stut = (tt, sd) => { if (!off || tt < off[0]) return 1; if (tt >= off[1]) return 0; const u = (tt - off[0]) / (off[1] - off[0]), f = Math.floor(tt * 24);
      const x = Math.sin(f * 12.9898 + Math.floor(sd) * 78.233) * 43758.5453, hsh = x - Math.floor(x); return hsh > 0.15 + 0.75 * u ? 1 : 0; };
    pipe.children.forEach((c) => {
      const kind = c.userData.kind, mi = c.userData.mi ?? 0, k = Math.floor(mi);
      const set = (o) => (c.userData.arrow ? setArrow(c, o) : setLine(c, o));
      if (c.name === 'tick') {
        const tt = TK ? TK[k] : -1e9; c.visible = S.state === 'done' && t >= tt;
        c.scale.setScalar(c.visible ? Math.max(0.05, land((t - tt) / 0.3)) : 1); set({ draw: Math.min(1, (t - tt) / 0.3), k: K0, t }); return;
      }
      if (kind === 'offer') {
        const b0 = BT ? BT[k] + (mi - k > 0 ? 0.4 : 0) : -1e9, age = t - b0, st = stut(t, mi * 2.3 + 1);
        c.visible = t >= b0 && st > 0 && S.state !== 'none';
        if (!c.visible) return;
        const u = land(age / 0.35);
        c.scale.setScalar(Math.max(0.02, 0.7 + 0.3 * Math.min(1.03, u)));
        if (c.userData.p0) { c.position.copy(c.userData.p0); c.position.y += (1 - Math.min(1, u)) * -0.04 + 0.004 * Math.sin(t * 2 + mi); }
        const fl = off && t >= off[0] ? 0.15 + 0.6 * (t - off[0]) / (off[1] - off[0]) : 0;          // pixels drop out as it fails
        set({ draw: Math.min(1, age / (c.userData.arrow ? 0.3 : 0.5)), k: K0 * (1 + 1.2 * Math.max(0, 1 - age / 0.4)) * (off && t >= off[0] ? 1.25 : 1), flick: fl, t, hot: 1.6 });
        return;
      }
      // review / approve / their arrow / the burst: only in the review state
      if (!review) { c.visible = false; return; }
      if (kind === 'review') {
        const age = t - S.review; c.visible = age >= 0; if (!c.visible) return;
        set({ draw: Math.min(1, age / 0.7), k: K0 * (1 + 1.0 * Math.max(0, 1 - age / 0.5)), t, hot: 1.6 });
        // the eye reads the page: a pass down the lines every 1.6 s (the line under the eye's gaze lights up), the
        // pupil tracking along each line; it blinks now and then
        const P = c.userData.parts, px = c.userData.px, rd = Math.max(0, age - 0.7), cyc = (rd % 1.6) / 1.6, line = Math.floor(cyc * 4), along = (cyc * 4) % 1;
        ['l0', 'l1', 'l2', 'l3'].forEach((ln, j) => layerK(c, ln, rd > 0 && j === line ? 1.9 : j < line && rd > 0 ? 1.15 : 1.0));
        if (P.pupil) P.pupil.position.copy(P.pupil.userData.p0).add(new THREE.Vector3(rd > 0 ? px * (-1.2 + 2.4 * along) : 0, rd > 0 ? px * (0.6 - 0.4 * line) : 0, 0));
        const blink = rd > 0 && ((rd + 1.0) % 3.1) > 3.0;
        if (P.eye) P.eye.scale.y = blink ? 0.25 : 1; if (P.pupil) P.pupil.visible = !blink;
        return;
      }
      if (kind === 'raArrow') {
        const age = t - (S.approve - 0.25); c.visible = age >= 0; if (!c.visible) return;
        set({ draw: Math.min(1, age / 0.3), k: K0 * 0.85, t }); return;
      }
      if (kind === 'approve' || kind === 'burst') {
        const age = t - S.approve; c.visible = age >= 0; if (!c.visible) { c.scale.setScalar(1); return; }
        const RING = 0.4, TICK = 0.28, f = c.userData.ringF ?? 0.8, landT = RING + TICK;
        if (kind === 'burst') {                                                            // the pop round the stamp
          const a = age - landT; c.visible = a >= 0 && a < 0.42; if (!c.visible) return;
          c.scale.setScalar(0.9 + 0.5 * sm(a / 0.42)); set({ draw: 1, k: K0 * 0.9 * (1 - sm(a / 0.42)), flick: sm(a / 0.42) * 0.7, t }); return;
        }
        const draw = age < RING ? f * age / RING : f + (1 - f) * Math.min(1, (age - RING) / TICK);
        const a = age - landT, punch = a >= 0 ? 1 + 0.16 * Math.exp(-a * 9) * Math.cos(a * 22) : 1;   // the stamp lands
        c.scale.setScalar(punch);
        set({ draw, k: K0 * (1 + (a >= 0 ? 0.9 * Math.exp(-a * 6) : 0.25)), t, hot: 1.6 });
        layerK(c, 'tick', 1.15);
        return;
      }
    });
    pipe.userData.light.position.copy(pipe.position); pipe.userData.light.intensity = S.light ?? 0.3;
  }

  if (note) note.visible = !!s.note;
  label.visible = !!s.label;
  if (s.label) { label.position.copy(B(1.18, 4.58, 1.40)); label.lookAt(camPos(t)); }
  thin.visible = !!s.thin;
  if (s.thin) {
    const u = t - s.t0;
    for (const bar of thin.children) {
      const d = bar.userData, g = sm(Math.min(1, Math.max(0, (u - d.delay) / d.grow)));
      bar.visible = g > 0.002; bar.scale.x = Math.max(0.002, g);
      bar.position.x = d.x0 - Math.sign(d.v) * d.len * 0.5 * (1 - g) + d.v * u;   // grows along its direction of travel
    }
  }
  phoneLight.intensity = 0.16 * phoneLitAt(s, t);
  greenLight.intensity = (s.green || 0) * 0.9;
  keyLight.intensity = s.key && !s.black ? s.key.k : 0;
  if (s.key) { keyLight.position.copy(B(...s.key.at)); keyLight.color.set(s.key.color || 0xff7040); }
  if (imagPass) {
    const I0 = s.imag || (zone && ZONE_IMAG[zone] ? { k: ZONE_IMAG[zone] } : null);
    const pz = prevShot(s), cont = pz && pz !== s && (pz.zone || pz.imag);
    const I = I0 ? { ...I0, k: I0.k * (cont ? 1 : ramp(t, (s.zoneAt || s.t0), (s.zoneAt || s.t0) + 1.0)) } : null;
    const u = imagPass.uniforms;
    u.k.value = I && !s.black ? I.k : 0; u.duo.value = I?.duo || 0; u.poster.value = I?.poster || 7; u.stip.value = I?.stip ?? 0.45;
    u.seed.value = Math.floor(t * 24) % 97;
    { const M = moodOf(s); u.con.value = s.grade?.con ?? M.con; u.gsat.value = s.grade?.sat ?? M.sat; u.lo.value.set(...M.lo); u.hi.value.set(...M.hi); }
  }
  // imagined worlds may glow more than the room: a per-world bloom (the room keeps the locked LOOK values)
  if (postRef && bloom0) { const B2 = { drown: [0.5, 0.7, 1.2], tower: [0.75, 0.9, 1.0] }[zone]; postRef.bloom.strength = B2 ? B2[0] : bloom0.s; postRef.bloom.radius = B2 ? B2[1] : bloom0.r; postRef.bloom.threshold = B2 ? B2[2] : bloom0.th; }
  cyanLight.intensity = (s.cyan || 0) * 2.2; cyanLight.color.setHex(0xc8f6ff);
  if (s.flick) {
    // round 12 (K44): he works across several windows at once. Each switch throws a different screen light on his
    // face (terminal green, chat cyan, a white doc, the blue IDE, a warm page), snapping over 80 ms and holding
    // 0.3-0.7 s; on the pass chord the screen flares cyan-white
    const [a0, a1] = s.flick, u = t - a0, P = [0x9ff0c4, 0xc8f6ff, 0xfff4e6, 0x86b8ff, 0xffc890, 0xb8fff0];
    const dur = (k) => 0.3 + 0.4 * (Math.sin(k * 78.233) * 43758.5453 % 1 + 1) % 1;
    let k = 0, e = 0; while (k < 60 && e + dur(k) < u) { e += dur(k); k++; }
    const snap = Math.min(1, Math.max(0, (u - e) / 0.08)), lvl = (j) => 0.7 + 0.8 * ((Math.sin(j * 12.9898) * 43758.5453 % 1 + 1) % 1);   // round 13: was 1.3-2.4 (a waxy white face once the mood lifted the monitor)
    const flare = ramp(t, a1 - 0.9, a1 - 0.2);
    cyanLight.color.setHex(P[(k + P.length - 1) % P.length]).lerp(new THREE.Color(P[k % P.length]), snap).lerp(new THREE.Color(0xd8fbff), flare);
    cyanLight.intensity *= (lvl(k - 1) + (lvl(k) - lvl(k - 1)) * snap) * (1 - flare) + 1.8 * flare;
    if (rig && rig.L.monitor) rig.L.monitor.color.copy(cyanLight.color);
  }
  amberLight.intensity = (s.amber || 0) * 4.0;
  const W = { sunrise: [0xff9a50, 7.0], day: [0xfff1dc, 2.5], evening: [0xff8a60, 1.6] }[s.light];
  winLight.intensity = W && !zone ? W[1] * (s.dim ?? 1) : 0; if (W) winLight.color.setHex(W[0]);
  // round 14: at dawn the live, shadow-mapped sun (room.js) does the real work; the window-bar cookie spot stays at 0.7 as a lift on his face
  crossLight.intensity = (s.cross || 0) * 95 * (roomState.dawn && /sunrise/.test(s.light || '') ? +(new URLSearchParams(location.search).get('crossk') ?? 0.7) : 1);
  roomFrame(t, s, ctx, { zone, dim, weights: weightsFor(s.light, t, s.t0, s.t1), envAt: ROOM3.ENV_AT, lens: postRef && postRef.lens });
  if (rig && rig.L.monitor && !s.flick) rig.L.monitor.color.setHex(s.green ? 0x9ff0c4 : s.cyan ? 0xc8f6ff : moodOf(s).monCol);

  // the floating chat window
  cardMesh.visible = !!s.card && !s.black;
  if (s.card) {
    const c = s.card;
    (CH1[c.fn] || CH1.card)(cardG, c.t);
    cardMesh.userData.tex.needsUpdate = true;
    cardMesh.position.copy(B(...c.at)); cardMesh.scale.setScalar(c.w || 0.36);
    cardMesh.lookAt(B(...c.faceTo));
  }

  // lens reflections: on the glass itself
  refl.visible = false;
  const R = s.refl && !s.black ? s.refl : null;
  if (R) { drawRefl(refl.userData.canvas, R, t); refl.userData.tex.needsUpdate = true; LU_SET(R); }
  const cam = ctx.camera; if (cam) cam.updateMatrixWorld();
  const cR = new THREE.Vector3(1, 0, 0), cU = new THREE.Vector3(0, 1, 0);
  if (cam) { cR.applyQuaternion(cam.quaternion); cU.applyQuaternion(cam.quaternion); }
  for (const r of [ctx.ivan, ...cast.map((c) => c.root)]) {
    if (!r) continue;
    const lenses = [];
    r.traverse((o) => {
      if (!o.isMesh) return;
      const m0 = o.userData.lens0 || (/Glasses Lens/.test(o.material.name) ? o.material : null);
      if (!m0) return;
      o.userData.lens0 = m0;
      if (!o.geometry.attributes.lensUv) {                                   // a flat map across the glass (its own UVs wrap radially)
        const g = o.geometry, P = g.attributes.position; g.computeBoundingBox();
        const sz = g.boundingBox.getSize(new THREE.Vector3()), ax = [0, 1, 2].sort((i, j) => sz.getComponent(j) - sz.getComponent(i));
        const lu = new Float32Array(P.count * 2), mn = g.boundingBox.min;
        for (let i = 0; i < P.count; i++) for (const [k, a] of [[0, ax[0]], [1, ax[1]]]) lu[i * 2 + k] = (P.getComponent(i, a) - mn.getComponent(a)) / sz.getComponent(a);
        g.setAttribute('lensUv', new THREE.BufferAttribute(lu, 2)); g.userData.lensAx = ax;
      }
      o.material = clearLens; lenses.push(o);
    });
    if (!R || !r.visible || !lenses.length) continue;
    // which lens is on the camera's left, and which way its flat map runs on screen
    const ctr = lenses.map((o) => { o.updateWorldMatrix(true, false); return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); });
    const mid = ctr.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / ctr.length);
    lenses.forEach((o, i) => {
      const side = ctr[i].clone().sub(mid).dot(cR) < 0 ? 0 : 1, m = lensMat[side];
      const ax = o.geometry.userData.lensAx || [0, 2, 1], A = (k) => new THREE.Vector3().setComponent(ax[k], 1).transformDirection(o.matrixWorld);
      m.uniforms.uFlip.value.set(A(0).dot(cR) < 0 ? 1 : 0, A(1).dot(cU) < 0 ? 1 : 0);
      o.material = m;
    });
  }
}
// the lens look per shot: brightness (k), the see-through floor (tint), an offset of the map
function LU_SET(R) { const u = lensMat[0].uniforms; u.k.value = R.k ?? 1.4; u.tint.value = R.tint ?? 0.1; u.uOff.value.set(...(R.off || [0, 0])); }

// the camera's position at t (for things that face it)
const camPos = (t) => { const c = cameraAt(t, () => new THREE.Vector3()); return c.pos; };
function eyesOf(root) {
  // measured (tools/kf_heads.mjs): the eye line sits ~9 cm in front of the Head bone and ~6.5 cm above it
  const b = root ? bones(root) : {}, h = b.Head;
  if (!h) return new THREE.Vector3();
  const yaw = root.rotation.y - (root.userData.home ? root.userData.home.r : 0);
  const fwd = B(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return h.getWorldPosition(new THREE.Vector3()).add(fwd.multiplyScalar(0.09)).add(new THREE.Vector3(0, 0.065, 0));
}
// the lens canvas (1024 x 512): the left half is the lens on the camera's left, the right half the other one, each
// half one whole lens as the camera sees it (x to the right, y down). R: the shot's refl { kind, ... }
const REFL_CODE = ['def send_reply(email):', '  text = draft(email)', '  if confident(text):', '    send(text)',
  "  log('replied')", 'for email in inbox:', '  send_reply(email)'];
const REFL_KW = /^(def|if|for|in|return)$/;
const REFL_SYM = '#$%&@*+=<>/\\{}[]|~^!?;:';
function reflColours(line) {
  // one colour per character: keywords violet, a name called with ( blue, a quoted string green, the rest white
  const out = [], re = /[A-Za-z_]+|'[^']*'|./g; let m;
  while ((m = re.exec(line))) {
    const tk = m[0], next = line[m.index + tk.length];
    const c = REFL_KW.test(tk) ? '#d39af0' : tk[0] === "'" ? '#a8d88a' : /^[A-Za-z_]/.test(tk) && next === '(' ? '#7fc0ff' : '#e6ebf2';
    for (let i = 0; i < tk.length; i++) out.push(c);
  }
  return out;
}
const REFL_COL = REFL_CODE.map(reflColours);
function drawRefl(c, R, t) {
  const kind = R.kind, g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
  const rnd = (n) => { const x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x); };
  if (kind === 'code') {
    // K41: the laptop's code reflected in each lens (mirrored, as a reflection is; R.mirror false reads it straight).
    // Over the shot it encrypts: letter by letter, in a wave down the lines, each one flickers through symbols and then
    // sets into a solid block (R.scr: [start, end] of the scramble on the VO clock)
    const [s0, s1] = R.scr || [148.2, 151.8], mirror = R.mirror !== false;
    const FS = R.fs || 27, CW = FS * 0.6, LH = FS * 1.4, BW = Math.max(...REFL_CODE.map((l) => l.length)) * CW, BH = REFL_CODE.length * LH;
    g.font = `${FS}px "DejaVu Sans Mono", Menlo, Consolas, monospace`; g.textBaseline = 'middle';
    for (const half of [0, 1]) {
      g.save(); g.beginPath(); g.rect(half * 512, 0, 512, 512); g.clip();
      if (mirror) { g.translate(half * 512 + 512, 0); g.scale(-1, 1); } else g.translate(half * 512, 0);
      const x0 = (512 - BW) / 2 + (R.x0 ?? 0) + (half ? -10 : 10), y0 = (512 - BH) / 2 + LH * 0.5 + (R.y0 ?? 20) + (half ? 5 : 0);   // each lens sees the screen from a little apart
      REFL_CODE.forEach((line, li) => {
        for (let j = 0; j < line.length; j++) {
          const ch = line[j]; if (ch === ' ') continue;
          const x = x0 + j * CW, y = y0 + li * LH, n = li * 41 + j;
          const w = (li / REFL_CODE.length) * 0.6 + (j / 24) * 0.25 + rnd(n) * 0.3;          // the wave: top-left first
          const ta = s0 + (s1 - s0 - 1.1) * Math.min(1, w), tb = ta + 0.55 + rnd(n + 7) * 0.55;
          if (t >= tb) {                                                   // a block: sealed
            const k = Math.min(1, (t - tb) / 0.2);
            g.globalAlpha = 0.6 + 0.4 * (1 - k); g.fillStyle = k < 1 ? '#ffffff' : '#bfe0ff';
            g.fillRect(x + 1, y - FS * 0.48, CW - 1, FS * 0.92); g.globalAlpha = 1;
          } else if (t >= ta) {                                            // symbols, flickering
            const q = Math.floor(t * 14 + rnd(n) * 9);
            g.fillStyle = '#ffc27a'; g.fillText(REFL_SYM[Math.floor(rnd(n * 3 + q) * REFL_SYM.length)], x, y);
          } else { g.fillStyle = REFL_COL[li][j]; g.fillText(ch, x, y); }
        }
      });
      g.restore();
    }
  } else if (kind === 'lines') {
    // K29: the glowing lines of the worlds he just saw (the K25-K27 bars: orange, warm white, a little teal), blurred
    // horizontal streaks sliding left to right across both lenses (R.slide: [[t, offset], ...], offset in lens pairs)
    const off = R.slide ? keyedP(R.slide.map(([kt, v]) => [kt, [v]]), t)[0] : 0;
    const C = ['#ff7a2a', '#ffb070', '#fff1d8', '#ff9a4a', '#3fd8e0', '#ffd9a8', '#ff6a2a', '#ffc890'];
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const p = -0.65 + rnd(i + 1) * 2.3, len = 0.18 + rnd(i + 2) * 0.55, y = 110 + rnd(i + 3) * 300;
      const x = (p + off) * 1024, w = len * 1024, col = C[Math.floor(rnd(i * 3.7) * C.length)];
      if (x > 1100 || x + w < -80) continue;
      g.filter = 'blur(6px)'; g.globalAlpha = 0.85; g.strokeStyle = col; g.lineWidth = 12 + rnd(i + 4) * 16;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
      if (rnd(i + 5) > 0.45) { g.filter = 'blur(2px)'; g.globalAlpha = 0.8; g.strokeStyle = '#fff6ea'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x + 10, y); g.lineTo(x + w - 10, y); g.stroke(); }
    }
    g.filter = 'none'; g.globalAlpha = 1;
  } else if (kind === 'warm') {
    // the balcony (R4): the flat's warm light and the city in the lenses, a soft amber glow with a few bokeh points
    for (const half of [0, 1]) {
      const cx = half * 512 + 256 + (R.hx ?? -40), cy = 200 + (R.hy ?? 0);
      const gr = g.createRadialGradient(cx, cy, 10, cx, cy, 300);
      gr.addColorStop(0, 'rgba(255,190,120,0.95)'); gr.addColorStop(0.35, 'rgba(255,140,60,0.6)'); gr.addColorStop(1, 'rgba(120,50,20,0.0)');
      g.fillStyle = gr; g.fillRect(half * 512, 0, 512, 512);
      g.filter = 'blur(7px)';
      for (let i = 0; i < 9; i++) {
        const n = i + half * 3, x = half * 512 + 70 + rnd(n + 11) * 380, y = 250 + rnd(n + 12) * 200, r = 10 + rnd(n + 13) * 18;
        g.fillStyle = rnd(n + 14) > 0.78 ? 'rgba(90,220,230,0.55)' : 'rgba(255,200,130,0.65)';
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      g.filter = 'none';
    }
  }
}

const GHOST_DX = 0.66;
// the gaze: each eye bone's local +Y points out of the eye; it is turned toward the shot's gaze target (clamped to
// what an eye can do), with small saccades (seeded, so renders repeat). Runs after the mixer, which resets the bones.
const _e = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _id = new THREE.Quaternion();
function aimEyes(root, target, t, k = 1) {
  const b = bones(root);
  const sacc = Math.floor(t * 1.4), jit = (n) => { const x = Math.sin((sacc * 7 + n) * 91.7) * 43758.5; return (x - Math.floor(x) - 0.5) * 0.012; };
  const tg = target.clone().add(new THREE.Vector3(jit(1), jit(2), jit(3)));
  for (const n of ['LeftEye', 'RightEye']) {
    const o = b[n]; if (!o) continue;
    touch(o); root.updateMatrixWorld(true);
    o.getWorldPosition(_e); const wq = o.getWorldQuaternion(new THREE.Quaternion());
    _f.set(0, 1, 0).applyQuaternion(wq);
    const d = tg.clone().sub(_e).normalize();
    _q.setFromUnitVectors(_f, d);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(_q.w))), lim = THREE.MathUtils.degToRad(26);
    if (ang > lim) _q.slerpQuaternions(_id, _q, lim / ang);                     // an eye turns ~26 degrees; the head does the rest
    if (k < 1) _q.slerpQuaternions(_id, _q, k);
    o.parent.getWorldQuaternion(_pq);
    o.quaternion.copy(_pq.invert().multiply(_q.clone().multiply(wq)));
    o.updateMatrixWorld(true);
  }
}
function gazePoint(g, t, ctx) {
  if (Array.isArray(g) && Array.isArray(g[0])) {                                   // keyed [[t, target], ...]
    let i = 1; while (i < g.length && t > g[i][0]) i++;
    if (i >= g.length) return gazePoint(g[g.length - 1][1], t, ctx);
    if (t <= g[0][0]) return gazePoint(g[0][1], t, ctx);
    const u = sm((t - g[i - 1][0]) / (g[i][0] - g[i - 1][0]));
    return gazePoint(g[i - 1][1], t, ctx).lerp(gazePoint(g[i][1], t, ctx), u);
  }
  if (Array.isArray(g)) return B(...g);
  if (g === 'phone' && phone && phone.visible) return phone.getWorldPosition(new THREE.Vector3());
  if (g === 'claude' && claude && claude.group.visible) return claude.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.04, 0));
  if (g === 'cam' && ctx.camera) return ctx.camera.position.clone();
  if (g === 'monitor') return B(1.58, 4.46, 1.0);
  return B(1.05, 4.46, 0.94);                                                       // 'screen' (the laptop)
}

// sit back: the spine bends back about the same local axis the head lifts on (deg spread over three bones)
function leanBack(root, deg) {
  const b = bones(root);
  for (const [n, k] of [['Spine', 0.4], ['Spine1', 0.35], ['Spine2', 0.25]]) { const o = b[n]; if (!o) continue; touch(o); o.rotateZ(THREE.MathUtils.degToRad(deg * k)); }
  root.updateMatrixWorld(true);
}
// hands laced behind his head (V29 "exhausted and wired"): both hands IK'd to the back of the skull, elbows out wide,
// fingers softly interlaced; w blends it in (0..1) so the animated rise into it has no pop
function handsBehindHead(root, w = 1) {
  const b = bones(root), head = b.Head; if (!head || w <= 0) return;
  root.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new THREE.Vector3());
  const yaw = root.rotation.y - (root.userData.home ? root.userData.home.r : 0);
  const fwd = B(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw), up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? -1 : 1, S = side === 'L' ? 'Left' : 'Right';
    const tgt = hp.clone().addScaledVector(fwd, -0.09).addScaledVector(right, 0.075 * sg).addScaledVector(up, -0.02);   // round 13: at ear level (was above: the shoulders went past where the shirt deforms well)
    const cur = b[S + 'Hand'].getWorldPosition(new THREE.Vector3());
    reach(root, side, cur.lerp(tgt, w), right.clone().multiplyScalar(sg).addScaledVector(up, 0.08).addScaledVector(fwd, 0.45).normalize());   // elbows out and a little forward
    curlAnat(root, side, { Index: [20, 35, 20].map((d) => d * w), Middle: [22, 38, 22].map((d) => d * w), Ring: [24, 40, 22].map((d) => d * w), Pinky: [26, 42, 24].map((d) => d * w) }, [10 * w, 10 * w, 6 * w]);
  }
}

// both forearms along the chair's arms, hands resting over their front ends, fingers loose
const ARMREST = { L: [0.94, 4.34, 0.68], R: [1.15, 4.34, 0.68] };   // forward on the thighs: the elbows bend, the arms rest   // hands together, resting in his lap   // the chair has no arms: hands rest on his thighs
function armsOnChair(root, sides = ['L', 'R']) {
  for (const side of sides) {
    const out = new THREE.Vector3(side === 'L' ? -1 : 1, 0, 0);
    reach(root, side, B(...ARMREST[side]), new THREE.Vector3(0, -0.8, 0.3).addScaledVector(out, 0.9).normalize());   // elbows soft, out to the sides
    curlAnat(root, side, { Index: [14, 22, 12], Middle: [16, 26, 14], Ring: [20, 30, 16], Pinky: [24, 32, 18] }, [6, 10, 6]);   // relaxed, draped over the knee
  }
}

// the glass of water (K03, K04, K47), after a real tumbler (director's ref): the room's glass was a 7%-opacity film and
// its water a frosted transmission blob (roughness 0.7), so it read as a glowing haze. Here (kf1 only, at runtime):
// the water is clear (it refracts what is behind it), the glass is a Fresnel shell (invisible face-on, strong at the
// walls' grazing edges), with a crisp rim, a thick base and a bright meniscus line where the water meets the glass.
function fresnelGlass(base = 0.03, edge = 0.8, pow = 2.6) {
  // depthWrite on: the lens blur reads depth, and a glass that writes none is blurred like the wall behind it
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, depthWrite: true,
    side: THREE.DoubleSide, envMapIntensity: 1.6, specularIntensity: 1, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      `#include <opaque_fragment>
      float fr = pow(max(0.0, 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)))), ${pow.toFixed(2)});   // max: pow of a tiny negative is NaN (a black block once the blur spreads it)
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.55, fr * 0.5);
      gl_FragColor.a = clamp(${base.toFixed(3)} + ${edge.toFixed(3)} * fr, 0.0, 1.0);`);
  };
  return m;
}
function refineGlass(named, scene) {
  const G = named.Water_Glass, W = named.Water;
  if (!G || !W) return;
  G.updateWorldMatrix(true, false); W.updateWorldMatrix(true, false);
  const gb = new THREE.Box3().setFromObject(G), wb = new THREE.Box3().setFromObject(W);
  const c = gb.getCenter(new THREE.Vector3()), r = (gb.max.x - gb.min.x) / 2, wr = (wb.max.x - wb.min.x) / 2;
  G.material = fresnelGlass(0.035, 0.85, 2.6); G.renderOrder = 3;
  Object.assign(W.material, { roughness: 0.03, transmission: 1, thickness: 0.075, ior: 1.33, color: new THREE.Color(1, 1, 1),
    attenuationColor: new THREE.Color(0.86, 0.95, 1.0), attenuationDistance: 0.35, specularIntensity: 1, envMapIntensity: 1.2 });
  W.material.needsUpdate = true;
  const add = (geo, mat, y, rx = Math.PI / 2) => { const o = new THREE.Mesh(geo, mat); o.position.set(c.x, y, c.z); o.rotation.x = rx; o.renderOrder = 4; o.name = 'Glass detail'; scene.add(o); (G.userData.details ||= []).push(o); return o; };   // (round 13: they hide with the glass)
  const rimM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.55, depthWrite: true, envMapIntensity: 2, clearcoat: 1 });
  add(new THREE.TorusGeometry(r - 0.0012, 0.0013, 8, 64), rimM, gb.max.y - 0.0008);                                   // the lip
  const baseM = fresnelGlass(0.12, 0.8, 1.8);
  add(new THREE.CylinderGeometry(r - 0.003, r - 0.004, 0.011, 48), baseM, gb.min.y + 0.0055, 0);                      // the heavy base
  // the meniscus: one crisp bright line where the water climbs the wall (round 14: a little stronger, so with s03's
  // opaque ring gone the glass still reads full). Transparent, so the water's refraction never draws it a second time.
  // (renderOrder 2, before the glass: the shell writes depth and drawn after it the line failed the depth test; it
  // writes depth itself, or the lens blur smears it like the wall behind)
  add(new THREE.TorusGeometry(wr - 0.0004, 0.00035, 6, 128),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.92, 1.0), transparent: true, opacity: 0.42, depthWrite: true }), wb.max.y - 0.0003).renderOrder = 2;
}

// a prop in his hand: two-bone IK to a point (the mouth, the chest, the phone's place, or a mark), then the prop
function holdProp(s, who, ctx, t = 0) {
  mug.visible = false; phone.visible = false; mugGhosts.forEach((g) => (g.visible = false));
  const h = s.hand; if (!h || !who || s.black) return;
  const b = bones(who), head = b.Head; if (!head) return;
  who.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new THREE.Vector3());
  const yaw = who.rotation.y - (who.userData.home ? who.userData.home.r : 0);
  const fwd = B(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);       // the way he faces (north = desk)
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const side = h.side === 'L' ? -1 : 1;
  const pole = new THREE.Vector3(0, -1, 0).add(right.clone().multiplyScalar(0.7 * side)).add(fwd.clone().multiplyScalar(-0.2)).normalize();

  if (h.prop === 'mug') {
    // the mug is placed first (rim at the lips for a sip, at chest height to hold), then the hand reaches its side
    let c, tilt = 0;
    if (h.sip) {
      // a sip, keyed: k = 1 at the lips (tipped), 0 held at the chest; the hand follows the mug (IK below)
      const k = keyedP(h.sip.map(([kt, v]) => [kt, [v]]), t)[0];
      const mouth = hp.clone().addScaledVector(fwd, 0.105).addScaledVector(up, -0.015);
      const lip = mouth.clone().addScaledVector(fwd, 0.042).addScaledVector(up, -0.03).addScaledVector(right, 0.012 * side);
      const chest = hp.clone().addScaledVector(fwd, 0.22).addScaledVector(up, -0.36).addScaledVector(right, 0.07 * side);
      c = chest.lerp(lip, k).addScaledVector(right, (h.lat || 0) * side); tilt = 0.55 * k;   // lat: held further out to his side (K40)
    } else if (h.to === 'mouth') {
      const mouth = hp.clone().addScaledVector(fwd, 0.105).addScaledVector(up, -0.015);       // lips: in front of and level with the Head bone
      c = mouth.clone().addScaledVector(fwd, 0.042).addScaledVector(up, -0.03).addScaledVector(right, 0.012 * side);
      tilt = 0.55;                                                                              // top tipped toward the mouth
    } else if (h.to === 'chest') {
      c = hp.clone().addScaledVector(fwd, 0.24).addScaledVector(up, -0.40).addScaledVector(right, 0.08 * side);
    } else c = B(...h.to);
    if (h.shake) { const w = (f, p) => Math.sin(t * f + p); c.add(new THREE.Vector3(w(53, 0) * 0.0016 + w(19, 1) * 0.0012, w(61, 1) * 0.0012 + w(23, 2) * 0.001, w(47, 2) * 0.0016 + w(17, 3) * 0.0012)); }   // caffeine tremor: ~8-10 Hz shiver over a slower 3 Hz waver (round 12: the 7 Hz aliasing read as jumps)
    const toward = fwd.clone().negate();                                                         // the mug leans back toward him
    const axis = up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(toward, Math.sin(tilt)).normalize();
    mug.visible = true;
    mug.position.copy(c);
    // a natural sip (drinking kinematics: elbow flexed ~135 deg, upper arm raised ~55 deg forward, not out to the side,
    // wrist neutral, in line with the forearm): the arm reaches with the elbow down and forward, the fingers continue
    // the forearm, and the MUG turns about its own axis so its handle loop meets the fingers (index and middle through
    // the loop, thumb on top, ring and pinky curled under), instead of bending the wrist to fit the mug
    const S = h.side === 'L' ? 'Left' : 'Right', fa = b[S + 'ForeArm'], hb = b[S + 'Hand'];
    const sipPole = new THREE.Vector3(0, -1, 0).addScaledVector(fwd, 0.55).addScaledVector(right, 0.35 * side).normalize();
    const W = (o) => o.getWorldPosition(new THREE.Vector3());
    const X = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4();
    let wrist = c.clone().addScaledVector(right, 0.085 * side).addScaledVector(up, -0.06).addScaledVector(fwd, -0.03), fingerDir = fwd.clone();
    for (let it = 0; it < 6; it++) {
      reach(who, h.side, wrist, sipPole);
      const F = W(hb).sub(W(fa)).normalize();                                                   // the forearm's line
      fingerDir = F.clone().addScaledVector(axis, -F.dot(axis)).normalize();                    // ... across the mug's axis
      X.copy(W(hb)).sub(c); X.addScaledVector(axis, -X.dot(axis)).addScaledVector(fingerDir, -X.dot(fingerDir)).normalize();   // handle toward the hand
      Z.crossVectors(X, axis).normalize();
      mug.quaternion.setFromRotationMatrix(M.makeBasis(X, axis, Z));                            // +x handle, +y axis, loop along z
      mug.updateMatrixWorld(true);
      orientHand(who, h.side, fingerDir.clone().addScaledVector(axis, -0.18).normalize(), axis);
      const hole = mug.localToWorld(new THREE.Vector3(0.058, 0.004, 0));
      const gp = gripPoint(who, h.side); if (!gp) break;
      wrist.add(hole.sub(gp));                                                                  // move the wrist by the miss
    }
    reach(who, h.side, wrist, sipPole);
    orientHand(who, h.side, fingerDir.clone().addScaledVector(axis, -0.18).normalize(), axis);
    // index and middle through the loop and round it; ring and pinky tucked under; the thumb laid along the top
    curlAnat(who, h.side, { Index: [30, 62, 45], Middle: [34, 66, 48], Ring: [62, 80, 55], Pinky: [66, 82, 55] }, h.thumb || [8, 22, 16]);
    // (round 11: no ghost mugs: they read as a hat on the mug. The tremor is in the mug's position, see `shake` above)
    return;
  }
  let target;
  if (h.to === 'chest') target = hp.clone().add(fwd.clone().multiplyScalar(0.20)).add(new THREE.Vector3(0, -0.36, 0)).add(right.clone().multiplyScalar(0.10 * side));
  else if (h.to === 'phone') target = hp.clone().add(fwd.clone().multiplyScalar(0.26)).add(new THREE.Vector3(0, -0.12, 0)).add(right.clone().multiplyScalar(0.07 * side));
  else target = B(...h.to);
  reach(who, h.side, target, pole);
  if (h.prop === 'phone') {
    // the phone grip (director's refs: a phone held up to read / talk): the phone is placed first, in front of the chin,
    // screen tilted to the eyes; its back lies across the palm, the forearm comes up from below, the fingers run across
    // the back and curl round the far edge onto the front, the thumb rests on the near edge
    const eye = hp.clone().addScaledVector(fwd, 0.09).addScaledVector(up, 0.07);
    const P0 = h.to === 'phone' ? eye.clone().addScaledVector(fwd, 0.27).addScaledVector(up, -0.17).addScaledVector(right, 0.03 * side) : target.clone();
    const n = eye.clone().sub(P0).normalize();                                   // the screen faces his eyes
    const u = up.clone().addScaledVector(n, -up.dot(n)).normalize();             // the phone's long axis, upright on the screen plane
    const rp = right.clone().addScaledVector(n, -right.dot(n)).normalize();
    // the fingers continue the forearm (a wrist barely bends sideways), turned a little across the back of the phone
    const across = rp.clone().multiplyScalar(-side);
    const spin = new THREE.Vector3().crossVectors(across, u).normalize();              // rotates across -> u (palm to his face)
    const S2 = h.side === 'L' ? 'Left' : 'Right', foB = b[S2 + 'ForeArm'], haB = b[S2 + 'Hand'];
    let fingerDir = u.clone().addScaledVector(across, 0.6).normalize();
    const palmAt = P0.clone().addScaledVector(n, -0.019).addScaledVector(u, -0.04);
    const sipPole = new THREE.Vector3(0, -1, 0).addScaledVector(right, 0.6 * side).addScaledVector(fwd, -0.2).normalize();
    let wrist = palmAt.clone().addScaledVector(up, -0.07).addScaledVector(fwd, -0.02);
    for (let it = 0; it < 6; it++) {
      reach(who, h.side, wrist, sipPole);
      const F = haB.getWorldPosition(new THREE.Vector3()).sub(foB.getWorldPosition(new THREE.Vector3())).normalize();
      const Fp = F.clone().addScaledVector(n, -F.dot(n)).normalize();
      fingerDir = Fp.clone().addScaledVector(across, 0.45).normalize();
      orientHand(who, h.side, fingerDir, new THREE.Vector3().crossVectors(spin, fingerDir).normalize());
      const PF = palmFrame(who, h.side); if (!PF) break;
      wrist.add(palmAt.clone().sub(PF.centre));
    }
    reach(who, h.side, wrist, sipPole); orientHand(who, h.side, fingerDir, new THREE.Vector3().crossVectors(spin, fingerDir).normalize());
    curlAnat(who, h.side, { Index: [22, 48, 30], Middle: [26, 52, 32], Ring: [30, 56, 34], Pinky: [36, 60, 36] }, [14, 12, 8]);
    CH1.phone(phoneG, h.ph ?? 47); phone.userData.tex.needsUpdate = true;
    phone.visible = true;
    phone.position.copy(P0); phone.up.copy(u); phone.lookAt(P0.clone().add(n));
  } else grip(who, h.side, 52);
}

// ---------------------------------------------------------------- moving a held pose: place = { at: [x, y], yaw: deg }
// Every performance was made at the flat's desk and moved here by CAST_OFFSET; a placed figure is turned about its
// chair point (the flat's 6.95, 2.60) and set down at 'at'. yaw 90 turns him from the desk (north) to the window (west).
const CHAIR_LOCAL = [6.95, 2.60];
function place(root, pl) {
  if (!root.userData.home) root.userData.home = { p: root.position.clone(), r: root.rotation.y };
  const h = root.userData.home;
  if (!pl) { root.position.copy(h.p); root.rotation.y = h.r; root.updateMatrixWorld(true); return; }
  const th = THREE.MathUtils.degToRad(pl.yaw || 0);
  const c = B(CHAIR_LOCAL[0], CHAIR_LOCAL[1], 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), h.r + th);
  root.rotation.y = h.r + th;
  root.position.copy(B(pl.at[0], pl.at[1], pl.at[2] || 0)).sub(c);
  root.updateMatrixWorld(true);
}
