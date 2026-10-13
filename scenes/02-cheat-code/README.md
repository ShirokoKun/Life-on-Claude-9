# Scene 2: The cheat code

| File | What it is |
|---|---|
| `STORYBOARD.md` | Script, colour script, the 15 shots, environments, acting, production plan |
| `previs.sh` | Cycles stills of key frames at the day, evening and sunrise presets (optional) |
| `../../engine/scenes/s02/scene.js` | The scene in the engine: shots, times of day, screens, props |
| `../../engine/scenes/s02/ivan.glb`, `ivan_stand.glb`, `acting.json` | The seated performance (74 s), the doorway, the keystrokes |

**Run it:**

```bash
npm run serve                                   # then open http://localhost:8080/index.html?scene=s02
node tools/capture.mjs --out renders/s02 --frames 0-1775 --w 1280 --h 720 --extra "scene=s02"
```

**Timing:**
- The shots follow an estimated read (about 72 s).
- When the voiceover arrives, `SHOTS`, `CAPTIONS`, `LIGHT` and the acting script (`SCENE_S02` in `blender/characters/acting.py`) are retimed to its pauses.
- `VO_OFFSET` is set, and the performance is regenerated with `prep_tripo.py --scene s02`.

**Times of day:**
- The day, evening and sunrise lightmaps are baked with `export_engine.py --preset <set> --lm-only --half` into `engine/assets/lighting/<set>/`.
- Until they exist, the engine borrows the night lightmaps, so daylight shots are too dark.
