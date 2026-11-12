// What the bedroom window looks at: deciduous trees (procedural skeleton -> bark tubes + instanced
// leaf cards drawn on a canvas atlas), a lawn with a path and a hedge, neighbour houses with clay-tile
// roofs and a far tree line. Everything is lit by the bake; wind lives in the vertex shaders and is
// driven only by the shared uTime uniform, so any time can be sampled (motion blur, film).
import * as THREE from 'three';
import { RNG, fbm2, clamp, lerp, smoothstep } from '../../core/rng.js';
import { makeCanvas, dataTex, canvasTex, normalData } from '../../core/tex.js';
import { boxAt, merge, mesh, group } from '../../core/geo.js';
import { pbr, sc } from '../materials.js';
import { SKY } from '../sky.js';
import { ROOM } from '../layout.js';

export const order = 5;
export const label = 'outside';

const GROUND = -5.5, UP = [0, 1, 0], Z4 = [0, 0, 0, 0], TAU = Math.PI * 2;
const WD = [0.955, -0.296];                 // wind blows left -> right across the view, slightly away

// ------------------------------------------------------------------ small vector helpers (arrays)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ------------------------------------------------------------------ what can the room see?
// A point outside is visible if some eye position inside the room sees it through both faces of the
// 32 cm deep window opening. 0 = never, 1 = only at steep angles (thin it out), 2 = normal view.
const WN = ROOM.win, WT = ROOM.wallT, EZ = Array.from({ length: 16 }, (_, i) => 0.25 + (3.7 * i) / 15);
function seen(px, py, pz) {
  if (pz > -WT - 0.05) return false;
  const m = 0.1;
  for (let i = 0; i < EZ.length; i++) {
    const ez = EZ[i], k0 = (ez - pz) / -pz, k1 = (ez - pz) / (-WT - pz);
    const xa = Math.max(px + (WN.x0 - m - px) * k0, px + (WN.x0 - m - px) * k1, 0.2), xb = Math.min(px + (WN.x1 + m - px) * k0, px + (WN.x1 + m - px) * k1, 4.6);
    if (xa > xb) continue;
    const ya = Math.max(py + (WN.y0 - m - py) * k0, py + (WN.y0 - m - py) * k1, 0.45), yb = Math.min(py + (WN.y1 + m - py) * k0, py + (WN.y1 + m - py) * k1, 1.9);
    if (ya <= yb) return true;
  }
  return false;
}
function lodAt(x, y, z) {
  if (!seen(x, y, z)) return 0;
  const d = -z, lat = Math.max(WN.x0 - x, x - WN.x1, 0) / d, el = (y - WN.y1) / d;
  return lat > 1.35 || el > 1.2 ? 1 : 2;
}
// Sight corridor from the room to the neighbour's house: keep it mostly free of foliage so the
// red roof and a wedge of sky stay visible between the crowns (as in the reference photo).
function gapKeep(x, y, z, rng) {
  if (y < 0.2 || z > -9 || z < -33) return true;
  const xc = 1.25 + 0.2273 * (2.5 - z), hw = (0.55 + 0.04 * (-z - 9)) * (1 + 0.1 * Math.max(0, y - 2.5));
  const d = Math.abs(x - xc) / hw;
  return d > 1 || rng.next() < 0.05 + Math.max(0, d - 0.75) * 2.5;
}

// ------------------------------------------------------------------ shaders
const f4 = (x) => x.toFixed(4);
const v3s = (a, k = 1) => `vec3(${f4(a[0] * k)}, ${f4(a[1] * k)}, ${f4(a[2] * k)})`;

// Hierarchical wind. aW1 = limb pivot xyz + length, aW2 = branch pivot xyz + length (0 = none),
// aW3 = trunk base x, z + tree height. The same parameters go to a twig's vertices and to the
// leaves that sit on it, so they move together.
const WIND_GLSL = /* glsl */`
uniform float uTime;
attribute vec4 aW1; attribute vec4 aW2; attribute vec4 aW3;
const vec2 W_DIR = vec2(${f4(WD[0])}, ${f4(WD[1])});
float wHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// gust strength 0..1: low-frequency noise over world xz that drifts downwind
float wGust(vec2 xz){
	vec2 q = xz * 0.05 - W_DIR * (uTime * 0.23);
	return smoothstep(0.25, 0.8, wNoise(q) * 0.6 + wNoise(q * 2.6 + 17.3) * 0.4);
}
// one level of the hierarchy: bend about a pivot, growing along the branch
vec3 wSway(vec4 piv, vec3 p, float amp, float rate){
	float w = min(distance(p, piv.xyz) / piv.w, 1.35); w *= sqrt(w);
	float ph = wHash(piv.xz * 3.7 + piv.y) * 6.2832, k = 0.75 + 0.5 * wHash(piv.zy * 5.1 + piv.x);
	float g = wGust(piv.xz), t = uTime * rate * k;
	float s1 = sin(t + ph) + 0.35 * sin(t * 2.13 + ph * 1.7), s2 = cos(t * 0.87 + ph * 2.3), s3 = sin(t * 1.31 + ph * 0.6);
	vec3 wd = vec3(W_DIR.x, 0.0, W_DIR.y), sd = vec3(-W_DIR.y, 0.0, W_DIR.x);
	return (piv.w * w * amp) * ((0.25 + g) * (wd * (0.8 + 0.45 * s1) + sd * (0.4 * s2)) + vec3(0.0, (0.1 + 0.3 * g) * s3 - 0.25 * g, 0.0));
}
vec3 windOffset(vec3 p){
	float hh = clamp((p.y - (${f4(GROUND)})) / aW3.z, 0.0, 1.2); hh *= hh;
	float ph = wHash(aW3.xy * 0.37) * 6.2832;
	vec3 d = vec3(W_DIR.x, 0.0, W_DIR.y) * (hh * (0.012 + 0.05 * wGust(aW3.xy) + 0.014 * sin(uTime * 0.8 + ph) + 0.007 * sin(uTime * 1.43 + ph * 2.1)));
	if (aW1.w > 0.0) d += wSway(aW1, p, 0.008, 2.1);
	if (aW2.w > 0.0) d += wSway(aW2, p, 0.018, 4.3);
	return d;
}`;

// Aerial perspective: fade towards the pale horizon with distance (starts beyond the near trees).
const HAZE = [SKY.horizon[0] * 0.78, SKY.horizon[1] * 0.8, SKY.horizon[2] * 0.82];
const HAZE_FRAG = /* glsl */`
{
	float hz = 1.0 - exp(-max(length(vViewPosition) - 10.0, 0.0) * 0.006);
	outgoingLight = mix(outgoingLight, ${v3s(HAZE)} * giScale * giExt * 0.3, hz);
}
#include <opaque_fragment>`;

