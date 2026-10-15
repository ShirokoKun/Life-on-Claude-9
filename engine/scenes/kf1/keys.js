// Legends on the laptop keys (the macro keyframes: "Ivan keeps saying yes", "one more module", "Enter"). The keys
// are one merged mesh with world-scale box UVs, so a texture can't place letters: instead each key top is found in
// the mesh (clusters of upward-facing vertices), and a small glyph decal sits on it. A faint warm backlight shows
// through the glyphs, as on the references' laptops.
import * as THREE from 'three';

const ROWS = ['`1234567890-=', 'QWERTYUIOP[]', 'ASDFGHJKL;\'', 'ZXCVBNM,./'];
const GLYPHS = [...new Set(ROWS.join('') + '⌫⇥⇪⏎⇧␣⌘⌥')];

export function addKeyLegends(root, scene) {
  let keys = null;
  root.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'Keys') keys = o; });
  if (!keys) return null;
  keys.updateWorldMatrix(true, false);
  const pos = keys.geometry.attributes.position, idx = keys.geometry.index;
  const P = [], N = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) P.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(keys.matrixWorld));
  const tri = idx ? (i) => idx.getX(i) : (i) => i, nTri = (idx ? idx.count : pos.count) / 3;
  let maxY = -Infinity;
  for (const p of P) maxY = Math.max(maxY, p.y);
  // key tops: up-facing triangles at the top; a key is a connected patch of them (shared corners, by position)
  const parent = new Map(), find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
  const kOf = (p) => Math.round(p.x * 1e4) + ',' + Math.round(p.z * 1e4);
  const topTris = [];
  for (let t = 0; t < nTri; t++) {
    const A = P[tri(3 * t)], Bv = P[tri(3 * t + 1)], C = P[tri(3 * t + 2)];
    N.crossVectors(e1.subVectors(Bv, A), e2.subVectors(C, A)).normalize();
    if (Math.abs(N.y) < 0.92 || Math.min(A.y, Bv.y, C.y) < maxY - 0.004) continue;
    const ks = [A, Bv, C].map(kOf);
    ks.forEach((k) => { if (!parent.has(k)) parent.set(k, k); });
    unite(ks[0], ks[1]); unite(ks[0], ks[2]);
    topTris.push([A, Bv, C, ks[0]]);
  }
  const groups = new Map();
  for (const [A, Bv, C, k] of topTris) {
    const r = find(k); let c = groups.get(r);
    if (!c) groups.set(r, (c = { n: 0, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y: -Infinity }));
    for (const p of [A, Bv, C]) { c.n++; c.x0 = Math.min(c.x0, p.x); c.x1 = Math.max(c.x1, p.x); c.z0 = Math.min(c.z0, p.z); c.z1 = Math.max(c.z1, p.z); c.y = Math.max(c.y, p.y); }
  }
  const cl = [...groups.values()].map((c) => Object.assign(c, { cx: (c.x0 + c.x1) / 2, cz: (c.z0 + c.z1) / 2 }));
  // a deck or plate that is one big patch is not a key
  const med = cl.map((c) => c.x1 - c.x0).sort((a, b) => a - b)[cl.length >> 1] || 0.015;
  const keysTop = cl.filter((c) => c.x1 - c.x0 > 0.006 && c.x1 - c.x0 < med * 8 && c.z1 - c.z0 < med * 1.6);
  if (!keysTop.length) { console.warn('key legends: no key tops', cl.length); return null; }
  // rows by depth (Blender y = -three z): the row nearest the screen is the number row
  keysTop.sort((a, b) => a.cz - b.cz || a.cx - b.cx);
  const rows = [];
  for (const k of keysTop) { const r = rows.find((r) => Math.abs(r.z - k.cz) < 0.006); if (r) r.k.push(k); else rows.push({ z: k.cz, k: [k] }); }
  rows.sort((a, b) => a.z - b.z);

  // glyph atlas: 8 x 8 cells
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 46px "Segoe UI", Arial, sans-serif';
  GLYPHS.forEach((ch, i) => g.fillText(ch === '␣' ? '' : ch, (i % 8) * 64 + 32, Math.floor(i / 8) * 64 + 34));
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.22, 0.85), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aCell;\n' + sh.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n  vMapUv = (uv + vec2(mod(aCell, 8.0), 7.0 - floor(aCell / 8.0))) / 8.0;');
  };
  const all = rows.flatMap((r, ri) => r.k.sort((a, b) => a.cx - b.cx).map((k, ci) => ({ k, ri, ci, len: r.k.length })));
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, all.length);
  const cell = new Float32Array(all.length);
  const m4 = new THREE.Matrix4();
  all.forEach(({ k, ri, ci, len }, i) => {
    const w = k.x1 - k.x0, d = k.z1 - k.z0;
    const map = ri - (rows.length - ROWS.length) >= 0 ? ROWS[ri - (rows.length - ROWS.length)] : null;   // rows above the number row (function keys): blank
    let ch = '␣';
    if (w > 0.03) ch = ri === rows.length - 1 ? '␣' : ci === 0 ? '⇧' : '⏎';
    else if (map) ch = map[Math.min(map.length - 1, Math.max(0, ci - Math.floor((len - map.length) / 2)))];
    cell[i] = Math.max(0, GLYPHS.indexOf(ch));
    const s = Math.min(w, d) * 0.9;
    m4.compose(new THREE.Vector3(k.cx, k.y + 0.0003, k.cz), new THREE.Quaternion(), new THREE.Vector3(s, 1, s));
    mesh.setMatrixAt(i, m4);
  });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 1));
  mesh.frustumCulled = false; mesh.name = 'Key legends';
  scene.add(mesh);
  return mesh;
}
