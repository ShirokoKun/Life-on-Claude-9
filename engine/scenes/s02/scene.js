// Scene 2, "The cheat code" (scenes/02-cheat-code/STORYBOARD.md). 74 s, timed to an estimated read until the
// voiceover arrives. Same flat, same look, same Ivan; new: times of day, a standing Ivan in the doorway,
// scene-specific screens, a spinning wall clock, frozen air.
//   http://localhost:8080/index.html?scene=s02
import { B, cameraIn, shotIn } from '../../src/shots.js';
import { C, MONO, SANS, rr, wrap, drawCode, smooth, keysIn, drawMonitor as pipelineMonitor } from '../../src/screens.js';

export const FPS = 24;
export const DURATION = 74;
export const VO_OFFSET = 0.0;
export const VOICEOVER = null;            // scenes/s02/voiceover.wav when it arrives
export const IVAN = 'scenes/s02/ivan.glb';
export const ACTING = 'scenes/s02/acting.json';
export const CAST = [{ url: 'scenes/s02/ivan_stand.glb', t0: 65, t1: 74 }];   // the doorway
export const ivanVisible = (t) => t < 65;
export const SETS = ['3am', 'day', 'evening', 'sunrise'];
export const FADE_OUT = false;                 // it ends on white, not black

const FACE = [6.94, 2.72, 1.12];
const NOTE = [7.02, 3.259, 0.925];          // REVIEW + APPROVE, high on the back of the laptop lid (it leans 20° back)
const CLOCK = [6.95, 2.21, 1.78];
const DOOR = [4.75, 5.43, 1.25];

