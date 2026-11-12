// Pre-dawn sky. One description drives both the light bake (analytic radiance) and what you see
// through the window (dome shader: soft blue with a broken stratocumulus deck under a thin high veil,
// drifting slowly). The dome's mean radiance stays close to the analytic gradient the bake uses: the
// clear gaps are deeper than the mean, the silvery cloud edges brighter, the cloud cores about equal.
// (The display curve is very flat up here, so the structure needs these wide ratios to read at all.)
import * as THREE from 'three';
import { GI } from '../core/gi.js';

export const SKY = {
  // a grey rainy morning: low nimbostratus, the zenith brighter than the horizon (overcast), no sun glow
  zenith: [0.80, 0.86, 0.96],
  horizon: [0.58, 0.63, 0.70],
  glow: [0.0, 0.0, 0.0],
  glowDir: new THREE.Vector3(0.45, 0.22, -0.87).normalize().toArray(),
  ground: [0.028, 0.034, 0.03],
  display: 0.3,
};

export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTime: GI.uniforms.uTime, uExt: GI.uniforms.giExt, uZenith: { value: new THREE.Vector3(...SKY.zenith) }, uHorizon: { value: new THREE.Vector3(...SKY.horizon) },
      uGlow: { value: new THREE.Vector3(...SKY.glow) }, uGlowDir: { value: new THREE.Vector3(...SKY.glowDir) }, uGround: { value: new THREE.Vector3(...SKY.ground) },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }',
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vD; uniform float uTime; uniform float uExt; uniform vec3 uZenith, uHorizon, uGlow, uGlowDir, uGround;
      float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
      float fbm3(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * n2(p); p = ROT * p * 2.03 + 7.1; a *= .5; } return s / 0.875; }
      float fbm5(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * n2(p); p = ROT * p * 2.03 + 7.1; a *= .46; } return s / 0.88; }
      void main(){
        vec3 d = normalize(vD);
        if (d.y < 0.0) { gl_FragColor = vec4(mix(uHorizon * 0.6, uGround, smoothstep(0.0, -0.12, d.y)) * uExt, 1.0); return; }
        float t = sqrt(d.y);
        vec3 base = mix(uHorizon, uZenith, t);
        vec2 drift = vec2(uTime * 0.012, uTime * 0.004);
        // the rain deck: one low grey layer with soft darker billows, almost no structure (overcast keeps contrast low)
        vec2 p = d.xz / (d.y + 0.08) * 1.4 + drift;
        vec2 w = vec2(fbm3(p * 0.5 + 1.7), fbm3(p * 0.5 + vec2(8.3, 2.8))) - 0.5;
        float dn = fbm5(p * 0.9 + w * 1.8);
        vec3 sky = base * mix(1.08, 0.80, smoothstep(0.35, 0.75, dn));
        // ragged scud racing under the deck, a little darker
        vec2 q = d.xz / (d.y + 0.05) * 2.6 + drift * 3.5;
        float scud = smoothstep(0.55, 0.8, fbm5(q + 11.0));
        sky *= 1.0 - 0.16 * scud * smoothstep(0.0, 0.2, d.y);
        // rain haze: the horizon whitens and the far structure dissolves
        sky = mix(sky, uHorizon * 1.12, exp(-d.y * 9.0) * 0.7);
        gl_FragColor = vec4(sky * uExt * 0.3, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  m.name = 'sky'; m.frustumCulled = false; m.renderOrder = -10; m.userData.gi = false; m.userData.bakeOccluder = false;
  mat.userData.bake = { ignore: true };
  return m;
}
