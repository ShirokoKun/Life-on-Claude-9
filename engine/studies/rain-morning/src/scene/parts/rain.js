// Rain falling outside the window. Thin streaks, each a quad that turns about the vertical to face the
// camera, falling at ~7 m/s and blown a little by the same wind as the trees. A streak is lit by the
// grey sky it refracts: a faint pale line, brightest against the dark crowns, gone into the haze with
// distance. It is not part of the bake (gi = false) and adds light only, so it never darkens anything.
// Its fall is a pure function of uTime, so the film's shutter samples smear it like a real exposure.
import * as THREE from 'three';
import { RNG } from '../../core/rng.js';
import { GI } from '../../core/gi.js';
import { SKY } from '../sky.js';

export const order = 99;
export const label = 'rain';

const N = 60000;
const BOX = { x0: -7, x1: 10, y0: -5.5, y1: 9.5, z0: -0.6, z1: -26 };

export function build() {
  const r = new RNG(7001);
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.attributes.position); g.setAttribute('uv', quad.attributes.uv);
  const a = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    // denser near the window, where single streaks are resolved; the far ones only add up to haze
    const t = Math.pow(r.next(), 1.6);
    a[i * 4] = r.range(BOX.x0, BOX.x1);
    a[i * 4 + 1] = r.range(0, 1);
    a[i * 4 + 2] = BOX.z0 + (BOX.z1 - BOX.z0) * t;
    a[i * 4 + 3] = r.next();
  }
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = N;
  const H = [SKY.horizon[0], SKY.horizon[1], SKY.horizon[2]];
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    uniforms: { uTime: GI.uniforms.uTime, uExt: GI.uniforms.giExt, uK: { value: 1.0 } },
    vertexShader: /* glsl */`
      attribute vec4 aP; uniform float uTime; varying vec2 vUv; varying float vA;
      void main(){
        float H = ${(BOX.y1 - BOX.y0).toFixed(2)}, v = 6.5 + 2.0 * aP.w;
        float y = ${BOX.y0.toFixed(2)} + mod(aP.y * H - uTime * v, H);
        vec3 c = vec3(aP.x + 0.6 * sin(uTime * 0.7 + aP.w * 40.0) * 0.0, y, aP.z);
        vec3 fall = normalize(vec3(0.9, -v, -0.25));                       // wind leans the streaks a touch
        vec3 toCam = cameraPosition - c; toCam.y = 0.0; toCam = normalize(toCam);
        vec3 side = normalize(cross(fall, toCam));
        float dist = length(cameraPosition - c);
        float len = 0.11 + 0.05 * aP.w;
        float wid = max(0.0016, dist * 0.0009);                             // never thinner than ~1 px: fade instead
        vec3 p = c + fall * (position.y * len) + side * (position.x * wid);
        vUv = uv;
        vA = (0.0016 / wid) * smoothstep(0.35, 1.2, dist) * exp(-max(dist - 4.0, 0.0) * 0.045);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float; uniform float uExt, uK; varying vec2 vUv; varying float vA;
      void main(){
        float along = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float k = along * across * vA * uK;
        gl_FragColor = vec4(vec3(${H.map((x) => x.toFixed(3)).join(', ')}) * 0.3 * uExt * 0.55 * k, 0.0);
      }`,
  });
  mat.userData.bake = { ignore: true };
  const m = new THREE.Mesh(g, mat);
  m.name = 'rain'; m.frustumCulled = false; m.renderOrder = 5; m.userData.gi = false; m.userData.bakeOccluder = false;
  return m;
}
