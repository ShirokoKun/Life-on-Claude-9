# Chapter 1 build: workflow, stages, gates

**Plan:**
- Shots: `CHAPTER1_PLAN.md`, 51 shots, ~3:52 estimated.
- Machine-readable timeline: `engine/scenes/ch1/timeline.json`.
- Set: `scenes/03-ivan-room/PLAN.md`.

**How progress is shown:**
- Every stage ends with frames I look at, a contact sheet, and a commit.
- The Studio always plays the latest chapter: scene **ch1**, at `engine/scenes/ch1/scene.js`.

## Decisions taken (change any of them and I adapt)

| Question | Decision | Why |
|---|---|---|
| Phone "on the couch" | It lies face-up on the bed all night | The room has no couch. The bed pays off "barely slept" and "then he'll rest". |
| Girlfriend's name | **Sarah** on every screen | The script names her Sarah in Ch 2. |
| Window direction | Treated as **east** (label only; geometry unchanged) | So the sunrise comes in through it at the end. |
| Ending | In the chair: push back, swivel to the window, lean back | It follows the script. The S5 lean-back curve is reused. |
| Intro's last two lines (S5a, S5) | Dropped from Ch 1 | The new script replaces them with "Ivan keeps saying yes". |
| Face controls (blink, widen, smile) | **Not added yet.** Ivan's rig is locked. | Fallback: eyes look-at plus head and body acting. Needs the director's yes. |
| Glasses reflections, bloodshot eyes | Overlay meshes on top of the lens, not changes to Ivan's materials | Respects the lock. |
| Typed lines | On screen only, plus the narrator's VO | Until the VO says otherwise. |

## Stages

Each stage ends at a gate: a frame check against the references, a contact sheet, and a commit.

### S0: Room look lock (in progress)

- **Goal:** match the night reference `ref/look_night.webp` in light distribution, not composition.
- **Targets** (measured with `lum.py`):
  - near-black pixels ≤ 15%;
  - p10 ≥ 0.02;
  - warm overall tint;
  - p99 ≤ 0.65.
- **Also:** bed and clutter pass, varied book spines, S4 reframe.

### S1: Chapter animatic in the engine (first, because everything else plugs into it)

1. Build `engine/scenes/ch1/scene.js` from `engine/scenes/ch1/timeline.json`:
   - all 51 shots blocked with their cameras, lenses and focus;
   - captions: the script lines at their estimated times.
2. Shots that need missing things show what exists, plus the slate label.
3. Register it in `project.json` as Chapter 1.
4. **Gate:** the whole chapter plays end to end in the Studio, and a 51-frame contact sheet is checked.

### S2: Light states for the new room

1. **4am:** a live variation of the 3am bake (cooler, lamp dimmer). The desk-only "iso" look comes from scaling the lightmap groups.
2. **Bakes:**
   - day (the flashback, warm, board A);
   - evening (dusk, montage);
   - sunrise (low sun through the window, with mullion and blind shadows).
3. Engine: the time-of-day mixer for `room03`, using the existing s02 `light(t)` pattern.
4. **Gate:** the same three angles in every state.

### S3: Performances (`acting.py`: added, never rewritten)

Built in shot order. Each one gets a hand check: no fingers in the face, no flipped wrists.

1. Reclined in the chair with the phone, thumb-typing.
2. Sitting back watching.
3. A finger press on Y and Enter.
4. Mug: sip, drain, tremor.
5. Stop typing, shoulders rise.
6. Proud nods.
7. Swivel and lean back.
8. A standing new Ivan: at the window with a mug, and in the void.

### S4: Screens, phone and UI

1. The Claude chat, y/n prompts, the tests-pass flood, an hours-saved counter, dashboard tiles.
2. The phone: lock screen with Sarah's texts, Mail badge, the chat; the phone on the bed with buzz and glow.
3. Monitor 2 becomes a live canvas.
4. Floating 3D UI cards: chat, pipeline, module icons.

### S5: Special sequences

1. **The void ("another frequency"):** black stage, light streaks and bokeh, ghost doubles, the door of light, bloom to white.
2. **The time-lapse:** clock, light, mugs.
3. **The "thinness" streaks.**
4. **Glasses reflections.**

### S6: Voiceover lock, sound, delivery

1. Re-time `engine/scenes/ch1/timeline.json` to the real VO, keeping one move per shot.
2. Room tone, typing and the motif.
3. Render at 1080p.
4. A subtitled version.
5. Board PNG.
6. Review notes back into the plan.

## Asset sources

- **CC0 Poly Haven:** furniture, plants, props. Fetch with `node tools/polyhaven.mjs`.
- **Director-supplied:** `blender/assets/props_src/` (the guitar).
- **Built in Blender:** shell, window and blinds, bed, desk, lamp, rugs, city.
- **Characters:** Tripo, through `prep_tripo.py`.
- **To fetch next (S4/S5):** phone, mugs and the coffee pot already exist in `props_desk`; a backpack, a laundry box and shoes for the clutter pass. Candidates: Poly Haven, or the director's BlenderKit.

## Running order

Two tracks run in parallel:

1. **Engine and scene work, done by me:** S0 → S1 → S2 → S4.
2. **Self-contained builds, done by agents** (each with a written brief and a test frame): screens and UI canvases, the void stage, acting additions.

Every finished piece goes into the ch1 animatic straight away, so the chapter is always playable.
