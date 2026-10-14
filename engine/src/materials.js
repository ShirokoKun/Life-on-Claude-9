// Material library: every Blender material name -> a physically based look with real textures.
//
// Rules (see docs/CINEMATIC_THREEJS_PLAYBOOK.md):
//  - Finish is chosen per object on purpose: matte (paper, plaster, fabric), satin (desk, floor, painted
//    wood, plastics), gloss (screens, glass, ceramics, lacquer). Nothing is plastic-shiny by accident.
//  - Albedo values are real-world (white paint ~0.75, walnut ~0.08, black plastic ~0.03), set as a
//    target colour; the texture only adds variation around it (tint = target / texture mean).
//  - Baked surfaces read their light from the Cycles lightmap (uv1). Live lights add on top; image-based
//    diffuse is switched off for them (the lightmap already contains the bounce) and reflections are
//    occluded by the lightmap so nothing glows in dark corners.
import * as THREE from 'three';

const TEX_ROOT = 'assets/tex/';

// key: texture set, color: target albedo (sRGB), rough: roughness multiplier/value, metal, nrm: normal
// strength, coat: clearcoat (lacquer), sheen: fabrics, mapAlbedo:false keeps only normal+rough detail.
export const LIB = {
  // architecture
  'Plaster':        { key: 'plaster_wall', color: '#968a7c', rough: 0.92, nrm: 0.55, lm: 0.45 },   // warm limewash, a stop under white
  'Ceiling':        { key: 'plaster_wall', color: '#9a958c', rough: 0.95, nrm: 0.35, lm: 0.45 },
  'Floor':          { key: 'oak_floor', color: '#6a4b33', rough: 0.55, nrm: 0.5, coat: 0.35, coatRough: 0.28 },
  'Trim':           { key: 'painted_wood', color: '#d6d2ca', rough: 0.45, nrm: 0.4 },
  'Door':           { key: 'painted_wood', color: '#cdc8bf', rough: 0.42, nrm: 0.4 },
  'Window Frame':   { key: 'black_metal', color: '#1c1c1e', rough: 0.40, metal: 0.2, nrm: 0.2, coat: 0.2 },
  'White':          { key: 'painted_wood', color: '#d9d6d0', rough: 0.45, nrm: 0.3 },
  'Concrete':       { key: 'concrete', color: '#6d6a65', rough: 0.9, nrm: 0.7 },
  'Own Facade':     { key: 'concrete', color: '#4a4741', rough: 0.9, nrm: 0.7 },
  'Asphalt':        { key: 'asphalt', color: '#232324', rough: 0.85, nrm: 0.8 },
  'Stone':          { key: 'concrete', color: '#8d8880', rough: 0.35, nrm: 0.3, coat: 0.3 },
  // wood
  'Desk Walnut':    { key: 'walnut', color: '#4b2e1c', rough: 0.42, nrm: 0.35, coat: 0.45, coatRough: 0.22 },
  'Shelf Oak':      { key: 'light_wood', color: '#8a6a4a', rough: 0.55, nrm: 0.4 },
  'Frame Oak':      { key: 'light_wood', color: '#7d5c3e', rough: 0.5, nrm: 0.4 },
  'Furniture':      { key: 'light_wood', color: '#6e5038', rough: 0.55, nrm: 0.4 },
  // dark stained wood: the shelf behind him must not merge with his off-white sweater
  'Shelf White':    { key: 'light_wood', color: '#3b2a1e', rough: 0.5, nrm: 0.45, coat: 0.2, coatRough: 0.35 },
  'Chopstick':      { key: 'light_wood', color: '#b39066', rough: 0.6, nrm: 0.3 },
  // metals and hard goods
  'Black Steel':    { key: 'black_metal', color: '#1b1b1d', rough: 0.55, metal: 0.25, nrm: 0.4 },
  'Monitor Black':  { key: 'black_metal', color: '#161618', rough: 0.45, metal: 0.1, nrm: 0.25 },
  'Bezel':          { key: 'black_metal', color: '#0e0e10', rough: 0.3, metal: 0.0, nrm: 0.1 },
  'Appliance Black':{ key: 'black_metal', color: '#141416', rough: 0.4, metal: 0.2, nrm: 0.3 },
  'Frame Black':    { key: 'black_metal', color: '#121214', rough: 0.5, metal: 0.1, nrm: 0.2 },
  'Dark':           { key: 'plastic', color: '#151517', rough: 0.6, nrm: 0.3 },
  'Laptop Alu':     { key: 'brushed_metal', color: '#a9abb0', rough: 0.32, metal: 1.0, nrm: 0.25 },
  'Metal':          { key: 'brushed_metal', color: '#8e9095', rough: 0.35, metal: 1.0, nrm: 0.3 },
  'Hard Drive':     { key: 'brushed_metal', color: '#4a4b4f', rough: 0.4, metal: 1.0, nrm: 0.3 },
  'Pole':           { key: 'black_metal', color: '#2a2a2c', rough: 0.5, metal: 0.4, nrm: 0.3 },
  'Chrome':         { color: '#e6e6e6', rough: 0.06, metal: 1.0 },
  'Key Brass':      { key: 'brushed_metal', color: '#b28c45', rough: 0.3, metal: 1.0, nrm: 0.2 },
  'Clock Rim':      { key: 'black_metal', color: '#1a1a1a', rough: 0.4, metal: 0.3, nrm: 0.2 },
  // plastics and rubber (texture adds micro-detail only)
  'Keys':           { key: 'plastic', color: '#18181a', rough: 0.55, nrm: 0.2 },
  'Trackpad':       { key: 'plastic', color: '#8e9096', rough: 0.35, mapAlbedo: false, nrm: 0.1 },
  'Rubber':         { key: 'plastic', color: '#151516', rough: 0.85, nrm: 0.4 },
  'Router':         { key: 'plastic', color: '#e2e1dd', rough: 0.5, mapAlbedo: false, nrm: 0.2 },
  'Speaker Body':   { key: 'plastic', color: '#232325', rough: 0.6, nrm: 0.3 },
  'Speaker Cone':   { key: 'fabric_weave', color: '#121214', rough: 0.95, nrm: 0.6 },
  'Radio Cream':    { key: 'plastic', color: '#d8ccb4', rough: 0.45, mapAlbedo: false, nrm: 0.2 },
  'Radio Red':      { key: 'plastic', color: '#8a1e17', rough: 0.4, mapAlbedo: false, nrm: 0.2 },
  'Radio Grille':   { key: 'fabric_weave', color: '#141414', rough: 0.9, nrm: 0.6 },
  'Fan White':      { key: 'plastic', color: '#dedcd6', rough: 0.45, mapAlbedo: false, nrm: 0.2 },
  'Bin Grey':       { key: 'plastic', color: '#5b5d61', rough: 0.6, mapAlbedo: false, nrm: 0.3 },
  'Phone Body':     { key: 'plastic', color: '#1c1c1e', rough: 0.3, nrm: 0.1 },
  'Headphones':     { key: 'plastic', color: '#1d1d20', rough: 0.55, nrm: 0.2 },
  'Ear Cushion':    { key: 'leather', color: '#1a1a1b', rough: 0.6, nrm: 0.5 },
  'Sole White':     { key: 'plastic', color: '#d9d6cf', rough: 0.7, mapAlbedo: false, nrm: 0.3 },
  'Sneaker':        { key: 'linen', color: '#3b3d43', rough: 0.85, nrm: 0.6, sheen: 0.4 },
  'Rubber Duck':    { key: 'plastic', color: '#e8b81a', rough: 0.35, mapAlbedo: false, nrm: 0.1 },
  'Duck Beak':      { key: 'plastic', color: '#e0601a', rough: 0.35, mapAlbedo: false, nrm: 0.1 },
  'Can Red':        { key: 'brushed_metal', color: '#8a0c08', rough: 0.25, metal: 0.9, nrm: 0.1 },
  'Can Green':      { key: 'brushed_metal', color: '#2a6a1e', rough: 0.25, metal: 0.9, nrm: 0.1 },
  'Can Black':      { key: 'brushed_metal', color: '#151517', rough: 0.25, metal: 0.9, nrm: 0.1 },
  'Can Silver Blue':{ key: 'brushed_metal', color: '#4060b0', rough: 0.25, metal: 0.9, nrm: 0.1 },
  'Magnet':         { key: 'plastic', color: '#b02a22', rough: 0.4, mapAlbedo: false },
  'Pin Red':        { key: 'plastic', color: '#b0221c', rough: 0.35, mapAlbedo: false },
  'Pen Blue':       { key: 'plastic', color: '#1d3f9a', rough: 0.35, mapAlbedo: false },
  'Snack Wrapper':  { color: '#b8a24a', rough: 0.25, metal: 0.6 },
  'Trash Bag':      { key: 'plastic', color: '#111112', rough: 0.35, nrm: 0.6 },
  'Packing Tape':   { color: '#b59a6a', rough: 0.2 },
  // ceramics (glaze = gloss)
  'Mug White':      { key: 'ceramic', color: '#e4e1da', rough: 0.12, nrm: 0.1, coat: 0.6 },
  'Mug Navy':       { key: 'ceramic', color: '#1f2a44', rough: 0.15, nrm: 0.1, coat: 0.6 },
  'Mug Sage':       { key: 'ceramic', color: '#7d8d76', rough: 0.15, nrm: 0.1, coat: 0.6 },
  'Plate':          { key: 'ceramic', color: '#e2dfd8', rough: 0.15, nrm: 0.1, coat: 0.5 },
  'Pot White':      { key: 'ceramic', color: '#dcd8d0', rough: 0.35, nrm: 0.2 },
  'Pot Terracotta': { key: 'terracotta', color: '#9a5634', rough: 0.85, nrm: 0.6 },
  'Plant Pot':      { key: 'terracotta', color: '#7a4a32', rough: 0.85, nrm: 0.6 },
  'Soil':           { key: 'soil', color: '#2a1d14', rough: 1.0, nrm: 0.8 },
  // fabrics (matte + sheen)
  'Chair Mesh':     { key: 'fabric_weave', color: '#1c1e22', rough: 0.9, nrm: 0.8, sheen: 0.5 },
  'Desk Mat Felt':  { key: 'fabric_weave', color: '#17191c', rough: 1.0, nrm: 0.5, sheen: 0.6 },
  'Rug Wool':       { key: 'rug', color: '#3b3631', rough: 1.0, nrm: 0.9, sheen: 0.6 },
  'Fabric':         { key: 'linen', color: '#77726a', rough: 0.95, nrm: 0.6, sheen: 0.5 },
  'Dish Towel':     { key: 'linen', color: '#a9a294', rough: 0.95, nrm: 0.6, sheen: 0.5 },
  'Hoodie Charcoal':{ key: 'knit', color: '#2a2c31', rough: 0.95, nrm: 0.7, sheen: 0.6 },
  'Sock Grey':      { key: 'knit', color: '#6f6f72', rough: 0.95, nrm: 0.6, sheen: 0.6 },
  'Backpack':       { key: 'linen', color: '#1b2533', rough: 0.85, nrm: 0.7, sheen: 0.4 },
  'Laptop Bag':     { key: 'leather', color: '#2a1d14', rough: 0.55, nrm: 0.5 },
  'Shoe Leather':   { key: 'leather', color: '#3a2214', rough: 0.4, nrm: 0.4, coat: 0.3 },
  'Sheer Curtain':  { key: 'linen', color: '#cfc8ba', rough: 0.95, nrm: 0.4, sheen: 0.6, opacity: 0.55 },
  // paper goods (matte)
  'Printer Paper':  { key: 'paper', color: '#e8e5dd', rough: 0.9, nrm: 0.25, repeat: 3 },
  'Book Paper':     { key: 'paper', color: '#ddd6c6', rough: 0.9, nrm: 0.25, repeat: 3 },
  'Envelope':       { key: 'paper', color: '#e6e1d4', rough: 0.9, nrm: 0.25, repeat: 3 },
  'Crumpled Paper': { key: 'paper', color: '#e2ddd2', rough: 0.9, nrm: 0.6, repeat: 3 },
  'Takeout Menu':   { key: 'paper', color: '#d8cfbd', rough: 0.85, nrm: 0.2, repeat: 3 },
  'Cardboard':      { key: 'cardboard', color: '#8a6744', rough: 0.9, nrm: 0.5 },
  'Cardboard Cover':{ key: 'cardboard', color: '#7c5c3c', rough: 0.9, nrm: 0.5 },
  'Kraft Paper':    { key: 'cardboard', color: '#9a7652', rough: 0.9, nrm: 0.4 },
  'Envelope Kraft': { key: 'cardboard', color: '#a07c56', rough: 0.9, nrm: 0.3 },
  'Binder Black':   { key: 'plastic', color: '#161618', rough: 0.5, nrm: 0.2 },
  'Binder Blue':    { key: 'plastic', color: '#1d2f55', rough: 0.5, mapAlbedo: false, nrm: 0.2 },
  'Cork':           { key: 'cork', color: '#7a5634', rough: 0.95, nrm: 0.6 },
  'Sticky Yellow':  { key: 'paper', color: '#e8d25a', rough: 0.85, nrm: 0.2 },
  'Sticky Pink':    { key: 'paper', color: '#e58aa4', rough: 0.85, nrm: 0.2 },
  'Sticky Blue':    { key: 'paper', color: '#7fb6e0', rough: 0.85, nrm: 0.2 },
  // food and liquids
  'Coffee':         { color: '#120804', rough: 0.05, coat: 1.0 },
  'Cold Noodles':   { color: '#b58a4c', rough: 0.45 },
  'Coffee Residue': { color: '#2a160a', rough: 0.3 },
  // Ivan's room (scene s03: blender/scenes/set_room03.py)
  'Wall Green':     { key: 'plaster_wall', color: '#3d5344', rough: 0.92, nrm: 0.5, lm: 0.9 },    // deep bottle green, limewashed (~12% albedo); full bounce
  'Floor Dark Oak': { key: 'oak_floor', color: '#4a2d1c', rough: 0.5, nrm: 0.5, coat: 0.3, coatRough: 0.3 },
  'Bed Walnut':     { key: 'walnut', color: '#3a2214', rough: 0.45, nrm: 0.35, coat: 0.3, coatRough: 0.3 },
  'Blind Slat':     { key: 'plastic', color: '#cfc8b8', rough: 0.5, mapAlbedo: false, nrm: 0.1 },
  'Duvet Navy':     { key: 'linen', color: '#2c3a60', rough: 0.95, nrm: 0.8, sheen: 0.55 },     // navy cotton ~8%: dark, not a hole
  'Mattress':       { key: 'linen', color: '#b9b5ac', rough: 0.95, nrm: 0.5, sheen: 0.3 },
  'Pillow Linen':   { key: 'linen', color: '#aeaa9f', rough: 0.95, nrm: 0.6, sheen: 0.4 },
  'Rug Navy':       { key: 'rug', color: '#24325a', rough: 1.0, nrm: 0.9, sheen: 0.4 },
  'Lamp Ceramic':   { key: 'ceramic', color: '#6a4528', rough: 0.25, nrm: 0.1, coat: 0.5 },
  'Guitar Spruce':  { key: 'light_wood', color: '#a8682e', rough: 0.3, nrm: 0.2, coat: 0.8, coatRough: 0.1 },
  'Guitar Rosewood':{ key: 'walnut', color: '#2a140b', rough: 0.35, nrm: 0.2, coat: 0.8, coatRough: 0.1 },
  'Guitar String':  { key: 'brushed_metal', color: '#b8b3a5', rough: 0.25, metal: 1.0, nrm: 0.1 },
  'Hoodie Grey':    { key: 'knit', color: '#3a3f4a', rough: 0.95, nrm: 0.7, sheen: 0.6 },
  'Tee Olive':      { key: 'linen', color: '#3c3b26', rough: 0.95, nrm: 0.6, sheen: 0.5 },
};

