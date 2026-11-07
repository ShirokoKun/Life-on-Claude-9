// PS1 look system. Reusable for any study that wants the late-90s console look done with modern care:
//   - a low internal resolution, upscaled with nearest filtering (crisp pixels, no AA)
//   - vertex snapping to that pixel grid (the gentle PS1 "wobble" when the camera moves)
//   - optional affine texture warp (mix 0..1; 0 = correct perspective, the modern "PS1-inspired" default)
//   - 15-bit colour: 5 bits per channel with a 4x4 Bayer ordered dither
//   - a canvas texture painter (nearest, no mipmaps), a seeded RNG, value noise, and a 5x7 bitmap font
// Nothing here touches the film's locked look (engine/src/post.js).
import * as THREE from 'three';

// ------------------------------------------------------------------ shared uniforms
export const PS1 = {
  snapRes: { value: new THREE.Vector2(320, 180) },   // the grid vertices snap to (half the internal res reads best)
  affine: { value: 0.0 },
};

// ------------------------------------------------------------------ materials
// A Lambert material (soft, matte, smooth-shaded like Gouraud) with vertex snapping and optional affine mapping.
export function ps1Material(opts = {}) {
  const { snap = true, ...rest } = opts;
  const m = new THREE.MeshLambertMaterial(rest);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnapRes = PS1.snapRes;
    sh.uniforms.uAffine = PS1.affine;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec2 uSnapRes; uniform float uAffine; varying float vAffW;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        ${snap ? `{ vec4 p = gl_Position; if (p.w > 0.0) { p.xy = floor(p.xy / p.w * uSnapRes + 0.5) / uSnapRes * p.w; gl_Position = p; } }` : ''}
        vAffW = mix(1.0, gl_Position.w, uAffine);`);
    // affine: interpolate uv*w and w, divide in the fragment (cheap emulation of the PS1 texture warp)
    if (rest.map) {
      sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
        vMapUv *= vAffW;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAffW;')
        .replace('#include <map_fragment>', `
          vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAffW );
          diffuseColor *= sampledDiffuseColor;`);
    }
  };
  m.customProgramCacheKey = () => `ps1:${snap}:${!!rest.map}`;
  return m;
}

// Unlit, for emissive things (tubes, signs, screens, the ember). Fog still applies.
export function ps1Unlit(opts = {}) {
  const m = new THREE.MeshBasicMaterial(opts);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnapRes = PS1.snapRes;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSnapRes;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 p = gl_Position; if (p.w > 0.0) { p.xy = floor(p.xy / p.w * uSnapRes + 0.5) / uSnapRes * p.w; gl_Position = p; } }`);
  };
  m.customProgramCacheKey = () => 'ps1unlit';
  return m;
}

// ------------------------------------------------------------------ renderer + post
const POST_FS = `
  precision highp float;
  uniform sampler2D tScene; uniform vec2 uRes; uniform float uLevels, uDither, uVignette, uTime;
  uniform vec3 uLift, uGain; uniform float uSat, uContrast;
  varying vec2 vUv;
  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
    float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
    m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
    for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0 - 0.5 + 1.0/32.0;
    return 0.0;
  }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;                 // already sRGB-encoded by the scene pass
    // grade: lift the blacks toward the set's colour, gain the highlights, then contrast and saturation
    c = uLift + c * (uGain - uLift);
    c = (c - 0.5) * uContrast + 0.5;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, uSat);
    vec2 q = vUv - 0.5; c *= 1.0 - uVignette * dot(q, q) * 2.2;
    // 15-bit colour with an ordered dither
    vec2 px = floor(vUv * uRes);
    c += bayer(px) * uDither / uLevels;
    c = floor(clamp(c, 0.0, 1.0) * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(c, 1.0);
  }`;

export function createPS1Renderer({ width = 640, height = 360, container = document.body, grade = {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const cv = renderer.domElement;
  cv.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;display:block';
  container.appendChild(cv);
  PS1.snapRes.value.set(width / 2, height / 2);

  const rt = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, colorSpace: THREE.SRGBColorSpace,
  });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const uniforms = {
    tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(width, height) },
    uLevels: { value: 31 }, uDither: { value: 1.0 }, uVignette: { value: 0.35 }, uTime: { value: 0 },
    uLift: { value: new THREE.Color(...(grade.lift || [0.02, 0.03, 0.03])) },
    uGain: { value: new THREE.Color(...(grade.gain || [1.0, 0.98, 0.93])) },
    uSat: { value: grade.sat ?? 1.05 }, uContrast: { value: grade.contrast ?? 1.06 },
  };
  const postMat = new THREE.ShaderMaterial({
    uniforms, fragmentShader: POST_FS,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    depthTest: false, depthWrite: false,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function render(scene, camera) {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }
  return { renderer, render, uniforms, width, height, canvas: cv };
}

// ------------------------------------------------------------------ deterministic randomness
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y, s = 0) {   // value noise, 0..1
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, oct = 4) {
  let f = 0, amp = 0.5, fr = 1;
  for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, y * fr, s + i * 17); amp *= 0.5; fr *= 2; }
  return f / (1 - Math.pow(0.5, oct));
}

