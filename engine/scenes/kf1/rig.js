// Runtime pose tools for held keyframes (no new Blender acting, nothing written back to Ivan's rig or files):
//   standing (bind pose, arms down), feet planted on the floor, head lifted, a hand reaching a point (two-bone IK)
//   with a prop in it (the mug, the phone). Bones are Mixamo names without the colon (GLTFLoader strips it).
import * as THREE from 'three';

export const REST = new Map();                 // bone -> bind-pose quaternion and position (filled at set-up)
export function captureRest(scene) { scene.traverse((o) => { if (o.isBone && !REST.has(o)) REST.set(o, { q: o.quaternion.clone(), p: o.position.clone() }); }); }

// Runtime edits must not leak from one keyframe into the next: a bone the performance doesn't animate keeps whatever we
// wrote last frame. Every edit goes through touch(); begin() puts back any touched bone the mixer didn't overwrite.
const touched = new Set();
export function touch(o) {
  if (!o.userData.pre || !o.userData.fresh) { o.userData.pre = { q: o.quaternion.clone(), p: o.position.clone() }; o.userData.fresh = true; }
  touched.add(o);
}
export function begin() {
  for (const o of touched) {
    const post = o.userData.post;
    if (post && o.quaternion.equals(post.q) && o.position.equals(post.p)) { o.quaternion.copy(o.userData.pre.q); o.position.copy(o.userData.pre.p); }
    o.userData.fresh = false;
  }
  touched.clear();
}
export function end() { for (const o of touched) o.userData.post = { q: o.quaternion.clone(), p: o.position.clone() }; }

export function bones(root) {
  if (root.userData.bones) return root.userData.bones;
  const b = {};
  root.traverse((o) => { if (o.isBone) b[o.name.replace(/^mixamorig:?/, '')] = o; });
  return (root.userData.bones = b);
}

// standing: hips, spine, legs back to the bind pose; arms dropped to the sides
export function stand(root, { armDrop = -32 } = {}) {
  const b = bones(root);
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot',
    'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand']) {
    const o = b[n]; if (!o || !REST.has(o)) continue;
    touch(o);
    o.quaternion.copy(REST.get(o).q); if (n === 'Hips') o.position.copy(REST.get(o).p);
  }
  for (const [n, side] of [['LeftArm', 1], ['RightArm', -1]]) if (b[n]) b[n].rotateX(side * THREE.MathUtils.degToRad(armDrop));
  root.updateMatrixWorld(true);
}

// the lowest foot point on the floor (Blender z = 0): a held seated take stood up keeps its old root height
export function plantFeet(root, floor = 0) {
  const b = bones(root), v = new THREE.Vector3();
  let low = Infinity;
  for (const n of ['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot', 'LeftToe_End', 'RightToe_End']) {
    if (!b[n]) continue; b[n].getWorldPosition(v); low = Math.min(low, v.y);
  }
  if (!isFinite(low)) return;
  root.position.y += floor + 0.025 - low;          // the toe bone sits ~2.5 cm above the sole
  root.updateMatrixWorld(true);
}

// head and neck pitch (degrees, + = chin up), shared 40/60; yaw turns the head
export function lookUp(root, deg = 0, yaw = 0) {
  if (!deg && !yaw) return;
  const b = bones(root), Q = new URLSearchParams(location.search);
  const ax = Q.get('lookaxis') || 'Z', sg = +(Q.get('looksign') ?? 1);
  for (const [n, k] of [['Neck', 0.4], ['Head', 0.6]]) {
    const o = b[n]; if (!o) continue; touch(o);
    o['rotate' + ax](sg * THREE.MathUtils.degToRad(deg * k));
    if (yaw) o.rotateY(THREE.MathUtils.degToRad(yaw * k));
  }
  root.updateMatrixWorld(true);
}

