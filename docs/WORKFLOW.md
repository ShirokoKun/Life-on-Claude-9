# Life on Claude Nine: the complete workflow

This is the master document: how this film is made, from references to the MP4, with every locked setting, command and lesson. The other documents go deeper on single topics:

| Document | Contents |
|---|---|
| `docs/CINEMATIC_THREEJS_PLAYBOOK.md` | The general method, for any cinematic three.js project |
| `docs/REBUILD_THIS_PROJECT.md` | This project from zero: story, set, character, commands |
| `docs/LOOK_ANALYSIS.md` | Measurement rounds 1–5 and the lighting setup table |
| `docs/REFERENCE_GAP_ANALYSIS.md` | Every reference, the bar it sets, and the scorecard |
| `docs/FRAME_DESIGN_ANALYSIS.md` | Composition and light structure vs the references (round 7) |
| `docs/WORLD_BIBLE.md`, `docs/APARTMENT_SPEC.md`, `docs/LOOK_BIBLE.md` | Story world, flat layout, look |
| `engine/README.md` | Running and rendering the engine locally |

---

## 1. Pipeline at a glance

```
 references ─► look targets (measured)                             docs/LOOK_ANALYSIS.md
     │
 Blender (headless, bpy) ─ build the flat + props + lights ─────── blender/scenes/set_intro.py
     │      └─ Cycles bake: irradiance lightmaps (full − live)     blender/lib/lightmap.py
     │      └─ export room.glb (UV0 tiling, UV1 lightmap)          blender/scenes/export_engine.py
     │
 Character: images → Tripo (multiview, Smart Mesh, PBR, rig)
     │      └─ Blender: scale, glasses, rigid head, seat, act      blender/characters/prep_tripo.py
     │
 three.js engine ─ PBR materials, live lights, lens, atmosphere    engine/src/*.js
     │      └─ shots timed to the voiceover                        engine/src/shots.js
     │
 capture (headless Chromium, frame-exact) ─► ffmpeg ─► MP4         tools/capture.mjs, tools/render_mp4.mjs
     │
 check: parity vs Cycles, metrics vs references, contact sheets    tools/look_metrics.py, tools/frame_design.py
```

## 2. Locked settings (the baseline every new scene inherits)

### 2.1 Look (`engine/src/post.js`, `LOOK`)

| Setting | Value | Why |
|---|---|---|
| Tone mapping | AgX, exposure Blender +1.35 EV, trim −1.0 EV | Matches the Cycles stills (median luminance) |
| Depth of field | thin lens on a 36 mm sensor × 2.0, computed at half resolution | References keep about 5% of the frame sharp |
| Haze | 0.10, colour (0.010, 0.010, 0.016) | Depth separation, not fog |
| Bloom | strength 0.32, radius 0.72, threshold 1.4 (HDR) | Halos around sources only |
| Halation | 0.14 | Red-orange glow on hot edges |
| Grade | saturation 1.20, contrast 1.10, highlights near-neutral, a hint of night in the deepest blacks | References: rich, clean |
| Grain | 0.004, shadow-weighted | References: noise around 0.12 |
| Vignette, chromatic aberration | 0.42, 0.0012 | |
| Letterbox | 2:1 | |

### 2.2 Lighting: the night key rig (`engine/src/lights.js`)

The principle is one dominant key per subject from the side, low fill (about 8:1), shadows on, and light sources visible in frame.

| Light | Type | Role |
|---|---|---|
| Cycles lightmaps | baked | Everything static: city, sodium, string lights, bathroom spill, bounce. Walls at `lm` 0.45 |
| Desk lamp | spot, shadows, 62° | Warm pool on the keys; flickers ±1% |
| Monitor | spot, shadows, cool, range 1.7 m | **The side key on Ivan's face**; casts his shadow on the wall |
| Laptop face key | spot, blue, range 1.05 m | Low front fill on the face |
| Laptop area | rect area, 0.22× Blender | Soft screen spill |
| Backlight | spot, pale warm | Bathroom light behind him; rims hair and shoulders |
| Wall wash | spot, shadows (static) | A warm pool on the wall behind him |
| Blinds | spot with a slat cookie, shadows (static) | Sodium streetlight stripes on the ceiling and walls |

Ivan's material: envMapIntensity 0.15, sheen 0.15, albedo × 0.84, double-sided.

### 2.3 Materials (`engine/src/materials.js`, `LIB`)

- Every Blender material name maps to a CC0 texture set, a target albedo, and a finish:
  - matte: paper, plaster, fabric;
  - satin: desk, floor, plastics;
  - gloss: screens, glass, ceramics.
- Hero glass and water are reflective transparent materials that write depth (so the lens can focus on them). Screens run at 0.45× Blender emission.

### 2.4 Camera language (`engine/src/shots.js`)