function hazeCompile(sh) {
  sh.fragmentShader = '#undef USE_ENVMAP\n' + sh.fragmentShader.replace('#include <opaque_fragment>', HAZE_FRAG);
}
function barkCompile(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + WIND_GLSL)
    .replace('#include <project_vertex>', /* glsl */`
	vec4 mvPosition = modelMatrix * vec4( transformed, 1.0 );
	mvPosition.xyz += windOffset( mvPosition.xyz );
	mvPosition = viewMatrix * mvPosition;
	gl_Position = projectionMatrix * mvPosition;`);
  // round form under a diffuse sky: branches are lighter on top with a damp glint, darker underneath,
  // so twigs read as structure in the gaps between the sprays
  sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', /* glsl */`
{
	vec3 bN = inverseTransformDirection( normal, viewMatrix );
	float bUp = smoothstep( -0.7, 0.8, bN.y );
	outgoingLight *= mix( 0.7, 1.22, bUp );
	outgoingLight += vec3( 0.62, 0.7, 0.86 ) * ( ( 0.015 + 0.1 * pow( 1.0 - abs( dot( normal, normalize( vViewPosition ) ) ), 4.0 ) ) * bUp * dot( vGi, vec3( 0.3333 ) ) * giScale * giExt );
}
#include <opaque_fragment>`);
  hazeCompile(sh);
}
// Leaves: atlas tile lookup (mirrored on half the cards), flutter (twist + nod of each card about its
// stem), rigid ride on the branch it grows from. Shaded per leaflet from the atlas' normal and
// parameter maps: its own tilt towards the sky, a paler matte underside, light coming through thin
// blades, a sky sheen on the glossier ones; then haze.
const LEAF_SHEEN = 1.3;
const leafCompile = (paramMap) => (sh) => {
  sh.uniforms.uLeafP = { value: paramMap };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + WIND_GLSL + '\nattribute vec4 aLeaf;')
    .replace('#include <uv_vertex>', /* glsl */`#include <uv_vertex>
	vMapUv = aLeaf.xy + vec2( mix( uv.x, 1.0 - uv.x, step( 0.5, fract( aLeaf.z * 17.0 ) ) ), 1.0 - uv.y ) * 0.25;
	#ifdef USE_NORMALMAP
	vNormalMapUv = vMapUv;
	#endif`)
    .replace('#include <beginnormal_vertex>', /* glsl */`
	vec3 lAnchor = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	vec3 lOff = windOffset( lAnchor );
	float lG = wGust( lAnchor.xz ) * 0.75 + 0.45 * wNoise( lAnchor.xz * 0.42 - W_DIR * ( uTime * 1.1 ) );
	float lA = aLeaf.w * ( 0.14 + 0.86 * lG ), lP = aLeaf.z * 6.2832;
	float lTw = lA * ( 0.17 * sin( uTime * ( 6.5 + 4.0 * aLeaf.z ) + lP ) + 0.08 * sin( uTime * ( 15.0 + 7.0 * aLeaf.z ) + lP * 2.7 ) );
	float lNod = lA * ( 0.13 * sin( uTime * ( 4.2 + 2.6 * aLeaf.z ) + lP * 1.9 ) + 0.05 * sin( uTime * 11.7 + lP * 4.1 ) - 0.08 );
	float lTy = 0.35 + 0.65 * position.y;
	vec3 objectNormal = normalize( vec3( normal.x - lTw * lTy, normal.y - 2.0 * position.y * lNod, normal.z ) );`)
    .replace('#include <begin_vertex>', /* glsl */`
	vec3 transformed = vec3( position );
	transformed.z += position.x * lTw * lTy + position.y * position.y * lNod;`)
    .replace('#include <project_vertex>', /* glsl */`
	vec4 mvPosition = modelMatrix * ( instanceMatrix * vec4( transformed, 1.0 ) );
	mvPosition.xyz += lOff;
	mvPosition = viewMatrix * mvPosition;
	gl_Position = projectionMatrix * mvPosition;`);
  sh.fragmentShader = '#undef USE_ENVMAP\n' + sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D uLeafP; uniform float uTime;')
    .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
	vec4 lP = texture2D( uLeafP, vMapUv );                                        // r thin blade, g gloss, b random per leaflet
	float lOpen = clamp( dot( vGi + vGiB, vec3( 0.1667 ) ) / 0.4, 0.0, 1.0 );   // 0 deep inside the crown .. 1 open to the sky
	diffuseColor.rgb *= mix( vec3( 0.92, 0.95, 0.92 ), vec3( 1.3, 1.12, 0.8 ), lOpen );   // inner canopy deeper and cooler, outer sprays lighter and yellower
	// the face that looks at the ground is the leaf's underside: paler, greyer, matte
	float lUnder = smoothstep( 0.25, -0.3, inverseTransformDirection( normalize( vNormal ) * ( gl_FrontFacing ? 1.0 : -1.0 ), viewMatrix ).y );
	diffuseColor.rgb = mix( diffuseColor.rgb, mix( diffuseColor.rgb, dot( diffuseColor.rgb, vec3( 0.3, 0.6, 0.1 ) ) * vec3( 0.86, 1.0, 0.98 ), 0.3 ) * 0.74, lUnder );`)
    .replace('#include <opaque_fragment>', /* glsl */`
{
	vec3 lV = normalize( vViewPosition );
	float lnv = abs( dot( normal, lV ) );
	vec3 lNw = inverseTransformDirection( normal, viewMatrix ), lNg = inverseTransformDirection( nonPerturbedNormal, viewMatrix );
	vec3 lgF = gl_FrontFacing ? vGi : vGiB, lgB = gl_FrontFacing ? vGiB : vGi;
	float lE = giScale * giExt, lTilt = lNw.y - lNg.y;
	// every leaflet faces its own way: the ones turned towards the sky are lighter
	outgoingLight *= clamp( 1.0 + 0.6 * lTilt, 0.7, 1.35 );
	// a little extra contrast between sky-lit outer sprays and the crown's interior
	outgoingLight *= clamp( pow( dot( lgF + lgB * 0.5, vec3( 0.3333 ) ) / 0.3, 0.3 ), 0.62, 1.2 );
	// a spray shades itself near the twig it grows from; clumps are darker at their heart
	vec2 lUv = fract( vMapUv * 4.0 );
	float lAo = vMapUv.y < 0.75 ? 1.0 - lUv.y : length( lUv - 0.5 ) * 2.2;
	outgoingLight *= mix( 0.7, 1.08, smoothstep( 0.0, 0.75, lAo ) );
	// light coming through the blade from its far side: thin young leaflets glow yellow-green, thick ones stay opaque
	vec3 lTc = diffuseColor.rgb * vec3( 1.4, 1.15, 0.4 ) + vec3( 0.01, 0.016, 0.0 );
	outgoingLight += lgB * lTc * ( ( 0.3 + 0.7 * lP.r * lP.r ) * clamp( 1.0 - 0.9 * lTilt, 0.5, 1.5 ) * lE );
	// the waxy upper face mirrors the sky: only the glossier leaflets, only where they tilt towards open sky
	vec3 lR = inverseTransformDirection( reflect( -lV, normal ), viewMatrix );
	vec3 lSky = mix( ${v3s(SKY.horizon)}, ${v3s(SKY.zenith)}, sqrt( clamp( lR.y, 0.0, 1.0 ) ) );
	lSky = mix( ${v3s(SKY.horizon, 0.08)}, lSky, smoothstep( -0.15, 0.5, lR.y ) );
	lSky = mix( vec3( dot( lSky, vec3( 0.25, 0.6, 0.15 ) ) ), lSky, 0.4 );
	float lGl = lP.g * mix( 1.0, 0.2, lUnder ) * ( 0.85 + 0.15 * sin( uTime * ( 5.0 + 7.0 * lP.b ) + lP.b * 61.0 ) );
	float lF = 0.04 + 0.22 * pow( 1.0 - lnv, 5.0 ) * smoothstep( 0.1, 0.45, abs( dot( nonPerturbedNormal, lV ) ) );   // no glare off a card seen edge-on
	outgoingLight += lSky * ( lF * lGl * clamp( dot( lgF, vec3( 0.3333 ) ) * 2.4, 0.0, 1.0 ) * lE * float( ${f4(LEAF_SHEEN)} ) );
}
` + HAZE_FRAG);
};

function ext(params, extra = {}) {
  const m = pbr(params, { box: false, onCompile: hazeCompile, key: 'ext-haze', ...extra });
  m.envMapIntensity = 0;
  return m;
}

// ------------------------------------------------------------------ leaf atlas (4 x 4 tiles)
// rows: 0 robinia-like compound sprays, 1 ash-like sprays + single leaves, 2 simple ovate leaves on
// a twig, 3 dense leaf clusters (mid / far trees, hedge). Stem enters each tile at bottom centre.
const TILE_SCALE = [1, 1, 1.35, 1.3, 1, 1.35, 0.8, 0.8, 1, 1, 1, 1, 1, 1, 1, 1];
function buildAtlas() {
  // colour atlas, normal atlas and a per-leaflet parameter atlas (r = thin translucent blade, g = gloss, b = random id)
  const G = 4, T = 512, N = G * T, TN = 512, NN = G * TN, TP = 256, NP = G * TP;
  const cc = makeCanvas(N, N), cn = makeCanvas(NN, NN), cp = makeCanvas(NP, NP);
  const g = cc.getContext('2d', { willReadFrequently: true }), gn = cn.getContext('2d', { willReadFrequently: true }), gp = cp.getContext('2d', { willReadFrequently: true });
  gn.fillStyle = 'rgb(128,128,255)'; gn.fillRect(0, 0, NN, NN);
  gp.fillStyle = 'rgb(70,50,128)'; gp.fillRect(0, 0, NP, NP);
  g.lineCap = g.lineJoin = gp.lineCap = gp.lineJoin = 'round';
  const rng = new RNG(90417);
  const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${clamp(s, 0, 100).toFixed(1)}%,${clamp(l, 0, 100).toFixed(1)}%,${a})`;
  // tangent-space normal colour for a facet tilted by slopes (along, across) on a leaf pointing at `ang`
  const nrmCol = (ang, tA, tC, a = 1) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), sx = tA * ca - tC * sa, sy = tA * sa + tC * ca, il = 1 / Math.hypot(sx, sy, 1);
    return `rgba(${Math.round((-sx * il * 0.5 + 0.5) * 255)},${Math.round((sy * il * 0.5 + 0.5) * 255)},${Math.round((il * 0.5 + 0.5) * 255)},${a})`;
  };
  const SH = { rob: [0.04, 1.2, 0.98, 1.2], ash: [0.22, 1.25, 0.62, 0.72], lime: [-0.02, 1.55, 0.5, 0.95], gen: [0.12, 1.3, 0.7, 0.9] };
  const ROB = { sh: SH.rob, pairs: 7, ll: 0.19, wr: 0.25, ang: 1.15, h: 89, s: 47, l: 36, veins: 0 };
  const ASH = { sh: SH.ash, pairs: 5, ll: 0.3, wr: 0.15, ang: 0.95, h: 97, s: 43, l: 31, veins: 5 };
  const LIME = { sh: SH.lime, h: 95, s: 45, l: 32, veins: 6 };
  const GEN = { sh: SH.gen, h: 96, s: 43, l: 31, veins: 3 };
  const TWIG = 'hsl(42,22%,19%)', RACHIS = 'hsl(72,40%,43%)';

  function leaf(x, y, ang, L, W, sp, shade = 1) {
    // new growth is lighter, yellower, thin and matte; old leaves are darker, thick and often waxy
    const age = rng.next(), young = age < 0.08, old = age > 0.91;
    const h = sp.h + rng.range(-7, 6) - (young ? 5 : old ? -5 : 0), s = sp.s + rng.range(-7, 5) + (young ? 2 : old ? -6 : 0);
    const l = (sp.l + rng.range(-4, 4)) * shade * (young ? 1.1 : old ? 0.9 : 1);
    const fold = rng.range(0.12, 0.5), cup = rng.range(-0.6, 0.45), tip = rng.gauss() * 0.4 - 0.12, tA = rng.gauss() * 0.4, tC = rng.gauss() * 0.4, lit = rng.sign(), sh = sp.sh;
    const thin = clamp((young ? 0.75 : old ? 0.2 : 0.4) + rng.range(-0.15, 0.18)), gloss = young ? rng.range(0.1, 0.45) : rng.chance(0.4) ? rng.range(0.5, 0.9) : rng.range(0.08, 0.35);
    const path = (c, half) => {
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(L * sh[0], W * sh[1], L * sh[2], W * sh[3], L, 0);
      if (half) c.closePath(); else c.bezierCurveTo(L * sh[2], -W * sh[3], L * sh[0], -W * sh[1], 0, 0);
    };
    g.save(); g.translate(x, y); g.rotate(ang);
    g.globalCompositeOperation = 'source-atop';                    // contact shadow on whatever lies underneath
    path(g, 0); g.strokeStyle = 'rgba(6,18,5,0.2)'; g.lineWidth = W * 1.1; g.stroke(); g.lineWidth = W * 0.5; g.stroke();
    g.globalCompositeOperation = 'source-over';
    path(g, 0); g.fillStyle = hsl(h, s, l); g.fill();
    const gl = g.createLinearGradient(0, 0, L, 0);                 // paler towards the stalk, deeper at the tip
    gl.addColorStop(0, 'rgba(250,255,160,0.1)'); gl.addColorStop(0.45, 'rgba(250,255,160,0)'); gl.addColorStop(1, 'rgba(0,25,10,0.1)');
    g.fillStyle = gl; g.fill();
    // V fold: one half catches more sky, the other is shaded most in the crease along the midrib
    for (const [sg, c0, c1] of [[lit, 'rgba(255,255,190,0.02)', 'rgba(255,255,190,0.15)'], [-lit, 'rgba(0,12,0,0.26)', 'rgba(0,12,0,0.04)']]) {
      g.save(); g.scale(1, sg); path(g, 1);
      const gh = g.createLinearGradient(0, 0, 0, W * 0.85); gh.addColorStop(0, c0); gh.addColorStop(1, c1); g.fillStyle = gh; g.fill(); g.restore();
    }
    if (L > 0.04) {                                                // soft blotches: no leaf is one flat colour
      g.save(); path(g, 0); g.clip();
      for (let i = 0; i < 3; i++) {
        const bx = L * rng.range(0.15, 0.9), by = W * rng.range(-0.5, 0.5), br = L * rng.range(0.12, 0.28), gb = g.createRadialGradient(bx, by, 0, bx, by, br), dk = rng.chance(0.5);
        gb.addColorStop(0, dk ? 'rgba(0,20,8,0.14)' : 'rgba(230,255,150,0.1)'); gb.addColorStop(1, dk ? 'rgba(0,20,8,0)' : 'rgba(230,255,150,0)');
        g.fillStyle = gb; g.fillRect(0, -W * 1.3, L, W * 2.6);
      }
      g.restore();
    }
    gp.save(); gp.translate(x, y); gp.rotate(ang); path(gp, 0); gp.fillStyle = `rgb(${Math.round(thin * 255)},${Math.round(gloss * 255)},${rng.int(0, 255)})`; gp.fill(); gp.restore();
    if (sp.veins) {
      g.save(); path(g, 0); g.clip();
      g.strokeStyle = hsl(h - 12, s - 8, l + 12, 0.5); g.lineWidth = Math.max(L * 0.013, 0.002);
      for (let i = 1; i <= sp.veins; i++) {
        const t = (i / (sp.veins + 1)) * 0.9;
        for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(L * t, 0); g.quadraticCurveTo(L * (t + 0.1), sg * W * 0.55, L * (t + 0.27), sg * W * 1.3); g.stroke(); }
      }
      g.restore();
    }
    g.strokeStyle = hsl(h - 14, s - 6, l + 16, 0.8); g.lineWidth = Math.max(L * 0.024, 0.0028);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.95, 0); g.stroke();
    g.restore();
    // relief: the leaflet's own tilt, a V fold along the midrib whose halves cup or roll towards the margin, a curling tip
    gn.save(); gn.translate(x, y); gn.rotate(ang);
    for (const sg of [1, -1]) {
      gn.save(); gn.scale(1, sg); path(gn, 1);
      const gr = gn.createLinearGradient(0, 0, 0, W * 0.9);
      gr.addColorStop(0, nrmCol(ang, tA, tC + sg * fold * 1.3)); gr.addColorStop(0.45, nrmCol(ang, tA, tC + sg * (fold + cup * 0.35))); gr.addColorStop(1, nrmCol(ang, tA, tC + sg * (fold + cup)));
      gn.fillStyle = gr; gn.fill(); gn.restore();
    }
    path(gn, 0);
    const gt = gn.createLinearGradient(L * 0.25, 0, L, 0); gt.addColorStop(0, nrmCol(ang, tA + tip, tC, 0)); gt.addColorStop(1, nrmCol(ang, tA + tip, tC, 0.8));
    gn.fillStyle = gt; gn.fill();
    gn.restore();
  }
  function stem(pts, w, col) {
    for (const c of [g, gp]) {
      c.strokeStyle = c === g ? col : 'rgb(0,30,128)'; c.lineWidth = w; c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
    }
  }
  // curved axis (twig or rachis) -> points [x, y, heading]
  function axis(x, y, ang, len, bend, m = 12) {
    const pts = [], ds = len / m;
    for (let i = 0; i <= m; i++) { pts.push([x, y, ang]); ang += bend / m; x += Math.cos(ang) * ds; y += Math.sin(ang) * ds; }
    return pts;
  }
  const on = (pts, t) => { const f = t * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), r = f - k; return [lerp(pts[k][0], pts[k + 1][0], r), lerp(pts[k][1], pts[k + 1][1], r), pts[k][2]]; };
  // pinnately compound leaf: rachis with opposite leaflet pairs and a terminal leaflet
  function pinnate(x, y, ang, len, sp, shade) {
    const n = sp.pairs + rng.int(-1, 1), pts = axis(x, y, ang, len, rng.range(-0.4, 0.4));
    stem(pts, len * 0.013, RACHIS);
    const st = len * 0.016;                                         // each leaflet sits on a short stalk, clear of the rachis
    for (let i = 0; i < n; i++) {
      const t = 0.16 + (0.77 * i) / (n - 1), q = on(pts, t), ll = len * sp.ll * (0.7 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
      for (const sg of [-1, 1]) {
        const L = ll * rng.range(0.85, 1.1), la = q[2] + sg * (sp.ang + rng.range(-0.2, 0.2)), bx = q[0] + Math.cos(la) * st, by = q[1] + Math.sin(la) * st;
        stem([[q[0], q[1]], [bx, by]], len * 0.007, RACHIS);
        leaf(bx, by, la, L, L * sp.wr, sp, shade * rng.range(0.9, 1.06));
      }
    }
    const e = pts[pts.length - 1], L = len * sp.ll * 0.9; leaf(e[0], e[1], e[2] + rng.range(-0.25, 0.25), L, L * sp.wr, sp, shade);
  }
  const pairTile = (sp) => {
    stem([[0, 0], [0.004, 0.1]], 0.016, TWIG);
    const a = rng.range(0.36, 0.5), first = rng.sign();
    pinnate(0, 0.07, Math.PI / 2 + first * a + rng.range(-0.06, 0.06), rng.range(0.68, 0.75), sp, 0.86);
    pinnate(0.004, 0.1, Math.PI / 2 - first * a + rng.range(-0.06, 0.06), rng.range(0.68, 0.75), sp, 1);
  };
  const sprayTile = (sp) => {
    const first = rng.sign();
    stem([[0, 0], [0.012 * first, 0.2], [-0.008 * first, 0.4]], 0.015, TWIG);
    pinnate(0.004 * first, 0.07, Math.PI / 2 + first * rng.range(0.75, 0.92), 0.47, sp, 0.84);
    pinnate(0.012 * first, 0.21, Math.PI / 2 - first * rng.range(0.7, 0.88), 0.48, sp, 0.93);
    pinnate(-0.008 * first, 0.39, Math.PI / 2 + rng.range(-0.15, 0.15), 0.46, sp, 1.02);
  };
  const fanTile = (sp) => {
    stem([[0, 0], [0, 0.06]], 0.016, TWIG);
    for (const k of [-2, 2, -1, 1, 0]) pinnate(0, 0.05, Math.PI / 2 + k * 0.5 + rng.range(-0.08, 0.08), Math.abs(k) === 2 ? 0.42 : Math.abs(k) === 1 ? 0.56 : 0.62, sp, 0.84 + 0.06 * (2 - Math.abs(k)) + (k === 0 ? 0.06 : 0));
  };
  const singleTile = (sp) => pinnate(0, 0.012, Math.PI / 2 + rng.range(-0.05, 0.05), 0.82, { ...sp, pairs: sp.pairs + 2 }, 1);
  // twig with alternate simple leaves on short petioles
  const simpleTile = (sp, n) => {
    const pts = axis(0, 0, Math.PI / 2 + rng.range(-0.1, 0.1), 0.72, rng.range(-0.35, 0.35), 10);
    stem(pts, 0.014, TWIG);
    const first = rng.sign();
    for (let i = 0; i < n; i++) {
      const t = 0.07 + (0.9 * i) / (n - 1), q = on(pts, t), sg = i % 2 ? first : -first;
      const la = q[2] + sg * rng.range(0.7, 1.15), L = lerp(0.27, 0.19, t) * rng.range(0.85, 1.1);
      const bx = q[0] + Math.cos(la) * 0.035, by = q[1] + Math.sin(la) * 0.035;
      stem([[q[0], q[1]], [bx, by]], 0.008, RACHIS);
      leaf(bx, by, la + rng.range(-0.3, 0.3), L, L * 0.33, sp, 0.82 + 0.2 * t);
    }
    const e = pts[10]; leaf(e[0], e[1], e[2] + rng.range(-0.2, 0.2), 0.2, 0.066, sp, 1.03);
  };
  // foliage mass: a few loose clumps of leaves on twiglets (so the outline is lobed, with sky holes), lower layers darker
  const clusterTile = (n, sp, lobes) => {
    const cs = [];
    for (let i = 0; i < lobes; i++) { const a = (i / lobes) * TAU + rng.range(-0.5, 0.5), r = rng.range(0.1, 0.3); cs.push([Math.cos(a) * r, 0.5 + Math.sin(a) * r, rng.range(0.06, 0.11)]); }
    const tw = cs.map((c) => [[rng.range(-0.03, 0.03), 0.5 + rng.range(-0.03, 0.03)], [c[0] * 0.6 + rng.range(-0.04, 0.04), 0.5 + (c[1] - 0.5) * 0.6 + rng.range(-0.04, 0.04)], [c[0], c[1]]]);
    for (const t of tw) stem(t, 0.011, TWIG);
    for (let i = 0; i < n; i++) {
      if (i === Math.floor(n * 0.55)) for (const t of tw) stem(t, 0.008, TWIG);     // twiglets show between the upper leaves
      const c = cs[rng.int(0, lobes - 1)]; let x, y, k = 0;
      do { x = c[0] + rng.gauss() * c[2]; y = c[1] + rng.gauss() * c[2]; } while (k++ < 20 && (Math.abs(x) > 0.4 || Math.abs(y - 0.5) > 0.4));
      const L = rng.range(0.1, 0.15), a = rng.range(0, TAU);
      leaf(x - Math.cos(a) * L * 0.5, y - Math.sin(a) * L * 0.5, a, L, L * 0.3, sp, 0.6 + 0.45 * (i / n));
    }
  };
  const tiles = [
    () => pairTile(ROB), () => pairTile(ROB), () => sprayTile(ROB), () => fanTile(ROB),
    () => pairTile(ASH), () => sprayTile(ASH), () => singleTile(ASH), () => singleTile(ROB),
    () => simpleTile(LIME, 7), () => simpleTile(LIME, 8), () => simpleTile(LIME, 6), () => simpleTile(LIME, 7),
    () => clusterTile(125, GEN, 6), () => clusterTile(115, GEN, 5), () => clusterTile(85, GEN, 4), () => clusterTile(55, GEN, 3),
  ];
  for (let i = 0; i < 16; i++) {
    const col = i & 3, row = i >> 2;
    for (const [c, s] of [[g, T], [gn, TN], [gp, TP]]) { c.save(); c.beginPath(); c.rect(col * s, row * s, s, s); c.clip(); c.translate((col + 0.5) * s, (row + 0.988) * s); c.scale(s, -s); }
    tiles[i]();
    g.restore(); gn.restore(); gp.restore();
  }

  // ---- colour: un-premultiplied RGBA with leaf colour bled into the empty texels, then a mip chain
  // that keeps each tile's alpha-test coverage (otherwise distant foliage thins out to nothing).
  const base = new Uint8Array(g.getImageData(0, 0, N, N).data.buffer);
  const cov = new Float32Array(16);
  for (let ti = 0; ti < 16; ti++) {
    const x0 = (ti & 3) * T, y0 = (ti >> 2) * T; let r = 0, gg = 0, b = 0, n = 0, c = 0;
    for (let y = y0; y < y0 + T; y++) for (let x = x0; x < x0 + T; x++) { const o = (y * N + x) * 4, a = base[o + 3]; if (a >= 128) c++; if (a > 200) { r += base[o]; gg += base[o + 1]; b += base[o + 2]; n++; } }
    r /= n || 1; gg /= n || 1; b /= n || 1; cov[ti] = c / (T * T);
    for (let y = y0; y < y0 + T; y++) for (let x = x0; x < x0 + T; x++) { const o = (y * N + x) * 4; if (base[o + 3] < 6) { base[o] = r; base[o + 1] = gg; base[o + 2] = b; } }
  }
  const mips = [{ data: base, width: N, height: N }];
  let src = base, n = N; const hist = new Uint32Array(256);
  while (n > 1) {
    const m = n >> 1, dst = new Uint8Array(m * m * 4);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      const o0 = (2 * y * n + 2 * x) * 4, o1 = o0 + 4, o2 = o0 + n * 4, o3 = o2 + 4, o = (y * m + x) * 4;
      const a0 = src[o0 + 3], a1 = src[o1 + 3], a2 = src[o2 + 3], a3 = src[o3 + 3], as = a0 + a1 + a2 + a3;
      if (as > 0) for (let k = 0; k < 3; k++) dst[o + k] = (src[o0 + k] * a0 + src[o1 + k] * a1 + src[o2 + k] * a2 + src[o3 + k] * a3) / as;
      else for (let k = 0; k < 3; k++) dst[o + k] = (src[o0 + k] + src[o1 + k] + src[o2 + k] + src[o3 + k]) >> 2;
      dst[o + 3] = as >> 2;
    }
    const out = new Uint8Array(dst), ts = m / G;
    if (ts >= 1) for (let ti = 0; ti < 16; ti++) {
      const x0 = (ti & 3) * ts, y0 = (ti >> 2) * ts; hist.fill(0);
      for (let y = y0; y < y0 + ts; y++) for (let x = x0; x < x0 + ts; x++) hist[dst[(y * m + x) * 4 + 3]]++;
      let want = cov[ti] * ts * ts, acc = 0, thr = 255;
      while (thr > 1 && acc + hist[thr] <= want) acc += hist[thr--];
      const k = 128 / Math.max(thr, 1);
      if (k > 1) for (let y = y0; y < y0 + ts; y++) for (let x = x0; x < x0 + ts; x++) { const o = (y * m + x) * 4 + 3; out[o] = Math.min(255, dst[o] * k); }
    }
    mips.push({ data: out, width: m, height: m });
    src = dst; n = m;
  }
  const map = dataTex(base, N, N, { srgb: true, wrap: false });
  map.mipmaps = mips; map.generateMipmaps = false; map.needsUpdate = true;
  const normalMap = dataTex(new Uint8Array(gn.getImageData(0, 0, NN, NN).data.buffer), NN, NN, { wrap: false });
  // mean opaque fraction of a card: the bake lets the rest of the rays pass straight through
  let cover = 0; for (let i = 0; i < 16; i++) cover += cov[i] / 16;
  const paramMap = dataTex(new Uint8Array(gp.getImageData(0, 0, NP, NP).data.buffer), NP, NP, { wrap: false });
  return { map, normalMap, paramMap, cover };
}

