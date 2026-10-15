// Scene 4, "Two days ago": the Chapter 1 flashback (scenes/04-two-days-ago/DIRECTION.md), V08-V11 of the Ch 1
// voiceover package. The set, the look and the live rig are Ivan's room (s03), unchanged; this scene adds the day,
// a new performance, the chat lifting off the screen, Claude's spark, and the smash back to 3 AM.
//   http://localhost:8080/engine/index.html?scene=s04
// The voiceover is the clock. Scene time 0 = chapter 36.96 s (the end of V07b, where scene 3 ends); every time in
// this file is scene time, with the chapter time in the comments. Until the VO clips arrive the sound is the
// package's no-VO sound design for 36.96-68.28 (sound.wav); the lines are the captions.
import * as THREE from 'three';
import { B, cameraIn, shotIn } from '../../src/shots.js';
import { smooth } from '../../src/screens.js';
import * as ROOM3 from '../s03/scene.js';
import { createRoomLight, weightsFor } from '../s03/roomlight.js';
import { SCREENS as CH1 } from '../ch1/screens.js';
export { LOOKS, LOOK_NAME } from '../s03/looks.js';

export const FPS = 24;
export const DURATION = 31.32;                 // chapter 36.96 -> 68.28 (V12, the cheat code, starts the next scene)
export const VO_OFFSET = 0.0;
export const CHAPTER_T0 = 36.96;
export const VOICEOVER = 'scenes/s04/sound.wav';
export const ROOM = ROOM3.ROOM;
export const IVAN = 'scenes/s04/ivan.glb';     // acting.py SCENE_S04, prep_tripo.py --scene s04
export const ACTING = 'scenes/s04/acting.json';
export const CAST_OFFSET = ROOM3.CAST_OFFSET;
export const ENV_AT = ROOM3.ENV_AT;
export const DUST = ROOM3.DUST;
export const createLights = ROOM3.createLights;
export const tweakMaterial = ROOM3.tweakMaterial;

// marks in the room (Blender metres): his face seated, the laptop keys, the sticky note on the back of the lid, the
// floating chat card (above the glass, left of the laptop, at his eye line) and where Claude's spark hangs
const KEYS = [1.10, 4.33, 0.765];
const NOTE = [1.12, 4.489, 0.925];
const CARD = [0.64, 4.16, 1.30];
const CARD_FACES = [1.17, 3.53, 1.33];         // turned to the reading shot (B05)
const SPARK = [1.05, 4.30, 1.20];             // in front of his face, above the laptop lid
const NIGHT = 26.72;                           // V11's sub drop: smash back to 3 AM

