// Procedural texture plumbing: float height fields -> normal maps, canvases -> textures.
import * as THREE from 'three';

export let MAX_ANISO = 8;
export function setMaxAniso(n) { MAX_ANISO = n; }

export function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// Fill a Float32Array height field. fn(u, v, x, y) with u,v in 0..1.
export function field(w, h, fn) {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = fn(x / w, y / h, x, y);
  return H;
}

// Height field -> tangent-space normal map (RGBA8). `strength` is in texels of height per unit.
export function normalData(H, w, h, strength = 1, wrap = true) {
  const out = new Uint8Array(w * h * 4);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y)); }
    return H[y * w + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * strength;
    const il = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    out[i] = (-dx * il * 0.5 + 0.5) * 255; out[i + 1] = (-dy * il * 0.5 + 0.5) * 255; out[i + 2] = (il * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}

function finish(t, { srgb = false, repeat = null, aniso = MAX_ANISO, wrap = true, flipY = false, mip = true } = {}) {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = mip; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = aniso; t.flipY = flipY;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  return t;
}

export function dataTex(data, w, h, opts) { return finish(new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType), opts); }
export function canvasTex(canvas, opts = {}) { return finish(new THREE.CanvasTexture(canvas), { flipY: true, ...opts }); }
export function normalTex(H, w, h, strength, opts = {}) { return dataTex(normalData(H, w, h, strength, opts.wrap !== false), w, h, opts); }

// Pack up to 3 float fields (0..1) into an RGBA8 data texture (e.g. AO / roughness / metal).
export function packTex(w, h, r, g, b, opts) {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = r ? r[i] * 255 : 255; out[i * 4 + 1] = g ? g[i] * 255 : 255; out[i * 4 + 2] = b ? b[i] * 255 : 255; out[i * 4 + 3] = 255;
  }
  return dataTex(out, w, h, opts);
}

// RGB colour field from fn(u,v,x,y) -> [r,g,b] in sRGB 0..1.
export function colorTex(w, h, fn, opts = {}) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x / w, y / h, x, y), i = (y * w + x) * 4;
    out[i] = c[0] * 255; out[i + 1] = c[1] * 255; out[i + 2] = c[2] * 255; out[i + 3] = c.length > 3 ? c[3] * 255 : 255;
  }
  return dataTex(out, w, h, { srgb: true, ...opts });
}

// Average linear colour of a canvas / data array, used as bounce albedo for the light bake.
export function avgColor(data) {
  let r = 0, g = 0, b = 0; const n = data.length / 4;
  const lin = (c) => Math.pow(c / 255, 2.2);
  for (let i = 0; i < data.length; i += 16) { r += lin(data[i]); g += lin(data[i + 1]); b += lin(data[i + 2]); }
  const k = 4 / n; return [r * k, g * k, b * k];
}
