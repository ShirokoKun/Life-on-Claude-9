// Round 14 (lane L4): hands on props, after the director's R4 (reference/r14/balcony_mug_city_trails_ref.webp): the mug
// held round its BODY in a loose fist. A cylinder (power) grip: the palm on the mug's side, the four fingers wrapped
// round it with the knuckles stacked along its axis (index on top), the thumb laid along the side the other way, the
// wrist neutral, which means the forearm runs ACROSS the mug's axis (a hammer hold), the elbow down and forward.
// Also: the gulp (K36) and the caffeine tremor (K40).
import * as THREE from 'three';
import { bones, reach, orientHand, curlAnat, palmFrame, touch } from './rig.js';

export const MUG_R = 0.0405;                      // the mug's outer radius at mid height (rig.js makeMug: 0.041 top, 0.038 base)
const W = (o) => o.getWorldPosition(new THREE.Vector3());
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// distance of a point from the mug's axis line
function axisDist(p, c, axis) { const d = p.clone().sub(c); return d.addScaledVector(axis, -d.dot(axis)).length(); }

// the body grip: the mug is already placed (centre c, axis); the hand is brought to it. Returns the finger direction.
//   o.pole: the elbow's pole (world direction); o.fist: 0 loose .. 1 tight; o.drop: the palm's centre below the mug's
//   middle (m); o.handle: the handle's angle round the axis from the palm's far side (rad)
export function bodyGrip(who, side, mug, c, axis, o = {}) {
  const b = bones(who), S = side === 'L' ? 'Left' : 'Right';
  const fa = b[S + 'ForeArm'], hb = b[S + 'Hand'];
  if (!fa || !hb) return null;
  const pole = o.pole;
  // palm normal (into the palm, measured: -n for the left hand, +n for the right, n = cross(index - pinky, middle - hand))
  const palmN = (f) => new THREE.Vector3().crossVectors(axis, f).normalize().multiplyScalar(side === 'L' ? -1 : 1);
  let wrist = o.wrist0 ? o.wrist0.clone() : c.clone(), f = new THREE.Vector3();
  const goal = new THREE.Vector3();
  for (let it = 0; it < 8; it++) {
    reach(who, side, wrist, pole);
    const F = W(hb).sub(W(fa)).normalize();                                     // the forearm's line, elbow to wrist
    f.copy(F).addScaledVector(axis, -F.dot(axis));                               // the fingers run on across the axis
    if (f.lengthSq() < 1e-6) f.set(1, 0, 0).addScaledVector(axis, -axis.x);
    f.normalize();
    orientHand(who, side, f, axis);                                              // knuckles stacked up the mug
    const n = palmN(f);                                                          // the palm faces the mug
    goal.copy(c).addScaledVector(n, -(MUG_R + (o.gap ?? 0.016))).addScaledVector(axis, -(o.drop ?? 0.006));
    const P = palmFrame(who, side); if (!P) break;
    const miss = goal.clone().sub(P.centre);
    wrist.add(miss);
    if (miss.length() < 0.0008 && it > 2) break;
  }
  reach(who, side, wrist, pole);
  orientHand(who, side, f, axis);
  // the mug's handle: away from the hand, on the far side, turned toward the thumb's side so the fingertips stay clear
  const n = palmN(f);
  const X = n.clone().applyAxisAngle(axis, (o.handle ?? 0.9) * (side === 'L' ? -1 : 1));    // +x is the handle (+: toward the thumb)
  const Z = new THREE.Vector3().crossVectors(X, axis).normalize();
  mug.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, axis, Z));
  mug.updateMatrixWorld(true);
  // the fingers wrap the body: each finger's curl is found so its tip rests on the mug (a loose fist: just touching)
  const base = { Index: [1.0, 1.25, 0.8], Middle: [1.0, 1.25, 0.8], Ring: [1.05, 1.25, 0.8], Pinky: [1.1, 1.2, 0.8] };
  const want = MUG_R + 0.0075 - 0.002 * (o.fist ?? 0);                           // the tip bone sits ~7 mm inside the pad
  const sc = { Index: 40, Middle: 40, Ring: 40, Pinky: 40 }, lo = { Index: 5, Middle: 5, Ring: 5, Pinky: 5 }, hi = { Index: 75, Middle: 75, Ring: 75, Pinky: 75 };
  const thumb = o.thumb || [6, 10, 6];
  const apply = () => curlAnat(who, side, Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.map((x) => x * sc[k])])), thumb);
  for (let it = 0; it < 9; it++) {
    apply();
    for (const k of Object.keys(base)) {
      const tip = b[`${S}Hand${k}4`] || b[`${S}Hand${k}3`]; if (!tip) continue;
      const d = axisDist(W(tip), c, axis);
      // farther than wanted: curl more (the tip comes round onto the mug); nearer (inside it): curl less
      if (d > want) lo[k] = sc[k]; else hi[k] = sc[k];
      sc[k] = (lo[k] + hi[k]) / 2;
    }
  }
  apply();
  closeFingers(who, side, o.close ?? 0.7);
  return f;
}

