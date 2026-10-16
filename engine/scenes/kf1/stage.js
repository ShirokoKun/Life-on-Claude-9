// The zone: where the room falls away when Ivan's mind leaves it (scenes/ch1-keyframes/KEYFRAMES.md).
// Built in code, all of it voxel.js material (writes depth: real lens blur; glow = the film's bloom on HDR colour).
// Palette: teal and orange (the director's references, IVAN vs AI renders), on near-black.
// Modes:
//   iso       V13, V24  the desk alone in black (ref "Group 9"): the room is gone, the desk, chair and screens remain
//   cheat     V15       teal-orange retro world, his desk floating in it: the only wide, warm-cool open frame
//   down      V16       seen from above, he stands looking up; soft bars of red, orange, peach and cyan drift below
//   dome      V17a/b    streaks in rings around him like a planetarium (refs "Group 5", "Group 10", "Group 11")
//   door      V17c      a tunnel of streaks converging on a slot of white light
//   tower     V25       cold: the thing he built towers over the desk, his warm light flowing into it
//   monolith  V27       pale sky, a dark tower of lit windows, Ivan tiny at its foot (board r4c5)
import * as THREE from 'three';
import { voxelMaterial, voxels, hex } from './voxel.js';
// above 1080p, effects sized in screen pixels (dither, line widths) scale up so a 4K frame keeps the 1080p look; <= 1080p unchanged
const PX = Math.max(1, (globalThis.innerHeight || 1080) / 1080);

const B = (x, y, z) => new THREE.Vector3(x, z, -y);
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const SKY = {
  iso:      { top: '#000000', mid: '#000000', low: '#000000', k: 1, band: 4 },
  cheat:    { top: '#000000', mid: '#0a0418', low: '#1e0a3a', k: 1.0, band: 14 },   // round 14: black into a very dark violet (the round 13 magenta horizon read as a stage backdrop)
  down:     { top: '#000000', mid: '#010203', low: '#030507', k: 1, band: 6 },
  dome:     { top: '#000000', mid: '#020304', low: '#05080a', k: 1, band: 6 },
  door:     { top: '#010205', mid: '#03111a', low: '#0a2a33', k: 1.2, band: 8 },
  tower:    { top: '#000205', mid: '#04121c', low: '#0a2433', k: 1.0, band: 8 },
  monolith: { top: '#9fb2c2', mid: '#d6dde3', low: '#eef0f0', k: 1.25, band: 12 },
  balcony:  { top: '#000103', mid: '#03070e', low: '#0b1220', k: 1.0, band: 10 },
  drown:    { top: '#000000', mid: '#010405', low: '#03080a', k: 1.0, band: 6 },
};
const GRID = { cheat: ['#f2efff', 0.62], down: ['#0c1820', 0.25], dome: ['#0c1820', 0.2], door: ['#2a6a7a', 0.6], tower: ['#2a5a88', 0.9],
  iso: ['#000000', 0], monolith: ['#b9c0c4', 0.0], balcony: ['#000000', 0], drown: ['#000000', 0] };
const TEAL_ORANGE = ['#ff7a2a', '#ffb070', '#ffd9c4', '#3fd8e0', '#1fa8b8', '#ff3b1f', '#ffe7cf', '#6ff0ff'].map(hex);