export const SHOTS = [
  { id: '2.1', name: 'Two days ago', t0: 0, t1: 4, mm: [24, 25], f: 2.8,
    from: [9.60, 4.30, 1.90], to: [9.52, 4.22, 1.87], at0: [7.0, 3.0, 1.0], at1: [7.0, 3.0, 1.0], focus: 'eyes', roll: [-0.5, -0.4],
    why: 'The intro\'s wide, held. The night drains out of the room and daylight comes back: two days earlier.' },
  { id: '2.2', name: 'Hundreds a day', t0: 4, t1: 9.5, mm: [35, 40], f: 2.8,
    from: [7.32, 2.22, 1.36], to: [7.24, 2.36, 1.31], at0: [6.95, 3.25, 0.86], at1: [6.95, 3.24, 0.87], focus: 'lap:600,400', roll: [0.5, 0.2],
    why: 'Over his shoulder: the inbox fills faster than he can scroll it. The monitor beside it: a calendar packed solid.' },
  { id: '2.3', name: 'Too much', t0: 9.5, t1: 12.5, mm: [45, 48], f: 2.4,
    from: [7.05, 3.70, 1.24], to: [7.04, 3.64, 1.23], at0: FACE, at1: FACE, track: 0.6, focus: 'eyes', roll: [0.3, 0.2],
    why: 'He sits back and presses the heel of his hand into his brow.' },
  { id: '2.4', name: 'Automate the simple ones', t0: 12.5, t1: 15.5, mm: [68, 72], f: 1.8,
    from: [6.80, 2.90, 1.40], to: [6.81, 2.92, 1.38], at0: 'lap:1250,560', at1: 'lap:1250,640',
    focus: [[12.5, 'lap:1180,520'], [13.4, 'lap:1180,560'], [14.2, 'lap:1180,600'], [15.0, 'lap:1180,900']], roll: [0.4, 0.3],
    why: 'Claude\'s reply streams in, read line by line. Then his answer in the box: yes.' },
  { id: '2.5a', name: 'Parse', t0: 15.5, t1: 17.5, mm: [85, 88], f: 2.0,
    from: [6.99, 2.98, 1.08], to: [6.98, 2.99, 1.075], at0: 'lap:520,300', at1: 'lap:560,330', focus: 'lap:520,300', roll: [1.2, 0.9],
    why: 'Macro on the screen: parse().' },
  { id: '2.5b', name: 'Classify', t0: 17.5, t1: 19.5, mm: [85, 88], f: 2.0,
    from: [6.91, 2.99, 1.08], to: [6.92, 2.98, 1.08], at0: 'lap:560,500', at1: 'lap:620,500', focus: 'lap:560,500', roll: [-1.0, -0.8],
    why: 'Emails sort themselves into three lanes.' },
  { id: '2.5c', name: 'Draft', t0: 19.5, t1: 21.5, mm: [85, 90], f: 2.0,
    from: [7.00, 2.98, 1.09], to: [6.99, 2.99, 1.085], at0: 'lap:600,300', at1: 'lap:660,330', focus: 'lap:600,300', roll: [0.6, 0.4],
    why: 'A reply writes itself in his voice.' },
  { id: '2.6', name: 'Approve 20', t0: 21.5, t1: 24.5, mm: [32, 35], f: 2.8,
    from: [7.42, 2.30, 1.42], to: [7.38, 2.36, 1.40], at0: [7.05, 3.15, 0.90], at1: [7.05, 3.15, 0.90], focus: 'lap:800,500', roll: [0.6, 0.4],
    why: 'He clicks Approve 20; the drafts go out.' },
  { id: '2.7', name: 'The plan', t0: 24.5, t1: 29.0, mm: [85, 85], f: 2.0,
    from: [7.03, 3.60, 0.93], to: [7.02, 3.53, 0.935], at0: [7.02, 3.25, 0.93], at1: [6.97, 3.00, 1.07],
    focus: [[24.5, NOTE], [26.6, NOTE], [27.8, 'eyes']], roll: [0, 0],
    why: 'The sticky note on the back of his laptop: REVIEW + APPROVE. The focus slips off it to his face.' },
  { id: '2.8', name: 'What else', t0: 29.0, t1: 33.0, mm: [58, 62], f: 2.0,
    from: [6.86, 3.74, 1.20], to: [7.06, 3.72, 1.22], at0: FACE, at1: FACE, track: 0.7, focus: 'eyes', roll: [0.4, -0.3],
    why: 'The pipeline runs on its own. His eyes leave it, to nothing: an idea. The evening comes in.' },
  { id: '2.9a', name: 'Calendar', t0: 33.0, t1: 34.25, mm: [55, 56], f: 2.4,
    from: [7.16, 2.84, 1.19], to: [7.17, 2.85, 1.19], at0: 'mon:790,280', at1: 'mon:800,280', focus: 'mon:790,280', roll: [0, 0],
    why: 'A new module lights up: calendar.' },
  { id: '2.9b', name: 'Meetings', t0: 34.25, t1: 35.5, mm: [40, 42], f: 2.8,
    from: [9.00, 2.85, 1.47], to: [9.04, 2.87, 1.47], at0: [9.73, 2.85, 1.45], at1: [9.73, 2.86, 1.45], focus: [9.72, 2.85, 1.45], roll: [0, 0],
    why: 'The notes come off the cork board, one by one.' },
  { id: '2.9c', name: 'Documents', t0: 35.5, t1: 36.75, mm: [55, 56], f: 2.4,
    from: [7.16, 2.84, 1.19], to: [7.17, 2.85, 1.19], at0: 'mon:280,660', at1: 'mon:290,660', focus: 'mon:280,660', roll: [0, 0],
    why: 'Documents.' },
  { id: '2.9d', name: 'Research', t0: 36.75, t1: 38.0, mm: [55, 56], f: 2.4,
    from: [7.16, 2.84, 1.19], to: [7.17, 2.85, 1.19], at0: 'mon:790,660', at1: 'mon:800,660', focus: 'mon:790,660', roll: [0, 0],
    why: 'Research summaries.' },
  { id: '2.10', name: 'Hours', t0: 38.0, t1: 45.0, mm: [20, 20], f: 16,
    from: [4.55, 4.95, 1.55], to: [4.62, 4.88, 1.55], at0: [6.95, 2.95, 0.95], at1: [6.95, 2.95, 0.95], focus: [6.95, 2.95, 1.0], roll: [0, 0],
    why: 'A time-lapse from across the flat: the sun crosses the floor, night falls, the lamp comes on, day again.' },
  { id: '2.11', name: 'Nothing left', t0: 45.0, t1: 50.0, mm: [60, 64], f: 1.6,
    from: [6.80, 2.90, 1.40], to: [6.82, 2.93, 1.37], at0: 'lap:560,260', at1: 'lap:560,520',
    focus: [[45.0, 'lap:420,200'], [46.2, 'lap:420,260'], [47.2, 'lap:420,340'], [48.2, 'lap:420,420'], [49.2, 'lap:420,500']], roll: [0.5, 0.3],
    why: 'His to-do list checks itself off, item by item.' },
  { id: '2.12', name: 'Cheat code', t0: 50.0, t1: 54.0, mm: [85, 88], f: 1.4,
    from: [6.97, 3.76, 0.99], to: [6.97, 3.72, 0.99], at0: FACE, at1: FACE, track: 1.0, focus: 'eyes', roll: [0, 0],
    why: 'Very close and still. A small private smile, a nod. Dust hangs in the screen light.' },
  { id: '2.13', name: 'Hours to minutes', t0: 54.0, t1: 59.0, mm: [50, 50], f: 2.0,
    from: [7.15, 3.55, 1.30], to: [7.12, 3.50, 1.31], at0: [6.98, 2.30, 1.62], at1: [6.97, 2.25, 1.70],
    focus: [[54.0, 'eyes'], [55.6, 'eyes'], [56.6, CLOCK]], roll: [0, 0],
    why: 'From his shoulder to the clock behind him: the hands spin through hours in seconds, then stop.' },
  { id: '2.14', name: 'Another frequency', t0: 59.0, t1: 65.0, mm: [35, 35], f: 2.4,
    arc: [6.95, 2.80], from: [6.30, 2.45, 1.42], to: [6.26, 3.15, 1.40], at0: FACE, at1: FACE, track: 0.5, focus: 'eyes', roll: [0.4, -0.4],
    why: 'The camera circles him. The air has stopped: dust frozen mid-drift. Only he moves.' },
  { id: '2.15', name: 'The door', t0: 65.0, t1: 74.0, mm: [28, 30], f: 4.0,
    from: [4.75, 2.30, 1.45], to: [4.75, 3.45, 1.40], at0: DOOR, at1: DOOR, focus: 'eyes', roll: [0, 0],
    why: 'He stands in the open balcony doorway, dawn pouring past him into the dark flat. The light blooms to white.' },
];
export const shotAt = (t) => shotIn(SHOTS, t);
export const cameraAt = (t, pick) => cameraIn(SHOTS, t, pick);