// glass and liquids: real transmission only where the camera looks closely (the hero glass)
const GLASS = {
  // the hero glass: thick enough walls to bend what's behind it, crisp rim reflections, faintly green edges
  // the hero glass: transmission reads as nothing on a dark set, so the glass is drawn the way a lens sees it:
  // a faint body, strong rim reflections of the screens and lamp, and blue-tinted water with a bright meniscus
  'Tumbler Glass': () => new THREE.MeshPhysicalMaterial({ color: 0xcfe3ff, roughness: 0.03, transparent: true, opacity: 0.10,
    specularIntensity: 1, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: true }),   // writes depth: the lens must focus on it
  'Water':         () => new THREE.MeshPhysicalMaterial({ color: 0x7fb0ff, roughness: 0.02, transparent: true, opacity: 0.30,
    specularIntensity: 1, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: 0.0, emissive: 0x0a1c40, emissiveIntensity: 0.6, depthWrite: false }),
  'Glass':         () => new THREE.MeshPhysicalMaterial({ color: 0x9fb0c0, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 1.0 }),
  'Carafe Glass':  () => new THREE.MeshPhysicalMaterial({ color: 0xa0b2c4, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
  'Water Bottle':  () => new THREE.MeshPhysicalMaterial({ color: 0xa0b2c4, roughness: 0.08, transparent: true, opacity: 0.22, depthWrite: false }),
  'Air Bubble':    () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false }),
  'Mirror':        () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 1 }),
};

