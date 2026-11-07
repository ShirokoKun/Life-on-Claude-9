# Life on Claude Nine: the complete handoff (studies, room rebuild, PS1 scenes)

Updated 2026-11-07. Give this file to the Claude on the new machine first.

---

## 1. Where everything lives

| What | Link / location |
|---|---|
| GitHub repo | https://github.com/ShirokoKun/Life-on-Claude-9 (`ShirokoKun/Life-on-Claude-9`) |
| Branch with all the new work | `ccr-82c69111-n0p4q2` |
| Frozen PS1 looks (git tags) | `ps1-last-train-v1`, `ps1-last-train-v2` |
| The AI-room tutorial video (the quality reference) | https://drive.google.com/file/d/1jSXkj6Lq8ZW2q42jvTbct09q44iSJcaQ/view |
| The project book PDF (Life on Claude Nine, the full system, 249 pages) | https://drive.google.com/file/d/1rHS7cQPygzUn58MTPaHGBByj_YPjJXtT/view |
| The scene pack: AI Scene Builder skill, prompts, Blender bedroom, Unreal walkthrough | https://drive.google.com/drive/folders/1uT4k3jHTTgw46BAEBlhzQxYyFSOzjF-y |
| CC0 base characters (Noor and the passengers are built on these) | https://quaternius.itch.io/universal-base-characters (the free Standard pack) |
| Blender 5.2 | https://www.blender.org/download/ |

---

## 2. Get the code

```bash
git clone https://github.com/ShirokoKun/Life-on-Claude-9.git
cd Life-on-Claude-9
git checkout ccr-82c69111-n0p4q2
git checkout -b mac-work          # work on your own branch; this machine keeps rendering on the one above
npm install
node tools/setup_check.mjs        # the repo's new-machine check (fonts and assets for the main film)
```

Give Claude its memory: copy `docs/claude-memory/*.md` into `~/.claude/projects/<the repo folder, slashes as dashes>/memory/`.
These notes hold the director's taste, the tutorial method, the rejections and their lessons, and the craft rules.

---

## 3. Get the Drive files

**Scene pack** (folder link above). It has three parts; download only what you need:

| File in the folder | Size | What to do |
|---|---|---|
| `01 - Install the Skill/AI Scene Builder - Install This.zip` | 1 MB | Already in the repo at `.claude/skills/ai-scene-builder/`. Claude Code picks it up in this repo; nothing to do |
| `03 - Copy the Prompts/` (master prompt, nine stage prompts, example images) | small | Already in the repo at `reference/scene-builder-pack/` |
| `02 - Download the Scene/Blender Bedroom - Download Scene.zip` | 2.9 GB | Download it and unzip it outside the repo, e.g. `~/Studio/bedroom/`. Open the `.blend` inside (folder `Daytime-Bedroom-Student-Walkthrough`) in Blender 5.2 |
| `02 - Download the Scene/Unreal-Bedroom-Day-Walkthrough.zip` | 4.0 GB | Optional, only for Unreal |

Command-line download (any machine with Python):

```bash
pip install gdown
gdown --folder "https://drive.google.com/drive/folders/1uT4k3jHTTgw46BAEBlhzQxYyFSOzjF-y"
cd "Blender Bedroom - Free Download/02 - Download the Scene"
unzip "Blender Bedroom - Download Scene.zip" -d ~/Studio/bedroom
```

**Tutorial video and book PDF:** open the links and download them, or:

```bash
gdown 1jSXkj6Lq8ZW2q42jvTbct09q44iSJcaQ -O tutorial_ai_room.mp4
gdown 1rHS7cQPygzUn58MTPaHGBByj_YPjJXtT -O life_on_claude_nine_book.pdf
```

Keep large files out of git. The repo already ignores `renders/` and `blender/assets/props/`.

---

## 4. What was made in this session, and where it is

