// "First Light": the renderer. Per frame it averages N jittered sub-frames (room-at-dawn's accumulation):
// each sub-frame moves the pixel grid (anti-aliasing), the lens point (depth of field), the clock across a
// 180-degree shutter (motion blur), the sun inside its disc (soft shadow edges) and the random numbers of the
// glossy reflections and the steam. The average converges to a clean photographic frame; nothing is filtered.
// Soft light comes from the vertex bake (tools/bake_void_cup.mjs); the grade is an Uchimura filmic curve
// with highlight roll-off, ported from room-at-dawn's pipeline.
import * as THREE from 'three';
import { buildSet, SUN, WINDOW, BLIND, SKY, CARD, LIQUID_Y, LIQUID_R, SAUCER_TOP } from './geo.js';

const Q = new URLSearchParams(location.search);
const RENDER = Q.get('render') === '1';
const SPP = +(Q.get('spp') || (RENDER ? 48 : 6));
const DURATION = 10;
const NOSTEAM = Q.get('nosteam') === '1';
const LOOK = { exposure: +(Q.get('exp') || 1.0), vignette: 0.32, grain: 0.012, bloom: 0.06, sat: 0.96, contrast: 1.04,
  shadowTint: [0.93, 0.98, 1.07], highTint: [1.03, 1.0, 0.95] };

// ---------------- camera: one slow push-in, keyed focus (data, like room-at-dawn's SHOTS) ----------------
const SHOT = {
  lens: 50, fstop: 2.2, sensorH: 0.02025,
  keys: [ // t, position, look-at, focus point
    [0, [0.215, 0.262, 0.505], [0.082, 0.046, -0.012], [0.0, 0.07, 0.036]],
    [10, [0.150, 0.228, 0.418], [0.070, 0.052, -0.010], [0.0, 0.075, 0.034]],
  ],
};
const ease = (x) => x * x * (3 - 2 * x);
function camAt(t) {
  const [a, b] = SHOT.keys, u = ease(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))));
  const L = (p, q) => p.map((v, i) => v + (q[i] - v) * u);
  return { pos: new THREE.Vector3(...L(a[1], b[1])), look: new THREE.Vector3(...L(a[2], b[2])), focus: new THREE.Vector3(...L(a[3], b[3])) };
}
const blindTilt = (t) => BLIND.tilt + 0.022 * Math.sin(t * 0.83 + 0.4) + 0.011 * Math.sin(t * 2.07 + 1.3) + 0.005 * Math.sin(t * 4.9);

// ---------------- renderer ----------------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.autoClear = false;
stage.appendChild(renderer.domElement);
renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
let W = 0, H = 0;
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 20);