export function createStage(scene, { center = [1.04, 3.95] } = {}) {
  const group = new THREE.Group(); group.name = 'Zone'; group.visible = false;
  scene.add(group);
  const C = center;
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), q0 = new THREE.Quaternion();

  // sky: a dithered three-stop gradient (banded like a 15-bit framebuffer)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: true, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, k: { value: 1 }, band: { value: 8 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, low; uniform float k, band; varying vec3 vP;
      float bayer(vec2 p){ ivec2 q = ivec2(mod(p,4.)); int i = q.x + q.y*4;
        int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[i])/16.-.5; }
      void main(){ float y = vP.y; float u = clamp(y*2.2+0.25, 0., 1.);
        u = floor(u*band + 0.5 + bayer(floor(gl_FragCoord.xy/(2.*${PX.toFixed(4)}))))/band;
        vec3 c = u < .5 ? mix(low, mid, u*2.) : mix(mid, top, u*2.-1.);
        gl_FragColor = vec4(c*k, 1.); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), skyMat);
  sky.position.copy(B(C[0], C[1], 0)); group.add(sky);

  // the floor: thin glowing lines every half metre fading into the distance (or a plain pale ground)
  const gridMat = new THREE.ShaderMaterial({
    fog: false, uniforms: { col: { value: new THREE.Color() }, k: { value: 1 }, base: { value: new THREE.Color() }, c: { value: B(C[0], C[1], 0) }, rev: { value: 1e4 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 col, c, base; uniform float k, rev; varying vec3 vW;
      void main(){ vec2 p = vW.xz/0.5; vec2 fw = fwidth(p) * ${PX.toFixed(4)}; vec2 g = abs(fract(p-.5)-.5)/fw; float l = 1.-min(min(g.x,g.y),1.);
        float d = length(vW.xz-c.xz); float f = exp(-d*0.06) * (1.0 - smoothstep(0.35, 1.0, max(fw.x, fw.y)));   // lines thin out before they moire
        f *= 1.0 - smoothstep(rev - 1.5, rev, d);                                        // revealed outward from his desk
        gl_FragColor = vec4(base + col*0.02 + col*l*k*f, 1.); }`,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), gridMat); grid.userData.glow = 0.6;
  grid.rotation.x = -Math.PI / 2; grid.position.copy(B(C[0], C[1], -0.002)); group.add(grid);

  // shards: low-poly gems drifting at all depths (the game world's "air")
  const shardMat = voxelMaterial({ glow: 1 });
  const NS = 80;
  const shards = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.18, 0), shardMat, NS);
  const shardPal = { cheat: ['#ffffff', '#b89cff', '#7a5cff', '#3fe0d0', '#ff9a4d', '#e8dcff'], tower: ['#3a7aa8', '#5ab8ff', '#a8e0ff', '#1a3a55'] };
  shards.frustumCulled = false; group.add(shards);

  // streaks: thin light bars, warm and teal, laid out per mode
  const NK = 420;
  const streakMat = voxelMaterial({ glow: 1, snap: [960, 540] });
  streakMat.uniforms.uLevels.value = 32;
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), streakMat, NK); streaks.userData.glow = 1;
  streaks.frustumCulled = false; group.add(streaks);

  // round 14 (K25, ref R5): two or three bars of code light passing right under the lens, between us and him, so close
  // that the lens melts them (focus far, on his face): a red-orange band with lighter lines of code inside, the code
  // smeared sideways as if moving. Laid out in the camera's own frame (screen row, distance from the lens), so they
  // stay where the frame needs them; they write depth (the lens blurs them as the near things they are).
  const FG = [
    // v: screen row (-1 bottom .. 1 top), d: metres from the lens, x: centre (-1 left .. 1 right), len / th: frame widths / heights, sp: frame widths a second
    { v: -0.30, d: 0.30, x: -0.10, len: 1.55, th: 0.13, sp: 0.020, k: 1.0, seed: 1 },
    { v: -0.96, d: 0.26, x: 0.25, len: 1.85, th: 0.10, sp: -0.014, k: 0.85, seed: 2 },
    { v: 0.50, d: 0.34, x: -1.05, len: 0.62, th: 0.07, sp: 0.026, k: 0.6, seed: 3 },
  ];
  const CODE = ['const day = automate(inbox, calendar, docs);', 'for (const task of life) task.done = true;', 'if (hours > minutes) return claude.build(next);',
    'await sort(drafts).then(review).then(approve);', 'export default function cheat(code) { return code; }', 'while (awake) ship(module++);'];
  const fgGroup = new THREE.Group(); fgGroup.visible = false; group.add(fgGroup);
  const fgBars = FG.map((b, i) => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 96; const g = c.getContext('2d');
    // segments ("statements") of three kinds, as in R5: hot (a peach-white core in an orange band), warm (orange, a
    // lighter core) and dim red; darker gaps between them. The large-scale variation is what survives the lens blur.
    const KIND = [['rgba(255,70,30,', 'rgba(255,150,90,', 'rgba(255,236,214,'], ['rgba(240,60,26,', 'rgba(255,110,52,', 'rgba(255,190,140,'], ['rgba(170,26,14,', 'rgba(220,48,24,', 'rgba(255,96,52,']];
    let x = -40 * rnd(b.seed), k = 0;
    while (x < 2048) {
      const w = 220 + rnd(b.seed * 31 + k) * 700, gap = 18 + rnd(b.seed * 17 + k) * 90, r = rnd(b.seed * 13 + k);
      const K = KIND[r > 0.62 ? 0 : r > 0.25 ? 1 : 2], a0 = 0.75 + 0.25 * rnd(b.seed * 7 + k);
      const band = g.createLinearGradient(0, 0, 0, 96);
      band.addColorStop(0, K[0] + '0)'); band.addColorStop(0.22, K[0] + (0.8 * a0) + ')'); band.addColorStop(0.4, K[1] + a0 + ')');
      band.addColorStop(0.5, K[2] + a0 + ')'); band.addColorStop(0.6, K[1] + a0 + ')'); band.addColorStop(0.78, K[0] + (0.8 * a0) + ')'); band.addColorStop(1, K[0] + '0)');
      g.fillStyle = band; g.fillRect(x, 0, w, 96);
      // the code inside: lighter, drawn several times shifted sideways (a motion smear)
      g.save(); g.beginPath(); g.rect(x + 8, 0, w - 16, 96); g.clip();
      g.font = 'bold 54px "Courier New", monospace'; g.textBaseline = 'middle';
      const line = CODE[(b.seed * 3 + k) % CODE.length];
      for (let s2 = 0; s2 < 6; s2++) { g.globalAlpha = 0.3 * (1 - s2 / 7); g.fillStyle = K === KIND[2] ? '#ff9a6a' : '#fff4ea'; g.fillText(line, x + 12 + s2 * 9, 50); }
      g.restore(); g.globalAlpha = 1;
      x += w + gap; k++;
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: true, alphaTest: 0.12,
      color: new THREE.Color(1, 1, 1).multiplyScalar(0.9 * b.k), fog: false, side: THREE.DoubleSide, toneMapped: true }));
    m.frustumCulled = false; m.renderOrder = 2; fgGroup.add(m);   // (no deep glow: the bars flooded the frame red)
    return m;
  });
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  function layFg(cam, age) {
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion),
      upv = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    FG.forEach((b, i) => {
      const hh = b.d * tanH, hw = hh * cam.aspect, m = fgBars[i];
      const x = b.x + b.sp * age;
      m.position.copy(cam.position).addScaledVector(fwd, b.d).addScaledVector(upv, b.v * hh).addScaledVector(right, x * hw);
      m.quaternion.copy(cam.quaternion); m.scale.set(b.len * 2 * hw, b.th * 2 * hh, 1);
    });
  }

  // round 14 (K24 "a cheat code for life", rebuilt): he has figured it out. Not his room: he stands alone in a night
  // void (black into a very dark violet, stars), lit from straight above by the code he solved. The six life-ups fly
  // in from the dark and snap into their slots on a ring round his waist, one by one; each snap turns the light above
  // him up a step; when the last one locks, a dotted line runs round the ring and joins them (the puzzle solved).
  // the ring: 'h' lies round his waist; 'v' stands upright just behind him, facing the lens (he is framed inside it)
  let RING = { o: 'v', r: 1.22, rz: 0.82, z: 1.18, back: 0.30 };
  const LIFE_A0 = Math.PI / 2;
  const ringAt = (a) => RING.o === 'v' ? [figure.x + Math.cos(a) * RING.r, figure.y - RING.back, RING.z + Math.sin(a) * (RING.rz ?? RING.r)]
    : [figure.x + Math.cos(a) * RING.r, figure.y + Math.sin(a) * RING.r, RING.z];
  const lifeSlot = (i, n = 6) => ringAt(LIFE_A0 + (i + 0.5) / n * Math.PI * 2);   // 'v': none at the top or bottom (behind his legs)
  const NR = 96;
  const ringDots = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), voxelMaterial({ color: [1, 1, 1], glow: 2.2 }), NR); ringDots.userData.glow = 0.8;
  ringDots.frustumCulled = false; ringDots.visible = false; group.add(ringDots);
  const top = new THREE.SpotLight(0xffe9d2, 0, 9, THREE.MathUtils.degToRad(17), 0.85, 1.4);
  group.add(top, top.target);
  // a halo of the solved code over him: a faint ring of light high above, the source of the top light (just in frame)
  const crownTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,240,226,0.55)'); gr.addColorStop(0.18, 'rgba(255,226,200,0.2)');
    gr.addColorStop(0.5, 'rgba(176,140,255,0.05)'); gr.addColorStop(1, 'rgba(120,90,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const crown = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: crownTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
  crown.visible = false; group.add(crown);
  // the place he stands: two thin white circles on nothing (a spawn point, R3's outline language), lit by the light above
  const padTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256); gr.addColorStop(0, 'rgba(255,236,214,0.30)'); gr.addColorStop(0.35, 'rgba(255,220,190,0.10)'); gr.addColorStop(0.7, 'rgba(160,130,255,0.02)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 150, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; g.setLineDash([10, 14]); g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();
    return new THREE.CanvasTexture(c); })();
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pad.rotation.x = -Math.PI / 2; pad.visible = false; group.add(pad);
  // motes: a few hundred fine specks of light hanging round him, white and violet, drifting up (the magic is small)
  const NMO = 420, moP = new Float32Array(NMO * 3), moC = new Float32Array(NMO * 3);
  const motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.022, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  motes.geometry.setAttribute('position', new THREE.BufferAttribute(moP, 3)); motes.geometry.setAttribute('color', new THREE.BufferAttribute(moC, 3));
  motes.frustumCulled = false; motes.visible = false; group.add(motes);

  // round 14 (K26-K27, ref R5 frame 3): a tunnel of light round him. Short curved streaks, warm (amber, orange, cream,
  // a few pale cool whites), each a piece of a helix about an axis running from his head forward and a little up:
  // they swirl round the axis and stream back along it. From behind him (K26) the swirl reads as curves round him;
  // as the camera comes round to his profile (flow F4, K27) the axial run takes over and they straighten into lines.
  // Some pass close to the lens, where the lens melts them. Each streak is a camera-facing ribbon bent in the shader.
  const NT = 900, SEG = 14;
  const tunGeo = new THREE.InstancedBufferGeometry();
  { const pos = [], idx = [];
    for (let k = 0; k <= SEG; k++) { pos.push(k / SEG, -1, 0, k / SEG, 1, 0); if (k < SEG) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    tunGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tunGeo.setIndex(idx); }
  const tA = new Float32Array(NT * 4), tB = new Float32Array(NT * 4), tC = new Float32Array(NT * 3);
  const TUN_COL = [['#ff8a3a', '#ffe2c0'], ['#ffb062', '#fff1dc'], ['#ff6a2a', '#ffc890'], ['#ffd29a', '#fff8ee'], ['#9fdcff', '#eef8ff'], ['#ff9a4d', '#ffe7cf']];
  for (let i = 0; i < NT; i++) {
    const r = 0.55 + Math.pow(rnd(i * 2.3), 0.65) * 4.6;                    // radius about the axis
    tA.set([rnd(i * 1.7) * Math.PI * 2, r, rnd(i * 3.1), 0.16 + rnd(i * 4.3) * 0.3], i * 4);   // theta0, r, s0 (0..1), dTheta: mostly round the axis (curves from behind, edge-on lines from the side)
    tB.set([0.25 + rnd(i * 5.7) * 0.8, (0.008 + rnd(i * 6.1) * 0.02) * (0.6 + r * 0.25), 0.35 + Math.pow(rnd(i * 7.3), 2.0) * 1.6, rnd(i * 8.9)], i * 4);   // most dim, a few hot   // dS (m), half-width (m), gain, seed
    const ci = rnd(i * 11.3) > 0.93 ? 4 : Math.floor(rnd(i * 12.7) * 6) % 6 === 4 ? 0 : Math.floor(rnd(i * 12.7) * 6) % 6;
    tC.set([ci, 0, 0], i * 3);
  }
  tunGeo.setAttribute('aA', new THREE.InstancedBufferAttribute(tA, 4)); tunGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(tB, 4)); tunGeo.setAttribute('aC', new THREE.InstancedBufferAttribute(tC, 3));
  tunGeo.instanceCount = NT;
  const tunMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uO: { value: new THREE.Vector3() }, uD: { value: new THREE.Vector3(0, 0, -1) }, uU: { value: new THREE.Vector3(1, 0, 0) }, uV: { value: new THREE.Vector3(0, 1, 0) },
      uS0: { value: -3 }, uS1: { value: 26 }, uVs: { value: 2.2 }, uVa: { value: 0.35 }, uK: { value: 1 },
      uEdge: { value: TUN_COL.map((c) => new THREE.Color(c[0])) }, uCore: { value: TUN_COL.map((c) => new THREE.Color(c[1])) } },
    vertexShader: `attribute vec4 aA, aB; attribute vec3 aC; uniform float uT, uS0, uS1, uVs, uVa; uniform vec3 uO, uD, uU, uV;
      varying vec2 vQ; varying float vF, vCi, vK;
      vec3 P(float u, float s, float th) { float a = th + u * aA.w; return uO + uD * (s + u * aB.x) + (uU * cos(a) + uV * sin(a)) * aA.y; }
      void main() {
        float L = uS1 - uS0, sp = uVs * (0.55 + 0.9 * aB.w);
        float s = uS0 + mod(aA.z * L - uT * sp, L);                                   // streaming back toward us
        float th = aA.x + uT * uVa * (0.6 + 0.8 * aB.w) / max(aA.y, 0.6);             // the swirl, faster near the axis
        float u = position.x;
        vec3 p = P(u, s, th), q = P(min(u + 0.04, 1.0), s, th) - P(max(u - 0.04, 0.0), s, th);
        vec3 tg = normalize(q), vw = normalize(cameraPosition - p);
        vec3 side = cross(tg, vw); float sl = length(side); side = sl > 1e-4 ? side / sl : uU;
        float taper = sin(3.14159 * clamp(u, 0.0, 1.0));
        float dc = distance(p, cameraPosition);
        float nearK = smoothstep(0.18, 0.45, dc);                                     // never a slab across the lens
        float ends = smoothstep(uS0, uS0 + 2.0, s) * (1.0 - smoothstep(uS1 - 6.0, uS1, s));
        p += side * position.y * aB.y * (0.35 + 0.65 * taper) * nearK;
        vQ = vec2(u, position.y); vF = ends * nearK; vCi = aC.x; vK = aB.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uEdge[6], uCore[6]; uniform float uK; varying vec2 vQ; varying float vF, vCi, vK;
      void main() {
        int ci = int(vCi + 0.5); vec3 e = uEdge[0], c = uCore[0];
        for (int i = 0; i < 6; i++) if (i == ci) { e = uEdge[i]; c = uCore[i]; }
        float x = abs(vQ.y), prof = exp(-x * x * 3.2), core = exp(-x * x * 14.0);
        float along = pow(max(vQ.x, 0.0), 0.7) * (1.0 - smoothstep(0.88, 1.0, vQ.x) * 0.6);   // a trail: bright head, fading tail
        vec3 col = mix(e, c, core) * prof * along * vK * vF * uK;
        if (max(col.r, max(col.g, col.b)) < 0.004) discard;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const tunnel = new THREE.Mesh(tunGeo, tunMat); tunnel.frustumCulled = false; tunnel.visible = false; tunnel.userData.glow = 0.5; group.add(tunnel);

  // the door: a slot of white light, 0.95 x 2.3 m
  const doorMat = voxelMaterial({ color: [1, 1, 1], glow: 9 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.3, 0.06), doorMat);
  door.visible = false; group.add(door);

  // a pool of light at his feet: a soft disc that blooms
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(190,225,255,0.5)'); gr.addColorStop(0.35, 'rgba(120,180,255,0.18)'); gr.addColorStop(1, 'rgba(90,140,255,0)');   // round 13: cool (was a beige disc)
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), poolMat); pool.rotation.x = -Math.PI / 2;
  pool.visible = false; group.add(pool);
  // round 13: the stage light it comes from: a soft beam down through the dark (ref: headlight cones in haze)
  const beamTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(160,200,255,0)'); gr.addColorStop(0.55, 'rgba(160,200,255,0.022)'); gr.addColorStop(1, 'rgba(190,225,255,0.075)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); })();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.62, 5.5, 40, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  shaft.visible = false; group.add(shaft);

  // everyone else: grey low-poly people, far off, walking at normal speed
  const crowd = new THREE.Group(); group.add(crowd);
  const figMat = voxelMaterial({ color: hex('#4a5560'), glow: 0.7 });
  for (let i = 0; i < 18; i++) {
    const f = new THREE.Group();
    const part = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), figMat); m.position.set(x, y, 0); f.add(m); return m; };
    part(0.40, 0.62, 0.22, 0, 1.18); part(0.2, 0.24, 0.2, 0, 1.64);                     // torso, head
    part(0.1, 0.55, 0.12, -0.26, 1.15); part(0.1, 0.55, 0.12, 0.26, 1.15);               // arms
    const lL = part(0.15, 0.85, 0.16, -0.1, 0.43), lR = part(0.15, 0.85, 0.16, 0.1, 0.43); // legs
    f.userData.legs = [lL, lR];
    const a = rnd(i) * Math.PI * 2, r = 5 + rnd(i + 3) * 7;
    f.position.copy(B(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, 0)); f.rotation.y = rnd(i + 9) * Math.PI * 2;
    crowd.add(f);
  }

  // the tower: what he built, a jagged stack of module blocks behind the desk, lit from inside here and there
  const towerMat = voxelMaterial({ glow: 1.3 });
  // a stepped stack of module blocks (what he built, layer on layer), tapering as it rises behind the desk; only its
  // shell is built, a few cells lit from inside; kept clear of Claude's face and of the near side (no cube on the lens)
  const cells = [];
  const T0 = [C[0] + 0.3, C[1] + 3.9], CL = [1.55, 6.6, 4.55];
  for (let k = 0; k < 26; k++) {
    const z = k * 0.62, half = 2.6 * (1 - k / 30) + 0.5, step = 0.62;
    for (let gx = -half; gx <= half + 1e-6; gx += step) for (let gy = -half * 0.8; gy <= half * 0.8 + 1e-6; gy += step) {
      const edge = Math.abs(gx) > half - step * 0.9 || Math.abs(gy) > half * 0.8 - step * 0.9;
      const i = cells.length + k * 977;
      if (!edge || rnd(i * 1.7 + gx * 3 + gy * 7) < 0.18) continue;
      const x = T0[0] + gx + (rnd(i) - 0.5) * 0.06, y = T0[1] + gy + (rnd(i * 2.3) - 0.5) * 0.06;
      if (Math.abs(x - CL[0]) < 1.5 && z > CL[2] - 1.6 && z < CL[2] + 2.2 && y < CL[1] + 0.3) continue;   // Claude's place
      if (y < C[1] + 2.4) continue;                                                                       // nothing between us and the desk
      cells.push([x, y, z, 0.56 + rnd(i * 4.4) * 0.04]);
    }
  }
  const tower = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), towerMat, cells.length);
  cells.forEach(([x, y, z, s], i) => {
    m4.compose(B(x, y, z + s / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd(i) * 0.6, 0)), new THREE.Vector3(s, s * (0.6 + rnd(i * 2.1)), s)); tower.setMatrixAt(i, m4);
    const r = rnd(i * 9.1);
    tower.setColorAt(i, r > 0.93 ? col.set('#8fdcff').multiplyScalar(1.6) : r > 0.75 ? col.set('#245a84') : col.set('#0b1c2c'));
  });
  tower.frustumCulled = false; tower.visible = false; group.add(tower);

  // what flows out of him into it (V25): warm motes rising from the chair into the tower, cooling as they go
  const NF = 220;
  const flowMat = voxelMaterial({ glow: 3.5 });
  const flow = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 0.025), flowMat, NF); flow.userData.glow = 1;
  flow.frustumCulled = false; flow.visible = false; group.add(flow);

  // the monolith (V27 "HE... built that"): a dark slab of a building, its windows lit, against a pale sky
  const mono = new THREE.Group(); mono.visible = false; group.add(mono);
  // a long office block seen from its foot (board r4c5): near corner on the left, the facade running off to the right in
  // hard perspective, deep bays (floor slabs + vertical fins), rooms lit warm or blue behind the glass, the dark panes
  // holding the pale sky, a double-height lobby lit at his feet; the far end fades into the haze
  const bld = new THREE.Group(); mono.add(bld);
  // his contact shadow on the pale ground (K46 from above: he must stand on it, not float)
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(20,24,28,0.55)'); gr.addColorStop(0.45, 'rgba(20,24,28,0.25)'); gr.addColorStop(1, 'rgba(20,24,28,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const footShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  footShadow.rotation.x = -Math.PI / 2; mono.add(footShadow);
  const longTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(30,36,46,0.5)'); gr.addColorStop(0.5, 'rgba(30,36,46,0.18)'); gr.addColorStop(1, 'rgba(30,36,46,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(22, 256); g.lineTo(42, 256); g.lineTo(60, 0); g.lineTo(4, 0); g.closePath(); g.fill();
    return new THREE.CanvasTexture(c); })();
  const longShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.6), new THREE.MeshBasicMaterial({ map: longTex, transparent: true, depthWrite: false }));
  longShadow.rotation.x = -Math.PI / 2; mono.add(longShadow);   // round 13: the white void gets depth (K46 from above)
  const L = 84, H = 44.0, D = 16, LOB = 5.0, FL = 3.0, BAY = 3.2;
  bld.position.copy(B(C[0] - 4.99, C[1] + 0.08, 0));            // the near corner 4 m to his left, the facade 3 m behind him bld.rotation.y = THREE.MathUtils.degToRad(35);
  const dark = new THREE.MeshStandardMaterial({ color: 0x161b21, roughness: 0.62, metalness: 0.15 });
  const conc = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.8 });
  const finM = new THREE.MeshStandardMaterial({ color: 0x0f1317, roughness: 0.45, metalness: 0.35 });
  const lbox = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); bld.add(m); return m; };
  lbox(L, H, D, L / 2, H / 2, -D / 2, dark);                                       // the body
  lbox(L + 0.6, 0.9, D + 0.6, L / 2, H + 0.45, -D / 2, conc);                       // roof parapet
  const nB = Math.floor(L / BAY), floors = [];
  for (let y = LOB; y + FL <= H + 0.01; y += FL) floors.push(y);
  // floor slabs and fins: instanced boxes
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), conc, floors.length + 1);
  [...floors, H].forEach((y, i) => { m4.compose(new THREE.Vector3(L / 2, y, 0.28), q0, new THREE.Vector3(L + 0.4, 0.34, 0.56)); slabs.setMatrixAt(i, m4); });
  bld.add(slabs);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), finM, nB + 1);
  for (let i = 0; i <= nB; i++) { m4.compose(new THREE.Vector3(i * BAY, LOB + (H - LOB) / 2, 0.36), q0, new THREE.Vector3(0.24, H - LOB, 0.72)); fins.setMatrixAt(i, m4); }
  bld.add(fins);
  // the panes: a room behind each (gradient: the ceiling lights brighter), colour per pane
  const gc = document.createElement('canvas'); gc.width = 8; gc.height = 64;
  const gg = gc.getContext('2d'), gr = gg.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.08, '#ffffff'); gr.addColorStop(0.12, '#a8a8a8'); gr.addColorStop(0.7, '#6a6a6a'); gr.addColorStop(1, '#3a3a3a');
  gg.fillStyle = gr; gg.fillRect(0, 0, 8, 64);
  const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace;
  const paneM = new THREE.MeshBasicMaterial({ map: gtex, color: 0xffffff });
  const panes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), paneM, nB * floors.length + 1);
  const WARM = ['#ffb46b', '#ffc890', '#ff9f55', '#ffe0b8'].map(hex), BLUE = hex('#7fc8ff');
  let np = 0; const paneMeta = [];
  // what he built, at the size of a building: the lit rooms spell his modules across the facade in giant pixels
  // (the envelope of the email system, then the calendar), every other room dark
  const ICONS_ON = [
    { x0: 2, rows: ['XXXXXXXXX', 'XKWWWWWKX', 'XWKWWWKWX', 'XWWKWKWWX', 'XWWWKWWWX', 'XXXXXXXXX'], c: { X: '#ffb46b', W: '#ffe2b8', K: '#ff7a3a' } },
    { x0: 14, rows: ['.X.....X.', 'XXXXXXXXX', 'XRRRRRRRX', 'XWWWWWWWX', 'XWKWKWKWX', 'XWWWWWWWX', 'XWKWKWKWX', 'XWWWWWWWX', 'XXXXXXXXX'], c: { X: '#9fd8ff', R: '#ff6a55', W: '#e8f4ff', K: '#6aa8d8' } },
  ];
  const iconAt = (bay, fi) => {                                                   // fi: floor from the bottom; icons start on the 2nd
    for (const I of ICONS_ON) { const r = I.rows[I.rows.length - fi], ch = r && r[bay - I.x0]; if (ch && ch !== '.') return I.c[ch]; }
    return null;
  };
  floors.forEach((y, fi) => { for (let i = 0; i < nB; i++) {
    const k = rnd(i * 7.3 + fi * 31.1), x = (i + 0.5) * BAY;
    const ic = iconAt(i, fi);
    m4.compose(new THREE.Vector3(x, y + FL / 2 + 0.1, 0.02), q0, new THREE.Vector3(BAY - 0.3, FL - 0.45, 1)); panes.setMatrixAt(np, m4);
    paneMeta[np] = { i, fi, kind: ic ? 'icon' : k < 0.15 ? 'lit' : 'glass' };
    if (ic) col.setRGB(...hex(ic)).multiplyScalar(2.2);
    else if (k < 0.12) col.setRGB(...WARM[Math.floor(rnd(k * 99) * 4)]).multiplyScalar(0.5 + rnd(i + fi * 3) * 0.4);
    else if (k < 0.15) col.setRGB(...BLUE).multiplyScalar(0.4);
    else { const v = 0.05 + 0.10 * (fi / floors.length) + 0.05 * rnd(i * 3.1 + fi); col.setRGB(v * 0.9, v * 0.97, v * 1.08); }   // glass holding the pale sky
    panes.setColorAt(np++, col);
  } });
  const paneBase = Float32Array.from(panes.instanceColor.array), nPanes = np;   // the facade as built (the lobby comes after)
  // the lobby: double height, all glass, lit warm, mullions every 1.6 m, a canopy over the door by his mark
  m4.compose(new THREE.Vector3(L / 2, LOB / 2, 0.02), q0, new THREE.Vector3(L, LOB - 0.2, 1)); panes.setMatrixAt(np, m4); panes.setColorAt(np++, col.setRGB(1.0, 0.66, 0.38).multiplyScalar(0.3));
  panes.count = np; bld.add(panes);
  // round 12: the facade comes alive. His icons light up row by row from the street (0.12 s a floor); a diagonal band
  // of light runs across the building every ~1.5 s, waking the dark rooms it passes; a few rooms switch on and off
  function animFacade(age) {
    const a = panes.instanceColor.array, nF = floors.length;
    for (let p = 0; p < nPanes; p++) {
      const m = paneMeta[p], b = p * 3;
      const band = Math.pow(Math.max(0, Math.sin(age * 4.2 - (m.i * 0.38 + m.fi * 0.62))), 8);
      let r = paneBase[b], g = paneBase[b + 1], bl = paneBase[b + 2];
      if (m.kind === 'icon') {
        const on = Math.min(1, Math.max(0, (age - 0.12 * (m.fi - 1)) / 0.18));
        const k = (0.08 + 0.92 * on) * (1 + 0.45 * band);
        r *= k; g *= k; bl *= k;
      } else {
        const step = Math.floor(age * 5), h = (Math.sin((m.i * 13.1 + m.fi * 71.7 + step * 3.3)) * 43758.5453 % 1 + 1) % 1;
        const blink = h < 0.035 ? (m.kind === 'lit' ? -0.8 : 1) : 0;                 // a room switching (off if lit, on if dark)
        const w = Math.min(1.2, 0.9 * band + Math.max(0, blink) * 0.8);
        const keep = 1 + Math.min(0, blink);
        r = r * keep + 1.0 * w * 0.55; g = g * keep + 0.72 * w * 0.55; bl = bl * keep + 0.45 * w * 0.55;
      }
      a[b] = r; a[b + 1] = g; a[b + 2] = bl;
    }
    panes.instanceColor.needsUpdate = true;
  }
  const mull = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), finM, Math.ceil(L / 1.6) + 1);
  for (let i = 0; i * 1.6 <= L; i++) { m4.compose(new THREE.Vector3(i * 1.6, LOB / 2, 0.08), q0, new THREE.Vector3(0.08, LOB, 0.16)); mull.setMatrixAt(i, m4); }
  bld.add(mull);
  lbox(5.0, 0.2, 1.8, 4.6, 3.6, 0.9, conc);                                           // the canopy
  // the side face (toward the camera on the left): blank but for a column of narrow slots
  for (let y = LOB + 1.0; y < H - 1; y += FL) {
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...(rnd(y) > 0.5 ? WARM[1] : [0.22, 0.24, 0.27])).multiplyScalar(rnd(y) > 0.5 ? 1.3 : 1) }));
    sl.position.set(-0.02, y + 1.1, -D * 0.35); sl.rotation.y = -Math.PI / 2; bld.add(sl);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xc9cdd0, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.copy(B(C[0], C[1], 0)); mono.add(ground);
  const sun = new THREE.DirectionalLight(0xfff4e8, 2.2); sun.position.copy(B(C[0] - 6, C[1] - 4, 10)); sun.target.position.copy(B(C[0], C[1], 0));
  mono.add(sun, sun.target);
  const amb = new THREE.HemisphereLight(0xdfe6ec, 0x8a8f92, 1.0); mono.add(amb);

  // a rim light for the figure in the void modes (the refs: hair and shoulders edged with light)
  const rim = new THREE.SpotLight(0xffc9a0, 0, 12, THREE.MathUtils.degToRad(28), 0.6, 1.2);
  rim.position.copy(B(C[0], C[1] + 3.2, 3.2)); rim.target.position.copy(B(C[0], C[1], 1.2)); group.add(rim, rim.target);
  const rimCool = new THREE.SpotLight(0x7fe0ff, 0, 12, THREE.MathUtils.degToRad(28), 0.6, 1.2);
  rimCool.position.copy(B(C[0] + 2.4, C[1] + 2.2, 2.6)); rimCool.target.position.copy(B(C[0], C[1], 1.3)); group.add(rimCool, rimCool.target);

  // the cheat code across the sky: up up down down left right left right B A, as pixel glyphs
  const ARROW = { U: ['..X..', '.XXX.', 'X.X.X', '..X..', '..X..'], D: ['..X..', '..X..', 'X.X.X', '.XXX.', '..X..'],
    L: ['..X..', '.X...', 'XXXXX', '.X...', '..X..'], R: ['..X..', '...X.', 'XXXXX', '...X.', '..X..'],
    B: ['XXXX.', 'X...X', 'XXXX.', 'X...X', 'XXXX.'], A: ['.XXX.', 'X...X', 'XXXXX', 'X...X', 'X...X'] };
  const code = new THREE.Group(); group.add(code);
  'UUDDLRLRBA'.split('').forEach((k, i) => {
    const g = voxels(ARROW[k], { X: hex(i % 2 ? '#7ff0ff' : '#ffcf8a') }, { size: 0.22, depth: 1, material: voxelMaterial({ glow: 2.6 }) });
    g.position.set((i - 4.5) * 1.45, 0, 0); code.add(g);
  });
  code.visible = false;

  // the balcony (V18 "barely slept", V20-V21 the mug), laid out after the director's balcony renders (Group 12, 8):
  // he stands at the corner of a high balcony; behind him on the left the flat's glass sliding door, lit warm from
  // inside (his key light, from the side); on the right, past a dark bar rail, the city far below: towers with fine
  // grids of lit windows, sparse street lights, a near-black sky. Low key: half his face in shadow.
  // Coordinates are offsets from his mark (F), Blender metres: the facade with the door runs north-south on his west
  // side (x = -0.75), the rail runs along the north (y = +1.05) and east (x = +1.7) edges, the city fills north-east.
  const balc = new THREE.Group(); balc.visible = false; group.add(balc);
  const concrete = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.92 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.4, metalness: 0.75 });
  const box = (w, d, h, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.copy(B(x, y, z)); m.castShadow = m.receiveShadow = true; balc.add(m); return m; };
  box(2.6, 3.0, 0.16, 0.45, -0.45, -0.08, concrete);                   // slab
  box(2.6, 3.0, 0.20, 0.45, -0.45, 2.80, concrete);                    // the slab of the floor above
  box(2.45, 0.045, 0.045, 0.48, 1.05, 1.06, metal);                    // top rail, north
  box(2.45, 0.025, 0.025, 0.48, 1.05, 0.10, metal);
  for (let x = -0.72; x <= 1.68; x += 0.11) box(0.016, 0.016, 0.96, x, 1.05, 0.58, metal);
  box(0.045, 3.0, 0.045, 1.70, -0.45, 1.06, metal);                    // top rail, east
  box(0.025, 3.0, 0.025, 1.70, -0.45, 0.10, metal);
  for (let y = -1.92; y <= 1.02; y += 0.11) box(0.016, 0.016, 0.96, 1.70, y, 0.58, metal);
  // the facade on his west side with a tall glass sliding door; the flat inside glows warm
  box(0.24, 3.0, 2.8, -0.87, -0.45, 1.40, new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.85 }));
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1018, roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05,
    emissive: 0xff8f45, emissiveIntensity: 0.015, envMapIntensity: 0.25, transparent: true, opacity: 0.9 });
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.3), glassMat);
  doorGlass.position.copy(B(-0.74, 0.05, 1.18)); doorGlass.rotation.y = Math.PI / 2; balc.add(doorGlass);
  // inside the door: warm blurred interior (a lamp, a shelf) seen through the glass
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.035, 0.018, 0.010) }));
  inside.position.copy(B(-1.35, 0.05, 1.15)); inside.rotation.y = Math.PI / 2; balc.add(inside);
  const lampIn = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 0.9) }));
  lampIn.position.copy(B(-1.25, -0.35, 1.45)); balc.add(lampIn);
  for (let i = 0; i < 26; i++) {                                     // the city reflected in the door glass
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.02 + rnd(i) * 0.04, 0.03 + rnd(i + 1) * 0.08),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...[[1.6, 0.9, 0.45], [1.4, 1.1, 0.7], [0.5, 1.1, 1.4]][i % 3]).multiplyScalar(0.04 + 0.08 * rnd(i + 2)) }));
    r.position.copy(B(-0.735, -0.8 + rnd(i + 3) * 1.7, 0.6 + rnd(i + 4) * 1.4)); r.rotation.y = Math.PI / 2; balc.add(r);
  }
  for (const y of [-0.85, 0.05, 0.95]) box(0.06, 0.05, 2.32, -0.72, y, 1.18, metal);   // door frame
  box(0.06, 1.85, 0.05, -0.72, 0.05, 2.34, metal);
  const spill = new THREE.RectAreaLight(0xff8a3a, 0, 1.6, 2.1);   // round 13: a deeper amber        // the flat's light through the door: his key, from the side
  spill.position.copy(B(-0.70, 0.05, 1.25)); spill.lookAt(B(0.6, 0.2, 1.3)); balc.add(spill);
  const night = new THREE.HemisphereLight(0x1e2c48, 0x07080a, 0.07); balc.add(night);   // round 13: deeper shadows (0.14)
  const cityRim = new THREE.DirectionalLight(0x7fc4ff, 1.5);   // round 13: the city's cool rim on his far edge (0.35 read as nothing) cityRim.position.copy(B(3, 5, 1.6)); cityRim.target.position.copy(B(0, 0, 1.3)); balc.add(cityRim, cityRim.target);
  // the city: towers below and beyond, fine grids of windows, mostly dark, some lit warm, a few cool
  const cc = document.createElement('canvas'); cc.width = 384; cc.height = 1280;
  const cg = cc.getContext('2d'); cg.fillStyle = '#000'; cg.fillRect(0, 0, 384, 1280);
  for (let y = 0; y < 213; y++) for (let x = 0; x < 64; x++) {
    const r = rnd(x * 13 + y * 31.7);
    if (r > 0.78) { cg.fillStyle = r > 0.95 ? '#a8e2ff' : r > 0.82 ? '#ffd29a' : '#e8964a'; cg.globalAlpha = 0.45 + 0.55 * rnd(x + y * 3.3); cg.fillRect(x * 6, y * 6, 5, 4); }
  }
  cg.globalAlpha = 1;
  const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace;
  const cityMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.9, emissive: 0xffffff, emissiveMap: ctex, emissiveIntensity: 0.0, fog: false });
  const NB = 260;
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMat, NB);
  for (let i = 0; i < NB; i++) {
    const a = THREE.MathUtils.degToRad(rnd(i * 2.7) * 360), dist = 160 + Math.pow(rnd(i * 3.3), 0.8) * 200;   // silhouettes behind the lit band, never a wall in front of it
    const w = 8 + rnd(i * 4.1) * 16, h = 30 + Math.pow(rnd(i * 5.9), 1.5) * 60;
    m4.compose(B(Math.sin(a) * dist, Math.cos(a) * dist, h / 2 - 60), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd(i) * 1.2, 0)), new THREE.Vector3(w, h, w));
    towers.setMatrixAt(i, m4);
  }
  towers.frustumCulled = false; balc.add(towers);
  // the lit windows as points: for each building, a grid of lit windows on the face toward us, warm with some cool,
  // ~1.3 m each, so the lens turns them into the clustered bokeh of the references
  const NL = 32000;
  const lightsMat = voxelMaterial({ glow: 3.0, snap: [1920, 1080] });
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 7, 5), lightsMat, NL);    // round sources: round bokeh
  const LC = ['#ffb46b', '#ffd9a8', '#ff9a4d', '#ffe9c9', '#8fe0ff', '#ffc98a', '#5fd6c8'].map(hex);
  let n = 0;
  const LP = new Float32Array(NL * 3), LS = new Float32Array(NL), LT = new Float32Array(NL * 2);
  // buildings at all distances (near ones big and few, far ones a dense fine band), windows jittered off the lattice
  // and some floors dark, so the lens makes the irregular clustered bokeh of the references, not a grid of discs
  for (let bI = 0; bI < 1000 && n < NL; bI++) {
    const az = ((bI * 0.618034 + rnd(bI * 7.1) * 0.004) % 1) * Math.PI * 2, dist = 70 + Math.pow(rnd(bI * 3.7), 0.7) * 300;   // even round the horizon
    const cx = Math.sin(az) * dist, cy = Math.cos(az) * dist;
    const tx = Math.cos(az), ty = -Math.sin(az);                     // across the face, perpendicular to our line of sight
    const base = -75 + rnd(bI * 1.9) * 30, step = 2.6 + rnd(bI * 4.4) * 1.6, lit = 0.05 + rnd(bI * 8.3) * 0.24;
    const top = -14 + Math.pow(rnd(bI * 6.7), 2.4) * 26;
    const cols = 3 + Math.floor(rnd(bI * 2.3) * 12), rows = Math.max(2, Math.floor((top - base) / step));
    const sz = 0.7 + rnd(bI * 5.5) * 0.9, warm = rnd(bI * 9.1);
    for (let r = 0; r < rows && n < NL; r++) {
      if (rnd(bI * 57 + r * 3.1) < 0.25) continue;                  // a dark floor
      for (let c = 0; c < cols && n < NL; c++) {
        const k = rnd(bI * 131 + r * 17 + c * 7);
        if (k > lit) continue;
        const u = (c - cols / 2) * step + (rnd(n * 1.7) - 0.5) * step * 0.5, z = base + r * step + (rnd(n * 2.9) - 0.5) * 0.8;
        const d = (rnd(n * 3.3) - 0.5) * 6;                           // depth jitter
        const sc = sz * (0.6 + rnd(n * 4.1) * 0.8) * (0.6 + dist / 160);   // far windows bigger: they stay discs, not specks
        const lp = B(cx + tx * u + Math.sin(az) * d, cy + ty * u + Math.cos(az) * d, z);
        m4.compose(lp, q0, new THREE.Vector3(sc * 1.3, sc, sc * 1.3)); lights.setMatrixAt(n, m4);
        LP[n * 3] = lp.x; LP[n * 3 + 1] = lp.y; LP[n * 3 + 2] = lp.z; LS[n] = sc; LT[n * 2] = tx; LT[n * 2 + 1] = -ty;   // (for the K34 trails)
        const ci = warm < 0.18 ? 4 + Math.floor(rnd(n) * 3) % 3 : Math.floor(rnd(bI * 3 + k * 50) * 4);
        lights.setColorAt(n, col.setRGB(...LC[ci % LC.length]).multiplyScalar(0.5 + rnd(n * 1.3) * 1.7));
        n++;
      }
    }
  }
  for (let i = n; i < NL; i++) { m4.makeScale(0, 0, 0); lights.setMatrixAt(i, m4); lights.setColorAt(i, col.setRGB(0, 0, 0)); }
  lights.frustumCulled = false; lights.userData.glow = 0; balc.add(lights);   // round 13: the city stays creamy bokeh, out of the deep glow (it washed orange)
  const NLIT = n, lightsK0 = lightsMat.uniforms.uColor.value.clone();
  // round 14 (K34 "a thinness to his thoughts", ref R4 frame 3): the city's own lights become the trails. Each bokeh
  // disc stretches along its tangent (sideways to our line of sight) from a circle into a long thin line and streams
  // round behind him, all one way; k = 0 is the city as built, 1 the full trails
  let trailK = -1;
  const _tq = new THREE.Quaternion(), _ts = new THREE.Vector3(), _tp = new THREE.Vector3(), X1 = new THREE.Vector3(1, 0, 0);
  function layTrails(k, age) {
    if (k === 0 && trailK === 0) return;
    trailK = k;
    // about a third of the lights become the trails (thin, long, distinct); the rest shrink away, so the lines keep
    // dark gaps between them through the lens blur (R4) instead of melting into one creamy slab
    const run = k * k * (6 + age * 6);                                                       // metres travelled
    for (let i = 0; i < NLIT; i++) {
      const tx = LT[i * 2], tz = LT[i * 2 + 1], sc = LS[i], jit = 0.25 + 1.5 * Math.pow(rnd(i * 2.9), 1.3), trail = rnd(i * 7.7) < 0.03;
      const S = trail ? 1 + 48 * Math.pow(k, 1.3) * jit : 1, thin = trail ? 1 - (0.45 + 0.45 * rnd(i * 3.3)) * k : 1 - 0.97 * k;
      const go = trail ? run * (0.2 + 3.2 * rnd(i * 5.3)) - 18 * k * rnd(i * 6.1) : run * jit;   // trails spread out along their run (no stacks)
      _tp.set(LP[i * 3] + tx * go, LP[i * 3 + 1] + (trail ? (rnd(i * 4.7) - 0.5) * 7 * k : 0), LP[i * 3 + 2] + tz * go);
      _tq.setFromUnitVectors(X1, _ts.set(tx, 0, tz).normalize());
      _ts.set(sc * 1.3 * S * (trail ? 1 : thin), sc * thin, sc * 1.3 * thin);
      m4.compose(_tp, _tq, _ts); lights.setMatrixAt(i, m4);
    }
    lights.instanceMatrix.needsUpdate = true;
    towers.visible = k < 0.12;                                                                  // the dark blocks would cut the trails into stacks
    lightsMat.uniforms.uColor.value.copy(lightsK0).multiplyScalar(1 + 0.25 * k);   // fewer, longer: a touch brighter   // the lines overlap: hold the frame's light level
  }

  // drowning (V09 "i'm drowning here", director ref: the man in his chair inside a storm of paper): the room is gone,
  // he sits in his chair in a dark void and hundreds of pages hang at every depth around him, glowing warm-white,
  // the near ones huge and soft past the lens, the far ones a fine snow; a few cool specks drift between them
  const drown = new THREE.Group(); drown.visible = false; group.add(drown);
  const pc = document.createElement('canvas'); pc.width = pc.height = 512;
  const pg = pc.getContext('2d');
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * 256, oy = Math.floor(cell / 2) * 256;
    pg.fillStyle = '#efe7d8'; pg.fillRect(ox + 2, oy + 2, 252, 252);
    pg.fillStyle = 'rgba(120,105,90,0.25)'; pg.fillRect(ox + 2, oy + 2, 252, 3); pg.fillRect(ox + 2, oy + 251, 252, 3);
    pg.fillStyle = '#8c8174';
    pg.fillRect(ox + 26, oy + 24, 90 + cell * 14, 9);                                  // a header line
    for (let l = 0; l < 15; l++) {
      if (cell === 3 && l > 3 && l < 10) continue;                                      // room for the sketch
      const w = 120 + rnd(cell * 31 + l) * 90;
      pg.fillStyle = 'rgba(110,100,90,' + (0.55 + 0.3 * rnd(l + cell)) + ')';
      pg.fillRect(ox + 26, oy + 50 + l * 12.5, w, 4);
    }
    if (cell === 3) { pg.strokeStyle = '#7d7266'; pg.lineWidth = 3; pg.beginPath(); pg.arc(ox + 128, oy + 128, 34, 0, Math.PI * 2); pg.stroke();
      pg.beginPath(); pg.moveTo(ox + 70, oy + 150); pg.lineTo(ox + 190, oy + 106); pg.stroke(); }
  }
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 8;
  const paperMat = new THREE.MeshBasicMaterial({ map: ptex, side: THREE.DoubleSide, color: new THREE.Color(1.5, 1.38, 1.2) });
  paperMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aCell;\n' + sh.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n  vMapUv = (uv + vec2(mod(aCell, 2.0), 1.0 - floor(aCell / 2.0))) / 2.0;');
  };
  const NP = 950;
  const pgeo = new THREE.PlaneGeometry(0.21, 0.297);
  const papers = new THREE.InstancedMesh(pgeo, paperMat, NP);
  const pcell = new Float32Array(NP);
  for (let i = 0; i < NP; i++) pcell[i] = Math.floor(rnd(i * 5.3) * 4);
  pgeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(pcell, 1));
  papers.frustumCulled = false; drown.add(papers);
  const NSP = 2500, sp = new Float32Array(NSP * 3), sc = new Float32Array(NSP * 3);
  const dotC = document.createElement('canvas'); dotC.width = dotC.height = 32;
  const dg = dotC.getContext('2d'), dgr = dg.createRadialGradient(16, 16, 0, 16, 16, 16); dgr.addColorStop(0, 'rgba(255,255,255,1)'); dgr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); dgr.addColorStop(1, 'rgba(255,255,255,0)');
  dg.fillStyle = dgr; dg.fillRect(0, 0, 32, 32);
  const specks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.02, map: new THREE.CanvasTexture(dotC), vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  specks.geometry.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  specks.geometry.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  specks.frustumCulled = false; drown.add(specks);
  // the magic: a soft warm light behind him that the pages float in front of (a halo, not a lamp)
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,214,170,0.16)'); gr.addColorStop(0.3, 'rgba(255,190,140,0.06)'); gr.addColorStop(0.65, 'rgba(120,200,210,0.015)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  drown.add(halo);
  let drownKey = '';
  function layDrown(head, cam, t, rise) {
    // pages: a shell around him from just past his shoulders out to 5 m, denser behind him; none inside his body
    const key = head.toArray().map((v) => v.toFixed(2)).join() + cam.toArray().map((v) => v.toFixed(2)).join();
    const H = head, Cm = cam, dir = new THREE.Vector3().subVectors(Cm, H).normalize();
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), o = new THREE.Object3D();
    for (let i = 0; i < NP; i++) {
      let p;
      for (let k = 0; k < 8; k++) {
        const r = 0.7 + Math.pow(rnd(i * 3.1 + k), 0.85) * 5.6, a = rnd(i * 7.7 + k) * Math.PI * 2, el = (rnd(i * 2.9 + k) - 0.42) * 1.5;
        p = new THREE.Vector3(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r * 0.75, Math.sin(a) * Math.cos(el) * r).add(H);
        const toward = v.subVectors(p, H).dot(dir);                                     // in front of him (toward the camera)?
        const body = Math.hypot(p.x - H.x, p.z - H.z) < 0.5 && p.y < H.y + 0.35;
        const dc = p.distanceTo(Cm);
        // the line from the lens to his face stays clear; only a few sheets come close to the lens (soft, huge)
        const seg = new THREE.Vector3().subVectors(p, Cm), L = Cm.distanceTo(H), tt = Math.min(1, Math.max(0, seg.dot(dir.clone().negate()) / L));
        const sight = p.distanceTo(Cm.clone().lerp(H, tt)) < 0.32 + 0.25 * tt;
        const near = dc < 0.9 ? rnd(i * 11 + k) < 0.06 : true;
        if (!body && !sight && near && dc > 0.25 && (toward < 0.15 || rnd(i + k * 13) < 0.3)) break;
      }
      p.y = Math.max(p.y, H.y - 1.5);
      if (rise && rise.length === 1) { const v = 0.12 + rnd(i * 5.7) * 0.16; p.y += -1.1 + (t - rise[0]) * v * 1.0 + rnd(i * 2.3) * 0.3; }   // a slow continuous rise, bottom to top, each sheet at its own speed
      else if (rise) { const w = rise[i % 3] + (rnd(i * 2.3) * 0.25), u = Math.min(1, Math.max(0, (t - w) / 0.8)); p.y -= (1 - (1 - Math.pow(1 - u, 3))) * 2.6; }
      p.y += 0.02 * Math.sin(t * 1.1 + i * 0.7); p.x += 0.012 * Math.sin(t * 0.8 + i * 1.3);   // drift
      o.position.copy(p);
      o.lookAt(Cm); o.rotateZ((rnd(i * 1.7) - 0.5) * 2.4 + 0.05 * Math.sin(t * 0.9 + i)); o.rotateX((rnd(i * 4.1) - 0.5) * 1.2); o.rotateY((rnd(i * 6.3) - 0.5) * 1.3);
      const s = 0.45 + rnd(i * 8.9) * 0.55;
      o.scale.setScalar(s); o.updateMatrix(); papers.setMatrixAt(i, o.matrix);
      const hot = rnd(i * 6.6) > 0.92;                                                  // about 1 in 8 pages glows (blooms)
      const k = hot ? 1.25 + rnd(i * 2.2) * 0.5 : 0.35 + 0.65 * rnd(i * 2.2);
      papers.setColorAt(i, col.setRGB(k, k * (rnd(i) > 0.92 ? 1.06 : 0.97), k * (rnd(i) > 0.92 ? 1.1 : 0.9)));
    }
    papers.instanceMatrix.needsUpdate = true; if (papers.instanceColor) papers.instanceColor.needsUpdate = true;
    for (let i = 0; i < NSP; i++) {
      const r = 0.4 + rnd(i * 1.3) * 4.5, a = rnd(i * 2.3) * Math.PI * 2, y = (rnd(i * 3.7) - 0.45) * 3.2;
      sp[i * 3] = H.x + Math.cos(a) * r; sp[i * 3 + 1] = H.y + y; sp[i * 3 + 2] = H.z + Math.sin(a) * r;
      const c = rnd(i * 9.1) > 0.85 ? [0.55, 0.85, 0.9] : [1.0, 0.95, 0.88], kk = 0.3 + rnd(i * 4.4) * 0.9;
      sc[i * 3] = c[0] * kk; sc[i * 3 + 1] = c[1] * kk; sc[i * 3 + 2] = c[2] * kk;
    }
    specks.geometry.attributes.position.needsUpdate = true; specks.geometry.attributes.color.needsUpdate = true;
    halo.position.copy(H).addScaledVector(dir, -3.2); halo.lookAt(Cm);
    drownKey = key;
  }

  // the cheat world's stars: a fine field of white and violet points high in the void, some brighter, twinkling
  const NST = 1400, stP = new Float32Array(NST * 3), stC = new Float32Array(NST * 3);
  for (let i = 0; i < NST; i++) {
    const a = rnd(i * 1.9) * Math.PI * 2, e = 0.06 + Math.pow(rnd(i * 2.7), 0.7) * 1.35, r = 45;
    const v = B(C[0] + Math.cos(a) * Math.cos(e) * r, C[1] + Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r);
    stP[i * 3] = v.x; stP[i * 3 + 1] = v.y; stP[i * 3 + 2] = v.z;
    const w = rnd(i * 5.1) > 0.8 ? [0.75, 0.62, 1.0] : [1, 1, 1];
    for (let k = 0; k < 3; k++) stC[i * 3 + k] = w[k];
  }
  const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.32, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  stars.geometry.setAttribute('position', new THREE.BufferAttribute(stP, 3));
  stars.geometry.setAttribute('color', new THREE.BufferAttribute(stC, 3));
  stars.frustumCulled = false; stars.visible = false; group.add(stars);
  const starBase = stC.slice();

  let figure = new THREE.Vector3(C[0], C[1], 0);                       // where he stands in the void modes (Blender)
  function setFigure(p) { figure = p; }

  function set(mode, t = 0, opts = {}) {
    group.visible = !!mode;
    if (!mode) return;
    const s = SKY[mode] || SKY.dome;
    skyMat.uniforms.top.value.set(s.top); skyMat.uniforms.mid.value.set(s.mid); skyMat.uniforms.low.value.set(s.low);
    skyMat.uniforms.k.value = s.k; skyMat.uniforms.band.value = s.band;
    const [gc, gk] = GRID[mode] || GRID.dome;
    gridMat.uniforms.col.value.set(gc); gridMat.uniforms.k.value = gk; gridMat.uniforms.base.value.set(mode === 'monolith' ? 0x000000 : 0x000000);
    grid.visible = !['monolith', 'iso', 'balcony', 'drown', 'cheat', 'down'].includes(mode);   // round 14: no grid under him in K24 (nor K25)
    const age = opts.age ?? 99;                                                    // seconds since this world appeared
    gridMat.uniforms.rev.value = mode === 'cheat' ? 0.5 + Math.pow(Math.max(0, age), 1.6) * 9 : 1e4;
    const F = figure;

    // shards
    shards.visible = false;                                         // round 14: the drifting gems went (K24 read cheap); motes carry the air
    const pal = (shardPal[mode] || shardPal.cheat).map((h) => new THREE.Color(h));
    for (let i = 0; i < NS; i++) {
      const a = rnd(i) * Math.PI * 2, r = 2.5 + rnd(i + 1) * 22, z = 0.6 + rnd(i + 2) * (mode === 'cheat' ? 9 : 6);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(t * 0.3 + i, t * 0.2 + i * 2, 0));
      m4.compose(B(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, z), q, new THREE.Vector3().setScalar(0.5 + rnd(i + 5) * 2.0));
      shards.setMatrixAt(i, m4); shards.setColorAt(i, col.copy(pal[i % pal.length]).multiplyScalar(mode === 'cheat' ? 1.9 : 1.4));
    }
    shards.instanceMatrix.needsUpdate = true; shards.instanceColor.needsUpdate = true;

    // streaks: light rays in motion. They slide in (scale and travel from nothing), start slow and accelerate, stretch
    // into trails with speed, and now and then a ray glitches (a frame-hard jump and a flash). `age` drives all of it.
    streaks.visible = mode === 'door';   // round 14: K25 (down) has no rays at his depth (bars on the lens); K26-K27 (dome) have the tunnel
    tunnel.visible = mode === 'dome';
    if (tunnel.visible) {
      const u = tunMat.uniforms, T = opts.tunnel || {};
      u.uT.value = age; u.uK.value = T.k ?? 0.8; tunGeo.instanceCount = Math.min(NT, T.n ?? 560);
      u.uO.value.copy(B(F.x, F.y + (T.o ?? 0.6), T.z ?? 1.62));
      u.uD.value.copy(B(...(T.dir || [0, 1, 0.3]))).normalize();
      u.uU.value.set(1, 0, 0); u.uV.value.crossVectors(u.uD.value, u.uU.value).normalize(); u.uU.value.crossVectors(u.uV.value, u.uD.value).normalize();
      u.uS0.value = T.s0 ?? -3; u.uS1.value = T.s1 ?? 26; u.uVs.value = T.vs ?? 2.2; u.uVa.value = T.va ?? 0.35;
    }
    const up = new THREE.Vector3(0, 1, 0);
    const v0 = 0.25, acc = 1.4, vmax = 6.0;                                        // m/s, m/s^2: slow, then fast
    const tv = Math.min(age, (vmax - v0) / acc), travel = v0 * tv + 0.5 * acc * tv * tv + vmax * Math.max(0, age - tv), speed = Math.min(vmax, v0 + acc * age);
    const wrapM = (x, L) => ((x % L) + L) % L;
    for (let i = 0; i < NK; i++) {
      const c = TEAL_ORANGE[i % TEAL_ORANGE.length];
      let p, sc, q = q0.clone(), k = 2.6;
      const born = Math.min(1, Math.max(0, (age - rnd(i + 11) * 0.9) / 0.5));       // staggered slide-in
      const glitch = rnd(i * 7.3 + Math.floor(age * 14)) > 0.965 ? 1 : 0;              // ~3.5% of rays jump on any frame
      const gx = glitch ? (rnd(i + Math.floor(age * 14)) - 0.5) * 0.5 : 0;
      if (mode === 'door') {
        if (i >= 160) { m4.makeScale(0, 0, 0); streaks.setMatrixAt(i, m4); continue; }
        const a = rnd(i) * Math.PI * 2, along = wrapM(rnd(i + 4) * 16 - travel * (0.7 + rnd(i + 9) * 0.6), 16);
        const straight = Math.min(1, age / 1.2), r = (1.6 + rnd(i + 2) * 2.2) * (1 - 0.35 * straight) - along * 0.07;   // the rings straighten into a corridor
        p = B(C[0] + Math.cos(a) * r + gx, C[1] + 1.5 + along, 1.2 + Math.sin(a) * r * 0.8);
        sc = new THREE.Vector3(0.03 + rnd(i + 6) * 0.05, 0.03 + rnd(i + 7) * 0.04, (1.5 + rnd(i + 8) * 4) * (1 + speed * 0.35) * born);
      } else if (mode === 'dome') {
        // rings round him like the sky round the Earth: they turn about a tilted axis, accelerating, with trails
        const el = THREE.MathUtils.degToRad(8 + Math.pow(rnd(i + 2), 0.8) * 68), spin = (0.12 * tv + 0.5 * 0.35 * tv * tv + 1.0 * Math.max(0, age - tv)) * (rnd(i + 12) > 0.5 ? 1 : 0.8);
        const az = rnd(i) * Math.PI * 2 + spin;
        const R = 5.5 + rnd(i + 1) * 4.5;
        const pos = new THREE.Vector3(Math.cos(az) * Math.cos(el) * R, Math.sin(el) * R + 0.4, Math.sin(az) * Math.cos(el) * R).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.32);
        p = B(F.x, F.y, F.z).add(pos); p.y += gx * 0.6;
        const tang = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.32);
        q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tang);
        sc = new THREE.Vector3((0.8 + rnd(i + 5) * 2.2) * (1 + Math.min(1.5, speed * 0.3)) * born, 0.018 + rnd(i + 6) * 0.03, 0.018 + rnd(i + 6) * 0.03);
        k = 2.0 + rnd(i + 3) * 1.6;
      } else {                                                    // down: soft bars around him, at all heights, sliding past
        if (i >= 70) { m4.makeScale(0, 0, 0); streaks.setMatrixAt(i, m4); continue; }
        const a = rnd(i) * Math.PI * 2, r = 1.0 + rnd(i + 1) * 4.0;
        const ang = (rnd(i + 4) - 0.5) * 0.4, dir = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
        const slide = wrapM(travel * (0.5 + rnd(i + 13)) + rnd(i + 14) * 10, 10) - 5;
        p = B(F.x + Math.cos(a) * r, F.y + Math.sin(a) * r, 0.05 + rnd(i + 2) * 2.8).addScaledVector(dir, slide + gx);
        sc = new THREE.Vector3((0.5 + rnd(i + 5) * 1.2) * (1 + speed * 0.45) * born, 0.04 + rnd(i + 6) * 0.06, 0.04 + rnd(i + 6) * 0.06);
        q.setFromAxisAngle(up, ang);
        k = 2.2;
      }
      // round 13: a ray never crosses the lens (one passing the camera filled K25 with a slab and, with the deep glow, a wash)
      let near = 1; if (opts.camV) { const d = p.distanceTo(opts.camV), x = Math.min(1, Math.max(0, (d - 0.9) / 1.4)); near = x * x * (3 - 2 * x); sc.multiplyScalar(Math.max(near, 0.001)); }
      m4.compose(p, q, sc); streaks.setMatrixAt(i, m4); streaks.setColorAt(i, col.setRGB(...c).multiplyScalar(k * (glitch ? 1.8 : 1) * (0.3 + 0.7 * born) * near));
    }
    streaks.instanceMatrix.needsUpdate = true; streaks.instanceColor.needsUpdate = true;

    // K24: the solved ring (see lifeSlot above)
    const cheat = mode === 'cheat';
    ringDots.visible = pad.visible = crown.visible = motes.visible = cheat; top.intensity = 0;
    if (cheat) {
      if (opts.ring) RING = { ...RING, ...opts.ring };
      const snaps = opts.snaps || [], cl = (x) => Math.min(1, Math.max(0, x)), sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
      const SNAP = 0.5, lock = snaps.length ? snaps[snaps.length - 1] + SNAP : -1e9;
      const lit = snaps.reduce((a, b) => a + sm((t - b - SNAP + 0.06) / 0.12), 0) / Math.max(1, snaps.length);   // each snap turns it up a step
      const draw = sm((t - lock) / 0.55), flash = Math.exp(-Math.max(0, t - lock - 0.55) * 3) * sm((t - lock - 0.45) / 0.1);
      const ta = opts.topAt || [0, 0, RING.o === 'h' ? RING.z : 4.4]; top.position.copy(B(F.x + ta[0], F.y + ta[1], ta[2])); top.target.position.copy(B(F.x, F.y, 1.2)); top.target.updateMatrixWorld();
      top.intensity = (opts.topK ?? 1) * (40 + 160 * lit + 80 * flash);
      crown.visible = !!opts.crown; crown.position.copy(B(F.x, F.y, RING.o === 'h' ? RING.z + 0.02 : 3.35)); crown.rotation.set(-Math.PI / 2, 0, 0); crown.scale.setScalar(opts.crown || 1); crown.material.opacity = 0.35 + 0.65 * lit + 0.6 * flash;
      pad.position.copy(B(F.x, F.y, 0.003)); pad.material.opacity = 0.25 + 0.75 * lit;
      // the dotted ring: drawn round from slot 0 once the last life-up locks, gaps where the icons sit
      const n = snaps.length || 6;
      for (let i = 0; i < NR; i++) {
        const u = i / NR, a = LIFE_A0 + u * Math.PI * 2, slot = (u * n) % 1;
        const near = Math.abs(slot - 0.5) < 0.17;
        const on = !near && u < draw;
        const s = on ? (RING.dot || 0.016) : 0;
        m4.compose(B(...ringAt(a)), q0, new THREE.Vector3(s, s, s)); ringDots.setMatrixAt(i, m4);
        ringDots.setColorAt(i, col.setRGB(1, 0.97, 0.93).multiplyScalar(0.8 + 1.6 * flash));
      }
      ringDots.instanceMatrix.needsUpdate = true; ringDots.instanceColor.needsUpdate = true;
      for (let i = 0; i < NMO; i++) {
        const a = rnd(i * 1.3) * Math.PI * 2, r = 0.6 + Math.pow(rnd(i * 2.1), 0.7) * 3.2, z = ((rnd(i * 3.7) * 3.4 + t * (0.04 + 0.05 * rnd(i))) % 3.4);
        const v = B(F.x + Math.cos(a) * r, F.y + Math.sin(a) * r, z);
        moP[i * 3] = v.x; moP[i * 3 + 1] = v.y; moP[i * 3 + 2] = v.z;
        const w = rnd(i * 5.1) > 0.75 ? [0.7, 0.55, 1.0] : [1, 0.95, 0.9], k = (0.25 + 0.75 * rnd(i * 4.4)) * (0.6 + 0.4 * Math.sin(t * (1 + rnd(i) * 2) + i)) * Math.min(1, z / 0.4, (3.4 - z) / 0.6);
        for (let c = 0; c < 3; c++) moC[i * 3 + c] = w[c] * k;
      }
      motes.geometry.attributes.position.needsUpdate = true; motes.geometry.attributes.color.needsUpdate = true;
    }
    door.visible = mode === 'door';
    door.position.copy(B(C[0], C[1] + 15, 1.15));
    pool.visible = false;   // round 14: R5 has no floor light under him
    fgGroup.visible = mode === 'down' && !!opts.cam; if (fgGroup.visible) layFg(opts.cam, age);
    pool.position.copy(B(F.x, F.y, 0.004));
    shaft.visible = mode === 'cheat' && !!opts.shaft; shaft.position.copy(B(F.x, F.y, 2.75));   // (K25 tried it: from overhead it read as a flat wedge; K24 sees it from the front)
    if (shaft.visible) shaft.material.opacity = opts.shaft * (0.35 + 0.65 * (opts._lit ?? 1));
    crowd.visible = !!opts.crowd;
    crowd.children.forEach((f, i) => { const [l, r] = f.userData.legs; l.rotation.x = 0.35 * Math.sin(t * 2 + i); r.rotation.x = -l.rotation.x; });
    tower.visible = mode === 'tower';
    flow.visible = mode === 'tower';
    if (mode === 'tower') {
      for (let i = 0; i < NF; i++) {
        const u = (rnd(i) + t * 0.05) % 1;
        const from = new THREE.Vector3(C[0], C[1], 1.05), to = new THREE.Vector3(C[0] + (rnd(i + 2) - 0.5) * 2.4, C[1] + 3.6, 2 + rnd(i + 3) * 9);
        const p = from.clone().lerp(to, u); p.x += Math.sin(u * 9 + i) * 0.12 * (1 - u); p.z += Math.sin(u * 3.14) * 0.6;
        m4.compose(B(p.x, p.y, p.z), q0, new THREE.Vector3().setScalar(1 + u * 1.5)); flow.setMatrixAt(i, m4);
        flow.setColorAt(i, col.set('#ffb36b').lerp(new THREE.Color('#8fd0ff'), u).multiplyScalar(2.5));
      }
      flow.instanceMatrix.needsUpdate = true; flow.instanceColor.needsUpdate = true;
    }
    mono.visible = mode === 'monolith';
    if (mono.visible) {
      bld.visible = !opts.noBuilding; footShadow.position.copy(B(F.x, F.y, 0.003)); animFacade(opts.age ?? 0);
      const away = B(F.x, F.y, 0).sub(sun.position).setY(0).normalize();               // away from the sun, along the ground
      longShadow.position.copy(B(F.x, F.y, 0.0025)).addScaledVector(away, 1.8);
      longShadow.rotation.z = Math.atan2(away.x, away.z) + Math.PI;
    }
    balc.visible = mode === 'balcony';
    drown.visible = mode === 'drown';
    if (drown.visible && opts.head && opts.cam) layDrown(B(...opts.head), B(...opts.cam), t, opts.rise);
    sky.scale.setScalar(mode === 'balcony' ? 5.5 : 1);            // the far city is past the default 70 m sky (camera far = 400)
    if (balc.visible) { balc.position.copy(B(F.x, F.y, 0)); balc.rotation.y = THREE.MathUtils.degToRad(opts.balconyYaw || 0); spill.intensity = opts.spill ?? 9;
      const tr = opts.trails, k = tr ? Math.min(1, Math.max(0, (t - tr[0]) / (tr[1] - tr[0]))) : 0;
      layTrails(k * k * (3 - 2 * k), tr ? Math.max(0, t - tr[0]) : 0); }
    rim.intensity = ['down', 'dome', 'door'].includes(mode) ? 26 : 0;
    rimCool.intensity = ['dome', 'door'].includes(mode) ? 14 : 0;
    rim.position.copy(B(F.x, F.y + 3.0, 3.2)); rim.target.position.copy(B(F.x, F.y, 1.3)); rim.target.updateMatrixWorld();
    rimCool.position.copy(B(F.x + 2.4, F.y + 2.2, 2.6)); rimCool.target.position.copy(B(F.x, F.y, 1.4)); rimCool.target.updateMatrixWorld();
    code.visible = false;                                              // the glyph line: cut (round 11, it read as chaos)
    stars.visible = mode === 'cheat';
    if (stars.visible) {                                               // twinkle: each star's brightness breathes on its own clock
      const a = stars.geometry.attributes.color;
      for (let i = 0; i < NST; i++) { const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.8 + rnd(i) * 2.2) + i)) * (rnd(i * 3.3) > 0.85 ? 1.6 : 0.8);
        for (let k = 0; k < 3; k++) a.array[i * 3 + k] = starBase[i * 3 + k] * tw; }
      a.needsUpdate = true;
    }
    if (opts.codeAt) { code.position.copy(B(...opts.codeAt)); code.lookAt(B(...opts.codeFace)); }
    for (const m of [shardMat, streakMat, towerMat, flowMat, doorMat, figMat]) m.uniforms.uTime.value = t;
  }
  return { group, set, setFigure, door, tower, lifeSlot };
}
