// Round 13: the deep glow (director: "a deep glow, the outer spread of the glow there, but glowing with its saturated
// colours on"; ref OpenKnight: a red LED blooms red, a green one green). The film's bloom runs before AgX, and AgX drains
// colour from bright light, so every glow went white-beige. This pass renders only the glowing things (everything else
// as a black occluder, so walls and Ivan still hide them), blurs that layer over a wide mip chain, and adds it AFTER the
// tone mapper, where its colour survives: a saturated halo in the source's own hue, a touch of saturated core, and a thin
// anamorphic streak through the hottest points. kf1 only (the intro and s03 keep the locked LOOK untouched).
//
// What glows: a mesh whose material or any ancestor has userData.glow (a number, the gain), or a named practical
// (screens, lamp bulbs, the string lights). voxelMaterial() marks every pixel-art object (Claude, the icons, envelopes).
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VS } from '../../src/post.js';

// (screens are left to the film's own bloom: as glow sources they flood a close-up; bulbs and string lights are small)
const NAMED = [];   // (bulbs and string lights: the film's bloom gives them their creamy halo)

export function glowGain(o) {
  for (let p = o; p; p = p.parent) {
    if (p.userData && p.userData.glow !== undefined) return p.userData.glow;
    if (p === o) { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && m.userData && m.userData.glow !== undefined) return m.userData.glow; }
    for (const [re, k] of NAMED) if (p.name && re.test(p.name)) return k;
  }
  return 0;
}

export class GlowPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene; this.camera = camera; this.needsSwap = true;
    this.params = { gain: 1.0, core: 0.35, sat: 1.25, streak: 0.0, streakTh: 1.2, radius: 0.85, strength: 1.1, threshold: 0.35 };
    this.src = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.occ = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.blur = new UnrealBloomPass(new THREE.Vector2(256, 256), 1.1, 0.85, 0.0);
    this.blur.copyUniforms.opacity.value = 0;   // it blends its result back into the input: we read the halo from its targets instead
    this.comp = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tHalo: { value: null }, tCore: { value: null }, tWide: { value: null },
        gain: { value: 1 }, core: { value: 0.35 }, sat: { value: 1.25 }, streak: { value: 0 }, streakTh: { value: 1.2 } },
      vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse, tHalo, tCore, tWide; uniform float gain, core, sat, streak, streakTh; varying vec2 vUv;
        vec3 keep(vec3 g) { float m = max(g.r, max(g.g, g.b)); vec3 c = g / (1.0 + 0.55 * m);          // compress, hue kept
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return max(mix(vec3(l), c, sat), 0.0); }
        void main() {
          vec3 base = texture2D(tDiffuse, vUv).rgb;
          vec3 h = keep(texture2D(tHalo, vUv).rgb * gain);
          vec3 c = keep(texture2D(tCore, vUv).rgb * gain);
          vec3 o = base + (1.0 - base) * h;                                             // the halo: a screen blend
          o = mix(o, max(o, c), core);                                                   // the core keeps its colour
          if (streak > 0.0) {                                                            // anamorphic: a thin horizontal flare
            vec3 s = vec3(0.0); float wsum = 0.0;
            for (int i = -12; i <= 12; i++) { float x = float(i) / 12.0; float w = exp(-x * x * 3.0);
              vec3 v = texture2D(tWide, vUv + vec2(x * 0.22, 0.0)).rgb; s += max(v - streakTh, 0.0) * w; wsum += w; }
            s /= wsum; o += keep(s * streak) * vec3(0.85, 0.92, 1.0);
          }
          gl_FragColor = vec4(o, 1.0);
        }` });
    this.q = new FullScreenQuad(this.comp);
  }
  setSize(w, h) {
    const px = Math.max(1, h / 1080);                                                   // 1080p-sized halo at any resolution
    this.src.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    this.blur.setSize(Math.round(w / px), Math.round(h / px));
  }
  render(renderer, writeBuffer, readBuffer) {
    const P = this.params;
    // 1. the glowing things alone (the rest black, so it still occludes; see-through things that do not glow are skipped)
    const swapped = [], hidden = [];
    this.scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isPoints || o.isSprite || o.isLine)) return;
      if (glowGain(o) > 0) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!o.isMesh || (m && (m.transparent || m.blending === THREE.AdditiveBlending))) { hidden.push(o); return; }
      swapped.push([o, o.material]); o.material = this.occ;
    });
    for (const o of hidden) o.visible = false;
    const bg = this.scene.background, fog = this.scene.fog; this.scene.background = null; this.scene.fog = null;
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(this.src); renderer.clear(); renderer.render(this.scene, this.camera);
    renderer.setClearColor(cc, ca);
    this.scene.background = bg; this.scene.fog = fog;
    for (const [o, m] of swapped) o.material = m;
    for (const o of hidden) o.visible = true;
    // 2. the wide halo: the bloom's mip chain on the glow layer (its composite lands in renderTargetsHorizontal[0];
    //    the input stays the bare glow layer, our core)
    this.blur.strength = P.strength; this.blur.radius = P.radius; this.blur.threshold = P.threshold;   // only hot pixels spread
    this.blur.render(renderer, null, this.src, 0, false);
    // 3. composite after the tone mapper
    const u = this.comp.uniforms;
    u.tDiffuse.value = readBuffer.texture; u.tHalo.value = this.blur.renderTargetsHorizontal[0].texture;
    u.tCore.value = this.src.texture; u.tWide.value = this.blur.renderTargetsVertical[1].texture;
    u.gain.value = P.gain; u.core.value = P.core; u.sat.value = P.sat; u.streak.value = P.streak; u.streakTh.value = P.streakTh;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.q.render(renderer);
  }
}
