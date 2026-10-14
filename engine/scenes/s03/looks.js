// Mood presets for Ivan's room, switched with ?look=<name> (default 'clean'). All live: no re-bake.
//   clean      the corrected base: soft night, everything readable
//   blue3am    A: moonlit blue room, screens are the key, one small warm lamp           (mood_4, mood_8)
//   lampwindow B: warm lamp pools against a teal window, deep shadows                   (mood_5, mood_7)
//   screen     C: the room nearly dark, only the screens carve Ivan                    (OpenKnight, desk_ivan.jpg)
//   garage     D: hard contrast pools, black falloff, warm halation, screen-space dither (the garage refs)
// Each look sets: the night ambient, a lightmap scale per bake group, exposure (EV), a grade (post film uniforms),
// bloom, and the dither pass. The intro's LOOK in post.js is untouched; only this scene's post is adjusted.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VS } from '../../src/post.js';

export const LOOKS = {
  clean:      { amb: 0.9, ambSky: 0x22325a, ambGnd: 0x140e0a, lm: {}, ev: 0, sat: 1.2, contrast: 1.1, halation: 0.14,
                bloom: [0.32, 0.72, 1.4], vignette: 0.42, screens: 1, dither: 0 },
  // A and C, tuned on the director's notes: lamps dim, small and not yellow (amber, a soft core, no spray); the room
  // behind a stop darker and cool; shadows teal-blue, highlights warm but desaturated (split tone, not a tint)
  blue3am:    { amb: 1.2, ambSky: 0x1b3366, ambGnd: 0x080a12, lm: { ROOM: 0.42, ARCH: 0.45, WALLN: 0.45, CEIL: 0.35, PROPS: 0.6 },
                ev: -0.3, sat: 1.15, contrast: 1.22, halation: 0.05, bloom: [0.16, 0.35, 2.2], vignette: 0.55, screens: 1.6,
                dither: 0, shade: 0.35, bulb: 0.4, split: { lo: [0.78, 0.95, 1.14], hi: [1.05, 0.95, 0.84], hiDesat: 0.35 } },
  lampwindow: { amb: 0.35, ambSky: 0x163048, ambGnd: 0x1a0f08, lm: {}, ev: -0.15, sat: 1.25, contrast: 1.25, halation: 0.28,
                bloom: [0.5, 0.75, 1.1], vignette: 0.55, screens: 1, dither: 0, tint: [1.06, 0.98, 0.92] },
  screen:     { amb: 0.35, ambSky: 0x132650, ambGnd: 0x040406, lm: { ROOM: 0.14, ARCH: 0.2, WALLN: 0.22, CEIL: 0.12, PROPS: 0.25, DESK: 0.4 },
                ev: 0.25, sat: 1.12, contrast: 1.28, halation: 0.05, bloom: [0.2, 0.35, 2.0], vignette: 0.6, screens: 2.4,
                dither: 0, shade: 0.25, bulb: 0.3, split: { lo: [0.76, 0.94, 1.16], hi: [1.04, 0.96, 0.88], hiDesat: 0.3 } },
  garage:     { amb: 0.05, ambSky: 0x0c1220, ambGnd: 0x000000, lm: { CEIL: 0.4, WALLN: 0.7 }, ev: 0.1, sat: 1.1, contrast: 1.45,
                halation: 0.55, bloom: [0.85, 0.85, 0.85], vignette: 0.7, screens: 1.4, dither: 1, tint: [1.0, 0.98, 0.95] },
};

export const LOOK_NAME = (() => { const n = new URLSearchParams(location.search).get('look'); return LOOKS[n] ? n : 'clean'; })();
export const LOOK = LOOKS[LOOK_NAME];

