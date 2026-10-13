import { BlendFunction, Effect, ShaderPass } from 'postprocessing';
import * as THREE from 'three';

// Anamorphic lens streak: the long horizontal flare an anamorphic lens draws
// through every bright light.
//
// Pipeline (all inside update(), on small half-float targets):
//   1. prefilter  - soft-knee threshold of the HDR input, downsampled
//                   (x 1/2, y 1/4: vertical detail does not matter for a streak)
//   2. N blur passes along X only, stride doubling each pass (1,2,4,8,...)
//   3. every blur level is accumulated with weight falloff^i, so the result has
//      a hot core AND a long tail (sum of gaussians of growing width)
//   4. the effect fragment tints the streak and ADDs it to the image.
//
// Runs on the scene-referred HDR buffer, before tone mapping.

const fullscreenVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`;

const prefilterFragment = /* glsl */ `
uniform sampler2D inputBuffer;
uniform vec2 texelSize;   // of the input (full res)
uniform float threshold;
uniform float knee;
uniform float clampMax;
uniform float desaturate;
varying vec2 vUv;

vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float contrib = max(soft, br - threshold) / max(br, 1e-5);
  return c * contrib;
}

void main() {
  // 4 taps spread over the 4 source rows this texel covers (y is /4).
  vec3 c = vec3(0.0);
  c += texture2D(inputBuffer, vUv + texelSize * vec2(-0.5, -1.5)).rgb;
  c += texture2D(inputBuffer, vUv + texelSize * vec2( 0.5, -0.5)).rgb;
  c += texture2D(inputBuffer, vUv + texelSize * vec2(-0.5,  0.5)).rgb;
  c += texture2D(inputBuffer, vUv + texelSize * vec2( 0.5,  1.5)).rgb;
  c = min(c * 0.25, vec3(clampMax));
  c = prefilter(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), desaturate);
  gl_FragColor = vec4(c, 1.0);
}`;

const blurFragment = /* glsl */ `
uniform sampler2D inputBuffer;
uniform float texelX;   // 1 / target width
uniform float stride;   // in target texels
varying vec2 vUv;
void main() {
  // 9-tap gaussian (sigma = 2 taps) along X only.
  const float w0 = 0.20416368871516752;
  const float w1 = 0.18017382291138087;
  const float w2 = 0.12383153702515930;
  const float w3 = 0.06628224528636122;
  const float w4 = 0.02763055063889883;
  float d = texelX * stride;
  vec3 c = texture2D(inputBuffer, vUv).rgb * w0;
  c += (texture2D(inputBuffer, vUv + vec2(d, 0.0)).rgb + texture2D(inputBuffer, vUv - vec2(d, 0.0)).rgb) * w1;
  c += (texture2D(inputBuffer, vUv + vec2(2.0 * d, 0.0)).rgb + texture2D(inputBuffer, vUv - vec2(2.0 * d, 0.0)).rgb) * w2;
  c += (texture2D(inputBuffer, vUv + vec2(3.0 * d, 0.0)).rgb + texture2D(inputBuffer, vUv - vec2(3.0 * d, 0.0)).rgb) * w3;
  c += (texture2D(inputBuffer, vUv + vec2(4.0 * d, 0.0)).rgb + texture2D(inputBuffer, vUv - vec2(4.0 * d, 0.0)).rgb) * w4;
  gl_FragColor = vec4(c, 1.0);
}`;

const accumulateFragment = /* glsl */ `
uniform sampler2D inputBuffer;
uniform float weight;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(inputBuffer, vUv).rgb * weight, 1.0);
}`;

const effectFragment = /* glsl */ `
uniform sampler2D streakBuffer;
uniform vec3 tint;
uniform float intensity;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 s = texture2D(streakBuffer, uv).rgb;
  outputColor = vec4(s * tint * intensity, inputColor.a);
}`;

export interface AnamorphicStreakOptions {
  threshold?: number;
  knee?: number;
  intensity?: number;
  /** Streak length multiplier; 1.0 reaches roughly half the frame width. */
  length?: number;
  /** Weight ratio between successive blur levels. <1 = short hot streak, >1 = long faint one. */
  falloff?: number;
  /** 0 = streak keeps the light's colour, 1 = fully tinted. */
  desaturate?: number;
  tint?: THREE.ColorRepresentation;
  /** Number of blur levels (2..8). */
  iterations?: number;
}

export class AnamorphicStreakEffect extends Effect {
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private rtAcc: THREE.WebGLRenderTarget;
  private prefilterPass: ShaderPass;
  private blurPass: ShaderPass;
  private accPass: ShaderPass;
  private prefilterMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private accMaterial: THREE.ShaderMaterial;

  length: number;
  falloff: number;
  iterations: number;

  constructor({
    threshold = 1.5,
    knee = 0.5,
    intensity = 0.6,
    length = 1.0,
    falloff = 1.0,
    desaturate = 0.6,
    tint = '#6f9cff',
    iterations = 6,
  }: AnamorphicStreakOptions = {}) {
    super('AnamorphicStreakEffect', effectFragment, {
      blendFunction: BlendFunction.ADD,
      uniforms: new Map<string, THREE.Uniform>([
        ['streakBuffer', new THREE.Uniform(null)],
        ['tint', new THREE.Uniform(new THREE.Color(tint))],
        ['intensity', new THREE.Uniform(intensity)],
      ]),
    });

    const rtOpts = { depthBuffer: false, type: THREE.HalfFloatType } as const;
    this.rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.rtAcc = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    for (const rt of [this.rtA, this.rtB, this.rtAcc]) {
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.generateMipmaps = false;
    }
    this.rtAcc.texture.name = 'Streak.Accumulated';
    this.uniforms.get('streakBuffer')!.value = this.rtAcc.texture;

    this.prefilterMaterial = new THREE.ShaderMaterial({
      name: 'StreakPrefilter',
      vertexShader: fullscreenVertex,
      fragmentShader: prefilterFragment,
      uniforms: {
        inputBuffer: { value: null },
        texelSize: { value: new THREE.Vector2(1, 1) },
        threshold: { value: threshold },
        knee: { value: knee },
        clampMax: { value: 64 },
        desaturate: { value: desaturate },
      },
      depthWrite: false,
      depthTest: false,
    });
    this.blurMaterial = new THREE.ShaderMaterial({
      name: 'StreakBlurX',
      vertexShader: fullscreenVertex,
      fragmentShader: blurFragment,
      uniforms: {
        inputBuffer: { value: null },
        texelX: { value: 1 },
        stride: { value: 1 },
      },
      depthWrite: false,
      depthTest: false,
    });
    this.accMaterial = new THREE.ShaderMaterial({
      name: 'StreakAccumulate',
      vertexShader: fullscreenVertex,
      fragmentShader: accumulateFragment,
      uniforms: { inputBuffer: { value: null }, weight: { value: 1 } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.prefilterPass = new ShaderPass(this.prefilterMaterial, 'inputBuffer');
    this.blurPass = new ShaderPass(this.blurMaterial, 'inputBuffer');
    this.accPass = new ShaderPass(this.accMaterial, 'inputBuffer');

    this.length = length;
    this.falloff = falloff;
    this.iterations = iterations;
  }

  get threshold() { return this.prefilterMaterial.uniforms.threshold.value; }
  set threshold(v: number) { this.prefilterMaterial.uniforms.threshold.value = v; }
  get knee() { return this.prefilterMaterial.uniforms.knee.value; }
  set knee(v: number) { this.prefilterMaterial.uniforms.knee.value = v; }
  get desaturate() { return this.prefilterMaterial.uniforms.desaturate.value; }
  set desaturate(v: number) { this.prefilterMaterial.uniforms.desaturate.value = v; }
  get intensity() { return this.uniforms.get('intensity')!.value; }
  set intensity(v: number) { this.uniforms.get('intensity')!.value = v; }
  get tint(): THREE.Color { return this.uniforms.get('tint')!.value; }
  setTint(c: THREE.ColorRepresentation) { (this.uniforms.get('tint')!.value as THREE.Color).set(c); }

  override update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false; // the accumulator relies on additive blending
    // 1. threshold + downsample
    this.prefilterPass.render(renderer, inputBuffer, this.rtA);

    // clear accumulator
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rtAcc);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(prevTarget);

    // 2+3. blur along X with doubling strides, accumulate every level
    const n = Math.max(2, Math.min(8, Math.round(this.iterations)));
    let wsum = 0;
    for (let i = 0; i < n; i++) wsum += Math.pow(this.falloff, i);
    let src = this.rtA;
    let dst = this.rtB;
    for (let i = 0; i < n; i++) {
      this.blurMaterial.uniforms.stride.value = Math.pow(2, i) * this.length;
      this.blurPass.render(renderer, src, dst);
      this.accMaterial.uniforms.weight.value = Math.pow(this.falloff, i) / wsum;
      this.accPass.render(renderer, dst, this.rtAcc);
      const t = src; src = dst; dst = t;
    }
    renderer.autoClear = autoClear;
  }

  override setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width / 2));
    const h = Math.max(1, Math.round(height / 4));
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this.rtAcc.setSize(w, h);
    (this.prefilterMaterial.uniforms.texelSize.value as THREE.Vector2).set(1 / width, 1 / height);
    this.blurMaterial.uniforms.texelX.value = 1 / w;
  }

  override initialize(renderer: THREE.WebGLRenderer, alpha: boolean, frameBufferType: number) {
    this.prefilterPass.initialize(renderer, alpha, frameBufferType);
    this.blurPass.initialize(renderer, alpha, frameBufferType);
    this.accPass.initialize(renderer, alpha, frameBufferType);
  }

  override dispose() {
    super.dispose();
    this.rtA.dispose();
    this.rtB.dispose();
    this.rtAcc.dispose();
    this.prefilterMaterial.dispose();
    this.blurMaterial.dispose();
    this.accMaterial.dispose();
  }
}
