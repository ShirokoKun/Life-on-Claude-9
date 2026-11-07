// THE CISTERN: the AAA environment study.
// A flooded brutalist cistern the size of a cathedral. A causeway of cold guide lights leads the eye down a colonnade
// of precast pillars to a colossal ring whose inner edge burns red-orange; the ring is slowly pulling the room apart,
// drawing concrete debris into itself. Blue light falls in shafts from slots in an unseen ceiling. Black water
// doubles everything. One cloaked figure stands at the end of the causeway: the scale reference and the story.
// Palette (the director's taste): a large cold blue field, one small hot accent, light with visible air, wet reflections.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { run, keyed, smooth, clamp } from '../lib/harness.js';
import { box } from '../lib/geo.js';
import { pbr, wetten, beam, beamMaterial, fogCardMaterial, createPost, texturesReady, NOISE_GLSL } from '../lib/cine.js';

const Q = new URLSearchParams(location.search);
const DURATION = 10;
const stage = document.getElementById('stage');
const W = stage.clientWidth || 1920, H = stage.clientHeight || 1080;

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = +(Q.get('exp') || 1.0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const FOG = new THREE.Color('#091a30'), FOG_D = 0.0135;
const scene = new THREE.Scene();
scene.background = FOG.clone().multiplyScalar(0.7);
scene.fog = new THREE.FogExp2(FOG, FOG_D);
const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 600);