| Work | Status | Files |
|---|---|---|
| The tutorial-room rebuild (Blender + Cycles) | Design audited and fixed. The 20 s walk-through is rendering | Script `blender/scenes/tutorial_room.py`, kit `blender/lib/room_kit.py`, props `blender/lib/props_office.py`, printed textures `blender/assets/room/` (`tools/make_room_textures.py`), grade `tools/room_post.py`, finish (grade + 1080p + sound) `tools/room_finish.sh` |
| Room deliverables | Done | `deliver/studies/room/`: the 12 s first walk-through, `stills1440/` (desk, doorway), `review720/` (six angles, plan, iso, clock fix), comparisons with the tutorial |
| PS1 "Last Train" v1 (approved look, frozen) | Done | `engine/studies/ps1-subway-v1/`, tag `ps1-last-train-v1` |
| PS1 v2 (CC0 rigged Noor, p5.brush graphics) | Frozen | `engine/studies/ps1-subway-v2/`, tag `ps1-last-train-v2`, `blender/characters/ps1_noor_v2.py` |
| PS1 v3 (cigarette rules, passengers, elevated city, thirds composition, warm light, real sound) | Done | `engine/studies/ps1-subway-v3/`, `blender/characters/ps1_noor.py`, `ps1_passenger.py`, `deliver/studies/ps1-v3/last_train_v3_sound_1080.mp4` |
| p5.brush texture painter | Done | `engine/studies/painter/`, `tools/paint_textures.mjs`, `engine/vendor/p5/` |
| Earlier studies (the rejected Cistern, PS1 libs) | Kept for reference | `engine/studies/cistern/`, `engine/studies/lib/`, `docs/rejected/` |
| Sound sources (all CC0, all real recordings) | Listed | `deliver/studies/SOUND_CREDITS.md` |
| Knowledge | Up to date | `docs/STUDIES.md`, `docs/TASTE_BASELINE.md`, `docs/TUTORIAL_AI_ROOM_BUILD.md`, `docs/claude-memory/`, `docs/HANDOFF_STUDIES_MAC.md` |

---

## 5. Run things on the Mac

**The room** is built by a script; there is no .blend in git, and the script writes one.

```bash
# the free CC0 Poly Haven props it places (not in git)
node tools/polyhaven.mjs --res 2k cardboard_box_01 wall_clock office_notepads stationery_supplies medical_tape pliers digital_wrist_watch retro_multimeter circuit_board binder_notebook cassette_player Camera_01 vintage_stapler clipboard Sofa_01

BL=/Applications/Blender.app/Contents/MacOS/Blender
# build + save an editable .blend + one still
$BL -b --factory-startup --python blender/scenes/tutorial_room.py -- out.png --res 1280x720 --samples 48 --cam still_room --novol --blend room.blend
# design check before any long render: plan, isometric, overlap list
$BL -b --factory-startup --python blender/scenes/tutorial_room.py -- x.png --audit audit_dir --novol
# the 20 s walk-through, then grade + 1080p + sound
$BL -b --factory-startup --python blender/scenes/tutorial_room.py -- renders/studies/room/walk20 --res 1280x720 --samples 40 --noise 0.04 --film 1 --novol
tools/room_finish.sh renders/studies/room/walk20 <folder with the CC0 sounds> deliver/studies/room/room_walkthrough_20s_1080.mp4
```

- **Cameras:** `still_room`, `still_desk`, `still_mug`, `still_toys`, `still_chair`, `still_corner`, `wide`, `wallcheck`.
- **On an Apple Silicon GPU:** set `sc.cycles.device = 'GPU'`, and Metal in Blender's Preferences. Native 1080p becomes practical there.

**The PS1 scene:**

```bash
npm run serve                      # then open http://localhost:8080/studies/ps1-subway-v3/
node tools/study_render.mjs --study ps1-subway-v3 --film --w 1920 --h 1080 --mp4 out.mp4
```

---

## 6. The rules this session learned (also in `docs/claude-memory/`)

1. **Order of work:** refine, then audit (plan, overlaps), then 720p review stills, and only then the long render.
2. **Approval:** keep the approved version frozen (a copy plus a tag) and improve a duplicate.
3. **Assets:** prefer real CC0 assets and recordings. Never use generic modular kits for hero sets, and never synthesise sound when a real recording exists.
4. **Look:**
   - dim grey-green walls against bright blinds;
   - muted prop colours;
   - satin surfaces, never mirror-shiny;
   - real 24 fps with motion blur, never interpolated frames.
5. **Characters:**
   - colour blocks come from body regions, not from patterns on an automatic UV unwrap;
   - hand-to-mouth actions are checked by rules: the filter meets the lips, the wrist is aligned, no fingers inside the face.
6. **Originality:** every design is original. Don't recreate known characters or brands; the tutorial's dinosaur became an original bear.

---

## 7. Still in progress on the cloud machine

- **The 20 s room film** (1280×720, real 24 fps, motion blur, focus pulls): it renders until about 02:50 UTC on 2026-11-08, then a scheduled check-in grades it, upscales it to 1080p, adds sound and delivers it to `deliver/studies/room/`.
- **The learning pass** on the bedroom scene and the prompts: it waits for the director's time zone so it can be scheduled after 00:30.
