// Assembles the whole scene. Each module adds a named group; order is deterministic so baked
// lighting can be matched back to meshes.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { makeMaterials } from './materials.js';
import { buildRoom } from './room.js';
import { buildSky, SKY } from './sky.js';

const optional = import.meta.glob('./parts/*.js');

export async function buildScene(onProgress = () => {}) {
  const scene = new THREE.Scene();
  const ctx = { M: makeMaterials(), rng: new RNG(20261112), scene, colliders: [], animated: [] };
  onProgress('walls');
  scene.add(buildRoom(ctx));
  scene.add(buildSky());
  // parts/*.js each export `order` and `build(ctx)`; they are loaded in `order`.
  const only = new URLSearchParams(location.search).get('only');
  const want = only ? only.split(',') : null;
  const mods = [];
  for (const p in optional) {
    const name = p.split('/').pop().replace('.js', '');
    if (want && !want.includes(name)) continue;
    mods.push(await optional[p]());
  }
  mods.sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const m of mods) {
    onProgress(m.label || 'things');
    const g = await m.build(ctx);
    if (g) scene.add(g);
    await new Promise((r) => setTimeout(r, 0));
  }
  ctx.bake.sky = SKY; ctx.bake.maxDepth = 9;
  return { scene, ctx };
}