// One move per shot, real lenses, keyed focus. Light fields use the room's times of day (s03/roomlight.js).
export const SHOTS = [
  { id: 'B01', name: 'Two days ago', t0: 0, t1: 4.92, mm: [24, 24], f: 4,
    from: [3.70, 2.70, 1.55], to: [3.66, 2.72, 1.55], at0: [0.60, 3.60, 1.05], at1: [0.60, 3.60, 1.05], focus: 'eyes', roll: [0, 0],
    light: '3am -> day (blend 0.6-3.6)',
    why: 'Locked wide from the door wall, window left, desk right. Time told by light alone: the night drains out of the same room and it is two days earlier. The night drains out of him too: he straightens up. "It started two days ago."' },
  { id: 'B02', name: 'Drowning', t0: 4.92, t1: 10.0, mm: [35, 35], f: 2,
    from: [2.15, 3.95, 0.98], to: [2.08, 3.93, 0.97], at0: [1.02, 3.90, 1.08], at1: [1.02, 3.88, 1.08], track: 0.7, focus: 'eyes', roll: [0.4, 0.2],
    light: 'day',
    why: 'Low from the desk end, the day window blown out behind him. He types the first sentence, then shoves back from the desk, hands behind his head, and looks at the ceiling. A normal guy having a bad inbox day.' },
  { id: 'B03', name: 'Send', t0: 10.0, t1: 13.5, mm: [50, 50], f: 2,
    from: [1.30, 3.78, 1.30], to: [1.27, 3.84, 1.28], at0: 'lap:1060,330', at1: 'lap:1060,340', focus: 'lap:1000,300', roll: [-0.5, -0.3],
    light: 'day',
    why: 'Over his right shoulder onto the laptop: "i\'m fucking drowning here!" typed hard into a new Claude chat, and Enter. The macro insert gives the line a physical action.' },
  { id: 'B04', name: 'Hello, Claude', t0: 13.5, t1: 18.6, mm: [40, 40], f: 2.2,
    from: [1.70, 4.08, 1.18], to: [1.67, 4.08, 1.18], at0: [1.05, 4.12, 1.16], at1: [1.05, 4.12, 1.16],
    focus: [[13.5, 'eyes'], [13.75, 'eyes'], [14.1, SPARK], [14.9, SPARK], [15.4, 'eyes']], roll: [0.3, 0.1],
    light: 'day',
    why: 'A profile two-shot from his right (board A r3c1): on the chime Claude\'s spark rises out of the laptop into the space in front of his face. He sits back and looks up at it; focus goes to it, then back to him as he lets out a breath. Claude is friendly before it is anything else.' },
  { id: 'B05', name: 'The offer', t0: 18.6, t1: 23.0, mm: [30, 30], f: 2,
    from: [1.16, 3.70, 1.28], to: [1.13, 3.75, 1.28], at0: CARD, at1: CARD, focus: CARD, roll: [-0.3, -0.2],
    light: 'day',
    why: 'Behind his right shoulder onto the chat floating beside him (board A, "complaining to claude"). We read the offer with him; the little pipeline sketch draws itself: inbox, sort, draft, you.' },
  { id: 'B06', name: 'yes', t0: 23.0, t1: 26.72, mm: [60, 60], f: 2.8,
    from: [1.40, 4.02, 1.02], to: [1.39, 4.04, 1.01], at0: [1.06, 4.33, 0.80], at1: [1.07, 4.33, 0.80], focus: [1.08, 4.28, 0.79], roll: [0, 0],
    light: 'day',
    why: 'Macro on the keyboard, the night\'s "saying yes" frame in daylight. "Want me to build one?" His hands come back to the keys: y, e, s, Enter. The first yes.' },
  { id: 'B07', name: 'The plan', t0: 26.72, t1: 31.32, mm: [70, 70], f: 2,
    from: [1.13, 4.87, 0.94], to: [1.12, 4.80, 0.945], at0: [1.12, 4.489, 0.915], at1: [1.07, 4.23, 1.07],
    focus: [[26.72, NOTE], [29.9, NOTE], [30.7, 'eyes']], roll: [0, 0],
    light: '3am',
    why: 'Smash back to 3 AM on the sub drop. The sticky note on the back of his laptop: REVIEW + APPROVE. It holds through "Review and approve", then the focus slips off it to his face. He is not looking at it.' },
];
export const shotAt = (t) => shotIn(SHOTS, t);
export const cameraAt = (t, pick) => cameraIn(SHOTS, t, pick);

// the lines (VO package timeline, planned clip lengths). V09 and V10 are split at estimated sentence breaks; re-lock
// them when the clips are measured.
export const CAPTIONS = [
  [1.60, 3.92, 'It started two days ago.'],
  [4.92, 9.40, 'IVAN: i have like 400 unread emails. every single one wants a reply.'],
  [9.90, 12.92, "IVAN: i'm fucking drowning here!"],
  [13.82, 17.40, "CLAUDE: That sounds genuinely exhausting - and you're definitely not alone!"],
  [17.90, 22.00, 'CLAUDE: I can write a script that sorts your inbox and drafts the replies for you.'],
  [22.40, 25.42, 'CLAUDE: You just review and approve. Want me to build one?'],
  [26.72, 28.30, 'That was the plan.'],
  [28.90, 30.32, 'Review and approve.'],
];

// ---------------------------------------------------------------- screens: Chapter 1's own, on this clock
// ch1/screens.js already draws this afternoon (the inbox, the chat, the reply, 'yes') on the chapter plan's estimated
// clock. Scene time maps onto that clock at the moments that matter, so the screens land on the VO:
//   [scene t, plan t]: the light reversal, his two sentences, Send, Claude's three sentences, 'yes', Enter
const MAP = [[0, 37.0], [0.6, 38.0], [3.6, 40.4], [5.0, 41.8], [8.6, 45.4], [10.4, 45.7], [12.8, 47.2], [13.0, 47.6],
  [13.82, 48.6], [17.4, 51.8], [17.9, 52.7], [22.0, 57.8], [22.4, 58.1], [25.42, 61.6], [25.7, 61.62], [26.15, 62.2],
  [26.3, 62.35], [26.719, 62.7]];
export function planT(t) {
  if (t >= NIGHT) return 31.4 + (t - NIGHT);                 // back at 3 AM: the plan's A08-A09 (Claude writing, y/n)
  for (let i = 1; i < MAP.length; i++) {
    const [a, pa] = MAP[i - 1], [b, pb] = MAP[i];
    if (t <= b) return pa + (pb - pa) * Math.max(0, (t - a) / (b - a));
  }
  return MAP[MAP.length - 1][1];
}
const chatCanvas = document.createElement('canvas'); chatCanvas.width = 1200; chatCanvas.height = 800;
const chatG = chatCanvas.getContext('2d');
function drawChat(t) { CH1.card(chatG, planT(t)); return chatCanvas; }
const dayK = (t) => (t >= NIGHT ? 0 : smooth((t - 0.6) / 3.0));