// ------------------------------------------------------------------ other procedural textures
function barkMaps() {
  const N = 512, H = new Float32Array(N * N), col = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const w = fbm2(u * 4, v * 4, { oct: 3, seed: 61, period: 4 }), w2 = fbm2(u * 24, v * 24, { oct: 2, seed: 67, period: 24 });
    const ridge = Math.pow(Math.abs(Math.sin(Math.PI * (7 * u + 2.2 * w + 0.3 * w2 + 0.25 * Math.sin(TAU * (2 * v + w))))), 0.6);   // meandering vertical furrows
    const crack = (1 - smoothstep(0, 0.14, Math.abs(Math.sin(Math.PI * (5 * v + 3 * w2 + 2 * w))))) * smoothstep(0.45, 0.6, w);
    const h = ridge * 0.85 + (w2 - 0.5) * 0.4 - crack * 0.35, i = y * N + x, k = 0.42 + 0.72 * clamp(h), moss = smoothstep(0.56, 0.34, w) * 0.5;
    H[i] = h;
    col[i * 4] = clamp(lerp(0.37, 0.3, moss) * k) * 255; col[i * 4 + 1] = clamp(lerp(0.33, 0.35, moss) * k) * 255; col[i * 4 + 2] = clamp(lerp(0.28, 0.24, moss) * k) * 255; col[i * 4 + 3] = 255;
  }
  return { map: dataTex(col, N, N, { srgb: true }), normalMap: dataTex(normalData(H, N, N, 3.2), N, N, {}) };
}
function grassTex() {
  const N = 512, c = makeCanvas(N, N), g = c.getContext('2d'), rng = new RNG(551);
  g.fillStyle = 'hsl(84,40%,29%)'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = rng.range(0, N), y = rng.range(0, N), a = rng.range(-0.6, 0.6) - Math.PI / 2, l = rng.range(5, 14), dx = Math.cos(a) * l, dy = Math.sin(a) * l;
    g.strokeStyle = `hsl(${rng.range(64, 104).toFixed(0)},${rng.range(30, 52).toFixed(0)}%,${rng.range(20, 42).toFixed(0)}%)`; g.lineWidth = rng.range(1, 2.3);
    for (const ox of [0, N, -N]) for (const oy of [0, N, -N]) {
      if (x + ox < -16 || x + ox > N + 16 || y + oy < -16 || y + oy > N + 16) continue;
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + dx, y + oy + dy); g.stroke();
    }
  }
  return canvasTex(c, { srgb: true });
}
// clay pantiles: 8 x 8 tiles per repeat (2.4 m across, 2.72 m up the slope)
function roofTex() {
  const N = 512, S = 64, c = makeCanvas(N, N), g = c.getContext('2d'), rng = new RNG(733);
  g.fillStyle = '#3a1c14'; g.fillRect(0, 0, N, N);
  for (let r = -1; r < 9; r++) for (let q = -1; q < 9; q++) {
    const x = q * S + (r & 1) * S * 0.5, y = r * S, k = rng.next();
    const h = rng.range(9, 21), s = k < 0.15 ? rng.range(26, 38) : rng.range(46, 62), l = k < 0.15 ? rng.range(24, 31) : rng.range(33, 45);
    for (const ox of [0, N, -N]) for (const oy of [0, N]) {
      const X = x + ox, Y = y + oy; if (X > N || X + S < 0 || Y > N || Y + S < 0) continue;
      g.fillStyle = `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`; g.fillRect(X + 1, Y, S - 2, S);
      let gr = g.createLinearGradient(X, 0, X + S, 0);       // barrel profile across the tile
      gr.addColorStop(0, 'rgba(0,0,0,0.3)'); gr.addColorStop(0.42, 'rgba(255,235,215,0.1)'); gr.addColorStop(0.8, 'rgba(0,0,0,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.36)');
      g.fillStyle = gr; g.fillRect(X + 1, Y, S - 2, S);
      gr = g.createLinearGradient(0, Y, 0, Y + S);           // shadow under the course above, lit lower lip
      gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.2, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(0.95, 'rgba(255,225,200,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = gr; g.fillRect(X + 1, Y, S - 2, S);
    }
  }
  for (let i = 0; i < 2600; i++) {                             // lichen, dirt
    const x = rng.range(0, N), y = rng.range(0, N), r = rng.range(1, 4), dark = rng.chance(0.65);
    g.fillStyle = dark ? `rgba(30,22,16,${rng.range(0.1, 0.3).toFixed(2)})` : `rgba(170,160,120,${rng.range(0.06, 0.2).toFixed(2)})`;
    g.beginPath(); g.ellipse(x, y, r, r * rng.range(1, 3), 0, 0, TAU); g.fill();
  }
  return canvasTex(c, { srgb: true });
}
function windowTex() {
  const W = 192, Hh = 256, c = makeCanvas(W, Hh), g = c.getContext('2d');
  g.fillStyle = '#e6e5e0'; g.fillRect(0, 0, W, Hh);
  const pane = (x, y, w, h) => {
    const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h); gr.addColorStop(0, '#7f93a6'); gr.addColorStop(0.5, '#4a5866'); gr.addColorStop(1, '#2b333c');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, w, 7); g.fillRect(x, y, 5, h);
    g.fillStyle = 'rgba(235,232,222,0.5)'; g.fillRect(x + w * 0.62, y + 7, w * 0.38, h * 0.82);     // net curtain
  };
  pane(16, 16, 72, 224); pane(104, 16, 72, 224);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, Hh - 8, W, 8);
  return canvasTex(c, { srgb: true, wrap: false });
}
// distant wall of crowns, tiles sideways (64 m per repeat, 20 m tall)
function backdropTex() {
  const W = 2048, Hh = 512, c = makeCanvas(W, Hh), g = c.getContext('2d'), rng = new RNG(1207);
  g.fillStyle = 'hsl(112,30%,13%)'; g.fillRect(0, Hh * 0.52, W, Hh * 0.48);
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 13; i++) {
    const cx = ((i + rng.range(0.1, 0.9)) / 13) * W, rx = rng.range(105, 175), ry = rx * rng.range(0.85, 1.25), cy = Hh * (0.62 - 0.05 * layer) - ry * rng.range(0.35, 0.95) + 60 * layer;
    const hue = rng.range(92, 122), lb = 13 + layer * 3.5;
    for (const ox of [0, W, -W]) {
      if (cx + ox + rx < -20 || cx + ox - rx > W + 20) continue;
      g.fillStyle = `hsl(${hue.toFixed(0)},30%,${(lb - 1).toFixed(0)}%)`; g.beginPath(); g.ellipse(cx + ox, cy, rx * 0.86, ry * 0.86, 0, 0, TAU); g.fill();
    }
    for (let k = 0; k < 330; k++) {
      const a = rng.range(0, TAU), r = Math.sqrt(rng.next()), dx = Math.cos(a) * r * rx, dy = Math.sin(a) * r * ry, up = 0.5 - dy / (2 * ry);
      const col = `hsl(${(hue + rng.range(-10, 10)).toFixed(0)},${rng.range(24, 40).toFixed(0)}%,${(lb + up * 13 + rng.range(-3, 4)).toFixed(0)}%)`, rr = rng.range(4, 9), ra = rng.range(0, 3.1);
      for (const ox of [0, W, -W]) { const X = cx + dx + ox; if (X < -12 || X > W + 12) continue; g.fillStyle = col; g.beginPath(); g.ellipse(X, cy + dy, rr, rr * 0.55, ra, 0, TAU); g.fill(); }
    }
  }
  return canvasTex(c, { srgb: true });
}