// a fist keeps its fingers together: each finger is turned at its knuckle about the palm's normal toward the middle
// finger (k of the way); the bind pose has them splayed
export function closeFingers(who, side, k = 0.7) {
  const b = bones(who), S = side === 'L' ? 'Left' : 'Right';
  const P = palmFrame(who, side); if (!P) return;
  const n = P.normal, prj = (v) => v.addScaledVector(n, -v.dot(n)).normalize();
  const m1 = b[S + 'HandMiddle1'], m2 = b[S + 'HandMiddle2']; if (!m1 || !m2) return;
  const md = prj(W(m2).sub(W(m1)));
  for (const F of ['Index', 'Ring', 'Pinky']) {
    const f1 = b[`${S}Hand${F}1`], f2 = b[`${S}Hand${F}2`]; if (!f1 || !f2) continue;
    const d = prj(W(f2).sub(W(f1)));
    const ang = Math.atan2(new THREE.Vector3().crossVectors(d, md).dot(n), d.dot(md));
    touch(f1);
    const wq = f1.getWorldQuaternion(new THREE.Quaternion()), pq = f1.parent.getWorldQuaternion(new THREE.Quaternion());
    f1.quaternion.copy(pq.invert().multiply(new THREE.Quaternion().setFromAxisAngle(n, ang * k).multiply(wq)));
    f1.updateMatrixWorld(true);
  }
}

// the gulp (K36): 0 at rest, up to 1 over a swallow ~0.9 s long, then settling. Keyed by the gulp times
export function gulpAt(times, t) {
  let g = 0;
  for (const g0 of times || []) {
    const u = t - g0;
    if (u < -0.35 || u > 1.4) continue;
    g = Math.max(g, u < 0 ? sm((u + 0.35) / 0.35) : u < 0.45 ? 1 : 1 - sm((u - 0.45) / 0.95));
  }
  return g;
}

// the caffeine tremor (K40): a slow waver (1-2 Hz, a few mm) under a faint fine tremor (~9 Hz, a fraction of a mm).
// Not periodic-looking: three incommensurate sines per axis. amp in metres for the waver.
export function tremor(t, { amp = 0.0022, fine = 0.00025, hz = 1.4 } = {}) {
  const w = (f, p) => Math.sin(t * Math.PI * 2 * f + p);
  const a = (k) => amp * (0.62 * w(hz * 0.83, k) + 0.38 * w(hz * 1.37, 2.1 + k)) + fine * (w(8.7, 0.4 + k * 1.7) * 0.7 + w(10.9, 1.3 + k) * 0.3);
  return new THREE.Vector3(a(0), a(1.9) * 0.8, a(3.7));
}