// Ordered (Bayer 8x8) dither in screen space: quantises the image into a few levels with a fixed dot pattern, so the
// pattern sits still on a still frame and crawls over the picture when the camera moves (the garage refs). It shows
// most in the darks and mid-tones; highlights stay clean. cell = pattern pixel size at 1080p.
function ditherPass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1920, 1080) }, levels: { value: 20 },
      amount: { value: 1 }, cell: { value: 2 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float levels, amount, cell; varying vec2 vUv;
      float bayer(vec2 p) {
        // 8x8 Bayer from the 2x2 recursion, in [0,1)
        float b = 0.0, s = 1.0;
        for (int i = 0; i < 3; i++) {
          vec2 q = mod(floor(p / s), 2.0);
          b = b * 4.0 + (q.x * 2.0 + q.y * 3.0 - 4.0 * q.x * q.y);
          s *= 2.0;
        }
        return (b + 0.5) / 64.0;
      }
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 px = floor(vUv * res / (cell * res.y / 1080.0));
        float t = bayer(px);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float q = mix(levels * 0.5, levels, smoothstep(0.0, 0.6, l));   // coarser steps in the dark: the dots show there
        vec3 d = (floor(c * q) + step(vec3(t), fract(c * q))) / q;
        gl_FragColor = vec4(mix(c, d, amount * (1.0 - smoothstep(0.75, 1.0, l))), 1.0);
      }`,
  });
}

export function applyLook({ post, root, LM, L, renderer }) {
  const k = LOOK;
  // the night ambient (scene.js createLights made it; the look sets colour and strength)
  if (L && L.fill) { L.fill.color.setHex(k.ambSky); L.fill.groundColor.setHex(k.ambGnd); if (!new URLSearchParams(location.search).get('amb')) L.fill.intensity = k.amb; }
  // lightmap scale per bake group
  if (root && LM) root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m.lightMap) continue;
      const g = Object.keys(LM).find((n) => LM[n] === m.lightMap);
      if (g && k.lm[g] != null && !m.userData.lookLm) { m.lightMapIntensity *= k.lm[g]; m.userData.lookLm = true; }
    }
  });
  // the practicals themselves: a dim amber glow, not a white-yellow ball
  if (root && (k.shade != null || k.bulb != null)) root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.lookEm) continue;
      if (m.name === 'Lamp Shade' && k.shade != null) { m.emissiveIntensity *= k.shade; m.emissive.setRGB(1.0, 0.62, 0.38); m.userData.lookEm = true; }
      if (m.name === 'Lamp_Bulb' && k.bulb != null) { m.emissiveIntensity *= k.bulb; m.emissive.setRGB(1.0, 0.70, 0.48); m.userData.lookEm = true; }
    }
  });
  if (L && L.screens) for (const s of L.screens) s.s.intensity = s.base * k.screens;
  if (L && L.monitor) L.monitor.intensity = 1.9 * k.screens;
  if (post) {
    const u = post.film.uniforms;
    u.sat.value = k.sat; u.contrast.value = k.contrast; u.halation.value = k.halation; u.vignette.value = k.vignette;
    [post.bloom.strength, post.bloom.radius, post.bloom.threshold] = k.bloom;
    if (k.split) {                                   // split tone: cool shadows, warm desaturated highlights
      const sp = new ShaderPass({ uniforms: { tDiffuse: { value: null }, lo: { value: new THREE.Vector3(...k.split.lo) },
        hi: { value: new THREE.Vector3(...k.split.hi) }, hiDesat: { value: k.split.hiDesat } },
        vertexShader: VS, fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 lo, hi; uniform float hiDesat; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            float wl = 1.0 - smoothstep(0.0, 0.42, l), wh = smoothstep(0.3, 0.95, l);
            c = mix(c, vec3(l), hiDesat * wh);                         // highlights lose saturation (no yellow)
            c *= mix(vec3(1.0), lo, wl) * mix(vec3(1.0), hi, wh);
            gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }` });
      post.composer.addPass(sp);
    }
    if (k.tint) {                                    // a per-look colour cast, as a final multiply
      const tint = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tint: { value: new THREE.Vector3(...k.tint) } },
        vertexShader: VS, fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 tint; varying vec2 vUv;
          void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; gl_FragColor = vec4(clamp(c * tint, 0.0, 1.0), 1.0); }` });
      post.composer.addPass(tint);
    }
    if (k.dither) {
      const d = ditherPass(); d.uniforms.amount.value = k.dither;
      const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size); d.uniforms.res.value.copy(size);
      post.composer.addPass(d);
      post.dither = d;
    }
  }
}

export const lookExposure = () => LOOK.ev;