// ------------------------------------------------------------------ geometry accumulators
class Bark {
  constructor() { this.p = []; this.n = []; this.uv = []; this.w1 = []; this.w2 = []; this.w3 = []; this.ix = []; this.count = 0; }
  /** tapered tube along pts (parallel-transport frames), winding outwards */
  tube(pts, rad, radial, w1, w2, w3) {
    const m = pts.length, base = this.count, uRep = Math.max(1, Math.round(TAU * rad[0] * 1.6)), W = radial + 1;
    let T = nrm(sub(pts[1], pts[0])), Nn = nrm(cross(T, Math.abs(T[1]) < 0.9 ? UP : [1, 0, 0])), vl = 0;
    for (let i = 0; i < m; i++) {
      T = nrm(sub(pts[Math.min(m - 1, i + 1)], pts[Math.max(0, i - 1)]));
      const d = Nn[0] * T[0] + Nn[1] * T[1] + Nn[2] * T[2]; Nn = nrm([Nn[0] - T[0] * d, Nn[1] - T[1] * d, Nn[2] - T[2] * d]);
      const B = cross(T, Nn), P = pts[i], r = rad[i];
      if (i) vl += Math.hypot(P[0] - pts[i - 1][0], P[1] - pts[i - 1][1], P[2] - pts[i - 1][2]);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU, cs = Math.cos(a), sn = Math.sin(a), nx = cs * Nn[0] + sn * B[0], ny = cs * Nn[1] + sn * B[1], nz = cs * Nn[2] + sn * B[2];
        this.p.push(P[0] + nx * r, P[1] + ny * r, P[2] + nz * r); this.n.push(nx, ny, nz); this.uv.push((j / radial) * uRep, vl * 1.6);
        this.w1.push(w1[0], w1[1], w1[2], w1[3]); this.w2.push(w2[0], w2[1], w2[2], w2[3]); this.w3.push(w3[0], w3[1], w3[2], 0);
      }
    }
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < radial; j++) { const a = base + i * W + j, b = a + W; this.ix.push(a, a + 1, b, b, a + 1, b + 1); }
    this.count += m * W;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aW1', new THREE.Float32BufferAttribute(this.w1, 4)); g.setAttribute('aW2', new THREE.Float32BufferAttribute(this.w2, 4)); g.setAttribute('aW3', new THREE.Float32BufferAttribute(this.w3, 4));
    g.setIndex(this.ix); return g;
  }
}

