# Style studies: PS1 "Last Train" and AAA "The Cistern"

Two standalone scenes in `engine/studies/`, built from the director's references (`docs/TASTE_BASELINE.md`) and the
method in the AI-room tutorial (`docs/TUTORIAL_AI_ROOM_BUILD.md`). They don't touch the film's locked look:
each study has its own renderer and post chain.

## Run them

```bash
npm run serve                     # http://localhost:8080
# open http://localhost:8080/studies/ps1-subway/   and   http://localhost:8080/studies/cistern/
#   Space: pause, arrows: step a frame, ?t=4.2: hold a moment
#   ps1-subway:  ?res=640x360 (internal resolution), ?affine=0.15 (texture warp), ?cam=px,py,pz,tx,ty,tz,fov
#   cistern:     ?exp=1.0, ?rq=0.5 (reflection resolution), ?aspect=2.39 (0 = no letterbox), ?cam=...
node tools/study_render.mjs --study ps1-subway --at 0.5,3,6               # stills -> renders/studies/<id>/stills
node tools/study_render.mjs --study cistern --film --w 1920 --h 1080 --mp4 renders/studies/cistern/cistern.mp4
```

Renders are deterministic in t (`engine/studies/lib/harness.js`), so the preview and the render match.
Finished stills and films are copied to `deliver/studies/`.

## The systems (reusable)

| File | What it gives a new study |
|---|---|
| `lib/harness.js` | One clock for preview and render: `run({duration, update, render, ready})`, `?t=`, `?render=1` + `window.renderAt(t)`. `keyed()` for smooth keyframes |
| `lib/geo.js` | `loft()` (limbs, torsos, lathe-like props), `aim()` (place a segment between two joints), `box()` / `quad()` with UVs in metres, `extrude()` |
| `lib/ps1.js` | The PS1 look: low internal resolution upscaled with nearest filtering, a 4×4 Bayer dither into 15-bit colour, a grade, vertex snapping, an affine warp, `ps1Material` / `ps1Unlit`, the texture painter `paint(w, h, fn)` (fill, noise, mottle, painted AO, lines, discs, a 5×7 bitmap font), a seeded `rng`, `fbm` |
| `lib/cine.js` | The AAA kit: `pbr(id)` (CC0 sets in `studies/assets/tex/`), `wetten(mat)` (a wet line, glossy wet roughness, rain streaks), `beam()` (volumetric shafts), `fogCard` (drifting mist), `createPost()` (HDR → bloom → grade with split-tone, CA, vignette, grain, letterbox → AgX) |
| `tools/study_render.mjs` | Stills (`--at`) or a film (`--film`, resumable, `--mp4`) from any study |

## Last Train (`studies/ps1-subway/`): the PS1 look

**The frame.** Eye level across the aisle of a late-night car on an invented line (the Harrow Loop). The car recedes to a
lit end door at the left third. Noor sits right of centre against a black window, so her head reads against negative
space. Her red-and-black puffer is the frame's one hot colour against khaki panels, rust vinyl and a blue-grey floor.

