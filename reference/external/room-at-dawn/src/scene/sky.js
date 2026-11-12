// Pre-dawn sky. One description drives both the light bake (analytic radiance) and what you see
// through the window (dome shader: soft blue with a broken stratocumulus deck under a thin high veil,
// drifting slowly). The dome's mean radiance stays close to the analytic gradient the bake uses: the
// clear gaps are deeper than the mean, the silvery cloud edges brighter, the cloud cores about equal.
// (The display curve is very flat up here, so the structure needs these wide ratios to read at all.)
import * as THREE from 'three';
import { GI } from '../core/gi.js';

export const SKY = {
  zenith: [0.30, 0.47, 0.92],
  horizon: [0.80, 0.97, 1.30],
  glow: [0.30, 0.24, 0.16],           // faint warm brightening where the sun will come up
  glowDir: new THREE.Vector3(0.45, 0.22, -0.87).normalize().toArray(),
  ground: [0.035, 0.045, 0.035],
  display: 0.3,                       // the dome is shown darker than it lights (so it keeps colour instead of clipping)
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
        float g = max(dot(d, uGlowDir), 0.0), g2 = g * g;
        vec3 base = mix(uHorizon, uZenith, t) + uGlow * g2;
        // clear air between the clouds: much deeper and bluer than the mean sky, paling into the horizon
        vec3 sky = base * mix(vec3(0.38, 0.52, 0.79), vec3(0.8, 0.88, 0.96), exp(-d.y * 7.0));
        vec2 drift = vec2(uTime * 0.009, uTime * 0.0035);

        // high thin veil: long pale streaks far above the deck, barely moving
        vec2 q = d.xz / (d.y + 0.3) * 1.3 + drift * 0.3;
        float veil = smoothstep(0.36, 0.8, fbm3(vec2(q.x * 0.9 + q.y * 0.55, q.y * 2.6 - q.x * 0.35) + 3.7));
        sky = mix(sky, base * vec3(0.9, 0.95, 1.0), veil * 0.5);

        // broken stratocumulus, projected on a plane overhead. Seen from underneath before sunrise:
        // thin edges are silvery (sky light coming through), thick cores are blue-grey.
        vec2 p = d.xz / (d.y + 0.11) * 1.9 + drift;
        vec2 w = vec2(fbm3(p * 0.55 + 1.7), fbm3(p * 0.55 + vec2(8.3, 2.8))) - 0.5;
        float dn = fbm5(p * 1.2 + w * 1.5) + (n2(p * 0.21 + 4.0) - 0.5) * 0.24;      // + regions of open sky / closed deck
        float cov = smoothstep(0.42, 0.62, dn), thick = smoothstep(0.5, 0.76, dn);
        vec3 edge = vec3(1.0, 1.12, 1.34) * (1.0 + 0.35 * g2) + uGlow * (1.4 * g2);
        vec3 core = vec3(0.39, 0.49, 0.72) + uGlow * (0.7 * g2);
        vec3 cloud = mix(edge, core, thick) * mix(0.88, 1.0, exp(-d.y * 2.0));
        sky = mix(sky, cloud, cov * 0.92 * smoothstep(0.0, 0.12, d.y));

        // low haze band, warmer and a little brighter towards the coming sunrise
        float lowg = g2 * g2 * exp(-d.y * 4.5);
        sky = mix(sky, uHorizon * vec3(0.94, 0.95, 0.96), exp(-d.y * 16.0) * 0.6);
        sky += vec3(0.42, 0.25, 0.09) * lowg;
        gl_FragColor = vec4(sky * uExt * 0.3, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  m.name = 'sky'; m.frustumCulled = false; m.renderOrder = -10; m.userData.gi = false; m.userData.bakeOccluder = false;
  mat.userData.bake = { ignore: true };
  return m;
}