// ---------------- shared shader code ----------------
const COMMON = /* glsl */`
uniform vec3 uCamPos, uSunDir, uSunCol, uWinC, uWinU, uWinV, uWinN, uSkyH, uSkyZ;
uniform vec3 uCardC, uCardU, uCardV, uCardN, uCardL; uniform vec2 uCardSize;
uniform vec2 uWinSize; uniform float uSkyK, uPitch, uSlatD, uSlatT, uTilt, uSeed, uTime;
uniform sampler2D uShadow; uniform mat4 uShadowMat; uniform vec2 uR2;
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
vec2 rnd2(){ return fract(vec2(h12(gl_FragCoord.xy + 0.37), h12(gl_FragCoord.xy * 1.31 + 7.7)) + uR2); }
vec3 skyRad(vec3 d){ float t = sqrt(clamp(d.y * 2.2 + 0.08, 0.0, 1.0)); return uSkyK * mix(uSkyH, uSkyZ, t); }
// What a ray leaving p along r sees of the window: dawn sky through the opening, cut by the real slat
// profile (thin boards of depth uSlatD tilted by uTilt, every uPitch), solved analytically.
vec3 windowEnv(vec3 p, vec3 r){
  float den = dot(r, uWinN); if (den > -1e-4) return vec3(0.0);
  float t = dot(uWinC - p, uWinN) / den; if (t < 0.0) return vec3(0.0);
  vec3 hp = p + r * t - uWinC; float a = dot(hp, uWinU), b = dot(hp, uWinV);
  if (abs(a) > uWinSize.x * 0.5 || abs(b) > uWinSize.y * 0.5) return vec3(0.0);
  float s = dot(r, uWinV) / -den, tl = tan(uTilt), dn = uSlatD * cos(uTilt);
  float v0 = b - s * 0.03 + uWinSize.y * 0.5 - uPitch * 0.5;            // relative to the slat grid, at the slats' plane
  float e0 = v0 - (s - tl) * dn * 0.5, e1 = v0 + (s - tl) * dn * 0.5;
  float lo = min(e0, e1) - uSlatT * 0.5, hi = max(e0, e1) + uSlatT * 0.5;
  if (floor(hi / uPitch) > floor(lo / uPitch)) return vec3(0.0);
  return skyRad(-r);
}
vec3 cardEnv(vec3 p, vec3 r){
  float den = dot(r, uCardN); if (den > -1e-4) return vec3(0.0);
  float t = dot(uCardC - p, uCardN) / den; if (t < 0.0) return vec3(0.0);
  vec3 hp = p + r * t - uCardC; float a = dot(hp, uCardU), b = dot(hp, uCardV);
  vec2 e = smoothstep(vec2(0.5), vec2(0.42), abs(vec2(a, b)) / uCardSize);   // soft-edged, like a lit wall patch
  return uCardL * e.x * e.y;
}
// Outside the shadow map nothing is lit: the wall around the window blocks the sun everywhere else.
// Bias grows with the slope (the sun grazes the table), in depth units of the 3.8 m ortho range.
float sunShadow(vec3 p, float nl){
  vec4 s = uShadowMat * vec4(p, 1.0); s.xyz = s.xyz * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return 0.0;
  float tn = sqrt(max(1.0 - nl * nl, 0.0)) / max(nl, 0.08);
  float bias = (0.6 + 1.1 * tn) * 0.00049 / 3.8;
  return step(s.z - bias, texture2D(uShadow, s.xy).r);
}
`;

const SURF_VS = /* glsl */`
attribute vec4 gi; attribute vec3 loc;
varying vec3 vP, vN, vLoc; varying vec4 vGi;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vGi = gi; vLoc = loc;
  gl_Position = projectionMatrix * viewMatrix * w; }`;