class Leaves {
  constructor() { this.m = []; this.c = []; this.w1 = []; this.w2 = []; this.w3 = []; this.lf = []; this.n = 0; }
  /** card with its stem at p, growing along unit Y, face normal as close to Zp as possible */
  card(px, py, pz, Y, Zp, len, wid, tile, tint, w1, w2, w3, ph, fl) {
    const d = Zp[0] * Y[0] + Zp[1] * Y[1] + Zp[2] * Y[2];
    let zx = Zp[0] - Y[0] * d, zy = Zp[1] - Y[1] * d, zz = Zp[2] - Y[2] * d, l = Math.hypot(zx, zy, zz);
    if (l < 1e-3) { const c = cross(Y, Math.abs(Y[1]) < 0.9 ? UP : [1, 0, 0]); zx = c[0]; zy = c[1]; zz = c[2]; l = Math.hypot(zx, zy, zz); }
    zx /= l; zy /= l; zz /= l;
    const xx = Y[1] * zz - Y[2] * zy, xy = Y[2] * zx - Y[0] * zz, xz = Y[0] * zy - Y[1] * zx;
    this.m.push(xx * wid, xy * wid, xz * wid, 0, Y[0] * len, Y[1] * len, Y[2] * len, 0, zx * wid, zy * wid, zz * wid, 0, px, py, pz, 1);
    this.c.push(tint[0], tint[1], tint[2]);
    this.w1.push(w1[0], w1[1], w1[2], w1[3]); this.w2.push(w2[0], w2[1], w2[2], w2[3]); this.w3.push(w3[0], w3[1], w3[2], 0);
    this.lf.push((tile & 3) / 4, (tile >> 2) / 4, ph, fl);
    this.n++;
  }
  /** foliage clump card centred on (x, y, z) with normal N */
  blob(x, y, z, N, size, tile, tint, w1, w2, w3, rng, fl) {
    let Y; do { Y = [rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)]; const d = Y[0] * N[0] + Y[1] * N[1] + Y[2] * N[2]; Y = [Y[0] - N[0] * d, Y[1] - N[1] * d, Y[2] - N[2] * d]; } while (Math.hypot(Y[0], Y[1], Y[2]) < 0.2);
    Y = nrm(Y);
    this.card(x - Y[0] * size * 0.5, y - Y[1] * size * 0.5, z - Y[2] * size * 0.5, Y, N, size, size, tile, tint, w1, w2, w3, rng.next(), fl);
  }
  build(mat) {
    const n = this.n, ord = new Uint32Array(n), key = new Float32Array(n);
    for (let i = 0; i < n; i++) { ord[i] = i; const o = i * 16 + 12; key[i] = (this.m[o] - 1.5) ** 2 + (this.m[o + 1] - 1.5) ** 2 + (this.m[o + 2] - 1) ** 2; }
    ord.sort((a, b) => key[a] - key[b]);                           // near cards first: early-z rejects what they hide
    const pick = (srcArr, k) => { const out = new Float32Array(n * k); for (let i = 0; i < n; i++) { const s = ord[i] * k; for (let j = 0; j < k; j++) out[i * k + j] = srcArr[s + j]; } return out; };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([-0.3, 0.14, 0.94, 0.3, 0.14, 0.94, 0.3, -0.14, 0.94, -0.3, -0.14, 0.94], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute('aW1', new THREE.InstancedBufferAttribute(pick(this.w1, 4), 4)); geo.setAttribute('aW2', new THREE.InstancedBufferAttribute(pick(this.w2, 4), 4));
    geo.setAttribute('aW3', new THREE.InstancedBufferAttribute(pick(this.w3, 4), 4)); geo.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(pick(this.lf, 4), 4));
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.instanceMatrix.array.set(pick(this.m, 16)); im.instanceMatrix.needsUpdate = true;
    im.instanceColor = new THREE.InstancedBufferAttribute(pick(this.c, 3), 3);
    im.name = 'leaves'; im.frustumCulled = false;
    im.userData.giInstanced = true; im.userData.giNormal = new THREE.Vector3(0, 0, 1); im.userData.giAnchor = new THREE.Vector3(0, 0.5, 0);
    return im;
  }
}

class Soup {
  constructor() { this.p = []; this.n = []; this.uv = []; this.ix = []; }
  /** tessellated parallelogram p0 + eu*a + ev*b, facing eu x ev. uvs = metres->uv scale, or null for 0..1 */
  quad(p0, eu, ev, maxEdge = 1, uvs = null) {
    const lu = Math.hypot(eu[0], eu[1], eu[2]), lv = Math.hypot(ev[0], ev[1], ev[2]), nu = Math.max(1, Math.ceil(lu / maxEdge)), nv = Math.max(1, Math.ceil(lv / maxEdge));
    const nn = nrm(cross(eu, ev)), base = this.p.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const a = i / nu, b = j / nv;
      this.p.push(p0[0] + eu[0] * a + ev[0] * b, p0[1] + eu[1] * a + ev[1] * b, p0[2] + eu[2] * a + ev[2] * b); this.n.push(nn[0], nn[1], nn[2]);
      if (uvs) this.uv.push(a * lu * uvs[0], b * lv * uvs[1]); else this.uv.push(a, b);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const q = base + j * (nu + 1) + i; this.ix.push(q, q + 1, q + nu + 2, q, q + nu + 2, q + nu + 1); }
  }
  tri(a, b, c) {
    const nn = nrm(cross(sub(b, a), sub(c, a))), base = this.p.length / 3;
    for (const q of [a, b, c]) { this.p.push(q[0], q[1], q[2]); this.n.push(nn[0], nn[1], nn[2]); this.uv.push(0, 0); }
    this.ix.push(base, base + 1, base + 2);
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.ix); return g;
  }
}

