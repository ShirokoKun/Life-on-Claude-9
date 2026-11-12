// Rain Morning: the lit candle on the sill and the steam off a fresh mug of tea.
// The flame is a small emissive teardrop that breathes and leans; its light reaches every baked material
// through GI.uniforms.giCandle* (core/gi.js), flickering with it. The steam is a ray-marched volume,
// lit from behind by the window (strong forward scattering, so it glows against the grey glass) and a
// little warm on the side that faces the flame. Both live in an overlay scene that the pipeline draws
// additively after splitting room from outside, so the grade's window exposure never dims them.
import * as THREE from 'three';
import { GI } from '../../core/gi.js';
import { lathe } from '../../core/geo.js';

export const order = 98;
export const label = 'candle';

export const SILL_Y = 0.8623;
export const CANDLE = { x: 1.19, z: -0.048, waxTop: SILL_Y + 0.049, R: 0.036 };
export const FLAME = { x: CANDLE.x + 0.0004, y: SILL_Y + 0.049 + 0.0062, z: CANDLE.z, h: 0.026 };
export const MUG = { x: 0.95, z: -0.034, ry: -0.55, tea: 0.071 };   // tea level above the sill-top origin of the mug
const LIQ_Y = SILL_Y + MUG.tea, LIQ_R = 0.0367;

// the same flicker on the GPU (flame shape) and the CPU (light intensity)
export function flicker(t) {
  return 0.86 + 0.07 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1 + 1.7) + 0.04 * Math.sin(t * 23.9 + 0.4) + 0.03 * Math.sin(t * 2.1 + 3.0);
}

const COMMON = /* glsl */`
uniform sampler2D tSceneDepth; uniform vec2 uRes; uniform float uWeight, uNear, uFar, uTime, uSeed; uniform vec3 uCamFwd;
float sceneDist(vec3 rd){
  float d = texture2D(tSceneDepth, gl_FragCoord.xy / uRes).x;
  float z = d * 2.0 - 1.0, vz = 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
  return vz / max(dot(rd, uCamFwd), 1e-3);
}
float h1(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3(1,0,0)), f.x), mix(h1(i + vec3(0,1,0)), h1(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h1(i + vec3(0,0,1)), h1(i + vec3(1,0,1)), f.x), mix(h1(i + vec3(0,1,1)), h1(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s / 0.875; }
`;