const SURF_FS = /* glsl */`
precision highp float;
${COMMON}
varying vec3 vP, vN, vLoc; varying vec4 vGi;
uniform float uPart;   // 0 table, 1 cup, 2 saucer, 3 handle, 4 liquid, 9 black
const float PI = 3.14159265;
float D_GGX(float nh, float a2){ float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float V_SmithGGX(float nl, float nv, float a2){ return 0.5 / max(1e-5, nl * sqrt(nv * nv * (1.0 - a2) + a2) + nv * sqrt(nl * nl * (1.0 - a2) + a2)); }
vec3 bump(vec3 n, float h){            // derivative bump from a height field (metres)
  vec3 dpx = dFdx(vP), dpy = dFdy(vP); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2); return normalize(abs(det) * n - g);
}
void main(){
  if (uPart > 8.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 N = normalize(vN), V = normalize(uCamPos - vP);
  if (dot(N, V) < 0.0 && uPart < 0.5) N = -N;
  vec3 alb; float rough; float f0 = 0.04; float h = 0.0;
  if (uPart < 0.5) {
    // walnut slab: growth rings warped along the board, open pores, waxed sheen with worn patches
    vec2 w = vP.zx * vec2(1.0, -1.0) + vec2(0.37, 0.11);   // boards run away from the camera, with the stripes
    float warp = fbm(vec3(w.x * 0.9, w.y * 4.0, 1.7)) * 2.0 - 1.0;
    float ring = w.y * 26.0 + warp * 3.2 + fbm(vec3(w.x * 0.35, w.y * 1.6, 4.0)) * 5.0;
    float band = smoothstep(0.25, 0.9, fract(ring)) * smoothstep(1.0, 0.92, fract(ring)) * (0.5 + 0.5 * fbm(vec3(w * 6.0, 2.0)));
    float pore = smoothstep(0.70, 0.90, vnoise(vec3(w.x * 30.0, w.y * 900.0, 3.0))) * 0.5;
    float tone = fbm(vec3(w * 3.0, 8.0));
    alb = mix(vec3(0.23, 0.148, 0.090), vec3(0.13, 0.078, 0.045), clamp(band * 0.75 + pore * 0.35, 0.0, 1.0));
    alb *= 0.88 + 0.24 * tone;
    float wear = fbm(vec3(w * 5.5, 13.0));
    rough = clamp(0.34 + 0.22 * smoothstep(0.35, 0.75, wear) + 0.18 * pore - 0.04 * band, 0.18, 0.8);
    h = -pore * 0.00012 - band * 0.00004 + vnoise(vec3(w * 260.0, 1.0)) * 0.000012;
  } else if (uPart < 3.5) {
    // speckled stoneware: cream glaze, iron speckles, glaze breaking brown on rims, bare clay foot
    vec3 p = vP * 1.0;
    float fine = vnoise(p * 950.0), sp = smoothstep(0.83, 0.93, fine) * smoothstep(0.4, 0.8, vnoise(p * 140.0 + 3.0));
    alb = vec3(0.73, 0.69, 0.61) * (0.95 + 0.08 * fbm(p * 55.0));
    alb = mix(alb, vec3(0.20, 0.13, 0.08), sp * 0.85);
    float yl = vLoc.y, r = vLoc.x, edge = 0.0, foot = 0.0;
    if (uPart < 1.5) { edge = smoothstep(0.0862, 0.0898, yl); foot = 1.0 - smoothstep(0.0026, 0.0048, yl); }
    else if (uPart < 2.5) { edge = smoothstep(0.0738, 0.0768, r) * smoothstep(0.0105, 0.0135, yl); foot = 1.0 - smoothstep(0.0012, 0.0034, yl); }
    alb = mix(alb, vec3(0.50, 0.36, 0.24), edge * 0.55);
    rough = 0.13 + 0.07 * fbm(p * 70.0) + 0.05 * edge;
    alb = mix(alb, vec3(0.46, 0.37, 0.28) * (0.9 + 0.2 * vnoise(p * 600.0)), foot);
    rough = mix(rough, 0.85, foot);
    h = fbm3(p * 400.0) * 0.000012 + sp * 0.00002;      // faint orange peel in the glaze
  } else {
    // black coffee: tiny tremor on the surface, a lighter ring where it meets the wall
    alb = vec3(0.06, 0.033, 0.016);
    float ring = smoothstep(LIQUID_R - 0.0028, LIQUID_R - 0.0004, vLoc.x);
    alb = mix(alb, vec3(0.16, 0.095, 0.05), ring * 0.7);
    rough = 0.03 + ring * 0.12; f0 = 0.02;
    h = (sin(length(vP.xz) * 900.0 - uTime * 9.0) * 0.5 + vnoise(vec3(vP.xz * 400.0, uTime * 0.8))) * 0.0000025;
  }
  #ifdef DBG
  alb = vec3(0.5); rough = 0.6;
  #endif
  N = bump(N, h);
  float a = rough * rough, a2 = a * a, nv = max(dot(N, V), 1e-4);
  // ---- diffuse: baked soft light + live sun through the blind
  vec3 L = uSunDir; float nl = dot(N, L);
  float sh = nl > 0.0 ? sunShadow(vP + normalize(vN) * 0.0005, dot(normalize(vN), L)) : 0.0;
  vec3 sunIrr = uSunCol * max(nl, 0.0) * sh;
  vec3 col = alb * (1.0 - f0) * (vGi.rgb + sunIrr / PI);
  // ---- sun specular (GGX), the disc is sampled by the sub-frame jitter
  if (nl > 0.0) {
    vec3 Hh = normalize(L + V); float nh = max(dot(N, Hh), 0.0), vh = max(dot(V, Hh), 0.0);
    float F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
    col += uSunCol * sh * nl * D_GGX(nh, max(a2, 2e-4)) * V_SmithGGX(nl, nv, a2) * F;
  }
  // ---- window reflection: one GGX importance sample per sub-frame, averaged by the accumulation
  {
    vec2 u = rnd2();
    float ct = sqrt((1.0 - u.x) / (1.0 + (a2 - 1.0) * u.x)), st = sqrt(1.0 - ct * ct), ph = 6.2831853 * u.y;
    vec3 T = normalize(abs(N.y) < 0.9 ? cross(N, vec3(0, 1, 0)) : cross(N, vec3(1, 0, 0))), B = cross(N, T);
    vec3 Hh = normalize(T * st * cos(ph) + B * st * sin(ph) + N * ct);
    vec3 R = reflect(-V, Hh); float rl = dot(N, R);
    if (rl > 0.0) {
      float vh = max(dot(V, Hh), 1e-4), nh = max(dot(N, Hh), 1e-4);
      float F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
      float wgt = F * V_SmithGGX(rl, nv, a2) * 4.0 * rl * vh / nh;
      col += (windowEnv(vP + N * 0.001, R) * vGi.a + cardEnv(vP, R)) * wgt;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const STEAM_VS = /* glsl */`varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const STEAM_FS = /* glsl */`
precision highp float;
${COMMON}
varying vec3 vP; uniform vec3 uBoxMin, uBoxMax; uniform float uDensity;
float steam(vec3 p){
  vec3 q = p - vec3(0.0, ${LIQUID_Y.toFixed(5)}, 0.0); float y = q.y;
  if (y < 0.0) return 0.0;
  float t = uTime;
  // plume axis sways with height and time (cheap: sines plus one octave of noise), drifts in a faint draught
  float sw = smoothstep(0.0, 0.08, y);
  vec2 c = vec2(sin(y * 21.0 - t * 0.9) * 0.6 + sin(y * 47.0 - t * 1.7 + 1.3) * 0.3 + vnoise(vec3(y * 8.0 - t * 0.3, t * 0.1, 1.0)) - 0.5,
                cos(y * 17.0 - t * 0.7) * 0.6 + sin(y * 39.0 - t * 1.3) * 0.3 + vnoise(vec3(y * 8.0 - t * 0.3, 4.0, t * 0.1)) - 0.5) * 0.018 * sw;
  c += vec2(0.10, -0.03) * y * y * 2.5;
  float r = length(q.xz - c), R = 0.013 + y * 0.16;
  float core = exp(-r * r / (R * R));
  float prof = max(core * smoothstep(${LIQUID_R.toFixed(4)} + 0.002, ${LIQUID_R.toFixed(4)} - 0.006, length(q.xz)), core * smoothstep(0.004, 0.03, y));
  float env = prof * smoothstep(0.0, 0.01, y) * exp(-y * 22.0);
  if (env < 0.004) return 0.0;
  vec3 w = vec3(q.x * 62.0, y * 36.0 - t * 1.3, q.z * 62.0);
  w += 1.4 * vec3(fbm3(w * 0.45 + vec3(0.0, t * 0.2, 3.0)), 0.0, fbm3(w * 0.45 + vec3(5.0, t * 0.2, 0.0)));
  // thin curling sheets: the iso-surface of warped noise, seen edge-on they read as filaments
  float n = fbm3(w), ridge = 1.0 - abs(2.0 * n - 1.0);
  float wisp = pow(ridge, 7.0) * (0.35 + 0.65 * smoothstep(0.3, 0.7, fbm3(w * 0.5 + 9.0)));
  return env * wisp;
}
void main(){
  vec3 ro = uCamPos, rd = normalize(vP - uCamPos);
  vec3 ta = (uBoxMin - ro) / rd, tb = (uBoxMax - ro) / rd, t0 = min(ta, tb), t1 = max(ta, tb);
  float tn = max(max(max(t0.x, t0.y), t0.z), 0.0), tf = min(min(t1.x, t1.y), t1.z);
  if (tf <= tn) discard;
  // where the ray enters the cup's cylinder: below the rim it came through the wall, so steam there is hidden
  float A = dot(rd.xz, rd.xz), Bq = dot(ro.xz, rd.xz), Cq = dot(ro.xz, ro.xz) - 0.0432 * 0.0432, disc = Bq * Bq - A * Cq;
  float tc = disc > 0.0 ? (-Bq - sqrt(disc)) / A : 1e9, rimY = ${(SAUCER_TOP + 0.0904).toFixed(4)};
  bool throughWall = disc > 0.0 && (ro.y + rd.y * tc) < rimY;
  const int STEPS = 30; float dt = (tf - tn) / float(STEPS), j = rnd2().x;
  float T = 1.0; vec3 C = vec3(0.0);
  float g = 0.6, ct = dot(uSunDir, rd), phase = 0.5 * (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * ct, 1.5)) + 0.5 / 12.566;
  for (int i = 0; i < STEPS; i++) {
    float t = tn + (float(i) + j) * dt; vec3 p = ro + rd * t;
    if (throughWall && t > tc && p.y < rimY && length(p.xz) < 0.0432) continue;
    float d = steam(p); if (d < 0.002) continue;
    float sigma = d * uDensity;
    vec3 Ls = uSunCol * sunShadow(p, 1.0) * phase + skyRad(-uWinN) * 0.06;
    #ifdef DBG_STEAM
    Ls = vec3(0.5);
    #endif
    C += T * sigma * dt * Ls; T *= exp(-sigma * dt);
  }
  gl_FragColor = vec4(C, T);
}`;

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const ADD_FS = 'precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uW, 1.0); }';
const BRIGHT_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
void main(){ vec3 a = vec3(0.0); for (int i = -1; i <= 2; i++) for (int j = -1; j <= 2; j++) a += texture2D(tSrc, vUv + uTexel * vec2(float(i) - 0.5, float(j) - 0.5)).rgb;
  a /= 16.0; float l = max(a.r, max(a.g, a.b)); gl_FragColor = vec4(a * smoothstep(0.6, 2.5, l), 1.0); }`;
const BLUR_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main(){ float w[5]; w[0] = 0.2270; w[1] = 0.1945; w[2] = 0.1216; w[3] = 0.0541; w[4] = 0.0162;
  vec3 a = texture2D(tSrc, vUv).rgb * w[0]; for (int i = 1; i < 5; i++) { a += (texture2D(tSrc, vUv + uDir * float(i)).rgb + texture2D(tSrc, vUv - uDir * float(i)).rgb) * w[i]; }
  gl_FragColor = vec4(a, 1.0); }`;