// ------------------------------------------------------------------ trees
const SPECIES = {
  // tiles: atlas tiles to pick from, card: spray length (m), droop: how far sprays hang, twig: twig length (m),
  // twigUp: [start, end] vertical pull along a twig, light / deep: per-instance tint range (linear multipliers)
  rob: { tiles: [0, 1, 0, 1, 2, 3, 7], card: 0.36, droop: [0.15, 0.95], twig: 0.95, twigUp: [-0.1, -0.9], droop2: -0.12, sp: 0.042, light: [1.2, 1.08, 0.6], deep: [0.64, 0.8, 0.52] },
  ash: { tiles: [4, 5, 4, 5, 6], card: 0.42, droop: [0.1, 0.75], twig: 0.9, twigUp: [0.1, -0.6], droop2: -0.08, sp: 0.05, light: [1.25, 1.12, 0.58], deep: [0.74, 0.86, 0.5] },
  lime: { tiles: [8, 9, 10, 11], card: 0.31, droop: [0.0, 0.6], twig: 0.85, twigUp: [0.15, -0.45], droop2: -0.05, sp: 0.04, light: [1.02, 1.02, 0.62], deep: [0.56, 0.76, 0.5] },
};
const mix3 = (a, b, t, k = 1) => [(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k, (a[2] + (b[2] - a[2]) * t) * k];

function grow(rng, p0, d0, len, n, up0 = 0, up1 = 0, wig = 0.1) {
  const pts = [p0], tan = [d0], ds = len / n, w = wig * Math.sqrt(ds);
  let p = p0, d = d0;
  for (let i = 1; i <= n; i++) {
    d = nrm([d[0] + rng.gauss() * w, d[1] + lerp(up0, up1, i / n) * ds + rng.gauss() * w * 0.7, d[2] + rng.gauss() * w]);
    p = madd(p, d, ds); pts.push(p); tan.push(d);
  }
  return { pts, tan, len, n };
}
function at(b, t) {
  const f = clamp(t, 0, 1) * b.n, i = Math.min(b.n - 1, Math.floor(f)), k = f - i;
  return [lerp3(b.pts[i], b.pts[i + 1], k), nrm(lerp3(b.tan[i], b.tan[i + 1], k))];
}
/** direction at angle a from tg; phi = 0 is the horizontal side, pi/2 is "up" */
function dirAround(tg, a, phi) {
  let e1 = cross(tg, UP); const l = Math.hypot(e1[0], e1[1], e1[2]);
  e1 = l < 0.2 ? nrm(cross(tg, [1, 0, 0])) : [e1[0] / l, e1[1] / l, e1[2] / l];
  const e2 = cross(e1, tg), ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(phi) * sa, sp = Math.sin(phi) * sa;
  return nrm([tg[0] * ca + e1[0] * cp + e2[0] * sp, tg[1] * ca + e1[1] * cp + e2[1] * sp, tg[2] * ca + e1[2] * cp + e2[2] * sp]);
}

function makeTree(S, bark, LV) {
  const rng = new RNG(S.seed), hero = S.lod === 0;
  const sp = hero ? SPECIES[S.sp] : { light: mix3([1.2, 1.1, 0.6], [0.95, 1.0, 0.62], rng.next()), deep: mix3([0.58, 0.78, 0.52], [0.8, 0.88, 0.5], rng.next()), droop2: -0.06 };
  const H = S.H, top = GROUND + H, w3 = [S.x, S.z, H], T = { S, sp, rng, bark, LV, w3, hero };
  const trunk = grow(rng, [S.x, GROUND - 0.3, S.z], nrm([S.lean[0], 1, S.lean[1]]), H * S.trunk + 0.3, 8, 0, 0, 0.035);
  const r0 = H * 0.019, tr = (t) => r0 * (1 - 0.5 * t) * (1 + 1.1 * Math.exp(-t * 18));
  bark.tube(trunk.pts, trunk.pts.map((_, i) => tr(i / 8)), hero ? 10 : 6, Z4, Z4, w3);
  const limbs = [];
  for (let i = 0; i < S.limbs; i++) {
    const f = i / (S.limbs - 1), ta = lerp(S.first, 1, Math.pow(f, 0.8)), pa = at(trunk, ta)[0];
    const az = S.az0 + i * 2.39996 + rng.range(-0.3, 0.3), inc = lerp(1.2, 0.12, Math.pow(f, 1.25)) + rng.range(-0.1, 0.1);
    let len = (S.R / Math.max(Math.sin(inc), 0.45)) * rng.range(0.8, 1.05);
    len = Math.min(len, ((top - pa[1]) / Math.max(0.35, Math.cos(inc))) * rng.range(0.92, 1));
    limbs.push({ p: pa, d: [Math.sin(inc) * Math.cos(az), Math.cos(inc), Math.sin(inc) * Math.sin(az)], len, up0: 0.2, up1: -0.07, r: tr(ta) });
  }
  for (const e of S.extra || []) {      // art-directed limbs (e.g. one reaching towards the window)
    const pa = at(trunk, e.t)[0], v = sub(e.to, pa), len = Math.hypot(v[0], v[1], v[2]);
    limbs.push({ p: pa, d: nrm([v[0], v[1] + len * 0.1, v[2]]), len, up0: 0, up1: -0.05, r: tr(e.t) });
  }
  for (const Lb of limbs) limb(T, Lb);
}

function limb(T, Lb) {
  const { S, rng, bark, w3, hero } = T, len = Lb.len, n = Math.max(5, Math.round(len / (hero ? 0.45 : 0.9)));
  const b = grow(rng, Lb.p, Lb.d, len, n, Lb.up0, Lb.up1, 0.09);
  const rB = Math.min(Lb.r * 0.8, 0.028 + len * 0.016), w1 = [Lb.p[0], Lb.p[1], Lb.p[2], len], rad = (i) => rB * Math.pow(1 - i / n, 0.75) + 0.011;
  bark.tube(b.pts, b.pts.map((_, i) => rad(i)), hero ? 6 : S.lod === 1 ? 5 : 4, w1, Z4, w3);   // <= 6 around: thin tips stay splittable for the bake's BVH
  if (S.lod === 2) { const p = at(b, 0.6)[0]; foliage(T, b, 0.28, Math.round(len * S.dens), 1.25, 1.5, w1, [p[0], p[1], p[2], len * 0.5], [12, 13, 14]); return; }
  const n2 = Math.max(2, Math.round(len * S.d2));
  for (let j = 0; j < n2; j++) {
    const t = lerp(0.16, 0.99, (j + rng.range(0.15, 0.85)) / n2), [p, tg] = at(b, t);
    const l2 = clamp(len * lerp(0.5, 0.2, t) * rng.range(0.7, 1.15), 0.6, 3.2);
    const d = dirAround(tg, rng.range(0.7, 1.15), j * 2.4 + rng.range(-0.5, 0.5));
    if (d[1] < -0.25) d[1] *= 0.3;
    branch(T, p, nrm(d), l2, Math.min(rad(t * n) * 0.6, 0.012 + l2 * 0.011), w1);
  }
  branch(T, b.pts[n], b.tan[n], clamp(len * 0.18, 0.6, 1.6), 0.013, w1);   // the limb's tip carries on
}

function branch(T, p0, d0, len, r, w1) {
  const { S, sp, rng, bark, w3, hero } = T, n = Math.max(3, Math.round(len / (hero ? 0.4 : 0.7)));
  const b = grow(rng, p0, d0, len, n, 0.14, sp.droop2, 0.17), w2 = [p0[0], p0[1], p0[2], len];
  bark.tube(b.pts, b.pts.map((_, i) => r * Math.pow(1 - i / n, 0.8) + 0.0045), hero ? 4 : 3, w1, w2, w3);
  if (!hero) { foliage(T, b, 0.15, Math.round(len * S.dens), 0.42, S.size, w1, w2, [12, 13, 12, 14]); return; }
  const tw = rng.next(), n3 = Math.round(len * S.d3);
  for (let k = 0; k < n3; k++) {
    const t = lerp(0.1, 0.97, (k + rng.range(0.2, 0.8)) / n3), [p, tg] = at(b, t);
    const d = dirAround(tg, rng.range(0.65, 1.1), (k & 1 ? 0 : Math.PI) + rng.gauss() * 0.65);
    d[1] += 0.08;
    twig(T, p, nrm(d), sp.twig * lerp(1, 0.5, t) * rng.range(0.65, 1.2), w1, w2, tw);
  }
  twig(T, b.pts[n], b.tan[n], sp.twig * 0.7, w1, w2, tw);
}

function twig(T, p0, d0, len, w1, w2, tw) {
  const { S, sp, rng, bark, LV, w3 } = T;
  const b = grow(rng, p0, d0, len, 3, sp.twigUp[0], sp.twigUp[1], 0.28), e = b.pts[3];
  if (e[2] > -2.45 || p0[2] > -2.45) return;                       // nothing closer than ~2.3 m to the glass
  const mx = (p0[0] + e[0]) / 2, my = (p0[1] + e[1]) / 2, mz = (p0[2] + e[2]) / 2;
  if (!gapKeep(mx, my, mz, rng)) return;
  const lod = lodAt(mx, my, mz), out = nrm([mx - S.x, 0, mz - S.z]);
  if (lod === 0) {                                                  // never seen: a big cheap card keeps its shade in the bake
    if (rng.chance(0.55)) LV.blob(mx, my, mz, nrm([rng.gauss() * 0.5, 1, rng.gauss() * 0.5]), sp.card * 2.4, sp.tiles[rng.int(0, sp.tiles.length - 1)], mix3(sp.deep, sp.light, 0.4), w1, w2, w3, rng, 0.6);
    return;
  }
  const r0 = 0.0035 + len * 0.006;
  bark.tube(b.pts, [r0, r0 * 0.75, r0 * 0.5, 0.0024], 3, w1, w2, w3);
  const step = sp.sp * S.sparse * (lod === 1 ? 2.3 : 1), big = lod === 1 ? 1.45 : 1;
  let k = rng.int(0, 1);
  const put = (p, tg, a, tip) => {
    let s = cross(tg, UP); const sl = Math.hypot(s[0], s[1], s[2]); s = sl < 0.15 ? [1, 0, 0] : [s[0] / sl, s[1] / sl, s[2] / sl];
    const u2 = cross(s, tg), sg = k++ & 1 ? 1 : -1, roll = rng.gauss() * 0.75 + 0.25, cr = Math.cos(roll) * sg, sr = Math.sin(roll);
    const ca = Math.cos(a), sa = Math.sin(a);
    const Y = nrm([tg[0] * ca + (s[0] * cr + u2[0] * sr) * sa, tg[1] * ca + (s[1] * cr + u2[1] * sr) * sa - rng.range(sp.droop[0], sp.droop[1]), tg[2] * ca + (s[2] * cr + u2[2] * sr) * sa]);
    const Zp = [out[0] * 0.55 + rng.gauss() * 0.6, 0.7 + rng.gauss() * 0.45, out[2] * 0.55 + rng.gauss() * 0.6];
    const tile = sp.tiles[rng.int(0, sp.tiles.length - 1)], size = sp.card * TILE_SCALE[tile] * rng.range(0.8, 1.2) * big;
    const v = clamp(tw * 0.55 + rng.next() * 0.45 + tip * 0.25 - 0.1);
    const tint = rng.chance(0.025) ? [rng.range(1.2, 1.45), rng.range(1.06, 1.2), 0.5] : mix3(sp.deep, sp.light, v, rng.range(0.8, 1.14));   // the odd yellowing spray
    LV.card(p[0], p[1], p[2], Y, Zp, size, size, tile, tint, w1, w2, w3, rng.next(), 1);
  };
  for (let s = len * 0.1 + rng.range(0, step); s < len; s += step * rng.range(0.75, 1.3)) { const [p, tg] = at(b, s / len); put(p, tg, rng.range(0.55, 1.2), s / len); }
  put(e, b.tan[3], rng.range(0, 0.3), 1);
}

/** clumps of foliage cards scattered around a branch (mid / far trees) */
function foliage(T, b, t0, n, rad, size, w1, w2, tiles) {
  const { S, sp, rng, LV, w3 } = T;
  for (let i = 0; i < n; i++) {
    const p = at(b, lerp(t0, 1, Math.sqrt(rng.next())))[0];
    let ox, oy, oz; do { ox = rng.range(-1, 1); oy = rng.range(-1, 1); oz = rng.range(-1, 1); } while (ox * ox + oy * oy + oz * oz > 1);
    const x = p[0] + ox * rad, y = p[1] + oy * rad * 0.75 + rad * 0.1, z = p[2] + oz * rad;
    if (z > -3 || !gapKeep(x, y, z, rng)) continue;
    const lod = lodAt(x, y, z); if (lod === 0 && rng.next() > 0.3) continue;
    const out = nrm([x - S.x, 0, z - S.z]);
    const N = nrm([out[0] * 0.5 + rng.gauss() * 0.7, 0.55 + rng.gauss() * 0.6, out[2] * 0.5 + rng.gauss() * 0.7]);
    LV.blob(x, y, z, N, size * rng.range(0.75, 1.25), tiles[rng.int(0, tiles.length - 1)], mix3(sp.deep, sp.light, rng.next(), rng.range(0.8, 1.12)), w1, w2, w3, rng, 0.45);
  }
}

const TREES = [
  // hero trees (lod 0): full twig structure + leaf sprays
  { seed: 101, lod: 0, sp: 'rob', x: -2.2, z: -7.5, H: 16, R: 4.3, trunk: 0.5, first: 0.36, limbs: 9, az0: 0.9, lean: [0.03, -0.01], d2: 2.8, d3: 6, sparse: 1, extra: [{ t: 0.62, to: [0.9, 2.9, -3.1] }] },
  { seed: 202, lod: 0, sp: 'lime', x: 1.5, z: -13.5, H: 11.2, R: 3.6, trunk: 0.45, first: 0.4, limbs: 8, az0: 2.1, lean: [-0.02, 0.02], d2: 3.0, d3: 6, sparse: 1 },
  { seed: 303, lod: 0, sp: 'ash', x: 8.1, z: -11.5, H: 10.4, R: 3.5, trunk: 0.45, first: 0.4, limbs: 8, az0: 4.0, lean: [0.04, 0.0], d2: 3.0, d3: 6, sparse: 1 },
];
const MID = [   // x, z, H, R  (lod 1: limbs + branches, foliage clumps)
  [-9.5, -18.5, 12.5, 3.6], [-4.0, -24.5, 13, 3.7], [-1.0, -21.5, 10.5, 3.0], [13.5, -20.5, 12, 3.5], [19.5, -27, 13, 3.8], [-17, -27, 13.5, 3.9],
  [-10, -31, 14, 4.0], [18.5, -33, 12, 3.4], [7.0, -29.5, 5.5, 1.9, 0.5, 13], [12.5, -30.5, 6, 2.1, 0.5, 13], [-13, -9.5, 14, 4.2, 0.52, 22], [18, -8.5, 13, 4.0, 0.52, 22], [-24, -15, 13, 4.0, 0.6, 18], [28, -16, 14, 4.2, 0.6, 18],
];

// ------------------------------------------------------------------ houses
function house(P, x0, zf, w, d, eave, ridge, rng) {
  const ov = 0.45, zr = zf - d / 2, rise = ridge - eave, run = d / 2, ye = eave - (ov * rise) / run, wh = eave - GROUND;
  P.wall.quad([x0, GROUND, zf], [w, 0, 0], [0, wh, 0], 0.9);
  P.wall.quad([x0, GROUND, zf - d], [0, 0, d], [0, wh, 0], 1.2);
  P.wall.tri([x0, eave, zf - d], [x0, eave, zf], [x0, ridge, zr]);
  P.wall.quad([x0 + w, GROUND, zf], [0, 0, -d], [0, wh, 0], 2.5);
  P.wall.tri([x0 + w, eave, zf], [x0 + w, eave, zf - d], [x0 + w, ridge, zr]);
  P.roof.quad([x0 - ov, ye, zf + ov], [w + 2 * ov, 0, 0], [0, ridge - ye, zr - zf - ov], 1.0, [1 / 2.4, 1 / 2.72]);
  P.roof.quad([x0 + w + ov, ye, zf - d - ov], [-(w + 2 * ov), 0, 0], [0, ridge - ye, zr - (zf - d - ov)], 2.5, [1 / 2.4, 1 / 2.72]);
  // white verge boards on the visible gable, eave fascia, ridge cap
  P.trim.quad([x0 - ov, ye - 0.02, zf + ov], [0, ridge - ye, zr - zf - ov], [0, -0.17, 0], 1.5);
  P.trim.quad([x0 - ov, ridge - 0.02, zr], [0, ye - ridge, zf - d - ov - zr], [0, -0.17, 0], 1.5);
  P.trim.quad([x0 - ov, ye - 0.2, zf + ov], [w + 2 * ov, 0, 0], [0, 0.18, 0], 2);
  P.dark.push(boxAt(x0 - ov, ye - 0.1, zf + ov, w + 2 * ov, 0.1, 0.12, { r: 0.02, maxEdge: 2.5 }));                 // gutter
  P.dark.push(boxAt(x0 - ov, ridge - 0.06, zr - 0.12, w + 2 * ov, 0.16, 0.24, { r: 0.06, maxEdge: 2.5 }));          // ridge tiles
  const cx = x0 + w * rng.range(0.62, 0.8);
  P.brick.push(boxAt(cx, ridge - 0.9, zr - 0.2, 0.62, 1.75, 0.5, { r: 0.02, maxEdge: 0.9 }));
  P.dark.push(boxAt(cx - 0.05, ridge + 0.85, zr - 0.25, 0.72, 0.09, 0.6, { r: 0.02 }));
  // windows: rows from under the eave down, facade facing us
  const cols = Math.max(2, Math.round(w / 2.8));
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
    const wx = x0 + (w * (c + 0.5)) / cols - 0.58, wy = eave - 2.25 - r * 2.85;
    if (wy < GROUND + 0.6) continue;
    P.win.quad([wx, wy, zf + 0.03], [1.16, 0, 0], [0, 1.5, 0], 2);
  }
  P.win.quad([x0 - 0.03, eave - 2.25, zr - 0.5], [0, 0, 1.0], [0, 1.35, 0], 2);
  // two roof lights
  const sl = Math.hypot(ridge - ye, zr - zf - ov), su = [0, (ridge - ye) / sl, (zr - zf - ov) / sl], sn = nrm(cross([1, 0, 0], su));
  for (const fx of [0.22, 0.5]) {
    const o = madd(madd([x0 + w * fx, ye, zf + ov], su, sl * 0.42), sn, 0.05);
    P.glass.quad(o, [0.8, 0, 0], madd([0, 0, 0], su, 1.2), 2);
  }
}