// ------------------------------------------------------------------ texture painter
// paint(w, h, (ctx, P) => {...}) -> a nearest-filtered sRGB CanvasTexture. P has pixel helpers.
export function paint(w, h, fn, { repeat = [1, 1], wrap = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  const P = painter(ctx, w, h);
  fn(ctx, P);
  P.flush();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  if (wrap) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  tex.repeat.set(...repeat);
  tex.userData.canvas = cv;
  return tex;
}

const hex = (c) => { const n = typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function painter(ctx, w, h) {
  let img = null;
  const grab = () => { if (!img) img = ctx.getImageData(0, 0, w, h); return img; };
  const P = {
    w, h, hex, ctx,
    flush() { if (img) { ctx.putImageData(img, 0, 0); img = null; } },
    fill(c, x = 0, y = 0, ww = w, hh = h) { P.flush(); ctx.fillStyle = typeof c === 'string' ? c : `rgb(${hex(c)})`; ctx.fillRect(x, y, ww, hh); },
    // per-pixel colour function f(x, y, [r,g,b]) -> [r,g,b]
    each(f, x0 = 0, y0 = 0, x1 = w, y1 = h) {
      const d = grab().data;
      for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const i = (y * w + x) * 4; const o = f(x, y, [d[i], d[i + 1], d[i + 2]], d[i + 3]);
        if (o) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = o.length > 3 ? o[3] : (d[i + 3] || 255); }
      }
    },
    px(x, y, c, a = 255) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return; const d = grab().data, i = (y * w + x) * 4, k = hex(c);
      const t = a / 255; d[i] = d[i] * (1 - t) + k[0] * t; d[i + 1] = d[i + 1] * (1 - t) + k[1] * t; d[i + 2] = d[i + 2] * (1 - t) + k[2] * t; d[i + 3] = 255; },
    rect(x, y, ww, hh, c, a = 255) { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) P.px(x + i, y + j, c, a); },
    // multiply by (1 - k*f) where f is a shape: used for painted AO and grime
    shade(f, k = 0.5, tint = [0, 0, 0]) {
      P.each((x, y, c) => { const s = Math.max(0, Math.min(1, f(x, y) * k)); return [c[0] + (tint[0] - c[0]) * s, c[1] + (tint[1] - c[1]) * s, c[2] + (tint[2] - c[2]) * s]; });
    },
    noise(amp = 12, seed = 1, scale = 1) {   // per-pixel luminance noise (texel grit)
      P.each((x, y, c) => { const n = (hash2(Math.floor(x / scale), Math.floor(y / scale), seed) - 0.5) * 2 * amp; return [c[0] + n, c[1] + n, c[2] + n]; });
    },
    mottle(amp = 18, seed = 2, freq = 0.08, tint = null) {   // low-frequency stain
      P.each((x, y, c) => { const n = (fbm(x * freq, y * freq, seed) - 0.5) * 2 * amp;
        return tint ? [c[0] + n * tint[0], c[1] + n * tint[1], c[2] + n * tint[2]] : [c[0] + n, c[1] + n, c[2] + n]; });
    },
    line(x0, y0, x1, y1, c, a = 255, thick = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        for (let a1 = 0; a1 < thick; a1++) for (let b1 = 0; b1 < thick; b1++) P.px(x + a1 - (thick >> 1), y + b1 - (thick >> 1), c, a); }
    },
    disc(cx, cy, r, c, a = 255) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) P.px(cx + x, cy + y, c, a); },
    text(str, x, y, c, s = 1, a = 255) { return drawText(P, str, x, y, c, s, a); },
    textWidth(str, s = 1) { return str.length * 6 * s - s; },
  };
  return P;
}

// ------------------------------------------------------------------ 5x7 bitmap font
const G = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
  3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
  9: '01110100011000101111000010001001100',
  '-': '00000000000000011111000000000000000', '.': '00000000000000000000000000110001100', ':': '00000011000110000000011000110000000',
  '>': '01000001000001000001000100010001000', '<': '00010001000100010000010000010000010', '/': '00001000100001000100010001000010000',
  '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100', '+': '00000001000010011111001000010000000',
  "'": '00100001000100000000000000000000000', '%': '11000110010001000100010001001100011', '=': '00000000001111100000111110000000000',
  '*': '00000101010111011111011101010100000', ' ': '00000000000000000000000000000000000', ',': '00000000000000000000001100010001000',
};
function drawText(P, str, x, y, c, s, a) {
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const g = G[ch] || G[' '];
    for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r * 5 + k] === '1') P.rect(cx + k * s, y + r * s, s, s, c, a);
    cx += 6 * s;
  }
  return cx;
}