// Grade: Uchimura filmic curve, luminance/per-channel blend, saturated highlights rolled to white (room-at-dawn).
const FINAL_FS = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor, tBloom; uniform float uExposure, uBloom, uVignette, uGrain, uSeed, uSat, uContrast; uniform vec3 uShadowTint, uHighTint; uniform vec2 uRes;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float uchi(float x, float P){
  const float a = 1.0, m = 0.22, l = 0.4, c = 1.33, b = 0.0;
  float l0 = ((P - m) * l) / a, S0 = m + l0, S1 = m + a * l0, C2 = (a * P) / (P - S1), CP = -C2 / P;
  float w0 = 1.0 - smoothstep(0.0, m, x), w2 = step(m + l0, x), w1 = 1.0 - w0 - w2;
  float T = m * pow(x / m, c) + b, Lc = m + a * (x - m), Sc = P - (P - S1) * exp(CP * (x - S0));
  return T * w0 + Lc * w1 + Sc * w2;
}
vec3 tonemap(vec3 c){ float l = max(luma(c), 1e-5); vec3 o = mix(c * (uchi(l, 1.0) / l), vec3(uchi(c.r, 1.0), uchi(c.g, 1.0), uchi(c.b, 1.0)), 0.55);
  float over = smoothstep(0.75, 1.05, max(o.r, max(o.g, o.b))); return mix(o, vec3(min(luma(o), 1.0)), over * 0.6); }
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y * 0.82; c *= mix(1.0, smoothstep(1.05, 0.2, length(q)), uVignette);
  float l = luma(c), sh = 1.0 - smoothstep(0.0, 0.2, l), hi = smoothstep(0.3, 1.5, l);
  c *= mix(mix(vec3(1.0), uShadowTint, sh), uHighTint, hi);
  c = mix(vec3(luma(c)), c, uSat);
  c = pow(max(c, 0.0) / 0.18, vec3(uContrast)) * 0.18;
  c = srgb(clamp(tonemap(c), 0.0, 1.0));
  float g = hash(gl_FragCoord.xy + uSeed * 91.7) - 0.5; c += g * (uGrain * (1.0 - 0.6 * luma(c)) + 1.0 / 255.0);
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------------- the set ----------------
const scene = new THREE.Scene(), shadowScene = new THREE.Scene();
const U = {
  uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: SUN.dir.clone() }, uSunCol: { value: new THREE.Vector3(...SUN.color).multiplyScalar(SUN.E) },
  uWinC: { value: WINDOW.center }, uWinU: { value: WINDOW.u }, uWinV: { value: WINDOW.v }, uWinN: { value: WINDOW.n }, uWinSize: { value: new THREE.Vector2(WINDOW.w, WINDOW.h) },
  uSkyH: { value: new THREE.Vector3(...SKY.horizon) }, uSkyZ: { value: new THREE.Vector3(...SKY.zenith) }, uSkyK: { value: SKY.k },
  uPitch: { value: BLIND.pitch }, uSlatD: { value: BLIND.depth }, uSlatT: { value: BLIND.thick }, uTilt: { value: BLIND.tilt },
  uSeed: { value: 0 }, uTime: { value: 0 }, uR2: { value: new THREE.Vector2() },
  uShadow: { value: null }, uShadowMat: { value: new THREE.Matrix4() },
  uCardC: { value: CARD.center }, uCardU: { value: CARD.u }, uCardV: { value: CARD.v }, uCardN: { value: CARD.n },
  uCardL: { value: new THREE.Vector3(...CARD.L) }, uCardSize: { value: new THREE.Vector2(CARD.w, CARD.h) },
};
const PART = { table: 0, cup: 1, saucer: 2, handle: 3, liquid: 4 };
const DEFS = { LIQUID_R: LIQUID_R.toFixed(5) };
if (Q.get('dbg')) DEFS.DBG = '';
if (Q.get('dbgsteam')) DEFS.DBG_STEAM = '';

