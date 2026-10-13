# Rebuilding "Life on Claude Nine", intro scene

Everything needed to rebuild this project from zero, or to hand it to a new session. It pairs with
`docs/CINEMATIC_THREEJS_PLAYBOOK.md` (the general method) and `docs/LOOK_ANALYSIS.md` (measurements).

## 1. The story beat

**Ivan,** a software engineer, at 3 AM. He is in the zone: energised, immersed, positive, forgetting
everything else. It's a comfy, cozy cocoon of light in a dark flat.

The voiceover (`engine/assets/voiceover.wav`, 28 s, ElevenLabs) starts at **film time 1.5 s**:

| # | Line | VO time (s) | Film time (s) |
|---|---|---|---|
| 1 | It's 3 AM and Ivan hasn't eaten since lunch. | 0.0–3.8 | 1.5–5.3 |
| 2 | There's a glass of water on his desk that he poured six hours ago. | 4.5–7.8 | 6.0–9.3 |
| 3 | It's still full. | 8.6–9.5 | 10.1–11.0 |
| 4 | He's hunched over his laptop, typing furiously, eyes bloodshot. | 10.2–14.3 | 11.7–15.8 |
| 5 | On the screen: a terminal window, a Claude chat, and a growing sprawl of Python scripts. | 14.8–20.4 | 16.3–21.9 |
| 6 | He's building an email automation system. | 21.0–23.0 | 22.5–24.5 |
| 7 | Not because anyone asked him to. | 23.6–25.2 | 25.1–26.7 |
| 8 | Because he realized he could. | 25.9–27.5 | 27.4–29.0 |

The film is **32 s at 24 fps (768 frames)**: five shots, four cuts (`engine/src/shots.js`).

| Shot | Time | Lens | Move | Intention |
|---|---|---|---|---|
| S1 The zone | 0–5.6 | 24→30 mm f/2.8 | descending push from the living room | he is small inside his lit corner |
| S2 Still full | 5.6–11.4 | 55→58 mm f/1.6 | desk-height drift; focus glass → Ivan → glass | the untouched glass |
| S3 Lit by the work | 11.4–16.2 | 50→62 mm f/2 | push in on the face | screen key, he leans in, types faster |
| S4 The sprawl | 16.2–22.2 | 30→35 mm f/2.8 | over the right shoulder into the screens | terminal, Claude chat, scripts; a glance at the dashboard |
| S5 Because he could | 22.2–32 | 35→26 mm f/3.2 | arc right → left and out | his cocoon; a small nod; fade |

## 2. The set (Blender, metres, Z up; three.js uses x, z, −y)

- **Flat:** measured plan in `blender/scenes/apartment_shell.py` (`APT`). The bedroom partition is at
  x 3.40–3.52. The east window faces east (city, parking lot with sodium lamps).
- **Desk:** walnut, 1.40 × 0.70 at (6.95, 3.20), top at 0.75 m. Ivan sits at (6.95, ~2.6) facing +Y (north).
- **On the desk** (`blender/lib/props_desk.py`):
  - laptop (6.95, 3.10) with code on screen;
  - second monitor (7.36, 3.32), rotated −28°, showing a dashboard;
  - **desk lamp on the back-left corner (6.33, 3.47)**, head reaching over the keys (it was behind the
    monitor, which was fixed);
  - the full glass of water (6.66, 3.10);
  - cold mug (6.30, 2.97), empty mugs, notebook (6.52, 2.97), mouse, phone (7.40, 2.93);
  - take-out box on the papers (6.58, 3.43);
  - clock at 3:04, cans, rubber duck, headphones, pen cup, cables.
- **Room life** (`props_story.py`, `props_clutter.py`):
  - shelf behind his right shoulder with books (Superintelligence and others), binders, speakers and a pothos;
  - string lights on the wall;
  - cork board on the east wall;
  - monstera and snake plant;
  - boxes, a hoodie, a backpack, a fan, a rug, curtains;
  - bathroom light left on (a warm spill).
- **Exterior** (`exterior.py`): city facades with window grids, a parking lot, poles, cars, sodium lamps.
- **Lighting (Cycles, `lighting.py`, preset `3am`):**
  - laptop key (area 4 W, 0.29 × 0.18, cool);
  - desk lamp (spot 24 W, 85°, warm 2700 K-ish);
  - string-light fills, the bathroom practical, city area lights, sodium spots;
  - exposure +1.35, AgX "Punchy".

