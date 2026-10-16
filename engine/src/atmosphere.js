// Air: the thing that makes a CG room feel inhabited. Drawn after the depth-of-field pass, with a
// soft depth test against the scene, so out-of-focus dust becomes real bokeh discs.
//  - dust motes: lit only where light actually is (lamp cone, screen glow), drifting on slow currents
//  - lamp cone: the warm beam you see in a dusty room at night, fading with distance from the shade
import * as THREE from 'three';

export const COMMON = `
  uniform sampler2D tDepth; uniform vec2 res; uniform float near, far;
  #include <packing>
  float sceneDist(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }`;

export function createAtmosphere({ lamp, lampTarget, screen, count = 2200, center = [6.95, 3.0], spread = 1 }) {
  const scene = new THREE.Scene();
  const time = { value: 0 };
  const shared = { tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) }, near: { value: 0.02 }, far: { value: 400 } };

  // ---------------------------------------------------------------- dust
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    // denser around the desk, thinning out into the room
    const k = r() < 0.75 ? 0.6 : 1.6;
    pos[i * 3] = center[0] + (r() - 0.5) * 2.6 * k * spread;        // Blender x
    pos[i * 3 + 1] = 0.55 + r() * 1.7;                              // height (three y)
    pos[i * 3 + 2] = -(center[1] + (r() - 0.5) * 2.0 * k * spread);  // -Blender y
    seed[i * 4] = r(); seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const dust = new THREE.ShaderMaterial({
    uniforms: { ...shared, time, cocK: { value: 0 }, focus: { value: 1 }, px: { value: 1 },
      lampPos: { value: lamp.clone() }, lampDir: { value: lampTarget.clone().sub(lamp).normalize() },
      screenPos: { value: screen.clone() }, gain: { value: 1.0 },
      orbPos: { value: new THREE.Vector3() }, orbCol: { value: new THREE.Color() }, orbK: { value: 0 } },   // a glowing thing the dust catches (kf1's Claude; 0 = off)
    vertexShader: `attribute vec4 seed; uniform float time, cocK, focus, px, orbK; uniform vec3 lampPos, lampDir, screenPos, orbPos, orbCol; uniform vec2 res;   // res: declared here too (round 11 used it undeclared, so the dust never compiled)
      varying float vI; varying float vSoft; varying float vDepth; varying vec3 vCol;
      void main() {
        vec3 p = position;
        float t = time * (0.05 + 0.08 * seed.x);
        p += vec3(sin(t + seed.y * 6.28) * 0.06, sin(t * 0.7 + seed.z * 6.28) * 0.04 + time * 0.004 * (seed.w - 0.5), cos(t * 0.9 + seed.x * 6.28) * 0.06);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z; vDepth = d;
        // light reaching this mote: inside the lamp cone, or near the screens
        vec3 L = p - lampPos; float dl = length(L);
        float cone = smoothstep(0.62, 0.86, dot(L / dl, lampDir)) / (1.0 + dl * dl * 6.0);
        float scr = 1.0 / (1.0 + pow(length(p - screenPos) / 0.35, 2.0));
        vCol = vec3(1.0, 0.62, 0.32) * cone * 2.2 + vec3(0.55, 0.70, 1.0) * scr * 0.55 + vec3(0.004);   // motes only exist where light is
        if (orbK > 0.0) vCol += orbCol * orbK / (1.0 + pow(length(p - orbPos) / 0.3, 2.0));
        float size = (0.0007 + 0.0011 * seed.w) * px / d;          // 0.7-1.8 mm motes
        float coc = cocK * abs(d - focus) / d;                     // same thin lens as the scene
        float sz = max(size, coc * 2.0);
        vI = (0.35 + 0.65 * seed.z) * (size * size) / (sz * sz + 1e-4) * clamp(size, 0.0, 1.0);
        vSoft = clamp(coc / 3.0, 0.0, 1.0);
        gl_PointSize = clamp(sz, 1.0, 64.0 * max(1.0, res.y / 1080.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `${COMMON} uniform float gain; varying float vI; varying float vSoft; varying float vDepth; varying vec3 vCol;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0; float rr = dot(q, q); if (rr > 1.0) discard;
        float disc = mix(exp(-rr * 4.0), smoothstep(1.0, 0.75, rr) * (0.8 + 0.2 * rr), vSoft);   // sharp dot -> bokeh disc with a rim
        float occ = smoothstep(-0.02, 0.05, sceneDist(gl_FragCoord.xy / res) - vDepth);
        gl_FragColor = vec4(vCol * vI * disc * occ * gain, 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(g, dust);
  motes.frustumCulled = false;
  scene.add(motes);

  // ---------------------------------------------------------------- lamp beam
  const len = lamp.distanceTo(lampTarget) * 1.15;
  const coneG = new THREE.ConeGeometry(Math.tan(THREE.MathUtils.degToRad(36)) * len, len, 48, 12, true);
  coneG.translate(0, -len / 2, 0);                        // apex at the origin, opening along -Y
  const beam = new THREE.ShaderMaterial({
    uniforms: { ...shared, time, gain: { value: 1.0 }, len: { value: len } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT; varying float vDepth; varying vec3 vP; uniform float len;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = position; vT = -position.y / len;
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
        vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${COMMON} uniform float time, gain; varying vec3 vN; varying vec3 vV; varying float vT; varying float vDepth; varying vec3 vP;
      float n3(vec3 p){ return fract(sin(dot(floor(p), vec3(17.1, 31.7, 11.3))) * 4375.85); }
      float noise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(n3(i), n3(i + vec3(1,0,0)), f.x), mix(n3(i + vec3(0,1,0)), n3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(n3(i + vec3(0,0,1)), n3(i + vec3(1,0,1)), f.x), mix(n3(i + vec3(0,1,1)), n3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() {
        float edge = pow(abs(dot(normalize(vN), vV)), 1.6);                  // thick through the middle, thin at the rim
        float fall = pow(1.0 - clamp(vT, 0.0, 1.0), 1.4) * smoothstep(0.0, 0.08, vT);
        float wisp = 0.65 + 0.35 * noise(vP * 22.0 + vec3(0.0, time * 0.15, time * 0.05));
        float behind = sceneDist(gl_FragCoord.xy / res) - vDepth;
        float soft = smoothstep(0.0, 0.12, behind);                            // soft where the beam meets the desk
        gl_FragColor = vec4(vec3(1.0, 0.60, 0.30) * edge * fall * wisp * soft * 0.045 * gain, 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beamMesh = new THREE.Mesh(coneG, beam);
  beamMesh.position.copy(lamp);
  beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lampTarget.clone().sub(lamp).normalize());
  beamMesh.frustumCulled = false;
  scene.add(beamMesh);

  const extras = [];                    // more air from a scene (volume.js): { mesh, material, update(camera, t) }
  return {
    scene, dust, beam, beamMesh,
    add(x) { extras.push(x); scene.add(x.mesh); return x; },
    setTime(t) { time.value = t; },
    setLevels(lampK) { beam.uniforms.gain.value = lampK; },
    prepare(lens, renderer) {
      const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
      shared.tDepth.value = lens.rt.depthTexture; shared.res.value.copy(sz);
      shared.near.value = lens.camera.near; shared.far.value = lens.camera.far;
      for (const x of extras) if (x.update) x.update(lens.camera, time.value);
      for (const m of [dust, beam, ...extras.map((x) => x.material)]) {
        m.uniforms.tDepth.value = shared.tDepth.value; m.uniforms.res.value.copy(sz);
        m.uniforms.near.value = shared.near.value; m.uniforms.far.value = shared.far.value;
      }
      const f = lens.camera.projectionMatrix.elements[5];       // cot(fov/2)
      dust.uniforms.px.value = sz.y * 0.5 * f;                  // world size / distance -> pixels
      dust.uniforms.cocK.value = lens.mat.uniforms.k.value * 2.0 * (lens.px || 1);   // the lens works in 1080p pixels
      dust.uniforms.focus.value = lens.mat.uniforms.focus.value;
    },
  };
}
