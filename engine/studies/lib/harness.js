// The time harness every study shares. One clock, deterministic in t, so preview and render match.
//   (no flags)   plays in real time, looping over `duration`; Space pauses, arrows step 1/24 s
//   ?t=5.2       holds that moment (look-dev)
//   ?render=1    no loop: tools/study_render.mjs calls window.renderAt(t) per frame and waits on window.__ready
export function run({ duration, update, render, ready = Promise.resolve() }) {
  const Q = new URLSearchParams(location.search);
  const RENDER = Q.get('render') === '1';
  const hold = Q.has('t') ? +Q.get('t') : null;
  const draw = (t) => { update(t); render(t); };
  window.__duration = duration;
  ready.then(() => {
    if (RENDER || hold != null) {
      window.renderAt = async (t) => { draw(t); return true; };
      draw(hold ?? 0);
      window.__ready = true;
      return;
    }
    let t0 = performance.now(), paused = false, tp = 0;
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { paused = !paused; if (!paused) t0 = performance.now() - tp * 1000; }
      if (e.code === 'ArrowRight') { paused = true; tp = (tp + 1 / 24) % duration; }
      if (e.code === 'ArrowLeft') { paused = true; tp = (tp - 1 / 24 + duration) % duration; }
    });
    const loop = () => {
      if (!paused) tp = ((performance.now() - t0) / 1000) % duration;
      draw(tp);
      const hud = document.getElementById('hud'); if (hud) hud.textContent = `${tp.toFixed(2)} s${paused ? '  (paused)' : ''}`;
      requestAnimationFrame(loop);
    };
    loop();
    window.__ready = true;
  });
}

// Small easing and curve helpers for keyed animation.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, u) => a + (b - a) * u;
// keys: [[t, v], ...] sorted; smooth between keys
export function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [ta, va] = keys[i - 1], [tb, vb] = keys[i], u = smooth((t - ta) / (tb - ta));
    return Array.isArray(va) ? va.map((v, k) => lerp(v, vb[k], u)) : lerp(va, vb, u);
  }
  return keys[keys.length - 1][1];
}