export function build(ctx) {
  const U = {
    tSceneDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uWeight: { value: 1 }, uNear: { value: 0.05 }, uFar: { value: 400 },
    uCamFwd: { value: new THREE.Vector3(0, 0, -1) }, uTime: GI.uniforms.uTime, uSeed: { value: 0 },
    uFlame: { value: 1.0 }, uSteam: { value: 1.0 }, uSteamLight: { value: new THREE.Color(1, 1, 1) },
  };
  const overlay = new THREE.Scene();

  // ---- flame: a teardrop lathe, its brightness from a radial / vertical gradient (blue root, white core, orange skin)
  const prof = [];
  for (let i = 0; i <= 24; i++) { const v = i / 24; prof.push([0.0042 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.62)), 1.0) * (1.0 - 0.25 * v), v * FLAME.h]); }
  prof[0][0] = 0.0001; prof[24][0] = 0.0001;
  const flameGeo = lathe(prof.map(([r, y]) => [r, y]), 24);
  const flameMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime; varying vec3 vL; varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 p = position; float v = p.y / ${FLAME.h.toFixed(4)};
        float br = 0.86 + 0.07 * sin(uTime * 7.3) + 0.05 * sin(uTime * 13.1 + 1.7) + 0.04 * sin(uTime * 23.9 + 0.4);
        p.y *= br;                                                            // the flame breathes with its light
        float lean = v * v * (0.0016 * sin(uTime * 3.1) + 0.0010 * sin(uTime * 8.7 + 1.0));
        p.x += lean; p.z += lean * 0.6;
        vL = vec3(position.xz, v); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      precision highp float; ${COMMON}
      uniform float uFlame; varying vec3 vL; varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 rd = normalize(vW - cameraPosition);
        if (length(vW - cameraPosition) > sceneDist(rd) + 0.002) discard;
        float v = vL.z, edge = abs(dot(normalize(vN), -rd));               // 1 facing us (core), 0 at the silhouette
        float core = smoothstep(0.15, 0.9, edge) * smoothstep(0.0, 0.25, v) * smoothstep(1.0, 0.45, v);
        vec3 skin = vec3(1.0, 0.42, 0.08) * smoothstep(0.0, 0.5, edge);
        vec3 c = skin * 6.0 + vec3(1.0, 0.86, 0.6) * 26.0 * core;
        c = mix(vec3(0.15, 0.3, 1.0) * 3.0 * smoothstep(0.0, 0.6, edge), c, smoothstep(0.03, 0.22, v));   // the blue root
        c *= smoothstep(1.0, 0.7, v) * 0.5 + 0.5;
        gl_FragColor = vec4(c * uFlame * uWeight * 0.5, 0.0);              // two layers (front + back faces)
      }`,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(FLAME.x, FLAME.y, FLAME.z); flame.frustumCulled = false; flame.renderOrder = 2;
  overlay.add(flame);

  // ---- steam over the tea
  const box = { min: new THREE.Vector3(MUG.x - 0.08, LIQ_Y - 0.002, MUG.z - 0.08), max: new THREE.Vector3(MUG.x + 0.08, LIQ_Y + 0.26, MUG.z + 0.09) };
  const steamMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uBoxMin: { value: box.min }, uBoxMax: { value: box.max }, uCandle: GI.uniforms.giCandlePos, uCandleCol: GI.uniforms.giCandleCol },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      precision highp float; ${COMMON}
      uniform vec3 uBoxMin, uBoxMax, uCandle, uCandleCol, uSteamLight; uniform float uSteam; varying vec3 vW;
      const vec3 C0 = vec3(${MUG.x.toFixed(4)}, ${LIQ_Y.toFixed(4)}, ${MUG.z.toFixed(4)});
      float steam(vec3 p){
        vec3 q = p - C0; float y = q.y;
        if (y < 0.0) return 0.0;
        float t = uTime, sw = smoothstep(0.0, 0.08, y);
        vec2 c = vec2(sin(y * 21.0 - t * 0.9) * 0.6 + sin(y * 47.0 - t * 1.7 + 1.3) * 0.3 + vnoise(vec3(y * 8.0 - t * 0.3, t * 0.1, 1.0)) - 0.5,
                      cos(y * 17.0 - t * 0.7) * 0.6 + sin(y * 39.0 - t * 1.3) * 0.3 + vnoise(vec3(y * 8.0 - t * 0.3, 4.0, t * 0.1)) - 0.5) * 0.018 * sw;
        c += vec2(0.06, 0.10) * y * y * 2.5;                                // the cold glass pushes a draught into the room
        float r = length(q.xz - c), R = 0.013 + y * 0.16;
        float core = exp(-r * r / (R * R));
        float prof = max(core * smoothstep(${(LIQ_R + 0.002).toFixed(4)}, ${(LIQ_R - 0.006).toFixed(4)}, length(q.xz)), core * smoothstep(0.004, 0.03, y));
        float env = prof * smoothstep(0.0, 0.01, y) * exp(-y * 14.0);
        if (env < 0.004) return 0.0;
        vec3 w = vec3(q.x * 62.0, y * 36.0 - t * 1.3, q.z * 62.0);
        w += 1.4 * vec3(fbm3(w * 0.45 + vec3(0.0, t * 0.2, 3.0)), 0.0, fbm3(w * 0.45 + vec3(5.0, t * 0.2, 0.0)));
        float n = fbm3(w), ridge = 1.0 - abs(2.0 * n - 1.0);
        return env * pow(ridge, 6.0) * (0.35 + 0.65 * smoothstep(0.3, 0.7, fbm3(w * 0.5 + 9.0)));
      }
      void main(){
        vec3 ro = cameraPosition, rd = normalize(vW - ro);
        vec3 ta = (uBoxMin - ro) / rd, tb = (uBoxMax - ro) / rd, t0 = min(ta, tb), t1 = max(ta, tb);
        float tn = max(max(max(t0.x, t0.y), t0.z), 0.0), tf = min(min(min(t1.x, t1.y), t1.z), sceneDist(rd));
        if (tf <= tn) discard;
        const int STEPS = 40; float dt = (tf - tn) / float(STEPS), j = h1(vec3(gl_FragCoord.xy, uSeed));
        // window light from behind: Henyey-Greenstein towards the glass, plus a little isotropic fill
        vec3 toWin = normalize(vec3(0.05, 0.25, -1.0));
        float g = 0.65, ct = dot(toWin, rd), ph = 0.5 * (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * ct, 1.5)) + 0.6 / 12.566;
        float T = 1.0; vec3 C = vec3(0.0);
        for (int i = 0; i < STEPS; i++) {
          float t = tn + (float(i) + j) * dt; vec3 p = ro + rd * t;
          float d = steam(p); if (d < 0.002) continue;
          float sigma = d * 900.0;
          vec3 lc = uCandle - p;
          vec3 Ls = uSteamLight * ph + uCandleCol * (0.25 / max(dot(lc, lc), 0.0009)) / 12.566;
          C += T * sigma * dt * Ls; T *= exp(-sigma * dt);
        }
        gl_FragColor = vec4(C * uSteam * uWeight, 0.0);
      }`,
  });
  const steamBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steamMat);
  steamBox.scale.subVectors(box.max, box.min); steamBox.position.addVectors(box.max, box.min).multiplyScalar(0.5); steamBox.frustumCulled = false;
  overlay.add(steamBox);

  // ---- the candle's light, flickering with the flame
  const base = new THREE.Color(1.0, 0.56, 0.22);
  GI.uniforms.giCandlePos.value.set(FLAME.x, FLAME.y + FLAME.h * 0.4, FLAME.z);
  GI.uniforms.giCandleOcc.value.set(CANDLE.x, CANDLE.waxTop, CANDLE.z, CANDLE.R - 0.004);
  ctx.candle = { base, k: 0.0009 };
  let seed = 0;
  ctx.animated.push((t) => {
    GI.uniforms.giCandleCol.value.copy(base).multiplyScalar(ctx.candle.k * flicker(t));
    U.uSeed.value = (seed = (seed + 1) % 997) * 0.731;
  });
  GI.uniforms.giCandleCol.value.copy(base).multiplyScalar(ctx.candle.k);
  ctx.overlay = overlay; ctx.overlayU = U;
  return null;
}
