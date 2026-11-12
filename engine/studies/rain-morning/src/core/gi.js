// Baked global illumination plumbing.
// Lighting is path traced once on the CPU (src/bake) and stored per vertex as:
//   gi  : irradiance / PI for the surface normal        (vec3)
//   gd  : cosine-weighted mean direction of that light  (vec3, world space) -> lets normal maps shade
//   giB : irradiance / PI for the flipped normal        (vec3, only translucent two-sided things)
// Materials are regular MeshStandard/Physical materials patched to read those attributes instead of lights.
// The environment map is kept for specular only and is box-projected onto the room so reflections line up.
import * as THREE from 'three';

export const GI = {
  uniforms: {
    giBoxMin: { value: new THREE.Vector3(-1, -1, -1) },
    giBoxMax: { value: new THREE.Vector3(1, 1, 1) },
    giProbePos: { value: new THREE.Vector3() },
    giScale: { value: 1 },
    giK: { value: 1.6 },
    giSpecOcc: { value: 0.012 },
    giFallback: { value: new THREE.Color(0, 0, 0) },
    giExt: { value: 0.3 },
    uTime: { value: 0 },
    giCandlePos: { value: new THREE.Vector3(0, -100, 0) },
    giCandleCol: { value: new THREE.Color(0, 0, 0) },      // intensity: irradiance (W-ish) at 1 m
    giCandleOcc: { value: new THREE.Vector4(0, -100, 0, 0) }, // jar axis x, wax top y, z, radius: light below the wax is cut off
  },
};

