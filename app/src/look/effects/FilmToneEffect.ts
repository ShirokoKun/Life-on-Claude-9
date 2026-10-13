import { BlendFunction, Effect } from 'postprocessing';
import * as THREE from 'three';

// Exposure -> AgX tone mapping (with an ASC-CDL "look" applied in AgX log
// space, the way Blender's "AgX - Punchy" / "Golden" looks work) -> a small
// display-referred grade (black point crush, contrast, saturation, tint).
//
// Owns tone mapping completely: the renderer must use NoToneMapping (the
// R3F EffectComposer forces that) and this must sit after bloom/streak in the
// chain so bloom works on scene-referred HDR values.

const fragment = /* glsl */ `
uniform float exposure;
uniform vec3 lookSlope;
uniform vec3 lookOffset;
uniform vec3 lookPower;
uniform float lookSaturation;
uniform float blackPoint;
uniform float contrast;
uniform float saturation;
uniform vec3 gain;

const mat3 LIN_SRGB_TO_REC2020 = mat3(
  vec3(0.6274, 0.0691, 0.0164),
  vec3(0.3293, 0.9195, 0.0880),
  vec3(0.0433, 0.0113, 0.8956));
const mat3 REC2020_TO_LIN_SRGB = mat3(
  vec3(1.6605, -0.1246, -0.0182),
  vec3(-0.5876, 1.1329, -0.1006),
  vec3(-0.0728, -0.0083, 1.1187));
const mat3 AGX_INSET = mat3(
  vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
  vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
  vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
const mat3 AGX_OUTSET = mat3(
  vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
  vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
  vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));

vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

vec3 agx(vec3 color) {
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color = LIN_SRGB_TO_REC2020 * color;
  color = AGX_INSET * color;
  color = max(color, 1e-10);
  color = clamp((log2(color) - minEv) / (maxEv - minEv), 0.0, 1.0);
  color = agxContrast(color);
  // look (ASC CDL + saturation), in AgX sigmoid space
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = pow(max(color * lookSlope + lookOffset, 0.0), lookPower);
  color = l + lookSaturation * (color - l);
  color = AGX_OUTSET * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = REC2020_TO_LIN_SRGB * color;
  return clamp(color, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = agx(inputColor.rgb * exposure);
  // display-referred grade, done in a perceptual (gamma 2.2) space
  vec3 p = pow(c, vec3(1.0 / 2.2));
  p = max(p - blackPoint, 0.0) / (1.0 - blackPoint);
  p = (p - 0.5) * contrast + 0.5;
  float l = dot(p, vec3(0.2126, 0.7152, 0.0722));
  p = mix(vec3(l), p, saturation) * gain;
  c = pow(clamp(p, 0.0, 1.0), vec3(2.2));
  outputColor = vec4(c, inputColor.a);
}`;

export interface FilmToneOptions {
  exposure?: number;
  lookSlope?: THREE.ColorRepresentation;
  lookOffset?: number;
  lookPower?: number;
  lookSaturation?: number;
  blackPoint?: number;
  contrast?: number;
  saturation?: number;
  gain?: THREE.ColorRepresentation;
}

export class FilmToneEffect extends Effect {
  constructor(o: FilmToneOptions = {}) {
    super('FilmToneEffect', fragment, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ['exposure', new THREE.Uniform(o.exposure ?? 1)],
        ['lookSlope', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ['lookOffset', new THREE.Uniform(new THREE.Vector3(0, 0, 0))],
        ['lookPower', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ['lookSaturation', new THREE.Uniform(o.lookSaturation ?? 1)],
        ['blackPoint', new THREE.Uniform(o.blackPoint ?? 0)],
        ['contrast', new THREE.Uniform(o.contrast ?? 1)],
        ['saturation', new THREE.Uniform(o.saturation ?? 1)],
        ['gain', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
      ]),
    });
    this.set(o);
  }

  set(o: FilmToneOptions) {
    const u = this.uniforms;
    const v3 = (name: string, c: THREE.ColorRepresentation) => {
      const col = new THREE.Color(c);
      (u.get(name)!.value as THREE.Vector3).set(col.r, col.g, col.b);
    };
    if (o.exposure !== undefined) u.get('exposure')!.value = o.exposure;
    if (o.lookSlope !== undefined) v3('lookSlope', o.lookSlope);
    if (o.lookOffset !== undefined) (u.get('lookOffset')!.value as THREE.Vector3).setScalar(o.lookOffset);
    if (o.lookPower !== undefined) (u.get('lookPower')!.value as THREE.Vector3).setScalar(o.lookPower);
    if (o.lookSaturation !== undefined) u.get('lookSaturation')!.value = o.lookSaturation;
    if (o.blackPoint !== undefined) u.get('blackPoint')!.value = o.blackPoint;
    if (o.contrast !== undefined) u.get('contrast')!.value = o.contrast;
    if (o.saturation !== undefined) u.get('saturation')!.value = o.saturation;
    if (o.gain !== undefined) v3('gain', o.gain);
  }
}
