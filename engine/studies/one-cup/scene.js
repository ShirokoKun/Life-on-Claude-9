// One Cup: the match-cut film. One cup, one day: the same frame cuts through five worlds (dawn, rain, the room,
// golden hour, night); the cuts come faster and faster, then night holds and fades out.
// The method is room-at-dawn's (vertex-baked light + accumulated sub-frames + Uchimura grade), extended with:
// a live sun and lamp, analytic window reflections (blind, rain), CoC-sized bokeh sprites, sunlit dust, steam,
// and film halation (red-orange bleed hugging bright edges) in the grade.
import * as THREE from 'three';
import { buildWorld, WORLD_BUILDERS } from './worlds.js';
import { SAUCER_TOP } from './cupgeo.js';

const Q = new URLSearchParams(location.search);
const RENDER = Q.get('render') === '1';
const SPP = +(Q.get('spp') || (RENDER ? 24 : 4));
const ONLY = Q.get('world');           // pin one world (keyframe boards)

// ---------------- the cut: worlds on the clock (seconds) ----------------
export const SHOTS = [
  { world: 'dawn', t0: 0.0, t1: 3.0 },
  { world: 'rain', t0: 3.0, t1: 5.0 },
  { world: 'room', t0: 5.0, t1: 6.4 },
  { world: 'golden', t0: 6.4, t1: 7.5 },
  { world: 'night', t0: 7.5, t1: 10.0 },
];
const DURATION = 10.0;
const shotAt = (t) => (ONLY ? { world: ONLY, t0: 0, t1: DURATION } : SHOTS.find((s) => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1]);
// one camera move across every cut (a match cut keeps the frame; the push keeps it alive)
const CAM = { lens: 50, fstop: 2.0, sensorH: 0.02025,
  from: { pos: [0.245, 0.205, 0.470], look: [0.050, 0.070, -0.060] }, to: { pos: [0.205, 0.190, 0.400], look: [0.045, 0.074, -0.050] },
  focus: [0.0, 0.06, 0.036] };
const ease = (x) => x * x * (3 - 2 * x), clamp01 = (x) => Math.min(1, Math.max(0, x));
// the float: the empty cup lifts off, turns a little and hangs
const floatLift = (t) => 0.045 * ease(clamp01((t - 9.0) / 2.4)) + 0.0015 * Math.sin(t * 2.1) * clamp01((t - 9.6) / 1.0);
const floatTurn = (t) => 0.35 * ease(clamp01((t - 9.0) / 3.0));
// light level per moment: fade up at the start, the void's light goes out at the end
const fade = (t) => (ONLY ? 1 : ease(clamp01(t / 0.8)) * (1 - ease(clamp01((t - 9.0) / 1.0))));
const blindTilt = (base, t) => base + 0.022 * Math.sin(t * 0.83 + 0.4) + 0.011 * Math.sin(t * 2.07 + 1.3) + 0.005 * Math.sin(t * 4.9);

// ---------------- renderer ----------------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.autoClear = false;
stage.appendChild(renderer.domElement);
renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
let W = 0, H = 0;
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 30);