**Built with intention:**
- Warm tubes overhead.
- A NO SMOKING sticker by her head (she's smoking).
- Her bag on the seat beside her.
- A can rolling by the door.
- A newspaper someone left further down.
- Graffiti on the door bays.
- A route map.
- Sun-faded ads: Noodle King, Sleep Is A Service, Dr. Hale, Lost? Call.
- A dot-matrix NEXT>VESPER ST sign.

**Living details** (12 s seamless loop):
- tunnel lamps streak past and rim-light her back;
- one tube flickers down the car;
- straps sway;
- the train sways and bumps over rail joints;
- she takes a drag, exhales, looks to the window, lowers the cigarette, taps ash, and blinks;
- smoke rises as dithered pixels and is pulled toward the window by the draft.

**Character.** Segmented low poly (about 1.4k triangles), smooth-shaded, every detail painted into 16–64 px
nearest-filtered textures:
- a planar-projected face (lids, lashes, lips, blush, a nose highlight);
- a bob with a ragged alpha-tested fringe and a PS1 "angel ring" highlight;
- a quilted puffer with a black yoke and white piping;
- denim with gold side seams;
- white sneakers with red heel tabs.

The skeleton is explicit: `pose(t)` → joint positions, 2-bone IK for the arms, and segments aimed between the joints
every frame.

**Rules** (from the reference):
- Low internal resolution with nearest upscale.
- Textures carry the detail and the baked light: grime at the bottoms of panels and in the corners, a worn aisle.
- Few soft lights and no shadow maps: blob shadows, plus contact shadow painted onto the seat.
- A muted world with one saturated accent on the subject.

## The Cistern (`studies/cistern/`): the AAA environment

**The frame.** A flooded brutalist cistern the size of a cathedral:
- A causeway with cold guide lights draws two leading lines (four, with their reflections) down a colonnade of precast
  concrete pillars.
- They end at a colossal ring whose inner edge burns red-orange.
- The ring is pulling the room apart. Concrete slabs hang around it, and a stream of fragments spirals inward, heating
  until it glows.
- One cloaked figure stands at the end of the causeway: the scale and the story.

**The taste rules it follows:**
- A huge cold-blue field and one small hot accent.
- Light with visible air: blue shafts from ceiling slots, mist cards, low mist on the water.
- Black mirror water doubles every light (planar reflection, distance-rough, fbm swell plus drip rings).
- Wet concrete: darker, glossy and streaked below a ragged wet line.
- Depth layers into fog: inner pillars, outer pillars, slit-lit walls, a monumental stair behind the ring.

**Materials** (Poly Haven CC0, `engine/studies/assets/tex/`):
- precast concrete wall for the pillars, beams and slabs;
- worn floor concrete for the causeway;
- concrete wall 008 for the outer walls and stair;
- metal plate for the ring (metalness 0.92 with a PMREM environment that contains the ring's own glow).

**Camera.** One slow push down the causeway (10 s) with operator breathing, a 2.39:1 letterbox, AgX, bloom on the HDR
sources, split-tone (cool shadows, warm highlights), chromatic aberration at the edges, and grain.

## The Room (`blender/scenes/tutorial_room.py`): the tutorial rebuild, in Blender + Cycles

The director's order (2026-11-07): rebuild the tutorial's home office to its quality before going back to the PS1 scene.
Built the tutorial's way (`docs/TUTORIAL_AI_ROOM_BUILD.md`):

| Stage | Here |
|---|---|
| Room shell in metres | 3.6 × 3.3 × 2.4 m. Walls are built around the window holes; skirting; deep sills |
| Windows | Aluminium frames, mullions and transoms. Wired frosted glass below, clear above, one frosted pane. Arch-viz glass: glass for camera and reflection rays, transparent for light rays, so daylight is direct light, not a caustic |
| Hero system object | Venetian blinds, slat by slat: 25 mm curved slats at a 21 mm pitch, tilted 38°, plus the headrail, bottom rail, ladder strings, tilt wand, pull cords and tassels |
| Direct modelling | L desk, beige pedestal, walnut cubbies and bookcase, side desk, wire rack, the leather executive chair, monitors, PC tower, keyboard (individual keys), laptop, architect and gooseneck lamps, mugs, bottles, books, paper piles, bags, cooler bag, stick vacuum, waste basket, cables, original toys (a red vinyl bear and a silver robot) |
| Poly Haven (CC0) | Cardboard boxes, wall clock, notepads, stationery, tape, pliers, wristwatch, multimeter, circuit board, binder, cassette player, camera |
| Materials | CC0 PBR sets from `engine/assets/tex` in metres; painted walls; leather with grain, coat and sat-in creases; every hard edge bevelled |
| Light | `--light day` (default): the soft overcast final. `sun`: the tutorial's "sunlight added" stage. Window portals, haze volume, AgX Medium High Contrast |
| Camera | `--cam wide` (square to the window wall from the door, 16 mm), `desk`, `chair`. `--anim N`: a handheld walk-in |

```bash
blender -b --factory-startup --python blender/scenes/tutorial_room.py -- out.png --res 1280x720 --samples 128 [--clay] [--light sun]
blender -b --factory-startup --python blender/scenes/tutorial_room.py -- renders/studies/room/walkin --res 960x540 --samples 40 --anim 96
```

Assets: `node tools/polyhaven.mjs --res 2k cardboard_box_01 wall_clock office_notepads stationery_supplies medical_tape pliers digital_wrist_watch retro_multimeter circuit_board binder_notebook cassette_player Camera_01`.
Time on this 4-core cloud CPU: about 50 s for a frame at 960×540 and 32 samples with haze.

**Still short of the tutorial (honest gaps):**
- Its 110 asset types are mostly photoreal generated models (Tripo, PBR). Ours are scripted, so the small props are simpler.
- Its chair has real tufting and wrinkles; ours is a subdivided approximation.
- Its frosted pane shows mottled detail.

Closing these needs either Tripo (as in `WORKFLOW.md` §3.4) or more modelling passes, prop by prop.

## Last Train v2 (`engine/studies/ps1-subway-v2/`): the PS1 look, pushed toward the reference

v1 is frozen as the approved look (`engine/studies/ps1-subway-v1/`, git tag `ps1-last-train-v1`). v2 follows the director's notes:
clean, cinematic low poly; a better character with proper hands and posture; better environment and light; a small story loop;
textures painted with p5.brush.

**Noor v2** (`blender/characters/ps1_noor.py`, textures from `ps1_noor_textures.py`):
- **Base:** a CC0 rigged base body (Quaternius Universal Base Characters, public domain; 65 bones, full fingers). It is
  dressed and styled as our own character: a red quilted puffer with black cuffs, denim, white sneakers, and a bob cut
  from the kit's long hair.
- **Clothes:** cut from the body by bone weights. The puffer is inflated and smoothed so it hangs instead of hugging.
- **Pose:** seated with IK on the arms and legs. The cigarette is held between index and middle finger, and the right
  hand rests half-curled on the knee.
- **The 12 s loop:**
  - she holds the cigarette by her chest;
  - she takes a drag (2–3.7 s) and exhales;
  - she looks across the car (6–7.6 s);
  - she lowers the cigarette to her knee and taps the ash (8–9.6 s);
  - she brings it back up.
  
  A breath runs every 4 s. The constraints are baked into plain bone animation for glTF.
- **In the engine:** `character_glb.js` gives the meshes PS1 materials (nearest-filtered, vertex snap), drives the
  AnimationMixer from the harness clock, and samples the ember and mouth over the loop, so the smoke trails come from
  where the cigarette was.

**Painted graphics** (`engine/studies/painter/` + `tools/paint_textures.mjs`, p5.js 2.2.0 + p5.brush 2.2.3 in `engine/vendor/p5/`):
- spray-and-marker graffiti tags, watercolour ad washes, a pen-and-marker route map and charcoal grime, all original
  designs;
- drawn into the PS1 textures at low resolution, so they keep their brush character under the pixel grid;
- pixel-font lettering stays on top.

**Camera and light:**
- the camera is closer, so she fills the right third as in the reference;
- the tube above her acts as a soft warm key on her face;
- the draft pulls the smoke toward the window.

```bash
python3 blender/characters/ps1_noor_textures.py <Quaternius dir>
blender -b --factory-startup --python blender/characters/ps1_noor.py -- <Quaternius dir> engine/studies/ps1-subway-v2/assets/noor.glb [--preview p.png --t 3.0]
node tools/paint_textures.mjs
node tools/study_render.mjs --study ps1-subway-v2 --film --w 1920 --h 1080 --mp4 renders/studies/ps1-subway-v2/last_train_v2_1080.mp4
```
The Quaternius pack: https://quaternius.itch.io/universal-base-characters (Standard, CC0; not committed). The built
`noor.glb` and its textures are in the repo.