// ------------------------------------------------------------------ environment (what the metal and wet concrete reflect)
{
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = normalize(vP).y;
      vec3 c = mix(vec3(0.010, 0.020, 0.040), vec3(0.05, 0.10, 0.19), smoothstep(-0.3, 0.15, y)) * mix(1.0, 0.35, smoothstep(0.2, 0.9, y));
      gl_FragColor = vec4(c, 1.0); }` }));
  env.add(sky);
  const hot = new THREE.Mesh(new THREE.TorusGeometry(10, 1.2, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 1.6, 0.4) }));
  hot.position.set(0, 4, -40); env.add(hot);
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.8, 1.4), side: THREE.DoubleSide })); s.position.set(-30 + i * 12, 38, -10); s.rotation.x = 1.1; env.add(s); }
  scene.environment = pm.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 0.6;
}

// ------------------------------------------------------------------ materials
const T = (id, rep) => { const s = pbr(id); for (const k in s) s[k].repeat.set(rep, rep); return s; };
const concP = pbr('preconcrete_wall_001'), concF = pbr('concrete_floor_worn_001'), concW = pbr('concrete_wall_008'), metal = pbr('metal_plate');
for (const s of [concP, concF, concW, metal]) for (const k in s) s[k].repeat.set(1, 1);
const MAT = {
  pillar: wetten(new THREE.MeshStandardMaterial({ ...concP, color: '#737980', roughness: 1.0, normalScale: new THREE.Vector2(1.2, 1.2), aoMapIntensity: 1.0 }), { level: 0, band: 1.8, streaks: 0.45 }),
  wall: wetten(new THREE.MeshStandardMaterial({ ...concW, color: '#6c727a', roughness: 1.0 }), { level: 0, band: 2.4, streaks: 0.5 }),
  walk: wetten(new THREE.MeshStandardMaterial({ ...concF, color: '#8a8f94', roughness: 1.0, normalScale: new THREE.Vector2(0.8, 0.8) }), { level: 0.6, band: 0.0, streaks: 0, wetRough: 0.12, darken: 0.6 }),
  ring: new THREE.MeshStandardMaterial({ ...metal, color: '#33363b', metalness: 0.92, roughness: 0.55, envMapIntensity: 1.6 }),
  ringDark: new THREE.MeshStandardMaterial({ color: '#141518', metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 }),
  hot: new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 3.0, 0.6), fog: false }),
  hotSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.7, 0.15) }),
  guide: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 4, 6.5) }),
  slit: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.7, 1.3) }),
  cloak: new THREE.MeshStandardMaterial({ color: '#0d0e11', roughness: 0.85, metalness: 0 }),
};

const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; m.castShadow = o.cast ?? true; m.receiveShadow = true; scene.add(m); return m; };

// ------------------------------------------------------------------ architecture
const RING = new THREE.Vector3(0, 8.0, -66);
// the colonnade: two rows of precast pillars on submerged plinths, a second fainter row beyond, beams overhead
for (const s of [-1, 1]) {
  for (let i = 0; i < 16; i++) {
    const z = 12 - i * 10;
    add(box(2.6, 48, 2.6, 3.2), MAT.pillar, s * 9.5, 22, z);
    add(box(3.6, 1.4, 3.6, 3.2), MAT.pillar, s * 9.5, -0.3, z);                 // the plinth, half drowned
    add(box(1.0, 46, 0.5, 3.2), MAT.pillar, s * 9.5 - s * 1.55, 21, z);        // a fin on the inner face: verticals catch the rim light
    if (i % 2 === 0) add(box(17.6, 2.2, 2.4, 3.2), MAT.pillar, 0, 30 + (i % 4) * 2, z, { cast: false });   // cross beams in the dark
    add(box(3.2, 52, 3.2, 3.2), MAT.wall, s * 22, 24, z - 5, { cast: false });  // the outer row, lost in fog
  }
  // outer walls with tall slit windows of cold light
  add(box(1, 60, 200, 4), MAT.wall, s * 31, 28, -80, { cast: false });
  for (let i = 0; i < 18; i++) add(new THREE.PlaneGeometry(0.5, 16), MAT.slit, s * 30.45, 14, 6 - i * 11, { ry: -s * Math.PI / 2, cast: false });
}
// behind the ring: a monumental stair rising into the fog, and an end wall
for (let i = 0; i < 26; i++) add(box(34 - i * 0.4, 1.6, 4, 3.2), MAT.wall, 0, -0.4 + i * 1.6, -84 - i * 4, { cast: false });
add(box(90, 90, 2, 6), MAT.wall, 0, 30, -196, { cast: false });

// the causeway: a long thin slab just above the water, cold guide lights at its edges (leading lines in the reflection)
const WALK_Z0 = 14, WALK_Z1 = -56;
add(box(1.7, 0.6, WALK_Z0 - WALK_Z1, 2.2), MAT.walk, 0, -0.12, (WALK_Z0 + WALK_Z1) / 2);
const guideGeo = new THREE.BoxGeometry(0.07, 0.04, 0.3);
for (let z = WALK_Z0 - 1; z > WALK_Z1; z -= 3) for (const s of [-1, 1]) add(guideGeo, MAT.guide, s * 0.8, 0.2, z, { cast: false });
add(box(3.4, 0.5, 3.4, 2.2), MAT.walk, 0, -0.15, WALK_Z1 - 1.2);                 // the landing at the end

// ------------------------------------------------------------------ the ring
const ring = new THREE.Group(); ring.position.copy(RING); scene.add(ring);
{
  const body = new THREE.Mesh(new THREE.TorusGeometry(8.4, 0.95, 24, 160), MAT.ring); body.castShadow = true; ring.add(body);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(7.42, 0.22, 12, 160), MAT.ringDark); ring.add(lip);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(7.28, 0.075, 8, 220), MAT.hot); ring.add(seam);          // the burning inner edge
  const seam2 = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.03, 6, 220), MAT.hotSoft); seam2.position.z = 0.45; ring.add(seam2);
  // mechanical ribs round the outside (greebles at the scale of a building)
  const rib = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.4, 2.4), MAT.ringDark, 48);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, r = 9.25 + (i % 3 === 0 ? 0.35 : 0);
    e.set(0, 0, a - Math.PI / 2); q.setFromEuler(e);
    m.compose(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0), q, new THREE.Vector3(1, i % 3 === 0 ? 1.6 : 1, i % 3 === 0 ? 1.1 : 0.8));
    rib.setMatrixAt(i, m);
  }
  rib.castShadow = true; ring.add(rib);
  // the threshold: a swirling heat inside the ring (additive), brightest at the edge
  const disk = new THREE.Mesh(new THREE.CircleGeometry(7.3, 128), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vP; ${NOISE_GLSL}
      void main(){ float r = length(vP) / 7.3; float a = atan(vP.y, vP.x);
        vec2 sw = vec2(cos(a + uT * 0.12 + r * 3.0), sin(a + uT * 0.12 + r * 3.0)) * r * 3.0;
        float n = fbm2(sw + vec2(uT * 0.05, -uT * 0.03)) ;
        float edge = pow(smoothstep(0.84, 1.0, r), 4.0);
        float veil = n * n * smoothstep(0.45, 0.98, r);
        vec3 c = vec3(1.0, 0.22, 0.05) * (edge * 1.4 + veil * 0.16) + vec3(0.25, 0.03, 0.01) * 0.035;
        gl_FragColor = vec4(c, 1.0); }` }));
  disk.position.z = -0.05; ring.add(disk); ring.userData.disk = disk;
  // the veil behind the burning edge: a dark, slowly turning heart (an eclipse, not a sun)
  const veil = new THREE.Mesh(new THREE.CircleGeometry(7.32, 96), new THREE.ShaderMaterial({
    uniforms: { uT: disk.material.uniforms.uT }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vP; ${NOISE_GLSL}
      void main(){ float r = length(vP) / 7.32; float a = atan(vP.y, vP.x);
        float n = fbm2(vec2(cos(a - uT * 0.05), sin(a - uT * 0.05)) * r * 2.2 + uT * 0.02);
        float alpha = (0.78 - 0.25 * n) * smoothstep(1.0, 0.8, r);
        gl_FragColor = vec4(vec3(0.02, 0.008, 0.01) + vec3(0.12, 0.02, 0.0) * pow(r, 6.0), alpha); }` }));
  veil.position.z = -0.12; veil.renderOrder = 2; disk.renderOrder = 3; ring.add(veil);
}

// ------------------------------------------------------------------ the figure (for scale): a cloaked silhouette facing the ring
const figure = new THREE.Group(); figure.position.set(0.15, 0.18, WALK_Z1 + 1.0); scene.add(figure);
{
  const pts = [[0, 0], [0.42, 0], [0.4, 0.15], [0.33, 0.7], [0.27, 1.15], [0.23, 1.32], [0.18, 1.42], [0.0, 1.45]].map(([a, b]) => new THREE.Vector2(a, b));
  const cloak = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), MAT.cloak); cloak.castShadow = true; figure.add(cloak);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), MAT.cloak); hood.scale.set(1, 1.25, 1.1); hood.position.set(0, 1.58, 0.01); figure.add(hood);
  figure.userData.cloak = cloak;
}

// chains hanging out of the dark: foreground silhouettes that slide past during the push
{
  const link = new THREE.TorusGeometry(0.16, 0.045, 6, 12);
  const chainMat = new THREE.MeshStandardMaterial({ color: '#1a1b1e', metalness: 0.9, roughness: 0.45 });
  const chains = [[-4.3, -4, 3.4], [4.6, -16, 4.6], [-4.8, -30, 6.0], [3.6, -45, 5.2]];
  const n = chains.reduce((a, c) => a + Math.ceil((46 - c[2]) / 0.26), 0);
  const im = new THREE.InstancedMesh(link, chainMat, n); let k = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const [x, z, y0] of chains) {
    for (let y = y0, j = 0; y < 46; y += 0.26, j++) {
      q.setFromEuler(new THREE.Euler(0, j % 2 ? Math.PI / 2 : 0, Math.PI / 2));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k++, m);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 8, 16, Math.PI * 1.4), chainMat); hook.position.set(x, y0 - 0.45, z); hook.rotation.z = -0.9; scene.add(hook);
  }
  im.count = k; im.castShadow = true; scene.add(im);
}

// ------------------------------------------------------------------ water: a planar mirror with ripples, drips and roughness
const WaterShader = {
  uniforms: { color: { value: new THREE.Color(1, 1, 1) }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uT: { value: 0 }, uFog: { value: FOG }, uFogD: { value: FOG_D }, uDeep: { value: new THREE.Color('#010306') } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 color, uFog, uDeep; uniform float uT, uFogD; varying vec4 vUv; varying vec3 vW;
    ${NOISE_GLSL}
    vec2 slope(vec2 p){
      float e = 0.08; vec2 o = vec2(uT * 0.05, uT * 0.03);
      float n0 = fbm2(p * 0.22 + o), nx = fbm2((p + vec2(e, 0.0)) * 0.22 + o), nz = fbm2((p + vec2(0.0, e)) * 0.22 + o);
      vec2 g = vec2(nx - n0, nz - n0) / e * 0.35;
      for (int i = 0; i < 14; i++) {                          // drips from the ceiling: expanding rings
        float fi = float(i);
        vec2 c = vec2(h21(vec2(fi, 1.3)) * 24.0 - 12.0, 8.0 - h21(vec2(fi, 7.1)) * 74.0);
        float per = 2.2 + h21(vec2(fi, 3.3)) * 2.6, tt = mod(uT + h21(vec2(fi, 9.9)) * per, per);
        vec2 d = p - c; float r = length(d), fr = tt * 1.4;
        float w = cos((r - fr) * 16.0) * exp(-abs(r - fr) * 4.0) * exp(-tt * 1.1);
        g += d / (r + 1e-3) * w * 0.22;
      }
      return g;
    }
    void main(){
      vec2 g = slope(vW.xz);
      vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 V = normalize(cameraPosition - vW);
      float F = mix(0.2, 1.0, pow(1.0 - max(dot(N, V), 0.0), 3.0));
      float d = length(cameraPosition - vW);
      vec2 uv = vUv.xy / vUv.w + N.xz * 0.035;
      float bl = 0.0012 + d * 0.00004;                      // further = rougher reflection
      vec3 refl = texture2D(tDiffuse, uv).rgb * 0.36
        + (texture2D(tDiffuse, uv + vec2(bl, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(bl, 0.0)).rgb
         + texture2D(tDiffuse, uv + vec2(0.0, bl * 2.5)).rgb + texture2D(tDiffuse, uv - vec2(0.0, bl * 2.5)).rgb) * 0.16;
      vec3 c = mix(uDeep, refl * color, F);
      float f = 1.0 - exp(-pow(uFogD * d, 2.0));
      gl_FragColor = vec4(mix(c, uFog, f), 1.0);
    }`,
};
const RQ = +(Q.get('rq') || 0.5);
const water = new Reflector(new THREE.PlaneGeometry(400, 400), { shader: WaterShader, textureWidth: W * RQ, textureHeight: H * RQ, clipBias: 0.002 });
water.rotation.x = -Math.PI / 2; water.position.y = 0; scene.add(water);

// ------------------------------------------------------------------ light
scene.add(new THREE.HemisphereLight('#1d3354', '#010204', 0.32));
const moon = new THREE.DirectionalLight('#7aa6e8', 2.2);
moon.position.set(-24, 60, -8); moon.target.position.set(4, 0, -40); scene.add(moon, moon.target);
moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 70, bottom: -70, near: 10, far: 160 }); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.05;
const ringLight = new THREE.PointLight('#ff4f1a', 160, 0, 2); ringLight.position.copy(RING).add(new THREE.Vector3(0, 0, 1.5)); scene.add(ringLight);
const ringLow = new THREE.PointLight('#ff6a2a', 18, 30, 2); ringLow.position.set(0, 1.6, RING.z + 5); scene.add(ringLow);
const ringBack = new THREE.PointLight('#ff3a10', 90, 0, 2); ringBack.position.copy(RING).add(new THREE.Vector3(0, 0, -3)); scene.add(ringBack);
// a cold kicker high in front: draws the ring's machined front face and the ribs out of the dark
const kick = new THREE.SpotLight('#9cc4ff', 5200, 0, 0.3, 0.6, 2); kick.position.set(-10, 34, -30); kick.target.position.copy(RING); scene.add(kick, kick.target);