- **Moves:** one move per shot (push, drift, rack, arc), eased.
- **Handheld:** sub-degree operator breathing plus a millimetre drift.
- **Lenses:** real focal lengths and f-stops.
- **Focus:** keyed pulls (`focus: [[t, target], ...]`), with targets `'eyes'` (tracked from the head bone), `'screen'`, or a point.
- **Composition:** look room; foreground, subject and background layers; light sources in frame.

### 2.5 Life (always on)

- **Ivan:** the per-frame acting system (section 3.4): posture, gaze, real keystrokes, breathing.
- **Room:** string-light shimmer, monitor flicker, LED blinks, lamp hum, drifting dust (shown as bokeh when out of focus).

## 3. Step by step

### 3.1 References and targets

1. Collect the frames.
2. Run `python3 tools/look_metrics.py <frames>`: black share, median luminance, saturation, warmth, noise, sharpness, highlight area.
3. Run `python3 tools/frame_design.py <frames>`: contrast, mid-grey share, key/fill, subject/background separation, light centroid.
4. Write the target ranges into `docs/LOOK_ANALYSIS.md`.

### 3.2 Set (Blender)

- Real scale in metres: Blender Z is up; three.js uses (x, z, −y).
- The flat comes from `apartment_shell.py`. Props are generator functions in `props_*.py`; lights are presets in `lighting.py`.
- Cycles still for a look check:

  ```bash
  python -I blender/scenes/set_intro.py out/ --blend --cams establish,desk34 --res 1280x640 --samples 48
  ```

### 3.3 Bake and export

```bash
python -I blender/scenes/export_engine.py engine/assets --samples 40          # add --small for a 1-minute test, --resume to skip finished groups
```

- Groups ARCH and DESK bake at 4096, ROOM at 2048.
- Output: irradiance only, as half-float EXR, `lm = full − live` (live = lamp + laptop key, emission off, geometry identical).
- Before baking: curves become meshes; metric box UVs go on every mesh; emitter meshes are set not to shadow the lights inside them.
- About 45–90 minutes on CPU. Bakes are resumable.

### 3.4 Character

1. **Images (Nano Banana Pro):** stylized-realistic feature-animation style, four separate views (front, back, exact 90° profiles), A-pose with arms 35–40° out, open hands, flat grey background, even light, no glasses.
2. **Tripo:**
   - Multiview → **Smart Mesh** (quad, about 30–50k faces, *no parts/segmentation*);
   - Texture: **PBR on**, highest quality;
   - Rig: **Humanoid, Mixamo preset**;
   - Export GLB.
3. **Prep:**

   ```bash
   python -I blender/characters/prep_tripo.py blender/assets/characters/ivan_tripo_v2.glb engine/assets/ivan.glb
   ```

   - Scales him to 1.80 m and joins the mesh.
   - Downsizes 8K maps to 4K.
   - Rigid head weights (so the mouth never tears).
   - Fits the glasses from the face profile.
   - Seats him and solves the performance frame by frame (`blender/characters/acting.py`, below).

