// AAA cinematic toolkit for the studies (separate from the film's locked LOOK in engine/src/post.js):
//   pbr()         CC0 texture sets (albedo sRGB, normal, roughness, AO) with metric tiling
//   wetten()      a material patch: wet darkening + glossy roughness below a water line, rain streaks down walls
//   beam()        volumetric light shafts (additive, soft edges, drifting dust, faded at both ends)
//   fogCard()     layered mist planes with drifting noise (cheap depth-varying fog)
//   createPost()  HDR chain: render -> bloom -> grade (split-tone, CA, vignette, grain, letterbox) -> AgX output
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const NOISE_GLSL = `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// ------------------------------------------------------------------ textures
const loader = new THREE.TextureLoader();
let pending = 0; const waiters = [];
export const texturesReady = () => (pending === 0 ? Promise.resolve() : new Promise((r) => waiters.push(r)));
function load(url, srgb) {
  pending++;
  const t = loader.load(url, () => { if (--pending === 0) waiters.splice(0).forEach((r) => r()); }, undefined, () => { if (--pending === 0) waiters.splice(0).forEach((r) => r()); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cache = {};
export function pbr(id, base = '../assets/tex') {
  if (!cache[id]) cache[id] = {
    map: load(`${base}/${id}/albedo.jpg`, true), normalMap: load(`${base}/${id}/normal.jpg`),
    roughnessMap: load(`${base}/${id}/rough.jpg`), aoMap: load(`${base}/${id}/ao.jpg`),
  };
  return cache[id];
}

// ------------------------------------------------------------------ wet surfaces
// level: the water line (world y); band: how high the wet wicks; streaks: rain-stain strength on verticals
export function wetten(mat, { level = 0.0, band = 1.2, streaks = 0.3, wetRough = 0.06, darken = 0.5 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWetLevel = { value: level }; sh.uniforms.uWetBand = { value: band };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wpw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpw = instanceMatrix * wpw;
        #endif
        vWPos = (modelMatrix * wpw).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos; uniform float uWetLevel, uWetBand;\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wn = fbm2(vWPos.xz * 0.9 + vWPos.y * 0.3);
        float wet = 1.0 - smoothstep(uWetLevel + uWetBand * (0.5 + 0.6 * wn) - 0.25, uWetLevel + uWetBand * (0.5 + 0.6 * wn) + 0.1, vWPos.y);
        float st = smoothstep(0.55, 0.85, vn(vec2(dot(vWPos.xz, vec2(2.7, 1.9)), vWPos.y * 0.04))) * ${streaks.toFixed(3)};
        diffuseColor.rgb *= mix(1.0, ${darken.toFixed(3)}, wet) * (1.0 - st * 0.6);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, ${wetRough.toFixed(3)}, wet * 0.92);
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.7, st);`);
  };
  mat.customProgramCacheKey = () => `wet:${level}:${band}:${streaks}:${wetRough}:${darken}`;
  return mat;
}

// ------------------------------------------------------------------ light shafts
export function beamMaterial({ color = '#7fb2ff', intensity = 1.0, fogColor, fogDensity = 0.01 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uTime: { value: 0 },
      uFog: { value: fogDensity } },
    vertexShader: `varying vec3 vN, vW; varying float vL;
      void main(){ vL = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI, uTime, uFog; varying vec3 vN, vW; varying float vL;
      ${NOISE_GLSL}
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float edge = pow(abs(dot(normalize(vN), V)), 2.2);                      // soft round edges
        float ends = smoothstep(0.0, 0.18, vL) * smoothstep(1.0, 0.55, vL);    // fade at the ceiling and the floor
        float dust = 0.65 + 0.35 * fbm2(vec2(vW.x * 0.7 + vW.z * 0.7, vW.y * 0.25 - uTime * 0.12));
        float d = length(cameraPosition - vW); float fog = exp(-uFog * d * 0.6);
        gl_FragColor = vec4(uColor * uI * edge * ends * dust * fog, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });
}
// a shaft from `top` to `bottom`, radius r0 at the top widening to r1
export function beam(top, bottom, r0, r1, mat) {
  const h = top.distanceTo(bottom);
  const g = new THREE.CylinderGeometry(r0, r1, h, 28, 1, true);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(top).add(bottom).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize());
  m.renderOrder = 5;
  return m;
}

// ------------------------------------------------------------------ fog cards
export function fogCardMaterial({ color = '#2c4a73', opacity = 0.12, scale = 0.08, speed = 0.02, fogDensity = 0.01 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uO: { value: opacity }, uT: { value: 0 }, uS: { value: scale }, uSp: { value: speed }, uFog: { value: fogDensity } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uO, uT, uS, uSp, uFog; varying vec2 vUv; varying vec3 vW; ${NOISE_GLSL}
      void main(){
        float n = fbm2(vW.xz * uS + vec2(uT * uSp, uT * uSp * 0.4)) * fbm2(vW.xy * uS * 0.7 - vec2(uT * uSp * 0.6, 0.0));
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        float d = length(cameraPosition - vW); float near = smoothstep(2.0, 9.0, d);
        gl_FragColor = vec4(uColor * n * 2.0 * uO * edge * near, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

// ------------------------------------------------------------------ post
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 1080) },
    uCA: { value: 0.0018 }, uVig: { value: 0.55 }, uGrain: { value: 0.035 }, uAspect: { value: 2.39 },
    uShadow: { value: new THREE.Color(0.86, 0.95, 1.12) }, uHigh: { value: new THREE.Color(1.1, 0.98, 0.88) },
    uExposure: { value: 1.0 }, uContrast: { value: 1.12 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uCA, uVig, uGrain, uAspect, uExposure, uContrast; uniform vec2 uRes;
    uniform vec3 uShadow, uHigh; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 q = vUv - 0.5; float r2 = dot(q, q);
      vec2 off = q * uCA * (1.0 + 4.0 * r2);
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b) * uExposure;
      c = pow(max(c, 0.0) / 0.18, vec3(uContrast)) * 0.18;           // contrast round middle grey (scene-linear)
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(0.02, 1.2, l);
      c *= mix(uShadow, uHigh, k);                                    // split tone: cool shadows, warm highlights
      c *= 1.0 - uVig * smoothstep(0.08, 0.62, r2 * 1.6);
      float g = h(vUv * uRes + fract(uTime * 7.13) * 91.0) - 0.5;
      c += c * g * uGrain * 2.0 + g * uGrain * 0.015;                // grain, luminance weighted
      float bar = (1.0 - uRes.x / (uRes.y * uAspect)) * 0.5;          // letterbox
      if (uAspect > 0.0 && (vUv.y < bar || vUv.y > 1.0 - bar)) c = vec3(0.0);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { bloom = [0.9, 0.6, 0.9], aspect = 2.39 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), ...bloom);
  composer.addPass(bloomPass);
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uRes.value.copy(size); grade.uniforms.uAspect.value = aspect;
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return { composer, bloomPass, grade, render: (t) => { grade.uniforms.uTime.value = t; composer.render(); } };
}
