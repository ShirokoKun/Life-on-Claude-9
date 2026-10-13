import { params } from './params';

// The single source of time for everything animated in a shot.
//
// Rule: animation code reads `filmClock.time` / `filmClock.frame` and must be a
// pure function of them (no accumulating deltas, no Math.random, no
// performance.now). That is what makes `?render=1&frame=N` reproducible.
export const filmClock = {
  fps: params.fps,
  /** Seconds since the start of the shot. */
  time: 0,
  /** Integer frame number (time * fps, floored in live mode). */
  frame: 0,
  /** true when the clock is pinned (render mode or ?frame=N preview). */
  fixed: params.frame !== null,

  setFrame(frame: number) {
    this.frame = frame;
    this.time = frame / this.fps;
  },

  /** Live preview: follow the wall clock. */
  setLiveTime(seconds: number) {
    this.time = seconds;
    this.frame = Math.floor(seconds * this.fps);
  },
};

if (params.frame !== null) filmClock.setFrame(params.frame);
