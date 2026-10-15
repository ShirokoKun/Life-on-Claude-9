// Ivan's skin and hair: one treatment for every scene he plays in (main.js loadCast; the old intro keeps its own).
// Why he read pale, grey, plastic and pasted on (scenes/03-ivan-room/DIRECTION.md §4-5):
//  1. complementary keys on one face: the amber lamp and the blue screens cancel to grey where they overlap. On his
//     skin, light keeps only part of its gel saturation; the set keeps its gels (a cleaner key on the actor)
//  2. no bounce: envMapIntensity was 0.15, so the room's own light never reached his shadows. The room capture fills
//     him now
//  3. skin shaded like plaster: Lambert stops dead at the terminator. A wrap term pushes red-orange light past it
//     (subsurface scattering, cheaply)
//  4. no occlusion and no surface detail: the Tripo mesh has neither (its normal map is flat 0.5, 0.5, 1.0).
//     prep_tripo.bake_shading stores a Cycles AO bake (R) and a hair mask (G) per vertex; a tiled micro-normal breaks
//     up the skin's highlights
//  5. hair the same tan as his skin and lit like clay: under the mask it is darker, richer and occluded deep in
//     every curl, with its own soft sheen
// URL tuning: ?skin=0 (off) ?skinSat ?skinEnv ?skinSSS ?skinNrm ?skinAO ?hairK
import * as THREE from 'three';

let MICRO = null;
function microNormal() {
  if (MICRO) return MICRO;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const h = new Float32Array(N * N);
  const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) >>> 0; n = (n ^ (n >>> 13)) * 1274126177 >>> 0; return (n & 0xffff) / 0xffff; };
  const sm = (t) => t * t * (3 - 2 * t);
  for (const [s, a] of [[4, 0.5], [8, 0.3], [32, 0.2]]) {          // value noise: fine unevenness and pores, tileable
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * s, fy = y / N * s, ix = Math.floor(fx), iy = Math.floor(fy), u = sm(fx - ix), v = sm(fy - iy);
      const w = (i, j) => hash((ix + i) % s, (iy + j) % s);
      h[y * N + x] += a * ((w(0, 0) * (1 - u) + w(1, 0) * u) * (1 - v) + (w(0, 1) * (1 - u) + w(1, 1) * u) * v);
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N], dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
    const i = (y * N + x) * 4; img.data[i] = 128 - dx * 300; img.data[i + 1] = 128 - dy * 300; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  MICRO = new THREE.CanvasTexture(c); MICRO.wrapS = MICRO.wrapT = THREE.RepeatWrapping; MICRO.colorSpace = THREE.NoColorSpace;
  return MICRO;
}

const LUM = 'vec3( 0.2126, 0.7152, 0.0722 )';

// m: Ivan's MeshPhysicalMaterial; mesh: its mesh (a 'color' attribute = the baked Shade: AO, hair, 1)
export function applySkin(m, mesh, opts = {}) {
  const Q = new URLSearchParams(location.search);
  if (Q.get('skin') === '0') return;
  const num = (k, d) => +(Q.get(k) ?? opts[k] ?? d);
  const shade = !!(mesh && mesh.geometry && mesh.geometry.getAttribute('color'));
  const sat = num('skinSat', 0.45), sss = num('skinSSS', 1), nrm = num('skinNrm', 0.35), ao = num('skinAO', 1), hairK = num('hairK', 1);
  m.envMapIntensity = num('skinEnv', 0.55);
  m.color.setScalar(num('skinAlb', 0.9));
  m.sheen = 0.08;
  m.vertexColors = shade;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uLightSat: { value: sat }, uSSS: { value: new THREE.Color(0.95, 0.38, 0.24).multiplyScalar(sss) },
      uMicro: { value: microNormal() }, uMicroK: { value: nrm }, uAO: { value: ao }, uHairK: { value: hairK },
    });
    const pars = THREE.ShaderChunk.lights_physical_pars_fragment
      .replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;',
        `vec3 lcol = max( mix( vec3( dot( directLight.color, ${LUM} ) ), directLight.color, uLightSat ), 0.0 );   // max: a saturated light pushed past 1 goes negative -> NaN in AgX
	float nl = dot( geometryNormal, directLight.direction );
	float dotNL = saturate( nl );
	vec3 irradiance = dotNL * lcol;
	float wrapNL = saturate( ( nl + 0.5 ) / 1.5 );
	reflectedLight.directDiffuse += max( wrapNL - dotNL, 0.0 ) * lcol * uSSS * ( 1.0 - sHair ) * BRDF_Lambert( material.diffuseColor );`)
      .replace('vec3 lightColor = rectAreaLight.color;', `vec3 lightColor = max( mix( vec3( dot( rectAreaLight.color, ${LUM} ) ), rectAreaLight.color, uLightSat ), 0.0 );`);
    sh.fragmentShader = `uniform float uLightSat, uMicroK, uAO, uHairK;
uniform vec3 uSSS;
uniform sampler2D uMicro;
float sHair = 0.0, sAO = 1.0;
` + sh.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', pars)
      // the baked Shade instead of a plain vertex-colour multiply
      .replace('#include <color_fragment>', `#if defined( USE_COLOR )
        sHair = clamp( vColor.g * uHairK, 0.0, 1.0 );   // clamp: above 1, (1 - sHair) goes negative, the SSS subtracts light and AgX's log makes NaN
        sAO = mix( 1.0, pow( clamp( vColor.r, 0.0, 1.0 ), mix( 1.6, 2.4, sHair ) ), uAO );
        float l = dot( diffuseColor.rgb, ${LUM} );
        vec3 skinCol = mix( vec3( l ), diffuseColor.rgb, 1.12 );                      // AgX eats skin's colour: give it back
        vec3 hairCol = mix( vec3( l ), diffuseColor.rgb, 1.35 ) * vec3( 0.60, 0.52, 0.45 );   // darker, richer, cooler roots
        diffuseColor.rgb = max( mix( skinCol, hairCol, sHair ), 0.0 ) * sAO;   // a saturation push can go negative: AgX's log turns that into NaN and the bloom spreads it over the frame
      #endif`)
      // hair: a softer, broader sheen than skin; occlusion also kills the specular inside the curls
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, 0.42, sHair );`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      #ifdef USE_MAP
        vec2 mn = texture2D( uMicro, vMapUv * 40.0 ).xy * 2.0 - 1.0;
        normal = normalize( normal + uMicroK * ( 1.0 - sHair ) * vec3( mn, 0.0 ) );
      #endif`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        reflectedLight.indirectSpecular *= sAO;
        reflectedLight.directSpecular *= mix( 1.0, sAO, 0.7 );`);
  };
  m.customProgramCacheKey = () => `ivanSkin${shade}${sat}${sss}${nrm}${ao}${hairK}`;
  m.needsUpdate = true;
}