// ------------------------------------------------------------------------------------------------
// ImageBitmaps decode in the browser's background threads while the rest loads; an <img> would decode on the
// main thread at its first upload (~7-10 s for the 78 maps). Flipped at decode, so flipY stays false.
const loader = new THREE.ImageBitmapLoader();
const bitmapOptions = { imageOrientation: 'flipY', premultiplyAlpha: 'none' };
loader.setOptions(bitmapOptions);
const cache = new Map();
let MAX_ANISO = 8;
export function setAnisotropy(n) { MAX_ANISO = n; }
// preview only: decode the 2K maps smaller (less to upload, a quarter of the GPU memory at 1024)
export function setTextureSize(px) { Object.assign(bitmapOptions, { resizeWidth: px, resizeHeight: px, resizeQuality: 'high' }); }

function tex(key, map, srgb) {
  const id = key + '/' + map;
  if (!cache.has(id)) {
    const t = new THREE.Texture(); t.flipY = false;
    loader.load(TEX_ROOT + id + '.jpg', (img) => { t.image = img; t.needsUpdate = true; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = MAX_ANISO;
    cache.set(id, t);
  }
  return cache.get(id);
}
function scaled(t, rep) {                       // per-material tiling without re-uploading the image
  const c = t.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c;
}

// mean albedo of a texture set, so a target colour can be hit exactly (computed once per key)
const means = new Map();
async function meanOf(key) {
  if (means.has(key)) return means.get(key);
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 32, 32);
      const d = g.getImageData(0, 0, 32, 32).data; const lin = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const v = d[i + k] / 255; lin[k] += v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      res(lin.map((v) => v / (d.length / 4)));
    };
    img.onerror = () => res([0.5, 0.5, 0.5]);
    img.src = TEX_ROOT + key + '/albedo.jpg';
  });
  means.set(key, p);
  return p;
}

