// URL query parameters. Everything that changes what a frame looks like must
// be expressible here, so that the offline renderer can reproduce it exactly.
//
//   ?scene=/scenes/poc_desk_3am.glb   GLB to load (default: built-in test scene)
//   ?cam=Cam%20OTS                    camera node name inside the GLB (default: first camera)
//   ?look=intro_3am                   look preset in src/looks/<name>.json
//   ?render=1&frame=N&fps=30          deterministic render mode (fixed clock, renders once)
//   ?frame=N                          without render=1: freeze the live preview at that frame
//   ?ui=0                             hide the leva panel

export interface EngineParams {
  scene: string | null;
  cam: string | null;
  look: string;
  render: boolean;
  frame: number | null;
  fps: number;
  ui: boolean;
}

function readParams(): EngineParams {
  const q = new URLSearchParams(window.location.search);
  const num = (k: string): number | null => {
    const v = q.get(k);
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const render = q.get('render') === '1' || q.get('render') === 'true';
  return {
    scene: q.get('scene') || null,
    cam: q.get('cam') || null,
    look: q.get('look') || 'intro_3am',
    render,
    frame: num('frame') ?? (render ? 0 : null),
    fps: num('fps') ?? 30,
    ui: !render && q.get('ui') !== '0',
  };
}

export const params: EngineParams = readParams();