// Round 14 (K12, director: "the phone overlaps the hand"): the cradle grip of a phone held up to read. The phone's back
// lies on the fingers and palm, the palm behind its thumb-side edge, the four fingers run across the back and curl round
// the far edge (their tips just reaching its front), the knuckles stacked up its long side, the thumb resting over the
// lower corner of the screen. P0: the phone's centre; n: its screen normal (toward his eyes); u: its long axis (up).
const PHONE = { w: 0.072, h: 0.152, d: 0.008 };
export function phoneGrip(who, side, P0, n, u, o = {}) {
  const b = bones(who), S = side === 'L' ? 'Left' : 'Right', sg = side === 'L' ? -1 : 1;
  const e = new THREE.Vector3().crossVectors(u, n).normalize().multiplyScalar(sg);       // toward the hand's own edge (u x n: his right)
  // the palm faces the phone's back-and-edge corner (a deg from the back): its normal Np; the fingers run across the
  // back toward the far edge (f, knuckles up the long side): for the right hand palm = cross(u, f), so f = Np x u
  const a = THREE.MathUtils.degToRad(o.a ?? 50);
  const Np = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(e, -Math.sin(a)).normalize();
  const f = side === 'L' ? new THREE.Vector3().crossVectors(u, Np) : new THREE.Vector3().crossVectors(Np, u);
  const goal = P0.clone().addScaledVector(e, PHONE.w / 2 - (o.edge ?? 0.004)).addScaledVector(n, -PHONE.d / 2).addScaledVector(Np, -(o.palm ?? 0.02)).addScaledVector(u, -(o.low ?? 0.025));
  const pole = o.pole;
  const wrist = goal.clone().addScaledVector(e, 0.05).addScaledVector(u, -0.06);
  for (let it = 0; it < 8; it++) {
    reach(who, side, wrist, pole);
    orientHand(who, side, f.clone().addScaledVector(u, o.diag ?? 0.2).normalize(), u);
    const P = palmFrame(who, side); if (!P) break;
    const miss = goal.clone().sub(P.centre); wrist.add(miss);
    if (miss.length() < 0.0008 && it > 2) break;
  }
  reach(who, side, wrist, pole);
  orientHand(who, side, f.clone().addScaledVector(u, o.diag ?? 0.2).normalize(), u);
  // each finger curls until its tip comes round the far edge to the front (n = 0 at the screen's plane)
  const sc = { Index: 30, Middle: 30, Ring: 30, Pinky: 30 }, lo = { Index: 0, Middle: 0, Ring: 0, Pinky: 0 }, hi = { Index: 80, Middle: 80, Ring: 80, Pinky: 80 };
  const pat = [1.0, 0.55, 0.35], thumb = o.thumb || [14, 12, 8];
  const apply = () => curlAnat(who, side, Object.fromEntries(Object.keys(sc).map((k) => [k, pat.map((x) => x * sc[k])])), thumb);
  for (let it = 0; it < 9; it++) {
    apply();
    for (const k of Object.keys(sc)) {
      const tip = b[`${S}Hand${k}4`] || b[`${S}Hand${k}3`]; if (!tip) continue;
      const tp = W(tip).sub(P0);
      // past the far edge (along f beyond w/2) the tip must come forward to the front; short of it, it stays behind
      const across = -tp.dot(e), depth = tp.dot(n);
      const want = across > PHONE.w / 2 - 0.004 ? -0.0005 : -(PHONE.d / 2 + 0.006);
      if (depth < want) lo[k] = sc[k]; else hi[k] = sc[k];                       // still behind: curl more
      sc[k] = (lo[k] + hi[k]) / 2;
    }
  }
  apply();
  closeFingers(who, side, 0.5);
}