// shafts: cold light through slots in the ceiling, falling between the pillars along the moon's direction
const beamMat = beamMaterial({ color: '#86b6ff', intensity: 0.26, fogDensity: FOG_D });
const LDIR = moon.position.clone().sub(moon.target.position).normalize();
const shafts = [[-4.5, -6], [3.5, -22], [-2.0, -38], [5.5, -50], [-6.0, -78], [6.5, 4]];
for (const [x, z] of shafts) {
  const bottom = new THREE.Vector3(x, 0, z), top = bottom.clone().addScaledVector(LDIR, 52);
  scene.add(beam(top, bottom, 1.3, 2.6, beamMat));
}
// mist: vertical cards across the hall and a low layer on the water
const mistMats = [];
for (let i = 0; i < 9; i++) {
  const mm = fogCardMaterial({ color: '#3f6aa8', opacity: 0.05, scale: 0.06 + i * 0.004, speed: 0.6, fogDensity: FOG_D }); mistMats.push(mm);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(70, 16), mm); c.position.set(0, 6.5, 4 - i * 11); c.renderOrder = 4; scene.add(c);
}
for (let i = 0; i < 4; i++) {
  const mm = fogCardMaterial({ color: '#5a86c2', opacity: 0.022, scale: 0.12, speed: 0.9 }); mistMats.push(mm);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(60, 120), mm); c.rotation.x = -Math.PI / 2; c.position.set(0, 0.35 + i * 0.35, -45); c.renderOrder = 4; scene.add(c);
}

