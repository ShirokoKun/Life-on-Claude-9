// Render pipeline: HDR scene -> contact AO -> (optional sub-frame accumulation) -> bloom -> grade/tonemap.
// Two outputs share the same grade: 8-bit sRGB for the live game and 10-bit-ready PQ / BT.2020 for the film.
import * as THREE from 'three';
import { GI } from '../core/gi.js';

const tri = new THREE.BufferGeometry();
tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

class Pass {
  constructor(frag, uniforms, opts = {}) {
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...opts });
    this.mesh = new THREE.Mesh(tri, this.mat); this.mesh.frustumCulled = false;
    this.cam = new THREE.Camera();
  }
  get u() { return this.mat.uniforms; }
  render(r, target) { r.setRenderTarget(target); r.render(this.mesh, this.cam); }
}

const AO_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uProjInv; uniform vec2 uRes; uniform float uRadius; uniform float uFrame; uniform float uNear; uniform float uFar;
vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 c = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec2 px = 1.0 / uRes;
  vec3 dxa = viewPos(vUv + vec2(px.x, 0.0)) - P, dxb = P - viewPos(vUv - vec2(px.x, 0.0));
  vec3 dya = viewPos(vUv + vec2(0.0, px.y)) - P, dyb = P - viewPos(vUv - vec2(0.0, px.y));
  vec3 dx = abs(dxa.z) < abs(dxb.z) ? dxa : dxb, dy = abs(dya.z) < abs(dyb.z) ? dya : dyb;
  vec3 N = normalize(cross(dx, dy));
  float n1 = ign(gl_FragCoord.xy + uFrame * 5.588238), n2 = ign(gl_FragCoord.yx * 1.37 + 31.7 + uFrame * 3.17);
  vec3 rv = normalize(vec3(cos(n1 * 6.2831853), sin(n1 * 6.2831853), 0.0));
  vec3 T = normalize(rv - N * dot(rv, N)), B = cross(N, T);
  float occ = 0.0, wsum = 0.0;
  const int NS = 14;
  for (int i = 0; i < NS; i++) {
    float fi = (float(i) + n2) / float(NS);
    float a = float(i) * 2.399963 + n1 * 6.2831853;
    float cz = sqrt(1.0 - fi * 0.92), sr = sqrt(1.0 - cz * cz);
    vec3 dir = T * (cos(a) * sr) + B * (sin(a) * sr) + N * cz;
    float rad = uRadius * mix(0.12, 1.0, fract(fi * 7.31 + n1) * fract(fi * 7.31 + n1));
    vec3 S = P + dir * rad + N * 0.004;
    vec4 c = uProj * vec4(S, 1.0); vec2 suv = c.xy / c.w * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
    float sz = viewPos(suv).z;
    float diff = sz - S.z;                       // >0: geometry in front of the sample
    float range = smoothstep(0.0, 1.0, uRadius / max(1e-4, abs(P.z - sz)));
    occ += step(0.0025, diff) * range * cz; wsum += cz;
  }
  float ao = 1.0 - occ / max(wsum, 1e-4);
  gl_FragColor = vec4(ao, -P.z, 0.0, 1.0);
}`;

const AOBLUR_FS = /* glsl */`
precision highp float;
varying vec2 vUv; uniform sampler2D tAO; uniform vec2 uDir;
void main(){
  vec4 c = texture2D(tAO, vUv); float z = c.y; float s = c.x, w = 1.0;
  for (int i = -3; i <= 3; i++) { if (i == 0) continue;
    vec4 t = texture2D(tAO, vUv + uDir * float(i) * 1.3);
    float k = exp(-abs(t.y - z) / (0.02 * z + 0.002)) * (1.0 - abs(float(i)) * 0.18);
    s += t.x * k; w += k; }
  gl_FragColor = vec4(s / w, z, 0.0, 1.0);
}`;

// colour * AO, optionally scaled (used with additive blending for accumulation)
// colour * AO. Outside-the-window pixels (found from depth) are kept separable from the room so the
// two can be balanced after the fact: the SDR grade pulls the bright outside down like a phone's HDR
// merge, the HDR10 grade lets it stay bright.
const COMP_FS = /* glsl */`
precision highp float;
varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tDepth; uniform mat4 uInvPV;
uniform float uAO; uniform float uWeight; uniform float uExt; uniform int uPart;   // uPart 0: all (outside * uExt), 1: room only, 2: outside only
void main(){
  vec3 c = texture2D(tColor, vUv).rgb; float ao = texture2D(tAO, vUv).x;
  float d = texture2D(tDepth, vUv).x;
  vec4 wp = uInvPV * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  float isExt = (d >= 0.99999 || wp.z / wp.w < -0.33) ? 1.0 : 0.0;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = mix(1.0, ao, uAO * (1.0 - smoothstep(0.6, 2.5, l)) * (1.0 - 0.5 * isExt));
  vec3 o = min(c, vec3(60.0)) * k * uWeight;
  if (uPart == 0) o *= mix(1.0, uExt, isExt); else if (uPart == 1) o *= 1.0 - isExt; else o *= isExt;
  gl_FragColor = vec4(o, 1.0);
}`;
const COMBINE_FS = 'precision highp float; varying vec2 vUv; uniform sampler2D tA; uniform sampler2D tB; uniform float uK; void main(){ gl_FragColor = vec4(texture2D(tA, vUv).rgb + texture2D(tB, vUv).rgb * uK, 1.0); }';

const DOWN_FS = /* glsl */`
precision highp float;
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh;
void main(){
  vec3 a = texture2D(tSrc, vUv).rgb * 4.0;
  a += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
     + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  a /= 8.0;
  if (uThresh > 0.0) { float l = max(a.r, max(a.g, a.b)); a *= smoothstep(uThresh * 0.5, uThresh * 2.0, l); }
  gl_FragColor = vec4(a, 1.0);
}`;
const UP_FS = /* glsl */`
precision highp float;
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
void main(){
  vec3 s = texture2D(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb;
  s = s * 2.0 + texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
    + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 12.0, 1.0);
}`;

const FINAL_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tBloom;
uniform float uExposure, uBloom, uVignette, uGrain, uSeed, uSat, uContrast, uPeak, uFade, uVib;
uniform vec3 uShadowTint, uMidTint, uHighTint, uWB;
uniform int uMode; // 0 = sRGB 8-bit, 1 = PQ BT.2020
uniform vec2 uRes;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Uchimura filmic curve; P = peak output. Same toe/linear section for SDR and HDR so the two grades match.
float uchi(float x, float P){
  const float a = 1.0, m = 0.22, l = 0.4, c = 1.33, b = 0.0;
  float l0 = ((P - m) * l) / a, S0 = m + l0, S1 = m + a * l0, C2 = (a * P) / (P - S1), CP = -C2 / P;
  float w0 = 1.0 - smoothstep(0.0, m, x), w2 = step(m + l0, x), w1 = 1.0 - w0 - w2;
  float T = m * pow(x / m, c) + b, Lc = m + a * (x - m), Sc = P - (P - S1) * exp(CP * (x - S0));
  return T * w0 + Lc * w1 + Sc * w2;
}
vec3 tonemap(vec3 c, float P){
  float l = max(luma(c), 1e-5), lt = uchi(l, P);
  vec3 byLum = c * (lt / l);
  vec3 byCh = vec3(uchi(c.r, P), uchi(c.g, P), uchi(c.b, P));
  vec3 o = mix(byLum, byCh, 0.55);
  // roll saturated highlights towards white instead of clipping to a primary
  float over = smoothstep(0.75 * P, 1.05 * P, max(o.r, max(o.g, o.b)));
  return mix(o, vec3(min(luma(o), P)), over * 0.6);
}
vec3 pq(vec3 nits){ vec3 y = pow(clamp(nits / 10000.0, 0.0, 1.0), vec3(0.1593017578125)); return pow((0.8359375 + 18.8515625 * y) / (1.0 + 18.6875 * y), vec3(78.84375)); }
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb;
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c *= uExposure * uWB;
  // vignette (in light, before the curve)
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y * 0.82;
  c *= mix(1.0, smoothstep(1.05, 0.25, length(q)), uVignette);
  // look: tint by tonal range, saturation, contrast around mid grey
  float l = luma(c);
  float sh = 1.0 - smoothstep(0.0, 0.25, l), hi = smoothstep(0.35, 1.6, l);
  c *= mix(mix(uMidTint, uShadowTint, sh), uHighTint, hi);
  l = luma(c);
  float gm = clamp((c.g - max(c.r, c.b)) / max(l, 1e-4), 0.0, 1.0);   // how 'foliage green' this pixel is
  c = mix(vec3(l), c, uSat * (1.0 + uVib * gm));
  c.r += gm * uVib * 0.10 * l;
  c = pow(max(c, 0.0) / 0.18, vec3(uContrast)) * 0.18;
  c *= uFade;
  if (uMode == 0) {
    c = tonemap(c, 1.0);
    c = srgb(clamp(c, 0.0, 1.0));
    float g = hash(gl_FragCoord.xy + uSeed * 91.7) - 0.5;
    c += g * (uGrain * (1.0 - 0.6 * luma(c)) + 1.0 / 255.0);
    gl_FragColor = vec4(c, 1.0);
  } else {
    c = tonemap(c, uPeak / 203.0);            // 1.0 == SDR reference white == 203 nits
    c = mat3(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0114, 0.8956) * c; // 709 -> 2020
    vec3 e = pq(max(c, 0.0) * 203.0);
    float g = hash(gl_FragCoord.xy + uSeed * 91.7) - 0.5;
    e += g * (uGrain * 0.35 + 1.0 / 1023.0);
    gl_FragColor = vec4(e, 1.0);
  }
}`;