// Round 14 (K07, director: "hand placements on the keyboard more open and aligned with the keys"): touch-typing hands.
// Each hand rests over its home keys (A S D F / J K L ;): the palm floats behind and above them, the hand slopes down
// to the keys, each finger is turned toward its own key and curled just enough to rest on it. Typing: keystrokes at
// ~9 a second shared by the two hands (seeded, so renders repeat), each one a finger lifting ~8 mm and striking its
// key, sometimes the key above or below; the hand follows each stroke a little.
const HOMEK = { L: { Pinky: 'A', Ring: 'S', Middle: 'D', Index: 'F' }, R: { Index: 'J', Middle: 'K', Ring: 'L', Pinky: ';' } };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function typeHands(who, keyAt, t, o = {}) {
  if (!keyAt || !keyAt.A || !keyAt.L || !keyAt.Q || !keyAt.J) return;
  const b = bones(who);
  const right = keyAt.L.clone().sub(keyAt.A).normalize();
  const fwd = keyAt.Q.clone().sub(keyAt.A); fwd.addScaledVector(right, -fwd.dot(right)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize(); if (up.y < 0) up.negate();
  const pitch = keyAt.Q.distanceTo(keyAt.A);                                  // one row
  const rate = o.rate ?? 9, slot = Math.floor(t * rate);
  // the stroke on each finger now: the latest slot (within 0.2 s) that picked it
  const stroke = {};
  for (let k = slot - 2; k <= slot; k++) {
    const side = hash(k) < 0.5 ? 'L' : 'R', fn = ['Index', 'Middle', 'Ring', 'Pinky', 'Index', 'Middle'][Math.floor(hash(k + 0.37) * 6)];
    const u = (t - k / rate) / 0.2; if (u < 0 || u > 1) continue;
    const row = hash(k + 0.71) < 0.25 ? 1 : hash(k + 0.71) > 0.85 ? -1 : 0;
    stroke[side + fn] = { u, row };
  }
  for (const side of ['L', 'R']) {
    const S = side === 'L' ? 'Left' : 'Right', F = HOMEK[side];
    const tg = {};
    const mean = new THREE.Vector3(), nudge = new THREE.Vector3();
    for (const [fn, ch] of Object.entries(F)) {
      const p = keyAt[ch].clone(); mean.add(p);
      const st = stroke[side + fn];
      let h = 0.0045;                                                          // resting on the key top (pad)
      if (st) {
        p.addScaledVector(fwd, st.row * pitch * Math.min(1, st.u * 3));
        h += st.u < 0.45 ? 0.008 * Math.sin(st.u / 0.45 * Math.PI * 0.5) : st.u < 0.7 ? 0.008 - 0.0105 * (st.u - 0.45) / 0.25 : -0.0025 * (1 - (st.u - 0.7) / 0.3);
        nudge.addScaledVector(fwd, st.row * 0.004 * Math.sin(st.u * Math.PI)).addScaledVector(up, 0.0015 * Math.sin(st.u * Math.PI));
      }
      tg[fn] = p.addScaledVector(up, h);
    }
    mean.multiplyScalar(0.25);
    const along = fwd.clone().multiplyScalar(Math.cos(0.3)).addScaledVector(up, -Math.sin(0.3)).normalize();   // the hand slopes ~17 deg down to the keys
    const across = side === 'L' ? right.clone() : right.clone().negate();     // index - pinky
    const goal = mean.clone().addScaledVector(fwd, -(o.back ?? 0.062)).addScaledVector(up, o.lift ?? 0.034).add(nudge);
    const pole = up.clone().negate().addScaledVector(right, side === 'L' ? -0.7 : 0.7).addScaledVector(fwd, -0.3).normalize();
    const wrist = goal.clone().addScaledVector(fwd, -0.05);
    for (let it = 0; it < 6; it++) {
      reach(who, side, wrist, pole);
      orientHand(who, side, along, across);
      const P = palmFrame(who, side); if (!P) break;
      const miss = goal.clone().sub(P.centre); wrist.add(miss);
      if (miss.length() < 0.0008 && it > 1) break;
    }
    reach(who, side, wrist, pole);
    orientHand(who, side, along, across);
    // each finger: turned toward its key in the palm's plane, curled until its tip is at the target height
    const P = palmFrame(who, side); if (!P) continue;
    const n = P.normal, prj = (v) => v.addScaledVector(n, -v.dot(n)).normalize();
    const sc = {}, lo = {}, hi = {};
    for (const fn of Object.keys(F)) { sc[fn] = 25; lo[fn] = 0; hi[fn] = 70; }
    const pat = [1.0, 1.15, 0.7];
    const apply = () => {
      curlAnat(who, side, Object.fromEntries(Object.keys(F).map((fn) => [fn, pat.map((x) => x * sc[fn])])), [12, 16, 10]);
      for (const fn of Object.keys(F)) {
        const f1 = b[`${S}Hand${fn}1`], f2 = b[`${S}Hand${fn}2`]; if (!f1 || !f2) continue;
        const d = prj(W(f2).sub(W(f1))), wantD = prj(tg[fn].clone().sub(W(f1)));
        const ang = Math.atan2(new THREE.Vector3().crossVectors(d, wantD).dot(n), d.dot(wantD));
        touch(f1);
        const wq = f1.getWorldQuaternion(new THREE.Quaternion()), pq = f1.parent.getWorldQuaternion(new THREE.Quaternion());
        f1.quaternion.copy(pq.invert().multiply(new THREE.Quaternion().setFromAxisAngle(n, ang).multiply(wq)));
        f1.updateMatrixWorld(true);
      }
    };
    for (let it = 0; it < 8; it++) {
      apply();
      for (const fn of Object.keys(F)) {
        const tip = b[`${S}Hand${fn}4`] || b[`${S}Hand${fn}3`]; if (!tip) continue;
        const hgt = W(tip).sub(tg[fn]).dot(up);
        if (hgt > 0) lo[fn] = sc[fn]; else hi[fn] = sc[fn];                // too high: curl more
        sc[fn] = (lo[fn] + hi[fn]) / 2;
      }
    }
    apply();
  }
}
