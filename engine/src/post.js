// Lens + post: scene (HDR, MSAA) -> thin-lens depth of field + depth haze -> atmosphere (dust bokeh,
// light cones, drawn after the blur with a soft depth test) -> restrained bloom -> AgX -> film grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export const LOOK = {
  dof: 2.0,            // stylised: a larger-format, wide-open lens (reference keeps ~5% of frame sharp)
  haze: 0.10, hazeColor: [0.010, 0.010, 0.016],
  bloom: { strength: 0.32, radius: 0.72, threshold: 1.4 },   // halos that hug the sources, not a veil
  grain: 0.004, vignette: 0.42, ca: 0.0012, halation: 0.14, sat: 1.20, contrast: 1.10,   // references: clean, rich
  letterbox: 2.0,
  exposure: -1.0,      // EV trim on top of Blender's +1.35, calibrated against the Cycles stills (median luminance)
};

class LensPass extends Pass {
  // Depth of field at half resolution (the gather is the costliest step), recombined at full resolution:
  // in-focus pixels keep full detail, out-of-focus ones (and blurred foreground spilling over them) take the blur.
  constructor(scene, camera, atmo) {
    super();
    this.scene = scene; this.camera = camera; this.atmo = atmo;
    this.focus = 1; this.fstop = 2.8; this.mm = 35; this.on = true;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType) });
    this.half = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const common = `#include <packing>
        uniform sampler2D tColor, tDepth; uniform vec2 texel; uniform float near, far, k, focus, maxR;
        varying vec2 vUv;
        float dist(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
        float coc(float d) { return min(maxR, k * abs(d - focus) / max(d, 1e-3)); }`;
    const uniforms = () => ({ tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() },
      near: { value: 0.02 }, far: { value: 400 }, k: { value: 0 }, focus: { value: 1 }, maxR: { value: 16 } });
    this.blur = new THREE.ShaderMaterial({
      uniforms: uniforms(), vertexShader: VS,
      fragmentShader: `${common}
        void main() {
          vec3 col = texture2D(tColor, vUv).rgb; float dc = dist(vUv), rc = coc(dc);
          float tot = 1.0, fg = 0.0, r = 0.7, a = 0.0;
          for (int i = 0; i < 200; i++) {
            if (r >= maxR) break;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * texel * r;
            vec3 sc = texture2D(tColor, uv).rgb; float ds = dist(uv), rs = coc(ds);
            if (ds > dc) rs = clamp(rs, 0.0, rc * 2.0);
            float m = smoothstep(r - 0.5, r + 0.5, rs);
            col += mix(col / tot, sc, m); tot += 1.0;
            fg += m * step(ds + 0.02, dc) * step(1.5, rs);          // blurred foreground covering this pixel
            a += 2.39996323; r += 1.0 / r;
          }
          gl_FragColor = vec4(col / tot, clamp(fg / tot * 4.0, 0.0, 1.0));
        }`,
    });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { ...uniforms(), tBlur: { value: null }, haze: { value: LOOK.haze }, hazeCol: { value: new THREE.Vector3(...LOOK.hazeColor) } },
      vertexShader: VS,
      fragmentShader: `${common}
        uniform sampler2D tBlur; uniform float haze; uniform vec3 hazeCol;
        void main() {
          vec3 sharp = texture2D(tColor, vUv).rgb; float dc = dist(vUv);
          vec4 b = texture2D(tBlur, vUv);
          float w = maxR > 0.5 ? max(smoothstep(0.6, 2.2, coc(dc)), b.a) : 0.0;
          vec3 col = mix(sharp, b.rgb, w);
          float hz = 1.0 - exp(-min(dc, 14.0) * haze);
          gl_FragColor = vec4(col * (1.0 - 0.3 * hz) + hazeCol * hz, 1.0);
        }`,
    });
    this.mat = this.comp;                              // the atmosphere reads k/focus from here
    this.qBlur = new FullScreenQuad(this.blur); this.qComp = new FullScreenQuad(this.comp);
  }
  // thin lens on a 36 mm sensor: blur diameter = f^2 / (N (S - f)) * |d - S| / d; radius in pixels
  cocScale() {
    const f = this.mm / 1000, S = Math.max(this.focus, f * 1.5);
    return this.on ? LOOK.dof * 0.5 * (f * f / (this.fstop * (S - f))) / 0.036 * this.w : 0;
  }
  setSize(w, h) {
    this.rt.setSize(w, h); this.half.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    for (const m of [this.blur, this.comp]) m.uniforms.texel.value.set(1 / w, 1 / h);
    this.w = w; this.h = h;
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    for (const m of [this.blur, this.comp]) {
      const u = m.uniforms;
      u.k.value = this.cocScale(); u.focus.value = Math.max(this.focus, this.mm / 1000 * 1.5);
      u.near.value = this.camera.near; u.far.value = this.camera.far;
      u.maxR.value = this.on ? Math.max(4, this.w / 64) : 0;
      u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture;
    }
    if (this.on) { renderer.setRenderTarget(this.half); this.qBlur.render(renderer); }
    this.comp.uniforms.tBlur.value = this.half.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.qComp.render(renderer);
    if (this.atmo) {                        // dust and light cones on top, occluded by the scene depth
      this.atmo.prepare(this, renderer);
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.render(this.atmo.scene, this.camera);
      renderer.autoClear = ac;
    }
  }
}

