// Geometry helpers shared by the studies: lofts (limbs, torsos, lathe-like props), world-scaled box UVs,
// and placing a segment between two joints (an explicit skeleton: joints are points, meshes are aimed at them).
import * as THREE from 'three';

// rings: [{ t, rx, rz, x?, z? }], t in 0..1 along the length (local -y); sides: ring resolution.
// arc: [a0, a1] in turns to make an open shell (hair skirts); caps close the ends.
export function loft(rings, { length = 1, sides = 8, capStart = false, capEnd = true, arc = null, flip = false } = {}) {
  const pos = [], uv = [], idx = [];
  const a0 = arc ? arc[0] : 0, a1 = arc ? arc[1] : 1;
  const cols = sides + 1;
  rings.forEach((r, i) => {
    for (let j = 0; j <= sides; j++) {
      const th = (a0 + (a1 - a0) * j / sides) * Math.PI * 2;
      pos.push((r.x || 0) + r.rx * Math.cos(th), -r.t * length, (r.z || 0) + r.rz * Math.sin(th));
      uv.push(j / sides, 1 - i / (rings.length - 1));
    }
  });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);   // outward normals
  }
  const cap = (ri, dir) => {
    const r = rings[ri], center = pos.length / 3;
    pos.push(r.x || 0, -r.t * length, r.z || 0); uv.push(0.5, ri === 0 ? 1 : 0);
    for (let j = 0; j < sides; j++) {
      const a = ri * cols + j, b = a + 1;
      if (dir > 0) idx.push(center, a, b); else idx.push(center, b, a);
    }
  };
  if (capStart) cap(0, flip ? 1 : -1);
  if (capEnd) cap(rings.length - 1, flip ? -1 : 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!arc) {   // weld the UV seam's normals so closed lofts shade smoothly all round
    const n = g.attributes.normal;
    for (let i = 0; i < rings.length; i++) {
      const a = i * cols, b = a + sides;
      const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
      n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
    }
  }
  return g;
}

// Aim an object whose length runs along local -y so it spans joint a -> joint b, with local +z toward `front`.
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
export function aim(obj, a, b, front = new THREE.Vector3(0, 0, 1), scaleToLength = null) {
  _y.subVectors(a, b); const len = _y.length(); _y.normalize();                 // local +y points back toward a
  _z.copy(front).addScaledVector(_y, -front.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.set(1, 0, 0).addScaledVector(_y, -_y.x);
  _z.normalize(); _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  obj.position.copy(a);
  obj.quaternion.setFromRotationMatrix(_m);
  if (scaleToLength) obj.scale.set(1, len / scaleToLength, 1);
  return len;
}

// Box with UVs in metres (u, v = world size / tile), so textures keep their scale on any box.
export function box(w, h, d, tile = 1, { tileU = tile, tileV = tile } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tileU, uv.getY(i) * dims[f][1] / tileV);
  }
  return g;
}

// A plane w x h with its UVs scaled to repeat every `tile` metres (or exactly once when tile = null).
export function quad(w, h, tile = null) {
  const g = new THREE.PlaneGeometry(w, h);
  if (tile) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile); }
  return g;
}

// An extruded 2D profile (points [[a, b], ...] in the profile plane) along +z for `length`; UVs in metres.
export function extrude(profile, length, { curveSegments = 1 } = {}) {
  const s = new THREE.Shape(profile.map(([a, b]) => new THREE.Vector2(a, b)));
  return new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments });
}