4. **Acting** (`acting.py`, one script per scene in `SCENES`, written in film seconds):

   | Channel | What it drives |
   |---|---|
   | `hunch` | Posture curve: 0 upright, 1 deep hunch, negative leaning back. Forward only, never sideways |
   | `typing` | Windows `(start, end, keys/s)`; phrases of 6–18 keys with pauses; thumbs on space |
   | `gaze` | `(start, end, target, mode)`: screen, chat, monitor, away; `read` steps line by line |
   | `hands_rest`, `hands_behind` | Hands lifted off the keys; the arc up past the ears behind his head |
   | `rub`, `mouse`, `clicks` | Eye rub under the glasses; hand on the mouse; clicks on the index finger |
   | `exhale`, `nod` | Shoulders drop; a small nod |

   - Hands are solved by two-bone IK.
   - Fingers flex on axes measured from the rig in bone space, so they bend correctly in any pose.
   - `--events file.json` writes the keystroke times; the laptop screen types in sync with them.
   - `--stand x,y` makes a standing performance instead (scene 2's doorway).

   ```bash
   python -I blender/characters/prep_tripo.py SRC.glb engine/assets/ivan.glb --events engine/assets/acting.json
   python -I blender/characters/prep_tripo.py SRC.glb engine/scenes/s02/ivan.glb --scene s02 --seconds 74 --events engine/scenes/s02/acting.json
   python -I blender/characters/prep_tripo.py SRC.glb engine/scenes/s02/ivan_stand.glb --stand 4.75,5.05 --seconds 10
   ```

### 3.5 Scenes, screens and times of day

- **Scenes:**
  - The intro is `engine/src/shots.js`.
  - Every later scene is a module `engine/scenes/<id>/scene.js`, opened with `?scene=<id>`.
  - A scene exports its shots and captions, and optionally: `light(t)`, `SCREENS`, `props(t)`, `CAST`, `ivanVisible`, `atmoTime`, `exposureBoost`.
  - The engine core (`engine/src`) is shared. So the look, lens, materials and rig stay locked for every scene.
- **Live screens** (`engine/src/screens.js`):
  - The laptop and monitor are canvas textures drawn every frame, deterministic in time.
  - A focus target can be a screen pixel (`'lap:x,y'`, `'mon:x,y'`), which is how the reading shot pulls focus line by line.
- **Times of day** (`engine/src/timeofday.js`):
  - Each set is a Cycles lightmap bake on the same geometry (`assets/lighting/<set>/`; 3am is `assets/lightmaps/`) plus a live rig (night lights scaled, a sun with shadows, a sky fill).
  - Blends mix the lightmaps on the GPU and interpolate exposure in stops.
  - Bake a set:

    ```bash
    python -I blender/scenes/export_engine.py engine/assets/lighting/day --preset day --lm-only --half --samples 40
    ```

### 3.6 Engine and preview

```bash
npm run serve        # http://localhost:8080; Play runs with the voiceover
```

URL flags:
- `?render=1`: capture mode;
- `?cam=px,py,pz,tx,ty,tz,mm,f`: fixed camera;
- `?fx=0`: no lens or post;
- `?ivan=0`: no character;
- `?debug=lm`: show only the lightmaps;
- `?caps=1`: captions.

### 3.7 Check before rendering

```bash
node tools/capture.mjs --out /tmp/check --at 2.5,9.4,13.8,19,28 --w 960 --h 540
python3 tools/frame_design.py /tmp/check/*.png
```

- Parity against Cycles: `tools/cycles_ref.py room_lit.blend ivan.blend out --shots S1,S3`.
- Read every contact sheet against the references before a full render.

### 3.8 Render and encode

| Machine | Command | Notes |
|---|---|---|
| With a GPU | `npm run render` | Writes `renders/claude_nine_intro_1920x1080.mp4` plus a `_voiceover` version; real-time, minutes |
| No GPU (cloud) | `tools/render_loop.sh renders/v2_1080 0 443 --w 1920 --h 1080`, with a second loop on 444–887 | ~11.5 s/frame on 4 CPU cores. More workers don't add throughput. The loop restarts the capture until every frame exists and drops frames cut off mid-write. Don't run Cycles beside it: both slow to a crawl |

Encode:

```bash
ffmpeg -framerate 24 -i renders/final_1080/f_%05d.png -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart out.mp4
ffmpeg -i out.mp4 -itsoffset 6.0 -i engine/assets/voiceover.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -af apad -shortest out_vo.mp4
```

## 4. Lessons (the expensive ones)

1. **Don't build for a 16 MB artifact.** A local web app has no size limit; the artifact limit forced low-res JPEG atlases.
2. **Never bake colour into the lightmap.** Keep light (lightmap) and material (PBR textures) separate, or everything looks plastic.
3. **Emitters around lights steal light in Cycles.** The bulb mesh blocked the lamp. Set emitter meshes not to cast shadows, and keep geometry identical between the full and live bakes.
4. **Too many lights on a character flattens it.** One side key plus low fill.
5. **AI characters:**
   - generate them as one mesh (no parts);
   - after a glTF import, set `rotation_mode = 'XYZ'` before rotating;
   - render them double-sided;
   - make the head rigid.
6. **Transparent hero objects must write depth**, or the depth of field can't focus on them.
7. **Depth of field is the expensive pass.** Do it at half resolution and recombine.
8. **Measure.** Every round: metrics plus a contact sheet against the references, then fix the largest gap.
9. **Background jobs here stop at 2 hours.** Make bakes and renders resumable.
10. **Parents baked away.** Joining meshes into bake groups orphans their children: the monitor's screen sat at the world origin for the whole first film. Check every emissive at its real position.
11. **One geometry for every time of day.** Any mesh that exists in one preset but not another changes the lightmap UV layout. The lamp bulb now exists in every preset, and the clock is baked at 3:04.
12. **`pgrep -f` matches its own shell.** Use a pattern that can't match itself (`capture[.]mjs`) or a pid.

## 5. File map

```
blender/  lib/ (geo, materials, lighting, lightmap, bake, props_*), scenes/ (set_intro, export_engine, apartment_shell),
          characters/ (prep_tripo, ivan_pose), assets/characters/ (source GLBs)
engine/   index.html, src/ (main, materials, lights, atmosphere, post, shots, screens, timeofday),
          scenes/<id>/ (scene.js, performances), assets/ (room.glb, ivan.glb, acting.json, lightmaps/*.exr,
          lighting/<set>/, lights.json, tex/<set>/, voiceover.wav), vendor/three (r170)
scenes/   <nn-name>/ storyboards and scene notes
tools/    capture.mjs, render_loop.sh, render_mp4.mjs, serve.mjs, dump_screens.mjs, cycles_ref.py, look_metrics.py, frame_design.py
docs/     this file + the documents listed at the top
deliver/  films, contact sheets, the Blender scene zip, backups
```
