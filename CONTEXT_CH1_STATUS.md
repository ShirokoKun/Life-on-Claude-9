# Life on Claude Nine: where we are (Chapter 1)

*Snapshot: 15 Oct 2026, 16:45. Work paused here on request.*

## 1. What the project is

An animated short about **Ivan**, a software engineer who hands his whole life to Claude, one automation at a time.
- **Script:** `docs/script/life-on-claude-nine_ch1-3.md`, chapters 1–3.
- **This phase:** **Chapter 1, "The Binge".** One sleepless night: at 3 AM Ivan is building an email automation (Claude builds it, Ivan keeps saying yes). By sunrise everything in his day is automated, and he doesn't know what to do now.

**How it's made: code-to-film.**

| Part | Tool | Where |
|---|---|---|
| Set and character | Blender | `blender/` |
| Light | baked Cycles lightmaps | |
| Ivan | a Tripo-rigged character | |
| Performance | a per-frame acting solver | `blender/characters/acting.py` |
| Picture | a three.js engine with a film look (lens, depth of field, grain, letterbox, AgX grade) | `engine/` |
| Review and render | the **Studio** (`npm run studio`, http://localhost:8080) | `studio/` |

**Locked rules** (`CLAUDE.md`, `docs/WORKFLOW.md`):
- Don't change the render look in `post.js`.
- Ivan's model and rig, and existing performances: add new ones, never rewrite.
- Camera language: one move per shot, real lenses, keyed focus pulls.

## 2. Scenes in the project (`project.json`)

| # | id | Title | What it is | State |
|---|---|---|---|---|
| 0 | ch1 | Chapter 1 · The Binge | Animatic of all 51 planned shots in the room (`engine/scenes/ch1/`). Many shots are slates "to build". | animatic |
| 1 | intro | 3 AM | The original intro in the old flat. Good, has bugs, **no longer being worked on**. | final |
| 2 | s02 | The cheat code | Old draft in the old flat. | draft |
| 3 | s03 | Ivan's room | The **current main scene**: the new bedroom-study at 3 AM. Covers the chapter's opening (V01–V07b). Camera work done by you. | final |
| 4 | **s04** | **Two days ago** | **New this session:** the flashback (V08–V11), built on top of s03's set. | draft |

## 3. The plan for Chapter 1

### The documents

| Document | What it holds |
|---|---|
| `scenes/ch1/CHAPTER1_PLAN.md` | The shot bible: the feeling arc, a style bible (blue = machine, amber = human; the full glass of water as the motif), 7 beats, 51 shot cards, and a build list. Its times are **estimates** from before the voiceover existed. |
| `scenes/ch1/storyboards/` | Boards A, B and C (your sketches and colour frames), mapped in `PANELS.md`. |
| `audio/Ch01_VO_SoundPackage/` | **The voiceover and sound package. Its timeline is now the clock.** The guide says: re-time the picture to the VO, never the VO to the picture. |

**Package contents:**
- `01_GUIDE/GUIDE_FOR_VISUAL_CLAUDE.md`: the beat-by-beat sync sheet, hit frames, and the cues that need something on screen.
- `04_TIMELINE/timeline.json`: 36 beats; the chapter runs 200.26 s (3 s of pre-roll, 6 s of tail).
- `03_SOUND_DESIGN/`: 59 stems, 5 buses, `mixes/ch01_sound_design_noVO.flac`, and the cue sheet.

### Chapter → scenes (one scene per sound-design scene)

| Scene | VO beats | Chapter time | Status |
|---|---|---|---|
| s03 Ivan's room (3 AM) | V01–V07b | 0–36.96 | Exists. **Still on the old intro clock** (VO at 6.0 s); the new VO starts at 3.0 s. |
| s04 Two days ago (flashback) | V08–V11 | 36.96–68.28 | **Built this session** (see section 4). |
| s05 The cheat code | V12–V17 | 68.28–104.49 | Next. Plan cards C00–C07 and V01–V04: dusk, modules lighting up on their pings, the void, the door of light. |
| s06 The cost | V18–V23 | 106.69–134.46 | Plan cards D01–D06: unanswered phone, auto-replies, "thinness". |
| s07 4 AM | V24–V27 | 136.06–170.76 | Plan cards E01–E10: dread, shaking hands, tests pass, "HE built that". |
| s08 Dawn | V28–V30b | 172.56–200.26 | Plan cards F01–F07: sunrise, the full glass, "doesn't know what to do now". |

**The goal:** cinematic direction scene by scene, like a film, not rendering the whole chapter at once.

## 4. What was done this session

1. **Read and mapped** the project, s03, the ch1 plan, the storyboards and the VO guide.
2. **Audio package unpacked** into `audio/Ch01_VO_SoundPackage/`.
   - The guide, timeline, cue sheet and tools are in git; the 134 MB of audio is gitignored.
   - **The six zips contain no voiceover clips.** ElevenLabs generated 72 takes, but the download was blocked, so `02_VOICEOVER/clips_DROP_HERE/` is empty.
3. **Missing audio in exports, cause found.**
   - `project.json` had `voiceover: null` for s03 until 15:10 today, so earlier renders skipped the audio mux without any error.
   - The 4K render started at 15:50 has the path set, so it should produce a `_voiceover.mp4`. **Not checked yet.**
4. **Scene s04 "Two days ago" built.**
   - **Duration:** 31.32 s, chapter 36.96–68.28, 7 shots.
   - **Files:**
     - `engine/scenes/s04/scene.js`
     - `engine/scenes/s04/ivan.glb` (new performance `SCENE_S04` in `acting.py`)
     - `engine/scenes/s04/sound.wav` (the no-VO sound design slice)
     - `engine/scenes/s04/look.json` (copy of s03's grade)
     - `scenes/04-two-days-ago/DIRECTION.md` (full direction)
   - **Shots:**

     | Shot | Time | What happens |
     |---|---|---|
     | B01 Two days ago | 0–4.9 s | The light runs backwards from 3 AM to day; the glass disappears. |
     | B02 Drowning | 4.9–10.0 s | Profile; he types, then shoves back, hands behind his head. |
     | B03 Send | 10.0–13.5 s | Over the shoulder; "drowning here!" typed into a Claude chat. |
     | B04 Hello, Claude | 13.5–18.6 s | Claude's spark rises out of the laptop on the chime (board A). |
     | B05 The offer | 18.6–23.0 s | The floating chat card with the pipeline sketch (board A, "complaining to claude"). |
     | B06 yes | 23.0–26.7 s | Hands type y-e-s, Enter. |
     | B07 The plan | 26.7–31.3 s | Smash back to 3 AM on the sub drop: the REVIEW + APPROVE note, focus slipping to his face. |

   - **Reused screens:** the ch1 screens (inbox, chat, reply, yes) run through a time map onto the VO clock.
   - **Daylight:** the desk lamp, lamp glow and screen lights dim automatically.
   - **Checked:** four rounds of check frames (`renders/s04/check1`–`check4`, CPU, 960×540). B02, B04, B05, B06 and B07 were reframed, and the spark's focus bug was fixed: it now writes depth.
5. **Shared fix:** `engine/scenes/s03/roomlight.js` now keeps the Look editor's baked-light levels instead of overwriting them every frame. This also affects ch1.
6. **Committed** `51a7699` on `claude/wonderful-franklin-gzawe0`. Your uncommitted s03 lighting and look work was left untouched.

## 5. Status right now

- **Your 4K s03 render** (`midnight_cinematic`, exp 0.5, lampK 0.6, scrK 0.2) is still running: 847/888 frames at 16:45, then the encode. Output goes to `renders/s03/mv9e0u5vjgw/`, delivered to `deliver/`.
- **The daylight bake was cancelled** (paused on request). `engine/scenes/s03/lighting/` is still empty, so **s04's afternoon shots render in 3 AM light**.
- **Never viewed:**
  - s04 in daylight
  - s04 in real-time playback in the Studio
  - s04 with its sound in sync
  - the new 4K s03 export

## 6. What to do next (in order)

1. **Check the 4K s03 export.** Does `_voiceover.mp4` exist, and does it play with audio?
2. **Bake daylight** (GPU, when nothing is rendering). Use `--preview` for half-size maps (minutes); without it the full bake takes about 30 minutes:

   ```bash
   blender -b --factory-startup -P blender/scenes/set_room03.py -- engine/scenes/s03/lighting/day --bake --preset day --lm-only --preview
   ```

   Then look at s04 B01–B06 in the Studio. Bake `evening` (needed by s05) and `sunrise` (s08) the same way.
3. **Review s04 in the Studio** and leave notes. They go to `scenes/04-two-days-ago/NOTES.md`.
4. **Get the VO clips.**
   - Download the 72 takes from the ElevenLabs flow (link in `audio/.../README.md`) into `clips_DROP_HERE/`.
   - Run `tools/build_vo.py`, then `render_mix.py`.
   - Re-cut each scene's sound from `ch01_FULL_mix_VO_plus_sound.wav`.
   - Re-lock s04's estimated sentence splits inside V09 and V10 (`CAPTIONS` and `MAP` in `scene.js`, plus the `SCENE_S04` keys).
5. **Re-time s03 to the new VO clock** (V01 at 3.0 s instead of 6.0 s), keeping your camera work.
6. **Build s05 "The cheat code"** the same way as s04:
   - fork the room;
   - take the plan cards C00–C07 and V01–V04, re-timed to V12–V17;
   - light the 4 modules on their pings (Calendar, Scheduler, Docs, Research);
   - build the void stage;
   - cut the pulse dead at the vacuum (104.29 s);
   - add the sound slice and check frames.
7. Then s06, s07, s08.
8. Remaining polish on s03 that you mentioned: more intentionality, plus blur and focus work.

## 7. Open decisions for you

1. **Phone or laptop in the flashback.** Board A shows him reclined with the phone; s04 keeps him at the laptop (the script says he types). The phone needs a new hand performance.
2. **Claude's spark.** Is the warm starburst Claude's recurring "face" for every chime (V07a, V10, V27, V30)?
3. **The floating UI card** (board A and B style). Keep it as film language? It can be turned off with `?card=0`.
4. **The chapter plan's other open questions** are in `CHAPTER1_PLAN.md` §6:
   - phone on the bed vs the couch;
   - a window facing east for the sunrise;
   - a face rig (blinks, smile);
   - bloodshot eyes and lens reflections;
   - the ending pose;
   - the 4 AM lamp.

## 8. Where things are

| What | Path |
|---|---|
| Script | `docs/script/life-on-claude-nine_ch1-3.md` |
| Chapter plan, boards | `scenes/ch1/CHAPTER1_PLAN.md`, `scenes/ch1/storyboards/` |
| Ivan's room notes | `scenes/03-ivan-room/` (PLAN, FOCUS_PLAN, STYLE_LOCK, LESSONS) |
| Flashback direction | `scenes/04-two-days-ago/DIRECTION.md` |
| VO and sound package | `audio/Ch01_VO_SoundPackage/` (start with `01_GUIDE/`) |
| Workflow and rules | `CLAUDE.md`, `docs/WORKFLOW.md` |
| Capture a check frame | `node tools/capture.mjs --url http://localhost:8080/engine/index.html --out <dir> --at 12.5 --w 960 --h 540 --extra "scene=s04&look=midnight_cinematic"` |
