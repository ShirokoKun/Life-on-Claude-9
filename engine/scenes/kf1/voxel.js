// Voxel pixel-art in the room: the PS1/PS2 layer of Chapter 1 (scenes/ch1-keyframes/KEYFRAMES.md, "the zone").
// Everything magical is built from little cubes drawn as ASCII pixel art: Claude, the four module icons, the
// envelopes, the door. One shader for all of it, so it reads as one world inside the photographed room:
//   - vertices snap to a coarse screen grid (the PS1 wobble, frozen in a still as stair-stepped edges);
//   - flat per-face shade (top lit, sides darker), no texture filtering;
//   - colour quantised with a 4x4 Bayer dither (16 levels per channel);
//   - HDR colour, so the film's own bloom makes the glow (post.js stays untouched).
// It writes depth, so the lens focuses on it where it is.
import * as THREE from 'three';

const VERT = /* glsl */ `
uniform vec2 uSnap;
uniform float uGlitch;
uniform float uTime;
varying vec3 vColor;
varying vec3 vN;
varying float vDepth;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  mat4 im = mat4(1.0);
#ifdef USE_INSTANCING
  im = instanceMatrix;
#endif
  vColor = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  // glitch: whole voxels jump sideways for a frame (the system fraying)
  float id = im[3][0] * 91.7 + im[3][1] * 47.3 + im[3][2] * 13.1;
  float g = step(1.0 - uGlitch, h(id + floor(uTime * 12.0)));
  wp.xyz += g * (vec3(h(id + 1.0), h(id + 2.0), h(id + 3.0)) - 0.5) * 0.08 * uGlitch;
  vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vec4 cp = projectionMatrix * viewMatrix * wp;
  cp.xy = floor(cp.xy / cp.w * uSnap + 0.5) / uSnap * cp.w;      // the PS1 grid
  vDepth = cp.w;
  gl_Position = cp;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
uniform vec3 uLight;
uniform float uLevels;
varying vec3 vColor;
varying vec3 vN;
varying float vDepth;
float bayer(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return float(m[i]) / 16.0 - 0.5;
}
void main() {
  vec3 n = normalize(vN);
  float shade = 0.62 + 0.38 * max(dot(n, normalize(uLight)), 0.0) + 0.12 * max(n.y, 0.0);
  vec3 c = vColor * uColor * shade;
  // quantise in a perceptual-ish space, dithered on 2x2 screen pixels (chunky, like a 320-wide frame upscaled)
  vec3 e = pow(max(c, 0.0) / max(uGlow, 1e-3), vec3(1.0 / 2.2));
  e = floor(e * uLevels + 0.5 + bayer(floor(gl_FragCoord.xy / 2.0))) / uLevels;
  c = pow(max(e, 0.0), vec3(2.2)) * uGlow;
  gl_FragColor = vec4(c, 1.0);
}`;

// one material per object, so each can glow and glitch on its own
export function voxelMaterial({ color = [1, 1, 1], glow = 1, snap = [240, 135] } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: false,
    uniforms: {
      uColor: { value: new THREE.Color(...color) }, uGlow: { value: glow }, uSnap: { value: new THREE.Vector2(...snap) },
      uLight: { value: new THREE.Vector3(-0.4, 1, 0.6) }, uLevels: { value: 15 }, uGlitch: { value: 0 }, uTime: { value: 0 },
    },
  });
}

// ASCII pixel art -> an InstancedMesh of cubes. rows: front view, top row first; each char a palette key, '.' empty.
// depth: how many voxels deep; depthMap: optional per-char depth override (eyes inset, etc.). Centred on x, the
// bottom row sits on y = 0, the front face at z = +depth/2.
export function voxels(rows, palette, { size = 0.01, depth = 1, depthOf = {}, frontOnly = {}, material } = {}) {
  const cells = [];
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.' || ch === ' ' || !palette[ch]) return;
    const d = depthOf[ch] ?? depth;
    for (let k = 0; k < d; k++) {
      const z = (depth - 1) / 2 - k;                         // front layer first
      const col = frontOnly[ch] && k > 0 ? palette[frontOnly[ch]] : palette[ch];
      cells.push({ x: i - (W - 1) / 2, y: H - 1 - j, z, col, ch: frontOnly[ch] && k > 0 ? frontOnly[ch] : ch });
    }
  }));
  const geo = new THREE.BoxGeometry(size, size, size);
  const mesh = new THREE.InstancedMesh(geo, material || voxelMaterial(), cells.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  cells.forEach((v, i) => {
    m.makeTranslation(v.x * size, (v.y + 0.5) * size, v.z * size);
    mesh.setMatrixAt(i, m);
    // pixel-art shading baked into the colours: top rows a touch lighter, lower rows darker
    const k = 0.86 + 0.22 * (v.y / Math.max(1, H - 1));
    mesh.setColorAt(i, c.setRGB(...v.col).multiplyScalar(k));
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  mesh.userData.cells = cells; mesh.userData.size = size;
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
  return mesh;
}

// scatter/assemble: k = 1 fully built, 0 = the voxels flung out (materialising or dissolving)
export function assemble(mesh, k, { spread = 6, seed = 1 } = {}) {
  const { cells, size } = mesh.userData;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  const rnd = (n) => { const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
  cells.forEach((v, i) => {
    const own = THREE.MathUtils.clamp(k * 1.6 - rnd(i * 3.1) * 0.6, 0, 1);    // each voxel arrives at its own time
    const ease = 1 - Math.pow(1 - own, 3);
    const off = (1 - ease) * spread;
    const p = new THREE.Vector3((v.x + (rnd(i) - 0.5) * off * 2) * size, (v.y + 0.5 + (rnd(i + 7) - 0.3) * off * 2) * size,
      (v.z + (rnd(i + 13) - 0.5) * off * 2) * size);
    e.set((1 - ease) * rnd(i + 5) * 3, (1 - ease) * rnd(i + 9) * 3, 0); q.setFromEuler(e);
    s.setScalar(0.35 + 0.65 * ease);
    mesh.setMatrixAt(i, m.compose(p, q, s));
  });
  mesh.instanceMatrix.needsUpdate = true;
}

export const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
