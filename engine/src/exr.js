// OpenEXR lightmaps, decoded in workers: in parallel and off the main thread (the two 4K lightmaps take ~2 s each
// to decode). The texture is set up exactly as EXRLoader.load would; if a worker fails, the main thread decodes.
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

const MAX = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
let active = 0; const queue = [];
const slot = () => new Promise((res) => (active < MAX ? (active++, res()) : queue.push(res)));
const release = () => { const next = queue.shift(); if (next) next(); else active--; };

function decode(url) {
  return slot().then(() => new Promise((res, rej) => {
    const w = new Worker(new URL('./exr-worker.js', import.meta.url), { type: 'module' });
    const done = () => { w.terminate(); release(); };
    w.onmessage = ({ data }) => { done(); data.error ? rej(new Error(data.error)) : res(data); };
    w.onerror = (e) => { done(); rej(new Error(e.message || 'EXR worker failed')); };
    w.postMessage({ url: new URL(url, location.href).href });
  }));
}

export function loadEXR(url) {
  return decode(url).then((d) => {
    const t = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
    t.colorSpace = d.colorSpace;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false;
    t.needsUpdate = true;
    return t;
  }).catch((e) => {
    console.warn('EXR worker:', e.message, '- decoding on the main thread', url);
    return new Promise((res, rej) => new EXRLoader().load(url, res, undefined, rej));
  });
}
