# Resume here (2026-10-16): round 11 done, final 1080p render

**Latest state (read first):**
- Round 11 (the director's notes on the `anim2` preview): every note and its fix is in `NOTES_R11.md`. Checked in stills; the 720p
  preview `anim4` was the first time the fixes played in motion.
- **Eyes:** real eyeballs built in Blender. kf1 loads `engine/scenes/s03/ivan_eyes.glb` and `engine/scenes/s04/ivan_eyes.glb`
  (tracked). The live `ivan.glb` files are untouched. To rebuild them (Blender 5.2):
  `blender -b --factory-startup -P blender/characters/prep_tripo.py -- blender/assets/characters/ivan_tripo_v3.glb engine/scenes/s03/ivan_eyes.glb --eyes`
  and the same with `engine/scenes/s04/ivan_eyes.glb --scene s04 --seconds 31.32 --eyes`.
- **4K:** effects sized in screen pixels now scale above 1080p, so a 3840x2160 frame keeps the approved 1080p look. Scaled:
  depth of field, bloom, halation, the stipple, the dither, the grid line width and Claude's threads. At 1080p and below
  nothing changes. The director chose the **1080p final**: 4K added only 7-27% more fine detail (measured on six
  frames), under the 50% bar. Final render: `node tools/render_mp4.mjs --scene kf1 --take final1080` (about 75 min on the PC).
- **New machine:** `MAC_TRANSFER_GUIDE.md` and `node tools/setup_check.mjs`.
- **Not in git** (made again on any machine):
  - `renders/`: every MP4 and frame;
  - `node_modules/`: `npm install` and `npx playwright install chromium`;
  - the Ch 1 audio stems: unzip `Ch01_part*.zip`;
  - the Poly Haven props: `node tools/polyhaven.mjs`.
- **Open items:**
  - no blinks;
  - a seam at the lower lid's outer corner in the K02 close-up;
  - the K43 press is slightly out of focus;
  - the K23 tick timing;
  - the balcony face light has only had a light pass.

---

## Earlier: 2026-10-15, late: the keyframe LOCK pass

The order the director set:
1. **Lock every keyframe** (now).
2. Lock `TRANSITIONS.md`.
3. Refine materials and taste.
4. Animate.
5. Render an MP4 for review.

Defect list: `AUDIT_R7B.md` (the director's notes plus the frame-by-frame audit). Transition plan: `TRANSITIONS.md` (draft).

## Rendering (no Studio needed)
- `node tools/serve.mjs 8791` in the background. It serves `engine/` as the web root.
- `node tools/kf_board.mjs --take X --only K13,K24 --gpu --url http://localhost:8791/index.html`
- `kf_board` now renders every frame **twice**. A single render kept the previous shot's focus and blurred close-ups (it fooled the K29 work for an hour).
- Camera look-dev: `tools/_probe_cams.mjs <frame> <outPrefix> cams.json` renders a grid of candidate cameras (`window.__cam`); pick from the sheet instead of guessing.
- The grip check: `tools/_probe_hand.mjs <frame> <out>` gives four close-ups of the held mug.
- `KF_URL=http://localhost:8791/index.html node tools/kf_heads.mjs K13` measures the head. Its `eye` and `fwd` assume a facing that is often wrong, so judge facing from renders.

## Done in this pass
- **Mug sip after drinking kinematics:** elbow down and forward, neutral wrist, a handle grip (index and middle through the loop, thumb on top). The mug turns to meet the hand (`holdProp`, plus `orientHand`, `curl`, `gripPoint` in `rig.js`). The far hand is used where the near one hid the mouth (K30, K33, K34).
- **K35** matches ref Group 8: behind his shoulder, ear, glasses arm, mug at the lips.
- **The balcony city:** about 1,000 buildings, an even golden-ratio azimuth spread, jittered round windows, narrower towers behind the lights.
- **Key legends** on the laptop now render; they hide whenever the desk is hidden.
- **K45:** a real office block (slabs, fins, lit panes, lobby, canopy, haze), framed after board r4c5.
- **K29** after the director's eye ref:
  - low 3/4 from his right, head lifted;
  - the imagination pass gives a rust print duotone;
  - coloured streak bars across the lower lenses, mapped by a planar lens map (`lensUv`);
  - the lens shader has `useUv`, `flipV`, `tint` and `uOff`.
- **K13** after the director's drowning ref:
  - the `drown` zone (only the chair kept);
  - about 950 glowing pages at every depth, specks, dark fog;
  - he sits back (`lean`) with hands on his thighs (`armrest`).
- **K11:** clean, with no letter pile.
- **K24:** a night void (black to dark-violet sky, black floor, white grid, twinkling stars, violet and white gems, glyphs); the lamp is hidden in the cheat world.
- **Imagination pass:** `imagPass` (a ShaderPass the scene adds after the film grade; k = 0 on normal frames). `ZONE_IMAG` holds the per-world strength; `s.imag` overrides per shot.
- **Per-shot key light:** `key: { at, color, k }`.

## Status (2026-10-16, round 10: keyframes locked candidate, the animation pass started)
- **Board r10:** `board/ch1_keyframes_r10.jpg`.
- **Round 10 changes:**
  - K22 ghosts sit on ghost chairs.
  - K07 green is a soft edge glow only, at f/11.
  - Mug and phone grips are fixed at the root (below).
  - K35 is behind his LEFT shoulder with the left hand, continuous with K30–K34.
  - Continuity fixes from the plan: K51/K52 hold s03 36.8, K16/K18 dim 0.16, matched lenses inside flows (K07 35 mm, K25 24 mm, K26 28 mm).
- **Hand fix (measured, `tools/_probe_fingers.mjs <frame>`):**
  - The palm side is −n for the LEFT hand and +n for the RIGHT, where n = cross(index1 − pinky1, middle1 − hand).
  - `curlAnat` resets the finger bones to the bind pose first, so the performance's own curl does not stack.
  - `orientHand` moves the wrist roll into the forearm.
- **Plan:** `ANIMATION_PLAN.md` (per shot: edit in/out, camera move, Ivan, Claude, environment; flows F1–F6; rhythm map; risks).

## The animation build (2026-10-16): stages 1-5 built, preview take `anim2`
Re-apply after any keyframe edit:
```
python -I tools/kf_apply_moves.py
python -I tools/kf_apply_anim.py
```
- **Moves** (`kf_apply_moves.py`):
  - one move per shot (push, truck, tilt), with `mv` windows that land on a beat;
  - `FLOWS` F2 (K21a-d push), F3 (K24 to K25 crane over his head), F4 (K26 to K27 orbit) and F6 (K33 to K34 push);
  - performance windows `iv: [clip, a, b, rate]`.
  - F1 was dropped: K07 to K08 is a cut, because the camera path would pass through his head.
- **Timing** (`kf_apply_anim.py`):
  - fades from black on the hits (K01, K30, K47) and cuts to black (K29, K46, K52);
  - the K24 room holds until the rush (`zoneAt`); the desk is swept away overhead (`deskAway`);
  - dim ramps (K15 into its 16%, K18 up from black);
  - births: Claude (`cl.born` / `exit` / keyed `path`, K12 orbit), modules (`iconsBorn`), the K15 offer modules and K18 ticks (`pipe.born` / `ticks`), the K24 power-ups (`lifeBorn`, `lifeShrink`), the K09 dome ring by ring (`weaveT0`);
  - the K13 pages rise in three waves (`rise`) and drift;
  - the K50 laced-hands blend (`lacedRamp`);
  - cuts moved onto the hits: 51.01, 64.11, 166.0, 168.85.
- **Engine side** (scene.js):
  - `cameraAt` handles move windows and flows; `ivOf` handles play clocks;
  - helpers `ramp` / `land` / `keyedP`;
  - the imagination ramp in on entering a world;
  - breath on every shot.
- **Not built yet** (next pass, after the director sees anim2):
  - blink and saccades (no lid rig);
  - dust;
  - the K28 tunnel straightening;
  - the K34 bokeh stretch animated (it is a static state now);
  - the K22 clock-tick ghosts sequence (the ghosts are static);
  - K12 Claude streaming into the phone (it shrinks out).

## Next (in order)
1. The director's notes on r8, if any.
2. Audit leftovers:
   - K40 (the mug hand still clawed);
   - K30 sleeve edges;
   - hairlines at the frame edges (K14, K48, K50);
   - K09 (Claude stacking a brick);
   - K22 check.
3. Build the transition driver (TRANSITIONS.md section 3: `tin`/`tout`, births, fall-away, the imagination ramp).
4. Camera moves per shot.
5. MP4: `node tools/render_mp4.mjs --scene kf1 --w 1280 --h 720` with the VO; review it, then share it.

## Known limits
- His eyes are fixed geometry with a slightly lowered lid; there are no eye bones or morphs. An open or up-looking eye needs a Blender head variant.
- Backups of the pre-change files: `renders/kf1/scene_r7_pre_imag.js`, `stage_r7_pre_k45.js`, `stage_r7_pre_drown.js`.

Nothing is committed.