// ---- global shader chunk patches (guarded by defines, harmless for unpatched materials) ----
{
  const C = THREE.ShaderChunk;
  C.lights_fragment_maps = C.lights_fragment_maps.replace(
    'iblIrradiance += getIBLIrradiance( geometryNormal );',
    '#ifndef USE_GI\n\t\t\tiblIrradiance += getIBLIrradiance( geometryNormal );\n\t\t\t#endif');
  const before = C.envmap_physical_pars_fragment;
  C.envmap_physical_pars_fragment = before
    .replace('vec3 getIBLRadiance(', `#ifdef GI_BOXPROJ
	uniform vec3 giBoxMin; uniform vec3 giBoxMax; uniform vec3 giProbePos;
	vec3 giBoxProject( vec3 v ) {
		vec3 r1 = ( giBoxMax - vGiW ) / v; vec3 r2 = ( giBoxMin - vGiW ) / v; vec3 rm = max( r1, r2 );
		float d = min( min( rm.x, rm.y ), rm.z );
		return normalize( vGiW + v * d - giProbePos );
	}
	#endif
	vec3 getIBLRadiance(`)
    .replace(/(vec3 getIBLRadiance\([\s\S]*?reflectVec = transformDirectionByInverseViewMatrix\( reflectVec, viewMatrix \);)/,
      '$1\n\t\t\t#ifdef GI_BOXPROJ\n\t\t\treflectVec = giBoxProject( reflectVec );\n\t\t\t#endif');
  if (C.envmap_physical_pars_fragment === before || !C.envmap_physical_pars_fragment.includes('reflectVec = giBoxProject'))
    console.warn('[gi] envmap chunk patch did not apply — three.js version mismatch?');
}

const VERT_DECL = `
#ifdef USE_GI
attribute vec3 gi; attribute vec3 gd;
varying vec3 vGi; varying vec3 vGd; varying vec3 vGiW;
#ifdef GI_BACK
attribute vec3 giB; varying vec3 vGiB;
#endif
#endif
`;
const VERT_MAIN = `
#ifdef USE_GI
{
	vec4 gw = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
	gw = instanceMatrix * gw;
	#endif
	gw = modelMatrix * gw; vGiW = gw.xyz; vGi = gi; vGd = ( viewMatrix * vec4( gd, 0.0 ) ).xyz;
	#ifdef GI_BACK
	vGiB = giB;
	#endif
}
#endif
`;
const FRAG_DECL = `
#ifdef USE_GI
varying vec3 vGi; varying vec3 vGd; varying vec3 vGiW;
uniform float giScale; uniform float giK; uniform float giSpecOcc; uniform vec3 giFallback; uniform vec3 giTrans; uniform float giExt;
uniform vec3 giCandlePos; uniform vec3 giCandleCol; uniform vec4 giCandleOcc;
#ifdef GI_BACK
varying vec3 vGiB;
#endif
#endif
`;
const FRAG_LIGHT = `
#include <lights_fragment_maps>
#ifdef USE_GI
{
	#ifdef GI_BACK
	vec3 gF = gl_FrontFacing ? vGi : vGiB; vec3 gBk = gl_FrontFacing ? vGiB : vGi;
	#else
	vec3 gF = vGi;
	#endif
	if ( dot( vGd, vGd ) > 1e-6 && gl_FrontFacing ) {
		float ga = dot( normal, vGd ); float gb = dot( nonPerturbedNormal, vGd );
		gF *= clamp( ( 1.0 + giK * ga ) / max( 0.3, 1.0 + giK * gb ), 0.0, 2.5 );
	}
	#ifdef GI_BACK
	gF += gBk * giTrans;
	#endif
	gF = gF * giScale + giFallback;
	if ( vGiW.z < -0.33 ) gF *= giExt;
	irradiance += gF * PI;
	{
		// the lit candle: a warm point light, unshadowed except by its own jar of wax
		vec3 cl = giCandlePos - vGiW; float cd2 = max( dot( cl, cl ), 0.0004 );
		vec3 cdv = ( viewMatrix * vec4( cl * inversesqrt( cd2 ), 0.0 ) ).xyz;
		float cocc = 1.0;
		if ( vGiW.y < giCandleOcc.y && giCandlePos.y > giCandleOcc.y ) {
			float ct = ( giCandleOcc.y - vGiW.y ) / ( giCandlePos.y - vGiW.y ); vec3 cq = vGiW + cl * ct;
			cocc = smoothstep( giCandleOcc.w * 0.8, giCandleOcc.w * 1.25, length( cq.xz - giCandleOcc.xz ) );
		}
		#ifdef GI_BACK
		float cnl = abs( dot( normal, cdv ) ) * ( dot( normal, cdv ) > 0.0 ? 1.0 : 0.6 );
		#else
		float cnl = max( dot( normal, cdv ), 0.0 );
		#endif
		irradiance += giCandleCol * ( cnl * cocc / cd2 );
	}
	#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	radiance *= smoothstep( 0.0, giSpecOcc, dot( gF, vec3( 0.3333 ) ) );
	#endif
}
#endif
`;

/** Patch a Standard/Physical material to use baked GI.
 *  opts.back   : two-sided translucency (reads giB), opts.trans = THREE.Color transmission tint
 *  opts.box    : box-project reflections (default true; turn off for things outside the room)
 *  opts.onCompile(shader) + opts.key : extra shader edits (wind etc.) */
export function giPatch(mat, opts = {}) {
  mat.defines = mat.defines || {};
  mat.defines.USE_GI = '';
  if (opts.back) mat.defines.GI_BACK = '';
  if (opts.box !== false) mat.defines.GI_BOXPROJ = '';
  const giTrans = { value: opts.trans || new THREE.Color(0, 0, 0) };
  mat.userData.giTrans = giTrans;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, GI.uniforms, { giTrans });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>' + VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + FRAG_DECL)
      .replace('#include <lights_fragment_maps>', FRAG_LIGHT);
    if (opts.onCompile) opts.onCompile(shader);
  };
  mat.customProgramCacheKey = () => 'gi|' + (opts.key || '');
  return mat;
}

/** Stable list of meshes that carry baked lighting, in deterministic traversal order. */
export function giMeshes(root) {
  const out = [], seen = new Map();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.userData.gi === false) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.defines || m.defines.USE_GI === undefined) return;
    let path = o.name || 'mesh';
    for (let p = o.parent; p && p !== root; p = p.parent) path = (p.name || 'g') + '/' + path;
    const n = seen.get(path) || 0; seen.set(path, n + 1);
    const inst = !!(o.isInstancedMesh && o.userData.giInstanced);
    out.push({ mesh: o, key: path + '#' + n, inst, back: m.defines.GI_BACK !== undefined, count: inst ? o.count : o.geometry.attributes.position.count });
  });
  return out;
}