// ------------------------------------------------------------------ build
export function build() {
  const t0 = performance.now();
  const G = group('exterior');
  const add = (geo, mat, name, opts) => { const m = mesh(geo, mat, name); if (opts) Object.assign(m, opts); G.add(m); return m; };

  // ---- materials
  const atlas = buildAtlas();
  const leafMat = pbr({ map: atlas.map, normalMap: atlas.normalMap, normalScale: new THREE.Vector2(1, 1), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0 },
    { box: false, back: true, trans: new THREE.Color(0, 0, 0), onCompile: leafCompile(atlas.paramMap), key: 'ext-leaf' });   // transmission is done per leaflet in leafCompile
  leafMat.envMapIntensity = 0;
  const thru = Math.round(clamp(1 - atlas.cover, 0.35, 0.62) * 100) / 100;
  leafMat.userData.bake = { albedo: [0.11, 0.25, 0.04], twoSided: true, trans: 0.25, transColor: [0.3, 0.7, 0.06], thru };
  const bk = barkMaps();
  const barkMat = pbr({ map: bk.map, normalMap: bk.normalMap, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.95 }, { box: false, onCompile: barkCompile, key: 'ext-bark', bake: { albedo: [0.085, 0.075, 0.055] } });
  barkMat.envMapIntensity = 0;
  const grass = grassTex(); grass.repeat.set(1, 1);
  const lawnMat = ext({ map: grass, roughness: 1, vertexColors: true }, { bake: { albedo: [0.06, 0.1, 0.03] } });
  const pathMat = ext({ color: sc(0.45, 0.43, 0.39), roughness: 1, vertexColors: true });
  const hedgeMat = ext({ color: sc(0.26, 0.36, 0.17), roughness: 1 });
  const wallMat = ext({ color: sc(0.87, 0.86, 0.83), roughness: 0.95 });
  const trimMat = ext({ color: sc(0.82, 0.82, 0.8), roughness: 0.8 });
  const darkMat = ext({ color: sc(0.2, 0.2, 0.21), roughness: 0.7 });
  const brickMat = ext({ color: sc(0.52, 0.32, 0.25), roughness: 0.95 });
  const glassMat = ext({ color: sc(0.42, 0.5, 0.58), roughness: 0.4 });
  const roofMat = ext({ map: roofTex(), roughness: 0.9 }, { bake: { albedo: [0.2, 0.06, 0.04] } });
  const winMat = ext({ map: windowTex(), roughness: 0.6 }, { bake: { albedo: [0.3, 0.32, 0.34] } });
  const backMat = ext({ map: backdropTex(), alphaTest: 0.5, roughness: 1 }, { bake: { albedo: [0.03, 0.06, 0.025] } });

  // ---- trees
  const bark = new Bark(), LV = new Leaves();
  for (const S of TREES) makeTree(S, bark, LV);
  const nHero = LV.n;
  const tr = new RNG(8807);
  MID.forEach((m, i) => makeTree({ seed: 500 + i * 13, lod: 1, x: m[0], z: m[1], H: m[2], R: m[3], trunk: 0.5, first: 0.4, limbs: 7, az0: tr.range(0, TAU), lean: [tr.range(-0.05, 0.05), tr.range(-0.05, 0.05)], d2: 1.7, dens: m[5] || 13, size: m[4] || 0.72 }, bark, LV));
  const nMid = LV.n - nHero;
  // far tree line: two loose rows behind the houses
  for (let i = 0; i < 34; i++) {
    const row = i & 1, x = -82 + i * 5.1 + tr.range(-1.8, 1.8), z = (row ? -57 : -47.5) + tr.range(-3, 3), H = tr.range(13, 19);
    makeTree({ seed: 900 + i * 7, lod: 2, x, z, H, R: H * tr.range(0.27, 0.33), trunk: 0.48, first: 0.35, limbs: 8, az0: tr.range(0, TAU), lean: [tr.range(-0.04, 0.04), tr.range(-0.04, 0.04)], dens: 11 }, bark, LV);
  }
  const nFar = LV.n - nHero - nMid;

  // ---- lawn (graded grid: per-vertex light needs vertices where the trees shade it)
  const lines = (a, b, s, lim) => { const o = []; for (let v = a; v <= b + 1e-6; v += s) o.push(v); let st = s; while (o[o.length - 1] < lim) { st *= 1.6; o.push(o[o.length - 1] + st); } st = s; while (o[0] > -lim) { st *= 1.6; o.unshift(o[0] - st); } return o; };
  const xs = lines(-36, 44, 1.6, 260), zs = lines(-62, 1.2, 1.6, 0).filter((z) => z <= 1.3);
  while (zs[0] > -280) zs.unshift(zs[0] - (zs[1] - zs[0]) * 1.6);
  {
    const p = [], nn = [], uv = [], col = [], ix = [], W = xs.length;
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < W; i++) {
      const x = xs[i], z = zs[j], a = fbm2(x * 0.11 + 40, z * 0.11 + 40, { oct: 3, seed: 3 }), b = fbm2(x * 0.035 + 9, z * 0.035 + 9, { oct: 2, seed: 4 });
      p.push(x, GROUND, z); nn.push(0, 1, 0); uv.push(x / 2.5, z / 2.5);
      col.push(0.6 + 0.56 * a + 0.4 * (b - 0.5), 0.62 + 0.38 * a + 0.1 * (b - 0.5), 0.5 + 0.26 * a - 0.3 * (b - 0.5));
    }
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < W - 1; i++) { const q = j * W + i; ix.push(q, q + W, q + 1, q + 1, q + W, q + W + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(ix);
    add(g, lawnMat, 'lawn');
  }
  // ---- gravel path winding past, a clipped hedge behind it, shrubs
  const pathZ = (x) => -17 + 1.3 * Math.sin(x * 0.07 + 0.6);
  {
    const p = [], nn = [], uv = [], col = [], ix = [];
    for (let i = 0; i <= 110; i++) {
      const x = -75 + i * 1.5, zc = pathZ(x);
      for (let k = 0; k < 3; k++) { const z = zc + (k - 1) * 0.85; p.push(x, GROUND + 0.02, z); nn.push(0, 1, 0); uv.push(x, z); const c = 0.85 + 0.3 * fbm2(x * 0.5, z * 0.5, { oct: 2, seed: 6 }) - (k === 1 ? 0 : 0.12); col.push(c, c, c); }
      if (i < 110) { const q = i * 3; ix.push(q, q + 1, q + 3, q + 1, q + 4, q + 3, q + 1, q + 2, q + 4, q + 2, q + 5, q + 4); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(ix);
    add(g, pathMat, 'path');
  }
  const green = [];
  {
    const sec = [[-0.5, 0], [-0.56, 0.85], [-0.42, 1.42], [0, 1.6], [0.42, 1.42], [0.56, 0.85], [0.5, 0]], p = [], ix = [], n = 134;
    const hz = (x) => pathZ(x) - 2.1, hh = (x) => 0.9 + 0.2 * fbm2(x * 0.3, 2, { oct: 2, seed: 12 });
    for (let i = 0; i <= n; i++) { const x = -62 + i, z = hz(x), k = hh(x); for (const s of sec) p.push(x, GROUND + s[1] * k, z + s[0]); }
    for (let i = 0; i < n; i++) for (let k = 0; k < 6; k++) { const q = i * 7 + k; ix.push(q, q + 1, q + 7, q + 1, q + 8, q + 7); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((p.length / 3) * 2), 2));
    green.push(g);
    const hr = new RNG(4242), hedgeLight = [1.0, 1.0, 0.6], hedgeDeep = [0.58, 0.76, 0.5];
    for (let x = -62; x < 72; x += 0.25) for (let k = 0; k < 8; k++) {
      const xx = x + hr.range(0, 0.25), s = hr.range(0.08, 0.92) * 6, si = Math.floor(s), sf = s - si, a = sec[si], b = sec[si + 1], kk = hh(xx);
      const y = GROUND + lerp(a[1], b[1], sf) * kk, dz = lerp(a[0], b[0], sf), z = hz(xx) + dz;
      if (!lodAt(xx, y, z)) continue;
      const N = nrm([hr.gauss() * 0.4, (b[0] - a[0]) + hr.gauss() * 0.3, -(b[1] - a[1]) * kk + hr.gauss() * 0.3]);
      LV.blob(xx, y + N[1] * 0.06, z + N[2] * 0.06, N, hr.range(0.36, 0.52), 12 + hr.int(0, 1), mix3(hedgeDeep, hedgeLight, hr.next(), hr.range(0.8, 1.1)), Z4, Z4, [xx, z, 1e4], hr, 0.7);
    }
    // shrubs: dark core + clump cards that sway a little
    const SHRUBS = [[3.5, -15.2, 1.1, 1.5], [-2.5, -15.6, 1.4, 1.9], [9.5, -15.9, 0.9, 1.2], [5.5, -31.5, 1.3, 2.0], [10.0, -32.5, 1.0, 1.4], [14.5, -32.2, 1.2, 1.7], [-6.5, -12.5, 1.2, 1.6], [12.5, -14.8, 1.3, 1.8],
      [1.5, -27.5, 1.5, 2.2], [-12, -22, 1.4, 2.0], [22, -21, 1.5, 2.1], [6.0, -22.5, 1.1, 1.5]];
    for (const [sx, sz, r, h] of SHRUBS) {
      green.push(new THREE.SphereGeometry(1, 10, 7).scale(r * 0.8, h * 0.5, r * 0.8).translate(sx, GROUND + h * 0.45, sz));
      const w2 = [sx, GROUND, sz, h], tint0 = hr.next();
      for (let i = 0; i < 280; i++) {
        let N; do { N = [hr.range(-1, 1), hr.range(-0.2, 1), hr.range(-1, 1)]; } while (N[0] * N[0] + N[1] * N[1] + N[2] * N[2] > 1 || N[0] * N[0] + N[1] * N[1] + N[2] * N[2] < 0.1);
        N = nrm(N);
        const k = hr.range(0.8, 1.02), x = sx + N[0] * r * k, y = GROUND + h * 0.45 + N[1] * h * 0.55 * k, z = sz + N[2] * r * k;
        if (!lodAt(x, y, z)) continue;
        LV.blob(x, y, z, nrm([N[0] + hr.gauss() * 0.4, N[1] + 0.3 + hr.gauss() * 0.4, N[2] + hr.gauss() * 0.4]), hr.range(0.34, 0.5), 12 + hr.int(0, 1), mix3([0.58, 0.78, 0.52], [1.15, 1.08, 0.6], clamp(tint0 + hr.range(-0.3, 0.3)), hr.range(0.8, 1.1)), Z4, w2, [sx, sz, 1e4], hr, 0.7);
      }
    }
  }
  add(merge(green), hedgeMat, 'hedge');

  // ---- houses
  const P = { wall: new Soup(), roof: new Soup(), trim: new Soup(), win: new Soup(), glass: new Soup(), dark: [], brick: [] };
  const hrng = new RNG(31);
  house(P, 4.5, -34, 11, 9, 3.0, 6.3, hrng);
  house(P, -24, -44, 9.5, 8, 2.2, 5.2, hrng);
  house(P, 23, -46, 12, 9, 2.7, 6.1, hrng);
  add(P.wall.geo(), wallMat, 'houseWalls'); add(P.roof.geo(), roofMat, 'houseRoofs'); add(P.trim.geo(), trimMat, 'houseTrim');
  add(P.win.geo(), winMat, 'houseWindows'); add(P.glass.geo(), glassMat, 'houseRoofLights');
  add(merge(P.dark), darkMat, 'houseDark'); add(merge(P.brick), brickMat, 'houseChimneys');

  // ---- far wall of crowns closing the horizon
  {
    const R = 100, n = 56, nv = 4, p = [], nn = [], uv = [], ix = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= n; i++) {
      const th = lerp(-1.52, 1.52, i / n);
      p.push(1.5 + R * Math.sin(th), GROUND + (20 * j) / nv, -R * Math.cos(th)); nn.push(-Math.sin(th), 0, Math.cos(th)); uv.push((th * R) / 64, j / nv);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < n; i++) { const q = j * (n + 1) + i; ix.push(q, q + 1, q + n + 2, q, q + n + 2, q + n + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix);
    add(g, backMat, 'backdrop');
  }

  // ---- bark + leaves
  add(bark.geo(), barkMat, 'bark', { frustumCulled: false });
  G.add(LV.build(leafMat));

  let tris = 0; G.traverse((o) => { if (o.isMesh) tris += ((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1); });
  console.log(`[boot] exterior ${(performance.now() - t0).toFixed(0)} ms: ${tris} tris, leaf cards ${LV.n} (hero ${nHero}, mid ${nMid}, far ${nFar}), bark tris ${bark.ix.length / 3}, card cover ${atlas.cover.toFixed(2)} -> thru ${thru}`);
  return G;
}
