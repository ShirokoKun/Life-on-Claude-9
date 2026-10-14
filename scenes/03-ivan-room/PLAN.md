# Scene 3: Ivan's room (new set): plan

Status: **plan, waiting for approval.** No geometry built yet.
Refs: `ref/look_target.webp` (the look) · `ref/sketch_plan.jpg` (the layout) · `plan.svg` (this plan, top-down).

## 1. What we are matching

From the look target:
- **Night room lit by three sources only:**
  - a warm table lamp (left);
  - blue-white screens (centre);
  - cool moon/city light through a big window.
  Everything else falls to near-black, but the blacks are lifted and blue rather than crushed.
- **Haze:** a soft glow around every practical, a faint veil over the window, and light visibly "in the air".
- **Window:** a three-unit double-hung window with venetian blinds pulled up. Outside, a city at night is heavily out of focus: warm street-light bokeh close by and a cool skyline far off.
- **Framing:** out-of-focus foreground plants and furniture frame the bottom corners, which gives depth. The camera is eye-level, about 24–28 mm, looking straight at the window wall.
- **Palette:**
  - walls: dark green-teal;
  - furniture: walnut and cherry wood;
  - bedding and rug: navy;
  - accents: a warm amber lamp against blue screens and night.
- **Story props:**
  - a hoodie draped on the desk chair;
  - a takeaway coffee cup;
  - sticky notes on the monitor;
  - a microphone, a laptop, and two monitors with code on them;
  - a guitar, books, an alarm clock, a stereo with speakers, posters and a framed photo.

What we keep from our own pipeline, with no new rendering tech:
- the Blender lightmap bake;
- live lights for screens and lamp;
- the locked post LOOK (bloom, grain, DOF);
- the atmosphere dust and lamp cone, extended with window shafts and haze.

The reference is a target for mood, not a pixel copy.

## 2. Room (my reading of the sketch, checked against the image)

Axes: x = left→right as seen from the door wall, y = door wall (0) → window wall, z = up. In metres.

| Item | Where | Size |
|---|---|---|
| Room interior | | 4.6 × 3.8, ceiling 2.6. Exterior (window) wall 0.30 thick, others 0.12 |
| Window, north wall | x 1.50–4.10, three double-hung units with blinds | 2.60 wide, sill 0.82, head 2.32, deep reveal + sill board |
| Bed (full size) | head on the west wall, along the window wall | 2.0 × 1.4, y 1.95–3.35 |
| Side desk / nightstand + table lamp | NW corner, beside the bed head | 0.5 × 0.45 |
| Main desk + drawer pedestal (right) | under the right of the window | 1.9 × 0.65, x 2.15–4.05 |
| Desk chair + draped hoodie | in front of the desk, turned slightly | |
| Bookshelf, guitar leaning on it | east wall, north end | 0.35 × 1.2 × 2.0 |
| Lamp (sketch dot) | between bookshelf and desk | floor lamp, off or dim |
| Desk / shelf | east wall, middle | low drawer cabinet |
| Big plant | SE, near the camera side | foreground framing |
| Door | south wall, west end, opens inward | 0.9 × 2.1 |
| Low shelf / table (sketch "some shelf/table") | south wall, east of the door | foreground blur in the hero shot |
| Rug (dashed area) | centre | 2.4 × 1.7, navy |

**Hero camera (the look-target angle):**
- position x 2.7, y 0.45, z 1.30, looking north, 26 mm;
- out-of-focus foreground plant on the bottom left and low shelf on the bottom right.

## 3. Outside the window (the cinematic part)

The room sits high on a hill (or high floor), looking down over a valley city. The view is built in depth layers, so lens DOF turns each layer into natural bokeh:

1. **Right below the window, 3–15 m:** dark tree canopies, barely lit, with a few warm leaf edges catching street lights.
2. **Neighbourhood, 40–400 m:**
   - low roofs and streets;
   - instanced warm sodium (2000 K) and white LED street lights, with some lit house windows;
   - these are the big warm bokeh balls in the reference.
