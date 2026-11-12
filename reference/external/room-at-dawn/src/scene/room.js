// Room shell: walls, floor, ceiling, window (frame, sash, glass, handle, sill), baseboards, door.
import * as THREE from 'three';
import { ROOM } from './layout.js';
import { roundedBox, boxAt, gridPlane, merge, mesh, group, cyl, tube, lathe } from '../core/geo.js';
import { GI } from '../core/gi.js';
import { sc, pbr } from './materials.js';

function axisLines(a, b, cuts, maxEdge) {
  const pts = [a, ...cuts.filter((c) => c > a && c < b), b].sort((p, q) => p - q), out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.max(1, Math.ceil((pts[i + 1] - pts[i]) / maxEdge));
    for (let k = 0; k < n; k++) out.push(pts[i] + ((pts[i + 1] - pts[i]) * k) / n);
  }
  out.push(b); return out;
}
/** Plane in XY (facing +Z), origin at lower-left, optional rectangular holes. UV in metres. */
export function holedPlane(w, h, holes, maxEdge) {
  const xs = axisLines(0, w, holes.flatMap((o) => [o.x0, o.x1]), maxEdge), ys = axisLines(0, h, holes.flatMap((o) => [o.y0, o.y1]), maxEdge);
  const id = new Int32Array(xs.length * ys.length).fill(-1), pos = [], uv = [], nor = [], idx = [];
  const vid = (i, j) => { const k = j * xs.length + i; if (id[k] < 0) { id[k] = pos.length / 3; pos.push(xs[i], ys[j], 0); nor.push(0, 0, 1); uv.push(xs[i], ys[j]); } return id[k]; };
  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (holes.some((o) => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1)) continue;
    const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}

// Glass: a sealed double-glazed unit. Fresnel reflection of the (box-projected) room from two slightly bowed
// panes, plus a very thin film of dust that gathers along the gasket and in the bottom corners.
// Optional vertex attribute `psize` (vec2, pane size in metres) keeps the dust pattern in real-world scale.
export function glassMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { envMap: { value: null }, giBoxMin: GI.uniforms.giBoxMin, giBoxMax: GI.uniforms.giBoxMax, giProbePos: GI.uniforms.giProbePos, uDirt: { value: 1 }, uTint: { value: new THREE.Color(0.86, 0.93, 0.9) } },
    vertexShader: /* glsl */`
      attribute vec2 psize;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec2 vS;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vS = psize.x > 0.0 ? psize : vec2(1.0); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform samplerCube envMap; uniform vec3 giBoxMin, giBoxMax, giProbePos; uniform float uDirt; uniform vec3 uTint;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec2 vS;
      float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.03; a *= .5; } return s; }
      vec3 roomAt(vec3 R, float lod){
        vec3 r1 = (giBoxMax - vW) / R, r2 = (giBoxMin - vW) / R, rm = max(r1, r2);
        return textureLod(envMap, normalize(vW + R * min(min(rm.x, rm.y), rm.z) - giProbePos), lod).rgb;
      }
      void main(){
        vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); if (dot(N, V) < 0.0) N = -N;
        float f = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        // the two panes of a sealed unit are never flat or parallel: reflections bend and split towards the edges
        vec3 bow = vec3((vUv - 0.5) * vec2(0.034, 0.024), 0.0);
        vec3 Ra = reflect(-V, normalize(N + bow)), Rb = reflect(-V, normalize(N - bow * 0.7 + vec3(0.003, 0.002, 0.0)));
        vec3 refl = (roomAt(Ra, 0.5) * 0.6 + roomAt(Rb, 1.5) * 0.4) * uTint;
        float fr = 1.0 - pow(1.0 - f, 3.0);                           // four glass/air surfaces
        // dust: thin overall film, more where the cloth never reaches (gasket, bottom corners), faint wiping
        // arcs, a little dried rain on the outside, a few specks
        vec2 p = vUv * vS, e2 = min(p, vS - p);
        float haze = fbm(p * 3.1 + 7.0);
        float edge = smoothstep(0.06, 0.0, min(e2.x, e2.y));
        float corner = smoothstep(0.2, 0.0, length(vec2(e2.x, p.y)));
        vec2 q = p + vec2(0.25, 0.45);
        float wipe = smoothstep(0.45, 0.8, fbm(vec2(length(q) * 30.0, atan(q.y, q.x) * 3.0)));
        float streak = smoothstep(0.62, 0.95, fbm(vec2(p.x * 150.0, p.y * 2.0))) * smoothstep(0.35, 0.8, fbm(vec2(p.x * 9.0, p.y * 0.7 + 3.0)));
        vec2 sp = p * 150.0, ci = floor(sp);
        float speck = step(0.94, h(ci + 5.1)) * smoothstep(0.2, 0.06, length(fract(sp) - 0.5 - (vec2(h(ci), h(ci + 17.3)) - 0.5) * 0.5));
        float dirt = uDirt * (0.006 + 0.012 * haze * haze + 0.020 * edge * (0.4 + haze) + 0.022 * corner * haze + 0.005 * wipe * haze + 0.006 * streak + 0.02 * speck);
        // dust scatters the bright sky: a faint pale veil in front of the outside
        vec3 veil = vec3(0.50, 0.60, 0.74) * dirt;
        float a = clamp(f * 0.9 + dirt * 0.7, 0.0, 1.0);
        gl_FragColor = vec4(refl * fr + veil, a);
      }`,
  });
  m.userData.bake = { ignore: true };
  m.userData.isGlass = true;
  return m;
}