let manifest = {};
export async function loadManifest() {
  manifest = await (await fetch(TEX_ROOT + 'manifest.json')).json();
}

// Lightmap-aware shading patch (see header).
function patchBaked(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      #ifdef USE_LIGHTMAP
        float lmLum = dot(lightMapTexel.rgb, vec3(0.2126, 0.7152, 0.0722));
        radiance *= smoothstep(0.0, 0.06, lmLum);      // reflections fade where the room is dark
        iblIrradiance = vec3(0.0);                     // bounce light comes from the lightmap only
      #endif`);
  };
  m.customProgramCacheKey = () => 'baked';
}

export async function build(name, gltfMat, lightMap) {
  let m;
  if (GLASS[name]) m = GLASS[name]();
  else if (LIB[name]) m = await fromLib(name, LIB[name], gltfMat);
  else m = upgrade(gltfMat);
  m.name = name;
  if (lightMap && !m.transparent && !m.transmission) {
    // Cycles diffuse pass = E/pi. lm < 1 on walls: less bounce fill, so live light pools read as shapes (refs)
    m.lightMap = lightMap; m.lightMapIntensity = Math.PI * ((LIB[name] && LIB[name].lm) || 1);
    patchBaked(m);
  }
  return m;
}

async function fromLib(name, d, src) {
  const m = new THREE.MeshPhysicalMaterial({
    roughness: d.rough ?? 0.6, metalness: d.metal ?? 0,
    clearcoat: d.coat ?? 0, clearcoatRoughness: d.coatRough ?? 0.15,
    sheen: d.sheen ?? 0, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff),
  });
  const target = new THREE.Color(d.color || '#808080');           // sRGB hex -> linear working space
  if (d.key) {
    const info = manifest[d.key] || { tile_m: 1 };
    const rep = (d.repeat || 1) / (info.tile_m || 1);
    if (src && src.map && /Printout|Notebook|Paper|Envelope/.test(name)) {
      m.map = src.map;                                             // authored prints keep their artwork
    } else if (d.mapAlbedo !== false) {
      m.map = scaled(tex(d.key, 'albedo', true), rep);
      const mean = await meanOf(d.key);
      target.r /= Math.max(mean[0], 0.02); target.g /= Math.max(mean[1], 0.02); target.b /= Math.max(mean[2], 0.02);
    }
    m.normalMap = scaled(tex(d.key, 'normal', false), rep);
    m.normalScale.set(d.nrm ?? 0.5, d.nrm ?? 0.5);
    m.roughnessMap = scaled(tex(d.key, 'rough', false), rep);
    m.roughness = (d.rough ?? 0.6) / 0.6;                          // maps average ~0.6: factor recentres them
    if (d.sheen) m.sheenColor.copy(target).multiplyScalar(0.6);
  }
  m.color.copy(target);
  if (d.opacity) { m.transparent = true; m.opacity = d.opacity; m.depthWrite = false; m.side = THREE.DoubleSide; m.envMapIntensity = 0.35; }
  if (/Asphalt|Concrete|Own Facade/.test(name)) m.envMapIntensity = 0.04;   // outside: the room's light never reaches it
  return m;
}