// ------------------------------------------------------------------ the ring's pull: floating debris, an inward stream, embers
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const debrisMat = new THREE.MeshStandardMaterial({ ...concP, color: '#7d838a', roughness: 1 });
debrisMat.onBeforeCompile = (sh) => {   // instanceColor > 1 means heat: glows, never brightens the albedo
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <color_fragment>', '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n diffuseColor.rgb *= min(vColor, vec3(1.0));\n#endif')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n totalEmissiveRadiance += max(vColor - 1.0, vec3(0.0)) * vec3(12.0, 2.4, 0.5);\n#endif');
};
// big slabs hanging in the air around the ring
const NS = 72, slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), debrisMat, NS);
slabs.castShadow = true; slabs.receiveShadow = true; scene.add(slabs);
const slabData = [];
for (let i = 0; i < NS; i++) {
  const a = rnd() * Math.PI * 2, r = 9.8 + rnd() * 13;
  slabData.push({ p: new THREE.Vector3(Math.cos(a) * r * 1.2, Math.max(1.5, RING.y + Math.sin(a) * r * 0.9), RING.z + (rnd() - 0.5) * 22),
    s: new THREE.Vector3(0.5 + rnd() * 3.2, 0.3 + rnd() * 1.6, 0.5 + rnd() * 2.6).multiplyScalar(rnd() < 0.18 ? 2.0 : 1),
    rot: new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6), spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.08), bob: rnd() * 6 });
  slabs.setColorAt(i, new THREE.Color(1, 1, 1));
}
// the stream: small fragments spiralling into the ring, heating as they go
const NSTR = 160, stream = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), debrisMat, NSTR);
scene.add(stream);
const strData = [];
for (let i = 0; i < NSTR; i++) { strData.push({ a: rnd() * Math.PI * 2, r: 12 + rnd() * 14, z: 4 + rnd() * 16, y: (rnd() - 0.5) * 8, ph: rnd(), s: 0.08 + rnd() * 0.35, life: 7 + rnd() * 5 }); stream.setColorAt(i, new THREE.Color(1, 1, 1)); }
// embers
const NE = 700, eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NE * 3), 3));
eGeo.setAttribute('aS', new THREE.Float32BufferAttribute(Float32Array.from({ length: NE }, () => 0.5 + rnd()), 1));
const pointsMat = (col, size) => new THREE.ShaderMaterial({
  uniforms: { uC: { value: col }, uSize: { value: size * H / 1080 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: 'attribute float aS; uniform float uSize; varying float vF; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * aS / -mv.z; vF = exp(-0.0003 * mv.z * mv.z); }',
  fragmentShader: 'uniform vec3 uC; varying float vF; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uC * a * vF, 1.0); }',
});
const embers = new THREE.Points(eGeo, pointsMat(new THREE.Color(3, 0.7, 0.15), 50)); embers.frustumCulled = false; scene.add(embers);
const emData = Array.from({ length: NE }, () => ({ a: rnd() * Math.PI * 2, r: 7.5 + rnd() * 9, z: (rnd() - 0.3) * 10, ph: rnd(), sp: 0.3 + rnd() * 0.8 }));
// dust in the shafts
const ND = 900, dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ND * 3), 3));
dGeo.setAttribute('aS', new THREE.Float32BufferAttribute(Float32Array.from({ length: ND }, () => 0.4 + rnd()), 1));
const dust = new THREE.Points(dGeo, pointsMat(new THREE.Color(0.9, 1.2, 1.6), 22)); dust.frustumCulled = false; scene.add(dust);
const dData = Array.from({ length: ND }, (_, i) => { const s = shafts[i % shafts.length]; return { x: s[0], z: s[1], u: rnd(), rr: Math.sqrt(rnd()) * 1.6, a: rnd() * 6.3, ph: rnd() }; });