export function buildRoom(ctx) {
  const { M } = ctx, { W, D, H, wallT, win } = ROOM;
  const g = group('room');
  const add = (geo, mat, name, opts = {}) => { const m = mesh(geo, mat, name); Object.assign(m.userData, opts); g.add(m); return m; };

  // ---- shell
  add(gridPlane(W, D, 0.03).rotateX(-Math.PI / 2).translate(W / 2, 0, D / 2), M.floor, 'floor');
  add(gridPlane(W, D, 0.06).rotateX(Math.PI / 2).translate(W / 2, H, D / 2), M.ceiling, 'ceiling');
  add(holedPlane(W, H, [win], 0.04), M.wall, 'wallWindow');
  add(gridPlane(W, H, 0.045).rotateY(Math.PI).translate(W / 2, H / 2, D), M.wall, 'wallBack');
  add(gridPlane(D, H, 0.045).rotateY(Math.PI / 2).translate(0, H / 2, D / 2), M.wall, 'wallLeft');
  add(gridPlane(D, H, 0.045).rotateY(-Math.PI / 2).translate(W, H / 2, D / 2), M.wall, 'wallRight');

  // ---- window reveal (the wall is 32 cm thick)
  const ww = win.x1 - win.x0, wh = win.y1 - win.y0;
  const reveal = [
    gridPlane(wallT, wh, 0.03).rotateY(Math.PI / 2).translate(win.x0, (win.y0 + win.y1) / 2, -wallT / 2),
    gridPlane(wallT, wh, 0.03).rotateY(-Math.PI / 2).translate(win.x1, (win.y0 + win.y1) / 2, -wallT / 2),
    gridPlane(ww, wallT, 0.03).rotateX(Math.PI / 2).translate((win.x0 + win.x1) / 2, win.y1, -wallT / 2),
    gridPlane(ww, wallT, 0.03).rotateX(-Math.PI / 2).translate((win.x0 + win.x1) / 2, win.y0, -wallT / 2),
  ];
  add(merge(reveal), M.wall, 'reveal');

  // ---- light-tight building body for the bake + facade
  const B = M.blocker, mg = 0.5;
  const blk = [
    gridPlane(W + 2 * mg, D + 2 * mg, 2).rotateX(-Math.PI / 2).translate(W / 2, -0.03, D / 2),
    gridPlane(W + 2 * mg, D + 2 * mg, 2).rotateX(Math.PI / 2).translate(W / 2, H + 0.03, D / 2),
    gridPlane(D + 2 * mg, H + 2 * mg, 2).rotateY(Math.PI / 2).translate(-0.03, H / 2, D / 2),
    gridPlane(D + 2 * mg, H + 2 * mg, 2).rotateY(-Math.PI / 2).translate(W + 0.03, H / 2, D / 2),
    gridPlane(W + 2 * mg, H + 2 * mg, 2).rotateY(Math.PI).translate(W / 2, H / 2, D + 0.03),
  ];
  add(merge(blk), B, 'blocker', { gi: false });
  // facade: big wall plane with the window hole, a storey above and two below
  const fx = 6, fy0 = 7.5, fy1 = 3.5;
  add(holedPlane(W + 2 * fx, H + fy0 + fy1, [{ x0: W + fx - win.x1, x1: W + fx - win.x0, y0: win.y0 + fy0, y1: win.y1 + fy0 }], 2).rotateY(Math.PI).translate(W + fx, -fy0, -wallT), M.exteriorWall, 'facade', { gi: false });

  // ---- window frame (anthracite), fixed light on the left, tilt/turn sash on the right
  const fz0 = win.frameZ0, fz1 = win.frameZ1, fd = fz1 - fz0, fw = 0.062;
  const fr = [];
  const bar = (x, y, w, h, z0 = fz0, d = fd, r = 0.004) => boxAt(x, y, z0, w, h, d, { r, rs: 2, maxEdge: 0.12 });
  fr.push(bar(win.x0, win.y0, fw, wh), bar(win.x1 - fw, win.y0, fw, wh));
  fr.push(bar(win.x0, win.y0, ww, fw), bar(win.x0, win.y1 - fw, ww, fw));
  fr.push(bar(win.mullion - 0.04, win.y0, 0.08, wh));
  // glazing beads on the fixed light (thin inner step)
  const bx0 = win.x0 + fw, bx1 = win.mullion - 0.04, by0 = win.y0 + fw, by1 = win.y1 - fw, bd = 0.018, bz = fz1 - 0.028;
  fr.push(bar(bx0, by0, bd, by1 - by0, bz, 0.02, 0.003), bar(bx1 - bd, by0, bd, by1 - by0, bz, 0.02, 0.003), bar(bx0, by0, bx1 - bx0, bd, bz, 0.02, 0.003), bar(bx0, by1 - bd, bx1 - bx0, bd, bz, 0.02, 0.003));
  add(merge(fr), M.frame, 'winFrame');
  // sash: overlaps the frame, sits proud of it towards the room
  const sx0 = win.mullion + 0.012, sx1 = win.x1 - 0.03, sy0 = win.y0 + 0.03, sy1 = win.y1 - 0.03, sw = 0.074, sz0 = fz1 - 0.035, sdp = 0.052;
  const sash = [];
  sash.push(bar(sx0, sy0, sw, sy1 - sy0, sz0, sdp, 0.006), bar(sx1 - sw, sy0, sw, sy1 - sy0, sz0, sdp, 0.006), bar(sx0, sy0, sx1 - sx0, sw, sz0, sdp, 0.006), bar(sx0, sy1 - sw, sx1 - sx0, sw, sz0, sdp, 0.006));
  add(merge(sash), M.frame, 'winSash');
  // rubber gaskets: a slightly darker, matte line where glass meets profile
  const gk = [];
  const gz = win.glassZ + 0.004;
  const gasket = (x0, y0, x1, y1, t = 0.007) => { gk.push(bar(x0, y0, t, y1 - y0, gz, 0.012, 0.002), bar(x1 - t, y0, t, y1 - y0, gz, 0.012, 0.002), bar(x0, y0, x1 - x0, t, gz, 0.012, 0.002), bar(x0, y1 - t, x1 - x0, t, gz, 0.012, 0.002)); };
  gasket(bx0 + bd, by0 + bd, bx1 - bd, by1 - bd); gasket(sx0 + sw, sy0 + sw, sx1 - sw, sy1 - sw);
  add(merge(gk), M.rubber, 'winGasket');
  // tilt-turn handle on the sash stile next to the mullion: oblong rosette, round neck, flat grip pointing down (closed)
  const hx = sx0 + sw / 2, hy = (sy0 + sy1) / 2 - 0.02, hz = sz0 + sdp;
  const hg = [
    boxAt(hx - 0.015, hy - 0.034, hz, 0.03, 0.068, 0.009, { r: 0.0045, rs: 3 }),
    cyl(0.009, 0, 0.034, 16).rotateX(Math.PI / 2).translate(hx, hy, hz + 0.004),
    boxAt(hx - 0.0095, hy - 0.116, hz + 0.03, 0.019, 0.128, 0.0125, { r: 0.006, rs: 4 }),
  ];
  add(merge(hg), M.handle || M.frame, 'winHandle');

  // glass (two lights). UV 0..1 across each pane, `psize` = pane size in metres for the dust pattern.
  const glass = glassMaterial(); ctx.glass = glass;
  const pane = (x0, y0, x1, y1, name) => {
    const p = new THREE.PlaneGeometry(x1 - x0, y1 - y0).translate((x0 + x1) / 2, (y0 + y1) / 2, win.glassZ);
    const ps = new Float32Array(p.attributes.position.count * 2); for (let i = 0; i < ps.length; i += 2) { ps[i] = x1 - x0; ps[i + 1] = y1 - y0; }
    p.setAttribute('psize', new THREE.BufferAttribute(ps, 2));
    const m = add(p, glass, name, { gi: false }); m.renderOrder = 5; return m;
  };
  pane(bx0, by0, bx1, by1, 'glassL'); pane(sx0 + sw - 0.01, sy0 + sw - 0.01, sx1 - sw + 0.01, sy1 - sw + 0.01, 'glassR');

  // ---- interior sill board: laminated chipboard with a rounded nose, overhangs the wall by 4 cm
  const sillW = ww + 0.1;
  add(boxAt(win.x0 - 0.05, win.y0 - 0.028, fz1 - 0.01, sillW, 0.03, -fz1 + 0.01 + 0.045, { r: 0.012, rs: 4, maxEdge: 0.016 }), M.sill, 'sill');

  // ---- baseboards
  const bb = [], bh = 0.07, bt = 0.014, br = { r: 0.005, rs: 3, maxEdge: 0.1 };
  bb.push(boxAt(0, 0, 0, W, bh, bt, br), boxAt(0, 0, D - bt, W, bh, bt, br), boxAt(0, 0, 0, bt, bh, D, br));
  bb.push(boxAt(W - bt, 0, 0, bt, bh, ROOM.door.z0 - 0.07, br), boxAt(W - bt, 0, ROOM.door.z1 + 0.07, bt, bh, D - ROOM.door.z1 - 0.07, br));
  add(merge(bb), M.baseboard, 'baseboards');

  // ---- door on the right wall (closed): architrave + flush leaf + lever handle
  const dz0 = ROOM.door.z0, dz1 = ROOM.door.z1, dh = ROOM.door.h, aw = 0.065, at = 0.018;
  const arch = [boxAt(W - at, 0, dz0 - aw, at, dh + aw, aw, { r: 0.004, maxEdge: 0.08 }), boxAt(W - at, 0, dz1, at, dh + aw, aw, { r: 0.004, maxEdge: 0.08 }), boxAt(W - at, dh, dz0 - aw, at, aw, dz1 - dz0 + 2 * aw, { r: 0.004, maxEdge: 0.08 })];
  add(merge(arch), M.baseboard, 'doorFrame');
  add(boxAt(W - 0.012, 0.008, dz0 + 0.003, 0.012, dh - 0.01, dz1 - dz0 - 0.006, { r: 0.002, maxEdge: 0.06 }), M.whiteMatte, 'doorLeaf');
  const lh = 1.03, lz = dz0 + 0.075;
  const lever = [
    // (cyl() runs from y0 to y1, so after the rotation each piece extends from the leaf face into the room)
    cyl(0.026, 0, 0.007, 24).rotateZ(Math.PI / 2).translate(W - 0.012, lh, lz),
    cyl(0.0095, 0, 0.05, 16).rotateZ(Math.PI / 2).translate(W - 0.012, lh, lz),
    tube([new THREE.Vector3(W - 0.057, lh, lz), new THREE.Vector3(W - 0.06, lh, lz + 0.02), new THREE.Vector3(W - 0.06, lh, lz + 0.12)], 0.0095, { tubular: 14, radial: 12 }),
    cyl(0.024, 0, 0.006, 24).rotateZ(Math.PI / 2).translate(W - 0.012, lh - 0.085, lz),
  ];
  add(merge(lever), M.metal, 'doorHandle');

  // ---- light switch + sockets (system-55 style: 81 mm frame, 56 mm centre plate)
  // rocker = true: the centre is a rocker, tilted a few degrees. Otherwise it is the flat centre plate of a
  // socket (the well itself is added in the detail pass below). Same tessellation either way.
  const plate = (x, y, z, ry, twin, rocker = false) => {
    const centre = (ox) => (rocker
      ? roundedBox(0.056, 0.056, 0.005, { r: 0.002, rs: 2 }).rotateX(0.045).translate(ox, 0, 0.0105)
      : boxAt(ox - 0.028, -0.028, 0.009, 0.056, 0.056, 0.0008, { r: 0.002, rs: 2 }));
    const parts = [boxAt(-0.0405, -0.0405, 0, 0.081, 0.081, 0.009, { r: 0.004, rs: 3 }), centre(0)];
    if (twin) parts.push(boxAt(0.0405, -0.0405, 0, 0.081, 0.081, 0.009, { r: 0.004, rs: 3 }), centre(0.081));
    const m = add(merge(parts), M.plasticWhite, 'plate'); m.position.set(x, y, z); m.rotation.y = ry; return m;
  };
  plate(W, 1.08, dz0 - 0.2, -Math.PI / 2, false, true);  // switch by the door
  plate(3.2, 0.32, 0, 0, true);                          // sockets under the desk
  plate(0, 0.3, 1.65, Math.PI / 2, false);               // socket by the bed

  // ================================================================================================
  // Detail pass. Everything below is its own NEW mesh (appended, never merged into the meshes above),
  // so the per-vertex light bake of the existing shell stays valid.
  // ================================================================================================
  const silicone = M.silicone || M.plasticWhite, caulk = M.caulk || M.baseboard, dark = M.shadowGap || M.rubber, hardware = M.handle || M.frame;

  // silicone joint between the window frame and the plastered reveal / the sill board: a small fillet in the corner
  const sealY0 = win.y0 + 0.002, fil = 0.0068, fo = { r: 0.0012, rs: 1, maxEdge: 0.12 };
  add(merge([
    roundedBox(fil, win.y1 - sealY0, fil, fo).rotateY(Math.PI / 4).translate(win.x0, (win.y1 + sealY0) / 2, fz1),
    roundedBox(fil, win.y1 - sealY0, fil, fo).rotateY(Math.PI / 4).translate(win.x1, (win.y1 + sealY0) / 2, fz1),
    roundedBox(ww, fil, fil, fo).rotateX(Math.PI / 4).translate((win.x0 + win.x1) / 2, win.y1, fz1),
    roundedBox(ww, fil, fil, fo).rotateX(Math.PI / 4).translate((win.x0 + win.x1) / 2, sealY0, fz1),
  ]), silicone, 'winSeal');

  // rebate gasket / shadow gap where the sash closes against the frame
  const sg = 0.0016, sgd = 0.0028, sgr = 0.0008;
  add(merge([
    bar(sx0 - sg, sy0 - sg, 2 * sg, sy1 - sy0 + 2 * sg, fz1, sgd, sgr), bar(sx1 - sg, sy0 - sg, 2 * sg, sy1 - sy0 + 2 * sg, fz1, sgd, sgr),
    bar(sx0 - sg, sy0 - sg, sx1 - sx0 + 2 * sg, 2 * sg, fz1, sgd, sgr), bar(sx0 - sg, sy1 - sg, sx1 - sx0 + 2 * sg, 2 * sg, fz1, sgd, sgr),
  ]), M.rubber, 'winSashSeal');

  // hinge covers on the hinge side of the sash (corner bearing at the bottom, stay bearing at the top)
  const hc = { r: 0.0055, rs: 3 };
  add(merge([boxAt(sx1 + 0.0005, sy0 + 0.014, fz1 - 0.002, 0.017, 0.062, 0.022, hc), boxAt(sx1 + 0.0005, sy1 - 0.084, fz1 - 0.002, 0.017, 0.07, 0.022, hc)]), hardware, 'winHinges');

  // welded mitre seams of the PVC profiles: hairlines across the corners of sash and frame
  const mit = [], mitre = (cx, cy, len, z, a) => mit.push(roundedBox(len, 0.0013, 0.0008, { r: 0.0003, rs: 1 }).rotateZ(a).translate(cx, cy, z));
  const sf = sz0 + sdp, sl = (sw - 0.013) * Math.SQRT2, fl = (fw - 0.009) * Math.SQRT2, q4 = Math.PI / 4;
  mitre(sx0 + sw / 2, sy0 + sw / 2, sl, sf, q4); mitre(sx1 - sw / 2, sy1 - sw / 2, sl, sf, q4); mitre(sx1 - sw / 2, sy0 + sw / 2, sl, sf, -q4); mitre(sx0 + sw / 2, sy1 - sw / 2, sl, sf, -q4);
  mitre(win.x0 + fw / 2, win.y0 + fw / 2, fl, fz1, q4); mitre(win.x1 - fw / 2, win.y1 - fw / 2, fl, fz1, q4); mitre(win.x1 - fw / 2, win.y0 + fw / 2, fl, fz1, -q4); mitre(win.x0 + fw / 2, win.y1 - fw / 2, fl, fz1, -q4);
  add(merge(mit), M.rubber, 'winMitres');

  // door: two lift-off hinges on the hinge side (the leaf opens into the room)
  const dhx = W - 0.012 - 0.0075, dhz = dz1 - 0.002, dhr = 0.0072, hinges = [];
  for (const yc of [0.245, dh - 0.245]) hinges.push(cyl(dhr, yc - 0.05, yc - 0.0008, 16).translate(dhx, 0, dhz), cyl(dhr, yc + 0.0008, yc + 0.05, 16).translate(dhx, 0, dhz));
  add(merge(hinges), M.metal, 'doorHinges');

  // hairline of painted-over acrylic between the skirting boards and the wall
  const cq = { r: 0.0008, rs: 1, maxEdge: 0.12 }, cy = bh - 0.0056, ch = 0.0053, cw = 0.0052;
  add(merge([
    boxAt(0, cy, 0, W, ch, cw, cq), boxAt(0, cy, D - cw, W, ch, cw, cq), boxAt(0, cy, 0, cw, ch, D, cq),
    boxAt(W - cw, cy, 0, cw, ch, ROOM.door.z0 - 0.07, cq), boxAt(W - cw, cy, ROOM.door.z1 + 0.07, cw, ch, D - ROOM.door.z1 - 0.07, cq),
  ]), caulk, 'bbCaulk');

  // sockets: raised collar + shallow well on the centre plate, two pin holes
  const rims = [], gaps = [];
  const socket = (x, y, z, ry, n) => {
    const mtx = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    for (let k = 0; k < n; k++) {
      const ox = k * 0.081;
      rims.push(
        lathe([[0.0238, 0.0094], [0.0238, 0.0118], [0.0228, 0.0128], [0.0206, 0.0128], [0.0196, 0.0121], [0.0196, 0.0101]], 28).rotateX(Math.PI / 2).translate(ox, 0, 0).applyMatrix4(mtx),
        new THREE.CircleGeometry(0.0197, 28).translate(ox, 0, 0.0101).applyMatrix4(mtx));
      for (const s of [-1, 1]) gaps.push(new THREE.CircleGeometry(0.0026, 12).translate(ox + s * 0.0095, 0, 0.0104).applyMatrix4(mtx));
    }
  };
  socket(3.2, 0.32, 0, 0, 2); socket(0, 0.3, 1.65, Math.PI / 2, 1);
  add(merge(rims), M.plasticWhite, 'socketRims');

  // dark insides: the joint around the door leaf, the gap under it, the key hole, the socket pin holes
  const go = { r: 0.0004, rs: 1, maxEdge: 0.3 };
  gaps.push(
    boxAt(W - 0.0065, 0, dz0 - 0.0002, 0.0065, dh, 0.0034, go), boxAt(W - 0.0065, 0, dz1 - 0.0032, 0.0065, dh, 0.0034, go),
    boxAt(W - 0.0065, dh - 0.0024, dz0, 0.0065, 0.0026, dz1 - dz0, go), boxAt(W - 0.009, 0.0002, dz0, 0.009, 0.0078, dz1 - dz0, go),
    cyl(0.0034, 0, 0.0008, 12).rotateZ(Math.PI / 2).translate(W - 0.018, lh - 0.082, lz),
    boxAt(W - 0.0188, lh - 0.093, lz - 0.0014, 0.0008, 0.011, 0.0028, { r: 0.0003, rs: 1 }),
  );
  add(merge(gaps), dark, 'shadowGaps');

  ctx.bake = {
    portal: { x0: win.x0, x1: win.x1, y0: win.y0, y1: win.y1, z: 0, area: ww * wh },
    room: [0.0005, 0.0005, 0.0005, W - 0.0005, H - 0.0005, D - 0.0005],
  };
  ctx.roomBox = { min: new THREE.Vector3(0, 0, 0), max: new THREE.Vector3(W, H, D) };
  return g;
}
