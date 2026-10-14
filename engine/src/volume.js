// Volumetric light for a room with one window (scene s03 / ch1). For every pixel the ray from the camera to the
// first surface (scene depth) is marched through the room's air, and light is added where that air is lit:
//  - window shafts: each sample is traced back along the light direction to the window plane (x = 0) and is lit only
//    if it lands in a pane, not on a mullion, sash rail, muntin or the blind stack, so the frame prints into the air
//    exactly as it prints on the floor (the analytic version of shadow-map godrays, e.g. three-good-godrays);
//  - the lamp: in-scatter around the bulb, strongest out of the shade's open top and bottom;
//  - a little uniform haze, the air itself.
// Blender coordinates inside the shader (x, y, z up). Drawn in the atmosphere pass (after depth of field, additive).
import * as THREE from 'three';

export function createVolume({ room, lamp, COMMON }) {
  const [y0, y1, sill, head] = room.window;
  const units = 3, uw = (y1 - y0) / units;
  const uniforms = {
    tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) }, near: { value: 0.03 }, far: { value: 400 },
    invProj: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, time: { value: 0 },
    roomSize: { value: new THREE.Vector3(room.w, room.d, room.h) },
    win: { value: new THREE.Vector4(y0, y1, sill, head - 0.40) },           // the blind stack closes the top 0.40 m
    unitW: { value: uw },
    winDir: { value: new THREE.Vector3(1, -0.35, -0.75).normalize() },      // light travel (into the room)
    winColor: { value: new THREE.Color(0.45, 0.58, 1.0) }, winK: { value: 0.022 },
    lampPos: { value: new THREE.Vector3(...lamp) }, lampColor: { value: new THREE.Color(1.0, 0.62, 0.32) }, lampK: { value: 0.0045 },
    hazeColor: { value: new THREE.Color(0.30, 0.24, 0.20) }, hazeK: { value: 0.0012 },
    steps: { value: 40 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `${COMMON}
      uniform mat4 invProj, camWorld; uniform float time, unitW, winK, lampK, hazeK, steps;
      uniform vec3 roomSize, winDir, winColor, lampPos, lampColor, hazeColor; uniform vec4 win;
      varying vec2 vUv;
      vec3 toB(vec3 p) { return vec3(p.x, -p.z, p.y); }                 // three -> Blender
      float n3(vec3 p){ return fract(sin(dot(floor(p), vec3(17.1, 31.7, 11.3))) * 4375.85); }
      float noise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(n3(i), n3(i + vec3(1,0,0)), f.x), mix(n3(i + vec3(0,1,0)), n3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(n3(i + vec3(0,0,1)), n3(i + vec3(1,0,1)), f.x), mix(n3(i + vec3(0,1,1)), n3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float band(float x, float c, float hw) { return smoothstep(hw, hw + 0.012, abs(x - c)); }   // 0 on a bar, 1 off it
      // is the air at b lit through the window?
      float windowLit(vec3 b) {
        if (b.x < 0.0 || b.x > roomSize.x || b.y < 0.0 || b.y > roomSize.y || b.z < 0.0 || b.z > roomSize.z) return 0.0;
        float t = b.x / max(winDir.x, 1e-3);
        vec3 q = b - winDir * t;                                         // where the light came in, on the window plane
        float inY = smoothstep(win.x, win.x + 0.02, q.y) * (1.0 - smoothstep(win.y - 0.02, win.y, q.y));
        float inZ = smoothstep(win.z, win.z + 0.02, q.z) * (1.0 - smoothstep(win.w - 0.02, win.w, q.z));
        float bars = 1.0;
        for (int k = 1; k < 3; k++) bars *= band(q.y, win.x + float(k) * unitW, 0.06);             // mullions
        for (int k = 0; k < 3; k++) bars *= band(q.y, win.x + (float(k) + 0.5) * unitW, 0.012);    // muntins
        bars *= band(q.z, 0.5 * (win.z + win.w + 0.40), 0.05);                                       // meeting rails
        return inY * inZ * bars;
      }
      void main() {
        vec2 uv = gl_FragCoord.xy / res;
        float dist = min(sceneDist(uv), 12.0);                         // view depth to the first surface
        vec4 v = invProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 dirV = normalize(v.xyz / v.w);
        float len = dist / max(-dirV.z, 1e-3);
        vec3 ro = toB((camWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
        vec3 rd = toB(normalize((camWorld * vec4(dirV, 0.0)).xyz));
        float n = int(steps) > 0 ? steps : 1.0, dt = len / n;
        float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));   // IGN
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 64; i++) {
          if (float(i) >= n) break;
          vec3 b = ro + rd * (float(i) + jitter) * dt;
          float wisp = 0.6 + 0.8 * noise(b * 2.2 + vec3(time * 0.03, time * 0.01, 0.0));
          vec3 L = b - lampPos; float dl2 = dot(L, L);
          float out_ = 0.25 + 0.75 * smoothstep(0.45, 0.85, abs(L.z) / sqrt(dl2 + 1e-4));    // open top and bottom of the shade
          acc += winColor * winK * windowLit(b) * wisp
               + lampColor * lampK * out_ / (dl2 + 0.03)
               + hazeColor * hazeK * wisp;
        }
        gl_FragColor = vec4(acc * dt, 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  return {
    mesh, uniforms, material: mat,
    // per frame, before drawing: camera matrices for the ray reconstruction
    update(camera, t) { uniforms.invProj.value.copy(camera.projectionMatrixInverse); uniforms.camWorld.value.copy(camera.matrixWorld); uniforms.time.value = t; },
  };
}