3. **Downtown, 1–3 km:**
   - towers with the window-grid emission from `exterior.py`, upgraded with interior mapping and per-tower colour;
   - red aviation lights blinking slowly;
   - blue atmospheric perspective.
4. **Sky:**
   - deep blue gradient with a city-glow band on the horizon;
   - moonlit cloud layer (HDRI or a painted card);
   - the moon itself off-frame, so it supplies the cool key through the window.
5. **Alive pass:**
   - one or two cars crawling far below;
   - windows switching off over time;
   - slow cloud drift;
   - aviation blink.

## 4. Lighting and atmosphere

| Source | Colour | Role | How |
|---|---|---|---|
| Moon + city sky through the window | 8000–9000 K blue | Cool key on the window wall, desk top, chair back, bed | Baked area light in the window + sky emission |
| Table lamp (fabric shade) | 2700 K amber | Warm pool in the NW corner, wall wash, the "home" light | Live point light inside the shade + emissive shade |
| Monitors ×2 + laptop | 6500 K, cool blue UI | Face light for Ivan, desk glow | Live RectAreaLights + canvas screen textures (existing `screens.js`) |
| Small practicals | Amber / green LEDs | Stereo LED, alarm-clock digits, laptop charging LED | Emission |
| Bounce | — | Very low; walls are dark green so they soak light | Lightmap |

**Haze:**
- extend `atmosphere.js` with window light shafts through the blind gaps and a thin uniform haze that lifts the blacks towards blue;
- keep the existing lamp cone and dust;
- `post.js` LOOK stays locked.

**Times of day (later):** the room is built as lighting *sets* like s02, with `3am` first. Dawn and day can follow on the same geometry.

## 5. Assets

**Reuse from our repo:**
- desk-chair, monitor, laptop, mug, phone, notebook and clock builders (`props_desk.py`, `props_clutter.py`);
- the procedural plant, cloth heap and catenary cables;
- the CC0 texture sets in `engine/assets/tex/` (walnut, oak floor, plaster, linen, knit, rug, paper);
- `exterior.py` facades;
- screen canvases from `screens.js`.

**Fetch (CC0, Poly Haven), checked available:**
- `potted_plant_01/02/04` and `fern_02` (foreground framing and corners);
- `ClassicNightstand_01`, `drawer_cabinet` and `modern_wooden_cabinet` (side desk, east-wall desk/shelf, south shelf);
- `wooden_bookshelf_worn` (or our own bookshelf), `decorative_book_set_01` and `book_encyclopedia_set_01`;
- `alarm_clock_01`, `throw_pillows_01`, `hanging_picture_frame_01..03` and `standing_picture_frame_01`;
- a night HDRI for the sky.

**Build in Blender** (simple, or no good free version exists):
- shell, window and blinds;
- bed with duvet: a cloth-sim quilt;
- table lamp: lathe;
- hoodie draped on the chair: cloth sim;
- stereo and speakers: boxes;
- posters: our own artwork, no copyrighted film posters.

**Open:** an acoustic guitar. Poly Haven has none. I can model it (body outline + lathe neck; fine for a mid-ground prop) unless you have one from Sketchfab or BlenderKit.

## 6. Engine change needed

The engine hard-codes one room (`assets/room.glb`, `assets/lightmaps/*`, `assets/lights.json` in `engine/src/main.js`).

New scene modules will export `ROOM = 'scenes/s03/room'`, and main.js will load that folder when it is set. Scenes without it load exactly as now; I will check that with a before/after intro frame.

## 7. Build order (each step ends in a frame we look at)

1. **Grey-box:**
   - shell + window + furniture blocks in grey;
   - hero camera set to match the reference;
   - side-by-side frame with `ref/look_target.webp`.
2. **Exterior layers + sky** (window view in focus and out of focus).
3. **Furniture and props:** fetch, place, restyle the materials; hero desk detail.
4. **Lighting:** bake `3am`, live lamp + screens, haze/shafts. Gate: 3 camera angles side by side with the reference.
5. **Scene module `s03`:** a camera tour / shots once you share the story beats; Ivan drops in when the new Tripo model arrives (same `prep_tripo.py` path).
