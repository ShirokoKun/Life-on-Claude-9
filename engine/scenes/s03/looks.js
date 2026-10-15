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
  // DEFAULT. 3 AM, Ivan working: the warm arm lamp and the monitor make the desk, his hands and face the brightest
  // area; the window a restrained cool fill; the room a low warm-neutral level where the wardrobe, bed, shelf, guitar
  // and plants stay faintly readable; corners dark but not crushed; the teal LED a whisper; bloom and halation light.
  midnight_cinematic: { amb: 0.28, ambSky: 0x2a2d36, ambGnd: 0x140f0b,
                lm: { ROOM: 0.66, ARCH: 0.62, WALLN: 0.58, CEIL: 0.45, PROPS: 0.7, DESK: 0.85 },
                ev: -0.1, sat: 1.02, contrast: 1.14, halation: 0.1, bloom: [0.2, 0.4, 1.8], vignette: 0.5, screens: 0.7,
                dither: 0, shade: 0.15, bulb: 0.18, led: 0.35, deskLamp: 1.0, city: 0.4,
                split: { lo: [0.98, 0.99, 1.02], hi: [1.03, 1.0, 0.95], hiDesat: 0.2 },
                monitorShadow: true, monitorK: 0.85,
                rim: { from: [0.15, 3.30, 2.00], at: [1.05, 3.90, 1.20], color: 0xc8d4ff, intensity: 1.4, angle: 20 },
                // the guitar and the window corner: a faint cool kicker so they separate from the dark wall
                accents: [{ from: [0.9, 2.7, 1.9], at: [0.32, 3.48, 0.65], color: 0xb8c8ff, intensity: 0.9, angle: 16 }] },
  // the default (FOCUS_PLAN.md): Ivan is the brightest, best-lit thing; the room a stop and a bit under him, warm-white;
  // a soft rim from the window side separates him; practicals are quiet glows
  focus:      { amb: 0.2, ambSky: 0x2e2a26, ambGnd: 0x120d09, lm: { ROOM: 0.62, ARCH: 0.58, WALLN: 0.55, CEIL: 0.42, PROPS: 0.62, DESK: 0.8 },
                ev: -0.2, sat: 1.0, contrast: 1.15, halation: 0.13, bloom: [0.22, 0.42, 1.6], vignette: 0.55, screens: 0.6,
                dither: 0, shade: 0.12, bulb: 0.12, split: { lo: [1.0, 0.985, 0.97], hi: [1.03, 1.0, 0.95], hiDesat: 0.25 },
                city: 0.35,
                // the logic of the light (director's note): the screens are the only light on him. The monitor is the
                // key, shadowed (nose, brow, glasses), the laptop a small soft fill; the room is a dim fill; the window
                // gives the faintest cool edge from behind. No unmotivated lights. Halation: a soft edge glow only.
                monitorShadow: true, monitorK: 1.0,
                rim: { from: [0.15, 3.30, 2.00], at: [1.05, 3.90, 1.20], color: 0xc8d4ff, intensity: 1.6, angle: 20 } },
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

export const LOOK_NAME = (() => { const n = new URLSearchParams(location.search).get('look'); return LOOKS[n] ? n : 'midnight_cinematic'; })();
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

export function applyLook({ post, root, LM, L, renderer, scene }) {
  const k = LOOK;
  // a rim on Ivan: a narrow soft spot from behind and above on the window side (Blender coords -> three: x, z, -y)
  if (k.rim && scene) {
    const B = (v) => new THREE.Vector3(v[0], v[2], -v[1]);
    const r = new THREE.SpotLight(k.rim.color, k.rim.intensity, 4, THREE.MathUtils.degToRad(k.rim.angle), 0.9, 2);
    r.position.copy(B(k.rim.from)); r.target.position.copy(B(k.rim.at));
    r.name = 'Window rim'; scene.add(r, r.target); if (L) L.rim = r;
  }
  if (k.accents && scene) for (const a of k.accents) {   // small, unshadowed, local separation lights
    const B = (v) => new THREE.Vector3(v[0], v[2], -v[1]);
    const r = new THREE.SpotLight(a.color, a.intensity, 3, THREE.MathUtils.degToRad(a.angle), 0.9, 2);
    r.name = 'Guitar kicker'; r.position.copy(B(a.from)); r.target.position.copy(B(a.at)); scene.add(r, r.target);
  }
  if (k.key && scene) {                               // the face key: soft shadows (nose, brow, cheek)
    const B = (v) => new THREE.Vector3(v[0], v[2], -v[1]);
    const r = new THREE.SpotLight(k.key.color, k.key.intensity, 3, THREE.MathUtils.degToRad(k.key.angle), 0.85, 2);
    r.position.copy(B(k.key.from)); r.target.position.copy(B(k.key.at));
    r.castShadow = true; r.shadow.mapSize.set(2048, 2048); r.shadow.bias = -0.0004; r.shadow.normalBias = 0.01;
    r.shadow.radius = 6; r.shadow.camera.near = 0.1; r.shadow.camera.far = 3;
    r.name = 'Face key'; scene.add(r, r.target); if (L) L.key = r;
  }
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
  if (root && (k.shade != null || k.bulb != null || k.city != null || k.led != null)) root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.lookEm) continue;
      if (k.led != null && /^LED Strip/.test(m.name)) { m.emissiveIntensity *= k.led; m.userData.lookEm = true; continue; }
      if (k.city != null && /^(Valley_|House_Windows|Facade_Towers|Street_)/.test(o.name)) { m.emissiveIntensity *= k.city; m.userData.lookEm = true; continue; }
      if (m.name === 'Lamp Shade' && k.shade != null) { m.emissiveIntensity *= k.shade; m.emissive.setRGB(1.0, 0.62, 0.38); m.userData.lookEm = true; }
      if (m.name === 'Lamp_Bulb' && k.bulb != null) { m.emissiveIntensity *= k.bulb; m.emissive.setRGB(1.0, 0.70, 0.48); m.userData.lookEm = true; }
    }
  });
  if (L && L.screens) for (const s of L.screens) { s.base *= k.screens; s.s.intensity = s.base; }   // the look sets the base; the Screen light control scales it
  if (L && L.lamp && k.deskLamp != null) { L.lampBase *= k.deskLamp; L.lamp.intensity = L.lampBase; }
  if (L && L.monitor) {
    L.monitorBase = 1.9 * (k.monitorK ?? k.screens); L.monitor.intensity = L.monitorBase;
    if (k.monitorShadow) {                            // screen-shaped light casts soft but defined shadows on the face
      const m = L.monitor; m.castShadow = true; m.shadow.mapSize.set(2048, 2048); m.shadow.bias = -0.0003;
      m.shadow.normalBias = 0.008; m.shadow.radius = 3; m.shadow.camera.near = 0.05; m.shadow.camera.far = 2.5;
    }
  }
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