## 3. The character

- Source: `blender/assets/characters/ivan_meshy.glb`, the provided Tripo model:
  - 65-bone Mixamo rig;
  - 4K colour and normal maps;
  - sweater, collar, round glasses, trousers, brown shoes.
- `blender/characters/prep_tripo.py`:
  - drops the stray helper sphere and scales him to 1.80 m;
  - joins the pieces;
  - **re-weights the head rigidly** (the mouth tore open otherwise);
  - seats him at the desk with world-space aims and 2-bone IK to the keys;
  - keys a 32 s performance timed to the voiceover:
    - typing bursts, fastest on "typing furiously";
    - breathing;
    - a lean-in on line 4;
    - a read pause and a glance at the second screen on line 5;
    - a nod on line 8, then sitting back.
- Output: `engine/assets/ivan.glb`. In three.js he renders `DoubleSide`, because some generated pieces have flipped normals.

## 4. Pipeline commands

Blender runs headless through the `bpy` pip module (Blender 5.x API), or with `blender -b -P script -- args`.

```bash
# 1. room: build, bake lightmaps (Cycles, ~45-90 min on CPU at 4K), export
python -I blender/scenes/export_engine.py engine/assets --samples 40          # --small for a 1-minute test
#    (resumable: add --resume to skip groups whose lm_*.exr already exists)
#    writes engine/assets/room.glb, lightmaps/lm_{ARCH,DESK,ROOM}.exr, lights.json, room_lit.blend

# 2. character
python -I blender/characters/prep_tripo.py blender/assets/characters/ivan_meshy.glb engine/assets/ivan.glb

# 3. textures: CC0 sets in engine/assets/tex/<key>/{albedo,normal,rough}.jpg + manifest.json (CREDITS.md)

# 4. view
npm install && npx playwright install chromium
npm run serve            # http://localhost:8080

# 5. render the film (GPU): renders/claude_nine_intro_1920x1080.mp4 (+ _voiceover.mp4)
npm run render
```

The Cycles-only scene (no engine) is `deliver/claude_nine_room_3am.zip` (`set_intro_3am.blend`): open it
in Blender 4.2+ and render.

## 5. Engine map (`engine/`)

- `src/materials.js`: Blender material name → texture set + target albedo + finish. Add new props here.
- `src/lights.js`: the live lamp (shadows), the laptop area light, the monitor kicker and Ivan's rim.
- `src/atmosphere.js`: 2,400 dust motes lit by the lamp cone and screens (bokeh when out of focus), plus the lamp beam.
- `src/post.js`: the `LOOK` constants (DOF strength, haze, bloom, grain, vignette, halation, letterbox).
- `src/shots.js`: shots, lenses, focus pulls, captions, `VO_OFFSET`.
- URL flags:
  - `?render=1` (capture mode);
  - `?cam=px,py,pz,tx,ty,tz,mm,f` (fixed camera);
  - `?fx=0` (no lens/post);
  - `?ivan=0` (no character);
  - `?debug=lm` (show only the lightmaps);
  - `?caps=1` (captions);
  - `?q=med` (lighter settings).

## 6. History: what went wrong before (so you don't repeat it)

1. **Built for a 16 MB artifact.** It forced low-res JPEG atlases and inline base64. A local web app
   has no such limit.
2. **Baked light × colour into one texture.** It looked flat and plastic, with no view-dependent shine
   and no close-up detail. Now: irradiance lightmaps plus real PBR textures plus reflections.
3. **Live lights on the character's albedo** with strong bloom made him a glowing mannequin. Now: physical
   intensities, restrained bloom, a rim for separation.
4. **Grain 6× the reference, saturation half, blue shadows.** Measured with `tools/look_metrics.py` and corrected.
5. **Lamp behind the monitor.** Moved to the back-left corner, aimed at the keys.
6. **Curves (cables) skipped by the bake** made them glow white. Now converted to meshes first.
7. **CPU-only rendering in the cloud** (10–30 s per frame). Render on a GPU machine.

## 7. Next ideas

- A proper Cycles reference still per shot (`room_lit.blend`), for a parity sheet each round.
- Eye shader and hair cards for the character close-up; subsurface-like wrap lighting on skin.
- Screen content animation (scrolling code, a growing file tree) as video textures.
- 4 AM and sunrise variants (relight with a different bake, same engine).