// Night facades across the lot: dark render with a scatter of lit windows (warm, some cool, mostly off).
let facadeTex = null;
function facade() {
  if (!facadeTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 512);
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let y = 8; y < 512; y += 32) for (let x = 6; x < 256; x += 26) {
      const v = r(); if (v > 0.16) continue;
      g.fillStyle = v < 0.10 ? `rgb(255,${190 + r() * 40 | 0},${120 + r() * 50 | 0})` : v < 0.14 ? '#aac4ff' : '#ff9a62';
      g.globalAlpha = 0.35 + r() * 0.65; g.fillRect(x, y, 16, 20);
      g.globalAlpha = 0.25; g.fillStyle = '#000'; g.fillRect(x, y + 12 + r() * 6, 16, 3); g.globalAlpha = 1;   // blinds
    }
    facadeTex = new THREE.CanvasTexture(c); facadeTex.colorSpace = THREE.SRGBColorSpace;
    facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping; facadeTex.repeat.set(1 / 8, 1 / 16);   // 8 m x 16 m per tile
  }
  return facadeTex;
}

// Materials not in the library keep Blender's values, made physical (leaves, screens, emissives, prints).
function upgrade(src) {
  if (!src) return new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.6 });
  const name = src.name || '';
  if (/^Facade/.test(name)) {
    return new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.85, emissive: 0xffffff, emissiveMap: facade(),
      emissiveIntensity: 1.3, envMapIntensity: 0.04 });
  }
  if (/Lot Line|Car Paint|Pole/.test(name)) {
    const m = new THREE.MeshPhysicalMaterial({ color: src.color, roughness: /Car/.test(name) ? 0.25 : 0.7, clearcoat: /Car/.test(name) ? 1 : 0,
      metalness: /Car/.test(name) ? 0.5 : 0, envMapIntensity: 0.06 });
    return m;
  }
  if (/Screen/.test(name)) {
    const s = new THREE.MeshPhysicalMaterial({
      // screens at 0.6 of Blender's strength: the white editor page must stay below clipping after the lens
      color: 0x000000, emissive: 0xffffff, emissiveMap: src.emissiveMap || src.map, emissiveIntensity: 0.45 * src.emissiveIntensity,
      roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 0.6,
    });
    return s;
  }
  if (/^Leaf/.test(name)) {
    const l = new THREE.MeshPhysicalMaterial({ color: src.color, roughness: 0.45, side: THREE.DoubleSide, sheen: 0.3,
      sheenColor: new THREE.Color(0x335522), clearcoat: 0.2, clearcoatRoughness: 0.3 });
    return l;
  }
  const m = new THREE.MeshPhysicalMaterial({
    color: src.color, map: src.map || null, roughness: Math.max(0.25, src.roughness ?? 0.6), metalness: src.metalness ?? 0,
    emissive: src.emissive, emissiveMap: src.emissiveMap || null, emissiveIntensity: src.emissiveIntensity ?? 1,
    transparent: src.transparent, opacity: src.opacity, side: src.side,
  });
  // scanned assets (Poly Haven) carry their own normal and roughness maps: keep them
  if (src.normalMap) { m.normalMap = src.normalMap; m.normalScale.copy(src.normalScale); }
  if (src.roughnessMap) { m.roughnessMap = src.roughnessMap; m.roughness = src.roughness ?? 1; }
  // glTF metalness is factor x map: without its map a scanned wood with factor 1 renders as solid metal (no diffuse,
  // so lightmaps cannot light it, and it mirrors the environment)
  if (src.metalnessMap) m.metalnessMap = src.metalnessMap;
  if (src.alphaTest) { m.alphaTest = src.alphaTest; m.side = THREE.DoubleSide; }
  return m;
}