// rotate a bone so that its child at `from` (world) moves toward `to` (world), about the bone's own pivot
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
function aimBone(bone, childWorld, targetWorld) {
  touch(bone);
  bone.getWorldPosition(_p);
  _a.copy(childWorld).sub(_p).normalize(); _b.copy(targetWorld).sub(_p).normalize();
  _q.setFromUnitVectors(_a, _b);                                  // world-space delta
  bone.parent.getWorldQuaternion(_pq);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion());
  const nw = _q.multiply(wq);                                      // new world rotation
  bone.quaternion.copy(_pq.invert().multiply(nw));
  bone.updateMatrixWorld(true);
}

// two-bone IK: the hand's wrist to `target` (Blender metres -> three), elbow toward `pole` (a world direction)
export function reach(root, side, target, pole = new THREE.Vector3(0, -1, 0)) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right';
  const up = b[S + 'Arm'], fo = b[S + 'ForeArm'], ha = b[S + 'Hand'];
  if (!up || !fo || !ha) return;
  root.updateMatrixWorld(true);
  const s = up.getWorldPosition(new THREE.Vector3()), e = fo.getWorldPosition(new THREE.Vector3()), w = ha.getWorldPosition(new THREE.Vector3());
  const a = s.distanceTo(e), c = e.distanceTo(w);
  const d = Math.min(target.distanceTo(s), (a + c) * 0.999);
  const dir = target.clone().sub(s).normalize();
  // elbow: in the plane of (shoulder -> target, pole), at the law-of-cosines angle
  const cosA = (a * a + d * d - c * c) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const elbow = s.clone().add(dir.clone().multiplyScalar(a * cosA)).add(perp.multiplyScalar(a * sinA));
  aimBone(up, e, elbow);
  const w2 = ha.getWorldPosition(new THREE.Vector3());
  aimBone(fo, w2, s.clone().add(dir.multiplyScalar(d)));
}

// curl the fingers of one hand (a grip on a mug or phone), degrees per joint
export function grip(root, side, deg = 55) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right';
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (const j of [1, 2, 3]) { const o = b[`${S}Hand${f}${j}`]; if (o) touch(o); if (o) o.rotateZ((side === 'L' ? 1 : -1) * THREE.MathUtils.degToRad(deg)); }
  const th = b[`${S}HandThumb2`]; if (th) touch(th); if (th) th.rotateY(THREE.MathUtils.degToRad(side === 'L' ? -25 : 25));
  root.updateMatrixWorld(true);
}

// turn the hand (world) so its fingers run along `fingerDir` and its knuckles stack along `knuckleUp` (index on top)
export function orientHand(root, side, fingerDir, knuckleUp) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right';
  const ha = b[S + 'Hand'], m1 = b[S + 'HandMiddle1'], i1 = b[S + 'HandIndex1'], p1 = b[S + 'HandPinky1'];
  if (!ha || !m1 || !i1 || !p1) return;
  root.updateMatrixWorld(true);
  const W = (o) => o.getWorldPosition(new THREE.Vector3());
  const frame = (f, s) => { f = f.clone().normalize(); s = s.clone().addScaledVector(f, -s.dot(f)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, s, new THREE.Vector3().crossVectors(f, s))); };
  const qc = frame(W(m1).sub(W(ha)), W(i1).sub(W(p1))), qd = frame(fingerDir, knuckleUp);
  const delta = qd.multiply(qc.invert());
  const wq = ha.getWorldQuaternion(new THREE.Quaternion());
  const want = delta.multiply(wq);                                                // the hand's target world rotation
  // a wrist can bend but hardly twist: the roll about the forearm's axis is done by the forearm (pronation /
  // supination), the hand bone keeps only the bend. Without this the skin twists at the wrist like a wrapper.
  const fo = ha.parent;
  if (fo && fo.isBone) {
    const axis = W(ha).sub(W(fo)).normalize();                                    // the forearm's line, elbow to wrist
    const rel = want.clone().multiply(wq.clone().invert());                       // the change the hand needs (world)
    const v = new THREE.Vector3(rel.x, rel.y, rel.z), proj = axis.clone().multiplyScalar(v.dot(axis));
    const twist = new THREE.Quaternion(proj.x, proj.y, proj.z, rel.w).normalize(); // its twist about the forearm
    touch(fo);
    const fw = fo.getWorldQuaternion(new THREE.Quaternion()), fp = fo.parent.getWorldQuaternion(new THREE.Quaternion());
    fo.quaternion.copy(fp.invert().multiply(twist.clone().multiply(fw)));          // the forearm rolls (elbow stays put)
    root.updateMatrixWorld(true);
  }
  touch(ha);
  const pq = ha.parent.getWorldQuaternion(new THREE.Quaternion());
  ha.quaternion.copy(pq.invert().multiply(want));
  root.updateMatrixWorld(true);
}

