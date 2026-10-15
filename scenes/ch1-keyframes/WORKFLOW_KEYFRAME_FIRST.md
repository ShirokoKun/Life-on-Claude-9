# The workflow from here: keyframe-first

Written 2026-10-15, after reading every plan, lesson and status note in the repo, the VO package and the boards, and after building the Ch 1 keyframes (`KEYFRAMES.md`).

## What went wrong before, and why

| What happened | Why it cost so much |
|---|---|
| A 51-shot animatic (`ch1`) was built on **estimated** times before the voiceover existed | Every shot then had to be re-timed. s03 still runs on the old intro clock (VO at 6.0 s instead of 3.0 s). |
| Whole scenes were built with **motion and acting first** (s03, s04): Blender performances baked per scene, then 4K renders | A frame that doesn't work is found only after the acting, the export and a render. Each fix is a Blender round trip. |
| **Look** was tuned at 4K render scale (25-minute bakes, 4K renders) while **composition and story** were still open | The expensive work was done on frames that were not locked. |
| Time-of-day lighting existed only on paper | The flashback and the dawn could not be judged at all. (The day, evening and sunrise bakes now exist: about 4 min each at preview size.) |
| Infrastructure and story were built at the same time, by the same pass | Tools grew faster than the film. |
| The earlier AI-clip edit (v1) moved the camera everywhere and cut like a trailer (`context-library/projects/life-on-claude-9/EDITORIAL-CRITIQUE-v1.md`) | No shot had one decided idea before it moved. |

**The common root:** pictures were never locked before they were animated.

## The pipeline (each stage ends at a gate you sign)

The order is the one studios use for animation. Each stage is cheap to change and expensive to change after its gate.

| # | Stage | Output | Gate (you) | Cost to change after |
|---|---|---|---|---|
| 0 | **Script + VO** | the `timeline.json` clock | the VO is final | everything moves |
| 1 | **Keyframes** (now) | `kf1`: one composed, lit, posed 3D frame per line, on the real VO clock | every frame ✓ or noted | minutes (edit one line in `scene.js`, re-render in seconds) |
| 2 | **Story reel** | the keyframes played on the VO (the Studio already does this: scene 5, Play) | the cut works: order, holds, the jumps between worlds | minutes |
| 3 | **Layout** | each keyframe becomes a shot: a start and an end frame, one camera move, its length | the camera language per shot | an hour per shot |
| 4 | **Acting** | new Blender performances only where a held pose can't carry the shot (mug, phone, swivel, stand) | hand check, silhouettes | hours |
| 5 | **Look** | full bakes, grade, glow, at final resolution | look-lock frames against the references | a bake |
| 6 | **Render + mux** | MP4 with the full mix (`ffmpeg -c:v copy`) | the guide's QA list (`GUIDE_FOR_VISUAL_CLAUDE.md` §9) | a render |

### Rules that make it work

1. **Stage 1 uses only what exists.**
   - Poses are held frames of the existing performances.
   - The standing pose is the rig's rest pose with the arms dropped.
   - Light comes from the bakes plus a window light.

   A keyframe never waits on new acting. If a frame needs a pose that doesn't exist, it goes on the stage 4 list, and the keyframe uses the closest held pose.
2. **One hero per frame** (diorama framework): what is sharp speaks, what is soft listens.
3. **Every line gets one frame**; a long line gets two or more. Never two frames that say the same thing.
4. **Continuity anchors are planned, not found:**
   - the glass ×3;
   - the top-down ×3;
   - the yes-key ×4;
   - the K19/K44 desk wall;
   - Claude's mood.
5. **Screen direction:** side views from his right. He looks screen-right at the machine. He turns to the light only at the window and the dawn.
6. **Measure, don't guess:**
   - read object positions from the running scene (`tools/_probe.mjs`), not from the plan;
   - render and look before writing "done".

   The plan's coordinates were wrong for the phone (it is on the desk), the clock (behind the books) and the glass (water top at 0.845 m).
7. **The locked rules stay:**
   - `post.js` is untouched;
   - Ivan's rig is untouched;
   - the extra poses are applied at runtime and never written back.

## Session plan

| Session | Work | Gate |
|---|---|---|
| **This one** (done) | VO package read; the room's day, evening and sunrise baked; Claude, the zone, the voxel props and the `kf1` scene built; 51 keyframes in 4 review rounds | your review of `board/ch1_keyframes_r4.jpg` and the story reel |
| **Next** | Fix the ~ frames (K07, K14, K15, K18, K25, K34, K37, K38, K39, K42) and your notes. Then decide on the zone and on Claude's design. Then lock. | every frame ✓ |
| Then | Story reel pass: re-time holds against the VO by ear; add the two or three missing in-between frames if a jump is too big | the cut works |
| Then | Layout, one sequence at a time (S1 first, it reuses s03's camera work): each keyframe gets an end frame and a move | per sequence |
| Then | The acting list: mug sip, phone thumb-type, chair swivel, a real standing take with the new Ivan (`prep_tripo.py --stand`), and a face rig decision | per performance |
| Then | Full-size bakes (no `--preview`), look lock, renders, mux with `Ch01_FULL_MIX` | QA list |

## Tools added this session

| Tool | Use |
|---|---|
| `engine/scenes/kf1/scene.js` | The keyframe scene. One entry per keyframe in `SHOTS`: camera (`from`, `at0`, `mm`, `f`, `focus`), `light`, `iv` (held pose `[performance, second]`), `scr` (screen clock), `cl` (Claude), `zone`, `icons`, `env`, `stand`, `place`, `ghosts`, `green`, `thin`, `card`, `note`. |
| `engine/scenes/kf1/claude.js` | Claude, the voxel character: `mood` warm / bright / cold / hollow; `pose` hover, wave, present, type, hold, cheer, point, sit, idle; `build` (materialise); `glitch` |
| `engine/scenes/kf1/stage.js` | The zone: cheat, void, crowd, door, tower |
| `engine/scenes/kf1/voxel.js`, `props.js` | The PS1 voxel material, and ASCII pixel art turned into voxels (modules, envelopes, code bricks, check mark) |
| `tools/kf_board.mjs` | Renders every keyframe from one page load (about 70 s for 51 frames) plus a labelled board |
| `tools/kf_pick.py` | Puts chosen frames side by side |
| `tools/_probe.mjs` | Reads real object positions, lightmap sets and exposure from the running scene |
| `engine/src/main.js` | Two small hooks: `SC.ivanTime(t)` (hold a pose), and `CAST` entries with their own `visible(t)` and `time(t)`. The `props` context also gets `cast` and `camera`. The intro is unchanged: it uses none of them. |

## Changes outside the new scene (please check)

- **New bakes, preview size, Blender 5.2:**
  - `engine/scenes/s03/lighting/day`, `evening` and `sunrise`, about 4 min each.
  - s04 and ch1 now pick these up automatically, so their day shots are no longer 3 AM.
  - The folders also hold `_full`/`_live` EXRs (about 120 MB per set). Check `.gitignore` before committing.
- **`project.json`:** a new scene 5, `kf1`.
- **Not committed:** your uncommitted s03 work is in the same files (`main.js` among them), so I left all commits to you.