const res = await fetch('./assets/gi.bin');
const buf = await res.arrayBuffer();
const jl = new DataView(buf).getUint32(4, true);
const man = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl)));
const half = new Uint16Array(buf, 8 + jl + ((4 - ((8 + jl) % 4)) % 4));
let off = 0; const giByName = {};
for (const p of man.parts) {
  const a = new Float32Array(p.count * 4);
  for (let i = 0; i < a.length; i++) a[i] = THREE.DataUtils.fromHalfFloat(half[off + i]);
  giByName[p.name] = a; off += a.length;
}
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
for (const p of buildSet()) {
  if (p.name === 'slats') continue;              // built below as separate boards, so they can sway
  if (p.gi) {
    const a = giByName[p.name];
    if (a && a.length === p.g.attributes.position.count * 4) p.g.setAttribute('gi', new THREE.BufferAttribute(a, 4));
    else console.warn('[void-cup] bake missing or stale for', p.name);
  }
  const mat = new THREE.ShaderMaterial({ vertexShader: SURF_VS, fragmentShader: SURF_FS, defines: DEFS,
    uniforms: { ...U, uPart: { value: p.gi ? PART[p.name] : 9 } }, extensions: { derivatives: true } });
  scene.add(new THREE.Mesh(p.g, mat));
  shadowScene.add(new THREE.Mesh(p.g, depthOnly));
}
// venetian blind: one board per slat, re-angled every sub-frame
const slats = [];
{
  const blackMat = new THREE.ShaderMaterial({ vertexShader: SURF_VS, fragmentShader: SURF_FS, defines: DEFS, uniforms: { ...U, uPart: { value: 9 } } });
  const g = new THREE.BoxGeometry(WINDOW.w + 0.02, BLIND.thick, BLIND.depth);
  for (let k = 0; ; k++) {
    const cv = -WINDOW.h / 2 + BLIND.pitch * (k + 0.5); if (cv > WINDOW.h / 2) break;
    const c = WINDOW.center.clone().addScaledVector(WINDOW.v, cv).addScaledVector(WINDOW.n, 0.03);
    const m = new THREE.Mesh(g, depthOnly); m.matrixAutoUpdate = false; m.userData.c = c;
    shadowScene.add(m); slats.push(m);
  }
}
function setBlind(tl) {
  const { u, v, n } = WINDOW;
  const thick = v.clone().multiplyScalar(Math.cos(tl)).addScaledVector(n, Math.sin(tl));
  const deep = n.clone().multiplyScalar(Math.cos(tl)).addScaledVector(v, -Math.sin(tl));
  for (const m of slats) { m.matrix.makeBasis(u, thick, deep).setPosition(m.userData.c); m.matrixWorldNeedsUpdate = true; }
  U.uTilt.value = tl;
}
// steam volume
const BOXMIN = new THREE.Vector3(-0.06, LIQUID_Y - 0.002, -0.06), BOXMAX = new THREE.Vector3(0.075, LIQUID_Y + 0.22, 0.055);
const steamMat = new THREE.ShaderMaterial({ vertexShader: STEAM_VS, fragmentShader: STEAM_FS, defines: DEFS,
  uniforms: { ...U, uBoxMin: { value: BOXMIN }, uBoxMax: { value: BOXMAX }, uDensity: { value: +(Q.get('steam') || 260) } },
  transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor });
const steamBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steamMat);
steamBox.scale.subVectors(BOXMAX, BOXMIN); steamBox.position.addVectors(BOXMAX, BOXMIN).multiplyScalar(0.5);
const steamScene = new THREE.Scene(); steamScene.add(steamBox);
// (BackSide + depth test would hide the volume behind the cup; draw it with depthFunc ALWAYS and let the
// analytic wall test inside the shader decide what the cup hides)
steamMat.depthTest = false;

// ---------------- sun shadow map ----------------
const SHADOW_RES = 2048;
const rtShadow = new THREE.WebGLRenderTarget(SHADOW_RES, SHADOW_RES, { depthBuffer: true });
rtShadow.depthTexture = new THREE.DepthTexture(SHADOW_RES, SHADOW_RES, THREE.UnsignedIntType);
const sunCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.2, 4.0);
U.uShadow.value = rtShadow.depthTexture;
const SUN_TARGET = new THREE.Vector3(0, 0.04, 0);
function renderShadow(dir) {
  sunCam.position.copy(SUN_TARGET).addScaledVector(dir, 2.4); sunCam.up.set(0, 1, 0); sunCam.lookAt(SUN_TARGET);
  sunCam.updateMatrixWorld(); sunCam.updateProjectionMatrix();
  U.uShadowMat.value.multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse);
  renderer.setRenderTarget(rtShadow); renderer.clear(); renderer.render(shadowScene, sunCam);
}

