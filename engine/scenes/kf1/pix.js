// Faceted Ivan (the director's renders for "barely slept / he knows / thinness": the face and hands break into
// flat blocks, as if the low-poly zone were leaking into him). A runtime swap of his materials for the keyframes
// that ask for it, restored after; Ivan's real materials and rig are not changed.
//   - his texture read in coarse blocks (150 texels across the map): skin and hair turn into pixel patches
//   - flat shading with normals quantized to a few directions: the surface reads as big flat facets
//   - colour posterized to a few steps per channel
import * as THREE from 'three';

const cache = new WeakMap();
const Q = new URLSearchParams(location.search);
const STEPS = { value: +(Q.get('pixsteps') ?? 24) }, TEXRES = { value: +(Q.get('pixres') ?? 256) }, NQ = { value: +(Q.get('pixnq') ?? 4) };

function pixOf(m) {
  if (cache.has(m)) return cache.get(m);
  const p = m.clone();
  p.flatShading = true; p.normalMap = null; p.sheen = 0; p.specularIntensity = 0.2;                 // flat shading and a tangent-space normal map fight: blotches
  p.onBeforeCompile = (sh) => {
    sh.uniforms.uSteps = STEPS; sh.uniforms.uTexRes = TEXRES; sh.uniforms.uNQ = NQ;
    sh.fragmentShader = `uniform float uSteps;
uniform float uTexRes;
uniform float uNQ;
` + sh.fragmentShader
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, ( floor( vMapUv * uTexRes ) + 0.5 ) / uTexRes );
        diffuseColor *= sampledDiffuseColor;
      #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize( floor( normal * uNQ + 0.5 ) / uNQ );`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  gl_FragColor.rgb = floor(gl_FragColor.rgb * uSteps + 0.5) / uSteps;`);
  };
  p.customProgramCacheKey = () => 'ivan-pix';
  p.needsUpdate = true;
  cache.set(m, p);
  return p;
}

// on: swap every mesh under root to its faceted twin; off: back to the original
export function setPix(root, on, res) {
  if (res) TEXRES.value = res;
  root.traverse((o) => {
    if (!o.isMesh || /Lens|Glasses/.test(o.material.name)) return;
    if (!o.userData.mat0) o.userData.mat0 = o.material;
    o.material = on ? pixOf(o.userData.mat0) : o.userData.mat0;
  });
}