// ------------------------------------------------------------------ camera: one slow push down the causeway, operated feel
const CAMK = {
  pos: [[0, [0.55, 1.55, 6.5]], [DURATION, [0.15, 1.3, -12]]],
  at: [[0, [0, 6.4, -64]], [DURATION, [0, 7.4, -66]]],
};
if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); CAMK.pos = [[0, c.slice(0, 3)]]; CAMK.at = [[0, c.slice(3, 6)]]; if (c[6]) camera.fov = c[6]; }
function updateCamera(t) {
  const u = t / DURATION, e = u * u * (3 - 2 * u) * 0.35 + u * 0.65;   // a push that settles, never stops dead
  const p0 = CAMK.pos[0][1], p1 = CAMK.pos[CAMK.pos.length - 1][1], a0 = CAMK.at[0][1], a1 = CAMK.at[CAMK.at.length - 1][1];
  camera.position.set(...p0.map((v, i) => v + (p1[i] - v) * e));
  const hx = Math.sin(t * 0.71) * 0.025 + Math.sin(t * 1.63) * 0.01, hy = Math.sin(t * 0.53 + 1) * 0.018;   // operator breathing
  camera.lookAt(...a0.map((v, i) => v + (a1[i] - v) * e + (i === 0 ? hx * 30 : i === 1 ? hy * 30 : 0)));
  camera.rotateZ(Math.sin(t * 0.37) * 0.004);
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ post
const post = createPost(renderer, scene, camera, { bloom: [0.42, 0.55, 1.0], aspect: Q.get('aspect') ? +Q.get('aspect') : 2.39 });

// ------------------------------------------------------------------ the clock
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function update(t) {
  water.material.uniforms.uT.value = t;
  beamMat.uniforms.uTime.value = t;
  for (const m of mistMats) m.uniforms.uT.value = t;
  ring.userData.disk.material.uniforms.uT.value = t;
  ring.rotation.z = t * 0.012;
  const pulse = 1 + 0.06 * Math.sin(t * 1.7) + 0.03 * Math.sin(t * 4.3);
  ringLight.intensity = 160 * pulse; ringBack.intensity = 90 * pulse;
  MAT.hot.color.setRGB(16 * pulse, 3.0 * pulse, 0.6);
  // the figure: the cloak breathes in the draught toward the ring
  figure.userData.cloak.scale.set(1 + 0.012 * Math.sin(t * 2.1), 1, 1 + 0.02 * Math.sin(t * 1.3));
  // slabs drift and turn
  slabData.forEach((d, i) => {
    _e.set(d.rot.x + d.spin.x * t, d.rot.y + d.spin.y * t, d.rot.z + d.spin.z * t); _q.setFromEuler(_e);
    _p.copy(d.p); _p.y += Math.sin(t * 0.4 + d.bob) * 0.25;
    _m.compose(_p, _q, d.s); slabs.setMatrixAt(i, _m);
  });
  slabs.instanceMatrix.needsUpdate = true;
  // the inward stream
  strData.forEach((d, i) => {
    const u = ((t / d.life + d.ph) % 1), k = Math.pow(1 - u, 1.6);
    const r = 0.4 + d.r * k, a = d.a + u * 3.2;
    _p.set(Math.cos(a) * r, Math.sin(a) * r * 0.85 + d.y * k, d.z * k).add(RING);
    if (_p.y < 0.4) _p.y = 0.4 + (0.4 - _p.y) * 0.2;
    _e.set(t * 0.9 + i, t * 1.3 + i * 2, i); _q.setFromEuler(_e);
    const sc = d.s * (0.25 + 0.75 * Math.min(1, k * 2.5)) * Math.min(1, u * 8);
    _s.setScalar(sc); _m.compose(_p, _q, _s); stream.setMatrixAt(i, _m);
    const heat = smooth((u - 0.55) / 0.4);
    _c.setRGB(1 + heat * 1.0, 1 + heat * 0.35, 1 + heat * 0.1); stream.setColorAt(i, _c);
  });
  stream.instanceMatrix.needsUpdate = true; stream.instanceColor.needsUpdate = true;
  // embers: rising spirals round the ring's edge
  const ep = eGeo.attributes.position;
  emData.forEach((d, i) => {
    const u = (t * d.sp * 0.1 + d.ph) % 1, a = d.a + u * 1.5, r = d.r * (1 - u * 0.3);
    ep.setXYZ(i, RING.x + Math.cos(a) * r, RING.y + Math.sin(a) * r + u * 4, RING.z + d.z + Math.sin(u * 9 + d.a) * 0.6);
  });
  ep.needsUpdate = true;
  const dp = dGeo.attributes.position;
  dData.forEach((d, i) => {
    const u = (d.u + t * 0.006 * (0.5 + d.ph)) % 1, h = u * 26;
    dp.setXYZ(i, d.x + LDIR.x * h + Math.cos(d.a + t * 0.1) * d.rr, h * LDIR.y + 0.2, d.z + LDIR.z * h + Math.sin(d.a + t * 0.1) * d.rr);
  });
  dp.needsUpdate = true;
  updateCamera(t);
}
run({ duration: DURATION, update, render: (t) => post.render(t), ready: texturesReady() });