export const CAPTIONS = [
  [0.3, 3.8, 'It started two days ago.'],
  [4.0, 9.4, 'Ivan was complaining to Claude about how many emails he gets—'],
  [9.5, 12.4, 'hundreds a day, most of them requiring some response.'],
  [12.5, 15.4, 'Claude suggested they could automate the simple ones.'],
  [15.5, 21.4, 'A script to parse incoming messages, classify them by type, draft appropriate replies.'],
  [21.5, 24.4, 'Ivan could review and approve them in batches.'],
  [24.6, 28.8, 'That was the plan. Review and approve.'],
  [29.0, 32.9, 'But once the email system was working, Ivan saw what else was possible.'],
  [33.0, 38.0, 'Calendar management. Meeting scheduling. Document drafting. Research summaries.'],
  [38.2, 44.8, 'Each one a few hours of coding, a few conversations with Claude to work out the logic.'],
  [45.0, 49.8, 'Each one removing another task from his daily routine.'],
  [50.0, 53.9, "The feeling is hard to describe. It's like discovering a cheat code for life."],
  [54.0, 58.9, 'Every problem that used to take hours now takes minutes. Every tedious task can be automated away.'],
  [59.0, 64.9, "Ivan feels like he's vibrating at a different frequency than everyone around him—"],
  [65.0, 72.0, "like he's stepped through a door that others can't even see."],
];

// ------------------------------------------------------------------ light: which time of day, when
// keys: [time, set] - blends linearly between consecutive keys with different sets; a repeated time is a hard cut
const LIGHT = [
  [0, '3am'], [1.2, '3am'], [3.4, 'day'], [29.0, 'day'], [32.5, 'evening'], [33.0, 'evening'],
  [33.0, 'sunrise'], [34.25, 'sunrise'], [34.25, 'day'], [35.5, 'day'], [35.5, 'evening'], [36.75, 'evening'], [36.75, '3am'],
  [38.0, '3am'], [38.0, 'day'], [39.2, 'day'], [40.0, 'evening'], [40.8, '3am'], [42.0, '3am'], [42.8, 'sunrise'], [43.6, 'day'], [44.4, 'evening'], [45.0, '3am'],
  [65.0, '3am'], [65.0, 'sunrise'], [74.0, 'sunrise'],
];
export function light(t) {
  let i = 0; while (i < LIGHT.length - 1 && LIGHT[i + 1][0] <= t) i++;
  const a = LIGHT[i], b = LIGHT[Math.min(i + 1, LIGHT.length - 1)];
  if (b[1] === a[1] || b[0] === a[0]) return { [a[1]]: 1 };
  const w = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
  return { [a[1]]: 1 - w, [b[1]]: w };
}
export const exposureBoost = (t) => 4.5 * smooth((t - 69.5) / 4.0);          // the doorway blooms to white
// the air: normal, eight times faster in the time-lapse, stopped while he "vibrates at a different frequency"
export function atmoTime(t) {
  if (t < 38) return t;
  if (t < 45) return 38 + (t - 38) * 8;
  if (t < 59) return t + 49;
  if (t < 65) return 108;
  return t + 43;
}