// per-finger curl, degrees for joints 1-3; thumb: [toward the palm, bend] degrees
export function curl(root, side, fingers, thumb = [0, 0]) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right', sg = 1;   // Mixamo's mirrored hands curl about the same local axis
  for (const [f, js] of Object.entries(fingers)) js.forEach((d, j) => { const o = b[`${S}Hand${f}${j + 1}`]; if (!o) return; touch(o); o.rotateZ(sg * THREE.MathUtils.degToRad(d)); });
  const t1 = b[`${S}HandThumb1`], t2 = b[`${S}HandThumb2`], t3 = b[`${S}HandThumb3`];
  if (t1) { touch(t1); t1.rotateY(-sg * THREE.MathUtils.degToRad(thumb[0])); }
  for (const t of [t2, t3]) if (t) { touch(t); t.rotateZ(sg * THREE.MathUtils.degToRad(thumb[1])); }
  root.updateMatrixWorld(true);
}

// anatomical curl: each joint bends toward the palm about the world axis across its own segment (segment x palm
// normal), so every finger folds into the palm whatever its bone's local axes (the local-Z curl above twisted the
// ring and pinky sideways: claws). deg per joint [j1, j2, j3]; thumb [j1, j2, j3] folds across the palm, less
const _w = (o) => o.getWorldPosition(new THREE.Vector3());
function rotWorld(bone, axis, rad) {
  touch(bone);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion()), pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const d = new THREE.Quaternion().setFromAxisAngle(axis, rad);
  bone.quaternion.copy(pq.invert().multiply(d.multiply(wq)));
  bone.updateMatrixWorld(true);
}
// the palm's frame (world): centre, normal (out of the palm), the fingers' direction, the across (pinky to index)
export function palmFrame(root, side) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right';
  const i1 = b[S + 'HandIndex1'], p1 = b[S + 'HandPinky1'], m1 = b[S + 'HandMiddle1'], ha = b[S + 'Hand'];
  if (!i1 || !p1 || !m1 || !ha) return null;
  root.updateMatrixWorld(true);
  const across = _w(i1).sub(_w(p1)).normalize(), along = _w(m1).sub(_w(ha)).normalize();
  const normal = new THREE.Vector3().crossVectors(across, along).normalize().multiplyScalar(side === 'L' ? -1 : 1);   // measured (tools/_probe_fingers.mjs): the palm side is -n for the left hand, +n for the right
  return { centre: _w(ha).lerp(_w(m1), 0.6), normal, along, across };
}
export function curlAnat(root, side, fingers, thumb = [10, 15, 10]) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right';
  root.updateMatrixWorld(true);
  const i1 = b[S + 'HandIndex1'], p1 = b[S + 'HandPinky1'], m1 = b[S + 'HandMiddle1'], ha = b[S + 'Hand'];
  if (!i1 || !p1 || !m1 || !ha) return;
  const across = _w(i1).sub(_w(p1)).normalize(), along = _w(m1).sub(_w(ha)).normalize();
  const palm = new THREE.Vector3().crossVectors(across, along).normalize().multiplyScalar(side === 'L' ? -1 : 1);   // toward the palm (measured, see palmFrame)
  // start from straight fingers (bind pose): the performance's own curl must not stack under the grip
  for (const f of [...Object.keys(fingers), 'Thumb']) for (let j = 1; j <= 3; j++) { const o = b[`${S}Hand${f}${j}`]; if (o && REST.has(o)) { touch(o); o.quaternion.copy(REST.get(o).q); } }
  root.updateMatrixWorld(true);
  const chain = (name, degs) => {
    for (let j = 1; j <= 3; j++) {
      const o = b[`${S}Hand${name}${j}`], n = b[`${S}Hand${name}${j + 1}`] || (o && o.children.find((c) => c.isBone));
      if (!o || !n || !degs[j - 1]) continue;
      const seg = _w(n).sub(_w(o)).normalize();
      const axis = new THREE.Vector3().crossVectors(seg, palm).normalize();
      if (axis.lengthSq() < 1e-6) continue;
      rotWorld(o, axis, THREE.MathUtils.degToRad(degs[j - 1]));
    }
  };
  for (const [f, d] of Object.entries(fingers)) chain(f, d);
  chain('Thumb', thumb);
  root.updateMatrixWorld(true);
}