export const SCREENS = {
  // the inbox fills the screen; a new Claude chat sits over it, the same conversation as the floating card
  laptop(g, t, keys = []) {
    const p = planT(t);
    CH1.laptop(g, p, keys);
    const k = t < NIGHT ? smooth((t - 3.0) / 1.2) : 0;
    if (k <= 0) return;
    g.save(); g.globalAlpha = k;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(574, 166, 1000, 700);          // the window's shadow
    g.fillStyle = '#d9d4c7'; g.fillRect(560, 120, 1000, 34);                    // title bar
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(582 + i * 24, 137, 7, 0, 7); g.fill(); });
    g.drawImage(drawChat(t), 560, 154, 1000, 667);
    g.restore();
  },
  monitor(g, t) { return CH1.monitor(g, planT(t)); },
  phone(g) { g.fillStyle = '#000'; g.fillRect(0, 0, 720, 1560); },              // face down, out of this scene
};

// ---------------------------------------------------------------- set-up: times of day, the card, the spark, the note
let RL = null, card = null, spark = null, note = null, rig = null;
export async function setup(args) {
  ROOM3.setup(args);
  RL = await createRoomLight({ ...args, volume: ROOM3.VOLUME });
  const { scene, L } = args;
  rig = { L, lamp: {}, monitor: {}, screens: (L.screens || []).map(() => ({})), glow: [] };
  // the practicals' own glow (the table lamp's shade and bulb, the arm lamp): off in the afternoon with their light
  args.root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const m = o.material;
    if (/^(desk_lamp_arm_01_light|Lamp_Bulb|Lamp Shade)$/.test(m.name) && !rig.glow.some((x) => x.m === m)) rig.glow.push({ m, st: {} });
  });

  // the chat card: a screen with nothing around it, in the room (parallax, depth of field, bloom). It writes depth, so
  // the lens can focus on it (WORKFLOW lesson 6); the corners are cut by alphaTest.
  const tex = new THREE.CanvasTexture(chatCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mask = document.createElement('canvas'); mask.width = 120; mask.height = 80;
  const mg = mask.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, 120, 80); mg.fillStyle = '#fff';
  mg.beginPath(); mg.roundRect(1, 1, 118, 78, 6); mg.fill();
  const alpha = new THREE.CanvasTexture(mask);
  card = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), new THREE.MeshBasicMaterial({ map: tex, alphaMap: alpha,
    alphaTest: 0.5, color: new THREE.Color(1.15, 1.15, 1.15), side: THREE.DoubleSide, toneMapped: true }));
  card.position.copy(B(...CARD)); card.lookAt(B(...CARD_FACES)); card.visible = false; card.name = 'Chat card';
  card.userData.tex = tex; scene.add(card);

  // Claude's spark (board A r3c1: the small glowing character): a warm starburst that pops out of the laptop on the
  // chime, hangs by his face, and drifts into the chat card as the offer starts. A small warm light goes with it.
  // It writes depth (alphaTest, no blending) so the lens focuses on it where it is, not on the wall behind it; its
  // glow comes from the bloom on its HDR colour, not from a halo sprite.
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const g = sc.getContext('2d');
  g.translate(128, 128); g.lineCap = 'round';
  for (let i = 0; i < 10; i++) {                       // ten rounded rays, alternating long and short
    const r = i % 2 ? 70 : 112; g.rotate(Math.PI / 5);
    g.strokeStyle = '#ffd43b'; g.lineWidth = 26; g.beginPath(); g.moveTo(0, 16); g.lineTo(0, r); g.stroke();
  }
  g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, color: new THREE.Color(2.4, 2.1, 1.7), alphaTest: 0.5,
    transparent: false, depthWrite: true, toneMapped: true }));
  spark.userData.base = spark.material.color.clone();
  spark.scale.setScalar(0.09); spark.visible = false; spark.name = 'Claude spark';
  spark.userData.light = new THREE.PointLight(0xffb36b, 0, 0.9, 2);
  scene.add(spark, spark.userData.light);

  // REVIEW + APPROVE on the back of the laptop lid (s02's note, moved into this room; the lid leans 20 degrees back)
  const nc = document.createElement('canvas'); nc.width = nc.height = 256;
  const n = nc.getContext('2d');
  n.fillStyle = '#f2d35b'; n.fillRect(0, 0, 256, 256); n.fillStyle = 'rgba(0,0,0,0.06)'; n.fillRect(0, 0, 256, 34);
  n.fillStyle = '#23201a'; n.textAlign = 'center'; n.font = 'bold 50px "Marker Felt", "Comic Sans MS", sans-serif';
  n.fillText('REVIEW', 128, 112); n.font = 'bold 44px "Marker Felt", "Comic Sans MS", sans-serif'; n.fillText('+ APPROVE', 128, 172);
  n.strokeStyle = '#23201a'; n.lineWidth = 4; n.beginPath(); n.moveTo(48, 196); n.quadraticCurveTo(128, 210, 208, 192); n.stroke();
  const ntex = new THREE.CanvasTexture(nc); ntex.colorSpace = THREE.SRGBColorSpace; ntex.anisotropy = 8;
  note = new THREE.Mesh(new THREE.PlaneGeometry(0.076, 0.076), new THREE.MeshStandardMaterial({ map: ntex, roughness: 0.8 }));
  const a20 = 20 * Math.PI / 180, nrm = [0, Math.cos(a20), -Math.sin(a20)];
  note.position.copy(B(NOTE[0] + nrm[0] * 0.003, NOTE[1] + nrm[1] * 0.003, NOTE[2] + nrm[2] * 0.003));
  note.lookAt(note.position.clone().add(B(...nrm))); note.rotateZ(-0.05);
  note.receiveShadow = true; note.visible = false; note.name = 'Sticky note'; scene.add(note);
}