// ------------------------------------------------------------------ props
let clock = null, cork = null, curtain = null;
const boardMats = [];
let boardLight = null;
export function props(t, { root, scene, THREE, ivan }) {
  if (!clock) {
    // a clock face over the baked one, so its hands can turn (2.13)
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.292, 0.292), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
    m.position.copy(B(CLOCK[0], 2.2035, CLOCK[2])); m.rotation.y = Math.PI;      // over the baked face, into the room (+y Blender)
    m.receiveShadow = true; scene.add(m);
    clock = { m, g: c.getContext('2d'), tex, last: -1 };
    // REVIEW + APPROVE: a sticky note on the back of the laptop lid (the lid leans 20° back, away from Ivan)
    const nc = document.createElement('canvas'); nc.width = nc.height = 256;
    const g = nc.getContext('2d');
    g.fillStyle = '#f2d35b'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, 256, 34);
    g.fillStyle = '#23201a'; g.textAlign = 'center'; g.font = `bold 50px "Comic Sans MS", "Marker Felt", ${SANS}`;
    g.fillText('REVIEW', 128, 112); g.font = `bold 44px "Comic Sans MS", "Marker Felt", ${SANS}`; g.fillText('+ APPROVE', 128, 172);
    g.strokeStyle = '#23201a'; g.lineWidth = 4; g.beginPath(); g.moveTo(48, 196); g.quadraticCurveTo(128, 210, 208, 192); g.stroke();
    const ntex = new THREE.CanvasTexture(nc); ntex.colorSpace = THREE.SRGBColorSpace; ntex.anisotropy = 8;
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.076, 0.076), new THREE.MeshStandardMaterial({ map: ntex, roughness: 0.8 }));
    const a20 = 20 * Math.PI / 180;
    const nrm = [0, Math.cos(a20), -Math.sin(a20)];                       // the lid's back, in Blender axes
    note.position.copy(B(NOTE[0] + nrm[0] * 0.003, NOTE[1] + nrm[1] * 0.003, NOTE[2] + nrm[2] * 0.003));
    note.lookAt(note.position.clone().add(B(...nrm)));
    note.rotateZ(-0.05);
    note.receiveShadow = true; scene.add(note);
    // the cork board's notes (Baked meshes split by material); found by where they are
    cork = [];
    root.traverse((o) => {
      if (o.name === 'Curtain_S') curtain = o;
      if (o.isMesh && !Array.isArray(o.material) && /^(Cork|Sticky|Paper Print)/.test(o.material.name || '')) {
        const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
        if (p.x > B(9.55, 0, 0).x && p.y > 1.0 && !boardMats.includes(o.material)) { o.material.userData.lmBase = o.material.lightMapIntensity; boardMats.push(o.material); }
      }
      if (!o.isMesh || Array.isArray(o.material)) return;
      if (!/Sticky|Paper Print|Printout/.test(o.material.name || '')) return;
      const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      if (p.x > B(9.55, 0, 0).x && p.y > 1.0) cork.push(o);
    });
  }
  clock.m.visible = t >= 53.5 && t < 59.5;
  if (clock.m.visible) {
    // 3:04, then hours in seconds (55.4 - 57.6), then still at 7:41
    const mins = 3 * 60 + 4 + 277 * smooth((t - 55.4) / 2.2);
    if (Math.abs(mins - clock.last) > 0.05) { drawClock(clock.g, mins); clock.tex.needsUpdate = true; clock.last = mins; }
  }
  cork.forEach((o, i) => { o.visible = !(t >= 34.55 + i * 0.3 && t < 65); });
  if (ivan) vibrate(t, ivan, THREE);
  if (curtain) curtain.visible = !(t >= 34.25 && t < 35.5);         // the sheer curtain hangs in front of the board
  // the board was baked behind the curtain: lift its light while the curtain is out of the way
  const lit = t >= 34.25 && t < 35.5 ? 6.0 : 1.0;
  for (const m of boardMats) m.lightMapIntensity = m.userData.lmBase * lit;
  if (!boardLight) {
    boardLight = new THREE.SpotLight(0xfff2e0, 0, 4, 0.55, 0.8, 1.5);
    boardLight.position.copy(B(8.55, 2.70, 2.05)); boardLight.target.position.copy(B(9.72, 2.85, 1.25));
    scene.add(boardLight, boardLight.target);
  }
  boardLight.intensity = t >= 34.25 && t < 35.5 ? 6.0 : 0;
}
// 2.14: "vibrating at a different frequency". Two faint copies of Ivan, sharing his skeleton, shaken a few
// pixels either side of him at a rate the camera can't hold: a double image only he has, while the air is still.
let ghosts = null;
function vibrate(t, ivan, THREE) {
  if (!ghosts) {
    ghosts = [];
    const meshes = []; ivan.traverse((o) => { if (o.isSkinnedMesh && !/Lens/.test(o.material.name || '')) meshes.push(o); });
    for (const [tint, phase] of [[[0.62, 0.80, 1.0], 0], [[1.0, 0.82, 0.66], Math.PI]]) {
      const shift = { value: new THREE.Vector2() }, mats = [], objs = [];
      for (const o of meshes) {
        const g = o.clone(); const m = o.material.clone();           // a SkinnedMesh clone shares the skeleton
        m.transparent = true; m.depthWrite = false; m.opacity = 0; m.color.multiply(new THREE.Color(...tint));
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uShift = shift;
          sh.vertexShader = 'uniform vec2 uShift;\n' + sh.vertexShader.replace('#include <project_vertex>',
            '#include <project_vertex>\n  gl_Position.xy += uShift * gl_Position.w; gl_Position.z -= 0.0008 * gl_Position.w;');
        };
        m.customProgramCacheKey = () => 'ghost';
        g.material = m; g.castShadow = g.receiveShadow = false; g.renderOrder = 3; g.visible = false;
        o.parent.add(g); mats.push(m); objs.push(g);
      }
      ghosts.push({ shift, mats, objs, phase });
    }
  }
  const k = smooth((t - 59.6) / 1.2) * (1 - smooth((t - 63.6) / 1.2)) * (t < 65 ? 1 : 0);
  for (const g of ghosts) {
    for (const o of g.objs) o.visible = k > 0.001;
    if (k <= 0.001) continue;
    const a = 0.0065 * k;
    g.shift.value.set(a * Math.sin(t * 46 + g.phase), 0.35 * a * Math.sin(t * 31 + g.phase + 1));
    for (const m of g.mats) m.opacity = 0.24 * k;
  }
}