function setAttr(entry, name, arr) {
  const g = entry.mesh.geometry;
  g.setAttribute(name, entry.inst ? new THREE.InstancedBufferAttribute(arr, 3) : new THREE.BufferAttribute(arr, 3));
}

/** Serialise baked attributes (half floats) -> ArrayBuffer. */
export function packBake(list, meta = {}) {
  const man = { version: 1, meta, meshes: [] };
  let total = 0;
  for (const e of list) { const per = e.back ? 9 : 6; man.meshes.push({ key: e.key, count: e.count, off: total, back: e.back }); total += e.count * per; }
  const json = new TextEncoder().encode(JSON.stringify(man));
  const pad = (4 - ((8 + json.length) % 4)) % 4;
  const buf = new ArrayBuffer(8 + json.length + pad + total * 2);
  const dv = new DataView(buf); dv.setUint32(0, 0x47494231, true); dv.setUint32(4, json.length, true);
  new Uint8Array(buf, 8, json.length).set(json);
  const data = new Uint16Array(buf, 8 + json.length + pad, total);
  let o = 0;
  for (const e of list) {
    const g = e.mesh.geometry;
    for (const name of e.back ? ['gi', 'gd', 'giB'] : ['gi', 'gd']) {
      const a = g.attributes[name].array;
      for (let i = 0; i < a.length; i++) data[o++] = THREE.DataUtils.toHalfFloat(Math.max(-60000, Math.min(60000, a[i])));
    }
  }
  return buf;
}

/** Apply a baked file to the scene. Returns {ok, applied, stale}. */
export function applyBake(root, buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x47494231) return { ok: false, reason: 'bad magic' };
  const jl = dv.getUint32(4, true);
  const man = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl)));
  const pad = (4 - ((8 + jl) % 4)) % 4;
  const data = new Uint16Array(buf, 8 + jl + pad);
  const byKey = new Map(man.meshes.map((m) => [m.key, m]));
  let applied = 0, stale = 0;
  for (const e of giMeshes(root)) {
    const m = byKey.get(e.key);
    if (!m || m.count !== e.count || m.back !== e.back) { stale++; zeroGi(e); continue; }
    let o = m.off;
    for (const name of e.back ? ['gi', 'gd', 'giB'] : ['gi', 'gd']) {
      const arr = new Float32Array(e.count * 3);
      for (let i = 0; i < arr.length; i++) arr[i] = THREE.DataUtils.fromHalfFloat(data[o++]);
      setAttr(e, name, arr);
    }
    applied++;
  }
  return { ok: true, applied, stale, meta: man.meta };
}

function zeroGi(e) {
  for (const name of e.back ? ['gi', 'gd', 'giB'] : ['gi', 'gd']) {
    const arr = new Float32Array(e.count * 3);
    if (name !== 'gd') arr.fill(0.06);
    setAttr(e, name, arr);
  }
}
/** Give every GI mesh flat placeholder lighting (used before a bake exists). */
export function placeholderGi(root) { for (const e of giMeshes(root)) zeroGi(e); }
export { setAttr as setGiAttr };

/** Capture the room into a PMREM environment for box-projected specular reflections. */
export function captureEnv(renderer, scene, pos, boxMin, boxMax, size = 256) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.03, 200, rt);
  cam.position.copy(pos);
  const prev = scene.environment; scene.environment = null;
  cam.update(renderer, scene);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromCubemap(rt.texture).texture;
  pm.dispose(); rt.dispose();
  if (prev) prev.dispose?.();
  scene.environment = env;
  GI.uniforms.giProbePos.value.copy(pos); GI.uniforms.giBoxMin.value.copy(boxMin); GI.uniforms.giBoxMax.value.copy(boxMax);
  return env;
}
