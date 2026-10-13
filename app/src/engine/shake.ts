// Deterministic handheld camera shake.
//
// Pure function of (time, params): the same frame always produces the same
// offset, so offline renders are reproducible and cuts can be re-rendered.
// Built on 1D gradient noise summed over a few octaves (fBm), one independent
// channel per axis.

export interface ShakeParams {
  enabled: boolean;
  /** Rotation amplitude in degrees (pitch / yaw / roll scale off this). */
  rotation: number;
  /** Positional amplitude in metres. */
  position: number;
  /** Base frequency in Hz. Handheld breathing is ~0.3–1.5 Hz. */
  frequency: number;
  /** Number of noise octaves (1–5). More = more jitter. */
  octaves: number;
  /** Seed: change per shot so two shots never shake identically. */
  seed: number;
}

export const defaultShake: ShakeParams = {
  enabled: true,
  rotation: 0.35,
  position: 0.004,
  frequency: 0.6,
  octaves: 3,
  seed: 7,
};

function hash1(n: number): number {
  // Integer hash -> [-1, 1]. Math.imul keeps it exact across engines.
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return ((x >>> 0) / 0xffffffff) * 2 - 1;
}

/** 1D gradient (Perlin-style) noise, roughly in [-1, 1]. */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const g0 = hash1(i * 374761393 + seed * 668265263);
  const g1 = hash1((i + 1) * 374761393 + seed * 668265263);
  const u = f * f * f * (f * (f * 6 - 15) + 10); // quintic fade
  const v0 = g0 * f;
  const v1 = g1 * (f - 1);
  return (v0 + (v1 - v0) * u) * 2.0;
}

export function fbm1(x: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  const n = Math.max(1, Math.min(6, Math.round(octaves)));
  for (let o = 0; o < n; o++) {
    sum += amp * noise1(x * freq, seed + o * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export interface ShakeSample {
  /** Local-space position offset (metres): x right, y up, z back. */
  position: [number, number, number];
  /** Rotation offset in radians: pitch (x), yaw (y), roll (z). */
  rotation: [number, number, number];
}

export function sampleShake(t: number, p: ShakeParams): ShakeSample {
  if (!p.enabled) return { position: [0, 0, 0], rotation: [0, 0, 0] };
  const x = t * p.frequency;
  const s = p.seed * 31;
  const deg = Math.PI / 180;
  return {
    position: [
      fbm1(x, s + 1, p.octaves) * p.position,
      fbm1(x, s + 2, p.octaves) * p.position,
      fbm1(x * 0.7, s + 3, p.octaves) * p.position * 0.5,
    ],
    rotation: [
      fbm1(x, s + 4, p.octaves) * p.rotation * deg, // pitch
      fbm1(x, s + 5, p.octaves) * p.rotation * deg, // yaw
      fbm1(x * 0.5, s + 6, p.octaves) * p.rotation * 0.4 * deg, // roll, slower and smaller
    ],
  };
}