function drawClock(g, mins) {
  g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 512, 512);
  g.translate(256, 256);
  g.strokeStyle = '#1a1a1a';
  for (let i = 0; i < 60; i++) {
    g.save(); g.rotate(i * Math.PI / 30); g.lineWidth = i % 5 ? 3 : 9;
    g.beginPath(); g.moveTo(0, -238); g.lineTo(0, i % 5 ? -222 : -200); g.stroke(); g.restore();
  }
  const hand = (ang, len, w) => { g.save(); g.rotate(ang); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 24); g.lineTo(0, -len); g.stroke(); g.restore(); };
  hand(((mins / 60) % 12) * Math.PI / 6, 130, 16);
  hand((mins % 60) * Math.PI / 30, 196, 10);
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ------------------------------------------------------------------ screens
const SUBJ = ['Re: Thursday sync', 'Invoice 4471 overdue', 'Q3 planning notes', 'Intro: Dana <> Ivan', 'lunch next week?', 'Contract v3 redlines',
  'PR #212 needs review', 'Flight change: LHR', 'Offsite agenda', 'Re: hiring loop', 'Weekly metrics', 'Can you join at 4?', 'Re: Re: budget',
  'Customer escalation', 'Design review moved', 'Your order shipped', 'Benefits enrollment', 'Re: launch checklist', 'Quick question', 'Expense report'];
const FROM = ['Maya Chen', 'Billing', 'Priya R.', 'Dana Ortiz', 'Sasha', 'Legal', 'GitHub', 'BA', 'Ops', 'Tom K.', 'Analytics', 'Lena', 'Finance',
  'Support', 'Calendar', 'Shop', 'HR', 'Product', 'Marco', 'Concur'];
const ASK = 'yes';
const CLAUDE = 'We could automate the simple ones. A script that parses each incoming message, classifies it by type, ' +
  'and drafts a reply in your voice. You review the drafts and approve them in batches.';
const PARSE = ['def parse(raw):', '    msg = email.message_from_bytes(raw)', '    return Mail(', '        sender=msg["From"],',
  '        subject=msg["Subject"],', '        body=plain_text(msg),', '        thread=msg.get("In-Reply-To"),', '    )'];
const DRAFT = 'Hi Maya,\n\nThursday at 2 works for me. I will bring the Q3 numbers and the draft plan, so we can go through both.\n\nBest,\nIvan';
const TODO = ['answer the 61 emails', 'reschedule 3 conflicts', 'book flight change', 'draft offsite agenda', 'summarize Q3 planning doc',
  'review PR #212 notes', 'expense report', 'reply to Dana intro', 'read the 4 papers', 'weekly metrics summary'];

function bg(g, W, H) { g.fillStyle = C.ed; g.fillRect(0, 0, W, H); }
function menubar(g, t, label) {
  g.fillStyle = C.bar; g.fillRect(0, 0, 1600, 26);
  g.font = `15px ${SANS}`; g.fillStyle = '#c9ccd3'; g.textBaseline = 'middle';
  g.fillText(label, 22, 13);
  g.fillText(t < 29 ? 'Sun 2:20 PM' : t < 45 ? 'Mon 7:48 PM' : 'Tue 3:0' + (4 + Math.floor((t - 45) / 12)) + ' AM', 1430, 13);
}