const COPY_FS = 'precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform float uWeight; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }';

export class Pipeline {
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    this.look = {
      exposure: 1.0, bloom: 0.055, vignette: 0.28, grain: 0.012, sat: 1.0, contrast: 1.0, peak: 1000,
      shadowTint: new THREE.Color(0.92, 0.98, 1.1), midTint: new THREE.Color(1, 1, 1), highTint: new THREE.Color(1, 1, 1), wb: new THREE.Color(1, 1, 1),
      ao: 0.85, aoRadius: 0.16, bloomThresh: 0.0, fade: 1, ext: 0.21, extHdr: 0.55, vib: 0.5,
    };
    this.ao = new Pass(AO_FS, { tDepth: { value: null }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 0.16 }, uFrame: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 100 } });
    this.aoBlur = new Pass(AOBLUR_FS, { tAO: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.comp = new Pass(COMP_FS, { tColor: { value: null }, tAO: { value: null }, tDepth: { value: null }, uInvPV: { value: new THREE.Matrix4() }, uAO: { value: 1 }, uWeight: { value: 1 }, uExt: { value: 1 }, uPart: { value: 0 } });
    this.combine = new Pass(COMBINE_FS, { tA: { value: null }, tB: { value: null }, uK: { value: 1 } });
    this.compAdd = new Pass(COMP_FS, this.comp.mat.uniforms, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.down = new Pass(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 0 } });
    this.up = new Pass(UP_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.copy = new Pass(COPY_FS, { tSrc: { value: null }, uWeight: { value: 1 } });
    this.final = new Pass(FINAL_FS, {
      tColor: { value: null }, tBloom: { value: null }, uExposure: { value: 1 }, uBloom: { value: 0.05 }, uVignette: { value: 0.3 }, uGrain: { value: 0.01 }, uSeed: { value: 0 },
      uSat: { value: 1 }, uVib: { value: 0.5 }, uContrast: { value: 1 }, uPeak: { value: 1000 }, uFade: { value: 1 }, uShadowTint: { value: new THREE.Color() }, uMidTint: { value: new THREE.Color() }, uHighTint: { value: new THREE.Color() }, uWB: { value: new THREE.Color() },
      uMode: { value: 0 }, uRes: { value: new THREE.Vector2() },
    });
    this.frame = 0; this.w = 0; this.h = 0; this.msaa = 4;
  }

  setSize(w, h, { msaa = 4 } = {}) {
    if (w === this.w && h === this.h && msaa === this.msaa) return;
    this.dispose();
    this.w = w; this.h = h; this.msaa = msaa;
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtMain = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: true, samples: msaa });
    this.rtMain.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.rtMain.depthTexture.minFilter = this.rtMain.depthTexture.magFilter = THREE.NearestFilter;
    const aw = Math.ceil(w / 2), ah = Math.ceil(h / 2);
    const aoOpt = { ...opt, minFilter: THREE.LinearFilter };
    this.rtAO = new THREE.WebGLRenderTarget(aw, ah, aoOpt); this.rtAO2 = new THREE.WebGLRenderTarget(aw, ah, aoOpt);
    this.rtComp = new THREE.WebGLRenderTarget(w, h, opt);
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < 6; i++) { mw = Math.max(2, Math.ceil(mw / 2)); mh = Math.max(2, Math.ceil(mh / 2)); this.mips.push(new THREE.WebGLRenderTarget(mw, mh, opt)); }
    this.rtAccum = null; this.rtOut = null;
  }
  dispose() { for (const k of ['rtMain', 'rtAO', 'rtAO2', 'rtComp', 'rtAccum', 'rtAccumExt', 'rtComb', 'rtOut', 'rtSdr']) { if (this[k]) { this[k].dispose(); this[k] = null; } } if (this.mips) this.mips.forEach((m) => m.dispose()); this.mips = []; this.w = 0; }

  _sceneAndAO(target, weight, add) {
    const r = this.r, cam = this.camera, L = this.look;
    r.setRenderTarget(this.rtMain); r.clear(); r.render(this.scene, cam);
    const aw = this.rtAO.width, ah = this.rtAO.height;
    const u = this.ao.u; u.tDepth.value = this.rtMain.depthTexture; u.uProj.value.copy(cam.projectionMatrix); u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uRes.value.set(aw, ah); u.uRadius.value = L.aoRadius; u.uFrame.value = this.frame % 64;
    this.ao.render(r, this.rtAO);
    this.aoBlur.u.tAO.value = this.rtAO.texture; this.aoBlur.u.uDir.value.set(1 / aw, 0); this.aoBlur.render(r, this.rtAO2);
    this.aoBlur.u.tAO.value = this.rtAO2.texture; this.aoBlur.u.uDir.value.set(0, 1 / ah); this.aoBlur.render(r, this.rtAO);
    const c = this.comp.u; c.tColor.value = this.rtMain.texture; c.tAO.value = this.rtAO.texture; c.uAO.value = L.ao; c.uWeight.value = weight;
    c.tDepth.value = this.rtMain.depthTexture; c.uInvPV.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse); c.uExt.value = L.ext; c.uPart.value = 0;
    (add ? this.compAdd : this.comp).render(r, target);
    this.frame++;
  }

  _sync() { GI.uniforms.giExt.value = 1; }
  _combine(k) {
    if (!this.rtComb) this.rtComb = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    const u = this.combine.u; u.tA.value = this.rtAccum.texture; u.tB.value = this.rtAccumExt.texture; u.uK.value = k;
    this.combine.render(this.r, this.rtComb); return this.rtComb;
  }

  _bloom(src) {
    const r = this.r;
    let prev = src;
    for (let i = 0; i < this.mips.length; i++) {
      const m = this.mips[i];
      this.down.u.tSrc.value = prev.texture; this.down.u.uTexel.value.set(1 / prev.width, 1 / prev.height); this.down.u.uThresh.value = i === 0 ? this.look.bloomThresh : 0;
      this.down.render(r, m); prev = m;
    }
    const ac = r.autoClear; r.autoClear = false;
    for (let i = this.mips.length - 1; i > 0; i--) {
      const s = this.mips[i], d = this.mips[i - 1];
      this.up.u.tSrc.value = s.texture; this.up.u.uTexel.value.set(1 / s.width, 1 / s.height);
      this.up.render(r, d);
    }
    r.autoClear = ac;
    return this.mips[0];
  }

  _final(src, bloom, target, mode) {
    const u = this.final.u, L = this.look;
    u.tColor.value = src.texture; u.tBloom.value = bloom.texture; u.uExposure.value = L.exposure; u.uBloom.value = L.bloom / this.mips.length * 6.0; u.uVignette.value = L.vignette;
    u.uGrain.value = L.grain; u.uSeed.value = (this.frame * 0.37) % 17; u.uSat.value = L.sat; u.uVib.value = L.vib; u.uContrast.value = L.contrast; u.uPeak.value = L.peak; u.uFade.value = L.fade;
    u.uShadowTint.value.copy(L.shadowTint); u.uMidTint.value.copy(L.midTint); u.uHighTint.value.copy(L.highTint); u.uWB.value.copy(L.wb);
    u.uMode.value = mode; u.uRes.value.set(this.w, this.h);
    this.final.render(this.r, target);
  }

  /** Live frame straight to the canvas. */
  render() {
    this._sync();
    this._sceneAndAO(this.rtComp, 1, false);
    const b = this._bloom(this.rtComp);
    this._final(this.rtComp, b, null, 0);
  }

  /** Offline quality: average `n` sub-frames. `prep(i, n)` jitters camera / time before each one.
   *  mode 0 -> draws SDR to the canvas, mode 1 -> returns PQ/BT.2020 half-float target for readback. */
  renderAccum(n, prep, mode = 0) {
    const r = this.r;
    if (!this.rtAccum) this.rtAccum = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    if (!this.rtAccumExt) this.rtAccumExt = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    r.setClearColor(0x000000, 1);
    r.setRenderTarget(this.rtAccum); r.clear(); r.setRenderTarget(this.rtAccumExt); r.clear();
    this._sync();
    for (let i = 0; i < n; i++) { prep(i, n); this._sceneAndAOAccum(1 / n); }
    return this.present(mode);
  }
  /** Grade the accumulated frame. mode 0: to canvas (sRGB). 1: PQ/BT.2020 half-float target. 2: sRGB 8-bit target. */
  present(mode) {
    const src = this._combine(mode === 1 ? this.look.extHdr : this.look.ext), b = this._bloom(src);
    if (mode === 0) { this._final(src, b, null, 0); return null; }
    if (mode === 1) {
      if (!this.rtOut) this.rtOut = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
      this._final(src, b, this.rtOut, 1); return this.rtOut;
    }
    if (!this.rtSdr) this.rtSdr = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this._final(src, b, this.rtSdr, 0); return this.rtSdr;
  }
  _sceneAndAOAccum(weight) {
    const r = this.r, ac = r.autoClear;
    r.autoClear = true;
    // scene + AO into rtMain / rtAO (autoClear on), then additive composite into the accumulator
    const cam = this.camera, L = this.look;
    r.setRenderTarget(this.rtMain); r.clear(); r.render(this.scene, cam);
    const aw = this.rtAO.width, ah = this.rtAO.height;
    const u = this.ao.u; u.tDepth.value = this.rtMain.depthTexture; u.uProj.value.copy(cam.projectionMatrix); u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uRes.value.set(aw, ah); u.uRadius.value = L.aoRadius; u.uFrame.value = this.frame % 64;
    this.ao.render(r, this.rtAO);
    this.aoBlur.u.tAO.value = this.rtAO.texture; this.aoBlur.u.uDir.value.set(1 / aw, 0); this.aoBlur.render(r, this.rtAO2);
    this.aoBlur.u.tAO.value = this.rtAO2.texture; this.aoBlur.u.uDir.value.set(0, 1 / ah); this.aoBlur.render(r, this.rtAO);
    const c = this.comp.u; c.tColor.value = this.rtMain.texture; c.tAO.value = this.rtAO.texture; c.uAO.value = L.ao; c.uWeight.value = weight;
    c.tDepth.value = this.rtMain.depthTexture; c.uInvPV.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
    r.autoClear = false;
    c.uPart.value = 1; this.compAdd.render(r, this.rtAccum);
    c.uPart.value = 2; this.compAdd.render(r, this.rtAccumExt);
    r.autoClear = ac;
    this.frame++;
  }
}

export { GI };
