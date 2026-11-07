# Handoff: the studies (room rebuild, PS1 Last Train) on another machine

Repo: https://github.com/ShirokoKun/Life-on-Claude-9 · branch `ccr-82c69111-n0p4q2`
Tags: `ps1-last-train-v1`, `ps1-last-train-v2` (frozen approved PS1 looks).

```bash
git clone https://github.com/ShirokoKun/Life-on-Claude-9.git
cd Life-on-Claude-9 && git checkout ccr-82c69111-n0p4q2
npm install
```

## What is where
| Work | Files |
|---|---|
| The tutorial-room rebuild (Blender + Cycles) | `blender/scenes/tutorial_room.py`, `blender/lib/room_kit.py`, `blender/lib/props_office.py`, textures `blender/assets/room/`, post `tools/room_post.py`, finish `tools/room_finish.sh` |
| PS1 Last Train v1 / v2 / v3 (three.js) | `engine/studies/ps1-subway-v1`, `-v2`, `-v3`; characters `blender/characters/ps1_noor.py`, `ps1_passenger.py` |
| Earlier studies | `engine/studies/ps1-subway`, `engine/studies/cistern`, p5.brush painter `engine/studies/painter` |
| Renders delivered | `deliver/studies/` (films, stills, review sets, sound credits) |
| Knowledge | `docs/STUDIES.md`, `docs/TASTE_BASELINE.md`, `docs/TUTORIAL_AI_ROOM_BUILD.md`, `docs/claude-memory/` (copy into `~/.claude/projects/<repo folder>/memory/`), the director's pack `reference/scene-builder-pack/`, skill `.claude/skills/ai-scene-builder/` |

## Rebuild the Blender room on a Mac
The room is built by script: there is no .blend in git; the script writes one.
1. Install Blender 5.2 (blender.org).
2. Fetch the CC0 Poly Haven models it uses (not in git):
   `node tools/polyhaven.mjs --res 2k cardboard_box_01 wall_clock office_notepads stationery_supplies medical_tape pliers digital_wrist_watch retro_multimeter circuit_board binder_notebook cassette_player Camera_01 vintage_stapler clipboard Sofa_01 desk_lamp_arm_01`
3. Build, save and render one still:
   `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python blender/scenes/tutorial_room.py -- out.png --res 1280x720 --samples 48 --cam still_room --novol --blend room.blend`
   - Open `room.blend` in Blender to edit it by hand.
   - Cameras: `still_room`, `still_desk`, `still_mug`, `still_toys`, `still_chair`, `still_corner`, `wide`.
   - `--audit DIR` writes the plan, an isometric view and the overlap list.
   - `--film 1` renders the 20 s walk-through (`--range a-b` for part of it). On a Mac GPU, set the device to METAL in the script.

## PS1 Last Train
- **View it:** run `npm run serve`, then open http://localhost:8080/studies/ps1-subway-v3/.
- **Render it:** `node tools/study_render.mjs --study ps1-subway-v3 --film --w 1920 --h 1080 --mp4 out.mp4`
- **Characters:** the built `.glb` files are in git. Rebuilding them needs the Quaternius Universal Base Characters pack (CC0, itch.io, free).

## Not in git (too large, or re-downloadable)
- **Sound recordings:** the CC0 sources are listed in `deliver/studies/SOUND_CREDITS.md`.
- **The director's scene pack:** the Blender bedroom (2.9 GB) and the Unreal walkthrough (4.0 GB) are on the director's Drive.
- **The film's raw frames:** in `renders/`.