// the engine asks for the exposure first in every frame, so the light is set here: the room's lightmaps and window
// by the shot's light field, and the live rig by how much night is left (the desk lamp is off in the afternoon, the
// screens are a weak fill next to the sun)
export function exposureBoost(t) {
  if (!RL) return 0;
  const s = shotAt(t), w = weightsFor(s.light, t, s.t0, s.t1);
  RL.apply(w);
  const night = w['3am'] || 0;
  if (rig) {
    follow(rig.L, 'lampBase', rig.lamp, night);
    if (rig.L.monitor) follow(rig.L.monitor, 'intensity', rig.monitor, 0.3 + 0.7 * night);
    (rig.L.screens || []).forEach((x, i) => follow(x.s, 'intensity', rig.screens[i], 0.4 + 0.6 * night));
    for (const x of rig.glow) follow(x.m, 'emissiveIntensity', x.st, night);
  }
  return RL.exposure;
}
// scale a light by the time of day without fighting the Look editor or the sliders: they write absolute values, so a
// value that changed since we last wrote it becomes the new night level
function follow(o, key, st, k) {
  if (st.w === undefined || Math.abs(o[key] - st.w) > 1e-6) st.base = o[key];
  o[key] = st.w = st.base * k;
}

// what is in the room when: the glass is not poured yet in the afternoon; the card and the spark live between his
// message and the smash cut; the note is the promise, seen only at 3 AM. Plus scene 3's wild wall and ceiling.
export function props(t, ctx) {
  ROOM3.props(t, ctx);
  const { named } = ctx;
  const day = dayK(t) > 0.5;
  for (const k of ['Water', 'Water_Bubbles', 'Water_Glass']) if (named[k]) named[k].visible = !day;
  if (card) {
    const on = new URLSearchParams(location.search).get('card') !== '0' && t >= 10.2 && t < NIGHT;
    card.visible = on;
    if (on) {
      const pop = smooth((t - 10.2) / 0.4);                  // a 10-frame ease-out pop, no overshoot
      card.scale.setScalar(0.85 + 0.15 * pop); card.material.opacity = pop;
      drawChat(t); card.userData.tex.needsUpdate = true;
      card.position.copy(B(CARD[0], CARD[1], CARD[2] + 0.004 * Math.sin(t * 1.3)));   // it floats, barely
    }
  }
  if (spark) {
    const t0 = 13.67, t1 = 18.6;                             // the friendly chime -> the offer
    const on = t >= t0 && t < t1;
    spark.visible = on;
    const L = spark.userData.light;
    if (!on) { L.intensity = 0; } else {
      const out = smooth((t - t0) / 0.5), into = smooth((t - 17.8) / 0.8);
      const from = B(1.05, 4.42, 0.95), hang = B(...SPARK), to = B(...CARD);
      const bob = new THREE.Vector3(0, 0.008 * Math.sin((t - t0) * 2 * Math.PI * 0.8), 0);
      spark.position.copy(from).lerp(hang, out).lerp(to, into).add(bob);
      spark.scale.setScalar(0.09 * (0.3 + 0.7 * out) * (1 - 0.8 * into));
      spark.material.rotation = 0.25 * (t - t0);
      spark.material.color.copy(spark.userData.base).multiplyScalar(out * (1 - into));   // fades by brightness
      L.position.copy(spark.position); L.intensity = 0.35 * out * (1 - into);
    }
  }
  if (note) note.visible = t >= NIGHT;
}