// ---------------- passes ----------------
const quadGeo = new THREE.PlaneGeometry(2, 2);
function pass(fs, uniforms, extra = {}) { const m = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra }); const s = new THREE.Scene(); s.add(new THREE.Mesh(quadGeo, m)); return { m, s, u: uniforms }; }
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const addPass = pass(ADD_FS, { tSrc: { value: null }, uW: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
const brightPass = pass(BRIGHT_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
const blurPass = pass(BLUR_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
const finalPass = pass(FINAL_FS, { tColor: { value: null }, tBloom: { value: null }, uExposure: { value: LOOK.exposure }, uBloom: { value: LOOK.bloom }, uVignette: { value: LOOK.vignette },
  uGrain: { value: LOOK.grain }, uSeed: { value: 0 }, uSat: { value: LOOK.sat }, uContrast: { value: LOOK.contrast },
  uShadowTint: { value: new THREE.Vector3(...LOOK.shadowTint) }, uHighTint: { value: new THREE.Vector3(...LOOK.highTint) }, uRes: { value: new THREE.Vector2() } });
let rtSub, rtAcc, rtB1, rtB2;
function resize() {
  const w = Math.max(2, stage.clientWidth), h = Math.max(2, stage.clientHeight);
  if (w === W && h === H) return; W = w; H = h;
  renderer.setSize(W, H, false);
  [rtSub, rtAcc, rtB1, rtB2].forEach((r) => r && r.dispose());
  const o = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  rtSub = new THREE.WebGLRenderTarget(W, H, { ...o, depthBuffer: true });
  rtAcc = new THREE.WebGLRenderTarget(W, H, { ...o, depthBuffer: false });
  rtB1 = new THREE.WebGLRenderTarget(Math.ceil(W / 4), Math.ceil(H / 4), { ...o, depthBuffer: false });
  rtB2 = new THREE.WebGLRenderTarget(Math.ceil(W / 4), Math.ceil(H / 4), { ...o, depthBuffer: false });
  camera.aspect = W / H;
}

// low-discrepancy sequences (R2 / R1) so N sub-frames cover lens, pixel, shutter and sun evenly
const G2 = 1.32471795724, A1 = 1 / G2, A2 = 1 / (G2 * G2), fr = (x) => x - Math.floor(x);
const r2 = (k, o) => [fr(o + A1 * k), fr(o * 1.7 + A2 * k)];
function setCamera(t, k) {
  const c = camAt(t);
  const vfov = 2 * Math.atan(SHOT.sensorH / 2 / (SHOT.lens / 1000)) * 180 / Math.PI;
  camera.fov = vfov; camera.position.copy(c.pos); camera.up.set(0, 1, 0); camera.lookAt(c.look);
  camera.updateMatrixWorld();
  // thin lens: move the eye across the aperture, shear the projection so the focus plane stays put
  const fd = c.focus.clone().sub(c.pos).dot(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate());
  const ap = (SHOT.lens / 1000) / SHOT.fstop / 2;
  const [l1, l2] = r2(k, 0.11), rr = ap * Math.sqrt(l1), th = 2 * Math.PI * l2, ax = rr * Math.cos(th), ay = rr * Math.sin(th);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position.addScaledVector(right, ax).addScaledVector(up, ay); camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const P = camera.projectionMatrix.elements, [j1, j2] = r2(k, 0.53);
  P[8] += -P[0] * ax / fd + (j1 - 0.5) * 2 / W;
  P[9] += -P[5] * ay / fd + (j2 - 0.5) * 2 / H;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  U.uCamPos.value.copy(camera.position);
}
const sunJ = new THREE.Vector3();
async function renderFrame(t, spp, yieldEach = false) {
  resize();
  renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let k = 0; k < spp; k++) {
    const [s1] = r2(k, 0.29), tk = t + (s1 - 0.5) / 48;              // 180-degree shutter at 24 fps
    U.uTime.value = tk; U.uSeed.value = k; U.uR2.value.set(...r2(k, 0.71));
    setBlind(blindTilt(tk));
    const [q1, q2] = r2(k, 0.87), rr = SUN.radius * Math.sqrt(q1), ph = 2 * Math.PI * q2;
    sunJ.copy(SUN.dir).addScaledVector(WINDOW.u, rr * Math.cos(ph)).addScaledVector(WINDOW.v, rr * Math.sin(ph)).normalize();
    U.uSunDir.value.copy(sunJ);
    renderShadow(sunJ);
    setCamera(tk, k);
    renderer.setRenderTarget(rtSub); renderer.clear(); renderer.render(scene, camera); if (!NOSTEAM) renderer.render(steamScene, camera);
    addPass.u.tSrc.value = rtSub.texture; addPass.u.uW.value = 1 / spp;
    renderer.setRenderTarget(rtAcc); renderer.render(addPass.s, ortho);
    if (yieldEach) { renderer.getContext().finish(); await new Promise((r) => setTimeout(r, 0)); }
  }
  // bloom (quarter res), then grade to the canvas
  brightPass.u.tSrc.value = rtAcc.texture; brightPass.u.uTexel.value.set(1 / W, 1 / H);
  renderer.setRenderTarget(rtB1); renderer.render(brightPass.s, ortho);
  for (let i = 0; i < 2; i++) {
    blurPass.u.tSrc.value = rtB1.texture; blurPass.u.uDir.value.set((1 + i) / rtB1.width, 0); renderer.setRenderTarget(rtB2); renderer.render(blurPass.s, ortho);
    blurPass.u.tSrc.value = rtB2.texture; blurPass.u.uDir.value.set(0, (1 + i) / rtB1.height); renderer.setRenderTarget(rtB1); renderer.render(blurPass.s, ortho);
  }
  const f = finalPass.u; f.tColor.value = rtAcc.texture; f.tBloom.value = rtB1.texture; f.uSeed.value = Math.round(t * 24) % 97; f.uRes.value.set(W, H);
  renderer.setRenderTarget(null); renderer.render(finalPass.s, ortho);
}

window.__duration = DURATION;
window.renderAt = async (t) => { await renderFrame(t, SPP, true); renderer.getContext().finish(); };
if (RENDER) { window.__ready = true; }
else {
  const t0 = performance.now();
  const loop = () => { renderFrame(((performance.now() - t0) / 1000) % DURATION, SPP); requestAnimationFrame(loop); };
  loop(); window.__ready = true;
}