const COMMON = /* glsl */`
uniform vec3 uCamPos, uSunDir, uSunCol, uWinC, uWinU, uWinV, uWinN, uSkyH, uSkyZ;
uniform vec2 uWinSize; uniform float uSkyK, uPitch, uSlatD, uSlatT, uTilt, uSeed, uTime, uHasWin, uMask, uHasSun;
uniform vec3 uR0C, uR0U, uR0V, uR0N, uR0L, uR1C, uR1U, uR1V, uR1N, uR1L; uniform vec2 uR0S, uR1S;
uniform vec3 uLampP, uLampL; uniform float uLampR;
uniform vec3 uFillDir, uFillL;
uniform sampler2D uShadow; uniform mat4 uShadowMat; uniform vec2 uR2; uniform float uLiqY, uFullY;
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
vec2 rnd2(){ return fract(vec2(h12(gl_FragCoord.xy + 0.37), h12(gl_FragCoord.xy * 1.31 + 7.7)) + uR2); }
vec3 skyRad(vec3 d){ float t = sqrt(clamp(d.y * 2.2 + 0.08, 0.0, 1.0)); return uSkyK * mix(uSkyH, uSkyZ, t); }
// rain on the glass, in the glass plane (metres): beaded drops and a few running down
float rainMask(vec2 q){
  vec2 g = q * vec2(70.0, 55.0); vec2 id = floor(g), f = fract(g) - 0.5;
  float r = 0.18 + 0.22 * h12(id); vec2 o = vec2(h12(id + 3.1), h12(id + 7.7)) - 0.5;
  float drop = smoothstep(r, r * 0.6, length(f - o * 0.5));
  float col = floor(q.x * 22.0), sp = 0.05 + 0.08 * h12(vec2(col, 2.0)), y = fract(q.y * 1.3 + uTime * sp + h12(vec2(col, 5.0)));
  float run = smoothstep(0.05, 0.0, abs(fract(q.x * 22.0) - 0.5 - 0.15 * sin(q.y * 9.0 + col)) - 0.02) * smoothstep(0.0, 0.03, y) * smoothstep(0.25, 0.03, y);
  return clamp(drop * step(0.45, h12(id + 9.0)) + run, 0.0, 1.0);
}
// what a ray leaving p along r sees of the window (sky, cut by the blind's real slat profile)
vec3 windowEnv(vec3 p, vec3 r){
  if (uHasWin < 0.5) return vec3(0.0);
  float den = dot(r, uWinN); if (den > -1e-4) return vec3(0.0);
  float t = dot(uWinC - p, uWinN) / den; if (t < 0.0) return vec3(0.0);
  vec3 hp = p + r * t - uWinC; float a = dot(hp, uWinU), b = dot(hp, uWinV);
  if (abs(a) > uWinSize.x * 0.5 || abs(b) > uWinSize.y * 0.5) return vec3(0.0);
  if (uMask > 0.5 && uMask < 1.5) {
    float s = dot(r, uWinV) / -den, tl = tan(uTilt), dn = uSlatD * cos(uTilt);
    float v0 = b - s * 0.03 + uWinSize.y * 0.5 - uPitch * 0.5;
    float e0 = v0 - (s - tl) * dn * 0.5, e1 = v0 + (s - tl) * dn * 0.5;
    float lo = min(e0, e1) - uSlatT * 0.5, hi = max(e0, e1) + uSlatT * 0.5;
    if (floor(hi / uPitch) > floor(lo / uPitch)) return vec3(0.0);
  }
  return skyRad(-r);
}
vec3 rectEnv(vec3 p, vec3 r, vec3 C, vec3 U, vec3 V, vec3 Nn, vec2 S, vec3 L){
  float den = dot(r, Nn); if (den > -1e-4 || dot(L, L) == 0.0) return vec3(0.0);
  float t = dot(C - p, Nn) / den; if (t < 0.0) return vec3(0.0);
  vec3 hp = p + r * t - C; vec2 e = smoothstep(vec2(0.5), vec2(0.42), abs(vec2(dot(hp, U), dot(hp, V))) / S);
  return L * e.x * e.y;
}
float sunShadow(vec3 p, float nl){
  vec4 s = uShadowMat * vec4(p, 1.0); s.xyz = s.xyz * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return uHasWin > 0.5 ? 0.0 : 1.0;
  float tn = sqrt(max(1.0 - nl * nl, 0.0)) / max(nl, 0.08);
  float bias = (0.6 + 1.1 * tn) * 0.00078 / 3.8;
  return step(s.z - bias, texture2D(uShadow, s.xy).r);
}
`;
const SURF_VS = /* glsl */`
attribute vec4 gi; attribute vec3 loc;
varying vec3 vP, vN, vLoc, vO; varying vec4 vGi;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vO = position; vN = normalize(mat3(modelMatrix) * normal); vGi = gi; vLoc = loc;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const SURF_FS = /* glsl */`
precision highp float;
${COMMON}
varying vec3 vP, vN, vLoc, vO; varying vec4 vGi;
uniform float uPart, uRough; uniform vec3 uAlb, uWoodA, uWoodB;
const float PI = 3.14159265;
float D_GGX(float nh, float a2){ float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float V_SmithGGX(float nl, float nv, float a2){ return 0.5 / max(1e-5, nl * sqrt(nv * nv * (1.0 - a2) + a2) + nv * sqrt(nl * nl * (1.0 - a2) + a2)); }
vec3 bump(vec3 n, float h){
  vec3 dpx = dFdx(vP), dpy = dFdy(vP); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2); return normalize(abs(det) * n - g);
}
void main(){
  vec3 V = normalize(uCamPos - vP);
  if (uPart > 8.5 && uPart < 9.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if (uPart > 9.5 && uPart < 10.5) {          // window glass: the sky, the sun's disc, rain
    vec3 d = -V, c = skyRad(d);
    if (uHasSun > 0.5) { float cs = dot(d, uSunDir); c += uSunCol * 900.0 * smoothstep(0.99996, 0.99999, cs) + uSunCol * 0.35 * pow(max(cs, 0.0), 300.0); }
    if (uMask > 1.5) { float m = rainMask(vec2(dot(vP, uWinU), dot(vP, uWinV))); c *= 1.0 - 0.45 * m; c += m * 0.25 * skyRad(vec3(0.0, 1.0, 0.0)) * h12(floor(vP.xy * 300.0)); }
    gl_FragColor = vec4(c, 1.0); return;
  }
  if (uPart > 10.5) {                          // monitor screen: a dim interface, out of focus anyway
    vec2 q = vec2(dot(vP, uR0U), dot(vP, uR0V)) - vec2(dot(uR0C, uR0U), dot(uR0C, uR0V));
    float ui = 0.35 + 0.65 * step(0.0, q.y - 0.06) * 0.4 + 0.5 * step(abs(q.x + 0.12), 0.06) * step(abs(q.y + 0.02), 0.07);
    ui += 0.25 * step(0.5, fract(q.y * 60.0)) * step(abs(q.x - 0.05), 0.14) * step(abs(q.y + 0.03), 0.08);
    gl_FragColor = vec4(uR0L * ui, 1.0); return;
  }
  vec3 N = normalize(vN);
  vec3 alb; float rough; float f0 = 0.04; float h = 0.0;
  if (uPart < 0.5) {
    vec2 w = vP.zx * vec2(1.0, -1.0) + vec2(0.37, 0.11);
    float warp = fbm(vec3(w.x * 0.9, w.y * 4.0, 1.7)) * 2.0 - 1.0;
    float ring = w.y * 26.0 + warp * 3.2 + fbm(vec3(w.x * 0.35, w.y * 1.6, 4.0)) * 5.0;
    float band = smoothstep(0.25, 0.9, fract(ring)) * smoothstep(1.0, 0.92, fract(ring)) * (0.5 + 0.5 * fbm(vec3(w * 6.0, 2.0)));
    float pore = smoothstep(0.70, 0.90, vnoise(vec3(w.x * 30.0, w.y * 900.0, 3.0))) * 0.5;
    float tone = fbm(vec3(w * 3.0, 8.0));
    alb = mix(uWoodA, uWoodB, clamp(band * 0.75 + pore * 0.35, 0.0, 1.0)) * (0.88 + 0.24 * tone);
    float wear = fbm(vec3(w * 5.5, 13.0));
    rough = clamp(0.34 + 0.22 * smoothstep(0.35, 0.75, wear) + 0.18 * pore - 0.04 * band, 0.18, 0.8);
    h = -pore * 0.00012 - band * 0.00004 + vnoise(vec3(w * 260.0, 1.0)) * 0.000012;
  } else if (uPart < 3.5) {
    vec3 p = vO;
    float fine = vnoise(p * 950.0), sp = smoothstep(0.83, 0.93, fine) * smoothstep(0.4, 0.8, vnoise(p * 140.0 + 3.0));
    alb = vec3(0.73, 0.69, 0.61) * (0.95 + 0.08 * fbm(p * 55.0));
    alb = mix(alb, vec3(0.20, 0.13, 0.08), sp * 0.85);
    float yl = vLoc.y, r = vLoc.x, edge = 0.0, foot = 0.0;
    if (uPart < 1.5) {
      edge = smoothstep(0.0862, 0.0898, yl); foot = 1.0 - smoothstep(0.0026, 0.0048, yl);
      // the day's coffee: a faint film and tide lines on the inner wall above today's level
      bool inner = dot(N, normalize(vec3(vP.x, 0.0, vP.z) + 1e-6)) < -0.2;
      float y = vO.y;
      if (inner && y > uLiqY && y < uFullY + 0.002) {
        float film = 0.18 + 0.5 * smoothstep(0.003, 0.0, abs(y - uFullY)) + 0.25 * smoothstep(0.0015, 0.0, abs(fract((y - uLiqY) * 160.0) - 0.5) - 0.42);
        alb = mix(alb, vec3(0.30, 0.17, 0.08), clamp(film, 0.0, 0.8) * 0.6);
      }
    }
    else if (uPart < 2.5) { edge = smoothstep(0.0738, 0.0768, r) * smoothstep(0.0105, 0.0135, yl); foot = 1.0 - smoothstep(0.0012, 0.0034, yl); }
    alb = mix(alb, vec3(0.50, 0.36, 0.24), edge * 0.55);
    rough = 0.13 + 0.07 * fbm(p * 70.0) + 0.05 * edge;
    alb = mix(alb, vec3(0.46, 0.37, 0.28) * (0.9 + 0.2 * vnoise(p * 600.0)), foot);
    rough = mix(rough, 0.85, foot);
    h = fbm3(p * 400.0) * 0.000012 + sp * 0.00002;
  } else if (uPart < 4.5) {
    alb = vec3(0.06, 0.033, 0.016);
    float ring = smoothstep(0.0028, 0.0004, vLoc.y - vLoc.x);
    alb = mix(alb, vec3(0.16, 0.095, 0.05), ring * 0.7);
    rough = 0.03 + ring * 0.12; f0 = 0.02;
    h = (sin(length(vP.xz) * 900.0 - uTime * 9.0) * 0.5 + vnoise(vec3(vP.xz * 400.0, uTime * 0.8))) * 0.0000025;
  } else if (uPart < 5.5) {
    alb = uAlb * (0.94 + 0.12 * fbm3(vP * 40.0)); rough = uRough;
  } else {
    alb = uAlb * (0.92 + 0.1 * fbm(vP * 9.0) + 0.04 * vnoise(vP * 300.0)); rough = uRough;
    h = vnoise(vP * 900.0) * 0.00002;
  }
  #ifdef DBG
  alb = vec3(0.5); rough = 0.6;
  #endif
  N = bump(N, h);
  float a = rough * rough, a2 = a * a, nv = max(dot(N, V), 1e-4);
  vec3 col = alb * (1.0 - f0) * vGi.rgb;
  // live sun
  if (uHasSun > 0.5) {
    vec3 L = uSunDir; float nl = dot(N, L);
    if (nl > 0.0) {
      float sh = sunShadow(vP + normalize(vN) * 0.0005, dot(normalize(vN), L));
      vec3 Hh = normalize(L + V); float nh = max(dot(N, Hh), 0.0), vh = max(dot(V, Hh), 0.0);
      float F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
      col += uSunCol * sh * nl * (alb * (1.0 - f0) / PI + D_GGX(nh, max(a2, 2e-4)) * V_SmithGGX(nl, nv, a2) * F);
    }
  }
  // live fill (the void: no bake)
  col += alb * uFillL * max(dot(N, uFillDir), 0.0);
  // the lamp's highlight: a sphere light, roughness widened by its size (its diffuse light is baked)
  if (uLampR > 0.0) {
    vec3 lv = uLampP - vP; float d = length(lv); vec3 L = lv / d; float nl = dot(N, L);
    if (nl > 0.0) {
      float aw = min(1.0, a + uLampR / (2.0 * d)), a2w = aw * aw;
      vec3 Hh = normalize(L + V); float nh = max(dot(N, Hh), 0.0), vh = max(dot(V, Hh), 0.0);
      float F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0), E = PI * uLampR * uLampR / (d * d);
      col += uLampL * E * nl * D_GGX(nh, a2w) * V_SmithGGX(nl, nv, a2w) * F * (a2 / a2w);
    }
  }
  // reflections of the window and the light rectangles: one GGX sample per sub-frame
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
      col += (windowEnv(vP + N * 0.001, R) * vGi.a + rectEnv(vP, R, uR0C, uR0U, uR0V, uR0N, uR0S, uR0L) + rectEnv(vP, R, uR1C, uR1U, uR1V, uR1N, uR1S, uR1L)) * wgt;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
const STEAM_VS = /* glsl */`varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const STEAM_FS = /* glsl */`
precision highp float;
${COMMON}
varying vec3 vP; uniform vec3 uBoxMin, uBoxMax; uniform float uDensity, uLiqR;
float steam(vec3 p){
  vec3 q = p - vec3(0.0, uLiqY, 0.0); float y = q.y;
  if (y < 0.0) return 0.0;
  float t = uTime, sw = smoothstep(0.0, 0.08, y);
  vec2 c = vec2(sin(y * 21.0 - t * 0.9) * 0.6 + sin(y * 47.0 - t * 1.7 + 1.3) * 0.3 + vnoise(vec3(y * 8.0 - t * 0.3, t * 0.1, 1.0)) - 0.5,
                cos(y * 17.0 - t * 0.7) * 0.6 + sin(y * 39.0 - t * 1.3) * 0.3 + vnoise(vec3(y * 8.0 - t * 0.3, 4.0, t * 0.1)) - 0.5) * 0.018 * sw;
  c += vec2(0.10, -0.03) * y * y * 2.5;
  float r = length(q.xz - c), R = 0.013 + y * 0.16;
  float core = exp(-r * r / (R * R));
  float prof = max(core * smoothstep(uLiqR + 0.002, uLiqR - 0.006, length(q.xz)), core * smoothstep(0.004, 0.03, y));
  float env = prof * smoothstep(0.0, 0.01, y) * exp(-y * 22.0);
  if (env < 0.004) return 0.0;
  vec3 w = vec3(q.x * 62.0, y * 36.0 - t * 1.3, q.z * 62.0);
  w += 1.4 * vec3(fbm3(w * 0.45 + vec3(0.0, t * 0.2, 3.0)), 0.0, fbm3(w * 0.45 + vec3(5.0, t * 0.2, 0.0)));
  float n = fbm3(w), ridge = 1.0 - abs(2.0 * n - 1.0);
  return env * pow(ridge, 7.0) * (0.35 + 0.65 * smoothstep(0.3, 0.7, fbm3(w * 0.5 + 9.0)));
}
void main(){
  vec3 ro = uCamPos, rd = normalize(vP - uCamPos);
  vec3 ta = (uBoxMin - ro) / rd, tb = (uBoxMax - ro) / rd, t0 = min(ta, tb), t1 = max(ta, tb);
  float tn = max(max(max(t0.x, t0.y), t0.z), 0.0), tf = min(min(t1.x, t1.y), t1.z);
  if (tf <= tn) discard;
  float A = dot(rd.xz, rd.xz), Bq = dot(ro.xz, rd.xz), Cq = dot(ro.xz, ro.xz) - 0.0432 * 0.0432, disc = Bq * Bq - A * Cq;
  float tc = disc > 0.0 ? (-Bq - sqrt(disc)) / A : 1e9, rimY = ${(SAUCER_TOP + 0.0904).toFixed(4)};
  bool throughWall = disc > 0.0 && (ro.y + rd.y * tc) < rimY;
  const int STEPS = 30; float dt = (tf - tn) / float(STEPS), j = rnd2().x;
  float T = 1.0; vec3 C = vec3(0.0);
  float g = 0.6, ct = dot(uSunDir, rd), phase = 0.5 * (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * ct, 1.5)) + 0.5 / 12.566;
  vec3 amb = (skyRad(vec3(0.0, 0.3, 1.0)) * 0.03 * uHasWin + uR0L * 0.02 + uLampL * 0.00004);
  for (int i = 0; i < STEPS; i++) {
    float t = tn + (float(i) + j) * dt; vec3 p = ro + rd * t;
    if (throughWall && t > tc && p.y < rimY && length(p.xz) < 0.0432) continue;
    float d = steam(p); if (d < 0.002) continue;
    float sigma = d * uDensity;
    vec3 Ls = uSunCol * uHasSun * sunShadow(p, 1.0) * phase + amb;
    if (uLampR > 0.0) { vec3 lv = uLampP - p; Ls += uLampL * (uLampR * uLampR / dot(lv, lv)) * 0.25; }
    C += T * sigma * dt * Ls; T *= exp(-sigma * dt);
  }
  gl_FragColor = vec4(C, T);
}`;
// bokeh (city lights) and dust: points sized by their circle of confusion, drawn after the opaque pass
const PTS_VS = /* glsl */`
attribute vec3 color; attribute float seed; uniform float uCoC, uFocus, uPx, uTime, uDust; varying vec3 vC; varying float vSize; varying vec3 vW;
void main(){
  vec3 p = position;
  if (uDust > 0.5) { p += vec3(sin(uTime * 0.21 + seed * 7.0), sin(uTime * 0.13 + seed * 3.0) * 0.6 + uTime * 0.0025, cos(uTime * 0.17 + seed * 5.0)) * 0.012; }
  vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
  float coc = uCoC * abs(d - uFocus) / d;                          // metres on the sensor -> pixels
  vSize = max(2.0, coc * uPx + (uDust > 0.5 ? 1.5 : 3.0)); gl_PointSize = vSize; vC = color; vW = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * mv; }`;
const PTS_FS = /* glsl */`
precision highp float;
${COMMON}
varying vec3 vC; varying float vSize; varying vec3 vW; uniform float uDust;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard;
  float edge = 1.5 / vSize;
  float disc = smoothstep(1.0, 1.0 - edge * 2.0, r) * (0.82 + 0.18 * smoothstep(0.55, 0.95, r));   // a slightly brighter rim, like a real lens
  float area = max(1.0, vSize * vSize * 0.785);
  vec3 c = vC * disc / area * 60.0;
  if (uDust > 0.5) c *= uSunCol * sunShadow(vW, 1.0) * 0.6;
  gl_FragColor = vec4(c, 1.0);
}`;
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const ADD_FS = 'precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uW, 1.0); }';
const BRIGHT_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uLo, uHi, uK;
void main(){ vec3 a = vec3(0.0); for (int i = -1; i <= 2; i++) for (int j = -1; j <= 2; j++) a += texture2D(tSrc, vUv + uTexel * vec2(float(i) - 0.5, float(j) - 0.5)).rgb;
  a = a / 16.0 * uK; float l = max(a.r, max(a.g, a.b)); gl_FragColor = vec4(a * smoothstep(uLo, uHi, l), 1.0); }`;