// the middle of the index and middle fingers' first segments (the part that goes through a mug handle), world
export function gripPoint(root, side) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right', p = new THREE.Vector3(), v = new THREE.Vector3();
  let n = 0;
  for (const k of ['Index1', 'Index2', 'Middle1', 'Middle2']) { const o = b[`${S}Hand${k}`]; if (o) { p.add(o.getWorldPosition(v)); n++; } }
  return n ? p.multiplyScalar(1 / n) : null;
}

// one finger out (Enter, a decisive key): the index back to its straight bind pose, the other three folded into the palm
export function pointIndex(root, side, press = 0) {
  const b = bones(root), S = side === 'L' ? 'Left' : 'Right';
  for (const j of [1, 2, 3]) { const o = b[`${S}HandIndex${j}`]; if (!o || !REST.has(o)) continue; touch(o); o.quaternion.copy(REST.get(o).q); o.rotateZ(THREE.MathUtils.degToRad([0, 9, 6, 4][j] + (j === 1 ? press : press * 0.3))); }   // round 14: near straight (was 12/8/8)
  for (const f of ['Middle', 'Ring', 'Pinky']) [70, 85, 60].forEach((d, j) => { const o = b[`${S}Hand${f}${j + 1}`]; if (!o) return; touch(o); o.quaternion.copy(REST.get(o)?.q || o.quaternion); o.rotateZ(THREE.MathUtils.degToRad(d)); });
  root.updateMatrixWorld(true);
}

export function handWorld(root, side) {
  const b = bones(root), h = b[(side === 'L' ? 'Left' : 'Right') + 'Hand'];
  const mid = b[(side === 'L' ? 'Left' : 'Right') + 'HandMiddle1'];
  const p = new THREE.Vector3(); (mid || h).getWorldPosition(p); return p;
}

// props: a ceramic mug (dark, warm rim light catches it) and a phone with a live screen
export function makeMug() {
  const g = new THREE.Group(); g.name = 'Mug (prop)';
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x2a2c33, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.038, 0.098, 28, 1, true), mat);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 28), mat); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.049;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 28), new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.15 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.03;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0065, 10, 24, Math.PI * 1.25), mat);
  handle.position.x = 0.044; handle.rotation.z = -Math.PI * 0.62;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0395, 0.0024, 10, 48), mat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.049;   // a rounded lip, not a raw edge
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0355, 0.096, 28, 1, true), mat); inner.material = mat.clone(); inner.material.side = THREE.BackSide; inner.position.y = 0.001;
  for (const m of [body, bottom, coffee, handle, rim, inner]) { m.castShadow = true; g.add(m); }
  g.visible = false; return g;
}

export function makePhone(canvas) {
  const g = new THREE.Group(); g.name = 'Phone (prop)';
  const bodyM = new THREE.MeshPhysicalMaterial({ color: 0x15171c, roughness: 0.35, metalness: 0.3, clearcoat: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.152, 0.008), bodyM);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.143), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3) }));
  screen.position.z = 0.0042; g.add(body, screen); g.userData.tex = tex;
  g.visible = false; return g;
}