export function createPost(renderer, scene, camera, atmo) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  const lens = new LensPass(scene, camera, atmo);
  composer.addPass(lens);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), LOOK.bloom.strength, LOOK.bloom.radius, LOOK.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, texel: { value: new THREE.Vector2() },
      grain: { value: LOOK.grain }, vignette: { value: LOOK.vignette }, ca: { value: LOOK.ca }, halation: { value: LOOK.halation },
      sat: { value: LOOK.sat }, contrast: { value: LOOK.contrast }, aspect: { value: 16 / 9 }, target: { value: LOOK.letterbox }, fade: { value: 1 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 texel; uniform float time, grain, vignette, ca, halation, sat, contrast, aspect, target, fade;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 0.6180339) * 43758.5453); }
      vec3 hi(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return c * smoothstep(0.72, 1.0, max(c.r, max(c.g, c.b))); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        vec2 o = d * ca * r2 * 4.0;
        vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
        // halation: film's red-orange glow hugging hot edges (only around highlights)
        vec3 hsum = vec3(0.0);
        for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; hsum += hi(vUv + vec2(cos(a), sin(a)) * texel * 6.0); hsum += hi(vUv + vec2(cos(a), sin(a)) * texel * 13.0); }
        c += vec3(1.0, 0.38, 0.16) * dot(hsum / 24.0, vec3(0.33)) * halation;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, sat);
        c = clamp((c - 0.5) * contrast + 0.5 + (l - 0.5) * 0.0, 0.0, 1.0);
        c *= mix(vec3(1.0), vec3(0.985, 0.99, 1.02), pow(1.0 - clamp(l * 4.0, 0.0, 1.0), 3.0));   // a whisper of night in the deepest blacks
        c *= mix(vec3(1.0), vec3(1.03, 1.0, 0.96), smoothstep(0.25, 1.0, l));                      // highlights near-neutral (refs)
        c *= mix(1.0, smoothstep(0.9, 0.15, r2 * 2.0), vignette);
        float g = h(vUv * 1000.0) - 0.5;
        c += g * grain * (0.35 + 0.65 * (1.0 - l));                    // grain lives in the shadows, like film
        c *= fade;
        float hb = aspect / target; if (abs(vUv.y - 0.5) > hb * 0.5) c = vec3(0.0);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  composer.addPass(film);
  return { composer, lens, bloom, film,
    setSize(w, h, pr = 1) { composer.setSize(w, h); bloom.resolution.set(w * pr / 2, h * pr / 2); film.uniforms.texel.value.set(1 / (w * pr), 1 / (h * pr)); film.uniforms.aspect.value = w / h; },
    setEnabled(on) { lens.on = on; bloom.enabled = on; film.uniforms.vignette.value = on ? LOOK.vignette : 0; film.uniforms.halation.value = on ? LOOK.halation : 0; },
  };
}