const BLUR_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main(){ float w[5]; w[0] = 0.2270; w[1] = 0.1945; w[2] = 0.1216; w[3] = 0.0541; w[4] = 0.0162;
  vec3 a = texture2D(tSrc, vUv).rgb * w[0]; for (int i = 1; i < 5; i++) { a += (texture2D(tSrc, vUv + uDir * float(i)).rgb + texture2D(tSrc, vUv - uDir * float(i)).rgb) * w[i]; }
  gl_FragColor = vec4(a, 1.0); }`;
// Grade: halation (a thin red-orange bleed hugging bright edges, as in film where light scatters back from the
// base into the red layer), a soft glow, then room-at-dawn's Uchimura curve with highlight roll-off.
const FINAL_FS = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor, tBloom, tHal; uniform float uExposure, uBloom, uHal, uVignette, uGrain, uSeed, uSat, uContrast; uniform vec3 uShadowTint, uHighTint, uHalTint; uniform vec2 uRes;
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
  vec3 src = texture2D(tColor, vUv).rgb;
  vec3 hal = texture2D(tHal, vUv).rgb;
  // halation sits around the highlight, not on it: subtract where the source itself is already bright
  float self = smoothstep(0.6, 2.0, max(src.r, max(src.g, src.b)) * uExposure);
  vec3 c = src + texture2D(tBloom, vUv).rgb * uBloom + hal * uHalTint * uHal * (1.0 - 0.7 * self);
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

// ---------------- uniforms shared by every material ----------------
const V3 = () => new THREE.Vector3(), Vz = new THREE.Vector3();
const U = {
  uCamPos: { value: V3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: V3() }, uHasSun: { value: 0 },
  uWinC: { value: V3() }, uWinU: { value: V3() }, uWinV: { value: V3() }, uWinN: { value: V3() }, uWinSize: { value: new THREE.Vector2() }, uHasWin: { value: 0 }, uMask: { value: 0 },
  uSkyH: { value: V3() }, uSkyZ: { value: V3() }, uSkyK: { value: 0 },
  uPitch: { value: 0.024 }, uSlatD: { value: 0.025 }, uSlatT: { value: 0.002 }, uTilt: { value: 0 },
  uSeed: { value: 0 }, uTime: { value: 0 }, uR2: { value: new THREE.Vector2() },
  uShadow: { value: null }, uShadowMat: { value: new THREE.Matrix4() },
  uR0C: { value: V3() }, uR0U: { value: V3() }, uR0V: { value: V3() }, uR0N: { value: V3() }, uR0L: { value: V3() }, uR0S: { value: new THREE.Vector2(1, 1) },
  uR1C: { value: V3() }, uR1U: { value: V3() }, uR1V: { value: V3() }, uR1N: { value: V3() }, uR1L: { value: V3() }, uR1S: { value: new THREE.Vector2(1, 1) },
  uLampP: { value: V3() }, uLampL: { value: V3() }, uLampR: { value: 0 },
  uFillDir: { value: new THREE.Vector3(0, 1, 0) }, uFillL: { value: V3() },
  uLiqY: { value: 0 }, uFullY: { value: 0 },
};
const DEFS = {}; if (Q.get('dbg')) DEFS.DBG = '';

// ---------------- build every world ----------------
async function loadBake(id) {
  try {
    const r = await fetch(`./assets/gi_${id}.bin`); if (!r.ok) return {};
    const buf = await r.arrayBuffer(), jl = new DataView(buf).getUint32(4, true);
    const man = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl)));
    const half = new Uint16Array(buf, 8 + jl + ((4 - ((8 + jl) % 4)) % 4)); let off = 0; const out = {};
    for (const p of man.parts) { const a = new Float32Array(p.count * 4); for (let i = 0; i < a.length; i++) a[i] = THREE.DataUtils.fromHalfFloat(half[off + i]); out[p.name] = a; off += a.length; }
    return out;
  } catch { return {}; }
}
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const WORLDS = {};
for (const id of Object.keys(WORLD_BUILDERS)) {
  if (ONLY && id !== ONLY) continue;
  const w = buildWorld(id), gi = await loadBake(id);
  w.scene = new THREE.Scene(); w.shadow = new THREE.Scene(); w.floaters = []; w.slats = [];
  for (const p of w.parts) {
    const n = p.g.attributes.position.count;
    if (p.gi && gi[p.name] && gi[p.name].length === n * 4) p.g.setAttribute('gi', new THREE.BufferAttribute(gi[p.name], 4));
    else { if (p.gi) console.warn('[one-cup] no bake for', id, p.name); const a = new Float32Array(n * 4); for (let i = 3; i < a.length; i += 4) a[i] = 1; p.g.setAttribute('gi', new THREE.BufferAttribute(a, 4)); }
    const m = p.m;
    const mat = new THREE.ShaderMaterial({ vertexShader: SURF_VS, fragmentShader: SURF_FS, defines: DEFS, extensions: { derivatives: true },
      uniforms: { ...U, uPart: { value: m.kind }, uAlb: { value: new THREE.Vector3(...(m.alb || [0, 0, 0])) }, uRough: { value: m.rough || 0.6 },
        uWoodA: { value: new THREE.Vector3(...(m.woodA || [0, 0, 0])) }, uWoodB: { value: new THREE.Vector3(...(m.woodB || [0, 0, 0])) } } });
    if (m.kind === 10) mat.depthWrite = false;     // the city's bokeh shows through the glass
    const mesh = new THREE.Mesh(p.g, mat); w.scene.add(mesh);
    if (m.kind !== 10 && m.kind !== 11) { const sm = new THREE.Mesh(p.g, depthOnly); w.shadow.add(sm); if (w.float && ['cup', 'handle'].includes(p.name)) w.floaters.push(mesh, sm); }
    if (p.sway) { mesh.visible = false; w.swayMesh = { mesh, sm: w.shadow.children[w.shadow.children.length - 1] }; }
  }
  // the dawn blind sways: rebuild its boards as separate meshes for the shadow pass
  if (w.blind && w.window && !w.window.visible) {
    w.shadow.remove(w.swayMesh.sm);
    const P = w.window, B = w.blind, g = new THREE.BoxGeometry(P.w + 0.02, B.thick, B.depth);
    for (let k = 0; ; k++) { const cv = -P.h / 2 + B.pitch * (k + 0.5); if (cv > P.h / 2) break;
      const m = new THREE.Mesh(g, depthOnly); m.matrixAutoUpdate = false; m.userData.c = P.center.clone().addScaledVector(P.v, cv).addScaledVector(P.n, 0.03); w.shadow.add(m); w.slats.push(m); }
  }
  if (w.bokeh) {      // the city beyond the night window
    const n = 70, pos = [], col = [], seed = [], pal = [[1.0, 0.55, 0.2], [1.0, 0.62, 0.3], [0.25, 0.8, 0.95], [1.0, 0.3, 0.75], [0.9, 0.9, 1.0]];
    for (let i = 0; i < n; i++) {
      const r1 = (Math.sin(i * 12.9898) * 43758.5453) % 1, r2 = (Math.sin(i * 78.233) * 12543.123) % 1, r3 = (Math.sin(i * 39.425) * 24634.6345) % 1;
      const P = w.window, qx = P.center.x + (Math.abs(r1) - 0.5) * P.w * 0.95, qy = P.center.y + (Math.abs(r2) - 0.5) * P.h * 0.95;
      const cam = new THREE.Vector3(...CAM.from.pos), dir = new THREE.Vector3(qx, qy, P.center.z).sub(cam), s = (2.0 + Math.abs(r3) * 8) / dir.length();
      const x = cam.x + dir.x * s, y = cam.y + dir.y * s, z = cam.z + dir.z * s;
      const c = pal[i % pal.length], k = 0.3 + Math.abs(r1 * r2) * 1.4;
      pos.push(x, y, z); col.push(c[0] * k, c[1] * k, c[2] * k); seed.push(i);
    }
    w.points = mkPoints(pos, col, seed, 0);
  }
  if (w.dust) {
    const pos = [], col = [], seed = [];
    for (let i = 0; i < 260; i++) { const r = (k) => Math.abs((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1);
      pos.push(-0.30 + r(1) * 0.45, 0.02 + r(2) * 0.30, -0.45 + r(3) * 0.55); const b = 0.004 + 0.01 * r(4); col.push(b, b, b); seed.push(i); }
    w.points = mkPoints(pos, col, seed, 1);
  }
  WORLDS[id] = w;
}
function mkPoints(pos, col, seed, dust) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({ vertexShader: PTS_VS, fragmentShader: PTS_FS, uniforms: { ...U, uCoC: { value: 0 }, uFocus: { value: 1 }, uPx: { value: 1 }, uDust: { value: dust } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Scene(); s.add(new THREE.Points(g, m)); return { scene: s, mat: m };
}
// steam volume
const steamMat = new THREE.ShaderMaterial({ vertexShader: STEAM_VS, fragmentShader: STEAM_FS, defines: DEFS,
  uniforms: { ...U, uBoxMin: { value: V3() }, uBoxMax: { value: V3() }, uDensity: { value: 0 }, uLiqR: { value: 0.038 } },
  transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor });
const steamBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steamMat);
const steamScene = new THREE.Scene(); steamScene.add(steamBox);

// ---------------- sun shadow map ----------------
const SHADOW_RES = 2048;
const rtShadow = new THREE.WebGLRenderTarget(SHADOW_RES, SHADOW_RES, { depthBuffer: true });
rtShadow.depthTexture = new THREE.DepthTexture(SHADOW_RES, SHADOW_RES, THREE.UnsignedIntType);
const sunCam = new THREE.OrthographicCamera(-0.8, 0.8, 0.8, -0.8, 0.2, 4.0);
U.uShadow.value = rtShadow.depthTexture;
const SUN_TARGET = new THREE.Vector3(0, 0.04, 0);
function renderShadow(w, dir) {
  sunCam.position.copy(SUN_TARGET).addScaledVector(dir, 2.4); sunCam.up.set(0, 1, 0); sunCam.lookAt(SUN_TARGET);
  sunCam.updateMatrixWorld(); sunCam.updateProjectionMatrix();
  U.uShadowMat.value.multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse);
  renderer.setRenderTarget(rtShadow); renderer.clear(); renderer.render(w.shadow, sunCam);
}

// ---------------- passes ----------------
const quadGeo = new THREE.PlaneGeometry(2, 2);
function pass(fs, uniforms, extra = {}) { const m = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra }); const s = new THREE.Scene(); s.add(new THREE.Mesh(quadGeo, m)); return { m, s, u: uniforms }; }
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const addPass = pass(ADD_FS, { tSrc: { value: null }, uW: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
const brightPass = pass(BRIGHT_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uLo: { value: 0.6 }, uHi: { value: 2.5 }, uK: { value: 1 } });
const blurPass = pass(BLUR_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
const LOOK = { vignette: 0.32, grain: 0.012, bloom: 0.07, hal: +(Q.get('hal') || 0.55), sat: 0.97, contrast: 1.05,
  shadowTint: [0.93, 0.98, 1.07], highTint: [1.03, 1.0, 0.95], halTint: [1.0, 0.30, 0.09] };
const finalPass = pass(FINAL_FS, { tColor: { value: null }, tBloom: { value: null }, tHal: { value: null }, uExposure: { value: 1 }, uBloom: { value: LOOK.bloom }, uHal: { value: LOOK.hal },
  uVignette: { value: LOOK.vignette }, uGrain: { value: LOOK.grain }, uSeed: { value: 0 }, uSat: { value: LOOK.sat }, uContrast: { value: LOOK.contrast },
  uShadowTint: { value: new THREE.Vector3(...LOOK.shadowTint) }, uHighTint: { value: new THREE.Vector3(...LOOK.highTint) }, uHalTint: { value: new THREE.Vector3(...LOOK.halTint) }, uRes: { value: new THREE.Vector2() } });
let rtSub, rtAcc, rtB1, rtB2, rtH1, rtH2;
function resize() {
  const w = Math.max(2, stage.clientWidth), h = Math.max(2, stage.clientHeight);
  if (w === W && h === H) return; W = w; H = h;
  renderer.setSize(W, H, false);
  [rtSub, rtAcc, rtB1, rtB2, rtH1, rtH2].forEach((r) => r && r.dispose());
  const o = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  rtSub = new THREE.WebGLRenderTarget(W, H, { ...o, depthBuffer: true });
  rtAcc = new THREE.WebGLRenderTarget(W, H, { ...o, depthBuffer: false });
  rtB1 = new THREE.WebGLRenderTarget(Math.ceil(W / 4), Math.ceil(H / 4), { ...o, depthBuffer: false }); rtB2 = rtB1.clone();
  rtH1 = new THREE.WebGLRenderTarget(Math.ceil(W / 2), Math.ceil(H / 2), { ...o, depthBuffer: false }); rtH2 = rtH1.clone();
  camera.aspect = W / H;
}
const G2 = 1.32471795724, A1 = 1 / G2, A2 = 1 / (G2 * G2), fr = (x) => x - Math.floor(x);
const r2 = (k, o) => [fr(o + A1 * k), fr(o * 1.7 + A2 * k)];
const lerp3 = (a, b, u) => new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
let lensInfo = { coc: 0, focus: 1 };
function setCamera(t, k) {
  const u = ease(clamp01(t / DURATION));
  const pos = lerp3(CAM.from.pos, CAM.to.pos, u), look = lerp3(CAM.from.look, CAM.to.look, u), focus = new THREE.Vector3(...CAM.focus);
  const vfov = 2 * Math.atan(CAM.sensorH / 2 / (CAM.lens / 1000)) * 180 / Math.PI;
  camera.fov = vfov; camera.position.copy(pos); camera.up.set(0, 1, 0); camera.lookAt(look); camera.updateMatrixWorld();
  const fwd = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate();
  const fd = focus.clone().sub(pos).dot(fwd), f = CAM.lens / 1000, ap = f / CAM.fstop / 2;
  lensInfo = { coc: (2 * ap) * f / (fd - f), focus: fd };       // CoC on the sensor (m) = coc * |d - fd| / d
  const [l1, l2] = r2(k, 0.11), rr = ap * Math.sqrt(l1), th = 2 * Math.PI * l2, ax = rr * Math.cos(th), ay = rr * Math.sin(th);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position.addScaledVector(right, ax).addScaledVector(up, ay); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const P = camera.projectionMatrix.elements, [j1, j2] = r2(k, 0.53);
  P[8] += -P[0] * ax / fd + (j1 - 0.5) * 2 / W; P[9] += -P[5] * ay / fd + (j2 - 0.5) * 2 / H;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  U.uCamPos.value.copy(camera.position);
}
function setWorld(w, t) {
  const s = w.sun, win = w.window;
  U.uHasSun.value = s ? 1 : 0; if (s) U.uSunCol.value.set(...s.color).multiplyScalar(s.E);
  U.uHasWin.value = win ? 1 : 0;
  if (win) { U.uWinC.value.copy(win.center); U.uWinU.value.copy(win.u); U.uWinV.value.copy(win.v); U.uWinN.value.copy(win.n); U.uWinSize.value.set(win.w, win.h);
    U.uMask.value = { none: 0, blind: 1, rain: 2 }[win.mask]; U.uSkyH.value.set(...win.sky.horizon); U.uSkyZ.value.set(...win.sky.zenith); U.uSkyK.value = win.sky.k; }
  if (w.blind) { U.uPitch.value = w.blind.pitch; U.uSlatD.value = w.blind.depth; U.uSlatT.value = w.blind.thick; U.uTilt.value = w.blind.tilt; }
  for (const [i, key] of [[0, 'uR0'], [1, 'uR1']]) { const r = w.rects[i];
    if (r) { U[key + 'C'].value.copy(r.center); U[key + 'U'].value.copy(r.u); U[key + 'V'].value.copy(r.v); U[key + 'N'].value.copy(r.n); U[key + 'S'].value.set(r.w, r.h); U[key + 'L'].value.set(...r.L); }
    else U[key + 'L'].value.set(0, 0, 0); }
  if (w.lamp) { U.uLampP.value.copy(w.lamp.p); U.uLampL.value.set(...w.lamp.L); U.uLampR.value = w.lamp.r; } else U.uLampR.value = 0;
  if (w.fill) { U.uFillDir.value.copy(w.fill.dir); U.uFillL.value.set(...w.fill.L); } else U.uFillL.value.set(0, 0, 0);
  U.uLiqY.value = w.level > 0 ? w.liquid.y : 0.0; U.uFullY.value = 0.0738;
  // the cup rises in the void
  for (const m of w.floaters) { m.position.set(0, floatLift(t), 0); m.rotation.set(0, floatTurn(t), 0.03 * floatTurn(t)); m.updateMatrixWorld(true); }
  // steam above today's coffee
  const ly = w.level > 0 ? w.liquid.y : 0.07;
  steamBox.scale.set(0.135, 0.22, 0.115); steamBox.position.set(0.0075, ly + 0.108, -0.0025); steamBox.updateMatrixWorld(true);
  steamMat.uniforms.uBoxMin.value.set(-0.06, ly - 0.002, -0.06); steamMat.uniforms.uBoxMax.value.set(0.075, ly + 0.218, 0.055);
  steamMat.uniforms.uDensity.value = +(Q.get('steam') || w.steam); steamMat.uniforms.uLiqR.value = w.liquid.r;
}
const sunJ = new THREE.Vector3(), tmpU = new THREE.Vector3(), tmpV = new THREE.Vector3();
async function renderFrame(t, spp, yieldEach = false) {
  resize();
  const shot = shotAt(t), w = WORLDS[shot.world];
  setWorld(w, t);
  renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let k = 0; k < spp; k++) {
    const [s1] = r2(k, 0.29); let tk = t + (s1 - 0.5) / 48;
    tk = Math.min(Math.max(tk, shot.t0), shot.t1 - 1e-4);          // the shutter never straddles a cut
    U.uTime.value = tk; U.uSeed.value = k; U.uR2.value.set(...r2(k, 0.71));
    if (w.float) setWorld(w, tk);
    if (w.sun) {
      if (w.slats.length) {
        const P = w.window, tl = blindTilt(w.blind.tilt, tk);
        const thick = P.v.clone().multiplyScalar(Math.cos(tl)).addScaledVector(P.n, Math.sin(tl)), deep = P.n.clone().multiplyScalar(Math.cos(tl)).addScaledVector(P.v, -Math.sin(tl));
        for (const m of w.slats) { m.matrix.makeBasis(P.u, thick, deep).setPosition(m.userData.c); m.matrixWorldNeedsUpdate = true; }
        U.uTilt.value = tl;
      }
      const [q1, q2] = r2(k, 0.87), rr = w.sun.radius * Math.sqrt(q1), ph = 2 * Math.PI * q2;
      tmpU.set(0, 1, 0).cross(w.sun.dir).normalize(); tmpV.copy(w.sun.dir).cross(tmpU).normalize();
      sunJ.copy(w.sun.dir).addScaledVector(tmpU, rr * Math.cos(ph)).addScaledVector(tmpV, rr * Math.sin(ph)).normalize();
      U.uSunDir.value.copy(sunJ); renderShadow(w, sunJ);
    }
    setCamera(tk, k);
    renderer.setRenderTarget(rtSub); renderer.clear(); renderer.render(w.scene, camera);
    if (w.points) { const pm = w.points.mat.uniforms; pm.uCoC.value = lensInfo.coc; pm.uFocus.value = lensInfo.focus; pm.uPx.value = H / CAM.sensorH; renderer.render(w.points.scene, camera); }
    if (w.steam > 0 || Q.get('steam')) renderer.render(steamScene, camera);
    addPass.u.tSrc.value = rtSub.texture; addPass.u.uW.value = 1 / spp;
    renderer.setRenderTarget(rtAcc); renderer.render(addPass.s, ortho);
    if (yieldEach) { renderer.getContext().finish(); await new Promise((r) => setTimeout(r, 0)); }
  }
  const expo = w.exposure * +(Q.get('exp') || 1) * fade(t);
  // glow: wide, quarter res
  Object.assign(brightPass.u, {}); brightPass.u.tSrc.value = rtAcc.texture; brightPass.u.uTexel.value.set(1 / W, 1 / H); brightPass.u.uK.value = expo; brightPass.u.uLo.value = 0.7; brightPass.u.uHi.value = 2.5;
  renderer.setRenderTarget(rtB1); renderer.render(brightPass.s, ortho);
  for (let i = 0; i < 2; i++) {
    blurPass.u.tSrc.value = rtB1.texture; blurPass.u.uDir.value.set((1 + i) / rtB1.width, 0); renderer.setRenderTarget(rtB2); renderer.render(blurPass.s, ortho);
    blurPass.u.tSrc.value = rtB2.texture; blurPass.u.uDir.value.set(0, (1 + i) / rtB1.height); renderer.setRenderTarget(rtB1); renderer.render(blurPass.s, ortho);
  }
  // halation: half res, a tight blur (a few pixels), so it hugs the edge
  brightPass.u.uLo.value = 0.55; brightPass.u.uHi.value = 1.6;
  renderer.setRenderTarget(rtH1); renderer.render(brightPass.s, ortho);
  const hr = (H / 720) * 0.9;
  blurPass.u.tSrc.value = rtH1.texture; blurPass.u.uDir.value.set(hr / rtH1.width, 0); renderer.setRenderTarget(rtH2); renderer.render(blurPass.s, ortho);
  blurPass.u.tSrc.value = rtH2.texture; blurPass.u.uDir.value.set(0, hr / rtH1.height); renderer.setRenderTarget(rtH1); renderer.render(blurPass.s, ortho);
  const f = finalPass.u; f.tColor.value = rtAcc.texture; f.tBloom.value = rtB1.texture; f.tHal.value = rtH1.texture; f.uExposure.value = expo;
  f.uSeed.value = Math.round(t * 24) % 97; f.uRes.value.set(W, H);
  // halation and glow are measured after exposure: divide back so they scale with the frame, not twice
  f.uBloom.value = LOOK.bloom / Math.max(expo, 1e-3); f.uHal.value = LOOK.hal / Math.max(expo, 1e-3);
  renderer.setRenderTarget(null); renderer.render(finalPass.s, ortho);
}

window.__duration = DURATION;
window.__shots = SHOTS;
window.renderAt = async (t) => { await renderFrame(t, SPP, true); renderer.getContext().finish(); };
if (RENDER) window.__ready = true;
else { const t0 = performance.now(); const loop = async () => { await renderFrame(((performance.now() - t0) / 1000) % DURATION, SPP); requestAnimationFrame(loop); }; loop(); window.__ready = true; }
