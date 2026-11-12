// Light bake driver (main thread): gathers occluder triangles + per-vertex sample points from the
// scene, fans the path tracing out to web workers, de-noises on the mesh graph, writes attributes.
import * as THREE from 'three';
import { giMeshes, setGiAttr } from '../core/gi.js';

function visibleDeep(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }

function bakeInfo(mat) {
  const b = mat.userData.bake || {};
  const c = mat.color || new THREE.Color(0.5, 0.5, 0.5);
  const alb = (b.albedo || [c.r, c.g, c.b]).map((x) => Math.min(0.92, x));
  const t = b.trans || 0;
  const tc = b.transColor || alb;
  const two = b.twoSided !== undefined ? b.twoSided : mat.side === THREE.DoubleSide;
  return [alb[0], alb[1], alb[2], t, tc[0], tc[1], tc[2], two ? 1 : 0, b.thru || 0];
}

export async function runBake(root, cfg, { spp = 128, workers = 6, smooth = 1, log = console.log } = {}) {
  const t0 = performance.now();
  root.updateMatrixWorld(true);

  // ---------- occluder soup ----------
  const occ = [];
  let nV = 0, nI = 0;
  root.traverse((o) => {
    if (!o.isMesh || !visibleDeep(o) || o.userData.bakeOccluder === false) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || (mat.userData.bake && mat.userData.bake.ignore)) return;
    const g = o.geometry, inst = o.isInstancedMesh ? o.count : 1;
    const ic = g.index ? g.index.count : g.attributes.position.count;
    occ.push({ o, mat, inst, ic }); nV += g.attributes.position.count * inst; nI += ic * inst;
  });
  const pos = new Float32Array(nV * 3), idx = new Uint32Array(nI), triMat = new Uint16Array(nI / 3);
  const mats = [], matId = new Map(), occBase = new Map();
  let vo = 0, io = 0;
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  for (const { o, mat, inst } of occ) {
    let mi = matId.get(mat);
    if (mi === undefined) { mi = mats.length / 9; matId.set(mat, mi); mats.push(...bakeInfo(mat)); }
    const g = o.geometry, p = g.attributes.position, ind = g.index;
    occBase.set(o, vo);
    for (let k = 0; k < inst; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, im); m4.multiplyMatrices(o.matrixWorld, im); } else m4.copy(o.matrixWorld);
      const base = vo;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m4); pos[vo * 3] = v.x; pos[vo * 3 + 1] = v.y; pos[vo * 3 + 2] = v.z; vo++; }
      const n = ind ? ind.count : p.count;
      for (let i = 0; i < n; i++) { idx[io] = base + (ind ? ind.getX(i) : i); if (i % 3 === 0) triMat[io / 3] = mi; io++; }
    }
  }
  log(`[bake] occluders: ${occ.length} meshes, ${(nI / 3 / 1000).toFixed(0)}k tris, ${mats.length / 9} materials`);

  // ---------- sample points (welded by position+normal) ----------
  const list = giMeshes(root);
  const S = []; // px,py,pz,nx,ny,nz per unique sample
  const key = new Map();
  const edgesA = [], edgesB = [];
  const n3 = new THREE.Matrix3(), nv = new THREE.Vector3(), cen = new THREE.Vector3();
  const sampleId = (px, py, pz, nx, ny, nz) => {
    const k = `${Math.round(px * 5000)},${Math.round(py * 5000)},${Math.round(pz * 5000)},${Math.round(nx * 24)},${Math.round(ny * 24)},${Math.round(nz * 24)}`;
    let id = key.get(k);
    if (id === undefined) { id = S.length / 6; key.set(k, id); S.push(px, py, pz, nx, ny, nz); }
    return id;
  };
  for (const e of list) {
    const o = e.mesh, g = o.geometry;
    if (e.inst) {
      const a = o.userData.giAnchor || new THREE.Vector3(), ln = o.userData.giNormal || new THREE.Vector3(0, 0, 1);
      e.ids = new Uint32Array(e.count); e.idsB = e.back ? new Uint32Array(e.count) : null;
      for (let k = 0; k < e.count; k++) {
        o.getMatrixAt(k, im); m4.multiplyMatrices(o.matrixWorld, im);
        v.copy(a).applyMatrix4(m4); nv.copy(ln).transformDirection(m4);
        e.ids[k] = sampleId(v.x, v.y, v.z, nv.x, nv.y, nv.z);
        if (e.back) e.idsB[k] = sampleId(v.x, v.y, v.z, -nv.x, -nv.y, -nv.z);
      }
      continue;
    }
    const p = g.attributes.position, nr = g.attributes.normal, ind = g.index;
    n3.getNormalMatrix(o.matrixWorld);
    const wp = new Float32Array(p.count * 3), wn = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
      nv.fromBufferAttribute(nr, i).applyMatrix3(n3).normalize(); wn[i * 3] = nv.x; wn[i * 3 + 1] = nv.y; wn[i * 3 + 2] = nv.z;
    }
    // nudge each sample a hair towards the inside of its own surface so points sitting exactly on
    // a seam with another surface can't leak light.
    const nud = new Float32Array(p.count * 3), cnt = new Uint16Array(p.count);
    const nt = ind ? ind.count : p.count;
    for (let i = 0; i < nt; i += 3) {
      const a = ind ? ind.getX(i) : i, b = ind ? ind.getX(i + 1) : i + 1, c = ind ? ind.getX(i + 2) : i + 2;
      cen.set((wp[a * 3] + wp[b * 3] + wp[c * 3]) / 3, (wp[a * 3 + 1] + wp[b * 3 + 1] + wp[c * 3 + 1]) / 3, (wp[a * 3 + 2] + wp[b * 3 + 2] + wp[c * 3 + 2]) / 3);
      for (const q of [a, b, c]) { nud[q * 3] += cen.x; nud[q * 3 + 1] += cen.y; nud[q * 3 + 2] += cen.z; cnt[q]++; }
    }
    e.ids = new Uint32Array(p.count); e.idsB = e.back ? new Uint32Array(p.count) : null;
    for (let i = 0; i < p.count; i++) {
      let px = wp[i * 3], py = wp[i * 3 + 1], pz = wp[i * 3 + 2];
      const nx = wn[i * 3], ny = wn[i * 3 + 1], nz = wn[i * 3 + 2];
      if (cnt[i]) {
        let dx = nud[i * 3] / cnt[i] - px, dy = nud[i * 3 + 1] / cnt[i] - py, dz = nud[i * 3 + 2] / cnt[i] - pz;
        const dn = dx * nx + dy * ny + dz * nz; dx -= dn * nx; dy -= dn * ny; dz -= dn * nz;
        const dl = Math.hypot(dx, dy, dz);
        if (dl > 1e-6) { const s = Math.min(0.0025, dl * 0.3) / dl; px += dx * s; py += dy * s; pz += dz * s; }
      }
      e.ids[i] = sampleId(px, py, pz, nx, ny, nz);
      if (e.back) e.idsB[i] = sampleId(px, py, pz, -nx, -ny, -nz);
    }
    for (let i = 0; i < nt; i += 3) {
      const a = ind ? ind.getX(i) : i, b = ind ? ind.getX(i + 1) : i + 1, c = ind ? ind.getX(i + 2) : i + 2;
      for (const ids of e.back ? [e.ids, e.idsB] : [e.ids]) {
        const A = ids[a], B = ids[b], C = ids[c];
        if (A !== B) { edgesA.push(A); edgesB.push(B); } if (B !== C) { edgesA.push(B); edgesB.push(C); } if (C !== A) { edgesA.push(C); edgesB.push(A); }
      }
    }
  }
  const nS = S.length / 6, SA = new Float32Array(S);
  log(`[bake] ${list.length} lit meshes, ${(nS / 1000).toFixed(0)}k sample points, ${spp} spp, ${workers} workers`);

  // ---------- trace: pass 1 = full path tracing (few samples), pass 2 = final gather against the smoothed pass 1 ----------
  const CH = 3000, jobs = [];
  for (let s = 0; s < nS; s += CH) jobs.push([s, Math.min(nS, s + CH)]);
  const jobMult = jobs.map(([a, b]) => { let out = 0; for (let i = a; i < b; i++) if (SA[i * 6 + 2] < -0.4) out++; let win = 0; for (let i = a; i < b; i++) { const z = SA[i * 6 + 2]; if (z >= -0.4 && z < 0.08) win++; }
    return out > (b - a) * 0.5 ? 0.3 : win > (b - a) * 0.4 ? 3 : 1; });
  const pool = [];
  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise((res, rej) => {
    const wk = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    wk.onerror = rej; wk.onmessage = (ev) => { if (ev.data.type === 'ready') res(); };
    wk.postMessage({ type: 'init', pos, idx, triMat, mats: new Float32Array(mats), cfg, seed: 9001 + w * 7919 });
    pool.push(wk);
  })));
  log(`[bake] workers ready ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  const runPass = (mode, n, label) => new Promise((resolve, reject) => {
    const R = new Float32Array(nS * 7); let next = 0, done = 0;
    for (const wk of pool) {
      const give = () => { if (next >= jobs.length) return; const id = next++, [a, b] = jobs[id]; wk.postMessage({ type: 'job', id, spp: Math.max(4, Math.round(n * jobMult[id])), mode, samples: SA.slice(a * 6, b * 6) }); };
      wk.onerror = reject;
      wk.onmessage = (ev) => {
        if (ev.data.type !== 'done') return;
        R.set(ev.data.out, jobs[ev.data.id][0] * 7); done++;
        if (done % 16 === 0 || done === jobs.length) { window.__bakeProgress = done / jobs.length; if (done % 64 === 0 || done === jobs.length) log(`[bake] ${label} ${((100 * done) / jobs.length).toFixed(0)}%  ${((performance.now() - t0) / 1000).toFixed(0)}s`); }
        if (done === jobs.length) resolve(R); else give();
      };
      give();
    }
  });

  const E = new Float32Array(nS * 3), D = new Float32Array(nS * 3), ok = new Uint8Array(nS);
  const nE = edgesA.length;
  const acc = new Float32Array(nS * 6), wsum = new Float32Array(nS);
  const lum = (i) => 0.2126 * E[i * 3] + 0.7152 * E[i * 3 + 1] + 0.0722 * E[i * 3 + 2];
  // repair samples that sit inside other geometry, then edge-aware smoothing over the mesh graph
  const clean = (R, iters) => {
    for (let i = 0; i < nS; i++) { E[i * 3] = R[i * 7]; E[i * 3 + 1] = R[i * 7 + 1]; E[i * 3 + 2] = R[i * 7 + 2]; D[i * 3] = R[i * 7 + 3]; D[i * 3 + 1] = R[i * 7 + 4]; D[i * 3 + 2] = R[i * 7 + 5]; ok[i] = R[i * 7 + 6]; }
    for (let it = 0; it < 4; it++) {
      acc.fill(0); wsum.fill(0); let bad = 0;
      for (let k = 0; k < nE; k++) {
        const a = edgesA[k], b = edgesB[k];
        if (!ok[a] && ok[b] === 1) { for (let c = 0; c < 3; c++) { acc[a * 6 + c] += E[b * 3 + c]; acc[a * 6 + 3 + c] += D[b * 3 + c]; } wsum[a]++; }
        if (!ok[b] && ok[a] === 1) { for (let c = 0; c < 3; c++) { acc[b * 6 + c] += E[a * 3 + c]; acc[b * 6 + 3 + c] += D[a * 3 + c]; } wsum[b]++; }
      }
      for (let i = 0; i < nS; i++) if (!ok[i] && wsum[i] > 0) { for (let c = 0; c < 3; c++) { E[i * 3 + c] = acc[i * 6 + c] / wsum[i]; D[i * 3 + c] = acc[i * 6 + 3 + c] / wsum[i]; } ok[i] = 2; bad++; }
      for (let i = 0; i < nS; i++) if (ok[i] === 2) ok[i] = 1;
      if (!bad) break;
    }
    for (let it = 0; it < iters; it++) {
      acc.fill(0); wsum.fill(0);
      for (let k = 0; k < nE; k++) {
        const a = edgesA[k], b = edgesB[k];
        const nd = SA[a * 6 + 3] * SA[b * 6 + 3] + SA[a * 6 + 4] * SA[b * 6 + 4] + SA[a * 6 + 5] * SA[b * 6 + 5];
        if (nd < 0.9) continue;
        const la = lum(a), lb = lum(b), dl = (la - lb) / (0.3 * (la + lb) * 0.5 + 1e-4);
        const w = 1 / (1 + dl * dl);
        for (let c = 0; c < 3; c++) { acc[a * 6 + c] += w * E[b * 3 + c]; acc[a * 6 + 3 + c] += w * D[b * 3 + c]; acc[b * 6 + c] += w * E[a * 3 + c]; acc[b * 6 + 3 + c] += w * D[a * 3 + c]; }
        wsum[a] += w; wsum[b] += w;
      }
      for (let i = 0; i < nS; i++) {
        const ws = wsum[i]; if (ws <= 0) continue;
        const self = Math.max(1, ws * 0.6);
        for (let c = 0; c < 3; c++) { E[i * 3 + c] = (E[i * 3 + c] * self + acc[i * 6 + c]) / (self + ws); D[i * 3 + c] = (D[i * 3 + c] * self + acc[i * 6 + 3 + c]) / (self + ws); }
      }
    }
  };

  const spp1 = Math.max(12, Math.min(48, Math.round(spp / 5)));
  clean(await runPass(0, spp1, 'paths'), 3);
  // cache: irradiance/PI per occluder vertex (front and back side)
  const ce = new Float32Array(nV * 3), cb = new Float32Array(nV * 3);
  for (const e of list) {
    const base = occBase.get(e.mesh); if (base === undefined) continue;
    const vc = e.mesh.geometry.attributes.position.count;
    const n = e.inst ? e.count * vc : vc;
    for (let i = 0; i < n; i++) {
      const q = e.inst ? Math.floor(i / vc) : i, sF = e.ids[q], sB = e.back ? e.idsB[q] : sF, o = (base + i) * 3;
      ce[o] = E[sF * 3]; ce[o + 1] = E[sF * 3 + 1]; ce[o + 2] = E[sF * 3 + 2]; cb[o] = E[sB * 3]; cb[o + 1] = E[sB * 3 + 1]; cb[o + 2] = E[sB * 3 + 2];
    }
  }
  await Promise.all(pool.map((wk) => new Promise((res) => { wk.onmessage = (ev) => { if (ev.data.type === 'cached') res(); }; wk.postMessage({ type: 'cache', ce, cb }); })));
  clean(await runPass(1, spp, 'gather'), smooth);
  pool.forEach((wk) => wk.terminate());

  // ---------- write attributes ----------
  for (const e of list) {
    const gi = new Float32Array(e.count * 3), gd = new Float32Array(e.count * 3);
    for (let i = 0; i < e.count; i++) { const s = e.ids[i]; for (let c = 0; c < 3; c++) { gi[i * 3 + c] = E[s * 3 + c]; gd[i * 3 + c] = D[s * 3 + c]; } }
    setGiAttr(e, 'gi', gi); setGiAttr(e, 'gd', gd);
    if (e.back) {
      const gb = new Float32Array(e.count * 3);
      for (let i = 0; i < e.count; i++) { const s = e.idsB[i]; for (let c = 0; c < 3; c++) gb[i * 3 + c] = E[s * 3 + c]; }
      setGiAttr(e, 'giB', gb);
    }
  }
  const secs = (performance.now() - t0) / 1000;
  log(`[bake] done in ${secs.toFixed(1)}s`);
  return { list, secs, samples: nS, tris: nI / 3 };
}