function mail(g, t) {
  bg(g, 1600, 1000); menubar(g, t, 'Mail');
  g.fillStyle = '#12141b'; g.fillRect(0, 26, 230, 974);
  const unread = Math.min(263, 187 + Math.floor(Math.max(0, t - 0.5) * 9));
  g.font = `600 17px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('Inbox', 22, 64);
  g.fillStyle = '#e06c75'; rr(g, 150, 52, 64, 26, 13); g.fill(); g.fillStyle = '#fff'; g.font = `600 15px ${SANS}`; g.fillText(String(unread), 164, 66);
  g.font = `15px ${SANS}`; g.fillStyle = '#9aa0ad';
  ['Flagged', 'Drafts', 'Sent', 'Archive', 'Newsletters', 'Receipts'].forEach((s, i) => g.fillText(s, 22, 104 + i * 32));
  // list: new mail keeps arriving at the top; his scrolling can't keep up
  const arrived = Math.floor(Math.max(0, t - 0.5) * 9);
  const scroll = Math.max(0, t - 4.2) * 38;
  for (let k = 0; k < 16; k++) {
    const idx = (k - arrived + 400) % SUBJ.length;
    const y = 50 + k * 60 - (scroll % 60);
    if (y < 30 || y > 990) continue;
    const isNew = k < 3;
    g.fillStyle = k % 2 ? '#171a23' : '#151821'; g.fillRect(230, y, 1370, 58);
    if (isNew) { g.fillStyle = '#61afef'; g.beginPath(); g.arc(254, y + 29, 6, 0, 7); g.fill(); }
    g.font = `${isNew ? 600 : 400} 18px ${SANS}`; g.fillStyle = isNew ? '#ffffff' : '#c9ccd3';
    g.fillText(FROM[idx], 276, y + 20); g.fillText(SUBJ[idx], 520, y + 20);
    g.font = `15px ${SANS}`; g.fillStyle = '#7d8392';
    g.fillText('Hi Ivan, quick one: could you take a look and let me know by end of day…', 520, y + 42);
    g.fillText(`2:${String(19 - (k % 19)).padStart(2, '0')} PM`, 1490, y + 20);
  }
}
function chat(g, t, keys) {
  bg(g, 1600, 1000); menubar(g, t, 'Claude');
  g.fillStyle = C.chat; g.fillRect(990, 26, 610, 974);
  g.fillStyle = '#e8e4d8'; g.fillRect(990, 26, 610, 44);
  g.fillStyle = C.claude; g.beginPath(); g.arc(1018, 48, 10, 0, 7); g.fill();
  g.font = `600 18px ${SANS}`; g.fillStyle = C.ink; g.fillText('Claude', 1038, 49);
  // the inbox, dimmed, on the left
  g.globalAlpha = 0.35; mail(g, Math.min(t, 9.5)); g.globalAlpha = 1;
  g.fillStyle = C.chat; g.fillRect(990, 70, 610, 930);
  const msgs = [['you', 'I get 200+ emails a day and most of them need some kind of reply. it is eating my whole day']];
  msgs.push(['claude', CLAUDE.slice(0, Math.floor(Math.max(0, t - 12.2) * 70))]);
  if (t >= 15.3) msgs.push(['you', ASK]);
  g.font = `500 30px ${SANS}`;                     // big enough to read in the insert, through the bloom
  let y = 110;
  for (const [who, text] of msgs) {
    const ls = wrap(g, text, who === 'you' ? 430 : 545);
    if (who === 'you') {
      const w = Math.max(...ls.map((l) => g.measureText(l).width)) + 30;
      g.fillStyle = C.bubble; rr(g, 1580 - w, y, w, ls.length * 40 + 24, 14); g.fill();
      g.fillStyle = C.ink; ls.forEach((l, k) => g.fillText(l, 1580 - w + 15, y + 32 + k * 40));
    } else { g.fillStyle = C.ink; ls.forEach((l, k) => g.fillText(l, 1022, y + 20 + k * 40)); }
    y += ls.length * 40 + 46;
  }
  g.fillStyle = '#ffffff'; rr(g, 1010, 920, 570, 56, 12); g.fill(); g.strokeStyle = '#d6d2c6'; g.lineWidth = 1.5; g.stroke();
  const n = keysIn(keys, 14.6, 15.3, t), tot = Math.max(1, keysIn(keys, 14.6, 15.3, 1e9));
  const typed = t < 15.3 ? ASK.slice(0, Math.round(n * ASK.length / tot)) : '';
  g.fillStyle = typed ? C.ink : '#9a978f'; g.fillText(typed || 'Reply to Claude...', 1028, 949);
}
function editor(g, t, lines, title, caretOn = true) {
  bg(g, 1600, 1000); menubar(g, t, 'Code');
  g.fillStyle = C.bar; g.fillRect(0, 26, 1600, 34);
  g.font = `14px ${SANS}`; g.fillStyle = '#ffffff'; g.fillText(title, 24, 43);
  g.font = `22px ${MONO}`; const cw = g.measureText('M').width;
  lines.forEach((l, i) => {
    g.fillStyle = C.gutter; g.textAlign = 'right'; g.fillText(String(i + 1), 120, 100 + i * 34); g.textAlign = 'left';
    drawCode(g, l, 150, 100 + i * 34, cw);
  });
  if (caretOn && Math.floor(t * 1.9) % 2 === 0) { const l = lines[lines.length - 1] || ''; g.fillStyle = '#e6e6e6'; g.fillRect(151 + l.length * cw, 86 + (lines.length - 1) * 34, 2, 26); }
}
function classify(g, t) {
  bg(g, 1600, 1000); menubar(g, t, 'inbox-agent · classify');
  const lanes = [['REPLY', '#7fd3a0'], ['FYI', '#7fb2ff'], ['SPAM', '#e06c75']];
  lanes.forEach(([n, c], i) => {
    const x = 120 + i * 470;
    g.fillStyle = '#12151d'; rr(g, x, 300, 420, 640, 16); g.fill();
    g.font = `700 26px ${SANS}`; g.fillStyle = c; g.fillText(n, x + 24, 340);
  });
  for (let k = 0; k < 14; k++) {
    const t0 = 17.6 + k * 0.13, u = smooth((t - t0) / 0.5);
    if (t < t0) continue;
    const lane = [0, 1, 0, 2, 0, 1, 1, 0, 2, 0, 1, 0, 0, 1][k], slot = [0, 0, 1, 0, 2, 1, 2, 3, 1, 4, 3, 5, 6, 4][k];
    const x0 = 700, y0 = 120, x1 = 140 + lane * 470, y1 = 370 + slot * 74;
    const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
    g.fillStyle = '#1e2330'; rr(g, x, y, 380, 62, 10); g.fill();
    g.strokeStyle = lanes[lane][1]; g.lineWidth = 2; g.stroke();
    g.font = `17px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText(SUBJ[k], x + 16, y + 26);
    g.font = `14px ${MONO}`; g.fillStyle = '#9aa0ad'; g.fillText(`${FROM[k]} · ${(0.8 + (k % 5) * 0.04).toFixed(2)}`, x + 16, y + 48);
  }
}
function draft(g, t) {
  bg(g, 1600, 1000); menubar(g, t, 'inbox-agent · draft');
  g.fillStyle = '#1b1f2a'; rr(g, 300, 120, 1000, 800, 14); g.fill();
  g.font = `18px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText('To: Maya Chen     Re: Thursday sync', 340, 170);
  g.fillStyle = C.claude; rr(g, 1060, 150, 210, 32, 16); g.fill(); g.fillStyle = '#fff'; g.font = `600 14px ${SANS}`; g.fillText('drafted in your voice', 1078, 171);
  g.font = `30px ${SANS}`; g.fillStyle = '#e9ecf2';
  const ls = wrap(g, DRAFT.slice(0, Math.floor(Math.max(0, t - 19.6) * 60)), 900);
  ls.forEach((l, k) => g.fillText(l, 340, 250 + k * 38));
}
function review(g, t) {
  bg(g, 1600, 1000); menubar(g, t, 'inbox-agent · review');
  g.font = `600 28px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('20 drafts ready', 120, 110);
  const clicked = t >= 22.9;
  g.fillStyle = clicked ? '#1f6f43' : '#2f6fd8'; rr(g, 1180, 84, 300, 56, 12); g.fill();
  g.font = `700 22px ${SANS}`; g.fillStyle = '#fff'; g.fillText(clicked ? '✓ Approved' : 'Approve 20', 1240, 113);
  for (let k = 0; k < 10; k++) {
    const y = 180 + k * 76, go = clicked ? smooth((t - 22.95 - k * 0.07) / 0.35) : 0;
    g.globalAlpha = 1 - go;
    g.fillStyle = '#171a23'; rr(g, 120 + go * 900, y, 1360, 64, 10); g.fill();
    g.font = `18px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText(`${FROM[k]} — ${SUBJ[k]}`, 150 + go * 900, y + 28);
    g.font = `15px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText('Thanks, that works. I will …', 150 + go * 900, y + 50);
    g.globalAlpha = 1;
  }
  if (clicked) { g.font = `600 22px ${SANS}`; g.fillStyle = '#7fd3a0'; g.fillText(`sent ${Math.min(20, Math.floor((t - 22.95) * 14))} / 20`, 120, 950); }
}
function todo(g, t) {
  bg(g, 1600, 1000); menubar(g, t, 'Code');
  g.font = `600 30px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('TODO.md', 150, 110);
  g.font = `26px ${MONO}`;
  TODO.forEach((s, i) => {
    const y = 200 + i * 66, done = t >= 45.6 + i * 0.42;
    g.strokeStyle = done ? '#7fd3a0' : '#7d8392'; g.lineWidth = 3; g.strokeRect(150, y - 16, 30, 30);
    if (done) { g.fillStyle = '#7fd3a0'; g.font = `700 26px ${SANS}`; g.fillText('✓', 153, y + 2); g.font = `26px ${MONO}`; }
    g.fillStyle = done ? '#5c6370' : '#d7dae0'; g.fillText(s, 210, y);
    if (done) { g.fillStyle = '#5c6370'; g.fillRect(210, y - 1, g.measureText(s).width, 2); }
  });
  if (t >= 45.6 + TODO.length * 0.42 + 0.4) { g.font = `600 26px ${SANS}`; g.fillStyle = '#7fd3a0'; g.fillText('nothing left.', 210, 200 + TODO.length * 66 + 20); }
}
function coding(g, t, keys) {
  const files = ['calendar_sync.py', 'scheduler.py', 'docs_drafter.py', 'research_digest.py'];
  const f = files[Math.min(3, Math.floor(Math.max(0, t - 33) / 1.25))];
  const src = ['def run(ctx):', '    items = fetch(ctx.since)', '    for it in items:', '        plan = claude.plan(it, rules=ctx.rules)',
    '        if plan.confident:', '            apply(plan)', '        else:', '            queue_for_review(plan)', '    log.ok(f"{len(items)} handled")'];
  const n = keysIn(keys, 0, 1e9, t);
  const shown = src.join('\n').slice(0, (n * 7) % 300 + 20).split('\n');
  editor(g, t, shown, f);
}
export const SCREENS = {
  laptop(g, t, keys) {
    if (t < 12.5) return mail(g, t);
    if (t < 15.5) return chat(g, t, keys);
    if (t < 17.5) return editor(g, t, PARSE.slice(0, 1 + Math.floor((t - 15.5) * 5)), 'parse.py');
    if (t < 19.5) return classify(g, t);
    if (t < 21.5) return draft(g, t);
    if (t < 24.5) return review(g, t);
    if (t >= 45 && t < 50) return todo(g, t);
    return coding(g, t, keys);
  },
  monitor(g, t) {
    if (t < 24.5) return calendar(g, t);
    if (t < 33) return pipelineMonitor(g, 8 + (t - 24.5) * 0.6);
    return modules(g, t);
  },
};
function calendar(g, t) {
  g.fillStyle = '#0d0f15'; g.fillRect(0, 0, 1600, 900);
  g.font = `600 26px ${SANS}`; g.fillStyle = '#e9ecf2'; g.textBaseline = 'middle'; g.fillText('Calendar · Week 11', 30, 36);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  days.forEach((d, i) => { g.font = `600 18px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText(d, 140 + i * 290, 84); });
  const cols = ['#3d6fd8', '#2e9e6b', '#b5603a', '#8e5bd1', '#c4a23a'];
  for (let i = 0; i < 5; i++) {
    for (let h = 0; h < 18; h++) {
      const r = (i * 31 + h * 17) % 7;
      if (r > 4) continue;
      const y = 110 + h * 43, x = 110 + i * 290;
      g.fillStyle = cols[r] + 'cc'; rr(g, x + (r === 3 ? 120 : 0), y, r === 3 ? 150 : 270, 39, 6); g.fill();
      g.font = `14px ${SANS}`; g.fillStyle = '#fff'; g.fillText(SUBJ[(i * 7 + h) % SUBJ.length].slice(0, 22), x + 10 + (r === 3 ? 120 : 0), y + 20);
      if ((i + h) % 9 === 0) { g.fillStyle = '#e06c75'; g.fillRect(x - 6, y, 4, 39); }
    }
  }
}
function modules(g, t) {
  g.fillStyle = '#0d0f15'; g.fillRect(0, 0, 1600, 900);
  g.font = `600 30px ${SANS}`; g.fillStyle = '#e9ecf2'; g.textBaseline = 'middle'; g.fillText('inbox-agent · modules', 40, 50);
  const M = [['email', 'replies drafted', 0], ['calendar', 'conflicts resolved', 33.0], ['meetings', 'meetings scheduled', 34.25],
    ['documents', 'docs drafted', 35.5], ['research', 'papers summarized', 36.75]];
  const speed = t > 38 && t < 45 ? 40 : 2;
  M.forEach(([name, what, on], i) => {
    const x = 40 + (i % 3) * 510, y = 110 + Math.floor(i / 3) * 380;
    const live = t >= on, pop = live ? smooth((t - on) / 0.4) : 0;
    g.fillStyle = live ? `rgba(24,${50 + 40 * pop},${36 + 20 * pop},1)` : '#141822'; rr(g, x, y, 480, 340, 18); g.fill();
    g.strokeStyle = live ? '#7fd3a0' : '#2a2f3d'; g.lineWidth = live ? 3 : 1.5; g.stroke();
    g.font = `700 40px ${SANS}`; g.fillStyle = live ? '#e9ecf2' : '#5b6070'; g.fillText(name, x + 30, y + 60);
    g.font = `600 64px ${MONO}`; g.fillStyle = live ? '#9df2bd' : '#3a3f4d';
    g.fillText(live ? String(Math.floor(40 + (t - on) * speed * (i + 3))) : '—', x + 30, y + 170);
    g.font = `20px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText(live ? what : 'not built yet', x + 30, y + 240);
    g.fillText(live ? `built in ${3 + (i % 3)}h ${10 + i * 7}m · running` : '', x + 30, y + 285);
  });
}
