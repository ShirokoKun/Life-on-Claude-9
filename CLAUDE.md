# Life on Claude Nine: notes for Claude

An animated short rendered in a three.js engine (`engine/`), with light baked and the set built in Blender (`blender/`). The human runs the **Studio** (`npm run studio`, http://localhost:8080) to watch, review and render. Read `docs/WORKFLOW.md` before changing the look, the lighting or the acting.

## Start of every session
0. **New machine check.** Run `node tools/setup_check.mjs` before anything else.
   - If any line says `MISSING`, stop. Ask the human for exactly those items, naming each one and the folder of the transfer pack (`Mac_transfer.zip`) it comes from. `MAC_TRANSFER_GUIDE.md` has the table.
   - Do not work around a missing font or file: the film would render differently.
   - If the human points to an unzipped pack, install it for them: `into-repo/` into this repo; `into-workspace/` two folders up; `claude-memory/*.md` into this project's `~/.claude/projects/<folder>/memory/`. The fonts they install themselves in Font Book.
   - Rerun the check until everything says `ok`.
1. Read the open notes in `scenes/*/NOTES.md`: lines `- [ ] **<shot> @ <t> s** <text>`. The human left them in the Studio's player at that exact moment.
2. Fix them, then tick them: `- [x]`.
3. `project.json` lists the scenes. A scene is `engine/scenes/<id>/scene.js` (the intro is `engine/src/shots.js`) plus `scenes/<nn-name>/`.

## Locked (do not change without being asked)
- **The render style:** the `LOOK` in `engine/src/post.js`, the lens, grain, letterbox, AgX grade and the post order.
- **Ivan:** his model, rig and materials, and the acting system (`blender/characters/acting.py`); performances are added, never rewritten.
- **The camera language:** one move per shot, real focal lengths, keyed focus pulls.

## How to see your work
- **One frame:** `node tools/capture.mjs --out <dir> --at 12.5 --w 960 --h 540 [--extra scene=s02] [--gpu]`. It needs the engine served: `npm run serve -- 8791` (its default URL), or pass `--url http://localhost:8080/engine/index.html` while the Studio runs.
- **A film:** `node tools/render_mp4.mjs --scene <id> [--w 1280 --h 720] [--frames a-b]`. Output goes to `renders/<id>/<take>/`.
- **Acting:** change `blender/characters/acting.py`, then re-export with `blender/characters/prep_tripo.py --scene <id>`. Check the hands: no fingers in the face, no flipped wrists.
- **Light for another time of day:** `blender/scenes/export_engine.py engine/assets/lighting/<preset> --preset <preset> --lm-only`.

## Conventions
- Coordinates in scene files are Blender metres (x, y, z up); `B(x, y, z)` converts them for three.
- Times are seconds at 24 fps. The voiceover starts at the scene's `VO_OFFSET`.
- Keep the intro pixel-identical when you refactor shared engine code: render a frame before and after and compare them.
- Commit small and descriptive; the human follows the branch in the Studio.
