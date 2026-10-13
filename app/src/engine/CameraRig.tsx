import { useFrame, useThree } from '@react-three/fiber';
import { folder, useControls } from 'leva';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { filmClock } from './filmClock';
import { defaultShake, sampleShake, type ShakeParams } from './shake';

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _shakeQ = new THREE.Quaternion();
const _shakeE = new THREE.Euler();
const _offset = new THREE.Vector3();

/**
 * Drives the render camera (R3F's default camera) from a *source* camera that
 * lives in the scene graph: a glTF camera node, or an animated rig. Each frame
 * the source's world transform and lens are copied, then deterministic
 * handheld shake is layered on top. The source itself is never modified, so
 * shake never accumulates into animation.
 *
 * Lens rule: the source keeps its horizontal field of view (Blender's default
 * sensor fit for landscape frames). If `source.userData.refAspect` is set (the
 * aspect the yfov was authored for, e.g. glTF `aspectRatio`), the vertical fov
 * is recomputed for the canvas aspect.
 */
export function CameraRig({
  source,
  shake = defaultShake,
}: {
  source: THREE.PerspectiveCamera;
  shake?: Partial<ShakeParams>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const init = { ...defaultShake, ...shake };

  const sh = useControls(
    'Camera',
    {
      shake: folder(
        {
          enabled: init.enabled,
          rotation: { value: init.rotation, min: 0, max: 3, step: 0.01, label: 'rot (deg)' },
          position: { value: init.position, min: 0, max: 0.05, step: 0.0005, label: 'pos (m)' },
          frequency: { value: init.frequency, min: 0.05, max: 6, step: 0.01, label: 'freq (Hz)' },
          octaves: { value: init.octaves, min: 1, max: 5, step: 1 },
          seed: { value: init.seed, min: 0, max: 999, step: 1 },
        },
        { collapsed: true },
      ),
    },
    { collapsed: true },
  ) as ShakeParams;

  useLayoutEffect(() => {
    camera.near = source.near;
    camera.far = source.far;
    camera.updateProjectionMatrix();
  }, [camera, source]);

  useFrame(() => {
    source.updateWorldMatrix(true, false);
    source.matrixWorld.decompose(_pos, _quat, _scale);

    const s = sampleShake(filmClock.time, sh);
    _offset.set(s.position[0], s.position[1], s.position[2]).applyQuaternion(_quat);
    camera.position.copy(_pos).add(_offset);
    _shakeE.set(s.rotation[0], s.rotation[1], s.rotation[2], 'YXZ');
    _shakeQ.setFromEuler(_shakeE);
    camera.quaternion.copy(_quat).multiply(_shakeQ);

    const aspect = size.width / Math.max(1, size.height);
    let fov = source.fov;
    const refAspect = source.userData.refAspect as number | undefined;
    if (refAspect) {
      const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(source.fov) / 2) * refAspect);
      fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hHalf) / aspect));
    }
    if (camera.fov !== fov || camera.aspect !== aspect || camera.near !== source.near || camera.far !== source.far) {
      camera.fov = fov;
      camera.aspect = aspect;
      camera.near = source.near;
      camera.far = source.far;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  }, -100);

  return null;
}
